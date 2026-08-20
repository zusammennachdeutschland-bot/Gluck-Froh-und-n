import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, ChevronRight } from 'lucide-react';
import { getPendingHomeworkFollowUps } from '../utils/homeworkFollowUpUtils';
import { HomeworkFollowUpModal } from './HomeworkFollowUpModal';

export const HomeworkFollowUpWidget: React.FC = () => {
  const { lessons, groups, _t, isRtl } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pendingFollowUps = getPendingHomeworkFollowUps(lessons, groups);

  if (pendingFollowUps.length === 0) return null;

  return (
    <>
      <div 
        onClick={() => setIsModalOpen(true)}
        className="bg-surface border border-surface-border rounded-xl p-2.5 sm:p-3 shadow-2xs flex items-center justify-between gap-2.5 transition-all cursor-pointer hover:bg-surface-hover/80 active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary border border-primary-border flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-main truncate">
                {_t('متابعة الواجبات', 'Homework Follow-Up', 'Hausaufgaben-Nachverfolgung')}
              </h3>
              <span className="text-[10px] font-extrabold bg-primary-soft text-primary px-1.5 py-0.2 rounded-full font-mono">
                {pendingFollowUps.length}
              </span>
            </div>
            <p className="text-[10px] text-text-muted truncate mt-0.5">
              {_t(
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

