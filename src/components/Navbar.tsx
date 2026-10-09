import React, { useState, useRef, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Smartphone, 
  TrendingUp,
  QrCode, 
  Send, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Users,
  ChevronDown,
  Layers,
  Building2,
  Sparkles
} from 'lucide-react';
import { ManagerUser, TabType } from '../types';
import { ManagerBadge } from './auth/ManagerBadge';
import { isTabAllowedForRole, isDemoSession } from '../services/managerAuth';

export type { TabType };

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  networkOnline: boolean;
  setNetworkOnline: (online: boolean) => void;
  queueCount: number;
  unreadAlertsCount: number;
  onSyncQueue: () => void;
  currentUser: ManagerUser | null;
  onOpenLoginModal: () => void;
  onUserChange: (user: ManagerUser | null) => void;
  onSwitchToLinearStaffMode?: () => void;
  onOpenAppAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  networkOnline,
  setNetworkOnline,
  queueCount,
  unreadAlertsCount,
  onSyncQueue,
  currentUser,
  onOpenLoginModal,
  onUserChange,
  onSwitchToLinearStaffMode,
  onOpenAppAdmin,
}) => {
  const [managementDropdownOpen, setManagementDropdownOpen] = useState(false);
  const managementDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (managementDropdownRef.current && !managementDropdownRef.current.contains(e.target as Node)) {
        setManagementDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Primary operational tabs (Core barista & quality control workflows)
  const operationTabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'runner',
      label: 'Терминал',
      icon: <Smartphone className="w-4 h-4 text-amber-400" />,
      badge: queueCount > 0 ? queueCount : undefined,
    },
    {
      id: 'builder',
      label: 'Конструктор',
      icon: <ClipboardCheck className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'datalens',
      label: 'DataLens',
      icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
    },
  ];

  // Management tabs (Network structure, legal entities, barcodes & alerts)
  const managementTabs: { id: TabType; label: string; shortLabel: string; icon: React.ReactNode; desc: string; badge?: number }[] = [
    {
      id: 'company',
      label: 'Юр. лицо (ИП / ООО)',
      shortLabel: 'Юр. лицо',
      icon: <Building2 className="w-4 h-4 text-amber-400" />,
      desc: 'Реквизиты, биллинг и тарифы',
    },
    {
      id: 'staff_points',
      label: 'Точки и штат',
      shortLabel: 'Точки и штат',
      icon: <Users className="w-4 h-4 text-amber-400" />,
      desc: 'Кофейни, бариста и смены',
    },
    {
      id: 'qr',
      label: 'QR-коды точек',
      shortLabel: 'QR-коды',
      icon: <QrCode className="w-4 h-4 text-amber-400" />,
      desc: 'Печать QR-терминалов',
    },
    {
      id: 'telegram',
      label: 'Telegram-бот',
      shortLabel: 'Telegram',
      icon: <Send className="w-4 h-4 text-sky-400" />,
      desc: 'Оповещения о нарушениях',
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
    },
  ];

  // Note: All Service / Infrastructure tabs (YDB SQL, MinIO VPS S3) have been moved to the App Admin Panel per requirement

  const isTabAllowed = (tabId: TabType): boolean => {
    if (currentUser?.role) {
      return isTabAllowedForRole(currentUser.role, tabId);
    }
    // When logged out of manager profile, strictly hide organization data and staff
    if (tabId === 'company' || tabId === 'staff_points' || tabId === 'ydb' || tabId === 'minio') {
      return false;
    }
    return true;
  };

  const visibleOperationTabs = operationTabs.filter(t => isTabAllowed(t.id));
  const visibleManagementTabs = managementTabs.filter(t => isTabAllowed(t.id));

  const activeManagementTab = visibleManagementTabs.find(t => t.id === activeTab);
  const isAnyManagementActive = Boolean(activeManagementTab);
  const managementBadgeCount = visibleManagementTabs.reduce((acc, t) => acc + (t.badge || 0), 0);

  // All allowed tabs for mobile secondary bar
  const allAllowedTabs = [
    ...visibleOperationTabs,
    ...visibleManagementTabs
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm w-full">
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4 w-full">
          {/* Logo and Brand */}
          <div 
            onClick={() => setActiveTab('welcome')}
            className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer group shrink-0"
            title="Перейти на главную заставку"
          >
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-md shadow-amber-500/20 text-slate-950 font-black text-lg sm:text-xl tracking-tight group-hover:scale-105 transition-transform shrink-0">
              QC
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-bold text-sm sm:text-base xl:text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors whitespace-nowrap">
                  HoReCa Quality
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 hidden 2xl:inline-block">
                  {currentUser?.role === 'developer' ? 'Разработчик' : currentUser?.role === 'manager' ? 'Управляющий' : currentUser?.role === 'owner' ? 'Директор' : 'Контроль качества'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden xl:block truncate">Контроль стандартов сети</p>
            </div>
          </div>

          {/* Harmonious Grouped Navigation Tabs (PC/Desktop) */}
          <nav className="hidden lg:flex items-center space-x-1.5 xl:space-x-2 min-w-0">
            {/* Core Operations Capsule */}
            <div className="flex items-center space-x-0.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800/90 shadow-xs">
              {visibleOperationTabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}-btn`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all relative whitespace-nowrap ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ml-0.5">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Management Dropdown (Uncluttered, compact, no horizontal overflow) */}
            {visibleManagementTabs.length > 0 && (
              <div className="relative" ref={managementDropdownRef}>
                <button
                  type="button"
                  onClick={() => setManagementDropdownOpen(!managementDropdownOpen)}
                  className={`flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs xl:text-sm font-semibold border transition-all whitespace-nowrap ${
                    isAnyManagementActive
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-xs'
                      : 'bg-slate-950/70 text-slate-300 border-slate-800/90 hover:bg-slate-800 hover:text-white'
                  }`}
                  title="Управление сетью (Юр. лицо, точки, персонал, QR, Telegram)"
                >
                  {isAnyManagementActive ? activeManagementTab?.icon : <Users className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-amber-400" />}
                  <span>{isAnyManagementActive ? activeManagementTab?.shortLabel : 'Управление'}</span>
                  {managementBadgeCount > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ml-0.5">
                      {managementBadgeCount}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${managementDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {managementDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 mb-1">
                      Управление сетью и юр. лицом
                    </div>
                    {visibleManagementTabs.map(tab => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setActiveTab(tab.id);
                            setManagementDropdownOpen(false);
                          }}
                          className={`w-full flex items-start space-x-2.5 p-2 rounded-xl text-left transition ${
                            isActive
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">{tab.icon}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold truncate">{tab.label}</span>
                              {tab.badge !== undefined && tab.badge > 0 && (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ml-1 shrink-0">
                                  {tab.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-tight">{tab.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right Area: Queue, Network, Staff Mode & Manager Auth (Always anchored & never pushed off) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {isDemoSession() && (
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Демо-режим
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenLoginModal) onOpenLoginModal();
                  }}
                  className="text-[10px] underline hover:text-amber-100 ml-1 cursor-pointer"
                  title="Зарегистрируйтесь, чтобы выйти из демо и получить полный доступ"
                >
                  Зарегистрироваться
                </button>
              </div>
            )}

            {onSwitchToLinearStaffMode && (
              <button
                type="button"
                onClick={onSwitchToLinearStaffMode}
                className="flex items-center space-x-1.5 px-2 xl:px-2.5 2xl:px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs xl:text-sm font-semibold transition-all shadow-2xs whitespace-nowrap shrink-0"
                title="Переключиться в чистый мобильный терминал линейного сотрудника"
              >
                <Smartphone className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Вид сотрудника</span>
              </button>
            )}

            {queueCount > 0 && (
              <button
                id="flush-queue-header-btn"
                onClick={onSyncQueue}
                className="flex items-center space-x-1.5 px-2 xl:px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs xl:text-sm font-semibold shadow transition-all animate-pulse whitespace-nowrap shrink-0"
                title="Передать накопленную офлайн-очередь в YDB"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
                <span className="hidden sm:inline">Очередь: {queueCount}</span>
                <span className="sm:hidden">{queueCount}</span>
              </button>
            )}

            <button
              id="toggle-network-btn"
              onClick={() => setNetworkOnline(!networkOnline)}
              className={`flex items-center space-x-1.5 px-2 xl:px-2.5 py-1.5 rounded-xl text-xs xl:text-sm font-semibold border transition-all whitespace-nowrap shrink-0 ${
                networkOnline
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300 hover:bg-rose-900/60'
              }`}
              title="Переключить симуляцию сети (Онлайн / Офлайн на точке)"
            >
              {networkOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-emerald-400 shrink-0" />
                  <span className="hidden xl:inline">Онлайн</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-rose-400 shrink-0" />
                  <span className="hidden xl:inline">Офлайн</span>
                </>
              )}
            </button>

            {/* Manager Auth Badge / Dropdown */}
            <ManagerBadge
              currentUser={currentUser}
              onOpenLoginModal={onOpenLoginModal}
              onUserChange={onUserChange}
              onOpenAppAdmin={onOpenAppAdmin}
            />
          </div>
        </div>

        {/* Tablet / Mobile secondary navigation with horizontal scroll */}
        <div className="flex lg:hidden overflow-x-auto py-2 space-x-1.5 scrollbar-none border-t border-slate-800/80">
          {allAllowedTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition relative ${
                  isActive ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {'badge' in tab && tab.badge !== undefined && tab.badge > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 ml-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
