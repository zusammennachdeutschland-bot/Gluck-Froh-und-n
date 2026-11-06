import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LernstudioSet, LernstudioTheme, LernstudioItem } from '../../../types/lernstudio';
import { playLernstudioSound, playGermanVoiceFeedback } from '../../../utils/lernstudioAudioUtils';
import { speakGermanText } from '../../../utils/audioSpeechUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation, getLocalizedTeamName } from '../../../utils/lernstudioTranslations';
import { GameStageBanner, SharedVictoryTrophyArt } from '../GameArtAssets';
import { useGameEffects } from '../effects/useGameEffects';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Volume2,
  Users,
  User,
  Sparkles,
  Zap,
  Flame,
  Bot,
  Swords,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

interface QuestionData {
  item: LernstudioItem;
  prompt: string;
  options: string[];
  correctAnswer: string;
  type: 'meaning' | 'article' | 'reverse';
}

export const LernstudioTugOfWarGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';
  const displayTitle = getLocalizedSetTitle(set, language);
  const items = useMemo(() => set.items || [], [set.items]);
  const { triggerSparkles, triggerScorePopup, triggerCelebration, EffectsOverlay, SettingsBar } = useGameEffects(language);

  // Game Settings
  const [gameMode, setGameMode] = useState<'teams' | 'vs_bot'>('teams');
  const [team1Name, setTeam1Name] = useState<string>(() => getLocalizedTeamName('teamRed', language, 'الفريق الأحمر 🔴'));
  const [team2Name, setTeam2Name] = useState<string>(() => getLocalizedTeamName('teamBlue', language, 'الفريق الأزرق 🔵'));

  useEffect(() => {
    setTeam1Name(getLocalizedTeamName('teamRed', language, 'الفريق الأحمر 🔴'));
    setTeam2Name(getLocalizedTeamName('teamBlue', language, 'الفريق الأزرق 🔵'));
  }, [language]);
  
  // Game State
  // ropePosition: from -100 (Team 1 wins) to +100 (Team 2 / Bot wins), 0 is middle
  const [ropePosition, setRopePosition] = useState<number>(0);
  const [currentTurn, setCurrentTurn] = useState<1 | 2>(1);
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);
  const [team1Streak, setTeam1Streak] = useState<number>(0);
  const [team2Streak, setTeam2Streak] = useState<number>(0);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const maxRounds = 12;

  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [winner, setWinner] = useState<1 | 2 | 'draw' | null>(null);
  const [pullAnimation, setPullAnimation] = useState<'left' | 'right' | null>(null);

  // Question State
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);

  // Generate Questions from items
  const questions: QuestionData[] = useMemo(() => {
    if (!items.length) return [];
    const safeLang = (language || 'ar').toLowerCase();
    
    return items.map((item, idx) => {
      const otherItems = items.filter((_, i) => i !== idx);
      
      // Determine question type: if item has article, occasionally do article quiz
      const canDoArticle = Boolean(item.article);
      const isArticleQ = canDoArticle && Math.random() > 0.55;

      if (isArticleQ) {
        const cleanNoun = item.german.replace(/^(der|die|das)\s+/i, '');
        const articlePrompt =
          safeLang === 'en'
            ? `What is the correct definite article for "${cleanNoun}"?`
            : safeLang === 'de'
            ? `Welcher Artikel gehört zu "${cleanNoun}"?`
            : `ما هي أداة التعريف الصحيحة لـ "${cleanNoun}"؟`;

        return {
          item,
          prompt: articlePrompt,
          options: ['der', 'die', 'das'],
          correctAnswer: item.article || 'der',
          type: 'article'
        };
      }

      // Normal translation: German to Target Language
      const wrongTrans = otherItems
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map((it) => getItemTranslation(it, language));
      
      const targetTrans = getItemTranslation(item, language);
      const options = [targetTrans, ...wrongTrans].sort(() => 0.5 - Math.random());

      const qPrompt =
        safeLang === 'en'
          ? `What is the meaning of "${item.german}"?`
          : safeLang === 'de'
          ? `Was bedeutet das Wort "${item.german}"?`
          : `ما هو المعنى العربي لكلمة "${item.german}"؟`;

      return {
        item,
        prompt: qPrompt,
        options,
        correctAnswer: targetTrans,
        type: 'meaning'
      };
    });
  }, [items, language]);

  const currentQ = questions[questionIndex % Math.max(1, questions.length)];

  // Trigger sound and speech when turn starts
  useEffect(() => {
    if (currentQ?.item?.german && currentTurn === 1) {
      speakGermanText(currentQ.item.german);
    }
  }, [questionIndex, currentTurn]);

  // Bot Turn Logic
  useEffect(() => {
    if (gameMode === 'vs_bot' && currentTurn === 2 && !isGameOver && !isAnswered && currentQ) {
      setIsBotThinking(true);
      const botDelay = setTimeout(() => {
        setIsBotThinking(false);
        // Bot has ~70% accuracy
        const willBeCorrect = Math.random() < 0.70;
        const botAnswer = willBeCorrect
          ? currentQ.correctAnswer
          : currentQ.options.find((opt) => opt !== currentQ.correctAnswer) || currentQ.correctAnswer;
        
        handleAnswer(botAnswer, 2);
      }, 1600);

      return () => clearTimeout(botDelay);
    }
  }, [currentTurn, gameMode, isGameOver, isAnswered, currentQ]);

  // Handle answering
  const handleAnswer = (answer: string, answeringTeam: 1 | 2) => {
    if (isAnswered || isGameOver || !currentQ) return;
    setIsAnswered(true);
    setSelectedOption(answer);

    const isCorrect = answer === currentQ.correctAnswer;
    const isTeam1 = answeringTeam === 1;

    if (isCorrect) {
      playLernstudioSound('correct');
      playGermanVoiceFeedback('correct');
      triggerSparkles(isTeam1 ? 30 : 70, 45, isTeam1 ? '#f43f5e' : '#3b82f6');
      triggerScorePopup('+15 🪢', isTeam1 ? 30 : 70, 35, 'positive');

      const streak = isTeam1 ? team1Streak + 1 : team2Streak + 1;
      if (isTeam1) {
        setTeam1Streak(streak);
        setTeam1Score((prev) => prev + (streak > 1 ? 25 : 15));
      } else {
        setTeam2Streak(streak);
        setTeam2Score((prev) => prev + (streak > 1 ? 25 : 15));
      }

      // Pull rope: Team 1 pulls Left (-), Team 2 pulls Right (+)
      const pullAmount = streak > 1 ? 24 : 16;
      setPullAnimation(isTeam1 ? 'left' : 'right');

      setRopePosition((prev) => {
        const nextPos = isTeam1 ? prev - pullAmount : prev + pullAmount;
        // Check instant win
        if (nextPos <= -85) {
          triggerGameOver(1);
          return -100;
        } else if (nextPos >= 85) {
          triggerGameOver(2);
          return 100;
        }
        return nextPos;
      });

      setFeedback({
        isCorrect: true,
        message: streak > 1
          ? (language === 'ar' ? 'سحبة نارية عملاقة! 🔥 +25 نقطة' : language === 'de' ? 'Riesiger Feuerzug! 🔥 +25 Punkte' : 'Giant fire pull! 🔥 +25 pts')
          : (language === 'ar' ? 'سحبة قوية وصحيحة! 💪 +15 نقطة' : language === 'de' ? 'Starker richtiger Zug! 💪 +15 Punkte' : 'Strong correct pull! 💪 +15 pts')
      });
    } else {
      playLernstudioSound('wrong');
      playGermanVoiceFeedback('wrong');
      if (isTeam1) {
        setTeam1Streak(0);
      } else {
        setTeam2Streak(0);
      }

      // Slight slip back
      const slipAmount = 6;
      setRopePosition((prev) => {
        return isTeam1 ? Math.min(85, prev + slipAmount) : Math.max(-85, prev - slipAmount);
      });

      setFeedback({
        isCorrect: false,
        message: language === 'ar'
          ? `إجابة غير صحيحة! الصحيح هو: "${currentQ.correctAnswer}"`
          : language === 'de'
          ? `Falsche Antwort! Richtig ist: "${currentQ.correctAnswer}"`
          : `Wrong answer! Correct is: "${currentQ.correctAnswer}"`
      });
    }

    // Auto advance to next turn after delay (allowing full German speech + grace period)
    setTimeout(() => {
      setPullAnimation(null);
      setIsAnswered(false);
      setSelectedOption(null);
      setFeedback(null);

      // Check if max rounds reached
      if (roundNumber >= maxRounds && !isGameOver) {
        finishGameByPosition();
      } else {
        setRoundNumber((r) => r + 1);
        setCurrentTurn((t) => (t === 1 ? 2 : 1));
        setQuestionIndex((q) => q + 1);
      }
    }, isCorrect ? 2000 : 2800);
  };

  const triggerGameOver = (victor: 1 | 2) => {
    setIsGameOver(true);
    setWinner(victor);
    playLernstudioSound('victory');
    playGermanVoiceFeedback('victory');
    const victorName = victor === 1 ? team1Name : (gameMode === 'vs_bot' ? t.smartBot : team2Name);
    const winMsg = language === 'ar' ? `فاز ${victorName}! 🪢` : language === 'de' ? `${victorName} hat gewonnen! 🪢` : `${victorName} won! 🪢`;
    triggerCelebration(winMsg);
  };

  const finishGameByPosition = () => {
    setIsGameOver(true);
    if (ropePosition < -5) {
      setWinner(1);
    } else if (ropePosition > 5) {
      setWinner(2);
    } else {
      setWinner('draw');
    }
    playLernstudioSound('victory');
    playGermanVoiceFeedback('victory');
    triggerCelebration(language === 'ar' ? 'نهاية شد الحبل! 🪢' : language === 'de' ? 'Ende des Tauziehens! 🪢' : 'Tug of war ended! 🪢');
  };

  const restartGame = () => {
    setRopePosition(0);
    setCurrentTurn(1);
    setTeam1Score(0);
    setTeam2Score(0);
    setTeam1Streak(0);
    setTeam2Streak(0);
    setRoundNumber(1);
    setIsGameOver(false);
    setWinner(null);
    setQuestionIndex(0);
    setIsAnswered(false);
    setSelectedOption(null);
    setFeedback(null);
    setIsBotThinking(false);
  };

  if (!items.length) {
    return (
      <div className="p-6 bg-surface rounded-2xl border border-surface-border text-center space-y-4">
        <p className="text-text-muted">{t.notEnoughWords}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-primary text-white rounded-xl font-bold cursor-pointer"
        >
          {t.gamesPortalBack}
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-[85vh] p-3 sm:p-5 rounded-3xl space-y-4 select-none transition-all bg-background text-text-main relative overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <EffectsOverlay />
      {/* Top Header */}
      <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-surface-border shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-surface-hover text-text-main hover:bg-primary hover:text-white transition-all cursor-pointer border border-surface-border inline-flex items-center gap-1.5 text-xs font-bold shrink-0"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
            <span>{t.gamesPortalBack}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl">🪢</span>
            <div>
              <h1 className="text-sm sm:text-base font-black text-text-main">
                {t.tugOfWarTitle}
              </h1>
              <p className="text-[11px] text-text-muted font-bold truncate">
                {displayTitle} • {language === 'ar' ? `الجولة ${roundNumber} من ${maxRounds}` : language === 'de' ? `Runde ${roundNumber} von ${maxRounds}` : `Round ${roundNumber} of ${maxRounds}`}
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector and Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <SettingsBar />
          <div className="flex items-center bg-surface-hover p-1 rounded-xl border border-surface-border text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setGameMode('teams');
                restartGame();
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                gameMode === 'teams' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.teamsLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGameMode('vs_bot');
                restartGame();
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                gameMode === 'vs_bot' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{t.vsBot}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={restartGame}
            className="p-2 bg-surface-hover hover:bg-surface-border text-text-main rounded-xl border border-surface-border transition-all cursor-pointer"
            title={language === 'ar' ? 'إعادة اللعبة' : language === 'de' ? 'Spiel neu starten' : 'Restart game'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <GameStageBanner
        mode="tug_of_war"
        title={t.tugOfWarTitle}
        subtitle={
          language === 'ar'
            ? `${displayTitle} • اسحب الحبل بقوة عبر الإجابات الصحيحة!`
            : language === 'de'
            ? `${displayTitle} • Ziehe das Seil mit richtigen Antworten!`
            : `${displayTitle} • Pull the rope strongly with correct answers!`
        }
        badgeText={language === 'ar' ? `الجولة ${roundNumber}/${maxRounds}` : language === 'de' ? `Runde ${roundNumber}/${maxRounds}` : `Round ${roundNumber}/${maxRounds}`}
      />

      {/* Scoreboard Bar */}
      <div className="grid grid-cols-2 gap-3">
        {/* Team 1 Card */}
        <div
          className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
            currentTurn === 1
              ? 'bg-rose-500/10 border-rose-500/50 shadow-md ring-2 ring-rose-500/30'
              : 'bg-surface border-surface-border/60 opacity-85'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black text-lg shadow-xs">
              🔴
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
                {team1Name}
              </div>
              <div className="text-[11px] font-bold text-text-muted flex items-center gap-1">
                <span>{team1Score} {t.pointsUnit}</span>
                {team1Streak > 1 && (
                  <span className="text-amber-500 flex items-center font-black">
                    <Flame className="w-3 h-3 fill-current" /> {team1Streak}x
                  </span>
                )}
              </div>
            </div>
          </div>
          {currentTurn === 1 && !isGameOver && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
              {t.activeTurnBadge}
            </span>
          )}
        </div>

        {/* Team 2 / Bot Card */}
        <div
          className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
            currentTurn === 2
              ? 'bg-blue-500/10 border-blue-500/50 shadow-md ring-2 ring-blue-500/30'
              : 'bg-surface border-surface-border/60 opacity-85'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center font-black text-lg shadow-xs">
              {gameMode === 'vs_bot' ? '🤖' : '🔵'}
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400">
                {gameMode === 'vs_bot' ? t.smartBot : team2Name}
              </div>
              <div className="text-[11px] font-bold text-text-muted flex items-center gap-1">
                <span>{team2Score} {t.pointsUnit}</span>
                {team2Streak > 1 && (
                  <span className="text-amber-500 flex items-center font-black">
                    <Flame className="w-3 h-3 fill-current" /> {team2Streak}x
                  </span>
                )}
              </div>
            </div>
          </div>
          {currentTurn === 2 && !isGameOver && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500 text-white animate-pulse">
              {gameMode === 'vs_bot' ? `${t.thinkingBot}...` : t.activeTurnBadge}
            </span>
          )}
        </div>
      </div>

      {/* Main Tug Arena */}
      <div className="bg-surface/90 backdrop-blur-sm p-4 sm:p-6 rounded-3xl border border-surface-border shadow-xs relative overflow-hidden space-y-6">
        {/* Tug of War Ground & Rope Area */}
        <div className="relative py-8 px-4 bg-gradient-to-b from-surface-hover/30 via-surface-hover/60 to-surface-hover/30 rounded-2xl border border-surface-border overflow-hidden">
          {/* Middle Goal Line */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-dashed border-r-2 border-dashed border-amber-500/40 z-0 pointer-events-none" />

          {/* Winning Threshold Markers */}
          <div className="absolute top-2 left-6 text-[10px] font-black text-rose-500/60 uppercase">
            {language === 'ar' ? 'منطقة فوز الأحمر ◀' : language === 'de' ? '◀ Roter Sieg' : '◀ Red Victory Zone'}
          </div>
          <div className="absolute top-2 right-6 text-[10px] font-black text-blue-500/60 uppercase">
            {language === 'ar' ? '▶ منطقة فوز الأزرق' : language === 'de' ? 'Blauer Sieg ▶' : 'Blue Victory Zone ▶'}
          </div>

          {/* Interactive Rope with Mascots */}
          <div className="relative flex items-center justify-between z-10">
            {/* Team 1 Pulling Avatars */}
            <div
              className={`flex items-center gap-1 transition-transform duration-300 ${
                pullAnimation === 'left' ? 'scale-110 -translate-x-2' : ''
              }`}
            >
              <div className="text-3xl sm:text-4xl filter drop-shadow">
                🦁
              </div>
              <div className="text-2xl sm:text-3xl filter drop-shadow">
                🧑‍🎓
              </div>
              <div className="text-2xl sm:text-3xl filter drop-shadow">
                💪
              </div>
            </div>

            {/* Rope Track */}
            <div className="flex-1 mx-4 sm:mx-8 relative h-7 flex items-center">
              {/* Rope Base */}
              <div className="w-full h-3.5 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 rounded-full border border-amber-800 shadow-inner relative overflow-hidden">
                {/* Rope Braided Texture Pattern */}
                <div className="w-full h-full opacity-40 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px]" />
              </div>

              {/* Central Red Ribbon / Flag attached to rope */}
              <div
                className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out flex flex-col items-center pointer-events-none"
                style={{
                  left: `calc(50% + ${ropePosition * 0.42}%)`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {/* Red Flag */}
                <div className="w-6 h-6 rounded-md bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[11px] font-black">
                  🚩
                </div>
                {/* Ribbon Ribs */}
                <div className="w-1.5 h-7 bg-rose-600 shadow-xs rounded-full" />
              </div>
            </div>

            {/* Team 2 / Bot Pulling Avatars */}
            <div
              className={`flex items-center gap-1 transition-transform duration-300 ${
                pullAnimation === 'right' ? 'scale-110 translate-x-2' : ''
              }`}
            >
              <div className="text-2xl sm:text-3xl filter drop-shadow">
                💪
              </div>
              <div className="text-2xl sm:text-3xl filter drop-shadow">
                {gameMode === 'vs_bot' ? '⚡' : '🧑‍🎓'}
              </div>
              <div className="text-3xl sm:text-4xl filter drop-shadow">
                {gameMode === 'vs_bot' ? '🤖' : '🐯'}
              </div>
            </div>
          </div>

          {/* Rope Balance Indicator Bar */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="flex items-center justify-between text-[11px] font-bold text-text-muted mb-1">
              <span className="text-rose-500 font-black">{language === 'ar' ? `الأحمر: ${Math.max(0, Math.round(-ropePosition))}%` : language === 'de' ? `Rot: ${Math.max(0, Math.round(-ropePosition))}%` : `Red: ${Math.max(0, Math.round(-ropePosition))}%`}</span>
              <span>{language === 'ar' ? 'توازن الحبل' : language === 'de' ? 'Seilbalance' : 'Rope Balance'}</span>
              <span className="text-blue-500 font-black">{language === 'ar' ? `الأزرق: ${Math.max(0, Math.round(ropePosition))}%` : language === 'de' ? `Blau: ${Math.max(0, Math.round(ropePosition))}%` : `Blue: ${Math.max(0, Math.round(ropePosition))}%`}</span>
            </div>
            <div className="h-2 w-full bg-surface-hover rounded-full overflow-hidden flex">
              <div
                className="bg-rose-500 transition-all duration-300"
                style={{ width: `${Math.max(5, 50 - ropePosition / 2)}%` }}
              />
              <div
                className="bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.max(5, 50 + ropePosition / 2)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question & Turn Interactive Panel */}
        {!isGameOver ? (
          <div className="space-y-4 max-w-2xl mx-auto">
            {/* Active Turn Banner */}
            <div className="flex items-center justify-between bg-surface-hover/80 px-4 py-2.5 rounded-2xl border border-surface-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {currentTurn === 1 ? '🔴' : gameMode === 'vs_bot' ? '🤖' : '🔵'}
                </span>
                <span className="text-xs sm:text-sm font-black text-text-main">
                  {t.currentTurnLabel}:{' '}
                  <span className={currentTurn === 1 ? 'text-rose-500' : 'text-blue-500'}>
                    {currentTurn === 1 ? team1Name : gameMode === 'vs_bot' ? t.smartBot : team2Name}
                  </span>
                </span>
              </div>

              {/* Listen to word audio */}
              {currentQ?.item?.german && (
                <button
                  type="button"
                  onClick={() => {
                    const cleanNoun = currentQ.item.german.replace(/^(der|die|das)\s+/i, '').trim();
                    const textToSpeak = currentQ.type === 'article' && !isAnswered ? cleanNoun : currentQ.item.german;
                    speakGermanText(textToSpeak);
                  }}
                  className="px-3 py-1 bg-surface hover:bg-surface-border text-primary rounded-xl border border-surface-border text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t.pronounceWord}</span>
                </button>
              )}
            </div>

            {/* Word Card / Prompt */}
            <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-surface-border text-center space-y-2 shadow-2xs">
              <div className="text-5xl select-none pt-1">
                {currentQ?.item?.emoji || '🇩🇪'}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-text-main font-mono" dir="ltr">
                {currentQ?.type === 'article' ? (
                  isAnswered ? (
                    <span>
                      <span className="text-primary font-bold underline decoration-2 underline-offset-4">{currentQ?.correctAnswer}</span>{' '}
                      {currentQ?.item?.german?.replace(/^(der|die|das)\s+/i, '').trim()}
                    </span>
                  ) : (
                    <span>
                      <span className="text-primary font-bold opacity-60 border-b-2 border-primary border-dashed px-1 inline-block min-w-[32px]">___</span>{' '}
                      {currentQ?.item?.german?.replace(/^(der|die|das)\s+/i, '').trim()}
                    </span>
                  )
                ) : (
                  currentQ?.item?.german
                )}
              </h2>
              <p className="text-xs sm:text-sm font-bold text-text-muted">
                {currentQ?.prompt}
              </p>
            </div>

            {/* Bot Thinking Animation if vs Bot */}
            {isBotThinking && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-center space-y-2 animate-pulse">
                <Bot className="w-6 h-6 text-blue-500 mx-auto animate-spin" />
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {language === 'ar' ? 'الروبوت يقرأ الكلمة ويستعد للسحب...' : language === 'de' ? 'Der Bot liest das Wort und zieht...' : 'The bot is reading the word and pulling...'}
                </p>
              </div>
            )}

            {/* Options Grid */}
            {!isBotThinking && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentQ?.options.map((opt) => {
                  let btnStyle = 'bg-surface hover:bg-surface-hover border-surface-border/80 text-text-main';

                  if (isAnswered) {
                    if (opt === currentQ.correctAnswer) {
                      btnStyle = 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-[1.01]';
                    } else if (opt === selectedOption) {
                      btnStyle = 'bg-rose-500 text-white border-rose-600';
                    } else {
                      btnStyle = 'bg-surface/40 border-surface-border/30 opacity-40';
                    }
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handleAnswer(opt, currentTurn)}
                      className={`p-3.5 rounded-2xl border font-black text-xs sm:text-sm transition-all cursor-pointer text-center shadow-2xs hover:border-primary/50 disabled:cursor-default flex items-center justify-center gap-2 ${btnStyle}`}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Answer Feedback Toast */}
            {feedback && (
              <div
                className={`p-3 rounded-2xl text-center text-xs font-black transition-all ${
                  feedback.isCorrect
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}
              >
                {feedback.message}
              </div>
            )}
          </div>
        ) : (
          /* Game Over Victory Screen */
          <div className="max-w-md mx-auto text-center p-6 bg-surface rounded-3xl border border-surface-border space-y-5 shadow-lg">
            <div className="flex justify-center">
              <SharedVictoryTrophyArt className="w-28 h-28 rounded-3xl shadow-xl border-2 border-amber-400/50" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-text-main">
                {winner === 1
                  ? (language === 'ar' ? `فاز ${team1Name}! 🎉` : language === 'de' ? `${team1Name} hat gewonnen! 🎉` : `${team1Name} won! 🎉`)
                  : winner === 2
                  ? (language === 'ar' ? `فاز ${gameMode === 'vs_bot' ? t.smartBot : team2Name}! 🎉` : language === 'de' ? `${gameMode === 'vs_bot' ? t.smartBot : team2Name} hat gewonnen! 🎉` : `${gameMode === 'vs_bot' ? t.smartBot : team2Name} won! 🎉`)
                  : t.tieGame}
              </h2>
              <p className="text-xs font-bold text-text-muted">
                {language === 'ar'
                  ? `تم سحب الحبل بنجاح بعد ${roundNumber} جولة من التحديات والمفردات الألمانية!`
                  : language === 'de'
                  ? `Das Seil wurde nach ${roundNumber} Runden erfolgreich gezogen!`
                  : `Tug of war successfully concluded after ${roundNumber} rounds!`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-hover rounded-2xl border border-surface-border text-center">
              <div>
                <div className="text-[11px] font-bold text-text-muted">{team1Name}</div>
                <div className="text-lg font-black text-rose-500">{team1Score} {t.pointsUnit}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-text-muted">
                  {gameMode === 'vs_bot' ? t.vsBot : team2Name}
                </div>
                <div className="text-lg font-black text-blue-500">{team2Score} {t.pointsUnit}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={restartGame}
                className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.playAgain}</span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="py-3 px-4 bg-surface-hover hover:bg-surface-border text-text-main rounded-xl text-xs font-bold border border-surface-border transition-all cursor-pointer"
              >
                {t.gamesPortalBack}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
