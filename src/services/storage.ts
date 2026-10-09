import { 
  ChecklistTemplate, 
  ChecklistSubmission, 
  PointLocation, 
  StaffMember, 
  QueueItem, 
  S3StoredMedia, 
  RedisCacheEntry 
} from '../types';
import { PREBUILT_TEMPLATES, INITIAL_POINTS, INITIAL_STAFF, INITIAL_SUBMISSIONS } from '../mockData';
import { CLEAN_START_FLAG, DATA_CLEARED_BY_USER_FLAG } from './cleanStartService';
import { cleanInnString } from './companyService';

const STORAGE_KEYS = {
  TEMPLATES: 'checklist_1c_templates_v1',
  POINTS: 'checklist_1c_points_v1',
  STAFF: 'checklist_1c_staff_v1',
  SUBMISSIONS: 'checklist_1c_submissions_v1',
  QUEUE: 'checklist_1c_queue_v1',
  S3_MEDIA: 'checklist_1c_s3_media_v1',
  TELEGRAM_ALERTS: 'checklist_1c_telegram_alerts_v1',
  NETWORK_STATUS: 'checklist_1c_network_status_v1',
};

export interface TelegramAlert {
  id: string;
  timestamp: string;
  type: 'violation' | 'delay' | 'success' | 'queue';
  pointName: string;
  staffName: string;
  title: string;
  message: string;
  photoUrl?: string;
  checklistNumber: string;
  read: boolean;
}

// Initializer
export const initializeStorage = () => {
  const isClean = localStorage.getItem(CLEAN_START_FLAG) === 'true';
  const wasClearedByUser = localStorage.getItem(DATA_CLEARED_BY_USER_FLAG) === 'true';
  const skipDemo = isClean || wasClearedByUser;

  if (!localStorage.getItem(STORAGE_KEYS.TEMPLATES)) {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(skipDemo ? [] : PREBUILT_TEMPLATES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.POINTS)) {
    localStorage.setItem(STORAGE_KEYS.POINTS, JSON.stringify(skipDemo ? [] : INITIAL_POINTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.STAFF)) {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(skipDemo ? [] : INITIAL_STAFF));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(skipDemo ? [] : INITIAL_SUBMISSIONS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.QUEUE)) {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.S3_MEDIA)) {
    localStorage.setItem(STORAGE_KEYS.S3_MEDIA, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TELEGRAM_ALERTS)) {
    if (skipDemo) {
      localStorage.setItem(STORAGE_KEYS.TELEGRAM_ALERTS, JSON.stringify([]));
    } else {
      const initialAlerts: TelegramAlert[] = [
        {
          id: 'alert-1',
          timestamp: '2026-09-01T10:19:00Z',
          type: 'violation',
          pointName: 'Кофе с собой «ТЦ Галерея»',
          staffName: 'Михаил Громов',
          title: '⚠️ Нарушение ХАССП: Высокая температура холода',
          message: 'Холодильник №1: Зафиксировано +8.2°C (допустимо до +5.0°C). Требуется регулировка термостата!',
          checklistNumber: 'ЗЧ-00042',
          photoUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&auto=format&fit=crop&q=80',
          read: false,
        },
        {
          id: 'alert-2',
          timestamp: '2026-09-01T07:47:00Z',
          type: 'success',
          pointName: 'Кофейня «Центр» (Флагман)',
          staffName: 'Артем Белов',
          title: '✅ Чек-лист «Открытие смены» успешно сдан',
          message: 'Все 7 пунктов выполнены вовремя (+1 мин). Оборудование настроено.',
          checklistNumber: 'ЗЧ-00041',
          read: true,
        }
      ];
      localStorage.setItem(STORAGE_KEYS.TELEGRAM_ALERTS, JSON.stringify(initialAlerts));
    }
  }
};

// Helper to get fallback organization
const getFallbackOrg = (): { id: string; name: string; inn: string } => {
  try {
    const raw = localStorage.getItem('checklist_company_organizations_v1');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return {
          id: list[0].id,
          name: list[0].name,
          inn: list[0].inn,
        };
      }
    }
  } catch {}
  return {
    id: 'org-main',
    name: 'Основная организация',
    inn: '7701000001',
  };
};

const notifyYdbEntityChange = (table: string, id: string, name: string, orgId?: string, action: 'UPSERT' | 'DELETE' | 'INSERT' = 'UPSERT') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('checklist-db-write', {
      detail: { table, id, name, orgId, action }
    }));
  }
};

