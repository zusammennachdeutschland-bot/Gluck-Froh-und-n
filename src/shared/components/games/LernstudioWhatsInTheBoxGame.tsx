import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LernstudioSet,
  LernstudioTheme,
  LernstudioGameCompletionPayload
} from '../../../types/lernstudio';
import {
  getSetVocabularyItems,
  AdaptedVocabItem,
  getDistractorChoices,
  createSeededRandom
} from '../../../utils/lernstudioVocabularyAdapter';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText, stopGermanSpeech } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations } from '../../../utils/lernstudioTranslations';
import { ArrowLeft, Volume2, RotateCcw, Eye } from 'lucide-react';
import { GameStageBanner, SharedVictoryTrophyArt, SharedMysteryChestArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';

import { GameSetupConfig } from '../LernstudioGameSetupScreen';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  gameConfig?: GameSetupConfig;
  onGameComplete?: (result: LernstudioGameCompletionPayload) => void;
  onBack: () => void;
}

export const LernstudioWhatsInTheBoxGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  gameConfig,
  onGameComplete,
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const { triggerSparkles, triggerScorePopup, triggerCelebration, EffectsOverlay, SettingsBar } = useGameEffects(language);
  const [sessionNonce, setSessionNonce] = useState(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);
  const correctRef = useRef(0);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      stopGermanSpeech();
    };
  }, []);

  const allVocabPool = useMemo(() => getSetVocabularyItems(set, language), [set, language]);
  const vocabItems = useMemo(() => {
    const requested = gameConfig?.questionCount && gameConfig.questionCount > 0 ? gameConfig.questionCount : allVocabPool.length;
    return getSetVocabularyItems(set, language, requested, `${set.id}::box::${sessionNonce}`);
  }, [set, language, gameConfig?.questionCount, allVocabPool.length, sessionNonce]);

  const team1Name = gameConfig?.teamNames?.[0] || (isRtl ? 'الفريق 1 (🔴)' : 'Team 1 (🔴)');
  const team2Name = gameConfig?.teamNames?.[1] || (isRtl ? 'الفريق 2 (🔵)' : 'Team 2 (🔵)');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTeam, setActiveTeam] = useState<0 | 1>(0);
  const [teamScores, setTeamScores] = useState<[number, number]>([0, 0]);
  const [clueStage, setClueStage] = useState<number>(1);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isVictory, setIsVictory] = useState(false);

  const currentItem = vocabItems[currentIndex];
  const choices = useMemo(() => {
    if (!currentItem) return [];
    const rng = createSeededRandom(`${set.id}::box_choices::${sessionNonce}::${currentIndex}::${currentItem.id}`);
    return getDistractorChoices(currentItem, allVocabPool, 3, rng);
  }, [currentItem, allVocabPool, set.id, sessionNonce, currentIndex]);

  useEffect(() => {
    if (gameConfig?.enableAudio !== false && currentItem && !isVictory) {
      const timer = setTimeout(() => {
        speakGermanText(currentItem.german);
      }, 300);
      return () => {
        clearTimeout(timer);
        stopGermanSpeech();
      };
    }
  }, [currentIndex, isVictory, currentItem, gameConfig?.enableAudio]);

  if (!currentItem || vocabItems.length === 0) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-text-muted">هذه المجموعة تحتاج إلى كلمات إضافية للعب.</p>
        <button onClick={onBack} className="px-4 py-2 bg-primary text-white rounded-xl">عودة</button>
      </div>
    );
  }

  const reportFinish = (finalTeamScores: [number, number]) => {
    if (completedRef.current || !onGameComplete) return;
    completedRef.current = true;
    const total = Math.max(1, vocabItems.length);
    const accuracy = Math.min(100, Math.round((correctRef.current / total) * 100));
    onGameComplete({
      gameMode: 'whats_in_box',
      score: Math.max(finalTeamScores[0], finalTeamScores[1]),
      maxScore: total * 100,
      accuracy,
      passed: accuracy >= 50,
      difficulty: gameConfig?.difficulty,
      teamScores: {
        [team1Name]: finalTeamScores[0],
        [team2Name]: finalTeamScores[1]
      }
    });
  };

  const handleSelectChoice = (choice: AdaptedVocabItem) => {
    if (isAnswerSubmitted) return;
    setSelectedChoice(choice.id);
    setIsAnswerSubmitted(true);

    const awardPoints = clueStage === 1 ? 100 : clueStage === 2 ? 70 : 50;

    if (choice.id === currentItem.id) {
      correctRef.current += 1;
      setIsCorrect(true);
      if (gameConfig?.enableSoundFx !== false) playLernstudioSound('correct');
      if (gameConfig?.enableAudio !== false) playGermanVoiceFeedback('correct');
      triggerSparkles(50, 45, '#f59e0b');
      triggerScorePopup(`+${awardPoints} 📦`, 50, 35, 'positive');
      const nextScores: [number, number] = [...teamScores] as [number, number];
      nextScores[activeTeam] += awardPoints;
      setTeamScores(nextScores);

      const tid = setTimeout(() => {
        if (currentIndex + 1 >= vocabItems.length) {
          setIsVictory(true);
          if (gameConfig?.enableSoundFx !== false) playLernstudioSound('victory');
          if (gameConfig?.enableAudio !== false) playGermanVoiceFeedback('victory');
          triggerCelebration('انفتح الصندوق الذهبي! 📦', 'اكتملت المسابقة!');
          reportFinish(nextScores);
        } else {
          setCurrentIndex((prev) => prev + 1);
          setActiveTeam((prev) => (prev === 0 ? 1 : 0));
          setClueStage(1);
          setIsAnswerSubmitted(false);
          setSelectedChoice(null);
          setIsCorrect(null);
        }
      }, 2000);
      timeoutsRef.current.push(tid);
    } else {
      setIsCorrect(false);
      if (gameConfig?.enableSoundFx !== false) playLernstudioSound('wrong');
      if (gameConfig?.enableAudio !== false) playGermanVoiceFeedback('wrong');

      const tid = setTimeout(() => {
        if (currentIndex + 1 >= vocabItems.length) {
          setIsVictory(true);
          if (gameConfig?.enableSoundFx !== false) playLernstudioSound('victory');
          triggerCelebration('انتهت المسابقة! 📦');
          reportFinish(teamScores);
        } else {
          setCurrentIndex((prev) => prev + 1);
          setActiveTeam((prev) => (prev === 0 ? 1 : 0));
          setClueStage(1);
          setIsAnswerSubmitted(false);
          setSelectedChoice(null);
          setIsCorrect(null);
        }
      }, 2800);
      timeoutsRef.current.push(tid);
    }
  };

  const handleRestart = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    completedRef.current = false;
    correctRef.current = 0;
    setSessionNonce((n) => n + 1);
    setCurrentIndex(0);
    setActiveTeam(0);
    setClueStage(1);
    setTeamScores([0, 0]);
    setIsAnswerSubmitted(false);
    setSelectedChoice(null);
    setIsCorrect(null);
    setIsVictory(false);
  };

  const winningTeamName =
    teamScores[0] > teamScores[1]
      ? team1Name
      : teamScores[1] > teamScores[0]
      ? team2Name
      : isRtl
      ? 'تعادل الفريقين! 🤝'
      : 'Draw! 🤝';

  return (
    <div className="p-4 sm:p-6 rounded-3xl min-h-[85vh] flex flex-col justify-between bg-background text-text-main relative overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <EffectsOverlay />
      {/* Top Header */}
      <div className="bg-surface border border-surface-border p-4 rounded-3xl shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 rounded-2xl bg-surface-hover text-text-muted hover:text-text-main cursor-pointer">
            <ArrowLeft className={`w-5 h-5 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <h1 className="text-base sm:text-lg font-black text-text-main">ماذا في الصندوق؟ (What's in the Box?)</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SettingsBar />
          <div className={`px-3 py-1.5 rounded-xl border font-black text-xs ${activeTeam === 0 ? 'bg-red-500 text-white border-red-500 shadow-md ring-2 ring-red-400' : 'bg-surface text-text-muted border-surface-border'}`}>
            {team1Name}: {teamScores[0]} ن
          </div>
          <div className={`px-3 py-1.5 rounded-xl border font-black text-xs ${activeTeam === 1 ? 'bg-blue-500 text-white border-blue-500 shadow-md ring-2 ring-blue-400' : 'bg-surface text-text-muted border-surface-border'}`}>
            {team2Name}: {teamScores[1]} ن
          </div>
        </div>
      </div>

      {/* Main Stage */}
      {!isVictory ? (
        <div className="max-w-2xl w-full mx-auto my-auto space-y-5">
          <GameStageBanner
            mode="whats_in_box"
            title="ماذا في الصندوق؟ (What's in the Box?)"
            subtitle="اكتشف سر الصندوق الخشبي قبل طلب أدلة إضافية!"
            badgeText={`📦 ${teamScores[0]} : ${teamScores[1]}`}
          />
          <div className="bg-surface border border-surface-border p-6 rounded-3xl text-center space-y-4 shadow-sm relative">
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-black text-white ${activeTeam === 0 ? 'bg-red-500' : 'bg-blue-500'}`}>
                دور {activeTeam === 0 ? 'الفريق الأوّل (🔴)' : 'الفريق الثاني (🔵)'}
              </span>
              <span className="text-xs font-bold text-text-muted">الكلمة {currentIndex + 1} / {vocabItems.length}</span>
            </div>

            {/* Mystery Box Display */}
            <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-white space-y-3">
              <div className="flex justify-center">
                {clueStage === 3 || isAnswerSubmitted ? (
                  <div className="text-6xl text-center animate-bounce">{currentItem.emoji}</div>
                ) : (
                  <SharedMysteryChestArt className="w-24 h-24 rounded-2xl shadow-lg border border-amber-500/40" />
                )}
              </div>
              <p className="text-xs font-bold text-amber-400">
                {clueStage === 1
                  ? 'دليل 1: استمع للنطق أو انقر لكشف تلميح ذكي'
                  : clueStage === 2
                  ? currentItem.exampleSentenceArabic
                    ? `دليل 2 (سياق الجملة): ${currentItem.exampleSentenceArabic}`
                    : currentItem.article
                    ? `دليل 2 (تلميح نحوي): الأداة "${currentItem.article}" — عدد حروف الكلمة ${currentItem.german.replace(/^(der|die|das)\s+/i, '').length}`
                    : `دليل 2 (تلميح): تبدأ بـ "${currentItem.german.trim().slice(0, 2)}..." (${currentItem.german.trim().length} أحرف)`
                  : `دليل 3: شاهد الرمز التوضيحي (${currentItem.emoji})`}
              </p>
              {clueStage < 3 && !isAnswerSubmitted && (
                <button
                  type="button"
                  onClick={() => setClueStage((s) => s + 1)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> كشف دليل إضافي
                </button>
              )}
            </div>

            {/* Target German Word */}
            <div className="p-4 bg-primary-soft/40 border border-primary-border/30 rounded-2xl inline-flex items-center gap-3 justify-center w-full">
              <h2 className="text-2xl sm:text-3xl font-black text-text-main font-mono" dir="ltr">
                {currentItem.german}
              </h2>
              <button
                onClick={() => speakGermanText(currentItem.german)}
                className="p-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Choices Grid */}
          <div className="grid grid-cols-2 gap-3">
            {choices.map((choice) => {
              const isSelected = selectedChoice === choice.id;
              let btnStyle = 'bg-surface hover:bg-surface-hover text-text-main border-surface-border';

              if (isAnswerSubmitted) {
                if (choice.id === currentItem.id) {
                  btnStyle = 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-md';
                } else if (isSelected && !isCorrect) {
                  btnStyle = 'bg-red-500 text-white border-red-500';
                }
              }

              return (
                <button
                  key={choice.id}
                  disabled={isAnswerSubmitted}
                  onClick={() => handleSelectChoice(choice)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center shadow-xs ${btnStyle}`}
                >
                  <span className="text-3xl">{choice.emoji}</span>
                  <span className="text-sm font-bold">{choice.translation}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Victory Screen */
        <div className="max-w-md w-full mx-auto my-auto bg-surface border border-surface-border p-8 rounded-3xl text-center space-y-6 shadow-2xl animate-scale-up">
          <div className="flex justify-center">
            <SharedVictoryTrophyArt className="w-28 h-28 rounded-3xl shadow-xl border-2 border-amber-400/50" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-text-main">فوز {winningTeamName}! 📦🎉</h2>
            <div className="text-xs font-bold text-text-muted space-y-1">
              <p>نقاط فريق 1: {teamScores[0]}</p>
              <p>نقاط فريق 2: {teamScores[1]}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={handleRestart} className="px-6 py-3 bg-primary text-white rounded-2xl font-bold flex items-center gap-2 cursor-pointer">
              <RotateCcw className="w-4 h-4" /> إعادة اللعب
            </button>
            <button onClick={onBack} className="px-6 py-3 bg-surface-hover text-text-muted rounded-2xl font-bold cursor-pointer">
              القائمة الرئيسية
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

