import React from 'react';
import { 
  CheckSquare, 
  Camera, 
  Type, 
  Hash, 
  ListFilter, 
  Heading, 
  Minus,
  Sparkles
} from 'lucide-react';
import { BlockType } from '../../types';

export interface CommandItem {
  type: BlockType;
  title: string;
  command: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}

export const COMMANDS: CommandItem[] = [
  {
    type: 'check',
    title: 'Чек-бокс (Да/Нет, Выполнено)',
    command: '/check',
    description: 'Одиночная отметка выполнения регламента или стандарта',
    icon: CheckSquare,
  },
  {
    type: 'photo',
    title: 'Фотоотчет (Камера смартфона)',
    command: '/photo',
    description: 'Обязательное фото зоны, оборудования или маркировки',
    icon: Camera,
    badge: 'S3 Media',
  },
  {
    type: 'number',
    title: 'Числовой замер (Температура/Вес/Время)',
    command: '/number',
    description: 'Ввод числа с контролем мин/макс (ХАССП, помол, касса)',
    icon: Hash,
    badge: 'Валидация',
  },
  {
    type: 'select',
    title: 'Выбор из списка (Сорт зерна/Статус)',
    command: '/select',
    description: 'Выпадающий список предопределенных вариантов',
    icon: ListFilter,
  },
  {
    type: 'text',
    title: 'Текстовый комментарий',
    command: '/text',
    description: 'Поле для описания проблемы или замечаний бариста',
    icon: Type,
  },
  {
    type: 'heading',
    title: 'Заголовок секции',
    command: '/heading',
    description: 'Разделительный заголовок для группировки этапов',
    icon: Heading,
  },
  {
    type: 'divider',
    title: 'Разделительная линия',
    command: '/divider',
    description: 'Визуальный разделитель блоков',
    icon: Minus,
  },
];

interface SlashCommandMenuProps {
  filterText: string;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  filterText,
  onSelect,
  onClose,
}) => {
  const cleanFilter = filterText.replace('/', '').toLowerCase().trim();
  
  const filtered = COMMANDS.filter(cmd => 
    cmd.command.toLowerCase().includes(cleanFilter) ||
    cmd.title.toLowerCase().includes(cleanFilter) ||
    cmd.description.toLowerCase().includes(cleanFilter)
  );

  return (
    <div className="absolute z-50 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
        <span className="flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Блоки Notion-Like</span>
        </span>
        <span>Esc для закрытия</span>
      </div>

      <div className="max-h-72 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            Команда «/{cleanFilter}» не найдена
          </div>
        ) : (
          filtered.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.type}
                type="button"
                onClick={() => onSelect(cmd.type)}
                className="w-full px-3 py-2 text-left flex items-start space-x-3 hover:bg-amber-500/10 dark:hover:bg-slate-800 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-700 dark:text-slate-300 transition-colors mt-0.5 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      {cmd.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {cmd.command}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {cmd.description}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
