import { storage } from '../services/storageService';
import { LernstudioGameResult } from '../types/lernstudio';

export const LERNSTUDIO_GAME_RESULTS_STORAGE_KEY = 'dl_lernstudio_game_results';
const MAX_STORED_GAME_RESULTS = 200;

export interface LernstudioSetGameStats {
  attempts: number;
  bestScore: number;
  lastScore: number;
  lastAccuracy?: number;
  lastPlayedAt: number;
  lastMode: string;
}

export async function loadLernstudioGameResults(): Promise<LernstudioGameResult[]> {
  try {
    const raw = await storage.getItem<LernstudioGameResult[]>(LERNSTUDIO_GAME_RESULTS_STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter((r) => r && typeof r.id === 'string' && typeof r.setId === 'string');
  } catch {
    return [];
  }
}

export async function recordLernstudioGameResult(
  result: Omit<LernstudioGameResult, 'id' | 'playedAt'> & { id?: string; playedAt?: number }
): Promise<LernstudioGameResult[]> {
  const existing = await loadLernstudioGameResults();
  const entry: LernstudioGameResult = {
    ...result,
    id: result.id || `ls_res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    playedAt: typeof result.playedAt === 'number' ? result.playedAt : Date.now(),
    score: Number.isFinite(result.score) ? result.score : 0
  };
  const next = [entry, ...existing].slice(0, MAX_STORED_GAME_RESULTS);
  await storage.setItem(LERNSTUDIO_GAME_RESULTS_STORAGE_KEY, next);
  return next;
}

export function buildSetGameStatsMap(
  results: LernstudioGameResult[]
): Record<string, LernstudioSetGameStats> {
  const map: Record<string, LernstudioSetGameStats> = {};
  for (const r of results) {
    if (!r || !r.setId) continue;
    const prev = map[r.setId];
    if (!prev) {
      map[r.setId] = {
        attempts: 1,
        bestScore: r.score,
        lastScore: r.score,
        lastAccuracy: r.accuracy,
        lastPlayedAt: r.playedAt,
        lastMode: r.gameMode
      };
    } else {
      prev.attempts += 1;
      if (r.score > prev.bestScore) prev.bestScore = r.score;
      if (r.playedAt >= prev.lastPlayedAt) {
        prev.lastScore = r.score;
        prev.lastAccuracy = r.accuracy;
        prev.lastPlayedAt = r.playedAt;
        prev.lastMode = r.gameMode;
      }
    }
  }
  return map;
}
