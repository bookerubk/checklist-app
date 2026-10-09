#!/usr/bin/env bash
# DEPRECATED: use deploy/test/*.sh — this file hardcodes secrets. Do not run in production.
# See deploy/test/README.md

export PATH="$HOME/yandex-cloud/bin:$PATH"

set -e

# Получаем имя реестра
REGISTRY_NAME=$(yc container registry get crpetnihee6bqjluljac --format json | jq -r '.name')
echo "Имя реестра: $REGISTRY_NAME"

# Формируем правильный URL образа
IMAGE_URL="cr.yandex/${REGISTRY_NAME}/horeca-registry:v1.0.0"
echo "URL образа: $IMAGE_URL"

echo "=== 1. Проверка образа в реестре ==="
yc container image list --registry-id crpetnihee6bqjluljac

echo "=== 2. Создание Serverless Container ==="
if ! yc serverless container get horeca-registry 2>/dev/null; then
    echo "Создание контейнера..."
    yc serverless container create --name horeca-registry --folder-id b1g6c81os6pfvgmgnfbf
else
    echo "Контейнер уже существует"
fi

echo "=== 3. Развертывание ревизии ==="
yc serverless container revision deploy \
  --container-name "horeca-registry" \
  --folder-id "b1g6c81os6pfvgmgnfbf" \
  --image "$IMAGE_URL" \
  --cores 1 \
  --memory "512MB" \
  --concurrency 8 \
  --execution-timeout "30s" \
  --service-account-id "aje02v8uia45asfsnmvj" \
  --min-instances 0 \
  --environment "NODE_ENV=production" \
  --environment "YDB_ENDPOINT=grpcs://ydb.serverless.yandexcloud.net:2135" \
  --environment "YDB_DATABASE=/ru-central1/b1g6c81os6pfvgmgnfbf/etn_horeca_db" \
  --environment "MINIO_ENDPOINT=https://s3.checklist.affiline.ru" \
  --environment "MINIO_PORT=443" \
  --environment "MINIO_BUCKET=horeca-checklist-photos" \
  --environment "MINIO_ACCESS_KEY=admin" \
  --environment "MINIO_SECRET_KEY=minioQW28" \
  --environment "MINIO_USE_SSL=true" \
  --environment "MINIO_PUBLIC_URL=https://s3.checklist.affiline.ru/horeca-checklist-photos" \
  --environment "S3_ENDPOINT=https://s3.checklist.affiline.ru" \
  --environment "S3_BUCKET=horeca-checklist-photos" \
  --environment "S3_ACCESS_KEY=admin" \
  --environment "S3_SECRET_KEY=minioQW28"

echo "=== 4. Открытие публичного доступа ==="
yc serverless container allow-unauthenticated-invoke "horeca-registry"

echo "=== 5. Информация о контейнере ==="
yc serverless container get horeca-registry

CONTAINER_URL=$(yc serverless container get horeca-registry --format json | jq -r '.url')
echo ""
echo "========================================="
echo "✅ Контейнер успешно развернут!"
echo "========================================="
echo "🔗 URL: $CONTAINER_URL"
echo "========================================="
