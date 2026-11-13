import React, { useState, useMemo, useEffect } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioGameMode } from '../../types/lernstudio';
import { Group, Student } from '../../types';
import { getLernstudioTranslations, getLocalizedSetTitle } from '../../utils/lernstudioTranslations';
import { NANO_BANANA_GAME_ART_MANIFEST } from '../../data/nanoBananaGameArtManifest';
import {
  filterGroupsByDayAndTime,
  detectCurrentScheduledGroup,
  getStudentsForGroup
} from '../../utils/groupScheduleUtils';
import { isArticleGameSupported } from '../lernstudioQuestionAdapter';
import { BUILTIN_VERB_GROUPS, isItemVerb } from '../verbEngine';
import { isVerbGroupSet } from '../verbGroupSync';
import {
  ArrowLeft,
  Play,
  Users,
  Clock,
  HelpCircle,
  Volume2,
  Zap,
  Check,
  Shield,
  Layers,
  User,
  Sparkles
} from 'lucide-react';

export interface GameSetupConfig {
  questionCount: number; // e.g. 5, 10, 15, 20, or set.items.length
  questionType:
    | 'de_to_ar'
    | 'ar_to_de'
    | 'article'
    | 'audio'
    | 'mixed'
    | 'verb_conjugation'
    | 'verb_sentence';
  gameMode: 'single' | 'pvp_2teams' | 'pvp_3teams' | 'pvp_4teams';
  teamNames: string[];
  timerSeconds: number; // 0 = no timer, 8, 15, 20, 30
  enableAudio: boolean;
  enableSoundFx: boolean;
  selectedGroupId?: string;
  selectedGroupObj?: Group;
  selectedStudentId?: string;
  selectedStudentObj?: Student;
  rosterMode?: 'split_teams' | 'individual' | 'custom_colors';
  assignedStudents?: { teamIdx: number; students: Student[] }[];
  extraVerbGroupIds?: string[];
}

interface Props {
  set: LernstudioSet;
  gameModeId: LernstudioGameMode;
  activeTheme: LernstudioTheme;
  language?: string;
  groups?: Group[];
  students?: Student[];
  onStart: (config: GameSetupConfig) => void;
  onBack: () => void;
}

