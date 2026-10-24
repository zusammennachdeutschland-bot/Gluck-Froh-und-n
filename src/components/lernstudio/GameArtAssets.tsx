import React from 'react';

export interface GameIllustrationProps {
  gameId: string;
  className?: string;
}

/**
  Rich SVG Educational Game Art Assets for Glück German Games.
  Provides custom illustrated thumbnails, environments, vector cards, and mascots for every game mode.
 */
export const GameThumbnailArt: React.FC<GameIllustrationProps> = ({ gameId, className = "w-full h-full" }) => {
  switch (gameId) {
    case 'wheel':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="wheel_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F59E0B" />
              <stop offset="1" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="wheel_center" x1="100" y1="55" x2="100" y2="95" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FEF08A" />
              <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="shadow_w" x="0" y="0" width="200" height="150" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.25" />
            </filter>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#wheel_bg)" />
          <circle cx="100" cy="75" r="55" fill="#1E293B" opacity="0.2" />
          <circle cx="100" cy="72" r="52" fill="#FFFFFF" />
          
          {/* Wheel Segments */}
          <path d="M100 72 L100 20 A52 52 0 0 1 152 72 Z" fill="#EF4444" />
          <path d="M100 72 L152 72 A52 52 0 0 1 100 124 Z" fill="#3B82F6" />
          <path d="M100 72 L100 124 A52 52 0 0 1 48 72 Z" fill="#10B981" />
          <path d="M100 72 L48 72 A52 52 0 0 1 100 20 Z" fill="#F59E0B" />
          
          {/* Pegs */}
          <circle cx="100" cy="24" r="3" fill="#FFF" />
          <circle cx="148" cy="72" r="3" fill="#FFF" />
          <circle cx="100" cy="120" r="3" fill="#FFF" />
          <circle cx="52" cy="72" r="3" fill="#FFF" />

          {/* Center Hub */}
          <circle cx="100" cy="72" r="20" fill="url(#wheel_center)" stroke="#78350F" strokeWidth="3" />
          <polygon points="100,12 108,26 92,26" fill="#1E293B" />
          
          {/* Stars */}
          <path d="M25 25 L28 32 L35 33 L30 38 L31 45 L25 41 L19 45 L20 38 L15 33 L22 32 Z" fill="#FEF08A" opacity="0.9" />
          <path d="M175 120 L177 125 L182 126 L178 130 L179 135 L175 132 L171 135 L172 130 L168 126 L173 125 Z" fill="#FEF08A" opacity="0.9" />
        </svg>
      );

    case 'race':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="race_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F43F5E" />
              <stop offset="1" stopColor="#BE123C" />
            </linearGradient>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#race_bg)" />
          {/* Track Road */}
          <path d="M0 110 Q100 70 200 110" stroke="#334155" strokeWidth="32" strokeLinecap="round" />
          <path d="M0 110 Q100 70 200 110" stroke="#F8FAFC" strokeWidth="2" strokeDasharray="6 6" />
          
          {/* Red Race Car */}
          <g transform="translate(45, 65)">
            <rect x="0" y="12" width="48" height="18" rx="8" fill="#E11D48" />
            <path d="M12 12 Q24 2 36 12 Z" fill="#93C5FD" />
            <circle cx="10" cy="30" r="7" fill="#0F172A" />
            <circle cx="10" cy="30" r="3" fill="#94A3B8" />
            <circle cx="38" cy="30" r="7" fill="#0F172A" />
            <circle cx="38" cy="30" r="3" fill="#94A3B8" />
            <text x="20" y="24" fontSize="10" fontWeight="bold" fill="#FFF">1</text>
          </g>

          {/* Yellow Race Car */}
          <g transform="translate(115, 75)">
            <rect x="0" y="12" width="48" height="18" rx="8" fill="#F59E0B" />
            <path d="M12 12 Q24 2 36 12 Z" fill="#93C5FD" />
            <circle cx="10" cy="30" r="7" fill="#0F172A" />
            <circle cx="10" cy="30" r="3" fill="#94A3B8" />
            <circle cx="38" cy="30" r="7" fill="#0F172A" />
            <circle cx="38" cy="30" r="3" fill="#94A3B8" />
            <text x="20" y="24" fontSize="10" fontWeight="bold" fill="#FFF">2</text>
          </g>

          {/* Checkered Flag */}
          <g transform="translate(160, 20)">
            <line x1="10" y1="0" x2="10" y2="40" stroke="#FFF" strokeWidth="3" />
            <rect x="10" y="0" width="10" height="8" fill="#FFF" />
            <rect x="20" y="0" width="10" height="8" fill="#000" />
            <rect x="10" y="8" width="10" height="8" fill="#000" />
            <rect x="20" y="8" width="10" height="8" fill="#FFF" />
          </g>
        </svg>
      );

    case 'memory':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="mem_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10B981" />
              <stop offset="1" stopColor="#047857" />
            </linearGradient>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#mem_bg)" />
          
          {/* Card 1 */}
          <g transform="translate(25, 30)">
            <rect width="65" height="90" rx="10" fill="#FFFFFF" stroke="#6EE7B7" strokeWidth="3" />
            <circle cx="32.5" cy="45" r="20" fill="#ECFDF5" />
            <text x="32.5" y="52" textAnchor="middle" fontSize="22">🍎</text>
            <text x="32.5" y="80" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#047857">Apfel</text>
          </g>

          {/* Card 2 (Flipped Back) */}
          <g transform="translate(108, 30)">
            <rect width="65" height="90" rx="10" fill="#3B82F6" stroke="#93C5FD" strokeWidth="3" />
            <circle cx="32.5" cy="45" r="18" fill="#1D4ED8" />
            <text x="32.5" y="52" textAnchor="middle" fontSize="20" fill="#93C5FD">⭐</text>
          </g>
        </svg>
      );

    case 'sorting':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sort_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3B82F6" />
              <stop offset="1" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#sort_bg)" />
          
          {/* 3 Bins: der, die, das */}
          {/* Der Bin */}
          <g transform="translate(18, 70)">
            <rect width="48" height="55" rx="8" fill="#60A5FA" stroke="#DBEAFE" strokeWidth="2" />
            <text x="24" y="32" textAnchor="middle" fontSize="12" fontWeight="black" fill="#FFF">der</text>
          </g>

          {/* Die Bin */}
          <g transform="translate(76, 70)">
            <rect width="48" height="55" rx="8" fill="#F472B6" stroke="#FCE7F3" strokeWidth="2" />
            <text x="24" y="32" textAnchor="middle" fontSize="12" fontWeight="black" fill="#FFF">die</text>
          </g>

          {/* Das Bin */}
          <g transform="translate(134, 70)">
            <rect width="48" height="55" rx="8" fill="#34D399" stroke="#D1FAE5" strokeWidth="2" />
            <text x="24" y="32" textAnchor="middle" fontSize="12" fontWeight="black" fill="#FFF">das</text>
          </g>

          {/* Flying Object */}
          <g transform="translate(85, 18)">
            <rect width="32" height="32" rx="8" fill="#FFF" stroke="#F59E0B" strokeWidth="2" />
            <text x="16" y="22" textAnchor="middle" fontSize="18">🐱</text>
          </g>
        </svg>
      );

    case 'classroom':
    case 'jeopardy':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="jeop_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#5B21B6" />
            </linearGradient>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#jeop_bg)" />
          
          {/* Grid of Jeopardy tiles */}
          <g transform="translate(20, 20)">
            {/* Header row */}
            <rect x="0" y="0" width="48" height="22" rx="4" fill="#C4B5FD" />
            <rect x="56" y="0" width="48" height="22" rx="4" fill="#C4B5FD" />
            <rect x="112" y="0" width="48" height="22" rx="4" fill="#C4B5FD" />

            {/* Row 1 */}
            <rect x="0" y="28" width="48" height="24" rx="4" fill="#7C3AED" stroke="#DDD6FE" strokeWidth="1" />
            <text x="24" y="44" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FDE047">100</text>

            <rect x="56" y="28" width="48" height="24" rx="4" fill="#7C3AED" stroke="#DDD6FE" strokeWidth="1" />
            <text x="80" y="44" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FDE047">100</text>

            <rect x="112" y="28" width="48" height="24" rx="4" fill="#7C3AED" stroke="#DDD6FE" strokeWidth="1" />
            <text x="136" y="44" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FDE047">100</text>

            {/* Row 2 */}
            <rect x="0" y="58" width="48" height="24" rx="4" fill="#7C3AED" stroke="#DDD6FE" strokeWidth="1" />
            <text x="24" y="74" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FDE047">200</text>

            <rect x="56" y="58" width="48" height="24" rx="4" fill="#F59E0B" stroke="#FEF08A" strokeWidth="1.5" />
            <text x="80" y="74" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#FFF">🏆</text>

            <rect x="112" y="58" width="48" height="24" rx="4" fill="#7C3AED" stroke="#DDD6FE" strokeWidth="1" />
            <text x="136" y="74" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FDE047">200</text>
          </g>
        </svg>
      );

    case 'balloon_pop':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ball_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#0284C7" />
            </linearGradient>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#ball_bg)" />
          
          {/* Red Balloon */}
          <g transform="translate(45, 30)">
            <ellipse cx="25" cy="30" rx="22" ry="26" fill="#EF4444" />
            <ellipse cx="18" cy="20" rx="6" ry="10" fill="#FFF" opacity="0.4" />
            <polygon points="25,56 21,62 29,62" fill="#DC2626" />
            <path d="M25 62 Q20 80 28 95" stroke="#FFF" strokeWidth="1.5" fill="none" />
          </g>

          {/* Yellow Balloon */}
          <g transform="translate(110, 15)">
            <ellipse cx="25" cy="30" rx="22" ry="26" fill="#F59E0B" />
            <ellipse cx="18" cy="20" rx="6" ry="10" fill="#FFF" opacity="0.4" />
            <polygon points="25,56 21,62 29,62" fill="#D97706" />
            <path d="M25 62 Q30 80 22 95" stroke="#FFF" strokeWidth="1.5" fill="none" />
          </g>
        </svg>
      );

    case 'basket_catch':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bask_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10B981" />
              <stop offset="1" stopColor="#059669" />
            </linearGradient>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#bask_bg)" />
          
          {/* Falling items */}
          <text x="60" y="45" fontSize="24">🍌</text>
          <text x="130" y="30" fontSize="24">🍎</text>

          {/* Wooden Basket */}
          <g transform="translate(50, 85)">
            <path d="M10 0 L90 0 L80 45 L20 45 Z" fill="#B45309" stroke="#78350F" strokeWidth="3" />
            <line x1="25" y1="0" x2="30" y2="45" stroke="#78350F" strokeWidth="2" />
            <line x1="50" y1="0" x2="50" y2="45" stroke="#78350F" strokeWidth="2" />
            <line x1="75" y1="0" x2="70" y2="45" stroke="#78350F" strokeWidth="2" />
            <line x1="12" y1="20" x2="88" y2="20" stroke="#78350F" strokeWidth="2" />
          </g>
        </svg>
      );

    case 'robot_repair':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bot_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366F1" />
              <stop offset="1" stopColor="#4338CA" />
            </linearGradient>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#bot_bg)" />
          
          {/* Robot */}
          <g transform="translate(70, 25)">
            {/* Head */}
            <rect x="15" y="10" width="30" height="25" rx="6" fill="#94A3B8" stroke="#334155" strokeWidth="2" />
            <circle cx="22" cy="22" r="4" fill="#38BDF8" />
            <circle cx="38" cy="22" r="4" fill="#38BDF8" />
            <line x1="30" y1="0" x2="30" y2="10" stroke="#CBD5E1" strokeWidth="3" />
            <circle cx="30" cy="0" r="3" fill="#EF4444" />
            
            {/* Body */}
            <rect x="5" y="38" width="50" height="45" rx="8" fill="#CBD5E1" stroke="#334155" strokeWidth="2" />
            <rect x="15" y="48" width="30" height="25" rx="4" fill="#1E293B" />
            <text x="30" y="65" textAnchor="middle" fontSize="12" fill="#4ADE80">⚙️</text>
          </g>
        </svg>
      );

    case 'word_ninja':
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="nin_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0F172A" />
              <stop offset="1" stopColor="#334155" />
            </linearGradient>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#nin_bg)" />
          
          {/* Slice Trail */}
          <path d="M20 130 Q100 20 180 40" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
          <path d="M20 130 Q100 20 180 40" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />

          {/* Sliced Word Tile */}
          <g transform="translate(70, 40)">
            <rect width="30" height="30" rx="6" fill="#E11D48" />
            <text x="15" y="20" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#FFF">H</text>
          </g>
          <g transform="translate(105, 55)">
            <rect width="30" height="30" rx="6" fill="#E11D48" />
            <text x="15" y="20" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#FFF">allo</text>
          </g>
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="def_bg" x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366F1" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <rect width="200" height="150" rx="16" fill="url(#def_bg)" />
          <circle cx="100" cy="75" r="40" fill="#FFFFFF" opacity="0.15" />
          <text x="100" y="85" textAnchor="middle" fontSize="36">🎮</text>
        </svg>
      );
  }
};
