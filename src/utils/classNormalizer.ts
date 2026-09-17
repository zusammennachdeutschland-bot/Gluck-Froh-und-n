/**
 * Utility for normalizing and unifying school grade & class codes across the application.
 * Strict standard: [Grade Number][Section Letter] with NO spaces (e.g., '1A', '11B', '10A', '7B', '5C')
 */

export const ARABIC_SECTION_MAP: Record<string, string> = {
  'أ': 'A',
  'ا': 'A',
  'ب': 'B',
  'ج': 'C',
  'د': 'D',
  'هـ': 'E',
  'ه': 'E',
  'و': 'F',
  'ز': 'G',
  'ح': 'H',
  'ط': 'I',
  'ي': 'J',
  'ك': 'K',
  'ل': 'L',
  'م': 'M',
  'ن': 'N'
};

/**
 * Converts Eastern Arabic numerals (٠-٩) to standard Western digits (0-9).
 */
export function convertArabicDigitsToEnglish(str: string): string {
  if (!str) return '';
  return str.replace(/[٠-٩]/g, (d) => {
    return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  });
}

/**
 * Normalizes any freeform or imported class string into the strict standard code: [Number][Letter] (e.g., "1A", "11B", "10A", "7B", "5C").
 */
export function normalizeClassCode(rawClass: string, defaultGrade?: string): string {
  if (!rawClass) return defaultGrade ? `${defaultGrade}A` : '10A';

  let s = convertArabicDigitsToEnglish(String(rawClass)).trim();

  // Remove common prefix noise like "الفصل", "فصل", "Class", "Section", "Room", "الصف", "سنة"
  s = s.replace(/^(?:الفصل|فصل|مجموعة|صف|الصف|سنة|قاعة|class|section|room|sec|grade|g)\s*[:\-\/]?\s*/i, '').trim();

  // 1. Direct standard patterns like "1A", "10A", "11B", "11-B", "10 A", "1 a", "11ب", "10 أ"
  const directMatch = s.match(/^(\d{1,2})\s*[\-_/.\s]*([a-zA-Z\u0621-\u064A])$/i);
  if (directMatch) {
    const num = directMatch[1];
    let letter = directMatch[2].toUpperCase();
    if (ARABIC_SECTION_MAP[letter]) {
      letter = ARABIC_SECTION_MAP[letter];
    }
    return `${num}${letter}`;
  }

  // 2. Embedded number + letter pattern anywhere in string (e.g. "Grade 10A", "10-A", "Class 1A")
  const numLetterMatch = s.match(/(\d{1,2})\s*[\-_/.\s]*([a-zA-Z\u0621-\u064A])\b/i);
  if (numLetterMatch) {
    const num = numLetterMatch[1];
    let letter = numLetterMatch[2].toUpperCase();
    if (ARABIC_SECTION_MAP[letter]) {
      letter = ARABIC_SECTION_MAP[letter];
    }
    return `${num}${letter}`;
  }

  // 3. Multi-word secondary / prep / primary patterns:
  // "FIRST SECONDARY 10A" or "1ST SECONDARY A" or "FIRST SECONDARY A" or "أولى ثانوي"
  const isFirstSec = /(?:first|1st|1|الأول|أولى)\s+(?:secondary|sec|ثانوي|ثانوية)/i.test(s);
  const isSecondSec = /(?:second|2nd|2|الثاني|ثانية)\s+(?:secondary|sec|ثانوي|ثانوية)/i.test(s);
  const isThirdSec = /(?:third|3rd|3|الثالث|ثالثة)\s+(?:secondary|sec|ثانوي|ثانوية)/i.test(s);

  const isFirstPrep = /(?:first|1st|1|الأول|أولى)\s+(?:prep|preparatory|إعدادي|اعدادي|إعدادية)/i.test(s);
  const isSecondPrep = /(?:second|2nd|2|الثاني|ثانية)\s+(?:prep|preparatory|إعدادي|اعدادي|إعدادية)/i.test(s);
  const isThirdPrep = /(?:third|3rd|3|الثالث|ثالثة)\s+(?:prep|preparatory|إعدادي|اعدادي|إعدادية)/i.test(s);

  // Extract letter from the string (last letter or section)
  const sectionMatch = s.match(/([a-zA-Z\u0621-\u064A])(?:[\s\-_]*)$/i) || s.match(/\b([A-Fa-f\u0621-\u064A])\b/i);
  let secLetter = 'A';
  if (sectionMatch) {
    let rawLetter = sectionMatch[1].toUpperCase();
    secLetter = ARABIC_SECTION_MAP[rawLetter] || rawLetter;
  }

  // Check if an explicit number exists anywhere (e.g., "10", "11", "12", "7", "8", "9", "5", "1")
  const embeddedNumMatch = s.match(/\b(\d{1,2})\b/);
  if (embeddedNumMatch) {
    return `${embeddedNumMatch[1]}${secLetter}`;
  }

  if (isFirstSec) return `10${secLetter}`;
  if (isSecondSec) return `11${secLetter}`;
  if (isThirdSec) return `12${secLetter}`;

  if (isFirstPrep) return `7${secLetter}`;
  if (isSecondPrep) return `8${secLetter}`;
  if (isThirdPrep) return `9${secLetter}`;

  // Check for Kindergarten
  if (/kg\s*1/i.test(s) || /كي\s*جي\s*1/i.test(s)) return `KG1${secLetter}`;
  if (/kg\s*2/i.test(s) || /كي\s*جي\s*2/i.test(s)) return `KG2${secLetter}`;

  // If we have a single letter and a defaultGrade was supplied
  if (/^[A-Za-z\u0621-\u064A]$/.test(s) && defaultGrade) {
    const l = ARABIC_SECTION_MAP[s.toUpperCase()] || s.toUpperCase();
    return `${defaultGrade}${l}`;
  }

  // Fallback: clean up spaces and uppercase
  const cleaned = s.replace(/[\s\-_/.]+/g, '').toUpperCase();
  if (/^\d+[A-Z]$/.test(cleaned)) {
    return cleaned;
  }

  // If pure number like "10" or "1"
  if (/^\d+$/.test(cleaned)) {
    return `${cleaned}A`;
  }

  return cleaned || (defaultGrade ? `${defaultGrade}A` : '10A');
}

