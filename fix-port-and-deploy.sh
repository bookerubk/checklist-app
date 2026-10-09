#!/usr/bin/env bash
# DEPRECATED: use deploy/test/*.sh — this file hardcodes secrets. Do not run in production.
# See deploy/test/README.md

export PATH="$HOME/yandex-cloud/bin:$PATH"
export DOCKER_CONTENT_TRUST=0

set -e

echo "=== 1. Исправление server.js ==="
# Если server.js существует, меняем порт
if [ -f "server.js" ]; then
    sed -i 's/PORT.*3000/PORT=8080/g' server.js
    echo "server.js исправлен"
else
    echo "server.js не найден, проверьте точку входа"
fi

echo ""
echo "=== 2. Пересборка образа с портом 8080 ==="
docker build --platform linux/amd64 -t cr.yandex/crpetnihee6bqjluljac/horeca-registry:v1.0.0 .

echo ""
echo "=== 3. Отправка образа в реестр ==="
docker push cr.yandex/crpetnihee6bqjluljac/horeca-registry:v1.0.0

echo ""
echo "=== 4. Удаление старого контейнера ==="
yc serverless container delete --name horeca-registry --folder-id b1g6c81os6pfvgmgnfbf 2>/dev/null || echo "Контейнер не найден"

echo ""
echo "=== 5. Создание нового контейнера ==="
yc serverless container create \
    --name horeca-registry \
    --folder-id b1g6c81os6pfvgmgnfbf

echo ""
echo "=== 6. Развертывание ревизии с PORT=8080 ==="
yc serverless container revision deploy \
    --container-name "horeca-registry" \
    --folder-id "b1g6c81os6pfvgmgnfbf" \
    --image "cr.yandex/crpetnihee6bqjluljac/horeca-registry:v1.0.0" \
    --cores 1 \
    --memory "512MB" \
    --concurrency 8 \
    --execution-timeout "30s" \
    --service-account-id "aje02v8uia45asfsnmvj" \
    --min-instances 0 \
    --environment "NODE_ENV=production" \
    --environment "PORT=8080" \
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

echo ""
echo "=== 7. Открытие публичного доступа ==="
yc serverless container allow-unauthenticated-invoke "horeca-registry"

echo ""
echo "=== 8. Получение URL ==="
CONTAINER_URL=$(yc serverless container get horeca-registry --folder-id b1g6c81os6pfvgmgnfbf --format json | jq -r '.url')
echo "🔗 URL: $CONTAINER_URL"

echo ""
echo "=== 9. Проверка доступности ==="
sleep 5
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" $CONTAINER_URL

echo ""
echo "========================================="
echo "✅ Контейнер развернут с портом 8080!"
echo "========================================="
echo "URL: $CONTAINER_URL"
echo "========================================="
