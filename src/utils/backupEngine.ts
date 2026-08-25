import { 
  Student, Group, Lesson, PaymentRecord, NotificationItem, 
  TeacherProfile, NotificationSettings, InspirationSettings, InspirationMessage, TodoItem,
  CertificateRecord, SchoolSettings, StageManager, StageSecretary, VisitRecord, BookletObservation,
  WeeklyPlanStatusRecord, StageReportRecord, StageFollowUpRecord, Complaint, StudentActionPlan,
  Teacher, ParentComplaint, HodGermanStudent, AICertificateBackground, SchoolNote,
  FinanceAccount, FinanceCategory, FinanceTransaction, FinanceRecurring, FinanceInstallment
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
  | 'school_hod'
  | 'availability'
  | 'settings'
  | 'templates'
  | 'meeting_links'
  | 'reports'
  | 'dashboard'
  | 'notifications'
  | 'certificates'
  | 'school_notes';

export const ALL_BACKUP_CATEGORIES: { id: BackupCategory; labelKey: string; labelEn: string; labelAr: string; icon: string; descriptionEn: string; descriptionAr: string }[] = [
  { id: 'students', labelKey: 'students', labelEn: 'Students', labelAr: 'الطلاب', icon: 'User', descriptionEn: 'All student profiles, parents, & notes', descriptionAr: 'جميع ملفات الطلاب وأولياء الأمور والملاحظات' },
  { id: 'groups', labelKey: 'groups', labelEn: 'Groups', labelAr: 'المجموعات', icon: 'Users', descriptionEn: 'Groups, schedules, packages, & prices', descriptionAr: 'المجموعات والمواعيد والأسعار والحيّز الزمني' },
  { id: 'attendance', labelKey: 'attendance', labelEn: 'Attendance Records', labelAr: 'سجلات الحضور', icon: 'CheckSquare', descriptionEn: 'Detailed attendance status per lesson', descriptionAr: 'سجلات الحضور والغياب والتأخير للحصص' },
  { id: 'homework', labelKey: 'homework', labelEn: 'Homework Records', labelAr: 'سجلات الواجبات', icon: 'BookOpen', descriptionEn: 'Homework completion & assignments', descriptionAr: 'سجلات متابعة وتسليم الواجبات المنزلية' },
  { id: 'exams', labelKey: 'exams', labelEn: 'Exams & Quiz Scores', labelAr: 'الدرجات والاختبارات', icon: 'Award', descriptionEn: 'Quiz, exam, and participation scores', descriptionAr: 'درجات الاختبارات القصيرة والامتحانات والتفاعل' },
  { id: 'financial', labelKey: 'financial', labelEn: 'Financial Records & Payments', labelAr: 'المدفوعات والسجلات المالية', icon: 'DollarSign', descriptionEn: 'Payment transactions, dues, & balances', descriptionAr: 'سجلات الدفع والرسوم المستحقة والمتحصلات' },
  { id: 'schedule', labelKey: 'schedule', labelEn: 'Schedule & Lessons', labelAr: 'الجدول والحصص', icon: 'Calendar', descriptionEn: 'Scheduled, completed, & past lessons', descriptionAr: 'جميع الحصص المجدولة والمكتملة والتاريخية' },
  { id: 'school_hod', labelKey: 'school_hod', labelEn: 'School & HOD Hub', labelAr: 'إدارة المدرسة ورئيس القسم', icon: 'GraduationCap', descriptionEn: 'School, stage managers, secretaries, visits, reports, follow-ups, complaints, action plans, & weekly plans', descriptionAr: 'بيانات المدرسة، مديري المراحل، السكرتيرات، الزيارات والتوجيه، التقارير والمتابعة، الشكاوى، وخطط علاج الطلاب' },
  { id: 'school_notes', labelKey: 'school_notes', labelEn: 'School & Lesson Notes', labelAr: 'ملاحظات الحصص والفصول والطلاب', icon: 'FileText', descriptionEn: 'All class, student, and lesson notes', descriptionAr: 'جميع ملاحظات الفصول والطلاب والحصص المدرسية' },
  { id: 'certificates', labelKey: 'certificates', labelEn: 'Certificates & Honors', labelAr: 'الشهادات والتكريمات', icon: 'Trophy', descriptionEn: 'All issued certificates & student honors', descriptionAr: 'سجلات وتواريخ وتفاصيل جميع الشهادات والتكريمات' },
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
    certificates?: number;
    schoolRecords?: number;
    schoolNotes?: number;
    stageManagers?: number;
    stageSecretaries?: number;
    visitRecords?: number;
    weeklyPlans?: number;
    stageReports?: number;
    stageFollowUps?: number;
    complaints?: number;
    actionPlans?: number;
    financeAccounts?: number;
    financeTransactions?: number;
    [key: string]: number | undefined;
  };
  metadata?: {
    teacherName?: string;
    totalRecords?: number;
    estimatedSizeKb?: number;
  };
  encryptedData?: string;
  data?: {
    profile?: TeacherProfile;
    schoolSettings?: SchoolSettings;
    groups?: Group[];
    students?: Student[];
    lessons?: Lesson[];
    payments?: PaymentRecord[];
    notifications?: NotificationItem[];
    notificationSettings?: NotificationSettings;
    inspirationSettings?: InspirationSettings;
    inspirationMessages?: InspirationMessage[];
    todos?: TodoItem[];
    certificates?: CertificateRecord[];
    schoolNotes?: SchoolNote[];
    financeAccounts?: FinanceAccount[];
    financeCategories?: FinanceCategory[];
    financeTransactions?: FinanceTransaction[];
    financeRecurring?: FinanceRecurring[];
    financeInstallments?: FinanceInstallment[];
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
    certificates?: CertificateRecord[];
    hodStudents?: HodGermanStudent[];
    hodComplaints?: Complaint[];
    hodActionPlans?: StudentActionPlan[];
    hodVisits?: VisitRecord[];
    schoolNotes?: SchoolNote[];
    financeAccounts?: FinanceAccount[];
    financeTransactions?: FinanceTransaction[];
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
  let schoolRecordCount = 0;
  let certificateCount = 0;
  let schoolNotesCount = 0;
  let financeCount = 0;

  if (selectedCategories.includes('students')) studentCount = appState.students.length;
  if (selectedCategories.includes('groups')) groupCount = appState.groups.length;
  if (selectedCategories.includes('schedule')) lessonCount = appState.lessons.length;
  if (selectedCategories.includes('financial')) {
    paymentCount = appState.payments.length;
    financeCount = (appState.financeAccounts?.length || 0) + (appState.financeTransactions?.length || 0);
  }
  if (selectedCategories.includes('notifications')) notificationCount = appState.notifications.length;
  if (selectedCategories.includes('certificates') && appState.certificates) certificateCount = appState.certificates.length;
  if (selectedCategories.includes('school_notes') && appState.schoolNotes) schoolNotesCount = appState.schoolNotes.length;
  
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

  const school = appState.profile?.schoolSettings;
  const hodSt = appState.hodStudents?.length || 0;
  const hodCmp = appState.hodComplaints?.length || 0;
  const hodAct = appState.hodActionPlans?.length || 0;
  const hodVis = appState.hodVisits?.length || 0;

  if (selectedCategories.includes('school_hod') || selectedCategories.includes('settings')) {
    const schoolBase = school ? (
      (school.stageManagers?.length || 0) +
      (school.stageSecretaries?.length || 0) +
      (school.visitRecords?.length || 0) +
      (school.weeklyPlanStatuses?.length || 0) +
      (school.stageReports?.length || 0) +
      (school.stageFollowUps?.length || 0) +
      (school.teachers?.length || 0) +
      (school.complaints?.length || 0) +
      (school.actionPlans?.length || 0) +
      (school.parentComplaints?.length || 0)
    ) : 0;
    schoolRecordCount = schoolBase + hodSt + hodCmp + hodAct + hodVis;
  }

  const totalRecords = studentCount + groupCount + lessonCount + paymentCount + notificationCount + schoolRecordCount + certificateCount + schoolNotesCount;
  
  // Estimate size KB (~150 bytes per student, 200 per lesson, 180 per payment, 250 per school/HOD record)
  const estimatedSizeBytes = Math.max(
    1024,
    (studentCount * 180) + (groupCount * 250) + (lessonCount * 320) + (paymentCount * 220) + (schoolRecordCount * 250) + (certificateCount * 300) + 1500
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
    schoolRecordCount,
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
    certificates?: CertificateRecord[];
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
    { key: 'inspirationMessages', label: 'inspirationMessages' },
    { key: 'certificates', label: 'certificates' },
    { key: 'hodStudents', label: 'hodStudents' },
    { key: 'hodComplaints', label: 'hodComplaints' },
    { key: 'hodActionPlans', label: 'hodActionPlans' },
    { key: 'hodVisits', label: 'hodVisits' },
    { key: 'customAiBackgrounds', label: 'customAiBackgrounds' },
    { key: 'schoolNotes', label: 'schoolNotes' },
    { key: 'financeAccounts', label: 'financeAccounts' },
    { key: 'financeCategories', label: 'financeCategories' },
    { key: 'financeTransactions', label: 'financeTransactions' },
    { key: 'financeRecurring', label: 'financeRecurring' },
    { key: 'financeInstallments', label: 'financeInstallments' }
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

  // Sanitize Groups first so we have the full identity map for legacy backup compatibility
  const rawGroups: any[] = Array.isArray(data.groups) ? data.groups : [];
  const sanitizedGroups: Group[] = [];
  const groupNameToIdMap = new Map<string, string>();
  const validGroupIds = new Set<string>();

  for (let i = 0; i < rawGroups.length; i++) {
    const g = rawGroups[i];
    if (!g || typeof g !== 'object' || Array.isArray(g)) continue;

    const id = typeof g.id === 'string' && g.id.trim() ? g.id.trim() : `grp_imp_${Date.now()}_${i}`;
    const name = typeof g.name === 'string' ? g.name : 'Unnamed Group';

    validGroupIds.add(id);
    if (name && name.trim()) {
      groupNameToIdMap.set(name.trim().toLowerCase(), id);
    }

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
      schedules: Array.isArray(g.schedules) ? g.schedules : []
    });
  }

  // Sanitize Students
  const rawStudents: any[] = Array.isArray(data.students) ? data.students : [];
  const sanitizedStudents: Student[] = [];
  for (let i = 0; i < rawStudents.length; i++) {
    const s = rawStudents[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) continue;

    const id = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `st_imp_${Date.now()}_${i}`;
    const name = typeof s.name === 'string' ? s.name : (s.name ? String(s.name) : 'Unnamed Student');
    
    // Legacy fallback: if groupId is missing but groupName matches an existing group
    let groupId = typeof s.groupId === 'string' ? s.groupId.trim() : '';
    if ((!groupId || !validGroupIds.has(groupId)) && typeof s.groupName === 'string' && s.groupName.trim()) {
      const mappedId = groupNameToIdMap.get(s.groupName.trim().toLowerCase());
      if (mappedId) {
        groupId = mappedId;
      }
    }

    let avatarUrl = s.avatarUrl;
    if (typeof avatarUrl === 'string' && avatarUrl.length > 1000000) {
      avatarUrl = undefined;
    }

    sanitizedStudents.push({
      ...s,
      id,
      name,
      groupId,
      certificateName: typeof s.certificateName === 'string' && s.certificateName.trim() ? s.certificateName.trim() : (!/[\u0600-\u06FF]/.test(name) ? name : ''),
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

    // Legacy fallback: if groupId is missing but groupName matches an existing group
    let groupId = typeof l.groupId === 'string' ? l.groupId.trim() : '';
    if ((!groupId || !validGroupIds.has(groupId)) && typeof l.groupName === 'string' && l.groupName.trim()) {
      const mappedId = groupNameToIdMap.get(l.groupName.trim().toLowerCase());
      if (mappedId) {
        groupId = mappedId;
      }
    }

    let groupName = typeof l.groupName === 'string' ? l.groupName : '';
    if (groupId && validGroupIds.has(groupId)) {
      const targetGroup = sanitizedGroups.find(g => g.id === groupId);
      if (targetGroup) {
        groupName = targetGroup.name;
      }
    }

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
      groupId,
      groupName: groupName || l.groupName,
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

    let groupId = typeof p.groupId === 'string' ? p.groupId.trim() : '';
    if ((!groupId || !validGroupIds.has(groupId)) && typeof p.groupName === 'string' && p.groupName.trim()) {
      const mappedId = groupNameToIdMap.get(p.groupName.trim().toLowerCase());
      if (mappedId) {
        groupId = mappedId;
      }
    }
    if (!groupId && typeof p.studentId === 'string' && p.studentId.trim()) {
      const student = sanitizedStudents.find(s => s.id === p.studentId);
      if (student && student.groupId) {
        groupId = student.groupId;
      }
    }

    sanitizedPayments.push({
      ...p,
      id,
      status,
      studentId: typeof p.studentId === 'string' ? p.studentId : '',
      groupId,
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

  // Sanitize Certificates
  const rawCertificates: any[] = Array.isArray(data.certificates) ? data.certificates : [];
  const sanitizedCertificates: CertificateRecord[] = [];
  for (let i = 0; i < rawCertificates.length; i++) {
    const c = rawCertificates[i];
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;

    const id = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `cert_imp_${Date.now()}_${i}`;
    sanitizedCertificates.push({
      ...c,
      id,
      studentId: typeof c.studentId === 'string' ? c.studentId : '',
      studentName: typeof c.studentName === 'string' ? c.studentName : 'Student',
      recipientName: typeof c.recipientName === 'string' ? c.recipientName : (c.studentName || 'Student'),
      certificateType: c.certificateType || 'achievement',
      language: c.language || 'en',
      template: c.template || 'classic',
      title: typeof c.title === 'string' ? c.title : 'Certificate of Achievement',
      description: typeof c.description === 'string' ? c.description : '',
      issueDate: typeof c.issueDate === 'string' ? c.issueDate : new Date().toISOString().split('T')[0],
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now()
    });
  }

  // Sanitize HOD German Students
  const rawHodStudents: any[] = Array.isArray(data.hodStudents) ? data.hodStudents : [];
  const sanitizedHodStudents: HodGermanStudent[] = [];
  for (let i = 0; i < rawHodStudents.length; i++) {
    const s = rawHodStudents[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
    const id = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `hod_st_${Date.now()}_${i}`;
    sanitizedHodStudents.push({
      ...s,
      id,
      name: typeof s.name === 'string' ? s.name : 'German Student',
      stage: typeof s.stage === 'string' ? s.stage : 'primary',
      grade: typeof s.grade === 'string' ? s.grade : 'Grade 1',
      className: typeof s.className === 'string' ? s.className : '',
      status: s.status || 'active',
      updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
      deleted: Boolean(s.deleted)
    });
  }

  // Sanitize HOD Complaints
  const rawHodComplaints: any[] = Array.isArray(data.hodComplaints) ? data.hodComplaints : [];
  const sanitizedHodComplaints: Complaint[] = [];
  for (let i = 0; i < rawHodComplaints.length; i++) {
    const c = rawHodComplaints[i];
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
    const id = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `hod_cmp_${Date.now()}_${i}`;
    sanitizedHodComplaints.push({
      ...c,
      id,
      teacherId: typeof c.teacherId === 'string' ? c.teacherId : '',
      teacherName: typeof c.teacherName === 'string' ? c.teacherName : 'Teacher',
      studentName: typeof c.studentName === 'string' ? c.studentName : '',
      className: typeof c.className === 'string' ? c.className : '',
      description: typeof c.description === 'string' ? c.description : '',
      date: typeof c.date === 'string' ? c.date : new Date().toISOString().split('T')[0],
      status: c.status || 'pending',
      updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
      deleted: Boolean(c.deleted)
    });
  }

  // Sanitize HOD Student Action Plans
  const rawHodActionPlans: any[] = Array.isArray(data.hodActionPlans) ? data.hodActionPlans : [];
  const sanitizedHodActionPlans: StudentActionPlan[] = [];
  for (let i = 0; i < rawHodActionPlans.length; i++) {
    const a = rawHodActionPlans[i];
    if (!a || typeof a !== 'object' || Array.isArray(a)) continue;
    const id = typeof a.id === 'string' && a.id.trim() ? a.id.trim() : `hod_plan_${Date.now()}_${i}`;
    sanitizedHodActionPlans.push({
      ...a,
      id,
      teacherId: typeof a.teacherId === 'string' ? a.teacherId : '',
      teacherName: typeof a.teacherName === 'string' ? a.teacherName : 'Teacher',
      studentName: typeof a.studentName === 'string' ? a.studentName : 'Student',
      className: typeof a.className === 'string' ? a.className : '',
      weaknessArea: typeof a.weaknessArea === 'string' ? a.weaknessArea : '',
      actionSteps: typeof a.actionSteps === 'string' ? a.actionSteps : '',
      startDate: typeof a.startDate === 'string' ? a.startDate : new Date().toISOString().split('T')[0],
      status: a.status || 'in_progress',
      updatedAt: typeof a.updatedAt === 'number' ? a.updatedAt : Date.now(),
      deleted: Boolean(a.deleted)
    });
  }

  // Sanitize HOD Visit Records
  const rawHodVisits: any[] = Array.isArray(data.hodVisits) ? data.hodVisits : [];
  const sanitizedHodVisits: VisitRecord[] = [];
  for (let i = 0; i < rawHodVisits.length; i++) {
    const v = rawHodVisits[i];
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const id = typeof v.id === 'string' && v.id.trim() ? v.id.trim() : `hod_vst_${Date.now()}_${i}`;
    sanitizedHodVisits.push({
      ...v,
      id,
      teacherId: typeof v.teacherId === 'string' ? v.teacherId : '',
      teacherName: typeof v.teacherName === 'string' ? v.teacherName : 'Teacher',
      className: typeof v.className === 'string' ? v.className : '',
      term: v.term === 'term2' || v.term === 'summer' ? v.term : 'term1',
      visitedDate: typeof v.visitedDate === 'string' ? v.visitedDate : new Date().toISOString().split('T')[0],
      periodNumber: typeof v.periodNumber === 'number' ? v.periodNumber : 1,
      lessonTopic: typeof v.lessonTopic === 'string' ? v.lessonTopic : '',
      updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
      deleted: Boolean(v.deleted)
    });
  }

  // Sanitize Custom AI Backgrounds
  const rawCustomBg: any[] = Array.isArray(data.customAiBackgrounds) ? data.customAiBackgrounds : [];
  const sanitizedCustomBg: AICertificateBackground[] = [];
  for (let i = 0; i < rawCustomBg.length; i++) {
    const bg = rawCustomBg[i];
    if (!bg || typeof bg !== 'object' || Array.isArray(bg)) continue;
    const id = typeof bg.id === 'string' && bg.id.trim() ? bg.id.trim() : `ai_bg_${Date.now()}_${i}`;
    sanitizedCustomBg.push({
      ...bg,
      id,
      name: typeof bg.name === 'string' ? bg.name : 'Custom Background',
      dataUrl: typeof bg.dataUrl === 'string' ? bg.dataUrl : '',
      createdAt: typeof bg.createdAt === 'number' ? bg.createdAt : Date.now()
    });
  }

  // Sanitize School Notes
  const rawSchoolNotes: any[] = Array.isArray(data.schoolNotes) ? data.schoolNotes : [];
  const sanitizedSchoolNotes: SchoolNote[] = [];
  for (let i = 0; i < rawSchoolNotes.length; i++) {
    const n = rawSchoolNotes[i];
    if (!n || typeof n !== 'object' || Array.isArray(n)) continue;
    const id = typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `note_${Date.now()}_${i}`;
    sanitizedSchoolNotes.push({
      ...n,
      id,
      type: n.type === 'class' || n.type === 'student' || n.type === 'lesson' ? n.type : 'lesson',
      text: typeof n.text === 'string' ? n.text : '',
      createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date().toISOString(),
      updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
      deleted: Boolean(n.deleted),
      version: typeof n.version === 'number' ? n.version : 1,
      classId: typeof n.classId === 'string' ? n.classId : undefined,
      className: typeof n.className === 'string' ? n.className : undefined,
      studentId: typeof n.studentId === 'string' ? n.studentId : undefined,
      studentName: typeof n.studentName === 'string' ? n.studentName : undefined,
      lessonId: typeof n.lessonId === 'string' ? n.lessonId : undefined,
      subjectName: typeof n.subjectName === 'string' ? n.subjectName : undefined,
      date: typeof n.date === 'string' ? n.date : undefined,
      periodNumber: typeof n.periodNumber === 'number' ? n.periodNumber : undefined
    });
  }

  // Sanitize Finance Accounts
  const rawFinanceAccounts: any[] = Array.isArray(data.financeAccounts) ? data.financeAccounts : [];
  const sanitizedFinanceAccounts: FinanceAccount[] = [];
  for (let i = 0; i < rawFinanceAccounts.length; i++) {
    const acc = rawFinanceAccounts[i];
    if (!acc || typeof acc !== 'object' || Array.isArray(acc)) continue;
    const id = typeof acc.id === 'string' && acc.id.trim() ? acc.id.trim() : `facc_imp_${Date.now()}_${i}`;
    sanitizedFinanceAccounts.push({
      ...acc,
      id,
      name: typeof acc.name === 'string' ? acc.name : 'Account',
      type: (acc.type === 'cash' || acc.type === 'bank' || acc.type === 'wallet' || acc.type === 'other') ? acc.type : 'cash',
      openingBalance: sanitizeNumber(acc.openingBalance, 0),
      currentBalance: sanitizeNumber(acc.currentBalance, 0),
      currency: typeof acc.currency === 'string' ? acc.currency : 'EGP',
      createdAt: typeof acc.createdAt === 'string' ? acc.createdAt : new Date().toISOString(),
      updatedAt: typeof acc.updatedAt === 'number' ? acc.updatedAt : Date.now(),
      deleted: Boolean(acc.deleted),
      version: typeof acc.version === 'number' ? acc.version : 1
    });
  }

  // Sanitize Finance Categories
  const rawFinanceCategories: any[] = Array.isArray(data.financeCategories) ? data.financeCategories : [];
  const sanitizedFinanceCategories: FinanceCategory[] = [];
  for (let i = 0; i < rawFinanceCategories.length; i++) {
    const cat = rawFinanceCategories[i];
    if (!cat || typeof cat !== 'object' || Array.isArray(cat)) continue;
    const id = typeof cat.id === 'string' && cat.id.trim() ? cat.id.trim() : `fcat_imp_${Date.now()}_${i}`;
    sanitizedFinanceCategories.push({
      ...cat,
      id,
      name: typeof cat.name === 'string' ? cat.name : 'Category',
      type: (cat.type === 'income' || cat.type === 'expense' || cat.type === 'transfer') ? cat.type : 'income',
      createdAt: typeof cat.createdAt === 'string' ? cat.createdAt : new Date().toISOString(),
      updatedAt: typeof cat.updatedAt === 'number' ? cat.updatedAt : Date.now(),
      deleted: Boolean(cat.deleted),
      version: typeof cat.version === 'number' ? cat.version : 1
    });
  }

  // Sanitize Finance Transactions
  const rawFinanceTransactions: any[] = Array.isArray(data.financeTransactions) ? data.financeTransactions : [];
  const sanitizedFinanceTransactions: FinanceTransaction[] = [];
  for (let i = 0; i < rawFinanceTransactions.length; i++) {
    const tx = rawFinanceTransactions[i];
    if (!tx || typeof tx !== 'object' || Array.isArray(tx)) continue;
    const id = typeof tx.id === 'string' && tx.id.trim() ? tx.id.trim() : `ftx_imp_${Date.now()}_${i}`;
    sanitizedFinanceTransactions.push({
      ...tx,
      id,
      type: (tx.type === 'income' || tx.type === 'expense' || tx.type === 'transfer') ? tx.type : 'income',
      amount: Math.max(0, sanitizeNumber(tx.amount, 0)),
      accountId: typeof tx.accountId === 'string' ? tx.accountId : 'acc_main_cash',
      toAccountId: typeof tx.toAccountId === 'string' ? tx.toAccountId : undefined,
      categoryId: typeof tx.categoryId === 'string' ? tx.categoryId : undefined,
      date: typeof tx.date === 'string' ? tx.date : new Date().toISOString().split('T')[0],
      note: typeof tx.note === 'string' ? tx.note : '',
      relatedStudentId: typeof tx.relatedStudentId === 'string' ? tx.relatedStudentId : undefined,
      relatedPaymentId: typeof tx.relatedPaymentId === 'string' ? tx.relatedPaymentId : undefined,
      createdAt: typeof tx.createdAt === 'string' ? tx.createdAt : new Date().toISOString(),
      updatedAt: typeof tx.updatedAt === 'number' ? tx.updatedAt : Date.now(),
      deleted: Boolean(tx.deleted),
      version: typeof tx.version === 'number' ? tx.version : 1
    });
  }

  // Sanitize Finance Recurring
  const rawFinanceRecurring: any[] = Array.isArray(data.financeRecurring) ? data.financeRecurring : [];
  const sanitizedFinanceRecurring: FinanceRecurring[] = [];
  for (let i = 0; i < rawFinanceRecurring.length; i++) {
    const rec = rawFinanceRecurring[i];
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
    const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `frec_imp_${Date.now()}_${i}`;
    sanitizedFinanceRecurring.push({
      ...rec,
      id,
      name: typeof rec.name === 'string' ? rec.name : 'Recurring',
      amount: Math.max(0, sanitizeNumber(rec.amount, 0)),
      categoryId: typeof rec.categoryId === 'string' ? rec.categoryId : '',
      accountId: typeof rec.accountId === 'string' ? rec.accountId : 'acc_main_cash',
      frequency: (rec.frequency === 'daily' || rec.frequency === 'weekly' || rec.frequency === 'monthly' || rec.frequency === 'yearly') ? rec.frequency : 'monthly',
      dueDayOfMonth: sanitizeOptionalNumber(rec.dueDayOfMonth),
      lastPaidDate: typeof rec.lastPaidDate === 'string' ? rec.lastPaidDate : undefined,
      createdAt: typeof rec.createdAt === 'string' ? rec.createdAt : new Date().toISOString(),
      updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : Date.now(),
      deleted: Boolean(rec.deleted),
      version: typeof rec.version === 'number' ? rec.version : 1
    });
  }

  // Sanitize Finance Installments
  const rawFinanceInstallments: any[] = Array.isArray(data.financeInstallments) ? data.financeInstallments : [];
  const sanitizedFinanceInstallments: FinanceInstallment[] = [];
  for (let i = 0; i < rawFinanceInstallments.length; i++) {
    const inst = rawFinanceInstallments[i];
    if (!inst || typeof inst !== 'object' || Array.isArray(inst)) continue;
    const id = typeof inst.id === 'string' && inst.id.trim() ? inst.id.trim() : `finst_imp_${Date.now()}_${i}`;
    sanitizedFinanceInstallments.push({
      ...inst,
      id,
      name: typeof inst.name === 'string' ? inst.name : 'Installment',
      amountPerInstallment: Math.max(0, sanitizeNumber(inst.amountPerInstallment, 0)),
      totalInstallments: sanitizeNumber(inst.totalInstallments, 1),
      currentInstallment: sanitizeNumber(inst.currentInstallment, 1),
      remainingBalance: sanitizeNumber(inst.remainingBalance, 0),
      dueDate: typeof inst.dueDate === 'string' ? inst.dueDate : new Date().toISOString().split('T')[0],
      accountId: typeof inst.accountId === 'string' ? inst.accountId : 'acc_main_cash',
      providerName: typeof inst.providerName === 'string' ? inst.providerName : undefined,
      createdAt: typeof inst.createdAt === 'string' ? inst.createdAt : new Date().toISOString(),
      updatedAt: typeof inst.updatedAt === 'number' ? inst.updatedAt : Date.now(),
      deleted: Boolean(inst.deleted),
      version: typeof inst.version === 'number' ? inst.version : 1
    });
  }

  // Sanitize School & HOD Settings
  const rawSchool = data.schoolSettings || data.profile?.schoolSettings;
  const sanitizedSchool = sanitizeSchoolSettings(rawSchool);

  const sanitizedProfile = data.profile && typeof data.profile === 'object' ? {
    ...data.profile,
    displayName: typeof data.profile.displayName === 'string' ? data.profile.displayName : 'Teacher',
    displayNameEn: typeof data.profile.displayNameEn === 'string' ? data.profile.displayNameEn : (typeof data.profile.nameEn === 'string' ? data.profile.nameEn : undefined),
    displayNameAr: typeof data.profile.displayNameAr === 'string' ? data.profile.displayNameAr : (typeof data.profile.nameAr === 'string' ? data.profile.nameAr : undefined),
    nameEn: typeof data.profile.nameEn === 'string' ? data.profile.nameEn : (typeof data.profile.displayNameEn === 'string' ? data.profile.displayNameEn : undefined),
    nameAr: typeof data.profile.nameAr === 'string' ? data.profile.nameAr : (typeof data.profile.displayNameAr === 'string' ? data.profile.displayNameAr : undefined),
    schoolSettings: sanitizedSchool || data.profile.schoolSettings
  } : undefined;

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
      certificates: sanitizedCertificates,
      hodStudents: sanitizedHodStudents,
      hodComplaints: sanitizedHodComplaints,
      hodActionPlans: sanitizedHodActionPlans,
      hodVisits: sanitizedHodVisits,
      customAiBackgrounds: sanitizedCustomBg,
      schoolNotes: sanitizedSchoolNotes,
      financeAccounts: sanitizedFinanceAccounts,
      financeCategories: sanitizedFinanceCategories,
      financeTransactions: sanitizedFinanceTransactions,
      financeRecurring: sanitizedFinanceRecurring,
      financeInstallments: sanitizedFinanceInstallments,
      schoolSettings: sanitizedSchool,
      profile: sanitizedProfile,
      notificationSettings: data.notificationSettings && typeof data.notificationSettings === 'object' ? data.notificationSettings : undefined,
      inspirationSettings: data.inspirationSettings && typeof data.inspirationSettings === 'object' ? data.inspirationSettings : undefined,
      inspirationMessages: Array.isArray(data.inspirationMessages) ? data.inspirationMessages : undefined,
      todos: Array.isArray(data.todos) ? data.todos : undefined
    }
  };
}

export function sanitizeSchoolSettings(raw: any): SchoolSettings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;

  const stageManagers: StageManager[] = [];
  if (Array.isArray(raw.stageManagers)) {
    raw.stageManagers.forEach((m: any, idx: number) => {
      if (m && typeof m === 'object' && !Array.isArray(m)) {
        stageManagers.push({
          id: typeof m.id === 'string' && m.id.trim() ? m.id.trim() : `sm_${Date.now()}_${idx}`,
          name: typeof m.name === 'string' ? m.name : 'Stage Manager',
          phone: typeof m.phone === 'string' ? m.phone : '',
          gradeBand: typeof m.gradeBand === 'string' ? m.gradeBand : undefined,
          assignedGradeGroups: Array.isArray(m.assignedGradeGroups) ? m.assignedGradeGroups.filter((g: any) => typeof g === 'string') : undefined
        });
      }
    });
  }

  const stageSecretaries: StageSecretary[] = [];
  if (Array.isArray(raw.stageSecretaries)) {
    raw.stageSecretaries.forEach((s: any, idx: number) => {
      if (s && typeof s === 'object' && !Array.isArray(s)) {
        stageSecretaries.push({
          id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `sec_${Date.now()}_${idx}`,
          name: typeof s.name === 'string' ? s.name : 'Secretary',
          phone: typeof s.phone === 'string' ? s.phone : '',
          stageManagerId: typeof s.stageManagerId === 'string' ? s.stageManagerId : undefined,
          stageManagerName: typeof s.stageManagerName === 'string' ? s.stageManagerName : undefined
        });
      }
    });
  }

  const visitRecords: VisitRecord[] = [];
  if (Array.isArray(raw.visitRecords)) {
    raw.visitRecords.forEach((v: any, idx: number) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        visitRecords.push({
          ...v,
          id: typeof v.id === 'string' && v.id.trim() ? v.id.trim() : `vis_${Date.now()}_${idx}`,
          teacherId: typeof v.teacherId === 'string' ? v.teacherId : '',
          teacherName: typeof v.teacherName === 'string' ? v.teacherName : 'Teacher',
          className: typeof v.className === 'string' ? v.className : '',
          term: v.term === 'term2' || v.term === 'summer' ? v.term : 'term1',
          visitedDate: typeof v.visitedDate === 'string' ? v.visitedDate : new Date().toISOString().split('T')[0],
          periodNumber: typeof v.periodNumber === 'number' ? v.periodNumber : 1,
          lessonTopic: typeof v.lessonTopic === 'string' ? v.lessonTopic : ''
        });
      }
    });
  }

  const bookletObservations: BookletObservation[] = [];
  if (Array.isArray(raw.bookletObservations)) {
    raw.bookletObservations.forEach((b: any, idx: number) => {
      if (b && typeof b === 'object' && !Array.isArray(b)) {
        bookletObservations.push({
          ...b,
          id: typeof b.id === 'string' && b.id.trim() ? b.id.trim() : `bk_${Date.now()}_${idx}`,
          className: typeof b.className === 'string' ? b.className : '',
          status: (b.status === 'completed' || b.status === 'partially_completed' || b.status === 'not_completed' || b.status === 'na') ? b.status : 'not_completed',
          updatedAt: typeof b.updatedAt === 'number' ? b.updatedAt : Date.now()
        });
      }
    });
  }

  const weeklyPlanStatuses: WeeklyPlanStatusRecord[] = [];
  if (Array.isArray(raw.weeklyPlanStatuses)) {
    raw.weeklyPlanStatuses.forEach((w: any, idx: number) => {
      if (w && typeof w === 'object' && !Array.isArray(w)) {
        weeklyPlanStatuses.push({
          ...w,
          id: typeof w.id === 'string' && w.id.trim() ? w.id.trim() : `wp_${Date.now()}_${idx}`,
          gradeBand: typeof w.gradeBand === 'string' ? w.gradeBand : 'Stage',
          status: w.status === 'sent' || w.status === 'confirmed' || w.status === 'issue' ? w.status : 'not_sent',
          sentAt: typeof w.sentAt === 'string' ? w.sentAt : undefined,
          secretaryName: typeof w.secretaryName === 'string' ? w.secretaryName : undefined,
          secretaryPhone: typeof w.secretaryPhone === 'string' ? w.secretaryPhone : undefined,
          weekNumber: typeof w.weekNumber === 'number' ? w.weekNumber : undefined,
          customNotes: typeof w.customNotes === 'string' ? w.customNotes : undefined,
          gradesContent: Array.isArray(w.gradesContent) ? w.gradesContent : []
        });
      }
    });
  }

  const stageReports: StageReportRecord[] = [];
  if (Array.isArray(raw.stageReports)) {
    raw.stageReports.forEach((r: any, idx: number) => {
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        stageReports.push({
          ...r,
          id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `rep_${Date.now()}_${idx}`,
          weekTitle: typeof r.weekTitle === 'string' ? r.weekTitle : 'Report',
          stageManagerId: typeof r.stageManagerId === 'string' ? r.stageManagerId : '',
          stageManagerName: typeof r.stageManagerName === 'string' ? r.stageManagerName : '',
          contentAr: typeof r.contentAr === 'string' ? r.contentAr : '',
          status: r.status || 'draft',
          timestamp: typeof r.timestamp === 'number' ? r.timestamp : Date.now()
        });
      }
    });
  }

  const stageFollowUps: StageFollowUpRecord[] = [];
  if (Array.isArray(raw.stageFollowUps)) {
    raw.stageFollowUps.forEach((f: any, idx: number) => {
      if (f && typeof f === 'object' && !Array.isArray(f)) {
        stageFollowUps.push({
          ...f,
          id: typeof f.id === 'string' && f.id.trim() ? f.id.trim() : `sfu_${Date.now()}_${idx}`,
          stageManagerId: typeof f.stageManagerId === 'string' ? f.stageManagerId : '',
          stageManagerName: typeof f.stageManagerName === 'string' ? f.stageManagerName : '',
          gradeBand: typeof f.gradeBand === 'string' ? f.gradeBand : '',
          periodType: f.periodType || 'weekly',
          weekNumber: typeof f.weekNumber === 'number' ? f.weekNumber : 1,
          date: typeof f.date === 'string' ? f.date : new Date().toISOString().split('T')[0],
          timestamp: typeof f.timestamp === 'number' ? f.timestamp : Date.now(),
          teachersData: Array.isArray(f.teachersData) ? f.teachersData : [],
          overallStageNotes: typeof f.overallStageNotes === 'string' ? f.overallStageNotes : '',
          includedComplaints: Array.isArray(f.includedComplaints) ? f.includedComplaints : undefined,
          includedActionPlans: Array.isArray(f.includedActionPlans) ? f.includedActionPlans : undefined
        });
      }
    });
  }

  const teachers: Teacher[] = [];
  if (Array.isArray(raw.teachers)) {
    raw.teachers.forEach((t: any, idx: number) => {
      if (t && typeof t === 'object' && !Array.isArray(t)) {
        teachers.push({
          id: typeof t.id === 'string' && t.id.trim() ? t.id.trim() : `t_${Date.now()}_${idx}`,
          name: typeof t.name === 'string' ? t.name : 'Teacher',
          phone: typeof t.phone === 'string' ? t.phone : undefined,
          isActive: typeof t.isActive === 'boolean' ? t.isActive : true,
          isHod: typeof t.isHod === 'boolean' ? t.isHod : undefined
        });
      }
    });
  }

  const complaints: Complaint[] = [];
  if (Array.isArray(raw.complaints)) {
    raw.complaints.forEach((c: any, idx: number) => {
      if (c && typeof c === 'object' && !Array.isArray(c)) {
        complaints.push({
          ...c,
          id: typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `comp_${Date.now()}_${idx}`,
          direction: c.direction || 'teacher_to_student',
          teacherId: typeof c.teacherId === 'string' ? c.teacherId : '',
          teacherName: typeof c.teacherName === 'string' ? c.teacherName : '',
          studentNameAr: typeof c.studentNameAr === 'string' ? c.studentNameAr : '',
          studentNameEn: typeof c.studentNameEn === 'string' ? c.studentNameEn : '',
          gradeClass: typeof c.gradeClass === 'string' ? c.gradeClass : '',
          reason: typeof c.reason === 'string' ? c.reason : '',
          actionTaken: typeof c.actionTaken === 'string' ? c.actionTaken : '',
          notes: typeof c.notes === 'string' ? c.notes : '',
          timestamp: typeof c.timestamp === 'number' ? c.timestamp : Date.now(),
          term: c.term || 'term1',
          month: typeof c.month === 'number' ? c.month : (new Date().getMonth() + 1)
        });
      }
    });
  }

  const actionPlans: StudentActionPlan[] = [];
  if (Array.isArray(raw.actionPlans)) {
    raw.actionPlans.forEach((a: any, idx: number) => {
      if (a && typeof a === 'object' && !Array.isArray(a)) {
        actionPlans.push({
          ...a,
          id: typeof a.id === 'string' && a.id.trim() ? a.id.trim() : `ap_${Date.now()}_${idx}`,
          studentNameAr: typeof a.studentNameAr === 'string' ? a.studentNameAr : '',
          studentNameEn: typeof a.studentNameEn === 'string' ? a.studentNameEn : '',
          gradeClass: typeof a.gradeClass === 'string' ? a.gradeClass : '',
          teacherId: typeof a.teacherId === 'string' ? a.teacherId : '',
          teacherName: typeof a.teacherName === 'string' ? a.teacherName : '',
          weaknessAreas: Array.isArray(a.weaknessAreas) ? a.weaknessAreas : [],
          actionSteps: Array.isArray(a.actionSteps) ? a.actionSteps : [],
          startDate: typeof a.startDate === 'string' ? a.startDate : new Date().toISOString().split('T')[0],
          term: a.term || 'term1',
          status: a.status || 'in_progress',
          weeklyLogs: Array.isArray(a.weeklyLogs) ? a.weeklyLogs : []
        });
      }
    });
  }

  const parentComplaints: ParentComplaint[] = [];
  if (Array.isArray(raw.parentComplaints)) {
    raw.parentComplaints.forEach((p: any, idx: number) => {
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        parentComplaints.push({
          ...p,
          id: typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `pc_${Date.now()}_${idx}`,
          teacherId: typeof p.teacherId === 'string' ? p.teacherId : '',
          studentName: typeof p.studentName === 'string' ? p.studentName : '',
          className: typeof p.className === 'string' ? p.className : '',
          description: typeof p.description === 'string' ? p.description : '',
          date: typeof p.date === 'string' ? p.date : new Date().toISOString().split('T')[0],
          status: p.status || 'pending'
        });
      }
    });
  }

  return {
    ...raw,
    schoolName: typeof raw.schoolName === 'string' ? raw.schoolName : undefined,
    departmentName: typeof raw.departmentName === 'string' ? raw.departmentName : undefined,
    academicYear: typeof raw.academicYear === 'string' ? raw.academicYear : undefined,
    currentTerm: raw.currentTerm === 'term2' || raw.currentTerm === 'summer' ? raw.currentTerm : 'term1',
    hodName: typeof raw.hodName === 'string' ? raw.hodName : undefined,
    schoolLogoUrl: typeof raw.schoolLogoUrl === 'string' ? raw.schoolLogoUrl : undefined,
    presence: raw.presence && typeof raw.presence === 'object' ? raw.presence : undefined,
    periodSettings: raw.periodSettings && typeof raw.periodSettings === 'object' ? raw.periodSettings : undefined,
    schedule: raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : undefined,
    stageManagers,
    stageSecretaries,
    visitRecords,
    bookletObservations,
    weeklyPlanStatuses,
    stageReports,
    stageFollowUps,
    teachers,
    teacherSchedules: raw.teacherSchedules && typeof raw.teacherSchedules === 'object' ? raw.teacherSchedules : undefined,
    complaints,
    actionPlans,
    parentComplaints
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
    const schoolSettings = data.schoolSettings || data.profile?.schoolSettings;

    // Analyze impact
    const existingStudentIds = new Set(currentAppState.students.map(s => s.id));
    const existingStudentKeys = new Set(currentAppState.students.map(s => `${(s.name || '').trim().toLowerCase()}_${s.parentPhone || ''}`));
    let addStudents = 0;
    let updateStudents = 0;

    students.forEach(s => {
      const key = `${(s.name || '').trim().toLowerCase()}_${s.parentPhone || ''}`;
      if (existingStudentIds.has(s.id) || existingStudentKeys.has(key)) {
        updateStudents++;
      } else {
        addStudents++;
      }
    });

    const existingGroupIds = new Set(currentAppState.groups.map(g => g.id));
    const existingGroupNames = new Set(currentAppState.groups.map(g => (g.name || '').trim().toLowerCase()));
    let addGroups = 0;
    let updateGroups = 0;

    groups.forEach(g => {
      if (existingGroupIds.has(g.id) || existingGroupNames.has((g.name || '').trim().toLowerCase())) {
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
      if (schoolSettings && (
        (schoolSettings.stageManagers && schoolSettings.stageManagers.length > 0) ||
        (schoolSettings.visitRecords && schoolSettings.visitRecords.length > 0) ||
        (schoolSettings.weeklyPlanStatuses && schoolSettings.weeklyPlanStatuses.length > 0) ||
        (schoolSettings.stageReports && schoolSettings.stageReports.length > 0) ||
        (schoolSettings.stageFollowUps && schoolSettings.stageFollowUps.length > 0) ||
        (schoolSettings.complaints && schoolSettings.complaints.length > 0) ||
        (schoolSettings.actionPlans && schoolSettings.actionPlans.length > 0) ||
        (schoolSettings.teachers && schoolSettings.teachers.length > 0) ||
        schoolSettings.schoolName || schoolSettings.hodName
      )) {
        categories.push('school_hod');
      }
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

