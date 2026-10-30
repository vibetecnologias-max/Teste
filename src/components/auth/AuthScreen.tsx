import React, { useState } from 'react';
import {
  loginWithEmail,
  registerWithEmail,
  sendPasswordReset,
  loginWithGoogle
} from '../../services/authService';
import { UserProfile, UserRole } from '../../types';
import { SEED_USERS } from '../../data/seedData';
import {
  Lock,
  Mail,
  User,
  Phone,
  Building2,
  FileCheck,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  KeyRound
} from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [role, setRole] = useState<UserRole>('psychologist');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [crp, setCrp] = useState('');
  const [clinicName, setClinicName] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const profile = await loginWithEmail(email, password);
      onAuthenticated(profile);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMessage('O provedor Email/Senha ainda não está ativado no Firebase Console deste projeto. Utilize o botão Google ou o Acesso de Homologação abaixo.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setErrorMessage('E-mail ou senha incorretos.');
      } else {
        setErrorMessage(err.message || 'Erro ao realizar login.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const profile = await registerWithEmail(
        email,
        password,
        displayName,
        role,
        { phone, crp, clinicName }
      );
      setSuccessMessage('Conta cadastrada com sucesso!');
      setTimeout(() => onAuthenticated(profile), 1000);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMessage('Provedor Email/Senha deve ser habilitado no Firebase Console. Utilize o Acesso de Homologação abaixo.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMessage('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setErrorMessage(err.message || 'Erro ao criar conta.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await sendPasswordReset(email);
      setSuccessMessage('E-mail de redefinição de senha enviado com sucesso! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Não foi possível enviar o e-mail de redefinição.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const profile = await loginWithGoogle();
      onAuthenticated(profile);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro na autenticação Google.');
    } finally {
      setLoading(false);
    }
  };

  // Instant pre-configured login for fast testing
  const handleQuickLogin = (userIndex: number) => {
    const selected = SEED_USERS[userIndex];
    onAuthenticated(selected);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4 selection:bg-teal-500 selection:text-white">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Brand Header */}
        <div className="p-6 bg-gradient-to-tr from-teal-700 to-emerald-600 text-white text-center relative">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 text-2xl font-bold ring-2 ring-white/20">
            Ψ
          </div>
          <h1 className="text-xl font-bold tracking-tight">PROJETO PSI</h1>
          <p className="text-teal-100 text-xs mt-1">Plataforma de Gestão Especializada para Psicologia</p>
        </div>

        {/* Content Box */}
        <div className="p-6 space-y-4">
          {/* Navigation modes */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => { setMode('login'); setErrorMessage(null); setSuccessMessage(null); }}
              className={`flex-1 py-2 rounded-lg transition-all ${mode === 'login' ? 'bg-white text-teal-900 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setMode('register'); setErrorMessage(null); setSuccessMessage(null); }}
              className={`flex-1 py-2 rounded-lg transition-all ${mode === 'register' ? 'bg-white text-teal-900 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Criar Conta
            </button>
            <button
              onClick={() => { setMode('forgot'); setErrorMessage(null); setSuccessMessage(null); }}
              className={`flex-1 py-2 rounded-lg transition-all ${mode === 'forgot' ? 'bg-white text-teal-900 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Recuperar
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail Profissional ou do Paciente</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Senha</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-teal-600 hover:text-teal-700 font-medium text-[11px]"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Acessar Plataforma'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              {/* Role Picker */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Tipo de Perfil</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('psychologist')}
                    className={`p-2 rounded-xl border text-center transition-all ${role === 'psychologist' ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold' : 'border-slate-200 text-slate-600'}`}
                  >
                    <div className="font-bold text-[11px]">Psicólogo</div>
                    <div className="text-[9px] text-slate-500">Autônomo</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('clinic_manager')}
                    className={`p-2 rounded-xl border text-center transition-all ${role === 'clinic_manager' ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold' : 'border-slate-200 text-slate-600'}`}
                  >
                    <div className="font-bold text-[11px]">Clínica</div>
                    <div className="text-[9px] text-slate-500">Gestor</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('patient')}
                    className={`p-2 rounded-xl border text-center transition-all ${role === 'patient' ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold' : 'border-slate-200 text-slate-600'}`}
                  >
                    <div className="font-bold text-[11px]">Paciente</div>
                    <div className="text-[9px] text-slate-500">Individual</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {role === 'psychologist' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Registro Profissional (CRP) *</label>
                  <input
                    type="text"
                    required
                    value={crp}
                    onChange={(e) => setCrp(e.target.value)}
                    placeholder="Ex: CRP 06/123456-SP"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              )}

              {role === 'clinic_manager' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome Fantasia da Clínica *</label>
                  <input
                    type="text"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Ex: Clínica Equilíbrio e Mente"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-8888"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Senha de Acesso (mínimo 6 dígitos) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                {loading ? 'Cadastrando...' : 'Finalizar Cadastro'}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-3.5 text-xs">
              <p className="text-slate-500 text-xs">
                Digite seu e-mail cadastrado. Enviaremos um link seguro para você redefinir sua senha de acesso.
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail Cadastrado</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
              >
                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>
            </form>
          )}

          {/* Google Sign-in Option */}
          <div className="pt-2">
            <div className="relative flex py-2 items-center">
              <div className="grow border-t border-slate-200"></div>
              <span className="shrink mx-2 text-[10px] text-slate-400 font-semibold uppercase">ou</span>
              <div className="grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continuar com Google</span>
            </button>
          </div>

          {/* Quick Demo Access for Evaluators */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Acesso Rápido para Testes e Homologação:</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => handleQuickLogin(0)}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-left transition-colors"
              >
                <div className="font-bold text-slate-800 truncate">Dr. Marcos</div>
                <div className="text-teal-700">Psicólogo</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin(1)}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-left transition-colors"
              >
                <div className="font-bold text-slate-800 truncate">Dra. Beatriz</div>
                <div className="text-blue-700">Gestora</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin(2)}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-left transition-colors"
              >
                <div className="font-bold text-slate-800 truncate">Juliana Prado</div>
                <div className="text-purple-700">Paciente</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Security Badge */}
        <div className="p-3 bg-slate-50 text-center border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Criptografia de ponta a ponta • Sigilo Ético CFP • LGPD</span>
        </div>
      </div>
    </div>
  );
};
