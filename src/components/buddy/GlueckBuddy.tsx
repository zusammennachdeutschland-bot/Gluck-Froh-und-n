import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGlueckBuddy } from '../../hooks/useGlueckBuddy';
import { BuddyAnimation } from './BuddyAnimation';
import { BuddySpeechBubble } from './BuddySpeechBubble';
import { BuddyBriefModal } from './BuddyBriefModal';
import { Sparkles, ChevronRight } from 'lucide-react';

export const GlueckBuddy: React.FC = () => {
  const { workload, isBriefOpen, openBrief, closeBrief, showAutoGreeting } = useGlueckBuddy();

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={openBrief}
        className="group relative bg-surface dark:bg-slate-900 border border-surface-border dark:border-surface-border-soft rounded-2xl p-3 sm:p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 overflow-hidden"
      >
        {/* Subtle background accent glow */}
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none group-hover:bg-primary/10 transition-colors" />

        <div className="flex items-center gap-3 min-w-0">
          <BuddyAnimation mood={workload.mood} size="md" />

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs sm:text-sm text-text-main tracking-tight">Glück Buddy</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                {workload.score}/100
              </span>
            </div>
            <p className="text-xs text-text-muted font-medium truncate">
              {workload.statusHeadline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AnimatePresence>
            {showAutoGreeting && (
              <div className="hidden sm:block">
                <BuddySpeechBubble text={workload.greetingText} />
              </div>
            )}
          </AnimatePresence>

          <div className="p-2 rounded-xl bg-background dark:bg-slate-800 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all">
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </div>
        </div>
      </motion.div>

      <BuddyBriefModal
        isOpen={isBriefOpen}
        onClose={closeBrief}
        workload={workload}
      />
    </>
  );
};
