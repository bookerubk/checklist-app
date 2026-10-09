import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  User, 
  LogIn, 
  LogOut, 
  ChevronDown, 
  Shield, 
  Settings,
  Lock,
  Camera
} from 'lucide-react';
import { ManagerUser, ManagerRole } from '../../types';
import { quickSwitchManager, updateManagerAvatar } from '../../services/managerAuth';
import { AvatarEditModal } from '../common/AvatarEditModal';
import { DemoProfilesSwitcher } from './DemoProfilesSwitcher';

interface ManagerBadgeProps {
  currentUser: ManagerUser | null;
  onOpenLoginModal: () => void;
  onUserChange: (user: ManagerUser | null) => void;
  onOpenAppAdmin?: () => void;
}

export const ManagerBadge: React.FC<ManagerBadgeProps> = ({
  currentUser,
  onOpenLoginModal,
  onUserChange,
  onOpenAppAdmin,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickSwitch = (presetId: string) => {
    const updated = quickSwitchManager(presetId);
    if (updated) {
      onUserChange(updated);
      setDropdownOpen(false);
    }
  };

  const handleSaveAvatar = (newAvatarUrl: string) => {
    if (!currentUser) return;
    const res = updateManagerAvatar(currentUser.id, newAvatarUrl);
    if (res.success && res.user) {
      onUserChange(res.user);
    } else {
      onUserChange({
        ...currentUser,
        avatarUrl: newAvatarUrl,
      });
    }
  };

  const handleLogout = () => {
    onUserChange(null);
    setDropdownOpen(false);
  };

  if (!currentUser || !currentUser.name) {
    return (
      <button
        type="button"
        onClick={onOpenLoginModal}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm whitespace-nowrap shrink-0"
      >
        <Lock className="w-3.5 h-3.5" />
        <span>Вход управляющего</span>
      </button>
    );
  }

  const getRoleShortBadge = (role: ManagerRole) => {
    switch (role) {
      case 'director':
      case 'owner':
        return <span className="text-[10px] font-bold text-amber-300">Директор</span>;
      case 'developer':
        return <span className="text-[10px] font-bold text-sky-300">Разработчик</span>;
      case 'tech_admin':
        return <span className="text-[10px] font-bold text-cyan-300">DevOps / Админ</span>;
      case 'auditor':
        return <span className="text-[10px] font-bold text-purple-300">Аудитор</span>;
      case 'manager':
      case 'regional_manager':
        return <span className="text-[10px] font-bold text-emerald-300">Управляющий</span>;
      case 'quality_control':
        return <span className="text-[10px] font-bold text-pink-300">Контроль качества</span>;
      case 'app_admin':
        return <span className="text-[10px] font-bold text-rose-300">Администратор платформы</span>;
      default:
        return <span className="text-[10px] font-bold text-slate-300">Сотрудник</span>;
    }
  };

  const displayName = currentUser.name || 'Управляющий';
  const firstName = displayName.split(' ')[0] || displayName;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-2 p-1 pl-2 pr-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700 text-white transition text-xs font-semibold shadow-xs"
      >
        <img 
          src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'} 
          alt={displayName} 
          className="w-6 h-6 rounded-full object-cover ring-1 ring-amber-500/50" 
        />
        <div className="text-left hidden sm:block leading-tight">
          <div className="text-white text-[11px] font-bold truncate max-w-[110px]">
            {firstName}
          </div>
          <div>{getRoleShortBadge(currentUser.role)}</div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-50 text-xs text-white animate-in fade-in slide-in-from-top-2">
          {/* User Info Header */}
          <div className="flex items-center space-x-3 p-2 border-b border-slate-800 pb-3">
            <div 
              className="relative group cursor-pointer shrink-0" 
              onClick={() => {
                setDropdownOpen(false);
                setIsAvatarModalOpen(true);
              }}
              title="Нажмите, чтобы изменить аватар профиля"
            >
              <img 
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'} 
                alt={displayName} 
                className="w-11 h-11 rounded-full object-cover ring-2 ring-amber-500 group-hover:brightness-75 transition shadow-sm" 
              />
              <div className="absolute inset-0 rounded-full flex items-center justify-center bg-slate-950/50 opacity-0 group-hover:opacity-100 transition text-amber-300">
                <Camera className="w-4 h-4" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-white text-xs truncate">{displayName}</div>
              <div className="text-slate-400 text-[11px] truncate">{currentUser.email}</div>
              <div className="mt-0.5">{getRoleShortBadge(currentUser.role)}</div>
            </div>
          </div>

          {/* Quick Edit Avatar Button */}
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              setIsAvatarModalOpen(true);
            }}
            className="w-full mt-2 mb-1 flex items-center justify-center space-x-2 py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/20 transition"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Сменить аватар профиля</span>
          </button>

          {/* Quick Profile Switching (only when VITE_SHOW_DEMO_PROFILES is true) */}
          {import.meta.env.VITE_SHOW_DEMO_PROFILES === 'true' && (
            <DemoProfilesSwitcher
              currentUser={currentUser}
              onSwitch={handleQuickSwitch}
            />
          )}

          <div className="border-t border-slate-800 pt-2 space-y-1">
            {currentUser.role === 'app_admin' && (
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  if (onOpenAppAdmin) {
                    onOpenAppAdmin();
                  } else {
                    window.location.hash = '#админ';
                  }
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg text-rose-300 hover:bg-rose-500/10 transition font-semibold"
              >
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                  <span>Панель администратора</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">/админ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                onOpenLoginModal();
              }}
              className="w-full flex items-center space-x-2 p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Форма входа по логину</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти из профиля</span>
            </button>
          </div>
        </div>
      )}

      {/* Avatar Edit Modal */}
      {currentUser && (
        <AvatarEditModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          currentAvatarUrl={currentUser.avatarUrl}
          userName={displayName}
          userRoleTitle={currentUser.roleTitle || currentUser.role}
          onSave={handleSaveAvatar}
          title={currentUser.role === 'app_admin' ? 'Аватар администратора платформы' : 'Аватар профиля управленца'}
        />
      )}
    </div>
  );
};
