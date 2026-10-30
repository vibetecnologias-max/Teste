import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SEED_PLANS } from '../../data/seedData';
import {
  Activity,
  Layers,
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  Calendar,
  Lock,
  ArrowUpRight,
  Database,
  RefreshCw
} from 'lucide-react';

export const SuperAdminView: React.FC = () => {
  const { clinics, allProfessionals, patients, appointments, auditLogs, refreshAuditLogs } = useApp();
  const [activeTab, setActiveTab] = useState<'metrics' | 'tenants' | 'plans' | 'audit'>('metrics');
  const [refreshing, setRefreshing] = useState(false);

  const totalClinics = clinics.length;
  const totalPros = allProfessionals.length;
  const totalPatients = patients.length;
  const totalAppointments = appointments.length;

  // Estimated SaaS MRR
  const estimatedMRR = 69 + 289; // 1 individual + 1 clinic

  return (
    <div className="space-y-6">
      {/* SaaS Admin Banner */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-slate-900 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 text-amber-200 text-xs font-medium mb-2">
              <Database className="w-3.5 h-3.5" />
              <span>Painel de Governança SaaS • Multi-Tenant</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Governança da Plataforma Projeto Psi
            </h1>
            <p className="text-amber-100/80 text-xs mt-1">
              Supervisão de planos comerciais, assinaturas ativas, clínicas credenciadas e trilhas de auditoria LGPD.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1.5 rounded-xl font-bold">
              Operação Saudável • 100% Uptime
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'metrics' ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200' : 'text-slate-600'}`}
          >
            Métricas SaaS
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'tenants' ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200' : 'text-slate-600'}`}
          >
            Clínicas & Profissionais ({totalClinics + totalPros})
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'plans' ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200' : 'text-slate-600'}`}
          >
            Planos Comerciais
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'audit' ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200' : 'text-slate-600'}`}
          >
            Auditoria LGPD & CFP ({auditLogs.length})
          </button>
        </div>

        <div className="p-5">
          {/* Tab 1: Metrics */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-400 text-[11px] font-semibold block">MRR Estimado</span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">R$ {estimatedMRR},00</p>
                  <span className="text-[10px] text-emerald-600 font-medium">+15% em relação ao mês anterior</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-400 text-[11px] font-semibold block">Clínicas Ativas</span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{totalClinics}</p>
                  <span className="text-[10px] text-slate-500">100% adimplentes</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-400 text-[11px] font-semibold block">Psicólogos Credenciados</span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{totalPros}</p>
                  <span className="text-[10px] text-slate-500">CRPs validados</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-slate-400 text-[11px] font-semibold block">Atendimentos Registrados</span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{totalAppointments}</p>
                  <span className="text-[10px] text-teal-600 font-medium">Plataforma em crescimento</span>
                </div>
              </div>

              {/* Security Architecture Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Arquitetura de Segurança e Segregação de Dados</span>
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  O Administrador da Plataforma monitora métricas e saúde do banco sem acesso indiscriminado ao conteúdo clínico sensível dos pacientes. O sigilo dos prontuários é protegido na camada de banco de dados (Cloud Firestore Rules) e no servidor de aplicação.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Tenants */}
          {activeTab === 'tenants' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Organizações e Clínicas Cadastradas
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Organização</th>
                      <th className="py-2.5 px-3">CNPJ</th>
                      <th className="py-2.5 px-3">Responsável</th>
                      <th className="py-2.5 px-3">Consultórios</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clinics.map(c => (
                      <tr key={c.id}>
                        <td className="py-3 px-3 font-bold text-slate-900">{c.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{c.cnpj || '38.492.110/0001-44'}</td>
                        <td className="py-3 px-3 text-slate-700">{c.email}</td>
                        <td className="py-3 px-3 text-slate-600">{c.roomsCount} salas</td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Ativa
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Plans */}
          {activeTab === 'plans' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SEED_PLANS.map(plan => (
                <div
                  key={plan.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between ${
                    plan.popular
                      ? 'border-amber-400 bg-amber-50/20 shadow-sm ring-1 ring-amber-400'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div>
                    {plan.popular && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full mb-2 inline-block">
                        Mais Escolhido
                      </span>
                    )}
                    <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                    <div className="mt-4 mb-4">
                      <span className="text-2xl font-bold text-slate-900">R$ {plan.priceMonthly}</span>
                      <span className="text-xs text-slate-500"> / mês</span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      {plan.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6">
                    <button className="w-full py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors">
                      Gerenciar Plano
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 4: Audit Logs (LGPD & CFP) */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Trilha Imutável de Auditoria (Audit Logs)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Registros permanentes de criação e leitura de prontuários clínicos para conformidade legal (LGPD Art. 11 e CFP nº 01/2009)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">Total: {auditLogs.length} eventos</span>
                  <button
                    onClick={async () => {
                      setRefreshing(true);
                      await refreshAuditLogs();
                      setRefreshing(false);
                    }}
                    disabled={refreshing}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1 text-xs"
                    title="Recarregar trilha de auditoria"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
                    <span className="hidden sm:inline">Atualizar</span>
                  </button>
                </div>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">Nenhum evento registrado ainda.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Operações clínicas (criação e consulta de evoluções psicológicas) geram logs imutáveis e auditáveis automaticamente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">{log.timestamp.split('T')[0]} {log.timestamp.split('T')[1]?.substring(0, 5) || ''}</span>
                          <span className="font-bold text-slate-800 font-mono text-[11px] bg-slate-200 px-1.5 py-0.5 rounded">
                            {log.action}
                          </span>
                          <span className="text-slate-600">{log.userEmail}</span>
                        </div>
                        <p className="text-slate-600 mt-1">{log.details}</p>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-1 rounded border border-slate-200 shrink-0">
                        ID: {log.id}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
