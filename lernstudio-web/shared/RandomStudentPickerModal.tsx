import React, { useState, useEffect } from 'react';
import { Dices, X, RotateCcw, Award, CheckCircle2, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { Student, Group } from './types';

interface RandomStudentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  groups: Group[];
  initialGroupId?: string;
  onAwardPoints?: (studentId: string, points: number) => void;
}

export const RandomStudentPickerModal: React.FC<RandomStudentPickerModalProps> = ({
  isOpen,
  onClose,
  students = [],
  groups = []
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (students && students.length > 0) {
      setCandidates(students.map((s) => s.name));
    } else {
      setCandidates(['Max', 'Mia', 'Felix', 'Emma', 'Leon', 'Sophie']);
    }
  }, [students]);

  if (!isOpen) return null;

  const handleSpin = () => {
    if (candidates.length === 0 || isSpinning) return;
    setIsSpinning(true);
    setWinner(null);

    let counter = 0;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * candidates.length);
      setWinner(candidates[randomIdx]);
      counter++;
      if (counter > 25) {
        clearInterval(interval);
        const finalWinner = candidates[Math.floor(Math.random() * candidates.length)];
        setWinner(finalWinner);
        setIsSpinning(false);
      }
    }, 80);
  };

  const addName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    setCandidates((prev) => [...prev, customInput.trim()]);
    setCustomInput('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
          <Dices className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-black">Zufallsauswahl 🎲</h3>
        <p className="text-slate-400 text-xs mt-1 mb-6">Wer ist als Nächstes an der Reihe?</p>

        {/* Winner display */}
        <div className="py-8 px-4 bg-slate-950/80 border border-slate-800 rounded-2xl mb-6">
          <div className="text-xs uppercase font-bold tracking-wider text-amber-400 mb-2">
            {isSpinning ? 'Auswahl läuft...' : winner ? 'Ausgewählter Schüler:' : 'Bereit'}
          </div>
          <div
            className={`text-3xl font-black transition-all ${
              winner ? 'text-emerald-400 scale-105' : 'text-slate-500'
            }`}
          >
            {winner || '—'}
          </div>
        </div>

        <button
          onClick={handleSpin}
          disabled={isSpinning || candidates.length === 0}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 disabled:opacity-50 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/25 active:scale-98 transition-all mb-4 text-base"
        >
          {isSpinning ? 'Dreht sich...' : '🎲 Jetzt drehen!'}
        </button>

        {/* Quick candidate list */}
        <div className="text-left border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Kandidaten ({candidates.length})</span>
            <button
              onClick={() => setCandidates([])}
              className="text-red-400 hover:underline text-[10px]"
            >
              Leeren
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto mb-3">
            {candidates.map((name, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-lg bg-slate-800 text-[11px] font-semibold text-slate-300"
              >
                {name}
              </span>
            ))}
          </div>

          <form onSubmit={addName} className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Name hinzufügen..."
              className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-white"
            >
              +
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
