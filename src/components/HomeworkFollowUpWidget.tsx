import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, ChevronRight, AlertCircle, CheckCircle2, Globe, FileText } from 'lucide-react';
import { buildSeparatedHomeworkTrackingLists, HomeworkTrackingMode } from '../utils/homeworkFollowUpUtils';
import { HomeworkFollowUpModal } from './HomeworkFollowUpModal';
import { useSyncedHomeworkData } from '../hooks/useSyncedHomeworkData';

export const HomeworkFollowUpWidget: React.FC = () => {
  const { lessons, groups, students, _t, isRtl } = useApp();
  const { assignments, submissions, currentOwnerUid } = useSyncedHomeworkData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trackingMode, setTrackingMode] = useState<HomeworkTrackingMode>('normal');

  const separatedLists = useMemo(
    () =>
      buildSeparatedHomeworkTrackingLists({
        lessons,
        groups,
        students,
        assignments,
        submissions,
        currentOwnerUid
      }),
    [lessons, groups, students, assignments, submissions, currentOwnerUid]
  );

  const currentList = trackingMode === 'online' ? separatedLists.onlineFollowUps : separatedLists.normalFollowUps;
  const totalCount = separatedLists.normalFollowUps.length + separatedLists.onlineFollowUps.length;

  if (totalCount === 0) return null;

  const onlineLinkedItems = separatedLists.onlineFollowUps;
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
      <div className="bg-surface border border-surface-border rounded-xl px-2.5 py-1.5 shadow-2xs font-sans flex items-center justify-between gap-2">
        {/* Left: Icon, Title & Badge */}
        <div
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 min-w-0 cursor-pointer group flex-1"
        >
          <div className="w-6 h-6 rounded-md bg-primary-soft text-primary border border-primary-border flex items-center justify-center shrink-0">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-xs font-black uppercase tracking-wider text-text-main truncate">
              {_t('متابعة الواجبات', 'Homework Follow-Up', 'Hausaufgaben')}
            </h3>
            <span className="text-[10px] font-extrabold bg-primary-soft text-primary px-1.5 py-0.2 rounded-full font-mono shrink-0">
              {currentList.length}
            </span>
          </div>
        </div>

        {/* Middle: Normal vs Online mini-toggle pill */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg border border-surface-border shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTrackingMode('normal');
            }}
            className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
              trackingMode === 'normal'
                ? 'bg-surface text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {_t('عادي', 'Normal', 'Offline')} ({separatedLists.normalFollowUps.length})
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTrackingMode('online');
            }}
            className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
              trackingMode === 'online'
                ? 'bg-surface text-primary shadow-2xs'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {_t('أونلاين', 'Online', 'Online')} ({separatedLists.onlineFollowUps.length})
          </button>
        </div>

        {/* Right: Open / View Button */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-0.5 text-[11px] font-bold text-primary hover:underline shrink-0 px-1"
        >
          <span>{_t('عرض', 'View', 'Öffnen')}</span>
          <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isModalOpen && (
        <HomeworkFollowUpModal
          pendingFollowUps={currentList}
          initialTrackingMode={trackingMode}
          separatedLists={separatedLists}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};
