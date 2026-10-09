import React, { useState, useEffect, useMemo } from 'react';
import { ChecklistTemplate, PointLocation, ManagerUser } from '../../types';
import QRCode from 'qrcode';
import { 
  QrCode, 
  Printer, 
  Copy, 
  Check, 
  ExternalLink, 
  Smartphone, 
  MapPin, 
  Coffee,
  Building2
} from 'lucide-react';
import { isDemoSession, DEMO_ORG_ID, getStoredAuthState } from '../../services/managerAuth';
import { getActiveOrganization, cleanInnString } from '../../services/companyService';

interface QrPublisherProps {
  templates: ChecklistTemplate[];
  points: PointLocation[];
  onOpenRunner: (templateId: string, pointId?: string) => void;
  currentUser?: ManagerUser | null;
}

export const QrPublisher: React.FC<QrPublisherProps> = ({
  templates,
  points,
  onOpenRunner,
  currentUser,
}) => {
  const isDemo = isDemoSession();
  const effectiveUser = currentUser || getStoredAuthState();
  const activeOrg = getActiveOrganization();

  // Многоуровневая изоляция торговых точек по организации пользователя (ТЗ 4.1):
  // 1. app_admin видит все точки всех организаций.
  // 2. В демо-сессии — строго демо-точки демо-организации (org-smirnov / ИНН 772481928412).
  // 3. Реальный пользователь — строго точки его организации (по organizationId или по organizationInn).
  const displayPoints = useMemo(() => {
    if (effectiveUser?.role === 'app_admin') {
      return points;
    }
    const userOrgId = isDemo ? DEMO_ORG_ID : (effectiveUser?.organizationId || activeOrg?.id);
    const userOrgInn = isDemo 
      ? '772481928412' 
      : (effectiveUser?.organizationInn ? cleanInnString(effectiveUser.organizationInn) : (activeOrg?.inn ? cleanInnString(activeOrg.inn) : ''));

    return points.filter(p => {
      if (isDemo) {
        return p.organizationId === DEMO_ORG_ID || (p.organizationInn && cleanInnString(p.organizationInn) === '772481928412');
      }
      const matchId = userOrgId && p.organizationId && p.organizationId === userOrgId;
      const matchInn = userOrgInn && p.organizationInn && cleanInnString(p.organizationInn) === userOrgInn;
      return Boolean(matchId || matchInn);
    });
  }, [points, effectiveUser?.role, effectiveUser?.organizationId, effectiveUser?.organizationInn, activeOrg?.id, activeOrg?.inn, isDemo]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'tpl-opening');
  const [selectedPointId, setSelectedPointId] = useState<string>(() => displayPoints[0]?.id || 'pt-1');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync state if templates or points load asynchronously
  useEffect(() => {
    if (templates.length > 0 && (!selectedTemplateId || !templates.some(t => t.id === selectedTemplateId))) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    if (displayPoints.length > 0 && (!selectedPointId || !displayPoints.some(p => p.id === selectedPointId))) {
      setSelectedPointId(displayPoints[0].id);
    }
  }, [displayPoints, selectedPointId]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];
  const selectedPoint = displayPoints.find(p => p.id === selectedPointId) || displayPoints[0];

  const tplId = selectedTemplate?.id || selectedTemplateId || 'tpl-opening';
  const ptId = selectedPoint?.id || selectedPointId || (displayPoints[0]?.id || 'pt-1');

  // Base URL for runner link with full origin and pathname support
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://checklist-1c.horeca.local';
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const cleanPath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
  const runnerLink = `${currentOrigin}${cleanPath}?mode=runner&templateId=${encodeURIComponent(tplId)}&pointId=${encodeURIComponent(ptId)}`;

  useEffect(() => {
    if (runnerLink) {
      QRCode.toDataURL(runnerLink, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QR code generation error:', err));
    }
  }, [selectedTemplateId, selectedPointId, runnerLink]);

  const handleCopy = () => {
    navigator.clipboard.writeText(runnerLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <QrCode className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Публикация и генератор QR-кодов для барной стойки
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Распечатайте брендированный тейбл-тент (A5) или наклейку для рабочей зоны бариста. При сканировании терминал запрашивает PIN-код сотрудника.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-sm font-semibold transition cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Ссылка скопирована!' : 'Копировать ссылку'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Печать тейбл-тента (A5)</span>
          </button>
        </div>
      </div>

      {/* Selectors Group */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm shadow-xs">
        <div>
          <label className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs block mb-1.5">
            1. Выберите шаблон чек-листа:
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-900 dark:text-white text-sm"
          >
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.title} ({t.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs block mb-1.5">
            2. Выберите торговую точку (кофейню):
          </label>
          <select
            value={selectedPointId}
            onChange={(e) => setSelectedPointId(e.target.value)}
            disabled={displayPoints.length === 0}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-900 dark:text-white text-sm"
          >
            {displayPoints.length === 0 ? (
              <option value="">Нет зарегистрированных торговых точек</option>
            ) : (
              displayPoints.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code}) — {p.city}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Printable Branded Card */}
      <div className="flex justify-center">
        <div 
          id="printable-tent-card"
          className="w-full max-w-md bg-white border-2 border-slate-900 rounded-3xl p-8 text-center shadow-2xl space-y-6 text-slate-900 relative print:border-0 print:shadow-none"
        >
          {/* Coffee Shop Badge & Org details (ТЗ 5.1.7) */}
          <div className="flex flex-col items-center justify-center space-y-1 text-slate-900">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black">
                1C
              </div>
              <span className="font-black text-sm uppercase tracking-wider">
                {selectedPoint ? selectedPoint.name : 'Торговая точка не выбрана'}
              </span>
            </div>
            {selectedPoint && (
              <div className="text-[11px] text-slate-500 font-medium max-w-xs truncate">
                {selectedPoint.organizationName || (activeOrg ? `${activeOrg.legalType === 'IP' ? 'ИП ' : 'ООО '}${activeOrg.brandName}` : '')}
                {selectedPoint.address ? ` • ${selectedPoint.address}` : ''}
              </div>
            )}
          </div>

          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 font-mono">
              РЕГЛАМЕНТ РАБОТЫ БАРИСТА
            </span>
            <h2 className="text-xl font-black text-slate-950 mt-2 leading-tight">
              {selectedTemplate?.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {selectedTemplate?.description}
            </p>
          </div>

          {/* QR Code Frame */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
            {qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="QR Code" 
                className="w-52 h-52 mx-auto rounded-xl"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-slate-400 font-mono">
                Генерация QR...
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-slate-700">
            <p className="font-bold flex items-center justify-center space-x-1">
              <Smartphone className="w-4 h-4 text-amber-600" />
              <span>Наведите камеру смартфона для заполнения</span>
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Быстрый PIN точки: <b>{selectedPoint?.pinCode || '1234'}</b> • Время: <b>{selectedTemplate?.targetTime || 'Любое'}</b>
            </p>
          </div>

          {/* Direct runner button */}
          <div className="pt-2 print:hidden">
            <button
              type="button"
              onClick={() => onOpenRunner(tplId, ptId)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <span>Протестировать переход по ссылке</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
