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
import {
  SEED_APPOINTMENTS,
  SEED_PATIENTS,
  SEED_CLINICAL_RECORDS,
  SEED_PAYMENTS,
  SEED_EXPENSES,
  SEED_ROOMS,
  SEED_AUDIT_LOGS,
  SEED_NOTIFICATIONS,
  SEED_CLINICS,
  SEED_PROFESSIONALS
} from '../data/seedData';

/**
 * Bootstraps initial records into Firestore if collections are empty.
 */
export async function bootstrapFirestoreData(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'clinics'));
    if (snap.empty) {
      console.log('Populando dados iniciais no Firestore...');
      // Seed clinics
      for (const clinic of SEED_CLINICS) {
        await setDoc(doc(db, 'clinics', clinic.id), clinic);
      }
      // Seed professionals
      for (const prof of SEED_PROFESSIONALS) {
        await setDoc(doc(db, 'professionals', prof.id), prof);
      }
      // Seed rooms
      for (const room of SEED_ROOMS) {
        await setDoc(doc(db, 'clinic_rooms', room.id), room);
      }
    }
  } catch (error) {
    // If offline or permission denied, handle gracefully
    console.warn('Bootstrap de dados Firestore em modo local/tolerante:', error);
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
      q = collection(db, 'appointments');
    }

    const snap = await getDocs(q);
    if (snap.empty) return SEED_APPOINTMENTS;
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'appointments');
    return SEED_APPOINTMENTS;
  }
}

export async function persistAppointment(app: Appointment): Promise<void> {
  try {
    await setDoc(doc(db, 'appointments', app.id), app);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `appointments/${app.id}`);
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
  }
}

// PATIENTS
export async function fetchPatientsForPsychologist(psychologistId: string): Promise<Patient[]> {
  try {
    const q = query(collection(db, 'patients'), where('psychologistId', '==', psychologistId));
    const snap = await getDocs(q);
    if (snap.empty) return SEED_PATIENTS;
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Patient));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'patients');
    return SEED_PATIENTS;
  }
}

export async function persistPatient(patient: Patient): Promise<void> {
  try {
    await setDoc(doc(db, 'patients', patient.id), patient);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `patients/${patient.id}`);
  }
}

// CLINICAL RECORDS (STRICT SIGILO)
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
    if (snap.empty) {
      return SEED_CLINICAL_RECORDS.filter(r => r.patientId === patientId);
    }
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ClinicalRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'clinical_records');
    return SEED_CLINICAL_RECORDS.filter(r => r.patientId === patientId);
  }
}

export async function persistClinicalRecord(record: ClinicalRecord): Promise<void> {
  try {
    await setDoc(doc(db, 'clinical_records', record.id), record);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clinical_records/${record.id}`);
  }
}

// AUDIT LOGS (IMMUTABLE)
export async function persistAuditLog(log: AuditLog): Promise<void> {
  try {
    await setDoc(doc(db, 'audit_logs', log.id), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `audit_logs/${log.id}`);
  }
}

// PAYMENTS
export async function fetchPayments(psychologistId: string): Promise<PaymentRecord[]> {
  try {
    const q = query(collection(db, 'payments'), where('psychologistId', '==', psychologistId));
    const snap = await getDocs(q);
    if (snap.empty) return SEED_PAYMENTS;
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as PaymentRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'payments');
    return SEED_PAYMENTS;
  }
}

export async function persistPayment(payment: PaymentRecord): Promise<void> {
  try {
    await setDoc(doc(db, 'payments', payment.id), payment);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `payments/${payment.id}`);
  }
}

// EXPENSES
export async function fetchExpenses(psychologistId: string): Promise<ExpenseRecord[]> {
  try {
    const q = query(collection(db, 'expenses'), where('psychologistId', '==', psychologistId));
    const snap = await getDocs(q);
    if (snap.empty) return SEED_EXPENSES;
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ExpenseRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'expenses');
    return SEED_EXPENSES;
  }
}

export async function persistExpense(expense: ExpenseRecord): Promise<void> {
  try {
    await setDoc(doc(db, 'expenses', expense.id), expense);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `expenses/${expense.id}`);
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
    if (snap.empty) return SEED_ROOMS;
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ClinicRoom));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'clinic_rooms');
    return SEED_ROOMS;
  }
}

export async function persistRoom(room: ClinicRoom): Promise<void> {
  try {
    await setDoc(doc(db, 'clinic_rooms', room.id), room);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clinic_rooms/${room.id}`);
  }
}

// NOTIFICATIONS
export async function fetchNotificationsForUser(userId: string): Promise<AppNotification[]> {
  try {
    const q = query(collection(db, 'notifications'), where('recipientUserId', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) return SEED_NOTIFICATIONS.filter(n => n.recipientUserId === userId);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as AppNotification));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'notifications');
    return SEED_NOTIFICATIONS.filter(n => n.recipientUserId === userId);
  }
}

export async function persistNotification(notification: AppNotification): Promise<void> {
  try {
    await setDoc(doc(db, 'notifications', notification.id), notification);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `notifications/${notification.id}`);
  }
}

export async function updateNotificationInDb(id: string, updates: Partial<AppNotification>): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
  }
}

