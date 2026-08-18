import { 
  Student, Group, Lesson, PaymentRecord, NotificationItem, 
  TeacherProfile, NotificationSettings, InspirationSettings, InspirationMessage, TodoItem 
} from '../types';
import { formatLocalDate } from './timeUtils';

export type BackupCategory = 
  | 'students'
  | 'groups'
  | 'attendance'
  | 'homework'
  | 'exams'
  | 'financial'
  | 'schedule'
  | 'availability'
  | 'settings'
  | 'templates'
  | 'meeting_links'
  | 'reports'
  | 'dashboard'
  | 'notifications';

export const ALL_BACKUP_CATEGORIES: { id: BackupCategory; labelKey: string; labelEn: string; labelAr: string; icon: string; descriptionEn: string; descriptionAr: string }[] = [
  { id: 'students', labelKey: 'students', labelEn: 'Students', labelAr: 'الطلاب', icon: 'User', descriptionEn: 'All student profiles, parents, & notes', descriptionAr: 'جميع ملفات الطلاب وأولياء الأمور والملاحظات' },
  { id: 'groups', labelKey: 'groups', labelEn: 'Groups', labelAr: 'المجموعات', icon: 'Users', descriptionEn: 'Groups, schedules, packages, & prices', descriptionAr: 'المجموعات والمواعيد والأسعار والحيّز الزمني' },
  { id: 'attendance', labelKey: 'attendance', labelEn: 'Attendance Records', labelAr: 'سجلات الحضور', icon: 'CheckSquare', descriptionEn: 'Detailed attendance status per lesson', descriptionAr: 'سجلات الحضور والغياب والتأخير للحصص' },
  { id: 'homework', labelKey: 'homework', labelEn: 'Homework Records', labelAr: 'سجلات الواجبات', icon: 'BookOpen', descriptionEn: 'Homework completion & assignments', descriptionAr: 'سجلات متابعة وتسليم الواجبات المنزلية' },
  { id: 'exams', labelKey: 'exams', labelEn: 'Exams & Quiz Scores', labelAr: 'الدرجات والاختبارات', icon: 'Award', descriptionEn: 'Quiz, exam, and participation scores', descriptionAr: 'درجات الاختبارات القصيرة والامتحانات والتفاعل' },
  { id: 'financial', labelKey: 'financial', labelEn: 'Financial Records & Payments', labelAr: 'المدفوعات والسجلات المالية', icon: 'DollarSign', descriptionEn: 'Payment transactions, dues, & balances', descriptionAr: 'سجلات الدفع والرسوم المستحقة والمتحصلات' },
  { id: 'schedule', labelKey: 'schedule', labelEn: 'Schedule & Lessons', labelAr: 'الجدول والحصص', icon: 'Calendar', descriptionEn: 'Scheduled, completed, & past lessons', descriptionAr: 'جميع الحصص المجدولة والمكتملة والتاريخية' },
  { id: 'availability', labelKey: 'availability', labelEn: 'Teacher Working Hours', labelAr: 'ساعات العمل والإتاحة', icon: 'Clock', descriptionEn: 'Weekly working hours & availability rules', descriptionAr: 'ساعات العمل الأسبوعية وأيام العطلات' },
  { id: 'settings', labelKey: 'settings', labelEn: 'App Settings', labelAr: 'إعدادات التطبيق', icon: 'Settings', descriptionEn: 'Theme, language, currency, & profile details', descriptionAr: 'اللغة والمظهر والعملة وملف المعلم' },
  { id: 'templates', labelKey: 'templates', labelEn: 'WhatsApp Message Templates', labelAr: 'قوالب واتساب', icon: 'MessageSquare', descriptionEn: 'Custom messaging templates for parents', descriptionAr: 'قوالب الرسائل المخصصة لأولياء الأمور' },
  { id: 'meeting_links', labelKey: 'meeting_links', labelEn: 'Meeting Links (Zoom / Meet)', labelAr: 'روابط الاجتماعات (زوم / ميت)', icon: 'Video', descriptionEn: 'Default Zoom & Google Meet links', descriptionAr: 'روابط زوم وجوجل ميت الافتراضية' },
  { id: 'reports', labelKey: 'reports', labelEn: 'Reports & Statistics', labelAr: 'التقارير والإحصائيات', icon: 'FileText', descriptionEn: 'Generated parent summaries & reports', descriptionAr: 'تقارير الحصص والملخصات المطبوعة' },
  { id: 'dashboard', labelKey: 'dashboard', labelEn: 'Dashboard Preferences', labelAr: 'تفضيلات الشاشة الرئيسية', icon: 'Layout', descriptionEn: 'Dismissed widget cards & layout options', descriptionAr: 'إعدادات البطاقات والخيارات المعروضة' },
  { id: 'notifications', labelKey: 'notifications', labelEn: 'Notifications & Reminders', labelAr: 'الإشعارات والتذكيرات', icon: 'Bell', descriptionEn: 'Notification logs & reminder rules', descriptionAr: 'سجل التنبيهات وإعدادات التذكير' },
];

