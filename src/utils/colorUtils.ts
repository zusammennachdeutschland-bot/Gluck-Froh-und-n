// Color conversion & custom accent utility functions

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number; // 0 - 360
  s: number; // 0 - 100
  v: number; // 0 - 100
}

export interface ColorShade {
  name: string;
  hex: string;
  presetKey?: string;
}

export interface ColorFamily {
  id: string;
  nameAr: string;
  nameEn: string;
  nameDe: string;
  icon: string;
  shades: ColorShade[];
}

// Convert HEX string (#RRGGBB or #RGB) to RGB object
export function hexToRgb(hexStr: string): RGB {
  let hex = hexStr.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return { r: 59, g: 130, b: 246 }; // Default blue fallback
  }
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Convert RGB object to HEX string (#RRGGBB)
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert HSV (h: 0-360, s: 0-100, v: 0-100) to RGB
export function hsvToRgb(h: number, s: number, v: number): RGB {
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const vNorm = Math.max(0, Math.min(100, v)) / 100;
  const hNorm = ((h % 360) + 360) % 360;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0, g = 0, b = 0;
  if (hNorm >= 0 && hNorm < 60) {
    r = c; g = x; b = 0;
  } else if (hNorm >= 60 && hNorm < 120) {
    r = x; g = c; b = 0;
  } else if (hNorm >= 120 && hNorm < 180) {
    r = 0; g = c; b = x;
  } else if (hNorm >= 180 && hNorm < 240) {
    r = 0; g = x; b = c;
  } else if (hNorm >= 240 && hNorm < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// Convert RGB (0-255) to HSV
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / diff) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / diff + 2;
    } else {
      h = (rNorm - gNorm) / diff + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : Math.round((diff / max) * 100);
  const v = Math.round(max * 100);

  return { h, s, v };
}

// Adjust HEX brightness
export function adjustColorBrightness(hexStr: string, percent: number): string {
  const { r, g, b } = hexToRgb(hexStr);
  const factor = 1 + percent / 100;
  return rgbToHex(r * factor, g * factor, b * factor);
}

// Calculate perceived YIQ brightness to determine contrasting text color (#000000 or #ffffff)
export function getContrastTextColor(hexStr: string): string {
  const { r, g, b } = hexToRgb(hexStr);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#000000' : '#ffffff';
}

// Calculate readable text color for light mode backgrounds
export function getReadableTextForLightMode(hexStr: string): string {
  const { r, g, b } = hexToRgb(hexStr);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  if (yiq >= 220) {
    return '#0f172a'; // White or near-white -> dark slate/charcoal for light background
  }
  if (yiq >= 150) {
    return adjustColorBrightness(hexStr, -35); // Darken bright colors for readable text on light surface
  }
  return hexStr;
}

// Apply accent color to document root (CSS variables or standard class)
export function applyAccentToDocument(colorKeyOrHex: string) {
  const PRESET_CLASSES = [
    'accent-blue', 'accent-green', 'accent-purple', 'accent-orange', 'accent-red',
    'accent-teal', 'accent-indigo', 'accent-rose', 'accent-amber', 'accent-emerald',
    'accent-fuchsia', 'accent-cyan', 'accent-violet', 'accent-slate', 'accent-pink',
    'accent-lime', 'accent-darkblue', 'accent-white'
  ];

  // Remove existing preset classes
  PRESET_CLASSES.forEach(cls => document.documentElement.classList.remove(cls));

  const root = document.documentElement;
  const isDark = root.classList.contains('dark') || root.classList.contains('amoled');

  const PRESET_MAP: Record<string, string> = {
    blue: '#3b82f6',
    green: '#22c55e',
    purple: '#a855f7',
    orange: '#f97316',
    red: '#ef4444',
    teal: '#14b8a6',
    indigo: '#6366f1',
    rose: '#f43f5e',
    amber: '#f59e0b',
    emerald: '#10b981',
    fuchsia: '#d946ef',
    cyan: '#06b6d4',
    violet: '#8b5cf6',
    slate: '#64748b',
    pink: '#ec4899',
    lime: '#84cc16',
    darkblue: '#1e40af',
    white: '#ffffff',
  };

  let hex = '#3b82f6';
  const cleanKey = colorKeyOrHex.replace(/^accent-/, '').replace(/^hex-/, '').trim();

  if (PRESET_MAP[cleanKey]) {
    hex = PRESET_MAP[cleanKey];
    root.classList.add(`accent-${cleanKey}`);
  } else {
    let raw = cleanKey;
    if (!raw.startsWith('#')) raw = `#${raw}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(raw) || /^#[0-9A-Fa-f]{3}$/.test(raw)) {
      hex = raw;
    }
  }

  const normalizedHex = hex.toLowerCase();
  const rgb = hexToRgb(hex);
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;

  const isWhiteAccent = yiq >= 240 || normalizedHex === '#ffffff' || normalizedHex === '#fff' || cleanKey === 'white';
  const isBlackAccent = yiq <= 45 || normalizedHex === '#000000' || normalizedHex === '#000' || cleanKey === 'black';

  if (isWhiteAccent) {
    if (isDark) {
      // Dark / AMOLED Mode + White Accent: White primary, black text on buttons
      root.style.setProperty('--primary', '#ffffff');
      root.style.setProperty('--primary-fg', '#000000');
      root.style.setProperty('--primary-hover', '#f1f5f9');
      root.style.setProperty('--primary-soft', 'rgba(255, 255, 255, 0.18)');
      root.style.setProperty('--primary-border', 'rgba(255, 255, 255, 0.35)');
      root.style.setProperty('--primary-glow', '#ffffff');
      root.style.setProperty('--primary-text', '#ffffff');
    } else {
      // Light Mode + White Accent: Dark slate/black primary for contrast against white background
      root.style.setProperty('--primary', '#0f172a');
      root.style.setProperty('--primary-fg', '#ffffff');
      root.style.setProperty('--primary-hover', '#1e293b');
      root.style.setProperty('--primary-soft', 'rgba(15, 23, 42, 0.12)');
      root.style.setProperty('--primary-border', 'rgba(15, 23, 42, 0.25)');
      root.style.setProperty('--primary-glow', '#0f172a');
      root.style.setProperty('--primary-text', '#0f172a');
    }
    return;
  }

  if (isBlackAccent) {
    if (isDark) {
      // Dark / AMOLED Mode + Black Accent: Flips to High-Contrast White so elements & text are fully visible on dark bg
      root.style.setProperty('--primary', '#ffffff');
      root.style.setProperty('--primary-fg', '#000000');
      root.style.setProperty('--primary-hover', '#f1f5f9');
      root.style.setProperty('--primary-soft', 'rgba(255, 255, 255, 0.18)');
      root.style.setProperty('--primary-border', 'rgba(255, 255, 255, 0.35)');
      root.style.setProperty('--primary-glow', '#ffffff');
      root.style.setProperty('--primary-text', '#ffffff');
    } else {
      // Light Mode + Black Accent: Pure black primary with crisp white text on light background
      root.style.setProperty('--primary', '#000000');
      root.style.setProperty('--primary-fg', '#ffffff');
      root.style.setProperty('--primary-hover', '#18181b');
      root.style.setProperty('--primary-soft', 'rgba(0, 0, 0, 0.12)');
      root.style.setProperty('--primary-border', 'rgba(0, 0, 0, 0.25)');
      root.style.setProperty('--primary-glow', '#000000');
      root.style.setProperty('--primary-text', '#000000');
    }
    return;
  }

  let effectivePrimary = hex;
  let fg = getContrastTextColor(hex);
  let primaryText = hex;

  if (isDark) {
    // In Dark Mode, if accent color is dark (YIQ < 110), lighten --primary and --primary-text so buttons and text pop on dark bg
    if (yiq < 110) {
      effectivePrimary = adjustColorBrightness(hex, 50);
      fg = getContrastTextColor(effectivePrimary);
      primaryText = adjustColorBrightness(hex, 70);
    } else {
      primaryText = hex;
    }
  } else {
    // Light mode: ensure readable text color for light backgrounds
    primaryText = getReadableTextForLightMode(hex);
  }

  const hoverHex = fg === '#000000' ? adjustColorBrightness(effectivePrimary, -15) : adjustColorBrightness(effectivePrimary, -12);
  const effRgb = hexToRgb(effectivePrimary);

  root.style.setProperty('--primary', effectivePrimary);
  root.style.setProperty('--primary-fg', fg);
  root.style.setProperty('--primary-hover', hoverHex);
  root.style.setProperty('--primary-soft', fg === '#000000' ? `rgba(${effRgb.r}, ${effRgb.g}, ${effRgb.b}, 0.25)` : `rgba(${effRgb.r}, ${effRgb.g}, ${effRgb.b}, 0.15)`);
  root.style.setProperty('--primary-border', fg === '#000000' ? `rgba(${effRgb.r}, ${effRgb.g}, ${effRgb.b}, 0.35)` : `rgba(${effRgb.r}, ${effRgb.g}, ${effRgb.b}, 0.3)`);
  root.style.setProperty('--primary-glow', effectivePrimary);
  root.style.setProperty('--primary-text', primaryText);

  const isTinted = root.classList.contains('tinted');
  if (isTinted) {
    root.style.setProperty('--background', `color-mix(in srgb, ${effectivePrimary} 7%, #f8fafc)`);
    root.style.setProperty('--surface', `color-mix(in srgb, ${effectivePrimary} 3.5%, #ffffff)`);
    root.style.setProperty('--surface-hover', `color-mix(in srgb, ${effectivePrimary} 8.5%, #f1f5f9)`);
    root.style.setProperty('--surface-border', `color-mix(in srgb, ${effectivePrimary} 20%, #e2e8f0)`);
    root.style.setProperty('--surface-border-soft', `color-mix(in srgb, ${effectivePrimary} 12%, #f1f5f9)`);
    root.style.setProperty('--text-main', '#0f172a');
    root.style.setProperty('--text-muted', `color-mix(in srgb, ${effectivePrimary} 35%, #64748b)`);
  } else {
    root.style.removeProperty('--background');
    root.style.removeProperty('--surface');
    root.style.removeProperty('--surface-hover');
    root.style.removeProperty('--surface-border');
    root.style.removeProperty('--surface-border-soft');
    root.style.removeProperty('--text-main');
    root.style.removeProperty('--text-muted');
  }
}

// Comprehensive Huge Palette with Color Families, Shades & Tints
export const COLOR_FAMILIES: ColorFamily[] = [
  {
    id: 'monochrome',
    nameAr: 'الأبيض والمونوكروم',
    nameEn: 'Monochrome & White',
    nameDe: 'Monochrom & Weiß',
    icon: '⚪',
    shades: [
      { name: 'Pure White', hex: '#ffffff', presetKey: 'white' },
      { name: 'Off White', hex: '#f8fafc' },
      { name: 'Soft Snow', hex: '#f1f5f9' },
      { name: 'Platinum', hex: '#e2e8f0' },
      { name: 'Silver Gray', hex: '#cbd5e1' },
      { name: 'Slate', hex: '#64748b', presetKey: 'slate' },
      { name: 'Charcoal', hex: '#334155' },
      { name: 'Pure Black', hex: '#000000' },
    ]
  },
  {
    id: 'blues',
    nameAr: 'الأزرق والسماوي',
    nameEn: 'Blues & Ocean',
    nameDe: 'Blau & Ozean',
    icon: '💙',
    shades: [
      { name: 'Sky 300', hex: '#7dd3fc' },
      { name: 'Light Blue', hex: '#38bdf8' },
      { name: 'Classic Blue', hex: '#3b82f6', presetKey: 'blue' },
      { name: 'Royal Blue', hex: '#2563eb' },
      { name: 'Cobalt', hex: '#1d4ed8' },
      { name: 'Deep Navy', hex: '#1e40af', presetKey: 'darkblue' },
      { name: 'Midnight', hex: '#1e3a8a' },
      { name: 'Ice Blue', hex: '#a5f3fc' },
    ]
  },
  {
    id: 'greens',
    nameAr: 'الأخضر والزمردي',
    nameEn: 'Greens & Emerald',
    nameDe: 'Grün & Smaragd',
    icon: '💚',
    shades: [
      { name: 'Mint 300', hex: '#6ee7b7' },
      { name: 'Emerald', hex: '#10b981', presetKey: 'emerald' },
      { name: 'Fresh Green', hex: '#22c55e', presetKey: 'green' },
      { name: 'Forest', hex: '#15803d' },
      { name: 'Deep Jade', hex: '#047857' },
      { name: 'Sage', hex: '#84a98c' },
      { name: 'Lime', hex: '#84cc16', presetKey: 'lime' },
      { name: 'Neon Lime', hex: '#a3e635' },
    ]
  },
  {
    id: 'purples',
    nameAr: 'البنفسجي واللافندر',
    nameEn: 'Purples & Violet',
    nameDe: 'Violett & Lila',
    icon: '💜',
    shades: [
      { name: 'Soft Lavender', hex: '#c084fc' },
      { name: 'Violet', hex: '#8b5cf6', presetKey: 'violet' },
      { name: 'Purple', hex: '#a855f7', presetKey: 'purple' },
      { name: 'Deep Plum', hex: '#7e22ce' },
      { name: 'Indigo', hex: '#6366f1', presetKey: 'indigo' },
      { name: 'Royal Purple', hex: '#6b21a8' },
      { name: 'Mulberry', hex: '#581c87' },
      { name: 'Grape', hex: '#4c1d95' },
    ]
  },
  {
    id: 'pinks',
    nameAr: 'الوردي والفوشيا',
    nameEn: 'Pinks & Fuchsia',
    nameDe: 'Pink & Fuchsia',
    icon: '💖',
    shades: [
      { name: 'Blush Pink', hex: '#f472b6' },
      { name: 'Vibrant Pink', hex: '#ec4899', presetKey: 'pink' },
      { name: 'Hot Pink', hex: '#db2777' },
      { name: 'Rose', hex: '#f43f5e', presetKey: 'rose' },
      { name: 'Fuchsia', hex: '#d946ef', presetKey: 'fuchsia' },
      { name: 'Deep Magenta', hex: '#c026d3' },
      { name: 'Raspberry', hex: '#be123c' },
      { name: 'Coral Rose', hex: '#fb7185' },
    ]
  },
  {
    id: 'reds',
    nameAr: 'الأحمر والقرمزي',
    nameEn: 'Reds & Crimson',
    nameDe: 'Rot & Karmesin',
    icon: '❤️',
    shades: [
      { name: 'Light Salmon', hex: '#fca5a5' },
      { name: 'Coral Red', hex: '#f87171' },
      { name: 'Bright Red', hex: '#ef4444', presetKey: 'red' },
      { name: 'Crimson', hex: '#dc2626' },
      { name: 'Ruby', hex: '#b91c1c' },
      { name: 'Brick', hex: '#991b1b' },
      { name: 'Dark Maroon', hex: '#7f1d1d' },
      { name: 'Fire Engine', hex: '#ff2a2a' },
    ]
  },
  {
    id: 'oranges',
    nameAr: 'البرتقالي والعنبر',
    nameEn: 'Oranges & Amber',
    nameDe: 'Orange & Bernstein',
    icon: '🧡',
    shades: [
      { name: 'Peach', hex: '#ff2d55' },
      { name: 'Bright Orange', hex: '#f97316', presetKey: 'orange' },
      { name: 'Sunset', hex: '#ea580c' },
      { name: 'Burnt Orange', hex: '#c2410c' },
      { name: 'Amber', hex: '#f59e0b', presetKey: 'amber' },
      { name: 'Warm Yellow', hex: '#eab308' },
      { name: 'Gold Amber', hex: '#d97706' },
      { name: 'Rust', hex: '#9a3412' },
    ]
  },
  {
    id: 'cyans',
    nameAr: 'التركواز والتيل',
    nameEn: 'Cyans & Teal',
    nameDe: 'Türkis & Teal',
    icon: '🩵',
    shades: [
      { name: 'Light Cyan', hex: '#67e8f9' },
      { name: 'Electric Cyan', hex: '#06b6d4', presetKey: 'cyan' },
      { name: 'Aqua', hex: '#22d3ee' },
      { name: 'Teal', hex: '#14b8a6', presetKey: 'teal' },
      { name: 'Deep Teal', hex: '#0d9488' },
      { name: 'Dark Cyan', hex: '#0e7490' },
      { name: 'Seafoam', hex: '#5eead4' },
      { name: 'Ocean Teal', hex: '#115e59' },
    ]
  },
  {
    id: 'grays',
    nameAr: 'الرمادي والسلات',
    nameEn: 'Grays & Slates',
    nameDe: 'Grau & Schiefer',
    icon: '🩶',
    shades: [
      { name: 'Light Slate', hex: '#94a3b8' },
      { name: 'Slate', hex: '#64748b', presetKey: 'slate' },
      { name: 'Cool Gray', hex: '#475569' },
      { name: 'Charcoal', hex: '#334155' },
      { name: 'Zinc', hex: '#52525b' },
      { name: 'Dark Graphite', hex: '#1f2937' },
      { name: 'Titanium', hex: '#374151' },
      { name: 'Steel', hex: '#6b7280' },
    ]
  }
];
