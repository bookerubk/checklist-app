/**
 * Cloud Function: YDB Proxy
 *
 * Назначение: принимать YQL-запросы от фронтенда и выполнять их в YDB.
 * Поддерживает две базы:
 *   - 'admin'  — платформенная база (реестр организаций, тарифы, биллинг)
 *   - 'client' — база клиента (чек-листы, сотрудники, точки)
 *
 * Поддерживает безопасную передачу параметров (params) через @ydbjs/query.
 */

const { Driver } = require('@ydbjs/core');
const { query } = require('@ydbjs/query');
const { MetadataCredentialsProvider } = require('@ydbjs/auth/metadata');

// ВАЖНО: fromJs() из '@ydbjs/value' конвертирует ЛЮБОЕ JS number в Int32
// и голый null в "Null" (без Optional-обёртки). Наш DECLARE-блок при этом
// объявляет Int64/Double/"Utf8?" — из-за рассинхрона типов YDB падает
// с ERROR(1030): Type annotation. Поэтому типы строим явно, из тех же
// классов, что описывают DECLARE, а не полагаемся на автоинференс fromJs.
const { 
  Bool,
  Int32,
  Int64,
  Uint32,
  Uint64,
  Double,
  Text,
  TextType,
  JsonDocument,
 } = require('@ydbjs/value/primitive');
const { Optional } = require('@ydbjs/value/optional');

// Маппинг: имя параметра → точный YDB-тип.
// Если параметра нет в маппинге, используется Int64 (для целых) / Double (для дробных).
const PARAM_TYPE_HINTS = {
  // checklist_submissions
  violations_count: 'Uint32',
  s3_media_count: 'Uint32',
  total_items: 'Uint32',
  completed_items: 'Uint32',
  time_deviation_minutes: 'Int32',

  // pin_credentials
  failed_attempts: 'Uint32',

  // checklist_templates
  allowed_variance_minutes: 'Int32',

  // system_tariffs
  points_limit: 'Uint32',
  staff_limit: 'Uint32',
  storage_mb_limit: 'Uint32',
  submissions_limit: 'Uint32',

  // system_organizations
  points_count: 'Uint32',
  staff_count: 'Uint32',

  // system_tenant_metrics
  ru_consumed_total: 'Double',
  storage_mb_used: 'Double',
};

// Имена параметров, которые ВСЕГДА JsonDocument.
// Фронт присылает их как строку (JSON.stringify), но YDB ждёт тип JsonDocument.
const JSON_PARAM_NAMES = new Set([
  'blocks',
  'answers',
  'point_ids',
  'assigned_points',
  'details',
]);

// BigInt сериализоваться в JSON:
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// ============================================================
// 1. КАРТА БАЗ ДАННЫХ
// ============================================================

const DATABASE_MAP = {
  'admin': {
    endpoint: process.env.ADMIN_YDB_ENDPOINT,
    database: process.env.ADMIN_YDB_DATABASE,
  },
  'client': {
    endpoint: process.env.CLIENT_YDB_ENDPOINT,
    database: process.env.CLIENT_YDB_DATABASE,
  },
};

// ============================================================
// 2. КЭШ ДРАЙВЕРОВ И SQL-КЛИЕНТОВ
// ============================================================

const drivers = {};
const sqlClients = {};

// ============================================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Резолвит JS-значение в ПАРУ (YQL-тип для DECLARE + реальный YDB Value)
 * из ОДНОГО источника истины. Это критично: если DECLARE и фактически
 * переданное значение имеют разные типы — YDB падает с
 * ERROR(1030): Type annotation.
 *
 * В частности fromJs() из '@ydbjs/value' всегда превращает JS number
 * в Int32 (даже если это int64 или double), а null — в голый Null без
 * Optional-обёртки. Поэтому здесь типы конструируются вручную.
 */
function resolveYdbParam(name, value) {
  if (value === null || value === undefined) {
    return { yqlType: 'Utf8?', ydbValue: new Optional(null, new TextType()) };
  }
  
  if (typeof value === 'boolean') {
    return { yqlType: 'Bool', ydbValue: new Bool(value) };
  }
  
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      const hint = PARAM_TYPE_HINTS[name];
      
      if (hint === 'Uint32') {
        return { yqlType: 'Uint32', ydbValue: new Uint32(value) };
      }
      if (hint === 'Int32') {
        return { yqlType: 'Int32', ydbValue: new Int32(value) };
      }
      if (hint === 'Uint64') {
        return { yqlType: 'Uint64', ydbValue: new Uint64(BigInt(value)) };
      }
      
      // По умолчанию — Int64
      return { yqlType: 'Int64', ydbValue: new Int64(BigInt(value)) };
    }
    
    // Дробное число
    return { yqlType: 'Double', ydbValue: new Double(value) };
  }
  
  if (typeof value === 'bigint') {
    return { yqlType: 'Int64', ydbValue: new Int64(value) };
  }
  
    // JsonDocument-поля приходят как JSON-строки (результат JSON.stringify на фронте).
    // Проверяем по имени параметра, потому что по типу JS это обычная строка.

  if (JSON_PARAM_NAMES.has(name)) {
    const jsonStr = typeof value === 'string' ? value : JSON.stringify(value);
    return {
      yqlType: 'JsonDocument',
      ydbValue: new JsonDocument(jsonStr),
    };
  }
  if (typeof value === 'object') {
    // JSON-документы: point_ids, blocks, answers, assigned_points
    return { 
      yqlType: 'JsonDocument', 
      ydbValue: new JsonDocument(JSON.stringify(value)) 
    };
  }
  
  return { yqlType: 'Utf8', ydbValue: new Text(String(value)) };
}

