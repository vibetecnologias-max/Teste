import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Calendar,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ArrowRight,
  UserCheck,
  CalendarDays,
  FileText,
  CreditCard,
  ChevronRight
} from 'lucide-react';
import { calculateFinancialSummary } from '../../utils/rules';

interface PsychologistDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const PsychologistDashboard: React.FC<PsychologistDashboardProps> = ({ onNavigateTab }) => {
  const {
    currentUser,
    patients,
    appointments,
    payments,
    expenses,
    confirmAppointment,
    rejectAppointment,
    completeAppointment,
    markNoShow
  } = useApp();

  const [selectedAppointmentForRejection, setSelectedAppointmentForRejection] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  if (!currentUser) return null;

  // Metrics calculation
  const totalPatients = patients.length;
  const activePatients = patients.filter(p => p.status === 'active').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.date === todayStr);

  const pendingRequests = appointments.filter(a => a.status === 'pending');
  const confirmedAppointments = appointments.filter(a => a.status === 'confirmed');
  const completedAppointments = appointments.filter(a => a.status === 'completed');
  const cancelledAppointments = appointments.filter(a => a.status === 'cancelled');
  const noShows = appointments.filter(a => a.status === 'no_show');

  const financial = calculateFinancialSummary(payments, expenses);

  const handleConfirm = (id: string) => {
    const res = confirmAppointment(id);
    if (!res.success) {
      alert(res.error);
    }
  };

  const handleReject = () => {
    if (!selectedAppointmentForRejection) return;
    const res = rejectAppointment(selectedAppointmentForRejection, rejectionReason);
    if (!res.success) {
      alert(res.error);
    }
    setSelectedAppointmentForRejection(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-xs text-teal-100 text-xs font-medium mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Painel Clínico Integrado • CRP Ativo
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Olá, {currentUser.displayName}
            </h1>
            <p className="text-teal-100 text-sm mt-1 max-w-xl">
              Você tem <strong className="text-white">{todayAppointments.length} atendimentos</strong> programados para hoje e <strong className="text-white">{pendingRequests.length} solicitações de agendamento</strong> aguardando sua confirmação.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateTab('schedule')}
              className="px-4 py-2.5 rounded-xl bg-white text-teal-900 font-semibold text-xs hover:bg-teal-50 transition-colors shadow-sm flex items-center gap-2"
            >
              <Calendar className="w-4 h-4 text-teal-700" />
              <span>Ver Agenda Completa</span>
            </button>
            <button
              onClick={() => onNavigateTab('clinical')}
              className="px-4 py-2.5 rounded-xl bg-teal-900/40 text-white border border-white/20 font-semibold text-xs hover:bg-teal-900/60 transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Prontuários</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Pacientes Ativos</span>
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{activePatients}</p>
          <span className="text-[11px] text-slate-500">{totalPatients} cadastrados</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Sessões Hoje</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{todayAppointments.length}</p>
          <span className="text-[11px] text-slate-500">
            {todayAppointments.filter(a => a.status === 'completed').length} realizadas
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Solicitações</span>
            <div className={`p-1.5 rounded-lg ${pendingRequests.length > 0 ? 'bg-amber-100 text-amber-700 animate-bounce' : 'bg-slate-50 text-slate-400'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600">{pendingRequests.length}</p>
          <span className="text-[11px] text-amber-700 font-medium">Aguardando aprovação</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Confirmadas</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{confirmedAppointments.length}</p>
          <span className="text-[11px] text-slate-500">Agendas ativas</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Faturamento Mês</span>
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            R$ {financial.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">Recebido no período</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">A Receber</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            R$ {financial.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
          <span className="text-[11px] text-slate-500">{financial.totalOverdue > 0 ? `R$ ${financial.totalOverdue} vencido` : 'Em dia'}</span>
        </div>
      </div>

      {/* Main Grid: Pending Requests & Today Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pending Requests Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">Solicitações Pendentes</h2>
              </div>
              <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                {pendingRequests.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  Nenhuma solicitação de agendamento pendente.
                </div>
              ) : (
                pendingRequests.map(req => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/30 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{req.patientName}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-teal-600" />
                          <span>{req.date.split('-').reverse().join('/')}</span>
                          <span>•</span>
                          <Clock className="w-3.5 h-3.5 text-teal-600" />
                          <span>{req.startTime} às {req.endTime}</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        R$ {req.price}
                      </span>
                    </div>

                    {req.notes && (
                      <p className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-amber-100">
                        "{req.notes}"
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleConfirm(req.id)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmar Horário</span>
                      </button>

                      <button
                        onClick={() => setSelectedAppointmentForRejection(req.id)}
                        className="py-1.5 px-3 rounded-lg border border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 text-xs font-medium transition-colors"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-800">Ações Rápidas</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigateTab('schedule')}
                className="p-3 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <CalendarDays className="w-4 h-4 text-teal-600" />
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-xs font-semibold text-slate-800">Novo Agendamento</div>
                <div className="text-[10px] text-slate-500">Bloquear ou marcar</div>
              </button>

              <button
                onClick={() => onNavigateTab('patients')}
                className="p-3 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <UserCheck className="w-4 h-4 text-teal-600" />
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-xs font-semibold text-slate-800">Cadastrar Paciente</div>
                <div className="text-[10px] text-slate-500">Ficha administrativa</div>
              </button>
            </div>
          </div>
        </div>

        {/* Schedule of the Day Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">Agenda de Atendimentos</h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Hoje • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {appointments.filter(a => a.status !== 'rejected' && a.status !== 'cancelled').slice(0, 5).map(app => (
                <div
                  key={app.id}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-14 text-center py-1 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs font-bold shrink-0">
                      {app.startTime}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{app.patientName}</h4>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          app.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          app.status === 'completed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          app.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          app.status === 'no_show' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {app.status === 'confirmed' && 'Confirmado'}
                          {app.status === 'completed' && 'Realizado'}
                          {app.status === 'pending' && 'Pendente'}
                          {app.status === 'no_show' && 'Falta / Não compareceu'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {app.roomName || 'Consultório Principal'} • {app.durationMinutes} min • R$ {app.price}
                      </p>
                    </div>
                  </div>

                  {/* Actions according to status */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {app.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => completeAppointment(app.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Concluir</span>
                        </button>
                        <button
                          onClick={() => markNoShow(app.id)}
                          className="px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-xs transition-colors"
                        >
                          Falta
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => onNavigateTab('clinical')}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Evolução</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Rejection Reason */}
      {selectedAppointmentForRejection && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Recusar Solicitação de Atendimento</h3>
            <p className="text-xs text-slate-600 mb-4">
              Informe a justificativa para o paciente. Ele receberá uma notificação orientando a escolher outro horário.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Horário indisponível por motivo de reunião clínica ou compromisso acadêmico."
              rows={3}
              className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedAppointmentForRejection(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Voltar
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirmar Recusa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
