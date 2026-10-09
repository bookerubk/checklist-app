import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RefreshCw, 
  Sparkles, 
  Database, 
  Users, 
  MapPin, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Cloud, 
  HardDrive,
  UploadCloud,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { 
  getSystemDataSummary, 
  performCleanStart, 
  performFactoryDemoReset, 
  SystemDataSummary,
  CLEAN_START_FLAG 
} from '../../services/cleanStartService';
import { countYdbRecords, cleanYdbTables, YdbCountsResult } from '../../services/ydbAdminService';
import { fillDemoDataLocalStorage, pushLocalStorageToYdb, clearLocalStorageData } from '../../services/demoDataService';
import { CompanyOrganization, ManagerUser } from '../../types';
import { isDemoSession } from '../../services/managerAuth';

interface CleanStartManagerProps {
  onDataChanged?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const CleanStartManager: React.FC<CleanStartManagerProps> = ({
  onDataChanged,
  onNavigateToTab
}) => {
  const isDemo = isDemoSession();
  const [summary, setSummary] = useState<SystemDataSummary>(getSystemDataSummary());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResetDemoModalOpen, setIsResetDemoModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    org: CompanyOrganization;
    admin: ManagerUser;
  } | null>(null);

  // YDB data records state
  const [ydbCounts, setYdbCounts] = useState<YdbCountsResult | null>(null);
  const [isLoadingYdbCounts, setIsLoadingYdbCounts] = useState(false);
  const [isCleanYdbModalOpen, setIsCleanYdbModalOpen] = useState(false);
  const [isCleaningYdb, setIsCleaningYdb] = useState(false);
  const [ydbCleanResult, setYdbCleanResult] = useState<string | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');

  // Local storage demo operations feedback
  const [demoActionStatus, setDemoActionStatus] = useState<{ message: string; isError?: boolean } | null>(null);
  const [isPushingToYdb, setIsPushingToYdb] = useState(false);

  // Form for initial organization in clean start
  const [orgForm, setOrgForm] = useState({
    legalType: 'OOO' as 'OOO' | 'IP' | 'AO',
    name: 'ООО "Смарт Кофе"',
    brandName: 'Smart Coffee',
    inn: '7701987654',
    directorName: 'Иванов Иван Сергеевич',
    email: 'admin@smart-coffee.ru',
    phone: '+7 (999) 123-45-67',
    createFirstPoint: true,
  });

  const refreshState = () => {
    setSummary(getSystemDataSummary());
  };

  const loadYdbRecordCounts = async () => {
    setIsLoadingYdbCounts(true);
    try {
      const result = await countYdbRecords();
      setYdbCounts(result);
    } catch (e) {
      console.error('Failed to load YDB counts', e);
    } finally {
      setIsLoadingYdbCounts(false);
    }
  };

  useEffect(() => {
    refreshState();
    loadYdbRecordCounts();

    const handleUpdate = () => refreshState();
    window.addEventListener('checklist-data-cleared', handleUpdate);
    window.addEventListener('checklist-demo-restored', handleUpdate);
    window.addEventListener('storage-updated', handleUpdate);

    return () => {
      window.removeEventListener('checklist-data-cleared', handleUpdate);
      window.removeEventListener('checklist-demo-restored', handleUpdate);
      window.removeEventListener('storage-updated', handleUpdate);
    };
  }, []);

