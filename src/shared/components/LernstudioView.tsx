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
import { auth } from '../firebaseCloudSync';
import {
  subscribeTeacherAuth,
  getCurrentHomeworkOwnerUid,
  migrateLegacyHomeworkForAccount,
  backfillLegacyCloudHomeworkForAccount,
  getHomeworkSummaryStats
} from '../homeworkStorageSync';
import { RandomStudentPickerModal } from '../RandomStudentPickerModal';
import { speakGermanText } from '../../utils/audioSpeechUtils';
import {
  ALL_VERBS,
  ALL_VERB_CLASSIFICATIONS,
  ALL_VERB_TOPIC_TAGS,
  BUILTIN_VERB_GROUPS,
  buildLernstudioSetFromVerbs,
  filterVerbs,
  resolveVerbsFromSelection
} from '../verbEngine';
import {
  createCustomVerbGroup,
  extractVerbGroupsFromLernstudioSets,
  forkBuiltinVerbGroup,
  hydrateVerbGroupSet,
  isVerbGroupSet,
  updateCustomVerbGroup,
  verbGroupToLernstudioSet
} from '../verbGroupSync';
import type {
  VerbClassification,
  VerbEntry,
  VerbGroupCategory,
  VerbGroupDefinition,
  VerbLevel,
  VerbTopicTag
} from '../verbLibrary/verbTypes';

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
  GraduationCap,
  Volume2,
  X
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

  // Local CRUD for Lernstudio sets (synced exclusively via P2P; homework uses embedded setSnapshot)
  const handleSaveSetWithCloud = (set: LernstudioSet) => {
    const isBuiltin = isBuiltinLernstudioSet(set);
    const fallbackTeacherName =
      teacherName?.trim() || auth?.currentUser?.displayName?.trim() || undefined;
    const enrichedSet: LernstudioSet = isBuiltin
      ? set
      : {
          ...set,
          createdByTeacherName: set.createdByTeacherName?.trim() || fallbackTeacherName,
          createdByUid: set.createdByUid?.trim() || activeAuthUid || undefined
        };
    onSaveSet(enrichedSet);
  };

  const handleDeleteSetWithCloud = (setId: string) => {
    onDeleteSet(setId);
  };

  const [activeAuthUid, setActiveAuthUid] = useState<string | null>(() => getCurrentHomeworkOwnerUid());

  // Automatically backfill and fix createdByTeacherName on any local custom sets created by this teacher that lack it
  const backfilledSetIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const resolvedMyName =
      teacherName?.trim() || auth?.currentUser?.displayName?.trim() || '';
    if (!resolvedMyName) return;

    sets.forEach((s) => {
      if (!s || !s.id || s.isArchived || isBuiltinLernstudioSet(s)) return;
      if (s.createdByTeacherName?.trim()) return;
      if (s.createdByUid && activeAuthUid && s.createdByUid !== activeAuthUid) return;
      if (backfilledSetIdsRef.current.has(s.id)) return;

      backfilledSetIdsRef.current.add(s.id);
      const stamped: LernstudioSet = {
        ...s,
        createdByTeacherName: resolvedMyName,
        ...(s.createdByUid || activeAuthUid ? { createdByUid: s.createdByUid || activeAuthUid || undefined } : {})
      };
      onSaveSet(stamped);
    });
  }, [sets, teacherName, activeAuthUid]);

  const setsRef = React.useRef<LernstudioSet[]>(sets);
  React.useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

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
  const groupsRef = React.useRef(groups);
  const backfilledUidsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    studentsRef.current = students;
  }, [students]);
  React.useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  const [homeworkStats, setHomeworkStats] = useState<{ assignmentsCount: number; submissionsCount: number; inProgressCount: number }>(() =>
    getHomeworkSummaryStats(students)
  );

  React.useEffect(() => {
    const unsubAuth = subscribeTeacherAuth((user) => {
      const nextUid = user?.uid?.trim() || null;
      if (nextUid && user && !backfilledUidsRef.current.has(nextUid)) {
        const storageDoneKey = `gluck_hw_cloud_backfilled_uid_${nextUid}`;
        let alreadyBackfilled = false;
        try {
          alreadyBackfilled = localStorage.getItem(storageDoneKey) === '1';
        } catch {
          alreadyBackfilled = false;
        }
        const migOpts = {
          uid: nextUid,
          email: user.email,
          ownedGroupIds: (groupsRef.current || []).map((g) => g.id),
          ownedSetIds: (setsRef.current || []).map((s) => s.id),
          ownedStudentIds: (studentsRef.current || []).map((st) => st.id)
        };
        migrateLegacyHomeworkForAccount(migOpts);
        backfilledUidsRef.current.add(nextUid);
        if (!alreadyBackfilled) {
          backfillLegacyCloudHomeworkForAccount(migOpts)
            .then(() => {
              try {
                localStorage.setItem(storageDoneKey, '1');
              } catch {
                // Ignore storage errors
              }
            })
            .catch(() => {});
        }
      }
      setActiveAuthUid(nextUid);
      setHomeworkStats(getHomeworkSummaryStats(studentsRef.current));
    });
    return () => unsubAuth();
  }, []);

  // Local event listeners for Homework Monitoring inside Lernstudio (cloud reads happen on-demand inside LernstudioHomeworkModal)
  React.useEffect(() => {
    const refreshStats = () => {
      setHomeworkStats(getHomeworkSummaryStats(studentsRef.current));
    };

    refreshStats();
    window.addEventListener('gluck-homework-deleted', refreshStats);
    window.addEventListener('glueck-homework-sync-updated', refreshStats);

    return () => {
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

  // Hub Library Switcher: Vocabulary Sets vs Verb Library (2,206) vs Verb Groups
  const [hubSection, setHubSection] = useState<'vocab' | 'verb_library' | 'verb_groups'>('vocab');

  // Verb Library Browser State
  const [verbSearch, setVerbSearch] = useState('');
  const [verbLevelFilter, setVerbLevelFilter] = useState<'all' | VerbLevel>('all');
  const [verbClassFilter, setVerbClassFilter] = useState<'all' | VerbClassification>('all');
  const [verbTopicFilter, setVerbTopicFilter] = useState<'all' | VerbTopicTag>('all');
  const [verbPage, setVerbPage] = useState(1);
  const [expandedVerbId, setExpandedVerbId] = useState<string | null>(null);
  const [selectedVerbIds, setSelectedVerbIds] = useState<string[]>([]);

  // Verb Groups State (built-in + cross-teacher custom/forked groups)
  const [verbGroupCategoryFilter, setVerbGroupCategoryFilter] = useState<'all' | VerbGroupCategory>('all');
  const [verbGroupSearch, setVerbGroupSearch] = useState('');
  const [selectedVerbGroupIds, setSelectedVerbGroupIds] = useState<string[]>([]);

  // Verb Group Editor Modal State (Create New / Non-Destructive Fork / Edit Custom)
  const [verbGroupEditor, setVerbGroupEditor] = useState<{
    mode: 'create' | 'fork' | 'edit';
    existingGroup?: VerbGroupDefinition;
    sourceBuiltinId?: string;
    titleDe: string;
    titleAr: string;
    descriptionAr: string;
    creatorTeacherName: string;
    verbIds: string[];
  } | null>(null);
  const [editorVerbSearch, setEditorVerbSearch] = useState('');
  const [editorVerbLevel, setEditorVerbLevel] = useState<'all' | VerbLevel>('all');

  const resolvedCreatorName =
    teacherName?.trim() || auth?.currentUser?.displayName?.trim() || 'المعلم';

  const customVerbGroups = useMemo(() => extractVerbGroupsFromLernstudioSets(sets), [sets]);

  const verbLibraryCounts = useMemo(() => {
    let a1 = 0;
    let a2 = 0;
    let b1 = 0;
    for (const v of ALL_VERBS) {
      if (v.level === 'A1') a1++;
      else if (v.level === 'A2') a2++;
      else b1++;
    }
    return { total: ALL_VERBS.length, a1, a2, b1 };
  }, []);

  const filteredVerbs = useMemo(
    () =>
      filterVerbs({
        levels: verbLevelFilter === 'all' ? undefined : [verbLevelFilter],
        classifications: verbClassFilter === 'all' ? undefined : [verbClassFilter],
        topics: verbTopicFilter === 'all' ? undefined : [verbTopicFilter],
        searchQuery: verbSearch
      }),
    [verbLevelFilter, verbClassFilter, verbTopicFilter, verbSearch]
  );

  const VERBS_PER_PAGE = 30;
  const totalVerbPages = Math.max(1, Math.ceil(filteredVerbs.length / VERBS_PER_PAGE));
  const paginatedVerbs = useMemo(() => {
    const safePage = Math.min(verbPage, totalVerbPages);
    const start = (safePage - 1) * VERBS_PER_PAGE;
    return filteredVerbs.slice(start, start + VERBS_PER_PAGE);
  }, [filteredVerbs, verbPage, totalVerbPages]);

  React.useEffect(() => {
    setVerbPage(1);
  }, [verbLevelFilter, verbClassFilter, verbTopicFilter, verbSearch]);

  const editorCandidateVerbs = useMemo(
    () =>
      filterVerbs({
        levels: editorVerbLevel === 'all' ? undefined : [editorVerbLevel],
        searchQuery: editorVerbSearch
      }).slice(0, 60),
    [editorVerbLevel, editorVerbSearch]
  );

  const filteredVerbGroups = useMemo(() => {
    const q = verbGroupSearch.trim().toLowerCase();
    const combined: VerbGroupDefinition[] = [...customVerbGroups, ...BUILTIN_VERB_GROUPS];
    return combined.filter((g) => {
      if (verbGroupCategoryFilter !== 'all' && g.category !== verbGroupCategoryFilter) return false;
      if (!q) return true;
      return (
        g.titleDe.toLowerCase().includes(q) ||
        g.titleAr.toLowerCase().includes(q) ||
        (g.createdByTeacherName || '').toLowerCase().includes(q)
      );
    });
  }, [customVerbGroups, verbGroupCategoryFilter, verbGroupSearch]);

  // Filters (Vocabulary Sets tab excludes vgrp_* verb groups so the two libraries stay clearly separated)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<SetSourceFilter>('all');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  const vocabSets = useMemo(
    () => sets.filter((s) => s && s.id && !s.isArchived && !isVerbGroupSet(s)),
    [sets]
  );

  const getEffectiveSetTeacherName = React.useCallback(
    (set: LernstudioSet): string => {
      if (!set || isBuiltinLernstudioSet(set)) return '';
      const explicitName = set.createdByTeacherName?.trim();
      if (explicitName) return explicitName;
      if (!set.createdByUid || (activeAuthUid && set.createdByUid === activeAuthUid)) {
        return teacherName?.trim() || auth?.currentUser?.displayName?.trim() || '';
      }
      return '';
    },
    [teacherName, activeAuthUid]
  );

  // Dynamic counts for custom created sets vs ready-made built-in curriculum sets
  const { customSetsCount, builtinSetsCount } = useMemo(() => {
    let custom = 0;
    let builtin = 0;
    vocabSets.forEach((s) => {
      if (isBuiltinLernstudioSet(s)) {
        builtin++;
      } else {
        custom++;
      }
    });
    return { customSetsCount: custom, builtinSetsCount: builtin };
  }, [vocabSets]);

  // Dynamic Creator Teachers from custom/shared sets
  const availableTeachers = useMemo(() => {
    const map = new Map<string, number>();
    vocabSets.forEach((s) => {
      if (isBuiltinLernstudioSet(s)) return;
      const tName = getEffectiveSetTeacherName(s);
      if (tName) {
        map.set(tName, (map.get(tName) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
  }, [vocabSets, getEffectiveSetTeacherName]);

  // Dynamic Categories from available sets
  const availableCategories = useMemo(() => {
    const map = new Map<string, number>();
    vocabSets.forEach((s) => {
      const cat = s.topic || 'عام';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([cat, count]) => ({ cat, count }))
      .sort((a, b) => a.cat.localeCompare(b.cat));
  }, [vocabSets]);

  // Filtered Sets (with Deduplication Protection)
  const filteredSets = useMemo(() => {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    return vocabSets.filter((set) => {
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
  }, [vocabSets, selectedSourceFilter, selectedTeacherFilter, selectedGradeFilter, selectedCategoryFilter, selectedGroupFilter, searchTerm, getEffectiveSetTeacherName]);

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

  // Hydrate vgrp_* sets & merge extraVerbGroupIds when entering a game
  const hydratedSelectedSet = useMemo(() => {
    if (!selectedSetForMode) return null;
    return isVerbGroupSet(selectedSetForMode)
      ? hydrateVerbGroupSet(selectedSetForMode)
      : selectedSetForMode;
  }, [selectedSetForMode]);

  const effectiveSetForMode = useMemo(() => {
    if (!hydratedSelectedSet) return null;
    let workingSet = hydratedSelectedSet;

    if (gameSetupConfig?.extraVerbGroupIds && gameSetupConfig.extraVerbGroupIds.length > 0) {
      const extraVerbs = resolveVerbsFromSelection({
        groupIds: gameSetupConfig.extraVerbGroupIds,
        customGroups: customVerbGroups
      });
      if (extraVerbs.length > 0) {
        const merged = buildLernstudioSetFromVerbs({
          id: `${workingSet.id}_mixed`,
          title: `${workingSet.title} + Verben`,
          titleAr: workingSet.titleTranslations?.ar
            ? `${workingSet.titleTranslations.ar} + أفعال`
            : `${workingSet.title} + أفعال`,
          verbs: extraVerbs,
          level: workingSet.level,
          topic: workingSet.topic,
          extraVocabItems: workingSet.items || [],
          setKind: 'mixed'
        });
        workingSet = {
          ...merged,
          hasArticles: workingSet.hasArticles,
          sentenceBuilderSupported: workingSet.sentenceBuilderSupported
        };
      }
    }

    if (gameSetupConfig?.questionCount && workingSet.items.length > gameSetupConfig.questionCount) {
      const cap = Math.max(4, gameSetupConfig.questionCount);
      const sampled = [...workingSet.items].sort(() => 0.5 - Math.random()).slice(0, cap);
      workingSet = {
        ...workingSet,
        items: sampled
      };
    }

    return workingSet;
  }, [hydratedSelectedSet, gameSetupConfig, customVerbGroups]);

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
      ...(set.setKind ? { setKind: set.setKind } : {}),
      ...(set.verbIds ? { verbIds: set.verbIds } : {}),
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
        sentence4Elements: it.sentence4Elements || null,
        ...(it.wordType ? { wordType: it.wordType } : {}),
        ...(it.conjugation ? { conjugation: it.conjugation } : {}),
        ...(it.verbId ? { verbId: it.verbId } : {}),
        ...(it.classifications ? { classifications: it.classifications } : {}),
        ...(it.separablePrefix ? { separablePrefix: it.separablePrefix } : {}),
        ...(it.preposition ? { preposition: it.preposition } : {}),
        ...(it.prepositionCase ? { prepositionCase: it.prepositionCase } : {})
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
    const activeGameSet = effectiveSetForMode || hydratedSelectedSet || selectedSetForMode;

    if (activeMode === 'games_portal' && (hydratedSelectedSet || selectedSetForMode)) {
      return (
        <LernstudioGamesPortalView
          set={(hydratedSelectedSet || selectedSetForMode)!}
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
      (hydratedSelectedSet || selectedSetForMode) &&
      !gameSetupConfig
    ) {
      return (
        <LernstudioGameSetupScreen
          set={(hydratedSelectedSet || selectedSetForMode)!}
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

    if (activeMode === 'sentence_builder' && activeGameSet) {
      return (
        <LernstudioSentenceGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          initialMode="team"
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'solo_sentence' && activeGameSet) {
      return (
        <LernstudioSentenceGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          initialMode="solo"
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'game' && activeGameSet) {
      return (
        <LernstudioGameRunner
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          gameConfig={gameSetupConfig || undefined}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'classroom' && activeGameSet) {
      return (
        <LernstudioClassroomBoard
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          gameConfig={gameSetupConfig || undefined}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'wheel' && activeGameSet) {
      return (
        <LernstudioWheelGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          gameConfig={gameSetupConfig || undefined}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'race' && activeGameSet) {
      return (
        <LernstudioRaceGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          gameConfig={gameSetupConfig || undefined}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'memory' && activeGameSet) {
      return (
        <LernstudioMemoryGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'sorting' && activeGameSet) {
      return (
        <LernstudioSortingGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'balloon_pop' && activeGameSet) {
      return (
        <LernstudioBalloonPopGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'tictactoe' && activeGameSet) {
      return (
        <LernstudioTicTacToeGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'ultimate_tictactoe' && activeGameSet) {
      return (
        <LernstudioUltimateTicTacToeGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'basket_catch' && activeGameSet) {
      return (
        <LernstudioBasketCatchGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'tug_of_war' && activeGameSet) {
      return (
        <LernstudioTugOfWarGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'word_ninja' && activeGameSet) {
      return (
        <LernstudioWordNinjaGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'space_defense' && activeGameSet) {
      return (
        <LernstudioSpaceDefenseGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'whack_a_mole' && activeGameSet) {
      return (
        <LernstudioWhackAMoleGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'word_detective' && activeGameSet) {
      return (
        <LernstudioWordDetectiveGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'bridge_builder' && activeGameSet) {
      return (
        <LernstudioBridgeBuilderGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'color_master' && activeGameSet) {
      return (
        <LernstudioColorMasterGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'factory_machine' && activeGameSet) {
      return (
        <LernstudioFactoryMachineGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'follow_clues' && activeGameSet) {
      return (
        <LernstudioFollowCluesGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'island_crossing' && activeGameSet) {
      return (
        <LernstudioIslandCrossingGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'pit_stop' && activeGameSet) {
      return (
        <LernstudioPitStopGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'puzzle_masters' && activeGameSet) {
      return (
        <LernstudioPuzzleMastersGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'robot_repair' && activeGameSet) {
      return (
        <LernstudioRobotRepairGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'rocket_countdown' && activeGameSet) {
      return (
        <LernstudioRocketCountdownGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'space_fleet' && activeGameSet) {
      return (
        <LernstudioSpaceFleetGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'submarine_explore' && activeGameSet) {
      return (
        <LernstudioSubmarineGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'target_attack' && activeGameSet) {
      return (
        <LernstudioTargetAttackGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'team_auction' && activeGameSet) {
      return (
        <LernstudioTeamAuctionGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'tower_architects' && activeGameSet) {
      return (
        <LernstudioTowerArchitectsGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'vending_machine' && activeGameSet) {
      return (
        <LernstudioVendingMachineGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'whats_in_box' && activeGameSet) {
      return (
        <LernstudioWhatsInTheBoxGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          gameConfig={gameSetupConfig || undefined}
          onBack={() => setGameSetupConfig(null)}
        />
      );
    }

    if (activeMode === 'word_rhythm' && activeGameSet) {
      return (
        <LernstudioWordRhythmGame
          set={activeGameSet}
          activeTheme={activeTheme}
          language={language}
          onBack={() => setActiveMode('games_portal')}
        />
      );
    }

    if (activeMode === 'word_wash' && activeGameSet) {
      return (
        <LernstudioWordWashGame
          set={activeGameSet}
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

        {/* Top Unified Library Switcher: Vocabulary Sets vs Verb Library (2,206) vs Verb Groups */}
        <div className="grid grid-cols-3 gap-1 bg-surface-hover p-1 rounded-xl border border-surface-border text-[11px] sm:text-xs font-black">
          <button
            type="button"
            onClick={() => setHubSection('vocab')}
            className={`py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              hubSection === 'vocab'
                ? 'bg-surface text-primary shadow-xs border border-surface-border'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {language === 'ar' ? 'مجموعات المفردات' : language === 'de' ? 'Wortschatz-Sets' : 'Vocabulary Sets'}
            </span>
            <span className="opacity-75 tabular-nums">({vocabSets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setHubSection('verb_library')}
            className={`py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              hubSection === 'verb_library'
                ? 'bg-surface text-primary shadow-xs border border-surface-border'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {language === 'ar' ? 'مكتبة الأفعال' : language === 'de' ? 'Verbenbibliothek' : 'Verb Library'}
            </span>
            <span className="opacity-75 tabular-nums">({verbLibraryCounts.total})</span>
          </button>

          <button
            type="button"
            onClick={() => setHubSection('verb_groups')}
            className={`py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              hubSection === 'verb_groups'
                ? 'bg-surface text-primary shadow-xs border border-surface-border'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {language === 'ar' ? 'مجموعات الأفعال' : language === 'de' ? 'Verbgruppen' : 'Verb Groups'}
            </span>
            <span className="opacity-75 tabular-nums">({BUILTIN_VERB_GROUPS.length + customVerbGroups.length})</span>
          </button>
        </div>

        {/* Source Filter Segment Switcher Tabs (Vocab Section Only) */}
        {hubSection === 'vocab' && (
          <>
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
                <span className="opacity-75 tabular-nums">({vocabSets.length})</span>
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
                  <option value="all">🏷️ {language === 'ar' ? 'المصدر: الكل' : language === 'de' ? 'Quelle: Alle' : 'Source: All'} ({vocabSets.length})</option>
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
                  <option value="all">🎓 {t.allEducationalLevels} ({vocabSets.length})</option>
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
                  <strong className="text-text-main font-bold">{vocabSets.length}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {language === 'ar' ? 'المفردات:' : 'Vocabulary:'}{' '}
                  <strong className="text-text-main font-bold">{vocabSets.reduce((acc, s) => acc + (s.items?.length || 0), 0)}</strong>
                </span>
                {filteredSets.length !== vocabSets.length && (
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
          </>
        )}

        {/* TAB 1: VOCABULARY SETS GRID */}
        {hubSection === 'vocab' && (filteredSets.length === 0 ? (
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
        ))}

        {/* TAB 2: UNIFIED GERMAN VERB LIBRARY (2,206 VERBS: A1-B1) */}
        {hubSection === 'verb_library' && (
          <div className="space-y-3">
            {/* Level Stats & Filter Bar */}
            <div className="p-3 bg-surface border border-surface-border rounded-xl space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-bold">
                {(['all', 'A1', 'A2', 'B1'] as const).map((lvl) => {
                  const count =
                    lvl === 'all'
                      ? verbLibraryCounts.total
                      : lvl === 'A1'
                      ? verbLibraryCounts.a1
                      : lvl === 'A2'
                      ? verbLibraryCounts.a2
                      : verbLibraryCounts.b1;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setVerbLevelFilter(lvl)}
                      className={`py-2 px-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        verbLevelFilter === lvl
                          ? 'bg-primary text-white border-primary shadow-2xs'
                          : 'bg-surface-hover border-surface-border text-text-main hover:bg-surface'
                      }`}
                    >
                      <span>{lvl === 'all' ? (language === 'ar' ? 'كل المستويات' : 'All Levels') : lvl}</span>
                      <span className="tabular-nums opacity-80">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="relative">
                  <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-text-muted ${language === 'ar' ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    value={verbSearch}
                    onChange={(e) => setVerbSearch(e.target.value)}
                    placeholder={language === 'ar' ? 'ابحث بالفعل، المعنى، حرف الجر...' : 'Search verb, meaning, preposition...'}
                    className={`w-full py-2 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary ${
                      language === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                    }`}
                  />
                </div>

                <select
                  value={verbClassFilter}
                  onChange={(e) => setVerbClassFilter(e.target.value as 'all' | VerbClassification)}
                  className="px-2.5 py-2 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="all">{language === 'ar' ? 'كل التصنيفات النحوية' : 'All Classifications'}</option>
                  {ALL_VERB_CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={verbTopicFilter}
                  onChange={(e) => setVerbTopicFilter(e.target.value as 'all' | VerbTopicTag)}
                  className="px-2.5 py-2 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="all">{language === 'ar' ? 'كل الموضوعات (14)' : 'All Topics (14)'}</option>
                  {ALL_VERB_TOPIC_TAGS.map((tp) => (
                    <option key={tp} value={tp}>{tp}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Verbs Multi-Action Toolbar */}
            {selectedVerbIds.length > 0 && (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-primary tabular-nums">
                  {language === 'ar'
                    ? `تم تحديد ${selectedVerbIds.length} فعل من مكتبة الأفعال`
                    : `${selectedVerbIds.length} verbs selected`}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const chosen = resolveVerbsFromSelection({ verbIds: selectedVerbIds });
                      if (chosen.length === 0) return;
                      const tempSet = buildLernstudioSetFromVerbs({
                        id: `temp_verbs_${Date.now()}`,
                        title: `Ausgewählte Verben (${chosen.length})`,
                        titleAr: `أفعال مختارة (${chosen.length})`,
                        verbs: chosen,
                        setKind: 'verb_group'
                      });
                      setSelectedSetForMode(tempSet);
                      setActiveMode('games_portal');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'العب بالمحدد' : 'Play'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const chosen = resolveVerbsFromSelection({ verbIds: selectedVerbIds });
                      if (chosen.length === 0) return;
                      const tempSet = buildLernstudioSetFromVerbs({
                        id: `temp_teach_verbs_${Date.now()}`,
                        title: `Ausgewählte Verben (${chosen.length})`,
                        titleAr: `أفعال مختارة (${chosen.length})`,
                        verbs: chosen,
                        setKind: 'verb_group'
                      });
                      setSelectedSetForTeach(tempSet);
                      setIsTeachModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text-main text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span>{t.teachMode}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const chosen = resolveVerbsFromSelection({ verbIds: selectedVerbIds });
                      if (chosen.length === 0) return;
                      const tempSet = buildLernstudioSetFromVerbs({
                        id: `temp_hw_verbs_${Date.now()}`,
                        title: `Ausgewählte Verben (${chosen.length})`,
                        titleAr: `أفعال مختارة (${chosen.length})`,
                        verbs: chosen,
                        setKind: 'verb_group'
                      });
                      setSelectedSetForHomework(tempSet);
                      setHomeworkModalInitialTab('create');
                      setIsHomeworkModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text-main text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5 text-primary" />
                    <span>{language === 'ar' ? 'واجب بالمحدد' : 'Homework'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditorVerbSearch('');
                      setEditorVerbLevel('all');
                      setVerbGroupEditor({
                        mode: 'create',
                        titleDe: `Meine Verben (${selectedVerbIds.length})`,
                        titleAr: `مجموعة أفعالي (${selectedVerbIds.length})`,
                        descriptionAr: '',
                        creatorTeacherName: resolvedCreatorName,
                        verbIds: [...selectedVerbIds]
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'حفظ كمجموعة مخصصة' : 'Save as Group'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedVerbIds([])}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Clear'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-text-muted px-0.5 tabular-nums">
              <span>
                {language === 'ar' ? 'النتائج:' : 'Results:'}{' '}
                <strong className="text-text-main">{filteredVerbs.length}</strong> / {verbLibraryCounts.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const pageIds = paginatedVerbs.map((v) => v.id);
                    const allSelected = pageIds.every((id) => selectedVerbIds.includes(id));
                    if (allSelected) {
                      setSelectedVerbIds((prev) => prev.filter((id) => !pageIds.includes(id)));
                    } else {
                      setSelectedVerbIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                    }
                  }}
                  className="text-primary font-bold hover:underline cursor-pointer"
                >
                  {language === 'ar' ? 'تحديد الصفحة الحالية' : 'Toggle Page Selection'}
                </button>
              </div>
            </div>

            {/* Verbs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedVerbs.map((v: VerbEntry) => {
                const isSelected = selectedVerbIds.includes(v.id);
                const isExpanded = expandedVerbId === v.id;
                return (
                  <div
                    key={v.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-primary/5 border-primary shadow-xs'
                        : 'bg-surface border-surface-border hover:border-primary/40'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setSelectedVerbIds((prev) =>
                                prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                              )
                            }
                            className="mt-1 w-4 h-4 accent-primary cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-sm text-text-main" dir="ltr">
                                {v.infinitive}
                              </span>
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                {v.level}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-text-main mt-0.5">{v.arabic}</div>
                            {v.english && (
                              <div className="text-[11px] text-text-muted">{v.english}</div>
                            )}
                          </div>
                        </label>

                        <button
                          type="button"
                          onClick={() => speakGermanText(v.infinitive, 0.85)}
                          className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface text-primary border border-surface-border cursor-pointer shrink-0"
                          title="Pronounce"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                        {v.classifications.map((cls) => (
                          <span key={cls} className="px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-surface-border">
                            {cls}
                          </span>
                        ))}
                        {v.preposition && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            + {v.preposition} ({v.prepositionCase})
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-2 border-t border-surface-border space-y-2 text-[11px]">
                        <div className="grid grid-cols-2 gap-1 bg-surface-hover/60 p-2 rounded-lg font-mono" dir="ltr">
                          <span>ich: <strong>{v.praesens.ich}</strong></span>
                          <span>du: <strong>{v.praesens.du}</strong></span>
                          <span>er/sie/es: <strong>{v.praesens.er_sie_es}</strong></span>
                          <span>wir: <strong>{v.praesens.wir}</strong></span>
                          <span>ihr: <strong>{v.praesens.ihr}</strong></span>
                          <span>sie/Sie: <strong>{v.praesens.sie_Sie}</strong></span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface-hover/40 space-y-0.5">
                          <div className="font-semibold text-text-main" dir="ltr">{v.exampleGerman}</div>
                          <div className="text-text-muted">{v.exampleArabic}</div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedVerbId(isExpanded ? null : v.id)}
                      className="text-[11px] font-bold text-primary hover:underline text-start cursor-pointer"
                    >
                      {isExpanded
                        ? (language === 'ar' ? 'إخفاء التصريف والمثال ▲' : 'Hide Conjugation ▲')
                        : (language === 'ar' ? 'عرض التصريف والمثال ▼' : 'Show Präsens & Example ▼')}
                    </button>
                  </div>
                );
              })}
            </div>

            {totalVerbPages > 1 && (
              <div className="flex items-center justify-between p-3.5 bg-surface rounded-2xl border border-surface-border text-xs font-bold">
                <span className="text-text-muted tabular-nums">
                  {language === 'ar' ? `صفحة ${verbPage} من ${totalVerbPages}` : `Page ${verbPage} / ${totalVerbPages}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={verbPage <= 1}
                    onClick={() => setVerbPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-surface-hover border border-surface-border disabled:opacity-40 cursor-pointer"
                  >
                    {language === 'ar' ? 'السابق' : 'Prev'}
                  </button>
                  <button
                    type="button"
                    disabled={verbPage >= totalVerbPages}
                    onClick={() => setVerbPage((p) => Math.min(totalVerbPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-40 cursor-pointer"
                  >
                    {language === 'ar' ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: READY-MADE & TEACHER CUSTOM/FORKED VERB GROUPS */}
        {hubSection === 'verb_groups' && (
          <div className="space-y-3">
            <div className="p-3 bg-surface border border-surface-border rounded-xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  {([
                    { id: 'all', label: language === 'ar' ? 'الكل' : 'All' },
                    { id: 'cefr', label: 'CEFR (A1-B1)' },
                    { id: 'grammar', label: language === 'ar' ? 'قواعد الأفعال' : 'Grammar' },
                    { id: 'topic', label: language === 'ar' ? 'الموضوعات' : 'Topics' },
                    { id: 'custom', label: language === 'ar' ? `مجموعات المعلمين (${customVerbGroups.length})` : `Custom (${customVerbGroups.length})` }
                  ] as const).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setVerbGroupCategoryFilter(cat.id)}
                      className={`px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${
                        verbGroupCategoryFilter === cat.id
                          ? 'bg-primary text-white border-primary shadow-2xs'
                          : 'bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditorVerbSearch('');
                    setEditorVerbLevel('A1');
                    setVerbGroupEditor({
                      mode: 'create',
                      titleDe: '',
                      titleAr: '',
                      descriptionAr: '',
                      creatorTeacherName: resolvedCreatorName,
                      verbIds: []
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'مجموعة أفعال جديدة' : 'New Verb Group'}</span>
                </button>
              </div>

              <div className="relative">
                <Search className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-text-muted ${language === 'ar' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={verbGroupSearch}
                  onChange={(e) => setVerbGroupSearch(e.target.value)}
                  placeholder={language === 'ar' ? 'ابحث باسم المجموعة أو اسم المعلم...' : 'Search group or teacher...'}
                  className={`w-full py-2 bg-surface-hover/70 border border-surface-border rounded-lg text-xs font-medium text-text-main focus:outline-none focus:ring-1 focus:ring-primary ${
                    language === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>
            </div>

            {selectedVerbGroupIds.length > 0 && (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-primary tabular-nums">
                  {language === 'ar'
                    ? `تم اختيار ${selectedVerbGroupIds.length} مجموعة أفعال`
                    : `${selectedVerbGroupIds.length} groups selected`}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const combined = resolveVerbsFromSelection({
                        groupIds: selectedVerbGroupIds,
                        customGroups: customVerbGroups
                      });
                      if (combined.length === 0) return;
                      const tempSet = buildLernstudioSetFromVerbs({
                        id: `combined_vgrp_${Date.now()}`,
                        title: `Verbgruppen (${selectedVerbGroupIds.length})`,
                        titleAr: `مجموعات أفعال مدمجة (${selectedVerbGroupIds.length})`,
                        verbs: combined,
                        setKind: 'verb_group'
                      });
                      setSelectedSetForMode(tempSet);
                      setActiveMode('games_portal');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'العب معاً' : 'Play Combined'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const combined = resolveVerbsFromSelection({
                        groupIds: selectedVerbGroupIds,
                        customGroups: customVerbGroups
                      });
                      if (combined.length === 0) return;
                      const tempSet = buildLernstudioSetFromVerbs({
                        id: `combined_teach_${Date.now()}`,
                        title: `Verbgruppen (${selectedVerbGroupIds.length})`,
                        titleAr: `مجموعات أفعال (${selectedVerbGroupIds.length})`,
                        verbs: combined,
                        setKind: 'verb_group'
                      });
                      setSelectedSetForTeach(tempSet);
                      setIsTeachModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text-main text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span>{t.teachMode}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const combined = resolveVerbsFromSelection({
                        groupIds: selectedVerbGroupIds,
                        customGroups: customVerbGroups
                      });
                      if (combined.length === 0) return;
                      const tempSet = buildLernstudioSetFromVerbs({
                        id: `combined_hw_${Date.now()}`,
                        title: `Verbgruppen (${selectedVerbGroupIds.length})`,
                        titleAr: `مجموعات أفعال (${selectedVerbGroupIds.length})`,
                        verbs: combined,
                        setKind: 'verb_group'
                      });
                      setSelectedSetForHomework(tempSet);
                      setHomeworkModalInitialTab('create');
                      setIsHomeworkModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-text-main text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5 text-primary" />
                    <span>{language === 'ar' ? 'واجب معاً' : 'Homework Combined'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const combined = resolveVerbsFromSelection({
                        groupIds: selectedVerbGroupIds,
                        customGroups: customVerbGroups
                      });
                      setEditorVerbSearch('');
                      setEditorVerbLevel('all');
                      setVerbGroupEditor({
                        mode: 'create',
                        titleDe: 'Kombinierte Verbgruppe',
                        titleAr: 'مجموعة أفعال مدمجة',
                        descriptionAr: '',
                        creatorTeacherName: resolvedCreatorName,
                        verbIds: combined.map((v) => v.id)
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'دمج كمجموعة جديدة' : 'Merge as New Group'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedVerbGroupIds([])}
                    className="px-2 py-1.5 text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    {language === 'ar' ? 'مسح' : 'Clear'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredVerbGroups.map((grp) => {
                const isGroupChecked = selectedVerbGroupIds.includes(grp.id);
                const launchSet = () =>
                  hydrateVerbGroupSet(verbGroupToLernstudioSet(grp, undefined, { compactForSync: true }));
                const sourceBuiltin = grp.basedOnBuiltinGroupId
                  ? BUILTIN_VERB_GROUPS.find((b) => b.id === grp.basedOnBuiltinGroupId)
                  : undefined;

                return (
                  <div
                    key={grp.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      isGroupChecked
                        ? 'bg-primary/5 border-primary shadow-xs'
                        : 'bg-surface border-surface-border hover:border-primary/40'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2 text-[11px] text-text-muted">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isGroupChecked}
                            onChange={() =>
                              setSelectedVerbGroupIds((prev) =>
                                prev.includes(grp.id) ? prev.filter((id) => id !== grp.id) : [...prev, grp.id]
                              )
                            }
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                          <span className="font-bold text-primary tabular-nums">{grp.verbIds.length} {language === 'ar' ? 'فعل' : 'verbs'}</span>
                        </label>

                        <span className="font-bold">
                          {grp.isBuiltin
                            ? (language === 'ar' ? 'منهاج جاهز' : 'Built-in')
                            : `👨‍🏫 أ. ${grp.createdByTeacherName || 'المعلم'}`}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-text-main">{language === 'ar' ? grp.titleAr : grp.titleDe}</h3>
                        <div className="text-xs font-mono text-text-muted" dir="ltr">{grp.titleDe}</div>
                        {sourceBuiltin && (
                          <div className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                            {language === 'ar' ? `معدّلة من: ${sourceBuiltin.titleAr}` : `Forked from: ${sourceBuiltin.titleDe}`}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-surface-border space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSetForMode(launchSet());
                          setActiveMode('games_portal');
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5"
                      >
                        <Gamepad2 className="w-3.5 h-3.5" />
                        <span>{t.playGame}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSetForTeach(launchSet());
                            setIsTeachModalOpen(true);
                          }}
                          className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{t.teachMode}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSetForHomework(launchSet());
                            setHomeworkModalInitialTab('create');
                            setIsHomeworkModalOpen(true);
                          }}
                          className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{language === 'ar' ? 'واجب' : 'Homework'}</span>
                        </button>

                        {grp.isBuiltin ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditorVerbSearch('');
                              setEditorVerbLevel('all');
                              setVerbGroupEditor({
                                mode: 'fork',
                                sourceBuiltinId: grp.id,
                                titleDe: `${grp.titleDe} (Custom)`,
                                titleAr: `${grp.titleAr} (نسخة معدّلة)`,
                                descriptionAr: grp.descriptionAr || '',
                                creatorTeacherName: resolvedCreatorName,
                                verbIds: [...grp.verbIds]
                              });
                            }}
                            className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{language === 'ar' ? 'تخصيص' : 'Customize'}</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditorVerbSearch('');
                                setEditorVerbLevel('all');
                                setVerbGroupEditor({
                                  mode: 'edit',
                                  existingGroup: grp,
                                  titleDe: grp.titleDe,
                                  titleAr: grp.titleAr,
                                  descriptionAr: grp.descriptionAr || '',
                                  creatorTeacherName: grp.createdByTeacherName || resolvedCreatorName,
                                  verbIds: [...grp.verbIds]
                                });
                              }}
                              className="p-1.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main hover:text-primary rounded-lg cursor-pointer"
                              title={t.editSet}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(language === 'ar' ? `حذف مجموعة الأفعال (${grp.titleAr})؟` : `Delete (${grp.titleDe})?`)) {
                                  handleDeleteSetWithCloud(grp.id);
                                }
                              }}
                              className="p-1.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-muted hover:text-rose-500 rounded-lg cursor-pointer"
                              title={t.deleteSet}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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

        {/* Inline Custom / Non-Destructive Fork Verb Group Editor Modal */}
        {verbGroupEditor && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-surface-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-text-main">
                    {verbGroupEditor.mode === 'fork'
                      ? (language === 'ar' ? 'تخصيص نسخة من المجموعة الجاهزة (بدون تعديل الأصل)' : 'Fork Built-in Verb Group')
                      : verbGroupEditor.mode === 'edit'
                      ? (language === 'ar' ? 'تعديل مجموعة الأفعال المخصصة' : 'Edit Custom Verb Group')
                      : (language === 'ar' ? 'إنشاء مجموعة أفعال مخصصة (مشتركة للمعلمين)' : 'New Custom Verb Group')}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    {language === 'ar'
                      ? `باسم المعلم: أ. ${verbGroupEditor.creatorTeacherName || resolvedCreatorName}`
                      : `Teacher: ${verbGroupEditor.creatorTeacherName || resolvedCreatorName}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVerbGroupEditor(null)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">
                      {language === 'ar' ? 'الاسم بالعربية:' : 'Arabic Title:'}
                    </label>
                    <input
                      type="text"
                      value={verbGroupEditor.titleAr}
                      onChange={(e) => setVerbGroupEditor((prev) => prev ? { ...prev, titleAr: e.target.value } : null)}
                      placeholder="مثال: أفعال السفر المهمة"
                      className="w-full px-3 py-2 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">
                      {language === 'ar' ? 'الاسم بالألمانية:' : 'German Title:'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={verbGroupEditor.titleDe}
                      onChange={(e) => setVerbGroupEditor((prev) => prev ? { ...prev, titleDe: e.target.value } : null)}
                      placeholder="e.g. Reiseverben A2"
                      className="w-full px-3 py-2 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">
                      {language === 'ar' ? 'اسم المعلم مُنشئ المجموعة:' : 'Creator Teacher Name:'}
                    </label>
                    <input
                      type="text"
                      value={verbGroupEditor.creatorTeacherName}
                      onChange={(e) => setVerbGroupEditor((prev) => prev ? { ...prev, creatorTeacherName: e.target.value } : null)}
                      placeholder={resolvedCreatorName}
                      className="w-full px-3 py-2 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className={`w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 text-text-muted ${language === 'ar' ? 'right-2.5' : 'left-2.5'}`} />
                    <input
                      type="text"
                      value={editorVerbSearch}
                      onChange={(e) => setEditorVerbSearch(e.target.value)}
                      placeholder={language === 'ar' ? 'ابحث لإضافة أو إزالة أفعال...' : 'Search verbs to add/remove...'}
                      className={`w-full py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs ${
                        language === 'ar' ? 'pr-8 pl-2' : 'pl-8 pr-2'
                      }`}
                    />
                  </div>
                  <select
                    value={editorVerbLevel}
                    onChange={(e) => setEditorVerbLevel(e.target.value as 'all' | VerbLevel)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold"
                  >
                    <option value="all">A1-B1</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                  </select>
                  <span className="text-xs font-black text-primary tabular-nums">
                    {language === 'ar' ? `${verbGroupEditor.verbIds.length} فعل مختار` : `${verbGroupEditor.verbIds.length} selected`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto p-2 rounded-xl bg-surface-hover/40 border border-surface-border">
                  {editorCandidateVerbs.map((v) => {
                    const checked = verbGroupEditor.verbIds.includes(v.id);
                    return (
                      <label
                        key={v.id}
                        className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer ${
                          checked ? 'bg-primary/10 border-primary' : 'bg-surface border-surface-border'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setVerbGroupEditor((prev) => {
                              if (!prev) return null;
                              const nextIds = prev.verbIds.includes(v.id)
                                ? prev.verbIds.filter((id) => id !== v.id)
                                : [...prev.verbIds, v.id];
                              return { ...prev, verbIds: nextIds };
                            })
                          }
                          className="accent-primary shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-mono font-bold text-text-main" dir="ltr">{v.infinitive}</span>
                          <span className="text-[10px] text-primary mx-1">({v.level})</span>
                          <div className="text-[11px] text-text-muted truncate">{v.arabic}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVerbGroupEditor(null)}
                  className="px-4 py-2 rounded-xl bg-surface-hover text-xs font-bold text-text-main cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={verbGroupEditor.verbIds.length === 0 || (!verbGroupEditor.titleAr.trim() && !verbGroupEditor.titleDe.trim())}
                  onClick={() => {
                    if (!verbGroupEditor) return;
                    const finalTitleDe = verbGroupEditor.titleDe.trim() || verbGroupEditor.titleAr.trim();
                    const finalTitleAr = verbGroupEditor.titleAr.trim() || verbGroupEditor.titleDe.trim();
                    const finalTeacherName = verbGroupEditor.creatorTeacherName.trim() || resolvedCreatorName;
                    let nextGroup: VerbGroupDefinition;
                    if (verbGroupEditor.mode === 'fork' && verbGroupEditor.sourceBuiltinId) {
                      nextGroup = forkBuiltinVerbGroup({
                        builtinGroupId: verbGroupEditor.sourceBuiltinId,
                        titleDe: finalTitleDe,
                        titleAr: finalTitleAr,
                        verbIds: verbGroupEditor.verbIds,
                        teacherName: finalTeacherName,
                        teacherUid: activeAuthUid || undefined
                      });
                    } else if (verbGroupEditor.mode === 'edit' && verbGroupEditor.existingGroup) {
                      nextGroup = updateCustomVerbGroup(verbGroupEditor.existingGroup, {
                        titleDe: finalTitleDe,
                        titleAr: finalTitleAr,
                        descriptionAr: verbGroupEditor.descriptionAr,
                        verbIds: verbGroupEditor.verbIds,
                        editedByTeacherName: finalTeacherName
                      });
                    } else {
                      nextGroup = createCustomVerbGroup({
                        titleDe: finalTitleDe,
                        titleAr: finalTitleAr,
                        descriptionAr: verbGroupEditor.descriptionAr,
                        verbIds: verbGroupEditor.verbIds,
                        teacherName: finalTeacherName,
                        teacherUid: activeAuthUid || undefined
                      });
                    }
                    const syncSet = verbGroupToLernstudioSet(nextGroup, undefined, { compactForSync: true });
                    handleSaveSetWithCloud(syncSet);
                    setVerbGroupEditor(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-black cursor-pointer disabled:opacity-40"
                >
                  {language === 'ar' ? 'حفظ ومزامنة للمعلمين' : 'Save & Share Group'}
                </button>
              </div>
            </div>
          </div>
        )}

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
