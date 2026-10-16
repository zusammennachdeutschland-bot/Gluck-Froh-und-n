import { LernstudioSet } from '../types/lernstudio';

export const DEFAULT_LERNSTUDIO_SETS: LernstudioSet[] = [
  // ==================== جريد 1 (Grade 1) ====================
  {
    id: 'set_def_01_begruessung',
    title: 'Begrüßungen und Verabschiedungen',
    titleTranslations: {
      ar: 'التحيات والوداع',
      de: 'Begrüßungen und Verabschiedungen',
      en: 'Greetings & Farewells'
    },
    topic: 'التحيات والوداع',
    topicTranslations: {
      ar: 'التحيات والوداع',
      de: 'Begrüßungen und Verabschiedungen',
      en: 'Greetings & Farewells'
    },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'تعلم أهم عبارات التحية والوداع باللغة الألمانية للأطفال.',
    descriptionTranslations: {
      ar: 'تعلم أهم عبارات التحية والوداع باللغة الألمانية للأطفال.',
      de: 'Lerne die wichtigsten deutschen Begrüßungs- und Verabschiedungsformeln für Kinder.',
      en: 'Learn essential German greetings and farewells for kids.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'it_b1', german: 'Hallo', arabic: 'مرحباً', emoji: '👋', exampleSentenceGerman: 'Hallo! Wie geht es dir?', exampleSentenceArabic: 'مرحباً! كيف حالك؟', missingLetterWord: 'H_llo', sentence4Elements: ['Hallo,', 'wie', 'geht', 'es?'] },
      { id: 'it_b2', german: 'Guten Morgen', arabic: 'صباح الخير', emoji: '🌅', exampleSentenceGerman: 'Guten Morgen, Mama!', exampleSentenceArabic: 'صباح الخير يا أمي!', missingLetterWord: 'Guten M_rgen', sentence4Elements: ['Guten', 'Morgen,', 'liebe', 'Mama!'] },
      { id: 'it_b3', german: 'Guten Tag', arabic: 'نهار سعيد / مرحباً', emoji: '☀️', exampleSentenceGerman: 'Guten Tag, Herr Weber.', exampleSentenceArabic: 'نهار سعيد يا سيد فيبر.', missingLetterWord: 'Guten T_g', sentence4Elements: ['Guten', 'Tag,', 'liebe', 'Kinder!'] },
      { id: 'it_b4', german: 'Guten Abend', arabic: 'مساء الخير', emoji: '🌆', exampleSentenceGerman: 'Guten Abend zusammen!', exampleSentenceArabic: 'مساء الخير جميعاً!', missingLetterWord: 'Guten A_end', sentence4Elements: ['Guten', 'Abend', 'an', 'alle!'] },
      { id: 'it_b5', german: 'Gute Nacht', arabic: 'تصبح على خير', emoji: '🌙', exampleSentenceGerman: 'Gute Nacht, schlaf gut!', exampleSentenceArabic: 'تصبح على خير، نم جيداً!', missingLetterWord: 'Gute N_cht', sentence4Elements: ['Gute', 'Nacht,', 'schlaf', 'gut!'] },
      { id: 'it_b6', german: 'Tschüss', arabic: 'مع السلامة', emoji: '🙋‍♂️', exampleSentenceGerman: 'Tschüss, bis morgen!', exampleSentenceArabic: 'مع السلامة، إلى الغد!', missingLetterWord: 'Tsch_ss', sentence4Elements: ['Tschüss,', 'bis', 'morgen', 'wieder!'] },
      { id: 'it_b7', german: 'Auf Wiedersehen', arabic: 'إلى اللقاء', emoji: '👋', exampleSentenceGerman: 'Auf Wiedersehen, Frau Müller!', exampleSentenceArabic: 'إلى اللقاء يا سيدة مولر!', missingLetterWord: 'Auf Wi_dersehen', sentence4Elements: ['Auf', 'Wiedersehen', 'bis', 'bald!'] },
      { id: 'it_b8', german: 'Bis später', arabic: 'أراك لاحقاً', emoji: '⏳', exampleSentenceGerman: 'Tschüss, bis später!', exampleSentenceArabic: 'مع السلامة، أراك لاحقاً!', missingLetterWord: 'Bis sp_ter', sentence4Elements: ['Bis', 'später', 'im', 'Park!'] },
      { id: 'it_b9', german: 'Danke', arabic: 'شكراً', emoji: '🙏', exampleSentenceGerman: 'Danke für das Geschenk!', exampleSentenceArabic: 'شكراً على الهدية!', missingLetterWord: 'D_nke', sentence4Elements: ['Vielen', 'Dank', 'für', 'alles!'] },
      { id: 'it_b10', german: 'Bitte', arabic: 'عفواً / تفضل', emoji: '😊', exampleSentenceGerman: 'Bitte schön!', exampleSentenceArabic: 'عفواً / على الرحب والسعة!', missingLetterWord: 'B_tte', sentence4Elements: ['Bitte', 'schön,', 'sehr', 'gerne!'] }
    ]
  },
  {
    id: 'set_def_02_vorstellen',
    title: 'Sich vorstellen',
    titleTranslations: {
      ar: 'التعريف بالنفس',
      de: 'Sich vorstellen',
      en: 'Introducing Yourself'
    },
    topic: 'التعريف بالنفس',
    topicTranslations: {
      ar: 'التعريف بالنفس',
      de: 'Sich vorstellen',
      en: 'Self Introduction'
    },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'عبارات تقديم النفس والتعارف البسيطة للأطفال.',
    descriptionTranslations: {
      ar: 'عبارات تقديم النفس والتعارف البسيطة للأطفال.',
      de: 'Einfache Redemittel zum Kennenlernen und Vorstellen für Kinder.',
      en: 'Simple self-introduction phrases for children.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'it_v1', german: 'Ich', arabic: 'أنا', emoji: '🙋‍♀️', exampleSentenceGerman: 'Ich bin ein Kind.', exampleSentenceArabic: 'أنا طفل.', missingLetterWord: 'I_h', sentence4Elements: ['Ich', 'heiße', 'Leo', 'Müller.'] },
      { id: 'it_v2', german: 'Du', arabic: 'أنتَ / أنتِ', emoji: '👉', exampleSentenceGerman: 'Wer bist du?', exampleSentenceArabic: 'من أنت؟', missingLetterWord: 'D_', sentence4Elements: ['Wer', 'bist', 'du', 'heute?'] },
      { id: 'it_v3', german: 'Wie heißt du?', arabic: 'ما اسمك؟', emoji: '❓', exampleSentenceGerman: 'Hallo, wie heißt du?', exampleSentenceArabic: 'مرحباً، ما اسمك؟', missingLetterWord: 'Wie h_ißt du?', sentence4Elements: ['Wie', 'heißt', 'du', 'denn?'] },
      { id: 'it_v4', german: 'Ich heiße...', arabic: 'اسمي هو...', emoji: '📛', exampleSentenceGerman: 'Ich heiße Emma.', exampleSentenceArabic: 'اسمي إيما.', missingLetterWord: 'Ich h_iße', sentence4Elements: ['Ich', 'heiße', 'Lukas', 'hier.'] },
      { id: 'it_v5', german: 'Wie alt bist du?', arabic: 'كم عمرك؟', emoji: '🎂', exampleSentenceGerman: 'Wie alt bist du jetzt?', exampleSentenceArabic: 'كم عمرك الآن؟', missingLetterWord: 'Wie _lt bist du?', sentence4Elements: ['Wie', 'alt', 'bist', 'du?'] },
      { id: 'it_v6', german: 'Ich bin ... Jahre alt', arabic: 'عمري ... سنوات', emoji: '🎈', exampleSentenceGerman: 'Ich bin sieben Jahre alt.', exampleSentenceArabic: 'عمري سبع سنوات.', missingLetterWord: 'Ich bin ... J_hre alt', sentence4Elements: ['Ich', 'bin', 'sieben', 'Jahre.'] },
      { id: 'it_v7', german: 'Woher kommst du?', arabic: 'من أين أنت؟', emoji: '🌍', exampleSentenceGerman: 'Woher kommst du eigentlich?', exampleSentenceArabic: 'من أين أنت في الحقيقة؟', missingLetterWord: 'Woh_r kommst du?', sentence4Elements: ['Woher', 'kommst', 'du', 'her?'] },
      { id: 'it_v8', german: 'Ich komme aus...', arabic: 'أنا قادم من...', emoji: '✈️', exampleSentenceGerman: 'Ich komme aus Ägypten.', exampleSentenceArabic: 'أنا من مصر.', missingLetterWord: 'Ich k_mme aus', sentence4Elements: ['Ich', 'komme', 'aus', 'Deutschland.'] }
    ]
  },
  {
    id: 'set_def_03_farben_zahlen',
    title: 'Farben und Zahlen (1-10)',
    titleTranslations: {
      ar: 'الألوان والأرقام (1-10)',
      de: 'Farben und Zahlen (1-10)',
      en: 'Colors and Numbers (1-10)'
    },
    topic: 'الألوان والأرقام',
    topicTranslations: {
      ar: 'الألوان والأرقام',
      de: 'Farben und Zahlen',
      en: 'Colors & Numbers'
    },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'تعلم الألوان الأساسية والأرقام من 1 إلى 10 بالألمانية.',
    descriptionTranslations: {
      ar: 'تعلم الألوان الأساسية والأرقام من 1 إلى 10 بالألمانية.',
      de: 'Lerne Grundfarben und Zahlen von 1 bis 10 auf Deutsch.',
      en: 'Learn basic colors and numbers 1-10 in German.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'fz_1', german: 'rot', arabic: 'أحمر', emoji: '🔴', exampleSentenceGerman: 'Der Apfel ist rot.', exampleSentenceArabic: 'التفاحة حمراء.', missingLetterWord: 'r_t', sentence4Elements: ['Der', 'Apfel', 'ist', 'rot.'] },
      { id: 'fz_2', german: 'blau', arabic: 'أزرق', emoji: '🔵', exampleSentenceGerman: 'Der Himmel ist blau.', exampleSentenceArabic: 'السماء زرقاء.', missingLetterWord: 'bl_u', sentence4Elements: ['Der', 'Himmel', 'ist', 'blau.'] },
      { id: 'fz_3', german: 'grün', arabic: 'أخضر', emoji: '🟢', exampleSentenceGerman: 'Das Gras ist grün.', exampleSentenceArabic: 'العشب أخضر.', missingLetterWord: 'gr_n', sentence4Elements: ['Das', 'Gras', 'ist', 'grün.'] },
      { id: 'fz_4', german: 'eins', arabic: 'واحد (1)', emoji: '1️⃣', exampleSentenceGerman: 'Ich habe einen Ball.', exampleSentenceArabic: 'عندي كرة واحدة.', missingLetterWord: 'e_ns', sentence4Elements: ['Ich', 'zähle', 'bis', 'eins.'] },
      { id: 'fz_5', german: 'zwei', arabic: 'اثنان (2)', emoji: '2️⃣', exampleSentenceGerman: 'Das sind zwei Katzen.', exampleSentenceArabic: 'هاتان قطتان.', missingLetterWord: 'zw_i', sentence4Elements: ['Das', 'sind', 'zwei', 'Katzen.'] },
      { id: 'fz_6', german: 'drei', arabic: 'ثلاثة (3)', emoji: '3️⃣', exampleSentenceGerman: 'Drei rote Blumen.', exampleSentenceArabic: 'ثلاث أزهار حمراء.', missingLetterWord: 'dr_i', sentence4Elements: ['Hier', 'sind', 'drei', 'Autos.'] }
    ]
  },

  // ==================== جريد 2 (Grade 2) ====================
  {
    id: 'set_def_04_familie',
    title: 'Meine Familie',
    titleTranslations: {
      ar: 'عائلتي',
      de: 'Meine Familie',
      en: 'My Family'
    },
    topic: 'عائلتي',
    topicTranslations: {
      ar: 'عائلتي',
      de: 'Meine Familie',
      en: 'My Family'
    },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'أسماء أفراد العائلة بالألمانية مع أداة التعريف.',
    descriptionTranslations: {
      ar: 'أسماء أفراد العائلة بالألمانية مع أداة التعريف.',
      de: 'Familienmitglieder auf Deutsch mit bestimmten Artikeln.',
      en: 'Family members in German with articles.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'fam_1', german: 'die Mutter', article: 'die', arabic: 'الأم', plural: 'die Mütter', emoji: '👩', exampleSentenceGerman: 'Die Mutter kocht Suppe.', exampleSentenceArabic: 'الأم تطبخ الحساء.', missingLetterWord: 'M_tter', sentence4Elements: ['Die', 'Mutter', 'kocht', 'Suppe.'] },
      { id: 'fam_2', german: 'der Vater', article: 'der', arabic: 'الأب', plural: 'die Väter', emoji: '👨', exampleSentenceGerman: 'Der Vater liest ein Buch.', exampleSentenceArabic: 'الأب يقرأ كتاباً.', missingLetterWord: 'V_ter', sentence4Elements: ['Der', 'Vater', 'liest', 'Buch.'] },
      { id: 'fam_3', german: 'der Bruder', article: 'der', arabic: 'الأخ', plural: 'die Brüder', emoji: '👦', exampleSentenceGerman: 'Mein Bruder spielt Fußball.', exampleSentenceArabic: 'أخي يلعب كرة القدم.', missingLetterWord: 'Br_der', sentence4Elements: ['Mein', 'Bruder', 'spielt', 'Fußball.'] },
      { id: 'fam_4', german: 'die Schwester', article: 'die', arabic: 'الأخت', plural: 'die Schwestern', emoji: '👧', exampleSentenceGerman: 'Die Schwester malt ein Bild.', exampleSentenceArabic: 'الأخت ترسم لوحة.', missingLetterWord: 'Schw_ster', sentence4Elements: ['Die', 'Schwester', 'malt', 'Bild.'] },
      { id: 'fam_5', german: 'die Oma', article: 'die', arabic: 'الجدة', plural: 'die Omas', emoji: '👵', exampleSentenceGerman: 'Die Oma erzählt eine Geschichte.', exampleSentenceArabic: 'الجدة تحكي قصة.', missingLetterWord: 'O_a', sentence4Elements: ['Die', 'Oma', 'erzählt', 'Geschichte.'] },
      { id: 'fam_6', german: 'der Opa', article: 'der', arabic: 'الجد', plural: 'die Opas', emoji: '👴', exampleSentenceGerman: 'Der Opa spaziert im Park.', exampleSentenceArabic: 'الجد يتنزه في الحديقة.', missingLetterWord: 'O_a', sentence4Elements: ['Der', 'Opa', 'spaziert', 'Park.'] }
    ]
  },
  {
    id: 'set_def_05_schule',
    title: 'Meine Schulsachen',
    titleTranslations: {
      ar: 'أدواتي المدرسية',
      de: 'Meine Schulsachen',
      en: 'My School Supplies'
    },
    topic: 'الأدوات المدرسية',
    topicTranslations: {
      ar: 'الأدوات المدرسية',
      de: 'Schulsachen',
      en: 'School Supplies'
    },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'مفردات المقلمة والأدوات المدرسية مع أداة التعريف der/die/das.',
    descriptionTranslations: {
      ar: 'مفردات المقلمة والأدوات المدرسية مع أداة التعريف der/die/das.',
      de: 'Wortschatz für Schulsachen mit Artikeln der/die/das.',
      en: 'Vocabulary for school supplies with articles der/die/das.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'sch_1', german: 'das Buch', article: 'das', arabic: 'الكتاب', plural: 'die Bücher', emoji: '📖', exampleSentenceGerman: 'Das Buch ist neu.', exampleSentenceArabic: 'الكتاب جديد.', missingLetterWord: 'B_ch', sentence4Elements: ['Das', 'Buch', 'ist', 'neu.'] },
      { id: 'sch_2', german: 'der Stift', article: 'der', arabic: 'القلم', plural: 'die Stifte', emoji: '✏️', exampleSentenceGerman: 'Der Stift schreibt blau.', exampleSentenceArabic: 'القلم يكتب بالأزرق.', missingLetterWord: 'St_ft', sentence4Elements: ['Der', 'Stift', 'schreibt', 'blau.'] },
      { id: 'sch_3', german: 'die Tasche', article: 'die', arabic: 'الحقيبة', plural: 'die Taschen', emoji: '🎒', exampleSentenceGerman: 'Die Tasche ist schwer.', exampleSentenceArabic: 'الحقيبة ثقيلة.', missingLetterWord: 'T_sche', sentence4Elements: ['Die', 'Tasche', 'ist', 'schwer.'] },
      { id: 'sch_4', german: 'das Lineal', article: 'das', arabic: 'المسطرة', plural: 'die Lineale', emoji: '📏', exampleSentenceGerman: 'Das Lineal ist lang.', exampleSentenceArabic: 'المسطرة طويلة.', missingLetterWord: 'Lin_al', sentence4Elements: ['Das', 'Lineal', 'ist', 'lang.'] },
      { id: 'sch_5', german: 'die Schere', article: 'die', arabic: 'المقص', plural: 'die Scheren', emoji: '✂️', exampleSentenceGerman: 'Die Schere schneidet Papier.', exampleSentenceArabic: 'المقص يقطع الورق.', missingLetterWord: 'Sch_re', sentence4Elements: ['Die', 'Schere', 'schneidet', 'Papier.'] }
    ]
  },

  // ==================== جريد 3 (Grade 3) ====================
  {
    id: 'set_def_06_obst_gemuese',
    title: 'Obst und Gemüse',
    titleTranslations: {
      ar: 'الفاكهة والخضروات',
      de: 'Obst und Gemüse',
      en: 'Fruits & Vegetables'
    },
    topic: 'الفواكه والخضروات',
    topicTranslations: {
      ar: 'الفواكه والخضروات',
      de: 'Obst und Gemüse',
      en: 'Fruits & Veggies'
    },
    grade: 'جريد 3',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'أسماء الفواكه والخضروات الشائعة بالألمانية.',
    descriptionTranslations: {
      ar: 'أسماء الفواكه والخضروات الشائعة بالألمانية.',
      de: 'Häufige Obst- und Gemüsesorten auf Deutsch.',
      en: 'Common fruits and vegetables in German.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'og_1', german: 'der Apfel', article: 'der', arabic: 'التفاحة', plural: 'die Äpfel', emoji: '🍎', exampleSentenceGerman: 'Der Apfel schmeckt süß.', exampleSentenceArabic: 'التفاحة طعمها حلو.', missingLetterWord: 'A_fel', sentence4Elements: ['Der', 'Apfel', 'schmeckt', 'süß.'] },
      { id: 'og_2', german: 'die Banane', article: 'die', arabic: 'الموزة', plural: 'die Bananen', emoji: '🍌', exampleSentenceGerman: 'Die Banane ist gelb.', exampleSentenceArabic: 'الموزة صفراء.', missingLetterWord: 'Ban_ne', sentence4Elements: ['Die', 'Banane', 'ist', 'gelb.'] },
      { id: 'og_3', german: 'die Tomate', article: 'die', arabic: 'الطماطم', plural: 'die Tomaten', emoji: '🍅', exampleSentenceGerman: 'Die Tomate ist rot.', exampleSentenceArabic: 'الطماطم حمراء.', missingLetterWord: 'Tom_te', sentence4Elements: ['Die', 'Tomate', 'ist', 'rot.'] },
      { id: 'og_4', german: 'die Karotte', article: 'die', arabic: 'الجزر', plural: 'die Karotten', emoji: '🥕', exampleSentenceGerman: 'Der Hase isst die Karotte.', exampleSentenceArabic: 'الأرنب يأكل الجزرة.', missingLetterWord: 'Kar_tte', sentence4Elements: ['Der', 'Hase', 'isst', 'Karotte.'] },
      { id: 'og_5', german: 'die Erdbeere', article: 'die', arabic: 'الفراولة', plural: 'die Erdbeeren', emoji: '🍓', exampleSentenceGerman: 'Ich liebe leckere Erdbeeren.', exampleSentenceArabic: 'أنا أحب الفراولة اللذيذة.', missingLetterWord: 'Erdb_ere', sentence4Elements: ['Ich', 'liebe', 'leckere', 'Erdbeeren.'] }
    ]
  },
  {
    id: 'set_def_07_tiere',
    title: 'Tiere auf dem Bauernhof',
    titleTranslations: {
      ar: 'حيوانات المزرعة',
      de: 'Tiere auf dem Bauernhof',
      en: 'Farm Animals'
    },
    topic: 'حيوانات المزرعة',
    topicTranslations: {
      ar: 'حيوانات المزرعة',
      de: 'Bauernhoftiere',
      en: 'Farm Animals'
    },
    grade: 'جريد 3',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'أسماء حيوانات المزرعة بالألمانية مع أداة التعريف der/die/das.',
    descriptionTranslations: {
      ar: 'أسماء حيوانات المزرعة بالألمانية مع أداة التعريف der/die/das.',
      de: 'Bauernhoftiere auf Deutsch mit Artikeln der/die/das.',
      en: 'Farm animals in German with articles der/die/das.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'tr_1', german: 'die Katze', article: 'die', arabic: 'القطة', plural: 'die Katzen', emoji: '🐱', exampleSentenceGerman: 'Die Katze schläft gerne.', exampleSentenceArabic: 'القطة تحب النوم.', missingLetterWord: 'K_tze', sentence4Elements: ['Die', 'Katze', 'schläft', 'gerne.'] },
      { id: 'tr_2', german: 'der Hund', article: 'der', arabic: 'الكلب', plural: 'die Hunde', emoji: '🐶', exampleSentenceGerman: 'Der Hund bellt laut.', exampleSentenceArabic: 'الكلب ينبح بصوت عالٍ.', missingLetterWord: 'H_nd', sentence4Elements: ['Der', 'Hund', 'bellt', 'laut.'] },
      { id: 'tr_3', german: 'die Kuh', article: 'die', arabic: 'البقرة', plural: 'die Kühe', emoji: '🐮', exampleSentenceGerman: 'Die Kuh gibt Milch.', exampleSentenceArabic: 'البقرة تعطي الحليب.', missingLetterWord: 'K_h', sentence4Elements: ['Die', 'Kuh', 'gibt', 'Milch.'] },
      { id: 'tr_4', german: 'das Pferd', article: 'das', arabic: 'الحصان', plural: 'die Pferde', emoji: '🐴', exampleSentenceGerman: 'Das Pferd läuft schnell.', exampleSentenceArabic: 'الحصان يجري بسرعة.', missingLetterWord: 'Pf_rd', sentence4Elements: ['Das', 'Pferd', 'läuft', 'schnell.'] },
      { id: 'tr_5', german: 'das Schaf', article: 'das', arabic: 'الخروف', plural: 'die Schafe', emoji: '🐑', exampleSentenceGerman: 'Das Schaf hat weiche Wolle.', exampleSentenceArabic: 'الخروف له صوف ناعم.', missingLetterWord: 'Sch_f', sentence4Elements: ['Das', 'Schaf', 'hat', 'Wolle.'] }
    ]
  },

  // ==================== جريد 4 (Grade 4) ====================
  {
    id: 'set_def_08_uhrzeit_tagesablauf',
    title: 'Mein Tagesablauf und die Uhrzeit',
    titleTranslations: {
      ar: 'روتيني اليومي والوقت',
      de: 'Mein Tagesablauf und die Uhrzeit',
      en: 'My Daily Routine & Time'
    },
    topic: 'الروتين والوقت',
    topicTranslations: {
      ar: 'الروتين والوقت',
      de: 'Tagesablauf & Zeit',
      en: 'Routine & Time'
    },
    grade: 'جريد 4',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'عبارات الساعة والروتين اليومي للأطفال.',
    descriptionTranslations: {
      ar: 'عبارات الساعة والروتين اليومي للأطفال.',
      de: 'Redemittel für Uhrzeit und Alltag für Kinder.',
      en: 'Phrases for telling time and daily activities.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'ta_1', german: 'aufstehen', arabic: 'يستيقظ / ينهض', emoji: '⏰', exampleSentenceGerman: 'Ich stehe früh auf.', exampleSentenceArabic: 'أنا أستيقظ مبكراً.', missingLetterWord: 'aufst_hen', sentence4Elements: ['Ich', 'stehe', 'morgens', 'auf.'] },
      { id: 'ta_2', german: 'Frühstück essen', arabic: 'يتناول الفطور', emoji: '🥣', exampleSentenceGerman: 'Ich esse leckeres Frühstück.', exampleSentenceArabic: 'أنا أتياول فطوراً لذيذاً.', missingLetterWord: 'Fr_hstück', sentence4Elements: ['Ich', 'esse', 'gesundes', 'Frühstück.'] },
      { id: 'ta_3', german: 'zur Schule gehen', arabic: 'يذهب إلى المدرسة', emoji: '🏫', exampleSentenceGerman: 'Wir gehen zur Schule.', exampleSentenceArabic: 'نحن نذهب إلى المدرسة.', missingLetterWord: 'zur Sch_le', sentence4Elements: ['Wir', 'gehen', 'pünktlich', 'Schule.'] },
      { id: 'ta_4', german: 'Hausaufgaben machen', arabic: 'يفعل الواجبات المنزلية', emoji: '📝', exampleSentenceGerman: 'Er macht seine Hausaufgaben.', exampleSentenceArabic: 'هو يفعل واجباته.', missingLetterWord: 'Hausaufg_ben', sentence4Elements: ['Er', 'macht', 'seine', 'Hausaufgaben.'] },
      { id: 'ta_5', german: 'schlafen gehen', arabic: 'يذهب للنوم', emoji: '🛏️', exampleSentenceGerman: 'Um neun gehe ich schlafen.', exampleSentenceArabic: 'في التاسعة أذهب للنوم.', missingLetterWord: 'schl_fen', sentence4Elements: ['Um', 'neun', 'gehe', 'schlafen.'] }
    ]
  },

  // ==================== جريد 5 (Grade 5) ====================
  {
    id: 'set_def_09_verkehr_stadt',
    title: 'Verkehrsmittel und In der Stadt',
    titleTranslations: {
      ar: 'وسائل المواصلات وفي المدينة',
      de: 'Verkehrsmittel und In der Stadt',
      en: 'Transport & In the City'
    },
    topic: 'المواصلات والمدينة',
    topicTranslations: {
      ar: 'المواصلات والمدينة',
      de: 'Verkehrsmittel & Stadt',
      en: 'Transport & City'
    },
    grade: 'جريد 5',
    level: 'A2',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'وسائل النقل والأماكن العامة في المدينة بالألمانية.',
    descriptionTranslations: {
      ar: 'وسائل النقل والأماكن العامة في المدينة بالألمانية.',
      de: 'Verkehrsmittel und öffentliche Orte in der Stadt.',
      en: 'Vehicles and public places in the city.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'vk_1', german: 'der Bus', article: 'der', arabic: 'الحافلة', plural: 'die Busse', emoji: '🚌', exampleSentenceGerman: 'Der Bus kommt pünktlich.', exampleSentenceArabic: 'الحافلة تأتي في الموعد.', missingLetterWord: 'B_s', sentence4Elements: ['Der', 'Bus', 'kommt', 'pünktlich.'] },
      { id: 'vk_2', german: 'das Auto', article: 'das', arabic: 'السيارة', plural: 'die Autos', emoji: '🚗', exampleSentenceGerman: 'Das Auto fährt schnell.', exampleSentenceArabic: 'السيارة تسير بسرعة.', missingLetterWord: 'A_to', sentence4Elements: ['Das', 'Auto', 'fährt', 'schnell.'] },
      { id: 'vk_3', german: 'der Zug', article: 'der', arabic: 'القطار', plural: 'die Züge', emoji: '🚆', exampleSentenceGerman: 'Der Zug fährt nach Berlin.', exampleSentenceArabic: 'القطار يتجه إلى برلين.', missingLetterWord: 'Z_g', sentence4Elements: ['Der', 'Zug', 'fährt', 'Berlin.'] },
      { id: 'vk_4', german: 'der Park', article: 'der', arabic: 'الحديقة العامة', plural: 'die Parks', emoji: '🏞️', exampleSentenceGerman: 'Der Park ist grün.', exampleSentenceArabic: 'الحديقة خضراء.', missingLetterWord: 'P_rk', sentence4Elements: ['Der', 'Park', 'ist', 'sehr grün.'] },
      { id: 'vk_5', german: 'die Bäckerei', article: 'die', arabic: 'المخبز', plural: 'die Bäckereien', emoji: '🥖', exampleSentenceGerman: 'Ich kaufe Brot in der Bäckerei.', exampleSentenceArabic: 'أنا أشتري الخبز من المخبز.', missingLetterWord: 'Bäcker_i', sentence4Elements: ['Ich', 'kaufe', 'frisches', 'Brot.'] }
    ]
  },

  // ==================== جريد 6 (Grade 6) ====================
  {
    id: 'set_def_10_verben_gegensatze',
    title: 'Alltagsverben und Gegensätze',
    titleTranslations: {
      ar: 'الأفعال اليومية والمتضادات',
      de: 'Alltagsverben und Gegensätze',
      en: 'Daily Verbs & Opposites'
    },
    topic: 'الأفعال والصفات',
    topicTranslations: {
      ar: 'الأفعال والصفات',
      de: 'Verben & Adjektive',
      en: 'Verbs & Adjectives'
    },
    grade: 'جريد 6',
    level: 'A2',
    difficulty: 'medium',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'أهم الأفعال اليومية والصفات العكسية باللغة الألمانية.',
    descriptionTranslations: {
      ar: 'أهم الأفعال اليومية والصفات العكسية باللغة الألمانية.',
      de: 'Wichtige Alltagsverben und gegensätzliche Adjektive.',
      en: 'Key daily verbs and opposite adjectives.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'vg_1', german: 'groß und klein', arabic: 'كبير وصغير', emoji: '📏', exampleSentenceGerman: 'Der Elefant ist groß.', exampleSentenceArabic: 'الفيل كبير.', missingLetterWord: 'gr_ß', sentence4Elements: ['Der', 'Elefant', 'ist', 'groß.'] },
      { id: 'vg_2', german: 'schnell und langsam', arabic: 'سريع وبطيء', emoji: '⚡', exampleSentenceGerman: 'Das Auto ist schnell.', exampleSentenceArabic: 'السيارة سريعة.', missingLetterWord: 'schn_ll', sentence4Elements: ['Das', 'Auto', 'fährt', 'schnell.'] },
      { id: 'vg_3', german: 'spielen', arabic: 'يلعب', emoji: '🎮', exampleSentenceGerman: 'Die Kinder spielen draußen.', exampleSentenceArabic: 'الأطفال يلعبون بالخارج.', missingLetterWord: 'spi_len', sentence4Elements: ['Die', 'Kinder', 'spielen', 'draußen.'] },
      { id: 'vg_4', german: 'lernen', arabic: 'يتعلم', emoji: '📚', exampleSentenceGerman: 'Wir lernen Deutsch zusammen.', exampleSentenceArabic: 'نحن نتعلم الألمانية معاً.', missingLetterWord: 'l_rnen', sentence4Elements: ['Wir', 'lernen', 'Deutsch', 'zusammen.'] }
    ]
  },

  // ==================== جريد 7 (Grade 7) ====================
  {
    id: 'set_def_11_feste_feiern',
    title: 'Feste und Geburtstage',
    titleTranslations: {
      ar: 'الأعياد وحفلات الميلاد',
      de: 'Feste und Geburtstage',
      en: 'Celebrations & Birthdays'
    },
    topic: 'المناسبات والحفلات',
    topicTranslations: {
      ar: 'المناسبات والحفلات',
      de: 'Feste & Feiern',
      en: 'Parties & Holidays'
    },
    grade: 'جريد 7',
    level: 'A2',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'عبارات التهاني والحفلات باللغة الألمانية.',
    descriptionTranslations: {
      ar: 'عبارات التهاني والحفلات باللغة الألمانية.',
      de: 'Feste, Geburtstage und Glückwünsche auf Deutsch.',
      en: 'Celebrations, birthdays, and wishes in German.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'ff_1', german: 'der Geburtstag', article: 'der', arabic: 'عيد الميلاد', plural: 'die Geburtstage', emoji: '🎂', exampleSentenceGerman: 'Alles Gute zum Geburtstag!', exampleSentenceArabic: 'عيد ميلاد سعيد!', missingLetterWord: 'Geb_rtstag', sentence4Elements: ['Alles', 'Gute', 'zum', 'Geburtstag!'] },
      { id: 'ff_2', german: 'das Geschenk', article: 'das', arabic: 'الهدية', plural: 'die Geschenke', emoji: '🎁', exampleSentenceGerman: 'Das Geschenk ist schön.', exampleSentenceArabic: 'الهدية جميلة.', missingLetterWord: 'Gesch_nk', sentence4Elements: ['Das', 'Geschenk', 'ist', 'schön.'] },
      { id: 'ff_3', german: 'die Kerze', article: 'die', arabic: 'الشمعة', plural: 'die Kerzen', emoji: '🕯️', exampleSentenceGerman: 'Die Kerze brennt hell.', exampleSentenceArabic: 'الشمعة تضيء بوضوح.', missingLetterWord: 'K_rze', sentence4Elements: ['Die', 'Kerze', 'brennt', 'hell.'] }
    ]
  },

  // ==================== جريد 8 (Grade 8) ====================
  {
    id: 'set_def_12_medien_technologie',
    title: 'Medien und Technologie',
    titleTranslations: {
      ar: 'الإعلام والتكنولوجيا الحديثة',
      de: 'Medien und Technologie',
      en: 'Media & Technology'
    },
    topic: 'التكنولوجيا والإنترنت',
    topicTranslations: {
      ar: 'التكنولوجيا والإنترنت',
      de: 'Technologie & Internet',
      en: 'Technology & Internet'
    },
    grade: 'جريد 8',
    level: 'A2',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'مفردات الهواتف الذكية والحاسوب والتكنولوجيا.',
    descriptionTranslations: {
      ar: 'مفردات الهواتف الذكية والحاسوب والتكنولوجيا.',
      de: 'Wortschatz für Smartphones, Computer und Technik.',
      en: 'Vocabulary for smartphones, computers, and tech.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'mt_1', german: 'das Handy', article: 'das', arabic: 'الهاتف المحمول', plural: 'die Handys', emoji: '📱', exampleSentenceGerman: 'Das Handy klingelt laut.', exampleSentenceArabic: 'الهاتف يرن بصوت عالٍ.', missingLetterWord: 'H_ndy', sentence4Elements: ['Das', 'Handy', 'klingelt', 'laut.'] },
      { id: 'mt_2', german: 'der Computer', article: 'der', arabic: 'الحاسوب', plural: 'die Computer', emoji: '💻', exampleSentenceGerman: 'Ich arbeite am Computer.', exampleSentenceArabic: 'أنا أعمل على الحاسوب.', missingLetterWord: 'Comp_ter', sentence4Elements: ['Ich', 'arbeite', 'am', 'Computer.'] },
      { id: 'mt_3', german: 'das Internet', article: 'das', arabic: 'الإنترنت', emoji: '🌐', exampleSentenceGerman: 'Das Internet ist schnell.', exampleSentenceArabic: 'الإنترنت سريع.', missingLetterWord: 'Intern_t', sentence4Elements: ['Das', 'Internet', 'ist', 'schnell.'] }
    ]
  },

  // ==================== جريد 9 (Grade 9) ====================
  {
    id: 'set_def_13_gesundheit_koerper',
    title: 'Gesundheit und Körperpflege',
    titleTranslations: {
      ar: 'الصحة والرعاية الصحية',
      de: 'Gesundheit und Körperpflege',
      en: 'Health & Care'
    },
    topic: 'الصحة والرعاية',
    topicTranslations: {
      ar: 'الصحة والرعاية',
      de: 'Gesundheit & Medizin',
      en: 'Health & Medicine'
    },
    grade: 'جريد 9',
    level: 'B1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'مفردات الصحة والزيارة عند الطبيب بالألمانية.',
    descriptionTranslations: {
      ar: 'مفردات الصحة والزيارة عند الطبيب بالألمانية.',
      de: 'Wortschatz für Gesundheit und Arztbesuch auf Deutsch.',
      en: 'Vocabulary for health and doctor visits in German.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'gk_1', german: 'der Arzt', article: 'der', arabic: 'الطبيب', plural: 'die Ärzte', emoji: '👨‍⚕️', exampleSentenceGerman: 'Der Arzt hilft Kranken.', exampleSentenceArabic: 'الطبيب يساعد المرضى.', missingLetterWord: 'A_zt', sentence4Elements: ['Der', 'Arzt', 'hilft', 'Kranken.'] },
      { id: 'gk_2', german: 'die Medizin', article: 'die', arabic: 'الدواء / الطب', plural: 'die Medizin', emoji: '💊', exampleSentenceGerman: 'Die Medizin hilft schnell.', exampleSentenceArabic: 'الدواء يساعد بسرعة.', missingLetterWord: 'Mediz_n', sentence4Elements: ['Die', 'Medizin', 'hilft', 'schnell.'] },
      { id: 'gk_3', german: 'gesund bleiben', arabic: 'يحافظ على صحته', emoji: '🍏', exampleSentenceGerman: 'Sport hilft gesund bleiben.', exampleSentenceArabic: 'الرياضة تساعد على البقاء بصحة.', missingLetterWord: 'ges_nd', sentence4Elements: ['Sport', 'hilft', 'gesund', 'bleiben.'] }
    ]
  },

  // ==================== جريد 10 (Grade 10) ====================
  {
    id: 'set_def_14_zukunft_ausbildung',
    title: 'Zukunft und Berufsausbildung',
    titleTranslations: {
      ar: 'المستقبل والتدريب المهني',
      de: 'Zukunft und Berufsausbildung',
      en: 'Future & Training'
    },
    topic: 'المستقبل والمهن',
    topicTranslations: {
      ar: 'المستقبل والمهن',
      de: 'Zukunft & Berufe',
      en: 'Future & Careers'
    },
    grade: 'جريد 10',
    level: 'B1',
    difficulty: 'hard',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'مفردات المستقبل المهني والدراسة بالألمانية.',
    descriptionTranslations: {
      ar: 'مفردات المستقبل المهني والدراسة بالألمانية.',
      de: 'Wortschatz für Zukunft, Ausbildung und Studium.',
      en: 'Vocabulary for career, vocational training, and studies.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'za_1', german: 'die Ausbildung', article: 'die', arabic: 'التدريب المهني', plural: 'die Ausbildungen', emoji: '🎓', exampleSentenceGerman: 'Eine Ausbildung macht Spaß.', exampleSentenceArabic: 'التدريب المهني ممتع.', missingLetterWord: 'Ausb_ldung', sentence4Elements: ['Eine', 'Ausbildung', 'macht', 'Spaß.'] },
      { id: 'za_2', german: 'der Beruf', article: 'der', arabic: 'المهنة / الوظيفة', plural: 'die Berufe', emoji: '💼', exampleSentenceGerman: 'Welchen Beruf wählst du?', exampleSentenceArabic: 'أي مهنة تختار؟', missingLetterWord: 'Ber_f', sentence4Elements: ['Welchen', 'Beruf', 'wählst', 'du?'] },
      { id: 'za_3', german: 'die Zukunft', article: 'die', arabic: 'المستقبل', emoji: '🚀', exampleSentenceGerman: 'Die Zukunft ist voller Chancen.', exampleSentenceArabic: 'المستقبل مليء بالفرص.', missingLetterWord: 'Zuk_nft', sentence4Elements: ['Die', 'Zukunft', 'voller', 'Chancen.'] }
    ]
  },

  // ==================== جريد 11 (Grade 11) ====================
  {
    id: 'set_def_15_gesellschaft_wissenschaft',
    title: 'Gesellschaft und Wissenschaft',
    titleTranslations: {
      ar: 'المجتمع والعلوم الحديثة',
      de: 'Gesellschaft und Wissenschaft',
      en: 'Society & Science'
    },
    topic: 'المجتمع والعلوم',
    topicTranslations: {
      ar: 'المجتمع والعلوم',
      de: 'Gesellschaft & Wissenschaft',
      en: 'Society & Science'
    },
    grade: 'جريد 11',
    level: 'B2',
    difficulty: 'hard',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'مصطلحات علمية ومجتمعية متقدمة للمرحلة الثانوية.',
    descriptionTranslations: {
      ar: 'مصطلحات علمية ومجتمعية متقدمة للمرحلة الثانوية.',
      de: 'Fortgeschrittener Wortschatz für Gesellschaft und Forschung.',
      en: 'Advanced social and scientific terminology.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'gw_1', german: 'die Wissenschaft', article: 'die', arabic: 'العلم / العلوم', plural: 'die Wissenschaften', emoji: '🔬', exampleSentenceGerman: 'Die Wissenschaft entwickelt sich.', exampleSentenceArabic: 'العلم يتطور باستمرار.', missingLetterWord: 'Wissensch_ft', sentence4Elements: ['Die', 'Wissenschaft', 'entwickelt', 'sich.'] },
      { id: 'gw_2', german: 'die Gesellschaft', article: 'die', arabic: 'المجتمع', plural: 'die Gesellschaften', emoji: '👥', exampleSentenceGerman: 'Wir leben in einer modernen Gesellschaft.', exampleSentenceArabic: 'نحن نعيش في مجتمع حديث.', missingLetterWord: 'Gesellsch_ft', sentence4Elements: ['Wir', 'leben', 'modernen', 'Gesellschaft.'] }
    ]
  },

  // ==================== جريد 12 (Grade 12) ====================
  {
    id: 'set_def_16_abitur_deutsch',
    title: 'Abitur und Akademisches Deutsch',
    titleTranslations: {
      ar: 'الألمانية الأكاديمية واختبارات الثانوي',
      de: 'Abitur und Akademisches Deutsch',
      en: 'Academic German & Abitur'
    },
    topic: 'الألمانية الأكاديمية',
    topicTranslations: {
      ar: 'الألمانية الأكاديمية',
      de: 'Akademisches Deutsch',
      en: 'Academic German'
    },
    grade: 'جريد 12',
    level: 'B2',
    difficulty: 'hard',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'تعبير أكاديمي ومصطلحات متقدمة لاجتياز الثانوية والجامعة.',
    descriptionTranslations: {
      ar: 'تعبير أكاديمي ومصطلحات متقدمة لاجتياز الثانوية والجامعة.',
      de: 'Akademischer Wortschatz für Abitur und Universität.',
      en: 'Academic vocabulary for senior exams and university.'
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'ab_1', german: 'die Lösung', article: 'die', arabic: 'الحل الأكاديمي', plural: 'die Lösungen', emoji: '💡', exampleSentenceGerman: 'Wir finden eine kluge Lösung.', exampleSentenceArabic: 'نحن نجد حلاً ذكياً.', missingLetterWord: 'L_sung', sentence4Elements: ['Wir', 'finden', 'kluge', 'Lösung.'] },
      { id: 'ab_2', german: 'die Forschung', article: 'die', arabic: 'البحث العلمي', plural: 'die Forschungen', emoji: '🧪', exampleSentenceGerman: 'Forschung bringt Fortschritt.', exampleSentenceArabic: 'البحث العلمي يجلب التقدم.', missingLetterWord: 'F_rschung', sentence4Elements: ['Forschung', 'bringt', 'großen', 'Fortschritt.'] },
      { id: 'ab_3', german: 'der Erfolg', article: 'der', arabic: 'النجاح والتميز', plural: 'die Erfolge', emoji: '🏆', exampleSentenceGerman: 'Fleiß führt zum Erfolg.', exampleSentenceArabic: 'الاجتهاد يؤدي إلى النجاح.', missingLetterWord: 'E_folg', sentence4Elements: ['Fleiß', 'führt', 'zum', 'Erfolg.'] }
    ]
  }
];
