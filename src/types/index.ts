import { BuddyCustomization } from './buddy';
export * from './buddy';

export type GradeLevel = 
  | 'Grade 1' | 'Grade 2' | 'Grade 3' | 'Grade 4' 
  | 'Grade 5' | 'Grade 6' | 'Grade 7' | 'Grade 8' 
  | 'Grade 9' | 'Grade 10' | 'Grade 11' | 'Grade 12'
  | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type LessonType = 'online' | 'offline';

export type LessonStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending_action';

// ==========================================
// PROTOCOL COMPATIBILITY & CAPABILITIES
// ==========================================
export const CURRENT_SYNC_PROTOCOL_VERSION = 2;
export const MIN_SUPPORTED_SYNC_PROTOCOL_VERSION = 1;
export const APP_BUILD_VERSION = '2.4.0';

export type SyncCapability = 
  | 'core_entities'      // Students, Groups, Lessons, Payments (v1)
  | 'settings_sync'      // Teacher Profile, Working Days/Hours, Templates, Currency (v2)
  | 'todos_sync'         // Quick todos & notification sync (v2)
  | 'heartbeat_presence' // WebRTC keep-alive & live latency (v2)
  | 'diff_reports'       // Structured post-sync audit reports (v2)
  | 'binary_compression';// Optional compression for large records (v3)

export const DEFAULT_CAPABILITIES: SyncCapability[] = [
  'core_entities',
  'settings_sync',
  'todos_sync',
  'heartbeat_presence',
  'diff_reports'
];

export interface ProtocolHeader {
  protocolVersion: number;       // e.g., 2
  minSupportedVersion: number;   // e.g., 1
  appVersion: string;            // e.g., "2.4.0"
  capabilities: SyncCapability[];
  timestamp?: number;
}

export interface PeerHandshakeRequest {
  pin?: string;
  deviceId: string;
  deviceName: string;
  header?: ProtocolHeader;
}

export interface PeerHandshakeResponse {
  pairingToken: string;
  peerId: string;
  deviceName: string;
  header?: ProtocolHeader;
  negotiatedVersion: number;
  agreedCapabilities: SyncCapability[];
  status: 'compatible' | 'upgrade_required' | 'incompatible';
}

export interface SyncableRecord {
  id: string;
  updatedAt?: number; // strictly for Last-Write-Wins (LWW) conflict resolution
  updatedByDeviceId?: string; // deterministic tie-breaker
  originDeviceId?: string; // device that authored this specific mutation
  originRevision?: number; // monotonic sequence integer from the authoring device
  deleted?: boolean; // tombstone marker for soft deletes
  version?: number; // schema versioning fallback
}

export type PeerWatermarkTable = Record<string, Record<string, number>>;

export interface PairedPeer {
  deviceId: string;
  deviceName: string;
  lastKnownIp: string;
  port: number;
  pairingToken: string;
  lastSyncedTimestamp: number;
  isOnline: boolean;
  protocolVersion?: number;
  capabilities?: SyncCapability[];
  lastHeartbeat?: number;
  latencyMs?: number;
}

export interface SyncStateMetadata {
  localDeviceId: string;
  localDeviceName: string;
  localRevisionCounter: number;
  peerWatermarkTable: PeerWatermarkTable;
  protocolVersion?: number;
}

// ==========================================
// TEACHER SETTINGS SYNC MODEL
// ==========================================
export interface TeacherSettingsRecord extends SyncableRecord {
  id: 'singleton_teacher_settings';
  profile: TeacherProfile;
  schedulingPreferences?: {
    defaultLessonDuration?: number;
    bufferBetweenLessonsMins?: number;
    autoAlertMinutes?: number;
  };
  recentlyDeleted?: RecentlyDeletedData;
  dismissedDashboardLessons?: string[];
  syncedAt?: number;
}

export type SchoolNoteType = 'class' | 'student' | 'lesson';

export interface SchoolNote extends SyncableRecord {
  id: string;
  type: SchoolNoteType;
  text: string;
  createdAt: string;
  updatedAt: number;
  updatedByDeviceId?: string;
  originDeviceId?: string;
  originRevision?: number;
  deleted?: boolean;
  version?: number;
  tags?: string[];
  pinned?: boolean;
  
  // Contextual linkages
  classId?: string;
  className?: string;
  studentId?: string;
  studentName?: string;
  lessonId?: string;
  subjectName?: string;
  date?: string; // YYYY-MM-DD
  periodNumber?: number;
}

