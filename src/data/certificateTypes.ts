import { CertificateTypeKey, CertificateLanguage, CertificateTemplateId } from '../types';

export interface CertificateTypeConfig {
  key: CertificateTypeKey;
  iconName: string;
  badgeEmoji: string;
  defaultBadgeText: Record<CertificateLanguage, string>;
  titles: Record<CertificateLanguage, string>;
  subtitles: Record<CertificateLanguage, string>;
  descriptions: Record<CertificateLanguage, string>;
}

export const CERTIFICATE_TYPES_CONFIG: Record<CertificateTypeKey, CertificateTypeConfig> = {
  achievement: {
    key: 'achievement',
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
  great_progress: {
    key: 'great_progress',
    iconName: 'TrendingUp',
    badgeEmoji: '📈',
    defaultBadgeText: {
      en: 'GREAT PROGRESS',
      de: 'GROSSER FORTSCHRITT',
      ar: 'تقدم متميز'
    },
    titles: {
      en: 'Great Progress Award',
      de: 'Urkunde für Großartigen Fortschritt',
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
  outstanding_performance: {
    key: 'outstanding_performance',
    iconName: 'Trophy',
    badgeEmoji: '🏆',
    defaultBadgeText: {
      en: 'TOP PERFORMER',
      de: 'SPITZENLEISTUNG',
      ar: 'أداء متميز'
    },
    titles: {
      en: 'Outstanding Performance',
      de: 'Herausragende Leistung',
      ar: 'شهادة الأداء المتميز'
    },
    subtitles: {
      en: 'For achieving the highest standard of excellence',
      de: 'Für Spitzenleistungen und erstklassige Ergebnisse',
      ar: 'لتحقيق أعلى معايير التميز والأداء الرفيع'
    },
    descriptions: {
      en: 'Awarded for demonstrating superior mastery, active participation, and exemplary performance during all lessons.',
      de: 'Verliehen für überlegene Fachkompetenz, aktive Mitarbeit und vorbildliche Leistungen in allen Unterrichtsstunden.',
      ar: 'تُمنح هذه الشهادة تقديرًا للأداء الاستثنائي والمشاركة التفاعلية البناءة والتفوق المستمر في جميع الحصص.'
    }
  },
  german_achievement: {
    key: 'german_achievement',
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
  homework_excellence: {
    key: 'homework_excellence',
    iconName: 'BookOpen',
    badgeEmoji: '📚',
    defaultBadgeText: {
      en: 'HOMEWORK HERO',
      de: 'HAUSAUFGABEN-PROFI',
      ar: 'بطل الواجبات'
    },
    titles: {
      en: 'Homework Excellence',
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
  perfect_attendance: {
    key: 'perfect_attendance',
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
      ar: 'شهادة المواظبة والالتزام'
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
  student_of_month: {
    key: 'student_of_month',
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
  appreciation: {
    key: 'appreciation',
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
  exam_result: {
    key: 'exam_result',
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
  custom: {
    key: 'custom',
    iconName: 'Sparkles',
    badgeEmoji: '✨',
    defaultBadgeText: {
      en: 'HONOR ROLL',
      de: 'EHRENURKUNDE',
      ar: 'لوحة الشرف'
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
      en: 'Awarded with high distinction in recognition of remarkable effort and admirable dedication.',
      de: 'Verliehen mit besonderer Auszeichnung für außergewöhnlichen Einsatz und beispielhafte Leistungen.',
      ar: 'تُمنح هذه الشهادة بمرتبة الشرف تقديرًا للجهد الاستثنائي والإخلاص في طلب العلم والتعلم.'
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
  neutral: {
    id: 'neutral',
    name: {
      en: 'Neutral Excellence (Official)',
      de: 'Neutrales Exzellenz-Design (Offiziell)',
      ar: 'القالب العام المحايد (رسمي فاخر)'
    },
    description: {
      en: 'Universal prestigious gold & midnight navy styling, suitable for all students',
      de: 'Universelles, edles Gold- & Marineblau-Design für alle Schülerinnen und Schüler',
      ar: 'تصميم عام راقٍ ومحايد بالذهب والكحلي الملكي، ملائم لجميع الطلاب والطالبات'
    },
    previewColor: '#0f172a'
  },
  boys: {
    id: 'boys',
    name: {
      en: 'Boys Edition (Champion Hero)',
      de: 'Jungen-Edition (Champion Held)',
      ar: 'قالب الأولاد (بطل التميز)'
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
      en: 'Girls Edition (Shining Princess)',
      de: 'Mädchen-Edition (Leuchtender Stern)',
      ar: 'قالب البنات (أميرة التفوق)'
    },
    description: {
      en: 'Graceful rose pink & pastel lavender theme with golden tiara crown and sparkles',
      de: 'Zauberhaftes Rosa- & Lavendel-Design mit goldener Krone und Glitzereffekten',
      ar: 'تصميم راقٍ ومشرق بالوردي الفاتح والبنفسجي والتاج الذهبي المخصص للبنات'
    },
    previewColor: '#db2777'
  },
  classic: {
    id: 'classic',
    name: {
      en: 'Classic Gold & Navy',
      de: 'Klassisch Gold & Marine',
      ar: 'كلاسيكي ملكي (ذهبي وكحلي)'
    },
    description: {
      en: 'Traditional prestigious diploma border with gold accents and royal seal',
      de: 'Traditioneller Diplom-Rahmen mit Goldakzenten und königlichem Siegel',
      ar: 'إطار دبلوماسي فاخر ذو أطراف مذهبة وختم ملكي تقليدي'
    },
    previewColor: '#1e3a8a'
  },
  elegant: {
    id: 'elegant',
    name: {
      en: 'Modern Emerald Luxury',
      de: 'Elegantes Smaragd-Design',
      ar: 'زمردي عصري أنيق'
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
    previewColor: '#b91c1c'
  },
  boys_champion: {
    id: 'boys_champion',
    name: {
      en: 'Champion Hero (Boys)',
      de: 'Champion Held (Jungen)',
      ar: 'بطل الإنجاز الخارق (للأولاد)'
    },
    description: {
      en: 'Bold royal blue & electric cyan theme with gold shield badge, superhero energy, and stars',
      de: 'Dynamisches Königsblau- & Cyan-Design mit goldenem Heldenschild und Sternen',
      ar: 'تصميم بطولي باللون الأزرق الملكي والسيان والدرع الذهبي المخصص للأولاد والفرسان'
    },
    previewColor: '#1d4ed8'
  },
  girls_princess: {
    id: 'girls_princess',
    name: {
      en: 'Shining Star (Girls)',
      de: 'Leuchtender Stern (Mädchen)',
      ar: 'أميرة التفوق والنجوم (للبنات)'
    },
    description: {
      en: 'Graceful rose pink & pastel lavender theme with golden tiara crown, sparkles, and floral borders',
      de: 'Zauberhaftes Rosa- & Lavendel-Design mit goldener Krone, Glitzereffekten und Blüten',
      ar: 'تصميم راقٍ ومشرق بالوردي الفاتح والبنفسجي والتاج الذهبي المرصع بالنجوم المخصص للبنات'
    },
    previewColor: '#db2777'
  }
};

export const PRIMARY_CERTIFICATE_TEMPLATES: TemplateConfig[] = [
  CERTIFICATE_TEMPLATES_CONFIG.neutral,
  CERTIFICATE_TEMPLATES_CONFIG.boys,
  CERTIFICATE_TEMPLATES_CONFIG.girls
];

export const CERTIFICATE_TYPES = Object.values(CERTIFICATE_TYPES_CONFIG);
export const CERTIFICATE_TEMPLATES = Object.values(CERTIFICATE_TEMPLATES_CONFIG);

export function getCertificateDefaultText(typeKey: CertificateTypeKey, lang: CertificateLanguage = 'de') {
  const config = CERTIFICATE_TYPES_CONFIG[typeKey] || CERTIFICATE_TYPES_CONFIG.achievement;
  return {
    title: config.titles[lang] || config.titles.de,
    subtitle: config.subtitles[lang] || config.subtitles.de,
    description: config.descriptions[lang] || config.descriptions.de,
    badgeText: config.defaultBadgeText[lang] || config.defaultBadgeText.de
  };
}

