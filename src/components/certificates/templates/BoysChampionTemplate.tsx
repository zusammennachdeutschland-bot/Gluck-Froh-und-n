import React from 'react';
import { CertificateRecord } from '../../../types';
import { Shield, Trophy, Zap, Star, CheckCircle2 } from 'lucide-react';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const BoysChampionTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || new Date().toISOString().split('T')[0];

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative w-full aspect-[1.414/1] text-white p-6 sm:p-10 flex flex-col justify-between select-none overflow-hidden font-sans rounded-3xl shadow-2xl"
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
          className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-white text-xs sm:text-sm font-black shadow-lg uppercase tracking-wider mb-2"
          style={{
            background: 'linear-gradient(90deg, #2563eb, #06b6d4, #4f46e5)',
            border: '1px solid rgba(103, 232, 249, 0.5)'
          }}
        >
          <Shield className="w-4 h-4" style={{ color: '#fde047', fill: '#fde047' }} />
          <span>
            {certificate.language === 'ar' ? 'وسام البطل الخارق ⚡' : certificate.language === 'de' ? 'CHAMPION HELDENURKUNDE ⚡' : 'SUPER CHAMPION AWARD ⚡'}
          </span>
          <Trophy className="w-4 h-4" style={{ color: '#fde047', fill: '#fde047' }} />
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md">
          {certificate.title || (certificate.language === 'ar' ? 'شهادة بطل التفوق والإنجاز' : certificate.language === 'de' ? 'Urkunde für Spitzenleistung' : 'Champion of Excellence Certificate')}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm font-bold mt-1 max-w-xl mx-auto" style={{ color: '#67e8f9' }}>
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Recipient Center Area */}
      <div className="text-center my-auto py-2 relative z-10">
        <p className="text-xs sm:text-sm font-bold uppercase tracking-widest" style={{ color: '#bae6fd' }}>
          {certificate.language === 'ar' ? 'تُمنح هذه الشهادة بكل فخر للبطل المتميز' : certificate.language === 'de' ? 'Diese Urkunde wird mit Stolz verliehen an' : 'Proudly presented to the Champion'}
        </p>

        <div className="my-2 sm:my-3">
          <div
            className="inline-block rounded-2xl px-8 sm:px-16 py-2.5"
            style={{
              backgroundColor: '#0c1a3b',
              border: '2px solid #22d3ee',
              boxShadow: '0 0 25px rgba(6, 182, 212, 0.45)'
            }}
          >
            <span
              className="text-3xl sm:text-5xl md:text-6xl font-black font-serif tracking-wide drop-shadow-md"
              style={{ color: '#fef08a' }}
            >
              {certificate.recipientName || certificate.studentName || 'Super Champion'}
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-base max-w-2xl mx-auto font-medium px-4 leading-relaxed" style={{ color: '#e2e8f0' }}>
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
      <div className="flex items-end justify-between px-4 sm:px-12 pb-2 relative z-10 font-sans">
        <div
          className="text-center min-w-[100px] sm:min-w-[140px] p-2.5 rounded-xl shadow-md"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(59, 130, 246, 0.4)'
          }}
        >
          <div
            className="pb-1 mb-1 text-[11px] sm:text-sm font-bold"
            style={{ borderBottom: '1px solid rgba(34, 211, 238, 0.4)', color: '#bae6fd' }}
          >
            {issueDateFormatted}
          </div>
          <span className="text-[9px] sm:text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#94a3b8' }}>
            {certificate.language === 'ar' ? 'تاريخ التكريم' : certificate.language === 'de' ? 'Ausstellungsdatum' : 'Date Issued'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-slate-900"
            style={{
              background: 'linear-gradient(135deg, #fbbf24, #d97706)',
              border: '2px solid #67e8f9',
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.5)'
            }}
          >
            <Trophy className="w-7 h-7" style={{ color: '#09152e', fill: '#09152e' }} />
          </div>
        </div>

        <div
          className="text-center min-w-[100px] sm:min-w-[140px] p-2.5 rounded-xl shadow-md"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(59, 130, 246, 0.4)'
          }}
        >
          <div
            className="pb-1 mb-1 text-[11px] sm:text-sm font-bold italic font-serif"
            style={{ borderBottom: '1px solid rgba(34, 211, 238, 0.4)', color: '#bae6fd' }}
          >
            {certificate.teacherName || certificate.instructorName || 'Lehrer/in'}
          </div>
          <span className="text-[9px] sm:text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#94a3b8' }}>
            {certificate.language === 'ar' ? 'توقيع المعلم / المدرب' : certificate.language === 'de' ? 'Unterschrift Lehrkraft' : 'Instructor Signature'}
          </span>
        </div>
      </div>
    </div>
  );
};
