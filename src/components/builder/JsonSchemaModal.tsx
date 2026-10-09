import React, { useState } from 'react';
import { ChecklistTemplate } from '../../types';
import { X, Copy, Check, Download, FileJson, ArrowRight } from 'lucide-react';

interface JsonSchemaModalProps {
  template: ChecklistTemplate;
  isOpen: boolean;
  onClose: () => void;
}

export const JsonSchemaModal: React.FC<JsonSchemaModalProps> = ({
  template,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Universal HoReCa Form JSON Schema
  const schemaPayload = {
    metadata: {
      generator: 'HoReCa Quality Schema Engine',
      formatVersion: '2.0',
      database: 'Managed Service for YDB',
      mediaStorage: 'MinIO S3',
      exportedAt: new Date().toISOString(),
    },
    template: {
      id: template.id,
      code: template.code,
      title: template.title,
      category: template.category,
      version: template.version,
      targetTime: template.targetTime || '08:00',
      allowedVarianceMinutes: template.allowedVarianceMinutes || 15,
      active: template.active,
      assignedPoints: template.assignedPoints,
      elementsCount: template.blocks.length,
      blocks: template.blocks.map((b, idx) => ({
        index: idx + 1,
        id: b.id,
        type: b.type,
        title: b.title,
        description: b.description || '',
        required: b.required,
        validation: {
          photoRequired: !!b.photoRequired,
          minNumber: b.minNumber ?? null,
          maxNumber: b.maxNumber ?? null,
          unit: b.unit || '',
          cameraOnly: !!b.cameraOnly,
          options: b.options || [],
        },
        ydbDataType: b.type === 'check' 
          ? 'Bool' 
          : b.type === 'number' 
          ? 'Double' 
          : b.type === 'photo' 
          ? 'Utf8 (S3 URL)' 
          : 'Utf8'
      }))
    }
  };

  const jsonString = JSON.stringify(schemaPayload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_${template.code || 'template'}_v${template.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">JSON-схема шаблона проверки (YDB / REST)</h3>
              <p className="text-xs text-slate-400">
                Шаблон: {template.title} • Версия: {template.version} • Код: {template.code}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto font-mono text-xs text-emerald-400 bg-slate-950/90 selection:bg-amber-500 selection:text-slate-950">
          <pre className="whitespace-pre-wrap">{jsonString}</pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="text-xs text-slate-400 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Валидная спецификация для YDB Serverless и мобильного PWA</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Скопировано!' : 'Скопировать JSON'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Скачать .json</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
