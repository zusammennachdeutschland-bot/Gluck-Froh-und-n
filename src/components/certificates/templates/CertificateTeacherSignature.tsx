import React from 'react';

interface CertificateTeacherSignatureProps {
  name: string;
  isRtl?: boolean;
  className?: string;
}

export const CertificateTeacherSignature: React.FC<CertificateTeacherSignatureProps> = ({
  name,
  isRtl = false,
  className = ''
}) => {
  const isArabicText = /[\u0600-\u06FF]/.test(name);

  if (isArabicText) {
    return (
      <span
        dir="rtl"
        className={`font-arabic-signature font-bold text-xs sm:text-base tracking-normal select-text leading-tight drop-shadow-2xs ${className}`}
        style={{
          fontFamily: "'Aref Ruqaa', 'Amiri', 'Alexandria', serif",
          textRendering: 'geometricPrecision'
        }}
      >
        {name}
      </span>
    );
  }

  return (
    <span
      dir="ltr"
      className={`font-signature font-semibold text-base sm:text-2xl tracking-wide select-text leading-none drop-shadow-2xs inline-block transform -rotate-1 ${className}`}
      style={{
        fontFamily: "'Dancing Script', 'Great Vibes', 'Alex Brush', 'Caveat', 'Pinyon Script', cursive",
        textRendering: 'geometricPrecision'
      }}
    >
      {name}
    </span>
  );
};
