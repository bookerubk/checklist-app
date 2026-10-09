import { CompanyOrganization, TariffPlan, TariffPlanId, BillingInvoice, LegalEntityType, ManagerUser, YdbConfig } from '../types';
import { generateIsolatedYdbConfig, saveYdbConfig, markYdbCustomConfigured } from './ydbService';

const STORAGE_ORGS_KEY = 'checklist_company_organizations_v1';
const STORAGE_ACTIVE_ORG_KEY = 'checklist_active_organization_id_v1';
const STORAGE_INVOICES_KEY = 'checklist_company_invoices_v1';
const STORAGE_TARIFFS_KEY = 'checklist_tariff_plans_v2';
const STORAGE_APP_ADMIN_SLUG_KEY = 'checklist_app_admin_slug_v1';
export const DEFAULT_APP_ADMIN_SLUG = 'админ';

export const INITIAL_TARIFF_PLANS: TariffPlan[] = [
  {
    id: 'start',
    name: 'Старт (ИП)',
    badge: '1 кофейня',
    description: 'Для индивидуальных предпринимателей с одной локацией или кофейным островком.',
    priceMonthly: 1990,
    priceMonthlyRub: 1990,
    pointsLimit: 1,
    staffLimit: 5,
    storageMbLimit: 5000,
    submissionsMonthlyLimit: 500,
    features: [
      '1 торговая точка / кофейня',
      'До 5 сотрудников в штате',
      'PWA терминал бариста по QR-коду',
      '5 ГБ в MinIO S3 хранилище',
      'Базовые чек-листы смен и ХАССП',
      'Поддержка по email'
    ]
  },
  {
    id: 'business',
    name: 'Бизнес-Сеть',
    badge: 'Хит для сетей',
    isPopular: true,
    description: 'Для растущих сетей кофеен от 2 до 5 заведений с контролем стандартов.',
    priceMonthly: 4990,
    priceMonthlyRub: 4990,
    pointsLimit: 5,
    staffLimit: 20,
    storageMbLimit: 25000,
    submissionsMonthlyLimit: 5000,
    features: [
      'До 5 торговых точек',
      'До 20 сотрудников в штате',
      'Конструктор кастомных чек-листов',
      '25 ГБ в MinIO S3 хранилище',
      'Telegram-бот с алертами о нарушениях',
      'Дашборды качества Yandex DataLens',
      'Экспорт отчетов в Excel и 1С'
    ]
  },
  {
    id: 'enterprise',
    name: 'Корпоративный Холдинг',
    badge: 'Масштаб без лимитов',
    description: 'Для крупных франшизных сетей и холдингов HoReCa с максимальными требованиями.',
    priceMonthly: 9990,
    priceMonthlyRub: 9990,
    pointsLimit: 9999,
    staffLimit: 9999,
    storageMbLimit: 100000,
    submissionsMonthlyLimit: 99999,
    features: [
      'Неограниченное число точек и персонала',
      'Выделенная база YDB Serverless',
      '100 ГБ в S3 + автосжатие WebP',
      'Прямая бесшовная интеграция с 1С',
      'Кастомные BI-отчеты в DataLens',
      'Персональный менеджер и SLA 99.95%',
      'Приоритетная техподдержка 24/7'
    ]
  }
];

export const TARIFF_PLANS = INITIAL_TARIFF_PLANS;

// ==========================================
// DYNAMIC TARIFF PLANS (MANAGED BY APP ADMIN)
// ==========================================
export const getTariffPlans = (): TariffPlan[] => {
  const sanitizePlan = (p: Partial<TariffPlan>): TariffPlan => {
    const price = Number(p.priceMonthlyRub ?? p.priceMonthly ?? 0) || 0;
    return {
      id: p.id || 'custom',
      name: p.name || 'Тарифный план',
      badge: p.badge,
      description: p.description || '',
      priceMonthly: price,
      priceMonthlyRub: price,
      pointsLimit: Number(p.pointsLimit) || 1,
      staffLimit: Number(p.staffLimit) || 1,
      storageMbLimit: Number(p.storageMbLimit) || 5000,
      submissionsMonthlyLimit: Number(p.submissionsMonthlyLimit) || 1000,
      features: Array.isArray(p.features) ? p.features : [],
      isPopular: !!p.isPopular
    };
  };

  try {
    const raw = localStorage.getItem(STORAGE_TARIFFS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_TARIFFS_KEY, JSON.stringify(INITIAL_TARIFF_PLANS));
      return INITIAL_TARIFF_PLANS.map(sanitizePlan);
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_TARIFF_PLANS;
    return list.map(sanitizePlan);
  } catch (e) {
    return INITIAL_TARIFF_PLANS.map(sanitizePlan);
  }
};

