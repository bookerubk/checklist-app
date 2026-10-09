import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  UserPlus, 
  Search, 
  KeyRound, 
  Copy, 
  Check, 
  Trash2, 
  Power, 
  Mail, 
  Phone, 
  Clock, 
  Sparkles, 
  AlertCircle, 
  X, 
  Headphones, 
  CreditCard, 
  Server, 
  User, 
  FileText,
  Eye,
  EyeOff,
  ExternalLink,
  MessageSquare,
  Lock,
  Camera
} from 'lucide-react';
import { PlatformAdminUser, PlatformAdminRole } from '../../types';
import { AvatarEditModal } from '../common/AvatarEditModal';
import { 
  getPlatformAdmins, 
  createPlatformAdmin, 
  updatePlatformAdmin, 
  togglePlatformAdminActive, 
  deletePlatformAdmin, 
  generateSecureAdminPassword,
  buildAdminInviteMessage,
  PLATFORM_ROLE_DEFINITIONS,
  CreatePlatformAdminInput
} from '../../services/platformAdminService';

interface PlatformAdminsManagerProps {
  onAdminsUpdated?: () => void;
}

export const PlatformAdminsManager: React.FC<PlatformAdminsManagerProps> = ({ onAdminsUpdated }) => {
  const [admins, setAdmins] = useState<PlatformAdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | PlatformAdminRole>('all');
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [avatarEditAdmin, setAvatarEditAdmin] = useState<PlatformAdminUser | null>(null);
  const [isNewAdminAvatarModalOpen, setIsNewAdminAvatarModalOpen] = useState(false);
  
  // Current admin for share or password change
  const [selectedAdmin, setSelectedAdmin] = useState<PlatformAdminUser | null>(null);
  const [lastCreatedPassword, setLastCreatedPassword] = useState<string>('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  
  // New Admin Form State
  const [formData, setFormData] = useState<CreatePlatformAdminInput>({
    name: '',
    login: '',
    email: '',
    phone: '',
    password: '',
    role: 'support_lead',
    notes: '',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Password change modal state
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Load admins
  const refreshAdmins = () => {
    const list = getPlatformAdmins();
    setAdmins(list);
    if (onAdminsUpdated) {
      onAdminsUpdated();
    }
  };

  useEffect(() => {
    refreshAdmins();
  }, []);

  const handleSaveAdminAvatar = (newAvatarUrl: string) => {
    if (!avatarEditAdmin) return;
    updatePlatformAdmin(avatarEditAdmin.id, { avatarUrl: newAvatarUrl });
    refreshAdmins();
    setAvatarEditAdmin(null);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const defaultPass = generateSecureAdminPassword();
    setFormData({
      name: '',
      login: '',
      email: '',
      phone: '',
      password: defaultPass,
      role: 'support_lead',
      notes: '',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    });
    setFormError(null);
    setShowPassword(true);
    setIsCreateModalOpen(true);
  };

  // Generate password for form
  const handleGeneratePassword = () => {
    const pass = generateSecureAdminPassword();
    setFormData(prev => ({ ...prev, password: pass }));
  };

  // Submit Create Admin
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const res = createPlatformAdmin(formData);
    setIsSubmitting(false);

    if (!res.success || !res.admin) {
      setFormError(res.error || 'Ошибка при создании администратора');
      return;
    }

    refreshAdmins();
    setIsCreateModalOpen(false);
    
    // Automatically open share dialog with the generated credentials
    setSelectedAdmin(res.admin);
    setLastCreatedPassword(formData.password);
    setIsShareModalOpen(true);
  };

  // Toggle active status
  const handleToggleActive = (id: string) => {
    const res = togglePlatformAdminActive(id);
    if (!res.success) {
      alert(res.error || 'Не удалось изменить статус активности');
      return;
    }
    refreshAdmins();
  };

  // Delete admin
  const handleDeleteAdmin = (admin: PlatformAdminUser) => {
    if (admin.login === 'appadmin') {
      alert('Нельзя удалить мастер-аккаунт супер-администратора');
      return;
    }

    if (window.confirm(`Вы уверены, что хотите удалить администратора «${admin.name}» (${admin.login})? Доступ к панели администратора будет аннулирован.`)) {
      const res = deletePlatformAdmin(admin.id);
      if (!res.success) {
        alert(res.error || 'Не удалось удалить администратора');
        return;
      }
      refreshAdmins();
    }
  };

  // Open share modal for existing admin
  const handleOpenShareModal = (admin: PlatformAdminUser) => {
    setSelectedAdmin(admin);
    setLastCreatedPassword(admin.passwordHash);
    setIsShareModalOpen(true);
  };

  // Copy invitation message
  const handleCopyInvite = (admin: PlatformAdminUser, pass?: string) => {
    const msg = buildAdminInviteMessage(admin, pass);
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    });
  };

  // Open password reset modal
  const handleOpenPasswordModal = (admin: PlatformAdminUser) => {
    setSelectedAdmin(admin);
    setNewPasswordInput(generateSecureAdminPassword());
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  // Submit new password
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;

    if (!newPasswordInput.trim() || newPasswordInput.trim().length < 4) {
      setPasswordError('Пароль должен содержать минимум 4 символа');
      return;
    }

    const res = updatePlatformAdmin(selectedAdmin.id, {
      passwordHash: newPasswordInput.trim(),
    });

    if (!res.success || !res.admin) {
      setPasswordError(res.error || 'Не удалось обновить пароль');
      return;
    }

    refreshAdmins();
    setIsPasswordModalOpen(false);
    
    // Offer to copy the updated credentials
    setSelectedAdmin(res.admin);
    setLastCreatedPassword(newPasswordInput.trim());
    setIsShareModalOpen(true);
  };

  // Filtered admins
  const filteredAdmins = admins.filter(admin => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !q || 
      admin.name.toLowerCase().includes(q) || 
      admin.login.toLowerCase().includes(q) || 
      admin.email.toLowerCase().includes(q) ||
      (admin.phone && admin.phone.includes(q)) ||
      (admin.roleTitle && admin.roleTitle.toLowerCase().includes(q));

    const matchesRole = roleFilter === 'all' || admin.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: PlatformAdminRole) => {
    switch (role) {
      case 'app_admin':
        return <Shield className="w-4 h-4 text-rose-400" />;
      case 'support_lead':
        return <Headphones className="w-4 h-4 text-sky-400" />;
      case 'billing_admin':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'tech_admin':
        return <Server className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner & Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Команда управления платформой</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Администраторы и техподдержка
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Создание дополнительных учетных записей для коллег, инженеров поддержки и биллинга. 
              Каждому администратору выдается персональный логин и пароль с изолированным доступом в защищенный контур.
            </p>
          </div>

          <div className="shrink-0 flex items-center space-x-3">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm transition flex items-center space-x-2 shadow-lg shadow-rose-600/25 hover:shadow-rose-600/40 transform active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Добавить администратора</span>
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <div className="text-[11px] text-slate-400">Всего администраторов</div>
            <div className="text-xl font-black text-white mt-0.5">{admins.length}</div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <div className="text-[11px] text-slate-400">Активные доступы</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">
              {admins.filter(a => a.isActive).length}
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <div className="text-[11px] text-slate-400">Техподдержка & Биллинг</div>
            <div className="text-xl font-black text-sky-400 mt-0.5">
              {admins.filter(a => a.role === 'support_lead' || a.role === 'billing_admin').length}
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <div className="text-[11px] text-slate-400">Таблица YDB мастер-контура</div>
            <div className="text-xs font-mono font-bold text-indigo-300 mt-1 truncate">
              system_admin_users
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по ФИО, логину, email или роли..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-hidden focus:border-rose-500 placeholder-slate-500 transition"
          />
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto p-1 bg-slate-950 rounded-xl border border-slate-800/80 scrollbar-none">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              roleFilter === 'all'
                ? 'bg-rose-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Все ({admins.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('app_admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              roleFilter === 'app_admin'
                ? 'bg-rose-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Root ({admins.filter(a => a.role === 'app_admin').length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('support_lead')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              roleFilter === 'support_lead'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Поддержка ({admins.filter(a => a.role === 'support_lead').length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('billing_admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              roleFilter === 'billing_admin'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Биллинг ({admins.filter(a => a.role === 'billing_admin').length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('tech_admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              roleFilter === 'tech_admin'
                ? 'bg-purple-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            DevOps ({admins.filter(a => a.role === 'tech_admin').length})
          </button>
        </div>
      </div>

      {/* Admin Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAdmins.map((admin) => {
          const roleDef = PLATFORM_ROLE_DEFINITIONS[admin.role] || PLATFORM_ROLE_DEFINITIONS.app_admin;
          const isRoot = admin.login === 'appadmin' || admin.id === 'adm-root';

          return (
            <div 
              key={admin.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition relative overflow-hidden shadow-lg ${
                admin.isActive 
                  ? isRoot 
                    ? 'border-rose-500/40 ring-1 ring-rose-500/20' 
                    : 'border-slate-800 hover:border-slate-700'
                  : 'border-slate-800/60 opacity-60 bg-slate-950/40'
              }`}
            >
              {/* Top info */}
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div 
                      className="relative shrink-0 group cursor-pointer"
                      onClick={() => setAvatarEditAdmin(admin)}
                      title="Нажмите, чтобы изменить аватар администратора"
                    >
                      <img
                        src={admin.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                        alt={admin.name}
                        className="w-11 h-11 rounded-2xl object-cover ring-2 ring-slate-800 group-hover:ring-rose-500/50 group-hover:brightness-75 transition"
                      />
                      <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-slate-950/50 opacity-0 group-hover:opacity-100 transition text-rose-300">
                        <Camera className="w-4 h-4" />
                      </div>
                      <span 
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                          admin.isActive ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : 'bg-slate-600'
                        }`} 
                        title={admin.isActive ? 'Активен' : 'Отключен'}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-white text-sm truncate">{admin.name}</span>
                      </div>
                      <div className="font-mono text-xs text-rose-300 font-semibold truncate">
                        @{admin.login}
                      </div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border shrink-0 ${roleDef.badgeColor}`}>
                    {getRoleIcon(admin.role)}
                    <span className="truncate max-w-[120px]">{admin.roleTitle}</span>
                  </span>
                </div>

                {/* Description of rights */}
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {roleDef.description}
                </p>

                {/* Contacts & Metadata */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/70 text-xs text-slate-400">
                  <div className="flex items-center space-x-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{admin.email}</span>
                  </div>
                  {admin.phone && (
                    <div className="flex items-center space-x-2 truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate font-mono text-[11px]">{admin.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 text-[11px] text-slate-500 pt-0.5">
                    <Clock className="w-3 h-3 text-slate-600 shrink-0" />
                    <span>Вход: {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : 'Еще не входил'}</span>
                  </div>
                </div>

                {admin.notes && (
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-400 italic">
                    «{admin.notes}»
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenShareModal(admin)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-semibold transition flex items-center justify-center space-x-1.5 border border-slate-700/60"
                  title="Скопировать логин, пароль и ссылку входа для передачи коллеге"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                  <span>Выдать доступы</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAvatarEditAdmin(admin)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-rose-300 transition border border-slate-700/40"
                  title="Сменить аватар / фото администратора"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenPasswordModal(admin)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-amber-300 transition border border-slate-700/40"
                  title="Сменить пароль администратора"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>

                {!isRoot && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(admin.id)}
                      className={`p-2 rounded-xl transition border ${
                        admin.isActive
                          ? 'bg-slate-800/80 hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 border-slate-700/40'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                      title={admin.isActive ? 'Заблокировать доступ' : 'Активировать доступ'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteAdmin(admin)}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition border border-slate-700/40"
                      title="Удалить администратора"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredAdmins.length === 0 && (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-white">Администраторы не найдены</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            По заданному фильтру ничего не найдено. Попробуйте изменить поисковый запрос или сбросить фильтры.
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREATE NEW PLATFORM ADMINISTRATOR               */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Создание администратора платформы</h3>
                  <p className="text-xs text-slate-400">Выдача персональных прав и логина сотруднику</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>{formError}</div>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4">
              {/* Avatar Selector Preview */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="relative shrink-0">
                    <img
                      src={formData.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                      alt="Аватар"
                      className="w-12 h-12 rounded-2xl object-cover ring-2 ring-rose-500/40 shadow-sm"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Аватар профиля</div>
                    <div className="text-[11px] text-slate-400">Коллекция фото, загрузка с устройства или URL</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewAdminAvatarModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center space-x-1.5 shrink-0"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Выбрать фото</span>
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ФИО администратора / коллеги <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Например: Иван Ковалев"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-hidden focus:border-rose-500 placeholder-slate-600 transition"
                    required
                  />
                </div>
              </div>

              {/* Login & Email Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Логин для входа <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">@</span>
                    <input
                      type="text"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '') })}
                      placeholder="support_ivan"
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-hidden focus:border-rose-500 placeholder-slate-600 transition"
                      required
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Латиница, цифры, _ или -</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Рабочий Email <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="ivan@horeca-cloud.ru"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-hidden focus:border-rose-500 placeholder-slate-600 transition"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Номер телефона (опционально)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+7 (999) 111-22-33"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-hidden focus:border-rose-500 placeholder-slate-600 transition"
                  />
                </div>
              </div>

              {/* Platform Role Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Роль и профиль ответственности <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(PLATFORM_ROLE_DEFINITIONS) as PlatformAdminRole[]).map((roleKey) => {
                    const rDef = PLATFORM_ROLE_DEFINITIONS[roleKey];
                    const isSelected = formData.role === roleKey;
                    return (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: roleKey })}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-rose-500/10 border-rose-500 text-white shadow-xs'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {getRoleIcon(roleKey)}
                          <span className="text-xs font-bold text-white">{rDef.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {rDef.permissionsSummary}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Пароль администратора <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Сгенерировать</span>
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Надежный пароль"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-hidden focus:border-rose-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Служебная записка / назначение (для себя)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Например: Дежурства техподдержки в выходные дни"
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500 placeholder-slate-600 transition"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition"
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/20"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Создание...' : 'Создать учетную запись'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: SHARE / COPY CREDENTIALS FOR COLLEAGUE         */}
      {/* ======================================================== */}
      {isShareModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden z-10">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Данные для передачи коллеге</h3>
                  <p className="text-xs text-slate-400">Передайте эти доступы в Telegram или рабочий чат</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Credentials Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="text-slate-400">Сотрудник:</span>
                  <span className="text-white font-sans font-bold">{selectedAdmin.name}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="text-slate-400">Роль:</span>
                  <span className="text-amber-400 font-sans font-semibold">{selectedAdmin.roleTitle}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="text-slate-400">Логин:</span>
                  <span className="text-rose-300 font-bold">{selectedAdmin.login}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="text-slate-400">Пароль:</span>
                  <span className="text-white bg-slate-800 px-2 py-0.5 rounded font-bold">
                    {lastCreatedPassword || selectedAdmin.passwordHash}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">URL входа:</span>
                  <span className="text-sky-300 truncate max-w-[240px]">
                    {typeof window !== 'undefined' ? `${window.location.origin}/#админ` : '/#админ'}
                  </span>
                </div>
              </div>

              {/* Ready text preview */}
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1.5">Текст для отправки:</div>
                <pre className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                  {buildAdminInviteMessage(selectedAdmin, lastCreatedPassword || selectedAdmin.passwordHash)}
                </pre>
              </div>

              {/* Action */}
              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="w-1/3 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition"
                >
                  Закрыть
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyInvite(selectedAdmin, lastCreatedPassword || selectedAdmin.passwordHash)}
                  className={`w-2/3 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-2 shadow-lg ${
                    copiedSuccess
                      ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                  }`}
                >
                  {copiedSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Скопировано в буфер!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Скопировать для отправки</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CHANGE PASSWORD                                */}
      {/* ======================================================== */}
      {isPasswordModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden z-10">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Смена пароля</h3>
                  <p className="text-xs text-slate-400">Для {selectedAdmin.name} (@{selectedAdmin.login})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {passwordError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Новый пароль
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewPasswordInput(generateSecureAdminPassword())}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Сгенерировать</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-hidden focus:border-rose-500 transition"
                  required
                />
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition"
                >
                  Сохранить пароль
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Avatar Modal */}
      {avatarEditAdmin && (
        <AvatarEditModal
          isOpen={!!avatarEditAdmin}
          onClose={() => setAvatarEditAdmin(null)}
          currentAvatarUrl={avatarEditAdmin.avatarUrl}
          userName={avatarEditAdmin.name}
          userRoleTitle={avatarEditAdmin.roleTitle}
          onSave={handleSaveAdminAvatar}
          title={`Аватар: ${avatarEditAdmin.name}`}
        />
      )}

      {/* Select Avatar for New Admin Modal */}
      <AvatarEditModal
        isOpen={isNewAdminAvatarModalOpen}
        onClose={() => setIsNewAdminAvatarModalOpen(false)}
        currentAvatarUrl={formData.avatarUrl}
        userName={formData.name || 'Новый администратор'}
        userRoleTitle={PLATFORM_ROLE_DEFINITIONS[formData.role]?.title || 'Администратор'}
        onSave={(url) => {
          setFormData(prev => ({ ...prev, avatarUrl: url }));
          setIsNewAdminAvatarModalOpen(false);
        }}
        title="Выбор аватара администратора"
      />

    </div>
  );
};
