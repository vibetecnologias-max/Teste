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
  EyeOff,
  FileEdit,
  History
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
    retifyClinicalRecord,
    auditLogs
  } = useApp();

  // Check access permission: STRICTLY ONLY the treating psychologist has access.
  // Superadmin, clinic managers, and patients are STRICTLY PROHIBITED (CFP 01/2009 & LGPD Art. 11).
  if (!currentUser) return null;
  const hasAccess = currentUser.role === 'psychologist';

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || (patients.length > 0 ? patients[0].id : '')
  );
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPrivateNotes, setShowPrivateNotes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Rectification state (CFP 01/2009 Art. 12: immutable records with structured rectification)
  const [retifyingRecord, setRetifyingRecord] = useState<ClinicalRecord | null>(null);
  const [retificationText, setRetificationText] = useState('');
  const [retificationReason, setRetificationReason] = useState('');
  const [isRetifying, setIsRetifying] = useState(false);
  const [retificationError, setRetificationError] = useState<string | null>(null);

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
          Em conformidade com a <strong>Resolução CFP nº 01/2009</strong> (Conselho Federal de Psicologia) e o <strong>Artigo 11 da Lei Geral de Proteção de Dados (LGPD)</strong>, registros de evolução clínica e anotações psicoterapêuticas são estritamente confidenciais e de posse exclusiva do psicólogo responsável pelo atendimento.
        </p>
        <div className="p-3 bg-slate-50 rounded-xl text-left border border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="font-semibold text-slate-700">Políticas de Segurança do Projeto Psi:</div>
          <div>• <strong>Superadministradores</strong> administram a infraestrutura técnica sem acesso a registros médicos ou evoluções de pacientes.</div>
          <div>• <strong>Gestores de clínica</strong> gerenciam apenas agendas, financeiro e consultórios físicos.</div>
          <div>• <strong>Pacientes</strong> acessam apenas recibos e solicitações de agendamento no portal.</div>
          <div>• Violações de permissão são bloqueadas em nível de regra do banco de dados e registradas para auditoria.</div>
        </div>
      </div>
    );
  }

  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  // Strictly filter records belonging ONLY to this authenticated psychologist
  const patientRecords = clinicalRecords
    .filter(r => r.patientId === selectedPatientId && r.psychologistId === currentUser.uid)
    .sort((a, b) => b.sessionNumber - a.sessionNumber);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !evolutionNotes.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const res = await addClinicalRecord({
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

    setIsSubmitting(false);

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
      setSubmitError(res.error || 'Erro ao gravar prontuário no Firestore.');
    }
  };

  const handleRetifyRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retifyingRecord || !retificationText.trim() || !retificationReason.trim()) return;

    setIsRetifying(true);
    setRetificationError(null);

    const res = await retifyClinicalRecord(
      retifyingRecord.id,
      {
        reason: retificationReason.trim(),
        content: retificationText.trim()
      }
    );

    setIsRetifying(false);

    if (res.success) {
      setRetifyingRecord(null);
      setRetificationText('');
      setRetificationReason('');
    } else {
      setRetificationError(res.error || 'Erro ao registrar retificação no Firestore.');
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

              {/* Audited Subcollection Rectifications (CFP 01/2009 Art. 12: Preserves original record) */}
              {rec.retifications && rec.retifications.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <History className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Adendos de Retificação Auditados ({rec.retifications.length}):</span>
                  </div>
                  {rec.retifications.map((retif) => (
                    <div
                      key={retif.id}
                      className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs space-y-1.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-indigo-950 font-semibold gap-1 pb-1 border-b border-indigo-100">
                        <span>Retificado por: {retif.authorName}</span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          {new Date(retif.createdAt).toLocaleDateString('pt-BR')} às {new Date(retif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[11px] text-indigo-800">
                        <span className="font-bold">Justificativa: </span>
                        <span>{retif.reason}</span>
                      </div>
                      <p className="text-slate-800 whitespace-pre-line leading-relaxed bg-white p-2.5 rounded border border-indigo-100 font-sans text-xs">
                        {retif.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Legacy retification display fallback */}
              {(!rec.retifications || rec.retifications.length === 0) && rec.retificationNotes && (
                <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1">
                    <History className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Termo de Retificação Registrado (CFP nº 01/2009):</span>
                  </div>
                  <div className="text-slate-800 whitespace-pre-line leading-relaxed font-mono text-[11px] bg-white p-2.5 rounded border border-indigo-100">
                    {rec.retificationNotes}
                  </div>
                </div>
              )}

              {/* Record Footer: Legal Retention & Rectification Action */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="flex items-center gap-1 text-slate-400">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Guarda legal mínima 5 anos: exclusão proibida (CFP 01/2009 Art. 12)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRetifyingRecord(rec);
                    setRetificationText('');
                    setRetificationReason('');
                    setRetificationError(null);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg flex items-center gap-1 border border-teal-200 transition-colors w-fit"
                >
                  <FileEdit className="w-3.5 h-3.5 text-teal-600" />
                  <span>Retificar Prontuário</span>
                </button>
              </div>
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

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">

                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-2xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isSubmitting ? 'Gravando no Firestore...' : 'Salvar Evolução com Sigilo'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Clinical Record Rectification Modal (CFP 01/2009 Art. 12) */}
      {retifyingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Retificar Evolução • Sessão #{retifyingRecord.sessionNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Data original: {retifyingRecord.sessionDate.split('-').reverse().join('/')} (imutável)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRetifyingRecord(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 mb-4 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Norma Deontológica (CFP nº 01/2009 Art. 12)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Os registros originais da sessão são legalmente imutáveis e protegidos contra exclusão. As retificações são adicionadas como adendos cronológicos auditados, contendo justificativa técnica, data, hora e identificação do psicólogo titular.
              </p>
            </div>

            <form onSubmit={handleRetifyRecord} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Justificativa Técnica da Retificação *
                </label>
                <input
                  type="text"
                  required
                  value={retificationReason}
                  onChange={(e) => setRetificationReason(e.target.value)}
                  placeholder="Ex: Correção de hipótese diagnóstica após discussão clínica / supervisão."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Texto do Adendo / Nota de Retificação *
                </label>
                <textarea
                  required
                  rows={4}
                  value={retificationText}
                  onChange={(e) => setRetificationText(e.target.value)}
                  placeholder="Descreva o adendo explicativo, dados complementares ou esclarecimento técnico..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 leading-relaxed"
                />
              </div>

              {retificationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{retificationError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRetifyingRecord(null)}
                  disabled={isRetifying}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRetifying}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-2xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isRetifying && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isRetifying ? 'Gravando Adendo no Firestore...' : 'Assinar e Gravar Retificação'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
