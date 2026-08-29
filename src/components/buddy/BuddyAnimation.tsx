import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BuddyMood, BuddyCustomization, DEFAULT_BUDDY_CUSTOMIZATION, BuddySkinTone, BuddyHairColor, BuddyOutfitColor } from '../../types/buddy';
import { useApp } from '../../context/AppContext';

interface BuddyAnimationProps {
  mood: BuddyMood;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  customization?: BuddyCustomization;
  popOut?: boolean;
}

// ==========================================
// PALETTES & COLOR DEFINITIONS
// ==========================================

const SKIN_PALETTES: Record<BuddySkinTone, { baseStart: string; baseEnd: string; shadow: string; blush: string; earInner: string }> = {
  fair: {
    baseStart: '#FFF7ED',
    baseEnd: '#FED7AA',
    shadow: '#FDBA74',
    blush: '#FB7185',
    earInner: '#FBCFE8'
  },
  tan: {
    baseStart: '#FFF1E6',
    baseEnd: '#F3C59D',
    shadow: '#E0A97C',
    blush: '#F43F5E',
    earInner: '#F6C1AC'
  },
  warm: {
    baseStart: '#FDE8D7',
    baseEnd: '#E3A877',
    shadow: '#C98650',
    blush: '#E11D48',
    earInner: '#EAB090'
  },
  bronze: {
    baseStart: '#F3D3BD',
    baseEnd: '#C68652',
    shadow: '#A66535',
    blush: '#BE123C',
    earInner: '#BE7842'
  },
  deep: {
    baseStart: '#D4A373',
    baseEnd: '#8D5B36',
    shadow: '#6B3F1E',
    blush: '#9F1239',
    earInner: '#7E4924'
  }
};

const HAIR_PALETTES: Record<BuddyHairColor, { start: string; end: string; highlight: string }> = {
  dark: {
    start: '#334155',
    end: '#0F172A',
    highlight: '#475569'
  },
  brown: {
    start: '#78350F',
    end: '#3E1805',
    highlight: '#92400E'
  },
  blonde: {
    start: '#FDE047',
    end: '#CA8A04',
    highlight: '#FEF08A'
  },
  auburn: {
    start: '#EA580C',
    end: '#7C2D12',
    highlight: '#FB923C'
  },
  gray: {
    start: '#94A3B8',
    end: '#334155',
    highlight: '#CBD5E1'
  }
};

const OUTFIT_PALETTES: Record<BuddyOutfitColor, { start: string; mid: string; end: string; collar: string; accent: string }> = {
  blue: {
    start: '#3B82F6',
    mid: '#2563EB',
    end: '#1D4ED8',
    collar: '#DBEAFE',
    accent: '#60A5FA'
  },
  emerald: {
    start: '#10B981',
    mid: '#059669',
    end: '#047857',
    collar: '#D1FAE5',
    accent: '#34D399'
  },
  purple: {
    start: '#8B5CF6',
    mid: '#7C3AED',
    end: '#6D28D9',
    collar: '#EDE9FE',
    accent: '#A78BFA'
  },
  rose: {
    start: '#F43F5E',
    mid: '#E11D48',
    end: '#BE123C',
    collar: '#FFE4E6',
    accent: '#FB7185'
  },
  amber: {
    start: '#F59E0B',
    mid: '#D97706',
    end: '#B45309',
    collar: '#FEF3C7',
    accent: '#FBBF24'
  },
  slate: {
    start: '#64748B',
    mid: '#475569',
    end: '#1E293B',
    collar: '#F1F5F9',
    accent: '#94A3B8'
  }
};

