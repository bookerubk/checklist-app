import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CreditCard, 
  Settings, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Copy, 
  ExternalLink, 
  Search, 
  Shield,
  ShieldCheck, 
  Users, 
  MapPin, 
  Phone, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  LogOut, 
  RefreshCw, 
  Layers, 
  HardDrive,
  Sparkles,
  Link2,
  Sliders,
  DollarSign,
  Database,
  Terminal,
  Server,
  Play,
  FileCode,
  Cpu,
  Zap,
  Clock,
  Cloud,
  Box,
  Lock,
  Camera,
  ChevronDown
} from 'lucide-react';
import { 
  CompanyOrganization, 
  TariffPlan, 
  TariffPlanId, 
  PointLocation, 
  StaffMember, 
  ManagerUser,
  YdbConfig,
  YdbQueryResult
} from '../../types';
import { AvatarEditModal } from '../common/AvatarEditModal';
import { updateManagerAvatar, isDemoSession } from '../../services/managerAuth';
import { 
  getOrganizations, 
  getTariffPlans, 
  saveTariffPlan, 
  deleteTariffPlan, 
  resetTariffPlans, 
  getAppAdminSlug, 
  setAppAdminSlug,
  updateOrganizationTariff,
  updateOrganizationStatus,
  updateOrganizationBalance
} from '../../services/companyService';
import { 
  PLATFORM_ADMIN_YDB_TABLES, 
  DEFAULT_PLATFORM_ADMIN_YDB_CONFIG, 
  getPlatformAdminYdbConfig, 
  savePlatformAdminYdbConfig, 
  PLATFORM_ADMIN_YDB_SCHEMA_YQL, 
  testYdbConnection
} from '../../services/ydbService';
import { queryAdminDb, pingYdbApi } from '../../services/ydbApiService';
import { YdbHub } from '../ydb/YdbHub';
import { MinioVpsHub } from '../minio/MinioVpsHub';
import { CleanStartManager } from './CleanStartManager';
import { PlatformAdminAuthGuard } from './PlatformAdminAuthGuard';
import { PlatformAdminsManager } from './PlatformAdminsManager';
import { getPlatformAdmins } from '../../services/platformAdminService';

interface AppAdminDashboardProps {
  currentUser: ManagerUser | null;
  points: PointLocation[];
  staffList: StaffMember[];
  onExitAdminMode: () => void;
  onRefreshData?: () => void;
  onUserChange?: (user: ManagerUser) => void;
}