// Templates Store
export const getTemplates = (organizationId?: string): ChecklistTemplate[] => {
  const isClean = localStorage.getItem(CLEAN_START_FLAG) === 'true';
  const wasClearedByUser = localStorage.getItem(DATA_CLEARED_BY_USER_FLAG) === 'true';
  const defaultList = (isClean || wasClearedByUser) ? [] : PREBUILT_TEMPLATES;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    const list: ChecklistTemplate[] = data ? JSON.parse(data) : defaultList;
    if (organizationId) {
      return list.filter(t => !t.organizationId || t.organizationId === organizationId);
    }
    return list;
  } catch (e) {
    return defaultList;
  }
};

export const saveTemplate = (
  template: ChecklistTemplate,
  defaultOrg?: { id: string; name: string; inn: string } | string
): ChecklistTemplate => {
  const templates = getTemplates();
  const fallback = getFallbackOrg();
  const orgId = typeof defaultOrg === 'string' ? defaultOrg : defaultOrg?.id;
  const orgInn = typeof defaultOrg === 'object' ? defaultOrg?.inn : undefined;

  const normalizedTemplate: ChecklistTemplate = {
    ...template,
    organizationId: template.organizationId || orgId || fallback.id,
    organizationInn: template.organizationInn || orgInn || fallback.inn,
  };

  const index = templates.findIndex(t => t.id === normalizedTemplate.id);
  
  if (index >= 0) {
    // Bump patch version automatically if edited
    const parts = (normalizedTemplate.version || '1.0.0').split('.');
    if (parts.length === 3) {
      parts[2] = (parseInt(parts[2], 10) + 1).toString();
      normalizedTemplate.version = parts.join('.');
    }
    normalizedTemplate.updatedAt = new Date().toISOString();
    templates[index] = normalizedTemplate;
  } else {
    normalizedTemplate.createdAt = new Date().toISOString();
    normalizedTemplate.updatedAt = new Date().toISOString();
    templates.unshift(normalizedTemplate);
  }
  
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  notifyYdbEntityChange('checklist_templates', normalizedTemplate.id, normalizedTemplate.title, normalizedTemplate.organizationId, 'UPSERT');
  return normalizedTemplate;
};

export const deleteTemplate = (id: string) => {
  const templates = getTemplates().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  notifyYdbEntityChange('checklist_templates', id, id, undefined, 'DELETE');
};

// Points & Staff
export const getPoints = (organizationId?: string, organizationInn?: string): PointLocation[] => {
  const isClean = localStorage.getItem(CLEAN_START_FLAG) === 'true';
  const wasClearedByUser = localStorage.getItem(DATA_CLEARED_BY_USER_FLAG) === 'true';
  const defaultList = (isClean || wasClearedByUser) ? [] : INITIAL_POINTS;
  const cleanFilterInn = organizationInn ? cleanInnString(organizationInn) : '';
  try {
    const data = localStorage.getItem(STORAGE_KEYS.POINTS);
    const list: PointLocation[] = data ? JSON.parse(data) : defaultList;
    if (organizationId || cleanFilterInn) {
      return list.filter(p => {
        const matchId = organizationId && p.organizationId && p.organizationId === organizationId;
        const matchInn = cleanFilterInn && p.organizationInn && cleanInnString(p.organizationInn) === cleanFilterInn;
        return Boolean(matchId || matchInn);
      });
    }
    return list;
  } catch (e) {
    if (organizationId || cleanFilterInn) {
      return defaultList.filter(p => {
        const matchId = organizationId && p.organizationId && p.organizationId === organizationId;
        const matchInn = cleanFilterInn && p.organizationInn && cleanInnString(p.organizationInn) === cleanFilterInn;
        return Boolean(matchId || matchInn);
      });
    }
    return defaultList;
  }
};

export const savePoint = (
  point: PointLocation, 
  defaultOrg?: { id: string; name: string; inn: string } | string
): PointLocation => {
  const points = getPoints();
  const fallback = getFallbackOrg();
  const orgId = typeof defaultOrg === 'string' ? defaultOrg : defaultOrg?.id;
  const orgName = typeof defaultOrg === 'object' ? defaultOrg?.name : undefined;
  const orgInn = typeof defaultOrg === 'object' ? defaultOrg?.inn : undefined;

  const normalizedPoint: PointLocation = {
    ...point,
    organizationId: point.organizationId || orgId || fallback.id,
    organizationName: point.organizationName || orgName || fallback.name,
    organizationInn: point.organizationInn || orgInn || fallback.inn,
  };

  const index = points.findIndex(p => p.id === normalizedPoint.id);
  if (index >= 0) {
    points[index] = normalizedPoint;
  } else {
    points.push(normalizedPoint);
  }
  localStorage.setItem(STORAGE_KEYS.POINTS, JSON.stringify(points));
  notifyYdbEntityChange('locations', normalizedPoint.id, normalizedPoint.name, normalizedPoint.organizationId, 'UPSERT');
  return normalizedPoint;
};

