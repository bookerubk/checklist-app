/**
 * CheckList-1С — Webapp as Yandex Cloud Function (HTTP)
 *
 * - GET  /*           → static SPA from ./dist
 * - GET  /health      → health JSON
 * - POST /api/query   → proxy to YDB_FUNCTION_URL (or inline if YDB_* set and USE_INLINE_YDB=1)
 *
 * No Serverless Containers. PORT listen not used.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const YDB_FUNCTION_URL = (process.env.YDB_FUNCTION_URL || '').replace(/\/$/, '');
const YDB_PROXY_TIMEOUT_MS = Number(process.env.YDB_PROXY_TIMEOUT_MS) || 25000;
const ALLOW_UNAUTH_API = process.env.ALLOW_UNAUTH_API !== 'false';
const APP_ENV = process.env.APP_ENV || 'test';
const CACHE_MAX_AGE = process.env.STATIC_CACHE_MAX_AGE || '3600';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(statusCode, obj, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...extraHeaders,
    },
    body: JSON.stringify(obj),
  };
}

function normalizePath(raw) {
  let p = raw || '/';
  try {
    // API Gateway may pass full URL
    if (p.startsWith('http')) {
      p = new URL(p).pathname;
    }
  } catch (_) {}
  // strip query
  const q = p.indexOf('?');
  if (q !== -1) p = p.slice(0, q);
  if (!p.startsWith('/')) p = '/' + p;
  // prevent path traversal
  p = path.posix.normalize(p);
  if (p.includes('..')) p = '/';
  return p;
}

function parseBody(event) {
  if (event.body == null || event.body === '') return {};
  let raw = event.body;
  if (event.isBase64Encoded) {
    raw = Buffer.from(raw, 'base64').toString('utf8');
  }
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

function getHeader(event, name) {
  const h = event.headers || {};
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(h)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function safeJoinDist(urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  const full = path.normalize(path.join(DIST, rel));
  if (!full.startsWith(DIST)) return null;
  return full;
}

function serveStatic(urlPath) {
  let filePath = safeJoinDist(urlPath);
  if (!filePath) {
    return json(400, { error: 'Invalid path' });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback
    filePath = path.join(DIST, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    return json(500, {
      error: 'dist/ not packaged. Build SPA and run pack-webapp-fn.sh',
    });
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = fs.readFileSync(filePath);
  const isText =
    mime.startsWith('text/') ||
    mime.includes('javascript') ||
    mime.includes('json') ||
    mime.includes('svg') ||
    mime.includes('xml');

  const headers = {
    'Content-Type': mime,
    ...corsHeaders(),
  };

  // cache hashed assets; no-cache HTML
  if (ext === '.html') {
    headers['Cache-Control'] = 'no-cache';
  } else if (urlPath.includes('/assets/')) {
    headers['Cache-Control'] = `public, max-age=${CACHE_MAX_AGE}, immutable`;
  } else {
    headers['Cache-Control'] = `public, max-age=${CACHE_MAX_AGE}`;
  }

  if (isText) {
    return {
      statusCode: 200,
      headers,
      body: buf.toString('utf8'),
    };
  }

  return {
    statusCode: 200,
    headers,
    isBase64Encoded: true,
    body: buf.toString('base64'),
  };
}

async function proxyYdb(event) {
  if (!YDB_FUNCTION_URL) {
    return json(503, {
      error:
        'YDB_FUNCTION_URL is not set on webapp function. Deploy ydb-function and set env.',
      columns: [],
      rows: [],
    });
  }

  if (!ALLOW_UNAUTH_API && !getHeader(event, 'authorization')) {
    return json(401, { error: 'Unauthorized', columns: [], rows: [] });
  }

  const body = parseBody(event);
  if (!body.query || typeof body.query !== 'string') {
    return json(400, {
      error: 'Missing "query" field in request body',
      columns: [],
      rows: [],
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), YDB_PROXY_TIMEOUT_MS);

  try {
    // Node 18+ global fetch on CF runtime
    const upstream = await fetch(YDB_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getHeader(event, 'authorization')
          ? { Authorization: getHeader(event, 'authorization') }
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

    // nested CF/API Gateway envelope
    if (data && typeof data.body === 'string' && data.statusCode) {
      try {
        data = JSON.parse(data.body);
      } catch (_) {}
    }

    return json(upstream.ok ? 200 : upstream.status || 502, {
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
    console.error(JSON.stringify({ level: 'error', msg: 'ydb_proxy', error: message }));
    return json(502, { error: message, columns: [], rows: [] });
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async function handler(event, context) {
  const method = (
    event.httpMethod ||
    event.requestContext?.httpMethod ||
    event.requestContext?.http?.method ||
    'GET'
  ).toUpperCase();

  const urlPath = normalizePath(
    event.path ||
      event.url ||
      event.requestContext?.http?.path ||
      event.params?.path ||
      '/'
  );

  // API Gateway may strip prefix — support rawPath
  const rawPath = normalizePath(event.rawPath || urlPath);

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'request',
      method,
      path: rawPath,
      requestId: context?.requestId,
      env: APP_ENV,
    })
  );

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (rawPath === '/health' || rawPath === '/api/health') {
    return json(200, {
      status: 'ok',
      service: 'checklist-webapp-cf',
      runtime: 'cloud-function',
      timestamp: new Date().toISOString(),
      appEnv: APP_ENV,
      ydbProxy: Boolean(YDB_FUNCTION_URL),
      requestId: context?.requestId,
    });
  }

  if (rawPath === '/api/query' && method === 'POST') {
    return proxyYdb(event);
  }

  if (method === 'GET' || method === 'HEAD') {
    const res = serveStatic(rawPath);
    if (method === 'HEAD') {
      return { ...res, body: '' };
    }
    return res;
  }

  return json(405, { error: `Method ${method} not allowed` });
};
