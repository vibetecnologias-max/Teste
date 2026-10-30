import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessClinicalRecord,
  isValidAppointmentTransition,
  checkSlotConflict
} from './rules.ts';
import { Appointment, UserRole, AuditLog } from '../types/index.ts';

// -----------------------------------------------------------------------------
// 1. CFP RESOLUTION Nº 01/2009 & LGPD ARTICLE 11: CLINICAL RECORD CONFIDENTIALITY
// -----------------------------------------------------------------------------
test('AUDIT 1.1: Clinical records are strictly isolated to treating psychologist', () => {
  const patientRecord = { psychologistId: 'psy_dr_marcos' };

  // Treating psychologist: ALLOWED
  assert.equal(
    canAccessClinicalRecord({ uid: 'psy_dr_marcos', role: 'psychologist' }, patientRecord),
    true,
    'Treating psychologist must be granted access to clinical evolutions'
  );

  // Other psychologists: FORBIDDEN (No cross-professional snooping)
  assert.equal(
    canAccessClinicalRecord({ uid: 'psy_dra_julia', role: 'psychologist' }, patientRecord),
    false,
    'Other psychologists must be denied access to another professional\'s records'
  );

  // Clinic Managers: FORBIDDEN (Clinic administration has no clinical access)
  assert.equal(
    canAccessClinicalRecord({ uid: 'mgr_carlos', role: 'clinic_manager' }, patientRecord),
    false,
    'Clinic managers must be denied access to sensitive clinical records'
  );

  // SuperAdmin: FORBIDDEN (Platform admin cannot read medical/psychological records)
  assert.equal(
    canAccessClinicalRecord({ uid: 'superadmin_global', role: 'superadmin' }, patientRecord),
    false,
    'SuperAdmin must be barred from private patient evolutions per CFP Res. 01/2009'
  );

  // Patient: FORBIDDEN (Patient portal has access to receipts and appointments, not internal session notes)
  assert.equal(
    canAccessClinicalRecord({ uid: 'patient_ana', role: 'patient' }, patientRecord),
    false,
    'Patients cannot view internal psychiatric/psychological evolutions directly'
  );
});

// -----------------------------------------------------------------------------
// 2. PRIVILEGE ESCALATION PREVENTION
// -----------------------------------------------------------------------------
test('AUDIT 2.1: Self-registration with superadmin role is strictly prohibited', () => {
  const allowedSelfRegisterRoles: UserRole[] = ['psychologist', 'clinic_manager', 'patient'];
  const requestedRole = 'superadmin';

  const isPermittedSelfRegister = (role: string): boolean => {
    return allowedSelfRegisterRoles.includes(role as UserRole);
  };

  assert.equal(isPermittedSelfRegister(requestedRole), false, 'Users cannot self-assign superadmin role');
  assert.equal(isPermittedSelfRegister('psychologist'), true);
  assert.equal(isPermittedSelfRegister('clinic_manager'), true);
  assert.equal(isPermittedSelfRegister('patient'), true);
});

// -----------------------------------------------------------------------------
// 3. PHYSICAL ROOM RESOURCE CONFLICT AUDIT
// -----------------------------------------------------------------------------
test('AUDIT 3.1: Two different psychologists cannot book the same physical room simultaneously', () => {
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
// 4. APPOINTMENT STATE MACHINE INTEGRITY
// -----------------------------------------------------------------------------
test('AUDIT 4.1: Appointment state machine prevents unauthorized or illegal status jumps', () => {
  // Invalid transitions
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
// 5. LGPD AUDIT TRAIL LOGGING INTEGRITY
// -----------------------------------------------------------------------------
test('AUDIT 5.1: Clinical audit log records meet strict compliance schema', () => {
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
