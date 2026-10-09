#!/bin/bash

export PATH="$HOME/yandex-cloud/bin:$PATH"
set -e

echo "=== 1. Проверка существующих групп логов ==="
yc logging group list --folder-id b1g6c81os6pfvgmgnfbf

echo ""
echo "=== 2. Создание группы логов ==="
if ! yc logging group get horeca-logs --folder-id b1g6c81os6pfvgmgnfbf 2>/dev/null; then
    yc logging group create \
        --name horeca-logs \
        --folder-id b1g6c81os6pfvgmgnfbf \
        --retention-period 72h
else
    echo "Группа логов уже существует"
fi

LOG_GROUP_ID=$(yc logging group get horeca-logs --folder-id b1g6c81os6pfvgmgnfbf --format json | jq -r '.id')
echo "LOG_GROUP_ID: $LOG_GROUP_ID"

echo ""
echo "=== 3. Настройка контейнера ==="
yc serverless container update horeca-registry \
    --log-group-id $LOG_GROUP_ID \
    --folder-id b1g6c81os6pfvgmgnfbf

echo ""
echo "=== 4. Переразвертывание ревизии ==="
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
echo "=== 5. Проверка логов ==="
sleep 10
yc logging read --group-id $LOG_GROUP_ID --since 1m --limit 20

echo ""
echo "========================================="
echo "✅ Логирование настроено!"
echo "========================================="
echo "Группа логов: horeca-logs"
echo "ID группы: $LOG_GROUP_ID"
echo ""
echo "Для просмотра логов используйте:"
echo "yc logging read --group-id $LOG_GROUP_ID --since 10m --limit 50"
echo "========================================="
