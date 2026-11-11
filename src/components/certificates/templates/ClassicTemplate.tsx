import React from 'react';
import { CertificateRecord } from '../../../types';
import { Award, Star } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const ClassicTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] bg-[#faf8f5] text-[#0f172a] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden border-[12px] border-[#0f172a] shadow-2xl rounded-2xl ${isRtl ? 'font-arabic-serif' : 'font-cert-serif'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#faf8f5',
        color: '#0f172a'
      }}
    >
      {/* Decorative Gold Inset Borders */}
      <div className="absolute inset-2 sm:inset-3 border-2 border-[#d4af37] pointer-events-none rounded-xl" />
      <div className="absolute inset-4 sm:inset-5 border border-[#d4af37]/40 pointer-events-none rounded-lg" />

      {/* Traditional Corner Filigree Ornaments */}
      <div className="absolute top-5 left-5 w-7 h-7 border-t-2 border-l-2 border-[#d4af37]" />
      <div className="absolute top-5 right-5 w-7 h-7 border-t-2 border-r-2 border-[#d4af37]" />
      <div className="absolute bottom-5 left-5 w-7 h-7 border-b-2 border-l-2 border-[#d4af37]" />
      <div className="absolute bottom-5 right-5 w-7 h-7 border-b-2 border-r-2 border-[#d4af37]" />

      {/* Top Header Section */}
      <div className="text-center relative z-10 pt-2 sm:pt-4">
        {/* Emblem & Ribbon */}
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <div className="w-10 sm:w-20 h-[1.5px] bg-gradient-to-r from-transparent via-[#d4af37] to-[#d4af37]" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-[#996515] via-[#d4af37] to-[#f7e49a] flex items-center justify-center text-white shadow-md">
            <Award className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow" />
          </div>
          <div className="w-10 sm:w-20 h-[1.5px] bg-gradient-to-l from-transparent via-[#d4af37] to-[#d4af37]" />
        </div>

        {/* School / Center Name */}
        {certificate.centerOrSchoolName && (
          <p className={`text-[11px] sm:text-xs font-sans uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} text-[#854d0e] font-bold mb-1`}>
            {certificate.centerOrSchoolName}
          </p>
        )}

        {/* Certificate Title */}
        <h1 className={`text-2xl sm:text-4xl md:text-5xl font-black uppercase ${isRtl ? 'tracking-normal font-arabic-serif' : 'tracking-wider font-cert-serif'} text-[#0f172a] drop-shadow-xs`}>
          {certificate.title || (certificate.language === 'ar' ? 'شهادة إنجاز وتفوق' : certificate.language === 'de' ? 'Anerkennungsurkunde' : 'Certificate of Achievement')}
        </h1>

        {certificate.subtitle && (
          <p className="text-[11px] sm:text-sm text-[#78350f] font-semibold mt-1 max-w-xl mx-auto italic font-sans">
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body: Student Name is the Absolute Focal Hero */}
      <div className="text-center my-auto py-2 sm:py-4 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-[11px] sm:text-xs text-[#64748b] uppercase ${isRtl ? 'tracking-normal font-bold' : 'tracking-widest font-bold'} font-sans mb-2`}>
          {certificate.language === 'ar' ? 'تُمنح هذه الشهادة بكل فخر واعتزاز إلى' : certificate.language === 'de' ? 'Diese Urkunde wird mit Stolz verliehen an' : 'This Certificate is Proudly Presented To'}
        </p>

        {/* Recipient Name with Auto-Fit on Pristine Underline */}
        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={50}
            minFontSizePx={22}
            fontStyle="serif"
            className="text-[#0f172a] drop-shadow-xs font-bold"
          />
          {/* Ornate Gold Underline Divider */}
          <div className="w-48 sm:w-80 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mx-auto mt-3 sm:mt-4 mb-1" />
        </div>

        {/* Description / Achievement text */}
        <p className="text-xs sm:text-base text-[#334155] max-w-2xl mx-auto leading-relaxed font-sans font-medium px-4 mt-2">
          {certificate.description || (certificate.language === 'ar' ? 'تقديرًا للإخلاص في التعلم والتفوق الأكاديمي والتميز المستمر.' : 'In recognition of outstanding dedication, excellence, and exemplary accomplishments.')}
        </p>

        {/* Score or Custom badge if available */}
        {certificate.score && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-[#fef9c3] border border-[#facc15] text-[#854d0e] px-3.5 py-1 rounded-full text-xs font-sans font-bold shadow-xs">
            <Star className="w-3.5 h-3.5 fill-[#eab308] text-[#ca8a04]" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer: Date, Seal, Signatures */}
      <div className="flex items-end justify-between px-4 sm:px-12 pb-2 sm:pb-3 relative z-10 font-sans">
        {/* Date block */}
        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-1 text-xs sm:text-sm font-bold text-[#0f172a] select-text">
            {issueDateFormatted}
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-[#0f172a]/60 my-1" />
          <span className={`text-[9px] sm:text-xs text-[#64748b] uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'التاريخ' : certificate.language === 'de' ? 'Datum' : 'Issue Date'}
          </span>
        </div>

        {/* Official Gold Seal Medallion in Center */}
        <div className="hidden sm:flex flex-col items-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-[#d4af37] flex items-center justify-center p-1 bg-[#fffbeb] shadow-sm">
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#b8860b] via-[#d4af37] to-[#fef08a] flex flex-col items-center justify-center text-[#451a03] text-[7px] font-black uppercase text-center leading-tight shadow-xs">
              <span className="tracking-widest">OFFICIAL</span>
              <span className="font-extrabold text-[8px]">★ SEAL ★</span>
              <span className="tracking-widest">EXCELLENCE</span>
            </div>
          </div>
        </div>

        {/* Teacher Signature block */}
        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-0.5 text-[#0f172a]">
            <CertificateTeacherSignature name={teacherName} isRtl={isRtl} />
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-[#0f172a]/60 my-1" />
          <span className={`text-[9px] sm:text-xs text-[#64748b] uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'توقيع المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Teacher Signature'}
          </span>
        </div>
      </div>
    </div>
  );
};

