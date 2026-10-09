import React, { useState, useRef, useEffect } from 'react';
import { ChecklistTemplate, ChecklistBlock, BlockType, PointLocation, ManagerUser } from '../../types';
import { SlashCommandMenu, COMMANDS } from './SlashCommandMenu';
import { JsonSchemaModal } from './JsonSchemaModal';
import { TemplateLibraryModal } from './TemplateLibraryModal';
import { 
  Plus, 
  Trash2, 
  Copy, 
  ChevronUp, 
  ChevronDown, 
  CheckSquare, 
  Camera, 
  Type, 
  Hash, 
  ListFilter, 
  Heading, 
  Minus,
  Settings2,
  FileJson,
  Sparkles,
  Smartphone,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  ExternalLink,
  Layers,
  Lock,
  Key
} from 'lucide-react';

interface FormBuilderProps {
  currentTemplate: ChecklistTemplate;
  onSaveTemplate: (template: ChecklistTemplate) => Promise<{ success: boolean; error?: string }>;
  points: PointLocation[];
  onOpenRunner: (templateId: string) => void;
  currentUser?: ManagerUser | null;
  onOpenLoginModal?: () => void;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  currentTemplate,
  onSaveTemplate,
  points,
  onOpenRunner,
  currentUser,
  onOpenLoginModal,
}) => {
  const [template, setTemplate] = useState<ChecklistTemplate>(currentTemplate);
  const [activeSlashBlockIndex, setActiveSlashBlockIndex] = useState<number | null>(null);
  const [slashFilter, setSlashFilter] = useState('');
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showMobileSplit, setShowMobileSplit] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Sync if prop changes
  useEffect(() => {
    setTemplate(currentTemplate);
  }, [currentTemplate]);

  const handleUpdateTemplateField = <K extends keyof ChecklistTemplate>(
    field: K,
    value: ChecklistTemplate[K]
  ) => {
    setTemplate(prev => ({ ...prev, [field]: value }));
  };

  const handleAddBlock = (type: BlockType, atIndex?: number) => {
    const newBlock: ChecklistBlock = {
      id: 'blk-' + Math.random().toString(36).substring(2, 9),
      type,
      title: type === 'heading' 
        ? 'Новый раздел чек-листа' 
        : type === 'divider' 
        ? '---' 
        : 'Новый пункт проверки',
      description: '',
      required: type !== 'heading' && type !== 'divider',
      photoRequired: type === 'photo',
      cameraOnly: type === 'photo',
      unit: type === 'number' ? '°C' : undefined,
      minNumber: type === 'number' ? 2.0 : undefined,
      maxNumber: type === 'number' ? 5.0 : undefined,
      options: type === 'select' ? [
        { id: 'opt-1', label: 'Вариант 1' },
        { id: 'opt-2', label: 'Вариант 2' },
      ] : undefined,
    };

    setTemplate(prev => {
      const blocks = [...prev.blocks];
      if (typeof atIndex === 'number') {
        blocks.splice(atIndex + 1, 0, newBlock);
      } else {
        blocks.push(newBlock);
      }
      return { ...prev, blocks };
    });

    setSelectedBlockId(newBlock.id);
    setActiveSlashBlockIndex(null);
  };

  const handleUpdateBlock = (index: number, updates: Partial<ChecklistBlock>) => {
    setTemplate(prev => {
      const blocks = [...prev.blocks];
      blocks[index] = { ...blocks[index], ...updates };
      return { ...prev, blocks };
    });
  };

  const handleDeleteBlock = (index: number) => {
    setTemplate(prev => {
      const blocks = prev.blocks.filter((_, idx) => idx !== index);
      return { ...prev, blocks };
    });
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    setTemplate(prev => {
      const blocks = [...prev.blocks];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= blocks.length) return prev;
      
      const temp = blocks[index];
      blocks[index] = blocks[targetIndex];
      blocks[targetIndex] = temp;
      return { ...prev, blocks };
    });
  };

  const handleDuplicateBlock = (index: number) => {
    setTemplate(prev => {
      const blocks = [...prev.blocks];
      const blockToClone = blocks[index];
      const cloned: ChecklistBlock = {
        ...JSON.parse(JSON.stringify(blockToClone)),
        id: 'blk-' + Math.random().toString(36).substring(2, 9),
        title: `${blockToClone.title} (Копия)`,
      };
      blocks.splice(index + 1, 0, cloned);
      return { ...prev, blocks };
    });
  };

  const handleSave = async () => {
    if (!currentUser) {
      if (onOpenLoginModal) {
        onOpenLoginModal();
      }
      return;
    }
    const result = await onSaveTemplate(template);
    if (result?.success) {
      setSaveError(null);
      setSaveSuccessMessage(`Шаблон "${template.title}" сохранён в YDB`);
    } else {
      setSaveSuccessMessage(null);
      setSaveError(
        `Шаблон сохранён локально, но не ушёл в YDB: ${result?.error || 'неизвестная ошибка'}. `
        + `Повторите сохранение, когда сеть восстановится.`
      );
    }
    setTimeout(() => {
      setSaveSuccessMessage(null);
      setSaveError(null);
    }, 5000);
  };

  const getBlockIcon = (type: BlockType) => {
    switch (type) {
      case 'check': return <CheckSquare className="w-4 h-4 text-emerald-500" />;
      case 'photo': return <Camera className="w-4 h-4 text-amber-500" />;
      case 'number': return <Hash className="w-4 h-4 text-sky-500" />;
      case 'select': return <ListFilter className="w-4 h-4 text-purple-500" />;
      case 'text': return <Type className="w-4 h-4 text-slate-500" />;
      case 'heading': return <Heading className="w-4 h-4 text-indigo-500" />;
      case 'divider': return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold">
              {template.code} • v{template.version}
            </span>
            <span className="text-sm text-slate-400">
              {template.blocks.length} элементов контроля
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
            Конструктор чек-листов (Notion-like / Tally)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Создание динамических форм контроля за 3 минуты. Вводите <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-amber-600 dark:text-amber-400">/</code> для вызова slash-команд.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Шаблоны HoReCa</span>
          </button>

          <button
            type="button"
            onClick={() => setShowJsonModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
          >
            <FileJson className="w-3.5 h-3.5 text-sky-500" />
            <span>JSON Схема</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileSplit(!showMobileSplit)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
              showMobileSplit
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{showMobileSplit ? 'Скрыть превью' : 'Мобильное превью'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm ${
              currentUser
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40'
            }`}
          >
            {currentUser ? <Save className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>{currentUser ? 'Сохранить шаблон' : 'Войти для сохранения'}</span>
          </button>
        </div>
      </div>

      {/* Read-only / Logged out access prompt banner */}
      {!currentUser && (
        <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-900 dark:text-white text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold">Режим просмотра (Вы вышли из профиля)</div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Внесение изменений в чек-листы и сохранение заблокировано. Войдите в профиль руководства, чтобы получить доступ к редактированию.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm self-start sm:self-auto"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Войти для внесения изменений</span>
          </button>
        </div>
      )}

      {/* Alert toast */}
      {saveSuccessMessage && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">{saveSuccessMessage}</span>
          </div>
          <button 
            onClick={() => onOpenRunner(template.id)}
            className="flex items-center space-x-1 text-xs font-bold underline hover:opacity-80 ml-4"
          >
            <span>Открыть в PWA заполнителя</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {saveError && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-semibold">{saveError}</span>
          </div>
          <button 
            onClick={() => setSaveError(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-4 shrink-0"
          >
            Закрыть
          </button>
        </div>
      )}

      {/* Main Grid: Editor + Split Preview */}
      <div className={`mt-6 grid gap-8 ${showMobileSplit ? 'lg:grid-cols-12' : 'grid-cols-1'}`}>
        {/* Editor Column */}
        <div className={showMobileSplit ? 'lg:col-span-7' : 'w-full max-w-4xl mx-auto'}>
          {/* Form Header Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={template.code}
                  onChange={(e) => handleUpdateTemplateField('code', e.target.value)}
                  className="w-24 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                  placeholder="ЧК-00001"
                />
                <select
                  value={template.category}
                  onChange={(e) => handleUpdateTemplateField('category', e.target.value as any)}
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200"
                >
                  <option value="opening">Открытие смены</option>
                  <option value="closing">Закрытие смены</option>
                  <option value="haccp">ХАССП / СанПиН</option>
                  <option value="equipment">Оборудование</option>
                  <option value="writeoff">Списания / Бракераж</option>
                  <option value="custom">Свободный регламент</option>
                </select>
              </div>

              <div className="flex items-center space-x-3 text-xs text-slate-500">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>План:</span>
                  <input
                    type="time"
                    value={template.targetTime || '08:00'}
                    onChange={(e) => handleUpdateTemplateField('targetTime', e.target.value)}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-semibold"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <span>Допуск: ±</span>
                  <input
                    type="number"
                    value={template.allowedVarianceMinutes || 15}
                    onChange={(e) => handleUpdateTemplateField('allowedVarianceMinutes', parseInt(e.target.value, 10))}
                    className="w-12 px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-center"
                  />
                  <span>мин</span>
                </div>
              </div>
            </div>

            {/* Template Title Input */}
            <input
              type="text"
              value={template.title}
              onChange={(e) => handleUpdateTemplateField('title', e.target.value)}
              placeholder="Название чек-листа (например: Открытие кофейни)..."
              className="w-full text-2xl font-black text-slate-900 dark:text-white bg-transparent border-0 border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-amber-500 focus:ring-0 px-0 py-1 transition"
            />

            {/* Template Description Input */}
            <textarea
              value={template.description}
              onChange={(e) => handleUpdateTemplateField('description', e.target.value)}
              placeholder="Описание назначения, инструкция для бариста..."
              rows={2}
              className="w-full text-xs text-slate-600 dark:text-slate-400 bg-transparent border-0 border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-amber-500 focus:ring-0 px-0 py-1 resize-none transition"
            />
          </div>

          {/* Blocks List (Notion-like canvas) */}
          <div className="mt-4 space-y-3">
            {template.blocks.map((block, index) => {
              const isSelected = selectedBlockId === block.id;
              const isHeading = block.type === 'heading';
              const isDivider = block.type === 'divider';

              return (
                <div
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`group relative rounded-xl border transition-all ${
                    isHeading
                      ? 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-750 p-3.5'
                      : isDivider
                      ? 'py-2 px-3 border-transparent'
                      : isSelected
                      ? 'bg-white dark:bg-slate-900 border-amber-500 ring-2 ring-amber-500/20 shadow-md p-4'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 p-4 shadow-2xs'
                  }`}
                >
                  {/* Left Action Handle */}
                  <div className="absolute left-2 top-3 -translate-x-full pr-2 hidden md:flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveBlock(index, 'up');
                      }}
                      disabled={index === 0}
                      className="p-1 rounded bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 shadow-xs border border-slate-200 dark:border-slate-700"
                      title="Переместить вверх"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveBlock(index, 'down');
                      }}
                      disabled={index === template.blocks.length - 1}
                      className="p-1 rounded bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 shadow-xs border border-slate-200 dark:border-slate-700"
                      title="Переместить вниз"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Block Content */}
                  {isDivider ? (
                    <div className="py-2 flex items-center justify-between">
                      <div className="w-full h-px bg-slate-300 dark:bg-slate-700" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBlock(index);
                        }}
                        className="ml-2 text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : isHeading ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-2 flex-1">
                        <Heading className="w-4 h-4 text-indigo-500 shrink-0" />
                        <input
                          type="text"
                          value={block.title}
                          onChange={(e) => handleUpdateBlock(index, { title: e.target.value })}
                          className="w-full font-bold text-slate-900 dark:text-white bg-transparent border-0 focus:ring-0 p-0 text-sm"
                          placeholder="Название секции..."
                        />
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateBlock(index)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Дублировать"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(index)}
                          className="p-1 text-slate-400 hover:text-rose-500"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Block Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                            {getBlockIcon(block.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="relative">
                              <input
                                type="text"
                                value={block.title}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleUpdateBlock(index, { title: val });
                                  if (val.endsWith('/')) {
                                    setActiveSlashBlockIndex(index);
                                    setSlashFilter('');
                                  } else if (activeSlashBlockIndex === index) {
                                    const slashPart = val.split('/').pop() || '';
                                    setSlashFilter(slashPart);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setActiveSlashBlockIndex(null);
                                }}
                                placeholder="Текст пункта... (введите / для команды)"
                                className="w-full font-semibold text-slate-900 dark:text-white bg-transparent border-0 focus:ring-0 p-0 text-sm placeholder:text-slate-400"
                              />

                              {/* Slash Command popup */}
                              {activeSlashBlockIndex === index && (
                                <SlashCommandMenu
                                  filterText={slashFilter}
                                  onSelect={(type) => {
                                    handleUpdateBlock(index, { 
                                      type,
                                      title: block.title.replace(/\/[a-zA-Z0-9]*$/, '').trim() || `Пункт ${type}`
                                    });
                                    setActiveSlashBlockIndex(null);
                                  }}
                                  onClose={() => setActiveSlashBlockIndex(null)}
                                />
                              )}
                            </div>

                            <input
                              type="text"
                              value={block.description || ''}
                              onChange={(e) => handleUpdateBlock(index, { description: e.target.value })}
                              placeholder="Подсказка для бариста (необязательно)..."
                              className="w-full text-xs text-slate-500 dark:text-slate-400 bg-transparent border-0 focus:ring-0 p-0 mt-1 placeholder:text-slate-400/60"
                            />
                          </div>
                        </div>

                        {/* Top right quick actions */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDuplicateBlock(index)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Дублировать пункт"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(index)}
                            className="p-1 text-slate-400 hover:text-rose-500"
                            title="Удалить пункт"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Block Specific Controls */}
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                        {/* Constraints flags */}
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-600 dark:text-slate-400">
                            <input
                              type="checkbox"
                              checked={block.required}
                              onChange={(e) => handleUpdateBlock(index, { required: e.target.checked })}
                              className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500"
                            />
                            <span className="font-medium">Обязательный</span>
                          </label>

                          {block.type !== 'photo' && (
                            <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-600 dark:text-slate-400">
                              <input
                                type="checkbox"
                                checked={!!block.photoRequired}
                                onChange={(e) => handleUpdateBlock(index, { photoRequired: e.target.checked })}
                                className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500"
                              />
                              <span className="flex items-center space-x-1">
                                <Camera className="w-3 h-3 text-amber-500" />
                                <span>Требовать фото</span>
                              </span>
                            </label>
                          )}

                          {block.type === 'photo' && (
                            <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-600 dark:text-slate-400">
                              <input
                                type="checkbox"
                                checked={!!block.cameraOnly}
                                onChange={(e) => handleUpdateBlock(index, { cameraOnly: e.target.checked })}
                                className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500"
                              />
                              <span>Только живая камера (без галереи)</span>
                            </label>
                          )}
                        </div>

                        {/* Number limits config */}
                        {block.type === 'number' && (
                          <div className="flex items-center space-x-2 font-mono text-[11px] bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400">Мин:</span>
                            <input
                              type="number"
                              value={block.minNumber ?? ''}
                              onChange={(e) => handleUpdateBlock(index, { minNumber: parseFloat(e.target.value) || undefined })}
                              className="w-12 bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-center"
                              placeholder="min"
                            />
                            <span className="text-slate-400">Макс:</span>
                            <input
                              type="number"
                              value={block.maxNumber ?? ''}
                              onChange={(e) => handleUpdateBlock(index, { maxNumber: parseFloat(e.target.value) || undefined })}
                              className="w-12 bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-center"
                              placeholder="max"
                            />
                            <span className="text-slate-400">Ед:</span>
                            <input
                              type="text"
                              value={block.unit || ''}
                              onChange={(e) => handleUpdateBlock(index, { unit: e.target.value })}
                              className="w-10 bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-center font-bold"
                              placeholder="°C"
                            />
                          </div>
                        )}

                        {/* Select options builder */}
                        {block.type === 'select' && block.options && (
                          <div className="w-full mt-2 space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="text-[11px] font-bold text-slate-500 uppercase">Варианты ответа:</div>
                            {block.options.map((opt, optIdx) => (
                              <div key={opt.id} className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => {
                                    const opts = [...(block.options || [])];
                                    opts[optIdx].label = e.target.value;
                                    handleUpdateBlock(index, { options: opts });
                                  }}
                                  className="flex-1 bg-white dark:bg-slate-900 px-2 py-1 rounded text-xs border border-slate-300 dark:border-slate-700"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const opts = block.options?.filter((_, i) => i !== optIdx);
                                    handleUpdateBlock(index, { options: opts });
                                  }}
                                  className="text-slate-400 hover:text-rose-500 p-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const opts = [...(block.options || [])];
                                opts.push({ id: 'opt-' + Math.random().toString(36).substring(2, 5), label: `Вариант ${opts.length + 1}` });
                                handleUpdateBlock(index, { options: opts });
                              }}
                              className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline"
                            >
                              + Добавить вариант
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Add Block Bar */}
          <div className="mt-4 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить элемент:</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.type}
                    type="button"
                    onClick={() => handleAddBlock(cmd.type)}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition"
                  >
                    <Icon className="w-3 h-3" />
                    <span>{cmd.command}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Split Mobile Preview Column */}
        {showMobileSplit && (
          <div className="lg:col-span-5 sticky top-24 self-start">
            <div className="bg-slate-950 p-4 rounded-3xl border-4 border-slate-800 shadow-2xl max-w-sm mx-auto">
              <div className="flex justify-between items-center px-2 py-1 text-[11px] text-slate-400 border-b border-slate-800 mb-3">
                <span className="font-mono">08:00</span>
                <span className="font-bold text-amber-400">PWA Предпросмотр</span>
                <span>100% 🔋</span>
              </div>

              {/* Mobile Content Simulation */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 max-h-[600px] overflow-y-auto space-y-4 text-xs">
                <div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold text-[10px]">
                    {template.code} • {template.category}
                  </span>
                  <h3 className="font-black text-slate-900 dark:text-white text-base mt-1">
                    {template.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {template.description}
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {template.blocks.map((blk) => (
                    <div 
                      key={blk.id} 
                      className={`p-2.5 rounded-lg border ${
                        blk.type === 'heading' 
                          ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' 
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                      }`}
                    >
                      {blk.type === 'heading' ? (
                        <span>{blk.title}</span>
                      ) : blk.type === 'divider' ? (
                        <hr className="border-slate-300 dark:border-slate-700" />
                      ) : (
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {blk.title}
                            </span>
                            {blk.required && (
                              <span className="text-rose-500 font-bold">*</span>
                            )}
                          </div>
                          {blk.description && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{blk.description}</p>
                          )}

                          {/* Control representation */}
                          <div className="mt-2">
                            {blk.type === 'check' && (
                              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                                <div className="w-4 h-4 rounded border border-slate-400" />
                                <span>Выполнено</span>
                              </div>
                            )}

                            {blk.type === 'photo' && (
                              <div className="border border-dashed border-amber-500/40 rounded-lg p-2 flex items-center justify-center space-x-1.5 text-amber-600 bg-amber-500/5">
                                <Camera className="w-3.5 h-3.5" />
                                <span className="font-bold">Сделать фото</span>
                              </div>
                            )}

                            {blk.type === 'number' && (
                              <div className="flex items-center space-x-2">
                                <input 
                                  type="number" 
                                  disabled 
                                  placeholder={`Норма: ${blk.minNumber ?? '-'} ... ${blk.maxNumber ?? '-'}`}
                                  className="w-full bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs" 
                                />
                                <span className="font-bold text-slate-400">{blk.unit}</span>
                              </div>
                            )}

                            {blk.type === 'select' && (
                              <select disabled className="w-full bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs">
                                {blk.options?.map(o => (
                                  <option key={o.id}>{o.label}</option>
                                ))}
                              </select>
                            )}

                            {blk.type === 'text' && (
                              <textarea disabled placeholder="Комментарий бариста..." rows={1} className="w-full bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs resize-none" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-3">
                  <button disabled className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs opacity-90 shadow">
                    Синхронизировать с YDB
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <JsonSchemaModal
        template={template}
        isOpen={showJsonModal}
        onClose={() => setShowJsonModal(false)}
      />

      <TemplateLibraryModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onSelectTemplate={(tpl) => {
          setTemplate(tpl);
        }}
      />
    </div>
  );
};
