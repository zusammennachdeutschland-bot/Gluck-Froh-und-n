import { TeacherProfile, Group, Student, Lesson, PaymentRecord, NotificationItem, GradeLevel, InspirationSettings, InspirationMessage, NotificationSettings } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  masterEnabled: true,
  lessonReminder: { enabled: true, sound: 'beep', priority: 'high' },
  lessonStart: { enabled: true, sound: 'default', priority: 'max' },
  paymentDue: { enabled: true, sound: 'default', priority: 'normal' },
  dailySummary: { enabled: true, sound: 'gentle', priority: 'normal' },
  attendanceReminder: { enabled: true, sound: 'chime', priority: 'normal' },
  schoolLessonReminder: { enabled: true, sound: 'beep', priority: 'high' },

  lessonReminderMinutesBefore: 15,

  dailySummaryTime: '20:00',
  dailySummaryIncludeLessons: true,
  dailySummaryIncludeIncome: true,
  dailySummaryIncludePendingPayments: true,
};

export const COURSE_LEVELS: GradeLevel[] = [
  'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
];

export const SCHOOL_GRADES: GradeLevel[] = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
  'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

export const PREDEFINED_GRADES: GradeLevel[] = [
  ...COURSE_LEVELS,
  ...SCHOOL_GRADES
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
  displayName: 'أ. أحمد محمود',
  displayNameAr: 'أ. أحمد محمود',
  displayNameEn: 'Mr. Ahmed Mahmoud',
  email: 'ahmed.mahmoud.teacher@gmail.com',
  avatarUrl: '',
  currency: 'EGP',
  language: 'ar',
  phone: '01012345678',
  instaPayId: 'ahmed.mahmoud@instapay',
  vodafoneCashNumber: '01012345678',
  bankAccount: 'EG1200020001000001234567890',
  paymentLink: 'https://instapay.eg/pay/ahmed.mahmoud',
  whatsappNumber: '01012345678',
  isGoogleConnected: false,
  lastSyncedAt: new Date().toISOString(),

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
  defaultZoomLink: 'https://zoom.us/j/9876543210',
  defaultMeetLink: 'https://meet.google.com/abc-defg-hij',
  enableLessonAlerts: true,
  enableBrowserPush: false,
  schoolSettings: {
    presence: {
      '0': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '1': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '2': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '3': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '4': { active: true, arrivalTime: '07:30', departureTime: '14:30' },
      '5': { active: false, arrivalTime: '07:30', departureTime: '14:30' },
      '6': { active: false, arrivalTime: '07:30', departureTime: '14:30' }
    },
    periodSettings: {
      periodsCount: 7,
      firstPeriodStart: '08:00',
      defaultDuration: 45,
      customDurations: {}
    },
    schedule: {
      '0': [{ periodNumber: 1, className: 'الصف العاشر / 1', subjectName: 'لغة ألمانية A1' }, { periodNumber: 3, className: 'الصف الحادي عشر / 2', subjectName: 'لغة ألمانية A2' }],
      '1': [{ periodNumber: 2, className: 'الصف الثاني عشر / 3', subjectName: 'ألماني ثانوية عامة' }, { periodNumber: 4, className: 'الصف العاشر / 2', subjectName: 'لغة ألمانية A1' }],
      '2': [{ periodNumber: 1, className: 'الصف العاشر / 1', subjectName: 'لغة ألمانية A1' }, { periodNumber: 5, className: 'الصف الحادي عشر / 1', subjectName: 'لغة ألمانية A2' }],
      '3': [{ periodNumber: 2, className: 'الصف الثاني عشر / 3', subjectName: 'ألماني ثانوية عامة' }],
      '4': [{ periodNumber: 3, className: 'الصف العاشر / 2', subjectName: 'لغة ألمانية A1' }],
      '5': [],
      '6': []
    }
  }
};

