import React from 'react';
import { CertificateTemplateId, CertificateLanguage } from '../../types';
import {
  Award,
  Trophy,
  Star,
  Rocket,
  Cpu,
  Scroll,
  Sparkles,
  Crown,
  Shield,
  Smile,
  Check
} from 'lucide-react';

interface CertificateTemplateThumbnailProps {
  templateId: CertificateTemplateId;
  name: string;
  isSelected: boolean;
  onClick: () => void;
  language?: CertificateLanguage;
}

export const CertificateTemplateThumbnail: React.FC<CertificateTemplateThumbnailProps> = ({
  templateId,
  name,
  isSelected,
  onClick,
  language = 'ar'
}) => {
  // Render the miniature certificate visual styling
  const renderMiniatureCertificate = () => {
    switch (templateId) {
      case 'golden_olympic':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#fffdf5',
              border: '3px solid #d4af37',
              boxSizing: 'border-box'
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background: 'radial-gradient(circle at 50% 30%, #fef08a 0%, transparent 70%)'
              }}
            />
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid #ca8a04' }} />
            {/* Header */}
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 flex items-center justify-center shadow-xs">
                <Trophy className="w-2.5 h-2.5 text-amber-950" />
              </div>
              <div className="w-12 h-1 bg-amber-600/80 rounded-full mt-0.5" />
            </div>
            {/* Student line */}
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-amber-700 rounded-full" />
              <div className="w-10 h-0.5 bg-amber-400/60 rounded-full" />
            </div>
            {/* Footer */}
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-amber-700/60 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-white flex items-center justify-center shadow-xs">
                <Star className="w-2 h-2 text-amber-950 fill-amber-950" />
              </div>
              <div className="w-4 h-0.5 bg-amber-700/60 rounded-full" />
            </div>
          </div>
        );

      case 'classic':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#faf8f5',
              border: '3px solid #0f172a',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid #d4af37' }} />
            {/* Header */}
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#996515] via-[#d4af37] to-[#f7e49a] flex items-center justify-center shadow-xs">
                <Award className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="w-12 h-1 bg-slate-800 rounded-full mt-0.5" />
            </div>
            {/* Student line */}
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-slate-900 rounded-full" />
              <div className="w-10 h-0.5 bg-amber-500/60 rounded-full" />
            </div>
            {/* Footer */}
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-slate-400 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white flex items-center justify-center shadow-xs">
                <Award className="w-2 h-2 text-white" />
              </div>
              <div className="w-4 h-0.5 bg-slate-400 rounded-full" />
            </div>
          </div>
        );

      case 'royal_emerald':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#064e3b',
              border: '3px solid #d4af37',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid rgba(212, 175, 55, 0.6)' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-100 flex items-center justify-center shadow-xs">
                <Crown className="w-2.5 h-2.5 text-emerald-950" />
              </div>
              <div className="w-12 h-1 bg-amber-300 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-white rounded-full" />
              <div className="w-10 h-0.5 bg-amber-400/70 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-emerald-300/60 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-white flex items-center justify-center shadow-xs">
                <Star className="w-2 h-2 text-emerald-950 fill-emerald-950" />
              </div>
              <div className="w-4 h-0.5 bg-emerald-300/60 rounded-full" />
            </div>
          </div>
        );

      case 'islamic_heritage':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#0c1b33',
              border: '3px solid #d4af37',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px dashed rgba(212, 175, 55, 0.5)' }} />
            <div className="absolute top-0.5 left-1 text-[7px] text-amber-400 font-bold">۞</div>
            <div className="absolute top-0.5 right-1 text-[7px] text-amber-400 font-bold">۞</div>
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-600 via-amber-300 to-yellow-100 flex items-center justify-center shadow-xs">
                <span className="text-[8px] text-slate-900 font-bold">۞</span>
              </div>
              <div className="w-12 h-1 bg-amber-300 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-white rounded-full" />
              <div className="w-10 h-0.5 bg-amber-400/70 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-slate-400/60 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-white flex items-center justify-center shadow-xs">
                <Award className="w-2 h-2 text-slate-950" />
              </div>
              <div className="w-4 h-0.5 bg-slate-400/60 rounded-full" />
            </div>
          </div>
        );

      case 'space_explorer':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#070b1e',
              border: '3px solid #1e293b',
              boxSizing: 'border-box'
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 75% 25%, rgba(99, 102, 241, 0.4) 0%, transparent 60%)'
              }}
            />
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid rgba(129, 140, 248, 0.5)' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-xs">
                <Rocket className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="w-12 h-1 bg-cyan-300 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-white rounded-full" />
              <div className="w-10 h-0.5 bg-pink-400/80 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-indigo-400/60 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 border border-cyan-300 flex items-center justify-center shadow-xs">
                <Star className="w-2 h-2 text-white fill-white" />
              </div>
              <div className="w-4 h-0.5 bg-indigo-400/60 rounded-full" />
            </div>
          </div>
        );

      case 'future_tech':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#0a0f1d',
              border: '3px solid #0284c7',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px dashed rgba(56, 189, 248, 0.5)' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-md bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-xs">
                <Cpu className="w-2.5 h-2.5 text-cyan-200" />
              </div>
              <div className="w-12 h-1 bg-cyan-400 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-cyan-300 rounded-full" />
              <div className="w-10 h-0.5 bg-indigo-400/60 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-sky-400/50 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-md bg-cyan-500 border border-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-2 h-2 text-slate-950" />
              </div>
              <div className="w-4 h-0.5 bg-sky-400/50 rounded-full" />
            </div>
          </div>
        );

      case 'vintage_scroll':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#f6eedb',
              border: '3px solid #5c3a21',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid #8c5835' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-amber-800 flex items-center justify-center shadow-xs">
                <Scroll className="w-2.5 h-2.5 text-amber-100" />
              </div>
              <div className="w-12 h-1 bg-amber-900 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-amber-950 rounded-full" />
              <div className="w-10 h-0.5 bg-amber-700/60 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-amber-700/40 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-red-700 border border-red-900 flex items-center justify-center shadow-xs">
                <Sparkles className="w-2 h-2 text-amber-200" />
              </div>
              <div className="w-4 h-0.5 bg-amber-700/40 rounded-full" />
            </div>
          </div>
        );

      case 'elegant':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#f0fdf4',
              border: '3px solid #065f46',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid #10b981' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-emerald-700 flex items-center justify-center shadow-xs">
                <Award className="w-2.5 h-2.5 text-emerald-100" />
              </div>
              <div className="w-12 h-1 bg-emerald-800 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-emerald-950 rounded-full" />
              <div className="w-10 h-0.5 bg-emerald-500/60 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-emerald-300 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 border border-white flex items-center justify-center shadow-xs">
                <Star className="w-2 h-2 text-white fill-white" />
              </div>
              <div className="w-4 h-0.5 bg-emerald-300 rounded-full" />
            </div>
          </div>
        );

      case 'kids':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#fffbeb',
              border: '3px solid #f59e0b',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px dashed #ef4444' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow-xs">
                <Smile className="w-2.5 h-2.5 text-amber-950" />
              </div>
              <div className="w-12 h-1 bg-amber-600 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-amber-900 rounded-full" />
              <div className="w-10 h-0.5 bg-red-400 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-amber-300 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-red-500 border border-white flex items-center justify-center shadow-xs">
                <Star className="w-2 h-2 text-yellow-300 fill-yellow-300" />
              </div>
              <div className="w-4 h-0.5 bg-amber-300 rounded-full" />
            </div>
          </div>
        );

      case 'german_themed':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#fafafa',
              border: '3px solid #18181b',
              boxSizing: 'border-box'
            }}
          >
            {/* German Flag Tri-color Mini Accent */}
            <div className="absolute top-1 left-2 right-2 h-1 flex rounded-xs overflow-hidden">
              <div className="flex-1 bg-black" />
              <div className="flex-1 bg-red-600" />
              <div className="flex-1 bg-amber-400" />
            </div>
            <div className="relative z-10 flex flex-col items-center pt-1.5">
              <div className="w-4 h-4 rounded-full bg-slate-900 flex items-center justify-center shadow-xs">
                <Award className="w-2.5 h-2.5 text-amber-400" />
              </div>
              <div className="w-12 h-1 bg-red-700 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-black rounded-full" />
              <div className="w-10 h-0.5 bg-amber-500 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-slate-400 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-slate-900 flex items-center justify-center shadow-xs">
                <Award className="w-2 h-2 text-slate-900" />
              </div>
              <div className="w-4 h-0.5 bg-slate-400 rounded-full" />
            </div>
          </div>
        );

      case 'modern':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#ffffff',
              border: '3px solid #4f46e5',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid #818cf8' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-md bg-indigo-600 flex items-center justify-center shadow-xs">
                <Award className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="w-12 h-1 bg-indigo-700 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-slate-900 rounded-full" />
              <div className="w-10 h-0.5 bg-indigo-400 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-slate-300 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-md bg-indigo-600 border border-white flex items-center justify-center shadow-xs">
                <Star className="w-2 h-2 text-white fill-white" />
              </div>
              <div className="w-4 h-0.5 bg-slate-300 rounded-full" />
            </div>
          </div>
        );

      case 'boys':
      case 'boys_champion':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#0f172a',
              border: '3px solid #1d4ed8',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid #06b6d4' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center shadow-xs">
                <Shield className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="w-12 h-1 bg-cyan-400 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-white rounded-full" />
              <div className="w-10 h-0.5 bg-blue-400 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-slate-500 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-cyan-400 flex items-center justify-center shadow-xs">
                <Star className="w-2 h-2 text-yellow-300 fill-yellow-300" />
              </div>
              <div className="w-4 h-0.5 bg-slate-500 rounded-full" />
            </div>
          </div>
        );

      case 'girls':
      case 'girls_princess':
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#fff1f2',
              border: '3px solid #db2777',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid #f472b6' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-pink-500 flex items-center justify-center shadow-xs">
                <Crown className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="w-12 h-1 bg-pink-600 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-rose-950 rounded-full" />
              <div className="w-10 h-0.5 bg-pink-400 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-pink-300 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-pink-500 border border-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-2 h-2 text-yellow-200" />
              </div>
              <div className="w-4 h-0.5 bg-pink-300 rounded-full" />
            </div>
          </div>
        );

      case 'neutral':
      default:
        return (
          <div
            className="w-full h-full relative p-1.5 flex flex-col justify-between overflow-hidden select-none"
            style={{
              backgroundColor: '#f8fafc',
              border: '3px solid #1e3a8a',
              boxSizing: 'border-box'
            }}
          >
            <div className="absolute inset-1 pointer-events-none rounded-[2px]" style={{ border: '1px solid #d4af37' }} />
            <div className="relative z-10 flex flex-col items-center pt-0.5">
              <div className="w-4 h-4 rounded-full bg-blue-900 flex items-center justify-center shadow-xs">
                <Award className="w-2.5 h-2.5 text-amber-400" />
              </div>
              <div className="w-12 h-1 bg-blue-900 rounded-full mt-0.5" />
            </div>
            <div className="relative z-10 my-auto flex flex-col items-center gap-0.5">
              <div className="w-16 h-1.5 bg-slate-900 rounded-full" />
              <div className="w-10 h-0.5 bg-amber-500/70 rounded-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between px-1 pb-0.5">
              <div className="w-4 h-0.5 bg-slate-400 rounded-full" />
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white flex items-center justify-center shadow-xs">
                <Star className="w-2 h-2 text-blue-950 fill-blue-950" />
              </div>
              <div className="w-4 h-0.5 bg-slate-400 rounded-full" />
            </div>
          </div>
        );
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group p-2 rounded-2xl border text-start transition-all cursor-pointer relative flex flex-col justify-between gap-2 overflow-hidden ${
        isSelected
          ? 'bg-primary/5 dark:bg-primary-soft border-primary ring-2 ring-primary/30 shadow-md scale-[1.02]'
          : 'bg-surface dark:bg-slate-900 border-surface-border dark:border-slate-800 hover:border-primary/50 hover:shadow-sm'
      }`}
    >
      {/* Miniature Certificate Preview Frame */}
      <div className="relative aspect-[1.414/1] w-full rounded-xl overflow-hidden shadow-xs border border-slate-200/60 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-950 group-hover:scale-[1.02] transition-transform duration-200">
        {renderMiniatureCertificate()}

        {/* Selected Badge Overlay */}
        {isSelected && (
          <div className="absolute top-1.5 end-1.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md animate-scale-up">
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
        )}
      </div>

      {/* Label and Badge */}
      <div className="w-full">
        <span
          className={`block font-black text-xs truncate ${
            isSelected ? 'text-primary dark:text-primary-light' : 'text-text-main group-hover:text-primary'
          }`}
          title={name}
        >
          {name}
        </span>
      </div>
    </button>
  );
};
