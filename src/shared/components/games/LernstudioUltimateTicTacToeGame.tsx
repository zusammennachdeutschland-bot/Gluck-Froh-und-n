import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LernstudioSet, LernstudioTheme, LernstudioItem } from '../../../types/lernstudio';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../../utils/audioSpeechUtils';
import { getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import { SharedVictoryTrophyArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Users,
  Bot,
  Volume2,
  VolumeX,
  Sparkles,
  HelpCircle,
  Play,
  Crown,
  Shuffle,
  Brain,
  Zap,
  Shield,
  BookOpen,
  X,
  CheckCircle2,
  Compass,
  Award
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

export type Player = 'X' | 'O';
export type SubBoardState = Player | 'draw' | null;
export type OpponentMode = 'pvp' | 'ai';
export type AIDifficulty = 'easy' | 'medium' | 'hard';
export type StarterChoice = 'X' | 'O' | 'random';

export interface UltimateMove {
  boardIdx: number;
  cellIdx: number;
}

const WIN_LINES: readonly [number, number, number][] = [
  [0, 1, 2], // Horizontal Top
  [3, 4, 5], // Horizontal Middle
  [6, 7, 8], // Horizontal Bottom
  [0, 3, 6], // Vertical Left
  [1, 4, 7], // Vertical Center
  [2, 5, 8], // Vertical Right
  [0, 4, 8], // Diagonal Main
  [2, 4, 6]  // Diagonal Anti
];

// Positional strategic weights for cells/sub-boards (Center = 5, Corners = 1,3,7,9, Edges = 2,4,6,8)
const POSITIONAL_WEIGHTS = [3, 2, 3, 2, 4, 2, 3, 2, 3];

const STORAGE_KEY = 'gluck_lernstudio_ultimate_xo_v1';

/**
 * Pure helper: checks if a 3x3 array has a winner or is a draw
 */
export function evaluateGrid3x3(
  cells: (Player | 'draw' | null)[]
): { winner: Player | 'draw' | null; line: [number, number, number] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const valA = cells[a];
    if ((valA === 'X' || valA === 'O') && valA === cells[b] && valA === cells[c]) {
      return { winner: valA, line };
    }
  }
  if (cells.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null };
  }
  return { winner: null, line: null };
}

/**
 * Pure helper: returns all strictly legal moves for the current Ultimate XO state
 */
export function getLegalUltimateMoves(
  subBoards: (Player | null)[][],
  macroBoard: SubBoardState[],
  activeBoardIndex: number | null
): UltimateMove[] {
  const moves: UltimateMove[] = [];

  // Determine which sub-boards are legal to play in
  const targetBoards: number[] = [];
  if (activeBoardIndex !== null && macroBoard[activeBoardIndex] === null) {
    targetBoards.push(activeBoardIndex);
  } else {
    for (let b = 0; b < 9; b++) {
      if (macroBoard[b] === null) {
        targetBoards.push(b);
      }
    }
  }

  for (const b of targetBoards) {
    const sub = subBoards[b];
    for (let c = 0; c < 9; c++) {
      if (sub[c] === null) {
        moves.push({ boardIdx: b, cellIdx: c });
      }
    }
  }

  return moves;
}

/**
 * Pure helper: clones state and applies a move, returning next state
 */
export function simulateMove(
  subBoards: (Player | null)[][],
  macroBoard: SubBoardState[],
  move: UltimateMove,
  player: Player
): {
  nextSubBoards: (Player | null)[][];
  nextMacroBoard: SubBoardState[];
  nextActiveBoard: number | null;
  macroOutcome: { winner: Player | 'draw' | null; line: [number, number, number] | null };
  subBoardWonByMove: Player | 'draw' | null;
  subBoardWinLine: [number, number, number] | null;
} {
  const nextSubBoards = subBoards.map((row, idx) => (idx === move.boardIdx ? [...row] : row));
  nextSubBoards[move.boardIdx][move.cellIdx] = player;

  const nextMacroBoard = [...macroBoard];
  const subEval = evaluateGrid3x3(nextSubBoards[move.boardIdx]);
  let subBoardWonByMove: Player | 'draw' | null = null;
  let subBoardWinLine: [number, number, number] | null = null;

  if (subEval.winner !== null) {
    nextMacroBoard[move.boardIdx] = subEval.winner;
    subBoardWonByMove = subEval.winner;
    subBoardWinLine = subEval.line;
  }

  const macroOutcome = evaluateGrid3x3(nextMacroBoard);

  // Core Ultimate XO Routing Rule:
  // Next player must play in sub-board = move.cellIdx UNLESS that sub-board is already finished
  const nextActiveBoard =
    macroOutcome.winner !== null
      ? null
      : nextMacroBoard[move.cellIdx] === null
      ? move.cellIdx
      : null;

  return {
    nextSubBoards,
    nextMacroBoard,
    nextActiveBoard,
    macroOutcome,
    subBoardWonByMove,
    subBoardWinLine
  };
}

/**
 * Heuristic evaluation of a 3x3 grid for AI ('O' is AI maximizing, 'X' is opponent minimizing)
 */
function evaluateSmallGridHeuristic(cells: (Player | 'draw' | null)[], aiPlayer: Player): number {
  const humanPlayer: Player = aiPlayer === 'O' ? 'X' : 'O';
  let score = 0;

  for (let i = 0; i < 9; i++) {
    if (cells[i] === aiPlayer) score += POSITIONAL_WEIGHTS[i];
    else if (cells[i] === humanPlayer) score -= POSITIONAL_WEIGHTS[i];
  }

  for (const [a, b, c] of WIN_LINES) {
    const lineVals = [cells[a], cells[b], cells[c]];
    const aiCount = lineVals.filter((v) => v === aiPlayer).length;
    const humanCount = lineVals.filter((v) => v === humanPlayer).length;
    const emptyCount = lineVals.filter((v) => v === null).length;

    if (aiCount === 2 && emptyCount === 1) score += 18;
    else if (humanCount === 2 && emptyCount === 1) score -= 18;
  }

  return score;
}

/**
 * Full Ultimate XO State Heuristic for Minimax AI
 */
function evaluateUltimateState(
  subBoards: (Player | null)[][],
  macroBoard: SubBoardState[],
  activeBoardIndex: number | null,
  aiPlayer: Player
): number {
  const humanPlayer: Player = aiPlayer === 'O' ? 'X' : 'O';
  const macroEval = evaluateGrid3x3(macroBoard);

  if (macroEval.winner === aiPlayer) return 100000;
  if (macroEval.winner === humanPlayer) return -100000;
  if (macroEval.winner === 'draw') return 0;

  let totalScore = 0;

  // 1. Evaluate Macro Board control & 2-in-a-row macro threats
  totalScore += evaluateSmallGridHeuristic(macroBoard, aiPlayer) * 45;

  // 2. Evaluate each of the 9 sub-boards weighted by its macro importance
  for (let b = 0; b < 9; b++) {
    const weight = POSITIONAL_WEIGHTS[b];
    if (macroBoard[b] === aiPlayer) {
      totalScore += 140 * weight;
    } else if (macroBoard[b] === humanPlayer) {
      totalScore -= 140 * weight;
    } else if (macroBoard[b] === null) {
      totalScore += evaluateSmallGridHeuristic(subBoards[b], aiPlayer) * weight;
    }
  }

  // 3. Slight bonus/penalty if current activeBoardIndex is open
  if (activeBoardIndex === null) {
    // Free move is advantageous for whoever is about to move
    totalScore += 15;
  }

  return totalScore;
}

/**
 * Choose AI Move according to difficulty ('easy' | 'medium' | 'hard')
 */
