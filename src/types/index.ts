import { GoldHolding } from '../services/goldPrice/goldPriceTypes';
import { LernstudioSet } from './lernstudio';

export type GradeLevel = 
  | 'Grade 1' | 'Grade 2' | 'Grade 3' | 'Grade 4' 
  | 'Grade 5' | 'Grade 6' | 'Grade 7' | 'Grade 8' 
  | 'Grade 9' | 'Grade 10' | 'Grade 11' | 'Grade 12'
  | 'Klasse 5'
  | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type LessonType = 'online' | 'offline';

export type LessonStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending_action';

// ==========================================
// PROTOCOL COMPATIBILITY & CAPABILITIES
// ==========================================
export const CURRENT_SYNC_PROTOCOL_VERSION = 2;
export const MIN_SUPPORTED_SYNC_PROTOCOL_VERSION = 1;
export const APP_BUILD_VERSION = '3.0.0';

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
  appVersion: string;            // e.g., "3.0.0"
  capabilities: SyncCapability[];
  timestamp?: number;
}

export interface SyncableRecord {
  id: string;
  updatedAt?: number; // strictly for Last-Write-Wins (LWW) conflict resolution
  updatedByDeviceId?: string; // deterministic tie-breaker
  originDeviceId?: string; // device that authored this specific mutation
  originRevision?: number; // monotonic sequence integer from the authoring device
  originPlatform?: 'android' | 'web'; // Android primary device tie-breaker when timestamps match
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
  pairedPeers?: PairedPeer[];
  status?: 'online' | 'syncing' | 'offline' | 'error';
  lastSyncedTimestamp?: number;
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
  notificationSettings?: NotificationSettings;
  inspirationSettings?: InspirationSettings;
  inspirationMessages?: InspirationMessage[];
  pickerNames?: string[];
  prunedLessonIds?: string[];
  goldPriceSettings?: Record<string, any>;
  theme?: 'light' | 'dark' | 'amoled' | 'tinted';
  accentColor?: AccentColor;
  reportLanguage?: AppLanguage;
  mobileBottomNavOrder?: string[];
  sidebarNavOrder?: string[];
  activeLessonSessionState?: ActiveLessonSessionState;
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
  teacherId?: string;
  teacherName?: string;
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
    financeNotifications?: FinanceNotification[];
    goldHoldings?: GoldHolding[];
    customAiBackgrounds?: AICertificateBackground[];
    lernstudioSets?: LernstudioSet[];
    homeworkAssignments?: any[];
    homeworkSubmissions?: any[];
    customVerbGroups?: any[];
    groupWeeklySessions?: GroupWeeklySession[];
    zoomMeetingRecords?: ZoomMeetingRecord[];
    zoomMeetingHistory?: ZoomMeetingHistory[];
    grainRecordingMatches?: GrainRecordingMatch[];
  };
  purgedRecords?: PurgedRecordTombstone[];
  hasAuthoritativeTombstones?: boolean;
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

export type AccentColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal' | 'indigo' | 'rose' | 'amber' | 'emerald' | 'fuchsia' | 'cyan' | 'violet' | 'slate' | 'pink' | 'lime' | 'darkblue' | 'white' | (string & {});

export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'exempted' | 'not_paid' | 'due';

export type AttendanceStatus = 'present' | 'absent' | 'late';

export type HomeworkStatus = 'assigned' | 'completed' | 'not_completed';

export interface TeacherProfile {
  id: string;
  displayName: string;
  name?: string; // Compatibility alias for displayName
  displayNameEn?: string; // English / German name for Certificates & Diplomas (e.g. "Herr Omar Hassan")
  displayNameAr?: string; // Arabic name for Reports, WhatsApp & Parent summaries (e.g. "أ. عمر حسن")
  nameEn?: string; // Compatibility alias
  nameAr?: string; // Compatibility alias
  defaultLocation?: string;
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
  defaultZoomTimezone?: string;
  enableLessonAlerts?: boolean; // In-app alerts for upcoming lessons (within 30 mins)
  enableBrowserPush?: boolean; // Browser push notifications
  parentMessageTemplates?: Record<string, string>;
  weeklyIncomeGoal?: number;
  monthlyIncomeGoal?: number;
  financeStreak?: number;
  financeLastActivityDate?: string;
  schoolSettings?: SchoolSettings;
  buddyCustomization?: any;
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
  source?: string; // e.g. "school_schedule" | "custom_timed_session"
  periodNumber: number; // 1-indexed (or 0 for custom-timed session)
  subjectName?: string;
  className?: string;
  notes?: string;
  isCustomTime?: boolean; // When true, has dedicated custom start & end time independent of standard school period numbers
  startTime?: string; // e.g. "14:30"
  endTime?: string; // e.g. "16:00"
  teacherId?: string;
  teacherName?: string;
  dayKey?: string; // "0" to "6"
  room?: string;
  sessionType?: string; // e.g. "حصة إضافية" | "تقوية" | "خاصة" | "نشاط"
}

