import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LernstudioSet } from '../../shared/types';
import { DEFAULT_LERNSTUDIO_SETS } from '../../shared/defaultLernstudioSets';
import { LernstudioView } from '../../shared/components/LernstudioView';
import { LernstudioSharedProvider } from '../../shared/LernstudioSharedContext';
import { Lock, BookOpen, Sparkles, GraduationCap, ArrowRight } from 'lucide-react';

export const HomePage: React.FC = () => {
  const [sets, setSets] = useState<LernstudioSet[]>(() => {
    try {
      const stored = localStorage.getItem('dl_lernstudio_sets');
      if (stored) return JSON.parse(stored);
    } catch {
      // Ignore
    }
    return DEFAULT_LERNSTUDIO_SETS;
  });

  const [language, setLanguage] = useState<'ar' | 'de' | 'en'>('ar');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const handleSaveSet = (updatedSet: LernstudioSet) => {
    setSets((prev) => {
      const exists = prev.some((s) => s.id === updatedSet.id);
      const next = exists ? prev.map((s) => (s.id === updatedSet.id ? updatedSet : s)) : [updatedSet, ...prev];
      try {
        localStorage.setItem('dl_lernstudio_sets', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleDeleteSet = (id: string) => {
    setSets((prev) => {
      const next = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem('dl_lernstudio_sets', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  return (
    <LernstudioSharedProvider
      value={{
        lernstudioSets: sets,
        saveLernstudioSet: handleSaveSet,
        deleteLernstudioSet: handleDeleteSet,
        language,
        theme,
        groups: [],
        students: []
      }}
    >
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Top Header Bar with Teacher Dashboard entry */}
        <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-600 flex items-center justify-center text-lg shadow-md font-black">
              🇩🇪
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white block">
                Glück Lernstudio <span className="text-amber-400 text-xs font-bold uppercase ml-1">Web</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Interaktives Vokabeltraining & Spiele für Schüler und Lehrkräfte
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/teacher"
              className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-black transition-all inline-flex items-center gap-1.5 shadow-sm"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Lehrer-Bereich & Hausaufgaben</span>
            </a>
          </div>
        </header>

        {/* Main Lernstudio Experience */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
          <LernstudioView
            sets={sets}
            groups={[]}
            onSaveSet={handleSaveSet}
            onDeleteSet={handleDeleteSet}
            language={language}
          />
        </main>
      </div>
    </LernstudioSharedProvider>
  );
};