export const INITIAL_GROUPS: Group[] = [
  {
    id: 'g1',
    name: 'مجموعة ألمانية A1 - مدرسة الأمل',
    grade: 'Grade 10',
    scheduleDays: ['Saturday', 'Tuesday'],
    scheduleTime: '16:00',
    type: 'offline',
    monthlyPackagePrice: 1500,
    pricePerSession: 120,
    sessionCount: 8,
    color: '#3B82F6',
    address: 'سنتر الأمل - قاعة 2'
  },
  {
    id: 'g2',
    name: 'مجموعة ألمانية B1 مكثف - سنتر المتفوقين',
    grade: 'B1',
    scheduleDays: ['Sunday', 'Wednesday'],
    scheduleTime: '18:00',
    type: 'offline',
    monthlyPackagePrice: 1800,
    pricePerSession: 150,
    sessionCount: 8,
    color: '#10B981',
    address: 'سنتر المتفوقين - قاعة VIP'
  },
  {
    id: 'g3',
    name: 'مجموعة ثانوية عامة - الصف الثالث الثانوي',
    grade: 'Grade 12',
    scheduleDays: ['Monday', 'Thursday'],
    scheduleTime: '17:00',
    type: 'offline',
    monthlyPackagePrice: 2200,
    pricePerSession: 200,
    sessionCount: 8,
    color: '#8B5CF6',
    address: 'سنتر النخبة التعليمي'
  },
  {
    id: 'g4',
    name: 'مجموعة ألمانية A2 - سنتر التميز',
    grade: 'Grade 11',
    scheduleDays: ['Sunday', 'Tuesday'],
    scheduleTime: '15:00',
    type: 'offline',
    monthlyPackagePrice: 1600,
    pricePerSession: 130,
    sessionCount: 8,
    color: '#F59E0B',
    address: 'سنتر التميز - قاعة 1'
  },
  {
    id: 'g5',
    name: 'مجموعة B2 Medizin (إعداد أطباء وممرضين)',
    grade: 'B2',
    scheduleDays: ['Sunday', 'Wednesday'],
    scheduleTime: '20:00',
    type: 'online',
    monthlyPackagePrice: 2800,
    pricePerSession: 250,
    sessionCount: 8,
    color: '#EC4899',
    zoomLink: 'https://zoom.us/j/9988776655'
  },
  {
    id: 'g6',
    name: 'مجموعة كورس المراجعة الشاملة Grammatik',
    grade: 'A2',
    scheduleDays: ['Friday'],
    scheduleTime: '10:00',
    type: 'online',
    monthlyPackagePrice: 800,
    pricePerSession: 200,
    sessionCount: 4,
    color: '#06B6D4',
    meetLink: 'https://meet.google.com/abc-defg-hij'
  }
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'st1',
    name: 'أحمد علي السيد',
    groupId: 'g1',
    grade: 'Grade 10',
    studentPhone: '01001112223',
    phone: '01001112223',
    parentPhone: '01009998887',
    parentName: 'علي السيد (ولي الأمر)',
    notes: 'طالب مجتهد، يحضر في الموعد بانتظام.',
    joinedDate: '2026-01-15',
    documents: [],
    paymentStatus: 'pending'
  },
  {
    id: 'st2',
    name: 'سارة يوسف الشافعي',
    groupId: 'g1',
    grade: 'Grade 10',
    studentPhone: '01112223334',
    phone: '01112223334',
    parentPhone: '01118887776',
    parentName: 'د. يوسف الشافعي',
    notes: 'الأولى على المجموعة في اختبار القواعد.',
    joinedDate: '2026-01-15',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st3',
    name: 'عمر خالد نور الدين',
    groupId: 'g2',
    grade: 'B1',
    studentPhone: '01223334445',
    phone: '01223334445',
    parentPhone: '01227776665',
    parentName: 'مهندس خالد نور الدين',
    notes: 'ممتاز في التحدث باللغة الألمانية.',
    joinedDate: '2026-02-01',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st4',
    name: 'مريم حسن إبراهيم',
    groupId: 'g2',
    grade: 'B1',
    studentPhone: '01554443332',
    phone: '01554443332',
    parentPhone: '01556667778',
    parentName: 'حسن إبراهيم',
    notes: 'تشارك بفاعلية في ورش المحادثة.',
    joinedDate: '2026-02-01',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st5',
    name: 'كريم زياد مصطفى',
    groupId: 'g3',
    grade: 'Grade 12',
    studentPhone: '01005556667',
    phone: '01005556667',
    parentPhone: '01004443332',
    parentName: 'زياد مصطفى',
    notes: 'حصل على الدرجة النهائية في اختبار النصف الأول.',
    joinedDate: '2025-09-01',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st6',
    name: 'فاطمة محمود عبد العزيز',
    groupId: 'g3',
    grade: 'Grade 12',
    studentPhone: '01116667778',
    phone: '01116667778',
    parentPhone: '01115554443',
    parentName: 'محمود عبد العزيز',
    notes: 'تحتاج متابعة بسيطة في موضوعات الإنشاء Expression.',
    joinedDate: '2025-09-01',
    documents: [],
    paymentStatus: 'pending'
  },
  {
    id: 'st7',
    name: 'ياسين حازم الشريف',
    groupId: 'g1',
    grade: 'Grade 10',
    studentPhone: '01228889990',
    phone: '01228889990',
    parentPhone: '01223332211',
    parentName: 'حازم الشريف',
    notes: 'مستوى متصاعد بشكل ملحوظ.',
    joinedDate: '2026-01-20',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st8',
    name: 'نور الدين سامح',
    groupId: 'g3',
    grade: 'Grade 12',
    studentPhone: '01009990011',
    phone: '01009990011',
    parentPhone: '01008887766',
    parentName: 'سامح فؤاد',
    notes: 'طالب هادئ وملتزم بأداء جميع الواجبات.',
    joinedDate: '2025-09-01',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st9',
    name: 'حازم محمد عبد الرحمن',
    groupId: 'g4',
    grade: 'Grade 11',
    studentPhone: '01011223344',
    phone: '01011223344',
    parentPhone: '01099887766',
    parentName: 'محمد عبد الرحمن',
    notes: 'ممتاز في فهم الجمل الموصولة.',
    joinedDate: '2026-01-10',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st10',
    name: 'سلمى طارق العفيفي',
    groupId: 'g4',
    grade: 'Grade 11',
    studentPhone: '01122334455',
    phone: '01122334455',
    parentPhone: '01188776655',
    parentName: 'طارق العفيفي',
    notes: 'طالبة متفوقة في اختبارات الاستماع.',
    joinedDate: '2026-01-10',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st11',
    name: 'د. طارق مصطفى سالم',
    groupId: 'g5',
    grade: 'B2',
    studentPhone: '01233445566',
    phone: '01233445566',
    parentPhone: '01233445566',
    parentName: 'طبيب بشري',
    notes: 'مستوى متتقدم جداً في كتابة التقارير الطبية Anamnese.',
    joinedDate: '2026-03-01',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st12',
    name: 'د. رانيا محمود زكي',
    groupId: 'g5',
    grade: 'B2',
    studentPhone: '01044556677',
    phone: '01044556677',
    parentPhone: '01044556677',
    parentName: 'طبيبة أسنان',
    notes: 'تشارك بطلاقة في محاكاة المقابلات الطبية مع المريض.',
    joinedDate: '2026-03-01',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st13',
    name: 'عبد الله عصام الدين',
    groupId: 'g6',
    grade: 'A2',
    studentPhone: '01155667788',
    phone: '01155667788',
    parentPhone: '01144332211',
    parentName: 'عصام الدين فؤاد',
    notes: 'حضر ورشة القواعد التفاعلية بنجاح.',
    joinedDate: '2026-04-01',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st14',
    name: 'هنا إبراهيم فؤاد',
    groupId: 'g1',
    grade: 'Grade 10',
    studentPhone: '01266778899',
    phone: '01266778899',
    parentPhone: '01255443322',
    parentName: 'إبراهيم فؤاد',
    notes: 'تشارك بفاعلية ممتازة في المجموعة.',
    joinedDate: '2026-01-25',
    documents: [],
    paymentStatus: 'paid'
  },
  {
    id: 'st15',
    name: 'يوسف أحمد رضوان',
    groupId: 'g2',
    grade: 'B1',
    studentPhone: '01077889900',
    phone: '01077889900',
    parentPhone: '01066554433',
    parentName: 'أحمد رضوان',
    notes: 'يحتاج تركيز في كتابة الموضوعات طويلة.',
    joinedDate: '2026-02-10',
    documents: [],
    paymentStatus: 'pending'
  },
  {
    id: 'st16',
    name: 'لجين شريف القاضي',
    groupId: 'g3',
    grade: 'Grade 12',
    studentPhone: '01188990011',
    phone: '01188990011',
    parentPhone: '01177665544',
    parentName: 'شريف القاضي',
    notes: 'حصلت على تقدير ممتاز في اختبار القراءة والقطع.',
    joinedDate: '2025-09-01',
    documents: [],
    paymentStatus: 'paid'
  }
];

