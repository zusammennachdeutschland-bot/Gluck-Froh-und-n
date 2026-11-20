import { LernstudioSet, LernstudioGameMode, TeamScore } from '../../../types/lernstudio';
import { buildDynamicQuestionPool, GameQuestion } from '../../lernstudioQuestionAdapter';

export interface GameSessionConfig {
  gameMode: LernstudioGameMode;
  mode: 'solo' | 'team';
  questionCount?: number;
  questionModeFilter?: any;
  timerSeconds?: number;
  soundEnabled?: boolean;
  teams?: TeamScore[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface GameSessionState {
  set: LernstudioSet;
  config: GameSessionConfig;
  questions: GameQuestion[];
  currentIndex: number;
  score: number;
  streak: number;
  teams: TeamScore[];
  currentTeamIndex: number;
  isGameOver: boolean;
  timeLeft: number;
  soundEnabled: boolean;
}

export function buildGameSession(set: LernstudioSet, config: GameSessionConfig): GameSessionState {
  const count = config.questionCount || 10;
  const rawPool = buildDynamicQuestionPool(set, 'ar', {
    questionModeFilter: config.questionModeFilter || 'mixed'
  });
  
  const shuffled = [...rawPool].sort(() => Math.random() - 0.5);
  const questions = shuffled.slice(0, Math.max(1, Math.min(shuffled.length, count)));

  const defaultTeams: TeamScore[] = config.teams && config.teams.length > 0 ? config.teams : [
    { id: 'team_red', name: 'الفريق الأحمر 🦁', color: 'from-rose-500 to-red-600', score: 0 },
    { id: 'team_blue', name: 'الفريق الأزرق 🦅', color: 'from-blue-500 to-cyan-600', score: 0 }
  ];

  return {
    set,
    config,
    questions,
    currentIndex: 0,
    score: 0,
    streak: 0,
    teams: defaultTeams,
    currentTeamIndex: 0,
    isGameOver: false,
    timeLeft: config.timerSeconds || 60,
    soundEnabled: config.soundEnabled ?? true
  };
}
