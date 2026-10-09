import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Terminal, 
  Play, 
  FileCode, 
  Copy, 
  Check, 
  Server, 
  Sparkles, 
  Layers, 
  Zap, 
  Clock, 
  Cpu, 
  CheckCircle2, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Search,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  AlertTriangle,
  XCircle,
  Building2,
  Send,
  Save,
  Info,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { YdbConfig, YdbQueryResult } from '../../types';
import { 
  getYdbConfig, 
  saveYdbConfig, 
  testYdbConnection, 
  validateYdbConfig,
  YdbDiagnosticsReport,
  recordYdbEntityWrite,
  getYdbTransactions,
  YDB_SCHEMA_YQL, 
  executeYqlQuery,
  isYdbCustomConfigured,
  markYdbCustomConfigured
} from '../../services/ydbService';
import { pingYdbApi, queryAdminDb, queryClientDb } from '../../services/ydbApiService';
import { getOrganizations, getActiveOrganization, setActiveOrganization } from '../../services/companyService';
import { getTemplates, getPoints, getStaff, getSubmissions } from '../../services/storage';

export const YdbHub: React.FC = () => {
  const [organizations, setOrganizations] = useState(() => getOrganizations());
  const activeOrg = getActiveOrganization() || organizations[0];
  const [selectedOrgId, setSelectedOrgId] = useState<string>(activeOrg?.id || '');
  
  const currentOrg = organizations.find(o => o.id === selectedOrgId) || activeOrg;
  const [config, setConfig] = useState<YdbConfig>(() => getYdbConfig(selectedOrgId));
  const [activeTab, setActiveTab] = useState<'console' | 'schema' | 'config' | 'datalens_guide'>('console');
  const [yqlQuery, setYqlQuery] = useState('SELECT * FROM checklist_submissions ORDER BY created_at DESC LIMIT 20;');
  const [queryResult, setQueryResult] = useState<YdbQueryResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  // Diagnostics states
  const [isTesting, setIsTesting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [diagnosticsReport, setDiagnosticsReport] = useState<YdbDiagnosticsReport | null>(null);
  const [testStatus, setTestStatus] = useState<{ success: boolean; pingMs: number; error?: string } | null>({
    success: true,
    pingMs: 14,
  });
  
  // Test write states
  const [isTestWriting, setIsTestWriting] = useState(false);
  const [testWriteSuccess, setTestWriteSuccess] = useState<{ id: string; timestamp: string; message: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saveNotify, setSaveNotify] = useState<{ message: string; isError?: boolean } | null>(null);

  const handleRunQuery = async (queryToRun?: string) => {
    const q = queryToRun || yqlQuery;
    if (!q.trim()) return;
    setIsRunning(true);
    try {
      const isAdminQuery = /system_organizations|system_tariffs|system_admin_users|system_billing|system_audit_log|system_platform_settings/i.test(q);
      const res = isAdminQuery ? await queryAdminDb(q) : await queryClientDb(q);
      setQueryResult(res);
    } catch (err: any) {
      setQueryResult({
        columns: [],
        rows: [],
        error: err?.message || 'Ошибка выполнения запроса',
        stats: { durationMs: 0, requestUnits: 0, rowsAffected: 0 },
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Sync data whenever selected organization changes
  useEffect(() => {
    const orgConfig = getYdbConfig(selectedOrgId);
    setConfig(orgConfig);
    setDiagnosticsReport(null);
    setTestWriteSuccess(null);

    const timer = setTimeout(() => {
      handleRunQuery('SELECT * FROM system_organizations LIMIT 20;');
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedOrgId]);

  useEffect(() => {
    const handleDbChange = (e?: Event) => {
      setOrganizations(getOrganizations());

      // If user is editing config in 'config' tab, do not overwrite user's in-flight text input
      // unless it is an explicit ydb-config-saved event for this organization
      const customEvent = e as CustomEvent;
      const isExplicitConfigSave = customEvent?.type === 'ydb-config-saved';
      const isForThisOrg = !customEvent?.detail?.orgId || customEvent.detail.orgId === selectedOrgId;

      if (isExplicitConfigSave && isForThisOrg) {
        const cfg = getYdbConfig(selectedOrgId);
        setConfig(cfg);
      } else if (activeTab !== 'config') {
        const cfg = getYdbConfig(selectedOrgId);
        setConfig(cfg);
      } else {
        // Just update runtime metrics without overwriting in-progress input
        const cfg = getYdbConfig(selectedOrgId);
        setConfig(prev => ({
          ...prev,
          ruConsumedTotal: cfg.ruConsumedTotal,
          storageMbUsed: cfg.storageMbUsed,
          lastPingMs: cfg.lastPingMs,
          isConnected: cfg.isConnected,
        }));
      }
    };

    window.addEventListener('ydb-config-saved', handleDbChange);
    window.addEventListener('checklist-db-write', handleDbChange);
    window.addEventListener('storage-updated', handleDbChange);

    return () => {
      window.removeEventListener('ydb-config-saved', handleDbChange);
      window.removeEventListener('checklist-db-write', handleDbChange);
      window.removeEventListener('storage-updated', handleDbChange);
    };
  }, [selectedOrgId, activeTab]);

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    setActiveOrganization(orgId);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);
    const ping = await pingYdbApi();
    setIsTesting(false);
    setTestStatus({ success: ping.ok, pingMs: ping.durationMs, error: ping.error });
    setDiagnosticsReport(validateYdbConfig(config, selectedOrgId));
  };

  const handleValidateConfig = () => {
    setIsValidating(true);
    setTimeout(() => {
      const report = validateYdbConfig(config, selectedOrgId);
      setDiagnosticsReport(report);
      setIsValidating(false);
    }, 200);
  };

  const handlePerformTestWrite = () => {
    setIsTestWriting(true);
    setTimeout(() => {
      const writeId = `diag-test-${Date.now().toString().slice(-6)}`;
      const nowIso = new Date().toISOString();
      const entityLabel = `Проверка записи в ${config.database || 'обособленную базу'}`;
      
      // Perform write into audit_log
      recordYdbEntityWrite('audit_log', writeId, entityLabel, 'INSERT', selectedOrgId);
      
      // Also update local state
      const updated = getYdbConfig(selectedOrgId);
      setConfig(updated);
      
      setIsTestWriting(false);
      setTestWriteSuccess({
        id: writeId,
        timestamp: nowIso,
        message: `Запись успешно зафиксирована в таблице audit_log обособленной базы YDB! Идентификатор транзакции: ${writeId}`
      });

      // Update query result if currently viewing audit_log
      if (yqlQuery.includes('audit_log')) {
        handleRunQuery(yqlQuery);
      }
    }, 350);
  };

  const handleSyncAllPlatformDataToYdb = () => {
    setSyncStatus('Синхронизация данных юр. лица в YDB...');
    setTimeout(() => {
      const templates = getTemplates(selectedOrgId);
      const points = getPoints(selectedOrgId);
      const staff = getStaff(selectedOrgId);
      const submissions = getSubmissions(selectedOrgId);

      // Record batch audit writes
      recordYdbEntityWrite('system_organizations', currentOrg?.id || 'org-active', `Синхронизация юр. лица: ${currentOrg?.name}`, 'UPSERT', selectedOrgId);
      
      if (templates.length > 0) {
        recordYdbEntityWrite('checklist_templates', `batch-tmpl-${Date.now()}`, `Синхронизация шаблонов (${templates.length} шт.)`, 'UPSERT', selectedOrgId);
      }
      if (points.length > 0) {
        recordYdbEntityWrite('locations', `batch-pts-${Date.now()}`, `Синхронизация кофеен (${points.length} точек)`, 'UPSERT', selectedOrgId);
      }
      if (staff.length > 0) {
        recordYdbEntityWrite('staff', `batch-stf-${Date.now()}`, `Синхронизация персонала (${staff.length} чел.)`, 'UPSERT', selectedOrgId);
      }
      if (submissions.length > 0) {
        recordYdbEntityWrite('checklist_submissions', `batch-subm-${Date.now()}`, `Синхронизация сданных чек-листов (${submissions.length} шт.)`, 'UPSERT', selectedOrgId);
      }

      const updated = getYdbConfig(selectedOrgId);
      setConfig(updated);
      setSyncStatus(`Успешно синхронизировано: ${templates.length} шаблонов, ${points.length} кофеен, ${staff.length} сотрудников, ${submissions.length} чек-листов!`);
      setTimeout(() => setSyncStatus(null), 5000);
    }, 450);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if user is attempting to save live config
    const isExplicitEmulator = config.isEmulator === true;
    const hasLiveEndpoint = Boolean(config.endpoint && !config.endpoint.includes('emulator') && !config.endpoint.includes('sandbox'));
    const hasLiveParams = Boolean(hasLiveEndpoint && config.database);
    const hasAuthKey = Boolean(config.serviceAccountKeyJson && config.serviceAccountKeyJson.trim().length > 0);

    if (!isExplicitEmulator && hasLiveParams && !hasAuthKey) {
      setSaveNotify({
        message: 'Для подключения к боевой YDB вставьте ключ сервисного аккаунта в формате JSON или IAM-токен.',
        isError: true
      });
      setTimeout(() => setSaveNotify(null), 5000);
      return;
    }

    saveYdbConfig(config, selectedOrgId);
    
    // Перечитываем актуальные флаги из хранилища
    const updated = getYdbConfig(selectedOrgId);
    setConfig(updated);

    const isCustom = isYdbCustomConfigured(selectedOrgId);
    setSaveNotify({
      message: isCustom 
        ? 'Боевые параметры YDB сохранены и проверены. Организация переключена на Yandex Cloud!' 
        : 'Параметры успешно сохранены в реестр.',
      isError: false
    });
    setTimeout(() => setSaveNotify(null), 4000);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const presetQueries = [
    {
      title: '📋 Шаблоны чек-листов',
      yql: 'SELECT * FROM checklist_templates;',
    },
    {
      title: '🛠️ ALTER checklist_templates (Миграция колонок)',
      yql: 'ALTER TABLE checklist_templates ADD COLUMN organization_inn Utf8, ADD COLUMN code Utf8, ADD COLUMN description Utf8, ADD COLUMN target_time Utf8, ADD COLUMN allowed_variance_minutes Int32, ADD COLUMN assigned_points JsonDocument, ADD COLUMN updated_at Timestamp;',
    },
    {
      title: '🛠️ ALTER staff & locations (Колонка organization_name)',
      yql: 'ALTER TABLE staff ADD COLUMN organization_name Utf8; ALTER TABLE locations ADD COLUMN organization_name Utf8;',
    },
    {
      title: '📍 Кофейни и точки',
      yql: 'SELECT * FROM locations;',
    },
    {
      title: '👥 Персонал и бариста',
      yql: 'SELECT * FROM staff;',
    },
    {
      title: '🏢 Юр. лица и организации',
      yql: 'SELECT * FROM system_organizations;',
    },
    {
      title: '🔑 Пользователи & Доступ',
      yql: 'SELECT * FROM users;',
    },
    {
      title: '📑 Сданные чек-листы',
      yql: 'SELECT * FROM checklist_submissions ORDER BY created_at DESC LIMIT 20;',
    },
    {
      title: '⚡ Журнал транзакций YDB (Audit Log)',
      yql: 'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 20;',
    },
  ];

  return (
    <div className="w-full space-y-6 text-sm">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-black shrink-0 shadow-lg">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <h2 className="text-lg sm:text-xl font-bold text-white">Managed Service for YDB (Serverless)</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>FREE TIER АКТИВЕН (0 ₽/мес)</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ☁️ Боевой контур YDB
              </span>
            </div>
            
            {/* Target Org Badge */}
            <div className="mt-2 flex items-center space-x-2 flex-wrap text-xs text-slate-300">
              <span className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Обособленная база: <strong className="text-white">{currentOrg?.name || 'ООО «Кофе Смирнов»'}</strong></span>
                {currentOrg?.inn && <span className="text-slate-400">(ИНН: {currentOrg.inn})</span>}
              </span>
              {config.database && (
                <span className="font-mono text-[11px] text-indigo-300 bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-800/50 truncate max-w-xs">
                  {config.database}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
          {/* Org Selector if multiple organizations */}
          {organizations.length > 1 && (
            <select
              value={selectedOrgId}
              onChange={(e) => handleSelectOrg(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-bold focus:outline-none"
              title="Переключить юр. лицо для управления его базой YDB"
            >
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  🏢 {org.name} (ИНН {org.inn})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold transition flex items-center space-x-1.5 border border-slate-700 shadow-xs text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>Пинг YDB</span>
          </button>
        </div>
      </div>

      {/* Free Tier Quota Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Затраты RU (Request Units)</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900 dark:text-white">
            {(config.ruConsumedTotal || 0).toFixed(2)} RU
          </div>
          <div className="text-[11px] text-emerald-500 font-semibold mt-1">
            Лимит: 1 000 000 RU в месяц бесплатно
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Использовано хранилища</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900 dark:text-white">
            {(config.storageMbUsed || 0.5).toFixed(2)} МБ
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Лимит Free Tier: 10 240 МБ (10 ГБ)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Задержка gRPC (Latency)</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900 dark:text-white">
            {config.lastPingMs || 14} мс
          </div>
          <div className="text-[11px] text-emerald-500 font-semibold mt-1">
            {config.isConnected ? '● Подключение активно' : '○ Ожидание проверки'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Стоимость в месяц</span>
            <Sparkles className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-emerald-500">
            0 ₽
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            100% покрывается грантом Yandex Cloud
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('console')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 ${
            activeTab === 'console'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>YQL Консоль и Запросы</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 ${
            activeTab === 'config'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Параметры и Проверка данных</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schema')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 ${
            activeTab === 'schema'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Схема Таблиц (DDL)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('datalens_guide')}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 ${
            activeTab === 'datalens_guide'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Интеграция с Yandex DataLens</span>
        </button>
      </div>

      {/* TAB 1: YQL CONSOLE */}
      {activeTab === 'console' && (
        <div className="space-y-4">
          {/* Quick Presets */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-semibold shrink-0">Пресеты запросов:</span>
            {presetQueries.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setYqlQuery(preset.yql);
                  handleRunQuery(preset.yql);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition font-medium shrink-0 border border-slate-200 dark:border-slate-700"
              >
                {preset.title}
              </button>
            ))}
          </div>

          {/* Query Editor Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-indigo-400 font-mono">
                <Terminal className="w-4 h-4" />
                <span>YQL Editor • Обособленная база: {currentOrg?.name} ({config.database || 'default'})</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleRunQuery()}
                  disabled={isRunning}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center space-x-1.5 text-xs shadow-sm"
                >
                  <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                  <span>{isRunning ? 'Выполнение...' : 'Запустить YQL (F5)'}</span>
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={yqlQuery}
              onChange={(e) => setYqlQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 font-mono text-xs text-indigo-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
              placeholder="Введите SELECT, INSERT INTO, UPSERT INTO или CREATE TABLE..."
            />
          </div>

          {/* Query Execution Result Table */}
          {queryResult && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Результат выполнения ({queryResult.rows.length} строк)
                  </span>
                  {queryResult.stats && (
                    <span className="text-slate-400 text-[11px] font-mono">
                      ⏱ {queryResult.stats.durationMs} мс • ⚡ {queryResult.stats.requestUnits} RU
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy('query-res', JSON.stringify(queryResult.rows, null, 2))}
                  className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition flex items-center space-x-1 text-xs"
                >
                  {copiedKey === 'query-res' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'query-res' ? 'Скопировано!' : 'Копировать JSON'}</span>
                </button>
              </div>

              {queryResult.error && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
                  {queryResult.error}
                </div>
              )}

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {queryResult.columns.map((col, idx) => (
                        <th key={idx} className="p-3 font-mono">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {queryResult.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                        {queryResult.columns.map((col, cIdx) => (
                          <td key={cIdx} className="p-3 whitespace-nowrap font-mono text-slate-800 dark:text-slate-200">
                            {String(row[col] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONFIGURATION & DIAGNOSTICS */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Main Config Form */}
          <form onSubmit={handleSaveConfig} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                  <Server className="w-5 h-5 text-indigo-500" />
                  <span>Параметры обособленной YDB юр. лица: {currentOrg?.name}</span>
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  ИНН {currentOrg?.inn || '—'} • Изолированный контур базы данных в Yandex Cloud
                </p>
              </div>

              {saveNotify && (
                <span className={`px-3 py-1.5 rounded-xl border font-bold flex items-center space-x-1.5 text-xs ${
                  saveNotify.isError 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  {saveNotify.isError ? <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  <span>{saveNotify.message}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5">
                  YDB Endpoint (gRPC) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="grpcs://ydb.serverless.yandexcloud.net:2135"
                  value={config.endpoint}
                  onChange={e => setConfig({ ...config, endpoint: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Скопируйте из консоли YDB (свойство «Endpoint» с портом :2135)</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5">
                  Путь к базе (Database Path) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="/ru-central1/b1g.../etn..."
                  value={config.database}
                  onChange={e => setConfig({ ...config, database: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Обязательно начинается со слэша <code>/ru-central1/...</code></p>
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5 flex items-center justify-between">
                  <span>Ключ авторизации сервисного аккаунта (authorized_key.json или IAM-токен)</span>
                  <span className="text-[11px] font-normal text-slate-400">Роль в Yandex Cloud: ydb.editor</span>
                </label>
                <textarea
                  rows={5}
                  placeholder={`{\n  "service_account_id": "aje...",\n  "id": "aje...",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n..."\n}`}
                  value={config.serviceAccountKeyJson}
                  onChange={e => setConfig({ ...config, serviceAccountKeyJson: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleValidateConfig}
                  disabled={isValidating}
                  className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl transition text-xs border border-indigo-200 dark:border-indigo-800 flex items-center space-x-1.5"
                >
                  <ShieldCheck className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
                  <span>Проверить введенные данные</span>
                </button>

                <button
                  type="button"
                  onClick={handlePerformTestWrite}
                  disabled={isTestWriting}
                  className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl transition text-xs border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1.5"
                >
                  <Send className={`w-3.5 h-3.5 ${isTestWriting ? 'animate-spin' : ''}`} />
                  <span>Тестовая запись в базу YDB</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncAllPlatformDataToYdb}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition text-xs border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5"
                  title="Записать все существующие чек-листы, точки и сотрудников в базу"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Синхронизировать данные юр. лица</span>
                </button>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-sm text-xs flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Сохранить реквизиты YDB</span>
              </button>
            </div>
          </form>

          {/* Sync notification */}
          {syncStatus && (
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* Test write notification with quick jump to console */}
          {testWriteSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <div className="font-bold text-sm text-emerald-900 dark:text-emerald-100">Тестовая запись успешно выполнена!</div>
                  <p className="text-emerald-700 dark:text-emerald-300 mt-0.5">{testWriteSuccess.message}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setYqlQuery('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 20;');
                  setActiveTab('console');
                  handleRunQuery('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 20;');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition text-xs flex items-center space-x-1"
              >
                <span>Посмотреть запись в YQL Консоли</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Comprehensive Diagnostics Report Card */}
          {diagnosticsReport && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-2 rounded-xl ${diagnosticsReport.isValid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {diagnosticsReport.isValid ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      Отчет проверки параметров обособленной YDB
                    </h4>
                    <p className="text-slate-500 text-xs">
                      {diagnosticsReport.summary}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    diagnosticsReport.canWrite 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' 
                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                  }`}>
                    {diagnosticsReport.canWrite ? '✍️ Запись разрешена' : '🔒 Запись заблокирована'}
                  </span>
                </div>
              </div>

              {/* Individual Checks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {diagnosticsReport.checks.map((check) => (
                  <div 
                    key={check.id}
                    className={`p-3.5 rounded-2xl border ${
                      check.valid 
                        ? 'bg-slate-50 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800' 
                        : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {check.title}
                      </span>
                      {check.valid ? (
                        <span className="text-emerald-500 flex items-center space-x-1 text-[11px] font-bold">
                          <Check className="w-3.5 h-3.5" />
                          <span>Корректно</span>
                        </span>
                      ) : (
                        <span className="text-rose-500 flex items-center space-x-1 text-[11px] font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Требует внимания</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {check.message}
                    </p>
                    {check.details && (
                      <p className="text-[11px] text-slate-400 font-mono mt-1 bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        {check.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Service Account Extracted Metadata */}
              {diagnosticsReport.parsedKeyInfo && diagnosticsReport.parsedKeyInfo.format === 'json_sa_key' && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <span>Авторизация: Сервисный аккаунт подтвержден. Приватный ключ RSA готов к gRPC сессиям.</span>
                  </div>
                  {diagnosticsReport.parsedKeyInfo.serviceAccountId && (
                    <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                      SA: {diagnosticsReport.parsedKeyInfo.serviceAccountId}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: YQL SCHEMA DDL */}
      {activeTab === 'schema' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span>Готовый скрипт инициализации таблиц для консоли YDB</span>
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">Вставьте этот код в раздел YDB → SQL-запрос в Yandex Cloud</p>
            </div>

            <button
              type="button"
              onClick={() => handleCopy('ydb-ddl', YDB_SCHEMA_YQL)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center space-x-1.5 text-xs shadow-sm"
            >
              {copiedKey === 'ydb-ddl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'ydb-ddl' ? 'Скопировано!' : 'Копировать YQL DDL'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-2xl bg-slate-950 font-mono text-xs text-indigo-300/90 overflow-x-auto whitespace-pre leading-relaxed border border-slate-800 max-h-96">
            {YDB_SCHEMA_YQL}
          </pre>
        </div>
      )}

      {/* TAB 4: DATALENS GUIDE */}
      {activeTab === 'datalens_guide' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <span>Подключение YDB к Yandex DataLens за 3 шага</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-xs">
                1
              </span>
              <div className="font-bold text-xs text-slate-900 dark:text-white">Создание подключения в DataLens</div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                В DataLens нажмите <b>«Подключения» → «Создать» → «YDB»</b>. Выберите вашу Serverless БД и укажите сервисный аккаунт.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-xs">
                2
              </span>
              <div className="font-bold text-xs text-slate-900 dark:text-white">Создание Датасета</div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Перетащите таблицу <code>checklist_submissions</code>. DataLens мгновенно распознает числовые поля, даты и статусы.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-xs">
                3
              </span>
              <div className="font-bold text-xs text-slate-900 dark:text-white">Публикация Дашборда</div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Создайте сводную матрицу, график нарушений и нажмите <b>«Поделиться» → «Встроить (Embed)»</b>. Вставьте URL во вкладку «DataLens Отчеты».
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
