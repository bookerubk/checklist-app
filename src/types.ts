export type BlockType = 
  | 'check' 
  | 'photo' 
  | 'text' 
  | 'number' 
  | 'select' 
  | 'heading' 
  | 'divider';

export type TabType = 'welcome' | 'runner' | 'datalens' | 'ydb' | 'minio' | 'builder' | 'telegram' | 'qr' | 'staff_points' | 'company';

export interface SelectOption {
  id: string;
  label: string;
  isViolation?: boolean; // If choosing this marks an issue
}

export interface ChecklistBlock {
  id: string;
  type: BlockType;
  title: string;
  description?: string;
  required: boolean;
  
  // Specific constraints
  photoRequired?: boolean; // For check or number items: require photo proof
  minNumber?: number;
  maxNumber?: number;
  unit?: string; // e.g. "°C", "г", "кг", "шт"
  options?: SelectOption[];
  allowMultiplePhotos?: boolean;
  cameraOnly?: boolean; // Must use live camera, no gallery upload
}

export interface ChecklistTemplate {
  id: string;
  code: string; // 1C code e.g. "ЧК-00001"
  title: string;
  category: 'opening' | 'closing' | 'haccp' | 'equipment' | 'writeoff' | 'custom';
  description: string;
  version: string;
  updatedAt: string;
  createdAt: string;
  targetTime?: string; // e.g. "08:00" for opening shift
  allowedVarianceMinutes?: number; // e.g. 15 min
  blocks: ChecklistBlock[];
  active: boolean;
  assignedPoints: string[]; // Point IDs or ["all"]
  organizationId?: string;
  organizationInn?: string;
}

export interface PointLocation {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  openingTime: string; // "08:00"
  closingTime: string; // "22:00"
  pinCode: string;
  managerName: string;
  telegramChatId?: string;
  organizationId?: string;
  organizationName?: string;
  organizationInn?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'Бариста' | 'Шеф-бариста' | 'Управляющий' | 'Пекарь' | 'Стажер';
  pinCode: string;
  pinCodeHash?: string; // Реальный хэш PIN из YDB (скрытое поле, не для UI)
  pointId: string;
  pointIds: string[]; // Список разрешенных рабочих мест (кофеен) для сотрудника
  avatarUrl?: string;
  phone?: string;
  organizationId?: string;
  organizationName?: string;
  organizationInn?: string;
}

export interface BlockAnswer {
  blockId: string;
  blockTitle: string;
  type: BlockType;
  value: boolean | string | number | null;
  comment?: string;
  photoUrls?: string[]; // S3 URLs
  isViolation?: boolean;
  violationReason?: string;
}

