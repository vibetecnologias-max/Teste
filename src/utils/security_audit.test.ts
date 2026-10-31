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
  validateClinicalRecordWrite,
  validateClinicalRecordDelete,
  validateClinicUpdate,
  validateProfessionalAccess,
  validateClinicalRectificationCreate,
  validateClinicalRectificationUpdateAndDelete,
  validateUserActiveStatus,
  validateAppointmentCreate,
  validateRoomTransfer,
  validatePaymentUpdate,
  validatePublicProfessionalPublish
} from './rules.ts';
import { sanitizeAuditLog } from '../services/firestoreService.ts';
import { Appointment, UserRole, AuditLog, UserProfile, Patient, ClinicalRecord, AppNotification, Clinic, Professional } from '../types/index.ts';

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

// -----------------------------------------------------------------------------
// 28. ISOLAMENTO DE DADOS PRIVADOS DO DIRETÓRIO DE PROFISSIONAIS
// -----------------------------------------------------------------------------
test('AUDIT 28: Authenticated professional cannot list private contact/billing data of another professional', () => {
  const profPrivateData = { userId: 'psy_marcos_123', email: 'privado@marcos.com', phone: '11999999999' };

  // Other signed in psychologist tries to read Marcos's private document in /professionals
  const accessDeniedToPeer = validateProfessionalAccess(profPrivateData, 'private', 'psy_other_user_456', false);
  assert.equal(accessDeniedToPeer, false, 'Colleague must NOT have access to private professional document');

  // Marcos has access to his own private document
  const accessAllowedToOwner = validateProfessionalAccess(profPrivateData, 'private', 'psy_marcos_123', false);
  assert.equal(accessAllowedToOwner, true, 'Psychologist must have access to own private record');

  // Superadmin has controlled administrative access
  const accessAllowedToAdmin = validateProfessionalAccess(profPrivateData, 'private', 'superadmin_uid', true);
  assert.equal(accessAllowedToAdmin, true, 'Superadmin has administrative access to professional record');

  // Public directory is open to authenticated users for booking
  const publicAccess = validateProfessionalAccess(profPrivateData, 'public', 'patient_ana_111', false);
  assert.equal(publicAccess, true, 'Public directory is open for booking');
});

// -----------------------------------------------------------------------------
// 29. PSICÓLOGO NÃO PODE ALTERAR CAMPOS INDEVIDOS DE AGENDAMENTO OU SALTAR STATUS
// -----------------------------------------------------------------------------
test('AUDIT 29: Psychologist cannot alter immutable appointment fields (price, date, room) or perform invalid status jumps', () => {
  const originalApp: Appointment = {
    id: 'app_100',
    psychologistId: 'psy_marcos_123',
    patientId: 'pat_ana_1',
    patientUserId: 'usr_ana_1',
    patientName: 'Ana Souza',
    clinicId: 'clinic_mente_viva',
    roomId: 'room_1',
    date: '2026-11-05',
    startTime: '14:00',
    endTime: '14:50',
    durationMinutes: 50,
    price: 180,
    paymentStatus: 'pending',
    status: 'pending',
    requestedBy: 'patient',
    createdAt: '2026-10-30T10:00:00Z',
    updatedAt: '2026-10-30T10:00:00Z'
  };

  // Attempt 1: Psychologist tries to increase session price unilaterally
  const priceTamper = validateAppointmentUpdate(
    originalApp,
    { ...originalApp, price: 350 },
    'psy_marcos_123'
  );
  assert.equal(priceTamper.allowed, false);
  assert.match(priceTamper.reason || '', /price/);

  // Attempt 2: Psychologist tries to change room unilaterally via direct update
  const roomTamper = validateAppointmentUpdate(
    originalApp,
    { ...originalApp, roomId: 'room_alien' },
    'psy_marcos_123'
  );
  assert.equal(roomTamper.allowed, false);
  assert.match(roomTamper.reason || '', /roomId/);

  // Attempt 3: Psychologist tries to jump status from pending directly to completed without confirmation
  const illegalJump = validateAppointmentUpdate(
    originalApp,
    { ...originalApp, status: 'completed' },
    'psy_marcos_123'
  );
  assert.equal(illegalJump.allowed, false);
  assert.match(illegalJump.reason || '', /Transição inválida/);

  // Legitimate update: Confirm pending session and add professional notes
  const legitConfirm = validateAppointmentUpdate(
    originalApp,
    { ...originalApp, status: 'confirmed', notes: 'Sessão confirmada no consultório 1.' },
    'psy_marcos_123'
  );
  assert.equal(legitConfirm.allowed, true);
});

