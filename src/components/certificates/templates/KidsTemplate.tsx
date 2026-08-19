import React from 'react';
import { CertificateRecord } from '../../../types';
import { Star, Flame } from 'lucide-react';
import { CertificateStudentName } from './CertificateStudentName';
import { CertificateTeacherSignature } from './CertificateTeacherSignature';
import { formatLocalDate } from '../../../utils/timeUtils';

interface TemplateProps {
  certificate: Partial<CertificateRecord>;
}

export const KidsTemplate: React.FC<TemplateProps> = ({ certificate }) => {
  const isRtl = certificate.language === 'ar';
  const issueDateFormatted = certificate.issueDate || formatLocalDate();
  const recipientName = certificate.recipientName || certificate.studentName || 'Super Student';
  const teacherName = certificate.teacherName || certificate.instructorName || (isRtl ? 'المعلم' : certificate.language === 'de' ? 'Lehrer/in' : 'Teacher');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={isRtl ? 'ar' : 'de'}
      className={`relative w-full aspect-[1.414/1] bg-gradient-to-br from-amber-50 via-sky-50 to-indigo-50 text-slate-800 p-6 sm:p-10 flex flex-col justify-between select-none overflow-hidden border-[12px] border-amber-400 rounded-3xl shadow-2xl ${isRtl ? 'font-arabic-sans' : 'font-cert-sans'}`}
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
        <div className={`inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 text-white text-xs sm:text-sm font-black shadow-md uppercase ${isRtl ? 'tracking-normal' : 'tracking-wider'} mb-2`}>
          <Flame className="w-4 h-4" />
          <span>{certificate.customBadgeText || (certificate.language === 'ar' ? 'وسام البطل الخارق 🌟' : certificate.language === 'de' ? 'SUPERSTAR AUSZEICHNUNG 🌟' : 'SUPERSTAR AWARD 🌟')}</span>
          <Flame className="w-4 h-4" />
        </div>

        <h1 className={`text-2xl sm:text-4xl md:text-5xl font-black text-indigo-900 ${isRtl ? 'tracking-normal font-arabic-sans' : 'tracking-tight font-cert-sans'} drop-shadow-xs`}>
          {certificate.title || (certificate.language === 'ar' ? 'شهادة البطل المتعلم المتميز!' : certificate.language === 'de' ? 'Super-Lerner Urkunde!' : 'Super Learner Certificate!')}
        </h1>

        {certificate.subtitle && (
          <p className="text-xs sm:text-sm text-pink-600 font-bold mt-1 max-w-md mx-auto">
            {certificate.subtitle}
          </p>
        )}
      </div>

      {/* Main Recipient Area with Auto-Fit */}
      <div className="text-center my-auto py-2 relative z-10 w-full max-w-3xl mx-auto">
        <p className={`text-xs sm:text-sm text-indigo-600 font-extrabold uppercase ${isRtl ? 'tracking-normal' : 'tracking-wide'} mb-1`}>
          {certificate.language === 'ar' ? '🎉 وسام البطل الرائع يُهدى إلى' : certificate.language === 'de' ? '🎉 Diese Urkunde geht an den Super-Star' : '🎉 Big Cheers & High Fives to'}
        </p>

        {/* Clean recipient name without strange boxes */}
        <div className="my-2 sm:my-3 w-full px-4 sm:px-12">
          <CertificateStudentName
            name={recipientName}
            isRtl={isRtl}
            maxFontSizePx={52}
            minFontSizePx={22}
            fontStyle="sans"
            className="text-indigo-900 font-black drop-shadow-xs"
          />
          {/* Cheerful Rainbow/Gold underline */}
          <div className="w-48 sm:w-80 h-[3px] bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mt-3 sm:mt-4 mb-1 rounded-full" />
        </div>

        <p className="text-xs sm:text-base text-slate-700 max-w-xl mx-auto font-medium px-4 leading-relaxed mt-1">
          {certificate.description || (certificate.language === 'ar' ? 'أنت بطل رائع وتبذل جهدًا مذهلاً في التعلم والمشاركة! استمر في التألق والنجاح دائماً!' : 'You are doing an awesome job in class! Keep shining bright and reaching for the stars!')}
        </p>

        {certificate.score && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-pink-100 border border-pink-300 text-pink-700 px-3.5 py-1 rounded-full text-xs font-black shadow-2xs">
            <span>🚀 Grade / Score:</span>
            <span>{certificate.score}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between px-4 sm:px-10 pb-2 sm:pb-3 relative z-10 font-bold text-slate-700">
        <div className="flex flex-col items-center text-center min-w-[100px] sm:min-w-[140px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-1 text-xs sm:text-sm font-black text-indigo-900 select-text">
            {issueDateFormatted}
          </div>
          <div className="w-28 sm:w-36 h-[2px] bg-indigo-300 my-1 rounded-full" />
          <span className={`text-[9px] sm:text-xs text-slate-500 uppercase ${isRtl ? 'tracking-normal font-bold' : 'font-bold'}`}>
            {certificate.language === 'ar' ? 'تاريخ التكريم' : certificate.language === 'de' ? 'Datum' : 'Date'}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-amber-400 border-2 border-white shadow-lg flex items-center justify-center text-xl">
            🏆
          </div>
        </div>

        <div className="flex flex-col items-center text-center min-w-[100px] sm:min-w-[140px]">
          <div className="h-7 sm:h-9 flex items-end justify-center px-2 pb-0.5 text-indigo-900">
            <CertificateTeacherSignature name={teacherName} isRtl={isRtl} />
          </div>
          <div className="w-28 sm:w-36 h-[2px] bg-indigo-300 my-1 rounded-full" />
          <span className={`text-[9px] sm:text-xs text-slate-500 uppercase ${isRtl ? 'tracking-normal font-bold' : 'font-bold'}`}>
            {certificate.language === 'ar' ? 'المعلم' : certificate.language === 'de' ? 'Lehrer/in' : 'Teacher'}
          </span>
        </div>
      </div>
    </div>
  );
};