export const deletePoint = (id: string, _organizationId?: string) => {
  const points = getPoints().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.POINTS, JSON.stringify(points));
  notifyYdbEntityChange('locations', id, id, undefined, 'DELETE');
};

export const getStaff = (organizationId?: string, organizationInn?: string): StaffMember[] => {
  const isClean = localStorage.getItem(CLEAN_START_FLAG) === 'true';
  const wasClearedByUser = localStorage.getItem(DATA_CLEARED_BY_USER_FLAG) === 'true';
  const defaultList = (isClean || wasClearedByUser) ? [] : INITIAL_STAFF;
  const cleanFilterInn = organizationInn ? cleanInnString(organizationInn) : '';
  try {
    const data = localStorage.getItem(STORAGE_KEYS.STAFF);
    const parsed: StaffMember[] = data ? JSON.parse(data) : defaultList;
    const fallback = getFallbackOrg();
    const normalized = parsed.map(s => {
      const pointIds = Array.isArray(s.pointIds) && s.pointIds.length > 0
        ? s.pointIds
        : (s.pointId ? [s.pointId] : ['pt-1']);
      return {
        ...s,
        pointIds,
        pointId: s.pointId || pointIds[0],
        organizationId: s.organizationId || fallback.id,
        organizationName: s.organizationName || fallback.name,
        organizationInn: s.organizationInn || fallback.inn,
      };
    });

    if (organizationId || cleanFilterInn) {
      return normalized.filter(s => {
        const matchId = organizationId && s.organizationId && s.organizationId === organizationId;
        const matchInn = cleanFilterInn && s.organizationInn && cleanInnString(s.organizationInn) === cleanFilterInn;
        return Boolean(matchId || matchInn);
      });
    }
    return normalized;
  } catch (e) {
    if (organizationId || cleanFilterInn) {
      return defaultList.filter(s => {
        const matchId = organizationId && s.organizationId && s.organizationId === organizationId;
        const matchInn = cleanFilterInn && s.organizationInn && cleanInnString(s.organizationInn) === cleanFilterInn;
        return Boolean(matchId || matchInn);
      });
    }
    return defaultList;
  }
};

export const saveStaff = (
  member: StaffMember,
  defaultOrg?: { id: string; name: string; inn: string } | string
): StaffMember => {
  const staff = getStaff();
  const fallback = getFallbackOrg();
  const orgId = typeof defaultOrg === 'string' ? defaultOrg : defaultOrg?.id;
  const orgName = typeof defaultOrg === 'object' ? defaultOrg?.name : undefined;
  const orgInn = typeof defaultOrg === 'object' ? defaultOrg?.inn : undefined;

  const pointIds = Array.isArray(member.pointIds) && member.pointIds.length > 0
    ? member.pointIds
    : (member.pointId ? [member.pointId] : ['pt-1']);
  
  const normalizedMember: StaffMember = {
    ...member,
    pointIds,
    pointId: member.pointId || pointIds[0],
    organizationId: member.organizationId || orgId || fallback.id,
    organizationName: member.organizationName || orgName || fallback.name,
    organizationInn: member.organizationInn || orgInn || fallback.inn,
  };

  const index = staff.findIndex(s => s.id === normalizedMember.id);
  if (index >= 0) {
    staff[index] = normalizedMember;
  } else {
    staff.push(normalizedMember);
  }
  localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
  notifyYdbEntityChange('staff', normalizedMember.id, normalizedMember.name, normalizedMember.organizationId, 'UPSERT');
  return normalizedMember;
};

export const deleteStaff = (id: string, _organizationId?: string) => {
  const staff = getStaff().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
  notifyYdbEntityChange('staff', id, id, undefined, 'DELETE');
};

