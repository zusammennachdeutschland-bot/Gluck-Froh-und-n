import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { buildOnlineAwareHomeworkFollowUps } from '../utils/homeworkFollowUpUtils';
import { HomeworkFollowUpModal } from './HomeworkFollowUpModal';
import { useSyncedHomeworkData } from '../hooks/useSyncedHomeworkData';

export const HomeworkFollowUpWidget: React.FC = () => {
  const { lessons, groups, students, _t, isRtl } = useApp();
  const { assignments, submissions, currentOwnerUid } = useSyncedHomeworkData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pendingFollowUps = useMemo(
    () =>
      buildOnlineAwareHomeworkFollowUps({
        lessons,
        groups,
        students,
        assignments,
        submissions,
        currentOwnerUid
      }),
    [lessons, groups, students, assignments, submissions, currentOwnerUid]
  );

  if (pendingFollowUps.length === 0) return null;

  const onlineLinkedItems = pendingFollowUps.filter((p) => p.hasOnlineHomework);
  const totalNeedsFollowUpStudents = onlineLinkedItems.reduce(
    (sum, p) => sum + (p.needsFollowUpCount || 0),
    0
  );
  const totalSolvedStudents = onlineLinkedItems.reduce(
    (sum, p) => sum + (p.onlineFollowUpSummary?.solvedCount || 0),
    0
  );

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="bg-surface border border-surface-border rounded-xl p-2 sm:p-2.5 shadow-2xs flex items-center justify-between gap-2.5 transition-all cursor-pointer hover:bg-surface-hover/80 active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary border border-primary-border flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-main truncate">
                {_t('متابعة الواجبات', 'Homework Follow-Up', 'Hausaufgaben-Nachverfolgung')}
              </h3>
              <span className="text-[10px] font-extrabold bg-primary-soft text-primary px-1.5 py-0.2 rounded-full font-mono">
                {pendingFollowUps.length}
              </span>
              {totalNeedsFollowUpStudents > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.2 rounded-full">
                  <AlertCircle className="w-2.5 h-2.5" />
                  <span>
                    {totalNeedsFollowUpStudents} {_t('يحتاج متابعة', 'need follow-up', 'Nachverfolgung')}
                  </span>
                </span>
              )}
              {totalNeedsFollowUpStudents === 0 && totalSolvedStudents > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.2 rounded-full">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>
                    {totalSolvedStudents} {_t('حل الواجب', 'solved', 'erledigt')}
                  </span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-text-muted truncate mt-0.5">
              {onlineLinkedItems.length > 0
                ? _t(
                    `${pendingFollowUps.length} عنصر للمتابعة • ${onlineLinkedItems.length} واجب أونلاين (${totalSolvedStudents} حل / ${totalNeedsFollowUpStudents} متابعة)`,
                    `${pendingFollowUps.length} item(s) • ${onlineLinkedItems.length} online HW (${totalSolvedStudents} solved / ${totalNeedsFollowUpStudents} need follow-up)`,
                    `${pendingFollowUps.length} Einträge • ${onlineLinkedItems.length} Online-Aufgaben (${totalSolvedStudents} erledigt / ${totalNeedsFollowUpStudents} offen)`
                  )
                : _t(
                    `يوجد ${pendingFollowUps.length} مجموعات تحتاج إلى إرسال متابعة الواجب`,
                    `${pendingFollowUps.length} group(s) require homework reminder`,
                    `${pendingFollowUps.length} Gruppe(n) erfordern Hausaufgaben-Erinnerung`
                  )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-text-muted">
          <span className="text-[11px] font-bold text-primary">
            {_t('عرض', 'View', 'Öffnen')}
          </span>
          <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isModalOpen && (
        <HomeworkFollowUpModal
          pendingFollowUps={pendingFollowUps}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};
