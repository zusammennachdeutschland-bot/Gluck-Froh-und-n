import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen } from 'lucide-react';
import { getPendingHomeworkFollowUps } from '../utils/homeworkFollowUpUtils';
import { HomeworkFollowUpModal } from './HomeworkFollowUpModal';

export const HomeworkFollowUpWidget: React.FC = () => {
  const { lessons, groups } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pendingFollowUps = getPendingHomeworkFollowUps(lessons, groups);

  if (pendingFollowUps.length === 0) return null;

  return (
    <>
      <div 
        onClick={() => setIsModalOpen(true)}
        className="mx-5 mb-5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg shadow-orange-500/20 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-black text-base drop-shadow-sm">Homework Follow-Up</h3>
            <p className="text-orange-100 text-xs font-bold mt-0.5">
              {pendingFollowUps.length} Pending
            </p>
          </div>
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
