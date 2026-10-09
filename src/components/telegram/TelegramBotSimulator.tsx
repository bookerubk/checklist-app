import React, { useState } from 'react';
import { TelegramAlert, getTelegramAlerts, addTelegramAlert } from '../../services/storage';
import { 
  Send, 
  Bot, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Trash2, 
  ExternalLink, 
  Sparkles,
  Camera,
  MessageSquare
} from 'lucide-react';

interface TelegramBotSimulatorProps {
  onOpenDoc: (docNumber: string) => void;
  onRefreshAlerts: () => void;
}

export const TelegramBotSimulator: React.FC<TelegramBotSimulatorProps> = ({
  onOpenDoc,
  onRefreshAlerts,
}) => {
  const [alerts, setAlerts] = useState<TelegramAlert[]>(getTelegramAlerts());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const handleClear = () => {
    localStorage.setItem('checklist_1c_telegram_alerts_v1', JSON.stringify([]));
    setAlerts([]);
    onRefreshAlerts();
  };

  const handleSendTestAlert = () => {
    addTelegramAlert({
      type: 'violation',
      pointName: 'Кофейня «Центр» (Флагман)',
      staffName: 'Артем Белов',
      title: '⚠️ Нарушение СанПиН: Просрочена заготовка сиропа',
      message: 'Бариста отметил непригодность открытой упаковки ванильного сиропа. Требуется списание!',
      checklistNumber: 'ЗЧ-00046',
    });
    setAlerts(getTelegramAlerts());
    onRefreshAlerts();
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg sm:text-xl font-bold">Telegram-бот Управляющего сети</h1>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                @horeca_1c_audit_bot
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Мгновенные уведомления о срывах графиков, нарушениях температур ХАССП и фотоотчетах
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSendTestAlert}
            className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-bold transition shadow-sm"
          >
            Тест уведомления
          </button>
          {alerts.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
              title="Очистить чат"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Telegram Chat Simulation */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
        {/* Chat Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-slate-950 font-bold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">HoReCa Quality • Оповещения</h3>
            <p className="text-xs text-emerald-400 font-medium">bot • онлайн</p>
          </div>
        </div>

        {/* Chat Messages Feed */}
        <div className="p-4 sm:p-6 max-h-[600px] overflow-y-auto space-y-4 bg-slate-950/90 text-sm">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Сообщений пока нет. Уведомления появятся при отправке чек-листов сотрудниками.</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const isViolation = alert.type === 'violation';
              const isDelay = alert.type === 'delay';
              const isSuccess = alert.type === 'success';

              return (
                <div key={alert.id} className="flex items-start space-x-3 max-w-lg">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-sky-400" />
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4 text-slate-200 shadow space-y-2.5">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <span className="font-bold text-xs text-white flex items-center space-x-1.5">
                        {isViolation ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        ) : isDelay ? (
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        <span>{alert.title}</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(alert.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Message Body */}
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {alert.message}
                    </p>

                    {/* Metadata */}
                    <div className="text-[11px] text-slate-400 font-mono space-y-0.5 pt-1">
                      <div>📍 Точка: <b>{alert.pointName}</b></div>
                      <div>👤 Бариста: <b>{alert.staffName}</b></div>
                      <div>📄 Акт проверки: <b>{alert.checklistNumber}</b></div>
                    </div>

                    {/* Photo preview if present */}
                    {alert.photoUrl && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(alert.photoUrl!)}
                          className="relative rounded-xl overflow-hidden border border-slate-700 block group"
                        >
                          <img src={alert.photoUrl} alt="Фото в отчете" className="w-full h-36 object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs transition">
                            <Camera className="w-4 h-4 mr-1" />
                            <span>Увеличить фото S3</span>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Action button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => onOpenDoc(alert.checklistNumber)}
                        className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-indigo-400 hover:text-indigo-300 font-bold text-[11px] flex items-center justify-center space-x-1 transition"
                      >
                        <span>Открыть протокол проверки</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <div className="relative max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border border-slate-700 shadow-2xl">
            <img src={selectedPhoto} alt="Фото из Telegram" className="w-full h-auto max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