export interface SmartBackupPayload {
  app: 'TeacherAssistant';
  version: string;
  timestamp: string;
  backupType: 'Full' | 'Partial';
  encrypted: boolean;
  categories: BackupCategory[];
  counts: {
    students: number;
    groups: number;
    lessons: number;
    attendance: number;
    homework: number;
    exams: number;
    payments: number;
    notifications: number;
    todos: number;
    [key: string]: number;
  };
  metadata?: {
    teacherName?: string;
    totalRecords?: number;
    estimatedSizeKb?: number;
  };
  encryptedData?: string;
  data?: {
    profile?: TeacherProfile;
    groups?: Group[];
    students?: Student[];
    lessons?: Lesson[];
    payments?: PaymentRecord[];
    notifications?: NotificationItem[];
    notificationSettings?: NotificationSettings;
    inspirationSettings?: InspirationSettings;
    inspirationMessages?: InspirationMessage[];
    todos?: TodoItem[];
    workingHours?: any;
    parentMessageTemplates?: Record<string, string>;
    meetingLinks?: { defaultZoomLink?: string; defaultMeetLink?: string };
    dashboardPrefs?: any;
  };
}

export interface RestoreAnalysisResult {
  isValid: boolean;
  isEncrypted: boolean;
  version: string;
  timestamp: string;
  backupType: 'Full' | 'Partial';
  categories: BackupCategory[];
  counts: {
    students: number;
    groups: number;
    lessons: number;
    attendance: number;
    homework: number;
    exams: number;
    payments: number;
    notifications: number;
    settingsIncluded: boolean;
  };
  impact: {
    addStudents: number;
    updateStudents: number;
    addGroups: number;
    updateGroups: number;
    addLessons: number;
    updateLessons: number;
    addPayments: number;
    updatePayments: number;
    duplicateEntries: number;
    conflicts: number;
  };
  payload?: SmartBackupPayload;
  errorMessage?: string;
}

export interface RestoreHistoryEntry {
  id: string;
  timestamp: string;
  backupName: string;
  mode: 'smart' | 'merge' | 'replace';
  categories: BackupCategory[];
  status: 'success' | 'rolled_back' | 'failed';
  totalRecordsAdded: number;
  totalRecordsUpdated: number;
  notes?: string;
}

// Helper: Encrypt standard string using Web Crypto API or Salted XOR + Base64
export async function encryptBackupData(dataObj: any, password?: string): Promise<string> {
  const jsonString = JSON.stringify(dataObj);
  if (!password || password.trim() === '') {
    return jsonString;
  }
  
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const enc = new TextEncoder();
      const passBytes = enc.encode(password);
      const dataBytes = enc.encode(jsonString);
      
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw', passBytes, { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
      );
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBytes
      );
      
      const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);
      
      return btoa(String.fromCharCode(...combined));
    }
  } catch (err) {
    console.warn('SubtleCrypto encryption failed, using fallback:', err);
  }
  
  // Fallback simple salted encoding
  const salt = password + '_TA_SALT_2026';
  let result = '';
  for (let i = 0; i < jsonString.length; i++) {
    const charCode = jsonString.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(encodeURIComponent(result));
}