export const INITIAL_LESSONS: Lesson[] = [
  {
    id: 'les_1',
    groupId: 'g3',
    groupName: 'مجموعة ثانوية عامة - الصف الثالث الثانوي',
    title: 'Grammatik: Passiv & Konjunktiv II - الشرح والتطبيقات',
    date: '2026-08-27',
    time: '17:00',
    durationMinutes: 90,
    type: 'offline',
    grade: 'Grade 12',
    sessionNumber: 5,
    totalSessionsInPackage: 8,
    status: 'scheduled',
    paymentStatus: 'paid',
    amountDue: 200,
    amountPaid: 200,
    notes: 'حصة هامة جداً مراجعة للثانوية العامة'
  },
  {
    id: 'les_2',
    groupId: 'g2',
    groupName: 'مجموعة ألمانية B1 مكثف - سنتر المتفوقين',
    title: 'Sprechen B1: Mündlicher Ausdruck & Redemittel',
    date: '2026-08-26',
    time: '18:00',
    durationMinutes: 120,
    type: 'offline',
    grade: 'B1',
    sessionNumber: 4,
    totalSessionsInPackage: 8,
    status: 'completed',
    paymentStatus: 'paid',
    amountDue: 150,
    amountPaid: 150,
    notes: 'تم أداء التدريب الشفهي لجميع الطلاب بنجاح'
  },
  {
    id: 'les_3',
    groupId: 'g1',
    groupName: 'مجموعة ألمانية A1 - مدرسة الأمل',
    title: 'Lektion 3: Essen und Trinken & Akkusativ',
    date: '2026-08-25',
    time: '16:00',
    durationMinutes: 90,
    type: 'offline',
    grade: 'Grade 10',
    sessionNumber: 3,
    totalSessionsInPackage: 8,
    status: 'completed',
    paymentStatus: 'paid',
    amountDue: 120,
    amountPaid: 120,
    notes: 'شرح أدوات المعرفة والنكرة في حالة النصب Akkusativ'
  },
  {
    id: 'les_4',
    groupId: 'g1',
    groupName: 'مجموعة ألمانية A1 - مدرسة الأمل',
    title: 'Lektion 4: Mein Tag & Uhrzeiten',
    date: '2026-08-29',
    time: '16:00',
    durationMinutes: 90,
    type: 'offline',
    grade: 'Grade 10',
    sessionNumber: 4,
    totalSessionsInPackage: 8,
    status: 'scheduled',
    paymentStatus: 'pending',
    amountDue: 120,
    amountPaid: 0,
    notes: 'الحصة القادمة يوم السبت'
  },
  {
    id: 'les_5',
    groupId: 'g4',
    groupName: 'مجموعة ألمانية A2 - سنتر التميز',
    title: 'Lektion 8: Nebensätze mit weil & dass',
    date: '2026-08-24',
    time: '15:00',
    durationMinutes: 90,
    type: 'offline',
    grade: 'Grade 11',
    sessionNumber: 6,
    totalSessionsInPackage: 8,
    status: 'completed',
    paymentStatus: 'paid',
    amountDue: 130,
    amountPaid: 130,
    notes: 'تمت المراجعة والتطبيقات بنجاح'
  },
  {
    id: 'les_6',
    groupId: 'g5',
    groupName: 'مجموعة B2 Medizin (إعداد أطباء وممرضين)',
    title: 'B2 Medizin: Anamnesegespräch & Patientenbrief',
    date: '2026-08-23',
    time: '20:00',
    durationMinutes: 120,
    type: 'online',
    grade: 'B2',
    sessionNumber: 7,
    totalSessionsInPackage: 8,
    status: 'completed',
    paymentStatus: 'paid',
    amountDue: 250,
    amountPaid: 250,
    notes: 'تفوق ورقي وشفهي من الأطباء المشاركين'
  },
  {
    id: 'les_7',
    groupId: 'g6',
    groupName: 'مجموعة كورس المراجعة الشاملة Grammatik',
    title: 'Grammatik Refresher: Relativsätze im Dativ und Genitiv',
    date: '2026-08-28',
    time: '10:00',
    durationMinutes: 120,
    type: 'online',
    grade: 'A2',
    sessionNumber: 2,
    totalSessionsInPackage: 4,
    status: 'scheduled',
    paymentStatus: 'paid',
    amountDue: 200,
    amountPaid: 200,
    notes: 'ورشة الجمعة أونلاين عبر غوغل ميت'
  }
];

