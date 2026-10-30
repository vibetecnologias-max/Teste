import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ClinicalRecord, Patient } from '../../types';
import {
  FileText,
  Lock,
  Plus,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Clock,
  Printer,
  ChevronDown,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';

interface ClinicalRecordsViewProps {
  initialPatientId?: string;
}

export const ClinicalRecordsView: React.FC<ClinicalRecordsViewProps> = ({ initialPatientId }) => {
  const {
    currentUser,
    patients,
    clinicalRecords,
    addClinicalRecord,
    auditLogs
  } = useApp();

  // Check access permission: Only psychologist or superadmin
  const hasAccess = currentUser.role === 'psychologist' || currentUser.role === 'superadmin';

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || (patients.length > 0 ? patients[0].id : '')
  );
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPrivateNotes, setShowPrivateNotes] = useState(false);

  // Form state
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionNumber, setSessionNumber] = useState(1);
  const [complaint, setComplaint] = useState('');
  const [evolutionNotes, setEvolutionNotes] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [diagnosticHypothesis, setDiagnosticHypothesis] = useState('');
  const [conductPlan, setConductPlan] = useState('');

  if (!hasAccess) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-xl mx-auto my-8 shadow-xs">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Acesso Restrito a Prontuários Clínicos</h2>
        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          Em conformidade com a <strong>Resolução CFP nº 01/2009</strong> (Conselho Federal de Psicologia) e o <strong>Artigo 11 da Lei Geral de Proteção de Dados (LGPD)</strong>, registros de evolução clínica e anotações psicoterapêuticas são estritamente confidenciais e de posse exclusiva do psicólogo responsável.
        </p>
        <div className="p-3 bg-slate-50 rounded-xl text-left border border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="font-semibold text-slate-700">Políticas de Segurança do Projeto Psi:</div>
          <div>• Gestores de clínica não possuem permissão para leitura de notas clínicas.</div>
          <div>• Pacientes não têm acesso às notas de evolução internas do profissional.</div>
          <div>• Tentativas de acesso indevido são registradas em trilha de auditoria.</div>
        </div>
      </div>
    );
  }

  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const patientRecords = clinicalRecords
    .filter(r => r.patientId === selectedPatientId)
    .sort((a, b) => b.sessionNumber - a.sessionNumber);

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !evolutionNotes.trim()) return;

    const res = addClinicalRecord({
      psychologistId: currentUser.uid,
      patientId: selectedPatientId,
      sessionDate,
      sessionNumber: Number(sessionNumber),
      complaint,
      evolutionNotes,
      privateNotes,
      diagnosticHypothesis,
      conductPlan
    });

    if (res.success) {
      setShowNewModal(false);
      // Reset form
      setComplaint('');
      setEvolutionNotes('');
      setPrivateNotes('');
      setDiagnosticHypothesis('');
      setConductPlan('');
      setSessionNumber(prev => prev + 1);
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Prontuário & Evolução Clínica</h1>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              Sigilo CFP Ativo
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Registro cronológico e sigiloso de sessões com conformidade ao CFP nº 01/2009 e LGPD
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Imprimir Relatório</span>
          </button>

          <button
            onClick={() => {
              setSessionNumber(patientRecords.length + 1);
              setShowNewModal(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Evolução</span>
          </button>
        </div>
      </div>

      {/* Patient Selector and Details Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Paciente:</label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 min-w-64 focus:ring-2 focus:ring-teal-500"
          >
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name} (Início: {p.startDate.split('-').reverse().join('/')})</option>
            ))}
          </select>
        </div>

        {selectedPatient && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span>Idade / Nasc: <strong className="text-slate-700">{selectedPatient.birthDate.split('-').reverse().join('/')}</strong></span>
            <span>Telefone: <strong className="text-slate-700">{selectedPatient.phone}</strong></span>
            <span>Total de sessões: <strong className="text-teal-700">{patientRecords.length} evoluções</strong></span>
          </div>
        )}
      </div>

      {/* Records Timeline */}
      <div className="space-y-4">
        {patientRecords.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            Nenhuma evolução clínica registrada para este paciente ainda.
            <div className="mt-3">
              <button
                onClick={() => setShowNewModal(true)}
                className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700"
              >
                Registrar Primeira Sessão
              </button>
            </div>
          </div>
        ) : (
          patientRecords.map(rec => (
            <div
              key={rec.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                    #{rec.sessionNumber}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Sessão #{rec.sessionNumber} • {rec.sessionDate.split('-').reverse().join('/')}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Responsável: {rec.createdBy} • Registrado em {new Date(rec.createdAt).toLocaleDateString('pt-BR')} às {new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    ID: {rec.id}
                  </span>
                </div>
              </div>

              {/* Complaint & Diagnostic */}
              {(rec.complaint || rec.diagnosticHypothesis) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {rec.complaint && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Queixa / Demanda da Sessão:</span>
                      <p className="text-slate-800 font-medium mt-0.5">{rec.complaint}</p>
                    </div>
                  )}
                  {rec.diagnosticHypothesis && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hipótese Diagnóstica (CID/DSM):</span>
                      <p className="text-slate-800 font-medium mt-0.5">{rec.diagnosticHypothesis}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Evolution Notes */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>Evolução da Sessão</span>
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white p-3 rounded-lg border border-slate-100">
                  {rec.evolutionNotes}
                </p>
              </div>

              {/* Conduct Plan */}
              {rec.conductPlan && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Conduta e Plano de Ação:</h4>
                  <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100">
                    {rec.conductPlan}
                  </p>
                </div>
              )}

              {/* Private Notes (Toggleable) */}
              {rec.privateNotes && (
                <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Anotações Particulares do Psicólogo (Supervisão / Reflexões Pessoais)</span>
                    </span>
                    <button
                      onClick={() => setShowPrivateNotes(!showPrivateNotes)}
                      className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
                    >
                      {showPrivateNotes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPrivateNotes ? 'Ocultar' : 'Exibir'}</span>
                    </button>
                  </div>
                  {showPrivateNotes && (
                    <p className="text-xs text-amber-900 mt-2 italic pt-2 border-t border-amber-200/60 leading-relaxed">
                      "{rec.privateNotes}"
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Clinical Record Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Nova Evolução de Sessão • {selectedPatient?.name}
                </h3>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data da Sessão *</label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Número da Sessão *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={sessionNumber}
                    onChange={(e) => setSessionNumber(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Queixa / Demanda Trazida pelo Paciente</label>
                <input
                  type="text"
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="Ex: Conflito conjugal e sobrecarga no trabalho."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Evolução Clínica e Intervenções Realizadas *</label>
                <textarea
                  required
                  rows={5}
                  value={evolutionNotes}
                  onChange={(e) => setEvolutionNotes(e.target.value)}
                  placeholder="Descreva o andamento da sessão, conteúdo verbalizado, intervenções técnicas, instrumentos utilizados e estado afetivo do paciente..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hipótese Diagnóstica (CID / DSM)</label>
                  <input
                    type="text"
                    value={diagnosticHypothesis}
                    onChange={(e) => setDiagnosticHypothesis(e.target.value)}
                    placeholder="Ex: F41.1 - Ansiedade Generalizada"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Conduta e Tarefas entre Sessões</label>
                  <input
                    type="text"
                    value={conductPlan}
                    onChange={(e) => setConductPlan(e.target.value)}
                    placeholder="Ex: Registro diário de pensamentos, retorno semanal"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                <label className="block font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Anotações Particulares (Sigilo Especial / Supervisão)</span>
                </label>
                <textarea
                  rows={2}
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  placeholder="Reflexões pessoais do terapeuta, hipóteses preliminares para supervisão clínica..."
                  className="w-full p-2 border border-amber-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 bg-white"
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
                  Salvar Evolução com Sigilo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
