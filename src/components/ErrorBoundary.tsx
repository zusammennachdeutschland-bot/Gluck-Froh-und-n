import React from 'react';
import { AlertTriangle, RefreshCw, Home, Wrench, Trash2 } from 'lucide-react';
import { clearAllLocalDataAndReset } from '../services/dataSanitizer';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    (this as any).setState({ hasError: false, error: null });
  };

  handleClearData = (): void => {
    if (window.confirm('هل تود تفريغ البيانات القديمة التالفة وإعادة تشغيل التطبيق بحالة نظيفة؟ (سيتم حفظ نسخة طوارئ احتياطية تلقائياً)')) {
      clearAllLocalDataAndReset();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h2 className="text-lg font-bold text-slate-100 mb-2">
            حدث خطأ غير متوقع في معالجة البيانات
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            تم حماية التطبيق ومنع إغلاقه. إذا كان الخطأ بسبب بيانات قديمة غير متوافقة، يمكنك استخدام خيار الترميم أو إعادة التشغيل بأمان.
          </p>

          {this.state.error && (
            <div className="mb-6 p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl text-[11px] font-mono text-rose-300 max-w-md overflow-x-auto text-left w-full max-h-24">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>الرئيسية</span>
              </button>

              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة التحميل</span>
              </button>
            </div>

            <button
              onClick={this.handleClearData}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>تصفير البيانات التالفة والبدء النظيف</span>
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
