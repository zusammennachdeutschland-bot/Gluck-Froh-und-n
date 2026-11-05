import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LernstudioSet, LernstudioItem, LernstudioGameMode } from '../../types/lernstudio';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../utils/lernstudioTranslations';
import { speakGermanText, speakGermanTextAndWait, stopGermanSpeech } from '../../utils/audioSpeechUtils';
import { playLernstudioSound } from '../../utils/lernstudioAudioUtils';
import {
  X,
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
  Shuffle
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

export const LernstudioTeachModal: React.FC<Props> = ({
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

  // State
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

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  };

  // Always reset to Stage 1 and start fresh from the beginning when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setCurrentStage(1);
    setStageQuestionIndex(0);
    setCompletedStages([]);
    setStars(0);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setIsCorrectAnswer(null);
    setFeedbackMessage('');
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
    setShuffleKey((k) => k + 1);
  };

  if (!isOpen || !set || !set.items || set.items.length === 0) return null;

  const items = set.items;

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

  // Auto-speak word whenever item or question changes across teach stages
  useEffect(() => {
    if (!isOpen || !items || items.length === 0 || !soundEnabled) return;

    let textToSpeak = '';
    if (currentStage === 1 && items[stageQuestionIndex]) {
      textToSpeak = items[stageQuestionIndex].german;
    } else if (currentStage === 2 && stage2Questions[stageQuestionIndex]) {
      textToSpeak = stage2Questions[stageQuestionIndex].displayedItem.german;
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
      setStars((prev) => prev + 1);
      setFeedbackMessage('ممتاز! إجابة صحيحة 🌟');
      // Advance to next question without repeating pronunciation
      handleCorrectAnswerAdvance(handleStage2NextQuestion);
    } else {
      if (soundEnabled) {
        playLernstudioSound('wrong');
        handleSpeakGerman(currentQ.targetItem.german);
      }
      setFeedbackMessage(
        `إجابة خاطئة! الإجابة الصحيحة هي: الكلمة ${
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
      setStars((prev) => prev + 1);
      setFeedbackMessage('رائع جداً! إجابة صحيحة 👏');
      // Advance to next question without repeating pronunciation
      handleCorrectAnswerAdvance(handleStage3NextQuestion);
    } else {
      if (soundEnabled) {
        playLernstudioSound('wrong');
        handleSpeakGerman(currentQ.targetItem.german);
      }
      setFeedbackMessage(
        `اختيار خاطئ! الاختيار الصحيح هو: ${currentQ.targetItem.german} (${currentQ.targetItem.arabic})`
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
    if (isAnswerSubmitted && isCorrectAnswer) return; // allow retry if incorrect
    const currentQ = stage4Questions[stageQuestionIndex];
    const correct = chosenItem.id === currentQ.targetItem.id;

    setSelectedAnswer(chosenItem.id);
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(correct);

    if (correct) {
      setStars((prev) => prev + 1);
      setFeedbackMessage('بطل! إجابة صحيحة من بين كل الكلمات 🌟');
      // Advance to next question without repeating pronunciation
      handleCorrectAnswerAdvance(handleStage4NextQuestion);
    } else {
      if (soundEnabled) {
        playLernstudioSound('wrong');
        handleSpeakGerman(currentQ.targetItem.german);
      }
      setFeedbackMessage(
        `حاول مرة أخرى! الإجابة الصحيحة هي: ${currentQ.targetItem.german} (${currentQ.targetItem.arabic})`
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
    if (usedSyllableChoiceIds.includes(choice.id) || (isAnswerSubmitted && isCorrectAnswer)) return;
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
        setStars((prev) => prev + 1);
        setFeedbackMessage('ممتاز! تم تركيب المقاطع الصوتية للكلمة بنجاح 🧩🌟');
        handleCorrectAnswerAdvance(handleSyllableNextQuestion);
      } else {
        if (soundEnabled) {
          playLernstudioSound('correct');
        }
      }
    } else {
      // Incorrect choice
      if (soundEnabled) {
        playLernstudioSound('wrong');
      }
      setErrorSyllableChoiceId(choice.id);
      setTimeout(() => setErrorSyllableChoiceId(null), 600);
      setFeedbackMessage(`مقطع غير مطابق، اختر المقطع التالي بالترتيب!`);
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
    if (isAnswerSubmitted && isCorrectAnswer) return;
    const currentQ = stage5Questions[stageQuestionIndex];
    const isCorrect = selectedChar.toUpperCase() === currentQ.missingChar.toUpperCase();

    setSelectedAnswer(selectedChar);
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(isCorrect);

    if (isCorrect) {
      setStars((prev) => prev + 1);
      setFeedbackMessage('ممتاز! تم إكمال الحرف الناقص بنجاح 🌟');
      handleCorrectAnswerAdvance(handleStage5NextQuestion);
    } else {
      if (soundEnabled) {
        playLernstudioSound('wrong');
        handleSpeakGerman(currentQ.targetItem.german);
      }
      setFeedbackMessage(`حاول مرة أخرى! الحرف الصحيح هو: "${currentQ.missingChar.toUpperCase()}"`);
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
    if (stage6UsedChoiceIds.includes(choice.id) || (isAnswerSubmitted && isCorrectAnswer)) return;
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
        setStars((prev) => prev + 1);
        setFeedbackMessage('رائع جدًا! اكتملت الحروف المتتالية بنجاح 🧩');
        handleCorrectAnswerAdvance(handleStage6NextQuestion);
      } else {
        if (soundEnabled) {
          playLernstudioSound('correct');
        }
      }
    } else {
      // Incorrect choice
      if (soundEnabled) {
        playLernstudioSound('wrong');
      }
      setStage6ErrorChoiceId(choice.id);
      setTimeout(() => setStage6ErrorChoiceId(null), 600);
      setFeedbackMessage(`حرف غير مطابق، ابحث عن الحرف التالي في الترتيب!`);
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
    if (stage7UsedChoiceIds.includes(choice.id) || (isAnswerSubmitted && isCorrectAnswer)) return;
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
        setStars((prev) => prev + 2);
        setFeedbackMessage('عبقري! تم كِتابة الكلمة كاملة بالترتيب الصحيح ✍️🌟');
        handleCorrectAnswerAdvance(handleStage7NextQuestion);
      } else {
        if (soundEnabled) {
          playLernstudioSound('correct');
        }
      }
    } else {
      // Incorrect choice
      if (soundEnabled) {
        playLernstudioSound('wrong');
      }
      setStage7ErrorChoiceId(choice.id);
      setTimeout(() => setStage7ErrorChoiceId(null), 600);
      setFeedbackMessage(`اختر الحرف التالي في الموضع المضيء!`);
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
        { num: 7, title: '7. Buchstabenfolge', icon: '🧩', desc: 'Aufeinanderfolgende Buchstaben' },
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
        { num: 7, title: '7. Missing Sequence', icon: '🧩', desc: 'Find consecutive letters' },
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
      { num: 7, title: '٧. حروف متتالية', icon: '🧩', desc: 'تحديد الحروف المتتالية الناقصة' },
      { num: 8, title: '٨. إكمال الكلمة', icon: '✍️', desc: 'تركيب الكلمة كاملة بالترتيب' },
      { num: 9, title: '٩. الألعاب', icon: '🏆', desc: 'تهانينا واختيار اللعبة' }
    ];
  }, [language]);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-fade-in"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-surface border border-surface-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up">
        {/* Header */}
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between bg-surface shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-text-main truncate">
                  {t.teachModeTitle} - {displaySetTitle}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-bold inline-flex items-center gap-1 shrink-0">
                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                  {stars}
                </span>
              </div>
              <p className="text-[11px] font-bold text-text-muted truncate">
                {set.topic} • {items.length} كلمات
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
              title={soundEnabled ? 'كتم الصوت تماماً والخيارات الصوتية' : 'تفعيل النطق والصوت'}
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
              className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              title="خلط وإعادة ترتيب الأسئلة عشوائياً"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetProgress}
              className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              title="إعادة التقدّم من البداية"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stages Stepper Nav - Horizontally Scrollable compact pills */}
        <div className="bg-surface-hover/60 border-b border-surface-border px-2 py-2 shrink-0 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-max">
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
                  className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0 whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-white border-primary shadow-xs scale-[1.02]'
                      : isDone
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-surface/80 text-text-muted hover:bg-surface border-surface-border'
                  }`}
                  title={stg.desc}
                >
                  <span className="text-xs sm:text-sm shrink-0">{isDone ? '✔️' : stg.icon}</span>
                  <span className="text-xs">{stg.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-between text-center space-y-4">
          {/* ================= STAGE 1: Word Showcase & Auto Speech ================= */}
          {currentStage === 1 && (
            <div className="w-full space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-full bg-gradient-to-b from-primary-soft/30 to-surface border border-primary-border/30 rounded-3xl p-5 sm:p-8 space-y-4 shadow-xs relative">
                <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-black">
                  كلمة {stageQuestionIndex + 1} من {items.length}
                </span>

                {/* Emoji Display */}
                <div className="text-7xl sm:text-8xl pt-2 select-none">
                  {items[stageQuestionIndex].emoji || '🇩🇪'}
                </div>

                {/* German Word */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <h3 className="text-2xl sm:text-4xl font-black text-text-main tracking-tight font-mono" dir="ltr">
                      {items[stageQuestionIndex].german}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleSpeakGerman(items[stageQuestionIndex].german)}
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

                {/* Example Sentence */}
                {(items[stageQuestionIndex].exampleSentenceGerman || items[stageQuestionIndex].exampleSentenceArabic) && (
                  <div className="p-3.5 bg-surface/90 border border-surface-border rounded-2xl space-y-1 text-right max-w-lg mx-auto">
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
                  <div className="text-6xl sm:text-7xl select-none">
                    {stage2Questions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-text-muted">
                      ({getItemTranslation(stage2Questions[stageQuestionIndex].targetItem, language)})
                    </p>
                    <p className="text-sm font-bold text-text-main">
                      هل الكلمة الألمانية المطابقة هي:
                    </p>
                    <div className="text-2xl sm:text-3xl font-black text-primary font-mono py-1" dir="ltr">
                      "{stage2Questions[stageQuestionIndex].displayedItem.german}"
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
                          onClick={() => handleSpeakGerman(stage2Questions[stageQuestionIndex].targetItem.german)}
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
                    {stage3Questions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-text-main">
                    {getItemTranslation(stage3Questions[stageQuestionIndex].targetItem, language)}
                  </h3>
                  <p className="text-xs text-text-muted font-bold">اختر الكلمة الألمانية المناسبة:</p>
                </div>

                {/* 2 Choice Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
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
                    {stage4Questions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
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
                    {syllableQuestions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
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
                        disabled={isUsed || (isAnswerSubmitted && isCorrectAnswer)}
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
                    {stage5Questions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
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
                    {stage6Questions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
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
                        disabled={isUsed || (isAnswerSubmitted && isCorrectAnswer)}
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
                    {stage7Questions[stageQuestionIndex].targetItem.emoji || '🇩🇪'}
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
                        disabled={isUsed || (isAnswerSubmitted && isCorrectAnswer)}
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

          {/* ================= STAGE 9: Game Suggestions & Victory ================= */}
          {currentStage === 9 && (
            <div className="w-full space-y-5 flex-1 flex flex-col items-center justify-center py-2 animate-scale-up">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-3xl text-center space-y-3 max-w-lg w-full">
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

        {/* Footer Navigation Controls */}
        <div className="px-5 py-3.5 border-t border-surface-border bg-surface flex items-center justify-between shrink-0">
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
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'اختر المقطع التالي بالترتيب') : 'تركيب المقاطع الصوتية'}
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
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'اكتملت الحروف المتتالية') : 'حدد الحروف المتتالية بالترتيب'}
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
                {isAnswerSubmitted ? (isCorrectAnswer ? 'إجابة صحيحة ✔️ (جاري الانتقال...)' : 'تم تركيب الكلمة كاملاً') : 'ركّب الكلمة كاملاً بالترتيب'}
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
                إغلاق النافذة
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
