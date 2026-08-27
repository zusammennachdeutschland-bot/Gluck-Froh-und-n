import React from 'react';
import { Landmark, Banknote, Wallet, CreditCard, TrendingUp, Wifi, ArrowUpRight } from 'lucide-react';
import { FinanceAccount } from '../../types';

export interface CardTheme {
  id: string;
  name: string;
  nameAr: string;
  bgGradient: string;
  textColor: string;
  subtextColor: string;
  border: string;
  previewColor: string;
  accentBadge: string;
}

export const CARD_THEMES: Record<string, CardTheme> = {
  emerald: {
    id: 'emerald',
    name: 'Emerald Green',
    nameAr: 'أخضر زمردي',
    bgGradient: 'from-emerald-700 via-teal-800 to-slate-900',
    textColor: 'text-white',
    subtextColor: 'text-emerald-100/75',
    border: 'border-emerald-500/30',
    previewColor: '#059669',
    accentBadge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  },
  blue: {
    id: 'blue',
    name: 'Sapphire Blue',
    nameAr: 'أزرق ياقوتي',
    bgGradient: 'from-blue-700 via-indigo-800 to-slate-950',
    textColor: 'text-white',
    subtextColor: 'text-blue-100/75',
    border: 'border-blue-500/30',
    previewColor: '#2563eb',
    accentBadge: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
  },
  purple: {
    id: 'purple',
    name: 'Amethyst Purple',
    nameAr: 'بنفسجي ملكي',
    bgGradient: 'from-purple-700 via-violet-800 to-slate-950',
    textColor: 'text-white',
    subtextColor: 'text-purple-100/75',
    border: 'border-purple-500/30',
    previewColor: '#7c3aed',
    accentBadge: 'bg-purple-500/20 text-purple-200 border-purple-400/30',
  },
  red: {
    id: 'red',
    name: 'Ruby Crimson',
    nameAr: 'أحمر ياقوتي',
    bgGradient: 'from-rose-700 via-red-800 to-zinc-950',
    textColor: 'text-white',
    subtextColor: 'text-rose-100/75',
    border: 'border-rose-500/30',
    previewColor: '#e11d48',
    accentBadge: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
  },
  orange: {
    id: 'orange',
    name: 'Amber Sunset',
    nameAr: 'كهرمان برتقالي',
    bgGradient: 'from-amber-600 via-orange-700 to-neutral-950',
    textColor: 'text-white',
    subtextColor: 'text-amber-100/75',
    border: 'border-amber-500/30',
    previewColor: '#d97706',
    accentBadge: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  },
  black: {
    id: 'black',
    name: 'Obsidian Black',
    nameAr: 'أسود ملكي',
    bgGradient: 'from-zinc-800 via-neutral-900 to-black',
    textColor: 'text-white',
    subtextColor: 'text-zinc-300/75',
    border: 'border-zinc-700/60',
    previewColor: '#18181b',
    accentBadge: 'bg-zinc-700/40 text-zinc-200 border-zinc-500/30',
  },
  teal: {
    id: 'teal',
    name: 'Turquoise Teal',
    nameAr: 'تركواز بحري',
    bgGradient: 'from-teal-600 via-cyan-800 to-slate-950',
    textColor: 'text-white',
    subtextColor: 'text-teal-100/75',
    border: 'border-teal-500/30',
    previewColor: '#0d9488',
    accentBadge: 'bg-teal-500/20 text-teal-200 border-teal-400/30',
  },
  gray: {
    id: 'gray',
    name: 'Titanium Gray',
    nameAr: 'رمادي تيتانيوم',
    bgGradient: 'from-slate-600 via-slate-800 to-slate-950',
    textColor: 'text-white',
    subtextColor: 'text-slate-200/75',
    border: 'border-slate-500/30',
    previewColor: '#475569',
    accentBadge: 'bg-slate-500/20 text-slate-200 border-slate-400/30',
  },
  indigo: {
    id: 'indigo',
    name: 'Midnight Indigo',
    nameAr: 'نيلي ليلي',
    bgGradient: 'from-indigo-700 via-blue-900 to-slate-950',
    textColor: 'text-white',
    subtextColor: 'text-indigo-100/75',
    border: 'border-indigo-500/30',
    previewColor: '#4338ca',
    accentBadge: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
  }
};

