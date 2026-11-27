import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LernstudioSet, LernstudioItem, LernstudioGameMode } from '../../types/lernstudio';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../utils/lernstudioTranslations';
import { speakGermanText, speakGermanTextAndWait, stopGermanSpeech } from '../../utils/audioSpeechUtils';
import { playLernstudioSound } from '../../utils/lernstudioAudioUtils';
import { buildTeacherStudySpeechText, resolveVerbFromLernstudioItem } from '../verbEngine';
import {
  hasGrammarContent,
  getGrammarLessonExercises,
  evaluateNormalizedGrammarAnswer,
  getLocalizedGrammarField
} from '../grammarEngine';
import { getGameCompatibilityForSet } from '../lernstudioQuestionAdapter';
import {
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  CheckCircle2,
  XCircle,
  Trophy,
  Star,
  RotateCcw,
  Sparkles,
  Shuffle,
  GraduationCap,
  HelpCircle,
  Gamepad2,
  Lightbulb,
  Eye
} from 'lucide-react';

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface Props {
  isOpen: boolean;
  set: LernstudioSet;
  language?: string;
  onClose: () => void;
  onLaunchGame?: (gameMode: LernstudioGameMode) => void;
}

interface TrueFalseQuestion {
  targetItem: LernstudioItem;
  displayedItem: LernstudioItem;
  isMatch: boolean;
}

interface Choice2Question {
  targetItem: LernstudioItem;
  choices: LernstudioItem[];
}

interface ChoiceFullSetQuestion {
  targetItem: LernstudioItem;
  choices: LernstudioItem[];
}

export function splitGermanIntoSyllables(wordOnly: string): string[] {
  const trimmed = (wordOnly || '').trim();
  if (trimmed.length <= 3) {
    if (trimmed.length <= 1) return [trimmed];
    return [trimmed.slice(0, 1), trimmed.slice(1)];
  }

  const vowelsRegex = /(ei|ai|au|äu|eu|ie|[aeiouäöüyAEIOUÄÖÜY])/gi;
  const vowelMatches: { index: number; text: string }[] = [];
  let match;
  while ((match = vowelsRegex.exec(trimmed)) !== null) {
    vowelMatches.push({ index: match.index, text: match[0] });
  }

  if (vowelMatches.length <= 1) {
    const mid = Math.max(2, Math.floor(trimmed.length / 2));
    return [trimmed.slice(0, mid), trimmed.slice(mid)];
  }

  const splitPoints: number[] = [0];
  for (let k = 0; k < vowelMatches.length - 1; k++) {
    const currVowelEnd = vowelMatches[k].index + vowelMatches[k].text.length;
    const nextVowelStart = vowelMatches[k + 1].index;
    const consLen = nextVowelStart - currVowelEnd;

    if (consLen <= 1) {
      splitPoints.push(currVowelEnd);
    } else {
      const splitPos = currVowelEnd + Math.floor(consLen / 2);
      splitPoints.push(splitPos);
    }
  }
  splitPoints.push(trimmed.length);

  const syllables: string[] = [];
  for (let i = 0; i < splitPoints.length - 1; i++) {
    const chunk = trimmed.slice(splitPoints[i], splitPoints[i + 1]);
    if (chunk) syllables.push(chunk);
  }
  return syllables.length > 0 ? syllables : [trimmed];
}

interface SyllableChoice {
  id: string;
  syllable: string;
}

interface SyllablePuzzleQuestion {
  targetItem: LernstudioItem;
  article: string;
  wordOnly: string;
  expectedSyllables: string[];
  choices: SyllableChoice[];
}

export function splitGermanArticleAndWord(german: string): { article: string; wordOnly: string } {
  const trimmed = (german || '').trim();
  const match = trimmed.match(/^(der|die|das)\s+(.+)$/i);
  if (match) {
    return { article: match[1], wordOnly: match[2] };
  }
  return { article: '', wordOnly: trimmed };
}

const GERMAN_DISTRACTOR_LETTERS = [
  'A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'W', 'Z', 'Ä', 'Ö', 'Ü', 'ß'
];

