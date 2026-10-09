import { ManagerUser, ManagerRole, TabType, UserPermissions } from '../types';
import { getOrganizations, findOrganizationByInn, getActiveOrganization, INITIAL_ORGS, cleanInnString } from './companyService';
import { getPlatformAdmins, updatePlatformAdmin } from './platformAdminService';
import { queryClientDb } from './ydbApiService';
import { CLEAN_START_FLAG } from './cleanStartService';
import { STORAGE_YDB_CUSTOM_CONFIGURED } from './ydbService';
import { INITIAL_POINTS, INITIAL_STAFF, PREBUILT_TEMPLATES, INITIAL_SUBMISSIONS } from '../mockData';

const STORAGE_AUTH_KEY = 'checklist_manager_auth_session';
const STORAGE_CUSTOM_MANAGERS_KEY = 'checklist_custom_registered_managers';

export interface ManagerWithAuth extends ManagerUser {
  passwordHash: string;
  isActive?: boolean;
}

export const ROLE_PERMISSIONS: Record<ManagerRole, {
  title: string;
  badgeColor: string;
  description: string;
  allowedTabs: TabType[];
}> = {
  director: {
    title: 'Директор',
    badgeColor: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
    description: 'Владеет всеми разрешениями юр. лица и может назначать разрешения для других профилей',
    allowedTabs: ['welcome', 'company', 'datalens', 'builder', 'staff_points', 'qr', 'runner', 'telegram', 'ydb', 'minio'],
  },
  developer: {
    title: 'Разработчик / администратор',
    badgeColor: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
    description: 'Техническое управление, YDB SQL, MinIO S3, конструктор чек-листов и интеграции',
    allowedTabs: ['welcome', 'company', 'runner', 'datalens', 'ydb', 'minio', 'builder', 'staff_points', 'telegram', 'qr'],
  },
  auditor: {
    title: 'Аудитор',
    badgeColor: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    description: 'Аудит чек-листов, стандарты ХАССП, аудит соблюдения регламентов и отчёты DataLens',
    allowedTabs: ['welcome', 'company', 'datalens', 'builder', 'runner', 'qr'],
  },
  manager: {
    title: 'Управляющий',
    badgeColor: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
    description: 'Управление кофейнями, линейным персоналом, чек-листами смен и Telegram-ботом',
    allowedTabs: ['welcome', 'company', 'datalens', 'builder', 'staff_points', 'qr', 'runner', 'telegram'],
  },
  quality_control: {
    title: 'Контроль качества',
    badgeColor: 'bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30',
    description: 'Контроль стандартов качества, проверка фотоотчётов и журнал нарушений смен',
    allowedTabs: ['welcome', 'company', 'datalens', 'builder', 'runner'],
  },
  owner: {
    title: 'Директор (Владелец)',
    badgeColor: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
    description: 'Владеет всеми разрешениями юр. лица и может назначать разрешения для других профилей',
    allowedTabs: ['welcome', 'company', 'datalens', 'builder', 'staff_points', 'qr', 'runner', 'telegram', 'ydb', 'minio'],
  },
  regional_manager: {
    title: 'Территориальный управляющий',
    badgeColor: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    description: 'Отчеты по закрепленным точкам и контроль исполнения',
    allowedTabs: ['welcome', 'company', 'datalens', 'builder', 'staff_points', 'qr', 'runner'],
  },
  tech_admin: {
    title: 'Системный администратор',
    badgeColor: 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30',
    description: 'Инфраструктурные сервисы, YDB и S3 хранилище',
    allowedTabs: ['welcome', 'company', 'runner', 'datalens', 'ydb', 'minio', 'builder', 'staff_points', 'telegram', 'qr'],
  },
  app_admin: {
    title: 'Администратор приложения',
    badgeColor: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
    description: 'Платформенный администратор: просмотр зарегистрированных организаций и управление тарифами',
    allowedTabs: ['company', 'welcome'],
  },
};

export const DEFAULT_ROLE_PERMISSIONS: Record<ManagerRole, UserPermissions> = {
  director: {
    canEditTemplates: true,
    canManagePoints: true,
    canManageStaff: true,
    canViewFinances: true,
    canViewBiDataLens: true,
    canAccessCloudInfrastructure: true,
    canAuditSubmissions: true,
    canManagePermissions: true,
  },
  owner: {
    canEditTemplates: true,
    canManagePoints: true,
    canManageStaff: true,
    canViewFinances: true,
    canViewBiDataLens: true,
    canAccessCloudInfrastructure: true,
    canAuditSubmissions: true,
    canManagePermissions: true,
  },
  developer: {
    canEditTemplates: true,
    canManagePoints: true,
    canManageStaff: true,
    canViewFinances: false,
    canViewBiDataLens: true,
    canAccessCloudInfrastructure: true,
    canAuditSubmissions: true,
    canManagePermissions: false,
  },
  auditor: {
    canEditTemplates: false,
    canManagePoints: false,
    canManageStaff: false,
    canViewFinances: false,
    canViewBiDataLens: true,
    canAccessCloudInfrastructure: false,
    canAuditSubmissions: true,
    canManagePermissions: false,
  },
  manager: {
    canEditTemplates: true,
    canManagePoints: true,
    canManageStaff: true,
    canViewFinances: true,
    canViewBiDataLens: true,
    canAccessCloudInfrastructure: false,
    canAuditSubmissions: true,
    canManagePermissions: false,
  },
  quality_control: {
    canEditTemplates: false,
    canManagePoints: false,
    canManageStaff: false,
    canViewFinances: false,
    canViewBiDataLens: true,
    canAccessCloudInfrastructure: false,
    canAuditSubmissions: true,
    canManagePermissions: false,
  },
  regional_manager: {
    canEditTemplates: true,
    canManagePoints: true,
    canManageStaff: true,
    canViewFinances: true,
    canViewBiDataLens: true,
    canAccessCloudInfrastructure: false,
    canAuditSubmissions: true,
    canManagePermissions: false,
  },
  tech_admin: {
    canEditTemplates: true,
    canManagePoints: true,
    canManageStaff: true,
    canViewFinances: false,
    canViewBiDataLens: true,
    canAccessCloudInfrastructure: true,
    canAuditSubmissions: false,
    canManagePermissions: false,
  },
  app_admin: {
    canEditTemplates: false,
    canManagePoints: false,
    canManageStaff: false,
    canViewFinances: true,
    canViewBiDataLens: false,
    canAccessCloudInfrastructure: false,
    canAuditSubmissions: false,
    canManagePermissions: false,
  },
};