export const INITIAL_PAYMENT_RECORDS: PaymentRecord[] = [
  {
    id: 'pay_1',
    studentId: 'st2',
    studentName: 'سارة يوسف الشافعي',
    groupId: 'g1',
    groupName: 'مجموعة ألمانية A1 - مدرسة الأمل',
    amountPaid: 1500,
    amountDue: 1500,
    dueDate: '2026-08-05',
    paidDate: '2026-08-05',
    status: 'paid',
    paymentMethod: 'bank_transfer',
    notes: 'سداد الاشتراك الشهري عبر تحويل بنكي'
  },
  {
    id: 'pay_2',
    studentId: 'st5',
    studentName: 'كريم زياد مصطفى',
    groupId: 'g3',
    groupName: 'مجموعة ثانوية عامة - الصف الثالث الثانوي',
    amountPaid: 2200,
    amountDue: 2200,
    dueDate: '2026-08-02',
    paidDate: '2026-08-02',
    status: 'paid',
    paymentMethod: 'vodafone_cash',
    notes: 'تم السداد عبر فودافون كاش'
  },
  {
    id: 'pay_3',
    studentId: 'st3',
    studentName: 'عمر خالد نور الدين',
    groupId: 'g2',
    groupName: 'مجموعة ألمانية B1 مكثف - سنتر المتفوقين',
    amountPaid: 1800,
    amountDue: 1800,
    dueDate: '2026-08-10',
    paidDate: '2026-08-10',
    status: 'paid',
    paymentMethod: 'cash',
    notes: 'سداد نقدي بالسنتر'
  },
  {
    id: 'pay_4',
    studentId: 'st1',
    studentName: 'أحمد علي السيد',
    groupId: 'g1',
    groupName: 'مجموعة ألمانية A1 - مدرسة الأمل',
    amountPaid: 0,
    amountDue: 1500,
    dueDate: '2026-08-01',
    status: 'pending',
    paymentMethod: 'cash',
    notes: 'اشتراك شهر أغسطس - مستحق ولم يسدد بعد'
  },
  {
    id: 'pay_5',
    studentId: 'st6',
    studentName: 'فاطمة محمود عبد العزيز',
    groupId: 'g3',
    groupName: 'مجموعة ثانوية عامة - الصف الثالث الثانوي',
    amountPaid: 0,
    amountDue: 2200,
    dueDate: '2026-08-15',
    status: 'pending',
    paymentMethod: 'instapay',
    notes: 'في انتظار تأكيد تحويل انستا باي'
  },
  {
    id: 'pay_6',
    studentId: 'st9',
    studentName: 'حازم محمد عبد الرحمن',
    groupId: 'g4',
    groupName: 'مجموعة ألمانية A2 - سنتر التميز',
    amountPaid: 1600,
    amountDue: 1600,
    dueDate: '2026-08-04',
    paidDate: '2026-08-04',
    status: 'paid',
    paymentMethod: 'instapay',
    notes: 'تم التحويل بنجاح عبر تطبيق انستا باي'
  },
  {
    id: 'pay_7',
    studentId: 'st11',
    studentName: 'د. طارق مصطفى سالم',
    groupId: 'g5',
    groupName: 'مجموعة B2 Medizin (إعداد أطباء وممرضين)',
    amountPaid: 2800,
    amountDue: 2800,
    dueDate: '2026-08-01',
    paidDate: '2026-08-01',
    status: 'paid',
    paymentMethod: 'bank_transfer',
    notes: 'تحويل بنكي - حساب CIB'
  },
  {
    id: 'pay_8',
    studentId: 'st10',
    studentName: 'سلمى طارق العفيفي',
    groupId: 'g4',
    groupName: 'مجموعة ألمانية A2 - سنتر التميز',
    amountPaid: 1600,
    amountDue: 1600,
    dueDate: '2026-08-06',
    paidDate: '2026-08-06',
    status: 'paid',
    paymentMethod: 'vodafone_cash',
    notes: 'سداد عبر محفظة فودافون كاش'
  },
  {
    id: 'pay_9',
    studentId: 'st12',
    studentName: 'د. رانيا محمود زكي',
    groupId: 'g5',
    groupName: 'مجموعة B2 Medizin (إعداد أطباء وممرضين)',
    amountPaid: 2800,
    amountDue: 2800,
    dueDate: '2026-08-03',
    paidDate: '2026-08-03',
    status: 'paid',
    paymentMethod: 'bank_transfer',
    notes: 'سداد كامل اشتراك B2 Medizin'
  },
  {
    id: 'pay_10',
    studentId: 'st8',
    studentName: 'نور الدين سامح',
    groupId: 'g3',
    groupName: 'مجموعة ثانوية عامة - الصف الثالث الثانوي',
    amountPaid: 2200,
    amountDue: 2200,
    dueDate: '2026-08-08',
    paidDate: '2026-08-08',
    status: 'paid',
    paymentMethod: 'cash',
    notes: 'سداد نقدي في سنتر النخبة'
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'not_1',
    title: 'تذكير بموعد الحصة القادمة',
    message: 'حصة مجموعة الثانوية العامة تبدأ اليوم الساعة 05:00 مساءً بسنتر النخبة.',
    time: '2026-08-27T14:30:00.000Z',
    type: 'reminder',
    read: false
  },
  {
    id: 'not_2',
    title: 'استلام مدفوعات جديدة',
    message: 'تم تسجيل سداد مبلغ 2,200 ج.م للطالب كريم زياد بنجاح.',
    time: '2026-08-26T18:10:00.000Z',
    type: 'system',
    read: true
  },
  {
    id: 'not_3',
    title: 'متابعة الواجبات المدرسية',
    message: 'تم استلام واجب Lektion 3 من كافة طلاب مجموعة A1 بنسبة 100%.',
    time: '2026-08-25T19:00:00.000Z',
    type: 'system',
    read: true
  },
  {
    id: 'not_4',
    title: 'زيارة رئيس القسم HOD',
    message: 'تم اعتماد تقرير التقييم الفني للحصة بنسبة 98% (ممتاز مرتفع).',
    time: '2026-08-24T12:00:00.000Z',
    type: 'system',
    read: true
  },
  {
    id: 'not_5',
    title: 'تذكير استحقاق قسط',
    message: 'تذكير: اشتراك الطالب أحمد علي السيد لشهر أغسطس مستحق السداد.',
    time: '2026-08-23T09:00:00.000Z',
    type: 'reminder',
    read: false
  }
];

