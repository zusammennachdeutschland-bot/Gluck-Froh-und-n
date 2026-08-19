import { Student, CertificateRecord, CertificateLanguage } from '../types';

export interface RecipientNameResolution {
  name: string;
  isMissing: boolean;
  warningMessage?: string;
  isLatinRequired: boolean;
}

/**
 * Single source of truth for resolving student name on certificates.
 * 
 * Logic Rules:
 * - Arabic Certificate ('ar'): uses student original name (Arabic name).
 * - English / German Certificate ('en' | 'de'): strictly uses student.certificateName (Latin / transliterated name).
 * - If certificateName is missing for English/German certificates, flags as missing and prevents silent Arabic fallback.
 */
export function resolveCertificateRecipientName(
  language: CertificateLanguage,
  student?: Student,
  customInput?: string
): RecipientNameResolution {
  const isLatinRequired = language === 'en' || language === 'de';

  // If a manual custom input is given (e.g. while editing in modal)
  if (customInput !== undefined && customInput !== null) {
    const trimmed = customInput.trim();
    if (isLatinRequired) {
      if (!trimmed) {
        return {
          name: '',
          isMissing: true,
          warningMessage: '⚠️ Certificate name (Latin/English) is required for German and English certificates.',
          isLatinRequired: true
        };
      }
      return {
        name: trimmed,
        isMissing: false,
        isLatinRequired: true
      };
    } else {
      // Arabic
      const finalName = trimmed || student?.name || '';
      return {
        name: finalName,
        isMissing: !finalName,
        warningMessage: !finalName ? '⚠️ اسم الطالب مطلوب' : undefined,
        isLatinRequired: false
      };
    }
  }

  // Resolving from Student Entity
  if (isLatinRequired) {
    const latinName = (student?.certificateName || '').trim();
    if (!latinName) {
      return {
        name: '',
        isMissing: true,
        warningMessage: '⚠️ Certificate name required',
        isLatinRequired: true
      };
    }
    return {
      name: latinName,
      isMissing: false,
      isLatinRequired: true
    };
  } else {
    // Arabic certificate
    const arabicName = (student?.name || '').trim();
    return {
      name: arabicName,
      isMissing: !arabicName,
      warningMessage: !arabicName ? '⚠️ اسم الطالب مطلوب' : undefined,
      isLatinRequired: false
    };
  }
}

/**
 * Validates a certificate before generation or export.
 */
export interface CertificateValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateCertificateData(
  certificate: Partial<CertificateRecord>,
  student?: Student
): CertificateValidationResult {
  const errors: string[] = [];
  const language = certificate.language || 'de';
  const isLatin = language === 'en' || language === 'de';

  const recipient = (
    certificate.recipientName ||
    certificate.studentCertificateName ||
    (isLatin ? student?.certificateName : student?.name) ||
    ''
  ).trim();

  if (!recipient) {
    if (isLatin) {
      errors.push('Certificate Latin name is required for English/German certificates.');
    } else {
      errors.push('اسم الطالب مطلوب للشهادة.');
    }
  }

  if (isLatin && /[\u0600-\u06FF]/.test(recipient) && !student?.certificateName) {
    errors.push('Please provide a Latin transliterated name for the German/English certificate.');
  }

  if (!certificate.title && !certificate.courseOrLevelTitle) {
    errors.push('Certificate title is required.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