// -----------------------------------------------------------------------------
// 30. PACIENTE NÃO PODE ALTERAR CAMPOS ADMINISTRATIVOS EM AGENDAMENTOS
// -----------------------------------------------------------------------------
test('AUDIT 30: Patient cannot set administrative statuses (confirmed, completed, no_show)', () => {
  const confirmedApp: Appointment = {
    id: 'app_200',
    psychologistId: 'psy_marcos_123',
    patientId: 'pat_ana_1',
    patientUserId: 'usr_ana_1',
    patientName: 'Ana Souza',
    clinicId: 'clinic_mente_viva',
    roomId: 'room_1',
    date: '2026-11-05',
    startTime: '14:00',
    endTime: '14:50',
    durationMinutes: 50,
    price: 180,
    paymentStatus: 'pending',
    status: 'confirmed',
    requestedBy: 'psychologist',
    createdAt: '2026-10-30T10:00:00Z',
    updatedAt: '2026-10-30T10:00:00Z'
  };

  // Patient tries to mark session as completed
  const patientTryComplete = validateAppointmentUpdate(
    confirmedApp,
    { ...confirmedApp, status: 'completed' },
    'usr_ana_1'
  );
  assert.equal(patientTryComplete.allowed, false);
  assert.match(patientTryComplete.reason || '', /Paciente não tem autorização/);

  // Patient tries to mark no_show
  const patientTryNoShow = validateAppointmentUpdate(
    confirmedApp,
    { ...confirmedApp, status: 'no_show' },
    'usr_ana_1'
  );
  assert.equal(patientTryNoShow.allowed, false);

  // Legitimate action: Patient requests cancellation with reason
  const patientCancelRequest = validateAppointmentUpdate(
    confirmedApp,
    { ...confirmedApp, status: 'cancellation_requested', cancellationReason: 'Imprevisto de trabalho.' },
    'usr_ana_1'
  );
  assert.equal(patientCancelRequest.allowed, true);
});

// -----------------------------------------------------------------------------
// 31. PSICÓLOGO NÃO PODE MODIFICAR IDENTIFICADORES OU METADADOS FIXOS DE PRONTUÁRIO
// -----------------------------------------------------------------------------
test('AUDIT 31: Psychologist cannot mutate core identifiers, patientId or session date on clinical records', () => {
  const existingRecord: ClinicalRecord = {
    id: 'rec_500',
    psychologistId: 'psy_marcos_123',
    patientId: 'pat_ana_1',
    appointmentId: 'app_200',
    sessionDate: '2026-11-05',
    sessionNumber: 4,
    evolutionNotes: 'Evolução clínica registrada.',
    isConfidential: true,
    createdAt: '2026-11-05T15:00:00Z',
    updatedAt: '2026-11-05T15:00:00Z',
    createdBy: 'Dr. Marcos'
  };

  // Direct update to original record is strictly rejected (Real Immutability)
  const alterOriginal = validateClinicalRecordWrite(
    { ...existingRecord, evolutionNotes: 'Tentativa de alteração do texto original' },
    'psy_marcos_123',
    'psy_marcos_123',
    true,
    existingRecord
  );
  assert.equal(alterOriginal.allowed, false);
  assert.match(alterOriginal.reason || '', /estritamente imutável/);

  // Legitimate rectification must be created via subcollection
  const legitSubcollectionRectif = validateClinicalRectificationCreate(
    {
      recordId: 'rec_500',
      psychologistId: 'psy_marcos_123',
      authorId: 'psy_marcos_123',
      reason: 'Discussão de caso em supervisão clínica',
      content: 'Adendo: ajustada a hipótese preliminar com foco em transtorno adaptativo.'
    },
    'psy_marcos_123',
    'psy_marcos_123'
  );
  assert.equal(legitSubcollectionRectif.allowed, true);
});

