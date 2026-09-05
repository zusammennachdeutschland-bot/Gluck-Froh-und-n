import React from 'react';
import { Phone } from 'lucide-react';
import { motion } from 'motion/react';

interface WelcomeSplashScreenProps {
  appName?: string;
  tagline?: string;
  userName?: string;
  phoneNumber?: string;
  onContinue?: () => void;
}

export const WelcomeSplashScreen: React.FC<WelcomeSplashScreenProps> = ({
  appName = 'GLÜCK',
  tagline = 'fröhlich und froh',
  userName = 'HERR ABDUL-RAHMAN',
  phoneNumber = '01156435802',
  onContinue,
}) => {
  return (
    <div
      id="welcome-splash-screen"
      onClick={onContinue}
      className="min-h-screen w-full bg-surface dark:bg-background text-text-main flex flex-col items-center justify-center p-6 select-none transition-colors duration-300 relative overflow-hidden cursor-pointer"
    >
      {/* Centered Vertical Stack */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-sm flex flex-col items-center justify-center text-center space-y-3"
      >
        {/* 1. Primary Brand Logo */}
        <div className="flex flex-col items-center">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-primary dark:text-primary leading-none uppercase drop-shadow-xs">
            {appName}
          </h1>
          {tagline && (
            <p className="text-[11px] sm:text-xs font-semibold tracking-widest uppercase text-primary/80 dark:text-primary/80 mt-1.5">
              {tagline}
            </p>
          )}
        </div>

        {/* Minimal Divider */}
        <div className="w-12 h-0.5 bg-primary/20 dark:bg-primary/30 rounded-full my-2" />

        {/* 2. User Name (Subtle & Hierarchical) */}
        {userName && (
          <h2 className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-200 tracking-wide uppercase break-words max-w-full px-2">
            {userName}
          </h2>
        )}

        {/* 3. Subtle Phone Number */}
        {phoneNumber && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted/80 dark:text-text-muted/70 font-mono mt-1">
            <Phone className="w-3.5 h-3.5 shrink-0 opacity-75" />
            <span className="tracking-wider">{phoneNumber}</span>
          </div>
        )}
      </motion.div>

      {/* Subtle Footer indicator if interactive */}
      {onContinue && (
        <div className="absolute bottom-8 text-[11px] text-text-muted/60 dark:text-text-muted/50 tracking-wider animate-pulse">
          Tap anywhere to continue
        </div>
      )}
    </div>
  );
};

export default WelcomeSplashScreen;
