import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, Sparkles, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  title: string;
  pointName: string;
  staffName: string;
  cameraOnly?: boolean;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title,
  pointName,
  staffName,
  cameraOnly = true,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [useFallbackSim, setUseFallbackSim] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start real camera or handle fallback
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, cameraFacing]);

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setUseFallbackSim(false);
      } else {
        setUseFallbackSim(true);
      }
    } catch (err) {
      console.warn('Camera access not granted or unavailable, switching to mock capture mode:', err);
      setUseFallbackSim(true);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const stampWatermark = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU') + ' ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const watermarkText = `📷 HoReCa Quality • ${dateStr} • ${pointName} • ${staffName}`;

    // Background banner at bottom
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, height - 42, width, 42);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(watermarkText, 14, height - 16);

    // Live GPS badge indicator
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(width - 24, height - 21, 5, 0, 2 * Math.PI);
    ctx.fill();
  };

  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current && !useFallbackSim) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        stampWatermark(ctx, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
      }
    } else {
      // Fallback HoReCa simulation photo generator
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw realistic gradient backdrop
        const grad = ctx.createLinearGradient(0, 0, 640, 480);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 480);

        // Draw coffee machine / item representation
        ctx.fillStyle = '#334155';
        ctx.fillRect(100, 100, 440, 280);
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☕ ФОТООТЧЕТ КОНТРОЛЯ КАЧЕСТВА', 320, 220);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(`Пункт: ${title}`, 320, 260);
        ctx.fillText(`Точка: ${pointName}`, 320, 290);

        ctx.textAlign = 'left';
        stampWatermark(ctx, 640, 480);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            stampWatermark(ctx, canvas.width, canvas.height);
            setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs truncate max-w-xs">{title}</h4>
              <p className="text-[10px] text-slate-400 font-mono">
                {pointName} • {staffName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Canvas / Video */}
        <div className="relative aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          {capturedImage ? (
            <img 
              src={capturedImage} 
              alt="Снимок" 
              className="w-full h-full object-cover"
            />
          ) : useFallbackSim ? (
            <div className="p-6 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-amber-400 animate-pulse">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Эмулятор камеры смартфона</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Автоматическое наложение водяного знака, времени, точки и имени бариста для защиты от подделки отчетов.
                </p>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {/* Hidden Canvas for capture processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Live Overlay Guides */}
          {!capturedImage && (
            <div className="absolute inset-4 border border-white/20 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
              <div className="flex justify-between items-center text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs self-start">
                <span>🔴 REC • Фотоконтроль качества</span>
              </div>
              <div className="text-center text-[11px] text-white/90 bg-black/50 px-3 py-1 rounded-full backdrop-blur-xs self-center">
                Поместите объект в рамку и нажмите съемку
              </div>
            </div>
          )}
        </div>

        {/* Controls footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={() => setCapturedImage(null)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Переснять</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Прикрепить к отчету</span>
              </button>
            </>
          ) : (
            <>
              {/* Optional gallery upload if not camera-only */}
              <div>
                {!cameraOnly && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                      title="Загрузить из галереи"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={handleTakePhoto}
                className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 border-4 border-slate-900 shadow-xl flex items-center justify-center text-slate-950 transition active:scale-95 group"
              >
                <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>

              {/* Switch camera facing */}
              <button
                type="button"
                onClick={() => setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment')}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Переключить камеру"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
