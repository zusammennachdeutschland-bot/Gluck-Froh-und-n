import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Dices, Sparkles, X, RotateCcw, Award, Filter, CheckCircle2, 
  Volume2, VolumeX, UserCheck, ShieldAlert, RefreshCw, Users, GraduationCap,
  Layers, UserPlus, Plus, Trash2, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { Student, Group } from '../types';
import { AvatarImage } from './AvatarImage';
import { DEFAULT_OFFLINE_AVATAR } from '../data/avatarPresets';
import { Toast } from '@capacitor/toast';

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
  // Group selection modes: single group vs merged multi-groups
  const [isMergeMode, setIsMergeMode] = useState<boolean>(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Manual custom names
  const [customNames, setCustomNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('glueck_picker_custom_names');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [customNameInput, setCustomNameInput] = useState<string>('');
  const [showCustomNamesPanel, setShowCustomNamesPanel] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('glueck_picker_custom_names');
      return Boolean(saved && JSON.parse(saved).length > 0);
    } catch {
      return false;
    }
  });

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

  // Base list of active registered students considering group size exclusion
  const baseActiveStudents = useMemo(() => {
    let list = students.filter(s => s.status !== 'archived');
    if (excludeSingleStudentGroups) {
      list = list.filter(s => s.groupId && (groupCounts[s.groupId] || 0) > 1);
    }
    return list;
  }, [students, excludeSingleStudentGroups, groupCounts]);

  // Virtual custom students created manually
  const customStudents = useMemo<Student[]>(() => {
    return customNames.map((name, idx) => ({
      id: `manual_custom_${idx}_${name.trim()}`,
      name: name.trim(),
      groupId: 'manual_custom',
      grade: 'A1',
      parentName: '',
      parentPhone: '',
      studentPhone: '',
      documents: [],
      joinedDate: '',
      status: 'active' as const,
      avatarUrl: DEFAULT_OFFLINE_AVATAR
    }));
  }, [customNames]);

  // Filter students based on single or merged group selection
  const groupStudents = useMemo(() => {
    if (isMergeMode) {
      if (selectedGroupIds.length === 0) return [];
      return baseActiveStudents.filter(s => s.groupId && selectedGroupIds.includes(s.groupId));
    }
    if (selectedGroupId && selectedGroupId !== 'all') {
      return baseActiveStudents.filter(s => s.groupId === selectedGroupId);
    }
    return baseActiveStudents;
  }, [baseActiveStudents, isMergeMode, selectedGroupIds, selectedGroupId]);

  // Combined pool of students (registered groups + custom names)
  const allPoolStudents = useMemo(() => {
    return [...groupStudents, ...customStudents];
  }, [groupStudents, customStudents]);

  // Filter eligible students taking round exclusion into account
  const eligibleStudents = useMemo(() => {
    let list = allPoolStudents;
    if (preventRepeatInRound) {
      list = list.filter(s => !excludedStudentIds.includes(s.id));
    }
    return list;
  }, [allPoolStudents, excludedStudentIds, preventRepeatInRound]);

  const totalPoolCount = allPoolStudents.length;

  // Custom names handlers
  const handleAddCustomNames = () => {
    if (!customNameInput.trim()) return;
    const splitNames = customNameInput
      .split(/[,،\n]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (splitNames.length === 0) return;

    setCustomNames(prev => {
      const updated = Array.from(new Set([...prev, ...splitNames]));
      try {
        localStorage.setItem('glueck_picker_custom_names', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('gluck-local-data-mutated', { detail: { source: 'pickerNames' } }));
      } catch (err) {
        console.error('Failed to persist custom picker names to localStorage:', err);
        Toast.show({ text: '⚠️ تعذر حفظ الأسماء في ذاكرة الجهاز (الذاكرة ممتلئة)', duration: 'short' }).catch(() => {});
      }
      return updated;
    });
    setCustomNameInput('');
    handleResetRound();
  };

  const handleRemoveCustomName = (nameToRemove: string) => {
    setCustomNames(prev => {
      const updated = prev.filter(n => n !== nameToRemove);
      try {
        localStorage.setItem('glueck_picker_custom_names', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('gluck-local-data-mutated', { detail: { source: 'pickerNames' } }));
      } catch (err) {
        console.error('Failed to update custom picker names in localStorage:', err);
        Toast.show({ text: '⚠️ تعذر تحديث الأسماء في ذاكرة الجهاز', duration: 'short' }).catch(() => {});
      }
      return updated;
    });
    handleResetRound();
  };

  const handleClearCustomNames = () => {
    setCustomNames([]);
    try {
      localStorage.removeItem('glueck_picker_custom_names');
      window.dispatchEvent(new CustomEvent('gluck-local-data-mutated', { detail: { source: 'pickerNames' } }));
    } catch (err) {
      console.error('Failed to clear custom picker names from localStorage:', err);
      Toast.show({ text: '⚠️ تعذر مسح الأسماء من ذاكرة الجهاز', duration: 'short' }).catch(() => {});
    }
    handleResetRound();
  };

  // Merge groups toggles
  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => {
      const next = prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId];
      return next;
    });
    handleResetRound();
  };

  const handleSelectAllMergeGroups = () => {
    setSelectedGroupIds(availableGroups.map(g => g.id));
    handleResetRound();
  };

  const handleClearMergeGroups = () => {
    setSelectedGroupIds([]);
    handleResetRound();
  };

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
    if (onAwardPoints && !studentId.startsWith('manual_custom_')) {
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

        {/* Source Mode Selector (Single / Merged / Manual Names) */}
        <div className="px-3 py-2 sm:px-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setIsMergeMode(false);
                handleResetRound();
              }}
              disabled={isSpinning}
              className={`px-2.5 py-1 rounded-md font-bold text-[11px] sm:text-xs transition-all ${
                !isMergeMode
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              مجموعة فردية
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMergeMode(true);
                if (selectedGroupIds.length === 0 && availableGroups.length > 0) {
                  // Preselect first two groups if available as convenience
                  setSelectedGroupIds(availableGroups.slice(0, 2).map(g => g.id));
                }
                handleResetRound();
              }}
              disabled={isSpinning}
              className={`px-2.5 py-1 rounded-md font-bold text-[11px] sm:text-xs transition-all flex items-center gap-1 ${
                isMergeMode
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3 h-3" />
              ضم مجموعات ({selectedGroupIds.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCustomNamesPanel(!showCustomNamesPanel)}
            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center gap-1 border ${
              customNames.length > 0 || showCustomNamesPanel
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>أسماء يدوية</span>
            {customNames.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                {customNames.length}
              </span>
            )}
            {showCustomNamesPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Custom Names Management Drawer */}
        {showCustomNamesPanel && (
          <div className="px-3 py-2.5 sm:px-4 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900/40 space-y-2 text-xs shrink-0 animate-fadeIn">
            <div className="flex items-center justify-between text-amber-900 dark:text-amber-200 font-bold text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                إضافة أسماء يدوية للمشاركة في السحب (مفصولة بفواصل أو سطور)
              </span>
              {customNames.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCustomNames}
                  className="text-rose-600 hover:underline flex items-center gap-0.5 text-[10px]"
                >
                  <Trash2 className="w-3 h-3" />
                  مسح الكل
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customNameInput}
                onChange={(e) => setCustomNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomNames();
                  }
                }}
                disabled={isSpinning}
                placeholder="اكتب اسم الطالب واضغط إضافة (مثال: أحمد، سارة، عمر)..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-500 text-xs"
              />
              <button
                type="button"
                onClick={handleAddCustomNames}
                disabled={isSpinning || !customNameInput.trim()}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-xs text-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>

            {customNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                {customNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-[11px] font-medium border border-amber-200 dark:border-amber-800/60"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomName(name)}
                      className="p-0.5 hover:text-rose-600 transition"
                      title="حذف الاسم"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Multi-Group Checkboxes (when in Merge Mode) */}
        {isMergeMode && (
          <div className="px-3 py-2 sm:px-4 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 space-y-1.5 shrink-0 animate-fadeIn">
            <div className="flex items-center justify-between text-[11px] text-indigo-950 dark:text-indigo-200 font-bold">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                اختر مجموعتين أو أكثر لدمجهم معاً في السحب:
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={handleSelectAllMergeGroups}
                  disabled={isSpinning}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  تحديد الكل
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={handleClearMergeGroups}
                  disabled={isSpinning}
                  className="text-slate-500 hover:underline"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto py-1">
              {availableGroups.map((g) => {
                const count = groupCounts[g.id] || 0;
                const isSelected = selectedGroupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleToggleGroup(g.id)}
                    disabled={isSpinning}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                      isSelected ? 'border-white bg-indigo-700 text-white' : 'border-slate-400'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                    </span>
                    <span>{g.name}</span>
                    <span className={`text-[10px] opacity-75 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Single Group Filter & Toggles Bar */}
        <div className="px-3 py-2 sm:px-4 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs shrink-0">
          {!isMergeMode ? (
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
          ) : (
            <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex-1">
              <Layers className="w-3.5 h-3.5" />
              <span>
                المجموعات المدمجة: {selectedGroupIds.length} مجموعات ({groupStudents.length} طالب)
              </span>
            </div>
          )}

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

        {/* Main Display Area (Scrollable if viewport is short) */}
        <div className="p-3 sm:p-6 flex-1 overflow-y-auto flex flex-col items-center text-center space-y-3 sm:space-y-4">
          
          {/* Pool Stats Indicator */}
          <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 flex-wrap justify-center">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              المتبقين بالجولة: <strong className="text-slate-800 dark:text-slate-200 font-bold">{eligibleStudents.length}</strong> من {totalPoolCount}
            </span>
            {(isMergeMode || customStudents.length > 0) && (
              <span className="text-[10px] sm:text-[11px] text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                (مجموعات: {groupStudents.length} {customStudents.length > 0 ? `+ يدوي: ${customStudents.length}` : ''})
              </span>
            )}
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
                      <GraduationCap className={`w-3.5 h-3.5 ${(winnerStudent || displayStudent)?.groupId === 'manual_custom' ? 'text-amber-500' : 'text-indigo-500'}`} />
                      {(winnerStudent || displayStudent)?.groupId === 'manual_custom' ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">طالب مضاف يدوياً ✍️</span>
                      ) : (
                        groups.find(g => g.id === (winnerStudent || displayStudent)?.groupId)?.name || 'غير محدد'
                      )}
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
                {totalPoolCount === 0
                  ? 'لا يوجد طلاب مؤهلين بالسحب. اختر مجموعة أو أضف أسماء يدوية.'
                  : 'تم سحب كافة الطلاب من هذه القائمة. اضغط إعادة الضبط للبدء من جديد.'}
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
