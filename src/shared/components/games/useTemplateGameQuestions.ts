import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import {
  LernstudioGameCompletionPayload,
  LernstudioGameMode,
  LernstudioSet
} from '../../../types/lernstudio';
import {
  getDistractorChoices,
  getSetPlayableItems,
  getSetVocabularyItems,
  createSeededRandom,
  seededShuffle
} from '../../../utils/lernstudioVocabularyAdapter';
import {
  buildDynamicQuestionPool,
  GameQuestionModeFilter
} from '../../../utils/lernstudioQuestionAdapter';
import {
  playGermanVoiceFeedback,
  playLernstudioSound
} from '../../../utils/lernstudioAudioUtils';
import { speakGermanText, stopGermanSpeech } from '../../../utils/audioSpeechUtils';
import { GameSetupConfig } from '../LernstudioGameSetupScreen';

export interface TemplateChoice {
  id: string;
  label: string;
  emoji?: string;
  isCorrect: boolean;
}

export interface TemplateQuestion {
  id: string;
  prompt: string;
  subPrompt?: string;
  speakText: string;
  emoji: string;
  article?: string;
  choices: TemplateChoice[];
}

export function useTemplateGameSession(
  gameMode: LernstudioGameMode,
  set: LernstudioSet,
  language: string,
  gameConfig?: GameSetupConfig,
  onGameComplete?: (result: LernstudioGameCompletionPayload) => void
) {
  const difficulty = gameConfig?.difficulty || set.difficulty || 'medium';
  const enableAudio = gameConfig?.enableAudio ?? true;
  const enableSoundFx = gameConfig?.enableSoundFx ?? true;
  const baseTimerSeconds = gameConfig?.timerSeconds || 0;
  const effectiveTimerSeconds = useMemo(() => {
    if (!baseTimerSeconds || baseTimerSeconds <= 0) return 0;
    if (difficulty === 'hard') return Math.max(5, Math.round(baseTimerSeconds * 0.75));
    if (difficulty === 'easy') return Math.round(baseTimerSeconds * 1.25);
    return baseTimerSeconds;
  }, [baseTimerSeconds, difficulty]);

  const maxLives = difficulty === 'easy' ? 4 : difficulty === 'hard' ? 2 : 3;

  const [sessionSeed, setSessionSeed] = useState<number>(() => Date.now());

  const questions: TemplateQuestion[] = useMemo(() => {
    const questionType = gameConfig?.questionType || 'de_to_ar';
    const fullPlayable = getSetPlayableItems(set);
    const requestedCount = gameConfig?.questionCount;
    const targetCount =
      requestedCount && requestedCount > 0
        ? Math.min(requestedCount, Math.max(1, fullPlayable.length || requestedCount))
        : fullPlayable.length || 10;

    const useDynamicPool =
      questionType === 'article' ||
      questionType === 'ar_to_de' ||
      questionType === 'verb_conjugation' ||
      questionType === 'verb_sentence' ||
      questionType === 'grammar' ||
      questionType === 'mixed';

    if (useDynamicPool) {
      const pool = buildDynamicQuestionPool(set, language, {
        questionModeFilter: questionType as GameQuestionModeFilter,
        seed: `${sessionSeed}-${questionType}`
      }).filter((q) => Array.isArray(q.options) && q.options.length >= 2);

      if (pool.length > 0) {
        const rng = createSeededRandom(`${sessionSeed}-select`);
        const picked = seededShuffle(pool, rng).slice(0, targetCount);
        return picked.map((q, idx) => {
          const seen = new Set<string>();
          const uniqueOpts = (q.options || []).filter((opt) => {
            const key = String(opt || '').trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (
            q.correctAnswer &&
            !seen.has(q.correctAnswer.trim().toLowerCase())
          ) {
            uniqueOpts.unshift(q.correctAnswer);
          }
          const finalOpts = seededShuffle(
            uniqueOpts.slice(0, 4),
            createSeededRandom(`${sessionSeed}-opts-${idx}`)
          );

          return {
            id: q.id || `tpl_dyn_${idx}`,
            prompt: q.prompt,
            subPrompt: q.subPrompt,
            speakText: q.itemRef?.german || q.verbRef?.infinitive || q.prompt,
            emoji: q.emoji || q.itemRef?.emoji || '🎯',
            article: q.itemRef?.article,
            choices: finalOpts.map((opt, optIdx) => ({
              id: `${q.id || idx}_opt_${optIdx}`,
              label: opt,
              isCorrect:
                opt.trim().toLowerCase() ===
                String(q.correctAnswer || '').trim().toLowerCase()
            }))
          };
        });
      }
    }

    // Default vocab mode ('de_to_ar' / 'audio' / fallback)
    const deck = getSetVocabularyItems(set, language, targetCount, sessionSeed);
    const distractorPool = getSetVocabularyItems(set, language, undefined, sessionSeed);

    return deck.map((item, idx) => {
      const choiceItems = getDistractorChoices(
        item,
        distractorPool.length >= deck.length ? distractorPool : deck,
        4,
        createSeededRandom(`${sessionSeed}-q${idx}`)
      );
      return {
        id: item.id,
        prompt: item.german,
        subPrompt: questionType === 'audio' ? (language === 'ar' ? 'استمع ثم اختر الترجمة الصحيحة' : 'Listen & choose') : undefined,
        speakText: item.german,
        emoji: item.emoji,
        article: item.article,
        choices: choiceItems.map((c) => ({
          id: c.id,
          label: c.translation,
          emoji: c.emoji,
          isCorrect: c.id === item.id
        }))
      };
    });
  }, [set, language, gameConfig?.questionType, gameConfig?.questionCount, sessionSeed]);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const correctCountRef = useRef(0);
  const attemptsCountRef = useRef(0);

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
    return () => {
      clearAllTimeouts();
      stopGermanSpeech();
    };
  }, [clearAllTimeouts]);

  const safePlaySound = useCallback(
    (name: Parameters<typeof playLernstudioSound>[0]) => {
      if (enableSoundFx) playLernstudioSound(name);
    },
    [enableSoundFx]
  );

  const safePlayVoiceFeedback = useCallback(
    (kind: Parameters<typeof playGermanVoiceFeedback>[0]) => {
      if (enableAudio) playGermanVoiceFeedback(kind);
    },
    [enableAudio]
  );

  const safeSpeak = useCallback(
    (text: string) => {
      if (enableAudio && text) speakGermanText(text);
    },
    [enableAudio]
  );

  const recordAttempt = useCallback((isCorrect: boolean) => {
    attemptsCountRef.current += 1;
    if (isCorrect) correctCountRef.current += 1;
  }, []);

  const reportCompletion = useCallback(
    (params: {
      score: number;
      maxScore: number;
      passed: boolean;
      teamScores?: Record<string, number>;
    }) => {
      if (completedRef.current) return;
      completedRef.current = true;
      if (!onGameComplete) return;
      const attempts = Math.max(1, attemptsCountRef.current);
      const accuracy = Math.min(100, Math.round((correctCountRef.current / attempts) * 100));
      onGameComplete({
        setId: set.id,
        gameMode,
        score: params.score,
        maxScore: Math.max(1, params.maxScore),
        accuracy,
        passed: params.passed,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        ...(params.teamScores ? { teamScores: params.teamScores } : {}),
        difficulty
      });
    },
    [onGameComplete, gameMode, difficulty]
  );

  const resetSession = useCallback(() => {
    clearAllTimeouts();
    stopGermanSpeech();
    completedRef.current = false;
    startedAtRef.current = Date.now();
    correctCountRef.current = 0;
    attemptsCountRef.current = 0;
    setSessionSeed((s) => s + 1);
  }, [clearAllTimeouts]);

  return {
    difficulty,
    enableAudio,
    enableSoundFx,
    effectiveTimerSeconds,
    maxLives,
    questions,
    scheduleTimeout,
    clearAllTimeouts,
    safePlaySound,
    safePlayVoiceFeedback,
    safeSpeak,
    recordAttempt,
    reportCompletion,
    resetSession
  };
}
