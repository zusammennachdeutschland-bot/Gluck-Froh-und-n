import React from 'react';
import { CertificateRecord } from '../../../types';
import { Award, CheckCircle2 } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const GermanThemedTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Schüler/in';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم' : certificate.language === 'de' ? 'Fachlehrkraft' : 'Instructor');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] bg-[#ffffff] text-[#1c1917] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden border-[10px] border-[#18181b] shadow-2xl rounded-2xl ${isRtl ? 'font-arabic-sans' : 'font-cert-sans'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#1c1917'
      }}
    >
      {/* Germany National Tricolor Ribbon Stripe at Top and Bottom */}
      <div className="absolute top-0 left-0 right-0 h-3.5 flex">
        <div className="flex-1 bg-[#18181b]" />
        <div className="flex-1 bg-[#dc2626]" />
        <div className="flex-1 bg-[#f59e0b]" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-3.5 flex">
        <div className="flex-1 bg-[#18181b]" />
        <div className="flex-1 bg-[#dc2626]" />
        <div className="flex-1 bg-[#f59e0b]" />
      </div>

      {/* Frame Insets */}
      <div className="absolute inset-3 sm:inset-4 border border-stone-200 pointer-events-none rounded-xl" />
      <div className="absolute inset-4 sm:inset-5 border-2 border-stone-800/20 pointer-events-none rounded-lg" />

      {/* Header Section */}
      <div className="text-center relative z-10 pt-3 sm:pt-4">
        <div className="inline-flex items-center gap-2 mb-2">
          {certificate.centerOrSchoolName && (
            <span className={`text-[10px] sm:text-xs font-black ${isRtl ? 'tracking-normal' : 'tracking-widest'} uppercase bg-stone-900 text-white px-3 py-0.5 rounded-xs`}>
              {certificate.centerOrSchoolName}
            </span>
          )}
          <span className={`text-[10px] sm:text-xs font-black text-red-600 ${isRtl ? 'tracking-normal' : 'tracking-wider'}`}>
            • {certificate.customBadgeText || (certificate.language === 'ar' ? 'شهادة تقدير وتكريم' : 'EHRENURKUNDE')} •
          </span>
        </div>

        <h1 className={`text-2xl sm:text-4xl md:text-5xl font-black uppercase ${isRtl ? 'tracking-normal font-arabic-sans' : 'tracking-tight font-cert-sans'} text-stone-900`}>
          {certificate.title || (certificate.language === 'ar' ? 'شهادة إتقان اللغة الألمانية' : 'Deutsches Sprachzertifikat')}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm text-stone-600 font-semibold mt-1 max-w-xl mx-auto">
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body with Auto-Fit */}
      <div className="text-center my-auto py-2 sm:py-4 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-[11px] sm:text-xs text-stone-500 uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} font-bold mb-2`}>
          {certificate.language === 'ar' ? 'يُمنح هذا التكريم والتقدير للطالب / الطالبة' : certificate.language === 'de' ? 'Hiermit wird bescheinigt, dass' : 'This is officially conferred upon'}
        </p>

        {/* Recipient Name with Clean Tricolor Underline */}
        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={50}
            minFontSizePx={22}
            fontStyle="serif"
            className="text-stone-900 font-bold"
          />
          <div className="w-48 sm:w-80 h-[2.5px] bg-gradient-to-r from-transparent via-[#dc2626] to-transparent mx-auto mt-3 sm:mt-4 mb-1" />
        </div>

        <p className="text-xs sm:text-base text-stone-700 max-w-2xl mx-auto leading-relaxed px-4 font-normal mt-2">
          {certificate.description || (certificate.language === 'ar' ? 'تقديرًا للمستوى المتميز والتحصيل العلمي الرائع في دراسة اللغة الألمانية.' : 'in Anerkennung hervorragender Sprachkenntnisse und kontinuierlichen Erfolgs im Deutschunterricht.')}
        </p>

        {certificate.score && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-stone-100 border border-stone-300 text-stone-900 px-3.5 py-1 rounded-xs text-xs font-bold shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between px-4 sm:px-12 pb-2 sm:pb-3 relative z-10 font-sans">
        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-1 text-xs sm:text-sm font-bold text-stone-900 select-text">
            {issueDateFormatted}
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-stone-800/70 my-1" />
          <span className={`text-[9px] sm:text-xs text-stone-500 uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'تاريخ الإصدار' : certificate.language === 'de' ? 'Ausstellungsdatum' : 'Date Issued'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-2 border-stone-900 flex items-center justify-center p-1 bg-amber-400/20 shadow-xs">
            <Award className="w-6 h-6 text-stone-900" />
          </div>
        </div>

        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-0.5 text-stone-900">
            <CertificateTeacherSignature name={teacherName} isRtl={isRtl} />
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-stone-800/70 my-1" />
          <span className={`text-[9px] sm:text-xs text-stone-500 uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'توقيع المعلم' : certificate.language === 'de' ? 'Unterschrift Lehrkraft' : 'Teacher Signature'}
          </span>
        </div>
      </div>
    </div>
  );
};
