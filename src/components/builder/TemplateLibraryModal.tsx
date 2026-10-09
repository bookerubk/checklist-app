import React from 'react';
import { ChecklistTemplate } from '../../types';
import { PREBUILT_TEMPLATES } from '../../mockData';
import { X, Sparkles, Clock, CheckCircle2, Coffee, ShieldCheck, Moon, Trash2 } from 'lucide-react';

interface TemplateLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ChecklistTemplate) => void;
}

export const TemplateLibraryModal: React.FC<TemplateLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'opening':
        return <Coffee className="w-5 h-5 text-amber-500" />;
      case 'haccp':
        return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
      case 'closing':
        return <Moon className="w-5 h-5 text-indigo-500" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-slate-500" />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'opening': return 'Открытие смены';
      case 'haccp': return 'ХАССП и СанПиН';
      case 'closing': return 'Закрытие смены';
      case 'equipment': return 'Оборудование';
      default: return 'Операционный';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Библиотека готовых чек-листов HoReCa
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Проверенные регламенты для кофеен, кафе и пекарен
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates list */}
        <div className="p-6 overflow-y-auto space-y-3.5 divide-y divide-slate-100 dark:divide-slate-800/60">
          {PREBUILT_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-amber-500/5 hover:border-amber-500/30 transition-all group"
            >
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs">
                  {getCategoryIcon(tpl.category)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {getCategoryName(tpl.category)}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {tpl.code} (v{tpl.version})
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                    {tpl.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {tpl.description}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Время: {tpl.targetTime || 'Любое'}</span>
                    </span>
                    <span>{tpl.blocks.length} пунктов контроля</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectTemplate(JSON.parse(JSON.stringify(tpl)));
                  onClose();
                }}
                className="self-end sm:self-center shrink-0 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm"
              >
                Выбрать шаблон
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