export interface CustomTimedSession {
  id: string;
  teacherId: string;
  teacherName?: string;
  dayKey: string; // "0" to "6"
  subjectName: string;
  className: string;
  startTime: string; // HH:MM (e.g. "14:30")
  endTime: string; // HH:MM (e.g. "16:00")
  room?: string;
  notes?: string;
  sessionType?: string; // e.g. "حصة إضافية / تقوية" | "حصة خاصة" | "نشاط إثرائي" | "تدريب لغوي" | "حصة خارج الجدول"
  createdAt?: string;
  updatedAt?: number;
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
  date?: string;
  class?: string;
  focusAreas?: string;
  notes?: string;
  weeklyReportSent?: boolean;
  weeklyReportDate?: string;
  isDownloaded?: boolean;
  downloadedAt?: string;
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
  includeVisits?: boolean;
  selectedVisitIds?: string[];
  includedVisits?: VisitRecord[];
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

export type VisitPlannerStatus = 'completed' | 'planned' | 'rescheduled' | 'cancelled' | 'unscheduled';

export interface PlannedVisitRecord extends SyncableRecord {
  id: string;
  term: string;
  teacherId: string;
  teacherName: string;
  gradeClass: string;
  grade?: string;
  sectionClass?: string;
  date: string; // YYYY-MM-DD
  dayKey: string; // "0" to "6"
  weekdayNameAr?: string;
  weekdayNameEn?: string;
  periodNumber: number;
  startTime?: string;
  endTime?: string;
  status: VisitPlannerStatus;
  isManualOverride?: boolean;
  actualVisitRecordId?: string;
  rescheduledFromDate?: string;
  rescheduledFromPeriod?: number;
  notes?: string;
  conflictReason?: string;
  subjectName?: string;
}

export interface TermVisitRequirement {
  id: string;
  teacherId: string;
  teacherName: string;
  gradeClass: string;
  requiredVisitsCount: number;
  completedVisitsCount: number;
  plannedVisitsCount: number;
  isSatisfied: boolean;
  availableSlotCount: number;
  conflictReason?: string;
}

export interface TermVisitPlannerSettings {
  term: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  workingDays: string[]; // ["0", "1", "2", "3", "4"]
  visitsPerTeacherPerClass: number; // Default 1
  hodTeacherId?: string;
  plannedVisits?: PlannedVisitRecord[];
  requirements?: TermVisitRequirement[];
  lastGeneratedAt?: string;
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
  customTimedSessions?: CustomTimedSession[];
  termVisitPlannerSettings?: TermVisitPlannerSettings;
  germanStudents?: HodGermanStudent[];
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
  className?: string;
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
  className?: string;
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
  classes?: string[];
  assignedClasses?: string[];
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

export type ScheduleRecurrence = 'weekly' | 'biweekly_a' | 'biweekly_b';

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
  scheduleRecurrence?: ScheduleRecurrence; // 'weekly' (default), 'biweekly_a' (Week A / starts this week), 'biweekly_b' (Week B / starts next week)
  biweeklyAnchorDate?: string;
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
  duration?: number;
  mode?: LessonType;
  schedule?: string;
  students?: string[];
  level?: string;
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
  nameEn?: string;
  nameAr?: string;
  displayNameEn?: string;
  displayNameAr?: string;
  schoolGrade?: string;
  certificateName?: string; // Transliterated/custom name used on certificates (e.g. "Rital Tarek" for "ريتال طارق")
  gender?: 'male' | 'female';
  groupId: string;
  archivedGroupId?: string;
  grade: GradeLevel;
  parentName: string;
  parentPhone: string;
  parentUsername?: string;
  parentContactType?: 'phone' | 'username';
  studentPhone: string;
  studentUsername?: string;
  studentContactType?: 'phone' | 'username';
  phone?: string;
  username?: string;
  notes?: string;
  avatarUrl?: string;
  documents: StudentDocument[];
  joinedDate: string;
  status?: 'active' | 'archived';
  paymentStatus?: PaymentStatus;
  packageProgress?: number;
  totalLessonsCount?: number;
  paymentPlan?: PaymentPlanType;
  scheduleRecurrence?: ScheduleRecurrence; // 'weekly' (default), 'biweekly_a' (Week A / أسبوع أ), 'biweekly_b' (Week B / أسبوع ب)
  pricePerLesson?: number;
  bundleSize?: number;
  customBundlePrice?: number;
  advanceBalance?: number;
  monthlyFee?: number;
  scheduleDays?: string[];
  scheduleTime?: string;
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
export type ReadingLevel = 'fluent' | 'good' | 'improving' | 'needs_practice';
export type WritingLevel = 'accurate' | 'good' | 'improving' | 'needs_practice';
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
  reading?: ReadingLevel;
  writing?: WritingLevel;
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
  arabicTopicsExplained?: string;
  arabicHomeworkRequired?: string;
  arabicPreviousHomework?: string;
  previousHomeworkDescription?: string;
  arabicParentNotes?: string;
  arabicTemplateMessage?: string;
  arabicFullGeneratedReport?: string;
  studentHomeworkDone?: Record<string, 'yes' | 'no' | 'none'>;
  studentDictationGrade?: Record<string, number>;
  studentExamGrade?: Record<string, number>;
  studentNotes?: Record<string, string>;
  studentPerformance?: Record<string, StudentSessionPerformance>;
  recordingLink?: string;
  recordingLink2?: string;
  zoomMeetingLink?: string;
  grainMeta?: GrainLessonMetadata;
  savedAt?: string;
  scores?: any;
  studentScores?: Record<string, any>;
  onlineHomeworkAssignmentId?: string;
  onlineHomeworkShortId?: string;
  onlineHomeworkTitle?: string;
}

export interface DeletedItem<T> {
  item: T;
  deletedAt: string;
}

export interface PurgedRecordTombstone {
  id: string;
  type:
    | 'student'
    | 'group'
    | 'lesson'
    | 'schoolNotes'
    | 'notifications'
    | 'homeworkAssignments'
    | 'homeworkAssignment'
    | 'homeworkSubmissions'
    | 'certificates'
    | 'certificate'
    | 'hodStudents'
    | 'hodComplaints'
    | 'hodActionPlans'
    | 'hodVisits'
    | 'goldHoldings'
    | 'goldHolding'
    | 'customAiBackgrounds';
  purgedAt: string;
  updatedAt: number;
  originRevision?: number;
}

export interface RecentlyDeletedData {
  students: DeletedItem<Student>[];
  groups: DeletedItem<Group>[];
  lessons: DeletedItem<Lesson>[];
  purgedRecords?: PurgedRecordTombstone[];
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
  updatedAt?: number;
}

export interface ActiveLessonSessionState {
  session: ActiveLessonSession | null;
  updatedAt: number;
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
  zoomMeetingLink?: string;
  recordingLink?: string;
  recordingLink2?: string;
  grainMeta?: GrainLessonMetadata;
  locationAddress?: string;
  location?: string;
  report?: LessonReport;
  whatsAppDispatchedStudents?: Record<string, string>;
  studentPayments?: Record<string, StudentPaymentDetail>;
  offlinePaymentAction?: 'paid_now' | 'will_pay_next' | 'partially_paid' | 'not_paid';
  notes?: string;
  duration?: number;
  scheduleRecurrence?: ScheduleRecurrence;
  biweeklyWeek?: 'A' | 'B';
  // Quick Lesson fields
  isQuickLesson?: boolean;
  quickStudentName?: string;
  quickParentName?: string;
  quickStudentPhone?: string;
  quickParentPhone?: string;
  quickNotes?: string;
  homeworkFollowUpSentAt?: string; // ISO string when follow-up was sent
  homeworkTitle?: string;
  homeworkDescription?: string;
  dayOfWeek?: string;
  attendance?: Record<string, any>;
  whatWasTaught?: string;
  topic?: string;
  isAutoGenerated?: boolean;
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
  theme?: 'light' | 'dark' | 'amoled' | 'tinted';
  accentColor?: AccentColor;
  reportLanguage?: AppLanguage;
  mobileBottomNavOrder?: string[];
  sidebarNavOrder?: string[];
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
  goldHoldings?: GoldHolding[];
  lernstudioSets?: LernstudioSet[];
  homeworkAssignments?: any[];
  homeworkSubmissions?: any[];
  pickerNames?: string[];
  recentlyDeleted?: RecentlyDeletedData;
  dismissedDashboardLessons?: string[];
  activeLessonSessionState?: ActiveLessonSessionState;
  grainGroupLearningRecords?: GrainGroupLearningRecord[];
  groupWeeklySessions?: GroupWeeklySession[];
  zoomMeetingRecords?: ZoomMeetingRecord[];
  zoomMeetingHistory?: ZoomMeetingHistory[];
  grainRecordingMatches?: GrainRecordingMatch[];
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
  autoGenerateTransaction?: boolean;
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
  monthlyAmount?: number;
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
  amount?: number;
  discountAmount?: number;
  advanceAmount?: number;
  refundAmount?: number;
  remainingBalance?: number;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  paymentType?: 'lesson_fee' | 'package_bundle' | 'advance_payment' | 'refund' | 'adjustment' | 'exemption';
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
  | 'creativity'
  | 'leadership'
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
  | 'german_reading_fluency'
  | 'german_grammar_master'
  // Learning
  | 'homework_excellence'
  | 'excellent_participation'
  | 'exam_result'
  | 'outstanding_learning'
  | 'excellent_effort'
  | 'fast_learner'
  | 'moral_excellence'
  // Creativity & Innovation
  | 'creative_genius'
  | 'problem_solver'
  | 'inspirational_project'
  // Leadership & Team Spirit
  | 'team_leader'
  | 'presentation_mastery'
  | 'positive_energy'
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
  | 'royal_emerald'
  | 'golden_olympic'
  | 'space_explorer'
  | 'islamic_heritage'
  | 'future_tech'
  | 'vintage_scroll'
  | 'kids'
  | 'german_themed'
  | 'modern'
  | 'boys_champion'
  | 'girls_princess'
  | 'boys'
  | 'girls'
  | 'custom_ai_bg'
  | `ai_bg_${string}`;

export interface AICertificateBackground extends SyncableRecord {
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
  courseName?: string;
  level?: string;
  centerOrSchoolName?: string;
  score?: string; // Optional score or note (e.g., "100%", "Sehr Gut", "98/100")
  gradeOrScore?: string;
  customBadgeText?: string; // Optional custom badge text
  badgeText?: string;
  signatureUrl?: string;
  customBackgroundId?: string;
  customBackgroundUrl?: string;
  customBackgroundTextColor?: 'dark' | 'light' | 'gold_on_dark';
  createdAt: number; // timestamp
}

export interface HodGermanStudent extends SyncableRecord {
  id: string;
  nameAr: string;
  nameEn: string;
  gradeClass: string;
  className?: string;
  grade?: string;
  status?: string;
  gpa?: number;
  gender: 'Boy' | 'Girl';
  secondLanguage: 'German';
  busLine: string;
  name?: string;
  createdAt?: string;
}

export * from '../services/goldPrice/goldPriceTypes';

// ==========================================
// GLÜCK × GRAIN INTEGRATION TYPES (COMPACT, PRIVACY-SAFE)
// ==========================================

export type GrainCapabilityState =
  | 'available_tested'
  | 'available_untested'
  | 'restricted'
  | 'failed'
  | 'unknown'
  | 'unsupported';

export interface GrainCapabilityReport {
  tokenAuthentication: GrainCapabilityState;
  personalApiScope: GrainCapabilityState;
  recordingDiscovery: GrainCapabilityState;
  recordingUrls: GrainCapabilityState;
  zoomCalendarMetadata: GrainCapabilityState;
  participants: GrainCapabilityState;
  aiSummaries: GrainCapabilityState;
  transcriptAccess: GrainCapabilityState;
  pagination: GrainCapabilityState;
  probedAt?: string;
}

/**
 * Part 2 (FIX-1): Public Share Access Classification for Parent Recording Links.
 * Only 'public_access_verified' links may be presented as parent-ready public recording links.
 */
export type GrainShareAccessClassification =
  | 'public_access_verified'
  | 'workspace_only'
  | 'restricted'
  | 'unknown'
  | 'link_unavailable';

export type GrainMatchStatus =
  | 'automatically_matched'
  | 'strong_match'
  | 'suggested_match'
  | 'needs_confirmation'
  | 'multiple_possible_lessons'
  | 'unmatched'
  | 'already_linked'
  | 'inaccessible';

export type GrainWorkflowStatusBadge =
  | 'automatically_matched'
  | 'part1_detected'
  | 'part2_detected'
  | 'lesson_content_extracted'
  | 'transcript_unavailable'
  | 'needs_teacher_confirmation';

export interface GrainPart2DetectionConfig {
  expectedGapMinutes: number; // default 40
  minGapMinutes: number; // default 32 (supports 40, 41, 42 and reasonable Zoom reconnect variation)
  maxGapMinutes: number; // default 52
}

export type GrainZoomLinkVerificationStatus =
  | 'verified_match'
  | 'mismatch'
  | 'not_exposed_by_grain'
  | 'missing_on_lesson';

export interface GrainMatchEvidence {
  lessonDateMatch: boolean;
  recordingDateLocal: string;
  recordingStartTimeLocal: string;
  timeDeltaMinutes: number | null;
  withinTimeWindow: boolean;
  zoomLinkStatus: GrainZoomLinkVerificationStatus;
  normalizedLessonZoomId?: string;
  normalizedGrainZoomId?: string;
  durationMinutesRecording: number;
  durationMinutesLesson: number;
  durationDiffMinutes: number;
  secondaryTitleMatched: boolean;
  secondaryParticipantsMatchedCount: number;
  matchedStudentIds?: string[];
  matchedGroupId?: string;
  learnedGroupMatchBoost?: number;
  learnedRecurringRuleId?: string;
  scheduleChangedRequiresConfirmation?: boolean;
  detectedPartSlot?: 'part1' | 'part2';
  pairedRecordingId?: string;
  part2StartGapMinutes?: number;
  matchTier?: GrainMatchTier;
  confidenceLevel?: GrainConfidenceLevel;
  matchedSessionId?: string;
  matchedSessionCode?: string;
  matchedCalendarEventUid?: string;
  matchedHistoryMeetingId?: string;
  matchedFromHistory?: boolean;
  reasons: string[];
}

export interface GrainLessonMatchCandidate {
  lessonId: string;
  lessonTitle: string;
  groupId?: string;
  groupName: string;
  studentId?: string;
  studentName?: string;
  lessonDate: string;
  lessonTime: string;
  lessonDurationMinutes: number;
  confidenceScore: number; // 0 to 100
  confidenceLevel?: GrainConfidenceLevel;
  matchTier?: GrainMatchTier;
  evidence: GrainMatchEvidence;
  existingRecordingLink?: string;
  existingRecordingLink2?: string;
  canAutoAssign?: boolean;
  recommendedSlot?: 'recordingLink' | 'recordingLink2';
}

export interface GrainDiscoveredRecording {
  id: string;
  title: string;
  startDatetime: string; // ISO
  endDatetime?: string; // ISO
  durationSeconds: number;
  durationMinutes: number;
  recordingUrl: string; // Shareable Grain URL (NOT a Zoom meeting URL)
  shareAccessClassification?: GrainShareAccessClassification;
  rawShareState?: string;
  sourcePlatform: string; // e.g. 'zoom', 'google_meet', 'unknown'
  zoomMeetingUrl?: string; // Optional supporting evidence only
  calendarEventTitle?: string;
  calendarEventUid?: string;
  participantNames?: string[]; // Supplementary display only — NEVER modifies attendance (Rule 2)
  hasAiSummary?: boolean;
  aiSummaryExcerpt?: string; // Compact excerpt only
  matchStatus: GrainMatchStatus;
  matchTier?: GrainMatchTier;
  confidenceLevel?: GrainConfidenceLevel;
  matchedSessionId?: string;
  matchedSessionCode?: string;
  suggestedLessonId?: string;
  confirmedLessonId?: string;
  matchedGroupId?: string;
  matchedGroupName?: string;
  matchedStudentIds?: string[];
  confidenceScore: number;
  matchReasons: string[];
  evidence?: GrainMatchEvidence;
  candidates: GrainLessonMatchCandidate[];
  detectedPartSlot?: 'part1' | 'part2';
  pairedRecordingId?: string;
  part2StartGapMinutes?: number;
  learnedRecurringRuleId?: string;
  workflowStatuses?: GrainWorkflowStatusBadge[];
  lastSyncedAt: string;
  importedAt?: string;
  removedFromLibrary?: boolean;
}

/**
 * Smart Group & Recurring Lesson Learning Record (`GrainGroupLearningRecord`).
 * Keyed by stable `groupId` (`group.id`), never relying on group name as primary ID.
 * Survives group renames and marks deleted groups as obsolete (`obsoleteGroup: true`).
 */
export interface GrainGroupLearningCorrectionEntry {
  correctedAt: string;
  previousSuggestedGroupId?: string;
  previousSuggestedLessonId?: string;
  chosenGroupId: string;
  chosenLessonId: string;
}

export interface GrainGroupLearningRecord {
  id: string;
  grainRecordingId: string;
  lessonId: string;
  groupId: string; // Stable group.id
  studentIds: string[];
  recordingDate: string; // YYYY-MM-DD
  recordingDayOfWeek: number; // 0 (Sunday) to 6 (Saturday)
  lessonWeekday?: number; // 0 (Sunday) to 6 (Saturday) from scheduled lesson.date
  recordingStartTime: string; // HH:MM
  lessonScheduledStartTime?: string; // HH:MM from lesson.time
  recordingDuration: number; // minutes
  lessonScheduledDuration?: number; // minutes
  scheduleRecurrence?: ScheduleRecurrence; // 'weekly' | 'biweekly_a' | 'biweekly_b'
  normalizedTitle: string;
  participantSignatures: string[]; // Normalized participant tokens (compact, non-sensitive)
  matchingEvidence: string[];
  teacherConfirmed: boolean;
  confirmedAt: string;
  updatedAt?: string;
  ruleEnabled?: boolean; // Default true; allows teacher to disable/enable a learned recurring rule
  part2GapToleranceMinutes?: GrainPart2DetectionConfig;
  obsoleteGroup?: boolean;
  correctionHistory?: GrainGroupLearningCorrectionEntry[];
}

export interface GrainVocabularySuggestion {
  german: string;
  article?: 'der' | 'die' | 'das' | '';
  arabic: string;
  exampleSentence?: string;
  source: 'grain_ai_summary' | 'transcript_analysis' | 'recording_metadata';
  confidence: 'high' | 'medium' | 'suggestion';
}

export interface GrainGrammarSuggestion {
  topic: string;
  explanationAr: string;
  explanationDe?: string;
  examples: string[];
  possibleLearnerDifficulties: string[]; // Explicitly labeled as suggestions (Section 10)
  source: 'grain_ai_summary' | 'transcript_analysis' | 'recording_metadata';
  status: 'teacher_review_required' | 'teacher_approved';
}

export interface GrainHomeworkSuggestion {
  title: string;
  description: string;
  assignmentKind: 'explicitly_assigned_in_lesson' | 'ai_suggested_practice';
  source: 'grain_ai_summary' | 'transcript_analysis';
  status: 'teacher_review_required' | 'teacher_approved';
}

export interface GrainStudentFollowUpSuggestion {
  studentId?: string;
  cautiousObservationAr: string; // Cautious language only: "Possible revision topic", "Suggested follow-up"
  cautiousObservationEn: string;
  cautiousObservationDe: string;
  suggestedRevisionTopic?: string;
  source: 'grain_ai_summary' | 'transcript_analysis';
  status: 'teacher_review_required' | 'teacher_approved';
}

export interface GrainEducationalDraft {
  recordingId: string;
  generatedAt: string;
  source: 'grain_ai_summary' | 'transcript_analysis' | 'recording_metadata';
  status: 'teacher_review_required' | 'teacher_approved';
  whatWasCoveredAr: string;
  whatWasCoveredEn?: string;
  whatWasCoveredDe?: string;
  mainLearningObjectives: string[];
  importantExamples: string[];
  topicsNeedingRevision: string[];
  vocabulary: GrainVocabularySuggestion[];
  grammar: GrainGrammarSuggestion[];
  homework: GrainHomeworkSuggestion[];
  studentFollowUps?: Record<string, GrainStudentFollowUpSuggestion>;
}

/**
 * Structured German Lesson Content automatically extracted from Grain (Requirement 4 & 5).
 * Contains the 7 required educational sections, source recording references, and teacher-edit tracking.
 * Never contains raw full transcripts.
 */
export interface GrainExtractedVocabularyEntry {
  german: string;
  article?: 'der' | 'die' | 'das' | '' | string;
  arabic?: string;
  meaning?: string;
  example?: string;
}

export interface GrainExtractedGrammarEntry {
  topic: string;
  explanationDe: string;
  explanation?: string;
  explanationAr?: string;
  examples?: string[];
}

export interface GrainExtractedLessonContentCore {
  themaDerStunde: string; // Thema der Stunde — lesson topic
  behandelteInhalte: string[]; // Behandelte Inhalte — what was covered
  neueWoerterUndRedemittel: GrainExtractedVocabularyEntry[]; // Neue Wörter und Redemittel — new vocabulary and expressions
  grammatik: GrainExtractedGrammarEntry[]; // Grammatik — grammar explained
  beispiele: string[]; // Beispiele — important examples used during the lesson
  uebungenUndAktivitaeten: string[]; // Übungen und Aktivitäten — exercises and activities completed
  offenePunkte: string[]; // Offene Punkte — topics that may need further explanation
  formattedLessonSummaryDe: string;
  formattedSummaryDe?: string;
  formattedSummaryAr?: string;
}

export interface GrainExtractedPendingUpdate extends GrainExtractedLessonContentCore {
  sourceRecordingIds: string[];
  sourceContentFingerprint: string;
  extractedAt: string;
}

export interface GrainExtractedLessonContent extends GrainExtractedLessonContentCore {
  sourceRecordingIds: string[];
  part1RecordingId?: string;
  part2RecordingId?: string;
  partCount: 1 | 2;
  sourceContentFingerprint: string;
  extractedAt: string;
  origin: 'grain_transcript_and_notes' | 'deterministic_transcript' | 'ai_extracted' | 'teacher_edited' | 'teacher_written';
  sourceKinds?: Array<'transcript' | 'ai_notes'>;
  transcriptStatus:
    | 'complete'
    | 'partial_transcript'
    | 'transcript_unavailable'
    | 'extracted'
    | 'partial_part1_only'
    | 'partial_part2_only';
  teacherEdited?: boolean;
  teacherEditedAt?: string;
  pendingUpdatedExtraction?: GrainExtractedPendingUpdate;
}

/**
 * Compact Grain metadata stored on a confirmed Lesson (`lesson.grainMeta`).
 * Strictly excludes API tokens, raw transcripts, and unreviewed private AI data.
 */
export interface GrainLessonMetadata {
  recordingId: string;
  recordingIdPart2?: string;
  recordingTitle: string;
  recordingTitlePart2?: string;
  startTimestamp: string;
  startTimestampPart2?: string;
  endTimestamp?: string;
  endTimestampPart2?: string;
  durationMinutes: number;
  durationMinutesPart2?: number;
  recordingUrl: string;
  recordingUrlPart2?: string;
  shareAccessClassification?: GrainShareAccessClassification;
  shareAccessClassificationPart2?: GrainShareAccessClassification;
  groupId?: string;
  source: string;
  matchingStatus: 'confirmed';
  matchedAutomatically?: boolean;
  learnedRecurringRuleId?: string;
  part2StartGapMinutes?: number;
  confirmedLessonId: string;
  lastSyncedAt: string;
  workflowStatuses?: GrainWorkflowStatusBadge[];
  extractedLessonContent?: GrainExtractedLessonContent;
  approvedSummary?: string;
  approvedSummaryEn?: string;
  approvedSummaryDe?: string;
  approvedTopics?: string[];
  approvedVocabulary?: Array<{ german: string; article?: string; arabic: string; example?: string }>;
  approvedGrammarTopics?: string[];
  approvedHomeworkSuggestion?: string;
  approvedParentReportSummaryAr?: string;
  approvedParentReportSummaryEn?: string;
  approvedParentReportSummaryDe?: string;
  supplementaryParticipantsObserved?: string[]; // Informational only — never alters attendance (Rule 2)
}

// ==========================================
// GLÜCK × ZOOM × GRAIN MULTI-SESSION & CALENDAR TYPES
// ==========================================

export type ZoomMeetingSource = 'zoom_api' | 'manual' | 'legacy_migrated';
export type ZoomSessionSyncState = 'pending' | 'synced' | 'needs_update' | 'error' | 'manual_only' | 'manual';
export type ZoomMeetingStatus = 'active' | 'outdated' | 'replaced' | 'superseded' | 'deleted';
export type ZoomHistoryAction =
  | 'created'
  | 'created_by_zoom'
  | 'migrated_replace'
  | 'replaced_by_migration'
  | 'manual_override'
  | 'schedule_changed'
  | 'group_renamed'
  | 'regenerated'
  | 'unlinked';

export type GrainMatchTier =
  | 'zoom_meeting_id'
  | 'standardized_topic'
  | 'date_and_session'
  | 'calendar_uid'
  | 'metadata_heuristic';

export type GrainConfidenceLevel = 'high' | 'medium' | 'low';

export interface GroupWeeklySession extends SyncableRecord {
  groupId: string;
  groupNameSnapshot?: string;
  weekday: number; // 0 = Sunday .. 6 = Saturday
  weekdayName: string; // English: Sunday .. Saturday
  startTime: string; // 24h HH:mm
  durationMinutes: number;
  timezone: string; // Default 'Africa/Cairo'
  recurrence: ScheduleRecurrence; // 'weekly' | 'biweekly_a' | 'biweekly_b'
  sessionCode: string; // Stable readable code, e.g. 'GR8A1-MON-1900'
  standardizedTitle: string; // '{Weekday} - {HH:mm} - {GroupName}'
  zoomMeetingRecordId?: string;
  zoomMeetingId?: string; // Canonical numeric Zoom Meeting ID
  zoomJoinUrl?: string;
  zoomPasscode?: string;
  zoomHostEmail?: string;
  manualFallbackUrl?: string;
  meetingSource: ZoomMeetingSource;
  syncState: ZoomSessionSyncState;
  lastError?: string;
  lastSyncError?: string;
  lastSyncedAt?: string;
  calendarEventUid: string; // Immutable stable UID: e.g. 'gluck-session-{id}@glueck.app'
  googleCalendarEventId?: string;
  googleCalendarIcalUid?: string; // Actual iCalUID returned by Google Calendar API (independent of calendarEventUid)
  googleCalendarSyncedAt?: string;
  lastCalendarSyncedAt?: string;
  calendarSyncStatus?: 'not_synced' | 'synced' | 'needs_update' | 'error';
  calendarSyncError?: string;
  planWarning40Min?: boolean;
}

export interface ZoomMeetingRecord extends SyncableRecord {
  sessionId: string;
  groupId: string;
  zoomMeetingId: string; // Canonical numeric ID
  joinUrl: string;
  meetingPasscode?: string;
  topic: string;
  startTime: string; // HH:mm
  durationMinutes: number;
  timezone: string;
  meetingType: 8; // Zoom Recurring Fixed Time
  recurrenceWeeklyDay: number; // Zoom weekly_days: 1=Sun .. 7=Sat
  recurrenceRepeatInterval: 1 | 2;
  hostEmail?: string;
  status: ZoomMeetingStatus;
  supersededByMeetingId?: string;
  planWarning40Min?: boolean;
  syncedAt: string;
}

export interface ZoomMeetingHistory extends SyncableRecord {
  sessionId: string;
  groupId: string;
  action: ZoomHistoryAction;
  previousZoomMeetingId?: string;
  previousJoinUrl?: string;
  newZoomMeetingId?: string;
  newJoinUrl?: string;
  previousTopic?: string;
  newTopic?: string;
  reason?: string;
  recordedAt: string;
}

export interface GrainRecordingMatch extends SyncableRecord {
  recordingId?: string;
  grainRecordingId?: string;
  grainRecordingTitle?: string;
  grainRecordingUrl?: string;
  zoomMeetingId?: string;
  sessionId?: string;
  sessionCode?: string;
  lessonId?: string;
  matchedLessonId?: string;
  groupId?: string;
  matchedGroupId?: string;
  matchTier: GrainMatchTier;
  confidenceLevel: GrainConfidenceLevel;
  confidenceScore: number;
  matchedZoomMeetingId?: string;
  matchedTopic?: string;
  status: 'auto_assigned' | 'auto_matched' | 'suggested' | 'confirmed' | 'rejected';
  reasons: string[];
  matchedAt?: string;
  evaluatedAt?: string;
}




