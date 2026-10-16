import React, { useState, useMemo } from 'react';
import { LernstudioSet, LernstudioThemeId, LernstudioLevel } from '../../types/lernstudio';
import { Group } from '../../types';
import { LERNSTUDIO_THEMES } from './lernstudioThemes';
import { LernstudioGameRunner } from './LernstudioGameRunner';
import { LernstudioClassroomBoard } from './LernstudioClassroomBoard';
import { LernstudioSetEditorModal } from './LernstudioSetEditorModal';
import { LernstudioAiModal } from './LernstudioAiModal';
import { LernstudioWorksheetModal } from './LernstudioWorksheetModal';
import { LernstudioTeachModal } from './LernstudioTeachModal';
import { getLernstudioTranslations } from '../../utils/lernstudioTranslations';
import { CHILDREN_LEVEL_CATEGORIES } from '../../data/childrenTopicsPreset';

import {
  Sparkles,
  Plus,
  Gamepad2,
  Trophy,
  Printer,
  Search,
  Filter,
  Palette,
  Download,
  Copy,
  Trash2,
  Archive,
  Edit3,
  Layers,
  Award,
  ChevronRight,
  BookOpen
} from 'lucide-react';

interface Props {
  sets: LernstudioSet[];
  groups: Group[];
  schoolName?: string;
  teacherName?: string;
  onSaveSet: (set: LernstudioSet) => void;
  onDeleteSet: (setId: string) => void;
  language: string;
}

