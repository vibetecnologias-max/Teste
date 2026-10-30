import {
  UserProfile,
  Professional,
  Clinic,
  ClinicRoom,
  Patient,
  Appointment,
  ClinicalRecord,
  PaymentRecord,
  ExpenseRecord,
  SubscriptionPlan,
  UserSubscription,
  AppNotification,
  AuditLog,
  AvailabilityConfig
} from '../types';

export const SEED_USERS: UserProfile[] = [
  {
    uid: 'psy_marcos_01',
    email: 'marcos.vinicius@psicologia.com.br',
    displayName: 'Dr. Marcos Vinícius Silveira',
    role: 'psychologist',
    phone: '(11) 98765-4321',
    professionalId: 'prof_marcos_01',
    clinicId: 'clinic_mente_viva',
    avatarUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=256&q=80',
    status: 'active',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z'
  },
  {
    uid: 'manager_beatriz_02',
    email: 'beatriz.lima@menteviva.med.br',
    displayName: 'Dra. Beatriz Mendes de Lima',
    role: 'clinic_manager',
    phone: '(11) 97654-3210',
    clinicId: 'clinic_mente_viva',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
    status: 'active',
    createdAt: '2026-01-05T09:00:00Z',
    updatedAt: '2026-10-15T11:00:00Z'
  },
  {
    uid: 'pat_juliana_03',
    email: 'juliana.prado@gmail.com',
    displayName: 'Juliana Prado Albuquerque',
    role: 'patient',
    phone: '(11) 99123-8877',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
    status: 'active',
    createdAt: '2026-02-01T14:30:00Z',
    updatedAt: '2026-10-28T09:00:00Z'
  },
  {
    uid: 'admin_master_04',
    email: 'admin@projetopsi.com.br',
    displayName: 'Suporte & Governança Projeto Psi',
    role: 'superadmin',
    phone: '(11) 3000-8800',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z'
  }
];

export const SEED_PROFESSIONALS: Professional[] = [
  {
    id: 'prof_marcos_01',
    userId: 'psy_marcos_01',
    name: 'Dr. Marcos Vinícius Silveira',
    crp: 'CRP 06/142981-SP',
    email: 'marcos.vinicius@psicologia.com.br',
    phone: '(11) 98765-4321',
    bio: 'Especialista em Terapia Cognitivo-Comportamental (TCC) e Psicopatologia Clínica pelo Instituto de Psiquiatria da USP. Atendimento a adultos com foco em transtornos de ansiedade, estresse ocupacional e depressão.',
    specialities: ['Terapia Cognitivo-Comportamental', 'Ansiedade e Fobias', 'Burnout', 'Adultos e Casais'],
    sessionDurationMinutes: 50,
    sessionPrice: 190,
    clinicIds: ['clinic_mente_viva'],
    status: 'active',
    photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'prof_camila_02',
    userId: 'psy_camila_02',
    name: 'Dra. Camila Duarte Rabelo',
    crp: 'CRP 06/168340-SP',
    email: 'camila.rabelo@menteviva.med.br',
    phone: '(11) 98822-1144',
    bio: 'Psicanalista com foco em desenvolvimento infanto-juvenil e orientação parental. Mestre em Psicologia Clínica pela PUC-SP.',
    specialities: ['Psicanálise', 'Adolescentes', 'Orientação Parental', 'Luto e Perdas'],
    sessionDurationMinutes: 50,
    sessionPrice: 220,
    clinicIds: ['clinic_mente_viva'],
    status: 'active',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80'
  }
];

export const SEED_CLINICS: Clinic[] = [
  {
    id: 'clinic_mente_viva',
    name: 'Clínica Mente Viva Integrada',
    tradeName: 'Espaço Mente Viva',
    cnpj: '38.492.110/0001-44',
    ownerId: 'manager_beatriz_02',
    phone: '(11) 3456-7890',
    email: 'contato@menteviva.med.br',
    address: 'Av. Paulista, 1842 - Cj 114 - Cerqueira César, São Paulo - SP',
    status: 'active',
    roomsCount: 4,
    professionalsCount: 5,
    createdAt: '2026-01-05T09:00:00Z'
  }
];

