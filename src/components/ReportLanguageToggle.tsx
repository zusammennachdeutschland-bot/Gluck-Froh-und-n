import React from 'react';
import { useApp } from '../context/AppContext';
import { Globe } from 'lucide-react';

interface ReportLanguageToggleProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
  onLanguageChange?: (lang: 'ar' | 'en' | 'de') => void;
}

export const ReportLanguageToggle: React.FC<ReportLanguageToggleProps> = ({
  className = '',
  showLabel = true,
  compact = false,
  onLanguageChange
}) => {
  const { reportLanguage, setReportLanguage, _t } = useApp();

  const options: { code: 'ar' | 'en' | 'de'; label: string; shortLabel: string; flag: string }[] = [
    { code: 'ar', label: 'عربي', shortLabel: 'ع', flag: '🇪🇬' },
    { code: 'en', label: 'EN', shortLabel: 'EN', flag: '🇬🇧' },
    { code: 'de', label: 'DE', shortLabel: 'DE', flag: '🇩🇪' },
  ];

  const handleSelect = (code: 'ar' | 'en' | 'de') => {
    setReportLanguage(code);
    if (onLanguageChange) {
      onLanguageChange(code);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 sm:gap-1.5 ${className}`}>
      {showLabel && (
        <span className="text-[10px] sm:text-[11px] font-bold text-text-muted hidden xs:flex items-center gap-1 shrink-0 select-none">
          <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{_t('لغة التقرير:', 'Report Language:', 'Sprache:')}</span>
        </span>
      )}
      <div className="inline-flex items-center bg-slate-100/90 dark:bg-slate-800/90 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-xs shadow-2xs">
        {options.map((opt) => {
          const isActive = reportLanguage === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => handleSelect(opt.code)}
              className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isActive
                  ? 'bg-primary text-white shadow-2xs font-black'
                  : 'text-text-muted hover:text-text-main'
              }`}
              title={`${opt.flag} ${opt.label}`}
            >
              <span className="text-[11px] leading-none">{opt.flag}</span>
              <span className={compact ? 'hidden md:inline' : 'inline'}>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