export interface SyncDeltaPayload {
  header?: ProtocolHeader;
  senderDeviceId: string;
  senderDeviceName: string;
  peerWatermarks: PeerWatermarkTable;
  records: {
    groups?: Group[];
    students?: Student[];
    lessons?: Lesson[];
    payments?: PaymentRecord[];
    notifications?: NotificationItem[];
    todos?: TodoItem[];
    settings?: TeacherSettingsRecord[];
    certificates?: CertificateRecord[];
    hodStudents?: HodGermanStudent[];
    hodComplaints?: Complaint[];
    hodActionPlans?: StudentActionPlan[];
    hodVisits?: VisitRecord[];
    schoolNotes?: SchoolNote[];
    financeAccounts?: FinanceAccount[];
    financeCategories?: FinanceCategory[];
    financeTransactions?: FinanceTransaction[];
    financeRecurring?: FinanceRecurring[];
    financeInstallments?: FinanceInstallment[];
  };
  syncEvents?: Array<{
    id: string;
    type: string;
    payload: any;
    timestamp: number;
    deviceId: string;
  }>;
  metadata?: {
    totalEntitiesCount?: number;
    checksum?: string;
  };
}

// ==========================================
// SYNC REPORT, HISTORY, OUTBOX & PRESENCE MODELS
// ==========================================
export interface SyncEntityDiff {
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
}

export interface SyncConflictRecord {
  entityType: string;
  entityId: string;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  winner: 'local' | 'remote';
  resolutionStrategy: 'LWW' | 'TIE_BREAKER' | 'FIELD_MERGE';
  timestamp: number;
}

export interface SyncCycleReport {
  id: string;
  timestamp: number;
  peerId: string;
  peerName: string;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  status: 'success' | 'partial' | 'failed';
  entities: Record<string, SyncEntityDiff>;
  totalRecordsTransferred: number;
  conflictsResolved: number;
  conflictDetails?: SyncConflictRecord[];
  durationMs: number;
  errorMessage?: string;
}

export type SyncTriggerSource = 
  | 'Manual Sync' 
  | 'Auto Sync' 
  | 'Background Sync' 
  | 'Initial Pairing' 
  | 'Force Full Sync' 
  | 'Repair Sync';

export interface SyncHistoryEntry {
  id: string;
  timestamp: number;
  trigger: SyncTriggerSource;
  peerId: string;
  peerName: string;
  durationMs: number;
  uploadedCount: number;
  downloadedCount: number;
  conflictCount: number;
  status: 'success' | 'partial' | 'failed';
  summary: string;
  transferredCount: number;
  report?: SyncCycleReport;
}

export interface PendingEntityItem {
  id: string;
  entityType: string;
  title: string;
  originRevision: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface PendingOutboxSummary {
  totalCount: number;
  byEntity: Record<string, number>;
  items: PendingEntityItem[];
  oldestPendingTimestamp: number | null;
}

export type SyncConnectionState = 
  | 'OFFLINE' 
  | 'NETWORK_CONNECTED' 
  | 'INTERNET_AVAILABLE' 
  | 'BROKER_CONNECTED' 
  | 'SYNC_READY' 
  | 'SYNCING' 
  | 'SYNC_ERROR';

export interface DevicePresenceState {
  deviceId: string;
  deviceName: string;
  isOnline: boolean;
  latencyMs?: number;
  lastHeartbeat: number;
  protocolVersion?: number;
  supportedFeatures?: SyncCapability[];
}

export type AppLanguage = 'ar' | 'en' | 'de';

export type AccentColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal' | 'indigo' | 'rose' | 'amber' | 'emerald' | 'fuchsia' | 'cyan' | 'violet' | 'slate' | 'pink' | 'lime' | 'darkblue';

export type PaymentStatus = 'paid' | 'pending' | 'partial';

export type AttendanceStatus = 'present' | 'absent' | 'late';

export type HomeworkStatus = 'assigned' | 'completed' | 'not_completed';

export interface TeacherProfile {
  id: string;
  displayName: string;
  displayNameEn?: string; // English / German name for Certificates & Diplomas (e.g. "Herr Omar Hassan")
  displayNameAr?: string; // Arabic name for Reports, WhatsApp & Parent summaries (e.g. "أ. عمر حسن")
  nameEn?: string; // Compatibility alias
  nameAr?: string; // Compatibility alias
  email: string;
  avatarUrl: string;
  currency: string;
  language?: AppLanguage;
  phone?: string;
  instaPayId?: string;
  vodafoneCashNumber?: string;
  bankAccount?: string;
  paymentLink?: string;
  instagramAccount?: string;
  whatsappNumber?: string;
  isGoogleConnected: boolean;
  lastSyncedAt: string | null;
  weeklyWorkingHours?: WeeklyWorkingHours;
  workingHours: {
    workingDays: number[]; // 1 = Mon, 7 = Sun
    startTime: string; // e.g. "09:00"
    endTime: string; // e.g. "21:00"
  };
  defaultZoomLink: string;
  defaultMeetLink: string;
  enableLessonAlerts?: boolean; // In-app alerts for upcoming lessons (within 30 mins)
  enableBrowserPush?: boolean; // Browser push notifications
  parentMessageTemplates?: Record<string, string>;
  weeklyIncomeGoal?: number;
  monthlyIncomeGoal?: number;
  financeStreak?: number;
  financeLastActivityDate?: string;
  schoolSettings?: SchoolSettings;
  buddyCustomization?: BuddyCustomization;
}

export interface SchoolDayPresence {
  active: boolean;
  arrivalTime: string; // HH:MM
  departureTime: string; // HH:MM
}

export interface SchoolPeriodSettings {
  periodsCount: number;
  firstPeriodStart: string; // HH:MM
  defaultDuration: number; // minutes
  customDurations?: Record<number, number>; // periodNumber (1-indexed) -> minutes
}

export interface SchoolPeriodRecord {
  id?: string; // Stable ID
  source?: string; // e.g. "school_schedule"
  periodNumber: number; // 1-indexed
  subjectName?: string;
  className?: string;
  notes?: string;
}

export interface StageManager {
  id: string;
  name: string;
  phone?: string;
  gradeBand: string; // e.g. "Grades 1–3", "Grades 4–6", "Grades 7–9", "Grades 10–12"
  assignedGradeGroups: string[]; // underlying grades
}

export interface StageSecretary {
  id: string;
  name: string;
  phone?: string;
  stageManagerId: string; // Linked Stage Manager ID
  stageManagerName?: string;
}

export type ObservationRating = 1 | 2 | 3 | 4 | 5 | 0;

export interface VisitRecord extends SyncableRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  className: string;
  term: string;
  visitedDate: string;
  periodNumber?: string;
  lessonTopic?: string;
  
