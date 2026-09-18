/**
 * Utility functions for student Arabic-to-English name transliteration.
 * Useful for automated certificate name generation and English records.
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
  const trimmed = fullName.trim();
  
  // If already in English/Latin
  if (/^[a-zA-Z\s.-]+$/.test(trimmed)) {
    return trimmed
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  const words = trimmed.split(/\s+/);
  return words
    .map(w => transliterateArabicWord(w))
    .filter(Boolean)
    .join(' ');
}
