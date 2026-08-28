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
      <div className="relative group shrink-0">
        <motion.div
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          onClick={openBrief}
          className="relative cursor-pointer flex items-center justify-center w-10 h-10 rounded-full bg-surface dark:bg-slate-900 border border-primary/30 shadow-2xs overflow-hidden"
          title="Glück Buddy — Tap for Daily Brief"
          aria-label="Open Glück Buddy daily brief"
        >
          {/* Animated Teacher Mascot Avatar */}
          <div className="w-full h-full flex items-center justify-center">
            <BuddyAnimation mood={workload.mood} size="sm" />
          </div>

          {/* Minimalist Score Badge Pill */}
          <div className="absolute -bottom-0.5 -right-0.5 px-1 py-0.2 rounded-full bg-primary text-white text-[8px] font-black shadow-2xs ring-1 ring-white dark:ring-slate-900 z-10">
            {workload.score}
          </div>
        </motion.div>

        {/* Speech Bubble Popup on Hover or Morning Auto Greeting */}
        <AnimatePresence>
          {(showAutoGreeting || isHovered) && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-12 left-0 z-50 pointer-events-none w-52 sm:w-60 shadow-xl"
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
