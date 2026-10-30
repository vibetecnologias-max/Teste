import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ClinicRoom } from '../../types';
import {
  Building2,
  DoorOpen,
  UserCheck,
  Plus,
  Clock,
  ShieldAlert,
  Calendar,
  Lock,
  Phone,
  Mail,
  MapPin,
  CheckCircle2
} from 'lucide-react';

export const ClinicManagementView: React.FC = () => {
  const {
    currentClinic,
    rooms,
    addRoom,
    updateRoom,
    allProfessionals,
    appointments,
    patients
  } = useApp();

  const [activeTab, setActiveTab] = useState<'rooms' | 'team' | 'schedule'>('rooms');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [roomColor, setRoomColor] = useState('#0d9488');

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    addRoom({
      clinicId: currentClinic?.id || 'clinic_mente_viva',
      name: roomName,
      description: roomDesc,
      color: roomColor,
      active: true
    });

    setShowRoomModal(false);
    setRoomName('');
    setRoomDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Clinic Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{currentClinic?.name || 'Clínica Mente Viva Integrada'}</h1>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                  Gestão Multi-Profissional
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> {currentClinic?.address}</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {currentClinic?.phone}</span>
                <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {currentClinic?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRoomModal(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Consultório</span>
            </button>
          </div>
        </div>
      </div>

      {/* Strict Ethical Warning for Clinic Managers */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
        <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600">
          <strong className="text-slate-800">Isolamento Ético e Proteção de Dados:</strong> O painel da clínica permite o gerenciamento de salas físicas, horários de ocupação e repasses administrativos. Registros clínicos, hipóteses diagnósticas e anotações particulares de cada sessão são de acesso <em>exclusivo</em> do psicólogo responsável e não são expostos a recepcionistas ou gestores.
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'rooms' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600'}`}
          >
            Consultórios & Salas ({rooms.length})
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'team' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600'}`}
          >
            Corpo Clínico ({allProfessionals.length})
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'schedule' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'text-slate-600'}`}
          >
            Ocupação de Salas
          </button>
        </div>

        <div className="p-5">
          {/* Rooms Grid */}
          {activeTab === 'rooms' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {rooms.map(room => (
                <div key={room.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: room.color }} />
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        Disponível
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">{room.name}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {room.description || 'Consultório preparado para psicoterapia.'}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[10px]">{room.id}</span>
                    <button
                      onClick={() => updateRoom(room.id, { active: !room.active })}
                      className="text-blue-600 hover:text-blue-800 font-medium text-[11px]"
                    >
                      {room.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Team Grid */}
          {activeTab === 'team' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allProfessionals.map(prof => (
                <div key={prof.id} className="p-4 rounded-xl border border-slate-200 bg-white flex items-start gap-4">
                  <img
                    src={prof.photoUrl}
                    alt={prof.name}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{prof.name}</h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {prof.crp}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{prof.bio}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {prof.specialities.map((spec, i) => (
                        <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                          {spec}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-slate-500 flex items-center gap-4">
                      <span>Valor médio: <strong className="text-slate-800">R$ {prof.sessionPrice}</strong></span>
                      <span>Duração: <strong className="text-slate-800">{prof.sessionDurationMinutes} min</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Occupancy Timeline */}
          {activeTab === 'schedule' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Mapa de Ocupação dos Consultórios
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Consultório</th>
                      <th className="py-2.5 px-3">Profissional</th>
                      <th className="py-2.5 px-3">Horário</th>
                      <th className="py-2.5 px-3">Status do Agendamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appointments.map(app => (
                      <tr key={app.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {app.roomName || 'Consultório Principal'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{app.psychologistName || 'Dr. Marcos'}</td>
                        <td className="py-2.5 px-3 font-mono">{app.date.split('-').reverse().join('/')} ({app.startTime} - {app.endTime})</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            app.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
                            app.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {app.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Novo Consultório</h3>
              <button onClick={() => setShowRoomModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleAddRoom} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Consultório *</label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Ex: Consultório 5 - Tranquilidade"
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição e Recursos</label>
                <textarea
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  placeholder="Ex: Sala com poltronas ergonômicas, divã e ar condicionado silencioso."
                  rows={2}
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cor de Identificação no Mapa</label>
                <input
                  type="color"
                  value={roomColor}
                  onChange={(e) => setRoomColor(e.target.value)}
                  className="w-full h-10 p-1 border border-slate-200 rounded-xl cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRoomModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Salvar Consultório
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
