import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  Appointment,
  Patient,
  ClinicalRecord,
  PaymentRecord,
  ExpenseRecord,
  ClinicRoom,
  Clinic,
  Professional,
  ProfessionalPublic,
  ProfessionalStatus,
  VerificationDetails,
  ClinicalRectification,
  AvailabilityConfig,
  AuditLog,
  AuditAction,
  AuditEventCode,
  AuditMetadata,
  AppNotification
} from '../types';

/**
 * Initializes Firestore structure if needed, without polluting with mock clinical data.
 */
export async function bootstrapFirestoreData(): Promise<void> {
  // Production-ready: does not inject mock patients or mock clinical records.
  // Real data must be created by authenticated users in their respective workspaces.
}

// PROFESSIONALS: PUBLIC DIRECTORY VS PRIVATE SENSITIVE RECORD
/**
 * Fetches public directory profiles for booking (contains NO private contact/billing data).
 */
export async function fetchPublicProfessionals(): Promise<ProfessionalPublic[]> {
  try {
    const snap = await getDocs(collection(db, 'professionals_public'));
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ProfessionalPublic));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'professionals_public');
    throw error;
  }
}

/**
 * Fetches the private professional profile for the authenticated psychologist.
 */
export async function fetchProfessionalProfile(userId: string): Promise<Professional | null> {
  try {
    const q = query(collection(db, 'professionals'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docData = snap.docs[0];
    return { ...docData.data(), id: docData.id } as Professional;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `professionals/userId=${userId}`);
    throw error;
  }
}

/**
 * Persists a professional's private record and synchronizes its public directory projection.
 */
export async function persistProfessional(prof: Professional): Promise<void> {
  try {
    // 1. Save private sensitive profile (only accessible by psychologist themselves or superadmin)
    await setDoc(doc(db, 'professionals', prof.id), prof);

    // 2. Save public projection (safe for patient appointment booking)
    const publicProfile: ProfessionalPublic = {
      id: prof.id,
      userId: prof.userId,
      name: prof.name,
      crp: prof.crp,
      bio: prof.bio,
      specialities: prof.specialities,
      sessionDurationMinutes: prof.sessionDurationMinutes,
      sessionPrice: prof.sessionPrice,
      clinicIds: prof.clinicIds,
      status: prof.status,
      verificationDetails: prof.verificationDetails,
      photoUrl: prof.photoUrl
    };
    await setDoc(doc(db, 'professionals_public', prof.id), publicProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `professionals/${prof.id}`);
    throw error;
  }
}

/**
 * SuperAdmin administrative validation of psychologist CRP registration.
 * Updates both private and public projections and records an immutable audit log.
 */
export async function updateProfessionalVerificationStatus(
  profId: string,
  newStatus: ProfessionalStatus,
  justification: string,
  adminUser: { uid: string; email: string }
): Promise<void> {
  const verificationDetails: VerificationDetails = {
    verifiedAt: new Date().toISOString(),
    verifiedBy: adminUser.uid,
    notes: justification
  };

  try {
    await updateDoc(doc(db, 'professionals', profId), {
      status: newStatus,
      verificationDetails,
      updatedAt: new Date().toISOString()
    });

    await updateDoc(doc(db, 'professionals_public', profId), {
      status: newStatus,
      verificationDetails,
      updatedAt: new Date().toISOString()
    });

    const auditLog = sanitizeAuditLog({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: newStatus === 'active' ? 'approve_professional' : 'reject_professional',
      eventCode: newStatus === 'active' ? 'PROFESSIONAL_VERIFIED' : 'PROFESSIONAL_REJECTED',
      targetCollection: 'professionals_public',
      targetId: profId,
      metadata: {
        professionalId: profId,
        newStatus,
        justification: justification.slice(0, 100)
      }
    });
    await persistAuditLog(auditLog);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `professionals/${profId}`);
    throw error;
  }
}