  cm_organization?: ObservationRating;
  cm_control?: ObservationRating;
  cm_time?: ObservationRating;
  cm_respect?: ObservationRating;
  
  ts_objectives?: ObservationRating;
  ts_aids?: ObservationRating;
  ts_participation?: ObservationRating;
  ts_questions?: ObservationRating;
  ts_clarity?: ObservationRating;
  
  se_participation?: ObservationRating;
  se_interaction?: ObservationRating;
  se_rules?: ObservationRating;
  
  bc_regularity?: ObservationRating;
  bc_quality?: ObservationRating;
  bc_compliance?: ObservationRating;
  
  overallScore?: number;
  overallCategory?: string;
  
  consolidatedNotes?: string;
}

export interface BookletObservation {
  id: string;
  className: string;
  status: 'completed' | 'partially_completed' | 'not_completed' | 'na';
  updatedAt: number;
}

export interface GradeWeeklyPlanContent {
  gradeName: string;
  ka?: string; // Klassenarbeit / K.A
  s1?: string; // Stunde 1 / S.1
  s2?: string; // Stunde 2 / S.2
  ha?: string; // Hausaufgabe / H.A
  quiz?: string; // Quiz / Kurztest
  hinweis?: string; // Hinweis / Note
}

export interface WeeklyPlanStatusRecord {
  id: string;
  gradeBand: string; // e.g. "Grades 1–3", "Grades 4–6", "Grades 7–9", "Grades 10–12"
  status: 'not_sent' | 'sent';
  sentAt?: string;
  secretaryName?: string;
  secretaryPhone?: string;
  weekNumber?: number;
  gradesContent?: GradeWeeklyPlanContent[];
  customNotes?: string;
}

export interface StageReportRecord {
  id: string;
  weekTitle: string;
  stageManagerId: string;
  stageManagerName: string;
  contentAr: string;
  status: 'draft' | 'sent';
  timestamp: number;
}

export type StaffAttendanceType = 'absence' | 'late_arrival' | 'early_leave';
export type AbsenceScope = 'full_day' | 'lesson_based';
export type AbsenceStatus = 'excused' | 'unexcused';

export interface StaffAttendanceRecord extends SyncableRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  date: string; // YYYY-MM-DD
  type: StaffAttendanceType;
  
  // Absence fields
  absenceScope?: AbsenceScope;
  absenceStatus?: AbsenceStatus;
  periodNumber?: number;
  lessonClass?: string;
  replacementTeacherId?: string;
  replacementTeacherName?: string;
  replacementAssignments?: Array<{
    periodNumber: number;
    className: string;
    replacementTeacherId?: string;
    replacementTeacherName?: string;
  }>;

  // Late arrival fields
  scheduledArrivalTime?: string;
  actualArrivalTime?: string;
  delayMinutes?: number;

  // Early leave fields
  scheduledLeaveTime?: string;
  actualLeaveTime?: string;
  lostMinutes?: number;

  // Shared fields
  reason: string;
  notes?: string;
  stageName?: string; // 'KG' | 'Primary' | 'Prep' | 'Secondary' or Grade Band
  stageManagerId?: string;
  stageSecretaryName?: string;
  notifiedSecretary?: boolean;
  notifiedAt?: string;
}

