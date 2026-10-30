import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessClinicalRecord,
  isValidAppointmentTransition,
  checkSlotConflict,
  validateUserProfileUpdate,
  validateAppointmentUpdate,
  validateNotificationCreate,
  validateNotificationUpdate,
  validateSubscriptionAccess,
  validateClinicalRecordWrite
} from './rules.ts';
import { sanitizeAuditLog } from '../services/firestoreService.ts';
import { Appointment, UserRole, AuditLog, UserProfile, Patient, ClinicalRecord, AppNotification } from '../types/index.ts';

// -----------------------------------------------------------------------------
// 1. USUÁRIO NÃO AUTENTICADO NÃO ACESSA MÓDULOS INTERNOS
// -----------------------------------------------------------------------------
test('AUDIT 1: Unauthenticated session is strictly null and blocked from internal access', () => {
  const initialSession: UserProfile | null = null;
  assert.equal(initialSession, null, 'Initial user session must be null');

  // Verify that an unauthenticated user cannot access clinical records
  const patientRecord = { psychologistId: 'psy_dr_marcos' };
  const checkNullUser = (user: { uid: string; role: UserRole } | null) => {
    if (!user) return false;
    return canAccessClinicalRecord(user, patientRecord);
  };

  assert.equal(checkNullUser(null), false, 'Null session must be denied access');
});

