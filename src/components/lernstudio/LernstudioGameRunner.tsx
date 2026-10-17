import React, { useState, useMemo } from 'react';
import { LernstudioSet, LernstudioItem, LernstudioExerciseType, LernstudioTheme } from '../../types/lernstudio';
import { CheckCircle2, XCircle, RotateCcw, ArrowRight, Award, Trophy, HelpCircle, Eye, RefreshCw, ThumbsUp } from 'lucide-react';
import { playLernstudioSound } from '../../utils/lernstudioAudioUtils';
import { getLernstudioTranslations, getLocalizedSetTitle, getItemTranslation } from '../../utils/lernstudioTranslations';

interface Props {
  set: LernstudioSet;
  activeTheme: LernstudioTheme;
  language: string;
  onBack: () => void;
}

export const LernstudioGameRunner: React.FC<Props> = ({ set, activeTheme, language = 'ar', onBack }) => {
  const t = getLernstudioTranslations(language);

  const [selectedGameType, setSelectedGameType] = useState<LernstudioExerciseType>('multiple_choice');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Game specific states
  const [userAnswerText, setUserAnswerText] = useState('');
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [sentenceBuilt, setSentenceBuilt] = useState<string[]>([]);
  const [scrambledSelected, setScrambledSelected] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string; showSolution?: boolean } | null>(null);
  const [teacherOverride, setTeacherOverride] = useState(false);

  const items = useMemo(() => set.items || [], [set.items]);
  const currentItem: LernstudioItem | undefined = items[currentIndex];

  // Prepare Multiple Choice Options (German Target Words)
  const mcOptions = useMemo(() => {
    if (!currentItem || selectedGameType !== 'multiple_choice') return [];
    const correct = currentItem.german;
    const distractors = items
      .filter((it) => it.id !== currentItem.id)
      .map((it) => it.german)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const all = [correct, ...distractors].sort(() => 0.5 - Math.random());
    return all;
  }, [currentItem, items, selectedGameType, currentIndex]);

  // Prepare Scrambled Letters
  const scrambledLetters = useMemo(() => {
    if (!currentItem || selectedGameType !== 'scrambled_letters') return [];
    const cleanWord = currentItem.german.replace(/^(der|die|das)\s+/i, '').trim();
    const chars = cleanWord.split('').map((char, index) => ({ id: index, char }));
    return chars.sort(() => 0.5 - Math.random());
  }, [currentItem, selectedGameType, currentIndex]);

  // Prepare Sentence 4 Elements
  const sentenceElements = useMemo(() => {
    if (!currentItem) return [];
    if (currentItem.sentence4Elements && currentItem.sentence4Elements.length === 4) {
      return [...currentItem.sentence4Elements].sort(() => 0.5 - Math.random());
    }
    const sent = currentItem.exampleSentenceGerman || `${currentItem.german} ist gut`;
    const words = sent.split(' ');
    if (words.length >= 4) {
      const chunk = Math.ceil(words.length / 4);
      return [
        words.slice(0, chunk).join(' '),
        words.slice(chunk, chunk * 2).join(' '),
        words.slice(chunk * 2, chunk * 3).join(' '),
        words.slice(chunk * 3).join(' ')
      ].sort(() => 0.5 - Math.random());
    }
    return [currentItem.german, 'ist', 'sehr', 'schön'].sort(() => 0.5 - Math.random());
  }, [currentItem, currentIndex]);

  const resetQuestionState = () => {
    setUserAnswerText('');
    setSelectedOptionIndex(null);
    setSentenceBuilt([]);
    setScrambledSelected([]);
    setFeedback(null);
    setTeacherOverride(false);
  };

  const handleNextQuestion = () => {
    resetQuestionState();
    if (currentIndex + 1 < items.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      /* confetti removed */
    }
  };

  const handleRestartGame = () => {
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

    const isCorrect = opt.trim().toLowerCase() === currentItem.german.trim().toLowerCase();
    if (isCorrect) {
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.rightAnswerMsg });
      playLernstudioSound('correct');
      /* confetti removed */
      setTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.wrongAnswerMsg} (حاول مرة أخرى / Try again)`
      });
      playLernstudioSound('wrong');
      setTimeout(() => {
        setFeedback(null);
        setSelectedOptionIndex(null);
      }, 1000);
    }
  };

  // 2. Missing Letter Check
  const handleCheckMissingLetter = () => {
    if (!currentItem || feedback) return;
    const expectedChar = currentItem.german.replace(/^(der|die|das)\s+/i, '');
    const userClean = userAnswerText.trim().toLowerCase();
    const fullWordClean = expectedChar.trim().toLowerCase();

    const isCorrect = fullWordClean.includes(userClean) || userClean === fullWordClean;
    if (isCorrect || userClean === currentItem.german.toLowerCase()) {
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.rightAnswerMsg });
      playLernstudioSound('correct');
      /* confetti removed */
      setTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.wrongAnswerMsg} (حاول مرة أخرى)`
      });
      playLernstudioSound('wrong');
      setTimeout(() => {
        setFeedback(null);
      }, 1000);
    }
  };

  // 3. Sentence Builder Check
  const handleCheckSentenceBuilder = () => {
    if (!currentItem || feedback) return;
    const constructedSentence = sentenceBuilt.join(' ').trim().toLowerCase();
    const originalTarget = (currentItem.exampleSentenceGerman || `${currentItem.german} ist gut`).trim().toLowerCase();

    const isCorrect = constructedSentence.replace(/[.,!?]/g, '') === originalTarget.replace(/[.,!?]/g, '');

    if (isCorrect || teacherOverride) {
      setScore((s) => s + 15);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.perfectSentenceMsg });
      playLernstudioSound('correct');
      /* confetti removed */
      setTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.reorderSolutionMsg} (حاول مرة أخرى)`,
        showSolution: false
      });
      playLernstudioSound('wrong');
      setTimeout(() => {
        setFeedback(null);
      }, 1200);
    }
  };

  // 4. Emoji Vocabulary Check
  const handleCheckEmojiVocab = () => {
    if (!currentItem || feedback) return;
    const userText = userAnswerText.trim().toLowerCase();
    const targetGerman = currentItem.german.trim().toLowerCase();
    const targetClean = targetGerman.replace(/^(der|die|das)\s+/i, '');

    const isCorrect = userText === targetGerman || userText === targetClean;
    if (isCorrect || teacherOverride) {
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.rightAnswerMsg });
      playLernstudioSound('correct');
      /* confetti removed */
      setTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.wrongAnswerMsg} (حاول مرة أخرى)`
      });
      playLernstudioSound('wrong');
      setTimeout(() => {
        setFeedback(null);
      }, 1000);
    }
  };

  // 5. Scrambled Letters Check
  const handleCheckScrambled = () => {
    if (!currentItem || feedback) return;
    const constructedWord = scrambledSelected.map((i) => scrambledLetters[i].char).join('').toLowerCase();
    const targetWord = currentItem.german.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();

    if (constructedWord === targetWord) {
      setScore((s) => s + 10);
      setStreak((st) => st + 1);
      setFeedback({ isCorrect: true, message: t.rightAnswerMsg });
      playLernstudioSound('correct');
      /* confetti removed */
      setTimeout(() => {
        handleNextQuestion();
      }, 900);
    } else {
      setStreak(0);
      setFeedback({
        isCorrect: false,
        message: `${t.wrongAnswerMsg} (حاول مرة أخرى)`
      });
      playLernstudioSound('wrong');
      setTimeout(() => {
        setFeedback(null);
        setScrambledSelected([]);
      }, 1000);
    }
  };

  if (!currentItem && !isCompleted) {
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
    <div className="p-4 sm:p-6 rounded-3xl space-y-5 transition-all bg-background text-text-main" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-surface/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-surface-border shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-text-muted hover:text-text-main bg-surface-hover rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <ArrowRight className={`w-4 h-4 ${language !== 'ar' ? 'rotate-180' : ''}`} />
            <span>{t.returnToSetsBtn}</span>
          </button>

          <div>
            <h2 className="text-sm sm:text-base font-black text-text-main flex items-center gap-1.5">
              <span>{activeTheme.emoji}</span>
              <span>{getLocalizedSetTitle(set, language)}</span>
            </h2>
            <p className="text-[10px] text-text-muted">
              {t.levelLabel} {set.level} • {items.length} {t.vocabularyCount}
            </p>
          </div>
        </div>

        {/* Score & Progress */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold text-xs flex items-center gap-1.5">
            <Trophy className="w-4 h-4" />
            <span>{t.pointsLabel} {score}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-primary-soft border border-primary-border/40 text-primary font-extrabold text-xs flex items-center gap-1">
            <Award className="w-4 h-4" />
            <span>{t.streakLabel} {streak} 🔥</span>
          </div>
        </div>
      </div>

      {/* Game Type Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-surface/60 p-1.5 rounded-2xl border border-surface-border text-xs font-bold">
        <button
          type="button"
          onClick={() => { setSelectedGameType('multiple_choice'); resetQuestionState(); }}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
            selectedGameType === 'multiple_choice' ? activeTheme.primaryBg : 'hover:bg-surface-hover text-text-muted'
          }`}
        >
          {t.tabMultipleChoice}
        </button>

        <button
          type="button"
          onClick={() => { setSelectedGameType('missing_letter'); resetQuestionState(); }}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
            selectedGameType === 'missing_letter' ? activeTheme.primaryBg : 'hover:bg-surface-hover text-text-muted'
          }`}
        >
          {t.tabMissingLetter}
        </button>

        <button
          type="button"
          onClick={() => { setSelectedGameType('sentence_builder'); resetQuestionState(); }}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
            selectedGameType === 'sentence_builder' ? activeTheme.primaryBg : 'hover:bg-surface-hover text-text-muted'
          }`}
        >
          {t.tabSentenceBuilder}
        </button>

        <button
          type="button"
          onClick={() => { setSelectedGameType('emoji_vocab'); resetQuestionState(); }}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
            selectedGameType === 'emoji_vocab' ? activeTheme.primaryBg : 'hover:bg-surface-hover text-text-muted'
          }`}
        >
          {t.tabEmojiVocab}
        </button>

        <button
          type="button"
          onClick={() => { setSelectedGameType('scrambled_letters'); resetQuestionState(); }}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            selectedGameType === 'scrambled_letters' ? activeTheme.primaryBg : 'hover:bg-surface-hover text-text-muted'
          }`}
        >
          {t.tabScrambledLetters}
        </button>
      </div>

      {/* Game Area */}
      {isCompleted ? (
        <div className={`p-8 rounded-3xl text-center space-y-5 ${activeTheme.cardBg}`}>
          <Trophy className="w-16 h-16 text-amber-500 mx-auto" />
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
      ) : (
        currentItem && (
          <div className={`p-5 sm:p-7 rounded-3xl space-y-6 shadow-lg border ${activeTheme.cardBg}`}>
            {/* Question Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-extrabold text-text-muted">
                <span>{t.questionProgress} {currentIndex + 1} / {items.length}</span>
                <span>{Math.round(((currentIndex + 1) / items.length) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
                />
              </div>
            </div>

            {/* GAME 1: MULTIPLE CHOICE */}
            {selectedGameType === 'multiple_choice' && (
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
                    {currentItem.missingLetterWord || currentItem.german.replace(/[aeiou]/g, '_')}
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
                  {sentenceBuilt.length === 0 ? (
                    <span className="text-xs text-text-muted font-bold">...</span>
                  ) : (
                    sentenceBuilt.map((elem, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSentenceBuilt((prev) => prev.filter((_, i) => i !== idx))}
                        className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer hover:bg-red-500 transition-colors font-mono"
                      >
                        {elem} ×
                      </button>
                    ))
                  )}
                </div>

                {/* Elements choices */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" dir="ltr">
                  {sentenceElements.map((elem, idx) => {
                    const isUsed = sentenceBuilt.includes(elem);
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isUsed || feedback !== null}
                        onClick={() => setSentenceBuilt((prev) => [...prev, elem])}
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
                    disabled={feedback !== null || sentenceBuilt.length === 0}
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
                    <span>{currentIndex + 1 < items.length ? (language === 'ar' ? 'السؤال التالي ➔' : 'Next Question ➔') : (language === 'ar' ? 'إنهاء التدريب 🎉' : 'Finish Practice 🎉')}</span>
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
