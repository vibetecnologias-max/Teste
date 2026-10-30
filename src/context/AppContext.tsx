import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
import { checkSlotConflict, isValidAppointmentTransition, canAccessClinicalRecord } from '../utils/rules';
import { testConnection } from '../firebase/config';

interface AppContextType {
  currentUser: UserProfile;
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
  // Clinical records
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

const STORAGE_KEY = 'projeto_psi_state_v1';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Test Firebase connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  // Initialize state with localStorage if available, otherwise seed data
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    return SEED_USERS[0]; // Dr. Marcos (psychologist) by default
  });

  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_patients`);
    return saved ? JSON.parse(saved) : SEED_PATIENTS;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_appointments`);
    return saved ? JSON.parse(saved) : SEED_APPOINTMENTS;
  });

  const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_clinical_records`);
    return saved ? JSON.parse(saved) : SEED_CLINICAL_RECORDS;
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_payments`);
    return saved ? JSON.parse(saved) : SEED_PAYMENTS;
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_expenses`);
    return saved ? JSON.parse(saved) : SEED_EXPENSES;
  });

  const [rooms, setRooms] = useState<ClinicRoom[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_rooms`);
    return saved ? JSON.parse(saved) : SEED_ROOMS;
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_notifications`);
    return saved ? JSON.parse(saved) : SEED_NOTIFICATIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_audit_logs`);
    return saved ? JSON.parse(saved) : SEED_AUDIT_LOGS;
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_patients`, JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_appointments`, JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_clinical_records`, JSON.stringify(clinicalRecords));
  }, [clinicalRecords]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_payments`, JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_expenses`, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_rooms`, JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_notifications`, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_audit_logs`, JSON.stringify(auditLogs));
  }, [auditLogs]);

  const switchUserRole = (role: UserRole) => {
    const found = SEED_USERS.find(u => u.role === role);
    if (found) {
      setCurrentUser(found);
    }
  };

  const currentProfessional = SEED_PROFESSIONALS.find(p => p.userId === currentUser.uid);
  const currentClinic = SEED_CLINICS.find(c => c.id === currentUser.clinicId || c.ownerId === currentUser.uid);

  // Unread notifications for current user
  const unreadCount = notifications.filter(n => n.recipientUserId === currentUser.uid && !n.read).length;

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => n.recipientUserId === currentUser.uid ? { ...n, read: true } : n));
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
      patientUserId: currentUser.role === 'patient' ? currentUser.uid : undefined,
      patientPhone: data.patientPhone || '(11) 99999-0000',
      clinicId: professional?.clinicIds[0] || 'clinic_mente_viva',
      roomId: data.roomId,
      roomName: room?.name,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes: data.durationMinutes,
      status: 'pending', // Rule: starts pending approval
      price: data.price,
      paymentStatus: 'pending',
      notes: data.notes || 'Solicitação de agendamento.',
      requestedBy: currentUser.role === 'patient' ? 'patient' : 'psychologist',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setAppointments(prev => [newApp, ...prev]);

    // Send notification to the psychologist
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

    return { success: true, appointment: newApp };
  };

  const confirmAppointment = (appointmentId: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'confirmed')) {
      return { success: false, error: `Transição inválida de ${target.status} para confirmado.` };
    }

    // Double check conflict before confirming
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

    setAppointments(prev => prev.map(a => a.id === appointmentId ? {
      ...a,
      status: 'confirmed',
      updatedAt: new Date().toISOString()
    } : a));

    // Notify patient
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
    }

    return { success: true };
  };

  const rejectAppointment = (appointmentId: string, reason?: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'rejected')) {
      return { success: false, error: 'Não é possível recusar este agendamento no estado atual.' };
    }

    setAppointments(prev => prev.map(a => a.id === appointmentId ? {
      ...a,
      status: 'rejected',
      cancellationReason: reason || 'Horário indisponível no momento.',
      updatedAt: new Date().toISOString()
    } : a));

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
    }

    return { success: true };
  };

  const cancelAppointment = (appointmentId: string, reason?: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'cancelled')) {
      return { success: false, error: 'Agendamento não pode ser cancelado no estado atual.' };
    }

    setAppointments(prev => prev.map(a => a.id === appointmentId ? {
      ...a,
      status: 'cancelled',
      cancellationReason: reason || 'Cancelado pelo usuário.',
      updatedAt: new Date().toISOString()
    } : a));

    return { success: true };
  };

  const completeAppointment = (appointmentId: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    if (!isValidAppointmentTransition(target.status, 'completed')) {
      return { success: false, error: 'Transição inválida para concluído.' };
    }

    setAppointments(prev => prev.map(a => a.id === appointmentId ? {
      ...a,
      status: 'completed',
      updatedAt: new Date().toISOString()
    } : a));

    // Also auto-generate payment pending record if not paid
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
      }
    }

    return { success: true };
  };

  const markNoShow = (appointmentId: string) => {
    const target = appointments.find(a => a.id === appointmentId);
    if (!target) return { success: false, error: 'Agendamento não encontrado.' };

    setAppointments(prev => prev.map(a => a.id === appointmentId ? {
      ...a,
      status: 'no_show',
      updatedAt: new Date().toISOString()
    } : a));

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
    return newPatient;
  };

  const updatePatient = (id: string, updates: Partial<Patient>) => {
    setPatients(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  // Clinical Records (STRICT ACCESS CONTROL & AUDIT LOGGING)
  const addClinicalRecord = (recordData: Omit<ClinicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'isConfidential'>) => {
    // Check permission: Only treating psychologist or superadmin
    if (!canAccessClinicalRecord({ uid: currentUser.uid, role: currentUser.role }, { psychologistId: recordData.psychologistId })) {
      return { success: false, error: 'Acesso negado: apenas o psicólogo responsável possui autorização para criar ou registrar anotações clínicas.' };
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

    return { success: true, record: newRecord };
  };

  const getPatientClinicalRecords = (patientId: string): ClinicalRecord[] => {
    // If not superadmin or the treating psychologist, return EMPTY (security enforcement)
    if (currentUser.role === 'clinic_manager' || currentUser.role === 'patient') {
      return [];
    }

    // Record audit log for viewing records
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
    return newPay;
  };

  const updatePaymentStatus = (id: string, status: 'paid' | 'pending' | 'overdue', method?: 'pix' | 'cash' | 'card' | 'transfer') => {
    setPayments(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status,
          method: method || p.method,
          paidAt: status === 'paid' ? new Date().toISOString() : p.paidAt
        };
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
    return newExpense;
  };

  // Rooms
  const addRoom = (roomData: Omit<ClinicRoom, 'id'>) => {
    const newRoom: ClinicRoom = {
      ...roomData,
      id: `room_${Date.now()}`
    };
    setRooms(prev => [...prev, newRoom]);
    return newRoom;
  };

  const updateRoom = (id: string, updates: Partial<ClinicRoom>) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
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
