import { ChecklistTemplate, CleanStartOptions, CompanyOrganization, ManagerUser, PointLocation } from '../types';
import { generateIsolatedYdbConfig, markYdbCustomConfigured } from './ydbService';
import { INITIAL_ORGS } from './companyService';

export const CLEAN_START_FLAG = 'checklist_clean_start_mode_v1';
export const DATA_CLEARED_BY_USER_FLAG = 'checklist_data_cleared_by_user_v1';

export const STORAGE_ALL_KEYS = {
  TEMPLATES: 'checklist_1c_templates_v1',
  POINTS: 'checklist_1c_points_v1',
  STAFF: 'checklist_1c_staff_v1',
  SUBMISSIONS: 'checklist_1c_submissions_v1',
  QUEUE: 'checklist_1c_queue_v1',
  S3_MEDIA: 'checklist_1c_s3_media_v1',
  TELEGRAM_ALERTS: 'checklist_1c_telegram_alerts_v1',
  ORGANIZATIONS: 'checklist_company_organizations_v1',
  ACTIVE_ORG: 'checklist_active_organization_id_v1',
  INVOICES: 'checklist_company_invoices_v1',
  AUTH_SESSION: 'checklist_manager_auth_session',
  CUSTOM_MANAGERS: 'checklist_custom_registered_managers',
  YDB_CONFIG: 'checklist_ydb_config_v1',
  PLATFORM_ADMIN_YDB: 'checklist_platform_admin_ydb_config_v1',
  YDB_EMULATOR: 'checklist_ydb_emulator_enabled_v1',
  YDB_CUSTOM_CONFIGURED: 'checklist_ydb_custom_configured_v1',
  CLEAN_START_MODE: 'checklist_clean_start_mode_v1',
};

export const isCleanStartMode = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem(CLEAN_START_FLAG) === 'true') return true;
    if (localStorage.getItem(STORAGE_ALL_KEYS.YDB_CUSTOM_CONFIGURED) === 'true') return true;
    const activeOrgId = localStorage.getItem(STORAGE_ALL_KEYS.ACTIVE_ORG);
    if (activeOrgId && !['org-smirnov', 'org-holding', 'org-vasilieva'].includes(activeOrgId)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export interface SystemDataSummary {
  organizationsCount: number;
  pointsCount: number;
  staffCount: number;
  submissionsCount: number;
  s3MediaCount: number;
  queueCount: number;
  customManagersCount: number;
  isCleanStartMode: boolean;
}

export const getSystemDataSummary = (): SystemDataSummary => {
  const getCount = (key: string): number => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : (parsed ? 1 : 0);
    } catch {
      return 0;
    }
  };

  return {
    organizationsCount: getCount(STORAGE_ALL_KEYS.ORGANIZATIONS),
    pointsCount: getCount(STORAGE_ALL_KEYS.POINTS),
    staffCount: getCount(STORAGE_ALL_KEYS.STAFF),
    submissionsCount: getCount(STORAGE_ALL_KEYS.SUBMISSIONS),
    s3MediaCount: getCount(STORAGE_ALL_KEYS.S3_MEDIA),
    queueCount: getCount(STORAGE_ALL_KEYS.QUEUE),
    customManagersCount: getCount(STORAGE_ALL_KEYS.CUSTOM_MANAGERS),
    isCleanStartMode: localStorage.getItem(CLEAN_START_FLAG) === 'true',
  };
};

/**
 * Performs a complete clean start of the application.
 * Wipes out demo profiles, organizations, submissions, points, staff, and settings.
 */
