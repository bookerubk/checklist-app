import { ChecklistTemplate, ChecklistBlock } from '../types';
import { queryClientDb, YdbQueryParams } from './ydbApiService';

const rowToTemplate = (row: Record<string, any>): ChecklistTemplate => {
  let blocks: ChecklistBlock[] = [];
  try {
    blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : (row.blocks || []);
  } catch {
    blocks = [];
  }

  let assignedPoints: string[] = [];
  try {
    if (Array.isArray(row.assigned_points)) {
      assignedPoints = row.assigned_points;
    } else if (typeof row.assigned_points === 'string') {
      assignedPoints = JSON.parse(row.assigned_points);
    }
  } catch {
    assignedPoints = [];
  }

  return {
    id: String(row.id),
    code: String(row.code || ''),
    title: String(row.title || ''),
    category: row.category || 'opening',
    description: String(row.description || ''),
    version: String(row.version || '1.0'),
    updatedAt: row.updated_at || new Date().toISOString(),
    createdAt: row.created_at || new Date().toISOString(),
    targetTime: row.target_time || undefined,
    allowedVarianceMinutes: typeof row.allowed_variance_minutes === 'number' ? row.allowed_variance_minutes : undefined,
    blocks,
    active: row.is_active !== false,
    assignedPoints: assignedPoints.length > 0 ? assignedPoints : ['all'],
    organizationId: row.organization_id || undefined,
    organizationInn: row.organization_inn || undefined,
  };
};

export const getTemplatesFromYdb = async (orgId?: string): Promise<ChecklistTemplate[]> => {
  const query = orgId
    ? `SELECT * FROM checklist_templates WHERE organization_id = "${orgId}" AND is_active = true;`
    : `SELECT * FROM checklist_templates WHERE is_active = true;`;
  const res = await queryClientDb(query);
  if (res.error) {
    throw new Error(res.error);
  }
  return res.rows.map(rowToTemplate);
};

export const saveTemplateToYdb = async (t: ChecklistTemplate): Promise<void> => {
  const blocksJson = JSON.stringify(t.blocks || []);
  const assignedPointsJson = JSON.stringify(t.assignedPoints || []);

  const query = `
    UPSERT INTO checklist_templates (
      id, organization_id, organization_inn, code, title, category, description,
      version, frequency, is_active, target_time, allowed_variance_minutes,
      blocks, assigned_points, created_at, updated_at
    )
    VALUES (
      $id, $organization_id, $organization_inn, $code, $title, $category, $description,
      $version, $frequency, $is_active, $target_time, $allowed_variance_minutes,
      $blocks, $assigned_points, CurrentUtcTimestamp(), CurrentUtcTimestamp()
    );
  `;

  const params: YdbQueryParams = {
    id: t.id,
    organization_id: t.organizationId || 'org-horeca-1',
    organization_inn: t.organizationInn || '',
    code: t.code || '',
    title: t.title || '',
    category: t.category || 'opening',
    description: t.description || '',
    version: t.version || '1.0',
    frequency: 'daily',
    is_active: t.active !== false,
    target_time: t.targetTime || '08:00',
    allowed_variance_minutes: t.allowedVarianceMinutes ?? 15,
    blocks: blocksJson,
    assigned_points: assignedPointsJson,
  };

  const res = await queryClientDb(query, params);
  if (res.error) {
    // Fallback: текстовая интерполяция (для случая, если параметры не сработали)
    const safeBlocks = blocksJson.replace(/'/g, "\\'");
    const safeAssigned = assignedPointsJson.replace(/'/g, "\\'");
    const safeDesc = (t.description || '').replace(/"/g, '\\"');
    const safeTitle = (t.title || '').replace(/"/g, '\\"');

    const fallbackQuery = `
      UPSERT INTO checklist_templates (
        id, organization_id, organization_inn, code, title, category, description,
        version, frequency, is_active, target_time, allowed_variance_minutes,
        blocks, assigned_points, created_at, updated_at
      )
      VALUES (
        "${t.id}",
        "${t.organizationId || 'org-horeca-1'}",
        "${t.organizationInn || ''}",
        "${t.code || ''}",
        "${safeTitle}",
        "${t.category || 'opening'}",
        "${safeDesc}",
        "${t.version || '1.0'}",
        "daily",
        ${t.active !== false},
        "${t.targetTime || '08:00'}",
        ${t.allowedVarianceMinutes ?? 15},
        CAST('${safeBlocks}' AS JsonDocument),
        CAST('${safeAssigned}' AS JsonDocument),
        CurrentUtcTimestamp(),
        CurrentUtcTimestamp()
      );
    `;
    const fallbackRes = await queryClientDb(fallbackQuery);
    if (fallbackRes.error) {
      throw new Error(fallbackRes.error);
    }
  }
};

export const deleteTemplateFromYdb = async (templateId: string): Promise<void> => {
  // Soft delete via UPDATE
  const query = `UPDATE checklist_templates SET is_active = false WHERE id = $id;`;
  const res = await queryClientDb(query, { id: templateId });
  if (res.error) {
    const delQuery = `DELETE FROM checklist_templates WHERE id = "${templateId}";`;
    const delRes = await queryClientDb(delQuery);
    if (delRes.error) {
      throw new Error(delRes.error);
    }
  }
};
