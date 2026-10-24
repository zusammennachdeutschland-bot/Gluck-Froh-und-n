import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { IconButton } from './IconButton';

export interface ActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  disabled?: boolean;
}

export interface ActionToolbarProps {
  primaryActions: ActionItem[];
  secondaryActions?: ActionItem[];
  className?: string;
  isRtl?: boolean;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  primaryActions,
  secondaryActions = [],
  className = '',
  isRtl = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`flex items-center gap-2 ${className}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {primaryActions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 h-9 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            action.variant === 'primary'
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
              : action.variant === 'destructive'
              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          {action.icon && <span className="shrink-0">{action.icon}</span>}
          <span>{action.label}</span>
        </button>
      ))}

      {secondaryActions.length > 0 && (
        <div className="relative" ref={menuRef}>
          <IconButton
            icon={<MoreVertical className="w-4 h-4" />}
            aria-label="More actions"
            size="sm"
            variant="tertiary"
            onClick={() => setIsOpen(!isOpen)}
          />

          {isOpen && (
            <div
              className={`absolute top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                isRtl ? 'left-0' : 'right-0'
              }`}
            >
              {secondaryActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  disabled={action.disabled}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors text-left select-none ${
                    isRtl ? 'text-right' : 'text-left'
                  } ${
                    action.variant === 'destructive'
                      ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {action.icon && <span className="shrink-0">{action.icon}</span>}
                  <span className="truncate">{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
