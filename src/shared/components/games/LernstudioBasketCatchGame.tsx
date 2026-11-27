import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioGameCompletionPayload } from '../../../types/lernstudio';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText, stopGermanSpeech } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../../utils/lernstudioTranslations';
import {
  getSetVocabularyItems,
  AdaptedVocabItem,
  getDistractorChoices,
  createSeededRandom
} from '../../../utils/lernstudioVocabularyAdapter';
import { GameSetupConfig } from '../LernstudioGameSetupScreen';
import { GameStageBanner, SharedVictoryTrophyArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import { GameEffectsOverlay, GameSettingsControls } from '../effects/GameEffectsOverlay';
import {
  ArrowLeft,
  RotateCcw,
  Heart,
  Volume2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  gameConfig?: GameSetupConfig;
  onGameComplete?: (result: LernstudioGameCompletionPayload) => void;
  onBack: () => void;
}

interface FallingWord {
  id: string;
  item: AdaptedVocabItem;
  /** Article-mode only: the article this falling word offers (der/die/das). */
  article?: 'der' | 'die' | 'das';
  xPercent: number; // 5% to 85%
  yPercent: number; // 0 (top) to 100 (bottom)
  speed: number;
  caught: boolean;
}

const stripLeadingArticle = (german: string) => german.replace(/^(der|die|das)\s+/i, '').trim();

export const LernstudioBasketCatchGame: React.FC<Props> = ({
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
  const maxLives = difficulty === 'easy' ? 4 : difficulty === 'hard' ? 2 : 3;
  const baseSpeed = difficulty === 'easy' ? 0.25 : difficulty === 'hard' ? 0.55 : 0.38;
  const enableAudio = gameConfig?.enableAudio ?? true;
  const enableSoundFx = gameConfig?.enableSoundFx ?? true;

  const [sessionSeed, setSessionSeed] = useState<number>(() => Date.now());
  const allItems = useMemo(
    () => getSetVocabularyItems(set, language, gameConfig?.questionCount, sessionSeed),
    [set, language, gameConfig?.questionCount, sessionSeed]
  );
  // 'article' question type (offered by the setup screen whenever the set has
  // articles): the round tests der/die/das instead of word meaning. Only
  // items that actually carry an article can be targets; otherwise fall back
  // to the normal word round.
  const isArticleMode = gameConfig?.questionType === 'article' && allItems.some((it) => !!it.article);
  const items = useMemo(
    () => (isArticleMode ? allItems.filter((it) => !!it.article) : allItems),
    [allItems, isArticleMode]
  );

  // Game state
  const [targetIndex, setTargetIndex] = useState(0);
  const [basketXPercent, setBasketXPercent] = useState(50); // 10% to 90%
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(maxLives);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [catchFlash, setCatchFlash] = useState<{ text: string; correct: boolean } | null>(null);
  const { particles, popups, triggerCorrect, triggerWrong, triggerVictory } = useGameEffects();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fallingWordsRef = useRef<FallingWord[]>([]);
  const basketXRef = useRef(50);
  const targetIndexRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(maxLives);
  const isGameOverRef = useRef(false);
  const isVictoryRef = useRef(false);
  const waveCounterRef = useRef(0);
  const correctCountRef = useRef(0);
  const attemptsCountRef = useRef(0);
  const reportedRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      stopGermanSpeech();
    };
  }, []);

  const reportCompletion = useCallback(
    (passed: boolean, finalScore: number) => {
      if (reportedRef.current || !onGameComplete) return;
      reportedRef.current = true;
      const total = Math.max(1, items.length);
      const attempts = Math.max(1, attemptsCountRef.current);
      const accuracy = Math.min(100, Math.round((correctCountRef.current / attempts) * 100));
      onGameComplete({
        gameMode: 'basket_catch',
        score: finalScore,
        maxScore: total * 100,
        accuracy,
        passed,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        difficulty
      });
    },
    [onGameComplete, items.length, difficulty]
  );

  const targetItem: AdaptedVocabItem | undefined = items[targetIndex % Math.max(1, items.length)];

  const createWaveForTarget = useCallback(
    (target: AdaptedVocabItem, roundIdx: number): FallingWord[] => {
      waveCounterRef.current += 1;
      const rng = createSeededRandom(sessionSeed + roundIdx * 97 + waveCounterRef.current * 31);
      // Article mode: the falling words offer der/die/das for the target noun.
      if (isArticleMode && target.article) {
        const order: Array<'der' | 'die' | 'das'> = ['der', 'die', 'das'];
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        return order.map((art, idx) => ({
          id: `art_${art}_${waveCounterRef.current}_${idx}`,
          item: target,
          article: art,
          xPercent: Math.min(88, Math.max(12, 16 + idx * 32 + (rng() * 8 - 4))),
          yPercent: idx * -18,
          speed: baseSpeed + rng() * 0.14,
          caught: false
        }));
      }
      const candidates = getDistractorChoices(target, items, 2, rng);
      return candidates.map((it, idx) => ({
        id: `${it.id}_${waveCounterRef.current}_${idx}`,
        item: it,
        xPercent: Math.min(88, Math.max(12, 16 + idx * 32 + (rng() * 8 - 4))),
        yPercent: idx * -18,
        speed: baseSpeed + rng() * 0.14,
        caught: false
      }));
    },
    [sessionSeed, items, baseSpeed, isArticleMode]
  );

  // Sync basket ref
  useEffect(() => {
    basketXRef.current = basketXPercent;
  }, [basketXPercent]);

  // Spawn initial wave when target changes
  useEffect(() => {
    if (!targetItem || isGameOver || isVictory || items.length === 0) return;
    const wave = createWaveForTarget(targetItem, targetIndex);
    fallingWordsRef.current = wave;
    setFallingWords(wave);
  }, [targetIndex, isGameOver, isVictory, items.length, targetItem, createWaveForTarget]);

  // No auto-pronunciation of the target: speaking is only via the banner's
  // speaker button, so the child must read the word instead of matching a
  // sound to letters (P0 language bypass).

  // Falling & Collision Loop (mutates refs synchronously, updates React states outside updater)
  useEffect(() => {
    if (isGameOver || isVictory || !targetItem) return;

    const interval = setInterval(() => {
      if (isGameOverRef.current || isVictoryRef.current) return;

      const currentWords = fallingWordsRef.current;
      const nextWords: FallingWord[] = [];
      const curBasketX = basketXRef.current;

      for (const word of currentWords) {
        if (word.caught) continue;
        const newY = word.yPercent + word.speed;

        const isAtBasketHeight = newY >= 80 && newY <= 92;
        const isInsideBasketWidth = Math.abs(word.xPercent - curBasketX) <= 13;

        if (isAtBasketHeight && isInsideBasketWidth) {
          const isCorrect = isArticleMode && word.article
            ? word.article === targetItem.article
            : word.item.id === targetItem.id;
          attemptsCountRef.current += 1;
          setCatchFlash({ text: isArticleMode && word.article ? word.article : word.item.german, correct: isCorrect });
          scheduleTimeout(() => setCatchFlash(null), 800);

          if (isCorrect) {
            correctCountRef.current += 1;
            if (enableSoundFx) {
              playLernstudioSound('catch');
              playLernstudioSound('card_match');
              playGermanVoiceFeedback('correct');
            }
            if (enableAudio) {
              speakGermanText(word.item.german);
            }
            const nextScore = scoreRef.current + 100;
            scoreRef.current = nextScore;
            setScore(nextScore);
            triggerCorrect(100, 'Gefangen!', curBasketX, 80);

            if (targetIndexRef.current + 1 >= items.length) {
              isVictoryRef.current = true;
              setIsVictory(true);
              triggerVictory();
              if (enableSoundFx) playGermanVoiceFeedback('victory');
              reportCompletion(true, nextScore);
              fallingWordsRef.current = [];
              setFallingWords([]);
              return;
            } else {
              const nextIdx = targetIndexRef.current + 1;
              targetIndexRef.current = nextIdx;
              setTargetIndex(nextIdx);
              fallingWordsRef.current = [];
              setFallingWords([]);
              return;
            }
          } else {
            if (enableSoundFx) {
              playLernstudioSound('wrong');
              playGermanVoiceFeedback('try_again');
            }
            triggerWrong(curBasketX, 80);
            const nextLives = Math.max(0, livesRef.current - 1);
            livesRef.current = nextLives;
            setLives(nextLives);
            if (nextLives <= 0) {
              isGameOverRef.current = true;
              setIsGameOver(true);
              reportCompletion(false, scoreRef.current);
              fallingWordsRef.current = [];
              setFallingWords([]);
              return;
            }
          }
          continue;
        }

        if (newY > 105) {
          const isTargetWord = isArticleMode && word.article
            ? word.article === targetItem.article
            : word.item.id === targetItem.id;
          if (isTargetWord) {
            attemptsCountRef.current += 1;
            if (enableSoundFx) playLernstudioSound('wrong');
            const nextLives = Math.max(0, livesRef.current - 1);
            livesRef.current = nextLives;
            setLives(nextLives);
            if (nextLives <= 0) {
              isGameOverRef.current = true;
              setIsGameOver(true);
              reportCompletion(false, scoreRef.current);
              fallingWordsRef.current = [];
              setFallingWords([]);
              return;
            }
          }
          continue;
        }

        nextWords.push({ ...word, yPercent: newY });
      }

      if (nextWords.length === 0 && !isGameOverRef.current && !isVictoryRef.current) {
        const respawned = createWaveForTarget(targetItem, targetIndexRef.current);
        fallingWordsRef.current = respawned;
        setFallingWords(respawned);
      } else {
        fallingWordsRef.current = nextWords;
        setFallingWords(nextWords);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [
    targetItem,
    isGameOver,
    isVictory,
    items.length,
    isArticleMode,
    createWaveForTarget,
    enableAudio,
    enableSoundFx,
    scheduleTimeout,
    triggerCorrect,
    triggerWrong,
    triggerVictory,
    reportCompletion
  ]);

  // Keyboard Navigation Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setBasketXPercent((x) => {
          const next = Math.max(10, x - 7);
          basketXRef.current = next;
          return next;
        });
      } else if (e.key === 'ArrowRight') {
        setBasketXPercent((x) => {
          const next = Math.min(90, x + 7);
          basketXRef.current = next;
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pointer drag on container
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(10, Math.min(90, (x / rect.width) * 100));
    basketXRef.current = percent;
    setBasketXPercent(percent);
  };

  const handleRestart = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    stopGermanSpeech();
    targetIndexRef.current = 0;
    basketXRef.current = 50;
    scoreRef.current = 0;
    livesRef.current = maxLives;
    isGameOverRef.current = false;
    isVictoryRef.current = false;
    fallingWordsRef.current = [];
    correctCountRef.current = 0;
    attemptsCountRef.current = 0;
    reportedRef.current = false;
    startedAtRef.current = Date.now();
    setSessionSeed(Date.now());
    setTargetIndex(0);
    setBasketXPercent(50);
    setFallingWords([]);
    setScore(0);
    setLives(maxLives);
    setIsGameOver(false);
    setIsVictory(false);
    setCatchFlash(null);
  };

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
              <span>🧺 سلة التقاط الكلمات (Basket Catch)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {displayTitle}
              </span>
            </h1>
            <p className="text-[11px] text-text-muted font-bold">
              {isArticleMode
                ? 'حرك السلة لالتقاط أداة التعريف الصحيحة!'
                : 'حرك السلة لالتقاط الكلمة الألمانية المطابقة للمطلوب!'}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-black">
            {Array.from({ length: maxLives }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${i < lives ? 'fill-rose-500 text-rose-500' : 'text-slate-300 dark:text-slate-700'}`}
              />
            ))}
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-primary text-white font-black text-xs shadow-xs">
            {score} نقطة
          </div>

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
        mode="basket_catch"
        title="سلة التقاط الكلمات (Basket Catch)"
        subtitle={isArticleMode ? 'حرك السلة لالتقاط أداة التعريف الصحيحة!' : 'حرك السلة في البستان المشمس لالتقاط المفردة الألمانية الصحيحة!'}
        badgeText={`${targetIndex + 1} / ${items.length}`}
      />

      {/* Target Mission Banner — no emoji: matching must use the word, not a picture. */}
      {targetItem && !isGameOver && !isVictory && (
        <div className="bg-surface border-2 border-primary/40 rounded-2xl p-3.5 text-center space-y-1 shadow-sm">
          <span className="text-xs font-extrabold text-primary block">
            {isArticleMode
              ? `ما أداة التعريف الصحيحة؟ (${targetIndex + 1} من ${items.length})`
              : `التقط في السلة الكلمة التي تعني (${targetIndex + 1} من ${items.length}):`}
          </span>
          <div className="flex items-center justify-center gap-2.5">
            {isArticleMode ? (
              <>
                <h2 className="text-xl sm:text-2xl font-black text-text-main font-mono" dir="ltr" lang="de">
                  {stripLeadingArticle(targetItem.german)}
                </h2>
                <span className="text-sm font-bold text-text-muted">
                  {getItemTranslation(targetItem.originalItem, language)}
                </span>
              </>
            ) : (
              <h2 className="text-xl sm:text-2xl font-black text-text-main">
                {getItemTranslation(targetItem.originalItem, language)}
              </h2>
            )}
            <button
              type="button"
              onClick={() => speakGermanText(isArticleMode ? stripLeadingArticle(targetItem.german) : targetItem.german)}
              className="p-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
              title="نطق الكلمة"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Catch Play Arena */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        className="relative flex-1 min-h-[380px] sm:min-h-[440px] bg-gradient-to-b from-surface via-primary-soft/10 to-primary-soft/30 border border-surface-border rounded-3xl overflow-hidden shadow-inner p-4 cursor-ew-resize touch-none"
      >
        {/* Falling Words */}
        {!isGameOver &&
          !isVictory &&
          fallingWords.map((word) => (
            <div
              key={word.id}
              style={{
                left: `${word.xPercent}%`,
                top: `${word.yPercent}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className="absolute z-20 pointer-events-none"
            >
              <div className="px-3.5 py-2 rounded-2xl bg-surface/95 border-2 border-primary/40 text-text-main shadow-md flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm">
                <span>{isArticleMode && word.article ? word.article : word.item.german}</span>
              </div>
            </div>
          ))}

        {/* Catch Flash Message */}
        {catchFlash && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 animate-scale-up">
            <span
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-black text-white shadow-lg ${
                catchFlash.correct ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            >
              {catchFlash.correct ? `أحسنت! +100 نقطة (${catchFlash.text})` : `خاطئ! (${catchFlash.text})`}
            </span>
          </div>
        )}

        {/* Catching Basket */}
        {!isGameOver && !isVictory && (
          <div
            style={{
              left: `${basketXPercent}%`,
              bottom: '16px',
              transform: 'translateX(-50%)'
            }}
            className="absolute z-20 transition-transform duration-75 flex flex-col items-center select-none"
          >
            <div className="w-24 sm:w-28 h-14 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 border-4 border-amber-300 rounded-b-3xl shadow-xl flex items-center justify-center text-3xl">
              🧺
            </div>
          </div>
        )}

        {/* Victory Screen */}
        {isVictory && (
          <div className="absolute inset-0 bg-surface/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-up z-40">
            <SharedVictoryTrophyArt className="w-24 h-24 rounded-3xl shadow-xl border border-amber-400/30" />
            <h2 className="text-2xl sm:text-3xl font-black text-text-main">
              مبروك! التقطت جميع الكلمات بنجاح في السلة! 🧺🎉
            </h2>
            <p className="text-sm font-bold text-text-muted">
              مجموع النقاط المحققة: <span className="text-primary font-black text-lg">{score}</span>
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm shadow-md hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>العب مرة أخرى</span>
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
          <div className="absolute inset-0 bg-surface/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-scale-up z-40">
            <div className="text-5xl">💔</div>
            <h2 className="text-xl sm:text-2xl font-black text-text-main">
              انتهت المحاولات!
            </h2>
            <p className="text-xs sm:text-sm font-bold text-text-muted">
              حاول تحريك السلة بسرعة للالتقاط بدقة. نتيجتك: {score} نقطة.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm shadow-md hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة المحاولة</span>
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

      {/* Touch Screen Left/Right Arrow Controls */}
      {!isGameOver && !isVictory && (
        <div className="flex items-center justify-center gap-6 pt-1 sm:hidden">
          <button
            type="button"
            onClick={() => setBasketXPercent((x) => Math.max(10, x - 15))}
            className="p-4 bg-surface-hover active:bg-primary active:text-white border border-surface-border rounded-2xl shadow-sm cursor-pointer"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
          <button
            type="button"
            onClick={() => setBasketXPercent((x) => Math.min(90, x + 15))}
            className="p-4 bg-surface-hover active:bg-primary active:text-white border border-surface-border rounded-2xl shadow-sm cursor-pointer"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        </div>
      )}
    </div>
  );
};
