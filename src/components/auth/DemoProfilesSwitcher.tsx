import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import { ManagerUser } from '../../types';
import { getAllManagersWithAuth } from '../../services/managerAuth';

interface DemoProfilesSwitcherProps {
  currentUser: ManagerUser;
  onSwitch: (managerId: string) => void;
}

export const DemoProfilesSwitcher: React.FC<DemoProfilesSwitcherProps> = ({
  currentUser,
  onSwitch,
}) => {
  const testIds = [
    'mgr-director-smirnov',
    'mgr-dev',
    'mgr-unit',
    'mgr-auditor',
    'mgr-qc',
    'mgr-holding-director',
    'mgr-vasilieva-director',
  ];
  const testOrgIds = ['org-smirnov', 'org-holding', 'org-vasilieva'];
  const isClean =
    typeof window !== 'undefined' &&
    (localStorage.getItem('checklist_clean_start_mode_v1') === 'true' ||
      localStorage.getItem('checklist_ydb_custom_configured_v1') === 'true' ||
      Boolean(currentUser?.organizationId && !testOrgIds.includes(currentUser.organizationId)));

  const availableManagers = getAllManagersWithAuth()
    .filter(m => m.role !== 'app_admin')
    .filter(m => {
      if (isClean) {
        if (testIds.includes(m.id) || testOrgIds.includes(m.organizationId || '')) {
          return false;
        }
        return !currentUser?.organizationId || m.organizationId === currentUser.organizationId;
      }
      return true;
    });

  if (availableManagers.length <= 1) return null;

  return (
    <div className="py-2.5">
      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 mb-1.5 flex items-center justify-between">
        <span>{isClean ? 'Сотрудники организации:' : 'Сменить профиль:'}</span>
        <Sparkles className="w-3 h-3 text-amber-500" />
      </div>

      <div className="space-y-1">
        {availableManagers.map(preset => {
          const isCurrent = currentUser.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSwitch(preset.id)}
              className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left transition ${
                isCurrent
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <img
                  src={preset.avatarUrl}
                  alt={preset.name}
                  className="w-5 h-5 rounded-full object-cover shrink-0"
                />
                <span className="truncate text-xs">{preset.name}</span>
              </div>
              {isCurrent && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
