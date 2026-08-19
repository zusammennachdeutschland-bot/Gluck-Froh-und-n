import React from 'react';
import { CertificateRecord } from '../../../types';
import { Shield, Trophy, Zap, Star, CheckCircle2 } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const BoysChampionTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Super Champion';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Teacher');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] text-white p-6 sm:p-10 flex flex-col justify-between select-none overflow-hidden rounded-3xl shadow-2xl ${isRtl ? 'font-arabic-sans' : 'font-cert-sans'}`}
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#09152e',
        backgroundImage: 'linear-gradient(135deg, #09152e 0%, #031e3d 50%, #111438 100%)',
        border: '12px solid #2563eb'
      }}
    >
      {/* Outer Cyan Geometric Accent Lines */}
      <div
        className="absolute inset-2 sm:inset-3 pointer-events-none rounded-2xl"
        style={{ border: '2px solid rgba(34, 211, 238, 0.4)' }}
      />
      <div
        className="absolute inset-4 sm:inset-5 pointer-events-none rounded-xl"
        style={{ border: '1px solid rgba(96, 165, 250, 0.25)' }}
      />

      {/* Decorative Corner Hero Badges */}
      <div className="absolute top-4 left-4 pointer-events-none" style={{ color: '#22d3ee' }}>
        <Zap className="w-8 h-8 rotate-12" />
      </div>
      <div className="absolute top-4 right-4 pointer-events-none" style={{ color: '#facc15' }}>
        <Star className="w-8 h-8 fill-amber-400" />
      </div>
      <div className="absolute bottom-4 left-4 pointer-events-none" style={{ color: '#facc15' }}>
        <Star className="w-7 h-7 fill-amber-400" />
      </div>
      <div className="absolute bottom-4 right-4 pointer-events-none" style={{ color: '#22d3ee' }}>
        <Zap className="w-8 h-8 -rotate-12" />
      </div>

      {/* Header Section */}
      <div className="text-center relative z-10 pt-2">
        <div
          className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-white text-xs sm:text-sm font-black shadow-lg uppercase ${isRtl ? 'tracking-normal' : 'tracking-wider'} mb-2`}
          style={{
            background: 'linear-gradient(90deg, #2563eb, #06b6d4, #4f46e5)',
            border: '1px solid rgba(103, 232, 249, 0.5)'
          }}
        >
          <Shield className="w-4 h-4" style={{ color: '#fde047', fill: '#fde047' }} />
          <span>
            {certificate.customBadgeText || (certificate.language === 'ar' ? 'وسام البطل الخارق ⚡' : certificate.language === 'de' ? 'CHAMPION HELDENURKUNDE ⚡' : 'SUPER CHAMPION AWARD ⚡')}
          </span>
          <Trophy className="w-4 h-4" style={{ color: '#fde047', fill: '#fde047' }} />
        </div>

        <h1 className={`text-2xl sm:text-4xl md:text-5xl font-black ${isRtl ? 'tracking-normal font-arabic-sans' : 'tracking-tight font-cert-sans'} text-white drop-shadow-md`}>
          {certificate.title || (certificate.language === 'ar' ? 'شهادة بطل التفوق والإنجاز' : certificate.language === 'de' ? 'Urkunde für Spitzenleistung' : 'Champion of Excellence Certificate')}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm font-bold mt-1 max-w-xl mx-auto" style={{ color: '#67e8f9' }}>
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Recipient Center Area with Auto-Fit */}
      <div className="text-center my-auto py-2 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-xs sm:text-sm font-bold uppercase ${isRtl ? 'tracking-normal' : 'tracking-widest'} mb-1`} style={{ color: '#bae6fd' }}>
          {certificate.language === 'ar' ? 'تُمنح هذه الشهادة بكل فخر للبطل المتميز' : certificate.language === 'de' ? 'Diese Urkunde wird mit Stolz verliehen an' : 'Proudly presented to the Champion'}
        </p>

        {/* Clean recipient name without strange boxes */}
        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={52}
            minFontSizePx={22}
            fontStyle="serif"
            className="font-bold drop-shadow-lg"
            style={{ color: '#fef08a' }}
          />
          {/* Ornate Glowing Cyan/Gold underline */}
          <div className="w-48 sm:w-80 h-[2.5px] bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent mx-auto mt-3 sm:mt-4 mb-1" />
        </div>

        <p className="text-xs sm:text-base max-w-2xl mx-auto font-medium px-4 leading-relaxed mt-1" style={{ color: '#e2e8f0' }}>
          {certificate.description || (certificate.language === 'ar' ? 'تقديرًا للشجاعة والمثابرة والذكاء والتفوق الباهر في دراسة اللغة الألمانية.' : 'in Anerkennung herausragender Leistungen, unermüdlichen Einsatzes und erstklassiger Erfolge.')}
        </p>

        {certificate.score && (
          <div
            className="mt-2.5 inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs sm:text-sm font-bold shadow-md"
            style={{
              backgroundColor: '#0f2759',
              border: '1px solid #22d3ee',
              color: '#bae6fd'
            }}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between px-4 sm:px-12 pb-2 sm:pb-3 relative z-10 font-sans">
        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-1 text-xs sm:text-sm font-bold select-text" style={{ color: '#bae6fd' }}>
            {issueDateFormatted}
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-[#22d3ee]/60 my-1" />
          <span className={`text-[9px] sm:text-xs uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`} style={{ color: '#94a3b8' }}>
            {certificate.language === 'ar' ? 'تاريخ التكريم' : certificate.language === 'de' ? 'Ausstellungsdatum' : 'Date Issued'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-slate-900 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #fde047 0%, #ca8a04 100%)',
              border: '2px solid #ffffff'
            }}
          >
            <Shield className="w-8 h-8 text-slate-950 fill-amber-400" />
          </div>
        </div>

        <div className="flex flex-col items-center text-center min-w-[110px] sm:min-w-[150px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-0.5 text-[#fef08a]">
            <CertificateTeacherSignature name={teacherName} isRtl={isRtl} />
          </div>
          <div className="w-28 sm:w-40 h-[1.5px] bg-[#22d3ee]/60 my-1" />
          <span className={`text-[9px] sm:text-xs uppercase ${isRtl ? 'tracking-normal font-semibold' : 'tracking-wider font-semibold'}`} style={{ color: '#94a3b8' }}>
            {certificate.language === 'ar' ? 'المعلم' : certificate.language === 'de' ? 'Lehrkraft' : 'Teacher'}
          </span>
        </div>
      </div>
    </div>
  );
};

