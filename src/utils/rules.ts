import { Appointment, AppointmentStatus, PaymentRecord, ExpenseRecord, UserRole } from '../types';

/**
 * Converts a time string "HH:mm" to total minutes from midnight.
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

/**
 * Converts total minutes from midnight to "HH:mm" string.
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Checks if two time intervals overlap (including a buffer window between sessions).
 */
export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
  bufferMinutes: number = 0
): boolean {
  // If session A plus buffer extends into session B, or B into A
  return startA < endB + bufferMinutes && endA + bufferMinutes > startB;
}

/**
 * Validates whether a proposed appointment conflicts with any existing active appointments.
 * Ignores cancelled or rejected appointments.
 */
export function checkSlotConflict(
  existingAppointments: Appointment[],
  proposed: {
    id?: string;
    psychologistId: string;
    date: string;
    startTime: string;
    endTime: string;
    roomId?: string;
  },
  bufferMinutes: number = 10
): { hasConflict: boolean; reason?: string } {
  const proposedStart = timeToMinutes(proposed.startTime);
  const proposedEnd = timeToMinutes(proposed.endTime);

  if (proposedStart >= proposedEnd) {
    return { hasConflict: true, reason: 'O horário inicial deve ser anterior ao horário final.' };
  }

  for (const app of existingAppointments) {
    if (app.id === proposed.id) continue;
    if (app.date !== proposed.date) continue;
    if (app.status === 'cancelled' || app.status === 'rejected') continue;

    const existingStart = timeToMinutes(app.startTime);
    const existingEnd = timeToMinutes(app.endTime);

    // Check professional schedule conflict
    if (app.psychologistId === proposed.psychologistId) {
      if (intervalsOverlap(proposedStart, proposedEnd, existingStart, existingEnd, bufferMinutes)) {
        return {
          hasConflict: true,
          reason: `Conflito de agenda: o psicólogo já possui atendimento das ${app.startTime} às ${app.endTime} neste dia.`
        };
      }
    }

    // Check clinic room conflict if room specified
    if (proposed.roomId && app.roomId && proposed.roomId === app.roomId) {
      if (intervalsOverlap(proposedStart, proposedEnd, existingStart, existingEnd, 0)) {
        return {
          hasConflict: true,
          reason: `Conflito de sala: o consultório já está reservado das ${app.startTime} às ${app.endTime}.`
        };
      }
    }
  }

  return { hasConflict: false };
}

/**
 * Appointment state machine transitions.
 */
export function isValidAppointmentTransition(
  currentStatus: AppointmentStatus,
  targetStatus: AppointmentStatus
): boolean {
  if (currentStatus === targetStatus) return true;

  switch (currentStatus) {
    case 'pending':
      return ['confirmed', 'rejected', 'cancelled'].includes(targetStatus);
    case 'confirmed':
      return ['completed', 'no_show', 'cancellation_requested', 'cancelled'].includes(targetStatus);
    case 'cancellation_requested':
      return ['cancelled', 'confirmed'].includes(targetStatus);
    case 'completed':
    case 'no_show':
    case 'rejected':
    case 'cancelled':
      // Terminal states cannot be changed
      return false;
    default:
      return false;
  }
}

/**
 * Evaluates whether a user role has ethical authorization to access clinical records.
 * STRICT: Only treating psychologist or superadmin audit can access.
 * Clinic managers and patients are strictly denied access to sensitive clinical evolution.
 */
export function canAccessClinicalRecord(
  requestUser: { uid: string; role: UserRole },
  record: { psychologistId: string }
): boolean {
  if (requestUser.role === 'superadmin') {
    return true;
  }
  if (requestUser.role === 'psychologist' && requestUser.uid === record.psychologistId) {
    return true;
  }
  return false;
}

/**
 * Financial metrics calculation for SaaS & Clinic dashboard.
 */
export function calculateFinancialSummary(
  payments: PaymentRecord[],
  expenses: ExpenseRecord[] = []
) {
  const totalReceived = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOverdue = payments
    .filter(p => p.status === 'overdue')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalExpenses = expenses
    .filter(e => e.status === 'paid')
    .reduce((sum, e) => sum + e.amount, 0);

  const pendingExpenses = expenses
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0);

  const netBalance = totalReceived - totalExpenses;

  return {
    totalReceived,
    totalPending,
    totalOverdue,
    totalExpenses,
    pendingExpenses,
    netBalance,
    totalRecords: payments.length
  };
}

/**
 * Generates available slots for a given day given work intervals, slot duration, and booked appointments.
 */
export function computeOpenTimeSlots(
  workIntervals: { start: string; end: string }[],
  slotDurationMinutes: number,
  bufferMinutes: number,
  bookedRanges: { start: string; end: string }[]
): { startTime: string; endTime: string }[] {
  const slots: { startTime: string; endTime: string }[] = [];

  for (const interval of workIntervals) {
    let currentStart = timeToMinutes(interval.start);
    const intervalEnd = timeToMinutes(interval.end);

    while (currentStart + slotDurationMinutes <= intervalEnd) {
      const slotEnd = currentStart + slotDurationMinutes;
      const startTimeStr = minutesToTime(currentStart);
      const endTimeStr = minutesToTime(slotEnd);

      // Check if slot overlaps with any booked range
      const overlaps = bookedRanges.some(booked => {
        const bStart = timeToMinutes(booked.start);
        const bEnd = timeToMinutes(booked.end);
        return currentStart < bEnd && slotEnd > bStart;
      });

      if (!overlaps) {
        slots.push({ startTime: startTimeStr, endTime: endTimeStr });
      }

      currentStart = slotEnd + bufferMinutes;
    }
  }

  return slots;
}
