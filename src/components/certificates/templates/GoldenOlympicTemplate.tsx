import React from 'react';
import { CertificateRecord } from '../../../types';
import { Trophy, Star, Sparkles } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const GoldenOlympicTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden shadow-2xl rounded-2xl ${isRtl ? 'font-arabic-serif' : 'font-cert-serif'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#fffdf5',
        color: '#1e1b18',
        border: '14px solid #d4af37'
      }}
    >
      {/* Radiant Olympic Aura */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 35%, rgba(254, 240, 138, 0.35) 0%, rgba(255, 253, 245, 0.95) 75%)'
        }}
      />

      {/* Double Olympic Filigree Borders */}
      <div
        className="absolute inset-3 sm:inset-4 pointer-events-none rounded-xl"
        style={{ border: '2px solid #b48316' }}
      />
      <div
        className="absolute inset-5 sm:inset-6 pointer-events-none rounded-lg"
        style={{ border: '1px dashed #ca8a04' }}
      />

      {/* Greek Key / Laurel Corner Elements */}
      <div className="absolute top-7 left-7 w-8 h-8 pointer-events-none" style={{ borderTop: '3px double #b48316', borderLeft: '3px double #b48316' }} />
      <div className="absolute top-7 right-7 w-8 h-8 pointer-events-none" style={{ borderTop: '3px double #b48316', borderRight: '3px double #b48316' }} />
      <div className="absolute bottom-7 left-7 w-8 h-8 pointer-events-none" style={{ borderBottom: '3px double #b48316', borderLeft: '3px double #b48316' }} />
      <div className="absolute bottom-7 right-7 w-8 h-8 pointer-events-none" style={{ borderBottom: '3px double #b48316', borderRight: '3px double #b48316' }} />

      {/* Top Header Section */}
      <div className="text-center relative z-10 pt-2 sm:pt-3">
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <div className="w-10 sm:w-20 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent 0%, #ca8a04 100%)' }} />
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #fef08a 0%, #eab308 50%, #ca8a04 100%)',
              color: '#78350f',
              border: '2px solid #ffffff'
            }}
          >
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow" />
          </div>
          <div className="w-10 sm:w-20 h-[2px]" style={{ background: 'linear-gradient(90deg, #ca8a04 0%, transparent 100%)' }} />
        </div>

        {certificate.centerOrSchoolName && (
          <p className={`text-[11px] sm:text-xs uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} font-bold mb-1`} style={{ color: '#854d0e' }}>
            {certificate.centerOrSchoolName}
          </p>
        )}

        <h1
          className={`text-2xl sm:text-4xl md:text-5xl font-black uppercase ${isRtl ? 'tracking-normal font-arabic-serif' : 'tracking-wider font-cert-serif'} drop-shadow-xs`}
          style={{ color: '#854d0e' }}
        >
          {certificate.title || (certificate.language === 'ar' ? 'وسام التفوق والذهب الأولمبي' : certificate.language === 'de' ? 'Goldene Ehrenurkunde' : 'Olympic Gold Award')}
        </h1>

        {certificate.subtitle && (
          <p className="text-[11px] sm:text-sm font-semibold mt-1 max-w-xl mx-auto italic" style={{ color: '#a16207' }}>
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body: Student Name */}
      <div className="text-center my-auto py-2 sm:py-3 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-[11px] sm:text-xs uppercase ${isRtl ? 'tracking-normal font-bold' : 'tracking-widest font-bold'} mb-2`} style={{ color: '#713f12' }}>
          {certificate.language === 'ar' ? 'يُمنح وسام البطولة والامتياز الذهبي بفخر واعتزاز إلى' : certificate.language === 'de' ? 'Diese Ehrenurkunde in Gold wird feierlich verliehen an' : 'This Golden Honor is Proudly Conferred Upon'}
        </p>

        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={52}
            color="#854d0e"
            className="tracking-wide"
          />
        </div>

        <div className="w-28 sm:w-44 h-[2px] mx-auto my-2" style={{ background: 'linear-gradient(90deg, transparent 0%, #ca8a04 50%, transparent 100%)' }} />

        {certificate.description && (
          <p className="text-xs sm:text-base leading-relaxed max-w-2xl mx-auto px-4 font-normal" style={{ color: '#451a03' }}>
            {certificate.description}
          </p>
        )}

        {certificate.score && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full shadow-xs" style={{ backgroundColor: '#fef9c3', border: '1px solid #facc15', color: '#854d0e' }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs font-black">{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="relative z-10 flex items-end justify-between pt-2 sm:pt-4 border-t px-2 sm:px-6" style={{ borderColor: 'rgba(202, 138, 4, 0.25)' }}>
        {/* Date */}
        <div className="text-start space-y-1">
          <p className="text-[10px] uppercase font-bold" style={{ color: '#854d0e' }}>
            {isRtl ? 'تاريخ التتويج' : certificate.language === 'de' ? 'Ausstellungsdatum' : 'Date of Conferral'}
          </p>
          <p className="text-xs sm:text-sm font-semibold" style={{ color: '#1e1b18' }}>
            {issueDateFormatted}
          </p>
        </div>

        {/* Olympic Gold Medallion */}
        <div className="flex flex-col items-center">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center shadow-md relative"
            style={{
              background: 'radial-gradient(circle, #fef08a 0%, #eab308 60%, #b48316 100%)',
              border: '3px solid #ffffff',
              boxShadow: '0 4px 14px rgba(202, 138, 4, 0.45)'
            }}
          >
            <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-white text-white drop-shadow-xs" />
            <span className="text-[8px] sm:text-[9px] font-black uppercase text-amber-950 mt-0.5">GOLD</span>
          </div>
        </div>

        {/* Teacher / Official Signature */}
        <div className="text-end">
          <CertificateTeacherSignature
            teacherName={teacherName}
            isRtl={isRtl}
            lang={certificate.language}
            color="#854d0e"
          />
        </div>
      </div>
    </div>
  );
};
