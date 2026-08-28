import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BuddyMood } from '../../types/buddy';

interface BuddyAnimationProps {
  mood: BuddyMood;
  size?: 'sm' | 'md' | 'lg';
}

export const BuddyAnimation: React.FC<BuddyAnimationProps> = ({ mood, size = 'md' }) => {
  const isCompact = size === 'sm';
  const containerSize = isCompact ? 'w-10 h-10' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';

  const isSleeping = mood === 'sleeping';
  const isRelaxed = mood === 'relaxed';
  const isMorning = mood === 'morning';
  const isBusyOrChaos = mood === 'busy' || mood === 'chaos';
  const isFinished = mood === 'finished';
  const isCelebration = mood === 'celebration';

  // Blink state simulation
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    if (isSleeping) return;
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 3500 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [isSleeping]);

  return (
    <div className={`relative flex items-center justify-center shrink-0 rounded-2xl bg-surface dark:bg-slate-900 border border-surface-border dark:border-surface-border-soft overflow-hidden ${containerSize}`}>
      {/* Modern Clean Vector Mascot SVG */}
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="sweaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
        </defs>

        {/* Mascot Container Group with Smooth Idle Animation */}
        <motion.g
          animate={
            isMorning
              ? { y: [0, -2, 0], rotate: [0, 1.5, -1.5, 0] }
              : isBusyOrChaos
              ? { x: [0, 1, -1, 1, 0] }
              : isCelebration
              ? { y: [0, -3, 0], scale: [1, 1.02, 1] }
              : isSleeping
              ? { y: [0, 1.5, 0] }
              : { y: [0, -1, 0] }
          }
          transition={{ repeat: Infinity, duration: isBusyOrChaos ? 1.2 : 3.5, ease: 'easeInOut' }}
        >
          {/* Shoulders / Body / Smart Cardigan */}
          <path d="M 28 92 C 28 75, 38 68, 50 68 C 62 68, 72 75, 72 92 Z" fill="url(#sweaterGrad)" />
          
          {/* Shirt Collar & Tie Accent */}
          <polygon points="50,68 44,76 56,76" fill="#ffffff" />
          <polygon points="49,74 51,74 52,88 48,88" fill="#1e293b" />

          {/* Neck */}
          <rect x="44" y="56" width="12" height="14" rx="3" fill="#fde68a" />

          {/* Head */}
          <motion.g
            animate={isSleeping ? { rotate: [0, 4, 0] } : { rotate: [0, 0.8, -0.8, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
          >
            {/* Ears */}
            <circle cx="32" cy="42" r="4.5" fill="#fde68a" />
            <circle cx="68" cy="42" r="4.5" fill="#fde68a" />

            {/* Face Base */}
            <rect x="33" y="28" width="34" height="34" rx="16" fill="url(#skinGrad)" />

            {/* Modern Hair Silhouette */}
            <path d="M 32 36 C 32 23, 41 19, 50 19 C 59 19, 68 23, 68 36 C 68 38, 66 36, 64 30 C 59 22, 41 22, 36 30 C 34 36, 32 38, 32 36 Z" fill="url(#hairGrad)" />

            {/* Modern Round Teacher Glasses */}
            <g stroke="#0f172a" strokeWidth="1.8" fill="none" opacity="0.85">
              <circle cx="41" cy="41" r="6.5" fill="#ffffff" fillOpacity="0.15" />
              <circle cx="59" cy="41" r="6.5" fill="#ffffff" fillOpacity="0.15" />
              <line x1="47.5" y1="41" x2="52.5" y2="41" strokeWidth="1.8" />
            </g>

            {/* Eyes / Blink */}
            {isSleeping || isBlinking ? (
              <g stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round">
                <path d="M 38 41 Q 41 43 44 41" fill="none" />
                <path d="M 56 41 Q 59 43 62 41" fill="none" />
              </g>
            ) : (
              <g fill="#0f172a">
                <circle cx="41" cy="41" r="1.8" />
                <circle cx="59" cy="41" r="1.8" />
              </g>
            )}

            {/* Smile / Expression */}
            {isSleeping ? (
              <text x="44" y="54" fontSize="8" fill="#3b82f6" fontWeight="bold">zZ</text>
            ) : isFinished || isRelaxed ? (
              <path d="M 44 51 Q 50 55 56 51" stroke="#0f172a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            ) : isBusyOrChaos ? (
              <path d="M 45 53 Q 50 49 55 53" stroke="#0f172a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M 45 52 Q 50 54.5 55 52" stroke="#0f172a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            )}
          </motion.g>
        </motion.g>

        {/* Celebration Star */}
        {isCelebration && (
          <motion.text 
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1], rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            x="74" y="22" fontSize="12"
          >
            ✨
          </motion.text>
        )}
      </svg>
    </div>
  );
};