export const SEED_ROOMS: ClinicRoom[] = [
  { id: 'room_01', clinicId: 'clinic_mente_viva', name: 'Consultório 1 - Acolher', description: 'Poltronas anatômicas, iluminação regulável e isolamento acústico duplo.', color: '#0d9488', active: true },
  { id: 'room_02', clinicId: 'clinic_mente_viva', name: 'Consultório 2 - Harmonia', description: 'Espaço para atendimento individual ou de casais.', color: '#3b82f6', active: true },
  { id: 'room_03', clinicId: 'clinic_mente_viva', name: 'Consultório 3 - Lúdico', description: 'Equipado com mesa infantil, caixa de areia e materiais de arteterapia.', color: '#ec4899', active: true },
  { id: 'room_04', clinicId: 'clinic_mente_viva', name: 'Consultório 4 - Serenidade', description: 'Sala multiúso para avaliações neuropsicológicas e supervisões.', color: '#8b5cf6', active: true }
];

export const SEED_PATIENTS: Patient[] = [
  {
    id: 'pat_01',
    userId: 'pat_juliana_03',
    psychologistId: 'psy_marcos_01',
    clinicId: 'clinic_mente_viva',
    name: 'Juliana Prado Albuquerque',
    email: 'juliana.prado@gmail.com',
    phone: '(11) 99123-8877',
    birthDate: '1992-05-14',
    cpf: '321.654.987-00',
    emergencyContact: 'Roberto Prado (Pai) - (11) 99887-1122',
    status: 'active',
    startDate: '2026-02-15',
    notes: 'Encaminhada por clínico geral para manejo de ansiedade generalizada e insônia.',
    createdAt: '2026-02-15T10:00:00Z'
  },
  {
    id: 'pat_02',
    psychologistId: 'psy_marcos_01',
    clinicId: 'clinic_mente_viva',
    name: 'Thiago Martins Ferreira',
    email: 'thiago.ferreira@outlook.com',
    phone: '(11) 98765-1122',
    birthDate: '1988-11-20',
    cpf: '456.789.123-45',
    emergencyContact: 'Marina Ferreira (Esposa) - (11) 98765-3344',
    status: 'active',
    startDate: '2026-03-01',
    notes: 'Acompanhamento para manejo de sobrecarga de trabalho e sintomas de Burnout.',
    createdAt: '2026-03-01T14:00:00Z'
  },
  {
    id: 'pat_03',
    psychologistId: 'psy_marcos_01',
    clinicId: 'clinic_mente_viva',
    name: 'Mariana Costa Nogueira',
    email: 'mariana.nogueira@uol.com.br',
    phone: '(11) 97112-9988',
    birthDate: '1995-08-03',
    cpf: '123.456.789-88',
    emergencyContact: 'Clara Costa (Irmã) - (11) 97112-4455',
    status: 'active',
    startDate: '2026-04-10',
    notes: 'Demanda sobre transição de carreira e autoconhecimento.',
    createdAt: '2026-04-10T16:00:00Z'
  },
  {
    id: 'pat_04',
    psychologistId: 'psy_marcos_01',
    clinicId: 'clinic_mente_viva',
    name: 'Carlos Eduardo Ramos',
    email: 'cadu.ramos@gmail.com',
    phone: '(11) 96554-2211',
    birthDate: '1982-01-30',
    cpf: '789.123.456-11',
    emergencyContact: 'Fernanda Ramos (Irmã) - (11) 96554-9988',
    status: 'archived',
    startDate: '2026-01-15',
    notes: 'Tratamento concluído com alta acordada em comum acordo.',
    createdAt: '2026-01-15T11:00:00Z'
  }
];

