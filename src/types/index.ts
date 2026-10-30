export type UserRole = 'superadmin' | 'psychologist' | 'clinic_manager' | 'patient';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  clinicId?: string;
  professionalId?: string;
  avatarUrl?: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface Professional {
  id: string;
  userId: string;
  name: string;
  crp: string;
  email: string;
  phone: string;
  bio: string;
  specialities: string[];
  sessionDurationMinutes: number;
  sessionPrice: number;
  clinicIds: string[];
  status: 'active' | 'inactive';
  photoUrl?: string;
}

export interface Clinic {
  id: string;
  name: string;
  tradeName?: string;
  cnpj?: string;
  ownerId: string;
  phone: string;
  email: string;
  address: string;
  status: 'active' | 'suspended';
  roomsCount: number;
  professionalsCount: number;
  createdAt: string;
}

export interface ClinicRoom {
  id: string;
  clinicId: string;
  name: string;
  description?: string;
  color: string;
  active: boolean;
}

export interface Patient {
  id: string;
  userId?: string;
  psychologistId: string;
  clinicId?: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  cpf?: string;
  emergencyContact?: string;
  status: 'active' | 'archived';
  startDate: string;
  notes?: string;
  createdAt: string;
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'cancellation_requested'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface Appointment {
  id: string;
  psychologistId: string;
  psychologistName?: string;
  patientId: string;
  patientName: string;
  patientUserId?: string;
  patientPhone?: string;
  clinicId?: string;
  roomId?: string;
  roomName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  status: AppointmentStatus;
  price: number;
  paymentStatus: 'pending' | 'paid';
  paymentMethod?: 'pix' | 'cash' | 'card' | 'transfer';
  notes?: string;
  cancellationReason?: string;
  requestedBy: 'patient' | 'psychologist' | 'clinic';
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalRecord {
  id: string;
  psychologistId: string;
  patientId: string;
  appointmentId?: string;
  sessionDate: string;
  sessionNumber: number;
  complaint?: string;
  evolutionNotes: string;
  privateNotes?: string;
  diagnosticHypothesis?: string;
  conductPlan?: string;
  isConfidential: true;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface PaymentRecord {
  id: string;
  psychologistId: string;
  clinicId?: string;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  amount: number;
  method: 'pix' | 'cash' | 'card' | 'transfer';
  status: 'paid' | 'pending' | 'overdue';
  dueDate: string;
  paidAt?: string;
  description: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  psychologistId?: string;
  clinicId?: string;
  title: string;
  category: 'rent' | 'software' | 'materials' | 'marketing' | 'taxes' | 'other';
  amount: number;
  date: string;
  status: 'paid' | 'pending';
  paymentMethod?: string;
  notes?: string;
}

export interface SubscriptionPlan {
  id: 'individual' | 'professional' | 'clinic';
  name: string;
  priceMonthly: number;
  description: string;
  maxProfessionals: number;
  maxPatients: number;
  features: string[];
  popular?: boolean;
}

export interface UserSubscription {
  id: string;
  targetId: string; // userId or clinicId
  planId: 'individual' | 'professional' | 'clinic';
  planName: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled';
  priceMonthly: number;
  currentPeriodEnd: string;
  trialEnd?: string;
  patientCount: number;
  professionalCount: number;
}

export interface AppNotification {
  id: string;
  recipientUserId: string;
  senderId?: string;
  type: 'appointment_request' | 'appointment_confirmed' | 'appointment_rejected' | 'cancellation_requested' | 'cancellation_confirmed' | 'payment_received' | 'system';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: 'read_clinical_record' | 'create_clinical_record' | 'update_clinical_record' | 'cancel_appointment' | 'role_change';
  targetCollection: string;
  targetId: string;
  details: string;
}

export interface WeeklyScheduleDay {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isWorking: boolean;
  intervals: { start: string; end: string }[];
}

export interface AvailabilityConfig {
  psychologistId: string;
  weeklySchedule: WeeklyScheduleDay[];
  slotDurationMinutes: number;
  bufferMinutes: number;
  blockedDates: string[]; // YYYY-MM-DD
}
