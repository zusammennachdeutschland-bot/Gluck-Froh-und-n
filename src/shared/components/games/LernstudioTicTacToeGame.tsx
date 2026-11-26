import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem, LernstudioGameCompletionPayload } from '../../../types/lernstudio';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import {
  getSetVocabularyItems,
  getDistractorChoices,
  createSeededRandom
} from '../../../utils/lernstudioVocabularyAdapter';
import { GameSetupConfig } from '../LernstudioGameSetupScreen';
import { GameStageBanner } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Users,
  Bot,
  Volume2
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  gameConfig?: GameSetupConfig;
  onGameComplete?: (result: LernstudioGameCompletionPayload) => void;
  onBack: () => void;
}

type Player = 'X' | 'O';
type GameOpponent = 'pvp' | 'ai';

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

export const LernstudioTicTacToeGame: React.FC<Props> = ({
  set,
  language = 'ar',
  gameConfig,
  onGameComplete,
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const difficulty = gameConfig?.difficulty || set.difficulty || 'medium';
  const enableAudio = gameConfig?.enableAudio ?? true;
  const enableSoundFx = gameConfig?.enableSoundFx ?? true;

  const [sessionSeed, setSessionSeed] = useState<number>(() => Date.now());
  const items = useMemo(
    () => getSetVocabularyItems(set, language, gameConfig?.questionCount, sessionSeed),
    [set, language, gameConfig?.questionCount, sessionSeed]
  );
  const { triggerSparkles, triggerScorePopup, triggerCelebration, EffectsOverlay, SettingsBar } = useGameEffects(language);

  // Board: 9 cells (0 to 8)
  const [board, setBoard] = useState<(Player | null)[]>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [opponentMode, setOpponentMode] = useState<GameOpponent>(
    gameConfig?.gameMode === 'solo' ? 'ai' : 'pvp'
  );
  const [teamXName, setTeamXName] = useState(
    gameConfig?.teamNames?.[0] || (isRtl ? 'الفريق ❌ (الأزرق)' : 'Team ❌ (Blue)')
  );
  const [teamOName, setTeamOName] = useState(
    gameConfig?.teamNames?.[1] || (isRtl ? 'الفريق ⭕ (الأخضر)' : 'Team ⭕ (Green)')
  );
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });

  // In-turn question modal state
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<{
    targetItem: LernstudioItem;
    choices: LernstudioItem[];
  } | null>(null);
  const [questionFeedback, setQuestionFeedback] = useState<{ correct: boolean; msg: string } | null>(null);

  // Winner state
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const turnCounterRef = useRef(0);
  const correctAnswersRef = useRef(0);
  const totalAnswersRef = useRef(0);
  const startedAtRef = useRef(Date.now());

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  useEffect(() => {
    if (gameConfig?.teamNames?.[0]) setTeamXName(gameConfig.teamNames[0]);
    if (gameConfig?.teamNames?.[1]) setTeamOName(gameConfig.teamNames[1]);
  }, [gameConfig?.teamNames]);

  const reportMatchComplete = useCallback(
    (matchWinner: Player | 'draw', updatedScores: { X: number; O: number; draws: number }) => {
      if (!onGameComplete) return;
      const attempts = Math.max(1, totalAnswersRef.current);
      const accuracy = Math.min(100, Math.round((correctAnswersRef.current / attempts) * 100));
      onGameComplete({
        gameMode: 'tictactoe',
        score: (matchWinner === 'X' ? 100 : matchWinner === 'draw' ? 50 : 25) + correctAnswersRef.current * 25,
        maxScore: 325,
        accuracy,
        passed: matchWinner === 'X' || (opponentMode === 'pvp' && matchWinner !== null),
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        teamScores: { [teamXName]: updatedScores.X, [teamOName]: updatedScores.O },
        difficulty
      });
    },
    [onGameComplete, opponentMode, teamXName, teamOName, difficulty]
  );

  // Check winning lines
  const checkWinner = (squares: (Player | null)[]) => {
    for (let i = 0; i < WIN_LINES.length; i++) {
      const [a, b, c] = WIN_LINES[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a] as Player, line: WIN_LINES[i] };
      }
    }
    if (squares.every((sq) => sq !== null)) {
      return { winner: 'draw' as const, line: null };
    }
    return null;
  };

  const pickAiCell = (currentBoard: (Player | null)[], emptyIndices: number[], rng: () => number): number => {
    if (difficulty === 'easy') {
      return emptyIndices[Math.floor(rng() * emptyIndices.length)];
    }
    // Check immediate AI win ('O')
    for (const idx of emptyIndices) {
      const copy = [...currentBoard];
      copy[idx] = 'O';
      if (checkWinner(copy)?.winner === 'O') return idx;
    }
    // Block human win ('X')
    for (const idx of emptyIndices) {
      const copy = [...currentBoard];
      copy[idx] = 'X';
      if (checkWinner(copy)?.winner === 'X') return idx;
    }
    if (difficulty === 'hard') {
      if (currentBoard[4] === null) return 4;
      const corners = [0, 2, 6, 8].filter((c) => currentBoard[c] === null);
      if (corners.length > 0) return corners[Math.floor(rng() * corners.length)];
    }
    return emptyIndices[Math.floor(rng() * emptyIndices.length)];
  };

  // Click on a grid cell
  const handleCellClick = (index: number) => {
    if (board[index] || winner || activeCellIndex !== null || items.length === 0) return;

    turnCounterRef.current += 1;
    const rng = createSeededRandom(sessionSeed + index * 43 + turnCounterRef.current * 19);
    const target = items[(turnCounterRef.current + index) % items.length];
    const choices = getDistractorChoices(target, items, 2, rng);

    setActiveCellIndex(index);
    setActiveQuestion({ targetItem: target, choices });
    setQuestionFeedback(null);
  };

  // Basic Computer AI Move
  const triggerAiMove = (currentBoard: (Player | null)[]) => {
    const emptyIndices = currentBoard
      .map((val, idx) => (val === null ? idx : null))
      .filter((v): v is number => v !== null);

    if (emptyIndices.length === 0) return;

    scheduleTimeout(() => {
      turnCounterRef.current += 1;
      const rng = createSeededRandom(sessionSeed + turnCounterRef.current * 61);
      const chosenIndex = pickAiCell(currentBoard, emptyIndices, rng);
      const newBoard = [...currentBoard];
      newBoard[chosenIndex] = 'O';
      setBoard(newBoard);

      if (enableSoundFx) playLernstudioSound('card_match');

      const result = checkWinner(newBoard);
      if (result) {
        if (result.winner === 'draw') {
          setWinner('draw');
          setScores((s) => {
            const next = { ...s, draws: s.draws + 1 };
            reportMatchComplete('draw', next);
            return next;
          });
        } else {
          setWinner(result.winner);
          setWinningLine(result.line);
          setScores((s) => {
            const next = { ...s, [result.winner]: s[result.winner] + 1 };
            reportMatchComplete(result.winner, next);
            return next;
          });
        }
      } else {
        setCurrentPlayer('X');
      }
    }, 850);
  };

  // Submit answer for the active cell challenge
  const handleAnswerQuestion = (selectedItem: LernstudioItem) => {
    if (!activeQuestion || activeCellIndex === null || questionFeedback) return;

    const isCorrect = selectedItem.id === activeQuestion.targetItem.id;
    totalAnswersRef.current += 1;

    if (isCorrect) {
      correctAnswersRef.current += 1;
      if (enableSoundFx) {
        playLernstudioSound('correct');
        playGermanVoiceFeedback('correct');
      }
      triggerSparkles(50, 50, '#10b981');
      triggerScorePopup(currentPlayer === 'X' ? '❌' : '⭕', 50, 40, 'positive');
      if (enableAudio) speakGermanText(activeQuestion.targetItem.german);

      setQuestionFeedback({
        correct: true,
        msg: isRtl ? 'إجابة صحيحة! تم الاستيلاء على المربع 🎉' : 'Correct! Square claimed! 🎉'
      });

      const newBoard = [...board];
      newBoard[activeCellIndex] = currentPlayer;
      setBoard(newBoard);

      const result = checkWinner(newBoard);

      scheduleTimeout(() => {
        setActiveCellIndex(null);
        setActiveQuestion(null);
        setQuestionFeedback(null);

        if (result) {
          if (result.winner === 'draw') {
            setWinner('draw');
            setScores((s) => {
              const next = { ...s, draws: s.draws + 1 };
              reportMatchComplete('draw', next);
              return next;
            });
          } else {
            setWinner(result.winner);
            setWinningLine(result.line);
            setScores((s) => {
              const next = { ...s, [result.winner]: s[result.winner] + 1 };
              reportMatchComplete(result.winner, next);
              return next;
            });
            if (enableSoundFx) {
              playLernstudioSound('victory');
              playGermanVoiceFeedback('victory');
            }
            triggerCelebration(`الفائز: ${result.winner === 'X' ? teamXName : teamOName}! ❌⭕`);
          }
        } else {
          const nextPlayer: Player = currentPlayer === 'X' ? 'O' : 'X';
          setCurrentPlayer(nextPlayer);

          if (opponentMode === 'ai' && nextPlayer === 'O') {
            triggerAiMove(newBoard);
          }
        }
      }, 1400);
    } else {
      if (enableSoundFx) {
        playLernstudioSound('wrong');
        playGermanVoiceFeedback('wrong');
      }
      setQuestionFeedback({
        correct: false,
        msg: isRtl
          ? `إجابة خاطئة! الكلمة الصحيحة هي: ${activeQuestion.targetItem.german}`
          : `Wrong! Correct word is: ${activeQuestion.targetItem.german}`
      });

      const snapshotBoard = [...board];
      scheduleTimeout(() => {
        setActiveCellIndex(null);
        setActiveQuestion(null);
        setQuestionFeedback(null);

        const nextPlayer: Player = currentPlayer === 'X' ? 'O' : 'X';
        setCurrentPlayer(nextPlayer);

        if (opponentMode === 'ai' && nextPlayer === 'O') {
          triggerAiMove(snapshotBoard);
        }
      }, 2200);
    }
  };

  const handleResetBoard = () => {
    clearAllTimeouts();
    turnCounterRef.current = 0;
    correctAnswersRef.current = 0;
    totalAnswersRef.current = 0;
    startedAtRef.current = Date.now();
    setSessionSeed(Date.now());
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setWinningLine(null);
    setActiveCellIndex(null);
    setActiveQuestion(null);
    setQuestionFeedback(null);
  };

  return (
    <div
      className="min-h-[85vh] p-3 sm:p-5 rounded-3xl space-y-4 select-none transition-all bg-background text-text-main flex flex-col justify-between relative overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <EffectsOverlay />
      {/* Top Header Bar */}
      <div className="bg-surface p-3 sm:p-4 rounded-2xl border border-surface-border shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-surface-hover text-text-main hover:bg-primary hover:text-white transition-all cursor-pointer border border-surface-border inline-flex items-center gap-1.5 text-xs font-bold shrink-0"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.gamesPortalBack}</span>
          </button>

          <div>
            <h1 className="text-sm sm:text-base font-black text-text-main flex items-center gap-2">
              <span>❌⭕ لعبة X-O الكلمات (Word Tic-Tac-Toe)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {displayTitle}
              </span>
            </h1>
            <p className="text-[11px] text-text-muted font-bold">
              أجب عن السؤال الأكاديمي لتثبيت الرمز والسيطرة على ٣ مربعات متتالية!
            </p>
          </div>
        </div>

        {/* Mode Selector and Scoreboard */}
        <div className="flex items-center gap-2 flex-wrap">
          <SettingsBar />
          <div className="flex rounded-xl bg-surface-hover p-1 border border-surface-border text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setOpponentMode('pvp');
                handleResetBoard();
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                opponentMode === 'pvp' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>فريقين</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpponentMode('ai');
                handleResetBoard();
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                opponentMode === 'ai' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>ضد الحاسوب</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetBoard}
            className="p-2 rounded-xl bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text-main transition-colors cursor-pointer"
            title="إعادة الجولة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <GameStageBanner
        mode="tictactoe"
        title="لعبة X-O الكلمات (Word Tic-Tac-Toe)"
        subtitle={`${displayTitle} • سيطر على شبكة الـ X-O عبر الإجابة الصحيحة!`}
        badgeText={`❌ ${scores.X} : ${scores.O} ⭕`}
      />

      {/* Turn Banner & Scoreboard Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Team X Card */}
        <div
          className={`p-3 rounded-2xl border transition-all text-center space-y-1 ${
            currentPlayer === 'X' && !winner
              ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 scale-[1.02] shadow-sm'
              : 'bg-surface border-surface-border text-text-muted'
          }`}
        >
          <div className="flex items-center justify-between px-2">
            <span className="text-xl">❌</span>
            <span className="text-sm font-black font-mono">{scores.X} فوز</span>
          </div>
          <span className="text-xs font-bold block truncate">{teamXName}</span>
        </div>

        {/* Status in Center */}
        <div className="p-3 bg-surface border border-surface-border rounded-2xl flex flex-col items-center justify-center text-center">
          {winner ? (
            <div className="text-amber-500 font-black text-sm flex items-center gap-1.5">
              <Trophy className="w-4 h-4" />
              <span>
                {winner === 'draw'
                  ? 'تعادل! لا يوجد فائز'
                  : `الفائز: ${winner === 'X' ? teamXName : teamOName} 🎉`}
              </span>
            </div>
          ) : (
            <div className="text-xs font-bold text-text-muted">
              الدور الآن لـ: <span className="font-black text-text-main text-sm">{currentPlayer === 'X' ? teamXName : teamOName}</span>
            </div>
          )}
        </div>

        {/* Team O Card */}
        <div
          className={`p-3 rounded-2xl border transition-all text-center space-y-1 ${
            currentPlayer === 'O' && !winner
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 scale-[1.02] shadow-sm'
              : 'bg-surface border-surface-border text-text-muted'
          }`}
        >
          <div className="flex items-center justify-between px-2">
            <span className="text-xl">⭕</span>
            <span className="text-sm font-black font-mono">{scores.O} فوز</span>
          </div>
          <span className="text-xs font-bold block truncate">
            {opponentMode === 'ai' ? '🤖 الحاسوب الذكي' : teamOName}
          </span>
        </div>
      </div>

      {/* 3x3 Tic-Tac-Toe Grid */}
      <div className="flex-1 flex items-center justify-center p-2">
        <div className="grid grid-cols-3 gap-3 w-full max-w-[340px] sm:max-w-[400px] aspect-square">
          {board.map((cell, idx) => {
            const isWinningCell = winningLine?.includes(idx);

            let cellClass =
              'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/50';

            if (cell === 'X') {
              cellClass = isWinningCell
                ? 'bg-blue-500 text-white border-blue-600 scale-105 shadow-lg'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400';
            } else if (cell === 'O') {
              cellClass = isWinningCell
                ? 'bg-emerald-500 text-white border-emerald-600 scale-105 shadow-lg'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={cell !== null || winner !== null}
                onClick={() => handleCellClick(idx)}
                className={`rounded-3xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer font-black text-4xl sm:text-5xl shadow-sm ${cellClass}`}
              >
                {cell ? (
                  <span>{cell === 'X' ? '❌' : '⭕'}</span>
                ) : (
                  <span className="text-xs text-text-muted/40 font-mono">#{idx + 1}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cell Challenge Question Modal */}
      {activeQuestion && (
        <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
          <div className="bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl text-center space-y-4 animate-scale-up" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-surface-border pb-2">
              <span className="text-xs font-black text-primary">
                تحدي السيطرة على المربع #{activeCellIndex! + 1} ({currentPlayer})
              </span>
              <span className="text-lg">{currentPlayer === 'X' ? '❌' : '⭕'}</span>
            </div>

            {/* Target Display */}
            <div className="p-4 bg-primary-soft/40 border border-primary-border/40 rounded-2xl space-y-1">
              {activeQuestion.targetItem.emoji && (
                <div className="text-5xl select-none">{activeQuestion.targetItem.emoji}</div>
              )}
              <h3 className="text-xl sm:text-2xl font-black text-text-main">
                {getItemTranslation(activeQuestion.targetItem, language)}
              </h3>
            </div>

            {/* Choices */}
            <div className="grid grid-cols-1 gap-2 pt-1">
              {activeQuestion.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  disabled={questionFeedback !== null}
                  onClick={() => handleAnswerQuestion(choice)}
                  className="py-3 px-4 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border hover:border-primary text-text-main font-black text-sm font-mono transition-all cursor-pointer flex items-center justify-between gap-2"
                  dir="ltr"
                >
                  <span>{choice.german}</span>
                  <Volume2
                    className="w-4 h-4 text-text-muted hover:text-primary shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakGermanText(choice.german);
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Feedback message */}
            {questionFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold animate-fade-in ${
                  questionFeedback.correct
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                }`}
              >
                {questionFeedback.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