// Submissions / 1C Documents Store
export const getSubmissions = (organizationId?: string): ChecklistSubmission[] => {
  const isClean = localStorage.getItem(CLEAN_START_FLAG) === 'true';
  const wasClearedByUser = localStorage.getItem(DATA_CLEARED_BY_USER_FLAG) === 'true';
  const defaultList = (isClean || wasClearedByUser) ? [] : INITIAL_SUBMISSIONS;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    const list: ChecklistSubmission[] = data ? JSON.parse(data) : defaultList;
    if (organizationId) {
      return list.filter(s => s.organizationId === organizationId);
    }
    return list;
  } catch (e) {
    return organizationId
      ? defaultList.filter(s => s.organizationId === organizationId)
      : defaultList;
  }
};

export const getNext1CDocNumber = (): string => {
  const subs = getSubmissions();
  const nextNum = subs.length + 41;
  const ts = Date.now().toString().slice(-4);
  return `ЗЧ-${String(nextNum).padStart(5, '0')}-${ts}`;
};

// S3 Media Upload Simulator (MinIO S3 on VPS)
export const uploadToS3 = (fileDataUrl: string, pointName: string, checklistNumber: string): S3StoredMedia => {
  const id = 's3-' + Math.random().toString(36).substring(2, 9);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const filename = `photo_${now.getHours()}${now.getMinutes()}_${id}.webp`;
  const shortUrl = `minio://horeca-checklist-photos/${dateStr}/${filename}`;
  const fullS3Uri = `https://s3.horeca-network.ru/horeca-checklist-photos/${dateStr}/${filename}`;
  
  const mediaItem: S3StoredMedia = {
    id,
    filename,
    shortUrl,
    fullS3Uri,
    sizeBytes: Math.round(fileDataUrl.length * 0.75),
    mimeType: 'image/webp',
    uploadedAt: now.toISOString(),
    pointName,
    checklistNumber,
    base64Data: fileDataUrl,
  };
  
  try {
    const existing = getS3Media();
    existing.unshift(mediaItem);
    // Keep max 50 for storage quota
    localStorage.setItem(STORAGE_KEYS.S3_MEDIA, JSON.stringify(existing.slice(0, 50)));
  } catch (e) {
    console.warn('Storage quota warning for S3 media cache');
  }
  
  return mediaItem;
};

export const getS3Media = (): S3StoredMedia[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.S3_MEDIA);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

// Queue & 1C Synchronizer
export const getQueue = (): QueueItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.QUEUE);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveQueue = (queue: QueueItem[]) => {
  localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
};

