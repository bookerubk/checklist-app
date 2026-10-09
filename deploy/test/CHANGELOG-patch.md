# Patch: test deploy on YCF (Yandex Cloud serverless)

## Changes

1. **server.js** — health, SPA fallback, **POST /api/query** proxy to `YDB_FUNCTION_URL`
2. **Dockerfile** — multi-stage `npm ci`, `PORT=8080`, non-root `USER node`, build args
3. **deploy/test/** — env-driven build/push/deploy/smoke without secrets in repo
4. **package.json** — `start`, `deploy:test*` scripts; fix `clean` (no longer deletes server.js)
5. **.gitignore** — ignore `.env.test` and secrets
6. Removed junk files `--folder-id`, `--limit`, `--resource-ids`
7. Legacy scripts with hardcoded MinIO keys left in place but **deprecated**

## How to apply on another clone

```bash
# if you have this tree as a branch/commit — merge it
# or copy files:
#   server.js, Dockerfile, package.json, .gitignore, .env.example
#   deploy/test/*
#   public/.gitkeep
```