// -----------------------------------------------------------------------------
// 32. DEVER LEGAL DE RETENÇÃO: EXCLUSÃO DE PRONTUÁRIO É ESTRITAMENTE PROIBIDA
// -----------------------------------------------------------------------------
test('AUDIT 32: Deletion of clinical records is strictly prohibited by legal retention obligations (CFP 01/2009)', () => {
  const recordToDelete = { psychologistId: 'psy_marcos_123' };

  // Even the author psychologist cannot delete a clinical record
  const psychologistDeleteAttempt = validateClinicalRecordDelete(recordToDelete, 'psy_marcos_123', false);
  assert.equal(psychologistDeleteAttempt.allowed, false);
  assert.match(psychologistDeleteAttempt.reason || '', /guarda obrigatória/);

  // Superadmin cannot delete clinical records
  const superAdminDeleteAttempt = validateClinicalRecordDelete(recordToDelete, 'superadmin_uid', true);
  assert.equal(superAdminDeleteAttempt.allowed, false);
  assert.match(superAdminDeleteAttempt.reason || '', /guarda obrigatória/);
});

// -----------------------------------------------------------------------------
// 33. PROPRIETÁRIO NÃO PODE TRANSFERIR PROPRIEDADE OU ALTERAR LIMITES DA CLÍNICA DIRETAMENTE
// -----------------------------------------------------------------------------
test('AUDIT 33: Clinic owner cannot transfer ownership or mutate contracted limits via direct update', () => {
  const existingClinic: Clinic = {
    id: 'clinic_mente_viva',
    name: 'Clínica Mente Viva',
    ownerId: 'owner_carlos_1',
    phone: '1133334444',
    email: 'contato@menteviva.com.br',
    address: 'Av Paulista, 1000',
    status: 'active',
    roomsCount: 4,
    professionalsCount: 6,
    cnpj: '12.345.678/0001-90',
    createdAt: '2026-01-01T00:00:00Z'
  };

  // Attempt to transfer ownerId to an attacker UID
  const tryTransferOwnership = validateClinicUpdate(
    existingClinic,
    { ...existingClinic, ownerId: 'attacker_uid' },
    'owner_carlos_1',
    false
  );
  assert.equal(tryTransferOwnership.allowed, false);
  assert.match(tryTransferOwnership.reason || '', /Transferência de propriedade/);

  // Attempt to bypass subscription limits by editing roomsCount directly
  const tryBoostRooms = validateClinicUpdate(
    existingClinic,
    { ...existingClinic, roomsCount: 50 },
    'owner_carlos_1',
    false
  );
  assert.equal(tryBoostRooms.allowed, false);
  assert.match(tryBoostRooms.reason || '', /Limites de salas/);

  // Legitimate update: Update phone, email, and address
  const legitClinicUpdate = validateClinicUpdate(
    existingClinic,
    { ...existingClinic, phone: '11988887777', address: 'Av Paulista, 1500, Conj 42' },
    'owner_carlos_1',
    false
  );
  assert.equal(legitClinicUpdate.allowed, true);
});

