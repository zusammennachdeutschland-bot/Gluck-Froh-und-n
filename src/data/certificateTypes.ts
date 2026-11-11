import { CertificateTypeKey, CertificateLanguage, CertificateTemplateId, CertificateCategoryKey } from '../types';

export interface CertificateCategoryConfig {
  key: CertificateCategoryKey;
  iconName: string;
  emoji: string;
  names: Record<CertificateLanguage, string>;
  typeKeys: CertificateTypeKey[];
}

export interface CertificateTypeConfig {
  key: CertificateTypeKey;
  category: CertificateCategoryKey;
  iconName: string;
  badgeEmoji: string;
  defaultBadgeText: Record<CertificateLanguage, string>;
  titles: Record<CertificateLanguage, string>;
  subtitles: Record<CertificateLanguage, string>;
  descriptions: Record<CertificateLanguage, string>;
}

export const CERTIFICATE_CATEGORIES_CONFIG: Record<CertificateCategoryKey, CertificateCategoryConfig> = {
  achievement: {
    key: 'achievement',
    iconName: 'Award',
    emoji: '🏆',
    names: {
      en: 'Achievement',
      de: 'Leistung & Exzellenz',
      ar: 'الإنجاز والتميز'
    },
    typeKeys: ['achievement', 'outstanding_achievement', 'outstanding_performance', 'excellent_performance']
  },
  progress: {
    key: 'progress',
    iconName: 'TrendingUp',
    emoji: '📈',
    names: {
      en: 'Progress & Improvement',
      de: 'Fortschritt & Entwicklung',
      ar: 'التقدم والتطور'
    },
    typeKeys: ['great_progress', 'most_improved', 'excellent_progress', 'outstanding_improvement']
  },
  german: {
    key: 'german',
    iconName: 'Languages',
    emoji: '🇩🇪',
    names: {
      en: 'German Language',
      de: 'Deutsche Sprache',
      ar: 'اللغة الألمانية'
    },
    typeKeys: [
      'german_achievement',
      'german_speaking',
      'german_vocabulary',
      'german_pronunciation',
      'german_excellence',
      'german_reading_fluency',
      'german_grammar_master'
    ]
  },
  learning: {
    key: 'learning',
    iconName: 'BookOpen',
    emoji: '📚',
    names: {
      en: 'Learning & Academics',
      de: 'Lernen & Unterricht',
      ar: 'التحصيل والتعلم'
    },
    typeKeys: [
      'homework_excellence',
      'excellent_participation',
      'exam_result',
      'outstanding_learning',
      'excellent_effort',
      'fast_learner',
      'moral_excellence'
    ]
  },
  creativity: {
    key: 'creativity',
    iconName: 'Lightbulb',
    emoji: '💡',
    names: {
      en: 'Creativity & Innovation',
      de: 'Kreativität & Innovation',
      ar: 'الإبداع والابتكار'
    },
    typeKeys: ['creative_genius', 'problem_solver', 'inspirational_project']
  },
  leadership: {
    key: 'leadership',
    iconName: 'Crown',
    emoji: '🌟',
    names: {
      en: 'Leadership & Spirit',
      de: 'Führung & Teamgeist',
      ar: 'القيادة وروح الفريق'
    },
    typeKeys: ['team_leader', 'presentation_mastery', 'positive_energy']
  },
  commitment: {
    key: 'commitment',
    iconName: 'CheckCircle2',
    emoji: '🎯',
    names: {
      en: 'Behavior & Attendance',
      de: 'Verhalten & Anwesenheit',
      ar: 'السلوك والانضباط'
    },
    typeKeys: ['perfect_attendance', 'excellent_attendance', 'outstanding_commitment', 'exemplary_discipline']
  },
  recognition: {
    key: 'recognition',
    iconName: 'Star',
    emoji: '⭐',
    names: {
      en: 'Special Recognition',
      de: 'Besondere Ehrung',
      ar: 'التكريم والتقدير'
    },
    typeKeys: ['student_of_month', 'star_student', 'student_of_week', 'appreciation', 'special_recognition']
  },
  custom: {
    key: 'custom',
    iconName: 'Sparkles',
    emoji: '✨',
    names: {
      en: 'Custom',
      de: 'Individuell',
      ar: 'مخصص'
    },
    typeKeys: ['custom']
  }
};