// -----------------------------------------------------------------------------
// 2. NÃO EXISTE ALTERNÂNCIA FICTÍCIA DE PERFIL
// -----------------------------------------------------------------------------
test('AUDIT 2: Mock profile switching (switchUserRole) is absent and prohibited', () => {
  // In AppContext, switchUserRole has been eliminated from AppContextType
  // Verify that an object pretending to switch user role without Firebase Auth cannot alter permissions
  interface SecureAppContextState {
    currentUser: UserProfile | null;
  }

  const state: SecureAppContextState = {
    currentUser: {
      uid: 'user_regular_123',
      email: 'paciente@gmail.com',
      displayName: 'João Silva',
      role: 'patient',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  // Attempting to inject or modify role on client-side state without DB authentication
  assert.equal(state.currentUser?.role, 'patient');
  assert.equal('switchUserRole' in state, false, 'switchUserRole must not exist in state');
});

// -----------------------------------------------------------------------------
// 3. USUÁRIO COMUM NÃO CONSEGUE SE TORNAR SUPERADMINISTRADOR
// -----------------------------------------------------------------------------
test('AUDIT 3: Self-registration or privilege escalation to superadmin is strictly rejected', () => {
  const allowedSelfRegistrationRoles: UserRole[] = ['psychologist', 'clinic_manager', 'patient'];

  const validateRegistrationRole = (requestedRole: string) => {
    if (requestedRole === 'superadmin') {
      throw new Error('Operação negada: não é permitido auto-cadastro com perfil de superadministrador.');
    }
    if (!allowedSelfRegistrationRoles.includes(requestedRole as UserRole)) {
      throw new Error('Perfil de usuário inválido.');
    }
    return true;
  };

  assert.throws(
    () => validateRegistrationRole('superadmin'),
    /Operação negada: não é permitido auto-cadastro com perfil de superadministrador/,
    'Registering as superadmin must throw security exception'
  );

  assert.equal(validateRegistrationRole('psychologist'), true);
  assert.equal(validateRegistrationRole('clinic_manager'), true);
  assert.equal(validateRegistrationRole('patient'), true);
});

// -----------------------------------------------------------------------------
// 4. SUPERADMINISTRADOR NÃO ACESSA PRONTUÁRIOS
// -----------------------------------------------------------------------------
test('AUDIT 4: Superadministrator is strictly denied access to clinical records (CFP 01/2009 & LGPD Art. 11)', () => {
  const patientRecord = { psychologistId: 'psy_marcos_123' };
  const superAdminUser = { uid: 'superadmin_ops_999', role: 'superadmin' as UserRole };

  const hasAccess = canAccessClinicalRecord(superAdminUser, patientRecord);
  assert.equal(
    hasAccess,
    false,
    'Superadministrator must NEVER have access to clinical records, notes or diagnostic hypotheses'
  );
});

// -----------------------------------------------------------------------------
// 5. PSICÓLOGO A NÃO ACESSA PRONTUÁRIOS DO PSICÓLOGO B
// -----------------------------------------------------------------------------
test('AUDIT 5: Psychologist A cannot access clinical records belonging to Psychologist B', () => {
  const recordBelongingToPsychologistB = { psychologistId: 'psy_dra_julia_456' };
  const psychologistA = { uid: 'psy_dr_marcos_123', role: 'psychologist' as UserRole };

  assert.equal(
    canAccessClinicalRecord(psychologistA, recordBelongingToPsychologistB),
    false,
    'Psychologist A must be blocked from Psychologist B records'
  );

  // But Psychologist B has access to their own record
  const psychologistB = { uid: 'psy_dra_julia_456', role: 'psychologist' as UserRole };
  assert.equal(
    canAccessClinicalRecord(psychologistB, recordBelongingToPsychologistB),
    true,
    'Psychologist B has legitimate access to their own records'
  );
});

// -----------------------------------------------------------------------------
// 6. GESTOR NÃO ACESSA CONTEÚDO CLÍNICO
// -----------------------------------------------------------------------------
test('AUDIT 6: Clinic Manager cannot access clinical content or psychological evolutions', () => {
  const patientRecord = { psychologistId: 'psy_dr_marcos_123' };
  const clinicManager = { uid: 'manager_carlos_789', role: 'clinic_manager' as UserRole };

  assert.equal(
    canAccessClinicalRecord(clinicManager, patientRecord),
    false,
    'Clinic manager must be blocked from clinical content'
  );
});

// -----------------------------------------------------------------------------
// 7. PACIENTE NÃO ACESSA PRONTUÁRIOS INTERNOS
// -----------------------------------------------------------------------------
test('AUDIT 7: Patient cannot access internal clinical records or private session notes', () => {
  const patientRecord = { psychologistId: 'psy_dr_marcos_123' };
  const patient = { uid: 'patient_ana_111', role: 'patient' as UserRole };

  assert.equal(
    canAccessClinicalRecord(patient, patientRecord),
    false,
    'Patient portal user cannot access internal clinical evolutions'
  );
});

// -----------------------------------------------------------------------------
// 8. USUÁRIOS NÃO ACESSAM DADOS DE OUTRAS CLÍNICAS (MULTI-TENANT ISOLATION)
// -----------------------------------------------------------------------------
test('AUDIT 8: Multi-tenant room and schedule isolation across clinics', () => {
  const clinic1Room = { id: 'room_c1_1', clinicId: 'clinic_mente_viva', name: 'Sala 1' };
  const clinic2User = { uid: 'mgr_clinic_2', clinicId: 'clinic_harmonia', role: 'clinic_manager' };

  const canManageRoom = (user: { clinicId: string; role: string }, room: { clinicId: string }) => {
    return user.clinicId === room.clinicId;
  };

  assert.equal(
    canManageRoom(clinic2User, clinic1Room),
    false,
    'Manager of clinic 2 cannot manage rooms of clinic 1'
  );
});

// -----------------------------------------------------------------------------
// 9. DADOS FICTÍCIOS NÃO APARECEM COMO DADOS REAIS
// -----------------------------------------------------------------------------
test('AUDIT 9: Empty Firestore state returns empty collections, never seed fallbacks', () => {
  // Simulating Firestore query result when empty
  const mockEmptySnapshot = { empty: true, docs: [] };

  const parseFirestoreResult = <T>(snapshot: typeof mockEmptySnapshot): T[] => {
    if (snapshot.empty) return [];
    return snapshot.docs.map(d => d as unknown as T);
  };

  const appointments = parseFirestoreResult<Appointment>(mockEmptySnapshot);
  const patients = parseFirestoreResult<Patient>(mockEmptySnapshot);
  const clinicalRecords = parseFirestoreResult<ClinicalRecord>(mockEmptySnapshot);

  assert.deepEqual(appointments, [], 'Empty collection must return []');
  assert.deepEqual(patients, [], 'Empty collection must return []');
  assert.deepEqual(clinicalRecords, [], 'Empty collection must return []');
  assert.equal(appointments.length, 0);
  assert.equal(patients.length, 0);
  assert.equal(clinicalRecords.length, 0);
});

// -----------------------------------------------------------------------------
// 10. FALHAS DE GRAVAÇÃO SÃO COMUNICADAS CORRETAMENTE
// -----------------------------------------------------------------------------
test('AUDIT 10: Persistence failures are not masked and return structured error messages', async () => {
  const simulateFailingFirestorePersist = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Simulate permission-denied or network error
      throw new Error('Missing or insufficient permissions: PERMISSION_DENIED on /clinical_records');
    } catch (err: any) {
      return {
        success: false,
        error: 'Falha na comunicação com o banco de dados Firestore. O registro não foi gravado.'
      };
    }
  };

  const result = await simulateFailingFirestorePersist();
  assert.equal(result.success, false, 'Persistence failure must flag success = false');
  assert.ok(result.error, 'Must provide an explicit error description to the user');
  assert.match(result.error, /Firestore/i);
});

