import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Dices, Sparkles, X, RotateCcw, Award, Filter, CheckCircle2, 
  Volume2, VolumeX, UserCheck, ShieldAlert, RefreshCw, Users, GraduationCap
} from 'lucide-react';
import { Student, Group } from '../types';
import { AvatarImage } from './AvatarImage';
import { DEFAULT_OFFLINE_AVATAR } from '../data/avatarPresets';

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
  students,
  groups,
  initialGroupId = 'all',
  onAwardPoints
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId);
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [displayStudent, setDisplayStudent] = useState<Student | null>(null);
  const [winnerStudent, setWinnerStudent] = useState<Student | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [preventRepeatInRound, setPreventRepeatInRound] = useState<boolean>(true);
  const [excludeSingleStudentGroups, setExcludeSingleStudentGroups] = useState<boolean>(true);
  const [selectedHistory, setSelectedHistory] = useState<Student[]>([]);
  const [awardedStudents, setAwardedStudents] = useState<Record<string, number>>({});

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize Web Audio synth for clicks & fanfare
  const playClickSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300 + Math.random() * 200, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Audio fallback
    }
  };

  const playFanfareSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.09);
        osc.stop(ctx.currentTime + idx * 0.09 + 0.3);
      });
    } catch {
      // Audio fallback
    }
  };

  // Count active students per group
  const groupCounts = useMemo(() => {
    const map: Record<string, number> = {};
    students.filter(s => s.status !== 'archived').forEach(s => {
      if (s.groupId) {
        map[s.groupId] = (map[s.groupId] || 0) + 1;
      }
    });
    return map;
  }, [students]);

  // Available groups depending on excludeSingleStudentGroups setting
  const availableGroups = useMemo(() => {
    if (!excludeSingleStudentGroups) return groups;
    return groups.filter(g => (groupCounts[g.id] || 0) > 1);
  }, [groups, groupCounts, excludeSingleStudentGroups]);

  // Base list of active students considering group size exclusion
  const baseActiveStudents = useMemo(() => {
    let list = students.filter(s => s.status !== 'archived');
    if (excludeSingleStudentGroups) {
      list = list.filter(s => s.groupId && (groupCounts[s.groupId] || 0) > 1);
    }
    return list;
  }, [students, excludeSingleStudentGroups, groupCounts]);

  // Filter eligible students
  const eligibleStudents = useMemo(() => {
    let list = baseActiveStudents;
    if (selectedGroupId && selectedGroupId !== 'all') {
      list = list.filter(s => s.groupId === selectedGroupId);
    }
    if (preventRepeatInRound) {
      list = list.filter(s => !excludedStudentIds.includes(s.id));
    }
    return list;
  }, [baseActiveStudents, selectedGroupId, excludedStudentIds, preventRepeatInRound]);

  const totalPoolCount = useMemo(() => {
    let list = baseActiveStudents;
    if (selectedGroupId && selectedGroupId !== 'all') {
      list = list.filter(s => s.groupId === selectedGroupId);
    }
    return list.length;
  }, [baseActiveStudents, selectedGroupId]);

  // Handle spin action
  const handleSpin = () => {
    if (eligibleStudents.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setWinnerStudent(null);

    let counter = 0;
    const totalTicks = 25 + Math.floor(Math.random() * 10); // ~3-4 seconds total
    let currentInterval = 50; // initial speed ms

    const step = () => {
      counter++;
      const randomIndex = Math.floor(Math.random() * eligibleStudents.length);
      const currentCandidate = eligibleStudents[randomIndex];
      setDisplayStudent(currentCandidate);
      playClickSound();

      if (counter >= totalTicks) {
        // Winner chosen!
        setWinnerStudent(currentCandidate);
        setDisplayStudent(currentCandidate);
        setIsSpinning(false);
        playFanfareSound();

        // Update history and excluded
        setSelectedHistory(prev => [currentCandidate, ...prev.filter(x => x.id !== currentCandidate.id)].slice(0, 10));
        if (preventRepeatInRound) {
          setExcludedStudentIds(prev => [...prev, currentCandidate.id]);
        }
      } else {
        // Ease out spin timing
        if (counter > totalTicks - 8) {
          currentInterval += 45;
        } else if (counter > totalTicks - 15) {
          currentInterval += 20;
        }
        setTimeout(step, currentInterval);
      }
    };

    setTimeout(step, currentInterval);
  };

  const handleResetRound = () => {
    setExcludedStudentIds([]);
    setWinnerStudent(null);
    setDisplayStudent(null);
  };

  const handleAwardStar = (studentId: string) => {
    setAwardedStudents(prev => ({
      ...prev,
      [studentId]: (prev[studentId] || 0) + 1
    }));
    if (onAwardPoints) {
      onAwardPoints(studentId, 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] my-auto">
        
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Dices className="w-5 h-5 sm:w-6 sm:h-6 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 sm:gap-2">
                عجلة الاختيار العشوائي
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 hidden xs:block sm:block">
                اختيار عشوائي عادل وممتع للطلاب أثناء الحصة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title={soundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Filters & Control Bar */}
        <div className="px-3 py-2 sm:px-4 sm:py-3 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs shrink-0">
          {/* Group Filter */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-[150px]">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                handleResetRound();
              }}
              disabled={isSpinning}
              className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
            >
              <option value="all">
                كل المجموعات {excludeSingleStudentGroups ? '(أكثر من طالب)' : ''} ({baseActiveStudents.length} طالب)
              </option>
              {availableGroups.map(g => {
                const count = groupCounts[g.id] || 0;
                return (
                  <option key={g.id} value={g.id}>
                    {g.name} ({count} طالب)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer select-none text-[11px] sm:text-xs">
              <input
                type="checkbox"
                checked={excludeSingleStudentGroups}
                onChange={(e) => {
                  setExcludeSingleStudentGroups(e.target.checked);
                  handleResetRound();
                }}
                disabled={isSpinning}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>استثناء مجموعات الطالب الواحد</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer select-none text-[11px] sm:text-xs">
              <input
                type="checkbox"
                checked={preventRepeatInRound}
                onChange={(e) => setPreventRepeatInRound(e.target.checked)}
                disabled={isSpinning}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>عدم تكرار الطالب بالجولة</span>
            </label>
          </div>
        </div>

        {/* Main Display Area (Scrollable if viewport is very short) */}
        <div className="p-3 sm:p-6 flex-1 overflow-y-auto flex flex-col items-center text-center space-y-3 sm:space-y-5">
          
          {/* Pool Stats Indicator */}
          <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              المتبقين بالجولة: <strong className="text-slate-800 dark:text-slate-200 font-bold">{eligibleStudents.length}</strong> من {totalPoolCount}
            </span>
            {excludedStudentIds.length > 0 && (
              <button
                onClick={handleResetRound}
                disabled={isSpinning}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3 h-3" />
                إعادة ضبط الجولة
              </button>
            )}
          </div>

          {/* Roulette Card Display */}
          <div className="relative w-full max-w-xs">
            <div className={`p-4 sm:p-6 rounded-2xl border-2 transition-all duration-300 shadow-xl flex flex-col items-center justify-center min-h-[160px] sm:min-h-[200px] ${
              winnerStudent 
                ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500 ring-4 ring-indigo-500/20 scale-102 sm:scale-105' 
                : isSpinning 
                ? 'bg-slate-50 dark:bg-slate-800/80 border-indigo-400 scale-98' 
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}>
              
              {winnerStudent && (
                <div className="absolute -top-3 bg-amber-500 text-white text-[10px] sm:text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-bounce">
                  <Sparkles className="w-3 h-3" />
                  الفائز بالسحب!
                </div>
              )}

              {(displayStudent || winnerStudent) ? (
                <div className="flex flex-col items-center space-y-2 sm:space-y-3">
                  <div className="relative">
                    <AvatarImage
                      src={(winnerStudent || displayStudent)?.avatarUrl || DEFAULT_OFFLINE_AVATAR}
                      alt={(winnerStudent || displayStudent)?.name || ''}
                      className={`w-14 h-14 sm:w-20 sm:h-20 rounded-2xl object-cover shadow-md border-2 ${
                        winnerStudent ? 'border-indigo-600 ring-4 ring-indigo-200 dark:ring-indigo-900' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {winnerStudent && (
                      <span className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 text-white rounded-full shadow">
                        <UserCheck className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 line-clamp-1">
                      {(winnerStudent || displayStudent)?.name}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 flex items-center justify-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                      {groups.find(g => g.id === (winnerStudent || displayStudent)?.groupId)?.name || 'غير محدد'}
                    </p>
                  </div>

                  {winnerStudent && (
                    <div className="flex items-center gap-2 pt-1 sm:pt-2">
                      <button
                        onClick={() => handleAwardStar(winnerStudent.id)}
                        className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] sm:text-xs font-bold rounded-xl shadow transition flex items-center gap-1"
                      >
                        <Award className="w-3.5 h-3.5" />
                        إضافة نجمة تميز {awardedStudents[winnerStudent.id] ? `(${awardedStudents[winnerStudent.id]})` : ''}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-2 sm:py-4">
                  <Dices className="w-10 h-10 sm:w-12 sm:h-12 mb-1.5 sm:mb-2 text-indigo-400/50" />
                  <p className="text-xs sm:text-sm font-medium">اضغط على الزر أدناه لبدء السحب</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Spin Button */}
          <div className="w-full max-w-xs space-y-1.5 sm:space-y-2">
            <button
              onClick={handleSpin}
              disabled={isSpinning || eligibleStudents.length === 0}
              className={`w-full py-2.5 sm:py-3.5 px-4 sm:px-6 rounded-xl font-bold text-sm sm:text-base shadow-lg transition-all flex items-center justify-center gap-2 ${
                isSpinning || eligibleStudents.length === 0
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 hover:shadow-indigo-500/25'
              }`}
            >
              {isSpinning ? (
                <>
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  جاري الاختيار العشوائي...
                </>
              ) : (
                <>
                  <Dices className="w-4 h-4 sm:w-5 sm:h-5" />
                  {eligibleStudents.length === 0 ? 'انتهى جميع الطلاب بالجولة' : winnerStudent ? 'سحب طالب آخر 🎲' : 'تدوير العجلة الآن 🎲'}
                </>
              )}
            </button>

            {eligibleStudents.length === 0 && (
              <p className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center justify-center gap-1 pt-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                تم سحب كافة الطلاب من هذه القائمة. اضغط إعادة الضبط للبدء من جديد.
              </p>
            )}
          </div>

          {/* Recent Winners History */}
          {selectedHistory.length > 0 && (
            <div className="w-full text-right border-t border-slate-200 dark:border-slate-800 pt-2 sm:pt-3">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 block">
                الذين تم اختيارهم في هذه الجلسة:
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {selectedHistory.map((s, i) => (
                  <span
                    key={`${s.id}-${i}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs border border-slate-200 dark:border-slate-700"
                  >
                    <CheckCircle2 className="w-3 h-3 text-indigo-500" />
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
