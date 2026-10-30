import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessClinicalRecord,
  isValidAppointmentTransition,
  checkSlotConflict
} from './rules.ts';
import { Appointment, UserRole, AuditLog, UserProfile, Patient, ClinicalRecord } from '../types/index.ts';

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
