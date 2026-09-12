import React, { useState } from 'react';
import { Sparkles, ArrowLeft, ShieldCheck, KeyRound, Phone, UserCheck, AlertCircle, Loader2 } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface LoginViewProps {
  onLogin: (code: string) => Promise<boolean>;
  darkMode: boolean;
  onToggleTheme: () => void;
  isLoading: boolean;
  error?: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  darkMode,
  onToggleTheme,
  isLoading,
  error
}) => {
  const [studentCodeInput, setStudentCodeInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentCodeInput.trim()) {
      onLogin(studentCodeInput.trim());
    }
  };

  const handleDemoLogin = () => {
    onLogin('STU-1001');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4 sm:p-6 transition-colors">
      {/* Top Navbar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
            AGS
          </div>
          <span className="font-extrabold text-sm text-text-main">
            بوابة أولياء الأمور 🇩🇪
          </span>
        </div>

        <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-surface border border-surface-border rounded-3xl p-6 sm:p-8 shadow-md space-y-6 relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Heading */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>متابعة أكاديمية مستمرة</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-text-main tracking-tight">
              تسجيل دخول ولي الأمر
            </h1>

            <p className="text-xs sm:text-sm text-text-muted">
              أدخل كود الطالب أو رقم الهاتف المسجل للاطلاع على الحصص والدرجات والواجبات.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-3 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                <span>كود الطالب أو رقم الموبايل:</span>
              </label>

              <input
                type="text"
                value={studentCodeInput}
                onChange={(e) => setStudentCodeInput(e.target.value)}
                placeholder="مثال: STU-1001 أو 010xxxxxxxx"
                className="w-full bg-background border border-surface-border rounded-2xl px-4 py-3 text-sm font-bold text-text-main placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                dir="ltr"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !studentCodeInput.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-black text-sm py-3.5 px-4 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري جلب البيانات...</span>
                </>
              ) : (
                <>
                  <span>دخول للبوابة</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Button */}
          <div className="pt-2 border-t border-surface-border space-y-3">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full bg-background hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <span>تجربة البوابة بحساب تجريبي (Demo)</span>
            </button>

            <div className="flex items-center justify-center gap-1 text-[11px] text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>بيانات آمنة ومشفرة تماماً</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-[11px] text-text-muted py-2">
        نظام إدارة ومتابعة طلاب اللغة الألمانية © {new Date().getFullYear()} AGS Deutsch
      </footer>
    </div>
  );
};
