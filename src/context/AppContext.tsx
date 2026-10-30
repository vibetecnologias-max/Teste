import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, testConnection } from '../firebase/config';
import {
  UserProfile,
  UserRole,
  Professional,
  Clinic,
  ClinicRoom,
  Patient,
  Appointment,
  AppointmentStatus,
  ClinicalRecord,
  PaymentRecord,
  ExpenseRecord,
  AppNotification,
  AuditLog,
  AvailabilityConfig
} from '../types';
import {
  SEED_USERS,
  SEED_PROFESSIONALS,
  SEED_CLINICS,
  SEED_ROOMS,
  SEED_PATIENTS,
  SEED_APPOINTMENTS,
  SEED_CLINICAL_RECORDS,
  SEED_PAYMENTS,
  SEED_EXPENSES,
  SEED_NOTIFICATIONS,
  SEED_AVAILABILITY,
  SEED_AUDIT_LOGS
} from '../data/seedData';
import {
  checkSlotConflict,
  isValidAppointmentTransition,
  canAccessClinicalRecord
} from '../utils/rules';
import {
  bootstrapFirestoreData,
  persistAppointment,
  persistPatient,
  persistClinicalRecord,
  persistAuditLog,
  persistPayment,
  persistExpense,
  fetchAppointmentsForUser,
  fetchPatientsForPsychologist,
  fetchPayments,
  fetchExpenses,
  fetchRooms,
  persistRoom,
  fetchNotificationsForUser,
  persistNotification,
  updateNotificationInDb
} from '../services/firestoreService';
import { logoutUser, getOrCreateUserProfile } from '../services/authService';

