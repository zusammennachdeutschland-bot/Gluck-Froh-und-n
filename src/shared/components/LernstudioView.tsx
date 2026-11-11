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
import { LernstudioUltimateTicTacToeGame } from './games/LernstudioUltimateTicTacToeGame';
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
import { LernstudioGameSetupScreen, GameSetupConfig } from './LernstudioGameSetupScreen';
import { LernstudioSetEditorModal } from './LernstudioSetEditorModal';
import { LernstudioAiModal } from './LernstudioAiModal';
import { LernstudioWorksheetModal } from './LernstudioWorksheetModal';
import { LernstudioTeachModal } from './LernstudioTeachModal';
import { LernstudioWordsModal } from './LernstudioWordsModal';
import { LernstudioHomeworkModal } from './LernstudioHomeworkModal';
import { GameEffectsProvider } from './effects/GameEffectsOverlay';
import { getLernstudioTranslations, getLocalizedSetTitle, getLocalizedSetTopic, getLocalizedGrade, getLocalizedSetDescription, PROGRAM_GRADES, matchesGradeFilter } from '../../utils/lernstudioTranslations';
import { DEFAULT_LERNSTUDIO_SETS } from '../../data/defaultLernstudioSets';

const BUILTIN_SET_IDS = new Set(DEFAULT_LERNSTUDIO_SETS.map((s) => s.id));

export function isBuiltinLernstudioSet(set: Partial<LernstudioSet> | null | undefined): boolean {
  if (!set || !set.id) return false;
  return set.id.startsWith('curric_') || set.id.startsWith('set_def_') || BUILTIN_SET_IDS.has(set.id);
}

