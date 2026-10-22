/**
 * Smart Contacts Standardization & Phone Normalization Engine for Glück
 * Implements strict rules for standardizing student parent contacts:
 * - Format: "{Student English Name}'s Mom - Klasse {Class Number}"
 * - Sibling consolidation: "Ahmed & Mariam's Mom - Klasse 2 & 4"
 * - English possessives: 's or ' for names ending in s, x, z (e.g., "Lukas' Mom - Klasse 5")
 * - Strictly uses "Klasse", never "Grade"
 * - Egyptian phone normalization (+20, 0020, 01x local mobile numbers)
 */

import { Student, GradeLevel } from '../types';
import { normalizeDigits, isWhatsAppUsername } from './phoneUtils';

export interface StandardizedContactProposal {
  standardizedName: string;
  shortDisplayName?: string;
  suggestedNote?: string;
  students: Student[];
  phoneKey: string;
  formattedPhone: string;
  isSiblingConsolidation: boolean;
  hasAmbiguity: boolean;
  ambiguityReasons: string[];
  isNameTooLong: boolean;
}

export interface ContactAuditItem {
  id: string; // Contact ID or Raw Contact ID
  rawContactId?: string;
  currentName: string;
  proposedName: string;
  suggestedNote?: string;
  phone: string;
  normalizedPhone: string;
  accountType?: string;
  accountName?: string;
  isGoogleAccount: boolean;
  isReadOnly: boolean;
  status: 
    | 'NEEDS_UPDATE' 
    | 'ALREADY_STANDARDIZED' 
    | 'DUPLICATE_ON_PHONE' 
    | 'NOT_IN_CONTACTS' 
    | 'AMBIGUOUS' 
    | 'MISSING_ENGLISH_NAME'
    | 'INVALID_PHONE';
  statusLabelAr: string;
  statusLabelDe: string;
  statusDescriptionAr: string;
  students: Student[];
  selectedForUpdate: boolean;
}

/**
 * Normalizes an Egyptian phone number into a canonical format (+201xxxxxxxxx).
 * Handles:
 * - Eastern Arabic numerals (٠-٩) -> ASCII (0-9)
 * - Leading +20, 0020, 20
 * - Local mobile prefix (010, 011, 012, 015)
 * - Strips whitespace, dashes, dots, brackets
 */