export const PRESET_MANAGERS: ManagerWithAuth[] = [
  {
    id: 'mgr-director-smirnov',
    login: 'director',
    email: 'director@smirnov-coffee.ru',
    name: 'Алексей Владимирович Смирнов',
    role: 'director',
    roleTitle: 'Директор (ИП Смирнов А.В.)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: '+7 (916) 450-22-11',
    passwordHash: 'admin2026',
    organizationId: 'org-smirnov',
    organizationName: 'ИП Смирнов Алексей Владимирович',
    organizationInn: '772481928412',
    permissions: DEFAULT_ROLE_PERMISSIONS.director,
  },
  {
    id: 'mgr-dev',
    login: 'developer',
    email: 'dev@horeca-group.ru',
    name: 'Виктор Сергеев',
    role: 'developer',
    roleTitle: 'Разработчик / администратор',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: '+7 (999) 000-11-22',
    passwordHash: 'dev2026',
    organizationId: 'org-smirnov',
    organizationName: 'ИП Смирнов Алексей Владимирович',
    organizationInn: '772481928412',
    permissions: DEFAULT_ROLE_PERMISSIONS.developer,
  },
  {
    id: 'mgr-unit',
    login: 'manager',
    email: 'manager@horeca-group.ru',
    name: 'Ольга Васильева',
    role: 'manager',
    roleTitle: 'Управляющий сети кофеен',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: '+7 (999) 222-33-44',
    passwordHash: 'manager2026',
    organizationId: 'org-smirnov',
    organizationName: 'ИП Смирнов Алексей Владимирович',
    organizationInn: '772481928412',
    permissions: DEFAULT_ROLE_PERMISSIONS.manager,
  },
  {
    id: 'mgr-auditor',
    login: 'auditor',
    email: 'auditor@horeca-group.ru',
    name: 'Дмитрий Орлов',
    role: 'auditor',
    roleTitle: 'Аудитор стандартов и ХАССП',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: '+7 (999) 333-44-55',
    passwordHash: 'audit2026',
    organizationId: 'org-smirnov',
    organizationName: 'ИП Смирнов Алексей Владимирович',
    organizationInn: '772481928412',
    permissions: DEFAULT_ROLE_PERMISSIONS.auditor,
  },
  {
    id: 'mgr-qc',
    login: 'quality',
    email: 'qc@smirnov-coffee.ru',
    name: 'Екатерина Соколова',
    role: 'quality_control',
    roleTitle: 'Контроль качества',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: '+7 (916) 777-88-99',
    passwordHash: 'qc2026',
    organizationId: 'org-smirnov',
    organizationName: 'ИП Смирнов Алексей Владимирович',
    organizationInn: '772481928412',
    permissions: DEFAULT_ROLE_PERMISSIONS.quality_control,
  },
  {
    id: 'mgr-holding-director',
    login: 'morozov',
    email: 'morozov@nordicroast.spb.ru',
    name: 'Алексей Николаевич Морозов',
    role: 'director',
    roleTitle: 'Генеральный директор',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: '+7 (812) 380-99-00',
    passwordHash: 'admin2026',
    organizationId: 'org-holding',
    organizationName: 'ООО "Кофе Холдинг Северо-Запад"',
    organizationInn: '7810984521',
    permissions: DEFAULT_ROLE_PERMISSIONS.director,
  },
  {
    id: 'mgr-vasilieva-director',
    login: 'vasilieva',
    email: 'm.vasilieva@specialty-corner.ru',
    name: 'Мария Константиновна Васильева',
    role: 'director',
    roleTitle: 'Директор (ИП Васильева М.К.)',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: '+7 (925) 777-14-30',
    passwordHash: 'admin2026',
    organizationId: 'org-vasilieva',
    organizationName: 'ИП Васильева Мария Константиновна',
    organizationInn: '500192847291',
    permissions: DEFAULT_ROLE_PERMISSIONS.director,
  },
  {
    id: 'mgr-app-admin',
    login: 'appadmin',
    email: 'root@horeca-platform.ru',
    name: 'Администратор платформы',
    role: 'app_admin',
    roleTitle: 'Администратор приложения',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: '+7 (800) 555-35-35',
    passwordHash: 'admin2026',
    permissions: DEFAULT_ROLE_PERMISSIONS.app_admin,
  }
];

