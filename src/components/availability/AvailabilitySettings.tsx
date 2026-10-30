import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Clock,
  Calendar,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { WeeklyScheduleDay } from '../../types';

export const AvailabilitySettings: React.FC = () => {
  const { availability, currentUser } = useApp();

  const [schedule, setSchedule] = useState<WeeklyScheduleDay[]>(availability.weeklySchedule);
  const [slotDuration, setSlotDuration] = useState(availability.slotDurationMinutes);
  const [buffer, setBuffer] = useState(availability.bufferMinutes);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  const toggleDay = (dayIndex: number) => {
    setSchedule(prev => prev.map(d => {
      if (d.dayOfWeek === dayIndex) {
        const nextWorking = !d.isWorking;
        return {
          ...d,
          isWorking: nextWorking,
          intervals: nextWorking && d.intervals.length === 0
            ? [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '18:00' }]
            : d.intervals
        };
      }
      return d;
    }));
  };

  const updateInterval = (dayIndex: number, intervalIndex: number, field: 'start' | 'end', value: string) => {
    setSchedule(prev => prev.map(d => {
      if (d.dayOfWeek === dayIndex) {
        const newIntervals = [...d.intervals];
        newIntervals[intervalIndex] = { ...newIntervals[intervalIndex], [field]: value };
        return { ...d, intervals: newIntervals };
      }
      return d;
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Horários de Atendimento & Intervalos</h1>
          <p className="text-xs text-slate-500">
            Defina sua grade de disponibilidade semanal para agendamento online automático de pacientes
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Configurações</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Horários de disponibilidade atualizados com sucesso! O Portal do Paciente já reflete suas novas janelas de consulta.</span>
        </div>
      )}

      {/* Global Parameters */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Parâmetros Globais de Sessão
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Duração Padrão da Sessão de Psicoterapia (minutos)
            </label>
            <select
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
            >
              <option value="45">45 minutos</option>
              <option value="50">50 minutos (Recomendado CFP)</option>
              <option value="60">60 minutos (1 hora)</option>
              <option value="90">90 minutos (Terapia de Casal / Família)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Intervalo / Buffer Entre Atendimentos (minutos)
            </label>
            <select
              value={buffer}
              onChange={(e) => setBuffer(Number(e.target.value))}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
            >
              <option value="0">Sem intervalo (0 minutos)</option>
              <option value="10">10 minutos (Anotação de evolução e acolhimento)</option>
              <option value="15">15 minutos</option>
              <option value="20">20 minutos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Weekly Schedule Days */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          Dias e Turnos da Semana
        </h3>

        <div className="space-y-3">
          {schedule.map((day) => (
            <div
              key={day.dayOfWeek}
              className={`p-3.5 rounded-xl border transition-all ${
                day.isWorking ? 'border-teal-200 bg-white' : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`day-${day.dayOfWeek}`}
                    checked={day.isWorking}
                    onChange={() => toggleDay(day.dayOfWeek)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor={`day-${day.dayOfWeek}`} className={`text-xs font-bold cursor-pointer ${day.isWorking ? 'text-slate-900' : 'text-slate-400'}`}>
                    {daysOfWeek[day.dayOfWeek]}
                  </label>
                </div>

                {day.isWorking ? (
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {day.intervals.map((interval, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-medium">Turno {i + 1}:</span>
                        <input
                          type="time"
                          value={interval.start}
                          onChange={(e) => updateInterval(day.dayOfWeek, i, 'start', e.target.value)}
                          className="font-mono text-xs p-1 border border-slate-200 rounded bg-white"
                        />
                        <span className="text-slate-400">até</span>
                        <input
                          type="time"
                          value={interval.end}
                          onChange={(e) => updateInterval(day.dayOfWeek, i, 'end', e.target.value)}
                          className="font-mono text-xs p-1 border border-slate-200 rounded bg-white"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium italic">
                    Não atende neste dia
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