export const LernstudioGameSetupScreen: React.FC<Props> = ({
  set,
  gameModeId,
  activeTheme,
  language = 'ar',
  groups = [],
  students = [],
  onStart,
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displaySetTitle = getLocalizedSetTitle(set, language);
  const totalItemsCount = set.items?.length || 0;

  const isArticleSupported = useMemo(() => isArticleGameSupported(set), [set]);
  const isPureVerbSet = useMemo(() => {
    if (isVerbGroupSet(set)) return true;
    const items = set.items || [];
    return items.length > 0 && items.every((it) => isItemVerb(it));
  }, [set]);

  // Retrieve game metadata from manifest if available
  const gameArtSpec = NANO_BANANA_GAME_ART_MANIFEST[gameModeId];
  const gameTitle = gameArtSpec?.titleAr || gameModeId;

  // Determine if this game is naturally a SOLO / Single-Player Game
  const isSoloGame = useMemo(() => {
    return (
      gameArtSpec?.category === 'solo' ||
      gameModeId === 'solo_sentence' ||
      gameModeId === 'balloon_pop' ||
      gameModeId === 'word_ninja' ||
      gameModeId === 'whack_a_mole' ||
      gameModeId === 'basket_catch' ||
      gameModeId === 'word_detective' ||
      gameModeId === 'sorting' ||
      gameModeId === 'memory' ||
      gameModeId === 'whats_in_box' ||
      gameModeId === 'word_rhythm' ||
      gameModeId === 'word_wash'
    );
  }, [gameArtSpec, gameModeId]);

  // Setup options state
  const [questionCount, setQuestionCount] = useState<number>(() =>
    totalItemsCount > 0 ? Math.min(10, totalItemsCount) : 10
  );
  const [questionType, setQuestionType] = useState<GameSetupConfig['questionType']>('mixed');
  const [extraVerbGroupIds, setExtraVerbGroupIds] = useState<string[]>([]);
  const [showMixedVerbPicker, setShowMixedVerbPicker] = useState(false);

  const hasVerbContent = useMemo(
    () =>
      isPureVerbSet ||
      extraVerbGroupIds.length > 0 ||
      (set.items || []).some((it) => isItemVerb(it)),
    [isPureVerbSet, extraVerbGroupIds.length, set.items]
  );

  // If set has no articles and teacher previously landed on 'article', fall back safely
  useEffect(() => {
    if (questionType === 'article' && !isArticleSupported) {
      setQuestionType('mixed');
    }
  }, [questionType, isArticleSupported]);

  const [gameMode, setGameMode] = useState<'single' | 'pvp_2teams' | 'pvp_3teams' | 'pvp_4teams'>(
    isSoloGame ? 'single' : 'pvp_2teams'
  );

  // Class & Student Roster State
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all');
  const [isCurrentClassNotice, setIsCurrentClassNotice] = useState<string | null>(null);
  const [rosterMode, setRosterMode] = useState<'split_teams' | 'individual' | 'custom_colors'>('split_teams');

  const [teamNames, setTeamNames] = useState<string[]>([
    isRtl ? 'الفريق الأوّل (🔴)' : 'Team 1 (🔴)',
    isRtl ? 'الفريق الثاني (🔵)' : 'Team 2 (🔵)',
    isRtl ? 'الفريق الثالث (🟢)' : 'Team 3 (🟢)',
    isRtl ? 'الفريق الرابع (🟡)' : 'Team 4 (🟡)'
  ]);

  const [timerSeconds, setTimerSeconds] = useState<number>(15);
  const [enableAudio, setEnableAudio] = useState<boolean>(true);
  const [enableSoundFx, setEnableSoundFx] = useState<boolean>(true);

  // Lock gameMode to 'single' if this is a solo game
  useEffect(() => {
    if (isSoloGame && gameMode !== 'single') {
      setGameMode('single');
    }
  }, [isSoloGame, gameMode]);

  // Filtered Groups based on day & time
  const filteredAppGroups = useMemo(() => {
    return filterGroupsByDayAndTime(groups, filterDay, filterTime);
  }, [groups, filterDay, filterTime]);

  // Selected Group Obj & Students
  const selectedGroupObj = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId);
  }, [groups, selectedGroupId]);

  const groupStudents = useMemo(() => {
    return getStudentsForGroup(students, selectedGroupId);
  }, [students, selectedGroupId]);

  const selectedStudentObj = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const activeTeamsCount =
    isSoloGame || gameMode === 'single'
      ? 1
      : gameMode === 'pvp_2teams'
      ? 2
      : gameMode === 'pvp_3teams'
      ? 3
      : 4;

  // Assigned Students by Team (for Multiplayer / Team Games)
  const assignedStudents = useMemo(() => {
    if (isSoloGame || !groupStudents || groupStudents.length === 0) return [];

    if (rosterMode === 'individual') {
      return groupStudents.map((st, i) => ({
        teamIdx: i,
        students: [st]
      }));
    }

    if (rosterMode === 'split_teams') {
      return Array.from({ length: activeTeamsCount }).map((_, teamIdx) => ({
        teamIdx,
        students: groupStudents.filter((_, sIdx) => sIdx % activeTeamsCount === teamIdx)
      }));
    }

    return [];
  }, [isSoloGame, groupStudents, rosterMode, activeTeamsCount]);

  // Sync team names with class roster when class or roster mode changes
  useEffect(() => {
    if (!isSoloGame && selectedGroupId && groupStudents.length > 0 && rosterMode === 'split_teams') {
      setTeamNames((prev) => {
        const next = [...prev];
        for (let teamIdx = 0; teamIdx < activeTeamsCount; teamIdx++) {
          const teamSts = groupStudents.filter((_, sIdx) => sIdx % activeTeamsCount === teamIdx);
          if (teamSts.length > 0) {
            const namesList = teamSts.map((s) => s.name).join(', ');
            next[teamIdx] = namesList;
          }
        }
        return next;
      });
    }
  }, [isSoloGame, selectedGroupId, groupStudents, rosterMode, activeTeamsCount]);

  // Auto-detect current active scheduled class ("⚡ Current Active Class ⚡")
  const handleDetectCurrentClass = () => {
    const match = detectCurrentScheduledGroup(groups, new Date());
    if (match.group) {
      setSelectedGroupId(match.group.id);
      setSelectedStudentId('');
      setIsCurrentClassNotice(`${t.currentClassActiveNote} (${match.group.name})`);
    } else {
      setIsCurrentClassNotice(t.noCurrentClassFound);
    }
    setTimeout(() => setIsCurrentClassNotice(null), 4500);
  };

  const toggleExtraVerbGroup = (groupId: string) => {
    setExtraVerbGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleStartGame = () => {
    onStart({
      questionCount,
      questionType,
      gameMode: isSoloGame ? 'single' : gameMode,
      teamNames: isSoloGame ? [selectedStudentObj?.name || 'لاعب فردي'] : teamNames.slice(0, activeTeamsCount),
      timerSeconds,
      enableAudio,
      enableSoundFx,
      selectedGroupId,
      selectedGroupObj,
      selectedStudentId,
      selectedStudentObj,
      rosterMode: isSoloGame ? undefined : rosterMode,
      assignedStudents,
      ...(extraVerbGroupIds.length > 0 ? { extraVerbGroupIds } : {})
    });
  };

  const updateTeamName = (index: number, newName: string) => {
    setTeamNames((prev) => {
      const next = [...prev];
      next[index] = newName;
      return next;
    });
  };

  const questionStyleOptions: Array<{
    id: GameSetupConfig['questionType'];
    labelAr: string;
    labelEn: string;
    descAr: string;
    disabled?: boolean;
  }> = [
    {
      id: 'mixed',
      labelAr: '🔀 أسئلة عشوائية ومختلطة (شامل)',
      labelEn: '🔀 Mixed & Random Questions',
      descAr: hasVerbContent
        ? 'ترجمة، تصريف الأفعال، أفعال في جمل، واستماع متنوع'
        : 'ترجمة، أدوات der/die/das، واستماع بشكل متنوع'
    },
    ...(hasVerbContent
      ? [
          {
            id: 'verb_conjugation' as const,
            labelAr: '🔤 تصريف الأفعال (Präsens)',
            labelEn: '🔤 Verb Conjugation (Präsens)',
            descAr: 'تصريف مع الضمائر (ich / du / sie هي / sie هم / Sie حضرتك والأسماء)'
          },
          {
            id: 'verb_sentence' as const,
            labelAr: '✍️ الفعل داخل الجملة (Verb im Satz)',
            labelEn: '✍️ Verb in Sentence Gap',
            descAr: 'جملة بفراغ مع المصدر بين قوسين ودعم الأفعال المنفصلة'
          }
        ]
      : []),
    {
      id: 'de_to_ar',
      labelAr: '🇩🇪 ⬅️ 🇪🇬 ألماني ⬅️ عربي',
      labelEn: '🇩🇪 ⬅️ 🇪🇬 German to Arabic',
      descAr: 'عرض الكلمة أو الفعل بالألمانية وتخمين المعنى العربي'
    },
    {
      id: 'ar_to_de',
      labelAr: '🇪🇬 ⬅️ 🇩🇪 عربي ⬅️ ألماني',
      labelEn: '🇪🇬 ⬅️ 🇩🇪 Arabic to German',
      descAr: 'عرض المعنى العربي واختيار الكلمة الألمانية الصحيحة'
    },
    {
      id: 'article',
      labelAr: '🏷️ أدوات المعرفة (der / die / das)',
      labelEn: '🏷️ Articles (der / die / das)',
      descAr: isArticleSupported
        ? 'التركيز على حصر وتحديد أداة الاسم الصحيحة'
        : 'غير متاح لمجموعات الأفعال فقط (يتطلب أسماء بأدوات)',
      disabled: !isArticleSupported
    },
    {
      id: 'audio',
      labelAr: '🎧 استماع ونطق بصوت ألماني',
      labelEn: '🎧 Listening & Pronunciation',
      descAr: 'الاستماع للصوت الألماني النقي وتخمين المفهوم'
    }
  ];

  return (
    <div
      className="p-3 sm:p-5 rounded-2xl min-h-[85vh] flex flex-col justify-between bg-background text-text-main relative overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* 1. TOP HEADER BAR */}
      <div className="bg-surface border border-surface-border p-3.5 sm:p-4 rounded-xl shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg bg-surface-hover text-text-main hover:bg-surface border border-surface-border cursor-pointer transition-colors"
            title={isRtl ? 'رجوع للألعاب' : 'Back to Games Hub'}
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-primary">
                ⚙️ {isRtl ? 'إعدادات اللعبة' : 'Game Setup'}
              </span>
              <span className="text-xs text-text-muted">
                · {displaySetTitle} ({totalItemsCount} {isPureVerbSet ? (isRtl ? 'فعل' : 'verbs') : (isRtl ? 'كلمة' : 'words')})
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-text-main flex items-center gap-2 mt-0.5">
              <span>{gameTitle}</span>
              {isSoloGame && (
                <span className="text-xs text-text-muted font-normal">
                  ({isRtl ? 'لعبة فردية' : 'Solo Game'})
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-muted">
            {activeTheme.name}
          </span>
        </div>
      </div>

      {/* 2. SETUP BODY CARDS */}
      <div className="max-w-3xl w-full mx-auto my-4 space-y-4">
        {/* Banner Intro Card */}
        <div className="bg-surface border border-surface-border text-text-main rounded-xl p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-text-main">
              {isRtl ? `تجهيز إعدادات "${gameTitle}"` : `Configure "${gameTitle}"`}
            </h2>
            <p className="text-xs text-text-muted max-w-lg leading-relaxed">
              {isRtl
                ? isSoloGame
                  ? 'اختر عدد الأسئلة، الفصل أو الطالب، والوقت المسموح قبل بدء التحدي الفردي.'
                  : 'اختر عدد الأسئلة، المجموعات والطلاب، طريقة تقسيم الفرق، والوقت المسموح لكل سؤال.'
                : isSoloGame
                ? 'Select question count, student, and timer before starting solo challenge.'
                : 'Select questions, students, team mode, and timer before launching.'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-hover border border-surface-border flex items-center justify-center shrink-0 text-2xl">
            {isSoloGame ? '🎯' : '🚀'}
          </div>
        </div>

        {/* SECTION 1: QUESTION COUNT & TYPES */}
        <div className="bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2.5 border-b border-surface-border pb-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-text-main">
                  {isRtl ? '1. عدد ونوع الأسئلة' : '1. Question Count & Types'}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {isRtl ? 'تحديد كمية العناصر ونوعية الأسئلة المعروضة في اللعبة' : 'Set question subset & style'}
                </p>
              </div>
            </div>

            {!isPureVerbSet && (
              <button
                type="button"
                onClick={() => setShowMixedVerbPicker((p) => !p)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  extraVerbGroupIds.length > 0 || showMixedVerbPicker
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface-hover text-primary border-primary/30 hover:bg-primary/10'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {extraVerbGroupIds.length > 0
                    ? isRtl
                      ? `وضع مختلط (+${extraVerbGroupIds.length} مجموعة أفعال)`
                      : `Mixed (+${extraVerbGroupIds.length} verb groups)`
                    : isRtl
                    ? '+ دمج أفعال (وضع مختلط)'
                    : '+ Mix Verb Groups'}
                </span>
              </button>
            )}
          </div>

          {/* Optional Mixed Verb Group Merger for Vocabulary Sets */}
          {showMixedVerbPicker && !isPureVerbSet && (
            <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2.5 animate-scale-up">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-primary">
                  {isRtl
                    ? 'اختر مجموعات من مكتبة الأفعال لدمجها مع المفردات في هذه اللعبة:'
                    : 'Select Verb Library groups to mix with this vocabulary set:'}
                </span>
                {extraVerbGroupIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExtraVerbGroupIds([])}
                    className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    {isRtl ? 'مسح' : 'Clear'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {BUILTIN_VERB_GROUPS.map((vg) => {
                  const selected = extraVerbGroupIds.includes(vg.id);
                  return (
                    <button
                      key={vg.id}
                      type="button"
                      onClick={() => toggleExtraVerbGroup(vg.id)}
                      className={`p-2 rounded-xl border text-start text-[11px] font-bold transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        selected
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                      }`}
                    >
                      <span className="truncate">
                        {isRtl ? vg.titleAr : vg.titleDe} ({vg.titleDe})
                      </span>
                      <span className={`text-[10px] tabular-nums shrink-0 ${selected ? 'text-white/90' : 'text-text-muted'}`}>
                        {vg.verbIds.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Question Count Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-muted block">
              {isRtl ? 'عدد الأسئلة المراد لعبها:' : 'Number of Questions:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[5, 10, 15, 20, Math.min(40, totalItemsCount)].map((cnt, idx) => {
                if (idx === 4 && (totalItemsCount <= 20 || cnt === 0)) return null;
                const isAll = idx === 4;
                const targetCount = isAll ? Math.min(40, totalItemsCount) : cnt;
                const displayLabel = isAll
                  ? isRtl
                    ? totalItemsCount > 40
                      ? `مجموعة كبيرة (40 من ${totalItemsCount})`
                      : `كل المجموعة (${totalItemsCount})`
                    : `All (${targetCount})`
                  : isRtl
                  ? `${cnt} أسئلة`
                  : `${cnt} Items`;
                const isSelected = questionCount === targetCount;

                return (
                  <button
                    key={`${idx}_${cnt}`}
                    type="button"
                    onClick={() => setQuestionCount(targetCount)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-black border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-sm scale-105'
                        : 'bg-surface-hover text-text-main border-surface-border hover:border-primary/40'
                    }`}
                  >
                    {displayLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Type Selector */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-text-muted block">
              {isRtl ? 'نمط ونوع الأسئلة:' : 'Question Quiz Style:'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {questionStyleOptions.map((item) => {
                const isSelected = questionType === item.id;
                const isDisabled = Boolean(item.disabled);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) setQuestionType(item.id);
                    }}
                    className={`p-3 rounded-2xl text-start border transition-all flex items-start gap-3 ${
                      isDisabled
                        ? 'bg-surface/40 border-surface-border/50 text-text-muted opacity-55 cursor-not-allowed'
                        : isSelected
                        ? 'bg-primary/10 border-primary text-primary shadow-2xs font-black cursor-pointer'
                        : 'bg-surface-hover border-surface-border text-text-main hover:bg-surface cursor-pointer'
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl text-xs ${isSelected ? 'bg-primary text-white' : 'bg-surface text-text-muted'}`}>
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-black">{isRtl ? item.labelAr : item.labelEn}</div>
                      <div className="text-[10.5px] text-text-muted leading-tight">{item.descAr}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 2: CHOOSE CLASS & STUDENTS FROM APP */}
        <div className="bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-surface-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-text-main">
                  {t.selectGroupHeader}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {isRtl ? 'اختيار فصول المواعيد والطلاب من التطبيق' : 'Select scheduled class & active student roster'}
                </p>
              </div>
            </div>

            {/* Current Active Class Button */}
            <button
              type="button"
              onClick={handleDetectCurrentClass}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all transform hover:scale-105 cursor-pointer inline-flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>{t.currentClassBtn}</span>
            </button>
          </div>

          {/* Current Class Toast Notice */}
          {isCurrentClassNotice && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-2xl text-xs font-extrabold text-amber-600 dark:text-amber-400 animate-scale-up flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{isCurrentClassNotice}</span>
            </div>
          )}

          {/* Day & Time Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-hover/50 rounded-2xl border border-surface-border">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-text-muted shrink-0">{t.filterByDay}</span>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-main focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="all">{t.allDays}</option>
                <option value="sunday">الأحد / Sunday</option>
                <option value="monday">الإثنين / Monday</option>
                <option value="tuesday">الثلاثاء / Tuesday</option>
                <option value="wednesday">الأربعاء / Wednesday</option>
                <option value="thursday">الخميس / Thursday</option>
                <option value="friday">الجمعة / Friday</option>
                <option value="saturday">السبت / Saturday</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-text-muted shrink-0">{t.filterByTime}</span>
              <select
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-main focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="all">{t.allTimes}</option>
                <option value="morning">{t.morningTime}</option>
                <option value="afternoon">{t.afternoonTime}</option>
                <option value="evening">{t.eveningTime}</option>
              </select>
            </div>
          </div>

          {/* Group Selector Dropdown */}
          <div className="space-y-2">
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setSelectedStudentId('');
              }}
              className="w-full px-4 py-2.5 bg-surface border border-surface-border rounded-2xl text-xs font-black text-text-main focus:outline-none focus:border-primary shadow-xs cursor-pointer"
            >
              <option value="">-- {t.allGroups} --</option>
              {filteredAppGroups.map((g) => {
                const sCount = getStudentsForGroup(students, g.id).length;
                return (
                  <option key={g.id} value={g.id}>
                    🏫 {g.name} ({sCount} {t.vocabularyCount}) • {g.grade || 'جريد'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Active Student Picker for Solo Games */}
          {isSoloGame && selectedGroupId && groupStudents.length > 0 && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2 animate-scale-up">
              <label className="text-xs font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                <span>{isRtl ? 'اختيار الطالب الذي يخوض التحدي الفردي الآن (اختياري):' : 'Select Active Student for Solo Challenge:'}</span>
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3.5 py-2 bg-surface border border-emerald-500/40 rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="">-- {isRtl ? 'جميع طلاب الفصل (تحدي فردي عام)' : 'All Class Students (General Solo)'} --</option>
                {groupStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    👤 {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* SECTION 3: TEAM SETUP & ROSTER MODE (SHOWN ONLY FOR MULTIPLAYER / TEAM GAMES) */}
        {!isSoloGame ? (
          <div className="bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2.5 border-b border-surface-border pb-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-text-main">
                  {t.playStyleHeader}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {isRtl ? 'اختر نمط اللعب وتقسيم الفرق واللاعبين' : 'Configure roster mode & team distribution'}
                </p>
              </div>
            </div>

            {/* Roster & Team Mode Selector Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setRosterMode('split_teams')}
                className={`p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                  rosterMode === 'split_teams'
                    ? 'bg-primary text-white border-primary shadow-sm font-black'
                    : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                }`}
              >
                {t.splitGroupTeams}
              </button>

              <button
                type="button"
                onClick={() => setRosterMode('individual')}
                className={`p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                  rosterMode === 'individual'
                    ? 'bg-primary text-white border-primary shadow-sm font-black'
                    : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                }`}
              >
                {t.individualStudents}
              </button>

              <button
                type="button"
                onClick={() => setRosterMode('custom_colors')}
                className={`p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                  rosterMode === 'custom_colors'
                    ? 'bg-primary text-white border-primary shadow-sm font-black'
                    : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                }`}
              >
                {t.customTeams}
              </button>
            </div>

            {/* PVP Teams Count Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              {[
                { id: 'single', labelAr: '👤 لاعب فردي', labelEn: '👤 Single Player' },
                { id: 'pvp_2teams', labelAr: '🔴 🔵 فريقين (2)', labelEn: '🔴 🔵 2 Teams' },
                { id: 'pvp_3teams', labelAr: '🔴 🔵 🟢 3 فرق', labelEn: '🔴 🔵 🟢 3 Teams' },
                { id: 'pvp_4teams', labelAr: '🔴 🔵 🟢 🟡 4 فرق', labelEn: '🔴 🔵 🟢 🟡 4 Teams' }
              ].map((m) => {
                const isSelected = gameMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setGameMode(m.id as any)}
                    className={`p-3 rounded-2xl text-xs font-black border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105'
                        : 'bg-surface-hover text-text-main border-surface-border hover:border-indigo-400'
                    }`}
                  >
                    {isRtl ? m.labelAr : m.labelEn}
                  </button>
                );
              })}
            </div>

            {/* Custom Team Names Inputs */}
            {gameMode !== 'single' && (
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-text-muted block">
                  {isRtl ? 'أسماء الفرق للمنافسة:' : 'Customize Team Names:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Array.from({ length: activeTeamsCount }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-black text-text-muted shrink-0 w-14">
                        {isRtl ? `فريق ${idx + 1}:` : `Team ${idx + 1}:`}
                      </span>
                      <input
                        type="text"
                        value={teamNames[idx] || ''}
                        onChange={(e) => updateTeamName(idx, e.target.value)}
                        placeholder={isRtl ? `اسم الفريق ${idx + 1}` : `Team ${idx + 1} Name`}
                        className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned Student Roster Badges Preview if Group Selected */}
            {selectedGroupId && groupStudents.length > 0 && rosterMode === 'split_teams' && (
              <div className="pt-2 space-y-2 border-t border-surface-border/60">
                <label className="text-[11px] font-black text-primary block">
                  👥 {isRtl ? 'توزيع أعضاء الفصل على الفرق:' : 'Class Roster Distribution:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assignedStudents.map((groupTeam) => {
                    if (groupTeam.teamIdx >= activeTeamsCount) return null;
                    return (
                      <div
                        key={groupTeam.teamIdx}
                        className="p-2.5 rounded-2xl bg-surface-hover/80 border border-surface-border text-xs space-y-1"
                      >
                        <div className="font-black text-text-main flex items-center justify-between">
                          <span>{isRtl ? `فريق ${groupTeam.teamIdx + 1}` : `Team ${groupTeam.teamIdx + 1}`}</span>
                          <span className="text-[10px] text-text-muted font-bold">
                            ({groupTeam.students.length} {isRtl ? 'طلاب' : 'students'})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {groupTeam.students.map((st) => (
                            <span
                              key={st.id}
                              className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-bold text-[10.5px]"
                            >
                              👤 {st.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Clean Solo Mode Card when game is a solo game */
          <div className="bg-surface border border-surface-border rounded-3xl p-5 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2.5 border-b border-surface-border pb-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-text-main">
                  {isRtl ? '3. وضع اللعب الفردي (شخصي)' : '3. Solo Player Mode'}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {isRtl
                    ? 'هذه اللعبة مخصصة للتحدي الفردي المستقل بدون تقسيم فرق.'
                    : 'This is a solo arcade game. Player challenges independently without teams.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {selectedStudentObj
                    ? isRtl
                      ? `اللاعب المحدد: ${selectedStudentObj.name}`
                      : `Active Player: ${selectedStudentObj.name}`
                    : selectedGroupObj
                    ? isRtl
                      ? `فصل ${selectedGroupObj.name} (تحدي فردي مخصص)`
                      : `Class ${selectedGroupObj.name} (Solo Challenge)`
                    : isRtl
                    ? 'تحدي فردي شخصي مباشر'
                    : 'Direct Solo Challenge'}
                </span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                Solo 👤
              </span>
            </div>
          </div>
        )}

        {/* SECTION 4: TIMER & AUDIO CONTROLS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Timer Card */}
          <div className="bg-surface border border-surface-border rounded-3xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-surface-border pb-2.5">
              <Clock className="w-4 h-4 text-rose-500" />
              <h4 className="text-xs sm:text-sm font-black text-text-main">
                {isRtl ? 'توقيت ومؤقت السؤال' : 'Question Timer'}
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 0, labelAr: '⏳ بدون مؤقت', labelEn: '⏳ No Timer' },
                { val: 30, labelAr: '🟢 30 ثانية (هادئ)', labelEn: '🟢 30s Easy' },
                { val: 15, labelAr: '🟡 15 ثانية (قياسي)', labelEn: '🟡 15s Standard' },
                { val: 8, labelAr: '🔴 8 ثوان (سريع)', labelEn: '🔴 8s Fast' }
              ].map((tItem) => {
                const isSelected = timerSeconds === tItem.val;
                return (
                  <button
                    key={tItem.val}
                    type="button"
                    onClick={() => setTimerSeconds(tItem.val)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                        : 'bg-surface-hover text-text-main border-surface-border'
                    }`}
                  >
                    {isRtl ? tItem.labelAr : tItem.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sound & Voice Card */}
          <div className="bg-surface border border-surface-border rounded-3xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-surface-border pb-2.5">
              <Volume2 className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs sm:text-sm font-black text-text-main">
                {isRtl ? 'الصوت والنطق الألماني' : 'Audio & Voice'}
              </h4>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 rounded-xl bg-surface-hover border border-surface-border cursor-pointer">
                <span className="text-xs font-bold text-text-main">
                  {isRtl ? '🎧 النطق الألماني التلقائي' : '🎧 German Speech'}
                </span>
                <input
                  type="checkbox"
                  checked={enableAudio}
                  onChange={(e) => setEnableAudio(e.target.checked)}
                  className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-surface-hover border border-surface-border cursor-pointer">
                <span className="text-xs font-bold text-text-main">
                  {isRtl ? '🎵 التأثيرات والمؤثرات الصوتية' : '🎵 Sound FX'}
                </span>
                <input
                  type="checkbox"
                  checked={enableSoundFx}
                  onChange={(e) => setEnableSoundFx(e.target.checked)}
                  className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FOOTER START BUTTON */}
      <div className="bg-surface border border-surface-border p-3.5 sm:p-4 rounded-xl shadow-xs flex items-center justify-between gap-3 max-w-3xl w-full mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl bg-surface-hover text-text-muted hover:text-text-main text-xs font-bold border border-surface-border cursor-pointer transition-colors"
        >
          {isRtl ? 'إلغاء وعودة' : 'Cancel'}
        </button>

        <button
          type="button"
          onClick={handleStartGame}
          className="flex-1 max-w-md py-2.5 px-6 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isRtl ? 'ابدأ اللعبة الآن' : 'Start Game Now'}</span>
        </button>
      </div>
    </div>
  );
};