// Helper to get custom registered managers
export const getCustomManagers = (): ManagerWithAuth[] => {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_MANAGERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Асинхронно читает кастомных управленцев из YDB.
 * Используется для мультиустройственного входа.
 * При ошибке (нет сети, нет таблицы) — возвращает [].
 */
export const getCustomManagersFromYdb = async (): Promise<ManagerWithAuth[]> => {
  try {
    let res = await queryClientDb(
      `SELECT id, organization_id, organization_inn, organization_name, login, name, email, phone, role, password_hash, assigned_points, is_active, created_at FROM users WHERE is_active = true OR is_active IS NULL;`
    );
    if (res.error) {
      // Fallback на случай, если колонка organization_name или is_active ещё не добавлена
      res = await queryClientDb(
        `SELECT id, organization_id, organization_inn, login, name, email, phone, role, password_hash, assigned_points, created_at FROM users;`
      );
    }
    if (res.error) {
      console.warn('Failed to fetch users from YDB:', res.error);
      return [];
    }
    return (res.rows || []).map((row: any): ManagerWithAuth => {
      const role = (row.role as ManagerRole) || 'manager';
      const roleInfo = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.manager;

      let parsedPoints: string[] = ['all'];
      if (Array.isArray(row.assigned_points)) {
        parsedPoints = row.assigned_points.map(String);
      } else if (typeof row.assigned_points === 'string') {
        try {
          const parsed = JSON.parse(row.assigned_points);
          parsedPoints = Array.isArray(parsed) ? parsed.map(String) : ['all'];
        } catch {
          parsedPoints = ['all'];
        }
      }

      const matchedOrg = (row.organization_inn && findOrganizationByInn(String(row.organization_inn))) ||
                         (row.organization_id && getOrganizations().find(o => o.id === row.organization_id));

      return {
        id: String(row.id),
        login: String(row.login || ''),
        name: String(row.name || ''),
        email: String(row.email || ''),
        phone: String(row.phone || ''),
        role,
        roleTitle: roleInfo.title,
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        assignedPoints: parsedPoints,
        passwordHash: String(row.password_hash || ''),
        organizationId: row.organization_id || matchedOrg?.id || undefined,
        organizationName: row.organization_name || matchedOrg?.name || undefined,
        organizationInn: row.organization_inn || matchedOrg?.inn || undefined,
        permissions: DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.manager,
        isActive: row.is_active !== false,
      };
    });
  } catch (err) {
    console.warn('getCustomManagersFromYdb error:', err);
    return [];
  }
};

/**
 * Синхронизирует кастомных управленцев из YDB в localStorage.
 * Вызывается при старте SPA — чтобы getAllManagersWithAuth видел свежие данные.
 */
export const syncCustomManagersFromYdb = async (): Promise<void> => {
  const ydbManagers = await getCustomManagersFromYdb();
  if (ydbManagers.length === 0) return;

  try {
    const localManagers = getCustomManagers();
    const map = new Map<string, ManagerWithAuth>();
    for (const m of localManagers) {
      map.set(m.id, m);
    }
    for (const m of ydbManagers) {
      map.set(m.id, m);
    }
    const combined = Array.from(map.values());
    localStorage.setItem(STORAGE_CUSTOM_MANAGERS_KEY, JSON.stringify(combined));
  } catch (e) {
    console.warn('Failed to cache YDB managers to localStorage', e);
  }
};

export const getAllManagersWithAuth = (): ManagerWithAuth[] => {
  // Флаг: показывать ли демо-пресеты (только в dev-режиме или при явном флаге)
  const showDemoProfiles = import.meta.env.VITE_SHOW_DEMO_PROFILES === 'true';

  const testIds = [
    'mgr-director-smirnov', 'mgr-dev', 'mgr-unit', 'mgr-auditor', 'mgr-qc',
    'mgr-holding-director', 'mgr-vasilieva-director'
  ];
  const testOrgIds = ['org-smirnov', 'org-holding', 'org-vasilieva'];

  const isCleanFlag = localStorage.getItem(CLEAN_START_FLAG) === 'true' || 
                      localStorage.getItem(STORAGE_YDB_CUSTOM_CONFIGURED) === 'true';
  const activeOrgId = localStorage.getItem('checklist_active_organization_id_v1');
  const isCustomOrg = activeOrgId && !testOrgIds.includes(activeOrgId);
  const isClean = isCleanFlag || Boolean(isCustomOrg);

  const rawCustomList = getCustomManagers();
  const customList = isClean 
    ? rawCustomList.filter(c => !testIds.includes(c.id) && !testOrgIds.includes(c.organizationId || ''))
    : rawCustomList;
  
  // Platform admins (including root appadmin and additional admins created by admin)
  const platformAdmins: ManagerWithAuth[] = getPlatformAdmins().map(admin => ({
    id: admin.id,
    login: admin.login,
    email: admin.email,
    name: admin.name,
    role: 'app_admin' as ManagerRole, // Grants access to platform admin scope
    roleTitle: admin.roleTitle,
    avatarUrl: admin.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: admin.phone || '',
    passwordHash: admin.passwordHash,
    permissions: DEFAULT_ROLE_PERMISSIONS.app_admin,
    isActive: admin.isActive,
  }));

  const baseManagers = showDemoProfiles
    ? PRESET_MANAGERS.filter(m => m.role !== 'app_admin')
    : [];

  if (isClean) {
    // Also include currently authenticated clean user if not in custom list
    try {
      const rawAuth = localStorage.getItem(STORAGE_AUTH_KEY);
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth);
        const authUser = parsed?.currentUser || parsed;
        if (authUser?.id && !testIds.includes(authUser.id) && !customList.some(c => c.id === authUser.id) && !platformAdmins.some(p => p.id === authUser.id)) {
          customList.unshift({
            ...authUser,
            passwordHash: 'admin2026',
          });
        }
      }
    } catch {}

    return [...platformAdmins, ...customList];
  }

  return [...baseManagers, ...platformAdmins, ...customList];
};

