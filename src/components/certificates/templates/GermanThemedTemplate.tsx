import React from 'react';
import { CertificateRecord } from '../../../types';
import { Award, CheckCircle2 } from 'lucide-react';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const GermanThemedTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || new Date().toISOString().split('T')[0];

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative w-full aspect-[1.414/1] bg-[#ffffff] text-[#1c1917] p-6 sm:p-10 flex flex-col justify-between select-none overflow-hidden font-sans border-[10px] border-[#18181b] shadow-2xl"
    >
      {/* Germany National Tricolor Ribbon Stripe at Top and Bottom */}
      <div className="absolute top-0 left-0 right-0 h-3 flex">
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-[#dc2626]" />
        <div className="flex-1 bg-[#f59e0b]" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-3 flex">
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-[#dc2626]" />
        <div className="flex-1 bg-[#f59e0b]" />
      </div>

      {/* Frame Insets */}
      <div className="absolute inset-3 sm:inset-4 border border-stone-200 pointer-events-none" />
      <div className="absolute inset-4 sm:inset-5 border-2 border-[#18181b]/15 pointer-events-none" />

      {/* Header Section */}
      <div className="text-center relative z-10 pt-3 sm:pt-4">
        <div className="inline-flex items-center gap-2 mb-2">
          {certificate.centerOrSchoolName && (
            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase bg-stone-900 text-white px-3 py-0.5 rounded-sm">
              {certificate.centerOrSchoolName}
            </span>
          )}
          <span className="text-[10px] sm:text-xs font-bold text-red-600 tracking-wider">
            • EHRENURKUNDE •
          </span>
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-stone-900">
          {certificate.title || 'Deutsches Sprachzertifikat'}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm text-stone-600 font-semibold mt-1 max-w-xl mx-auto">
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body */}
      <div className="text-center my-auto py-2 relative z-10">
        <p className="text-[10px] sm:text-xs text-stone-500 uppercase tracking-widest font-bold">
          {certificate.language === 'ar' ? 'يُمنح هذا التكرير والتقدير للطالب / الطالبة' : certificate.language === 'de' ? 'Hiermit wird bescheinigt, dass' : 'This is officially conferred upon'}
        </p>

        <div className="my-2 sm:my-3">
          <div className="inline-block bg-stone-50 border-b-4 border-red-600 px-8 sm:px-16 py-2 shadow-xs rounded-xs">
            <span className="text-3xl sm:text-5xl md:text-6xl font-black text-stone-900 tracking-tight font-serif">
              {certificate.recipientName || certificate.studentName || 'Schüler/in'}
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-base text-stone-700 max-w-2xl mx-auto leading-relaxed px-4 font-normal">
          {certificate.description || 'in Anerkennung hervorragender Sprachkenntnisse und kontinuierlichen Erfolgs im Deutschunterricht.'}
        </p>

        {certificate.score && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 bg-stone-100 border border-stone-300 text-stone-900 px-3 py-1 rounded-sm text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between px-4 sm:px-12 pb-2 relative z-10 font-sans">
        <div className="text-center min-w-[100px] sm:min-w-[140px]">
          <div className="border-b border-stone-400 pb-1 mb-1 text-[11px] sm:text-sm font-bold text-stone-900">
            {issueDateFormatted}
          </div>
          <span className="text-[9px] sm:text-[11px] text-stone-500 uppercase tracking-wider font-semibold">
            {certificate.language === 'ar' ? 'تاريخ الإصدار' : certificate.language === 'de' ? 'Ausstellungsdatum' : 'Date Issued'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-2 border-stone-900 flex items-center justify-center p-1 bg-amber-400/20">
            <Award className="w-6 h-6 text-stone-900" />
          </div>
        </div>

        <div className="text-center min-w-[100px] sm:min-w-[140px]">
          <div className="border-b border-stone-400 pb-1 mb-1 text-[11px] sm:text-sm font-bold text-stone-900 italic font-serif">
            {certificate.teacherName || 'Fachlehrer/in'}
          </div>
          <span className="text-[9px] sm:text-[11px] text-stone-500 uppercase tracking-wider font-semibold">
            {certificate.language === 'ar' ? 'توقيع مدرس المادة' : certificate.language === 'de' ? 'Unterschrift Lehrkraft' : 'Instructor Signature'}
          </span>
        </div>
      </div>
    </div>
  );
};
