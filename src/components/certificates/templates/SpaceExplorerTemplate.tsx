import React from 'react';
import { CertificateRecord } from '../../../types';
import { Rocket, Star, Sparkles } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const SpaceExplorerTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden shadow-2xl rounded-2xl ${isRtl ? 'font-arabic-sans' : 'font-sans'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#070b1e',
        color: '#ffffff',
        border: '10px solid #1e293b'
      }}
    >
      {/* Deep Galaxy Atmosphere */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.25) 0%, rgba(7, 11, 30, 0.95) 70%), radial-gradient(ellipse at 20% 80%, rgba(236, 72, 153, 0.2) 0%, rgba(7, 11, 30, 0.95) 70%)'
        }}
      />

      {/* Futuristic Cosmic Border */}
      <div 
        className="absolute inset-3 sm:inset-4 pointer-events-none rounded-xl"
        style={{ border: '2px solid rgba(129, 140, 248, 0.5)' }}
      />
      <div 
        className="absolute inset-5 sm:inset-6 pointer-events-none rounded-lg"
        style={{ border: '1px dashed rgba(244, 114, 182, 0.35)' }}
      />

      {/* Decorative Star Constellation Dots */}
      <div className="absolute top-8 left-10 w-2 h-2 rounded-full" style={{ backgroundColor: '#facc15', boxShadow: '0 0 8px #facc15' }} />
      <div className="absolute top-16 left-28 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
      <div className="absolute top-12 right-16 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f472b6', boxShadow: '0 0 10px #f472b6' }} />
      <div className="absolute bottom-20 left-16 w-2 h-2 rounded-full" style={{ backgroundColor: '#a78bfa', boxShadow: '0 0 8px #a78bfa' }} />
      <div className="absolute bottom-12 right-20 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#facc15', boxShadow: '0 0 6px #facc15' }} />

      {/* Top Header Section */}
      <div className="text-center relative z-10 pt-2 sm:pt-4">
        {/* Rocket Badge */}
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <div className="w-10 sm:w-16 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent 0%, #38bdf8 100%)' }} />
          <div 
            className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
              color: '#ffffff',
              boxShadow: '0 0 15px rgba(168, 85, 247, 0.5)'
            }}
          >
            <Rocket className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#ffffff' }} />
          </div>
          <div className="w-10 sm:w-16 h-[2px]" style={{ background: 'linear-gradient(90deg, #ec4899 0%, transparent 100%)' }} />
        </div>

        {/* Center / School Name */}
        {certificate.centerOrSchoolName && (
          <p 
            className={`text-[11px] sm:text-xs uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} font-bold mb-1`}
            style={{ color: '#38bdf8' }}
          >
            {certificate.centerOrSchoolName}
          </p>
        )}

        {/* Certificate Title */}
        <h1 
          className={`text-2xl sm:text-4xl md:text-5xl font-black uppercase ${isRtl ? 'tracking-normal font-arabic-sans' : 'tracking-wide'}`}
          style={{
            color: '#ffffff',
            textShadow: '0 0 16px rgba(129, 140, 248, 0.7)'
          }}
        >
          {certificate.title || (certificate.language === 'ar' ? 'وسام رائد الفضاء والتميز اللغوي' : certificate.language === 'de' ? 'Urkunde: Kosmischer Sprachpionier' : 'Cosmic Language Explorer Award')}
        </h1>

        {certificate.subtitle && (
          <p 
            className="text-[11px] sm:text-sm font-semibold mt-1 max-w-xl mx-auto italic"
            style={{ color: '#f472b6' }}
          >
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body: Student Name */}
      <div className="text-center my-auto py-2 sm:py-4 relative z-10 w-full max-w-3xl mx-auto">
        <p 
          className={`text-[11px] sm:text-xs uppercase ${isRtl ? 'tracking-normal font-bold' : 'tracking-widest font-bold'} mb-2`}
          style={{ color: '#94a3b8' }}
        >
          {certificate.language === 'ar' ? 'تُهدى هذه الشارة الكونية المضيئة إلى المبدع' : certificate.language === 'de' ? 'Dieser leuchtende kosmische Stern wird verliehen an' : 'This Brilliant Star Award is Presented To'}
        </p>

        {/* Recipient Name */}
        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={52}
            minFontSizePx={20}
            fontStyle="sans"
            className="font-black py-1 sm:py-2"
            style={{
              color: '#facc15',
              textShadow: '0 0 12px rgba(250, 204, 21, 0.6)'
            }}
          />
          <div 
            className="h-[2px] mx-auto w-3/4 max-w-md rounded-full mt-1"
            style={{ background: 'linear-gradient(90deg, transparent 0%, #38bdf8 30%, #f472b6 70%, transparent 100%)' }}
          />
        </div>

        {/* Description / Praise Text */}
        <p 
          className="text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed mt-2"
          style={{ color: '#e2e8f0' }}
        >
          {certificate.description || (certificate.language === 'ar' ? 'تقديرًا للشغف العلمي والذكاء المتقد والنجاح الباهر في رحلة اكتشاف وتعلم اللغة الألمانية كالشهاب المتألق.' : certificate.language === 'de' ? 'In Anerkennung von Neugierde, brillanten Fortschritten und herausragendem Entdeckergeist beim Deutschlernen.' : 'In recognition of boundless curiosity, radiant energy, and stellar achievements in exploring the German language.')}
        </p>

        {/* Course / Level Tag */}
        {(certificate.courseName || certificate.level) && (
          <div className="inline-flex items-center gap-2 mt-3 px-4 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} />
            <span>{certificate.courseName || 'Cosmic German Academy'}</span>
            {certificate.level && <span>• {certificate.level}</span>}
          </div>
        )}
      </div>

      {/* Bottom Footer Section */}
      <div className="relative z-10 grid grid-cols-3 items-end gap-2 sm:gap-4 pt-2 border-t" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
        {/* Date */}
        <div className="text-center sm:text-start flex flex-col justify-end">
          <p className="text-[9px] sm:text-xs uppercase font-bold" style={{ color: '#94a3b8' }}>
            {certificate.language === 'ar' ? 'تاريخ التكريم' : certificate.language === 'de' ? 'Sternzeit / Datum' : 'Date of Award'}
          </p>
          <p className="text-xs sm:text-sm font-semibold mt-0.5" style={{ color: '#38bdf8' }}>
            {issueDateFormatted}
          </p>
        </div>

        {/* Center Star Ribbon Badge */}
        <div className="flex flex-col items-center justify-center">
          <div 
            className="w-14 h-14 sm:w-18 sm:h-18 rounded-full flex flex-col items-center justify-center p-1 relative shadow-xl"
            style={{
              background: 'radial-gradient(circle, #facc15 0%, #eab308 60%, #ca8a04 100%)',
              border: '2px dashed #070b1e',
              color: '#070b1e',
              boxShadow: '0 0 15px rgba(250, 204, 21, 0.4)'
            }}
          >
            <Star className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: '#070b1e', fill: '#070b1e' }} />
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter text-center leading-none mt-0.5">
              {certificate.badgeText || (certificate.language === 'ar' ? 'نجم ساطع' : certificate.language === 'de' ? 'STERN' : 'SUPERSTAR')}
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
            title={isRtl ? 'المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor'}
            className="max-w-[150px] sm:max-w-[200px]"
          />
        </div>
      </div>
    </div>
  );
};
