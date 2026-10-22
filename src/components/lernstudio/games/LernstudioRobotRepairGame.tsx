import React, { useState, useEffect } from 'react';
import { LernstudioSet, LernstudioTheme } from '../../../types/lernstudio';
import { getSetVocabularyItems, AdaptedVocabItem, getDistractorChoices } from '../../../utils/lernstudioVocabularyAdapter';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText, stopGermanSpeech } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations } from '../../../utils/lernstudioTranslations';
import { ArrowLeft, Volume2, RotateCcw, Trophy, Cpu, Sparkles, CheckCircle2, Wrench } from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

const ROBOT_PARTS = [
  'الهيكل الخارجي (Main Frame)',
  'الرأس والمعالج (Robot Head)',
  'العين الشاشية (Digital Visor)',
  'الهوائي المضيء (Signal Antenna)',
  'الذراع الأيمن (Right Arm)',
  'الذراع الأيسر (Left Arm)',
  'قلب الطاقة (Power Core)',
  'بطارية اللليثيوم (Energy Battery)',
  'القدم اليمنى (Right Leg)',
  'القدم اليسرى (Left Leg)'
];

export const LernstudioRobotRepairGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';

  const vocabItems = getSetVocabularyItems(set, language);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [repairedParts, setRepairedParts] = useState<number>(0);
  const [score, setScore] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isVictory, setIsVictory] = useState(false);

  const currentItem = vocabItems[currentIndex];
  const choices = currentItem ? getDistractorChoices(currentItem, vocabItems) : [];

  // Auto-pronounce German word
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
      setRepairedParts((p) => p + 1);

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
    setRepairedParts(0);
    setScore(0);
    setIsAnswerSubmitted(false);
    setSelectedChoice(null);
    setIsCorrect(null);
    setIsVictory(false);
  };

  return (
    <div className="p-4 sm:p-6 rounded-3xl min-h-[85vh] flex flex-col justify-between bg-background text-text-main" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Header Bar */}
      <div className="bg-surface border border-surface-border p-4 rounded-3xl shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 rounded-2xl bg-surface-hover text-text-muted hover:text-text-main cursor-pointer">
            <ArrowLeft className={`w-5 h-5 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <h1 className="text-base sm:text-lg font-black text-text-main">إصلاح الروبوت (Robot Repair)</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-black">
          <span className="px-3 py-1.5 rounded-xl bg-primary-soft text-primary">النقاط: {score}</span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">الأجزاء: {repairedParts}/10</span>
        </div>
      </div>

      {/* Main Stage */}
      {!isVictory ? (
        <div className="max-w-2xl w-full mx-auto my-auto space-y-6">
          {/* Robot Visual Progress Panel */}
          <div className="bg-surface/80 border border-surface-border p-6 rounded-3xl text-center space-y-3 relative overflow-hidden shadow-sm">
            <div className="flex justify-center items-center gap-2">
              <Cpu className="w-5 h-5 text-primary animate-pulse" />
              <span className="text-xs font-bold text-text-muted">جاري تجميع الجزء #{repairedParts + 1}: {ROBOT_PARTS[repairedParts] || 'النواة'}</span>
            </div>

            {/* Robot Avatar Build */}
            <div className="text-7xl sm:text-8xl transition-all transform scale-105">
              {repairedParts === 0 && '⚙️'}
              {repairedParts > 0 && repairedParts < 4 && '🤖'}
              {repairedParts >= 4 && repairedParts < 8 && '🤖⚡'}
              {repairedParts >= 8 && '🤖✨'}
            </div>

            {/* Target German Word Box */}
            <div className="p-4 bg-primary-soft/50 border border-primary-border/40 rounded-2xl inline-flex items-center gap-3 justify-center w-full">
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
                  <span className="text-4xl">{choice.emoji}</span>
                  <span className="text-sm font-bold">{choice.translation}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Victory Screen */
        <div className="max-w-md w-full mx-auto my-auto bg-surface border border-surface-border p-8 rounded-3xl text-center space-y-6 shadow-2xl animate-scale-up">
          <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-3xl inline-block">
            <Sparkles className="w-16 h-16 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-text-main">تم إصلاح الروبوت بنجاح! 🤖🎉</h2>
            <p className="text-xs text-text-muted font-bold">جمعت {score} نقطة وأصلحت جميع الأجزاء الـ 10 بكفاءة عالية!</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={handleRestart} className="px-6 py-3 bg-primary text-white rounded-2xl font-bold flex items-center gap-2">
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
