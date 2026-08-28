import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGlueckBuddy } from '../../hooks/useGlueckBuddy';
import { BuddyAnimation } from './BuddyAnimation';
import { BuddySpeechBubble } from './BuddySpeechBubble';
import { BuddyBriefModal } from './BuddyBriefModal';

export const GlueckBuddyFloating: React.FC = () => {
  const { workload, isBriefOpen, openBrief, closeBrief, showAutoGreeting } = useGlueckBuddy();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end pointer-events-auto">
        {/* Speech Bubble Popup (Auto Greeting or on Hover) */}
        <AnimatePresence>
          {(showAutoGreeting || isHovered) && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-2 mr-2 pointer-events-none"
            >
              <BuddySpeechBubble text={workload.greetingText} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Character Scene Container */}
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          onClick={openBrief}
          className="relative cursor-pointer group filter drop-shadow-lg"
          title="Glück Buddy — Tap for Daily Brief"
        >
          {/* Subtle glowing aura behind character */}
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Character Scene */}
          <div className="relative p-1.5 bg-surface/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-primary/30 shadow-xl overflow-hidden">
            <BuddyAnimation mood={workload.mood} size="lg" />

            {/* Score Badge Pill */}
            <div className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-full bg-primary text-white text-[9px] font-black shadow-xs ring-2 ring-white dark:ring-slate-900">
              {workload.score}
            </div>
          </div>
        </motion.div>
      </div>

      <BuddyBriefModal
        isOpen={isBriefOpen}
        onClose={closeBrief}
        workload={workload}
      />
    </>
  );
};