export const CERTIFICATE_TYPES_CONFIG: Record<CertificateTypeKey, CertificateTypeConfig> = {
  // ==========================================
  // 1. ACHIEVEMENT
  // ==========================================
  achievement: {
    key: 'achievement',
    category: 'achievement',
    iconName: 'Award',
    badgeEmoji: '🌟',
    defaultBadgeText: {
      en: 'EXCELLENCE',
      de: 'EXZELLENZ',
      ar: 'امتياز'
    },
    titles: {
      en: 'Certificate of Achievement',
      de: 'Leistungszertifikat',
      ar: 'شهادة إنجاز'
    },
    subtitles: {
      en: 'For outstanding commitment and exemplary academic achievement',
      de: 'Für hervorragenden Einsatz und vorbildliche schulische Leistungen',
      ar: 'للتميز الأكاديمي والالتزام الدراسي النموذجي'
    },
    descriptions: {
      en: 'In recognition of exceptional dedication, perseverance, and remarkable accomplishments in German language studies.',
      de: 'In Anerkennung herausragender Leistungen, kontinuierlichen Engagements und vorbildlicher Fortschritte im Deutschunterricht.',
      ar: 'تقديرًا للجهود المتميزة والمثابرة العالية وتحقيق إنجازات استثنائية مشرفة في دراسة اللغة الألمانية.'
    }
  },
  outstanding_achievement: {
    key: 'outstanding_achievement',
    category: 'achievement',
    iconName: 'Trophy',
    badgeEmoji: '👑',
    defaultBadgeText: {
      en: 'OUTSTANDING',
      de: 'HERAUSRAGEND',
      ar: 'إنجاز استثنائي'
    },
    titles: {
      en: 'Outstanding Achievement',
      de: 'Herausragende Leistung',
      ar: 'شهادة إنجاز استثنائي'
    },
    subtitles: {
      en: 'For demonstrating an extraordinary level of excellence and brilliance',
      de: 'Für herausragende Exzellenz und glänzende Studienergebnisse',
      ar: 'لإظهار مستوى استثنائي من التفوق والبراعة'
    },
    descriptions: {
      en: 'Conferred with highest distinction for reaching peak academic performance and setting a gold standard of excellence.',
      de: 'Verliehen mit höchster Auszeichnung für das Erreichen von Spitzenleistungen und vorbildlichem Voranschreiten.',
      ar: 'تُمنح بمرتبة الشرف الرفيعة لتحقيق أعلى مستويات الإتقان الدراسي وتقديم نموذج يُحتذى به في التفوق.'
    }
  },
  outstanding_performance: {
    key: 'outstanding_performance',
    category: 'achievement',
    iconName: 'Trophy',
    badgeEmoji: '🏆',
    defaultBadgeText: {
      en: 'TOP PERFORMER',
      de: 'SPITZENLEISTUNG',
      ar: 'أداء متميز'
    },
    titles: {
      en: 'Outstanding Performance',
      de: 'Urkunde für Spitzenleistung',
      ar: 'شهادة الأداء المتميز'
    },
    subtitles: {
      en: 'For achieving the highest standard of excellence and class participation',
      de: 'Für Spitzenleistungen und erstklassige Ergebnisse im Unterricht',
      ar: 'لتحقيق أعلى معايير التميز والأداء الرفيع في جميع الحصص'
    },
    descriptions: {
      en: 'Awarded for demonstrating superior mastery, active participation, and exemplary performance during all lessons.',
      de: 'Verliehen für überlegene Fachkompetenz, aktive Mitarbeit und vorbildliche Leistungen in allen Unterrichtsstunden.',
      ar: 'تُمنح هذه الشهادة تقديرًا للأداء الاستثنائي والمشاركة التفاعلية البناءة والتفوق المستمر في جميع الحصص.'
    }
  },
  excellent_performance: {
    key: 'excellent_performance',
    category: 'achievement',
    iconName: 'Sparkles',
    badgeEmoji: '💎',
    defaultBadgeText: {
      en: 'EXCELLENT',
      de: 'AUSGEZEICHNET',
      ar: 'أداء فائق'
    },
    titles: {
      en: 'Excellent Performance',
      de: 'Exzellente Leistung',
      ar: 'شهادة الأداء الفائق'
    },
    subtitles: {
      en: 'In honor of superb quality of work and consistent mastery',
      de: 'In Würdigung erstklassiger Qualität und durchgehend hoher Leistungen',
      ar: 'تكريمًا لجودة العمل الممتازة والإتقان المستمر'
    },
    descriptions: {
      en: 'Presented for consistently delivering exceptional work with outstanding precision, clarity, and dedication.',
      de: 'Überreicht für kontinuierlich herausragende Arbeitsergebnisse mit beispielhafter Präzision und Hingabe.',
      ar: 'تُمنح تقديرًا لتقديم مستوى راقٍ من العمل بدقة وإتقان وحرص دائم على التميز.'
    }
  },

  // ==========================================
  // 2. PROGRESS
  // ==========================================
  great_progress: {
    key: 'great_progress',
    category: 'progress',
    iconName: 'TrendingUp',
    badgeEmoji: '📈',
    defaultBadgeText: {
      en: 'GREAT PROGRESS',
      de: 'GROSSER FORTSCHRITT',
      ar: 'تقدم متميز'
    },
    titles: {
      en: 'Great Progress Award',
      de: 'Urkunde für Großen Fortschritt',
      ar: 'شهادة التقدم المتميز'
    },
    subtitles: {
      en: 'For remarkable improvement and academic growth',
      de: 'Für bemerkenswerte Leistungssteigerung und kontinuierliche Entwicklung',
      ar: 'تقديرًا للتطور الملحوظ والنمو الأكاديمي المستمر'
    },
    descriptions: {
      en: 'This certificate is proudly presented to celebrate substantial academic growth, persistent dedication, and great enthusiasm for learning.',
      de: 'Diese Urkunde wird mit Stolz verliehen zur Würdigung bedeutender Leistungsfortschritte und kontinuierlicher Lernfreude.',
      ar: 'تُمنح هذه الشهادة بكل فخر واعتزاز تقديرًا للتطور الملحوظ في المستوى والمثابرة والحرص المستمر على التعلم والتفوق.'
    }
  },
  most_improved: {
    key: 'most_improved',
    category: 'progress',
    iconName: 'Rocket',
    badgeEmoji: '🚀',
    defaultBadgeText: {
      en: 'MOST IMPROVED',
      de: 'GRÖSSTE ENTWICKLUNG',
      ar: 'الأكثر تطوراً'
    },
    titles: {
      en: 'Most Improved Student',
      de: 'Größte Leistungssteigerung',
      ar: 'شهادة الطالب الأكثر تطوراً'
    },
    subtitles: {
      en: 'For phenomenal strides in skill mastery and academic confidence',
      de: 'Für phänomenale Fortschritte und wachsendes Selbstvertrauen beim Lernen',
      ar: 'للقفزات النوعية والتحسن الكبير في اكتساب المهارات والثقة'
    },
    descriptions: {
      en: 'Awarded to celebrate inspiring leaps in understanding, overcome challenges, and tremendous improvement in German.',
      de: 'Verliehen für inspirierende Entwicklungsschritte, gemeisterte Herausforderungen und große Sprünge im Fach Deutsch.',
      ar: 'تُمنح احتفاءً بالقفزات الملهمة في الفهم وتجاوز التحديات والتطور المبهر في اللغة الألمانية.'
    }
  },
  excellent_progress: {
    key: 'excellent_progress',
    category: 'progress',
    iconName: 'TrendingUp',
    badgeEmoji: '⚡',
    defaultBadgeText: {
      en: 'EXCELLENT PROGRESS',
      de: 'HERVORRAGENDE ENTWICKLUNG',
      ar: 'تطور وتفوق'
    },
    titles: {
      en: 'Excellent Progress',
      de: 'Hervorragende Entwicklung',
      ar: 'شهادة التطور والتفوق'
    },
    subtitles: {
      en: 'For steady, determined progress and outstanding perseverance',
      de: 'Für stetigen, zielstrebigen Fortschritt und beispielhafte Ausdauer',
      ar: 'للتقدم الثابت والمستمر والمثابرة التي أثمرت نجاحاً مشهوداً'
    },
    descriptions: {
      en: 'In high appreciation of rapid advancements, keen curiosity, and continuous improvement across all language skills.',
      de: 'In hoher Anerkennung rascher Lernfortschritte, wacher Neugier und stetiger Verbesserung in allen Sprachbereichen.',
      ar: 'تقديرًا للسرعة والذكاء في اكتساب المفاهيم الجديدة والتطور المتواصل في كافة المهارات اللغوية.'
    }
  },
  outstanding_improvement: {
    key: 'outstanding_improvement',
    category: 'progress',
    iconName: 'ArrowUpRight',
    badgeEmoji: '🌟',
    defaultBadgeText: {
      en: 'TOP IMPROVEMENT',
      de: 'TOP-VERBESSERUNG',
      ar: 'تحسن استثنائي'
    },
    titles: {
      en: 'Outstanding Improvement',
      de: 'Außerordentliche Verbesserung',
      ar: 'شهادة التحسن الاستثنائي'
    },
    subtitles: {
      en: 'For demonstrating tremendous dedication to leveling up skills',
      de: 'Für vorbildlichen Ehrgeiz und messbare Leistungssteigerung',
      ar: 'للإصرار العالي والحرص الدائم على الارتقاء بالمستوى'
    },
    descriptions: {
      en: 'Celebrated for remarkable transformation and diligent effort resulting in tremendous academic improvement.',
      de: 'Ausgezeichnet für bemerkenswerte Leistungssteigerung durch Fleiß und kontinuierliche Zielstrebigkeit.',
      ar: 'تكريمًا للجهد الدؤوب الذي أثمر تحسنًا استثنائيًا ملحوظًا ومستوى مشرفًا للغاية.'
    }
  },

  // ==========================================
  // 3. GERMAN LANGUAGE
  // ==========================================
  german_achievement: {
    key: 'german_achievement',
    category: 'german',
    iconName: 'Languages',
    badgeEmoji: '🗣️',
    defaultBadgeText: {
      en: 'DEUTSCH PRO',
      de: 'DEUTSCH-MEISTER',
      ar: 'تميز ألماني'
    },
    titles: {
      en: 'German Language Achievement',
      de: 'Exzellenz in der deutschen Sprache',
      ar: 'شهادة التميز في اللغة الألمانية'
    },
    subtitles: {
      en: 'For mastering German vocabulary, grammar, and conversation',
      de: 'Für herausragende Sprachkompetenz und Begeisterung für Deutsch',
      ar: 'لإتقان مهارات التحدث والقواعد والمفردات الألمانية'
    },
    descriptions: {
      en: 'In honor of superb articulation, confident German pronunciation, and profound understanding of linguistic concepts.',
      de: 'In Würdigung exzellenter Aussprache, sicherer Grammatikanwendung und vertieften Sprachverständnisses.',
      ar: 'تكريمًا للطلاقة اللغوية، والنطق السليم، والاستيعاب المتقن لقواعد ومفردات اللغة الألمانية.'
    }
  },
  german_speaking: {
    key: 'german_speaking',
    category: 'german',
    iconName: 'Mic',
    badgeEmoji: '🎙️',
    defaultBadgeText: {
      en: 'FLUENT SPEAKER',
      de: 'SPRECH-PROFI',
      ar: 'طلاقة التحدث'
    },
    titles: {
      en: 'Excellent German Speaking',
      de: 'Exzellente Deutsch-Konversation',
      ar: 'شهادة طلاقة التحدث بالألمانية'
    },
    subtitles: {
      en: 'For fluent dialogue, expressive articulation, and conversational courage',
      de: 'Für flüssige Dialoge, ausdrucksstarke Sprache und mutiges Sprechen',
      ar: 'للتحدث بطلاقة وثقة والتعبير المميز في المحادثات الصفية'
    },
    descriptions: {
      en: 'Awarded for impressive fluency, active conversation participation, and confident spoken German in class.',
      de: 'Verliehen für beeindruckende Redegewandtheit, aktive Gesprächsbeteiligung und souveränes Deutschsprechen.',
      ar: 'تُمنح تقديرًا للشجاعة والطلاقة اللغوية في الحوار والتعبير الشفهي الواضح باللغة الألمانية.'
    }
  },
  german_vocabulary: {
    key: 'german_vocabulary',
    category: 'german',
    iconName: 'Book',
    badgeEmoji: '📖',
    defaultBadgeText: {
      en: 'WORD MASTER',
      de: 'WORTSCHATZ-MEISTER',
      ar: 'بطل المفردات'
    },
    titles: {
      en: 'Excellent German Vocabulary',
      de: 'Exzellenter Deutsch-Wortschatz',
      ar: 'شهادة تميز المفردات الألمانية'
    },
    subtitles: {
      en: 'For rich vocabulary acquisition and accurate word choice',
      de: 'Für bemerkenswerten Wortschatzerwerb und treffsichere Wortwahl',
      ar: 'لحفظ واستخدام الثروة اللغوية والمفردات بدقة متناهية'
    },
    descriptions: {
      en: 'Presented for mastering an extensive German vocabulary and applying terms with exceptional precision.',
      de: 'Überreicht für die Beherrschung eines breiten Wortschatzes und dessen treffsichere Anwendung im Kontext.',
      ar: 'تُمنح لإتقان حفظ كم هائل من المفردات الألمانية وتوظيفها بذكاء ودقة في التراكيب اللغوية.'
    }
  },
  german_pronunciation: {
    key: 'german_pronunciation',
    category: 'german',
    iconName: 'Volume2',
    badgeEmoji: '🎯',
    defaultBadgeText: {
      en: 'PERFECT ACCENT',
      de: 'TOP-AUSSPRACHE',
      ar: 'نطق سليم'
    },
    titles: {
      en: 'Excellent German Pronunciation',
      de: 'Exzellente Aussprache & Phonetik',
      ar: 'شهادة تميز النطق ومخارج الحروف'
    },
    subtitles: {
      en: 'For crystal-clear phonetics, melodic intonation, and authentic accent',
      de: 'Für glasklare Phonetik, natürliche Sprachmelodie und akzentfreie Aussprache',
      ar: 'للنطق الصوتي الدقيق ومخارج الحروف السليمة والإيقاع اللغوي المتقن'
    },
    descriptions: {
      en: 'Honored for remarkable pronunciation accuracy, native phonetic intonation, and crystal clear reading.',
      de: 'Ausgezeichnet für beispielhafte phonetische Genauigkeit, lebendige Intonation und klares Vorlesen.',
      ar: 'تكريمًا لسلامة النطق ومخارج الحروف والأداء الصوتي الممتاز أثناء القراءة والتحدث بالألمانية.'
    }
  },
  german_excellence: {
    key: 'german_excellence',
    category: 'german',
    iconName: 'Check',
    badgeEmoji: '🏆',
    defaultBadgeText: {
      en: 'DEUTSCH ELITE',
      de: 'DEUTSCH-ELITE',
      ar: 'النخبة الألمانية'
    },
    titles: {
      en: 'German Learning Excellence',
      de: 'Exzellenz im Deutschlernen',
      ar: 'شهادة التفوق في تعلم الألمانية'
    },
    subtitles: {
      en: 'For holistic excellence across grammar, reading, writing, and speaking',
      de: 'Für ganzheitliche Spitzenleistungen in Grammatik, Lesen, Schreiben und Sprechen',
      ar: 'للتفوق الشامل في القواعد والقراءة والكتابة والمحادثة'
    },
    descriptions: {
      en: 'Conferred for all-around academic mastery and exceptional achievements across all domains of the German language.',
      de: 'Verliehen für allumfassende Sprachbeherrschung und herausragende Resultate in allen Bereichen des Deutschunterrichts.',
      ar: 'تُمنح تقديرًا للتميز الشامل والتحصيل النموذجي في جميع فروع دراسة اللغة الألمانية.'
    }
  },

  // ==========================================
  // 4. LEARNING & ACADEMICS
  // ==========================================
  homework_excellence: {
    key: 'homework_excellence',
    category: 'learning',
    iconName: 'BookOpen',
    badgeEmoji: '📚',
    defaultBadgeText: {
      en: 'HOMEWORK HERO',
      de: 'HAUSAUFGABEN-PROFI',
      ar: 'بطل الواجبات'
    },
    titles: {
      en: 'Excellent Homework',
      de: 'Hausaufgaben-Ehrenurkunde',
      ar: 'شهادة التميز في الواجبات'
    },
    subtitles: {
      en: 'For consistent diligence, thoroughness, and perfect homework submissions',
      de: 'Für vorbildliche Sorgfalt und pünktliche Erledigung aller Aufgaben',
      ar: 'للدقة والالتزام التام بتسليم كافة الواجبات والمهام المنزلية'
    },
    descriptions: {
      en: 'Awarded for 100% homework completion with immaculate accuracy, neatness, and punctual submission.',
      de: 'Verliehen für lückenlose und sorgfältige Bearbeitung sowie stets pünktliche Abgabe aller Hausaufgaben.',
      ar: 'تُمنح للالتزام الكامل بحل وتسليم جميع الواجبات المدرسية بمنتهى الدقة والترتيب والالتزام بالموعد المحدد.'
    }
  },
  excellent_participation: {
    key: 'excellent_participation',
    category: 'learning',
    iconName: 'Hand',
    badgeEmoji: '🙋‍♂️',
    defaultBadgeText: {
      en: 'TOP CONTRIBUTOR',
      de: 'AKTIVSTE MITARBEIT',
      ar: 'المشاركة الفعالة'
    },
    titles: {
      en: 'Excellent Participation',
      de: 'Vorbildliche Unterrichtsbeteiligung',
      ar: 'شهادة المشاركة والتفاعل الصفي'
    },
    subtitles: {
      en: 'For active enthusiasm, thoughtful questions, and engaging classroom energy',
      de: 'Für lebhafte Mitarbeit, kluge Fragen und inspirierenden Beitrag zum Unterricht',
      ar: 'للتفاعل الإيجابي المستمر والأسئلة الذكية وإثراء الحصص الدراسية'
    },
    descriptions: {
      en: 'In appreciation of dynamic classroom participation, bright questions, and uplifting collaborative spirit.',
      de: 'In Anerkennung dynamischer Mitarbeit, aufgeweckter Fragen und positiver Bereicherung des Unterrichts.',
      ar: 'تقديرًا للمشاركة الصفية الحيوية والتفاعل الدائم والحرص على الاستفادة والإفادة في كل درس.'
    }
  },
  exam_result: {
    key: 'exam_result',
    category: 'learning',
    iconName: 'GraduationCap',
    badgeEmoji: '🥇',
    defaultBadgeText: {
      en: 'TOP GRADE',
      de: 'NOTE 1 / SEHR GUT',
      ar: 'الدرجة النهائية'
    },
    titles: {
      en: 'Excellent Exam Result',
      de: 'Hervorragendes Prüfungsergebnis',
      ar: 'شهادة نتيجة امتحان متميزة'
    },
    subtitles: {
      en: 'For achieving outstanding marks and demonstrating solid mastery',
      de: 'Für ein glänzendes Resultat und fundiertes Fachwissen',
      ar: 'للحصول على أعلى الدرجات والتفوق المستحق في الاختبار'
    },
    descriptions: {
      en: 'Awarded in recognition of top-tier exam performance, comprehensive preparation, and extraordinary precision.',
      de: 'Verliehen in Würdigung herausragender Prüfungsergebnisse, gewissenhafter Vorbereitung und exzellenten Fachwissens.',
      ar: 'تُمنح تكريمًا للنتيجة المشرفة في الاختبار، والاستعداد الممتاز، والإجابات النموذجية التي تعكس فهمًا عميقًا.'
    }
  },
  outstanding_learning: {
    key: 'outstanding_learning',
    category: 'learning',
    iconName: 'Brain',
    badgeEmoji: '🧠',
    defaultBadgeText: {
      en: 'MASTER MIND',
      de: 'LERNERFOLG',
      ar: 'تحصيل رائع'
    },
    titles: {
      en: 'Outstanding Learning',
      de: 'Herausragender Lernerfolg',
      ar: 'شهادة التحصيل الدراسي الرائع'
    },
    subtitles: {
      en: 'For deep comprehension, critical thinking, and rapid skill retention',
      de: 'Für tiefes Verständnis, scharfes Denken und rasche Wissensaneignung',
      ar: 'للفهم العميق وسرعة الاستيعاب والقدرة على تطبيق المعرفة'
    },
    descriptions: {
      en: 'Presented for exemplary cognitive engagement, deep grasp of core concepts, and sustained intellectual curiosity.',
      de: 'Überreicht für vorbildliche Auffassungsgabe, tiefes Sachverständnis und ungebrochene Wissbegierde.',
      ar: 'تُمنح تقديرًا للذكاء والتحصيل المتميز والقدرة على استيعاب وتطبيق المعارف اللغوية بكل سهولة.'
    }
  },
  excellent_effort: {
    key: 'excellent_effort',
    category: 'learning',
    iconName: 'Flame',
    badgeEmoji: '🔥',
    defaultBadgeText: {
      en: 'GREAT EFFORT',
      de: 'VORBILDFLEISS',
      ar: 'جهد ومثابرة'
    },
    titles: {
      en: 'Excellent Effort',
      de: 'Vorbildlicher Fleiß & Einsatz',
      ar: 'شهادة الجهد والمثابرة المتميزة'
    },
    subtitles: {
      en: 'For tireless hard work, commendable focus, and passion for excellence',
      de: 'Für unermüdlichen Arbeitseinsatz, vorbildlichen Fokus und echten Lerneifer',
      ar: 'للعمل الدؤوب والتركيز العالي والشغف المستمر بالتعلم'
    },
    descriptions: {
      en: 'Honored for admirable persistence, giving 100% effort in every lesson, and never giving up on challenges.',
      de: 'Ausgezeichnet für bewundernswerte Ausdauer, vollen Einsatz in jeder Stunde und vorbildliche Lernbereitschaft.',
      ar: 'تكريمًا للإخلاص في المذاكرة وبذل أقصى جهد ممكن ومواجهة التحديات الدراسية بعزيمة صلبة.'
    }
  },

  // ==========================================
  // 5. BEHAVIOR & COMMITMENT
  // ==========================================
  perfect_attendance: {
    key: 'perfect_attendance',
    category: 'commitment',
    iconName: 'CheckCircle2',
    badgeEmoji: '🎯',
    defaultBadgeText: {
      en: '100% ATTENDANCE',
      de: '100% ANWESENHEIT',
      ar: 'حضور كامل'
    },
    titles: {
      en: 'Perfect Attendance Award',
      de: 'Urkunde für Perfekte Anwesenheit',
      ar: 'شهادة المواظبة والحضور الكامل'
    },
    subtitles: {
      en: 'For punctuality, reliability, and 100% active attendance',
      de: 'Für vorbildliche Pünktlichkeit und lückenlose Teilnahme',
      ar: 'للانضباط الكامل والحضور والمشاركة الفعالة دون انقطاع'
    },
    descriptions: {
      en: 'In high appreciation of perfect punctuality, zero unexcused absences, and unwavering commitment to lesson schedules.',
      de: 'In hoher Anerkennung vorbildlicher Pünktlichkeit und lückenloser Präsenz während des gesamten Zeitraums.',
      ar: 'تقديرًا للانضباط التام، والمواظبة على الحضور في الموعد المحدد دون أي غياب، والحرص على الاستفادة من كل دقيقة.'
    }
  },
  excellent_attendance: {
    key: 'excellent_attendance',
    category: 'commitment',
    iconName: 'Clock',
    badgeEmoji: '⏰',
    defaultBadgeText: {
      en: 'PUNCTUALITY',
      de: 'PÜNKTLICHKEIT',
      ar: 'انضباط المواعيد'
    },
    titles: {
      en: 'Excellent Attendance',
      de: 'Vorbildliche Anwesenheit',
      ar: 'شهادة انضباط الحضور والمواعيد'
    },
    subtitles: {
      en: 'For outstanding punctuality, respect of lesson time, and regular presence',
      de: 'Für vorbildliche Pünktlichkeit, Respekt vor der Unterrichtszeit und Verlässlichkeit',
      ar: 'لاحترام وقت الدرس والحرص الدائم على التواجد المبكر والالتزام التام'
    },
    descriptions: {
      en: 'Awarded for exemplary regularity, constant punctuality, and great respect for class schedules.',
      de: 'Verliehen für beispielhafte Regelmäßigkeit, stets pünktliches Erscheinen und vorbildliche Verlässlichkeit.',
      ar: 'تُمنح للالتزام العالي بالمواعيد والحضور المنتظم واحترام وقت المعلم والزملاء.'
    }
  },
  outstanding_commitment: {
    key: 'outstanding_commitment',
    category: 'commitment',
    iconName: 'ShieldCheck',
    badgeEmoji: '🛡️',
    defaultBadgeText: {
      en: 'COMMITTED',
      de: 'ENGAGIERT',
      ar: 'التزام نموذجي'
    },
    titles: {
      en: 'Outstanding Commitment',
      de: 'Außerordentliches Engagement',
      ar: 'شهادة الالتزام الاستثنائي'
    },
    subtitles: {
      en: 'For exemplary discipline, reliability, and high sense of responsibility',
      de: 'Für vorbildliche Disziplin, Zuverlässigkeit und hohes Verantwortungsbewusstsein',
      ar: 'للانضباط الذاتي والشعور العالي بالمسؤولية والجدية في الدراسة'
    },
    descriptions: {
      en: 'Presented in recognition of steadfast commitment, academic integrity, and admirable responsibility.',
      de: 'Überreicht in Anerkennung unerschütterlichen Engagements, Zuverlässigkeit und vorbildlicher Lernhaltung.',
      ar: 'تُمنح تقديرًا للالتزام الأخلاقي والأكاديمي والجدية الكاملة في متابعة الدروس والمهام.'
    }
  },
  exemplary_discipline: {
    key: 'exemplary_discipline',
    category: 'commitment',
    iconName: 'Smile',
    badgeEmoji: '🌟',
    defaultBadgeText: {
      en: 'ROLE MODEL',
      de: 'VORBILD',
      ar: 'قدوة حسنة'
    },
    titles: {
      en: 'Exemplary Discipline',
      de: 'Vorbildliche Disziplin & Benehmen',
      ar: 'شهادة السلوك والانضباط المثالي'
    },
    subtitles: {
      en: 'For polite etiquette, respectful behavior, and inspiring positive attitude',
      de: 'Für vorbildliche Höflichkeit, respektvolles Verhalten und positive Ausstrahlung',
      ar: 'للأخلاق الرفيعة والأدب والتعامل الراقي مع المعلم والزملاء'
    },
    descriptions: {
      en: 'Awarded with pride for exemplary classroom etiquette, courteous manner, and being a role model to all peers.',
      de: 'Mit Stolz verliehen für vorbildliche Umgangsformen, respektvolles Miteinander und echte Vorbildfunktion.',
      ar: 'تُمنح تكريمًا لحسن الخلق والأدب الجم والروح الإيجابية التي تجعل الطالب قدوة ومصدر فخر للجميع.'
    }
  },

  // ==========================================
  // 6. SPECIAL RECOGNITION
  // ==========================================
  student_of_month: {
    key: 'student_of_month',
    category: 'recognition',
    iconName: 'Star',
    badgeEmoji: '⭐',
    defaultBadgeText: {
      en: 'STAR OF THE MONTH',
      de: 'STERN DES MONATS',
      ar: 'طالب الشهر'
    },
    titles: {
      en: 'Student of the Month',
      de: 'Schüler des Monats',
      ar: 'شهادة طالب الشهر'
    },
    subtitles: {
      en: 'For inspiring peers and demonstrating outstanding all-around commitment',
      de: 'Für herausragendes Engagement und Vorbildfunktion im Unterricht',
      ar: 'للمستوى الاستثنائي ولكونه قدوة ملهمة لزملائه طوال الشهر'
    },
    descriptions: {
      en: 'Proudly awarded to the most outstanding student of the month for exceptional focus, teamwork, and academic brilliance.',
      de: 'Mit Stolz verliehen an die herausragendste Schülerpersönlichkeit des Monats für Fleiß, Teamgeist und Spitzennoten.',
      ar: 'تُمنح بكل فخر واعتزاز للطالب الأكثر تميزًا وتألقًا خلال هذا الشهر تقديرًا لأخلاقه الرفيعة وتفوقه المستمر.'
    }
  },
  star_student: {
    key: 'star_student',
    category: 'recognition',
    iconName: 'Sparkles',
    badgeEmoji: '🌟',
    defaultBadgeText: {
      en: 'STAR STUDENT',
      de: 'STAR-SCHÜLER',
      ar: 'الطالب النجم'
    },
    titles: {
      en: 'Star Student Award',
      de: 'Star-Schüler Auszeichnung',
      ar: 'وسام الطالب النجم'
    },
    subtitles: {
      en: 'For shining brightly in class with enthusiasm, positivity, and smart answers',
      de: 'Für leuchtenden Lerneifer, fröhliche Motivation und kluge Antworten',
      ar: 'للتألق الدائم والشغف والإجابات الذكية التي تضيء الحصص'
    },
    descriptions: {
      en: 'Presented to celebrate a stellar attitude, brilliant insights, and a joyful spirit that illuminates every lesson.',
      de: 'Überreicht zur Würdigung einer glänzenden Haltung, brillanter Beiträge und ansteckender Lernfreude.',
      ar: 'تُمنح تكريمًا للطالب النجم لتألقه الدائم وإيجابيته وابتسامته التي تنشر البهجة والنجاح في كل حصة.'
    }
  },
  student_of_week: {
    key: 'student_of_week',
    category: 'recognition',
    iconName: 'Medal',
    badgeEmoji: '🎖️',
    defaultBadgeText: {
      en: 'STAR OF THE WEEK',
      de: 'STERN DER WOCHE',
      ar: 'طالب الأسبوع'
    },
    titles: {
      en: 'Student of the Week',
      de: 'Schüler der Woche',
      ar: 'شهادة طالب الأسبوع'
    },
    subtitles: {
      en: 'For outstanding effort and stellar performance during this week',
      de: 'Für bemerkenswerten Einsatz und Glanzleistungen in dieser Woche',
      ar: 'للتميز البارز والأداء الاستثنائي خلال هذا الأسبوع'
    },
    descriptions: {
      en: 'Awarded for impressive focus, diligent homework, and active contributions throughout this week.',
      de: 'Verliehen für vorbildlichen Wochenfokus, fleißige Hausaufgaben und hervorragende Mitarbeit.',
      ar: 'تُمنح تقديرًا للتفوق والنشاط الملحوظ وإنجاز كافة المهام على أكمل وجه طوال هذا الأسبوع.'
    }
  },
  appreciation: {
    key: 'appreciation',
    category: 'recognition',
    iconName: 'Heart',
    badgeEmoji: '💫',
    defaultBadgeText: {
      en: 'WITH APPRECIATION',
      de: 'IN DANKBARKEIT',
      ar: 'شكر وتقدير'
    },
    titles: {
      en: 'Certificate of Appreciation',
      de: 'Anerkennungsurkunde',
      ar: 'شهادة شكر وتقدير'
    },
    subtitles: {
      en: 'With sincere gratitude for dedication and enthusiastic participation',
      de: 'In herzlicher Anerkennung für wertvolle Mitarbeit und Begeisterung',
      ar: 'بكل التقدير والامتنان للمشاركة الفعالة والروح الإيجابية العالية'
    },
    descriptions: {
      en: 'Presented with deep appreciation for active engagement, positive energy, and inspiring enthusiasm throughout the learning journey.',
      de: 'Überreicht mit tiefem Dank für motivierte Teilnahme, positive Ausstrahlung und Freude am gemeinsamen Lernen.',
      ar: 'تُقدّم بكل معاني الشكر والامتنان للتفاعل الإيجابي البنّاء، وحسن الخلق، والحرص الدائم على التميز والمشاركة.'
    }
  },
  special_recognition: {
    key: 'special_recognition',
    category: 'recognition',
    iconName: 'Award',
    badgeEmoji: '✨',
    defaultBadgeText: {
      en: 'HONOR ROLL',
      de: 'EHRENAUSZEICHNUNG',
      ar: 'تكريم خاص'
    },
    titles: {
      en: 'Certificate of Special Recognition',
      de: 'Besondere Ehrenurkunde',
      ar: 'شهادة تكريم خاصة'
    },
    subtitles: {
      en: 'In honor of commendable efforts and special contribution',
      de: 'Zur Würdigung besonderer Bemühungen und Verdienste',
      ar: 'تقديرًا للمجهود الخاص والمساهمة المتميزة'
    },
    descriptions: {
      en: 'Awarded with high distinction in recognition of remarkable effort, admirable talent, and dedicated learning.',
      de: 'Verliehen mit besonderer Auszeichnung für außergewöhnlichen Einsatz und beispielhafte Leistungen.',
      ar: 'تُمنح هذه الشهادة بمرتبة الشرف تقديرًا للجهد الاستثنائي والإخلاص في طلب العلم والتعلم.'
    }
  },

  // ==========================================
  // 7. CUSTOM & ALIASES
  // ==========================================
  custom: {
    key: 'custom',
    category: 'custom',
    iconName: 'Sparkles',
    badgeEmoji: '✨',
    defaultBadgeText: {
      en: 'HONOR ROLL',
      de: 'EHRENURKUNDE',
      ar: 'لوحة الشرف'
    },
    titles: {
      en: 'Certificate of Special Recognition',
      de: 'Individuelle Ehrenurkunde',
      ar: 'شهادة تكريم خاصة'
    },
    subtitles: {
      en: 'In honor of commendable efforts and special contribution',
      de: 'Zur Würdigung besonderer Bemühungen und Verdienste',
      ar: 'تقديرًا للمجهود الخاص والمساهمة المتميزة'
    },
    descriptions: {
      en: 'Awarded with high distinction in recognition of remarkable effort and admirable dedication.',
      de: 'Verliehen mit besonderer Auszeichnung für außergewöhnlichen Einsatz und beispielhafte Leistungen.',
      ar: 'تُمنح هذه الشهادة بمرتبة الشرف تقديرًا للجهد الاستثنائي والإخلاص في طلب العلم والتعلم.'
    }
  },
  course_completion: {
    key: 'course_completion',
    category: 'achievement',
    iconName: 'GraduationCap',
    badgeEmoji: '🎓',
    defaultBadgeText: {
      en: 'GRADUATE',
      de: 'ABSCHLUSS',
      ar: 'إتمام الدورة'
    },
    titles: {
      en: 'Certificate of Course Completion',
      de: 'Kursabschluss-Zertifikat',
      ar: 'شهادة إتمام الدورة التدريبية'
    },
    subtitles: {
      en: 'For successfully completing all required coursework and modules',
      de: 'Für den erfolgreichen Abschluss aller Kurseinheiten und Module',
      ar: 'لاجتياز جميع المتطلبات والوحدات الدراسية بنجاح'
    },
    descriptions: {
      en: 'Officially certifies that the student has successfully completed the entire German course curriculum with commendable distinction.',
      de: 'Bescheinigt offiziell, dass der Schüler das gesamte Kursprogramm im Fach Deutsch mit Erfolg abgeschlossen hat.',
      ar: 'تشهد هذه الوثيقة بأن الطالب قد أتم بنجاح كافة متطلبات البرنامج التدريبي في اللغة الألمانية بتفوق.'
    }
  },
  participation: {
    key: 'participation',
    category: 'commitment',
    iconName: 'Users',
    badgeEmoji: '🤝',
    defaultBadgeText: {
      en: 'PARTICIPATION',
      de: 'TEILNAHME',
      ar: 'مشاركة'
    },
    titles: {
      en: 'Certificate of Participation',
      de: 'Teilnahmebescheinigung',
      ar: 'شهادة حضور ومشاركة'
    },
    subtitles: {
      en: 'For enthusiastic involvement and attendance',
      de: 'Für engagierte Teilnahme und regelmäßige Anwesenheit',
      ar: 'للحضور والتفاعل الإيجابي المستمر'
    },
    descriptions: {
      en: 'Presented in recognition of active participation and fruitful involvement in German lessons.',
      de: 'Überreicht in Anerkennung aktiver Teilnahme und wertvoller Mitarbeit im Unterricht.',
      ar: 'تُمنح تقديرًا للمشاركة الفعالة والحضور المستمر في دروس اللغة الألمانية.'
    }
  },
  german_reading_fluency: {
    key: 'german_reading_fluency',
    category: 'german',
    iconName: 'BookOpen',
    badgeEmoji: '📖',
    defaultBadgeText: {
      en: 'FLUENT READER',
      de: 'LESEKOMPETENZ',
      ar: 'طلاقة القراءة'
    },
    titles: {
      en: 'German Reading Fluency Award',
      de: 'Urkunde für herausragende Lesekompetenz',
      ar: 'وسام الطلاقة في القراءة بالألمانية'
    },
    subtitles: {
      en: 'For exceptional fluency, pronunciation, and reading comprehension',
      de: 'Für hervorragende Aussprache, Lesefluss und Textverständnis',
      ar: 'للقراءة السليمة والطلاقة المعبرة وفهم النصوص الألمانية'
    },
    descriptions: {
      en: 'Awarded in recognition of remarkable skill, accurate intonation, and fluent articulation in reading German texts.',
      de: 'Verliehen für vorbildliche Artikulation, präzise Aussprache und flüssiges Lesen deutscher Texte.',
      ar: 'تُمنح هذه الشهادة تقديرًا للأداء الرائع والطلاقة المعبرة وحسن النطق في قراءة النصوص باللغة الألمانية.'
    }
  },
  german_grammar_master: {
    key: 'german_grammar_master',
    category: 'german',
    iconName: 'CheckCircle2',
    badgeEmoji: '🧠',
    defaultBadgeText: {
      en: 'GRAMMAR MASTER',
      de: 'GRAMMATIK-MEISTER',
      ar: 'إتقان القواعد'
    },
    titles: {
      en: 'German Grammar Mastery Award',
      de: 'Urkunde für deutsche Grammatik-Meisterschaft',
      ar: 'وسام إتقان وتفوق القواعد الألمانية'
    },
    subtitles: {
      en: 'For stellar command of German grammatical structures and sentence building',
      de: 'Für hervorragendes Verständnis der deutschen Satzstrukturen und Grammatik',
      ar: 'للتمكن الفائق من تراكيب الجمل والقواعد اللغوية الألمانية'
    },
    descriptions: {
      en: 'Presented with distinction for high accuracy and superior mastery of complex German grammar rules.',
      de: 'Überreicht mit besonderer Anerkennung für präzise Anwendung und tiefes Verständnis der deutschen Grammatik.',
      ar: 'تُهدى هذه الشهادة تكريماً للضبط الدقيق والبراعة العالية في تطبيق واستيعاب قواعد اللغة الألمانية.'
    }
  },
  fast_learner: {
    key: 'fast_learner',
    category: 'learning',
    iconName: 'Zap',
    badgeEmoji: '⚡',
    defaultBadgeText: {
      en: 'FAST LEARNER',
      de: 'SCHNELLER LERNER',
      ar: 'سرعة البديهة'
    },
    titles: {
      en: 'Fast Learner & Quick Mind Award',
      de: 'Urkunde für schnelle Auffassungsgabe',
      ar: 'وسام سرعة البديهة والتعلم السريع'
    },
    subtitles: {
      en: 'For rapid understanding and swift assimilation of new concepts',
      de: 'Für zügiges Begreifen und erfolgreiches Umsetzen neuer Lerninhalte',
      ar: 'لسرعة الاستيعاب والتفاعل الذكي مع المفاهيم والدروس الجديدة'
    },
    descriptions: {
      en: 'Celebrated for an exceptionally sharp mind, quick comprehension, and immediate grasp of German lessons.',
      de: 'Ausgezeichnet für scharfen Verstand, rasche Auffassungsgabe und schnellen Lernerfolg.',
      ar: 'تُمنح تقديرًا للذكاء المتوقد والقدرة الفائقة على استيعاب المعلومات والمهارات اللغوية بسرعة واقتدار.'
    }
  },
  moral_excellence: {
    key: 'moral_excellence',
    category: 'learning',
    iconName: 'Heart',
    badgeEmoji: '🌟',
    defaultBadgeText: {
      en: 'ROLE MODEL',
      de: 'VORBILD',
      ar: 'الخلق الرفيع'
    },
    titles: {
      en: 'Exemplary Manners & Ethics Award',
      de: 'Urkunde für vorbildliches Benehmen',
      ar: 'وسام حسن الخلق والأدب الرفيع'
    },
    subtitles: {
      en: 'For outstanding character, polite demeanor, and inspiring respect',
      de: 'Für respektvollen Umgang, Höflichkeit und vorbildliche Haltung',
      ar: 'لحسن التعامل والأخلاق الفاضلة والاحترام المتبادل في الحصة'
    },
    descriptions: {
      en: 'Presented to an exemplary student whose high morals, courtesy, and respect illuminate the learning space.',
      de: 'Überreicht an eine vorbildliche Persönlichkeit mit herausragendem Respekt und freundlichem Auftreten.',
      ar: 'تُهدى تقديراً للأخلاق الكريمة والتهذيب الجم وكون الطالب قدوة حسنة لزملائه في الانضباط والمحبة.'
    }
  },
  creative_genius: {
    key: 'creative_genius',
    category: 'creativity',
    iconName: 'Sparkles',
    badgeEmoji: '💡',
    defaultBadgeText: {
      en: 'CREATIVE MIND',
      de: 'KREATIV-GENIE',
      ar: 'العقل المبتكر'
    },
    titles: {
      en: 'Creative Mind & Innovation Award',
      de: 'Urkunde für kreative Exzellenz & Innovation',
      ar: 'وسام العقل المبتكر والإبداع الفكري'
    },
    subtitles: {
      en: 'For out-of-the-box thinking and unique creative solutions',
      de: 'Für originelles Denken, Einfallsreichtum und kreative Ideen',
      ar: 'للتفكير خارج الصندوق وتقديم حلول وأفكار إبداعية متميزة'
    },
    descriptions: {
      en: 'Conferred in celebration of radiant originality, creative expression, and inventive thinking during studies.',
      de: 'Verliehen für außergewöhnliche Kreativität, originelle Lösungsansätze und inspirierende Denkweise.',
      ar: 'تُمنح هذه الشهادة احتفاءً بالموهبة الفذة والأفكار الابتكارية الخلابة التي أثرت بيئة التعلم.'
    }
  },
  problem_solver: {
    key: 'problem_solver',
    category: 'creativity',
    iconName: 'Award',
    badgeEmoji: '🧩',
    defaultBadgeText: {
      en: 'PROBLEM SOLVER',
      de: 'PROBLEMLÖSER',
      ar: 'حل المشكلات'
    },
    titles: {
      en: 'Analytical Mind & Problem Solver Award',
      de: 'Urkunde für analytisches Denken & Problemlösung',
      ar: 'وسام التفكير التحليلي وحل المشكلات'
    },
    subtitles: {
      en: 'For perseverance and logical brilliance in overcoming academic challenges',
      de: 'Für logische Schärfe und Beharrlichkeit bei anspruchsvollen Aufgaben',
      ar: 'للمنطق السليم والقدرة الفائقة على تفكيك وتجاوز التحديات التعليمية'
    },
    descriptions: {
      en: 'Awarded with high distinction for analytical clarity, tenacious curiosity, and sharp deductive skills.',
      de: 'Ausgezeichnet für meisterhafte Analysefähigkeiten und erfolgreiche Bewältigung komplexer Herausforderungen.',
      ar: 'تُهدى تقديراً للبراعة الذهنية والنظرة التحليلية الثاقبة في إيجاد الحلول الذكية والتفوق في التمارين.'
    }
  },
  inspirational_project: {
    key: 'inspirational_project',
    category: 'creativity',
    iconName: 'Trophy',
    badgeEmoji: '🎨',
    defaultBadgeText: {
      en: 'BEST PROJECT',
      de: 'BESTES PROJEKT',
      ar: 'مشروع متميز'
    },
    titles: {
      en: 'Outstanding & Inspirational Project Award',
      de: 'Auszeichnung für herausragende Projektarbeit',
      ar: 'وسام المشروع الإبداعي الاستثنائي'
    },
    subtitles: {
      en: 'For crafting an extraordinary, well-researched, and engaging project',
      de: 'Für eine exzellente, detailreiche und inspirierende Präsentationsleistung',
      ar: 'لإعداد وتنفيذ مشروع دراسي استثنائي يعكس الجهد والابتكار'
    },
    descriptions: {
      en: 'Honoring exceptional initiative, meticulous research, and brilliant presentation in language project work.',
      de: 'In Anerkennung meisterhafter Projektgestaltung, fundierter Ausarbeitung und erstklassiger Ausführung.',
      ar: 'تشهد هذه الجائزة بالتميز الفائق في إخراج وإتقان المشروع التعليمي وتقديمه بأسلوب راقٍ ومؤثر.'
    }
  },
  team_leader: {
    key: 'team_leader',
    category: 'leadership',
    iconName: 'Award',
    badgeEmoji: '👑',
    defaultBadgeText: {
      en: 'INSPIRING LEADER',
      de: 'FÜHRUNGSTALENT',
      ar: 'القائد الملهم'
    },
    titles: {
      en: 'Inspiring Leader & Team Player Award',
      de: 'Urkunde für Führungskraft & Teamgeist',
      ar: 'وسام القائد الملهم وروح الفريق'
    },
    subtitles: {
      en: 'For encouraging peers, fostering teamwork, and leading by example',
      de: 'Für vorbildliche Motivation der Mitschüler und starken Gemeinschaftssinn',
      ar: 'لتشجيع الزملاء وبث روح التعاون والقيادة الإيجابية الحكيمة'
    },
    descriptions: {
      en: 'Bestowed upon an outstanding student whose supportive spirit and leadership inspire their fellow learners.',
      de: 'Verliehen an eine herausragende Persönlichkeit, die durch Hilfsbereitschaft und Führungsstärke glänzt.',
      ar: 'تُمنح تكريماً للدور القيادي البنّاء والأثر الطيب في مساعدة الزملاء وخلق جو تعليمي مفعم بالحماس.'
    }
  },
  presentation_mastery: {
    key: 'presentation_mastery',
    category: 'leadership',
    iconName: 'Star',
    badgeEmoji: '🎙️',
    defaultBadgeText: {
      en: 'GREAT SPEAKER',
      de: 'REDEGANDTHEIT',
      ar: 'الإلقاء البارع'
    },
    titles: {
      en: 'Eloquent Presentation & Delivery Award',
      de: 'Urkunde für meisterhafte Präsentation & Vortrag',
      ar: 'وسام الإلقاء والعرض التقديمي المتميز'
    },
    subtitles: {
      en: 'For confident public speaking, clear articulation, and persuasive delivery',
      de: 'Für selbstbewusstes Auftreten, klare Sprache und überzeugenden Vortrag',
      ar: 'للثقة العالية بالنفس والبيان الواضح والإلقاء الشيق والمقنع'
    },
    descriptions: {
      en: 'Presented in celebration of captivating presentation skills, confident stage presence, and fluent expression.',
      de: 'Überreicht für souveräne Präsentationsfähigkeiten, mitreißende Redekunst und exzellenten sprachlichen Ausdruck.',
      ar: 'تُهدى تقديراً للإلقاء الساحر والشجاعة الأدبية في التحدث وعرض الأفكار باللغة الألمانية بثقة وإبهار.'
    }
  },
  positive_energy: {
    key: 'positive_energy',
    category: 'leadership',
    iconName: 'Sparkles',
    badgeEmoji: '☀️',
    defaultBadgeText: {
      en: 'POSITIVE SPIRIT',
      de: 'SONNENSCHEIN',
      ar: 'طاقة إيجابية'
    },
    titles: {
      en: 'Positive Energy & Sunshine Award',
      de: 'Urkunde für positive Ausstrahlung & Motivation',
      ar: 'وسام الروح الإيجابية والبهجة الدائمة'
    },
    subtitles: {
      en: 'For bringing warmth, enthusiasm, and joy into every lesson',
      de: 'Für Fröhlichkeit, Optimismus und ansteckende Begeisterung im Unterricht',
      ar: 'لنشر التفاؤل والابتسامة والحماس الصادق في كل حصة دراسية'
    },
    descriptions: {
      en: 'Awarded with affection to a student whose radiant smile and enthusiastic attitude brighten our learning days.',
      de: 'Herzlich verliehen für eine herzerwärmende, stets motivierende und optimistische Unterrichtsbeteiligung.',
      ar: 'تُمنح محبةً وتقديرًا للطاقة الإيجابية الرائعة والابتسامة المشرقة التي تضيء القاعة وتلهم الجميع.'
    }
  }
};