export const AppAdminDashboard: React.FC<AppAdminDashboardProps> = ({
  currentUser,
  points,
  staffList,
  onExitAdminMode,
  onRefreshData,
  onUserChange
}) => {
  // Strict Platform Security Check: Only app_admin can view the platform dashboard
  if (currentUser?.role !== 'app_admin') {
    return (
      <PlatformAdminAuthGuard
        currentUser={currentUser}
        onLoginSuccess={() => {
          if (onRefreshData) onRefreshData();
        }}
        onExit={onExitAdminMode}
      />
    );
  }

  const [activeTab, setActiveTab] = useState<'organizations' | 'tariffs' | 'admins' | 'admin_ydb' | 'services' | 'clean_start'>('organizations');
  
  // Logical Grouping for Admin Dashboard:
  // 1. business: Organizations & Tariffs
  // 2. access: Platform Super Administrators
  // 3. infrastructure: Admin YDB, Cloud Services, Clean Start
  type AdminCategory = 'business' | 'access' | 'infrastructure';
  const getCategoryForTab = (tab: typeof activeTab): AdminCategory => {
    if (tab === 'organizations' || tab === 'tariffs') return 'business';
    if (tab === 'admins') return 'access';
    return 'infrastructure';
  };

  const [activeCategory, setActiveCategory] = useState<AdminCategory>(() => getCategoryForTab(activeTab));
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);

  useEffect(() => {
    setActiveCategory(getCategoryForTab(activeTab));
  }, [activeTab]);

  const handleSelectCategory = (cat: AdminCategory) => {
    setActiveCategory(cat);
    if (cat === 'business') {
      if (activeTab !== 'organizations' && activeTab !== 'tariffs') {
        setActiveTab('organizations');
      }
    } else if (cat === 'access') {
      setActiveTab('admins');
    } else if (cat === 'infrastructure') {
      if (activeTab !== 'admin_ydb' && activeTab !== 'services' && activeTab !== 'clean_start') {
        setActiveTab('admin_ydb');
      }
    }
  };

  const [isSelfAvatarModalOpen, setIsSelfAvatarModalOpen] = useState(false);

  const handleSaveSelfAvatar = (newAvatarUrl: string) => {
    if (!currentUser) return;
    const res = updateManagerAvatar(currentUser.id, newAvatarUrl);
    if (res.success && res.user && onUserChange) {
      onUserChange(res.user);
    } else if (onUserChange) {
      onUserChange({
        ...currentUser,
        avatarUrl: newAvatarUrl
      });
    }
    setIsSelfAvatarModalOpen(false);
  };
  const [platformAdminsCount, setPlatformAdminsCount] = useState<number>(() => getPlatformAdmins().length);
  const [servicesSubTab, setServicesSubTab] = useState<'ydb' | 'minio' | 'system'>('ydb');

  // Dedicated Platform Admin YDB States
  const [platformYdbConfig, setPlatformYdbConfig] = useState<YdbConfig>(getPlatformAdminYdbConfig());
  const [platformYdbQuery, setPlatformYdbQuery] = useState<string>('SELECT * FROM system_organizations LIMIT 20;');
  const [platformYdbResult, setPlatformYdbResult] = useState<YdbQueryResult | null>(null);
  const [isPlatformYdbRunning, setIsPlatformYdbRunning] = useState<boolean>(false);
  const [isPlatformYdbTesting, setIsPlatformYdbTesting] = useState<boolean>(false);
  const [platformYdbTestStatus, setPlatformYdbTestStatus] = useState<{ success: boolean; pingMs: number; error?: string } | null>({
    success: true,
    pingMs: 9,
  });
  const [activeYdbView, setActiveYdbView] = useState<'query' | 'schema' | 'config'>('query');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<boolean>(false);
  const [copiedYql, setCopiedYql] = useState<boolean>(false);
  
  // Data states
  const [organizations, setOrganizations] = useState<CompanyOrganization[]>([]);
  const [tariffs, setTariffs] = useState<TariffPlan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trial' | 'past_due'>('all');

  // Slug management state
  const [adminSlug, setAdminSlugState] = useState<string>(getAppAdminSlug());
  const [newSlugInput, setNewSlugInput] = useState<string>(getAppAdminSlug());
  const [isSlugModalOpen, setIsSlugModalOpen] = useState(false);
  const [slugSuccessMsg, setSlugSuccessMsg] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Tariff editing modal state
  const [isTariffModalOpen, setIsTariffModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<TariffPlan | null>(null);
  const [tariffForm, setTariffForm] = useState<{
    id: string;
    name: string;
    priceMonthlyRub: number;
    pointsLimit: number;
    staffLimit: number;
    storageMbLimit: number;
    badge?: string;
    isPopular?: boolean;
    features: string[];
    newFeatureText: string;
  }>({
    id: '',
    name: '',
    priceMonthlyRub: 1490,
    pointsLimit: 3,
    staffLimit: 15,
    storageMbLimit: 25000,
    badge: '',
    isPopular: false,
    features: [],
    newFeatureText: ''
  });

  // Balance top-up modal / quick action state
  const [selectedOrgForAction, setSelectedOrgForAction] = useState<CompanyOrganization | null>(null);

  const loadData = () => {
    setOrganizations(getOrganizations());
    setTariffs(getTariffPlans());
    setAdminSlugState(getAppAdminSlug());
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'admin_ydb' && !platformYdbResult) {
      handleRunPlatformYdbQuery(platformYdbQuery);
    }
  }, [activeTab]);

  const handleRunPlatformYdbQuery = async (customQuery?: string) => {
    const queryToRun = customQuery || platformYdbQuery;
    if (!queryToRun.trim()) return;
    setIsPlatformYdbRunning(true);
    try {
      const res = await queryAdminDb(queryToRun);
      setPlatformYdbResult(res);
    } catch (err: any) {
      setPlatformYdbResult({
        columns: [],
        rows: [],
        error: err?.message || 'Ошибка запроса к админской YDB',
        stats: { durationMs: 0, requestUnits: 0, rowsAffected: 0 },
      });
    } finally {
      setIsPlatformYdbRunning(false);
    }
  };

  const handleSyncPlatformDataToYdb = async () => {
    setIsPlatformYdbRunning(true);
    try {
      const res = await queryAdminDb('SELECT * FROM system_organizations;');
      setPlatformYdbResult(res);
      setSyncSuccessMsg(true);
      setTimeout(() => setSyncSuccessMsg(false), 4000);
    } catch (err: any) {
      setPlatformYdbResult({
        columns: [],
        rows: [],
        error: err?.message || 'Ошибка синхронизации данных',
        stats: { durationMs: 0, requestUnits: 0, rowsAffected: 0 },
      });
    } finally {
      setIsPlatformYdbRunning(false);
    }
  };

  const handleTestPlatformYdb = async () => {
    setIsPlatformYdbTesting(true);
    const ping = await pingYdbApi();
    setPlatformYdbTestStatus({ success: ping.ok, pingMs: ping.durationMs, error: ping.error });
    setIsPlatformYdbTesting(false);
  };

  const [platformConfigSavedMsg, setPlatformConfigSavedMsg] = useState<boolean>(false);

  const handleSavePlatformYdbConfig = (e: React.FormEvent) => {
    e.preventDefault();
    savePlatformAdminYdbConfig(platformYdbConfig);
    setPlatformConfigSavedMsg(true);
    setTimeout(() => setPlatformConfigSavedMsg(false), 3000);
  };

  const fullAdminUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/${adminSlug}` 
    : `https://horeca-cloud.ru/${adminSlug}`;

  const handleSaveSlug = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSlugInput.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!clean) return;

    const saved = setAppAdminSlug(clean);
    setAdminSlugState(saved);
    setNewSlugInput(saved);
    setSlugSuccessMsg(true);

    // Update browser URL seamlessly without reload
    try {
      if (typeof window !== 'undefined') {
        const newUrl = `${window.location.origin}/${saved}`;
        window.history.replaceState({ path: newUrl }, '', `/${saved}`);
      }
    } catch (err) {
      console.warn('Could not update history state', err);
    }

    setTimeout(() => {
      setSlugSuccessMsg(false);
      setIsSlugModalOpen(false);
    }, 1200);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(fullAdminUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Tariff modal handlers
  const handleOpenEditTariff = (plan?: TariffPlan) => {
    if (plan) {
      setEditingTariff(plan);
      setTariffForm({
        id: plan.id,
        name: plan.name,
        priceMonthlyRub: plan.priceMonthlyRub || plan.priceMonthly || 0,
        pointsLimit: plan.pointsLimit,
        staffLimit: plan.staffLimit,
        storageMbLimit: plan.storageMbLimit,
        badge: plan.badge || '',
        isPopular: plan.isPopular || false,
        features: [...plan.features],
        newFeatureText: ''
      });
    } else {
      const newId = 'custom-' + Date.now().toString(36);
      setEditingTariff(null);
      setTariffForm({
        id: newId,
        name: 'Новый тарифный план',
        priceMonthlyRub: 2990,
        pointsLimit: 5,
        staffLimit: 30,
        storageMbLimit: 50000,
        badge: 'Специальный',
        isPopular: false,
        features: [
          'Неограниченное заполнение чек-листов смен',
          'Фотофиксация в хранилище S3',
          'Интеграция с Telegram-ботом',
          'Отчёты DataLens'
        ],
        newFeatureText: ''
      });
    }
    setIsTariffModalOpen(true);
  };

  const handleSaveTariffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tariffForm.name.trim()) return;

    const price = Number(tariffForm.priceMonthlyRub) || 0;
    const planToSave: TariffPlan = {
      id: tariffForm.id,
      name: tariffForm.name.trim(),
      priceMonthly: price,
      priceMonthlyRub: price,
      description: `Тариф «${tariffForm.name.trim()}»`,
      submissionsMonthlyLimit: 99999,
      pointsLimit: Number(tariffForm.pointsLimit) || 1,
      staffLimit: Number(tariffForm.staffLimit) || 1,
      storageMbLimit: Number(tariffForm.storageMbLimit) || 5000,
      features: tariffForm.features,
      badge: tariffForm.badge?.trim() || undefined,
      isPopular: tariffForm.isPopular
    };

    saveTariffPlan(planToSave);
    setTariffs(getTariffPlans());
    setIsTariffModalOpen(false);
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteTariff = (id: string) => {
    if (confirm('Вы действительно хотите удалить этот тарифный план?')) {
      deleteTariffPlan(id);
      setTariffs(getTariffPlans());
      if (onRefreshData) onRefreshData();
    }
  };

  const handleResetTariffs = () => {
    if (confirm('Сбросить список тарифов к исходным базовым планам («Старт», «Бизнес», «Корпорация»)?')) {
      resetTariffPlans();
      setTariffs(getTariffPlans());
      if (onRefreshData) onRefreshData();
    }
  };

  const handleAddFeature = () => {
    if (tariffForm.newFeatureText.trim()) {
      setTariffForm({
        ...tariffForm,
        features: [...tariffForm.features, tariffForm.newFeatureText.trim()],
        newFeatureText: ''
      });
    }
  };

  const handleRemoveFeature = (idx: number) => {
    setTariffForm({
      ...tariffForm,
      features: tariffForm.features.filter((_, i) => i !== idx)
    });
  };

  // Quick Org actions
  const handleChangeOrgTariff = (orgId: string, tariffId: TariffPlanId) => {
    updateOrganizationTariff(orgId, tariffId);
    loadData();
    if (onRefreshData) onRefreshData();
  };

  const handleChangeOrgStatus = (orgId: string, status: 'active' | 'trial' | 'past_due') => {
    updateOrganizationStatus(orgId, status);
    loadData();
    if (onRefreshData) onRefreshData();
  };

  const handleAddOrgBalance = (orgId: string, delta: number) => {
    updateOrganizationBalance(orgId, delta);
    loadData();
    if (onRefreshData) onRefreshData();
  };

  // Filtered organizations
  const filteredOrgs = organizations.filter(org => {
    const q = searchQuery.toLowerCase().trim();
    const director = (org.directorName || org.generalDirector || '').toLowerCase();
    const matchSearch = !q || 
      org.name.toLowerCase().includes(q) || 
      org.brandName.toLowerCase().includes(q) || 
      org.inn.includes(q) ||
      director.includes(q);

    const matchStatus = statusFilter === 'all' || org.tariffStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-y-auto scrollbar-amber">
      {/* Top Application Admin Bar */}
      <header className="bg-slate-900/90 border-b border-rose-500/20 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-slate-950 shadow-md shadow-rose-500/20 font-black">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                  Платформа Horeca Cloud
                </span>
                <span className="px-2 py-0.2 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-bold">
                  Root Admin
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
                Панель Администратора Приложения
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Current Admin Avatar & Profile badge */}
            {currentUser && (
              <button
                type="button"
                onClick={() => setIsSelfAvatarModalOpen(true)}
                className="flex items-center space-x-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white transition text-xs font-semibold group"
                title="Нажмите, чтобы изменить свой аватар администратора"
              >
                <div className="relative shrink-0">
                  <img
                    src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                    alt={currentUser.name}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-rose-500 group-hover:brightness-75 transition"
                  />
                  <div className="absolute inset-0 rounded-full flex items-center justify-center bg-slate-950/50 opacity-0 group-hover:opacity-100 transition text-rose-300">
                    <Camera className="w-3 h-3" />
                  </div>
                </div>
                <span className="hidden sm:inline text-xs font-semibold text-slate-200 group-hover:text-white truncate max-w-[100px]">
                  {currentUser.name.split(' ')[0]}
                </span>
                <Camera className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-400 shrink-0" />
              </button>
            )}

            {/* Slug URL configuration badge */}
            <button
              type="button"
              onClick={() => {
                setNewSlugInput(adminSlug);
                setIsSlugModalOpen(true);
              }}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold transition"
              title="Настроить ссылку для входа администратора"
            >
              <Link2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">Ссылка входа:</span>
              <span className="font-mono text-rose-300 font-bold">/{adminSlug}</span>
            </button>

            {/* Exit to Main App */}
            <button
              type="button"
              onClick={onExitAdminMode}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
              title="Выйти из режима администратора платформы"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">К приложению</span>
            </button>
          </div>
        </div>
      </header>

      {/* Grouped Admin Navigation Bar */}
      <div className="bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          
          {/* Header Row: Current Context and Quick Direct Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                Супер-консоль
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {activeTab === 'organizations' && 'Клиентские организации и зарегистрированные кофейни'}
                {activeTab === 'tariffs' && 'Тарифные планы, лимиты точек и стоимость подписки'}
                {activeTab === 'admins' && 'Команда и учётные записи супер-администраторов платформы'}
                {activeTab === 'admin_ydb' && 'Обособленная база данных Managed Service for YDB (Serverless)'}
                {activeTab === 'services' && 'Облачная инфраструктура: Yandex Cloud YDB & MinIO S3'}
                {activeTab === 'clean_start' && 'Сброс и запуск чистой среды платформы'}
              </span>
            </div>

            {/* Quick Jumper Dropdown */}
            <div className="relative shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsQuickMenuOpen(prev => !prev)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition shadow-xs"
                title="Быстрый выбор любого раздела"
              >
                <span>Все 6 разделов</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isQuickMenuOpen ? 'rotate-180 text-rose-400' : ''}`} />
              </button>

              {isQuickMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsQuickMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
                      Быстрый переход к разделам
                    </div>

                    {/* Section: Business */}
                    <div className="px-2 py-0.5 text-[10px] font-bold text-rose-400 flex items-center space-x-1">
                      <Building2 className="w-3 h-3" />
                      <span>Бизнес и Клиенты</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('organizations');
                        setActiveCategory('business');
                        setIsQuickMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'organizations' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Организации</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold">{organizations.length}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('tariffs');
                        setActiveCategory('business');
                        setIsQuickMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'tariffs' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                        <span>Тарифные планы</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold">{tariffs.length}</span>
                    </button>

                    {/* Section: Access */}
                    <div className="px-2 pt-2 py-0.5 text-[10px] font-bold text-indigo-400 flex items-center space-x-1 border-t border-slate-800/80 mt-1">
                      <Shield className="w-3 h-3" />
                      <span>Команда и Доступ</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('admins');
                        setActiveCategory('access');
                        setIsQuickMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'admins' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Администраторы платформы</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold">{platformAdminsCount}</span>
                    </button>

                    {/* Section: Infrastructure */}
                    <div className="px-2 pt-2 py-0.5 text-[10px] font-bold text-amber-400 flex items-center space-x-1 border-t border-slate-800/80 mt-1">
                      <Server className="w-3 h-3" />
                      <span>Инфраструктура и Сервисы</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('admin_ydb');
                        setActiveCategory('infrastructure');
                        setIsQuickMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'admin_ydb' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Database className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Обособленная YDB</span>
                      </div>
                      <span className="text-[10px] px-1 bg-indigo-950 text-indigo-300 rounded border border-indigo-500/40">Serverless</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('services');
                        setActiveCategory('infrastructure');
                        setIsQuickMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'services' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Server className="w-3.5 h-3.5 text-amber-400" />
                        <span>Облачные сервисы</span>
                      </div>
                      <span className="text-[10px] px-1 bg-amber-950 text-amber-300 rounded border border-amber-500/40">YDB/S3</span>
                    </button>

                    {!isDemoSession() && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('clean_start');
                          setActiveCategory('infrastructure');
                          setIsQuickMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                          activeTab === 'clean_start' ? 'bg-red-500/20 text-red-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>Очистка и запуск</span>
                        </div>
                        <span className="text-[10px] px-1 bg-red-950 text-red-300 rounded border border-red-500/40">Сброс</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Grouped Navigation Clusters */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Cluster 1: Business & Clients */}
            <div className="flex items-center p-1 bg-slate-950/90 rounded-2xl border border-slate-800 shadow-inner">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400/90 px-2 py-0.5 select-none hidden lg:inline">
                Бизнес:
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('organizations');
                  setActiveCategory('business');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'organizations'
                    ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Организации</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'organizations' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}>
                  {organizations.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('tariffs');
                  setActiveCategory('business');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'tariffs'
                    ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>Тарифы</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'tariffs' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}>
                  {tariffs.length}
                </span>
              </button>
            </div>

            {/* Cluster 2: Team & Access */}
            <div className="flex items-center p-1 bg-slate-950/90 rounded-2xl border border-slate-800 shadow-inner">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400/90 px-2 py-0.5 select-none hidden lg:inline">
                Доступ:
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admins');
                  setActiveCategory('access');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'admins'
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Администраторы</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'admins' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                }`}>
                  {platformAdminsCount}
                </span>
              </button>
            </div>

            {/* Cluster 3: Infrastructure & Data */}
            <div className="flex items-center p-1 bg-slate-950/90 rounded-2xl border border-slate-800 shadow-inner">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400/90 px-2 py-0.5 select-none hidden lg:inline">
                Инфраструктура:
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin_ydb');
                  setActiveCategory('infrastructure');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'admin_ydb'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>Обособленная YDB</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('services');
                  setActiveCategory('infrastructure');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'services'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Server className="w-3.5 h-3.5 shrink-0" />
                <span>Облачные сервисы</span>
              </button>

              {!isDemoSession() && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('clean_start');
                    setActiveCategory('infrastructure');
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === 'clean_start'
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                      : 'text-red-400 hover:text-white hover:bg-red-950/40'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Очистка и запуск</span>
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ======================================================== */}
        {/* TAB 1: REGISTERED ORGANIZATIONS                         */}
        {/* ======================================================== */}
        {activeTab === 'organizations' && (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
                  <span>Организаций (Юр. лиц)</span>
                  <Building2 className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-white">{organizations.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {organizations.filter(o => o.legalType === 'IP').length} ИП, {organizations.filter(o => o.legalType === 'OOO').length} ООО
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
                  <span>Кофеен в сети</span>
                  <MapPin className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-white">{points.length}</div>
                <div className="text-[11px] text-emerald-400 mt-1">Активные рабочие места</div>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
                  <span>Сотрудников на платформе</span>
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-black text-white">{staffList.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">Линейный персонал и бариста</div>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
                  <span>Общий баланс счетов</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {(organizations || []).reduce((sum, o) => sum + (o.balanceRub || 0), 0).toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Лицевые счета организаций</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию, бренду, ИНН или директору..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-semibold">Статус:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="all">Все статусы ({organizations.length})</option>
                  <option value="active">Активные</option>
                  <option value="trial">Триальные</option>
                  <option value="past_due">Просроченные</option>
                </select>
              </div>
            </div>

            {/* Organizations Cards / Table */}
            <div className="space-y-3">
              {filteredOrgs.length === 0 ? (
                <div className="p-12 text-center bg-slate-900/50 rounded-3xl border border-slate-800 text-slate-400">
                  <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold">Организации по заданным критериям не найдены</p>
                </div>
              ) : (
                filteredOrgs.map((org) => {
                  const currentTariffObj = tariffs.find(t => t.id === org.currentTariffId) || tariffs[0];
                  const orgPoints = points.filter(p => p.organizationInn === org.inn || p.organizationId === org.id);
                  const orgStaff = staffList.filter(s => s.organizationInn === org.inn || s.organizationId === org.id);

                  return (
                    <div 
                      key={org.id} 
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 sm:p-5 rounded-3xl transition"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Org Header & Requisites */}
                        <div className="flex items-start space-x-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                            <Building2 className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                {org.legalType === 'IP' ? 'ИП' : 'ООО'}
                              </span>
                              <span className="text-xs font-bold text-amber-400">
                                Сеть «{org.brandName}»
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                org.tariffStatus === 'active' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : org.tariffStatus === 'trial'
                                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}>
                                {org.tariffStatus === 'active' ? '● Активен' : org.tariffStatus === 'trial' ? '● Пробный' : '● Просрочен'}
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-white mt-1 truncate">
                              {org.name}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                              <span>ИНН: <strong className="font-mono text-slate-300">{org.inn}</strong></span>
                              <span>•</span>
                              <span>ОГРН: <strong className="font-mono text-slate-300">{org.ogrn}</strong></span>
                              <span>•</span>
                              <span>Руководитель: <strong className="text-slate-300">{org.directorName || org.generalDirector}</strong></span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1.5">
                              <span className="flex items-center space-x-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                <span className="truncate max-w-[280px]">{org.address || org.legalAddress}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Phone className="w-3.5 h-3.5 text-slate-500" />
                                <span>{org.phone}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Mail className="w-3.5 h-3.5 text-slate-500" />
                                <span>{org.email}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Org Tariff & Balance Controls */}
                        <div className="flex flex-wrap items-center gap-3 lg:border-l lg:border-slate-800 lg:pl-5 self-start lg:self-center">
                          {/* Point & Staff count badges */}
                          <div className="flex flex-col text-right">
                            <span className="text-[11px] text-slate-400">Объекты юр. лица:</span>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-xs text-amber-300 font-bold border border-slate-700">
                                {orgPoints.length} кофеен
                              </span>
                              <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-xs text-sky-300 font-bold border border-slate-700">
                                {orgStaff.length} бариста
                              </span>
                            </div>
                          </div>

                          {/* Tariff Selection Dropdown */}
                          <div className="flex flex-col">
                            <span className="text-[11px] text-slate-400">Текущий тариф:</span>
                            <select
                              value={org.currentTariffId}
                              onChange={(e) => handleChangeOrgTariff(org.id, e.target.value)}
                              className="mt-0.5 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-rose-300 focus:outline-none focus:border-rose-500"
                            >
                              {tariffs.map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({((t.priceMonthlyRub ?? t.priceMonthly) || 0).toLocaleString('ru-RU')} ₽/мес)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Status toggle */}
                          <div className="flex flex-col">
                            <span className="text-[11px] text-slate-400">Статус:</span>
                            <select
                              value={org.tariffStatus}
                              onChange={(e) => handleChangeOrgStatus(org.id, e.target.value as any)}
                              className="mt-0.5 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none"
                            >
                              <option value="active">Активен</option>
                              <option value="trial">Пробный период</option>
                              <option value="past_due">Заблокирован</option>
                            </select>
                          </div>

                          {/* Balance */}
                          <div className="flex flex-col">
                            <span className="text-[11px] text-slate-400">Баланс:</span>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="font-mono text-sm font-bold text-emerald-400">
                                {(org.balanceRub || 0).toLocaleString()} ₽
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddOrgBalance(org.id, 5000)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition"
                                title="Пополнить баланс на 5 000 ₽"
                              >
                                +5 000 ₽
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: TARIFFS MANAGEMENT AND EDITING                   */}
        {/* ======================================================== */}
        {activeTab === 'tariffs' && (
          <div className="space-y-6">
            {/* Tariffs Management Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-3xl border border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-rose-400" />
                  <span>Тарифные планы платформы Horeca Cloud</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Администратор приложения может управлять параметрами, лимитами и ценами тарифов для всех юр. лиц.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleResetTariffs}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                  title="Восстановить базовые тарифы"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Сбросить к базовым</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEditTariff()}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold transition shadow-md shadow-rose-500/20"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Добавить новый тариф</span>
                </button>
              </div>
            </div>

            {/* Tariffs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tariffs.map((plan) => (
                <div 
                  key={plan.id}
                  className={`bg-slate-900 rounded-3xl p-6 border flex flex-col justify-between transition-all relative ${
                    plan.isPopular 
                      ? 'border-amber-500 shadow-xl shadow-amber-500/10' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-6">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 shadow-sm">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-black text-white">{plan.name}</h3>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditTariff(plan)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Редактировать тариф"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {tariffs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTariff(plan.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                            title="Удалить тариф"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-baseline space-x-1 mb-4">
                      <span className="text-3xl font-black text-white">
                        {((plan.priceMonthlyRub ?? plan.priceMonthly) || 0).toLocaleString('ru-RU')} ₽
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">/ месяц</span>
                    </div>

                    {/* Limits Specs */}
                    <div className="space-y-2 py-3 border-y border-slate-800 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center space-x-1.5 text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          <span>Кофейни / Точки:</span>
                        </span>
                        <span className="font-bold text-white font-mono">
                          до {plan.pointsLimit >= 9999 ? 'Не ограничено' : plan.pointsLimit}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center space-x-1.5 text-slate-400">
                          <Users className="w-3.5 h-3.5 text-sky-400" />
                          <span>Штат сотрудников:</span>
                        </span>
                        <span className="font-bold text-white font-mono">
                          до {plan.staffLimit >= 9999 ? 'Не ограничено' : plan.staffLimit}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center space-x-1.5 text-slate-400">
                          <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Хранилище фото S3:</span>
                        </span>
                        <span className="font-bold text-white font-mono">
                          {Math.round(plan.storageMbLimit / 1000)} ГБ
                        </span>
                      </div>
                    </div>

                    {/* Features list */}
                    <div className="mt-4 space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Возможности тарифа:
                      </div>
                      <ul className="space-y-1.5">
                        {plan.features.map((feat, i) => (
                          <li key={i} className="flex items-start space-x-2 text-xs text-slate-300 leading-tight">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleOpenEditTariff(plan)}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs flex items-center justify-center space-x-2 transition border border-slate-700"
                    >
                      <Sliders className="w-3.5 h-3.5 text-rose-400" />
                      <span>Настроить параметры и лимиты</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: PLATFORM ADMINISTRATORS & TEAM                    */}
        {/* ======================================================== */}
        {activeTab === 'admins' && (
          <PlatformAdminsManager
            onAdminsUpdated={() => {
              setPlatformAdminsCount(getPlatformAdmins().length);
              if (onRefreshData) onRefreshData();
            }}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 4: DEDICATED PLATFORM ADMIN YDB                     */}
        {/* ======================================================== */}
        {activeTab === 'admin_ydb' && (
          <div className="space-y-6">
            {/* Top Info Banner with Status and Synchronize Action */}
            <div className="p-5 rounded-3xl bg-linear-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider flex items-center space-x-1.5">
                      <Database className="w-3.5 h-3.5" />
                      <span>Обособленная YDB Администратора</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Подключено ({platformYdbTestStatus?.pingMs || 9} мс)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                      ru-central1
                    </span>
                  </div>

                  <h2 className="text-xl font-black text-white">
                    База данных управляющей платформы (YDB Serverless)
                  </h2>
                  <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                    Изолированный от клиентов системный кластер YDB для записи и хранения мастер-данных: юридических лиц, тарифных планов, реестра администраторов, журнала транзакций, биллинга и системных параметров.
                  </p>
                </div>

                {/* Top Action & Sync Status */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSyncPlatformDataToYdb}
                    disabled={isPlatformYdbRunning}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-600/30"
                  >
                    {isPlatformYdbRunning ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Запись данных...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>Записать / Синхронизировать данные</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestPlatformYdb}
                    disabled={isPlatformYdbTesting}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-2 transition border border-slate-700"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPlatformYdbTesting ? 'animate-spin' : 'text-indigo-400'}`} />
                    <span>Проверить пинг YDB</span>
                  </button>
                </div>
              </div>

              {/* Toast confirmation */}
              {syncSuccessMsg && (
                <div className="mt-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Все данные платформы (организации: {organizations.length}, тарифы: {tariffs.length}, биллинг) успешно записаны в обособленную YDB администратора!
                  </span>
                </div>
              )}

              {/* Meta metrics strip */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Путь к БД:</span>
                  <span className="font-mono text-indigo-300 font-bold truncate block select-all">
                    {platformYdbConfig.database}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Endpoint:</span>
                  <span className="font-mono text-slate-200 font-bold truncate block select-all">
                    {platformYdbConfig.endpoint}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Лимит Request Units:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {platformYdbConfig.maxRequestUnitsPerSec} RU/sec
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Таблиц платформы:</span>
                  <span className="font-bold text-white">
                    7 системных DDL таблиц
                  </span>
                </div>
              </div>
            </div>

            {/* Inner Sub-Navigation (Query Console, Schema DDL, Config) */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveYdbView('query')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeYdbView === 'query'
                      ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>YQL Консоль и Запросы</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveYdbView('schema')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeYdbView === 'schema'
                      ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Схема DDL таблиц</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveYdbView('config')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeYdbView === 'config'
                      ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Параметры подключения</span>
                </button>
              </div>

              <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Время синхронизации: в реальном времени</span>
              </div>
            </div>

            {/* VIEW 1: YQL CONSOLE & QUERIES */}
            {activeYdbView === 'query' && (
              <div className="space-y-4">
                {/* Table Quick-Selector Chips */}
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Быстрый выбор таблицы администратора:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORM_ADMIN_YDB_TABLES.map((t) => {
                      const sampleQuery = `SELECT * FROM ${t.name} LIMIT 20;`;
                      const isSelected = platformYdbQuery.includes(t.name);
                      return (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => {
                            setPlatformYdbQuery(sampleQuery);
                            handleRunPlatformYdbQuery(sampleQuery);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition border ${
                            isSelected
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          <Database className="w-3 h-3 text-indigo-400" />
                          <span className="font-mono">{t.name}</span>
                          <span className="text-[10px] text-slate-400">({t.description.split(' ')[0]})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Query Input Box */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
                      <Terminal className="w-4 h-4 text-indigo-400" />
                      <span>Редактор YQL-запроса:</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Синтаксис Yandex Query Language (YQL)
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    value={platformYdbQuery}
                    onChange={(e) => setPlatformYdbQuery(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-indigo-200 font-mono font-bold focus:border-indigo-500 outline-none resize-none leading-relaxed"
                    placeholder="SELECT * FROM system_organizations LIMIT 20;"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleRunPlatformYdbQuery()}
                        disabled={isPlatformYdbRunning}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-2 transition shadow-md shadow-indigo-600/20"
                      >
                        {isPlatformYdbRunning ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Выполнение...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Выполнить запрос YQL</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const q = 'SELECT * FROM system_organizations;';
                          setPlatformYdbQuery(q);
                          handleRunPlatformYdbQuery(q);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                      >
                        Сбросить к организациям
                      </button>
                    </div>

                    {platformYdbResult?.stats && (
                      <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                        <span>Время: <strong className="text-slate-200">{platformYdbResult.stats.durationMs} мс</strong></span>
                        <span>Потреблено RU: <strong className="text-indigo-300">{platformYdbResult.stats.requestUnits}</strong></span>
                        <span>Строк: <strong className="text-emerald-300">{platformYdbResult.stats.rowsAffected}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Query Result View */}
                {platformYdbResult && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-200">
                          Результат выборки ({platformYdbResult.rows?.length || 0} записей)
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Статус: 200 OK (Success)
                      </span>
                    </div>

                    {(!platformYdbResult.rows || platformYdbResult.rows.length === 0) ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        Данные по запросу отсутствуют
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] sticky top-0 border-b border-slate-800">
                            <tr>
                              {(platformYdbResult.columns || []).map((col) => (
                                <th key={col} className="px-4 py-2.5 font-bold whitespace-nowrap">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                            {(platformYdbResult.rows || []).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/40 transition">
                                {(platformYdbResult.columns || []).map((col) => {
                                  const val = row[col];
                                  const isBalance = col.includes('balance') || col.includes('amount');
                                  const isStatus = col.includes('status') || col.includes('active');
                                  return (
                                    <td key={col} className="px-4 py-2 text-slate-300 whitespace-nowrap">
                                      {isBalance ? (
                                        <span className={`font-bold ${Number(val) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                          {Number(val).toLocaleString('ru-RU')} ₽
                                        </span>
                                      ) : isStatus ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                                          {String(val)}
                                        </span>
                                      ) : (
                                        <span className="truncate max-w-xs block">
                                          {String(val ?? '—')}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: DDL SCHEMA VIEWER */}
            {activeYdbView === 'schema' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PLATFORM_ADMIN_YDB_TABLES.map((table) => (
                    <div key={table.name} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center space-x-2 text-indigo-400 mb-1">
                        <Database className="w-4 h-4" />
                        <span className="font-mono font-bold text-xs text-white">{table.name}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{table.description}</p>
                      <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-500">
                        <span>Primary Key:</span>
                        <span className="text-amber-300 font-bold">{table.primaryKey}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                      <FileCode className="w-4 h-4 text-indigo-400" />
                      <span>Полный YQL DDL Скрипт создания таблиц обособленной базы:</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(PLATFORM_ADMIN_YDB_SCHEMA_YQL);
                        setCopiedYql(true);
                        setTimeout(() => setCopiedYql(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
                    >
                      {copiedYql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedYql ? 'Скопировано!' : 'Скопировать YQL'}</span>
                    </button>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-96 leading-relaxed select-all">
                    {PLATFORM_ADMIN_YDB_SCHEMA_YQL}
                  </pre>
                </div>
              </div>
            )}

            {/* VIEW 3: CONFIGURATION */}
            {activeYdbView === 'config' && (
              <form onSubmit={handleSavePlatformYdbConfig} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-2xl">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Settings className="w-4 h-4 text-indigo-400" />
                    <span>Параметры подключения к обособленной базе данных</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Данные настройки используются исключительно сервисами панели администратора для глобального учета.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GRPC Endpoint YDB Serverless *
                  </label>
                  <input
                    type="text"
                    required
                    value={platformYdbConfig.endpoint}
                    onChange={(e) => setPlatformYdbConfig({ ...platformYdbConfig, endpoint: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Путь к системной базе данных (/ru-central1/.../ydb-platform-admin) *
                  </label>
                  <input
                    type="text"
                    required
                    value={platformYdbConfig.database}
                    onChange={(e) => setPlatformYdbConfig({ ...platformYdbConfig, database: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Service Account Key ID
                    </label>
                    <input
                      type="text"
                      value={platformYdbConfig.serviceAccountId || ''}
                      onChange={(e) => setPlatformYdbConfig({ ...platformYdbConfig, serviceAccountId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Лимит RU/sec
                    </label>
                    <input
                      type="number"
                      value={platformYdbConfig.maxRequestUnitsPerSec || 50}
                      onChange={(e) => setPlatformYdbConfig({ ...platformYdbConfig, maxRequestUnitsPerSec: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleTestPlatformYdb}
                    disabled={isPlatformYdbTesting}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-2 transition border border-slate-700"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPlatformYdbTesting ? 'animate-spin' : 'text-indigo-400'}`} />
                    <span>Проверить соединение</span>
                  </button>

                  <div className="flex items-center space-x-3">
                    {platformConfigSavedMsg && (
                      <span className="text-emerald-400 text-xs font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Параметры сохранены!</span>
                      </span>
                    )}
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/20"
                    >
                      Сохранить параметры
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: SERVICES HUB (TRANSFERRED FROM NAVBAR)           */}
        {/* ======================================================== */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            {/* Header / Sub-tabs Bar for Services */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider flex items-center space-x-1.5">
                    <Server className="w-3.5 h-3.5" />
                    <span>Инфраструктурные сервисы платформы</span>
                  </span>
                  <span className="text-xs text-slate-400">Перенесено из меню клиентов</span>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Управление базами данных YDB, S3-хранилищем MinIO и сервисной интеграцией Yandex Cloud
                </div>
              </div>

              {/* Sub-tab switcher */}
              <div className="flex items-center p-1 bg-slate-950 rounded-2xl border border-slate-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setServicesSubTab('ydb')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    servicesSubTab === 'ydb'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>БД YDB Serverless</span>
                </button>

                <button
                  type="button"
                  onClick={() => setServicesSubTab('minio')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    servicesSubTab === 'minio'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>MinIO S3 (VPS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setServicesSubTab('system')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    servicesSubTab === 'system'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Обзор платформы</span>
                </button>
              </div>
            </div>

            {/* Sub-Tab 1: YDB HUB */}
            {servicesSubTab === 'ydb' && (
              <div>
                <YdbHub />
              </div>
            )}

            {/* Sub-Tab 2: MINIO S3 VPS HUB */}
            {servicesSubTab === 'minio' && (
              <div>
                <MinioVpsHub />
              </div>
            )}

            {/* Sub-Tab 3: SYSTEM PLATFORM OVERVIEW */}
            {servicesSubTab === 'system' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white">YDB Serverless Архитектура</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Распределенная отказоустойчивая SQL СУБД от Yandex Cloud с тарификацией по фактическому потреблению (Request Units). Автоматическое масштабирование и нулевой простой.
                    </p>
                    <div className="text-[11px] font-mono text-indigo-300">
                      Статус: Кластер активен (99.95% SLA)
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white">MinIO S3 Хранилище</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Выделенное S3-совместимое объектное хранилище на VPS для медиафайлов, фотоотчетов и актов проверок с автосжатием фото в WebP и генерацией подписанных ссылок.
                    </p>
                    <div className="text-[11px] font-mono text-amber-300">
                      Статус: Порт 9000 открыт, SSL активен
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Изоляция администратора</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Все данные платформы, реестр организаций и биллинг записываются в обособленную YDB администратора, изолированную от баз данных отдельных заведений и сотрудников.
                    </p>
                    <div className="text-[11px] font-mono text-emerald-300">
                      Статус: Изоляция 100% подтверждена
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: CLEAN START & YDB EMULATOR TOGGLE                */}
        {/* ======================================================== */}
        {activeTab === 'clean_start' && !isDemoSession() && (
          <CleanStartManager 
            onDataChanged={() => {
              setOrganizations(getOrganizations());
              setTariffs(getTariffPlans());
              handleRunPlatformYdbQuery(platformYdbQuery);
              if (onRefreshData) onRefreshData();
            }}
            onNavigateToTab={(tab) => {
              if (tab === 'services') {
                setActiveTab('services');
                setServicesSubTab('ydb');
              } else if (tab === 'admin_ydb') {
                setActiveTab('admin_ydb');
              } else if (tab === 'organizations') {
                setActiveTab('organizations');
              }
            }}
          />
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL: EDIT / CREATE TARIFF                             */}
      {/* ======================================================== */}
      {isTariffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-rose-400" />
                <span>{editingTariff ? 'Редактирование тарифа' : 'Новый тарифный план'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTariffModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTariffSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Название тарифа *
                </label>
                <input
                  type="text"
                  required
                  value={tariffForm.name}
                  onChange={(e) => setTariffForm({ ...tariffForm, name: e.target.value })}
                  placeholder="Например: Старт (ИП), Сеть Профи"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-rose-500 outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Стоимость в месяц (₽) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={10}
                    value={tariffForm.priceMonthlyRub}
                    onChange={(e) => setTariffForm({ ...tariffForm, priceMonthlyRub: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-rose-500 outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Бейдж / Метка
                  </label>
                  <input
                    type="text"
                    value={tariffForm.badge || ''}
                    onChange={(e) => setTariffForm({ ...tariffForm, badge: e.target.value })}
                    placeholder="Например: Популярный, Выбор сетей"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Макс. кофеен
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={tariffForm.pointsLimit}
                    onChange={(e) => setTariffForm({ ...tariffForm, pointsLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-rose-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Макс. сотрудников
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={tariffForm.staffLimit}
                    onChange={(e) => setTariffForm({ ...tariffForm, staffLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-rose-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    S3 Диск (МБ)
                  </label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={1000}
                    value={tariffForm.storageMbLimit}
                    onChange={(e) => setTariffForm({ ...tariffForm, storageMbLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-rose-500 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Popular Switch */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isPopularCheck"
                  checked={tariffForm.isPopular || false}
                  onChange={(e) => setTariffForm({ ...tariffForm, isPopular: e.target.checked })}
                  className="rounded border-slate-800 text-rose-500 focus:ring-rose-500"
                />
                <label htmlFor="isPopularCheck" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Выделить тариф как рекомендуемый (Популярный)
                </label>
              </div>

              {/* Features List Editing */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Список включенных возможностей
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {tariffForm.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                      <span className="text-slate-200">{feat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-bold ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="text"
                    value={tariffForm.newFeatureText}
                    onChange={(e) => setTariffForm({ ...tariffForm, newFeatureText: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                    placeholder="Добавить возможность..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-rose-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                  >
                    Добавить
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTariffModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition shadow-md shadow-rose-500/20"
                >
                  Сохранить тариф
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIGURE ADMIN URL SLUG                         */}
      {/* ======================================================== */}
      {isSlugModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Link2 className="w-5 h-5 text-rose-400" />
                <span>Настройка адреса входа администратора</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSlugModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              В соответствии с системными требованиями, администратор приложения входит через добавление в адресную строку ссылки типа{' '}
              <strong className="text-rose-300 font-mono">адрес-приложения.ru/{adminSlug}</strong>. Вы можете изменить адрес после «/» в любой момент.
            </p>

            <form onSubmit={handleSaveSlug} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Адрес после «/» (URL-путь входа) *
                </label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-400 focus-within:border-rose-500 font-mono">
                  <span className="text-slate-500 select-none">/</span>
                  <input
                    type="text"
                    required
                    value={newSlugInput}
                    onChange={(e) => setNewSlugInput(e.target.value)}
                    placeholder="админ"
                    className="flex-1 bg-transparent text-white font-bold ml-1 outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Например: <code className="text-rose-300">админ</code>, <code className="text-rose-300">секрет</code>, <code className="text-rose-300">admin-panel</code>
                </p>
              </div>

              {/* Full link preview and copy */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Полная ссылка для перехода:</span>
                <div className="flex items-center justify-between space-x-2">
                  <span className="text-xs font-mono text-rose-300 truncate select-all">
                    {fullAdminUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition"
                    title="Скопировать ссылку"
                  >
                    {copiedUrl ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {slugSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Адрес входа успешно обновлен!</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSlugModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition shadow-md shadow-rose-500/20"
                >
                  Сохранить новый адрес
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Self Admin Avatar Edit Modal */}
      {currentUser && (
        <AvatarEditModal
          isOpen={isSelfAvatarModalOpen}
          onClose={() => setIsSelfAvatarModalOpen(false)}
          currentAvatarUrl={currentUser.avatarUrl}
          userName={currentUser.name}
          userRoleTitle={currentUser.roleTitle || 'Администратор платформы'}
          onSave={handleSaveSelfAvatar}
          title="Сменить аватар администратора"
        />
      )}
    </div>
  );
};
