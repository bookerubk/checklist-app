import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Link as LinkIcon, 
  Sparkles, 
  X, 
  Check, 
  RotateCcw, 
  User, 
  AlertCircle,
  Briefcase,
  Shield,
  Coffee,
  CheckCircle2
} from 'lucide-react';

export interface AvatarEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  userName: string;
  userRoleTitle?: string;
  onSave: (newAvatarUrl: string) => void | Promise<void>;
  title?: string;
}

// Curated high quality avatars suitable for HoReCa managers, directors, IT admins, and baristas
export const PRESET_AVATARS: Array<{ id: string; url: string; title: string; category: 'management' | 'admin' | 'staff' }> = [
  // Management
  {
    id: 'm1',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    title: 'Анна (Директор)',
    category: 'management',
  },
  {
    id: 'm2',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    title: 'Дмитрий (Управляющий)',
    category: 'management',
  },
  {
    id: 'm3',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    title: 'Елена (Руководитель)',
    category: 'management',
  },
  {
    id: 'm4',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    title: 'Алексей (Куратор)',
    category: 'management',
  },
  {
    id: 'm5',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
    title: 'Ольга (Контроль качества)',
    category: 'management',
  },
  {
    id: 'm6',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
    title: 'Сергей (Основатель)',
    category: 'management',
  },

  // Admins & IT
  {
    id: 'a1',
    url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    title: 'Александр (Root Admin)',
    category: 'admin',
  },
  {
    id: 'a2',
    url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80',
    title: 'Максим (Инженер YDB)',
    category: 'admin',
  },
  {
    id: 'a3',
    url: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&auto=format&fit=crop&q=80',
    title: 'Илья (DevOps)',
    category: 'admin',
  },
  {
    id: 'a4',
    url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80',
    title: 'Константин (Техподдержка)',
    category: 'admin',
  },
  {
    id: 'a5',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
    title: 'Виктория (Аналитик DataLens)',
    category: 'admin',
  },
  {
    id: 'a6',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
    title: 'Роман (Архитектор)',
    category: 'admin',
  },

  // Staff & Barista
  {
    id: 's1',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
    title: 'Мария (Шеф-бариста)',
    category: 'staff',
  },
  {
    id: 's2',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
    title: 'Никита (Бариста)',
    category: 'staff',
  },
  {
    id: 's3',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80',
    title: 'Алина (Сервис-менеджер)',
    category: 'staff',
  },
  {
    id: 's4',
    url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=200&auto=format&fit=crop&q=80',
    title: 'Полина (Пекарь)',
    category: 'staff',
  },
  {
    id: 's5',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80',
    title: 'Артем (Бариста)',
    category: 'staff',
  },
  {
    id: 's6',
    url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&auto=format&fit=crop&q=80',
    title: 'Наталья (Старший смены)',
    category: 'staff',
  },
];

