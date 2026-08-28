import React from 'react';
import { motion } from 'motion/react';

interface BuddySpeechBubbleProps {
  text: string;
  onClose?: () => void;
}

export const BuddySpeechBubble: React.FC<BuddySpeechBubbleProps> = ({ text }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative bg-surface dark:bg-slate-900 border border-surface-border dark:border-surface-border-soft px-3 py-2 rounded-2xl shadow-md text-xs font-bold text-text-main max-w-xs"
    >
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-surface dark:bg-slate-900 border-l border-b border-surface-border dark:border-surface-border-soft rotate-45" />
      <p className="leading-relaxed">{text}</p>
    </motion.div>
  );
};
