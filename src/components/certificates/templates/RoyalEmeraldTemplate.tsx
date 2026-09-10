import React from 'react';
import { CertificateRecord } from '../../../types';
import { Award, Star, Crown } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const RoyalEmeraldTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم المعتمد' : certificate.language === 'de' ? 'Lehrkraft' : 'Authorized Instructor');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden shadow-2xl rounded-2xl ${isRtl ? 'font-arabic-serif' : 'font-cert-serif'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#032b24',
        color: '#ffffff',
        border: '10px solid #d4af37'
      }}
    >
      {/* Background Subtle Luxury Radial Glow */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.25) 0%, rgba(3, 43, 36, 0.95) 75%)'
        }}
      />

      {/* Decorative Ornate Gold Inner Borders */}
      <div 
        className="absolute inset-2 sm:inset-3 pointer-events-none rounded-xl"
        style={{ border: '2px solid rgba(212, 175, 55, 0.6)' }}
      />
      <div 
        className="absolute inset-4 sm:inset-5 pointer-events-none rounded-lg"
        style={{ border: '1px solid rgba(212, 175, 55, 0.3)' }}
      />

      {/* Ornate Gold Corner Filigree */}
      <div className="absolute top-5 left-5 w-8 h-8 pointer-events-none" style={{ borderTop: '2px solid #d4af37', borderLeft: '2px solid #d4af37' }} />
      <div className="absolute top-5 right-5 w-8 h-8 pointer-events-none" style={{ borderTop: '2px solid #d4af37', borderRight: '2px solid #d4af37' }} />
      <div className="absolute bottom-5 left-5 w-8 h-8 pointer-events-none" style={{ borderBottom: '2px solid #d4af37', borderLeft: '2px solid #d4af37' }} />
      <div className="absolute bottom-5 right-5 w-8 h-8 pointer-events-none" style={{ borderBottom: '2px solid #d4af37', borderRight: '2px solid #d4af37' }} />

      {/* Top Header Section */}
      <div className="text-center relative z-10 pt-2 sm:pt-4">
        {/* Imperial Crown & Gold Bar */}
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <div className="w-10 sm:w-20 h-[1.5px]" style={{ backgroundColor: '#d4af37' }} />
          <div 
            className="w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #fce08b 0%, #d4af37 50%, #996515 100%)',
              color: '#032b24'
            }}
          >
            <Crown className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#032b24' }} />
          </div>
          <div className="w-10 sm:w-20 h-[1.5px]" style={{ backgroundColor: '#d4af37' }} />
        </div>

        {/* Center / School Name */}
        {certificate.centerOrSchoolName && (
          <p 
            className={`text-[11px] sm:text-xs font-sans uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} font-bold mb-1`}
            style={{ color: '#fce08b' }}
          >
            {certificate.centerOrSchoolName}
          </p>
        )}

        {/* Certificate Title */}
        <h1 
          className={`text-2xl sm:text-4xl md:text-5xl font-black uppercase ${isRtl ? 'tracking-normal font-arabic-serif' : 'tracking-wider font-cert-serif'}`}
          style={{
            color: '#fce08b',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)'
          }}
        >
          {certificate.title || (certificate.language === 'ar' ? 'وسام التفوق والامتياز الملكي' : certificate.language === 'de' ? 'Königliche Ehrenurkunde' : 'Imperial Certificate of Excellence')}
        </h1>

        {certificate.subtitle && (
          <p 
            className="text-[11px] sm:text-sm font-semibold mt-1 max-w-xl mx-auto italic font-sans"
            style={{ color: '#a7f3d0' }}
          >
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body: Student Name */}
      <div className="text-center my-auto py-2 sm:py-4 relative z-10 w-full max-w-3xl mx-auto">
        <p 
          className={`text-[11px] sm:text-xs uppercase ${isRtl ? 'tracking-normal font-bold' : 'tracking-widest font-bold'} font-sans mb-2`}
          style={{ color: '#94a3b8' }}
        >
          {certificate.language === 'ar' ? 'تُمنح هذه الشهادة الملكية ببالغ الفخر والاعتزاز إلى' : certificate.language === 'de' ? 'Diese königliche Urkunde wird feierlich verliehen an' : 'This Royal Certificate is Conferred with Distinction Upon'}
        </p>

        {/* Recipient Name */}
        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={52}
            minFontSizePx={20}
            fontStyle="serif"
            className="font-bold py-1 sm:py-2"
            style={{
              color: '#ffffff',
              textShadow: '0 2px 10px rgba(212, 175, 55, 0.5)'
            }}
          />
          <div 
            className="h-[2px] mx-auto w-3/4 max-w-md rounded-full mt-1"
            style={{ background: 'linear-gradient(90deg, transparent 0%, #d4af37 50%, transparent 100%)' }}
          />
        </div>

        {/* Description / Praise Text */}
        <p 
          className="text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed mt-2 font-sans"
          style={{ color: '#e2e8f0' }}
        >
          {certificate.description || (certificate.language === 'ar' ? 'تقديرًا للمستوى المتميز والجهد الاستثنائي والإتقان الأكاديمي المشهود في تعلم اللغة الألمانية.' : certificate.language === 'de' ? 'In Würdigung herausragender akademischer Leistungen, vorbildlichen Fleißes und meisterhafter deutscher Sprachkompetenz.' : 'In recognition of outstanding academic achievements, persistent dedication, and mastery of the German language.')}
        </p>

        {/* Course / Level Tag */}
        {(certificate.courseName || certificate.level) && (
          <div className="inline-flex items-center gap-2 mt-3 px-4 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.4)', color: '#fce08b' }}>
            <span>{certificate.courseName || 'German Language Program'}</span>
            {certificate.level && <span>• {certificate.level}</span>}
          </div>
        )}
      </div>

      {/* Bottom Footer Section */}
      <div className="relative z-10 grid grid-cols-3 items-end gap-2 sm:gap-4 pt-2 border-t" style={{ borderColor: 'rgba(212, 175, 55, 0.3)' }}>
        {/* Date */}
        <div className="text-center sm:text-start flex flex-col justify-end">
          <p className="text-[9px] sm:text-xs uppercase font-sans font-bold" style={{ color: '#94a3b8' }}>
            {certificate.language === 'ar' ? 'تاريخ المنح' : certificate.language === 'de' ? 'Ausstellungsdatum' : 'Date of Issue'}
          </p>
          <p className="text-xs sm:text-sm font-semibold font-sans mt-0.5" style={{ color: '#fce08b' }}>
            {issueDateFormatted}
          </p>
        </div>

        {/* Center Imperial Medallion Seal */}
        <div className="flex flex-col items-center justify-center">
          <div 
            className="w-14 h-14 sm:w-18 sm:h-18 rounded-full flex flex-col items-center justify-center p-1 relative shadow-xl"
            style={{
              background: 'radial-gradient(circle, #fce08b 0%, #d4af37 60%, #996515 100%)',
              border: '2px dashed #032b24',
              color: '#032b24'
            }}
          >
            <Award className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: '#032b24' }} />
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter text-center leading-none mt-0.5">
              {certificate.badgeText || (certificate.language === 'ar' ? 'وسام ملكي' : certificate.language === 'de' ? 'KÖNIGLICH' : 'ROYAL')}
            </span>
          </div>
        </div>

        {/* Teacher Signature */}
        <div className="text-center sm:text-end flex flex-col items-center sm:items-end justify-end">
          <CertificateTeacherSignature
            teacherName={teacherName}
            isRtl={isRtl}
            language={certificate.language}
            signatureUrl={certificate.signatureUrl}
            title={isRtl ? 'المعلم المعتمد' : certificate.language === 'de' ? 'Lehrkraft' : 'Authorized Instructor'}
            className="max-w-[150px] sm:max-w-[200px]"
          />
        </div>
      </div>
    </div>
  );
};