export const AvatarEditModal: React.FC<AvatarEditModalProps> = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  userName,
  userRoleTitle,
  onSave,
  title = 'Редактирование аватара',
}) => {
  const [selectedUrl, setSelectedUrl] = useState<string>(
    currentAvatarUrl || PRESET_AVATARS[0].url
  );
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const [presetCategory, setPresetCategory] = useState<'all' | 'management' | 'admin' | 'staff'>('all');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedUrl(currentAvatarUrl || PRESET_AVATARS[0].url);
      setCustomUrlInput(currentAvatarUrl && !currentAvatarUrl.startsWith('data:') ? currentAvatarUrl : '');
      setUrlError(null);
      setSavedSuccess(false);
      setIsSaving(false);
    }
  }, [isOpen, currentAvatarUrl]);

  if (!isOpen) return null;

  // Compress & crop uploaded file to a performant square base64 JPEG
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения (JPEG, PNG, WEBP)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('Размер файла превышает 8 МБ. Пожалуйста, выберите изображение меньшего размера.');
      return;
    }

    setIsProcessingFile(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 260; // Optimal for sharp avatar & lightweight base64
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            // Square crop with center alignment
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;

            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxDim, maxDim);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            setSelectedUrl(dataUrl);
            setActiveTab('upload');
          }
        } catch (err) {
          console.error('Failed to crop image', err);
          if (typeof e.target?.result === 'string') {
            setSelectedUrl(e.target.result);
          }
        } finally {
          setIsProcessingFile(false);
        }
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        alert('Не удалось загрузить выбранное изображение');
      };
      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      setIsProcessingFile(false);
      alert('Ошибка при чтении файла');
    };

    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyCustomUrl = () => {
    const trimmed = customUrlInput.trim();
    if (!trimmed) {
      setUrlError('Введите прямую ссылку на изображение');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:')) {
      setUrlError('Ссылка должна начинаться с https:// или http://');
      return;
    }
    setUrlError(null);
    setSelectedUrl(trimmed);
  };

  const handleSave = async () => {
    if (!selectedUrl) return;
    setIsSaving(true);
    try {
      await onSave(selectedUrl);
      setSavedSuccess(true);
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 400);
    } catch (err) {
      setIsSaving(false);
      alert('Ошибка при сохранении аватара');
    }
  };

  const filteredPresets = PRESET_AVATARS.filter(p => {
    if (presetCategory === 'all') return true;
    return p.category === presetCategory;
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {userName} {userRoleTitle ? `• ${userRoleTitle}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Live Preview Comparison */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="relative shrink-0">
                <img
                  src={selectedUrl}
                  alt={userName}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover ring-4 ring-amber-500/30 shadow-lg shadow-amber-500/10"
                />
                <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-slate-950">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider font-bold text-amber-400">
                  Активный предпросмотр
                </div>
                <h4 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                  {userName}
                </h4>
                <p className="text-xs text-slate-400 truncate">
                  {userRoleTitle || 'Сотрудник системы'}
                </p>

                {/* Previews at different scales */}
                <div className="flex items-center space-x-2.5 mt-2.5 pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Масштабы:</span>
                  <img
                    src={selectedUrl}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-700"
                    title="В шапке (24px)"
                  />
                  <img
                    src={selectedUrl}
                    alt=""
                    className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-700"
                    title="В списке (32px)"
                  />
                  <img
                    src={selectedUrl}
                    alt=""
                    className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-700"
                    title="В карточке (40px)"
                  />
                </div>
              </div>
            </div>

            {/* Quick Reset */}
            {currentAvatarUrl && selectedUrl !== currentAvatarUrl && (
              <button
                type="button"
                onClick={() => setSelectedUrl(currentAvatarUrl)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700 transition self-start sm:self-center shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Вернуть прежний</span>
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1 p-1 rounded-2xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                activeTab === 'presets'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Коллекция ({PRESET_AVATARS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                activeTab === 'upload'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Загрузить фото</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                activeTab === 'url'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>Прямая ссылка</span>
            </button>
          </div>

          {/* TAB 1: PRESET GALLERY */}
          {activeTab === 'presets' && (
            <div className="space-y-3.5">
              {/* Category Filter Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setPresetCategory('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    presetCategory === 'all'
                      ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Все стили
                </button>
                <button
                  type="button"
                  onClick={() => setPresetCategory('management')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    presetCategory === 'management'
                      ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Руководство & Управляющие</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPresetCategory('admin')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    presetCategory === 'admin'
                      ? 'bg-slate-800 text-rose-400 border border-rose-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Администраторы & IT</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPresetCategory('staff')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    presetCategory === 'staff'
                      ? 'bg-slate-800 text-sky-400 border border-sky-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Шефы & Бариста</span>
                </button>
              </div>

              {/* Grid of Avatars */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {filteredPresets.map((preset) => {
                  const isSelected = selectedUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedUrl(preset.url)}
                      className={`relative group rounded-2xl p-1 transition-all text-left flex flex-col items-center ${
                        isSelected
                          ? 'bg-amber-500/20 ring-2 ring-amber-500 scale-105 shadow-md shadow-amber-500/20'
                          : 'hover:bg-slate-800/80 hover:scale-102 ring-1 ring-slate-800'
                      }`}
                    >
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden">
                        <img
                          src={preset.url}
                          alt={preset.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                            <span className="p-1 rounded-full bg-amber-500 text-slate-950 shadow-md">
                              <Check className="w-3.5 h-3.5 font-bold" />
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-300 group-hover:text-white font-semibold truncate w-full text-center mt-1.5 px-0.5">
                        {preset.title.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD FROM DEVICE */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processImageFile(e.target.files[0]);
                  }
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 sm:p-10 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                  isDragging
                    ? 'border-amber-500 bg-amber-500/10 scale-101'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                  {isProcessingFile ? (
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8" />
                  )}
                </div>

                <h4 className="text-sm sm:text-base font-bold text-white">
                  {isProcessingFile ? 'Обработка изображения...' : 'Нажмите для выбора или перетащите фото сюда'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Поддерживаются форматы JPG, PNG, WEBP. Фото автоматически масштабируется и оптимизируется для профиля.
                </p>

                <div className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center space-x-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Выбрать файл с устройства</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM URL */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Прямая ссылка на фото (URL)
                </label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={customUrlInput}
                      onChange={(e) => {
                        setCustomUrlInput(e.target.value);
                        setUrlError(null);
                      }}
                      placeholder="https://images.unsplash.com/... или https://..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-500"
                    />
                    {customUrlInput && (
                      <button
                        type="button"
                        onClick={() => setCustomUrlInput('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomUrl}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold border border-slate-700 transition shrink-0"
                  >
                    Применить
                  </button>
                </div>
                {urlError && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{urlError}</span>
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Вы можете указать ссылку на корпоративный аватар, фото из Telegram, Gravatar или публичного фотостока.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition"
          >
            Отмена
          </button>

          <button
            type="button"
            disabled={isSaving || !selectedUrl}
            onClick={handleSave}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-2 ${
              savedSuccess
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Сохранено!</span>
              </>
            ) : isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Сохранение...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Сохранить аватар</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
