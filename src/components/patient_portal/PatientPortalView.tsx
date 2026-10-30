import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calendar,
  Clock,
  User,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Copy,
  ChevronRight,
  Send,
  Sparkles
} from 'lucide-react';
import { computeOpenTimeSlots } from '../../utils/rules';

interface PatientPortalViewProps {
  initialTab?: 'appointments' | 'book' | 'finance' | 'profile';
}

export const PatientPortalView: React.FC<PatientPortalViewProps> = ({ initialTab = 'appointments' }) => {
  const {
    currentUser,
    allProfessionals,
    appointments,
    payments,
    requestAppointment,
    cancelAppointment,
    availability
  } = useApp();

  const [activeTab, setActiveTab] = useState<'appointments' | 'book' | 'finance' | 'profile'>(initialTab);

  // Booking Flow States
  const [selectedProfId, setSelectedProfId] = useState<string>(allProfessionals[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // tomorrow
    return d.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  if (!currentUser) return null;

  // Filter patient's appointments
  const myAppointments = appointments.filter(a =>
    a.patientUserId === currentUser.uid || a.patientName === currentUser.displayName
  );

  const myPayments = payments.filter(p =>
    p.patientName === currentUser.displayName
  );

  const selectedProfessional = allProfessionals.find(p => p.id === selectedProfId) || allProfessionals[0];

  // Compute available open slots for the selected date
  const bookedRanges = appointments
    .filter(a => a.date === selectedDate && a.status !== 'cancelled' && a.status !== 'rejected')
    .map(a => ({ start: a.startTime, end: a.endTime }));

  // Default work intervals: 08:00 - 12:00 and 13:00 - 18:00
  const workIntervals = [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '18:00' }
  ];

  const availableSlots = computeOpenTimeSlots(
    workIntervals,
    selectedProfessional?.sessionDurationMinutes || 50,
    10,
    bookedRanges
  );

  const handleSendBookingRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!selectedSlot) {
      setBookingError('Por favor, selecione um dos horários disponíveis.');
      return;
    }

    const res = await requestAppointment({
      psychologistId: selectedProfessional.userId,
      patientId: currentUser.uid,
      patientName: currentUser.displayName,
      patientPhone: currentUser.phone || '',
      date: selectedDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      durationMinutes: selectedProfessional.sessionDurationMinutes,
      price: selectedProfessional.sessionPrice,
      notes: bookingNotes
    });

    if (!res.success) {
      setBookingError(res.error || 'Erro ao enviar solicitação.');
      return;
    }


    setBookingSuccess(true);
    setSelectedSlot(null);
    setBookingNotes('');
    setTimeout(() => {
      setBookingSuccess(false);
      setActiveTab('appointments');
    }, 2200);
  };

  const copyPixKey = (text: string) => {
    navigator.clipboard.writeText(text);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-700 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 text-xs font-medium mb-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              <span>Portal do Paciente • Ambiente Seguro</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Olá, {currentUser.displayName}
            </h1>
            <p className="text-purple-100 text-xs mt-1">
              Acompanhe seus horários de terapia, envie solicitações e consulte recibos.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('book')}
            className="px-4 py-2 rounded-xl bg-white text-purple-900 font-bold text-xs hover:bg-purple-50 transition-colors shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Calendar className="w-4 h-4 text-purple-700" />
            <span>Solicitar Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'appointments' ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200' : 'text-slate-600'}`}
          >
            Meus Agendamentos ({myAppointments.length})
          </button>
          <button
            onClick={() => setActiveTab('book')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'book' ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200' : 'text-slate-600'}`}
          >
            Solicitar Consulta
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'finance' ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200' : 'text-slate-600'}`}
          >
            Recibos & Pagamentos ({myPayments.length})
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'profile' ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200' : 'text-slate-600'}`}
          >
            Meus Dados
          </button>
        </div>

        <div className="p-5">
          {/* Tab 1: My Appointments */}
          {activeTab === 'appointments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Histórico de Consultas
                </h3>
                <span className="text-xs text-slate-500">
                  Total: {myAppointments.length} agendamentos
                </span>
              </div>

              {myAppointments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Você ainda não possui atendimentos agendados.
                </div>
              ) : (
                <div className="space-y-3">
                  {myAppointments.map(app => (
                    <div
                      key={app.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-purple-50 text-purple-900 px-2 py-0.5 rounded border border-purple-200">
                            {app.date.split('-').reverse().join('/')} às {app.startTime}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            app.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            app.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            app.status === 'completed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            app.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {app.status === 'confirmed' && 'Confirmado pelo Psicólogo'}
                            {app.status === 'pending' && 'Aguardando Confirmação'}
                            {app.status === 'completed' && 'Sessão Realizada'}
                            {app.status === 'rejected' && 'Solicitação Recusada'}
                            {app.status === 'cancelled' && 'Cancelado'}
                            {app.status === 'no_show' && 'Falta Registrada'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{app.psychologistName || 'Dr. Marcos Vinícius'}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {app.roomName || 'Consultório Principal'} • Duração: {app.durationMinutes} min • R$ {app.price}
                        </p>
                        {app.cancellationReason && (
                          <p className="text-[11px] text-rose-600 mt-1 italic">
                            Motivo informado: {app.cancellationReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {app.status === 'pending' && (
                          <span className="text-[11px] text-amber-700 font-medium">
                            O psicólogo responderá em breve
                          </span>
                        )}

                        {(app.status === 'confirmed' || app.status === 'pending') && (
                          <button
                            onClick={() => cancelAppointment(app.id, 'Cancelado pelo paciente')}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs transition-colors"
                          >
                            Solicitar Cancelamento
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Booking Flow (CENTRAL PRODUCT RULE) */}
          {activeTab === 'book' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 text-xs text-purple-900">
                <strong className="block font-bold mb-1">Como funciona o agendamento no Projeto Psi:</strong>
                1. Você seleciona o psicólogo e data desejada.<br />
                2. Escolhe um dos horários livres em tempo real.<br />
                3. Envia a solicitação e o psicólogo é notificado imediatamente para confirmar.
              </div>

              {bookingSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Solicitação enviada com sucesso!</span>
                    O psicólogo recebeu a notificação e irá avaliar seu horário.
                  </div>
                </div>
              )}

              {bookingError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{bookingError}</span>
                </div>
              )}

              <form onSubmit={handleSendBookingRequest} className="space-y-4 text-xs">
                {/* Step 1: Professional */}
                <div>
                  <label className="block font-bold text-slate-800 mb-2">1. Escolha o Psicólogo:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allProfessionals.map(prof => (
                      <div
                        key={prof.id}
                        onClick={() => setSelectedProfId(prof.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                          selectedProfId === prof.id
                            ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={prof.photoUrl}
                          alt={prof.name}
                          className="w-11 h-11 rounded-full object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 truncate">{prof.name}</h4>
                          <span className="text-[10px] text-purple-700 font-semibold">{prof.crp}</span>
                          <span className="text-[11px] text-slate-500 block">R$ {prof.sessionPrice} • {prof.sessionDurationMinutes} min</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 2: Date */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">2. Selecione a Data:</label>
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedSlot(null);
                    }}
                    className="w-full sm:w-64 p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Step 3: Slots */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    3. Horários Disponíveis para {selectedDate.split('-').reverse().join('/')}:
                  </label>
                  {availableSlots.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs border border-slate-200">
                      Não há horários disponíveis para esta data. Por favor selecione outro dia.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                      {availableSlots.map((slot, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-1 text-center rounded-lg font-mono text-xs font-semibold transition-all ${
                            selectedSlot?.startTime === slot.startTime
                              ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-600/30'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-purple-300 hover:bg-purple-50/30'
                          }`}
                        >
                          {slot.startTime}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 4: Notes */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    4. Mensagem / Motivo da Consulta (Opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="Ex: Gostaria de retomar as sessões semanais..."
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!selectedSlot}
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar Solicitação de Agendamento</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Receipts & Finance */}
          {activeTab === 'finance' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-bold text-emerald-900">Chave Pix para Pagamento de Sessões</h4>
                  <p className="text-emerald-700 text-[11px]">
                    Clínica Mente Viva Integrada • CNPJ 38.492.110/0001-44
                  </p>
                </div>
                <button
                  onClick={() => copyPixKey('38.492.110/0001-44')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{pixCopied ? 'Chave Copiada!' : 'Copiar Chave Pix'}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3">Forma</th>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Valor</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myPayments.map(p => (
                      <tr key={p.id}>
                        <td className="py-3 px-3 font-semibold text-slate-800">{p.description}</td>
                        <td className="py-3 px-3 uppercase font-mono text-[11px] text-slate-500">{p.method}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{p.dueDate.split('-').reverse().join('/')}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">R$ {p.amount.toFixed(2)}</td>
                        <td className="py-3 px-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {p.status === 'paid' ? 'Quitado' : 'Aguardando Pagamento'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 4: Profile */}
          {activeTab === 'profile' && (
            <div className="max-w-md mx-auto space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Dados Pessoais do Paciente</h3>
              <div>
                <label className="text-slate-400 block text-[11px]">Nome Completo</label>
                <div className="font-semibold text-slate-800 p-2.5 bg-slate-50 rounded-xl border border-slate-200">{currentUser.displayName}</div>
              </div>
              <div>
                <label className="text-slate-400 block text-[11px]">E-mail</label>
                <div className="font-semibold text-slate-800 p-2.5 bg-slate-50 rounded-xl border border-slate-200">{currentUser.email}</div>
              </div>
              <div>
                <label className="text-slate-400 block text-[11px]">Telefone</label>
                <div className="font-semibold text-slate-800 p-2.5 bg-slate-50 rounded-xl border border-slate-200">{currentUser.phone || '(11) 99123-8877'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