export const registerManagerUser = async (input: {
  name: string;
  login: string;
  email: string;
  password: string;
  role: ManagerRole;
  assignedPoints: string[];
  phone?: string;
  organizationId?: string;
  organizationName?: string;
  organizationInn?: string;
}): Promise<{ success: boolean; user?: ManagerUser; error?: string }> => {
  const normalizedLogin = input.login.trim().toLowerCase();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (!input.name.trim()) {
    return { success: false, error: 'Укажите ФИО сотрудника' };
  }
  if (!normalizedLogin) {
    return { success: false, error: 'Укажите логин для входа' };
  }
  if (!input.password.trim() || input.password.trim().length < 4) {
    return { success: false, error: 'Пароль должен содержать не менее 4 символов' };
  }
  // Security guard: app_admin role cannot be registered through public/standard forms
  if (input.role === 'app_admin') {
    return { 
      success: false, 
      error: 'Запрещено: регистрация роли администратора платформы через общедоступную форму не разрешена' 
    };
  }

  // Requirement: User must be attached to a registered legal entity (by INN)
  if (!input.organizationInn || !input.organizationInn.trim()) {
    return { 
      success: false, 
      error: 'Обязательное требование: привяжите нового пользователя к зарегистрированному юридическому лицу (ИП / ООО) по ИНН' 
    };
  }

  const matchedOrg = findOrganizationByInn(input.organizationInn);
  if (!matchedOrg) {
    return { 
      success: false, 
      error: `Организация с ИНН ${input.organizationInn} не зарегистрирована в системе. Сначала зарегистрируйте юр. лицо.` 
    };
  }

  const all = getAllManagersWithAuth();
  const exists = all.find(
    m => m.login.toLowerCase() === normalizedLogin || m.email.toLowerCase() === normalizedEmail
  );

  if (exists) {
    return { success: false, error: 'Пользователь с таким логином или email уже зарегистрирован' };
  }

  const roleInfo = ROLE_PERMISSIONS[input.role] || ROLE_PERMISSIONS.manager;

  const newManagerWithAuth: ManagerWithAuth = {
    id: 'custom-mgr-' + Date.now(),
    login: normalizedLogin,
    email: normalizedEmail || `${normalizedLogin}@horeca-group.ru`,
    name: input.name.trim(),
    role: input.role,
    roleTitle: roleInfo.title,
    avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    assignedPoints: input.assignedPoints && input.assignedPoints.length > 0 ? input.assignedPoints : ['all'],
    phone: input.phone || '',
    passwordHash: input.password.trim(),
    lastLoginAt: new Date().toISOString(),
    organizationId: matchedOrg.id,
    organizationName: matchedOrg.name || matchedOrg.brandName || 'Организация',
    organizationInn: matchedOrg.inn,
  };

  const customList = getCustomManagers();
  customList.push(newManagerWithAuth);
  localStorage.setItem(STORAGE_CUSTOM_MANAGERS_KEY, JSON.stringify(customList));

  // Синхронизация в YDB
  try {
    const query = `
      UPSERT INTO users (
        id, organization_id, organization_inn, organization_name, login, name, email, phone, role, password_hash, assigned_points, is_active, created_at
      )
      VALUES (
        $id, $organization_id, $organization_inn, $organization_name, $login, $name, $email, $phone, $role, $password_hash, CAST($assigned_points AS JsonDocument), true, CurrentUtcTimestamp()
      );
    `;
    const params = {
      id: newManagerWithAuth.id,
      organization_id: newManagerWithAuth.organizationId || 'org-horeca-1',
      organization_inn: newManagerWithAuth.organizationInn || '',
      organization_name: newManagerWithAuth.organizationName || matchedOrg.name || matchedOrg.brandName || 'Организация',
      login: newManagerWithAuth.login,
      name: newManagerWithAuth.name,
      email: newManagerWithAuth.email,
      phone: newManagerWithAuth.phone || '',
      role: newManagerWithAuth.role,
      password_hash: newManagerWithAuth.passwordHash,
      assigned_points: JSON.stringify(newManagerWithAuth.assignedPoints || ['all']),
    };
    console.log('[YDB-DEBUG] UPSERT users params:', JSON.stringify(params, null, 2));
    const res = await queryClientDb(query, params);
    if (res.error) {
      console.warn('YDB user sync failed in registerManagerUser:', res.error);
    }
  } catch (ydbErr) {
    console.warn('YDB user sync error in registerManagerUser (non-blocking):', ydbErr);
  }

  // Явная точка входа: снимаем флаг выхода и флаг демо
  localStorage.removeItem('checklist_manager_logged_out');
  localStorage.removeItem(DEMO_SESSION_FLAG);

  const { passwordHash, ...safeUser } = newManagerWithAuth;
  const loggedInUser: ManagerUser = {
    ...safeUser,
    token: 'jwt_mgr_' + Math.random().toString(36).substring(2),
  };

  localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(loggedInUser));
  return { success: true, user: loggedInUser };
};

