import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  darkMode: boolean;
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ darkMode, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-xl bg-surface border border-surface-border text-text-muted hover:text-text-main transition-all cursor-pointer shadow-xs"
      title={darkMode ? 'التحويل للوضع الفاتح' : 'التحويل للوضع الليلي'}
      aria-label="Toggle theme"
    >
      {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
    </button>
  );
};
