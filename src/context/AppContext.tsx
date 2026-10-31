import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, testConnection } from '../firebase/config';
import {
  UserProfile,
  Professional,
  ProfessionalPublic,
  Clinic,
  ClinicRoom,
  Patient,
  Appointment,
  AppointmentStatus,
  ClinicalRecord,
  ClinicalRectification,
  PaymentRecord,
  ExpenseRecord,
  AppNotification,
  AuditLog,
  AvailabilityConfig
} from '../types';
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
  addClinicalRecordRectification,
  persistAuditLog,
  persistPayment,
  persistExpense,
  fetchAppointmentsForUser,
  fetchPatientsForPsychologist,
  fetchClinicalRecordsForPsychologist,
  fetchPayments,
  fetchExpenses,
  fetchRooms,
  persistRoom,
  fetchNotificationsForUser,
  persistNotification,
  updateNotificationInDb,
  fetchAuditLogs,
  sanitizeAuditLog,
  fetchPublicProfessionals,
  fetchProfessionalProfile,
  fetchClinicsForUser,
  fetchAvailabilityForPsychologist,
  persistAvailability
} from '../services/firestoreService';
import { logoutUser, getOrCreateUserProfile } from '../services/authService';

interface AppContextType {
  currentUser: UserProfile | null;
  authLoading: boolean;
  persistenceError: string | null;
  currentProfessional?: Professional | null;
  currentClinic?: Clinic | null;
  allProfessionals: ProfessionalPublic[];
  clinics: Clinic[];
  rooms: ClinicRoom[];
  patients: Patient[];
  appointments: Appointment[];
  clinicalRecords: ClinicalRecord[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  availability: AvailabilityConfig | null;
  isAuthenticated: boolean;
  loginUser: (user: UserProfile) => void;
  logout: () => Promise<void>;
  clearPersistenceError: () => void;
  refreshAuditLogs: () => Promise<void>;
  updateAvailability: (config: AvailabilityConfig) => Promise<{ success: boolean; error?: string }>;
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
  // Clinical records (Strict sigilo & real subcollection rectifications)
  addClinicalRecord: (record: Omit<ClinicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'isConfidential' | 'retifications'>) => Promise<{ success: boolean; error?: string; record?: ClinicalRecord }>;
  retifyClinicalRecord: (
    recordId: string,
    data: { reason: string; content: string } | { retificationNotes: string }
  ) => Promise<{ success: boolean; error?: string }>;
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
  // Initial user MUST be null, established strictly via onAuthStateChanged
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  // REAL PRODUCTION STATE: Initialized strictly empty without seed fallback disguises
  const [allProfessionals, setAllProfessionals] = useState<ProfessionalPublic[]>([]);
  const [currentProfessional, setCurrentProfessional] = useState<Professional | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [availability, setAvailability] = useState<AvailabilityConfig | null>(null);
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
          setPersistenceError(err.message || 'Falha ao autenticar ou carregar perfil no Firestore.');
        } finally {
          setAuthLoading(false);
        }
      } else {
        setCurrentUser(null);
        setCurrentProfessional(null);
        setAllProfessionals([]);
        setClinics([]);
        setAvailability(null);
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
        // 1. General data for all authenticated users
        const [publicProfs, userApps, userRooms, userNotifs, userClinics] = await Promise.all([
          fetchPublicProfessionals(),
          fetchAppointmentsForUser(currentUser.uid, currentUser.role),
          fetchRooms(currentUser.clinicId),
          fetchNotificationsForUser(currentUser.uid),
          fetchClinicsForUser(currentUser.uid, currentUser.role)
        ]);

        if (isMounted) {
          setAllProfessionals(publicProfs);
          setAppointments(userApps);
          setRooms(userRooms);
          setNotifications(userNotifs);
          setClinics(userClinics);
        }

        // 2. Data specific to psychologists (patients, payments, expenses, private profile, availability, real clinical records)
        if (currentUser.role === 'psychologist') {
          const [userPats, userPays, userExps, privProf, userAvail] = await Promise.all([
            fetchPatientsForPsychologist(currentUser.uid),
            fetchPayments(currentUser.uid),
            fetchExpenses(currentUser.uid),
            fetchProfessionalProfile(currentUser.uid),
            fetchAvailabilityForPsychologist(currentUser.uid)
          ]);

          if (isMounted) {
            setPatients(userPats);
            setPayments(userPays);
            setExpenses(userExps);
            setCurrentProfessional(privProf);
            setAvailability(userAvail);
          }

          // Fetch real clinical records eagerly loading subcollection retifications
          try {
            const records = await fetchClinicalRecordsForPsychologist(currentUser.uid);
            if (isMounted) {
              setClinicalRecords(records);
            }
          } catch (recErr: any) {
            console.error('Falha na recuperação dos prontuários clínicos:', recErr);
            if (isMounted) {
              setPersistenceError(`Erro ao carregar prontuários clínicos: ${recErr.message || 'Falha de leitura'}`);
            }
          }
        }

        // 3. Superadmin real audit logs
        if (currentUser.role === 'superadmin') {
          const auditRes = await fetchAuditLogs();
          if (isMounted) {
            if (auditRes.success) {
              setAuditLogs(auditRes.logs);
            } else {
              setPersistenceError(`Aviso de Auditoria: ${auditRes.error || 'Não foi possível sincronizar os registros de auditoria.'}`);
            }
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

  const refreshAuditLogs = async (): Promise<void> => {
    if (!currentUser || currentUser.role !== 'superadmin') return;
    try {
      const auditRes = await fetchAuditLogs();
      if (auditRes.success) {
        setAuditLogs(auditRes.logs);
      } else {
        setPersistenceError(`Aviso de Auditoria: ${auditRes.error || 'Falha ao recarregar trilha de auditoria.'}`);
      }
    } catch {
      setPersistenceError('Erro de conexão ao carregar registros de auditoria.');
    }
  };

  const updateAvailability = async (config: AvailabilityConfig): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.role !== 'psychologist') {
      return { success: false, error: 'Apenas psicólogos podem definir disponibilidade de agenda.' };
    }
    try {
      await persistAvailability(config);
      setAvailability(config);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao persistir horários de disponibilidade no Firestore.' };
    }
  };

  const loginUser = (user: UserProfile) => {
    setCurrentUser(user);
    setAuthLoading(false);
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setCurrentProfessional(null);
    setAllProfessionals([]);
    setClinics([]);
    setAvailability(null);
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

  const currentClinic = currentUser
    ? (clinics.find(c => c.id === currentUser.clinicId || c.ownerId === currentUser.uid) || null)
    : null;

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

    const newAppointment: Appointment = {
      id: `app_${Date.now()}`,
      psychologistId: data.psychologistId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientUserId: currentUser.uid,
      patientPhone: data.patientPhone,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes: data.durationMinutes,
      price: data.price,
      status: 'pending',
      paymentStatus: 'pending',
      requestedBy: 'patient',
      notes: data.notes,
      roomId: data.roomId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await persistAppointment(newAppointment);
      setAppointments(prev => [newAppointment, ...prev]);

      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        recipientUserId: data.psychologistId,
        senderId: currentUser.uid,
        type: 'appointment_request',
        title: 'Nova Solicitação de Agendamento',
        message: `${data.patientName} solicitou uma consulta para o dia ${data.date} às ${data.startTime}.`,
        read: false,
        createdAt: new Date().toISOString()
      };
      persistNotification(notif).catch(console.error);

      return { success: true, appointment: newAppointment };
    } catch (err: any) {
      console.error('Falha ao persistir agendamento no Firestore:', err);
      return { success: false, error: 'Erro ao registrar solicitação no Firestore.' };
    }
  };

  const confirmAppointment = async (appointmentId: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Usuário não autenticado.' };
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'confirmed')) {
      return { success: false, error: 'Transição para status confirmado inválida para este agendamento.' };
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
          senderId: currentUser.uid,
          type: 'appointment_confirmed',
          title: 'Sua Consulta Foi Confirmada',
          message: `Sua sessão de ${target.date} às ${target.startTime} foi confirmada pelo psicólogo.`,
          read: false,
          createdAt: new Date().toISOString()
        };
        persistNotification(notif).catch(console.error);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Falha ao confirmar agendamento no Firestore:', err);
      return { success: false, error: 'Erro ao confirmar agendamento no Firestore.' };
    }
  };

  const rejectAppointment = async (appointmentId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Usuário não autenticado.' };
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'rejected')) {
      return { success: false, error: 'Transição para status rejeitado inválida para este agendamento.' };
    }

    const updated: Appointment = {
      ...target,
      status: 'rejected',
      cancellationReason: reason,
      updatedAt: new Date().toISOString()
    };

    try {
      await persistAppointment(updated);
      setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));

      if (target.patientUserId) {
        const notif: AppNotification = {
          id: `notif_${Date.now()}`,
          recipientUserId: target.patientUserId,
          senderId: currentUser.uid,
          type: 'appointment_rejected',
          title: 'Solicitação de Consulta Recusada',
          message: `A consulta para o dia ${target.date} não pôde ser confirmada.${reason ? ` Motivo: ${reason}` : ''}`,
          read: false,
          createdAt: new Date().toISOString()
        };
        persistNotification(notif).catch(console.error);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Falha ao recusar agendamento no Firestore:', err);
      return { success: false, error: 'Erro ao recusar agendamento no Firestore.' };
    }
  };

  const cancelAppointment = async (appointmentId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Usuário não autenticado.' };
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    const callerRole = currentUser.role === 'psychologist' ? 'psychologist' : 'patient';
    const nextStatus = callerRole === 'patient' && target.status === 'confirmed' ? 'cancellation_requested' : 'cancelled';

    if (!isValidAppointmentTransition(target.status, nextStatus)) {
      return { success: false, error: 'Transição de cancelamento inválida a partir do estado atual.' };
    }

    const updated: Appointment = {
      ...target,
      status: nextStatus,
      cancellationReason: reason || target.cancellationReason,
      updatedAt: new Date().toISOString()
    };

    try {
      await persistAppointment(updated);
      setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));

      const recipientId = callerRole === 'patient' ? target.psychologistId : target.patientUserId;
      if (recipientId) {
        const notif: AppNotification = {
          id: `notif_${Date.now()}`,
          recipientUserId: recipientId,
          senderId: currentUser.uid,
          type: nextStatus === 'cancellation_requested' ? 'cancellation_requested' : 'cancellation_confirmed',
          title: nextStatus === 'cancellation_requested' ? 'Solicitação de Cancelamento' : 'Consulta Cancelada',
          message: `A consulta do dia ${target.date} às ${target.startTime} foi ${nextStatus === 'cancellation_requested' ? 'solicitada para cancelamento' : 'cancelada'}.`,
          read: false,
          createdAt: new Date().toISOString()
        };
        persistNotification(notif).catch(console.error);
      }

      // Record audit log
      const auditLog = sanitizeAuditLog({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        action: 'cancel_appointment',
        eventCode: 'APPOINTMENT_CANCELLED',
        targetCollection: 'appointments',
        targetId: appointmentId,
        metadata: {
          appointmentId,
          patientId: target.patientId,
          reasonCode: reason ? reason.slice(0, 30) : 'Sem motivo',
          previousStatus: target.status,
          newStatus: nextStatus
        }
      });
      setAuditLogs(prev => [auditLog, ...prev]);
      persistAuditLog(auditLog).catch(console.error);

      return { success: true };
    } catch (err: any) {
      console.error('Falha ao cancelar agendamento no Firestore:', err);
      return { success: false, error: 'Erro ao cancelar agendamento no Firestore.' };
    }
  };

  const completeAppointment = async (appointmentId: string): Promise<{ success: boolean; error?: string }> => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'completed')) {
      return { success: false, error: 'Transição para status concluído inválida a partir do estado atual.' };
    }

    const updated: Appointment = {
      ...target,
      status: 'completed',
      updatedAt: new Date().toISOString()
    };

    try {
      await persistAppointment(updated);
      setAppointments(prev => prev.map(a => a.id === appointmentId ? updated : a));

      if (target.paymentStatus === 'pending') {
        const newPay: PaymentRecord = {
          id: `pay_${Date.now()}`,
          psychologistId: target.psychologistId,
          patientId: target.patientId,
          patientName: target.patientName,
          appointmentId: target.id,
          amount: target.price,
          method: 'pix',
          status: 'paid',
          dueDate: target.date,
          paidAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          description: `Sessão de Psicoterapia (${target.date})`
        };
        await persistPayment(newPay);
        setPayments(prev => [newPay, ...prev]);
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
  // Only the treating psychologist responsible for care can add records.
  const addClinicalRecord = async (
    recordData: Omit<ClinicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'isConfidential' | 'retifications'>
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
      createdBy: currentUser.displayName,
      retifications: []
    };

    try {
      await persistClinicalRecord(newRecord);
      setClinicalRecords(prev => [newRecord, ...prev]);

      // Record immutable audit log with structured metadata
      const log: AuditLog = sanitizeAuditLog({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        action: 'create_clinical_record',
        eventCode: 'CLINICAL_RECORD_CREATED',
        targetCollection: 'clinical_records',
        targetId: newRecord.id,
        metadata: {
          patientId: recordData.patientId,
          sessionNumber: recordData.sessionNumber
        }
      });
      setAuditLogs(prev => [log, ...prev]);
      persistAuditLog(log).catch(console.error);

      return { success: true, record: newRecord };
    } catch (err: any) {
      console.error('Falha ao gravar prontuário no Firestore:', err);
      return { success: false, error: 'Erro ao gravar prontuário no Firestore. Registro não salvo.' };
    }
  };

  /**
   * Retifies a clinical record by persisting an audited adendum in the subcollection.
   * Preserves the original clinical record in strict adherence to CFP 01/2009 Art. 12.
   */
  const retifyClinicalRecord = async (
    recordId: string,
    data: { reason: string; content: string } | { retificationNotes: string }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.role !== 'psychologist') {
      return { success: false, error: 'Apenas o psicólogo titular responsável pode retificar anotações.' };
    }
    const target = clinicalRecords.find(r => r.id === recordId);
    if (!target) return { success: false, error: 'Prontuário não encontrado.' };
    if (target.psychologistId !== currentUser.uid) {
      return { success: false, error: 'Acesso negado: o prontuário pertence a outro profissional.' };
    }

    const reason = 'reason' in data && data.reason ? data.reason : 'Retificação clínica';
    const content = 'content' in data && data.content ? data.content : ('retificationNotes' in data ? data.retificationNotes : '');

    try {
      const newRetif = await addClinicalRecordRectification(recordId, {
        recordId,
        psychologistId: currentUser.uid,
        authorId: currentUser.uid,
        authorName: currentUser.displayName,
        timestamp: new Date().toISOString(),
        reason,
        content
      });

      const updatedRecord: ClinicalRecord = {
        ...target,
        retificationNotes: content,
        retifications: [newRetif, ...(target.retifications || [])]
      };

      setClinicalRecords(prev => prev.map(r => r.id === recordId ? updatedRecord : r));

      const log: AuditLog = sanitizeAuditLog({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        action: 'update_clinical_record',
        eventCode: 'CLINICAL_RECORD_RECTIFIED',
        targetCollection: 'clinical_records',
        targetId: recordId,
        metadata: {
          patientId: target.patientId,
          sessionNumber: target.sessionNumber,
          reasonCode: reason.slice(0, 30)
        }
      });
      setAuditLogs(prev => [log, ...prev]);
      persistAuditLog(log).catch(console.error);

      return { success: true };
    } catch (err: any) {
      console.error('Falha ao retificar prontuário no Firestore:', err);
      return { success: false, error: 'Erro ao registrar retificação no Firestore.' };
    }
  };

  // Strictly enforce that only the treating psychologist can read clinical records.
  const getPatientClinicalRecords = (patientId: string): ClinicalRecord[] => {
    if (!currentUser || currentUser.role !== 'psychologist') {
      return [];
    }
    return clinicalRecords.filter(r => r.patientId === patientId && r.psychologistId === currentUser.uid);
  };

  // Finance
  const addPayment = async (paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<{ success: boolean; error?: string; payment?: PaymentRecord }> => {
    if (!currentUser) return { success: false, error: 'Não autenticado.' };

    const newPayment: PaymentRecord = {
      ...paymentData,
      id: `pay_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    try {
      await persistPayment(newPayment);
      setPayments(prev => [newPayment, ...prev]);
      return { success: true, payment: newPayment };
    } catch (err: any) {
      console.error('Falha ao gravar pagamento no Firestore:', err);
      return { success: false, error: 'Erro ao registrar pagamento no Firestore.' };
    }
  };

  const updatePaymentStatus = async (
    id: string,
    status: 'paid' | 'pending' | 'overdue',
    method?: 'pix' | 'cash' | 'card' | 'transfer'
  ): Promise<{ success: boolean; error?: string }> => {
    const target = payments.find(p => p.id === id);
    if (!target) return { success: false, error: 'Registro financeiro não encontrado.' };

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
    if (!currentUser) return { success: false, error: 'Não autenticado.' };

    const newExpense: ExpenseRecord = {
      ...expenseData,
      id: `exp_${Date.now()}`
    };

    try {
      await persistExpense(newExpense);
      setExpenses(prev => [newExpense, ...prev]);
      return { success: true, expense: newExpense };
    } catch (err: any) {
      console.error('Falha ao gravar despesa no Firestore:', err);
      return { success: false, error: 'Erro ao registrar despesa no Firestore.' };
    }
  };

  // Rooms
  const addRoom = async (roomData: Omit<ClinicRoom, 'id'>): Promise<{ success: boolean; error?: string; room?: ClinicRoom }> => {
    if (!currentUser) return { success: false, error: 'Não autenticado.' };

    const newRoom: ClinicRoom = {
      ...roomData,
      id: `room_${Date.now()}`
    };

    try {
      await persistRoom(newRoom);
      setRooms(prev => [newRoom, ...prev]);
      return { success: true, room: newRoom };
    } catch (err: any) {
      console.error('Falha ao gravar sala no Firestore:', err);
      return { success: false, error: 'Erro ao cadastrar sala no Firestore.' };
    }
  };

  const updateRoom = async (id: string, updates: Partial<ClinicRoom>): Promise<{ success: boolean; error?: string }> => {
    const target = rooms.find(r => r.id === id);
    if (!target) return { success: false, error: 'Sala não encontrada.' };

    const updated: ClinicRoom = { ...target, ...updates };
    try {
      await persistRoom(updated);
      setRooms(prev => prev.map(r => r.id === id ? updated : r));
      return { success: true };
    } catch (err: any) {
      console.error('Falha ao atualizar sala no Firestore:', err);
      return { success: false, error: 'Erro ao atualizar sala no Firestore.' };
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
        allProfessionals,
        clinics,
        rooms,
        patients,
        appointments,
        clinicalRecords,
        payments,
        expenses,
        notifications,
        auditLogs,
        availability,
        isAuthenticated: !!currentUser,
        loginUser,
        logout,
        clearPersistenceError,
        refreshAuditLogs,
        updateAvailability,
        requestAppointment,
        confirmAppointment,
        rejectAppointment,
        cancelAppointment,
        completeAppointment,
        markNoShow,
        addPatient,
        updatePatient,
        addClinicalRecord,
        retifyClinicalRecord,
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