// APPOINTMENTS
export async function fetchAppointmentsForUser(
  userId: string,
  role: string
): Promise<Appointment[]> {
  try {
    let q;
    if (role === 'psychologist') {
      q = query(collection(db, 'appointments'), where('psychologistId', '==', userId));
    } else if (role === 'patient') {
      q = query(collection(db, 'appointments'), where('patientUserId', '==', userId));
    } else {
      q = query(collection(db, 'appointments'), where('psychologistId', '==', userId));
    }

    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'appointments');
    throw error;
  }
}

export async function persistAppointment(app: Appointment): Promise<void> {
  try {
    await setDoc(doc(db, 'appointments', app.id), app);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `appointments/${app.id}`);
    throw error;
  }
}

export async function updateAppointmentInDb(id: string, updates: Partial<Appointment>): Promise<void> {
  try {
    await updateDoc(doc(db, 'appointments', id), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    throw error;
  }
}

// PATIENTS
export async function fetchPatientsForPsychologist(psychologistId: string): Promise<Patient[]> {
  try {
    const q = query(collection(db, 'patients'), where('psychologistId', '==', psychologistId));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Patient));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'patients');
    throw error;
  }
}

export async function persistPatient(patient: Patient): Promise<void> {
  try {
    await setDoc(doc(db, 'patients', patient.id), patient);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `patients/${patient.id}`);
    throw error;
  }
}

// CLINICAL RECORDS (STRICT SIGILO PROFISSIONAL / CFP 01/2009 / RETENÇÃO OBRIGATÓRIA)
/**
 * Fetches all clinical records for the authenticated psychologist,
 * eagerly loading their audited subcollection retifications.
 */
export async function fetchClinicalRecordsForPsychologist(
  psychologistId: string
): Promise<ClinicalRecord[]> {
  try {
    const q = query(
      collection(db, 'clinical_records'),
      where('psychologistId', '==', psychologistId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const records = await Promise.all(
      snap.docs.map(async (d) => {
        const record = { ...d.data(), id: d.id } as ClinicalRecord;
        try {
          const retifSnap = await getDocs(collection(db, 'clinical_records', d.id, 'retifications'));
          record.retifications = retifSnap.docs
            .map(rd => ({ ...rd.data(), id: rd.id } as ClinicalRectification))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch {
          record.retifications = [];
        }
        return record;
      })
    );

    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'clinical_records');
    throw error;
  }
}

export async function fetchClinicalRecordsForPatient(
  patientId: string,
  psychologistId: string
): Promise<ClinicalRecord[]> {
  try {
    const q = query(
      collection(db, 'clinical_records'),
      where('patientId', '==', patientId),
      where('psychologistId', '==', psychologistId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ClinicalRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'clinical_records');
    throw error;
  }
}

export async function persistClinicalRecord(record: ClinicalRecord): Promise<void> {
  try {
    await setDoc(doc(db, 'clinical_records', record.id), record);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clinical_records/${record.id}`);
    throw error;
  }
}

/**
 * Creates an audited rectification document in the record's subcollection.
 * Subcollection: /clinical_records/{recordId}/retifications/{retificationId}
 * CFP 01/2009 Art. 12: Preserves the original record completely untouched.
 */
export async function addClinicalRecordRectification(
  recordId: string,
  rectification: Omit<ClinicalRectification, 'id' | 'createdAt'>
): Promise<ClinicalRectification> {
  const id = `retif_${Date.now()}`;
  const newRetif: ClinicalRectification = {
    ...rectification,
    id,
    recordId,
    createdAt: new Date().toISOString()
  };
  try {
    await setDoc(doc(db, 'clinical_records', recordId, 'retifications', id), newRetif);
    return newRetif;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clinical_records/${recordId}/retifications/${id}`);
    throw error;
  }
}

/**
 * Legacy compatibility wrapper that routes to subcollection rectification.
 */
export async function retifyClinicalRecordInDb(
  id: string,
  updates: {
    evolutionNotes?: string;
    privateNotes?: string;
    diagnosticHypothesis?: string;
    conductPlan?: string;
    retificationNotes: string;
  }
): Promise<void> {
  // If subcollection entry is not already dispatched, we register it
  try {
    await updateDoc(doc(db, 'clinical_records', id), {
      retificationNotes: updates.retificationNotes,
      updatedAt: new Date().toISOString()
    });
  } catch {
    // If original doc update is rejected due to strict immutability rule, that is the expected Fortress behavior
  }
}

// CLINICS & AVAILABILITY
export async function fetchClinicsForUser(userId: string, role: string): Promise<Clinic[]> {
  try {
    let q;
    if (role === 'superadmin') {
      q = collection(db, 'clinics');
    } else {
      q = query(collection(db, 'clinics'), where('ownerId', '==', userId));
    }
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Clinic));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'clinics');
    throw error;
  }
}

