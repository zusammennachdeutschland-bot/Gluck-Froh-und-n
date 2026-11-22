import { Group, Lesson, Student } from '../types';
import { isStudentMatchingLessonWeek } from './scheduleUtils';
import {
  buildWhatsAppUrl,
  cleanPhoneNumberForTel,
  cleanWhatsAppUsername,
  formatWhatsAppPhone,
  isWhatsAppUsername,
} from './phoneUtils';

export interface ResolvedOfflineLocation {
  displayLocation: string;
  hasSpecificLocation: boolean;
  source: 'lesson' | 'group' | 'none';
  mapsUrl: string;
}

export interface StudentWhatsAppTargetResolution {
  canMessageStudent: boolean;
  contact: string;
  cleanForUrl: string;
  isUsername: boolean;
  url: string | null;
}

export interface ParentCallResolution {
  mode: 'modal' | 'tel' | 'none';
  telUrl: string | null;
  modalTitle: string;
  students: Student[];
}

export interface ParentWhatsAppResolution {
  mode: 'group_link' | 'modal' | 'direct' | 'none';
  url: string | null;
  modalTitle: string;
  students: Student[];
  canOpen: boolean;
}

export interface LessonCommunicationTargets {
  targetGroup: Group | null;
  targetStudent: Student | null;
  groupStudents: Student[];
  scheduledStudents: Student[];
  effectiveStudents: Student[];
  isMultiStudentGroup: boolean;
  parentCall: ParentCallResolution;
  parentWhatsApp: ParentWhatsAppResolution;
  studentWhatsApp: StudentWhatsAppTargetResolution;
}

const isMeaningfulValue = (val?: string | null): boolean => {
  if (!val) return false;
  const t = String(val).trim();
  const lower = t.toLowerCase();
  return t !== '' && t !== '-' && t !== '—' && lower !== 'null' && lower !== 'undefined';
};

export const isGenericLocationPlaceholder = (value?: string | null): boolean => {
  if (!value) return true;
  const cleaned = String(value).trim().toLowerCase();
  return !cleaned || cleaned === 'home' || cleaned === 'center';
};

export const hasUsableTelPhone = (phone?: string | null): boolean => {
  if (!isMeaningfulValue(phone)) return false;
  const clean = cleanPhoneNumberForTel(phone);
  const digits = clean.replace(/\D/g, '');
  return digits.length >= 6;
};

export const hasUsableWhatsAppContact = (contact?: string | null): boolean => {
  if (!isMeaningfulValue(contact)) return false;
  const raw = String(contact).trim();
  if (isWhatsAppUsername(raw)) {
    const clean = cleanWhatsAppUsername(raw);
    return /^[a-zA-Z0-9._]{2,}$/.test(clean) && /[a-zA-Z]/.test(clean);
  }
  const cleanPhone = formatWhatsAppPhone(raw);
  return /^\d{7,15}$/.test(cleanPhone);
};

export const resolveTargetGroupForLesson = (
  lesson: Partial<Lesson>,
  groups: Group[] = []
): Group | null => {
  if (lesson.groupId && lesson.groupId !== 'quick_group') {
    const byId = groups.find(g => g.id === lesson.groupId);
    if (byId) return byId;
    const normalizedId = lesson.groupId.trim().toLowerCase();
    const byIdName = groups.find(g => g.name && g.name.trim().toLowerCase() === normalizedId);
    if (byIdName) return byIdName;
  }
  if (lesson.groupName) {
    const normalizedName = lesson.groupName.trim().toLowerCase();
    const byName = groups.find(g => g.name && g.name.trim().toLowerCase() === normalizedName);
    if (byName) return byName;
  }
  return null;
};

export const resolveLessonType = (
  lesson: Partial<Lesson>,
  group?: Group | null
): 'online' | 'offline' => {
  if (lesson.type === 'online') return 'online';
  if (lesson.type === 'offline') return 'offline';
  if (group?.type === 'online') return 'online';
  return 'offline';
};

export const buildOfflineMapsUrl = (
  lesson: Partial<Lesson>,
  group?: Group | null
): string => {
  if (
    group?.coordinates?.lat !== undefined &&
    group?.coordinates?.lng !== undefined &&
    Number.isFinite(group.coordinates.lat) &&
    Number.isFinite(group.coordinates.lng)
  ) {
    return `https://www.google.com/maps?q=${group.coordinates.lat},${group.coordinates.lng}`;
  }

  const rawLessonLocation = String(lesson.location || '').trim();
  const rawGroupAddress = String(group?.address || '').trim();

  let resolvedAddress = '';
  if (!isGenericLocationPlaceholder(rawLessonLocation)) {
    resolvedAddress = rawLessonLocation;
  } else if (!isGenericLocationPlaceholder(rawGroupAddress)) {
    resolvedAddress = rawGroupAddress;
  }

  if (resolvedAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`;
  }

  const fallbackName = String(group?.name || lesson.studentName || lesson.title || '').trim();
  if (fallbackName) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackName)}`;
  }
  return 'https://www.google.com/maps';
};

