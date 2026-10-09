import React from 'react';
import { 
  Coffee, 
  Smartphone, 
  Lock, 
  Key, 
  ClipboardCheck, 
  TrendingUp, 
  ShieldCheck, 
  Camera, 
  WifiOff, 
  CheckCircle2, 
  ArrowRight,
  Tablet,
  Sparkles
} from 'lucide-react';
import { ManagerUser } from '../../types';

interface SplashScreenProps {
  onOpenRunner: () => void;
  onOpenLoginModal: () => void;
  onOpenBuilderPreview: () => void;
  currentUser: ManagerUser | null;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onOpenRunner,
  onOpenLoginModal,
  onOpenBuilderPreview,
  currentUser,
}) => {
  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 space-y-8 animate-in fade-in duration-300">
      {/* Brand Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-10 border border-slate-800 shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
          {/* Logo Badge */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-2xl sm:text-3xl shadow-lg shadow-amber-500/25 mb-4">
            <Coffee className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.2]" />
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Контроль качества сети кофеен</span>
          </span>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            HoReCa Quality Control
          </h1>

          <p className="text-sm sm:text-base text-slate-300 mt-3 leading-relaxed">
            Корпоративная система аудита стандартов, электронных чек-листов ХАССП и фотофиксации для линейных сотрудников и руководства сети кофеен.
          </p>

          {/* User Status Pill */}
          {!currentUser ? (
            <div className="mt-5 inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Сотрудники и торговые точки скрыты (требуется авторизация руководства)</span>
            </div>
          ) : (
            <div className="mt-5 inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Вы авторизованы: {currentUser.name} ({currentUser.roleTitle})</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Action Portals (Two clear pathways) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pathway 1: Linear Staff Terminal */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Терминал бариста
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                  Линейный персонал
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Специализированный мобильный интерфейс для заполнения чек-листов смены на смартфоне или планшете кофейни. Поддержка офлайн-режима и прикрепления фото.
              </p>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Адаптировано для экранов смартфонов и планшетов</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Быстрый выбор своей смены и кофейни</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Работает без интернета при сбоях связи</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={onOpenRunner}
            className="mt-6 w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition shadow-sm group-hover:shadow"
          >
            <Smartphone className="w-4 h-4" />
            <span>Запустить мобильный терминал</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>

        {/* Pathway 2: Management Portal */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Панель руководства
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Управляющие и Аудит
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Управление чек-листами, оргструктурой (сотрудники и торговые точки), аналитика выполнения стандартов в DataLens и генерация QR-кодов для барных стоек.
              </p>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Конструктор чек-листов и регламентов ХАССП</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Управление сотрудниками, точками и пин-кодами</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Сводные аналитические дашборды нарушений</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={onOpenLoginModal}
            className="mt-6 w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs flex items-center justify-center space-x-2 border border-slate-700 transition shadow-sm"
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span>{currentUser ? 'Управление профилем' : 'Войти в профиль руководства'}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>

      {/* Secondary Information & Read-only preview */}
      <div className="bg-slate-100 dark:bg-slate-850/50 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">Ознакомительный просмотр шаблонов</div>
            <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
              Вы можете посмотреть структуру готовых чек-листов в режиме чтения без авторизации.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenBuilderPreview}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition border border-slate-200 dark:border-slate-700 shadow-xs self-start sm:self-auto"
        >
          Открыть конструктор (просмотр)
        </button>
      </div>

      {/* Core Platform Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
            <Tablet className="w-4 h-4" />
            <span>Планшеты и Смартфоны</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
            Автоматическое масштабирование под планшеты на барной стойке и личные смартфоны персонала.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
            <Camera className="w-4 h-4" />
            <span>Фотофиксация ХАССП</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
            Обязательные фото чистоты кофемолки, паровика и выкладки десертов сохраняются в S3 хранилище.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Конфиденциальность сети</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
            Списки сотрудников, адреса и пин-коды надежно скрыты от неавторизованных пользователей.
          </p>
        </div>
      </div>
    </div>
  );
};