// Helper: Decrypt string using Web Crypto API or Salted XOR + Base64
export async function decryptBackupData(encryptedStr: string, password?: string): Promise<any> {
  if (!password || password.trim() === '') {
    return JSON.parse(encryptedStr);
  }
  
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const binaryString = atob(encryptedStr);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      if (bytes.length > 28) {
        const salt = bytes.slice(0, 16);
        const iv = bytes.slice(16, 28);
        const ciphertext = bytes.slice(28);
        
        const enc = new TextEncoder();
        const passBytes = enc.encode(password);
        
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw', passBytes, { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
        );
        
        const key = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256',
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          ciphertext
        );
        
        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decryptedBuffer));
      }
    }
  } catch (err) {
    console.warn('SubtleCrypto decryption failed, trying fallback:', err);
  }
  
  // Fallback simple salted decoding
  try {
    const rawStr = decodeURIComponent(atob(encryptedStr));
    const salt = password + '_TA_SALT_2026';
    let result = '';
    for (let i = 0; i < rawStr.length; i++) {
      const charCode = rawStr.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
      result += String.fromCharCode(charCode);
    }
    return JSON.parse(result);
  } catch (e) {
    throw new Error('Invalid encryption password or corrupted file.');
  }
}

// Calculate sizes and records
export function calculateBackupStats(
  selectedCategories: BackupCategory[],
  appState: {
    students: Student[];
    groups: Group[];
    lessons: Lesson[];
    payments: PaymentRecord[];
    notifications: NotificationItem[];
    profile: TeacherProfile;
    notificationSettings?: NotificationSettings;
    inspirationSettings?: InspirationSettings;
    inspirationMessages?: InspirationMessage[];
    todos?: TodoItem[];
  }
) {
  let studentCount = 0;
  let groupCount = 0;
  let lessonCount = 0;
  let attendanceCount = 0;
  let homeworkCount = 0;
  let examCount = 0;
  let paymentCount = 0;
  let notificationCount = 0;
  let todoCount = 0;

  if (selectedCategories.includes('students')) studentCount = appState.students.length;
  if (selectedCategories.includes('groups')) groupCount = appState.groups.length;
  if (selectedCategories.includes('schedule')) lessonCount = appState.lessons.length;
  if (selectedCategories.includes('financial')) paymentCount = appState.payments.length;
  if (selectedCategories.includes('notifications')) notificationCount = appState.notifications.length;
  
  if (selectedCategories.includes('attendance')) {
    attendanceCount = appState.lessons.filter(l => l.report?.attendanceStatus || l.report?.studentAttendance).length;
  }
  if (selectedCategories.includes('homework')) {
    homeworkCount = appState.lessons.filter(l => l.report?.homeworkStatus || l.report?.homeworkTitle).length;
  }
  if (selectedCategories.includes('exams')) {
    examCount = appState.lessons.filter(l => 
      l.report?.quizScore !== undefined || 
      l.report?.examScore !== undefined || 
      l.report?.dictationScore || 
      l.report?.arabicExamScore
    ).length;
  }

  const totalRecords = studentCount + groupCount + lessonCount + paymentCount + notificationCount;
  
  // Estimate size KB (~150 bytes per student, 200 per lesson, 180 per payment)
  const estimatedSizeBytes = Math.max(
    1024,
    (studentCount * 180) + (groupCount * 250) + (lessonCount * 320) + (paymentCount * 220) + 1500
  );
  
  const estimatedSizeKb = Math.round(estimatedSizeBytes / 1024);
  const isFull = selectedCategories.length === ALL_BACKUP_CATEGORIES.length;

  return {
    studentCount,
    groupCount,
    lessonCount,
    attendanceCount,
    homeworkCount,
    examCount,
    paymentCount,
    notificationCount,
    totalRecords,
    estimatedSizeKb,
    isFull,
    coveragePercentage: Math.round((selectedCategories.length / ALL_BACKUP_CATEGORIES.length) * 100)
  };
}

// Generate formatted Backup filename
export function generateBackupFilename(isFull: boolean): string {
  const now = new Date();
  const dateStr = formatLocalDate(now);
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const typeTag = isFull ? 'Full' : 'Partial';
  return `TeacherAssistant_Backup_${typeTag}_${dateStr}_${hours}-${mins}.json`;
}

// Analyze backup payload against current app state
export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  version: string;
  data: {
    profile?: TeacherProfile;
    groups: Group[];
    students: Student[];
    lessons: Lesson[];
    payments: PaymentRecord[];
    notifications: NotificationItem[];
    notificationSettings?: NotificationSettings;
    inspirationSettings?: InspirationSettings;
    inspirationMessages?: InspirationMessage[];
    todos?: TodoItem[];
    [key: string]: any;
  };
}

