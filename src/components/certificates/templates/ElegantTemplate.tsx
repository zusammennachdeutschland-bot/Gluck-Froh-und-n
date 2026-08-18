import React from 'react';
import { CertificateRecord } from '../../../types';
import { Sparkles, Trophy } from 'lucide-react';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const ElegantTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || new Date().toISOString().split('T')[0];

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative w-full aspect-[1.414/1] bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#022c22] text-white p-6 sm:p-10 flex flex-col justify-between select-none overflow-hidden font-sans border-[10px] border-[#042f2e] shadow-2xl"
    >
      {/* Decorative Gold & Emerald Framing */}
      <div className="absolute inset-2 sm:inset-3 border border-[#34d399]/30 pointer-events-none" />
      <div className="absolute inset-4 sm:inset-5 border-2 border-[#d97706]/60 pointer-events-none rounded-lg" />

      {/* Modern geometric corners */}
      <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-[#fbbf24]" />
      <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-[#fbbf24]" />
      <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-[#fbbf24]" />
      <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-[#fbbf24]" />

      {/* Subtle backdrop glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center relative z-10 pt-2 sm:pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[10px] sm:text-xs uppercase tracking-widest font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{certificate.customBadgeText || 'SPECIAL RECOGNITION'}</span>
          <Sparkles className="w-3.5 h-3.5" />
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md">
          {certificate.title || 'Certificate of Excellence'}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm text-emerald-200/90 font-medium mt-1 max-w-lg mx-auto">
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Recipient */}
      <div className="text-center my-auto py-2 sm:py-3 relative z-10">
        <p className="text-[10px] sm:text-xs text-emerald-200/80 uppercase tracking-widest font-semibold">
          {certificate.language === 'ar' ? 'يُمنح هذا التكريم إلى' : certificate.language === 'de' ? 'Diese Auszeichnung erhält' : 'This Honor is Conferred Upon'}
        </p>

        <div className="my-2 sm:my-3">
          <span className="inline-block text-3xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent drop-shadow-md px-4 font-serif">
            {certificate.recipientName || certificate.studentName || 'Student Name'}
          </span>
          <div className="w-36 sm:w-72 h-[2.5px] bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mt-1" />
        </div>

        <p className="text-xs sm:text-base text-emerald-100/90 max-w-xl mx-auto leading-relaxed px-4 font-normal">
          {certificate.description || 'For demonstrating superior proficiency, exemplary conduct, and exceptional mastery.'}
        </p>

        {certificate.score && (
          <div className="mt-2.5 inline-flex items-center gap-1 bg-amber-400 text-slate-950 font-black px-3 py-0.5 rounded-md text-[10px] sm:text-xs shadow-md">
            <Trophy className="w-3 h-3" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between px-4 sm:px-12 pb-2 relative z-10">
        <div className="text-center min-w-[100px] sm:min-w-[140px]">
          <div className="border-b border-emerald-400/40 pb-1 mb-1 text-[11px] sm:text-sm font-bold text-emerald-100">
            {issueDateFormatted}
          </div>
          <span className="text-[9px] sm:text-[11px] text-emerald-300/80 uppercase tracking-wider font-semibold">
            {certificate.language === 'ar' ? 'التاريخ' : certificate.language === 'de' ? 'Datum' : 'Date'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-xs shadow-lg">
            <Trophy className="w-6 h-6 text-slate-950" />
          </div>
        </div>

        <div className="text-center min-w-[100px] sm:min-w-[140px]">
          <div className="border-b border-emerald-400/40 pb-1 mb-1 text-[11px] sm:text-sm font-bold text-emerald-100 italic">
            {certificate.teacherName || 'Instructor'}
          </div>
          <span className="text-[9px] sm:text-[11px] text-emerald-300/80 uppercase tracking-wider font-semibold">
            {certificate.language === 'ar' ? 'المعلم المشرف' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor'}
          </span>
        </div>
      </div>
    </div>
  );
};
