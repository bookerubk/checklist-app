#!/usr/bin/env bash
# DEPRECATED: use deploy/test/*.sh — this file hardcodes secrets. Do not run in production.
# See deploy/test/README.md

export PATH="$HOME/yandex-cloud/bin:$PATH"

CONTAINER_URL="https://bbaf6nvecko67tm9oova.containers.yandexcloud.net/"

echo "=== 1. Статус контейнера ==="
yc serverless container get horeca-registry

echo ""
echo "=== 2. Ревизии ==="
yc serverless container revision list --container-name horeca-registry

echo ""
echo "=== 3. Проверка доступности ==="
echo "URL: $CONTAINER_URL"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" $CONTAINER_URL

echo ""
echo "=== 4. Логи за последние 10 минут ==="
yc logging read --container-name horeca-registry --since 10m --limit 20

echo ""
echo "=== 5. Проверка ошибок в логах ==="
yc logging read --container-name horeca-registry --since 30m --limit 50 | grep -i "error\|fail\|exception" || echo "Ошибок не найдено"
