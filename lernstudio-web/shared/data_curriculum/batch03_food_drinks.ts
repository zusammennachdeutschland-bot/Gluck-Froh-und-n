import { LernstudioSet } from '../../types/lernstudio';

export const BATCH_03_SETS: LernstudioSet[] = [
  // 61. Fruits: Everyday Orchard Fruits (روضة / جريد 1)
  {
    id: 'curric_b03_61_orchard_fruits',
    title: 'Früchte und Obstsorten',
    titleTranslations: { ar: 'الفواكه وثمار البستان', de: 'Früchte und Obstsorten', en: 'Everyday Fruits' },
    topic: 'الفواكه والطعام',
    topicTranslations: { ar: 'الفواكه والطعام', de: 'Obst & Früchte', en: 'Fruits' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'التفاح والموز والبرتقال والكمثرى للأطفال الصغار.',
    descriptionTranslations: { ar: 'التفاح والموز والبرتقال والكمثرى للأطفال الصغار.', de: 'Apfel, Banane, Orange und Birne.', en: 'Apples, bananas, oranges and pears.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_61_01', german: 'der Apfel', arabic: 'التفاحة', article: 'der', plural: 'die Äpfel', emoji: '🍎', exampleSentenceGerman: 'Ein roter Apfel schmeckt knackig und süß.', exampleSentenceArabic: 'التفاحة الحمراء مقرمشة وحلوة المذاق.', missingLetterWord: 'der _pfel', sentence4Elements: ['Ich', 'esse', 'einen', 'gesunden roten Apfel.'] },
      { id: 'b03_61_02', german: 'die Banane', arabic: 'الموزة', article: 'die', plural: 'die Bananen', emoji: '🍌', exampleSentenceGerman: 'Die gelbe Banane ist weich und lecker.', exampleSentenceArabic: 'الموزة الصفراء طرية ولذيذة.', missingLetterWord: 'die Ban_ne', sentence4Elements: ['Der', 'Affe', 'schält', 'die gelbe Banane.'] },
      { id: 'b03_61_03', german: 'die Orange', arabic: 'البرتقالة', article: 'die', plural: 'die Orangen', emoji: '🍊', exampleSentenceGerman: 'Aus der Orange pressen wir frischen Saft.', exampleSentenceArabic: 'من البرتقالة نعصر عصيراً طازجاً.', missingLetterWord: 'die Or_nge', sentence4Elements: ['Die', 'Orange', 'hat', 'viel gesundes Vitamin C.'] },
      { id: 'b03_61_04', german: 'die Birne', arabic: 'الكمثرى (الإجاص)', article: 'die', plural: 'die Birnen', emoji: '🍐', exampleSentenceGerman: 'Die grüne Birne ist saftig und süß.', exampleSentenceArabic: 'الكمثرى الخضراء ممتلئة بالعصير وحلوة.', missingLetterWord: 'die B_rne', sentence4Elements: ['Am', 'Baum', 'hängt', 'eine reife Birne.'] },
      { id: 'b03_61_05', german: 'die Weintraube', arabic: 'حبة العنب', article: 'die', plural: 'die Weintrauben', emoji: '🍇', exampleSentenceGerman: 'Süße Weintrauben schmecken im Sommer gut.', exampleSentenceArabic: 'العنب الحلو لذيذ المذاق في الصيف.', missingLetterWord: 'die W_intraube', sentence4Elements: ['Ich', 'nasche', 'gerne', 'süße grüne Trauben.'] },
      { id: 'b03_61_06', german: 'die Pflaume', arabic: 'البرقوق (الخوخ الأسود)', article: 'die', plural: 'die Pflaumen', emoji: '🫐', exampleSentenceGerman: 'Aus blauen Pflaumen backt Oma einen Kuchen.', exampleSentenceArabic: 'من البرقوق الأزرق تخبز الجدة كعكة شهية.', missingLetterWord: 'die Pfl_ume', sentence4Elements: ['Die', 'Pflaume', 'ist', 'dunkelblau und reif.'] },
      { id: 'b03_61_07', german: 'der Pfirsich', arabic: 'الدراق (الخوخ)', article: 'der', plural: 'die Pfirsiche', emoji: '🍑', exampleSentenceGerman: 'Der samtige Pfirsich riecht wunderbar fruchtig.', exampleSentenceArabic: 'الخوخ المخملي تفوح منه رائحة فاكهية رائعة.', missingLetterWord: 'der Pf_rsich', sentence4Elements: ['Der', 'Pfirsich', 'hat', 'eine samtweiche Schale.'] },
      { id: 'b03_61_08', german: 'die Aprikose', arabic: 'المشمش', article: 'die', plural: 'die Aprikosen', emoji: '🍑', exampleSentenceGerman: 'Die kleine Aprikose schmeckt herrlich süß.', exampleSentenceArabic: 'المشمش الصغير طعمه حلو ورائع.', missingLetterWord: 'die Apr_kose', sentence4Elements: ['Reife', 'Aprikosen', 'leuchten', 'golden am Baum.'] },
      { id: 'b03_61_09', german: 'die Zitrone', arabic: 'الليمونة الحامضة', article: 'die', plural: 'die Zitronen', emoji: '🍋', exampleSentenceGerman: 'Die gelbe Zitrone ist sehr sauer.', exampleSentenceArabic: 'الليمونة الصفراء حامضة جداً.', missingLetterWord: 'die Zitr_ne', sentence4Elements: ['Zitronen', 'sind', 'sauer,', 'aber herrlich erfrischend.'] },
      { id: 'b03_61_10', german: 'das Obst', arabic: 'الفاكهة (بشكل عام)', article: 'das', plural: 'die Obste', emoji: '🍎', exampleSentenceGerman: 'Obst ist gesund und schmeckt jedem Kind.', exampleSentenceArabic: 'الفاكهة صحية ولذيذة لكل طفل.', missingLetterWord: 'das _bst', sentence4Elements: ['Wir', 'essen', 'jeden', 'Tag frisches Obst.'] }
    ]
  },

  // 62. Tropical & Exotic Fruits (جريد 2 / جريد 3)
  {
    id: 'curric_b03_62_tropical_fruits',
    title: 'Exotische Südfrüchte',
    titleTranslations: { ar: 'الفواكه الاستوائية والغريبة', de: 'Exotische Südfrüchte', en: 'Tropical Fruits' },
    topic: 'الفواكه الاستوائية',
    topicTranslations: { ar: 'الفواكه الاستوائية', de: 'Exotische Früchte', en: 'Tropical Fruits' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الأناناس والمانجو والبطيخ والكيوي والبابايا.',
    descriptionTranslations: { ar: 'الأناناس والمانجو والبطيخ والكيوي والبابايا.', de: 'Ananas, Mango, Melone und Kiwi.', en: 'Pineapples, mangoes, watermelons and kiwis.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_62_01', german: 'die Ananas', arabic: 'الأناناس', article: 'die', plural: 'die Ananas', emoji: '🍍', exampleSentenceGerman: 'Die süße Ananas hat eine stachelige Schale.', exampleSentenceArabic: 'الأناناس الحلو لديه قشرة شوكية.', missingLetterWord: 'die An_nas', sentence4Elements: ['Die', 'Ananas', 'schmeckt', 'fruchtig und exotisch.'] },
      { id: 'b03_62_02', german: 'die Mango', arabic: 'المانجو', article: 'die', plural: 'die Mangos', emoji: '🥭', exampleSentenceGerman: 'Die reife Mango ist saftig und orange.', exampleSentenceArabic: 'المانجو الناضجة ممتلئة بالعصير وبرتقالية اللون.', missingLetterWord: 'die M_ngo', sentence4Elements: ['Mango', 'ist', 'meine', 'liebste süße Frucht.'] },
      { id: 'b03_62_03', german: 'die Wassermelone', arabic: 'البطيخ الأحمر (الحبحب)', article: 'die', plural: 'die Wassermelonen', emoji: '🍉', exampleSentenceGerman: 'An heißen Tagen kühlt eine saftige Wassermelone.', exampleSentenceArabic: 'في الأيام الحارة ينعشنا البطيخ الأحمر اللذيذ.', missingLetterWord: 'die W_ssermelone', sentence4Elements: ['Wassermelone', 'enthält', 'sehr', 'viel frisches Wasser.'] },
      { id: 'b03_62_04', german: 'die Honigmelone', arabic: 'الشمام (البطيخ الأصفر)', article: 'die', plural: 'die Honigmelonen', emoji: '🍈', exampleSentenceGerman: 'Die gelbe Honigmelone schmeckt wie Honig.', exampleSentenceArabic: 'الشمام الأصفر حلو المذاق كالعسل.', missingLetterWord: 'die H_nigmelone', sentence4Elements: ['Honigmelone', 'schmeckt', 'hervorragend', 'zum Frühstück heute.'] },
      { id: 'b03_62_05', german: 'die Kiwi', arabic: 'الكيوي', article: 'die', plural: 'die Kiwis', emoji: '🥝', exampleSentenceGerman: 'Die Kiwi löffeln wir mit einem kleinen Löffel aus.', exampleSentenceArabic: 'نأكل الكيوي بملعقة صغيرة.', missingLetterWord: 'die K_wi', sentence4Elements: ['Innen', 'ist', 'die', 'Kiwi leuchtend grün.'] },
      { id: 'b03_62_06', german: 'die Kokosnuss', arabic: 'جوز الهند', article: 'die', plural: 'die Kokosnüsse', emoji: '🥥', exampleSentenceGerman: 'In der Kokosnuss ist erfrischendes Kokoswasser.', exampleSentenceArabic: 'داخل حبة جوز الهند ماء منعش.', missingLetterWord: 'die K_kosnuss', sentence4Elements: ['Die', 'Kokosnuss', 'hat', 'eine harte Schale.'] },
      { id: 'b03_62_07', german: 'die Papaya', arabic: 'البابايا', article: 'die', plural: 'die Papayas', emoji: '🍈', exampleSentenceGerman: 'Die Papaya hat kleine schwarze Kerne im Inneren.', exampleSentenceArabic: 'البابايا بداخلها بذور سوداء صغيرة.', missingLetterWord: 'die Pap_ya', sentence4Elements: ['Die', 'Papaya', 'reift', 'in warmen Ländern.'] },
      { id: 'b03_62_08', german: 'die Feige', arabic: 'التينة', article: 'die', plural: 'die Feigen', emoji: '🫐', exampleSentenceGerman: 'Die reife Feige ist weich und zuckersüß.', exampleSentenceArabic: 'التينة الناضجة طرية وسكرية المذاق.', missingLetterWord: 'die F_ige', sentence4Elements: ['Am', 'Feigenbaum', 'wachsen', 'viele süße Früchte.'] },
      { id: 'b03_62_09', german: 'die Dattel', arabic: 'التمرة / البلح', article: 'die', plural: 'die Datteln', emoji: '🌴', exampleSentenceGerman: 'Auf der Palme wachsen süße braune Datteln.', exampleSentenceArabic: 'على النخلة تنمو تمور بنية وحلوة.', missingLetterWord: 'die D_ttel', sentence4Elements: ['Datteln', 'geben', 'uns', 'schnell neue Energie.'] },
      { id: 'b03_62_10', german: 'der Granatapfel', arabic: 'الرمان', article: 'der', plural: 'die Granatäpfel', emoji: '🍎', exampleSentenceGerman: 'Im Granatapfel glitzern viele rote Kerne wie Rubine.', exampleSentenceArabic: 'في الرمان تتلألأ حبات حمراء كثيرة كالياقوت.', missingLetterWord: 'der Gran_tapfel', sentence4Elements: ['Rote', 'Granatapfelkerne', 'schmecken', 'süß und sauer.'] }
    ]
  },

  // 63. Vegetables: Garden & Salad Greens (روضة / جريد 1)
  {
    id: 'curric_b03_63_garden_vegetables',
    title: 'Gemüse aus dem Garten',
    titleTranslations: { ar: 'الخضروات الطازجة من الحديقة', de: 'Gemüse aus dem Garten', en: 'Garden Vegetables' },
    topic: 'الخضروات الطازجة',
    topicTranslations: { ar: 'الخضروات الطازجة', de: 'Gemüse', en: 'Vegetables' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الجزر والخيار والطماطم والبطاطس للأطفال.',
    descriptionTranslations: { ar: 'الجزر والخيار والطماطم والبطاطس للأطفال.', de: 'Karotte, Gurke, Tomate und Kartoffel.', en: 'Carrots, cucumbers, tomatoes and potatoes.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_63_01', german: 'die Karotte', arabic: 'الجزرة', article: 'die', plural: 'die Karotten', emoji: '🥕', exampleSentenceGerman: 'Das Kaninchen knabbert eine knackige Karotte.', exampleSentenceArabic: 'الأرنب يقضم جزرة مقرمشة.', missingLetterWord: 'die Kar_tte', sentence4Elements: ['Karotten', 'sind', 'gut', 'für unsere Augen.'] },
      { id: 'b03_63_02', german: 'die Tomate', arabic: 'الطماطم (البندورة)', article: 'die', plural: 'die Tomaten', emoji: '🍅', exampleSentenceGerman: 'Die rote Tomate schmeckt lecker im Salat.', exampleSentenceArabic: 'الطماطم الحمراء شهية في السلطة.', missingLetterWord: 'die Tom_te', sentence4Elements: ['Tomaten', 'werden', 'in', 'der Sonne rot.'] },
      { id: 'b03_63_03', german: 'die Gurke', arabic: 'الخيارة', article: 'die', plural: 'die Gurken', emoji: '🥒', exampleSentenceGerman: 'Eine frische Gurke ist kühl und knackig.', exampleSentenceArabic: 'الخيارة الطازجة باردة ومقرمشة.', missingLetterWord: 'die G_rke', sentence4Elements: ['Ich', 'schneide', 'die', 'Gurke in Scheiben.'] },
      { id: 'b03_63_04', german: 'die Kartoffel', arabic: 'البطاطس', article: 'die', plural: 'die Kartoffeln', emoji: '🥔', exampleSentenceGerman: 'Aus Kartoffeln machen wir knusprige Pommes.', exampleSentenceArabic: 'من البطاطس نصنع بطاطس مقلية مقرمشة.', missingLetterWord: 'die Kart_ffel', sentence4Elements: ['Kartoffeln', 'wachsen', 'tief', 'unter der Erde.'] },
      { id: 'b03_63_05', german: 'der Salat', arabic: 'الخس / السلطة الخضراء', article: 'der', plural: 'die Salate', emoji: '🥬', exampleSentenceGerman: 'Der grüne Salat ist knackig und frisch.', exampleSentenceArabic: 'الخس الأخضر طازج ومقرمش.', missingLetterWord: 'der Sal_t', sentence4Elements: ['Mama', 'macht', 'einen', 'bunten großen Salat.'] },
      { id: 'b03_63_06', german: 'die Zwiebel', arabic: 'البصلة', article: 'die', plural: 'die Zwiebeln', emoji: '🧅', exampleSentenceGerman: 'Beim Zwiebelschneiden tränen mir die Augen.', exampleSentenceArabic: 'عند تقطيع البصل تدمع عيناي.', missingLetterWord: 'die Zwi_bel', sentence4Elements: ['Die', 'Zwiebel', 'gibt', 'dem Essen Geschmack.'] },
      { id: 'b03_63_07', german: 'der Knoblauch', arabic: 'الثوم', article: 'der', plural: 'die Knoblauche', emoji: '🧄', exampleSentenceGerman: 'Knoblauch riecht stark und ist sehr gesund.', exampleSentenceArabic: 'الثوم ذو رائحة قوية ومفيد جداً للصحة.', missingLetterWord: 'der Kn_blauch', sentence4Elements: ['Eine', 'Zehe', 'Knoblauch', 'in die Sauce.'] },
      { id: 'b03_63_08', german: 'die Paprika', arabic: 'الفلفل الحلو (الرومي)', article: 'die', plural: 'die Paprikas', emoji: '🫑', exampleSentenceGerman: 'Paprika gibt es in Rot, Gelb und Grün.', exampleSentenceArabic: 'الفلفل الرومي يوجد باللون الأحمر والأصفر والأخضر.', missingLetterWord: 'die P_prika', sentence4Elements: ['Bunte', 'Paprika', 'sieht', 'im Salat fröhlich aus.'] },
      { id: 'b03_63_09', german: 'der Mais', arabic: 'الذرة الصفراء', article: 'der', plural: 'die Maise', emoji: '🌽', exampleSentenceGerman: 'Wir essen gegrillten Maiskolben mit Butter.', exampleSentenceArabic: 'نأكل كوز ذرة مشوياً مع الزبدة.', missingLetterWord: 'der M_is', sentence4Elements: ['Der', 'Mais', 'ist', 'leuchtend gelb und süß.'] },
      { id: 'b03_63_10', german: 'das Gemüse', arabic: 'الخضروات (الكلمة العامة)', article: 'das', plural: 'die Gemüse', emoji: '🥗', exampleSentenceGerman: 'Buntes Gemüse macht Kinder stark und fit.', exampleSentenceArabic: 'الخضار المتنوع يقوي الأطفال وينشطهم.', missingLetterWord: 'das Gem_se', sentence4Elements: ['Gemüse', 'essen', 'wir', 'jeden Tag gern.'] }
    ]
  },

  // 64. Vegetables: Greens, Cabbage & Broccoli (جريد 2 / جريد 3)
  {
    id: 'curric_b03_64_cabbage_greens',
    title: 'Kohl, Brokkoli und Blattgemüse',
    titleTranslations: { ar: 'الملفوف والبروكلي والخضار الورقية', de: 'Kohl, Brokkoli und Blattgemüse', en: 'Cabbage, Broccoli & Greens' },
    topic: 'الخضروات الورقية',
    topicTranslations: { ar: 'الخضروات الورقية', de: 'Blattgemüse', en: 'Leafy Greens' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'البروكلي والقرنبيط والسبانخ والملفوف والبازلاء.',
    descriptionTranslations: { ar: 'البروكلي والقرنبيط والسبانخ والملفوف والبازلاء.', de: 'Brokkoli, Spinat, Erbse und Blumenkohl.', en: 'Broccoli, spinach, peas and cauliflower.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_64_01', german: 'der Brokkoli', arabic: 'البروكلي (القرنبيط الأخضر)', article: 'der', plural: 'die Brokkolis', emoji: '🥦', exampleSentenceGerman: 'Brokkoli sieht aus wie kleine grüne Mini-Bäumchen.', exampleSentenceArabic: 'البروكلي يشبه أشجاراً خضراء مصغرة.', missingLetterWord: 'der Br_kkoli', sentence4Elements: ['Brokkoli', 'enthält', 'viele', 'wertvolle Vitamine heute.'] },
      { id: 'b03_64_02', german: 'der Blumenkohl', arabic: 'القرنبيط الأبيض (الزهرة)', article: 'der', plural: 'die Blumenkohle', emoji: '🥦', exampleSentenceGerman: 'Gekochter Blumenkohl schmeckt mit milder weißer Sauce.', exampleSentenceArabic: 'القرنبيط المسلوق شهي مع الصلصة البيضاء الخفيفة.', missingLetterWord: 'der Bl_menkohl', sentence4Elements: ['Der', 'Blumenkohl', 'ist', 'weiß und zart.'] },
      { id: 'b03_64_03', german: 'der Spinat', arabic: 'السبانخ', article: 'der', plural: 'die Spinate', emoji: '🥬', exampleSentenceGerman: 'Spinat mit Spiegelei und Kartoffeln schmeckt super.', exampleSentenceArabic: 'السبانخ مع البيض المقلي والبطاطس وجبة ممتازة.', missingLetterWord: 'der Sp_nat', sentence4Elements: ['Spinat', 'macht', 'uns', 'stark wie Popeye!'] },
      { id: 'b03_64_04', german: 'die Erbse', arabic: 'البازلاء (البسلة)', article: 'die', plural: 'die Erbsen', emoji: '🟢', exampleSentenceGerman: 'Kleine grüne Erbsen kullern lustig über den Teller.', exampleSentenceArabic: 'حبات البازلاء الخضراء الصغيرة تتدحرج بمرح على الطبق.', missingLetterWord: 'die _rbse', sentence4Elements: ['Süße', 'Erbsen', 'schmecken', 'den Kindern gut.'] },
      { id: 'b03_64_05', german: 'die Bohne', arabic: 'الفاصوليا / الفول', article: 'die', plural: 'die Bohnen', emoji: '🫘', exampleSentenceGerman: 'Grüne Bohnen kochen wir mit einer Prise Bohnenkraut.', exampleSentenceArabic: 'نطهو الفاصوليا الخضراء برشة من الأعشاب العطرية.', missingLetterWord: 'die B_hne', sentence4Elements: ['Bohnen', 'wachsen', 'an', 'hohen Stangen hoch.'] },
      { id: 'b03_64_06', german: 'die Zucchini', arabic: 'الكوسا', article: 'die', plural: 'die Zucchinis', emoji: '🥒', exampleSentenceGerman: 'Im Garten wachsen riesige grüne Zucchinis.', exampleSentenceArabic: 'في الحديقة تنمو حبات كوسا خضراء ضخمة.', missingLetterWord: 'die Z_cchini', sentence4Elements: ['Mama', 'brät', 'die', 'Zucchini in Olivenöl an.'] },
      { id: 'b03_64_07', german: 'die Aubergine', arabic: 'الباذنجان', article: 'die', plural: 'die Auberginen', emoji: '🍆', exampleSentenceGerman: 'Die glänzende Aubergine ist dunkelviolett gefärbt.', exampleSentenceArabic: 'الباذنجانة اللامعة لونها بنفسجي داكن.', missingLetterWord: 'die Aub_rgine', sentence4Elements: ['Die', 'Aubergine', 'wird', 'beim Braten butterweich.'] },
      { id: 'b03_64_08', german: 'der Kohl', arabic: 'الملفوف (الكرنب)', article: 'der', plural: 'die Kohle', emoji: '🥬', exampleSentenceGerman: 'Im Winter essen wir wärmenden Gemüseeintopf mit Kohl.', exampleSentenceArabic: 'في الشتاء نتناول حساء الخضار الدافئ مع الكرنب.', missingLetterWord: 'der K_hl', sentence4Elements: ['Ein', 'Kohlkopf', 'hat', 'viele feste Blätter.'] },
      { id: 'b03_64_09', german: 'das Radieschen', arabic: 'الفجل الأحمر الصغير', article: 'das', plural: 'die Radieschen', emoji: '🔴', exampleSentenceGerman: 'Das rote Radieschen schmeckt knackig und leicht scharf.', exampleSentenceArabic: 'الفجل الأحمر الصغير مقرمش ولاذع النكهة قليلاً.', missingLetterWord: 'das Rad_eschen', sentence4Elements: ['Radieschen', 'passen', 'herrlich', 'auf das Butterbrot.'] },
      { id: 'b03_64_10', german: 'der Kürbis', arabic: 'اليقطين (القرع العسلي)', article: 'der', plural: 'die Kürbisse', emoji: '🎃', exampleSentenceGerman: 'Kürbissuppe mit gerösteten Kernen wärmt im Herbst.', exampleSentenceArabic: 'شوربة اليقطين مع البذور المحمصة تدفئنا في الخريف.', missingLetterWord: 'der K_rbis', sentence4Elements: ['Der', 'Kürbis', 'ist', 'orange, rund und schwer.'] }
    ]
  },

  // 65. Bread & Bakery Products (جريد 1 / جريد 2)
  {
    id: 'curric_b03_65_bread_bakery',
    title: 'Brot und Backwaren',
    titleTranslations: { ar: 'الخبز والمخبوزات الطازجة', de: 'Brot und Backwaren', en: 'Bread and Bakery' },
    topic: 'المخبوزات والخبز',
    topicTranslations: { ar: 'المخبوزات والخبز', de: 'Bäckerei', en: 'Bakery' },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'أنواع الخبز والخبز الصغير والبري Pretzel في ألمانيا.',
    descriptionTranslations: { ar: 'أنواع الخبز والخبز الصغير والبريتزل.', de: 'Brot, Brötchen, Brezel und Croissant.', en: 'Bread, rolls, pretzels and croissants.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_65_01', german: 'das Brot', arabic: 'الخبز (الرغيف الكبير)', article: 'das', plural: 'die Brote', emoji: '🍞', exampleSentenceGerman: 'Deutsches Brot ist weltweit berühmt für seine Qualität.', exampleSentenceArabic: 'الخبز الألماني مشهور عالمياً بجودته العالية.', missingLetterWord: 'das Br_t', sentence4Elements: ['Frisches', 'Brot', 'duftet', 'herrlich aus der Backstube.'] },
      { id: 'b03_65_02', german: 'das Brötchen', arabic: 'الخبز الصغير (الفينو / السميط الألماني)', article: 'das', plural: 'die Brötchen', emoji: '🥖', exampleSentenceGerman: 'Sonntags holen wir warme Brötchen beim Bäcker.', exampleSentenceArabic: 'أيام الآحاد نحضر خبزاً صغيراً ساخناً من المخبز.', missingLetterWord: 'das Br_tchen', sentence4Elements: ['Ein', 'Brötchen', 'mit', 'Butter schmeckt lecker.'] },
      { id: 'b03_65_03', german: 'die Brezel', arabic: 'البريتزل الألماني الشهير (المملح)', article: 'die', plural: 'die Brezeln', emoji: '🥨', exampleSentenceGerman: 'Die Brezel ist mit feinen Salzkörnern bestreut.', exampleSentenceArabic: 'البريتزل مرشوش بحبيبات ملح ناعمة.', missingLetterWord: 'die Br_zel', sentence4Elements: ['Eine', 'knusprige', 'Brezel', 'ist typisch für Bayern.'] },
      { id: 'b03_65_04', german: 'das Vollkornbrot', arabic: 'خبز الحبوب الكاملة (الخبز الأسمر)', article: 'das', plural: 'die Vollkornbrote', emoji: '🍞', exampleSentenceGerman: 'Vollkornbrot hält lange satt und gibt viel Kraft.', exampleSentenceArabic: 'خبز الحبوب الكاملة يشبع لفترة طويلة ويمنح طاقة.', missingLetterWord: 'das V_llkornbrot', sentence4Elements: ['Vollkornbrot', 'ist', 'besonders', 'gesund für den Körper.'] },
      { id: 'b03_65_05', german: 'das Toastbrot', arabic: 'خبز التوست المحمص', article: 'das', plural: 'die Toastbrote', emoji: '🍞', exampleSentenceGerman: 'Ich stecke zwei Scheiben Toastbrot in den Toaster.', exampleSentenceArabic: 'أضع شريحتين من خبز التوست في الحماصة.', missingLetterWord: 'das T_astbrot', sentence4Elements: ['Der', 'Toast', 'wird', 'im Toaster goldbraun.'] },
      { id: 'b03_65_06', german: 'das Croissant', arabic: 'الكرواسون الهش', article: 'das', plural: 'die Croissants', emoji: '🥐', exampleSentenceGerman: 'Das butterzarte Croissant schmilzt fast auf der Zunge.', exampleSentenceArabic: 'الكرواسون الهش بالزبدة يذوب في الفم تقريباً.', missingLetterWord: 'das Cr_issant', sentence4Elements: ['Ein', 'Croissant', 'zum', 'Frühstück schmeckt fein.'] },
      { id: 'b03_65_07', german: 'das Baguette', arabic: 'الخبز الفرنسي الطويل (الباغيت)', article: 'das', plural: 'die Baguettes', emoji: '🥖', exampleSentenceGerman: 'Das knusprige Baguette teilen wir zum Abendbrot.', exampleSentenceArabic: 'نتشارك خبز الباغيت المقرمش في وجبة العشاء.', missingLetterWord: 'das Bag_ette', sentence4Elements: ['Das', 'lange', 'Baguette', 'knackt beim Schneiden.'] },
      { id: 'b03_65_08', german: 'die Kruste', arabic: 'قشرة الخبز المقرمشة', article: 'die', plural: 'die Krusten', emoji: '🥖', exampleSentenceGerman: 'Ich esse die knusprige Kruste vom Brot am liebsten.', exampleSentenceArabic: 'أفضل أكل قشرة الخبز المحمصة المقرمشة.', missingLetterWord: 'die Kr_ste', sentence4Elements: ['Die', 'Kruste', 'ist', 'herrlich braun gebacken.'] },
      { id: 'b03_65_09', german: 'die Bäckerei', arabic: 'المخبز', article: 'die', plural: 'die Bäckereien', emoji: '🏪', exampleSentenceGerman: 'In der Bäckerei duftet es morgens nach Teig und Zimt.', exampleSentenceArabic: 'في المخبز تفوح صباحاً رائحة العجين والقرفة.', missingLetterWord: 'die B_ckerei', sentence4Elements: ['Wir', 'kaufen', 'Brot', 'in der Bäckerei.'] },
      { id: 'b03_65_10', german: 'der Bäcker', arabic: 'الخباز', article: 'der', plural: 'die Bäcker', emoji: '👨‍🍳', exampleSentenceGerman: 'Der Bäcker steht schon mitten in der Nacht auf.', exampleSentenceArabic: 'الخباز يستيقظ في منتصف الليل لبدء العمل.', missingLetterWord: 'der B_cker', sentence4Elements: ['Der', 'Bäcker', 'knetet', 'den Teig fleißig.'] }
    ]
  },

  // 66. Dairy & Milk Products (روضة / جريد 1)
  {
    id: 'curric_b03_66_dairy_milk',
    title: 'Milch und Milchprodukte',
    titleTranslations: { ar: 'الحليب ومنتجات الألبان', de: 'Milch und Milchprodukte', en: 'Milk & Dairy Products' },
    topic: 'منتجات الألبان',
    topicTranslations: { ar: 'منتجات الألبان', de: 'Milchprodukte', en: 'Dairy Products' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الحليب والجبن والزبادي والزبدة والقشطة للأطفال.',
    descriptionTranslations: { ar: 'الحليب والجبن والزبادي والزبدة والقشطة.', de: 'Milch, Käse, Joghurt und Butter.', en: 'Milk, cheese, yogurt and butter.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_66_01', german: 'die Milch', arabic: 'الحليب / اللبن', article: 'die', plural: 'die Milche', emoji: '🥛', exampleSentenceGerman: 'Ein Glas kalte Milch stärkt Zähne und Knochen.', exampleSentenceArabic: 'كوب حليب بارد يقوي الأسنان والعظام.', missingLetterWord: 'die M_lch', sentence4Elements: ['Kinder', 'trinken', 'jeden', 'Morgen frische Milch.'] },
      { id: 'b03_66_02', german: 'der Käse', arabic: 'الجبن', article: 'der', plural: 'die Käse', emoji: '🧀', exampleSentenceGerman: 'Eine Scheibe gelber Käse schmeckt auf dem Brötchen.', exampleSentenceArabic: 'شريحة جبن صفراء شهية فوق رغيف الخبز.', missingLetterWord: 'der K_se', sentence4Elements: ['Der', 'Käse', 'hat', 'manchmal lustige Löcher.'] },
      { id: 'b03_66_03', german: 'die Butter', arabic: 'الزبدة', article: 'die', plural: 'die Butter', emoji: '🧈', exampleSentenceGerman: 'Ich streiche weiche Butter auf mein warmes Brot.', exampleSentenceArabic: 'أدهن الزبدة الطرية فوق خبزي الدافئ.', missingLetterWord: 'die B_tter', sentence4Elements: ['Butter', 'schmilzt', 'auf', 'dem warmen Toast.'] },
      { id: 'b03_66_04', german: 'der Joghurt', arabic: 'الزبادي (اللبن الرائب)', article: 'der', plural: 'die Joghurts', emoji: '🥣', exampleSentenceGerman: 'Erdbeerjoghurt mit Beeren schmeckt herrlich frisch.', exampleSentenceArabic: 'زبادي الفراولة مع حبات التوت منعش ولذيذ.', missingLetterWord: 'der J_ghurt', sentence4Elements: ['Ich', 'löffle', 'meinen', 'Joghurt mit Genuss.'] },
      { id: 'b03_66_05', german: 'der Quark', arabic: 'جبن الكوارك (الجبن القريش الألماني)', article: 'der', plural: 'die Quarks', emoji: '🥣', exampleSentenceGerman: 'Kräuterquark schmeckt hervorragend zu Pellkartoffeln.', exampleSentenceArabic: 'جبن الكوارك بالأعشاب رائع مع البطاطس المسلوقة.', missingLetterWord: 'der Qu_rk', sentence4Elements: ['Quark', 'enthält', 'besonders', 'viel gutes Eiweiß.'] },
      { id: 'b03_66_06', german: 'die Sahne', arabic: 'القشطة / الكريمة المخفوقة', article: 'die', plural: 'die Sahnen', emoji: '🍨', exampleSentenceGerman: 'Auf dem warmen Apfelkuchen sitzt eine Haube Sahne.', exampleSentenceArabic: 'فوق كعكة التفاح الدافئة توضع طبقة من الكريمة المخفوقة.', missingLetterWord: 'die S_hne', sentence4Elements: ['Süße', 'Sahne', 'schmeckt', 'köstlich zu Erdbeeren.'] },
      { id: 'b03_66_07', german: 'der Frischkäse', arabic: 'الجبن الكريمي الطازج للدهن', article: 'der', plural: 'die Frischkäse', emoji: '🧀', exampleSentenceGerman: 'Frischkäse mit Schnittlauch schmeckt auf Knäckebrot.', exampleSentenceArabic: 'الجبن الكريمي بالثوم المعمر لذيذ مع المقرمشات.', missingLetterWord: 'der Fr_schkäse', sentence4Elements: ['Ich', 'streiche', 'Frischkäse', 'auf mein Brot.'] },
      { id: 'b03_66_08', german: 'die Buttermilch', arabic: 'مخيض اللبن (اللبن الخاثر)', article: 'die', plural: 'die Buttermilche', emoji: '🥛', exampleSentenceGerman: 'Zitronen-Buttermilch ist an heißen Tagen erfrischeند.', exampleSentenceArabic: 'مخيض اللبن بالليمون منعش جداً في الأيام الحارة.', missingLetterWord: 'die B_ttermilch', sentence4Elements: ['Kühle', 'Buttermilch', 'löscht', 'den großen Durst.'] },
      { id: 'b03_66_09', german: 'der Kakao', arabic: 'حليب الشوكولاتة والكاكاو', article: 'der', plural: 'die Kakaos', emoji: '☕', exampleSentenceGerman: 'Ein Becher warmer Kakao tröstet an kalten Tagen.', exampleSentenceArabic: 'كوب من الكاكاو الدافئ يريح في الأيام الباردة.', missingLetterWord: 'der K_kao', sentence4Elements: ['Warmer', 'Kakao', 'schmeckt', 'nach süßer Schokolade.'] },
      { id: 'b03_66_10', german: 'die Kuhmilch', arabic: 'حليب الأبقار الطازج', article: 'die', plural: 'die Kuhmilche', emoji: '🐄', exampleSentenceGerman: 'Frische Kuhmilch kommt direkt vom Bauernhof.', exampleSentenceArabic: 'حليب الأبقار الطازج يأتي مباشرة من المزرعة.', missingLetterWord: 'die K_hmilch', sentence4Elements: ['Kuhmilch', 'wird', 'in', 'der Molkerei abgefüllt.'] }
    ]
  },

  // 67. The German Breakfast Table (روضة / جريد 1)
  {
    id: 'curric_b03_67_breakfast_table',
    title: 'Der Frühstückstisch',
    titleTranslations: { ar: 'مائدة الإفطار الصباحي', de: 'Der Frühstückstisch', en: 'The Breakfast Table' },
    topic: 'وجبة الإفطار',
    topicTranslations: { ar: 'وجبة الإفطار', de: 'Frühstück', en: 'Breakfast' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'البيض والمربى والعسل ورقائق الحبوب والشاي للإفطار.',
    descriptionTranslations: { ar: 'البيض والمربى والعسل ورقائق الحبوب.', de: 'Ei, Marmelade, Honig, Müsli und Tee.', en: 'Eggs, jam, honey, muesli and tea.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_67_01', german: 'das Frühstück', arabic: 'وجبة الإفطار', article: 'das', plural: 'die Frühstücke', emoji: '🍳', exampleSentenceGerman: 'Ein gutes Frühstück gibt uns Energie für den Schultag.', exampleSentenceArabic: 'الإفطار الجيد يمنحنا طاقة ليومنا المدرسي.', missingLetterWord: 'das Fr_hstück', sentence4Elements: ['Wir', 'frühstücken', 'morgens', 'alle friedlich zusammen.'] },
      { id: 'b03_67_02', german: 'das Ei', arabic: 'البيضة', article: 'das', plural: 'die Eier', emoji: '🥚', exampleSentenceGerman: 'Sonntags kocht Papa für jeden ein weiches Ei.', exampleSentenceArabic: 'في أيام الآحاد يسلق أبي بيضة نصف ناضجة لكل منا.', missingLetterWord: 'das _i', sentence4Elements: ['Das', 'Ei', 'hat', 'ein leuchtend gelbes Eigelb.'] },
      { id: 'b03_67_03', german: 'die Marmelade', arabic: 'المربى (مربى الفاكهة)', article: 'die', plural: 'die Marmeladen', emoji: '🍓', exampleSentenceGerman: 'Rote Erdbeermarmelade schmeckt herrlich auf dem Toast.', exampleSentenceArabic: 'مربى الفراولة الحمراء لذيذة على شريحة التوست.', missingLetterWord: 'die M_rmelade', sentence4Elements: ['Süße', 'Marmelade', 'macht', 'mein Brötchen fruchtig.'] },
      { id: 'b03_67_04', german: 'der Honig', arabic: 'عسل النحل', article: 'der', plural: 'die Honige', emoji: '🍯', exampleSentenceGerman: 'Goldener Honig von fleißigen Bienen schmeckt süß.', exampleSentenceArabic: 'العسل الذهبي من النحل النشيط طعمه حلو.', missingLetterWord: 'der H_nig', sentence4Elements: ['Ich', 'mag', 'Honig', 'in meinem warmen Tee.'] },
      { id: 'b03_67_05', german: 'das Müsli', arabic: 'الموسلي (خليط الشوفان والمكسرات والفواكه)', article: 'das', plural: 'die Müslis', emoji: '🥣', exampleSentenceGerman: 'Ich rühre knuspriges Müsli in meine Schüssel Milch.', exampleSentenceArabic: 'أخلط الموسلي المقرمش في وعاء الحليب الخاص بي.', missingLetterWord: 'das M_sli', sentence4Elements: ['Knuspriges', 'Müsli', 'mit', 'frischen Früchten schmeckt.'] },
      { id: 'b03_67_06', german: 'die Haferflocken', arabic: 'رقائق الشوفان', article: 'die', plural: 'die Haferflocken', emoji: '🌾', exampleSentenceGerman: 'Warmer Haferbrei ist ein gesundes Frühstück.', exampleSentenceArabic: 'عصيدة الشوفان الدافئة إفطار صحي للغاية.', missingLetterWord: 'die H_ferflocken', sentence4Elements: ['Haferflocken', 'geben', 'Kraft', 'für das Lernen.'] },
      { id: 'b03_67_07', german: 'der Tee', arabic: 'الشاي', article: 'der', plural: 'die Tees', emoji: '🍵', exampleSentenceGerman: 'Kamillentee mit etwas Honig wärmt den Bauch.', exampleSentenceArabic: 'شاي البابونج بقليل من العسل يريح المعدة.', missingLetterWord: 'der T_e', sentence4Elements: ['Mama', 'trinkt', 'morgens', 'gerne warmen Früchtetee.'] },
      { id: 'b03_67_08', german: 'der Saft', arabic: 'العصير الطبيعي', article: 'der', plural: 'die Säfte', emoji: '🧃', exampleSentenceGerman: 'Orangensaft schmeckt frisch gepresst am besten.', exampleSentenceArabic: 'عصير البرتقال الطازج أطيب ما يكون عند عصره فوراً.', missingLetterWord: 'der S_ft', sentence4Elements: ['Ein', 'Glas', 'Saft', 'steht auf dem Tisch.'] },
      { id: 'b03_67_09', german: 'die Nuss-Nugat-Creme', arabic: 'كريمة الشوكولاتة والبندق (نوتيلا)', article: 'die', plural: 'die Nuss-Nugat-Cremes', emoji: '🍫', exampleSentenceGerman: 'Am Wochenende darf ich Schokocreme aufs Brot streichen.', exampleSentenceArabic: 'في عطلة نهاية الأسبوع يُسمح لي بدهن شوكولاتة البندق.', missingLetterWord: 'N_ss-Nugat-Creme', sentence4Elements: ['Schokocreme', 'auf', 'frischem', 'Brot ist ein Traum.'] },
      { id: 'b03_67_10', german: 'frühstücken', arabic: 'يتناول طعام الإفطار', emoji: '🍳', exampleSentenceGerman: 'Wir frühstücken jeden Morgen um sieben Uhr.', exampleSentenceArabic: 'نتناول إفطارنا كل صباح في تمام الساعة السابعة.', missingLetterWord: 'fr_hstücken', sentence4Elements: ['Wir', 'frühstücken', 'immer', 'vor der Schule zusammen.'] }
    ]
  },

  // 68. Lunch Dishes: Favorite Kids' Meals (جريد 1 / جريد 2)
  {
    id: 'curric_b03_68_lunch_kids_meals',
    title: 'Lieblingsessen zu Mittag',
    titleTranslations: { ar: 'أكلات الغداء المفضلة للأطفال', de: 'Lieblingsessen zu Mittag', en: 'Favorite Kids Lunches' },
    topic: 'وجبة الغداء',
    topicTranslations: { ar: 'وجبة الغداء', de: 'Mittagessen', en: 'Lunch Meals' },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'المعكرونة والبيتزا والبطاطس المقلية والشوربة.',
    descriptionTranslations: { ar: 'المعكرونة والبيتزا والبطاطس والشوربة.', de: 'Nudeln, Pizza, Pommes und Suppe.', en: 'Pasta, pizza, fries and soup.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_68_01', german: 'das Mittagessen', arabic: 'وجبة الغداء', article: 'das', plural: 'die Mittagessen', emoji: '🍽️', exampleSentenceGerman: 'Um zwölf Uhr gibt es leckeres Mittagessen.', exampleSentenceArabic: 'في الثانية عشرة نتناول غداءً شهياً.', missingLetterWord: 'das M_ttagessen', sentence4Elements: ['Das', 'Mittagessen', 'riecht', 'schon durchs Haus.'] },
      { id: 'b03_68_02', german: 'die Nudeln', arabic: 'المعكرونة (المكرونة)', article: 'die', plural: 'die Nudeln', emoji: '🍝', exampleSentenceGerman: 'Nudeln mit Tomatensauce ist mein absolutes Lieblingsessen!', exampleSentenceArabic: 'المعكرونة بصلصة الطماطم هي أكلتي المفضلة على الإطلاق!', missingLetterWord: 'die N_deln', sentence4Elements: ['Kinder', 'essen', 'Nudeln', 'mit Tomatensauce gern.'] },
      { id: 'b03_68_03', german: 'die Tomatensauce', arabic: 'صلصة الطماطم اللذيذة', article: 'die', plural: 'die Tomatensaucen', emoji: '🥫', exampleSentenceGerman: 'Die rote Tomatensauce kocht mit frischem Basilikum.', exampleSentenceArabic: 'صلصة الطماطم الحمراء تطهى مع الريحان الطازج.', missingLetterWord: 'die Tom_tensauce', sentence4Elements: ['Mama', 'kocht', 'die', 'beste Tomatensauce der Welt.'] },
      { id: 'b03_68_04', german: 'die Pizza', arabic: 'البيتزا', article: 'die', plural: 'die Pizzen', emoji: '🍕', exampleSentenceGerman: 'Wir belegen eine Pizza mit Käse und Tomaten.', exampleSentenceArabic: 'نزين البيتزا بالجبن والطماطم.', missingLetterWord: 'die P_zza', sentence4Elements: ['Heiße', 'Pizza', 'aus', 'dem Ofen schmeckt fantastisch.'] },
      { id: 'b03_68_05', german: 'die Pommes', arabic: 'البطاطس المقلية (فرينش فرايز)', article: 'die', plural: 'die Pommes', emoji: '🍟', exampleSentenceGerman: 'Knusprige Pommes mit Ketchup schmecken jedem Kind.', exampleSentenceArabic: 'البطاطس المقلية المقرمشة مع الكاتشب تسعد كل الأطفال.', missingLetterWord: 'die P_mmes', sentence4Elements: ['Pommes', 'sind', 'golden,', 'knusprig und salzig.'] },
      { id: 'b03_68_06', german: 'die Suppe', arabic: 'الحساء / الشوربة', article: 'die', plural: 'die Suppen', emoji: '🍲', exampleSentenceGerman: 'Eine warme Gemüsesuppe schmeckt an kalten Tagen gut.', exampleSentenceArabic: 'شوربة الخضار الدافئة رائعة في الأيام الباردة.', missingLetterWord: 'die S_ppe', sentence4Elements: ['Die', 'heiße', 'Suppe', 'wärmt von innen.'] },
      { id: 'b03_68_07', german: 'der Reis', arabic: 'الأرز', article: 'der', plural: 'die Reise', emoji: '🍚', exampleSentenceGerman: 'Wir essen weißen Reis mit buntem Gemüse.', exampleSentenceArabic: 'نأكل أرزاً أبيض مع خضار ملون شهي.', missingLetterWord: 'der R_is', sentence4Elements: ['Reis', 'wird', 'mit', 'etwas Salz gekocht.'] },
      { id: 'b03_68_08', german: 'der Pfannkuchen', arabic: 'البان كيك / الفطيرة المحلاة', article: 'der', plural: 'die Pfannkuchen', emoji: '🥞', exampleSentenceGerman: 'Oma backt Pfannkuchen mit Apfelmus.', exampleSentenceArabic: 'الجدة تخبز بان كيك مع بيوريه التفاح.', missingLetterWord: 'der Pf_nnkuchen', sentence4Elements: ['Süße', 'Pfannkuchen', 'sind', 'goldgelb in der Pfanne.'] },
      { id: 'b03_68_09', german: 'die Würstchen', arabic: 'السجق الصغير (النقانق)', article: 'die', plural: 'die Würstchen', emoji: '🌭', exampleSentenceGerman: 'Zum Kartoffelsalat gibt es warme Würstchen.', exampleSentenceArabic: 'مع سلطة البطاطس نقدم نقانق ساخنة.', missingLetterWord: 'die W_rstchen', sentence4Elements: ['Würstchen', 'mit', 'Senf', 'schmecken typisch deutsch.'] },
      { id: 'b03_68_10', german: 'das Hähnchen', arabic: 'الدجاج المحمر', article: 'das', plural: 'die Hähnchen', emoji: '🍗', exampleSentenceGerman: 'Das gebratene Hähnchen hat eine knusprige Haut.', exampleSentenceArabic: 'الدجاج المحمر لديه قشرة مقرمشة شهية.', missingLetterWord: 'das H_hnchen', sentence4Elements: ['Knuspriges', 'Hähnchen', 'gibt', 'es heute zu Mittag.'] }
    ]
  },

  // 69. Dinner & Evening Meals (جريد 2 / جريد 3)
  {
    id: 'curric_b03_69_dinner_evening',
    title: 'Das deutsche Abendbrot',
    titleTranslations: { ar: 'وجبة العشاء والتقاليد الألمانية', de: 'Das deutsche Abendbrot', en: 'German Evening Meal' },
    topic: 'وجبة العشاء',
    topicTranslations: { ar: 'وجبة العشاء', de: 'Abendessen', en: 'Dinner' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'خبز العشاء والجبن وشرائح اللحم الباردة والشاي.',
    descriptionTranslations: { ar: 'خبز العشاء والجبن وشرائح اللحم الباردة.', de: 'Abendbrot, Käse, Schinken und Tee.', en: 'Evening bread, cold cuts, cheese and tea.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_69_01', german: 'das Abendbrot', arabic: 'وجبة العشاء (الخبز المسائي في ألمانيا)', article: 'das', plural: 'die Abendbrote', emoji: '🥪', exampleSentenceGerman: 'Um achtzehn Uhr sitzen wir alle beim Abendbrot.', exampleSentenceArabic: 'في السادسة مساءً نجلس جميعاً حول مائدة العشاء.', missingLetterWord: 'das _bendbrot', sentence4Elements: ['Beim', 'Abendbrot', 'erzählen', 'wir vom Schultag.'] },
      { id: 'b03_69_02', german: 'die Scheibe', arabic: 'الشريحة (شريحة خبز أو جبن)', article: 'die', plural: 'die Scheiben', emoji: '🍞', exampleSentenceGerman: 'Ich schneide eine dicke Scheibe Graubrot ab.', exampleSentenceArabic: 'أقطع شريحة سميكة من الخبز الريفي.', missingLetterWord: 'die Sch_ibe', sentence4Elements: ['Eine', 'Scheibe', 'Käse', 'liegt auf dem Brot.'] },
      { id: 'b03_69_03', german: 'die Wurst', arabic: 'السجق / شرائح المارتديلا الباردة', article: 'die', plural: 'die Würste', emoji: '🥪', exampleSentenceGerman: 'Auf dem Brotzeitteller liegen verschiedene Wurstsorten.', exampleSentenceArabic: 'في طبق العشاء تتنوع أصناف اللحوم الباردة.', missingLetterWord: 'die W_rst', sentence4Elements: ['Eine', 'Scheibe', 'Wurst', 'auf das Butterbrot.'] },
      { id: 'b03_69_04', german: 'die Essiggurke', arabic: 'الخيار المخلل', article: 'die', plural: 'die Essiggurken', emoji: '🥒', exampleSentenceGerman: 'Eine saure Essiggurke passt wunderbar zum Käsebrot.', exampleSentenceArabic: 'الخيارة المخللة الحامضة تناسب شطيرة الجبن تماماً.', missingLetterWord: 'die _ssiggurke', sentence4Elements: ['Saure', 'Gurken', 'sind', 'knackig und würzig.'] },
      { id: 'b03_69_05', german: 'die Butterdose', arabic: 'علبة الزبدة (حافظة الزبدة)', article: 'die', plural: 'die Butterdosen', emoji: '🧈', exampleSentenceGerman: 'Reich mir bitte mal die Butterdose rüber!', exampleSentenceArabic: 'ناولني علبة الزبدة من فضلك!', missingLetterWord: 'die B_tterdose', sentence4Elements: ['Die', 'Butterdose', 'steht', 'in der Tischmitte.'] },
      { id: 'b03_69_06', german: 'der Kräutertee', arabic: 'شاي الأعشاب المسائي المهدئ', article: 'der', plural: 'die Kräutertees', emoji: '🫖', exampleSentenceGerman: 'Abends trinken wir warmen Kräutertee vor dem Schlafen.', exampleSentenceArabic: 'مساءً نشرب شاي أعشاب دافئاً قبل النوم.', missingLetterWord: 'der Kr_utertee', sentence4Elements: ['Kräutertee', 'hilft', 'uns', 'gut einzuschlafen.'] },
      { id: 'b03_69_07', german: 'das Sandwich', arabic: 'الساندويتش / الشطيرة المحشوة', article: 'das', plural: 'die Sandwiches', emoji: '🥪', exampleSentenceGerman: 'Ich belege mir ein großes Sandwich mit Gurken und Käse.', exampleSentenceArabic: 'أعد لنفسي ساندويتشاً كبيراً بالخيار والجبن.', missingLetterWord: 'das S_ndwich', sentence4Elements: ['Das', 'Sandwich', 'schmeckt', 'frisch und saftig.'] },
      { id: 'b03_69_08', german: 'der Senf', arabic: 'الخردل (المسطردة)', article: 'der', plural: 'die Senfe', emoji: '🟡', exampleSentenceGerman: 'Würstchen schmecken mit süßem oder scharfem Senf.', exampleSentenceArabic: 'النقانق لذيذة مع الخردل الحلو أو الحار.', missingLetterWord: 'der S_nf', sentence4Elements: ['Ein', 'kleiner', 'Klecks', 'Senf reicht völlig aus.'] },
      { id: 'b03_69_09', german: 'der Ketchup', arabic: 'الكاتشب', article: 'der', plural: 'die Ketchups', emoji: '🥫', exampleSentenceGerman: 'Kinder essen ihre Pommes am liebsten mit rotem Ketchup.', exampleSentenceArabic: 'الأطفال يفضلون أكل بطاطسهم المقلية مع الكاتشب الأحمر.', missingLetterWord: 'der K_tchup', sentence4Elements: ['Ketchup', 'wird', 'aus', 'reifen Tomaten hergestellt.'] },
      { id: 'b03_69_10', german: 'satt', arabic: 'شبعان / ممتلئ البطن', emoji: '😋', exampleSentenceGerman: 'Danke, ich bin jetzt pappsatt und glücklich!', exampleSentenceArabic: 'شكراً، أنا شبعان تماماً وسعيد الآن!', missingLetterWord: 's_tt', sentence4Elements: ['Alle', 'Kinder', 'sind', 'jetzt rundum satt.'] }
    ]
  },

  // 70. Drinks & Beverages (روضة / جريد 1)
  {
    id: 'curric_b03_70_drinks_beverages',
    title: 'Getränke für Durstige',
    titleTranslations: { ar: 'المشروبات وإرواء العطش', de: 'Getränke für Durstige', en: 'Drinks & Beverages' },
    topic: 'المشروبات والعصائر',
    topicTranslations: { ar: 'المشروبات والعصائر', de: 'Getränke', en: 'Beverages' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الماء المعدني وعصير التفاح والشاي والليمونادة.',
    descriptionTranslations: { ar: 'الماء وعصير التفاح والشاي والليمونادة.', de: 'Wasser, Apfelschorle, Tee und Limo.', en: 'Water, apple spritzer, tea and lemonade.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_70_01', german: 'das Wasser', arabic: 'الماء العذب النقي', article: 'das', plural: 'die Wässer', emoji: '💧', exampleSentenceGerman: 'Wasser ist das gesündeste Mittel gegen Durst.', exampleSentenceArabic: 'الماء هو أصح وسيلة لإرواء العطش.', missingLetterWord: 'das W_sser', sentence4Elements: ['Trink', 'bitte', 'jeden', 'Tag genug Wasser!'] },
      { id: 'b03_70_02', german: 'das Mineralwasser', arabic: 'المياه المعدنية (الفوارة أو العادية)', article: 'das', plural: 'die Mineralwässer', emoji: '🍾', exampleSentenceGerman: 'In Deutschland trinken viele Menschen Mineralwasser mit Kohlensäure.', exampleSentenceArabic: 'في ألمانيا يشرب كثير من الناس مياهاً معدنية فوارة.', missingLetterWord: 'das Min_ralwasser', sentence4Elements: ['Das', 'Wasser', 'sprudelt', 'frisch im Glas.'] },
      { id: 'b03_70_03', german: 'die Apfelschorle', arabic: 'شاي التفاح الفوار (عصير تفاح ممتزج بالماء الفوار)', article: 'die', plural: 'die Apfelschorlen', emoji: '🧃', exampleSentenceGerman: 'Apfelschorle ist das beliebteste Kindergetränk in Deutschland.', exampleSentenceArabic: 'عصير التفاح الفوار هو المشروب الأكثر شعبية للأطفال في ألمانيا.', missingLetterWord: 'die _pfelschorle', sentence4Elements: ['Eine', 'kühle', 'Apfelschorle', 'löscht den Durst.'] },
      { id: 'b03_70_04', german: 'der Orangensaft', arabic: 'عصير البرتقال الطازج', article: 'der', plural: 'die Orangensäfte', emoji: '🍊', exampleSentenceGerman: 'Ein Glas Orangensaft am Morgen schmeckt fruchtig.', exampleSentenceArabic: 'كوب من عصير البرتقال صباحاً منعش وفاكهي.', missingLetterWord: 'der _rangensaft', sentence4Elements: ['Frischer', 'Orangensaft', 'steckt', 'voller Vitamine.'] },
      { id: 'b03_70_05', german: 'die Limonade', arabic: 'الليمونادة / المشروب الغازي الحلو', article: 'die', plural: 'die Limonaden', emoji: '🥤', exampleSentenceGerman: 'Am Geburtstag gibt es kühle Zitronenlimonade.', exampleSentenceArabic: 'في عيد الميلاد نشرب ليمونادة باردة بالليمون.', missingLetterWord: 'die Lim_nade', sentence4Elements: ['Zitronenlimonade', 'perlt', 'erfrischend', 'im Becher.'] },
      { id: 'b03_70_06', german: 'der Eistee', arabic: 'الشاي المثلج (آيس تي)', article: 'der', plural: 'die Eistees', emoji: '🧋', exampleSentenceGerman: 'Pfirsich-Eistee schmeckt an warmen Sommertagen gut.', exampleSentenceArabic: 'الشاي المثلج بنكهة الخوخ لذيذ في الصيف.', missingLetterWord: 'der _istee', sentence4Elements: ['Eistee', 'mit', 'Zitrone', 'ist herrlich kühl.'] },
      { id: 'b03_70_07', german: 'die Flasche', arabic: 'الزجاجة / القارورة', article: 'die', plural: 'die Flaschen', emoji: '🍾', exampleSentenceGerman: 'Ich fülle meine Trinkflasche für die Schule auf.', exampleSentenceArabic: 'أملأ قارورة مائي الخاصة بالمدرسة.', missingLetterWord: 'die Fl_sche', sentence4Elements: ['Die', 'Flasche', 'Wasser', 'steht im Rucksack.'] },
      { id: 'b03_70_08', german: 'das Glas', arabic: 'كوب الزجاج / الكأس', article: 'das', plural: 'die Gläser', emoji: '🥛', exampleSentenceGerman: 'Ich schenke dir ein Glas Saft ein.', exampleSentenceArabic: 'أصب لك كأساً من العصير.', missingLetterWord: 'das Gl_s', sentence4Elements: ['Das', 'Glas', 'ist', 'voll bis oben.'] },
      { id: 'b03_70_09', german: 'der Becher', arabic: 'الكوب البلاستيكي أو الورقي', article: 'der', plural: 'die Becher', emoji: '🥤', exampleSentenceGerman: 'Im Kindergarten hat jedes Kind seinen eigenen Becher.', exampleSentenceArabic: 'في الروضة لكل طفل كوبه الخاص به.', missingLetterWord: 'der B_cher', sentence4Elements: ['Mein', 'roter', 'Becher', 'steht im Regal.'] },
      { id: 'b03_70_10', german: 'der Strohhalm', arabic: 'المصاصة (شفاطة العصير)', article: 'der', plural: 'die Strohhalme', emoji: '🥤', exampleSentenceGerman: 'Mit einem bunten Strohhalm schlürfe ich die Limo.', exampleSentenceArabic: 'بالمصاصة الملونة أرتشف الليمونادة.', missingLetterWord: 'der Str_hhalm', sentence4Elements: ['Ein', 'bunter', 'Strohhalm', 'steckt im Glas.'] }
    ]
  },

  // 71. Meat & Poultry (جريد 2 / جريد 3)
  {
    id: 'curric_b03_71_meat_poultry',
    title: 'Fleisch und Geflügel',
    titleTranslations: { ar: 'اللحوم والدواجن في المطبخ', de: 'Fleisch und Geflügel', en: 'Meat & Poultry' },
    topic: 'اللحوم والدواجن',
    topicTranslations: { ar: 'اللحوم والدواجن', de: 'Fleischgerichte', en: 'Meat Dishes' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'لحم البقر والدجاج والديك الرومي واللحم المفروم والبرجر.',
    descriptionTranslations: { ar: 'لحم البقر والدجاج والبرجر.', de: 'Rindfleisch, Hähnchen, Hackfleisch und Burger.', en: 'Beef, chicken, minced meat and burgers.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_71_01', german: 'das Fleisch', arabic: 'اللحم', article: 'das', plural: 'die Fleische', emoji: '🥩', exampleSentenceGerman: 'Gutes Fleisch liefert wichtige Proteine.', exampleSentenceArabic: 'اللحم الجيد يمد الجسم ببروتينات مهمة.', missingLetterWord: 'das Fl_isch', sentence4Elements: ['Das', 'Fleisch', 'brät', 'in der heißen Pfanne.'] },
      { id: 'b03_71_02', german: 'das Rindfleisch', arabic: 'لحم البقر', article: 'das', plural: 'die Rindfleische', emoji: '🥩', exampleSentenceGerman: 'Aus zartem Rindfleisch kocht Mama saftige Steaks.', exampleSentenceArabic: 'من لحم البقر الطري تطهو أمي شرائح ستيك شهية.', missingLetterWord: 'das R_ndfleisch', sentence4Elements: ['Rindfleisch', 'ist', 'dunkelrot', 'und sehr nahrhaft.'] },
      { id: 'b03_71_03', german: 'das Hähnchenbrustfilet', arabic: 'صدر الدجاج الفيليه', article: 'das', plural: 'die Hähnchenbrustfilets', emoji: '🍗', exampleSentenceGerman: 'Hähnchenfilet ist mager und schmeckt mild.', exampleSentenceArabic: 'فيليه الدجاج قليل الدسم وخفيف المذاق.', missingLetterWord: 'H_hnchenfilet', sentence4Elements: ['Zartes', 'Hähnchenfleisch', 'passt', 'gut zu Reis.'] },
      { id: 'b03_71_04', german: 'das Hackfleisch', arabic: 'اللحم المفروم', article: 'das', plural: 'die Hackfleische', emoji: '🥩', exampleSentenceGerman: 'Aus Hackfleisch rollen wir leckere Fleischbällchen.', exampleSentenceArabic: 'من اللحم المفروم نشكل كرات لحم لذيذة.', missingLetterWord: 'das H_ckfleisch', sentence4Elements: ['Aus', 'Hackfleisch', 'wird', 'die Bolognese gekocht.'] },
      { id: 'b03_71_05', german: 'die Frikadelle', arabic: 'كفتة اللحم المقلية (البرغر المنزلي الألماني)', article: 'die', plural: 'die Frikadellen', emoji: '🧆', exampleSentenceGerman: 'Omas Frikadellen mit Kartoffelsalat schmecken himmlisch.', exampleSentenceArabic: 'كفتة الجدة مع سلطة البطاطس طعمها رائع.', missingLetterWord: 'die Fr_kadelle', sentence4Elements: ['Die', 'Frikadelle', 'ist', 'knusprig braun gebraten.'] },
      { id: 'b03_71_06', german: 'das Schnitzel', arabic: 'الشنيتزل المقرمش (البانيه المغلف بالبقسماط)', article: 'das', plural: 'die Schnitzel', emoji: '🥩', exampleSentenceGerman: 'Ein paniertes Schnitzel mit Zitrone ist sehr beliebt.', exampleSentenceArabic: 'شنيتزل البانيه المقرمش مع الليمون محبوب جداً.', missingLetterWord: 'das Schn_tzel', sentence4Elements: ['Das', 'Schnitzel', 'wird', 'in der Pfanne gebraten.'] },
      { id: 'b03_71_07', german: 'der Burger', arabic: 'الهمبرغر', article: 'der', plural: 'die Burger', emoji: '🍔', exampleSentenceGerman: 'Auf den Burger legen wir Tomaten, Salat und Käse.', exampleSentenceArabic: 'نضع فوق البرغر الطماطم والخس والجبن.', missingLetterWord: 'der B_rger', sentence4Elements: ['Ein', 'großer', 'Burger', 'mit knusprigen Pommes.'] },
      { id: 'b03_71_08', german: 'die Pute', arabic: 'الديك الرومي (الحبش)', article: 'die', plural: 'die Puten', emoji: '🦃', exampleSentenceGerman: 'Putenfleisch ist gesund und schmeckt zart.', exampleSentenceArabic: 'لحم الديك الرومي صحي وطري المذاق.', missingLetterWord: 'die P_te', sentence4Elements: ['Gesundes', 'Putenfleisch', 'im', 'bunten Gemüsesalat heute.'] },
      { id: 'b03_71_09', german: 'der Braten', arabic: 'اللحم المشوي بالفرن (الروستو)', article: 'der', plural: 'die Braten', emoji: '🍖', exampleSentenceGerman: 'Am Sonntag duftet der Braten aus dem Backofen.', exampleSentenceArabic: 'يوم الأحد تفوح رائحة اللحم المشوي من الفرن.', missingLetterWord: 'der Br_ten', sentence4Elements: ['Der', 'Braten', 'schmort', 'stundenlang im Ofen.'] },
      { id: 'b03_71_10', german: 'die Metzgerei', arabic: 'محل الجزارة (الملحمة)', article: 'die', plural: 'die Metzgereien', emoji: '🏪', exampleSentenceGerman: 'Der freundliche Metzger berät uns in der Metzgerei.', exampleSentenceArabic: 'الجزار الودود يساعدنا في محل الجزارة.', missingLetterWord: 'die M_tzgerei', sentence4Elements: ['In', 'der', 'Metzgerei', 'kaufen wir frisches Fleisch.'] }
    ]
  },

  // 72. Fish & Seafood (جريد 2 / جريد 3)
  {
    id: 'curric_b03_72_fish_seafood',
    title: 'Fisch und Meeresfrüchte',
    titleTranslations: { ar: 'الأسماك والمأكولات البحرية', de: 'Fisch und Meeresfrüchte', en: 'Fish & Seafood' },
    topic: 'الأسماك والمأكولات البحرية',
    topicTranslations: { ar: 'الأسماك والمأكولات البحرية', de: 'Fischgerichte', en: 'Fish Dishes' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'أصابع السمك والسلمون والتونة والجمبري.',
    descriptionTranslations: { ar: 'أصابع السمك والسلمون والتونة والجمبري.', de: 'Fischstäbchen, Lachs, Thunfisch und Garnele.', en: 'Fish fingers, salmon, tuna and prawns.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_72_01', german: 'der Fisch', arabic: 'السمك', article: 'der', plural: 'die Fische', emoji: '🐟', exampleSentenceGerman: 'Fisch ist gesund und enthält gesunde Fette.', exampleSentenceArabic: 'السمك صحي ويحتوي على دهون مفيدة.', missingLetterWord: 'der F_sch', sentence4Elements: ['Der', 'Fisch', 'schwimmt', 'im klaren Wasser.'] },
      { id: 'b03_72_02', german: 'die Fischstäbchen', arabic: 'أصابع السمك المقلية للأطفال', article: 'die', plural: 'die Fischstäbchen', emoji: '🐟', exampleSentenceGerman: 'Goldene Fischstäbchen mit Kartoffelpüree sind ein Hit!', exampleSentenceArabic: 'أصابع السمك الذهبية مع بيوريه البطاطس وجبة محبوبة جداً!', missingLetterWord: 'die F_schstäbchen', sentence4Elements: ['Knusprige', 'Fischstäbchen', 'schmecken', 'jedem Kind gut.'] },
      { id: 'b03_72_03', german: 'der Lachs', arabic: 'سمك السلمون الوردي', article: 'der', plural: 'die Lachse', emoji: '🍣', exampleSentenceGerman: 'Gebratener Lachs hat schönes rosa Fleisch.', exampleSentenceArabic: 'السلمون المشوي لحمه وردي وشهي.', missingLetterWord: 'der L_chs', sentence4Elements: ['Lachs', 'enthält', 'viele', 'wertvolle Omega-3-Fettsäuren.'] },
      { id: 'b03_72_04', german: 'der Thunfisch', arabic: 'سمك التونة', article: 'der', plural: 'die Thunfische', emoji: '🐟', exampleSentenceGerman: 'Thunfischsalat schmeckt toll auf dem Brötchen.', exampleSentenceArabic: 'سلطة التونة رائعة فوق الخبز.', missingLetterWord: 'der Th_nfisch', sentence4Elements: ['Thunfisch', 'schmeckt', 'auf', 'der Pizza super.'] },
      { id: 'b03_72_05', german: 'die Forelle', arabic: 'سمك السلمون المرقط (الفروالة النهرية)', article: 'die', plural: 'die Forellen', emoji: '🐟', exampleSentenceGerman: 'Die frische Forelle schwimmt im kühlen Gebirgsbach.', exampleSentenceArabic: 'سمكة السلمون المرقط تسبح في جدول الجبل البارد.', missingLetterWord: 'die For_lle', sentence4Elements: ['Forelle', 'Müllerin-Art', 'ist', 'eine deutsche Spezialität.'] },
      { id: 'b03_72_06', german: 'die Garnele', arabic: 'الجمبري / الروبيان', article: 'die', plural: 'die Garnelen', emoji: '🦐', exampleSentenceGerman: 'Gegrillte Garnelen mit Knoblauch schmecken fein.', exampleSentenceArabic: 'الجمبري المشوي بالثوم ذو نكهة رائعة.', missingLetterWord: 'die Garn_le', sentence4Elements: ['Garnelen', 'werden', 'beim', 'Braten appetitlich rosa.'] },
      { id: 'b03_72_07', german: 'die Gräte', arabic: 'شوك السمك (حسك السمك)', article: 'die', plural: 'die Gräten', emoji: '🦴', exampleSentenceGerman: 'Pass beim Fisch gut auf feine Gräten auf!', exampleSentenceArabic: 'انتبه جيداً لشوك السمك الصغير أثناء الأكل!', missingLetterWord: 'die Gr_te', sentence4Elements: ['Dieses', 'Filet', 'hat', 'gar keine Gräten.'] },
      { id: 'b03_72_08', german: 'das Fischfilet', arabic: 'فيليه السمك الخالي من الشوك', article: 'das', plural: 'die Fischfilets', emoji: '🐟', exampleSentenceGerman: 'Das weiße Fischfilet wird schonend gedämpft.', exampleSentenceArabic: 'فيليه السمك الأبيض يطهى بالبخار برفق.', missingLetterWord: 'das F_schfilet', sentence4Elements: ['Das', 'Filet', 'ist', 'zart und saftig.'] },
      { id: 'b03_72_09', german: 'das Fischbrötchen', arabic: 'شطيرة السمك التقليدية في شمال ألمانيا', article: 'das', plural: 'die Fischbrötchen', emoji: '🥪', exampleSentenceGerman: 'An der Nordsee essen wir am Hafen ein frisches Fischbrötchen.', exampleSentenceArabic: 'عند بحر الشمال نأكل في الميناء شطيرة سمك طازجة.', missingLetterWord: 'das F_schbrötchen', sentence4Elements: ['Am', 'Hafen', 'schmeckt', 'ein Fischbrötchen köstlich.'] },
      { id: 'b03_72_10', german: 'frisch', arabic: 'طازج', emoji: '✨', exampleSentenceGerman: 'Der Fisch ist ganz frisch gefangen.', exampleSentenceArabic: 'السمك تم اصطياده للتو وهو طازج تماماً.', missingLetterWord: 'fr_sch', sentence4Elements: ['Frischer', 'Fisch', 'riecht', 'überhaupt nicht unangenehm.'] }
    ]
  },

  // 73. Cakes, Pies & Sweet Treats (جريد 1 / جريد 2)
  {
    id: 'curric_b03_73_cakes_pastries',
    title: 'Kuchen, Torten und Süßes',
    titleTranslations: { ar: 'الكعك والتورتة والحلويات', de: 'Kuchen, Torten und Süßes', en: 'Cakes, Pies & Sweets' },
    topic: 'الحلويات والكعك',
    topicTranslations: { ar: 'الحلويات والكعك', de: 'Kuchen & Gebäck', en: 'Cakes & Sweets' },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'كعكة الشوكولاتة والتورتة والبسكويت والمافن للأطفال.',
    descriptionTranslations: { ar: 'كعكة الشوكولاتة والتورتة والبسكويت والمافن.', de: 'Kuchen, Torte, Keks und Muffin.', en: 'Cakes, tarts, cookies and muffins.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_73_01', german: 'der Kuchen', arabic: 'الكعكة / الكيك', article: 'der', plural: 'die Kuchen', emoji: '🍰', exampleSentenceGerman: 'Zum Geburtstag backt Mama einen bunten Kuchen.', exampleSentenceArabic: 'بمناسبة عيد الميلاد تخبز أمي كعكة ملونة.', missingLetterWord: 'der K_chen', sentence4Elements: ['Der', 'Kuchen', 'schmeckt', 'nach süßer Vanille.'] },
      { id: 'b03_73_02', german: 'die Torte', arabic: 'التورتة الاحتفالية المحشوة بالكريمة', article: 'die', plural: 'die Torten', emoji: '🎂', exampleSentenceGerman: 'Auf der Geburtstagstorte brennen sieben Kerzen.', exampleSentenceArabic: 'على تورتة عيد الميلاد تشتعل سبع شمعات.', missingLetterWord: 'die T_rte', sentence4Elements: ['Die', 'Schwarzwälder', 'Kirschtorte', 'ist weltbekannt.'] },
      { id: 'b03_73_03', german: 'der Keks', arabic: 'البسكويت (الكوكيز)', article: 'der', plural: 'die Kekse', emoji: '🍪', exampleSentenceGerman: 'Wir knabbern knusprige Schokokekse zum Tee.', exampleSentenceArabic: 'نقرمش بسكويت الشوكولاتة اللذيذ مع الشاي.', missingLetterWord: 'der K_ks', sentence4Elements: ['In', 'der', 'Dose', 'sind viele Schokokekse.'] },
      { id: 'b03_73_04', german: 'der Muffin', arabic: 'المافن الصغير (الكب كيك)', article: 'der', plural: 'die Muffins', emoji: '🧁', exampleSentenceGerman: 'Ich nehme einen Blaubeer-Muffin mit zur Schule.', exampleSentenceArabic: 'آخذ مافن التوت الأزرق معي إلى المدرسة.', missingLetterWord: 'der M_ffin', sentence4Elements: ['Der', 'Muffin', 'ist', 'fluffig und weich.'] },
      { id: 'b03_73_05', german: 'die Waffel', arabic: 'الوافل الهش', article: 'die', plural: 'die Waffeln', emoji: '🧇', exampleSentenceGerman: 'Frische Herzwaffeln mit Puderzucker duften herrlich.', exampleSentenceArabic: 'وافل القلوب الساخن مع السكر البودرة رائحته زكية.', missingLetterWord: 'die W_ffel', sentence4Elements: ['Heiße', 'Waffeln', 'mit', 'Kirschen schmecken fantastisch.'] },
      { id: 'b03_73_06', german: 'der Donut', arabic: 'الدونات', article: 'der', plural: 'die Donuts', emoji: '🍩', exampleSentenceGerman: 'Der Donut hat bunte Zuckerstreusel obendrauf.', exampleSentenceArabic: 'الدونات مزين بحبيبات السكر الملونة.', missingLetterWord: 'der D_nut', sentence4Elements: ['Ein', 'Donut', 'hat', 'ein Loch in der Mitte.'] },
      { id: 'b03_73_07', german: 'der Apfelkuchen', arabic: 'كعكة التفاح بالقرفة', article: 'der', plural: 'die Apfelkuchen', emoji: '🥧', exampleSentenceGerman: 'Warmer Apfelkuchen mit Zimt ist köstlich.', exampleSentenceArabic: 'كعكة التفاح الدافئة بالقرفة شهية جداً.', missingLetterWord: 'der _pfelkuchen', sentence4Elements: ['Oma', 'macht', 'den', 'besten Apfelkuchen überhaupt.'] },
      { id: 'b03_73_08', german: 'die Schokolade', arabic: 'الشوكولاتة', article: 'die', plural: 'die Schokoladen', emoji: '🍫', exampleSentenceGerman: 'Vollmilchschokolade schmilzt herrlich süß im Mund.', exampleSentenceArabic: 'شوكولاتة الحليب تذوب بحلاوة رائعة في الفم.', missingLetterWord: 'die Schok_lade', sentence4Elements: ['Ein', 'Stück', 'Schokolade', 'als kleine Belohnung.'] },
      { id: 'b03_73_09', german: 'das Bonbon', arabic: 'الحلوى المصاصة / البونبون', article: 'das', plural: 'die Bonbons', emoji: '🍬', exampleSentenceGerman: 'Das rote Bonbon schmeckt nach Kirsche.', exampleSentenceArabic: 'قطعة البونبون الحمراء بنكهة الكرز اللذيذة.', missingLetterWord: 'das B_nbon', sentence4Elements: ['Ich', 'lutsche', 'ein', 'süßes fruchtiges Bonbon.'] },
      { id: 'b03_73_10', german: 'backen', arabic: 'يخبز في الفرن (الفعل)', emoji: '👩‍🍳', exampleSentenceGerman: 'In der Weihnachtszeit backen wir viele Plätzchen.', exampleSentenceArabic: 'في موسم الشتاء نخبز الكثير من البسكويت في الفرن.', missingLetterWord: 'b_cken', sentence4Elements: ['Wir', 'backen', 'zusammen', 'einen leckeren Kuchen.'] }
    ]
  },

  // 74. Ice Cream Flavors & Parlor (روضة / جريد 1)
  {
    id: 'curric_b03_74_ice_cream_parlor',
    title: 'In der Eisdiele',
    titleTranslations: { ar: 'في محل بيع الآيس كريم', de: 'In der Eisdiele', en: 'In the Ice Cream Parlor' },
    topic: 'الآيس كريم والمثلجات',
    topicTranslations: { ar: 'الآيس كريم والمثلجات', de: 'Eisdiele', en: 'Ice Cream' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'نكهات المثلجات: فانيليا، شوكولاتة، فراولة، والقمع.',
    descriptionTranslations: { ar: 'نكهات الآيس كريم وقمع البسكويت.', de: 'Kugel Eis, Waffel, Vanille und Schoko.', en: 'Ice cream scoops, cones and flavors.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_74_01', german: 'die Eisdiele', arabic: 'محل الآيس كريم (صالون المثلجات)', article: 'die', plural: 'die Eisdielen', emoji: '🍨', exampleSentenceGerman: 'Im Sommer gehen wir nach der Schule zur Eisdiele.', exampleSentenceArabic: 'في الصيف نذهب بعد المدرسة لمحل الآيس كريم.', missingLetterWord: 'die _isdiele', sentence4Elements: ['Vor', 'der', 'Eisdiele', 'stehen viele Kinder an.'] },
      { id: 'b03_74_02', german: 'die Kugel Eis', arabic: 'كرة الآيس كريم (بولة الآيس كريم)', article: 'die', plural: 'die Kugeln Eis', emoji: '🍨', exampleSentenceGerman: 'Ich hätte gern zwei Kugeln Eis in der Waffel.', exampleSentenceArabic: 'أود الحصول على بولتين من الآيس كريم في القمع البسكويتي.', missingLetterWord: 'die K_gel Eis', sentence4Elements: ['Eine', 'Kugel', 'kostet', 'einen Euro fünfzig.'] },
      { id: 'b03_74_03', german: 'die Waffel', arabic: 'قمع الآيس كريم البسكويتي (الكون)', article: 'die', plural: 'die Waffeln', emoji: '🍦', exampleSentenceGerman: 'Möchtest du dein Eis in der Waffel oder im Becher?', exampleSentenceArabic: 'هل ترغب في الآيس كريم في بسكويت القمع أم في الكوب؟', missingLetterWord: 'die W_ffel', sentence4Elements: ['Die', 'Waffel', 'ist', 'knusprig und süß gebacken.'] },
      { id: 'b03_74_04', german: 'der Becher', arabic: 'كوب الآيس كريم', article: 'der', plural: 'die Becher', emoji: '🍧', exampleSentenceGerman: 'Ich esse mein Eis lieber mit einem Löffelchen im Becher.', exampleSentenceArabic: 'أفضل تناول الآيس كريم بملعقة في الكوب.', missingLetterWord: 'der B_cher', sentence4Elements: ['Der', 'Becher', 'hat', 'ein kleines buntes Schirmchen.'] },
      { id: 'b03_74_05', german: 'das Vanilleeis', arabic: 'آيس كريم الفانيليا', article: 'das', plural: 'die Vanilleeise', emoji: '🍦', exampleSentenceGerman: 'Vanilleeis mit Schokosauce schmeckt fantastisch.', exampleSentenceArabic: 'آيس كريم الفانيليا مع صلصة الشوكولاتة رائع.', missingLetterWord: 'das Van_lleeis', sentence4Elements: ['Cremiges', 'Vanilleeis', 'schmilzt', 'auf der Zunge.'] },
      { id: 'b03_74_06', german: 'das Schokoladeneis', arabic: 'آيس كريم الشوكولاتة', article: 'das', plural: 'die Schokoladeneise', emoji: '🍫', exampleSentenceGerman: 'Schokoeis ist der Favorit von vielen Kindern.', exampleSentenceArabic: 'آيس كريم الشوكولاتة هو المفضل لكثير من الأطفال.', missingLetterWord: 'Schok_ladeneis', sentence4Elements: ['Dunkles', 'Schokoeis', 'schmeckt', 'intensiv nach Kakao.'] },
      { id: 'b03_74_07', german: 'das Erdbeereis', arabic: 'آيس كريم الفراولة', article: 'das', plural: 'die Erdbeereise', emoji: '🍓', exampleSentenceGerman: 'Erdbeereis schmeckt fruchtig und hat eine schöne rosa Farbe.', exampleSentenceArabic: 'آيس كريم الفراولة فاكهي ولونه وردي جميل.', missingLetterWord: 'das _rdbeereis', sentence4Elements: ['Fruchtiges', 'Erdbeereis', 'ist', 'im Sommer herrlich erfrischend.'] },
      { id: 'b03_74_08', german: 'das Zitroneneis', arabic: 'آيس كريم الليمون الحامض المنعش', article: 'das', plural: 'die Zitroneneise', emoji: '🍋', exampleSentenceGerman: 'Säuerliches Zitroneneis kühlt an heißen Tagen.', exampleSentenceArabic: 'آيس كريم الليمون اللاذع يبرد في الأيام الحارة.', missingLetterWord: 'Zitr_neneis', sentence4Elements: ['Zitroneneis', 'ist', 'besonders', 'spritzig und sauer.'] },
      { id: 'b03_74_09', german: 'die Streusel', arabic: 'حبيبات السكر الملونة للتزيين (الفيرميسيل)', article: 'die', plural: 'die Streusel', emoji: '🧁', exampleSentenceGerman: 'Bunte Streusel machen jedes Eis noch schöner!', exampleSentenceArabic: 'حبيبات السكر الملونة تجعل الآيس كريم أجمل وأبهج!', missingLetterWord: 'die Str_usel', sentence4Elements: ['Bunte', 'Streusel', 'knuspern', 'fröhlich auf dem Eis.'] },
      { id: 'b03_74_10', german: 'schlecken', arabic: 'يلعق الآيس كريم بمتعة', emoji: '😋', exampleSentenceGerman: 'Die Kinder schlecken glücklich ihr leckeres Eis.', exampleSentenceArabic: 'الأطفال يلعقون مثلجاتهم الشهية بسعادة.', missingLetterWord: 'schl_cken', sentence4Elements: ['Wir', 'schlecken', 'unser', 'Eis in der Sonne.'] }
    ]
  },

  // 75. Kitchen Equipment & Cutlery (جريد 2 / جريد 3)
  {
    id: 'curric_b03_75_kitchen_cutlery',
    title: 'Besteck und Küchenhelfer',
    titleTranslations: { ar: 'أدوات المائدة وأواني المطبخ', de: 'Besteck und Küchenhelfer', en: 'Cutlery & Kitchen Tools' },
    topic: 'أدوات المائدة والمطبخ',
    topicTranslations: { ar: 'أدوات المائدة والمطبخ', de: 'Küchenhelfer', en: 'Kitchen Tools' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الملعقة والشوكة والسكين والطبق والكوب والقدر.',
    descriptionTranslations: { ar: 'الملعقة والشوكة والسكين والطبق والقدر.', de: 'Löffel, Gabel, Messer, Teller und Topf.', en: 'Spoons, forks, knives, plates and pots.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_75_01', german: 'der Löffel', arabic: 'الملعقة', article: 'der', plural: 'die Löffel', emoji: '🥄', exampleSentenceGerman: 'Mit dem Löffel esse ich die warme Suppe.', exampleSentenceArabic: 'بواسطة الملعقة أتناول الحساء الدافئ.', missingLetterWord: 'der L_ffel', sentence4Elements: ['Der', 'Löffel', 'liegt', 'rechts neben dem Teller.'] },
      { id: 'b03_75_02', german: 'die Gabel', arabic: 'الشوكة', article: 'die', plural: 'die Gabeln', emoji: '🍴', exampleSentenceGerman: 'Mit der Gabel spieße ich Nudeln auf.', exampleSentenceArabic: 'بالشوكة ألتقط المعكرونة.', missingLetterWord: 'die G_bel', sentence4Elements: ['Die', 'Gabel', 'liegt', 'links auf der Serviette.'] },
      { id: 'b03_75_03', german: 'das Messer', arabic: 'السكين', article: 'das', plural: 'die Messer', emoji: '🔪', exampleSentenceGerman: 'Vorsicht, das Messer ist sehr scharf!', exampleSentenceArabic: 'احترس، السكين حاد للغاية!', missingLetterWord: 'das M_sser', sentence4Elements: ['Mit', 'dem', 'Messer', 'schneide ich das Brot.'] },
      { id: 'b03_75_04', german: 'der Teller', arabic: 'الصحن / الطبق', article: 'der', plural: 'die Teller', emoji: '🍽️', exampleSentenceGerman: 'Ich stelle den flachen Teller auf den Tisch.', exampleSentenceArabic: 'أضع الطبق المسطح على المائدة.', missingLetterWord: 'der T_ller', sentence4Elements: ['Der', 'Teller', 'ist', 'aus weißem Porzellan.'] },
      { id: 'b03_75_05', german: 'die Tasse', arabic: 'الفنجان (فنجان الشاي أو الحليب)', article: 'die', plural: 'die Tassen', emoji: '☕', exampleSentenceGerman: 'Aus der bunten Tasse trinke ich heißen Kakao.', exampleSentenceArabic: 'من الفنجان الملون أشرب الكاكاو الساخن.', missingLetterWord: 'die T_sse', sentence4Elements: ['Die', 'Tasse', 'hat', 'einen praktischen Henkel.'] },
      { id: 'b03_75_06', german: 'die Schüssel', arabic: 'الزبدية / الوعاء العميق (البولة)', article: 'die', plural: 'die Schüsseln', emoji: '🥣', exampleSentenceGerman: 'Das Müsli esse ich aus einer tiefen Schüssel.', exampleSentenceArabic: 'أتناول الموسلي من وعاء عميق.', missingLetterWord: 'die Sch_ssel', sentence4Elements: ['In', 'der', 'Schüssel', 'ist bunter Salat.'] },
      { id: 'b03_75_07', german: 'der Topf', arabic: 'القدر / الطنجرة للطبخ', article: 'der', plural: 'die Töpfe', emoji: '🍲', exampleSentenceGerman: 'Im großen Topf kocht das Nudelwasser.', exampleSentenceArabic: 'في القدر الكبير يغلي ماء المعكرونة.', missingLetterWord: 'der T_pf', sentence4Elements: ['Der', 'Topf', 'steht', 'auf dem heißen Herd.'] },
      { id: 'b03_75_08', german: 'die Pfanne', arabic: 'المقلاة (الطاسة)', article: 'die', plural: 'die Pfannen', emoji: '🍳', exampleSentenceGerman: 'In der Pfanne braten leckere Pfannkuchen.', exampleSentenceArabic: 'في المقلاة تُقلى الفطائر الشهية.', missingLetterWord: 'die Pf_nne', sentence4Elements: ['Die', 'Pfanne', 'ist', 'heiß mit etwas Öl.'] },
      { id: 'b03_75_09', german: 'die Serviette', arabic: 'المنديل القماشي أو الورقي للمائدة', article: 'die', plural: 'die Servietten', emoji: '🧻', exampleSentenceGerman: 'Mit der Serviette wische ich mir den Mund ab.', exampleSentenceArabic: 'بالمنديل أنظف فمي بعد الأكل.', missingLetterWord: 'die Serv_ette', sentence4Elements: ['Die', 'Serviette', 'liegt', 'schön gefaltet da.'] },
      { id: 'b03_75_10', german: 'das Besteck', arabic: 'طقم أدوات المائدة (شوكة وسكين وملعقة)', article: 'das', plural: 'die Bestecke', emoji: '🍴', exampleSentenceGerman: 'Wir decken den Tisch mit glänzendem Besteck.', exampleSentenceArabic: 'نرتب المائدة بأدوات مائدة لامعة.', missingLetterWord: 'das Best_ck', sentence4Elements: ['Das', 'Besteck', 'liegt', 'ordentlich auf dem Tisch.'] }
    ]
  },

  // 76. Cooking Actions & Verbs in the Kitchen (جريد 2 / جريد 3)
  {
    id: 'curric_b03_76_cooking_verbs',
    title: 'Kochen und Zubereiten',
    titleTranslations: { ar: 'أفعال الطبخ والتحضير في المطبخ', de: 'Kochen und Zubereiten', en: 'Cooking Verbs' },
    topic: 'أفعال الطبخ',
    topicTranslations: { ar: 'أفعال الطبخ', de: 'Küchenverben', en: 'Cooking Actions' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'يطبخ، يقطع، يقشر، يخلط، يسكب، يغلي.',
    descriptionTranslations: { ar: 'يطبخ، يقطع، يقشر، يخلط، يسكب.', de: 'Kochen, schneiden, schälen, rühren.', en: 'Cook, cut, peel, stir and pour.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_76_01', german: 'kochen', arabic: 'يطبخ / يطهو', emoji: '👨‍🍳', exampleSentenceGerman: 'Wir kochen heute gemeinsam Spaghetti.', exampleSentenceArabic: 'نحن نطبخ السباغيتي معاً اليوم.', missingLetterWord: 'k_chen', sentence4Elements: ['Papa', 'kocht', 'ein', 'wunderbares Abendessen für alle.'] },
      { id: 'b03_76_02', german: 'schneiden', arabic: 'يقطع بالسكين', emoji: '🔪', exampleSentenceGerman: 'Ich schneide die Tomaten vorsichtig in Stücke.', exampleSentenceArabic: 'أقطع الطماطم بحذر إلى قطع صغيرة.', missingLetterWord: 'schn_iden', sentence4Elements: ['Vorsichtig', 'schneiden', 'wir', 'das Gemüse klein.'] },
      { id: 'b03_76_03', german: 'schälen', arabic: 'يقشر (الفواكه أو الخضار)', emoji: '🥔', exampleSentenceGerman: 'Mama schält die Kartoffeln mit dem Sparschäler.', exampleSentenceArabic: 'تقشر أمي البطاطس بقشارة الخضار.', missingLetterWord: 'sch_len', sentence4Elements: ['Ich', 'schäle', 'die', 'gelbe Banane geschickt.'] },
      { id: 'b03_76_04', german: 'rühren', arabic: 'يقلب / يحرك بالملعقة', emoji: '🥣', exampleSentenceGerman: 'Rühr die Suppe gut im Topf um!', exampleSentenceArabic: 'قلب الشوربة جيداً في القدر!', missingLetterWord: 'r_hren', sentence4Elements: ['Wir', 'rühren', 'den', 'Kuchenteig mit dem Löffel.'] },
      { id: 'b03_76_05', german: 'braten', arabic: 'يقلي / يحمر في المقلاة', emoji: '🍳', exampleSentenceGerman: 'Wir braten die Spiegeleier in etwas Butter.', exampleSentenceArabic: 'نقلي البيض في قليل من الزبدة.', missingLetterWord: 'br_ten', sentence4Elements: ['Die', 'Frikadellen', 'braten', 'in der heißen Pfanne.'] },
      { id: 'b03_76_06', german: 'gießen', arabic: 'يسكب / يصب السائل', emoji: '🫗', exampleSentenceGerman: 'Gieß bitte etwas Milch in meinen Becher!', exampleSentenceArabic: 'اسكب بعض الحليب في كاسي من فضلك!', missingLetterWord: 'gi_ßen', sentence4Elements: ['Ich', 'gieße', 'frischen', 'Tee in die Tasse.'] },
      { id: 'b03_76_07', german: 'mischen', arabic: 'يمزج / يخلط المكونات', emoji: '🥗', exampleSentenceGerman: 'Wir mischen das Dressing mit dem frischen Salat.', exampleSentenceArabic: 'نخلط تتبيلة السلطة مع الخضار الطازج.', missingLetterWord: 'm_schen', sentence4Elements: ['Alle', 'Zutaten', 'werden', 'in der Schüssel gemischt.'] },
      { id: 'b03_76_08', german: 'probieren', arabic: 'يتذوق الطعام / يجرب', emoji: '😋', exampleSentenceGerman: 'Probier mal, ob noch etwas Salz fehlt!', exampleSentenceArabic: 'تذوق لترى إن كان ينقصه قليل من الملح!', missingLetterWord: 'prob_eren', sentence4Elements: ['Ich', 'probiere', 'die', 'leckere Sauce mit dem Löffel.'] },
      { id: 'b03_76_09', german: 'würzen', arabic: 'يتبل بالبهارات والملح', emoji: '🧂', exampleSentenceGerman: 'Mit einer Prise Salz und Pfeffer würzen wir das Essen.', exampleSentenceArabic: 'برشة ملح وفلفل نتبل الطعام.', missingLetterWord: 'w_rzen', sentence4Elements: ['Wir', 'würzen', 'die', 'Suppe mit frischen Kräutern.'] },
      { id: 'b03_76_10', german: 'abwaschen', arabic: 'يغسل الأطباق والأواني', emoji: '🧼', exampleSentenceGerman: 'Nach dem Essen waschen wir das Geschirr ab.', exampleSentenceArabic: 'بعد تناول الطعام نغسل الأطباق والأواني.', missingLetterWord: '_bwaschen', sentence4Elements: ['Kinder', 'helfen', 'beim', 'Abwaschen nach dem Essen.'] }
    ]
  },

  // 77. Spices, Herbs & Flavors (جريد 2 / جريد 3)
  {
    id: 'curric_b03_77_spices_herbs',
    title: 'Gewürze und Küchenkräuter',
    titleTranslations: { ar: 'التوابل والبهارات والأعشاب العطرية', de: 'Gewürze und Küchenkräuter', en: 'Spices and Herbs' },
    topic: 'التوابل والأعشاب',
    topicTranslations: { ar: 'التوابل والأعشاب', de: 'Gewürze', en: 'Spices' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الملح والسكر والفلفل والقرفة والريحان والنعناع.',
    descriptionTranslations: { ar: 'الملح والسكر والفلفل والقرفة والريحان.', de: 'Salz, Pfeffer, Zucker, Zimt und Minze.', en: 'Salt, pepper, sugar, cinnamon and mint.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_77_01', german: 'das Salz', arabic: 'الملح', article: 'das', plural: 'die Salze', emoji: '🧂', exampleSentenceGerman: 'Eine Prise Salz gehört in jeden Kuchenteig.', exampleSentenceArabic: 'رشة ملح أساسية في كل عجينة كعك.', missingLetterWord: 'das S_lz', sentence4Elements: ['Der', 'Salzstreuer', 'steht', 'auf dem Esstisch.'] },
      { id: 'b03_77_02', german: 'der Pfeffer', arabic: 'الفلفل الأسود المطحون', article: 'der', plural: 'die Pfeffer', emoji: '🧂', exampleSentenceGerman: 'Schwarzer Pfeffer gibt der Sauce Würze.', exampleSentenceArabic: 'الفلفل الأسود يمنح الصلصة نكهة مميزة.', missingLetterWord: 'der Pf_ffer', sentence4Elements: ['Nicht', 'zu', 'viel', 'Pfeffer, sonst wird es scharf!'] },
      { id: 'b03_77_03', german: 'der Zucker', arabic: 'السكر', article: 'der', plural: 'die Zucker', emoji: '🍬', exampleSentenceGerman: 'Zucker macht Tee und Kuchen süß.', exampleSentenceArabic: 'السكر يجعل الشاي والكعك حلو المذاق.', missingLetterWord: 'der Z_cker', sentence4Elements: ['Weißer', 'Zucker', 'steht', 'in der Zuckerdose.'] },
      { id: 'b03_77_04', german: 'der Zimt', arabic: 'القرفة العطرية', article: 'der', plural: 'die Zimte', emoji: '🪵', exampleSentenceGerman: 'Milchreis schmeckt am besten mit Zucker und Zimt.', exampleSentenceArabic: 'أرز بالحليب أشهى ما يكون مع السكر والقرفة.', missingLetterWord: 'der Z_mt', sentence4Elements: ['Zimt', 'duftet', 'wunderbar', 'nach Festtagen und Winter.'] },
      { id: 'b03_77_05', german: 'die Minze', arabic: 'النعناع الأخضر', article: 'die', plural: 'die Minzen', emoji: '🌿', exampleSentenceGerman: 'Frische Pfefferminze duftet kühl und belebend.', exampleSentenceArabic: 'النعناع الفلفلي الطازج تفوح منه رائحة منعشة.', missingLetterWord: 'die M_nze', sentence4Elements: ['Frischer', 'Minztee', 'schmeckt', 'köstlich mit etwas Honig.'] },
      { id: 'b03_77_06', german: 'das Basilikum', arabic: 'الريحان العطري', article: 'das', plural: 'die Basiliken', emoji: '🌿', exampleSentenceGerman: 'Frisches Basilikum passt perfekt zu Tomaten und Mozzarella.', exampleSentenceArabic: 'الريحان الطازج يناسب الطماطم وجبن الموزاريلا تماماً.', missingLetterWord: 'das Basil_kum', sentence4Elements: ['Grünes', 'Basilikum', 'wächst', 'im Topf auf der Fensterbank.'] },
      { id: 'b03_77_07', german: 'die Petersilie', arabic: 'البقدونس', article: 'die', plural: 'die Petersilien', emoji: '🌿', exampleSentenceGerman: 'Gehackte Petersilie streuen wir über die Kartoffeln.', exampleSentenceArabic: 'نرش البقدونس المفروم فوق البطاطس المسلوقة.', missingLetterWord: 'die Pet_rsilie', sentence4Elements: ['Petersilie', 'bringt', 'frisches', 'Grün auf jeden Teller.'] },
      { id: 'b03_77_08', german: 'der Schnittlauch', arabic: 'الثوم القصبي (السيبوليت / البصل الأخضر الصغير)', article: 'der', plural: 'die Schnittlauche', emoji: '🌱', exampleSentenceGerman: 'Wir schneiden Schnittlauch mit der Küchenschere klein.', exampleSentenceArabic: 'نقص الثوم القصبي بمقص المطبخ إلى قطع صغيرة.', missingLetterWord: 'der Schn_ttlauch', sentence4Elements: ['Schnittlauch', 'schmeckt', 'super', 'auf dem Butterbrot.'] },
      { id: 'b03_77_09', german: 'das Olivenöl', arabic: 'زيت الزيتون الصافي', article: 'das', plural: 'die Olivenöle', emoji: '🫒', exampleSentenceGerman: 'Gutes Olivenöl macht den Salat besonders gesund.', exampleSentenceArabic: 'زيت الزيتون الجيد يجعل السلطة صحية جداً.', missingLetterWord: 'das Ol_venöl', sentence4Elements: ['Ein', 'Esslöffel', 'Olivenöl', 'kommt an die Sauce.'] },
      { id: 'b03_77_10', german: 'der Essig', arabic: 'الخل', article: 'der', plural: 'die Essige', emoji: '🍶', exampleSentenceGerman: 'Aus Essig und Öl rühren wir eine feine Salatsauce.', exampleSentenceArabic: 'من الخل والزيت نحضر صلصة سلطة شهية.', missingLetterWord: 'der _ssig', sentence4Elements: ['Essig', 'gibt', 'dem', 'Salat eine feine Säure.'] }
    ]
  },

  // 78. Taste & Texture Expressions (جريد 2 / جريد 3)
  {
    id: 'curric_b03_78_taste_adjectives',
    title: 'Wie schmeckt das Essen?',
    titleTranslations: { ar: 'كيف هو طعم الطعام والمذاقات', de: 'Wie schmeckt das Essen?', en: 'Taste & Flavors' },
    topic: 'المذاقات والطعوم',
    topicTranslations: { ar: 'المذاقات والطعوم', de: 'Geschmack', en: 'Flavors' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'حلو، مالح، حامض، مر، حار، مقرمش، ولذيذ.',
    descriptionTranslations: { ar: 'حلو، مالح، حامض، مر، حار، مقرمش.', de: 'Süß, salzig, sauer, bitter und scharf.', en: 'Sweet, salty, sour, bitter and spicy.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_78_01', german: 'süß', arabic: 'حلو المذاق', emoji: '🍬', exampleSentenceGerman: 'Honig und reife Erdbeeren sind wunderbar süß.', exampleSentenceArabic: 'العسل والفراولة الناضجة حلوان جداً.', missingLetterWord: 's_ß', sentence4Elements: ['Der', 'Kuchen', 'schmeckt', 'angenehm süß.'] },
      { id: 'b03_78_02', german: 'salzig', arabic: 'مالح', emoji: '🧂', exampleSentenceGerman: 'Brezeln und Chips sind oft salzig.', exampleSentenceArabic: 'البريتزل ورقائق البطاطس مالحة في الغالب.', missingLetterWord: 's_lzig', sentence4Elements: ['Die', 'Suppe', 'ist', 'etwas zu salzig geraten.'] },
      { id: 'b03_78_03', german: 'sauer', arabic: 'حامض (كالليمون)', emoji: '🍋', exampleSentenceGerman: 'Zitronen und saure Bonbons machen lustige Gesichter!', exampleSentenceArabic: 'الليمون والحلوى الحامضة تجعل الوجوه تعبس بمرح!', missingLetterWord: 's_uer', sentence4Elements: ['Sauer', 'macht', 'lustig,', 'sagt ein altes Sprichwort.'] },
      { id: 'b03_78_04', german: 'bitter', arabic: 'مر المذاق', emoji: '☕', exampleSentenceGerman: 'Schwarzer Kaffee und dunkle Schokolade schmecken bitter.', exampleSentenceArabic: 'القهوة السادة والشوكولاتة الداكنة طعمهما مر.', missingLetterWord: 'b_tter', sentence4Elements: ['Diese', 'Medizin', 'schmeckt', 'leider ziemlich bitter.'] },
      { id: 'b03_78_05', german: 'scharf', arabic: 'حار / حريف (كالشطة والفلفل)', emoji: '🌶️', exampleSentenceGerman: 'Chilischoten sind für Kinder viel zu scharf.', exampleSentenceArabic: 'قرون الفلفل الحار لا تناسب الأطفال على الإطلاق.', missingLetterWord: 'sch_rf', sentence4Elements: ['Die', 'Sauce', 'ist', 'feurig scharf gewürzt.'] },
      { id: 'b03_78_06', german: 'lecker', arabic: 'شهي / لذيذ جداً', emoji: '😋', exampleSentenceGerman: 'Das Essen bei Oma ist immer unbeschreiblich lecker!', exampleSentenceArabic: 'الطعام عند الجدة دائماً لذيذ بشكل لا يوصف!', missingLetterWord: 'l_cker', sentence4Elements: ['Das', 'schmeckt', 'mir', 'heute wirklich sehr lecker.'] },
      { id: 'b03_78_07', german: 'köstlich', arabic: 'فاخر المذاق / شهي للغاية', emoji: '✨', exampleSentenceGerman: 'Der frische Kuchen schmeckt einfach köstlich.', exampleSentenceArabic: 'الكعك الطازج طعمه شهي وفاخر للغاية.', missingLetterWord: 'k_stlich', sentence4Elements: ['Ein', 'köstliches', 'Essen', 'für die ganze Familie.'] },
      { id: 'b03_78_08', german: 'knusprig', arabic: 'مقرمش', emoji: '🥨', exampleSentenceGerman: 'Die Brotkruste und Pommes sind herrlich knusprig.', exampleSentenceArabic: 'قشرة الخبز والبطاطس المقرمشة شهية جداً.', missingLetterWord: 'kn_sprig', sentence4Elements: ['Der', 'Keks', 'knuspert', 'beim Hineinbeißen so schön.'] },
      { id: 'b03_78_09', german: 'saftig', arabic: 'ممتلئ بالعصير / طري', emoji: '🍊', exampleSentenceGerman: 'Die Wassermelone ist herrlich erfrischend und saftig.', exampleSentenceArabic: 'البطيخ ممتلئ بالعصير ومنعش بدرجة رائعة.', missingLetterWord: 's_ftig', sentence4Elements: ['Ein', 'saftiger', 'Apfel', 'schmeckt an warmen Tagen.'] },
      { id: 'b03_78_10', german: 'cremig', arabic: 'كريمي القوام / ناعم الملمس', emoji: '🥣', exampleSentenceGerman: 'Der Joghurt und das Eis sind cremig und zart.', exampleSentenceArabic: 'الزبادي والآيس كريم قوامهما كريمي وناعم.', missingLetterWord: 'cr_mig', sentence4Elements: ['Die', 'Suppe', 'ist', 'samtig und wunderbar cremig.'] }
    ]
  },

  // 79. Setting the Table & Table Manners (جريد 2 / جريد 3)
  {
    id: 'curric_b03_79_table_manners',
    title: 'Tisch decken und Tischmanieren',
    titleTranslations: { ar: 'ترتيب المائدة وآداب تناول الطعام', de: 'Tisch decken und Tischmanieren', en: 'Table Setting & Manners' },
    topic: 'آداب المائدة',
    topicTranslations: { ar: 'آداب المائدة', de: 'Tischkultur', en: 'Table Manners' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'ترتيب المائدة، قول بالهناء والشفاء، والأدب على الطعام.',
    descriptionTranslations: { ar: 'ترتيب المائدة وآداب الطعام.', de: 'Guten Appetit, den Tisch decken und Danke sagen.', en: 'Setting tables and saying Guten Appetit.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_79_01', german: 'Guten Appetit', arabic: 'بالهناء والشفاء / شهية طيبة', emoji: '🍽️', exampleSentenceGerman: 'Vor dem Essen wünschen wir uns: Guten Appetit!', exampleSentenceArabic: 'قبل البدء في الأكل نتمنى لبعضنا: شهية طيبة!', missingLetterWord: 'Guten App_tit', sentence4Elements: ['Wir', 'wünschen', 'allen', 'einen guten Appetit!'] },
      { id: 'b03_79_02', german: 'Danke, gleichfalls', arabic: 'شكراً، ولك بالمثل', emoji: '😊', exampleSentenceGerman: 'Guten Appetit! – Danke, gleichfalls!', exampleSentenceArabic: 'شهية طيبة! - شكراً، ولكم بالمثل!', missingLetterWord: 'Danke, gl_ichfalls', sentence4Elements: ['Danke,', 'gleichfalls,', 'lass', 'es dir schmecken!'] },
      { id: 'b03_79_03', german: 'den Tisch decken', arabic: 'يرتب طاولة الطعام (يضع الصحون والملاعق)', emoji: '🍽️', exampleSentenceGerman: 'Ich helfe Mama und decke den Tisch für alle.', exampleSentenceArabic: 'أساعد أمي وأرتب مائدة الطعام للجميع.', missingLetterWord: 'den T_sch decken', sentence4Elements: ['Kinder', 'decken', 'den', 'Tisch vor dem Essen.'] },
      { id: 'b03_79_04', german: 'den Tisch abräumen', arabic: 'يرفع الأطباق وينظف المائدة بعد الأكل', emoji: '🧹', exampleSentenceGerman: 'Nach dem Essen räumen wir gemeinsam den Tisch ab.', exampleSentenceArabic: 'بعد الفراغ من الأكل نتعاون في رفع الأطباق عن المائدة.', missingLetterWord: 'den T_sch abräumen', sentence4Elements: ['Wir', 'räumen', 'die', 'Teller gemeinsam ab.'] },
      { id: 'b03_79_05', german: 'Reich mir bitte', arabic: 'ناولني من فضلك', emoji: '🤲', exampleSentenceGerman: 'Reich mir bitte das Brot und die Butter!', exampleSentenceArabic: 'ناولني الخبز والزبدة من فضلك!', missingLetterWord: 'R_ich mir bitte', sentence4Elements: ['Reich', 'mir', 'bitte', 'die Wasserkaraffe rüber!'] },
      { id: 'b03_79_06', german: 'Danke, ich habe genug', arabic: 'شكراً، لقد شبعت واكتفيت', emoji: '✋', exampleSentenceGerman: 'Möchtest du noch mehr? – Nein danke, ich habe genug.', exampleSentenceArabic: 'هل تريد المزيد؟ - لا شكراً، لقد شبعت واكتفيت.', missingLetterWord: 'ich habe gen_g', sentence4Elements: ['Danke,', 'ich', 'habe', 'wirklich genug gegessen.'] },
      { id: 'b03_79_07', german: 'das Tischtuch', arabic: 'مفرش المائدة (الغطاء)', article: 'das', plural: 'die Tischtücher', emoji: '🧺', exampleSentenceGerman: 'Mama legt ein sauberes weißes Tischtuch auf.', exampleSentenceArabic: 'تفرش أمي مفرش مائدة أبيض نظيفاً.', missingLetterWord: 'das T_schtuch', sentence4Elements: ['Das', 'Tischtuch', 'schützt', 'den schönen Holztisch.'] },
      { id: 'b03_79_08', german: 'die Serviette', arabic: 'المنديل للمسح', article: 'die', plural: 'die Servietten', emoji: '🧻', exampleSentenceGerman: 'Die Serviette legen wir ordentlich auf den Schoß.', exampleSentenceArabic: 'نضع منديل المائدة بأدب على الركبتين.', missingLetterWord: 'die Serv_ette', sentence4Elements: ['Benutze', 'deine', 'Serviette', 'beim Essen bitte!'] },
      { id: 'b03_79_09', german: 'gerade sitzen', arabic: 'يجلس مستقيماً بأدب على الكرسي', emoji: '🪑', exampleSentenceGerman: 'Beim Essen sitzen wir gerade und ruhig am Tisch.', exampleSentenceArabic: 'عند الأكل نجلس مستقيمي الظهر بهدوء حول المائدة.', missingLetterWord: 'ger_de sitzen', sentence4Elements: ['Sitz', 'bitte', 'ordentlich', 'gerade am Tisch!'] },
      { id: 'b03_79_10', german: 'nicht mit vollem Mund sprechen', arabic: 'عدم التحدث وفمك ممتلئ بالطعام', emoji: '🤐', exampleSentenceGerman: 'Wichtig: Bitte nicht mit vollem Mund sprechen!', exampleSentenceArabic: 'قاعدة مهمة: لا تتحدث وفمك ممتلئ بالطعام من فضلك!', missingLetterWord: 'v_llem Mund', sentence4Elements: ['Erst', 'kauen,', 'dann', 'in Ruhe sprechen!'] }
    ]
  },

  // 80. Ordering in a Restaurant or Café (جريد 2 / جريد 3)
  {
    id: 'curric_b03_80_restaurant_ordering',
    title: 'Im Restaurant und Café bestellen',
    titleTranslations: { ar: 'الطلب في المطعم والمقهى', de: 'Im Restaurant und Café bestellen', en: 'Ordering in a Restaurant' },
    topic: 'المطعم والطلب',
    topicTranslations: { ar: 'المطعم والطلب', de: 'Im Restaurant', en: 'At the Restaurant' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'عبارات طلب الطعام وقائمة الطعام والحساب بلطف.',
    descriptionTranslations: { ar: 'عبارات طلب الطعام والحساب بلطف.', de: 'Speisekarte, bestellen und bezahlen.', en: 'Menus, ordering and paying politely.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_80_01', german: 'die Speisekarte', arabic: 'قائمة الطعام (المنيو)', article: 'die', plural: 'die Speisekarten', emoji: '📜', exampleSentenceGerman: 'Darf ich bitte die Speisekarte sehen?', exampleSentenceArabic: 'هل يمكنني رؤية قائمة الطعام من فضلك؟', missingLetterWord: 'die Sp_isekarte', sentence4Elements: ['In', 'der', 'Speisekarte', 'gibt es viele Gerichte.'] },
      { id: 'b03_80_02', german: 'Ich hätte gern', arabic: 'أود أن أطلب / أرغب في الحصول على', emoji: '🙋‍♂️', exampleSentenceGerman: 'Ich hätte gern die Nudeln mit Tomatensauce.', exampleSentenceArabic: 'أود الحصول على المعكرونة بصلصة الطماطم.', missingLetterWord: 'Ich h_tte gern', sentence4Elements: ['Ich', 'hätte', 'gerne', 'ein Glas Wasser.'] },
      { id: 'b03_80_03', german: 'Ich nehme', arabic: 'أنا سآخذ (سأطلب)', emoji: '👉', exampleSentenceGerman: 'Für mich bitte eine Pizza mit extra Käse.', exampleSentenceArabic: 'بالنسبة لي بيتزا بجبن إضافي من فضلك.', missingLetterWord: 'Ich n_hme', sentence4Elements: ['Ich', 'nehme', 'die', 'leckere Gemüsesuppe bitte.'] },
      { id: 'b03_80_04', german: 'Was möchten Sie trinken?', arabic: 'ماذا تودون أن تشربوا؟', emoji: '🥤', exampleSentenceGerman: 'Der Kellner fragt: Was möchten Sie trinken?', exampleSentenceArabic: 'يسأل النادل: ماذا تودون أن تشربوا؟', missingLetterWord: 'Was m_chten Sie?', sentence4Elements: ['Was', 'möchten', 'Sie', 'heute gerne trinken?'] },
      { id: 'b03_80_05', german: 'Für die Kinder', arabic: 'للأطفال (وجبات الأطفال)', emoji: '👧', exampleSentenceGerman: 'Haben Sie auch eine Speisekarte für Kinder?', exampleSentenceArabic: 'هل لديكم قائمة طعام مخصصة للأطفال أيضاً؟', missingLetterWord: 'F_r die Kinder', sentence4Elements: ['Für', 'die', 'Kinder', 'gibt es Spaghetti.'] },
      { id: 'b03_80_06', german: 'der Kellner', arabic: 'النادل (الجرسون)', article: 'der', plural: 'die Kellner', emoji: '👨‍🍳', exampleSentenceGerman: 'Der freundliche Kellner bringt das Essen an den Tisch.', exampleSentenceArabic: 'النادل الودود يحضر الطعام إلى الطاولة.', missingLetterWord: 'der K_llner', sentence4Elements: ['Der', 'Kellner', 'bedient', 'uns sehr aufmerksam.'] },
      { id: 'b03_80_07', german: 'die Kellnerin', arabic: 'النادلة', article: 'die', plural: 'die Kellnerinnen', emoji: '👩‍🍳', exampleSentenceGerman: 'Die nette Kellnerin schenkt uns Saft nach.', exampleSentenceArabic: 'النادلة اللطيفة تعيد ملء أكوابنا بالعصير.', missingLetterWord: 'die K_llnerin', sentence4Elements: ['Die', 'Kellnerin', 'bringt', 'uns die Rechnung.'] },
      { id: 'b03_80_08', german: 'die Rechnung bitte', arabic: 'الحساب من فضلك', emoji: '🧾', exampleSentenceGerman: 'Entschuldigung, wir möchten gerne zahlen. Die Rechnung bitte!', exampleSentenceArabic: 'معذرة، نود الدفع. الحساب من فضلك!', missingLetterWord: 'die R_chnung bitte', sentence4Elements: ['Wir', 'hätten', 'gerne', 'die Rechnung bitte!'] },
      { id: 'b03_80_09', german: 'Zusammen oder getrennt?', arabic: 'معاً أم منفصلين؟ (في دفع الحساب في ألمانيا)', emoji: '💶', exampleSentenceGerman: 'Möchten Sie zusammen oder getrennt zahlen?', exampleSentenceArabic: 'هل ترغبون في الدفع معاً أم كل شخص على حدة؟', missingLetterWord: 'Zus_mmen oder getrennt', sentence4Elements: ['Wir', 'zahlen', 'heute', 'alles zusammen bitte.'] },
      { id: 'b03_80_10', german: 'Stimmt so', arabic: 'الباقي لك (احتفظ بالباقي كإكرامية)', emoji: '🪙', exampleSentenceGerman: 'Das macht achtzehn Euro. Hier sind zwanzig – stimmt so!', exampleSentenceArabic: 'المجموع ثمانية عشر يورو. تفضل عشرين يورو، والباقي لك!', missingLetterWord: 'St_mmt so', sentence4Elements: ['Danke', 'sehr,', 'das', 'stimmt so genau!'] }
    ]
  },

  // 81. Fast Food & Street Snacks (جريد 2 / جريد 3)
  {
    id: 'curric_b03_81_street_food',
    title: 'Street Food und Imbiss',
    titleTranslations: { ar: 'الوجبات السريعة وأطعمة الشارع', de: 'Street Food und Imbiss', en: 'Street Food & Snacks' },
    topic: 'الوجبات السريعة',
    topicTranslations: { ar: 'الوجبات السريعة', de: 'Schnellimbiss', en: 'Fast Food' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الدونر والكاري فورست والبطاطس والفلافل.',
    descriptionTranslations: { ar: 'الدونر والكاري فورست والبطاطس والفلافل.', de: 'Döner, Currywurst, Pommes und Falafel.', en: 'Döner, currywurst, fries and falafel.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_81_01', german: 'der Döner', arabic: 'شاورما الدونر في الخبز', article: 'der', plural: 'die Döner', emoji: '🥙', exampleSentenceGerman: 'Ein Döner mit Salat und Knoblauchsauce schmeckt super.', exampleSentenceArabic: 'الدونر مع السلطة وصلصة الثوم لذيذ جداً.', missingLetterWord: 'der D_ner', sentence4Elements: ['Ein', 'Döner', 'im', 'Fladenbrot macht richtig satt.'] },
      { id: 'b03_81_02', german: 'die Currywurst', arabic: 'سجق الكاري الألماني الشهير بالصلصة', article: 'die', plural: 'die Currywürste', emoji: '🌭', exampleSentenceGerman: 'In Berlin essen viele Menschen eine Currywurst mit Pommes.', exampleSentenceArabic: 'في برلين يأكل الكثيرون سجق الكاري مع البطاطس.', missingLetterWord: 'die C_rrywurst', sentence4Elements: ['Currywurst', 'ist', 'eine', 'bekannte Spezialität aus Berlin.'] },
      { id: 'b03_81_03', german: 'die Falafel', arabic: 'الفلافل المقرمشة (الطعمية)', article: 'die', plural: 'die Falafeln', emoji: '🧆', exampleSentenceGerman: 'Knusprige Falafelbällchen aus Kichererbsen schmecken toll.', exampleSentenceArabic: 'كرات الفلافل المقرمشة من الحمص طعمها رائع.', missingLetterWord: 'die F_lafel', sentence4Elements: ['Falafel', 'schmeckt', 'im', 'warmen Fladenbrot mit Sesam.'] },
      { id: 'b03_81_04', german: 'der Imbiss', arabic: 'كشك الوجبات الخفيفة والسريعة', article: 'der', plural: 'die Imbisse', emoji: '🏪', exampleSentenceGerman: 'Am Imbiss holen wir uns eine Portion knusprige Pommes.', exampleSentenceArabic: 'من كشك الوجبات الخفيفة نشتري طبق بطاطس مقلية.', missingLetterWord: 'der _mbiss', sentence4Elements: ['Vor', 'dem', 'Imbiss', 'duftet es nach Gebratenem.'] },
      { id: 'b03_81_05', german: 'das Fladenbrot', arabic: 'الخبز المفرود (الخبز العربي/التركي)', article: 'das', plural: 'die Fladenbrote', emoji: '🫓', exampleSentenceGerman: 'Das warme Fladenbrot ist mit Sesam bestreut.', exampleSentenceArabic: 'الخبز المفرود الدافئ مرشوش بالسمسم.', missingLetterWord: 'das Fl_denbrot', sentence4Elements: ['Fladenbrot', 'wird', 'mit', 'frischen Zutaten gefüllt.'] },
      { id: 'b03_81_06', german: 'die Knoblauchsauce', arabic: 'صلصة الثوم الكريمية (التومية)', article: 'die', plural: 'die Knoblauchsaucen', emoji: '🥣', exampleSentenceGerman: 'Die weiße Knoblauchsauce schmeckt würzig.', exampleSentenceArabic: 'صلصة الثوم البيضاء ذات نكهة مميزة.', missingLetterWord: 'Kn_blauchsauce', sentence4Elements: ['Ein', 'Löffel', 'Knoblauchsauce', 'gehört auf den Teller.'] },
      { id: 'b03_81_07', german: 'die Portion', arabic: 'الوجبة / الحصة من الطعام', article: 'die', plural: 'die Portionen', emoji: '🍽️', exampleSentenceGerman: 'Eine kleine Portion Pommes reicht mir völlig aus.', exampleSentenceArabic: 'حصة صغيرة من البطاطس تكفيني تماماً.', missingLetterWord: 'die P_rtion', sentence4Elements: ['Eine', 'große', 'Portion', 'für den großen Hunger!'] },
      { id: 'b03_81_08', german: 'die Mayonnaise', arabic: 'المايونيز', article: 'die', plural: 'die Mayonnaisen', emoji: '🥣', exampleSentenceGerman: 'Pommes rot-weiß bedeutet mit Ketchup und Mayonnaise.', exampleSentenceArabic: 'بطاطس روت-فايس تعني بالكاتشب والمايونيز معاً.', missingLetterWord: 'M_yonnaise', sentence4Elements: ['Pommes', 'mit', 'Mayonnaise', 'schmecken vielen Kindern.'] },
      { id: 'b03_81_09', german: 'derWrap', arabic: 'ساندويتش الراب الملفوف', article: 'der', plural: 'die Wraps', emoji: '🌯', exampleSentenceGerman: 'Der bunte Wrap ist mit Hähnchen und Salat gefüllt.', exampleSentenceArabic: 'ساندويتش الراب محشو بالدجاج والسلطة الخضراء.', missingLetterWord: 'der Wr_p', sentence4Elements: ['Ein', 'saftiger', 'Wrap', 'lässt sich leicht mitnehmen.'] },
      { id: 'b03_81_10', german: 'mitnehmen', arabic: 'يأخذ معه تيك أواي / سفري', emoji: '🛍️', exampleSentenceGerman: 'Zum hier Essen oder zum Mitnehmen?', exampleSentenceArabic: 'لتتناولها هنا في الصالة أم تأخذها معك سفري؟', missingLetterWord: 'm_tnehmen', sentence4Elements: ['Wir', 'nehmen', 'das', 'Essen heute mit nach Hause.'] }
    ]
  },

  // 82. Soups & Warm Stews (جريد 2 / جريد 3)
  {
    id: 'curric_b03_82_soups_stews',
    title: 'Suppen und Eintöpfe',
    titleTranslations: { ar: 'الحساء والشوربات الدافئة', de: 'Suppen und Eintöpfe', en: 'Soups and Stews' },
    topic: 'الحساء والشوربة',
    topicTranslations: { ar: 'الحساء والشوربة', de: 'Suppenküche', en: 'Soups' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'شوربة الطماطم، الخضار، العدس، الدجاج، وشوربة النودلز.',
    descriptionTranslations: { ar: 'شوربة الطماطم والخضار والعدس.', de: 'Tomatensuppe, Linsensuppe, Hühnersuppe.', en: 'Tomato soup, lentil soup and chicken soup.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_82_01', german: 'die Tomatensuppe', arabic: 'شوربة الطماطم', article: 'die', plural: 'die Tomatensuppen', emoji: '🍅', exampleSentenceGerman: 'Warme Tomatensuppe mit gerösteten Croutons schmeckt herrlich.', exampleSentenceArabic: 'شوربة الطماطم الدافئة مع مكعبات الخبز المحمص رائعة.', missingLetterWord: 'Tom_tensuppe', sentence4Elements: ['Rote', 'Tomatensuppe', 'wärmt', 'uns an regnerischen Tagen.'] },
      { id: 'b03_82_02', german: 'die Hühnersuppe', arabic: 'شوربة الدجاج الصحية', article: 'die', plural: 'die Hühnersuppen', emoji: '🍲', exampleSentenceGerman: 'Hühnersuppe hilft wunderbar bei Erkältung.', exampleSentenceArabic: 'شوربة الدجاج تساعد بامتياز عند الإصابة بالزكام.', missingLetterWord: 'H_hnersuppe', sentence4Elements: ['Heiße', 'Hühnersuppe', 'macht', 'kranke Kinder schnell gesund.'] },
      { id: 'b03_82_03', german: 'die Linsensuppe', arabic: 'شوربة العدس المغذية', article: 'die', plural: 'die Linsensuppen', emoji: '🍲', exampleSentenceGerman: 'Linsensuppe mit einem Schuss Essig ist ein Klassiker.', exampleSentenceArabic: 'شوربة العدس بلمسة من الخل طبق كلاسيكي عريق.', missingLetterWord: 'L_nsensuppe', sentence4Elements: ['Linsensuppe', 'macht', 'lange', 'und gesund satt.'] },
      { id: 'b03_82_04', german: 'die Erbsensuppe', arabic: 'شوربة البازلاء الخضراء', article: 'die', plural: 'die Erbsensuppen', emoji: '🍲', exampleSentenceGerman: 'Dicke Erbsensuppe kocht man im Winter gern.', exampleSentenceArabic: 'شوربة البازلاء الكثيفة تطبخ بحب في الشتاء.', missingLetterWord: '_rbsensuppe', sentence4Elements: ['Grüne', 'Erbsensuppe', 'schmeckt', 'mit Würstchen besonders herzhaft.'] },
      { id: 'b03_82_05', german: 'die Nudelsuppe', arabic: 'شوربة لسان العصفور / المعكرونة', article: 'die', plural: 'die Nudelsuppen', emoji: '🍜', exampleSentenceGerman: 'In der Nudelsuppe schwimmen kleine Buchstabennudeln.', exampleSentenceArabic: 'في شوربة النودلز تسبح حروف معكرونة صغيرة مبهجة.', missingLetterWord: 'N_delsuppe', sentence4Elements: ['Buchstabensuppe', 'macht', 'Kindern', 'riesigen Spaß beim Essen.'] },
      { id: 'b03_82_06', german: 'der Eintopf', arabic: 'اليخنة / الإنتوبف الألماني المليء بالخضار', article: 'der', plural: 'die Eintöpfe', emoji: '🍲', exampleSentenceGerman: 'Im Eintopf sind Kartoffeln, Karotten und Bohnen zusammen.', exampleSentenceArabic: 'في طبق اليخنة تجتمع البطاطس والجزر والفاصوليا.', missingLetterWord: 'der _intopf', sentence4Elements: ['Ein', 'deftiger', 'Eintopf', 'schmeckt der ganzen Familie.'] },
      { id: 'b03_82_07', german: 'die Croutons', arabic: 'مكعبات الخبز المحمص المقرمشة', article: 'die', plural: 'die Croutons', emoji: '🍞', exampleSentenceGerman: 'Knusprige Croutons streuen wir auf die Suppe.', exampleSentenceArabic: 'نرش مكعبات الخبز المحمص المقرمشة فوق الشوربة.', missingLetterWord: 'die Cr_utons', sentence4Elements: ['Croutons', 'knuspern', 'lecker', 'in der warmen Suppe.'] },
      { id: 'b03_82_08', german: 'der Suppenlöffel', arabic: 'ملعقة الشوربة الكبيرة', article: 'der', plural: 'die Suppenlöffel', emoji: '🥄', exampleSentenceGerman: 'Mit dem Suppenlöffel löffeln wir die Brühe aus.', exampleSentenceArabic: 'بملعقة الشوربة نتناول المرق الشهي.', missingLetterWord: 'S_ppenlöffel', sentence4Elements: ['Der', 'große', 'Löffel', 'passt genau zur Schüssel.'] },
      { id: 'b03_82_09', german: 'pusten', arabic: 'ينفخ لتبريد الشوربة الساخنة', emoji: '💨', exampleSentenceGerman: 'Puste vorsichtig, die Suppe ist noch sehr heiß!', exampleSentenceArabic: 'انفخ بحذر، فالشوربة لا تزال ساخنة جداً!', missingLetterWord: 'p_sten', sentence4Elements: ['Erst', 'vorsichtig', 'pusten,', 'dann erst genießen!'] },
      { id: 'b03_82_10', german: 'dampfend', arabic: 'يتصاعد منه البخار ساخناً', emoji: '♨️', exampleSentenceGerman: 'Die dampfende Suppe wärmt unsere kalten Hände.', exampleSentenceArabic: 'الشوربة المتصاعد منها البخار تدفئ أيدينا الباردة.', missingLetterWord: 'd_mpfend', sentence4Elements: ['Ein', 'dampfender', 'Teller', 'steht vor jedem Gast.'] }
    ]
  },

  // 83. Salads & Fresh Dressings (جريد 2 / جريد 3)
  {
    id: 'curric_b03_83_salads_fresh',
    title: 'Knackige Salate',
    titleTranslations: { ar: 'السلطات المقرمشة والمقبلات', de: 'Knackige Salate', en: 'Crisp Salads' },
    topic: 'السلطات والمقبلات',
    topicTranslations: { ar: 'السلطات والمقبلات', de: 'Salate', en: 'Salads' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'سلطة الخيار والبطاطس والجزر والتتبيلة الطازجة.',
    descriptionTranslations: { ar: 'سلطة الخيار والبطاطس والجزر.', de: 'Gurkensalat, Kartoffelsalat, Karottensalat.', en: 'Cucumber salad, potato salad and dressings.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_83_01', german: 'der Gurkensalat', arabic: 'سلطة الخيار المنعشة', article: 'der', plural: 'die Gurkensalate', emoji: '🥒', exampleSentenceGerman: 'Frischer Gurkensalat mit Dill schmeckt herrlich im Sommer.', exampleSentenceArabic: 'سلطة الخيار مع الشبت منعشة ولذيذة في الصيف.', missingLetterWord: 'G_rkensalat', sentence4Elements: ['Dünne', 'Gurkenscheiben', 'schwimmen', 'in feinem Kräuterdressing.'] },
      { id: 'b03_83_02', german: 'der Kartoffelsalat', arabic: 'سلطة البطاطس الألمانية الشهيرة', article: 'der', plural: 'die Kartoffelsalate', emoji: '🥔', exampleSentenceGerman: 'Kartoffelsalat ist die beliebteste Beilage in Deutschland.', exampleSentenceArabic: 'سلطة البطاطس هي أشهر طبق جانبي في ألمانيا.', missingLetterWord: 'Kart_ffelsalat', sentence4Elements: ['Omas', 'Kartoffelsalat', 'gehört', 'zu jedem großen Fest.'] },
      { id: 'b03_83_03', german: 'der Karottensalat', arabic: 'سلطة الجزر المبشور مع الليمون', article: 'der', plural: 'die Karottensalate', emoji: '🥕', exampleSentenceGerman: 'Geraspelter Karottensalat mit etwas Apfel ist süß und saftig.', exampleSentenceArabic: 'سلطة الجزر المبشور مع التفاح حلوة ومليئة بالعصير.', missingLetterWord: 'Kar_ttensalat', sentence4Elements: ['Karottensalat', 'bringt', 'Farbe', 'und Vitamine auf den Tisch.'] },
      { id: 'b03_83_04', german: 'der Nudelsalat', arabic: 'سلطة المعكرونة الباردة للحفلات', article: 'der', plural: 'die Nudelsalate', emoji: '🥗', exampleSentenceGerman: 'Zum Schulfest bringen wir eine große Schüssel Nudelsalat mit.', exampleSentenceArabic: 'لحفل المدرسة نحضر وعاء كبيراً من سلطة المعكرونة.', missingLetterWord: 'N_delsalat', sentence4Elements: ['Bunter', 'Nudelsalat', 'mit', 'Erbsen und Mais schmeckt.'] },
      { id: 'b03_83_05', german: 'das Dressing', arabic: 'صلصة السلطة (الدريسنج / التتبيلة)', article: 'das', plural: 'die Dressings', emoji: '🫗', exampleSentenceGerman: 'Ein Dressing aus Joghurt und Zitrone schmeckt mild.', exampleSentenceArabic: 'تتبيلة الزبادي والليمون خفيفة المذاق.', missingLetterWord: 'das Dr_ssing', sentence4Elements: ['Das', 'Dressing', 'macht', 'den Salat erst richtig knackig.'] },
      { id: 'b03_83_06', german: 'der Kopfsalat', arabic: 'خس الكابوتشا / الخس المدور', article: 'der', plural: 'die Kopfsalate', emoji: '🥬', exampleSentenceGerman: 'Der frische Kopfsalat hat zarte grüne Blätter.', exampleSentenceArabic: 'الخس الطازج له أوراق خضراء يانعة وطازجة.', missingLetterWord: 'K_pfsalat', sentence4Elements: ['Wir', 'waschen', 'die', 'Salatblätter gründlich im Wasser.'] },
      { id: 'b03_83_07', german: 'die Salatschleuder', arabic: 'مجففة أوراق السلطة الدوارة', article: 'die', plural: 'die Salatschleudern', emoji: '🌀', exampleSentenceGerman: 'Mit der Salatschleuder schleudern wir das Wasser ab.', exampleSentenceArabic: 'بمجففة السلطة الدوارة نزيل قطرات الماء عن الأوراق.', missingLetterWord: 'Sal_tschleuder', sentence4Elements: ['Die', 'Salatschleuder', 'dreht', 'sich blitzschnell im Kreis.'] },
      { id: 'b03_83_08', german: 'der Mais', arabic: 'حبات الذرة الحلوة للسلطة', article: 'der', plural: 'die Maise', emoji: '🌽', exampleSentenceGerman: 'Gelber Mais macht den Salat schön bunt und süß.', exampleSentenceArabic: 'الذرة الصفراء تجعل السلطة زاهية وحلوة الطعم.', missingLetterWord: 'der M_is', sentence4Elements: ['Süßer', 'Mais', 'knackt', 'beim Kauen herrlich frisch.'] },
      { id: 'b03_83_09', german: 'die Oliven', arabic: 'حبات الزيتون (الأسود والأخضر)', article: 'die', plural: 'die Oliven', emoji: '🫒', exampleSentenceGerman: 'Schwarze und grüne Oliven schmecken würzig.', exampleSentenceArabic: 'حبات الزيتون الأسود والأخضر غنية بالنكهة.', missingLetterWord: 'die Ol_ven', sentence4Elements: ['Oliven', 'passen', 'gut', 'zum griechischen Bauernsalat.'] },
      { id: 'b03_83_10', german: 'knackig', arabic: 'طازج ومقرمش تحت الأضراس', emoji: '🥗', exampleSentenceGerman: 'Der Salat ist wunderbar knackig und kühl.', exampleSentenceArabic: 'السلطة مقرمشة ومنعشة للغاية.', missingLetterWord: 'kn_ckig', sentence4Elements: ['Frisches', 'Gemüse', 'bleibt', 'im Kühlschrank lange knackig.'] }
    ]
  },

  // 84. Pasta, Rice & Italian Favorites (جريد 2 / جريد 3)
  {
    id: 'curric_b03_84_pasta_rice',
    title: 'Nudeln, Reis und Auflauf',
    titleTranslations: { ar: 'المعكرونة والأرز والصواني المخبوزة', de: 'Nudeln, Reis und Auflauf', en: 'Pasta, Rice and Casseroles' },
    topic: 'المعكرونة والأرز',
    topicTranslations: { ar: 'المعكرونة والأرز', de: 'Pasta & Reis', en: 'Pasta & Rice' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'السباغيتي واللازانيا والتورتيليني والريزوتو.',
    descriptionTranslations: { ar: 'السباغيتي واللازانيا والتورتيليني.', de: 'Spaghetti, Lasagne, Auflauf und Tortellini.', en: 'Spaghetti, lasagna, casseroles and rice.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_84_01', german: 'die Spaghetti', arabic: 'معكرونة الاسباجيتي الطويلة', article: 'die', plural: 'die Spaghetti', emoji: '🍝', exampleSentenceGerman: 'Wir wickeln die langen Spaghetti kunstvoll auf die Gabel.', exampleSentenceArabic: 'نلف أعواد الاسباجيتي الطويلة بمهارة على الشوكة.', missingLetterWord: 'die Spagh_tti', sentence4Elements: ['Spaghetti', 'Bolognese', 'ist', 'der absolute Kinderfavorit.'] },
      { id: 'b03_84_02', german: 'die Lasagne', arabic: 'اللازانيا المخبوزة بالصلصة والجبن', article: 'die', plural: 'die Lasagnen', emoji: '🫕', exampleSentenceGerman: 'Heiß duftende Lasagne aus dem Ofen schmeckt göttlich.', exampleSentenceArabic: 'اللازانيا الساخنة الزكية من الفرن طعمها لا يقاوم.', missingLetterWord: 'die Las_gne', sentence4Elements: ['Schichten', 'aus', 'Nudeln,', 'Sauce und goldbraunem Käse.'] },
      { id: 'b03_84_03', german: 'der Auflauf', arabic: 'صينية الفرن المخبوزة (الكاسرول)', article: 'der', plural: 'die Aufläufe', emoji: '🥘', exampleSentenceGerman: 'Kartoffelauflauf mit knuspriger Käsekruste ist köstlich.', exampleSentenceArabic: 'صينية البطاطس بالفرن مع طبقة الجبن المقرمشة لذيذة.', missingLetterWord: 'der _uflauf', sentence4Elements: ['Der', 'Auflauf', 'bäckt', 'goldbraun im heißen Ofen.'] },
      { id: 'b03_84_04', german: 'die Tortellini', arabic: 'التورتيليني المحشوة بالجبن أو السبانخ', article: 'die', plural: 'die Tortellini', emoji: '🥟', exampleSentenceGerman: 'Kleine gefüllte Tortellini schwimmen in Tomatensauce.', exampleSentenceArabic: 'حبات التورتيليني المحشوة تسبح في صلصة الطماطم.', missingLetterWord: 'Tort_llini', sentence4Elements: ['Tortellini', 'sind', 'mit', 'cremigem Ricotta-Käse gefüllt.'] },
      { id: 'b03_84_05', german: 'der Parmesankäse', arabic: 'جبن البارميزان المبشور', article: 'der', plural: 'die Parmesankäse', emoji: '🧀', exampleSentenceGerman: 'Ich streue viel geriebenen Parmesan über meine Nudeln.', exampleSentenceArabic: 'أرش الكثير من جبن البارميزان المبشور فوق المعكرونة.', missingLetterWord: 'P_rmesan', sentence4Elements: ['Parmesan', 'schmilzt', 'wunderbar', 'auf der heißen Pasta.'] },
      { id: 'b03_84_06', german: 'das Risotto', arabic: 'الريزوتو (الأرز الإيطالي الكريمي)', article: 'das', plural: 'die Risottos', emoji: '🍚', exampleSentenceGerman: 'Cremiges Risotto mit Champignons schmeckt herrlich zart.', exampleSentenceArabic: 'الريزوتو الكريمي مع الفطر طري ولذيذ جداً.', missingLetterWord: 'das Ris_tto', sentence4Elements: ['Das', 'Risotto', 'wird', 'mit Brühe langsam gerührt.'] },
      { id: 'b03_84_07', german: 'die Penne', arabic: 'معكرونة القلم (البيني)', article: 'die', plural: 'die Penne', emoji: '🍝', exampleSentenceGerman: 'Schräge Penne nehmen die feine Tomatensauce super auf.', exampleSentenceArabic: 'معكرونة القلم المشطوفة تتشرب صلصة الطماطم بامتياز.', missingLetterWord: 'die P_nne', sentence4Elements: ['Penne', 'Rigate', 'sind', 'geriffelt und bissfest gekocht.'] },
      { id: 'b03_84_08', german: 'die Gnocchi', arabic: 'النيوكي (كرات بطاطس المعكرونة الإيطالية)', article: 'die', plural: 'die Gnocchi', emoji: '🥔', exampleSentenceGerman: 'Weiche Kartoffel-Gnocchi mit Butter und Salbei schmecken feiner.', exampleSentenceArabic: 'كرات النيوكي الطرية بالزبدة والمريمية شهية للغاية.', missingLetterWord: 'Gn_cchi', sentence4Elements: ['Gnocchi', 'werden', 'aus', 'gekochten Kartoffeln gemacht.'] },
      { id: 'b03_84_09', german: 'al dente', arabic: 'ناضجة بصلابة خفيفة (طريقة طهي المعكرونة الإيطالية)', emoji: '🍝', exampleSentenceGerman: 'Nudeln schmecken am besten, wenn sie al dente sind.', exampleSentenceArabic: 'تكون المعكرونة في أشهى حالاتها حين تطهى بقوام متماسك.', missingLetterWord: 'al d_nte', sentence4Elements: ['Die', 'Nudeln', 'sind', 'perfekt al dente gegart.'] },
      { id: 'b03_84_10', german: 'das Nudelsieb', arabic: 'مصفاة المعكرونة', article: 'das', plural: 'die Nudelsiebe', emoji: '🥣', exampleSentenceGerman: 'Mama gießt das Nudelwasser durch das Nudelsieb ab.', exampleSentenceArabic: 'تصفي أمي ماء المعكرونة المغلي عبر المصفاة.', missingLetterWord: 'N_delsieb', sentence4Elements: ['Das', 'Sieb', 'fängt', 'alle fertigen Nudeln sicher auf.'] }
    ]
  },

  // 85. German Traditional Specialties (جريد 2 / جريد 3)
  {
    id: 'curric_b03_85_german_specialties',
    title: 'Deutsche Spezialitäten',
    titleTranslations: { ar: 'الأطباق والوجبات الألمانية التقليدية', de: 'Deutsche Spezialitäten', en: 'German Specialties' },
    topic: 'المطبخ الألماني',
    topicTranslations: { ar: 'المطبخ الألماني', de: 'Traditionelle Küche', en: 'German Cuisine' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الشباتزلي والزلابية والملفوف المخلل وفطائر البطاطس.',
    descriptionTranslations: { ar: 'الشباتزلي والزلابية والملفوف المخلل.', de: 'Spätzle, Knödel, Sauerkraut, Kartoffelpuffer.', en: 'Spätzle, dumplings, sauerkraut and potato pancakes.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_85_01', german: 'die Spätzle', arabic: 'الشباتزلي (معكرونة البيض التقليدية في جنوب ألمانيا)', article: 'die', plural: 'die Spätzle', emoji: '🍜', exampleSentenceGerman: 'Käsespätzle mit Röstzwiebeln sind im Schwabenland berühmt.', exampleSentenceArabic: 'شباتزلي الجبن مع البصل المقرمش مشهورة في جنوب ألمانيا.', missingLetterWord: 'die Sp_tzle', sentence4Elements: ['Frische', 'Spätzle', 'schmecken', 'mit viel zartem Käse.'] },
      { id: 'b03_85_02', german: 'der Knödel', arabic: 'الكلوس / الكنودل (كرة البطاطس أو الخبز المسلوقة)', article: 'der', plural: 'die Knödel', emoji: '🥔', exampleSentenceGerman: 'In Bayern isst man sonntags große Kartoffelknödel mit Braten.', exampleSentenceArabic: 'في بافاريا يأكلون كرات بطاطس كنودل مع اللحم المشوي.', missingLetterWord: 'der Kn_del', sentence4Elements: ['Runde', 'Knödel', 'passen', 'hervorragend zu brauner Sauce.'] },
      { id: 'b03_85_03', german: 'der Kartoffelpuffer', arabic: 'فطيرة البطاطس المبشورة المقلية (الريبتكوشن)', article: 'der', plural: 'die Kartoffelpuffer', emoji: '🥞', exampleSentenceGerman: 'Knusprige Kartoffelpuffer essen wir mit süßem Apfelmus.', exampleSentenceArabic: 'فطائر البطاطس المقرمشة نأكلها مع بيوريه التفاح الحلو.', missingLetterWord: 'Kart_ffelpuffer', sentence4Elements: ['Kartoffelpuffer', 'braten', 'goldbraun', 'in der heißen Pfanne.'] },
      { id: 'b03_85_04', german: 'das Apfelmus', arabic: 'بيوريه التفاح المطبوخ المهروس', article: 'das', plural: 'die Apfelmuse', emoji: '🍎', exampleSentenceGerman: 'Kühles Apfelmus schmeckt fruchtig zu Pfannkuchen und Puffern.', exampleSentenceArabic: 'بيوريه التفاح البارد فاكهي ولذيذ مع البان كيك.', missingLetterWord: 'das _pfelmus', sentence4Elements: ['Oma', 'kocht', 'Apfelmus', 'aus den eigenen Äpfeln.'] },
      { id: 'b03_85_05', german: 'der Kaiserschmarrn', arabic: 'الكايزرشمارن (فطيرة مقطعة مسكرة تقليدية)', article: 'der', plural: 'die Kaiserschmarrn', emoji: '🥞', exampleSentenceGerman: 'Kaiserschmarrn mit Rosinen und Puderzucker schmeckt in den Bergen.', exampleSentenceArabic: 'الكايزرشمارن بالزبيب وسكر البودرة تحلية مفضلة في الجبال.', missingLetterWord: 'K_iserschmarrn', sentence4Elements: ['Kaiserschmarrn', 'wird', 'mit', 'zwei Gabeln zerrissen.'] },
      { id: 'b03_85_06', german: 'das Sauerkraut', arabic: 'الملفوف المخلل المخمر (الساوركراوت)', article: 'das', plural: 'die Sauerkräuter', emoji: '🥬', exampleSentenceGerman: 'Sauerkraut enthält viel gesundes Vitamin C für den Winter.', exampleSentenceArabic: 'الملفوف المخمر غني بفيتامين سي الصحي لفصل الشتاء.', missingLetterWord: 'S_uerkraut', sentence4Elements: ['Sauerkraut', 'ist', 'eine', 'traditionelle deutsche Spezialität.'] },
      { id: 'b03_85_07', german: 'der Lebkuchen', arabic: 'بسكويت خبز الزنجبيل والعسل الشتوي', article: 'der', plural: 'die Lebkuchen', emoji: '🍪', exampleSentenceGerman: 'Auf dem Weihnachtsmarkt duftet es nach Nürnberger Lebkuchen.', exampleSentenceArabic: 'في سوق الشتاء تفوح رائحة كعك الزنجبيل الشهير.', missingLetterWord: 'der L_bkuchen', sentence4Elements: ['Würziger', 'Lebkuchen', 'schmeckt', 'nach Zimt und Nelken.'] },
      { id: 'b03_85_08', german: 'der Rote Grütze', arabic: 'حلوى التوت الأحمر بالنشا والكريمة', article: 'die', plural: 'die Roten Grützen', emoji: '🍓', exampleSentenceGerman: 'Rote Grütze aus Beeren mit Vanillesauce ist eine Spezialität.', exampleSentenceArabic: 'حلوى التوت المشكل مع صلصة الفانيليا طبق شهير شمالاً.', missingLetterWord: 'R_te Grütze', sentence4Elements: ['Rote', 'Grütze', 'schmeckt', 'fruchtig mit Vanillesauce.'] },
      { id: 'b03_85_09', german: 'die Maultaschen', arabic: 'الماولتاشن (جيوب العجين المحشوة على الطريقة الشفابية)', article: 'die', plural: 'die Maultaschen', emoji: '🥟', exampleSentenceGerman: 'Maultaschen in kräftiger Brühe wärmen wunderbar.', exampleSentenceArabic: 'جيوب الماولتاشن في مرق ساخن تدفئ بشكل ممتاز.', missingLetterWord: 'M_ultaschen', sentence4Elements: ['Maultaschen', 'sind', 'große', 'schwäbische gefüllte Nudeltaschen.'] },
      { id: 'b03_85_10', german: 'die Schwarzwälder Kirschtorte', arabic: 'تورتة الغابة السوداء الشهيرة بالكرز والكريمة', article: 'die', plural: 'die Schwarzwälder Kirschtorten', emoji: '🎂', exampleSentenceGerman: 'Die Schwarzwälder Kirschtorte ist berühmt auf der ganzen Welt.', exampleSentenceArabic: 'تورتة الغابة السوداء بالكرز مشهورة في كل أرجاء العالم.', missingLetterWord: 'Schwarzw_lder Torte', sentence4Elements: ['Schokolade,', 'Sahne', 'und', 'Kirschen krönen die Torte.'] }
    ]
  },

  // 86. Sandwiches, Dips & Party Fingerfood (جريد 2 / جريد 3)
  {
    id: 'curric_b03_86_fingerfood_dips',
    title: 'Snacks, Dips und Fingerfood',
    titleTranslations: { ar: 'المقبلات والصلصات والمغموسات', de: 'Snacks, Dips und Fingerfood', en: 'Snacks & Dips' },
    topic: 'المقبلات والمغموسات',
    topicTranslations: { ar: 'المقبلات والمغموسات', de: 'Fingerfood', en: 'Snacks & Dips' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الحمص والجواكامولي والجبن والتوست والمقرمشات.',
    descriptionTranslations: { ar: 'الحمص والجواكامولي والجبن والمقرمشات.', de: 'Hummus, Kräuterquark, Guacamole und Cracker.', en: 'Hummus, herb curd, guacamole and crackers.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_86_01', german: 'der Hummus', arabic: 'حمص بطحينة (المتبل الكريمي)', article: 'der', plural: 'die Hummus', emoji: '🧆', exampleSentenceGerman: 'Hummus aus Kichererbsen schmeckt herrlich mit Fladenbrot.', exampleSentenceArabic: 'الحمص المتبل المصنوع من الحمص رائع مع الخبز.', missingLetterWord: 'der H_mmus', sentence4Elements: ['Cremiger', 'Hummus', 'ist', 'gesund und schmeckt prima.'] },
      { id: 'b03_86_02', german: 'der Kräuterquark', arabic: 'الجبن القريش بالأعشاب والملح', article: 'der', plural: 'die Kräuterquarks', emoji: '🥣', exampleSentenceGerman: 'Frische Karottensticks dippen wir in Kräuterquark.', exampleSentenceArabic: 'نغمس أصابع الجزر الطازجة في جبن الكوارك بالأعشاب.', missingLetterWord: 'Kr_uterquark', sentence4Elements: ['Kräuterquark', 'mit', 'Schnittlauch', 'ist schnell gemacht.'] },
      { id: 'b03_86_03', german: 'die Guacamole', arabic: 'صلصة الجواكامولي (مهروس الأفوكادو اللذيذ)', article: 'die', plural: 'die Guacamoles', emoji: '🥑', exampleSentenceGerman: 'Guacamole wird aus reifem Avocado und Limettensaft zubereitet.', exampleSentenceArabic: 'تحضر الجواكامولي من الأفوكادو الناضج وعصير الليمون.', missingLetterWord: 'Guac_mole', sentence4Elements: ['Grüne', 'Guacamole', 'passt', 'gut zu knusprigen Tortillachips.'] },
      { id: 'b03_86_04', german: 'der Dip', arabic: 'صلصة التغميس (المغموس)', article: 'der', plural: 'die Dips', emoji: '🥣', exampleSentenceGerman: 'Auf dem Geburtstagstisch stehen drei verschiedene Dips.', exampleSentenceArabic: 'على مائدة عيد الميلاد توجد ثلاث صلصات تغميس مختلفة.', missingLetterWord: 'der D_p', sentence4Elements: ['Gemüsesticks', 'in', 'den', 'leckeren Dip tauchen!'] },
      { id: 'b03_86_05', german: 'die Chips', arabic: 'رقائق البطاطس المقرمشة (الشيبس)', article: 'die', plural: 'die Chips', emoji: '🥔', exampleSentenceGerman: 'Paprika-Chips knuspern laut bei jedem Bissen.', exampleSentenceArabic: 'رقائق الشيبس بنكهة البابريكا تقرمش مع كل قضمة.', missingLetterWord: 'die Ch_ps', sentence4Elements: ['Knusprige', 'Chips', 'gibt', 'es nur zu Festen.'] },
      { id: 'b03_86_06', german: 'das Popcorn', arabic: 'الفشار (البوشار الخفيف)', article: 'das', plural: 'die Popcorn', emoji: '🍿', exampleSentenceGerman: 'Im Kino essen wir eine große Tüte süßes Popcorn.', exampleSentenceArabic: 'في السينما نأكل كيساً كبيراً من الفشار الحلو.', missingLetterWord: 'das P_pcorn', sentence4Elements: ['Maiskörner', 'poppen', 'in', 'der Pfanne zu Popcorn auf.'] },
      { id: 'b03_86_07', german: 'die Erdnüsse', arabic: 'الفول السوداني المحمص', article: 'die', plural: 'die Erdnüsse', emoji: '🥜', exampleSentenceGerman: 'Wir knacken die Schale und essen die gerösteten Erdnüsse.', exampleSentenceArabic: 'نكسر القشرة ونأكل حبات الفول السوداني المحمصة.', missingLetterWord: 'die _rdnüsse', sentence4Elements: ['Erdnüsse', 'sind', 'reich', 'an Energie und guten Fetten.'] },
      { id: 'b03_86_08', german: 'das Knäckebrot', arabic: 'الخبز السويدي المقرمش (الكنكه بروت)', article: 'das', plural: 'die Knäckebrote', emoji: '🍞', exampleSentenceGerman: 'Knäckebrot mit Butter und Käse knackt herrlich.', exampleSentenceArabic: 'الخبز المقرمش مع الزبدة والجبن يصدر صوتاً مقرمشاً.', missingLetterWord: 'Kn_ckebrot', sentence4Elements: ['Dünnes', 'Knäckebrot', 'bleibt', 'sehr lange frisch und trocken.'] },
      { id: 'b03_86_09', german: 'die Salzstangen', arabic: 'أصابع البسكويت المملحة المقرمشة', article: 'die', plural: 'die Salzstangen', emoji: '🥨', exampleSentenceGerman: 'Kinder knabbern auf Kindergeburtstagen gern Salzstangen.', exampleSentenceArabic: 'الأطفال يقرمشون أصابع البسكويت المملحة في أعياد الميلاد.', missingLetterWord: 'S_lzstangen', sentence4Elements: ['Dünne', 'Salzstangen', 'sind', 'ein klassischer Kindersnack.'] },
      { id: 'b03_86_10', german: 'knabbern', arabic: 'يقرمش / يقضم بمرح', emoji: '😋', exampleSentenceGerman: 'Wir knabbern bunte Gemüsesticks vor dem Fernseher.', exampleSentenceArabic: 'نقرمش أصابع الخضار الملونة أمام التلفاز.', missingLetterWord: 'kn_bbern', sentence4Elements: ['Knabbern', 'macht', 'mit', 'Freunden doppelt Spaß.'] }
    ]
  },

  // 87. Warm Drinks, Tea & Cocoa (جريد 2 / جريد 3)
  {
    id: 'curric_b03_87_warm_drinks_tea',
    title: 'Warme Getränke und Teesorten',
    titleTranslations: { ar: 'المشروبات الدافئة وأنواع الشاي', de: 'Warme Getränke und Teesorten', en: 'Warm Drinks and Teas' },
    topic: 'المشروبات الدافئة',
    topicTranslations: { ar: 'المشروبات الدافئة', de: 'Heißgetränke', en: 'Warm Drinks' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'شاي النعناع والبابونج والكاكاو واللبن الدافئ بالعسل.',
    descriptionTranslations: { ar: 'شاي النعناع والبابونج والكاكاو واللبن.', de: 'Pfefferminztee, Kamillentee, Heiße Schokolade.', en: 'Peppermint tea, chamomile, cocoa and milk.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_87_01', german: 'der Pfefferminztee', arabic: 'شاي النعناع الفلفلي المنعش', article: 'der', plural: 'die Pfefferminztees', emoji: '🍵', exampleSentenceGerman: 'Pfefferminztee mit Minzblättern aus dem Garten duftet herrlich.', exampleSentenceArabic: 'شاي النعناع بأوراق طازجة من الحديقة عطر ورائع.', missingLetterWord: 'Pfeff_rminztee', sentence4Elements: ['Heißer', 'Pfefferminztee', 'erfrischt', 'Körper und Geist.'] },
      { id: 'b03_87_02', german: 'der Kamillentee', arabic: 'شاي البابونج المهدئ', article: 'der', plural: 'die Kamillentees', emoji: '🌼', exampleSentenceGerman: 'Bei Halsschmerzen hilft eine Tasse milder Kamillentee.', exampleSentenceArabic: 'عند احتقان الحلق يفيد كوب دافئ من شاي البابونج.', missingLetterWord: 'Kam_llentee', sentence4Elements: ['Kamillentee', 'beruhigt', 'den', 'Körper vor dem Schlafen.'] },
      { id: 'b03_87_03', german: 'der Früchtetee', arabic: 'شاي الفواكه المجففة اللذيذ', article: 'der', plural: 'die Früchtetees', emoji: '🫖', exampleSentenceGerman: 'Roter Früchtetee schmeckt nach Kirschen und Beeren.', exampleSentenceArabic: 'شاي الفواكه الأحمر بطعم الكرز والتوت البري.', missingLetterWord: 'Fr_chtetee', sentence4Elements: ['Der', 'Früchtetee', 'leuchtet', 'rot wie reife Beeren.'] },
      { id: 'b03_87_04', german: 'die heiße Schokolade', arabic: 'مشروب الشوكولاتة الساخنة', article: 'die', plural: 'die heißen Schokoladen', emoji: '☕', exampleSentenceGerman: 'Nach dem Rodeln trinken wir heiße Schokolade mit Sahne.', exampleSentenceArabic: 'بعد التزلج على الثلج نشرب شوكولاتة ساخنة بالكريمة.', missingLetterWord: 'h_iße Schokolade', sentence4Elements: ['Heiße', 'Schokolade', 'mit', 'Sahnehaube wärmt auf.'] },
      { id: 'b03_87_05', german: 'die warme Milch', arabic: 'الحليب الدافئ مع العسل', article: 'die', plural: 'die warmen Milche', emoji: '🥛', exampleSentenceGerman: 'Warme Milch mit Honig hilft beim sanften Einschlafen.', exampleSentenceArabic: 'الحليب الدافئ مع العسل يساعد على النوم الهانئ.', missingLetterWord: 'w_rme Milch', sentence4Elements: ['Ein', 'Becher', 'warme', 'Milch vor dem Schlafengehen.'] },
      { id: 'b03_87_06', german: 'der Kinderpunsch', arabic: 'مشروب البنش للأطفال (عصير فواكه دافئ بالقرفة)', article: 'der', plural: 'die Kinderpunsche', emoji: '🫖', exampleSentenceGerman: 'Auf dem Wintermarkt trinken alle Kinder warmen Kinderpunsch.', exampleSentenceArabic: 'في سوق الشتاء يشرب كل الأطفال عصير البنش الدافئ.', missingLetterWord: 'K_nderpunsch', sentence4Elements: ['Kinderpunsch', 'duftet', 'nach', 'Orangen, Nelken und Zimt.'] },
      { id: 'b03_87_07', german: 'die Teekanne', arabic: 'إبريق الشاي (البراد)', article: 'die', plural: 'die Teekannen', emoji: '🫖', exampleSentenceGerman: 'In der Teekanne bleibt der Tee lange schön heiß.', exampleSentenceArabic: 'في إبريق الشاي يظل الشاي ساخناً لفترة طويلة.', missingLetterWord: 'die T_ekanne', sentence4Elements: ['Mama', 'stellt', 'die', 'Teekanne auf das Stövchen.'] },
      { id: 'b03_87_08', german: 'der Teebeutel', arabic: 'كيس الشاي (الفتلة)', article: 'der', plural: 'die Teebeutel', emoji: '🫖', exampleSentenceGerman: 'Ich hänge den Teebeutel für fünf Minuten in das heiße Wasser.', exampleSentenceArabic: 'أضع كيس الشاي في الماء الساخن لمدة خمس دقائق.', missingLetterWord: 'der T_ebeutel', sentence4Elements: ['Der', 'Teebeutel', 'färbt', 'das Wasser rot ein.'] },
      { id: 'b03_87_09', german: 'der Honiglöffel', arabic: 'ملعقة العسل الخشبية المضلعة', article: 'der', plural: 'die Honiglöffel', emoji: '🍯', exampleSentenceGerman: 'Mit dem runden Holzlöffel tropfe ich Honig in die Tasse.', exampleSentenceArabic: 'بملعقة العسل الخشبية أقطر العسل داخل الفنجان.', missingLetterWord: 'H_niglöffel', sentence4Elements: ['Der', 'Honig', 'fließt', 'goldbraun vom Löffel herab.'] },
      { id: 'b03_87_10', german: 'wärmen', arabic: 'يدفئ الجسم / يبعث الدفء', emoji: '🔥', exampleSentenceGerman: 'Der heiße Tee wärmt mich von den Zehen bis zur Nase.', exampleSentenceArabic: 'الشاي الساخن يدفئني من أصابع قدمي حتى أرنبة أنفي.', missingLetterWord: 'w_rmen', sentence4Elements: ['Warme', 'Getränke', 'wärmen', 'an kalten Wintertagen herrlich.'] }
    ]
  },

  // 88. Baking Ingredients & Dough (جريد 2 / جريد 3)
  {
    id: 'curric_b03_88_baking_ingredients',
    title: 'Zutaten in der Backstube',
    titleTranslations: { ar: 'مكونات الخبز وعجينة الحلويات', de: 'Zutaten in der Backstube', en: 'Baking Ingredients & Dough' },
    topic: 'مكونات الخبز',
    topicTranslations: { ar: 'مكونات الخبز', de: 'Backzutaten', en: 'Baking Ingredients' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الدقيق والخميرة والبيكنج باودر والزبدة والفانيليا.',
    descriptionTranslations: { ar: 'الدقيق والخميرة والبيكنج باودر والزبدة.', de: 'Mehl, Hefe, Backpulver, Zucker und Teig.', en: 'Flour, yeast, baking powder, sugar and dough.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_88_01', german: 'das Mehl', arabic: 'الدقيق (الطحين الأبيض)', article: 'das', plural: 'die Mehle', emoji: '🌾', exampleSentenceGerman: 'Wir wiegen dreihundert Gramm Mehl auf der Küchenwaage ab.', exampleSentenceArabic: 'نزن ثلاثمائة غرام من الدقيق على ميزان المطبخ.', missingLetterWord: 'das M_hl', sentence4Elements: ['Weißes', 'Mehl', 'staubt', 'lustig auf unsere Nasen.'] },
      { id: 'b03_88_02', german: 'die Hefe', arabic: 'الخميرة (لتخمير العجين)', article: 'die', plural: 'die Hefen', emoji: '🍞', exampleSentenceGerman: 'Mit der Hefe geht der Pizzateig wunderbar auf.', exampleSentenceArabic: 'مع الخميرة يرتفع عجين البيتزا بشكل رائع.', missingLetterWord: 'die H_fe', sentence4Elements: ['Die', 'Hefe', 'macht', 'den Teig locker und luftig.'] },
      { id: 'b03_88_03', german: 'das Backpulver', arabic: 'البيكنج باودر (خميرة الحلوى)', article: 'das', plural: 'die Backpulver', emoji: '🥣', exampleSentenceGerman: 'Ein Päckchen Backpulver lässt den Kuchen im Ofen wachsen.', exampleSentenceArabic: 'كيس بيكنج باودر يجعل الكعكة ترتفع في الفرن.', missingLetterWord: 'B_ckpulver', sentence4Elements: ['Backpulver', 'kommt', 'in', 'den süßen Rührteig hinein.'] },
      { id: 'b03_88_04', german: 'der Vanillezucker', arabic: 'سكر الفانيليا العطري', article: 'der', plural: 'die Vanillezucker', emoji: '✨', exampleSentenceGerman: 'Vanillezucker gibt den Plätzchen einen himmlischen Duft.', exampleSentenceArabic: 'سكر الفانيليا يمنح البسكويت رائحة زكية رائعة.', missingLetterWord: 'Van_llezucker', sentence4Elements: ['Ein', 'Päckchen', 'Vanillezucker', 'für den feinen Geschmack.'] },
      { id: 'b03_88_05', german: 'der Teig', arabic: 'العجين (عجينة الكعك أو الخبز)', article: 'der', plural: 'die Teige', emoji: '🥣', exampleSentenceGerman: 'Wir kneten den weichen Teig mit beiden Händen.', exampleSentenceArabic: 'نعجن العجينة الطرية بكلتا يدينا.', missingLetterWord: 'der T_ig', sentence4Elements: ['Der', 'Teig', 'muss', 'an einem warmen Ort ruhen.'] },
      { id: 'b03_88_06', german: 'das Nudelholz', arabic: 'النشابة (شوبك فرد العجين)', article: 'das', plural: 'die Nudelhölzer', emoji: '🪵', exampleSentenceGerman: 'Mit dem Nudelholz rollen wir den Teig gleichmäßig aus.', exampleSentenceArabic: 'بالنشابة نفرد العجين بالتساوي على الطاولة.', missingLetterWord: 'N_delholz', sentence4Elements: ['Das', 'Nudelholz', 'rollt', 'den Teig schön flach.'] },
      { id: 'b03_88_07', german: 'die Ausstechform', arabic: 'قالب تقطيع البسكويت (الأشكال)', article: 'die', plural: 'die Ausstechformen', emoji: '⭐', exampleSentenceGerman: 'Mit Ausstechformen stechen wir Sterne und Herzen aus.', exampleSentenceArabic: 'بقوالب التقطيع نشكل نجوماً وقلوباً من العجين.', missingLetterWord: '_usstechform', sentence4Elements: ['Wir', 'stechen', 'Sterne', 'aus dem ausgerollten Teig.'] },
      { id: 'b03_88_08', german: 'das Backblech', arabic: 'صينية الخبز للفرن (الصاج)', article: 'das', plural: 'die Backbleche', emoji: '🫓', exampleSentenceGerman: 'Wir legen Backpapier auf das flache Backblech.', exampleSentenceArabic: 'نفرش ورق الخبز فوق صينية الفرن المسطحة.', missingLetterWord: 'B_ckblech', sentence4Elements: ['Das', 'Backblech', 'wird', 'mit vielen Plätzchen voll.'] },
      { id: 'b03_88_09', german: 'der Puderzucker', arabic: 'السكر البودرة الأبيض للتزيين', article: 'der', plural: 'die Puderzucker', emoji: '❄️', exampleSentenceGerman: 'Durch ein feines Sieb rieselt weißer Puderzucker.', exampleSentenceArabic: 'عبر مصفاة ناعمة يتناثر سكر البودرة كالثلج.', missingLetterWord: 'P_derzucker', sentence4Elements: ['Puderzucker', 'sieht', 'wie', 'frischer Schnee auf Kuchen aus.'] },
      { id: 'b03_88_10', german: 'kneten', arabic: 'يعجن بقوة ونشاط باليدين', emoji: '🤲', exampleSentenceGerman: 'Kinder kneten den Teig mit großer Begeisterung.', exampleSentenceArabic: 'يعجن الأطفال العجين بحماس وشغف كبيرين.', missingLetterWord: 'kn_ten', sentence4Elements: ['Kräftig', 'kneten', 'macht', 'den Teig geschmeidig und weich.'] }
    ]
  },

  // 89. Supermarket Shopping & Cashier (جريد 2 / جريد 3)
  {
    id: 'curric_b03_89_supermarket_shopping',
    title: 'Im Supermarkt einkaufen',
    titleTranslations: { ar: 'التسوق في السوبرماركت', de: 'Im Supermarkt einkaufen', en: 'Supermarket Shopping' },
    topic: 'التسوق والشراء',
    topicTranslations: { ar: 'التسوق والشراء', de: 'Einkauf', en: 'Shopping' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'عربة التسوق والرفوف والخزينة والبائع والفاتورة.',
    descriptionTranslations: { ar: 'عربة التسوق والرفوف والخزينة.', de: 'Einkaufswagen, Kasse, Regal und Pfand.', en: 'Carts, cashier, shelves and deposits.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_89_01', german: 'der Supermarkt', arabic: 'السوبرماركت / المتجر الكبير', article: 'der', plural: 'die Supermärkte', emoji: '🛒', exampleSentenceGerman: 'Wir gehen heute in den großen Supermarkt einkaufen.', exampleSentenceArabic: 'نذهب اليوم للتسوق في السوبرماركت الكبير.', missingLetterWord: 'S_permarkt', sentence4Elements: ['Im', 'Supermarkt', 'gibt', 'es alles für den Haushalt.'] },
      { id: 'b03_89_02', german: 'der Einkaufswagen', arabic: 'عربة التسوق ذات العجلات', article: 'der', plural: 'die Einkaufswagen', emoji: '🛒', exampleSentenceGerman: 'Ich schiebe den Einkaufswagen stolz durch die Gänge.', exampleSentenceArabic: 'أدفع عربة التسوق بفخر عبر ممرات المتجر.', missingLetterWord: '_inkaufswagen', sentence4Elements: ['Eine', 'Münze', 'entriegelt', 'den praktischen Einkaufswagen vorne.'] },
      { id: 'b03_89_03', german: 'der Einkaufszettel', arabic: 'قائمة المشتريات الورقية', article: 'der', plural: 'die Einkaufszettel', emoji: '📝', exampleSentenceGerman: 'Mama hakt jeden gekauften Artikel auf dem Einkaufszettel ab.', exampleSentenceArabic: 'تشطب أمي كل غرض نشتريه من قائمة المشتريات.', missingLetterWord: '_inkaufszettel', sentence4Elements: ['Auf', 'dem', 'Zettel', 'stehen Äpfel, Brot und Milch.'] },
      { id: 'b03_89_04', german: 'das Regal', arabic: 'الرف في المتجر', article: 'das', plural: 'die Regale', emoji: '📦', exampleSentenceGerman: 'Im Regal stehen viele bunte Müslischachteln.', exampleSentenceArabic: 'على الرف تصطف علب الموسلي الملونة.', missingLetterWord: 'das R_gal', sentence4Elements: ['Die', 'Gläser', 'stehen', 'ordentlich sortiert im Regal.'] },
      { id: 'b03_89_05', german: 'die Kasse', arabic: 'الخزينة / الكاشير', article: 'die', plural: 'die Kassen', emoji: '🏧', exampleSentenceGerman: 'An der Kasse legen wir alle Waren auf das Band.', exampleSentenceArabic: 'عند الكاشير نضع كل البضائع على السير المتحرك.', missingLetterWord: 'die K_sse', sentence4Elements: ['An', 'der', 'Kasse', 'piept der Scanner schnell.'] },
      { id: 'b03_89_06', german: 'das Kassenband', arabic: 'السير المتحرك للكاشير', article: 'das', plural: 'die Kassenbänder', emoji: '🛒', exampleSentenceGerman: 'Das Kassenband rollt die Waren zur Kassiererin.', exampleSentenceArabic: 'السير المتحرك يدفع المشتريات نحو أمينة الصندوق.', missingLetterWord: 'K_ssenband', sentence4Elements: ['Ich', 'helfe', 'beim', 'Auflegen auf das Kassenband.'] },
      { id: 'b03_89_07', german: 'der Kassenbon', arabic: 'إيصال الشراء (الفاتورة)', article: 'der', plural: 'die Kassenbons', emoji: '🧾', exampleSentenceGerman: 'Auf dem Kassenbon steht der genaue Gesamtpreis.', exampleSentenceArabic: 'في إيصال الشراء يسجل السعر الإجمالي بدقة.', missingLetterWord: 'K_ssenbon', sentence4Elements: ['Die', 'Kassiererin', 'gibt', 'uns den langen Kassenbon.'] },
      { id: 'b03_89_08', german: 'die Einkaufstasche', arabic: 'حقيبة التسوق القماشية المعاد استخدامها', article: 'die', plural: 'die Einkaufstaschen', emoji: '🛍️', exampleSentenceGerman: 'Wir bringen eigene Stofftaschen zum Einkaufen mit.', exampleSentenceArabic: 'نحضر حقائبنا القماشية الخاصة للتسوق لحماية البيئة.', missingLetterWord: '_inkaufstasche', sentence4Elements: ['Eine', 'feste', 'Tasche', 'spart Plastikmüll beim Einkauf.'] },
      { id: 'b03_89_09', german: 'der Pfandautomat', arabic: 'ماكينة استرجاع الزجاجات والعلب الفارغة في ألمانيا', article: 'der', plural: 'die Pfandautomaten', emoji: '🤖', exampleSentenceGerman: 'Wir schieben leere Flaschen in den Pfandautomaten.', exampleSentenceArabic: 'ندخل الزجاجات الفارغة في ماكينة استرجاع الوديعة.', missingLetterWord: 'Pf_ndautomat', sentence4Elements: ['Der', 'Automat', 'druckt', 'einen Pfandbon mit Geldwert.'] },
      { id: 'b03_89_10', german: 'einkaufen', arabic: 'يتسوق / يشتري الأغراض (الفعل)', emoji: '🛍️', exampleSentenceGerman: 'Samstags kaufen wir für die ganze Woche ein.', exampleSentenceArabic: 'أيام السبت نتسوق احتياجات الأسبوع بأكمله.', missingLetterWord: '_inkaufen', sentence4Elements: ['Wir', 'kaufen', 'frische', 'Lebensmittel für das Wochenende ein.'] }
    ]
  },

  // 90. Healthy School Lunchbox (جريد 1 / جريد 2)
  {
    id: 'curric_b03_90_healthy_lunchbox',
    title: 'Die gesunde Pausenbox',
    titleTranslations: { ar: 'لانش بوكس المدرسة الصحي', de: 'Die gesunde Pausenbox', en: 'Healthy School Lunchbox' },
    topic: 'وجبة المدرسة',
    topicTranslations: { ar: 'وجبة المدرسة', de: 'Pausenbrot', en: 'School Lunch' },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'صندوق الطعام، شطيرة الجبن، شرائح التفاح، المكسرات والمطارة.',
    descriptionTranslations: { ar: 'صندوق الطعام، شطيرة الجبن، شرائح التفاح.', de: 'Brotdose, Trinkflasche, Apfelschnitz und Nüsse.', en: 'Lunchboxes, water bottles, apple slices and nuts.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b03_90_01', german: 'die Brotdose', arabic: 'علبة الشطائر (اللانش بوكس)', article: 'die', plural: 'die Brotdosen', emoji: '🍱', exampleSentenceGerman: 'Meine bunte Brotdose hat verschiedene Fächer für Obst.', exampleSentenceArabic: 'علبة طعامي الملونة بها أقسام مخصصة للفواكه.', missingLetterWord: 'die Br_tdose', sentence4Elements: ['In', 'der', 'Brotdose', 'liegt mein gesundes Frühstück.'] },
      { id: 'b03_90_02', german: 'die Trinkflasche', arabic: 'مطارة الماء المدرسية (الزمزمية)', article: 'die', plural: 'die Trinkflaschen', emoji: '🍶', exampleSentenceGerman: 'Ich fülle frisches Wasser in meine Trinkflasche.', exampleSentenceArabic: 'أملأ ماءً عذباً في مطارة مائي المدرسية.', missingLetterWord: 'Tr_nkflasche', sentence4Elements: ['Die', 'Trinkflasche', 'passt', 'perfekt in die Außentasche.'] },
      { id: 'b03_90_03', german: 'das Pausenbrot', arabic: 'شطيرة الفسحة المدرسية', article: 'das', plural: 'die Pausenbrote', emoji: '🥪', exampleSentenceGerman: 'In der großen Pause beiße ich mit Appetit ins Pausenbrot.', exampleSentenceArabic: 'في الاستراحة الكبرى أتناول شطيرتي المدرسية بشهية.', missingLetterWord: 'P_usenbrot', sentence4Elements: ['Ein', 'Vollkornbrot', 'mit', 'Käse macht lange fit.'] },
      { id: 'b03_90_04', german: 'die Apfelschnitze', arabic: 'شرائح التفاح المقطعة اللذيذة', article: 'die', plural: 'die Apfelschnitze', emoji: '🍎', exampleSentenceGerman: 'Mama schneidet den Apfel in mundgerechte Schnitze.', exampleSentenceArabic: 'تقطع أمي التفاحة إلى شرائح سهلة الأكل.', missingLetterWord: '_pfelschnitze', sentence4Elements: ['Knackige', 'Apfelschnitze', 'schmecken', 'herrlich frisch in der Pause.'] },
      { id: 'b03_90_05', german: 'die Gurkenscheiben', arabic: 'حلقات الخيار الطازجة', article: 'die', plural: 'die Gurkenscheiben', emoji: '🥒', exampleSentenceGerman: 'Grüne Gurkenscheiben erfrischen zwischendurch.', exampleSentenceArabic: 'حلقات الخيار الخضراء تنعش بين الحصص الدراسية.', missingLetterWord: 'G_rkenscheiben', sentence4Elements: ['Frische', 'Gurkenscheiben', 'passen', 'in jede Brotdose hinein.'] },
      { id: 'b03_90_06', german: 'die Cocktailtomate', arabic: 'طماطم الكرز الصغيرة (الشيري)', article: 'die', plural: 'die Cocktailtomaten', emoji: '🍅', exampleSentenceGerman: 'Süße Cocktailtomaten platzen saftig im Mund.', exampleSentenceArabic: 'طماطم الكرز الصغيرة تنفجر بالعصير الحلو في الفم.', missingLetterWord: 'C_cktailtomate', sentence4Elements: ['Kleine', 'Cocktailtomaten', 'sind', 'der perfekte Pausensnack.'] },
      { id: 'b03_90_07', german: 'der Müsliriegel', arabic: 'لوح حبوب الشوفان المقرمش (موسلي بار)', article: 'der', plural: 'die Müsliriegel', emoji: '🍫', exampleSentenceGerman: 'Ein zuckerarmer Müsliriegel gibt schnell neue Power.', exampleSentenceArabic: 'لوح الموسلي قليل السكر يعطي طاقة متجددة سريعاً.', missingLetterWord: 'M_sliriegel', sentence4Elements: ['Der', 'Müsliriegel', 'enthält', 'Haferflocken, Nüsse und Honig.'] },
      { id: 'b03_90_08', german: 'die Mandeln', arabic: 'حبات اللوز المقوية للتركيز', article: 'die', plural: 'die Mandeln', emoji: '🥜', exampleSentenceGerman: 'Ein paar Mandeln und Walnüsse helfen beim Denken.', exampleSentenceArabic: 'بضع حبات من اللوز وعين الجمل تساعد على التركيز.', missingLetterWord: 'die M_ndeln', sentence4Elements: ['Nüsse', 'und', 'Mandeln', 'sind gesundes Futter fürs Gehirn.'] },
      { id: 'b03_90_09', german: 'die Weintrauben', arabic: 'حبات العنب الخالية من البذور', article: 'die', plural: 'die Weintrauben', emoji: '🍇', exampleSentenceGerman: 'Süße Weintrauben ohne Kerne nasche ich gerne.', exampleSentenceArabic: 'أحب تناول حبات العنب الحلوة الخالية من البذور.', missingLetterWord: 'W_intrauben', sentence4Elements: ['Kernlose', 'Trauben', 'sind', 'herrlich süß und saftig.'] },
      { id: 'b03_90_10', german: 'die Pause', arabic: 'الاستراحة المدرسية / الفسحة', article: 'die', plural: 'die Pausen', emoji: '⏰', exampleSentenceGerman: 'Wenn die Schulglocke klingelt, beginnt die große Pause!', exampleSentenceArabic: 'عندما يدق جرس المدرسة، تبدأ الاستراحة الكبرى!', missingLetterWord: 'die P_use', sentence4Elements: ['In', 'der', 'Pause', 'spielen wir gemeinsam draußen.'] }
    ]
  }
];

