import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve('public/assets/games');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/**
 * Helper to render rich 3D Pixar-style Bear Head & Torso with expressions
 */
function buildNanoBearSvg({
  mood = 'idle', // 'idle' | 'thinking' | 'celebrating' | 'encouraging' | 'champion'
  bgGlowColor = '#F59E0B',
  bgTop = '#1E1B4B',
  bgBottom = '#0F172A'
}) {
  const isCelebrating = mood === 'celebrating' || mood === 'champion';
  const isThinking = mood === 'thinking';
  const isEncouraging = mood === 'encouraging';
  const isChampion = mood === 'champion';

  const bodyOffsetY = isCelebrating ? -18 : 0;
  const headTilt = isThinking ? -6 : isEncouraging ? 4 : 0;

  return `<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Studio Background -->
    <radialGradient id="bgRad" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="${bgGlowColor}" stop-opacity="0.38"/>
      <stop offset="45%" stop-color="${bgTop}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${bgBottom}" stop-opacity="1"/>
    </radialGradient>

    <radialGradient id="magicAura" cx="50%" cy="45%" r="42%">
      <stop offset="0%" stop-color="#FDE047" stop-opacity="0.55"/>
      <stop offset="55%" stop-color="#8B5CF6" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"/>
    </radialGradient>

    <!-- 3D Plush Fur Gradients -->
    <radialGradient id="furHead" cx="42%" cy="32%" r="58%">
      <stop offset="0%" stop-color="#D97706"/>
      <stop offset="48%" stop-color="#B45309"/>
      <stop offset="85%" stop-color="#78350F"/>
      <stop offset="100%" stop-color="#451A03"/>
    </radialGradient>

    <radialGradient id="furSnout" cx="48%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#FEF3C7"/>
      <stop offset="65%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#D97706"/>
    </radialGradient>

    <radialGradient id="furEarInner" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FDBA74"/>
      <stop offset="100%" stop-color="#9A3412"/>
    </radialGradient>

    <radialGradient id="noseGrad" cx="38%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="40%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>

    <!-- Royal Wizard Cape Gradient -->
    <linearGradient id="capeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="50%" stop-color="#3730A3"/>
      <stop offset="100%" stop-color="#1E1B4B"/>
    </linearGradient>

    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A"/>
      <stop offset="45%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>

    <radialGradient id="cheekBlush" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FB7185" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#FB7185" stop-opacity="0"/>
    </radialGradient>

    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#020617" flood-opacity="0.55"/>
    </filter>

    <filter id="glowFilter" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="600" height="600" rx="48" fill="url(#bgRad)"/>
  <circle cx="300" cy="275" r="245" fill="url(#magicAura)"/>

  <!-- Ambient Magic Stars & Sparkles -->
  <g opacity="0.85">
    <circle cx="95" cy="120" r="5" fill="#FEF08A"/>
    <circle cx="510" cy="105" r="6" fill="#38BDF8"/>
    <circle cx="80" cy="390" r="4" fill="#F472B6"/>
    <circle cx="525" cy="360" r="5" fill="#34D399"/>
    <path d="M125 180 L130 194 L144 199 L130 204 L125 218 L120 204 L106 199 L120 194 Z" fill="#FDE047"/>
    <path d="M480 165 L484 176 L495 180 L484 184 L480 195 L476 184 L465 180 L476 176 Z" fill="#FDE047"/>
    <path d="M105 295 L108 304 L117 307 L108 310 L105 319 L102 310 L93 307 L102 304 Z" fill="#A78BFA"/>
  </g>

  <!-- Stage Pedestal Base -->
  <ellipse cx="300" cy="545" rx="185" ry="30" fill="#020617" opacity="0.55"/>
  <ellipse cx="300" cy="538" rx="165" ry="22" fill="#1E293B" stroke="url(#goldTrim)" stroke-width="3"/>

  <!-- MAIN BEAR CHARACTER GROUP -->
  <g transform="translate(0, ${bodyOffsetY})" filter="url(#softShadow)">
    <!-- Outer Royal Wizard Cape -->
    <path d="M155 365 C140 445 135 510 155 535 L445 535 C465 510 460 445 445 365 C415 320 185 320 155 365 Z" fill="url(#capeGrad)" stroke="url(#goldTrim)" stroke-width="5"/>

    <!-- Plush Bear Belly -->
    <ellipse cx="300" cy="435" rx="108" ry="96" fill="url(#furHead)"/>
    <ellipse cx="300" cy="445" rx="74" ry="68" fill="url(#furSnout)"/>

    <!-- Cape Collar & Golden Star Clasp -->
    <path d="M195 348 Q300 398 405 348 L422 390 Q300 432 178 390 Z" fill="#312E81" stroke="url(#goldTrim)" stroke-width="4"/>
    <circle cx="300" cy="382" r="22" fill="url(#goldTrim)" stroke="#FFFBEB" stroke-width="2.5"/>
    <polygon points="300,366 305,376 316,377 308,384 310,395 300,389 290,395 292,384 284,377 295,376" fill="#FFFBEB"/>

    <!-- BEAR HEAD GROUP -->
    <g transform="rotate(${headTilt}, 300, 235)">
      <!-- Left & Right Ears -->
      <circle cx="178" cy="132" r="52" fill="url(#furHead)"/>
      <circle cx="178" cy="132" r="31" fill="url(#furEarInner)"/>
      <circle cx="422" cy="132" r="52" fill="url(#furHead)"/>
      <circle cx="422" cy="132" r="31" fill="url(#furEarInner)"/>

      <!-- Wizard Hat or Royal Crown -->
      ${
        isChampion
          ? `<g transform="translate(215, 22)">
              <path d="M10 85 L0 28 L42 54 L85 12 L128 54 L170 28 L160 85 Z" fill="url(#goldTrim)" stroke="#FEF08A" stroke-width="4" stroke-linejoin="round"/>
              <rect x="8" y="80" width="154" height="18" rx="9" fill="#B45309" stroke="#FEF08A" stroke-width="3"/>
              <circle cx="85" cy="54" r="10" fill="#EF4444"/>
              <circle cx="42" cy="64" r="7" fill="#38BDF8"/>
              <circle cx="128" cy="64" r="7" fill="#10B981"/>
            </g>`
          : `<g transform="translate(185, 10)">
              <path d="M25 102 Q115 72 205 102 L175 82 L130 8 L65 82 Z" fill="url(#capeGrad)" stroke="url(#goldTrim)" stroke-width="4" stroke-linejoin="round"/>
              <ellipse cx="115" cy="98" rx="108" ry="20" fill="#312E81" stroke="url(#goldTrim)" stroke-width="4"/>
              <polygon points="122,42 126,51 136,52 128,58 130,68 122,63 114,68 116,58 108,52 118,51" fill="#FDE047"/>
            </g>`
      }

      <!-- Main Head Sphere with 3D Cheek Volume -->
      <path d="M152 235 C152 135 215 95 300 95 C385 95 448 135 448 235 C462 295 425 352 300 352 C175 352 138 295 152 235 Z" fill="url(#furHead)"/>

      <!-- Rosy Cheeks -->
      <circle cx="200" cy="268" r="32" fill="url(#cheekBlush)"/>
      <circle cx="400" cy="268" r="32" fill="url(#cheekBlush)"/>

      <!-- Muzzle / Snout -->
      <ellipse cx="300" cy="272" rx="68" ry="52" fill="url(#furSnout)"/>

      <!-- 3D Glossy Bear Nose -->
      <ellipse cx="300" cy="246" rx="28" ry="20" fill="url(#noseGrad)"/>
      <ellipse cx="292" cy="240" rx="10" ry="5" fill="#94A3B8" opacity="0.65"/>

      <!-- Expressive Mouth -->
      ${
        isCelebrating
          ? `<path d="M268 274 Q300 316 332 274 Z" fill="#991B1B" stroke="#451A03" stroke-width="4"/>
             <path d="M282 292 Q300 282 318 292 Q300 308 282 292 Z" fill="#FB7185"/>`
          : isThinking
          ? `<path d="M284 284 Q302 276 318 286" stroke="#451A03" stroke-width="5" stroke-linecap="round" fill="none"/>`
          : `<path d="M272 274 Q300 300 328 274" stroke="#451A03" stroke-width="5.5" stroke-linecap="round" fill="none"/>
             <line x1="300" y1="266" x2="300" y2="280" stroke="#451A03" stroke-width="4.5" stroke-linecap="round"/>`
      }

      <!-- Expressive Eyes -->
      <g>
        <circle cx="242" cy="208" r="21" fill="#0F172A"/>
        <circle cx="236" cy="201" r="7.5" fill="#FFFFFF"/>
        <circle cx="248" cy="214" r="3.5" fill="#FFFFFF"/>
        <circle cx="358" cy="208" r="21" fill="#0F172A"/>
        <circle cx="352" cy="201" r="7.5" fill="#FFFFFF"/>
        <circle cx="364" cy="214" r="3.5" fill="#FFFFFF"/>
      </g>

      <!-- Eyebrows -->
      ${
        isThinking
          ? `<path d="M216 174 Q242 162 264 176" stroke="#451A03" stroke-width="6.5" stroke-linecap="round" fill="none"/>
             <path d="M336 168 Q358 154 384 166" stroke="#451A03" stroke-width="6.5" stroke-linecap="round" fill="none"/>`
          : `<path d="M218 172 Q242 160 264 172" stroke="#451A03" stroke-width="6" stroke-linecap="round" fill="none"/>
             <path d="M336 172 Q358 160 382 172" stroke="#451A03" stroke-width="6" stroke-linecap="round" fill="none"/>`
      }

      <!-- Cute Brass Professor Glasses -->
      <circle cx="242" cy="208" r="34" fill="none" stroke="url(#goldTrim)" stroke-width="5.5"/>
      <circle cx="358" cy="208" r="34" fill="none" stroke="url(#goldTrim)" stroke-width="5.5"/>
      <path d="M276 208 Q300 198 324 208" fill="none" stroke="url(#goldTrim)" stroke-width="5.5"/>
    </g>

    <!-- PAWS & PROPS BY MOOD -->
    ${
      isCelebrating
        ? `<circle cx="145" cy="315" r="38" fill="url(#furHead)"/>
           <circle cx="145" cy="315" r="20" fill="url(#furSnout)"/>
           <circle cx="455" cy="315" r="38" fill="url(#furHead)"/>
           <circle cx="455" cy="315" r="20" fill="url(#furSnout)"/>
           <g transform="translate(445, 195) rotate(18)">
             <rect x="-5" y="0" width="10" height="125" rx="5" fill="#78350F" stroke="url(#goldTrim)" stroke-width="2"/>
             <polygon points="0,-32 10,-10 34,-8 16,8 21,32 0,19 -21,32 -16,8 -34,-8 -10,-10" fill="url(#goldTrim)" filter="url(#glowFilter)"/>
           </g>`
        : isThinking
        ? `<circle cx="170" cy="410" r="36" fill="url(#furHead)"/>
           <circle cx="425" cy="365" r="36" fill="url(#furHead)"/>
           <g transform="translate(415, 295) rotate(-18)">
             <rect x="-6" y="35" width="12" height="75" rx="6" fill="#78350F" stroke="url(#goldTrim)" stroke-width="3"/>
             <circle cx="0" cy="0" r="44" fill="#38BDF8" fill-opacity="0.28" stroke="url(#goldTrim)" stroke-width="9"/>
             <path d="M-22 -18 Q-8 -30 14 -20" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none"/>
           </g>`
        : isEncouraging
        ? `<g transform="translate(300, 445)">
             <path d="M-110 -25 Q-55 -45 0 -20 Q55 -45 110 -25 L118 45 Q55 25 0 48 Q-55 25 -118 45 Z" fill="#FFFBEB" stroke="url(#goldTrim)" stroke-width="6"/>
             <line x1="0" y1="-20" x2="0" y2="48" stroke="#B45309" stroke-width="4"/>
             <path d="M-85 -5 H-25 M-85 12 H-35 M25 -5 H85 M25 12 H75" stroke="#64748B" stroke-width="4" stroke-linecap="round"/>
           </g>
           <circle cx="178" cy="435" r="34" fill="url(#furHead)"/>
           <circle cx="422" cy="435" r="34" fill="url(#furHead)"/>`
        : `<circle cx="162" cy="375" r="36" fill="url(#furHead)"/>
           <circle cx="162" cy="375" r="18" fill="url(#furSnout)"/>
           <circle cx="438" cy="395" r="36" fill="url(#furHead)"/>
           <g transform="translate(458, 280) rotate(22)">
             <rect x="-5" y="0" width="10" height="130" rx="5" fill="#78350F" stroke="url(#goldTrim)" stroke-width="2.5"/>
             <polygon points="0,-30 9,-9 32,-7 15,8 19,30 0,18 -19,30 -15,8 -32,-7 -9,-9" fill="url(#goldTrim)" filter="url(#glowFilter)"/>
           </g>`
    }
  </g>
</svg>`;
}

