import { PlatformAdminUser, PlatformAdminRole, ManagerUser } from '../types';
import { getAppAdminSlug } from './companyService';

const STORAGE_PLATFORM_ADMINS_KEY = 'checklist_platform_admins_registry_v1';

export const PLATFORM_ROLE_DEFINITIONS: Record<PlatformAdminRole, {
  title: string;
  badgeColor: string;
  description: string;
  permissionsSummary: string;
}> = {
  app_admin: {
    title: 'Главный администратор (Root)',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    description: 'Полный неограниченный доступ ко всем юридическим лицам, тарифам, обособленной YDB администратора, хранилищу MinIO и управлению командой платформы.',
    permissionsSummary: 'Полный доступ (Super Admin)',
  },
  support_lead: {
    title: 'Техническая поддержка (Support Lead)',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    description: 'Мониторинг зарегистрированных заведений, помощь управляющим, аудит проблемных точек, проверка регламентов и диагностика.',
    permissionsSummary: 'Организации, поддержка, аудит заведений',
  },
  billing_admin: {
    title: 'Финансовый администратор (Billing Admin)',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    description: 'Управление тарифными сетками, ценами, продление периодов подписки, просмотр транзакций и выставление счетов юр. лицам.',
    permissionsSummary: 'Тарифные планы, счета, биллинг',
  },
  tech_admin: {
    title: 'Системный инженер (DevOps / Tech Admin)',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    description: 'Управление изолированным кластером YDB, бакетами MinIO S3, схемами таблиц, системными параметрами и резервными копиями.',
    permissionsSummary: 'YDB SQL кластер, MinIO S3, системные логи',
  },
};

export const INITIAL_PLATFORM_ADMINS: PlatformAdminUser[] = [
  {
    id: 'adm-root',
    login: 'appadmin',
    name: 'Главный Администратор Платформы',
    role: 'app_admin',
    roleTitle: 'Главный администратор (Root)',
    email: 'root@horeca-platform.ru',
    phone: '+7 (800) 555-35-35',
    passwordHash: 'admin2026',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: new Date().toISOString(),
    notes: 'Мастер-аккаунт платформы по умолчанию (системный Root)',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'adm-support',
    login: 'support_lead',
    name: 'Денис Мельников',
    role: 'support_lead',
    roleTitle: 'Руководитель техподдержки',
    email: 'support@horeca-cloud.ru',
    phone: '+7 (800) 555-35-36',
    passwordHash: 'support2026',
    isActive: true,
    createdAt: '2026-01-15T09:00:00Z',
    lastLoginAt: new Date(Date.now() - 7200000).toISOString(),
    notes: 'Дежурная поддержка клиентов и диагностика сбоев точек',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'adm-billing',
    login: 'billing_anna',
    name: 'Анна Воронова',
    role: 'billing_admin',
    roleTitle: 'Финансовый администратор',
    email: 'billing@horeca-cloud.ru',
    phone: '+7 (926) 333-11-22',
    passwordHash: 'bill2026',
    isActive: true,
    createdAt: '2026-02-01T11:30:00Z',
    lastLoginAt: new Date(Date.now() - 86400000).toISOString(),
    notes: 'Учет оплат тарифов, выставление счетов и счета-фактуры',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  },
];

export const getPlatformAdmins = (): PlatformAdminUser[] => {
  try {
    const raw = localStorage.getItem(STORAGE_PLATFORM_ADMINS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_PLATFORM_ADMINS_KEY, JSON.stringify(INITIAL_PLATFORM_ADMINS));
      return INITIAL_PLATFORM_ADMINS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure root appadmin is always present
      const hasRoot = parsed.some(a => a.login === 'appadmin');
      if (!hasRoot) {
        parsed.unshift(INITIAL_PLATFORM_ADMINS[0]);
        localStorage.setItem(STORAGE_PLATFORM_ADMINS_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
    return INITIAL_PLATFORM_ADMINS;
  } catch (e) {
    console.error('Failed to load platform admins', e);
    return INITIAL_PLATFORM_ADMINS;
  }
};

export const savePlatformAdmins = (admins: PlatformAdminUser[]): void => {
  try {
    localStorage.setItem(STORAGE_PLATFORM_ADMINS_KEY, JSON.stringify(admins));
  } catch (e) {
    console.error('Failed to save platform admins', e);
  }
};

export interface CreatePlatformAdminInput {
  name: string;
  login: string;
  email: string;
  phone?: string;
  password: string;
  role: PlatformAdminRole;
  notes?: string;
  avatarUrl?: string;
}

export const createPlatformAdmin = (
  input: CreatePlatformAdminInput
): { success: boolean; admin?: PlatformAdminUser; error?: string } => {
  const name = input.name.trim();
  const login = input.login.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (!name) {
    return { success: false, error: 'Укажите ФИО администратора или сотрудника' };
  }
  if (!login || login.length < 3) {
    return { success: false, error: 'Логин должен быть не короче 3 символов' };
  }
  if (!/^[a-z0-9_.-]+$/i.test(login)) {
    return { success: false, error: 'Логин может содержать только латинские буквы, цифры, дефис и подчеркивание' };
  }
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Укажите корректный рабочий email' };
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'Пароль должен содержать минимум 4 символа' };
  }

  const currentList = getPlatformAdmins();

  // Check login uniqueness across platform admins
  const exists = currentList.find(a => a.login.toLowerCase() === login || a.email.toLowerCase() === email);
  if (exists) {
    return { 
      success: false, 
      error: `Администратор с логином «${login}» или email «${email}» уже существует` 
    };
  }

  const roleDef = PLATFORM_ROLE_DEFINITIONS[input.role] || PLATFORM_ROLE_DEFINITIONS.app_admin;

  const newAdmin: PlatformAdminUser = {
    id: 'adm-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
    login,
    name,
    role: input.role,
    roleTitle: roleDef.title,
    email,
    phone: input.phone?.trim() || '',
    passwordHash: password,
    isActive: true,
    createdAt: new Date().toISOString(),
    notes: input.notes?.trim() || '',
    avatarUrl: input.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  };

  const updated = [...currentList, newAdmin];
  savePlatformAdmins(updated);

  return { success: true, admin: newAdmin };
};

