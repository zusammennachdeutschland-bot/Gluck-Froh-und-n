import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem, LernstudioGameCompletionPayload } from '../../../types/lernstudio';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import { getSetVocabularyItems, createSeededRandom } from '../../../utils/lernstudioVocabularyAdapter';
import { GameSetupConfig } from '../LernstudioGameSetupScreen';
import { GameStageBanner, SharedVictoryTrophyArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import { GameEffectsOverlay, GameSettingsControls } from '../effects/GameEffectsOverlay';
import {
  ArrowLeft,
  RotateCcw,
  Volume2,
  Search,
  Key,
  Lightbulb
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  gameConfig?: GameSetupConfig;
  onGameComplete?: (result: LernstudioGameCompletionPayload) => void;
  onBack: () => void;
}

const GERMAN_LETTERS_ROW1 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const GERMAN_LETTERS_ROW2 = ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
const GERMAN_LETTERS_ROW3 = ['U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ü', 'ß'];

export const LernstudioWordDetectiveGame: React.FC<Props> = ({
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
  const maxMistakes = difficulty === 'easy' ? 8 : difficulty === 'hard' ? 4 : 6;
  const enableAudio = gameConfig?.enableAudio ?? true;
  const enableSoundFx = gameConfig?.enableSoundFx ?? true;

  const [sessionSeed, setSessionSeed] = useState<number>(() => Date.now());
  const items = useMemo(
    () => getSetVocabularyItems(set, language, gameConfig?.questionCount, sessionSeed),
    [set, language, gameConfig?.questionCount, sessionSeed]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isVictory, setIsVictory] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const { particles, popups, triggerCorrect, triggerWrong, triggerVictory } = useGameEffects();

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const solvedCountRef = useRef(0);
  const reportedRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  const reportCompletion = useCallback(
    (passed: boolean, finalScore: number) => {
      if (reportedRef.current || !onGameComplete) return;
      reportedRef.current = true;
      const total = Math.max(1, items.length);
      onGameComplete({
        gameMode: 'word_detective',
        score: finalScore,
        maxScore: total * 100,
        accuracy: Math.min(100, Math.round((solvedCountRef.current / total) * 100)),
        passed,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        difficulty
      });
    },
    [onGameComplete, items.length, difficulty]
  );

  const currentItem: LernstudioItem | undefined = items[currentIndex % Math.max(1, items.length)];
  const targetWord = (currentItem?.german || '').trim();

  // Normalize target characters (ignoring spaces and punctuation in guess requirements)
  const requiredChars = useMemo(() => {
    return targetWord
      .toUpperCase()
      .split('')
      .filter((char) => /[A-ZÄÖÜß]/.test(char));
  }, [targetWord]);

  // Check if fully solved
  const isWordSolved = useMemo(() => {
    if (requiredChars.length === 0) return false;
    return requiredChars.every((char) => guessedLetters.has(char));
  }, [requiredChars, guessedLetters]);

  const handleNextWord = () => {
    setCurrentIndex((prev) => prev + 1);
    setGuessedLetters(new Set());
    setMistakes(0);
  };

  // Handle letter guess
  const handleGuessLetter = (letter: string) => {
    if (guessedLetters.has(letter) || isGameOver || isWordSolved) return;

    const nextGuessed = new Set(guessedLetters);
    nextGuessed.add(letter);
    setGuessedLetters(nextGuessed);

    const isInWord = requiredChars.includes(letter);

    if (isInWord) {
      if (enableSoundFx) playLernstudioSound('correct');

      const allDone = requiredChars.every((ch) => nextGuessed.has(ch));
      if (allDone) {
        solvedCountRef.current += 1;
        if (enableAudio) speakGermanText(targetWord);
        const nextScore = score + 100;
        setScore(nextScore);
        triggerCorrect(100, 'Gelöst!');
        if (enableSoundFx) playGermanVoiceFeedback('correct');

        if (currentIndex + 1 >= items.length) {
          setIsVictory(true);
          triggerVictory();
          if (enableSoundFx) playGermanVoiceFeedback('victory');
          reportCompletion(true, nextScore);
        } else {
          const tid = setTimeout(() => {
            handleNextWord();
          }, 1800);
          timeoutsRef.current.push(tid);
        }
      }
    } else {
      if (enableSoundFx) playLernstudioSound('wrong');
      triggerWrong();
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);

      if (nextMistakes >= maxMistakes) {
        setIsGameOver(true);
        if (enableSoundFx) playGermanVoiceFeedback('try_again');
        reportCompletion(false, score);
      }
    }
  };

  // Provide a hint: reveals an unguessed letter deterministically via seed
  const handleUseHint = () => {
    if (isWordSolved || isGameOver) return;
    const remaining = requiredChars.filter((c) => !guessedLetters.has(c));
    if (remaining.length === 0) return;

    const rng = createSeededRandom(sessionSeed + currentIndex * 29 + hintsUsed * 13);
    const randomLetter = remaining[Math.floor(rng() * remaining.length)];
    handleGuessLetter(randomLetter);
    setHintsUsed((h) => h + 1);
  };

  const handleRestart = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    solvedCountRef.current = 0;
    reportedRef.current = false;
    startedAtRef.current = Date.now();
    setSessionSeed(Date.now());
    setCurrentIndex(0);
    setGuessedLetters(new Set());
    setMistakes(0);
    setScore(0);
    setHintsUsed(0);
    setIsGameOver(false);
    setIsVictory(false);
  };

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center bg-surface rounded-3xl border border-surface-border">
        <p className="text-text-muted font-bold">لا توجد كلمات كافية في هذه المجموعة.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-white rounded-xl">
          العودة
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-[85vh] p-3 sm:p-5 rounded-3xl space-y-4 select-none transition-all bg-background text-text-main flex flex-col justify-between"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
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
              <span>🕵️‍♂️ المحقق وكلمة السر (Word Detective)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {displayTitle}
              </span>
            </h1>
            <p className="text-[11px] text-text-muted font-bold">
              خمن حروف الكلمة الألمانية المخفية قبل استنفاذ محاولات التحقيق!
            </p>
          </div>
        </div>

        {/* Clues & Score */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Clues Magnifiers remaining */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black">
            <Search className="w-4 h-4" />
            <span>المحاولات: {maxMistakes - mistakes} / {maxMistakes}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-primary text-white font-black text-xs shadow-xs">
            {score} نقطة
          </div>

          <button
            type="button"
            onClick={handleUseHint}
            disabled={isWordSolved || isGameOver}
            className="p-2 rounded-xl bg-surface-hover hover:bg-primary-soft text-amber-500 hover:text-amber-600 border border-surface-border transition-colors cursor-pointer disabled:opacity-40"
            title="تلميح بحرف"
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="p-2 rounded-xl bg-surface-hover hover:bg-surface-border text-text-muted hover:text-text-main transition-colors cursor-pointer"
            title="إعادة اللعبة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <GameSettingsControls compact />
        </div>
      </div>

      <GameEffectsOverlay particles={particles} popups={popups} showConfetti={isVictory} />
      <GameStageBanner
        mode="word_detective"
        title="المحقق وكلمة السر (Word Detective)"
        subtitle="فك شفرة الحروف الألمانية المخفية واكتشف الكلمة السرية!"
        badgeText={`${currentIndex + 1} / ${items.length}`}
      />

      {/* Target Clue Card */}
      {currentItem && (
        <div className="bg-surface border-2 border-primary/40 rounded-3xl p-5 text-center space-y-3 shadow-md max-w-xl mx-auto w-full">
          <div className="flex items-center justify-between text-xs font-bold text-text-muted">
            <span className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-primary" />
              <span>لغز المفردة ({currentIndex + 1} من {items.length})</span>
            </span>
            <span>{currentItem.article ? (isWordSolved || isGameOver ? `أداة: ${currentItem.article}` : 'أداة التعريف: [ ؟ ]') : 'مفردات ألمانية'}</span>
          </div>

          {/* Target translation and Emoji */}
          <div className="flex items-center justify-center gap-3 py-1">
            {currentItem.emoji && <span className="text-4xl select-none">{currentItem.emoji}</span>}
            <h2 className="text-2xl sm:text-3xl font-black text-text-main">
              {getItemTranslation(currentItem, language)}
            </h2>
          </div>

          {/* Hidden Word Letter Slots */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 flex-wrap pt-3 font-mono" dir="ltr">
            {targetWord.split('').map((char, idx) => {
              const upper = char.toUpperCase();
              const isLetter = /[A-ZÄÖÜß]/.test(upper);
              const isRevealed = !isLetter || guessedLetters.has(upper) || isGameOver;

              if (char === ' ') {
                return <span key={idx} className="w-4 sm:w-6 inline-block" />;
              }

              return (
                <div
                  key={idx}
                  className={`w-9 h-12 sm:w-11 sm:h-14 rounded-2xl border-2 flex items-center justify-center text-xl sm:text-2xl font-black transition-all shadow-2xs ${
                    isRevealed
                      ? guessedLetters.has(upper)
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 scale-105'
                        : 'bg-red-500/10 border-red-500 text-red-500'
                      : 'bg-surface-hover/80 border-surface-border text-transparent'
                  }`}
                >
                  {isRevealed ? char : '_'}
                </div>
              );
            })}
          </div>

          {/* Audio helper button */}
          {isWordSolved && (
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => speakGermanText(targetWord)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse"
              >
                <Volume2 className="w-4 h-4" />
                <span>استمع للنطق الصحيح</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* On-Screen German Alphabet Keyboard */}
      {!isGameOver && !isVictory && (
        <div className="space-y-2 max-w-2xl mx-auto w-full pt-2">
          {[GERMAN_LETTERS_ROW1, GERMAN_LETTERS_ROW2, GERMAN_LETTERS_ROW3].map((row, rIdx) => (
            <div key={rIdx} className="flex items-center justify-center gap-1 sm:gap-1.5">
              {row.map((letter) => {
                const isGuessed = guessedLetters.has(letter);
                const isHit = isGuessed && requiredChars.includes(letter);
                const isMiss = isGuessed && !requiredChars.includes(letter);

                let keyClass =
                  'bg-surface hover:bg-surface-hover text-text-main border-surface-border hover:border-primary/50';

                if (isHit) {
                  keyClass = 'bg-emerald-500 text-white border-emerald-600 opacity-60 cursor-not-allowed';
                } else if (isMiss) {
                  keyClass = 'bg-slate-300 dark:bg-slate-800 text-text-muted/40 border-transparent opacity-40 cursor-not-allowed';
                }

                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={isGuessed}
                    onClick={() => handleGuessLetter(letter)}
                    className={`h-11 sm:h-12 flex-1 max-w-[44px] rounded-xl font-black font-mono text-sm sm:text-base border shadow-2xs transition-all cursor-pointer flex items-center justify-center ${keyClass}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Victory Screen */}
      {isVictory && (
        <div className="p-8 bg-surface border border-surface-border rounded-3xl text-center space-y-4 animate-scale-up max-w-lg mx-auto w-full shadow-xl">
          <SharedVictoryTrophyArt className="w-24 h-24 mx-auto rounded-3xl shadow-xl border border-amber-400/30" />
          <h2 className="text-2xl sm:text-3xl font-black text-text-main">
            أنت المحقق الأذكى! فككت كل شفرات الكلمات 🕵️‍♂️🎉
          </h2>
          <p className="text-sm font-bold text-text-muted">
            مجموع النقاط: <span className="text-primary font-black text-lg">{score}</span> نقطة!
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRestart}
              className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm shadow-md hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>قضية جديدة</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-3 bg-surface-hover text-text-main border border-surface-border rounded-2xl font-bold text-sm hover:bg-surface transition-all cursor-pointer"
            >
              العودة للألعاب
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="p-8 bg-surface border border-surface-border rounded-3xl text-center space-y-4 animate-scale-up max-w-lg mx-auto w-full shadow-xl">
          <div className="text-5xl">🔒</div>
          <h2 className="text-xl sm:text-2xl font-black text-text-main">
            أغلقت الخزينة! الكلمة كانت:
          </h2>
          <div className="text-2xl font-black text-primary font-mono py-1">
            {targetWord} ({getItemTranslation(currentItem, language)})
          </div>
          <p className="text-xs sm:text-sm font-bold text-text-muted">
            لا تيأس يا بطل، تدرب على تهجئة الحروف الألمانية وجرب مرة ثانية.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRestart}
              className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm shadow-md hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة التحقيق</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-3 bg-surface-hover text-text-main border border-surface-border rounded-2xl font-bold text-sm hover:bg-surface transition-all cursor-pointer"
            >
              العودة للألعاب
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