export const resolveOfflineLessonLocation = (
  lesson: Partial<Lesson>,
  group?: Group | null
): ResolvedOfflineLocation => {
  const rawLessonLocation = String(lesson.location || '').trim();
  const rawGroupAddress = String(group?.address || '').trim();

  let resolvedAddress = '';
  let source: 'lesson' | 'group' | 'none' = 'none';
  if (!isGenericLocationPlaceholder(rawLessonLocation)) {
    resolvedAddress = rawLessonLocation;
    source = 'lesson';
  } else if (!isGenericLocationPlaceholder(rawGroupAddress)) {
    resolvedAddress = rawGroupAddress;
    source = 'group';
  }

  return {
    displayLocation: resolvedAddress,
    hasSpecificLocation: Boolean(resolvedAddress),
    source,
    mapsUrl: buildOfflineMapsUrl(lesson, group),
  };
};

export const resolveRegisteredStudentWhatsAppTarget = (
  student?: Partial<Student> | null,
  lesson?: Partial<Lesson> | null
): StudentWhatsAppTargetResolution => {
  const candidates: Array<{ raw: string; forceUsername?: boolean }> = [];

  if (isMeaningfulValue(student?.studentPhone)) {
    candidates.push({
      raw: String(student!.studentPhone).trim(),
      forceUsername: student?.studentContactType === 'username',
    });
  }
  if (isMeaningfulValue(student?.studentUsername)) {
    candidates.push({
      raw: String(student!.studentUsername).trim(),
      forceUsername: true,
    });
  }
  if (isMeaningfulValue(lesson?.quickStudentPhone)) {
    candidates.push({
      raw: String(lesson!.quickStudentPhone).trim(),
    });
  }

  for (const candidate of candidates) {
    const isUser = Boolean(candidate.forceUsername || isWhatsAppUsername(candidate.raw));
    const clean = isUser
      ? cleanWhatsAppUsername(candidate.raw)
      : formatWhatsAppPhone(candidate.raw);

    if (
      (isUser && /^[a-zA-Z0-9._]{2,}$/.test(clean) && /[a-zA-Z]/.test(clean)) ||
      (!isUser && /^\d{7,15}$/.test(clean))
    ) {
      return {
        canMessageStudent: true,
        contact: isUser ? `@${clean}` : candidate.raw,
        cleanForUrl: clean,
        isUsername: isUser,
        url: buildWhatsAppUrl(clean),
      };
    }
  }

  return {
    canMessageStudent: false,
    contact: '',
    cleanForUrl: '',
    isUsername: false,
    url: null,
  };
};

const resolveParentWhatsAppDirectTarget = (
  student?: Partial<Student> | null,
  lesson?: Partial<Lesson> | null
): { cleanForUrl: string; url: string } | null => {
  const candidates: Array<{ raw: string; forceUsername?: boolean }> = [];

  if (isMeaningfulValue(student?.parentPhone)) {
    candidates.push({
      raw: String(student!.parentPhone).trim(),
      forceUsername: student?.parentContactType === 'username',
    });
  }
  if (isMeaningfulValue(student?.parentUsername)) {
    candidates.push({
      raw: String(student!.parentUsername).trim(),
      forceUsername: true,
    });
  }
  if (isMeaningfulValue(student?.phone)) {
    candidates.push({
      raw: String(student!.phone).trim(),
    });
  }
  if (isMeaningfulValue(lesson?.quickParentPhone)) {
    candidates.push({
      raw: String(lesson!.quickParentPhone).trim(),
    });
  }

  for (const candidate of candidates) {
    const isUser = Boolean(candidate.forceUsername || isWhatsAppUsername(candidate.raw));
    const clean = isUser
      ? cleanWhatsAppUsername(candidate.raw)
      : formatWhatsAppPhone(candidate.raw);

    if (
      (isUser && /^[a-zA-Z0-9._]{2,}$/.test(clean) && /[a-zA-Z]/.test(clean)) ||
      (!isUser && /^\d{7,15}$/.test(clean))
    ) {
      return {
        cleanForUrl: clean,
        url: buildWhatsAppUrl(clean),
      };
    }
  }

  return null;
};

