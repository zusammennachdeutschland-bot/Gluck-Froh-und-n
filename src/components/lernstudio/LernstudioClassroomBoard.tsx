import React, { useState, useEffect, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem } from '../../types/lernstudio';
import { Group, Student } from '../../types';
import { useApp } from '../../context/AppContext';
import { getLernstudioTranslations, LernstudioTranslations } from '../../utils/lernstudioTranslations';
import {
  detectCurrentScheduledGroup,
  filterGroupsByDayAndTime,
  getStudentsForGroup
} from '../../utils/groupScheduleUtils';
import { playLernstudioSound } from '../../utils/lernstudioAudioUtils';
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
  Search
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
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
  { name: 'Red', bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', emoji: '🔴' },
  { name: 'Blue', bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500', emoji: '🔵' },
  { name: 'Green', bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500', emoji: '🟢' },
  { name: 'Yellow', bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500', emoji: '🟡' },
  { name: 'Purple', bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500', emoji: '🟣' },
  { name: 'Pink', bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500', emoji: '🌸' }
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

export const LernstudioClassroomBoard: React.FC<Props> = ({ set, activeTheme, onBack }) => {
  const { groups = [], students = [], language = 'ar' } = useApp();
  const t = getLernstudioTranslations(language);

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
          name: assignedStudents.length > 0 ? names : (language === 'ar' ? `الفريق ${teamIdx + 1}` : `Team ${teamIdx + 1}`),
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
        name: language === 'ar' ? `الفريق ${c.name}` : `Team ${c.name}`,
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
        question: item.arabic || item.exampleSentenceArabic || item.emoji || 'What is the German word?',
        answer: item.german + (item.plural ? ` (Plural: ${item.plural})` : '') + (item.exampleSentenceGerman ? ` • ${item.exampleSentenceGerman}` : ''),
        isAnswered: false
      };
    });

    setTiles(generatedTiles);
    setActiveTeamIndex(0);
    setIsGameOver(false);
    setIsPlaying(true);
    setHistoryStack([]);
    /* confetti removed */
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

    /* confetti removed */
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
      /* confetti removed */
    } else {
      playLernstudioSound('wrong');
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
      /* confetti removed */
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
        <Trophy className="w-20 h-20 text-amber-500 mx-auto" />
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

      {/* Turn Banner Indicator */}
      <div className={`p-3.5 rounded-2xl border shadow-md flex items-center justify-between gap-3 ${currentActiveTeam.colorBg} text-white animate-pulse`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{currentActiveTeam.badgeEmoji}</span>
          <span className="font-black text-sm sm:text-base">{t.currentTurn} {cleanTeamDisplayName(currentActiveTeam.name)}</span>
        </div>

        <span className="text-xs font-black bg-black/20 px-3 py-1 rounded-xl">
          {t.scorePts} {currentActiveTeam.score}
        </span>
      </div>

      {/* Teams Scoreboard Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
        {teams.map((team, idx) => {
          const isTurn = idx === activeTeamIndex;
          return (
            <div
              key={team.id}
              className={`p-3 rounded-2xl border transition-all shadow-xs flex flex-col justify-between gap-2 ${
                team.colorBg
              } text-white ${isTurn ? 'ring-4 ring-amber-400 scale-[1.02] shadow-lg' : 'opacity-80'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-xs truncate max-w-[100px]">{cleanTeamDisplayName(team.name)}</span>
                <span className="text-base font-black">{team.score}</span>
              </div>

              <div className="flex items-center gap-1 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleUpdateTeamScore(idx, -5)}
                  className="p-1 rounded-lg bg-black/20 hover:bg-black/40 text-white cursor-pointer transition-colors"
                  title="-5"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateTeamScore(idx, 10)}
                  className="p-1 rounded-lg bg-black/20 hover:bg-black/40 text-white cursor-pointer transition-colors"
                  title="+10"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid of Numbered Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            disabled={tile.isAnswered}
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
            className={`h-24 sm:h-28 rounded-2xl border-2 font-black flex flex-col items-center justify-center gap-1 transition-all shadow-md cursor-pointer ${
              tile.isAnswered
                ? 'bg-surface-hover/50 border-surface-border opacity-30 cursor-not-allowed text-text-muted'
                : 'bg-surface hover:bg-primary-soft hover:scale-105 border-primary/50 text-text-main hover:border-primary'
            }`}
          >
            <span className="text-2xl sm:text-3xl font-black">#{tile.id}</span>
            {!tile.isAnswered && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary-soft text-primary font-mono">
                {tile.points} pts
              </span>
            )}
            {tile.isAnswered && <span className="text-[10px] text-emerald-600 font-bold">✓</span>}
          </button>
        ))}
      </div>

      {/* REVEAL CARD MODAL (Power Card OR Question Tile) */}
      {activeTile && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 text-center animate-scale-up" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <span className="text-xs font-black text-primary">
                #{activeTile.id} • {t.currentTurn} ({cleanTeamDisplayName(currentActiveTeam.name)})
              </span>

              {timerSeconds !== null && !activeTile.isPowerCard && (
                <div className="flex items-center gap-1.5 text-amber-500 font-mono font-black text-sm">
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>{timerSeconds} {t.secondsText}</span>
                </div>
              )}
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
                  <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2 animate-scale-up">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">{t.correctAnswerLabel}</span>
                    <h3 className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 font-mono" dir="ltr">
                      {activeTile.answer}
                    </h3>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAnswer(true)}
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
