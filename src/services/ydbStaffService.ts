import { StaffMember } from '../types';
import { queryClientDb } from './ydbApiService';

const rowToStaff = (row: Record<string, any>): StaffMember => {
  let parsedPointIds: string[] = [];
  if (Array.isArray(row.point_ids)) {
    parsedPointIds = row.point_ids.map(String);
  } else if (typeof row.point_ids === 'string') {
    try {
      const parsed = JSON.parse(row.point_ids);
      parsedPointIds = Array.isArray(parsed) ? parsed.map(String) : [String(row.point_ids)];
    } catch {
      parsedPointIds = [row.point_ids];
    }
  }

  const pointId = String(row.point_id || (parsedPointIds.length > 0 ? parsedPointIds[0] : 'pt-1'));
  if (parsedPointIds.length === 0) {
    parsedPointIds = [pointId];
  }

  return {
    id: String(row.id),
    name: String(row.name || ''),
    role: row.role || 'Бариста',
    pinCode: '****', // В YDB хранится хэш, наружу пин-код не отдаём
    pinCodeHash: String(row.pin_code_hash || ''),
    pointId,
    pointIds: parsedPointIds,
    phone: row.phone || '',
    avatarUrl: row.avatar_url || undefined,
    organizationId: row.organization_id || undefined,
    organizationName: row.organization_name || undefined,
    organizationInn: row.organization_inn || undefined,
  };
};

export const getStaffFromYdb = async (orgId?: string): Promise<StaffMember[]> => {
  const query = orgId
    ? `SELECT * FROM staff WHERE organization_id = "${orgId}" AND is_active = true;`
    : `SELECT * FROM staff WHERE is_active = true;`;
  
  const res = await queryClientDb(query);
  if (res.error) {
    throw new Error(res.error);
  }
  return res.rows.map(rowToStaff);
};

export const saveStaffToYdb = async (m: StaffMember): Promise<void> => {
  const pointIdsJson = JSON.stringify(m.pointIds || [m.pointId]);
  const isMask = !m.pinCode || m.pinCode === '****';
  const pinHash = isMask ? (m.pinCodeHash || 'hash-1111') : 'hash-' + m.pinCode;

  const query = `
    UPSERT INTO staff (
      id, organization_id, organization_inn, organization_name, name, role,
      point_id, point_ids, pin_code_hash, phone, avatar_url, is_active, created_at
    )
    VALUES (
      $id, $organization_id, $organization_inn, $organization_name, $name, $role,
      $point_id, CAST($point_ids AS JsonDocument), $pin_code_hash, $phone,
      $avatar_url, $is_active, CurrentUtcTimestamp()
    );
  `;

  const params = {
    id: m.id,
    organization_id: m.organizationId || 'org-horeca-1',
    organization_inn: m.organizationInn || '',
    organization_name: m.organizationName || '',
    name: m.name,
    role: m.role || 'Бариста',
    point_id: m.pointId,
    point_ids: pointIdsJson,
    pin_code_hash: pinHash,
    phone: m.phone || '',
    avatar_url: m.avatarUrl || '',
    is_active: true,
  };

  const res = await queryClientDb(query, params);
  if (res.error) {
    // Fallback на текстовую интерполяцию для обратной совместимости
    const safeJson = pointIdsJson.replace(/'/g, "\\'");
    const avatarVal = m.avatarUrl ? `"${m.avatarUrl.replace(/"/g, '\\"')}"` : '""';
    const orgInnVal = m.organizationInn ? `"${m.organizationInn}"` : '""';
    const orgNameVal = m.organizationName ? `"${m.organizationName.replace(/"/g, '\\"')}"` : '""';
    const orgIdVal = m.organizationId || 'org-horeca-1';

    const fallbackQuery = `
      UPSERT INTO staff (id, organization_id, organization_inn, organization_name, name, role, point_id, point_ids, pin_code_hash, phone, avatar_url, is_active, created_at)
      VALUES (
        "${m.id}",
        "${orgIdVal}",
        ${orgInnVal},
        ${orgNameVal},
        "${m.name.replace(/"/g, '\\"')}",
        "${m.role}",
        "${m.pointId}",
        CAST('${safeJson}' AS JsonDocument),
        "${pinHash}",
        "${m.phone || ''}",
        ${avatarVal},
        true,
        CurrentUtcTimestamp()
      );
    `;
    const fallbackRes = await queryClientDb(fallbackQuery);
    if (fallbackRes.error) {
      throw new Error(fallbackRes.error);
    }
  }
};

export const deleteStaffFromYdb = async (staffId: string): Promise<void> => {
  const query = `
    UPDATE staff SET is_active = false WHERE id = $id;
  `;
  const res = await queryClientDb(query, { id: staffId });
  if (res.error) {
    // If update not supported directly or fails, try soft delete / delete fallback
    const deleteQuery = `DELETE FROM staff WHERE id = "${staffId}";`;
    const delRes = await queryClientDb(deleteQuery);
    if (delRes.error) {
      throw new Error(delRes.error);
    }
  }
};
