import React, { useState } from 'react';
import { NANO_BANANA_GAME_ART_MANIFEST } from '../../data/nanoBananaGameArtManifest';
import { GameSettingsControls } from './effects/GameEffectsOverlay';

export interface GameIllustrationProps {
  gameId: string;
  className?: string;
}

/**
 * Shared 3D Cartoon Trophy & Chest Reward Artwork Components
 * Bundled locally at /assets/games/shared_victory_trophy.webp & shared_mystery_chest.webp
 */
export const SharedVictoryTrophyArt: React.FC<{ className?: string }> = ({ className = 'w-24 h-24' }) => {
  const [imgError, setImgError] = useState(false);
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {!imgError ? (
        <img
          src="/assets/games/shared_victory_trophy.webp"
          alt="Golden Victory Trophy"
          onError={() => setImgError(true)}
          className="w-full h-full object-contain rounded-2xl drop-shadow-[0_8px_16px_rgba(245,158,11,0.45)]"
        />
      ) : (
        <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-lg" fill="none">
          <defs>
            <linearGradient id="trophy_g" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FEF08A" />
              <stop offset="0.5" stopColor="#F59E0B" />
              <stop offset="1" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <rect x="35" y="92" width="50" height="14" rx="5" fill="#475569" />
          <rect x="42" y="82" width="36" height="10" rx="4" fill="url(#trophy_g)" />
          <path d="M54 64 L66 64 L68 82 L52 82 Z" fill="url(#trophy_g)" />
          <path d="M32 24 H88 C92 54 78 68 60 68 C42 68 28 54 32 24 Z" fill="url(#trophy_g)" stroke="#FEF08A" strokeWidth="3" />
          <polygon points="60,32 64,41 74,42 67,49 69,58 60,53 51,58 53,49 46,42 56,41" fill="#FFFFFF" />
        </svg>
      )}
    </div>
  );
};

export const SharedMysteryChestArt: React.FC<{ className?: string }> = ({ className = 'w-20 h-20' }) => {
  const [imgError, setImgError] = useState(false);
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {!imgError ? (
        <img
          src="/assets/games/shared_mystery_chest.webp"
          alt="Magical Reward Chest"
          onError={() => setImgError(true)}
          className="w-full h-full object-contain rounded-2xl drop-shadow-[0_8px_16px_rgba(168,85,247,0.45)]"
        />
      ) : (
        <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-lg" fill="none">
          <rect x="24" y="52" width="72" height="46" rx="8" fill="#B45309" stroke="#FBBF24" strokeWidth="4" />
          <path d="M22 52 Q60 24 98 52 Z" fill="#D97706" stroke="#FBBF24" strokeWidth="4" />
          <rect x="52" y="45" width="16" height="22" rx="4" fill="#FDE047" />
        </svg>
      )}
    </div>
  );
};

/**
 * Normalize legacy or alternate game IDs to their canonical manifest key
 */
function resolveCanonicalGameId(gameId: string): string {
  if (gameId === 'tic_tac_toe') return 'tictactoe';
  return gameId;
}

/**
 * Multi-layered 3D-shaded SVG Fallback Renderer for all 34 games
 * Used immediately while or if a raster image is not yet loaded.
 */