export const updatePlatformAdmin = (
  id: string,
  updates: Partial<PlatformAdminUser>
): { success: boolean; admin?: PlatformAdminUser; error?: string } => {
  const currentList = getPlatformAdmins();
  const index = currentList.findIndex(a => a.id === id);
  if (index === -1) {
    return { success: false, error: 'Администратор не найден' };
  }

  const target = currentList[index];

  // Prevent changing root admin login or role to something non-root
  if (target.login === 'appadmin' && updates.login && updates.login !== 'appadmin') {
    return { success: false, error: 'Логин системного супер-администратора appadmin изменить нельзя' };
  }

  if (updates.role && PLATFORM_ROLE_DEFINITIONS[updates.role]) {
    updates.roleTitle = PLATFORM_ROLE_DEFINITIONS[updates.role].title;
  }

  const updatedAdmin = {
    ...target,
    ...updates,
  };

  currentList[index] = updatedAdmin;
  savePlatformAdmins(currentList);

  return { success: true, admin: updatedAdmin };
};

export const togglePlatformAdminActive = (
  id: string
): { success: boolean; isActive?: boolean; error?: string } => {
  const currentList = getPlatformAdmins();
  const index = currentList.findIndex(a => a.id === id);
  if (index === -1) {
    return { success: false, error: 'Администратор не найден' };
  }

  const target = currentList[index];
  if (target.login === 'appadmin') {
    return { success: false, error: 'Нельзя отключить мастер-аккаунт супер-администратора (Root)' };
  }

  target.isActive = !target.isActive;
  currentList[index] = target;
  savePlatformAdmins(currentList);

  return { success: true, isActive: target.isActive };
};

export const deletePlatformAdmin = (id: string): { success: boolean; error?: string } => {
  const currentList = getPlatformAdmins();
  const target = currentList.find(a => a.id === id);
  if (!target) {
    return { success: false, error: 'Администратор не найден' };
  }

  if (target.login === 'appadmin' || target.id === 'adm-root') {
    return { success: false, error: 'Нельзя удалить системного супер-администратора платформы' };
  }

  const filtered = currentList.filter(a => a.id !== id);
  savePlatformAdmins(filtered);
  return { success: true };
};

/**
 * Generates a memorable yet strong password for a new colleague
 */
export const generateSecureAdminPassword = (): string => {
  const adjectives = ['Safe', 'Swift', 'Prime', 'Apex', 'Core', 'Vast', 'Bold', 'Nord'];
  const nouns = ['Cloud', 'Admin', 'Gate', 'Vault', 'Pulse', 'Node', 'Shield', 'Desk'];
  const symbols = ['!', '@', '#', '$', '%', '*'];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900);
  const sym = symbols[Math.floor(Math.random() * symbols.length)];

  return `${adj}${noun}${num}${sym}`;
};

/**
 * Builds formatted text with credentials for sharing with colleague in messengers
 */
export const buildAdminInviteMessage = (admin: PlatformAdminUser, plainPassword?: string): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://horeca-cloud.ru';
  const slug = getAppAdminSlug();
  const loginUrl = `${origin}/#${slug}`;

  return `🔐 Доступ к панели администратора платформы HoReCa

Здравствуйте, ${admin.name}!
Для вас создана учетная запись с ролью «${admin.roleTitle}».

🌐 Адрес входа: ${loginUrl}
👤 Логин: ${admin.login}
🔑 Пароль: ${plainPassword || admin.passwordHash}
🛡️ Разрешения: ${PLATFORM_ROLE_DEFINITIONS[admin.role]?.permissionsSummary || 'Доступ к платформе'}

* Пожалуйста, сохраните эти данные в безопасном месте.`;
};