export const getDefaultThemeForType = (type: FinanceAccount['type']): string => {
  switch (type) {
    case 'bank': return 'blue';
    case 'cash': return 'emerald';
    case 'wallet': return 'purple';
    case 'credit': return 'black';
    case 'investment': return 'teal';
    default: return 'indigo';
  }
};

interface BankCardProps {
  account: Partial<FinanceAccount>;
  isSelected?: boolean;
  onClick?: () => void;
  isInteractive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  actionButtonLabel?: string;
  onActionButtonClick?: (e: React.MouseEvent) => void;
}

export const BankCard: React.FC<BankCardProps> = ({
  account,
  isSelected = false,
  onClick,
  isInteractive = true,
  size = 'md',
  className = '',
  actionButtonLabel,
  onActionButtonClick
}) => {
  const themeKey = account.color && CARD_THEMES[account.color] 
    ? account.color 
    : getDefaultThemeForType(account.type || 'cash');
  
  const theme = CARD_THEMES[themeKey] || CARD_THEMES.blue;

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'bank': return 'DEBIT';
      case 'credit': return 'CREDIT';
      case 'wallet': return 'E-WALLET';
      case 'cash': return 'CASH';
      case 'investment': return 'INVEST';
      default: return 'CARD';
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'bank': return <Landmark className="w-3.5 h-3.5" />;
      case 'cash': return <Banknote className="w-3.5 h-3.5" />;
      case 'wallet': return <Wallet className="w-3.5 h-3.5" />;
      case 'credit': return <CreditCard className="w-3.5 h-3.5" />;
      case 'investment': return <TrendingUp className="w-3.5 h-3.5" />;
      default: return <Landmark className="w-3.5 h-3.5" />;
    }
  };

  const formatCardNumber = (accountNum?: string) => {
    if (!accountNum) return '••••  ••••  ••••  8824';
    const clean = accountNum.replace(/\s+/g, '');
    if (!clean) return '••••  ••••  ••••  8824';
    const last4 = clean.slice(-4);
    return `••••  ••••  ••••  ${last4}`;
  };

  const isCredit = account.type === 'credit';
  const isInvestment = account.type === 'investment';
  const availableCredit = isCredit && account.creditLimit ? Math.max(0, account.creditLimit - (account.currentBalance || 0)) : null;

  // Investment values
  const initialCapital = account.initialCapital || account.initialBalance || 0;
  const contributions = account.totalContributions || 0;
  const returns = account.accumulatedReturns || 0;
  const totalValue = isInvestment ? (initialCapital + contributions + returns || account.currentBalance || 0) : (account.currentBalance || 0);

  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      className={`relative w-full aspect-[1.586/1] max-w-[360px] rounded-2xl p-4 sm:p-5 text-white border transition-all duration-300 select-none overflow-hidden flex flex-col justify-between ${
        theme.border
      } bg-gradient-to-br ${theme.bgGradient} ${
        isInteractive ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]' : ''
      } ${
        isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl' : 'shadow-md'
      } ${className}`}
    >
      {/* Background Decorative Graphic Accents (Security Watermarks / Sheen) */}
      <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-44 h-44 rounded-full bg-black/20 blur-xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none" />
      
      {/* Subtle security lines watermark */}
      <div className="absolute right-4 bottom-8 opacity-10 pointer-events-none">
        <div className="w-28 h-28 rounded-full border border-white/40" />
      </div>

      {/* 1. TOP ROW: Bank / Issuer Name & Contactless + Card Type Badge */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="opacity-90">{getTypeIcon(account.type)}</span>
            <span className="font-extrabold text-xs sm:text-sm tracking-wide text-white uppercase drop-shadow-xs truncate">
              {account.bankName || 'Glück Bank'}
            </span>
          </div>
          <p className="text-[10px] text-white/70 font-medium truncate mt-0.5">
            {account.name || 'Main Account'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Wifi className="w-4 h-4 rotate-90 text-white/70" />
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border tracking-wider uppercase backdrop-blur-xs ${theme.accentBadge}`}>
            {getTypeLabel(account.type)}
          </span>
        </div>
      </div>

      {/* 2. MIDDLE ROW: EMV Metallic Chip & Balance Display */}
      <div className="relative z-10 flex items-center justify-between gap-3 my-auto">
        {/* Realistic EMV Golden Chip */}
        <div className="w-9 h-7 sm:w-10 sm:h-7.5 rounded-md bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 border border-amber-100/60 shadow-inner relative overflow-hidden shrink-0 flex items-center justify-center">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-amber-800/40" />
          <div className="absolute inset-y-0 left-1/3 w-[1px] bg-amber-800/40" />
          <div className="absolute inset-y-0 right-1/3 w-[1px] bg-amber-800/40" />
          <div className="w-3 h-3 rounded-xs border border-amber-800/40 bg-amber-200/40" />
        </div>

        {/* Balance Display */}
        <div className="text-end">
          <span className="text-[9px] sm:text-[10px] text-white/70 font-bold uppercase tracking-wider block">
            {isCredit ? 'Used Balance' : isInvestment ? 'Portfolio Value' : 'Available Balance'}
          </span>
          <div className="flex items-baseline justify-end gap-1 mt-0.5">
            <span className="text-base sm:text-xl font-black font-sans tracking-tight drop-shadow-xs">
              {totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] sm:text-xs font-bold text-white/80">
              {account.currency || 'EGP'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. CARD NUMBER (Embossed-style Monospace) */}
      <div className="relative z-10">
        <div className="font-mono text-xs sm:text-sm tracking-widest text-white/90 drop-shadow-xs font-medium">
          {formatCardNumber(account.accountNumber)}
        </div>
      </div>

      {/* 4. BOTTOM ROW: Cardholder Info & Card Network Brand / Action Button */}
      <div className="relative z-10 flex items-end justify-between gap-2 pt-1 border-t border-white/10">
        <div className="min-w-0">
          <span className="text-[8px] sm:text-[9px] text-white/60 uppercase tracking-widest font-semibold block">
            CARDHOLDER
          </span>
          <span className="font-bold text-[11px] sm:text-xs tracking-wider uppercase text-white truncate block">
            {account.name || 'GLÜCK CLIENT'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCredit && availableCredit !== null ? (
            <div className="text-end">
              <span className="text-[8px] text-white/60 block">AVAIL</span>
              <span className="text-[10px] font-bold text-emerald-200 font-sans">
                {availableCredit.toLocaleString()}
              </span>
            </div>
          ) : isInvestment && account.annualInterestRate ? (
            <div className="text-end">
              <span className="text-[8px] text-white/60 block">RETURN</span>
              <span className="text-[10px] font-bold text-emerald-200 font-sans">
                +{account.annualInterestRate}%
              </span>
            </div>
          ) : (
            <div className="text-end">
              <span className="text-[8px] text-white/60 block">VALID</span>
              <span className="text-[10px] font-bold text-white/80 font-mono">
                08/29
              </span>
            </div>
          )}

          {actionButtonLabel ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onActionButtonClick?.(e);
              }}
              className="text-[10px] font-bold text-white bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer border border-white/20"
            >
              <span>{actionButtonLabel}</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          ) : (
            /* Overlapping dual-circles Card Network emblem */
            <div className="flex -space-x-2 rtl:space-x-reverse opacity-85 ms-1">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500/80 shadow-xs" />
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400/80 shadow-xs mix-blend-screen" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

