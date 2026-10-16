import React, { useState, useMemo } from 'react';
import { LernstudioLibraryArticle, LernstudioLevel } from '../../types/lernstudio';
import { LERNSTUDIO_LIBRARY_ARTICLES } from '../../data/lernstudioLibraryData';
import { BookOpen, Search, ArrowRight, Volume2, Bookmark, Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export const LernstudioLibraryView: React.FC<Props> = ({ onBack }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeArticle, setActiveArticle] = useState<LernstudioLibraryArticle | null>(null);

  const filteredArticles = useMemo(() => {
    return LERNSTUDIO_LIBRARY_ARTICLES.filter((art) => {
      const matchCat = selectedCategory === 'all' || art.category === selectedCategory;
      const matchLevel = selectedLevel === 'all' || art.level === selectedLevel;
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        art.title.toLowerCase().includes(q) ||
        art.titleArabic.includes(q) ||
        art.summary.toLowerCase().includes(q) ||
        art.summaryArabic.includes(q);

      return matchCat && matchLevel && matchSearch;
    });
  }, [selectedCategory, selectedLevel, searchTerm]);

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-surface p-4 rounded-3xl border border-surface-border shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-text-muted hover:text-text-main bg-surface-hover rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <ArrowRight className="w-4 h-4" />
            <span>الرجوع للرئيسية</span>
          </button>

          <div>
            <h2 className="text-base sm:text-lg font-black text-text-main flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span>مكتبة تعليم اللغة الألمانية (Lernbibliothek) 🇩🇪</span>
            </h2>
            <p className="text-xs text-text-muted">دروس شاطرة وشاملة للقواعد والمفردات والمحادثات من A1 إلى C2</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-surface rounded-2xl border border-surface-border space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="البحث في دروس المكتبة..."
              className="w-full pr-9 pl-3 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary"
          >
            <option value="all">جميع الأقسام</option>
            <option value="alphabet">الأبجدية والنطق 🔤</option>
            <option value="vocabulary">المفردات 📚</option>
            <option value="grammar">القواعد ⏱️</option>
            <option value="conversations">المحادثات 🗣️</option>
            <option value="reading_writing">القراءة والكتابة ✍️</option>
          </select>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-3 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary"
          >
            <option value="all">جميع المستويات (A1-C2)</option>
            <option value="A1">A1 - مبتدئ</option>
            <option value="A2">A2 - أساسي</option>
            <option value="B1">B1 - متوسط</option>
            <option value="B2">B2 - متوسط متقدم</option>
          </select>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredArticles.map((art) => (
          <div
            key={art.id}
            onClick={() => setActiveArticle(art)}
            className="p-5 bg-surface hover:bg-surface-hover/60 border border-surface-border hover:border-primary/50 rounded-3xl shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-3 flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-primary-soft text-primary font-black text-[10px]">
                  {art.level}
                </span>
                <span className="text-[10px] font-bold text-text-muted">
                  {art.category === 'alphabet' ? 'الأبجدية والنطق' : art.category === 'grammar' ? 'القواعد' : 'المفردات'}
                </span>
              </div>

              <h3 className="text-sm font-black text-text-main group-hover:text-primary transition-colors">
                {art.titleArabic}
              </h3>
              <p className="text-xs font-mono font-bold text-primary" dir="ltr">
                {art.title}
              </p>
              <p className="text-xs text-text-muted line-clamp-2">{art.summaryArabic}</p>
            </div>

            <div className="pt-2 border-t border-surface-border/40 flex items-center justify-between text-xs font-bold text-primary">
              <span>قراءة الدرس الكامل ↗</span>
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* ARTICLE READER MODAL */}
      {activeArticle && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-hidden">
          <div className="bg-surface border border-surface-border rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface shrink-0">
              <div>
                <span className="text-[10px] font-black text-primary uppercase">{activeArticle.level} • {activeArticle.category}</span>
                <h2 className="text-base font-black text-text-main">{activeArticle.titleArabic}</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveArticle(null)}
                className="p-1.5 rounded-xl text-text-muted hover:text-text-main bg-surface-hover cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-7 overflow-y-auto space-y-5 flex-1 text-right">
              <div className="p-4 bg-primary-soft/40 border border-primary-border/40 rounded-2xl">
                <h3 className="text-lg font-black text-primary ltr font-mono" dir="ltr">{activeArticle.title}</h3>
                <p className="text-xs font-medium text-text-muted mt-1">{activeArticle.summaryArabic}</p>
              </div>

              {/* Rendered HTML content */}
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-text-main text-xs sm:text-sm leading-relaxed space-y-3"
                dangerouslySetInnerHTML={{ __html: activeArticle.contentHtml }}
              />

              {/* Examples section */}
              {activeArticle.examples && activeArticle.examples.length > 0 && (
                <div className="p-4 bg-surface-hover/60 border border-surface-border rounded-2xl space-y-2">
                  <h4 className="text-xs font-black text-text-main flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>أمثلة تطبيقية (Beispiele):</span>
                  </h4>
                  <div className="space-y-1.5">
                    {activeArticle.examples.map((ex, idx) => (
                      <div key={idx} className="p-2.5 bg-surface rounded-xl border border-surface-border/60 text-xs flex items-center justify-between gap-2">
                        <span className="font-bold text-primary font-mono ltr" dir="ltr">{ex.german}</span>
                        <span className="text-text-muted font-medium">{ex.arabic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-surface-border bg-surface flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveArticle(null)}
                className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                إغلاق الدرس
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