export const BuddyAnimation: React.FC<BuddyAnimationProps> = ({
  mood,
  size = 'md',
  interactive = true,
  customization,
  popOut = true
}) => {
  // Read customization from context if not explicitly passed
  let fallbackCustomization = DEFAULT_BUDDY_CUSTOMIZATION;
  try {
    const app = useApp();
    if (app?.profile?.buddyCustomization) {
      fallbackCustomization = app.profile.buddyCustomization;
    }
  } catch {
    // Outside context fallback
  }

  const activeConfig: BuddyCustomization = {
    ...DEFAULT_BUDDY_CUSTOMIZATION,
    ...(customization || fallbackCustomization)
  };

  const skin = SKIN_PALETTES[activeConfig.skinTone] || SKIN_PALETTES.fair;
  const hair = HAIR_PALETTES[activeConfig.hairColor] || HAIR_PALETTES.dark;
  const outfit = OUTFIT_PALETTES[activeConfig.outfitColor] || OUTFIT_PALETTES.blue;
  const isHijab = activeConfig.hairStyle === 'hijab';

  const containerSize = 
    size === 'sm' ? 'w-10 h-10' : 
    size === 'lg' ? 'w-20 h-20' : 
    size === 'xl' ? 'w-28 h-28' : 'w-14 h-14';

  const isSleeping = mood === 'sleeping';
  const isRelaxed = mood === 'relaxed';
  const isMorning = mood === 'morning';
  const isBusyOrChaos = mood === 'busy' || mood === 'chaos';
  const isFinished = mood === 'finished';
  const isCelebration = mood === 'celebration';

  // Dynamic animation states
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWinking, setIsWinking] = useState(false);
  const [lookDirection, setLookDirection] = useState<'center' | 'left' | 'right' | 'up'>('center');
  const [isFixingGlasses, setIsFixingGlasses] = useState(false);
  const [tapReaction, setTapReaction] = useState<number>(0);

  // 1. Natural Blinking Cycle
  useEffect(() => {
    if (isSleeping) return;
    const interval = setInterval(() => {
      if (Math.random() < 0.18 && !isBusyOrChaos) {
        setIsWinking(true);
        setTimeout(() => setIsWinking(false), 450);
      } else {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 140);
      }
    }, 3000 + Math.random() * 2500);
    return () => clearInterval(interval);
  }, [isSleeping, isBusyOrChaos]);

  // 2. Micro Eye Wander / Curious Look
  useEffect(() => {
    if (isSleeping || isBusyOrChaos) return;
    const interval = setInterval(() => {
      const dirs: ('center' | 'left' | 'right' | 'up')[] = ['center', 'left', 'right', 'center', 'up'];
      const nextDir = dirs[Math.floor(Math.random() * dirs.length)];
      setLookDirection(nextDir);
      setTimeout(() => setLookDirection('center'), 1400);
    }, 5000 + Math.random() * 3500);
    return () => clearInterval(interval);
  }, [isSleeping, isBusyOrChaos]);

  // 3. Spontaneous Glasses Adjustment
  useEffect(() => {
    if (isSleeping || activeConfig.glasses === 'none') return;
    const interval = setInterval(() => {
      if (Math.random() < 0.3 && !isBusyOrChaos) {
        setIsFixingGlasses(true);
        setTimeout(() => setIsFixingGlasses(false), 1200);
      }
    }, 9000 + Math.random() * 6000);
    return () => clearInterval(interval);
  }, [isSleeping, isBusyOrChaos, activeConfig.glasses]);

  // Tap handler
  const handleTap = () => {
    if (!interactive) return;
    setTapReaction(prev => prev + 1);
    setIsWinking(true);
    setTimeout(() => setIsWinking(false), 600);
  };

  // Pupils offset based on direction
  const pupilOffsetX = lookDirection === 'left' ? -1.6 : lookDirection === 'right' ? 1.6 : 0;
  const pupilOffsetY = lookDirection === 'up' ? -1.4 : 0;

  // Realistic vertical breathing / gentle bobbing (no harsh tremors!)
  const popOutY = 
    isCelebration && popOut ? [0, -8, 0] :
    isMorning && popOut ? [0, -4, 0] :
    isFinished && popOut ? [0, -5, 0] :
    isBusyOrChaos && popOut ? [0, -2, 0] :
    isSleeping ? [0, 2.5, 0] : [0, -2, 0];

  const popOutTransition = 
    isCelebration ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' as const } :
    isMorning ? { repeat: Infinity, duration: 2.4, ease: 'easeInOut' as const } :
    isFinished ? { repeat: Infinity, duration: 2.0, ease: 'easeInOut' as const } :
    isBusyOrChaos ? { repeat: Infinity, duration: 2.0, ease: 'easeInOut' as const } : // Smooth realistic focused breath
    isSleeping ? { repeat: Infinity, duration: 3.6, ease: 'easeInOut' as const } :
    { repeat: Infinity, duration: 3.2, ease: 'easeInOut' as const };

  return (
    <div 
      className={`relative ${containerSize} flex items-center justify-center select-none overflow-visible ${interactive ? 'cursor-pointer' : ''}`}
      onClick={handleTap}
    >
      <motion.div
        className="w-full h-full relative overflow-visible flex items-center justify-center"
        animate={{ y: popOutY }}
        transition={popOutTransition}
        whileTap={interactive ? { scale: 0.92, rotate: [0, -4, 4, 0] } : undefined}
        key={tapReaction}
      >
        <svg 
          viewBox="-16 -18 132 126" 
          className="w-full h-full overflow-visible drop-shadow-xs"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Skin Gradient */}
            <linearGradient id={`skinGrad_${activeConfig.skinTone}`} x1="50" y1="12" x2="50" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={skin.baseStart} />
              <stop offset="100%" stopColor={skin.baseEnd} />
            </linearGradient>

            {/* Hair Gradient */}
            <linearGradient id={`hairGrad_${activeConfig.hairColor}`} x1="50" y1="2" x2="50" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={hair.highlight} />
              <stop offset="40%" stopColor={hair.start} />
              <stop offset="100%" stopColor={hair.end} />
            </linearGradient>

            {/* Hoodie Torso Gradient */}
            <linearGradient id={`hoodieGrad_${activeConfig.outfitColor}`} x1="50" y1="50" x2="50" y2="92" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={outfit.start} />
              <stop offset="55%" stopColor={outfit.mid} />
              <stop offset="100%" stopColor={outfit.end} />
            </linearGradient>

            {/* Glasses Gradient */}
            <linearGradient id="glassesGrad" x1="28" y1="30" x2="72" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* ========================================== */}
          {/* 1. BACKGROUND & BURST EMOTION PARTICLES    */}
          {/* ========================================== */}

          {/* POP OUT: Morning Gentle Sunburst Rays */}
          {isMorning && (
            <g className="morning-sunburst opacity-70">
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 24, ease: 'linear' }}
                style={{ originX: '50px', originY: '38px' }}
              >
                {[-35, 0, 35, 70, 105, 140, 175, 210, 245, 280, 315].map((angle, idx) => (
                  <line
                    key={idx}
                    x1="50"
                    y1="-12"
                    x2="50"
                    y2="-5"
                    stroke="#F59E0B"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeOpacity={0.65}
                    transform={`rotate(${angle} 50 38)`}
                  />
                ))}
              </motion.g>
            </g>
          )}

          {/* POP OUT: Celebration Confetti & Sparkles */}
          {isCelebration && (
            <g className="celebration-particles">
              {/* Left Top Confetti */}
              <motion.rect
                x="-8"
                y="6"
                width="4.5"
                height="7"
                rx="1.5"
                fill="#EC4899"
                animate={{ 
                  y: [8, -14, 8],
                  x: [-4, -12, -4],
                  rotate: [0, 180, 360] 
                }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              />
              {/* Right Top Confetti */}
              <motion.rect
                x="98"
                y="4"
                width="5"
                height="6.5"
                rx="1.5"
                fill="#3B82F6"
                animate={{ 
                  y: [6, -16, 6],
                  x: [96, 106, 96],
                  rotate: [0, -220, -360] 
                }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut', delay: 0.15 }}
              />
              {/* Golden Star Far Top */}
              <motion.polygon
                points="50,-16 52,-11 57,-11 53,-8 55,-3 50,-6 45,-3 47,-8 43,-11 48,-11"
                fill="#F59E0B"
                animate={{ scale: [0.85, 1.2, 0.85], rotate: [0, 35, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                style={{ originX: '50px', originY: '-9px' }}
              />
              {/* Sparkle Left */}
              <motion.path
                d="M -10 22 Q -5 22 -5 17 Q -5 22 0 22 Q -5 22 -5 27 Q -5 22 -10 22 Z"
                fill="#10B981"
                animate={{ scale: [0.7, 1.15, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                style={{ originX: '-5px', originY: '22px' }}
              />
              {/* Sparkle Right */}
              <motion.path
                d="M 98 24 Q 103 24 103 19 Q 103 24 108 24 Q 103 24 103 29 Q 103 24 98 24 Z"
                fill="#8B5CF6"
                animate={{ scale: [0.75, 1.2, 0.75] }}
                transition={{ repeat: Infinity, duration: 1.6, delay: 0.3 }}
                style={{ originX: '103px', originY: '24px' }}
              />
            </g>
          )}

          {/* POP OUT: Sleeping Floating Moon & Zzz */}
          {isSleeping && (
            <g className="sleeping-night-fx">
              <motion.path
                d="M 92 -10 A 8 8 0 0 0 83 -1 A 8 8 0 1 1 92 -10 Z"
                fill="#FBBF24"
                animate={{ rotate: [-6, 6, -6], scale: [0.95, 1.05, 0.95] }}
                transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
                style={{ originX: '87px', originY: '-5px' }}
              />
              <motion.text
                x="86"
                y="6"
                fill="#818CF8"
                fontSize="10"
                fontWeight="900"
                fontFamily="system-ui"
                animate={{ y: [6, -3, 6], opacity: [0.4, 1, 0.4], x: [86, 90, 86] }}
                transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
              >
                Z
              </motion.text>
              <motion.text
                x="76"
                y="14"
                fill="#6366F1"
                fontSize="7.5"
                fontWeight="800"
                fontFamily="system-ui"
                animate={{ y: [14, 6, 14], opacity: [0.3, 0.9, 0.3] }}
                transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut', delay: 0.5 }}
              >
                z
              </motion.text>
            </g>
          )}

          {/* POP OUT: Busy Focus Soft Sweat Drop */}
          {isBusyOrChaos && (
            <g className="busy-focus-fx">
              <motion.ellipse
                cx="88"
                cy="20"
                rx="2"
                ry="3.5"
                fill="#38BDF8"
                animate={{ y: [0, 4, 0], opacity: [0.3, 0.9, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              />
            </g>
          )}

          {/* POP OUT: Relaxed Musical Notes */}
          {isRelaxed && (
            <g className="music-notes">
              <motion.text
                x="-10"
                y="14"
                fill="#A855F7"
                fontSize="11"
                animate={{ y: [14, 3, 14], opacity: [0.3, 0.9, 0.3], rotate: [-8, 8, -8] }}
                transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
              >
                🎵
              </motion.text>
              <motion.text
                x="96"
                y="15"
                fill="#3B82F6"
                fontSize="9"
                animate={{ y: [15, 4, 15], opacity: [0.35, 0.85, 0.35], rotate: [8, -8, 8] }}
                transition={{ repeat: Infinity, duration: 3.0, ease: 'easeInOut', delay: 0.6 }}
              >
                🎶
              </motion.text>
            </g>
          )}

          {/* ========================================== */}
          {/* 2. CHARACTER TORSO / HOODIE (CURVED BUST)  */}
          {/* Perfectly framed inside the circular disc  */}
          {/* ========================================== */}

          {/* Hijab Back Drape */}
          {isHijab && (
            <path
              d="M 22 44 C 20 30 28 10 50 10 C 72 10 80 30 78 44 C 82 56 84 72 74 84 C 64 90 36 90 26 84 C 16 72 18 56 22 44 Z"
              fill={outfit.end}
            />
          )}

          {/* Hoodie Torso Body - Smoothly Contoured to Avatar Circle Base */}
          <path
            d="M 22 56 C 22 49 32 48 50 48 C 68 48 78 49 78 56 L 80 76 C 80 88 66 94 50 94 C 34 94 20 88 20 76 Z"
            fill={`url(#hoodieGrad_${activeConfig.outfitColor})`}
          />

          {/* Inner Shirt / Clean V-Neck Collar */}
          <path
            d="M 43 48 L 50 58 L 57 48 Z"
            fill={outfit.collar}
          />
          <path
            d="M 50 58 L 50 68"
            stroke={outfit.end}
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Hoodie Kangaroo Front Pocket */}
          <path
            d="M 31 66 L 69 66 C 68 76 60 84 50 84 C 40 84 32 76 31 66 Z"
            fill={outfit.start}
            opacity={0.85}
          />

          {/* Hoodie Drawstrings */}
          <path
            d="M 45 54 L 45 65 M 55 54 L 55 65"
            stroke="white"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeOpacity={0.85}
          />
          <circle cx="45" cy="66" r="1" fill="white" />
          <circle cx="55" cy="66" r="1" fill="white" />

          {/* ========================================== */}
          {/* 3. EARS & HEAD BASE                        */}
          {/* ========================================== */}

          {/* Ears */}
          {!isHijab && (
            <g className="ears">
              {/* Left Ear */}
              <circle cx="24" cy="36" r="4.6" fill={skin.baseEnd} />
              <circle cx="24" cy="36" r="2.4" fill={skin.earInner} opacity={0.65} />
              {/* Right Ear */}
              <circle cx="76" cy="36" r="4.6" fill={skin.baseEnd} />
              <circle cx="76" cy="36" r="2.4" fill={skin.earInner} opacity={0.65} />
            </g>
          )}

          {/* Head Base */}
          <rect
            x="25"
            y="12"
            width="50"
            height="44"
            rx="20"
            fill={`url(#skinGrad_${activeConfig.skinTone})`}
            stroke={skin.shadow}
            strokeWidth="0.8"
          />

          {/* Rosy Cheek Blush */}
          <ellipse
            cx="33"
            cy="40"
            rx="5.2"
            ry="2.8"
            fill={skin.blush}
            opacity={isCelebration ? 0.65 : 0.45}
          />
          <ellipse
            cx="67"
            cy="40"
            rx="5.2"
            ry="2.8"
            fill={skin.blush}
            opacity={isCelebration ? 0.65 : 0.45}
          />

          {/* ========================================== */}
          {/* 4. HAIR & HEADWEAR STYLES                  */}
          {/* ========================================== */}

          {/* A. HIJAB STYLE */}
          {isHijab && (
            <g className="hair-hijab">
              {/* Front Hijab Frame */}
              <path
                d="M 25 28 C 25 12 34 6 50 6 C 66 6 75 12 75 28 C 75 36 73 46 73 54 C 67 58 57 60 50 60 C 43 60 33 58 27 54 C 27 46 25 36 25 28 Z"
                fill="none"
                stroke={outfit.mid}
                strokeWidth="3.6"
              />
              <path
                d="M 24 24 C 24 8 35 4 50 4 C 65 4 76 8 76 24 C 76 30 75 38 75 46 C 71 26 61 18 50 18 C 39 18 29 26 25 46 C 25 38 24 30 24 24 Z"
                fill={outfit.start}
              />
              {/* Elegant Pin Accent */}
              <circle cx="50" cy="18" r="1.8" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
            </g>
          )}

          {/* B. FLUFFY / WAVY HAIR */}
          {activeConfig.hairStyle === 'fluffy' && (
            <g className="hair-fluffy">
              <path
                d="M 23 26 C 22 12 33 3 50 3 C 67 3 78 12 77 26 C 75 24 70 20 63 20 C 57 20 53 24 49 22 C 43 20 38 18 32 22 C 27 24 24 26 23 26 Z"
                fill={`url(#hairGrad_${activeConfig.hairColor})`}
              />
              {/* Bouncy Hair Tuft on top */}
              <motion.path
                d="M 48 3 C 46 -3 54 -5 56 0 C 58 3 54 4 50 4 Z"
                fill={hair.highlight}
                animate={{ rotate: [-3, 5, -3] }}
                transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                style={{ originX: '48px', originY: '3px' }}
              />
            </g>
          )}

          {/* C. SHORT NEAT CROP */}
          {activeConfig.hairStyle === 'short' && (
            <g className="hair-short">
              <path
                d="M 24 24 C 23 12 34 5 50 5 C 66 5 77 12 76 24 C 73 21 67 18 57 18 C 46 18 35 23 24 24 Z"
                fill={`url(#hairGrad_${activeConfig.hairColor})`}
              />
              <path
                d="M 33 12 C 42 8 58 8 67 12"
                stroke={hair.highlight}
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* D. CURLY / AFRO PUFFS */}
          {activeConfig.hairStyle === 'curly' && (
            <g className="hair-curly">
              {/* Top Puffs */}
              <circle cx="31" cy="12" r="7.5" fill={hair.start} />
              <circle cx="43" cy="7" r="8.5" fill={hair.highlight} />
              <circle cx="57" cy="7" r="8.5" fill={hair.start} />
              <circle cx="69" cy="12" r="7.5" fill={hair.end} />
              <circle cx="50" cy="4" r="7" fill={hair.start} />
              {/* Forehead curls */}
              <path
                d="M 26 22 C 33 16 41 20 47 16 C 55 20 65 16 74 22 C 68 14 58 13 50 13 C 41 13 33 16 26 22 Z"
                fill={hair.end}
              />
            </g>
          )}

          {/* E. LONG / PONYTAIL */}
          {activeConfig.hairStyle === 'long' && (
            <g className="hair-long">
              {/* Side flowing locks */}
              <path
                d="M 23 24 C 21 36 19 50 25 58 C 27 48 26 36 28 28 Z"
                fill={hair.end}
              />
              <path
                d="M 77 24 C 79 36 81 50 75 58 C 73 48 74 36 72 28 Z"
                fill={hair.end}
              />
              {/* Top hair with side parting */}
              <path
                d="M 23 24 C 22 10 33 3 50 3 C 67 3 78 10 77 24 C 72 18 63 16 50 16 C 37 16 28 20 23 24 Z"
                fill={`url(#hairGrad_${activeConfig.hairColor})`}
              />
              {/* Cute Hairclip */}
              <rect x="67" y="14" width="5.5" height="2.8" rx="1.4" fill="#F43F5E" />
            </g>
          )}

          {/* F. CLEAN BUZZ / BALD */}
          {activeConfig.hairStyle === 'bald' && (
            <g className="hair-bald">
              <path
                d="M 29 18 C 39 13 61 13 71 18"
                stroke={skin.shadow}
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity={0.5}
              />
            </g>
          )}

          {/* ========================================== */}
          {/* 5. EYES & EXPRESSIONS                      */}
          {/* ========================================== */}

          {/* Sleeping Eyes */}
          {isSleeping && (
            <g className="eyes-sleeping">
              <path
                d="M 34 35 Q 40 41 46 35"
                stroke="#1E293B"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <path
                d="M 54 35 Q 60 41 66 35"
                stroke="#1E293B"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Celebration / Ecstatic Eyes (^ ^) */}
          {(isCelebration || isFinished) && !isSleeping && (
            <g className="eyes-celebration">
              <path
                d="M 33 36 L 40 30 L 47 36"
                stroke="#0F172A"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 53 36 L 60 30 L 67 36"
                stroke="#0F172A"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Active Eyes (with Live Blinking & Winking) */}
          {!isSleeping && !isCelebration && !isFinished && (
            <g className="eyes-active">
              {/* Left Eye */}
              {isBlinking ? (
                <line x1="34" y1="34" x2="46" y2="34" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" />
              ) : (
                <g>
                  <ellipse cx="40" cy="34" rx="5.2" ry="5.6" fill="#0F172A" />
                  <circle cx={41.5 + pupilOffsetX} cy={32.5 + pupilOffsetY} r="1.8" fill="white" />
                  <circle cx={39 + pupilOffsetX} cy={35.5 + pupilOffsetY} r="0.9" fill="white" />
                </g>
              )}

              {/* Right Eye */}
              {isBlinking || isWinking ? (
                <path
                  d="M 54 34 Q 60 30 66 35"
                  stroke="#0F172A"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
              ) : (
                <g>
                  <ellipse cx="60" cy="34" rx="5.2" ry="5.6" fill="#0F172A" />
                  <circle cx={61.5 + pupilOffsetX} cy={32.5 + pupilOffsetY} r="1.8" fill="white" />
                  <circle cx={59 + pupilOffsetX} cy={35.5 + pupilOffsetY} r="0.9" fill="white" />
                </g>
              )}
            </g>
          )}

          {/* ========================================== */}
          {/* 6. GLASSES (ROUND, SQUARE, OR NONE)        */}
          {/* ========================================== */}

          {activeConfig.glasses !== 'none' && (
            <motion.g 
              className="glasses"
              animate={isFixingGlasses ? { y: [0, -2.5, 0], scale: [1, 1.03, 1] } : {}}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              {/* A. ROUND GLASSES */}
              {activeConfig.glasses === 'round' && (
                <g>
                  <circle cx="40" cy="34" r="8" stroke="#1E293B" strokeWidth="2" fill="url(#glassesGrad)" />
                  <circle cx="60" cy="34" r="8" stroke="#1E293B" strokeWidth="2" fill="url(#glassesGrad)" />
                  <path d="M 48 33 Q 50 31 52 33" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
                  <line x1="32" y1="33" x2="26" y2="34" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="68" y1="33" x2="74" y2="34" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M 35 30 L 38 27 M 55 30 L 58 27" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity={0.8} />
                </g>
              )}

              {/* B. SQUARE GLASSES */}
              {activeConfig.glasses === 'square' && (
                <g>
                  <rect x="31" y="26" width="16" height="14" rx="3" stroke="#1E293B" strokeWidth="2" fill="url(#glassesGrad)" />
                  <rect x="53" y="26" width="16" height="14" rx="3" stroke="#1E293B" strokeWidth="2" fill="url(#glassesGrad)" />
                  <line x1="47" y1="32" x2="53" y2="32" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
                  <line x1="31" y1="31" x2="26" y2="33" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="69" y1="31" x2="74" y2="33" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="35" y1="29" x2="39" y2="29" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity={0.7} />
                  <line x1="57" y1="29" x2="61" y2="29" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity={0.7} />
                </g>
              )}
            </motion.g>
          )}

          {/* ========================================== */}
          {/* 7. MOUTH & SMILE                           */}
          {/* ========================================== */}

          {/* Celebration / Finished Open Smile */}
          {(isCelebration || isFinished) && (
            <g className="mouth-happy-open">
              <path
                d="M 43 45 Q 50 54 57 45 Z"
                fill="#DC2626"
                stroke="#0F172A"
                strokeWidth="1.4"
              />
              <path d="M 45 46 Q 50 48 55 46" fill="white" />
            </g>
          )}

          {/* Sleeping Smile */}
          {isSleeping && (
            <path
              d="M 46 45 Q 50 48 54 45"
              stroke="#334155"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          )}

          {/* Busy / Focused Smile */}
          {isBusyOrChaos && (
            <path
              d="M 44 45 Q 49 43 55 45"
              stroke="#0F172A"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}

          {/* Everyday Friendly Smile */}
          {!isCelebration && !isFinished && !isSleeping && !isBusyOrChaos && (
            <path
              d="M 44 44 Q 50 50 56 44"
              stroke="#0F172A"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}

          {/* ========================================== */}
          {/* 8. ARMS, HANDS & PROPS (CLEANLY FRAMED)    */}
          {/* ========================================== */}

          {/* A. MORNING STATE: Coffee Mug in Left Hand, Cheerful Wave in Right Hand */}
          {isMorning && (
            <g className="morning-arms-props">
              {/* Left Arm & Steaming Coffee Mug */}
              <motion.g
                animate={{ y: [0, -2, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              >
                {/* Left Sleeve */}
                <path
                  d="M 26 56 C 20 60 16 68 20 75 L 26 73 C 23 68 25 62 29 58 Z"
                  fill={outfit.mid}
                />
                <rect x="18" y="71" width="7" height="3" rx="1.5" fill={outfit.end} />
                {/* Coffee Mug */}
                <rect x="10" y="62" width="13" height="15" rx="2.5" fill="#E11D48" />
                <path d="M 23 66 Q 27 70 23 74" stroke="#E11D48" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                {/* Steaming Vapor Swirls */}
                <motion.path
                  d="M 14 59 Q 12 53 15 47 M 19 59 Q 22 53 18 47"
                  stroke="#94A3B8"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  fill="none"
                  animate={{ y: [0, -5, 0], opacity: [0.3, 0.9, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                />
                {/* Left Hand Gripping Mug */}
                <circle cx="21" cy="70" r="3.4" fill={skin.baseEnd} />
              </motion.g>

              {/* Right Arm Waving Cheerful & Smooth */}
              <motion.g
                animate={{ rotate: [-14, 14, -14] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                style={{ originX: '74px', originY: '56px' }}
              >
                {/* Raised Sleeve */}
                <path
                  d="M 74 56 L 86 44 L 90 48 L 77 62 Z"
                  fill={outfit.mid}
                />
                <rect x="85" y="42" width="7" height="3" rx="1.5" fill={outfit.end} transform="rotate(-40 85 42)" />
                {/* Right Waving Hand & Fingers */}
                <circle cx="91" cy="37" r="4.6" fill={skin.baseEnd} />
                <path d="M 90 34 L 90 28 M 93 35 L 95 30 M 87 36 L 85 31" stroke={skin.baseEnd} strokeWidth="2" strokeLinecap="round" />
              </motion.g>
            </g>
          )}

          {/* B. CELEBRATION STATE: Both Arms Raised in Joyful "V" Cheer */}
          {isCelebration && (
            <g className="celebration-arms-hands">
              {/* Left Raised Arm */}
              <motion.g
                animate={{ y: [0, -4, 0], rotate: [-8, 6, -8] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                style={{ originX: '26px', originY: '56px' }}
              >
                <path d="M 26 56 L 16 42 L 11 46 L 22 61 Z" fill={outfit.mid} />
                <rect x="11" y="41" width="7" height="3" rx="1.5" fill={outfit.end} transform="rotate(35 11 41)" />
                <circle cx="11" cy="35" r="4.8" fill={skin.baseEnd} />
                <path d="M 11 31 L 11 25 M 8 33 L 4 29 M 14 33 L 18 29" stroke={skin.baseEnd} strokeWidth="2" strokeLinecap="round" />
              </motion.g>

              {/* Right Raised Arm */}
              <motion.g
                animate={{ y: [0, -4, 0], rotate: [8, -6, 8] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut', delay: 0.1 }}
                style={{ originX: '74px', originY: '56px' }}
              >
                <path d="M 74 56 L 84 42 L 89 46 L 78 61 Z" fill={outfit.mid} />
                <rect x="83" y="41" width="7" height="3" rx="1.5" fill={outfit.end} transform="rotate(-35 83 41)" />
                <circle cx="89" cy="35" r="4.8" fill={skin.baseEnd} />
                <path d="M 89 31 L 89 25 M 86 33 L 82 29 M 92 33 L 96 29" stroke={skin.baseEnd} strokeWidth="2" strokeLinecap="round" />
              </motion.g>
            </g>
          )}

          {/* C. BUSY / TASK WRITING STATE: Realistic, Calm, Smooth Writing Gesture */}
          {isBusyOrChaos && (
            <g className="busy-arms-props">
              {/* Left Arm Holding Task Checklist Clipboard */}
              <g className="left-arm-clipboard">
                <path d="M 26 56 C 20 61 18 68 24 76 L 29 73 C 25 68 26 62 30 58 Z" fill={outfit.mid} />
                {/* Clipboard */}
                <rect x="15" y="60" width="16" height="21" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.1" />
                <rect x="19" y="58" width="8" height="3" rx="1" fill="#64748B" />
                <line x1="18" y1="65" x2="27" y2="65" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="18" y1="69" x2="26" y2="69" stroke="#94A3B8" strokeWidth="1.1" strokeLinecap="round" />
                <line x1="18" y1="73" x2="28" y2="73" stroke="#94A3B8" strokeWidth="1.1" strokeLinecap="round" />
                {/* Left Hand Gripping Clipboard */}
                <circle cx="28" cy="72" r="3.4" fill={skin.baseEnd} />
              </g>

              {/* Right Arm & Pencil Writing - Smooth & Realistic Handwriting Rhythm */}
              <motion.g
                animate={{ 
                  rotate: [-8, 6, -4, 4, -8],
                  x: [0, 2, 3, 1, 0],
                  y: [0, 1.2, 0.4, 1.5, 0]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 1.8, 
                  ease: 'easeInOut' 
                }}
                style={{ originX: '70px', originY: '58px' }}
              >
                <path d="M 72 56 C 77 60 78 68 72 74 L 68 71 C 72 67 71 62 67 58 Z" fill={outfit.mid} />
                {/* Sharp Yellow Pencil writing across note */}
                <line x1="64" y1="58" x2="75" y2="72" stroke="#F59E0B" strokeWidth="2.8" strokeLinecap="round" />
                <polygon points="75,72 77,74 73,74" fill="#1E293B" />
                {/* Right Hand Holding Pencil */}
                <circle cx="69" cy="66" r="3.6" fill={skin.baseEnd} />
              </motion.g>
            </g>
          )}

          {/* D. RELAXED / ZEN STATE: Peaceful Hands resting symmetrically */}
          {isRelaxed && (
            <g className="relaxed-arms-hands">
              {/* Left Arm Resting */}
              <path d="M 26 56 C 20 62 20 70 30 75 L 32 71 C 24 67 24 62 29 58 Z" fill={outfit.mid} />
              <rect x="27" y="72" width="5" height="2.5" rx="1" fill={outfit.end} />
              <circle cx="32" cy="75" r="3.2" fill={skin.baseEnd} />

              {/* Right Arm Resting */}
              <path d="M 74 56 C 80 62 80 70 70 75 L 68 71 C 76 67 76 62 71 58 Z" fill={outfit.mid} />
              <rect x="68" y="72" width="5" height="2.5" rx="1" fill={outfit.end} />
              <circle cx="68" cy="75" r="3.2" fill={skin.baseEnd} />
            </g>
          )}

          {/* E. SLEEPING STATE: Arms Cosily Tucked in */}
          {isSleeping && (
            <g className="sleeping-arms-hands">
              {/* Left Arm Tucked */}
              <path d="M 26 56 C 21 62 23 71 34 73 L 35 69 C 26 67 25 61 29 58 Z" fill={outfit.mid} />
              <circle cx="36" cy="72" r="3" fill={skin.baseEnd} />

              {/* Right Arm Tucked */}
              <path d="M 74 56 C 79 62 77 71 66 73 L 65 69 C 74 67 75 61 71 58 Z" fill={outfit.mid} />
              <circle cx="64" cy="72" r="3" fill={skin.baseEnd} />
            </g>
          )}

          {/* F. NORMAL / EVERYDAY IDLE STATE: Both Hands Visible, Friendly Natural Wave */}
          {!isMorning && !isCelebration && !isBusyOrChaos && !isRelaxed && !isSleeping && (
            <g className="normal-arms-hands">
              {/* Left Arm & Hand (Resting naturally at side with thumb) */}
              <g className="left-arm">
                <path
                  d="M 25 56 C 18 61 17 70 22 76 L 27 73 C 23 69 23 63 28 58 Z"
                  fill={outfit.mid}
                />
                <rect x="21" y="72" width="6" height="2.8" rx="1.2" fill={outfit.end} />
                <circle cx="24" cy="77" r="3.4" fill={skin.baseEnd} />
                <ellipse cx="27" cy="75" rx="1.5" ry="1.1" fill={skin.baseEnd} />
              </g>

              {/* Right Arm & Hand (Waving cheerfully or adjusting glasses) */}
              {isFixingGlasses && activeConfig.glasses !== 'none' ? (
                <motion.g
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 12, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <path d="M 74 56 C 80 50 80 42 74 36 L 70 39 C 74 43 74 48 70 54 Z" fill={outfit.mid} />
                  <circle cx="70" cy="36" r="3.4" fill={skin.baseEnd} />
                  <path d="M 70 34 L 68 32" stroke={skin.baseEnd} strokeWidth="2" strokeLinecap="round" />
                </motion.g>
              ) : (
                <motion.g
                  animate={{ rotate: [-6, 8, -6], y: [-0.8, 0.8, -0.8] }}
                  transition={{ repeat: Infinity, duration: 2.0, ease: 'easeInOut' }}
                  style={{ originX: '74px', originY: '56px' }}
                >
                  {/* Right Sleeve */}
                  <path
                    d="M 75 56 C 82 60 84 67 80 74 L 75 72 C 78 67 77 61 72 58 Z"
                    fill={outfit.mid}
                  />
                  <rect x="75" y="71" width="6" height="2.8" rx="1.2" fill={outfit.end} transform="rotate(15 75 71)" />
                  {/* Cute Right Waving Hand with Open Fingers */}
                  <circle cx="82" cy="74" r="3.8" fill={skin.baseEnd} />
                  {/* Gentle Finger Tufts */}
                  <path d="M 84 71 L 87 69 M 85 74 L 89 73 M 83 77 L 86 78" stroke={skin.baseEnd} strokeWidth="1.6" strokeLinecap="round" />
                </motion.g>
              )}
            </g>
          )}

        </svg>
      </motion.div>
    </div>
  );
};
