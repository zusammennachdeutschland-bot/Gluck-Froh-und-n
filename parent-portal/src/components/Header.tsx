import React from 'react';
import { ThemeToggle } from './ThemeToggle';
import { LogOut, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import { StudentPortalData } from '../types';

interface HeaderProps {
  student: StudentPortalData;
  darkMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  student,
  darkMode,
  onToggleTheme,
  onLogout
}) => {
  const teacherPhone = student.teacherPhone || '201000000000';
  const whatsappUrl = `https://wa.me/${teacherPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`السلام عليكم يا فندم، أنا ولي أمر الطالب ${student.name} بخصوص متابعة حصص الألماني.`)}`;

  return (
    <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-md border-b border-surface-border transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand & Portal Label */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-sm border border-blue-400/30 shrink-0">
            AGS
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-text-main">
                بوابة متابعة ولي الأمر
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                🇩🇪 ألماني
              </span>
            </div>
            <p className="text-[11px] text-text-muted font-medium hidden sm:block">
              نظام المتابعة الأكاديمية والتقييم المباشر
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Direct WhatsApp to Teacher */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            title="تواصل مباشر مع المعلم عبر واتساب"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تواصل مع المعلم</span>
          </a>

          {/* Theme Toggle */}
          <ThemeToggle darkMode={darkMode} onToggle={onToggleTheme} />

          {/* Exit / Switch Student */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-surface border border-surface-border text-text-muted hover:text-rose-500 transition-all cursor-pointer"
            title="تسجيل الخروج / تبديل الطالب"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