export const INITIAL_TODOS = [
  {
    id: 'todo_1',
    text: 'تحضير مذكرات القواعد لمجموعة B1 وتجهيز أوراق الاختبار الأسبوعي',
    completed: false,
    dueDate: '2026-08-28',
    category: 'teaching'
  },
  {
    id: 'todo_2',
    text: 'إرسال تقارير الحضور والتقييم الأسبوعي لأولياء أمور مجموعة A1',
    completed: true,
    dueDate: '2026-08-26',
    category: 'parent'
  },
  {
    id: 'todo_3',
    text: 'مراجعة ونقد أسئلة امتحانات القراءة والاستماع لصف الثالث الثانوي',
    completed: false,
    dueDate: '2026-08-29',
    category: 'teaching'
  },
  {
    id: 'todo_4',
    text: 'التواصل مع سنتر المتفوقين لتأكيد تجهيز الشاشة التفاعلية للقاعة VIP',
    completed: false,
    dueDate: '2026-08-30',
    category: 'admin'
  },
  {
    id: 'todo_5',
    text: 'طباعة ملزمة B2 Medizin لمجموعة الأطباء والممرضين',
    completed: true,
    dueDate: '2026-08-24',
    category: 'teaching'
  },
  {
    id: 'todo_6',
    text: 'تسجيل وتدقيق درجات الشهر لطلاب مدرسة الأمل',
    completed: false,
    dueDate: '2026-08-31',
    category: 'admin'
  }
];

