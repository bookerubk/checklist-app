import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  MapPin, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Plus, 
  Check, 
  CheckCircle2, 
  UserCheck, 
  ChevronRight, 
  Sliders, 
  Key, 
  Coffee, 
  Sparkles,
  Info,
  Layers,
  Crown,
  Wrench,
  ClipboardCheck,
  Briefcase,
  SearchCode
} from 'lucide-react';
import { 
  CompanyOrganization, 
  PointLocation, 
  StaffMember, 
  ManagerUser, 
  ManagerRole, 
  UserPermissions 
} from '../../types';
import { 
  getProfilesForOrganization, 
  updateUserProfilePermissions, 
  updateUserRole, 
  getEffectivePermissions,
  ROLE_PERMISSIONS,
  registerCustomManager
} from '../../services/managerAuth';

interface CompanyHierarchyViewProps {
  organization: CompanyOrganization;
  currentUser: ManagerUser | null;
  points: PointLocation[];
  staffList: StaffMember[];
  onRefreshData?: () => void;
}

export const CompanyHierarchyView: React.FC<CompanyHierarchyViewProps> = ({
  organization,
  currentUser,
  points,
  staffList,
  onRefreshData
}) => {
  const [profiles, setProfiles] = useState<ManagerUser[]>(() => 
    getProfilesForOrganization(organization.id)
  );

  // State for adding a new profile
  const [isAddProfileModalOpen, setIsAddProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileLogin, setNewProfileLogin] = useState('');
  const [newProfilePassword, setNewProfilePassword] = useState('');
  const [newProfileRole, setNewProfileRole] = useState<ManagerRole>('manager');
  const [newProfilePhone, setNewProfilePhone] = useState('');
  const [addProfileError, setAddProfileError] = useState<string | null>(null);

  // Active view tab: 'tree' | 'profiles' | 'points_staff'
  const [activeSubTab, setActiveSubTab] = useState<'tree' | 'profiles' | 'points_staff'>('tree');

  // Filtered points & staff for this legal entity
  const orgPoints = points.filter(p => 
    p.organizationInn === organization.inn || 
    p.organizationId === organization.id
  );

  const orgStaff = staffList.filter(s => 
    s.organizationInn === organization.inn || 
    s.organizationId === organization.id
  );

  // Check if current user is Director (can assign permissions)
  const isDirector = 
    currentUser?.role === 'director' || 
    currentUser?.role === 'owner' || 
    currentUser?.role === 'app_admin' || 
    currentUser?.permissions?.canManagePermissions === true;

  const refreshProfiles = () => {
    setProfiles(getProfilesForOrganization(organization.id));
    if (onRefreshData) onRefreshData();
  };

  const handleTogglePermission = (userId: string, key: keyof UserPermissions, currentValue: boolean) => {
    if (!isDirector) return;
    updateUserProfilePermissions(userId, { [key]: !currentValue });
    refreshProfiles();
  };

  const handleChangeRole = (userId: string, newRole: ManagerRole) => {
    if (!isDirector) return;
    updateUserRole(userId, newRole);
    refreshProfiles();
  };

  const handleCreateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddProfileError(null);

    if (!newProfileName.trim() || !newProfileLogin.trim() || !newProfilePassword.trim()) {
      setAddProfileError('Заполните все обязательные поля');
      return;
    }

    const result = await registerCustomManager({
      name: newProfileName.trim(),
      login: newProfileLogin.trim(),
      password: newProfilePassword.trim(),
      role: newProfileRole,
      phone: newProfilePhone.trim() || undefined,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationInn: organization.inn,
    });

    if (!result.success) {
      setAddProfileError(result.error || 'Ошибка при создании профиля');
      return;
    }

    setIsAddProfileModalOpen(false);
    setNewProfileName('');
    setNewProfileLogin('');
    setNewProfilePassword('');
    setNewProfilePhone('');
    refreshProfiles();
  };

  const getRoleIcon = (role: ManagerRole) => {
    switch (role) {
      case 'director':
      case 'owner':
        return <Crown className="w-4 h-4 text-amber-500" />;
      case 'developer':
      case 'tech_admin':
        return <Wrench className="w-4 h-4 text-purple-400" />;
      case 'auditor':
        return <SearchCode className="w-4 h-4 text-sky-400" />;
      case 'manager':
      case 'regional_manager':
        return <Briefcase className="w-4 h-4 text-emerald-400" />;
      case 'quality_control':
        return <ClipboardCheck className="w-4 h-4 text-rose-400" />;
      default:
        return <Users className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner with Active Legal Entity & Hierarchy Scope */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {organization.legalType === 'IP' ? 'Индивидуальный предприниматель' : 'Юридическое лицо (ООО)'}
                </span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Сеть «{organization.brandName}»
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                Иерархия доступа и профилей: {organization.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ИНН: <strong className="font-mono text-slate-700 dark:text-slate-300">{organization.inn}</strong> • 
                Видно только те юридические лица и кофейни, к которым привязаны профили
              </p>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('tree')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'tree'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Дерево иерархии</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('profiles')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'profiles'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Профили и права ({profiles.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('points_staff')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'points_staff'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Кофейни и линейный персонал</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: INTERACTIVE HIERARCHICAL TREE                    */}
      {/* ======================================================== */}
      {activeSubTab === 'tree' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Структурное дерево юридического лица</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Строгая многоуровневая изоляция: Профили управления → Кофейни сети → Линейный персонал точки
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center space-x-1 border ${
                isDirector 
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}>
                {isDirector ? <Crown className="w-3.5 h-3.5 text-amber-500" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                <span>{isDirector ? 'Вы: Директор (полные права назначения)' : 'Вы: Ограниченный профиль'}</span>
              </span>
            </div>
          </div>

          {/* Graphical Tree Render */}
          <div className="space-y-6 font-sans">
            {/* LEVEL 1: LEGAL ENTITY ROOT */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Юридическое лицо (Корень)
                  </span>
                  <span className="font-mono text-xs text-slate-500">ИНН: {organization.inn}</span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {organization.name}
                </div>
                <div className="text-xs text-slate-500">
                  Руководитель: <strong>{organization.directorName}</strong>
                </div>
              </div>
            </div>

            {/* Tree Branch Split: Profiles and Coffee Points */}
            <div className="pl-6 sm:pl-10 border-l-2 border-dashed border-amber-500/30 space-y-8 ml-5 sm:ml-7">
              
              {/* LEVEL 2A: MANAGEMENT PROFILES */}
              <div className="relative">
                {/* Branch line marker */}
                <div className="absolute -left-6 sm:-left-10 top-5 w-6 sm:w-10 h-0.5 border-t-2 border-dashed border-amber-500/30" />

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Профили юр. лица
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          (Видно только те юр. лица, к которым привязаны профили)
                        </p>
                      </div>
                    </div>

                    {isDirector && (
                      <button
                        type="button"
                        onClick={() => setIsAddProfileModalOpen(true)}
                        className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить профиль</span>
                      </button>
                    )}
                  </div>

                  {/* Profile Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2">
                    {profiles.map(p => {
                      const perms = getEffectivePermissions(p);
                      const isCurrentUser = currentUser?.id === p.id;
                      const roleConfig = ROLE_PERMISSIONS[p.role] || ROLE_PERMISSIONS.manager;

                      return (
                        <div 
                          key={p.id}
                          className={`p-3 rounded-xl border transition ${
                            p.role === 'director' || p.role === 'owner'
                              ? 'bg-amber-500/5 border-amber-500/30'
                              : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2 min-w-0">
                              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                                {getRoleIcon(p.role)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {p.name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  @{p.login} {isCurrentUser && ' (Вы)'}
                                </div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${roleConfig.badgeColor}`}>
                              {roleConfig.title}
                            </span>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                            {p.role === 'director' || p.role === 'owner' ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
                                <Crown className="w-3 h-3 shrink-0" />
                                <span>Владеет всеми правами и назначает для других</span>
                              </span>
                            ) : (
                              <span>
                                {roleConfig.description}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* LEVEL 2B: COFFEE POINTS & LINEAR STAFF */}
              <div className="relative">
                {/* Branch line marker */}
                <div className="absolute -left-6 sm:-left-10 top-5 w-6 sm:w-10 h-0.5 border-t-2 border-dashed border-amber-500/30" />

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Кофейни юридического лица ({orgPoints.length})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Точки сети, привязанные к ИНН {organization.inn}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Points with their Nested Linear Staff */}
                  <div className="space-y-4">
                    {orgPoints.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        К данному юр. лицу пока не привязаны точки кофеен.
                      </div>
                    ) : (
                      orgPoints.map(point => {
                        const pointStaff = orgStaff.filter(s => 
                          s.pointId === point.id || 
                          (s.pointIds && s.pointIds.includes(point.id))
                        );

                        return (
                          <div 
                            key={point.id}
                            className="bg-white dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 shadow-2xs"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-xs shrink-0">
                                  ☕
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                                    {point.name}
                                  </h5>
                                  <p className="text-[11px] text-slate-500">
                                    {point.city}, {point.address}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 self-start sm:self-auto">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                                  {point.openingTime} – {point.closingTime}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                  {pointStaff.length} бариста
                                </span>
                              </div>
                            </div>

                            {/* Nested Linear Staff under this point */}
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
                                <span>Линейный персонал кофейни</span>
                                <span className="text-[10px] font-normal lowercase text-slate-400">
                                  (доступ строго к {point.name})
                                </span>
                              </div>

                              {pointStaff.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic">
                                  На данную точку пока не назначены сотрудники
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {pointStaff.map(staff => (
                                    <div 
                                      key={staff.id}
                                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                          {staff.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          {staff.role} • PIN: <strong className="font-mono text-amber-500">••••</strong>
                                        </div>
                                      </div>
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                                        Привязан
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: PROFILES & GRANULAR PERMISSIONS MATRIX           */}
      {/* ======================================================== */}
      {activeSubTab === 'profiles' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <span>Управление профилями и назначение разрешений</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Директор юридического лица владеет всеми разрешениями и настраивает доступ для каждого профиля.
              </p>
            </div>

            {isDirector && (
              <button
                type="button"
                onClick={() => setIsAddProfileModalOpen(true)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-xs self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Добавить профиль в юр. лицо</span>
              </button>
            )}
          </div>

          {!isDirector && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-center space-x-2 font-medium">
              <Lock className="w-4 h-4 shrink-0 text-amber-500" />
              <span>
                Вы находитесь в режиме просмотра. Назначать и изменять разрешения для профилей может только <strong>Директор</strong> организации.
              </span>
            </div>
          )}

          {/* Profiles Granular Matrix Cards */}
          <div className="space-y-4">
            {profiles.map((p) => {
              const perms = getEffectivePermissions(p);
              const isProfileDirector = p.role === 'director' || p.role === 'owner';
              const isCurrentUser = currentUser?.id === p.id;
              const roleConfig = ROLE_PERMISSIONS[p.role] || ROLE_PERMISSIONS.manager;

              return (
                <div 
                  key={p.id}
                  className={`p-5 rounded-3xl border transition ${
                    isProfileDirector
                      ? 'bg-amber-500/5 border-amber-500/30 shadow-2xs'
                      : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start space-x-3.5">
                      <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                        {getRoleIcon(p.role)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {p.name}
                          </h4>
                          {isCurrentUser && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              Это ваш профиль
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleConfig.badgeColor}`}>
                            {roleConfig.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Логин: <strong className="font-mono text-slate-700 dark:text-slate-300">@{p.login}</strong></span>
                          <span>•</span>
                          <span>Телефон: <strong className="text-slate-700 dark:text-slate-300">{p.phone || 'Не указан'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Role Selector (Enabled only for Director) */}
                    <div className="flex items-center space-x-2 self-start lg:self-center">
                      <span className="text-xs font-semibold text-slate-500">Роль в юр. лице:</span>
                      {isDirector && !isProfileDirector ? (
                        <select
                          value={p.role}
                          onChange={(e) => handleChangeRole(p.id, e.target.value as ManagerRole)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="manager">Управляющий</option>
                          <option value="developer">Разработчик / администратор</option>
                          <option value="auditor">Аудитор</option>
                          <option value="quality_control">Контроль качества</option>
                          <option value="director">Директор</option>
                        </select>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                          {roleConfig.title}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Granular Permission Toggles Matrix */}
                  <div className="mt-4">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5 flex items-center justify-between">
                      <span>Назначенные разрешения:</span>
                      {isProfileDirector && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                          ★ Директор обладает всеми разрешениями по умолчанию
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {/* 1. Templates */}
                      <div 
                        onClick={() => !isProfileDirector && isDirector && handleTogglePermission(p.id, 'canEditTemplates', perms.canEditTemplates)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                          isProfileDirector || !isDirector ? 'cursor-default' : 'cursor-pointer hover:border-amber-500'
                        } ${
                          perms.canEditTemplates
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-semibold">Конструктор чек-листов</span>
                        {perms.canEditTemplates ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      </div>

                      {/* 2. Points */}
                      <div 
                        onClick={() => !isProfileDirector && isDirector && handleTogglePermission(p.id, 'canManagePoints', perms.canManagePoints)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                          isProfileDirector || !isDirector ? 'cursor-default' : 'cursor-pointer hover:border-amber-500'
                        } ${
                          perms.canManagePoints
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-semibold">Управление точками</span>
                        {perms.canManagePoints ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      </div>

                      {/* 3. Staff */}
                      <div 
                        onClick={() => !isProfileDirector && isDirector && handleTogglePermission(p.id, 'canManageStaff', perms.canManageStaff)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                          isProfileDirector || !isDirector ? 'cursor-default' : 'cursor-pointer hover:border-amber-500'
                        } ${
                          perms.canManageStaff
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-semibold">Управление персоналом</span>
                        {perms.canManageStaff ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      </div>

                      {/* 4. Finances */}
                      <div 
                        onClick={() => !isProfileDirector && isDirector && handleTogglePermission(p.id, 'canViewFinances', perms.canViewFinances)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                          isProfileDirector || !isDirector ? 'cursor-default' : 'cursor-pointer hover:border-amber-500'
                        } ${
                          perms.canViewFinances
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-semibold">Финансы и тарифы</span>
                        {perms.canViewFinances ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      </div>

                      {/* 5. DataLens */}
                      <div 
                        onClick={() => !isProfileDirector && isDirector && handleTogglePermission(p.id, 'canViewBiDataLens', perms.canViewBiDataLens)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                          isProfileDirector || !isDirector ? 'cursor-default' : 'cursor-pointer hover:border-amber-500'
                        } ${
                          perms.canViewBiDataLens
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-semibold">Аналитика DataLens</span>
                        {perms.canViewBiDataLens ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      </div>

                      {/* 6. Cloud Services */}
                      <div 
                        onClick={() => !isProfileDirector && isDirector && handleTogglePermission(p.id, 'canAccessCloudInfrastructure', perms.canAccessCloudInfrastructure)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                          isProfileDirector || !isDirector ? 'cursor-default' : 'cursor-pointer hover:border-amber-500'
                        } ${
                          perms.canAccessCloudInfrastructure
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-semibold">YDB SQL & S3 MinIO</span>
                        {perms.canAccessCloudInfrastructure ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      </div>

                      {/* 7. Audit */}
                      <div 
                        onClick={() => !isProfileDirector && isDirector && handleTogglePermission(p.id, 'canAuditSubmissions', perms.canAuditSubmissions)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                          isProfileDirector || !isDirector ? 'cursor-default' : 'cursor-pointer hover:border-amber-500'
                        } ${
                          perms.canAuditSubmissions
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-semibold">Аудит чек-листов</span>
                        {perms.canAuditSubmissions ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: COFFEE POINTS & LINEAR STAFF SCOPING             */}
      {/* ======================================================== */}
      {activeSubTab === 'points_staff' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Coffee className="w-5 h-5 text-amber-500" />
              <span>Кофейни и линейный персонал юридического лица</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              По регламенту безопасности: линейный персонал имеет доступ только к тому юр. лицу и той кофейне, к которой привязан.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orgPoints.map((point) => {
              const staffForPoint = orgStaff.filter(s => 
                s.pointId === point.id || 
                (s.pointIds && s.pointIds.includes(point.id))
              );

              return (
                <div 
                  key={point.id}
                  className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-750"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Кофейня сети
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {point.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {point.address}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
                      {staffForPoint.length} бариста
                    </span>
                  </div>

                  {/* Staff List */}
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400">
                      Линейный персонал (привязанный к точке):
                    </div>
                    {staffForPoint.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Сотрудники не назначены</p>
                    ) : (
                      staffForPoint.map(staff => (
                        <div 
                          key={staff.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-[10px]">
                              {staff.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {staff.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] text-slate-400">{staff.role}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Доступ активен
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD NEW PROFILE TO LEGAL ENTITY                   */}
      {/* ======================================================== */}
      {isAddProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-amber-500" />
                <span>Новый профиль: {organization.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {addProfileError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {addProfileError}
              </div>
            )}

            <form onSubmit={handleCreateProfileSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ФИО сотрудника *
                </label>
                <input
                  type="text"
                  required
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Логин для входа *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProfileLogin}
                    onChange={(e) => setNewProfileLogin(e.target.value)}
                    placeholder="ivanov"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Пароль *
                  </label>
                  <input
                    type="password"
                    required
                    value={newProfilePassword}
                    onChange={(e) => setNewProfilePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Роль профиля *
                </label>
                <select
                  value={newProfileRole}
                  onChange={(e) => setNewProfileRole(e.target.value as ManagerRole)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                >
                  <option value="manager">Управляющий (руководство точкой)</option>
                  <option value="developer">Разработчик / администратор (тех. настройки)</option>
                  <option value="auditor">Аудитор (проверка качества и чек-листов)</option>
                  <option value="quality_control">Контроль качества (санитария и ХАССП)</option>
                  <option value="director">Директор (владелец юр. лица)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={newProfilePhone}
                  onChange={(e) => setNewProfilePhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddProfileModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-xs"
                >
                  Создать профиль
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
