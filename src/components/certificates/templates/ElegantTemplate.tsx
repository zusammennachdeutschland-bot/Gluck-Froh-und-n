import React from 'react';
import { CertificateRecord } from '../../../types';
import { Sparkles, Trophy } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const ElegantTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم المشرف' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] bg-[#042f2e] text-[#f8fafc] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden border-[12px] border-[#021f1e] shadow-2xl rounded-2xl ${isRtl ? 'font-arabic-serif' : 'font-cert-serif'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#042f2e',
        color: '#f8fafc'
      }}
    >
      {/* Decorative Gold Framing */}
      <div className="absolute inset-2 sm:inset-3 border-2 border-[#d97706]/70 pointer-events-none rounded-xl" />
      <div className="absolute inset-4 sm:inset-5 border border-[#fbbf24]/30 pointer-events-none rounded-lg" />

      {/* Modern Gold Geometric Corners */}
      <div className="absolute top-5 left-5 w-7 h-7 border-t-2 border-l-2 border-[#fbbf24]" />
      <div className="absolute top-5 right-5 w-7 h-7 border-t-2 border-r-2 border-[#fbbf24]" />
      <div className="absolute bottom-5 left-5 w-7 h-7 border-b-2 border-l-2 border-[#fbbf24]" />
      <div className="absolute bottom-5 right-5 w-7 h-7 border-b-2 border-r-2 border-[#fbbf24]" />

      {/* Header Section */}
      <div className="text-center relative z-10 pt-2 sm:pt-4">
        <div className={`inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#064e3b] border border-[#fbbf24]/50 text-[#fde047] text-[10px] sm:text-xs uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} font-bold mb-2 shadow-xs font-sans`}>
          <Sparkles className="w-3.5 h-3.5" />
          <span>{certificate.customBadgeText || (certificate.language === 'ar' ? 'وسام التميز والشرف' : certificate.language === 'de' ? 'BESONDERE ANERKENNUNG' : 'SPECIAL RECOGNITION')}</span>
          <Sparkles className="w-3.5 h-3.5" />
        </div>

        {/* School/Center Name */}
        {certificate.centerOrSchoolName && (
          <p className={`text-[11px] sm:text-xs font-sans uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} text-[#a7f3d0] font-bold mb-1`}>
            {certificate.centerOrSchoolName}
          </p>
        )}

        <h1 className={`text-2xl sm:text-4xl md:text-5xl font-extrabold ${isRtl ? 'tracking-normal font-arabic-serif' : 'tracking-tight font-cert-serif'} text-[#ffffff] drop-shadow-md`}>
          {certificate.title || (certificate.language === 'ar' ? 'شهادة التميز والتفوق' : certificate.language === 'de' ? 'Exzellenzzertifikat' : 'Certificate of Excellence')}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm text-[#a7f3d0] font-medium mt-1 max-w-lg mx-auto font-sans">
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Recipient Center Hero */}
      <div className="text-center my-auto py-2 sm:py-4 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-[11px] sm:text-xs text-[#6ee7b7] uppercase ${isRtl ? 'tracking-normal font-bold' : 'tracking-widest font-semibold'} font-sans mb-2`}>
          {certificate.language === 'ar' ? 'يُمنح هذا التكريم والتقدير إلى' : certificate.language === 'de' ? 'Diese Auszeichnung erhält' : 'This Honor is Conferred Upon'}
        </p>

        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={50}
            minFontSizePx={22}
            fontStyle="serif"
            className="text-[#fbbf24] drop-shadow-md font-bold"
          />
          <div className="w-48 sm:w-80 h-[2px] bg-gradient-to-r from-transparent via-[#fbbf24] to-transparent mx-auto mt-3 sm:mt-4 mb-1" />
        </div>

        <p className="text-xs sm:text-base text-[#ecfdf5] max-w-xl mx-auto leading-relaxed px-4 font-normal mt-2 font-sans">
          {certificate.description || (certificate.language === 'ar' ? 'تقديرًا للإتقان البارع، والسلوك النموذجي، والتحصيل الدراسي الاستثنائي.' : 'For demonstrating superior proficiency, exemplary conduct, and exceptional mastery.')}
        </p>

        {certificate.score && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-[#fbbf24] text-[#022c22] font-black px-3.5 py-1 rounded-full text-xs shadow-md font-sans">
            <Trophy className="w-3.5 h-3.5" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between px-4 sm:px-12 pb-2 sm:pb-3 relative z-10 font-sans">
        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-1 text-xs sm:text-sm font-bold text-[#ecfdf5] select-text">
            {issueDateFormatted}
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-[#fbbf24]/60 my-1" />
          <span className={`text-[9px] sm:text-xs text-[#a7f3d0] uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'التاريخ' : certificate.language === 'de' ? 'Datum' : 'Date'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#d97706] to-[#fef08a] flex items-center justify-center text-[#022c22] font-black text-xs shadow-lg">
            <Trophy className="w-6 h-6 text-[#022c22]" />
          </div>
        </div>

        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-0.5 text-[#fbbf24]">
            <CertificateTeacherSignature name={teacherName} isRtl={isRtl} />
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-[#fbbf24]/60 my-1" />
          <span className={`text-[9px] sm:text-xs text-[#a7f3d0] uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'المعلم المشرف' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor'}
          </span>
        </div>
      </div>
    </div>
  );
};