export interface TeacherStageEvaluationItem {
  teacherId: string;
  teacherName: string;
  assignedClasses: string[];
  totalSessions: number;
  visitsCount: number;
  visitsAvgScore: number | string;
  complaintsCount: number;
  curriculumAdherence?: string;
  bookletChecking?: string;
  classroomManagement?: string;
  punctuality?: string;
  complaintsStatus?: string;
  customNotes?: string;
  absencesCount?: number;
  lateArrivalsCount?: number;
  earlyLeavesCount?: number;
  delayMinutes?: number;
  disciplineScore?: number;
}

export interface StageFollowUpRecord {
  id: string;
  stageManagerId: string;
  stageManagerName: string;
  gradeBand: string;
  periodType: 'weekly' | 'monthly' | 'termly';
  weekNumber?: number | string;
  date: string;
  timestamp: number;
  teachersData: TeacherStageEvaluationItem[];
  overallStageNotes?: string;
  includeComplaints?: boolean;
  selectedComplaintIds?: string[];
  includedComplaints?: Complaint[];
  includeActionPlans?: boolean;
  selectedActionPlanIds?: string[];
  includedActionPlans?: StudentActionPlan[];
  includeAttendance?: boolean;
  attendanceSummary?: {
    totalAbsences: number;
    totalLateArrivals: number;
    totalEarlyLeaves: number;
    totalDelayMinutes: number;
    totalLostHours: number;
    mostAbsentTeachers?: { name: string; count: number }[];
    mostLateTeachers?: { name: string; minutes: number }[];
    mostEarlyLeaveTeachers?: { name: string; minutes: number }[];
  };
}

export interface SchoolSettings {
  presence: Record<string, SchoolDayPresence>; // "0" to "6"
  periodSettings: SchoolPeriodSettings;
  schedule: Record<string, SchoolPeriodRecord[]>; // "0" to "6"
  schoolName?: string;
  departmentName?: string;
  academicYear?: string;
  currentTerm?: string;
  hodName?: string; // default "Abdul-rahman Ghareeb"
  schoolLogoUrl?: string;
  stageManagers?: StageManager[];
  stageSecretaries?: StageSecretary[];
  visitRecords?: VisitRecord[];
  bookletObservations?: BookletObservation[];
  weeklyPlanStatuses?: WeeklyPlanStatusRecord[];
  stageReports?: StageReportRecord[];
  stageFollowUps?: StageFollowUpRecord[];
  teachers?: Teacher[];
  teacherSchedules?: Record<string, Record<string, SchoolPeriodRecord[]>>;
  parentComplaints?: ParentComplaint[];
  complaints?: Complaint[];
  actionPlans?: StudentActionPlan[];
  staffAttendanceRecords?: StaffAttendanceRecord[];
}

export interface WeeklyPlanLog {
  weekNumber: number;
  logDate: string;
  progress: 'لم يتحسن' | 'تحسن تدريجي بسيط' | 'تحسن ملحوظ (تم الإغلاق)';
  notes?: string;
}

export interface StudentActionPlan extends SyncableRecord {
  id: string;
  studentId: string;
  studentNameAr: string;
  studentNameEn: string;
  gradeClass: string;
  teacherId: string;
  teacherName: string;
  weaknessAreas: string[]; // Arabic selections
  actionSteps: string[]; // Arabic selections
  startDate: string;
  term: string; // e.g., "الفصل الدراسي الأول"
  status: 'ACTIVE' | 'RESOLVED'; // Default: 'ACTIVE' (قيد المتابعة)
  weeklyLogs: WeeklyPlanLog[];
  reportedAsResolved?: boolean; // Default: false (flagged true after dispatching in report)
}

export interface Complaint extends SyncableRecord {
  id: string;
  direction: 'TEACHER_TO_STUDENT' | 'STUDENT_TO_TEACHER';
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentNameAr: string;
  studentNameEn: string;
  gradeClass: string;
  reason: string;
  actionTaken: string;
  notes?: string;
  timestamp: string;
  term: string; // e.g., "Term 1"
  month: string; // e.g., "October"
  weeklyReportSent: boolean; // Default: false
  weeklyReportDate?: string | null;
}

