import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  MapPin, 
  Plus, 
  Trash2, 
  Edit3, 
  QrCode, 
  Clock, 
  Key, 
  Search, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Coffee, 
  Send,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Phone,
  HelpCircle,
  LogIn,
  Lock
} from 'lucide-react';
import { PointLocation, StaffMember, ManagerUser } from '../../types';
import { savePoint, deletePoint, saveStaff, deleteStaff } from '../../services/storage';
import { saveStaffToYdb, deleteStaffFromYdb } from '../../services/ydbStaffService';
import { savePointToYdb, deletePointFromYdb } from '../../services/ydbLocationService';
import { getOrganizations, getOrganizationsForUser, findOrganizationByInn, cleanInnString, getActiveOrganization } from '../../services/companyService';
import { isDemoSession } from '../../services/managerAuth';

interface StaffAndPointsManagerProps {
  points: PointLocation[];
  staffList: StaffMember[];
  onRefreshData: () => void;
  onOpenQrTab: (pointId?: string) => void;
  onOpenRunnerWithStaff?: (pointId: string, staffId: string) => void;
  currentUser: ManagerUser | null;
  onOpenLoginModal: () => void;
}

export const StaffAndPointsManager: React.FC<StaffAndPointsManagerProps> = ({
  points,
  staffList,
  onRefreshData,
  onOpenQrTab,
  currentUser,
  onOpenLoginModal,
}) => {
  const [activeSection, setActiveSection] = useState<'points' | 'staff' | 'guide'>('points');
  
  // Point Modal State
  const [isPointModalOpen, setIsPointModalOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PointLocation | null>(null);
  const [pointForm, setPointForm] = useState<Partial<PointLocation>>({
    code: '',
    name: '',
    city: 'Москва',
    address: '',
    openingTime: '08:00',
    closingTime: '22:00',
    pinCode: '',
    managerName: '',
    telegramChatId: '',
  });

  // Staff Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffForm, setStaffForm] = useState<Partial<StaffMember> & { pointIds?: string[] }>({
    name: '',
    role: 'Бариста',
    pinCode: '',
    pointId: points[0]?.id || '',
    pointIds: [points[0]?.id || ''],
  });

  // Filters & Search
  const [pointSearch, setPointSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedPointFilter, setSelectedPointFilter] = useState<string>('all');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Point Handlers
  const handleOpenCreatePoint = () => {
    if (!currentUser) {
      showFeedback('Для добавления торговой точки требуется войти в профиль руководства', 'error');
      onOpenLoginModal();
      return;
    }
    const nextCodeNum = points.length + 1;
    const nextCode = `ТТ-${String(nextCodeNum).padStart(3, '0')}`;
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    
    setEditingPoint(null);
    setPointForm({
      code: nextCode,
      name: '',
      city: 'Москва',
      address: '',
      openingTime: '08:00',
      closingTime: '22:00',
      pinCode: randomPin,
      managerName: currentUser ? currentUser.name : 'Управляющий локации',
      telegramChatId: `@horeca_point_${nextCodeNum}_bot`,
    });
    setIsPointModalOpen(true);
  };

  const handleOpenEditPoint = (p: PointLocation) => {
    if (!currentUser) {
      showFeedback('Для редактирования данных кофейни требуется войти в профиль руководства', 'error');
      onOpenLoginModal();
      return;
    }
    setEditingPoint(p);
    setPointForm({ ...p });
    setIsPointModalOpen(true);
  };

  const handleSavePointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenLoginModal();
      return;
    }
    if (!pointForm.name || !pointForm.address) {
      showFeedback('Пожалуйста, заполните название и адрес торговой точки', 'error');
      return;
    }

    const activeOrg = getActiveOrganization();
    const orgId = currentUser.organizationId || activeOrg?.id || 'org-horeca-1';

    const pointToSave: PointLocation = {
      id: editingPoint ? editingPoint.id : 'pt-' + Date.now().toString(36),
      code: pointForm.code || `ТТ-${points.length + 1}`,
      name: pointForm.name.trim(),
      city: pointForm.city?.trim() || 'Москва',
      address: pointForm.address.trim(),
      openingTime: pointForm.openingTime || '08:00',
      closingTime: pointForm.closingTime || '22:00',
      pinCode: pointForm.pinCode || '1234',
      managerName: pointForm.managerName?.trim() || currentUser.name || 'Управляющий',
      telegramChatId: pointForm.telegramChatId?.trim(),
      organizationId: orgId,
      organizationName: currentUser.organizationName || activeOrg?.name || 'Организация',
      organizationInn: currentUser.organizationInn || activeOrg?.inn || '',
    };

    let ydbError: any = null;
    try {
      await savePointToYdb(pointToSave);
      savePoint(pointToSave, orgId);
    } catch (err) {
      console.warn('YDB location sync failed, saving locally:', err);
      ydbError = err;
      savePoint(pointToSave, orgId);
    }

    onRefreshData();
    setIsPointModalOpen(false);

    if (ydbError) {
      showFeedback(`Не удалось сохранить в YDB, данные сохранены локально (${ydbError?.message || 'ошибка сети'})`, 'error');
    } else {
      showFeedback(editingPoint ? `Точка «${pointToSave.name}» сохранена в YDB` : `Точка «${pointToSave.name}» успешно создана в YDB`);
    }
  };

  const handleDeletePoint = async (id: string, name: string) => {
    if (!currentUser) {
      showFeedback('Для удаления кофейни требуется войти в профиль руководства', 'error');
      onOpenLoginModal();
      return;
    }
    if (confirm(`Удалить торговую точку «${name}»? Назначенные сотрудники останутся в системе.`)) {
      let ydbError: any = null;
      try {
        await deletePointFromYdb(id);
        deletePoint(id, currentUser.organizationId);
      } catch (err) {
        console.warn('YDB location delete sync failed, deleting locally:', err);
        ydbError = err;
        deletePoint(id, currentUser.organizationId);
      }

      onRefreshData();
      if (ydbError) {
        showFeedback(`Не удалось удалить в YDB, точка удалена локально (${ydbError?.message || 'ошибка сети'})`, 'error');
      } else {
        showFeedback(`Точка «${name}» удалена из YDB`);
      }
    }
  };

  // Staff Handlers
  const handleOpenCreateStaff = () => {
    if (!currentUser) {
      showFeedback('Для добавления сотрудника требуется войти в профиль руководства', 'error');
      onOpenLoginModal();
      return;
    }
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setEditingStaff(null);
    setStaffForm({
      name: '',
      role: 'Бариста',
      pinCode: randomPin,
      pointId: points[0]?.id || '',
      pointIds: [points[0]?.id || ''],
    });
    setIsStaffModalOpen(true);
  };

  const handleOpenEditStaff = (s: StaffMember) => {
    if (!currentUser) {
      showFeedback('Для редактирования данных сотрудника требуется войти в профиль руководства', 'error');
      onOpenLoginModal();
      return;
    }
    setEditingStaff(s);
    const pointIds = Array.isArray(s.pointIds) && s.pointIds.length > 0
      ? s.pointIds
      : [s.pointId || points[0]?.id || ''];
    setStaffForm({
      ...s,
      pointIds,
      pointId: s.pointId || pointIds[0],
    });
    setIsStaffModalOpen(true);
  };

  const togglePointForStaff = (ptId: string) => {
    const current = staffForm.pointIds || [];
    let updated: string[];
    if (current.includes(ptId)) {
      if (current.length <= 1) {
        showFeedback('Сотрудник должен быть закреплен минимум за 1 кофейней', 'error');
        return;
      }
      updated = current.filter(id => id !== ptId);
    } else {
      updated = [...current, ptId];
    }
    setStaffForm({
      ...staffForm,
      pointIds: updated,
      pointId: updated[0] || '',
    });
  };

  const handleSaveStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenLoginModal();
      return;
    }
    if (!staffForm.name) {
      showFeedback('Укажите ФИО сотрудника', 'error');
      return;
    }

    const pointIds = Array.isArray(staffForm.pointIds) && staffForm.pointIds.length > 0
      ? staffForm.pointIds
      : [staffForm.pointId || points[0]?.id || ''];

    const activeOrg = getActiveOrganization();
    const orgId = currentUser.organizationId || activeOrg?.id || 'org-horeca-1';
    const orgName = currentUser.organizationName || activeOrg?.name || 'Организация';
    const orgInn = currentUser.organizationInn || activeOrg?.inn || '';

    const staffToSave: StaffMember = {
      id: editingStaff ? editingStaff.id : 'st-' + Date.now().toString(36),
      name: staffForm.name.trim(),
      role: staffForm.role || 'Бариста',
      pinCode: staffForm.pinCode || '1111',
      pinCodeHash: staffForm.pinCodeHash || editingStaff?.pinCodeHash,
      pointId: pointIds[0] || (points[0]?.id || ''),
      pointIds: pointIds,
      organizationId: orgId,
      organizationName: orgName,
      organizationInn: orgInn,
      avatarUrl: editingStaff?.avatarUrl || `https://images.unsplash.com/photo-${1534528741775 + (staffList.length % 5) * 100}?w=120&auto=format&fit=crop&q=80`,
    };

    let ydbError: any = null;
    try {
      await saveStaffToYdb(staffToSave);
      saveStaff(staffToSave, orgId);
    } catch (err) {
      console.warn('YDB staff sync failed, saving locally:', err);
      ydbError = err;
      saveStaff(staffToSave, orgId);
    }

    onRefreshData();
    setIsStaffModalOpen(false);

    if (ydbError) {
      showFeedback(`Не удалось сохранить в YDB, данные сохранены локально (${ydbError?.message || 'ошибка сети'})`, 'error');
    } else {
      showFeedback(editingStaff ? `Данные сотрудника «${staffToSave.name}» сохранены в YDB` : `Сотрудник «${staffToSave.name}» успешно добавлен в YDB`);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!currentUser) {
      showFeedback('Для удаления сотрудника требуется войти в профиль руководства', 'error');
      onOpenLoginModal();
      return;
    }
    if (confirm(`Уволить / удалить сотрудника «${name}»?`)) {
      let ydbError: any = null;
      try {
        await deleteStaffFromYdb(id);
        deleteStaff(id, currentUser.organizationId);
      } catch (err) {
        console.warn('YDB staff delete sync failed, deleting locally:', err);
        ydbError = err;
        deleteStaff(id, currentUser.organizationId);
      }

      onRefreshData();
      if (ydbError) {
        showFeedback(`Не удалось удалить в YDB, сотрудник удален локально (${ydbError?.message || 'ошибка сети'})`, 'error');
      } else {
        showFeedback(`Сотрудник «${name}» удален из YDB`);
      }
    }
  };

  // Filtered Points & Staff
  const filteredPoints = points.filter(p => 
    p.name.toLowerCase().includes(pointSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(pointSearch.toLowerCase()) ||
    p.address.toLowerCase().includes(pointSearch.toLowerCase()) ||
    p.city.toLowerCase().includes(pointSearch.toLowerCase())
  );

  const filteredStaff = staffList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.role.toLowerCase().includes(staffSearch.toLowerCase());
    const memberPoints = Array.isArray(s.pointIds) && s.pointIds.length > 0 ? s.pointIds : [s.pointId];
    const matchesPoint = selectedPointFilter === 'all' || memberPoints.includes(selectedPointFilter);
    return matchesSearch && matchesPoint;
  });

  // CRITICAL SECURITY REQUIREMENT: Strictly hide employees and workplaces if user is not authenticated
  if (!currentUser) {
    return (
      <div className="space-y-6 text-xs max-w-4xl mx-auto py-8 sm:py-12 px-4 animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center text-white shadow-xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black mx-auto shadow-lg">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>

          <div className="max-w-xl mx-auto space-y-3">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Доступ ограничен
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Сотрудники и рабочие места скрыты
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              В целях защиты персональных данных персонала сети кофеен, PIN-кодов смен и коммерческой информации о локациях, просмотр и редактирование оргструктуры доступны только авторизованным руководителям сети.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm inline-flex items-center space-x-2 transition shadow-lg shadow-amber-500/20"
            >
              <Key className="w-4 h-4" />
              <span>Войти в профиль руководства сети</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 text-sm">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black shrink-0 shadow-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white">Оргструктура сети: Места работы и Сотрудники</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {points.length} точек
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {staffList.length} сотрудников
              </span>
            </div>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              Управление списком кофеен (мест работы), графиком открытия/закрытия, персоналом и их PIN-кодами для авторизации со смартфона и фиксации смен.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={activeSection === 'points' ? handleOpenCreatePoint : handleOpenCreateStaff}
            className={`px-4 py-2 rounded-xl font-bold transition flex items-center space-x-1.5 shadow-sm ${
              currentUser
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40'
            }`}
          >
            {currentUser ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>
              {currentUser 
                ? (activeSection === 'points' ? 'Добавить точку' : 'Принять сотрудника')
                : 'Войти для внесения изменений'}
            </span>
          </button>
        </div>
      </div>

      {/* Read-only / Logged out access prompt banner */}
      {!currentUser && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-900 dark:text-white text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold">Режим просмотра оргструктуры (Вы вышли из профиля)</div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Добавление, редактирование и удаление торговых точек и сотрудников заблокировано. Войдите в профиль руководства сети, чтобы получить доступ.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm self-start sm:self-auto"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Войти для внесения изменений</span>
          </button>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between animate-in fade-in ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center space-x-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="font-semibold">{feedbackMsg.text}</span>
          </div>
        </div>
      )}

      {/* Legal Entity Scoping Context Banner */}
      {currentUser && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {currentUser.organizationName || 'Основная организация'}
                </span>
                {currentUser.organizationInn && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">
                    ИНН {currentUser.organizationInn}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold text-[10px]">
                  Изолированная ячейка
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Строгая привязка: отображаются только торговые точки и персонал вашего юр. лица. Доступ к другим юр. лицам закрыт.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center space-x-2 text-[11px] font-mono text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span>
              {isDemoSession() 
                ? 'Демо-контур (без YDB)' 
                : `YDB: ydb-org-${currentUser.organizationInn || currentUser.organizationId || 'main'}`}
            </span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="tab-points-subnav-btn"
            onClick={() => setActiveSection('points')}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold transition text-xs sm:text-sm ${
              activeSection === 'points'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Места работы / Кофейни ({points.length})</span>
          </button>

          <button
            type="button"
            id="tab-staff-subnav-btn"
            onClick={() => setActiveSection('staff')}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold transition text-xs sm:text-sm ${
              activeSection === 'staff'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Сотрудники и роли ({staffList.length})</span>
          </button>

          <button
            type="button"
            id="tab-guide-subnav-btn"
            onClick={() => setActiveSection('guide')}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold transition text-xs sm:text-sm ${
              activeSection === 'guide'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>Инструкция для сотрудников</span>
          </button>
        </div>

        {activeSection === 'points' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Поиск по коду, названию, адресу..."
              value={pointSearch}
              onChange={(e) => setPointSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        )}

        {activeSection === 'staff' && (
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={selectedPointFilter}
              onChange={(e) => setSelectedPointFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="all">Все торговые точки</option>
              {points.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <div className="relative w-full sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Поиск сотрудника..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* SECTION 1: WORKPLACES / POINTS */}
      {/* =================================================================== */}
      {activeSection === 'points' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPoints.map((point) => {
              const assignedStaff = staffList.filter(s => s.pointId === point.id);
              return (
                <div 
                  key={point.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono font-bold text-xs border border-amber-500/20">
                          {point.code}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {point.city}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPoint(point)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                          title="Редактировать точку"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePoint(point.id, point.name)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition"
                          title="Удалить точку"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {point.name}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 flex items-start space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{point.address}</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                      <div className="bg-slate-50 dark:bg-slate-850 p-2 rounded-xl">
                        <div className="text-slate-400 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>Часы работы:</span>
                        </div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                          {point.openingTime} — {point.closingTime}
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-850 p-2 rounded-xl">
                        <div className="text-slate-400 flex items-center space-x-1">
                          <Key className="w-3 h-3 text-emerald-500" />
                          <span>PIN точки:</span>
                        </div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                          {point.pinCode}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>Управляющий:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{point.managerName || 'Не назначен'}</span>
                      </div>
                      {point.telegramChatId && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center space-x-1">
                            <Send className="w-3 h-3 text-sky-400" />
                            <span>Telegram:</span>
                          </span>
                          <span className="font-mono text-sky-600 dark:text-sky-400">{point.telegramChatId}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Штат сотрудников:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{assignedStaff.length} чел.</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onOpenQrTab(point.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center space-x-1 text-[11px]"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-500" />
                      <span>Печать QR на стойку</span>
                    </button>

                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {point.id}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPoints.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="font-bold text-sm text-slate-700 dark:text-slate-300">Точки не найдены</div>
              <p className="text-slate-400 text-xs">Измените строку поиска или добавьте новую точку в сеть</p>
              <button
                type="button"
                onClick={handleOpenCreatePoint}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить первую точку</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 2: STAFF & EMPLOYEES */}
      {/* =================================================================== */}
      {activeSection === 'staff' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map((member) => {
              const memberPointIds = Array.isArray(member.pointIds) && member.pointIds.length > 0 
                ? member.pointIds 
                : [member.pointId];
              const memberPoints = points.filter(p => memberPointIds.includes(p.id));

              return (
                <div 
                  key={member.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-black flex items-center justify-center text-sm shadow-sm shrink-0">
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {member.name}
                          </h3>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              {member.role}
                            </span>
                            {memberPoints.length > 1 && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                {memberPoints.length} точки
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditStaff(member)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                          title="Редактировать сотрудника и рабочие места"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(member.id, member.name)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition"
                          title="Уволить / Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Workplace & PIN info */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                      <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl space-y-1.5">
                        <div className="text-slate-400 flex items-center justify-between">
                          <span className="flex items-center space-x-1">
                            <Building2 className="w-3 h-3 text-amber-500" />
                            <span>Рабочие места ({memberPoints.length}):</span>
                          </span>
                          {memberPoints.length > 1 && (
                            <span className="text-[9px] text-amber-500 font-semibold">Ротация смен</span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {memberPoints.map(p => (
                            <span 
                              key={p.id} 
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-[10px] text-slate-800 dark:text-slate-200 shadow-2xs"
                              title={`${p.name} (${p.address})`}
                            >
                              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{p.code}</span>
                              <span className="truncate max-w-[120px]">{p.name.replace('Кофейня ', '').replace('Пекарня-кофейня ', '')}</span>
                            </span>
                          ))}
                          {memberPoints.length === 0 && (
                            <span className="text-rose-500 text-[10px]">Не привязан к точкам</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-850">
                        <span className="text-slate-400 flex items-center space-x-1">
                          <Building2 className="w-3 h-3 text-amber-500" />
                          <span>Юр. лицо:</span>
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[170px]" title={`${member.organizationName || 'Организация'}${member.organizationInn ? ` (ИНН ${member.organizationInn})` : ''}`}>
                          {member.organizationName || 'Организация'} {member.organizationInn && <span className="font-mono text-[10px] text-slate-400">({member.organizationInn})</span>}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-850">
                        <span className="text-slate-400 flex items-center space-x-1">
                          <Key className="w-3 h-3 text-emerald-500" />
                          <span>PIN для входа в PWA:</span>
                        </span>
                        <span className="font-mono font-black text-slate-900 dark:text-white tracking-widest text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {member.pinCode}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400">
                    <span>ID: {member.id}</span>
                    <span className="text-emerald-500 font-semibold flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Активный сотрудник</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredStaff.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="font-bold text-sm text-slate-700 dark:text-slate-300">Сотрудники не найдены</div>
              <p className="text-slate-400 text-xs">Проверьте фильтр торговой точки или добавьте нового сотрудника</p>
              <button
                type="button"
                onClick={handleOpenCreateStaff}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition inline-flex items-center space-x-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Принять первого сотрудника</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 3: STEP-BY-STEP USER LOGIN & WORKFLOW GUIDE */}
      {/* =================================================================== */}
      {activeSection === 'guide' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guide Card 1: Line Staff (Barista, Bakers) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">1. Как входят линейные сотрудники (Бариста)</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Вход без регистрации со смартфонов прямо на стойке кофейни</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">1</span>
                    <span>Сканирование QR-кода на стойке</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs pl-7">
                    Во вкладке <b>«QR-коды»</b> распечатайте стикер точки. Бариста сканирует QR камерой смартфона — в открывшемся PWA автоматически подставляется его точка и утренний чек-лист.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">2</span>
                    <span>Выбор своего имени и ввод 4-значного PIN</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs pl-7">
                    Во вкладке <b>«PWA Смартфон»</b> бариста выбирает свое имя (например, <i>Артем Белов</i>) и вводит 4-значный PIN (по умолчанию: <b>1111</b>, <b>2222</b>, <b>3333</b>, настраивается в карточке сотрудника).
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">3</span>
                    <span>Сдача смены с живыми фото</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs pl-7">
                    Сотрудник заполняет пункты, делает фото кофемашины и витрины, нажимает <b>«Сдать чек-лист»</b>. Акт уходит в YDB и сохраняется на VPS в MinIO.
                  </p>
                </div>
              </div>
            </div>

            {/* Guide Card 2: Managers, Directors & Auditors */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">2. Как входят управляющие и руководство</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Доступ к DataLens, YDB, MinIO S3, оргструктуре и конструктору</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">1</span>
                    <span>Кнопка в правом верхнем углу шапки</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs pl-7">
                    Нажмите на бейдж пользователя или кнопку <b>«Войти»</b> в правом верхнем углу навигационной панели.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">2</span>
                    <span>Быстрый вход в 1 клик или логин/пароль</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs pl-7">
                    Выберите готовую роль (<b>Владелец сети</b>, <b>Территориальный управляющий</b>, <b>Аудитор ХАССП</b>, <b>DevOps</b>) либо введите логин <code className="text-amber-500 font-bold">director</code> и пароль <code className="text-amber-500 font-bold">admin2026</code>.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">3</span>
                    <span>Анализ нарушений и контроль сети</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs pl-7">
                    После входа открывается тепловая карта нарушений в DataLens, аудит качества по точкам, выгрузка в 1С и прямые ссылки на фото в MinIO.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenLoginModal}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center justify-center space-x-2 shadow-sm text-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Открыть окно авторизации управляющего</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: ADD / EDIT WORKPLACE (POINT) */}
      {/* =================================================================== */}
      {isPointModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsPointModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {editingPoint ? 'Редактировать торговую точку' : 'Добавить новую торговую точку'}
                  </h3>
                  <p className="text-slate-500 text-xs">Место работы сотрудников и точка фиксации чек-листов</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPointModalOpen(false)}
                className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePointSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Код точки в 1С
                  </label>
                  <input
                    type="text"
                    required
                    value={pointForm.code || ''}
                    onChange={(e) => setPointForm({ ...pointForm, code: e.target.value })}
                    placeholder="ТТ-005"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Город
                  </label>
                  <input
                    type="text"
                    required
                    value={pointForm.city || ''}
                    onChange={(e) => setPointForm({ ...pointForm, city: e.target.value })}
                    placeholder="Москва или СПб"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Название торговой точки
                  </label>
                  <input
                    type="text"
                    required
                    value={pointForm.name || ''}
                    onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })}
                    placeholder="Кофейня «Таганка» или Кофе-бар «Сити»"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Фактический адрес
                  </label>
                  <input
                    type="text"
                    required
                    value={pointForm.address || ''}
                    onChange={(e) => setPointForm({ ...pointForm, address: e.target.value })}
                    placeholder="ул. Таганская, д. 24, стр. 1"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Время открытия (для фиксации опозданий)
                  </label>
                  <input
                    type="time"
                    required
                    value={pointForm.openingTime || '08:00'}
                    onChange={(e) => setPointForm({ ...pointForm, openingTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Время закрытия
                  </label>
                  <input
                    type="time"
                    required
                    value={pointForm.closingTime || '22:00'}
                    onChange={(e) => setPointForm({ ...pointForm, closingTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    4-значный PIN точки
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={pointForm.pinCode || ''}
                    onChange={(e) => setPointForm({ ...pointForm, pinCode: e.target.value })}
                    placeholder="2405"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    ФИО управляющего
                  </label>
                  <input
                    type="text"
                    value={pointForm.managerName || ''}
                    onChange={(e) => setPointForm({ ...pointForm, managerName: e.target.value })}
                    placeholder="Сергей Васильев"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Telegram бот / чат точки (для алертов о нарушениях)
                  </label>
                  <input
                    type="text"
                    value={pointForm.telegramChatId || ''}
                    onChange={(e) => setPointForm({ ...pointForm, telegramChatId: e.target.value })}
                    placeholder="@horeca_taganka_bot"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPointModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm"
                >
                  {editingPoint ? 'Сохранить изменения' : 'Создать точку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: ADD / EDIT STAFF MEMBER */}
      {/* =================================================================== */}
      {isStaffModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsStaffModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {editingStaff ? 'Редактировать сотрудника' : 'Принять нового сотрудника'}
                  </h3>
                  <p className="text-slate-500 text-xs">Привязка к месту работы и назначение персонального PIN</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  ФИО сотрудника
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.name || ''}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="Иван Петров"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Должность / Роль
                </label>
                <select
                  value={staffForm.role || 'Бариста'}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="Бариста">Бариста</option>
                  <option value="Шеф-бариста">Шеф-бариста</option>
                  <option value="Управляющий">Управляющий</option>
                  <option value="Пекарь">Пекарь</option>
                  <option value="Стажер">Стажер</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Привязка к юридическому лицу (ИНН) *
                </label>
                {(() => {
                  const allowedOrgs = currentUser?.role === 'app_admin' 
                    ? getOrganizations() 
                    : (currentUser ? getOrganizationsForUser(currentUser) : getOrganizations());
                  const list = allowedOrgs.length > 0 ? allowedOrgs : getOrganizations();
                  return (
                    <select
                      value={staffForm.organizationInn || (currentUser?.organizationInn || list[0]?.inn || '')}
                      onChange={(e) => {
                        const selInn = e.target.value;
                        const org = findOrganizationByInn(selInn);
                        setStaffForm({
                          ...staffForm,
                          organizationInn: selInn,
                          organizationId: org?.id,
                          organizationName: org?.name,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                    >
                      {list.map(org => (
                        <option key={org.id} value={org.inn}>
                          {org.name} (ИНН: {org.inn})
                        </option>
                      ))}
                    </select>
                  );
                })()}
                <p className="text-[10px] text-slate-400 mt-1">
                  Сотрудник должен быть привязан к зарегистрированному в системе юр. лицу по ИНН.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                    Рабочие места (Кофейни сети) *
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setStaffForm({ ...staffForm, pointIds: points.map(p => p.id), pointId: points[0]?.id || '' })}
                      className="text-[10px] text-amber-500 hover:underline"
                    >
                      Выбрать все ({points.length})
                    </button>
                    <span className="text-slate-400 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={() => setStaffForm({ ...staffForm, pointIds: [points[0]?.id || ''], pointId: points[0]?.id || '' })}
                      className="text-[10px] text-slate-400 hover:underline"
                    >
                      Только 1-я
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-2 max-h-44 overflow-y-auto">
                  {points.map(p => {
                    const isChecked = (staffForm.pointIds || []).includes(p.id);
                    return (
                      <label 
                        key={p.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border text-xs ${
                          isChecked 
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePointForStaff(p.id)}
                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300 rounded"
                          />
                          <div className="min-w-0">
                            <div className="font-bold truncate flex items-center space-x-1.5">
                              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{p.code}</span>
                              <span className="truncate">{p.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{p.address}</div>
                          </div>
                        </div>
                        {isChecked && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0 ml-2">
                            Назначен
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Линейный сотрудник может работать на нескольких точках сети (ротация бариста между кофейнями).
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                    Персональный 4-значный PIN-код
                  </label>
                  <button
                    type="button"
                    onClick={() => setStaffForm({ ...staffForm, pinCode: Math.floor(1000 + Math.random() * 9000).toString() })}
                    className="text-[10px] text-amber-500 hover:underline"
                  >
                    Сгенерировать случайный
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={staffForm.pinCode || ''}
                  onChange={(e) => setStaffForm({ ...staffForm, pinCode: e.target.value })}
                  placeholder="1234"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white text-xs font-mono tracking-widest focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Этот PIN вводится сотрудником при авторизации на телефоне при открытии смены.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm"
                >
                  {editingStaff ? 'Сохранить данные' : 'Принять сотрудника'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
