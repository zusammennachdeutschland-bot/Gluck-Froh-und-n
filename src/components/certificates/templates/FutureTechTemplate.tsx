import React from 'react';
import { CertificateRecord } from '../../../types';
import { Cpu, Zap, Sparkles } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const FutureTechTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Student Name';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المشرف التقني' : certificate.language === 'de' ? 'Lehrkraft' : 'Instructor');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] p-8 sm:p-12 flex flex-col justify-between select-none overflow-hidden shadow-2xl rounded-2xl ${isRtl ? 'font-arabic-sans' : 'font-sans'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#0a0f1d',
        color: '#f8fafc',
        border: '10px solid #0284c7'
      }}
    >
      {/* Cyber Grid & Glowing Traces */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 20%, rgba(14, 165, 233, 0.2) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)'
        }}
      />

      {/* Cyber Frame Inset Lines */}
      <div
        className="absolute inset-3 sm:inset-4 pointer-events-none rounded-xl"
        style={{ border: '2px solid rgba(56, 189, 248, 0.6)' }}
      />
      <div
        className="absolute inset-5 sm:inset-6 pointer-events-none rounded-lg"
        style={{ border: '1px dashed rgba(129, 140, 248, 0.4)' }}
      />

      {/* Tech Corner Crosshairs */}
      <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{ borderTop: '2px solid #38bdf8', borderLeft: '2px solid #38bdf8' }} />
      <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{ borderTop: '2px solid #38bdf8', borderRight: '2px solid #38bdf8' }} />
      <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{ borderBottom: '2px solid #38bdf8', borderLeft: '2px solid #38bdf8' }} />
      <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{ borderBottom: '2px solid #38bdf8', borderRight: '2px solid #38bdf8' }} />

      {/* Top Header Section */}
      <div className="text-center relative z-10 pt-2 sm:pt-3">
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <div className="w-10 sm:w-16 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent 0%, #38bdf8 100%)' }} />
          <div
            className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #4f46e5 100%)',
              color: '#38bdf8',
              border: '2px solid #38bdf8',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)'
            }}
          >
            <Cpu className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#ffffff' }} />
          </div>
          <div className="w-10 sm:w-16 h-[2px]" style={{ background: 'linear-gradient(90deg, #38bdf8 0%, transparent 100%)' }} />
        </div>

        {certificate.centerOrSchoolName && (
          <p className="text-[11px] sm:text-xs font-mono uppercase font-bold mb-1" style={{ color: '#38bdf8' }}>
            {certificate.centerOrSchoolName}
          </p>
        )}

        <h1
          className={`text-2xl sm:text-4xl md:text-5xl font-black uppercase ${isRtl ? 'tracking-normal font-arabic-sans' : 'tracking-wider font-mono'}`}
          style={{ color: '#e0f2fe', textShadow: '0 0 16px rgba(56, 189, 248, 0.5)' }}
        >
          {certificate.title || (certificate.language === 'ar' ? 'شهادة الابتكار والتفوق المستقبلي' : certificate.language === 'de' ? 'Zertifikat für Zukunfts-Innovation' : 'Future Innovator Certificate')}
        </h1>

        {certificate.subtitle && (
          <p className="text-[11px] sm:text-sm font-semibold mt-1 max-w-xl mx-auto italic" style={{ color: '#7dd3fc' }}>
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Center Body */}
      <div className="text-center my-auto py-2 sm:py-3 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-[11px] sm:text-xs uppercase ${isRtl ? 'tracking-normal font-bold' : 'tracking-widest font-bold'} mb-2`} style={{ color: '#94a3b8' }}>
          {certificate.language === 'ar' ? 'تُمنح هذه الشهادة الرقمية لتميز المهارات إلى' : certificate.language === 'de' ? 'Dieses Zertifikat wird für exzellente Leistungen verliehen an' : 'Awarded for Outstanding Achievement To'}
        </p>

        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={52}
            color="#38bdf8"
            className="tracking-wider drop-shadow-md"
          />
        </div>

        <div className="w-28 sm:w-44 h-[2px] mx-auto my-2" style={{ background: 'linear-gradient(90deg, transparent 0%, #38bdf8 50%, transparent 100%)' }} />

        {certificate.description && (
          <p className="text-xs sm:text-base leading-relaxed max-w-2xl mx-auto px-4 font-normal" style={{ color: '#e2e8f0' }}>
            {certificate.description}
          </p>
        )}

        {certificate.score && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full shadow-xs" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#7dd3fc' }}>
            <Zap className="w-3.5 h-3.5" />
            <span className="text-xs font-black font-mono">{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="relative z-10 flex items-end justify-between pt-2 sm:pt-4 border-t px-2 sm:px-6" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
        <div className="text-start space-y-1">
          <p className="text-[10px] font-mono uppercase font-bold" style={{ color: '#38bdf8' }}>
            {isRtl ? 'تاريخ التوثيق' : certificate.language === 'de' ? 'Verifikationsdatum' : 'Verification Date'}
          </p>
          <p className="text-xs sm:text-sm font-semibold text-slate-200">
            {issueDateFormatted}
          </p>
        </div>

        {/* Digital Verification Hologram Badge */}
        <div className="flex flex-col items-center">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center shadow-lg relative"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              border: '2px solid #38bdf8',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)'
            }}
          >
            <Sparkles className="w-5 h-5 text-white" />
            <span className="text-[8px] font-black uppercase text-white font-mono mt-0.5">VERIFIED</span>
          </div>
        </div>

        <div className="text-end">
          <CertificateTeacherSignature
            teacherName={teacherName}
            isRtl={isRtl}
            lang={certificate.language}
            color="#38bdf8"
          />
        </div>
      </div>
    </div>
  );
};
