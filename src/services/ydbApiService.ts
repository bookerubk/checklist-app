import { YdbQueryResult } from '../types';

export type YdbOrgType = 'admin' | 'client';

export interface YdbQueryParams {
  [key: string]: any;
}

const safeStringify = (obj: any): string => {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
};

const callYdbApi = async (
  query: string,
  orgType: YdbOrgType = 'admin',
  params?: YdbQueryParams
): Promise<YdbQueryResult> => {
  const startTime = performance.now();
  try {
    const payload: { query: string; orgType: YdbOrgType; params?: YdbQueryParams } = {
      query,
      orgType,
    };
    if (params && Object.keys(params).length > 0) {
      payload.params = params;
    }

    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeStringify(payload),
    });
    const durationMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        columns: [],
        rows: [],
        error: `HTTP ${response.status}: ${errorText}`,
        stats: { durationMs, requestUnits: 0, rowsAffected: 0 },
      };
    }

    const data = await response.json();
    if (data.error) {
      return {
        columns: data.columns || [],
        rows: data.rows || [],
        error: data.error,
        stats: { durationMs, requestUnits: 0, rowsAffected: data.rows?.length || 0 },
      };
    }
    return {
      columns: data.columns || [],
      rows: data.rows || [],
      stats: {
        durationMs,
        requestUnits: data.stats?.requestUnits ?? 0,
        rowsAffected: data.rows?.length || 0,
      },
    };
  } catch (err: any) {
    return {
      columns: [],
      rows: [],
      error: `Сетевая ошибка: ${err?.message || 'Не удалось выполнить сетевой запрос'}`,
      stats: { durationMs: Math.round(performance.now() - startTime), requestUnits: 0, rowsAffected: 0 },
    };
  }
};

export const queryAdminDb = (query: string, params?: YdbQueryParams) => callYdbApi(query, 'admin', params);
export const queryClientDb = (query: string, params?: YdbQueryParams) => callYdbApi(query, 'client', params);

export const pingYdbApi = async () => {
  const startTime = performance.now();
  const result = await callYdbApi('SELECT 1 AS value;', 'admin');
  return {
    ok: !result.error,
    error: result.error,
    durationMs: Math.round(performance.now() - startTime),
  };
};