export interface ParentComplaint {
  id: string;
  teacherId: string;
  studentName: string;
  className: string;
  description: string;
  date: string;
  status: 'new' | 'in_progress' | 'resolved';
}

export interface Teacher {
  id: string;
  name: string;
  phone?: string;
  isActive: boolean;
  isHod?: boolean;
  stage?: string;
}

export interface TeacherWorkload {
  totalSessions: number;
  assignedClasses: string[];
  gradeBands: string[];
}


export type DayWorkingHours = {
  isOff: boolean;
  startTime: string;
  endTime: string;
};

export type WeeklyWorkingHours = {
  0: DayWorkingHours;
  1: DayWorkingHours;
  2: DayWorkingHours;
  3: DayWorkingHours;
  4: DayWorkingHours;
  5: DayWorkingHours;
  6: DayWorkingHours;
};

export type PaymentCycle = 'per_lesson' | '4_lessons' | '8_lessons' | '12_lessons' | 'monthly';

export interface GroupScheduleSlot {
  day: string;
  time: string;
}

export interface Group extends SyncableRecord {
  name: string;
  grade: GradeLevel;
  type: LessonType;
  monthlyPackagePrice: number;
  pricePerSession?: number;
  sessionCount: number; // e.g., 1, 4, 8, 12
  startingSessionNumber?: number; // e.g., 1, 3, 5, 8...
  defaultFinanceAccountId?: string; // Replaced paymentMethod
  paymentCycle?: PaymentCycle;
  paymentModel?: 'per_session' | 'package';
  scheduleDays?: string[]; // e.g. ['Sunday', 'Wednesday']
  scheduleTime?: string; // e.g. "17:00"
  scheduleDayTimes?: Record<string, string>; // e.g. { "Sunday": "15:00", "Wednesday": "19:00" }
  schedules?: GroupScheduleSlot[]; // Multi-schedule slots with independent day/time
  zoomLink?: string;
  meetLink?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  color: string;
  lessonDurationMinutes?: number; // Default 60 mins
  status?: 'active' | 'archived';
  whatsAppGroupLink?: string;
}

export interface StudentDocument {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'image' | 'doc';
  fileSize: string;
  uploadedAt: string;
  url: string;
  category: 'homework' | 'exam' | 'doc';
}

export type PaymentPlanType = 'per_lesson' | '4_lessons' | '8_lessons' | '12_lessons' | 'custom_bundle';

export interface Student extends SyncableRecord {
  name: string;
  certificateName?: string; // Transliterated/custom name used on certificates (e.g. "Rital Tarek" for "ريتال طارق")
  groupId: string;
  grade: GradeLevel;
  parentName: string;
  parentPhone: string;
  studentPhone: string;
  phone?: string;
  notes?: string;
  avatarUrl?: string;
  documents: StudentDocument[];
  joinedDate: string;
  status?: 'active' | 'archived';
  paymentStatus?: PaymentStatus;
  packageProgress?: number;
  totalLessonsCount?: number;
  paymentPlan?: PaymentPlanType;
  pricePerLesson?: number;
  bundleSize?: number;
  customBundlePrice?: number;
  advanceBalance?: number;
  monthlyFee?: number;
}

export interface StudentPaymentDetail {
  studentId: string;
  studentName: string;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  amountDue: number;
  notes?: string;
}


export type PerformanceLevel = 'needs_support' | 'developing' | 'good' | 'very_good' | 'excellent';
export type ParticipationLevel = 'active' | 'good' | 'quiet' | 'needs_encouragement';
export type UnderstandingLevel = 'excellent' | 'good' | 'developing' | 'needs_review';
export type SpeakingLevel = 'confident' | 'good' | 'improving' | 'needs_practice';
export type FocusLevel = 'excellent' | 'good' | 'sometimes_distracted' | 'needs_more_focus';
export type ProgressLevel = 'improved' | 'stable' | 'needs_attention';

export interface GeneratedFeedback {
  short: string;
  parent: string;
  detailed: string;
}

export interface StudentSessionPerformance {
  level?: PerformanceLevel;
  participation?: ParticipationLevel;
  understanding?: UnderstandingLevel;
  speaking?: SpeakingLevel;
  focus?: FocusLevel;
  progress?: ProgressLevel;
  gender?: 'male' | 'female';
  generatedFeedback?: GeneratedFeedback;
  feedbackLanguage?: 'ar' | 'en' | 'de';
  generatedAt?: string;
  feedbackVariantId?: string;
}

