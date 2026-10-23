/**
 * Utility functions for student Arabic-to-English name transliteration and Two-Part Name formatting.
 * Useful for automated certificate name generation, internal student records, and English contacts.
 */

const COMMON_ARABIC_NAME_MAP: Record<string, string> = {
  'محمد': 'Mohamed',
  'محمود': 'Mahmoud',
  'أحمد': 'Ahmed',
  'احمد': 'Ahmed',
  'علي': 'Ali',
  'إبراهيم': 'Ibrahim',
  'ابراهيم': 'Ibrahim',
  'عمر': 'Omar',
  'عمرو': 'Amr',
  'يوسف': 'Youssef',
  'خالد': 'Khaled',
  'كريم': 'Karim',
  'طارق': 'Tarek',
  'يحيى': 'Yahia',
  'مصطفى': 'Mostafa',
  'حسن': 'Hassan',
  'حسين': 'Hussein',
  'سيف': 'Saif',
  'مالك': 'Malek',
  'آدم': 'Adam',
  'ادم': 'Adam',
  'حمزة': 'Hamza',
  'اسامة': 'Osama',
  'أسامة': 'Osama',
  'زياد': 'Ziad',
  'ياسين': 'Yassin',
  'أنس': 'Anas',
  'انس': 'Anas',
  'بلال': 'Belal',
  'معاذ': 'Moaaz',
  'مروان': 'Marwan',
  'عبدالرحمن': 'Abdelrahman',
  'عبد الرحمن': 'Abdelrahman',
  'عبدالله': 'Abdallah',
  'عبد الله': 'Abdallah',
  'عبدالعزيز': 'Abdelaziz',
  'مريم': 'Mariam',
  'نور': 'Nour',
  'سارة': 'Sara',
  'ساره': 'Sara',
  'فريدة': 'Farida',
  'ملك': 'Malak',
  'حبيبة': 'Habiba',
  'جنى': 'Jana',
  'سلمى': 'Salma',
  'ليلى': 'Laila',
  'شهد': 'Shahd',
  'روان': 'Rowan',
  'رنا': 'Rana',
  'ندى': 'Nada',
  'منى': 'Mona',
  'نهى': 'Noha',
  'هند': 'Hend',
  'يارا': 'Yara',
  'تسنيم': 'Tasneem',
  'جودي': 'Joudy',
  'كنزي': 'Kenzy',
  'نادين': 'Nadine',
  'كارما': 'Karma',
  'ريتال': 'Rital',
  'سما': 'Sama',
  'فاطمة': 'Fatma',
  'فاطمه': 'Fatma',
  'عائشة': 'Aisha',
  'خديجة': 'Khadija',
  'هاجر': 'Hagar',
  'إسراء': 'Esraa',
  'اسراء': 'Esraa',
  'شيماء': 'Shaimaa',
  'دعاء': 'Doaa',
  'وفاء': 'Wafaa',
  'ولاء': 'Walaa',
  'حنين': 'Haneen',
  'ريماس': 'Remas'
};

const ARABIC_CHAR_MAP: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'aa', 'ء': '', 'ئ': 'e', 'ؤ': 'o',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'g', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'k', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a'
};

/**
 * Formats any student name (Arabic or English) as a clean two-part name (الاسم الثنائي).
 * Handles compound prefixes like "عبد الرحمن" or "Abdel Rahman".
 */
export function ensureTwoPartName(fullName: string): string {
  if (!fullName || !fullName.trim()) return '';
  const trimmed = fullName.trim();

  // If the name is in Latin/English characters
  if (/^[a-zA-Z\s'-]+$/.test(trimmed)) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length <= 2) {
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    }

    const firstLower = parts[0].toLowerCase();
    const compoundPrefixes = ['abdel', 'abdul', 'abd', 'el', 'al'];

    if (compoundPrefixes.includes(firstLower) && parts.length >= 3) {
      const compoundFirst = `${parts[0]}${parts[1].toLowerCase()}`;
      const formattedFirst = compoundFirst.charAt(0).toUpperCase() + compoundFirst.slice(1);
      const secondPart = parts[2].charAt(0).toUpperCase() + parts[2].slice(1).toLowerCase();
      return `${formattedFirst} ${secondPart}`;
    }

    const p1 = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const p2 = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    return `${p1} ${p2}`;
  }

  // If the name is in Arabic characters
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return words.join(' ');
  }

  // Handle Arabic compound prefix "عبد" or "أبو" or "أم" or "آل"
  const firstWord = words[0];
  if ((firstWord === 'عبد' || firstWord === 'أبو' || firstWord === 'أم' || firstWord === 'آل') && words.length >= 3) {
    const compoundFirstName = `${words[0]} ${words[1]}`;
    const secondName = words[2];
    return `${compoundFirstName} ${secondName}`;
  }

  return `${words[0]} ${words[1]}`;
}

export function transliterateArabicWord(word: string): string {
  const clean = word.trim();
  if (!clean) return '';
  if (COMMON_ARABIC_NAME_MAP[clean]) {
    return COMMON_ARABIC_NAME_MAP[clean];
  }

  // Fallback transliteration
  let result = '';
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (ARABIC_CHAR_MAP[char] !== undefined) {
      result += ARABIC_CHAR_MAP[char];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result += char;
    }
  }

  if (!result) return clean;
  return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
}

export function transliterateArabicNameToEnglish(fullName: string): string {
  if (!fullName || !fullName.trim()) return '';
  const twoPart = ensureTwoPartName(fullName.trim());

  // If already in English/Latin
  if (/^[a-zA-Z\s.-]+$/.test(twoPart)) {
    return ensureTwoPartName(twoPart);
  }

  const words = twoPart.split(/\s+/);
  const englishTrans = words
    .map(w => transliterateArabicWord(w))
    .filter(Boolean)
    .join(' ');

  return ensureTwoPartName(englishTrans);
}

/**
 * Normalizes text for forgiving search in Arabic, German, and English.
 * Normalizes Arabic letters (أ/إ/آ/ٱ -> ا, ة -> ه, ى -> ي, removes diacritics/tashkeel),
 * converts Eastern Arabic digits (٠-٩) and Persian digits (۰-۹) to standard ASCII (0-9), and lowercases.
 */
export function normalizeSearchText(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '');
}
