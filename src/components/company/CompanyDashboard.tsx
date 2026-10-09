import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  CreditCard, 
  FileText, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  ShieldCheck, 
  ShieldAlert,
  Phone, 
  Mail, 
  Key, 
  Download, 
  Printer, 
  ChevronRight, 
  Lock, 
  Briefcase, 
  Eye, 
  EyeOff, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  Calendar, 
  TrendingUp, 
  Clock, 
  HardDrive, 
  Check, 
  X,
  FileCheck,
  Receipt,
  Layers
} from 'lucide-react';
import { 
  CompanyOrganization, 
  TariffPlan, 
  TariffPlanId, 
  BillingInvoice, 
  PointLocation, 
  StaffMember, 
  ManagerUser,
  LegalEntityType 
} from '../../types';
import { 
  TARIFF_PLANS, 
  INITIAL_ORGS,
  getTariffPlans,
  getOrganizations, 
  getActiveOrganization, 
  setActiveOrganization, 
  registerOrganization, 
  updateOrganization, 
  changeOrganizationTariff, 
  getInvoices, 
  createInvoice,
  getOrganizationsForUser
} from '../../services/companyService';
import { CompanyHierarchyView } from './CompanyHierarchyView';

interface CompanyDashboardProps {
  currentUser: ManagerUser | null;
  points: PointLocation[];
  staffList: StaffMember[];
  onAddStaff: (staff: Omit<StaffMember, 'id'>) => void;
  onUpdateStaff: (staff: StaffMember) => void;
  onDeleteStaff: (staffId: string) => void;
  onAddPoint: (point: Omit<PointLocation, 'id'>) => void;
  onNavigateToTab?: (tab: any) => void;
  onOpenLoginModal?: () => void;
}

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  currentUser,
  points,
  staffList,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  onAddPoint,
  onNavigateToTab,
  onOpenLoginModal,
}) => {
  const [activeOrg, setActiveOrg] = useState<CompanyOrganization>(() => getActiveOrganization() || INITIAL_ORGS[0]);
  const [allOrgs, setAllOrgs] = useState<CompanyOrganization[]>(() => {
    const allowed = getOrganizationsForUser(currentUser);
    return allowed.length > 0 ? allowed : getOrganizations();
  });
  const [activeSection, setActiveSection] = useState<'hierarchy' | 'staff' | 'billing' | 'requisites' | 'points'>('hierarchy');
  
  // Billing states
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [billingPeriodMonths, setBillingPeriodMonths] = useState<number>(1);
  const [selectedTariffForSwitch, setSelectedTariffForSwitch] = useState<TariffPlanId>(activeOrg.currentTariffId);
  const [invoiceModalData, setInvoiceModalData] = useState<BillingInvoice | null>(null);

  // New staff modal state
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffMember['role']>('Бариста');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffSelectedPoints, setNewStaffSelectedPoints] = useState<string[]>([]);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});

  // New legal entity registration modal
  const [isRegOrgModalOpen, setIsRegOrgModalOpen] = useState(false);
  const [regLegalType, setRegLegalType] = useState<LegalEntityType>('IP');
  const [regOrgName, setRegOrgName] = useState('');
  const [regBrandName, setRegBrandName] = useState('');
  const [regInn, setRegInn] = useState('');
  const [regOgrn, setRegOgrn] = useState('');
  const [regDirector, setRegDirector] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regTariff, setRegTariff] = useState<TariffPlanId>('business');
  const [regError, setRegError] = useState<string | null>(null);

  // Requisites editing state
  const [isEditingRequisites, setIsEditingRequisites] = useState(false);
  const [editForm, setEditForm] = useState<CompanyOrganization>({ ...activeOrg });
  const [requisitesSuccessMsg, setRequisitesSuccessMsg] = useState(false);

  useEffect(() => {
    const userAllowed = getOrganizationsForUser(currentUser);
    const validOrgs = userAllowed.length > 0 ? userAllowed : getOrganizations();
    setAllOrgs(validOrgs);

    const current = getActiveOrganization();
    const safeActive = validOrgs.find(o => o.id === current.id) || validOrgs[0] || current;
    setActiveOrg(safeActive);
    setEditForm({ ...safeActive });
    setSelectedTariffForSwitch(safeActive.currentTariffId);
    setInvoices(getInvoices(safeActive.id));
  }, [currentUser]);

  const handleSwitchOrg = (orgId: string) => {
    const org = setActiveOrganization(orgId);
    if (org) {
      setActiveOrg(org);
      setEditForm({ ...org });
      setSelectedTariffForSwitch(org.currentTariffId);
      setInvoices(getInvoices(org.id));
    }
  };

  const currentTariff = TARIFF_PLANS.find(t => t.id === activeOrg.currentTariffId) || TARIFF_PLANS[1];

  // Calculate usage stats filtered by active legal entity
  const currentOrgId = activeOrg?.id;
  const displayPoints = points.filter(p => !p.organizationId || p.organizationId === currentOrgId);
  const displayStaff = staffList.filter(s => !s.organizationId || s.organizationId === currentOrgId);
  const staffCount = displayStaff.length;
  const pointsCount = displayPoints.length;
  const isStaffLimitReached = staffCount >= currentTariff.staffLimit;
  const isPointsLimitReached = pointsCount >= currentTariff.pointsLimit;

  // Handle register new org
  const handleRegisterOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const res = registerOrganization({
      legalType: regLegalType,
      name: regOrgName,
      brandName: regBrandName || regOrgName,
      inn: regInn,
      ogrn: regOgrn,
      directorName: regDirector,
      email: regEmail,
      phone: regPhone,
      address: regAddress,
      tariffId: regTariff,
    });

    if (res.success && res.organization) {
      setActiveOrg(res.organization);
      setEditForm({ ...res.organization });
      setAllOrgs(getOrganizations());
      setInvoices(getInvoices(res.organization.id));
      setIsRegOrgModalOpen(false);
      // Reset form
      setRegOrgName('');
      setRegBrandName('');
      setRegInn('');
      setRegOgrn('');
      setRegDirector('');
      setRegEmail('');
      setRegPhone('');
      setRegAddress('');
    } else {
      setRegError(res.error || 'Ошибка регистрации организации');
    }
  };

  // Handle tariff change
  const handleApplyTariffChange = (tariffId: TariffPlanId) => {
    changeOrganizationTariff(activeOrg.id, tariffId);
    const updated = getActiveOrganization();
    setActiveOrg(updated);
    setSelectedTariffForSwitch(tariffId);
    setInvoices(getInvoices(activeOrg.id));
    setAllOrgs(getOrganizations());
  };

  // Handle generate invoice
  const handleCreateInvoiceClick = (tariffId: TariffPlanId, months: number) => {
    const inv = createInvoice(activeOrg.id, tariffId, months);
    if (inv) {
      setInvoices(getInvoices(activeOrg.id));
      setInvoiceModalData(inv);
    }
  };

  // Handle add staff
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);

    if (!newStaffName.trim()) {
      setStaffError('Укажите ФИО сотрудника');
      return;
    }
    if (!newStaffPin || newStaffPin.length !== 4) {
      setStaffError('PIN-код должен состоять ровно из 4 цифр');
      return;
    }

    if (isStaffLimitReached) {
      setStaffError(`Лимит сотрудников по тарифу "${currentTariff.name}" исчерпан (${staffCount}/${currentTariff.staffLimit}). Перейдите на тариф выше.`);
      return;
    }

    onAddStaff({
      name: newStaffName.trim(),
      role: newStaffRole,
      pinCode: newStaffPin.trim(),
      phone: newStaffPhone.trim() || undefined,
      pointId: newStaffSelectedPoints[0] || points[0]?.id || 'p-01',
      pointIds: newStaffSelectedPoints.length > 0 ? newStaffSelectedPoints : (points[0] ? [points[0].id] : ['p-01']),
    });

    setIsAddStaffModalOpen(false);
    setNewStaffName('');
    setNewStaffPin('');
    setNewStaffPhone('');
    setNewStaffSelectedPoints([]);
  };

  // Handle save requisites
  const handleSaveRequisites = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrganization(editForm);
    setActiveOrg(editForm);
    setIsEditingRequisites(false);
    setRequisitesSuccessMsg(true);
    setTimeout(() => setRequisitesSuccessMsg(false), 3000);
  };

  const togglePinVisibility = (id: string) => {
    setVisiblePins(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Requirement 2: Hide registered organization data after logging out of manager profile
  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 sm:p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 text-xs font-semibold mb-3">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>Конфиденциальные юридические данные</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          Данные организаций скрыты
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          После выхода из профиля реквизиты зарегистрированных юридических лиц (ИП / ООО), банковские счета, штатное расписание и финансовые акты закрыты для обеспечения безопасности коммерческой тайны.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {onOpenLoginModal && (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md transition"
            >
              <Key className="w-4 h-4" />
              <span>Войти в профиль управляющего</span>
            </button>
          )}
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('welcome')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm transition"
            >
              На главную
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Organization Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black text-xl shadow-md shadow-amber-500/20 shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {activeOrg.legalType === 'IP' ? 'Индивидуальный предприниматель' : 'Юридическое лицо (ООО)'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Тариф «{currentTariff.name}» активен</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {activeOrg.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Сеть: <strong className="text-slate-700 dark:text-slate-300">{activeOrg.brandName}</strong></span>
                <span>•</span>
                <span>ИНН: <strong className="font-mono text-slate-700 dark:text-slate-300">{activeOrg.inn}</strong></span>
                <span>•</span>
                <span>ОГРН/ОГРНИП: <strong className="font-mono text-slate-700 dark:text-slate-300">{activeOrg.ogrn}</strong></span>
              </p>
            </div>
          </div>

          {/* Org Selector & New Org Button */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {allOrgs.length > 1 ? (
              <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-500 px-2 hidden sm:inline">Юр. лицо:</span>
                <select
                  value={activeOrg.id}
                  onChange={(e) => handleSwitchOrg(e.target.value)}
                  className="bg-white dark:bg-slate-750 text-slate-900 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-650 shadow-xs focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  {allOrgs.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.legalType === 'IP' ? 'ИП ' : 'ООО '}{o.brandName} ({o.inn})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 p-2 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-750 dark:text-slate-200">
                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Привязка: {activeOrg.legalType === 'IP' ? 'ИП ' : 'ООО '}{activeOrg.brandName}</span>
              </div>
            )}

            {(currentUser?.role === 'director' || currentUser?.role === 'owner' || currentUser?.role === 'app_admin' || currentUser?.permissions?.canManagePermissions) && (
              <button
                type="button"
                onClick={() => setIsRegOrgModalOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Регистрация нового ИП / ООО</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Resource Quota Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Сотрудники</span>
              <Users className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-lg font-black text-slate-900 dark:text-white">{staffCount}</span>
              <span className="text-xs text-slate-400 font-bold">/ {currentTariff.staffLimit >= 9999 ? '∞' : currentTariff.staffLimit}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${isStaffLimitReached ? 'bg-rose-500' : 'bg-sky-500'}`}
                style={{ width: `${Math.min(100, (staffCount / (currentTariff.staffLimit || 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Кофейни / Точки</span>
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-lg font-black text-slate-900 dark:text-white">{pointsCount}</span>
              <span className="text-xs text-slate-400 font-bold">/ {currentTariff.pointsLimit >= 9999 ? '∞' : currentTariff.pointsLimit}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${isPointsLimitReached ? 'bg-rose-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (pointsCount / (currentTariff.pointsLimit || 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>MinIO S3 Фото</span>
              <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-lg font-black text-slate-900 dark:text-white">1.8</span>
              <span className="text-xs text-slate-400 font-bold">/ {Math.round(currentTariff.storageMbLimit / 1000)} ГБ</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '18%' }} />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Продление подписки</span>
              <Calendar className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-sm font-black text-slate-900 dark:text-white truncate">
              {activeOrg.tariffRenewalDate}
            </div>
            <div className="text-[10px] text-emerald-500 font-bold mt-2 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>Автопродление включено</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSection('hierarchy')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeSection === 'hierarchy'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Иерархия (Дерево юр. лица)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('billing')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeSection === 'billing'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Тарификация и биллинг</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('staff')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeSection === 'staff'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Штат сотрудников ({staffCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('requisites')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeSection === 'requisites'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Реквизиты организации</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('points')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeSection === 'points'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Кофейни и точки ({pointsCount})</span>
        </button>
      </div>

      {/* SECTION 0: HIERARCHY TREE & PROFILES */}
      {activeSection === 'hierarchy' && (
        <CompanyHierarchyView
          organization={activeOrg}
          currentUser={currentUser}
          points={points}
          staffList={staffList}
          onRefreshData={() => {
            const orgs = getOrganizations();
            const current = getActiveOrganization();
            setActiveOrg(current);
            setAllOrgs(getOrganizationsForUser(currentUser));
          }}
        />
      )}

      {/* SECTION 1: TARIFF & BILLING */}
      {activeSection === 'billing' && (
        <div className="space-y-6">
          {/* Period selector pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Период оплаты тарифа</h3>
              <p className="text-xs text-slate-500">При оплате на 6 или 12 месяцев действует скидка юр. лицу</p>
            </div>
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setBillingPeriodMonths(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  billingPeriodMonths === 1
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                1 месяц
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriodMonths(6)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                  billingPeriodMonths === 6
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>6 месяцев</span>
                <span className="text-[10px] text-emerald-500 font-black">-10%</span>
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriodMonths(12)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                  billingPeriodMonths === 12
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>12 месяцев</span>
                <span className="text-[10px] text-amber-500 font-black">-20%</span>
              </button>
            </div>
          </div>

          {/* 3 Tariff Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {getTariffPlans().map(plan => {
              const isCurrent = activeOrg.currentTariffId === plan.id;
              const discount = billingPeriodMonths >= 12 ? 0.20 : billingPeriodMonths >= 6 ? 0.10 : 0;
              const basePrice = Number(plan.priceMonthly ?? plan.priceMonthlyRub ?? 0) || 0;
              const monthlyPriceWithDiscount = Math.round(basePrice * (1 - discount));
              const totalPriceForPeriod = monthlyPriceWithDiscount * billingPeriodMonths;

              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl p-6 transition flex flex-col justify-between relative border ${
                    isCurrent
                      ? 'bg-gradient-to-b from-amber-500/10 to-transparent border-amber-500 shadow-md ring-2 ring-amber-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300'
                  }`}
                >
                  {plan.isPopular && (
                    <span className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-full shadow-xs">
                      {plan.badge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {plan.badge}
                      </span>
                      {isCurrent && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                          Текущий тариф
                        </span>
                      )}
                    </div>

                    <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      {plan.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 min-h-[34px]">
                      {plan.description}
                    </p>

                    <div className="my-5 pb-5 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-black text-slate-900 dark:text-white">
                          {(monthlyPriceWithDiscount || 0).toLocaleString('ru-RU')} ₽
                        </span>
                        <span className="text-xs text-slate-400 font-bold">/ месяц</span>
                      </div>
                      {billingPeriodMonths > 1 && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Итого: <strong className="text-slate-800 dark:text-slate-200">{(totalPriceForPeriod || 0).toLocaleString('ru-RU')} ₽</strong> за {billingPeriodMonths} мес.
                        </p>
                      )}
                    </div>

                    {/* Features list */}
                    <div className="space-y-2.5 mb-6 text-xs text-slate-600 dark:text-slate-300">
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-start space-x-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    {isCurrent ? (
                      <button
                        type="button"
                        onClick={() => handleCreateInvoiceClick(plan.id, billingPeriodMonths)}
                        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition shadow-xs"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>Сформировать счет на {billingPeriodMonths} мес.</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApplyTariffChange(plan.id)}
                        className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs transition"
                      >
                        Перейти на тариф «{plan.name}»
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Invoices and Accounting Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <Receipt className="w-5 h-5 text-amber-500" />
                  <span>Счета и закрывающие документы для бухгалтерии</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Официальные счета на оплату для ИП и ООО, акты выполненных работ и УПД
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCreateInvoiceClick(activeOrg.currentTariffId, billingPeriodMonths)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold transition self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Выставить новый счет</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-3 pr-4">Номер счета</th>
                    <th className="pb-3 px-4">Дата</th>
                    <th className="pb-3 px-4">Тариф</th>
                    <th className="pb-3 px-4">Период</th>
                    <th className="pb-3 px-4">Сумма (₽)</th>
                    <th className="pb-3 px-4">Статус</th>
                    <th className="pb-3 pl-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-3.5 pr-4 font-mono font-bold text-slate-900 dark:text-white">
                        {inv.number}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {inv.date}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {inv.tariffName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {inv.months} {inv.months === 1 ? 'месяц' : inv.months < 5 ? 'месяца' : 'месяцев'}
                      </td>
                      <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                        {(inv.totalAmountRub || 0).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Оплачен (Акт сформирован)</span>
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <button
                          type="button"
                          onClick={() => setInvoiceModalData(inv)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs transition"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Печать счета</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: STAFF MANAGEMENT IN LEGAL ENTITY */}
      {activeSection === 'staff' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <Users className="w-5 h-5 text-sky-500" />
                  <span>Штат сотрудников организации</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Бариста, шеф-бариста и управляющие {activeOrg.name}. Доступ к PWA терминалу по QR-коду и 4-значному PIN.
                </p>
              </div>

              <div className="flex items-center space-x-3 self-start sm:self-auto">
                <span className="text-xs text-slate-500 font-semibold">
                  Занято мест: <strong className="text-slate-900 dark:text-white">{staffCount} из {currentTariff.staffLimit >= 9999 ? '∞' : currentTariff.staffLimit}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(true)}
                  disabled={isStaffLimitReached}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Добавить сотрудника в штат</span>
                </button>
              </div>
            </div>

            {isStaffLimitReached && (
              <div className="p-3 mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Достигнут лимит штата по текущему тарифу ({staffCount} чел.). Для расширения штата выберите тариф «Бизнес-Сеть» или «Корпоративный».</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('billing')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] shrink-0 ml-2"
                >
                  Сменить тариф
                </button>
              </div>
            )}

            {/* Staff list cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {displayStaff.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                  В штате этой организации пока нет добавленных сотрудников. Нажмите «Добавить сотрудника в штат» выше.
                </div>
              ) : (
                displayStaff.map(member => {
                  const isPinVisible = !!visiblePins[member.id];
                  return (
                    <div
                      key={member.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 transition space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-black text-sm">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {member.name}
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold inline-block mt-0.5">
                              {member.role}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteStaff(member.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                          title="Удалить сотрудника"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-1">
                        {member.phone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono">{member.phone}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-755">
                          <div className="flex items-center space-x-1.5">
                            <Key className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[11px] font-medium text-slate-500">PIN терминала:</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white tracking-widest text-xs">
                              {isPinVisible ? member.pinCode : '••••'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePinVisibility(member.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="text-[10px] text-slate-400 pt-1">
                          Разрешенные кофейни: {member.pointIds?.length || 1} локации
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: REQUISITES */}
      {activeSection === 'requisites' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <span>Юридические и банковские реквизиты организации</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Используются для формирования счетов, актов выполненных работ и синхронизации с 1С:Предприятие
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingRequisites(!isEditingRequisites)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold transition self-start sm:self-auto"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditingRequisites ? 'Отменить редактирование' : 'Редактировать реквизиты'}</span>
            </button>
          </div>

          {requisitesSuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Реквизиты организации успешно сохранены и обновлены в 1С!</span>
            </div>
          )}

          {isEditingRequisites ? (
            <form onSubmit={handleSaveRequisites} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Наименование организации / ИП
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Бренд сети (вывеска)
                  </label>
                  <input
                    type="text"
                    value={editForm.brandName}
                    onChange={(e) => setEditForm({ ...editForm, brandName: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ИНН (10 или 12 цифр)
                  </label>
                  <input
                    type="text"
                    value={editForm.inn}
                    onChange={(e) => setEditForm({ ...editForm, inn: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ОГРН / ОГРНИП
                  </label>
                  <input
                    type="text"
                    value={editForm.ogrn}
                    onChange={(e) => setEditForm({ ...editForm, ogrn: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ФИО Руководителя / ИП
                  </label>
                  <input
                    type="text"
                    value={editForm.directorName}
                    onChange={(e) => setEditForm({ ...editForm, directorName: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email бухгалтерии
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Юридический адрес
                  </label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Наименование банка
                  </label>
                  <input
                    type="text"
                    value={editForm.bankName || ''}
                    onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                    placeholder="ПАО Сбербанк"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    БИК банка
                  </label>
                  <input
                    type="text"
                    value={editForm.bankBik || ''}
                    onChange={(e) => setEditForm({ ...editForm, bankBik: e.target.value })}
                    placeholder="044525225"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Расчетный счет (р/с)
                  </label>
                  <input
                    type="text"
                    value={editForm.bankAccount || ''}
                    onChange={(e) => setEditForm({ ...editForm, bankAccount: e.target.value })}
                    placeholder="40802810..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                >
                  Сохранить реквизиты
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingRequisites(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="text-slate-400 text-[11px] font-semibold">Официальное наименование:</div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">{activeOrg.name}</div>

                <div className="text-slate-400 text-[11px] font-semibold pt-2">Руководитель / ИП:</div>
                <div className="font-bold text-slate-800 dark:text-slate-200">{activeOrg.directorName}</div>

                <div className="text-slate-400 text-[11px] font-semibold pt-2">Юридический адрес:</div>
                <div className="text-slate-700 dark:text-slate-300">{activeOrg.address}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">ИНН:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{activeOrg.inn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ОГРН / ОГРНИП:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{activeOrg.ogrn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Банк:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{activeOrg.bankName || 'Не указан'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">БИК:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{activeOrg.bankBik || 'Не указан'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Р/с:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{activeOrg.bankAccount || 'Не указан'}</span>
                </div>
              </div>

              {/* Dedicated YDB Storage Isolation Card */}
              <div className="sm:col-span-2 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                      Изолированная база Yandex Database (YDB) юр. лица
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                    Изолированный контур
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/30 text-[11px] font-mono space-y-1">
                  <div className="text-slate-500 text-[10px]">Database Path:</div>
                  <div className="text-indigo-600 dark:text-indigo-400 break-all font-semibold">
                    {activeOrg.ydbConfig?.database || `/ru-central1/b1g88k2v84j901la2c/ydb-org-${activeOrg.inn}`}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  В этой изолированной YDB хранятся все данные данного юр. лица: учетные записи управляющих, линейный персонал, рабочие места (точки), PIN-коды смен, шаблоны и чек-листы. Другие юр. лица не имеют доступа к этой базе.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: POINTS / COFFEE SHOPS */}
      {activeSection === 'points' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-amber-500" />
                <span>Точки и кофейни сети ({pointsCount} из {currentTariff.pointsLimit >= 9999 ? '∞' : currentTariff.pointsLimit})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Кофейни, закрепленные за юридическим лицом {activeOrg.name}
              </p>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('qr')}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition self-start sm:self-auto"
              >
                <span>Печать QR-кодов для точек</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayPoints.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                В этой организации пока нет торговых точек. Вы можете добавить кофейню в разделе «Локации и точки».
              </div>
            ) : (
              displayPoints.map(pt => (
                <div
                  key={pt.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {pt.name}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                      {pt.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {pt.address}, {pt.city}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Режим: {pt.openingTime} - {pt.closingTime}</span>
                    <span>Управляющий: {pt.managerName}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW LEGAL ENTITY (ИП / ООО) */}
      {isRegOrgModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Регистрация юр. лица / ИП
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRegOrgModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {regError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                {regError}
              </div>
            )}

            <form onSubmit={handleRegisterOrgSubmit} className="space-y-3.5">
              <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRegLegalType('IP')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    regLegalType === 'IP'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  ИП (Индивидуальный предприниматель)
                </button>
                <button
                  type="button"
                  onClick={() => setRegLegalType('OOO')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    regLegalType === 'OOO'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  ООО (Юридическое лицо)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Официальное наименование {regLegalType === 'IP' ? 'ИП (например, ИП Смирнов А.В.)' : 'ООО (например, ООО "Кофе Сеть")'} *
                </label>
                <input
                  type="text"
                  value={regOrgName}
                  onChange={(e) => setRegOrgName(e.target.value)}
                  placeholder={regLegalType === 'IP' ? 'ИП Иванов Иван Иванович' : 'ООО "Кофейный Альянс"'}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Бренд / Торговое название сети кофеен
                </label>
                <input
                  type="text"
                  value={regBrandName}
                  onChange={(e) => setRegBrandName(e.target.value)}
                  placeholder='Coffee Bar, Specialty Corner...'
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ИНН ({regLegalType === 'IP' ? '12 цифр' : '10 цифр'}) *
                  </label>
                  <input
                    type="text"
                    value={regInn}
                    onChange={(e) => setRegInn(e.target.value)}
                    placeholder={regLegalType === 'IP' ? '772481928412' : '7810984521'}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ОГРН / ОГРНИП
                  </label>
                  <input
                    type="text"
                    value={regOgrn}
                    onChange={(e) => setRegOgrn(e.target.value)}
                    placeholder="321774600123456"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ФИО Руководителя / Индивидуального предпринимателя *
                </label>
                <input
                  type="text"
                  value={regDirector}
                  onChange={(e) => setRegDirector(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email бухгалтерии *
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="accountant@coffee.ru"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Телефон руководителя *
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+7 (999) 000-00-00"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Юридический адрес
                </label>
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="г. Москва, ул. Примерная, д. 1"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Стартовый тарифный план
                </label>
                <select
                  value={regTariff}
                  onChange={(e) => setRegTariff(e.target.value as TariffPlanId)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="start">Старт (ИП) - 1 точка, до 5 сотрудников (1 990 ₽/мес)</option>
                  <option value="business">Бизнес-Сеть - до 5 точек, до 20 сотрудников (4 990 ₽/мес)</option>
                  <option value="enterprise">Корпоративный Холдинг - безлимит точек (9 990 ₽/мес)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-sm"
                >
                  Зарегистрировать организацию в CheckList-1С
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD STAFF MEMBER TO LEGAL ENTITY */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Добавить сотрудника в {activeOrg.brandName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStaffModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {staffError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                {staffError}
              </div>
            )}

            <form onSubmit={handleAddStaffSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ФИО сотрудника *
                </label>
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="Соколов Денис"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Должность
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="Бариста">Бариста</option>
                  <option value="Шеф-бариста">Шеф-бариста</option>
                  <option value="Управляющий">Управляющий</option>
                  <option value="Пекарь">Пекарь</option>
                  <option value="Стажер">Стажер</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Персональный PIN-код терминала (4 цифры) *
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={newStaffPin}
                  onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold tracking-widest text-center"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Используется для авторизации бариста при переходе по QR-коду
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Номер телефона (для Telegram уведомлений)
                </label>
                <input
                  type="tel"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Доступ к кофейням (рабочие места)
                </label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  {(displayPoints.length > 0 ? displayPoints : points).map(pt => {
                    const isChecked = newStaffSelectedPoints.includes(pt.id);
                    return (
                      <label key={pt.id} className="flex items-center space-x-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewStaffSelectedPoints([...newStaffSelectedPoints, pt.id]);
                            } else {
                              setNewStaffSelectedPoints(newStaffSelectedPoints.filter(id => id !== pt.id));
                            }
                          }}
                          className="rounded text-amber-500 focus:ring-amber-400"
                        />
                        <span className="font-semibold">{pt.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-sm"
                >
                  Добавить сотрудника
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINT INVOICE / СЧЕТ-ОФЕРТА ДЛЯ БУХГАЛТЕРИИ */}
      {invoiceModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Счет на оплату № {invoiceModalData.number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Printable View */}
            <div className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-4 font-mono">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-3 font-sans">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-sm">ООО "ХОРЕКА-ИТ СИСТЕМС"</h4>
                  <p className="text-[11px] text-slate-500">ИНН 7705918273 / КПП 770501001</p>
                  <p className="text-[11px] text-slate-500">Р/с 40702810900000012891 в АО "ТБанк"</p>
                  <p className="text-[11px] text-slate-500">БИК 044525974, К/с 30101810145250000974</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                    ОПЛАЧЕНО
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">от {invoiceModalData.date}</p>
                </div>
              </div>

              <div className="font-sans space-y-1">
                <div className="text-slate-400 text-[11px]">Плательщик (Покупатель):</div>
                <div className="font-bold text-slate-900 dark:text-white">{invoiceModalData.organizationName}</div>
                <div className="text-slate-500">ИНН: {invoiceModalData.inn}</div>
              </div>

              <div className="font-sans">
                <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-700">
                  <thead className="bg-slate-100 dark:bg-slate-750 font-bold">
                    <tr>
                      <th className="p-2 border-b">Наименование услуги</th>
                      <th className="p-2 border-b text-center">Кол-во</th>
                      <th className="p-2 border-b text-right">Сумма (₽)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2">
                        Предоставление лицензии на ПО «CheckList-1C Cloud» (Тариф «{invoiceModalData.tariffName}») на {invoiceModalData.months} мес.
                      </td>
                      <td className="p-2 text-center">{invoiceModalData.months} мес.</td>
                      <td className="p-2 text-right font-bold">{(invoiceModalData.totalAmountRub || 0).toLocaleString('ru-RU')} ₽</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 font-sans font-black text-sm text-slate-900 dark:text-white">
                <span>Итого к оплате (Без НДС, УСН):</span>
                <span>{(invoiceModalData.totalAmountRub || 0).toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                <Printer className="w-4 h-4" />
                <span>Распечатать счет</span>
              </button>
              <button
                type="button"
                onClick={() => setInvoiceModalData(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