export const performCleanStart = (
  options: Partial<CleanStartOptions> = {}
): { success: boolean; organization: CompanyOrganization; adminUser: ManagerUser } => {
  // 1. Mark clean start mode active
  localStorage.setItem(CLEAN_START_FLAG, 'true');
  localStorage.removeItem(DATA_CLEARED_BY_USER_FLAG);

  // 2. Clear transactional, templates, staff and history data
  localStorage.setItem(STORAGE_ALL_KEYS.SUBMISSIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_ALL_KEYS.QUEUE, JSON.stringify([]));
  localStorage.setItem(STORAGE_ALL_KEYS.S3_MEDIA, JSON.stringify([]));
  localStorage.setItem(STORAGE_ALL_KEYS.INVOICES, JSON.stringify([]));

  // 3. Clear custom managers
  localStorage.setItem(STORAGE_ALL_KEYS.CUSTOM_MANAGERS, JSON.stringify([]));

  // 4. Handle YDB Configs
  // Clear any existing custom/cached YDB configs for fresh start
  localStorage.removeItem(STORAGE_ALL_KEYS.YDB_CONFIG);
  localStorage.removeItem(STORAGE_ALL_KEYS.YDB_CUSTOM_CONFIGURED);

  // Remove any per-org YDB configs from localStorage
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('checklist_ydb_org_config_') || k.startsWith('checklist_ydb_custom_configured_v1_') || k.startsWith('checklist_ydb_emulator_enabled_v1_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Error clearing org YDB configs', e);
  }

  // 5. Create the primary fresh organization
  const orgName = options.organizationName?.trim() || 'Основная организация';
  const brandName = options.brandName?.trim() || 'Моя сеть кофеен';
  const rawInn = (options.inn || '').replace(/\D/g, '');
  const inn = rawInn.length >= 10 ? rawInn : '7701000001';
  const directorName = options.directorName?.trim() || 'Руководитель';
  const legalType = options.legalType || (inn.length === 12 ? 'IP' : 'OOO');
  const orgId = `org-${inn.slice(0, 8) || 'primary'}`;

  // Generate isolated YDB serverless configuration tied to this organization's INN
  const isolatedYdb = generateIsolatedYdbConfig(orgName, inn, orgId);
  isolatedYdb.isConnected = true;

  const cleanOrg: CompanyOrganization = {
    id: orgId,
    legalType,
    name: orgName,
    brandName,
    inn,
    ogrn: legalType === 'IP' ? '326774600000001' : '1267700000001',
    directorName,
    generalDirector: directorName,
    email: options.email?.trim() || 'director@horeca-start.ru',
    phone: options.phone?.trim() || '+7 (999) 000-00-00',
    address: 'г. Москва, ул. Центральная, д. 1',
    bankName: 'ПАО Сбербанк',
    bankBik: '044525225',
    bankAccount: '40702810900000000001',
    corrAccount: '30101810400000000225',
    currentTariffId: 'business',
    tariffStatus: 'active',
    tariffRenewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString().split('T')[0],
    balanceRub: 0,
    pointsCount: 1,
    staffCount: 0,
    ydbConfig: isolatedYdb,
  };

  localStorage.setItem(STORAGE_ALL_KEYS.ORGANIZATIONS, JSON.stringify([cleanOrg]));
  localStorage.setItem(STORAGE_ALL_KEYS.ACTIVE_ORG, cleanOrg.id);
  localStorage.setItem(`checklist_ydb_org_config_${cleanOrg.id}`, JSON.stringify(isolatedYdb));
  localStorage.setItem(`${STORAGE_ALL_KEYS.YDB_CUSTOM_CONFIGURED}_${cleanOrg.id}`, 'true');
  markYdbCustomConfigured(true, cleanOrg.id);

  // 6. Create initial primary point for this organization
  const initialPoint: PointLocation = {
    id: `pt-${cleanOrg.id}-1`,
    name: brandName ? `${brandName} — Точка №1` : 'Кофейня №1',
    code: 'TT-001',
    city: 'Москва',
    address: 'ул. Центральная, д. 1',
    openingTime: '08:00',
    closingTime: '22:00',
    managerName: directorName,
    pinCode: '1111',
    organizationId: cleanOrg.id,
    organizationName: cleanOrg.name,
    organizationInn: cleanOrg.inn,
  };

  localStorage.setItem(STORAGE_ALL_KEYS.POINTS, JSON.stringify([initialPoint]));
  localStorage.setItem(STORAGE_ALL_KEYS.STAFF, JSON.stringify([]));

  // 7. Create starter checklist template tailored to this clean organization
  const cleanStarterTemplate: ChecklistTemplate = {
    id: `tpl-${cleanOrg.id}-opening`,
    code: 'ЧК-00001',
    title: 'Открытие смены кофейни (Стандарт)',
    category: 'opening',
    description: 'Базовый контрольный регламент проверки бара перед началом обслуживания гостей',
    version: '1.0',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    targetTime: '08:00',
    allowedVarianceMinutes: 15,
    active: true,
    assignedPoints: ['all'],
    organizationId: cleanOrg.id,
    organizationInn: cleanOrg.inn,
    blocks: [
      {
        id: 'blk-1',
        type: 'check',
        title: 'Санитарное состояние рабочей зоны бариста',
        description: 'Поверхности чистые, продезинфицированы, мусорные баки пустые (СанПиН 2.3/2.4.3590-20)',
        required: true,
      },
      {
        id: 'blk-2',
        type: 'number',
        title: 'Температура бойлера эспрессо-машины',
        description: 'Проверить давление помпы (9 бар) и температуру бойлера (норма 91-94°C)',
        required: true,
        minNumber: 88,
        maxNumber: 96,
        unit: '°C'
      },
      {
        id: 'blk-3',
        type: 'number',
        title: 'Температура в холодильнике для молока',
        description: 'Замер термометром: норма от +2.0°C до +4.5°C (ХАССП ККТ-1)',
        required: true,
        minNumber: 0,
        maxNumber: 10,
        unit: '°C'
      },
      {
        id: 'blk-4',
        type: 'photo',
        title: 'Фотография готовой выкладки десертов и ценников',
        description: 'Сделать снимок всей фронтальной зоны для контроля планограммы',
        required: true,
        photoRequired: true,
        allowMultiplePhotos: true,
      }
    ]
  };

  localStorage.setItem(STORAGE_ALL_KEYS.TEMPLATES, JSON.stringify([cleanStarterTemplate]));

  // 8. Create director profile and register in custom managers + active auth session
  const cleanAdminUser: ManagerUser = {
    id: `mgr-${cleanOrg.id}-director`,
    login: 'director',
    name: directorName,
    email: cleanOrg.email,
    role: 'director',
    roleTitle: legalType === 'IP' ? 'Индивидуальный предприниматель' : 'Генеральный директор',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    assignedPoints: ['all'],
    phone: cleanOrg.phone,
    organizationId: cleanOrg.id,
    organizationName: cleanOrg.name,
    organizationInn: cleanOrg.inn,
    permissions: {
      canEditTemplates: true,
      canManagePoints: true,
      canManageStaff: true,
      canViewFinances: true,
      canViewBiDataLens: true,
      canAccessCloudInfrastructure: true,
      canAuditSubmissions: true,
      canManagePermissions: true,
    },
  };

  localStorage.setItem(STORAGE_ALL_KEYS.AUTH_SESSION, JSON.stringify(cleanAdminUser));
  localStorage.setItem(STORAGE_ALL_KEYS.CUSTOM_MANAGERS, JSON.stringify([
    {
      ...cleanAdminUser,
      passwordHash: 'admin2026',
    }
  ]));

  // 8. Clean Welcome Telegram Alert
  const startAlert = {
    id: 'clean-start-' + Date.now(),
    timestamp: new Date().toISOString(),
    type: 'success',
    pointName: initialPoint.name,
    staffName: cleanAdminUser.name,
    title: '🟢 Система инициализирована с чистого листа',
    message: `Организация ${cleanOrg.name} зарегистрирована. Настроено подключение к Serverless YDB в Yandex Cloud.`,
    checklistNumber: 'СТАРТ-00001',
    read: false,
  };
  localStorage.setItem(STORAGE_ALL_KEYS.TELEGRAM_ALERTS, JSON.stringify([startAlert]));

  // 9. Dispatch events to notify UI
  window.dispatchEvent(new CustomEvent('checklist-data-cleared', { detail: { cleanOrg, cleanAdminUser } }));
  window.dispatchEvent(new CustomEvent('storage-updated'));

  return {
    success: true,
    organization: cleanOrg,
    adminUser: cleanAdminUser,
  };
};