  const handleCleanYdbConfirm = async () => {
    if (isDemo) {
      alert('В демо-режиме очистка YDB недоступна.');
      return;
    }
    if (confirmPhrase !== 'DELETE ALL') return;
    setIsCleaningYdb(true);
    setYdbCleanResult(null);
    try {
      const result = await cleanYdbTables();
      if (result.success) {
        setYdbCleanResult('Таблицы в YDB успешно очищены.');
        setConfirmPhrase('');
        await loadYdbRecordCounts();
        if (onDataChanged) onDataChanged();
      } else {
        setYdbCleanResult('Произошла ошибка при очистке таблиц YDB.');
      }
    } catch (e: any) {
      setYdbCleanResult(`Ошибка: ${e?.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsCleaningYdb(false);
      setIsCleanYdbModalOpen(false);
    }
  };

  const handleFillDemoLocal = () => {
    fillDemoDataLocalStorage();
    refreshState();
    setDemoActionStatus({ message: 'Демо-данные добавлены в localStorage!' });
    if (onDataChanged) onDataChanged();
    setTimeout(() => setDemoActionStatus(null), 4000);
  };

  const handlePushLocalToYdb = async () => {
    setIsPushingToYdb(true);
    setDemoActionStatus(null);
    try {
      const res = await pushLocalStorageToYdb();
      if (res.errors && res.errors.length > 0) {
        setDemoActionStatus({
          message: `Передано: ${res.staff} сотрудников, ${res.points} точек, ${res.templates} шаблонов. Ошибок: ${res.errors.length}.`,
          isError: true,
        });
      } else {
        setDemoActionStatus({ 
          message: `Данные успешно отправлены в YDB: ${res.staff} сотрудников, ${res.points} точек, ${res.templates} шаблонов.` 
        });
      }
      await loadYdbRecordCounts();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      setDemoActionStatus({ message: `Ошибка при передаче в YDB: ${e?.message || 'сбой сети'}`, isError: true });
    } finally {
      setIsPushingToYdb(false);
      setTimeout(() => setDemoActionStatus(null), 6000);
    }
  };

  const handleClearLocalData = async () => {
    clearLocalStorageData();
    refreshState();
    await loadYdbRecordCounts();
    setDemoActionStatus({ message: 'Локальный кэш данных (localStorage) очищен.' });
    if (onDataChanged) onDataChanged();
    setTimeout(() => setDemoActionStatus(null), 4000);
  };

  const handleExecuteCleanStart = () => {
    if (isDemo) {
      alert('В демо-режиме очистка данных недоступна. Зарегистрируйте аккаунт для полного доступа.');
      return;
    }
    setIsProcessing(true);
    try {
      const result = performCleanStart({
        organizationName: orgForm.name,
        brandName: orgForm.brandName,
        inn: orgForm.inn,
        directorName: orgForm.directorName,
        email: orgForm.email,
        phone: orgForm.phone,
        legalType: orgForm.legalType,
      });

      setSuccessResult({
        org: result.organization,
        admin: result.adminUser,
      });
      setIsConfirmModalOpen(false);
      refreshState();
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (e) {
      console.error('Clean start failed', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteDemoReset = () => {
    if (isDemo) {
      alert('В демо-режиме это действие недоступно.');
      return;
    }
    setIsProcessing(true);
    try {
      performFactoryDemoReset();
      setSuccessResult(null);
      setIsResetDemoModalOpen(false);
      refreshState();
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (e) {
      console.error('Demo reset failed', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo Banner */}
      {isDemo && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-300 flex items-start space-x-2">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Демо-режим</div>
            <p className="text-xs mt-0.5">
              Разрушительные действия недоступны. Для полного доступа зарегистрируйте аккаунт.
            </p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                Инициализация платформы
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                summary.isCleanStartMode 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {summary.isCleanStartMode ? '✓ Режим: Чистый старт' : '⚙️ Режим: Демо-база'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Управление данными и чистый старт
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Механизм подготовки системы к промышленной эксплуатации: синхронизация с боевой Serverless YDB,
              очистка локального кэша и инициализация вашей головной организации.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={() => setIsResetDemoModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span>Восстановить демо-базу</span>
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition flex items-center justify-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Начать с чистого листа</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Banner if Clean Start was just executed */}
      {successResult && (
        <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-sm flex items-start justify-between gap-4 animate-in fade-in">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <div className="font-bold text-white">Система успешно очищена и запущена с чистого листа!</div>
              <div className="text-xs text-emerald-300">
                Зарегистрирована головная организация <span className="font-semibold text-white">{successResult.org.name}</span> (ИНН {successResult.org.inn}),
                создан профиль директора <span className="font-semibold text-white">{successResult.admin.name}</span> ({successResult.admin.email}),
                сформирована стартовая торговая точка.
              </div>
              <div className="text-xs text-slate-300 mt-1">
                Подключение к YDB: <span className="font-semibold text-emerald-400">Боевой контур YDB активен</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessResult(null)}
            className="text-xs text-emerald-400 hover:text-emerald-200 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* YDB Notification if cleaned */}
      {ydbCleanResult && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-200 flex items-center justify-between">
          <span>{ydbCleanResult}</span>
          <button 
            type="button" 
            onClick={() => setYdbCleanResult(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Current Data State Grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          💾 Локальный кэш браузера
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Точки сети</span>
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white">{summary.pointsCount}</div>
            <div className="text-[10px] text-slate-500">Кофеен / объектов</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Персонал</span>
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl font-bold text-white">{summary.staffCount}</div>
            <div className="text-[10px] text-slate-500">Сотрудников смены</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Чек-листы</span>
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white">{summary.submissionsCount}</div>
            <div className="text-[10px] text-slate-500">Сданных проверок</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Медиа S3</span>
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-white">{summary.s3MediaCount}</div>
            <div className="text-[10px] text-slate-500">Фото / отчётов</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Очередь</span>
              <HardDrive className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl font-bold text-white">{summary.queueCount}</div>
            <div className="text-[10px] text-slate-500">Офлайн-пакетов</div>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Это не окончательные данные. Источник истины — YDB.
        </p>
      </div>

      {/* SECTION 1: Данные в YDB */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-start space-x-3">
            <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  ☁️ Боевая YDB
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ☁️ Боевой контур
                </span>
                {ydbCounts?.errors && ydbCounts.errors.length > 0 && (
                  <span 
                    title={ydbCounts.errors.join('\n')}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1 cursor-help"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>⚠️ {ydbCounts.errors.length} {ydbCounts.errors.length === 1 ? 'ошибка' : 'ошибок'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Количество записей в таблицах клиентской базы YDB, полученных через Cloud Function.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={loadYdbRecordCounts}
              disabled={isLoadingYdbCounts}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingYdbCounts ? 'animate-spin' : ''}`} />
              <span>Обновить</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCleanYdbModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition flex items-center space-x-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить YDB</span>
            </button>
          </div>
        </div>

        {/* YDB Counts Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {isLoadingYdbCounts && !ydbCounts ? (
            <div className="col-span-full text-center py-6 text-xs text-slate-400 flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Запрос счётчиков из YDB...</span>
            </div>
          ) : (
            <>
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>staff</span>
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-xl font-bold text-white font-mono">
                  {ydbCounts?.counts?.staff ?? '—'}
                </div>
                <div className="text-[10px] text-slate-500">Сотрудники</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>locations</span>
                  <MapPin className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-white font-mono">
                  {ydbCounts?.counts?.locations ?? '—'}
                </div>
                <div className="text-[10px] text-slate-500">Точки</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>templates</span>
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-white font-mono">
                  {ydbCounts?.counts?.checklist_templates ?? '—'}
                </div>
                <div className="text-[10px] text-slate-500">Шаблоны</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>submissions</span>
                  <FileText className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-xl font-bold text-white font-mono">
                  {ydbCounts?.counts?.checklist_submissions ?? '—'}
                </div>
                <div className="text-[10px] text-slate-500">Чек-листы</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>violations</span>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-xl font-bold text-white font-mono">
                  {ydbCounts?.counts?.violations_log ?? '—'}
                </div>
                <div className="text-[10px] text-slate-500">Нарушения</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>audit</span>
                  <Layers className="w-4 h-4 text-teal-400" />
                </div>
                <div className="text-xl font-bold text-white font-mono">
                  {ydbCounts?.counts?.audit_log ?? '—'}
                </div>
                <div className="text-[10px] text-slate-500">Аудит</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SECTION 2: Демо-данные в localStorage */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-start space-x-3">
            <div className="p-3 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  Демо-данные в localStorage (кэш)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Офлайн / мгновенный отклик
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Управление тестовыми записями в браузере и возможность синхронизировать их в боевую базу YDB.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFillDemoLocal}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Заполнить демо</span>
            </button>
            <button
              type="button"
              onClick={handlePushLocalToYdb}
              disabled={isPushingToYdb}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center space-x-1.5"
            >
              {isPushingToYdb ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5" />
              )}
              <span>{isPushingToYdb ? 'Передача...' : 'Передать в YDB'}</span>
            </button>
            <button
              type="button"
              onClick={handleClearLocalData}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-300 hover:text-rose-200 border border-slate-700 text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Очистить кэш</span>
            </button>
          </div>
        </div>

        {demoActionStatus && (
          <div className={`p-3 rounded-2xl text-xs flex items-center space-x-2 ${
            demoActionStatus.isError 
              ? 'bg-rose-950/40 border border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-200'
          }`}>
            {demoActionStatus.isError ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{demoActionStatus.message}</span>
          </div>
        )}
      </div>

      {/* Clean Start Setup Wizard Card */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-red-400" />
            <h3 className="text-base font-bold text-white">
              Параметры первичной инициализации для чистого старта
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Заполните реквизиты вашей компании. После выполнения очистки старые демонстрационные данные будут
            заменены на единственную вашу организацию с правами администратора.
          </p>
        </div>

        {/* Input Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Форма собственности
            </label>
            <select
              value={orgForm.legalType}
              onChange={(e) => setOrgForm({ ...orgForm, legalType: e.target.value as any })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-red-500 outline-none"
            >
              <option value="OOO">ООО (Общество с ограниченной ответственностью)</option>
              <option value="IP">ИП (Индивидуальный предприниматель)</option>
              <option value="AO">АО (Акционерное общество)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Юридическое наименование компании
            </label>
            <input
              type="text"
              value={orgForm.name}
              onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
              placeholder="например: ООО «Академия Вкуса»"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-red-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Торговая марка / Бренд сети
            </label>
            <input
              type="text"
              value={orgForm.brandName}
              onChange={(e) => setOrgForm({ ...orgForm, brandName: e.target.value })}
              placeholder="например: Coffee Star"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-red-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              ИНН организации (10 или 12 цифр)
            </label>
            <input
              type="text"
              value={orgForm.inn}
              onChange={(e) => setOrgForm({ ...orgForm, inn: e.target.value.replace(/\D/g, '').slice(0, 12) })}
              placeholder="7701234567"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-red-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              ФИО руководителя
            </label>
            <input
              type="text"
              value={orgForm.directorName}
              onChange={(e) => setOrgForm({ ...orgForm, directorName: e.target.value })}
              placeholder="Иванов Иван Иванович"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-red-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email для входа руководителя
            </label>
            <input
              type="email"
              value={orgForm.email}
              onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
              placeholder="director@my-coffee.ru"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-red-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Контактный телефон
            </label>
            <input
              type="text"
              value={orgForm.phone}
              onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
              placeholder="+7 (999) 000-00-00"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-red-500 outline-none"
            />
          </div>
        </div>

        {/* Checkboxes for options */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={orgForm.createFirstPoint}
              onChange={(e) => setOrgForm({ ...orgForm, createFirstPoint: e.target.checked })}
              className="mt-0.5 rounded border-slate-700 bg-slate-900 text-red-500 focus:ring-red-500"
            />
            <div>
              <span className="text-xs font-bold text-white block">
                Создать стартовую торговую точку №1
              </span>
              <span className="text-[11px] text-slate-400 block">
                Создаст первичный объект сети с PIN-кодом планшета 1111, привязанный к вашему новому юр. лицу.
              </span>
            </div>
          </label>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Действие необратимо перезапишет текущие демонстрационные данные.</span>
          </div>

          <button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-xl shadow-red-600/30 transition flex items-center justify-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Очистить базу и инициализировать чистый старт</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: CONFIRM CLEAN START                              */}
      {/* ======================================================== */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Подтверждение очистки данных</h3>
                <p className="text-xs text-slate-400">Внимание: это действие перезапишет все таблицы</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="font-semibold text-white">Что будет выполнено:</div>
              <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
                <li>Удаление всех демонстрационных юр. лиц (ИП Смирнов, Кофе Холдинг, ИП Васильева).</li>
                <li>Очистка реестра персонала, торговых точек и {summary.submissionsCount} сданных чек-листов.</li>
                <li>Очистка очередей офлайн-синхронизации и временных медиафайлов.</li>
                <li>
                  Регистрация нового юр. лица <span className="font-semibold text-white">{orgForm.name}</span>.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleExecuteCleanStart}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-600/30 flex items-center space-x-1.5"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isProcessing ? 'Очистка...' : 'Да, выполнить очистку'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIRM YDB TABLES CLEANING                      */}
      {/* ======================================================== */}
      {isCleanYdbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Очистка таблиц YDB</h3>
                <p className="text-xs text-slate-400">Удаление всех строк из таблиц базы YDB</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-3">
              <p className="leading-relaxed">
                Будут выполнены запросы <code className="text-rose-300 font-mono">DELETE FROM ...</code> для таблиц 
                staff, locations, checklist_templates, checklist_submissions, violations_log, audit_log.
              </p>
              <p className="text-amber-300 font-semibold">
                Данные в YDB будут безвозвратно удалены.
              </p>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Для подтверждения введите фразу <strong className="text-white font-mono">DELETE ALL</strong>:
                </label>
                <input
                  type="text"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="DELETE ALL"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-xl text-xs font-mono text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isCleaningYdb}
                onClick={() => {
                  setIsCleanYdbModalOpen(false);
                  setConfirmPhrase('');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isCleaningYdb || confirmPhrase !== 'DELETE ALL'}
                onClick={handleCleanYdbConfirm}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition"
              >
                {isCleaningYdb ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isCleaningYdb ? 'Удаление...' : 'Да, очистить YDB'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIRM DEMO RESET                                */}
      {/* ======================================================== */}
      {isResetDemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Восстановление демо-базы</h3>
                <p className="text-xs text-slate-400">Загрузка примеров данных для тестирования</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>
                Будут восстановлены исходные 3 организации сети, 3 кофейни, 8 сотрудников смены,
                41 сданный чек-лист с нарушениями ХАССП и температурными графиками.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setIsResetDemoModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleExecuteDemoReset}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>{isProcessing ? 'Восстановление...' : 'Восстановить демо'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