export const SEED_APPOINTMENTS: Appointment[] = [
  {
    id: 'app_01',
    psychologistId: 'psy_marcos_01',
    psychologistName: 'Dr. Marcos Vinícius Silveira',
    patientId: 'pat_01',
    patientName: 'Juliana Prado Albuquerque',
    patientUserId: 'pat_juliana_03',
    patientPhone: '(11) 99123-8877',
    clinicId: 'clinic_mente_viva',
    roomId: 'room_01',
    roomName: 'Consultório 1 - Acolher',
    date: '2026-10-30',
    startTime: '09:00',
    endTime: '09:50',
    durationMinutes: 50,
    status: 'confirmed',
    price: 190,
    paymentStatus: 'paid',
    paymentMethod: 'pix',
    notes: 'Sessão 12 - Revisão de registro de pensamentos disfuncionais.',
    requestedBy: 'psychologist',
    createdAt: '2026-10-23T10:00:00Z',
    updatedAt: '2026-10-23T10:00:00Z'
  },
  {
    id: 'app_02',
    psychologistId: 'psy_marcos_01',
    psychologistName: 'Dr. Marcos Vinícius Silveira',
    patientId: 'pat_02',
    patientName: 'Thiago Martins Ferreira',
    patientPhone: '(11) 98765-1122',
    clinicId: 'clinic_mente_viva',
    roomId: 'room_01',
    roomName: 'Consultório 1 - Acolher',
    date: '2026-10-30',
    startTime: '10:00',
    endTime: '10:50',
    durationMinutes: 50,
    status: 'confirmed',
    price: 190,
    paymentStatus: 'pending',
    notes: 'Sessão 08 - Definição de limites interpessoais no ambiente profissional.',
    requestedBy: 'psychologist',
    createdAt: '2026-10-24T11:00:00Z',
    updatedAt: '2026-10-24T11:00:00Z'
  },
  {
    id: 'app_03',
    psychologistId: 'psy_marcos_01',
    psychologistName: 'Dr. Marcos Vinícius Silveira',
    patientId: 'pat_01',
    patientName: 'Juliana Prado Albuquerque',
    patientUserId: 'pat_juliana_03',
    patientPhone: '(11) 99123-8877',
    clinicId: 'clinic_mente_viva',
    roomId: 'room_01',
    roomName: 'Consultório 1 - Acolher',
    date: '2026-11-02',
    startTime: '14:00',
    endTime: '14:50',
    durationMinutes: 50,
    status: 'pending',
    price: 190,
    paymentStatus: 'pending',
    notes: 'Solicitação enviada pela paciente Juliana via Portal do Paciente.',
    requestedBy: 'patient',
    createdAt: '2026-10-28T16:20:00Z',
    updatedAt: '2026-10-28T16:20:00Z'
  },
  {
    id: 'app_04',
    psychologistId: 'psy_marcos_01',
    psychologistName: 'Dr. Marcos Vinícius Silveira',
    patientId: 'pat_03',
    patientName: 'Mariana Costa Nogueira',
    patientPhone: '(11) 97112-9988',
    clinicId: 'clinic_mente_viva',
    roomId: 'room_02',
    roomName: 'Consultório 2 - Harmonia',
    date: '2026-10-27',
    startTime: '15:00',
    endTime: '15:50',
    durationMinutes: 50,
    status: 'completed',
    price: 190,
    paymentStatus: 'paid',
    paymentMethod: 'card',
    notes: 'Sessão realizada normalmente.',
    requestedBy: 'psychologist',
    createdAt: '2026-10-20T09:00:00Z',
    updatedAt: '2026-10-27T16:00:00Z'
  },
  {
    id: 'app_05',
    psychologistId: 'psy_marcos_01',
    psychologistName: 'Dr. Marcos Vinícius Silveira',
    patientId: 'pat_02',
    patientName: 'Thiago Martins Ferreira',
    patientPhone: '(11) 98765-1122',
    clinicId: 'clinic_mente_viva',
    roomId: 'room_01',
    roomName: 'Consultório 1 - Acolher',
    date: '2026-10-20',
    startTime: '10:00',
    endTime: '10:50',
    durationMinutes: 50,
    status: 'no_show',
    price: 190,
    paymentStatus: 'pending',
    notes: 'Paciente justificou posteriormente imprevisto no trânsito.',
    requestedBy: 'psychologist',
    createdAt: '2026-10-13T10:00:00Z',
    updatedAt: '2026-10-20T11:00:00Z'
  }
];

