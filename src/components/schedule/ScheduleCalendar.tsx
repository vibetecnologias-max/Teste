import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DoorOpen,
  User,
  Filter,
  DollarSign
} from 'lucide-react';
import { AppointmentStatus } from '../../types';

export const ScheduleCalendar: React.FC = () => {
  const {
    currentUser,
    appointments,
    patients,
    rooms,
    requestAppointment,
    confirmAppointment,
    cancelAppointment,
    completeAppointment,
    markNoShow
  } = useApp();

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [filterRoom, setFilterRoom] = useState<string>('all');

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [customPatientName, setCustomPatientName] = useState('');
  const [customPatientPhone, setCustomPatientPhone] = useState('');
  const [formDate, setFormDate] = useState(selectedDate);
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('09:50');
  const [formDuration, setFormDuration] = useState(50);
  const [formPrice, setFormPrice] = useState(190);
  const [formRoomId, setFormRoomId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!currentUser) return null;

  const filteredAppointments = appointments.filter(a => {
    if (filterRoom !== 'all' && a.roomId !== filterRoom) return false;
    return true;
  });

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let patientName = customPatientName;
    let patientId = selectedPatientId;

    if (selectedPatientId) {
      const p = patients.find(item => item.id === selectedPatientId);
      if (p) {
        patientName = p.name;
      }
    } else if (!customPatientName.trim()) {
      setFormError('Por favor selecione um paciente ou digite o nome.');
      return;
    } else {
      patientId = `temp_${Date.now()}`;
    }

    const res = await requestAppointment({
      psychologistId: currentUser.uid,
      patientId,
      patientName,
      patientPhone: customPatientPhone,
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      durationMinutes: formDuration,
      price: formPrice,
      roomId: formRoomId || undefined,
      notes: formNotes
    });

    if (!res.success) {
      setFormError(res.error || 'Erro ao criar agendamento');
      return;
    }

    // Auto-confirm if created by psychologist directly
    if (res.appointment && currentUser.role === 'psychologist') {
      await confirmAppointment(res.appointment.id);
    }

    setShowNewModal(false);

    // reset form
    setFormNotes('');
    setCustomPatientName('');
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-semibold">Confirmado</span>;
      case 'pending':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-semibold">Pendente</span>;
      case 'completed':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md text-[10px] font-semibold">Realizado</span>;
      case 'no_show':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md text-[10px] font-semibold">Falta</span>;
      case 'cancelled':
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-semibold">Cancelado</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px]">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Agenda e Consultas</h1>
          <p className="text-xs text-slate-500">
            Controle de horários com prevenção ativa de conflitos e validação de intervalos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Room filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              aria-label="Filtrar por consultório"
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="text-xs p-1.5 border border-slate-200 rounded-lg bg-slate-50 font-medium"
            >
              <option value="all">Todas as Salas</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${viewMode === 'day' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Dia
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${viewMode === 'week' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${viewMode === 'month' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Mês
            </button>
          </div>

          {/* New Appointment button */}
          <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Date Navigation & Calendar Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-teal-600" />
              <span>Visualização da Agenda ({viewMode.toUpperCase()})</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              {selectedDate.split('-').reverse().join('/')}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <input
              type="date"
              aria-label="Selecionar data da agenda"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs p-1.5 border border-slate-200 rounded-lg text-slate-700 font-mono"
            />
          </div>
        </div>

        {/* Schedule List / Grid */}
        <div className="p-4 space-y-3">
          {filteredAppointments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum agendamento encontrado para o filtro selecionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAppointments.map(app => (
                <div
                  key={app.id}
                  className={`p-4 rounded-xl border transition-all ${
                    app.status === 'confirmed' ? 'border-emerald-200/80 bg-white hover:border-emerald-400' :
                    app.status === 'pending' ? 'border-amber-200 bg-amber-50/20 hover:border-amber-400' :
                    app.status === 'completed' ? 'border-blue-200 bg-blue-50/10' :
                    'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {app.startTime} - {app.endTime}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {app.date.split('-').reverse().join('/')}
                      </span>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-1">{app.patientName}</h3>

                  <div className="text-xs text-slate-500 space-y-1 mb-3">
                    <div className="flex items-center gap-1.5">
                      <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>{app.roomName || 'Sem sala definida'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                      <span>R$ {app.price} • Pagamento: {app.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}</span>
                    </div>
                    {app.notes && (
                      <p className="text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                        {app.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions according to status */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                    {app.status === 'pending' && (
                      <button
                        onClick={() => confirmAppointment(app.id)}
                        className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Confirmar</span>
                      </button>
                    )}

                    {app.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => completeAppointment(app.id)}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Concluir</span>
                        </button>
                        <button
                          onClick={() => markNoShow(app.id)}
                          className="px-2 py-1 rounded-md border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[11px] transition-colors"
                        >
                          Falta
                        </button>
                      </>
                    )}

                    {app.status !== 'cancelled' && app.status !== 'completed' && (
                      <button
                        onClick={() => cancelAppointment(app.id, 'Cancelado pelo psicólogo')}
                        className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Appointment Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-teal-600" />
                <span>Novo Agendamento Clínico</span>
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAppointment} className="space-y-4 text-xs">
              {/* Select or type patient */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Paciente Cadastrado</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value);
                    if (e.target.value) setCustomPatientName('');
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- Selecionar da lista de pacientes --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                  ))}
                </select>
              </div>

              {!selectedPatientId && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ou Nome do Novo Paciente</label>
                  <input
                    type="text"
                    value={customPatientName}
                    onChange={(e) => setCustomPatientName(e.target.value)}
                    placeholder="Ex: Amanda Albuquerque"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Consultório / Sala</label>
                  <select
                    value={formRoomId}
                    onChange={(e) => setFormRoomId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Consultório Padrão</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Início</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Término</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações da Sessão</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: Sessão inicial de acolhimento e anamnese."
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
                  Salvar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
