# CheckList-1С

Сервис автоматизации контроля качества, операционных проверок и фотоотчётов для HoReCa  
(Yandex Serverless Containers + Managed YDB + MinIO + DataLens + Telegram).

## Local

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

Production-like local:

```bash
npm run build
PORT=8080 npm start
curl localhost:8080/health
```

## TEST deploy (Yandex Cloud)

См. **[deploy/test/README.md](deploy/test/README.md)**.

```bash
cp deploy/test/env.example deploy/test/.env.test
# fill YC_* and YDB_*
npm run deploy:test
```

## Stack

- React 19 + TypeScript + Vite + Tailwind
- Express (`server.js`) for SPA + `/api/query` proxy
- YDB Cloud Function (`ydb-function/`)
- Docker → Yandex Serverless Containers
