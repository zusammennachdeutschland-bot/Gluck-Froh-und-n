import { LernstudioSet } from '../types/lernstudio.js';

const BUILTIN_CREATED_AT = '2026-02-01T00:00:00.000Z';
const BUILTIN_UPDATED_AT = 1769904000000;

export const BUILTIN_GRAMMAR_SETS: LernstudioSet[] = [
  {
    id: 'curric_grammar_personalpronomen',
    title: 'Personalpronomen (الضمائر الشخصية)',
    titleTranslations: {
      ar: 'الضمائر الشخصية (Personalpronomen)',
      de: 'Personalpronomen im Nominativ',
      en: 'Personal Pronouns (Nominative)'
    },
    topic: 'Grammatik & Satzbausteine',
    topicTranslations: {
      ar: 'القواعد وبناء الجملة',
      de: 'Grammatik & Satzbausteine',
      en: 'Grammar & Sentence Structure'
    },
    grade: 'جريد 3 (Grade 3)',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: false,
    sentenceBuilderSupported: true,
    setKind: 'grammar',
    contentOrigin: 'builtin',
    description: 'شرح شامل للضمائر الشخصية في حالة الفاعل (ich, du, er, sie, es, wir, ihr, sie, Sie) مع التمييز بين sie و Sie.',
    descriptionTranslations: {
      ar: 'شرح شامل للضمائر الشخصية مع أمثلة وتمارين تفاعلية متنوعة.',
      de: 'Alle Personalpronomen im Nominativ mit Regeln, Beispielen und Übungen.',
      en: 'Complete lesson on German nominative personal pronouns with interactive practice.'
    },
    items: [],
    grammarContent: {
      lessonTitle: 'Personalpronomen im Nominativ',
      lessonTitleAr: 'الضمائر الشخصية في حالة الفاعل',
      lessonTitleDe: 'Personalpronomen im Nominativ',
      lessonTitleEn: 'Personal Pronouns (Nominative)',
      grammarTopic: 'Personalpronomen',
      grammarTopicAr: 'الضمائر الشخصية',
      grammarTopicDe: 'Personalpronomen',
      grammarTopicEn: 'Personal Pronouns',
      origin: 'builtin',
      explanationAr:
        'تُستخدم الضمائر الشخصية لتحل محل الأسماء في الجملة. انتبه للفرق بين sie (هي للمفرد)، sie (هم/هن للجمع)، و Sie (حضرتك/حضراتكم للاحترام وتُكتب دائماً بحرف كبير S).',
      explanationDe:
        'Personalpronomen ersetzen Nomen im Subjekt (Nominativ). Achte besonders auf die drei Formen von „sie“: sie (Singular), sie (Plural) und Sie (Höflichkeitsform, immer groß).',
      explanationEn:
        'Personal pronouns replace nouns in the subject position. Pay special attention to lowercase "sie" (she / they) vs. capitalized "Sie" (formal you).',
      rules: [
        {
          id: 'rule_pp_1',
          title: 'المفرد والجمع وصيغة الاحترام',
          titleAr: 'جدول الضمائر الشخصية (المفرد / الجمع / الاحترام)',
          titleDe: 'Übersicht: Singular, Plural & Höflichkeitsform',
          titleEn: 'Overview: Singular, Plural & Formal',
          summaryAr: 'كل ضمير في اللغة الألمانية يحدد تصريف الفعل الذي يتبعه.',
          summaryDe: 'Jedes Pronomen bestimmt die passende Verbendung im Präsens.',
          summaryEn: 'Each pronoun determines the matching verb conjugation ending.',
          pattern: 'ich · du · er/sie/es | wir · ihr · sie/Sie',
          table: {
            headers: ['Deutsch', 'العربية', 'English'],
            rows: [
              ['ich', 'أنا', 'I'],
              ['du', 'أنتَ / أنتِ', 'you (singular)'],
              ['er / sie / es', 'هو / هي / للمحايد', 'he / she / it'],
              ['wir', 'نحن', 'we'],
              ['ihr', 'أنتم / أنتن', 'you (plural)'],
              ['sie / Sie', 'هم / حضرتك (احترام)', 'they / you (formal)']
            ]
          },
          tipAr: 'الأسماء مثل "Ahmed und Mona" تعادل الضمير "sie" (هم)، بينما "Ahmed und ich" تعادل "wir" (نحن).',
          tipDe: '„Ahmed und Mona“ = sie (Plural); „Ahmed und ich“ = wir.',
          tipEn: '"Ahmed and Mona" equals "sie" (they); "Ahmed and I" equals "wir" (we).'
        }
      ],
      examples: [
        {
          id: 'gex_pp_1',
          german: 'Ich lerne Deutsch in der Schule.',
          arabic: 'أنا أتعلم الألمانية في المدرسة.',
          english: 'I am learning German at school.',
          highlight: 'Ich',
          noteAr: 'الضمير ich للمتكلم المفرد'
        },
        {
          id: 'gex_pp_2',
          german: 'Das ist Mona. Sie wohnt in Kairo.',
          arabic: 'هذه منى. هي تسكن في القاهرة.',
          english: 'This is Mona. She lives in Cairo.',
          highlight: 'Sie'
        },
        {
          id: 'gex_pp_3',
          german: 'Guten Tag, Herr Omar! Woher kommen Sie?',
          arabic: 'نهارك سعيد يا أستاذ عمر! من أين حضرتك؟',
          english: 'Good day, Mr. Omar! Where do you come from?',
          highlight: 'Sie',
          noteAr: 'Sie بحرف كبير تعني حضرتك (للاحترام)'
        },
        {
          id: 'gex_pp_4',
          german: 'Ahmed und ich spielen Fußball. Wir sind im Team.',
          arabic: 'أحمد وأنا نلعب كرة القدم. نحن في الفريق.',
          english: 'Ahmed and I play football. We are in the team.',
          highlight: 'Wir'
        }
      ],
      exercises: [
        {
          id: 'gq_pp_1',
          type: 'multiple_choice',
          prompt: 'اختر الضمير الصحيح الذي يعوض عن الاسم:',
          question: 'Das ist Karim. ______ spielt gern Tennis.',
          options: ['Er', 'Sie', 'Es', 'Wir'],
          correctAnswer: 'Er',
          explanationAr: 'كريم مذكر مفرد، لذا نستخدم الضمير Er (هو).',
          explanationDe: 'Karim ist maskulin Singular -> Er.',
          source: 'original'
        },
        {
          id: 'gq_pp_2',
          type: 'fill_blank',
          prompt: 'أكمل الجملة بالضمير المناسب (مع مراعاة صيغة الجمع):',
          question: 'Ahmed und Mona sind Freunde. ______ gehen zusammen ins Kino.',
          sentenceWithBlank: 'Ahmed und Mona sind Freunde. ______ gehen zusammen ins Kino.',
          options: ['sie', 'er', 'ihr', 'ich'],
          correctAnswer: 'sie',
          acceptedAnswers: ['Sie', 'sie'],
          explanationAr: 'أحمد ومنى (جمع غائب) يُعوض عنهما بضمير الجمع sie (هم).',
          explanationDe: 'Zwei Personen (Plural) -> sie.',
          source: 'original'
        },
        {
          id: 'gq_pp_3',
          type: 'correct_mistake',
          prompt: 'صحح الضمير الخاطئ في الجملة التالية:',
          question: 'Das Buch ist neu. Er liegt auf dem Tisch.',
          faultySentence: 'Das Buch ist neu. Er liegt auf dem Tisch.',
          options: [
            'Das Buch ist neu. Es liegt auf dem Tisch.',
            'Das Buch ist neu. Sie liegt auf dem Tisch.',
            'Das Buch ist neu. Wir liegt auf dem Tisch.'
          ],
          correctAnswer: 'Das Buch ist neu. Es liegt auf dem Tisch.',
          explanationAr: 'كلمة Buch أداتها das (محايد)، لذا الضمير الصحيح هو Es وليس Er.',
          explanationDe: 'Das Buch -> Artikel „das“ -> Pronomen „es“.',
          source: 'original'
        },
        {
          id: 'gq_pp_4',
          type: 'choose_correct_sentence',
          prompt: 'اختر الجملة الصحيحة عند مخاطبة المعلم باحترام:',
          question: 'أي جملة صحيحة عند توجيه سؤال لمعلمك؟',
          options: [
            'Herr Müller, sprechen Sie Arabisch?',
            'Herr Müller, sprichst Sie Arabisch?',
            'Herr Müller, sprechen ihr Arabisch?',
            'Herr Müller, spreche du Arabisch?'
          ],
          correctAnswer: 'Herr Müller, sprechen Sie Arabisch?',
          explanationAr: 'صيغة الاحترام تتطلب الضمير Sie مع الفعل في المصدر sprechen.',
          explanationDe: 'Höflichkeitsform: Sie + Verb im Infinitiv (sprechen).',
          source: 'original'
        },
        {
          id: 'gq_pp_5',
          type: 'sentence_ordering',
          prompt: 'رتب الكلمات لتكوين جملة صحيحة:',
          question: 'نحن نتعلم اللغة الألمانية اليوم.',
          tokens: ['lernen', 'Wir', 'heute', 'Deutsch.'],
          correctAnswer: 'Wir lernen heute Deutsch.',
          explanationAr: 'الفاعل Wir في المركز الأول والفعل lernen في المركز الثاني.',
          explanationDe: 'Subjekt (Wir) auf Position 1, Verb (lernen) auf Position 2.',
          source: 'original'
        },
        {
          id: 'gq_pp_6',
          type: 'short_answer',
          prompt: 'اكتب الضمير الألماني الذي يحل محل: "Du und dein Freund"',
          question: 'Du und dein Freund = ______ (أنتم)',
          correctAnswer: 'ihr',
          acceptedAnswers: ['Ihr', 'ihr'],
          explanationAr: 'مخاطبة شخصين أو أكثر (أنت وصديقك) تُعادل الضمير ihr (أنتم).',
          explanationDe: '„Du und dein Freund“ entspricht dem Plural-Pronomen „ihr“.',
          source: 'original'
        }
      ]
    },
    createdAt: BUILTIN_CREATED_AT,
    updatedAt: BUILTIN_UPDATED_AT
  },
  {
    id: 'curric_grammar_praesens_regular',
    title: 'Präsens: Regelmäßige Verben (المضارع المنتظم)',
    titleTranslations: {
      ar: 'تصريف الأفعال المنتظمة في المضارع (Präsens)',
      de: 'Präsens: Regelmäßige Verben',
      en: 'Present Tense: Regular Verbs'
    },
    topic: 'Grammatik & Satzbausteine',
    grade: 'جريد 3 (Grade 3)',
    level: 'A1',
    difficulty: 'easy',
    setKind: 'grammar',
    contentOrigin: 'builtin',
    description: 'قاعدة نهايات الأفعال المنتظمة في المضارع (-e, -st, -t, -en, -t, -en) وحالات إضافة حرف e بعد d/t.',
    items: [],
    grammarContent: {
      lessonTitle: 'Präsens: Regelmäßige Verben',
      lessonTitleAr: 'تصريف الأفعال المنتظمة في زمن المضارع',
      lessonTitleDe: 'Präsens: Regelmäßige Verben',
      lessonTitleEn: 'Present Tense: Regular Verbs',
      grammarTopic: 'Präsens Konjugation',
      grammarTopicAr: 'المضارع البسيط',
      origin: 'builtin',
      explanationAr:
        'لتصريف الفعل المنتظم نحذف النهاية (en-) لنحصل على جذر الفعل (Verbstamm)، ثم نضيف النهاية المناسبة لكل ضمير: ich → -e، du → -st، er/sie/es → -t، wir → -en، ihr → -t، sie/Sie → -en.',
      explanationDe:
        'Bei regelmäßigen Verben streicht man „-en“ vom Infinitiv (Verbstamm) und hängt die Personalendungen an: -e, -st, -t, -en, -t, -en.',
      explanationEn:
        'To conjugate regular German verbs in the present tense, drop "-en" from the infinitive and add -e, -st, -t, -en, -t, -en.',
      rules: [
        {
          id: 'rule_pr_1',
          title: 'نهايات المضارع القياسية (مثل: lernen / spielen / wohnen)',
          titleAr: 'جدول نهايات المضارع المنتظم',
          titleDe: 'Personalendungen im Präsens',
          summaryAr: 'مثال تطبيقي على الفعل lernen (جذر الفعل: lern-).',
          pattern: 'Stamm + (-e / -st / -t / -en / -t / -en)',
          table: {
            headers: ['Pronomen', 'Endung', 'Beispiel (lernen)'],
            rows: [
              ['ich', '-e', 'lerne'],
              ['du', '-st', 'lernst'],
              ['er / sie / es', '-t', 'lernt'],
              ['wir', '-en', 'lernen'],
              ['ihr', '-t', 'lernt'],
              ['sie / Sie', '-en', 'lernen']
            ]
          },
          tipAr: 'إذا انتهى الجذر بـ t أو d مثل arbeiten، نضيف حرف e تسهيلاً للنطق مع du و er/sie/es و ihr (du arbeitest, er arbeitet).'
        }
      ],
      examples: [
        { id: 'gex_pr_1', german: 'Ich wohne in Alexandria.', arabic: 'أنا أسكن في الإسكندرية.', highlight: 'wohne' },
        { id: 'gex_pr_2', german: 'Spielst du gern Klavier?', arabic: 'هل تحب العزف على البيانو؟', highlight: 'Spielst' },
        { id: 'gex_pr_3', german: 'Sara arbeitet heute im Büro.', arabic: 'سارة تعمل اليوم في المكتب.', highlight: 'arbeitet' },
        { id: 'gex_pr_4', german: 'Die Kinder machen ihre Hausaufgaben.', arabic: 'الأطفال يؤدون واجباتهم.', highlight: 'machen' }
      ],
      exercises: [
        {
          id: 'gq_pr_1',
          type: 'multiple_choice',
          prompt: 'اختر التصريف الصحيح مع الضمير du:',
          question: 'Wo ______ (wohnen) du jetzt?',
          options: ['wohnst', 'wohne', 'wohnt', 'wohnen'],
          correctAnswer: 'wohnst',
          explanationAr: 'مع الضمير du نضيف النهاية -st لجذر الفعل wohn ← wohnst.',
          source: 'original'
        },
        {
          id: 'gq_pr_2',
          type: 'fill_blank',
          prompt: 'أكمل الفعل مع مراعاة نهاية الجذر t:',
          question: 'Mein Vater ______ (arbeiten) in einer Bank.',
          sentenceWithBlank: 'Mein Vater ______ (arbeiten) in einer Bank.',
          options: ['arbeitet', 'arbeitt', 'arbeitest', 'arbeiten'],
          correctAnswer: 'arbeitet',
          explanationAr: 'جذر arbeit ينتهي بـ t، لذا نضيف -et مع er (Mein Vater) ← arbeitet.',
          source: 'original'
        },
        {
          id: 'gq_pr_3',
          type: 'correct_mistake',
          prompt: 'صحح الفعل في الجملة:',
          question: 'Wir lernst heute neue Wörter.',
          faultySentence: 'Wir lernst heute neue Wörter.',
          options: [
            'Wir lernen heute neue Wörter.',
            'Wir lernt heute neue Wörter.',
            'Wir lerne heute neue Wörter.'
          ],
          correctAnswer: 'Wir lernen heute neue Wörter.',
          explanationAr: 'الضمير wir يأخذ النهاية -en وليس -st.',
          source: 'original'
        },
        {
          id: 'gq_pr_4',
          type: 'choose_correct_sentence',
          prompt: 'اختر الجملة الصحيحة نحوياً:',
          question: 'أي جملة صحيحة مع الفاعل "Ihr"؟',
          options: [
            'Ihr spielt sehr gut Fußball.',
            'Ihr spielen sehr gut Fußball.',
            'Ihr spielst sehr gut Fußball.',
            'Ihr spiele sehr gut Fußball.'
          ],
          correctAnswer: 'Ihr spielt sehr gut Fußball.',
          explanationAr: 'مع الضمير ihr (أنتم) يأخذ الفعل النهاية -t ← spielt.',
          source: 'original'
        },
        {
          id: 'gq_pr_5',
          type: 'sentence_ordering',
          prompt: 'رتب الكلمات لتكوين جملة ألمانية صحيحة:',
          question: 'منى تشتري اليوم كتاباً.',
          tokens: ['ein Buch.', 'kauft', 'heute', 'Mona'],
          correctAnswer: 'Mona kauft heute ein Buch.',
          explanationAr: 'Mona (= sie) تأخذ kauft في المركز الثاني.',
          source: 'original'
        },
        {
          id: 'gq_pr_6',
          type: 'short_answer',
          prompt: 'صرّف الفعل (kommen) مع الفاعل (du und ich):',
          question: 'Du und ich ______ (kommen) pünktlich zur Schule.',
          correctAnswer: 'kommen',
          explanationAr: '"Du und ich" تساوي wir، ومع wir يبقى الفعل بالنهاية -en: kommen.',
          source: 'original'
        }
      ]
    },
    createdAt: BUILTIN_CREATED_AT,
    updatedAt: BUILTIN_UPDATED_AT
  },
  {
    id: 'curric_grammar_sein_haben',
    title: 'Verben „sein“ und „haben“ (أفعال الكينونة والملكية)',
    titleTranslations: {
      ar: 'أهم فعلين في الألمانية: sein و haben',
      de: 'Die Verben „sein“ und „haben“ im Präsens',
      en: 'The Verbs "sein" and "haben"'
    },
    topic: 'Grammatik & Satzbausteine',
    grade: 'جريد 2 (Grade 2)',
    level: 'A1',
    difficulty: 'easy',
    setKind: 'grammar',
    contentOrigin: 'builtin',
    description: 'تصريف الفعلين غير المنتظمين sein (يكون) و haben (يمتلك) في المضارع مع جمل تطبيقية.',
    items: [],
    grammarContent: {
      lessonTitle: 'sein und haben im Präsens',
      lessonTitleAr: 'الفعلان sein (يكون) و haben (يمتلك)',
      grammarTopic: 'sein & haben',
      origin: 'builtin',
      explanationAr:
        'الفعلان sein (يكون) و haben (يمتلك) هما أكثر الأفعال استخداماً في اللغة الألمانية، وتصريفهما غير منتظم ويجب حفظه جيداً.',
      explanationDe:
        '„sein“ und „haben“ sind unregelmäßige Grundverben, die in fast jedem deutschen Gespräch vorkommen.',
      rules: [
        {
          id: 'rule_sh_1',
          title: 'تصريف sein و haben في المضارع',
          titleAr: 'جدول تصريف sein (يكون) و haben (يمتلك)',
          summaryAr: 'لاحظ تغير جذر الفعل كلياً في sein، وحذف b مع du و er/sie/es في haben.',
          table: {
            headers: ['Pronomen', 'sein (يكون)', 'haben (يمتلك)'],
            rows: [
              ['ich', 'bin', 'habe'],
              ['du', 'bist', 'hast'],
              ['er / sie / es', 'ist', 'hat'],
              ['wir', 'sind', 'haben'],
              ['ihr', 'seid', 'habt'],
              ['sie / Sie', 'sind', 'haben']
            ]
          },
          tipAr: 'احذر الخلط بين seid (مع الضمير ihr أنتم) و seit (منذ الزمنية).'
        }
      ],
      examples: [
        { id: 'gex_sh_1', german: 'Ich bin Schüler und habe zwei Brüder.', arabic: 'أنا طالب ولدي شقيقان.', highlight: 'bin / habe' },
        { id: 'gex_sh_2', german: 'Du bist sehr fleißig heute!', arabic: 'أنت مجتهد جداً اليوم!', highlight: 'bist' },
        { id: 'gex_sh_3', german: 'Meine Schwester hat eine Katze.', arabic: 'أختي لديها قطة.', highlight: 'hat' },
        { id: 'gex_sh_4', german: 'Seid ihr morgen zu Hause?', arabic: 'هل أنتم في المنزل غداً؟', highlight: 'Seid' }
      ],
      exercises: [
        {
          id: 'gq_sh_1',
          type: 'multiple_choice',
          prompt: 'اختر التصريف الصحيح للفعل sein:',
          question: 'Mein Bruder ______ 10 Jahre alt.',
          options: ['ist', 'bist', 'sind', 'bin'],
          correctAnswer: 'ist',
          explanationAr: 'Mein Bruder يعادل الضمير er، وتصريف sein معه هو ist.',
          source: 'original'
        },
        {
          id: 'gq_sh_2',
          type: 'multiple_choice',
          prompt: 'اختر التصريف الصحيح للفعل haben:',
          question: '______ du heute Zeit für ein Spiel?',
          options: ['Hast', 'Habst', 'Hat', 'Haben'],
          correctAnswer: 'Hast',
          explanationAr: 'مع du يتغير haben إلى hast (بدون حرف b).',
          source: 'original'
        },
        {
          id: 'gq_sh_3',
          type: 'fill_blank',
          prompt: 'أكمل الجملة بفعل الكينونة المناسب (مع الجمع):',
          question: 'Wir ______ sehr glücklich in unserer Klasse.',
          sentenceWithBlank: 'Wir ______ sehr glücklich in unserer Klasse.',
          options: ['sind', 'seid', 'bin', 'ist'],
          correctAnswer: 'sind',
          explanationAr: 'مع wir يكون تصريف sein دائماً sind.',
          source: 'original'
        },
        {
          id: 'gq_sh_4',
          type: 'correct_mistake',
          prompt: 'صحح الخطأ في تصريف الفعل:',
          question: 'Ihr sind meine besten Freunde.',
          faultySentence: 'Ihr sind meine besten Freunde.',
          options: [
            'Ihr seid meine besten Freunde.',
            'Ihr bist meine besten Freunde.',
            'Ihr ist meine besten Freunde.'
          ],
          correctAnswer: 'Ihr seid meine besten Freunde.',
          explanationAr: 'الضمير ihr يأخذ seid وليس sind.',
          source: 'original'
        },
        {
          id: 'gq_sh_5',
          type: 'sentence_ordering',
          prompt: 'رتب الكلمات لتكوين جملة صحيحة:',
          question: 'سارة لديها حقيبة مدرسية زرقاء.',
          tokens: ['eine', 'hat', 'blaue', 'Sara', 'Schultasche.'],
          correctAnswer: 'Sara hat eine blaue Schultasche.',
          explanationAr: 'الفاعل Sara ثم الفعل hat في المركز الثاني.',
          source: 'original'
        },
        {
          id: 'gq_sh_6',
          type: 'short_answer',
          prompt: 'أكمل بالفعل الصحيح (sein):',
          question: 'Entschuldigung, ______ Sie Herr Karim?',
          correctAnswer: 'sind',
          explanationAr: 'مع صيغة الاحترام Sie يكون تصريف sein هو sind.',
          source: 'original'
        }
      ]
    },
    createdAt: BUILTIN_CREATED_AT,
    updatedAt: BUILTIN_UPDATED_AT
  },
  {
    id: 'curric_grammar_artikel_der_die_das',
    title: 'Bestimmte & unbestimmte Artikel (أدوات التعريف والتنكير)',
    titleTranslations: {
      ar: 'أدوات التعريف والتنكير (der/die/das & ein/eine)',
      de: 'Bestimmte und unbestimmte Artikel',
      en: 'Definite and Indefinite Articles'
    },
    topic: 'Grammatik & Satzbausteine',
    grade: 'جريد 3 (Grade 3)',
    level: 'A1',
    difficulty: 'medium',
    setKind: 'grammar',
    contentOrigin: 'builtin',
    description: 'الفرق بين أدوات التعريف (der, die, das, die Pl.) وأدوات التنكير (ein, eine, ein) ومتى نستخدم كلاً منهما.',
    items: [],
    grammarContent: {
      lessonTitle: 'Bestimmte und unbestimmte Artikel',
      lessonTitleAr: 'أدوات التعريف والتنكير في حالة الرفع (Nominativ)',
      grammarTopic: 'Artikel (der/die/das & ein/eine)',
      origin: 'builtin',
      explanationAr:
        'الاسم في الألمانية يُكتب دائماً بحرف كبير (Großbuchstabe) وله أداة جنس نحوي: المذكر (der → ein)، المؤنث (die → eine)، المحايد (das → ein)، أما الجمع فله أداة تعريف die ولا توجد له أداة تنكير.',
      rules: [
        {
          id: 'rule_art_1',
          title: 'مقارنة أدوات التعريف والتنكير',
          titleAr: 'جدول أدوات التعريف والتنكير في حالة Nominativ',
          summaryAr: 'نستخدم أداة التنكير عند ذكر الشيء لأول مرة، وأداة التعريف عندما يكون معروفاً أو محدداً.',
          table: {
            headers: ['Genus (الجنس)', 'Bestimmt (التعريف)', 'Unbestimmt (التنكير)', 'Beispiel'],
            rows: [
              ['Maskulin (مذكر)', 'der', 'ein', 'der Tisch / ein Tisch'],
              ['Feminin (مؤنث)', 'die', 'eine', 'die Lampe / eine Lampe'],
              ['Neutral (محايد)', 'das', 'ein', 'das Buch / ein Buch'],
              ['Plural (الجمع)', 'die', '— (لا يوجد)', 'die Bücher / Bücher']
            ]
          },
          tipAr: 'كل الكلمات التي تنتهي بـ -ung أو -heit أو -keit أو -schaft مؤنثة (die).'
        }
      ],
      examples: [
        { id: 'gex_art_1', german: 'Das ist ein Stuhl. Der Stuhl ist braun.', arabic: 'هذا كرسي. الكرسي بني اللون.', highlight: 'ein / Der' },
        { id: 'gex_art_2', german: 'Hier liegt eine Tasche. Die Tasche ist groß.', arabic: 'هنا توجد حقيبة. الحقيبة كبيرة.', highlight: 'eine / Die' },
        { id: 'gex_art_3', german: 'Das Kind liest ein Buch.', arabic: 'الطفل يقرأ كتاباً.', highlight: 'Das / ein' },
        { id: 'gex_art_4', german: 'Auf dem Tisch liegen Stifte.', arabic: 'على الطاولة توجد أقلام.', highlight: 'Stifte', noteAr: 'الجمع النكرة يأتي بدون أداة' }
      ],
      exercises: [
        {
          id: 'gq_art_1',
          type: 'multiple_choice',
          prompt: 'اختر أداة التنكير المناسبة (كلمة Schule أداتها die):',
          question: 'In unserer Straße gibt es ______ Schule.',
          options: ['eine', 'ein', 'der', 'das'],
          correctAnswer: 'eine',
          explanationAr: 'كلمة Schule مؤنثة (die Schule)، لذا أداة التنكير هي eine.',
          source: 'original'
        },
        {
          id: 'gq_art_2',
          type: 'fill_blank',
          prompt: 'أكمل بأداة التعريف المناسبة لكلمة Buch (المحايد):',
          question: '______ Buch auf dem Tisch ist sehr interessant.',
          sentenceWithBlank: '______ Buch auf dem Tisch ist sehr interessant.',
          options: ['Das', 'Der', 'Die', 'Ein'],
          correctAnswer: 'Das',
          explanationAr: 'كلمة Buch أداة تعريفها das (في بداية الجملة: Das).',
          source: 'original'
        },
        {
          id: 'gq_art_3',
          type: 'correct_mistake',
          prompt: 'صحح الخطأ في أداة التنكير (Tisch أداتها der):',
          question: 'Im Zimmer steht eine Tisch.',
          faultySentence: 'Im Zimmer steht eine Tisch.',
          options: [
            'Im Zimmer steht ein Tisch.',
            'Im Zimmer steht das Tisch.',
            'Im Zimmer steht die Tisch.'
          ],
          correctAnswer: 'Im Zimmer steht ein Tisch.',
          explanationAr: 'كلمة Tisch مذكر (der Tisch) فتأخذ ein وليس eine.',
          source: 'original'
        },
        {
          id: 'gq_art_4',
          type: 'choose_correct_sentence',
          prompt: 'اختر الجملة الصحيحة للجمع النكرة:',
          question: 'أي جملة صحيحة للجمع غير المعرّف (أقلام)؟',
          options: [
            'Das sind Stifte.',
            'Das sind ein Stifte.',
            'Das sind eine Stifte.',
            'Das sind der Stifte.'
          ],
          correctAnswer: 'Das sind Stifte.',
          explanationAr: 'الجمع النكرة في الألمانية لا يأخذ ein أو eine أبداً.',
          source: 'original'
        },
        {
          id: 'gq_art_5',
          type: 'sentence_ordering',
          prompt: 'رتب الكلمات لتكوين جملة صحيحة:',
          question: 'المعلمة تشرح قاعدة جديدة.',
          tokens: ['Die Lehrerin', 'erklärt', 'eine neue', 'Regel.'],
          correctAnswer: 'Die Lehrerin erklärt eine neue Regel.',
          explanationAr: 'المؤنث المفرد المعرف Die Lehrerin والنكرة eine neue Regel.',
          source: 'original'
        },
        {
          id: 'gq_art_6',
          type: 'short_answer',
          prompt: 'اكتب أداة التعريف الصحيحة لكلمة Zeitung (مؤنث -ung):',
          question: '______ Zeitung liegt auf dem Sofa.',
          correctAnswer: 'Die',
          acceptedAnswers: ['die', 'Die'],
          explanationAr: 'الأسماء المنتهية بـ -ung أداتها دائماً die.',
          source: 'original'
        }
      ]
    },
    createdAt: BUILTIN_CREATED_AT,
    updatedAt: BUILTIN_UPDATED_AT
  },
  {
    id: 'curric_grammar_negation_nicht_kein',
    title: 'Negation: „nicht“ und „kein“ (أسلوب النفي)',
    titleTranslations: {
      ar: 'النفي في الألمانية: الفرق بين nicht و kein',
      de: 'Negation mit „nicht“ und „kein“',
      en: 'Negation with "nicht" and "kein"'
    },
    topic: 'Grammatik & Satzbausteine',
    grade: 'جريد 4 (Grade 4)',
    level: 'A1',
    difficulty: 'medium',
    setKind: 'grammar',
    contentOrigin: 'builtin',
    description: 'متى نستخدم kein/keine لنفي الأسماء النكرة ومتى نستخدم nicht لنفي الأفعال والصفات والمعارف.',
    items: [],
    grammarContent: {
      lessonTitle: 'Negation: nicht und kein',
      lessonTitleAr: 'النفي باستخدام nicht و kein / keine',
      grammarTopic: 'Negation',
      origin: 'builtin',
      explanationAr:
        'في الألمانية نستخدم kein / keine لنفي الأسماء التي تأتي بدون أداة تعريف أو مع أداة النكرة (ein / eine ← kein / keine)، ونستخدم nicht لنفي الأفعال والصفات والأسماء المعرّفة وجميع العبارات الأخرى.',
      rules: [
        {
          id: 'rule_neg_1',
          title: 'القاعدة الذهبية للتمييز بين kein و nicht',
          titleAr: 'متى أختار kein ومتى أختار nicht؟',
          summaryAr: 'kein تنفي الاسم النكرة وتتغير نهايتها حسب الأداة؛ nicht تنفي الفعل أو الصفة أو الجار والمجرور.',
          table: {
            headers: ['نوع العنصر المنفي', 'أداة النفي', 'مثال'],
            rows: [
              ['اسم مذكر/محايد نكرة (ein)', 'kein', 'Das ist kein Buch.'],
              ['اسم مؤنث نكرة / جمع نكرة', 'keine', 'Ich habe keine Zeit. / keine Geschwister'],
              ['فعل أو جملة كاملة', 'nicht', 'Ich komme heute nicht.'],
              ['صفة أو ظرف أو حرف جر', 'nicht', 'Das Wetter ist nicht kalt.']
            ]
          },
          tipAr: 'تذكّر: ein تتحول دائماً إلى kein، و eine تتحول دائماً إلى keine!'
        }
      ],
      examples: [
        { id: 'gex_neg_1', german: 'Ich trinke keinen Kaffee, sondern Tee.', arabic: 'أنا لا أشرب قهوة، بل شاي.', highlight: 'keinen' },
        { id: 'gex_neg_2', german: 'Das Zimmer ist nicht groß.', arabic: 'الغرفة ليست كبيرة.', highlight: 'nicht' },
        { id: 'gex_neg_3', german: 'Wir haben heute keine Schule.', arabic: 'ليس لدينا مدرسة اليوم.', highlight: 'keine' },
        { id: 'gex_neg_4', german: 'Er wohnt nicht in Berlin.', arabic: 'هو لا يسكن في برلين.', highlight: 'nicht' }
      ],
      exercises: [
        {
          id: 'gq_neg_1',
          type: 'multiple_choice',
          prompt: 'اختر أداة النفي المناسبة قبل الاسم النكرة (Zeit = مؤنث die):',
          question: 'Tut mir leid, ich habe heute ______ Zeit.',
          options: ['keine', 'nicht', 'kein', 'neins'],
          correctAnswer: 'keine',
          explanationAr: 'كلمة Zeit اسم مؤنث نكرة، لذا ننفيها بـ keine.',
          source: 'original'
        },
        {
          id: 'gq_neg_2',
          type: 'multiple_choice',
          prompt: 'اختر أداة النفي الصحيحة قبل الصفة (teuer):',
          question: 'Die Jacke gefällt mir, sie ist ______ teuer.',
          options: ['nicht', 'kein', 'keine', 'keinen'],
          correctAnswer: 'nicht',
          explanationAr: 'كلمة teuer صفة (غالي)، والصفات تُنفى دائماً بـ nicht.',
          source: 'original'
        },
        {
          id: 'gq_neg_3',
          type: 'fill_blank',
          prompt: 'أكمل أداة النفي للاسم المحايد (ein Auto → ______ Auto):',
          question: 'Familie Adel hat ______ Auto.',
          sentenceWithBlank: 'Familie Adel hat ______ Auto.',
          options: ['kein', 'keine', 'nicht', 'keinen'],
          correctAnswer: 'kein',
          explanationAr: 'Auto أداة تعريفها das (نكرة ein Auto)، ونفيها في المنصوب والمرفوع kein.',
          source: 'original'
        },
        {
          id: 'gq_neg_4',
          type: 'correct_mistake',
          prompt: 'صحح أداة النفي في الجملة:',
          question: 'Ich spreche kein Spanisch. -> هل هذه صحيحة؟ صحح: Der Film ist kein interessant.',
          faultySentence: 'Der Film ist kein interessant.',
          options: [
            'Der Film ist nicht interessant.',
            'Der Film ist keine interessant.',
            'Der Film ist keinen interessant.'
          ],
          correctAnswer: 'Der Film ist nicht interessant.',
          explanationAr: 'interessant صفة، فلا يمكن نفيها بـ kein بل بـ nicht.',
          source: 'original'
        },
        {
          id: 'gq_neg_5',
          type: 'sentence_ordering',
          prompt: 'رتب الكلمات لتكوين جملة منفية صحيحة:',
          question: 'أنا لا أسكن في ميونخ.',
          tokens: ['wohne', 'in München.', 'nicht', 'Ich'],
          correctAnswer: 'Ich wohne nicht in München.',
          explanationAr: 'nicht تأتي بعد الفعل وقبل الجار والمجرور (in München).',
          source: 'original'
        },
        {
          id: 'gq_neg_6',
          type: 'short_answer',
          prompt: 'اكتب الجملة منفية (Das ist ein Apfel.):',
          question: 'انفِ الجملة: Das ist ______ Apfel.',
          correctAnswer: 'kein',
          explanationAr: 'نفي ein Apfel هو kein Apfel.',
          source: 'original'
        }
      ]
    },
    createdAt: BUILTIN_CREATED_AT,
    updatedAt: BUILTIN_UPDATED_AT
  },
  {
    id: 'curric_grammar_akkusativ',
    title: 'Der Akkusativ (حالة المفعول به / النصب)',
    titleTranslations: {
      ar: 'حالة المفعول به (Akkusativ): der → den / ein → einen',
      de: 'Der Akkusativ (Bestimmt & Unbestimmt)',
      en: 'The Accusative Case'
    },
    topic: 'Grammatik & Satzbausteine',
    grade: 'جريد 5 (Grade 5)',
    level: 'A1',
    difficulty: 'medium',
    setKind: 'grammar',
    contentOrigin: 'builtin',
    description: 'تغيّر أداة المذكر فقط في حالة المفعول به (der → den, ein → einen, kein → keinen) مع أشهر أفعال Akkusativ.',
    items: [],
    grammarContent: {
      lessonTitle: 'Der Akkusativ im Deutschen',
      lessonTitleAr: 'المفعول به (Akkusativ) وتغيّر أداة المذكر فقط',
      grammarTopic: 'Akkusativ',
      origin: 'builtin',
      explanationAr:
        'في حالة المفعول به (Akkusativ) يتغيّر المذكر المفرد فقط: der تصبح den، و ein تصبح einen، و kein تصبح keinen. أما المؤنث (die/eine) والمحايد (das/ein) والجمع (die) فتبقى كما هي بدون أي تغيير!',
      rules: [
        {
          id: 'rule_akk_1',
          title: 'تغييرات الأدوات في حالة Akkusativ',
          titleAr: 'جدول تغيّر الأدوات في Akkusativ',
          summaryAr: 'التغيير الوحيد يحدث للمذكر (Maskulin) فقط!',
          table: {
            headers: ['الجنس', 'Nominativ (فاعل)', 'Akkusativ (مفعول به)'],
            rows: [
              ['Maskulin (مذكر)', 'der / ein / kein', 'den / einen / keinen'],
              ['Feminin (مؤنث)', 'die / eine / keine', 'die / eine / keine'],
              ['Neutral (محايد)', 'das / ein / kein', 'das / ein / kein'],
              ['Plural (الجمع)', 'die / keine', 'die / keine']
            ]
          },
          tipAr: 'أشهر الأفعال التي تطلب مفعولاً به (Akkusativ): haben, kaufen, suchen, brauchen, essen, trinken, lesen, sehen, lieben, besuchen.'
        }
      ],
      examples: [
        { id: 'gex_akk_1', german: 'Ich brauche einen Stift.', arabic: 'أنا أحتاج إلى قلم.', highlight: 'einen' },
        { id: 'gex_akk_2', german: 'Er kauft den Pullover für seinen Bruder.', arabic: 'هو يشتري البلوفر لأخيه.', highlight: 'den' },
        { id: 'gex_akk_3', german: 'Wir suchen eine Wohnung und ein Sofa.', arabic: 'نحن نبحث عن شقة وأريكة.', highlight: 'eine / ein' },
        { id: 'gex_akk_4', german: 'Sie hat keinen Hund.', arabic: 'هي ليس لديها كلب.', highlight: 'keinen' }
      ],
      exercises: [
        {
          id: 'gq_akk_1',
          type: 'multiple_choice',
          prompt: 'اختر الأداة الصحيحة (كلمة Apfel مذكر der Apfel):',
          question: 'Lukas isst jeden Tag ______ Apfel.',
          options: ['einen', 'ein', 'eine', 'der'],
          correctAnswer: 'einen',
          explanationAr: 'الفعل essen يطلب Akkusativ، و Apfel مذكر، لذا ein تصبح einen.',
          source: 'original'
        },
        {
          id: 'gq_akk_2',
          type: 'fill_blank',
          prompt: 'أكمل بأداة التعريف الصحيحة (Lehrer مذكر der Lehrer):',
          question: 'Die Schüler fragen ______ Lehrer.',
          sentenceWithBlank: 'Die Schüler fragen ______ Lehrer.',
          options: ['den', 'der', 'die', 'das'],
          correctAnswer: 'den',
          explanationAr: 'Die Schüler هم الفاعل، و Lehrer هو المفعول به المذكر فتصبح أداته den.',
          source: 'original'
        },
        {
          id: 'gq_akk_3',
          type: 'correct_mistake',
          prompt: 'صحح الجملة التالية (Film مذكر der Film):',
          question: 'Wir sehen heute der Film im Kino.',
          faultySentence: 'Wir sehen heute der Film im Kino.',
          options: [
            'Wir sehen heute den Film im Kino.',
            'Wir sehen heute das Film im Kino.',
            'Wir sehen heute ein Film im Kino.'
          ],
          correctAnswer: 'Wir sehen heute den Film im Kino.',
          explanationAr: 'الفعل sehen ينصب المفعول به، والمذكر der يتحول إلى den.',
          source: 'original'
        },
        {
          id: 'gq_akk_4',
          type: 'choose_correct_sentence',
          prompt: 'اختر الجملة الصحيحة نحوياً (Tisch مذكر، Lampe مؤنث):',
          question: 'أي جملة صحيحة نحوياً؟',
          options: [
            'Ich kaufe einen Tisch und eine Lampe.',
            'Ich kaufe ein Tisch und einen Lampe.',
            'Ich kaufe einen Tisch und ein Lampe.',
            'Ich kaufe der Tisch und die Lampe.'
          ],
          correctAnswer: 'Ich kaufe einen Tisch und eine Lampe.',
          explanationAr: 'Tisch مذكر منصوب ← einen، و Lampe مؤنث يبقى كما هو ← eine.',
          source: 'original'
        },
        {
          id: 'gq_akk_5',
          type: 'sentence_ordering',
          prompt: 'رتب الكلمات لتكوين جملة مفعول به صحيحة:',
          question: 'سلمى لديها حقيبة بنية.',
          tokens: ['hat', 'Salma', 'braune', 'eine', 'Tasche.'],
          correctAnswer: 'Salma hat eine braune Tasche.',
          explanationAr: 'Tasche مؤنث لذا تبقى eine كما هي في Akkusativ.',
          source: 'original'
        },
        {
          id: 'gq_akk_6',
          type: 'short_answer',
          prompt: 'اكتب أداة النفي الصحيحة في Akkusativ (der Computer):',
          question: 'Omar hat ______ Computer im Zimmer.',
          correctAnswer: 'keinen',
          explanationAr: 'Computer مذكر (der)، فيصبح في النفي المنصوب keinen.',
          source: 'original'
        }
      ]
    },
    createdAt: BUILTIN_CREATED_AT,
    updatedAt: BUILTIN_UPDATED_AT
  },
  {
    id: 'curric_grammar_modalverben',
    title: 'Modalverben: können, müssen, wollen (الأفعال الناقصة)',
    titleTranslations: {
      ar: 'الأفعال الناقصة (Modalverben) وتركيب الإطار الجُملي',
      de: 'Modalverben im Präsens (Satzklammer)',
      en: 'Modal Verbs & Sentence Bracket'
    },
    topic: 'Grammatik & Satzbausteine',
    grade: 'جريد 6 (Grade 6)',
    level: 'A2',
    difficulty: 'medium',
    setKind: 'grammar',
    contentOrigin: 'builtin',
    description: 'تصريف können و müssen و wollen في المضارع وقاعدة وضع الفعل الثاني في المصدر بنهاية الجملة (Satzklammer).',
    items: [],
    grammarContent: {
      lessonTitle: 'Modalverben im Präsens',
      lessonTitleAr: 'الأفعال الناقصة (können / müssen / wollen) وقاعدة الإطار',
      grammarTopic: 'Modalverben',
      origin: 'builtin',
      explanationAr:
        'تُصرف الأفعال الناقصة في المركز الثاني، ويكون تصريف ich و er/sie/es متطابقاً وبدون أي نهاية! أما الفعل الأساسي فيأتي في المصدر (Infinitiv) في نهاية الجملة تماماً.',
      rules: [
        {
          id: 'rule_mod_1',
          title: 'تصريف أشهر الأفعال الناقصة وترتيب الجملة',
          titleAr: 'جدول تصريف können / müssen / wollen',
          summaryAr: 'ich و er/sie/es دائماً متماثلان! والفعل الثاني في آخر الجملة في المصدر.',
          pattern: 'Subjekt + Modalverb (Pos. 2) + ... + Infinitiv (Ende)',
          table: {
            headers: ['Pronomen', 'können (يستطيع)', 'müssen (يجب)', 'wollen (يريد)'],
            rows: [
              ['ich / er / sie / es', 'kann', 'muss', 'will'],
              ['du', 'kannst', 'musst', 'willst'],
              ['wir / sie / Sie', 'können', 'müssen', 'wollen'],
              ['ihr', 'könnt', 'müsst', 'wollt']
            ]
          },
          tipAr: 'انتبه: الأفعال الناقصة تفقد نقطتي الأوملاوت في المفرد (ich kann / muss / will) وتستعيدهما في الجمع (wir können / müssen).'
        }
      ],
      examples: [
        { id: 'gex_mod_1', german: 'Ich kann sehr gut schwimmen.', arabic: 'أستطيع السباحة جيداً جداً.', highlight: 'kann ... schwimmen' },
        { id: 'gex_mod_2', german: 'Wir müssen heute für die Prüfung lernen.', arabic: 'يجب علينا المذاكرة للامتحان اليوم.', highlight: 'müssen ... lernen' },
        { id: 'gex_mod_3', german: 'Willst du am Wochenende mitkommen?', arabic: 'هل تريد أن تأتي معنا في عطلة نهاية الأسبوع؟', highlight: 'Willst ... mitkommen' }
      ],
      exercises: [
        {
          id: 'gq_mod_1',
          type: 'multiple_choice',
          prompt: 'اختر التصريف الصحيح للفعل können:',
          question: 'Ali ______ schon sehr gut Deutsch sprechen.',
          options: ['kann', 'kannst', 'können', 'könnt'],
          correctAnswer: 'kann',
          explanationAr: 'مع المفرد الغائب Ali (= er) تكون الصيغة kann بدون نهاية.',
          source: 'original'
        },
        {
          id: 'gq_mod_2',
          type: 'fill_blank',
          prompt: 'تذكّر قاعدة نهاية الجملة (الإطار):',
          question: 'Am Abend müssen die Kinder früh ______ (schlafen).',
          sentenceWithBlank: 'Am Abend müssen die Kinder früh ______.',
          options: ['schlafen', 'schläft', 'schlafst', 'schlafe'],
          correctAnswer: 'schlafen',
          explanationAr: 'وجود الفعل الناقص müssen يوجب بقاء الفعل الأساسي في المصدر (schlafen) آخر الجملة.',
          source: 'original'
        },
        {
          id: 'gq_mod_3',
          type: 'correct_mistake',
          prompt: 'صحح الجملة التالية:',
          question: 'Ich will fahre morgen nach Luxor.',
          faultySentence: 'Ich will fahre morgen nach Luxor.',
          options: [
            'Ich will morgen nach Luxor fahren.',
            'Ich willst morgen nach Luxor fahren.',
            'Ich wollen morgen nach Luxor fahre.'
          ],
          correctAnswer: 'Ich will morgen nach Luxor fahren.',
          explanationAr: 'الفعل الأساسي يجب أن يذهب إلى نهاية الجملة في صيغة المصدر fahren.',
          source: 'original'
        },
        {
          id: 'gq_mod_4',
          type: 'choose_correct_sentence',
          prompt: 'اختر الجملة المرتبة بشكل سليم:',
          question: 'أي جملة تتبع قاعدة Modalverb + Infinitiv؟',
          options: [
            'Musst du heute dein Zimmer aufräumen?',
            'Musst du heute räumst dein Zimmer auf?',
            'Muss du heute dein Zimmer aufräumen?',
            'Musst du aufräumen heute dein Zimmer?'
          ],
          correctAnswer: 'Musst du heute dein Zimmer aufräumen?',
          explanationAr: 'مع du التصريف musst وفي نهاية السؤال المصدر aufräumen.',
          source: 'original'
        },
        {
          id: 'gq_mod_5',
          type: 'sentence_ordering',
          prompt: 'رتب الجملة باستخدام إطار الجملة الألماني:',
          question: 'نحن نريد أن نلعب كرة القدم معاً.',
          tokens: ['wollen', 'Wir', 'Fußball', 'zusammen', 'spielen.'],
          correctAnswer: 'Wir wollen zusammen Fußball spielen.',
          acceptedAnswers: ['Wir wollen Fußball zusammen spielen.'],
          explanationAr: 'الفعل الناقص wollen في المركز الثاني والمصدر spielen في النهاية.',
          source: 'original'
        },
        {
          id: 'gq_mod_6',
          type: 'short_answer',
          prompt: 'صرّف الفعل (müssen) مع الضمير (ich):',
          question: 'Ich ______ jetzt nach Hause gehen.',
          correctAnswer: 'muss',
          explanationAr: 'مع ich والضمير الغائب يصبح müssen ← muss.',
          source: 'original'
        }
      ]
    },
    createdAt: BUILTIN_CREATED_AT,
    updatedAt: BUILTIN_UPDATED_AT
  },
  {
    id: 'curric_grammar_wortstellung_fragen',
    title: 'Satzbau: Aussagesatz, W-Frage & Ja/Nein-Frage (ترتيب الجملة والسؤال)',
    titleTranslations: {
      ar: 'ترتيب الجملة الخبرية وأنواع الأسئلة (W-Fragen / Ja-Nein-Fragen)',
      de: 'Satzbau: Aussagesatz, W-Frage und Ja/Nein-Frage',
      en: 'Word Order: Statements & Questions'
    },
    topic: 'Grammatik & Satzbausteine',
    grade: 'جريد 4 (Grade 4)',
    level: 'A1',
    difficulty: 'easy',
    setKind: 'grammar',
    contentOrigin: 'builtin',
    description: 'القاعدة الذهبية لموقع الفعل في الجملة الخبرية (Pos. 2)، سؤال أداة الاستفهام (Pos. 2)، وسؤال هل (Pos. 1).',
    items: [],
    grammarContent: {
      lessonTitle: 'Satzbau und Fragetypen',
      lessonTitleAr: 'بناء الجملة الخبرية والسؤال بـ W والسؤال بـ هل',
      grammarTopic: 'Satzbau & Fragen',
      origin: 'builtin',
      explanationAr:
        'في اللغة الألمانية موقع الفعل المُصرّف ثابت جداً: يأتي الفعل في المركز الثاني (Position 2) في الجملة الخبرية وسؤال W-Frage، بينما يأتي الفعل في المركز الأول (Position 1) عند تكوين سؤال بمعنى هل (Ja/Nein-Frage).',
      rules: [
        {
          id: 'rule_wb_1',
          title: 'مواقع الفعل الثلاثة الأساسية',
          titleAr: 'قاعدة المركز الأول والمركز الثاني للفعل',
          summaryAr: 'عند تقديم الزمن أو المكان للمركز الأول، ينتقل الفاعل بعد الفعل مباشرة ليحافظ الفعل على المركز الثاني (Inversion).',
          table: {
            headers: ['نوع الجملة', 'موقع الفعل', 'مثال'],
            rows: [
              ['Aussagesatz (خبرية عادية)', 'Position 2', 'Ich lerne heute Deutsch.'],
              ['Inversion (بدء بالزمن)', 'Position 2', 'Heute lerne ich Deutsch.'],
              ['W-Frage (أداة استفهام)', 'Position 2', 'Wann lernst du Deutsch?'],
              ['Ja/Nein-Frage (هل؟)', 'Position 1', 'Lernst du heute Deutsch?']
            ]
          },
          tipAr: 'لا تضع الفاعل والفعل كلاهما قبل المفعول إذا بدأت بظرف زمان مثل "Heute": الصواب "Heute gehe ich..." وليس "Heute ich gehe...".'
        }
      ],
      examples: [
        { id: 'gex_wb_1', german: 'Am Montag habe ich Deutschunterricht.', arabic: 'يوم الإثنين لدي حصة ألماني.', highlight: 'habe' },
        { id: 'gex_wb_2', german: 'Woher kommst du?', arabic: 'من أين أنت؟', highlight: 'kommst' },
        { id: 'gex_wb_3', german: 'Trinkst du gern Orangensaft?', arabic: 'هل تحب شرب عصير البرتقال؟', highlight: 'Trinkst' }
      ],
      exercises: [
        {
          id: 'gq_wb_1',
          type: 'choose_correct_sentence',
          prompt: 'انتبه لقاعدة المركز الثاني للفعل عند البدء بالزمن:',
          question: 'اختر الجملة المرتبة بشكل صحيح:',
          options: [
            'Morgen fährt meine Familie nach Hurghada.',
            'Morgen meine Familie fährt nach Hurghada.',
            'Fährt morgen nach Hurghada meine Familie.',
            'Meine Familie morgen fährt nach Hurghada.'
          ],
          correctAnswer: 'Morgen fährt meine Familie nach Hurghada.',
          explanationAr: 'عند البدء بكلمة Morgen (Pos. 1) يجب أن يليها الفعل fährt مباشرة في المركز الثاني (Pos. 2).',
          source: 'original'
        },
        {
          id: 'gq_wb_2',
          type: 'multiple_choice',
          prompt: 'اختر أداة الاستفهام المناسبة للسؤال عن السبب/المكان/العمر:',
          question: '______ wohnst du in Kairo? — Seit drei Jahren. (منذ ثلاث سنوات / أو في السؤال عن المكان: أين؟)',
          options: ['Wie lange', 'Wer', 'Was', 'Wohin'],
          correctAnswer: 'Wie lange',
          explanationAr: 'الإجابة "Seit drei Jahren" تدل على المدة، لذا نسأل بـ Wie lange (كم المدة).',
          source: 'original'
        },
        {
          id: 'gq_wb_3',
          type: 'sentence_ordering',
          prompt: 'كوّن سؤالاً بمعنى هل (الفعل في المركز الأول):',
          question: 'هل تلعب التنس يوم الجمعة؟',
          tokens: ['du', 'Spielst', 'Tennis?', 'am Freitag'],
          correctAnswer: 'Spielst du am Freitag Tennis?',
          explanationAr: 'في سؤال Ja/Nein-Frage يبدأ السؤال بالفعل المُصرّف Spielst.',
          source: 'original'
        },
        {
          id: 'gq_wb_4',
          type: 'correct_mistake',
          prompt: 'صحح ترتيب الجملة الخبرية:',
          question: 'Am Wochenende wir besuchen unsere Großeltern.',
          faultySentence: 'Am Wochenende wir besuchen unsere Großeltern.',
          options: [
            'Am Wochenende besuchen wir unsere Großeltern.',
            'Am Wochenende unsere Großeltern besuchen wir.',
            'Besuchen wir unsere Großeltern am Wochenende.'
          ],
          correctAnswer: 'Am Wochenende besuchen wir unsere Großeltern.',
          explanationAr: 'يجب وضع الفعل besuchen في المركز الثاني بعد Am Wochenende.',
          source: 'original'
        },
        {
          id: 'gq_wb_5',
          type: 'fill_blank',
          prompt: 'أكمل السؤال بأداة الاستفهام المناسبة عن الشخص (Wer) أم الشيء (Was):',
          question: '______ spielt heute Klavier? — Meine Schwester Nada.',
          sentenceWithBlank: '______ spielt heute Klavier? — Meine Schwester Nada.',
          options: ['Wer', 'Was', 'Wo', 'Wann'],
          correctAnswer: 'Wer',
          explanationAr: 'الإجابة شخص عاقل (أختي ندى)، لذا نسأل بـ Wer (مَن).',
          source: 'original'
        },
        {
          id: 'gq_wb_6',
          type: 'short_answer',
          prompt: 'حوّل الجملة إلى سؤال يبدأ بالفعل: "Du kommst aus Ägypten."',
          question: 'السؤال بمعنى "هل أنت من مصر؟":',
          correctAnswer: 'Kommst du aus Ägypten?',
          acceptedAnswers: ['Kommst du aus Ägypten'],
          explanationAr: 'نضع الفعل Kommst في المركز الأول ثم الفاعل du.',
          source: 'original'
        }
      ]
    },
    createdAt: BUILTIN_CREATED_AT,
    updatedAt: BUILTIN_UPDATED_AT
  }
];