// Telegram Alerts
export const getTelegramAlerts = (): TelegramAlert[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TELEGRAM_ALERTS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const addTelegramAlert = (alert: Omit<TelegramAlert, 'id' | 'timestamp' | 'read'>) => {
  const alerts = getTelegramAlerts();
  const newAlert: TelegramAlert = {
    ...alert,
    id: 'tg-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    read: false,
  };
  alerts.unshift(newAlert);
  localStorage.setItem(STORAGE_KEYS.TELEGRAM_ALERTS, JSON.stringify(alerts.slice(0, 40)));
};

// Submit checklist with offline / online handling
export const submitChecklist = (
  submissionData: Omit<ChecklistSubmission, 'id' | 'number1C' | 'is1CSynced' | 'syncAttempts' | 'oneCDocGuid'>,
  isNetworkOnline: boolean = true
): { submission: ChecklistSubmission; queued: boolean } => {
  const docNumber = getNext1CDocNumber();
  const submission: ChecklistSubmission = {
    ...submissionData,
    id: 'sub-' + Math.random().toString(36).substring(2, 9),
    number1C: docNumber,
    is1CSynced: isNetworkOnline,
    syncAttempts: isNetworkOnline ? 1 : 0,
    oneCDocGuid: isNetworkOnline ? crypto.randomUUID() : undefined,
  };

  // If online, record in 1C documents database
  const submissions = getSubmissions();
  submissions.unshift(submission);
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
  notifyYdbEntityChange('checklist_submissions', submission.id, `${submission.number1C} — ${submission.templateTitle}`, submission.organizationId, 'INSERT');

  if (!isNetworkOnline) {
    // Add to async queue
    const queue = getQueue();
    queue.push({
      id: 'q-' + Math.random().toString(36).substring(2, 9),
      submissionId: submission.id,
      pointName: submission.pointName,
      templateTitle: submission.templateTitle,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
      payload: submission,
    });
    saveQueue(queue);

    addTelegramAlert({
      type: 'queue',
      pointName: submission.pointName,
      staffName: submission.staffName,
      title: '📶 Чек-лист сохранен в офлайн-очередь',
      message: `Ответ сохранен на смартфоне бариста (${submission.pointName}). Будет синхронизирован с YDB при возобновлении связи.`,
      checklistNumber: docNumber,
    });

    return { submission, queued: true };
  }

  // Trigger Telegram alerts based on violations or status
  if (submission.violationsCount > 0) {
    const violationAnswer = submission.answers.find(a => a.isViolation);
    addTelegramAlert({
      type: 'violation',
      pointName: submission.pointName,
      staffName: submission.staffName,
      title: `⚠️ Нарушение в чек-листе ${docNumber}`,
      message: `${violationAnswer?.blockTitle || 'Выявлены замечания'}: ${violationAnswer?.violationReason || 'Значение не соответствует нормативу'}. Нарушений: ${submission.violationsCount}`,
      checklistNumber: docNumber,
      photoUrl: violationAnswer?.photoUrls?.[0],
    });
  } else if (submission.timeDeviationMinutes > 15) {
    addTelegramAlert({
      type: 'delay',
      pointName: submission.pointName,
      staffName: submission.staffName,
      title: `⏱ Опоздание сдачи чек-листа (+${submission.timeDeviationMinutes} мин)`,
      message: `${submission.templateTitle} сдан с опозданием в ${submission.pointName}. Бариста: ${submission.staffName}.`,
      checklistNumber: docNumber,
    });
  } else {
    addTelegramAlert({
      type: 'success',
      pointName: submission.pointName,
      staffName: submission.staffName,
      title: `✅ Чек-лист ${docNumber} успешно записан в YDB`,
      message: `${submission.templateTitle} (${submission.pointName}) выполнен без замечаний.`,
      checklistNumber: docNumber,
    });
  }

  return { submission, queued: false };
};

// Process offline queue
export const processSyncQueue = (): number => {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  const submissions = getSubmissions();
  let syncedCount = 0;

  const remainingQueue: QueueItem[] = [];

  for (const item of queue) {
    const subIdx = submissions.findIndex(s => s.id === item.submissionId);
    if (subIdx >= 0) {
      submissions[subIdx].is1CSynced = true;
      submissions[subIdx].syncAttempts += 1;
      submissions[subIdx].oneCDocGuid = crypto.randomUUID();
      syncedCount++;

      addTelegramAlert({
        type: 'success',
        pointName: item.pointName,
        staffName: item.payload.staffName,
        title: `🔄 Очередь синхронизирована с YDB: ${submissions[subIdx].number1C}`,
        message: `Связь восстановлена. Чек-лист успешно записан в Managed Service for YDB.`,
        checklistNumber: submissions[subIdx].number1C,
      });
    }
  }

  saveQueue(remainingQueue);
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
  return syncedCount;
};

// Clean Database & Provisioning Tools
export const resetToCleanDatabase = () => {
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.S3_MEDIA, JSON.stringify([]));
  const cleanAlert: TelegramAlert = {
    id: 'clean-init-' + Date.now(),
    timestamp: new Date().toISOString(),
    type: 'success',
    pointName: 'YDB Serverless',
    staffName: 'Администратор системы',
    title: '🟢 Таблицы YDB очищены и готовы к работе',
    message: 'Таблицы чек-листов и очередей сброшены в исходное состояние. Данные готовы к приему с мобильных устройств.',
    checklistNumber: 'ИНФО-00001',
    read: false,
  };
  localStorage.setItem(STORAGE_KEYS.TELEGRAM_ALERTS, JSON.stringify([cleanAlert]));
};

export const restoreDemoDatabase = () => {
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(INITIAL_SUBMISSIONS));
  localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(PREBUILT_TEMPLATES));
  localStorage.setItem(STORAGE_KEYS.POINTS, JSON.stringify(INITIAL_POINTS));
  localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(INITIAL_STAFF));
  const resetAlert: TelegramAlert = {
    id: 'demo-init-' + Date.now(),
    timestamp: new Date().toISOString(),
    type: 'success',
    pointName: 'YDB Serverless',
    staffName: 'Администратор',
    title: '🔄 Демонстрационный набор данных загружен',
    message: 'Восстановлены примеры проведенных проверок, торговые точки сети и шаблоны чек-листов.',
    checklistNumber: 'ДЕМО-00001',
    read: false,
  };
  localStorage.setItem(STORAGE_KEYS.TELEGRAM_ALERTS, JSON.stringify([resetAlert]));
};

