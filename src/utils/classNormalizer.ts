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
 * Standard class code unification instructions in Arabic for AI Prompts.
 */
export const CLASS_UNIFICATION_RULES_AR = `قواعد إلزامية ومشددة لتوحيد أسماء الفصول (STRICT CLASS CODE STANDARD):
- يجب أن يُكتب اسم الفصل دائماً بالصيغة الموحدة: [رقم الصف][حرف الفصل الإنجليزي الكبير] بدون أي مسافات وبدون شرطات (مثال: 10A, 10B, 11A, 11B, 7A, 7B, 1A, 2B, 3C).
- تحويل فوري للحروف العربية إلى المقابل الإنجليزي:
  * (أ / ا -> A) | (ب -> B) | (ج -> C) | (د -> D) | (هـ / ه -> E) | (و -> F) | (ز -> G) | (ح -> H).
- تحويل المراحل الدراسية والأسماء الوصفية إلى رقم الصف القياسي:
  * المرحلة الثانوية (Secondary):
    - أولى ثانوي (First Secondary / 1st Sec) -> الصف 10 (مثال: أولى ثانوي أ = 10A، أولى ثانوي ب = 10B)
    - ثانية ثانوي (Second Secondary / 2nd Sec) -> الصف 11 (مثال: ثانية ثانوي أ = 11A، ثانية ثانوي ب = 11B)
    - ثالثة ثانوي (Third Secondary / 3rd Sec) -> الصف 12 (مثال: ثالثة ثانوي أ = 12A، ثالثة ثانوي ب = 12B)
  * المرحلة الإعدادية (Preparatory / Middle):
    - أولى إعدادي (1st Prep) -> الصف 7 (مثال: أولى إعدادي أ أو 1 = 7A)
    - ثانية إعدادي (2nd Prep) -> الصف 8 (مثال: ثانية إعدادي ب أو 2 = 8B)
    - ثالثة إعدادي (3rd Prep) -> الصف 9 (مثال: ثالثة إعدادي ج أو 3 = 9C)
  * المرحلة الابتدائية (Primary): الصفوف من 1 إلى 6 (مثال: 1A, 2B, 3A, 4B, 5A, 6B).
- ممنوع منعاً باتاً:
  * لا تكتب: "10-A" أو "10 A" أو "Class 10A" أو "Grade 10A" أو "فصل 10 أ" أو "10/1" أو "أولى ثانوي أ".
  * اكتب فقط الرمز القياسي الصافي مثل: "10A".`;

/**
 * Standard class code unification instructions in English for AI Prompts.
 */
export const CLASS_UNIFICATION_RULES_EN = `CRITICAL MANDATORY CLASS CODE STANDARDIZATION:
- Class codes MUST strictly be formatted as [Grade Number][Section Letter] with NO spaces, NO dashes, and UPPERCASE letter.
- Examples of the required standard:
  * Primary (Grades 1-6): 1A, 1B, 2A, 2B, 3A, 4A, 5A, 6B
  * Preparatory / Middle (Grades 7-9):
    - 1st Prep -> Grade 7 (7A, 7B, 7C...)
    - 2nd Prep -> Grade 8 (8A, 8B, 8C...)
    - 3rd Prep -> Grade 9 (9A, 9B, 9C...)
  * Secondary / High School (Grades 10-12):
    - 1st Secondary -> Grade 10 (10A, 10B, 10C...)
    - 2nd Secondary -> Grade 11 (11A, 11B, 11C...)
    - 3rd Secondary -> Grade 12 (12A, 12B, 12C...)
- Arabic Section Letters Conversion: (أ/ا -> A, ب -> B, ج -> C, د -> D, هـ -> E, و -> F).
- Strictly FORBIDDEN: Do NOT output "10-A", "Class 10A", "Grade 10 A", "10/1", or "FIRST SECONDARY 10A". Output ONLY "10A".`;

/**
 * Generates the standardized high-precision prompt for external AI tools (ChatGPT, Gemini, Claude)
 * for extracting students from rosters/documents with unified class codes.
 */