export const hasStudentValidParentWhatsApp = (student: Partial<Student>): boolean => {
  return resolveParentWhatsAppDirectTarget(student, null) !== null;
};

export const resolveLessonCommunicationTargets = (params: {
  lesson: Partial<Lesson>;
  groups: Group[];
  students: Student[];
}): LessonCommunicationTargets => {
  const { lesson, groups, students } = params;
  const targetGroup = resolveTargetGroupForLesson(lesson, groups);

  const activeStudents = (students || []).filter(s => !s.deleted && s.status !== 'archived');
  const groupStudents = targetGroup
    ? activeStudents.filter(s => s.groupId === targetGroup.id)
    : [];
  const scheduledStudents = groupStudents.filter(
    s => !lesson.date || isStudentMatchingLessonWeek(s.scheduleRecurrence, lesson.date)
  );

  const targetStudent =
    activeStudents.find(
      s =>
        (lesson.studentId && s.id === lesson.studentId) ||
        (lesson.studentName &&
          s.name.trim().toLowerCase() === lesson.studentName.trim().toLowerCase())
    ) || null;

  const effectiveGroupStudents =
    scheduledStudents.length > 0 ? scheduledStudents : groupStudents;

  const effectiveStudents: Student[] =
    effectiveGroupStudents.length > 0
      ? effectiveGroupStudents
      : targetStudent
      ? [targetStudent]
      : [];

  const isMultiStudentGroup = effectiveStudents.length > 1;
  const modalTitle =
    targetGroup?.name || lesson.studentName || lesson.title || '';

  // 1. Parent Call resolution
  let parentCall: ParentCallResolution;
  if (isMultiStudentGroup) {
    parentCall = {
      mode: 'modal',
      telUrl: null,
      modalTitle,
      students: effectiveStudents,
    };
  } else {
    const singleStudent = effectiveStudents[0] || targetStudent;
    const rawCallPhone =
      (isMeaningfulValue(singleStudent?.parentPhone) ? singleStudent!.parentPhone.trim() : '') ||
      (isMeaningfulValue(singleStudent?.phone) ? singleStudent!.phone!.trim() : '') ||
      (isMeaningfulValue(lesson.quickParentPhone) ? String(lesson.quickParentPhone).trim() : '');

    if (hasUsableTelPhone(rawCallPhone)) {
      const cleanTel = cleanPhoneNumberForTel(rawCallPhone);
      parentCall = {
        mode: 'tel',
        telUrl: `tel:${cleanTel}`,
        modalTitle: singleStudent?.name || modalTitle,
        students: effectiveStudents,
      };
    } else if (effectiveStudents.length === 1) {
      parentCall = {
        mode: 'modal',
        telUrl: null,
        modalTitle: singleStudent?.name || modalTitle,
        students: effectiveStudents,
      };
    } else {
      parentCall = {
        mode: 'none',
        telUrl: null,
        modalTitle,
        students: [],
      };
    }
  }

  // 2. Parent / Group WhatsApp resolution (NEVER returns blank https://wa.me/)
  let parentWhatsApp: ParentWhatsAppResolution;
  const groupLink = targetGroup?.whatsAppGroupLink?.trim() || '';
  if (isMultiStudentGroup) {
    if (groupLink) {
      parentWhatsApp = {
        mode: 'group_link',
        url: groupLink,
        modalTitle,
        students: effectiveStudents,
        canOpen: true,
      };
    } else {
      parentWhatsApp = {
        mode: 'modal',
        url: null,
        modalTitle,
        students: effectiveStudents,
        canOpen: true,
      };
    }
  } else {
    const singleStudent = effectiveStudents[0] || targetStudent;
    const directParent = resolveParentWhatsAppDirectTarget(singleStudent, lesson);
    if (directParent) {
      parentWhatsApp = {
        mode: 'direct',
        url: directParent.url,
        modalTitle,
        students: effectiveStudents,
        canOpen: true,
      };
    } else {
      parentWhatsApp = {
        mode: 'none',
        url: null,
        modalTitle,
        students: effectiveStudents,
        canOpen: false,
      };
    }
  }

  // 3. Dedicated Student WhatsApp (only for single-student with valid registered student contact)
  const studentWhatsApp = !isMultiStudentGroup
    ? resolveRegisteredStudentWhatsAppTarget(effectiveStudents[0] || targetStudent, lesson)
    : {
        canMessageStudent: false,
        contact: '',
        cleanForUrl: '',
        isUsername: false,
        url: null,
      };

  return {
    targetGroup,
    targetStudent,
    groupStudents,
    scheduledStudents,
    effectiveStudents,
    isMultiStudentGroup,
    parentCall,
    parentWhatsApp,
    studentWhatsApp,
  };
};
