# TEST deploy — Cloud Functions only

| Компонент | Сервис |
|---|---|
| Webapp (SPA + `/api/query`) | **Yandex** Cloud Function `webapp-function/` |
| YDB proxy | **Yandex** Cloud Function `ydb-function/` |
| Пакеты > 3.5 MB | **Yandex** Object Storage (`CF_PACKAGE_BUCKET`) |
| Публичный URL | **cloud.ru Evolution API Gateway** (по умолчанию) или Yandex API Gateway |

```
Browser
  → Evolution API Gateway (cloud.ru)   *.apigw.cloud.ru
      → HTTP proxy
          → Yandex Cloud Function: webapp
                POST /api/query → Yandex CF: ydb-proxy → Managed YDB
```

## API Gateway: cloud.ru Evolution (default)

Functions остаются в Yandex. Шлюз — HTTP-прокси на публичный URL CF:

`https://functions.yandexcloud.net/<WEBAPP_FN_ID>/...`

### 1. Env

```bash
cp deploy/test/env.example deploy/test/.env.test
# YC_FOLDER_ID, YC_SERVICE_ACCOUNT_ID, YDB_*, CF_PACKAGE_BUCKET
# APIGW_PROVIDER=cloudru   # default
```

### 2. Deploy Functions (Yandex)

```bash
npm run deploy:test:ydb      # → YDB_FUNCTION_URL в .env.test
npm run deploy:test:webapp   # → .last-webapp-id / .last-webapp-url
```

### 3. Сгенерировать OpenAPI и создать шлюз в cloud.ru

```bash
npm run deploy:test:apigw
# → deploy/test/generated/api-gateway-cloudru-evolution.generated.yaml
```

В консоли **cloud.ru**:

1. **Разработка → API Gateway → Создать API-шлюз**
2. Имя: `checklist-webapp-test-gw` (или `APIGW_NAME`)
3. Загрузить сгенерированный YAML
4. Создать

Если catch-all `/{path}` не создал wildcard-правило — вручную:

- правило «Маршрутизация запросов»
- URI proxy: `/*`
- upstream: `https://functions.yandexcloud.net`
- path rewrite: `/{WEBAPP_FN_ID}$uri` (id из `.last-webapp-id`)

### 4. Зафиксировать URL шлюза и smoke

```bash
echo 'https://XXXX.apigw.cloud.ru' > deploy/test/.last-gateway-url
npm run deploy:test:smoke
```

Пока шлюз не готов — smoke на CF напрямую:

```bash
BASE_URL=$(cat deploy/test/.last-webapp-url) npm run deploy:test:smoke
```

## Legacy: Yandex API Gateway

```bash
# в .env.test
APIGW_PROVIDER=yandex
npm run deploy:test:apigw
```

Использует `api-gateway-test.yaml` + `yc serverless api-gateway`.

## Лимит 3.5 MB

Прямой `--source-path` в `yc serverless function version create` принимает zip **≤ 3.5 MB**.  
YDB SDK почти всегда больше → `cf-package-source.sh` грузит в Object Storage.

## Auth (test)

`allow-unauthenticated-invoke` + `ALLOW_UNAUTH_API=true` — **только test**.  
Перед prod: IAM, JWT, убрать public invoke у CF и настроить auth на шлюзе cloud.ru.
