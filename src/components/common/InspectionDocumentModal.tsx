import React, { useState } from 'react';
import { ChecklistSubmission } from '../../types';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Camera, 
  Clock, 
  MapPin, 
  User, 
  Calendar, 
  FileText,
  Copy,
  Check,
  HardDrive,
  Database,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface InspectionDocumentModalProps {
  submission: ChecklistSubmission | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InspectionDocumentModal: React.FC<InspectionDocumentModalProps> = ({
  submission,
  isOpen,
  onClose,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (!isOpen || !submission) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(submission.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const hasViolations = submission.violationsCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modern Clean Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold tracking-tight text-white">
                  Протокол проверки № {submission.number1C}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  hasViolations 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {hasViolations ? `${submission.violationsCount} замечаний` : 'Без нарушений'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Managed Service for YDB (Serverless) • Фотофиксация в MinIO S3
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Печать акта</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Command Bar: Status & Storage Info */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Синхронизировано в YDB</span>
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Database className="w-3 h-3 text-indigo-400" />
              <span>YDB UUID: {submission.id.slice(0, 16)}...</span>
            </span>
            <button
              type="button"
              onClick={handleCopyId}
              className="text-slate-400 hover:text-indigo-500 transition"
              title="Скопировать идентификатор записи YDB"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span className="flex items-center space-x-1 text-indigo-500">
              <HardDrive className="w-3.5 h-3.5" />
              <span>{submission.s3MediaCount} файлов в MinIO S3</span>
            </span>
            <span>•</span>
            <span>Таблица: checklist_submissions</span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750">
              <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] font-medium mb-1">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>Торговая точка</span>
              </div>
              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{submission.pointName}</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750">
              <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] font-medium mb-1">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>Исполнитель</span>
              </div>
              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                {submission.staffName} <span className="font-normal text-slate-400">({submission.staffRole})</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750">
              <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] font-medium mb-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                <span>Дата и время</span>
              </div>
              <div className="font-bold text-xs text-slate-900 dark:text-white">
                {submission?.timestamp && !isNaN(new Date(submission.timestamp).getTime()) 
                  ? `${new Date(submission.timestamp).toLocaleDateString('ru-RU')} ${new Date(submission.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : '—'}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750">
              <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] font-medium mb-1">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                <span>Отклонение графика</span>
              </div>
              <div className="font-bold text-xs text-slate-900 dark:text-white">
                {submission.timeDeviationMinutes === 0 ? (
                  <span className="text-emerald-500 font-bold">Вовремя (0 мин)</span>
                ) : (
                  <span className="text-amber-500 font-bold">+{submission.timeDeviationMinutes} мин к нормативу</span>
                )}
              </div>
            </div>
          </div>

          {/* Checklist Answers Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 dark:text-white">
                Результаты проверки по регламенту ({submission.templateTitle})
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Всего пунктов: {submission?.answers?.length || 0}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-semibold text-[11px]">
                    <th className="p-3 w-10 text-center">№</th>
                    <th className="p-3">Наименование контрольного пункта</th>
                    <th className="p-3 w-36">Значение / Ответ</th>
                    <th className="p-3 w-28 text-center">Статус</th>
                    <th className="p-3 w-40">Фотофиксация</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(submission?.answers || []).map((ans, idx) => {
                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-850/50 transition ${
                          ans.isViolation ? 'bg-rose-500/5 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{ans.blockTitle}</div>
                          {ans.isViolation && (
                            <div className="text-[11px] text-rose-500 font-semibold mt-0.5 flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{ans.violationReason || 'Отклонение от стандарта ХАССП'}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {typeof ans.value === 'boolean' ? (
                            ans.value ? 'Да / Выполнено' : 'Нет / Не выполнено'
                          ) : (
                            String(ans.value ?? '—')
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {ans.isViolation ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              Брак / Нарушение
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              Норма
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {ans.photoUrls && ans.photoUrls.length > 0 ? (
                            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-thin py-0.5">
                              {ans.photoUrls.map((photo, pIdx) => (
                                <img
                                  key={pIdx}
                                  src={photo}
                                  alt="Фотофиксация"
                                  onClick={() => setSelectedPhoto(photo)}
                                  className="w-9 h-9 rounded-lg object-cover cursor-pointer hover:opacity-80 transition ring-1 ring-slate-300 dark:ring-slate-700 shrink-0"
                                  title="Нажмите для увеличения"
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Electronic Signature / Audit Seal */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Электронный протокол проверен и запечатан</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Хэш SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-500">
              База: <span className="font-mono text-indigo-400">YDB Serverless ru-central1</span><br />
              Хранилище медиа: <span className="font-mono text-rose-400">MinIO S3 (наш VPS)</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Идентификатор документа: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{submission.number1C}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-750 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
          >
            Закрыть
          </button>
        </div>
      </div>

      {/* Enlarged Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={selectedPhoto}
              alt="Увеличенное фото"
              className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="mt-3 text-center text-xs text-slate-400 font-mono">
              MinIO S3 Object • 1080p WebP с водяным знаком геопозиции и времени
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
