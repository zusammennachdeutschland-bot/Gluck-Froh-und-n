import React from 'react';
import { CertificateRecord } from '../../../types';
import { Award, Star, Sparkles } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface CustomAIBackgroundTemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const CustomAIBackgroundTemplate: React.FC<CustomAIBackgroundTemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor');
  
  const bgUrl = certificate.customBackgroundUrl || '';
  const textColorMode = certificate.customBackgroundTextColor || 'dark';

  // Determine text theme classes and styles based on contrast mode
  const isDarkTheme = textColorMode === 'light' || textColorMode === 'gold_on_dark';

  const titleColor = textColorMode === 'gold_on_dark'
    ? 'text-[#fef08a] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'
    : isDarkTheme
    ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]'
    : 'text-[#0f172a] drop-shadow-xs';

  const subtitleColor = isDarkTheme ? 'text-[#fde68a]' : 'text-[#78350f]';
  const labelColor = isDarkTheme ? 'text-[#94a3b8]' : 'text-[#64748b]';
  const bodyTextColor = isDarkTheme ? 'text-[#e2e8f0]' : 'text-[#334155]';
  const dividerColor = isDarkTheme ? 'from-transparent via-[#eab308] to-transparent' : 'from-transparent via-[#d4af37] to-transparent';
  const footerLineColor = isDarkTheme ? 'bg-white/40' : 'bg-[#0f172a]/60';
  const footerTextColor = isDarkTheme ? 'text-white' : 'text-[#0f172a]';
  const studentNameColor = isDarkTheme ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-bold' : 'text-[#0f172a] drop-shadow-xs font-bold';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] p-6 sm:p-10 md:p-12 flex flex-col justify-between select-none overflow-hidden rounded-2xl shadow-2xl ${isRtl ? 'font-arabic-serif' : 'font-cert-serif'}`}
      style={{
        boxSizing: 'border-box'
      }}
    >
      {/* Base AI Background Image Layer */}
      {bgUrl ? (
        <img
          src={bgUrl}
          alt="AI Designed Certificate Background"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none z-0"
          crossOrigin="anonymous"
        />
      ) : (
        /* Fallback if image is loading or missing */
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 z-0" />
      )}

      {/* Subtle Readability Vignette / Scrim (Ensures 100% WCAG contrast and readability) */}
      <div 
        className={`absolute inset-0 pointer-events-none z-[1] ${
          isDarkTheme 
            ? 'bg-black/20 backdrop-brightness-[0.96]' 
            : 'bg-white/10 backdrop-brightness-[1.02]'
        }`} 
      />

      {/* Top Header Section (Safe Zone: 20%) */}
      <div className="text-center relative z-10 pt-1 sm:pt-3">
        {/* Emblem or Badge Accent */}
        <div className="inline-flex items-center justify-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
          <div className={`w-8 sm:w-16 h-[1.5px] bg-gradient-to-r ${dividerColor}`} />
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-[#996515] via-[#d4af37] to-[#f7e49a] flex items-center justify-center text-white shadow-md">
            <Award className="w-4 h-4 sm:w-6 sm:h-6 drop-shadow" />
          </div>
          <div className={`w-8 sm:w-16 h-[1.5px] bg-gradient-to-l ${dividerColor}`} />
        </div>

        {/* School / Center / Academy Name */}
        {certificate.centerOrSchoolName && (
          <p className={`text-[10px] sm:text-xs font-sans uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} ${subtitleColor} font-bold mb-0.5`}>
            {certificate.centerOrSchoolName}
          </p>
        )}

        {/* Certificate Title */}
        <h1 className={`text-xl sm:text-3xl md:text-4xl font-black uppercase ${isRtl ? 'tracking-normal font-arabic-serif' : 'tracking-wider font-cert-serif'} ${titleColor}`}>
          {certificate.title || (certificate.language === 'ar' ? 'شهادة تقدير وتفوق' : certificate.language === 'de' ? 'Anerkennungsurkunde' : 'Certificate of Achievement')}
        </h1>

        {/* Subtitle */}
        {certificate.subtitle && (
          <p className={`text-[10px] sm:text-xs md:text-sm ${subtitleColor} font-semibold mt-0.5 max-w-xl mx-auto italic font-sans`}>
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body: Wide Safe Zone (35%) Dedicated for Student Name */}
      <div className="text-center my-auto py-1 sm:py-3 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-[10px] sm:text-xs ${labelColor} uppercase ${isRtl ? 'tracking-normal font-bold' : 'tracking-widest font-bold'} font-sans mb-1.5 sm:mb-2`}>
          {certificate.language === 'ar' 
            ? 'تُمنح هذه الشهادة بكل فخر واعتزاز إلى' 
            : certificate.language === 'de' 
            ? 'Diese Urkunde wird mit Stolz verliehen an' 
            : 'This Certificate is Proudly Presented To'}
        </p>

        {/* Auto-Fitting Student Name Hero Block */}
        <div className="my-1.5 sm:my-3 w-full px-4 sm:px-10">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={48}
            minFontSizePx={20}
            fontStyle="serif"
            className={studentNameColor}
          />
          {/* Dynamic Gold Underline Accent */}
          <div className={`w-40 sm:w-72 h-[2px] bg-gradient-to-r ${dividerColor} mx-auto mt-2 sm:mt-3 mb-1`} />
        </div>

        {/* Achievement Statement / Description */}
        <p className={`text-[11px] sm:text-sm md:text-base ${bodyTextColor} max-w-2xl mx-auto leading-relaxed font-sans font-medium px-4 mt-1.5 drop-shadow-xs`}>
          {certificate.description || (certificate.language === 'ar' 
            ? 'تقديرًا للجهود المتميزة والمثابرة العالية وتحقيق إنجازات استثنائية مشرفة.' 
            : certificate.language === 'de'
            ? 'In Anerkennung herausragender Leistungen, kontinuierlichen Engagements und vorbildlicher Fortschritte.'
            : 'In recognition of outstanding dedication, continuous commitment, and exemplary accomplishments.')}
        </p>

        {/* Score or Distinction Badge if Present */}
        {certificate.score && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 bg-[#fef9c3]/95 border border-[#facc15] text-[#854d0e] px-3.5 py-0.5 rounded-full text-xs font-sans font-bold shadow-xs">
            <Star className="w-3.5 h-3.5 fill-[#eab308] text-[#ca8a04]" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer Safe Zone (20%): Date, Seal Medallion, Teacher Signature */}
      <div className="flex items-end justify-between px-3 sm:px-10 pb-1 sm:pb-2 relative z-10 font-sans">
        {/* Date Block */}
        <div className="flex flex-col items-center text-center min-w-[100px] sm:min-w-[140px]">
          <div className={`h-6 sm:h-8 flex items-end justify-center px-2 pb-0.5 text-[11px] sm:text-sm font-bold ${footerTextColor} select-text drop-shadow-xs`}>
            {issueDateFormatted}
          </div>
          <div className={`w-24 sm:w-36 h-[1.5px] ${footerLineColor} my-0.5`} />
          <span className={`text-[8px] sm:text-[11px] ${labelColor} uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'التاريخ' : certificate.language === 'de' ? 'Datum' : 'Issue Date'}
          </span>
        </div>

        {/* Central Official Golden Seal */}
        <div className="hidden sm:flex flex-col items-center">
          <div className="w-12 h-12 sm:w-15 sm:h-15 rounded-full border-2 border-dashed border-[#d4af37] flex items-center justify-center p-1 bg-[#fffbeb]/90 shadow-sm backdrop-blur-xs">
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#b8860b] via-[#d4af37] to-[#fef08a] flex flex-col items-center justify-center text-[#451a03] text-[6.5px] font-black uppercase text-center leading-tight shadow-xs">
              <span className="tracking-widest font-bold">OFFICIAL</span>
              <span className="font-extrabold text-[7.5px]">★ SEAL ★</span>
              <span className="tracking-widest font-bold">HONORS</span>
            </div>
          </div>
        </div>

        {/* Teacher Signature Block */}
        <div className="flex flex-col items-center text-center min-w-[100px] sm:min-w-[140px]">
          <div className={`h-6 sm:h-8 flex items-end justify-center px-2 pb-0.5 ${footerTextColor}`}>
            <CertificateTeacherSignature name={teacherName} isRtl={isRtl} />
          </div>
          <div className={`w-24 sm:w-36 h-[1.5px] ${footerLineColor} my-0.5`} />
          <span className={`text-[8px] sm:text-[11px] ${labelColor} uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'توقيع المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Teacher Signature'}
          </span>
        </div>
      </div>
    </div>
  );
};
