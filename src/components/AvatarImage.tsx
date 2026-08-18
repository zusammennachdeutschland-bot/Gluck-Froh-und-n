import React from 'react';
import { User } from 'lucide-react';

interface AvatarImageProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  avatarUrl?: string;
  fallback?: string;
  alt?: string;
  className?: string;
}

const BG_COLORS = [
  'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800',
  'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
];

export const AvatarImage: React.FC<AvatarImageProps> = ({ 
  name, 
  alt = '', 
  className = 'w-10 h-10 rounded-full', 
  avatarUrl,
  fallback,
  ...props 
}) => {
  const displayName = (typeof name === 'string' ? name : typeof alt === 'string' ? alt : '').trim();
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '';
  const colorIndex = displayName ? (displayName.charCodeAt(0) + displayName.length) % BG_COLORS.length : 0;
  const colorClass = BG_COLORS[colorIndex];

  return (
    <div 
      className={`flex items-center justify-center font-black select-none shrink-0 border ${colorClass} ${className}`}
      {...props}
    >
      {initial ? <span>{initial}</span> : <User className="w-1/2 h-1/2 opacity-75" />}
    </div>
  );
};
