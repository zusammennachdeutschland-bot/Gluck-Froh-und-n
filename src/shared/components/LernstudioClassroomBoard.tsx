import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LernstudioSet, LernstudioTheme, LernstudioItem } from '../../types/lernstudio';
import { useApp } from '../../context/AppContext';
import { getLernstudioTranslations, LernstudioTranslations, getItemTranslation } from '../../utils/lernstudioTranslations';
import {
  detectCurrentScheduledGroup,
  filterGroupsByDayAndTime,
  getStudentsForGroup
} from '../../utils/groupScheduleUtils';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../utils/audioSpeechUtils';
import { SharedVictoryTrophyArt } from './GameArtAssets';
import { GameSetupConfig } from './LernstudioGameSetupScreen';
import { useGameEffects } from './effects/GameEffectsOverlay';
import {
  Trophy,
  Plus,
  Minus,
  RotateCcw,
  Maximize2,
  Minimize2,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Undo2,
  Sparkles,
  Zap,
  Award,
  Play,
  Settings,
  Users,
  Check,
  Volume2,
  Snail,
  X,
  Crown,
  Flame,
  Wand2,
  Star
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  gameConfig?: GameSetupConfig;
  onBack: () => void;
}

export type GameMode = 'classic' | 'quiz_only' | 'power_only';

export type BearMood = 'idle' | 'thinking' | 'celebrating' | 'encouraging' | 'champion';

export interface BaamboozleTeam {
  id: string;
  name: string;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  badgeEmoji: string;
  score: number;
  streak: number;
}

export type PowerCardType =
  | 'gift_25'
  | 'steal_15'
  | 'swap_scores'
  | 'rocket_boost'
  | 'lose_15'
  | 'reset_zero'
  | 'double_score'
  | 'give_15'
  | 'skip_turn';

export interface MagicChoiceOption {
  id: string;
  label: string;
  subLabel?: string;
  emoji?: string;
  isCorrect: boolean;
}

export interface BaamboozleTile {
  id: number;
  points: number;
  isPowerCard: boolean;
  powerType?: PowerCardType;
  item?: LernstudioItem;
  promptType: 'de_to_ar' | 'ar_to_de' | 'article' | 'audio';
  question: string;
  answer: string;
  choices: MagicChoiceOption[];
  isAnswered: boolean;
  answeredByTeamId?: string;
}

