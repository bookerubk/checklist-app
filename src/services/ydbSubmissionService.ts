import { ChecklistSubmission, BlockAnswer } from '../types';
import { queryClientDb, YdbQueryParams } from './ydbApiService';

const rowToSubmission = (row: Record<string, any>): ChecklistSubmission => {
  let answers: BlockAnswer[] = [];
  try {
    answers = typeof row.answers === 'string' ? JSON.parse(row.answers) : (row.answers || []);
  } catch {
    answers = [];
  }

  return {
    id: String(row.id),
    number1C: String(row.number_1c || 'ЗЧ-00001'),
    templateId: String(row.template_id || ''),
    templateTitle: String(row.template_title || ''),
    templateVersion: String(row.template_version || '1.0'),
    pointId: String(row.point_id || ''),
    pointName: String(row.point_name || ''),
    organizationId: row.organization_id || undefined,
    organizationInn: row.organization_inn || undefined,
    staffId: String(row.staff_id || ''),
    staffName: String(row.staff_name || ''),
    staffRole: String(row.staff_role || 'Бариста'),
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    timeDeviationMinutes: Number(row.time_deviation_minutes || 0),
    answers,
    totalItems: Number(row.total_items || answers.length || 0),
    completedItems: Number(row.completed_items || answers.length || 0),
    violationsCount: Number(row.violations_count || 0),
    status: (row.status as 'passed' | 'warning' | 'failed') || 'passed',
    is1CSynced: true,
    syncAttempts: 1,
    s3MediaCount: Number(row.s3_media_count || 0),
  };
};

export const getSubmissionsFromYdb = async (orgId?: string): Promise<ChecklistSubmission[]> => {
  const query = orgId
    ? `SELECT * FROM checklist_submissions WHERE organization_id = "${orgId}" ORDER BY created_at DESC;`
    : `SELECT * FROM checklist_submissions ORDER BY created_at DESC;`;
  const res = await queryClientDb(query);
  if (res.error) {
    throw new Error(res.error);
  }
  return res.rows.map(rowToSubmission);
};

export const saveSubmissionToYdb = async (sub: ChecklistSubmission): Promise<void> => {
  const answersJson = JSON.stringify(sub.answers || []);
  const safeAnswers = answersJson.replace(/'/g, "\\'");

  const query = `
    UPSERT INTO checklist_submissions (
      id, organization_id, organization_inn, number_1c, point_id, point_name,
      template_id, template_title, template_version, staff_id, staff_name, staff_role,
      status, violations_count, s3_media_count, time_deviation_minutes,
      completed_items, total_items, created_at, answers
    )
    VALUES (
      $id, $organization_id, $organization_inn, $number_1c, $point_id, $point_name,
      $template_id, $template_title, $template_version, $staff_id, $staff_name, $staff_role,
      $status, $violations_count, $s3_media_count, $time_deviation_minutes,
      $completed_items, $total_items, CurrentUtcTimestamp(),
      CAST($answers AS JsonDocument)
    );
  `;

  const params: YdbQueryParams = {
    id: sub.id,
    organization_id: sub.organizationId || 'org-horeca-1',
    organization_inn: sub.organizationInn || '',
    number_1c: sub.number1C || '',
    point_id: sub.pointId || '',
    point_name: sub.pointName || '',
    template_id: sub.templateId || '',
    template_title: sub.templateTitle || '',
    template_version: sub.templateVersion || '1.0',
    staff_id: sub.staffId || '',
    staff_name: sub.staffName || '',
    staff_role: sub.staffRole || 'Бариста',
    status: sub.status || 'passed',
    violations_count: sub.violationsCount ?? 0,
    s3_media_count: sub.s3MediaCount ?? 0,
    time_deviation_minutes: sub.timeDeviationMinutes ?? 0,
    completed_items: sub.completedItems ?? (sub.answers?.length || 0),
    total_items: sub.totalItems ?? (sub.answers?.length || 0),
    answers: answersJson,
  };

  const res = await queryClientDb(query, params);
  if (res.error) {
    // Текстовый fallback
    const fallbackQuery = `
      UPSERT INTO checklist_submissions (
        id, organization_id, organization_inn, number_1c, point_id, point_name,
        template_id, template_title, template_version, staff_id, staff_name, staff_role,
        status, violations_count, s3_media_count, time_deviation_minutes,
        completed_items, total_items, created_at, answers
      )
      VALUES (
        "${sub.id}",
        "${sub.organizationId || 'org-horeca-1'}",
        "${sub.organizationInn || ''}",
        "${sub.number1C || ''}",
        "${sub.pointId || ''}",
        "${(sub.pointName || '').replace(/"/g, '\\"')}",
        "${sub.templateId || ''}",
        "${(sub.templateTitle || '').replace(/"/g, '\\"')}",
        "${sub.templateVersion || '1.0'}",
        "${sub.staffId || ''}",
        "${(sub.staffName || '').replace(/"/g, '\\"')}",
        "${sub.staffRole || 'Бариста'}",
        "${sub.status || 'passed'}",
        ${sub.violationsCount ?? 0},
        ${sub.s3MediaCount ?? 0},
        ${sub.timeDeviationMinutes ?? 0},
        ${sub.completedItems ?? (sub.answers?.length || 0)},
        ${sub.totalItems ?? (sub.answers?.length || 0)},
        CurrentUtcTimestamp(),
        CAST('${safeAnswers}' AS JsonDocument)
      );
    `;
    const fallbackRes = await queryClientDb(fallbackQuery);
    if (fallbackRes.error) {
      throw new Error(fallbackRes.error);
    }
  }
};
