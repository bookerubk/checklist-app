import React, { useState, useEffect } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { FormBuilder } from './components/builder/FormBuilder';
import { MobileFormRunner } from './components/runner/MobileFormRunner';
import { QrPublisher } from './components/qr/QrPublisher';
import { TelegramBotSimulator } from './components/telegram/TelegramBotSimulator';
import { InspectionDocumentModal } from './components/common/InspectionDocumentModal';
import { MinioVpsHub } from './components/minio/MinioVpsHub';
import { YdbHub } from './components/ydb/YdbHub';
import { DataLensHub } from './components/datalens/DataLensHub';
import { ManagerLoginModal } from './components/auth/ManagerLoginModal';
import { StaffAndPointsManager } from './components/locations/StaffAndPointsManager';
import { CompanyDashboard } from './components/company/CompanyDashboard';
import { AppAdminDashboard } from './components/admin/AppAdminDashboard';
import { PlatformAdminAuthGuard } from './components/admin/PlatformAdminAuthGuard';
import { LandingPage } from './components/landing/LandingPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PREBUILT_TEMPLATES, INITIAL_POINTS, INITIAL_STAFF } from './mockData';
import { 
  initializeStorage, 
  getTemplates, 
  saveTemplate, 
  getPoints, 
  savePoint,
  getStaff, 
  saveStaff,
  deleteStaff,
  getSubmissions, 
  getQueue, 
  getTelegramAlerts,
  processSyncQueue
} from './services/storage';
import { getStaffFromYdb, saveStaffToYdb, deleteStaffFromYdb } from './services/ydbStaffService';
import { getPointsFromYdb, savePointToYdb } from './services/ydbLocationService';
import { getTemplatesFromYdb, saveTemplateToYdb } from './services/ydbTemplateService';
import { getSubmissionsFromYdb } from './services/ydbSubmissionService';
import { 
  getStoredAuthState, 
  setStoredAuthState, 
  logoutManager,
  isTabAllowedForRole, 
  ROLE_PERMISSIONS, 
  syncCustomManagersFromYdb,
  startDemoSession,
  isDemoSession,
  DEMO_SESSION_FLAG
} from './services/managerAuth';
import { isAppAdminUrl, setActiveOrganization, getActiveOrganization, getOrganizations, cleanInnString } from './services/companyService';
import { CLEAN_START_FLAG } from './services/cleanStartService';
import { STORAGE_YDB_CUSTOM_CONFIGURED } from './services/ydbService';
import { 
  ChecklistTemplate, 
  ChecklistSubmission, 
  PointLocation, 
  StaffMember, 
  QueueItem, 
  ManagerUser
} from './types';
import { ShieldAlert, ClipboardCheck, TrendingUp, Lock, Key } from 'lucide-react';

function parseDeepLinkParams() {
  if (typeof window === 'undefined') {
    return { isRunner: false, templateId: '', pointId: '' };
  }

  // 1. Check window.location.search
  const searchParams = new URLSearchParams(window.location.search);
  let mode = searchParams.get('mode');
  let templateId = searchParams.get('templateId') || '';
  let pointId = searchParams.get('pointId') || '';

  // 2. Check window.location.hash for SPAs / QR readers that append params to hash
  if ((!mode || !templateId || !pointId) && window.location.hash) {
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const hashParams = new URLSearchParams(hash.substring(qIndex + 1));
      mode = mode || hashParams.get('mode');
      templateId = templateId || hashParams.get('templateId') || '';
      pointId = pointId || hashParams.get('pointId') || '';
    }
    if (!mode && hash.toLowerCase().includes('runner')) {
      mode = 'runner';
    }
  }

  // 3. Sanitize invalid literal values like "undefined" or "null"
  if (templateId === 'undefined' || templateId === 'null') templateId = '';
  if (pointId === 'undefined' || pointId === 'null') pointId = '';

  const isRunner = mode === 'runner' || (window.location.hash.toLowerCase().includes('runner'));

  return { isRunner, templateId, pointId };
}