/**
 * Rich 16:9 Enchanted Magic Classroom Stage Backdrop
 */
function buildClassroomStageSvg() {
  return `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="nightSky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#090D16"/>
      <stop offset="45%" stop-color="#1E1B4B"/>
      <stop offset="85%" stop-color="#312E81"/>
      <stop offset="100%" stop-color="#1E1B4B"/>
    </linearGradient>

    <radialGradient id="stageSpotlight" cx="50%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.32"/>
      <stop offset="50%" stop-color="#6366F1" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#090D16" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="curtainRed" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#881337"/>
      <stop offset="35%" stop-color="#E11D48"/>
      <stop offset="70%" stop-color="#9F1239"/>
      <stop offset="100%" stop-color="#4C0519"/>
    </linearGradient>

    <linearGradient id="woodStage" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#78350F"/>
      <stop offset="35%" stop-color="#451A03"/>
      <stop offset="100%" stop-color="#1C0A00"/>
    </linearGradient>

    <linearGradient id="goldBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#B45309"/>
      <stop offset="50%" stop-color="#FDE047"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
  </defs>

  <rect width="1280" height="720" fill="url(#nightSky)"/>
  <rect width="1280" height="720" fill="url(#stageSpotlight)"/>

  <g opacity="0.28" stroke="#818CF8" stroke-width="3" fill="#312E81">
    <path d="M260 480 L260 210 Q340 120 420 210 L420 480 Z"/>
    <path d="M560 480 L560 180 Q640 90 720 180 L720 480 Z"/>
    <path d="M860 480 L860 210 Q940 120 1020 210 L1020 480 Z"/>
  </g>

  <polygon points="320,0 140,560 520,560" fill="#FDE047" opacity="0.07"/>
  <polygon points="640,0 420,560 860,560" fill="#38BDF8" opacity="0.08"/>
  <polygon points="960,0 760,560 1140,560" fill="#FDE047" opacity="0.07"/>

  <g>
    <line x1="250" y1="0" x2="250" y2="120" stroke="#F59E0B" stroke-width="2"/>
    <circle cx="250" cy="135" r="24" fill="#FEF08A" opacity="0.35"/>
    <rect x="238" y="120" width="24" height="32" rx="6" fill="#FDE047" stroke="#B45309" stroke-width="3"/>

    <line x1="640" y1="0" x2="640" y2="95" stroke="#F59E0B" stroke-width="2"/>
    <circle cx="640" cy="110" r="28" fill="#FEF08A" opacity="0.35"/>
    <rect x="626" y="95" width="28" height="34" rx="7" fill="#FDE047" stroke="#B45309" stroke-width="3"/>

    <line x1="1030" y1="0" x2="1030" y2="120" stroke="#F59E0B" stroke-width="2"/>
    <circle cx="1030" cy="135" r="24" fill="#FEF08A" opacity="0.35"/>
    <rect x="1018" y="120" width="24" height="32" rx="6" fill="#FDE047" stroke="#B45309" stroke-width="3"/>
  </g>

  <path d="M0 530 Q640 495 1280 530 L1280 720 L0 720 Z" fill="url(#woodStage)"/>
  <path d="M0 532 Q640 497 1280 532" fill="none" stroke="url(#goldBar)" stroke-width="6"/>

  <path d="M0 0 L185 0 Q145 280 95 575 L0 575 Z" fill="url(#curtainRed)"/>
  <path d="M1280 0 L1095 0 Q1135 280 1185 575 L1280 575 Z" fill="url(#curtainRed)"/>

  <path d="M0 0 L1280 0 L1280 55 Q960 95 640 55 Q320 95 0 55 Z" fill="url(#curtainRed)" stroke="url(#goldBar)" stroke-width="5"/>
</svg>`;
}