export const INITIAL_CERTIFICATES = [
  {
    id: 'cert_1',
    studentId: 'st2',
    studentName: 'سارة يوسف الشافعي',
    recipientName: 'Sara Youssef El-Shafey',
    groupId: 'g1',
    groupName: 'مجموعة ألمانية A1 - مدرسة الأمل',
    certificateType: 'excellence',
    language: 'de',
    template: 'elegant',
    title: 'Urkunde für hervorragende Leistungen',
    subtitle: 'Zertifikat der Exzellenz',
    description: 'Für herausragende Leistungen im Deutschkurs A1 und das Erreichen der Höchstnote.',
    issueDate: '2026-08-15',
    teacherName: 'أ. أحمد محمود',
    courseOrLevelTitle: 'Deutsch A1 Kurs',
    centerOrSchoolName: 'مدرسة الأمل - قسم اللغة الألمانية',
    score: '100%',
    createdAt: Date.now() - 864000000
  },
  {
    id: 'cert_2',
    studentId: 'st5',
    studentName: 'كريم زياد مصطفى',
    recipientName: 'Kareem Ziad Mostafa',
    groupId: 'g3',
    groupName: 'مجموعة ثانوية عامة - الصف الثالث الثانوي',
    certificateType: 'appreciation',
    language: 'ar',
    template: 'modern',
    title: 'شهادة تقدير وتفوق دراسي',
    subtitle: 'وسام التميز الأكاديمي',
    description: 'تقديراً للتفوق الملموس والالتزام بالمركز الأول في مادة اللغة الألمانية للثانوية العامة.',
    issueDate: '2026-08-20',
    teacherName: 'أ. أحمد محمود',
    courseOrLevelTitle: 'ألماني ثانوية عامة',
    centerOrSchoolName: 'سنتر النخبة التعليمي',
    score: 'ممتاز مرتفع',
    createdAt: Date.now() - 432000000
  },
  {
    id: 'cert_3',
    studentId: 'st11',
    studentName: 'د. طارق مصطفى سالم',
    recipientName: 'Dr. Tarek Mostafa Salem',
    groupId: 'g5',
    groupName: 'مجموعة B2 Medizin (إعداد أطباء وممرضين)',
    certificateType: 'excellence',
    language: 'de',
    template: 'classic',
    title: 'Zertifikat für Medizinische Fachsprache B2',
    subtitle: 'Urkunde der Auszeichnung',
    description: 'Für das hervorragende Bestehen des medizinischen Fachsprachenkurses B2 mit Auszeichnung.',
    issueDate: '2026-08-22',
    teacherName: 'أ. أحمد محمود',
    courseOrLevelTitle: 'Deutsch B2 Medizin & Pflege',
    centerOrSchoolName: 'المركز الدولي لتأهيل الأطباء',
    score: '98%',
    createdAt: Date.now() - 259200000
  }
];

export const INITIAL_SCHOOL_NOTES = [
  {
    id: 'snote_1',
    type: 'class' as const,
    text: 'حصة لغة ألمانية الصف العاشر / 1: تفاعل ممتاز مع نشاط التحدث عن الروتين اليومي.',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    tags: ['A1', 'نشاط تفاعلي'],
    pinned: true,
    className: 'الصف العاشر / 1',
    date: '2026-08-25'
  },
  {
    id: 'snote_2',
    type: 'student' as const,
    text: 'الطالبة سارة يوسف: أتمت اختبار النطق بطلاقة ممتازة.',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    tags: ['تفوق', 'نطق'],
    pinned: false,
    studentName: 'سارة يوسف الشافعي',
    date: '2026-08-26'
  },
  {
    id: 'snote_3',
    type: 'class' as const,
    text: 'الصف الثاني عشر / 3: تم الانتهاء من شرح قاعدة Passiv مع أداء جميع تمارين الكراسة.',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    tags: ['ثانوية عامة', 'قواعد'],
    pinned: true,
    className: 'الصف الثاني عشر / 3',
    date: '2026-08-27'
  }
];

export const INITIAL_HOD_STUDENTS = [
  {
    id: 'hod_st_1',
    nameAr: 'أحمد علي السيد',
    nameEn: 'Ahmed Ali El-Sayed',
    gradeClass: 'Grade 10 / 1',
    gender: 'Boy' as const,
    secondLanguage: 'German' as const,
    busLine: 'خط المعادي - القاهرة الجديدة',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  },
  {
    id: 'hod_st_2',
    nameAr: 'سارة يوسف الشافعي',
    nameEn: 'Sara Youssef El-Shafey',
    gradeClass: 'Grade 10 / 1',
    gender: 'Girl' as const,
    secondLanguage: 'German' as const,
    busLine: 'خط مدينة نصر',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  },
  {
    id: 'hod_st_3',
    nameAr: 'كريم زياد مصطفى',
    nameEn: 'Kareem Ziad Mostafa',
    gradeClass: 'Grade 12 / 3',
    gender: 'Boy' as const,
    secondLanguage: 'German' as const,
    busLine: 'خط مصر الجديدة',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  },
  {
    id: 'hod_st_4',
    nameAr: 'فاطمة محمود عبد العزيز',
    nameEn: 'Fatima Mahmoud Abdelaziz',
    gradeClass: 'Grade 12 / 3',
    gender: 'Girl' as const,
    secondLanguage: 'German' as const,
    busLine: 'خط التجمع الخامس',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  }
];

