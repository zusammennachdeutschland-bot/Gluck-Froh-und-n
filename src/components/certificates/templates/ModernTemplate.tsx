import React from 'react';
import { CertificateRecord } from '../../../types';
import { Sparkles, Award } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const ModernTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Teacher');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] bg-[#0f172a] text-[#f8fafc] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden rounded-2xl shadow-2xl border-[10px] border-[#1e293b] ${isRtl ? 'font-arabic-sans' : 'font-cert-sans'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#0f172a',
        color: '#f8fafc'
      }}
    >
      {/* Sleek Dual Gradient Border */}
      <div className="absolute inset-2 sm:inset-3 border border-[#6366f1]/40 rounded-xl pointer-events-none" />
      <div className="absolute inset-4 sm:inset-5 border border-[#334155] rounded-lg pointer-events-none" />

      {/* Modern Accent Corners */}
      <div className="absolute top-5 left-5 w-6 h-6 border-t-2 border-l-2 border-[#818cf8]" />
      <div className="absolute top-5 right-5 w-6 h-6 border-t-2 border-r-2 border-[#f472b6]" />
      <div className="absolute bottom-5 left-5 w-6 h-6 border-b-2 border-l-2 border-[#f472b6]" />
      <div className="absolute bottom-5 right-5 w-6 h-6 border-b-2 border-r-2 border-[#818cf8]" />

      {/* Header Section */}
      <div className="text-center relative z-10 pt-2 sm:pt-4">
        <div className={`inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#1e293b] border border-[#475569] text-[#a5b4fc] text-[10px] sm:text-xs uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} font-bold mb-2 shadow-xs`}>
          <Sparkles className="w-3.5 h-3.5 text-[#f472b6]" />
          <span>{certificate.customBadgeText || (certificate.language === 'ar' ? 'وسام التميز' : certificate.language === 'de' ? 'EHRENAUSZEICHNUNG' : 'HONOR ROLL')}</span>
          <Sparkles className="w-3.5 h-3.5 text-[#818cf8]" />
        </div>

        {/* School / Center */}
        {certificate.centerOrSchoolName && (
          <p className={`text-[11px] sm:text-xs uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} text-[#94a3b8] font-bold mb-1`}>
            {certificate.centerOrSchoolName}
          </p>
        )}

        <h1 className={`text-2xl sm:text-4xl md:text-5xl font-extrabold uppercase ${isRtl ? 'tracking-normal font-arabic-sans' : 'tracking-tight font-cert-sans'} text-[#ffffff] drop-shadow-sm`}>
          {certificate.title || (certificate.language === 'ar' ? 'شهادة تفوق وإنجاز' : certificate.language === 'de' ? 'Exzellenzzertifikat' : 'Certificate of Excellence')}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm text-[#94a3b8] font-medium mt-1 max-w-lg mx-auto">
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body: Student Name is the Absolute Focal Hero */}
      <div className="text-center my-auto py-2 sm:py-4 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-[11px] sm:text-xs text-[#94a3b8] uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} font-bold mb-2`}>
          {certificate.language === 'ar' ? 'تُمنح هذه الشهادة تقديرًا واعتزازًا إلى' : certificate.language === 'de' ? 'Diese Auszeichnung wird verliehen an' : 'Proudly presented in recognition to'}
        </p>

        {/* Student Recipient Name with Auto-Fit */}
        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={50}
            minFontSizePx={22}
            fontStyle="sans"
            className="text-[#38bdf8] drop-shadow-sm font-bold"
          />
          <div className="w-48 sm:w-80 h-[2px] bg-gradient-to-r from-transparent via-[#818cf8] to-transparent mx-auto mt-3 sm:mt-4 mb-1" />
        </div>

        {/* Description / Achievement text */}
        <p className="text-xs sm:text-base text-[#cbd5e1] max-w-xl mx-auto leading-relaxed px-4 font-normal mt-2">
          {certificate.description || (certificate.language === 'ar' ? 'تقديرًا للمثابرة والتفوق الدراسي والمشاركة الإيجابية المستمرة.' : 'in Anerkennung herausragender Leistungen, kontinuierlichen Engagements und vorbildlichen Verhaltens.')}
        </p>

        {/* Score or Custom badge if available */}
        {certificate.score && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-[#312e81] border border-[#6366f1] text-[#e0e7ff] px-3.5 py-1 rounded-full text-xs font-bold shadow-xs">
            <Award className="w-3.5 h-3.5 text-[#f472b6]" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between px-4 sm:px-12 pb-2 sm:pb-3 relative z-10 font-sans">
        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-1 text-xs sm:text-sm font-bold text-[#e2e8f0] select-text">
            {issueDateFormatted}
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-[#475569] my-1" />
          <span className={`text-[9px] sm:text-xs text-[#94a3b8] uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'التاريخ' : certificate.language === 'de' ? 'Datum' : 'Date'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#ec4899] flex items-center justify-center text-white shadow-md">
            <Award className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-0.5 text-[#38bdf8]">
            <CertificateTeacherSignature name={teacherName} isRtl={isRtl} />
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-[#475569] my-1" />
          <span className={`text-[9px] sm:text-xs text-[#94a3b8] uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`}>
            {certificate.language === 'ar' ? 'المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Teacher'}
          </span>
        </div>
      </div>
    </div>
  );
};
