import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export interface ErrorBoundary {
  state: State;
  props: Props;
  setState(state: Partial<State> | ((prevState: State) => Partial<State>)): void;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Checklist-1C ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    // Clear URL parameters that might be corrupt or malformed
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      window.history.replaceState({}, '', url.pathname);
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  private handleOpenDefaultTerminal = () => {
    if (typeof window !== 'undefined') {
      window.location.href = window.location.origin + window.location.pathname + '?mode=runner';
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full max-w-md mx-auto my-8 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Ошибка загрузки терминала чек-листа
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Не удалось открыть форму по переданным параметрам QR-кода. Возможно, ссылка устарела или содержит неверный идентификатор.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={this.handleOpenDefaultTerminal}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Открыть терминал смены по умолчанию</span>
            </button>

            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center space-x-2 transition"
            >
              <Home className="w-4 h-4" />
              <span>Перейти на главную страницу</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