/**
 * Restores the complete factory demo database with 3 organizations, coffee shops, staff, and submissions.
 * Re-enables the built-in YDB emulator.
 */
export const performFactoryDemoReset = (): void => {
  // Clear clean start flag and user cleared data flag
  localStorage.removeItem(CLEAN_START_FLAG);
  localStorage.removeItem(DATA_CLEARED_BY_USER_FLAG);

  // Restore factory demo organizations explicitly
  localStorage.setItem(STORAGE_ALL_KEYS.ORGANIZATIONS, JSON.stringify(INITIAL_ORGS));
  localStorage.setItem(STORAGE_ALL_KEYS.ACTIVE_ORG, INITIAL_ORGS[0].id);

  // Clear specific keys so initializers restore factory defaults
  localStorage.removeItem(STORAGE_ALL_KEYS.TEMPLATES);
  localStorage.removeItem(STORAGE_ALL_KEYS.POINTS);
  localStorage.removeItem(STORAGE_ALL_KEYS.STAFF);
  localStorage.removeItem(STORAGE_ALL_KEYS.SUBMISSIONS);
  localStorage.removeItem(STORAGE_ALL_KEYS.QUEUE);
  localStorage.removeItem(STORAGE_ALL_KEYS.S3_MEDIA);
  localStorage.removeItem(STORAGE_ALL_KEYS.INVOICES);
  localStorage.removeItem(STORAGE_ALL_KEYS.CUSTOM_MANAGERS);
  localStorage.removeItem(STORAGE_ALL_KEYS.AUTH_SESSION);
  localStorage.removeItem(STORAGE_ALL_KEYS.YDB_CONFIG);
  localStorage.removeItem(STORAGE_ALL_KEYS.PLATFORM_ADMIN_YDB);
  localStorage.removeItem(STORAGE_ALL_KEYS.YDB_CUSTOM_CONFIGURED);

  // Clean org-specific configs
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('checklist_ydb_org_config_') || k.startsWith('checklist_ydb_custom_configured_v1_') || k.startsWith('checklist_ydb_emulator_enabled_v1_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Error clearing org YDB configs', e);
  }

  // Dispatch event
  window.dispatchEvent(new CustomEvent('checklist-demo-restored'));
  window.dispatchEvent(new CustomEvent('storage-updated'));
};