export function validateAndSanitizeBackupPayload(rawParsed: any): ValidationResult {
  if (!rawParsed || typeof rawParsed !== 'object' || Array.isArray(rawParsed)) {
    return {
      isValid: false,
      errorMessage: 'Invalid backup file structure: expected a JSON object.',
      version: '1.0.0',
      data: { groups: [], students: [], lessons: [], payments: [], notifications: [] }
    };
  }

  // Version check
  const version = String(rawParsed.version || rawParsed.data?.version || '1.0.0');
  const majorVersion = parseInt(version.split('.')[0], 10);
  if (!isNaN(majorVersion) && majorVersion > 2) {
    return {
      isValid: false,
      errorMessage: `Unsupported backup version (v${version}). Please update the app to restore this backup.`,
      version,
      data: { groups: [], students: [], lessons: [], payments: [], notifications: [] }
    };
  }

  const data = rawParsed.data || rawParsed;

  // Collection array type checks
  const collectionsToCheck = [
    { key: 'students', label: 'students' },
    { key: 'groups', label: 'groups' },
    { key: 'lessons', label: 'lessons' },
    { key: 'payments', label: 'payments' },
    { key: 'notifications', label: 'notifications' },
    { key: 'todos', label: 'todos' },
    { key: 'inspirationMessages', label: 'inspirationMessages' }
  ];

  for (const col of collectionsToCheck) {
    const val = data[col.key];
    if (val !== undefined && val !== null && !Array.isArray(val)) {
      return {
        isValid: false,
        errorMessage: `Invalid backup format: '${col.label}' must be an array, but received ${typeof val}.`,
        version,
        data: { groups: [], students: [], lessons: [], payments: [], notifications: [] }
      };
    }
  }

  const sanitizeNumber = (val: any, fallback: number = 0): number => {
    if (typeof val === 'number') {
      return Number.isFinite(val) && !isNaN(val) ? val : fallback;
    }
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = Number(val);
      return Number.isFinite(parsed) && !isNaN(parsed) ? parsed : fallback;
    }
    return fallback;
  };

  const sanitizeOptionalNumber = (val: any): number | undefined => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'number') {
      return Number.isFinite(val) && !isNaN(val) ? val : undefined;
    }
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = Number(val);
      return Number.isFinite(parsed) && !isNaN(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  // Sanitize Students
  const rawStudents: any[] = Array.isArray(data.students) ? data.students : [];
  const sanitizedStudents: Student[] = [];
  for (let i = 0; i < rawStudents.length; i++) {
    const s = rawStudents[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) continue;

    const id = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `st_imp_${Date.now()}_${i}`;
    const name = typeof s.name === 'string' ? s.name : (s.name ? String(s.name) : 'Unnamed Student');
    const groupId = typeof s.groupId === 'string' ? s.groupId : '';

    let avatarUrl = s.avatarUrl;
    if (typeof avatarUrl === 'string' && avatarUrl.length > 1000000) {
      avatarUrl = undefined;
    }

    sanitizedStudents.push({
      ...s,
      id,
      name,
      groupId,
      parentPhone: typeof s.parentPhone === 'string' ? s.parentPhone : '',
      studentPhone: typeof s.studentPhone === 'string' ? s.studentPhone : '',
      notes: typeof s.notes === 'string' ? s.notes : '',
      avatarUrl,
      attendanceRate: sanitizeOptionalNumber(s.attendanceRate),
      homeworkRate: sanitizeOptionalNumber(s.homeworkRate),
      examAverage: sanitizeOptionalNumber(s.examAverage),
      customBalance: sanitizeOptionalNumber(s.customBalance),
      completedLessonsCount: sanitizeOptionalNumber(s.completedLessonsCount),
      documents: Array.isArray(s.documents) ? s.documents : []
    });
  }

  // Sanitize Groups
  const rawGroups: any[] = Array.isArray(data.groups) ? data.groups : [];
  const sanitizedGroups: Group[] = [];
  for (let i = 0; i < rawGroups.length; i++) {
    const g = rawGroups[i];
    if (!g || typeof g !== 'object' || Array.isArray(g)) continue;

    const id = typeof g.id === 'string' && g.id.trim() ? g.id.trim() : `grp_imp_${Date.now()}_${i}`;
    const name = typeof g.name === 'string' ? g.name : 'Unnamed Group';

    sanitizedGroups.push({
      ...g,
      id,
      name,
      grade: typeof g.grade === 'string' ? g.grade : '',
      subject: typeof g.subject === 'string' ? g.subject : '',
      type: (g.type === 'online' || g.type === 'offline') ? g.type : 'offline',
      sessionCount: sanitizeNumber(g.sessionCount, 0),
      pricePerSession: sanitizeNumber(g.pricePerSession, 0),
      monthlyPackagePrice: sanitizeNumber(g.monthlyPackagePrice, 0),
      startingSessionNumber: sanitizeNumber(g.startingSessionNumber, 1),
      price: sanitizeNumber(g.price, 0),
      studentIds: Array.isArray(g.studentIds) ? g.studentIds.filter((sid: any) => typeof sid === 'string') : [],
      schedules: Array.isArray(g.schedules) ? g.schedules : []
    });
  }

  // Sanitize Lessons
  const rawLessons: any[] = Array.isArray(data.lessons) ? data.lessons : [];
  const sanitizedLessons: Lesson[] = [];
  for (let i = 0; i < rawLessons.length; i++) {
    const l = rawLessons[i];
    if (!l || typeof l !== 'object' || Array.isArray(l)) continue;

    const id = typeof l.id === 'string' && l.id.trim() ? l.id.trim() : `les_imp_${Date.now()}_${i}`;
    const date = typeof l.date === 'string' ? l.date : new Date().toISOString().split('T')[0];
    const validStatuses = ['scheduled', 'completed', 'cancelled', 'moved'];
    const status = validStatuses.includes(l.status) ? l.status : 'scheduled';

    let report = l.report;
    if (report && typeof report === 'object') {
      report = {
        ...report,
        quizScore: sanitizeOptionalNumber(report.quizScore),
        examScore: sanitizeOptionalNumber(report.examScore),
        dictationScore: sanitizeOptionalNumber(report.dictationScore),
        arabicExamScore: sanitizeOptionalNumber(report.arabicExamScore)
      };
    }

    sanitizedLessons.push({
      ...l,
      id,
      date,
      status,
      groupId: typeof l.groupId === 'string' ? l.groupId : '',
      studentId: typeof l.studentId === 'string' ? l.studentId : undefined,
      sessionNumber: sanitizeOptionalNumber(l.sessionNumber),
      price: sanitizeOptionalNumber(l.price),
      report
    });
  }

  // Sanitize Payments
  const rawPayments: any[] = Array.isArray(data.payments) ? data.payments : [];
  const sanitizedPayments: PaymentRecord[] = [];
  for (let i = 0; i < rawPayments.length; i++) {
    const p = rawPayments[i];
    if (!p || typeof p !== 'object' || Array.isArray(p)) continue;

    const id = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `pay_imp_${Date.now()}_${i}`;
    const validStatuses = ['paid', 'pending', 'overdue', 'partially_paid'];
    const status = validStatuses.includes(p.status) ? p.status : 'pending';

    sanitizedPayments.push({
      ...p,
      id,
      status,
      studentId: typeof p.studentId === 'string' ? p.studentId : '',
      groupId: typeof p.groupId === 'string' ? p.groupId : '',
      amountDue: Math.max(0, sanitizeNumber(p.amountDue, 0)),
      amountPaid: Math.max(0, sanitizeNumber(p.amountPaid, 0)),
      discountAmount: Math.max(0, sanitizeNumber(p.discountAmount, 0)),
      bundleSize: Math.max(0, sanitizeNumber(p.bundleSize, 0)),
      lessonIds: Array.isArray(p.lessonIds) ? p.lessonIds.filter((lid: any) => typeof lid === 'string') : []
    });
  }

  // Sanitize Notifications
  const rawNotifications: any[] = Array.isArray(data.notifications) ? data.notifications : [];
  const sanitizedNotifications: NotificationItem[] = [];
  for (let i = 0; i < rawNotifications.length; i++) {
    const n = rawNotifications[i];
    if (!n || typeof n !== 'object' || Array.isArray(n)) continue;

    const id = typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `notif_imp_${Date.now()}_${i}`;
    sanitizedNotifications.push({
      ...n,
      id,
      title: typeof n.title === 'string' ? n.title : 'Notification',
      message: typeof n.message === 'string' ? n.message : '',
      date: typeof n.date === 'string' ? n.date : new Date().toISOString(),
      read: Boolean(n.read)
    });
  }

  return {
    isValid: true,
    version,
    data: {
      ...data,
      students: sanitizedStudents,
      groups: sanitizedGroups,
      lessons: sanitizedLessons,
      payments: sanitizedPayments,
      notifications: sanitizedNotifications,
      profile: data.profile && typeof data.profile === 'object' ? data.profile : undefined,
      notificationSettings: data.notificationSettings && typeof data.notificationSettings === 'object' ? data.notificationSettings : undefined,
      inspirationSettings: data.inspirationSettings && typeof data.inspirationSettings === 'object' ? data.inspirationSettings : undefined,
      inspirationMessages: Array.isArray(data.inspirationMessages) ? data.inspirationMessages : undefined,
      todos: Array.isArray(data.todos) ? data.todos : undefined
    }
  };
}