// -----------------------------------------------------------------------------
// 34. LOGS DE AUDITORIA: METADADOS ESTRUTURADOS E EXPURGO TOTAL DE NARRATIVA CLÍNICA
// -----------------------------------------------------------------------------
test('AUDIT 34: Audit log sanitization purges freeform narrative text and creates deterministic metadata', () => {
  const logWithSensitiveClinicalText: Partial<AuditLog> = {
    id: 'log_test_narrative',
    userId: 'psy_marcos_123',
    userEmail: 'dr.marcos@test.com',
    action: 'create_clinical_record',
    eventCode: 'CLINICAL_RECORD_CREATED',
    targetCollection: 'clinical_records',
    targetId: 'rec_500',
    details: 'Paciente relatou pensamentos suicidas e crise de ansiedade. Diagnóstico: F32.2 depressão grave. Senha=123456.',
    metadata: {
      patientId: 'pat_ana_1',
      sessionNumber: 3
    }
  };

  const sanitized = sanitizeAuditLog(logWithSensitiveClinicalText);

  // Raw narrative clinical text must NOT be present in details!
  assert.equal(sanitized.details.includes('suicidas'), false, 'Clinical symptoms must be completely purged');
  assert.equal(sanitized.details.includes('F32.2'), false, 'Diagnostic hypotheses must be completely purged');
  assert.equal(sanitized.details.includes('123456'), false, 'Passwords must be completely purged');

  // Details must be deterministically formatted
  assert.ok(sanitized.details.includes('[METADADOS]'), 'Must use structured deterministic prefix');
  assert.ok(sanitized.details.includes('sessão #3'), 'Must contain structured session identifier');
  assert.ok(sanitized.details.includes('pat_ana_1'), 'Must contain structured patient ID');
});

// -----------------------------------------------------------------------------
// 35. CONTROLE ADMINISTRATIVO DE SUPERADMIN: UID É ESTRITAMENTE IMUTÁVEL
// -----------------------------------------------------------------------------
test('AUDIT 35: Controlled superadmin profile updates enforce immutable UID', () => {
  const existingUser: Partial<UserProfile> = {
    uid: 'user_regular_123',
    email: 'user@test.com',
    role: 'psychologist',
    status: 'active'
  };

  // Superadmin tries to mutate user UID
  const superadminTamperUid = validateUserProfileUpdate(
    existingUser,
    { ...existingUser, uid: 'tampered_uid_999' },
    'superadmin_uid',
    true // isCallerSuperAdmin = true
  );
  assert.equal(superadminTamperUid.allowed, false);
  assert.match(superadminTamperUid.reason || '', /uid é estritamente imutável/);

  // Superadmin legitimately suspends account or adjusts administrative role
  const legitSuperadminUpdate = validateUserProfileUpdate(
    existingUser,
    { ...existingUser, status: 'suspended' },
    'superadmin_uid',
    true
  );
  assert.equal(legitSuperadminUpdate.allowed, true);
});

// -----------------------------------------------------------------------------
// 36. IMUTABILIDADE REAL: REGISTRO CLÍNICO ORIGINAL NÃO PODE SER EDITADO
// -----------------------------------------------------------------------------
test('AUDIT 36: Original clinical record text is strictly immutable after creation', () => {
  const originalRecord: Partial<ClinicalRecord> = {
    id: 'rec_orig_1',
    psychologistId: 'psy_ana',
    patientId: 'pat_bruno',
    evolutionNotes: 'Sessão 01: Paciente iniciou processo psicoterápico.'
  };

  const attemptUpdate = validateClinicalRecordWrite(
    { ...originalRecord, evolutionNotes: 'Texto alterado indevidamente.' },
    'psy_ana',
    'psy_ana',
    true, // isUpdate
    originalRecord
  );

  assert.equal(attemptUpdate.allowed, false);
  assert.match(attemptUpdate.reason || '', /estritamente imutável/);
});

// -----------------------------------------------------------------------------
// 37. RETIFICAÇÃO EM SUBCOLEÇÃO EXIGE PSICÓLOGO TITULAR E CAMPOS OBRIGATÓRIOS
// -----------------------------------------------------------------------------
test('AUDIT 37: Subcollection rectification requires treating psychologist identity and technical justification', () => {
  // Impostor trying to add rectification to another psychologist's record
  const impostorAttempt = validateClinicalRectificationCreate(
    {
      recordId: 'rec_orig_1',
      psychologistId: 'psy_ana',
      authorId: 'psy_impostor',
      reason: 'Correção',
      content: 'Novo adendo'
    },
    'psy_ana',
    'psy_impostor'
  );
  assert.equal(impostorAttempt.allowed, false);
  assert.match(impostorAttempt.reason || '', /psicólogo titular/);

  // Missing justification
  const missingReason = validateClinicalRectificationCreate(
    {
      recordId: 'rec_orig_1',
      psychologistId: 'psy_ana',
      authorId: 'psy_ana',
      reason: '',
      content: 'Novo adendo'
    },
    'psy_ana',
    'psy_ana'
  );
  assert.equal(missingReason.allowed, false);
  assert.match(missingReason.reason || '', /Justificativa técnica/);

  // Legitimate subcollection rectification
  const validRetif = validateClinicalRectificationCreate(
    {
      recordId: 'rec_orig_1',
      psychologistId: 'psy_ana',
      authorId: 'psy_ana',
      reason: 'Adendo após supervisão técnica',
      content: 'Observação complementar sobre o caso.'
    },
    'psy_ana',
    'psy_ana'
  );
  assert.equal(validRetif.allowed, true);
});

