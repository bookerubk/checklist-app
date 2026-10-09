import React, { useState } from 'react';
import {
  Coffee,
  ClipboardCheck,
  TrendingUp,
  Camera,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Mail,
  Send,
  Sparkles,
} from 'lucide-react';
import { ManagerUser, TariffPlan } from '../../types';
import { getTariffPlans } from '../../services/companyService';

interface LandingPageProps {
  currentUser: ManagerUser | null;
  onLogin: () => void;
  onTryDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  currentUser,
  onLogin,
  onTryDemo,
}) => {
  const [tariffs] = useState<TariffPlan[]>(() => getTariffPlans());
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackEmail.trim() || !feedbackMessage.trim()) return;

    // TODO: отправить через Cloud Function / Email-сервис
    // Пока — стаб: логируем в консоль
    console.log('[LANDING-FEEDBACK]', { email: feedbackEmail, message: feedbackMessage });

    setFeedbackSent(true);
    setTimeout(() => {
      setFeedbackSent(false);
      setFeedbackEmail('');
      setFeedbackMessage('');
    }, 5000);
  };

  return (
    <div id="landing-page" className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* ============ HERO ============ */}
      <section className="bg-neutral-200 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text + CTA */}
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-neutral-300 dark:bg-neutral-800 border border-neutral-400 dark:border-neutral-700">
                <Coffee className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                  Контроль качества сети кофеен
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-neutral-900 dark:text-white">
                Электронные чек-листы
                <br />
                <span className="text-neutral-600 dark:text-neutral-400">для HoReCa</span>
              </h1>

              <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed">
                Система аудита стандартов, чек-листов ХАССП и фотофиксации для линейных сотрудников и руководства сети кофеен.
                Работает офлайн, синхронизируется с 1С.
              </p>

              {/* Two CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  id="landing-try-demo-btn"
                  type="button"
                  onClick={onTryDemo}
                  className="px-6 py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-sm transition shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Попробовать демо</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  id="landing-login-btn"
                  type="button"
                  onClick={onLogin}
                  className="px-6 py-3.5 rounded-2xl bg-white hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-900 dark:text-white font-bold text-sm border border-neutral-300 dark:border-neutral-700 transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{currentUser ? 'Управление профилем' : 'Войти в аккаунт'}</span>
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-4 pt-4 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Без установки</span>
                </span>
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Работает офлайн</span>
                </span>
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Интеграция с 1С</span>
                </span>
              </div>
            </div>

            {/* Right: Product placeholder */}
            <div className="relative">
              <div className="aspect-[4/3] rounded-3xl bg-neutral-300 dark:bg-neutral-800 border border-neutral-400 dark:border-neutral-700 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Smartphone className="w-16 h-16 text-neutral-500 dark:text-neutral-400 mx-auto" />
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm font-bold">Скриншот продукта</p>
                  <p className="text-neutral-400 dark:text-neutral-500 text-xs">(интерфейс мобильного чек-листа)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white">
            Возможности платформы
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2 max-w-2xl mx-auto">
            Полный цикл контроля качества от бариста до директора сети
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<ClipboardCheck className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />}
            title="Электронные чек-листы"
            description="Конструктор без программирования. Чек-листы открытия, закрытия, ХАССП, оборудования."
          />
          <FeatureCard
            icon={<Camera className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />}
            title="Фотофиксация"
            description="Обязательные фото зон, оборудования, выкладки. Автоматическое сжатие в WebP."
          />
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />}
            title="Аналитика"
            description="Тепловые карты, графики нарушений, рейтинг точек и сотрудников."
          />
        </div>
      </section>

      {/* ============ TARIFFS ============ */}
      <section className="bg-white dark:bg-neutral-900 border-y border-neutral-300 dark:border-neutral-800 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white">
              Тарифные планы
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">
              Для ИП с одной кофейней и для крупных сетей
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tariffs.slice(0, 3).map(tariff => (
              <div
                key={tariff.id}
                className={`rounded-3xl p-6 border bg-white dark:bg-neutral-800 transition ${
                  tariff.isPopular
                    ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-900/10 dark:ring-white/10'
                    : 'border-neutral-300 dark:border-neutral-700'
                }`}
              >
                {tariff.badge && (
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 mb-3">
                    {tariff.badge}
                  </span>
                )}
                <h3 className="text-xl font-black text-neutral-900 dark:text-white">
                  {tariff.name}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 min-h-[32px]">
                  {tariff.description}
                </p>
                <div className="my-4 flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-neutral-900 dark:text-white">
                    {(tariff.priceMonthlyRub || 0).toLocaleString('ru-RU')} ₽
                  </span>
                  <span className="text-xs text-neutral-400 font-bold">/мес</span>
                </div>
                <ul className="space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                  {tariff.features.slice(0, 5).map((feature, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEEDBACK ============ */}
      <section className="bg-neutral-100 dark:bg-neutral-950 py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white">
              Свяжитесь с нами
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">
              Расскажите о вашей задаче — ответим на email
            </p>
          </div>

          {feedbackSent ? (
            <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-center">
              <CheckCircle2 className="w-10 h-10 text-neutral-700 dark:text-neutral-300 mx-auto mb-3" />
              <div className="font-bold text-neutral-900 dark:text-white">
                Спасибо! Мы свяжемся с вами в течение дня.
              </div>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="space-y-4 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-300 dark:border-neutral-700">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={feedbackEmail}
                    onChange={e => setFeedbackEmail(e.target.value)}
                    placeholder="you@company.ru"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Сообщение *
                </label>
                <textarea
                  required
                  rows={4}
                  value={feedbackMessage}
                  onChange={e => setFeedbackMessage(e.target.value)}
                  placeholder="Опишите вашу задачу или вопрос..."
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-500 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-sm transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Отправить</span>
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-neutral-200 dark:bg-neutral-900 border-t border-neutral-300 dark:border-neutral-800 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
          © 2026 HoReCa Quality Control. Все права защищены.
        </div>
      </footer>
    </div>
  );
};

// ============ FeatureCard ============
const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
      {title}
    </h3>
    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
      {description}
    </p>
  </div>
);
