import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  Appointment,
  Patient,
  ClinicalRecord,
  PaymentRecord,
  ExpenseRecord,
  ClinicRoom,
  AuditLog,
  AppNotification
} from '../types';

/**
 * Initializes Firestore structure if needed, without polluting with mock clinical data.
 */
export async function bootstrapFirestoreData(): Promise<void> {
  // Production-ready: does not inject mock patients or mock clinical records.
  // Real data must be created by authenticated users in their respective workspaces.
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
    return [];
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
    return [];
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

// CLINICAL RECORDS (STRICT SIGILO PROFISSIONAL)
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
    return [];
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

// AUDIT LOGS (IMMUTABLE & SANITIZED)
/**
 * Sanitizes audit logs to ensure no passwords or clinical sensitive notes
 * (evolution notes, private notes, diagnostic hypotheses) are stored in the audit trail.
 */
export function sanitizeAuditLog(log: AuditLog): AuditLog {
  let sanitizedDetails = log.details || '';
  const sensitivePatterns = [
    /password[=:\s]+[^\s,]+/gi,
    /evolutionNotes/gi,
    /privateNotes/gi,
    /diagnosticHypothesis/gi,
    /conductPlan/gi
  ];

  for (const pattern of sensitivePatterns) {
    sanitizedDetails = sanitizedDetails.replace(pattern, '[DADO_SENSIVEL_OMITIDO]');
  }

  return {
    ...log,
    details: sanitizedDetails.slice(0, 1000)
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

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    const snap = await getDocs(collection(db, 'audit_logs'));
    if (snap.empty) return [];
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    return [];
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
    return [];
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
    return [];
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
    return [];
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
    return [];
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


