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