// Digit keycap emoji (e.g. '2️⃣0️⃣' for "zwanzig") renders as broken "2≡0≡"
// glyphs in the Android WebView font: U+20E3 (combining enclosing keycap)
// has no colour-emoji glyph there and shows as horizontal bars. Render the
// plain digits in bold text instead — same meaning, readable everywhere.
const KEYCAP_SEQUENCE_RE = /([0-9#*])\uFE0F?\u20E3/g;
export function renderTeachEmoji(emoji: string | undefined): React.ReactNode {
  const value = emoji || '🇩🇪';
  if (!/[0-9#*]\uFE0F?\u20E3/.test(value)) return value;
  const digits = value.replace(KEYCAP_SEQUENCE_RE, '$1');
  return <span className="font-black tracking-wide">{digits}</span>;
}

interface MissingLetterQuestion {
  targetItem: LernstudioItem;
  article: string;
  wordOnly: string;
  chars: string[];
  missingIndex: number;
  missingChar: string;
  choices: string[];
}

interface MissingSeqChoice {
  id: string;
  char: string;
}

interface MissingSeqQuestion {
  targetItem: LernstudioItem;
  article: string;
  wordOnly: string;
  chars: string[];
  missingIndices: number[];
  expectedChars: string[];
  choices: MissingSeqChoice[];
}

interface WordCompleteChoice {
  id: string;
  char: string;
}

interface WordCompleteQuestion {
  targetItem: LernstudioItem;
  article: string;
  wordOnly: string;
  targetChars: string[];
  choices: WordCompleteChoice[];
}

export const LernstudioTeachPage: React.FC<Props> = ({
  isOpen,
  set,
  language = 'ar',
  onClose,
  onLaunchGame
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displaySetTitle = getLocalizedSetTitle(set, language);

  const STORAGE_KEY = `lernstudio_teach_progress_${set?.id || 'default'}`;
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const vocabAvailable = Boolean(set?.items && set.items.length > 0);
  const grammarAvailable = Boolean(set && hasGrammarContent(set));

  // State
  const [teachViewMode, setTeachViewMode] = useState<'vocab' | 'grammar'>(
    !vocabAvailable && grammarAvailable ? 'grammar' : 'vocab'
  );
  const [grammarTab, setGrammarTab] = useState<'rules' | 'examples' | 'practice' | 'games'>('rules');
  const [grammarExIndex, setGrammarExIndex] = useState<number>(0);
  const [grammarUserAnswer, setGrammarUserAnswer] = useState<string>('');
  const [grammarOrderTokens, setGrammarOrderTokens] = useState<string[]>([]);
  const [grammarHintVisible, setGrammarHintVisible] = useState<boolean>(false);
  const [grammarAnswerRevealed, setGrammarAnswerRevealed] = useState<boolean>(false);
  const [grammarFeedback, setGrammarFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [grammarSubmitted, setGrammarSubmitted] = useState<boolean>(false);
  const [grammarScore, setGrammarScore] = useState<{ correct: number; totalAttempted: number }>({ correct: 0, totalAttempted: 0 });
  const [expandedRuleIds, setExpandedRuleIds] = useState<Record<string, boolean>>({});

  const [currentStage, setCurrentStage] = useState<number>(1);
  const [stageQuestionIndex, setStageQuestionIndex] = useState<number>(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [stars, setStars] = useState<number>(0);
  const [shuffleKey, setShuffleKey] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Exercise interaction state
  const [selectedAnswer, setSelectedAnswer] = useState<string | boolean | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [isSpeakingFeedback, setIsSpeakingFeedback] = useState<boolean>(false);

  // Q25: words answered wrong across stages 2–8. Reviewed on stage 9 with a
  // practice-only retry round ("اتدرب على الكلمات دي") — corrected answers
  // in the retry round do NOT change stars (Q32).
  const [wrongItems, setWrongItems] = useState<LernstudioItem[]>([]);
  const [retryItems, setRetryItems] = useState<LernstudioItem[] | null>(null);
  const [retryIndex, setRetryIndex] = useState(0);
  const [retrySelectedId, setRetrySelectedId] = useState<string | null>(null);
  const [retryFeedback, setRetryFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [retryFinishedClean, setRetryFinishedClean] = useState(false);
  const retryRemainingIdsRef = useRef<Set<string>>(new Set());
  const recordWrongItem = (item: LernstudioItem) => {
    setWrongItems((prev) => (prev.some((w) => w.id === item.id) ? prev : [...prev, item]));
  };

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  };

  // Always reset to Stage 1 / default view mode and start fresh when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const hasVocab = Boolean(set?.items && set.items.length > 0);
    const hasGrammar = Boolean(set && hasGrammarContent(set));
    setTeachViewMode(!hasVocab && hasGrammar ? 'grammar' : 'vocab');
    setGrammarTab('rules');
    setGrammarExIndex(0);
    setGrammarUserAnswer('');
    setGrammarOrderTokens([]);
    setGrammarHintVisible(false);
    setGrammarAnswerRevealed(false);
    setGrammarFeedback(null);
    setGrammarSubmitted(false);
    setGrammarScore({ correct: 0, totalAttempted: 0 });
    setExpandedRuleIds({});

    setCurrentStage(1);
    setStageQuestionIndex(0);
    setCompletedStages([]);
    setStars(0);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setIsCorrectAnswer(null);
    setFeedbackMessage('');
    setWrongItems([]);
    setRetryItems(null);
    setRetryIndex(0);
    setRetrySelectedId(null);
    setRetryFeedback(null);
    setRetryFinishedClean(false);
    retryRemainingIdsRef.current = new Set();
    clearAutoAdvanceTimer();
    try {
      if (set?.id) {
        localStorage.removeItem(`lernstudio_teach_progress_${set.id}`);
      }
    } catch {
      // storage cleanup
    }
  }, [isOpen, set?.id]);

  // Clean timer on unmount or modal close
  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
      stopGermanSpeech();
    };
  }, []);

  // Save progress
  const saveProgress = (stage: number, itemIndex: number, completed: number[], newStars: number) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          stage,
          itemIndex,
          completedStages: completed,
          stars: newStars,
          updatedAt: Date.now()
        })
      );
    } catch (e) {
      console.warn('Could not save teach progress', e);
    }
  };

  const handleResetProgress = () => {
    // Q23: one tap used to wipe all teach progress — confirm first.
    if (
      typeof window !== 'undefined' &&
      !window.confirm('هتمسح كل تقدم الدرس ده وتبدأ من الأول؟ مش هتقدر ترجع التقدم بعد المسح.')
    ) {
      return;
    }
    clearAutoAdvanceTimer();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    setCurrentStage(1);
    setStageQuestionIndex(0);
    setCompletedStages([]);
    setStars(0);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setIsCorrectAnswer(null);
    setFeedbackMessage('');
    setWrongItems([]);
    setRetryItems(null);
    setRetryIndex(0);
    setRetrySelectedId(null);
    setRetryFeedback(null);
    setRetryFinishedClean(false);
    retryRemainingIdsRef.current = new Set();
    setGrammarExIndex(0);
    setGrammarUserAnswer('');
    setGrammarOrderTokens([]);
    setGrammarHintVisible(false);
    setGrammarAnswerRevealed(false);
    setGrammarFeedback(null);
    setGrammarSubmitted(false);
    setGrammarScore({ correct: 0, totalAttempted: 0 });
    setShuffleKey((k) => k + 1);
  };

  const items = useMemo(() => (Array.isArray(set?.items) ? set.items : []), [set?.items]);
  const grammarExercises = useMemo(() => (set ? getGrammarLessonExercises(set) : []), [set]);

  // Q25 retry round: multiple-choice over the wrong words only (practice —
  // no stars change, Q32). Distractors come from the rest of the set.
  const retryOptions = useMemo(() => {
    if (!retryItems || retryItems.length === 0) return [] as LernstudioItem[];
    const target = retryItems[retryIndex % retryItems.length];
    if (!target) return [] as LernstudioItem[];
    const distractors = shuffleArray(items.filter((it) => it.id !== target.id)).slice(0, 3);
    return shuffleArray([target, ...distractors]);
  }, [retryItems, retryIndex, items]);

  const startRetryRound = () => {
    if (wrongItems.length === 0) return;
    retryRemainingIdsRef.current = new Set(wrongItems.map((w) => w.id));
    setRetryItems([...wrongItems]);
    setRetryIndex(0);
    setRetrySelectedId(null);
    setRetryFeedback(null);
    setRetryFinishedClean(false);
  };

  const advanceRetry = () => {
    if (!retryItems) return;
    clearAutoAdvanceTimer();
    if (retryIndex + 1 < retryItems.length) {
      setRetryIndex((i) => i + 1);
      setRetrySelectedId(null);
      setRetryFeedback(null);
    } else {
      const remaining = retryItems.filter((it) => retryRemainingIdsRef.current.has(it.id));
      setWrongItems(remaining);
      setRetryItems(null);
      setRetrySelectedId(null);
      setRetryFeedback(null);
      setRetryFinishedClean(remaining.length === 0);
    }
  };

  const handleRetryAnswer = (chosen: LernstudioItem) => {
    if (!retryItems || retrySelectedId) return;
    const target = retryItems[retryIndex % retryItems.length];
    if (!target) return;
    const correct = chosen.id === target.id;
    setRetrySelectedId(chosen.id);
    if (correct) {
      retryRemainingIdsRef.current.delete(target.id);
      if (soundEnabled) playLernstudioSound('correct');
      setRetryFeedback({ isCorrect: true, message: `صح! ${target.german} = ${target.arabic} 👏` });
      clearAutoAdvanceTimer();
      autoAdvanceTimerRef.current = setTimeout(() => advanceRetry(), 1100);
    } else {
      if (soundEnabled) playLernstudioSound('wrong');
      setRetryFeedback({
        isCorrect: false,
        message: `الإجابة الصحيحة هي: ${target.german} (${target.arabic})`
      });
    }
  };

  // German Speech Synthesis (Android & Mobile Cross-Platform)
  const handleSpeakGerman = (text: string) => {
    if (!soundEnabled) return;
    speakGermanText(text);
  };

  // Generate Questions for Stage 2 (True / False) - Randomized questions and non-predictable True/False answers
  const stage2Questions = useMemo<TrueFalseQuestion[]>(() => {
    const shuffledTargets = shuffleArray<LernstudioItem>(items);
    // Create a balanced pool of true/false (approximately 50% each) and shuffle thoroughly
    const matchPool: boolean[] = [];
    const half = Math.ceil(shuffledTargets.length / 2);
    for (let i = 0; i < shuffledTargets.length; i++) {
      matchPool.push(i < half);
    }
    const shuffledMatches = shuffleArray<boolean>(matchPool);

    return shuffledTargets.map((target: LernstudioItem, idx: number) => {
      const isMatch = items.length === 1 ? true : shuffledMatches[idx];
      let displayed: LernstudioItem = target;
      if (!isMatch) {
        const distractors = items.filter((it) => it.id !== target.id);
        if (distractors.length > 0) {
          displayed = distractors[Math.floor(Math.random() * distractors.length)];
        }
      }
      return { targetItem: target, displayedItem: displayed, isMatch };
    });
  }, [items, shuffleKey]);

  // Generate Questions for Stage 3 (2 Options Choice) - Randomized question order and choices
  const stage3Questions = useMemo<Choice2Question[]>(() => {
    const shuffledTargets = shuffleArray<LernstudioItem>(items);
    return shuffledTargets.map((target: LernstudioItem) => {
      const distractors = items.filter((it) => it.id !== target.id);
      const distractor: LernstudioItem =
        distractors.length > 0
          ? distractors[Math.floor(Math.random() * distractors.length)]
          : { ...target, german: target.german + ' (آخرى)', arabic: 'اختيار آخر' };

      const choices = shuffleArray<LernstudioItem>([target, distractor]);
      return { targetItem: target, choices };
    });
  }, [items, shuffleKey]);

  // Generate Questions for Stage 4 (Full Set Choice)
  const stage4Questions = useMemo<ChoiceFullSetQuestion[]>(() => {
    const shuffledTargets = shuffleArray<LernstudioItem>(items);
    return shuffledTargets.map((target: LernstudioItem) => {
      const choices = shuffleArray<LernstudioItem>(items);
      return { targetItem: target, choices };
    });
  }, [items, shuffleKey]);

  // Generate Questions for Stage 5 (Silben zusammensetzen - Syllable Puzzle)
  const syllableQuestions = useMemo<SyllablePuzzleQuestion[]>(() => {
    const shuffledTargets = shuffleArray<LernstudioItem>(items);
    return shuffledTargets.map((target: LernstudioItem) => {
      const { article, wordOnly } = splitGermanArticleAndWord(target.german);
      const expectedSyllables = (target.syllables && Array.isArray(target.syllables) && target.syllables.length >= 2)
        ? target.syllables
        : splitGermanIntoSyllables(wordOnly);

      const choices: SyllableChoice[] = shuffleArray(
        expectedSyllables.map((syl, idx) => ({
          id: `syl_${idx}_${syl}_${Math.random().toString(36).substring(2, 6)}`,
          syllable: syl
        }))
      );

      return {
        targetItem: target,
        article,
        wordOnly,
        expectedSyllables,
        choices
      };
    });
  }, [items, shuffleKey]);

  // Generate Questions for Stage 6 (Fehlender Buchstabe - One Missing Letter)
  const stage5Questions = useMemo<MissingLetterQuestion[]>(() => {
    const shuffledTargets = shuffleArray<LernstudioItem>(items);
    return shuffledTargets.map((target: LernstudioItem) => {
      const { article, wordOnly } = splitGermanArticleAndWord(target.german);
      const letters = wordOnly.split('');
      const validIndices: number[] = [];
      for (let i = 0; i < letters.length; i++) {
        if (/[a-zA-ZäöüÄÖÜß]/.test(letters[i])) {
          validIndices.push(i);
        }
      }
      const missingIndex = validIndices.length > 0
        ? validIndices[Math.floor(Math.random() * validIndices.length)]
        : 0;
      const missingChar = wordOnly[missingIndex] || 'A';

      const correctUpper = missingChar.toUpperCase();
      const distractorPool = GERMAN_DISTRACTOR_LETTERS.filter((c) => c !== correctUpper);
      const distractors = shuffleArray(distractorPool).slice(0, 4);
      const choices = shuffleArray([correctUpper, ...distractors]);

      return {
        targetItem: target,
        article,
        wordOnly,
        chars: letters,
        missingIndex,
        missingChar,
        choices
      };
    });
  }, [items, shuffleKey]);

  // Generate Questions for Stage 7 (Buchstabenfolge - Consecutive Missing Letters)
  const stage6Questions = useMemo<MissingSeqQuestion[]>(() => {
    const shuffledTargets = shuffleArray<LernstudioItem>(items);
    return shuffledTargets.map((target: LernstudioItem) => {
      const { article, wordOnly } = splitGermanArticleAndWord(target.german);
      const len = wordOnly.length;
      let seqLen = 2;
      if (len >= 6) {
        seqLen = 3;
      } else if (len <= 2) {
        seqLen = Math.max(1, len);
      }

      const maxStart = Math.max(0, len - seqLen);
      const startIdx = Math.floor(Math.random() * (maxStart + 1));
      const missingIndices: number[] = [];
      for (let i = 0; i < seqLen; i++) {
        if (startIdx + i < len) {
          missingIndices.push(startIdx + i);
        }
      }

      const expectedChars = missingIndices.map((idx) => wordOnly[idx]);

      const expectedChoices: MissingSeqChoice[] = expectedChars.map((ch, idx) => ({
        id: `exp_${idx}_${ch.toUpperCase()}_${Math.random().toString(36).substr(2, 4)}`,
        char: ch.toUpperCase()
      }));

      const expCharSet = new Set(expectedChars.map((c) => c.toUpperCase()));
      const distractorPool = GERMAN_DISTRACTOR_LETTERS.filter((c) => !expCharSet.has(c));
      const distractorChars = shuffleArray(distractorPool).slice(0, 3);
      const distractorChoices: MissingSeqChoice[] = distractorChars.map((ch, idx) => ({
        id: `dist_${idx}_${ch}_${Math.random().toString(36).substr(2, 4)}`,
        char: ch
      }));

      const choices = shuffleArray([...expectedChoices, ...distractorChoices]);

      return {
        targetItem: target,
        article,
        wordOnly,
        chars: wordOnly.split(''),
        missingIndices,
        expectedChars,
        choices
      };
    });
  }, [items, shuffleKey]);

  // Generate Questions for Stage 8 (Wort vervollständigen - Complete the Word)
  const stage7Questions = useMemo<WordCompleteQuestion[]>(() => {
    const shuffledTargets = shuffleArray<LernstudioItem>(items);
    return shuffledTargets.map((target: LernstudioItem) => {
      const { article, wordOnly } = splitGermanArticleAndWord(target.german);
      const targetChars = wordOnly.split('');
      const choices: WordCompleteChoice[] = shuffleArray(
        targetChars.map((ch, idx) => ({
          id: `w7_${idx}_${ch.toUpperCase()}_${Math.random().toString(36).substr(2, 4)}`,
          char: ch.toUpperCase()
        }))
      );

      return {
        targetItem: target,
        article,
        wordOnly,
        targetChars,
        choices
      };
    });
  }, [items, shuffleKey]);

  // Stage 5 (Silben zusammensetzen) interactive state
  const [syllableStepIndex, setSyllableStepIndex] = useState<number>(0);
  const [filledSyllables, setFilledSyllables] = useState<string[]>([]);
  const [usedSyllableChoiceIds, setUsedSyllableChoiceIds] = useState<string[]>([]);
  const [errorSyllableChoiceId, setErrorSyllableChoiceId] = useState<string | null>(null);

  // Stage 7 interactive state
  const [stage6StepIndex, setStage6StepIndex] = useState<number>(0);
  const [stage6FilledChars, setStage6FilledChars] = useState<Record<number, string>>({});
  const [stage6UsedChoiceIds, setStage6UsedChoiceIds] = useState<string[]>([]);
  const [stage6ErrorChoiceId, setStage6ErrorChoiceId] = useState<string | null>(null);

  // Stage 8 interactive state
  const [stage7CurrentSlotIndex, setStage7CurrentSlotIndex] = useState<number>(0);
  const [stage7FilledChars, setStage7FilledChars] = useState<string[]>([]);
  const [stage7UsedChoiceIds, setStage7UsedChoiceIds] = useState<string[]>([]);
  const [stage7ErrorChoiceId, setStage7ErrorChoiceId] = useState<string | null>(null);

  // Auto-speak word whenever item or question changes across vocab teach stages
  useEffect(() => {
    if (!isOpen || teachViewMode !== 'vocab' || !items || items.length === 0) return;

    if (currentStage === 2) {
      stopGermanSpeech();
      return;
    }

    if (!soundEnabled) return;

    let textToSpeak = '';
    if (currentStage === 1 && items[stageQuestionIndex]) {
      textToSpeak = buildTeacherStudySpeechText(items[stageQuestionIndex]);
    } else if (currentStage === 3 && stage3Questions[stageQuestionIndex]) {
      textToSpeak = stage3Questions[stageQuestionIndex].targetItem.german;
    } else if (currentStage === 4 && stage4Questions[stageQuestionIndex]) {
      textToSpeak = stage4Questions[stageQuestionIndex].targetItem.german;
    } else if (currentStage === 5 && syllableQuestions[stageQuestionIndex]) {
      textToSpeak = syllableQuestions[stageQuestionIndex].targetItem.german;
    } else if (currentStage === 6 && stage5Questions[stageQuestionIndex]) {
      textToSpeak = stage5Questions[stageQuestionIndex].targetItem.german;
    } else if (currentStage === 7 && stage6Questions[stageQuestionIndex]) {
      textToSpeak = stage6Questions[stageQuestionIndex].targetItem.german;
    } else if (currentStage === 8 && stage7Questions[stageQuestionIndex]) {
      textToSpeak = stage7Questions[stageQuestionIndex].targetItem.german;
    }

    if (textToSpeak) {
      const timer = setTimeout(() => {
        handleSpeakGerman(textToSpeak);
      }, 300);
      return () => {
        clearTimeout(timer);
        stopGermanSpeech();
      };
    }
  }, [
    currentStage,
    stageQuestionIndex,
    items,
    isOpen,
    soundEnabled,
    stage2Questions,
    stage3Questions,
    stage4Questions,
    syllableQuestions,
    stage5Questions,
    stage6Questions,
    stage7Questions
  ]);

  // Reset answer state when question index or stage changes
  const resetAnswerState = () => {
    clearAutoAdvanceTimer();
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setIsCorrectAnswer(null);
    setFeedbackMessage('');
    setIsSpeakingFeedback(false);
    setSyllableStepIndex(0);
    setFilledSyllables([]);
    setUsedSyllableChoiceIds([]);
    setErrorSyllableChoiceId(null);
    setStage6StepIndex(0);
    setStage6FilledChars({});
    setStage6UsedChoiceIds([]);
    setStage6ErrorChoiceId(null);
    setStage7CurrentSlotIndex(0);
    setStage7FilledChars([]);
    setStage7UsedChoiceIds([]);
    setStage7ErrorChoiceId(null);
  };

  // Plays success chime, shows progress, and advances to the next question without repeating pronunciation
  const handleCorrectAnswerAdvance = (advanceCallback: () => void) => {
    setIsSpeakingFeedback(false);
    clearAutoAdvanceTimer();

    if (soundEnabled) {
      playLernstudioSound('correct');
    }

    // Wait a brief pleasant moment ("يستنى شوية") then advance
    autoAdvanceTimerRef.current = setTimeout(() => {
      advanceCallback();
      // Next question's useEffect will automatically trigger and pronounce the next word if sound is enabled
    }, 1100);
  };

  // Stage Transitions
  const handleNextStage = (nextStageNum: number) => {
    clearAutoAdvanceTimer();
    const updatedCompleted = Array.from(new Set([...completedStages, currentStage]));
    setCompletedStages(updatedCompleted);
    setCurrentStage(nextStageNum);
    setStageQuestionIndex(0);
    resetAnswerState();
    setShuffleKey((k) => k + 1);
    saveProgress(nextStageNum, 0, updatedCompleted, stars + 2);
  };

  // --- Handlers for Stage 1 (Showcase) ---
  const handleStage1Next = () => {
    if (stageQuestionIndex + 1 < items.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      saveProgress(1, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 1 -> move to Stage 2 automatically
      handleNextStage(2);
    }
  };

  const handleStage1Prev = () => {
    if (stageQuestionIndex > 0) {
      const prevIdx = stageQuestionIndex - 1;
      setStageQuestionIndex(prevIdx);
      saveProgress(1, prevIdx, completedStages, stars);
    }
  };

  // --- Handlers for Stage 2 (True / False) ---
  const handleStage2NextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < stage2Questions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(2, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 2 -> move to Stage 3
      handleNextStage(3);
    }
  };

  const handleStage2Answer = (userChoice: boolean) => {
    if (isAnswerSubmitted) return;
    const currentQ = stage2Questions[stageQuestionIndex];
    const correct = userChoice === currentQ.isMatch;

    setSelectedAnswer(userChoice);
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(correct);

    if (correct) {
      setStars((prev) => prev + 100);
      setFeedbackMessage('ممتاز! إجابة صحيحة +100 💰 🌟');
      // Advance to next question without repeating pronunciation
      handleCorrectAnswerAdvance(handleStage2NextQuestion);
    } else {
      recordWrongItem(currentQ.targetItem);
      setStars((prev) => Math.max(0, prev - 50));
      if (soundEnabled) {
        playLernstudioSound('wrong');
      }
      setFeedbackMessage(
        `إجابة خاطئة (-50 💰)! الإجابة الصحيحة هي: الكلمة ${
          currentQ.isMatch ? 'مطابقة بالفعل' : 'غير مطابقة'
        } (${currentQ.targetItem.german} = ${currentQ.targetItem.arabic})`
      );
    }
  };

  // --- Handlers for Stage 3 (2 Choices) ---
  const handleStage3NextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < stage3Questions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(3, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 3 -> move to Stage 4
      handleNextStage(4);
    }
  };

  const handleStage3Answer = (chosenItem: LernstudioItem) => {
    if (isAnswerSubmitted) return;
    const currentQ = stage3Questions[stageQuestionIndex];
    const correct = chosenItem.id === currentQ.targetItem.id;

    setSelectedAnswer(chosenItem.id);
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(correct);

    if (correct) {
      setStars((prev) => prev + 100);
      setFeedbackMessage('رائع جداً! إجابة صحيحة +100 💰 👏');
      // Advance to next question without repeating pronunciation
      handleCorrectAnswerAdvance(handleStage3NextQuestion);
    } else {
      recordWrongItem(currentQ.targetItem);
      setStars((prev) => Math.max(0, prev - 50));
      if (soundEnabled) {
        playLernstudioSound('wrong');
        handleSpeakGerman(currentQ.targetItem.german);
      }
      setFeedbackMessage(
        `اختيار خاطئ (-50 💰)! الاختيار الصحيح هو: ${currentQ.targetItem.german} (${currentQ.targetItem.arabic})`
      );
    }
  };

  // --- Handlers for Stage 4 (Full Set Choices) ---
  const handleStage4NextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < stage4Questions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(4, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 4 -> move to Stage 5 (Silben zusammensetzen)
      handleNextStage(5);
    }
  };

  const handleStage4Answer = (chosenItem: LernstudioItem) => {
    if (isAnswerSubmitted) return;
    const currentQ = stage4Questions[stageQuestionIndex];
    const correct = chosenItem.id === currentQ.targetItem.id;

    setSelectedAnswer(chosenItem.id);
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(correct);

    if (correct) {
      setStars((prev) => prev + 100);
      setFeedbackMessage('بطل! إجابة صحيحة +100 💰 🌟');
      // Advance to next question without repeating pronunciation
      handleCorrectAnswerAdvance(handleStage4NextQuestion);
    } else {
      recordWrongItem(currentQ.targetItem);
      setStars((prev) => Math.max(0, prev - 50));
      if (soundEnabled) {
        playLernstudioSound('wrong');
        handleSpeakGerman(currentQ.targetItem.german);
      }
      setFeedbackMessage(
        `إجابة خاطئة (-50 💰)! الإجابة الصحيحة هي: ${currentQ.targetItem.german} (${currentQ.targetItem.arabic})`
      );
    }
  };

  // --- Handlers for Stage 5 (Silben zusammensetzen - Syllable Puzzle) ---
  const handleSyllableNextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < syllableQuestions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(5, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 5 -> move to Stage 6 (Fehlender Buchstabe)
      handleNextStage(6);
    }
  };

  const handleSyllableChoiceClick = (choice: SyllableChoice) => {
    if (usedSyllableChoiceIds.includes(choice.id) || isAnswerSubmitted) return;
    const currentQ = syllableQuestions[stageQuestionIndex];
    if (!currentQ) return;

    const expectedSyllable = currentQ.expectedSyllables[syllableStepIndex];
    if (!expectedSyllable) return;

    const isMatch = choice.syllable === expectedSyllable;

    if (isMatch) {
      const nextStepIndex = syllableStepIndex + 1;
      const nextUsedIds = [...usedSyllableChoiceIds, choice.id];
      const nextFilled = [...filledSyllables, choice.syllable];

      setUsedSyllableChoiceIds(nextUsedIds);
      setFilledSyllables(nextFilled);
      setSyllableStepIndex(nextStepIndex);
      setErrorSyllableChoiceId(null);

      if (nextStepIndex >= currentQ.expectedSyllables.length) {
        // Completed all syllables!
        setIsAnswerSubmitted(true);
        setIsCorrectAnswer(true);
        setStars((prev) => prev + 100);
        setFeedbackMessage('ممتاز! تم تركيب المقاطع الصوتية بنجاح +100 💰 🧩🌟');
        handleCorrectAnswerAdvance(handleSyllableNextQuestion);
      } else {
        if (soundEnabled) {
          playLernstudioSound('correct');
        }
      }
    } else {
      // Incorrect choice — first wrong pick locks the question (no full-credit retry)
      recordWrongItem(currentQ.targetItem);
      setStars((prev) => Math.max(0, prev - 25));
      if (soundEnabled) {
        playLernstudioSound('wrong');
      }
      setErrorSyllableChoiceId(choice.id);
      setTimeout(() => setErrorSyllableChoiceId(null), 600);
      setIsAnswerSubmitted(true);
      setIsCorrectAnswer(false);
      setFeedbackMessage(
        `مقطع غير مطابق (-25 💰)! الكلمة الصحيحة هي: ${currentQ.targetItem.german} (${currentQ.targetItem.arabic})`
      );
    }
  };

  // --- Handlers for Stage 6 (One Missing Letter) ---
  const handleStage5NextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < stage5Questions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(6, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 6 -> move to Stage 7 (Buchstabenfolge)
      handleNextStage(7);
    }
  };

  const handleStage5Answer = (selectedChar: string) => {
    if (isAnswerSubmitted) return;
    const currentQ = stage5Questions[stageQuestionIndex];
    const isCorrect = selectedChar.toUpperCase() === currentQ.missingChar.toUpperCase();

    setSelectedAnswer(selectedChar);
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(isCorrect);

    if (isCorrect) {
      setStars((prev) => prev + 100);
      setFeedbackMessage('ممتاز! تم إكمال الحرف الناقص بنجاح +100 💰 🌟');
      handleCorrectAnswerAdvance(handleStage5NextQuestion);
    } else {
      recordWrongItem(currentQ.targetItem);
      setStars((prev) => Math.max(0, prev - 50));
      if (soundEnabled) {
        playLernstudioSound('wrong');
        handleSpeakGerman(currentQ.targetItem.german);
      }
      setFeedbackMessage(`إجابة خاطئة (-50 💰)! الحرف الصحيح هو: "${currentQ.missingChar.toUpperCase()}"`);
    }
  };

  // --- Handlers for Stage 7 (Consecutive Missing Letters) ---
  const handleStage6NextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < stage6Questions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(7, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 7 -> move to Stage 8 (Wort vervollständigen)
      handleNextStage(8);
    }
  };

  const handleStage6ChoiceClick = (choice: MissingSeqChoice) => {
    if (stage6UsedChoiceIds.includes(choice.id) || isAnswerSubmitted) return;
    const currentQ = stage6Questions[stageQuestionIndex];
    const expectedChar = currentQ.expectedChars[stage6StepIndex];

    if (!expectedChar) return;

    const isMatch = choice.char.toUpperCase() === expectedChar.toUpperCase();

    if (isMatch) {
      const nextStepIndex = stage6StepIndex + 1;
      const nextUsedIds = [...stage6UsedChoiceIds, choice.id];
      const targetMissingIndex = currentQ.missingIndices[stage6StepIndex];
      const nextFilled = { ...stage6FilledChars, [targetMissingIndex]: expectedChar };

      setStage6UsedChoiceIds(nextUsedIds);
      setStage6FilledChars(nextFilled);
      setStage6StepIndex(nextStepIndex);
      setStage6ErrorChoiceId(null);

      if (nextStepIndex >= currentQ.expectedChars.length) {
        // Completed sequence!
        setIsAnswerSubmitted(true);
        setIsCorrectAnswer(true);
        setStars((prev) => prev + 100);
        setFeedbackMessage('رائع جدًا! اكتملت الحروف المتتالية بنجاح +100 💰 🧩');
        handleCorrectAnswerAdvance(handleStage6NextQuestion);
      } else {
        if (soundEnabled) {
          playLernstudioSound('correct');
        }
      }
    } else {
      // Incorrect choice — first wrong pick locks the question (no full-credit retry)
      recordWrongItem(currentQ.targetItem);
      setStars((prev) => Math.max(0, prev - 25));
      if (soundEnabled) {
        playLernstudioSound('wrong');
      }
      setStage6ErrorChoiceId(choice.id);
      setTimeout(() => setStage6ErrorChoiceId(null), 600);
      setIsAnswerSubmitted(true);
      setIsCorrectAnswer(false);
      setFeedbackMessage(
        `حرف غير مطابق (-25 💰)! الكلمة الصحيحة هي: ${currentQ.targetItem.german} (${currentQ.targetItem.arabic})`
      );
    }
  };

  // --- Handlers for Stage 8 (Complete the Word) ---
  const handleStage7NextQuestion = () => {
    clearAutoAdvanceTimer();
    if (stageQuestionIndex + 1 < stage7Questions.length) {
      const nextIdx = stageQuestionIndex + 1;
      setStageQuestionIndex(nextIdx);
      resetAnswerState();
      saveProgress(8, nextIdx, completedStages, stars);
    } else {
      // Finished Stage 8 -> move to Stage 9 (Spiele)
      handleNextStage(9);
    }
  };

  const handleStage7ChoiceClick = (choice: WordCompleteChoice) => {
    if (stage7UsedChoiceIds.includes(choice.id) || isAnswerSubmitted) return;
    const currentQ = stage7Questions[stageQuestionIndex];
    const expectedChar = currentQ.targetChars[stage7CurrentSlotIndex];

    if (!expectedChar) return;

    const isMatch = choice.char.toUpperCase() === expectedChar.toUpperCase();

    if (isMatch) {
      const nextSlotIndex = stage7CurrentSlotIndex + 1;
      const nextUsedIds = [...stage7UsedChoiceIds, choice.id];
      const nextFilled = [...stage7FilledChars, expectedChar];

      setStage7UsedChoiceIds(nextUsedIds);
      setStage7FilledChars(nextFilled);
      setStage7CurrentSlotIndex(nextSlotIndex);
      setStage7ErrorChoiceId(null);

      if (nextSlotIndex >= currentQ.targetChars.length) {
        // Completed full word!
        setIsAnswerSubmitted(true);
        setIsCorrectAnswer(true);
        setStars((prev) => prev + 200);
        setFeedbackMessage('عبقري! تم كِتابة الكلمة كاملة بالترتيب الصحيح +200 💰 ✍️🌟');
        handleCorrectAnswerAdvance(handleStage7NextQuestion);
      } else {
        if (soundEnabled) {
          playLernstudioSound('correct');
        }
      }
    } else {
      // Incorrect choice — first wrong pick locks the question (no full-credit retry)
      recordWrongItem(currentQ.targetItem);
      setStars((prev) => Math.max(0, prev - 25));
      if (soundEnabled) {
        playLernstudioSound('wrong');
      }
      setStage7ErrorChoiceId(choice.id);
      setTimeout(() => setStage7ErrorChoiceId(null), 600);
      setIsAnswerSubmitted(true);
      setIsCorrectAnswer(false);
      setFeedbackMessage(
        `حرف غير مطابق (-25 💰)! الكلمة الصحيحة هي: ${currentQ.targetItem.german} (${currentQ.targetItem.arabic})`
      );
    }
  };

  // Stage Stepper Configuration
  const stagesList = useMemo(() => {
    if (language === 'de') {
      return [
        { num: 1, title: '1. Lernen', icon: '📖', desc: 'Vokabeln & Wiederholung' },
        { num: 2, title: '2. Richtig / Falsch', icon: '✔️', desc: 'Einfaches Zuordnen' },
        { num: 3, title: '3. Zwei Optionen', icon: '✌️', desc: 'Auswahl aus zwei Optionen' },
        { num: 4, title: '4. Alle Wörter', icon: '🎯', desc: 'Gesamten Wortschatz üben' },
        { num: 5, title: '5. Silben zusammensetzen', icon: '🧩', desc: 'Silben in richtiger Reihenfolge' },
        { num: 6, title: '6. Fehlender Buchstabe', icon: '🔤', desc: 'Ein fehlender Buchstabe' },
        { num: 7, title: '7. Buchstabenfolge', icon: '🔡', desc: 'Aufeinanderfolgende Buchstaben' },
        { num: 8, title: '8. Wort vervollständigen', icon: '✍️', desc: 'Ganzes Wort vervollständigen' },
        { num: 9, title: '9. Spiele', icon: '🏆', desc: 'Glückwunsch & Spiele' }
      ];
    } else if (language === 'en') {
      return [
        { num: 1, title: '1. Learning', icon: '📖', desc: 'Vocabulary & repetition' },
        { num: 2, title: '2. True / False', icon: '✔️', desc: 'Simple matching practice' },
        { num: 3, title: '3. Two Options', icon: '✌️', desc: 'Choose from two choices' },
        { num: 4, title: '4. All Words', icon: '🎯', desc: 'Practice all vocabulary' },
        { num: 5, title: '5. Syllable Puzzle', icon: '🧩', desc: 'Assemble syllables in order' },
        { num: 6, title: '6. One Missing Letter', icon: '🔤', desc: 'Find 1 missing letter' },
        { num: 7, title: '7. Missing Sequence', icon: '🔡', desc: 'Find consecutive letters' },
        { num: 8, title: '8. Complete Word', icon: '✍️', desc: 'Spell full word' },
        { num: 9, title: '9. Games', icon: '🏆', desc: 'Congratulations & games' }
      ];
    }
    return [
      { num: 1, title: '١. التعلم', icon: '📖', desc: 'عرض الكلمات والتكرار' },
      { num: 2, title: '٢. صح أم غلط', icon: '✔️', desc: 'تمرين المطابقة البسيط' },
      { num: 3, title: '٣. إجابتين', icon: '✌️', desc: 'الاختيار من إجابتين' },
      { num: 4, title: '٤. كل الكلمات', icon: '🎯', desc: 'الاختيار من كل المجموعة' },
      { num: 5, title: '٥. تركيب المقاطع', icon: '🧩', desc: 'تركيب المقاطع الصوتية بالترتيب' },
      { num: 6, title: '٦. حرف ناقص', icon: '🔤', desc: 'تحديد الحرف الناقص الواحد' },
      { num: 7, title: '٧. حروف متتالية', icon: '🔡', desc: 'تحديد الحروف المتتالية الناقصة' },
      { num: 8, title: '٨. إكمال الكلمة', icon: '✍️', desc: 'تركيب الكلمة كاملة بالترتيب' },
      { num: 9, title: '٩. الألعاب', icon: '🏆', desc: 'تهانينا واختيار اللعبة' }
    ];
  }, [language]);

  const resetGrammarExerciseState = () => {
    setGrammarUserAnswer('');
    setGrammarOrderTokens([]);
    setGrammarHintVisible(false);
    setGrammarAnswerRevealed(false);
    setGrammarFeedback(null);
    setGrammarSubmitted(false);
  };

  const handleCheckGrammarPractice = () => {
    const currentEx = grammarExercises[grammarExIndex];
    if (!currentEx) return;
    // First Check locks the exercise: no re-check farming, no retry after wrong.
    if (grammarSubmitted || grammarFeedback?.isCorrect) return;
    const candidate =
      currentEx.type === 'sentence_ordering' && grammarOrderTokens.length > 0
        ? grammarOrderTokens.join(' ')
        : grammarUserAnswer;
    if (!candidate.trim()) return;
    setGrammarSubmitted(true);

    const ok = evaluateNormalizedGrammarAnswer(candidate, {
      correctAnswer: currentEx.correctAnswer,
      acceptedAnswers: currentEx.acceptedAnswers
    });

    if (soundEnabled) {
      playLernstudioSound(ok ? 'correct' : 'wrong');
    }

    setGrammarScore((prev) => ({
      correct: prev.correct + (ok ? 1 : 0),
      totalAttempted: prev.totalAttempted + 1
    }));

    if (ok) {
      setStars((s) => s + 100);
      setGrammarFeedback({
        isCorrect: true,
        message: isRtl
          ? `أحسنت! إجابة صحيحة (+100 💰): ${currentEx.correctAnswer}`
          : `Richtig! (+100 💰): ${currentEx.correctAnswer}`
      });
    } else {
      setGrammarFeedback({
        isCorrect: false,
        message: isRtl
          ? 'إجابة خاطئة. يمكنك عرض التلميح أو الانتقال للتمرين التالي.'
          : 'Falsche Antwort. Du kannst den Hinweis anzeigen oder zur nächsten Übung gehen.'
      });
    }
  };

  const compatibleGrammarGames = useMemo(() => {
    if (!set) return [];
    const modes: { mode: LernstudioGameMode; icon: string; title: string }[] = [
      { mode: 'wheel', icon: '🎡', title: t.wheelGameTitle },
      { mode: 'race', icon: '🏎️', title: t.raceGameTitle },
      { mode: 'sentence_builder', icon: '📝', title: t.teamSentenceTitle },
      { mode: 'solo_sentence', icon: '🧩', title: t.soloSentenceTitle },
      { mode: 'memory', icon: '🧠', title: t.memoryGameTitle },
      { mode: 'tictactoe', icon: '❌⭕', title: t.tictactoeTitle },
      { mode: 'tug_of_war', icon: '🪢', title: t.tugOfWarTitle },
      { mode: 'balloon_pop', icon: '🎈', title: t.balloonPopTitle },
      { mode: 'sorting', icon: '📦', title: t.sortingGameTitle }
    ];
    return modes.map((m) => ({
      ...m,
      compat: getGameCompatibilityForSet(m.mode, set, language)
    }));
  }, [set, language, t]);

  if (!isOpen || !set || (!vocabAvailable && !grammarAvailable)) return null;

  const gc = set.grammarContent;
  const grammarRules = gc?.rules || [];
  const grammarExamples = gc?.examples || [];
  const currentGrammarEx = grammarExercises[grammarExIndex];

  return (
    <div
      // No min-h-[100dvh]: this page renders INSIDE App's mobile shell
      // (Header + scroll area + floating BottomNav) and inside the desktop
      // scroll canvas, both of which already size the viewport. Forcing a
      // full viewport height here made the page taller than the screen, so
      // the question card was centred in an oversized box (huge empty gap
      // above it) and the footer/feedback banner fell below the fold behind
      // the BottomNav + FAB. Height = content; the outer shell scrolls.
      className="w-full max-w-4xl mx-auto flex flex-col bg-surface min-h-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
        {/* Header */}
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between bg-surface shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-text-main truncate">
                  {t.teachModeTitle} - {displaySetTitle}
                </h2>
              </div>
              <p className="text-xs text-text-muted truncate">
                {set.topic}
                {vocabAvailable ? ` · ${items.length} ${t.vocabularyCount}` : ''}
                {grammarAvailable ? ` · ${grammarRules.length} ${t.grammarRulesCount} · ${grammarExercises.length} ${t.grammarExercisesCount}` : ''}
                <span className="font-bold text-amber-500 inline-flex items-center gap-1 shrink-0"> · 💰 {stars}<Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSoundEnabled((prev) => {
                  const next = !prev;
                  if (!next) {
                    stopGermanSpeech();
                  }
                  return next;
                });
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                soundEnabled
                  ? 'text-primary bg-primary/10 hover:bg-primary/20'
                  : 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
              }`}
              title={soundEnabled ? 'كتم الصوت' : 'تفعيل النطق'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setStageQuestionIndex(0);
                resetAnswerState();
                setShuffleKey((k) => k + 1);
              }}
              className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              title="خلط الأسئلة"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetProgress}
              className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              title="إعادة التقدّم من البداية"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
              title={isRtl ? 'العودة للمجموعات' : 'Back to sets'}
            >
              <ChevronRight className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              <span>{isRtl ? 'المجموعات' : 'Sets'}</span>
            </button>
          </div>
        </div>

        {/* Mode Switcher Bar (for Mixed Sets with both Vocabulary & Grammar) */}
        {vocabAvailable && grammarAvailable && (
          <div className="px-3 py-2 bg-surface border-b border-surface-border grid grid-cols-2 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setTeachViewMode('vocab')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                teachViewMode === 'vocab'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-surface-hover text-text-muted hover:text-text-main'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t.vocabTeachingTab} ({items.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTeachViewMode('grammar')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                teachViewMode === 'grammar'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-surface-hover text-text-muted hover:text-text-main'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{t.grammarLessonTab} ({grammarRules.length})</span>
            </button>
          </div>
        )}

        {/* GRAMMAR LESSON MODE SUB-NAVIGATION */}
        {teachViewMode === 'grammar' && grammarAvailable ? (
          <>
            <div className="bg-surface-hover border-b border-surface-border px-2.5 py-2 shrink-0 grid grid-cols-4 gap-1.5">
              {[
                { id: 'rules' as const, label: t.grammarRulesOverviewTab, icon: <GraduationCap className="w-3.5 h-3.5" /> },
                { id: 'examples' as const, label: `${t.grammarExamplesTab} (${grammarExamples.length})`, icon: <BookOpen className="w-3.5 h-3.5" /> },
                { id: 'practice' as const, label: `${t.grammarPracticeTab} (${grammarExercises.length})`, icon: <HelpCircle className="w-3.5 h-3.5" /> },
                { id: 'games' as const, label: t.grammarGamesTab, icon: <Gamepad2 className="w-3.5 h-3.5" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setGrammarTab(tab.id)}
                  className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                    grammarTab === tab.id
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-surface text-text-muted hover:text-text-main border-surface-border'
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {/* GRAMMAR TAB 1: RULES & EXPLANATION */}
              {grammarTab === 'rules' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-primary">
                        {getLocalizedGrammarField(gc, 'lessonTitle', language) || displaySetTitle}
                      </h3>
                      {gc?.sourceBookInfo && (
                        <span className="text-[11px] font-bold text-text-muted">📚 {gc.sourceBookInfo}</span>
                      )}
                    </div>
                    {(gc?.explanationAr || gc?.explanationDe || gc?.explanationEn) && (
                      <p className="text-xs sm:text-sm text-text-main leading-relaxed whitespace-pre-line">
                        {getLocalizedGrammarField(gc, 'explanation', language)}
                      </p>
                    )}
                    {gc?.explanationDe && gc?.explanationAr && language !== 'de' && (
                      <p className="text-xs text-text-muted font-medium pt-1 border-t border-primary/10" dir="ltr">
                        🇩🇪 {gc.explanationDe}
                      </p>
                    )}
                  </div>

                  {grammarRules.map((rule, rIdx) => {
                    const ruleKey = rule.id || `rule_${rIdx}`;
                    const isCollapsed = Boolean(expandedRuleIds[ruleKey]);
                    return (
                      <div key={ruleKey} className="p-4 rounded-xl bg-surface border border-surface-border shadow-2xs space-y-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedRuleIds((prev) => ({ ...prev, [ruleKey]: !prev[ruleKey] }))}
                          className="w-full flex items-center justify-between gap-2 text-start cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center shrink-0">
                              {rIdx + 1}
                            </span>
                            <span className="text-sm font-black text-text-main">
                              {getLocalizedGrammarField(rule, 'title', language)}
                            </span>
                          </div>
                          {rule.pattern && (
                            <code dir="ltr" className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-mono font-bold shrink-0">
                              {rule.pattern}
                            </code>
                          )}
                        </button>

                        {!isCollapsed && (
                          <div className="space-y-2.5 pt-1">
                            <p className="text-xs sm:text-sm text-text-muted leading-relaxed whitespace-pre-line">
                              {getLocalizedGrammarField(rule, 'summary', language)}
                            </p>
                            {rule.table && rule.table.headers.length > 0 && (
                              <div className="overflow-x-auto rounded-lg border border-surface-border" dir="ltr">
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-surface-hover">
                                      {rule.table.headers.map((h, hIdx) => (
                                        <th key={hIdx} className="p-2 text-left font-black text-text-main border-b border-surface-border">
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rule.table.rows.map((row, rowIdx) => (
                                      <tr key={rowIdx} className="border-b border-surface-border/60 last:border-b-0">
                                        {row.map((cell, cIdx) => (
                                          <td key={cIdx} className="p-2 text-text-main font-semibold">
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {(rule.tipAr || rule.tipDe) && (
                              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                                <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{getLocalizedGrammarField(rule, 'tip', language)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* GRAMMAR TAB 2: BILINGUAL EXAMPLES */}
              {grammarTab === 'examples' && (
                <div className="space-y-2.5">
                  {grammarExamples.length === 0 ? (
                    <div className="py-12 text-center text-xs text-text-muted">{t.noSetsFound}</div>
                  ) : (
                    grammarExamples.map((ex, eIdx) => (
                      <div key={ex.id || eIdx} className="p-3.5 rounded-xl bg-surface-hover/60 border border-surface-border flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-primary">#{eIdx + 1}</span>
                            <span className="text-sm sm:text-base font-bold text-text-main" dir="ltr">
                              {ex.german}
                            </span>
                            {ex.highlight && (
                              <span dir="ltr" className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                {ex.highlight}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted font-semibold">
                            {language === 'en' && ex.english ? ex.english : ex.arabic}
                          </p>
                          {(ex.noteAr || ex.noteDe) && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300">
                              💡 {language === 'de' ? ex.noteDe || ex.noteAr : ex.noteAr || ex.noteDe}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSpeakGerman(ex.german)}
                          className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all cursor-pointer shrink-0"
                          title={t.listenAudio}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* GRAMMAR TAB 3: INTERACTIVE PRACTICE */}
              {grammarTab === 'practice' && (
                <div className="space-y-4">
                  {!currentGrammarEx ? (
                    <div className="py-12 text-center text-xs text-text-muted">{t.noSetsFound}</div>
                  ) : (
                    <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border space-y-4 shadow-xs">
                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-text-muted">
                        <span>{t.questionProgress} {grammarExIndex + 1} / {grammarExercises.length}</span>
                        <span>✅ {grammarScore.correct} / {grammarScore.totalAttempted}</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-base sm:text-lg font-black text-text-main" dir="ltr">
                            {currentGrammarEx.question}
                          </h4>
                          <button
                            type="button"
                            onClick={() => handleSpeakGerman(currentGrammarEx.question)}
                            className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer shrink-0"
                            title={t.listenAudio}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                        {currentGrammarEx.prompt && (
                          <p className="text-xs sm:text-sm font-semibold text-text-muted">
                            {currentGrammarEx.prompt}
                          </p>
                        )}
                      </div>

                      {/* Options-based exercises (multiple_choice / choose_correct_sentence) */}
                      {(currentGrammarEx.type === 'multiple_choice' || currentGrammarEx.type === 'choose_correct_sentence') &&
                        Array.isArray(currentGrammarEx.options) &&
                        currentGrammarEx.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" dir="ltr">
                          {currentGrammarEx.options.map((opt, oIdx) => {
                            const selected = grammarUserAnswer === opt;
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                disabled={grammarSubmitted}
                                onClick={() => {
                                  setGrammarUserAnswer(opt);
                                  setGrammarFeedback(null);
                                }}
                                className={`p-3 rounded-xl border text-left text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                  selected
                                    ? 'bg-primary/15 border-primary text-primary'
                                    : 'bg-surface-hover/70 border-surface-border text-text-main hover:border-primary/40'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Sentence ordering chips */}
                      {currentGrammarEx.type === 'sentence_ordering' && Array.isArray(currentGrammarEx.tokens) && currentGrammarEx.tokens.length > 0 && (
                        <div className="space-y-3" dir="ltr">
                          <div className="min-h-[48px] p-3 rounded-xl bg-surface-hover border border-dashed border-surface-border flex flex-wrap gap-2 items-center">
                            {grammarOrderTokens.length === 0 ? (
                              <span className="text-xs text-text-muted">{t.arrangeWordsOrder}</span>
                            ) : (
                              grammarOrderTokens.map((tok, idx) => (
                                <button
                                  key={`${tok}_${idx}`}
                                  type="button"
                                  disabled={grammarSubmitted}
                                  onClick={() => {
                                    setGrammarOrderTokens((prev) => prev.filter((_, i) => i !== idx));
                                    setGrammarFeedback(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold cursor-pointer"
                                >
                                  {tok}
                                </button>
                              ))
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {currentGrammarEx.tokens.map((tok, idx) => (
                              <button
                                key={`${tok}_bank_${idx}`}
                                type="button"
                                disabled={grammarSubmitted}
                                onClick={() => {
                                  setGrammarOrderTokens((prev) => [...prev, tok]);
                                  setGrammarFeedback(null);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-text-main hover:border-primary cursor-pointer"
                              >
                                {tok}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Text input for fill_blank, correct_mistake, short_answer, or fallback */}
                      {!(
                        (currentGrammarEx.type === 'multiple_choice' || currentGrammarEx.type === 'choose_correct_sentence') &&
                        Array.isArray(currentGrammarEx.options) &&
                        currentGrammarEx.options.length > 0
                      ) &&
                        !(
                          currentGrammarEx.type === 'sentence_ordering' &&
                          Array.isArray(currentGrammarEx.tokens) &&
                          currentGrammarEx.tokens.length > 0
                        ) && (
                        <input
                          type="text"
                          dir="ltr"
                          disabled={grammarSubmitted}
                          value={grammarUserAnswer}
                          onChange={(e) => {
                            setGrammarUserAnswer(e.target.value);
                            setGrammarFeedback(null);
                          }}
                          placeholder="Deutsch Antwort eingeben..."
                          className="w-full p-3 rounded-xl bg-background border border-surface-border text-sm font-bold text-text-main focus:outline-none focus:border-primary"
                        />
                      )}

                      {/* Hint & Reveal Controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={grammarSubmitted}
                          onClick={handleCheckGrammarPractice}
                          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-black cursor-pointer"
                        >
                          {t.checkExerciseAnswer}
                        </button>
                        {(currentGrammarEx.explanationAr || currentGrammarEx.explanationDe) && (
                          <button
                            type="button"
                            onClick={() => setGrammarHintVisible((v) => !v)}
                            className="px-3 py-2 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer inline-flex items-center gap-1"
                          >
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                            <span>{grammarHintVisible ? t.hideHint : t.showHint}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setGrammarAnswerRevealed((v) => !v)}
                          className="px-3 py-2 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-primary" />
                          <span>{t.revealAnswer}</span>
                        </button>
                      </div>

                      {grammarHintVisible && (currentGrammarEx.explanationAr || currentGrammarEx.explanationDe) && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
                          💡 {language === 'de' ? currentGrammarEx.explanationDe || currentGrammarEx.explanationAr : currentGrammarEx.explanationAr || currentGrammarEx.explanationDe}
                        </div>
                      )}

                      {grammarAnswerRevealed && (
                        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-bold text-primary" dir="ltr">
                          ✓ {currentGrammarEx.correctAnswer}
                        </div>
                      )}

                      {grammarFeedback && (
                        <div
                          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                            grammarFeedback.isCorrect
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                          }`}
                        >
                          {grammarFeedback.isCorrect ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                          <span>{grammarFeedback.message}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* GRAMMAR TAB 4: COMPATIBLE GAMES */}
              {grammarTab === 'games' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-text-muted uppercase tracking-wider">
                    {t.recommendedGames}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {compatibleGrammarGames.map((g) => (
                      <button
                        key={g.mode}
                        type="button"
                        disabled={!g.compat.isPlayable || !onLaunchGame}
                        onClick={() => onLaunchGame && g.compat.isPlayable && onLaunchGame(g.mode)}
                        className={`p-3 rounded-xl border text-start transition-all flex items-center justify-between gap-2 ${
                          g.compat.isPlayable
                            ? 'bg-surface hover:bg-surface-hover border-surface-border hover:border-primary/40 cursor-pointer'
                            : 'bg-surface/40 border-surface-border/50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0">{g.icon}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-text-main truncate">{g.title}</div>
                            <div className="text-[10px] text-text-muted truncate">{g.compat.localizedReason}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          {g.compat.status === 'supported' ? t.startBtn : g.compat.status === 'adapted' ? t.adaptedForGrammar : t.unavailableBtn}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Grammar Footer */}
            <div className="px-5 py-3.5 border-t border-surface-border bg-surface flex items-center justify-between shrink-0 gap-2">
              {grammarTab === 'practice' && grammarExercises.length > 0 ? (
                <>
                  <button
                    type="button"
                    disabled={grammarExIndex === 0}
                    onClick={() => {
                      setGrammarExIndex((i) => Math.max(0, i - 1));
                      resetGrammarExerciseState();
                    }}
                    className="px-4 py-2 bg-surface-hover hover:bg-surface-border disabled:opacity-40 text-text-main rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <ChevronRight className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
                    <span>{t.prevSlide}</span>
                  </button>
                  <button
                    type="button"
                    disabled={grammarExIndex + 1 >= grammarExercises.length}
                    onClick={() => {
                      setGrammarExIndex((i) => Math.min(grammarExercises.length - 1, i + 1));
                      resetGrammarExerciseState();
                    }}
                    className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>{t.nextQuestionBtn}</span>
                    <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
                  </button>
                </>
              ) : (
                <div className="w-full flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      if (grammarTab === 'rules') setGrammarTab('examples');
                      else if (grammarTab === 'examples') setGrammarTab('practice');
                      else if (grammarTab === 'practice') setGrammarTab('games');
                      else onClose();
                    }}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black cursor-pointer"
                  >
                    {grammarTab === 'games' ? (isRtl ? 'العودة للمجموعات' : 'Back to sets') : t.nextSlide}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-surface-hover hover:bg-surface border border-surface-border text-text-muted rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {isRtl ? 'العودة للمجموعات' : 'Back to sets'}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
        {/* Stages Stepper Nav - Wraps to a second row on narrow phones so every tab stays tappable */}
        <div className="bg-surface-hover border-b border-surface-border px-2.5 py-2 shrink-0">
          <div className="flex flex-wrap gap-1 w-full">
            {stagesList.map((stg) => {
              const isActive = currentStage === stg.num;
              const isDone = completedStages.includes(stg.num);

              return (
                <button
                  key={stg.num}
                  type="button"
                  onClick={() => {
                    setCurrentStage(stg.num);
                    setStageQuestionIndex(0);
                    resetAnswerState();
                    setShuffleKey((k) => k + 1);
                  }}
                  className={`flex items-center justify-center h-8 w-8 sm:h-9 sm:w-auto sm:flex-1 rounded-xl text-sm font-bold transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-primary text-white border-primary shadow-xs scale-[1.03]'
                      : isDone
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-surface text-text-muted hover:text-text-main border-surface-border'
                  }`}
                  title={`${stg.title} — ${stg.desc}`}
                  aria-label={stg.title}
                >
                  <span className="text-sm leading-none select-none">{isDone ? '✓' : stg.icon}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body — no nested scroll and no justify-between: the outer
            shell (PullToRefresh on mobile / main canvas on desktop) is the
            only scroller, and extra height here used to push the card down
            and the feedback banner below the fold. Content flows top to
            bottom with compact spacing on phones. */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-start text-center space-y-4 w-full">
          {/* ================= STAGE 1: Word Showcase & Auto Speech ================= */}
          {currentStage === 1 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-xl p-5 sm:p-8 space-y-4 shadow-xs relative">
                <span className="absolute top-4 right-4 text-xs font-bold text-text-muted">
                  كلمة {stageQuestionIndex + 1} من {items.length}
                </span>

                {/* Emoji Display */}
                <div className="text-7xl sm:text-8xl pt-2 select-none">
                  {renderTeachEmoji(items[stageQuestionIndex].emoji)}
                </div>

                {/* German Word */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <h3 className="text-2xl sm:text-5xl font-black text-text-main tracking-tight font-mono" dir="ltr">
                      {items[stageQuestionIndex].german}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleSpeakGerman(buildTeacherStudySpeechText(items[stageQuestionIndex]))}
                      className="p-2.5 bg-primary hover:bg-primary-hover text-white rounded-2xl shadow-md transition-all cursor-pointer inline-flex items-center justify-center active:scale-95"
                      title={t.listenAudio}
                    >
                      <Volume2 className="w-6 h-6" />
                    </button>
                  </div>

                  {items[stageQuestionIndex].plural && (
                    <p className="text-xs font-bold text-text-muted font-mono" dir="ltr">
                      Plural: <span className="text-text-main">{items[stageQuestionIndex].plural}</span>
                    </p>
                  )}
                </div>

                {/* Translation */}
                <div className="py-2 px-5 bg-surface rounded-2xl border border-surface-border inline-block shadow-2xs">
                  <span className="text-lg sm:text-xl font-black text-primary">
                    {getItemTranslation(items[stageQuestionIndex], language)}
                  </span>
                </div>

                {/* Verb Präsens Conjugation Grid (when item is a verb) */}
                {(() => {
                  const stageVerb = resolveVerbFromLernstudioItem(items[stageQuestionIndex]);
                  const conj = stageVerb?.praesens || items[stageQuestionIndex].conjugation;
                  if (!conj) return null;
                  return (
                    <div className="max-w-2xl mx-auto space-y-2 text-right">
                      {stageVerb && (
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
                            {stageVerb.level}
                          </span>
                          {stageVerb.classifications.map((cls) => (
                            <span
                              key={cls}
                              className="px-2 py-0.5 rounded-md bg-surface-hover border border-surface-border text-text-main text-[11px] font-semibold"
                            >
                              {cls}
                            </span>
                          ))}
                          {stageVerb.preposition && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-bold" dir="ltr">
                              +{stageVerb.preposition} ({stageVerb.prepositionCase || 'Akk/Dat'})
                            </span>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs" dir="ltr">
                        {[
                          ['ich (أنا)', conj.ich],
                          ['du (أنت)', conj.du],
                          ['er/sie/es', conj.er_sie_es],
                          ['wir (نحن)', conj.wir],
                          ['ihr (أنتم)', conj.ihr],
                          ['sie/Sie', conj.sie_Sie]
                        ].map(([pron, form]) => (
                          <div
                            key={pron}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-between gap-2"
                          >
                            <span className="text-[11px] text-text-muted font-semibold">{pron}</span>
                            <span className="font-bold text-text-main">{form}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Example Sentence */}
                {(items[stageQuestionIndex].exampleSentenceGerman || items[stageQuestionIndex].exampleSentenceArabic) && (
                  <div className="p-3.5 bg-surface/90 border border-surface-border rounded-2xl space-y-1 text-right max-w-2xl mx-auto">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                      جملة توضيحية:
                    </span>
                    {items[stageQuestionIndex].exampleSentenceGerman && (
                      <div className="text-xs font-bold text-text-main font-mono flex items-center justify-between gap-2" dir="ltr">
                        <span>{items[stageQuestionIndex].exampleSentenceGerman}</span>
                        <button
                          type="button"
                          onClick={() => handleSpeakGerman(items[stageQuestionIndex].exampleSentenceGerman!)}
                          className="p-1 bg-surface-hover hover:bg-primary-soft text-primary rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {items[stageQuestionIndex].exampleSentenceArabic && (
                      <div className="text-xs font-bold text-text-muted">
                        {items[stageQuestionIndex].exampleSentenceArabic}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 2: True / False ================= */}
          {currentStage === 2 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة الثانية: اختبار صح أم غلط</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {stage2Questions.length}
                  </span>
                </div>

                {/* Question Prompt */}
                <div className="space-y-3 py-2">
                  <div className="text-5xl sm:text-6xl select-none">
                    {renderTeachEmoji(stage2Questions[stageQuestionIndex].targetItem.emoji)}
                  </div>

                  <p className="text-xs sm:text-sm font-bold text-text-muted">
                    {language === 'de'
                      ? 'Passt die deutsche Übersetzung? Richtig oder Falsch?'
                      : language === 'en'
                      ? 'Does this German word match the meaning?'
                      : 'هل الترجمة الألمانية صحيحة أم خطأ؟'}
                  </p>

                  <div className="space-y-2 py-1">
                    <div
                      className="text-2xl sm:text-3xl font-black text-text-main leading-snug"
                      dir={language === 'ar' ? 'rtl' : 'ltr'}
                    >
                      {getItemTranslation(stage2Questions[stageQuestionIndex].targetItem, language)}
                    </div>
                    <div
                      className="text-2xl sm:text-3xl font-black text-primary leading-snug"
                      dir="ltr"
                    >
                      {stage2Questions[stageQuestionIndex].displayedItem.german}
                    </div>
                  </div>
                </div>

                {/* True / False Choice Buttons */}
                <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pt-2">
                  <button
                    type="button"
                    disabled={isAnswerSubmitted}
                    onClick={() => handleStage2Answer(true)}
                    className={`py-3.5 px-4 rounded-2xl text-base sm:text-lg font-black transition-all cursor-pointer flex items-center justify-center gap-2 border shadow-sm ${
                      isAnswerSubmitted && selectedAnswer === true
                        ? isCorrectAnswer
                          ? 'bg-emerald-500 text-white border-emerald-500 scale-105'
                          : 'bg-red-500 text-white border-red-500'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span>صح (Richtig)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isAnswerSubmitted}
                    onClick={() => handleStage2Answer(false)}
                    className={`py-3.5 px-4 rounded-2xl text-base sm:text-lg font-black transition-all cursor-pointer flex items-center justify-center gap-2 border shadow-sm ${
                      isAnswerSubmitted && selectedAnswer === false
                        ? isCorrectAnswer
                          ? 'bg-emerald-500 text-white border-emerald-500 scale-105'
                          : 'bg-red-500 text-white border-red-500'
                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
                    }`}
                  >
                    <XCircle className="w-6 h-6" />
                    <span>غلط (Falsch)</span>
                  </button>
                </div>

                {/* Feedback Message with Waiting Effect */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span>{feedbackMessage}</span>
                      {isCorrectAnswer && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 shadow-2xs">
                          <span>{language === 'ar' ? 'الانتقال للسؤال التالي...' : language === 'de' ? 'Nächste Frage...' : 'Next question...'}</span>
                          <span className="inline-flex items-center gap-0.5 mr-1">
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="w-1 h-3.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:150ms]" />
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse [animation-delay:300ms]" />
                          </span>
                        </span>
                      )}
                    </div>
                    {isCorrectAnswer && (
                      <div className="w-full bg-emerald-500/20 rounded-full h-1 mt-2.5 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full w-full animate-pulse" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 3: 2 Choices Multiple Choice ================= */}
          {currentStage === 3 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة الثالثة: الاختيار من إجابتين</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {stage3Questions.length}
                  </span>
                </div>

                {/* Target Item Display */}
                <div className="space-y-2 py-2">
                  <div className="text-6xl sm:text-7xl select-none">
                    {renderTeachEmoji(stage3Questions[stageQuestionIndex].targetItem.emoji)}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-text-main">
                    {getItemTranslation(stage3Questions[stageQuestionIndex].targetItem, language)}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">اختر الكلمة الألمانية المناسبة:</p>
                </div>

                {/* 2 Choice Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {stage3Questions[stageQuestionIndex].choices.map((choice) => {
                    const isSelected = selectedAnswer === choice.id;
                    const isTarget = choice.id === stage3Questions[stageQuestionIndex].targetItem.id;

                    let btnClass =
                      'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40';

                    if (isAnswerSubmitted) {
                      if (isTarget) {
                        btnClass = 'bg-emerald-500 text-white border-emerald-500 scale-[1.02] shadow-md';
                      } else if (isSelected && !isCorrectAnswer) {
                        btnClass = 'bg-red-500 text-white border-red-500';
                      } else {
                        btnClass = 'bg-surface/50 text-text-muted border-surface-border opacity-50';
                      }
                    }

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={isAnswerSubmitted}
                        onClick={() => handleStage3Answer(choice)}
                        className={`py-4 px-5 rounded-2xl text-lg font-black font-mono border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs ${btnClass}`}
                        dir="ltr"
                      >
                        <span>{choice.german}</span>
                        <Volume2
                          className="w-4 h-4 shrink-0 opacity-60 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeakGerman(choice.german);
                          }}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Message with Waiting Effect */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span>{feedbackMessage}</span>
                      {isCorrectAnswer ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 shadow-2xs">
                          <span>{language === 'ar' ? 'الانتقال للسؤال التالي...' : language === 'de' ? 'Nächste Frage...' : 'Next question...'}</span>
                          <span className="inline-flex items-center gap-0.5 mr-1">
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="w-1 h-3.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:150ms]" />
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse [animation-delay:300ms]" />
                          </span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSpeakGerman(stage3Questions[stageQuestionIndex].targetItem.german)}
                          className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300 font-bold bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded-full border border-red-500/30 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-red-500" />
                          <span>{language === 'ar' ? 'استمع لنطق الكلمة' : language === 'de' ? 'Aussprache anhören' : 'Listen to word'}</span>
                        </button>
                      )}
                    </div>
                    {isCorrectAnswer && (
                      <div className="w-full bg-emerald-500/20 rounded-full h-1 mt-2.5 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full w-full animate-pulse" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 4: Full Set Choice ================= */}
          {currentStage === 4 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة الرابعة: الاختيار من جميع كلمات الـ Set</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {stage4Questions.length}
                  </span>
                </div>

                {/* Target Item Display */}
                <div className="space-y-1 py-1">
                  <div className="text-5xl sm:text-6xl select-none">
                    {renderTeachEmoji(stage4Questions[stageQuestionIndex].targetItem.emoji)}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-text-main">
                    {getItemTranslation(stage4Questions[stageQuestionIndex].targetItem, language)}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">ابحث عن الكلمة الصحيحة بين جميع الخيارات:</p>
                </div>

                {/* All Options Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-xl mx-auto max-h-[300px] sm:max-h-[360px] overflow-y-auto p-2 border border-surface-border/40 rounded-2xl bg-surface-hover/20 scrollbar-thin">
                  {stage4Questions[stageQuestionIndex].choices.map((choice) => {
                    const isSelected = selectedAnswer === choice.id;
                    const isTarget = choice.id === stage4Questions[stageQuestionIndex].targetItem.id;

                    let btnClass =
                      'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40';

                    if (isAnswerSubmitted) {
                      if (isTarget) {
                        btnClass = 'bg-emerald-500 text-white border-emerald-500 scale-[1.02] shadow-md';
                      } else if (isSelected && !isCorrectAnswer) {
                        btnClass = 'bg-red-500 text-white border-red-500';
                      }
                    }

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={isAnswerSubmitted}
                        onClick={() => handleStage4Answer(choice)}
                        className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black font-mono border transition-all cursor-pointer flex items-center justify-center text-center gap-1.5 shadow-2xs ${btnClass}`}
                        dir="ltr"
                      >
                        <span className="truncate">{choice.german}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Message with Waiting Effect */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span>{feedbackMessage}</span>
                      {isCorrectAnswer ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 shadow-2xs">
                          <span>{language === 'ar' ? 'الانتقال للسؤال التالي...' : language === 'de' ? 'Nächste Frage...' : 'Next question...'}</span>
                          <span className="inline-flex items-center gap-0.5 mr-1">
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="w-1 h-3.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:150ms]" />
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse [animation-delay:300ms]" />
                          </span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSpeakGerman(stage4Questions[stageQuestionIndex].targetItem.german)}
                          className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300 font-bold bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded-full border border-red-500/30 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-red-500" />
                          <span>{language === 'ar' ? 'استمع لنطق الكلمة' : language === 'de' ? 'Aussprache anhören' : 'Listen to word'}</span>
                        </button>
                      )}
                    </div>
                    {isCorrectAnswer && (
                      <div className="w-full bg-emerald-500/20 rounded-full h-1 mt-2.5 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full w-full animate-pulse" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 5: Silben zusammensetzen (Syllable Puzzle) ================= */}
          {currentStage === 5 && syllableQuestions.length > 0 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة الخامسة: 🧩 Silben zusammensetzen (تركيب المقاطع)</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {syllableQuestions.length}
                  </span>
                </div>

                {/* Question Info */}
                <div className="space-y-2 py-1 text-center">
                  <div className="text-5xl sm:text-6xl select-none">
                    {renderTeachEmoji(syllableQuestions[stageQuestionIndex].targetItem.emoji)}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-text-main">
                    {getItemTranslation(syllableQuestions[stageQuestionIndex].targetItem, language)}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">
                    اختر المقاطع الصوتية بالترتيب الصحيح لتكوين الكلمة ({syllableStepIndex + 1} من {syllableQuestions[stageQuestionIndex].expectedSyllables.length}):
                  </p>

                  {/* Syllables Slot Display */}
                  <div className="pt-3 pb-1 flex items-center justify-center gap-2 font-mono text-xl sm:text-2xl font-black tracking-wider flex-wrap" dir="ltr">
                    {syllableQuestions[stageQuestionIndex].article && (
                      <span className="text-primary font-serif font-semibold text-xl sm:text-2xl mr-2">
                        {syllableQuestions[stageQuestionIndex].article}
                      </span>
                    )}
                    {syllableQuestions[stageQuestionIndex].expectedSyllables.map((syl, i) => {
                      const filledSyl = filledSyllables[i];
                      const isCurrentStepTarget = i === syllableStepIndex;

                      return (
                        <span
                          key={i}
                          className={`inline-flex items-center justify-center px-3.5 h-11 sm:h-13 min-w-[3.5rem] rounded-xl border-2 font-black transition-all ${
                            filledSyl
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs scale-105'
                              : isCurrentStepTarget
                              ? 'bg-amber-500/10 border-amber-500 border-dashed text-amber-500 animate-pulse scale-105'
                              : 'bg-surface-hover/50 border-dashed border-surface-border text-text-muted'
                          }`}
                        >
                          {filledSyl || '...'}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Syllable Choice Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md mx-auto pt-2">
                  {syllableQuestions[stageQuestionIndex].choices.map((choice) => {
                    const isUsed = usedSyllableChoiceIds.includes(choice.id);
                    const isError = errorSyllableChoiceId === choice.id;

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={isUsed || isAnswerSubmitted}
                        onClick={() => handleSyllableChoiceClick(choice)}
                        className={`px-4 h-12 sm:h-14 rounded-2xl text-lg sm:text-xl font-black font-mono border transition-all cursor-pointer flex items-center justify-center shadow-xs ${
                          isUsed
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 opacity-40 cursor-not-allowed'
                            : isError
                            ? 'bg-red-500 text-white border-red-500 animate-bounce'
                            : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40 active:scale-95'
                        }`}
                      >
                        {choice.syllable}
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Message */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span>{feedbackMessage}</span>
                      {isCorrectAnswer && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 shadow-2xs">
                          <span>{language === 'ar' ? 'الانتقال للسؤال التالي...' : language === 'de' ? 'Nächste Frage...' : 'Next question...'}</span>
                          <span className="inline-flex items-center gap-0.5 mr-1">
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="w-1 h-3.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:150ms]" />
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse [animation-delay:300ms]" />
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 6: Fehlender Buchstabe (One Missing Letter) ================= */}
          {currentStage === 6 && stage5Questions.length > 0 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة السادسة: 🔤 Fehlender Buchstabe (حرف ناقص واحد)</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {stage5Questions.length}
                  </span>
                </div>

                {/* Question Info */}
                <div className="space-y-2 py-1 text-center">
                  <div className="text-5xl sm:text-6xl select-none">
                    {renderTeachEmoji(stage5Questions[stageQuestionIndex].targetItem.emoji)}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-text-main">
                    {getItemTranslation(stage5Questions[stageQuestionIndex].targetItem, language)}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">
                    اختر الحرف المناسب لإكمال الكلمة بشكل صحيح:
                  </p>

                  {/* Word Slot Display */}
                  <div className="pt-3 pb-1 flex items-center justify-center gap-1.5 font-mono text-2xl sm:text-3xl font-black tracking-wider flex-wrap" dir="ltr">
                    {stage5Questions[stageQuestionIndex].article && (
                      <span className="text-primary font-serif font-semibold text-xl sm:text-2xl mr-2">
                        {stage5Questions[stageQuestionIndex].article}
                      </span>
                    )}
                    {stage5Questions[stageQuestionIndex].chars.map((char, i) => {
                      const isMissingSlot = i === stage5Questions[stageQuestionIndex].missingIndex;
                      if (isMissingSlot) {
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center justify-center w-9 h-11 sm:w-11 sm:h-13 rounded-xl border-2 border-dashed font-black transition-all ${
                              isAnswerSubmitted
                                ? isCorrectAnswer
                                  ? 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-md'
                                  : 'bg-red-500 text-white border-red-500'
                                : 'bg-primary/10 border-primary text-primary animate-pulse'
                            }`}
                          >
                            {isAnswerSubmitted ? (selectedAnswer || '?') : '_'}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center justify-center w-8 h-10 sm:w-10 sm:h-12 bg-surface-hover/80 text-text-main rounded-xl border border-surface-border"
                        >
                          {char}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Letter Choice Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-2">
                  {stage5Questions[stageQuestionIndex].choices.map((choiceChar, idx) => {
                    const isSelected = selectedAnswer === choiceChar;
                    const isTargetChar = choiceChar.toUpperCase() === stage5Questions[stageQuestionIndex].missingChar.toUpperCase();

                    let btnClass = 'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40';

                    if (isAnswerSubmitted) {
                      if (isTargetChar) {
                        btnClass = 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-md';
                      } else if (isSelected && !isCorrectAnswer) {
                        btnClass = 'bg-red-500 text-white border-red-500';
                      } else {
                        btnClass = 'bg-surface/40 text-text-muted border-surface-border opacity-40';
                      }
                    }

                    return (
                      <button
                        key={`${choiceChar}-${idx}`}
                        type="button"
                        disabled={isAnswerSubmitted}
                        onClick={() => handleStage5Answer(choiceChar)}
                        className={`w-11 h-12 sm:w-13 sm:h-14 rounded-2xl text-xl sm:text-2xl font-black font-mono border transition-all cursor-pointer flex items-center justify-center shadow-xs active:scale-95 ${btnClass}`}
                      >
                        {choiceChar}
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Message */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span>{feedbackMessage}</span>
                      {isCorrectAnswer ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 shadow-2xs">
                          <span>{language === 'ar' ? 'الانتقال للسؤال التالي...' : language === 'de' ? 'Nächste Frage...' : 'Next question...'}</span>
                          <span className="inline-flex items-center gap-0.5 mr-1">
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="w-1 h-3.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:150ms]" />
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse [animation-delay:300ms]" />
                          </span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSpeakGerman(stage5Questions[stageQuestionIndex].targetItem.german)}
                          className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300 font-bold bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded-full border border-red-500/30 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-red-500" />
                          <span>{language === 'ar' ? 'استمع لنطق الكلمة' : language === 'de' ? 'Aussprache anhören' : 'Listen to word'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 7: Buchstabenfolge (Consecutive Missing Letters) ================= */}
          {currentStage === 7 && stage6Questions.length > 0 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة السابعة: 🧩 Buchstabenfolge (حروف متتالية)</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {stage6Questions.length}
                  </span>
                </div>

                {/* Question Info */}
                <div className="space-y-2 py-1 text-center">
                  <div className="text-5xl sm:text-6xl select-none">
                    {renderTeachEmoji(stage6Questions[stageQuestionIndex].targetItem.emoji)}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-text-main">
                    {getItemTranslation(stage6Questions[stageQuestionIndex].targetItem, language)}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">
                    اختر الحروف المتتالية الناقصة بالتسلسل الصحيح ({stage6StepIndex + 1} من {stage6Questions[stageQuestionIndex].expectedChars.length}):
                  </p>

                  {/* Word Slot Display */}
                  <div className="pt-3 pb-1 flex items-center justify-center gap-1.5 font-mono text-2xl sm:text-3xl font-black tracking-wider flex-wrap" dir="ltr">
                    {stage6Questions[stageQuestionIndex].article && (
                      <span className="text-primary font-serif font-semibold text-xl sm:text-2xl mr-2">
                        {stage6Questions[stageQuestionIndex].article}
                      </span>
                    )}
                    {stage6Questions[stageQuestionIndex].chars.map((char, i) => {
                      const isMissingSlot = stage6Questions[stageQuestionIndex].missingIndices.includes(i);
                      const filledChar = stage6FilledChars[i];
                      const isCurrentStepTarget = stage6Questions[stageQuestionIndex].missingIndices[stage6StepIndex] === i;

                      if (isMissingSlot) {
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center justify-center w-9 h-11 sm:w-11 sm:h-13 rounded-xl border-2 font-black transition-all ${
                              filledChar
                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                                : isCurrentStepTarget
                                ? 'bg-amber-500/10 border-amber-500 border-dashed text-amber-500 animate-pulse scale-105'
                                : 'bg-surface-hover/50 border-dashed border-surface-border text-text-muted'
                            }`}
                          >
                            {filledChar || '_'}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center justify-center w-8 h-10 sm:w-10 sm:h-12 bg-surface-hover/80 text-text-main rounded-xl border border-surface-border"
                        >
                          {char}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Letter Choice Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-2">
                  {stage6Questions[stageQuestionIndex].choices.map((choice) => {
                    const isUsed = stage6UsedChoiceIds.includes(choice.id);
                    const isError = stage6ErrorChoiceId === choice.id;

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={isUsed || isAnswerSubmitted}
                        onClick={() => handleStage6ChoiceClick(choice)}
                        className={`w-11 h-12 sm:w-13 sm:h-14 rounded-2xl text-xl sm:text-2xl font-black font-mono border transition-all cursor-pointer flex items-center justify-center shadow-xs ${
                          isUsed
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 opacity-40 cursor-not-allowed'
                            : isError
                            ? 'bg-red-500 text-white border-red-500 animate-bounce'
                            : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40 active:scale-95'
                        }`}
                      >
                        {choice.char}
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Message */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span>{feedbackMessage}</span>
                      {isCorrectAnswer && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 shadow-2xs">
                          <span>{language === 'ar' ? 'الانتقال للسؤال التالي...' : language === 'de' ? 'Nächste Frage...' : 'Next question...'}</span>
                          <span className="inline-flex items-center gap-0.5 mr-1">
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="w-1 h-3.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:150ms]" />
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse [animation-delay:300ms]" />
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STAGE 8: Wort vervollständigen (Complete the Word) ================= */}
          {currentStage === 8 && stage7Questions.length > 0 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm relative">
                <div className="flex items-center justify-between text-xs font-bold text-text-muted">
                  <span>المرحلة الثامنة: ✍️ Wort vervollständigen (تركيب الكلمة كاملة)</span>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-black">
                    {stageQuestionIndex + 1} / {stage7Questions.length}
                  </span>
                </div>

                {/* Question Info */}
                <div className="space-y-2 py-1 text-center">
                  <div className="text-5xl sm:text-6xl select-none">
                    {renderTeachEmoji(stage7Questions[stageQuestionIndex].targetItem.emoji)}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-text-main">
                    {getItemTranslation(stage7Questions[stageQuestionIndex].targetItem, language)}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">
                    اختر حروف الكلمة بالترتيب من البداية وحتى النهاية:
                  </p>

                  {/* Word Slots for entire word */}
                  <div className="pt-3 pb-1 flex items-center justify-center gap-1.5 font-mono text-2xl sm:text-3xl font-black tracking-wider flex-wrap" dir="ltr">
                    {stage7Questions[stageQuestionIndex].article && (
                      <span className="text-primary font-serif font-semibold text-xl sm:text-2xl mr-2">
                        {stage7Questions[stageQuestionIndex].article}
                      </span>
                    )}
                    {stage7Questions[stageQuestionIndex].targetChars.map((_, slotIdx) => {
                      const filledChar = stage7FilledChars[slotIdx];
                      const isCurrentActive = stage7CurrentSlotIndex === slotIdx;

                      return (
                        <span
                          key={slotIdx}
                          className={`inline-flex items-center justify-center w-9 h-11 sm:w-11 sm:h-13 rounded-xl border-2 font-black transition-all ${
                            filledChar
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                              : isCurrentActive
                              ? 'bg-primary/10 border-primary border-dashed text-primary animate-pulse scale-105'
                              : 'bg-surface-hover/40 border-dashed border-surface-border text-text-muted'
                          }`}
                        >
                          {filledChar || '_'}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Letter Choice Buttons (No Distractors, exact set of letters) */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-2">
                  {stage7Questions[stageQuestionIndex].choices.map((choice) => {
                    const isUsed = stage7UsedChoiceIds.includes(choice.id);
                    const isError = stage7ErrorChoiceId === choice.id;

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={isUsed || isAnswerSubmitted}
                        onClick={() => handleStage7ChoiceClick(choice)}
                        className={`w-11 h-12 sm:w-13 sm:h-14 rounded-2xl text-xl sm:text-2xl font-black font-mono border transition-all cursor-pointer flex items-center justify-center shadow-xs ${
                          isUsed
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 opacity-40 cursor-not-allowed'
                            : isError
                            ? 'bg-red-500 text-white border-red-500 animate-bounce'
                            : 'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/40 active:scale-95'
                        }`}
                      >
                        {choice.char}
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Message */}
                {isAnswerSubmitted && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold animate-fade-in ${
                      isCorrectAnswer
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span>{feedbackMessage}</span>
                      {isCorrectAnswer && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 shadow-2xs">
                          <span>{language === 'ar' ? 'الانتقال لتهانينا والألعاب...' : language === 'de' ? 'Weiter zu Spielen...' : 'Proceed to Games...'}</span>
                          <span className="inline-flex items-center gap-0.5 mr-1">
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="w-1 h-3.5 bg-emerald-500 rounded-full animate-pulse [animation-delay:150ms]" />
                            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse [animation-delay:300ms]" />
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= Q25 RETRY ROUND: practice the wrong words only ================= */}
          {retryItems !== null && retryItems.length > 0 && (() => {
            const target = retryItems[retryIndex % retryItems.length];
            if (!target) return null;
            return (
              <div className="w-full space-y-5 flex-1 flex flex-col items-center justify-center py-2 animate-scale-up">
                <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-3xl text-center space-y-2 max-w-2xl w-full">
                  <p className="text-xs font-black text-sky-600 dark:text-sky-300">
                    🔁 جولة تدريب — الكلمات اللي غلطت فيها (تدريب بدون نقاط)
                  </p>
                  <p className="text-[11px] font-bold text-text-muted">
                    السؤال {retryIndex + 1} من {retryItems.length} · إجابتك هنا مش بتغيّر النجوم
                  </p>
                  <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all duration-300 rounded-full"
                      style={{ width: `${((retryIndex + 1) / Math.max(1, retryItems.length)) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="p-5 sm:p-6 bg-surface border border-surface-border rounded-3xl text-center space-y-3 max-w-2xl w-full shadow-xs">
                  <span className="text-3xl block">{target.emoji || '📚'}</span>
                  <h3 className="text-xl sm:text-2xl font-black text-text-main">{target.arabic}</h3>
                  <p className="text-xs font-bold text-primary">اختر الكلمة الألمانية الصحيحة:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1" dir="ltr">
                    {retryOptions.map((opt) => {
                      const isCorrectOpt = opt.id === target.id;
                      const isPicked = retrySelectedId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={retrySelectedId !== null}
                          onClick={() => handleRetryAnswer(opt)}
                          className={`p-4 rounded-2xl font-black text-base text-center transition-all border cursor-pointer font-mono ${
                            isPicked
                              ? retryFeedback?.isCorrect
                                ? 'bg-emerald-500 text-white border-emerald-600'
                                : 'bg-rose-500 text-white border-rose-600'
                              : retryFeedback !== null && !retryFeedback.isCorrect && isCorrectOpt
                              ? 'bg-emerald-500 text-white border-emerald-600'
                              : 'bg-surface hover:bg-surface-hover border-surface-border text-text-main'
                          }`}
                        >
                          {opt.german}
                          {retryFeedback !== null && !retryFeedback.isCorrect && isCorrectOpt ? ' ✓' : ''}
                        </button>
                      );
                    })}
                  </div>

                  {retryFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs font-black ${
                        retryFeedback.isCorrect
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {retryFeedback.message}
                    </div>
                  )}

                  {retryFeedback && !retryFeedback.isCorrect && (
                    <button
                      type="button"
                      onClick={advanceRetry}
                      className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs shadow-md cursor-pointer"
                    >
                      التالي ➔
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ================= STAGE 9: Game Suggestions & Victory ================= */}
          {currentStage === 9 && !retryItems && (
            <div className="w-full space-y-5 flex-1 flex flex-col items-center justify-center py-2 animate-scale-up">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-3xl text-center space-y-3 max-w-2xl w-full">
                <div className="inline-flex p-3 bg-amber-500 text-white rounded-2xl shadow-lg">
                  <Trophy className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-text-main">
                    تهانينا يا بطل! 🏆🎉
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-text-muted mt-1">
                    أكملت جميع مراحل التعلّم والتمارين لـ ({displaySetTitle}) بنجاح! جمعت {stars} نجمة 🌟
                  </p>
                </div>
              </div>

              {/* Q25: review of the words answered wrong + "practice these" */}
              {retryFinishedClean && wrongItems.length === 0 && (
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 text-center">
                  🎉 راجعت كل الكلمات اللي غلطت فيها وجاوبتها صح!
                </p>
              )}
              {wrongItems.length > 0 && (
                <div className="w-full max-w-2xl space-y-2">
                  <h4 className="text-xs font-black text-text-main text-right">
                    📝 كلمات تحتاج مراجعة ({wrongItems.length}):
                  </h4>
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
                    {wrongItems.map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-rose-500/5 border-rose-500/20 text-xs font-bold"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => speakGermanText(w.german, 0.9)}
                            className="p-1 rounded-md bg-surface border border-surface-border text-text-main cursor-pointer shrink-0"
                            aria-label="استمع للنطق"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-text-main font-mono" dir="ltr">{w.german}</span>
                        </div>
                        <span className="text-text-muted truncate">{w.arabic}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={startRetryRound}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>🔁 اتدرب على الكلمات دي (تدريب بدون نقاط)</span>
                  </button>
                </div>
              )}

              {/* Game Mode Recommendations Grid */}
              <div className="w-full space-y-2">
                <h4 className="text-xs font-black text-text-muted uppercase tracking-wider text-right">
                  اختر لعبة لمراجعة الكلمات:
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('wheel')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🎡</div>
                    <div className="text-xs font-black text-text-main">عجلة الحظ</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تدوير العجلة والأسئلة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('race')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🏎️</div>
                    <div className="text-xs font-black text-text-main">سباق السيارات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">التنافس بالإجابة السريعة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('memory')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🧠</div>
                    <div className="text-xs font-black text-text-main">لعبة الذاكرة</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">مطابقة البطاقات المفردة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('sorting')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🧩</div>
                    <div className="text-xs font-black text-text-main">ترتيب الكلمات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">سحب وإفلات العناصر</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('sentence_builder')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">📝</div>
                    <div className="text-xs font-black text-text-main">تكوين الجمل</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تركيب العناصر ٤ جمل</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('balloon_pop')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🎈</div>
                    <div className="text-xs font-black text-text-main">فرقعة البالونات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تحدي السرعة الفردي</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('tictactoe')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">❌⭕</div>
                    <div className="text-xs font-black text-text-main">لعبة X-O الكلمات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">مواجهة فرق أو ضد الحاسوب</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('ultimate_tictactoe')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-amber-500/40 rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">👑</div>
                    <div className="text-xs font-black text-text-main">Ultimate XO (9×9)</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">٩ لوحات استراتيجية متداخلة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('basket_catch')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🧺</div>
                    <div className="text-xs font-black text-text-main">سلة التقاط الكلمات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">التقاط المطر الصوتي</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('tug_of_war')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🪢</div>
                    <div className="text-xs font-black text-text-main">تحدي شد الحبل</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تنافس فرق حماسي أو آلي</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('word_ninja')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🥷</div>
                    <div className="text-xs font-black text-text-main">نينجا الكلمات</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تقطيع الكلمات بالسيف</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('space_defense')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🚀</div>
                    <div className="text-xs font-black text-text-main">الدفاع الفضائي</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">معركة السفن والتصويب</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('whack_a_mole')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🔨</div>
                    <div className="text-xs font-black text-text-main">اضرب الخلد</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تحدي المطرقة السريعة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('word_detective')}
                    className="p-3 bg-surface hover:bg-surface-hover border border-surface-border rounded-2xl text-right transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🕵️‍♂️</div>
                    <div className="text-xs font-black text-text-main">المحقق وكلمة السر</div>
                    <div className="text-[10px] text-text-muted font-bold truncate">تخمين حروف الكلمة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLaunchGame && onLaunchGame('games_portal')}
                    className="p-3 bg-primary text-white border border-primary/20 rounded-2xl text-right transition-all hover:scale-[1.02] shadow-sm group cursor-pointer"
                  >
                    <div className="text-2xl mb-1">🎮</div>
                    <div className="text-xs font-black">بوابة الألعاب</div>
                    <div className="text-[10px] opacity-80 font-bold truncate">جميع وضعيات التحدي</div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls — bottom padding includes the Android
            safe-area inset so the buttons never sit under the floating
            BottomNav / system gesture bar. */}
        <div className="px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] border-t border-surface-border bg-surface flex items-center justify-between shrink-0">
          {currentStage === 1 && (
            <>
              <button
                type="button"
                onClick={handleStage1Prev}
                disabled={stageQuestionIndex === 0}
                className="px-4 py-2 bg-surface-hover hover:bg-surface-border disabled:opacity-40 text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <ChevronRight className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
                <span>الكلمة السابقة</span>
              </button>

              <span className="text-xs font-black text-text-muted font-mono">
                {stageQuestionIndex + 1} / {items.length}
              </span>

              <button
                type="button"
                onClick={handleStage1Next}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>{stageQuestionIndex + 1 < items.length ? 'الكلمة التالية' : 'الانتقال لـ صح أم غلط 🚀'}</span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 2 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'تحديد الإجابة الصحيحة') : 'اختر صح أو غلط'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleStage2NextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < stage2Questions.length ? 'السؤال التالي' : 'الانتقال للمرحلة الثالثة 🚀'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 3 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'تحديد الاختيار الصحيح') : 'اختر الإجابة المناسبة'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleStage3NextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < stage3Questions.length ? 'السؤال التالي' : 'الانتقال للمرحلة الرابعة 🚀'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 4 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'التعلم والاستمرار') : 'اختر من كل المجموعات'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleStage4NextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < stage4Questions.length ? 'السؤال التالي' : 'الانتقال للمرحلة الخامسة 🚀'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 5 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'إجابة خاطئة — انتقل للسؤال التالي') : 'تركيب المقاطع الصوتية'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleSyllableNextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < syllableQuestions.length ? 'السؤال التالي' : 'الانتقال للمرحلة السادسة 🚀'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 6 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'اختر الحرف الناقص الصحيح') : 'حدد الحرف الناقص'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleStage5NextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < stage5Questions.length ? 'السؤال التالي' : 'الانتقال للمرحلة السابعة 🚀'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 7 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'إجابة خاطئة — انتقل للسؤال التالي') : 'حدد الحروف المتتالية بالترتيب'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleStage6NextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < stage6Questions.length ? 'السؤال التالي' : 'الانتقال للمرحلة الثامنة 🚀'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 8 && (
            <>
              <div className="text-xs font-bold text-text-muted">
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'إجابة خاطئة — انتقل للسؤال التالي') : 'ركّب الكلمة كاملاً بالترتيب'}
              </div>

              <button
                type="button"
                disabled={!isAnswerSubmitted}
                onClick={handleStage7NextQuestion}
                className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>
                  {stageQuestionIndex + 1 < stage7Questions.length ? 'السؤال التالي' : 'الانتقال لتهانينا والألعاب 🏆'}
                </span>
                <ChevronLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              </button>
            </>
          )}

          {currentStage === 9 && (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetProgress}
                className="px-4 py-2 bg-surface-hover hover:bg-surface-border text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-primary" />
                <span>إعادة الدراسة من البداية</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
              >
                العودة للمجموعات
              </button>
            </div>
          )}
        </div>
          </>
        )}
    </div>
  );
};
