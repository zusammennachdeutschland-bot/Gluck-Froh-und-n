import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Lade Daten...',
}) => {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        const jump = Math.floor(Math.random() * 14) + 4;
        return Math.min(prev + jump, 95);
      });
    }, 280);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      id="app-loading-screen"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between min-h-[100dvh] w-screen overflow-hidden bg-gradient-to-b from-[#F0FDF4] via-[#F8FAFC] to-[#ECFDF5] dark:from-[#022C22] dark:via-[#0F172A] dark:to-[#042F2E] select-none px-6 py-10 transition-colors duration-500"
    >
      {/* Dynamic Ambient Background Lights */}
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-emerald-400/20 dark:bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 -right-28 w-72 h-72 rounded-full bg-sky-400/20 dark:bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-amber-400/15 dark:bg-amber-500/10 blur-3xl pointer-events-none" />

      {/* Top Header Badge */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border border-emerald-500/20 dark:border-emerald-500/30"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
          GLÜCK • Deutschlehrer Manager
        </span>
      </motion.div>

      {/* Main Center Area: Luxury Brand Showcase */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="flex flex-col items-center justify-center max-w-sm w-full z-10 my-auto text-center"
      >
        {/* Floating Logo with Soft Glow */}
        <div className="relative w-64 sm:w-72 aspect-square flex items-center justify-center mb-6">
          {/* Subtle Rotating Ambient Ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/10 via-sky-500/10 to-amber-500/10 dark:from-emerald-500/20 dark:via-sky-500/15 dark:to-amber-500/15 blur-xl animate-pulse" />

          <img
            src="/logo.svg"
            alt="Glück Brand Logo"
            className="w-full h-full object-contain filter drop-shadow-[0_12px_24px_rgba(4,120,87,0.18)] dark:drop-shadow-[0_12px_28px_rgba(16,185,129,0.25)] transform transition-transform duration-700 hover:scale-105"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Progress Bar Container */}
        <div className="w-64 sm:w-72 mt-2 mb-4">
          <div className="flex justify-between items-center text-[11px] font-black text-emerald-900/70 dark:text-emerald-300/80 mb-1.5 px-1">
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {message}
            </span>
            <span className="font-mono">{progress}%</span>
          </div>

          <div className="h-3 w-full bg-slate-200/90 dark:bg-slate-800/90 rounded-full p-0.5 overflow-hidden shadow-inner border border-slate-300/60 dark:border-slate-700/80 backdrop-blur-sm">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 shadow-sm transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              {/* Highlight Shimmer on Progress Tip */}
              <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/70 rounded-full blur-[1px]" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Bottom Footer Credit */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="flex flex-col items-center gap-1.5 z-10 text-center max-w-md px-4"
      >
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/5 dark:bg-emerald-900/30 border border-emerald-900/10 dark:border-emerald-500/20 shadow-xs">
          <span className="text-amber-500 text-xs">✨</span>
          <p className="text-xs font-black text-emerald-950 dark:text-emerald-200 tracking-wide">
            تصميم وتطوير: <span className="text-emerald-700 dark:text-emerald-400 font-black">عبدالرحمن غريب</span>
          </p>
          <span className="text-amber-500 text-xs">✨</span>
        </div>
        <p className="text-[11px] sm:text-xs font-medium text-emerald-900/90 dark:text-emerald-300/90 leading-relaxed">
          برجاء خالص الدعاء له بظهر الغيب بالتوفيق والبركة والقبول وجزيل الأجر والثواب 🤲
        </p>
        <p className="text-[9.5px] font-medium text-slate-400 dark:text-slate-500">
          Glück • Das ultimative Lehrermanagement-System
        </p>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
