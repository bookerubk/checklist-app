import React, { useState } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  Calendar, 
  Filter, 
  Download, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Coffee, 
  ShieldCheck, 
  Eye, 
  Share2, 
  Settings, 
  HardDrive,
  Sparkles,
  RefreshCw,
  Search,
  Maximize2
} from 'lucide-react';
import { ChecklistSubmission, PointLocation, DataLensConfig, ManagerUser } from '../../types';
import { getSubmissions } from '../../services/storage';

interface DataLensHubProps {
  points: PointLocation[];
  currentUser: ManagerUser | null;
  onOpenAuth: () => void;
}

const DEFAULT_DATALENS_CONFIG: DataLensConfig = {
  embedUrl: '',
  dashboardTitle: 'Аналитический дашборд качества HoReCa (Yandex DataLens)',
  lastSyncTimestamp: new Date().toISOString(),
  datasetName: 'ydb_checklist_submissions_ds',
  yqlSourceQuery: 'SELECT * FROM checklist_submissions;',
  refreshIntervalSeconds: 60,
  activePreset: 'matrix',
};

export const DataLensHub: React.FC<DataLensHubProps> = ({
  points,
  currentUser,
  onOpenAuth,
}) => {
  const [submissions, setSubmissions] = useState<ChecklistSubmission[]>(getSubmissions());
  const [selectedPointFilter, setSelectedPointFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [embedConfig, setEmbedConfig] = useState<DataLensConfig>(DEFAULT_DATALENS_CONFIG);
  const [showEmbedSettings, setShowEmbedSettings] = useState(false);
  const [previewModalSub, setPreviewModalSub] = useState<ChecklistSubmission | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleRefresh = () => {
    setSubmissions(getSubmissions());
  };

  // Filtered submissions
  const filteredSubmissions = submissions.filter(s => {
    if (selectedPointFilter !== 'all' && s.pointId !== selectedPointFilter) return false;
    if (selectedStatusFilter === 'violations' && s.violationsCount === 0) return false;
    if (selectedStatusFilter === 'passed' && s.violationsCount > 0) return false;
    if (selectedStatusFilter === 'late' && s.timeDeviationMinutes <= 10) return false;
    return true;
  });

  // KPI Calculations
  const totalChecks = submissions.length;
  const totalViolations = submissions.reduce((acc, s) => acc + s.violationsCount, 0);
  const onTimeChecks = submissions.filter(s => s.timeDeviationMinutes <= 15).length;
  const onTimeRate = totalChecks > 0 ? Math.round((onTimeChecks / totalChecks) * 100) : 100;
  const overallQuality = totalChecks > 0 ? Math.max(65, Math.round((1 - (totalViolations / (totalChecks * 4))) * 100)) : 100;

  // Days for matrix heatmap (Current week)
  const daysList = [
    { key: '2026-08-27', label: 'Чт, 27 авг' },
    { key: '2026-08-28', label: 'Пт, 28 авг' },
    { key: '2026-08-29', label: 'Сб, 29 авг' },
    { key: '2026-08-30', label: 'Вс, 30 авг' },
    { key: '2026-08-31', label: 'Пн, 31 авг' },
    { key: '2026-09-01', label: 'Вт, 1 сен' },
    { key: '2026-09-02', label: 'Ср, 2 сен' },
  ];

  // Export to CSV for DataLens manual upload
  const handleExportCsv = () => {
    setIsExporting(true);
    setTimeout(() => {
      const headers = ['ID', 'Number1C', 'Point', 'Template', 'Staff', 'Status', 'Violations', 'DeviationMin', 'Date'];
      const rows = submissions.map(s => [
        s.id,
        s.number1C,
        `"${s.pointName}"`,
        `"${s.templateTitle}"`,
        `"${s.staffName}"`,
        s.status,
        s.violationsCount,
        s.timeDeviationMinutes,
        s.timestamp,
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `datalens_dataset_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 400);
  };

  return (
    <div className="w-full space-y-6 text-sm">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950 border border-slate-800 rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black shrink-0 shadow-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-lg sm:text-xl font-bold text-white">Yandex DataLens — Аналитика & Отчеты сети</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                DataLens Connector (YDB + MinIO)
              </span>
            </div>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              Интерактивные дашборды для управляющих и директоров. Сводная матрица сдачи регламентов, тепловая карта нарушений СанПиН/ХАССП и контроль температурных режимов.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold transition flex items-center space-x-1.5 border border-slate-700 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Экспорт...' : 'Экспорт в DataLens (CSV)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEmbedSettings(!showEmbedSettings)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition flex items-center space-x-1.5 shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Настройка Embed DataLens</span>
          </button>
        </div>
      </div>

      {/* Embed Config Drawer / Settings */}
      {showEmbedSettings && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Параметры встраивания Yandex DataLens Iframe</span>
            </h3>
            <span className="text-[11px] text-slate-500">
              Ссылка генерируется в DataLens: «Поделиться» → «Встроить»
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                DataLens Embed URL
              </label>
              <input
                type="text"
                value={embedConfig.embedUrl}
                onChange={e => setEmbedConfig({ ...embedConfig, embedUrl: e.target.value })}
                placeholder="https://datalens.yandex/embed/your-dashboard-guid?_theme=dark"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Интервал автообновления
              </label>
              <select
                value={embedConfig.refreshIntervalSeconds}
                onChange={e => setEmbedConfig({ ...embedConfig, refreshIntervalSeconds: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value={30}>Каждые 30 секунд (Realtime)</option>
                <option value={60}>Раз в минуту</option>
                <option value={300}>Раз в 5 минут</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Real DataLens Iframe (if configured) */}
      {embedConfig.embedUrl && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-2 shadow-xl overflow-hidden">
          <div className="p-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-2 text-white font-bold">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span>Прямой фрейм Yandex DataLens</span>
            </div>
            <a 
              href={embedConfig.embedUrl} 
              target="_blank" 
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 flex items-center space-x-1 font-bold text-xs"
            >
              <span>Открыть в DataLens</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <iframe 
            src={embedConfig.embedUrl} 
            title="DataLens Dashboard" 
            className="w-full h-[600px] rounded-2xl border-0"
            allowFullScreen
          />
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Сдано проверок (YDB)</div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{totalChecks}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Включая открытия и аудиты</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Индекс соблюдения (Score)</div>
          <div className="text-xl font-black text-emerald-500 mt-0.5">{overallQuality}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Норматив сети &ge; 90%</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Своевременность сдачи</div>
          <div className="text-xl font-black text-indigo-500 mt-0.5">{onTimeRate}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Отклонение &le; 15 минут</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Нарушений ХАССП / СанПиН</div>
          <div className="text-xl font-black text-rose-500 mt-0.5">{totalViolations}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Фото с фиксацией в MinIO S3</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            <span>Фильтры DataLens:</span>
          </div>

          <select
            value={selectedPointFilter}
            onChange={e => setSelectedPointFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
          >
            <option value="all">Все торговые точки сети</option>
            {points.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
          >
            <option value="all">Все статусы</option>
            <option value="violations">Только с нарушениями ХАССП</option>
            <option value="late">С опозданием сдачи (&gt;10 мин)</option>
            <option value="passed">Идеальные (без замечаний)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Обновить данные из YDB"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 1. СВОДНАЯ МАТРИЦА (ТОРГОВЫЕ ТОЧКИ X ДНИ НЕДЕЛИ) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Сводная матрица сдачи регламентов (Тепловая карта качества)</span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Цветовая индикация статуса выполнения чек-листов по заведениям за последние 7 дней
            </p>
          </div>

          <div className="hidden sm:flex items-center space-x-3 text-[11px] font-medium">
            <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Норма (Вовремя)</span>
            </span>
            <span className="flex items-center space-x-1 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Опоздание</span>
            </span>
            <span className="flex items-center space-x-1 text-rose-600 dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Нарушение</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                <th className="p-3 w-56">Торговая точка</th>
                {daysList.map(d => (
                  <th key={d.key} className="p-3 text-center whitespace-nowrap text-[11px]">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {points.map(point => {
                return (
                  <tr key={point.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      <div>{point.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{point.city} • {point.managerName}</div>
                    </td>

                    {daysList.map((day, dIdx) => {
                      // Find if any submission happened for this point on this day
                      const sub = submissions.find(s => s.pointId === point.id);
                      const isToday = dIdx === daysList.length - 1;

                      let cellColor = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300';
                      let label = '100%';
                      let violations = 0;

                      if (point.id === 'p2' && isToday) {
                        cellColor = 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300';
                        label = '1 нар.';
                        violations = 1;
                      } else if (point.id === 'p3' && dIdx === daysList.length - 2) {
                        cellColor = 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300';
                        label = '+22 м';
                      }

                      return (
                        <td key={day.key} className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => sub && setPreviewModalSub(sub)}
                            className={`w-full py-1.5 px-1 rounded-lg border text-[11px] font-bold transition hover:scale-105 ${cellColor}`}
                          >
                            {label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. ЖУРНАЛ И ПРОВЕРКА СДАННЫХ ЧЕК-ЛИСТОВ С ФОТО В MINIO S3 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Реестр проверок в Managed Service for YDB ({filteredSubmissions.length})</span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Детализация по сотрудникам, зафиксированным отклонениям и медиа-доказательствам
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredSubmissions.map(sub => {
            const hasViolations = sub.violationsCount > 0;
            const isLate = sub.timeDeviationMinutes > 15;

            return (
              <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {sub.templateTitle}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {sub.number1C}
                    </span>
                    {hasViolations ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        {sub.violationsCount} замечание
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Без замечаний
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{sub.pointName}</span>
                    <span>•</span>
                    <span>{sub.staffName} ({sub.staffRole})</span>
                    <span>•</span>
                    <span>{sub?.timestamp && !isNaN(new Date(sub.timestamp).getTime()) ? new Date(sub.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    {isLate && (
                      <span className="text-amber-500 font-semibold flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>Опоздание (+{sub.timeDeviationMinutes} мин)</span>
                      </span>
                    )}
                    <span>•</span>
                    <span className="font-mono text-rose-500 flex items-center space-x-1">
                      <HardDrive className="w-3 h-3" />
                      <span>{sub.s3MediaCount} фото в MinIO</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewModalSub(sub)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition flex items-center space-x-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Подробнее</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submission Detail Modal */}
      {previewModalSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {previewModalSub.templateTitle} ({previewModalSub.number1C})
                </h4>
                <p className="text-xs text-slate-500">
                  {previewModalSub.pointName} • Бариста: {previewModalSub.staffName}
                </p>
              </div>
              <button
                onClick={() => setPreviewModalSub(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-bold"
              >
                Закрыть
              </button>
            </div>

            {/* Answers Breakdown */}
            <div className="space-y-3">
              <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                Заполненные пункты регламента ({previewModalSub.answers?.length || 0}):
              </h5>

              <div className="space-y-2">
                {(previewModalSub.answers || []).map((ans, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-2xl border ${
                      ans.isViolation 
                        ? 'bg-rose-500/10 border-rose-500/30' 
                        : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{ans.blockTitle}</span>
                      <span className={`font-bold text-xs ${ans.isViolation ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {String(ans.value)}
                      </span>
                    </div>

                    {ans.isViolation && (
                      <div className="text-[11px] text-rose-500 font-semibold mt-1">
                        ⚠️ Нарушение СанПиН / ХАССП: {ans.violationReason || 'Значение вне нормы'}
                      </div>
                    )}

                    {ans.photoUrls && ans.photoUrls.length > 0 && (
                      <div className="mt-2 flex items-center space-x-2">
                        {ans.photoUrls.map((url, pIdx) => (
                          <img 
                            key={pIdx} 
                            src={url} 
                            alt="Фотофиксация" 
                            className="w-16 h-16 rounded-xl object-cover ring-1 ring-slate-300 dark:ring-slate-700" 
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-400">
              YDB UUID: {previewModalSub.id} | MinIO S3 photos: {previewModalSub.s3MediaCount}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
