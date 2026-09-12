import { StudentPortalData } from '../types';

export const DEMO_STUDENT: StudentPortalData = {
  id: 'stu-1001',
  studentCode: 'STU-1001',
  name: 'عمر أحمد الشناوي',
  gender: 'male',
  gradeLevel: 'اللغة الألمانية - A1.1 (الصف الأول الثانوي)',
  groupName: 'مجموعة المتميزين الألمانية - سنتر الأوائل',
  teacherName: 'أ. أحمد سمير',
  teacherTitle: 'معلم أول اللغة الألمانية 🇩🇪',
  teacherPhone: '201012345678',
  parentPhone: '01000000000',
  studentPhone: '01011111111',
  
  stats: {
    totalSessions: 12,
    attendedSessions: 12,
    attendanceRate: 100,
    homeworkRate: 92,
    averageQuizGrade: 9.6,
    averageDictationGrade: 9.8,
    totalCertificates: 2,
  },

  nextLesson: {
    id: 'next-1',
    title: 'حصة المحادثة والقواعد - الدرس الرابع',
    date: '2026-09-15',
    dayOfWeek: 'الثلاثاء',
    time: '6:00 م',
    isOnline: true,
    zoomLink: 'https://us05web.zoom.us/j/81652394609?pwd=example',
    topic: 'تصريف الأفعال الشاذة والضمائر الشخصية (Akkusativ)'
  },

  lessons: [
    {
      id: 'les-12',
      date: '2026-09-12',
      dayOfWeek: 'السبت',
      time: '6:00 م',
      sessionNumber: 6,
      totalCycleSessions: 8,
      topic: 'شرح أدوات المعرفة والنكرة وحالة النصب في الألماني',
      attendanceStatus: 'present',
      homeworkDone: 'yes',
      dictationGrade: 10,
      examGrade: 9.5,
      teacherFeedback: 'ما شاء الله مستواه هايل وفاهم الدرس ومستوعب كويس جداً، مركز في كل التفاصيل ومشاركته ممتازة كالعادة.',
      homeworkRequired: 'حل تدريبات كتاب جلوبال ص 45 و 46 وحفظ تصريف 10 أفعال شاذة.',
      recordingLink: 'https://youtu.be/example1',
      recordingLink2: 'https://youtu.be/example2'
    },
    {
      id: 'les-11',
      date: '2026-09-09',
      dayOfWeek: 'الأربعاء',
      time: '6:00 م',
      sessionNumber: 5,
      totalCycleSessions: 8,
      topic: 'مراجعة الأرقام والألوان وتدريبات المحادثة السريعة',
      attendanceStatus: 'present',
      homeworkDone: 'yes',
      dictationGrade: 9.5,
      examGrade: 10,
      teacherFeedback: 'شاطر جداً ومنور الحصة واستيعابه سريع ما شاء الله، نطق الكلمات رائع ومفيش أي غلطة في الإملاء.',
      homeworkRequired: 'تسميع كلمات الوحدة الثانية وحل ورقة العمل المرفقة.',
      recordingLink: 'https://youtu.be/example_prev'
    },
    {
      id: 'les-10',
      date: '2026-09-05',
      dayOfWeek: 'السبت',
      time: '6:00 م',
      sessionNumber: 4,
      totalCycleSessions: 8,
      topic: 'تكوين السؤال بالألمانية (W-Fragen / Ja-Nein Fragen)',
      attendanceStatus: 'present',
      homeworkDone: 'yes',
      dictationGrade: 10,
      examGrade: 9,
      teacherFeedback: 'أداء ممتاز واجتهاد واضح في حل الواجب والتفاعل، ربنا يبارك فيه وتمنياتنا بدوام التفوق.',
      homeworkRequired: 'كتابة 5 أسئلة بالألماني مع الإجابة عنها.'
    }
  ],

  quizzes: [
    {
      id: 'quiz-3',
      date: '2026-09-12',
      title: 'كويز أدوات التعريف والتنكير (Der, Die, Das)',
      type: 'quiz',
      score: 9.5,
      maxScore: 10,
      percentage: 95,
      feedback: 'ممتاز، إتقان كامل للقاعدة مع تركيز عالي.'
    },
    {
      id: 'dict-3',
      date: '2026-09-12',
      title: 'إملاء كلمات الحصة السادسة (Der Beruf & Die Familie)',
      type: 'dictation',
      score: 10,
      maxScore: 10,
      percentage: 100,
      feedback: 'درجة نهائية وتنسيق ممتاز.'
    },
    {
      id: 'exam-1',
      date: '2026-09-01',
      title: 'الامتحان الشهري الشامل للمستوى A1 (Part 1)',
      type: 'monthly_exam',
      score: 29,
      maxScore: 30,
      percentage: 97,
      feedback: 'المركز الأول على المجموعة 🏆'
    }
  ],

  certificates: [
    {
      id: 'cert-1',
      title: 'شهادة التفوق والتميز في اللغة الألمانية - الشهر الأول',
      issueDate: '2026-09-01',
      badge: 'امتياز مع مرتبة الشرف 🌟',
      description: 'تقديراً للأداء الاستثنائي والالتزام الكامل بحضور الحصص وحل الواجبات والحصول على الدرجة النهائية.',
      templateType: 'german_excellence'
    },
    {
      id: 'cert-2',
      title: 'شهادة إتقان المحادثة الألمانية والنطق الصحيح (A1.1)',
      issueDate: '2026-08-15',
      badge: 'الطالب المثالي 🇩🇪',
      description: 'نظراً لإظهار طلاقة لغوية متميزة وشجاعة في التحدث باللغة الألمانية أثناء الحصة.',
      templateType: 'speech_mastery'
    }
  ],

  packageInfo: {
    packageName: 'باقة الحصص الدورية (8 حصص)',
    currentSessionInCycle: 6,
    totalCycleSessions: 8,
    isPaid: true,
    amount: 800,
    currency: 'ج.م',
    renewalDate: '2026-09-20',
    notes: 'متبقي حصتين على تجديد الباقة القادمة'
  },

  lastUpdated: '2026-09-12T14:30:00'
};