export const INITIAL_HOD_VISITS = [
  {
    id: 'visit_1',
    teacherId: 't1',
    teacherName: 'أ. أحمد محمود',
    className: 'الصف العاشر / 1',
    term: 'الفصل الدراسي الأول 2026',
    visitedDate: '2026-08-24',
    periodNumber: '1',
    lessonTopic: 'Lektion 3: Wortschatz und Grammatik',
    cm_organization: 5 as const,
    cm_control: 5 as const,
    cm_time: 5 as const,
    cm_respect: 5 as const,
    ts_objectives: 5 as const,
    ts_aids: 5 as const,
    ts_participation: 5 as const,
    ts_questions: 5 as const,
    ts_clarity: 5 as const,
    se_participation: 5 as const,
    se_interaction: 5 as const,
    se_rules: 5 as const,
    bc_regularity: 5 as const,
    bc_quality: 5 as const,
    bc_compliance: 5 as const,
    overallScore: 98,
    overallCategory: 'ممتاز مرتفع (Exzellent)',
    consolidatedNotes: 'أداء تعليمي نموذجي، إدارة ممتازة لوقت الحصة وتفاعل ممتاز من الطلاب.',
    updatedAt: Date.now()
  },
  {
    id: 'visit_2',
    teacherId: 't1',
    teacherName: 'أ. أحمد محمود',
    className: 'الصف الثاني عشر / 3',
    term: 'الفصل الدراسي الأول 2026',
    visitedDate: '2026-08-21',
    periodNumber: '2',
    lessonTopic: 'Grammatik: Passiv & Konjunktiv II',
    cm_organization: 5 as const,
    cm_control: 5 as const,
    cm_time: 5 as const,
    cm_respect: 5 as const,
    ts_objectives: 5 as const,
    ts_aids: 5 as const,
    ts_participation: 5 as const,
    ts_questions: 5 as const,
    ts_clarity: 5 as const,
    se_participation: 5 as const,
    se_interaction: 5 as const,
    se_rules: 5 as const,
    bc_regularity: 5 as const,
    bc_quality: 5 as const,
    bc_compliance: 5 as const,
    overallScore: 96,
    overallCategory: 'ممتاز مرتفع (Exzellent)',
    consolidatedNotes: 'استخدام رائع للوسائل التفاعلية وعرض الشاشة مع تمارين موجهة.',
    updatedAt: Date.now()
  }
];

export const INITIAL_HOD_ACTION_PLANS = [
  {
    id: 'plan_1',
    studentId: 'st1',
    studentNameAr: 'أحمد علي السيد',
    studentNameEn: 'Ahmed Ali El-Sayed',
    gradeClass: 'Grade 10 / 1',
    teacherId: 't1',
    teacherName: 'أ. أحمد محمود',
    weaknessAreas: ['حفظ المفردات الجديدة', 'التركيز في الاستماع'],
    actionSteps: ['إعداد بطاقات استذكار Flashcards', 'جلسات استماع إضافية لمدة 10 دقائق'],
    startDate: '2026-08-20',
    term: 'الفصل الدراسي الأول',
    status: 'ACTIVE' as const,
    weeklyLogs: [
      { weekNumber: 1, logDate: '2026-08-25', progress: 'تحسن تدريجي بسيط' as const, notes: 'التزم الطالب ببطاقات الحفظ وأبدى استجابة جيدة.' }
    ],
    updatedAt: Date.now()
  }
];

export const INITIAL_HOD_COMPLAINTS = [
  {
    id: 'cmp_1',
    direction: 'TEACHER_TO_STUDENT' as const,
    teacherId: 't1',
    teacherName: 'أ. أحمد محمود',
    studentId: 'st1',
    studentNameAr: 'أحمد علي السيد',
    studentNameEn: 'Ahmed Ali El-Sayed',
    gradeClass: 'Grade 10 / 1',
    reason: 'التأخر في تسليم واجب Lektion 2 وعدم الانتباه أثناء تمارين النطق.',
    actionTaken: 'تمت المقابلة الفردية وتحديد جدول أسبوعي مع ولي الأمر لتنظيم التمارين.',
    notes: 'استجابة إيجابية من الطالب بعد التوجيه.',
    timestamp: '2026-08-22T10:00:00.000Z',
    term: 'الفصل الدراسي الأول',
    month: 'أغسطس',
    weeklyReportSent: true,
    weeklyReportDate: '2026-08-24'
  }
];