const GameVectorFallbackArt: React.FC<{ gameId: string; className?: string }> = ({ gameId, className = 'w-full h-full' }) => {
  const canonicalId = resolveCanonicalGameId(gameId);
  const spec = NANO_BANANA_GAME_ART_MANIFEST[canonicalId];
  const topColor = spec?.palette.topColor || '#312E81';
  const midColor = spec?.palette.midColor || '#4F46E5';
  const bottomColor = spec?.palette.bottomColor || '#1E1B4B';
  const accentColor = spec?.palette.accentColor || '#F59E0B';
  const glowColor = spec?.palette.glowColor || '#818CF8';

  const renderGameMotif = () => {
    switch (canonicalId) {
      case 'classroom':
        return (
          <g>
            <path d="M0 0 L35 0 Q28 75 16 150 L0 150 Z" fill="#E11D48" />
            <path d="M200 0 L165 0 Q172 75 184 150 L200 150 Z" fill="#E11D48" />
            <rect x="46" y="20" width="108" height="68" rx="10" fill="#0F172A" stroke="#FBBF24" strokeWidth="3" />
            <rect x="54" y="28" width="28" height="22" rx="4" fill="#38BDF8" />
            <rect x="86" y="28" width="28" height="22" rx="4" fill="#F59E0B" />
            <rect x="118" y="28" width="28" height="22" rx="4" fill="#10B981" />
            <rect x="54" y="56" width="28" height="22" rx="4" fill="#F43F5E" />
            <rect x="86" y="56" width="28" height="22" rx="4" fill="#A855F7" />
            <rect x="118" y="56" width="28" height="22" rx="4" fill="#EC4899" />
            <rect x="45" y="102" width="32" height="36" rx="6" fill="#3B82F6" />
            <rect x="84" y="96" width="32" height="42" rx="6" fill="#F59E0B" />
            <rect x="123" y="102" width="32" height="36" rx="6" fill="#EF4444" />
          </g>
        );
      case 'tug_of_war':
        return (
          <g>
            <ellipse cx="100" cy="115" rx="85" ry="22" fill="#059669" />
            <line x1="20" y1="82" x2="180" y2="82" stroke="#D97706" strokeWidth="7" strokeLinecap="round" />
            <polygon points="100,66 110,82 100,98 90,82" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
            <circle cx="48" cy="78" r="18" fill="#EF4444" stroke="#FFF" strokeWidth="2.5" />
            <circle cx="152" cy="78" r="18" fill="#3B82F6" stroke="#FFF" strokeWidth="2.5" />
          </g>
        );
      case 'wheel':
        return (
          <g>
            <circle cx="100" cy="75" r="48" fill="#1E293B" stroke="#FBBF24" strokeWidth="4" />
            <path d="M100 75 L100 30 A45 45 0 0 1 145 75 Z" fill="#EF4444" />
            <path d="M100 75 L145 75 A45 45 0 0 1 100 120 Z" fill="#3B82F6" />
            <path d="M100 75 L100 120 A45 45 0 0 1 55 75 Z" fill="#10B981" />
            <path d="M100 75 L55 75 A45 45 0 0 1 100 30 Z" fill="#F59E0B" />
            <circle cx="100" cy="75" r="14" fill="#FEF08A" stroke="#78350F" strokeWidth="3" />
            <polygon points="100,18 107,32 93,32" fill="#EF4444" stroke="#FFF" strokeWidth="1.5" />
          </g>
        );
      case 'race':
      case 'pit_stop':
        return (
          <g>
            <path d="M0 105 Q100 72 200 105 L200 150 L0 150 Z" fill="#334155" />
            <path d="M0 118 Q100 85 200 118" stroke="#FACC15" strokeWidth="2.5" strokeDasharray="8 6" />
            <g transform="translate(38, 68)">
              <rect x="0" y="12" width="52" height="18" rx="9" fill="#EF4444" stroke="#FFF" strokeWidth="1.5" />
              <path d="M12 12 Q26 0 40 12 Z" fill="#BAE6FD" />
              <circle cx="12" cy="30" r="8" fill="#0F172A" stroke="#CBD5E1" strokeWidth="2" />
              <circle cx="40" cy="30" r="8" fill="#0F172A" stroke="#CBD5E1" strokeWidth="2" />
            </g>
            <g transform="translate(110, 74)">
              <rect x="0" y="12" width="52" height="18" rx="9" fill="#3B82F6" stroke="#FFF" strokeWidth="1.5" />
              <path d="M12 12 Q26 0 40 12 Z" fill="#FEF08A" />
              <circle cx="12" cy="30" r="8" fill="#0F172A" stroke="#CBD5E1" strokeWidth="2" />
              <circle cx="40" cy="30" r="8" fill="#0F172A" stroke="#CBD5E1" strokeWidth="2" />
            </g>
          </g>
        );
      case 'team_auction':
        return (
          <g>
            <rect x="65" y="78" width="70" height="55" rx="8" fill="#92400E" stroke="#FBBF24" strokeWidth="3" />
            <g transform="translate(85, 28) rotate(-25)">
              <rect x="0" y="0" width="38" height="18" rx="5" fill="#FBBF24" stroke="#FFF" strokeWidth="1.5" />
              <rect x="15" y="18" width="8" height="36" rx="3" fill="#B45309" />
            </g>
            <circle cx="45" cy="112" r="12" fill="#FBBF24" stroke="#FEF08A" strokeWidth="2" />
            <circle cx="155" cy="112" r="12" fill="#FBBF24" stroke="#FEF08A" strokeWidth="2" />
          </g>
        );
      case 'space_fleet':
      case 'space_defense':
        return (
          <g>
            <circle cx="158" cy="40" r="18" fill="#A855F7" opacity="0.85" />
            <ellipse cx="158" cy="40" rx="30" ry="7" stroke="#E9D5FF" strokeWidth="2.5" fill="none" transform="rotate(-18 158 40)" />
            <polygon points="100,32 126,88 100,76 74,88" fill="#38BDF8" stroke="#FFF" strokeWidth="2" />
            <circle cx="100" cy="62" r="7" fill="#FEF08A" />
            <polygon points="100,82 90,106 100,98 110,106" fill="#F97316" />
          </g>
        );
      case 'rocket_countdown':
        return (
          <g>
            <rect x="55" y="38" width="12" height="86" rx="3" fill="#64748B" />
            <path d="M105 22 C122 44 124 78 124 102 L86 102 C86 78 88 44 105 22 Z" fill="#F8FAFC" stroke="#EF4444" strokeWidth="2.5" />
            <circle cx="105" cy="64" r="9" fill="#38BDF8" stroke="#1E293B" strokeWidth="2" />
            <polygon points="105,102 92,132 105,122 118,132" fill="#F59E0B" />
          </g>
        );
      case 'tower_architects':
        return (
          <g>
            <rect x="36" y="24" width="8" height="108" fill="#FBBF24" />
            <rect x="30" y="24" width="95" height="8" rx="3" fill="#FBBF24" />
            <rect x="72" y="96" width="66" height="26" rx="5" fill="#EF4444" stroke="#FFF" strokeWidth="1.5" />
            <rect x="78" y="68" width="54" height="26" rx="5" fill="#3B82F6" stroke="#FFF" strokeWidth="1.5" />
            <rect x="84" y="40" width="42" height="26" rx="5" fill="#10B981" stroke="#FFF" strokeWidth="1.5" />
          </g>
        );
      case 'tictactoe':
        return (
          <g>
            <rect x="52" y="22" width="96" height="96" rx="12" fill="#1E1B4B" stroke="#FBBF24" strokeWidth="3" />
            <line x1="84" y1="30" x2="84" y2="110" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" />
            <line x1="116" y1="30" x2="116" y2="110" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" />
            <line x1="60" y1="54" x2="140" y2="54" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" />
            <line x1="60" y1="86" x2="140" y2="86" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="70" r="9" stroke="#38BDF8" strokeWidth="4" fill="none" />
            <path d="M64 34 L76 46 M76 34 L64 46" stroke="#F43F5E" strokeWidth="4" strokeLinecap="round" />
            <path d="M124 94 L136 106 M136 94 L124 106" stroke="#F43F5E" strokeWidth="4" strokeLinecap="round" />
          </g>
        );
      case 'ultimate_tictactoe':
        return (
          <g>
            <rect x="44" y="16" width="112" height="112" rx="14" fill="#1E1B4B" stroke="#FBBF24" strokeWidth="3.5" />
            {/* Macro 3x3 lines */}
            <line x1="81" y1="22" x2="81" y2="122" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="119" y1="22" x2="119" y2="122" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="50" y1="53" x2="150" y2="53" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="50" y1="91" x2="150" y2="91" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            {/* Glowing active center mini-board */}
            <rect x="84" y="56" width="32" height="32" rx="5" fill="#F59E0B" fillOpacity="0.22" stroke="#FDE047" strokeWidth="2" />
            <line x1="95" y1="59" x2="95" y2="85" stroke="#FDE047" strokeWidth="1" />
            <line x1="105" y1="59" x2="105" y2="85" stroke="#FDE047" strokeWidth="1" />
            <line x1="87" y1="67" x2="113" y2="67" stroke="#FDE047" strokeWidth="1" />
            <line x1="87" y1="77" x2="113" y2="77" stroke="#FDE047" strokeWidth="1" />
            {/* Conquered Top-Left X Sub-board */}
            <rect x="49" y="21" width="29" height="29" rx="5" fill="#F43F5E" fillOpacity="0.25" />
            <path d="M56 28 L71 43 M71 28 L56 43" stroke="#F43F5E" strokeWidth="4" strokeLinecap="round" />
            {/* Conquered Top-Right O Sub-board */}
            <rect x="122" y="21" width="29" height="29" rx="5" fill="#38BDF8" fillOpacity="0.25" />
            <circle cx="136.5" cy="35.5" r="8.5" stroke="#38BDF8" strokeWidth="4" fill="none" />
            {/* Conquered Bottom-Right X Sub-board */}
            <rect x="122" y="94" width="29" height="29" rx="5" fill="#F43F5E" fillOpacity="0.25" />
            <path d="M129 101 L144 116 M144 101 L129 116" stroke="#F43F5E" strokeWidth="4" strokeLinecap="round" />
            {/* Conquered Bottom-Left O Sub-board */}
            <rect x="49" y="94" width="29" height="29" rx="5" fill="#38BDF8" fillOpacity="0.25" />
            <circle cx="63.5" cy="108.5" r="8.5" stroke="#38BDF8" strokeWidth="4" fill="none" />
          </g>
        );
      case 'sentence_builder':
      case 'solo_sentence':
        return (
          <g>
            <rect x="34" y="34" width="132" height="76" rx="12" fill="#0F172A" stroke="#FBBF24" strokeWidth="3" />
            <rect x="46" y="56" width="32" height="26" rx="6" fill="#3B82F6" />
            <rect x="84" y="56" width="32" height="26" rx="6" fill="#F59E0B" />
            <rect x="122" y="56" width="32" height="26" rx="6" fill="#10B981" />
          </g>
        );
      case 'bridge_builder':
        return (
          <g>
            <path d="M0 80 L48 80 L56 150 L0 150 Z" fill="#10B981" />
            <path d="M200 80 L152 80 L144 150 L200 150 Z" fill="#10B981" />
            <path d="M44 52 Q100 84 156 52" stroke="#D97706" strokeWidth="3" fill="none" />
            <rect x="56" y="80" width="24" height="10" rx="3" fill="#F59E0B" />
            <rect x="88" y="82" width="24" height="10" rx="3" fill="#F59E0B" />
            <rect x="120" y="80" width="24" height="10" rx="3" fill="#F59E0B" />
          </g>
        );
      case 'island_crossing':
        return (
          <g>
            <ellipse cx="52" cy="102" rx="28" ry="12" fill="#FBBF24" />
            <ellipse cx="100" cy="86" rx="32" ry="14" fill="#FBBF24" />
            <ellipse cx="148" cy="102" rx="28" ry="12" fill="#FBBF24" />
            <path d="M100 82 Q106 52 96 34" stroke="#92400E" strokeWidth="5" strokeLinecap="round" fill="none" />
            <ellipse cx="84" cy="34" rx="16" ry="6" fill="#10B981" />
            <ellipse cx="110" cy="34" rx="16" ry="6" fill="#10B981" />
          </g>
        );
      case 'submarine_explore':
        return (
          <g>
            <path d="M105 46 L105 28 L120 28" stroke="#FBBF24" strokeWidth="5" strokeLinecap="round" fill="none" />
            <rect x="54" y="46" width="88" height="44" rx="22" fill="#FACC15" stroke="#FEF08A" strokeWidth="2.5" />
            <circle cx="80" cy="68" r="10" fill="#38BDF8" stroke="#FFF" strokeWidth="2.5" />
            <circle cx="110" cy="68" r="10" fill="#38BDF8" stroke="#FFF" strokeWidth="2.5" />
          </g>
        );
      case 'robot_repair':
        return (
          <g>
            <rect x="74" y="28" width="52" height="38" rx="10" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2.5" />
            <circle cx="90" cy="46" r="5" fill="#38BDF8" />
            <circle cx="110" cy="46" r="5" fill="#38BDF8" />
            <rect x="66" y="70" width="68" height="52" rx="12" fill="#3B82F6" stroke="#BAE6FD" strokeWidth="2.5" />
            <circle cx="100" cy="96" r="12" fill="#FBBF24" />
          </g>
        );
      case 'color_master':
        return (
          <g>
            <ellipse cx="100" cy="78" rx="58" ry="40" fill="#D97706" stroke="#FEF08A" strokeWidth="3" />
            <circle cx="72" cy="66" r="9" fill="#EF4444" />
            <circle cx="96" cy="54" r="9" fill="#3B82F6" />
            <circle cx="122" cy="64" r="9" fill="#10B981" />
            <circle cx="128" cy="86" r="9" fill="#FACC15" />
          </g>
        );
      case 'factory_machine':
        return (
          <g>
            <rect x="30" y="96" width="140" height="22" rx="11" fill="#334155" stroke="#94A3B8" strokeWidth="2.5" />
            <rect x="54" y="50" width="38" height="38" rx="6" fill="#D97706" stroke="#FEF08A" strokeWidth="2" />
            <rect x="108" y="50" width="38" height="38" rx="6" fill="#3B82F6" stroke="#BAE6FD" strokeWidth="2" />
          </g>
        );
      case 'puzzle_masters':
        return (
          <g>
            <rect x="60" y="34" width="38" height="38" rx="6" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
            <rect x="102" y="34" width="38" height="38" rx="6" fill="#3B82F6" stroke="#FFF" strokeWidth="2" />
            <rect x="60" y="76" width="38" height="38" rx="6" fill="#F59E0B" stroke="#FFF" strokeWidth="2" />
            <rect x="102" y="76" width="38" height="38" rx="6" fill="#10B981" stroke="#FFF" strokeWidth="2" />
          </g>
        );
      case 'target_attack':
        return (
          <g>
            <circle cx="100" cy="75" r="44" fill="#FFFFFF" stroke="#EF4444" strokeWidth="9" />
            <circle cx="100" cy="75" r="26" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="6" />
            <circle cx="100" cy="75" r="11" fill="#FACC15" />
          </g>
        );
      case 'vending_machine':
        return (
          <g>
            <rect x="68" y="20" width="64" height="110" rx="10" fill="#E11D48" stroke="#FFF" strokeWidth="2.5" />
            <rect x="76" y="30" width="48" height="56" rx="6" fill="#0F172A" />
            <circle cx="90" cy="46" r="7" fill="#FACC15" />
            <circle cx="110" cy="46" r="7" fill="#38BDF8" />
            <circle cx="90" cy="68" r="7" fill="#10B981" />
            <circle cx="110" cy="68" r="7" fill="#EC4899" />
          </g>
        );
      case 'whats_in_box':
        return (
          <g>
            <rect x="64" y="54" width="72" height="62" rx="8" fill="#B45309" stroke="#FBBF24" strokeWidth="3" />
            <rect x="58" y="40" width="84" height="18" rx="6" fill="#EF4444" stroke="#FBBF24" strokeWidth="2.5" />
            <circle cx="100" cy="82" r="11" fill="#FDE047" />
          </g>
        );
      case 'word_rhythm':
        return (
          <g>
            <circle cx="100" cy="75" r="38" fill="#0F172A" stroke="#22D3EE" strokeWidth="3" />
            <circle cx="100" cy="75" r="14" fill="#EC4899" />
            <rect x="34" y="65" width="8" height="40" rx="4" fill="#38BDF8" />
            <rect x="46" y="45" width="8" height="60" rx="4" fill="#10B981" />
            <rect x="146" y="45" width="8" height="60" rx="4" fill="#FACC15" />
            <rect x="158" y="65" width="8" height="40" rx="4" fill="#F43F5E" />
          </g>
        );
      case 'word_wash':
        return (
          <g>
            <rect x="66" y="50" width="68" height="48" rx="12" fill="#FACC15" stroke="#FEF08A" strokeWidth="3" />
            <circle cx="48" cy="52" r="14" fill="#E0F2FE" opacity="0.8" stroke="#FFF" strokeWidth="2" />
            <circle cx="152" cy="48" r="16" fill="#E0F2FE" opacity="0.8" stroke="#FFF" strokeWidth="2" />
            <circle cx="144" cy="96" r="11" fill="#E0F2FE" opacity="0.8" stroke="#FFF" strokeWidth="2" />
          </g>
        );
      case 'follow_clues':
      case 'word_detective':
        return (
          <g>
            <rect x="50" y="32" width="100" height="78" rx="10" fill="#FEF3C7" stroke="#B45309" strokeWidth="3" />
            <circle cx="110" cy="68" r="22" fill="#BAE6FD" fillOpacity="0.5" stroke="#F59E0B" strokeWidth="5" />
            <line x1="126" y1="84" x2="146" y2="104" stroke="#78350F" strokeWidth="6" strokeLinecap="round" />
          </g>
        );
      case 'word_ninja':
        return (
          <g>
            <path d="M26 118 Q98 22 174 44" stroke="#38BDF8" strokeWidth="5" strokeLinecap="round" fill="none" />
            <circle cx="76" cy="64" r="18" fill="#E11D48" stroke="#FFF" strokeWidth="2" />
            <circle cx="126" cy="54" r="18" fill="#10B981" stroke="#FFF" strokeWidth="2" />
          </g>
        );
      case 'balloon_pop':
        return (
          <g>
            <ellipse cx="68" cy="62" rx="20" ry="25" fill="#EF4444" />
            <ellipse cx="100" cy="48" rx="20" ry="25" fill="#F59E0B" />
            <ellipse cx="132" cy="62" rx="20" ry="25" fill="#10B981" />
          </g>
        );
      case 'whack_a_mole':
        return (
          <g>
            <ellipse cx="100" cy="110" rx="48" ry="14" fill="#451A03" />
            <path d="M76 108 L76 64 A24 24 0 0 1 124 64 L124 108 Z" fill="#B45309" />
            <path d="M72 64 A28 22 0 0 1 128 64 Z" fill="#FACC15" />
          </g>
        );
      case 'basket_catch':
        return (
          <g>
            <circle cx="72" cy="40" r="12" fill="#EF4444" />
            <circle cx="128" cy="34" r="12" fill="#FACC15" />
            <path d="M55 82 L145 82 L132 124 L68 124 Z" fill="#B45309" stroke="#FDE68A" strokeWidth="2.5" />
          </g>
        );
      case 'sorting':
        return (
          <g>
            <rect x="34" y="62" width="40" height="56" rx="8" fill="#3B82F6" stroke="#DBEAFE" strokeWidth="2" />
            <rect x="80" y="62" width="40" height="56" rx="8" fill="#EC4899" stroke="#FCE7F3" strokeWidth="2" />
            <rect x="126" y="62" width="40" height="56" rx="8" fill="#10B981" stroke="#D1FAE5" strokeWidth="2" />
          </g>
        );
      case 'memory':
        return (
          <g>
            <rect x="46" y="30" width="48" height="72" rx="8" fill="#FFFFFF" stroke="#FBBF24" strokeWidth="2.5" />
            <circle cx="70" cy="66" r="14" fill="#EF4444" />
            <rect x="106" y="30" width="48" height="72" rx="8" fill="#3B82F6" stroke="#FBBF24" strokeWidth="2.5" />
            <polygon points="130,50 134,60 144,61 137,68 139,78 130,73 121,78 123,68 116,61 126,60" fill="#FACC15" />
          </g>
        );
      default:
        return (
          <g>
            <circle cx="100" cy="72" r="36" fill="#3B82F6" stroke="#FBBF24" strokeWidth="3" />
            <polygon points="100,46 107,62 124,64 111,76 114,93 100,84 86,93 89,76 76,64 93,62" fill="#FACC15" />
          </g>
        );
    }
  };

  return (
    <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`grad_${canonicalId}`} x1="0" y1="0" x2="200" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={topColor} />
          <stop offset="55%" stopColor={midColor} />
          <stop offset="100%" stopColor={bottomColor} />
        </linearGradient>
        <radialGradient id={`glow_${canonicalId}`} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor={glowColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={bottomColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="150" rx="16" fill={`url(#grad_${canonicalId})`} />
      <rect width="200" height="150" rx="16" fill={`url(#glow_${canonicalId})`} />
      <path d="M0 112 Q100 94 200 112 L200 150 L0 150 Z" fill="#090D16" opacity="0.35" />
      {renderGameMotif()}
    </svg>
  );
};

/**
 * GameThumbnailArt:
 * Displays the bundled local WebP game illustration (/assets/games/<id>_stage.webp)
 * with automatic fallback to the multi-layered 3D vector scene.
 */
export const GameThumbnailArt: React.FC<GameIllustrationProps> = ({ gameId, className = 'w-full h-full' }) => {
  const canonicalId = resolveCanonicalGameId(gameId);
  const spec = NANO_BANANA_GAME_ART_MANIFEST[canonicalId];
  const localWebpPath = spec?.localStageAssetPath || `/assets/games/${canonicalId}_stage.webp`;
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return <GameVectorFallbackArt gameId={canonicalId} className={className} />;
  }

  return (
    <div className={`relative overflow-hidden select-none ${className}`}>
      <img
        src={localWebpPath}
        alt={spec?.titleEn || canonicalId}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10 pointer-events-none" />
    </div>
  );
};

