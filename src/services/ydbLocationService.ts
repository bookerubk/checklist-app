import { PointLocation } from '../types';
import { queryClientDb, YdbQueryParams } from './ydbApiService';

const rowToPoint = (row: Record<string, any>): PointLocation => ({
  id: String(row.id),
  code: String(row.code || ''),
  name: String(row.name || ''),
  city: String(row.city || ''),
  address: String(row.address || ''),
  openingTime: String(row.opening_time || '08:00'),
  closingTime: String(row.closing_time || '22:00'),
  pinCode: '****', // В YDB хранится хэш пин-кода
  managerName: String(row.manager_name || ''),
  telegramChatId: row.telegram_chat_id || undefined,
  organizationId: row.organization_id || undefined,
  organizationName: row.organization_name || undefined,
  organizationInn: row.organization_inn || undefined,
});

export const getPointsFromYdb = async (orgId?: string): Promise<PointLocation[]> => {
  const query = orgId
    ? `SELECT * FROM locations WHERE organization_id = "${orgId}";`
    : `SELECT * FROM locations;`;
  const res = await queryClientDb(query);
  if (res.error) {
    throw new Error(res.error);
  }
  return res.rows.map(rowToPoint);
};

export const savePointToYdb = async (p: PointLocation): Promise<void> => {
  const query = `
    UPSERT INTO locations (
      id, organization_id, organization_inn, organization_name, code, name, city, address,
      opening_time, closing_time, manager_name, telegram_chat_id, point_pin_hash
    )
    VALUES (
      $id, $organization_id, $organization_inn, $organization_name, $code, $name, $city, $address,
      $opening_time, $closing_time, $manager_name, $telegram_chat_id, $point_pin_hash
    );
  `;

  const params: YdbQueryParams = {
    id: p.id,
    organization_id: p.organizationId || 'org-horeca-1',
    organization_inn: p.organizationInn || '',
    organization_name: p.organizationName || '',
    code: p.code || '',
    name: p.name || '',
    city: p.city || 'Москва',
    address: p.address || '',
    opening_time: p.openingTime || '08:00',
    closing_time: p.closingTime || '22:00',
    manager_name: p.managerName || '',
    telegram_chat_id: p.telegramChatId || '',
    point_pin_hash: `hash-${p.pinCode || '1111'}`,
  };

  const res = await queryClientDb(query, params);
  if (res.error) {
    // Fallback на текстовую интерполяцию, если Cloud Function не поддерживает параметры в запросе
    const fallbackQuery = `
      UPSERT INTO locations (
        id, organization_id, organization_inn, organization_name, code, name, city, address,
        opening_time, closing_time, manager_name, telegram_chat_id, point_pin_hash
      )
      VALUES (
        "${p.id}",
        "${p.organizationId || 'org-horeca-1'}",
        "${p.organizationInn || ''}",
        "${(p.organizationName || '').replace(/"/g, '\\"')}",
        "${p.code || ''}",
        "${(p.name || '').replace(/"/g, '\\"')}",
        "${(p.city || 'Москва').replace(/"/g, '\\"')}",
        "${(p.address || '').replace(/"/g, '\\"')}",
        "${p.openingTime || '08:00'}",
        "${p.closingTime || '22:00'}",
        "${(p.managerName || '').replace(/"/g, '\\"')}",
        "${(p.telegramChatId || '').replace(/"/g, '\\"')}",
        "hash-${p.pinCode || '1111'}"
      );
    `;
    const fallbackRes = await queryClientDb(fallbackQuery);
    if (fallbackRes.error) {
      throw new Error(fallbackRes.error);
    }
  }
};

export const deletePointFromYdb = async (pointId: string): Promise<void> => {
  const query = `DELETE FROM locations WHERE id = $id;`;
  const res = await queryClientDb(query, { id: pointId });
  if (res.error) {
    const fallbackQuery = `DELETE FROM locations WHERE id = "${pointId}";`;
    const fallbackRes = await queryClientDb(fallbackQuery);
    if (fallbackRes.error) {
      throw new Error(fallbackRes.error);
    }
  }
};