interface AppContextType {
  currentUser: UserProfile | null;
  currentProfessional?: Professional;
  currentClinic?: Clinic;
  allProfessionals: Professional[];
  clinics: Clinic[];
  rooms: ClinicRoom[];
  patients: Patient[];
  appointments: Appointment[];
  clinicalRecords: ClinicalRecord[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  availability: AvailabilityConfig;
  isAuthenticated: boolean;
  loginUser: (user: UserProfile) => void;
  logout: () => Promise<void>;
  switchUserRole: (role: UserRole) => void;
  // Appointment actions
  requestAppointment: (data: {
    psychologistId: string;
    patientId: string;
    patientName: string;
    patientPhone?: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    price: number;
    notes?: string;
    roomId?: string;
  }) => { success: boolean; error?: string; appointment?: Appointment };
  confirmAppointment: (appointmentId: string) => { success: boolean; error?: string };
  rejectAppointment: (appointmentId: string, reason?: string) => { success: boolean; error?: string };
  cancelAppointment: (appointmentId: string, reason?: string) => { success: boolean; error?: string };
  completeAppointment: (appointmentId: string) => { success: boolean; error?: string };
  markNoShow: (appointmentId: string) => { success: boolean; error?: string };
  // Patient actions
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt'>) => Patient;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  // Clinical records (Strict sigilo)
  addClinicalRecord: (record: Omit<ClinicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'isConfidential'>) => { success: boolean; error?: string; record?: ClinicalRecord };
  getPatientClinicalRecords: (patientId: string) => ClinicalRecord[];
  // Finance
  addPayment: (payment: Omit<PaymentRecord, 'id' | 'createdAt'>) => PaymentRecord;
  updatePaymentStatus: (id: string, status: 'paid' | 'pending' | 'overdue', method?: 'pix' | 'cash' | 'card' | 'transfer') => void;
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => ExpenseRecord;
  // Rooms
  addRoom: (room: Omit<ClinicRoom, 'id'>) => ClinicRoom;
  updateRoom: (id: string, updates: Partial<ClinicRoom>) => void;
  // Notifications
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  unreadCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    // Default to Dr. Marcos for immediate development review or load session
    return SEED_USERS[0];
  });

  const [patients, setPatients] = useState<Patient[]>(SEED_PATIENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(SEED_APPOINTMENTS);
  // Clinical records are kept strictly in-memory and synced to Firestore - NEVER in localStorage!
  const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>(SEED_CLINICAL_RECORDS);
  const [payments, setPayments] = useState<PaymentRecord[]>(SEED_PAYMENTS);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(SEED_EXPENSES);
  const [rooms, setRooms] = useState<ClinicRoom[]>(SEED_ROOMS);
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(SEED_AUDIT_LOGS);

  // Initialize and observe Firebase auth
  useEffect(() => {
    testConnection();
    bootstrapFirestoreData();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const profile = await getOrCreateUserProfile(firebaseUser);
          setCurrentUser(profile);
        } catch (err) {
          console.warn('Erro ao carregar perfil do Firebase Auth:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Synchronize Firestore data with authenticated user session
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    const syncUserData = async () => {
      try {
        const [userApps, userRooms, userNotifs] = await Promise.all([
          fetchAppointmentsForUser(currentUser.uid, currentUser.role),
          fetchRooms(currentUser.clinicId),
          fetchNotificationsForUser(currentUser.uid)
        ]);

        if (isMounted) {
          if (userApps && userApps.length > 0) setAppointments(userApps);
          if (userRooms && userRooms.length > 0) setRooms(userRooms);
          if (userNotifs && userNotifs.length > 0) setNotifications(userNotifs);
        }

        if (currentUser.role === 'psychologist') {
          const [userPats, userPays, userExps] = await Promise.all([
            fetchPatientsForPsychologist(currentUser.uid),
            fetchPayments(currentUser.uid),
            fetchExpenses(currentUser.uid)
          ]);
          if (isMounted) {
            if (userPats && userPats.length > 0) setPatients(userPats);
            if (userPays && userPays.length > 0) setPayments(userPays);
            if (userExps && userExps.length > 0) setExpenses(userExps);
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar dados com o Firestore:', err);
      }
    };

    syncUserData();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid, currentUser?.role, currentUser?.clinicId]);

  const loginUser = (user: UserProfile) => {
    setCurrentUser(user);
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  const switchUserRole = (role: UserRole) => {
    const found = SEED_USERS.find(u => u.role === role);
    if (found) {
      setCurrentUser(found);
    }
  };

  const currentProfessional = currentUser
    ? SEED_PROFESSIONALS.find(p => p.userId === currentUser.uid)
    : undefined;

  const currentClinic = currentUser
    ? SEED_CLINICS.find(c => c.id === currentUser.clinicId || c.ownerId === currentUser.uid)
    : undefined;

  const unreadCount = currentUser
    ? notifications.filter(n => n.recipientUserId === currentUser.uid && !n.read).length
    : 0;

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    updateNotificationInDb(id, { read: true });
  };

  const markAllNotificationsAsRead = () => {
    if (!currentUser) return;
    setNotifications(prev => prev.map(n => n.recipientUserId === currentUser.uid ? { ...n, read: true } : n));
    notifications.filter(n => n.recipientUserId === currentUser.uid && !n.read).forEach(n => {
      updateNotificationInDb(n.id, { read: true });
    });
  };

  // Appointment actions
  const requestAppointment = (data: {
    psychologistId: string;
    patientId: string;
    patientName: string;
    patientPhone?: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    price: number;
    notes?: string;
    roomId?: string;
  }) => {
    // 1. Conflict detection
    const conflict = checkSlotConflict(appointments, {
      psychologistId: data.psychologistId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      roomId: data.roomId
    }, 10);

    if (conflict.hasConflict) {
      return { success: false, error: conflict.reason || 'Conflito de horário detectado.' };
    }

    const professional = SEED_PROFESSIONALS.find(p => p.userId === data.psychologistId);
    const room = rooms.find(r => r.id === data.roomId);

    const newApp: Appointment = {
      id: `app_${Date.now()}`,
      psychologistId: data.psychologistId,
      psychologistName: professional?.name || 'Psicólogo Responsável',
      patientId: data.patientId,
      patientName: data.patientName,
      patientUserId: currentUser?.role === 'patient' ? currentUser.uid : undefined,
      patientPhone: data.patientPhone || '(11) 99999-0000',
      clinicId: professional?.clinicIds[0] || 'clinic_mente_viva',
      roomId: data.roomId,
      roomName: room?.name,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes: data.durationMinutes,
      status: 'pending',
      price: data.price,
      paymentStatus: 'pending',
      notes: data.notes || 'Solicitação de agendamento.',
      requestedBy: currentUser?.role === 'patient' ? 'patient' : 'psychologist',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setAppointments(prev => [newApp, ...prev]);
    persistAppointment(newApp);

    // Notification for psychologist
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      recipientUserId: data.psychologistId,
      type: 'appointment_request',
      title: 'Nova solicitação de consulta',
      message: `${data.patientName} solicitou atendimento para ${data.date.split('-').reverse().join('/')} às ${data.startTime}.`,
      link: '/agenda',
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications(prev => [newNotif, ...prev]);
    persistNotification(newNotif);

    return { success: true, appointment: newApp };
  };

  const confirmAppointment = (appointmentId: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'confirmed')) {
      return { success: false, error: `Transição inválida de ${target.status} para confirmado.` };
    }

    const conflict = checkSlotConflict(appointments, {
      id: target.id,
      psychologistId: target.psychologistId,
      date: target.date,
      startTime: target.startTime,
      endTime: target.endTime,
      roomId: target.roomId
    }, 10);

    if (conflict.hasConflict) {
      return { success: false, error: conflict.reason };
    }

    const updated = {
      ...target,
      status: 'confirmed' as AppointmentStatus,
      updatedAt: new Date().toISOString()
    };

    setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));
    persistAppointment(updated);

    if (target.patientUserId) {
      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        recipientUserId: target.patientUserId,
        type: 'appointment_confirmed',
        title: 'Consulta Confirmada!',
        message: `Seu agendamento para ${target.date.split('-').reverse().join('/')} às ${target.startTime} foi confirmado pelo psicólogo.`,
        link: '/meus-agendamentos',
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications(prev => [notif, ...prev]);
      persistNotification(notif);
    }

    return { success: true };
  };

  const rejectAppointment = (appointmentId: string, reason?: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'rejected')) {
      return { success: false, error: 'Não é possível recusar este agendamento no estado atual.' };
    }

    const updated = {
      ...target,
      status: 'rejected' as AppointmentStatus,
      cancellationReason: reason || 'Horário indisponível no momento.',
      updatedAt: new Date().toISOString()
    };

    setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));
    persistAppointment(updated);

    if (target.patientUserId) {
      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        recipientUserId: target.patientUserId,
        type: 'appointment_rejected',
        title: 'Solicitação de agendamento não aceita',
        message: `Infelizmente seu pedido para ${target.date.split('-').reverse().join('/')} às ${target.startTime} não pôde ser aceito. Motivo: ${reason || 'Indisponibilidade de agenda.'}`,
        link: '/agendar',
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications(prev => [notif, ...prev]);
      persistNotification(notif);
    }

    return { success: true };
  };

  const cancelAppointment = (appointmentId: string, reason?: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'cancelled')) {
      return { success: false, error: 'Agendamento não pode ser cancelado no estado atual.' };
    }

    const updated = {
      ...target,
      status: 'cancelled' as AppointmentStatus,
      cancellationReason: reason || 'Cancelado.',
      updatedAt: new Date().toISOString()
    };

    setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));
    persistAppointment(updated);

    return { success: true };
  };

  const completeAppointment = (appointmentId: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    const updated = {
      ...target,
      status: 'completed' as AppointmentStatus,
      updatedAt: new Date().toISOString()
    };

    setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));
    persistAppointment(updated);

    if (target.paymentStatus === 'pending') {
      const existingPay = payments.find(p => p.appointmentId === appointmentId);
      if (!existingPay) {
        const newPay: PaymentRecord = {
          id: `pay_${Date.now()}`,
          psychologistId: target.psychologistId,
          clinicId: target.clinicId,
          patientId: target.patientId,
          patientName: target.patientName,
          appointmentId: target.id,
          amount: target.price,
          method: 'pix',
          status: 'pending',
          dueDate: target.date,
          description: `Sessão de atendimento realizada em ${target.date.split('-').reverse().join('/')}`,
          createdAt: new Date().toISOString()
        };
        setPayments(prev => [newPay, ...prev]);
        persistPayment(newPay);
      }
    }

    return { success: true };
  };

  const markNoShow = (appointmentId: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    const updated = {
      ...target,
      status: 'no_show' as AppointmentStatus,
      updatedAt: new Date().toISOString()
    };

    setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));
    persistAppointment(updated);

    return { success: true };
  };

  // Patients
  const addPatient = (patientData: Omit<Patient, 'id' | 'createdAt'>) => {
    const newPatient: Patient = {
      ...patientData,
      id: `pat_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setPatients(prev => [newPatient, ...prev]);
    persistPatient(newPatient);
    return newPatient;
  };

  const updatePatient = (id: string, updates: Partial<Patient>) => {
    setPatients(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, ...updates };
        persistPatient(updated);
        return updated;
      }
      return p;
    }));
  };

  // Clinical Records (STRICT ACCESS CONTROL & AUDIT LOGGING)
  const addClinicalRecord = (recordData: Omit<ClinicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'isConfidential'>) => {
    if (!currentUser) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    if (!canAccessClinicalRecord({ uid: currentUser.uid, role: currentUser.role }, { psychologistId: recordData.psychologistId })) {
      return { success: false, error: 'Acesso negado: apenas o psicólogo responsável possui autorização para criar anotações clínicas.' };
    }

    const newRecord: ClinicalRecord = {
      ...recordData,
      id: `rec_${Date.now()}`,
      isConfidential: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser.displayName
    };

    setClinicalRecords(prev => [newRecord, ...prev]);
    persistClinicalRecord(newRecord);

    // Record immutable audit log
    const log: AuditLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.uid,
      userEmail: currentUser.email,
      action: 'create_clinical_record',
      targetCollection: 'clinical_records',
      targetId: newRecord.id,
      details: `Registro de evolução clínica da sessão #${recordData.sessionNumber} do paciente ${recordData.patientId}`
    };
    setAuditLogs(prev => [log, ...prev]);
    persistAuditLog(log);

    return { success: true, record: newRecord };
  };

  const getPatientClinicalRecords = (patientId: string): ClinicalRecord[] => {
    if (!currentUser || currentUser.role === 'clinic_manager' || currentUser.role === 'patient') {
      return [];
    }

    const records = clinicalRecords.filter(r => r.patientId === patientId);
    if (records.length > 0) {
      const log: AuditLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        action: 'read_clinical_record',
        targetCollection: 'clinical_records',
        targetId: patientId,
        details: `Consulta ao prontuário e evoluções clínicas do paciente ID ${patientId}.`
      };
      setAuditLogs(prev => [log, ...prev]);
      persistAuditLog(log);
    }

    return records;
  };

  // Finance
  const addPayment = (paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>) => {
    const newPay: PaymentRecord = {
      ...paymentData,
      id: `pay_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setPayments(prev => [newPay, ...prev]);
    persistPayment(newPay);
    return newPay;
  };

  const updatePaymentStatus = (id: string, status: 'paid' | 'pending' | 'overdue', method?: 'pix' | 'cash' | 'card' | 'transfer') => {
    setPayments(prev => prev.map(p => {
      if (p.id === id) {
        const updated = {
          ...p,
          status,
          method: method || p.method,
          paidAt: status === 'paid' ? new Date().toISOString() : p.paidAt
        };
        persistPayment(updated);
        return updated;
      }
      return p;
    }));
  };

  const addExpense = (expenseData: Omit<ExpenseRecord, 'id'>) => {
    const newExpense: ExpenseRecord = {
      ...expenseData,
      id: `exp_${Date.now()}`
    };
    setExpenses(prev => [newExpense, ...prev]);
    persistExpense(newExpense);
    return newExpense;
  };

  // Rooms
  const addRoom = (roomData: Omit<ClinicRoom, 'id'>) => {
    const newRoom: ClinicRoom = {
      ...roomData,
      id: `room_${Date.now()}`
    };
    setRooms(prev => [...prev, newRoom]);
    persistRoom(newRoom);
    return newRoom;
  };

  const updateRoom = (id: string, updates: Partial<ClinicRoom>) => {
    setRooms(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, ...updates };
        persistRoom(updated);
        return updated;
      }
      return r;
    }));
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentProfessional,
        currentClinic,
        allProfessionals: SEED_PROFESSIONALS,
        clinics: SEED_CLINICS,
        rooms,
        patients,
        appointments,
        clinicalRecords,
        payments,
        expenses,
        notifications,
        auditLogs,
        availability: SEED_AVAILABILITY,
        isAuthenticated: !!currentUser,
        loginUser,
        logout,
        switchUserRole,
        requestAppointment,
        confirmAppointment,
        rejectAppointment,
        cancelAppointment,
        completeAppointment,
        markNoShow,
        addPatient,
        updatePatient,
        addClinicalRecord,
        getPatientClinicalRecords,
        addPayment,
        updatePaymentStatus,
        addExpense,
        addRoom,
        updateRoom,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        unreadCount
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
