import React, { useState } from 'react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  LogIn, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Check,
  UserPlus,
  Building2,
  Code,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Info,
  Search,
  Database,
  Server,
  Key,
  HardDrive,
  RefreshCw
} from 'lucide-react';
import { ManagerUser, ManagerRole, PointLocation, CompanyOrganization, LegalEntityType, YdbConfig } from '../../types';
import { 
  PRESET_MANAGERS, 
  getAllManagersWithAuth, 
  loginManager, 
  loginManagerAsync,
  quickSwitchManager, 
  registerManagerUser,
  ROLE_PERMISSIONS,
  isDemoSession
} from '../../services/managerAuth';
import {
  getOrganizations,
  findOrganizationByInn,
  registerOrganization,
  cleanInnString,
} from '../../services/companyService';
import {
  generateIsolatedYdbConfig,
  testYdbConnection,
  ISOLATED_YDB_TABLES,
} from '../../services/ydbService';

interface ManagerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: ManagerUser | null;
  onLoginSuccess: (user: ManagerUser) => void;
  points?: PointLocation[];
}

export const ManagerLoginModal: React.FC<ManagerLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  points = [],
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(() => 
    isDemoSession() ? 'register' : 'login'
  );
  
  // Login form state
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regLogin, setRegLogin] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regRole, setRegRole] = useState<ManagerRole>('manager');
  const [regSelectedPoints, setRegSelectedPoints] = useState<string[]>(['all']);
  const [regPhone, setRegPhone] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  // Mandatory Organization binding state: ONLY SEARCH BY INN (No preselection or quick list)
  const [innInput, setInnInput] = useState<string>('');
  const [matchedOrg, setMatchedOrg] = useState<CompanyOrganization | null>(null);
  const [innSearchStatus, setInnSearchStatus] = useState<'idle' | 'found' | 'not_found'>('idle');

  // Inline new organization registration state (when INN not found in registry)
  const [isRegisteringOrg, setIsRegisteringOrg] = useState(false);
  const [newOrgLegalType, setNewOrgLegalType] = useState<LegalEntityType>('OOO');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgBrand, setNewOrgBrand] = useState('');
  const [newOrgOgrn, setNewOrgOgrn] = useState('');
  const [newOrgDirector, setNewOrgDirector] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');
  const [newOrgPhone, setNewOrgPhone] = useState('');
  const [newOrgAddress, setNewOrgAddress] = useState('');
  const [orgFormError, setOrgFormError] = useState<string | null>(null);
  const [orgFormSuccess, setOrgFormSuccess] = useState<string | null>(null);

  // Isolated YDB Setup State for New Organization
  const [ydbTesting, setYdbTesting] = useState(false);
  const [ydbTestResult, setYdbTestResult] = useState<{ success: boolean; pingMs: number; error?: string } | null>(null);
  const [showAdvancedYdbConfig, setShowAdvancedYdbConfig] = useState(false);
  const [customYdbEndpoint, setCustomYdbEndpoint] = useState('grpcs://ydb.serverless.yandexcloud.net:2135');
  const [customYdbDatabase, setCustomYdbDatabase] = useState('');

  // Environment check for demo presets quick login in 1-click
  const showDemoProfiles = import.meta.env.VITE_SHOW_DEMO_PROFILES === 'true';

  if (!isOpen) return null;

  const handleInnSearch = (val: string) => {
    setInnInput(val);
    setOrgFormError(null);
    setOrgFormSuccess(null);
    setYdbTestResult(null);
    const clean = cleanInnString(val);
    if (!clean || (clean.length !== 10 && clean.length !== 12)) {
      setInnSearchStatus('idle');
      setMatchedOrg(null);
      setIsRegisteringOrg(false);
      return;
    }
    const found = findOrganizationByInn(clean);
    if (found) {
      setMatchedOrg(found);
      setInnSearchStatus('found');
      setIsRegisteringOrg(false);
    } else {
      setMatchedOrg(null);
      setInnSearchStatus('not_found');
      setIsRegisteringOrg(true);
      setCustomYdbDatabase(`/ru-central1/b1g88k2v84j901la2c/ydb-org-${clean}`);
      if (clean.length === 12) {
        setNewOrgLegalType('IP');
        if (regName && !newOrgName) setNewOrgName(`ИП ${regName}`);
      } else {
        setNewOrgLegalType('OOO');
      }
      if (regName && !newOrgDirector) {
        setNewOrgDirector(regName);
      }
    }
  };

  const handleTestIsolatedYdb = async () => {
    setYdbTesting(true);
    setYdbTestResult(null);
    const clean = cleanInnString(innInput) || 'default';
    const cfg = generateIsolatedYdbConfig(newOrgName || 'Новое Юр. Лицо', clean);
    if (customYdbDatabase) cfg.database = customYdbDatabase;
    if (customYdbEndpoint) cfg.endpoint = customYdbEndpoint;

    const res = await testYdbConnection(cfg);
    setYdbTesting(false);
    setYdbTestResult(res);
  };

  const handleRegisterNewOrgInline = (): CompanyOrganization | null => {
    setOrgFormError(null);
    const clean = cleanInnString(innInput);
    if (!clean || (clean.length !== 10 && clean.length !== 12)) {
      setOrgFormError('ИНН должен содержать 10 цифр (для ООО) или 12 цифр (для ИП)');
      return null;
    }
    if (!newOrgName.trim()) {
      setOrgFormError('Укажите наименование юридического лица');
      return null;
    }
    if (!newOrgDirector.trim()) {
      setOrgFormError('Укажите ФИО руководителя');
      return null;
    }

    // Prepare isolated YDB instance config
    const isolatedYdb = generateIsolatedYdbConfig(newOrgName.trim(), clean);
    if (customYdbDatabase.trim()) isolatedYdb.database = customYdbDatabase.trim();
    if (customYdbEndpoint.trim()) isolatedYdb.endpoint = customYdbEndpoint.trim();

    const regResult = registerOrganization({
      legalType: newOrgLegalType,
      name: newOrgName.trim(),
      brandName: newOrgBrand.trim() || newOrgName.trim(),
      inn: clean,
      ogrn: newOrgOgrn.trim() || '—',
      directorName: newOrgDirector.trim(),
      email: newOrgEmail.trim() || regEmail || `${regLogin}@horeca-group.ru`,
      phone: newOrgPhone.trim() || regPhone || '+7 (999) 000-00-00',
      address: newOrgAddress.trim() || 'г. Москва',
      ydbConfig: isolatedYdb,
    });

    if (regResult.success && regResult.organization) {
      setMatchedOrg(regResult.organization);
      setInnSearchStatus('found');
      setIsRegisteringOrg(false);
      setOrgFormSuccess(`✓ Юридическое лицо «${regResult.organization.name}» и изолированная база YDB успешно созданы!`);
      return regResult.organization;
    } else {
      setOrgFormError(regResult.error || 'Ошибка при регистрации организации');
      return null;
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await loginManagerAsync(loginInput, passwordInput);
      setLoginLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
        onClose();
      } else {
        setLoginError(res.error || 'Ошибка входа');
      }
    } catch (err: any) {
      setLoginLoading(false);
      setLoginError(err?.message || 'Ошибка входа');
    }
  };

  const handleQuickSelect = (presetId: string) => {
    setLoginError(null);
    const user = quickSwitchManager(presetId);
    if (user) {
      onLoginSuccess(user);
      onClose();
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) {
      setRegError('Укажите ФИО сотрудника');
      return;
    }
    if (!regLogin.trim()) {
      setRegError('Укажите логин');
      return;
    }
    if (regPassword.length < 4) {
      setRegError('Пароль должен содержать не менее 4 символов');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setRegError('Пароли не совпадают');
      return;
    }

    // Check mandatory legal entity attachment
    let orgToAttach = matchedOrg;
    if (!orgToAttach && isRegisteringOrg) {
      orgToAttach = handleRegisterNewOrgInline();
      if (!orgToAttach) {
        return;
      }
    }

    if (!orgToAttach) {
      setRegError('Обязательное условие: новый пользователь должен быть привязан к зарегистрированному юридическому лицу (найдено по ИНН или зарегистрировано в системе)');
      return;
    }

    setRegLoading(true);

    setTimeout(async () => {
      const res = await registerManagerUser({
        name: regName,
        login: regLogin,
        email: regEmail || `${regLogin}@horeca-group.ru`,
        password: regPassword,
        role: regRole,
        assignedPoints: regSelectedPoints,
        phone: regPhone,
        organizationId: orgToAttach!.id,
        organizationName: orgToAttach!.name,
        organizationInn: orgToAttach!.inn,
      });

      setRegLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
        onClose();
      } else {
        setRegError(res.error || 'Ошибка при регистрации');
      }
    }, 300);
  };

  const getRoleBadge = (role: ManagerRole) => {
    const info = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.manager;
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${info.badgeColor}`}>
        {info.title}
      </span>
    );
  };

  const testIds = ['mgr-director-smirnov', 'mgr-dev', 'mgr-unit', 'mgr-auditor', 'mgr-qc', 'mgr-holding-director', 'mgr-vasilieva-director'];
  const testOrgIds = ['org-smirnov', 'org-holding', 'org-vasilieva'];

  const activeOrgId = typeof window !== 'undefined' ? localStorage.getItem('checklist_active_organization_id_v1') : null;
  const isCustomOrg = activeOrgId && !testOrgIds.includes(activeOrgId);
  const isClean = typeof window !== 'undefined' && (
    localStorage.getItem('checklist_clean_start_mode_v1') === 'true' ||
    localStorage.getItem('checklist_ydb_custom_configured_v1') === 'true' ||
    Boolean(isCustomOrg)
  );

  // Exclude app_admin from regular establishment profiles quick selector, and filter out demo test accounts in clean mode
  const allManagers = getAllManagersWithAuth()
    .filter(m => m.role !== 'app_admin')
    .filter(m => {
      if (isClean) {
        if (testIds.includes(m.id) || testOrgIds.includes(m.organizationId || '')) {
          return false;
        }
        return !currentUser?.organizationId || m.organizationId === currentUser.organizationId;
      }
      return true;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-6 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-6 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Кабинет управления и авторизация</h3>
                <p className="text-xs text-slate-400">Разграничение прав: Разработчик, Управляющий, Аудитор</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center space-x-2 mt-5 p-1 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                activeTab === 'login'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Вход в систему</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                activeTab === 'register'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Регистрация персонала</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Active User Status Banner */}
          {currentUser && (
            <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-500/40"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <span>{currentUser.name}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{currentUser.roleTitle}</div>
                </div>
              </div>
              <div>
                {getRoleBadge(currentUser.role)}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: LOGIN TAB */}
          {/* ========================================================================= */}
          {activeTab === 'login' && (
            <div className="space-y-5">
              {/* Quick Profile Switching or Clean info */}
              {showDemoProfiles && !isClean && allManagers.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Быстрый выбор тестового профиля (1 клик):</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Готовые роли</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allManagers.map(preset => {
                      const isSelected = currentUser?.id === preset.id;
                      const roleInfo = ROLE_PERMISSIONS[preset.role] || ROLE_PERMISSIONS.manager;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleQuickSelect(preset.id)}
                          className={`p-3 rounded-2xl text-left transition border flex items-start space-x-2.5 ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-750 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <img 
                            src={preset.avatarUrl} 
                            alt={preset.name} 
                            className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-300 dark:ring-slate-700 mt-0.5" 
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate text-slate-900 dark:text-white flex items-center justify-between">
                              <span>{preset.name}</span>
                              {isSelected && <Check className="w-3 h-3 text-amber-500 shrink-0" />}
                            </div>
                            <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 truncate">
                              {roleInfo.title}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate mt-0.5">
                              {preset.role === 'developer' 
                                ? '✨ Все разделы + YDB + MinIO' 
                                : preset.role === 'manager'
                                ? '📝 Чек-листы + DataLens отчёты'
                                : '🔍 Аудит и стандарты'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isClean && allManagers.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-slate-800 dark:text-slate-200">
                  <div className="font-bold flex items-center space-x-2 text-amber-600 dark:text-amber-400 mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Учётная запись руководителя организации:</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{allManagers[0].name}</span>
                      <span className="text-slate-500 text-[11px] block mt-0.5">
                        Логин: <code className="font-mono text-amber-600 dark:text-amber-400 font-bold">{allManagers[0].login}</code> • Пароль: <code className="font-mono text-amber-600 dark:text-amber-400 font-bold">admin2026</code>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickSelect(allManagers[0].id)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-xs shrink-0 ml-2"
                    >
                      Войти в 1 клик
                    </button>
                  </div>
                </div>
              )}

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  или ручной вход по логину / паролю
                </span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              {/* Manual Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {loginError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Логин или рабочий Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={loginInput}
                      onChange={e => setLoginInput(e.target.value)}
                      placeholder={isClean ? "director или ваш email" : "developer, manager, director или ваш email"}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Пароль
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {isClean ? 'Пароль по умолчанию: admin2026' : 'Тест: dev2026 / manager2026 / admin2026'}
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-2"
                >
                  {loginLoading ? (
                    <span className="flex items-center space-x-2">
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                      <span>Проверка полномочий...</span>
                    </span>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Войти в систему</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: REGISTER TAB */}
          {/* ========================================================================= */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {regError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {/* Role Selection with Clear Visual Permissions Explanation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Управленческая роль и уровень доступа
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div
                    onClick={() => setRegRole('developer')}
                    className={`p-3 rounded-2xl border cursor-pointer transition ${
                      regRole === 'developer'
                        ? 'border-purple-500 bg-purple-500/10 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 font-bold text-xs">
                      <Code className="w-4 h-4 text-purple-500" />
                      <span>Разработчик / DevOps</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Доступны <strong>ВСЕ разделы</strong>: YDB SQL, MinIO VPS, Конструктор, DataLens, Персонал.
                    </p>
                  </div>

                  <div
                    onClick={() => setRegRole('manager')}
                    className={`p-3 rounded-2xl border cursor-pointer transition ${
                      regRole === 'manager'
                        ? 'border-blue-500 bg-blue-500/10 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 font-bold text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                      <span>Управляющий сети</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      <strong>Добавление чек-листов</strong> и <strong>доступ к отчётности</strong>. Низкоуровневые БД скрыты.
                    </p>
                  </div>

                  <div
                    onClick={() => setRegRole('owner')}
                    className={`p-3 rounded-2xl border cursor-pointer transition ${
                      regRole === 'owner'
                        ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 font-bold text-xs">
                      <Building2 className="w-4 h-4 text-amber-500" />
                      <span>Владелец сети / Директор</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Сводные отчеты DataLens, Конструктор, точки, персонал и Telegram-оповещения.
                    </p>
                  </div>

                  <div
                    onClick={() => setRegRole('auditor')}
                    className={`p-3 rounded-2xl border cursor-pointer transition ${
                      regRole === 'auditor'
                        ? 'border-emerald-500 bg-emerald-500/10 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>Аудитор ХАССП</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Отчеты о соблюдении санитарных норм, проверка чек-листов и стандарты качества.
                    </p>
                  </div>
                </div>

                {/* Role detail highlight callout */}
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-start space-x-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    {regRole === 'developer' && (
                      <span><strong>Разработчик:</strong> полный доступ ко всем техническим сервисам: YDB консоль, MinIO S3 ключи, DataLens, конструктор чек-листов, QR-генератор и PWA.</span>
                    )}
                    {regRole === 'manager' && (
                      <span><strong>Управляющий:</strong> добавление и редактирование чек-листов в Конструкторе, аналитика и отчётность в DataLens, оргструктура точек и печать QR. Разделы YDB и MinIO заблокированы.</span>
                    )}
                    {regRole === 'owner' && (
                      <span><strong>Владелец:</strong> доступ к бизнес-отчётности DataLens, конструктору чек-листов, точкам и оповещениям в Telegram.</span>
                    )}
                    {regRole === 'auditor' && (
                      <span><strong>Аудитор ХАССП:</strong> доступ к аналитике нарушений DataLens, конструктору санитарных стандартов и проверке смен.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION: Mandatory Legal Entity Binding by INN */}
              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                        <span>Обязательная привязка к юр. лицу (ИП / ООО)</span>
                        <span className="text-rose-500">*</span>
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Поиск организации в системе по ИНН. Если не найдена — первичная регистрация.
                      </p>
                    </div>
                  </div>
                  {matchedOrg && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Привязано</span>
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    ИНН организации (10 цифр для ООО, 12 цифр для ИП) *
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={innInput}
                        onChange={e => handleInnSearch(e.target.value)}
                        placeholder="Например: 772481928412 или 7810984521"
                        maxLength={12}
                        className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInnSearch(innInput)}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition shrink-0 flex items-center space-x-1.5 shadow-xs"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Найти по ИНН</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Поиск строго по ИНН организации в федеральном реестре системы
                  </p>
                </div>

                {/* Status: Found in system */}
                {innSearchStatus === 'found' && matchedOrg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Головное юр. лицо найдено в реестре</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMatchedOrg(null);
                          setInnSearchStatus('idle');
                          setInnInput('');
                        }}
                        className="text-[10px] underline hover:text-emerald-600 dark:hover:text-emerald-300 text-slate-500"
                      >
                        Сменить ИНН
                      </button>
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">
                        {matchedOrg.name}
                      </p>
                      {matchedOrg.brandName && matchedOrg.brandName !== matchedOrg.name && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          Бренд: {matchedOrg.brandName}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 dark:text-slate-300 pt-0.5 border-t border-emerald-500/20">
                      <div><strong>ИНН:</strong> <span className="font-mono">{matchedOrg.inn}</span></div>
                      <div><strong>ОГРН:</strong> <span className="font-mono">{matchedOrg.ogrn}</span></div>
                      <div><strong>Руководитель:</strong> {matchedOrg.directorName}</div>
                      <div><strong>Тариф:</strong> {matchedOrg.currentTariffId}</div>
                    </div>
                    {matchedOrg.ydbConfig && (
                      <div className="pt-1 text-[10px] flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 font-mono">
                        <Database className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">Изолированная YDB: {matchedOrg.ydbConfig.database}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status: NOT FOUND -> Require Registration with Pre-configured Isolated YDB */}
                {innSearchStatus === 'not_found' && (
                  <div className="space-y-3 pt-1">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">
                            Юр. лицо с ИНН {cleanInnString(innInput)} не зарегистрировано
                          </p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
                            Юр. лицо является наикрупнейшей ячейкой авторизации. Для регистрации заполните реквизиты: будет развернута изолированная база данных YDB со всеми таблицами.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <h5 className="font-bold text-xs text-slate-900 dark:text-white flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Первичная регистрация юридического лица</span>
                      </h5>

                      {orgFormError && (
                        <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-1.5 rounded-lg">
                          {orgFormError}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Правовая форма</label>
                          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
                            <button
                              type="button"
                              onClick={() => setNewOrgLegalType('OOO')}
                              className={`flex-1 py-1 font-bold ${newOrgLegalType === 'OOO' ? 'bg-amber-500 text-slate-950' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                            >
                              ООО
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewOrgLegalType('IP')}
                              className={`flex-1 py-1 font-bold ${newOrgLegalType === 'IP' ? 'bg-amber-500 text-slate-950' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                            >
                              ИП
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">ОГРН / ОГРНИП</label>
                          <input
                            type="text"
                            value={newOrgOgrn}
                            onChange={e => setNewOrgOgrn(e.target.value)}
                            placeholder={newOrgLegalType === 'OOO' ? '13 цифр' : '15 цифр'}
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Полное наименование организации *</label>
                        <input
                          type="text"
                          required
                          value={newOrgName}
                          onChange={e => setNewOrgName(e.target.value)}
                          placeholder={newOrgLegalType === 'OOO' ? 'ООО "Кофе Холдинг"' : 'ИП Смирнов А.В.'}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Торговый бренд / вывеска</label>
                          <input
                            type="text"
                            value={newOrgBrand}
                            onChange={e => setNewOrgBrand(e.target.value)}
                            placeholder="Кофе Точка"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">ФИО руководителя *</label>
                          <input
                            type="text"
                            required
                            value={newOrgDirector}
                            onChange={e => setNewOrgDirector(e.target.value)}
                            placeholder="Смирнов А.В."
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Email юр. лица</label>
                          <input
                            type="email"
                            value={newOrgEmail}
                            onChange={e => setNewOrgEmail(e.target.value)}
                            placeholder="info@company.ru"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Телефон юр. лица</label>
                          <input
                            type="tel"
                            value={newOrgPhone}
                            onChange={e => setNewOrgPhone(e.target.value)}
                            placeholder="+7 (999) 000-00-00"
                            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Юридический адрес</label>
                        <input
                          type="text"
                          value={newOrgAddress}
                          onChange={e => setNewOrgAddress(e.target.value)}
                          placeholder="г. Москва, ул. Арбат, д. 10"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>

                      {/* PRE-CONFIGURED ISOLATED YDB STORAGE BOX (Requirement 3) */}
                      <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <div>
                              <div className="text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                                Изолированная база YDB для юр. лица
                              </div>
                              <div className="text-[9px] text-indigo-700 dark:text-indigo-300">
                                Выделенный кластер Yandex Database для полного разделения данных
                              </div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold">
                            Serverless Free Tier
                          </span>
                        </div>

                        {/* Database path & info */}
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-900/30 font-mono text-[10px] space-y-1">
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>База данных (Database Path):</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Изолирована</span>
                          </div>
                          <div className="text-indigo-600 dark:text-indigo-400 break-all font-semibold">
                            {customYdbDatabase || `/ru-central1/b1g88k2v84j901la2c/ydb-org-${cleanInnString(innInput)}`}
                          </div>
                        </div>

                        {/* 9 Isolated Tables Schema chips */}
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                            Изолированные таблицы данных (хранятся только в этой YDB):
                          </span>
                          <div className="grid grid-cols-3 gap-1 text-[9px]">
                            {ISOLATED_YDB_TABLES.map(t => (
                              <div 
                                key={t.name}
                                className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 flex items-center justify-between"
                                title={t.label}
                              >
                                <span className="font-mono text-slate-800 dark:text-slate-200 truncate">{t.name}</span>
                                <span className="text-[8px] text-slate-400 shrink-0 ml-1 truncate max-w-[80px]">{t.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Pre-flight connectivity check */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={handleTestIsolatedYdb}
                            disabled={ydbTesting}
                            className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[10px] font-bold transition flex items-center space-x-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${ydbTesting ? 'animate-spin' : ''}`} />
                            <span>{ydbTesting ? 'Проверка...' : 'Проверить доступность YDB'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowAdvancedYdbConfig(!showAdvancedYdbConfig)}
                            className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                          >
                            {showAdvancedYdbConfig ? 'Скрыть параметры' : 'Настроить endpoint'}
                          </button>
                        </div>

                        {ydbTestResult && (
                          <div className={`p-2 rounded-lg text-[10px] font-semibold flex items-center space-x-1.5 ${
                            ydbTestResult.success 
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {ydbTestResult.success
                                ? `✓ YDB подключена успешно! Пинг: ${ydbTestResult.pingMs} мс. Схема DDL 9 таблиц готова к развертыванию.`
                                : `Ошибка подключения: ${ydbTestResult.error}`}
                            </span>
                          </div>
                        )}

                        {showAdvancedYdbConfig && (
                          <div className="pt-2 border-t border-indigo-200 dark:border-indigo-900/40 space-y-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">
                                Endpoint Yandex Database:
                              </label>
                              <input
                                type="text"
                                value={customYdbEndpoint}
                                onChange={e => setCustomYdbEndpoint(e.target.value)}
                                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">
                                Путь базы данных (Database):
                              </label>
                              <input
                                type="text"
                                value={customYdbDatabase}
                                onChange={e => setCustomYdbDatabase(e.target.value)}
                                className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleRegisterNewOrgInline}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5 shadow-md"
                      >
                        <Building2 className="w-3.5 h-3.5 text-amber-400 dark:text-slate-950" />
                        <span>Создать юр. лицо с изолированной YDB и привязать</span>
                      </button>
                    </div>
                  </div>
                )}

                {orgFormSuccess && (
                  <p className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg">
                    {orgFormSuccess}
                  </p>
                )}
              </div>

              {/* Personal info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ФИО сотрудника *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Сергей Иванов"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Логин для входа *
                  </label>
                  <input
                    type="text"
                    required
                    value={regLogin}
                    onChange={e => setRegLogin(e.target.value)}
                    placeholder="sergey_mgr"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Рабочий Email
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="sergey@horeca-group.ru"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Контактный телефон
                  </label>
                  <input
                    type="text"
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value)}
                    placeholder="+7 (999) 000-00-00"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Password fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Пароль *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Минимум 4 символа"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Подтверждение пароля *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPasswordConfirm}
                    onChange={e => setRegPasswordConfirm(e.target.value)}
                    placeholder="Повторите пароль"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-2"
              >
                {regLoading ? (
                  <span className="flex items-center space-x-2">
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Создание профиля...</span>
                  </span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Зарегистрировать и войти в систему</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
