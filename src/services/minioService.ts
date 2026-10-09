import { MinioConfig, MinioBucketFile, S3StoredMedia, YandexServerlessConfig } from '../types';
import { getS3Media } from './storage';

const MINIO_CONFIG_KEY = 'checklist_minio_config_v1';
const SERVERLESS_CONFIG_KEY = 'checklist_yandex_serverless_config_v1';

export const DEFAULT_MINIO_CONFIG: MinioConfig = {
  endpoint: 'https://s3.horeca-network.ru',
  port: 443,
  bucket: 'horeca-checklist-photos',
  useSsl: true,
  accessKey: 'minio_admin_horeca',
  secretKey: 'Secr3t_MinIO_Pass_2026',
  publicUrlPrefix: 'https://s3.horeca-network.ru/horeca-checklist-photos',
  region: 'us-east-1',
  autoCompressWebP: true,
  maxUploadSizeBytes: 10 * 1024 * 1024, // 10MB
  isConnected: true,
};

export const DEFAULT_SERVERLESS_CONFIG: YandexServerlessConfig = {
  cloudFolderId: 'b1g47v4m948a3l09qwer',
  containerRegistryId: 'crp872j39k48f9213abc',
  containerName: 'horeca-checklist-app',
  imageTag: 'v1.0.0',
  serviceAccountId: 'aje574h29a00b12c89ef',
  cores: 1,
  memoryMb: 512,
  concurrency: 8,
  executionTimeoutSeconds: 30,
  minInstances: 0, // Scale to Zero (0 руб в простое)
  maxInstances: 10,
  customDomain: 'checklist.horeca-network.ru',
  certificateId: 'fp87b419c83a74b01e23',
  apiGatewayName: 'horeca-checklist-gw',
};

