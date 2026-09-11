/**
 * Utility functions for Arabic student gender detection and role phrasing.
 */

// Common Arabic female names (including common Egyptian / Arab student names)
const FEMALE_FIRST_NAMES = new Set([
  'مريم', 'نور', 'سارة', 'ساره', 'ريم', 'شهد', 'روان', 'رغد', 'رهف', 'لجين', 'جود', 'حنين', 
  'يارا', 'تسنيم', 'تولين', 'كارما', 'ريتال', 'جودي', 'سدرة', 'سيلين', 'فريدة', 'ملك', 
  'سما', 'حبيبة', 'كنزي', 'ندى', 'منى', 'نهى', 'رنا', 'داليا', 'دينا', 'مي', 'مها', 
  'هند', 'وعد', 'عهد', 'زينب', 'هاجر', 'إسراء', 'شيماء', 'دعاء', 'وفاء', 'ولاء', 
  'أروى', 'أسماء', 'خلود', 'سلمى', 'ليلى', 'جنى', 'حلا', 'تالا', 'كارمن', 'نادين',
  'نورهان', 'نوران', 'بسملة', 'جنات', 'أمنية', 'فاطمة', 'فاطمه', 'عائشة', 'خديجة',
  'ضحى', 'شروق', 'إلهام', 'إيمان', 'منار', 'ميس', 'بيان', 'لمى', 'ريما', 'رنين',
  'ريماس', 'تاليا', 'ناديا', 'نادية', 'رانيا', 'ريهام', 'غادة', 'سحر', 'أماني', 'صفاء',
  'نجلاء', 'حنان', 'لبنى', 'مروة', 'هبة', 'شيرين', 'آية', 'آلاء', 'أمل', 'أميرة', 'نغم'
]);

// Known Arabic male names ending with ة / ه / ى / اء that could look feminine
const MALE_EXCEPTIONS = new Set([
  'حمزة', 'أسامة', 'طلحة', 'عبيدة', 'معاوية', 'يحيى', 'عيسى', 'مصطفى', 'موسى', 
  'عروة', 'حذيفة', 'قتادة', 'سلامة', 'جمعة', 'عطية', 'رضا', 'علا', 'طه', 'عكرمة', 'شيبة'
]);

/**
 * Checks if a given student name is likely female based on Arabic rules and common names.
 */
export const isLikelyFemaleStudent = (name?: string, explicitGender?: 'male' | 'female'): boolean => {
  if (explicitGender === 'female') return true;
  if (explicitGender === 'male') return false;
  if (!name) return false;

  const trimmed = name.trim();
  const firstName = trimmed.split(/\s+/)[0];

  if (FEMALE_FIRST_NAMES.has(firstName)) return true;

  // Words that end in ة or ه or ى or اء (feminine morphological markers in Arabic)
  if (firstName.endsWith('ة') || firstName.endsWith('ه') || firstName.endsWith('ى') || firstName.endsWith('اء')) {
    if (MALE_EXCEPTIONS.has(firstName)) return false;
    return true;
  }

  return false;
};

/**
 * Returns 'male' or 'female' for a student, taking into account explicit gender and smart name detection.
 */
export const getStudentGender = (student?: { gender?: 'male' | 'female'; name?: string }): 'male' | 'female' => {
  if (!student) return 'male';
  if (student.gender === 'female' || student.gender === 'male') {
    return student.gender;
  }
  return isLikelyFemaleStudent(student.name) ? 'female' : 'male';
};

/**
 * Returns Arabic title label: 'الطالبة' or 'الطالب'
 */
export const getStudentRoleLabel = (student?: { gender?: 'male' | 'female'; name?: string }): string => {
  return getStudentGender(student) === 'female' ? 'الطالبة' : 'الطالب';
};

/**
 * Returns gender-aware attendance string
 */
export const getArabicAttendanceString = (
  status: 'present' | 'late' | 'absent' | string,
  gender: 'male' | 'female'
): string => {
  if (gender === 'female') {
    return status === 'present' ? 'حاضرة ✅' : status === 'late' ? 'متأخرة ⚠️' : 'غائبة ❌';
  }
  return status === 'present' ? 'حاضر ✅' : status === 'late' ? 'متأخر ⚠️' : 'غائب ❌';
};