export const saveTariffPlan = (plan: TariffPlan): boolean => {
  try {
    const current = getTariffPlans();
    const index = current.findIndex(p => p.id === plan.id);
    let updated: TariffPlan[];
    if (index !== -1) {
      updated = [...current];
      updated[index] = { ...plan };
    } else {
      updated = [...current, { ...plan }];
    }
    localStorage.setItem(STORAGE_TARIFFS_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error('Failed to save tariff plan', e);
    return false;
  }
};

export const deleteTariffPlan = (planId: string): boolean => {
  try {
    const current = getTariffPlans();
    if (current.length <= 1) {
      return false; // Prevent deleting the last tariff
    }
    const updated = current.filter(p => p.id !== planId);
    localStorage.setItem(STORAGE_TARIFFS_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    return false;
  }
};

export const resetTariffPlans = (): TariffPlan[] => {
  localStorage.setItem(STORAGE_TARIFFS_KEY, JSON.stringify(INITIAL_TARIFF_PLANS));
  return INITIAL_TARIFF_PLANS;
};

// ==========================================
// APP ADMINISTRATOR ACCESS SLUG CONFIGURATION
// ==========================================
export const getAppAdminSlug = (): string => {
  try {
    const raw = localStorage.getItem(STORAGE_APP_ADMIN_SLUG_KEY);
    if (raw && raw.trim()) {
      return raw.trim().replace(/^\/+/, '');
    }
  } catch (e) {
    // fallback
  }
  return DEFAULT_APP_ADMIN_SLUG;
};

export const setAppAdminSlug = (slug: string): string => {
  const clean = (slug || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const finalSlug = clean || DEFAULT_APP_ADMIN_SLUG;
  localStorage.setItem(STORAGE_APP_ADMIN_SLUG_KEY, finalSlug);
  return finalSlug;
};

export const isAppAdminUrl = (customSlug?: string): boolean => {
  if (typeof window === 'undefined') return false;
  const slug = (customSlug || getAppAdminSlug()).toLowerCase();

  try {
    // 1. Pathname check: /админ or /%D0%B0%D0%B4%D0%BC%D0%B8%D0%BD
    const decodedPath = decodeURIComponent(window.location.pathname || '').toLowerCase();
    const cleanPath = decodedPath.replace(/^\/+/, '').replace(/\/+$/, '');
    if (cleanPath === slug || cleanPath.endsWith(`/${slug}`)) {
      return true;
    }
    // Also fallback check for /admin or /админ
    if (cleanPath === 'админ' || cleanPath === 'admin') {
      return true;
    }

    // 2. Hash check: #/админ or #админ
    if (window.location.hash) {
      const decodedHash = decodeURIComponent(window.location.hash).toLowerCase();
      const cleanHash = decodedHash.replace(/^#\/?/, '').replace(/\/+$/, '');
      if (cleanHash === slug || cleanHash.startsWith(`${slug}?`) || cleanHash.startsWith(`${slug}/`)) {
        return true;
      }
      if (cleanHash === 'админ' || cleanHash === 'admin') {
        return true;
      }
    }

    // 3. Search param check: ?admin=1 or ?mode=admin
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('admin') !== null || searchParams.get('mode') === 'admin' || searchParams.get('mode') === 'app_admin') {
      return true;
    }
  } catch (e) {
    console.warn('Error checking app admin url', e);
  }

  return false;
};

export const INITIAL_ORGS: CompanyOrganization[] = [
  {
    id: 'org-smirnov',
    legalType: 'IP',
    name: 'ИП Смирнов Алексей Владимирович',
    brandName: 'Coffee Point',
    inn: '772481928412',
    ogrn: '321774600123456',
    directorName: 'Смирнов Алексей Владимирович',
    email: 'smirnov.coffee@mail.ru',
    phone: '+7 (916) 450-22-11',
    address: 'г. Москва, ул. Арбат, д. 24, стр. 1',
    bankName: 'ПАО Сбербанк',
    bankBik: '044525225',
    bankAccount: '40802810938000012345',
    corrAccount: '30101810400000000225',
    currentTariffId: 'business',
    tariffStatus: 'active',
    tariffRenewalDate: '2026-10-15',
    createdAt: '2026-01-15',
    balanceRub: 14970,
    ydbConfig: generateIsolatedYdbConfig('ИП Смирнов Алексей Владимирович', '772481928412', 'org-smirnov')
  },
  {
    id: 'org-holding',
    legalType: 'OOO',
    name: 'ООО "Кофе Холдинг Северо-Запад"',
    brandName: 'Nordic Roast & Bakery',
    inn: '7810984521',
    ogrn: '1207800045612',
    directorName: 'Морозов Алексей Николаевич',
    email: 'info@nordicroast.spb.ru',
    phone: '+7 (812) 380-99-00',
    address: 'г. Санкт-Петербург, Невский пр-кт, д. 68',
    bankName: 'Банк ВТБ (ПАО)',
    bankBik: '044030704',
    bankAccount: '40702810500000098765',
    corrAccount: '30101810700000000704',
    currentTariffId: 'enterprise',
    tariffStatus: 'active',
    tariffRenewalDate: '2026-11-01',
    createdAt: '2025-11-10',
    balanceRub: 39960,
    ydbConfig: generateIsolatedYdbConfig('ООО "Кофе Холдинг Северо-Запад"', '7810984521', 'org-holding')
  },
  {
    id: 'org-vasilieva',
    legalType: 'IP',
    name: 'ИП Васильева Мария Константиновна',
    brandName: 'Specialty Corner',
    inn: '500192847291',
    ogrn: '322508100987654',
    directorName: 'Васильева Мария Константиновна',
    email: 'm.vasilieva@specialty-corner.ru',
    phone: '+7 (925) 777-14-30',
    address: 'г. Химки, ул. Ленинградская, д. 12',
    bankName: 'АО "ТБанк"',
    bankBik: '044525974',
    bankAccount: '40802810100000054321',
    corrAccount: '30101810145250000974',
    currentTariffId: 'start',
    tariffStatus: 'active',
    tariffRenewalDate: '2026-09-28',
    createdAt: '2026-05-20',
    balanceRub: 3980,
    ydbConfig: generateIsolatedYdbConfig('ИП Васильева Мария Константиновна', '500192847291', 'org-vasilieva')
  }
];

const INITIAL_INVOICES: BillingInvoice[] = [
  {
    id: 'inv-101',
    number: 'СЧ-2026-0038',
    date: '2026-08-15',
    organizationName: 'ИП Смирнов Алексей Владимирович',
    inn: '772481928412',
    tariffName: 'Бизнес-Сеть',
    months: 3,
    totalAmountRub: 13473,
    status: 'paid',
    paymentMethod: 'invoice_bank',
  },
  {
    id: 'inv-102',
    number: 'СЧ-2026-0041',
    date: '2026-09-01',
    organizationName: 'ООО "Кофе Холдинг Северо-Запад"',
    inn: '7810984521',
    tariffName: 'Корпоративный Холдинг',
    months: 6,
    totalAmountRub: 53946,
    status: 'paid',
    paymentMethod: 'invoice_bank',
  }
];

export const CLEAN_START_FALLBACK_ORG: CompanyOrganization = {
  id: 'org-clean-default',
  legalType: 'OOO',
  name: 'Основная организация',
  brandName: 'Моя сеть кофеен',
  inn: '7701000001',
  ogrn: '1267700000001',
  directorName: 'Руководитель',
  email: 'info@horeca-start.ru',
  phone: '+7 (999) 000-00-00',
  address: 'г. Москва, ул. Центральная, д. 1',
  currentTariffId: 'business',
  tariffStatus: 'active',
  tariffRenewalDate: '2026-12-31',
  createdAt: new Date().toISOString().split('T')[0],
  balanceRub: 0,
};

export const getOrganizations = (): CompanyOrganization[] => {
  const isClean = localStorage.getItem('checklist_clean_start_mode_v1') === 'true';
  try {
    const raw = localStorage.getItem(STORAGE_ORGS_KEY);
    if (!raw) {
      if (isClean) {
        return [];
      }
      localStorage.setItem(STORAGE_ORGS_KEY, JSON.stringify(INITIAL_ORGS));
      return INITIAL_ORGS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (isClean ? [] : INITIAL_ORGS);
  } catch (e) {
    return isClean ? [] : INITIAL_ORGS;
  }
};

export const getActiveOrganization = (): CompanyOrganization | null => {
  const orgs = getOrganizations();
  const activeId = localStorage.getItem(STORAGE_ACTIVE_ORG_KEY);
  if (activeId) {
    const match = orgs.find(o => o.id === activeId);
    if (match) return match;
  }
  return null;
};

export const saveOrganizations = (orgs: CompanyOrganization[], skipEventNotification = false): void => {
  try {
    localStorage.setItem(STORAGE_ORGS_KEY, JSON.stringify(orgs));
    if (!skipEventNotification && typeof window !== 'undefined' && orgs.length > 0) {
      window.dispatchEvent(new CustomEvent('checklist-db-write', {
        detail: {
          table: 'system_organizations',
          id: orgs[orgs.length - 1].id,
          name: orgs[orgs.length - 1].name,
          orgId: orgs[orgs.length - 1].id,
          action: 'UPSERT',
        }
      }));
    }
  } catch (e) {
    console.error('Error saving organizations', e);
  }
};

export const updateOrganizationYdbConfig = (orgId: string, ydbCfg: YdbConfig): boolean => {
  try {
    const raw = localStorage.getItem(STORAGE_ORGS_KEY);
    if (!raw) return false;
    const orgs: CompanyOrganization[] = JSON.parse(raw);
    if (!Array.isArray(orgs)) return false;
    const idx = orgs.findIndex(o => o.id === orgId);
    if (idx < 0) return false;
    orgs[idx].ydbConfig = ydbCfg;
    localStorage.setItem(STORAGE_ORGS_KEY, JSON.stringify(orgs));
    return true;
  } catch (e) {
    console.warn('Error updating org ydbConfig', e);
    return false;
  }
};

export const setActiveOrganization = (id: string): CompanyOrganization | null => {
  if (!id) {
    localStorage.removeItem(STORAGE_ACTIVE_ORG_KEY);
    return null;
  }
  const orgs = getOrganizations();
  const match = orgs.find(o => o.id === id);
  if (match) {
    localStorage.setItem(STORAGE_ACTIVE_ORG_KEY, id);
    return match;
  }
  localStorage.removeItem(STORAGE_ACTIVE_ORG_KEY);
  return null;
};

export const cleanInnString = (inn: string): string => {
  return (inn || '').trim().replace(/\D/g, '');
};

export const findOrganizationByInn = (inn: string): CompanyOrganization | null => {
  const clean = cleanInnString(inn);
  if (!clean) return null;
  const orgs = getOrganizations();
  return orgs.find(o => cleanInnString(o.inn) === clean) || null;
};

export const registerOrganization = (data: {
  legalType: LegalEntityType;
  name: string;
  brandName?: string;
  inn: string;
  ogrn: string;
  directorName: string;
  email: string;
  phone: string;
  address: string;
  bankName?: string;
  bankBik?: string;
  bankAccount?: string;
  tariffId?: TariffPlanId;
  ydbConfig?: YdbConfig;
}): { success: boolean; organization?: CompanyOrganization; error?: string } => {
  const orgs = getOrganizations();
  
  const cleanInn = data.inn.trim().replace(/\D/g, '');
  if (!cleanInn || (cleanInn.length !== 10 && cleanInn.length !== 12)) {
    return { success: false, error: 'ИНН должен содержать 10 цифр (для ООО) или 12 цифр (для ИП)' };
  }

  if (!data.name.trim()) {
    return { success: false, error: 'Укажите официальное наименование юридического лица или ИП' };
  }

  if (!data.directorName.trim()) {
    return { success: false, error: 'Укажите ФИО руководителя' };
  }

  const existing = orgs.find(o => o.inn === cleanInn);
  if (existing) {
    return { success: false, error: `Организация с ИНН ${cleanInn} уже зарегистрирована (${existing.name})` };
  }

  const tariffId = data.tariffId || 'business';
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + 30);
  const newOrgId = `org-${Date.now()}`;

  // Dedicated isolated YDB database instance for this head legal entity
  const isolatedYdb = data.ydbConfig || generateIsolatedYdbConfig(data.name.trim(), cleanInn, newOrgId);

  const newOrg: CompanyOrganization = {
    id: newOrgId,
    legalType: data.legalType,
    name: data.name.trim(),
    brandName: data.brandName?.trim() || data.name.trim(),
    inn: cleanInn,
    ogrn: data.ogrn.trim() || '—',
    directorName: data.directorName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    address: data.address.trim() || 'РФ',
    bankName: data.bankName?.trim(),
    bankBik: data.bankBik?.trim(),
    bankAccount: data.bankAccount?.trim(),
    currentTariffId: tariffId,
    tariffStatus: 'active',
    tariffRenewalDate: renewalDate.toISOString().split('T')[0],
    createdAt: new Date().toISOString().split('T')[0],
    balanceRub: 5000, // Welcome demo credit
    ydbConfig: isolatedYdb,
  };

  // Persist isolated YDB config as internal default setup (isInternalUpdate = true)
  saveYdbConfig(isolatedYdb, newOrg.id, true);
  markYdbCustomConfigured(false, newOrg.id);

  const updated = [newOrg, ...orgs];
  localStorage.setItem(STORAGE_ORGS_KEY, JSON.stringify(updated));
  localStorage.setItem(STORAGE_ACTIVE_ORG_KEY, newOrg.id);

  // Generate welcome invoice
  createInvoice(newOrg.id, tariffId, 1);

  return { success: true, organization: newOrg };
};

export const updateOrganization = (updatedOrg: CompanyOrganization): boolean => {
  const orgs = getOrganizations();
  const index = orgs.findIndex(o => o.id === updatedOrg.id);
  if (index === -1) return false;

  orgs[index] = updatedOrg;
  localStorage.setItem(STORAGE_ORGS_KEY, JSON.stringify(orgs));
  return true;
};

export const changeOrganizationTariff = (orgId: string, newTariffId: TariffPlanId): boolean => {
  const orgs = getOrganizations();
  const index = orgs.findIndex(o => o.id === orgId);
  if (index === -1) return false;

  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + 30);

  orgs[index].currentTariffId = newTariffId;
  orgs[index].tariffRenewalDate = renewalDate.toISOString().split('T')[0];
  orgs[index].tariffStatus = 'active';

  localStorage.setItem(STORAGE_ORGS_KEY, JSON.stringify(orgs));
  createInvoice(orgId, newTariffId, 1);
  return true;
};

export const updateOrganizationTariff = changeOrganizationTariff;

export const updateOrganizationStatus = (orgId: string, status: 'active' | 'trial' | 'past_due'): boolean => {
  const orgs = getOrganizations();
  const index = orgs.findIndex(o => o.id === orgId);
  if (index === -1) return false;
  orgs[index].tariffStatus = status;
  localStorage.setItem(STORAGE_ORGS_KEY, JSON.stringify(orgs));
  return true;
};

export const updateOrganizationBalance = (orgId: string, deltaRub: number): boolean => {
  const orgs = getOrganizations();
  const index = orgs.findIndex(o => o.id === orgId);
  if (index === -1) return false;
  orgs[index].balanceRub = Math.max(0, (orgs[index].balanceRub || 0) + deltaRub);
  localStorage.setItem(STORAGE_ORGS_KEY, JSON.stringify(orgs));
  return true;
};

export const getOrganizationsForUser = (user: ManagerUser | null): CompanyOrganization[] => {
  const all = getOrganizations();
  if (!user) return [];
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('checklist_is_demo_session') === 'true';
  // Platform App Admin and Demo session see all registered organizations
  if (user.role === 'app_admin' || isDemo) {
    return all;
  }
  // If user has explicit organization binding
  const userInn = user.organizationInn ? cleanInnString(user.organizationInn) : '';
  const userOrgId = user.organizationId;
  const userOrgIds = user.organizationIds || [];

  return all.filter(org => {
    if (userOrgId && org.id === userOrgId) return true;
    if (userInn && cleanInnString(org.inn) === userInn) return true;
    if (userOrgIds.includes(org.id)) return true;
    return false;
  });
};

export const getInvoices = (orgId?: string): BillingInvoice[] => {
  try {
    const raw = localStorage.getItem(STORAGE_INVOICES_KEY);
    const list: BillingInvoice[] = raw ? JSON.parse(raw) : INITIAL_INVOICES;
    if (orgId) {
      const org = getOrganizations().find(o => o.id === orgId);
      if (org) {
        return list.filter(i => i.inn === org.inn || i.organizationName === org.name);
      }
    }
    return list;
  } catch (e) {
    return INITIAL_INVOICES;
  }
};

export const createInvoice = (orgId: string, tariffId: TariffPlanId, months: number = 1): BillingInvoice | null => {
  const org = getOrganizations().find(o => o.id === orgId);
  const tariffs = getTariffPlans();
  const tariff = tariffs.find(t => t.id === tariffId) || tariffs[0];
  if (!org || !tariff) return null;

  const discount = months >= 12 ? 0.20 : months >= 6 ? 0.10 : 0;
  const baseTotal = tariff.priceMonthly * months;
  const totalAmountRub = Math.round(baseTotal * (1 - discount));

  const newInvoice: BillingInvoice = {
    id: `inv-${Date.now()}`,
    number: `СЧ-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    date: new Date().toISOString().split('T')[0],
    organizationName: org.name,
    inn: org.inn,
    tariffName: tariff.name,
    months,
    totalAmountRub,
    status: 'paid', // Instant demo processing
    paymentMethod: 'invoice_bank',
  };

  const list = getInvoices();
  const updated = [newInvoice, ...list];
  localStorage.setItem(STORAGE_INVOICES_KEY, JSON.stringify(updated));
  return newInvoice;
};