export const INITIAL_FINANCE_ACCOUNTS = [
  {
    id: 'acc_main_cash',
    name: 'الخزينة الرئيسية (كاش)',
    type: 'cash' as const,
    openingBalance: 5000,
    initialBalance: 5000,
    currentBalance: 14500,
    currency: 'EGP',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    version: 1
  },
  {
    id: 'acc_vodafone',
    name: 'محفظة فودافون كاش (01012345678)',
    type: 'wallet' as const,
    openingBalance: 2000,
    initialBalance: 2000,
    currentBalance: 8200,
    currency: 'EGP',
    accountNumber: '01012345678',
    color: '#E60000',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    version: 1
  },
  {
    id: 'acc_instapay',
    name: 'حساب انستا باي (ahmed.mahmoud@instapay)',
    type: 'wallet' as const,
    openingBalance: 3000,
    initialBalance: 3000,
    currentBalance: 12400,
    currency: 'EGP',
    accountNumber: 'ahmed.mahmoud@instapay',
    color: '#8A2BE2',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    version: 1
  },
  {
    id: 'acc_cib_bank',
    name: 'حساب البنك التجاري الدولي CIB',
    type: 'bank' as const,
    openingBalance: 20000,
    initialBalance: 20000,
    currentBalance: 35000,
    currency: 'EGP',
    bankName: 'CIB Bank',
    accountNumber: 'EG1200020001000001234567890',
    color: '#003366',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    version: 1
  }
];

export const INITIAL_FINANCE_TRANSACTIONS = [
  {
    id: 'tx_1',
    accountId: 'acc_main_cash',
    type: 'income' as const,
    amount: 1500,
    categoryName: 'رسوم حصص ودورات',
    description: 'اشتراك شهري - سارة يوسف الشافعي',
    date: '2026-08-05',
    relatedPaymentId: 'pay_1',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  },
  {
    id: 'tx_2',
    accountId: 'acc_vodafone',
    type: 'income' as const,
    amount: 2200,
    categoryName: 'رسوم حصص ودورات',
    description: 'اشتراك ثانوية عامة - كريم زياد مصطفى',
    date: '2026-08-02',
    relatedPaymentId: 'pay_2',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  },
  {
    id: 'tx_3',
    accountId: 'acc_main_cash',
    type: 'expense' as const,
    amount: 450,
    categoryName: 'طباعة وتصوير مذكرات',
    description: 'طباعة مذكرات Lektion 3 و B1 ملزمة الشرح',
    date: '2026-08-10',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  },
  {
    id: 'tx_4',
    accountId: 'acc_instapay',
    type: 'income' as const,
    amount: 1600,
    categoryName: 'رسوم حصص ودورات',
    description: 'اشتراك شهري A2 - حازم محمد',
    date: '2026-08-04',
    relatedPaymentId: 'pay_6',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  },
  {
    id: 'tx_5',
    accountId: 'acc_cib_bank',
    type: 'income' as const,
    amount: 2800,
    categoryName: 'رسوم حصص ودورات',
    description: 'اشتراك دورة B2 Medizin - د. طارق مصطفى',
    date: '2026-08-01',
    relatedPaymentId: 'pay_7',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  },
  {
    id: 'tx_6',
    accountId: 'acc_main_cash',
    type: 'expense' as const,
    amount: 1200,
    categoryName: 'إيجار سنتر وقاعات',
    description: 'إيجار قاعة سنتر المتفوقين لشهر أغسطس',
    date: '2026-08-01',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  }
];

export const INITIAL_FINANCE_RECURRING = [
  {
    id: 'rec_1',
    name: 'إيجار قاعة سنتر المتفوقين',
    type: 'expense' as const,
    amount: 1200,
    categoryId: 'cat_rent',
    accountId: 'acc_main_cash',
    frequency: 'monthly' as const,
    dueDayOfMonth: 1,
    startDate: '2026-01-01',
    nextDueDate: '2026-09-01',
    notificationsEnabled: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rec_2',
    name: 'اشتراك منصة Zoom Pro التعليمية',
    type: 'expense' as const,
    amount: 350,
    categoryId: 'cat_software',
    accountId: 'acc_instapay',
    frequency: 'monthly' as const,
    dueDayOfMonth: 15,
    startDate: '2026-01-01',
    nextDueDate: '2026-09-15',
    notificationsEnabled: true,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_FINANCE_INSTALLMENTS = [
  {
    id: 'inst_1',
    name: 'دورة B2 Medizin المكثفة للأطباء (د. رانيا محمود)',
    categoryId: 'cat_courses',
    accountId: 'acc_cib_bank',
    originalAmount: 5600,
    downPayment: 2800,
    installmentAmount: 2800,
    totalInstallments: 2,
    paidInstallments: 1,
    remainingAmount: 2800,
    frequency: 'monthly',
    firstDueDate: '2026-08-03',
    nextDueDate: '2026-09-03',
    status: 'active' as const,
    notificationsEnabled: true,
    notes: 'القسط الثاني مستحق بداية سبتمبر 2026'
  }
];

export const INITIAL_FINANCE_NOTIFICATIONS = [
  {
    id: 'fnot_1',
    title: 'قسط مستحق قريباً',
    message: 'تذكير: القسط الثاني لدورة B2 Medizin بقيمة 2,800 ج.م مستحق يوم 03 سبتمبر.',
    amount: 2800,
    priority: 'warning' as const,
    read: false,
    type: 'installment' as const,
    dueDate: '2026-09-03',
    createdAt: new Date().toISOString()
  },
  {
    id: 'fnot_2',
    title: 'تأكيد التسوية المالية',
    message: 'تم تسجيل كافة الإيرادات والمصروفات لشهر أغسطس بنجاح.',
    priority: 'informational' as const,
    read: true,
    type: 'system' as const,
    createdAt: new Date().toISOString()
  }
];