export interface LessonReport {
  attendanceStatus?: AttendanceStatus;
  studentAttendance?: Record<string, AttendanceStatus>;
  homeworkStatus?: HomeworkStatus;
  homeworkTitle?: string;
  homeworkDescription?: string;
  quizScore?: number;
  examScore?: number;
  participationScore?: number;
  paymentStatus?: PaymentStatus;
  amountPaid?: number;
  studentPayments?: Record<string, { status: PaymentStatus; amount: number }>;
  teacherNotes?: string;
  dictationScore?: string;
  arabicExamScore?: string;
  arabicPerformance?: string;
  arabicHomeworkOption?: string;
  arabicHomeworkRequired?: string;
  arabicParentNotes?: string;
  arabicTemplateMessage?: string;
  arabicFullGeneratedReport?: string;
  studentHomeworkDone?: Record<string, 'yes' | 'no'>;
  studentDictationGrade?: Record<string, number>;
  studentExamGrade?: Record<string, number>;
  studentNotes?: Record<string, string>;
  studentPerformance?: Record<string, StudentSessionPerformance>;
  savedAt?: string;
  scores?: any;
}

export interface DeletedItem<T> {
  item: T;
  deletedAt: string;
}

export interface RecentlyDeletedData {
  students: DeletedItem<Student>[];
  groups: DeletedItem<Group>[];
  lessons: DeletedItem<Lesson>[];
}

export interface ActiveLessonSession {
  lessonId: string;
  lessonTitle: string;
  groupName: string;
  grade?: string;
  type?: LessonType;
  startedAt: number; // epoch timestamp
  accumulatedSeconds: number;
  durationMinutes: number;
  isRunning: boolean;
  startTimeStr: string;
}

export interface Lesson extends SyncableRecord {
  groupId: string;
  groupName: string;
  studentId?: string; // Optional for individual vs group lesson
  studentName?: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h or 12h formatted display)
  durationMinutes: number;
  type: LessonType;
  grade: GradeLevel;
  sessionNumber: number;
  totalSessionsInPackage: number;
  status: LessonStatus;
  paymentStatus: PaymentStatus;
  amountDue: number;
  amountPaid: number;
  meetingLink?: string;
  locationAddress?: string;
  location?: string;
  report?: LessonReport;
  studentPayments?: Record<string, StudentPaymentDetail>;
  offlinePaymentAction?: 'paid_now' | 'will_pay_next' | 'partially_paid' | 'not_paid';
  notes?: string;
  duration?: number;
  // Quick Lesson fields
  isQuickLesson?: boolean;
  quickStudentName?: string;
  quickParentName?: string;
  quickStudentPhone?: string;
  quickParentPhone?: string;
  quickNotes?: string;
  homeworkFollowUpSentAt?: string; // ISO string when follow-up was sent
}

export type SyncStatus = 'synced' | 'pending' | 'error';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'max';
export type NotificationSound = 'default' | 'beep' | 'chime' | 'bell' | 'gentle';
export type AlarmTone = 'digital' | 'loud_bell' | 'radar' | 'gentle_chime';

export interface CategoryNotificationConfig {
  enabled: boolean;
  sound: NotificationSound;
  priority: NotificationPriority;
}

export interface NotificationSettings {
  masterEnabled: boolean;
  
  // Category configs
  lessonReminder: CategoryNotificationConfig;
  lessonStart: CategoryNotificationConfig;
  paymentDue: CategoryNotificationConfig;
  dailySummary: CategoryNotificationConfig;
  attendanceReminder: CategoryNotificationConfig;
  schoolLessonReminder?: CategoryNotificationConfig;

  // Reminder timing controls
  lessonReminderMinutesBefore: number; // 5, 10, 15, 30, 60 or custom

  // Continuous Alarm Mode for pre-lesson reminders
  alarmModeEnabled?: boolean; // When true, behaves like an alarm clock with extended sound
  alarmDurationSeconds?: number; // Duration alarm plays in seconds (e.g. 30, 60, 120)
  alarmTone?: AlarmTone; // Tone type ('digital' | 'loud_bell' | 'radar' | 'gentle_chime')
  alarmAutoSnoozeMinutes?: number; // Snooze duration in minutes (e.g. 5)

  // Daily summary controls
  dailySummaryTime: string; // e.g. "20:00"
  dailySummaryIncludeLessons: boolean;
  dailySummaryIncludeIncome: boolean;
  dailySummaryIncludePendingPayments: boolean;
}

export interface ScheduledNotificationItem {
  id: number;
  title: string;
  body: string;
  scheduledAt: string; // ISO date string or formatted date
  category: 'lessonReminder' | 'lessonStart' | 'paymentDue' | 'dailySummary' | 'attendanceReminder' | 'schoolLessonReminder' | 'general';
  extra?: Record<string, any>;
}