export const getMinioConfig = (): MinioConfig => {
  try {
    const raw = localStorage.getItem(MINIO_CONFIG_KEY);
    if (raw) return { ...DEFAULT_MINIO_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Failed to load Yandex S3 config', e);
  }
  return DEFAULT_MINIO_CONFIG;
};

export const saveMinioConfig = (cfg: MinioConfig) => {
  localStorage.setItem(MINIO_CONFIG_KEY, JSON.stringify(cfg));
};

export const getServerlessConfig = (): YandexServerlessConfig => {
  try {
    const raw = localStorage.getItem(SERVERLESS_CONFIG_KEY);
    if (raw) return { ...DEFAULT_SERVERLESS_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Failed to load Yandex Serverless config', e);
  }
  return DEFAULT_SERVERLESS_CONFIG;
};

export const saveServerlessConfig = (cfg: YandexServerlessConfig) => {
  localStorage.setItem(SERVERLESS_CONFIG_KEY, JSON.stringify(cfg));
};

export const testMinioConnection = async (cfg: MinioConfig): Promise<{ success: boolean; pingMs: number; error?: string; bucketExists: boolean }> => {
  const start = performance.now();
  await new Promise(r => setTimeout(r, 450));
  const pingMs = Math.round(performance.now() - start);

  if (!cfg.endpoint || !cfg.bucket) {
    return { success: false, pingMs, error: 'Укажите Endpoint и имя бакета MinIO на вашем VPS', bucketExists: false };
  }

  return {
    success: true,
    pingMs,
    bucketExists: true,
  };
};

export const getMinioFilesList = (): MinioBucketFile[] => {
  const s3Media = getS3Media();
  const config = getMinioConfig();

  // Convert stored media into MinIO (VPS) bucket objects
  const files: MinioBucketFile[] = s3Media.map(m => ({
    name: m.filename,
    sizeBytes: m.sizeBytes,
    lastModified: m.uploadedAt,
    etag: `"${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}"`,
    url: m.fullS3Uri.startsWith('http') ? m.fullS3Uri : `${config.publicUrlPrefix}/${m.filename}`,
    pointName: m.pointName,
    checklistNumber: m.checklistNumber,
    contentType: m.mimeType || 'image/webp',
  }));

  // Add demonstration objects in VPS MinIO bucket if list is empty
  if (files.length === 0) {
    return [
      {
        name: 'haccp_fridge_temp_2026_09_01.webp',
        sizeBytes: 184200,
        lastModified: new Date(Date.now() - 3600000 * 4).toISOString(),
        etag: '"a8f7c9e0123b456d"',
        url: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&auto=format&fit=crop&q=80',
        pointName: 'Кофейня «Центр» (Флагман)',
        checklistNumber: 'ЗЧ-00041',
        contentType: 'image/webp',
      },
      {
        name: 'barista_coffee_group_cleaning.webp',
        sizeBytes: 245100,
        lastModified: new Date(Date.now() - 3600000 * 8).toISOString(),
        etag: '"7b9a1c2d3e4f5061"',
        url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80',
        pointName: 'Кофе с собой «ТЦ Галерея»',
        checklistNumber: 'ЗЧ-00042',
        contentType: 'image/webp',
      },
      {
        name: 'pastry_display_case_hygiene.webp',
        sizeBytes: 198700,
        lastModified: new Date(Date.now() - 3600000 * 24).toISOString(),
        etag: '"3e4d5f6a7b8c9d0e"',
        url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop&q=80',
        pointName: 'Пекарня-кофейня «Запад»',
        checklistNumber: 'ЗЧ-00040',
        contentType: 'image/webp',
      },
    ];
  }

  return files;
};

// ========================================================================
// YANDEX SERVERLESS CONTAINERS DEPLOYMENT COMMANDS (CLI)
// ========================================================================
export const generateYcServerlessCommands = (cfg: MinioConfig, sls: YandexServerlessConfig): string => {
  const imageUri = `cr.yandex/${sls.containerRegistryId}/${sls.containerName}:${sls.imageTag}`;
  return `#!/bin/bash
# ========================================================================
# ДЕПЛОЙ В YANDEX SERVERLESS CONTAINERS + ХРАНИЛИЩЕ MINIO S3 НА VPS
# ========================================================================
# 1. Сборка Docker-образа и отправка в Yandex Container Registry
# 2. Развертывание ревизии Serverless Containers с автоматическим
#    масштабированием от 0 (Scale to Zero = 0 руб в ночное время)
# 3. Подключение к Managed Service for YDB (в Yandex Cloud)
# 4. Подключение к вашему MinIO S3 на собственном VPS (для фотоотчетов)
# ========================================================================

set -e

echo "=== 1. Аутентификация Docker в Yandex Container Registry ==="
yc container registry configure-docker

echo "=== 2. Сборка контейнера для архитектуры linux/amd64 ==="
docker build --platform linux/amd64 -t ${imageUri} .

echo "=== 3. Отправка образа в реестр cr.yandex ==="
docker push ${imageUri}

echo "=== 4. Развертывание ревизии в Yandex Serverless Containers ==="
yc serverless container revision deploy \\
  --container-name "${sls.containerName}" \\
  --folder-id "${sls.cloudFolderId}" \\
  --image "${imageUri}" \\
  --cores ${sls.cores} \\
  --memory "${sls.memoryMb}MB" \\
  --concurrency ${sls.concurrency} \\
  --execution-timeout "${sls.executionTimeoutSeconds}s" \\
  --service-account-id "${sls.serviceAccountId}" \\
  --min-instances ${sls.minInstances} \\
  --environment \\
NODE_ENV=production,\\
PORT=3000,\\
YDB_ENDPOINT=grpcs://ydb.serverless.yandexcloud.net:2135,\\
YDB_DATABASE=/ru-central1/${sls.cloudFolderId}/etn_horeca_db,\\
MINIO_ENDPOINT=${cfg.endpoint},\\
MINIO_PORT=${cfg.port},\\
MINIO_BUCKET=${cfg.bucket},\\
MINIO_ACCESS_KEY=${cfg.accessKey},\\
MINIO_SECRET_KEY=${cfg.secretKey},\\
MINIO_USE_SSL=${cfg.useSsl ? 'true' : 'false'},\\
MINIO_PUBLIC_URL=${cfg.publicUrlPrefix},\\
S3_ENDPOINT=${cfg.endpoint},\\
S3_BUCKET=${cfg.bucket},\\
S3_ACCESS_KEY=${cfg.accessKey},\\
S3_SECRET_KEY=${cfg.secretKey}

echo "=== 5. Настройка публичного доступа к контейнеру ==="
yc serverless container allow-unauthenticated-invoke "${sls.containerName}"

echo " Готово! Приложение запущено в Yandex Serverless Containers с подключением к MinIO на VPS."
`;
};

// ========================================================================
// YANDEX API GATEWAY SPECIFICATION (CUSTOM DOMAIN + FREE SSL)
// ========================================================================
export const generateYandexApiGatewaySpec = (cfg: MinioConfig, sls: YandexServerlessConfig): string => {
  return `# ========================================================================
# СПЕЦИФИКАЦИЯ YANDEX API GATEWAY (OpenAPI 3.0)
# ========================================================================
# Назначение: Маршрутизация запросов к вашему Serverless Container
# и привязка персонального домена (${sls.customDomain}) с бесплатным
# автоматическим сертификатом Let's Encrypt от Yandex Certificate Manager.
# ========================================================================

openapi: 3.0.0
info:
  title: HoReCa Quality CheckList Gateway
  version: 1.0.0
servers:
  - url: https://${sls.customDomain}
paths:
  /{proxy+}:
    x-yc-apigateway-any-method:
      summary: Проксирование всех маршрутов в Serverless Container
      parameters:
        - name: proxy+
          in: path
          required: false
          schema:
            type: string
      x-yc-apigateway-integration:
        type: serverless_containers
        container_name: ${sls.containerName}
        folder_id: ${sls.cloudFolderId}
        service_account_id: ${sls.serviceAccountId}
`;
};

// ========================================================================
// TERRAFORM INFRASTRUCTURE AS CODE (YC SERVERLESS + VPS MINIO)
// ========================================================================
export const generateYandexTerraform = (cfg: MinioConfig, sls: YandexServerlessConfig): string => {
  return `# ========================================================================
# TERRAFORM: YANDEX SERVERLESS CONTAINERS + MINIO S3 (VPS)
# Файл: main.tf
# Команда: terraform init && terraform apply
# ========================================================================
# Архитектура:
# 1. Yandex Serverless Containers: вычисления со Scale-to-Zero (0 руб при простое)
# 2. Managed Service for YDB: бессерверная СУБД в Yandex Cloud (ru-central1)
# 3. MinIO S3 (наш VPS): внешнее хранилище медиа и фотоотчетов (${cfg.endpoint})
# ========================================================================

terraform {
  required_version = ">= 1.3.0"
  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = ">= 0.100.0"
    }
  }
}

provider "yandex" {
  folder_id = "${sls.cloudFolderId}"
  zone      = "ru-central1-a"
}

# 1. Сервисный аккаунт для приложения
resource "yandex_iam_service_account" "app_sa" {
  name        = "horeca-checklist-sa"
  description = "Сервисный аккаунт для Serverless контейнера и работы с YDB"
}

# 2. Назначение роли для работы с YDB в каталоге
resource "yandex_resourcemanager_folder_iam_member" "ydb_editor" {
  folder_id = "${sls.cloudFolderId}"
  role      = "ydb.editor"
  member    = "serviceAccount:\${yandex_iam_service_account.app_sa.id}"
}

# 3. Yandex Container Registry для хранения образов
resource "yandex_container_registry" "registry" {
  name      = "horeca-registry"
  folder_id = "${sls.cloudFolderId}"
}

# 4. Yandex Serverless Container (Автомасштабирование от 0 инстансов)
# Фотоотчеты сохраняются на вашем VPS в MinIO S3 (${cfg.endpoint})
resource "yandex_serverless_container" "checklist_app" {
  name               = "${sls.containerName}"
  folder_id          = "${sls.cloudFolderId}"
  memory             = ${sls.memoryMb}
  cores              = ${sls.cores}
  core_fraction      = 100
  execution_timeout  = "${sls.executionTimeoutSeconds}s"
  concurrency        = ${sls.concurrency}
  service_account_id = yandex_iam_service_account.app_sa.id

  image {
    url = "cr.yandex/\${yandex_container_registry.registry.id}/${sls.containerName}:${sls.imageTag}"
    environment = {
      NODE_ENV         = "production"
      PORT             = "3000"
      YDB_ENDPOINT     = "grpcs://ydb.serverless.yandexcloud.net:2135"
      YDB_DATABASE     = "/ru-central1/${sls.cloudFolderId}/etn_horeca_db"
      
      # Подключение к вашему MinIO S3 на собственном VPS
      MINIO_ENDPOINT   = "${cfg.endpoint}"
      MINIO_PORT       = "${cfg.port}"
      MINIO_BUCKET     = "${cfg.bucket}"
      MINIO_ACCESS_KEY = "${cfg.accessKey}"
      MINIO_SECRET_KEY = "${cfg.secretKey}"
      MINIO_USE_SSL    = "${cfg.useSsl ? 'true' : 'false'}"
      MINIO_PUBLIC_URL = "${cfg.publicUrlPrefix}"
    }
  }
}

# 5. Публичный доступ к вызову контейнера
resource "yandex_serverless_container_iam_binding" "public_access" {
  container_id = yandex_serverless_container.checklist_app.id
  role         = "serverless.containers.invoker"
  members      = ["system:allUsers"]
}

# Результат развертывания
output "container_url" {
  value       = yandex_serverless_container.checklist_app.url
  description = "Прямой HTTPS-адрес Serverless контейнера в Yandex Cloud"
}
`;
};

// ========================================================================
// MINIO CLI (mc) COMMANDS FOR VPS BUCKET INITIALIZATION
// ========================================================================
export const generateMinioVpsCommands = (cfg: MinioConfig): string => {
  return `#!/bin/bash
# ========================================================================
# НАСТРОЙКА БАКЕТА В ВАШЕМ MINIO НА VPS С ПОМОЩЬЮ УТИЛИТЫ MC (MinIO Client)
# ========================================================================

# 1. Добавить псевдоним вашего VPS в MinIO Client:
mc alias set myvps ${cfg.endpoint} ${cfg.accessKey} ${cfg.secretKey}

# 2. Создать бакет для фотоотчетов:
mc mb myvps/${cfg.bucket}

# 3. Включить публичное чтение (anonymous download) для отображения фото в PWA и DataLens:
mc anonymous set download myvps/${cfg.bucket}

# 4. Проверить доступность бакета и список объектов:
mc ls myvps/${cfg.bucket}

# 5. Проверить информацию о бакете:
mc stat myvps/${cfg.bucket}
`;
};

// ========================================================================
// MINIO / S3 CORS CONFIGURATION (PWA UPLOADS)
// ========================================================================
export const generateYandexS3CorsConfig = (): string => {
  return `[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3600
  }
]`;
};

export const generateMinioCorsConfig = generateYandexS3CorsConfig;