export interface TemplateConfig {
  id: CertificateTemplateId;
  name: Record<CertificateLanguage, string>;
  description: Record<CertificateLanguage, string>;
  previewColor: string;
}

export const CERTIFICATE_TEMPLATES_CONFIG: Record<CertificateTemplateId, TemplateConfig> = {
  classic: {
    id: 'classic',
    name: {
      en: 'Classic Diploma (Gold & Navy)',
      de: 'Klassisch Diplom (Gold & Marine)',
      ar: 'كلاسيكي ملكي (ذهبي وكحلي)'
    },
    description: {
      en: 'Traditional prestigious diploma border with gold accents and royal seal',
      de: 'Traditioneller Diplom-Rahmen mit Goldakzenten und königlichem Siegel',
      ar: 'إطار دبلوماسي فاخر ذو أطراف مذهبة وختم ملكي تقليدي'
    },
    previewColor: '#0f172a'
  },
  neutral: {
    id: 'neutral',
    name: {
      en: 'Royal Prestige (Navy & Gold)',
      de: 'Königliches Diplom-Design',
      ar: 'القالب الملكي الفاخر'
    },
    description: {
      en: 'Universal prestigious gold & midnight navy styling, suitable for all students',
      de: 'Universelles, edles Gold- & Marineblau-Design für alle Schülerinnen und Schüler',
      ar: 'تصميم عام راقٍ ومحايد بالذهب والكحلي الملكي، ملائم لجميع الطلاب والطالبات'
    },
    previewColor: '#1e3a8a'
  },
  elegant: {
    id: 'elegant',
    name: {
      en: 'Modern Emerald Luxury',
      de: 'Elegantes Smaragd-Design',
      ar: 'زمردي عصري فاخر'
    },
    description: {
      en: 'Sophisticated modern borders with emerald gradient and golden ornaments',
      de: 'Moderne geometrische Linien mit Smaragd-Farbverlauf und feinen Goldornamenten',
      ar: 'تصميم هندسي حديث بلمسات زمردية راقية وزخارف ذهبية دقيقة'
    },
    previewColor: '#065f46'
  },
  kids: {
    id: 'kids',
    name: {
      en: 'Vibrant Superstar (Kids)',
      de: 'Bunter Superstar (Kinder)',
      ar: 'سوبر ستار مرح (للأطفال)'
    },
    description: {
      en: 'Playful, cheerful styling with bright starburst badges and celebratory ribbons',
      de: 'Fröhliches, farbenfrohes Design mit Sternen und Motivationsabzeichen',
      ar: 'تصميم مبهج وملون بالنجوم والشرائط التحفيزية المحببة للأطفال'
    },
    previewColor: '#f59e0b'
  },
  german_themed: {
    id: 'german_themed',
    name: {
      en: 'German National Theme',
      de: 'Deutsches Bundes-Design',
      ar: 'الطابع الألماني الرسمي'
    },
    description: {
      en: 'German flag ribbon accents, official certificate styling, and laurel crown',
      de: 'Offizielles Design mit schwarz-rot-goldenen Bändern und Lorbeerkranz',
      ar: 'تصميم رسمي مستوحى من ألوان العلم الألماني مع إكليل الغار وشريط الشرف'
    },
    previewColor: '#dc2626'
  },
  modern: {
    id: 'modern',
    name: {
      en: 'Clean Minimalist Modern',
      de: 'Modernes Minimalistisches Design',
      ar: 'عصري بسيط وأنيق'
    },
    description: {
      en: 'Crisp geometric borders, contemporary typography, dual-tone accents',
      de: 'Klare geometrische Linien, zeitgemäße Typografie und elegante Akzente',
      ar: 'خطوط هندسية واضحة، طباعة عصرية راقية، ولمسات حديثة جذابة'
    },
    previewColor: '#4f46e5'
  },
  boys_champion: {
    id: 'boys_champion',
    name: {
      en: 'Champion Hero (Boys)',
      de: 'Champion Held (Jungen)',
      ar: 'بطل الإنجاز (للأولاد)'
    },
    description: {
      en: 'Bold royal blue & electric cyan theme with gold shield badge and stars',
      de: 'Dynamisches Königsblau- & Cyan-Design mit goldenem Heldenschild und Sternen',
      ar: 'تصميم بطولي باللون الأزرق الملكي والسيان والدرع الذهبي المخصص للأولاد'
    },
    previewColor: '#1d4ed8'
  },
  girls_princess: {
    id: 'girls_princess',
    name: {
      en: 'Shining Princess (Girls)',
      de: 'Leuchtender Stern (Mädchen)',
      ar: 'أميرة التفوق (للبنات)'
    },
    description: {
      en: 'Graceful rose pink & pastel lavender theme with golden tiara crown and sparkles',
      de: 'Zauberhaftes Rosa- & Lavendel-Design mit goldener Krone und Glitzereffekten',
      ar: 'تصميم راقٍ ومشرق بالوردي الفاتح والبنفسجي والتاج الذهبي المخصص للبنات'
    },
    previewColor: '#db2777'
  },
  boys: {
    id: 'boys',
    name: {
      en: 'Boys Edition (Champion)',
      de: 'Jungen-Edition (Held)',
      ar: 'قالب الأولاد'
    },
    description: {
      en: 'Dynamic royal blue & electric cyan theme with gold shield badge and stars',
      de: 'Dynamisches Königsblau- & Cyan-Design mit goldenem Heldenschild und Sternen',
      ar: 'تصميم بطولي باللون الأزرق الملكي والسيان والدرع الذهبي المخصص للأولاد'
    },
    previewColor: '#1d4ed8'
  },
  girls: {
    id: 'girls',
    name: {
      en: 'Girls Edition (Princess)',
      de: 'Mädchen-Edition (Prinzessin)',
      ar: 'قالب البنات'
    },
    description: {
      en: 'Graceful rose pink & pastel lavender theme with golden tiara crown and sparkles',
      de: 'Zauberhaftes Rosa- & Lavendel-Design mit goldener Krone und Glitzereffekten',
      ar: 'تصميم راقٍ ومشرق بالوردي الفاتح والبنفسجي والتاج الذهبي المخصص للبنات'
    },
    previewColor: '#db2777'
  },
  custom_ai_bg: {
    id: 'custom_ai_bg',
    name: {
      en: 'AI Custom Background',
      de: 'KI-Hintergrunddesign',
      ar: 'خلفية AI المخصصة'
    },
    description: {
      en: 'Custom AI-generated background image with dynamic student data overlay',
      de: 'Individueller KI-Hintergrund mit dynamischer Daten- und Namensüberlagerung',
      ar: 'خلفية مصممة بواسطة الذكاء الاصطناعي مع تطبيق بيانات الطالب والأختام ديناميكياً'
    },
    previewColor: '#6366f1'
  },
  royal_emerald: {
    id: 'royal_emerald',
    name: {
      en: 'Royal Emerald Luxury (Gold & Deep Green)',
      de: 'Königliches Smaragd-Diplom (Gold & Grün)',
      ar: 'الزمرد الملكي الفاخر (ذهبي وأخضر ملكي)'
    },
    description: {
      en: 'Regal deep emerald canvas with ornate gold filigree and imperial laurel medallion',
      de: 'Königlicher Smaragd-Hintergrund mit goldenen Ornamenten und imperialem Lorbeer-Medaillon',
      ar: 'تصميم فخم باللون الأخضر الزمردي الداكن مع زخارف مذهبة وإكليل الغار الإمبراطوري'
    },
    previewColor: '#064e3b'
  },
  space_explorer: {
    id: 'space_explorer',
    name: {
      en: 'Cosmic Star Explorer (Galaxy Theme)',
      de: 'Kosmischer Sternenforscher (Galaxie-Design)',
      ar: 'مستكشف الفضاء والنجوم (طابع المجرات)'
    },
    description: {
      en: 'Midnight blue celestial sky with shining constellations, golden planets, and star medal',
      de: 'Mitternachtsblauer Sternenhimmel mit leuchtenden Sternbildern, goldenen Planeten und Sternmedaille',
      ar: 'سماء ليلية كونية مرصعة بالنجوم اللامعة والمدارات الذهبية وشارة النجم المتلألئ'
    },
    previewColor: '#0a0e27'
  },
  golden_olympic: {
    id: 'golden_olympic',
    name: {
      en: 'Olympic Gold (Radiant Laurel & Trophy)',
      de: 'Olympisches Gold (Lorbeer & Trophäe)',
      ar: 'الذهب الأولمبي (إكليل الغار والكأس الذهبي)'
    },
    description: {
      en: 'Prestigious radiant golden aura with double gold foil borders and championship trophy medallion',
      de: 'Edles strahlendes Gold-Design mit doppeltem Goldrahmen und Meisterschafts-Medaillon',
      ar: 'إشعاع ذهبي فاخر مع إطار مذهب مزدوج وكأس البطولة المخصص للمتفوقين الأوائل'
    },
    previewColor: '#d4af37'
  },
  islamic_heritage: {
    id: 'islamic_heritage',
    name: {
      en: 'Islamic Heritage (Arabesque & Gold)',
      de: 'Islamisches Kulturerbe (Arabeske & Gold)',
      ar: 'الأصالة والتراث الإسلامي (أرابيسك وذهب)'
    },
    description: {
      en: 'Deep royal sapphire navy with intricate Arabesque geometric stars and ornate Mashrabiya patterns',
      de: 'Tiefblaues Design mit kunstvollen arabesken Sternmustern und traditionellen Ornamenten',
      ar: 'كحلي ملكي عميق مرصع بزخارف هندسية إسلامية وأرابيسك ذهبي أصيل'
    },
    previewColor: '#0c1b33'
  },
  future_tech: {
    id: 'future_tech',
    name: {
      en: 'Cyber & Future Tech (Digital Innovation)',
      de: 'Cyber & Zukunftstechnologie (Innovation)',
      ar: 'المستقبل والذكاء الاصطناعي (سيبراني حديث)'
    },
    description: {
      en: 'Sleek dark cyan theme with futuristic circuit traces, digital grid, and verified hologram badge',
      de: 'Futuristisches Cyber-Design mit leuchtenden Leiterbahnen und verifiziertem Hologramm-Siegel',
      ar: 'تصميم تقني مستقبلي بخطوط سيبرانية وشارة هولوجرام رقمية للمهارات الحديثة'
    },
    previewColor: '#0284c7'
  },
  vintage_scroll: {
    id: 'vintage_scroll',
    name: {
      en: 'Vintage Royal Scroll (Antique Parchment)',
      de: 'Historische Schriftrolle (Pergament & Siegel)',
      ar: 'المخطوطة الأثرية الملكية (رق تاريخي وختم شمعي)'
    },
    description: {
      en: 'Warm aged parchment paper with classical baroque corners and a ruby-red wax seal with ribbon',
      de: 'Klassisches warmes Pergament-Design mit barocken Ornamenten und rubinrotem Wachssiegel',
      ar: 'خلفية رق أثري دافئ بزخارف باروكية راقية وختم شمعي قرمزي كلاسيكي'
    },
    previewColor: '#8c5835'
  }
};

