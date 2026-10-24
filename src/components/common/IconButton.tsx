import React from 'react';
import { Loader2 } from 'lucide-react';
import { ButtonVariant, ButtonSize } from './Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      'aria-label': ariaLabel,
      variant = 'tertiary',
      size = 'md',
      isLoading = false,
      className = '',
      disabled,
      type = 'button',
      title,
      ...props
    },
    ref
  ) => {
    // Dimension & Icon size maps
    const sizeClasses = {
      sm: 'w-8 h-8 rounded-lg',
      md: 'w-10 h-10 rounded-xl',
      lg: 'w-12 h-12 rounded-xl',
    }[size];

    const variantClasses = {
      primary:
        'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs focus-visible:ring-indigo-500',
      secondary:
        'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus-visible:ring-slate-400',
      tertiary:
        'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 focus-visible:ring-slate-400',
      destructive:
        'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 focus-visible:ring-rose-500',
      'destructive-solid':
        'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus-visible:ring-rose-500',
      outline:
        'bg-surface hover:bg-surface-hover text-text-main border border-surface-border focus-visible:ring-primary',
      ghost:
        'bg-transparent hover:bg-surface-hover text-text-muted hover:text-text-main focus-visible:ring-primary',
    }[variant];

    const isInteractionDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        title={title || ariaLabel}
        disabled={isInteractionDisabled}
        className={`inline-flex items-center justify-center shrink-0 select-none transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95 ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <span className="flex items-center justify-center">{icon}</span>
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
