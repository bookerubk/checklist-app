import { saveStaff, savePoint, saveTemplate, getStaff, getPoints, getTemplates } from './storage';
import { saveStaffToYdb } from './ydbStaffService';
import { savePointToYdb } from './ydbLocationService';
import { saveTemplateToYdb } from './ydbTemplateService';
import { getActiveOrganization } from './companyService';
import { DATA_CLEARED_BY_USER_FLAG } from './cleanStartService';
import { StaffMember, PointLocation, ChecklistTemplate } from '../types';

/**
 * Заполняет localStorage демонстрационными данными:
 * несколько сотрудников, точек, шаблонов.
 */
export const fillDemoDataLocalStorage = (): void => {
  // Сбрасываем флаг очистки кэша, т.к. пользователь явно заполняет демо
  localStorage.removeItem(DATA_CLEARED_BY_USER_FLAG);

  const org = getActiveOrganization();
  const orgId = org?.id || 'org-demo';
  const orgName = org?.name || 'Демо-организация';
  const orgInn = org?.inn || '0000000000';
  
  // Демо-точки
  const demoPoints: PointLocation[] = [
    { 
      id: 'pt-demo-1', 
      code: 'ТТ-001', 
      name: 'Кофейня «Центр»', 
      city: 'Москва', 
      address: 'ул. Ленина, 1', 
      openingTime: '08:00', 
      closingTime: '22:00', 
      pinCode: '1111', 
      managerName: 'Иван Иванов',
      organizationId: orgId, 
      organizationName: orgName, 
      organizationInn: orgInn 
    },
    { 
      id: 'pt-demo-2', 
      code: 'ТТ-002', 
      name: 'Кофейня «Парк»', 
      city: 'Москва', 
      address: 'ул. Мира, 10', 
      openingTime: '09:00', 
      closingTime: '21:00', 
      pinCode: '2222', 
      managerName: 'Пётр Петров',
      organizationId: orgId, 
      organizationName: orgName, 
      organizationInn: orgInn 
    },
  ];
  demoPoints.forEach(p => savePoint(p, orgId));
  
  // Демо-сотрудники (строго типизировано)
  const demoStaff: StaffMember[] = [
    { 
      id: 'st-demo-1', 
      name: 'Артём Белов', 
      role: 'Бариста', 
      pinCode: '1111', 
      pointId: 'pt-demo-1', 
      pointIds: ['pt-demo-1', 'pt-demo-2'],
      organizationId: orgId,
      organizationName: orgName,
      organizationInn: orgInn
    },
    { 
      id: 'st-demo-2', 
      name: 'Мария Сидорова', 
      role: 'Шеф-бариста', 
      pinCode: '2222', 
      pointId: 'pt-demo-1', 
      pointIds: ['pt-demo-1'],
      organizationId: orgId,
      organizationName: orgName,
      organizationInn: orgInn
    },
    { 
      id: 'st-demo-3', 
      name: 'Илья Кузнецов', 
      role: 'Стажер', 
      pinCode: '3333', 
      pointId: 'pt-demo-2', 
      pointIds: ['pt-demo-2'],
      organizationId: orgId,
      organizationName: orgName,
      organizationInn: orgInn
    },
  ];
  demoStaff.forEach(s => saveStaff(s, orgId));
  
  // Демо-шаблоны
  const demoTemplate: ChecklistTemplate = {
    id: 'tpl-demo-1',
    code: 'ЧК-00001',
    title: 'Открытие смены (демо)',
    category: 'opening',
    description: 'Демонстрационный чек-лист открытия кофейни',
    version: '1.0',
    active: true,
    assignedPoints: ['all'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organizationId: orgId,
    organizationInn: orgInn,
    blocks: [
      { id: 'blk-1', type: 'check', title: 'Проверить чистоту бара', required: true },
      { id: 'blk-2', type: 'number', title: 'Температура холодильника', required: true, minNumber: 2, maxNumber: 5, unit: '°C' },
    ],
  };
  saveTemplate(demoTemplate, orgId);
};

export interface PushResult {
  staff: number;
  points: number;
  templates: number;
  errors: string[];
}

/**
 * Передаёт все локальные данные (staff, points, templates) в боевую YDB.
 * Возвращает количество успешно переданных записей и список ошибок.
 */
export const pushLocalStorageToYdb = async (): Promise<PushResult> => {
  const org = getActiveOrganization();
  const orgId = org?.id;
  
  const staff = getStaff(orgId);
  const points = getPoints(orgId);
  const templates = getTemplates(orgId);
  
  let staffOk = 0;
  let pointsOk = 0;
  let templatesOk = 0;
  const errors: string[] = [];

  // Передаём точки в YDB
  for (const p of points) {
    try {
      await savePointToYdb(p);
      pointsOk++;
    } catch (e: any) {
      errors.push(`Точка «${p.name}»: ${e?.message || 'ошибка'}`);
    }
  }

  // Передаём сотрудников в YDB
  for (const s of staff) {
    try {
      await saveStaffToYdb(s);
      staffOk++;
    } catch (e: any) {
      errors.push(`Сотрудник «${s.name}»: ${e?.message || 'ошибка'}`);
    }
  }

  // Передаём шаблоны в YDB
  for (const t of templates) {
    try {
      await saveTemplateToYdb(t);
      templatesOk++;
    } catch (e: any) {
      errors.push(`Шаблон «${t.title}»: ${e?.message || 'ошибка'}`);
    }
  }

  if (errors.length > 0) {
    console.warn('Ошибки при передаче данных в YDB:', errors);
  }

  return {
    staff: staffOk,
    points: pointsOk,
    templates: templatesOk,
    errors,
  };
};

/**
 * Очищает локальный кэш данных.
 */
export const clearLocalStorageData = (): void => {
  // Данные предметной области — очищаем
  localStorage.removeItem('checklist_1c_staff_v1');
  localStorage.removeItem('checklist_1c_points_v1');
  localStorage.removeItem('checklist_1c_templates_v1');
  localStorage.removeItem('checklist_1c_submissions_v1');
  localStorage.removeItem('checklist_1c_queue_v1');
  localStorage.removeItem('checklist_1c_s3_media_v1');
  localStorage.removeItem('checklist_1c_telegram_alerts_v1');
  
  // Помечаем, что пользователь сознательно очистил кэш —
  // initializeStorage НЕ должен подставлять демо при следующей загрузке
  localStorage.setItem(DATA_CLEARED_BY_USER_FLAG, 'true');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('checklist-data-cleared'));
  }
};