export const PRIMARY_CERTIFICATE_TEMPLATES: TemplateConfig[] = [
  CERTIFICATE_TEMPLATES_CONFIG.classic,
  CERTIFICATE_TEMPLATES_CONFIG.golden_olympic,
  CERTIFICATE_TEMPLATES_CONFIG.royal_emerald,
  CERTIFICATE_TEMPLATES_CONFIG.islamic_heritage,
  CERTIFICATE_TEMPLATES_CONFIG.space_explorer,
  CERTIFICATE_TEMPLATES_CONFIG.future_tech,
  CERTIFICATE_TEMPLATES_CONFIG.vintage_scroll,
  CERTIFICATE_TEMPLATES_CONFIG.elegant,
  CERTIFICATE_TEMPLATES_CONFIG.kids,
  CERTIFICATE_TEMPLATES_CONFIG.german_themed,
  CERTIFICATE_TEMPLATES_CONFIG.modern,
  CERTIFICATE_TEMPLATES_CONFIG.boys_champion,
  CERTIFICATE_TEMPLATES_CONFIG.girls_princess
];

export const CERTIFICATE_TYPES = Object.values(CERTIFICATE_TYPES_CONFIG);

export function getCertificateDefaultText(typeKey: CertificateTypeKey, lang: CertificateLanguage = 'de') {
  const config = CERTIFICATE_TYPES_CONFIG[typeKey] || CERTIFICATE_TYPES_CONFIG.achievement;
  return {
    title: config.titles[lang] || config.titles.de,
    subtitle: config.subtitles[lang] || config.subtitles.de,
    description: config.descriptions[lang] || config.descriptions.de,
    badgeText: config.defaultBadgeText[lang] || config.defaultBadgeText.de
  };
}
