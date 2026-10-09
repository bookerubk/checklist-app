/**
 * CheckList-1С webapp server
 * Yandex Cloud Serverless Containers / local test (PORT=8080)
 *
 * - static SPA from dist/
 * - /health, /api/health
 * - POST /api/query  → proxy to YDB Cloud Function (YDB_FUNCTION_URL)
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_ENV = process.env.APP_ENV || NODE_ENV;
const YDB_FUNCTION_URL = (process.env.YDB_FUNCTION_URL || '').replace(/\/$/, '');
const YDB_PROXY_TIMEOUT_MS = Number(process.env.YDB_PROXY_TIMEOUT_MS) || 25000;
const ALLOW_UNAUTH_API = process.env.ALLOW_UNAUTH_API !== 'false'; // test default: open

app.disable('x-powered-by');
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));

// Lightweight request log (test-friendly)
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') return next();
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'http',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - start,
        env: APP_ENV,
      })
    );
  });
  next();
});

// --- Health ---
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'checklist-webapp',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    appEnv: APP_ENV,
    ydbProxy: Boolean(YDB_FUNCTION_URL),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ydbFunctionConfigured: Boolean(YDB_FUNCTION_URL),
  });
});

// --- YDB proxy: frontend calls POST /api/query ---
app.post('/api/query', async (req, res) => {
  if (!YDB_FUNCTION_URL) {
    return res.status(503).json({
      error:
        'YDB_FUNCTION_URL is not set. Configure Cloud Function URL for test/prod deploy.',
      columns: [],
      rows: [],
    });
  }

  if (!ALLOW_UNAUTH_API && !req.headers.authorization) {
    return res.status(401).json({
      error: 'Unauthorized',
      columns: [],
      rows: [],
    });
  }

  const body = req.body || {};
  if (!body.query || typeof body.query !== 'string') {
    return res.status(400).json({
      error: 'Missing "query" field in request body',
      columns: [],
      rows: [],
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), YDB_PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(YDB_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization
          ? { Authorization: req.headers.authorization }
          : {}),
      },
      body: JSON.stringify({
        query: body.query,
        orgType: body.orgType || 'client',
        params: body.params || {},
      }),
      signal: controller.signal,
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || `Upstream HTTP ${upstream.status}` };
    }

    // Cloud Function returns { statusCode, body } when invoked via API Gateway
    // or direct JSON when using HTTP invoke URL body.
    if (data && typeof data.body === 'string' && data.statusCode) {
      try {
        data = JSON.parse(data.body);
      } catch {
        /* keep as is */
      }
    }

    const status = upstream.ok ? 200 : upstream.status || 502;
    return res.status(status).json({
      columns: data.columns || [],
      rows: data.rows || [],
      error: data.error,
      stats: data.stats,
      success: data.success,
    });
  } catch (err) {
    const message =
      err?.name === 'AbortError'
        ? `YDB proxy timeout after ${YDB_PROXY_TIMEOUT_MS}ms`
        : err?.message || 'YDB proxy failed';
    console.error(
      JSON.stringify({ level: 'error', msg: 'ydb_proxy', error: message })
    );
    return res.status(502).json({
      error: message,
      columns: [],
      rows: [],
    });
  } finally {
    clearTimeout(timer);
  }
});

// Static assets
const distDir = path.join(__dirname, 'dist');
app.use(
  express.static(distDir, {
    index: false,
    maxAge: NODE_ENV === 'production' ? '1h' : 0,
  })
);

// SPA fallback (Express 4: avoid '*' path-to-regexp issues)
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) {
      res.status(500).json({
        error: 'SPA index.html not found. Run npm run build first.',
      });
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'server_start',
      port: PORT,
      env: NODE_ENV,
      appEnv: APP_ENV,
      dist: distDir,
      ydbProxy: Boolean(YDB_FUNCTION_URL),
    })
  );
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
