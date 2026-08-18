import React from 'react';
import { CertificateRecord } from '../../../types';
import { Star, Flame } from 'lucide-react';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const KidsTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || new Date().toISOString().split('T')[0];

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative w-full aspect-[1.414/1] bg-gradient-to-br from-amber-50 via-sky-50 to-indigo-50 text-slate-800 p-6 sm:p-10 flex flex-col justify-between select-none overflow-hidden font-sans border-[12px] border-amber-400 rounded-3xl shadow-2xl"
    >
      {/* Playful Inner Dashed Ring */}
      <div className="absolute inset-2 sm:inset-3 border-4 border-dashed border-sky-400 rounded-2xl pointer-events-none opacity-80" />

      {/* Floating Star Decors */}
      <div className="absolute top-4 left-6 text-amber-400 animate-bounce"><Star className="w-7 h-7 fill-amber-400" /></div>
      <div className="absolute top-8 right-8 text-sky-400"><Star className="w-8 h-8 fill-sky-400" /></div>
      <div className="absolute bottom-6 left-10 text-pink-400"><Star className="w-6 h-6 fill-pink-400" /></div>
      <div className="absolute bottom-10 right-8 text-indigo-400"><Star className="w-7 h-7 fill-indigo-400" /></div>

      {/* Header */}
      <div className="text-center relative z-10 pt-2">
        <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 text-white text-xs sm:text-sm font-black shadow-md uppercase tracking-wider mb-2">
          <Flame className="w-4 h-4" />
          <span>SUPERSTAR AWARD 🌟</span>
          <Flame className="w-4 h-4" />
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-indigo-900 tracking-tight drop-shadow-xs">
          {certificate.title || 'Super Learner Certificate!'}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm text-pink-600 font-bold mt-1 max-w-md mx-auto">
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Main Recipient Area */}
      <div className="text-center my-auto py-2 relative z-10">
        <p className="text-xs sm:text-sm text-indigo-600 font-extrabold uppercase tracking-wide">
          {certificate.language === 'ar' ? '🎉 وسام البطل الرائع يُهدى إلى' : certificate.language === 'de' ? '🎉 Diese Urkunde geht an den Super-Star' : '🎉 Big Cheers & High Fives to'}
        </p>

        <div className="my-2 sm:my-3">
          <div className="inline-block bg-white/95 border-4 border-amber-400 shadow-xl rounded-2xl px-8 sm:px-16 py-2 transform -rotate-1">
            <span className="text-3xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {certificate.recipientName || certificate.studentName || 'Super Student'}
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-base text-slate-700 max-w-xl mx-auto font-medium px-4 leading-relaxed">
          {certificate.description || 'You are doing an awesome job in class! Keep shining bright and reaching for the stars!'}
        </p>

        {certificate.score && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-pink-100 border border-pink-300 text-pink-700 px-3 py-1 rounded-full text-xs font-black">
            <span>🚀 Grade / Score:</span>
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between px-4 sm:px-10 pb-1 relative z-10 font-bold text-slate-700">
        <div className="text-center min-w-[90px] sm:min-w-[120px] bg-white/80 p-2 rounded-xl border border-indigo-100 shadow-2xs">
          <div className="text-xs sm:text-sm font-black text-indigo-900">{issueDateFormatted}</div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase">
            {certificate.language === 'ar' ? 'تاريخ التكريم' : certificate.language === 'de' ? 'Datum' : 'Date'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-amber-400 border-2 border-white shadow-lg flex items-center justify-center text-xl">
            🏆
          </div>
        </div>

        <div className="text-center min-w-[90px] sm:min-w-[120px] bg-white/80 p-2 rounded-xl border border-indigo-100 shadow-2xs">
          <div className="text-xs sm:text-sm font-black text-indigo-900">{certificate.teacherName || 'Teacher'}</div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase">
            {certificate.language === 'ar' ? 'المعلم' : certificate.language === 'de' ? 'Lehrer/in' : 'Super Teacher'}
          </span>
        </div>
      </div>
    </div>
  );
};
