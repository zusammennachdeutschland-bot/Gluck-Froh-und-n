import React, { useState, useEffect } from 'react';
import { LernstudioSet, LernstudioTheme } from '../../../types/lernstudio';
import { getSetVocabularyItems, AdaptedVocabItem, getDistractorChoices } from '../../../utils/lernstudioVocabularyAdapter';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText, stopGermanSpeech } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations } from '../../../utils/lernstudioTranslations';
import { ArrowLeft, Volume2, RotateCcw, Anchor, Sparkles } from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

export const LernstudioSubmarineGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';

  const vocabItems = getSetVocabularyItems(set, language);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [depthMeter, setDepthMeter] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isVictory, setIsVictory] = useState(false);

  const currentItem = vocabItems[currentIndex];
  const choices = currentItem ? getDistractorChoices(currentItem, vocabItems) : [];

  useEffect(() => {
    if (currentItem && !isVictory) {
      const timer = setTimeout(() => {
        speakGermanText(currentItem.german);
      }, 300);
      return () => {
        clearTimeout(timer);
        stopGermanSpeech();
      };
    }
  }, [currentIndex, isVictory]);

  if (!currentItem || vocabItems.length === 0) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-text-muted">هذه المجموعة تحتاج إلى كلمات إضافية للعب.</p>
        <button onClick={onBack} className="px-4 py-2 bg-primary text-white rounded-xl">عودة</button>
      </div>
    );
  }

  const handleSelectChoice = (choice: AdaptedVocabItem) => {
    if (isAnswerSubmitted) return;
    setSelectedChoice(choice.id);
    setIsAnswerSubmitted(true);

    if (choice.id === currentItem.id) {
      setIsCorrect(true);
      playLernstudioSound('correct');
      setScore((s) => s + 100);
      setDepthMeter((d) => d + 100);

      setTimeout(() => {
        if (currentIndex + 1 >= vocabItems.length) {
          setIsVictory(true);
        } else {
          setCurrentIndex((prev) => prev + 1);
          setIsAnswerSubmitted(false);
          setSelectedChoice(null);
          setIsCorrect(null);
        }
      }, 1000);
    } else {
      setIsCorrect(false);
      playLernstudioSound('wrong');
      setTimeout(() => {
        setIsAnswerSubmitted(false);
        setSelectedChoice(null);
        setIsCorrect(null);
      }, 1200);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setDepthMeter(0);
    setScore(0);
    setIsAnswerSubmitted(false);
    setSelectedChoice(null);
    setIsCorrect(null);
    setIsVictory(false);
  };

  return (
    <div className="p-4 sm:p-6 rounded-3xl min-h-[85vh] flex flex-col justify-between bg-background text-text-main" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <div className="bg-surface border border-surface-border p-4 rounded-3xl shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 rounded-2xl bg-surface-hover text-text-muted hover:text-text-main cursor-pointer">
            <ArrowLeft className={`w-5 h-5 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛥️</span>
            <h1 className="text-base sm:text-lg font-black text-text-main">مهمة الغواصة (Submarine Mission)</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-black">
          <span className="px-3 py-1.5 rounded-xl bg-primary-soft text-primary">النقاط: {score}</span>
          <span className="px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">العمق: {depthMeter}م</span>
        </div>
      </div>

      {/* Main Stage */}
      {!isVictory ? (
        <div className="max-w-2xl w-full mx-auto my-auto space-y-6">
          <div className="bg-surface border border-surface-border p-6 rounded-3xl text-center space-y-4 shadow-sm relative overflow-hidden">
            <div className="flex justify-center items-center gap-2 text-cyan-500 font-bold text-xs">
              <Anchor className="w-5 h-5 animate-spin" />
              <span>قُد الغواصة إلى الكلمة المطلوبة في أعماق المحيط!</span>
            </div>

            {/* Ocean Depths Submarine Display */}
            <div className="bg-gradient-to-b from-blue-900 via-indigo-950 to-slate-950 p-6 rounded-2xl text-white relative overflow-hidden space-y-3 shadow-inner">
              <div className="flex justify-between items-center text-xs font-mono text-cyan-300">
                <span>🌊 مستوى البحر</span>
                <span>عمق الغواصة: {depthMeter} متر</span>
                <span>💎 كنز الأعماق</span>
              </div>
              <div className="text-6xl text-center py-2 animate-pulse">
                🛥️🫧
              </div>
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
          <div className="p-4 bg-cyan-500/10 text-cyan-500 rounded-3xl inline-block">
            <Sparkles className="w-16 h-16 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-text-main">وصلت الغواصة إلى كنز الأعماق! 🛥️💎</h2>
            <p className="text-xs text-text-muted font-bold">جمعت {score} نقطة ووصلت إلى عمق 1000 متر بنجاح كامل!</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={handleRestart} className="px-6 py-3 bg-cyan-600 text-white rounded-2xl font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> إعادة اللعب
            </button>
            <button onClick={onBack} className="px-6 py-3 bg-surface-hover text-text-muted rounded-2xl font-bold">
              القائمة الرئيسية
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
