import React, { useState, useMemo } from 'react';
import { LernstudioSet, LernstudioThemeId, LernstudioLevel, LernstudioGameMode } from '../../types/lernstudio';
import { Group } from '../../types';
import { LERNSTUDIO_THEMES } from './lernstudioThemes';
import { LernstudioGameRunner } from './LernstudioGameRunner';
import { LernstudioClassroomBoard } from './LernstudioClassroomBoard';
import { LernstudioWheelGame } from './games/LernstudioWheelGame';
import { LernstudioRaceGame } from './games/LernstudioRaceGame';
import { LernstudioMemoryGame } from './games/LernstudioMemoryGame';
import { LernstudioSortingGame } from './games/LernstudioSortingGame';
import { LernstudioSentenceGame } from './games/LernstudioSentenceGame';
import { LernstudioBalloonPopGame } from './games/LernstudioBalloonPopGame';
import { LernstudioTicTacToeGame } from './games/LernstudioTicTacToeGame';
import { LernstudioBasketCatchGame } from './games/LernstudioBasketCatchGame';
import { LernstudioSpaceDefenseGame } from './games/LernstudioSpaceDefenseGame';
import { LernstudioWordDetectiveGame } from './games/LernstudioWordDetectiveGame';
import { LernstudioWhackAMoleGame } from './games/LernstudioWhackAMoleGame';
import { LernstudioTugOfWarGame } from './games/LernstudioTugOfWarGame';
import { LernstudioWordNinjaGame } from './games/LernstudioWordNinjaGame';
import { LernstudioBridgeBuilderGame } from './games/LernstudioBridgeBuilderGame';
import { LernstudioColorMasterGame } from './games/LernstudioColorMasterGame';
import { LernstudioFactoryMachineGame } from './games/LernstudioFactoryMachineGame';
import { LernstudioFollowCluesGame } from './games/LernstudioFollowCluesGame';
import { LernstudioIslandCrossingGame } from './games/LernstudioIslandCrossingGame';
import { LernstudioPitStopGame } from './games/LernstudioPitStopGame';
import { LernstudioPuzzleMastersGame } from './games/LernstudioPuzzleMastersGame';
import { LernstudioRobotRepairGame } from './games/LernstudioRobotRepairGame';
import { LernstudioRocketCountdownGame } from './games/LernstudioRocketCountdownGame';
import { LernstudioSpaceFleetGame } from './games/LernstudioSpaceFleetGame';
import { LernstudioSubmarineGame } from './games/LernstudioSubmarineGame';
import { LernstudioTargetAttackGame } from './games/LernstudioTargetAttackGame';
import { LernstudioTeamAuctionGame } from './games/LernstudioTeamAuctionGame';
import { LernstudioTowerArchitectsGame } from './games/LernstudioTowerArchitectsGame';
import { LernstudioVendingMachineGame } from './games/LernstudioVendingMachineGame';
import { LernstudioWhatsInTheBoxGame } from './games/LernstudioWhatsInTheBoxGame';
import { LernstudioWordRhythmGame } from './games/LernstudioWordRhythmGame';
import { LernstudioWordWashGame } from './games/LernstudioWordWashGame';
import { LernstudioGamesPortalView } from './LernstudioGamesPortalView';
import { LernstudioSetEditorModal } from './LernstudioSetEditorModal';
import { LernstudioAiModal } from './LernstudioAiModal';
import { LernstudioWorksheetModal } from './LernstudioWorksheetModal';
import { LernstudioTeachModal } from './LernstudioTeachModal';
import { LernstudioWordsModal } from './LernstudioWordsModal';
import { getLernstudioTranslations, getLocalizedSetTitle, getLocalizedSetTopic, getLocalizedGrade, getLocalizedSetDescription, PROGRAM_GRADES, matchesGradeFilter } from '../../utils/lernstudioTranslations';
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
  BookOpen,
  Eye,
  Share2
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
  const [activeMode, setActiveMode] = useState<LernstudioGameMode>('hub');
  const [selectedSetForMode, setSelectedSetForMode] = useState<LernstudioSet | null>(null);

  // Modals
  const [isSetEditorOpen, setIsSetEditorOpen] = useState(false);
  const [setToEdit, setSetToEdit] = useState<LernstudioSet | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);
  const [selectedSetForWorksheet, setSelectedSetForWorksheet] = useState<LernstudioSet | null>(null);

  const [isTeachModalOpen, setIsTeachModalOpen] = useState(false);
  const [selectedSetForTeach, setSelectedSetForTeach] = useState<LernstudioSet | null>(null);

  const [isWordsModalOpen, setIsWordsModalOpen] = useState(false);
  const [selectedSetForWordsModal, setSelectedSetForWordsModal] = useState<LernstudioSet | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  // Dynamic Categories from available sets
  const availableCategories = useMemo(() => {
    const map = new Map<string, number>();
    sets.forEach((s) => {
      if (!s || s.isArchived) return;
      const cat = s.topic || 'عام';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([cat, count]) => ({ cat, count }))
      .sort((a, b) => a.cat.localeCompare(b.cat));
  }, [sets]);

  // Filtered Sets (with Deduplication Protection)
  const filteredSets = useMemo(() => {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    return sets.filter((set) => {
      if (!set || !set.id || set.isArchived) return false;

      // Deduplicate by ID
      if (seenIds.has(set.id)) return false;

      // Deduplicate by Title (strip (Copy) / (نسخة) for clean matching)
      const cleanTitleKey = (set.title || '').replace(/\((Copy|نسخة)\)/gi, '').trim().toLowerCase();
      if (cleanTitleKey && seenTitles.has(cleanTitleKey)) {
        return false;
      }

      const matchGrade = matchesGradeFilter(set, selectedGradeFilter);
      const matchCategory = selectedCategoryFilter === 'all' || set.topic === selectedCategoryFilter;
      const matchGroup = selectedGroupFilter === 'all' || set.assignedGroupId === selectedGroupFilter;

      const q = searchTerm.trim().toLowerCase();
      const matchQuery =
        !q ||
        set.title.toLowerCase().includes(q) ||
        (set.topic && set.topic.toLowerCase().includes(q)) ||
        (set.grade && set.grade.toLowerCase().includes(q));

      if (matchGrade && matchCategory && matchGroup && matchQuery) {
        seenIds.add(set.id);
        if (cleanTitleKey) seenTitles.add(cleanTitleKey);
        return true;
      }
      return false;
    });
  }, [sets, selectedGradeFilter, selectedCategoryFilter, selectedGroupFilter, searchTerm]);

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

  const handleShareWhatsApp = (set: LernstudioSet) => {
    const displayTitle = getLocalizedSetTitle(set, language);
    const displayTopic = getLocalizedSetTopic(set, language);
    const items = set.items || [];

    let text = `🇩🇪 *${displayTitle}*\n`;
    text += `📌 ${displayTopic}\n`;
    text += `📚 ${items.length} ${t.vocabularyCount}:\n\n`;

    items.slice(0, 15).forEach((it, idx) => {
      text += `${idx + 1}. ${it.german} ➡️ ${it.arabic}\n`;
    });

    if (items.length > 15) {
      text += `... +${items.length - 15} ${t.vocabularyCount}\n`;
    }

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  // Render Sub-Views (Full-Page Games Portal & Individual Games)
  if (activeMode === 'games_portal' && selectedSetForMode) {
    return (
      <LernstudioGamesPortalView
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('hub')}
        onSelectGame={(gMode) => setActiveMode(gMode)}
      />
    );
  }

  if (activeMode === 'sentence_builder' && selectedSetForMode) {
    return (
      <LernstudioSentenceGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'game' && selectedSetForMode) {
    return (
      <LernstudioGameRunner
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'classroom' && selectedSetForMode) {
    return (
      <LernstudioClassroomBoard
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'wheel' && selectedSetForMode) {
    return (
      <LernstudioWheelGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'race' && selectedSetForMode) {
    return (
      <LernstudioRaceGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'memory' && selectedSetForMode) {
    return (
      <LernstudioMemoryGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'sorting' && selectedSetForMode) {
    return (
      <LernstudioSortingGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'balloon_pop' && selectedSetForMode) {
    return (
      <LernstudioBalloonPopGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'tictactoe' && selectedSetForMode) {
    return (
      <LernstudioTicTacToeGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'basket_catch' && selectedSetForMode) {
    return (
      <LernstudioBasketCatchGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'tug_of_war' && selectedSetForMode) {
    return (
      <LernstudioTugOfWarGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'word_ninja' && selectedSetForMode) {
    return (
      <LernstudioWordNinjaGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'space_defense' && selectedSetForMode) {
    return (
      <LernstudioSpaceDefenseGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'whack_a_mole' && selectedSetForMode) {
    return (
      <LernstudioWhackAMoleGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'word_detective' && selectedSetForMode) {
    return (
      <LernstudioWordDetectiveGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'bridge_builder' && selectedSetForMode) {
    return (
      <LernstudioBridgeBuilderGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'color_master' && selectedSetForMode) {
    return (
      <LernstudioColorMasterGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'factory_machine' && selectedSetForMode) {
    return (
      <LernstudioFactoryMachineGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'follow_clues' && selectedSetForMode) {
    return (
      <LernstudioFollowCluesGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'island_crossing' && selectedSetForMode) {
    return (
      <LernstudioIslandCrossingGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'pit_stop' && selectedSetForMode) {
    return (
      <LernstudioPitStopGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'puzzle_masters' && selectedSetForMode) {
    return (
      <LernstudioPuzzleMastersGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'robot_repair' && selectedSetForMode) {
    return (
      <LernstudioRobotRepairGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'rocket_countdown' && selectedSetForMode) {
    return (
      <LernstudioRocketCountdownGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'space_fleet' && selectedSetForMode) {
    return (
      <LernstudioSpaceFleetGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'submarine_explore' && selectedSetForMode) {
    return (
      <LernstudioSubmarineGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'target_attack' && selectedSetForMode) {
    return (
      <LernstudioTargetAttackGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'team_auction' && selectedSetForMode) {
    return (
      <LernstudioTeamAuctionGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'tower_architects' && selectedSetForMode) {
    return (
      <LernstudioTowerArchitectsGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'vending_machine' && selectedSetForMode) {
    return (
      <LernstudioVendingMachineGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'whats_in_box' && selectedSetForMode) {
    return (
      <LernstudioWhatsInTheBoxGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'word_rhythm' && selectedSetForMode) {
    return (
      <LernstudioWordRhythmGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  if (activeMode === 'word_wash' && selectedSetForMode) {
    return (
      <LernstudioWordWashGame
        set={selectedSetForMode}
        activeTheme={activeTheme}
        language={language}
        onBack={() => setActiveMode('games_portal')}
      />
    );
  }

  return (
    <div className={`p-4 sm:p-6 pb-32 sm:pb-40 rounded-3xl space-y-6 transition-all min-h-[85vh] ${activeTheme.bgGradient}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
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

        {/* Dropdowns row on mobile & desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto shrink-0 min-w-0">
          {/* Level 1: Program Grade Filter */}
          <select
            value={selectedGradeFilter}
            onChange={(e) => setSelectedGradeFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary min-w-0 truncate cursor-pointer"
          >
            <option value="all">🎓 {t.allEducationalLevels} ({sets.length})</option>
            {PROGRAM_GRADES.map((g) => (
              <option key={g.id} value={g.id}>
                {language === 'ar' ? g.labelAr : language === 'de' ? g.labelDe : g.labelEn}
              </option>
            ))}
          </select>

          {/* Level 2: Thematic Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary min-w-0 truncate cursor-pointer"
          >
            <option value="all">📁 {t.allTopicsAndCategories} ({availableCategories.length})</option>
            {availableCategories.map((item) => (
              <option key={item.cat} value={item.cat}>
                {getLocalizedSetTopic({ topic: item.cat }, language)} ({item.count})
              </option>
            ))}
          </select>

          {/* Group Filter */}
          <select
            value={selectedGroupFilter}
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary min-w-0 truncate cursor-pointer"
          >
            <option value="all">👥 {t.allGroups}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Curriculum Summary Badge / Counter */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-bold">
            📚 {sets.length} {t.germanSetsForKids} ({sets.reduce((acc, s) => acc + (s.items?.length || 0), 0)} {t.vocabularyCount})
          </span>
          <span className="text-text-muted hidden sm:inline">
            ✨ {t.curriculumSubtitle}
          </span>
        </div>
        {(selectedGradeFilter !== 'all' || selectedCategoryFilter !== 'all' || searchTerm || selectedGroupFilter !== 'all') && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted font-medium">
              {t.displayedResults} <strong className="text-text-main font-bold">{filteredSets.length}</strong> {t.setsUnit}
            </span>
            <button
              onClick={() => {
                setSelectedGradeFilter('all');
                setSelectedCategoryFilter('all');
                setSelectedGroupFilter('all');
                setSearchTerm('');
              }}
              className="text-xs text-primary hover:underline font-bold cursor-pointer"
            >
              {t.resetFilters}
            </button>
          </div>
        )}
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
                className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-surface-border bg-surface shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 group max-w-full overflow-hidden"
              >
                <div className="space-y-3 min-w-0 max-w-full">
                  {/* Card Header: Vocabulary Count, Grade & Group */}
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs min-w-0 max-w-full overflow-hidden">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted min-w-0 max-w-full flex-wrap overflow-hidden">
                      <span className="font-bold text-primary shrink-0">{itemCount} {t.vocabularyCount}</span>
                      {set.grade && (
                        <>
                          <span aria-hidden="true" className="text-text-muted/40 shrink-0">·</span>
                          <span className="truncate max-w-[140px] sm:max-w-none text-text-main font-semibold">{getLocalizedGrade(set.grade, language)}</span>
                        </>
                      )}
                    </div>

                    {assignedGroup && (
                      <span className="px-2 py-0.5 rounded-md bg-surface-hover text-text-muted font-bold text-[10px] shrink-0 border border-surface-border/40 truncate max-w-[120px]">
                        👥 {assignedGroup.name}
                      </span>
                    )}
                  </div>

                  {/* Card Title & Description - Click opens vocabulary modal */}
                  <div
                    onClick={() => {
                      setSelectedSetForWordsModal(set);
                      setIsWordsModalOpen(true);
                    }}
                    className="space-y-1.5 cursor-pointer group/title p-1 -m-1 rounded-xl hover:bg-surface-hover/50 transition-colors min-w-0 max-w-full overflow-hidden"
                  >
                    <h3 className="text-base sm:text-lg font-bold text-text-main group-hover/title:text-primary transition-colors leading-snug flex items-start justify-between gap-2 min-w-0">
                      <span className="line-clamp-2 break-words flex-1 min-w-0">{getLocalizedSetTitle(set, language)}</span>
                      <Eye className="w-4 h-4 text-text-muted opacity-40 group-hover/title:opacity-100 group-hover/title:text-primary transition-all shrink-0 mt-1" />
                    </h3>
                    {set.description && (
                      <p className="text-xs text-text-muted line-clamp-2 leading-relaxed break-words">
                        {getLocalizedSetDescription(set, language)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Action Section */}
                <div className="pt-3 border-t border-surface-border/60 space-y-2">
                  {/* Primary Game Portal CTA Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSetForMode(set);
                      setActiveMode('games_portal');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-2xs cursor-pointer inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white transform active:scale-[0.98] transition-all"
                  >
                    <Gamepad2 className="w-4 h-4 shrink-0" />
                    <span>{t.playGame}</span>
                  </button>

                  {/* Secondary Action Row: Teach Mode, Worksheet, and Quick Tools */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSetForTeach(set);
                          setIsTeachModalOpen(true);
                        }}
                        className="flex-1 py-1.5 px-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-all truncate"
                      >
                        <BookOpen className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                        <span className="truncate">{t.teachMode}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSetForWorksheet(set);
                          setIsWorksheetModalOpen(true);
                        }}
                        className="flex-1 py-1.5 px-2.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-lg text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-all truncate"
                      >
                        <Printer className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{t.printWorksheet}</span>
                      </button>
                    </div>

                    {/* Quick Icon Controls */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(set)}
                        className="p-1.5 text-text-muted hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                        title={t.shareWhatsApp}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateSet(set)}
                        className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title={t.duplicateSet}
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSetToEdit(set);
                          setIsSetEditorOpen(true);
                        }}
                        className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
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
                        className="p-1.5 text-text-muted hover:text-red-500 hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
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
          language={language}
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
          onLaunchGame={(gMode) => {
            setSelectedSetForMode(selectedSetForTeach);
            setActiveMode(gMode);
            setIsTeachModalOpen(false);
          }}
        />
      )}

      {isWordsModalOpen && selectedSetForWordsModal && (
        <LernstudioWordsModal
          isOpen={isWordsModalOpen}
          set={selectedSetForWordsModal}
          language={language}
          onClose={() => {
            setIsWordsModalOpen(false);
            setSelectedSetForWordsModal(null);
          }}
          onStartGames={() => {
            setSelectedSetForMode(selectedSetForWordsModal);
            setActiveMode('games_portal');
            setIsWordsModalOpen(false);
          }}
          onStartTeach={() => {
            setSelectedSetForTeach(selectedSetForWordsModal);
            setIsTeachModalOpen(true);
            setIsWordsModalOpen(false);
          }}
          onStartWorksheet={() => {
            setSelectedSetForWorksheet(selectedSetForWordsModal);
            setIsWorksheetModalOpen(true);
            setIsWordsModalOpen(false);
          }}
        />
      )}

    </div>
  );
};