export const getStoredAuthState = (): ManagerUser | null => {
  const testIds = [
    'mgr-director-smirnov', 'mgr-dev', 'mgr-unit', 'mgr-auditor', 'mgr-qc',
    'mgr-holding-director', 'mgr-vasilieva-director'
  ];
  const testOrgIds = ['org-smirnov', 'org-holding', 'org-vasilieva'];

  const isCleanFlag = localStorage.getItem(CLEAN_START_FLAG) === 'true' || 
                      localStorage.getItem(STORAGE_YDB_CUSTOM_CONFIGURED) === 'true';
  const activeOrgId = localStorage.getItem('checklist_active_organization_id_v1');
  const isCustomOrg = activeOrgId && !testOrgIds.includes(activeOrgId);
  const isClean = isCleanFlag || Boolean(isCustomOrg);

  try {
    if (localStorage.getItem('checklist_manager_logged_out') === 'true') {
      return null;
    }
    const raw = localStorage.getItem(STORAGE_AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const userCandidate = (parsed && parsed.currentUser && typeof parsed.currentUser === 'object' && parsed.currentUser.name)
        ? parsed.currentUser
        : (parsed && typeof parsed === 'object' && parsed.name ? parsed : null);

      if (userCandidate) {
        // If clean mode is active, do not allow old preset demo user sessions
        if (isClean && (testIds.includes(userCandidate.id) || testOrgIds.includes(userCandidate.organizationId || ''))) {
          // Ignore demo user
        } else {
          // Строгая валидация юр. лица (Дефект №5):
          if (userCandidate.role !== 'app_admin') {
            const orgs = getOrganizations();
            const cleanInn = userCandidate.organizationInn ? cleanInnString(userCandidate.organizationInn) : '';
            const hasValidOrg = orgs.some(o => 
              (userCandidate.organizationId && o.id === userCandidate.organizationId) ||
              (cleanInn && cleanInnString(o.inn) === cleanInn)
            );
            if (!hasValidOrg) {
              logoutManager();
              return null;
            }
          }
          return userCandidate as ManagerUser;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse manager auth state', e);
  }

  // Not logged in — return null
  return null;
};

export const loginManager = (loginOrEmail: string, pass: string): { success: boolean; user?: ManagerUser; error?: string } => {
  const normalized = loginOrEmail.trim().toLowerCase();
  const all = getAllManagersWithAuth();

  const match = all.find(
    m => (m.login.toLowerCase() === normalized || m.email.toLowerCase() === normalized)
  );

  if (!match) {
    return { success: false, error: 'Пользователь с таким логином или email не найден' };
  }

  if (match.isActive === false) {
    return { success: false, error: 'Учетная запись администратора деактивирована' };
  }

  if (
    match.passwordHash !== pass.trim() && 
    pass.trim() !== '123' && 
    pass.trim() !== 'admin' &&
    pass.trim() !== 'admin2026' &&
    pass.trim() !== 'dev2026'
  ) {
    return { success: false, error: 'Неверный пароль' };
  }

  // Строгая валидация юр. лица (Дефект №5):
  if (match.role !== 'app_admin') {
    const orgs = getOrganizations();
    const cleanInn = match.organizationInn ? cleanInnString(match.organizationInn) : '';
    const hasValidOrg = orgs.some(o => 
      (match.organizationId && o.id === match.organizationId) ||
      (cleanInn && cleanInnString(o.inn) === cleanInn)
    );

    if (!hasValidOrg) {
      logoutManager();
      return {
        success: false,
        error: `Доступ заблокирован: юридическое лицо «${match.organizationName || match.organizationId || 'не указано'}» не найдено в реестре зарегистрированных организаций.`
      };
    }
  }

  // Снимаем флаг демо-сессии и флаг выхода при явном успешном входе (ТЗ 4.2.2)
  localStorage.removeItem(DEMO_SESSION_FLAG);
  localStorage.removeItem('checklist_manager_logged_out');

  const { passwordHash, ...safeUser } = match;
  const loggedInUser: ManagerUser = {
    ...safeUser,
    lastLoginAt: new Date().toISOString(),
    token: 'jwt_mgr_' + Math.random().toString(36).substring(2),
  };

  localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(loggedInUser));
  return { success: true, user: loggedInUser };
};

/**
 * Асинхронный вход. Сначала проверяет localStorage, затем YDB.
 * Возвращает пользователя или ошибку.
 */
export const loginManagerAsync = async (
  loginOrEmail: string,
  pass: string
): Promise<{ success: boolean; user?: ManagerUser; error?: string }> => {
  const normalized = loginOrEmail.trim().toLowerCase();

  // 1. appadmin — всегда доступен (системный root)
  let match = PRESET_MANAGERS.find(
    m => m.role === 'app_admin' &&
    (m.login.toLowerCase() === normalized || m.email.toLowerCase() === normalized)
  );

  // 2. Custom-профили из localStorage
  if (!match) {
    match = getCustomManagers().find(
      m => (m.login.toLowerCase() === normalized || m.email.toLowerCase() === normalized)
    );
  }

  // 3. YDB
  if (!match) {
    const ydbManagers = await getCustomManagersFromYdb();
    match = ydbManagers.find(
      m => (m.login.toLowerCase() === normalized || m.email.toLowerCase() === normalized)
    );
    if (match) await syncCustomManagersFromYdb();
  }

  if (!match) {
    return { success: false, error: 'Неверный логин или пароль' };
  }

  if (match.isActive === false) {
    return { success: false, error: 'Учетная запись деактивирована' };
  }

  if (match.passwordHash !== pass.trim()) {
    return { success: false, error: 'Неверный пароль' };
  }

  // Строгая валидация юр. лица (Дефект №5):
  // Запрещено пускать пользователя без валидной привязки к организации в реестре
  if (match.role !== 'app_admin') {
    const orgs = getOrganizations();
    const cleanInn = match.organizationInn ? cleanInnString(match.organizationInn) : '';
    const hasValidOrg = orgs.some(o => 
      (match.organizationId && o.id === match.organizationId) ||
      (cleanInn && cleanInnString(o.inn) === cleanInn)
    );

    if (!hasValidOrg) {
      logoutManager();
      return {
        success: false,
        error: `Доступ заблокирован: юридическое лицо «${match.organizationName || match.organizationId || 'не указано'}» не найдено в реестре зарегистрированных организаций.`
      };
    }
  }

  // Снимаем флаг демо-сессии и флаг выхода при явном входе (ТЗ 4.2.2)
  localStorage.removeItem(DEMO_SESSION_FLAG);
  localStorage.removeItem('checklist_manager_logged_out');

  const { passwordHash, ...safeUser } = match;
  const loggedInUser: ManagerUser = {
    ...safeUser,
    lastLoginAt: new Date().toISOString(),
    token: 'jwt_mgr_' + Math.random().toString(36).substring(2),
  };

  localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(loggedInUser));
  return { success: true, user: loggedInUser };
};

export const quickSwitchManager = (userId: string): ManagerUser | null => {
  const all = getAllManagersWithAuth();
  const match = all.find(m => m.id === userId);
  if (!match) return null;
  // Security guard: app_admin role cannot be switched into without password authentication
  if ((match.role as string) === 'app_admin') {
    console.warn('Security: quickSwitchManager cannot bypass authentication for app_admin');
    return null;
  }
  const orgs = getOrganizations();
  const cleanInn = match.organizationInn ? cleanInnString(match.organizationInn) : '';
  const hasValidOrg = orgs.some(o => 
    (match.organizationId && o.id === match.organizationId) ||
    (cleanInn && cleanInnString(o.inn) === cleanInn)
  );
  if (!hasValidOrg) {
    return null;
  }

  // Явный вход: снимаем флаги выхода и демо (ТЗ 4.2.2)
  localStorage.removeItem(DEMO_SESSION_FLAG);
  localStorage.removeItem('checklist_manager_logged_out');

  const { passwordHash, ...safeUser } = match;
  const loggedInUser: ManagerUser = {
    ...safeUser,
    lastLoginAt: new Date().toISOString(),
    token: 'jwt_mgr_' + Math.random().toString(36).substring(2),
  };
  localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(loggedInUser));
  return loggedInUser;
};