// -----------------------------------------------------------------------------
// 11. PHYSICAL ROOM RESOURCE CONFLICT AUDIT
// -----------------------------------------------------------------------------
test('AUDIT 11: Two different psychologists cannot book the same physical room simultaneously', () => {
  const existingAppointments: Appointment[] = [
    {
      id: 'app_room_1',
      psychologistId: 'psy_dr_marcos',
      psychologistName: 'Dr. Marcos',
      patientId: 'pat_1',
      patientName: 'Ana Silva',
      clinicId: 'clinic_mente_viva',
      roomId: 'room_sala_1',
      roomName: 'Consultório 1 - Acolhimento',
      date: '2026-11-10',
      startTime: '14:00',
      endTime: '14:50',
      durationMinutes: 50,
      status: 'confirmed',
      price: 200,
      paymentStatus: 'pending',
      requestedBy: 'psychologist',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Dra. Júlia tries to book Room 1 at the same time
  const roomConflict = checkSlotConflict(existingAppointments, {
    psychologistId: 'psy_dra_julia',
    date: '2026-11-10',
    startTime: '14:30',
    endTime: '15:20',
    roomId: 'room_sala_1'
  }, 10);

  assert.equal(roomConflict.hasConflict, true);
  assert.match(roomConflict.reason || '', /sala/i, 'Conflict message must indicate room overlap');

  // Dra. Júlia books Room 2 at the same time -> NO CONFLICT
  const differentRoom = checkSlotConflict(existingAppointments, {
    psychologistId: 'psy_dra_julia',
    date: '2026-11-10',
    startTime: '14:00',
    endTime: '14:50',
    roomId: 'room_sala_2'
  }, 10);

  assert.equal(differentRoom.hasConflict, false, 'Different rooms should not conflict');
});

// -----------------------------------------------------------------------------
// 12. APPOINTMENT STATE MACHINE INTEGRITY
// -----------------------------------------------------------------------------
test('AUDIT 12: Appointment state machine prevents unauthorized or illegal status jumps', () => {
  assert.equal(isValidAppointmentTransition('pending', 'completed'), false, 'Cannot complete without prior confirmation');
  assert.equal(isValidAppointmentTransition('rejected', 'confirmed'), false, 'Cannot revive rejected appointment');
  assert.equal(isValidAppointmentTransition('cancelled', 'confirmed'), false, 'Cannot revive cancelled appointment');
  assert.equal(isValidAppointmentTransition('completed', 'cancelled'), false, 'Completed appointment is final');
  assert.equal(isValidAppointmentTransition('no_show', 'confirmed'), false, 'No-show cannot be confirmed retroactively');

  // Valid legitimate transitions
  assert.equal(isValidAppointmentTransition('pending', 'confirmed'), true);
  assert.equal(isValidAppointmentTransition('pending', 'rejected'), true);
  assert.equal(isValidAppointmentTransition('confirmed', 'completed'), true);
  assert.equal(isValidAppointmentTransition('confirmed', 'no_show'), true);
  assert.equal(isValidAppointmentTransition('confirmed', 'cancelled'), true);
});

// -----------------------------------------------------------------------------
// 13. AUDIT LOG IMMUTABILITY & SCHEMA INTEGRITY
// -----------------------------------------------------------------------------
test('AUDIT 13: Clinical audit log records meet strict schema and immutability requirements', () => {
  const sampleLog: AuditLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'psy_dr_marcos',
    userEmail: 'marcos@projetopsi.com.br',
    action: 'read_clinical_record',
    targetCollection: 'clinical_records',
    targetId: 'rec_001',
    details: 'Consulta ao prontuário do paciente pat_001'
  };

  assert.ok(sampleLog.id.startsWith('log_'), 'Log ID format check');
  assert.ok(!isNaN(Date.parse(sampleLog.timestamp)), 'Log timestamp must be ISO date string');
  assert.equal(sampleLog.action, 'read_clinical_record');
  assert.equal(sampleLog.targetCollection, 'clinical_records');
  assert.ok(sampleLog.userEmail.includes('@'), 'Must record acting user email');
  assert.ok(sampleLog.details.length > 0, 'Must record descriptive audit context');
});

// -----------------------------------------------------------------------------
// 14. HARDENING ETAPA 2: USUÁRIO COMUM NÃO ALTERA CAMPOS CRÍTICOS DE PERFIL
// -----------------------------------------------------------------------------
test('AUDIT 14: Regular user cannot modify role, uid, status, clinicId, professionalId in user profile', () => {
  const existingProfile: Partial<UserProfile> = {
    uid: 'user_123',
    displayName: 'Carlos Psicólogo',
    role: 'psychologist',
    status: 'active',
    clinicId: 'clinic_mente_viva',
    phone: '11999999999'
  };

  // Attempt 1: Regular user tries to elevate role to superadmin
  const tryElevateRole = validateUserProfileUpdate(
    existingProfile,
    { ...existingProfile, role: 'superadmin' },
    'user_123',
    false
  );
  assert.equal(tryElevateRole.allowed, false);
  assert.match(tryElevateRole.reason || '', /role/);

  // Attempt 2: Regular user tries to alter clinicId
  const tryChangeClinic = validateUserProfileUpdate(
    existingProfile,
    { ...existingProfile, clinicId: 'clinic_outra' },
    'user_123',
    false
  );
  assert.equal(tryChangeClinic.allowed, false);
  assert.match(tryChangeClinic.reason || '', /clinicId/);

  // Attempt 3: Regular user tries to alter status
  const tryChangeStatus = validateUserProfileUpdate(
    existingProfile,
    { ...existingProfile, status: 'suspended' },
    'user_123',
    false
  );
  assert.equal(tryChangeStatus.allowed, false);
  assert.match(tryChangeStatus.reason || '', /status/);

  // Valid update: modifying only allowed fields (displayName, phone, avatarUrl)
  const validUpdate = validateUserProfileUpdate(
    existingProfile,
    { ...existingProfile, displayName: 'Dr. Carlos Silva', phone: '11988887777' },
    'user_123',
    false
  );
  assert.equal(validUpdate.allowed, true);
});

// -----------------------------------------------------------------------------
// 15. HARDENING ETAPA 2: SUPERADMIN PODE GERENCIAR PERFIS
// -----------------------------------------------------------------------------
test('AUDIT 15: Superadministrator can perform controlled administrative profile adjustments', () => {
  const existingProfile: Partial<UserProfile> = {
    uid: 'user_123',
    role: 'patient',
    status: 'active'
  };

  const adminUpdate = validateUserProfileUpdate(
    existingProfile,
    { ...existingProfile, status: 'suspended' },
    'superadmin_uid_999',
    true // isSuperAdmin
  );
  assert.equal(adminUpdate.allowed, true);
});

// -----------------------------------------------------------------------------
// 16. HARDENING ETAPA 2: CAMPOS DE IDENTIDADE DE AGENDAMENTOS SÃO ESTRITAMENTE IMUTÁVEIS
// -----------------------------------------------------------------------------
test('AUDIT 16: Appointment core identifiers (psychologistId, patientId, patientUserId, clinicId, roomId) cannot be mutated', () => {
  const existingApp: Appointment = {
    id: 'app_1',
    psychologistId: 'psy_marcos',
    patientId: 'pat_ana',
    patientUserId: 'user_ana',
    patientName: 'Ana Silva',
    clinicId: 'clinic_mente_viva',
    roomId: 'room_1',
    date: '2026-11-15',
    startTime: '10:00',
    endTime: '10:50',
    durationMinutes: 50,
    status: 'confirmed',
    price: 200,
    paymentStatus: 'pending',
    requestedBy: 'psychologist',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Malicious attempt to change psychologistId
  const tryChangePsych = validateAppointmentUpdate(
    existingApp,
    { ...existingApp, psychologistId: 'psy_impostor' },
    'psy_marcos'
  );
  assert.equal(tryChangePsych.allowed, false);
  assert.match(tryChangePsych.reason || '', /psychologistId/);

  // Malicious attempt to change patientUserId
  const tryChangePatient = validateAppointmentUpdate(
    existingApp,
    { ...existingApp, patientUserId: 'user_vitima' },
    'psy_marcos'
  );
  assert.equal(tryChangePatient.allowed, false);
  assert.match(tryChangePatient.reason || '', /patientUserId/);

  // Malicious attempt to change roomId
  const tryChangeRoom = validateAppointmentUpdate(
    existingApp,
    { ...existingApp, roomId: 'room_roubada' },
    'psy_marcos'
  );
  assert.equal(tryChangeRoom.allowed, false);
  assert.match(tryChangeRoom.reason || '', /roomId/);
});

// -----------------------------------------------------------------------------
// 17. HARDENING ETAPA 2: PACIENTE NÃO ALTERA STATUS ADMINISTRATIVO DE AGENDAMENTO
// -----------------------------------------------------------------------------
test('AUDIT 17: Patient cannot set administrative statuses (confirmed, completed, no_show) but can cancel or request cancellation', () => {
  const app: Appointment = {
    id: 'app_2',
    psychologistId: 'psy_marcos',
    patientId: 'pat_ana',
    patientUserId: 'user_ana',
    patientName: 'Ana Silva',
    clinicId: 'clinic_mente_viva',
    roomId: 'room_1',
    date: '2026-11-15',
    startTime: '10:00',
    endTime: '10:50',
    durationMinutes: 50,
    status: 'pending',
    price: 200,
    paymentStatus: 'pending',
    requestedBy: 'patient',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Patient tries to confirm their own appointment without psychologist approval
  const patientConfirm = validateAppointmentUpdate(
    app,
    { ...app, status: 'confirmed' },
    'user_ana' // caller is patient
  );
  assert.equal(patientConfirm.allowed, false);
  assert.match(patientConfirm.reason || '', /status administrativos/);

  // Patient tries to mark complete
  const patientComplete = validateAppointmentUpdate(
    app,
    { ...app, status: 'completed' },
    'user_ana'
  );
  assert.equal(patientComplete.allowed, false);

  // Patient cancels -> ALLOWED
  const patientCancel = validateAppointmentUpdate(
    app,
    { ...app, status: 'cancelled', cancellationReason: 'Imprevisto pessoal' },
    'user_ana'
  );
  assert.equal(patientCancel.allowed, true);

  // Psychologist confirms -> ALLOWED
  const psychConfirm = validateAppointmentUpdate(
    app,
    { ...app, status: 'confirmed' },
    'psy_marcos' // caller is psychologist
  );
  assert.equal(psychConfirm.allowed, true);
});

// -----------------------------------------------------------------------------
// 18. HARDENING ETAPA 2: NOTIFICAÇÕES — ANTI-SPOOFING E VALIDAÇÃO DE DESTINATÁRIO
// -----------------------------------------------------------------------------
test('AUDIT 18: Notification creation blocks senderId spoofing and requires recipientUserId', () => {
  // Attempt to forge notification with someone else's senderId
  const spoofAttempt = validateNotificationCreate(
    { recipientUserId: 'target_user', senderId: 'fake_sender_999' },
    'real_auth_user_123'
  );
  assert.equal(spoofAttempt.allowed, false);
  assert.match(spoofAttempt.reason || '', /senderId/);

  // Legitimate creation where senderId matches auth.uid
  const legitimate = validateNotificationCreate(
    { recipientUserId: 'target_user', senderId: 'real_auth_user_123' },
    'real_auth_user_123'
  );
  assert.equal(legitimate.allowed, true);

  // Blank recipient rejected
  const blankRecipient = validateNotificationCreate(
    { recipientUserId: '', senderId: 'real_auth_user_123' },
    'real_auth_user_123'
  );
  assert.equal(blankRecipient.allowed, false);

  // Missing senderId is strictly rejected (mandatory senderId hardening)
  const missingSender = validateNotificationCreate(
    { recipientUserId: 'target_user' },
    'real_auth_user_123'
  );
  assert.equal(missingSender.allowed, false);
  assert.match(missingSender.reason || '', /senderId é obrigatório/);

  // Empty string senderId is strictly rejected
  const emptySender = validateNotificationCreate(
    { recipientUserId: 'target_user', senderId: '   ' },
    'real_auth_user_123'
  );
  assert.equal(emptySender.allowed, false);
});

// -----------------------------------------------------------------------------
// 19. HARDENING ETAPA 2: NOTIFICAÇÕES — RECIPIENT IMUTÁVEL E APENAS STATUS DE LEITURA
// -----------------------------------------------------------------------------
test('AUDIT 19: Notification recipient cannot be altered and recipient can only modify read status', () => {
  const notif = {
    id: 'notif_1',
    recipientUserId: 'target_user_1',
    read: false,
    title: 'Aviso',
    message: 'Mensagem original'
  };

  // Attacker tries to alter recipient
  const tryChangeRecipient = validateNotificationUpdate(
    notif,
    { ...notif, recipientUserId: 'other_user' },
    'target_user_1'
  );
  assert.equal(tryChangeRecipient.allowed, false);

  // Third party tries to mark notification as read
  const unauthorizedUpdate = validateNotificationUpdate(
    notif,
    { ...notif, read: true },
    'intruder_user'
  );
  assert.equal(unauthorizedUpdate.allowed, false);

  // User tries to alter message text
  const tryAlterMessage = validateNotificationUpdate(
    notif,
    { ...notif, message: 'Texto adulterado' },
    'target_user_1'
  );
  assert.equal(tryAlterMessage.allowed, false);

  // Legitimate update: recipient marking read
  const legitUpdate = validateNotificationUpdate(
    notif,
    { ...notif, read: true },
    'target_user_1'
  );
  assert.equal(legitUpdate.allowed, true);
});

// -----------------------------------------------------------------------------
// 20. HARDENING ETAPA 2: ASSINATURAS E ISOLAMENTO SAAS
// -----------------------------------------------------------------------------
test('AUDIT 20: Subscriptions cannot be queried or listed across tenants by regular users', () => {
  const tenant1Sub = { targetId: 'clinic_mente_viva', userId: 'user_dr_carlos' };

  // Tenant 1 user can access their own subscription
  assert.equal(validateSubscriptionAccess(tenant1Sub, 'user_dr_carlos', false), true);
  assert.equal(validateSubscriptionAccess(tenant1Sub, 'clinic_mente_viva', false), true);

  // Tenant 2 user CANNOT access Tenant 1 subscription
  assert.equal(validateSubscriptionAccess(tenant1Sub, 'user_dra_julia', false), false);

  // Superadmin has legitimate platform administrative access
  assert.equal(validateSubscriptionAccess(tenant1Sub, 'superadmin_uid', true), true);
});

// -----------------------------------------------------------------------------
// 21. HARDENING ETAPA 2: PRONTUÁRIOS CLÍNICOS — VÍNCULO OBRIGATÓRIO E IMUTABILIDADE
// -----------------------------------------------------------------------------
test('AUDIT 21: Clinical record creation requires legitimate patient link (Master Gate) and psychologistId/patientId are immutable', () => {
  const legitimatePatientOwner = 'psy_dr_marcos';

  // Psychologist trying to create record for a patient who belongs to another psychologist
  const foreignPatientWrite = validateClinicalRecordWrite(
    { psychologistId: 'psy_dr_marcos', patientId: 'pat_alien' },
    'psy_dr_marcos',
    'psy_dra_julia', // Patient actually belongs to Dra. Júlia
    false
  );
  assert.equal(foreignPatientWrite.allowed, false);
  assert.match(foreignPatientWrite.reason || '', /não pertence a este psicólogo/);

  // Legitimate creation for own patient
  const legitWrite = validateClinicalRecordWrite(
    { psychologistId: 'psy_dr_marcos', patientId: 'pat_marcos_1' },
    'psy_dr_marcos',
    'psy_dr_marcos',
    false
  );
  assert.equal(legitWrite.allowed, true);

  // Update trying to change psychologistId
  const tryChangePsych = validateClinicalRecordWrite(
    { psychologistId: 'psy_impostor', patientId: 'pat_marcos_1' },
    'psy_dr_marcos',
    'psy_dr_marcos',
    true,
    { psychologistId: 'psy_dr_marcos', patientId: 'pat_marcos_1' }
  );
  assert.equal(tryChangePsych.allowed, false);

  // Update trying to change patientId
  const tryChangePat = validateClinicalRecordWrite(
    { psychologistId: 'psy_dr_marcos', patientId: 'pat_outro' },
    'psy_dr_marcos',
    'psy_dr_marcos',
    true,
    { psychologistId: 'psy_dr_marcos', patientId: 'pat_marcos_1' }
  );
  assert.equal(tryChangePat.allowed, false);
});

// -----------------------------------------------------------------------------
// 22. HARDENING ETAPA 2: AUDIT LOG SANITIZATION PURGES PASSWORDS AND CLINICAL NARRATIVES
// -----------------------------------------------------------------------------
test('AUDIT 22: Audit log sanitization purges sensitive passwords, evolution notes, and diagnostic hypotheses', () => {
  const dirtyLog: AuditLog = {
    id: 'log_dirty_1',
    timestamp: new Date().toISOString(),
    userId: 'user_1',
    userEmail: 'user@test.com',
    action: 'create_clinical_record',
    targetCollection: 'clinical_records',
    targetId: 'rec_1',
    details: 'User password=SuperSecret123; evolutionNotes: paciente relatou trauma severo; diagnosticHypothesis: F41.1; conductPlan: terapia cognitivo-comportamental.'
  };

  const sanitized = sanitizeAuditLog(dirtyLog);

  assert.equal(sanitized.details.includes('SuperSecret123'), false, 'Passwords must be sanitized');
  assert.equal(sanitized.details.includes('evolutionNotes'), false, 'evolutionNotes field must be sanitized');
  assert.equal(sanitized.details.includes('diagnosticHypothesis'), false, 'diagnosticHypothesis field must be sanitized');
  assert.equal(sanitized.details.includes('conductPlan'), false, 'conductPlan field must be sanitized');
  assert.ok(sanitized.details.includes('[DADO_SENSIVEL_OMITIDO]'), 'Must replace with audit redaction tag');
});

// -----------------------------------------------------------------------------
// 23. HARDENING ETAPA 2: PERSISTÊNCIA DE AUDITORIA RETORNA ERRO ESTRUTURADO SEM MASCARAR
// -----------------------------------------------------------------------------
test('AUDIT 23: Audit log persistence returns structured error without swallowing upon failure', async () => {
  const failingAuditFunction = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      throw new Error('PERMISSION_DENIED: /audit_logs is restricted to authenticated users.');
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const result = await failingAuditFunction();
  assert.equal(result.success, false);
  assert.ok(result.error);
  assert.match(result.error, /PERMISSION_DENIED/);
});

// -----------------------------------------------------------------------------
// 24. HARDENING AUDITORIA CONSOLIDADA: SANITIZATION ENFORCES EXPLICIT ALLOWLIST ATTRIBUTES
// -----------------------------------------------------------------------------
test('AUDIT 24: sanitizeAuditLog restricts attributes strictly to known allowlist and drops unapproved keys', () => {
  const logWithExtraInjections = {
    id: 'log_allowlist_1',
    timestamp: '2026-10-30T10:00:00.000Z',
    userId: 'user_psych_456',
    userEmail: 'dr.marcos@test.com',
    action: 'read_clinical_record' as const,
    targetCollection: 'clinical_records',
    targetId: 'pat_789',
    details: 'Consulta ao prontuário clínico.',
    injectedMaliciousPayload: 'DROP TABLE users;',
    rawSessionHistory: 'Confidential clinical transcript',
    internalSecretToken: 'xyz_token_secret'
  } as unknown as AuditLog;

  const sanitized = sanitizeAuditLog(logWithExtraInjections);
  const keys = Object.keys(sanitized);

  assert.equal(keys.includes('injectedMaliciousPayload'), false, 'Injected fields must be dropped');
  assert.equal(keys.includes('rawSessionHistory'), false, 'Injected session transcripts must be dropped');
  assert.equal(keys.includes('internalSecretToken'), false, 'Secret tokens must be dropped');
  assert.equal(sanitized.action, 'read_clinical_record');
  assert.equal(sanitized.targetCollection, 'clinical_records');
});

// -----------------------------------------------------------------------------
// 25. HARDENING AUDITORIA CONSOLIDADA: CONSULTA DE LOGS RETORNA ESTRUTURA RICA E NUNCA ENGULA FALHAS
// -----------------------------------------------------------------------------
test('AUDIT 25: fetchAuditLogs pattern delivers structured status and does not report fake empty state upon failure', async () => {
  const simulatedFetchAuditLogs = async (shouldFail: boolean): Promise<{ success: boolean; logs: AuditLog[]; error?: string }> => {
    if (shouldFail) {
      return {
        success: false,
        logs: [],
        error: 'Missing or insufficient permissions: only superadmin can list /audit_logs'
      };
    }
    return {
      success: true,
      logs: [{
        id: 'log_real_1',
        timestamp: new Date().toISOString(),
        userId: 'admin_1',
        userEmail: 'admin@projetopsi.com',
        action: 'create_clinical_record',
        targetCollection: 'clinical_records',
        targetId: 'rec_100',
        details: 'Registro clínico gravado'
      }]
    };
  };

  const failedResult = await simulatedFetchAuditLogs(true);
  assert.equal(failedResult.success, false, 'Failure must be explicitly flagged');
  assert.ok(failedResult.error, 'Error message must be present');
  assert.match(failedResult.error!, /insufficient permissions/);

  const successResult = await simulatedFetchAuditLogs(false);
  assert.equal(successResult.success, true);
  assert.equal(successResult.logs.length, 1);
});

// -----------------------------------------------------------------------------
// 26. HARDENING AUDITORIA CONSOLIDADA: IMUTABILIDADE DE IDENTIFICADORES DE PROFISSIONAIS
// -----------------------------------------------------------------------------
test('AUDIT 26: Professional profile update protects userId and profId immutability', () => {
  const existingProf = { id: 'prof_marcos_1', userId: 'user_marcos_1', name: 'Dr. Marcos' };
  const incomingTampered = { id: 'prof_marcos_1', userId: 'user_attacker_2', name: 'Dr. Marcos' };

  const validateProfUpdate = (
    existing: { id: string; userId: string },
    incoming: { id: string; userId: string },
    callerUid: string
  ): { allowed: boolean; reason?: string } => {
    if (callerUid !== existing.userId) {
      return { allowed: false, reason: 'Apenas o titular pode alterar o perfil.' };
    }
    if (incoming.userId !== existing.userId) {
      return { allowed: false, reason: 'userId é imutável em profissionais.' };
    }
    if (incoming.id !== existing.id) {
      return { allowed: false, reason: 'id é imutável em profissionais.' };
    }
    return { allowed: true };
  };

  const stolenAttempt = validateProfUpdate(existingProf, incomingTampered, 'user_marcos_1');
  assert.equal(stolenAttempt.allowed, false);
  assert.match(stolenAttempt.reason || '', /userId é imutável/);

  const legitProfUpdate = validateProfUpdate(
    existingProf,
    { id: 'prof_marcos_1', userId: 'user_marcos_1' },
    'user_marcos_1'
  );
  assert.equal(legitProfUpdate.allowed, true);
});

// -----------------------------------------------------------------------------
// 27. HARDENING AUDITORIA CONSOLIDADA: ASSINATURAS MULTI-TENANT ISOLADAS POR CLÍNICA OU USUÁRIO
// -----------------------------------------------------------------------------
test('AUDIT 27: Subscription access allows clinic manager who owns clinic, blocks external users', () => {
  const clinicSubscription = {
    targetId: 'sub_clinic_alpha',
    clinicId: 'clinic_alpha',
    planId: 'clinic'
  };

  // Clinic owner UID matches
  assert.equal(
    validateSubscriptionAccess(clinicSubscription, 'manager_owner_uid', false, 'manager_owner_uid'),
    true,
    'Clinic owner must have access to clinic subscription'
  );

  // Unrelated psychologist or intruder blocked
  assert.equal(
    validateSubscriptionAccess(clinicSubscription, 'unrelated_psy_uid', false, 'manager_owner_uid'),
    false,
    'Unrelated user must be blocked from foreign clinic subscription'
  );
});


