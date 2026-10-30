import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, testConnection } from '../firebase/config';
import {
  UserProfile,
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
  SEED_PROFESSIONALS,
  SEED_CLINICS,
  SEED_AVAILABILITY
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
  fetchClinicalRecordsForPatient,
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
  authLoading: boolean;
  persistenceError: string | null;
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
  clearPersistenceError: () => void;
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
  }) => Promise<{ success: boolean; error?: string; appointment?: Appointment }>;
  confirmAppointment: (appointmentId: string) => Promise<{ success: boolean; error?: string }>;
  rejectAppointment: (appointmentId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  cancelAppointment: (appointmentId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  completeAppointment: (appointmentId: string) => Promise<{ success: boolean; error?: string }>;
  markNoShow: (appointmentId: string) => Promise<{ success: boolean; error?: string }>;
  // Patient actions
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string; patient?: Patient }>;
  updatePatient: (id: string, updates: Partial<Patient>) => Promise<{ success: boolean; error?: string }>;
  // Clinical records (Strict sigilo)
  addClinicalRecord: (record: Omit<ClinicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'isConfidential'>) => Promise<{ success: boolean; error?: string; record?: ClinicalRecord }>;
  getPatientClinicalRecords: (patientId: string) => ClinicalRecord[];
  // Finance
  addPayment: (payment: Omit<PaymentRecord, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string; payment?: PaymentRecord }>;
  updatePaymentStatus: (id: string, status: 'paid' | 'pending' | 'overdue', method?: 'pix' | 'cash' | 'card' | 'transfer') => Promise<{ success: boolean; error?: string }>;
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => Promise<{ success: boolean; error?: string; expense?: ExpenseRecord }>;
  // Rooms
  addRoom: (room: Omit<ClinicRoom, 'id'>) => Promise<{ success: boolean; error?: string; room?: ClinicRoom }>;
  updateRoom: (id: string, updates: Partial<ClinicRoom>) => Promise<{ success: boolean; error?: string }>;
  // Notifications
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  unreadCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // REQUIREMENT 2: Initial user MUST be null, established strictly via onAuthStateChanged
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  // REQUIREMENT 5: Real state initialized empty - never disguised with seed/mock data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [rooms, setRooms] = useState<ClinicRoom[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Observe Firebase Auth state
  useEffect(() => {
    testConnection();
    bootstrapFirestoreData();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const profile = await getOrCreateUserProfile(firebaseUser);
          setCurrentUser(profile);
        } catch (err: any) {
          console.error('Erro ao verificar sessão do usuário:', err);
          setCurrentUser(null);
          setPersistenceError('Falha ao autenticar ou carregar perfil no Firestore.');
        } finally {
          setAuthLoading(false);
        }
      } else {
        setCurrentUser(null);
        setPatients([]);
        setAppointments([]);
        setClinicalRecords([]);
        setPayments([]);
        setExpenses([]);
        setRooms([]);
        setNotifications([]);
        setAuditLogs([]);
        setAuthLoading(false);
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
          setAppointments(userApps);
          setRooms(userRooms);
          setNotifications(userNotifs);
        }

        if (currentUser.role === 'psychologist') {
          const [userPats, userPays, userExps] = await Promise.all([
            fetchPatientsForPsychologist(currentUser.uid),
            fetchPayments(currentUser.uid),
            fetchExpenses(currentUser.uid)
          ]);
          if (isMounted) {
            setPatients(userPats);
            setPayments(userPays);
            setExpenses(userExps);
          }
        }
      } catch (err: any) {
        console.error('Erro ao sincronizar dados com o Firestore:', err);
        if (isMounted) {
          setPersistenceError('Não foi possível sincronizar todos os registros com o Firestore.');
        }
      }
    };

    syncUserData();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid, currentUser?.role, currentUser?.clinicId]);

  const loginUser = (user: UserProfile) => {
    setCurrentUser(user);
    setAuthLoading(false);
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setPatients([]);
    setAppointments([]);
    setClinicalRecords([]);
    setPayments([]);
    setExpenses([]);
    setRooms([]);
    setNotifications([]);
    setAuditLogs([]);
  };

  const clearPersistenceError = () => {
    setPersistenceError(null);
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
    updateNotificationInDb(id, { read: true }).catch(console.error);
  };

  const markAllNotificationsAsRead = () => {
    if (!currentUser) return;
    setNotifications(prev => prev.map(n => n.recipientUserId === currentUser.uid ? { ...n, read: true } : n));
    notifications.filter(n => n.recipientUserId === currentUser.uid && !n.read).forEach(n => {
      updateNotificationInDb(n.id, { read: true }).catch(console.error);
    });
  };

  // Appointment actions
  const requestAppointment = async (data: {
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
  }): Promise<{ success: boolean; error?: string; appointment?: Appointment }> => {
    if (!currentUser) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const conflict = checkSlotConflict(appointments, {
      psychologistId: data.psychologistId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      roomId: data.roomId
    }, 10);

    if (conflict.hasConflict) {
      return { success: false, error: conflict.reason };
    }

    const newApp: Appointment = {
      id: `app_${Date.now()}`,
      psychologistId: data.psychologistId,
      patientId: data.patientId,
      patientUserId: currentUser.role === 'patient' ? currentUser.uid : undefined,
      patientName: data.patientName,
      patientPhone: data.patientPhone || '',
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes: data.durationMinutes,
      status: 'pending',
      price: data.price,
      paymentStatus: 'pending',
      roomId: data.roomId,
      notes: data.notes,
      requestedBy: currentUser.role === 'patient' ? 'patient' : 'psychologist',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };


    try {
      // REQUIREMENT 5: Persist in Firestore first before confirming success
      await persistAppointment(newApp);
      setAppointments(prev => [newApp, ...prev]);

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        recipientUserId: data.psychologistId,
        senderId: currentUser.uid,
        type: 'appointment_request',
        title: 'Nova solicitação de agendamento',
        message: `${data.patientName} solicitou atendimento para ${data.date.split('-').reverse().join('/')} às ${data.startTime}.`,
        link: '/agenda',
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications(prev => [newNotif, ...prev]);
      persistNotification(newNotif).catch(console.error);

      return { success: true, appointment: newApp };
    } catch (err: any) {
      console.error('Falha ao persistir agendamento no Firestore:', err);
      return { success: false, error: 'Falha na comunicação com o banco de dados Firestore. O agendamento não foi gravado.' };
    }
  };

  const confirmAppointment = async (appointmentId: string): Promise<{ success: boolean; error?: string }> => {
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

    const updated: Appointment = {
      ...target,
      status: 'confirmed',
      updatedAt: new Date().toISOString()
    };

    try {
      await persistAppointment(updated);
      setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));

      if (target.patientUserId) {
        const notif: AppNotification = {
          id: `notif_${Date.now()}`,
          recipientUserId: target.patientUserId,
          senderId: currentUser?.uid,
          type: 'appointment_confirmed',
          title: 'Consulta Confirmada!',
          message: `Seu agendamento para ${target.date.split('-').reverse().join('/')} às ${target.startTime} foi confirmado pelo psicólogo.`,
          link: '/meus-agendamentos',
          read: false,
          createdAt: new Date().toISOString()
        };
        setNotifications(prev => [notif, ...prev]);
        persistNotification(notif).catch(console.error);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Falha ao atualizar confirmação no Firestore:', err);
      return { success: false, error: 'Erro ao confirmar agendamento no Firestore.' };
    }
  };

  const rejectAppointment = async (appointmentId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'rejected')) {
      return { success: false, error: 'Não é possível recusar este agendamento no estado atual.' };
    }

    const updated: Appointment = {
      ...target,
      status: 'rejected',
      cancellationReason: reason || 'Horário indisponível no momento.',
      updatedAt: new Date().toISOString()
    };

    try {
      await persistAppointment(updated);
      setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));

      if (target.patientUserId) {
        const notif: AppNotification = {
          id: `notif_${Date.now()}`,
          recipientUserId: target.patientUserId,
          senderId: currentUser?.uid,
          type: 'appointment_rejected',
          title: 'Solicitação de agendamento não aceita',
          message: `Infelizmente seu pedido para ${target.date.split('-').reverse().join('/')} às ${target.startTime} não pôde ser aceito. Motivo: ${reason || 'Indisponibilidade de agenda.'}`,
          link: '/agendar',
          read: false,
          createdAt: new Date().toISOString()
        };
        setNotifications(prev => [notif, ...prev]);
        persistNotification(notif).catch(console.error);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Falha ao rejeitar agendamento no Firestore:', err);
      return { success: false, error: 'Erro ao registrar recusa de agendamento no Firestore.' };
    }
  };

  const cancelAppointment = async (appointmentId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'cancelled')) {
      return { success: false, error: 'Agendamento não pode ser cancelado no estado atual.' };
    }

    const updated: Appointment = {
      ...target,
      status: 'cancelled',
      cancellationReason: reason || 'Cancelado.',
      updatedAt: new Date().toISOString()
    };

    try {
      await persistAppointment(updated);
      setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));
      return { success: true };
    } catch (err: any) {
      console.error('Falha ao cancelar agendamento no Firestore:', err);
      return { success: false, error: 'Erro ao registrar cancelamento no Firestore.' };
    }
  };

  const completeAppointment = async (appointmentId: string): Promise<{ success: boolean; error?: string }> => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    const updated: Appointment = {
      ...target,
      status: 'completed',
      updatedAt: new Date().toISOString()
    };

    try {
      await persistAppointment(updated);
      setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));

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
          await persistPayment(newPay);
          setPayments(prev => [newPay, ...prev]);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('Falha ao concluir agendamento no Firestore:', err);
      return { success: false, error: 'Erro ao registrar conclusão no Firestore.' };
    }
  };

  const markNoShow = async (appointmentId: string): Promise<{ success: boolean; error?: string }> => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    const updated: Appointment = {
      ...target,
      status: 'no_show',
      updatedAt: new Date().toISOString()
    };

    try {
      await persistAppointment(updated);
      setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));
      return { success: true };
    } catch (err: any) {
      console.error('Falha ao marcar ausência no Firestore:', err);
      return { success: false, error: 'Erro ao registrar ausência no Firestore.' };
    }
  };

  // Patients
  const addPatient = async (patientData: Omit<Patient, 'id' | 'createdAt'>): Promise<{ success: boolean; error?: string; patient?: Patient }> => {
    if (!currentUser) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const newPatient: Patient = {
      ...patientData,
      id: `pat_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    try {
      await persistPatient(newPatient);
      setPatients(prev => [newPatient, ...prev]);
      return { success: true, patient: newPatient };
    } catch (err: any) {
      console.error('Falha ao persistir paciente no Firestore:', err);
      return { success: false, error: 'Erro ao salvar paciente no Firestore.' };
    }
  };

  const updatePatient = async (id: string, updates: Partial<Patient>): Promise<{ success: boolean; error?: string }> => {
    const target = patients.find(p => p.id === id);
    if (!target) return { success: false, error: 'Paciente não encontrado.' };

    const updated: Patient = { ...target, ...updates };
    try {
      await persistPatient(updated);
      setPatients(prev => prev.map(p => p.id === id ? updated : p));
      return { success: true };
    } catch (err: any) {
      console.error('Falha ao atualizar paciente no Firestore:', err);
      return { success: false, error: 'Erro ao atualizar paciente no Firestore.' };
    }
  };

  // Clinical Records (STRICT ACCESS CONTROL & AUDIT LOGGING)
  // REQUIREMENT 3: Only the psychologist responsible for care can add records.
  const addClinicalRecord = async (
    recordData: Omit<ClinicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'isConfidential'>
  ): Promise<{ success: boolean; error?: string; record?: ClinicalRecord }> => {
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

    try {
      // REQUIREMENT 5: Await Firestore persistence before confirming to UI
      await persistClinicalRecord(newRecord);
      setClinicalRecords(prev => [newRecord, ...prev]);

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
      persistAuditLog(log).catch(console.error);

      return { success: true, record: newRecord };
    } catch (err: any) {
      console.error('Falha ao gravar prontuário no Firestore:', err);
      return { success: false, error: 'Erro ao gravar prontuário no Firestore. Registro não salvo.' };
    }
  };

  // REQUIREMENT 3: Strictly enforce that only the treating psychologist can read clinical records.
  // Superadmin, clinic managers, and patients are STRICTLY DENIED access.
  const getPatientClinicalRecords = (patientId: string): ClinicalRecord[] => {
    if (!currentUser || currentUser.role !== 'psychologist') {
      return [];
    }

    const records = clinicalRecords.filter(r => r.patientId === patientId && r.psychologistId === currentUser.uid);
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
      persistAuditLog(log).catch(console.error);
    }

    return records;
  };

  // Finance
  const addPayment = async (paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<{ success: boolean; error?: string; payment?: PaymentRecord }> => {
    const newPay: PaymentRecord = {
      ...paymentData,
      id: `pay_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    try {
      await persistPayment(newPay);
      setPayments(prev => [newPay, ...prev]);
      return { success: true, payment: newPay };
    } catch (err: any) {
      console.error('Falha ao salvar pagamento no Firestore:', err);
      return { success: false, error: 'Erro ao registrar pagamento no Firestore.' };
    }
  };

  const updatePaymentStatus = async (
    id: string,
    status: 'paid' | 'pending' | 'overdue',
    method?: 'pix' | 'cash' | 'card' | 'transfer'
  ): Promise<{ success: boolean; error?: string }> => {
    const target = payments.find(p => p.id === id);
    if (!target) return { success: false, error: 'Registro de pagamento não encontrado.' };

    const updated: PaymentRecord = {
      ...target,
      status,
      method: method || target.method,
      paidAt: status === 'paid' ? new Date().toISOString() : target.paidAt
    };

    try {
      await persistPayment(updated);
      setPayments(prev => prev.map(p => p.id === id ? updated : p));
      return { success: true };
    } catch (err: any) {
      console.error('Falha ao atualizar pagamento no Firestore:', err);
      return { success: false, error: 'Erro ao atualizar pagamento no Firestore.' };
    }
  };

  const addExpense = async (expenseData: Omit<ExpenseRecord, 'id'>): Promise<{ success: boolean; error?: string; expense?: ExpenseRecord }> => {
    const newExpense: ExpenseRecord = {
      ...expenseData,
      id: `exp_${Date.now()}`
    };
    try {
      await persistExpense(newExpense);
      setExpenses(prev => [newExpense, ...prev]);
      return { success: true, expense: newExpense };
    } catch (err: any) {
      console.error('Falha ao salvar despesa no Firestore:', err);
      return { success: false, error: 'Erro ao registrar despesa no Firestore.' };
    }
  };

  // Rooms
  const addRoom = async (roomData: Omit<ClinicRoom, 'id'>): Promise<{ success: boolean; error?: string; room?: ClinicRoom }> => {
    const newRoom: ClinicRoom = {
      ...roomData,
      id: `room_${Date.now()}`
    };
    try {
      await persistRoom(newRoom);
      setRooms(prev => [...prev, newRoom]);
      return { success: true, room: newRoom };
    } catch (err: any) {
      console.error('Falha ao registrar sala no Firestore:', err);
      return { success: false, error: 'Erro ao registrar consultório no Firestore.' };
    }
  };

  const updateRoom = async (id: string, updates: Partial<ClinicRoom>): Promise<{ success: boolean; error?: string }> => {
    const target = rooms.find(r => r.id === id);
    if (!target) return { success: false, error: 'Consultório não encontrado.' };

    const updated: ClinicRoom = { ...target, ...updates };
    try {
      await persistRoom(updated);
      setRooms(prev => prev.map(r => r.id === id ? updated : r));
      return { success: true };
    } catch (err: any) {
      console.error('Falha ao atualizar sala no Firestore:', err);
      return { success: false, error: 'Erro ao atualizar consultório no Firestore.' };
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        authLoading,
        persistenceError,
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
        clearPersistenceError,
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
