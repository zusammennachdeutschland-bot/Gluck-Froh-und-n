import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson } from '../types';
import { Trash2, AlertTriangle, CalendarX, FastForward, X, Check, ShieldAlert } from 'lucide-react';
import { formatTimeDisplay } from '../utils/timeUtils';

interface DeleteSessionConfirmModalProps {
  lesson: Lesson;
  onClose: () => void;
}

export const DeleteSessionConfirmModal: React.FC<DeleteSessionConfirmModalProps> = ({ lesson, onClose }) => {
  const { deleteLesson, deleteFutureGroupLessons, deleteAllGroupLessons, _t, language } = useApp();
  const [selectedOption, setSelectedOption] = useState<'single' | 'future' | 'all' | null>('single');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmAllStep, setConfirmAllStep] = useState(false);

  const groupNameDisplay = lesson.groupName || lesson.title || _t('المجموعة', 'Group', 'Gruppe');

  const handleConfirm = () => {
    if (!selectedOption) return;
    setIsProcessing(true);

    try {
      if (selectedOption === 'single') {
        deleteLesson(lesson.id);
      } else if (selectedOption === 'future') {
        deleteFutureGroupLessons(lesson.groupId, lesson.date, lesson.id);
      } else if (selectedOption === 'all') {
        deleteAllGroupLessons(lesson.groupId, false);
      }
      onClose();
    } catch (err) {
      console.error('Error deleting session(s):', err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-surface border border-surface-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-rose-500/10 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-rose-700 dark:text-rose-400">
                {_t('خيارات حذف الحصة', 'Delete Session Options', 'Sitzung löschen')}
              </h3>
              <p className="text-xs text-text-muted">
                {groupNameDisplay} • {lesson.date} ({formatTimeDisplay(lesson.time, language)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-rose-500/10 rounded-lg text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {!confirmAllStep ? (
            <>
              <p className="text-xs text-text-muted leading-relaxed">
                {_t(
                  'يرجى تحديد نطاق الحذف المطلوب لهذه الحصة:',
                  'Please select the scope of deletion for this session:',
                  'Bitte wählen Sie den Löschumfang für diese Sitzung:'
                )}
              </p>

              <div className="space-y-2.5">
                {/* Option 1: Delete Single Session */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('single')}
                  className={`w-full text-start p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    selectedOption === 'single'
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-xs'
                      : 'border-surface-border hover:border-slate-300 dark:hover:border-slate-700 bg-surface'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${selectedOption === 'single' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-text-muted'}`}>
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main">
                        {_t('1. حذف هذه الحصة فقط', '1. Delete this session only', '1. Nur diese Sitzung löschen')}
                      </span>
                      {selectedOption === 'single' && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-normal">
                      {_t(
                        'سيتم حذف هذه الحصة المحددة فقط من التقويم دون التأثير على باقي حصص المجموعة.',
                        'Deletes only this specific scheduled session without affecting other sessions.',
                        'Löscht nur diese einzelne geplante Sitzung.'
                      )}
                    </p>
                  </div>
                </button>

                {/* Option 2: Delete This and Future */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('future')}
                  className={`w-full text-start p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    selectedOption === 'future'
                      ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 shadow-xs'
                      : 'border-surface-border hover:border-slate-300 dark:hover:border-slate-700 bg-surface'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${selectedOption === 'future' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-text-muted'}`}>
                    <FastForward className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main">
                        {_t('2. حذف هذه الحصة وجميع الحصص المستقبلية', '2. Delete this and all future sessions', '2. Diese und alle zukünftigen Sitzungen löschen')}
                      </span>
                      {selectedOption === 'future' && <Check className="w-4 h-4 text-amber-500" />}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-normal">
                      {_t(
                        'سيتم حذف هذه الحصة وكافة الحصص المستقبلية المجدولة للمجموعة، مع الاحتفاظ بالحسابات وسجل الحصص السابقة دون تعديل.',
                        'Deletes this session and all future scheduled sessions. Past completed history is preserved.',
                        'Löscht diese und alle zukünftigen Sitzungen. Die Vergangenheit bleibt erhalten.'
                      )}
                    </p>
                  </div>
                </button>

                {/* Option 3: Delete All Group Sessions */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('all')}
                  className={`w-full text-start p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    selectedOption === 'all'
                      ? 'border-rose-500 bg-rose-500/5 dark:bg-rose-500/10 shadow-xs'
                      : 'border-surface-border hover:border-slate-300 dark:hover:border-slate-700 bg-surface'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${selectedOption === 'all' ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-text-muted'}`}>
                    <CalendarX className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        {_t('3. حذف جميع حصص هذه المجموعة', '3. Delete all sessions for this group', '3. Alle Sitzungen dieser Gruppe löschen')}
                      </span>
                      {selectedOption === 'all' && <Check className="w-4 h-4 text-rose-500" />}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-normal">
                      {_t(
                        'إزالة كافة الحصص المرتبطة بهذه المجموعة من التقويم بشكل كامل.',
                        'Deletes all calendar sessions associated with this group.',
                        'Löscht alle Termine dieser Gruppe aus dem Kalender.'
                      )}
                    </p>
                  </div>
                </button>
              </div>
            </>
          ) : (
            /* Warning Confirmation Step for Option 3 */
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl space-y-3">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h4 className="font-bold text-xs">
                  {_t('تأكيد الحذف الشامل لحصص المجموعة', 'Confirm Group Sessions Deletion', 'Löschen aller Gruppensitzungen bestätigen')}
                </h4>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                {_t(
                  `أنت على وشك حذف جميع حصص مجموعة "${groupNameDisplay}". هل أنت متأكد من الاستمرار؟`,
                  `You are about to delete all sessions for group "${groupNameDisplay}". Are you sure you want to proceed?`,
                  `Möchten Sie wirklich alle Sitzungen für die Gruppe "${groupNameDisplay}" löschen?`
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-surface-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (confirmAllStep) {
                setConfirmAllStep(false);
              } else {
                onClose();
              }
            }}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            {_t('إلغاء', 'Cancel', 'Abbrechen')}
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedOption === 'all' && !confirmAllStep) {
                setConfirmAllStep(true);
              } else {
                handleConfirm();
              }
            }}
            disabled={isProcessing || !selectedOption}
            className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedOption === 'single'
                ? 'bg-primary hover:bg-primary-hover active:scale-95'
                : selectedOption === 'future'
                ? 'bg-amber-600 hover:bg-amber-700 active:scale-95'
                : 'bg-rose-600 hover:bg-rose-700 active:scale-95'
            } disabled:opacity-50`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {confirmAllStep
                ? _t('تأكيد الحذف النهائي', 'Confirm Final Deletion', 'Endgültig löschen')
                : selectedOption === 'all'
                ? _t('متابعة للحذف الشامل', 'Continue to Delete All', 'Weiter zum Löschen')
                : _t('تنفيذ الحذف', 'Delete Now', 'Jetzt löschen')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
