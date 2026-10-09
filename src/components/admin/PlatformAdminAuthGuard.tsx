import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  ArrowLeft, 
  LogIn, 
  AlertCircle, 
  Building2, 
  User, 
  KeyRound, 
  CheckCircle2,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { ManagerUser } from '../../types';
import { loginManager } from '../../services/managerAuth';

interface PlatformAdminAuthGuardProps {
  currentUser: ManagerUser | null;
  onLoginSuccess: (adminUser: ManagerUser) => void;
  onExit: () => void;
  onLogout?: () => void;
}

export const PlatformAdminAuthGuard: React.FC<PlatformAdminAuthGuardProps> = ({
  currentUser,
  onLoginSuccess,
  onExit,
  onLogout
}) => {
  const [showLoginForm, setShowLoginForm] = useState<boolean>(!currentUser);
  const [loginInput, setLoginInput] = useState<string>('appadmin');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isCurrentManagerNonAdmin = currentUser && currentUser.role !== 'app_admin';

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!loginInput.trim()) {
      setAuthError('Укажите логин администратора');
      return;
    }
    if (!passwordInput.trim()) {
      setAuthError('Введите пароль');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = loginManager(loginInput.trim(), passwordInput.trim());
      setIsLoading(false);

      if (!res.success || !res.user) {
        setAuthError(res.error || 'Неверный логин или пароль администратора');
        return;
      }

      // Strict role check: must be app_admin
      if (res.user.role !== 'app_admin') {
        setAuthError(
          `Пользователь «${res.user.name}» имеет роль «${res.user.roleTitle || res.user.role}». Данная роль не имеет прав платформенного администратора.`
        );
        return;
      }

      onLoginSuccess(res.user);
    }, 250);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex items-center justify-center p-4">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.08),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.06),transparent_50%)] pointer-events-none" />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* State 1: A non-admin manager is currently logged in and attempted to open the admin panel */}
        {isCurrentManagerNonAdmin && !showLoginForm ? (
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                  Безопасность платформы
                </span>
                <h2 className="text-xl font-black text-white mt-0.5">
                  Доступ ограничен
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Панель администратора приложения доступна только системным администраторам платформы.
                </p>
              </div>
            </div>

            {/* Current User Card */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-3">
                <img 
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'} 
                  alt={currentUser.name} 
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-700" 
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                  <div className="text-xs text-amber-400 font-semibold">{currentUser.roleTitle || currentUser.role}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center space-x-1.5 truncate">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{currentUser.organizationName || 'Локальное заведение'}</span>
                </span>
                {currentUser.organizationInn && (
                  <span className="font-mono text-[11px] text-slate-500 shrink-0">
                    ИНН: {currentUser.organizationInn}
                  </span>
                )}
              </div>
            </div>

            {/* Explanatory banner */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed flex items-start space-x-2.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                Управленческие профили заведений работают в рамках своего юридического лица. Глобальное управление клиентами, тарифами и системными базами YDB требует роли <strong>Администратора платформы (app_admin)</strong>.
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={onExit}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/10"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Вернуться в кабинет заведения</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLoginForm(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition flex items-center justify-center space-x-2"
              >
                <KeyRound className="w-3.5 h-3.5 text-rose-400" />
                <span>Войти как администратор платформы</span>
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-rose-300 text-xs transition flex items-center justify-center space-x-1.5"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Выйти из текущего аккаунта</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* State 2: Platform Admin Login Form */
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                  Платформа Super Admin
                </span>
                <h2 className="text-xl font-black text-white mt-0.5">
                  Вход в панель администратора
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Авторизация главного администратора системы (app_admin)
                </p>
              </div>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{authError}</div>
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Логин администратора платформы
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="appadmin"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 placeholder-slate-600 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Пароль администратора
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 placeholder-slate-600 transition font-mono"
                    required
                  />
                </div>
              </div>

              {/* Demo / System Credentials Helper */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginInput('appadmin');
                    setPasswordInput('admin2026');
                    setAuthError(null);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between text-[11px] text-slate-400 transition cursor-pointer text-left"
                >
                  <span className="flex items-center space-x-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Главный Root-аккаунт (нажмите для ввода):</span>
                  </span>
                  <span className="font-mono text-slate-300 font-semibold shrink-0 ml-2">
                    appadmin / admin2026
                  </span>
                </button>
                <p className="text-[10px] text-slate-400 px-1 text-center">
                  Коллеги и инженеры техподдержки входят по персональным логинам, выданным в панели
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/20"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isLoading ? 'Проверка прав...' : 'Войти в панель администратора'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isCurrentManagerNonAdmin) {
                      setShowLoginForm(false);
                    } else {
                      onExit();
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Вернуться в приложение</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