export interface BackupData {
  timestamp: string;
  version: string;
  profile: TeacherProfile;
  schoolSettings?: SchoolSettings;
  groups: Group[];
  students: Student[];
  lessons: Lesson[];
  payments: PaymentRecord[];
  notifications: NotificationItem[];
  certificates?: CertificateRecord[];
  customAiBackgrounds?: AICertificateBackground[];
  notificationSettings?: NotificationSettings;
  inspirationSettings?: InspirationSettings;
  inspirationMessages?: InspirationMessage[];
  syncQueue: any[];
  todos?: TodoItem[];
  theme?: 'light' | 'dark';
  accentColor?: AccentColor;
  hodStudents?: HodGermanStudent[];
  hodComplaints?: Complaint[];
  hodActionPlans?: StudentActionPlan[];
  hodVisits?: VisitRecord[];
  schoolNotes?: SchoolNote[];
  financeAccounts?: FinanceAccount[];
  financeCategories?: FinanceCategory[];
  financeTransactions?: FinanceTransaction[];
  financeRecurring?: FinanceRecurring[];
  financeInstallments?: FinanceInstallment[];
  financeNotifications?: FinanceNotification[];
}

export type InspirationFrequency = 'disabled' | 'daily' | 'before_first_lesson' | 'random_daily';
export type InspirationDisplayMethod = 'notification' | 'in_app' | 'both';
export type InspirationSource = 'all' | 'favorites_only';

export interface InspirationMessage {
  id: string;
  text: string;
  isFavorite: boolean;
  isCustom?: boolean;
  createdAt?: string;
}

export interface FinanceNotification extends SyncableRecord {
  title: string;
  message: string;
  amount?: number;
  priority: 'critical' | 'warning' | 'informational';
  read: boolean;
  relatedId?: string; // e.g. recurringId or installmentId
  type: 'recurring' | 'installment' | 'investment' | 'system';
  dueDate?: string;
  createdAt: string;
}

export interface FinanceAccount extends SyncableRecord {
  name: string;
  type: 'cash' | 'bank' | 'wallet' | 'credit' | 'investment' | 'other';
  currency: string;
  currentBalance: number;
  initialBalance?: number;
  openingBalance?: number;
  creditLimit?: number;
  accountNumber?: string;
  bankName?: string;
  color?: string;
  annualInterestRate?: number;
  annualRate?: number;
  isActive?: boolean;
  investmentEnabled?: boolean;
  calculationFrequency?: string;
  compounding?: string;
  createdAt?: string;
  
  // New investment fields
  initialCapital?: number;
  totalContributions?: number;
  accumulatedReturns?: number;
  compoundingFrequency?: 'daily' | 'monthly' | 'yearly';
  reinvestReturns?: boolean;
  recurringContributionAmount?: number;
  recurringContributionFrequency?: 'daily' | 'weekly' | 'monthly';
  nextContributionDate?: string;
  lastCompoundedDate?: string;
}

export interface FinanceCategory extends SyncableRecord {
  name: string;
  type: 'income' | 'expense' | 'transfer';
  parentId?: string;
  icon?: string;
  color?: string;
  isDefault?: boolean;
  isActive?: boolean;
  createdAt: string;
}

export interface FinanceTransaction extends SyncableRecord {
  type: 'income' | 'expense' | 'transfer' | 'adjustment' | 'investment_return';
  amount: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  date: string;
  note?: string;
  relatedStudentId?: string;
  relatedPaymentId?: string;
  createdAt: string;
  investmentPeriodKey?: string; // used to prevent duplicate returns
}

export interface FinanceRecurring extends SyncableRecord {
  name: string;
  type?: 'income' | 'expense';
  amount: number;
  categoryId: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dueDayOfMonth?: number;
  startDate?: string;
  endDate?: string;
  nextDueDate?: string;
  notificationsEnabled?: boolean;
  isActive?: boolean;
  lastPaidDate?: string;
  createdAt: string;
}

export interface FinanceInstallment extends SyncableRecord {
  name: string;
  categoryId: string;
  accountId: string;
  originalAmount: number;
  downPayment: number;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingAmount: number;
  frequency: string;
  firstDueDate: string;
  nextDueDate: string;
  status: 'active' | 'completed' | 'overdue';
  notificationsEnabled: boolean;
  notes?: string;
  createdAt?: string;
}

export interface InspirationSettings {
  frequency: InspirationFrequency;
  displayMethod: InspirationDisplayMethod;
  source: InspirationSource;
  lastShownDate?: string; // YYYY-MM-DD
  lastShownMessageId?: string;
}

export interface BackupIntegrityReport {
  timestamp: string;
  isValid: boolean;
  totalRecords: number;
  details: {
    groupsCount: number;
    studentsCount: number;
    lessonsCount: number;
    paymentsCount: number;
    quickLessonsCount: number;
  };
  messages: string[];
}

