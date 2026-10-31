import {
  Appointment,
  AppointmentStatus,
  PaymentRecord,
  ExpenseRecord,
  UserRole,
  UserProfile,
  Clinic,
  ClinicalRecord,
  AuditLog,
  Professional
} from '../types';

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
 * STRICT (CFP nº 01/2009 & LGPD): Only the treating psychologist responsible for the care has access.
 * SuperAdmin, clinic managers, and patients are strictly denied access.
 */
export function canAccessClinicalRecord(
  user: { uid: string; role: UserRole },
  record: { psychologistId: string }
): boolean {
  if (!user || !user.uid) return false;
  // SuperAdmin, Clinic Manager, and Patient are STRICTLY DENIED access
  if (user.role === 'superadmin' || user.role === 'clinic_manager' || user.role === 'patient') {
    return false;
  }
  // Only the assigned psychologist who owns the patient relationship
  return user.role === 'psychologist' && user.uid === record.psychologistId;
}

/**
 * Aggregates financial totals for payments and expenses.
 */
export function calculateFinancialSummary(
  payments: PaymentRecord[],
  expenses: ExpenseRecord[]
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

/**
 * Validates Firestore rules for updating user profiles (/users/{userId}).
 * Regular users are strictly forbidden from modifying role, uid, status, clinicId, professionalId.
 * SuperAdmin cannot modify uid (immutable).
 */
export function validateUserProfileUpdate(
  existingUser: Partial<UserProfile>,
  incomingUser: Partial<UserProfile>,
  callerUid: string,
  isCallerSuperAdmin: boolean = false
): { allowed: boolean; reason?: string } {
  if (!callerUid) return { allowed: false, reason: 'Não autenticado.' };

  // uid is strictly immutable for all callers including superadmin
  if (existingUser.uid && incomingUser.uid && existingUser.uid !== incomingUser.uid) {
    return { allowed: false, reason: 'uid é estritamente imutável.' };
  }

  if (isCallerSuperAdmin) {
    const superAdminAllowedKeys = new Set([
      'role',
      'status',
      'clinicId',
      'professionalId',
      'displayName',
      'phone',
      'avatarUrl',
      'photoURL',
      'updatedAt'
    ]);
    for (const key of Object.keys(incomingUser)) {
      if ((existingUser as any)[key] !== (incomingUser as any)[key] && !superAdminAllowedKeys.has(key)) {
        return { allowed: false, reason: `SuperAdmin não pode modificar o campo ${key}.` };
      }
    }
    return { allowed: true };
  }

  if (existingUser.uid !== callerUid) {
    return { allowed: false, reason: 'Usuário não pode alterar perfis de terceiros.' };
  }

  const allowedKeys = new Set(['displayName', 'phone', 'avatarUrl', 'photoURL', 'updatedAt']);
  const allKeys = new Set([...Object.keys(existingUser), ...Object.keys(incomingUser)]);

  for (const key of allKeys) {
    const valExisting = (existingUser as any)[key];
    const valIncoming = (incomingUser as any)[key];

    if (valExisting !== valIncoming) {
      if (!allowedKeys.has(key)) {
        return {
          allowed: false,
          reason: `Alteração não autorizada no campo restrito: ${key}. Usuários comuns não podem alterar papéis ou vínculos administrativos.`
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Validates Firestore rules for updating appointments (/appointments/{appId}).
 * Core fields are immutable.
 * Role-based transition rules and field allowlists enforced.
 */
export function validateAppointmentUpdate(
  existing: Appointment,
  incoming: Appointment,
  callerUid: string
): { allowed: boolean; reason?: string } {
  if (!callerUid) return { allowed: false, reason: 'Não autenticado.' };

  // Core immutable fields
  if (existing.psychologistId !== incoming.psychologistId) {
    return { allowed: false, reason: 'psychologistId é imutável após criação.' };
  }
  if (existing.patientId !== incoming.patientId) {
    return { allowed: false, reason: 'patientId é imutável após criação.' };
  }
  if (existing.patientUserId !== incoming.patientUserId) {
    return { allowed: false, reason: 'patientUserId é imutável após criação.' };
  }
  if (existing.clinicId !== incoming.clinicId) {
    return { allowed: false, reason: 'clinicId é imutável após criação.' };
  }
  if (existing.roomId !== incoming.roomId) {
    return { allowed: false, reason: 'roomId é imutável após criação.' };
  }
  if (existing.requestedBy !== incoming.requestedBy) {
    return { allowed: false, reason: 'requestedBy é imutável após criação.' };
  }
  if (existing.price !== incoming.price) {
    return { allowed: false, reason: 'Valor financeiro (price) é imutável na atualização do agendamento.' };
  }
  if (existing.patientName !== incoming.patientName) {
    return { allowed: false, reason: 'patientName é imutável após criação.' };
  }
  if (existing.date !== incoming.date || existing.startTime !== incoming.startTime || existing.endTime !== incoming.endTime) {
    return { allowed: false, reason: 'Data e horários do agendamento são imutáveis na atualização direta.' };
  }
  if (existing.durationMinutes !== incoming.durationMinutes) {
    return { allowed: false, reason: 'durationMinutes é imutável após criação.' };
  }
  if (existing.createdAt !== incoming.createdAt) {
    return { allowed: false, reason: 'createdAt é imutável.' };
  }

  // Caller is treating psychologist
  if (callerUid === existing.psychologistId) {
    const allowedPsychologistFields = new Set([
      'status',
      'notes',
      'cancellationReason',
      'paymentStatus',
      'updatedAt'
    ]);

    for (const key of Object.keys(incoming) as (keyof Appointment)[]) {
      if (incoming[key] !== existing[key] && !allowedPsychologistFields.has(key)) {
        return { allowed: false, reason: `Psicólogo não tem autorização para modificar o campo ${key}.` };
      }
    }

    if (!isValidAppointmentTransition(existing.status, incoming.status)) {
      return { allowed: false, reason: `Transição inválida de status: de ${existing.status} para ${incoming.status}.` };
    }

    return { allowed: true };
  }

  // Caller is participating patient
  if (callerUid === existing.patientUserId) {
    const prohibitedStatuses = ['confirmed', 'completed', 'no_show', 'rejected'];
    if (prohibitedStatuses.includes(incoming.status) && incoming.status !== existing.status) {
      return { allowed: false, reason: 'Paciente não tem autorização para definir status administrativos.' };
    }

    const allowedPatientFields = new Set(['status', 'cancellationReason', 'notes', 'updatedAt']);
    for (const key of Object.keys(incoming) as (keyof Appointment)[]) {
      if (incoming[key] !== existing[key] && !allowedPatientFields.has(key)) {
        return { allowed: false, reason: `Paciente não pode alterar o campo ${key}.` };
      }
    }

    if (existing.status === 'pending' && incoming.status !== 'pending' && incoming.status !== 'cancelled') {
      return { allowed: false, reason: 'Paciente só pode cancelar solicitações pendentes.' };
    }

    if (existing.status === 'confirmed' && incoming.status !== 'confirmed' && !['cancellation_requested', 'cancelled'].includes(incoming.status)) {
      return { allowed: false, reason: 'Paciente só pode solicitar cancelamento ou cancelar sessões confirmadas.' };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: 'Usuário não tem autorização para modificar este agendamento.' };
}

/**
 * Validates notification create & update security rules.
 */
export function validateNotificationCreate(
  incoming: { recipientUserId: string; senderId?: string },
  callerUid: string
): { allowed: boolean; reason?: string } {
  if (!callerUid) return { allowed: false, reason: 'Não autenticado.' };
  if (!incoming.recipientUserId || incoming.recipientUserId.trim() === '') {
    return { allowed: false, reason: 'recipientUserId é obrigatório.' };
  }
  if (!incoming.senderId || incoming.senderId.trim() === '') {
    return { allowed: false, reason: 'senderId é obrigatório e não pode ser omitido conforme o padrão de integridade do Firestore.' };
  }
  if (incoming.senderId !== callerUid) {
    return { allowed: false, reason: 'Anti-spoofing: senderId deve coincidir exatamente com o usuário autenticado.' };
  }
  return { allowed: true };
}

export function validateNotificationUpdate(
  existing: { recipientUserId: string; read: boolean },
  incoming: { recipientUserId: string; read: boolean; [key: string]: any },
  callerUid: string
): { allowed: boolean; reason?: string } {
  if (!callerUid) return { allowed: false, reason: 'Não autenticado.' };
  if (existing.recipientUserId !== callerUid) {
    return { allowed: false, reason: 'Apenas o destinatário pode atualizar suas notificações.' };
  }
  if (incoming.recipientUserId !== existing.recipientUserId) {
    return { allowed: false, reason: 'recipientUserId é imutável.' };
  }
  for (const k of Object.keys(incoming)) {
    if (k !== 'read' && k !== 'updatedAt' && (incoming as any)[k] !== (existing as any)[k]) {
      return { allowed: false, reason: `Campo ${k} não pode ser alterado em notificações.` };
    }
  }
  return { allowed: true };
}

/**
 * Validates subscription isolation rules.
 */
export function validateSubscriptionAccess(
  sub: { targetId: string; userId?: string; clinicId?: string },
  callerUid: string,
  isSuperAdmin: boolean = false,
  clinicOwnerId?: string
): boolean {
  if (!callerUid) return false;
  if (isSuperAdmin) return true;
  if (sub.targetId === callerUid || sub.userId === callerUid) return true;
  if (clinicOwnerId && clinicOwnerId === callerUid) return true;
  return false;
}

/**
 * Validates clinical record creation and update.
 * Strictly verifies treating psychologist ownership, patient linkage and retention.
 */
export function validateClinicalRecordWrite(
  record: Partial<ClinicalRecord>,
  callerUid: string,
  patientOwnerPsychologistId: string,
  isUpdate: boolean,
  existingRecord?: Partial<ClinicalRecord>
): { allowed: boolean; reason?: string } {
  if (!callerUid) return { allowed: false, reason: 'Não autenticado.' };

  if (record.psychologistId !== callerUid) {
    return { allowed: false, reason: 'Apenas o psicólogo titular responsável pode registrar prontuários.' };
  }

  // Master Gate: patient must belong to this psychologist
  if (patientOwnerPsychologistId !== callerUid) {
    return { allowed: false, reason: 'Vínculo inválido: o paciente não pertence a este psicólogo.' };
  }

  if (isUpdate) {
    return {
      allowed: false,
      reason: 'O registro clínico original é estritamente imutável após a criação (CFP 01/2009). Retificações devem ser registradas na subcoleção /retifications.'
    };
  }

  return { allowed: true };
}

/**
 * Validates clinical record subcollection rectification creation.
 * Subcollection: /clinical_records/{recordId}/retifications/{retificationId}
 */
export function validateClinicalRectificationCreate(
  rectification: { recordId: string; psychologistId: string; authorId: string; reason: string; content: string },
  parentRecordPsychologistId: string,
  callerUid: string
): { allowed: boolean; reason?: string } {
  if (!callerUid) return { allowed: false, reason: 'Não autenticado.' };
  if (callerUid !== parentRecordPsychologistId) {
    return { allowed: false, reason: 'Apenas o psicólogo titular do prontuário pode adicionar retificações.' };
  }
  if (rectification.psychologistId !== callerUid || rectification.authorId !== callerUid) {
    return { allowed: false, reason: 'Anti-spoofing: authorId e psychologistId devem coincidir com o usuário autenticado.' };
  }
  if (!rectification.reason || rectification.reason.trim().length === 0) {
    return { allowed: false, reason: 'Justificativa técnica da retificação é obrigatória.' };
  }
  if (!rectification.content || rectification.content.trim().length === 0) {
    return { allowed: false, reason: 'Conteúdo do adendo de retificação é obrigatório.' };
  }
  return { allowed: true };
}

/**
 * Validates that rectification adendums are strictly immutable and cannot be updated or deleted.
 */
export function validateClinicalRectificationUpdateAndDelete(): { allowed: boolean; reason: string } {
  return {
    allowed: false,
    reason: 'Adendos de retificação são estritamente imutáveis e protegidos contra alteração ou exclusão.'
  };
}

/**
 * Validates clinical record deletion.
 * CFP nº 01/2009 Art. 12 mandates retention: clinical records cannot be deleted!
 */
export function validateClinicalRecordDelete(
  record: { psychologistId: string },
  callerUid: string,
  isSuperAdmin: boolean = false
): { allowed: boolean; reason?: string } {
  return {
    allowed: false,
    reason: 'Exclusão estritamente proibida: prontuários clínicos possuem guarda obrigatória de no mínimo 5 anos (CFP nº 01/2009).'
  };
}

/**
 * Validates clinic property, settings, and ownership protection.
 */
export function validateClinicUpdate(
  existingClinic: Clinic,
  incomingClinic: Clinic,
  callerUid: string,
  isSuperAdmin: boolean = false
): { allowed: boolean; reason?: string } {
  if (!callerUid) return { allowed: false, reason: 'Não autenticado.' };
  if (isSuperAdmin) return { allowed: true };

  if (existingClinic.ownerId !== callerUid) {
    return { allowed: false, reason: 'Apenas o proprietário da clínica ou o SuperAdmin podem atualizar dados da clínica.' };
  }

  if (incomingClinic.ownerId !== existingClinic.ownerId) {
    return { allowed: false, reason: 'Transferência de propriedade da clínica (ownerId) não é permitida por atualização direta.' };
  }

  if (incomingClinic.id !== existingClinic.id) {
    return { allowed: false, reason: 'Identificador da clínica é imutável.' };
  }

  if (incomingClinic.status !== existingClinic.status) {
    return { allowed: false, reason: 'Status administrativo da clínica só pode ser alterado pelo SuperAdmin.' };
  }

  if (existingClinic.cnpj && incomingClinic.cnpj !== existingClinic.cnpj) {
    return { allowed: false, reason: 'CNPJ da clínica é imutável na atualização do proprietário.' };
  }

  if (existingClinic.roomsCount !== undefined && incomingClinic.roomsCount !== existingClinic.roomsCount) {
    return { allowed: false, reason: 'Limites de salas (roomsCount) contratados só podem ser alterados pelo SuperAdmin.' };
  }

  if (existingClinic.professionalsCount !== undefined && incomingClinic.professionalsCount !== existingClinic.professionalsCount) {
    return { allowed: false, reason: 'Limites de profissionais contratados só podem ser alterados pelo SuperAdmin.' };
  }

  const allowedOwnerKeys = new Set(['name', 'tradeName', 'phone', 'email', 'address', 'updatedAt']);
  for (const key of Object.keys(incomingClinic) as (keyof Clinic)[]) {
    if (incomingClinic[key] !== existingClinic[key] && !allowedOwnerKeys.has(key)) {
      return { allowed: false, reason: `Proprietário não pode alterar o campo administrativo ${key}.` };
    }
  }

  return { allowed: true };
}

/**
 * Validates professional private vs public directory access.
 */
export function validateProfessionalAccess(
  prof: { userId: string },
  collectionType: 'private' | 'public',
  callerUid: string,
  isSuperAdmin: boolean = false
): boolean {
  if (!callerUid) return false;
  if (collectionType === 'public') {
    // Public directory is readable by any signed in user
    return true;
  }
  // Private record is accessible only by the professional themselves or superadmin
  return prof.userId === callerUid || isSuperAdmin;
}

/**
 * Validates active status: suspended users are blocked from protected operations.
 */
export function validateUserActiveStatus(status: string): { allowed: boolean; reason?: string } {
  if (status === 'suspended') {
    return { allowed: false, reason: 'CONTA_SUSPENSA: Usuários suspensos estão bloqueados de acessar coleções protegidas.' };
  }
  return { allowed: true };
}

/**
 * Validates appointment creation relationship gates.
 */
export function validateAppointmentCreate(
  appointment: Partial<Appointment>,
  callerUid: string,
  role: 'psychologist' | 'patient',
  patientBelongsToPsychologist: boolean,
  publicProfessionalExists: boolean
): { allowed: boolean; reason?: string } {
  if (!callerUid) return { allowed: false, reason: 'Não autenticado.' };

  if (role === 'psychologist') {
    if (appointment.psychologistId !== callerUid) {
      return { allowed: false, reason: 'Psicólogo só pode criar agendamentos em sua própria agenda.' };
    }
    if (!patientBelongsToPsychologist) {
      return { allowed: false, reason: 'Paciente não pertence ao vínculo ativo deste psicólogo.' };
    }
    if (!['confirmed', 'pending'].includes(appointment.status || '')) {
      return { allowed: false, reason: 'Status inicial inválido para agendamento profissional.' };
    }
    return { allowed: true };
  }

  if (role === 'patient') {
    if (appointment.patientUserId !== callerUid) {
      return { allowed: false, reason: 'Anti-spoofing: paciente não pode criar agendamentos em nome de terceiros.' };
    }
    if (appointment.status !== 'pending') {
      return { allowed: false, reason: 'Paciente só pode solicitar agendamento no estado inicial pendente.' };
    }
    if (appointment.requestedBy !== 'patient') {
      return { allowed: false, reason: 'requestedBy deve ser patient.' };
    }
    if (!publicProfessionalExists) {
      return { allowed: false, reason: 'Profissional não encontrado no diretório público de psicólogos.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Papel de usuário não autorizado para criação de agendamentos.' };
}

/**
 * Validates that physical rooms cannot be transferred between clinics.
 */
export function validateRoomTransfer(
  existingRoom: { clinicId: string },
  incomingRoom: { clinicId: string }
): { allowed: boolean; reason?: string } {
  if (incomingRoom.clinicId !== existingRoom.clinicId) {
    return { allowed: false, reason: 'Transferência de sala entre clínicas é estritamente proibida por atualização direta.' };
  }
  return { allowed: true };
}

/**
 * Validates that financial payments protect immutable amount and relational keys.
 */
export function validatePaymentUpdate(
  existing: { amount: number; psychologistId: string; patientId: string },
  incoming: { amount: number; psychologistId: string; patientId: string },
  callerUid: string
): { allowed: boolean; reason?: string } {
  if (callerUid !== existing.psychologistId) {
    return { allowed: false, reason: 'Apenas o psicólogo titular pode gerenciar o registro financeiro.' };
  }
  if (incoming.amount !== existing.amount) {
    return { allowed: false, reason: 'Valor (amount) do pagamento é imutável após registro.' };
  }
  if (incoming.psychologistId !== existing.psychologistId || incoming.patientId !== existing.patientId) {
    return { allowed: false, reason: 'Identificadores relacionais do pagamento são imutáveis.' };
  }
  return { allowed: true };
}

/**
 * Validates that only registered psychologists can publish their public profile.
 */
export function validatePublicProfessionalPublish(
  prof: { userId: string },
  hasPsychologistRole: boolean,
  callerUid: string
): { allowed: boolean; reason?: string } {
  if (!callerUid) return { allowed: false, reason: 'Não autenticado.' };
  if (callerUid !== prof.userId) {
    return { allowed: false, reason: 'Apenas o titular pode publicar seu perfil profissional.' };
  }
  if (!hasPsychologistRole) {
    return { allowed: false, reason: 'Apenas usuários com papel psychologist podem criar perfil público profissional.' };
  }
  return { allowed: true };
}