export const SEED_CLINICAL_RECORDS: ClinicalRecord[] = [
  {
    id: 'rec_01',
    psychologistId: 'psy_marcos_01',
    patientId: 'pat_01',
    appointmentId: 'app_01',
    sessionDate: '2026-10-23',
    sessionNumber: 11,
    complaint: 'Crise de ansiedade pré-apresentação no trabalho e padrão de catastrofização.',
    evolutionNotes: 'Paciente compareceu pontualmente. Relatou melhora nos episódios noturnos de taquicardia após aplicação dos exercícios de respiração diafragmática. Discutimos a identificação de distorções cognitivas (leitura mental e catastrofização). Foi pactuado registro de pensamentos automáticos durante a semana.',
    privateNotes: 'Apresenta boa aliança terapêutica. Necessário investigar crença nuclear de incapacidade ligada à cobrança paterna na infância.',
    diagnosticHypothesis: 'F41.1 - Transtorno de ansiedade generalizada (em acompanhamento)',
    conductPlan: 'Manutenção do protocolo de TCC, psicoeducação e treino de reestruturação cognitiva.',
    isConfidential: true,
    createdAt: '2026-10-23T10:15:00Z',
    updatedAt: '2026-10-23T10:15:00Z',
    createdBy: 'Dr. Marcos Vinícius Silveira'
  },
  {
    id: 'rec_02',
    psychologistId: 'psy_marcos_01',
    patientId: 'pat_02',
    appointmentId: 'app_04',
    sessionDate: '2026-10-27',
    sessionNumber: 7,
    complaint: 'Esgotamento físico e mental com desmotivação crônica.',
    evolutionNotes: 'Trabalhado o inventário de atividades prazerosas e tempo de desconexão após as 19h. O paciente conseguiu sair no horário em 3 dos 5 dias úteis, reportando redução no nível de estresse subjetivo de 8/10 para 5/10.',
    privateNotes: 'Resistência em delegar tarefas para subordinados por medo de perda de controle.',
    diagnosticHypothesis: 'Z73.0 - Estado de exaustão vital (Burnout)',
    conductPlan: 'Treinamento de assertividade e plano de contingência para finais de semana.',
    isConfidential: true,
    createdAt: '2026-10-27T16:10:00Z',
    updatedAt: '2026-10-27T16:10:00Z',
    createdBy: 'Dr. Marcos Vinícius Silveira'
  }
];

export const SEED_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay_01',
    psychologistId: 'psy_marcos_01',
    clinicId: 'clinic_mente_viva',
    patientId: 'pat_01',
    patientName: 'Juliana Prado Albuquerque',
    amount: 190,
    method: 'pix',
    status: 'paid',
    dueDate: '2026-10-23',
    paidAt: '2026-10-23T09:45:00Z',
    description: 'Sessão de Psicoterapia #11',
    createdAt: '2026-10-23T09:00:00Z'
  },
  {
    id: 'pay_02',
    psychologistId: 'psy_marcos_01',
    clinicId: 'clinic_mente_viva',
    patientId: 'pat_03',
    patientName: 'Mariana Costa Nogueira',
    amount: 190,
    method: 'card',
    status: 'paid',
    dueDate: '2026-10-27',
    paidAt: '2026-10-27T15:55:00Z',
    description: 'Sessão de Psicoterapia #09',
    createdAt: '2026-10-27T15:00:00Z'
  },
  {
    id: 'pay_03',
    psychologistId: 'psy_marcos_01',
    clinicId: 'clinic_mente_viva',
    patientId: 'pat_02',
    patientName: 'Thiago Martins Ferreira',
    amount: 190,
    method: 'pix',
    status: 'pending',
    dueDate: '2026-10-30',
    description: 'Sessão de Psicoterapia #08',
    createdAt: '2026-10-24T11:00:00Z'
  },
  {
    id: 'pay_04',
    psychologistId: 'psy_marcos_01',
    clinicId: 'clinic_mente_viva',
    patientId: 'pat_02',
    patientName: 'Thiago Martins Ferreira',
    amount: 190,
    method: 'transfer',
    status: 'overdue',
    dueDate: '2026-10-20',
    description: 'Taxa de sessão com falta não justificada com 24h de antecedência',
    createdAt: '2026-10-20T12:00:00Z'
  }
];

export const SEED_EXPENSES: ExpenseRecord[] = [
  {
    id: 'exp_01',
    psychologistId: 'psy_marcos_01',
    clinicId: 'clinic_mente_viva',
    title: 'Locação Consultório (Clínica Mente Viva)',
    category: 'rent',
    amount: 850,
    date: '2026-10-05',
    status: 'paid',
    paymentMethod: 'Pix'
  },
  {
    id: 'exp_02',
    psychologistId: 'psy_marcos_01',
    title: 'Supervisão Clínica Especializada TCC',
    category: 'other',
    amount: 350,
    date: '2026-10-15',
    status: 'paid',
    paymentMethod: 'Transferência'
  },
  {
    id: 'exp_03',
    psychologistId: 'psy_marcos_01',
    title: 'Assinatura Plataforma SaaS Projeto Psi',
    category: 'software',
    amount: 69,
    date: '2026-10-20',
    status: 'paid',
    paymentMethod: 'Cartão'
  }
];

