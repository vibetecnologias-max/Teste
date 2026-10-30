import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Patient } from '../../types';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Calendar,
  Clock,
  FileText,
  DollarSign,
  ShieldCheck,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface PatientListViewProps {
  onOpenClinicalRecords?: (patientId: string) => void;
}

export const PatientListView: React.FC<PatientListViewProps> = ({ onOpenClinicalRecords }) => {
  const { patients, addPatient, updatePatient, currentUser, appointments, payments } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('1990-01-01');
  const [cpf, setCpf] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const filteredPatients = patients.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.phone.includes(q);
    }
    return true;
  });

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addPatient({
      psychologistId: currentUser.uid,
      name,
      email,
      phone,
      birthDate,
      cpf,
      emergencyContact,
      startDate,
      status: 'active',
      notes
    });

    setShowNewModal(false);
    // Reset form
    setName('');
    setEmail('');
    setPhone('');
    setCpf('');
    setEmergencyContact('');
    setNotes('');
  };

  const patientAppointments = selectedPatient
    ? appointments.filter(a => a.patientId === selectedPatient.id)
    : [];

  const patientPayments = selectedPatient
    ? payments.filter(p => p.patientId === selectedPatient.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Gestão de Pacientes</h1>
          <p className="text-xs text-slate-500">
            Fichas cadastrais, histórico de atendimentos e separação rigorosa de prontuários
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Paciente</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 text-xs">Status:</span>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${filterStatus === 'all' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
            >
              Todos ({patients.length})
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-2.5 py-1 rounded-md transition-colors ${filterStatus === 'active' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
            >
              Ativos ({patients.filter(p => p.status === 'active').length})
            </button>
            <button
              onClick={() => setFilterStatus('archived')}
              className={`px-2.5 py-1 rounded-md transition-colors ${filterStatus === 'archived' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
            >
              Arquivados ({patients.filter(p => p.status === 'archived').length})
            </button>
          </div>
        </div>
      </div>

      {/* Patients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPatients.map(patient => (
          <div
            key={patient.id}
            onClick={() => setSelectedPatient(patient)}
            className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{patient.name}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                    patient.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {patient.status === 'active' ? 'Em Acompanhamento' : 'Alta / Arquivado'}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                  {patient.name.charAt(0)}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 my-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{patient.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{patient.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Início: {patient.startDate.split('-').reverse().join('/')}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-teal-600 font-semibold">
              <span>Abrir Ficha Completa</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedPatient.name}</h3>
                <p className="text-xs text-slate-500">ID: {selectedPatient.id} • Acompanhamento desde {selectedPatient.startDate.split('-').reverse().join('/')}</p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Sub-tabs / Sections */}
            <div className="space-y-6">
              {/* Cadastral Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Dados Cadastrais</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">E-mail</span>
                    <span className="font-medium text-slate-800">{selectedPatient.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Telefone</span>
                    <span className="font-medium text-slate-800">{selectedPatient.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Data de Nascimento</span>
                    <span className="font-medium text-slate-800">{selectedPatient.birthDate.split('-').reverse().join('/')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CPF</span>
                    <span className="font-medium text-slate-800">{selectedPatient.cpf || 'Não informado'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Contato de Emergência</span>
                    <span className="font-medium text-slate-800">{selectedPatient.emergencyContact || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Clinical Privacy Banner */}
              <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-teal-900">Prontuário e Evolução Clínica (CFP / LGPD)</h5>
                    <p className="text-[11px] text-teal-700 leading-relaxed mt-0.5">
                      As anotações clínicas deste paciente são protegidas por sigilo ético absoluto e acessíveis apenas pelo psicólogo responsável.
                    </p>
                  </div>
                </div>
                {onOpenClinicalRecords && (
                  <button
                    onClick={() => {
                      onOpenClinicalRecords(selectedPatient.id);
                      setSelectedPatient(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shrink-0 transition-colors"
                  >
                    Ver Prontuário
                  </button>
                )}
              </div>

              {/* Appointments History */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Histórico de Atendimentos ({patientAppointments.length})</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {patientAppointments.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum atendimento registrado ainda.</p>
                  ) : (
                    patientAppointments.map(app => (
                      <div key={app.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-slate-900">{app.date.split('-').reverse().join('/')} às {app.startTime}</span>
                          <span className="text-slate-500 block text-[11px]">{app.notes || 'Sessão regular'}</span>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {app.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Payments History */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Histórico Financeiro</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {patientPayments.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum pagamento registrado.</p>
                  ) : (
                    patientPayments.map(pay => (
                      <div key={pay.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">R$ {pay.amount} • {pay.method.toUpperCase()}</span>
                          <span className="text-slate-500 block text-[11px]">{pay.description}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          pay.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {pay.status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Patient Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                <span>Cadastro de Paciente</span>
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Amanda Silva Santos"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="amanda@email.com"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98888-7777"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contato de Emergência</label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Nome do parente / responsável e telefone"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações Iniciais</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações gerais ou motivo do encaminhamento..."
                  rows={2}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-2xs"
                >
                  Cadastrar Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
