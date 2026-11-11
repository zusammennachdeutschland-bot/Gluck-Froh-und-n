import React from 'react';
import { Sparkles, ShieldCheck, ArrowUpRight, TrendingUp, TrendingDown, Award, Lock } from 'lucide-react';
import { GoldHolding, calculateHoldingMetrics } from '../../services/goldPrice/goldPriceTypes';

interface GoldBullionCardProps {
  holding: GoldHolding;
  current24KPrice: number;
  onClick?: () => void;
  className?: string;
}

export const GoldBullionCard: React.FC<GoldBullionCardProps> = ({
  holding,
  current24KPrice,
  onClick,
  className = '',
}) => {
  const metrics = calculateHoldingMetrics(holding, current24KPrice);
  const isProfit = metrics.profitLoss >= 0;

  // Stamped fineness text
  const finenessLabel = holding.purityKarat >= 24 
    ? 'FINE GOLD 999.9' 
    : holding.purityKarat >= 21 
    ? 'GOLD 875' 
    : holding.purityKarat >= 18 
    ? 'GOLD 750' 
    : `GOLD ${holding.purity}`;

  // Serial Number derived from holding id
  const serialNo = `№ ${(holding.brand || 'BTC').substring(0, 3).toUpperCase()}-${holding.id.slice(-6).toUpperCase()}`;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="سبيكة ذهب - اضغط لعرض التفاصيل في المحفظة"
      className={`group relative w-full aspect-[1.586/1] max-w-[360px] rounded-2xl p-2 select-none overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.99] ${className}`}
      style={{
        // Deep multi-angle metallic bullion luster gradient
        background: 'linear-gradient(135deg, #FDF0CD 0%, #F5C542 15%, #D49B1F 30%, #FDE48B 48%, #AA771C 65%, #FAD973 82%, #7D540B 100%)',
        boxShadow: '0 10px 25px -4px rgba(180, 115, 10, 0.4), 0 4px 12px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Specular Light Reflection Sheen Angle */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-500 group-hover:opacity-60"
        style={{
          background: 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.7) 45%, rgba(255,255,255,0.1) 55%, transparent 75%)',
        }}
      />

      {/* Outer Mint Extrusion Border */}
      <div className="absolute inset-0.5 rounded-[15px] border border-amber-200/60 pointer-events-none" />

      {/* Recessed Stamped Minting Frame */}
      <div 
        className="relative h-full w-full rounded-xl p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(235, 185, 55, 0.95) 0%, rgba(200, 140, 25, 0.95) 50%, rgba(165, 105, 10, 0.98) 100%)',
          boxShadow: 'inset 0 3px 6px rgba(0, 0, 0, 0.45), inset 0 -2px 4px rgba(255, 255, 255, 0.65), 0 1px 2px rgba(0,0,0,0.2)',
          border: '1.5px solid rgba(254, 240, 170, 0.75)',
        }}
      >
        {/* Subtle Radial Ingot Glare */}
        <div 
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)' }}
        />

        {/* 1. TOP MINT STAMP: Refiner Brand Hallmark & Seal */}
        <div className="relative z-10 flex items-start justify-between gap-2">
          {/* Brand Hallmark */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-amber-950/20 border border-amber-900/30 flex items-center justify-center text-amber-950 shadow-inner">
              <Award className="w-3.5 h-3.5" />
            </div>
            <div>
              <div 
                className="font-black text-xs sm:text-sm tracking-widest text-amber-950 uppercase font-serif"
                style={{ textShadow: '0 1px 0 rgba(255,255,255,0.6), 0 -1px 0 rgba(0,0,0,0.3)' }}
              >
                {holding.brand || 'BTC BULLION'}
              </div>
              <div className="text-[8px] font-black text-amber-900/80 tracking-tighter uppercase -mt-0.5">
                CERTIFIED EGYPTIAN BULLION
              </div>
            </div>
          </div>

          {/* Stamped Karat Badge */}
          <div className="flex items-center gap-1.5">
            <span 
              className="text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider text-amber-950 bg-gradient-to-b from-amber-100 to-amber-300 border border-amber-800/40 shadow-xs"
              style={{ textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}
            >
              {holding.purity} • {holding.purityKarat >= 24 ? '24 KARAT' : `${holding.purityKarat}K`}
            </span>
          </div>
        </div>

        {/* 2. CENTER ENGRAVED SECTION: Net Weight & Market Value */}
        <div className="relative z-10 my-auto py-1">
          <div className="flex items-baseline justify-between gap-2">
            {/* Stamped Weight */}
            <div>
              <span className="text-[8px] font-black text-amber-950/70 tracking-widest block uppercase">
                NET WEIGHT / الوزن الصافي
              </span>
              <div className="flex items-baseline gap-1">
                <span 
                  className="text-2xl sm:text-3xl font-black text-amber-950 font-serif tracking-tight"
                  style={{ textShadow: '0 1px 1px rgba(255,255,255,0.7), 0 -1px 1px rgba(0,0,0,0.4)' }}
                >
                  {holding.weightGrams}
                </span>
                <span className="text-xs font-black text-amber-900 uppercase">
                  GRAMS
                </span>
              </div>
              <div 
                className="text-[9px] font-black tracking-wider text-amber-900/90 uppercase font-mono"
                style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}
              >
                {finenessLabel}
              </div>
            </div>

            {/* Current Value Plaque */}
            <div className="text-right">
              <span className="text-[8px] font-black text-amber-950/70 tracking-widest block uppercase">
                CURRENT VALUE / القيمة الحالية
              </span>
              <div 
                className="text-base sm:text-lg font-black text-amber-950 font-sans tracking-tight"
                style={{ textShadow: '0 1px 0 rgba(255,255,255,0.6)' }}
              >
                {metrics.currentValue.toLocaleString()}{' '}
                <span className="text-[10px] font-extrabold text-amber-900">EGP</span>
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span 
                  className={`text-[9px] font-black px-1.5 py-0.2 rounded-xs border flex items-center gap-0.5 shadow-2xs ${
                    isProfit 
                      ? 'bg-emerald-950/20 text-emerald-950 border-emerald-800/40' 
                      : 'bg-rose-950/20 text-rose-950 border-rose-800/40'
                  }`}
                  style={{ textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}
                >
                  {isProfit ? '+' : ''}{metrics.profitLoss.toLocaleString()} EGP ({isProfit ? '+' : ''}{metrics.roiPercent}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. BOTTOM ROW: Security Hologram, Serial Number & Assayer Stamp */}
        <div className="relative z-10 pt-1 border-t border-amber-900/20 flex items-center justify-between gap-2">
          {/* Security Hologram Chip & Assayer */}
          <div className="flex items-center gap-1.5">
            {/* Iridescent Rainbow Security Hologram */}
            <div 
              className="w-5 h-5 rounded-xs border border-white/60 shadow-xs flex items-center justify-center shrink-0 relative overflow-hidden"
              style={{
                background: 'linear-gradient(45deg, #ff7675 0%, #fdcb6e 25%, #55efc4 50%, #74b9ff 75%, #a29bfe 100%)',
              }}
              title="Hologram Security Feature"
            >
              <div className="absolute inset-0 bg-white/20 backdrop-blur-3xs" />
              <Lock className="w-2.5 h-2.5 text-white drop-shadow-xs relative z-10" />
            </div>
            <div className="leading-tight">
              <span className="text-[7px] font-black text-amber-950/70 uppercase block">
                مصلحة الدمغة والموازين
              </span>
              <span className="text-[8px] font-black text-amber-950 font-mono tracking-wider">
                MELTER ASSAYER
              </span>
            </div>
          </div>

          {/* Stamped Serial Number */}
          <div className="text-right">
            <span 
              className="font-mono text-[9px] sm:text-[10px] font-black text-amber-950 tracking-wider px-1.5 py-0.5 rounded-xs bg-amber-950/10 border border-amber-900/30 inline-block"
              style={{ textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}
            >
              {serialNo}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