export function chooseUltimateAIMove(
  subBoards: (Player | null)[][],
  macroBoard: SubBoardState[],
  activeBoardIndex: number | null,
  aiPlayer: Player,
  difficulty: AIDifficulty
): UltimateMove | null {
  const legalMoves = getLegalUltimateMoves(subBoards, macroBoard, activeBoardIndex);
  if (legalMoves.length === 0) return null;

  // 1. EASY: Pure random legal move
  if (difficulty === 'easy') {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  const humanPlayer: Player = aiPlayer === 'O' ? 'X' : 'O';

  // 2. MEDIUM: Win sub-board, block opponent sub-board win, avoid sending opponent to a free board or instant win
  if (difficulty === 'medium') {
    let bestScore = -Infinity;
    let bestCandidates: UltimateMove[] = [];

    for (const move of legalMoves) {
      let moveScore = POSITIONAL_WEIGHTS[move.cellIdx] * 3 + POSITIONAL_WEIGHTS[move.boardIdx] * 2;

      // Does this move win the sub-board for AI?
      const simAi = simulateMove(subBoards, macroBoard, move, aiPlayer);
      if (simAi.macroOutcome.winner === aiPlayer) return move; // Immediate game win!
      if (simAi.subBoardWonByMove === aiPlayer) {
        moveScore += 200 * POSITIONAL_WEIGHTS[move.boardIdx];
      }

      // Would opponent have won this sub-board if they played here? (Block!)
      const simHumanHere = simulateMove(subBoards, macroBoard, move, humanPlayer);
      if (simHumanHere.subBoardWonByMove === humanPlayer) {
        moveScore += 160 * POSITIONAL_WEIGHTS[move.boardIdx];
      }

      // Penalty if this move gives the human a FREE MOVE (sending to an already closed sub-board)
      if (simAi.nextActiveBoard === null) {
        moveScore -= 70;
      } else {
        // Check if human can immediately win the target sub-board we send them to
        const targetB = simAi.nextActiveBoard;
        const targetSub = simAi.nextSubBoards[targetB];
        for (let c = 0; c < 9; c++) {
          if (targetSub[c] === null) {
            const testCopy = [...targetSub];
            testCopy[c] = humanPlayer;
            if (evaluateGrid3x3(testCopy).winner === humanPlayer) {
              moveScore -= 95;
              break;
            }
          }
        }
      }

      if (moveScore > bestScore) {
        bestScore = moveScore;
        bestCandidates = [move];
      } else if (moveScore === bestScore) {
        bestCandidates.push(move);
      }
    }

    return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
  }

  // 3. HARD: Minimax with Alpha-Beta Pruning
  const maxDepth = legalMoves.length > 20 ? 3 : 4;

  function minimax(
    curSubBoards: (Player | null)[][],
    curMacroBoard: SubBoardState[],
    curActiveBoard: number | null,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
  ): number {
    const macroCheck = evaluateGrid3x3(curMacroBoard);
    if (macroCheck.winner === aiPlayer) return 100000 + depth * 100;
    if (macroCheck.winner === humanPlayer) return -100000 - depth * 100;
    if (macroCheck.winner === 'draw' || depth === 0) {
      return evaluateUltimateState(curSubBoards, curMacroBoard, curActiveBoard, aiPlayer);
    }

    const moves = getLegalUltimateMoves(curSubBoards, curMacroBoard, curActiveBoard);
    if (moves.length === 0) {
      return evaluateUltimateState(curSubBoards, curMacroBoard, curActiveBoard, aiPlayer);
    }

    // Order moves to improve alpha-beta pruning (prefer center & corners)
    const orderedMoves = moves.sort(
      (a, b) => POSITIONAL_WEIGHTS[b.cellIdx] - POSITIONAL_WEIGHTS[a.cellIdx]
    );

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const m of orderedMoves) {
        const sim = simulateMove(curSubBoards, curMacroBoard, m, aiPlayer);
        // Penalize giving human a free move
        const freeMovePenalty = sim.nextActiveBoard === null ? -35 : 0;
        const evalScore =
          minimax(
            sim.nextSubBoards,
            sim.nextMacroBoard,
            sim.nextActiveBoard,
            depth - 1,
            alpha,
            beta,
            false
          ) + freeMovePenalty;
        if (evalScore > maxEval) maxEval = evalScore;
        if (evalScore > alpha) alpha = evalScore;
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of orderedMoves) {
        const sim = simulateMove(curSubBoards, curMacroBoard, m, humanPlayer);
        const freeMoveBonus = sim.nextActiveBoard === null ? 35 : 0;
        const evalScore =
          minimax(
            sim.nextSubBoards,
            sim.nextMacroBoard,
            sim.nextActiveBoard,
            depth - 1,
            alpha,
            beta,
            true
          ) + freeMoveBonus;
        if (evalScore < minEval) minEval = evalScore;
        if (evalScore < beta) beta = evalScore;
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  let bestMove = legalMoves[0];
  let bestVal = -Infinity;

  for (const move of legalMoves) {
    const sim = simulateMove(subBoards, macroBoard, move, aiPlayer);
    if (sim.macroOutcome.winner === aiPlayer) return move; // Instant victory

    const freeMovePenalty = sim.nextActiveBoard === null ? -45 : 0;
    const val =
      minimax(
        sim.nextSubBoards,
        sim.nextMacroBoard,
        sim.nextActiveBoard,
        maxDepth - 1,
        -Infinity,
        Infinity,
        false
      ) +
      freeMovePenalty +
      POSITIONAL_WEIGHTS[move.cellIdx] * 2;

    if (val > bestVal) {
      bestVal = val;
      bestMove = move;
    }
  }

  return bestMove;
}

/**
 * Custom 3D-Styled X and O Mark Components
 */
const AnimatedMarkX: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <motion.svg
    initial={{ scale: 0.2, rotate: -45, opacity: 0 }}
    animate={{ scale: 1, rotate: 0, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 380, damping: 20 }}
    viewBox="0 0 64 64"
    className={size === 'lg' ? 'w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_10px_rgba(244,63,94,0.6)]' : 'w-5 h-5 sm:w-6 sm:h-6 drop-shadow-xs'}
  >
    <defs>
      <linearGradient id="ultXGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FB7185" />
        <stop offset="50%" stopColor="#F43F5E" />
        <stop offset="100%" stopColor="#E11D48" />
      </linearGradient>
    </defs>
    <path
      d="M14 14 L50 50 M50 14 L14 50"
      stroke="url(#ultXGrad)"
      strokeWidth={size === 'lg' ? 11 : 10}
      strokeLinecap="round"
    />
    <path
      d="M16 14 L50 48"
      stroke="#FFE4E6"
      strokeWidth={size === 'lg' ? 2.5 : 2}
      strokeLinecap="round"
      opacity="0.65"
    />
  </motion.svg>
);

const AnimatedMarkO: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <motion.svg
    initial={{ scale: 0.2, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 380, damping: 20 }}
    viewBox="0 0 64 64"
    className={size === 'lg' ? 'w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_10px_rgba(56,189,248,0.6)]' : 'w-5 h-5 sm:w-6 sm:h-6 drop-shadow-xs'}
  >
    <defs>
      <linearGradient id="ultOGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7DD3FC" />
        <stop offset="50%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0284C7" />
      </linearGradient>
    </defs>
    <circle
      cx="32"
      cy="32"
      r="19"
      fill="none"
      stroke="url(#ultOGrad)"
      strokeWidth={size === 'lg' ? 10 : 9.5}
    />
    <path
      d="M 20 18 A 19 19 0 0 1 44 18"
      fill="none"
      stroke="#E0F2FE"
      strokeWidth={size === 'lg' ? 2.5 : 2}
      strokeLinecap="round"
      opacity="0.7"
    />
  </motion.svg>
);

export const LernstudioUltimateTicTacToeGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack
}) => {
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const items = useMemo(() => set.items || [], [set.items]);
  const { triggerSparkles, triggerScorePopup, triggerCelebration, EffectsOverlay } = useGameEffects(language);

  // Start Screen vs Active Match State
  const [showStartScreen, setShowStartScreen] = useState<boolean>(true);
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('pvp');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [starterChoice, setStarterChoice] = useState<StarterChoice>('X');
  const [vocabGateEnabled, setVocabGateEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  // Player Names
  const [playerXName, setPlayerXName] = useState<string>(
    isRtl ? 'البطل X (الأحمر الياقوتي)' : language === 'de' ? 'Spieler X (Rubinrot)' : 'Player X (Ruby)'
  );
  const [playerOName, setPlayerOName] = useState<string>(
    isRtl ? 'البطل O (الأزرق السماوي)' : language === 'de' ? 'Spieler O (Saphirblau)' : 'Player O (Sapphire)'
  );

  // 9x9 Ultimate XO Board State
  const [subBoards, setSubBoards] = useState<(Player | null)[][]>(() =>
    Array.from({ length: 9 }, () => Array(9).fill(null))
  );
  const [macroBoard, setMacroBoard] = useState<SubBoardState[]>(() => Array(9).fill(null));
  const [subBoardWinLines, setSubBoardWinLines] = useState<([number, number, number] | null)[]>(() =>
    Array(9).fill(null)
  );
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [activeBoardIndex, setActiveBoardIndex] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<{ boardIdx: number; cellIdx: number; player: Player } | null>(null);

  // Match Outcome State
  const [gameWinner, setGameWinner] = useState<Player | 'draw' | null>(null);
  const [macroWinningLine, setMacroWinningLine] = useState<[number, number, number] | null>(null);

  // Overall Match Scoreboard
  const [matchScores, setMatchScores] = useState<{ X: number; O: number; draws: number }>({
    X: 0,
    O: 0,
    draws: 0
  });

  // Celebratory Vocabulary Banner when a sub-board is conquered
  const [conqueredVocabBanner, setConqueredVocabBanner] = useState<{
    boardIdx: number;
    player: Player;
    item: LernstudioItem;
  } | null>(null);

  // Vocabulary Gate Modal State (Active on every cell click by default)
  const [pendingMove, setPendingMove] = useState<UltimateMove | null>(null);
  const [vocabQuestion, setVocabQuestion] = useState<{
    targetItem: LernstudioItem;
    choices: LernstudioItem[];
  } | null>(null);
  const [questionFeedback, setQuestionFeedback] = useState<{
    correct: boolean;
    msg: string;
    selectedId: string;
  } | null>(null);

  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sound helper respecting soundEnabled toggle
  const playGameSfx = useCallback(
    (type: Parameters<typeof playLernstudioSound>[0]) => {
      if (soundEnabled) {
        playLernstudioSound(type);
      }
    },
    [soundEnabled]
  );

  // Load saved scores from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.matchScores) {
          setMatchScores(parsed.matchScores);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save scores to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ matchScores }));
    } catch {
      // Ignore storage errors
    }
  }, [matchScores]);

  // Count how many mini-boards each player currently owns
  const subBoardCounts = useMemo(() => {
    let xWon = 0;
    let oWon = 0;
    let drawn = 0;
    for (const state of macroBoard) {
      if (state === 'X') xWon++;
      else if (state === 'O') oWon++;
      else if (state === 'draw') drawn++;
    }
    return { xWon, oWon, drawn, open: 9 - xWon - oWon - drawn };
  }, [macroBoard]);

  // Execute a validated move on (boardIdx, cellIdx)
  const executeMove = useCallback(
    (move: UltimateMove, player: Player) => {
      const sim = simulateMove(subBoards, macroBoard, move, player);

      setSubBoards(sim.nextSubBoards);
      setMacroBoard(sim.nextMacroBoard);
      setActiveBoardIndex(sim.nextActiveBoard);
      setLastMove({ boardIdx: move.boardIdx, cellIdx: move.cellIdx, player });

      if (sim.subBoardWinLine) {
        setSubBoardWinLines((prev) =>
          prev.map((line, idx) => (idx === move.boardIdx ? sim.subBoardWinLine : line))
        );
      }

      // Did this move conquer a mini-board?
      if (sim.subBoardWonByMove === 'X' || sim.subBoardWonByMove === 'O') {
        playGameSfx('powerup_star');
        triggerSparkles(50, 45, sim.subBoardWonByMove === 'X' ? '#f43f5e' : '#38bdf8');
        triggerScorePopup(
          `${sim.subBoardWonByMove} ★ #${move.boardIdx + 1}`,
          50,
          42,
          'positive'
        );

        // Show a celebratory German word from the set if available
        if (items.length > 0) {
          const pickedItem = items[move.boardIdx % items.length];
          setConqueredVocabBanner({
            boardIdx: move.boardIdx,
            player: sim.subBoardWonByMove,
            item: pickedItem
          });
          if (soundEnabled && pickedItem.german) {
            speakGermanText(pickedItem.german, 0.9);
          }
        }
      } else {
        playGameSfx('correct');
      }

      // Did this move finish the entire Ultimate XO match?
      if (sim.macroOutcome.winner !== null) {
        setGameWinner(sim.macroOutcome.winner);
        setMacroWinningLine(sim.macroOutcome.line);

        if (sim.macroOutcome.winner === 'X' || sim.macroOutcome.winner === 'O') {
          const w = sim.macroOutcome.winner;
          setMatchScores((prev) => ({ ...prev, [w]: prev[w] + 1 }));
          playGameSfx('fanfare_victory');
          if (soundEnabled) playGermanVoiceFeedback('gewonnen');
          triggerCelebration();
        } else {
          setMatchScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
          playGameSfx('powerup_swap');
        }
      } else {
        setCurrentPlayer(player === 'X' ? 'O' : 'X');
      }
    },
    [subBoards, macroBoard, items, playGameSfx, soundEnabled, triggerSparkles, triggerScorePopup, triggerCelebration]
  );

  // Start / Restart Match cleanly
  const startNewMatch = useCallback(
    (goToStartScreen = false) => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }

      const resolvedStarter: Player =
        starterChoice === 'random'
          ? Math.random() < 0.5
            ? 'X'
            : 'O'
          : starterChoice;

      setSubBoards(Array.from({ length: 9 }, () => Array(9).fill(null)));
      setMacroBoard(Array(9).fill(null));
      setSubBoardWinLines(Array(9).fill(null));
      setCurrentPlayer(resolvedStarter);
      setActiveBoardIndex(null);
      setLastMove(null);
      setGameWinner(null);
      setMacroWinningLine(null);
      setConqueredVocabBanner(null);
      setPendingMove(null);
      setVocabQuestion(null);

      if (goToStartScreen) {
        setShowStartScreen(true);
      } else {
        setShowStartScreen(false);
        playGameSfx('powerup_star');
      }
    },
    [starterChoice, playGameSfx]
  );

  // AI Turn Trigger (when opponentMode === 'ai' and currentPlayer === 'O' and game is active)
  useEffect(() => {
    if (showStartScreen || gameWinner !== null || pendingMove !== null) return;

    if (opponentMode === 'ai' && currentPlayer === 'O') {
      aiTimeoutRef.current = setTimeout(() => {
        const aiMove = chooseUltimateAIMove(subBoards, macroBoard, activeBoardIndex, 'O', aiDifficulty);
        if (aiMove) {
          executeMove(aiMove, 'O');
        }
      }, 520);
    }

    return () => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
    };
  }, [
    showStartScreen,
    gameWinner,
    pendingMove,
    opponentMode,
    currentPlayer,
    subBoards,
    macroBoard,
    activeBoardIndex,
    aiDifficulty,
    executeMove
  ]);

  // Handle Player Clicking Cell (boardIdx, cellIdx)
  const handleCellClick = (boardIdx: number, cellIdx: number) => {
    if (gameWinner !== null || pendingMove !== null) return;
    if (opponentMode === 'ai' && currentPlayer === 'O') return; // Wait for AI

    // Rule Check 1: Sub-board must not be finished
    if (macroBoard[boardIdx] !== null) return;

    // Rule Check 2: Must play in activeBoardIndex if specified
    if (activeBoardIndex !== null && activeBoardIndex !== boardIdx) return;

    // Rule Check 3: Cell must be empty
    if (subBoards[boardIdx][cellIdx] !== null) return;

    // Ask a vocabulary question for every selected cell (even if set has 1 item, fill with fallback German distractors)
    if (vocabGateEnabled) {
      const fallbackVocabulary: LernstudioItem[] = [
        { id: 'fb_1', german: 'der Hund', arabic: 'الكلب', english: 'Dog', emoji: '🐶' },
        { id: 'fb_2', german: 'die Katze', arabic: 'القطة', english: 'Cat', emoji: '🐱' },
        { id: 'fb_3', german: 'das Buch', arabic: 'الكتاب', english: 'Book', emoji: '📖' },
        { id: 'fb_4', german: 'der Apfel', arabic: 'التفاحة', english: 'Apple', emoji: '🍎' },
        { id: 'fb_5', german: 'die Schule', arabic: 'المدرسة', english: 'School', emoji: '🏫' },
        { id: 'fb_6', german: 'das Haus', arabic: 'المنزل', english: 'House', emoji: '🏠' }
      ];

      const sourcePool = items.length > 0 ? items : fallbackVocabulary;
      const target = sourcePool[(boardIdx * 3 + cellIdx + Math.floor(Math.random() * sourcePool.length)) % sourcePool.length];

      const combinedDistractorPool = [...items, ...fallbackVocabulary].filter(
        (it) => it.id !== target.id && it.german.toLowerCase() !== target.german.toLowerCase()
      );

      const uniqueDistractors: LernstudioItem[] = [];
      for (const candidate of combinedDistractorPool.sort(() => 0.5 - Math.random())) {
        if (!uniqueDistractors.some((d) => d.german.toLowerCase() === candidate.german.toLowerCase())) {
          uniqueDistractors.push(candidate);
        }
        if (uniqueDistractors.length >= 2) break;
      }

      const choices = [target, ...uniqueDistractors].sort(() => 0.5 - Math.random());

      setPendingMove({ boardIdx, cellIdx });
      setVocabQuestion({ targetItem: target, choices });
      setQuestionFeedback(null);
      return;
    }

    executeMove({ boardIdx, cellIdx }, currentPlayer);
  };

  // Handle answering the Cell Vocabulary Challenge question
  const handleVocabAnswer = (chosen: LernstudioItem) => {
    if (!vocabQuestion || !pendingMove || questionFeedback !== null) return;
    const isCorrect = chosen.id === vocabQuestion.targetItem.id;

    if (isCorrect) {
      playGameSfx('correct');
      if (soundEnabled) {
        playGermanVoiceFeedback('richtig');
        speakGermanText(vocabQuestion.targetItem.german, 0.9);
      }
      setQuestionFeedback({
        correct: true,
        selectedId: chosen.id,
        msg: isRtl
          ? `إجابة صحيحة! تم وضع ${currentPlayer === 'X' ? '❌' : '⭕'} في المربع #${pendingMove.cellIdx + 1} 🎉`
          : language === 'de'
          ? `Richtig! Feld #${pendingMove.cellIdx + 1} erobert! 🎉`
          : `Correct! Cell #${pendingMove.cellIdx + 1} claimed! 🎉`
      });

      const moveToRun = pendingMove;
      setTimeout(() => {
        setPendingMove(null);
        setVocabQuestion(null);
        setQuestionFeedback(null);
        executeMove(moveToRun, currentPlayer);
      }, 1100);
    } else {
      playGameSfx('wrong');
      if (soundEnabled) {
        playGermanVoiceFeedback('noch_einmal');
        speakGermanText(vocabQuestion.targetItem.german, 0.85);
      }
      setQuestionFeedback({
        correct: false,
        selectedId: chosen.id,
        msg: isRtl
          ? `إجابة خاطئة! الكلمة الصحيحة هي: ${vocabQuestion.targetItem.german}`
          : language === 'de'
          ? `Falsch! Das richtige Wort ist: ${vocabQuestion.targetItem.german}`
          : `Wrong! The correct word is: ${vocabQuestion.targetItem.german}`
      });

      // Turn passes to opponent after showing the correct answer
      setTimeout(() => {
        setPendingMove(null);
        setVocabQuestion(null);
        setQuestionFeedback(null);
        setCurrentPlayer((prev) => (prev === 'X' ? 'O' : 'X'));
      }, 1900);
    }
  };

  const activePlayerName =
    currentPlayer === 'X'
      ? playerXName
      : opponentMode === 'ai'
      ? isRtl
        ? `الروبوت الذكي (${aiDifficulty === 'easy' ? 'سهل' : aiDifficulty === 'medium' ? 'متوسط' : 'صعب'}) 🤖`
        : `Smart AI (${aiDifficulty.toUpperCase()}) 🤖`
      : playerOName;

  // ============================================================================
  // 1. START SCREEN (شاشة البداية الاحترافية)
  // ============================================================================
  if (showStartScreen) {
    return (
      <div
        className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-slate-950 text-white shadow-2xl p-5 sm:p-8 space-y-6"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-black text-white cursor-pointer inline-flex items-center gap-2 transition-all"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
            <span>{isRtl ? 'رجوع لبوابة الألعاب' : language === 'de' ? 'Zurück zu den Spielen' : 'Back to Games'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="px-3.5 py-2 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-black cursor-pointer inline-flex items-center gap-1.5 transition-all"
            >
              <HelpCircle className="w-4 h-4" />
              <span>{isRtl ? 'كيف تلعب؟ (شرح القواعد)' : language === 'de' ? 'Spielregeln' : 'How to Play'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white cursor-pointer"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Hero Banner with Custom Animated 9x9 Ultimate XO Illustration */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 border-2 border-amber-400/40 p-6 sm:p-8 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-7 space-y-3 text-start">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black">
                <Crown className="w-4 h-4" />
                <span>{displayTitle}</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                Ultimate XO{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-400 to-sky-400">
                  – Das ultimative Tic-Tac-Toe
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 font-bold leading-relaxed max-w-xl">
                {isRtl
                  ? '٩ لوحات صغيرة (٨١ خلية) في معركة ذكاء وتخطيط ممتعة! كل حركة تلعبها تحدد اللوحة الصغيرة التي سيلعب فيها منافسك في الدور القادم!'
                  : language === 'de'
                  ? '9 kleine Spielfelder (81 Zellen) in einem spannenden Strategiespiel! Dein Zug bestimmt, in welchem kleinen Feld dein Gegner als Nächstes spielen muss!'
                  : '9 mini-boards (81 cells) in an exciting strategic duel! Every move you make determines which mini-board your opponent must play in next!'}
              </p>
            </div>

            {/* Animated 3D Nested 9x9 Graphic Preview */}
            <div className="md:col-span-5 flex justify-center">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-48 h-48 sm:w-52 sm:h-52 rounded-3xl bg-slate-950/90 border-2 border-amber-400 p-3 shadow-2xl shadow-amber-500/20 grid grid-cols-3 gap-2"
              >
                {Array.from({ length: 9 }).map((_, idx) => {
                  const isHighlighted = idx === 4;
                  const wonX = idx === 0 || idx === 8;
                  const wonO = idx === 2 || idx === 6;
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl p-1 flex items-center justify-center border transition-all ${
                        isHighlighted
                          ? 'bg-amber-400/20 border-amber-400 ring-2 ring-amber-300/60 animate-pulse'
                          : wonX
                          ? 'bg-rose-500/25 border-rose-400/60'
                          : wonO
                          ? 'bg-sky-500/25 border-sky-400/60'
                          : 'bg-white/5 border-white/15'
                      }`}
                    >
                      {wonX ? (
                        <AnimatedMarkX size="sm" />
                      ) : wonO ? (
                        <AnimatedMarkO size="sm" />
                      ) : (
                        <div className="grid grid-cols-3 gap-0.5 w-full h-full">
                          {Array.from({ length: 9 }).map((__, cIdx) => (
                            <div
                              key={cIdx}
                              className={`rounded-2xs ${
                                isHighlighted && cIdx === 4
                                  ? 'bg-amber-400'
                                  : 'bg-white/15'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Game Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 1. Opponent Mode (2 Players vs Smart AI) */}
          <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-4">
            <label className="text-xs font-black text-amber-300 flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{isRtl ? '١. اختر نظام اللعب:' : language === 'de' ? '1. Spielmodus wählen:' : '1. Choose Game Mode:'}</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOpponentMode('pvp')}
                className={`p-4 rounded-2xl border-2 text-start space-y-1 transition-all cursor-pointer ${
                  opponentMode === 'pvp'
                    ? 'border-amber-400 bg-amber-500/20 shadow-lg'
                    : 'border-white/10 bg-slate-900/60 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Users className="w-5 h-5 text-amber-400" />
                  {opponentMode === 'pvp' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                </div>
                <div className="font-black text-xs sm:text-sm text-white pt-1">
                  {isRtl ? 'لاعبان على نفس الجهاز' : language === 'de' ? '2 Spieler (Lokal)' : '2 Players (Same Device)'}
                </div>
                <p className="text-[11px] text-slate-400">
                  {isRtl ? 'تحدي مباشر بين صديقين أو فريقين' : 'Play head-to-head with a friend'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setOpponentMode('ai')}
                className={`p-4 rounded-2xl border-2 text-start space-y-1 transition-all cursor-pointer ${
                  opponentMode === 'ai'
                    ? 'border-sky-400 bg-sky-500/20 shadow-lg'
                    : 'border-white/10 bg-slate-900/60 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Bot className="w-5 h-5 text-sky-400" />
                  {opponentMode === 'ai' && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                </div>
                <div className="font-black text-xs sm:text-sm text-white pt-1">
                  {isRtl ? 'ضد الذكاء الاصطناعي 🤖' : language === 'de' ? 'Gegen Computer-KI 🤖' : 'Play vs Smart AI 🤖'}
                </div>
                <p className="text-[11px] text-slate-400">
                  {isRtl ? '٣ مستويات ذكاء (سهل، متوسط، صعب)' : '3 difficulty levels (Easy, Medium, Hard)'}
                </p>
              </button>
            </div>

            {/* AI Difficulty Level Selector */}
            {opponentMode === 'ai' && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-xs font-black text-sky-300 block">
                  {isRtl ? 'مستوى ذكاء الكمبيوتر:' : language === 'de' ? 'KI-Schwierigkeitsgrad:' : 'AI Difficulty Level:'}
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        id: 'easy',
                        label: isRtl ? 'سهل 🌱' : 'Easy 🌱',
                        desc: isRtl ? 'حركات عشوائية ممتعة' : 'Random legal moves',
                        icon: Shield
                      },
                      {
                        id: 'medium',
                        label: isRtl ? 'متوسط ⚡' : 'Medium ⚡',
                        desc: isRtl ? 'يحاول الفوز والصد' : 'Wins & blocks boards',
                        icon: Zap
                      },
                      {
                        id: 'hard',
                        label: isRtl ? 'صعب 🧠' : 'Hard 🧠',
                        desc: isRtl ? 'خوارزمية Minimax ذكية' : 'Full Minimax strategy',
                        icon: Brain
                      }
                    ] as const
                  ).map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setAiDifficulty(lvl.id)}
                      className={`p-3 rounded-2xl border text-center space-y-1 transition-all cursor-pointer ${
                        aiDifficulty === lvl.id
                          ? 'border-sky-400 bg-sky-500/25 text-white font-black shadow-md'
                          : 'border-white/10 bg-slate-900/50 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-black">{lvl.label}</div>
                      <div className="text-[10px] opacity-80 leading-tight">{lvl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Starting Player & Player Names */}
          <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-4">
            <label className="text-xs font-black text-amber-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>
                {isRtl ? '٢. من يبدأ اللعب أولاً؟' : language === 'de' ? '2. Wer beginnt das Spiel?' : '2. Who Starts First?'}
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setStarterChoice('X')}
                className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                  starterChoice === 'X'
                    ? 'border-rose-400 bg-rose-500/20 text-white font-black'
                    : 'border-white/10 bg-slate-900/60 text-slate-300'
                }`}
              >
                <span className="text-lg block">❌</span>
                <span className="text-xs font-black">{isRtl ? 'اللاعب X' : 'Player X'}</span>
              </button>

              <button
                type="button"
                onClick={() => setStarterChoice('O')}
                className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                  starterChoice === 'O'
                    ? 'border-sky-400 bg-sky-500/20 text-white font-black'
                    : 'border-white/10 bg-slate-900/60 text-slate-300'
                }`}
              >
                <span className="text-lg block">⭕</span>
                <span className="text-xs font-black">
                  {opponentMode === 'ai' ? (isRtl ? 'الكمبيوتر O' : 'AI (O)') : isRtl ? 'اللاعب O' : 'Player O'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStarterChoice('random')}
                className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                  starterChoice === 'random'
                    ? 'border-amber-400 bg-amber-500/20 text-white font-black'
                    : 'border-white/10 bg-slate-900/60 text-slate-300'
                }`}
              >
                <Shuffle className="w-5 h-5 mx-auto text-amber-400 mb-0.5" />
                <span className="text-xs font-black">{isRtl ? 'عشوائي 🎲' : language === 'de' ? 'Zufällig 🎲' : 'Random 🎲'}</span>
              </button>
            </div>

            {/* Editable Player Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <div className="flex items-center gap-2 bg-slate-900/80 border border-rose-500/30 rounded-2xl px-3 py-2">
                <span className="text-sm">❌</span>
                <input
                  type="text"
                  value={playerXName}
                  onChange={(e) => setPlayerXName(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                  placeholder="Player X"
                />
              </div>

              {opponentMode === 'pvp' && (
                <div className="flex items-center gap-2 bg-slate-900/80 border border-sky-500/30 rounded-2xl px-3 py-2">
                  <span className="text-sm">⭕</span>
                  <input
                    type="text"
                    value={playerOName}
                    onChange={(e) => setPlayerOName(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    placeholder="Player O"
                  />
                </div>
              )}
            </div>

            {/* Optional Vocabulary Question Gate Toggle */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-black text-white block">
                    {isRtl
                      ? 'سؤال مفردات ألمانية عند كل حركة (اختياري)'
                      : language === 'de'
                      ? 'Vokabelfrage vor jedem Zug (Optional)'
                      : 'German Word Quiz before each move (Optional)'}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {isRtl
                      ? 'عند الإغلاق: لعب استراتيجي مباشر وسريع مع نطق كلمة عند الفوز بكل لوحة'
                      : 'When off: Fast strategic Ultimate XO with word bonus on each won mini-board'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setVocabGateEnabled((prev) => !prev)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                  vocabGateEnabled
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {vocabGateEnabled ? (isRtl ? 'مُفعّل ✅' : 'ON ✅') : isRtl ? 'لعب مباشر ⚡' : 'Direct Play ⚡'}
              </button>
            </div>
          </div>
        </div>

        {/* Launch Match Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => startNewMatch(false)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 cursor-pointer inline-flex items-center justify-center gap-2.5"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          <span>
            {isRtl
              ? 'ابدأ معركة Ultimate XO الآن! 🚀'
              : language === 'de'
              ? 'Ultimate XO jetzt starten! 🚀'
              : 'Start Ultimate XO Match Now! 🚀'}
          </span>
        </motion.button>

        {/* Rules Modal if opened from Start Screen */}
        <AnimatePresence>
          {showRulesModal && (
            <UltimateRulesModal
              isRtl={isRtl}
              language={language}
              onClose={() => setShowRulesModal(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ============================================================================
  // 2. ACTIVE ULTIMATE XO 9x9 GAMEPLAY SCREEN
  // ============================================================================
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-slate-950 text-white shadow-2xl p-3.5 sm:p-6 space-y-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <EffectsOverlay />

      {/* Top Navigation & Action Controls Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-white/15">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black cursor-pointer inline-flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
            <span>{isRtl ? 'خروج' : 'Exit'}</span>
          </button>

          <button
            type="button"
            onClick={() => startNewMatch(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 text-xs font-black cursor-pointer inline-flex items-center gap-1.5 transition-all"
          >
            <span>{isRtl ? 'لعبة جديدة (الإعدادات)' : language === 'de' ? 'Neues Spiel' : 'New Game'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-xs sm:text-sm font-black text-white">
            Ultimate XO <span className="text-amber-400 hidden sm:inline">• 9×9</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-amber-300 text-xs font-black cursor-pointer inline-flex items-center gap-1"
            title={isRtl ? 'شرح القواعد' : 'Rules'}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isRtl ? 'القواعد' : language === 'de' ? 'Regeln' : 'Rules'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          <button
            type="button"
            onClick={() => startNewMatch(false)}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-black cursor-pointer inline-flex items-center gap-1 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRtl ? 'إعادة (Restart)' : 'Restart'}</span>
          </button>
        </div>
      </div>

      {/* Player Scorecards & Active Turn Routing Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
        {/* Player X Card */}
        <div
          className={`md:col-span-4 p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all ${
            currentPlayer === 'X' && !gameWinner
              ? 'bg-gradient-to-r from-rose-600/35 to-rose-900/40 border-rose-400 ring-2 ring-rose-400/40 shadow-lg shadow-rose-500/20'
              : 'bg-white/5 border-white/10 opacity-80'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/25 border border-rose-400/50 flex items-center justify-center shrink-0">
              <AnimatedMarkX size="sm" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-black text-white block truncate">{playerXName}</span>
              <span className="text-[11px] font-bold text-rose-300 block tabular-nums">
                {isRtl ? `اللوحات المحتلة: ${subBoardCounts.xWon} / 9` : `Mini-Boards Won: ${subBoardCounts.xWon} / 9`}
              </span>
            </div>
          </div>
          <div className="text-center px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 shrink-0">
            <span className="text-[9px] text-slate-400 font-bold block">{isRtl ? 'انتصارات' : 'Wins'}</span>
            <span className="text-sm font-mono font-black text-rose-300 tabular-nums">{matchScores.X}</span>
          </div>
        </div>

        {/* Center Active Turn & Target Sub-Board Compass */}
        <div className="md:col-span-4 p-3.5 rounded-2xl bg-gradient-to-b from-indigo-950/90 to-slate-900/90 border-2 border-amber-400/40 flex flex-col items-center justify-center text-center gap-1 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-black text-amber-300">
            <Compass className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>
              {isRtl ? 'الدور الحالي:' : language === 'de' ? 'Aktueller Zug:' : 'Current Turn:'}{' '}
              <span className={currentPlayer === 'X' ? 'text-rose-400' : 'text-sky-400'}>
                {activePlayerName}
              </span>
            </span>
          </div>

          <div className="text-xs font-extrabold text-white">
            {activeBoardIndex !== null ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black tabular-nums">
                <span>🎯</span>
                <span>
                  {isRtl
                    ? `العب في اللوحة الصغيرة رقم #${activeBoardIndex + 1}`
                    : language === 'de'
                    ? `Spiele in Feld #${activeBoardIndex + 1}`
                    : `Play in Mini-Board #${activeBoardIndex + 1}`}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black">
                <span>🌟</span>
                <span>
                  {isRtl
                    ? 'حركة حرة! اختر أي لوحة صغيرة مفتوحة'
                    : language === 'de'
                    ? 'Freie Wahl! Jedes offene Feld erlaubt'
                    : 'Free Move! Play in ANY open mini-board'}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Player O / AI Card */}
        <div
          className={`md:col-span-4 p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all ${
            currentPlayer === 'O' && !gameWinner
              ? 'bg-gradient-to-r from-sky-600/35 to-sky-900/40 border-sky-400 ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/20'
              : 'bg-white/5 border-white/10 opacity-80'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/25 border border-sky-400/50 flex items-center justify-center shrink-0">
              <AnimatedMarkO size="sm" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-black text-white block truncate">
                {opponentMode === 'ai'
                  ? isRtl
                    ? `الذكاء الاصطناعي (${aiDifficulty === 'easy' ? 'سهل' : aiDifficulty === 'medium' ? 'متوسط' : 'صعب'}) 🤖`
                    : `Computer AI (${aiDifficulty.toUpperCase()}) 🤖`
                  : playerOName}
              </span>
              <span className="text-[11px] font-bold text-sky-300 block tabular-nums">
                {isRtl ? `اللوحات المحتلة: ${subBoardCounts.oWon} / 9` : `Mini-Boards Won: ${subBoardCounts.oWon} / 9`}
              </span>
            </div>
          </div>
          <div className="text-center px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 shrink-0">
            <span className="text-[9px] text-slate-400 font-bold block">{isRtl ? 'انتصارات' : 'Wins'}</span>
            <span className="text-sm font-mono font-black text-sky-300 tabular-nums">{matchScores.O}</span>
          </div>
        </div>
      </div>

      {/* Celebratory German Word Banner when a Sub-Board is Won */}
      <AnimatePresence>
        {conqueredVocabBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-indigo-500/20 border border-amber-400/40 text-xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{conqueredVocabBanner.item.emoji || '🏆'}</span>
              <div>
                <span className="font-black text-amber-300">
                  {isRtl
                    ? `تم فتح كلمة اللوحة #${conqueredVocabBanner.boardIdx + 1}: `
                    : `Board #${conqueredVocabBanner.boardIdx + 1} Word Unlocked: `}
                </span>
                <span className="font-black text-white font-mono" dir="ltr">
                  {conqueredVocabBanner.item.german}
                </span>
                <span className="text-slate-300 font-bold mx-1.5">•</span>
                <span className="text-emerald-300 font-bold">
                  {getItemTranslation(conqueredVocabBanner.item, language)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => speakGermanText(conqueredVocabBanner.item.german, 0.88)}
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 font-black inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isRtl ? 'نطق' : 'Speak'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================
          THE 9x9 ULTIMATE XO BOARD (9 Sub-Boards × 9 Cells = 81 Cells)
      ======================================================================== */}
      <div className="flex justify-center py-1">
        <div
          className="w-full max-w-[560px] aspect-square p-2.5 sm:p-4 rounded-3xl bg-gradient-to-b from-slate-900 via-indigo-950/90 to-slate-950 border-4 border-amber-400/40 shadow-[0_12px_40px_rgba(0,0,0,0.75)] grid grid-cols-3 gap-2.5 sm:gap-3.5"
          dir="ltr"
        >
          {subBoards.map((subBoard, boardIdx) => {
            const subState = macroBoard[boardIdx];
            const isMacroWinBoard = macroWinningLine?.includes(boardIdx) ?? false;
            const isPlayableBoard =
              gameWinner === null &&
              subState === null &&
              (activeBoardIndex === null || activeBoardIndex === boardIdx);

            return (
              <motion.div
                key={boardIdx}
                layout
                className={`relative rounded-2xl p-1.5 sm:p-2 flex flex-col justify-between transition-all duration-300 ${
                  isMacroWinBoard
                    ? 'bg-amber-400/30 border-2 border-amber-300 ring-4 ring-amber-400 shadow-2xl scale-[1.02] z-20'
                    : subState === 'X'
                    ? 'bg-gradient-to-br from-rose-500/30 via-rose-600/20 to-rose-950/50 border-2 border-rose-400/70 shadow-lg'
                    : subState === 'O'
                    ? 'bg-gradient-to-br from-sky-500/30 via-sky-600/20 to-sky-950/50 border-2 border-sky-400/70 shadow-lg'
                    : subState === 'draw'
                    ? 'bg-slate-800/60 border border-slate-600/50 opacity-70'
                    : isPlayableBoard
                    ? 'bg-slate-900/95 border-2 border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.28)]'
                    : 'bg-slate-900/55 border border-white/10 opacity-50'
                }`}
              >
                {/* Sub-Board Number Header (#1..#9) */}
                <div className="flex items-center justify-between px-1 mb-1">
                  <span
                    className={`text-[10px] font-mono font-black tabular-nums ${
                      isPlayableBoard ? 'text-amber-300' : 'text-slate-400'
                    }`}
                  >
                    #{boardIdx + 1}
                  </span>
                  {isPlayableBoard && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                </div>

                {/* 3x3 Mini Grid of 9 Cells */}
                <div className="relative grid grid-cols-3 gap-1 sm:gap-1.5 flex-1">
                  {subBoard.map((cellVal, cellIdx) => {
                    const isLastMoveCell =
                      lastMove?.boardIdx === boardIdx && lastMove?.cellIdx === cellIdx;
                    const isSubWinCell = subBoardWinLines[boardIdx]?.includes(cellIdx) ?? false;
                    const isCellAvailable = isPlayableBoard && cellVal === null;

                    return (
                      <motion.button
                        key={cellIdx}
                        type="button"
                        disabled={!isCellAvailable || (opponentMode === 'ai' && currentPlayer === 'O')}
                        whileHover={isCellAvailable ? { scale: 1.08 } : undefined}
                        whileTap={isCellAvailable ? { scale: 0.9 } : undefined}
                        onClick={() => handleCellClick(boardIdx, cellIdx)}
                        className={`relative rounded-lg sm:rounded-xl flex items-center justify-center aspect-square transition-all select-none ${
                          isLastMoveCell
                            ? 'bg-amber-400/30 border border-amber-300 shadow-inner'
                            : isSubWinCell
                            ? 'bg-white/20 border border-white/40'
                            : cellVal !== null
                            ? 'bg-slate-800/90 border border-white/10 cursor-default'
                            : isCellAvailable
                            ? 'bg-slate-800/80 hover:bg-amber-400/20 border border-white/15 hover:border-amber-300 cursor-pointer'
                            : 'bg-slate-900/60 border border-white/5 cursor-not-allowed'
                        }`}
                        title={
                          isCellAvailable
                            ? isRtl
                              ? `الخلية ${cellIdx + 1} (ترسل المنافس إلى اللوحة #${cellIdx + 1})`
                              : `Cell ${cellIdx + 1} (Sends opponent to Board #${cellIdx + 1})`
                            : undefined
                        }
                      >
                        {cellVal === 'X' ? (
                          <AnimatedMarkX size="sm" />
                        ) : cellVal === 'O' ? (
                          <AnimatedMarkO size="sm" />
                        ) : (
                          <span
                            className={`text-[9px] font-mono font-bold tabular-nums ${
                              isCellAvailable
                                ? 'text-slate-400/75 group-hover:text-amber-300'
                                : 'text-slate-600/40'
                            }`}
                          >
                            {cellIdx + 1}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}

                  {/* Conquered Sub-Board Big Emblem Overlay */}
                  <AnimatePresence>
                    {subState !== null && (
                      <motion.div
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`absolute inset-0 rounded-xl backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none ${
                          subState === 'X'
                            ? 'bg-rose-950/65'
                            : subState === 'O'
                            ? 'bg-sky-950/65'
                            : 'bg-slate-900/75'
                        }`}
                      >
                        {subState === 'X' ? (
                          <AnimatedMarkX size="lg" />
                        ) : subState === 'O' ? (
                          <AnimatedMarkO size="lg" />
                        ) : (
                          <span className="text-lg font-black text-slate-300">🤝</span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================
          CELL CHALLENGE VOCABULARY QUESTION MODAL (On Every Cell Selection)
      ======================================================================== */}
      <AnimatePresence>
        {vocabQuestion && pendingMove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          >
            <motion.div
              initial={{ scale: 0.9, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 16 }}
              className="bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 text-center shadow-2xl text-white"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Header with Sub-board & Cell routing info */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="text-start">
                  <span className="text-xs font-black text-amber-300 block">
                    {isRtl
                      ? `تحدي اللوحة #${pendingMove.boardIdx + 1} • المربع #${pendingMove.cellIdx + 1}`
                      : `Board #${pendingMove.boardIdx + 1} • Cell #${pendingMove.cellIdx + 1}`}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 block">
                    {isRtl
                      ? `🎯 هذه الحركة سترسل المنافس إلى اللوحة #${pendingMove.cellIdx + 1}`
                      : `🎯 Sends opponent to Mini-Board #${pendingMove.cellIdx + 1}`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-lg">{currentPlayer === 'X' ? '❌' : '⭕'}</span>
                  {!questionFeedback && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingMove(null);
                        setVocabQuestion(null);
                        setQuestionFeedback(null);
                      }}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Target Vocabulary Prompt */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-indigo-950/80 to-slate-950 border border-amber-400/30 space-y-1.5">
                {vocabQuestion.targetItem.emoji && (
                  <span className="text-5xl block select-none">{vocabQuestion.targetItem.emoji}</span>
                )}
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {getItemTranslation(vocabQuestion.targetItem, language) || vocabQuestion.targetItem.arabic || vocabQuestion.targetItem.english}
                </h3>
                <span className="text-[11px] font-bold text-amber-300/90 block">
                  {isRtl
                    ? 'اختر الكلمة الألمانية الصحيحة لوضع علامتك:'
                    : language === 'de'
                    ? 'Wähle das richtige deutsche Wort:'
                    : 'Choose the correct German word to place your mark:'}
                </span>
              </div>

              {/* Multiple-Choice Options with Audio Speaker Buttons */}
              <div className="space-y-2.5">
                {vocabQuestion.choices.map((ch) => {
                  const isCorrectChoice = ch.id === vocabQuestion.targetItem.id;
                  const isSelected = questionFeedback?.selectedId === ch.id;

                  let btnStyle =
                    'bg-white/5 hover:bg-amber-400/20 border-white/15 hover:border-amber-400 text-white';
                  if (questionFeedback) {
                    if (isCorrectChoice) {
                      btnStyle = 'bg-emerald-500/30 border-emerald-400 text-emerald-100 shadow-lg';
                    } else if (isSelected && !questionFeedback.correct) {
                      btnStyle = 'bg-rose-500/30 border-rose-400 text-rose-100';
                    } else {
                      btnStyle = 'bg-white/5 border-white/10 text-slate-400 opacity-60';
                    }
                  }

                  return (
                    <button
                      key={ch.id}
                      type="button"
                      disabled={questionFeedback !== null}
                      onClick={() => handleVocabAnswer(ch)}
                      className={`w-full py-3.5 px-4 rounded-2xl border-2 font-black text-sm font-mono transition-all cursor-pointer flex items-center justify-between gap-2 ${btnStyle}`}
                      dir="ltr"
                    >
                      <span className="truncate">{ch.german}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          speakGermanText(ch.german, 0.88);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            speakGermanText(ch.german, 0.88);
                          }
                        }}
                        className="p-1.5 rounded-xl bg-black/30 hover:bg-amber-400 hover:text-slate-950 text-amber-300 transition-colors shrink-0"
                        title={isRtl ? 'استمع للنطق' : 'Listen'}
                      >
                        <Volume2 className="w-4 h-4" />
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback Message Banner */}
              {questionFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-2xl border text-xs font-black ${
                    questionFeedback.correct
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                  }`}
                >
                  {questionFeedback.msg}
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================
          GRAND VICTORY / DRAW MODAL
      ======================================================================== */}
      <AnimatePresence>
        {gameWinner !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.85, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-2 border-amber-400 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl text-white"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-amber-400 mx-auto shadow-xl">
                <SharedVictoryTrophyArt className="w-full h-full object-cover" />
              </div>

              {gameWinner === 'draw' ? (
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-amber-400 block">
                    {isRtl ? 'تعادل ملحمي!' : language === 'de' ? 'Unentschieden!' : 'Epic Draw!'}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    🤝 {isRtl ? 'تساوت القوى في اللوحة الرئيسية!' : 'Both Strategists Tied!'}
                  </h2>
                  <p className="text-xs font-bold text-slate-300">
                    {isRtl
                      ? `اللوحات الصغيرة: X (${subBoardCounts.xWon}) - O (${subBoardCounts.oWon})`
                      : `Mini-Boards Won: X (${subBoardCounts.xWon}) - O (${subBoardCounts.oWon})`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-amber-400 block">
                    {isRtl ? 'بطل Ultimate XO!' : language === 'de' ? 'Ultimate XO Champion!' : 'Ultimate XO Champion!'}
                  </span>
                  <div className="flex justify-center py-1">
                    {gameWinner === 'X' ? <AnimatedMarkX size="lg" /> : <AnimatedMarkO size="lg" />}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    🎉{' '}
                    {gameWinner === 'X'
                      ? playerXName
                      : opponentMode === 'ai'
                      ? isRtl
                        ? 'الذكاء الاصطناعي 🤖'
                        : 'Smart AI 🤖'
                      : playerOName}
                  </h2>
                  <p className="text-xs font-bold text-amber-200">
                    {isRtl
                      ? 'حقق ٣ انتصارات متتالية في اللوحات الصغيرة على اللوحة الرئيسية!'
                      : language === 'de'
                      ? '3 kleine Spielfelder in einer Reihe auf dem Hauptbrett gewonnen!'
                      : 'Conquered 3 mini-boards in a row on the main board!'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => startNewMatch(false)}
                  className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isRtl ? 'العب مرة أخرى' : language === 'de' ? 'Noch einmal' : 'Play Again'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => startNewMatch(true)}
                  className="py-3.5 px-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs sm:text-sm cursor-pointer"
                >
                  {isRtl ? 'شاشة البداية' : language === 'de' ? 'Startmenü' : 'New Game'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRulesModal && (
          <UltimateRulesModal
            isRtl={isRtl}
            language={language}
            onClose={() => setShowRulesModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Child-Friendly Visual Rules Modal explaining Ultimate XO
 */
const UltimateRulesModal: React.FC<{
  isRtl: boolean;
  language: string;
  onClose: () => void;
}> = ({ isRtl, language, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 text-white shadow-2xl my-auto"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-base sm:text-lg font-black">
              {isRtl
                ? 'كيف تلعب Ultimate XO؟'
                : language === 'de'
                ? 'Spielregeln: Ultimate XO'
                : 'How to Play Ultimate XO'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs sm:text-sm font-bold text-slate-200 leading-relaxed">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-amber-300 font-black block">
              {isRtl ? '١. لوحة كبيرة بداخلها ٩ لوحات صغيرة (٨١ خلية)' : '1. 9 Mini-Boards Inside 1 Big Board (81 Cells)'}
            </span>
            <p className="text-xs text-slate-300">
              {isRtl
                ? 'الفوز في أي لوحة صغيرة بـ ٣ علامات متتالية يمنحك السيطرة الكاملة على تلك اللوحة الصغيرة!'
                : 'Win 3-in-a-row inside any mini-board to lock and claim that mini-board for yourself!'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 space-y-2">
            <span className="text-amber-300 font-black block">
              {isRtl ? '٢. القاعدة الذهبية (توجيه المنافس 🎯)' : '2. The Golden Routing Rule 🎯'}
            </span>
            <p className="text-xs text-slate-200">
              {isRtl
                ? 'المكان الذي تضع فيه علامتك داخل اللوحة الصغيرة يحدد اللوحة الصغيرة التي يجب أن يلعب فيها خصمك! فمثلاً إذا لعبت في الخلية رقم 5، يجب على خصمك اللعب في اللوحة الصغيرة رقم #5!'
                : 'The cell number (1–9) you pick inside a mini-board determines which mini-board (#1–#9) your opponent must play in next!'}
            </p>
            <div className="grid grid-cols-3 gap-1.5 max-w-[130px] mx-auto pt-1 font-mono text-center text-xs" dir="ltr">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <div
                  key={n}
                  className={`py-1 rounded-lg border font-black ${
                    n === 5
                      ? 'bg-amber-400 text-slate-950 border-white'
                      : 'bg-slate-950 text-slate-300 border-white/15'
                  }`}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 space-y-1">
            <span className="text-emerald-300 font-black block">
              {isRtl ? '٣. متى تحصل على حركة حرة؟ 🌟' : '3. Free Move Rule 🌟'}
            </span>
            <p className="text-xs text-slate-200">
              {isRtl
                ? 'إذا أرسلك خصمك إلى لوحة صغيرة فاز بها أحدكما بالفعل أو امتلأت، تصبح حراً في اختيار أي لوحة صغيرة مفتوحة!'
                : 'If the target mini-board is already won or full, you get a Free Move in ANY open mini-board!'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 space-y-1">
            <span className="text-rose-300 font-black block">
              {isRtl ? '٤. كيف تفوز بالمباراة الكبرى؟ 🏆' : '4. Winning the Ultimate Match 🏆'}
            </span>
            <p className="text-xs text-slate-200">
              {isRtl
                ? 'اربح ٣ لوحات صغيرة على استقامة واحدة (أفقياً أو رأسياً أو قطرياً) لتفوز باللعبة!'
                : 'Win 3 mini-boards in a row (horizontally, vertically, or diagonally) on the main board to win!'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-amber-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
        >
          {isRtl ? 'فهمت! هيا نلعب 🚀' : language === 'de' ? 'Verstanden! Los geht’s 🚀' : 'Got It! Let’s Play 🚀'}
        </button>
      </motion.div>
    </motion.div>
  );
};
