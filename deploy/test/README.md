# TEST deploy — Cloud Functions only

| Компонент | Сервис |
|---|---|
| Webapp (SPA + `/api/query`) | Cloud Function `webapp-function/` |
| YDB proxy | Cloud Function `ydb-function/` |
| Пакеты > 3.5 MB | **Object Storage** (`CF_PACKAGE_BUCKET`) |
| Публичный URL | API Gateway (опц.) |

## Лимит 3.5 MB

Прямой `--source-path` в `yc serverless function version create` принимает zip **≤ 3.5 MB**.  
YDB SDK (`@ydbjs/*` + protobuf) почти всегда больше → скрипт:

1. пакует zip  
2. если size > 3.5MB → upload в `s3://$CF_PACKAGE_BUCKET/...`  
3. создаёт version с `--package-bucket-name` + `--package-object-name`

## 1. Env

```bash
cp deploy/test/env.example deploy/test/.env.test
```

Обязательно:

```bash
YC_FOLDER_ID=...
YC_SERVICE_ACCOUNT_ID=...
CF_PACKAGE_BUCKET=checklist-cf-packages-test   # имя bucket (латиница, уникально в облаке)

ADMIN_YDB_ENDPOINT=...
ADMIN_YDB_DATABASE=...
CLIENT_YDB_ENDPOINT=...
CLIENT_YDB_DATABASE=...
```

Роли SA (folder):

- `serverless.functions.admin` (или editor)
- `storage.editor` (или uploader + создание bucket)
- `ydb.editor` / доступ к базам
- `iam.serviceAccounts.user` (invoke as SA при API GW)

Один раз вручную (если auto-create запрещён политикой):

```bash
yc storage bucket create \
  --name checklist-cf-packages-test \
  --folder-id "$YC_FOLDER_ID"
```

## 2. Deploy YDB

```bash
npm run deploy:test:ydb
# → URL; допишите в .env.test:
# YDB_FUNCTION_URL=https://functions.yandexcloud.net/<id>
```

## 3. Deploy webapp

```bash
npm run deploy:test:webapp
npm run deploy:test:apigw   # optional
npm run deploy:test:smoke
```

Или всё: `npm run deploy:test`

## Local

```bash
npm run build && npm start   # Express — только локально
```
