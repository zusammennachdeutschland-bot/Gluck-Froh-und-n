import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';

export const HERR_ABDULRAHMAN_LOGO_SRC =
  '/assets/aistudio/logo-removebg-preview__1__1a8a6028.png';

type CrestSize = 'xs' | 'sm' | 'card' | 'md' | 'lg';

interface TeacherCrestLogoProps {
  size?: CrestSize;
  className?: string;
  showFrameRing?: boolean;
}

const SIZE_CLASSES: Record<CrestSize, { outer: string; inner: string; fallbackTitle: string; fallbackCap: string }> = {
  xs: {
    outer: 'w-8 h-8 sm:w-9 sm:h-9 p-0.5',
    inner: 'p-0.5',
    fallbackTitle: 'text-[8px]',
    fallbackCap: 'w-2.5 h-2.5'
  },
  sm: {
    outer: 'w-11 h-11 p-0.5',
    inner: 'p-0.5',
    fallbackTitle: 'text-[10px]',
    fallbackCap: 'w-3 h-3'
  },
  card: {
    outer: 'w-14 h-14 sm:w-16 sm:h-16 p-1',
    inner: 'p-0.5',
    fallbackTitle: 'text-xs',
    fallbackCap: 'w-4 h-4'
  },
  md: {
    outer: 'w-24 h-24 sm:w-28 sm:h-28 p-1.5',
    inner: 'p-1',
    fallbackTitle: 'text-base',
    fallbackCap: 'w-5 h-5'
  },
  lg: {
    outer: 'w-32 h-32 sm:w-36 sm:h-36 p-1.5',
    inner: 'p-1.5',
    fallbackTitle: 'text-xl',
    fallbackCap: 'w-6 h-6'
  }
};

/**
 * Architectural dark-slate medallion framing Herr Abdul-rahman's transparent
 * white-calligraphy & German-tricolor brush crest so both the white lettering
 * and the black-red-gold ring maintain crisp contrast across light & dark themes.
 */
export const TeacherCrestLogo: React.FC<TeacherCrestLogoProps> = ({
  size = 'lg',
  className = '',
  showFrameRing = true
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const dims = SIZE_CLASSES[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none ${dims.outer} ${
        showFrameRing
          ? 'bg-[radial-gradient(circle_at_50%_40%,#2a3952_0%,#151e2e_66%,#0c111c_100%)] border border-[#D4AF37]/50 shadow-[0_14px_30px_-10px_rgba(9,13,22,0.75)]'
          : 'bg-[#162032]'
      } ${className}`}
    >
      {showFrameRing && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[3px] rounded-full border border-white/10"
        />
      )}

      <div className={`relative w-full h-full rounded-full flex items-center justify-center overflow-hidden ${dims.inner}`}>
        {!imgFailed ? (
          <img
            src={HERR_ABDULRAHMAN_LOGO_SRC}
            alt="Herr Abdul-rahman Deutschunterricht"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full rounded-full border-2 border-[#D4AF37]/70 flex flex-col items-center justify-center text-white bg-[#141c2b]">
            <GraduationCap className={`${dims.fallbackCap} text-[#F3D078] mb-0.5`} />
            <span className={`font-cert-serif font-bold tracking-wider ${dims.fallbackTitle}`}>
              H·A
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
