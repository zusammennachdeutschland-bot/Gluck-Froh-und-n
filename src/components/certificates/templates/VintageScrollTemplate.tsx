import React from 'react';
import { CertificateRecord } from '../../../types';
import { Scroll, Bookmark, Sparkles } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const VintageScrollTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'الأستاذ الفاضل' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden shadow-2xl rounded-2xl ${isRtl ? 'font-arabic-serif' : 'font-cert-serif'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#f6eedb',
        color: '#382513',
        border: '12px solid #5c3a21'
      }}
    >
      {/* Aged Parchment Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(246, 238, 219, 0.9) 30%, rgba(222, 202, 168, 0.8) 80%, rgba(162, 133, 93, 0.5) 100%)'
        }}
      />

      {/* Classical Baroque Inner Borders */}
      <div
        className="absolute inset-3 sm:inset-4 pointer-events-none rounded-xl"
        style={{ border: '2px solid #8c5835' }}
      />
      <div
        className="absolute inset-5 sm:inset-6 pointer-events-none rounded-lg"
        style={{ border: '1px solid rgba(140, 88, 53, 0.4)' }}
      />

      {/* Decorative Vintage Scrolls in Corners */}
      <div className="absolute top-6 left-6 text-[#8c5835] text-xl pointer-events-none select-none">❦</div>
      <div className="absolute top-6 right-6 text-[#8c5835] text-xl pointer-events-none select-none">❦</div>
      <div className="absolute bottom-6 left-6 text-[#8c5835] text-xl pointer-events-none select-none">❦</div>
      <div className="absolute bottom-6 right-6 text-[#8c5835] text-xl pointer-events-none select-none">❦</div>

      {/* Top Header Section */}
      <div className="text-center relative z-10 pt-2 sm:pt-3">
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <div className="w-12 sm:w-20 h-[1.5px]" style={{ background: 'linear-gradient(90deg, transparent 0%, #8c5835 100%)' }} />
          <div
            className="w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center shadow-md"
            style={{
              background: 'linear-gradient(135deg, #a66a38 0%, #5c3a21 100%)',
              color: '#f6eedb',
              border: '2px solid #f6eedb'
            }}
          >
            <Scroll className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#f6eedb' }} />
          </div>
          <div className="w-12 sm:w-20 h-[1.5px]" style={{ background: 'linear-gradient(90deg, #8c5835 0%, transparent 100%)' }} />
        </div>

        {certificate.centerOrSchoolName && (
          <p className={`text-[11px] sm:text-xs uppercase font-serif font-bold mb-1`} style={{ color: '#784725' }}>
            {certificate.centerOrSchoolName}
          </p>
        )}

        <h1
          className={`text-2xl sm:text-4xl md:text-5xl font-black uppercase ${isRtl ? 'tracking-normal font-arabic-serif' : 'tracking-wider font-cert-serif'}`}
          style={{ color: '#3c2415' }}
        >
          {certificate.title || (certificate.language === 'ar' ? 'مخطوطة الشرف والتقدير الملكية' : certificate.language === 'de' ? 'Historische Ehrenurkunde' : 'Vintage Certificate of Honor')}
        </h1>

        {certificate.subtitle && (
          <p className="text-[11px] sm:text-sm font-semibold mt-1 max-w-xl mx-auto italic" style={{ color: '#684024' }}>
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body */}
      <div className="text-center my-auto py-2 sm:py-3 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-[11px] sm:text-xs uppercase ${isRtl ? 'tracking-normal font-bold' : 'tracking-widest font-bold'} mb-2`} style={{ color: '#684024' }}>
          {certificate.language === 'ar' ? 'يشهد القائمون على الصرح العلمي بتفوق وجدارة' : certificate.language === 'de' ? 'Es wird hiermit feierlich beurkundet für' : 'It is Hereby Certified and Documented Unto'}
        </p>

        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={52}
            color="#3c2415"
            className="tracking-wide"
          />
        </div>

        <div className="w-28 sm:w-44 h-[2px] mx-auto my-2" style={{ background: 'linear-gradient(90deg, transparent 0%, #8c5835 50%, transparent 100%)' }} />

        {certificate.description && (
          <p className="text-xs sm:text-base leading-relaxed max-w-2xl mx-auto px-4 font-normal" style={{ color: '#4a2f1b' }}>
            {certificate.description}
          </p>
        )}

        {certificate.score && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full shadow-xs" style={{ backgroundColor: '#e8dcbe', border: '1px solid #8c5835', color: '#5c3a21' }}>
            <Bookmark className="w-3.5 h-3.5" />
            <span className="text-xs font-black">{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="relative z-10 flex items-end justify-between pt-2 sm:pt-4 border-t px-2 sm:px-6" style={{ borderColor: 'rgba(140, 88, 53, 0.3)' }}>
        <div className="text-start space-y-1">
          <p className="text-[10px] uppercase font-bold" style={{ color: '#784725' }}>
            {isRtl ? 'حُرر بتاريخ' : certificate.language === 'de' ? 'Ausstellungsdatum' : 'Issued on Date'}
          </p>
          <p className="text-xs sm:text-sm font-semibold text-stone-800">
            {issueDateFormatted}
          </p>
        </div>

        {/* Vintage Wax Seal with Ribbon */}
        <div className="flex flex-col items-center">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center shadow-lg relative"
            style={{
              background: 'radial-gradient(circle, #b91c1c 0%, #7f1d1d 80%, #450a0a 100%)',
              border: '2px solid #ef4444',
              boxShadow: '0 4px 14px rgba(127, 29, 29, 0.5)'
            }}
          >
            <Sparkles className="w-5 h-5 text-amber-200" />
            <span className="text-[7px] font-black uppercase text-amber-200 mt-0.5 tracking-tighter">SIGILLUM</span>
          </div>
        </div>

        <div className="text-end">
          <CertificateTeacherSignature
            teacherName={teacherName}
            isRtl={isRtl}
            lang={certificate.language}
            color="#5c3a21"
          />
        </div>
      </div>
    </div>
  );
};
