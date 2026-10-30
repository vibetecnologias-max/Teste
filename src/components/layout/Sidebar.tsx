import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  DollarSign,
  Clock,
  Building2,
  DoorOpen,
  UserCheck,
  ShieldCheck,
  CalendarCheck,
  CreditCard,
  User,
  Activity,
  Layers,
  FileCheck,
  LogOut,
  Sparkles,
  Lock
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isMobileOpen,
  onCloseMobile
}) => {
  const { currentUser } = useApp();

  if (!currentUser) return null;

  const handleSelect = (tab: string) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const renderNavLinks = () => {
    switch (currentUser.role) {
      case 'psychologist':
        return (
          <>
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Atendimento Clínico
            </div>
            <button
              onClick={() => handleSelect('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Painel Geral</span>
            </button>

            <button
              onClick={() => handleSelect('schedule')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'schedule'
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>Agenda & Sessões</span>
            </button>

            <button
              onClick={() => handleSelect('patients')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'patients'
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Gestão de Pacientes</span>
            </button>

            <button
              onClick={() => handleSelect('clinical')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'clinical'
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Prontuário & Evolução</span>
              </div>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                CFP
              </span>
            </button>

            <div className="pt-4 px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Gestão & Consultório
            </div>

            <button
              onClick={() => handleSelect('finance')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'finance'
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4 shrink-0" />
              <span>Módulo Financeiro</span>
            </button>

            <button
              onClick={() => handleSelect('availability')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'availability'
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>Horários & Intervalos</span>
            </button>
          </>
        );

      case 'clinic_manager':
        return (
          <>
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Gestão da Clínica
            </div>
            <button
              onClick={() => handleSelect('clinic_dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'clinic_dashboard'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Painel Administrativo</span>
            </button>

            <button
              onClick={() => handleSelect('clinic_rooms')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'clinic_rooms'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <DoorOpen className="w-4 h-4 shrink-0" />
              <span>Salas & Consultórios</span>
            </button>

            <button
              onClick={() => handleSelect('clinic_team')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'clinic_team'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>Corpo Clínico & Equipe</span>
            </button>

            <button
              onClick={() => handleSelect('clinic_schedule')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'clinic_schedule'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-4 h-4 shrink-0" />
              <span>Agenda Compartilhada</span>
            </button>

            <button
              onClick={() => handleSelect('clinic_finance')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'clinic_finance'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4 shrink-0" />
              <span>Financeiro da Clínica</span>
            </button>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Isolamento Ético</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Anotações clínicas e prontuários são mantidos estritamente confidenciais aos psicólogos responsáveis.
              </p>
            </div>
          </>
        );

      case 'patient':
        return (
          <>
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Área do Paciente
            </div>
            <button
              onClick={() => handleSelect('patient_appointments')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'patient_appointments'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>Meus Atendimentos</span>
            </button>

            <button
              onClick={() => handleSelect('patient_book')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'patient_book'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-4 h-4 shrink-0" />
              <span>Agendar Consulta</span>
            </button>

            <button
              onClick={() => handleSelect('patient_finance')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'patient_finance'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>Recibos & Pagamentos</span>
            </button>

            <button
              onClick={() => handleSelect('patient_profile')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'patient_profile'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Meus Dados Cadastrais</span>
            </button>
          </>
        );

      case 'superadmin':
        return (
          <>
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Governança da Plataforma
            </div>
            <button
              onClick={() => handleSelect('saas_overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'saas_overview'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>Métricas da Plataforma</span>
            </button>

            <button
              onClick={() => handleSelect('saas_tenants')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'saas_tenants'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Clínicas & Profissionais</span>
            </button>

            <button
              onClick={() => handleSelect('saas_plans')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'saas_plans'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Planos & Assinaturas</span>
            </button>

            <button
              onClick={() => handleSelect('saas_audit')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentTab === 'saas_audit'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Auditoria & LGPD</span>
            </button>
          </>
        );
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed md:sticky top-16 left-0 bottom-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } h-[calc(100vh-4rem)] overflow-y-auto`}
      >
        <div className="space-y-1">
          {renderNavLinks()}
        </div>

        {/* Security / System Footer */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-800 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Segurança & LGPD Ativos</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Criptografia de ponta a ponta e auditoria de prontuários em conformidade com CFP nº 01/2009.
            </p>
          </div>

          <div className="text-[11px] text-slate-400 text-center">
            Projeto Psi v1.0 • Produção SaaS
          </div>
        </div>
      </aside>
    </>
  );
};
