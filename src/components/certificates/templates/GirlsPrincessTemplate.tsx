import React from 'react';
import { CertificateRecord } from '../../../types';
import { Sparkles, Crown, Heart, CheckCircle2 } from 'lucide-react';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const GirlsPrincessTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || new Date().toISOString().split('T')[0];

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative w-full aspect-[1.414/1] p-6 sm:p-10 flex flex-col justify-between select-none overflow-hidden font-sans rounded-3xl shadow-2xl"
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#fff1f2',
        backgroundImage: 'linear-gradient(135deg, #fff1f2 0%, #faf5ff 50%, #ffe4e6 100%)',
        border: '12px solid #f472b6',
        color: '#1e293b'
      }}
    >
      {/* Decorative Inner Golden/Lilac Lace Frame */}
      <div
        className="absolute inset-2 sm:inset-3 rounded-2xl pointer-events-none"
        style={{ border: '2px solid #fda4af' }}
      />
      <div
        className="absolute inset-4 sm:inset-5 rounded-xl pointer-events-none"
        style={{ border: '2px dashed rgba(216, 180, 254, 0.8)' }}
      />

      {/* Floating Sparkles & Crowns */}
      <div className="absolute top-4 left-4 pointer-events-none" style={{ color: '#f472b6' }}>
        <Sparkles className="w-8 h-8 fill-pink-300" />
      </div>
      <div className="absolute top-4 right-4 pointer-events-none" style={{ color: '#fbbf24' }}>
        <Crown className="w-8 h-8 fill-amber-300" />
      </div>
      <div className="absolute bottom-4 left-4 pointer-events-none" style={{ color: '#fb7185' }}>
        <Heart className="w-7 h-7 fill-rose-300" />
      </div>
      <div className="absolute bottom-4 right-4 pointer-events-none" style={{ color: '#c084fc' }}>
        <Sparkles className="w-8 h-8 fill-purple-300" />
      </div>

      {/* Header Section */}
      <div className="text-center relative z-10 pt-2">
        <div
          className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-white text-xs sm:text-sm font-black shadow-md uppercase tracking-wider mb-2"
          style={{
            background: 'linear-gradient(90deg, #ec4899, #f43f5e, #9333ea)',
            border: '1px solid #fbcfe8'
          }}
        >
          <Crown className="w-4 h-4" style={{ color: '#fef08a', fill: '#fef08a' }} />
          <span>
            {certificate.language === 'ar' ? 'وسام أميرة التفوق والنجوم ✨' : certificate.language === 'de' ? 'PRINZESSIN STERNENURKUNDE ✨' : 'SHINING PRINCESS AWARD ✨'}
          </span>
          <Sparkles className="w-4 h-4" style={{ color: '#fef08a' }} />
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight drop-shadow-xs" style={{ color: '#3b0764' }}>
          {certificate.title || (certificate.language === 'ar' ? 'شهادة التميز والتفوق الباهر' : certificate.language === 'de' ? 'Urkunde für herausragende Leistungen' : 'Shining Star of Excellence')}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm font-bold mt-1 max-w-xl mx-auto" style={{ color: '#be185d' }}>
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Recipient Center Area */}
      <div className="text-center my-auto py-2 relative z-10">
        <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest" style={{ color: '#7e22ce' }}>
          {certificate.language === 'ar' ? 'تُهدى هذه الشهادة الملكية بتقدير عظيم للأميرة المتميزة' : certificate.language === 'de' ? 'Diese glanzvolle Urkunde geht an den Star' : 'Lovingly and proudly awarded to the star'}
        </p>

        <div className="my-2 sm:my-3">
          <div
            className="inline-block rounded-2xl px-8 sm:px-16 py-2.5"
            style={{
              backgroundColor: '#ffffff',
              border: '3px solid #f472b6',
              boxShadow: '0 0 25px rgba(244, 114, 182, 0.45)'
            }}
          >
            <span
              className="text-3xl sm:text-5xl md:text-6xl font-black font-serif tracking-wide drop-shadow-xs"
              style={{ color: '#be185d' }}
            >
              {certificate.recipientName || certificate.studentName || 'Shining Star'}
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-base max-w-2xl mx-auto font-medium px-4 leading-relaxed" style={{ color: '#334155' }}>
          {certificate.description || (certificate.language === 'ar' ? 'تقديرًا لإبداعكِ وتفوقكِ الدائم وابتسامتكِ المشرقة وإنجازكِ الرائع في دروس اللغة الألمانية.' : 'in Anerkennung deines fleißigen Lernens, deiner Begeisterung und deines strahlenden Erfolgs.')}
        </p>

        {certificate.score && (
          <div
            className="mt-2.5 inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs sm:text-sm font-bold shadow-xs"
            style={{
              backgroundColor: '#fce7f3',
              border: '1px solid #f472b6',
              color: '#9d174d'
            }}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between px-4 sm:px-12 pb-2 relative z-10 font-sans">
        <div
          className="text-center min-w-[100px] sm:min-w-[140px] p-2.5 rounded-xl shadow-xs"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fbcfe8'
          }}
        >
          <div
            className="pb-1 mb-1 text-[11px] sm:text-sm font-bold"
            style={{ borderBottom: '1px solid #f472b6', color: '#3b0764' }}
          >
            {issueDateFormatted}
          </div>
          <span className="text-[9px] sm:text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#db2777' }}>
            {certificate.language === 'ar' ? 'تاريخ التكريم' : certificate.language === 'de' ? 'Ausstellungsdatum' : 'Date Issued'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div
            className="w-14 h-14 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white"
            style={{
              background: 'linear-gradient(135deg, #f472b6, #f43f5e)'
            }}
          >
            <Crown className="w-7 h-7" style={{ color: '#fef08a', fill: '#fef08a' }} />
          </div>
        </div>

        <div
          className="text-center min-w-[100px] sm:min-w-[140px] p-2.5 rounded-xl shadow-xs"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fbcfe8'
          }}
        >
          <div
            className="pb-1 mb-1 text-[11px] sm:text-sm font-bold italic font-serif"
            style={{ borderBottom: '1px solid #f472b6', color: '#3b0764' }}
          >
            {certificate.teacherName || certificate.instructorName || 'Lehrer/in'}
          </div>
          <span className="text-[9px] sm:text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#db2777' }}>
            {certificate.language === 'ar' ? 'توقيع المعلمة / المعلم' : certificate.language === 'de' ? 'Unterschrift Lehrkraft' : 'Instructor Signature'}
          </span>
        </div>
      </div>
    </div>
  );
};