/**
 * Ornate 3D Magic Treasure Chest (Closed & Open & Tiered Gems)
 */
function buildMagicChestSvg({
  isOpen = false,
  gemLight = '#6EE7B7',
  gemMid = '#10B981',
  gemDark = '#065F46',
  woodTop = '#B45309',
  woodMid = '#78350F',
  woodBot = '#451A03'
}) {
  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="chestBg" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="${gemMid}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="oakWood" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${woodTop}"/>
      <stop offset="50%" stop-color="${woodMid}"/>
      <stop offset="100%" stop-color="${woodBot}"/>
    </linearGradient>
    <linearGradient id="goldMetal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A"/>
      <stop offset="45%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#92400E"/>
    </linearGradient>
    <radialGradient id="gemGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${gemLight}"/>
      <stop offset="55%" stop-color="${gemMid}"/>
      <stop offset="100%" stop-color="${gemDark}"/>
    </radialGradient>
  </defs>

  <rect width="512" height="512" rx="64" fill="url(#chestBg)"/>
  <ellipse cx="256" cy="430" rx="165" ry="26" fill="#020617" opacity="0.6"/>

  ${
    isOpen
      ? `<path d="M96 215 Q256 95 416 215 Z" fill="url(#oakWood)" stroke="url(#goldMetal)" stroke-width="10"/>
         <ellipse cx="256" cy="240" rx="145" ry="38" fill="#FDE047"/>
         <circle cx="195" cy="235" r="22" fill="#F59E0B" stroke="#FEF08A" stroke-width="3"/>
         <circle cx="245" cy="222" r="26" fill="#10B981" stroke="#A7F3D0" stroke-width="3"/>
         <circle cx="305" cy="232" r="24" fill="#38BDF8" stroke="#BAE6FD" stroke-width="3"/>
         <polygon points="256,80 268,118 308,120 276,144 288,182 256,160 224,182 236,144 204,120 244,118" fill="#FEF08A"/>`
      : `<path d="M88 235 C88 135 424 135 424 235 Z" fill="url(#oakWood)" stroke="url(#goldMetal)" stroke-width="12"/>
         <rect x="155" y="152" width="24" height="83" rx="6" fill="url(#goldMetal)"/>
         <rect x="333" y="152" width="24" height="83" rx="6" fill="url(#goldMetal)"/>`
  }

  <rect x="88" y="235" width="336" height="185" rx="24" fill="url(#oakWood)" stroke="url(#goldMetal)" stroke-width="12"/>
  <rect x="155" y="235" width="24" height="185" fill="url(#goldMetal)"/>
  <rect x="333" y="235" width="24" height="185" fill="url(#goldMetal)"/>

  <rect x="216" y="202" width="80" height="92" rx="20" fill="url(#goldMetal)" stroke="#FFFBEB" stroke-width="4"/>
  <polygon points="256,218 278,248 256,278 234,248" fill="url(#gemGlow)" stroke="#ECFDF5" stroke-width="3"/>
</svg>`;
}

async function run() {
  const jobs = [
    {
      file: 'classroom_stage.webp',
      width: 1280,
      height: 720,
      svg: buildClassroomStageSvg()
    },
    {
      file: 'nano_bear_idle.webp',
      width: 600,
      height: 600,
      svg: buildNanoBearSvg({ mood: 'idle', bgGlowColor: '#6366F1' })
    },
    {
      file: 'nano_bear_thinking.webp',
      width: 600,
      height: 600,
      svg: buildNanoBearSvg({ mood: 'thinking', bgGlowColor: '#38BDF8' })
    },
    {
      file: 'nano_bear_celebrating.webp',
      width: 600,
      height: 600,
      svg: buildNanoBearSvg({ mood: 'celebrating', bgGlowColor: '#10B981' })
    },
    {
      file: 'nano_bear_encouraging.webp',
      width: 600,
      height: 600,
      svg: buildNanoBearSvg({ mood: 'encouraging', bgGlowColor: '#F59E0B' })
    },
    {
      file: 'nano_bear_champion.webp',
      width: 600,
      height: 600,
      svg: buildNanoBearSvg({ mood: 'champion', bgGlowColor: '#FBBF24' })
    },
    {
      file: 'magic_chest_closed.webp',
      width: 512,
      height: 512,
      svg: buildMagicChestSvg({ isOpen: false })
    },
    {
      file: 'magic_chest_open.webp',
      width: 512,
      height: 512,
      svg: buildMagicChestSvg({ isOpen: true })
    },
    {
      file: 'chest_tier_emerald.webp',
      width: 512,
      height: 512,
      svg: buildMagicChestSvg({
        isOpen: false,
        gemLight: '#6EE7B7',
        gemMid: '#10B981',
        gemDark: '#065F46'
      })
    },
    {
      file: 'chest_tier_sapphire.webp',
      width: 512,
      height: 512,
      svg: buildMagicChestSvg({
        isOpen: false,
        gemLight: '#93C5FD',
        gemMid: '#3B82F6',
        gemDark: '#1E3A8A',
        woodTop: '#1E40AF',
        woodMid: '#1E3A8A',
        woodBot: '#172554'
      })
    },
    {
      file: 'chest_tier_amber.webp',
      width: 512,
      height: 512,
      svg: buildMagicChestSvg({
        isOpen: false,
        gemLight: '#FDE047',
        gemMid: '#F59E0B',
        gemDark: '#78350F',
        woodTop: '#D97706',
        woodMid: '#92400E',
        woodBot: '#451A03'
      })
    },
    {
      file: 'chest_tier_ruby.webp',
      width: 512,
      height: 512,
      svg: buildMagicChestSvg({
        isOpen: false,
        gemLight: '#FDA4AF',
        gemMid: '#E11D48',
        gemDark: '#881337',
        woodTop: '#9F1239',
        woodMid: '#881337',
        woodBot: '#4C0519'
      })
    }
  ];

  for (const job of jobs) {
    const outPath = path.join(OUT_DIR, job.file);
    await sharp(Buffer.from(job.svg))
      .resize(job.width, job.height)
      .webp({ quality: 92 })
      .toFile(outPath);
    console.log('Generated:', outPath);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
