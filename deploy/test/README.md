# TEST deploy — CheckList-1С (Yandex Cloud)

Целевой контур для **тестового** деплоя webapp:

| Компонент | Сервис Yandex Cloud |
|---|---|
| Webapp (SPA + Express) | **Serverless Containers** |
| YDB proxy | **Cloud Functions** |
| Образ | **Container Registry** |

> Секреты **не** коммитятся. Старые скрипты `deploy-final.sh` / `fix-port-and-deploy.sh` содержат hardcoded secrets — **не использовать** для новых выкладок.

## 0. Prerequisites

- `yc` CLI залогинен (`yc config list`)
- Docker (buildx / linux/amd64)
- `jq`, `curl`, `zip`, `npm`
- Folder, Registry, Service Account с ролями:
  - `container-registry.images.pusher`
  - `serverless.containers.editor` / `serverless.functions.editor`
  - `ydb.editor` (для function SA)
  - `iam.serviceAccounts.user` (при необходимости)

## 1. Env

```bash
cp deploy/test/env.example deploy/test/.env.test
# заполнить YC_FOLDER_ID, YC_REGISTRY_ID, YC_SERVICE_ACCOUNT_ID, YDB_*
```

## 2. (Опционально) YDB function

```bash
npm run deploy:test:ydb
# скопировать выданный YDB_FUNCTION_URL в .env.test
```

## 3. Webapp: build + push + deploy

```bash
npm run deploy:test
# или по шагам:
npm run deploy:test:build
npm run deploy:test:webapp
npm run deploy:test:smoke
```

## 4. Локальная проверка server + proxy

```bash
npm run build
YDB_FUNCTION_URL=https://functions.yandexcloud.net/<id> PORT=8080 npm start
curl -s localhost:8080/health | jq .
curl -s -X POST localhost:8080/api/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"SELECT 1 AS value;","orgType":"admin"}' | jq .
```

## Архитектура test

```
Browser
  → Serverless Container (Express: static dist + POST /api/query)
      → Cloud Function (YDB proxy)
          → Managed YDB (admin / client)
```

## Важно для test

- `allow-unauthenticated-invoke` включён **только для test**.
- `ALLOW_UNAUTH_API=true` — без JWT на `/api/query` (закрыть перед prod).
- MinIO secrets только через `.env.test` / Lockbox, не в git.