export interface ChecklistSubmission {
  id: string;
  number1C: string; // "ЗЧ-00042"
  templateId: string;
  templateTitle: string;
  templateVersion: string;
  pointId: string;
  pointName: string;
  organizationId?: string;
  organizationName?: string;
  organizationInn?: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  timestamp: string; // ISO string
  plannedTime?: string;
  timeDeviationMinutes: number; // Positive = late, negative = early
  answers: BlockAnswer[];
  totalItems: number;
  completedItems: number;
  violationsCount: number;
  status: 'passed' | 'warning' | 'failed';
  is1CSynced: boolean;
  syncAttempts: number;
  s3MediaCount: number;
  oneCDocGuid?: string;
  geoStamping?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export interface S3StoredMedia {
  id: string;
  filename: string;
  shortUrl: string;
  fullS3Uri: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  pointName: string;
  checklistNumber: string;
  base64Data?: string;
}

export interface QueueItem {
  id: string;
  submissionId: string;
  pointName: string;
  templateTitle: string;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  lastError?: string;
  payload: ChecklistSubmission;
}

export interface RedisCacheEntry {
  key: string;
  type: 'schema' | 'auth' | 'session';
  ttlSeconds: number;
  sizeBytes: number;
  hits: number;
  lastAccessed: string;
  data: any;
}

// ==========================================
// MANAGER AUTHENTICATION & RBAC (Multi-tenancy Hierarchy)
// ==========================================
export type ManagerRole = 
  | 'director'         // Директор - владеет всеми разрешениями и назначает права
  | 'developer'        // Разработчик / администратор
  | 'auditor'          // Аудитор
  | 'manager'          // Управляющий
  | 'quality_control'  // Контроль качества
  | 'owner'            // Алиас директора
  | 'regional_manager' // Региональный управляющий
  | 'tech_admin'       // Системный администратор
  | 'app_admin';       // Администратор платформы (видит все юр. лица, редактирует тарифы)

// Роли внутри команды управления платформой
export type PlatformAdminRole = 
  | 'app_admin'       // Главный администратор (Root/Super Admin)
  | 'support_lead'    // Руководитель / инженер техподдержки
  | 'billing_admin'   // Финансовый и биллинг-администратор
  | 'tech_admin';     // Инженер платформенной инфраструктуры (YDB, S3, логи)

export interface PlatformAdminUser {
  id: string;
  login: string;
  name: string;
  role: PlatformAdminRole;
  roleTitle: string;
  email: string;
  phone?: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  notes?: string;
  avatarUrl?: string;
}

export interface UserPermissions {
  canEditTemplates: boolean;
  canManagePoints: boolean;
  canManageStaff: boolean;
  canViewFinances: boolean;
  canViewBiDataLens: boolean;
  canAccessCloudInfrastructure: boolean;
  canAuditSubmissions: boolean;
  canManagePermissions?: boolean; // Только Директор
}

export interface ManagerUser {
  id: string;
  login: string;
  email: string;
  name: string;
  role: ManagerRole;
  roleTitle: string;
  avatarUrl: string;
  assignedPoints: string[]; // ["all"] or specific point IDs
  phone?: string;
  token?: string;
  lastLoginAt?: string;
  organizationId?: string;
  organizationName?: string;
  organizationInn?: string;
  organizationIds?: string[]; // Список доступных юр. лиц (для пользователей с доступом к нескольким)
  permissions?: UserPermissions;
}

export interface ManagerAuthState {
  isAuthenticated: boolean;
  currentUser: ManagerUser | null;
}

// ==========================================
// LEGAL ENTITY (ИП / ООО) & MULTI-TENANCY BILLING
// ==========================================
export type LegalEntityType = 'IP' | 'OOO';

export type TariffPlanId = 'start' | 'business' | 'enterprise' | string;

export interface TariffPlan {
  id: TariffPlanId;
  name: string;
  badge?: string;
  description?: string;
  priceMonthly: number;
  priceMonthlyRub?: number;
  pointsLimit: number; // 1, 5, 9999
  staffLimit: number; // 5, 20, 9999
  storageMbLimit: number; // 5000, 25000, 100000
  submissionsMonthlyLimit?: number; // 500, 5000, 99999
  features: string[];
  isPopular?: boolean;
}

export interface BillingInvoice {
  id: string;
  number: string; // e.g. "СЧ-2026-0042"
  date: string;
  organizationName: string;
  inn: string;
  tariffName: string;
  months: number;
  totalAmountRub: number;
  status: 'paid' | 'pending' | 'cancelled';
  paymentMethod: 'invoice_bank' | 'card' | 'sbp';
  downloadUrl?: string;
}

export interface CompanyOrganization {
  id: string;
  legalType: LegalEntityType;
  name: string; // e.g. "ИП Смирнов А.В." or 'ООО "Кофейный Холдинг"'
  brandName: string; // e.g. "Coffee Point"
  inn: string; // 10 or 12 digits
  ogrn: string; // OGRN or OGRNIP
  directorName: string; // ФИО руководителя
  generalDirector?: string; // alias
  email: string;
  phone: string;
  address: string;
  legalAddress?: string; // alias
  bankName?: string;
  bankBik?: string;
  bankAccount?: string;
  corrAccount?: string;
  currentTariffId: TariffPlanId;
  tariffStatus: 'active' | 'trial' | 'past_due';
  tariffRenewalDate: string;
  createdAt: string;
  balanceRub: number;
  pointsCount?: number;
  staffCount?: number;
  ydbConfig?: YdbConfig;
}

// ==========================================
// MINIO S3 (VPS) STORAGE CONFIGURATION
// ==========================================
export interface MinioConfig {
  endpoint: string; // e.g. "https://s3.horeca-network.ru" or "http://194.87.142.50:9000"
  port: number;
  bucket: string;
  useSsl: boolean;
  accessKey: string;
  secretKey: string;
  publicUrlPrefix: string; // e.g. "https://s3.horeca-network.ru/horeca-checklist-photos"
  region: string;
  autoCompressWebP: boolean;
  maxUploadSizeBytes: number;
  isConnected: boolean;
}

export interface MinioBucketFile {
  name: string;
  sizeBytes: number;
  lastModified: string;
  etag: string;
  url: string;
  pointName?: string;
  checklistNumber?: string;
  contentType: string;
}

// ==========================================
// YANDEX SERVERLESS CONTAINERS CONFIGURATION
// ==========================================
export interface YandexServerlessConfig {
  cloudFolderId: string;
  containerRegistryId: string;
  containerName: string;
  imageTag: string;
  serviceAccountId: string;
  cores: number;
  memoryMb: number;
  concurrency: number;
  executionTimeoutSeconds: number;
  minInstances: number;
  maxInstances: number;
  customDomain: string;
  certificateId: string;
  apiGatewayName: string;
}

// ==========================================
// MANAGED SERVICE FOR YDB CONFIGURATION
// ==========================================
export interface YdbConfig {
  endpoint: string; // e.g. "grpcs://ydb.serverless.yandexcloud.net:2135"
  database: string; // e.g. "/ru-central1/b1g47v4m948a3l.../etn1k3..."
  authType: 'service_account_key' | 'iam_token' | 'anonymous' | 'oauth';
  serviceAccountKeyJson: string;
  iamToken?: string;
  serverlessTier: boolean;
  ruConsumedTotal: number;
  storageMbUsed: number;
  storageMbLimit: number;
  isConnected: boolean;
  lastPingMs: number;
  isEmulator?: boolean;
  isEmulatorDisabled?: boolean;
  customConfigured?: boolean;
  statusMessage?: string;
}

export interface CleanStartOptions {
  organizationName?: string;
  brandName?: string;
  inn?: string;
  directorName?: string;
  email?: string;
  phone?: string;
  legalType?: LegalEntityType;
  disableEmulator?: boolean;
  clearSubmissions: boolean;
  clearLocationsAndStaff: boolean;
  clearProfiles: boolean;
  clearYdbConfigs: boolean;
  resetTemplates?: boolean;
}

export interface YdbQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  stats?: {
    durationMs: number;
    requestUnits: number;
    rowsAffected?: number;
  };
  error?: string;
}

// ==========================================
// YANDEX DATALENS REPORTING
// ==========================================
export interface DataLensConfig {
  embedUrl: string;
  dashboardTitle: string;
  lastSyncTimestamp: string;
  datasetName: string;
  yqlSourceQuery: string;
  refreshIntervalSeconds: number;
  activePreset: 'matrix' | 'violations' | 'timeliness' | 'staff_rating';
}

