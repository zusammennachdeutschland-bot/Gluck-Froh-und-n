import { TeacherProfile, Group, Student, Lesson, PaymentRecord, NotificationItem, GradeLevel, InspirationSettings, InspirationMessage, NotificationSettings } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  masterEnabled: true,
  lessonReminder: { enabled: true, sound: 'beep', priority: 'high' },
  lessonStart: { enabled: true, sound: 'default', priority: 'max' },
  paymentDue: { enabled: true, sound: 'default', priority: 'normal' },
  dailySummary: { enabled: true, sound: 'gentle', priority: 'normal' },
  attendanceReminder: { enabled: true, sound: 'chime', priority: 'normal' },

  lessonReminderMinutesBefore: 15,

  dailySummaryTime: '20:00',
  dailySummaryIncludeLessons: true,
  dailySummaryIncludeIncome: true,
  dailySummaryIncludePendingPayments: true,
};

export const PREDEFINED_GRADES: GradeLevel[] = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
  'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

export const INITIAL_INSPIRATION_SETTINGS: InspirationSettings = {
  frequency: 'daily',
  displayMethod: 'both',
  source: 'all',
  lastShownDate: undefined,
  lastShownMessageId: undefined
};

export const INITIAL_INSPIRATION_MESSAGES: InspirationMessage[] = [
  { id: 'insp_1', text: 'الحمد لله على نعمة العلم والرزق.', isFavorite: false, isCustom: false },
  { id: 'insp_2', text: 'اللهم بارك في وقتي وعلمي ورزقي.', isFavorite: false, isCustom: false },
  { id: 'insp_3', text: 'اللهم اجعل هذا العمل نافعًا ومباركًا.', isFavorite: false, isCustom: false },
  { id: 'insp_4', text: 'الحمد لله الذي يسر لي تعليم الطلاب.', isFavorite: false, isCustom: false },
  { id: 'insp_5', text: 'اللهم ارزقني الإخلاص والتوفيق.', isFavorite: false, isCustom: false },
  { id: 'insp_6', text: 'رب زدني علمًا.', isFavorite: false, isCustom: false },
  { id: 'insp_7', text: 'اللهم إني أسألك علمًا نافعًا ورزقًا طيبًا وعملًا متقبلًا.', isFavorite: false, isCustom: false },
  { id: 'insp_8', text: 'الحمد لله على فرصة تعليم الآخرين.', isFavorite: false, isCustom: false },
  { id: 'insp_9', text: 'اللهم بارك في هذا اليوم واجعل فيه الخير.', isFavorite: false, isCustom: false },
  { id: 'insp_10', text: 'اللهم اجعلني سببًا في نفع طلابي.', isFavorite: false, isCustom: false },
  { id: 'insp_11', text: 'الحمد لله على كل طالب أتعلم معه وأعلمه.', isFavorite: false, isCustom: false },
  { id: 'insp_12', text: 'اللهم افتح لي أبواب الخير والبركة.', isFavorite: false, isCustom: false },
  { id: 'insp_13', text: 'اللهم وفقني لأداء رسالتي على أفضل وجه.', isFavorite: false, isCustom: false },
  { id: 'insp_14', text: 'الحمد لله على النعمة قبل الدرس وبعده.', isFavorite: false, isCustom: false },
  { id: 'insp_15', text: 'اللهم بارك في الجهد والوقت والنتائج.', isFavorite: false, isCustom: false },
  { id: 'insp_16', text: 'كل حصة فرصة جديدة للتأثير الإيجابي.', isFavorite: false, isCustom: false },
  { id: 'insp_17', text: 'تذكر أن تعليم شخص واحد قد يغير مستقبله.', isFavorite: false, isCustom: false },
  { id: 'insp_18', text: 'العلم من أعظم أبواب الخير.', isFavorite: false, isCustom: false },
  { id: 'insp_19', text: 'ما عند الله خير وأبقى.', isFavorite: false, isCustom: false },
  { id: 'insp_20', text: 'اللهم أعني على شكرك وحسن عبادتك.', isFavorite: false, isCustom: false },
  { id: 'insp_21', text: 'الحمد لله الذي بنعمته تتم الصالحات.', isFavorite: false, isCustom: false },
  { id: 'insp_22', text: 'لا تنس شكر الله على ما لديك اليوم.', isFavorite: false, isCustom: false },
  { id: 'insp_23', text: 'ربما كانت هذه الحصة سببًا في نجاح طالب.', isFavorite: false, isCustom: false },
  { id: 'insp_24', text: 'اجعل نيتك نفع الناس وابتغاء الخير.', isFavorite: false, isCustom: false },
  { id: 'insp_25', text: 'اللهم اجعل في هذا الرزق بركة ونفعًا.', isFavorite: false, isCustom: false }
];

export const INITIAL_TEACHER_PROFILE: TeacherProfile = {
  id: 't1',
  displayName: 'Teacher',
  email: '',
  avatarUrl: '',
  currency: 'EGP',
  language: 'de',
  phone: '',
  instaPayId: '',
  vodafoneCashNumber: '',
  bankAccount: '',
  paymentLink: '',
  whatsappNumber: '',
  isGoogleConnected: false,
  lastSyncedAt: '',

  weeklyWorkingHours: {
    0: { isOff: true, startTime: '09:00', endTime: '21:00' },
    1: { isOff: false, startTime: '09:00', endTime: '21:00' },
    2: { isOff: false, startTime: '09:00', endTime: '21:00' },
    3: { isOff: false, startTime: '09:00', endTime: '21:00' },
    4: { isOff: false, startTime: '09:00', endTime: '21:00' },
    5: { isOff: false, startTime: '09:00', endTime: '21:00' },
    6: { isOff: false, startTime: '09:00', endTime: '21:00' },
  },
  workingHours: {
    workingDays: [1, 2, 3, 4, 5, 6], // Mon - Sat
    startTime: '09:00',
    endTime: '21:00'
  },
  defaultZoomLink: '',
  defaultMeetLink: '',
  enableLessonAlerts: true,
  enableBrowserPush: false
};

export const INITIAL_GROUPS: Group[] = [];

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_LESSONS: Lesson[] = [];

export const INITIAL_PAYMENT_RECORDS: PaymentRecord[] = [];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
