import test from 'node:test';
import assert from 'node:assert/strict';
import {
  timeToMinutes,
  minutesToTime,
  intervalsOverlap,
  checkSlotConflict,
  isValidAppointmentTransition,
  canAccessClinicalRecord,
  calculateFinancialSummary,
  computeOpenTimeSlots
} from './rules.ts';
import { Appointment, PaymentRecord, ExpenseRecord } from '../types/index.ts';

test('timeToMinutes and minutesToTime conversions', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('08:30'), 510);
  assert.equal(timeToMinutes('14:45'), 885);
  assert.equal(minutesToTime(510), '08:30');
  assert.equal(minutesToTime(885), '14:45');
});

test('intervalsOverlap with buffer', () => {
  // Session A: 09:00 - 09:50 (540 - 590), buffer 10 min
  // Session B starting at 09:55 overlaps because 540 < 645 and 590 + 10 > 595
  assert.equal(intervalsOverlap(540, 590, 595, 645, 10), true);
  // Session C starting at 10:00 (600) does NOT overlap with buffer 10 min (590+10 = 600)
  assert.equal(intervalsOverlap(540, 590, 600, 650, 0), false);
});

test('checkSlotConflict detects conflicting appointments for the same psychologist', () => {
  const existing: Appointment[] = [
    {
      id: 'app-1',
      psychologistId: 'psy-1',
      patientId: 'pat-1',
      patientName: 'João Silva',
      date: '2026-11-05',
      startTime: '10:00',
      endTime: '10:50',
      durationMinutes: 50,
      status: 'confirmed',
      price: 180,
      paymentStatus: 'pending',
      requestedBy: 'patient',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Overlapping time
  const conflict = checkSlotConflict(existing, {
    psychologistId: 'psy-1',
    date: '2026-11-05',
    startTime: '10:30',
    endTime: '11:20'
  }, 0);
  assert.equal(conflict.hasConflict, true);

  // Non-overlapping time
  const noConflict = checkSlotConflict(existing, {
    psychologistId: 'psy-1',
    date: '2026-11-05',
    startTime: '11:00',
    endTime: '11:50'
  }, 0);
  assert.equal(noConflict.hasConflict, false);

  // Different date: no conflict
  const diffDate = checkSlotConflict(existing, {
    psychologistId: 'psy-1',
    date: '2026-11-06',
    startTime: '10:00',
    endTime: '10:50'
  }, 0);
  assert.equal(diffDate.hasConflict, false);
});

test('isValidAppointmentTransition validates appointment lifecycle transitions', () => {
  // Pending can become confirmed or rejected or cancelled
  assert.equal(isValidAppointmentTransition('pending', 'confirmed'), true);
  assert.equal(isValidAppointmentTransition('pending', 'rejected'), true);
  assert.equal(isValidAppointmentTransition('pending', 'completed'), false); // cannot jump directly to completed

  // Confirmed can be completed, no_show, cancellation_requested, cancelled
  assert.equal(isValidAppointmentTransition('confirmed', 'completed'), true);
  assert.equal(isValidAppointmentTransition('confirmed', 'no_show'), true);
  assert.equal(isValidAppointmentTransition('confirmed', 'cancellation_requested'), true);
  assert.equal(isValidAppointmentTransition('confirmed', 'pending'), false);

  // Terminal states cannot be changed
  assert.equal(isValidAppointmentTransition('completed', 'confirmed'), false);
  assert.equal(isValidAppointmentTransition('cancelled', 'confirmed'), false);
});

test('canAccessClinicalRecord strictly enforces CFP and LGPD privacy', () => {
  const record = { psychologistId: 'dr-marcos' };

  // Authorized psychologist can view
  assert.equal(canAccessClinicalRecord({ uid: 'dr-marcos', role: 'psychologist' }, record), true);

  // Other psychologist cannot view
  assert.equal(canAccessClinicalRecord({ uid: 'dra-julia', role: 'psychologist' }, record), false);

  // Clinic manager cannot view clinical records! (explicit requirement)
  assert.equal(canAccessClinicalRecord({ uid: 'gestor-carlos', role: 'clinic_manager' }, record), false);

  // Patient cannot view internal clinical records!
  assert.equal(canAccessClinicalRecord({ uid: 'paciente-ana', role: 'patient' }, record), false);

  // SuperAdmin has system audit access
  assert.equal(canAccessClinicalRecord({ uid: 'admin-1', role: 'superadmin' }, record), true);
});

test('calculateFinancialSummary calculates correct totals and balance', () => {
  const payments: PaymentRecord[] = [
    { id: '1', psychologistId: 'psy1', patientId: 'p1', patientName: 'Ana', amount: 200, method: 'pix', status: 'paid', dueDate: '2026-10-01', description: 'Sessão 1', createdAt: '' },
    { id: '2', psychologistId: 'psy1', patientId: 'p2', patientName: 'Bruno', amount: 180, method: 'cash', status: 'paid', dueDate: '2026-10-02', description: 'Sessão 2', createdAt: '' },
    { id: '3', psychologistId: 'psy1', patientId: 'p3', patientName: 'Carla', amount: 220, method: 'card', status: 'pending', dueDate: '2026-10-15', description: 'Sessão 3', createdAt: '' },
    { id: '4', psychologistId: 'psy1', patientId: 'p4', patientName: 'Diego', amount: 180, method: 'pix', status: 'overdue', dueDate: '2026-09-15', description: 'Sessão 4', createdAt: '' },
  ];

  const expenses: ExpenseRecord[] = [
    { id: 'e1', psychologistId: 'psy1', title: 'Aluguel Consultório', category: 'rent', amount: 150, date: '2026-10-05', status: 'paid' },
    { id: 'e2', psychologistId: 'psy1', title: 'Assinatura Software', category: 'software', amount: 80, date: '2026-10-10', status: 'pending' },
  ];

  const summary = calculateFinancialSummary(payments, expenses);
  assert.equal(summary.totalReceived, 380); // 200 + 180
  assert.equal(summary.totalPending, 220);  // 220
  assert.equal(summary.totalOverdue, 180);  // 180
  assert.equal(summary.totalExpenses, 150); // paid expenses
  assert.equal(summary.netBalance, 230);    // 380 - 150
});

test('computeOpenTimeSlots calculates intervals excluding booked appointments', () => {
  const workIntervals = [{ start: '08:00', end: '11:00' }]; // 3 hours = 180 min
  const slotDuration = 50;
  const buffer = 10;
  // Slots without bookings:
  // 08:00 - 08:50 (buffer to 09:00)
  // 09:00 - 09:50 (buffer to 10:00)
  // 10:00 - 10:50 (ends before 11:00)
  // Total 3 slots

  // If 09:00 - 09:50 is booked:
  const booked = [{ start: '09:00', end: '09:50' }];
  const slots = computeOpenTimeSlots(workIntervals, slotDuration, buffer, booked);

  assert.equal(slots.length, 2);
  assert.equal(slots[0].startTime, '08:00');
  assert.equal(slots[0].endTime, '08:50');
  assert.equal(slots[1].startTime, '10:00');
  assert.equal(slots[1].endTime, '10:50');
});
