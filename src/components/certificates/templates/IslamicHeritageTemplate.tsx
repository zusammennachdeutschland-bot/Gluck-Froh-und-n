import React from 'react';
import { CertificateRecord } from '../../../types';
import { Award, Sparkles } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const IslamicHeritageTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم الفاضل' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden shadow-2xl rounded-2xl ${isRtl ? 'font-arabic-serif' : 'font-cert-serif'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#0c1b33',
        color: '#f8fafc',
        border: '12px solid #d4af37'
      }}
    >
      {/* Arabesque Geometric Canvas Texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, #d4af37 1px, transparent 1px), radial-gradient(circle at 0% 0%, #d4af37 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Decorative Gold Inset Borders */}
      <div
        className="absolute inset-3 sm:inset-4 pointer-events-none rounded-xl"
        style={{ border: '2px solid rgba(212, 175, 55, 0.7)' }}
      />
      <div
        className="absolute inset-5 sm:inset-6 pointer-events-none rounded-lg"
        style={{ border: '1px dashed rgba(212, 175, 55, 0.4)' }}
      />

      {/* Traditional Arabesque 8-point Star Corner Motifs */}
      <div className="absolute top-6 left-6 text-[#d4af37] text-lg font-bold select-none pointer-events-none">۞</div>
      <div className="absolute top-6 right-6 text-[#d4af37] text-lg font-bold select-none pointer-events-none">۞</div>
      <div className="absolute bottom-6 left-6 text-[#d4af37] text-lg font-bold select-none pointer-events-none">۞</div>
      <div className="absolute bottom-6 right-6 text-[#d4af37] text-lg font-bold select-none pointer-events-none">۞</div>

      {/* Top Header Section */}
      <div className="text-center relative z-10 pt-1 sm:pt-3">
        {/* Basmala or Heritage Calligraphic Banner */}
        <p className="text-xs sm:text-sm text-[#d4af37] font-arabic-serif font-bold tracking-widest mb-1 opacity-90">
          {isRtl ? 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' : 'IN THE NAME OF GOD'}
        </p>

        {/* Emblem */}
        <div className="inline-flex items-center justify-center gap-3 mb-1.5">
          <div className="w-12 sm:w-24 h-[1.5px]" style={{ background: 'linear-gradient(90deg, transparent 0%, #d4af37 100%)' }} />
          <div
            className="w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'radial-gradient(circle, #fef08a 0%, #d4af37 60%, #996515 100%)',
              color: '#0c1b33',
              border: '2px solid #ffffff'
            }}
          >
            <Award className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-xs" />
          </div>
          <div className="w-12 sm:w-24 h-[1.5px]" style={{ background: 'linear-gradient(90deg, #d4af37 0%, transparent 100%)' }} />
        </div>

        {certificate.centerOrSchoolName && (
          <p className="text-[11px] sm:text-xs uppercase font-bold mb-1" style={{ color: '#e2e8f0' }}>
            {certificate.centerOrSchoolName}
          </p>
        )}

        <h1
          className={`text-2xl sm:text-4xl md:text-5xl font-black uppercase ${isRtl ? 'tracking-normal font-arabic-serif' : 'tracking-wider font-cert-serif'}`}
          style={{ color: '#fef08a', textShadow: '0 2px 10px rgba(212, 175, 55, 0.4)' }}
        >
          {certificate.title || (certificate.language === 'ar' ? 'شهادة تقدير وتكريم إسلامية' : certificate.language === 'de' ? 'Ehrenurkunde des Erfolgs' : 'Heritage Certificate of Honor')}
        </h1>

        {certificate.subtitle && (
          <p className="text-[11px] sm:text-sm font-semibold mt-1 max-w-xl mx-auto italic" style={{ color: '#cbd5e1' }}>
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body */}
      <div className="text-center my-auto py-2 sm:py-3 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-[11px] sm:text-xs uppercase ${isRtl ? 'tracking-normal font-bold' : 'tracking-widest font-bold'} mb-2`} style={{ color: '#d4af37' }}>
          {certificate.language === 'ar' ? 'يُمنح هذا التكريم المبارك تقديراً للاجتهاد والتميز إلى' : certificate.language === 'de' ? 'In Anerkennung besonderer Verdienste feierlich verliehen an' : 'Conferred in High Honor and Recognition To'}
        </p>

        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={52}
            color="#ffffff"
            className="tracking-wide drop-shadow-md"
          />
        </div>

        <div className="w-28 sm:w-44 h-[2px] mx-auto my-2" style={{ background: 'linear-gradient(90deg, transparent 0%, #d4af37 50%, transparent 100%)' }} />

        {certificate.description && (
          <p className="text-xs sm:text-base leading-relaxed max-w-2xl mx-auto px-4 font-normal" style={{ color: '#f1f5f9' }}>
            {certificate.description}
          </p>
        )}

        {certificate.score && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full shadow-xs" style={{ backgroundColor: 'rgba(212, 175, 55, 0.2)', border: '1px solid #d4af37', color: '#fef08a' }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs font-black">{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="relative z-10 flex items-end justify-between pt-2 sm:pt-4 border-t px-2 sm:px-6" style={{ borderColor: 'rgba(212, 175, 55, 0.3)' }}>
        <div className="text-start space-y-1">
          <p className="text-[10px] uppercase font-bold" style={{ color: '#d4af37' }}>
            {isRtl ? 'تحريراً في تاريخ' : certificate.language === 'de' ? 'Datum' : 'Date'}
          </p>
          <p className="text-xs sm:text-sm font-semibold text-slate-200">
            {issueDateFormatted}
          </p>
        </div>

        {/* Ornate Octagonal Seal */}
        <div className="flex flex-col items-center">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center shadow-lg relative"
            style={{
              background: 'radial-gradient(circle, #fef08a 0%, #d4af37 70%, #996515 100%)',
              border: '2px solid #ffffff',
              boxShadow: '0 0 16px rgba(212, 175, 55, 0.5)'
            }}
          >
            <span className="text-[14px] text-[#0c1b33]">۞</span>
            <span className="text-[8px] font-black uppercase text-[#0c1b33] -mt-1">{isRtl ? 'معتمد' : 'SEAL'}</span>
          </div>
        </div>

        <div className="text-end">
          <CertificateTeacherSignature
            teacherName={teacherName}
            isRtl={isRtl}
            lang={certificate.language}
            color="#fef08a"
          />
        </div>
      </div>
    </div>
  );
};
