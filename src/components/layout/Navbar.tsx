import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import {
  Bell,
  CheckCircle2,
  Calendar,
  AlertCircle,
  CreditCard,
  UserCheck,
  ChevronDown,
  Sparkles,
  Shield,
  Menu,
  X,
  LogOut
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
  isMobileSidebarOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar, isMobileSidebarOpen }) => {
  const {
    currentUser,
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    logout
  } = useApp();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  if (!currentUser) return null;

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'psychologist':
        return { label: 'Psicólogo Clínico', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'clinic_manager':
        return { label: 'Gestor de Clínica', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'patient':
        return { label: 'Paciente', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'superadmin':
        return { label: 'Administrador SaaS', color: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
  };

  const userNotifications = notifications.filter(n => n.recipientUserId === currentUser.uid);

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          aria-label={isMobileSidebarOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
        >
          {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-sm shadow-teal-500/20 font-bold text-lg">
            Ψ
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-lg">PROJETO PSI</span>
              <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200">
                SaaS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-none">Gestão Clínica Especializada</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Verified Role Badge (No client-side spoofing) */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium">
          <Shield className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-slate-500">Perfil Autenticado:</span>
          <span className="font-bold text-slate-900">{getRoleLabel(currentUser.role).label}</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notificações"
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 relative transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-teal-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Notificações</h3>
                    <p className="text-[11px] text-slate-500">{unreadCount} não lidas</p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {userNotifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Nenhuma notificação no momento.
                    </div>
                  ) : (
                    userNotifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationAsRead(n.id)}
                        className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${
                          !n.read ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <div className="mt-0.5">
                          {n.type === 'appointment_request' && (
                            <Calendar className="w-4 h-4 text-amber-600" />
                          )}
                          {n.type === 'appointment_confirmed' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                          {n.type === 'payment_received' && (
                            <CreditCard className="w-4 h-4 text-teal-600" />
                          )}
                          {n.type === 'appointment_rejected' && (
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                          )}
                          {!['appointment_request', 'appointment_confirmed', 'payment_received', 'appointment_rejected'].includes(n.type) && (
                            <Bell className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${!n.read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {n.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-teal-600 mt-1 shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Card & Logout */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <img
            src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=256&q=80'}
            alt={currentUser.displayName}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
          />
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-tight">
              {currentUser.displayName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${getRoleLabel(currentUser.role).color}`}>
                {getRoleLabel(currentUser.role).label}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sair da conta"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
