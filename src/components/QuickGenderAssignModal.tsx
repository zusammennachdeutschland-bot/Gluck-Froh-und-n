import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Student } from '../types';
import { isLikelyFemaleStudent } from '../utils/genderUtils';
import { 
  X, Check, Users, Sparkles, UserCheck, ArrowRight, ArrowLeft, 
  RotateCcw, Filter, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuickGenderAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickGenderAssignModal: React.FC<QuickGenderAssignModalProps> = ({
  isOpen,
  onClose
}) => {
  const { students, groups, updateStudent, _t, language } = useApp();

  // Filter mode: 'unassigned' (students without explicit gender) or 'all'
  const [filterMode, setFilterMode] = useState<'unassigned' | 'all'>('unassigned');
  const [showClassifiedList, setShowClassifiedList] = useState(false);
  const [history, setHistory] = useState<{ studentId: string; previousGender?: 'male' | 'female' }[]>([]);

  // Calculate pending students
  const activeStudents = students.filter(s => s.status !== 'archived');
  const pendingStudents = filterMode === 'unassigned'
    ? activeStudents.filter(s => !s.gender)
    : activeStudents;

  const [currentIndex, setCurrentIndex] = useState(0);

  // Keep index within bounds if list changes
  useEffect(() => {
    if (currentIndex >= pendingStudents.length && pendingStudents.length > 0) {
      setCurrentIndex(Math.max(0, pendingStudents.length - 1));
    }
  }, [pendingStudents.length, currentIndex]);

  if (!isOpen) return null;

  const currentStudent: Student | undefined = pendingStudents[currentIndex];
  const group = currentStudent ? groups.find(g => g.id === currentStudent.groupId) : undefined;
  
  // AI Prediction for current student
  const aiSuggestedGender: 'male' | 'female' = currentStudent 
    ? (isLikelyFemaleStudent(currentStudent.name) ? 'female' : 'male')
    : 'male';

  const totalAssigned = activeStudents.filter(s => !!s.gender).length;
  const totalStudents = activeStudents.length;
  const progressPercent = totalStudents > 0 ? Math.round((totalAssigned / totalStudents) * 100) : 100;

  const handleAssignGender = (gender: 'male' | 'female') => {
    if (!currentStudent) return;

    // Track for undo
    setHistory(prev => [...prev, { studentId: currentStudent.id, previousGender: currentStudent.gender }]);

    // Persist to student record
    updateStudent(currentStudent.id, { gender });

    // If all pending will be 1 (this was the last), fire confetti
    if (pendingStudents.length <= 1) {
      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } catch (e) {}
    }

    // In 'unassigned' mode, the student will naturally disappear from the pending list!
    // If in 'all' mode, we advance currentIndex
    if (filterMode === 'all') {
      if (currentIndex < pendingStudents.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    updateStudent(last.studentId, { gender: last.previousGender });
    setHistory(prev => prev.slice(0, -1));
  };

  const handleSkip = () => {
    if (currentIndex < pendingStudents.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      dir="rtl"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-surface-border w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
      >
        {/* Header */}
        <div className="bg-surface px-3.5 py-2.5 sm:p-5 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2.5 bg-primary-soft text-primary rounded-lg sm:rounded-xl shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 truncate">
                <h2 className="text-xs sm:text-base font-black text-text-main truncate">
                  {_t('تحديد جنس الطلاب السريع', 'Quick Gender Assignment', 'Geschlechtszuweisung')}
                </h2>
                <span className="text-[10px] sm:text-[11px] font-black px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                  {totalAssigned} / {totalStudents}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5 hidden sm:block">
                {_t('يحدد صياغة المذكر والمؤنث في التقارير ومتابعة الواجبات بدقة', 'Controls gender wording in reports & homework follow-up', 'Steuert Geschlechtsformulierungen in Berichten')}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 sm:p-2 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-text-muted hover:text-text-main transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-100 dark:bg-slate-800/60 px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 border-b border-surface-border shrink-0">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-text-muted">
                {_t('نسبة اكتمال تصنيف الطلاب:', 'Classification Progress:', 'Fortschritt:')}
              </span>
              <span className="text-primary font-black">{progressPercent}%</span>
            </div>
            <div className="w-full bg-surface-border h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFilterMode(filterMode === 'unassigned' ? 'all' : 'unassigned');
                setCurrentIndex(0);
              }}
              className="text-[11px] font-bold px-2 py-1 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-text-main transition-all flex items-center gap-1 cursor-pointer"
            >
              <Filter className="w-3 h-3 text-primary" />
              <span>{filterMode === 'unassigned' ? _t('غير المحددين فقط', 'Unassigned only', 'Nur ohne') : _t('كل الطلاب', 'All students', 'Alle')}</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col justify-center min-h-[300px]">
          {pendingStudents.length === 0 ? (
            /* Empty Queue State */
            <div className="text-center py-8 px-4 space-y-4 my-auto animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-text-main">
                  {_t('تم تصنيف جميع الطلاب بنجاح! 🎉', 'All students classified successfully! 🎉', 'Alle Schüler erfolgreich klassifiziert! 🎉')}
                </h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                  {_t('تم حفظ جنس كل طالب ومطابقته في تقارير أولياء الأمور ورسائل المتابعة تلقائياً.', 'All genders are stored and reflected across reports and parent messages automatically.', 'Alle Geschlechter sind gespeichert und in Berichten aktiv.')}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('all');
                    setCurrentIndex(0);
                  }}
                  className="px-4 py-2 bg-surface border border-surface-border hover:bg-surface-hover text-text-main text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {_t('مراجعة وتعديل كل الطلاب', 'Review all students', 'Alle überprüfen')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md shadow-primary/20"
                >
                  {_t('تم الانتهاء والعودة', 'Done & Back', 'Fertig')}
                </button>
              </div>
            </div>
          ) : currentStudent ? (
            /* Active Student Card */
            <div className="space-y-5 animate-scale-up">
              {/* Student Card */}
              <div className="relative bg-surface-hover/80 border-2 border-primary/20 rounded-2xl p-5 sm:p-6 text-center space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-[11px] text-text-muted font-bold">
                  <span>
                    {_t('طالب', 'Student', 'Schüler')} {currentIndex + 1} {_t('من', 'of', 'von')} {pendingStudents.length}
                  </span>
                  {group && (
                    <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-black text-[10.5px]">
                      {group.name}
                    </span>
                  )}
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <h3 className="text-xl sm:text-2xl font-black text-text-main tracking-tight">
                    {currentStudent.name}
                  </h3>
                  {currentStudent.certificateName && (
                    <p className="text-xs text-text-muted font-mono font-semibold">
                      {currentStudent.certificateName}
                    </p>
                  )}
                  {currentStudent.grade && (
                    <p className="text-[11px] text-text-muted font-bold">
                      {currentStudent.grade}
                    </p>
                  )}
                </div>

                {/* AI Smart Suggestion */}
                <div className="pt-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black text-emerald-700 dark:text-emerald-300 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {_t('اقتراح الذكاء الاصطناعي من الاسم:', 'AI suggestion from name:', 'KI-Vorschlag:')}{' '}
                      <span className="font-extrabold underline decoration-emerald-400">
                        {aiSuggestedGender === 'female' 
                          ? _t('بنت 👧 (مؤنث)', 'Girl 👧 (Female)', 'Mädchen 👧 (Weiblich)')
                          : _t('ولد 👦 (مذكر)', 'Boy 👦 (Male)', 'Junge 👦 (Männlich)')}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Existing selection if any */}
                {currentStudent.gender && (
                  <div className="text-[10.5px] text-text-muted font-bold">
                    {_t('المحدد حالياً:', 'Current selection:', 'Aktuell:')}{' '}
                    <span className="font-black text-primary">
                      {currentStudent.gender === 'female' 
                        ? _t('👧 بنت', '👧 Girl', '👧 Mädchen') 
                        : _t('👦 ولد', '👦 Boy', '👦 Junge')}
                    </span>
                  </div>
                )}
              </div>

              {/* Two Big Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Boy Button */}
                <button
                  type="button"
                  id="assign-male-btn"
                  onClick={() => handleAssignGender('male')}
                  className={`py-3.5 px-4 rounded-2xl font-black text-sm transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 border-2 ${
                    currentStudent.gender === 'male' || aiSuggestedGender === 'male'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 shadow-blue-500/25 ring-2 ring-blue-400/40'
                      : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                  }`}
                >
                  <span className="text-2xl">👦</span>
                  <span className="text-base font-black">{_t('ولد (طالب)', 'Boy (Male)', 'Junge (Männlich)')}</span>
                  <span className="text-[10px] opacity-80 font-bold">{_t('اضغط للاختيار', 'Click to Select', 'Klicken zum Auswählen')}</span>
                </button>

                {/* Girl Button */}
                <button
                  type="button"
                  id="assign-female-btn"
                  onClick={() => handleAssignGender('female')}
                  className={`py-3.5 px-4 rounded-2xl font-black text-sm transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 border-2 ${
                    currentStudent.gender === 'female' || aiSuggestedGender === 'female'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 shadow-rose-500/25 ring-2 ring-rose-400/40'
                      : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  }`}
                >
                  <span className="text-2xl">👧</span>
                  <span className="text-base font-black">{_t('بنت (طالبة)', 'Girl (Female)', 'Mädchen (Weiblich)')}</span>
                  <span className="text-[10px] opacity-80 font-bold">{_t('اضغط للاختيار', 'Click to Select', 'Klicken zum Auswählen')}</span>
                </button>
              </div>

              {/* Utility Nav (Undo / Skip) */}
              <div className="flex items-center justify-between pt-2 border-t border-surface-border text-xs">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="text-text-muted hover:text-text-main font-bold flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{_t('تراجع عن السابق', 'Undo previous', 'Rückgängig')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>{_t('تخطي للطالب التالي', 'Skip student', 'Überspringen')}</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Classified List Accordion */}
        <div className="border-t border-surface-border bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <button
            type="button"
            onClick={() => setShowClassifiedList(!showClassifiedList)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{_t('قائمة الطلاب المصنفين بالفعل', 'Classified Students List', 'Bereits klassifiziert')} ({totalAssigned})</span>
            </span>
            {showClassifiedList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showClassifiedList && (
            <div className="p-3 max-h-48 overflow-y-auto divide-y divide-surface-border border-t border-surface-border text-xs space-y-1">
              {activeStudents.filter(s => !!s.gender).length === 0 ? (
                <p className="text-center text-text-muted py-3 text-[11px]">
                  {_t('لم يتم تصنيف أي طالب بعد', 'No students classified yet', 'Noch keine Schüler klassifiziert')}
                </p>
              ) : (
                activeStudents.filter(s => !!s.gender).map(st => (
                  <div key={st.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="font-bold text-text-main truncate">{st.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateStudent(st.id, { gender: 'male' })}
                        className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                          st.gender === 'male'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-blue-100/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        }`}
                      >
                        {_t('👦 ولد', '👦 Boy', '👦 Junge')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStudent(st.id, { gender: 'female' })}
                        className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                          st.gender === 'female'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-rose-100/70 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        {_t('👧 بنت', '👧 Girl', '👧 Mädchen')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