export function generateUnifiedGermanPrompt(
  targetGrade?: string, 
  targetClass?: string,
  lang: 'ar' | 'en' | 'bilingual' = 'ar'
): string {
  const gradeExample = targetGrade ? `Grade ${targetGrade}` : 'الصف 1..12 (مثل 1A, 10A, 11B)';
  const classExample = targetClass ? targetClass : '10A';

  if (lang === 'ar') {
    return `أنت مساعد خبير وفائق الدقة في استخراج وتنظيم بيانات الطلاب المدرسية للغة الألمانية كلغة ثانية.
قم بتحليل المستند / كشف الأسماء أو الصورة المرفقة بعناية فائقة واستخرج الطلاب وفق الشروط الصارمة التالية:

1. الطلاب المستهدفون (طلاب الألماني فقط):
   - استخرج فقط الطلاب الذين يدرسون اللغة الألمانية كلغة ثانية (Deutsch / ألماني).
   - استبعد وتجاهل تماماً أي طلاب يدرسون لغات أخرى مثل الفرنسي (Français) أو الإيطالي (Italiano).

2. ${CLASS_UNIFICATION_RULES_AR}
   ${targetClass ? `* الفصل المستهدف المحدد لهذا الكشف هو: "${targetClass}"` : targetGrade ? `* الصف المستهدف المحدد لهذا الكشف هو: "${targetGrade}"` : ''}

3. صيغة الإخراج المطلوبة (JSON صافي فقط):
   أخرج مصفوفة JSON صافية فقط بدون أي نصوص قبلها أو بعدها أو شروحات:
[
  {
    "nameAr": "اسم الطالب باللغة العربية كامل ثلاثي أو رباعي",
    "nameEn": "Student Full Name in English",
    "gender": "Boy" أو "Girl",
    "gradeClass": "${classExample}",
    "busLine": "رقم الخط أو اسم الباص أو N/A"
  }
]

يرجى معالجة جميع طلاب الألماني في الكشف وإخراج مصفوفة الـ JSON النظيفة فوراً.`;
  }

  if (lang === 'en') {
    return `You are an expert school data extraction assistant for German language departments. Analyze this class roster image/document carefully.

CRITICAL EXTRACTION RULES:
1. TARGET STUDENTS ONLY:
   - Extract ONLY students studying German as a 2nd foreign language (Deutsch / ألماني).
   - COMPLETELY IGNORE / EXCLUDE French (Français / فرنسي) and Italian students.

2. ${CLASS_UNIFICATION_RULES_EN}
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

  // Bilingual default
  return `أنت مساعد خبير لاستخراج بيانات الطلاب المدرسية / You are an expert school data extraction assistant.

قواعد الاستخراج الإلزامية (Mandatory Extraction Rules):
1. استخراج طلاب اللغة الألمانية فقط (Deutsch students only) - استبعاد الفرنسي والإيطالي.
2. ${CLASS_UNIFICATION_RULES_AR}
3. ${CLASS_UNIFICATION_RULES_EN}
   ${targetClass ? `* الفصل المستهدف (Target Class): "${targetClass}"` : targetGrade ? `* المرحلة المستهدفة (Target Grade): "${targetGrade}"` : ''}

صيغة الإخراج (Output JSON Schema Only):
[
  {
    "nameAr": "اسم الطالب باللغة العربية",
    "nameEn": "Student English Name",
    "gender": "Boy" / "Girl",
    "gradeClass": "${classExample}",
    "busLine": "Line 01 / N/A"
  }
]`;
}

/**
 * Generates the standardized prompt for extracting School Timetables / Lessons via AI
 * with strict unified class codes matching the students roster.
 */
export function generateUnifiedScheduleImportPrompt(options: {
  scope: 'all' | 'single';
  teacherName?: string;
  teachersList?: string[];
  lang?: 'ar' | 'en';
}): string {
  const { scope, teacherName, teachersList, lang = 'ar' } = options;

  if (scope === 'single') {
    const tName = teacherName || 'المعلم';
    return `أنا أقوم ببناء جدول حصص مدرسي رقمي متكامل. يرجى استخراج جدول الحصص الأسبوعي الخاص بالمعلم/ة "${tName}" من النص أو الصورة المرفقة.

الناتج يجب أن يكون بتنسيق JSON فقط (بدون أي شروحات أو نصوص إضافية) ويطابق الـ Schema التالي تماماً:
\`\`\`json
{
  "schedule": {
    "0": [{ "periodNumber": 1, "className": "10A", "subjectName": "Deutsch" }],
    "1": [],
    "2": [],
    "3": [],
    "4": []
  }
}
\`\`\`

ملاحظات وقواعد إلزامية حاسمة:
1. المفاتيح من "0" إلى "4" تمثل أيام الأسبوع:
   (0 = الأحد / Sunday، 1 = الإثنين / Monday، 2 = الثلاثاء / Tuesday، 3 = الأربعاء / Wednesday، 4 = الخميس / Thursday).
2. ${CLASS_UNIFICATION_RULES_AR}
3. subjectName هو اسم المادة (يرجى توحيده لـ "Deutsch" لمادة اللغة الألمانية).
4. periodNumber هو رقم الحصة (1، 2، 3، 4...).
5. ⚠️ احتساب الفسحة / البريك (Break):
   - الفسحة تُحسب دائماً حصة واحدة فقط لا غير (Exactly 1 period slot)، ولا تأخذ أكثر من حصة واحدة أبداً.
   - يجب احتساب الفسحة ضمن الترقيم التسلسلي للحصص (periodNumber) كحصة مفردة (مثال: إذا كانت الفسحة بعد الحصة 3، تُعد الفسحة هي الحصة رقم 4 كحصة واحدة فقط، وتكون الحصة التي تليها مباشرة هي الحصة رقم 5) لضمان دقة التوقيت وعدم حدوث أي ترحيل في أرقام الحصص التالية.
6. لا تقم باختراع أي بيانات غير موجودة في الجدول المرفق.
أخرج JSON صالح ونظيف فقط.`;
  }

  const teacherNames = (teachersList && teachersList.length > 0) 
    ? teachersList.join('، ') 
    : 'المعلمين المسجلين في القسم';

  return `أنا أقوم ببناء جدول حصص مدرسي رقمي لعدة معلمين في قسم اللغة الألمانية. يرجى استخراج جدول الحصص الأسبوعي من النص أو الصورة المرفقة.

قائمة المعلمين المتاحين في النظام (يجب استخدام نفس هذه الأسماء بدقة):
${teacherNames}

الناتج يجب أن يكون بتنسيق JSON فقط (بدون أي نصوص إضافية أو شروحات) ويطابق الـ Schema التالي تماماً:
\`\`\`json
{
  "teachersSchedules": {
    "اسم المعلم 1": {
      "0": [{ "periodNumber": 1, "className": "10A", "subjectName": "Deutsch" }],
      "1": [{ "periodNumber": 2, "className": "11B", "subjectName": "Deutsch" }],
      "2": [],
      "3": [],
      "4": []
    },
    "اسم المعلم 2": {
      "0": [{ "periodNumber": 3, "className": "7A", "subjectName": "Deutsch" }]
    }
  }
}
\`\`\`

ملاحظات وقواعد إلزامية حاسمة:
1. المفاتيح من "0" إلى "4" تمثل أيام الأسبوع:
   (0 = الأحد، 1 = الإثنين، 2 = الثلاثاء، 3 = الأربعاء، 4 = الخميس).
2. ${CLASS_UNIFICATION_RULES_AR}
3. className هو اسم الفصل ويجب أن يكون موحداً بدقة (مثل 10A, 11B, 7A...) ليتطابق مع فصول الطلاب المسجلين.
4. subjectName هو اسم المادة (يرجى توحيده لـ "Deutsch").
5. periodNumber هو رقم الحصة (1، 2، 3...).
6. ⚠️ احتساب الفسحة / البريك (Break):
   - الفسحة تُحسب دائماً حصة واحدة فقط لا غير (Exactly 1 period slot)، ولا تأخذ أكثر من حصة واحدة أبداً.
   - يجب احتساب الفسحة ضمن الترقيم التسلسلي للحصص (periodNumber) كحصة مفردة (مثال: إذا كانت الفسحة بعد الحصة 3، تُعد الفسحة هي الحصة رقم 4 كحصة واحدة فقط، وتكون الحصة التي تليها مباشرة هي الحصة رقم 5) لضمان دقة التوقيت وعدم حدوث أي ترحيل في أرقام الحصص التالية.
7. لا تقم باختراع أي بيانات غير موجودة.
أخرج كود JSON الصالح والنظيف فقط.`;
}