/**
 * Формирует блок DECLARE для YQL-запроса на основе объекта params.
 * Пропускает параметры, которые уже объявлены во входящем query
 * (проверка простая: ищем DECLARE $name в тексте запроса).
 *
 * Принимает уже посчитанную карту resolvedParams (key -> {yqlType, ydbValue}),
 * чтобы DECLARE и реально связываемое значение гарантированно совпадали.
 */
function generateDeclares(resolvedParams, existingQuery = '') {
  const paramKeys = Object.keys(resolvedParams);
  if (paramKeys.length === 0) return '';

  return paramKeys
    .map((key) => {
      const cleanKey = key.startsWith('$') ? key.slice(1) : key;
      // Не дублируем DECLARE, если он уже есть в запросе
      const regex = new RegExp(`DECLARE\\s+\\$${cleanKey}\\s+AS`, 'i');
      if (regex.test(existingQuery)) {
        return null;
      }
      const { yqlType } = resolvedParams[key];
      return `DECLARE $${cleanKey} AS ${yqlType};`;
    })
    .filter(Boolean)
    .join('\n');
}

// ============================================================
// 4. ИНИЦИАЛИЗАЦИЯ SQL-КЛИЕНТА ДЛЯ НУЖНОЙ БАЗЫ
// ============================================================

async function getSql(dbType) {
  if (sqlClients[dbType]) {
    return sqlClients[dbType];
  }

  const config = DATABASE_MAP[dbType];
  if (!config || !config.endpoint || !config.database) {
    throw new Error(
      `База "${dbType}" не настроена. Проверьте переменные окружения ` +
      `${dbType.toUpperCase()}_YDB_ENDPOINT и ${dbType.toUpperCase()}_YDB_DATABASE.`
    );
  }

  const cleanEndpoint = config.endpoint.endsWith('/')
    ? config.endpoint.slice(0, -1)
    : config.endpoint;

  const cleanDatabase = config.database.startsWith('/')
    ? config.database
    : `/${config.database}`;

  const connectionString = `${cleanEndpoint}${cleanDatabase}`;

  console.log(`[${dbType}] Connecting to: ${connectionString}`);

  const credentialsProvider = new MetadataCredentialsProvider();

  const driver = new Driver(connectionString, {
    credentialsProvider: credentialsProvider,
  });

  await driver.ready();

  const sql = query(driver);

  drivers[dbType] = driver;
  sqlClients[dbType] = sql;

  return sql;
}

/**
 * Если запрос — одиночный DML-стейтмент (UPSERT/INSERT/UPDATE/DELETE/REPLACE)
 * и в нём ещё нет RETURNING — дописывает "RETURNING *", чтобы сервер сразу
 * вернул реально записанные/изменённые строки. Это заменяет собой ручной
 * повторный SELECT с фронта: один запрос — сразу и запись, и её результат.
 *
 * Не трогает:
 *  - запросы, где RETURNING уже указан явно;
 *  - многостейтментные скрипты (несколько ';' внутри) — там непонятно,
 *    к какому именно стейтменту привязывать RETURNING;
 *  - SELECT и прочие не-DML запросы.
 */
function ensureReturning(yql) {
  const trimmed = yql.trim().replace(/;\s*$/, '');
  const isDml = /^(UPSERT|INSERT|UPDATE|DELETE|REPLACE)\b/i.test(trimmed);
  const hasReturning = /\bRETURNING\b/i.test(trimmed);
  const isMultiStatement = trimmed.includes(';');
  const isBulkDelete = /^DELETE\s+FROM\s+\w+\s*;?\s*$/i.test(trimmed); // DELETE без WHERE

  if (!isDml || hasReturning || isMultiStatement || isBulkDelete) {
    return yql;
  }
  return `${trimmed}\nRETURNING *;`;
}

// ============================================================
// 5. ОБРАБОТЧИК ЗАПРОСОВ
// ============================================================

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { query: yql, params = {}, orgType } = body;

    if (!yql) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing "query" field in request body' }),
      };
    }

    const dbType = orgType === 'client' ? 'client' : 'admin';
    const sql = await getSql(dbType);
    
    // Если это одиночный UPSERT/INSERT/UPDATE/DELETE без явного RETURNING —
    // дописываем RETURNING *, чтобы сразу получить записанные строки
    // и не делать отдельный SELECT с фронта.
    const yqlToRun = ensureReturning(yql);


    let resultSets;

    if (Object.keys(params).length > 0) {
      const resolvedParams = {};
      for (const [key, value] of Object.entries(params)) {
        const cleanKey = key.startsWith('$') ? key.slice(1) : key;
        resolvedParams[cleanKey] = resolveYdbParam(cleanKey, value);
      }

      const q = sql`${sql.unsafe(yqlToRun)}`;
      for (const [key, { ydbValue }] of Object.entries(resolvedParams)) {
        q.parameter(`$${key}`, ydbValue);
      }

      resultSets = await q;
    } else {
      resultSets = await sql`${sql.unsafe(yqlToRun)}`;
    }

    // Нормализуем результат: resultSets — массив массивов
    const rows = (resultSets && resultSets[0]) || [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      statusCode: 200,
      headers,
      // success: true — запрос выполнился без ошибок. Для UPSERT/INSERT/
      // UPDATE/DELETE columns и rows будут пустыми — так и должно быть,
      // это не признак сбоя (признак ошибки — statusCode 500 + поле error).
      body: JSON.stringify({ success: true, columns, rows }),
    };

  } catch (err) {
    // util.inspect с depth: null, чтобы вложенные issues YDB не обрезались
    // до "[Array]"/"[Object]" — иначе реальная причина ошибки не видна в логах.
    console.error('Handler error:', require('util').inspect(err, { depth: null }));

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Unknown error' }),
    };
  }
};