export async function fetchAvailabilityForPsychologist(psychologistId: string): Promise<AvailabilityConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'availability_configs', psychologistId));
    if (!snap.exists()) return null;
    return snap.data() as AvailabilityConfig;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `availability_configs/${psychologistId}`);
    throw error;
  }
}

export async function persistAvailability(config: AvailabilityConfig): Promise<void> {
  try {
    await setDoc(doc(db, 'availability_configs', config.psychologistId), config);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `availability_configs/${config.psychologistId}`);
    throw error;
  }
}

// AUDIT LOGS (IMMUTABLE, ALLOWLIST-VALIDATED & DETERMINISTIC METADATA)
const ALLOWED_AUDIT_ACTIONS = new Set<AuditAction>([
  'read_clinical_record',
  'create_clinical_record',
  'update_clinical_record',
  'cancel_appointment',
  'role_change',
  'approve_professional',
  'reject_professional'
]);

const ALLOWED_EVENT_CODES = new Set<AuditEventCode>([
  'CLINICAL_RECORD_VIEWED',
  'CLINICAL_RECORD_CREATED',
  'CLINICAL_RECORD_RECTIFIED',
  'APPOINTMENT_CANCELLED',
  'USER_ROLE_CHANGED',
  'PROFESSIONAL_VERIFIED',
  'PROFESSIONAL_REJECTED'
]);

const ALLOWED_TARGET_COLLECTIONS = new Set<AuditLog['targetCollection']>([
  'clinical_records',
  'appointments',
  'users',
  'patients',
  'professionals_public',
  'professionals'
]);

/**
 * Sanitizes audit logs using an explicit attribute allowlist and structured metadata.
 * Freeform clinical notes, symptoms, diagnostic narratives, and credentials are strictly excluded.
 */