export default function App() {
  const initialDeepLink = parseDeepLinkParams();

  // Manager Auth State
  const [currentUser, setCurrentUser] = useState<ManagerUser | null>(getStoredAuthState);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Linear Staff View Mode: when true, UI is strictly a mobile terminal preview without manager navbar/menus
  // Scanned QR codes or direct links (?mode=runner) strictly enforce linear staff mode
  const [isLinearStaffMode, setIsLinearStaffMode] = useState<boolean>(() => initialDeepLink.isRunner);

  // Platform Admin View Mode: activated via URL /админ (or custom slug), #админ, ?admin=1, or role app_admin
  const [isAppAdminMode, setIsAppAdminMode] = useState<boolean>(() => isAppAdminUrl());

  useEffect(() => {
    const handleUrlChange = () => {
      if (isAppAdminUrl()) {
        setIsAppAdminMode(true);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // When logged in as app_admin, activate platform dashboard
  useEffect(() => {
    if (currentUser?.role === 'app_admin') {
      setIsAppAdminMode(true);
    }
  }, [currentUser?.role]);

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (initialDeepLink.isRunner) return 'runner';
    const user = getStoredAuthState();
    return user ? 'builder' : 'welcome';
  });

  const [networkOnline, setNetworkOnline] = useState<boolean>(true);

  // Data states initialized synchronously so data is immediately available on first frame
  const [templates, setTemplates] = useState<ChecklistTemplate[]>(() => {
    try {
      initializeStorage();
      const user = getStoredAuthState();
      if (!user) return [];
      const isClean = localStorage.getItem(CLEAN_START_FLAG) === 'true' || 
                      localStorage.getItem(STORAGE_YDB_CUSTOM_CONFIGURED) === 'true';
      const orgScope = user.role === 'app_admin' ? undefined : user.organizationId;
      const tpls = getTemplates(orgScope);
      return tpls.length > 0 ? tpls : (isClean ? [] : PREBUILT_TEMPLATES);
    } catch {
      return [];
    }
  });

  const [currentBuilderTemplate, setCurrentBuilderTemplate] = useState<ChecklistTemplate | null>(() => {
    try {
      const user = getStoredAuthState();
      if (!user) return null;
      const isClean = localStorage.getItem(CLEAN_START_FLAG) === 'true' || 
                      localStorage.getItem(STORAGE_YDB_CUSTOM_CONFIGURED) === 'true';
      const orgScope = user.role === 'app_admin' ? undefined : user.organizationId;
      const tpls = getTemplates(orgScope);
      return tpls[0] || (isClean ? null : (PREBUILT_TEMPLATES[0] || null));
    } catch {
      return null;
    }
  });

  const [runnerTemplateId, setRunnerTemplateId] = useState<string>(() => initialDeepLink.templateId);
  const [runnerPointId, setRunnerPointId] = useState<string>(() => initialDeepLink.pointId);

  const [points, setPoints] = useState<PointLocation[]>(() => {
    try {
      initializeStorage();
      const user = getStoredAuthState();
      if (!user) return [];
      const isClean = localStorage.getItem(CLEAN_START_FLAG) === 'true' || 
                      localStorage.getItem(STORAGE_YDB_CUSTOM_CONFIGURED) === 'true';
      const orgScope = user.role === 'app_admin' ? undefined : user.organizationId;
      const pts = getPoints(orgScope, user.organizationInn);
      if (user.role !== 'app_admin') {
        return pts;
      }
      return pts.length > 0 ? pts : (isClean ? [] : INITIAL_POINTS);
    } catch {
      return [];
    }
  });

  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    try {
      initializeStorage();
      const user = getStoredAuthState();
      if (!user) return [];
      const isClean = localStorage.getItem(CLEAN_START_FLAG) === 'true' || 
                      localStorage.getItem(STORAGE_YDB_CUSTOM_CONFIGURED) === 'true';
      const orgScope = user.role === 'app_admin' ? undefined : user.organizationId;
      const stf = getStaff(orgScope, user.organizationInn);
      if (user.role !== 'app_admin') {
        return stf;
      }
      return stf.length > 0 ? stf : (isClean ? [] : INITIAL_STAFF);
    } catch {
      return [];
    }
  });

  const [submissions, setSubmissions] = useState<ChecklistSubmission[]>(() => {
    try {
      return getSubmissions();
    } catch {
      return [];
    }
  });

  const [queue, setQueue] = useState<QueueItem[]>(() => {
    try {
      return getQueue();
    } catch {
      return [];
    }
  });

  const [unreadAlertsCount, setUnreadAlertsCount] = useState<number>(() => {
    try {
      const alerts = getTelegramAlerts();
      return alerts.filter(a => !a.read).length;
    } catch {
      return 0;
    }
  });

  const [activeInspectionDoc, setActiveInspectionDoc] = useState<ChecklistSubmission | null>(null);

  const [globalFeedback, setGlobalFeedback] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const showGlobalFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setGlobalFeedback({ text, type });
    setTimeout(() => setGlobalFeedback(null), 4000);
  };

  // Initialize storage & re-verify deep link parameters on mount
  useEffect(() => {
    // Если это демо-сессия — при F5 всегда перезагружаем демо-данные
    if (isDemoSession()) {
      const demoUser = startDemoSession(); // перезаписывает localStorage
      setCurrentUser(demoUser);
      setActiveOrganization(demoUser.organizationId);
      refreshAllData(demoUser);
      // В демо-сессии не делаем сетевых запросов к YDB (0 запросов)
      return;
    }

    // Синхронизация управленцев из YDB перед getStoredAuthState (боевой контур)
    syncCustomManagersFromYdb().then(() => {
      // После синхронизации — перечитать сессию (на случай, если пользователь новый)
      const refreshedUser = getStoredAuthState();
      if (refreshedUser && !currentUser) {
        if (refreshedUser.role !== 'app_admin') {
          const orgs = getOrganizations();
          const cleanInn = refreshedUser.organizationInn ? cleanInnString(refreshedUser.organizationInn) : '';
          const userOrg = orgs.find(o => 
            (refreshedUser.organizationId && o.id === refreshedUser.organizationId) ||
            (cleanInn && cleanInnString(o.inn) === cleanInn)
          );
          if (!userOrg) {
            logoutManager();
            setCurrentUser(null);
            setActiveOrganization('');
            refreshAllData(null);
            setActiveTab('welcome');
            return;
          }
          setActiveOrganization(userOrg.id);
        }
        setCurrentUser(refreshedUser);
        refreshAllData(refreshedUser);
      }
    }).catch(err => {
      console.warn('YDB managers sync fallback:', err);
    });

    initializeStorage();
    const user = getStoredAuthState();
    if (user) {
      if (user.role !== 'app_admin') {
        const orgs = getOrganizations();
        const cleanInn = user.organizationInn ? cleanInnString(user.organizationInn) : '';
        const userOrg = orgs.find(o => 
          (user.organizationId && o.id === user.organizationId) ||
          (cleanInn && cleanInnString(o.inn) === cleanInn)
        );
        if (!userOrg) {
          logoutManager();
          setCurrentUser(null);
          setActiveOrganization('');
          refreshAllData(null);
          setActiveTab('welcome');
          return;
        }
        setActiveOrganization(userOrg.id);
      }
      setCurrentUser(user);
      refreshAllData(user);
    } else {
      setCurrentUser(null);
      setActiveOrganization('');
      refreshAllData(null);
      setActiveTab('welcome');
    }

    const params = parseDeepLinkParams();
    if (params.isRunner) {
      setIsLinearStaffMode(true);
      setActiveTab('runner');
      if (params.templateId) setRunnerTemplateId(params.templateId);
      if (params.pointId) setRunnerPointId(params.pointId);
    }
  }, []);

  const refreshAllData = (overrideUser?: ManagerUser | null) => {
    const activeUser = overrideUser !== undefined ? overrideUser : currentUser;

    // Если пользователь не залогинен — не тянуть данные из YDB.
    // Показываем пустое состояние (SplashScreen и так ведёт себя корректно).
    if (!activeUser) {
      setTemplates([]);
      setPoints([]);
      setStaffList([]);
      setSubmissions([]);
      setQueue([]);
      setUnreadAlertsCount(0);
      return;
    }

    const isDemo = isDemoSession();
    const orgScope = activeUser.role === 'app_admin' ? undefined : activeUser.organizationId;
    const orgInn = activeUser.role === 'app_admin' ? undefined : activeUser.organizationInn;

    const tpls = getTemplates(orgScope);
    setTemplates(tpls);
    if (!currentBuilderTemplate && tpls.length > 0) {
      setCurrentBuilderTemplate(tpls[0]);
    }
    setPoints(getPoints(orgScope, orgInn));
    setStaffList(getStaff(orgScope, orgInn));
    setSubmissions(getSubmissions());

    // Асинхронно подтягиваем свежие данные из реальной YDB (только вне демо-сессии)
    if (!isDemo) {
      getStaffFromYdb(orgScope).then(ydbStaff => {
        if (ydbStaff && ydbStaff.length > 0) {
          setStaffList(ydbStaff);
        }
      }).catch(err => {
        console.warn('YDB staff fetch fallback to local cache:', err?.message);
      });

      getPointsFromYdb(orgScope).then(ydbPoints => {
        if (ydbPoints && ydbPoints.length > 0) {
          setPoints(ydbPoints);
        }
      }).catch(err => {
        console.warn('YDB points fetch fallback to local cache:', err?.message);
      });

      getTemplatesFromYdb(orgScope).then(ydbTemplates => {
        if (ydbTemplates && ydbTemplates.length > 0) {
          setTemplates(ydbTemplates);
        }
      }).catch(err => {
        console.warn('YDB templates fetch fallback to local cache:', err?.message);
      });

      getSubmissionsFromYdb(orgScope).then(ydbSubmissions => {
        if (ydbSubmissions && ydbSubmissions.length > 0) {
          setSubmissions(ydbSubmissions);
        }
      }).catch(err => {
        console.warn('YDB submissions fetch fallback to local cache:', err?.message);
      });
    }

    setQueue(getQueue());
    const alerts = getTelegramAlerts();
    setUnreadAlertsCount(alerts.filter(a => !a.read).length);
  };

  useEffect(() => {
    const handleStorageUpdate = () => {
      refreshAllData();
    };
    window.addEventListener('checklist-demo-restored', handleStorageUpdate);
    window.addEventListener('checklist-data-cleared', handleStorageUpdate);
    return () => {
      window.removeEventListener('checklist-demo-restored', handleStorageUpdate);
      window.removeEventListener('checklist-data-cleared', handleStorageUpdate);
    };
  }, []);

  const handleSaveTemplate = async (
    tpl: ChecklistTemplate
  ): Promise<{ success: boolean; error?: string }> => {
    let ydbError: string | undefined;
    try {
      await saveTemplateToYdb(tpl);
    } catch (err: any) {
      console.warn('YDB template sync failed, saving locally:', err);
      ydbError = err?.message || 'ошибка сети';
    }
    const saved = saveTemplate(tpl);
    refreshAllData();
    setCurrentBuilderTemplate(saved);
    return ydbError ? { success: false, error: ydbError } : { success: true };
  };

  const handleOpenRunner = (templateId: string, pointId?: string) => {
    if (templateId) setRunnerTemplateId(templateId);
    if (pointId) setRunnerPointId(pointId);
    setIsLinearStaffMode(true);
    setActiveTab('runner');
  };

  const handleOpenBuilder = (templateId: string) => {
    const tpl = templates.find(t => t.id === templateId) || templates[0];
    if (tpl) {
      setCurrentBuilderTemplate(tpl);
      setActiveTab('builder');
    }
  };

  const handleOpenInspectionDoc = (docNumber: string) => {
    const doc = submissions.find(s => s.number1C === docNumber);
    if (doc) {
      setActiveInspectionDoc(doc);
    }
  };

  const handleSyncQueue = () => {
    processSyncQueue();
    refreshAllData();
  };

  const handleUserChange = (user: ManagerUser | null) => {
    if (!user) {
      logoutManager();
      setCurrentUser(null);
      setStoredAuthState(null);
      setActiveOrganization('');
      refreshAllData(null);
      setActiveTab('welcome');
      return;
    }

    const isDemo = isDemoSession();

    // Строгая проверка привязки к юр. лицу (Дефект №5):
    if (user.role !== 'app_admin') {
      const orgs = getOrganizations();
      const cleanInn = user.organizationInn ? cleanInnString(user.organizationInn) : '';
      const userOrg = orgs.find(o => 
        (user.organizationId && o.id === user.organizationId) ||
        (cleanInn && cleanInnString(o.inn) === cleanInn)
      );

      if (!userOrg) {
        logoutManager();
        setCurrentUser(null);
        setStoredAuthState(null);
        setActiveOrganization('');
        refreshAllData(null);
        setActiveTab('welcome');
        showGlobalFeedback(
          `Доступ заблокирован: организация «${user.organizationName || user.organizationId || 'не указана'}» не найдена в реестре зарегистрированных юридических лиц.`,
          'error'
        );
        return;
      }

      setActiveOrganization(userOrg.id);
    }

    setCurrentUser(user);
    setStoredAuthState(user);
    refreshAllData(user);

    if (user.role === 'app_admin') {
      showGlobalFeedback('Загружены данные платформы (все организации)');
    } else if (isDemo) {
      showGlobalFeedback('Демо-режим активен. Изменения не сохраняются. Для выхода — зарегистрируйтесь.', 'success');
    } else {
      const userOrg = getOrganizations().find(o => o.id === user.organizationId);
      if (userOrg) {
        showGlobalFeedback(`Загружены данные организации «${userOrg.name}»`);
      }
    }

    if (!isTabAllowedForRole(user.role, activeTab) || activeTab === 'welcome') {
      const allowed = ROLE_PERMISSIONS[user.role]?.allowedTabs || ['builder', 'datalens'];
      setActiveTab(allowed.find(t => t !== 'welcome') || 'builder');
    }
  };

  const handleAddStaff = async (newStaff: Omit<StaffMember, 'id'>) => {
    const activeOrg = getActiveOrganization();
    const orgId = currentUser?.organizationId || activeOrg?.id || 'org-horeca-1';
    const member: StaffMember = {
      ...newStaff,
      id: `stf-${Date.now()}`,
      organizationId: orgId,
      organizationName: currentUser?.organizationName || activeOrg?.name || 'Организация',
      organizationInn: currentUser?.organizationInn || activeOrg?.inn || '',
    };

    let ydbError: string | undefined;
    try {
      await saveStaffToYdb(member);
    } catch (err: any) {
      console.warn('YDB save staff failed, saving locally:', err);
      ydbError = err?.message || 'ошибка сети';
    }
    saveStaff(member, orgId);
    refreshAllData();

    if (ydbError) {
      showGlobalFeedback(`Сотрудник сохранён локально, YDB недоступен: ${ydbError}`, 'error');
    } else {
      showGlobalFeedback(`Сотрудник «${member.name}» сохранён в YDB`);
    }
  };

  const handleUpdateStaff = async (staff: StaffMember) => {
    const activeOrg = getActiveOrganization();
    const orgId = currentUser?.organizationId || staff.organizationId || activeOrg?.id || 'org-horeca-1';
    const updatedMember: StaffMember = {
      ...staff,
      organizationName: staff.organizationName || currentUser?.organizationName || activeOrg?.name || 'Организация',
      organizationInn: staff.organizationInn || currentUser?.organizationInn || activeOrg?.inn || '',
    };

    let ydbError: string | undefined;
    try {
      await saveStaffToYdb(updatedMember);
    } catch (err: any) {
      console.warn('YDB update staff failed, saving locally:', err);
      ydbError = err?.message || 'ошибка сети';
    }
    saveStaff(updatedMember, orgId);
    refreshAllData();

    if (ydbError) {
      showGlobalFeedback(`Данные сотрудника обновлены локально, YDB недоступен: ${ydbError}`, 'error');
    } else {
      showGlobalFeedback(`Данные сотрудника «${updatedMember.name}» обновлены в YDB`);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    let ydbError: string | undefined;
    try {
      await deleteStaffFromYdb(staffId);
    } catch (err: any) {
      console.warn('YDB delete staff failed, deleting locally:', err);
      ydbError = err?.message || 'ошибка сети';
    }
    deleteStaff(staffId, currentUser?.organizationId);
    refreshAllData();

    if (ydbError) {
      showGlobalFeedback(`Сотрудник удалён локально, YDB недоступен: ${ydbError}`, 'error');
    } else {
      showGlobalFeedback(`Сотрудник удалён из YDB`);
    }
  };

  const handleAddPoint = async (newPoint: Omit<PointLocation, 'id'>) => {
    const activeOrg = getActiveOrganization();
    const orgId = currentUser?.organizationId || activeOrg?.id || 'org-horeca-1';
    const point: PointLocation = {
      ...newPoint,
      id: `pt-${Date.now()}`,
      organizationId: orgId,
      organizationName: currentUser?.organizationName || activeOrg?.name || 'Организация',
      organizationInn: currentUser?.organizationInn || activeOrg?.inn || '',
    };

    let ydbError: string | undefined;
    try {
      await savePointToYdb(point);
    } catch (err: any) {
      console.warn('YDB save point failed, saving locally:', err);
      ydbError = err?.message || 'ошибка сети';
    }
    savePoint(point, orgId);
    refreshAllData();

    if (ydbError) {
      showGlobalFeedback(`Точка сохранена локально, YDB недоступен: ${ydbError}`, 'error');
    } else {
      showGlobalFeedback(`Точка «${point.name}» сохранена в YDB`);
    }
  };

  const isCurrentTabAllowed = currentUser
    ? isTabAllowedForRole(currentUser.role, activeTab)
    : (activeTab === 'welcome' || activeTab === 'runner' || activeTab === 'datalens' || activeTab === 'builder' || activeTab === 'qr');

  // If in Linear Staff mode, render strictly the mobile preview with no manager navbar
  if (isLinearStaffMode) {
    return (
      <div className="h-[100dvh] min-h-[100dvh] w-full bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-start sm:justify-center font-sans p-0 overflow-hidden">
        <ErrorBoundary>
          <MobileFormRunner
            templates={templates}
            points={points}
            staffList={staffList}
            initialTemplateId={runnerTemplateId}
            initialPointId={runnerPointId}
            networkOnline={networkOnline}
            onViewInspectionDoc={handleOpenInspectionDoc}
            onRefreshSubmissions={refreshAllData}
            isStandaloneMobilePreview={true}
            onSwitchToManagerPanel={() => {
              setIsLinearStaffMode(false);
              if (!currentUser) {
                setActiveTab('welcome');
              }
            }}
            currentUser={currentUser}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
          />
        </ErrorBoundary>

        {/* Manager Login Modal */}
        <ManagerLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          currentUser={currentUser}
          points={points}
          onLoginSuccess={user => {
            handleUserChange(user);
            setIsLoginModalOpen(false);
            setIsLinearStaffMode(false);
          }}
        />

        {/* Global Document Viewer Modal */}
        <InspectionDocumentModal
          submission={activeInspectionDoc}
          isOpen={!!activeInspectionDoc}
          onClose={() => setActiveInspectionDoc(null)}
        />
      </div>
    );
  }

  const handleExitAdminMode = () => {
    setIsAppAdminMode(false);
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('admin') || window.location.hash.includes('админ')) {
        window.location.hash = '';
      }
      if (window.location.search.includes('admin') || window.location.search.includes('админ')) {
        const u = new URL(window.location.href);
        u.searchParams.delete('admin');
        u.searchParams.delete('mode');
        window.history.replaceState({}, '', u.pathname);
      }
      const decodedPath = decodeURIComponent(window.location.pathname || '').toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '');
      if (decodedPath === 'админ' || decodedPath === 'admin') {
        window.history.replaceState({}, '', '/');
      }
    }
  };

  // If in Platform Admin mode: enforce strict role check (only app_admin allowed)
  if (isAppAdminMode) {
    if (currentUser?.role === 'app_admin') {
      return (
        <AppAdminDashboard
          currentUser={currentUser}
          points={points}
          staffList={staffList}
          onExitAdminMode={handleExitAdminMode}
          onRefreshData={refreshAllData}
          onUserChange={handleUserChange}
        />
      );
    }

    // Unauthorized or non-admin manager attempting to access platform admin:
    return (
      <PlatformAdminAuthGuard
        currentUser={currentUser}
        onLoginSuccess={(adminUser) => {
          handleUserChange(adminUser);
          setIsAppAdminMode(true);
        }}
        onExit={handleExitAdminMode}
        onLogout={() => {
          handleUserChange(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Universal Top Navigation Header with RBAC */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        networkOnline={networkOnline}
        setNetworkOnline={setNetworkOnline}
        queueCount={queue.length}
        unreadAlertsCount={unreadAlertsCount}
        onSyncQueue={handleSyncQueue}
        currentUser={currentUser}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onUserChange={handleUserChange}
        onSwitchToLinearStaffMode={() => setIsLinearStaffMode(true)}
        onOpenAppAdmin={() => setIsAppAdminMode(true)}
      />

      {/* Read-Only Access Notice Banner when logged out */}
      {!currentUser && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2.5 text-sm text-slate-800 dark:text-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <Lock className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Режим просмотра (Вы вышли из профиля):</span>{' '}
                <span className="text-slate-600 dark:text-slate-400">
                  Внесение изменений в чек-листы, персонал и кофейни заблокировано.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="shrink-0 flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-xs self-start sm:self-auto"
            >
              <Key className="w-4 h-4" />
              <span>Войти для редактирования</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-6 min-w-0">
        {/* RBAC Access Denied Notification if tab is restricted */}
        {!isCurrentTabAllowed && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-3xl p-6 sm:p-8 text-center max-w-2xl mx-auto my-8 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {currentUser ? 'Доступ к разделу ограничен' : 'Требуется авторизация разработчика'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              {currentUser ? (
                <>
                  Ваша роль — <strong className="text-slate-900 dark:text-white">{currentUser.roleTitle}</strong>.
                  {currentUser.role === 'manager' 
                    ? ' Управляющему доступны добавление чек-листов (Конструктор), доступ к отчётности (DataLens), управление точками и QR-кодами.'
                    : ' Для доступа ко всей инфраструктуре, включая сырой YDB SQL и MinIO VPS, требуется роль разработчика.'}
                </>
              ) : (
                'Вы вышли из профиля. Доступ к инфраструктуре (сервер YDB SQL и хранилище MinIO S3) ограничен и требует авторизации с ролью разработчика.'
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm"
              >
                <Key className="w-4 h-4" />
                <span>{currentUser ? 'Сменить пользователя' : 'Войти для внесения изменений'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('builder')}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold border border-slate-700 transition"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Конструктор чек-листов</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('datalens')}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Отчётность DataLens</span>
              </button>
            </div>
          </div>
        )}

        {/* Public Landing Page */}
        {isCurrentTabAllowed && activeTab === 'welcome' && (
          <LandingPage
            currentUser={currentUser}
            onLogin={() => setIsLoginModalOpen(true)}
            onTryDemo={() => {
              const demoUser = startDemoSession();
              setActiveOrganization(demoUser.organizationId);
              handleUserChange(demoUser);
              setActiveTab('company');
            }}
          />
        )}

        {/* PWA Mobile Checklist Runner */}
        {isCurrentTabAllowed && activeTab === 'runner' && (
          <ErrorBoundary>
            <MobileFormRunner
              templates={templates}
              points={points}
              staffList={staffList}
              initialTemplateId={runnerTemplateId}
              initialPointId={runnerPointId}
              networkOnline={networkOnline}
              onViewInspectionDoc={handleOpenInspectionDoc}
              onRefreshSubmissions={refreshAllData}
              isStandaloneMobilePreview={false}
              onSwitchToManagerPanel={() => setIsLinearStaffMode(false)}
              currentUser={currentUser}
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
            />
          </ErrorBoundary>
        )}

        {/* Yandex DataLens Reports & BI Heatmap */}
        {isCurrentTabAllowed && activeTab === 'datalens' && (
          <DataLensHub
            points={points}
            currentUser={currentUser}
            onOpenAuth={() => setIsLoginModalOpen(true)}
          />
        )}

        {/* Managed Service for YDB (Serverless SQL) */}
        {isCurrentTabAllowed && activeTab === 'ydb' && (
          isDemoSession() ? (
            <div className="p-8 text-center max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Lock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">YDB-консоль недоступна в демо-режиме</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Зарегистрируйте аккаунт для доступа к инфраструктуре.
              </p>
            </div>
          ) : (
            <YdbHub />
          )
        )}

        {/* Yandex Cloud (Serverless Containers + Object Storage S3) */}
        {isCurrentTabAllowed && activeTab === 'minio' && (
          <MinioVpsHub />
        )}

        {/* Company Organization & Tariffs Dashboard */}
        {isCurrentTabAllowed && activeTab === 'company' && (
          <CompanyDashboard
            currentUser={currentUser}
            points={points}
            staffList={staffList}
            onAddStaff={handleAddStaff}
            onUpdateStaff={handleUpdateStaff}
            onDeleteStaff={handleDeleteStaff}
            onAddPoint={handleAddPoint}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
          />
        )}

        {/* Staff and Workplaces / Locations Manager */}
        {isCurrentTabAllowed && activeTab === 'staff_points' && (
          <StaffAndPointsManager
            points={points}
            staffList={staffList}
            onRefreshData={refreshAllData}
            onOpenQrTab={() => setActiveTab('qr')}
            currentUser={currentUser}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
          />
        )}

        {/* Checklist Forms Builder */}
        {isCurrentTabAllowed && activeTab === 'builder' && currentBuilderTemplate && (
          <FormBuilder
            currentTemplate={currentBuilderTemplate}
            onSaveTemplate={handleSaveTemplate}
            points={points}
            onOpenRunner={handleOpenRunner}
            currentUser={currentUser}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
          />
        )}

        {/* Telegram Alerts Channel */}
        {isCurrentTabAllowed && activeTab === 'telegram' && (
          <TelegramBotSimulator
            onOpenDoc={handleOpenInspectionDoc}
            onRefreshAlerts={refreshAllData}
          />
        )}

        {/* QR Publisher */}
        {isCurrentTabAllowed && activeTab === 'qr' && (
          <QrPublisher
            templates={templates}
            points={points}
            currentUser={currentUser}
            onOpenRunner={handleOpenRunner}
          />
        )}
      </main>

      {/* Global Feedback Toast */}
      {globalFeedback && (
        <div
          className={`fixed bottom-4 right-4 z-[100] max-w-md p-4 rounded-2xl shadow-2xl text-sm font-semibold animate-in fade-in slide-in-from-bottom-2 cursor-pointer ${
            globalFeedback.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
          onClick={() => setGlobalFeedback(null)}
          role="status"
        >
          {globalFeedback.text}
        </div>
      )}

      {/* Manager Login Modal */}
      <ManagerLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        points={points}
        onLoginSuccess={user => {
          handleUserChange(user);
          setIsLoginModalOpen(false);
          setIsLinearStaffMode(false);
        }}
      />

      {/* Global Document Viewer Modal */}
      <InspectionDocumentModal
        submission={activeInspectionDoc}
        isOpen={!!activeInspectionDoc}
        onClose={() => setActiveInspectionDoc(null)}
      />
    </div>
  );
}