export function analyzeBackupPayload(
  rawParsed: any,
  currentAppState: {
    students: Student[];
    groups: Group[];
    lessons: Lesson[];
    payments: PaymentRecord[];
    notifications: NotificationItem[];
    profile: TeacherProfile;
  }
): RestoreAnalysisResult {
  try {
    if (!rawParsed || typeof rawParsed !== 'object') {
      return {
        isValid: false,
        isEncrypted: false,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        backupType: 'Partial',
        categories: [],
        counts: { students: 0, groups: 0, lessons: 0, attendance: 0, homework: 0, exams: 0, payments: 0, notifications: 0, settingsIncluded: false },
        impact: { addStudents: 0, updateStudents: 0, addGroups: 0, updateGroups: 0, addLessons: 0, updateLessons: 0, addPayments: 0, updatePayments: 0, duplicateEntries: 0, conflicts: 0 },
        errorMessage: 'Invalid or unreadable backup structure.'
      };
    }

    if (rawParsed.encrypted && !rawParsed.data && rawParsed.encryptedData) {
      return {
        isValid: true,
        isEncrypted: true,
        version: rawParsed.version || '2.0.0',
        timestamp: rawParsed.timestamp || new Date().toISOString(),
        backupType: rawParsed.backupType || 'Full',
        categories: rawParsed.categories || ALL_BACKUP_CATEGORIES.map(c => c.id),
        counts: {
          students: rawParsed.counts?.students || 0,
          groups: rawParsed.counts?.groups || 0,
          lessons: rawParsed.counts?.lessons || 0,
          attendance: rawParsed.counts?.attendance || 0,
          homework: rawParsed.counts?.homework || 0,
          exams: rawParsed.counts?.exams || 0,
          payments: rawParsed.counts?.payments || 0,
          notifications: rawParsed.counts?.notifications || 0,
          settingsIncluded: true
        },
        impact: { addStudents: 0, updateStudents: 0, addGroups: 0, updateGroups: 0, addLessons: 0, updateLessons: 0, addPayments: 0, updatePayments: 0, duplicateEntries: 0, conflicts: 0 },
        payload: rawParsed
      };
    }

    // Run schema validation and sanitization
    const validation = validateAndSanitizeBackupPayload(rawParsed);
    if (!validation.isValid) {
      return {
        isValid: false,
        isEncrypted: false,
        version: validation.version || '1.0.0',
        timestamp: new Date().toISOString(),
        backupType: 'Partial',
        categories: [],
        counts: { students: 0, groups: 0, lessons: 0, attendance: 0, homework: 0, exams: 0, payments: 0, notifications: 0, settingsIncluded: false },
        impact: { addStudents: 0, updateStudents: 0, addGroups: 0, updateGroups: 0, addLessons: 0, updateLessons: 0, addPayments: 0, updatePayments: 0, duplicateEntries: 0, conflicts: 0 },
        errorMessage: validation.errorMessage || 'Invalid backup structure.'
      };
    }

    // Standard or legacy backup
    const data = validation.data;
    const students: Student[] = data.students || [];
    const groups: Group[] = data.groups || [];
    const lessons: Lesson[] = data.lessons || [];
    const payments: PaymentRecord[] = data.payments || [];
    const notifications: NotificationItem[] = data.notifications || [];

    // Analyze impact
    const existingStudentIds = new Set(currentAppState.students.map(s => s.id));
    const existingStudentKeys = new Set(currentAppState.students.map(s => `${s.name.trim().toLowerCase()}_${s.parentPhone || ''}`));
    let addStudents = 0;
    let updateStudents = 0;

    students.forEach(s => {
      const key = `${s.name.trim().toLowerCase()}_${s.parentPhone || ''}`;
      if (existingStudentIds.has(s.id) || existingStudentKeys.has(key)) {
        updateStudents++;
      } else {
        addStudents++;
      }
    });

    const existingGroupIds = new Set(currentAppState.groups.map(g => g.id));
    const existingGroupNames = new Set(currentAppState.groups.map(g => g.name.trim().toLowerCase()));
    let addGroups = 0;
    let updateGroups = 0;

    groups.forEach(g => {
      if (existingGroupIds.has(g.id) || existingGroupNames.has(g.name.trim().toLowerCase())) {
        updateGroups++;
      } else {
        addGroups++;
      }
    });

    const existingLessonIds = new Set(currentAppState.lessons.map(l => l.id));
    let addLessons = 0;
    let updateLessons = 0;

    lessons.forEach(l => {
      if (existingLessonIds.has(l.id)) {
        updateLessons++;
      } else {
        addLessons++;
      }
    });

    const existingPaymentIds = new Set(currentAppState.payments.map(p => p.id));
    let addPayments = 0;
    let updatePayments = 0;

    payments.forEach(p => {
      if (existingPaymentIds.has(p.id)) {
        updatePayments++;
      } else {
        addPayments++;
      }
    });

    const attendanceCount = lessons.filter(l => l.report?.attendanceStatus || l.report?.studentAttendance).length;
    const homeworkCount = lessons.filter(l => l.report?.homeworkStatus || l.report?.homeworkTitle).length;
    const examCount = lessons.filter(l => l.report?.quizScore !== undefined || l.report?.examScore !== undefined || l.report?.arabicExamScore).length;

    // Detect available categories
    const categories: BackupCategory[] = rawParsed.categories || [];
    if (categories.length === 0) {
      if (students.length > 0) categories.push('students');
      if (groups.length > 0) categories.push('groups');
      if (lessons.length > 0) categories.push('schedule');
      if (payments.length > 0) categories.push('financial');
      if (notifications.length > 0) categories.push('notifications');
      if (attendanceCount > 0) categories.push('attendance');
      if (homeworkCount > 0) categories.push('homework');
      if (examCount > 0) categories.push('exams');
      if (data.profile) {
        categories.push('settings', 'availability', 'templates', 'meeting_links');
      }
    }

    return {
      isValid: true,
      isEncrypted: false,
      version: rawParsed.version || '2.0.0',
      timestamp: rawParsed.timestamp || new Date().toISOString(),
      backupType: rawParsed.backupType || (categories.length >= 10 ? 'Full' : 'Partial'),
      categories,
      counts: {
        students: students.length,
        groups: groups.length,
        lessons: lessons.length,
        attendance: attendanceCount,
        homework: homeworkCount,
        exams: examCount,
        payments: payments.length,
        notifications: notifications.length,
        settingsIncluded: !!data.profile
      },
      impact: {
        addStudents,
        updateStudents,
        addGroups,
        updateGroups,
        addLessons,
        updateLessons,
        addPayments,
        updatePayments,
        duplicateEntries: updateStudents + updateGroups + updateLessons + updatePayments,
        conflicts: 0
      },
      payload: rawParsed
    };
  } catch (err: any) {
    return {
      isValid: false,
      isEncrypted: false,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      backupType: 'Partial',
      categories: [],
      counts: { students: 0, groups: 0, lessons: 0, attendance: 0, homework: 0, exams: 0, payments: 0, notifications: 0, settingsIncluded: false },
      impact: { addStudents: 0, updateStudents: 0, addGroups: 0, updateGroups: 0, addLessons: 0, updateLessons: 0, addPayments: 0, updatePayments: 0, duplicateEntries: 0, conflicts: 0 },
      errorMessage: err.message || 'Failed to parse backup JSON.'
    };
  }
}

