import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LernstudioSet,
  LernstudioItem,
  LernstudioExerciseType,
  LernstudioTheme,
  LernstudioGameCompletionPayload
} from '../../types/lernstudio';
import { CheckCircle2, XCircle, RotateCcw, ArrowRight, Award, Trophy, HelpCircle, ThumbsUp, Volume2 } from 'lucide-react';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../utils/lernstudioTranslations';
import { GameStageBanner, SharedVictoryTrophyArt } from './GameArtAssets';
import { useGameEffects } from './effects/GameEffectsOverlay';
import { GameSetupConfig } from './LernstudioGameSetupScreen';
import { hasGrammarContent, isGrammarSet } from '../grammarEngine';
import {
  buildDynamicQuestionPool,
  evaluateGameQuestionAnswer,
  extractMissingLetterChar,
  GameQuestion
} from '../lernstudioQuestionAdapter';
import {
  buildSeededSessionDeck,
  createSeededRandom,
  seededShuffle
} from '../lernstudioVocabularyAdapter';
import {
  ALL_VERBS,
  SUBJECT_PROMPTS,
  buildVerbConjugationExercise,
  buildVerbSentenceGapExercise,
  isItemVerb,
  resolveVerbFromLernstudioItem
} from '../verbEngine';

type GameRunnerMode = LernstudioExerciseType | 'verb_conjugation' | 'verb_sentence' | 'grammar';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language: string;
  gameConfig?: GameSetupConfig;
  onGameComplete?: (result: LernstudioGameCompletionPayload) => void;
  onBack: () => void;
}