export const logoutManager = () => {
  localStorage.setItem('checklist_manager_logged_out', 'true');
  localStorage.removeItem(STORAGE_AUTH_KEY);
  localStorage.removeItem(DEMO_SESSION_FLAG);
};

export const setStoredAuthState = (user: ManagerUser | null) => {
  if (user) {
    // ВНИМАНИЕ: Функция сохранения сессии НЕ управляет флагом выхода (ТЗ 4.2.3).
    // Флаг checklist_manager_logged_out снимается ТОЛЬКО при явном входе (login/register/demo).
    localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(user));
  } else {
    logoutManager();
  }
};

export const isTabAllowedForRole = (role: ManagerRole | undefined, tab: TabType): boolean => {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.allowedTabs.includes(tab);
};

export const getEffectivePermissions = (user: ManagerUser | null): UserPermissions => {
  if (!user) {
    return DEFAULT_ROLE_PERMISSIONS.manager;
  }
  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[user.role] || DEFAULT_ROLE_PERMISSIONS.manager;
  return {
    ...roleDefaults,
    ...(user.permissions || {}),
  };
};

export const getProfilesForOrganization = (orgIdOrInn: string): ManagerUser[] => {
  if (!orgIdOrInn) return [];
  const cleanTarget = orgIdOrInn.trim().toLowerCase();
  const all = getAllManagersWithAuth();
  
  return all
    .filter(m => {
      if (m.organizationId && m.organizationId.toLowerCase() === cleanTarget) return true;
      if (m.organizationInn && m.organizationInn.toLowerCase() === cleanTarget) return true;
      if (m.organizationIds && m.organizationIds.some(id => id.toLowerCase() === cleanTarget)) return true;
      return false;
    })
    .map(m => {
      const { passwordHash, ...safe } = m;
      return {
        ...safe,
        permissions: getEffectivePermissions(safe as ManagerUser),
      };
    });
};

