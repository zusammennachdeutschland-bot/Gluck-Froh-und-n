import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface CascadeDeleteGroupModalProps {
  isOpen: boolean;
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CascadeDeleteGroupModal: React.FC<CascadeDeleteGroupModalProps> = ({
  isOpen,
  groupId,
  groupName,
  onClose,
  onSuccess
}) => {
  const { students, lessons, payments, cascadeDeleteGroup, t, _t, language } = useApp();
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  // Calculate stats dynamically based on current context arrays
  const groupStudents = students.filter(s => s.groupId === groupId);
  const groupStudentIds = new Set(groupStudents.map(s => s.id));
  const groupLessons = lessons.filter(l => l.groupId === groupId);
  const groupPayments = payments.filter(p => p.groupId === groupId || groupStudentIds.has(p.studentId));

  let attendanceCount = 0;
  let homeworkCount = 0;
  let examCount = 0;

  groupLessons.forEach(l => {
    if (l.report?.attendanceStatus) attendanceCount++;
    if (l.report?.studentAttendance) {
      attendanceCount += Object.keys(l.report.studentAttendance).length;
    }
    
    if (l.report?.homeworkStatus) homeworkCount++;
    if (l.report?.examScore !== undefined) examCount++;

    if (l.report?.studentScores) {
      Object.values(l.report.studentScores).forEach((score: any) => {
        if (score.homework) homeworkCount++;
        if (score.exam !== undefined) examCount++;
      });
    }
  });

  const studentsCount = groupStudents.length;
  const lessonsCount = groupLessons.length;
  const paymentsCount = groupPayments.length;

  const isConfirmed = confirmText.trim() === groupName.trim();

  const handleExecute = () => {
    if (!isConfirmed) return;
    cascadeDeleteGroup(groupId);
    onSuccess();
  };

  const isRtl = language === 'ar';

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={e => e.stopPropagation()} className={`bg-surface border border-red-500/30 rounded-xl w-full max-w-md p-5 shadow-2xl relative animate-scale-up ${isRtl ? 'dir-rtl text-right' : 'text-left'}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-lg shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-text-main">
                {_t('حذف المجموعة وجميع البيانات المتعلقة', 'Delete Group & All Related Data', 'Gruppe & Alle zugehörigen Daten löschen')}
              </h3>
              <p className="text-xs font-semibold text-text-muted mt-0.5">
                "{groupName}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-hover rounded-full transition-colors cursor-pointer text-text-muted/70 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning & Impact Summary */}
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4 text-xs space-y-3 text-red-800 dark:text-red-300">
          <p className="font-bold leading-relaxed text-sm">
            {_t('هذا الإجراء سيقوم بحذف:', 'This action will permanently delete:', 'Diese Aktion löscht dauerhaft:')}
          </p>
          <ul className="space-y-1.5 font-semibold pl-2">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {studentsCount} {_t('طلاب', 'Students', 'Schüler')}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {lessonsCount} {_t('حصص / مواعيد', 'Lessons', 'Lektionen')}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {attendanceCount} {_t('سجلات حضور', 'Attendance Records', 'Anwesenheitsdaten')}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {homeworkCount} {_t('سجلات واجبات', 'Homework Records', 'Hausaufgaben-Aufzeichnungen')}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {paymentsCount} {_t('مدفوعات', 'Payments', 'Zahlungen')}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {examCount} {_t('نتائج امتحانات', 'Exam Results', 'Prüfungsergebnisse')}
            </li>
          </ul>
          
          <p className="font-black text-red-600 dark:text-red-400 uppercase pt-2 text-[11px] tracking-wider border-t border-red-200/50 dark:border-red-900/30">
            {_t('هذا الإجراء لا يمكن التراجع عنه.', 'This action cannot be undone.', 'Diese Aktion kann nicht rückgängig gemacht werden.')}
          </p>
        </div>

        {/* Type to Confirm */}
        <div className="mt-4 space-y-2">
          <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
            {_t('اكتب:', 'Type:', 'Tippen Sie:')} <span className="text-text-main normal-case font-black select-all">{groupName}</span> {_t('للتأكيد', 'to confirm deletion.', 'um die Löschung zu bestätigen.')}
          </label>
          <div className="relative">
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={groupName}
              className={`w-full bg-surface border rounded-lg px-3 py-2.5 text-sm font-semibold text-text-main focus:outline-none focus:ring-2 transition-all ${
                isConfirmed 
                  ? 'border-emerald-500 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/10' 
                  : 'border-surface-border focus:border-red-500 focus:ring-red-500/20 dark:focus:ring-red-500/10'
              }`}
              dir="auto"
            />
            {isConfirmed && (
              <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'left-3' : 'right-3'} text-emerald-500`}>
                <Check className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-5">
          <button
            type="button"
            onClick={handleExecute}
            disabled={!isConfirmed}
            className={`w-full font-bold text-xs py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 ${
              isConfirmed
                ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                : 'bg-surface-hover text-slate-400 dark:text-slate-500 cursor-not-allowed border border-surface-border dark:border-surface-border-soft'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{_t('حذف بالكامل (نهائي)', 'Delete Permanently', 'Dauerhaft löschen')}</span>
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-transparent hover:bg-surface-hover text-slate-500 font-bold text-xs py-2 rounded-lg transition-all text-center cursor-pointer mt-1"
          >
            {_t('إلغاء', 'Cancel', 'Abbrechen')}
          </button>
        </div>
      </div>
    </div>
  );
};
