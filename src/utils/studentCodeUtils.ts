import { Student } from '../types';

/**
 * Derives or formats a clean, human-readable student code (e.g. STU-1001, STU-2048)
 * Ensures consistency across the offline application and the Parent Portal.
 */
export function getStudentCode(
  student: Partial<Student> | { id?: string; studentCode?: string; name?: string } | null | undefined
): string {
  if (!student) return 'STU-1001';

  // 1. Explicit code assigned to student
  if (student.studentCode && student.studentCode.trim()) {
    const raw = student.studentCode.trim();
    if (raw.toUpperCase().startsWith('STU-')) return raw.toUpperCase();
    return `STU-${raw.toUpperCase()}`;
  }

  const id = (student.id || '').trim();
  if (id) {
    // If it's already a short format like stu-1001, stu1001, s1001, s_1001
    const matchStu = id.match(/^(?:stu|student|s)[-_]?([a-zA-Z0-9]+)$/i);
    if (matchStu && matchStu[1]) {
      const val = matchStu[1];
      if (/^\d+$/.test(val)) {
        return `STU-${val.padStart(4, '0')}`;
      }
      // If alphanumeric timestamp like s_1726123456789_abc
      const digits = val.replace(/\D/g, '');
      if (digits.length >= 4) {
        return `STU-${digits.slice(-4)}`;
      }
      return `STU-${val.toUpperCase().slice(0, 6)}`;
    }

    // If ID contains digits, extract the last 4 digits
    const digitsOnly = id.replace(/\D/g, '');
    if (digitsOnly.length >= 4) {
      return `STU-${digitsOnly.slice(-4)}`;
    }
    if (digitsOnly.length > 0) {
      return `STU-${digitsOnly.padStart(4, '0')}`;
    }

    // Stable Hash fallback
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0;
    }
    const codeNum = Math.abs(hash) % 9000 + 1000;
    return `STU-${codeNum}`;
  }

  if (student.name) {
    let hash = 0;
    for (let i = 0; i < student.name.length; i++) {
      hash = ((hash << 5) - hash) + student.name.charCodeAt(i);
      hash |= 0;
    }
    const codeNum = Math.abs(hash) % 9000 + 1000;
    return `STU-${codeNum}`;
  }

  return 'STU-1001';
}

/**
 * Generates parent portal share text or link
 */
export function buildParentPortalShareText(
  studentName: string,
  studentCode: string,
  teacherName?: string,
  portalUrl?: string
): string {
  const url = portalUrl || 'https://parent-portal.vercel.app';
  const teacher = teacherName ? `أ. ${teacherName}` : 'معلم المادة';

  return `🇩🇪 *بوابة متابعة ولي الأمر والدرجات* 🇩🇪
أهلاً بحضرتك ولي أمر الطالب/ـة: *${studentName}* 🌸

يمكنكم الآن متابعة تقارير الحصص، الواجبات، الدرجات، الشهادات وتسجيلات الحصص أولاً بأول عبر الرابط:
🔗 ${url}

🔑 *كود الدخول المباشر للطالب:*
👉 \`${studentCode}\`

(أو يمكنكم إدخال رقم هاتف ولي الأمر المسجل للدخول مباشرة)

مع خالص التحيات والتقدير،
${teacher} 🇩🇪`;
}
