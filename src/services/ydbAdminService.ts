import { queryClientDb } from './ydbApiService';

export interface YdbCountsResult {
  counts: Record<string, number>;
  errors: string[];
}

/**
 * Запрашивает счётчики записей в клиентской YDB.
 * Возвращает объект: { counts: { staff: N, locations: M, ... }, errors: [...] }
 */
export const countYdbRecords = async (): Promise<YdbCountsResult> => {
  const tables = [
    'staff',
    'locations',
    'checklist_templates',
    'checklist_submissions',
    'violations_log',
    'audit_log',
  ];
  
  const counts: Record<string, number> = {};
  const errors: string[] = [];
  
  for (const table of tables) {
    try {
      const res = await queryClientDb(`SELECT COUNT(*) AS cnt FROM ${table};`);
      if (!res.error && res.rows.length > 0) {
        counts[table] = Number(res.rows[0].cnt) || 0;
      } else {
        counts[table] = 0;
        if (res.error) errors.push(`${table}: ${res.error}`);
      }
    } catch (e: any) {
      counts[table] = 0;
      errors.push(`${table}: ${e?.message || 'unknown'}`);
    }
  }
  
  return { counts, errors };
};

/**
 * Очищает все таблицы клиентской YDB.
 * ВНИМАНИЕ: необратимая операция. Использовать только через двойное подтверждение.
 */
export const cleanYdbTables = async (): Promise<{ success: boolean; deleted: Record<string, string> }> => {
  const tables = [
    'staff',
    'locations',
    'checklist_templates',
    'checklist_submissions',
    'violations_log',
    'audit_log',
  ];
  
  const deleted: Record<string, string> = {};
  for (const table of tables) {
    try {
      const res = await queryClientDb(`DELETE FROM ${table};`);
      deleted[table] = res.error ? `error: ${res.error}` : 'ok';
    } catch (err: any) {
      deleted[table] = `error: ${err.message}`;
    }
  }
  
  return { success: true, deleted };
};