/**
 * Extracts standard grade number/identifier from class (e.g., "10A" -> "10", "1A" -> "1", "11B" -> "11")
 */
export function extractGradeFromClass(cls: string): string {
  if (!cls) return '';
  const normalized = normalizeClassCode(cls);
  const leadNum = normalized.match(/^(\d+)/);
  if (leadNum) return leadNum[1];
  const kgMatch = normalized.match(/^(KG\d)/i);
  if (kgMatch) return kgMatch[1].toUpperCase();
  const anyNum = normalized.match(/\d+/);
  return anyNum ? anyNum[0] : normalized;
}

/**
 * Natural comparator for sorting class codes correctly:
 * 1A, 1B, 2A ... 9A, 10A, 10B, 11A, 11B, 12A
 */
export function compareClassCodes(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const numA = parseInt(a.replace(/\D/g, ''), 10);
  const numB = parseInt(b.replace(/\D/g, ''), 10);

  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Generates the standardized high-precision prompt for external AI tools (ChatGPT, Gemini, Claude).
 */
export function generateUnifiedGermanPrompt(targetGrade?: string, targetClass?: string): string {
  const gradeExample = targetGrade ? `Grade ${targetGrade}` : 'Grade 1..12 (e.g., 1A, 10A, 11B)';
  const classExample = targetClass ? targetClass : '10A';

  return `You are an expert school data extraction assistant. Analyze this class roster image/document carefully.

CRITICAL EXTRACTION RULES:
1. TARGET STUDENTS ONLY:
   - Extract ONLY students studying German as a 2nd foreign language (Deutsch / ألماني).
   - COMPLETELY IGNORE / EXCLUDE French (Français / فرنسي) and Italian students.

2. STRICT CLASS CODE FORMAT (MANDATORY):
   - School classes MUST ALWAYS be written strictly as [Grade Number][Section Letter] with NO spaces, NO dashes, and uppercase letters.
   - Examples of the required standard:
     * 1A, 1B, 2A, 2B, 3A, 4A, 5A, 6B (Primary)
     * 7A, 7B, 8A, 8B, 9A, 9B (Prep / Middle)
     * 10A, 10B, 11A, 11B, 12A, 12B (Secondary / High School)
   - Do NOT write: "10-A", "Class 10A", "Grade 10 A", or "FIRST SECONDARY 10A".
   - Convert Arabic letters: "10أ" -> "10A", "11ب" -> "11B".
   ${targetClass ? `* The specific class for this roster is: "${targetClass}"` : targetGrade ? `* The specific grade for this roster is: "${targetGrade}"` : ''}

3. REQUIRED JSON OUTPUT FORMAT:
   Return ONLY a raw, valid JSON array of student objects (no markdown wrapping, no conversational explanation):
[
  {
    "nameAr": "اسم الطالب باللغة العربية كامل رباعي أو ثلاثي",
    "nameEn": "Student Full Name in English",
    "gender": "Boy" or "Girl",
    "gradeClass": "${classExample}",
    "busLine": "Line Number / Bus Line name or N/A"
  }
]

Please process all valid German students in the roster and output the clean JSON array.`;
}
