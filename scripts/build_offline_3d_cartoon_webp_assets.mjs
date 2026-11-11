/**
 * Local Offline 3D-Stylized Cartoon WebP Asset Builder (Sharp Rasterizer)
 * -----------------------------------------------------------------------
 * Renders rich, multi-layered 3D-shaded cartoon game illustrations (with
 * specular highlights, ambient occlusion shadows, atmospheric depth, and
 * custom game-specific props/scenery, zero text baked in) into optimized
 * .webp raster files in /public/assets/games/*.webp for 100% offline
 * Android Capacitor & Electron bundling.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.resolve(process.cwd(), 'public/assets/games');

function build3DCartoonSceneSvg(id, topColor, midColor, bottomColor, accentColor, glowColor, motifSvg, width = 800, height = 450) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg_${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${topColor}" />
        <stop offset="55%" stop-color="${midColor}" />
        <stop offset="100%" stop-color="${bottomColor}" />
      </linearGradient>
      <radialGradient id="glow_${id}" cx="50%" cy="42%" r="48%">
        <stop offset="0%" stop-color="${glowColor}" stop-opacity="0.55" />
        <stop offset="60%" stop-color="${accentColor}" stop-opacity="0.18" />
        <stop offset="100%" stop-color="${bottomColor}" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="stage_floor_${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bottomColor}" stop-opacity="0.7" />
        <stop offset="100%" stop-color="#090D16" stop-opacity="0.95" />
      </linearGradient>
      <linearGradient id="gold_3d" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FEF08A" />
        <stop offset="45%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#B45309" />
      </linearGradient>
      <linearGradient id="red_3d" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FDA4AF" />
        <stop offset="35%" stop-color="#F43F5E" />
        <stop offset="100%" stop-color="#9F1239" />
      </linearGradient>
      <linearGradient id="blue_3d" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#BAE6FD" />
        <stop offset="35%" stop-color="#0EA5E9" />
        <stop offset="100%" stop-color="#1E3A8A" />
      </linearGradient>
      <linearGradient id="green_3d" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#A7F3D0" />
        <stop offset="35%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#065F46" />
      </linearGradient>
      <linearGradient id="wood_3d" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FDE68A" />
        <stop offset="30%" stop-color="#D97706" />
        <stop offset="100%" stop-color="#78350F" />
      </linearGradient>
      <filter id="shadow3d" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000000" flood-opacity="0.45" />
      </filter>
      <filter id="softglow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="14" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Sky / Backdrop Gradient -->
    <rect width="${width}" height="${height}" fill="url(#bg_${id})" />
    <rect width="${width}" height="${height}" fill="url(#glow_${id})" />

    <!-- Studio Volumetric Light Beams -->
    <polygon points="120,0 260,0 420,${height} 40,${height}" fill="#FFFFFF" opacity="0.06" />
    <polygon points="${width - 120},0 ${width - 260},0 ${width - 420},${height} ${width - 40},${height}" fill="#FFFFFF" opacity="0.06" />

    <!-- Distant 3D Rounded Hills / Horizon Scenery -->
    <path d="M0 ${height * 0.68} Q${width * 0.25} ${height * 0.54} ${width * 0.52} ${height * 0.66} T${width} ${height * 0.64} L${width} ${height} L0 ${height} Z" fill="${bottomColor}" opacity="0.55" />
    <path d="M0 ${height * 0.75} Q${width * 0.5} ${height * 0.65} ${width} ${height * 0.75} L${width} ${height} L0 ${height} Z" fill="url(#stage_floor_${id})" />

    <!-- Ambient Sparkle Orbs -->
    <circle cx="95" cy="80" r="6" fill="#FEF08A" opacity="0.8" />
    <circle cx="${width - 110}" cy="70" r="8" fill="#FEF08A" opacity="0.7" />
    <circle cx="${width - 180}" cy="135" r="4" fill="#FFFFFF" opacity="0.6" />
    <circle cx="175" cy="145" r="5" fill="#FFFFFF" opacity="0.5" />

    <!-- Game-Specific 3D Cartoon Motif -->
    <g filter="url(#shadow3d)">
      ${motifSvg}
    </g>

    <!-- Glossy Top Rim Highlight -->
    <rect x="12" y="10" width="${width - 24}" height="18" rx="9" fill="#FFFFFF" opacity="0.08" />
  </svg>`;
}

const SCENES = [
  {
    file: 'shared_victory_trophy.webp',
    width: 512,
    height: 512,
    top: '#451A03', mid: '#78350F', bottom: '#1E1B4B', accent: '#FEF08A', glow: '#F59E0B',
    motif: `
      <ellipse cx="256" cy="420" rx="130" ry="26" fill="#000" opacity="0.4"/>
      <rect x="176" y="365" width="160" height="45" rx="14" fill="#475569" stroke="#94A3B8" stroke-width="4"/>
      <rect x="196" y="340" width="120" height="30" rx="10" fill="url(#gold_3d)"/>
      <path d="M236 280 L276 280 L286 345 L226 345 Z" fill="url(#gold_3d)"/>
      <path d="M160 120 C110 120 110 230 185 245 C195 270 220 285 256 285 C292 285 317 270 327 245 C402 230 402 120 352 120 Z" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="5"/>
      <path d="M166 115 L346 115 C356 185 326 275 256 285 C186 275 156 185 166 115 Z" fill="url(#gold_3d)"/>
      <ellipse cx="220" cy="175" rx="18" ry="42" fill="#FFFFFF" opacity="0.45" transform="rotate(-12 220 175)"/>
      <polygon points="256,145 270,175 303,180 279,203 285,235 256,220 227,235 233,203 209,180 242,175" fill="#FFFFFF" opacity="0.9"/>
    `
  },
  {
    file: 'shared_mystery_chest.webp',
    width: 512,
    height: 512,
    top: '#3B0764', mid: '#581C87', bottom: '#1E1B4B', accent: '#FDE047', glow: '#A855F7',
    motif: `
      <ellipse cx="256" cy="410" rx="145" ry="28" fill="#000" opacity="0.45"/>
      <rect x="126" y="230" width="260" height="160" rx="22" fill="url(#wood_3d)" stroke="#F59E0B" stroke-width="8"/>
      <path d="M120 230 Q256 135 392 230 Z" fill="url(#wood_3d)" stroke="#F59E0B" stroke-width="8"/>
      <rect x="126" y="222" width="260" height="22" rx="8" fill="url(#gold_3d)"/>
      <rect x="230" y="205" width="52" height="68" rx="14" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="4"/>
      <circle cx="256" cy="238" r="9" fill="#451A03"/>
      <polygon points="256,95 268,125 300,130 275,152 282,184 256,168 230,184 237,152 212,130 244,125" fill="#FEF08A"/>
    `
  },
  {
    file: 'classroom_stage.webp',
    top: '#312E81', mid: '#4338CA', bottom: '#1E1B4B', accent: '#F59E0B', glow: '#818CF8',
    motif: `
      <!-- Curtains & Quiz Podiums -->
      <path d="M0 0 L130 0 Q110 220 65 450 L0 450 Z" fill="url(#red_3d)"/>
      <path d="M800 0 L670 0 Q690 220 735 450 L800 450 Z" fill="url(#red_3d)"/>
      <rect x="210" y="75" width="380" height="210" rx="28" fill="#0F172A" stroke="url(#gold_3d)" stroke-width="8"/>
      <rect x="235" y="98" width="102" height="72" rx="14" fill="url(#blue_3d)"/>
      <rect x="349" y="98" width="102" height="72" rx="14" fill="url(#gold_3d)"/>
      <rect x="463" y="98" width="102" height="72" rx="14" fill="url(#green_3d)"/>
      <rect x="235" y="184" width="102" height="72" rx="14" fill="url(#red_3d)"/>
      <rect x="349" y="184" width="102" height="72" rx="14" fill="#8B5CF6"/>
      <rect x="463" y="184" width="102" height="72" rx="14" fill="#EC4899"/>
      <!-- Podiums -->
      <rect x="190" y="320" width="110" height="100" rx="16" fill="url(#blue_3d)" stroke="#BAE6FD" stroke-width="4"/>
      <rect x="345" y="305" width="110" height="115" rx="16" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="4"/>
      <rect x="500" y="320" width="110" height="100" rx="16" fill="url(#red_3d)" stroke="#FDA4AF" stroke-width="4"/>
    `
  },
  {
    file: 'tug_of_war_stage.webp',
    top: '#0284C7', mid: '#38BDF8', bottom: '#047857', accent: '#EF4444', glow: '#34D399',
    motif: `
      <!-- Stadium Turf & Center Line -->
      <ellipse cx="400" cy="360" rx="340" ry="70" fill="#059669" stroke="#34D399" stroke-width="4"/>
      <line x1="400" y1="290" x2="400" y2="430" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="10 8"/>
      <!-- 3D Braided Rope -->
      <line x1="90" y1="265" x2="710" y2="265" stroke="url(#wood_3d)" stroke-width="22" stroke-linecap="round"/>
      <polygon points="400,220 432,265 400,315 368,265" fill="url(#red_3d)" stroke="#FFF" stroke-width="4"/>
      <!-- Left & Right Mascot Shields -->
      <circle cx="195" cy="255" r="56" fill="url(#red_3d)" stroke="#FFF" stroke-width="6"/>
      <circle cx="180" cy="238" r="14" fill="#FFF" opacity="0.35"/>
      <circle cx="605" cy="255" r="56" fill="url(#blue_3d)" stroke="#FFF" stroke-width="6"/>
      <circle cx="590" cy="238" r="14" fill="#FFF" opacity="0.35"/>
    `
  },
  {
    file: 'wheel_stage.webp',
    top: '#78350F', mid: '#D97706', bottom: '#451A03', accent: '#FEF08A', glow: '#FBBF24',
    motif: `
      <rect x="365" y="290" width="70" height="130" rx="16" fill="url(#gold_3d)"/>
      <circle cx="400" cy="215" r="148" fill="#1E293B" stroke="url(#gold_3d)" stroke-width="12"/>
      <path d="M400 215 L400 75 A140 140 0 0 1 521 145 Z" fill="#EF4444"/>
      <path d="M400 215 L521 145 A140 140 0 0 1 521 285 Z" fill="#3B82F6"/>
      <path d="M400 215 L521 285 A140 140 0 0 1 400 355 Z" fill="#10B981"/>
      <path d="M400 215 L400 355 A140 140 0 0 1 279 285 Z" fill="#F59E0B"/>
      <path d="M400 215 L279 285 A140 140 0 0 1 279 145 Z" fill="#8B5CF6"/>
      <path d="M400 215 L279 145 A140 140 0 0 1 400 75 Z" fill="#EC4899"/>
      <circle cx="400" cy="215" r="42" fill="url(#gold_3d)" stroke="#FFF" stroke-width="6"/>
      <polygon points="400,42 422,86 378,86" fill="url(#red_3d)" stroke="#FFF" stroke-width="4"/>
    `
  },
  {
    file: 'race_stage.webp',
    top: '#0284C7', mid: '#38BDF8', bottom: '#1E293B', accent: '#F43F5E', glow: '#FB7185',
    motif: `
      <!-- Asphalt Track -->
      <path d="M0 320 Q400 230 800 320 L800 440 L0 440 Z" fill="#334155" stroke="#F8FAFC" stroke-width="6"/>
      <path d="M0 375 Q400 285 800 375" stroke="#FACC15" stroke-width="6" stroke-dasharray="28 18" fill="none"/>
      <!-- Red 3D Toy Race Car -->
      <g transform="translate(170, 250)">
        <rect x="0" y="34" width="165" height="48" rx="22" fill="url(#red_3d)" stroke="#FFF" stroke-width="3"/>
        <path d="M40 34 Q82 0 125 34 Z" fill="#BAE6FD"/>
        <circle cx="38" cy="82" r="24" fill="#0F172A" stroke="#CBD5E1" stroke-width="6"/>
        <circle cx="128" cy="82" r="24" fill="#0F172A" stroke="#CBD5E1" stroke-width="6"/>
      </g>
      <!-- Blue 3D Toy Race Car -->
      <g transform="translate(440, 270)">
        <rect x="0" y="34" width="165" height="48" rx="22" fill="url(#blue_3d)" stroke="#FFF" stroke-width="3"/>
        <path d="M40 34 Q82 0 125 34 Z" fill="#FEF08A"/>
        <circle cx="38" cy="82" r="24" fill="#0F172A" stroke="#CBD5E1" stroke-width="6"/>
        <circle cx="128" cy="82" r="24" fill="#0F172A" stroke="#CBD5E1" stroke-width="6"/>
      </g>
    `
  },
  {
    file: 'team_auction_stage.webp',
    top: '#451A03', mid: '#78350F', bottom: '#271202', accent: '#FDE047', glow: '#F59E0B',
    motif: `
      <!-- Auction Podium & Golden Gavel -->
      <rect x="270" y="220" width="260" height="190" rx="24" fill="url(#wood_3d)" stroke="url(#gold_3d)" stroke-width="8"/>
      <ellipse cx="400" cy="220" rx="95" ry="22" fill="#451A03" stroke="url(#gold_3d)" stroke-width="5"/>
      <g transform="translate(360, 85) rotate(-25)">
        <rect x="0" y="0" width="120" height="54" rx="16" fill="url(#gold_3d)" stroke="#FFF" stroke-width="4"/>
        <rect x="48" y="54" width="24" height="115" rx="10" fill="url(#wood_3d)"/>
      </g>
      <!-- Gold Coin Stacks -->
      <circle cx="200" cy="350" r="34" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="4"/>
      <circle cx="600" cy="350" r="34" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="4"/>
    `
  },
  {
    file: 'space_fleet_stage.webp',
    top: '#090D16', mid: '#1E1B4B', bottom: '#3B0764', accent: '#38BDF8', glow: '#A855F7',
    motif: `
      <!-- Ringed Planet with 3D Shading -->
      <circle cx="630" cy="135" r="64" fill="#7C3AED" stroke="#C4B5FD" stroke-width="3"/>
      <ellipse cx="630" cy="135" rx="115" ry="24" fill="none" stroke="#DDD6FE" stroke-width="9" transform="rotate(-18 630 135)"/>
      <ellipse cx="630" cy="135" rx="100" ry="18" fill="none" stroke="#A78BFA" stroke-width="4" transform="rotate(-18 630 135)"/>
      <!-- Fleet Starships with 3D Hull, Wings, Cockpit, and Ion Thruster Glow -->
      <!-- Red Flagship -->
      <g transform="translate(130, 180)">
        <!-- Ion Engine Exhaust -->
        <polygon points="-25,45 -5,35 -5,55" fill="#38BDF8" opacity="0.9"/>
        <polygon points="-40,45 -10,38 -10,52" fill="#BAE6FD" opacity="0.7"/>
        <!-- Main Wings & Hull -->
        <polygon points="140,45 0,5 28,45 0,85" fill="url(#red_3d)" stroke="#FFF" stroke-width="4"/>
        <polygon points="90,45 20,25 35,45 20,65" fill="#9F1239"/>
        <!-- Cockpit Canopy -->
        <ellipse cx="70" cy="45" rx="28" ry="13" fill="#BAE6FD" stroke="#FFF" stroke-width="2"/>
        <ellipse cx="66" cy="42" rx="14" ry="5" fill="#FFFFFF" opacity="0.8"/>
      </g>
      <!-- Blue Escort Cruiser -->
      <g transform="translate(490, 205)">
        <!-- Ion Engine Exhaust -->
        <polygon points="145,45 125,35 125,55" fill="#F43F5E" opacity="0.9"/>
        <!-- Main Wings & Hull -->
        <polygon points="-10,45 130,5 102,45 130,85" fill="url(#blue_3d)" stroke="#FFF" stroke-width="4"/>
        <polygon points="40,45 110,25 95,45 110,65" fill="#1E3A8A"/>
        <!-- Cockpit Canopy -->
        <ellipse cx="60" cy="45" rx="28" ry="13" fill="#FEF08A" stroke="#FFF" stroke-width="2"/>
        <ellipse cx="56" cy="42" rx="14" ry="5" fill="#FFFFFF" opacity="0.8"/>
      </g>
      <!-- Kinetic Defense Energy Pulse -->
      <line x1="280" y1="225" x2="480" y2="250" stroke="#38BDF8" stroke-width="10" stroke-linecap="round"/>
      <line x1="280" y1="225" x2="480" y2="250" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
      <circle cx="380" cy="237" r="14" fill="#67E8F9" opacity="0.8"/>
    `
  },
  {
    file: 'rocket_countdown_stage.webp',
    top: '#1E1B4B', mid: '#7C2D12', bottom: '#431407', accent: '#FB923C', glow: '#F97316',
    motif: `
      <!-- Launch Gantry -->
      <rect x="230" y="130" width="44" height="270" rx="8" fill="#475569" stroke="#94A3B8" stroke-width="4"/>
      <rect x="274" y="190" width="85" height="22" rx="6" fill="#64748B"/>
      <!-- 3D Space Rocket -->
      <g transform="translate(345, 65)">
        <path d="M55 0 C95 55 105 145 105 235 L5 235 C5 145 15 55 55 0 Z" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="5"/>
        <path d="M55 0 C78 35 88 80 92 105 L18 105 C22 80 32 35 55 0 Z" fill="url(#red_3d)"/>
        <circle cx="55" cy="155" r="26" fill="url(#blue_3d)" stroke="#E2E8F0" stroke-width="6"/>
        <polygon points="5,195 -28,255 15,235" fill="url(#red_3d)"/>
        <polygon points="105,195 138,255 95,235" fill="url(#red_3d)"/>
        <polygon points="55,235 22,320 55,295 88,320" fill="url(#gold_3d)"/>
      </g>
    `
  },
  {
    file: 'tower_architects_stage.webp',
    top: '#0284C7', mid: '#38BDF8', bottom: '#0F172A', accent: '#FACC15', glow: '#7DD3FC',
    motif: `
      <!-- 3D Lattice Construction Tower Crane -->
      <!-- Vertical Mast -->
      <rect x="130" y="55" width="28" height="345" fill="url(#gold_3d)" stroke="#78350F" stroke-width="3"/>
      <!-- Mast Cross Bracing -->
      <line x1="130" y1="95" x2="158" y2="135" stroke="#78350F" stroke-width="3"/>
      <line x1="158" y1="95" x2="130" y2="135" stroke="#78350F" stroke-width="3"/>
      <line x1="130" y1="175" x2="158" y2="215" stroke="#78350F" stroke-width="3"/>
      <line x1="158" y1="175" x2="130" y2="215" stroke="#78350F" stroke-width="3"/>
      <line x1="130" y1="255" x2="158" y2="295" stroke="#78350F" stroke-width="3"/>
      <line x1="158" y1="255" x2="130" y2="295" stroke="#78350F" stroke-width="3"/>
      <!-- Crane Cabin & Counterweight Jib -->
      <rect x="75" y="48" width="55" height="26" rx="6" fill="#475569" stroke="#94A3B8" stroke-width="2"/>
      <rect x="122" y="42" width="44" height="34" rx="8" fill="url(#blue_3d)" stroke="#FFF" stroke-width="2"/>
      <rect x="130" y="48" width="22" height="18" rx="4" fill="#BAE6FD"/>
      <!-- Horizontal Boom / Jib -->
      <rect x="110" y="58" width="450" height="20" rx="6" fill="url(#gold_3d)" stroke="#78350F" stroke-width="3"/>
      <!-- Boom Lattice Lines -->
      <line x1="170" y1="58" x2="195" y2="78" stroke="#78350F" stroke-width="3"/>
      <line x1="220" y1="58" x2="245" y2="78" stroke="#78350F" stroke-width="3"/>
      <line x1="270" y1="58" x2="295" y2="78" stroke="#78350F" stroke-width="3"/>
      <line x1="320" y1="58" x2="345" y2="78" stroke="#78350F" stroke-width="3"/>
      <line x1="370" y1="58" x2="395" y2="78" stroke="#78350F" stroke-width="3"/>
      <!-- Support Suspension Cables -->
      <line x1="144" y1="18" x2="550" y2="58" stroke="#CBD5E1" stroke-width="3"/>
      <line x1="144" y1="18" x2="75" y2="58" stroke="#CBD5E1" stroke-width="3"/>
      <polygon points="144,14 136,44 152,44" fill="url(#gold_3d)"/>
      <circle cx="144" cy="14" r="6" fill="url(#red_3d)"/>
      <!-- Hoist Trolley, Cable & Heavy Duty Hook -->
      <rect x="365" y="74" width="34" height="14" rx="4" fill="#334155"/>
      <line x1="382" y1="88" x2="382" y2="155" stroke="#E2E8F0" stroke-width="4"/>
      <circle cx="382" cy="160" r="10" fill="url(#gold_3d)"/>
      <path d="M382 170 Q382 190 395 190 Q405 190 405 180" stroke="url(#gold_3d)" stroke-width="5" fill="none" stroke-linecap="round"/>
      <!-- Hoisted Golden Keystone Block -->
      <g transform="translate(325, 185)">
        <rect x="0" y="0" width="114" height="65" rx="14" fill="url(#gold_3d)" stroke="#FFF" stroke-width="4"/>
        <polygon points="57,12 68,34 94,38 74,54 80,78 57,66 34,78 40,54 20,38 46,34" fill="#FEF08A" opacity="0.85"/>
        <line x1="15" y1="0" x2="57" y2="-25" stroke="#CBD5E1" stroke-width="3"/>
        <line x1="99" y1="0" x2="57" y2="-25" stroke="#CBD5E1" stroke-width="3"/>
      </g>
      <!-- Stacked 3D Architectural Foundation Tower Blocks -->
      <g transform="translate(260, 260)">
        <!-- Level 1 (Emerald Granite) -->
        <rect x="30" y="80" width="220" height="60" rx="16" fill="url(#green_3d)" stroke="#FFF" stroke-width="4"/>
        <line x1="100" y1="80" x2="100" y2="140" stroke="#065F46" stroke-width="3"/>
        <line x1="170" y1="80" x2="170" y2="140" stroke="#065F46" stroke-width="3"/>
        <!-- Level 2 (Royal Sapphire) -->
        <rect x="50" y="20" width="180" height="60" rx="16" fill="url(#blue_3d)" stroke="#FFF" stroke-width="4"/>
        <line x1="110" y1="20" x2="110" y2="80" stroke="#1E3A8A" stroke-width="3"/>
        <line x1="170" y1="20" x2="170" y2="80" stroke="#1E3A8A" stroke-width="3"/>
        <!-- Level 3 (Ruby Cornerstone) -->
        <rect x="75" y="-35" width="130" height="55" rx="14" fill="url(#red_3d)" stroke="#FFF" stroke-width="4"/>
      </g>
      <!-- Architectural Drafting Blueprint & Caution Stripes -->
      <g transform="translate(560, 280) rotate(-10)">
        <rect x="0" y="0" width="140" height="95" rx="12" fill="#1D4ED8" stroke="#93C5FD" stroke-width="4"/>
        <rect x="12" y="14" width="116" height="68" rx="6" fill="#2563EB"/>
        <line x1="25" y1="25" x2="115" y2="25" stroke="#DBEAFE" stroke-width="3" stroke-dasharray="6 4"/>
        <line x1="25" y1="45" x2="85" y2="45" stroke="#DBEAFE" stroke-width="3" stroke-dasharray="6 4"/>
        <line x1="25" y1="65" x2="105" y2="65" stroke="#DBEAFE" stroke-width="3" stroke-dasharray="6 4"/>
      </g>
      <!-- Safety Helmet -->
      <ellipse cx="530" cy="370" rx="28" ry="18" fill="url(#gold_3d)" stroke="#FFF" stroke-width="3"/>
      <rect x="502" y="370" width="56" height="7" rx="3" fill="#B45309"/>
    `
  },
  {
    file: 'space_defense_stage.webp',
    top: '#090D16', mid: '#1E1B4B', bottom: '#312E81', accent: '#22D3EE', glow: '#6366F1',
    motif: `
      <!-- UFO Saucers -->
      <g transform="translate(180, 95)">
        <path d="M35 35 Q70 -5 105 35 Z" fill="#67E8F9"/>
        <ellipse cx="70" cy="38" rx="65" ry="18" fill="url(#red_3d)" stroke="#FFF" stroke-width="3"/>
      </g>
      <g transform="translate(480, 115)">
        <path d="M35 35 Q70 -5 105 35 Z" fill="#FEF08A"/>
        <ellipse cx="70" cy="38" rx="65" ry="18" fill="url(#green_3d)" stroke="#FFF" stroke-width="3"/>
      </g>
      <!-- Planetary Defense Turret -->
      <circle cx="400" cy="385" r="68" fill="url(#blue_3d)" stroke="#BAE6FD" stroke-width="6"/>
      <line x1="400" y1="335" x2="255" y2="145" stroke="#22D3EE" stroke-width="8" stroke-linecap="round"/>
    `
  },
  {
    file: 'tictactoe_stage.webp',
    top: '#312E81', mid: '#4338CA', bottom: '#1E1B4B', accent: '#F43F5E', glow: '#38BDF8',
    motif: `
      <rect x="235" y="65" width="330" height="320" rx="32" fill="#1E1B4B" stroke="url(#gold_3d)" stroke-width="10"/>
      <line x1="345" y1="90" x2="345" y2="360" stroke="#818CF8" stroke-width="8" stroke-linecap="round"/>
      <line x1="455" y1="90" x2="455" y2="360" stroke="#818CF8" stroke-width="8" stroke-linecap="round"/>
      <line x1="260" y1="175" x2="540" y2="175" stroke="#818CF8" stroke-width="8" stroke-linecap="round"/>
      <line x1="260" y1="275" x2="540" y2="275" stroke="#818CF8" stroke-width="8" stroke-linecap="round"/>
      <!-- 3D X and O Gems -->
      <circle cx="400" cy="225" r="32" fill="none" stroke="url(#blue_3d)" stroke-width="14"/>
      <path d="M278 110 L322 154 M322 110 L278 154" stroke="url(#red_3d)" stroke-width="14" stroke-linecap="round"/>
      <path d="M478 298 L522 342 M522 298 L478 342" stroke="url(#red_3d)" stroke-width="14" stroke-linecap="round"/>
    `
  },
  {
    file: 'sentence_builder_stage.webp',
    top: '#065F46', mid: '#059669', bottom: '#064E3B', accent: '#FBBF24', glow: '#34D399',
    motif: `
      <!-- Team Rally Sentence Construction Stage -->
      <!-- Overhead Rally Finish Checkered Banner -->
      <path d="M120 45 Q400 95 680 45" stroke="url(#wood_3d)" stroke-width="12" fill="none"/>
      <polygon points="210,65 240,65 225,100" fill="#EF4444"/>
      <polygon points="310,75 340,75 325,110" fill="#3B82F6"/>
      <polygon points="410,78 440,78 425,112" fill="#F59E0B"/>
      <polygon points="510,72 540,72 525,106" fill="#10B981"/>

      <!-- Mechanical Word Engine Base & Conveyor Tracks -->
      <rect x="130" y="145" width="540" height="230" rx="32" fill="#0F172A" stroke="url(#wood_3d)" stroke-width="10"/>
      <!-- Steel Roller Rails -->
      <line x1="160" y1="265" x2="640" y2="265" stroke="#94A3B8" stroke-width="8" stroke-linecap="round"/>
      <line x1="160" y1="285" x2="640" y2="285" stroke="#64748B" stroke-width="6" stroke-linecap="round"/>

      <!-- Interlocking Word Railcars (Subject, Verb, Object, Punctuation) -->
      <!-- Car 1: Blue Word Car with Front Coupler -->
      <g transform="translate(165, 175)">
        <rect x="0" y="0" width="115" height="74" rx="18" fill="url(#blue_3d)" stroke="#FFF" stroke-width="4"/>
        <circle cx="115" cy="37" r="16" fill="url(#blue_3d)"/>
        <circle cx="30" cy="80" r="14" fill="#334155" stroke="#CBD5E1" stroke-width="4"/>
        <circle cx="85" cy="80" r="14" fill="#334155" stroke="#CBD5E1" stroke-width="4"/>
      </g>
      <!-- Car 2: Gold Word Car with Matching Couplers -->
      <g transform="translate(305, 175)">
        <rect x="0" y="0" width="115" height="74" rx="18" fill="url(#gold_3d)" stroke="#FFF" stroke-width="4"/>
        <circle cx="0" cy="37" r="14" fill="#0F172A"/>
        <circle cx="115" cy="37" r="16" fill="url(#gold_3d)"/>
        <circle cx="30" cy="80" r="14" fill="#334155" stroke="#CBD5E1" stroke-width="4"/>
        <circle cx="85" cy="80" r="14" fill="#334155" stroke="#CBD5E1" stroke-width="4"/>
      </g>
      <!-- Car 3: Emerald Word Car -->
      <g transform="translate(445, 175)">
        <rect x="0" y="0" width="115" height="74" rx="18" fill="url(#green_3d)" stroke="#FFF" stroke-width="4"/>
        <circle cx="0" cy="37" r="14" fill="#0F172A"/>
        <circle cx="30" cy="80" r="14" fill="#334155" stroke="#CBD5E1" stroke-width="4"/>
        <circle cx="85" cy="80" r="14" fill="#334155" stroke="#CBD5E1" stroke-width="4"/>
      </g>
      <!-- End Magnet Punctuation Orb -->
      <circle cx="605" cy="212" r="28" fill="url(#red_3d)" stroke="#FFF" stroke-width="5"/>
      <circle cx="600" cy="204" r="9" fill="#FFF" opacity="0.6"/>

      <!-- Glowing Connecting Energy Sparks -->
      <polygon points="280,212 295,200 290,212 305,212 290,224 295,212" fill="#FEF08A"/>
      <polygon points="420,212 435,200 430,212 445,212 430,224 435,212" fill="#FEF08A"/>
    `
  },
  {
    file: 'bridge_builder_stage.webp',
    top: '#0284C7', mid: '#38BDF8', bottom: '#0369A1', accent: '#F59E0B', glow: '#7DD3FC',
    motif: `
      <!-- Left & Right Cliffs -->
      <path d="M0 230 L195 230 L225 450 L0 450 Z" fill="url(#green_3d)"/>
      <path d="M800 230 L605 230 L575 450 L800 450 Z" fill="url(#green_3d)"/>
      <!-- Suspension Rope & Wooden Planks -->
      <path d="M180 150 Q400 235 620 150" stroke="url(#wood_3d)" stroke-width="8" fill="none"/>
      <rect x="215" y="235" width="52" height="24" rx="6" fill="url(#wood_3d)" stroke="#FFF" stroke-width="2"/>
      <rect x="280" y="238" width="52" height="24" rx="6" fill="url(#wood_3d)" stroke="#FFF" stroke-width="2"/>
      <rect x="345" y="240" width="52" height="24" rx="6" fill="url(#wood_3d)" stroke="#FFF" stroke-width="2"/>
      <rect x="410" y="240" width="52" height="24" rx="6" fill="url(#wood_3d)" stroke="#FFF" stroke-width="2"/>
      <rect x="475" y="238" width="52" height="24" rx="6" fill="url(#wood_3d)" stroke="#FFF" stroke-width="2"/>
      <rect x="540" y="235" width="52" height="24" rx="6" fill="url(#wood_3d)" stroke="#FFF" stroke-width="2"/>
    `
  },
  {
    file: 'island_crossing_stage.webp',
    top: '#0891B2', mid: '#06B6D4', bottom: '#155E75', accent: '#FDE047', glow: '#22D3EE',
    motif: `
      <!-- Tropical Stepping Islands -->
      <ellipse cx="190" cy="310" rx="85" ry="34" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="5"/>
      <ellipse cx="400" cy="265" rx="95" ry="38" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="5"/>
      <ellipse cx="615" cy="310" rx="85" ry="34" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="5"/>
      <!-- Palm Tree on Center Island -->
      <path d="M395 255 Q415 175 385 115" stroke="url(#wood_3d)" stroke-width="16" stroke-linecap="round" fill="none"/>
      <ellipse cx="345" cy="115" rx="45" ry="16" fill="url(#green_3d)" transform="rotate(-20 345 115)"/>
      <ellipse cx="425" cy="115" rx="45" ry="16" fill="url(#green_3d)" transform="rotate(20 425 115)"/>
      <ellipse cx="385" cy="95" rx="42" ry="15" fill="url(#green_3d)"/>
    `
  },
  {
    file: 'submarine_explore_stage.webp',
    top: '#0369A1', mid: '#1E3A8A', bottom: '#0F172A', accent: '#FACC15', glow: '#38BDF8',
    motif: `
      <!-- 3D Yellow Submarine -->
      <g transform="translate(235, 145)">
        <path d="M145 55 L145 10 L185 10" stroke="url(#gold_3d)" stroke-width="16" stroke-linecap="round" fill="none"/>
        <rect x="25" y="55" width="260" height="125" rx="62" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="6"/>
        <circle cx="95" cy="118" r="28" fill="url(#blue_3d)" stroke="#FFF" stroke-width="6"/>
        <circle cx="175" cy="118" r="28" fill="url(#blue_3d)" stroke="#FFF" stroke-width="6"/>
        <polygon points="285,95 320,75 320,160 285,140" fill="url(#red_3d)"/>
      </g>
      <circle cx="180" cy="160" r="14" fill="#BAE6FD" opacity="0.65"/>
      <circle cx="155" cy="115" r="9" fill="#BAE6FD" opacity="0.5"/>
    `
  },
  {
    file: 'robot_repair_stage.webp',
    top: '#3730A3', mid: '#4F46E5', bottom: '#1E1B4B', accent: '#4ADE80', glow: '#818CF8',
    motif: `
      <!-- Cute 3D Toy Robot -->
      <g transform="translate(290, 65)">
        <line x1="110" y1="0" x2="110" y2="35" stroke="#94A3B8" stroke-width="10" stroke-linecap="round"/>
        <circle cx="110" cy="0" r="14" fill="url(#red_3d)"/>
        <rect x="45" y="35" width="130" height="95" rx="28" fill="#E2E8F0" stroke="#94A3B8" stroke-width="6"/>
        <rect x="65" y="58" width="90" height="42" rx="14" fill="#0F172A"/>
        <circle cx="90" cy="79" r="11" fill="#38BDF8"/>
        <circle cx="130" cy="79" r="11" fill="#38BDF8"/>
        <rect x="25" y="142" width="170" height="145" rx="32" fill="url(#blue_3d)" stroke="#BAE6FD" stroke-width="6"/>
        <circle cx="110" cy="215" r="34" fill="url(#gold_3d)" stroke="#FFF" stroke-width="5"/>
      </g>
    `
  },
  {
    file: 'color_master_stage.webp',
    top: '#9333EA', mid: '#EC4899', bottom: '#4C1D95', accent: '#FDE047', glow: '#F472B6',
    motif: `
      <!-- 3D Artist Palette & Vibrant Paint Blobs -->
      <ellipse cx="400" cy="235" rx="185" ry="125" fill="url(#wood_3d)" stroke="#FEF08A" stroke-width="8"/>
      <circle cx="310" cy="195" r="28" fill="url(#red_3d)"/>
      <circle cx="385" cy="160" r="28" fill="url(#blue_3d)"/>
      <circle cx="465" cy="185" r="28" fill="url(#green_3d)"/>
      <circle cx="490" cy="255" r="28" fill="url(#gold_3d)"/>
      <circle cx="335" cy="275" r="24" fill="#4C1D95"/>
    `
  },
  {
    file: 'factory_machine_stage.webp',
    top: '#B45309', mid: '#D97706', bottom: '#1E293B', accent: '#38BDF8', glow: '#F59E0B',
    motif: `
      <!-- Conveyor Belt & Cargo Crates -->
      <rect x="95" y="295" width="610" height="58" rx="29" fill="#334155" stroke="#94A3B8" stroke-width="6"/>
      <circle cx="145" cy="324" r="18" fill="url(#gold_3d)"/>
      <circle cx="400" cy="324" r="18" fill="url(#gold_3d)"/>
      <circle cx="655" cy="324" r="18" fill="url(#gold_3d)"/>
      <rect x="210" y="165" width="120" height="120" rx="18" fill="url(#wood_3d)" stroke="#FEF08A" stroke-width="5"/>
      <rect x="440" y="165" width="120" height="120" rx="18" fill="url(#blue_3d)" stroke="#BAE6FD" stroke-width="5"/>
    `
  },
  {
    file: 'puzzle_masters_stage.webp',
    top: '#4F46E5', mid: '#7C3AED', bottom: '#312E81', accent: '#F59E0B', glow: '#A78BFA',
    motif: `
      <!-- 2x2 Interlocking 3D Jigsaw Tiles -->
      <rect x="255" y="95" width="138" height="125" rx="20" fill="url(#red_3d)" stroke="#FFF" stroke-width="5"/>
      <rect x="405" y="95" width="138" height="125" rx="20" fill="url(#blue_3d)" stroke="#FFF" stroke-width="5"/>
      <rect x="255" y="232" width="138" height="125" rx="20" fill="url(#gold_3d)" stroke="#FFF" stroke-width="5"/>
      <rect x="405" y="232" width="138" height="125" rx="20" fill="url(#green_3d)" stroke="#FFF" stroke-width="5"/>
      <circle cx="398" cy="155" r="22" fill="url(#red_3d)"/>
      <circle cx="398" cy="295" r="22" fill="url(#green_3d)"/>
    `
  },
  {
    file: 'target_attack_stage.webp',
    top: '#BE123C', mid: '#E11D48', bottom: '#065F46', accent: '#FACC15', glow: '#FB7185',
    motif: `
      <!-- 3D Bullseye Archery Target -->
      <line x1="330" y1="300" x2="280" y2="425" stroke="url(#wood_3d)" stroke-width="18" stroke-linecap="round"/>
      <line x1="470" y1="300" x2="520" y2="425" stroke="url(#wood_3d)" stroke-width="18" stroke-linecap="round"/>
      <circle cx="400" cy="215" r="135" fill="#FFFFFF" stroke="url(#red_3d)" stroke-width="24"/>
      <circle cx="400" cy="215" r="85" fill="url(#blue_3d)" stroke="#FFFFFF" stroke-width="18"/>
      <circle cx="400" cy="215" r="38" fill="url(#gold_3d)" stroke="url(#red_3d)" stroke-width="12"/>
      <line x1="545" y1="95" x2="405" y2="212" stroke="url(#wood_3d)" stroke-width="10" stroke-linecap="round"/>
    `
  },
  {
    file: 'vending_machine_stage.webp',
    top: '#DB2777', mid: '#E11D48', bottom: '#1E1B4B', accent: '#34D399', glow: '#F472B6',
    motif: `
      <!-- 3D Toy Vending Cabinet -->
      <rect x="275" y="45" width="250" height="365" rx="28" fill="url(#red_3d)" stroke="#FFF" stroke-width="6"/>
      <rect x="302" y="75" width="196" height="195" rx="18" fill="#0F172A" stroke="#38BDF8" stroke-width="4"/>
      <circle cx="355" cy="135" r="24" fill="url(#gold_3d)"/>
      <circle cx="435" cy="135" r="24" fill="url(#blue_3d)"/>
      <circle cx="355" cy="210" r="24" fill="url(#green_3d)"/>
      <circle cx="435" cy="210" r="24" fill="#EC4899"/>
      <rect x="315" y="315" width="170" height="58" rx="14" fill="#1E293B" stroke="url(#gold_3d)" stroke-width="4"/>
    `
  },
  {
    file: 'whats_in_box_stage.webp',
    top: '#581C87', mid: '#7E22CE', bottom: '#3B0764', accent: '#FBBF24', glow: '#C084FC',
    motif: `
      <!-- Mystery Gift Box & Golden Padlock -->
      <rect x="265" y="155" width="270" height="220" rx="26" fill="url(#wood_3d)" stroke="url(#gold_3d)" stroke-width="10"/>
      <rect x="245" y="115" width="310" height="54" rx="18" fill="url(#red_3d)" stroke="url(#gold_3d)" stroke-width="8"/>
      <rect x="372" y="115" width="56" height="260" fill="url(#gold_3d)"/>
      <circle cx="400" cy="245" r="36" fill="url(#gold_3d)" stroke="#FFF" stroke-width="5"/>
    `
  },
  {
    file: 'word_rhythm_stage.webp',
    top: '#701A75', mid: '#A21CAF', bottom: '#1E1B4B', accent: '#22D3EE', glow: '#E879F9',
    motif: `
      <!-- Turntable & Equalizer Bars -->
      <circle cx="400" cy="220" r="120" fill="#0F172A" stroke="#22D3EE" stroke-width="8"/>
      <circle cx="400" cy="220" r="44" fill="url(#red_3d)" stroke="#FFF" stroke-width="5"/>
      <rect x="135" y="210" width="26" height="130" rx="12" fill="url(#blue_3d)"/>
      <rect x="175" y="150" width="26" height="190" rx="12" fill="url(#green_3d)"/>
      <rect x="600" y="160" width="26" height="180" rx="12" fill="url(#gold_3d)"/>
      <rect x="640" y="215" width="26" height="125" rx="12" fill="url(#red_3d)"/>
    `
  },
  {
    file: 'word_wash_stage.webp',
    top: '#0284C7', mid: '#38BDF8', bottom: '#0C4A6E', accent: '#FEF08A', glow: '#7DD3FC',
    motif: `
      <!-- Smiling 3D Yellow Sponge & Glossy Soap Bubbles -->
      <rect x="285" y="145" width="230" height="165" rx="36" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="6"/>
      <circle cx="335" cy="195" r="14" fill="#B45309" opacity="0.45"/>
      <circle cx="455" cy="255" r="18" fill="#B45309" opacity="0.45"/>
      <circle cx="215" cy="155" r="46" fill="#E0F2FE" opacity="0.75" stroke="#FFF" stroke-width="4"/>
      <circle cx="585" cy="145" r="54" fill="#E0F2FE" opacity="0.75" stroke="#FFF" stroke-width="4"/>
      <circle cx="555" cy="285" r="36" fill="#E0F2FE" opacity="0.75" stroke="#FFF" stroke-width="4"/>
    `
  },
  {
    file: 'follow_clues_stage.webp',
    top: '#312E81', mid: '#4F46E5', bottom: '#1E1B4B', accent: '#FBBF24', glow: '#818CF8',
    motif: `
      <!-- Treasure Map, Magnifying Glass & Golden Key -->
      <rect x="195" y="95" width="410" height="260" rx="26" fill="#FEF3C7" stroke="url(#wood_3d)" stroke-width="10"/>
      <path d="M245 265 Q340 140 485 225" stroke="#EF4444" stroke-width="8" stroke-dasharray="16 12" fill="none"/>
      <circle cx="465" cy="195" r="62" fill="#BAE6FD" fill-opacity="0.45" stroke="url(#gold_3d)" stroke-width="14"/>
      <line x1="510" y1="240" x2="575" y2="305" stroke="url(#wood_3d)" stroke-width="18" stroke-linecap="round"/>
    `
  },
  {
    file: 'pit_stop_stage.webp',
    top: '#991B1B', mid: '#DC2626', bottom: '#1E293B', accent: '#FACC15', glow: '#F87171',
    motif: `
      <!-- Pit Lane Garage & Speedometer Gauge -->
      <circle cx="400" cy="235" r="130" fill="#0F172A" stroke="url(#gold_3d)" stroke-width="10"/>
      <path d="M300 265 A105 105 0 1 1 500 265" stroke="url(#green_3d)" stroke-width="18" fill="none" stroke-linecap="round"/>
      <line x1="400" y1="235" x2="475" y2="155" stroke="url(#red_3d)" stroke-width="12" stroke-linecap="round"/>
      <circle cx="400" cy="235" r="20" fill="url(#gold_3d)"/>
    `
  },
  {
    file: 'word_ninja_stage.webp',
    top: '#0F172A', mid: '#1E293B', bottom: '#334155', accent: '#38BDF8', glow: '#E11D48',
    motif: `
      <!-- Japanese Rising Sun Emblem in Dojo Background -->
      <circle cx="400" cy="190" r="110" fill="url(#red_3d)" opacity="0.65"/>
      <circle cx="400" cy="190" r="85" fill="#FDA4AF" opacity="0.25"/>

      <!-- Sliced Training Bamboo / Targets -->
      <!-- Left Sliced Target (Top half shifted) -->
      <g transform="translate(190, 150) rotate(-15)">
        <path d="M0,45 C0,15 50,15 50,45 L50,90 L0,90 Z" fill="url(#green_3d)" stroke="#FFF" stroke-width="4"/>
        <ellipse cx="25" cy="45" rx="25" ry="10" fill="#6EE7B7"/>
      </g>
      <!-- Left Sliced Target (Bottom half) -->
      <g transform="translate(205, 230) rotate(-5)">
        <path d="M0,0 L50,0 L50,70 C50,90 0,90 0,70 Z" fill="url(#green_3d)" stroke="#FFF" stroke-width="4"/>
        <ellipse cx="25" cy="0" rx="25" ry="10" fill="#A7F3D0"/>
      </g>

      <!-- Right Target Sliced Fruit/Sphere -->
      <g transform="translate(560, 160) rotate(18)">
        <path d="M0,50 A50,50 0 0,1 100,50 Z" fill="url(#red_3d)" stroke="#FFF" stroke-width="4"/>
        <ellipse cx="50" cy="50" rx="46" ry="14" fill="#FEF08A"/>
        <circle cx="50" cy="50" r="6" fill="#78350F"/>
      </g>

      <!-- 3D Golden Ninja Shurikens / Throwing Stars -->
      <g transform="translate(490, 95) rotate(25)">
        <polygon points="0,-32 8,-8 32,0 8,8 0,32 -8,8 -32,0 -8,-8" fill="url(#gold_3d)" stroke="#FFF" stroke-width="3"/>
        <circle cx="0" cy="0" r="6" fill="#0F172A"/>
      </g>
      <g transform="translate(140, 105) rotate(-35) scale(0.75)">
        <polygon points="0,-32 8,-8 32,0 8,8 0,32 -8,8 -32,0 -8,-8" fill="url(#gold_3d)" stroke="#FFF" stroke-width="3"/>
        <circle cx="0" cy="0" r="6" fill="#0F172A"/>
      </g>

      <!-- Sweeping 3D Katana Blade with Razor Shine -->
      <!-- Katana Handle (Tsuka) & Guard (Tsuba) -->
      <g transform="translate(110, 310) rotate(-28)">
        <!-- Wrapped Grip -->
        <rect x="-85" y="-12" width="85" height="24" rx="8" fill="#1E293B" stroke="#94A3B8" stroke-width="3"/>
        <line x1="-65" y1="-12" x2="-55" y2="12" stroke="url(#gold_3d)" stroke-width="4"/>
        <line x1="-45" y1="-12" x2="-35" y2="12" stroke="url(#gold_3d)" stroke-width="4"/>
        <line x1="-25" y1="-12" x2="-15" y2="12" stroke="url(#gold_3d)" stroke-width="4"/>
        <circle cx="-85" cy="0" r="10" fill="url(#gold_3d)"/>
        <!-- Golden Oval Guard (Tsuba) -->
        <ellipse cx="0" cy="0" rx="8" ry="24" fill="url(#gold_3d)" stroke="#FEF08A" stroke-width="3"/>
      </g>

      <!-- Polished Steel Curved Katana Blade -->
      <path d="M110 310 Q390 195 680 115" stroke="#E2E8F0" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M112 308 Q390 194 680 115" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none"/>

      <!-- Glowing Cyan Slicing Trail & Slash Energy Sparks -->
      <path d="M90 325 Q390 180 720 95" stroke="#38BDF8" stroke-width="18" opacity="0.45" stroke-linecap="round" fill="none"/>
      <path d="M120 310 Q390 195 680 115" stroke="#67E8F9" stroke-width="6" opacity="0.85" stroke-linecap="round" fill="none"/>

      <!-- Critical Slash Impact Spark -->
      <polygon points="390,195 402,170 415,195 440,205 415,215 402,240 390,215 365,205" fill="#FFFFFF" stroke="#38BDF8" stroke-width="3"/>
    `
  },
  {
    file: 'balloon_pop_stage.webp',
    top: '#0284C7', mid: '#38BDF8', bottom: '#10B981', accent: '#EF4444', glow: '#BAE6FD',
    motif: `
      <!-- Glossy 3D Floating Balloons -->
      <g transform="translate(215, 75)">
        <ellipse cx="55" cy="68" rx="54" ry="66" fill="url(#red_3d)"/>
        <ellipse cx="36" cy="44" rx="14" ry="26" fill="#FFF" opacity="0.45"/>
        <path d="M55 134 Q42 195 62 245" stroke="#FFF" stroke-width="4" fill="none"/>
      </g>
      <g transform="translate(365, 45)">
        <ellipse cx="55" cy="68" rx="54" ry="66" fill="url(#gold_3d)"/>
        <ellipse cx="36" cy="44" rx="14" ry="26" fill="#FFF" opacity="0.45"/>
        <path d="M55 134 Q68 195 48 245" stroke="#FFF" stroke-width="4" fill="none"/>
      </g>
      <g transform="translate(515, 85)">
        <ellipse cx="55" cy="68" rx="54" ry="66" fill="url(#green_3d)"/>
        <ellipse cx="36" cy="44" rx="14" ry="26" fill="#FFF" opacity="0.45"/>
        <path d="M55 134 Q42 195 62 245" stroke="#FFF" stroke-width="4" fill="none"/>
      </g>
    `
  },
  {
    file: 'whack_a_mole_stage.webp',
    top: '#15803D', mid: '#16A34A', bottom: '#713F12', accent: '#F59E0B', glow: '#4ADE80',
    motif: `
      <!-- Garden Burrow & Cute Mole in Yellow Helmet -->
      <ellipse cx="400" cy="335" rx="155" ry="44" fill="#451A03" stroke="#78350F" stroke-width="8"/>
      <path d="M320 330 L320 195 A80 80 0 0 1 480 195 L480 330 Z" fill="url(#wood_3d)" stroke="#FEF08A" stroke-width="5"/>
      <path d="M312 195 A88 70 0 0 1 488 195 Z" fill="url(#gold_3d)" stroke="#FFF" stroke-width="5"/>
      <circle cx="370" cy="235" r="12" fill="#0F172A"/>
      <circle cx="430" cy="235" r="12" fill="#0F172A"/>
      <ellipse cx="400" cy="262" rx="22" ry="15" fill="url(#red_3d)"/>
    `
  },
  {
    file: 'basket_catch_stage.webp',
    top: '#059669', mid: '#10B981', bottom: '#064E3B', accent: '#B45309', glow: '#6EE7B7',
    motif: `
      <!-- Falling Apples & Woven Picnic Basket -->
      <circle cx="290" cy="115" r="36" fill="url(#red_3d)" stroke="#FFF" stroke-width="4"/>
      <circle cx="505" cy="95" r="36" fill="url(#gold_3d)" stroke="#FFF" stroke-width="4"/>
      <path d="M250 245 L550 245 L510 385 L290 385 Z" fill="url(#wood_3d)" stroke="#FEF08A" stroke-width="6"/>
      <line x1="265" y1="295" x2="535" y2="295" stroke="#78350F" stroke-width="6"/>
      <line x1="280" y1="345" x2="520" y2="345" stroke="#78350F" stroke-width="6"/>
    `
  },
  {
    file: 'word_detective_stage.webp',
    top: '#1E293B', mid: '#334155', bottom: '#0F172A', accent: '#F59E0B', glow: '#FBBF24',
    motif: `
      <!-- Detective Clue Board & Magnifier -->
      <rect x="175" y="75" width="450" height="275" rx="24" fill="url(#wood_3d)" stroke="#FEF08A" stroke-width="8"/>
      <rect x="220" y="115" width="110" height="90" rx="10" fill="#FEF3C7"/>
      <rect x="460" y="135" width="110" height="90" rx="10" fill="#FEF3C7"/>
      <line x1="275" y1="160" x2="515" y2="180" stroke="url(#red_3d)" stroke-width="6"/>
      <circle cx="395" cy="225" r="68" fill="#BAE6FD" fill-opacity="0.45" stroke="url(#gold_3d)" stroke-width="14"/>
      <line x1="445" y1="275" x2="515" y2="345" stroke="#78350F" stroke-width="18" stroke-linecap="round"/>
    `
  },
  {
    file: 'sorting_stage.webp',
    top: '#1E1B4B', mid: '#312E81', bottom: '#0F172A', accent: '#F472B6', glow: '#818CF8',
    motif: `
      <!-- Enchanted 3D Grammar Sorting Hall -->
      <!-- Overhead Category Chutes -->
      <path d="M210 20 L210 80 Q210 110 210 135" stroke="#93C5FD" stroke-width="12" fill="none" opacity="0.6"/>
      <path d="M400 20 L400 80 Q400 110 400 135" stroke="#FDA4AF" stroke-width="12" fill="none" opacity="0.6"/>
      <path d="M590 20 L590 80 Q590 110 590 135" stroke="#A7F3D0" stroke-width="12" fill="none" opacity="0.6"/>

      <!-- Floating Magical Sorting Spheres / Crystals -->
      <circle cx="210" cy="115" r="24" fill="url(#blue_3d)" stroke="#FFF" stroke-width="4"/>
      <circle cx="204" cy="107" r="7" fill="#FFF" opacity="0.8"/>

      <circle cx="400" cy="95" r="26" fill="url(#red_3d)" stroke="#FFF" stroke-width="4"/>
      <circle cx="392" cy="87" r="8" fill="#FFF" opacity="0.8"/>

      <circle cx="590" cy="115" r="24" fill="url(#green_3d)" stroke="#FFF" stroke-width="4"/>
      <circle cx="584" cy="107" r="7" fill="#FFF" opacity="0.8"/>

      <!-- Three 3D Ornate Category Sorting Chests -->
      <!-- Chest 1: Sapphire Nomen/Words Chest -->
      <g transform="translate(130, 195)">
        <ellipse cx="80" cy="165" rx="75" ry="16" fill="#000" opacity="0.4"/>
        <rect x="10" y="35" width="140" height="120" rx="18" fill="url(#blue_3d)" stroke="#BAE6FD" stroke-width="5"/>
        <path d="M10 40 Q80 5 150 40 Z" fill="#1E3A8A"/>
        <rect x="10" y="30" width="140" height="18" rx="6" fill="url(#gold_3d)"/>
        <!-- Book Crest -->
        <rect x="60" y="70" width="40" height="30" rx="6" fill="#FFFFFF" stroke="url(#gold_3d)" stroke-width="3"/>
        <line x1="80" y1="70" x2="80" y2="100" stroke="#0F172A" stroke-width="2"/>
        <circle cx="80" cy="120" r="10" fill="url(#gold_3d)"/>
      </g>

      <!-- Chest 2: Ruby Verben/Action Chest -->
      <g transform="translate(320, 185)">
        <ellipse cx="80" cy="175" rx="75" ry="16" fill="#000" opacity="0.4"/>
        <rect x="10" y="35" width="140" height="130" rx="18" fill="url(#red_3d)" stroke="#FDA4AF" stroke-width="5"/>
        <path d="M10 40 Q80 5 150 40 Z" fill="#9F1239"/>
        <rect x="10" y="30" width="140" height="18" rx="6" fill="url(#gold_3d)"/>
        <!-- Lightning / Action Crest -->
        <polygon points="82,65 70,88 84,88 78,110 94,82 82,82" fill="#FEF08A" stroke="#FFF" stroke-width="2"/>
        <circle cx="80" cy="130" r="10" fill="url(#gold_3d)"/>
      </g>

      <!-- Chest 3: Emerald Adjektive/Qualities Chest -->
      <g transform="translate(510, 195)">
        <ellipse cx="80" cy="165" rx="75" ry="16" fill="#000" opacity="0.4"/>
        <rect x="10" y="35" width="140" height="120" rx="18" fill="url(#green_3d)" stroke="#A7F3D0" stroke-width="5"/>
        <path d="M10 40 Q80 5 150 40 Z" fill="#065F46"/>
        <rect x="10" y="30" width="140" height="18" rx="6" fill="url(#gold_3d)"/>
        <!-- Star / Sparkle Crest -->
        <polygon points="80,70 85,82 98,84 88,94 91,106 80,99 69,106 72,94 62,84 75,82" fill="#FEF08A" stroke="#FFF" stroke-width="2"/>
        <circle cx="80" cy="120" r="10" fill="url(#gold_3d)"/>
      </g>
    `
  },
  {
    file: 'memory_stage.webp',
    top: '#047857', mid: '#10B981', bottom: '#064E3B', accent: '#FBBF24', glow: '#6EE7B7',
    motif: `
      <!-- 3D Memory Cards with Star Crests -->
      <g transform="translate(215, 85) rotate(-8)">
        <rect x="0" y="0" width="165" height="235" rx="24" fill="#FFFFFF" stroke="url(#gold_3d)" stroke-width="8"/>
        <circle cx="82" cy="117" r="46" fill="url(#red_3d)"/>
      </g>
      <g transform="translate(420, 85) rotate(8)">
        <rect x="0" y="0" width="165" height="235" rx="24" fill="url(#blue_3d)" stroke="url(#gold_3d)" stroke-width="8"/>
        <polygon points="82,65 98,100 135,105 108,132 115,170 82,150 49,170 56,132 29,105 66,100" fill="url(#gold_3d)"/>
      </g>
    `
  },
  {
    file: 'game_stage.webp',
    top: '#312E81', mid: '#4338CA', bottom: '#1E1B4B', accent: '#F59E0B', glow: '#818CF8',
    motif: `
      <!-- 3D Television Quiz Show Championship Stage -->
      <!-- Radiant Stage Archway -->
      <path d="M120 400 Q120 70 400 70 Q680 70 680 400" stroke="url(#gold_3d)" stroke-width="16" fill="none"/>
      <path d="M140 400 Q140 90 400 90 Q660 90 660 400" stroke="#818CF8" stroke-width="6" fill="none" opacity="0.6"/>

      <!-- Floating Quiz Question Star Badge Cards -->
      <g transform="translate(210, 115) rotate(-12)">
        <rect x="0" y="0" width="95" height="120" rx="16" fill="#FFFFFF" stroke="url(#gold_3d)" stroke-width="5"/>
        <circle cx="47" cy="50" r="22" fill="url(#blue_3d)"/>
        <polygon points="47,36 52,46 64,48 55,56 58,68 47,62 36,68 39,56 30,48 42,46" fill="#FEF08A"/>
      </g>
      <g transform="translate(495, 115) rotate(12)">
        <rect x="0" y="0" width="95" height="120" rx="16" fill="#FFFFFF" stroke="url(#gold_3d)" stroke-width="5"/>
        <circle cx="47" cy="50" r="22" fill="url(#red_3d)"/>
        <polygon points="47,36 52,46 64,48 55,56 58,68 47,62 36,68 39,56 30,48 42,46" fill="#FEF08A"/>
      </g>

      <!-- Center Master Quiz Buzzer Podium -->
      <g transform="translate(320, 210)">
        <!-- Podium Column -->
        <ellipse cx="80" cy="190" rx="90" ry="22" fill="#000" opacity="0.45"/>
        <path d="M25 180 L40 60 L120 60 L135 180 Z" fill="url(#wood_3d)" stroke="url(#gold_3d)" stroke-width="6"/>
        <!-- Podium Console Top -->
        <ellipse cx="80" cy="60" rx="72" ry="26" fill="#0F172A" stroke="url(#gold_3d)" stroke-width="6"/>
        <!-- Glowing Master Red Buzzer Button -->
        <ellipse cx="80" cy="50" rx="42" ry="20" fill="url(#red_3d)" stroke="#FFF" stroke-width="4"/>
        <ellipse cx="80" cy="45" rx="30" ry="12" fill="#FDA4AF" opacity="0.7"/>
        <!-- Star Emblem on Front Plaque -->
        <rect x="52" y="95" width="56" height="42" rx="10" fill="url(#gold_3d)" stroke="#FFF" stroke-width="3"/>
        <polygon points="80,104 84,113 94,114 86,121 88,131 80,126 72,131 74,121 66,114 76,113" fill="#FFF"/>
      </g>

      <!-- Floating Star Sparks -->
      <polygon points="400,28 406,42 422,44 410,54 414,70 400,62 386,70 390,54 378,44 394,42" fill="#FEF08A"/>
      <circle cx="400" cy="49" r="6" fill="#FFF"/>
    `
  },
  {
    file: 'solo_sentence_stage.webp',
    top: '#0D9488', mid: '#14B8A6', bottom: '#115E59', accent: '#F59E0B', glow: '#5EEAD4',
    motif: `
      <!-- Cozy Author Writing Desk & Sentence Word Builder -->
      <!-- Polished Wooden Desk Surface with Depth -->
      <ellipse cx="400" cy="380" rx="360" ry="90" fill="url(#wood_3d)" stroke="#FEF08A" stroke-width="6"/>

      <!-- Classic Banker's Lamp (Left) -->
      <g transform="translate(140, 110)">
        <ellipse cx="40" cy="230" rx="35" ry="14" fill="#0F172A"/>
        <path d="M40 230 L40 60 Q40 40 65 40 L75 40" stroke="url(#gold_3d)" stroke-width="8" fill="none"/>
        <rect x="50" y="25" width="80" height="34" rx="14" fill="url(#green_3d)" stroke="url(#gold_3d)" stroke-width="4"/>
        <!-- Lamp Glow Cone -->
        <polygon points="50,60 130,60 190,240 10,240" fill="#FEF08A" opacity="0.12"/>
      </g>

      <!-- Open Grammar Manuscript Book / Notebook (Center) -->
      <g transform="translate(250, 205)">
        <rect x="30" y="30" width="240" height="145" rx="18" fill="#451A03" stroke="url(#gold_3d)" stroke-width="4"/>
        <!-- Left & Right Pages -->
        <rect x="38" y="38" width="110" height="128" rx="10" fill="#FEF9C3"/>
        <rect x="152" y="38" width="110" height="128" rx="10" fill="#FEF9C3"/>
        <!-- Manuscript Text Lines -->
        <line x1="50" y1="60" x2="135" y2="60" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
        <line x1="50" y1="80" x2="130" y2="80" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
        <line x1="50" y1="100" x2="120" y2="100" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
        <line x1="165" y1="60" x2="250" y2="60" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
        <line x1="165" y1="80" x2="245" y2="80" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
        <line x1="165" y1="100" x2="235" y2="100" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
        <!-- Golden Ribbon Bookmark -->
        <path d="M148 35 L148 180 L142 170 L136 180 L136 35 Z" fill="url(#gold_3d)"/>
      </g>

      <!-- 3D Interlocking Word Building Blocks on the Desk -->
      <g transform="translate(220, 310)">
        <!-- Block 1 (Blue) -->
        <rect x="0" y="0" width="105" height="58" rx="14" fill="url(#blue_3d)" stroke="#FFF" stroke-width="3"/>
        <circle cx="105" cy="29" r="14" fill="url(#blue_3d)"/>
        <!-- Block 2 (Gold) -->
        <rect x="120" y="0" width="105" height="58" rx="14" fill="url(#gold_3d)" stroke="#FFF" stroke-width="3"/>
        <circle cx="120" cy="29" r="12" fill="#0F172A"/>
        <circle cx="225" cy="29" r="14" fill="url(#gold_3d)"/>
        <!-- Block 3 (Emerald) -->
        <rect x="240" y="0" width="105" height="58" rx="14" fill="url(#green_3d)" stroke="#FFF" stroke-width="3"/>
        <circle cx="240" cy="29" r="12" fill="#0F172A"/>
      </g>

      <!-- Inkwell & Golden Quill Feather (Right) -->
      <g transform="translate(600, 240)">
        <ellipse cx="40" cy="90" rx="28" ry="16" fill="#1E293B" stroke="url(#gold_3d)" stroke-width="4"/>
        <ellipse cx="40" cy="80" rx="18" ry="8" fill="#0F172A"/>
        <!-- Feather Quill slanted in inkwell -->
        <path d="M40 80 Q75 10 95 -40 Q80 20 40 80 Z" fill="#F8FAFC" stroke="url(#gold_3d)" stroke-width="3"/>
        <line x1="40" y1="80" x2="95" y2="-40" stroke="url(#gold_3d)" stroke-width="3"/>
      </g>
    `
  }
];

async function generateAllWebpAssets() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const scene of SCENES) {
    const w = scene.width || 800;
    const h = scene.height || 450;
    const svg = build3DCartoonSceneSvg(
      scene.file.replace('.webp', ''),
      scene.top,
      scene.mid,
      scene.bottom,
      scene.accent,
      scene.glow,
      scene.motif,
      w,
      h
    );
    const outPath = path.join(OUT_DIR, scene.file);
    await sharp(Buffer.from(svg))
      .resize(w, h)
      .webp({ quality: 90 })
      .toFile(outPath);
  }
  console.log(`Generated ${SCENES.length} local offline .webp assets in ${OUT_DIR}`);
}

generateAllWebpAssets().catch((err) => {
  console.error(err);
  process.exit(1);
});
