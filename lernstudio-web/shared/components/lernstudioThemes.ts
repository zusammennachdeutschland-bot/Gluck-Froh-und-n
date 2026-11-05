import { LernstudioTheme, LernstudioThemeId } from '../../types/lernstudio';

export const LERNSTUDIO_THEMES: Record<LernstudioThemeId, LernstudioTheme> = {
  pastel: {
    id: 'pastel',
    name: 'Pastel Cute',
    nameArabic: 'لطيف وباستيل 🌸',
    emoji: '🌸',
    bgGradient: 'bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 dark:from-pink-950/20 dark:via-purple-950/20 dark:to-indigo-950/20',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-md border-pink-200/60 dark:border-pink-900/40',
    borderColor: 'border-pink-300/80 dark:border-pink-800/60',
    primaryBg: 'bg-pink-500 hover:bg-pink-600 text-white shadow-pink-500/20',
    primaryText: 'text-pink-600 dark:text-pink-400',
    accentBadge: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800',
    decorationIcons: ['🌸', '✨', '🐻', '🐱', '🎀', '⭐']
  },
  space: {
    id: 'space',
    name: 'Space & Sci-Fi',
    nameArabic: 'الفضاء والروبوتات 🚀',
    emoji: '🚀',
    bgGradient: 'bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-slate-100',
    cardBg: 'bg-indigo-950/80 backdrop-blur-md shadow-xl border-cyan-500/40 text-cyan-50',
    borderColor: 'border-cyan-500/50',
    primaryBg: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-cyan-500/30',
    primaryText: 'text-cyan-400 dark:text-cyan-300',
    accentBadge: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40',
    decorationIcons: ['🚀', '🤖', '🪐', '🌌', '👾', '✨']
  },
  dino: {
    id: 'dino',
    name: 'Dinos & Safari',
    nameArabic: 'الديناصورات والغابة 🦕',
    emoji: '🦕',
    bgGradient: 'bg-gradient-to-br from-emerald-50 via-amber-50 to-lime-50 dark:from-emerald-950/30 dark:via-amber-950/30 dark:to-lime-950/30',
    cardBg: 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-md border-emerald-200/80 dark:border-emerald-800/60',
    borderColor: 'border-emerald-300/80 dark:border-emerald-800/60',
    primaryBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
    primaryText: 'text-emerald-700 dark:text-emerald-400',
    accentBadge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800',
    decorationIcons: ['🦕', '🦖', '🌴', '🐾', '🍃', '🌋']
  },
  neutral: {
    id: 'neutral',
    name: 'Neutral Modern',
    nameArabic: 'محايد وأنيق 💼',
    emoji: '✨',
    bgGradient: 'bg-surface-hover/30',
    cardBg: 'bg-surface border border-surface-border shadow-xs',
    borderColor: 'border-surface-border',
    primaryBg: 'bg-primary hover:bg-primary-hover text-white shadow-primary/20',
    primaryText: 'text-primary',
    accentBadge: 'bg-primary-soft text-primary border border-primary-border/40',
    decorationIcons: ['⭐', '📚', '🎯', '💡', '✏️', '🏆']
  }
};