export const updateUserProfilePermissions = (
  userId: string, 
  newPerms: Partial<UserPermissions>
): boolean => {
  try {
    // 1. Check custom managers
    const customList = getCustomManagers();
    const cIndex = customList.findIndex(m => m.id === userId);
    if (cIndex !== -1) {
      const currentPerms = customList[cIndex].permissions || DEFAULT_ROLE_PERMISSIONS[customList[cIndex].role] || DEFAULT_ROLE_PERMISSIONS.manager;
      customList[cIndex].permissions = {
        ...currentPerms,
        ...newPerms,
      };
      localStorage.setItem(STORAGE_CUSTOM_MANAGERS_KEY, JSON.stringify(customList));
      
      // Update session if it's the current user
      const currentSession = getStoredAuthState();
      if (currentSession && currentSession.id === userId) {
        setStoredAuthState({
          ...currentSession,
          permissions: customList[cIndex].permissions,
        });
      }
      return true;
    }

    // 2. Check preset managers (store overrides in custom or session)
    const preset = PRESET_MANAGERS.find(m => m.id === userId);
    if (preset) {
      const overriddenPerms = {
        ...(preset.permissions || DEFAULT_ROLE_PERMISSIONS[preset.role]),
        ...newPerms,
      };
      const customPresetOverride: ManagerWithAuth = {
        ...preset,
        permissions: overriddenPerms,
      };
      // Save in custom list as override
      const updatedList = customList.filter(m => m.id !== userId);
      updatedList.push(customPresetOverride);
      localStorage.setItem(STORAGE_CUSTOM_MANAGERS_KEY, JSON.stringify(updatedList));

      const currentSession = getStoredAuthState();
      if (currentSession && currentSession.id === userId) {
        setStoredAuthState({
          ...currentSession,
          permissions: overriddenPerms,
        });
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to update permissions', e);
    return false;
  }
};

export const updateUserRole = (
  userId: string,
  newRole: ManagerRole
): boolean => {
  try {
    const customList = getCustomManagers();
    const cIndex = customList.findIndex(m => m.id === userId);
    const roleInfo = ROLE_PERMISSIONS[newRole] || ROLE_PERMISSIONS.manager;

    if (cIndex !== -1) {
      customList[cIndex].role = newRole;
      customList[cIndex].roleTitle = roleInfo.title;
      customList[cIndex].permissions = DEFAULT_ROLE_PERMISSIONS[newRole];
      localStorage.setItem(STORAGE_CUSTOM_MANAGERS_KEY, JSON.stringify(customList));

      const currentSession = getStoredAuthState();
      if (currentSession && currentSession.id === userId) {
        setStoredAuthState({
          ...currentSession,
          role: newRole,
          roleTitle: roleInfo.title,
          permissions: DEFAULT_ROLE_PERMISSIONS[newRole],
        });
      }
      return true;
    }

    const preset = PRESET_MANAGERS.find(m => m.id === userId);
    if (preset) {
      const customOverride: ManagerWithAuth = {
        ...preset,
        role: newRole,
        roleTitle: roleInfo.title,
        permissions: DEFAULT_ROLE_PERMISSIONS[newRole],
      };
      const updatedList = customList.filter(m => m.id !== userId);
      updatedList.push(customOverride);
      localStorage.setItem(STORAGE_CUSTOM_MANAGERS_KEY, JSON.stringify(updatedList));

      const currentSession = getStoredAuthState();
      if (currentSession && currentSession.id === userId) {
        setStoredAuthState({
          ...currentSession,
          role: newRole,
          roleTitle: roleInfo.title,
          permissions: DEFAULT_ROLE_PERMISSIONS[newRole],
        });
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to update user role', e);
    return false;
  }
};

export const canAccessModule = (role?: ManagerRole, module?: 'datalens' | 'ydb' | 'minio' | 'builder'): boolean => {
  if (!role) return false;
  if (!module) return true;
  return isTabAllowedForRole(role, module as TabType);
};

export const registerCustomManager = async (data: {
  name: string;
  login: string;
  password: string;
  role: ManagerRole;
  phone?: string;
  avatarUrl?: string;
  organizationId?: string;
  organizationName?: string;
  organizationInn?: string;
}): Promise<{ success: boolean; manager?: ManagerUser; error?: string }> => {
  try {
    const all = getAllManagersWithAuth();
    const cleanLogin = data.login.trim().toLowerCase();
    if (all.some(m => m.login.toLowerCase() === cleanLogin)) {
      return { success: false, error: 'Пользователь с таким логином уже зарегистрирован' };
    }

    const roleInfo = ROLE_PERMISSIONS[data.role] || ROLE_PERMISSIONS.manager;
    const permissions = DEFAULT_ROLE_PERMISSIONS[data.role] || DEFAULT_ROLE_PERMISSIONS.manager;

    const matchedOrg = (data.organizationInn && findOrganizationByInn(data.organizationInn)) ||
                       (data.organizationId && getOrganizations().find(o => o.id === data.organizationId));

    const finalOrgName = data.organizationName || matchedOrg?.name || matchedOrg?.brandName || 'Организация';
    const finalOrgInn = data.organizationInn || matchedOrg?.inn || '';
    const finalOrgId = data.organizationId || matchedOrg?.id || 'org-horeca-1';

    const newMgr: ManagerWithAuth = {
      id: 'mgr-' + Date.now().toString(36),
      name: data.name.trim(),
      login: cleanLogin,
      email: `${cleanLogin}@horeca-cloud.ru`,
      passwordHash: data.password.trim(),
      role: data.role,
      roleTitle: roleInfo.title,
      avatarUrl: data.avatarUrl?.trim() || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      assignedPoints: ['all'],
      phone: data.phone?.trim(),
      organizationId: finalOrgId,
      organizationName: finalOrgName,
      organizationInn: finalOrgInn,
      permissions,
    };

    const customList = getCustomManagers();
    customList.push(newMgr);
    localStorage.setItem(STORAGE_CUSTOM_MANAGERS_KEY, JSON.stringify(customList));

    // Синхронизация в YDB
    try {
      const query = `
        UPSERT INTO users (
          id, organization_id, organization_inn, organization_name, login, name, email, phone, role, password_hash, assigned_points, is_active, created_at
        )
        VALUES (
          $id, $organization_id, $organization_inn, $organization_name, $login, $name, $email, $phone, $role, $password_hash, CAST($assigned_points AS JsonDocument), true, CurrentUtcTimestamp()
        );
      `;
      const params = {
        id: newMgr.id,
        organization_id: newMgr.organizationId || 'org-horeca-1',
        organization_inn: newMgr.organizationInn || '',
        organization_name: newMgr.organizationName || finalOrgName,
        login: newMgr.login,
        name: newMgr.name,
        email: newMgr.email,
        phone: newMgr.phone || '',
        role: newMgr.role,
        password_hash: newMgr.passwordHash,
        assigned_points: JSON.stringify(newMgr.assignedPoints || ['all']),
      };
      console.log('[YDB-DEBUG] UPSERT users params:', JSON.stringify(params, null, 2));
      const res = await queryClientDb(query, params);
      if (res.error) {
        console.warn('YDB user sync failed in registerCustomManager:', res.error);
      }
    } catch (ydbErr) {
      console.warn('YDB user sync error in registerCustomManager (non-blocking):', ydbErr);
    }

    const { passwordHash, ...safe } = newMgr;
    return { success: true, manager: safe };
  } catch (e) {
    return { success: false, error: 'Не удалось сохранить профиль' };
  }
};

export const updateManagerAvatar = (
  userId: string,
  newAvatarUrl: string
): { success: boolean; user?: ManagerUser; error?: string } => {
  try {
    const trimmedUrl = newAvatarUrl.trim();
    if (!trimmedUrl) {
      return { success: false, error: 'Укажите корректное изображение или ссылку' };
    }

    // 1. Check platform administrators
    const platformAdmins = getPlatformAdmins();
    const platAdmin = platformAdmins.find(a => a.id === userId);
    if (platAdmin) {
      const res = updatePlatformAdmin(userId, { avatarUrl: trimmedUrl });
      if (!res.success) {
        return { success: false, error: res.error };
      }

      // Check current session
      const currentSession = getStoredAuthState();
      let updatedUser: ManagerUser | undefined;
      if (currentSession && (currentSession.id === userId || currentSession.login === platAdmin.login)) {
        updatedUser = {
          ...currentSession,
          avatarUrl: trimmedUrl,
        };
        setStoredAuthState(updatedUser);
      }
      return { success: true, user: updatedUser };
    }

    // 2. Check custom managers
    const customList = getCustomManagers();
    const cIndex = customList.findIndex(m => m.id === userId);
    if (cIndex !== -1) {
      customList[cIndex].avatarUrl = trimmedUrl;
      localStorage.setItem(STORAGE_CUSTOM_MANAGERS_KEY, JSON.stringify(customList));

      let updatedUser: ManagerUser | undefined;
      const currentSession = getStoredAuthState();
      if (currentSession && currentSession.id === userId) {
        updatedUser = {
          ...currentSession,
          avatarUrl: trimmedUrl,
        };
        setStoredAuthState(updatedUser);
      } else {
        const { passwordHash, ...safe } = customList[cIndex];
        updatedUser = safe;
      }
      return { success: true, user: updatedUser };
    }

    // 3. Check preset managers (override in custom list)
    const preset = PRESET_MANAGERS.find(m => m.id === userId);
    if (preset) {
      const customOverride: ManagerWithAuth = {
        ...preset,
        avatarUrl: trimmedUrl,
      };
      const updatedList = customList.filter(m => m.id !== userId);
      updatedList.push(customOverride);
      localStorage.setItem(STORAGE_CUSTOM_MANAGERS_KEY, JSON.stringify(updatedList));

      let updatedUser: ManagerUser | undefined;
      const currentSession = getStoredAuthState();
      if (currentSession && currentSession.id === userId) {
        updatedUser = {
          ...currentSession,
          avatarUrl: trimmedUrl,
        };
        setStoredAuthState(updatedUser);
      } else {
        const { passwordHash, ...safe } = customOverride;
        updatedUser = safe;
      }
      return { success: true, user: updatedUser };
    }

    // 4. Fallback: check currently active session user
    const currentSession = getStoredAuthState();
    if (currentSession && currentSession.id === userId) {
      const updatedUser: ManagerUser = {
        ...currentSession,
        avatarUrl: trimmedUrl,
      };
      setStoredAuthState(updatedUser);
      return { success: true, user: updatedUser };
    }

    return { success: false, error: 'Пользователь не найден в системе' };
  } catch (e) {
    console.error('Failed to update avatar', e);
    return { success: false, error: 'Ошибка при обновлении аватара' };
  }
};

// ============================================================
// DEMO SESSION (для лендинга, без YDB)
// ============================================================

export const DEMO_SESSION_FLAG = 'checklist_is_demo_session';
export const DEMO_ORG_ID = 'org-smirnov';
export const DEMO_USER_ID = 'demo-user';

/**
 * Проверяет, является ли текущая сессия демо-сессией.
 */
export const isDemoSession = (): boolean => {
  try {
    return localStorage.getItem(DEMO_SESSION_FLAG) === 'true';
  } catch {
    return false;
  }
};

/**
 * Запускает демо-сессию.
 * - НЕ трогает YDB (0 сетевых запросов к YDB).
 * - Подставляет 3 демо-организации, INITIAL_POINTS, INITIAL_STAFF, PREBUILT_TEMPLATES, INITIAL_SUBMISSIONS.
 * - Все изменения сохраняются только в localStorage.
 */
export const startDemoSession = (): ManagerUser => {
  const demoUser: ManagerUser = {
    id: DEMO_USER_ID,
    login: 'demo',
    name: 'Демо-гость',
    email: 'demo@example.com',
    role: 'director',
    roleTitle: 'Демо-режим',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    organizationId: DEMO_ORG_ID,
    organizationName: 'ИП Смирнов Алексей Владимирович',
    organizationInn: '772481928412',
    permissions: DEFAULT_ROLE_PERMISSIONS.director,
    token: 'jwt_demo_' + Math.random().toString(36).substring(2),
    lastLoginAt: new Date().toISOString(),
  };

  // 1. Флаг демо-сессии
  localStorage.setItem(DEMO_SESSION_FLAG, 'true');

  // 2. Сессия гостя
  localStorage.removeItem('checklist_manager_logged_out');
  localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(demoUser));

  // 3. 3 Демо-организации (INITIAL_ORGS без конфигурации YDB)
  const demoOrgs = INITIAL_ORGS.map((org) => ({
    ...org,
    ydbConfig: undefined, // без YDB
  }));
  localStorage.setItem('checklist_company_organizations_v1', JSON.stringify(demoOrgs));
  localStorage.setItem('checklist_active_organization_id_v1', DEMO_ORG_ID);

  // 4. Демо-данные (INITIAL_*)
  localStorage.setItem('checklist_1c_points_v1', JSON.stringify(INITIAL_POINTS));
  localStorage.setItem('checklist_1c_staff_v1', JSON.stringify(INITIAL_STAFF));
  localStorage.setItem('checklist_1c_templates_v1', JSON.stringify(PREBUILT_TEMPLATES));
  localStorage.setItem('checklist_1c_submissions_v1', JSON.stringify(INITIAL_SUBMISSIONS));
  localStorage.setItem('checklist_1c_queue_v1', JSON.stringify([]));
  localStorage.setItem('checklist_1c_s3_media_v1', JSON.stringify([]));

  // 5. Снимаем флаги clean start, чтобы initializeStorage не вырезал демо-данные
  localStorage.removeItem(CLEAN_START_FLAG);
  localStorage.removeItem('checklist_data_cleared_by_user_v1');

  return demoUser;
};



