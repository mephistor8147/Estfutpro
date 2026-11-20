import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable =
      'Ocorreu um erro inesperado ao sincronizar os dados do aplicativo.';
    if (error?.message) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error && typeof parsed.error === 'string') {
          if (parsed.error.toLowerCase().includes('quota exceeded')) {
            readable =
              'Cota diária do banco de dados Firestore atingida. A cota é renovada automaticamente no próximo dia.';
          } else if (parsed.error.toLowerCase().includes('permission')) {
            readable =
              'Permissão negada ao acessar o banco de dados. Verifique se sua conta Google está conectada com e-mail verificado.';
          } else {
            readable = parsed.error;
          }
        }
      } catch {
        readable = error.message;
      }
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F7F9] dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                Ops! Algo saiu do esperado
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {this.state.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recarregar aplicativo</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