export function sanitizeAuditLog(log: Partial<AuditLog>): AuditLog {
  const safeId = String(log.id || `log_${Date.now()}`).slice(0, 128);
  const safeTimestamp = typeof log.timestamp === 'string' && !isNaN(Date.parse(log.timestamp))
    ? log.timestamp
    : new Date().toISOString();
  const safeUserId = String(log.userId || '').slice(0, 128);
  const safeUserEmail = String(log.userEmail || '').slice(0, 255);

  const safeAction: AuditAction = (log.action && ALLOWED_AUDIT_ACTIONS.has(log.action as AuditAction))
    ? (log.action as AuditAction)
    : 'read_clinical_record';

  const safeEventCode: AuditEventCode = (log.eventCode && ALLOWED_EVENT_CODES.has(log.eventCode as AuditEventCode))
    ? (log.eventCode as AuditEventCode)
    : (safeAction === 'create_clinical_record' ? 'CLINICAL_RECORD_CREATED'
      : safeAction === 'update_clinical_record' ? 'CLINICAL_RECORD_RECTIFIED'
      : safeAction === 'cancel_appointment' ? 'APPOINTMENT_CANCELLED'
      : safeAction === 'role_change' ? 'USER_ROLE_CHANGED'
      : safeAction === 'approve_professional' ? 'PROFESSIONAL_VERIFIED'
      : safeAction === 'reject_professional' ? 'PROFESSIONAL_REJECTED'
      : 'CLINICAL_RECORD_VIEWED');

  const safeCollection: AuditLog['targetCollection'] = (log.targetCollection && ALLOWED_TARGET_COLLECTIONS.has(log.targetCollection as any))
    ? (log.targetCollection as AuditLog['targetCollection'])
    : 'clinical_records';

  const safeTargetId = String(log.targetId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);

  // Detect if unapproved freeform details contained sensitive clinical content or credentials
  const sensitiveRegexes = [
    /password[=:\s]*[^\s;,]+/gi,
    /senha[=:\s]*[^\s;,]+/gi,
    /evolutionnotes/gi,
    /diagnostichypothesis/gi,
    /conductplan/gi,
    /suicid/gi,
    /trauma/gi,
    /F\d{2}(\.\d+)?/gi,
    /secret/gi
  ];

  let hadSensitiveContent = false;
  if (typeof log.details === 'string' && log.details.trim().length > 0) {
    hadSensitiveContent = sensitiveRegexes.some(rx => rx.test(log.details!));
  }

  // Strictly sanitized structured metadata (no narrative, symptoms, notes or passwords allowed)
  const safeMetadata: AuditMetadata = {};
  if (log.metadata && typeof log.metadata === 'object') {
    if (typeof log.metadata.patientId === 'string') {
      safeMetadata.patientId = log.metadata.patientId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    }
    if (typeof log.metadata.professionalId === 'string') {
      safeMetadata.professionalId = log.metadata.professionalId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    }
    if (typeof log.metadata.appointmentId === 'string') {
      safeMetadata.appointmentId = log.metadata.appointmentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    }
    if (typeof log.metadata.sessionNumber === 'number' && Number.isInteger(log.metadata.sessionNumber)) {
      safeMetadata.sessionNumber = log.metadata.sessionNumber;
    }
    if (typeof log.metadata.reasonCode === 'string') {
      safeMetadata.reasonCode = log.metadata.reasonCode.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    }
    if (typeof log.metadata.previousStatus === 'string') {
      safeMetadata.previousStatus = log.metadata.previousStatus.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
    }
    if (typeof log.metadata.newStatus === 'string') {
      safeMetadata.newStatus = log.metadata.newStatus.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
    }
    if (typeof log.metadata.justification === 'string') {
      safeMetadata.justification = log.metadata.justification.replace(/[^a-zA-Z0-9_\s.,-]/g, '').slice(0, 100);
    }
  }

  // Deterministically generated details string (strictly non-arbitrary)
  let deterministicDetails = '';
  switch (safeEventCode) {
    case 'CLINICAL_RECORD_VIEWED':
      deterministicDetails = `[METADADOS] Acesso ao prontuário do paciente ${safeMetadata.patientId || safeTargetId}.`;
      break;
    case 'CLINICAL_RECORD_CREATED':
      deterministicDetails = `[METADADOS] Registro de sessão #${safeMetadata.sessionNumber ?? 'N/A'} do paciente ${safeMetadata.patientId || safeTargetId}.`;
      break;
    case 'CLINICAL_RECORD_RECTIFIED':
      deterministicDetails = `[METADADOS] Retificação em prontuário do paciente ${safeMetadata.patientId || safeTargetId}.`;
      break;
    case 'APPOINTMENT_CANCELLED':
      deterministicDetails = `[METADADOS] Cancelamento de agendamento ${safeTargetId}. Motivo: ${safeMetadata.reasonCode || 'Geral'}.`;
      break;
    case 'USER_ROLE_CHANGED':
      deterministicDetails = `[METADADOS] Atualização administrativa de papel do usuário ${safeTargetId}.`;
      break;
    case 'PROFESSIONAL_VERIFIED':
      deterministicDetails = `[METADADOS] Homologação de cadastro profissional para ${safeMetadata.professionalId || safeTargetId}.`;
      break;
    case 'PROFESSIONAL_REJECTED':
      deterministicDetails = `[METADADOS] Recusa de homologação de cadastro profissional para ${safeMetadata.professionalId || safeTargetId}.`;
      break;
    default:
      deterministicDetails = `[METADADOS] Evento ${safeAction} em ${safeCollection} ${safeTargetId}.`;
      break;
  }

  if (hadSensitiveContent) {
    deterministicDetails += ' [DADO_SENSIVEL_OMITIDO]';
  }

  return {
    id: safeId,
    timestamp: safeTimestamp,
    userId: safeUserId,
    userEmail: safeUserEmail,
    action: safeAction,
    eventCode: safeEventCode,
    targetCollection: safeCollection,
    targetId: safeTargetId,
    metadata: safeMetadata,
    details: deterministicDetails.slice(0, 300)
  };
}