export type SetSourceFilter = 'all' | 'custom' | 'builtin';
import { CHILDREN_LEVEL_CATEGORIES } from '../../data/childrenTopicsPreset';
import { useApp } from '../../context/AppContext';
import {
  saveLernstudioSetToFirestore,
  deleteLernstudioSetFromFirestore,
  subscribeLernstudioSetsFromFirestore,
} from '../firebaseCloudSync';
import {
  subscribeAssignmentsFromFirestore,
  subscribeSubmissionsFromFirestore,
  subscribeTeacherAuth,
  getCurrentHomeworkOwnerUid,
  migrateLegacyHomeworkForAccount,
  backfillLegacyCloudHomeworkForAccount,
  saveLocalAssignment,
  saveLocalSubmission,
  getLocalAssignments,
  getHomeworkSummaryStats,
  isAssignmentDeletedLocally,
  sanitizeDocId
} from '../homeworkStorageSync';
import { RandomStudentPickerModal } from '../RandomStudentPickerModal';

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
  Check,
  Trash2,
  Archive,
  Edit3,
  Layers,
  Award,
  ChevronRight,
  BookOpen,
  Eye,
  Share2,
  Dices,
  Send,
  BarChart3,
  Bot,
  GraduationCap
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
  const { students } = useApp();
  const t = getLernstudioTranslations(language);

  // Cloud Firestore Real-time Sync
  const handleSaveSetWithCloud = (set: LernstudioSet) => {
    const isBuiltin = isBuiltinLernstudioSet(set);
    const enrichedSet: LernstudioSet = isBuiltin
      ? set
      : {
          ...set,
          createdByTeacherName: set.createdByTeacherName?.trim() || teacherName?.trim() || undefined,
          createdByUid: set.createdByUid?.trim() || activeAuthUid || undefined
        };
    onSaveSet(enrichedSet);
    saveLernstudioSetToFirestore(enrichedSet).catch(() => {});
  };

  const handleDeleteSetWithCloud = (setId: string) => {
    onDeleteSet(setId);
    deleteLernstudioSetFromFirestore(setId).catch(() => {});
  };

  const [activeAuthUid, setActiveAuthUid] = useState<string | null>(() => getCurrentHomeworkOwnerUid());

  React.useEffect(() => {
    if (!activeAuthUid) return;
    const unsub = subscribeLernstudioSetsFromFirestore((cloudSets) => {
      if (cloudSets.length > 0) {
        const localById = new Map<string, LernstudioSet>(sets.map((s) => [s.id, s]));
        cloudSets.forEach((cs) => {
          if (!cs || !cs.id || (cs as any).deleted) return;
          const existing = localById.get(cs.id);
          const localTime = Number(existing?.updatedAt) || 0;
          const cloudTime = Number(cs.updatedAt) || 0;
          if (!existing || cloudTime > localTime || (!existing.createdByTeacherName && cs.createdByTeacherName)) {
            onSaveSet({
              ...existing,
              ...cs,
              createdByTeacherName: cs.createdByTeacherName?.trim() || existing?.createdByTeacherName?.trim() || undefined,
              createdByUid: cs.createdByUid?.trim() || existing?.createdByUid?.trim() || undefined
            });
          }
        });
      }
    }, activeAuthUid);
    return () => unsub();
  }, [sets.length, activeAuthUid]);

  // Theme State
  const [currentThemeId, setCurrentThemeId] = useState<LernstudioThemeId>('neutral');
  const activeTheme = LERNSTUDIO_THEMES[currentThemeId];

  // Mode View State
  const [activeMode, setActiveMode] = useState<LernstudioGameMode>('hub');
  const [selectedSetForMode, setSelectedSetForMode] = useState<LernstudioSet | null>(null);
  const [gameSetupConfig, setGameSetupConfig] = useState<GameSetupConfig | null>(null);

  // Modals
  const [isSetEditorOpen, setIsSetEditorOpen] = useState(false);
  const [setToEdit, setSetToEdit] = useState<LernstudioSet | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isRandomPickerOpen, setIsRandomPickerOpen] = useState(false);

  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);
  const [selectedSetForWorksheet, setSelectedSetForWorksheet] = useState<LernstudioSet | null>(null);

  const [isTeachModalOpen, setIsTeachModalOpen] = useState(false);
  const [selectedSetForTeach, setSelectedSetForTeach] = useState<LernstudioSet | null>(null);

  const [isWordsModalOpen, setIsWordsModalOpen] = useState(false);
  const [selectedSetForWordsModal, setSelectedSetForWordsModal] = useState<LernstudioSet | null>(null);

  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState(false);
  const [selectedSetForHomework, setSelectedSetForHomework] = useState<LernstudioSet | null>(null);
  const [homeworkModalInitialTab, setHomeworkModalInitialTab] = useState<'create' | 'results'>('create');
  const studentsRef = React.useRef(students);
  React.useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  const [homeworkStats, setHomeworkStats] = useState<{ assignmentsCount: number; submissionsCount: number; inProgressCount: number }>(() =>
    getHomeworkSummaryStats(students)
  );

  React.useEffect(() => {
    const unsubAuth = subscribeTeacherAuth((user) => {
      const nextUid = user?.uid?.trim() || null;
      if (nextUid && user) {
        const migOpts = {
          uid: nextUid,
          email: user.email,
          ownedGroupIds: groups.map((g) => g.id),
          ownedSetIds: sets.map((s) => s.id),
          ownedStudentIds: (studentsRef.current || []).map((st) => st.id)
        };
        migrateLegacyHomeworkForAccount(migOpts);
        backfillLegacyCloudHomeworkForAccount(migOpts).catch(() => {});
      }
      setActiveAuthUid(nextUid);
      setHomeworkStats(getHomeworkSummaryStats(studentsRef.current));
    });
    return () => unsubAuth();
  }, [groups.length, sets.length]);

  // Real-time Firestore subscriptions & local event listeners for Homework Monitoring inside Lernstudio (strictly scoped by activeAuthUid)
  React.useEffect(() => {
    const refreshStats = () => {
      setHomeworkStats(getHomeworkSummaryStats(studentsRef.current));
    };

    refreshStats();

    if (!activeAuthUid) {
      window.addEventListener('gluck-homework-deleted', refreshStats);
      window.addEventListener('glueck-homework-sync-updated', refreshStats);
      return () => {
        window.removeEventListener('gluck-homework-deleted', refreshStats);
        window.removeEventListener('glueck-homework-sync-updated', refreshStats);
      };
    }

    const unsubHw = subscribeAssignmentsFromFirestore((cloudAssignments) => {
      cloudAssignments.forEach((hw) => {
        if (hw.ownerUid && hw.ownerUid !== activeAuthUid) return;
        if (!isAssignmentDeletedLocally(hw.id, activeAuthUid)) {
          saveLocalAssignment({ ...hw, ownerUid: activeAuthUid, cloudSynced: true }, false);
        }
      });
      refreshStats();
    }, activeAuthUid);

    const unsubSubs = subscribeSubmissionsFromFirestore(
      null,
      (cloudSubs) => {
        const activeIds = new Set(
          getLocalAssignments(activeAuthUid).flatMap((a) => [a.id, sanitizeDocId(a.id)])
        );
        cloudSubs.forEach((sub) => {
          if (sub.ownerUid && sub.ownerUid !== activeAuthUid) return;
          if (
            !isAssignmentDeletedLocally(sub.assignmentId, activeAuthUid) &&
            (activeIds.has(sub.assignmentId) || activeIds.has(sanitizeDocId(sub.assignmentId)))
          ) {
            saveLocalSubmission({ ...sub, ownerUid: activeAuthUid, cloudSynced: true }, false);
          }
        });
        refreshStats();
      },
      activeAuthUid
    );

    window.addEventListener('gluck-homework-deleted', refreshStats);
    window.addEventListener('glueck-homework-sync-updated', refreshStats);

    return () => {
      unsubHw();
      unsubSubs();
      window.removeEventListener('gluck-homework-deleted', refreshStats);
      window.removeEventListener('glueck-homework-sync-updated', refreshStats);
    };
  }, [activeAuthUid]);

  React.useEffect(() => {
    setHomeworkStats(getHomeworkSummaryStats(students));
  }, [isHomeworkModalOpen, students, activeAuthUid]);

  // Copy Set Code State
  const [copiedSetId, setCopiedSetId] = useState<string | null>(null);
  const [copiedSetMessage, setCopiedSetMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<SetSourceFilter>('all');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  const getEffectiveSetTeacherName = React.useCallback(
    (set: LernstudioSet): string => {
      if (!set || isBuiltinLernstudioSet(set)) return '';
      const explicitName = set.createdByTeacherName?.trim();
      if (explicitName) return explicitName;
      if (!set.createdByUid || (activeAuthUid && set.createdByUid === activeAuthUid)) {
        return teacherName?.trim() || '';
      }
      return '';
    },
    [teacherName, activeAuthUid]
  );

  // Dynamic counts for custom created sets vs ready-made built-in curriculum sets
  const { customSetsCount, builtinSetsCount } = useMemo(() => {
    let custom = 0;
    let builtin = 0;
    sets.forEach((s) => {
      if (!s || !s.id || s.isArchived) return;
      if (isBuiltinLernstudioSet(s)) {
        builtin++;
      } else {
        custom++;
      }
    });
    return { customSetsCount: custom, builtinSetsCount: builtin };
  }, [sets]);

  // Dynamic Creator Teachers from custom/shared sets
  const availableTeachers = useMemo(() => {
    const map = new Map<string, number>();
    sets.forEach((s) => {
      if (!s || !s.id || s.isArchived || isBuiltinLernstudioSet(s)) return;
      const tName = getEffectiveSetTeacherName(s);
      if (tName) {
        map.set(tName, (map.get(tName) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
  }, [sets, getEffectiveSetTeacherName]);

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

      const isBuiltin = isBuiltinLernstudioSet(set);
      const effectiveTeacher = getEffectiveSetTeacherName(set);

      // Deduplicate built-in sets by title, and custom sets by (title + creator teacher)
      const cleanTitleBase = (set.title || '').replace(/\((Copy|نسخة)\)/gi, '').trim().toLowerCase();
      const cleanTitleKey = isBuiltin
        ? cleanTitleBase
        : `${cleanTitleBase}::${effectiveTeacher.toLowerCase() || set.id}`;
      if (cleanTitleKey && seenTitles.has(cleanTitleKey)) {
        return false;
      }

      // Filter by Source (All / My Custom Sets / Built-in Ready Curriculum)
      const matchSource =
        selectedSourceFilter === 'all'
          ? true
          : selectedSourceFilter === 'custom'
          ? !isBuiltin
          : isBuiltin;

      // Filter by Creator Teacher Name
      const matchTeacher =
        selectedTeacherFilter === 'all'
          ? true
          : !isBuiltin && effectiveTeacher === selectedTeacherFilter;

      const matchGrade = matchesGradeFilter(set, selectedGradeFilter);
      const matchCategory = selectedCategoryFilter === 'all' || set.topic === selectedCategoryFilter;
      const matchGroup = selectedGroupFilter === 'all' || set.assignedGroupId === selectedGroupFilter;

      const q = searchTerm.trim().toLowerCase();
      const matchQuery =
        !q ||
        set.title.toLowerCase().includes(q) ||
        (set.topic && set.topic.toLowerCase().includes(q)) ||
        (set.grade && set.grade.toLowerCase().includes(q)) ||
        (effectiveTeacher && effectiveTeacher.toLowerCase().includes(q));

      if (matchSource && matchTeacher && matchGrade && matchCategory && matchGroup && matchQuery) {
        seenIds.add(set.id);
        if (cleanTitleKey) seenTitles.add(cleanTitleKey);
        return true;
      }
      return false;
    });
  }, [sets, selectedSourceFilter, selectedTeacherFilter, selectedGradeFilter, selectedCategoryFilter, selectedGroupFilter, searchTerm, getEffectiveSetTeacherName]);

  // Pagination State & Logic
  const ITEMS_PER_PAGE = 12;
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSourceFilter, selectedTeacherFilter, selectedGradeFilter, selectedCategoryFilter, selectedGroupFilter]);

  const totalPages = Math.ceil(filteredSets.length / ITEMS_PER_PAGE) || 1;
  const paginatedSets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSets, currentPage]);

  // Handlers
  const handleCopySetCode = (set: LernstudioSet) => {
    const creatorName = getEffectiveSetTeacherName(set);
    const setExportData = {
      title: set.title,
      topic: set.topic || 'ألماني',
      grade: set.grade || '',
      level: set.level || 'A1',
      difficulty: set.difficulty || 'medium',
      hasArticles: set.hasArticles !== false,
      sentenceBuilderSupported: set.sentenceBuilderSupported !== false,
      ...(creatorName ? { createdByTeacherName: creatorName } : {}),
      description: set.description || `مجموعة ${set.title}`,
      items: (set.items || []).map((it) => ({
        german: it.german,
        article: it.article || null,
        arabic: it.arabic,
        english: it.english || '',
        plural: it.plural || '',
        exampleSentenceGerman: it.exampleSentenceGerman || '',
        exampleSentenceArabic: it.exampleSentenceArabic || '',
        emoji: it.emoji || '',
        missingLetterWord: it.missingLetterWord || '',
        sentence4Elements: it.sentence4Elements || null
      })),
      customExercises: set.customExercises || []
    };

    const jsonString = JSON.stringify(setExportData, null, 2);

    try {
      navigator.clipboard.writeText(jsonString);
      setCopiedSetId(set.id);
      setCopiedSetMessage(
        language === 'ar'
          ? `تم نسخ كود مجموعة (${set.title}) إلى الحافظة بنجاح! يمكن للطرف الآخر لصقه مباشرة في خيار (استيراد ذكي / AI Import).`
          : `Set code for (${set.title}) copied to clipboard! Share it to paste in AI Import.`
      );
      setTimeout(() => {
        setCopiedSetId(null);
        setCopiedSetMessage(null);
      }, 4500);
    } catch (e) {
      console.warn('Clipboard write error', e);
    }
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

  const renderContent = () => {
    if (activeMode === 'games_portal' && selectedSetForMode) {
      return (
        <LernstudioGamesPortalView
          set={selectedSetForMode}
          activeTheme={activeTheme}
          language={language}
          onBack={() => {
            setActiveMode('hub');
            setGameSetupConfig(null);
          }}
          onSelectGame={(gMode) => {
            setActiveMode(gMode);
            setGameSetupConfig(null);
          }}
        />
      );
    }

    // GAME SETUP SCREEN INTERCEPTOR: Show Game Setup Screen for any selected game before starting
    // (ultimate_tictactoe has its own dedicated interactive Start Screen with 2P/AI Easy-Medium-Hard & Starter X/O/Random)
    if (
      activeMode !== 'hub' &&
      activeMode !== 'games_portal' &&
      activeMode !== 'ultimate_tictactoe' &&
      selectedSetForMode &&
      !gameSetupConfig
    ) {
      return (
        <LernstudioGameSetupScreen
          set={selectedSetForMode}
          gameModeId={activeMode}
          activeTheme={activeTheme}
          language={language}
          groups={groups}
          students={students}
          onStart={(config) => setGameSetupConfig(config)}
          onBack={() => {
            setActiveMode('games_portal');
            setGameSetupConfig(null);
          }}
        />
      );
    }

    if (activeMode === 'sentence_builder' && selectedSetForMode) {
      return (
        <LernstudioSentenceGame
          set={selectedSetForMode}
          activeTheme={activeTheme}
          language={language}
          initialMode="team"
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'solo_sentence' && selectedSetForMode) {
      return (
        <LernstudioSentenceGame
          set={selectedSetForMode}
          activeTheme={activeTheme}
          language={language}
          initialMode="solo"
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
          gameConfig={gameSetupConfig || undefined}
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

    if (activeMode === 'ultimate_tictactoe' && selectedSetForMode) {
      return (
        <LernstudioUltimateTicTacToeGame
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
          gameConfig={gameSetupConfig || undefined}
          onBack={() => setGameSetupConfig(null)}
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
      <div className="space-y-3 sm:space-y-4 pb-24 sm:pb-32" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {/* Top Header & Compact Action Row (Glück Standard) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <h2 className="text-sm sm:text-base font-black text-text-main flex items-center gap-1.5 sm:gap-2">
            <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <span>{t.hubTitle}</span>
          </h2>

          {/* Action Buttons in ONE Single Row - Icon-Only matching Glück's StudentsView / Dashboard */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 max-w-full">
            {/* 1. Add New Set (Primary Theme) */}
            <button
              type="button"
              onClick={() => {
                setSetToEdit(null);
                setIsSetEditorOpen(true);
              }}
              className="p-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-xs shrink-0"
              title={t.createSet}
              aria-label={t.createSet}
            >
              <Plus className="w-4 h-4 shrink-0 text-white" />
            </button>

            {/* 2. Random Student Picker */}
            <button
              type="button"
              onClick={() => setIsRandomPickerOpen(true)}
              className="p-2.5 bg-surface-hover hover:bg-surface border border-surface-border active:scale-95 text-text-main rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0"
              title={language === 'ar' ? 'عجلة اختيار طالب عشوائي للحصة' : language === 'de' ? 'Zufallsauswahl für die Stunde' : 'Pick random student for lesson'}
              aria-label={language === 'ar' ? 'عجلة اختيار طالب عشوائي للحصة' : 'Random Student Picker'}
            >
              <Dices className="w-4 h-4 shrink-0 text-primary" />
            </button>

            {/* 3. AI Import / Generator */}
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="p-2.5 bg-surface-hover hover:bg-surface border border-surface-border active:scale-95 text-text-main rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0"
              title={t.aiImport}
              aria-label={t.aiImport}
            >
              <Bot className="w-4 h-4 shrink-0 text-primary" />
            </button>

            {/* 4. Create Homework */}
            <button
              type="button"
              onClick={() => {
                setSelectedSetForHomework(null);
                setHomeworkModalInitialTab('create');
                setIsHomeworkModalOpen(true);
              }}
              className="p-2.5 bg-surface-hover hover:bg-surface border border-surface-border active:scale-95 text-text-main rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0"
              title={language === 'ar' ? 'إنشاء واجب جديد للطلاب' : 'Hausaufgabe erstellen'}
              aria-label={language === 'ar' ? 'إنشاء واجب جديد للطلاب' : 'Hausaufgabe erstellen'}
            >
              <Send className="w-4 h-4 shrink-0 text-primary" />
            </button>

            {/* 5. Homework Monitoring Dashboard (Direct Access in Main App) */}
            <button
              type="button"
              onClick={() => {
                setSelectedSetForHomework(null);
                setHomeworkModalInitialTab('results');
                setIsHomeworkModalOpen(true);
              }}
              className="px-2.5 py-2 bg-surface-hover hover:bg-surface border border-surface-border active:scale-95 text-text-main rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 relative"
              title={language === 'ar' ? 'متابعة الواجبات ونتائج الطلاب لحظياً' : 'Hausaufgaben-Monitoring'}
              aria-label={language === 'ar' ? 'متابعة الواجبات ونتائج الطلاب لحظياً' : 'Hausaufgaben-Monitoring'}
            >
              <BarChart3 className="w-4 h-4 shrink-0 text-primary" />
              <span className="text-xs font-bold hidden sm:inline">
                {language === 'ar' ? 'متابعة الواجبات' : 'Monitoring'}
              </span>
              {(homeworkStats.submissionsCount > 0 || homeworkStats.inProgressCount > 0) && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums flex items-center gap-1 ${
                    homeworkStats.inProgressCount > 0
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {homeworkStats.inProgressCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  )}
                  {homeworkStats.submissionsCount + homeworkStats.inProgressCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Source Filter Segment Switcher Tabs (Glück Standard) */}
        <div className="grid grid-cols-3 gap-1 bg-surface-hover p-1 rounded-lg text-[10.5px] sm:text-xs font-bold border border-surface-border">
          <button
            type="button"
            onClick={() => setSelectedSourceFilter('all')}
            className={`py-1 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              selectedSourceFilter === 'all'
                ? 'bg-surface text-primary shadow-xs border border-surface-border'
                : 'text-text-muted hover:text-text-main hover:bg-surface/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>{language === 'ar' ? 'الكل' : language === 'de' ? 'Alle Sets' : 'All Sets'}</span>
            <span className="opacity-75 tabular-nums">({sets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSourceFilter('custom')}
            className={`py-1 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              selectedSourceFilter === 'custom'
                ? 'bg-surface text-primary shadow-xs border border-surface-border'
                : 'text-text-muted hover:text-text-main hover:bg-surface/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>{language === 'ar' ? 'مجموعاتي الخاصة' : language === 'de' ? 'Meine Sets' : 'Custom'}</span>
            <span className="opacity-75 tabular-nums">({customSetsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSourceFilter('builtin')}
            className={`py-1 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              selectedSourceFilter === 'builtin'
                ? 'bg-surface text-primary shadow-xs border border-surface-border'
                : 'text-text-muted hover:text-text-main hover:bg-surface/50'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span>{language === 'ar' ? 'المنهاج الجاهز' : language === 'de' ? 'Lehrplan' : 'Curriculum'}</span>
            <span className="opacity-75 tabular-nums">({builtinSetsCount})</span>
          </button>
        </div>

        {/* Compact Filters Bar */}
        <div className="p-3 bg-surface border border-surface-border rounded-xl space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2.5">
          <div className="relative flex-1 w-full min-w-0">
            <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-text-muted ${language === 'ar' ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchPlaceholder}
              className={`w-full py-2 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary truncate ${
                language === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 w-full sm:w-auto shrink-0 min-w-0">
            <select
              value={selectedSourceFilter}
              onChange={(e) => setSelectedSourceFilter(e.target.value as SetSourceFilter)}
              className="w-full sm:w-auto px-2.5 py-1.5 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary min-w-0 truncate cursor-pointer"
            >
              <option value="all">🏷️ {language === 'ar' ? 'المصدر: الكل' : language === 'de' ? 'Quelle: Alle' : 'Source: All'} ({sets.length})</option>
              <option value="custom">✍️ {language === 'ar' ? 'مجموعات المعلمين' : language === 'de' ? 'Lehrer-Sets' : 'Teacher Sets'} ({customSetsCount})</option>
              <option value="builtin">🇩🇪 {language === 'ar' ? 'المناهج الجاهزة' : language === 'de' ? 'Lehrplan-Sets' : 'Curriculum Sets'} ({builtinSetsCount})</option>
            </select>

            <select
              value={selectedTeacherFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTeacherFilter(val);
                if (val !== 'all' && selectedSourceFilter === 'builtin') {
                  setSelectedSourceFilter('all');
                }
              }}
              className="w-full sm:w-auto px-2.5 py-1.5 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary min-w-0 truncate cursor-pointer"
            >
              <option value="all">
                👨‍🏫 {language === 'ar' ? 'المعلم: الكل' : language === 'de' ? 'Lehrer: Alle' : 'Teacher: All'}
                {availableTeachers.length > 0 ? ` (${availableTeachers.length})` : ''}
              </option>
              {availableTeachers.map((tItem) => (
                <option key={tItem.name} value={tItem.name}>
                  أ. {tItem.name} ({tItem.count})
                </option>
              ))}
            </select>

            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary min-w-0 truncate cursor-pointer"
            >
              <option value="all">🎓 {t.allEducationalLevels} ({sets.length})</option>
              {PROGRAM_GRADES.map((g) => (
                <option key={g.id} value={g.id}>
                  {language === 'ar' ? g.labelAr : language === 'de' ? g.labelDe : g.labelEn}
                </option>
              ))}
            </select>

            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary min-w-0 truncate cursor-pointer"
            >
              <option value="all">📁 {t.allTopicsAndCategories} ({availableCategories.length})</option>
              {availableCategories.map((item) => (
                <option key={item.cat} value={item.cat}>
                  {getLocalizedSetTopic({ topic: item.cat }, language)} ({item.count})
                </option>
              ))}
            </select>

            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary min-w-0 truncate cursor-pointer"
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

        {/* Quick Creator Teacher Filter Strip */}
        {availableTeachers.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] font-bold text-text-muted shrink-0">
              {language === 'ar' ? '👨‍🏫 فلتر المعلم:' : language === 'de' ? '👨‍🏫 Lehrer:' : '👨‍🏫 Teacher:'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedTeacherFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer transition-all border ${
                selectedTeacherFilter === 'all'
                  ? 'bg-primary text-white border-primary shadow-2xs'
                  : 'bg-surface hover:bg-surface-hover text-text-muted border-surface-border'
              }`}
            >
              {language === 'ar' ? 'الكل' : language === 'de' ? 'Alle' : 'All'}
            </button>
            {availableTeachers.map((tItem) => {
              const active = selectedTeacherFilter === tItem.name;
              return (
                <button
                  key={tItem.name}
                  type="button"
                  onClick={() => {
                    setSelectedTeacherFilter(active ? 'all' : tItem.name);
                    if (!active && selectedSourceFilter === 'builtin') {
                      setSelectedSourceFilter('all');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer transition-all border flex items-center gap-1 ${
                    active
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border'
                  }`}
                >
                  <span>أ. {tItem.name}</span>
                  <span className="opacity-75 tabular-nums">({tItem.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Unboxed Metadata Line (Glück Zero-Pill Discipline) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-xs text-text-muted tabular-nums">
          <div className="flex flex-wrap items-center gap-1.5">
            <span>
              {language === 'ar' ? 'المجموعات:' : 'Sets:'}{' '}
              <strong className="text-text-main font-bold">{sets.length}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {language === 'ar' ? 'المفردات:' : 'Vocabulary:'}{' '}
              <strong className="text-text-main font-bold">{sets.reduce((acc, s) => acc + (s.items?.length || 0), 0)}</strong>
            </span>
            {filteredSets.length !== sets.length && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {language === 'ar' ? 'المعروض:' : 'Filtered:'}{' '}
                  <strong className="text-primary font-bold">{filteredSets.length}</strong>
                </span>
              </>
            )}
          </div>
          {(selectedSourceFilter !== 'all' || selectedTeacherFilter !== 'all' || selectedGradeFilter !== 'all' || selectedCategoryFilter !== 'all' || searchTerm || selectedGroupFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedSourceFilter('all');
                setSelectedTeacherFilter('all');
                setSelectedGradeFilter('all');
                setSelectedCategoryFilter('all');
                setSelectedGroupFilter('all');
                setSearchTerm('');
              }}
              className="text-xs text-primary hover:underline font-bold cursor-pointer"
            >
              {t.resetFilters}
            </button>
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedSets.map((set) => {
                const itemCount = set.items?.length || 0;
                const assignedGroup = groups.find((g) => g.id === set.assignedGroupId);
                const isCustom = !isBuiltinLernstudioSet(set);
                const creatorTeacher = getEffectiveSetTeacherName(set);

                return (
                  <div
                    key={set.id}
                    className="p-3.5 sm:p-4 rounded-xl border border-surface-border bg-surface hover:border-primary/40 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between space-y-3 group max-w-full overflow-hidden"
                  >
                    <div className="space-y-2.5 min-w-0 max-w-full">
                      {/* Zero-Pill Unboxed Metadata Header */}
                      <div className="flex items-center justify-between gap-1.5 text-xs text-text-muted tabular-nums flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium min-w-0 flex-wrap">
                          <span className="font-bold text-primary">{itemCount} {t.vocabularyCount}</span>
                          {set.grade && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate max-w-[140px] sm:max-w-none text-text-main font-semibold">
                                {getLocalizedGrade(set.grade, language)}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-text-muted">
                            {isCustom
                              ? creatorTeacher
                                ? `👨‍🏫 أ. ${creatorTeacher}`
                                : (language === 'ar' ? 'مجموعتي الخاصة' : language === 'de' ? 'Mein Set' : 'Custom')
                              : (language === 'ar' ? 'منهاج جاهز' : language === 'de' ? 'Lehrplan' : 'Curriculum')}
                          </span>
                        </div>

                        {assignedGroup && (
                          <span className="text-[10px] font-bold text-text-muted truncate max-w-[120px]">
                            {assignedGroup.name}
                          </span>
                        )}
                      </div>

                      <div
                        onClick={() => {
                          setSelectedSetForWordsModal(set);
                          setIsWordsModalOpen(true);
                        }}
                        className="space-y-1 cursor-pointer group/title p-1 -m-1 rounded-lg hover:bg-surface-hover/50 transition-colors min-w-0 max-w-full overflow-hidden"
                      >
                        <h3 className="text-sm sm:text-base font-bold text-text-main group-hover/title:text-primary transition-colors leading-snug flex items-start justify-between gap-2 min-w-0">
                          <span className="line-clamp-2 break-words flex-1 min-w-0">{getLocalizedSetTitle(set, language)}</span>
                          <Eye className="w-3.5 h-3.5 text-text-muted opacity-40 group-hover/title:opacity-100 group-hover/title:text-primary transition-all shrink-0 mt-0.5" />
                        </h3>
                        {set.description && (
                          <p className="text-xs text-text-muted line-clamp-2 leading-relaxed break-words">
                            {getLocalizedSetDescription(set, language)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-surface-border space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSetForMode(set);
                          setActiveMode('games_portal');
                        }}
                        className="w-full py-2 px-3 rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover active:scale-95 text-white transition-all"
                      >
                        <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.playGame}</span>
                      </button>

                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSetForTeach(set);
                              setIsTeachModalOpen(true);
                            }}
                            className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-hover text-text-main border border-surface-border rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-all truncate"
                          >
                            <BookOpen className="w-3.5 h-3.5 shrink-0 text-primary" />
                            <span className="truncate">{t.teachMode}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSetForWorksheet(set);
                              setIsWorksheetModalOpen(true);
                            }}
                            className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-all truncate"
                          >
                            <Printer className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <span className="truncate">{t.printWorksheet}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSetForHomework(set);
                              setHomeworkModalInitialTab('create');
                              setIsHomeworkModalOpen(true);
                            }}
                            className="p-1.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main hover:text-primary rounded-lg transition-colors cursor-pointer shrink-0"
                            title={language === 'ar' ? 'إنشاء واجب تفاعلي لهذه المجموعة' : 'Hausaufgabe für dieses Set erstellen'}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

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
                            onClick={() => handleCopySetCode(set)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
                              copiedSetId === set.id
                                ? 'text-emerald-500 bg-emerald-500/10'
                                : 'text-text-muted hover:text-primary hover:bg-surface-hover'
                            }`}
                            title={
                              copiedSetId === set.id
                                ? (language === 'ar' ? 'تم نسخ كود المجموعة!' : 'Set Code Copied!')
                                : (language === 'ar' ? 'نسخ كود المجموعة (JSON) للمشاركة والاستيراد' : 'Copy Set Code (JSON)')
                            }
                          >
                            {copiedSetId === set.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500 animate-bounce" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
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
                                handleDeleteSetWithCloud(set.id);
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-surface-border shadow-2xs mt-4">
                <span className="text-xs text-text-muted font-bold">
                  {language === 'ar' ? `الصفحة ${currentPage} من ${totalPages}` : language === 'de' ? `Seite ${currentPage} von ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage === 1}
                    className="px-3.5 py-2 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-xs font-bold text-text-main disabled:opacity-40 cursor-pointer transition-all"
                  >
                    {language === 'ar' ? 'السابق' : language === 'de' ? 'Zurück' : 'Previous'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage === totalPages}
                    className="px-3.5 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold disabled:opacity-40 cursor-pointer transition-all shadow-xs"
                  >
                    {language === 'ar' ? 'التالي' : language === 'de' ? 'Weiter' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        {isSetEditorOpen && (
          <LernstudioSetEditorModal
            isOpen={isSetEditorOpen}
            setToEdit={setToEdit}
            groups={groups}
            teacherName={teacherName}
            onClose={() => setIsSetEditorOpen(false)}
            onSaveSet={handleSaveSetWithCloud}
          />
        )}

        {isAiModalOpen && (
          <LernstudioAiModal
            isOpen={isAiModalOpen}
            teacherName={teacherName}
            language={language}
            onClose={() => setIsAiModalOpen(false)}
            onImportSet={handleSaveSetWithCloud}
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

        <RandomStudentPickerModal
          isOpen={isRandomPickerOpen}
          onClose={() => setIsRandomPickerOpen(false)}
          students={students}
          groups={groups}
        />

        <LernstudioHomeworkModal
          isOpen={isHomeworkModalOpen}
          onClose={() => {
            setIsHomeworkModalOpen(false);
            setSelectedSetForHomework(null);
          }}
          sets={sets}
          defaultSet={selectedSetForHomework}
          initialTab={homeworkModalInitialTab}
          language={language}
        />

        {/* Toast Notification Banner for Copied Set Code */}
        {copiedSetMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] bg-slate-900 text-white border border-emerald-500/50 shadow-2xl px-5 py-3.5 rounded-2xl flex items-center gap-3 animate-scale-up max-w-lg w-[92vw]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold leading-relaxed flex-1">
              {copiedSetMessage}
            </div>
            <button
              type="button"
              onClick={() => setCopiedSetMessage(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <GameEffectsProvider>
      {renderContent()}
    </GameEffectsProvider>
  );
};
