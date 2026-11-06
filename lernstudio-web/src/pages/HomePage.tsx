import React, { useState, useEffect } from 'react';
import { LernstudioSet } from '../../shared/types';
import { DEFAULT_LERNSTUDIO_SETS } from '../../shared/defaultLernstudioSets';
import { LernstudioView } from '../../shared/components/LernstudioView';
import { LernstudioHomeworkModal } from '../../shared/components/LernstudioHomeworkModal';
import { LernstudioSharedProvider } from '../../shared/LernstudioSharedContext';
import {
  saveLernstudioSetToFirestore,
  deleteLernstudioSetFromFirestore,
  subscribeLernstudioSetsFromFirestore
} from '../../shared/firebaseCloudSync';
import { Lock, Send, Trophy } from 'lucide-react';

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

  const [language] = useState<'ar' | 'de' | 'en'>('ar');
  const [theme] = useState<'dark' | 'light'>('dark');
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState(false);

  useEffect(() => {
    const unsubSets = subscribeLernstudioSetsFromFirestore((cloudSets) => {
      if (cloudSets.length > 0) {
        setSets((prev) => {
          const map = new Map<string, LernstudioSet>();
          cloudSets.forEach((cs) => map.set(cs.id, cs));
          prev.forEach((ps) => {
            if (!map.has(ps.id)) map.set(ps.id, ps);
          });
          const merged = Array.from(map.values());
          try {
            localStorage.setItem('dl_lernstudio_sets', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    });
    return () => {
      unsubSets();
    };
  }, []);

  const handleSaveSet = (updatedSet: LernstudioSet) => {
    saveLernstudioSetToFirestore(updatedSet).catch(() => {});
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
    deleteLernstudioSetFromFirestore(id).catch(() => {});
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
        {/* Top Header Bar */}
        <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-3 sm:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-600 flex items-center justify-center text-lg shadow-md font-black shrink-0">
              🇩🇪
            </div>
            <div>
              <span className="text-sm sm:text-base font-black tracking-tight text-white block">
                Glück Lernstudio <span className="text-amber-400 text-xs font-bold uppercase ml-1">Web</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:block">
                نظام التدريب التفاعلي وواجبات الطلاب بنظام Blooket
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setIsHomeworkModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition-all inline-flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إنشاء واجب (Homework) 🎮</span>
            </button>

            <a
              href="/teacher"
              className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-black transition-all inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>لوحة المعلم والنتائج</span>
              <Lock className="w-3 h-3 text-slate-400" />
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

        <LernstudioHomeworkModal
          isOpen={isHomeworkModalOpen}
          onClose={() => setIsHomeworkModalOpen(false)}
          sets={sets}
          language={language}
        />
      </div>
    </LernstudioSharedProvider>
  );
};