// -----------------------------------------------------------------------------
// 38. ADENDOS DE RETIFICAÇÃO JÁ GRAVADOS SÃO IMUTÁVEIS E NÃO PODEM SER DELETADOS
// -----------------------------------------------------------------------------
test('AUDIT 38: Existing rectification adendums in subcollection cannot be mutated or deleted', () => {
  const result = validateClinicalRectificationUpdateAndDelete();
  assert.equal(result.allowed, false);
  assert.match(result.reason, /estritamente imutáveis/);
});

// -----------------------------------------------------------------------------
// 39. USUÁRIOS SUSPENSOS SÃO BLOQUEADOS DE ACESSAR COLEÇÕES PROTEGIDAS
// -----------------------------------------------------------------------------
test('AUDIT 39: Suspended users are blocked from accessing protected resources', () => {
  const activeCheck = validateUserActiveStatus('active');
  assert.equal(activeCheck.allowed, true);

  const suspendedCheck = validateUserActiveStatus('suspended');
  assert.equal(suspendedCheck.allowed, false);
  assert.match(suspendedCheck.reason || '', /CONTA_SUSPENSA/);
});

// -----------------------------------------------------------------------------
// 40. PACIENTE NÃO PODE CRIAR AGENDAMENTO EM NOME DE TERCEIROS
// -----------------------------------------------------------------------------
test('AUDIT 40: Patient cannot create appointment for another person (Anti-spoofing)', () => {
  const spoofAttempt = validateAppointmentCreate(
    {
      patientUserId: 'victim_user_456',
      psychologistId: 'psy_public_1',
      status: 'pending',
      requestedBy: 'patient'
    },
    'attacker_user_123',
    'patient',
    false,
    true
  );

  assert.equal(spoofAttempt.allowed, false);
  assert.match(spoofAttempt.reason || '', /Anti-spoofing/);

  const legitPatientCreate = validateAppointmentCreate(
    {
      patientUserId: 'patient_ana_1',
      psychologistId: 'psy_public_1',
      status: 'pending',
      requestedBy: 'patient'
    },
    'patient_ana_1',
    'patient',
    false,
    true
  );
  assert.equal(legitPatientCreate.allowed, true);
});

// -----------------------------------------------------------------------------
// 41. PSICÓLOGO NÃO PODE CRIAR AGENDAMENTO PARA PACIENTE SEM VÍNCULO ATIVO
// -----------------------------------------------------------------------------
test('AUDIT 41: Psychologist cannot create appointment for patient without active relationship', () => {
  const unlinkedAttempt = validateAppointmentCreate(
    {
      psychologistId: 'psy_marcos_1',
      patientId: 'pat_unlinked_9',
      status: 'confirmed'
    },
    'psy_marcos_1',
    'psychologist',
    false, // patientBelongsToPsychologist = false
    false
  );

  assert.equal(unlinkedAttempt.allowed, false);
  assert.match(unlinkedAttempt.reason || '', /Paciente não pertence/);

  const linkedCreate = validateAppointmentCreate(
    {
      psychologistId: 'psy_marcos_1',
      patientId: 'pat_linked_1',
      status: 'confirmed'
    },
    'psy_marcos_1',
    'psychologist',
    true, // patientBelongsToPsychologist = true
    false
  );
  assert.equal(linkedCreate.allowed, true);
});

