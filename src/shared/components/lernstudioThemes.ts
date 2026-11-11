import { LernstudioTheme, LernstudioThemeId } from '../../types/lernstudio';

// Unified Glück Application Theme Tokens for Lernstudio
const GLUCK_THEME_TOKENS: Omit<LernstudioTheme, 'id' | 'name' | 'nameArabic' | 'emoji'> = {
  bgGradient: '',
  cardBg: 'bg-surface border border-surface-border shadow-xs',
  borderColor: 'border-surface-border',
  primaryBg: 'bg-primary hover:bg-primary-hover text-white shadow-xs',
  primaryText: 'text-primary',
  accentBadge: 'text-text-muted font-bold',
  decorationIcons: []
};

export const LERNSTUDIO_THEMES: Record<LernstudioThemeId, LernstudioTheme> = {
  neutral: {
    id: 'neutral',
    name: 'Glück Design System',
    nameArabic: 'نظام تصميم غلوك الموحد',
    emoji: '🎮',
    ...GLUCK_THEME_TOKENS
  },
  pastel: {
    id: 'pastel',
    name: 'Glück Design System',
    nameArabic: 'نظام تصميم غلوك الموحد',
    emoji: '🎮',
    ...GLUCK_THEME_TOKENS
  },
  space: {
    id: 'space',
    name: 'Glück Design System',
    nameArabic: 'نظام تصميم غلوك الموحد',
    emoji: '🎮',
    ...GLUCK_THEME_TOKENS
  },
  dino: {
    id: 'dino',
    name: 'Glück Design System',
    nameArabic: 'نظام تصميم غلوك الموحد',
    emoji: '🎮',
    ...GLUCK_THEME_TOKENS
  }
};
