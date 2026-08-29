import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGlueckBuddy } from '../../hooks/useGlueckBuddy';
import { BuddyAnimation } from './BuddyAnimation';
import { BuddySpeechBubble } from './BuddySpeechBubble';
import { BuddyBriefModal } from './BuddyBriefModal';

export const GlueckBuddyAvatar: React.FC = () => {
  const { workload, isBriefOpen, openBrief, closeBrief, showAutoGreeting } = useGlueckBuddy();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <div className="relative group shrink-0 select-none">
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          onClick={openBrief}
          className="relative cursor-pointer block p-0 bg-transparent border-0 outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
          title="Glück Buddy — Daily Brief"
          aria-label="Open Glück Buddy daily brief"
        >
          {/* Avatar Base Disc Frame (Underneath Portal) - Increased size for crisp visibility */}
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-linear-to-b from-blue-50/90 via-surface to-indigo-50/80 dark:from-slate-850 dark:via-slate-800 dark:to-slate-900 border-2 border-primary/35 dark:border-primary/50 shadow-md absolute inset-0 pointer-events-none" />

          {/* 3D Burst Out Avatar Mascot (Overflow Visible) */}
          <div className="relative w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center overflow-visible z-10">
            <BuddyAnimation mood={workload.mood} size="md" popOut={true} interactive={false} />
          </div>

          {/* Fully Visible Modern Pill Score Badge */}
          <div 
            className="absolute -bottom-1 -right-1 ltr:-right-1 rtl:-left-1 min-w-[22px] h-[19px] px-1.5 rounded-full bg-linear-to-r from-primary to-indigo-600 text-white text-[10px] font-black tracking-tight flex items-center justify-center shadow-md ring-2 ring-surface dark:ring-slate-900 z-20 pointer-events-none"
            title={`Score: ${workload.score}`}
          >
            {workload.score}
          </div>
        </motion.button>

        {/* Speech Bubble Popup on Hover or Morning Auto Greeting */}
        <AnimatePresence>
          {(showAutoGreeting || isHovered) && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-15 ltr:left-0 rtl:right-0 z-50 pointer-events-none w-56 sm:w-64 shadow-xl"
            >
              <BuddySpeechBubble text={workload.greetingText} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BuddyBriefModal
        isOpen={isBriefOpen}
        onClose={closeBrief}
        workload={workload}
      />
    </>
  );
};