export const LernstudioView: React.FC<Props> = ({
  sets = [],
  groups = [],
  schoolName,
  teacherName,
  onSaveSet,
  onDeleteSet,
  language = 'ar'
}) => {
  const t = getLernstudioTranslations(language);

  // Theme State
  const [currentThemeId, setCurrentThemeId] = useState<LernstudioThemeId>('pastel');
  const activeTheme = LERNSTUDIO_THEMES[currentThemeId];

  // Mode View State
  const [activeMode, setActiveMode] = useState<'hub' | 'game' | 'classroom'>('hub');
  const [selectedSetForMode, setSelectedSetForMode] = useState<LernstudioSet | null>(null);

  // Modals
  const [isSetEditorOpen, setIsSetEditorOpen] = useState(false);
  const [setToEdit, setSetToEdit] = useState<LernstudioSet | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);
  const [selectedSetForWorksheet, setSelectedSetForWorksheet] = useState<LernstudioSet | null>(null);

  const [isTeachModalOpen, setIsTeachModalOpen] = useState(false);
  const [selectedSetForTeach, setSelectedSetForTeach] = useState<LernstudioSet | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedChildrenCategory, setSelectedChildrenCategory] = useState<string>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  // Filtered Sets
  const filteredSets = useMemo(() => {
    return sets.filter((set) => {
      if (set.isArchived) return false;

      const matchLevel = selectedLevel === 'all' || set.level === selectedLevel;
      const matchChildrenCategory =
        selectedChildrenCategory === 'all' ||
        (set.grade && set.grade.includes(selectedChildrenCategory));
      const matchGroup = selectedGroupFilter === 'all' || set.assignedGroupId === selectedGroupFilter;

      const q = searchTerm.trim().toLowerCase();
      const matchQuery =
        !q ||
        set.title.toLowerCase().includes(q) ||
        (set.topic && set.topic.toLowerCase().includes(q)) ||
        (set.grade && set.grade.toLowerCase().includes(q));

      return matchLevel && matchChildrenCategory && matchGroup && matchQuery;
    });
  }, [sets, selectedLevel, selectedChildrenCategory, selectedGroupFilter, searchTerm]);

  // Handlers
  const handleDuplicateSet = (set: LernstudioSet) => {
    const duplicated: LernstudioSet = {
      ...set,
      id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: `${set.title} (${language === 'ar' ? 'نسخة' : 'Copy'})`,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now()
    };
    onSaveSet(duplicated);
    /* confetti removed */
  };

  const handleExportSetJson = (set: LernstudioSet) => {
    const jsonStr = JSON.stringify(set, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert(language === 'ar' ? `تم نسخ بيانات المجموعة (${set.title}) بصيغة JSON إلى الحافظة!` : `Set (${set.title}) JSON copied to clipboard!`);
  };

  // Render Sub-Views (Game, Classroom)
  if (activeMode === 'game' && selectedSetForMode) {
    return (
      <LernstudioGameRunner
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('hub')}
      />
    );
  }

  if (activeMode === 'classroom' && selectedSetForMode) {
    return (
      <LernstudioClassroomBoard
        set={selectedSetForMode}
        activeTheme={activeTheme}
        onBack={() => setActiveMode('hub')}
      />
    );
  }

  return (
    <div className={`p-4 sm:p-6 rounded-3xl space-y-6 transition-all min-h-[85vh] ${activeTheme.bgGradient}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Banner & Title Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-surface/90 backdrop-blur-md p-3.5 sm:p-5 rounded-3xl border border-surface-border shadow-md overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl sm:text-3xl shrink-0">{activeTheme.emoji}</span>
          <h1 className="text-lg sm:text-2xl font-black text-text-main truncate">
            {t.hubTitle}
          </h1>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Theme Selector */}
          <div className="flex items-center gap-1 bg-surface-hover/80 p-1 rounded-2xl border border-surface-border shrink-0">
            <Palette className="w-3.5 h-3.5 text-primary ml-1 mr-1" />
            {(Object.keys(LERNSTUDIO_THEMES) as LernstudioThemeId[]).map((tId) => (
              <button
                key={tId}
                type="button"
                onClick={() => setCurrentThemeId(tId)}
                className={`px-2 py-0.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  currentThemeId === tId ? activeTheme.primaryBg : 'text-text-muted hover:text-text-main'
                }`}
                title={LERNSTUDIO_THEMES[tId].name}
              >
                {LERNSTUDIO_THEMES[tId].emoji}
              </button>
            ))}
          </div>

          {/* AI Generator Button */}
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer inline-flex items-center gap-1.5 shrink-0 transform hover:scale-105 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t.aiImport}</span>
          </button>

          {/* New Set Button */}
          <button
            type="button"
            onClick={() => {
              setSetToEdit(null);
              setIsSetEditorOpen(true);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black shadow-md cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${activeTheme.primaryBg}`}
          >
            <Plus className="w-4 h-4" />
            <span>{t.createSet}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar (Responsive, No Overflow) */}
      <div className="p-3 sm:p-4 bg-surface/80 backdrop-blur-md rounded-2xl border border-surface-border space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3 overflow-hidden">
        {/* Search Box */}
        <div className="relative flex-1 w-full min-w-0">
          <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-text-muted ${language === 'ar' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`w-full py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary truncate ${
              language === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>

        {/* Dropdowns row on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto shrink-0 min-w-0">
          {/* Children Level Category Filter */}
          <select
            value={selectedChildrenCategory}
            onChange={(e) => setSelectedChildrenCategory(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary min-w-0 truncate"
          >
            <option value="all">-- {language === 'ar' ? 'جميع مستويات الأطفال (7 مستويات)' : 'All Children Levels'} --</option>
            {CHILDREN_LEVEL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary min-w-0 truncate"
          >
            <option value="all">{t.allLevels}</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>

          {/* Group Filter */}
          <select
            value={selectedGroupFilter}
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary min-w-0 truncate"
          >
            <option value="all">{t.allGroups}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sets Grid Cards */}
      {filteredSets.length === 0 ? (
        <div className="p-12 text-center bg-surface/80 rounded-3xl border border-surface-border space-y-4">
          <Layers className="w-12 h-12 text-primary mx-auto opacity-50" />
          <h3 className="text-base font-black text-text-main">{t.noSetsFound}</h3>
          <p className="text-xs text-text-muted">{t.noSetsDesc}</p>
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-black shadow-md inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t.aiImport}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSets.map((set) => {
            const itemCount = set.items?.length || 0;
            const assignedGroup = groups.find((g) => g.id === set.assignedGroupId);

            return (
              <div
                key={set.id}
                className={`p-5 rounded-3xl space-y-4 flex flex-col justify-between transition-all hover:scale-[1.01] ${activeTheme.cardBg}`}
              >
                <div className="space-y-3">
                  {/* Card Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black ${activeTheme.accentBadge}`}>
                      {set.level} • {set.topic} {set.grade ? `(${set.grade})` : ''}
                    </span>

                    {assignedGroup && (
                      <span className="px-2 py-0.5 rounded-lg bg-surface-hover text-text-muted font-bold text-[10px]">
                        👥 {assignedGroup.name}
                      </span>
                    )}
                  </div>

                  {/* Card Title & Info */}
                  <div>
                    <h3 className="text-base font-black text-text-main line-clamp-1">{set.title}</h3>
                    {set.description && (
                      <p className="text-xs text-text-muted line-clamp-2 mt-0.5">{set.description}</p>
                    )}
                  </div>

                  {/* Vocabulary preview items pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {set.items.slice(0, 4).map((it, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-hover text-text-main border border-surface-border/40 font-mono"
                        dir="ltr"
                      >
                        {it.emoji} {it.german}
                      </span>
                    ))}
                    {itemCount > 4 && (
                      <span className="text-[10px] font-bold text-text-muted">+ {itemCount - 4}</span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="space-y-2 pt-3 border-t border-surface-border/50">
                  {/* Primary Play, Teach & Classroom Buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSetForMode(set);
                        setActiveMode('game');
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-black shadow-xs cursor-pointer inline-flex items-center justify-center gap-1 ${activeTheme.primaryBg}`}
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>{t.playGame}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSetForTeach(set);
                        setIsTeachModalOpen(true);
                      }}
                      className="py-2 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>مود الشرح</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSetForMode(set);
                        setActiveMode('classroom');
                      }}
                      className="py-2 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>{t.classroomBoard}</span>
                    </button>
                  </div>

                  {/* Secondary Printable & Controls */}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSetForWorksheet(set);
                        setIsWorksheetModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-xl text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5 text-primary" />
                      <span>{t.printWorksheet}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleExportSetJson(set)}
                        className="p-1.5 text-text-muted hover:text-text-main bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title={t.copyJson}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateSet(set)}
                        className="p-1.5 text-text-muted hover:text-text-main bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title={t.copyJson}
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSetToEdit(set);
                          setIsSetEditorOpen(true);
                        }}
                        className="p-1.5 text-text-muted hover:text-primary bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title={t.editSet}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(language === 'ar' ? `هل أنت متأكد من حذف مجموعة (${set.title})؟` : `Delete set (${set.title})?`)) {
                            onDeleteSet(set.id);
                          }
                        }}
                        className="p-1.5 text-text-muted hover:text-red-500 bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title={t.deleteSet}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {isSetEditorOpen && (
        <LernstudioSetEditorModal
          isOpen={isSetEditorOpen}
          setToEdit={setToEdit}
          groups={groups}
          onClose={() => setIsSetEditorOpen(false)}
          onSaveSet={onSaveSet}
        />
      )}

      {isAiModalOpen && (
        <LernstudioAiModal
          isOpen={isAiModalOpen}
          language={language}
          onClose={() => setIsAiModalOpen(false)}
          onImportSet={onSaveSet}
        />
      )}

      {isWorksheetModalOpen && selectedSetForWorksheet && (
        <LernstudioWorksheetModal
          isOpen={isWorksheetModalOpen}
          set={selectedSetForWorksheet}
          schoolName={schoolName}
          teacherName={teacherName}
          onClose={() => {
            setIsWorksheetModalOpen(false);
            setSelectedSetForWorksheet(null);
          }}
        />
      )}

      {isTeachModalOpen && selectedSetForTeach && (
        <LernstudioTeachModal
          isOpen={isTeachModalOpen}
          set={selectedSetForTeach}
          language={language}
          onClose={() => {
            setIsTeachModalOpen(false);
            setSelectedSetForTeach(null);
          }}
        />
      )}
    </div>
  );
};
