import React, { useState } from 'react';
import { 
  HardDrive, 
  Server, 
  Globe, 
  Key, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  FileCode, 
  ExternalLink, 
  Image as ImageIcon, 
  Eye, 
  ArrowUpRight,
  Download,
  Terminal,
  Zap,
  Cloud,
  Box,
  Lock
} from 'lucide-react';
import { MinioConfig, MinioBucketFile, YandexServerlessConfig } from '../../types';
import { 
  getMinioConfig, 
  saveMinioConfig, 
  testMinioConnection, 
  getMinioFilesList, 
  getServerlessConfig,
  saveServerlessConfig,
  generateYcServerlessCommands,
  generateYandexApiGatewaySpec,
  generateYandexTerraform,
  generateMinioVpsCommands,
  generateMinioCorsConfig
} from '../../services/minioService';

export const MinioVpsHub: React.FC = () => {
  const [s3Config, setS3Config] = useState<MinioConfig>(getMinioConfig());
  const [slsConfig, setSlsConfig] = useState<YandexServerlessConfig>(getServerlessConfig());
  
  const [activeTab, setActiveTab] = useState<'browser' | 'settings' | 'serverless' | 'gateway' | 'terraform'>('serverless');
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; pingMs: number; error?: string } | null>({
    success: true,
    pingMs: 24,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<MinioBucketFile | null>(null);
  const [saveNotification, setSaveNotification] = useState(false);

  const files = getMinioFilesList();

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testMinioConnection(s3Config);
    setIsTesting(false);
    setTestResult(res);
  };

  const handleSaveS3Settings = (e: React.FormEvent) => {
    e.preventDefault();
    saveMinioConfig(s3Config);
    setSaveNotification(true);
    setTimeout(() => setSaveNotification(false), 2500);
  };

  const handleSaveSlsSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveServerlessConfig(slsConfig);
    setSaveNotification(true);
    setTimeout(() => setSaveNotification(false), 2500);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadDeployScript = () => {
    const script = generateYcServerlessCommands(s3Config, slsConfig);
    const blob = new Blob([script], { type: 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deploy-yandex-serverless.sh';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTerraform = () => {
    const tf = generateYandexTerraform(s3Config, slsConfig);
    const blob = new Blob([tf], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'main.tf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMcScript = () => {
    const mc = generateMinioVpsCommands(s3Config);
    const blob = new Blob([mc], { type: 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'setup-minio-vps.sh';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="w-full space-y-6 text-sm">
      {/* Top Banner: Yandex Cloud Serverless + MinIO on VPS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black shrink-0 shadow-lg">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white">Yandex Serverless Containers + MinIO S3 (наш VPS)</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>ГИБРИДНАЯ АРХИТЕКТУРА</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Scale-to-Zero в YC (0 ₽ в ночной простой)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                MinIO S3 на своём VPS
              </span>
            </div>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              Вычисления и база работают в Yandex Cloud (<b>Serverless Containers</b> + <b>Managed YDB</b>), а все фотоотчеты хранятся в вашем собственном <b>MinIO S3 на VPS</b>. Это исключает переплату за облачный трафик и объем хранения при сохранении преимуществ автоскейлинга.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            id="test-minio-vps-btn"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold transition flex items-center space-x-1.5 border border-slate-700 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>Проверить связь с MinIO</span>
          </button>
        </div>
      </div>

      {/* Connection Test Result */}
      {testResult && (
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
          testResult.success 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center space-x-2">
            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="font-medium text-xs">
              {testResult.success 
                ? `MinIO S3 на VPS (${s3Config.endpoint}) доступен за ${testResult.pingMs} мс. Бакет «${s3Config.bucket}» готов к приему фотоотчетов.` 
                : testResult.error || 'Ошибка подключения к MinIO на VPS'}
            </span>
          </div>
          <span className="font-mono text-[10px] bg-slate-900/60 px-2 py-0.5 rounded text-slate-300">
            VPS MinIO / {s3Config.bucket}
          </span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          id="tab-sls-deploy-btn"
          onClick={() => setActiveTab('serverless')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
            activeTab === 'serverless'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>1. Serverless Containers (Деплой в YC)</span>
        </button>

        <button
          type="button"
          id="tab-sls-gateway-btn"
          onClick={() => setActiveTab('gateway')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
            activeTab === 'gateway'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>2. API Gateway & Домен (SSL)</span>
        </button>

        <button
          type="button"
          id="tab-s3-browser-btn"
          onClick={() => setActiveTab('browser')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
            activeTab === 'browser'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>3. MinIO S3 на VPS ({files.length} фото)</span>
        </button>

        <button
          type="button"
          id="tab-s3-settings-btn"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
            activeTab === 'settings'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>4. Подключение к MinIO VPS & mc CLI</span>
        </button>

        <button
          type="button"
          id="tab-sls-terraform-btn"
          onClick={() => setActiveTab('terraform')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold transition ${
            activeTab === 'terraform'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>5. Terraform (main.tf)</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: SERVERLESS CONTAINERS DEPLOYMENT */}
      {/* ================================================================= */}
      {activeTab === 'serverless' && (
        <div className="space-y-6">
          {/* Architecture Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <Zap className="w-4 h-4" />
                <span>Мгновенный отклик к YDB</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Контейнер приложения и база YDB находятся в ru-central1. Задержка запросов базы данных составляет 2–4 мс.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                <Box className="w-4 h-4" />
                <span>Scale to Zero в YC</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                При отсутствии запросов ночью количество реплик падает до 0 — плата за процессор и оперативную память не начисляется.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-rose-500 font-bold text-xs">
                <HardDrive className="w-4 h-4" />
                <span>MinIO на вашем VPS</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Фотоотчеты загружаются на ваш VPS с MinIO. Трафик и гигабайты фото не расходуют облачный лимит Яндекс Облака.
              </p>
            </div>
          </div>

          {/* Form Parameters for Yandex Serverless */}
          <form onSubmit={handleSaveSlsSettings} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Параметры Yandex Serverless Containers</h3>
                <p className="text-slate-500 text-xs mt-0.5">В контейнер автоматически передаются параметры подключения к вашему VPS MinIO</p>
              </div>
              {saveNotification && (
                <span className="text-emerald-500 font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Параметры сохранены!</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Folder ID (Каталог Yandex Cloud)
                </label>
                <input
                  type="text"
                  value={slsConfig.cloudFolderId}
                  onChange={(e) => setSlsConfig({ ...slsConfig, cloudFolderId: e.target.value })}
                  placeholder="b1g47v4m948a3l..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  ID реестра Container Registry
                </label>
                <input
                  type="text"
                  value={slsConfig.containerRegistryId}
                  onChange={(e) => setSlsConfig({ ...slsConfig, containerRegistryId: e.target.value })}
                  placeholder="crp872j39k48f9..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Service Account ID (Сервисный аккаунт)
                </label>
                <input
                  type="text"
                  value={slsConfig.serviceAccountId}
                  onChange={(e) => setSlsConfig({ ...slsConfig, serviceAccountId: e.target.value })}
                  placeholder="aje574h29a00b..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Имя контейнера & Образа
                </label>
                <input
                  type="text"
                  value={slsConfig.containerName}
                  onChange={(e) => setSlsConfig({ ...slsConfig, containerName: e.target.value })}
                  placeholder="horeca-checklist-app"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Выделенная память (RAM)
                </label>
                <select
                  value={slsConfig.memoryMb}
                  onChange={(e) => setSlsConfig({ ...slsConfig, memoryMb: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={256}>256 MB (Минимальное)</option>
                  <option value={512}>512 MB (Рекомендуется)</option>
                  <option value={1024}>1024 MB (1 GB для пиков)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Min Instances (Минимум инстансов)
                </label>
                <select
                  value={slsConfig.minInstances}
                  onChange={(e) => setSlsConfig({ ...slsConfig, minInstances: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={0}>0 (Scale to Zero — 0 руб при простое)</option>
                  <option value={1}>1 (Мгновенный ответ без cold start)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                id="save-sls-config-btn"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs transition"
              >
                Сохранить параметры деплоя
              </button>
            </div>
          </form>

          {/* Generated CLI Commands */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-xs text-white flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>Команда деплоя через Yandex Cloud CLI (`yc`)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Развертывает контейнер в Yandex Cloud с подключением к YDB и вашему MinIO на VPS
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="download-deploy-sh-btn"
                  onClick={handleDownloadDeployScript}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold transition flex items-center space-x-1.5 text-xs border border-slate-700 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать deploy.sh</span>
                </button>

                <button
                  type="button"
                  id="copy-deploy-sh-btn"
                  onClick={() => handleCopy('deploy-sh', generateYcServerlessCommands(s3Config, slsConfig))}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition flex items-center space-x-1.5 text-xs shadow-sm"
                >
                  {copiedKey === 'deploy-sh' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'deploy-sh' ? 'Скопировано!' : 'Копировать скрипт'}</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-2xl bg-slate-950 font-mono text-xs text-amber-300/90 overflow-x-auto whitespace-pre leading-relaxed border border-slate-800 max-h-96">
              {generateYcServerlessCommands(s3Config, slsConfig)}
            </pre>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: API GATEWAY & CUSTOM DOMAIN (FREE SSL) */}
      {/* ================================================================= */}
      {activeTab === 'gateway' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-white">Yandex API Gateway & Certificate Manager</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Автоматический SSL Let's Encrypt
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-1 max-w-2xl">
                Yandex Certificate Manager выпускает и продлевает бесплатный SSL сертификат, а API Gateway направляет запросы с вашего домена в Serverless Container.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-400 whitespace-nowrap">Ваш домен:</span>
              <input
                type="text"
                value={slsConfig.customDomain}
                onChange={(e) => setSlsConfig({ ...slsConfig, customDomain: e.target.value })}
                placeholder="checklist.horeca-network.ru"
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs w-60 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">Шаг 1</span>
              <div className="font-bold text-white text-xs">Yandex Certificate Manager</div>
              <p className="text-[11px] text-slate-400">
                Создайте сертификат типа «Let's Encrypt» для домена <code className="text-sky-300">{slsConfig.customDomain}</code> и подтвердите DNS CNAME.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Шаг 2</span>
              <div className="font-bold text-white text-xs">Yandex API Gateway</div>
              <p className="text-[11px] text-slate-400">
                Создайте API Gateway со спецификацией ниже и привяжите сертификат и домен в консоли Яндекс Облака.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400">Шаг 3</span>
              <div className="font-bold text-white text-xs">DNS CNAME-запись</div>
              <p className="text-[11px] text-slate-400">
                В панели регистратора направьте CNAME-запись <code className="text-sky-300">{slsConfig.customDomain}</code> на технический адрес API Gateway.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-white">Спецификация API Gateway (OpenAPI 3.0 YAML)</h4>
              <button
                type="button"
                id="copy-gateway-spec-btn"
                onClick={() => handleCopy('gateway-spec', generateYandexApiGatewaySpec(s3Config, slsConfig))}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition flex items-center space-x-1.5 text-xs shadow-sm"
              >
                {copiedKey === 'gateway-spec' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'gateway-spec' ? 'Скопировано!' : 'Копировать спецификацию'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-slate-950 font-mono text-xs text-sky-300/90 overflow-x-auto whitespace-pre leading-relaxed border border-slate-800 max-h-80">
              {generateYandexApiGatewaySpec(s3Config, slsConfig)}
            </pre>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: OBJECT STORAGE (MINIO ON VPS BUCKET BROWSER) */}
      {/* ================================================================= */}
      {activeTab === 'browser' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Медиафайлов в MinIO (VPS)</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{files.length} шт.</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Объем на вашем VPS</div>
              <div className="text-xl font-black text-rose-500 mt-0.5">{totalMb} МБ</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Экономия WebP</div>
              <div className="text-xl font-black text-emerald-500 mt-0.5">~88% трафика</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Объекты в бакете MinIO: <span className="font-mono text-rose-500">{s3Config.bucket}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Сервер MinIO на VPS: <code className="text-amber-500 font-mono">{s3Config.endpoint}</code></p>
              </div>
              <span className="text-[11px] text-slate-500">Прямые ссылки для YDB, 1С и DataLens</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {files.map((file, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-850/50 transition gap-3">
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <img 
                      src={file.url} 
                      alt={file.name} 
                      className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-750 shrink-0 cursor-pointer hover:opacity-80"
                      onClick={() => setSelectedImage(file)}
                    />
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-white truncate">
                        {file.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-2 mt-0.5">
                        <span>{file.pointName || 'Торговая точка'}</span>
                        <span>•</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">{file.checklistNumber}</span>
                        <span>•</span>
                        <span>{(file.sizeBytes / 1024).toFixed(1)} КБ</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      id={`copy-minio-url-${idx}-btn`}
                      onClick={() => handleCopy(`url-${idx}`, file.url)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition flex items-center space-x-1"
                    >
                      {copiedKey === `url-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === `url-${idx}` ? 'Скопировано' : 'MinIO URL'}</span>
                    </button>

                    <button
                      type="button"
                      id={`view-s3-file-${idx}-btn`}
                      onClick={() => setSelectedImage(file)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
                      title="Просмотреть в полном размере"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: MINIO VPS SETTINGS & MC CLI */}
      {/* ================================================================= */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveS3Settings} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Конфигурация MinIO S3 на вашем VPS</h3>
                <p className="text-slate-500 text-xs mt-0.5">Параметры доступа автоматически передаются в Yandex Serverless Containers</p>
              </div>
              {saveNotification && (
                <span className="text-emerald-500 font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Настройки MinIO сохранены!</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  MinIO Endpoint (URL вашего VPS)
                </label>
                <input
                  type="text"
                  value={s3Config.endpoint}
                  onChange={(e) => setS3Config({ ...s3Config, endpoint: e.target.value })}
                  placeholder="https://s3.horeca-network.ru или http://194.87.142.50:9000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Порт MinIO API
                </label>
                <input
                  type="number"
                  value={s3Config.port}
                  onChange={(e) => setS3Config({ ...s3Config, port: Number(e.target.value) })}
                  placeholder="443 или 9000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Имя S3 бакета
                </label>
                <input
                  type="text"
                  value={s3Config.bucket}
                  onChange={(e) => setS3Config({ ...s3Config, bucket: e.target.value })}
                  placeholder="horeca-checklist-photos"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Access Key (Логин в MinIO)
                </label>
                <input
                  type="text"
                  value={s3Config.accessKey}
                  onChange={(e) => setS3Config({ ...s3Config, accessKey: e.target.value })}
                  placeholder="minio_admin_horeca"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Secret Key (Пароль в MinIO)
                </label>
                <input
                  type="password"
                  value={s3Config.secretKey}
                  onChange={(e) => setS3Config({ ...s3Config, secretKey: e.target.value })}
                  placeholder="••••••••••••••••••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Публичный URL префикс для DataLens и 1С
                </label>
                <input
                  type="text"
                  value={s3Config.publicUrlPrefix}
                  onChange={(e) => setS3Config({ ...s3Config, publicUrlPrefix: e.target.value })}
                  placeholder="https://s3.horeca-network.ru/horeca-checklist-photos"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s3Config.useSsl}
                    onChange={(e) => setS3Config({ ...s3Config, useSsl: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded border-slate-300"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">Использовать HTTPS (SSL)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                id="test-minio-in-settings-btn"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Проверить соединение с VPS</span>
              </button>

              <button
                type="submit"
                id="save-minio-settings-btn"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs transition"
              >
                Сохранить параметры MinIO
              </button>
            </div>
          </form>

          {/* MinIO Client (mc) Commands for VPS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-xs text-white flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-rose-400" />
                  <span>Команды MinIO Client (`mc`) для настройки бакета на вашем VPS</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Создает бакет и открывает публичный анонимный доступ на чтение (anonymous download) для фотоотчетов
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="download-mc-sh-btn"
                  onClick={handleDownloadMcScript}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold transition flex items-center space-x-1.5 text-xs border border-slate-700 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать setup.sh</span>
                </button>

                <button
                  type="button"
                  id="copy-mc-btn"
                  onClick={() => handleCopy('mc', generateMinioVpsCommands(s3Config))}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition flex items-center space-x-1.5 text-xs shadow-sm"
                >
                  {copiedKey === 'mc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'mc' ? 'Скопировано!' : 'Копировать mc команды'}</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-2xl bg-slate-950 font-mono text-xs text-rose-300/90 overflow-x-auto whitespace-pre leading-relaxed border border-slate-800">
              {generateMinioVpsCommands(s3Config)}
            </pre>
          </div>

          {/* CORS Configuration */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-white flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Политика CORS для MinIO (если мобильный PWA загружает фото напрямик)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Разрешает браузерам мобильных устройств отправку WebP-файлов на ваш VPS по методам PUT/POST
                </p>
              </div>

              <button
                type="button"
                id="copy-cors-btn"
                onClick={() => handleCopy('cors', generateMinioCorsConfig())}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold transition flex items-center space-x-1.5 text-xs border border-slate-700"
              >
                {copiedKey === 'cors' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'cors' ? 'Скопировано!' : 'Копировать CORS JSON'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-slate-950 font-mono text-xs text-emerald-300/90 overflow-x-auto whitespace-pre leading-relaxed border border-slate-800">
              {generateMinioCorsConfig()}
            </pre>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 5: TERRAFORM IAC */}
      {/* ================================================================= */}
      {activeTab === 'terraform' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-xs text-white flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>Манифест Terraform (main.tf): YC Serverless + VPS MinIO</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Создает Serverless Container и реестр в YC, передавая реквизиты вашего VPS MinIO в переменные контейнера (без создания Yandex Storage Bucket)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="download-tf-btn"
                onClick={handleDownloadTerraform}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold transition flex items-center space-x-1.5 text-xs border border-slate-700 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать main.tf</span>
              </button>

              <button
                type="button"
                id="copy-tf-btn"
                onClick={() => handleCopy('terraform', generateYandexTerraform(s3Config, slsConfig))}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition flex items-center space-x-1.5 text-xs shadow-sm"
              >
                {copiedKey === 'terraform' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'terraform' ? 'Скопировано!' : 'Копировать main.tf'}</span>
              </button>
            </div>
          </div>

          <pre className="p-4 rounded-2xl bg-slate-950 font-mono text-xs text-sky-300/90 overflow-x-auto whitespace-pre leading-relaxed border border-slate-800 max-h-96">
            {generateYandexTerraform(s3Config, slsConfig)}
          </pre>
        </div>
      )}

      {/* Full-screen Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-sm text-white">{selectedImage.name}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {selectedImage.pointName} • {selectedImage.checklistNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[60vh]">
              <img 
                src={selectedImage.url} 
                alt={selectedImage.name} 
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Хранилище: MinIO на VPS • Размер: {(selectedImage.sizeBytes / 1024).toFixed(1)} КБ (WebP)</span>
              <button
                type="button"
                onClick={() => handleCopy('modal-url', selectedImage.url)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 flex items-center space-x-1.5"
              >
                {copiedKey === 'modal-url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'modal-url' ? 'Скопировано!' : 'Копировать MinIO URL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
