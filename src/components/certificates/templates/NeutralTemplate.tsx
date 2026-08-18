import React from 'react';
import { CertificateRecord } from '../../../types';
import { Award, Star, CheckCircle2 } from 'lucide-react';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const NeutralTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || new Date().toISOString().split('T')[0];

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative w-full aspect-[1.414/1] bg-[#fbf9f5] text-[#1e293b] p-6 sm:p-10 flex flex-col justify-between select-none overflow-hidden font-serif border-[12px] border-[#0f172a] shadow-2xl rounded-2xl"
      style={{
        boxSizing: 'border-box',
        backgroundImage: 'radial-gradient(#e2d9c8 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      {/* Decorative Gold Inset Border */}
      <div className="absolute inset-2 sm:inset-3 border-2 border-[#d4af37] pointer-events-none rounded-xl" />
      <div className="absolute inset-3 sm:inset-4 border border-[#d4af37]/40 pointer-events-none rounded-lg" />

      {/* Corner Ornaments */}
      <div className="absolute top-4 left-4 w-7 h-7 border-t-2 border-l-2 border-[#d4af37]" />
      <div className="absolute top-4 right-4 w-7 h-7 border-t-2 border-r-2 border-[#d4af37]" />
      <div className="absolute bottom-4 left-4 w-7 h-7 border-b-2 border-l-2 border-[#d4af37]" />
      <div className="absolute bottom-4 right-4 w-7 h-7 border-b-2 border-r-2 border-[#d4af37]" />

      {/* Header section */}
      <div className="text-center relative z-10 pt-2 sm:pt-4">
        <div className="inline-flex items-center justify-center gap-2 mb-2 sm:mb-3">
          <div className="w-8 sm:w-16 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#d4af37] via-[#b8860b] to-[#996515] flex items-center justify-center text-white shadow-md">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow" />
          </div>
          <div className="w-8 sm:w-16 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
        </div>

        <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold uppercase tracking-widest text-[#0f172a] drop-shadow-xs font-serif">
          {certificate.title || (certificate.language === 'ar' ? 'شهادة تقدير وتفوق' : certificate.language === 'de' ? 'Anerkennungsurkunde' : 'Certificate of Excellence')}
        </h1>

        {certificate.subtitle && (
          <p className="text-[11px] sm:text-sm text-[#78350f] font-semibold mt-1 max-w-xl mx-auto italic font-sans">
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body: Student Name is the Absolute Focal Hero */}
      <div className="text-center my-auto py-2 sm:py-4 relative z-10">
        <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest font-sans font-bold">
          {certificate.language === 'ar' ? 'تُمنح هذه الشهادة بكل فخر وتقدير إلى' : certificate.language === 'de' ? 'Diese Urkunde wird mit Stolz verliehen an' : 'This Certificate is Proudly Presented To'}
        </p>

        {/* Student Recipient Name - Huge Hero Element */}
        <div className="my-2 sm:my-3">
          <div className="inline-block border-b-3 border-[#d4af37] px-6 sm:px-14 pb-1.5 bg-white/60 rounded-t-lg shadow-2xs">
            <span className="text-3xl sm:text-5xl md:text-6xl font-black text-[#0f172a] tracking-tight font-serif drop-shadow-xs">
              {certificate.recipientName || certificate.studentName || 'Student Name'}
            </span>
          </div>
        </div>

        {/* Description / Achievement text */}
        <p className="text-xs sm:text-base text-slate-700 max-w-2xl mx-auto leading-relaxed font-sans font-medium px-4">
          {certificate.description || (certificate.language === 'ar' ? 'تقديرًا للجهود المتميزة والتفوق الدراسي والمشاركة الإيجابية.' : 'in Anerkennung herausragender Leistungen, kontinuierlichen Engagements und vorbildlichen Verhaltens.')}
        </p>

        {/* Score or Custom badge if available */}
        {certificate.score && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 bg-[#d4af37]/15 border border-[#d4af37]/50 text-[#854d0e] px-3.5 py-1 rounded-full text-[10px] sm:text-xs font-sans font-bold shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer: Date & Signatures */}
      <div className="flex items-end justify-between px-4 sm:px-10 pb-2 relative z-10 font-sans">
        {/* Date block */}
        <div className="text-center min-w-[100px] sm:min-w-[140px] bg-white/80 p-2 rounded-xl border border-slate-200 shadow-2xs">
          <div className="border-b border-slate-300 pb-1 mb-1 text-[11px] sm:text-sm font-bold text-slate-800">
            {issueDateFormatted}
          </div>
          <span className="text-[9px] sm:text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
            {certificate.language === 'ar' ? 'التاريخ' : certificate.language === 'de' ? 'Datum' : 'Issue Date'}
          </span>
        </div>

        {/* Seal Badge in Center */}
        <div className="hidden sm:flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-[#d4af37] flex items-center justify-center p-1 bg-white/80 shadow-xs">
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#b8860b] to-[#d4af37] flex flex-col items-center justify-center text-white text-[7px] font-black uppercase text-center leading-tight">
              <span>OFFICIAL</span>
              <span>HONOR</span>
            </div>
          </div>
        </div>

        {/* Teacher Signature block */}
        <div className="text-center min-w-[100px] sm:min-w-[140px] bg-white/80 p-2 rounded-xl border border-slate-200 shadow-2xs">
          <div className="border-b border-slate-300 pb-1 mb-1 text-[11px] sm:text-sm font-bold text-slate-800 font-serif italic">
            {certificate.teacherName || certificate.instructorName || 'Instructor'}
          </div>
          <span className="text-[9px] sm:text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
            {certificate.language === 'ar' ? 'توقيع المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Teacher Signature'}
          </span>
        </div>
      </div>
    </div>
  );
};