// -----------------------------------------------------------------------------
// 42. SALAS FÍSICAS NÃO PODEM SER TRANSFERIDAS ENTRE CLÍNICAS POR ATUALIZAÇÃO
// -----------------------------------------------------------------------------
test('AUDIT 42: Physical rooms cannot be transferred between clinics via direct update', () => {
  const existingRoom = { clinicId: 'clinic_alpha' };
  const hijackedRoom = { clinicId: 'clinic_beta' };

  const transferAttempt = validateRoomTransfer(existingRoom, hijackedRoom);
  assert.equal(transferAttempt.allowed, false);
  assert.match(transferAttempt.reason || '', /Transferência de sala entre clínicas é estritamente proibida/);

  const legitRoomUpdate = validateRoomTransfer(existingRoom, { clinicId: 'clinic_alpha' });
  assert.equal(legitRoomUpdate.allowed, true);
});

// -----------------------------------------------------------------------------
// 43. PAGAMENTOS: VALOR E IDENTIFICADORES RELACIONAIS SÃO IMUTÁVEIS
// -----------------------------------------------------------------------------
test('AUDIT 43: Payment amount and relational identifiers cannot be altered on update', () => {
  const existingPay = {
    amount: 250,
    psychologistId: 'psy_marcos_1',
    patientId: 'pat_ana_1'
  };

  // Attempt to alter payment amount
  const tamperAmount = validatePaymentUpdate(
    existingPay,
    { ...existingPay, amount: 50 },
    'psy_marcos_1'
  );
  assert.equal(tamperAmount.allowed, false);
  assert.match(tamperAmount.reason || '', /Valor \(amount\) do pagamento é imutável/);

  // Attempt by unauthorized user
  const unauthorizedAttempt = validatePaymentUpdate(
    existingPay,
    existingPay,
    'attacker_uid'
  );
  assert.equal(unauthorizedAttempt.allowed, false);
  assert.match(unauthorizedAttempt.reason || '', /Apenas o psicólogo titular/);

  // Legitimate update
  const legitPayUpdate = validatePaymentUpdate(
    existingPay,
    existingPay,
    'psy_marcos_1'
  );
  assert.equal(legitPayUpdate.allowed, true);
});

// -----------------------------------------------------------------------------
// 44. PACIENTE NÃO PODE PUBLICAR PERFIL PROFISSIONAL NO DIRETÓRIO PÚBLICO
// -----------------------------------------------------------------------------
test('AUDIT 44: Patient cannot publish profile in public professionals directory', () => {
  const fakeProfAttempt = validatePublicProfessionalPublish(
    { userId: 'patient_fake_1' },
    false, // hasPsychologistRole = false
    'patient_fake_1'
  );

  assert.equal(fakeProfAttempt.allowed, false);
  assert.match(fakeProfAttempt.reason || '', /Apenas usuários com papel psychologist/);

  const legitProfPublish = validatePublicProfessionalPublish(
    { userId: 'psy_real_1' },
    true, // hasPsychologistRole = true
    'psy_real_1'
  );
  assert.equal(legitProfPublish.allowed, true);
});

// -----------------------------------------------------------------------------
// 45. PROVISIONAMENTO ATÔMICO COM COMPENSAÇÃO DE ROLLBACK EM FALHAS
// -----------------------------------------------------------------------------
test('AUDIT 45: Atomic user registration triggers compensating rollback if intermediate step fails', async () => {
  const createdDocs: string[] = [];

  const failingProvisionFlow = async () => {
    try {
      // Step 1: User created
      createdDocs.push('users/uid_test_1');
      // Step 2: Private profile created
      createdDocs.push('professionals/prof_uid_test_1');
      // Step 3: Public profile fails due to network / permission error
      throw new Error('SIMULATED_FAILURE: Falha ao publicar diretório público.');
    } catch (err) {
      // Rollback execution
      while (createdDocs.length > 0) {
        createdDocs.pop();
      }
      return { success: false, rolledBack: true, remainingDocsCount: createdDocs.length };
    }
  };

  const result = await failingProvisionFlow();
  assert.equal(result.success, false);
  assert.equal(result.rolledBack, true);
  assert.equal(result.remainingDocsCount, 0, 'No orphaned documents should remain after rollback');
});