export const SEED_PLANS: SubscriptionPlan[] = [
  {
    id: 'individual',
    name: 'Autônomo Pro',
    priceMonthly: 69,
    description: 'Ideal para psicólogos que atendem em consultório particular ou online.',
    maxProfessionals: 1,
    maxPatients: 60,
    features: [
      'Agenda inteligente com prevenção de choques',
      'Portal do Paciente com solicitação de horários',
      'Prontuário eletrônico confidencial com criptografia e LGPD',
      'Controle financeiro completo (Pix, Cartão, Dinheiro)',
      'Notificações in-app automáticas',
      'Suporte prioritário via WhatsApp'
    ]
  },
  {
    id: 'professional',
    name: 'Consultório Avançado',
    priceMonthly: 129,
    popular: true,
    description: 'Para profissionais com alto volume de atendimentos e múltiplos vínculos.',
    maxProfessionals: 2,
    maxPatients: 200,
    features: [
      'Tudo do plano Autônomo',
      'Pacientes e prontuários ilimitados',
      'Configuração de múltiplos locais de atendimento',
      'Relatórios financeiros consolidados e DRE',
      'Trilha de auditoria completa para conformidade CFP',
      'Backup automático com retenção prolongada'
    ]
  },
  {
    id: 'clinic',
    name: 'Clínica & Equipe',
    priceMonthly: 289,
    description: 'Para clínicas de psicologia com gestão de equipe, salas e múltiplos profissionais.',
    maxProfessionals: 15,
    maxPatients: 2000,
    features: [
      'Múltiplos profissionais com agendas isoladas',
      'Gestão de salas físicas e consultórios',
      'Painel do Gestor Administrativo (sem acesso a prontuários)',
      'Distribuição inteligente de consultas',
      'Gestão multi-tenant completa',
      'Treinamento de onboarding para secretárias e equipe'
    ]
  }
];

export const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_01',
    recipientUserId: 'psy_marcos_01',
    type: 'appointment_request',
    title: 'Nova solicitação de agendamento',
    message: 'Juliana Prado solicitou uma consulta para 02/11 às 14:00.',
    link: '/agenda',
    read: false,
    createdAt: '2026-10-28T16:20:00Z'
  },
  {
    id: 'notif_02',
    recipientUserId: 'psy_marcos_01',
    type: 'payment_received',
    title: 'Pagamento confirmado',
    message: 'Pagamento de R$ 190,00 via Pix confirmado para a paciente Juliana Prado.',
    link: '/financeiro',
    read: true,
    createdAt: '2026-10-23T09:46:00Z'
  },
  {
    id: 'notif_03',
    recipientUserId: 'pat_juliana_03',
    type: 'appointment_confirmed',
    title: 'Consulta confirmada',
    message: 'Seu atendimento com Dr. Marcos Vinícius foi confirmado para 30/10 às 09:00.',
    link: '/meus-agendamentos',
    read: false,
    createdAt: '2026-10-23T10:05:00Z'
  }
];

export const SEED_AVAILABILITY: AvailabilityConfig = {
  psychologistId: 'psy_marcos_01',
  slotDurationMinutes: 50,
  bufferMinutes: 10,
  blockedDates: ['2026-12-25', '2026-12-31', '2027-01-01'],
  weeklySchedule: [
    { dayOfWeek: 0, isWorking: false, intervals: [] }, // Dom
    { dayOfWeek: 1, isWorking: true, intervals: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '18:00' }] }, // Seg
    { dayOfWeek: 2, isWorking: true, intervals: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '18:00' }] }, // Ter
    { dayOfWeek: 3, isWorking: true, intervals: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '18:00' }] }, // Qua
    { dayOfWeek: 4, isWorking: true, intervals: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '18:00' }] }, // Qui
    { dayOfWeek: 5, isWorking: true, intervals: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '16:00' }] }, // Sex
    { dayOfWeek: 6, isWorking: false, intervals: [] } // Sáb
  ]
};

export const SEED_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log_01',
    timestamp: '2026-10-23T10:15:00Z',
    userId: 'psy_marcos_01',
    userEmail: 'marcos.vinicius@psicologia.com.br',
    action: 'create_clinical_record',
    targetCollection: 'clinical_records',
    targetId: 'rec_01',
    details: 'Registro de evolução clínica da sessão #11 da paciente Juliana Prado.'
  },
  {
    id: 'log_02',
    timestamp: '2026-10-27T16:10:00Z',
    userId: 'psy_marcos_01',
    userEmail: 'marcos.vinicius@psicologia.com.br',
    action: 'create_clinical_record',
    targetCollection: 'clinical_records',
    targetId: 'rec_02',
    details: 'Registro de evolução clínica da sessão #07 do paciente Thiago Ferreira.'
  }
];
