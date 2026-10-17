import React, { useState, useMemo } from 'react';
import { LernstudioSet, LernstudioTheme, TeamScore } from '../../../types/lernstudio';
import { buildSentenceGameQuestions, SentenceGameQuestion } from '../../../utils/lernstudioQuestionAdapter';
import { playLernstudioSound } from '../../../utils/lernstudioAudioUtils';
import { getLernstudioTranslations } from '../../../utils/lernstudioTranslations';
import {
  ArrowLeft,
  Volume2,
  RotateCcw,
  Undo2,
  CheckCircle2,
  XCircle,
  Trophy,
  Sparkles,
  Lightbulb,
  Flame,
  Users,
  User
} from 'lucide-react';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language?: string;
  onBack: () => void;
}

export const LernstudioSentenceGame: React.FC<Props> = ({
  set,
  activeTheme,
  language = 'ar',
  onBack
}) => {
  const t = getLernstudioTranslations(language);
  const isRtl = language === 'ar';

  const defaultTeams: TeamScore[] = useMemo(() => [
    { id: 'team_red', name: isRtl ? 'الفريق الأحمر 🦁' : 'Team Red 🦁', color: 'from-rose-500 to-red-600', score: 0 },
    { id: 'team_blue', name: isRtl ? 'الفريق الأزرق 🦅' : 'Team Blue 🦅', color: 'from-blue-500 to-cyan-600', score: 0 },
    { id: 'team_green', name: isRtl ? 'الفريق الأخضر 🐉' : 'Team Green 🐉', color: 'from-emerald-500 to-teal-600', score: 0 },
    { id: 'team_gold', name: isRtl ? 'الفريق الذهبي 👑' : 'Team Gold 👑', color: 'from-amber-500 to-yellow-600', score: 0 },
  ], [isRtl]);

  const questions = useMemo(() => buildSentenceGameQuestions(set), [set]);

  const [gameMode, setGameMode] = useState<'solo' | 'team'>('solo');
  const [teams, setTeams] = useState<TeamScore[]>(defaultTeams.slice(0, 2));
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedWordIndices, setSelectedWordIndices] = useState<number[]>([]);
  const [checkedState, setCheckedState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [streak, setStreak] = useState(0);
  const [soloScore, setSoloScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const currentQ: SentenceGameQuestion | undefined = questions[currentIndex];

  const handleSpeak = (text: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Speech synthesis not available
    }
  };

  const handleSelectWord = (bankIndex: number) => {
    if (checkedState !== 'idle') return;
    if (selectedWordIndices.includes(bankIndex)) return;
    setSelectedWordIndices((prev) => [...prev, bankIndex]);
    playLernstudioSound('card_flip');
  };

  const handleRemoveWord = (slotIndex: number) => {
    if (checkedState !== 'idle') return;
    setSelectedWordIndices((prev) => prev.filter((_, idx) => idx !== slotIndex));
    playLernstudioSound('card_flip');
  };

  const handleUndo = () => {
    if (checkedState !== 'idle') return;
    setSelectedWordIndices((prev) => prev.slice(0, -1));
    playLernstudioSound('card_flip');
  };

  const handleReset = () => {
    if (checkedState !== 'idle') return;
    setSelectedWordIndices([]);
    setShowHint(false);
  };

  const handleCheck = () => {
    if (!currentQ || checkedState !== 'idle') return;

    const constructedSentence = selectedWordIndices
      .map((idx) => currentQ.scrambledWords[idx])
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const expectedSentence = currentQ.germanFull.replace(/\s+/g, ' ').trim();

    if (constructedSentence === expectedSentence) {
      setCheckedState('correct');
      playLernstudioSound('correct');
      handleSpeak(currentQ.germanFull);

      if (gameMode === 'solo') {
        setSoloScore((s) => s + 15);
        setStreak((st) => st + 1);
      } else {
        setTeams((prev) =>
          prev.map((team, i) =>
            i === currentTeamIndex ? { ...team, score: team.score + 15 } : team
          )
        );
      }
    } else {
      setCheckedState('wrong');
      playLernstudioSound('wrong');
      if (gameMode === 'solo') {
        setStreak(0);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedWordIndices([]);
      setCheckedState('idle');
      setShowHint(false);
      if (gameMode === 'team') {
        setCurrentTeamIndex((prev) => (prev + 1) % teams.length);
      }
    } else {
      setIsGameOver(true);
      playLernstudioSound('powerup_star');
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedWordIndices([]);
    setCheckedState('idle');
    setStreak(0);
    setSoloScore(0);
    setShowHint(false);
    setIsGameOver(false);
    setTeams(defaultTeams.slice(0, 2));
    setCurrentTeamIndex(0);
  };

  if (questions.length === 0) {
    return (
      <div className={`min-h-[85vh] p-6 text-center flex flex-col items-center justify-center space-y-4 rounded-3xl ${activeTheme.bgGradient}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-4xl">✍️</div>
        <h2 className="text-lg font-black text-white">{t.sentenceGameHeader}</h2>
        <p className="text-sm text-slate-300 max-w-md">
          {isRtl ? 'لا توجد أسئلة أو جمل كافية لإنشاء لعبة بناء الجمل في هذه المجموعة.' : 'No sentence questions available for this set.'}
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs cursor-pointer hover:bg-slate-700 border border-slate-700 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
          <span>{t.gamesPortalBack}</span>
        </button>
      </div>
    );
  }

  if (isGameOver) {
    return (
      <div className={`p-6 rounded-3xl min-h-[85vh] flex flex-col items-center justify-center text-center space-y-6 ${activeTheme.bgGradient}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-3xl max-w-lg w-full space-y-6 shadow-2xl animate-scale-up">
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-black text-white mb-2">
              {t.sentenceVictoryTitle}
            </h2>
          </div>

          {gameMode === 'solo' ? (
            <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 inline-flex items-center gap-6">
              <div>
                <span className="text-xs text-slate-400 block font-bold">{t.pointsLabel}</span>
                <span className="text-3xl font-black text-amber-400">{soloScore}</span>
              </div>
              <div className="w-px h-10 bg-slate-700" />
              <div>
                <span className="text-xs text-slate-400 block font-bold">{t.questionProgress}</span>
                <span className="text-3xl font-black text-emerald-400">{questions.length}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {teams.map((team) => (
                <div key={team.id} className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-center">
                  <span className="text-xs font-bold text-slate-300 block truncate">{team.name}</span>
                  <span className="text-2xl font-black text-amber-400 mt-1 block">{team.score}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={handleRestart}
              className="px-6 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white font-black text-sm cursor-pointer shadow-lg inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.restartGameBtn}</span>
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer border border-slate-700 inline-flex items-center gap-2"
            >
              <ArrowLeft className={`w-4 h-4 ${isRtl ? '' : 'rotate-180'}`} />
              <span>{t.gamesPortalBack}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 rounded-3xl min-h-[85vh] flex flex-col justify-between bg-background text-text-main" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl border border-slate-800 shadow-md flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
            title={t.gamesPortalBack}
          >
            <ArrowLeft className={`w-5 h-5 ${isRtl ? '' : 'rotate-180'}`} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">✍️</span>
              <h1 className="text-base sm:text-lg font-black text-white">
                {t.sentenceGameHeader}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                {t.questionProgress} {currentIndex + 1} / {questions.length}
              </span>
            </div>
          </div>
        </div>

        {/* Mode & Score controls */}
        <div className="flex items-center gap-2.5">
          {/* Mode Switcher */}
          <div className="bg-slate-800 p-1 rounded-2xl border border-slate-700 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setGameMode('solo');
                setCurrentIndex(0);
                setSelectedWordIndices([]);
                setCheckedState('idle');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                gameMode === 'solo' ? 'bg-primary text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t.soloLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGameMode('team');
                setCurrentIndex(0);
                setSelectedWordIndices([]);
                setCheckedState('idle');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                gameMode === 'team' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.teamLabel}</span>
            </button>
          </div>

          {/* Score / Streak */}
          {gameMode === 'solo' ? (
            <div className="flex items-center gap-2">
              <div className="bg-slate-800/90 px-3.5 py-1.5 rounded-2xl border border-slate-700 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-black text-amber-400">{soloScore}</span>
              </div>
              {streak > 1 && (
                <div className="bg-rose-500/20 px-2.5 py-1.5 rounded-2xl border border-rose-500/40 flex items-center gap-1 text-rose-400 animate-pulse">
                  <Flame className="w-3.5 h-3.5" />
                  <span className="text-xs font-black">{streak}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {teams.map((team, idx) => (
                <div
                  key={team.id}
                  className={`px-3 py-1 rounded-2xl border text-xs font-bold transition-all ${
                    idx === currentTeamIndex
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>{team.name.split(' ')[0]}: </span>
                  <span className="font-black text-white">{team.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Game Stage */}
      {currentQ && (
        <div className="max-w-3xl w-full mx-auto my-auto py-6 space-y-6">
          {/* Target Translation Box */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl text-center space-y-2 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span>{t.targetTranslationLabel}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white" dir={isRtl ? 'rtl' : 'ltr'}>
              {currentQ.arabicFull}
            </h2>
            <button
              onClick={() => handleSpeak(currentQ.germanFull)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold mt-1"
            >
              <Volume2 className="w-4 h-4 text-sky-400" />
              <span>{t.listenAudio}</span>
            </button>
          </div>

          {/* Construction Target Area */}
          <div className="bg-slate-950/80 border-2 border-dashed border-slate-800 p-4 sm:p-6 rounded-3xl min-h-[100px] flex flex-wrap items-center justify-center gap-2.5 transition-all">
            {selectedWordIndices.length === 0 ? (
              <span className="text-xs text-slate-500 font-bold">
                {t.dragOrTapWords}
              </span>
            ) : (
              selectedWordIndices.map((bankIdx, slotIdx) => (
                <button
                  key={`${bankIdx}_${slotIdx}`}
                  type="button"
                  disabled={checkedState !== 'idle'}
                  onClick={() => handleRemoveWord(slotIdx)}
                  className="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm sm:text-base shadow-lg hover:bg-rose-500 transition-all cursor-pointer transform hover:scale-105 active:scale-95 border border-primary/50"
                >
                  {currentQ.scrambledWords[bankIdx]}
                </button>
              ))
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={checkedState !== 'idle' || selectedWordIndices.length === 0}
                onClick={handleUndo}
                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold text-xs cursor-pointer border border-slate-700 inline-flex items-center gap-1.5"
              >
                <Undo2 className="w-4 h-4" />
                <span className="hidden sm:inline">{t.undoBtnLabel}</span>
              </button>
              <button
                type="button"
                disabled={checkedState !== 'idle' || selectedWordIndices.length === 0}
                onClick={handleReset}
                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold text-xs cursor-pointer border border-slate-700 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">{t.resetBtnLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="p-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs cursor-pointer border border-amber-500/30 inline-flex items-center gap-1.5"
              >
                <Lightbulb className="w-4 h-4" />
                <span>{t.hintBtnLabel}</span>
              </button>
            </div>

            {checkedState === 'idle' ? (
              <button
                type="button"
                disabled={selectedWordIndices.length === 0}
                onClick={handleCheck}
                className="py-3 px-6 rounded-2xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-black text-sm cursor-pointer shadow-lg inline-flex items-center gap-2"
              >
                <CheckCircle2 className="w-4.5 h-4.5" />
                <span>{t.checkAnswerBtn}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="py-3 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm cursor-pointer shadow-lg inline-flex items-center gap-2"
              >
                <span>{t.nextQuestionBtn}</span>
              </button>
            )}
          </div>

          {/* Hint Overlay */}
          {showHint && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-amber-300 text-xs font-bold text-center animate-fade-in">
              💡 {t.targetWordMsg} <span className="font-mono underline">{currentQ.germanFull.split(' ')[0]} ...</span>
            </div>
          )}

          {/* Feedback Banner */}
          {checkedState === 'correct' && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3 text-emerald-400 animate-fade-in">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-black text-sm">{t.perfectSentenceMsg}</p>
                <p className="text-xs text-emerald-300/80 mt-0.5">{currentQ.germanFull}</p>
              </div>
            </div>
          )}

          {checkedState === 'wrong' && (
            <div className="bg-rose-500/20 border border-rose-500/40 p-4 rounded-2xl flex items-center gap-3 text-rose-400 animate-fade-in">
              <XCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-black text-sm">{t.wrongAnswerMsg}</p>
                <p className="text-xs font-bold text-white mt-0.5" dir="ltr">{currentQ.germanFull}</p>
              </div>
            </div>
          )}

          {/* Word Bank */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 sm:p-5 rounded-3xl space-y-3">
            <div className="text-xs font-bold text-slate-400 text-center">
              {t.dragOrTapWords}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {currentQ.scrambledWords.map((word, bankIdx) => {
                const isUsed = selectedWordIndices.includes(bankIdx);
                return (
                  <button
                    key={bankIdx}
                    type="button"
                    disabled={isUsed || checkedState !== 'idle'}
                    onClick={() => handleSelectWord(bankIdx)}
                    className={`px-4 py-2.5 rounded-2xl font-bold text-sm transition-all cursor-pointer border ${
                      isUsed
                        ? 'bg-slate-800/40 text-slate-600 border-slate-800/40 opacity-40 cursor-not-allowed scale-95'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700 hover:border-primary shadow-sm hover:scale-105 active:scale-95'
                    }`}
                  >
                    {word}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
