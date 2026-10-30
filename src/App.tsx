/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { PsychologistDashboard } from './components/dashboard/PsychologistDashboard';
import { ScheduleCalendar } from './components/schedule/ScheduleCalendar';
import { PatientListView } from './components/patients/PatientListView';
import { ClinicalRecordsView } from './components/clinical/ClinicalRecordsView';
import { FinancialModule } from './components/financial/FinancialModule';
import { ClinicManagementView } from './components/clinic/ClinicManagementView';
import { PatientPortalView } from './components/patient_portal/PatientPortalView';
import { SuperAdminView } from './components/admin/SuperAdminView';
import { AvailabilitySettings } from './components/availability/AvailabilitySettings';
import { AuthScreen } from './components/auth/AuthScreen';

const MainLayout: React.FC = () => {
  const { currentUser, loginUser, authLoading, persistenceError, clearPersistenceError } = useApp();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [initialPatientForClinical, setInitialPatientForClinical] = useState<string | undefined>(undefined);

  // Sync default tab when user switches role or signs in
  useEffect(() => {
    if (!currentUser) return;
    switch (currentUser.role) {
      case 'psychologist':
        setCurrentTab('dashboard');
        break;
      case 'clinic_manager':
        setCurrentTab('clinic_dashboard');
        break;
      case 'patient':
        setCurrentTab('patient_appointments');
        break;
      case 'superadmin':
        setCurrentTab('saas_overview');
        break;
    }
  }, [currentUser?.role]);

  // REQUIREMENT 2: Display safe loading screen while checking auth session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-teal-500/20 mb-4 animate-pulse">
          Ψ
        </div>
        <div className="flex items-center gap-2.5 text-slate-700 font-semibold text-sm">
          <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Verificando sessão segura...</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Projeto Psi • Gestão Clínica Especializada</p>
      </div>
    );
  }

  // REQUIREMENT 2: If not authenticated, render login/registration screen
  if (!currentUser) {
    return <AuthScreen onAuthenticated={loginUser} />;
  }


  const handleOpenClinicalRecords = (patientId: string) => {
    setInitialPatientForClinical(patientId);
    setCurrentTab('clinical');
  };

  const renderActiveView = () => {
    switch (currentTab) {
      // Psychologist Views
      case 'dashboard':
        return <PsychologistDashboard onNavigateTab={setCurrentTab} />;
      case 'schedule':
        return <ScheduleCalendar />;
      case 'patients':
        return <PatientListView onOpenClinicalRecords={handleOpenClinicalRecords} />;
      case 'clinical':
        return <ClinicalRecordsView initialPatientId={initialPatientForClinical} />;
      case 'finance':
        return <FinancialModule />;
      case 'availability':
        return <AvailabilitySettings />;

      // Clinic Manager Views
      case 'clinic_dashboard':
      case 'clinic_rooms':
      case 'clinic_team':
      case 'clinic_schedule':
        return <ClinicManagementView />;
      case 'clinic_finance':
        return <FinancialModule />;

      // Patient Views
      case 'patient_appointments':
        return <PatientPortalView initialTab="appointments" />;
      case 'patient_book':
        return <PatientPortalView initialTab="book" />;
      case 'patient_finance':
        return <PatientPortalView initialTab="finance" />;
      case 'patient_profile':
        return <PatientPortalView initialTab="profile" />;

      // SuperAdmin Views
      case 'saas_overview':
      case 'saas_tenants':
      case 'saas_plans':
      case 'saas_audit':
        return <SuperAdminView />;

      default:
        return <PsychologistDashboard onNavigateTab={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-teal-500 selection:text-white">
      <Navbar
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />

      <div className="flex-1 flex w-full">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
