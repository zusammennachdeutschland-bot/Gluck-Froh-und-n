import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Volume2, Snail, CheckCircle2, XCircle, Trophy, ArrowRight, RotateCcw, Clock, Sparkles } from 'lucide-react';
import { speakGermanText } from '@shared/audioSpeechUtils';
import { playLernstudioSound, playGermanVoiceFeedback } from '@shared/lernstudioAudioUtils';
import { HomeworkQuestionResponse } from '@shared/homeworkTypes';
import { DEFAULT_LERNSTUDIO_SETS } from '@shared/defaultLernstudioSets';

interface Props {
  assignmentId?: string;
}

export const HomeworkPlayerPage: React.FC<Props> = ({ assignmentId: propId }) => {
  const assignmentId =
    propId ||
    window.location.pathname.replace(/^\/homework\/?/, '').split('/')[0] ||
    '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any | null>(null);

  // Student State
  const [studentName, setStudentName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<HomeworkQuestionResponse[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState<any | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);

  // Fetch Assignment
  useEffect(() => {
    async function loadHomework() {
      try {
        setLoading(true);
        const res = await fetch(`/api/homework/info?id=${encodeURIComponent(assignmentId)}`);
        const text = await res.text();
        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }

        if (res.ok && data && data.setSnapshot) {
          setAssignment(data);
          return;
        }

        // Fallback if Vercel serverless /tmp cold-started without Blob configured
        const params = new URLSearchParams(window.location.search);
        const setId = params.get('s');
        const qCount = Number(params.get('q')) || 10;
        const customTitle = params.get('t');
        const matchedSet =
          (setId && DEFAULT_LERNSTUDIO_SETS.find((s) => s.id === setId)) ||
          DEFAULT_LERNSTUDIO_SETS[0];

        if (matchedSet && (!res.ok && res.status !== 410 && res.status !== 403)) {
          setAssignment({
            id: assignmentId,
            title: customTitle || `Hausaufgabe: ${matchedSet.title}`,
            questionCount: Math.min(qCount, matchedSet.items.length),
            setSnapshot: matchedSet,
            maxAttempts: 0,
            allowReplay: true
          });
        } else {
          setError(data.error || 'Fehler beim Laden der Hausaufgabe');
        }
      } catch (err: any) {
        setError(err.message || 'Verbindungsfehler');
      } finally {
        setLoading(false);
      }
    }
    loadHomework();
  }, [assignmentId]);

  // Question Pool prepared for this assignment
  const questions = useMemo(() => {
    if (!assignment || !assignment.setSnapshot?.items) return [];
    const pool = [...assignment.setSnapshot.items];
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const count = Math.min(assignment.questionCount || 10, shuffled.length);
    return shuffled.slice(0, count);
  }, [assignment]);

  const currentItem = questions[currentIdx];

  // Build 4 multiple choice options for current item
  const currentChoices = useMemo(() => {
    if (!currentItem || !assignment) return [];
    const allItems = assignment.setSnapshot.items;
    const correctLabel = currentItem.german;

    const distractors = allItems
      .filter((it: any) => it.id !== currentItem.id && it.german !== correctLabel)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((it: any) => it.german);

    // Fallbacks if set has fewer than 4 items
    const fallbacks = ['das Buch', 'der Apfel', 'die Schule', 'das Haus', 'die Katze'];
    let fIdx = 0;
    while (distractors.length < 3 && fIdx < fallbacks.length) {
      if (!distractors.includes(fallbacks[fIdx]) && fallbacks[fIdx] !== correctLabel) {
        distractors.push(fallbacks[fIdx]);
      }
      fIdx++;
    }

    return [correctLabel, ...distractors].sort(() => 0.5 - Math.random());
  }, [currentItem, assignment]);

  // Start Assignment
  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    setHasStarted(true);
    setStartTime(new Date().toISOString());
    playLernstudioSound('powerup_star');
  };

  // Submit Answer for Current Question
  const handleAnswer = (chosenGerman: string) => {
    if (selectedChoice !== null || !currentItem) return;
    setSelectedChoice(chosenGerman);

    const isCorrect = chosenGerman.trim().toLowerCase() === currentItem.german.trim().toLowerCase();
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      playLernstudioSound('correct');
      playGermanVoiceFeedback('richtig');
    } else {
      playLernstudioSound('wrong');
      playGermanVoiceFeedback('noch_einmal');
    }

    speakGermanText(currentItem.german, 0.9);

    const newResponse: HomeworkQuestionResponse = {
      questionId: currentItem.id,
      germanWord: currentItem.german,
      studentAnswer: chosenGerman,
      correctAnswer: currentItem.german,
      isCorrect,
      timeSpentSeconds: 3
    };

    const nextResponses = [...responses, newResponse];
    setResponses(nextResponses);

    setTimeout(() => {
      setSelectedChoice(null);
      setFeedback(null);

      if (currentIdx + 1 < questions.length) {
        setCurrentIdx(currentIdx + 1);
      } else {
        // Complete Homework & Submit to server
        handleFinishHomework(nextResponses);
      }
    }, 1300);
  };

  // Finish Homework & Call Server API
  const handleFinishHomework = async (allResponses: HomeworkQuestionResponse[]) => {
    setIsCompleted(true);
    setSubmitting(true);
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });

    const correctCount = allResponses.filter((r) => r.isCorrect).length;
    const totalQ = allResponses.length;
    const localScorePct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;

    try {
      const res = await fetch('/api/homework/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId,
          studentName: studentName.trim(),
          responses: allResponses,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          assignmentFallback: assignment
        })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (res.ok && data.submission) {
        setFinalScore(data.submission);
        playLernstudioSound('fanfare_victory');
      } else {
        setFinalScore({
          id: 'local_' + Date.now(),
          studentName: studentName.trim(),
          scorePercentage: localScorePct,
          correctAnswersCount: correctCount,
          totalQuestions: totalQ,
          attemptNumber: 1
        });
        playLernstudioSound('fanfare_victory');
      }
    } catch {
      setFinalScore({
        id: 'local_' + Date.now(),
        studentName: studentName.trim(),
        scorePercentage: localScorePct,
        correctAnswersCount: correctCount,
        totalQuestions: totalQ,
        attemptNumber: 1
      });
      playLernstudioSound('fanfare_victory');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Loading & Error States
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-300">Hausaufgabe wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error && !hasStarted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500/40 p-6 sm:p-8 rounded-3xl text-center space-y-4">
          <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-black text-white">Hinweis zur Hausaufgabe</h2>
          <p className="text-sm font-medium text-slate-300">{error}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
          >
            <span>Zur Startseite</span>
          </a>
        </div>
      </div>
    );
  }

  // 2. Welcome & Name Input Screen
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border-2 border-amber-400/40 p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black">
              Hausaufgabe • Glück Lernstudio
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white">{assignment.title}</h1>
            <p className="text-xs text-slate-400">
              {questions.length} Fragen • {assignment.setSnapshot?.title || 'Deutsch Vokabeln'}
            </p>
          </div>

          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Wie heißt du? (Vor- und Nachname):
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="z.B. Sarah Müller"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border-2 border-white/20 focus:border-amber-400 text-white font-bold text-sm focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!studentName.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-black text-base shadow-xl cursor-pointer disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              <span>Jetzt starten</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Victory & Score Screen
  if (isCompleted) {
    const correctCount = responses.filter((r) => r.isCorrect).length;
    const scorePct = finalScore?.scorePercentage ?? Math.round((correctCount / questions.length) * 100);

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border-2 border-amber-400/50 p-6 sm:p-8 rounded-3xl text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-4xl mx-auto shadow-lg">
            🏆
          </div>

          <div className="space-y-1">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
              Tolle Leistung, {studentName}!
            </span>
            <h2 className="text-3xl font-black text-white">{scorePct}% Richtig!</h2>
            <p className="text-xs text-slate-300">
              {correctCount} von {questions.length} Fragen richtig beantwortet
            </p>
          </div>

          {submitting ? (
            <p className="text-xs text-slate-400">Ergebnisse werden gespeichert...</p>
          ) : (
            <div className="p-3 bg-emerald-500/15 border border-emerald-400/30 rounded-2xl text-xs font-bold text-emerald-300">
              Deine Ergebnisse wurden erfolgreich an die Lehrkraft übermittelt! ✅
            </div>
          )}

          <div className="pt-2">
            <a
              href="/"
              className="w-full py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs inline-flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Zurück zur Übersicht</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 4. Interactive Question Arena
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Top Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-black">
          <span className="text-amber-300">
            Frage {currentIdx + 1} von {questions.length}
          </span>
          <span className="text-slate-400">{studentName}</span>
        </div>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400"
            initial={false}
            animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="my-auto py-6 space-y-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border-2 border-white/15 text-center space-y-3 shadow-xl">
          {currentItem.emoji && <span className="text-5xl sm:text-6xl block">{currentItem.emoji}</span>}
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            {currentItem.arabic || currentItem.english || currentItem.german}
          </h2>

          {/* Pronunciation Helpers */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => speakGermanText(currentItem.german, 0.9)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Anhören (1.0x)</span>
            </button>
            <button
              type="button"
              onClick={() => speakGermanText(currentItem.german, 0.6)}
              className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Snail className="w-3.5 h-3.5" />
              <span>Langsam (0.6x)</span>
            </button>
          </div>
        </div>

        {/* 4 Choices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentChoices.map((choice: string) => {
            const isSelected = selectedChoice === choice;
            const isCorrectChoice = choice.trim().toLowerCase() === currentItem.german.trim().toLowerCase();

            let style = 'bg-slate-900/90 border-white/15 hover:border-amber-400 text-white';
            if (selectedChoice !== null) {
              if (isCorrectChoice) {
                style = 'bg-emerald-500/30 border-emerald-400 text-emerald-200';
              } else if (isSelected) {
                style = 'bg-rose-500/30 border-rose-400 text-rose-200';
              } else {
                style = 'bg-slate-900/40 border-white/5 opacity-50 text-slate-500';
              }
            }

            return (
              <button
                key={choice}
                type="button"
                disabled={selectedChoice !== null}
                onClick={() => handleAnswer(choice)}
                className={`p-4 rounded-2xl border-2 text-center font-black text-base sm:text-lg transition-all cursor-pointer font-mono ${style}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="text-center text-xs text-slate-500 font-medium">
        Glück Lernstudio • Blooket-Style Homework Mode
      </div>
    </div>
  );
};