export const LernstudioGameRunner: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  gameConfig,
  onGameComplete,
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const { triggerSparkles, triggerFloatingText, triggerConfetti } = useGameEffects();
  const [sessionNonce, setSessionNonce] = useState(0);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedReportedRef = useRef(false);
  const correctCountRef = useRef(0);
  const attemptCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    };
  }, []);

  const scheduleTimeout = (fn: () => void, ms: number) => {
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = setTimeout(fn, ms);
  };

  const soundFxEnabled = gameConfig?.enableSoundFx !== false;
  const playSfx = (sound: Parameters<typeof playLernstudioSound>[0]) => {
    if (soundFxEnabled) playLernstudioSound(sound);
  };
  const playVoice = (feedbackKey: Parameters<typeof playGermanVoiceFeedback>[0]) => {
    if (gameConfig?.enableAudio !== false) playGermanVoiceFeedback(feedbackKey);
  };

  const rawItems = useMemo(() => set.items || [], [set.items]);
  const sessionSeed = `${set.id}::runner::${sessionNonce}`;
  const items = useMemo(() => {
    const requested = gameConfig?.questionCount;
    if (rawItems.length === 0) return [];
    const targetCount = requested && requested > 0 ? requested : rawItems.length;
    return buildSeededSessionDeck(rawItems, targetCount, `${sessionSeed}::items`);
  }, [rawItems, gameConfig?.questionCount, sessionSeed]);

  const hasGrammar = useMemo(() => hasGrammarContent(set), [set]);
  const isPureGrammarSet = useMemo(() => isGrammarSet(set) && rawItems.length === 0, [set, rawItems.length]);

  const grammarQuestions: GameQuestion[] = useMemo(() => {
    if (!hasGrammar) return [];
    const pool = buildDynamicQuestionPool(set, language, {
      questionModeFilter: 'grammar',
      seed: `${sessionSeed}::grammar`
    }).filter((q) => q.type === 'grammar_exercise');
    const requested = gameConfig?.questionCount;
    if (requested && requested > 0 && pool.length > requested) {
      return pool.slice(0, requested);
    }
    return pool;
  }, [set, language, hasGrammar, gameConfig?.questionCount, sessionSeed]);

  const hasVerbsInSet = useMemo(
    () => set.setKind === 'verb_group' || rawItems.some((it) => isItemVerb(it)),
    [set.setKind, rawItems]
  );

  const [selectedGameType, setSelectedGameType] = useState<GameRunnerMode>(() => {
    if (gameConfig?.questionType === 'grammar') return 'grammar';
    if (gameConfig?.questionType === 'verb_conjugation') return 'verb_conjugation';
    if (gameConfig?.questionType === 'verb_sentence') return 'verb_sentence';
    if (hasGrammarContent(set) && (set.items?.length || 0) === 0) return 'grammar';
    return 'multiple_choice';
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Game specific states
  const [userAnswerText, setUserAnswerText] = useState('');
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [sentenceBuiltIndices, setSentenceBuiltIndices] = useState<number[]>([]);
  const [scrambledSelected, setScrambledSelected] = useState<number[]>([]);
  const [grammarOrderedTokens, setGrammarOrderedTokens] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string; showSolution?: boolean } | null>(null);
  const [teacherOverride, setTeacherOverride] = useState(false);

  const currentItem: LernstudioItem | undefined = items[currentIndex];
  const currentGrammarQuestion: GameQuestion | undefined = grammarQuestions[currentIndex];
  const activeListLength = selectedGameType === 'grammar' ? grammarQuestions.length : items.length;

  // Prepare Multiple Choice Options (German Target Words, deduplicated & seeded)
  const mcOptions = useMemo(() => {
    const isMcLike =
      selectedGameType === 'multiple_choice' ||
      selectedGameType === 'verb_conjugation' ||
      selectedGameType === 'verb_sentence';
    if (!currentItem || !isMcLike) return [];
    const rng = createSeededRandom(`${sessionSeed}::mc::${currentIndex}::${currentItem.id}`);
    const correct = currentItem.german.trim();
    const seen = new Set<string>([correct.toLowerCase()]);
    const uniquePool: string[] = [];
    for (const candidate of seededShuffle(rawItems, rng)) {
      if (!candidate || candidate.id === currentItem.id) continue;
      const g = candidate.german.trim();
      if (!g || seen.has(g.toLowerCase())) continue;
      seen.add(g.toLowerCase());
      uniquePool.push(g);
      if (uniquePool.length >= 3) break;
    }
    return seededShuffle([correct, ...uniquePool], rng);
  }, [currentItem, rawItems, selectedGameType, currentIndex, sessionSeed]);

  // Prepare Scrambled Letters
  const scrambledLetters = useMemo(() => {
    if (!currentItem || selectedGameType !== 'scrambled_letters') return [];
    const rng = createSeededRandom(`${sessionSeed}::scram::${currentIndex}::${currentItem.id}`);
    const cleanWord = currentItem.german.replace(/^(der|die|das)\s+/i, '').trim();
    const chars = cleanWord.split('').map((char, index) => ({ id: index, char }));
    const shuffled = seededShuffle(chars, rng);
    if (shuffled.map((c) => c.char).join('') === cleanWord && shuffled.length > 1) {
      return [...shuffled].reverse();
    }
    return shuffled;
  }, [currentItem, selectedGameType, currentIndex, sessionSeed]);

  // Prepare Sentence Elements and Target Sentence cleanly so check target ALWAYS matches display pieces
  const { sentenceElements, sentenceTarget } = useMemo(() => {
    if (!currentItem) return { sentenceElements: [] as string[], sentenceTarget: '' };
    const rng = createSeededRandom(`${sessionSeed}::sent::${currentIndex}::${currentItem.id}`);
    let orderedParts: string[];
    if (currentItem.sentence4Elements && currentItem.sentence4Elements.length === 4) {
      orderedParts = currentItem.sentence4Elements.map((s) => s.trim()).filter(Boolean);
    } else if (currentItem.exampleSentenceGerman && currentItem.exampleSentenceGerman.trim()) {
      const words = currentItem.exampleSentenceGerman.trim().split(/\s+/).filter(Boolean);
      if (words.length >= 4) {
        const chunk = Math.ceil(words.length / 4);
        orderedParts = [
          words.slice(0, chunk).join(' '),
          words.slice(chunk, chunk * 2).join(' '),
          words.slice(chunk * 2, chunk * 3).join(' '),
          words.slice(chunk * 3).join(' ')
        ].filter(Boolean);
      } else {
        orderedParts = words;
      }
    } else {
      orderedParts = [currentItem.german.trim(), 'ist', 'sehr', 'schön'];
    }
    const target = orderedParts.join(' ');
    let shuffled = seededShuffle(orderedParts, rng);
    if (shuffled.join(' ') === target && orderedParts.length > 1) {
      shuffled = [...orderedParts].reverse();
    }
    return { sentenceElements: shuffled, sentenceTarget: target };
  }, [currentItem, currentIndex, sessionSeed]);

  const currentVerbEntry = useMemo(() => {
    if (!currentItem) return null;
    if (!isItemVerb(currentItem) && set.setKind !== 'verb_group') return null;
    return resolveVerbFromLernstudioItem(currentItem);
  }, [currentItem, set.setKind]);

  const verbConjugationExercise = useMemo(() => {
    if (selectedGameType !== 'verb_conjugation' || !currentVerbEntry) return null;
    const promptObj = SUBJECT_PROMPTS[(currentIndex * 5) % SUBJECT_PROMPTS.length];
    return buildVerbConjugationExercise(currentVerbEntry, promptObj, 4);
  }, [selectedGameType, currentVerbEntry, currentIndex]);

  const verbSentenceExercise = useMemo(() => {
    if (selectedGameType !== 'verb_sentence' || !currentVerbEntry) return null;
    return buildVerbSentenceGapExercise(currentVerbEntry, ALL_VERBS);
  }, [selectedGameType, currentVerbEntry]);

  const grammarScrambledTokens = useMemo(() => {
    if (!currentGrammarQuestion || currentGrammarQuestion.grammarType !== 'sentence_ordering') return [];
    const rng = createSeededRandom(`${sessionSeed}::gsent::${currentIndex}::${currentGrammarQuestion.id}`);
    const base =
      currentGrammarQuestion.sentencePieces && currentGrammarQuestion.sentencePieces.length >= 2
        ? currentGrammarQuestion.sentencePieces
        : currentGrammarQuestion.correctAnswer.split(/\s+/).filter(Boolean);
    return seededShuffle(base.map((word, idx) => ({ idx, word })), rng);
  }, [currentGrammarQuestion, currentIndex, sessionSeed]);

  const resetQuestionState = () => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    setUserAnswerText('');
    setSelectedOptionIndex(null);
    setSentenceBuiltIndices([]);
    setScrambledSelected([]);
    setGrammarOrderedTokens([]);
    setFeedback(null);
    setTeacherOverride(false);
  };

  const handleNextQuestion = () => {
    resetQuestionState();
    if (currentIndex + 1 < activeListLength) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      playSfx('fanfare_victory');
      playVoice('gewonnen');
      triggerConfetti();
      if (!completedReportedRef.current && onGameComplete) {
        completedReportedRef.current = true;
        const attempts = Math.max(1, attemptCountRef.current);
        const accuracy = Math.min(100, Math.round((correctCountRef.current / attempts) * 100));
        onGameComplete({
          gameMode: 'game',
          score,
          maxScore: activeListLength * 10,
          accuracy,
          passed: accuracy >= 60,
          difficulty: gameConfig?.difficulty
        });
      }
    }
  };

  const handleRestartGame = () => {
    completedReportedRef.current = false;
    correctCountRef.current = 0;
    attemptCountRef.current = 0;
    setSessionNonce((n) => n + 1);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setIsCompleted(false);
    resetQuestionState();
  };

  // 1. Multiple Choice Check
  const handleCheckMultipleChoice = (opt: string, idx: number) => {
    if (!currentItem || feedback) return;
    setSelectedOptionIndex(idx);
    attemptCountRef.current += 1;

    const isCorrect = opt.trim().toLowerCase() === currentItem.german.trim().toLowerCase();
    if (isCorrect) {
      correctCountRef.current += 1;
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.rightAnswerMsg });
      playSfx('correct');
      playVoice('richtig');
      triggerSparkles(50, 50, '#10b981');
      triggerFloatingText('+10 ★ Richtig!', 50, 40, '#10b981');
      scheduleTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.wrongAnswerMsg} (${currentItem.german})`
      });
      playSfx('wrong');
      playVoice('noch_einmal');
    }
  };

  // 2. Missing Letter Check (strictly exact missing char OR exact full word)
  const activeMaskedWord = currentItem
    ? currentItem.missingLetterWord || currentItem.german.replace(/[aeiouäöü]/i, '_')
    : '';

  const handleCheckMissingLetter = () => {
    if (!currentItem || feedback) return;
    attemptCountRef.current += 1;
    const expectedFullClean = currentItem.german.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
    const expectedFullWithArticle = currentItem.german.trim().toLowerCase();
    const expectedMissingChar = extractMissingLetterChar(currentItem.german, activeMaskedWord).trim().toLowerCase();
    const userClean = userAnswerText.trim().toLowerCase();

    const isCorrect =
      Boolean(userClean) &&
      (userClean === expectedMissingChar ||
        userClean === expectedFullClean ||
        userClean === expectedFullWithArticle);
    if (isCorrect) {
      correctCountRef.current += 1;
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.rightAnswerMsg });
      playSfx('correct');
      playVoice('super');
      triggerSparkles(50, 50, '#10b981');
      triggerFloatingText('+10 ★ Super!', 50, 40, '#fbbf24');
      scheduleTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.wrongAnswerMsg} (${currentItem.german})`
      });
      playSfx('wrong');
      playVoice('noch_einmal');
    }
  };

  // 3. Sentence Builder Check
  const handleCheckSentenceBuilder = () => {
    if (!currentItem || feedback) return;
    attemptCountRef.current += 1;
    const constructedSentence = sentenceBuiltIndices
      .map((i) => sentenceElements[i] || '')
      .join(' ')
      .trim()
      .toLowerCase();
    const originalTarget = sentenceTarget.trim().toLowerCase();

    const isCorrect =
      constructedSentence.replace(/[.,!?]/g, '') === originalTarget.replace(/[.,!?]/g, '');

    if (isCorrect || teacherOverride) {
      correctCountRef.current += 1;
      setScore((s) => s + 15);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.perfectSentenceMsg });
      playSfx('correct');
      playVoice('fantastisch');
      triggerSparkles(50, 50, '#10b981');
      triggerFloatingText('+15 ★ Fantastisch!', 50, 40, '#fbbf24');
      scheduleTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.reorderSolutionMsg} ${sentenceTarget}`,
        showSolution: true
      });
      playSfx('wrong');
      playVoice('noch_einmal');
    }
  };

  // 4. Emoji Vocabulary Check
  const handleCheckEmojiVocab = () => {
    if (!currentItem || feedback) return;
    attemptCountRef.current += 1;
    const userText = userAnswerText.trim().toLowerCase();
    const targetGerman = currentItem.german.trim().toLowerCase();
    const targetClean = targetGerman.replace(/^(der|die|das)\s+/i, '');

    const isCorrect = userText === targetGerman || userText === targetClean;
    if (isCorrect || teacherOverride) {
      correctCountRef.current += 1;
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.rightAnswerMsg });
      playSfx('correct');
      playVoice('richtig');
      triggerSparkles(50, 50, '#10b981');
      triggerFloatingText('+10 ★ Richtig!', 50, 40, '#10b981');
      scheduleTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.wrongAnswerMsg} (${currentItem.german})`
      });
      playSfx('wrong');
      playVoice('noch_einmal');
    }
  };

  // 5. Scrambled Letters Check
  const handleCheckScrambled = () => {
    if (!currentItem || feedback) return;
    attemptCountRef.current += 1;
    const constructedWord = scrambledSelected.map((i) => scrambledLetters[i]?.char || '').join('').toLowerCase();
    const targetWord = currentItem.german.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();

    if (constructedWord === targetWord) {
      correctCountRef.current += 1;
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.rightAnswerMsg });
      playSfx('correct');
      playVoice('weiter_so');
      triggerSparkles(50, 50, '#10b981');
      triggerFloatingText('+10 ★ Weiter so!', 50, 40, '#fbbf24');
      scheduleTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.wrongAnswerMsg} (${currentItem.german})`
      });
      playSfx('wrong');
      playVoice('noch_einmal');
    }
  };

  const handleCheckGrammarAnswer = (answerStr: string, optIdx?: number) => {
    if (!currentGrammarQuestion || feedback) return;
    attemptCountRef.current += 1;
    if (optIdx !== undefined) setSelectedOptionIndex(optIdx);
    const isCorrect = evaluateGameQuestionAnswer(answerStr, currentGrammarQuestion) || teacherOverride;
    if (isCorrect) {
      correctCountRef.current += 1;
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({
        isCorrect: true,
        message: currentGrammarQuestion.explanation
          ? `${t.rightAnswerMsg} — ${currentGrammarQuestion.explanation}`
          : t.rightAnswerMsg
      });
      playSfx('correct');
      playVoice('richtig');
      triggerSparkles(50, 50, '#10b981');
      triggerFloatingText('+10 ★ Richtig!', 50, 40, '#10b981');
      scheduleTimeout(() => handleNextQuestion(), 1100);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.wrongAnswerMsg} (${currentGrammarQuestion.correctAnswer})${
          currentGrammarQuestion.explanation ? ` — ${currentGrammarQuestion.explanation}` : ''
        }`,
        showSolution: true
      });
      playSfx('wrong');
      playVoice('noch_einmal');
    }
  };

  const hasCurrentQuestion =
    selectedGameType === 'grammar' ? Boolean(currentGrammarQuestion) : Boolean(currentItem);

  if (!hasCurrentQuestion && !isCompleted) {
    return (
      <div className="p-8 text-center bg-surface border border-surface-border rounded-2xl space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <HelpCircle className="w-12 h-12 text-primary mx-auto opacity-60" />
        <h3 className="text-lg font-black text-text-main">{t.noSetsFound}</h3>
        <p className="text-xs text-text-muted">{t.noSetsDesc}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-xs"
        >
          {t.returnToSetsBtn}
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 rounded-2xl space-y-4 transition-all bg-background text-text-main" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <GameStageBanner
        gameId="game"
        title={t.comprehensivePracticeTitle}
        subtitle={`${getLocalizedSetTitle(set, language)} · ${selectedGameType === 'grammar' ? grammarQuestions.length : items.length} ${selectedGameType === 'grammar' ? (language === 'ar' ? 'تمرين قواعد' : language === 'de' ? 'Grammatikübungen' : 'exercises') : t.vocabularyCount}`}
        emoji={selectedGameType === 'grammar' ? '📘' : '🎯'}
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-surface p-3 sm:p-3.5 rounded-xl border border-surface-border shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-text-muted hover:text-text-main bg-surface-hover hover:bg-surface rounded-lg text-xs font-bold border border-surface-border transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <ArrowRight className={`w-4 h-4 ${language !== 'ar' ? 'rotate-180' : ''}`} />
            <span>{t.returnToSetsBtn}</span>
          </button>

          <div>
            <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-1.5">
              <span>{getLocalizedSetTitle(set, language)}</span>
            </h2>
            <p className="text-xs text-text-muted">
              {t.levelLabel} {set.level} · {selectedGameType === 'grammar' ? grammarQuestions.length : items.length}{' '}
              {selectedGameType === 'grammar'
                ? language === 'ar'
                  ? 'تمرين قواعد'
                  : language === 'de'
                  ? 'Übungen'
                  : 'exercises'
                : t.vocabularyCount}
            </p>
          </div>
        </div>

        {/* Score & Progress */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-surface-hover border border-surface-border text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            <span>{t.pointsLabel} {score}</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-surface-hover border border-surface-border text-primary font-bold text-xs flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            <span>{t.streakLabel} {streak} 🔥</span>
          </div>
        </div>
      </div>

      {/* Game Type Switcher Tabs */}
      <div className="flex flex-wrap gap-1 bg-surface-hover p-1 rounded-lg border border-surface-border text-xs font-bold">
        {grammarQuestions.length > 0 && (
          <button
            type="button"
            onClick={() => { setSelectedGameType('grammar'); setCurrentIndex(0); resetQuestionState(); }}
            className={`flex-1 min-w-[130px] py-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
              selectedGameType === 'grammar' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
            }`}
          >
            📘 {language === 'ar' ? `تمارين القواعد (${grammarQuestions.length})` : language === 'de' ? `Grammatik (${grammarQuestions.length})` : `Grammar (${grammarQuestions.length})`}
          </button>
        )}

        {hasVerbsInSet && (
          <>
            <button
              type="button"
              onClick={() => { setSelectedGameType('verb_conjugation'); setCurrentIndex(0); resetQuestionState(); }}
              className={`flex-1 min-w-[120px] py-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                selectedGameType === 'verb_conjugation' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              🔤 {language === 'ar' ? 'تصريف الأفعال' : 'Conjugation'}
            </button>
            <button
              type="button"
              onClick={() => { setSelectedGameType('verb_sentence'); setCurrentIndex(0); resetQuestionState(); }}
              className={`flex-1 min-w-[120px] py-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                selectedGameType === 'verb_sentence' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              ✍️ {language === 'ar' ? 'الفعل في جملة' : 'Verb in Sentence'}
            </button>
          </>
        )}

        {!isPureGrammarSet && (
          <>
            <button
              type="button"
              onClick={() => { setSelectedGameType('multiple_choice'); setCurrentIndex(0); resetQuestionState(); }}
              className={`flex-1 min-w-[110px] py-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                selectedGameType === 'multiple_choice' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {t.tabMultipleChoice}
            </button>

            <button
              type="button"
              onClick={() => { setSelectedGameType('missing_letter'); setCurrentIndex(0); resetQuestionState(); }}
              className={`flex-1 min-w-[110px] py-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                selectedGameType === 'missing_letter' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {t.tabMissingLetter}
            </button>

            <button
              type="button"
              onClick={() => { setSelectedGameType('sentence_builder'); setCurrentIndex(0); resetQuestionState(); }}
              className={`flex-1 min-w-[110px] py-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                selectedGameType === 'sentence_builder' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {t.tabSentenceBuilder}
            </button>

            <button
              type="button"
              onClick={() => { setSelectedGameType('emoji_vocab'); setCurrentIndex(0); resetQuestionState(); }}
              className={`flex-1 min-w-[110px] py-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                selectedGameType === 'emoji_vocab' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {t.tabEmojiVocab}
            </button>

            <button
              type="button"
              onClick={() => { setSelectedGameType('scrambled_letters'); setCurrentIndex(0); resetQuestionState(); }}
              className={`flex-1 min-w-[110px] py-1.5 px-2.5 rounded-md transition-all cursor-pointer ${
                selectedGameType === 'scrambled_letters' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {t.tabScrambledLetters}
            </button>
          </>
        )}
      </div>

      {/* Game Area */}
      {isCompleted ? (
        <div className={`p-8 rounded-3xl text-center space-y-5 ${activeTheme.cardBg}`}>
          <div className="w-24 h-24 rounded-2xl overflow-hidden border border-amber-500/40 mx-auto shadow-lg">
            <SharedVictoryTrophyArt className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-black text-text-main">{t.completedGameTitle}</h2>
          <p className="text-sm text-text-muted">
            {t.completedGameDesc} (<strong className="text-primary font-black">{score} {t.pointsLabel}</strong>)
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRestartGame}
              className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-black shadow-md inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.restartGameBtn}</span>
            </button>

            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 bg-surface hover:bg-surface-hover border border-surface-border text-text-main rounded-xl text-xs font-black cursor-pointer"
            >
              {t.returnToSetsBtn}
            </button>
          </div>
        </div>
      ) : selectedGameType === 'grammar' && currentGrammarQuestion ? (
        <div className={`p-5 sm:p-7 rounded-3xl space-y-6 shadow-lg border ${activeTheme.cardBg}`}>
          {/* Question Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-text-muted">
              <span>{t.questionProgress} {currentIndex + 1} / {grammarQuestions.length}</span>
              <span>{Math.round(((currentIndex + 1) / Math.max(1, grammarQuestions.length)) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${((currentIndex + 1) / Math.max(1, grammarQuestions.length)) * 100}%` }}
              />
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-primary-soft/50 border border-primary-border/40 rounded-2xl text-center space-y-2">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xl">📘</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-surface border border-surface-border text-[11px] font-black text-primary">
                {currentGrammarQuestion.grammarType || 'grammar'}
              </span>
              {currentGrammarQuestion.isUncertain && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] font-black text-amber-600">
                  ⚠️ {language === 'ar' ? 'يُنصح بالمراجعة' : 'Review'}
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-2xl font-black text-text-main leading-relaxed" dir="auto">
              {currentGrammarQuestion.prompt}
            </h3>
            {currentGrammarQuestion.sentenceWithBlank &&
              currentGrammarQuestion.sentenceWithBlank !== currentGrammarQuestion.prompt && (
                <p className="text-base sm:text-lg font-mono font-bold text-primary" dir="ltr">
                  {currentGrammarQuestion.sentenceWithBlank}
                </p>
              )}
            {currentGrammarQuestion.subPrompt && (
              <p className="text-xs sm:text-sm font-bold text-rose-500 line-through/70" dir="auto">
                {currentGrammarQuestion.subPrompt}
              </p>
            )}
            {(() => {
              const nonSpoilerSpeech =
                currentGrammarQuestion.sentenceWithBlank && !currentGrammarQuestion.sentenceWithBlank.includes('___')
                  ? currentGrammarQuestion.sentenceWithBlank
                  : currentGrammarQuestion.faultySentence ||
                    currentGrammarQuestion.prompt.replace(/_{2,}|\.{3,}/g, ' ').trim();
              const speechToPlay = feedback !== null ? currentGrammarQuestion.correctAnswer : nonSpoilerSpeech;
              if (!speechToPlay) return null;
              return (
                <button
                  type="button"
                  onClick={() => speakGermanText(speechToPlay, 0.85)}
                  className="mt-1 px-3 py-1 rounded-xl bg-surface border border-surface-border text-[11px] font-bold text-primary hover:bg-surface-hover cursor-pointer inline-flex items-center gap-1"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>
                    {feedback !== null
                      ? language === 'ar'
                        ? 'نطق الإجابة الصحيحة'
                        : 'Listen to Answer'
                      : language === 'ar'
                      ? 'استمع للسؤال'
                      : 'Listen'}
                  </span>
                </button>
              );
            })()}
          </div>

          {currentGrammarQuestion.grammarType === 'sentence_ordering' ? (
            <div className="space-y-4">
              <div
                className="p-4 bg-surface rounded-2xl border-2 border-dashed border-primary/40 min-h-[64px] flex items-center justify-center gap-2 flex-wrap"
                dir="ltr"
              >
                {grammarOrderedTokens.length === 0 ? (
                  <span className="text-xs text-text-muted font-bold">
                    {language === 'ar' ? 'اضغط على الكلمات بالترتيب الصحيح...' : 'Tap words in order...'}
                  </span>
                ) : (
                  grammarOrderedTokens.map((tokIdx, pos) => (
                    <button
                      key={`${tokIdx}_${pos}`}
                      type="button"
                      disabled={feedback !== null}
                      onClick={() => setGrammarOrderedTokens((prev) => prev.filter((_, p) => p !== pos))}
                      className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer hover:bg-rose-500 transition-colors font-mono"
                    >
                      {grammarScrambledTokens[tokIdx]?.word} ×
                    </button>
                  ))
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2" dir="ltr">
                {grammarScrambledTokens.map((item, idx) => {
                  const used = grammarOrderedTokens.includes(idx);
                  return (
                    <button
                      key={`${item.word}_${idx}`}
                      type="button"
                      disabled={used || feedback !== null}
                      onClick={() => setGrammarOrderedTokens((prev) => [...prev, idx])}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer font-mono ${
                        used
                          ? 'opacity-30 bg-surface-hover border-surface-border'
                          : 'bg-surface hover:bg-primary-soft border-surface-border text-text-main shadow-xs'
                      }`}
                    >
                      {item.word}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={feedback !== null || grammarOrderedTokens.length === 0}
                  onClick={() => {
                    const assembled = grammarOrderedTokens
                      .map((idx) => grammarScrambledTokens[idx]?.word || '')
                      .join(' ');
                    handleCheckGrammarAnswer(assembled);
                  }}
                  className={`px-8 py-3 rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 ${activeTheme.primaryBg}`}
                >
                  {t.checkAnswerBtn}
                </button>
              </div>
            </div>
          ) : currentGrammarQuestion.grammarType === 'short_answer' ||
            !currentGrammarQuestion.options ||
            currentGrammarQuestion.options.length < 2 ? (
            <div className="space-y-3 max-w-md mx-auto">
              <input
                type="text"
                disabled={feedback !== null}
                value={userAnswerText}
                onChange={(e) => setUserAnswerText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userAnswerText.trim()) {
                    handleCheckGrammarAnswer(userAnswerText);
                  }
                }}
                placeholder={language === 'ar' ? 'اكتب الإجابة بالألمانية...' : 'Type your German answer...'}
                dir="ltr"
                className="w-full px-4 py-3 rounded-2xl border border-surface-border bg-surface text-text-main text-center font-bold text-base focus:outline-none focus:border-primary font-mono"
              />
              <button
                type="button"
                disabled={feedback !== null || !userAnswerText.trim()}
                onClick={() => handleCheckGrammarAnswer(userAnswerText)}
                className={`w-full py-3 rounded-2xl font-black text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 ${activeTheme.primaryBg}`}
              >
                {t.checkAnswerBtn}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" dir="ltr">
              {currentGrammarQuestion.options.map((opt, idx) => (
                <button
                  key={`${opt}_${idx}`}
                  type="button"
                  disabled={feedback !== null}
                  onClick={() => handleCheckGrammarAnswer(opt, idx)}
                  className={`p-4 rounded-2xl font-black text-sm sm:text-base text-center transition-all border cursor-pointer font-mono ${
                    selectedOptionIndex === idx
                      ? feedback?.isCorrect
                        ? 'bg-emerald-500 text-white border-emerald-600'
                        : 'bg-rose-500 text-white border-rose-600'
                      : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {feedback && (
            <div
              className={`p-4 sm:p-5 rounded-2xl border animate-scale-up space-y-3 ${
                feedback.isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                  {feedback.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all inline-flex items-center gap-1"
                >
                  <span>
                    {currentIndex + 1 < grammarQuestions.length
                      ? language === 'ar'
                        ? 'السؤال التالي ➔'
                        : language === 'de'
                        ? 'Nächste Frage ➔'
                        : 'Next Question ➔'
                      : language === 'ar'
                      ? 'إنهاء التدريب 🎉'
                      : language === 'de'
                      ? 'Training beenden 🎉'
                      : 'Finish Practice 🎉'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        currentItem && (
          <div className={`p-5 sm:p-7 rounded-3xl space-y-6 shadow-lg border ${activeTheme.cardBg}`}>
            {/* Question Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-extrabold text-text-muted">
                <span>{t.questionProgress} {items.length > 0 ? currentIndex + 1 : 0} / {items.length}</span>
                <span>{items.length > 0 ? Math.round(((currentIndex + 1) / items.length) * 100) : 0}%</span>
              </div>
              <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* VERB CONJUGATION & VERB IN SENTENCE MODES */}
            {(selectedGameType === 'verb_conjugation' || selectedGameType === 'verb_sentence') &&
              (verbConjugationExercise || verbSentenceExercise) && (() => {
                const activeEx =
                  selectedGameType === 'verb_conjugation' ? verbConjugationExercise : verbSentenceExercise;
                if (!activeEx) return null;
                const promptTitle =
                  selectedGameType === 'verb_conjugation' && verbConjugationExercise
                    ? verbConjugationExercise.promptAr
                    : verbSentenceExercise!.sentenceWithBlank;
                const promptSub =
                  selectedGameType === 'verb_conjugation' && verbConjugationExercise
                    ? verbConjugationExercise.promptDe
                    : verbSentenceExercise!.sentenceArabic;

                return (
                  <div className="space-y-5">
                    <div className="p-4 bg-primary-soft/50 border border-primary-border/40 rounded-2xl text-center space-y-1.5">
                      <span className="text-2xl block">{selectedGameType === 'verb_conjugation' ? '🔤' : '✍️'}</span>
                      <h3 className="text-lg sm:text-2xl font-black text-text-main" dir="auto">
                        {promptTitle}
                      </h3>
                      {promptSub && (
                        <p className="text-xs sm:text-sm font-bold text-primary" dir="auto">
                          {promptSub}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" dir="ltr">
                      {activeEx.options.map((opt, idx) => {
                        const isRight = opt.trim().toLowerCase() === activeEx.correctAnswer.trim().toLowerCase();
                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={feedback !== null}
                            onClick={() => {
                              setSelectedOptionIndex(idx);
                              if (isRight) {
                                setScore((s) => s + 10);
                                setStreak((st) => st + 1);
                                setFeedback({ isCorrect: true, message: t.rightAnswerMsg });
                                playLernstudioSound('correct');
                                playGermanVoiceFeedback('richtig');
                                triggerSparkles(50, 50, '#10b981');
                                triggerFloatingText('+10 ★ Richtig!', 50, 40, '#10b981');
                                setTimeout(() => handleNextQuestion(), 900);
                              } else {
                                setStreak(0);
                                setFeedback({
                                  isCorrect: false,
                                  message: `${t.wrongAnswerMsg} (${activeEx.correctAnswer})`
                                });
                                playLernstudioSound('wrong');
                                playGermanVoiceFeedback('noch_einmal');
                              }
                            }}
                            className={`p-4 rounded-2xl font-black text-base text-center transition-all border cursor-pointer font-mono ${
                              selectedOptionIndex === idx
                                ? feedback?.isCorrect
                                  ? 'bg-emerald-500 text-white border-emerald-600'
                                  : 'bg-rose-500 text-white border-rose-600'
                                : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            {/* GAME 1: MULTIPLE CHOICE (also serves as fallback on non-verb items in mixed sets) */}
            {(selectedGameType === 'multiple_choice' ||
              ((selectedGameType === 'verb_conjugation' || selectedGameType === 'verb_sentence') &&
                !currentVerbEntry)) && (
              <div className="space-y-5">
                <div className="p-4 bg-primary-soft/50 border border-primary-border/40 rounded-2xl text-center space-y-1">
                  <span className="text-3xl block mb-1">{currentItem.emoji || '📚'}</span>
                  <h3 className="text-2xl sm:text-3xl font-black text-text-main">
                    {getItemTranslation(currentItem, language)}
                  </h3>
                  <p className="text-xs font-bold text-primary mt-2">{t.mcPrompt}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" dir="ltr">
                  {mcOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={feedback !== null}
                      onClick={() => handleCheckMultipleChoice(opt, idx)}
                      className={`p-4 rounded-2xl font-black text-base text-center transition-all border cursor-pointer font-mono ${
                        selectedOptionIndex === idx
                          ? feedback?.isCorrect
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : 'bg-red-500 text-white border-red-600'
                          : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* GAME 2: MISSING LETTER */}
            {selectedGameType === 'missing_letter' && (
              <div className="space-y-5">
                <div className="p-4 bg-primary-soft/50 border border-primary-border/40 rounded-2xl text-center space-y-2">
                  <span className="text-3xl block">{currentItem.emoji || '🔤'}</span>
                  <h3 className="text-2xl sm:text-3xl font-black text-primary tracking-widest font-mono" dir="ltr">
                    {activeMaskedWord}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">{getItemTranslation(currentItem, language)}</p>
                </div>

                <div className="space-y-3 max-w-md mx-auto">
                  <label className="text-xs font-bold text-text-muted block text-center">{t.missingLetterPrompt}</label>
                  <input
                    type="text"
                    disabled={feedback !== null}
                    value={userAnswerText}
                    onChange={(e) => setUserAnswerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && userAnswerText.trim()) handleCheckMissingLetter();
                    }}
                    placeholder="..."
                    dir="ltr"
                    className="w-full px-4 py-3 rounded-2xl border border-surface-border bg-surface text-text-main text-center font-bold text-lg focus:outline-none focus:border-primary font-mono"
                  />
                  <button
                    type="button"
                    disabled={feedback !== null || !userAnswerText.trim()}
                    onClick={handleCheckMissingLetter}
                    className={`w-full py-3 rounded-2xl font-black text-xs transition-all shadow-md cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    {t.checkAnswerBtn}
                  </button>
                </div>
              </div>
            )}

            {/* GAME 3: SENTENCE BUILDER */}
            {selectedGameType === 'sentence_builder' && (
              <div className="space-y-5">
                <div className="p-4 bg-primary-soft/50 border border-primary-border/40 rounded-2xl text-center space-y-1">
                  <span className="text-xs font-bold text-primary block">{t.sentenceBuilderPrompt}</span>
                  <p className="text-xs text-text-muted font-bold">{currentItem.exampleSentenceArabic || getItemTranslation(currentItem, language)}</p>
                </div>

                {/* Built sentence drop target */}
                <div className="p-4 bg-surface rounded-2xl border-2 border-dashed border-primary/40 min-h-[70px] flex items-center justify-center gap-2 flex-wrap" dir="ltr">
                  {sentenceBuiltIndices.length === 0 ? (
                    <span className="text-xs text-text-muted font-bold">...</span>
                  ) : (
                    sentenceBuiltIndices.map((elemIdx, pos) => (
                      <button
                        key={`${elemIdx}_${pos}`}
                        type="button"
                        onClick={() => setSentenceBuiltIndices((prev) => prev.filter((_, i) => i !== pos))}
                        className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer hover:bg-red-500 transition-colors font-mono"
                      >
                        {sentenceElements[elemIdx]} ×
                      </button>
                    ))
                  )}
                </div>

                {/* Elements choices */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" dir="ltr">
                  {sentenceElements.map((elem, idx) => {
                    const isUsed = sentenceBuiltIndices.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isUsed || feedback !== null}
                        onClick={() => setSentenceBuiltIndices((prev) => [...prev, idx])}
                        className={`p-3 rounded-xl font-bold text-xs border transition-all cursor-pointer font-mono ${
                          isUsed
                            ? 'opacity-30 bg-surface-hover border-surface-border'
                            : 'bg-surface hover:bg-primary-soft border-surface-border text-text-main shadow-xs'
                        }`}
                      >
                        {elem}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTeacherOverride((prev) => !prev)}
                    className="text-[11px] font-bold text-text-muted hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{t.teacherPassBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={feedback !== null || sentenceBuiltIndices.length === 0}
                    onClick={handleCheckSentenceBuilder}
                    className={`px-6 py-2.5 rounded-xl font-black text-xs shadow-md transition-all cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    {t.checkAnswerBtn}
                  </button>
                </div>
              </div>
            )}

            {/* GAME 4: EMOJI VOCABULARY */}
            {selectedGameType === 'emoji_vocab' && (
              <div className="space-y-5">
                <div className="p-6 bg-primary-soft/50 border border-primary-border/40 rounded-2xl text-center space-y-2">
                  <span className="text-6xl sm:text-7xl block">{currentItem.emoji || '🐱'}</span>
                  <p className="text-xs font-bold text-primary">{t.emojiVocabPrompt}</p>
                </div>

                <div className="space-y-3 max-w-md mx-auto">
                  <input
                    type="text"
                    disabled={feedback !== null}
                    value={userAnswerText}
                    onChange={(e) => setUserAnswerText(e.target.value)}
                    placeholder="e.g. die Katze"
                    dir="ltr"
                    className="w-full px-4 py-3 rounded-2xl border border-surface-border bg-surface text-text-main text-center font-bold text-base focus:outline-none focus:border-primary font-mono"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setTeacherOverride((prev) => !prev)}
                      className="text-[11px] font-bold text-text-muted hover:text-primary cursor-pointer inline-flex items-center gap-1"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{t.teacherPassBtn}</span>
                    </button>

                    <button
                      type="button"
                      disabled={feedback !== null || !userAnswerText.trim()}
                      onClick={handleCheckEmojiVocab}
                      className={`px-6 py-2.5 rounded-xl font-black text-xs shadow-md transition-all cursor-pointer ${activeTheme.primaryBg}`}
                    >
                      {t.checkAnswerBtn}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* GAME 5: SCRAMBLED LETTERS */}
            {selectedGameType === 'scrambled_letters' && (
              <div className="space-y-5">
                <div className="p-4 bg-primary-soft/50 border border-primary-border/40 rounded-2xl text-center space-y-1">
                  <span className="text-xs font-bold text-primary block">{t.scrambledPrompt}</span>
                  <p className="text-xs text-text-muted font-bold">{getItemTranslation(currentItem, language)}</p>
                </div>

                {/* Built word target */}
                <div className="p-4 bg-surface rounded-2xl border-2 border-dashed border-primary/40 min-h-[60px] flex items-center justify-center gap-1.5 flex-wrap" dir="ltr">
                  {scrambledSelected.length === 0 ? (
                    <span className="text-xs text-text-muted font-bold">...</span>
                  ) : (
                    scrambledSelected.map((idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setScrambledSelected((prev) => prev.filter((i) => i !== idx))}
                        className="w-10 h-10 bg-primary text-white rounded-xl text-base font-black shadow-xs cursor-pointer hover:bg-red-500 transition-colors font-mono"
                      >
                        {scrambledLetters[idx].char}
                      </button>
                    ))
                  )}
                </div>

                {/* Letters pool */}
                <div className="flex items-center justify-center gap-2 flex-wrap" dir="ltr">
                  {scrambledLetters.map((item, idx) => {
                    const isUsed = scrambledSelected.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isUsed || feedback !== null}
                        onClick={() => setScrambledSelected((prev) => [...prev, idx])}
                        className={`w-11 h-11 rounded-xl text-lg font-black border transition-all cursor-pointer font-mono ${
                          isUsed
                            ? 'opacity-20 bg-surface-hover border-surface-border'
                            : 'bg-surface hover:bg-primary-soft border-surface-border text-text-main shadow-xs'
                        }`}
                      >
                        {item.char}
                      </button>
                    );
                  })}
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    disabled={feedback !== null || scrambledSelected.length === 0}
                    onClick={handleCheckScrambled}
                    className={`px-8 py-3 rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer ${activeTheme.primaryBg}`}
                  >
                    {t.checkAnswerBtn}
                  </button>
                </div>
              </div>
            )}

            {/* Feedback & Next Banner */}
            {feedback && (
              <div
                className={`p-4 sm:p-5 rounded-2xl border animate-scale-up space-y-3 ${
                  feedback.isCorrect
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                    {feedback.isCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-500 shrink-0" />}
                    <span>{feedback.message}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all inline-flex items-center gap-1"
                  >
                    <span>{currentIndex + 1 < items.length ? (language === 'ar' ? 'السؤال التالي ➔' : language === 'de' ? 'Nächste Frage ➔' : 'Next Question ➔') : (language === 'ar' ? 'إنهاء التدريب 🎉' : language === 'de' ? 'Training beenden 🎉' : 'Finish Practice 🎉')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};
