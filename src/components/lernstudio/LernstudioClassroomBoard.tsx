import React, { useState, useEffect, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem } from '../../types/lernstudio';
import { Group, Student } from '../../types';
import { useApp } from '../../context/AppContext';
import { getLernstudioTranslations, LernstudioTranslations, getItemTranslation } from '../../utils/lernstudioTranslations';
import {
  detectCurrentScheduledGroup,
  filterGroupsByDayAndTime,
  getStudentsForGroup
} from '../../utils/groupScheduleUtils';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../utils/audioSpeechUtils';
import { GameStageBanner, SharedVictoryTrophyArt } from './GameArtAssets';
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
  Calendar,
  Filter,
  Check,
  Search,
  Volume2,
  Snail,
  X,
  Crown,
  Flame
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

export type GameMode = 'classic' | 'quiz_only' | 'power_only';

export interface BaamboozleTeam {
  id: string;
  name: string;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  badgeEmoji: string;
  score: number;
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

export interface BaamboozleTile {
  id: number;
  points: number;
  isPowerCard: boolean;
  powerType?: PowerCardType;
  item?: LernstudioItem;
  question: string;
  answer: string;
  isAnswered: boolean;
  answeredByTeamId?: string;
}

const COLOR_PALETTES = [
  { name: 'Red', labelAr: 'الأحمر', bg: 'bg-gradient-to-br from-rose-500 via-red-600 to-red-700', text: 'text-red-500', border: 'border-red-400', emoji: '🦁', badge: '🔴' },
  { name: 'Blue', labelAr: 'الأزرق', bg: 'bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-700', text: 'text-blue-500', border: 'border-blue-400', emoji: '🦅', badge: '🔵' },
  { name: 'Green', labelAr: 'الأخضر', bg: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-green-700', text: 'text-emerald-500', border: 'border-emerald-400', emoji: '🐊', badge: '🟢' },
  { name: 'Yellow', labelAr: 'الأصفر', bg: 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600', text: 'text-amber-500', border: 'border-amber-400', emoji: '🐯', badge: '🟡' },
  { name: 'Purple', labelAr: 'البنفسجي', bg: 'bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700', text: 'text-purple-500', border: 'border-purple-400', emoji: '🦄', badge: '🟣' },
  { name: 'Pink', labelAr: 'الوردي', bg: 'bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-600', text: 'text-pink-500', border: 'border-pink-400', emoji: '🦊', badge: '🌸' }
];

export function getPowerCardLocalized(type: PowerCardType, t: LernstudioTranslations) {
  const cardsMap: Record<PowerCardType, { title: string; desc: string; emoji: string; bg: string }> = {
    gift_25: { title: t.powerGiftTitle, desc: t.powerGiftDesc, emoji: '🎁', bg: 'from-amber-500 to-yellow-400 text-slate-950' },
    steal_15: { title: t.powerStealTitle, desc: t.powerStealDesc, emoji: '🏴‍☠️', bg: 'from-purple-600 to-indigo-600 text-white' },
    swap_scores: { title: t.powerSwapTitle, desc: t.powerSwapDesc, emoji: '🔄', bg: 'from-cyan-600 to-blue-600 text-white' },
    rocket_boost: { title: t.powerRocketTitle, desc: t.powerRocketDesc, emoji: '🚀', bg: 'from-rose-600 to-pink-600 text-white' },
    lose_15: { title: t.powerBombTitle, desc: t.powerBombDesc, emoji: '💥', bg: 'from-red-600 to-orange-600 text-white' },
    reset_zero: { title: t.powerZeroTitle, desc: t.powerZeroDesc, emoji: '🧹', bg: 'from-slate-700 to-slate-900 text-white' },
    double_score: { title: t.powerDoubleTitle, desc: t.powerDoubleDesc, emoji: '🌟', bg: 'from-amber-400 to-yellow-500 text-slate-950' },
    give_15: { title: t.powerGiveTitle, desc: t.powerGiveDesc, emoji: '💖', bg: 'from-pink-500 to-rose-400 text-white' },
    skip_turn: { title: t.powerSkipTitle, desc: t.powerSkipDesc, emoji: '🐊', bg: 'from-emerald-600 to-teal-600 text-white' }
  };
  return cardsMap[type];
}

export function cleanTeamDisplayName(teamName: string): string {
  if (!teamName) return '';
  // If format is "GroupName (Student Names)" or "GroupName (تيم Student Names)", extract student names only
  const match = teamName.match(/^[^(]+\(([^)]+)\)$/);
  if (match && match[1]) {
    return match[1].replace(/^(تيم|Team)\s+/gi, '').trim();
  }
  return teamName;
}

export const LernstudioClassroomBoard: React.FC<Props> = ({ set, activeTheme, language: propLanguage, onBack }) => {
  const { groups = [], students = [], language: appLanguage = 'ar' } = useApp();
  const activeLanguage = propLanguage || appLanguage;
  const language = activeLanguage;
  const t = getLernstudioTranslations(activeLanguage);
  const { triggerSparkles, triggerFloatingText, triggerConfetti } = useGameEffects();

  // Game Setup State
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [timerSetting, setTimerSetting] = useState<number>(30); // 0 = off, 15, 30, 60
  const [selectedTileCount, setSelectedTileCount] = useState<number>(12);

  // Day & Time Filter State
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all');

  // Active Selected Group from App
  const [selectedGroupId, setSelectedGroupId] = useState<string>(set.assignedGroupId || '');
  const [isCurrentClassNotice, setIsCurrentClassNotice] = useState<string | null>(null);

  // Team Roster Mode: 'split_teams' | 'individual' | 'custom_colors'
  const [rosterMode, setRosterMode] = useState<'split_teams' | 'individual' | 'custom_colors'>('split_teams');
  const [teamCount, setTeamCount] = useState<number>(2);

  // Filtered Groups list
  const filteredAppGroups = useMemo(() => {
    return filterGroupsByDayAndTime(groups, filterDay, filterTime);
  }, [groups, filterDay, filterTime]);

  // Teams Setup State
  const [teams, setTeams] = useState<BaamboozleTeam[]>([]);
  const [activeTeamIndex, setActiveTeamIndex] = useState<number>(0);

  // Auto-build teams whenever group or roster mode changes
  useEffect(() => {
    const selectedGroup = groups.find((g) => g.id === selectedGroupId);
    const groupStudents = getStudentsForGroup(students, selectedGroupId);

    if (rosterMode === 'individual' && groupStudents.length > 0) {
      // Individual Student Mode: each student gets their own card
      const newTeams: BaamboozleTeam[] = groupStudents.map((st, i) => {
        const color = COLOR_PALETTES[i % COLOR_PALETTES.length];
        return {
          id: st.id,
          name: st.name,
          colorBg: color.bg,
          colorText: color.text,
          colorBorder: color.border,
          badgeEmoji: color.emoji,
          score: 0
        };
      });
      setTeams(newTeams);
    } else if (rosterMode === 'split_teams' && groupStudents.length > 0) {
      // Split group into N teams
      const newTeams: BaamboozleTeam[] = Array.from({ length: teamCount }).map((_, teamIdx) => {
        const assignedStudents = groupStudents.filter((_, sIdx) => sIdx % teamCount === teamIdx);
        const names = assignedStudents.map((s) => s.name).join(', ');
        const color = COLOR_PALETTES[teamIdx % COLOR_PALETTES.length];
        return {
          id: `team_${teamIdx + 1}`,
          name: assignedStudents.length > 0 ? names : (language === 'ar' ? `الفريق ${color.labelAr || color.name} ${color.emoji}` : `Team ${color.name} ${color.emoji}`),
          colorBg: color.bg,
          colorText: color.text,
          colorBorder: color.border,
          badgeEmoji: color.emoji,
          score: 0
        };
      });
      setTeams(newTeams);
    } else {
      // Custom color teams fallback
      const baseColors = COLOR_PALETTES.slice(0, teamCount);
      const newTeams: BaamboozleTeam[] = baseColors.map((c, i) => ({
        id: `t_${i + 1}`,
        name: language === 'ar' ? `الفريق ${c.labelAr || c.name} ${c.emoji}` : `Team ${c.name} ${c.emoji}`,
        colorBg: c.bg,
        colorText: c.text,
        colorBorder: c.border,
        badgeEmoji: c.emoji,
        score: 0
      }));
      setTeams(newTeams);
    }
  }, [selectedGroupId, rosterMode, teamCount, groups, students, language]);

  // Tiles State
  const [tiles, setTiles] = useState<BaamboozleTile[]>([]);

  // Active Selected Tile Modal State
  const [activeTile, setActiveTile] = useState<BaamboozleTile | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // GameOver Victory State
  const [isGameOver, setIsGameOver] = useState(false);

  // Undo History Stack
  const [historyStack, setHistoryStack] = useState<{ tiles: BaamboozleTile[]; teams: BaamboozleTeam[]; activeIndex: number }[]>([]);

  // Auto-detect current active scheduled class ("الجروب الحالي حسب الوقت ⚡")
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

  // Initialize Baamboozle Tiles on Game Start
  const handleStartGame = () => {
    const items = [...(set.items || [])];
    if (items.length === 0) {
      alert(language === 'ar' ? 'يرجى إضافة كلمات إلى المجموعة أولاً لإنشاء لعبة الفصل.' : 'Please add vocabulary items to this set first.');
      return;
    }

    if (teams.length === 0) {
      alert(language === 'ar' ? 'يرجى اختيار فريق أو مجموعة واحدة على الأقل.' : 'Please select at least one group or team.');
      return;
    }

    // Generate full selectedTileCount by drawing from set items (repeating if set has fewer items)
    const pool: LernstudioItem[] = [];
    while (pool.length < selectedTileCount) {
      const shuffled = [...items].sort(() => 0.5 - Math.random());
      pool.push(...shuffled);
    }
    const finalItems = pool.slice(0, selectedTileCount);

    const powerTypesList: PowerCardType[] = [
      'gift_25', 'steal_15', 'swap_scores', 'rocket_boost',
      'lose_15', 'reset_zero', 'double_score', 'give_15', 'skip_turn'
    ];

    const generatedTiles: BaamboozleTile[] = finalItems.map((item, idx) => {
      const isPower = gameMode === 'power_only' ? true : (gameMode === 'classic' ? Math.random() < 0.25 : false);
      const randomPower = powerTypesList[Math.floor(Math.random() * powerTypesList.length)];
      const points = (idx % 4 + 1) * 10 + 5;

      return {
        id: idx + 1,
        points,
        isPowerCard: isPower,
        powerType: isPower ? randomPower : undefined,
        item,
        question: getItemTranslation(item, activeLanguage) || item.exampleSentenceArabic || item.emoji || 'What is the German word?',
        answer: item.german + (item.plural ? ` (Plural: ${item.plural})` : '') + (item.exampleSentenceGerman ? ` • ${item.exampleSentenceGerman}` : ''),
        isAnswered: false
      };
    });

    setTiles(generatedTiles);
    setActiveTeamIndex(0);
    setIsGameOver(false);
    setIsPlaying(true);
    setHistoryStack([]);
    playLernstudioSound('powerup_star');
  };

  // Turn Navigation helper
  const advanceTurn = () => {
    setActiveTeamIndex((prev) => (prev + 1) % teams.length);
  };

  const saveHistory = () => {
    setHistoryStack((prev) => [
      ...prev,
      {
        tiles: tiles.map((t) => ({ ...t })),
        teams: teams.map((t) => ({ ...t })),
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
  };

  // Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev !== null && prev > 1 ? prev - 1 : 0));
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

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

  // Apply Power Card Action
  const handleApplyPowerCard = (tile: BaamboozleTile) => {
    if (!tile.powerType) return;
    saveHistory();

    const activeTeam = teams[activeTeamIndex];
    const otherTeamIndex = (activeTeamIndex + 1) % teams.length;
    const otherTeam = teams[otherTeamIndex] || activeTeam;

    let updatedTeams = [...teams];

    switch (tile.powerType) {
      case 'gift_25':
        updatedTeams[activeTeamIndex].score += 25;
        break;
      case 'steal_15':
        const stolen = Math.min(otherTeam.score, 15);
        updatedTeams[otherTeamIndex].score -= stolen;
        updatedTeams[activeTeamIndex].score += stolen;
        break;
      case 'swap_scores':
        const tempScore = updatedTeams[activeTeamIndex].score;
        updatedTeams[activeTeamIndex].score = updatedTeams[otherTeamIndex].score;
        updatedTeams[otherTeamIndex].score = tempScore;
        break;
      case 'rocket_boost':
        const maxScore = Math.max(...updatedTeams.map((t) => t.score));
        updatedTeams[activeTeamIndex].score = maxScore + 10;
        break;
      case 'lose_15':
        updatedTeams[activeTeamIndex].score = Math.max(0, updatedTeams[activeTeamIndex].score - 15);
        break;
      case 'reset_zero':
        updatedTeams[activeTeamIndex].score = 0;
        break;
      case 'double_score':
        updatedTeams[activeTeamIndex].score *= 2;
        break;
      case 'give_15':
        updatedTeams[activeTeamIndex].score = Math.max(0, updatedTeams[activeTeamIndex].score - 15);
        updatedTeams[otherTeamIndex].score += 15;
        break;
      case 'skip_turn':
        break;
    }

    setTeams(updatedTeams);
    setTiles((prev) =>
      prev.map((t) => (t.id === tile.id ? { ...t, isAnswered: true, answeredByTeamId: activeTeam.id } : t))
    );

    triggerSparkles(50, 50, '#fbbf24');
    setActiveTile(null);
    setShowAnswer(false);
    advanceTurn();
    checkGameOver(tiles.filter((t) => t.id !== tile.id && !t.isAnswered).length === 0);
  };

  // Award Question Points (Okay / Correct)
  const handleAwardQuestion = (isCorrect: boolean) => {
    if (!activeTile) return;
    saveHistory();

    const activeTeam = teams[activeTeamIndex];
    if (isCorrect) {
      setTeams((prev) =>
        prev.map((t, idx) => (idx === activeTeamIndex ? { ...t, score: t.score + activeTile.points } : t))
      );
      playLernstudioSound('correct');
      playGermanVoiceFeedback('richtig');
      triggerSparkles(50, 50, '#10b981');
      triggerFloatingText(`+${activeTile.points} ★ Richtig!`, 50, 42, '#fbbf24');
    } else {
      playLernstudioSound('wrong');
      playGermanVoiceFeedback('noch_einmal');
    }

    const remainingTiles = tiles.filter((t) => t.id !== activeTile.id && !t.isAnswered);

    setTiles((prev) =>
      prev.map((t) =>
        t.id === activeTile.id
          ? { ...t, isAnswered: true, answeredByTeamId: isCorrect ? activeTeam.id : undefined }
          : t
      )
    );

    setActiveTile(null);
    setShowAnswer(false);
    advanceTurn();

    checkGameOver(remainingTiles.length === 0);
  };

  const checkGameOver = (allDone: boolean) => {
    if (allDone) {
      setIsGameOver(true);
      playLernstudioSound('fanfare_victory');
      playGermanVoiceFeedback('gewonnen');
      triggerConfetti();
    }
  };

  const handleUpdateTeamScore = (teamIndex: number, delta: number) => {
    saveHistory();
    setTeams((prev) =>
      prev.map((t, idx) => (idx === teamIndex ? { ...t, score: Math.max(0, t.score + delta) } : t))
    );
  };

  const currentActiveTeam = teams[activeTeamIndex] || { name: 'Team', score: 0, badgeEmoji: '🔴', colorBg: 'bg-primary' };

  // Render Game Setup Lobby
  if (!isPlaying) {
    return (
      <div className={`p-4 sm:p-8 rounded-3xl space-y-6 transition-all ${activeTheme.bgGradient}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <GameStageBanner
          gameId="classroom"
          title={t.boardTitle}
          subtitle={`${set.title} (${set.items?.length || 0} ${t.vocabularyCount})`}
          emoji="🏆"
        />

        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 bg-surface/90 backdrop-blur-md p-4 rounded-3xl border border-surface-border shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-text-muted hover:text-text-main bg-surface-hover rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <ArrowRight className={`w-4 h-4 ${language !== 'ar' ? 'rotate-180' : ''}`} />
              <span>{language === 'ar' ? 'رجوع' : 'Back'}</span>
            </button>

            <div>
              <h2 className="text-base sm:text-lg font-black text-text-main flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>{t.boardTitle}</span>
              </h2>
              <p className="text-xs text-text-muted">{set.title} ({set.items?.length || 0} {t.vocabularyCount})</p>
            </div>
          </div>
        </div>

        {/* Setup Config Card */}
        <div className="p-5 sm:p-7 bg-surface border border-surface-border rounded-3xl shadow-xl space-y-6 max-w-4xl mx-auto">
          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black text-text-main block">{t.selectGameMode}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setGameMode('classic')}
                className={`p-4 rounded-2xl border-2 text-start space-y-1 transition-all cursor-pointer ${
                  gameMode === 'classic'
                    ? 'border-primary bg-primary-soft/60 shadow-md'
                    : 'border-surface-border hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-primary">{t.modeClassicTitle}</span>
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <p className="text-[11px] text-text-muted">{t.modeClassicDesc}</p>
              </button>

              <button
                type="button"
                onClick={() => setGameMode('quiz_only')}
                className={`p-4 rounded-2xl border-2 text-start space-y-1 transition-all cursor-pointer ${
                  gameMode === 'quiz_only'
                    ? 'border-primary bg-primary-soft/60 shadow-md'
                    : 'border-surface-border hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-text-main">{t.modeQuizTitle}</span>
                  <Award className="w-4 h-4 text-primary" />
                </div>
                <p className="text-[11px] text-text-muted">{t.modeQuizDesc}</p>
              </button>

              <button
                type="button"
                onClick={() => setGameMode('power_only')}
                className={`p-4 rounded-2xl border-2 text-start space-y-1 transition-all cursor-pointer ${
                  gameMode === 'power_only'
                    ? 'border-primary bg-primary-soft/60 shadow-md'
                    : 'border-surface-border hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-text-main">{t.modePartyTitle}</span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-[11px] text-text-muted">{t.modePartyDesc}</p>
              </button>
            </div>
          </div>

          {/* Group & Roster Selection Section */}
          <div className="space-y-4 pt-4 border-t border-surface-border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                <span>{t.selectGroupHeader}</span>
              </label>

              {/* Current Class Button (Detects Scheduled Group by Day & Hour) */}
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

            {/* Day and Time Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-hover/50 rounded-2xl border border-surface-border">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-text-muted shrink-0">{t.filterByDay}</span>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-main focus:outline-none focus:border-primary"
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
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-main focus:outline-none focus:border-primary"
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
                className="w-full px-4 py-2.5 bg-surface border border-surface-border rounded-2xl text-xs font-black text-text-main focus:outline-none focus:border-primary shadow-xs"
              >
                <option value="">-- {t.allGroups} --</option>
                {filteredAppGroups.map((g) => {
                  const studentCount = getStudentsForGroup(students, g.id).length;
                  return (
                    <option key={g.id} value={g.id}>
                      🏫 {g.name} ({studentCount} {t.vocabularyCount}) • {g.grade}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Roster & Team Distribution Mode */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-black text-text-main block">{t.playStyleHeader}</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRosterMode('split_teams')}
                  className={`p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    rosterMode === 'split_teams' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                  }`}
                >
                  {t.splitGroupTeams}
                </button>

                <button
                  type="button"
                  onClick={() => setRosterMode('individual')}
                  className={`p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    rosterMode === 'individual' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                  }`}
                >
                  {t.individualStudents}
                </button>

                <button
                  type="button"
                  onClick={() => setRosterMode('custom_colors')}
                  className={`p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    rosterMode === 'custom_colors' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                  }`}
                >
                  {t.customTeams}
                </button>
              </div>
            </div>

            {/* Team Count Selector (If not individual) */}
            {rosterMode !== 'individual' && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-text-muted">{t.teamsCount}</span>
                <div className="flex gap-1.5">
                  {[2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTeamCount(count)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        teamCount === count ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Render Editable Teams List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {teams.map((team, idx) => (
                <div key={team.id} className="p-3 bg-surface-hover/60 border border-surface-border rounded-2xl flex items-center gap-2">
                  <span className="text-lg">{team.badgeEmoji}</span>
                  <input
                    type="text"
                    value={team.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setTeams((prev) => prev.map((t, i) => (i === idx ? { ...t, name: newName } : t)));
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-surface-border bg-surface text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Grid Size & Timer Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-surface-border">
            <div>
              <label className="text-xs font-black text-text-main block mb-1">{t.tilesCount}</label>
              <select
                value={selectedTileCount}
                onChange={(e) => setSelectedTileCount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary"
              >
                <option value={8}>8 {language === 'ar' ? 'مربعات (لعبة سريعة)' : 'Tiles (Fast Game)'}</option>
                <option value={12}>12 {language === 'ar' ? 'مربع (قياسي 3×4)' : 'Tiles (Standard 3x4)'}</option>
                <option value={16}>16 {language === 'ar' ? 'مربع (شبكة 4×4)' : 'Tiles (Grid 4x4)'}</option>
                <option value={24}>24 {language === 'ar' ? 'مربع (شبكة كاملة 4×6)' : 'Tiles (Full 4x6)'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-text-main block mb-1">{t.timerSettingLabel}</label>
              <select
                value={timerSetting}
                onChange={(e) => setTimerSetting(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-hover/60 border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary"
              >
                <option value={0}>{t.noTimer}</option>
                <option value={15}>15 {t.secondsText}</option>
                <option value={30}>30 {t.secondsText}</option>
                <option value={60}>60 {t.secondsText}</option>
              </select>
            </div>
          </div>

          {/* Launch Button */}
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={handleStartGame}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 via-primary to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white rounded-2xl text-base font-black shadow-xl cursor-pointer inline-flex items-center justify-center gap-2 transform hover:scale-[1.01] transition-all"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>{t.launchBoardBtn}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Game Victory Screen
  if (isGameOver) {
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    const winner = sortedTeams[0] || { name: 'Winner', score: 0 };

    return (
      <div className={`p-8 rounded-3xl text-center space-y-6 animate-scale-up ${activeTheme.cardBg}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="w-24 h-24 rounded-2xl overflow-hidden border border-amber-500/40 mx-auto shadow-lg">
          <SharedVictoryTrophyArt className="w-full h-full object-cover" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-black text-amber-500 uppercase tracking-widest block">{t.winnerTitle}</span>
          <h2 className="text-2xl sm:text-3xl font-black text-text-main">
            {t.winnerFirstPlace} <span className="text-primary">{cleanTeamDisplayName(winner.name)} 🎉</span>
          </h2>
          <p className="text-sm font-bold text-text-muted">{t.winnerScore} {winner.score} {t.scorePts}</p>
        </div>

        {/* Podium Stand */}
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto items-end pt-4">
          {sortedTeams[1] && (
            <div className="p-4 bg-slate-200 dark:bg-slate-800 rounded-t-2xl space-y-1">
              <span className="text-2xl block">🥈</span>
              <span className="text-xs font-black block truncate">{cleanTeamDisplayName(sortedTeams[1].name)}</span>
              <span className="text-xs font-bold text-text-muted">{sortedTeams[1].score} pts</span>
            </div>
          )}

          <div className="p-5 bg-amber-500 text-slate-950 rounded-t-3xl space-y-1 shadow-xl transform scale-110">
            <span className="text-3xl block">🥇</span>
            <span className="text-xs font-black block truncate">{cleanTeamDisplayName(winner.name)}</span>
            <span className="text-sm font-black">{winner.score} pts</span>
          </div>

          {sortedTeams[2] && (
            <div className="p-4 bg-amber-700/20 rounded-t-2xl space-y-1">
              <span className="text-2xl block">🥉</span>
              <span className="text-xs font-black block truncate">{cleanTeamDisplayName(sortedTeams[2].name)}</span>
              <span className="text-xs font-bold text-text-muted">{sortedTeams[2].score} pts</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            onClick={handleStartGame}
            className="px-6 py-3 bg-primary text-white rounded-2xl text-xs font-black shadow-md cursor-pointer inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.playNewGame}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(false)}
            className="px-6 py-3 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-2xl text-xs font-bold cursor-pointer"
          >
            {t.adjustSettings}
          </button>
        </div>
      </div>
    );
  }

  // Active Main Game Board
  return (
    <div className={`p-4 sm:p-6 rounded-3xl space-y-5 transition-all ${activeTheme.bgGradient}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <GameStageBanner
        gameId="classroom"
        title={t.boardTitle}
        subtitle={`${set.title} • ${t.remainingTiles} ${tiles.filter((t) => !t.isAnswered).length} / ${tiles.length}`}
        emoji="🏆"
      />

      {/* Top Bar Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-surface/90 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-surface-border shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying(false)}
            className="p-2 text-text-muted hover:text-text-main bg-surface-hover rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <Settings className="w-4 h-4" />
            <span>{t.settingsBtn}</span>
          </button>

          <div>
            <h2 className="text-sm sm:text-base font-black text-text-main flex items-center gap-2">
              <span>🏫 {set.title}</span>
            </h2>
            <span className="text-[10px] text-text-muted font-bold">
              {t.remainingTiles} {tiles.filter((t) => !t.isAnswered).length} / {tiles.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={historyStack.length === 0}
            onClick={handleUndo}
            className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-xl text-xs font-bold transition-all disabled:opacity-30 cursor-pointer inline-flex items-center gap-1"
            title={t.undoBtn}
          >
            <Undo2 className="w-3.5 h-3.5 text-primary" />
            <span>{t.undoBtn} ({historyStack.length})</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? t.minimize : t.fullscreen}</span>
          </button>

          <button
            type="button"
            onClick={() => checkGameOver(true)}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <span>{t.endGameBtn}</span>
          </button>
        </div>
      </div>

      {/* Arena Team Podiums Scoreboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {teams.map((team, idx) => {
          const isTurn = idx === activeTeamIndex;
          const isLeading = teams.length > 1 && team.score > 0 && team.score === Math.max(...teams.map((t) => t.score));
          return (
            <div
              key={team.id}
              className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 transition-all duration-300 flex flex-col justify-between gap-2.5 text-white shadow-md ${
                team.colorBg
              } ${
                isTurn
                  ? 'ring-4 ring-amber-300 shadow-xl shadow-amber-500/30 scale-[1.02] z-10'
                  : 'opacity-90 hover:opacity-100'
              }`}
            >
              {/* Gloss highlight overlay */}
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none rounded-t-2xl sm:rounded-t-3xl" />

              {/* Turn Banner Tag */}
              {isTurn && (
                <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] sm:text-[10px] shadow-sm animate-bounce">
                    <span>👑</span>
                    <span>{language === 'ar' ? 'دوركم الآن!' : 'YOUR TURN!'}</span>
                  </span>
                </div>
              )}

              {/* Leader Crown Tag */}
              {!isTurn && isLeading && (
                <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/25 text-amber-300 font-bold text-[9px] shadow-xs">
                    <span>🏆</span>
                  </span>
                </div>
              )}

              {/* Team Identity Header */}
              <div className="flex items-center gap-2.5 min-w-0 pr-1 pt-0.5">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-xl shrink-0 shadow-inner ${isTurn ? 'animate-pulse' : ''}`}>
                  {team.badgeEmoji || '🦁'}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-black text-xs sm:text-sm block truncate drop-shadow-xs">
                    {cleanTeamDisplayName(team.name)}
                  </span>
                  <span className="text-[10px] font-bold opacity-80 block truncate">
                    {isTurn ? (language === 'ar' ? '🎯 الفريق النشط' : '🎯 Active Team') : (language === 'ar' ? 'فريق المنافسة' : 'Class Team')}
                  </span>
                </div>
              </div>

              {/* Score & Interactive Steppers */}
              <div className="flex items-end justify-between gap-2 pt-1 border-t border-white/20">
                <div className="flex flex-col">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-80">
                    {language === 'ar' ? 'النقاط' : 'Score'}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight drop-shadow-sm">
                      {team.score}
                    </span>
                    <span className="text-[10px] font-bold opacity-75">pts</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUpdateTeamScore(idx, -5)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-black/30 hover:bg-black/50 active:scale-90 text-white font-black text-xs flex items-center justify-center cursor-pointer transition-all shadow-xs border border-white/10"
                    title="-5"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateTeamScore(idx, 10)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/25 hover:bg-white/40 active:scale-90 text-white font-black text-xs flex items-center justify-center cursor-pointer transition-all shadow-xs border border-white/20"
                    title="+10"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid of Numbered Mystery Game Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-3.5 pt-1">
        {tiles.map((tile) => {
          const isAnswered = tile.isAnswered;
          const conqueringTeam = tile.answeredByTeamId ? teams.find((t) => t.id === tile.answeredByTeamId) : null;

          // Tier configuration for points
          const pointTier =
            tile.points <= 15
              ? {
                  badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                  accentBorder: 'hover:border-emerald-400',
                  glowShadow: 'hover:shadow-emerald-500/20',
                  icon: '🪙',
                  label: `${tile.points} pts`
                }
              : tile.points <= 25
              ? {
                  badgeBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
                  accentBorder: 'hover:border-sky-400',
                  glowShadow: 'hover:shadow-sky-500/20',
                  icon: '💎',
                  label: `${tile.points} pts`
                }
              : tile.points <= 35
              ? {
                  badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
                  accentBorder: 'hover:border-amber-400',
                  glowShadow: 'hover:shadow-amber-500/20',
                  icon: '⚡',
                  label: `${tile.points} pts`
                }
              : {
                  badgeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
                  accentBorder: 'hover:border-rose-400',
                  glowShadow: 'hover:shadow-rose-500/20',
                  icon: '👑',
                  label: `${tile.points} pts`
                };

          return (
            <button
              key={tile.id}
              type="button"
              disabled={isAnswered}
              onClick={() => {
                setActiveTile(tile);
                setShowAnswer(false);
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
                  playLernstudioSound('correct');
                }
                if (timerSetting > 0) {
                  setTimerSeconds(timerSetting);
                  setIsTimerRunning(true);
                } else {
                  setTimerSeconds(null);
                  setIsTimerRunning(false);
                }
              }}
              className={`relative group overflow-hidden rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 h-28 sm:h-32 md:h-36 flex flex-col items-center justify-between transition-all duration-200 cursor-pointer text-center select-none ${
                isAnswered
                  ? conqueringTeam
                    ? `${conqueringTeam.colorBg} text-white shadow-sm border border-white/20 opacity-95 cursor-default scale-[0.98]`
                    : 'bg-surface-hover/60 border border-surface-border text-text-muted opacity-40 cursor-default scale-[0.98]'
                  : `bg-surface border-2 border-surface-border/80 text-text-main shadow-[0_5px_0_#cbd5e1] dark:shadow-[0_5px_0_#0f172a] hover:shadow-[0_8px_0_#94a3b8] dark:hover:shadow-[0_8px_0_#1e293b] hover:-translate-y-1 active:translate-y-1 active:shadow-[0_2px_0_#94a3b8] dark:active:shadow-[0_1px_0_#0f172a] ${pointTier.accentBorder} ${pointTier.glowShadow}`
              }`}
            >
              {/* Gloss shine reflection on active cards */}
              {!isAnswered && (
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 dark:from-white/10 to-transparent pointer-events-none rounded-t-2xl sm:rounded-t-3xl" />
              )}

              {/* Solved Card View */}
              {isAnswered ? (
                conqueringTeam ? (
                  <div className="w-full h-full flex flex-col items-center justify-between py-1">
                    <div className="w-full flex items-center justify-between text-[10px] font-black opacity-90 px-1">
                      <span>#{tile.id}</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    </div>

                    <div className="text-3xl sm:text-4xl transform scale-110 drop-shadow-md my-auto">
                      {tile.item?.emoji || conqueringTeam.badgeEmoji || '⭐'}
                    </div>

                    <div className="w-full px-1.5 py-0.5 rounded-lg bg-black/25 backdrop-blur-2xs text-[9px] sm:text-[10px] font-black truncate max-w-full">
                      {cleanTeamDisplayName(conqueringTeam.name)} (+{tile.points})
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    <span className="text-xs font-mono font-bold text-text-muted">#{tile.id}</span>
                    <span className="text-xl">✓</span>
                    <span className="text-[9px] font-bold text-text-muted">مُنجزة</span>
                  </div>
                )
              ) : (
                /* Unanswered Active Mystery Card */
                <>
                  {/* Top Mystery Accent Header */}
                  <div className="w-full flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-text-muted/70 group-hover:text-primary transition-colors font-mono">
                      #{tile.id < 10 ? `0${tile.id}` : tile.id}
                    </span>
                    <span className="text-xs group-hover:scale-125 transition-transform">
                      {tile.points >= 40 ? '🔥' : tile.points >= 30 ? '⚡' : '✨'}
                    </span>
                  </div>

                  {/* Big Arcade Center Number */}
                  <div className="flex flex-col items-center justify-center my-auto">
                    <span className="text-3xl sm:text-4xl md:text-5xl font-black font-mono tracking-tight text-text-main group-hover:text-primary group-hover:scale-110 transition-all drop-shadow-xs">
                      #{tile.id}
                    </span>
                  </div>

                  {/* Bottom Points Badge */}
                  <div className="w-full pt-1">
                    <span
                      className={`inline-flex items-center justify-center gap-1 w-full py-1 px-1.5 rounded-xl text-[10px] sm:text-xs font-black border transition-all ${pointTier.badgeBg} group-hover:scale-105 shadow-2xs`}
                    >
                      <span>{pointTier.icon}</span>
                      <span className="font-mono">{pointTier.label}</span>
                    </span>
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* REVEAL CARD MODAL (Power Card OR Question Tile) */}
      {activeTile && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 text-center animate-scale-up" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 font-mono">
                  #{activeTile.id}
                </span>
                <span className="text-xs font-black text-text-muted">
                  {t.currentTurn}: <span className="text-text-main font-bold">{cleanTeamDisplayName(currentActiveTeam.name)}</span>
                </span>
                <span className="text-xs font-mono font-black px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  +{activeTile.points} pts
                </span>
              </div>

              <div className="flex items-center gap-2">
                {timerSeconds !== null && !activeTile.isPowerCard && (
                  <div className="flex items-center gap-1.5 text-amber-500 font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>{timerSeconds} {t.secondsText}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTile(null);
                    setShowAnswer(false);
                  }}
                  className="p-1.5 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* POWER CARD EVENT REVEAL */}
            {activeTile.isPowerCard && activeTile.powerType ? (
              <div className={`p-6 sm:p-8 rounded-3xl bg-gradient-to-br shadow-2xl space-y-4 ${getPowerCardLocalized(activeTile.powerType, t).bg}`}>
                <span className="text-6xl sm:text-7xl block">{getPowerCardLocalized(activeTile.powerType, t).emoji}</span>
                <h2 className="text-2xl sm:text-3xl font-black">
                  {getPowerCardLocalized(activeTile.powerType, t).title}
                </h2>
                <p className="text-sm font-bold opacity-90 max-w-md mx-auto">
                  {getPowerCardLocalized(activeTile.powerType, t).desc}
                </p>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => handleApplyPowerCard(activeTile)}
                    className="px-8 py-3.5 bg-white text-slate-950 hover:bg-slate-100 rounded-2xl font-black text-sm shadow-xl cursor-pointer transform hover:scale-105 transition-all inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <span>{t.applyPowerupBtn}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* REGULAR QUESTION REVEAL */
              <div className="space-y-6">
                <div className="p-6 bg-primary-soft/50 border border-primary-border/40 rounded-3xl space-y-2">
                  {activeTile.item?.emoji && (
                    <span className="text-5xl block">{activeTile.item.emoji}</span>
                  )}
                  <h2 className="text-2xl sm:text-3xl font-black text-text-main" dir="auto">
                    {activeTile.question}
                  </h2>
                </div>

                {/* Show Answer Reveal Box */}
                {showAnswer ? (
                  <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3 animate-scale-up">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">{t.correctAnswerLabel}</span>
                    <h3 className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 font-mono" dir="ltr">
                      {activeTile.item?.german || activeTile.answer}
                    </h3>

                    {/* Audio Controls (Normal + Slow Speech) */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => speakGermanText(activeTile.item?.german || activeTile.answer, 0.85)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>نطق عادي (1.0x)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => speakGermanText(activeTile.item?.german || activeTile.answer, 0.6)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                      >
                        <Snail className="w-4 h-4" />
                        <span>نطق بطيء (0.6x)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAnswer(true);
                      speakGermanText(activeTile.item?.german || activeTile.answer, 0.85);
                    }}
                    className="px-8 py-3.5 bg-primary text-white rounded-2xl font-black text-sm shadow-lg hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <Eye className="w-5 h-5" />
                    <span>{t.showAnswerBtn}</span>
                  </button>
                )}

                {/* Teacher Rating buttons (Okay vs Oops) */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-border">
                  <button
                    type="button"
                    onClick={() => handleAwardQuestion(true)}
                    className="py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{t.correctBtn} (+{activeTile.points})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAwardQuestion(false)}
                    className="py-3.5 px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>{t.wrongBtn} (0)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