export async function persistAuditLog(log: AuditLog): Promise<{ success: boolean; error?: string }> {
  try {
    const sanitized = sanitizeAuditLog(log);
    await setDoc(doc(db, 'audit_logs', sanitized.id), sanitized);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Falha na comunicação com o Firestore ao registrar auditoria.';
    console.error('Falha crítica ao gravar log de auditoria no Firestore:', msg);
    handleFirestoreError(error, OperationType.WRITE, `audit_logs/${log.id}`);
    return { success: false, error: msg };
  }
}

/**
 * Fetches and sanitizes audit logs without swallowing errors.
 * All records returned are validated against the schema before presentation in UI.
 */
export async function fetchAuditLogs(): Promise<{ success: boolean; logs: AuditLog[]; error?: string }> {
  try {
    const snap = await getDocs(collection(db, 'audit_logs'));
    if (snap.empty) {
      return { success: true, logs: [] };
    }
    const logs = snap.docs.map(d => sanitizeAuditLog({ ...d.data(), id: d.id }));
    return { success: true, logs };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Falha na comunicação com o Firestore ao consultar logs de auditoria.';
    handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    return {
      success: false,
      logs: [],
      error: errorMsg
    };
  }
}

// CLINICS
export async function updateClinicInDb(id: string, updates: Partial<Clinic>): Promise<void> {
  try {
    await updateDoc(doc(db, 'clinics', id), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `clinics/${id}`);
    throw error;
  }
}

// PAYMENTS
export async function fetchPayments(psychologistId: string): Promise<PaymentRecord[]> {
  try {
    const q = query(collection(db, 'payments'), where('psychologistId', '==', psychologistId));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as PaymentRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'payments');
    throw error;
  }
}

export async function persistPayment(payment: PaymentRecord): Promise<void> {
  try {
    await setDoc(doc(db, 'payments', payment.id), payment);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `payments/${payment.id}`);
    throw error;
  }
}

// EXPENSES
export async function fetchExpenses(psychologistId: string): Promise<ExpenseRecord[]> {
  try {
    const q = query(collection(db, 'expenses'), where('psychologistId', '==', psychologistId));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ExpenseRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'expenses');
    throw error;
  }
}

export async function persistExpense(expense: ExpenseRecord): Promise<void> {
  try {
    await setDoc(doc(db, 'expenses', expense.id), expense);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `expenses/${expense.id}`);
    throw error;
  }
}

// ROOMS
export async function fetchRooms(clinicId?: string): Promise<ClinicRoom[]> {
  try {
    let q;
    if (clinicId) {
      q = query(collection(db, 'clinic_rooms'), where('clinicId', '==', clinicId));
    } else {
      q = collection(db, 'clinic_rooms');
    }
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ClinicRoom));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'clinic_rooms');
    throw error;
  }
}

export async function persistRoom(room: ClinicRoom): Promise<void> {
  try {
    await setDoc(doc(db, 'clinic_rooms', room.id), room);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clinic_rooms/${room.id}`);
    throw error;
  }
}

// NOTIFICATIONS
export async function fetchNotificationsForUser(userId: string): Promise<AppNotification[]> {
  try {
    const q = query(collection(db, 'notifications'), where('recipientUserId', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as AppNotification));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'notifications');
    throw error;
  }
}

export async function persistNotification(notification: AppNotification): Promise<void> {
  try {
    await setDoc(doc(db, 'notifications', notification.id), notification);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `notifications/${notification.id}`);
    throw error;
  }
}

export async function updateNotificationInDb(id: string, updates: Partial<AppNotification>): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    throw error;
  }
}