export interface PaymentRecord extends SyncableRecord {
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  lessonId?: string;
  lessonIds?: string[];
  lessonDates?: string[]; // Array of formatted dates e.g. ["01/08/2026", "03/08/2026"]
  cycleNumber?: number;
  bundleSize?: number; // e.g. 1, 4, 8, 12
  amountDue: number;
  amountPaid: number;
  discountAmount?: number;
  advanceAmount?: number;
  refundAmount?: number;
  remainingBalance?: number;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  paymentType?: 'lesson_fee' | 'package_bundle' | 'advance_payment' | 'refund' | 'adjustment';
  financeAccountId?: string;
  paymentMethod?: string; // Kept for legacy
  lessonsIncluded?: string[];
  notes?: string;
  createdAt?: string;
}

export interface NotificationItem extends SyncableRecord {
  title: string;
  message: string;
  time: string;
  type: 'reminder' | 'payment' | 'system';
  read: boolean;
  lessonId?: string;
}
export interface TodoItem extends SyncableRecord {
  text: string;
  completed?: boolean;
  dueDate?: string;
  category?: string;
  createdAt: number;
}

// ==========================================
// CERTIFICATE CENTER MODELS
// ==========================================
export type CertificateLanguage = 'en' | 'de' | 'ar';

export type CertificateCategoryKey =
  | 'achievement'
  | 'progress'
  | 'german'
  | 'learning'
  | 'commitment'
  | 'recognition'
  | 'custom';

export type CertificateTypeKey =
  // Achievement
  | 'achievement'
  | 'outstanding_achievement'
  | 'outstanding_performance'
  | 'excellent_performance'
  // Progress
  | 'great_progress'
  | 'most_improved'
  | 'excellent_progress'
  | 'outstanding_improvement'
  // German
  | 'german_achievement'
  | 'german_speaking'
  | 'german_vocabulary'
  | 'german_pronunciation'
  | 'german_excellence'
  // Learning
  | 'homework_excellence'
  | 'excellent_participation'
  | 'exam_result'
  | 'outstanding_learning'
  | 'excellent_effort'
  // Behavior / Commitment
  | 'perfect_attendance'
  | 'excellent_attendance'
  | 'outstanding_commitment'
  | 'exemplary_discipline'
  // Recognition
  | 'student_of_month'
  | 'star_student'
  | 'student_of_week'
  | 'appreciation'
  | 'special_recognition'
  // Custom
  | 'custom'
  // Compatibility aliases
  | 'course_completion'
  | 'participation';

export type CertificateTemplateId =
  | 'neutral'
  | 'classic'
  | 'elegant'
  | 'kids'
  | 'german_themed'
  | 'modern'
  | 'boys_champion'
  | 'girls_princess'
  | 'boys'
  | 'girls'
  | 'custom_ai_bg'
  | `ai_bg_${string}`;

export interface AICertificateBackground {
  id: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  textColorMode: 'dark' | 'light' | 'gold_on_dark';
  themeColor?: string;
  createdAt: number;
  promptUsed?: string;
  fileSizeKB?: number;
}

export interface CertificateRecord extends SyncableRecord {
  studentId: string;
  studentName: string; // original student name
  recipientName: string; // certificate-specific name used on the certificate (e.g. English/German name)
  studentCertificateName?: string;
  groupId?: string;
  groupName?: string;
  certificateType: CertificateTypeKey;
  type?: CertificateTypeKey;
  language: CertificateLanguage;
  template: CertificateTemplateId;
  templateId?: CertificateTemplateId;
  title: string;
  subtitle?: string;
  description: string;
  issueDate: string; // YYYY-MM-DD
  teacherName?: string;
  instructorName?: string;
  courseOrLevelTitle?: string;
  centerOrSchoolName?: string;
  score?: string; // Optional score or note (e.g., "100%", "Sehr Gut", "98/100")
  gradeOrScore?: string;
  customBadgeText?: string; // Optional custom badge text
  customBackgroundId?: string;
  customBackgroundUrl?: string;
  customBackgroundTextColor?: 'dark' | 'light' | 'gold_on_dark';
  createdAt: number; // timestamp
}

export interface StudentHonoredSummary {
  student: Student;
  certificateCount: number;
  lastCertificate?: CertificateRecord;
  lastCertificateDate?: string;
  isHonoredInPeriod: boolean;
}

export interface HodGermanStudent extends SyncableRecord {
  id: string;
  nameAr: string;
  nameEn: string;
  gradeClass: string;
  gender: 'Boy' | 'Girl';
  secondLanguage: 'German';
  busLine: string;
  name?: string;
  createdAt?: string;
}