const COLOR_PALETTES = [
  { name: 'Red', labelAr: 'الأحمر', bg: 'bg-gradient-to-br from-rose-500 via-red-600 to-red-700', text: 'text-red-500', border: 'border-red-400', emoji: '🦁', badge: '🔴' },
  { name: 'Blue', labelAr: 'الأزرق', bg: 'bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-700', text: 'text-blue-500', border: 'border-blue-400', emoji: '🦅', badge: '🔵' },
  { name: 'Green', labelAr: 'الأخضر', bg: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-green-700', text: 'text-emerald-500', border: 'border-emerald-400', emoji: '🐉', badge: '🟢' },
  { name: 'Yellow', labelAr: 'الأصفر', bg: 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600', text: 'text-amber-500', border: 'border-amber-400', emoji: '🐯', badge: '🟡' },
  { name: 'Purple', labelAr: 'البنفسجي', bg: 'bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700', text: 'text-purple-500', border: 'border-purple-400', emoji: '🦄', badge: '🟣' },
  { name: 'Pink', labelAr: 'الوردي', bg: 'bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-600', text: 'text-pink-500', border: 'border-pink-400', emoji: '🦊', badge: '🌸' }
];

const BEAR_ASSETS: Record<BearMood, string> = {
  idle: '/assets/games/nano_bear_idle.webp',
  thinking: '/assets/games/nano_bear_thinking.webp',
  celebrating: '/assets/games/nano_bear_celebrating.webp',
  encouraging: '/assets/games/nano_bear_encouraging.webp',
  champion: '/assets/games/nano_bear_champion.webp'
};

export function getPowerCardLocalized(type: PowerCardType, t: LernstudioTranslations) {
  const cardsMap: Record<PowerCardType, { title: string; desc: string; emoji: string; bg: string; isPositive: boolean }> = {
    gift_25: { title: t.powerGiftTitle, desc: t.powerGiftDesc, emoji: '🎁', bg: 'from-amber-500 via-yellow-500 to-amber-600 text-slate-950', isPositive: true },
    steal_15: { title: t.powerStealTitle, desc: t.powerStealDesc, emoji: '🏴‍☠️', bg: 'from-purple-600 via-violet-600 to-indigo-700 text-white', isPositive: true },
    swap_scores: { title: t.powerSwapTitle, desc: t.powerSwapDesc, emoji: '🔄', bg: 'from-cyan-600 via-sky-600 to-blue-700 text-white', isPositive: true },
    rocket_boost: { title: t.powerRocketTitle, desc: t.powerRocketDesc, emoji: '🚀', bg: 'from-rose-500 via-pink-600 to-fuchsia-700 text-white', isPositive: true },
    lose_15: { title: t.powerBombTitle, desc: t.powerBombDesc, emoji: '💥', bg: 'from-red-600 via-orange-600 to-rose-800 text-white', isPositive: false },
    reset_zero: { title: t.powerZeroTitle, desc: t.powerZeroDesc, emoji: '🧹', bg: 'from-slate-700 via-slate-800 to-slate-950 text-white', isPositive: false },
    double_score: { title: t.powerDoubleTitle, desc: t.powerDoubleDesc, emoji: '🌟', bg: 'from-amber-400 via-yellow-400 to-orange-500 text-slate-950', isPositive: true },
    give_15: { title: t.powerGiveTitle, desc: t.powerGiveDesc, emoji: '💖', bg: 'from-pink-500 via-rose-500 to-red-500 text-white', isPositive: false },
    skip_turn: { title: t.powerSkipTitle, desc: t.powerSkipDesc, emoji: '🐊', bg: 'from-emerald-600 via-teal-600 to-cyan-800 text-white', isPositive: false }
  };
  return cardsMap[type];
}

export function cleanTeamDisplayName(teamName: string): string {
  if (!teamName) return '';
  const match = teamName.match(/^[^(]+\(([^)]+)\)$/);
  if (match && match[1]) {
    return match[1].replace(/^(تيم|Team)\s+/gi, '').trim();
  }
  return teamName;
}

function extractArticle(germanWord: string): { article: 'der' | 'die' | 'das' | null; noun: string } {
  const trimmed = (germanWord || '').trim();
  const match = trimmed.match(/^(der|die|das)\s+(.+)$/i);
  if (match) {
    return {
      article: match[1].toLowerCase() as 'der' | 'die' | 'das',
      noun: match[2].trim()
    };
  }
  return { article: null, noun: trimmed };
}

function buildChoicesForItem(
  targetItem: LernstudioItem,
  allItems: LernstudioItem[],
  promptType: 'de_to_ar' | 'ar_to_de' | 'article' | 'audio',
  activeLanguage: string
): MagicChoiceOption[] {
  if (promptType === 'article') {
    const parsed = extractArticle(targetItem.german);
    if (parsed.article) {
      return (['der', 'die', 'das'] as const).map((art) => ({
        id: `art_${art}`,
        label: `${art} ${parsed.noun}`,
        subLabel: art === 'der' ? 'Maskulin' : art === 'die' ? 'Feminin' : 'Neutrum',
        emoji: art === 'der' ? '🔵' : art === 'die' ? '🔴' : '🟢',
        isCorrect: art === parsed.article
      }));
    }
  }

  const isTargetGerman = promptType === 'ar_to_de' || promptType === 'audio';
  const targetLabel = isTargetGerman
    ? targetItem.german
    : getItemTranslation(targetItem, activeLanguage) || targetItem.arabic || targetItem.english || targetItem.german;

  const distractorsPool = allItems.filter(
    (it) => it.id !== targetItem.id && it.german.toLowerCase() !== targetItem.german.toLowerCase()
  );
  const shuffledDistractors = [...distractorsPool].sort(() => 0.5 - Math.random()).slice(0, 3);

  const fallbackGermanWords = ['der Hund', 'die Katze', 'das Buch', 'der Apfel', 'die Schule', 'das Haus'];
  const fallbackTranslations =
    activeLanguage === 'ar'
      ? ['كلب 🐶', 'قطة 🐱', 'كتاب 📖', 'تفاحة 🍎', 'مدرسة 🏫', 'منزل 🏠']
      : ['Dog 🐶', 'Cat 🐱', 'Book 📖', 'Apple 🍎', 'School 🏫', 'House 🏠'];

  const options: MagicChoiceOption[] = [
    {
      id: `correct_${targetItem.id}`,
      label: targetLabel,
      subLabel: isTargetGerman
        ? getItemTranslation(targetItem, activeLanguage)
        : targetItem.german,
      emoji: targetItem.emoji || '✨',
      isCorrect: true
    }
  ];

  shuffledDistractors.forEach((dist, idx) => {
    const distLabel = isTargetGerman
      ? dist.german
      : getItemTranslation(dist, activeLanguage) || dist.arabic || dist.english || dist.german;
    if (!options.some((o) => o.label.toLowerCase() === distLabel.toLowerCase())) {
      options.push({
        id: `dist_${dist.id}_${idx}`,
        label: distLabel,
        subLabel: isTargetGerman ? getItemTranslation(dist, activeLanguage) : dist.german,
        emoji: dist.emoji || '🔮',
        isCorrect: false
      });
    }
  });

  let fallbackIdx = 0;
  while (options.length < 4 && fallbackIdx < fallbackGermanWords.length) {
    const candidate = isTargetGerman ? fallbackGermanWords[fallbackIdx] : fallbackTranslations[fallbackIdx];
    if (!options.some((o) => o.label.toLowerCase() === candidate.toLowerCase())) {
      options.push({
        id: `fallback_${fallbackIdx}`,
        label: candidate,
        emoji: '🌟',
        isCorrect: false
      });
    }
    fallbackIdx++;
  }

  return options.sort(() => 0.5 - Math.random());
}

export const LernstudioClassroomBoard: React.FC<Props> = ({
  set,
  activeTheme,
  language: propLanguage,
  gameConfig,
  onBack
}) => {
  const { groups = [], students = [], language: appLanguage = 'ar' } = useApp();
  const activeLanguage = propLanguage || appLanguage;
  const language = activeLanguage;
  const t = getLernstudioTranslations(activeLanguage);
  const { triggerSparkles, triggerFloatingText, triggerConfetti } = useGameEffects();

  // Stage Setup vs Active Magic Arena
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [timerSetting, setTimerSetting] = useState<number>(
    gameConfig?.timerSeconds !== undefined ? gameConfig.timerSeconds : 30
  );
  const [selectedTileCount, setSelectedTileCount] = useState<number>(() => {
    if (gameConfig?.questionCount) {
      if (gameConfig.questionCount <= 8) return 8;
      if (gameConfig.questionCount <= 12) return 12;
      if (gameConfig.questionCount <= 16) return 16;
      return 24;
    }
    return 12;
  });
  const [questionPromptMode, setQuestionPromptMode] = useState<'de_to_ar' | 'ar_to_de' | 'article' | 'audio' | 'mixed'>(
    gameConfig?.questionType || 'mixed'
  );

  // Day & Time Filter State
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all');

  // Active Selected Group from App
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    gameConfig?.selectedGroupId || set.assignedGroupId || ''
  );
  const [isCurrentClassNotice, setIsCurrentClassNotice] = useState<string | null>(null);

  // Team Roster Mode
  const [rosterMode, setRosterMode] = useState<'split_teams' | 'individual' | 'custom_colors'>(
    gameConfig?.rosterMode || 'split_teams'
  );
  const [teamCount, setTeamCount] = useState<number>(() => {
    if (gameConfig?.gameMode === 'pvp_3teams') return 3;
    if (gameConfig?.gameMode === 'pvp_4teams') return 4;
    if (gameConfig?.teamNames && gameConfig.teamNames.length > 0) return Math.min(6, Math.max(2, gameConfig.teamNames.length));
    return 2;
  });

  // Professor Nano Bear State
  const [bearMood, setBearMood] = useState<BearMood>('idle');
  const [bearMessage, setBearMessage] = useState<string>('');

  // Filtered Groups list
  const filteredAppGroups = useMemo(() => {
    return filterGroupsByDayAndTime(groups, filterDay, filterTime);
  }, [groups, filterDay, filterTime]);

  // Teams Setup State
  const [teams, setTeams] = useState<BaamboozleTeam[]>([]);
  const [activeTeamIndex, setActiveTeamIndex] = useState<number>(0);

  // Tiles State
  const [tiles, setTiles] = useState<BaamboozleTile[]>([]);

  // Active Selected Tile Modal State
  const [activeTile, setActiveTile] = useState<BaamboozleTile | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [choiceFeedback, setChoiceFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // GameOver Victory State
  const [isGameOver, setIsGameOver] = useState(false);

  // Undo History Stack
  const [historyStack, setHistoryStack] = useState<
    { tiles: BaamboozleTile[]; teams: BaamboozleTeam[]; activeIndex: number }[]
  >([]);

  // Default welcome speech for Professor Nano Bear
  const getDefaultBearSpeech = useCallback(
    (teamName?: string) => {
      const cleanName = cleanTeamDisplayName(teamName || '');
      if (language === 'ar') {
        return cleanName
          ? `أهلاً بكم في مسرح البروفيسور نانو السحري! دور ${cleanName}، افتحوا صندوق الكنز!`
          : 'مرحباً يا أبطال! أنا البروفيسور نانو، افتحوا صناديق الكنز السحرية لنجمع النجوم!';
      }
      if (language === 'de') {
        return cleanName
          ? `Willkommen in Professor Nanos Zaubershow! ${cleanName} ist dran – wählt eine Schatztruhe!`
          : 'Hallo Champions! Ich bin Professor Nano. Öffnet eine magische Schatztruhe!';
      }
      return cleanName
        ? `Welcome to Professor Nano's Magic Stage! ${cleanName}'s turn — pick a mystery treasure chest!`
        : "Welcome Champions! I'm Professor Nano Bear. Open a mystery chest to win magic stars!";
    },
    [language]
  );

  // Build teams from gameConfig or group selection
  useEffect(() => {
    if (gameConfig?.teamNames && gameConfig.teamNames.length > 0 && teams.length === 0) {
      const configuredTeams: BaamboozleTeam[] = gameConfig.teamNames.map((tName, i) => {
        const color = COLOR_PALETTES[i % COLOR_PALETTES.length];
        return {
          id: `cfg_team_${i + 1}`,
          name: tName,
          colorBg: color.bg,
          colorText: color.text,
          colorBorder: color.border,
          badgeEmoji: color.emoji,
          score: 0,
          streak: 0
        };
      });
      setTeams(configuredTeams);
      return;
    }

    const groupStudents = getStudentsForGroup(students, selectedGroupId);

    if (rosterMode === 'individual' && groupStudents.length > 0) {
      const newTeams: BaamboozleTeam[] = groupStudents.map((st, i) => {
        const color = COLOR_PALETTES[i % COLOR_PALETTES.length];
        return {
          id: st.id,
          name: st.name,
          colorBg: color.bg,
          colorText: color.text,
          colorBorder: color.border,
          badgeEmoji: color.emoji,
          score: 0,
          streak: 0
        };
      });
      setTeams(newTeams);
    } else if (rosterMode === 'split_teams' && groupStudents.length > 0) {
      const newTeams: BaamboozleTeam[] = Array.from({ length: teamCount }).map((_, teamIdx) => {
        const assignedStudents = groupStudents.filter((_, sIdx) => sIdx % teamCount === teamIdx);
        const names = assignedStudents.map((s) => s.name).join(', ');
        const color = COLOR_PALETTES[teamIdx % COLOR_PALETTES.length];
        return {
          id: `team_${teamIdx + 1}`,
          name:
            assignedStudents.length > 0
              ? names
              : language === 'ar'
              ? `الفريق ${color.labelAr || color.name} ${color.emoji}`
              : `Team ${color.name} ${color.emoji}`,
          colorBg: color.bg,
          colorText: color.text,
          colorBorder: color.border,
          badgeEmoji: color.emoji,
          score: 0,
          streak: 0
        };
      });
      setTeams(newTeams);
    } else {
      const baseColors = COLOR_PALETTES.slice(0, teamCount);
      const newTeams: BaamboozleTeam[] = baseColors.map((c, i) => ({
        id: `t_${i + 1}`,
        name: language === 'ar' ? `الفريق ${c.labelAr || c.name} ${c.emoji}` : `Team ${c.name} ${c.emoji}`,
        colorBg: c.bg,
        colorText: c.text,
        colorBorder: c.border,
        badgeEmoji: c.emoji,
        score: 0,
        streak: 0
      }));
      setTeams(newTeams);
    }
  }, [selectedGroupId, rosterMode, teamCount, groups, students, language, gameConfig]);

  // Generate tiles helper
  const buildGameTiles = useCallback(
    (tileCountToBuild: number, modeToBuild: GameMode, promptModeToUse: typeof questionPromptMode) => {
      const items = [...(set.items || [])];
      if (items.length === 0) return [];

      const pool: LernstudioItem[] = [];
      while (pool.length < tileCountToBuild) {
        const shuffled = [...items].sort(() => 0.5 - Math.random());
        pool.push(...shuffled);
      }
      const finalItems = pool.slice(0, tileCountToBuild);

      const powerTypesList: PowerCardType[] = [
        'gift_25',
        'steal_15',
        'swap_scores',
        'rocket_boost',
        'lose_15',
        'reset_zero',
        'double_score',
        'give_15',
        'skip_turn'
      ];

      const modesCycle: ('de_to_ar' | 'ar_to_de' | 'article' | 'audio')[] = [
        'ar_to_de',
        'de_to_ar',
        'audio',
        'article'
      ];

      return finalItems.map((item, idx) => {
        const isPower =
          modeToBuild === 'power_only' ? true : modeToBuild === 'classic' ? idx % 4 === 3 && Math.random() < 0.75 : false;
        const randomPower = powerTypesList[Math.floor(Math.random() * powerTypesList.length)];
        const points = ((idx % 4) + 1) * 10 + 5; // 15, 25, 35, 45

        let resolvedPrompt: 'de_to_ar' | 'ar_to_de' | 'article' | 'audio' =
          promptModeToUse === 'mixed' ? modesCycle[idx % modesCycle.length] : promptModeToUse;

        if (resolvedPrompt === 'article' && !extractArticle(item.german).article) {
          resolvedPrompt = 'ar_to_de';
        }

        const translationText =
          getItemTranslation(item, activeLanguage) ||
          item.arabic ||
          item.english ||
          item.exampleSentenceArabic ||
          item.german;

        let questionText = translationText;
        if (resolvedPrompt === 'de_to_ar') {
          questionText = item.german;
        } else if (resolvedPrompt === 'article') {
          const parsed = extractArticle(item.german);
          questionText = `___ ${parsed.noun} (${translationText})`;
        } else if (resolvedPrompt === 'audio') {
          questionText =
            activeLanguage === 'ar'
              ? `استمع للكلمة واختر الإجابة الصحيحة: (${translationText})`
              : activeLanguage === 'de'
              ? `Hör gut zu und wähle das Wort: (${translationText})`
              : `Listen carefully and choose the German word: (${translationText})`;
        }

        const choices = buildChoicesForItem(item, items, resolvedPrompt, activeLanguage);

        return {
          id: idx + 1,
          points,
          isPowerCard: isPower,
          powerType: isPower ? randomPower : undefined,
          item,
          promptType: resolvedPrompt,
          question: questionText,
          answer:
            item.german +
            (item.plural ? ` (Plural: ${item.plural})` : '') +
            (item.exampleSentenceGerman ? ` • ${item.exampleSentenceGerman}` : ''),
          choices,
          isAnswered: false
        };
      });
    },
    [set.items, activeLanguage]
  );

  // Auto-launch into the Magic Stage when arriving from LernstudioGameSetupScreen
  useEffect(() => {
    if (gameConfig && !isPlaying && tiles.length === 0 && teams.length > 0 && (set.items?.length || 0) > 0) {
      const built = buildGameTiles(selectedTileCount, gameMode, questionPromptMode);
      if (built.length > 0) {
        setTiles(built);
        setActiveTeamIndex(0);
        setIsGameOver(false);
        setIsPlaying(true);
        setBearMood('idle');
        setBearMessage(getDefaultBearSpeech(teams[0]?.name));
      }
    }
  }, [gameConfig, isPlaying, tiles.length, teams, set.items, selectedTileCount, gameMode, questionPromptMode, buildGameTiles, getDefaultBearSpeech]);

  // Auto-detect current active scheduled class
  const handleDetectCurrentClass = () => {
    const match = detectCurrentScheduledGroup(groups, new Date());
    if (match.group) {
      setSelectedGroupId(match.group.id);
      setIsCurrentClassNotice(`${t.currentClassActiveNote} (${match.group.name})`);
    } else {
      setIsCurrentClassNotice(t.noCurrentClassFound);
    }
    setTimeout(() => setIsCurrentClassNotice(null), 4000);
  };

  // Start / Restart Game
  const handleStartGame = () => {
    const items = [...(set.items || [])];
    if (items.length === 0 || teams.length === 0) return;

    const generatedTiles = buildGameTiles(selectedTileCount, gameMode, questionPromptMode);
    setTiles(generatedTiles);
    setTeams((prev) => prev.map((team) => ({ ...team, score: 0, streak: 0 })));
    setActiveTeamIndex(0);
    setIsGameOver(false);
    setIsPlaying(true);
    setHistoryStack([]);
    setActiveTile(null);
    setShowAnswer(false);
    setSelectedChoiceId(null);
    setChoiceFeedback(null);
    setBearMood('idle');
    setBearMessage(getDefaultBearSpeech(teams[0]?.name));
    playLernstudioSound('powerup_star');
  };

  // Turn Navigation helper
  const advanceTurn = (nextTeamsState?: BaamboozleTeam[]) => {
    const list = nextTeamsState || teams;
    const nextIdx = (activeTeamIndex + 1) % Math.max(1, list.length);
    setActiveTeamIndex(nextIdx);
    const nextTeam = list[nextIdx];
    setTimeout(() => {
      setBearMood('idle');
      setBearMessage(getDefaultBearSpeech(nextTeam?.name));
    }, 1400);
  };

  const saveHistory = () => {
    setHistoryStack((prev) => [
      ...prev,
      {
        tiles: tiles.map((tile) => ({ ...tile })),
        teams: teams.map((team) => ({ ...team })),
        activeIndex: activeTeamIndex
      }
    ]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const lastState = historyStack[historyStack.length - 1];
    setTiles(lastState.tiles);
    setTeams(lastState.teams);
    setActiveTeamIndex(lastState.activeIndex);
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));
    setBearMood('idle');
    setBearMessage(
      language === 'ar'
        ? 'تم التراجع بخطوة سحرية للوراء! ✨'
        : language === 'de'
        ? 'Magischer Zeitsprung zurück! ✨'
        : 'Magic time-turner! Last turn undone ✨'
    );
  };

  // Timer Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev !== null && prev > 1 ? prev - 1 : 0));
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      setBearMood('encouraging');
      setBearMessage(
        language === 'ar'
          ? 'انتهى الوقت! لا تقلقوا، اختاروا الإجابة أو اكشفوا الحل معاً!'
          : language === 'de'
          ? 'Die Zeit ist um! Wählt jetzt gemeinsam die richtige Rune!'
          : "Time's up! Pick your best answer rune together!"
      );
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds, language]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const checkGameOver = (allDone: boolean) => {
    if (allDone) {
      setIsGameOver(true);
      setBearMood('champion');
      playLernstudioSound('fanfare_victory');
      playGermanVoiceFeedback('gewonnen');
      triggerConfetti();
    }
  };

  // Apply Power Card Action
  const handleApplyPowerCard = (tile: BaamboozleTile) => {
    if (!tile.powerType) return;
    saveHistory();

    const activeTeam = teams[activeTeamIndex];
    const otherTeamIndex = (activeTeamIndex + 1) % teams.length;
    const otherTeam = teams[otherTeamIndex] || activeTeam;

    const updatedTeams = teams.map((team) => ({ ...team }));
    const cardMeta = getPowerCardLocalized(tile.powerType, t);

    switch (tile.powerType) {
      case 'gift_25':
        updatedTeams[activeTeamIndex].score += 25;
        triggerFloatingText('+25 🎁', 50, 40, '#fbbf24');
        break;
      case 'steal_15': {
        const stolen = Math.min(otherTeam.score, 15);
        updatedTeams[otherTeamIndex].score -= stolen;
        updatedTeams[activeTeamIndex].score += stolen;
        triggerFloatingText(`+${stolen} 🏴‍☠️`, 50, 40, '#a855f7');
        break;
      }
      case 'swap_scores': {
        const tempScore = updatedTeams[activeTeamIndex].score;
        updatedTeams[activeTeamIndex].score = updatedTeams[otherTeamIndex].score;
        updatedTeams[otherTeamIndex].score = tempScore;
        triggerFloatingText('🔄 SWAP!', 50, 40, '#38bdf8');
        break;
      }
      case 'rocket_boost': {
        const maxScore = Math.max(...updatedTeams.map((team) => team.score));
        updatedTeams[activeTeamIndex].score = maxScore + 10;
        triggerFloatingText('🚀 ROCKET #1!', 50, 40, '#f43f5e');
        break;
      }
      case 'lose_15':
        updatedTeams[activeTeamIndex].score = Math.max(0, updatedTeams[activeTeamIndex].score - 15);
        triggerFloatingText('-15 💥', 50, 40, '#ef4444');
        break;
      case 'reset_zero':
        updatedTeams[activeTeamIndex].score = 0;
        triggerFloatingText('🧹 0 PTS', 50, 40, '#94a3b8');
        break;
      case 'double_score':
        updatedTeams[activeTeamIndex].score *= 2;
        triggerFloatingText('x2 🌟!', 50, 40, '#facc15');
        break;
      case 'give_15':
        updatedTeams[activeTeamIndex].score = Math.max(0, updatedTeams[activeTeamIndex].score - 15);
        updatedTeams[otherTeamIndex].score += 15;
        triggerFloatingText('💖 +15', 50, 40, '#ec4899');
        break;
      case 'skip_turn':
        triggerFloatingText('🐊 SKIP!', 50, 40, '#10b981');
        break;
    }

    setTeams(updatedTeams);
    setTiles((prev) =>
      prev.map((tItem) =>
        tItem.id === tile.id ? { ...tItem, isAnswered: true, answeredByTeamId: activeTeam.id } : tItem
      )
    );

    setBearMood(cardMeta.isPositive ? 'celebrating' : 'encouraging');
    setBearMessage(`${cardMeta.emoji} ${cardMeta.title}!`);
    triggerSparkles(50, 50, '#fbbf24');
    setActiveTile(null);
    setShowAnswer(false);
    setSelectedChoiceId(null);
    setChoiceFeedback(null);
    setIsTimerRunning(false);

    const remainingCount = tiles.filter((tItem) => tItem.id !== tile.id && !tItem.isAnswered).length;
    if (remainingCount === 0) {
      checkGameOver(true);
    } else {
      advanceTurn(updatedTeams);
    }
  };

  // Award Question Points (via Interactive Choice Rune OR Teacher Judge Button)
  const handleAwardQuestion = (isCorrect: boolean) => {
    if (!activeTile) return;
    saveHistory();
    setIsTimerRunning(false);

    const activeTeam = teams[activeTeamIndex];
    const newStreak = isCorrect ? (activeTeam?.streak || 0) + 1 : 0;
    const streakBonus = isCorrect && newStreak >= 2 ? 5 : 0;
    const totalPointsAwarded = isCorrect ? activeTile.points + streakBonus : 0;

    const updatedTeams = teams.map((team, idx) =>
      idx === activeTeamIndex
        ? {
            ...team,
            score: team.score + totalPointsAwarded,
            streak: newStreak
          }
        : team
    );

    setTeams(updatedTeams);

    if (isCorrect) {
      playLernstudioSound('correct');
      playGermanVoiceFeedback('richtig');
      if (activeTile.item?.german) {
        setTimeout(() => speakGermanText(activeTile.item!.german, 0.9), 350);
      }
      triggerSparkles(50, 50, '#10b981');
      triggerFloatingText(
        streakBonus > 0
          ? `+${totalPointsAwarded} ★ (${newStreak}x COMBO!)`
          : `+${activeTile.points} ★ Richtig!`,
        50,
        40,
        '#fbbf24'
      );
      setBearMood('celebrating');
      setBearMessage(
        language === 'ar'
          ? `رائع يا ${cleanTeamDisplayName(activeTeam.name)}! إجابة صحيحة (+${totalPointsAwarded} نقطة)! 🌟`
          : language === 'de'
          ? `Fantastisch, ${cleanTeamDisplayName(activeTeam.name)}! +${totalPointsAwarded} Zauberpunkte! 🌟`
          : `Awesome job, ${cleanTeamDisplayName(activeTeam.name)}! +${totalPointsAwarded} Magic Points! 🌟`
      );
    } else {
      playLernstudioSound('wrong');
      playGermanVoiceFeedback('noch_einmal');
      if (activeTile.item?.german) {
        setTimeout(() => speakGermanText(activeTile.item!.german, 0.85), 350);
      }
      setBearMood('encouraging');
      setBearMessage(
        language === 'ar'
          ? `محاولة شجاعة! الكلمة الصحيحة هي "${activeTile.item?.german || activeTile.answer}" — ستنجحون في الصندوق القادم! 💪`
          : language === 'de'
          ? `Guter Versuch! Das richtige Wort lautet „${activeTile.item?.german || activeTile.answer}“ — weiter so! 💪`
          : `Good try! The German word is "${activeTile.item?.german || activeTile.answer}" — you'll get the next chest! 💪`
      );
    }

    const remainingTiles = tiles.filter((tItem) => tItem.id !== activeTile.id && !tItem.isAnswered);

    setTiles((prev) =>
      prev.map((tItem) =>
        tItem.id === activeTile.id
          ? { ...tItem, isAnswered: true, answeredByTeamId: isCorrect ? activeTeam.id : undefined }
          : tItem
      )
    );

    setActiveTile(null);
    setShowAnswer(false);
    setSelectedChoiceId(null);
    setChoiceFeedback(null);

    if (remainingTiles.length === 0) {
      checkGameOver(true);
    } else {
      advanceTurn(updatedTeams);
    }
  };

  // Interactive Kid-Friendly Choice Tap Handler
  const handleSelectMagicChoice = (choice: MagicChoiceOption) => {
    if (!activeTile || choiceFeedback !== null) return;
    setSelectedChoiceId(choice.id);
    setShowAnswer(true);
    setIsTimerRunning(false);

    if (choice.isCorrect) {
      setChoiceFeedback('correct');
      setBearMood('celebrating');
      playLernstudioSound('correct');
      triggerSparkles(50, 48, '#10b981');
      setTimeout(() => {
        handleAwardQuestion(true);
      }, 1150);
    } else {
      setChoiceFeedback('wrong');
      setBearMood('encouraging');
      playLernstudioSound('wrong');
      if (activeTile.item?.german) {
        speakGermanText(activeTile.item.german, 0.85);
      }
    }
  };

  const handleUpdateTeamScore = (teamIndex: number, delta: number) => {
    saveHistory();
    setTeams((prev) =>
      prev.map((team, idx) => (idx === teamIndex ? { ...team, score: Math.max(0, team.score + delta) } : team))
    );
    playLernstudioSound(delta > 0 ? 'correct' : 'wrong');
  };

  const handleTapNanoBear = () => {
    playLernstudioSound('powerup_star');
    triggerSparkles(25, 25, '#fbbf24');
    const cheers =
      language === 'ar'
        ? [
            'أنا البروفيسور نانو! الصناديق الحمراء والذهبية تخبئ أكبر النقاط! 💎',
            'نصيحة سحرية: استمعوا لنطق الكلمة الألمانية ببطء (0.6x) لتتذكروها دائماً! 🎧',
            'إجابتان متتاليتان تمنحكم مكافأة الكومبو السحري (+5 نقاط إضافية)! 🔥'
          ]
        : language === 'de'
        ? [
            'Tipp von Professor Nano: Rote Rubin-Truhen bringen 45 Punkte! 💎',
            'Hört euch das Wort mit der Schnecken-Taste (0.6x) ganz langsam an! 🐌',
            'Zwei richtige Antworten hintereinander geben +5 Combo-Punkte! 🔥'
          ]
        : [
            'Professor Nano Tip: Ruby Chests hold 45 magic points! 💎',
            'Use the Snail Button (0.6x) to hear every German syllable clearly! 🐌',
            '2 correct answers in a row unlock a +5 Streak Combo bonus! 🔥'
          ];
    setBearMood('celebrating');
    setBearMessage(cheers[Math.floor(Math.random() * cheers.length)]);
  };

  const currentActiveTeam = teams[activeTeamIndex] || {
    id: 'default',
    name: 'Team 1',
    score: 0,
    streak: 0,
    badgeEmoji: '🦁',
    colorBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    colorText: 'text-amber-500',
    colorBorder: 'border-amber-400'
  };

  const answeredCount = tiles.filter((tItem) => tItem.isAnswered).length;
  const progressPercent = tiles.length > 0 ? Math.round((answeredCount / tiles.length) * 100) : 0;

  // ============================================================================
  // 1. STAGE SETUP LOBBY (Customizable Magic Show Setup)
  // ============================================================================
  if (!isPlaying) {
    return (
      <div
        className="relative overflow-hidden rounded-3xl border border-amber-400/30 shadow-2xl bg-slate-950 text-white"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Illustrated Magic Stage Backdrop */}
        <div className="relative h-56 sm:h-64 w-full overflow-hidden">
          <img
            src="/assets/games/classroom_stage.webp"
            alt="Professor Nano Bear Magic Stage"
            className="w-full h-full object-cover object-center scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20" />

          {/* Back & Set Title Top Bar */}
          <div className="absolute top-4 inset-x-4 flex items-center justify-between gap-3 z-20">
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-white border border-white/15 backdrop-blur-md text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-lg"
            >
              <ArrowRight className={`w-4 h-4 ${language !== 'ar' ? 'rotate-180' : ''}`} />
              <span>{language === 'ar' ? 'رجوع للألعاب' : language === 'de' ? 'Zurück' : 'Back to Games'}</span>
            </button>

            <div className="px-3.5 py-1.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 backdrop-blur-md text-amber-300 text-xs font-black inline-flex items-center gap-1.5">
              <Wand2 className="w-4 h-4" />
              <span>{set.title}</span>
              <span className="opacity-75 font-mono tabular-nums">({set.items?.length || 0})</span>
            </div>
          </div>

          {/* Professor Nano Bear Hero Welcome on Stage */}
          <div className="absolute bottom-3 inset-x-4 sm:inset-x-8 flex items-end gap-4 z-10">
            <motion.img
              src={BEAR_ASSETS.idle}
              alt="Professor Nano Bear"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover border-2 border-amber-400 shadow-2xl shrink-0 bg-slate-900"
            />
            <div className="space-y-1 pb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                {language === 'ar'
                  ? 'مسرح البروفيسور نانو السحري'
                  : language === 'de'
                  ? 'Professor Nanos Zauberbühne'
                  : "Professor Nano's Magic Stage"}
              </span>
              <h1 className="text-xl sm:text-3xl font-black text-white drop-shadow-md">
                {t.boardTitle}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-bold">
                {language === 'ar'
                  ? 'اختر نظام اللعب والفرق، ثم افتح صناديق الكنز السحرية واجمع النجوم الذهبية!'
                  : language === 'de'
                  ? 'Wähle deinen Spielmodus und öffne magische Schatztruhen mit Professor Nano!'
                  : 'Configure your magic show and unlock enchanted treasure chests with Professor Nano!'}
              </p>
            </div>
          </div>
        </div>

        {/* Setup Configuration Panel */}
        <div className="p-5 sm:p-8 space-y-6 max-w-4xl mx-auto">
          {/* 1. Magic Show Mode Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-black text-amber-300 block">
              {t.selectGameMode}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setGameMode('classic')}
                className={`p-4 rounded-2xl border-2 text-start space-y-1.5 transition-all cursor-pointer ${
                  gameMode === 'classic'
                    ? 'border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-amber-300">{t.modeClassicTitle}</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-[11px] text-slate-300">{t.modeClassicDesc}</p>
              </button>

              <button
                type="button"
                onClick={() => setGameMode('quiz_only')}
                className={`p-4 rounded-2xl border-2 text-start space-y-1.5 transition-all cursor-pointer ${
                  gameMode === 'quiz_only'
                    ? 'border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-emerald-300">{t.modeQuizTitle}</span>
                  <Award className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-slate-300">{t.modeQuizDesc}</p>
              </button>

              <button
                type="button"
                onClick={() => setGameMode('power_only')}
                className={`p-4 rounded-2xl border-2 text-start space-y-1.5 transition-all cursor-pointer ${
                  gameMode === 'power_only'
                    ? 'border-purple-400 bg-purple-500/15 shadow-lg shadow-purple-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-purple-300">{t.modePartyTitle}</span>
                  <Zap className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-[11px] text-slate-300">{t.modePartyDesc}</p>
              </button>
            </div>
          </div>

          {/* 2. Group & Roster Selection Section */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                <span>{t.selectGroupHeader}</span>
              </label>

              <button
                type="button"
                onClick={handleDetectCurrentClass}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>{t.currentClassBtn}</span>
              </button>
            </div>

            {isCurrentClassNotice && (
              <div className="p-3 bg-amber-500/15 border border-amber-400/40 rounded-2xl text-xs font-extrabold text-amber-300 flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{isCurrentClassNotice}</span>
              </div>
            )}

            {/* Day and Time Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-400 shrink-0">{t.filterByDay}</span>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-white/15 bg-slate-900 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
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
                <span className="font-bold text-slate-400 shrink-0">{t.filterByTime}</span>
                <select
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-white/15 bg-slate-900 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">{t.allTimes}</option>
                  <option value="morning">{t.morningTime}</option>
                  <option value="afternoon">{t.afternoonTime}</option>
                  <option value="evening">{t.eveningTime}</option>
                </select>
              </div>
            </div>

            {/* Group Selector Dropdown */}
            <div>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-white/15 rounded-2xl text-xs font-black text-white focus:outline-none focus:border-amber-400"
              >
                <option value="">-- {t.allGroups} --</option>
                {filteredAppGroups.map((g) => {
                  const studentCount = getStudentsForGroup(students, g.id).length;
                  return (
                    <option key={g.id} value={g.id}>
                      🏫 {g.name} ({studentCount}) • {g.grade}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Roster & Team Distribution Mode */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-black text-amber-300 block">{t.playStyleHeader}</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRosterMode('split_teams')}
                  className={`p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    rosterMode === 'split_teams'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 border-white/15 text-white'
                  }`}
                >
                  {t.splitGroupTeams}
                </button>

                <button
                  type="button"
                  onClick={() => setRosterMode('individual')}
                  className={`p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    rosterMode === 'individual'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 border-white/15 text-white'
                  }`}
                >
                  {t.individualStudents}
                </button>

                <button
                  type="button"
                  onClick={() => setRosterMode('custom_colors')}
                  className={`p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    rosterMode === 'custom_colors'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 border-white/15 text-white'
                  }`}
                >
                  {t.customTeams}
                </button>
              </div>
            </div>

            {/* Team Count Selector */}
            {rosterMode !== 'individual' && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-300">{t.teamsCount}</span>
                <div className="flex gap-1.5">
                  {[2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTeamCount(count)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer tabular-nums ${
                        teamCount === count ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Editable Teams List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {teams.map((team, idx) => (
                <div
                  key={team.id}
                  className="p-2.5 bg-white/5 border border-white/15 rounded-2xl flex items-center gap-2"
                >
                  <span className="text-lg">{team.badgeEmoji}</span>
                  <input
                    type="text"
                    value={team.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setTeams((prev) => prev.map((tItem, i) => (i === idx ? { ...tItem, name: newName } : tItem)));
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 3. Chests Count, Question Style & Timer Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
            <div>
              <label className="text-xs font-black text-amber-300 block mb-1.5">{t.tilesCount}</label>
              <select
                value={selectedTileCount}
                onChange={(e) => setSelectedTileCount(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              >
                <option value={8}>8 {language === 'ar' ? 'صناديق كنز (سريع)' : 'Treasure Chests (Fast)'}</option>
                <option value={12}>12 {language === 'ar' ? 'صندوق كنز (3×4)' : 'Treasure Chests (3x4)'}</option>
                <option value={16}>16 {language === 'ar' ? 'صندوق كنز (4×4)' : 'Treasure Chests (4x4)'}</option>
                <option value={24}>24 {language === 'ar' ? 'صندوق كنز (4×6)' : 'Treasure Chests (4x6)'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-amber-300 block mb-1.5">
                {language === 'ar' ? 'نوع التحدي السحري' : language === 'de' ? 'Fragetyp' : 'Challenge Style'}
              </label>
              <select
                value={questionPromptMode}
                onChange={(e) => setQuestionPromptMode(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              >
                <option value="mixed">{language === 'ar' ? 'شامل ومتنوع 🌟' : 'Mixed Magic Challenges 🌟'}</option>
                <option value="ar_to_de">{language === 'ar' ? 'اختر الكلمة الألمانية 🇩🇪' : 'Choose German Word 🇩🇪'}</option>
                <option value="de_to_ar">{language === 'ar' ? 'اختر المعنى الصحيح 🌍' : 'Choose Translation 🌍'}</option>
                <option value="article">{language === 'ar' ? 'تحدي أداة التعريف (der/die/das)' : 'Article (der/die/das)'}</option>
                <option value="audio">{language === 'ar' ? 'تحدي الاستماع الصوتي 🎧' : 'Audio Listening 🎧'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-amber-300 block mb-1.5">{t.timerSettingLabel}</label>
              <select
                value={timerSetting}
                onChange={(e) => setTimerSetting(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              >
                <option value={0}>{t.noTimer}</option>
                <option value={15}>15 {t.secondsText}</option>
                <option value={30}>30 {t.secondsText}</option>
                <option value={60}>60 {t.secondsText}</option>
              </select>
            </div>
          </div>

          {/* Launch Magic Show Button */}
          <div className="pt-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartGame}
              className="w-full py-4 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 rounded-2xl text-base font-black shadow-xl shadow-amber-500/20 cursor-pointer inline-flex items-center justify-center gap-2.5"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>{t.launchBoardBtn}</span>
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. GRAND CHAMPIONSHIP CEREMONY (Victory Screen with Royal Professor Nano Bear)
  // ============================================================================
  if (isGameOver) {
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    const winner = sortedTeams[0] || { name: 'Winner', score: 0, badgeEmoji: '👑' };

    return (
      <div
        className="relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-slate-950 text-white p-6 sm:p-10 text-center space-y-7 shadow-2xl"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Background Stage Art */}
        <div className="absolute inset-0 opacity-35 pointer-events-none">
          <img src="/assets/games/classroom_stage.webp" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/40" />
        </div>

        <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
          {/* Royal Professor Nano Bear + Golden Trophy */}
          <div className="flex items-center justify-center gap-4">
            <motion.img
              src={BEAR_ASSETS.champion}
              alt="Champion Professor Nano Bear"
              initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0, y: [0, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover border-4 border-amber-400 shadow-2xl bg-slate-900"
            />
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border-2 border-amber-400/60 shadow-2xl hidden sm:block"
            >
              <SharedVictoryTrophyArt className="w-full h-full object-cover" />
            </motion.div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest block">
              {t.winnerTitle}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white drop-shadow-md">
              {t.winnerFirstPlace}{' '}
              <span className="text-amber-400">
                {winner.badgeEmoji} {cleanTeamDisplayName(winner.name)} 🎉
              </span>
            </h2>
            <p className="text-sm sm:text-base font-extrabold text-amber-200 font-mono tabular-nums">
              {t.winnerScore} {winner.score} {t.scorePts}
            </p>
          </div>

          {/* Animated 3D Podium Stand */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-lg mx-auto items-end pt-4">
            {sortedTeams[1] ? (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="p-4 bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-500/40 rounded-t-3xl space-y-1.5 shadow-xl"
              >
                <span className="text-3xl block">🥈</span>
                <span className="text-xs font-black text-white block truncate">
                  {cleanTeamDisplayName(sortedTeams[1].name)}
                </span>
                <span className="text-xs font-black text-slate-300 font-mono tabular-nums block">
                  {sortedTeams[1].score} pts
                </span>
              </motion.div>
            ) : (
              <div />
            )}

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="p-5 sm:p-6 bg-gradient-to-b from-amber-300 via-amber-400 to-yellow-500 text-slate-950 rounded-t-3xl space-y-1.5 shadow-2xl shadow-amber-500/30 transform scale-105 border-2 border-white/60"
            >
              <span className="text-4xl block">🥇</span>
              <span className="text-xs sm:text-sm font-black block truncate">
                {cleanTeamDisplayName(winner.name)}
              </span>
              <span className="text-base sm:text-lg font-black font-mono tabular-nums block">
                {winner.score} pts
              </span>
            </motion.div>

            {sortedTeams[2] ? (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="p-4 bg-gradient-to-b from-amber-800/80 to-amber-950 border border-amber-600/40 rounded-t-3xl space-y-1.5 shadow-xl"
              >
                <span className="text-3xl block">🥉</span>
                <span className="text-xs font-black text-amber-100 block truncate">
                  {cleanTeamDisplayName(sortedTeams[2].name)}
                </span>
                <span className="text-xs font-black text-amber-300 font-mono tabular-nums block">
                  {sortedTeams[2].score} pts
                </span>
              </motion.div>
            ) : (
              <div />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 flex-wrap pt-4">
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleStartGame}
              className="px-7 py-3.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 rounded-2xl text-xs sm:text-sm font-black shadow-xl cursor-pointer inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.playNewGame}</span>
            </motion.button>

            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              className="px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition-all"
            >
              {t.adjustSettings}
            </button>

            <button
              type="button"
              onClick={onBack}
              className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-300 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition-all"
            >
              {language === 'ar' ? 'كل الألعاب' : 'All Games'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 3. ACTIVE ENCHANTED MAGIC ARENA (Main Gameplay Stage)
  // ============================================================================
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-950 text-white shadow-2xl p-3.5 sm:p-6 space-y-4 sm:space-y-5"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Illustrated Pixar-Style Magic Studio Stage World Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src="/assets/games/classroom_stage.webp"
          alt=""
          className="w-full h-full object-cover object-top opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/65 via-slate-950/75 to-slate-950/95" />
      </div>

      {/* Stage Top Control Bar */}
      <div className="relative z-10 flex items-center justify-between gap-2.5 flex-wrap bg-slate-900/80 backdrop-blur-md p-2.5 sm:p-3.5 rounded-2xl border border-white/15 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <ArrowRight className={`w-3.5 h-3.5 ${language !== 'ar' ? 'rotate-180' : ''}`} />
            <span>{language === 'ar' ? 'خروج' : 'Exit'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(false)}
            className="px-3 py-1.5 text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-xl text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{t.settingsBtn}</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-black text-white truncate max-w-[180px]">{set.title}</span>
          </div>
        </div>

        {/* Visual Treasure Progress Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-xs mx-auto">
          <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="text-[11px] font-mono font-black text-amber-300 tabular-nums shrink-0">
            {answeredCount}/{tiles.length}
          </span>
        </div>

        {/* Utility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            disabled={historyStack.length === 0}
            onClick={handleUndo}
            className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30 cursor-pointer inline-flex items-center gap-1 tabular-nums"
            title={t.undoBtn}
          >
            <Undo2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">{t.undoBtn}</span>
            <span>({historyStack.length})</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            title={isFullscreen ? t.minimize : t.fullscreen}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => checkGameOver(true)}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>{t.endGameBtn}</span>
          </button>
        </div>
      </div>

      {/* PROFESSOR NANO BEAR INTERACTIVE COMPANION STAGE HOST BAR */}
      <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 bg-gradient-to-r from-indigo-950/90 via-purple-950/85 to-slate-900/90 backdrop-blur-md p-3.5 sm:p-4 rounded-3xl border border-amber-400/35 shadow-xl">
        <div className="flex items-center gap-3.5">
          <motion.button
            type="button"
            onClick={handleTapNanoBear}
            whileHover={{ scale: 1.06, rotate: 2 }}
            whileTap={{ scale: 0.92 }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-lg shadow-amber-500/20 shrink-0 cursor-pointer bg-slate-900 group"
            title={language === 'ar' ? 'اضغط لنصيحة سحرية من البروفيسور نانو!' : 'Tap Professor Nano for a magic tip!'}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={bearMood}
                src={BEAR_ASSETS[bearMood]}
                alt="Professor Nano Bear"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full object-cover"
              />
            </AnimatePresence>
            <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[10px] font-black shadow">
              ✨
            </span>
          </motion.button>

          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-amber-400 tracking-wide">
                {language === 'ar' ? 'البروفيسور نانو بير 🪄' : 'Professor Nano Bear 🪄'}
              </span>
              <span className="text-[11px] font-extrabold text-emerald-300">
                • {t.currentTurn}: {currentActiveTeam.badgeEmoji} {cleanTeamDisplayName(currentActiveTeam.name)}
              </span>
            </div>
            <motion.p
              key={bearMessage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs sm:text-sm font-bold text-white leading-snug"
            >
              {bearMessage || getDefaultBearSpeech(currentActiveTeam.name)}
            </motion.p>
          </div>
        </div>

        {/* Active Turn Spotlight Indicator */}
        <div
          className={`px-4 py-2.5 rounded-2xl ${currentActiveTeam.colorBg} text-white shadow-lg border border-white/25 flex items-center justify-between md:justify-center gap-3 shrink-0`}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentActiveTeam.badgeEmoji}</span>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-90 block">
                {language === 'ar' ? 'الفريق صاحب الدور' : language === 'de' ? 'Am Zug' : 'Active Turn'}
              </span>
              <span className="text-xs sm:text-sm font-black block">
                {cleanTeamDisplayName(currentActiveTeam.name)}
              </span>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-xl bg-black/30 font-mono font-black text-sm tabular-nums">
            {currentActiveTeam.score} pts
          </div>
        </div>
      </div>

      {/* ARENA TEAM PODIUMS SCOREBOARD */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {teams.map((team, idx) => {
          const isTurn = idx === activeTeamIndex;
          const isLeading =
            teams.length > 1 && team.score > 0 && team.score === Math.max(...teams.map((tItem) => tItem.score));
          return (
            <motion.div
              key={team.id}
              layout
              onClick={() => setActiveTeamIndex(idx)}
              className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 transition-all duration-300 flex flex-col justify-between gap-2 text-white shadow-lg cursor-pointer ${
                team.colorBg
              } ${
                isTurn
                  ? 'ring-4 ring-amber-300 shadow-xl shadow-amber-500/30 scale-[1.02] z-10'
                  : 'opacity-85 hover:opacity-100'
              }`}
            >
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none rounded-t-2xl sm:rounded-t-3xl" />

              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-lg shrink-0 shadow-inner">
                    {team.badgeEmoji || '🦁'}
                  </div>
                  <span className="font-black text-xs sm:text-sm truncate drop-shadow-xs">
                    {cleanTeamDisplayName(team.name)}
                  </span>
                </div>

                {isLeading && <Crown className="w-4 h-4 text-amber-300 shrink-0 fill-amber-300" />}
              </div>

              <div className="flex items-end justify-between gap-2 pt-1.5 border-t border-white/20">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight drop-shadow-sm">
                      {team.score}
                    </span>
                    <span className="text-[10px] font-bold opacity-80">pts</span>
                  </div>
                  {team.streak >= 2 && (
                    <span className="text-[10px] font-black text-amber-200 inline-flex items-center gap-0.5">
                      <Flame className="w-3 h-3 fill-amber-300 text-amber-300" />
                      <span>{team.streak}x</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleUpdateTeamScore(idx, -5)}
                    className="w-7 h-7 rounded-xl bg-black/30 hover:bg-black/50 active:scale-90 text-white font-black text-xs flex items-center justify-center cursor-pointer transition-all border border-white/10"
                    title="-5"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateTeamScore(idx, 10)}
                    className="w-7 h-7 rounded-xl bg-white/25 hover:bg-white/40 active:scale-90 text-white font-black text-xs flex items-center justify-center cursor-pointer transition-all border border-white/20"
                    title="+10"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ========================================================================
          TACTILE 3D MYSTERY TREASURE CHESTS GRID
      ======================================================================== */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 pt-1">
        {tiles.map((tile) => {
          const isAnswered = tile.isAnswered;
          const conqueringTeam = tile.answeredByTeamId
            ? teams.find((tItem) => tItem.id === tile.answeredByTeamId)
            : null;

          const chestTier =
            tile.points <= 15
              ? {
                  chestImg: '/assets/games/chest_tier_emerald.webp',
                  borderAccent: 'border-emerald-400/50 hover:border-emerald-300',
                  glowClass: 'hover:shadow-emerald-500/30',
                  badgeColor: 'text-emerald-300 bg-emerald-950/90 border-emerald-400/40',
                  gemLabel: 'Emerald'
                }
              : tile.points <= 25
              ? {
                  chestImg: '/assets/games/chest_tier_sapphire.webp',
                  borderAccent: 'border-sky-400/50 hover:border-sky-300',
                  glowClass: 'hover:shadow-sky-500/30',
                  badgeColor: 'text-sky-300 bg-sky-950/90 border-sky-400/40',
                  gemLabel: 'Sapphire'
                }
              : tile.points <= 35
              ? {
                  chestImg: '/assets/games/chest_tier_amber.webp',
                  borderAccent: 'border-amber-400/60 hover:border-amber-300',
                  glowClass: 'hover:shadow-amber-500/35',
                  badgeColor: 'text-amber-300 bg-amber-950/90 border-amber-400/50',
                  gemLabel: 'Amber'
                }
              : {
                  chestImg: '/assets/games/chest_tier_ruby.webp',
                  borderAccent: 'border-rose-400/60 hover:border-rose-300',
                  glowClass: 'hover:shadow-rose-500/35',
                  badgeColor: 'text-rose-300 bg-rose-950/90 border-rose-400/50',
                  gemLabel: 'Ruby'
                };

          return (
            <motion.button
              key={tile.id}
              type="button"
              disabled={isAnswered}
              whileHover={!isAnswered ? { y: -6, scale: 1.03 } : undefined}
              whileTap={!isAnswered ? { scale: 0.94 } : undefined}
              onClick={() => {
                setActiveTile(tile);
                setShowAnswer(false);
                setSelectedChoiceId(null);
                setChoiceFeedback(null);
                setBearMood('thinking');
                setBearMessage(
                  language === 'ar'
                    ? `صندوق رقم #${tile.id} انفتح! فكروا جيداً يا أبطال!`
                    : language === 'de'
                    ? `Truhe #${tile.id} ist offen! Welche Antwort stimmt?`
                    : `Chest #${tile.id} unlocked! Choose the right magic rune!`
                );

                if (tile.isPowerCard && tile.powerType) {
                  const soundMap: Record<PowerCardType, any> = {
                    gift_25: 'powerup_gift',
                    steal_15: 'powerup_steal',
                    swap_scores: 'powerup_swap',
                    rocket_boost: 'powerup_rocket',
                    lose_15: 'powerup_boom',
                    reset_zero: 'powerup_boom',
                    double_score: 'powerup_star',
                    give_15: 'powerup_gift',
                    skip_turn: 'powerup_skip'
                  };
                  playLernstudioSound(soundMap[tile.powerType] || 'powerup_star');
                } else {
                  playLernstudioSound('powerup_star');
                  if (tile.promptType === 'audio' && tile.item?.german) {
                    setTimeout(() => speakGermanText(tile.item!.german, 0.85), 300);
                  }
                }

                if (timerSetting > 0 && !tile.isPowerCard) {
                  setTimerSeconds(timerSetting);
                  setIsTimerRunning(true);
                } else {
                  setTimerSeconds(null);
                  setIsTimerRunning(false);
                }
              }}
              className={`relative group overflow-hidden rounded-3xl p-3 h-36 sm:h-40 flex flex-col items-center justify-between transition-all cursor-pointer select-none ${
                isAnswered
                  ? conqueringTeam
                    ? `${conqueringTeam.colorBg} text-white border-2 border-white/30 shadow-md opacity-95 cursor-default`
                    : 'bg-slate-900/60 border border-white/10 text-slate-400 opacity-55 cursor-default'
                  : `bg-gradient-to-b from-slate-800/95 via-slate-900/95 to-slate-950 border-2 ${chestTier.borderAccent} shadow-[0_6px_0_#020617] hover:shadow-xl ${chestTier.glowClass}`
              }`}
            >
              {isAnswered ? (
                /* OPENED TREASURE CHEST STATE */
                <div className="w-full h-full flex flex-col items-center justify-between">
                  <div className="w-full flex items-center justify-between text-[11px] font-mono font-black opacity-90 px-1 tabular-nums">
                    <span>#{tile.id}</span>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>

                  <div className="relative flex items-center justify-center my-auto">
                    <img
                      src="/assets/games/magic_chest_open.webp"
                      alt="Opened Chest"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-lg"
                    />
                    <span className="absolute -top-2 text-2xl sm:text-3xl drop-shadow-md">
                      {tile.item?.emoji || conqueringTeam?.badgeEmoji || '⭐'}
                    </span>
                  </div>

                  <div className="w-full px-2 py-1 rounded-xl bg-black/35 backdrop-blur-xs text-[10px] font-black truncate text-center tabular-nums">
                    {conqueringTeam
                      ? `${cleanTeamDisplayName(conqueringTeam.name)} (+${tile.points})`
                      : language === 'ar'
                      ? 'تم فتحه'
                      : 'Opened'}
                  </div>
                </div>
              ) : (
                /* CLOSED MYSTERY TREASURE CHEST STATE */
                <>
                  {/* Chest Number Header */}
                  <div className="w-full flex items-center justify-between px-1 z-10">
                    <span className="px-2 py-0.5 rounded-lg bg-black/50 border border-white/15 text-xs font-black font-mono text-white tabular-nums">
                      #{tile.id < 10 ? `0${tile.id}` : tile.id}
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 opacity-75 group-hover:opacity-100 group-hover:rotate-12 transition-all" />
                  </div>

                  {/* Illustrated 3D Gem-Tiered Chest */}
                  <div className="relative my-auto flex items-center justify-center">
                    <img
                      src={chestTier.chestImg}
                      alt={`Mystery Chest #${tile.id}`}
                      className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform duration-200"
                    />
                  </div>

                  {/* Points Reward Footer */}
                  <div className="w-full z-10">
                    <div
                      className={`w-full py-1 px-2 rounded-xl border text-[11px] font-black font-mono tabular-nums flex items-center justify-center gap-1 ${chestTier.badgeColor}`}
                    >
                      <Star className="w-3 h-3 fill-current" />
                      <span>+{tile.points} pts</span>
                    </div>
                  </div>
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ========================================================================
          4. ENCHANTED CHEST REVEAL MODAL (Interactive Magic Runes + Spell Cards)
      ======================================================================== */}
      <AnimatePresence>
        {activeTile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="relative bg-gradient-to-b from-slate-900 via-indigo-950/95 to-slate-950 border-2 border-amber-400/50 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl space-y-5 text-white my-auto"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono font-black text-xs tabular-nums">
                    <img
                      src="/assets/games/magic_chest_open.webp"
                      alt=""
                      className="w-5 h-5 object-contain"
                    />
                    <span>#{activeTile.id}</span>
                  </div>

                  <span className="text-xs font-black text-slate-300">
                    {currentActiveTeam.badgeEmoji}{' '}
                    <span className="text-white">{cleanTeamDisplayName(currentActiveTeam.name)}</span>
                  </span>

                  <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 tabular-nums">
                    +{activeTile.points} pts
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {timerSeconds !== null && !activeTile.isPowerCard && (
                    <div
                      className={`flex items-center gap-1.5 font-mono font-black text-xs px-3 py-1 rounded-xl border tabular-nums ${
                        timerSeconds <= 5
                          ? 'bg-rose-500/25 text-rose-300 border-rose-400 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {timerSeconds} {t.secondsText}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTile(null);
                      setShowAnswer(false);
                      setSelectedChoiceId(null);
                      setChoiceFeedback(null);
                      setIsTimerRunning(false);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Animated Spell-Fuse Timer Progress Bar */}
              {timerSeconds !== null && timerSetting > 0 && !activeTile.isPowerCard && (
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${
                      timerSeconds <= 5
                        ? 'bg-gradient-to-r from-rose-500 to-red-500'
                        : 'bg-gradient-to-r from-amber-400 to-emerald-400'
                    }`}
                    initial={false}
                    animate={{ width: `${Math.max(0, (timerSeconds / timerSetting) * 100)}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}

              {/* Professor Nano Bear Mini Reaction inside Modal */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <img
                  src={BEAR_ASSETS[bearMood]}
                  alt="Professor Nano Bear"
                  className="w-14 h-14 rounded-2xl object-cover border border-amber-400/60 shrink-0 bg-slate-900"
                />
                <div className="text-start flex-1 min-w-0">
                  <span className="text-[11px] font-black text-amber-400 block">
                    {language === 'ar' ? 'البروفيسور نانو بير' : 'Professor Nano Bear'}
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-200 leading-snug">
                    {choiceFeedback === 'correct'
                      ? language === 'ar'
                        ? 'إجابة سحرية مذهلة! أحسنتم! 🎉'
                        : 'Zauberhaft! Genau richtig! 🎉'
                      : choiceFeedback === 'wrong'
                      ? language === 'ar'
                        ? `لا بأس! الإجابة الصحيحة موضحة باللون الأخضر: (${activeTile.item?.german || activeTile.answer})`
                        : `Fast! Schau dir die grüne Rune an: (${activeTile.item?.german || activeTile.answer})`
                      : activeTile.isPowerCard
                      ? language === 'ar'
                        ? 'مفاجأة! لقد عثرتم على تعويذة سحرية داخل الصندوق!'
                        : 'Überraschung! Eine magische Zauberkarte in der Truhe!'
                      : language === 'ar'
                      ? 'اختر الإجابة الصحيحة من الأحجار السحرية بالأسفل، أو اضغط إظهار الإجابة!'
                      : 'Tippe auf die richtige Antwort-Rune unten!'}
                  </p>
                </div>
              </div>

              {/* A. MAGIC SPELL POWER CARD REVEAL */}
              {activeTile.isPowerCard && activeTile.powerType ? (
                <motion.div
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.35 }}
                  className={`p-6 sm:p-8 rounded-3xl bg-gradient-to-br shadow-2xl space-y-4 text-center ${
                    getPowerCardLocalized(activeTile.powerType, t).bg
                  }`}
                >
                  <motion.span
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className="text-6xl sm:text-7xl block"
                  >
                    {getPowerCardLocalized(activeTile.powerType, t).emoji}
                  </motion.span>
                  <h2 className="text-2xl sm:text-3xl font-black">
                    {getPowerCardLocalized(activeTile.powerType, t).title}
                  </h2>
                  <p className="text-sm sm:text-base font-bold opacity-95 max-w-md mx-auto">
                    {getPowerCardLocalized(activeTile.powerType, t).desc}
                  </p>

                  <div className="pt-3">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleApplyPowerCard(activeTile)}
                      className="px-8 py-3.5 bg-slate-950 text-amber-300 hover:bg-slate-900 rounded-2xl font-black text-sm shadow-xl cursor-pointer inline-flex items-center gap-2 border border-amber-400/50"
                    >
                      <Wand2 className="w-5 h-5 text-amber-400" />
                      <span>{t.applyPowerupBtn}</span>
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                /* B. VOCABULARY TREASURE CHALLENGE */
                <div className="space-y-5">
                  {/* Question Stage Box */}
                  <div className="p-5 sm:p-6 bg-gradient-to-b from-indigo-900/50 to-slate-900/80 border border-amber-400/30 rounded-3xl text-center space-y-3 shadow-inner">
                    {activeTile.item?.emoji && (
                      <motion.span
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="text-5xl sm:text-6xl block drop-shadow-md"
                      >
                        {activeTile.item.emoji}
                      </motion.span>
                    )}

                    <h2 className="text-2xl sm:text-3xl font-black text-white" dir="auto">
                      {activeTile.question}
                    </h2>

                    {/* Audio Pronunciation Buttons (Always available for listening) */}
                    {activeTile.item?.german && (
                      <div className="flex items-center justify-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => speakGermanText(activeTile.item!.german, 0.88)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>{language === 'ar' ? 'استماع (1.0x)' : 'Listen (1.0x)'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => speakGermanText(activeTile.item!.german, 0.6)}
                          className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Snail className="w-4 h-4" />
                          <span>{language === 'ar' ? 'بطيء (0.6x)' : 'Slow (0.6x)'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Interactive 4-Choice Magic Runes (Kid-Friendly Direct Tap) */}
                  {activeTile.choices && activeTile.choices.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeTile.choices.map((choice) => {
                        const isSelected = selectedChoiceId === choice.id;
                        const revealCorrect = (choiceFeedback !== null || showAnswer) && choice.isCorrect;
                        const revealWrong = choiceFeedback === 'wrong' && isSelected && !choice.isCorrect;

                        return (
                          <motion.button
                            key={choice.id}
                            type="button"
                            whileHover={choiceFeedback === null ? { scale: 1.02, y: -2 } : undefined}
                            whileTap={choiceFeedback === null ? { scale: 0.97 } : undefined}
                            onClick={() => handleSelectMagicChoice(choice)}
                            className={`p-4 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              revealCorrect
                                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 shadow-lg shadow-emerald-500/20'
                                : revealWrong
                                ? 'bg-rose-500/25 border-rose-400 text-rose-100'
                                : 'bg-white/5 hover:bg-white/15 border-white/15 hover:border-amber-400/60 text-white'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center text-lg shrink-0">
                                {revealCorrect ? '✅' : revealWrong ? '❌' : choice.emoji || '🔮'}
                              </span>
                              <div className="min-w-0">
                                <span className="font-black text-sm sm:text-base block truncate" dir="auto">
                                  {choice.label}
                                </span>
                                {(showAnswer || choiceFeedback !== null) && choice.subLabel && (
                                  <span className="text-[11px] font-bold opacity-75 block truncate" dir="auto">
                                    {choice.subLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {/* Full Answer Reveal Box (When Revealed or After Wrong Choice) */}
                  {showAnswer ? (
                    <div className="p-4 bg-emerald-500/15 border border-emerald-400/40 rounded-2xl text-center space-y-1.5">
                      <span className="text-[11px] font-black text-emerald-300 block">
                        {t.correctAnswerLabel}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-white font-mono" dir="ltr">
                        {activeTile.item?.german || activeTile.answer}
                      </h3>
                      {activeTile.item?.exampleSentenceGerman && (
                        <p className="text-xs text-emerald-200/90 italic" dir="ltr">
                          "{activeTile.item.exampleSentenceGerman}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAnswer(true);
                          if (activeTile.item?.german) {
                            speakGermanText(activeTile.item.german, 0.85);
                          }
                        }}
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-amber-300 rounded-2xl font-black text-xs transition-all cursor-pointer inline-flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span>{t.showAnswerBtn}</span>
                      </button>
                    </div>
                  )}

                  {/* Teacher / Manual Judgement Controls */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleAwardQuestion(true)}
                      className="py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>
                        {t.correctBtn} (+{activeTile.points})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAwardQuestion(false)}
                      className="py-3.5 px-4 bg-white/10 hover:bg-rose-500/30 border border-white/15 hover:border-rose-400/50 text-white rounded-2xl font-black text-xs sm:text-sm cursor-pointer inline-flex items-center justify-center gap-2 transition-all"
                    >
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span>
                        {choiceFeedback === 'wrong'
                          ? language === 'ar'
                            ? 'الصندوق التالي ←'
                            : 'Next Turn →'
                          : `${t.wrongBtn} (0)`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