export function normalizeEgyptianPhone(phone?: string | null): string {
  if (!phone) return '';
  const digitsOnly = normalizeDigits(phone).trim().replace(/[^\d+]/g, '');
  if (!digitsOnly) return '';

  let cleaned = digitsOnly;
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // If starts with 2001 (e.g. +20 011...) -> strip redundant 0
  if (/^2001[0125]/.test(cleaned)) {
    cleaned = '20' + cleaned.substring(3);
  }

  // If local Egyptian mobile starting with 01x (11 digits)
  if (/^01[0125]\d{8}$/.test(cleaned)) {
    return '+20' + cleaned.substring(1);
  }

  // If starts with 201x (12 digits, country code without +)
  if (/^201[0125]\d{8}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  // Fallback for numbers already starting with +20 or international format
  if (digitsOnly.startsWith('+')) {
    return '+' + cleaned;
  }

  // If 10 digits starting with 10, 11, 12, 15 (Egyptian mobile without leading zero)
  if (/^1[0125]\d{8}$/.test(cleaned)) {
    return '+20' + cleaned;
  }

  return '+' + cleaned;
}

/**
 * Generates an indexable match key for a phone number.
 * Extracts the core Egyptian 10-digit number (e.g., 1012345678)
 * allowing 01012345678, +201012345678, and 00201012345678 to match seamlessly.
 */
export function getPhoneMatchKey(phone?: string | null): string {
  if (!phone) return '';
  if (isWhatsAppUsername(phone)) {
    return phone.toLowerCase().replace(/[@\s]/g, '');
  }

  const normalized = normalizeEgyptianPhone(phone);
  const digits = normalized.replace(/\D/g, '');

  // If Egyptian mobile (201x followed by 8 digits = 12 digits total)
  if (digits.length === 12 && digits.startsWith('201')) {
    return digits.substring(2); // returns "10xxxxxxxx" (10 digits)
  }

  // If 11 digits starting with 01
  if (digits.length === 11 && digits.startsWith('01')) {
    return digits.substring(1); // returns "10xxxxxxxx" (10 digits)
  }

  // General fallback: return last 9 or 10 digits
  if (digits.length >= 9) {
    return digits.slice(-9);
  }

  return digits;
}

/**
 * Extracts student's actual English name stored in Glück.
 * Priority:
 * 1. student.certificateName (if containing Latin letters)
 * 2. student.name (if written in Latin/English letters)
 * Returns null if no English name is stored (e.g. only Arabic name).
 */
export function getStudentEnglishName(student: Student): string | null {
  // Check certificateName first (explicitly used for English transliterations in Glück)
  if (student.certificateName && /[a-zA-Z]/.test(student.certificateName.trim())) {
    return cleanEnglishName(student.certificateName.trim());
  }

  // Check student.name if written in Latin
  if (student.name && /[a-zA-Z]/.test(student.name.trim())) {
    // If name is pure Latin or primarily Latin
    const arabicChars = (student.name.match(/[\u0600-\u06FF]/g) || []).length;
    const latinChars = (student.name.match(/[a-zA-Z]/g) || []).length;
    if (latinChars > arabicChars) {
      return cleanEnglishName(student.name.trim());
    }
  }

  return null;
}

/**
 * Cleans and title-cases an English name (e.g. "ahmed ibrahim" -> "Ahmed").
 * For contacts, teachers typically use the student's first name, or first + last if short.
 */
function cleanEnglishName(rawName: string): string {
  const parts = rawName
    .replace(/[^\w\s'-]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return rawName;

  // Capitalize each part properly
  const capitalized = parts.map(part => {
    if (part.length <= 1) return part.toUpperCase();
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });

  // If single word, return it
  if (capitalized.length === 1) return capitalized[0];

  // Return full capitalized name (e.g., "Ahmed Tarek" or "Ahmed")
  return capitalized[0];
}

/**
 * Applies English possessive apostrophe rule:
 * - Regular names: name + "'s" (e.g. "Ahmed's", "Mariam's", "Youssef's")
 * - Names ending in 's', 'x', or 'z': name + "'" (e.g. "Lukas'", "Max'", "Aziz'", "Anas'")
 */
export function formatPossessive(name: string): string {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();
  const lastChar = trimmed.slice(-1).toLowerCase();

  if (lastChar === 's' || lastChar === 'x' || lastChar === 'z') {
    return `${trimmed}'`;
  }
  return `${trimmed}'s`;
}

/**
 * Extracts and formats class designation into "Klasse {Number/Code}".
 * Strictly uses "Klasse", never "Grade".
 * Handles:
 * - "Grade 4" -> "Klasse 4"
 * - "Grade 2" -> "Klasse 2"
 * - "Grade 10" -> "Klasse 10"
 * - "4" -> "Klasse 4"
 * - "4/1" -> "Klasse 4/1"
 * - "A1" -> "Klasse A1"
 * - "Klasse 4" -> "Klasse 4"
 */
export function formatKlasseName(grade?: GradeLevel | string | null): string {
  if (!grade) return '';
  const str = grade.toString().trim();

  // If already starts with Klasse
  if (/^klasse\s+/i.test(str)) {
    return 'Klasse ' + str.replace(/^klasse\s+/i, '').trim();
  }

  // If starts with "Grade " (e.g. "Grade 4", "Grade 10")
  if (/^grade\s+/i.test(str)) {
    const num = str.replace(/^grade\s+/i, '').trim();
    return `Klasse ${num}`;
  }

  // If just a number (e.g. "4", "2", "6")
  if (/^\d+(\/\d+)?$/.test(str)) {
    return `Klasse ${str}`;
  }

  // If Course level like A1, A2, B1, etc.
  if (/^[A-C][1-2]$/i.test(str)) {
    return `Klasse ${str.toUpperCase()}`;
  }

  // Default fallback
  return `Klasse ${str}`;
}

/**
 * Extracts the clean numeric/identifier portion of a class for consolidated lists.
 * e.g., "Klasse 4" -> "4", "Grade 2" -> "2", "A1" -> "A1".
 */
export function extractClassId(grade?: GradeLevel | string | null): string {
  if (!grade) return '';
  const str = grade.toString().trim();
  return str.replace(/^(klasse|grade)\s+/i, '').trim();
}

/**
 * Formats a list of English names with commas and ampersand.
 * - 1 name: "Ahmed"
 * - 2 names: "Ahmed & Mariam"
 * - 3 names: "Ahmed, Mariam & Youssef"
 */
export function joinEnglishNames(names: string[]): string {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  if (uniqueNames.length === 0) return '';
  if (uniqueNames.length === 1) return uniqueNames[0];
  if (uniqueNames.length === 2) return `${uniqueNames[0]} & ${uniqueNames[1]}`;

  const last = uniqueNames[uniqueNames.length - 1];
  const leading = uniqueNames.slice(0, uniqueNames.length - 1).join(', ');
  return `${leading} & ${last}`;
}

/**
 * Formats a list of class designations into consolidated "Klasse {list}".
 * e.g. ["Grade 2", "Grade 4"] -> "Klasse 2 & 4"
 * e.g. ["Grade 2", "Grade 4", "Grade 6"] -> "Klasse 2, 4 & 6"
 * e.g. ["Grade 4", "Grade 4"] -> "Klasse 4" (deduplicates identical classes!)
 */
export function joinKlasseDesignations(grades: (GradeLevel | string | undefined)[]): string {
  const cleanClasses = grades
    .map(g => extractClassId(g))
    .filter(Boolean);

  // Deduplicate while preserving order
  const uniqueClasses: string[] = [];
  cleanClasses.forEach(c => {
    if (!uniqueClasses.includes(c)) uniqueClasses.push(c);
  });

  // Sort numerically if all are numbers
  const allNumeric = uniqueClasses.every(c => /^\d+$/.test(c));
  if (allNumeric) {
    uniqueClasses.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }

  if (uniqueClasses.length === 0) return 'Klasse';
  if (uniqueClasses.length === 1) return `Klasse ${uniqueClasses[0]}`;
  if (uniqueClasses.length === 2) return `Klasse ${uniqueClasses[0]} & ${uniqueClasses[1]}`;

  const last = uniqueClasses[uniqueClasses.length - 1];
  const leading = uniqueClasses.slice(0, uniqueClasses.length - 1).join(', ');
  return `Klasse ${leading} & ${last}`;
}

/**
 * Builds the standardized contact proposal for a single student or a group of siblings.
 * Strict rules:
 * - Single: "{Student English Name}'s Mom - Klasse {Class Number}"
 * - Sibling: "{Name1} & {Name2}'s Mom - Klasse {Class1} & {Class2}"
 * - Handles English possessives ('s vs ')
 * - Name length guard: if display name > 45 chars, generates a concise display name and stores full sibling details in Note.
 */
export function buildStandardizedContactProposal(
  students: Student[],
  phone: string
): StandardizedContactProposal {
  const phoneKey = getPhoneMatchKey(phone);
  const formattedPhone = normalizeEgyptianPhone(phone);
  const ambiguityReasons: string[] = [];

  // Check English names
  const validStudentsWithEnglishNames: { student: Student; englishName: string }[] = [];
  students.forEach(s => {
    const enName = getStudentEnglishName(s);
    if (enName) {
      validStudentsWithEnglishNames.push({ student: s, englishName: enName });
    } else {
      ambiguityReasons.push(`الطالب/ة "${s.name}" لا يملك اسماً باللغة الإنجليزية في التطبيق (English Name Missing).`);
    }
  });

  const isSibling = students.length > 1;

  if (validStudentsWithEnglishNames.length === 0) {
    return {
      standardizedName: '',
      students,
      phoneKey,
      formattedPhone,
      isSiblingConsolidation: isSibling,
      hasAmbiguity: true,
      ambiguityReasons,
      isNameTooLong: false
    };
  }

  const englishNames = validStudentsWithEnglishNames.map(x => x.englishName);
  const grades = validStudentsWithEnglishNames.map(x => x.student.grade);

  // Build collective name phrase
  let namePhrase = '';
  if (englishNames.length === 1) {
    namePhrase = `${formatPossessive(englishNames[0])} Mom`;
  } else {
    // Coordinated possessive: "Ahmed & Mariam's Mom"
    const lastIdx = englishNames.length - 1;
    const leadingNames = englishNames.slice(0, lastIdx).join(', ');
    const lastPossessive = formatPossessive(englishNames[lastIdx]);
    
    if (englishNames.length === 2) {
      namePhrase = `${englishNames[0]} & ${lastPossessive} Mom`;
    } else {
      namePhrase = `${leadingNames} & ${lastPossessive} Mom`;
    }
  }

  // Build class phrase
  const classPhrase = joinKlasseDesignations(grades);

  // Full Standardized Name
  const fullStandardizedName = `${namePhrase} - ${classPhrase}`;

  // Check length (> 45 chars)
  const isNameTooLong = fullStandardizedName.length > 45;
  let shortDisplayName: string | undefined = undefined;
  let suggestedNote: string | undefined = undefined;

  if (isNameTooLong && isSibling) {
    // Generate concise display name: e.g. "Ahmed, Mariam +1's Mom - Klasse 2, 4..."
    const firstTwo = englishNames.slice(0, 2).join(' & ');
    const extraCount = englishNames.length - 2;
    const shortNamePart = extraCount > 0 ? `${firstTwo} +${extraCount}'s Mom` : `${firstTwo}'s Mom`;
    const shortClassPart = joinKlasseDesignations(grades.slice(0, 2)) + (grades.length > 2 ? '...' : '');
    shortDisplayName = `${shortNamePart} - ${shortClassPart}`;

    // Note contains full details
    const siblingDetails = validStudentsWithEnglishNames
      .map(x => `${x.englishName} (${formatKlasseName(x.student.grade)})`)
      .join(', ');
    suggestedNote = `Glück Kontakte: ${siblingDetails} | الهاتف: ${formattedPhone}`;
  }

  return {
    standardizedName: fullStandardizedName,
    shortDisplayName,
    suggestedNote,
    students,
    phoneKey,
    formattedPhone,
    isSiblingConsolidation: isSibling,
    hasAmbiguity: ambiguityReasons.length > 0,
    ambiguityReasons,
    isNameTooLong
  };
}

/**
 * Checks whether an existing phone contact name already matches the standardized format.
 * Accounts for minor whitespace differences.
 */
export function isContactAlreadyStandardized(currentName: string, proposedName: string): boolean {
  if (!currentName || !proposedName) return false;
  const cleanCurrent = currentName.trim().replace(/\s+/g, ' ');
  const cleanProposed = proposedName.trim().replace(/\s+/g, ' ');
  return cleanCurrent.toLowerCase() === cleanProposed.toLowerCase();
}
