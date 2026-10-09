# Fix: белый экран SPA (static assets → HTML)

## Причина

Yandex API Gateway (default event format):

| Поле | Значение |
|------|----------|
| `event.path` | путь из **OpenAPI-спеки** (`/{path+}`), не URL |
| `event.url` | **реальный** путь запроса (`/assets/index-….js`) |
| `event.pathParams.path` | захваченный `{path+}` |

Handler брал `event.path` первым → всегда `/{path+}` → файл не найден → SPA fallback на `index.html` → браузер получал HTML вместо JS/CSS → **белый экран**.

Smoke проверял только `GET / → 200`, поэтому баг не ловился.

## Исправления

1. `webapp-function/index.js` — `resolveRequestPath()`: url / pathParams → path; без SPA-fallback для `/assets/*`
2. `deploy/test/smoke.sh` — проверка JS/CSS: не HTML, правильный Content-Type, размер
3. `deploy/test/pack-webapp-fn.sh` — отказ если в zip нет `dist/assets/*.js`
4. `deploy/test/deploy-apigw.sh` — пишет `.last-gateway-url`

## Apply на VPS

```bash
# скопировать каталог spa-static-fix/ на VPS, затем:
cd /path/to/spa-static-fix
bash APPLY.sh /opt/checklist-app

cd /opt/checklist-app
npm run deploy:test:webapp
# или npm run deploy:test
```

## Проверка

```bash
GW=https://d5dqcq6t9nvg73pjbn0k.s183zexc.apigw.yandexcloud.net
curl -sS "$GW/" | head -5
JS=$(curl -sS "$GW/" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -1)
curl -sI "$GW$JS" | tr -d '\r' | grep -i content-type
# expect: application/javascript
curl -sS "$GW$JS" | head -c 40; echo
# expect: NOT <!doctype html>
```