/**
 * GameStageBanner:
 * Reusable 3D Cartoon Arena Backdrop & HUD Banner for inside the actual games.
 * Displays the game's custom stage illustration as a lush atmospheric banner,
 * paired with the title, live counters, and global Audio/Animation settings.
 */
export interface GameStageBannerProps {
  gameId: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  onBack?: () => void;
  backLabel?: string;
  isRtl?: boolean;
  rightContent?: React.ReactNode;
}

export const GameStageBanner: React.FC<GameStageBannerProps> = ({
  gameId,
  title,
  subtitle,
  emoji,
  onBack,
  backLabel = 'عودة',
  isRtl = true,
  rightContent
}) => {
  const canonicalId = resolveCanonicalGameId(gameId);
  const spec = NANO_BANANA_GAME_ART_MANIFEST[canonicalId];

  return (
    <div
      className="relative rounded-3xl overflow-hidden border border-white/15 shadow-lg select-none"
      style={{
        background: `linear-gradient(135deg, ${spec?.palette.topColor || '#1E1B4B'}, ${spec?.palette.midColor || '#312E81'}, ${spec?.palette.bottomColor || '#0F172A'})`
      }}
    >
      {/* Background Bundled 3D Cartoon Stage Artwork */}
      <div className="absolute inset-0 opacity-35 pointer-events-none">
        <GameThumbnailArt gameId={canonicalId} className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-slate-950/85 pointer-events-none" />

      {/* Foreground HUD Content */}
      <div className="relative z-10 p-3.5 sm:p-4 flex items-center justify-between gap-3 flex-wrap text-white">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 backdrop-blur-md shrink-0"
            >
              <span>{isRtl ? '➔' : '⬅'}</span>
              <span>{backLabel}</span>
            </button>
          )}

          {/* Mini 3D Stage Preview Badge */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border-2 border-white/25 shadow-md shrink-0 relative bg-slate-900">
            <GameThumbnailArt gameId={canonicalId} className="w-full h-full object-cover" />
            {emoji && (
              <span className="absolute -bottom-1 -right-1 text-base drop-shadow-md">
                {emoji}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-black text-white truncate drop-shadow-xs">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-[11px] sm:text-xs font-bold text-white/75 truncate">
                {subtitle}
              </p>
            ) : spec ? (
              <p className="text-[11px] font-bold text-amber-300/90 truncate">
                {isRtl ? spec.titleAr : spec.titleDe} • {spec.titleDe}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {rightContent}
          <GameSettingsControls />
        </div>
      </div>
    </div>
  );
};
