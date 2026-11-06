import { LernstudioSet } from '../../types/lernstudio';

export const BATCH_02_SETS: LernstudioSet[] = [
  // 31. Animals: Pets (روضة / جريد 1)
  {
    id: 'curric_b02_31_pets',
    title: 'Haustiere für Kinder',
    titleTranslations: { ar: 'الحيوانات الأليفة في المنزل', de: 'Haustiere für Kinder', en: 'Pets for Kids' },
    topic: 'الحيوانات والطيور',
    topicTranslations: { ar: 'الحيوانات والطيور', de: 'Tiere', en: 'Animals' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الحيوانات الأليفة المفضلة التي تعيش معنا في البيت.',
    descriptionTranslations: { ar: 'الحيوانات الأليفة المفضلة التي تعيش معنا في البيت.', de: 'Beliebte Haustiere für Kinder.', en: 'Popular pets living at home.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_31_01', german: 'der Hund', arabic: 'الكلب', article: 'der', plural: 'die Hunde', emoji: '🐕', exampleSentenceGerman: 'Der Hund bellt fröhlich im Garten.', exampleSentenceArabic: 'الكلب ينبح بمرح في الحديقة.', missingLetterWord: 'der H_nd', sentence4Elements: ['Der', 'Hund', 'spielt', 'mit dem Ball.'] },
      { id: 'b02_31_02', german: 'die Katze', arabic: 'القطة', article: 'die', plural: 'die Katzen', emoji: '🐈', exampleSentenceGerman: 'Die Katze schnurrt auf dem Sofa.', exampleSentenceArabic: 'القطة تخرخر على الأريكة.', missingLetterWord: 'die K_tze', sentence4Elements: ['Die', 'Katze', 'trinkt', 'frische Milch.'] },
      { id: 'b02_31_03', german: 'das Kaninchen', arabic: 'الأرنب', article: 'das', plural: 'die Kaninchen', emoji: '🐇', exampleSentenceGerman: 'Das Kaninchen knabbert eine Karotte.', exampleSentenceArabic: 'الأرنب يقضم جزرة.', missingLetterWord: 'das Kan_nchen', sentence4Elements: ['Das', 'Kaninchen', 'hüpft', 'durchs Gras.'] },
      { id: 'b02_31_04', german: 'der Hamster', arabic: 'الهامستر', article: 'der', plural: 'die Hamster', emoji: '🐹', exampleSentenceGerman: 'Der kleine Hamster läuft im Laufrad.', exampleSentenceArabic: 'الهامستر الصغير يركض في عجلة الركض.', missingLetterWord: 'der H_mster', sentence4Elements: ['Der', 'Hamster', 'schläft', 'im Häuschen.'] },
      { id: 'b02_31_05', german: 'der Vogel', arabic: 'العصفور / الطائر', article: 'der', plural: 'die Vögel', emoji: '🐦', exampleSentenceGerman: 'Der bunte Vogel singt ein schönes Lied.', exampleSentenceArabic: 'العصفور الملون يغني أغنية جميلة.', missingLetterWord: 'der V_gel', sentence4Elements: ['Der', 'Vogel', 'fliegt', 'in den Baum.'] },
      { id: 'b02_31_06', german: 'der Goldfisch', arabic: 'السمكة الذهبية', article: 'der', plural: 'die Goldfische', emoji: '🐠', exampleSentenceGerman: 'Der Goldfisch schwimmt im Aquarium.', exampleSentenceArabic: 'السمكة الذهبية تسبح في حوض السمك.', missingLetterWord: 'der G_ldfisch', sentence4Elements: ['Der', 'Fisch', 'schwimmt', 'im Glas.'] },
      { id: 'b02_31_07', german: 'die Schildkröte', arabic: 'السلحفاة', article: 'die', plural: 'die Schildkröten', emoji: '🐢', exampleSentenceGerman: 'Die Schildkröte frisst grünen Salat.', exampleSentenceArabic: 'السلحفاة تأكل الخس الأخضر.', missingLetterWord: 'die Sch_ldkröte', sentence4Elements: ['Die', 'Schildkröte', 'ist', 'sehr langsam.'] },
      { id: 'b02_31_08', german: 'das Meerschweinchen', arabic: 'خنزير غينيا (الوبر)', article: 'das', plural: 'die Meerschweinchen', emoji: '🐹', exampleSentenceGerman: 'Das Meerschweinchen pfeift leise vor Freude.', exampleSentenceArabic: 'خنزير غينيا يصفر بصوت خافت من الفرح.', missingLetterWord: 'das Meerschw_inchen', sentence4Elements: ['Zwei', 'Meerschweinchen', 'kuscheln', 'zusammen gern.'] },
      { id: 'b02_31_09', german: 'das Futter', arabic: 'طعام الحيوان / العلف', article: 'das', plural: 'die Futter', emoji: '🥣', exampleSentenceGerman: 'Ich gebe meiner Katze frisches Futter.', exampleSentenceArabic: 'أعطي قطتي طعاماً طازجاً.', missingLetterWord: 'das F_tter', sentence4Elements: ['Der', 'Hund', 'frisst', 'sein Futter.'] },
      { id: 'b02_31_10', german: 'streicheln', arabic: 'يداعب / يمسح بحنان على', emoji: '✋', exampleSentenceGerman: 'Kinder streicheln die weiche Katze gern.', exampleSentenceArabic: 'الأطفال يحبون مداعبة القطة الناعمة.', missingLetterWord: 'str_icheln', sentence4Elements: ['Ich', 'streichle', 'meinen', 'lieben Hund.'] }
    ]
  },

  // 32. Animals: Farm Animals (روضة / جريد 1)
  {
    id: 'curric_b02_32_farm_animals',
    title: 'Tiere auf dem Bauernhof',
    titleTranslations: { ar: 'حيوانات المزرعة', de: 'Tiere auf dem Bauernhof', en: 'Farm Animals' },
    topic: 'حيوانات المزرعة',
    topicTranslations: { ar: 'حيوانات المزرعة', de: 'Bauernhoftiere', en: 'Farm Animals' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الحيوانات التي نراها ونربيها في المزرعة والريف.',
    descriptionTranslations: { ar: 'الحيوانات التي نراها ونربيها في المزرعة والريف.', de: 'Kuh, Pferd und Schwein auf dem Hof.', en: 'Cows, horses and pigs on the farm.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_32_01', german: 'die Kuh', arabic: 'البقرة', article: 'die', plural: 'die Kühe', emoji: '🐄', exampleSentenceGerman: 'Die Kuh gibt uns gesunde Milch.', exampleSentenceArabic: 'البقرة تعطينا حليباً صحياً.', missingLetterWord: 'die K_h', sentence4Elements: ['Die', 'Kuh', 'frisst', 'grünes Gras.'] },
      { id: 'b02_32_02', german: 'das Pferd', arabic: 'الحصان', article: 'das', plural: 'die Pferde', emoji: '🐎', exampleSentenceGerman: 'Das Pferd galoppiert über die Koppel.', exampleSentenceArabic: 'الحصان يعدو في المرعى.', missingLetterWord: 'das Pf_rd', sentence4Elements: ['Das', 'Pferd', 'ist', 'stark und schnell.'] },
      { id: 'b02_32_03', german: 'das Schaf', arabic: 'الخروف / النعجة', article: 'das', plural: 'die Schafe', emoji: '🐑', exampleSentenceGerman: 'Das Schaf hat weiche weiße Wolle.', exampleSentenceArabic: 'الخروف لديه صوف أبيض ناعم.', missingLetterWord: 'das Sch_f', sentence4Elements: ['Das', 'Schaf', 'steht', 'auf der Weide.'] },
      { id: 'b02_32_04', german: 'die Ziege', arabic: 'العنزة / الماعز', article: 'die', plural: 'die Ziegen', emoji: '🐐', exampleSentenceGerman: 'Die Ziege klettert geschickt auf den Hügel.', exampleSentenceArabic: 'العنزة تتسلق التل بمهارة.', missingLetterWord: 'die Z_ege', sentence4Elements: ['Die', 'Ziege', 'hat', 'zwei Hörner.'] },
      { id: 'b02_32_05', german: 'das Schwein', arabic: 'الخنزير', article: 'das', plural: 'die Schweine', emoji: '🐖', exampleSentenceGerman: 'Das Schwein schläft gemütlich im Stroh.', exampleSentenceArabic: 'الخنزير ينام بارتياح في القش.', missingLetterWord: 'das Schw_in', sentence4Elements: ['Das', 'Schwein', 'ist', 'rosa gefärbt.'] },
      { id: 'b02_32_06', german: 'das Huhn', arabic: 'الدجاجة', article: 'das', plural: 'die Hühner', emoji: '🐔', exampleSentenceGerman: 'Das Huhn legt jeden Morgen ein Ei.', exampleSentenceArabic: 'الدجاجة تضع بيضة كل صباح.', missingLetterWord: 'das H_hn', sentence4Elements: ['Das', 'Huhn', 'pickt', 'Körner auf.'] },
      { id: 'b02_32_07', german: 'der Hahn', arabic: 'الديك', article: 'der', plural: 'die Hähne', emoji: '🐓', exampleSentenceGerman: 'Der Hahn kräht früh am Morgen.', exampleSentenceArabic: 'الديك يصيح في الصباح الباكر.', missingLetterWord: 'der H_hn', sentence4Elements: ['Der', 'Hahn', 'weckt', 'den ganzen Hof.'] },
      { id: 'b02_32_08', german: 'die Ente', arabic: 'البطة', article: 'die', plural: 'die Enten', emoji: '🦆', exampleSentenceGerman: 'Die Ente schwimmt auf dem Dorfteich.', exampleSentenceArabic: 'البطة تسبح في بركة القرية.', missingLetterWord: 'die _nte', sentence4Elements: ['Die', 'Ente', 'taucht', 'nach Futter.'] },
      { id: 'b02_32_09', german: 'die Gans', arabic: 'الإوزة', article: 'die', plural: 'die Gänse', emoji: '🪿', exampleSentenceGerman: 'Die weiße Gans schnattert laut.', exampleSentenceArabic: 'الإوزة البيضاء تقوقئ بصوت عالٍ.', missingLetterWord: 'die G_ns', sentence4Elements: ['Die', 'Gans', 'watschelt', 'über die Wiese.'] },
      { id: 'b02_32_10', german: 'der Esel', arabic: 'الحمار', article: 'der', plural: 'die Esel', emoji: '🫏', exampleSentenceGerman: 'Der graue Esel hat lange Ohren.', exampleSentenceArabic: 'الحمار الرمادي له أذنان طويلتان.', missingLetterWord: 'der _sel', sentence4Elements: ['Der', 'Esel', 'trägt', 'die schwere Last.'] }
    ]
  },

  // 33. Animals: Wild Animals in the Zoo (جريد 1 / جريد 2)
  {
    id: 'curric_b02_33_zoo_wild_animals',
    title: 'Wilde Tiere im Zoo',
    titleTranslations: { ar: 'الحيوانات البرية في حديقة الحيوان', de: 'Wilde Tiere im Zoo', en: 'Wild Animals in the Zoo' },
    topic: 'الحيوانات البرية',
    topicTranslations: { ar: 'الحيوانات البرية', de: 'Wildtiere', en: 'Wild Animals' },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الحيوانات المفترسة والضخمة التي نشاهدها في حديقة الحيوان.',
    descriptionTranslations: { ar: 'الحيوانات المفترسة والضخمة التي نشاهدها في حديقة الحيوان.', de: 'Löwe, Tiger und Elefant im Zoo.', en: 'Lions, tigers and elephants in the zoo.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_33_01', german: 'der Löwe', arabic: 'الأسد', article: 'der', plural: 'die Löwen', emoji: '🦁', exampleSentenceGerman: 'Der Löwe ist der König der Tiere.', exampleSentenceArabic: 'الأسد هو ملك الحيوانات.', missingLetterWord: 'der L_we', sentence4Elements: ['Der', 'Löwe', 'brüllt', 'sehr laut.'] },
      { id: 'b02_33_02', german: 'der Tiger', arabic: 'النمر', article: 'der', plural: 'die Tiger', emoji: '🐅', exampleSentenceGerman: 'Der Tiger hat orange Streifen.', exampleSentenceArabic: 'النمر لديه خطوط برتقالية.', missingLetterWord: 'der T_ger', sentence4Elements: ['Der', 'Tiger', 'schleicht', 'durchs Gras.'] },
      { id: 'b02_33_03', german: 'der Elefant', arabic: 'الفيل', article: 'der', plural: 'die Elefanten', emoji: '🐘', exampleSentenceGerman: 'Der Elefant hat einen langen Rüssel.', exampleSentenceArabic: 'الفيل له خرطوم طويل.', missingLetterWord: 'der El_fant', sentence4Elements: ['Der', 'Elefant', 'ist', 'riesig groß.'] },
      { id: 'b02_33_04', german: 'die Giraffe', arabic: 'الزرافة', article: 'die', plural: 'die Giraffen', emoji: '🦒', exampleSentenceGerman: 'Die Giraffe hat einen sehr langen Hals.', exampleSentenceArabic: 'الزرافة لها رقبة طويلة جداً.', missingLetterWord: 'die Gir_ffe', sentence4Elements: ['Die', 'Giraffe', 'frisst', 'hohe Blätter.'] },
      { id: 'b02_33_05', german: 'das Zebra', arabic: 'الحمار الوحشي', article: 'das', plural: 'die Zebras', emoji: '🦓', exampleSentenceGerman: 'Das Zebra hat schwarz-weiße Streifen.', exampleSentenceArabic: 'الحمار الوحشي له خطوط بيضاء وسوداء.', missingLetterWord: 'das Z_bra', sentence4Elements: ['Das', 'Zebra', 'rennt', 'sehr schnell.'] },
      { id: 'b02_33_06', german: 'der Affe', arabic: 'القرد', article: 'der', plural: 'die Affen', emoji: '🐒', exampleSentenceGerman: 'Der Affe klettert fröhlich auf Bäume.', exampleSentenceArabic: 'القرد يتسلق الأشجار بمرح.', missingLetterWord: 'der _ffe', sentence4Elements: ['Der', 'Affe', 'isst', 'eine Banane.'] },
      { id: 'b02_33_07', german: 'das Krokodil', arabic: 'التمساح', article: 'das', plural: 'die Krokodile', emoji: '🐊', exampleSentenceGerman: 'Das Krokodil schwimmt lautlos im Fluss.', exampleSentenceArabic: 'التمساح يسبح بلا صوت في النهر.', missingLetterWord: 'das Krok_dil', sentence4Elements: ['Das', 'Krokodil', 'hat', 'scharfe Zähne.'] },
      { id: 'b02_33_08', german: 'das Flusspferd', arabic: 'فرس النهر (سيد قشطة)', article: 'das', plural: 'die Flusspferde', emoji: '🦛', exampleSentenceGerman: 'Das Flusspferd badet den ganzen Tag im Wasser.', exampleSentenceArabic: 'فرس النهر يستحم طوال اليوم في الماء.', missingLetterWord: 'das Fl_sspferd', sentence4Elements: ['Das', 'Flusspferd', 'ist', 'sehr schwer.'] },
      { id: 'b02_33_09', german: 'das Nashorn', arabic: 'وحيد القرن', article: 'das', plural: 'die Nashörner', emoji: '🦏', exampleSentenceGerman: 'Das Nashorn hat ein Horn auf der Nase.', exampleSentenceArabic: 'وحيد القرن له قرن على أنفه.', missingLetterWord: 'das N_shorn', sentence4Elements: ['Das', 'Nashorn', 'lebt', 'in Afrika.'] },
      { id: 'b02_33_10', german: 'das Känguru', arabic: 'الكنغر', article: 'das', plural: 'die Kängurus', emoji: '🦘', exampleSentenceGerman: 'Das Känguru trägt sein Baby im Beutel.', exampleSentenceArabic: 'الكنغر يحمل صغيره في جرابه.', missingLetterWord: 'das K_nguru', sentence4Elements: ['Das', 'Känguru', 'springt', 'sehr weit.'] }
    ]
  },

  // 34. Animals: Forest Animals in Europe (جريد 2 / جريد 3)
  {
    id: 'curric_b02_34_forest_animals',
    title: 'Tiere im Wald',
    titleTranslations: { ar: 'حيوانات الغابة الأوروبية', de: 'Tiere im Wald', en: 'Forest Animals' },
    topic: 'حيوانات الغابة',
    topicTranslations: { ar: 'حيوانات الغابة', de: 'Waldtiere', en: 'Forest Animals' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الحيوانات التي تعيش في غابات ألمانيا وأوروبا.',
    descriptionTranslations: { ar: 'الحيوانات التي تعيش في غابات ألمانيا وأوروبا.', de: 'Fuchs, Bär und Reh im heimischen Wald.', en: 'Fox, bear and deer in European forests.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_34_01', german: 'der Fuchs', arabic: 'الثعلب', article: 'der', plural: 'die Füchse', emoji: '🦊', exampleSentenceGerman: 'Der schlaue Fuchs hat einen buschigen Schwanz.', exampleSentenceArabic: 'الثعلب الماكر له ذيل كثيف الفراء.', missingLetterWord: 'der F_chs', sentence4Elements: ['Der', 'Fuchs', 'ist', 'sehr schlau.'] },
      { id: 'b02_34_02', german: 'der Bär', arabic: 'الدب', article: 'der', plural: 'die Bären', emoji: '🐻', exampleSentenceGerman: 'Der braune Bär liebt süßen Honig.', exampleSentenceArabic: 'الدب البني يحب العسل الحلو.', missingLetterWord: 'der B_r', sentence4Elements: ['Der', 'Bär', 'schläft', 'im Winter.'] },
      { id: 'b02_34_03', german: 'der Wolf', arabic: 'الذئب', article: 'der', plural: 'die Wölfe', emoji: '🐺', exampleSentenceGerman: 'Der Wolf heult nachts den Mond an.', exampleSentenceArabic: 'الذئب يعوي ليلاً نحو القمر.', missingLetterWord: 'der W_lf', sentence4Elements: ['Der', 'Wolf', 'lebt', 'im Rudel.'] },
      { id: 'b02_34_04', german: 'das Reh', arabic: 'الظبي / الغزال', article: 'das', plural: 'die Rehe', emoji: '🦌', exampleSentenceGerman: 'Das scheue Reh steht am Waldrand.', exampleSentenceArabic: 'الظبي الخجول يقف عند حافة الغابة.', missingLetterWord: 'das R_h', sentence4Elements: ['Das', 'Reh', 'frisst', 'zarte Knospen.'] },
      { id: 'b02_34_05', german: 'das Eichhörnchen', arabic: 'السنجاب', article: 'das', plural: 'die Eichhörnchen', emoji: '🐿️', exampleSentenceGerman: 'Das Eichhörnchen sammelt Nüsse für den Winter.', exampleSentenceArabic: 'السنجاب يجمع المكسرات لفصل الشتاء.', missingLetterWord: 'das _ichhörnchen', sentence4Elements: ['Das', 'Eichhörnchen', 'klettert', 'flink hoch.'] },
      { id: 'b02_34_06', german: 'der Igel', arabic: 'القنفذ', article: 'der', plural: 'die Igel', emoji: '🦔', exampleSentenceGerman: 'Der kleine Igel hat viele spitze Stacheln.', exampleSentenceArabic: 'القنفذ الصغير له أشواك مدببة كثيرة.', missingLetterWord: 'der _gel', sentence4Elements: ['Der', 'Igel', 'rollt', 'sich ein.'] },
      { id: 'b02_34_07', german: 'die Eule', arabic: 'البومة', article: 'die', plural: 'die Eulen', emoji: '🦉', exampleSentenceGerman: 'Die kluge Eule wacht in der Nacht.', exampleSentenceArabic: 'البومة الحكيمة تسهر طوال الليل.', missingLetterWord: 'die _ule', sentence4Elements: ['Die', 'Eule', 'sieht', 'im Dunkeln gut.'] },
      { id: 'b02_34_08', german: 'das Wildschwein', arabic: 'الخنزير البري', article: 'das', plural: 'die Wildschweine', emoji: '🐗', exampleSentenceGerman: 'Das Wildschwein wühlt im Waldboden.', exampleSentenceArabic: 'الخنزير البري يحفر في أرضية الغابة.', missingLetterWord: 'das W_ldschwein', sentence4Elements: ['Das', 'Wildschwein', 'sucht', 'nach Eicheln.'] },
      { id: 'b02_34_09', german: 'der Dachs', arabic: 'الغرير (حيوان)', article: 'der', plural: 'die Dachse', emoji: '🦡', exampleSentenceGerman: 'Der Dachs gräbt einen tiefen Bau.', exampleSentenceArabic: 'الغرير يحفر جحراً عميقاً.', missingLetterWord: 'der D_chs', sentence4Elements: ['Der', 'Dachs', 'schläft', 'im Bau.'] },
      { id: 'b02_34_10', german: 'der Hase', arabic: 'الأرنب البري', article: 'der', plural: 'die Hasen', emoji: '🐇', exampleSentenceGerman: 'Der Feldhase hat lange Löffel-Ohren.', exampleSentenceArabic: 'الأرنب البري له أذنان طويلتان.', missingLetterWord: 'der H_se', sentence4Elements: ['Der', 'Hase', 'hoppelt', 'über das Feld.'] }
    ]
  },

  // 35. Animals: Ocean & Marine Life (جريد 2 / جريد 3)
  {
    id: 'curric_b02_35_sea_animals',
    title: 'Tiere im Meer',
    titleTranslations: { ar: 'حيوانات المحيط وعالم البحار', de: 'Tiere im Meer', en: 'Sea Animals' },
    topic: 'عالم البحار',
    topicTranslations: { ar: 'عالم البحار', de: 'Meereswelt', en: 'Ocean Life' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الكائنات البحرية والأسماك التي تعيش في المحيط.',
    descriptionTranslations: { ar: 'الكائنات البحرية والأسماك التي تعيش في المحيط.', de: 'Wal, Delfin und Hai im blauen Ozean.', en: 'Whales, dolphins and sharks in the ocean.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_35_01', german: 'der Wal', arabic: 'الحوت', article: 'der', plural: 'die Wale', emoji: '🐋', exampleSentenceGerman: 'Der Blauwal ist das größte Tier der Welt.', exampleSentenceArabic: 'الحوت الأزرق هو أضخم حيوان في العالم.', missingLetterWord: 'der W_l', sentence4Elements: ['Der', 'Wal', 'taucht', 'tief hinab.'] },
      { id: 'b02_35_02', german: 'der Delfin', arabic: 'الدلفين', article: 'der', plural: 'die Delfine', emoji: '🐬', exampleSentenceGerman: 'Der freundliche Delfin springt aus dem Wasser.', exampleSentenceArabic: 'الدلفين الودود يقفز من الماء.', missingLetterWord: 'der D_lfin', sentence4Elements: ['Der', 'Delfin', 'ist', 'sehr verspielt.'] },
      { id: 'b02_35_03', german: 'der Hai', arabic: 'سمكة القرش', article: 'der', plural: 'die Haie', emoji: '🦈', exampleSentenceGerman: 'Der weiße Hai hat viele scharfe Zähne.', exampleSentenceArabic: 'القرش الأبيض لديه أسنان حادة كثيرة.', missingLetterWord: 'der H_i', sentence4Elements: ['Der', 'Hai', 'schwimmt', 'sehr schnell.'] },
      { id: 'b02_35_04', german: 'der Tintenfisch', arabic: 'الأخطبوط / الحبار', article: 'der', plural: 'die Tintenfische', emoji: '🐙', exampleSentenceGerman: 'Der Tintenfisch hat acht lange Arme.', exampleSentenceArabic: 'الأخطبوط له ثمانية أذرع طويلة.', missingLetterWord: 'der T_ntenfisch', sentence4Elements: ['Der', 'Tintenfisch', 'spritzt', 'schwarze Tinte.'] },
      { id: 'b02_35_05', german: 'die Krabbe', arabic: 'السلطعون (الكابوريا)', article: 'die', plural: 'die Krabben', emoji: '🦀', exampleSentenceGerman: 'Die kleine Krabbe krabbelt seitwärts am Strand.', exampleSentenceArabic: 'السلطعون الصغير يزحف جانبياً على الشاطئ.', missingLetterWord: 'die Kr_bbe', sentence4Elements: ['Die', 'Krabbe', 'hat', 'zwei Scheren.'] },
      { id: 'b02_35_06', german: 'der Seestern', arabic: 'نجم البحر', article: 'der', plural: 'die Seesterne', emoji: '⭐', exampleSentenceGerman: 'Der rote Seestern ruht auf dem Meeresboden.', exampleSentenceArabic: 'نجم البحر الأحمر يستريح على قاع البحر.', missingLetterWord: 'der S_estern', sentence4Elements: ['Der', 'Seestern', 'liegt', 'im Sand.'] },
      { id: 'b02_35_07', german: 'die Qualle', arabic: 'قنديل البحر', article: 'die', plural: 'die Quallen', emoji: '🪼', exampleSentenceGerman: 'Die durchsichtige Qualle treibt im Meer.', exampleSentenceArabic: 'قنديل البحر الشفاف يطفو في البحر.', missingLetterWord: 'die Qu_lle', sentence4Elements: ['Die', 'Qualle', 'leuchtet', 'im Wasser.'] },
      { id: 'b02_35_08', german: 'das Seepferdchen', arabic: 'فرس البحر (حصان البحر)', article: 'das', plural: 'die Seepferdchen', emoji: '🫧', exampleSentenceGerman: 'Das Seepferdchen schwimmt aufrecht.', exampleSentenceArabic: 'فرس البحر يسبح بوضعية قائمة.', missingLetterWord: 'das S_epferdchen', sentence4Elements: ['Das', 'Seepferdchen', 'hält', 'sich fest.'] },
      { id: 'b02_35_09', german: 'die Robbe', arabic: 'الفقمة (عجل البحر)', article: 'die', plural: 'die Robben', emoji: '🦭', exampleSentenceGerman: 'Die Robbe sonnt sich auf der Sandbank.', exampleSentenceArabic: 'الفقمة تتشمس على التل الرملي.', missingLetterWord: 'die R_bbe', sentence4Elements: ['Die', 'Robbe', 'klatscht', 'mit den Flossen.'] },
      { id: 'b02_35_10', german: 'die Muschel', arabic: 'الصدفة / المحارة', article: 'die', plural: 'die Muscheln', emoji: '🐚', exampleSentenceGerman: 'Am Strand sammle ich bunte Muscheln.', exampleSentenceArabic: 'على الشاطئ أجمع أصدافاً ملونة.', missingLetterWord: 'die M_schel', sentence4Elements: ['Die', 'Muschel', 'liegt', 'am Ufer.'] }
    ]
  },

  // 36. Animals: Birds & Feathered Friends (جريد 2 / جريد 3)
  {
    id: 'curric_b02_36_birds',
    title: 'Vögel in der Luft',
    titleTranslations: { ar: 'الطيور في السماء', de: 'Vögel in der Luft', en: 'Birds in the Sky' },
    topic: 'الطيور والجو',
    topicTranslations: { ar: 'الطيور والجو', de: 'Vogelwelt', en: 'Birds' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الطيور المحلقة والعصافير المغردة والبطريق.',
    descriptionTranslations: { ar: 'الطيور المحلقة والعصافير المغردة والبطريق.', de: 'Adler, Spatz und Pinguin.', en: 'Eagles, sparrows and penguins.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_36_01', german: 'der Adler', arabic: 'النسر / العقاب', article: 'der', plural: 'die Adler', emoji: '🦅', exampleSentenceGerman: 'Der stolze Adler kreist hoch über den Bergen.', exampleSentenceArabic: 'العقاب الفخور يحلق عالياً فوق الجبال.', missingLetterWord: 'der _dler', sentence4Elements: ['Der', 'Adler', 'fliegt', 'sehr hoch.'] },
      { id: 'b02_36_02', german: 'der Spatz', arabic: 'الدوري (عصفور الدوري)', article: 'der', plural: 'die Spatzen', emoji: '🐦', exampleSentenceGerman: 'Der freche Spatz pickt Brotkrümel auf.', exampleSentenceArabic: 'عصفور الدوري الجريء يلتقط فتات الخبز.', missingLetterWord: 'der Sp_tz', sentence4Elements: ['Der', 'Spatz', 'zwitschert', 'im Busch.'] },
      { id: 'b02_36_03', german: 'die Taube', arabic: 'الحمامة', article: 'die', plural: 'die Tauben', emoji: '🕊️', exampleSentenceGerman: 'Die weiße Taube ist ein Symbol für Frieden.', exampleSentenceArabic: 'الحمامة البيضاء رمز للسلام.', missingLetterWord: 'die T_ube', sentence4Elements: ['Die', 'Taube', 'sitzt', 'auf dem Dach.'] },
      { id: 'b02_36_04', german: 'der Schwan', arabic: 'البجعة', article: 'der', plural: 'die Schwäne', emoji: '🦢', exampleSentenceGerman: 'Der weiße Schwan gleitet elegant über den See.', exampleSentenceArabic: 'البجعة البيضاء تنساب بأناقة فوق البحيرة.', missingLetterWord: 'der Schw_n', sentence4Elements: ['Der', 'Schwan', 'hat', 'weiße Federn.'] },
      { id: 'b02_36_05', german: 'der Papagei', arabic: 'الببغاء', article: 'der', plural: 'die Papageien', emoji: '🦜', exampleSentenceGerman: 'Der bunte Papagei kann Wörter nachsprechen.', exampleSentenceArabic: 'الببغاء الملون يمكنه تكرار الكلمات.', missingLetterWord: 'der Papag_i', sentence4Elements: ['Der', 'Papagei', 'spricht', 'unsere Wörter.'] },
      { id: 'b02_36_06', german: 'der Pinguin', arabic: 'البطريق', article: 'der', plural: 'die Pinguine', emoji: '🐧', exampleSentenceGerman: 'Der Pinguin watschelt über das kalte Eis.', exampleSentenceArabic: 'البطريق يتهادى فوق الجليد البارد.', missingLetterWord: 'der P_nguin', sentence4Elements: ['Der', 'Pinguin', 'kann', 'super schwimmen.'] },
      { id: 'b02_36_07', german: 'der Storch', arabic: 'اللقلق', article: 'der', plural: 'die Störche', emoji: '🪶', exampleSentenceGerman: 'Der Storch baut sein Nest auf dem Schornstein.', exampleSentenceArabic: 'اللقلق يبني عشه فوق المدخنة.', missingLetterWord: 'der St_rch', sentence4Elements: ['Der', 'Storch', 'hat', 'lange Beine.'] },
      { id: 'b02_36_08', german: 'die Krähe', arabic: 'الغراب', article: 'die', plural: 'die Krähen', emoji: '🐦‍⬛', exampleSentenceGerman: 'Die schwarze Krähe krächzt auf dem Ast.', exampleSentenceArabic: 'الغراب الأسود ينعق على غصن الشجرة.', missingLetterWord: 'die Kr_he', sentence4Elements: ['Die', 'Krähe', 'ist', 'sehr schlau.'] },
      { id: 'b02_36_09', german: 'der Specht', arabic: 'نقار الخشب', article: 'der', plural: 'die Spechte', emoji: '🪵', exampleSentenceGerman: 'Der Specht klopft laut an den Baumstamm.', exampleSentenceArabic: 'نقار الخشب ينقر بصوت عالٍ على جذع الشجرة.', missingLetterWord: 'der Sp_cht', sentence4Elements: ['Der', 'Specht', 'klopft', 'am Baum.'] },
      { id: 'b02_36_10', german: 'der Flamingo', arabic: 'النحام (الفلامنجو)', article: 'der', plural: 'die Flamingos', emoji: '🦩', exampleSentenceGerman: 'Der rosa Flamingo steht auf einem Bein.', exampleSentenceArabic: 'طائر الفلامنجو الوردي يقف على ساق واحدة.', missingLetterWord: 'der Flam_ngo', sentence4Elements: ['Der', 'Flamingo', 'ist', 'wunderschön rosa.'] }
    ]
  },

  // 37. Animals: Insects & Creepy Crawlies (جريد 2 / جريد 3)
  {
    id: 'curric_b02_37_insects',
    title: 'Insekten und Krabbeltiere',
    titleTranslations: { ar: 'الحشرات والكائنات الصغيرة', de: 'Insekten und Krabbeltiere', en: 'Insects and Little Crawlers' },
    topic: 'الحشرات والحديقة',
    topicTranslations: { ar: 'الحشرات والحديقة', de: 'Insektenwelt', en: 'Insects' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'النحلة والفراشة والنملة والدعسوقة للأطفال.',
    descriptionTranslations: { ar: 'النحلة والفراشة والنملة والدعسوقة للأطفال.', de: 'Biene, Schmetterling und Ameise.', en: 'Bees, butterflies and ants for kids.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_37_01', german: 'die Biene', arabic: 'النحلة', article: 'die', plural: 'die Bienen', emoji: '🐝', exampleSentenceGerman: 'Die fleißige Biene macht süßen Honig.', exampleSentenceArabic: 'النحلة النشيطة تصنع عسلاً حلواً.', missingLetterWord: 'die B_ene', sentence4Elements: ['Die', 'Biene', 'summt', 'von Blüte zu Blüte.'] },
      { id: 'b02_37_02', german: 'der Schmetterling', arabic: 'الفراشة', article: 'der', plural: 'die Schmetterlinge', emoji: '🦋', exampleSentenceGerman: 'Der Schmetterling hat wunderschöne bunte Flügel.', exampleSentenceArabic: 'الفراشة لديها أجنحة ملونة غاية في الجمال.', missingLetterWord: 'der Schm_tterling', sentence4Elements: ['Ein', 'bunter', 'Schmetterling', 'fliegt im Garten.'] },
      { id: 'b02_37_03', german: 'die Ameise', arabic: 'النملة', article: 'die', plural: 'die Ameisen', emoji: '🐜', exampleSentenceGerman: 'Die kleine Ameise trägt ein schweres Blatt.', exampleSentenceArabic: 'النملة الصغيرة تحمل ورقة شجر ثقيلة.', missingLetterWord: 'die Am_ise', sentence4Elements: ['Die', 'Ameise', 'ist', 'sehr fleißig.'] },
      { id: 'b02_37_04', german: 'der Marienkäfer', arabic: 'الدعسوقة (أم علي)', article: 'der', plural: 'die Marienkäfer', emoji: '🐞', exampleSentenceGerman: 'Der Marienkäfer bringt Glück.', exampleSentenceArabic: 'الدعسوقة تجلب الحظ السعيد.', missingLetterWord: 'der Mar_enkäfer', sentence4Elements: ['Der', 'Marienkäfer', 'hat', 'sieben Punkte.'] },
      { id: 'b02_37_05', german: 'die Spinne', arabic: 'العنكبوت', article: 'die', plural: 'die Spinnen', emoji: '🕷️', exampleSentenceGerman: 'Die Spinne webt ein feines Netz.', exampleSentenceArabic: 'العنكبوت ينسج شبكة دقيقة.', missingLetterWord: 'die Sp_nne', sentence4Elements: ['Die', 'Spinne', 'hat', 'acht Beine.'] },
      { id: 'b02_37_06', german: 'die Schnecke', arabic: 'الحلزون (القوقعة)', article: 'die', plural: 'die Schnecken', emoji: '🐌', exampleSentenceGerman: 'Die Schnecke trägt ihr Haus auf dem Rücken.', exampleSentenceArabic: 'الحلزون يحمل بيته على ظهره.', missingLetterWord: 'die Schn_cke', sentence4Elements: ['Die', 'Schnecke', 'kriecht', 'sehr langsam.'] },
      { id: 'b02_37_07', german: 'die Mücke', arabic: 'البعوضة (الناموسة)', article: 'die', plural: 'die Mücken', emoji: '🦟', exampleSentenceGerman: 'Die Mücke sticht im Sommer.', exampleSentenceArabic: 'البعوضة تلدغ في الصيف.', missingLetterWord: 'die M_cke', sentence4Elements: ['Die', 'Mücke', 'summt', 'am Ohr.'] },
      { id: 'b02_37_08', german: 'die Fliege', arabic: 'الذبابة', article: 'die', plural: 'die Fliegen', emoji: '🪰', exampleSentenceGerman: 'Die Fliege schwirrt durch das Fenster.', exampleSentenceArabic: 'الذبابة تطن عبر النافذة.', missingLetterWord: 'die Fl_ege', sentence4Elements: ['Die', 'Fliege', 'sitzt', 'auf dem Tisch.'] },
      { id: 'b02_37_09', german: 'die Libelle', arabic: 'اليعسوب', article: 'die', plural: 'die Libellen', emoji: '🪰', exampleSentenceGerman: 'Die Libelle fliegt blitzschnell über das Wasser.', exampleSentenceArabic: 'اليعسوب يطير بسرعة خاطفة فوق الماء.', missingLetterWord: 'die L_belle', sentence4Elements: ['Die', 'Libelle', 'glänzt', 'in der Sonne.'] },
      { id: 'b02_37_10', german: 'der Grashüpfer', arabic: 'الجرادة (نطاط العشب)', article: 'der', plural: 'die Grashüpfer', emoji: '🦗', exampleSentenceGerman: 'Der Grashüpfer springt hoch ins Gras.', exampleSentenceArabic: 'نطاط العشب يقفز عالياً بين الأعشاب.', missingLetterWord: 'der Gr_shüpfer', sentence4Elements: ['Der', 'Grashüpfer', 'macht', 'Musik im Feld.'] }
    ]
  },

  // 38. Animals: Reptiles & Amphibians (جريد 3 / جريد 4)
  {
    id: 'curric_b02_38_reptiles',
    title: 'Reptilien und Amphibien',
    titleTranslations: { ar: 'الزواحف والبرمائيات', de: 'Reptilien und Amphibien', en: 'Reptiles & Amphibians' },
    topic: 'الزواحف والبرمائيات',
    topicTranslations: { ar: 'الزواحف والبرمائيات', de: 'Kriechtiere', en: 'Reptiles' },
    grade: 'جريد 3',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الضفدع والثعبان والسلحفاة والتمساح والوزغة.',
    descriptionTranslations: { ar: 'الضفدع والثعبان والسلحفاة والتمساح والوزغة.', de: 'Frosch, Schlange und Echse.', en: 'Frogs, snakes and lizards.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_38_01', german: 'der Frosch', arabic: 'الضفدع', article: 'der', plural: 'die Frösche', emoji: '🐸', exampleSentenceGerman: 'Der grüne Frosch quakt am Teich.', exampleSentenceArabic: 'الضفدع الأخضر ينقّ عند البركة.', missingLetterWord: 'der Fr_sch', sentence4Elements: ['Der', 'Frosch', 'hüpft', 'ins kühle Wasser.'] },
      { id: 'b02_38_02', german: 'die Schlange', arabic: 'الثعبان / الحية', article: 'die', plural: 'die Schlangen', emoji: '🐍', exampleSentenceGerman: 'Die Schlange zischt leise im Gebüsch.', exampleSentenceArabic: 'الثعبان يفح بهدوء في الشجيرات.', missingLetterWord: 'die Schl_nge', sentence4Elements: ['Die', 'Schlange', 'kriecht', 'durch den Sand.'] },
      { id: 'b02_38_03', german: 'die Eidechse', arabic: 'السحلية', article: 'die', plural: 'die Eidechsen', emoji: '🦎', exampleSentenceGerman: 'Die Eidechse wärmt sich auf der Steinmauer.', exampleSentenceArabic: 'السحلية تدفئ نفسها فوق الجدار الحجري.', missingLetterWord: 'die _idechse', sentence4Elements: ['Die', 'Eidechse', 'huscht', 'über Steine.'] },
      { id: 'b02_38_04', german: 'das Chamäleon', arabic: 'الحرباء', article: 'das', plural: 'die Chamäleons', emoji: '🦎', exampleSentenceGerman: 'Das Chamäleon wechselt seine Farbe.', exampleSentenceArabic: 'الحرباء تغير لونها.', missingLetterWord: 'das Cham_leon', sentence4Elements: ['Das', 'Chamäleon', 'passt', 'seine Farbe an.'] },
      { id: 'b02_38_05', german: 'die Kröte', arabic: 'العلجوم (ضفدع الطين)', article: 'die', plural: 'die Kröten', emoji: '🐸', exampleSentenceGerman: 'Die Kröte wandert nachts über den Waldweg.', exampleSentenceArabic: 'العلجوم يتجول ليلاً عبر طريق الغابة.', missingLetterWord: 'die Kr_te', sentence4Elements: ['Die', 'Kröte', 'wandert', 'zum Wasser.'] },
      { id: 'b02_38_06', german: 'der Salamander', arabic: 'السمندل', article: 'der', plural: 'die Salamander', emoji: '🦎', exampleSentenceGerman: 'Der Feuersalamander ist schwarz und gelb gefleckt.', exampleSentenceArabic: 'سمندل النار مبقع باللونين الأسود والأصفر.', missingLetterWord: 'der Salam_nder', sentence4Elements: ['Der', 'Salamander', 'lebt', 'im feuchten Moos.'] },
      { id: 'b02_38_07', german: 'der Alligator', arabic: 'التمساح الأمريكي (القاطور)', article: 'der', plural: 'die Alligatoren', emoji: '🐊', exampleSentenceGerman: 'Der Alligator sonnt sich am Flussufer.', exampleSentenceArabic: 'القاطور يتشمس على ضفة النهر.', missingLetterWord: 'der All_gator', sentence4Elements: ['Der', 'Alligator', 'hat', 'ein breites Maul.'] },
      { id: 'b02_38_08', german: 'die Kaulquappe', arabic: 'الشرغوف (صغير الضفدع)', article: 'die', plural: 'die Kaulquappen', emoji: '🐟', exampleSentenceGerman: 'Aus der Kaulquappe wird ein kleiner Frosch.', exampleSentenceArabic: 'من الشرغوف ينمو ضفدع صغير.', missingLetterWord: 'die K_ulquappe', sentence4Elements: ['Die', 'Kaulquappe', 'schwimmt', 'im Teich.'] },
      { id: 'b02_38_09', german: 'die Schuppen', arabic: 'الحراشف (قشور الزواحف والأسماك)', article: 'die', plural: 'die Schuppen', emoji: '✨', exampleSentenceGerman: 'Die Schlange hat glatte Schuppen.', exampleSentenceArabic: 'الثعبان له حراشف ملساء.', missingLetterWord: 'die Sch_ppen', sentence4Elements: ['Schuppen', 'schützen', 'den', 'Körper der Echse.'] },
      { id: 'b02_38_10', german: 'der Panzer', arabic: 'الدرع / الصدفة الصلبة (للسلحفاة)', article: 'der', plural: 'die Panzer', emoji: '🛡️', exampleSentenceGerman: 'Der Panzer der Schildkröte ist hart wie Stein.', exampleSentenceArabic: 'درع السلحفاة صلب كالحجر.', missingLetterWord: 'der P_nzer', sentence4Elements: ['Der', 'harte', 'Panzer', 'schützt das Tier.'] }
    ]
  },

  // 39. Animals: Baby Animals (روضة / جريد 1)
  {
    id: 'curric_b02_39_baby_animals',
    title: 'Tierkinder und Tierbabys',
    titleTranslations: { ar: 'صغار الحيوانات والحيوانات الرضيعة', de: 'Tierkinder und Tierbabys', en: 'Baby Animals' },
    topic: 'صغار الحيوانات',
    topicTranslations: { ar: 'صغار الحيوانات', de: 'Tierbabys', en: 'Baby Animals' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'أسماء صغار الحيوانات اللطيفة مثل الجرو والهريرة والمهر.',
    descriptionTranslations: { ar: 'أسماء صغار الحيوانات اللطيفة مثل الجرو والهريرة والمهر.', de: 'Welpe, Kätzchen, Fohlen und Küken.', en: 'Puppies, kittens, foals and chicks.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_39_01', german: 'der Welpe', arabic: 'الجرو (صغير الكلب)', article: 'der', plural: 'die Welpen', emoji: '🐶', exampleSentenceGerman: 'Der kleine Welpe spielt mit dem Ball.', exampleSentenceArabic: 'الجرو الصغير يلعب بالكرة.', missingLetterWord: 'der W_lpe', sentence4Elements: ['Der', 'Welpe', 'ist', 'sehr verspielt.'] },
      { id: 'b02_39_02', german: 'das Kätzchen', arabic: 'الهريرة (صغيرة القطة)', article: 'das', plural: 'die Kätzchen', emoji: '🐱', exampleSentenceGerman: 'Das Kätzchen trinkt warme Milch.', exampleSentenceArabic: 'الهريرة تشرب حليباً دافئاً.', missingLetterWord: 'das K_tzchen', sentence4Elements: ['Das', 'Kätzchen', 'schnurrt', 'so leise.'] },
      { id: 'b02_39_03', german: 'das Fohlen', arabic: 'المهر (صغير الحصان)', article: 'das', plural: 'die Fohlen', emoji: '🐴', exampleSentenceGerman: 'Das junge Fohlen läuft neben seiner Mutter.', exampleSentenceArabic: 'المهر الصغير يركض بجوار أمه.', missingLetterWord: 'das F_hlen', sentence4Elements: ['Das', 'Fohlen', 'galoppiert', 'über die Wiese.'] },
      { id: 'b02_39_04', german: 'das Kalb', arabic: 'العجل (صغير البقرة)', article: 'das', plural: 'die Kälber', emoji: '🐮', exampleSentenceGerman: 'Das kleine Kalb steht auf wackeligen Beinen.', exampleSentenceArabic: 'العجل الصغير يقف على أرجل متأرجحة.', missingLetterWord: 'das K_lb', sentence4Elements: ['Das', 'Kalb', 'trinkt', 'bei der Kuh.'] },
      { id: 'b02_39_05', german: 'das Lamm', arabic: 'الحمل (صغير الخروف)', article: 'das', plural: 'die Lämmer', emoji: '🐑', exampleSentenceGerman: 'Das weiße Lamm springt fröhlich im Frühling.', exampleSentenceArabic: 'الحمل الأبيض يقفز بمرح في الربيع.', missingLetterWord: 'das L_mm', sentence4Elements: ['Das', 'Lamm', 'hat', 'weiches weißes Fell.'] },
      { id: 'b02_39_06', german: 'das Ferkel', arabic: 'الخنوص (صغير الخنزير)', article: 'das', plural: 'die Ferkel', emoji: '🐷', exampleSentenceGerman: 'Das rosa Ferkel quiekt vor Vergnügen.', exampleSentenceArabic: 'صغير الخنزير الوردي يصيح ببهجة.', missingLetterWord: 'das F_rkel', sentence4Elements: ['Das', 'Ferkel', 'spielt', 'im Stroh.'] },
      { id: 'b02_39_07', german: 'das Küken', arabic: 'الصوص / الكتكوت', article: 'das', plural: 'die Küken', emoji: '🐥', exampleSentenceGerman: 'Das gelbe Küken schlüpft aus dem Ei.', exampleSentenceArabic: 'الكتكوت الأصفر يفقس من البيضة.', missingLetterWord: 'das K_ken', sentence4Elements: ['Das', 'flauschige', 'Küken', 'piepst laut.'] },
      { id: 'b02_39_08', german: 'das Entenküken', arabic: 'فرخ البط', article: 'das', plural: 'die Entenküken', emoji: '🐤', exampleSentenceGerman: 'Das Entenküken schwimmt hinter Mama Ente.', exampleSentenceArabic: 'فرخ البط يسبح خلف أمه البطة.', missingLetterWord: 'das _ntenküken', sentence4Elements: ['Kleine', 'Entenküken', 'schwimmen', 'in einer Reihe.'] },
      { id: 'b02_39_09', german: 'das Rehkitze', arabic: 'خشف (صغير الغزال)', article: 'das', plural: 'die Rehkitze', emoji: '🦌', exampleSentenceGerman: 'Das Kitz versteckt sich im hohen Gras.', exampleSentenceArabic: 'صغير الغزال يختبئ في العشب الطويل.', missingLetterWord: 'das R_hkitz', sentence4Elements: ['Das', 'Kitz', 'hat', 'weiße Tupfen.'] },
      { id: 'b02_39_10', german: 'das Bärenjunge', arabic: 'ديسم (صغير الدب)', article: 'das', plural: 'die Bärenjungen', emoji: '🐻', exampleSentenceGerman: 'Das Bärenjunge klettert auf den Baum.', exampleSentenceArabic: 'صغير الدب يتسلق الشجرة.', missingLetterWord: 'das B_renjunge', sentence4Elements: ['Das', 'Bärenjunge', 'tollt', 'im Moos herum.'] }
    ]
  },

  // 40. Animal Sounds & Verbs (جريد 1 / جريد 2)
  {
    id: 'curric_b02_40_animal_sounds',
    title: 'Tiergeräusche und Laute',
    titleTranslations: { ar: 'أصوات الحيوانات في اللغة الألمانية', de: 'Tiergeräusche und Laute', en: 'Animal Sounds' },
    topic: 'أصوات الحيوانات',
    topicTranslations: { ar: 'أصوات الحيوانات', de: 'Tierlaute', en: 'Animal Sounds' },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'أفعال أصوات الحيوانات: ينبح، يموء، يخور، يزأر.',
    descriptionTranslations: { ar: 'أفعال أصوات الحيوانات: ينبح، يموء، يخور، يزأر.', de: 'Bellen, miauen, muhen und brüllen.', en: 'Barking, meowing, mooing and roaring.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_40_01', german: 'bellen', arabic: 'ينبح (للكلب)', emoji: '🐕', exampleSentenceGerman: 'Hunde bellen: Wuff, wuff!', exampleSentenceArabic: 'الكلاب تنبح: هوف، هوف!', missingLetterWord: 'b_llen', sentence4Elements: ['Der', 'Hund', 'bellt', 'vor dem Tor.'] },
      { id: 'b02_40_02', german: 'miauen', arabic: 'يموء (للقطة)', emoji: '🐈', exampleSentenceGerman: 'Katzen miauen: Miau, miau!', exampleSentenceArabic: 'القطط تموء: مياو، مياو!', missingLetterWord: 'mi_uen', sentence4Elements: ['Die', 'Katze', 'miaut', 'nach Milch.'] },
      { id: 'b02_40_03', german: 'muhen', arabic: 'يخور (للبقرة)', emoji: '🐄', exampleSentenceGerman: 'Die Kühe muhen: Muh, muh!', exampleSentenceArabic: 'الأبقار تخور: موه، موه!', missingLetterWord: 'm_hen', sentence4Elements: ['Die', 'Kuh', 'muht', 'auf der Weide.'] },
      { id: 'b02_40_04', german: 'wiehern', arabic: 'يصهل (للحصان)', emoji: '🐎', exampleSentenceGerman: 'Das Pferd wiehert laut vor Freude.', exampleSentenceArabic: 'الحصان يصهل بصوت عالٍ من الفرح.', missingLetterWord: 'wi_hern', sentence4Elements: ['Das', 'Pferd', 'wiehert', 'im Stall.'] },
      { id: 'b02_40_05', german: 'blöken', arabic: 'يثغو (للخروف والماعز)', emoji: '🐑', exampleSentenceGerman: 'Die Schafe blöken: Mäh, mäh!', exampleSentenceArabic: 'الخراف تثغو: ماع، ماع!', missingLetterWord: 'bl_ken', sentence4Elements: ['Die', 'Schafe', 'blöken', 'auf dem Hügel.'] },
      { id: 'b02_40_06', german: 'gackern', arabic: 'تقرق / تنقنق (للدجاجة)', emoji: '🐔', exampleSentenceGerman: 'Hühner gackern im Stall.', exampleSentenceArabic: 'الدجاجات تقرقر في القن.', missingLetterWord: 'g_ckern', sentence4Elements: ['Das', 'Huhn', 'gackert', 'nach dem Ei.'] },
      { id: 'b02_40_07', german: 'krähen', arabic: 'يصيح (للديك)', emoji: '🐓', exampleSentenceGerman: 'Der Hahn kräht: Kikeriki!', exampleSentenceArabic: 'الديك يصيح: كوكوريكو!', missingLetterWord: 'kr_hen', sentence4Elements: ['Der', 'Hahn', 'kräht', 'am Morgen früh.'] },
      { id: 'b02_40_08', german: 'quaken', arabic: 'ينقّ (للضفدع والبطة)', emoji: '🐸', exampleSentenceGerman: 'Frösche quaken am See: Quak, quak!', exampleSentenceArabic: 'الضفادع تنقّ عند البحيرة: قواق، قواق!', missingLetterWord: 'qu_ken', sentence4Elements: ['Die', 'Frösche', 'quaken', 'den ganzen Tag.'] },
      { id: 'b02_40_09', german: 'summen', arabic: 'يطنّ / يدندن (للنحلة)', emoji: '🐝', exampleSentenceGerman: 'Die Bienen summen: Summ, summ!', exampleSentenceArabic: 'النحل يطنّ: ززز، ززز!', missingLetterWord: 's_mmen', sentence4Elements: ['Bienen', 'summen', 'um', 'die Blumen.'] },
      { id: 'b02_40_10', german: 'brüllen', arabic: 'يزأر (للأسد والدب)', emoji: '🦁', exampleSentenceGerman: 'Der Löwe brüllt kräftig durch die Steppe.', exampleSentenceArabic: 'الأسد يزأر بقوة عبر السهوب.', missingLetterWord: 'br_llen', sentence4Elements: ['Der', 'große', 'Löwe', 'brüllt laut.'] }
    ]
  },

  // 41. Animals: Habitats & Homes (جريد 2 / جريد 3)
  {
    id: 'curric_b02_41_animal_habitats',
    title: 'Wo Tiere wohnen',
    titleTranslations: { ar: 'مساكن الحيوانات ومواطنها', de: 'Wo Tiere wohnen', en: 'Animal Homes' },
    topic: 'مساكن الحيوانات',
    topicTranslations: { ar: 'مساكن الحيوانات', de: 'Tierbehausungen', en: 'Animal Habitats' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'العش والجحر والقن والإسطبل والخلية.',
    descriptionTranslations: { ar: 'العش والجحر والقن والإسطبل والخلية.', de: 'Nest, Höhle, Stall und Bienenstock.', en: 'Nests, dens, stables and hives.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_41_01', german: 'das Nest', arabic: 'العش', article: 'das', plural: 'die Nester', emoji: '🪺', exampleSentenceGerman: 'Der Vogel legt Eier in das weiche Nest.', exampleSentenceArabic: 'الطائر يضع البيض في العش الناعم.', missingLetterWord: 'das N_st', sentence4Elements: ['Vögel', 'bauen', 'ein', 'gemütliches Nest.'] },
      { id: 'b02_41_02', german: 'die Höhle', arabic: 'الكهف / الوكر', article: 'die', plural: 'die Höhlen', emoji: '🕳️', exampleSentenceGerman: 'Der Bär schläft den Winter in der Höhle.', exampleSentenceArabic: 'الدب ينام طوال الشتاء في الكهف.', missingLetterWord: 'die H_hle', sentence4Elements: ['Der', 'Bär', 'wohnt', 'in der Berghöhle.'] },
      { id: 'b02_41_03', german: 'der Stall', arabic: 'الإسطبل / الحظيرة', article: 'der', plural: 'die Ställe', emoji: '🏚️', exampleSentenceGerman: 'Pferde und Kühe stehen warm im Stall.', exampleSentenceArabic: 'الخيول والأبقار تقف دافئة في الإسطبل.', missingLetterWord: 'der St_ll', sentence4Elements: ['Die', 'Tiere', 'schlafen', 'nachts im Stall.'] },
      { id: 'b02_41_04', german: 'der Bau', arabic: 'الجحر (جحر الثعلب أو الأرنب)', article: 'der', plural: 'die Baue', emoji: '🕳️', exampleSentenceGerman: 'Der Fuchs schlüpft in seinen tiefen Bau.', exampleSentenceArabic: 'الثعلب ينسل داخل جحره العميق.', missingLetterWord: 'der B_u', sentence4Elements: ['Der', 'Hase', 'gräbt', 'einen unterirdischen Bau.'] },
      { id: 'b02_41_05', german: 'der Bienenstock', arabic: 'خلية النحل', article: 'der', plural: 'die Bienenstöcke', emoji: '🐝', exampleSentenceGerman: 'Im Bienenstock machen Tausende Bienen Honig.', exampleSentenceArabic: 'في خلية النحل يصنع آلاف النحل العسل.', missingLetterWord: 'der B_enenstock', sentence4Elements: ['Im', 'Bienenstock', 'ist', 'es sehr warm.'] },
      { id: 'b02_41_06', german: 'das Aquarium', arabic: 'حوض أسماك الزينة', article: 'das', plural: 'die Aquarien', emoji: '🐟', exampleSentenceGerman: 'Bunte Fische schwimmen im sauberen Aquarium.', exampleSentenceArabic: 'الأسماك الملونة تسبح في حوض الأسماك النظيف.', missingLetterWord: 'das Aqu_rium', sentence4Elements: ['Das', 'Aquarium', 'steht', 'im Wohnzimmer.'] },
      { id: 'b02_41_07', german: 'die Hundehütte', arabic: 'بيت الكلب (الكوخ)', article: 'die', plural: 'die Hundehütten', emoji: '🐕', exampleSentenceGerman: 'Bello schläft gern in seiner warmen Hundehütte.', exampleSentenceArabic: 'بيلو يفضل النوم في كوخ كلبه الدافئ.', missingLetterWord: 'die H_ndehütte', sentence4Elements: ['Die', 'Hundehütte', 'steht', 'im grünen Garten.'] },
      { id: 'b02_41_08', german: 'der Ameisenhaufen', arabic: 'تل النمل (قرية النمل)', article: 'der', plural: 'die Ameisenhaufen', emoji: '🐜', exampleSentenceGerman: 'Im Wald steht ein hoher Ameisenhaufen.', exampleSentenceArabic: 'في الغابة يقف تل نمل مرتفع.', missingLetterWord: 'der Ameis_nhaufen', sentence4Elements: ['Der', 'Ameisenhaufen', 'ist', 'voller Leben.'] },
      { id: 'b02_41_09', german: 'das Spinnennetz', arabic: 'شبكة العنكبوت', article: 'das', plural: 'die Spinnennetze', emoji: '🕸️', exampleSentenceGerman: 'Im Morgentau glitzert das Spinnennetz.', exampleSentenceArabic: 'في ندى الصباح تلمع شبكة العنكبوت.', missingLetterWord: 'das Sp_nnennetz', sentence4Elements: ['Ein', 'feines', 'Spinnennetz', 'am Fensterrahmen.'] },
      { id: 'b02_41_10', german: 'der Teich', arabic: 'البركة المائية', article: 'der', plural: 'die Teiche', emoji: '🪷', exampleSentenceGerman: 'Am Dorfteich schwimmen Enten und Frösche.', exampleSentenceArabic: 'عند بركة القرية تسبح البطات والضفادع.', missingLetterWord: 'der T_ich', sentence4Elements: ['Im', 'Teich', 'blühen', 'schöne Seerosen.'] }
    ]
  },

  // 42. Animals: African Wildlife (جريد 2 / جريد 3)
  {
    id: 'curric_b02_42_african_animals',
    title: 'Tiere in der Savanne',
    titleTranslations: { ar: 'حيوانات السافانا الأفريقية', de: 'Tiere in der Savanne', en: 'African Savanna Animals' },
    topic: 'حيوانات السافانا',
    topicTranslations: { ar: 'حيوانات السافانا', de: 'Savannentiere', en: 'Savanna Wildlife' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الفهد والضبع والنعامة والفهود في البراري الأفريقية.',
    descriptionTranslations: { ar: 'الفهد والضبع والنعامة والفهود في البراري الأفريقية.', de: 'Gepard, Hyäne und Strauß in Afrika.', en: 'Cheetahs, hyenas and ostriches in Africa.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_42_01', german: 'der Gepard', arabic: 'الفهد الصياد', article: 'der', plural: 'die Geparde', emoji: '🐆', exampleSentenceGerman: 'Der Gepard ist das schnellste Landtier.', exampleSentenceArabic: 'الفهد هو أسرع كائن حي على اليابسة.', missingLetterWord: 'der G_pard', sentence4Elements: ['Der', 'Gepard', 'sprintet', 'durch die Steppe.'] },
      { id: 'b02_42_02', german: 'der Leopard', arabic: 'النمر المرقط (الفهد)', article: 'der', plural: 'die Leoparden', emoji: '🐆', exampleSentenceGerman: 'Der Leopard schläft oben auf dem Akazienbaum.', exampleSentenceArabic: 'النمر المرقط ينام فوق شجرة السنط.', missingLetterWord: 'der L_opard', sentence4Elements: ['Der', 'Leopard', 'klettert', 'ausgezeichnet auf Bäume.'] },
      { id: 'b02_42_03', german: 'die Hyäne', arabic: 'الضبع', article: 'die', plural: 'die Hyänen', emoji: '🐾', exampleSentenceGerman: 'Die Hyäne lacht nachts mit heiserer Stimme.', exampleSentenceArabic: 'الضبع يضحك ليلاً بصوت مبحوح.', missingLetterWord: 'die Hy_ne', sentence4Elements: ['Die', 'Hyäne', 'streift', 'durchs Gras.'] },
      { id: 'b02_42_04', german: 'der Strauß', arabic: 'النعامة', article: 'der', plural: 'die Strauße', emoji: '🪶', exampleSentenceGerman: 'Der Strauß kann nicht fliegen, aber schnell rennen.', exampleSentenceArabic: 'النعامة لا تستطيع الطيران، لكنها تركض بسرعة فائقة.', missingLetterWord: 'der Str_uß', sentence4Elements: ['Der', 'Strauß', 'legt', 'riesige Eier.'] },
      { id: 'b02_42_05', german: 'das Erdmännchen', arabic: 'الميركات (سرقاط)', article: 'das', plural: 'die Erdmännchen', emoji: '🐾', exampleSentenceGerman: 'Das Erdmännchen steht auf zwei Beinen Wache.', exampleSentenceArabic: 'حيوان الميركات يقف حارساً على ساقين.', missingLetterWord: '_rdmännchen', sentence4Elements: ['Erdmännchen', 'passen', 'aufeinander', 'gut auf.'] },
      { id: 'b02_42_06', german: 'die Antilope', arabic: 'الظبي الأفريقي (الإمبالا)', article: 'die', plural: 'die Antilopen', emoji: '🦌', exampleSentenceGerman: 'Die Antilope springt hoch über Felsen.', exampleSentenceArabic: 'الظبي الأفريقي يقفز عالياً فوق الصخور.', missingLetterWord: 'die Ant_lope', sentence4Elements: ['Antilopen', 'grasen', 'friedlich', 'in der Savanne.'] },
      { id: 'b02_42_07', german: 'der Schimpanse', arabic: 'الشمبانزي', article: 'der', plural: 'die Schimpansen', emoji: '🐒', exampleSentenceGerman: 'Der Schimpanse benutzt Werkzeuge aus Holz.', exampleSentenceArabic: 'الشمبانزي يستخدم أدوات مصنوعة من الخشب.', missingLetterWord: 'der Schimp_nse', sentence4Elements: ['Der', 'Schimpanse', 'ist', 'sehr intelligent.'] },
      { id: 'b02_42_08', german: 'das Warzenschwein', arabic: 'الخنزير الثؤلولي (بومبا)', article: 'das', plural: 'die Warzenschweine', emoji: '🐗', exampleSentenceGerman: 'Das Warzenschwein trabt mit aufrechtem Schwanz.', exampleSentenceArabic: 'الخنزير الثؤلولي يخب بذيل مرفوع.', missingLetterWord: 'das W_rzenschwein', sentence4Elements: ['Pumbaa', 'ist', 'ein', 'lustiges Warzenschwein.'] },
      { id: 'b02_42_09', german: 'der Geier', arabic: 'النسر الجيف (الرخمة)', article: 'der', plural: 'die Geier', emoji: '🦅', exampleSentenceGerman: 'Der Geier segelt mit breiten Flügeln.', exampleSentenceArabic: 'النسر يحلق بأجنحة عريضة.', missingLetterWord: 'der G_ier', sentence4Elements: ['Der', 'Geier', 'kreist', 'am blauen Himmel.'] },
      { id: 'b02_42_10', german: 'das Gnu', arabic: 'النو (حيوان بري)', article: 'das', plural: 'die Gnus', emoji: '🐂', exampleSentenceGerman: 'Tausende Gnus wandern über den großen Fluss.', exampleSentenceArabic: 'آلاف من حيوانات النو تهاجر عبر النهر الكبير.', missingLetterWord: 'das Gn_', sentence4Elements: ['Die', 'Gnus', 'wandern', 'durch Afrika.'] }
    ]
  },

  // 43. Nature: Trees & Forest Plants (جريد 1 / جريد 2)
  {
    id: 'curric_b02_43_trees_plants',
    title: 'Bäume und Waldpflanzen',
    titleTranslations: { ar: 'الأشجار ونباتات الغابة', de: 'Bäume und Waldpflanzen', en: 'Trees & Forest Plants' },
    topic: 'الأشجار والنباتات',
    topicTranslations: { ar: 'الأشجار والنباتات', de: 'Pflanzenwelt', en: 'Plants' },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الشجرة والغصن والجذع والأوراق والجذور.',
    descriptionTranslations: { ar: 'الشجرة والغصن والجذع والأوراق والجذور.', de: 'Baum, Ast, Blatt und Wurzel.', en: 'Tree, branch, leaf and root.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_43_01', german: 'der Baum', arabic: 'الشجرة', article: 'der', plural: 'die Bäume', emoji: '🌳', exampleSentenceGerman: 'Der alte Baum spendet kühlen Schatten.', exampleSentenceArabic: 'الشجرة القديمة تمنح ظلاً بارداً.', missingLetterWord: 'der B_um', sentence4Elements: ['Der', 'Baum', 'wächst', 'hoch in den Himmel.'] },
      { id: 'b02_43_02', german: 'das Blatt', arabic: 'ورقة الشجر', article: 'das', plural: 'die Blätter', emoji: '🍃', exampleSentenceGerman: 'Das grüne Blatt tanzt sanft im Wind.', exampleSentenceArabic: 'الورقة الخضراء ترقص برقة في مهب الريح.', missingLetterWord: 'das Bl_tt', sentence4Elements: ['Das', 'Blatt', 'ist', 'hellgrün und frisch.'] },
      { id: 'b02_43_03', german: 'der Ast', arabic: 'الغصن / الفرع', article: 'der', plural: 'die Äste', emoji: '🪵', exampleSentenceGerman: 'Der Vogel sitzt auf einem dicken Ast.', exampleSentenceArabic: 'الطائر يجلس على غصن سميك.', missingLetterWord: 'der _st', sentence4Elements: ['Auf', 'dem', 'Ast', 'singt eine Meise.'] },
      { id: 'b02_43_04', german: 'der Stamm', arabic: 'جذع الشجرة', article: 'der', plural: 'die Stämme', emoji: '🪵', exampleSentenceGerman: 'Der Stamm der Eiche ist sehr kräftig.', exampleSentenceArabic: 'جذع شجرة البلوط قوي جداً ومتين.', missingLetterWord: 'der St_mm', sentence4Elements: ['Der', 'Stamm', 'ist', 'mit Moos bedeckt.'] },
      { id: 'b02_43_05', german: 'die Wurzel', arabic: 'الجذر (تحت الأرض)', article: 'die', plural: 'die Wurzeln', emoji: '🌱', exampleSentenceGerman: 'Die Wurzel saugt Wasser aus dem Boden.', exampleSentenceArabic: 'الجذر يمتص الماء من باطن الأرض.', missingLetterWord: 'die W_rzel', sentence4Elements: ['Tief', 'im', 'Boden', 'liegen die Wurzeln.'] },
      { id: 'b02_43_06', german: 'die Tanne', arabic: 'شجرة الصنوبر / التنوب', article: 'die', plural: 'die Tannen', emoji: '🌲', exampleSentenceGerman: 'Die Tanne bleibt auch im Winter grün.', exampleSentenceArabic: 'شجرة التنوب تظل خضراء حتى في الشتاء.', missingLetterWord: 'die T_nne', sentence4Elements: ['Die', 'Tanne', 'duftet', 'wunderbar nach Wald.'] },
      { id: 'b02_43_07', german: 'die Eiche', arabic: 'شجرة البلوط (السنديان)', article: 'die', plural: 'die Eichen', emoji: '🌳', exampleSentenceGerman: 'An der Eiche wachsen viele Eicheln.', exampleSentenceArabic: 'على شجرة البلوط ينمو ثمار البلوط بكثرة.', missingLetterWord: 'die _iche', sentence4Elements: ['Die', 'Eiche', 'ist', 'tausend Jahre alt.'] },
      { id: 'b02_43_08', german: 'das Moos', arabic: 'الحزاز / الطحالب الخضراء', article: 'das', plural: 'die Moose', emoji: '🟩', exampleSentenceGerman: 'Das Moos im Wald ist weich wie ein Teppich.', exampleSentenceArabic: 'الطحالب في الغابة ناعمة كالسجادة.', missingLetterWord: 'das M_os', sentence4Elements: ['Grünes', 'Moos', 'wächst', 'auf den Steinen.'] },
      { id: 'b02_43_09', german: 'der Pilz', arabic: 'الفطر / المشروم', article: 'der', plural: 'die Pilze', emoji: '🍄', exampleSentenceGerman: 'Der rote Fliegenpilz hat weiße Punkte.', exampleSentenceArabic: 'فطر عيش الغراب الأحمر لديه نقاط بيضاء.', missingLetterWord: 'der P_lz', sentence4Elements: ['Im', 'Herbst', 'finden', 'wir Pilze im Wald.'] },
      { id: 'b02_43_10', german: 'der Wald', arabic: 'الغابة', article: 'der', plural: 'die Wälder', emoji: '🌲', exampleSentenceGerman: 'Wir machen einen Ausflug in den großen Wald.', exampleSentenceArabic: 'نقوم بنزهة إلى الغابة الكبيرة.', missingLetterWord: 'der W_ld', sentence4Elements: ['Im', 'Wald', 'ist', 'es wunderbar still.'] }
    ]
  },

  // 44. Nature: Beautiful Flowers in the Garden (روضة / جريد 1)
  {
    id: 'curric_b02_44_garden_flowers',
    title: 'Bunte Blumen im Garten',
    titleTranslations: { ar: 'الزهور الملونة في الحديقة', de: 'Bunte Blumen im Garten', en: 'Colorful Flowers' },
    topic: 'الزهور والحديقة',
    topicTranslations: { ar: 'الزهور والحديقة', de: 'Blumen', en: 'Flowers' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الوردة والتوليب وعباد الشمس والزهور المحبوبة.',
    descriptionTranslations: { ar: 'الزهور المحبوبة والتوليب وعباد الشمس.', de: 'Rose, Tulpe und Sonnenblume.', en: 'Roses, tulips and sunflowers.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_44_01', german: 'die Blume', arabic: 'الزهرة / الوردة', article: 'die', plural: 'die Blumen', emoji: '🌸', exampleSentenceGerman: 'Ich pflücke eine schöne Blume für Mama.', exampleSentenceArabic: 'أقطف زهرة جميلة لأمي.', missingLetterWord: 'die Bl_me', sentence4Elements: ['Die', 'Blume', 'blüht', 'in voller Pracht.'] },
      { id: 'b02_44_02', german: 'die Rose', arabic: 'الوردة الجورية', article: 'die', plural: 'die Rosen', emoji: '🌹', exampleSentenceGerman: 'Die rote Rose duftet herrlich süß.', exampleSentenceArabic: 'الوردة الجورية الحمراء تفوح برائحة زكية.', missingLetterWord: 'die R_se', sentence4Elements: ['Die', 'Rose', 'hat', 'kleine spitze Dornen.'] },
      { id: 'b02_44_03', german: 'die Tulpe', arabic: 'زهرة التوليب', article: 'die', plural: 'die Tulpen', emoji: '🌷', exampleSentenceGerman: 'Im Frühling blühen viele bunte Tulpen.', exampleSentenceArabic: 'في فصل الربيع تتفتح أزهار توليب ملونة كثيرة.', missingLetterWord: 'die T_lpe', sentence4Elements: ['Rote', 'Tulpen', 'stehen', 'im Blumenbeet.'] },
      { id: 'b02_44_04', german: 'die Sonnenblume', arabic: 'دوار الشمس / عباد الشمس', article: 'die', plural: 'die Sonnenblumen', emoji: '🌻', exampleSentenceGerman: 'Die große Sonnenblume dreht sich zur Sonne.', exampleSentenceArabic: 'زهرة دوار الشمس الكبيرة تتجه نحو قرص الشمس.', missingLetterWord: 'die S_nnenblume', sentence4Elements: ['Die', 'Sonnenblume', 'ist', 'strahlend gelb.'] },
      { id: 'b02_44_05', german: 'das Gänseblümchen', arabic: 'زهرة الأقحوان الصغيرة (البابونج البري)', article: 'das', plural: 'die Gänseblümchen', emoji: '🌼', exampleSentenceGerman: 'Wir flechten einen Kranz aus Gänseblümchen.', exampleSentenceArabic: 'نصنع طوقاً مجدولاً من أزهار الأقحوان الصغيرة.', missingLetterWord: 'das G_nseblümchen', sentence4Elements: ['Gänseblümchen', 'wachsen', 'überall', 'im Rasen.'] },
      { id: 'b02_44_06', german: 'der Löwenzahn', arabic: 'الهندباء البرية (زهرة قنديل الفاصوليا)', article: 'der', plural: 'die Löwenzähne', emoji: '🌱', exampleSentenceGerman: 'Ich puste die Pusteblume des Löwenzahns weg.', exampleSentenceArabic: 'أنفخ بذور زهرة الهندباء في الهواء.', missingLetterWord: 'der L_wenzahn', sentence4Elements: ['Der', 'gelbe', 'Löwenzahn', 'wird zur Pusteblume.'] },
      { id: 'b02_44_07', german: 'das Veilchen', arabic: 'زهرة البنفسج', article: 'das', plural: 'die Veilchen', emoji: '🪻', exampleSentenceGerman: 'Das kleine blaue Veilchen duftet zart.', exampleSentenceArabic: 'البنفسج الأزرق الصغير يفوح برقة.', missingLetterWord: 'das V_ilchen', sentence4Elements: ['Das', 'blaue', 'Veilchen', 'blüht im Verborgenen.'] },
      { id: 'b02_44_08', german: 'die Lilie', arabic: 'زهرة الزنبق', article: 'die', plural: 'die Lilien', emoji: '⚜️', exampleSentenceGerman: 'Die weiße Lilie steht fest in der Vase.', exampleSentenceArabic: 'زنبقة بيضاء تقف بثبات في المزهرية.', missingLetterWord: 'die L_lie', sentence4Elements: ['Die', 'edle', 'Lilie', 'blüht im Sommer.'] },
      { id: 'b02_44_09', german: 'der Kaktus', arabic: 'الصبار', article: 'der', plural: 'die Kakteen', emoji: '🌵', exampleSentenceGerman: 'Der Kaktus braucht nur ganz wenig Wasser.', exampleSentenceArabic: 'الصبار يحتاج إلى قليل جداً من الماء.', missingLetterWord: 'der K_ktus', sentence4Elements: ['Der', 'Kaktus', 'hat', 'spitze Stacheln.'] },
      { id: 'b02_44_10', german: 'gießen', arabic: 'يسقي / يروي بالماء', emoji: '🪴', exampleSentenceGerman: 'Ich gieße die Blumen mit der Gießkanne.', exampleSentenceArabic: 'أسقي الزهور بإبريق الري.', missingLetterWord: 'gi_ßen', sentence4Elements: ['Ich', 'gieße', 'jeden', 'Tag die Blumen.'] }
    ]
  },

  // 45. Nature: Landscapes & Geography (جريد 2 / جريد 3)
  {
    id: 'curric_b02_45_landscapes',
    title: 'Landschaften der Erde',
    titleTranslations: { ar: 'تضاريس الأرض والمناظر الطبيعية', de: 'Landschaften der Erde', en: 'Landscapes of Earth' },
    topic: 'التضاريس والطبيعة',
    topicTranslations: { ar: 'التضاريس والطبيعة', de: 'Landschaften', en: 'Landscapes' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الجبل والوادي والنهر والبحر والجزيرة.',
    descriptionTranslations: { ar: 'الجبل والوادي والنهر والبحر والجزيرة.', de: 'Berg, Tal, Fluss, Meer und Insel.', en: 'Mountains, valleys, rivers, seas and islands.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_45_01', german: 'der Berg', arabic: 'الجبل', article: 'der', plural: 'die Berge', emoji: '⛰️', exampleSentenceGerman: 'Auf dem hohen Berg liegt weißer Schnee.', exampleSentenceArabic: 'على قمة الجبل الشاهق ثلج أبيض.', missingLetterWord: 'der B_rg', sentence4Elements: ['Wir', 'wandern', 'auf', 'den hohen Berg.'] },
      { id: 'b02_45_02', german: 'das Tal', arabic: 'الوادي', article: 'das', plural: 'die Täler', emoji: '🏞️', exampleSentenceGerman: 'Unten im Tal fließt ein friedlicher Bach.', exampleSentenceArabic: 'في أسفل الوادي يجري جدول ماء هادئ.', missingLetterWord: 'das T_l', sentence4Elements: ['Im', 'grünen', 'Tal', 'steht ein Dorf.'] },
      { id: 'b02_45_03', german: 'der Fluss', arabic: 'النهر', article: 'der', plural: 'die Flüsse', emoji: '🌊', exampleSentenceGerman: 'Der breite Fluss fließt ins blaue Meer.', exampleSentenceArabic: 'النهر العريض يتدفق نحو البحر الأزرق.', missingLetterWord: 'der Fl_ss', sentence4Elements: ['Schiffe', 'fahren', 'auf', 'dem breiten Fluss.'] },
      { id: 'b02_45_04', german: 'der See', arabic: 'البحيرة', article: 'der', plural: 'die Seen', emoji: '🛶', exampleSentenceGerman: 'Im Sommer baden wir im klaren See.', exampleSentenceArabic: 'في الصيف نسبح في البحيرة الصافية.', missingLetterWord: 'der S_e', sentence4Elements: ['Das', 'Wasser', 'im', 'See ist kühl.'] },
      { id: 'b02_45_05', german: 'das Meer', arabic: 'البحر', article: 'das', plural: 'die Meere', emoji: '🌊', exampleSentenceGerman: 'Wir fahren in den Ferien ans Meer.', exampleSentenceArabic: 'نسافر في العطلة إلى شاطئ البحر.', missingLetterWord: 'das M_er', sentence4Elements: ['Das', 'Meer', 'rauscht', 'Tag und Nacht.'] },
      { id: 'b02_45_06', german: 'der Strand', arabic: 'الشاطئ الرملي', article: 'der', plural: 'die Strände', emoji: '🏖️', exampleSentenceGerman: 'Am Strand bauen wir eine riesige Sandburg.', exampleSentenceArabic: 'على الشاطئ نبني قلعة رملية عملاقة.', missingLetterWord: 'der Str_nd', sentence4Elements: ['Wir', 'spielen', 'im', 'weichen warmen Sand.'] },
      { id: 'b02_45_07', german: 'die Insel', arabic: 'الجزيرة', article: 'die', plural: 'die Inseln', emoji: '🏝️', exampleSentenceGerman: 'Die Insel ist rundherum von Wasser umgeben.', exampleSentenceArabic: 'الجزيرة محاطة بالماء من جميع الجهات.', missingLetterWord: 'die _nsel', sentence4Elements: ['Auf', 'der', 'Insel', 'wachsen grüne Palmen.'] },
      { id: 'b02_45_08', german: 'die Wüste', arabic: 'الصحراء', article: 'die', plural: 'die Wüsten', emoji: '🏜️', exampleSentenceGerman: 'In der Wüste gibt es viel heißen Sand.', exampleSentenceArabic: 'في الصحراء يوجد رمال ساخنة كثيرة.', missingLetterWord: 'die W_ste', sentence4Elements: ['Kamele', 'laufen', 'durch', 'die weite Wüste.'] },
      { id: 'b02_45_09', german: 'die Höhle', arabic: 'المغارة / الكهف', article: 'die', plural: 'die Höhlen', emoji: '🪨', exampleSentenceGerman: 'In der dunklen Höhle hängen Fledermäuse.', exampleSentenceArabic: 'في الكهف المظلم تتدلى الخفافيش.', missingLetterWord: 'die H_hle', sentence4Elements: ['Die', 'Höhle', 'ist', 'kühl und geheimnisvoll.'] },
      { id: 'b02_45_10', german: 'der Wasserfall', arabic: 'الشلال', article: 'der', plural: 'die Wasserfälle', emoji: '💧', exampleSentenceGerman: 'Der Wasserfall stürzt tosend in die Tiefe.', exampleSentenceArabic: 'الشلال يتدفق هادراً نحو الأعماق.', missingLetterWord: 'der W_sserfall', sentence4Elements: ['Der', 'Wasserfall', 'glitzert', 'in der Sonne.'] }
    ]
  },

  // 46. Nature: Environmental Care & Recycling (جريد 3 / جريد 4)
  {
    id: 'curric_b02_46_environment_care',
    title: 'Umweltschutz für Kinder',
    titleTranslations: { ar: 'حماية البيئة وتدوير النفايات للأطفال', de: 'Umweltschutz für Kinder', en: 'Environmental Care for Kids' },
    topic: 'البيئة والنظافة',
    topicTranslations: { ar: 'البيئة والنظافة', de: 'Umwelt & Natur', en: 'Environment' },
    grade: 'جريد 3',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'إعادة التدوير وفرز القمامة وحماية الطبيعة.',
    descriptionTranslations: { ar: 'إعادة التدوير وفرز القمامة وحماية الطبيعة.', de: 'Müll trennen, recyceln und die Natur schützen.', en: 'Sorting trash, recycling and saving nature.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_46_01', german: 'die Umwelt', arabic: 'البيئة', article: 'die', plural: 'die Umwelten', emoji: '🌍', exampleSentenceGerman: 'Wir müssen unsere Umwelt sauber halten.', exampleSentenceArabic: 'يجب علينا الحفاظ على بيئتنا نظيفة.', missingLetterWord: 'die Umw_lt', sentence4Elements: ['Wir', 'schützen', 'unsere', 'Erde und Umwelt.'] },
      { id: 'b02_46_02', german: 'der Müll', arabic: 'القمامة / النفايات', article: 'der', plural: 'die Mülle', emoji: '🗑️', exampleSentenceGerman: 'Wir werfen keinen Müll auf den Boden.', exampleSentenceArabic: 'نحن لا نرمي القمامة على الأرض.', missingLetterWord: 'der M_ll', sentence4Elements: ['Wirf', 'den', 'Müll', 'in den Mülleimer!'] },
      { id: 'b02_46_03', german: 'trennen', arabic: 'يفرز / يفصل القمامة', emoji: '♻️', exampleSentenceGerman: 'In Deutschland trennen wir den Müll genau.', exampleSentenceArabic: 'في ألمانيا نفرز النفايات بدقة.', missingLetterWord: 'tr_nnen', sentence4Elements: ['Kinder', 'trennen', 'den', 'Müll vorbildlich.'] },
      { id: 'b02_46_04', german: 'das Altpapier', arabic: 'الورق المستعمل للتدوير', article: 'das', plural: 'die Altpapiere', emoji: '📰', exampleSentenceGerman: 'Alte Zeitungen gehören in die blaue Tonne.', exampleSentenceArabic: 'الجرائد القديمة توضع في الحاوية الزرقاء.', missingLetterWord: 'das _ltpapier', sentence4Elements: ['Wir', 'sammeln', 'das', 'ganze Altpapier sorgfältig.'] },
      { id: 'b02_46_05', german: 'das Plastik', arabic: 'البلاستيك', article: 'das', plural: 'die Plastike', emoji: '🧴', exampleSentenceGerman: 'Plastikflaschen bringen wir zum Pfandautomaten.', exampleSentenceArabic: 'زجاجات البلاستيك نأخذها لماكينة استرجاع الوديعة.', missingLetterWord: 'das Pl_stik', sentence4Elements: ['Wir', 'vermeiden', 'unnötiges', 'Plastik beim Einkaufen.'] },
      { id: 'b02_46_06', german: 'das Glas', arabic: 'الزجاج', article: 'das', plural: 'die Gläser', emoji: '🫙', exampleSentenceGerman: 'Alte Gläser werfen wir in den Glascontainer.', exampleSentenceArabic: 'البرطمانات الزجاجية نضعها في حاوية الزجاج.', missingLetterWord: 'das Gl_s', sentence4Elements: ['Glas', 'kann', 'man', 'immer wieder recyceln.'] },
      { id: 'b02_46_07', german: 'der Biomüll', arabic: 'النفايات العضوية (بقايا الطعام)', article: 'der', plural: 'die Biomülle', emoji: '🍌', exampleSentenceGerman: 'Apfelgriebsche und Bananenschalen kommen in den Biomüll.', exampleSentenceArabic: 'بواقي التفاح وقشور الموز توضع في النفايات العضوية.', missingLetterWord: 'der B_omüll', sentence4Elements: ['Aus', 'Biomüll', 'wird', 'guter Kompost.'] },
      { id: 'b02_46_08', german: 'sparen', arabic: 'يوفر / يقتصد (في الماء والكهرباء)', emoji: '💡', exampleSentenceGerman: 'Wir schalten das Licht aus, um Strom zu sparen.', exampleSentenceArabic: 'نطفئ النور لتوفير الكهرباء.', missingLetterWord: 'sp_ren', sentence4Elements: ['Wir', 'sparen', 'Wasser', 'beim Zähneputzen.'] },
      { id: 'b02_46_09', german: 'pflanzen', arabic: 'يزرع / يغرس شتلة', emoji: '🌱', exampleSentenceGerman: 'Wir pflanzen einen neuen Baum im Schulgarten.', exampleSentenceArabic: 'نزرع شجرة جديدة في حديقة المدرسة.', missingLetterWord: 'pfl_nzen', sentence4Elements: ['Kinder', 'pflanzen', 'junge', 'Bäume für die Zukunft.'] },
      { id: 'b02_46_10', german: 'die Energie', arabic: 'الطاقة (الشمسية والرياح)', article: 'die', plural: 'die Energien', emoji: '⚡', exampleSentenceGerman: 'Wind und Sonne geben uns saubere Energie.', exampleSentenceArabic: 'الرياح والشمس تمنحنا طاقة نظيفة.', missingLetterWord: 'die En_rgie', sentence4Elements: ['Saubere', 'Energie', 'schützt', 'unsere Natur.'] }
    ]
  },

  // 47. Weather: The Four Seasons (روضة / جريد 1)
  {
    id: 'curric_b02_47_seasons_four',
    title: 'Die vier Jahreszeiten',
    titleTranslations: { ar: 'فصول السنة الأربعة', de: 'Die vier Jahreszeiten', en: 'The Four Seasons' },
    topic: 'فصول السنة',
    topicTranslations: { ar: 'فصول السنة', de: 'Jahreszeiten', en: 'Seasons' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الربيع والصيف والخريف والشتاء وما يميز كل فصل.',
    descriptionTranslations: { ar: 'الربيع والصيف والخريف والشتاء.', de: 'Frühling, Sommer, Herbst und Winter.', en: 'Spring, summer, autumn and winter.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_47_01', german: 'die Jahreszeit', arabic: 'فصل السنة', article: 'die', plural: 'die Jahreszeiten', emoji: '🍂', exampleSentenceGerman: 'Ein Jahr hat vier schöne Jahreszeiten.', exampleSentenceArabic: 'السنة لها أربعة فصول جميلة.', missingLetterWord: 'die J_hreszeit', sentence4Elements: ['Vier', 'Jahreszeiten', 'hat', 'das ganze Jahr.'] },
      { id: 'b02_47_02', german: 'der Frühling', arabic: 'فصل الربيع', article: 'der', plural: 'die Frühlinge', emoji: '🌸', exampleSentenceGerman: 'Im Frühling blühen die ersten Blumen.', exampleSentenceArabic: 'في فصل الربيع تتفتح الأزهار الأولى.', missingLetterWord: 'der Fr_hling', sentence4Elements: ['Der', 'Frühling', 'bringt', 'viele bunte Blumen.'] },
      { id: 'b02_47_03', german: 'der Sommer', arabic: 'فصل الصيف', article: 'der', plural: 'die Sommer', emoji: '☀️', exampleSentenceGerman: 'Im Sommer ist es herrlich warm und sonnig.', exampleSentenceArabic: 'في الصيف يكون الجو دافئاً ومشمساً ورائعاً.', missingLetterWord: 'der S_mmer', sentence4Elements: ['Im', 'Sommer', 'haben', 'wir lange Ferien.'] },
      { id: 'b02_47_04', german: 'der Herbst', arabic: 'فصل الخريف', article: 'der', plural: 'die Herbste', emoji: '🍁', exampleSentenceGerman: 'Im Herbst weht der Wind und bunte Blätter fallen.', exampleSentenceArabic: 'في الخريف تهب الرياح وتتساقط الأوراق الملونة.', missingLetterWord: 'der H_rbst', sentence4Elements: ['Der', 'Herbst', 'färbt', 'die Blätter bunt.'] },
      { id: 'b02_47_05', german: 'der Winter', arabic: 'فصل الشتاء', article: 'der', plural: 'die Winter', emoji: '⛄', exampleSentenceGerman: 'Im Winter bauen wir einen lustigen Schneemann.', exampleSentenceArabic: 'في الشتاء نبني رجل ثلج مرحاً.', missingLetterWord: 'der W_nter', sentence4Elements: ['Im', 'Winter', 'fällt', 'oft weißer Schnee.'] },
      { id: 'b02_47_06', german: 'das Wetter', arabic: 'الطقس / الجو', article: 'das', plural: 'die Wetter', emoji: '🌤️', exampleSentenceGerman: 'Wie ist das Wetter heute draußen?', exampleSentenceArabic: 'كيف يبدو الطقس في الخارج اليوم؟', missingLetterWord: 'das W_tter', sentence4Elements: ['Das', 'Wetter', 'ist', 'heute wunderschön sonnig.'] },
      { id: 'b02_47_07', german: 'die Sonne', arabic: 'الشمس', article: 'die', plural: 'die Sonnen', emoji: '☀️', exampleSentenceGerman: 'Die Sonne scheint warm vom Himmel.', exampleSentenceArabic: 'الشمس تسطع دافئة من السماء.', missingLetterWord: 'die S_nne', sentence4Elements: ['Die', 'Sonne', 'wärmt', 'unsere ganze Erde.'] },
      { id: 'b02_47_08', german: 'der Schnee', arabic: 'الثلج', article: 'der', plural: 'die Schnee', emoji: '❄️', exampleSentenceGerman: 'Der kalte Schnee knirscht unter den Stiefeln.', exampleSentenceArabic: 'الثلج البارد يقرقش تحت الأحذية الشتوية.', missingLetterWord: 'der Schn_e', sentence4Elements: ['Schnee', 'ist', 'kalt', 'und strahlend weiß.'] },
      { id: 'b02_47_09', german: 'der Wind', arabic: 'الرياح / الهواء العليل', article: 'der', plural: 'die Winde', emoji: '💨', exampleSentenceGerman: 'Der frische Wind lässt Drachen steigen.', exampleSentenceArabic: 'الرياح المنعشة تجعل الطائرات الورقية تحلق.', missingLetterWord: 'der W_nd', sentence4Elements: ['Der', 'Wind', 'weht', 'durch die Bäume.'] },
      { id: 'b02_47_10', german: 'die Wolke', arabic: 'السحابة / الغيمة', article: 'die', plural: 'die Wolken', emoji: '☁️', exampleSentenceGerman: 'Am Himmel zieht eine weiße Wolke vorbei.', exampleSentenceArabic: 'في السماء تمر سحابة بيضاء رقيقة.', missingLetterWord: 'die W_lke', sentence4Elements: ['Die', 'Wolke', 'verdeckt', 'die helle Sonne.'] }
    ]
  },

  // 48. Weather: Rain, Storm & Thunder (جريد 2 / جريد 3)
  {
    id: 'curric_b02_48_rain_storm',
    title: 'Regen und Gewitter',
    titleTranslations: { ar: 'الأمطار والعواصف والرعد', de: 'Regen und Gewitter', en: 'Rain and Storm' },
    topic: 'الأمطار والعواصف',
    topicTranslations: { ar: 'الأمطار والعواصف', de: 'Regenwetter', en: 'Rainy Weather' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'المطر والبرق والرعد وقوس قزح والمظلة.',
    descriptionTranslations: { ar: 'المطر والبرق والرعد وقوس قزح والمظلة.', de: 'Regen, Blitz, Donner und Regenschirm.', en: 'Rain, lightning, thunder and umbrella.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_48_01', german: 'der Regentropfen', arabic: 'قطرة المطر', article: 'der', plural: 'die Regentropfen', emoji: '💧', exampleSentenceGerman: 'Ein kühler Regentropfen fällt auf meine Wange.', exampleSentenceArabic: 'قطرة مطر منعشة تسقط على وجنتي.', missingLetterWord: 'der R_gentropfen', sentence4Elements: ['Regentropfen', 'klopfen', 'leise', 'an die Fensterscheibe.'] },
      { id: 'b02_48_02', german: 'der Regenschirm', arabic: 'المظلة (الشمسية)', article: 'der', plural: 'die Regenschirme', emoji: '☂️', exampleSentenceGerman: 'Ich spanne meinen bunten Regenschirm auf.', exampleSentenceArabic: 'أفتح مظلتي الملونة.', missingLetterWord: 'der R_genschirm', sentence4Elements: ['Der', 'Schirm', 'schützt', 'mich vor Regen.'] },
      { id: 'b02_48_03', german: 'die Pfütze', arabic: 'بركة الماء (في الشارع بعد المطر)', article: 'die', plural: 'die Pfützen', emoji: '💦', exampleSentenceGerman: 'Mit Gummistiefeln springe ich in die Pfütze!', exampleSentenceArabic: 'بالحذاء المطاطي أقفز في بركة الماء!', missingLetterWord: 'die Pf_tze', sentence4Elements: ['Wir', 'hüpfen', 'mit', 'Freude in Pfützen!'] },
      { id: 'b02_48_04', german: 'der Blitz', arabic: 'البرق', article: 'der', plural: 'die Blitze', emoji: '⚡', exampleSentenceGerman: 'Ein heller Blitz erhellt die Nacht.', exampleSentenceArabic: 'برق ساطع يضيء عتمة الليل.', missingLetterWord: 'der Bl_tz', sentence4Elements: ['Der', 'Blitz', 'zuckt', 'am dunklen Himmel.'] },
      { id: 'b02_48_05', german: 'der Donner', arabic: 'الرعد', article: 'der', plural: 'die Donner', emoji: '🌩️', exampleSentenceGerman: 'Nach dem Blitz hören wir lauten Donner.', exampleSentenceArabic: 'بعد البرق نسمع صوت الرعد القوي.', missingLetterWord: 'der D_nner', sentence4Elements: ['Der', 'Donner', 'rollt', 'laut durchs Tal.'] },
      { id: 'b02_48_06', german: 'das Gewitter', arabic: 'العاصفة الرعدية', article: 'das', plural: 'die Gewitter', emoji: '⛈️', exampleSentenceGerman: 'Bei Gewitter bleiben wir sicher im Haus.', exampleSentenceArabic: 'عند هبوب العاصفة الرعدية نبقى بأمان في البيت.', missingLetterWord: 'das Gew_tter', sentence4Elements: ['Das', 'Gewitter', 'zieht', 'schnell vorüber heute.'] },
      { id: 'b02_48_07', german: 'der Sturm', arabic: 'العاصفة والرياح الشديدة', article: 'der', plural: 'die Stürme', emoji: '🌪️', exampleSentenceGerman: 'Der starke Sturm biegt die Bäume.', exampleSentenceArabic: 'العاصفة الشديدة تثني أغصان الأشجار.', missingLetterWord: 'der St_rm', sentence4Elements: ['Der', 'Sturm', 'pfeift', 'durch die Straßen.'] },
      { id: 'b02_48_08', german: 'der Hagel', arabic: 'البَرَد (كرات الثلج المتساقطة)', article: 'der', plural: 'die Hagel', emoji: '🧊', exampleSentenceGerman: 'Kleine Hagelkörner prasseln auf das Auto.', exampleSentenceArabic: 'حبات بَرَد صغيرة تطرق على السيارة.', missingLetterWord: 'der H_gel', sentence4Elements: ['Hagel', 'fällt', 'plötzlich', 'vom grauen Himmel.'] },
      { id: 'b02_48_09', german: 'regnen', arabic: 'تمطر (الفعل)', emoji: '🌧️', exampleSentenceGerman: 'Es regnet heute den ganzen Nachmittag.', exampleSentenceArabic: 'إنها تمطر طوال فترة بعد الظهر اليوم.', missingLetterWord: 'r_gnen', sentence4Elements: ['Draußen', 'regnet', 'es', 'in Strömen jetzt.'] },
      { id: 'b02_48_10', german: 'der Regenbogen', arabic: 'قوس قزح في السماء', article: 'der', plural: 'die Regenbögen', emoji: '🌈', exampleSentenceGerman: 'Nach dem Schauer erscheint ein bunter Regenbogen.', exampleSentenceArabic: 'بعد هطول المطر يظهر قوس قزح بديع.', missingLetterWord: 'der R_genbogen', sentence4Elements: ['Ein', 'Regenbogen', 'leuchtet', 'am hellen Himmel.'] }
    ]
  },

  // 49. Weather: Sunny Days, Heat & Summer (جريد 2 / جريد 3)
  {
    id: 'curric_b02_49_summer_sun',
    title: 'Sonnentage und Sommerwärme',
    titleTranslations: { ar: 'الأيام المشمسة وحرارة الصيف', de: 'Sonnentage und Sommerwärme', en: 'Sunny Days and Heat' },
    topic: 'الصيف والشمس',
    topicTranslations: { ar: 'الصيف والشمس', de: 'Sommerwetter', en: 'Summer Weather' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'حرارة الشمس والنظارة الشمسية والظل والسباحة.',
    descriptionTranslations: { ar: 'حرارة الشمس والنظارة الشمسية والظل والسباحة.', de: 'Sonne, Hitze, Schatten und Sonnenbrille.', en: 'Sun, heat, shade and sunglasses.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_49_01', german: 'die Hitze', arabic: 'الحرارة الشديدة', article: 'die', plural: 'die Hitzen', emoji: '🌡️', exampleSentenceGerman: 'Im Juli spüren wir die sommerliche Hitze.', exampleSentenceArabic: 'في يوليو نشعر بحرارة الصيف اللافحة.', missingLetterWord: 'die H_tze', sentence4Elements: ['Die', 'Hitze', 'macht', 'uns alle durstig.'] },
      { id: 'b02_49_02', german: 'der Sonnenschein', arabic: 'شروق الشمس / ضوء الشمس', article: 'der', plural: 'die Sonnenscheine', emoji: '☀️', exampleSentenceGerman: 'Wir genießen den warmen Sonnenschein im Park.', exampleSentenceArabic: 'نستمتع بأشعة الشمس الدافئة في الحديقة العامة.', missingLetterWord: 'der S_nnenschein', sentence4Elements: ['Herrlicher', 'Sonnenschein', 'weckt', 'uns fröhlich auf.'] },
      { id: 'b02_49_03', german: 'die Sonnenbrille', arabic: 'النظارة الشمسية', article: 'die', plural: 'die Sonnenbrillen', emoji: '🕶️', exampleSentenceGerman: 'Ich setze meine coole Sonnenbrille auf.', exampleSentenceArabic: 'أرتدي نظارتي الشمسية الرائعة.', missingLetterWord: 'die S_nnenbrille', sentence4Elements: ['Die', 'Sonnenbrille', 'schützt', 'meine empfindlichen Augen.'] },
      { id: 'b02_49_04', german: 'die Sonnencreme', arabic: 'كريم الحماية من الشمس', article: 'die', plural: 'die Sonnencremes', emoji: '🧴', exampleSentenceGerman: 'Vor dem Schwimmen creme ich mich mit Sonnencreme ein.', exampleSentenceArabic: 'قبل السباحة أدهن بشرتي بكريم واقي الشمس.', missingLetterWord: 'die S_nnencreme', sentence4Elements: ['Sonnencreme', 'schützt', 'unsere', 'Haut vor Sonnenbrand.'] },
      { id: 'b02_49_05', german: 'der Schatten', arabic: 'الظل', article: 'der', plural: 'die Schatten', emoji: '🌳', exampleSentenceGerman: 'Unter dem großen Baum ist angenehmer Schatten.', exampleSentenceArabic: 'تحت الشجرة الكبيرة ظل لطيف ومنعش.', missingLetterWord: 'der Sch_tten', sentence4Elements: ['Wir', 'setzen', 'uns', 'in den kühlen Schatten.'] },
      { id: 'b02_49_06', german: 'das Freibad', arabic: 'المسبح المفتوح في الهواء الطلق', article: 'das', plural: 'die Freibäder', emoji: '🏊‍♂️', exampleSentenceGerman: 'Bei dreißig Grad gehen alle Kinder ins Freibad.', exampleSentenceArabic: 'عند بلوغ ثلاثين درجة يذهب كل الأطفال للمسبح الصيفي.', missingLetterWord: 'das Fr_ibad', sentence4Elements: ['Im', 'Freibad', 'haben', 'wir riesigen Wasserspaß.'] },
      { id: 'b02_49_07', german: 'das Eis', arabic: 'الآيس كريم / الجيلاتي', article: 'das', plural: 'die Eise', emoji: '🍦', exampleSentenceGerman: 'Ein kühles Erdbeereis schmeckt herrlich!', exampleSentenceArabic: 'آيس كريم الفراولة البارد لذيذ جداً!', missingLetterWord: 'das _is', sentence4Elements: ['Ich', 'esse', 'zwei', 'Kugeln leckeres Eis.'] },
      { id: 'b02_49_08', german: 'schwitzen', arabic: 'يعرق من شدة الحرارة', emoji: '🥵', exampleSentenceGerman: 'Beim Rennen in der Sonne schwitzen wir schnell.', exampleSentenceArabic: 'عند الركض تحت الشمس نعرق سريعاً.', missingLetterWord: 'schw_tzen', sentence4Elements: ['Bei', 'großer', 'Hitze', 'schwitzen wir viel.'] },
      { id: 'b02_49_09', german: 'sonnig', arabic: 'مشمس', emoji: '☀️', exampleSentenceGerman: 'Heute ist ein wunderbar sonniger Tag.', exampleSentenceArabic: 'اليوم يوم مشمس ورائع الجمال.', missingLetterWord: 's_nnig', sentence4Elements: ['Das', 'Wetter', 'bleibt', 'die ganze Woche sonnig.'] },
      { id: 'b02_49_10', german: 'der Sonnenhut', arabic: 'قبعة الحماية من الشمس', article: 'der', plural: 'die Sonnenhüte', emoji: '👒', exampleSentenceGerman: 'Vergiss nicht deinen Sonnenhut am Strand!', exampleSentenceArabic: 'لا تنسَ قبعة الشمس على الشاطئ!', missingLetterWord: 'der S_nnenhut', sentence4Elements: ['Mein', 'Sonnenhut', 'schützt', 'mich vor der Hitze.'] }
    ]
  },

  // 50. Weather: Snow, Ice & Winter Fun (جريد 2 / جريد 3)
  {
    id: 'curric_b02_50_winter_snow_fun',
    title: 'Schnee und Winterspaß',
    titleTranslations: { ar: 'مرح الثلج وألعاب الشتاء', de: 'Schnee und Winterspaß', en: 'Snow & Winter Fun' },
    topic: 'الشتاء والثلج',
    topicTranslations: { ar: 'الشتاء والثلج', de: 'Winterspiele', en: 'Winter Fun' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'رجل الثلج والتزلج وكرات الثلج في الشتاء.',
    descriptionTranslations: { ar: 'رجل الثلج والتزلج وكرات الثلج في الشتاء.', de: 'Schneemann, Schlitten und Schneeball.', en: 'Snowmen, sledges and snowballs.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_50_01', german: 'der Schneemann', arabic: 'رجل الثلج', article: 'der', plural: 'die Schneemänner', emoji: '⛄', exampleSentenceGerman: 'Der Schneemann hat eine Karotte als Nase.', exampleSentenceArabic: 'رجل الثلج لديه جزرة كأنف.', missingLetterWord: 'der Schn_emann', sentence4Elements: ['Wir', 'bauen', 'einen', 'lustigen großen Schneemann.'] },
      { id: 'b02_50_02', german: 'die Schneeflocke', arabic: 'ندفة الثلج', article: 'die', plural: 'die Schneeflocken', emoji: '❄️', exampleSentenceGerman: 'Jede weiße Schneeflocke hat ein einzigartiges Muster.', exampleSentenceArabic: 'كل ندفة ثلج بيضاء لها شكل فريد.', missingLetterWord: 'die Schn_eflocke', sentence4Elements: ['Leise', 'Schneeflocken', 'tanzen', 'vom grauen Himmel.'] },
      { id: 'b02_50_03', german: 'der Schlitten', arabic: 'المزلقة (الزلاجة الخشبية)', article: 'der', plural: 'die Schlitten', emoji: '🛷', exampleSentenceGerman: 'Wir rodeln mit dem Schlitten den Hügel hinab.', exampleSentenceArabic: 'نتزلج بالمزلقة الخشبية نزولاً من أعلى التل.', missingLetterWord: 'der Schl_tten', sentence4Elements: ['Der', 'Schlitten', 'saust', 'blitzschnell durchs Weiß.'] },
      { id: 'b02_50_04', german: 'der Schneeball', arabic: 'كرة الثلج', article: 'der', plural: 'die Schneebälle', emoji: '⚪', exampleSentenceGerman: 'Wir machen eine lustige Schneeballschlacht!', exampleSentenceArabic: 'نقوم بمعركة كرات ثلج ممتعة!', missingLetterWord: 'der Schn_eball', sentence4Elements: ['Ich', 'forme', 'einen', 'festen kalten Schneeball.'] },
      { id: 'b02_50_05', german: 'das Eis', arabic: 'الجليد (المتجمد)', article: 'das', plural: 'die Eise', emoji: '🧊', exampleSentenceGerman: 'Auf dem See ist eine dicke Schicht Eis.', exampleSentenceArabic: 'فوق البحيرة طبقة سميكة من الجليد.', missingLetterWord: 'das _is', sentence4Elements: ['Das', 'Eis', 'ist', 'sehr glatt gefroren.'] },
      { id: 'b02_50_06', german: 'der Schlittschuh', arabic: 'حذاء التزلج على الجليد', article: 'der', plural: 'die Schlittschuhe', emoji: '⛸️', exampleSentenceGerman: 'Ich fahre sicher auf Schlittschuhen.', exampleSentenceArabic: 'أتزلج بثبات بحذاء التزلج على الجليد.', missingLetterWord: 'der Schl_ttschuh', sentence4Elements: ['Wir', 'laufen', 'auf', 'Schlittschuhen über die Eisbahn.'] },
      { id: 'b02_50_07', german: 'der Ski', arabic: 'لوح التزلج على الجليد (الزلاجة)', article: 'der', plural: 'die Ski', emoji: '🎿', exampleSentenceGerman: 'In den Bergen lernen Kinder schon früh Ski fahren.', exampleSentenceArabic: 'في الجبال يتعلم الأطفال التزلج بالزلاجات مبكراً.', missingLetterWord: 'der Sk_', sentence4Elements: ['Er', 'fährt', 'auf', 'Skiern den Hang hinab.'] },
      { id: 'b02_50_08', german: 'der Eiszapfen', arabic: 'قنديل الجليد (المتدلي من السقف)', article: 'der', plural: 'die Eiszapfen', emoji: '🧊', exampleSentenceGerman: 'An der Dachrinne hängt ein spitzer Eiszapfen.', exampleSentenceArabic: 'عند ميزاب السطح يتدلى قنديل جليدي مدبب.', missingLetterWord: 'der _iszapfen', sentence4Elements: ['Der', 'Eiszapfen', 'schmilzt', 'in der Mittagssonne.'] },
      { id: 'b02_50_09', german: 'frieren', arabic: 'يشعر بالبرد الشديد / يرتجف', emoji: '🥶', exampleSentenceGerman: 'Zieh die Mütze an, sonst frierst du draußen!', exampleSentenceArabic: 'ارتدِ القبعة الصوفية وإلا ستتجمد برداً في الخارج!', missingLetterWord: 'fr_eren', sentence4Elements: ['Ich', 'friere', 'an', 'den Händen heute.'] },
      { id: 'b02_50_10', german: 'schneien', arabic: 'تثلج (يتساقط الثلج)', emoji: '🌨️', exampleSentenceGerman: 'Schau aus dem Fenster, es schneit endlich!', exampleSentenceArabic: 'انظر من النافذة، الثلج يتساقط أخيراً!', missingLetterWord: 'schn_ien', sentence4Elements: ['Es', 'schneit', 'den', 'ganzen Tag lautlos.'] }
    ]
  },

  // 51. Weather & Temperature: Cold to Hot (جريد 2 / جريد 3)
  {
    id: 'curric_b02_51_temperatures',
    title: 'Temperaturen und Grade',
    titleTranslations: { ar: 'درجات الحرارة وحالات الجو', de: 'Temperaturen und Grade', en: 'Temperatures & Degrees' },
    topic: 'درجات الحرارة',
    topicTranslations: { ar: 'درجات الحرارة', de: 'Temperatur', en: 'Temperature' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'مقياس الحرارة والدرجات المئوية والبرودة والدفء.',
    descriptionTranslations: { ar: 'مقياس الحرارة والدرجات المئوية والبرودة والدفء.', de: 'Thermometer, Grad, kalt und heiß.', en: 'Thermometers, degrees, hot and cold.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_51_01', german: 'das Thermometer', arabic: 'ميزان الحرارة (الترمومتر)', article: 'das', plural: 'die Thermometer', emoji: '🌡️', exampleSentenceGerman: 'Das Thermometer an der Wand zeigt zwanzig Grad.', exampleSentenceArabic: 'الترمومتر المعلق على الجدار يظهر عشرين درجة.', missingLetterWord: 'das Therm_meter', sentence4Elements: ['Das', 'Thermometer', 'zeigt', 'heute warmes Wetter.'] },
      { id: 'b02_51_02', german: 'das Grad', arabic: 'الدرجة المئوية', article: 'das', plural: 'die Grade', emoji: '🌡️', exampleSentenceGerman: 'Draußen sind es heute genau fünfzehn Grad.', exampleSentenceArabic: 'في الخارج تبلغ الحرارة اليوم خمس عشرة درجة.', missingLetterWord: 'das Gr_d', sentence4Elements: ['Heute', 'haben', 'wir', 'fünfundzwanzig Grad Celsius.'] },
      { id: 'b02_51_03', german: 'warm', arabic: 'دافئ', emoji: '🌤️', exampleSentenceGerman: 'Im Frühling wird es draußen wieder schön warm.', exampleSentenceArabic: 'في الربيع يصبح الجو دافئاً وجميلاً من جديد.', missingLetterWord: 'w_rm', sentence4Elements: ['Es', 'ist', 'angenehm', 'warm im Sonnenschein.'] },
      { id: 'b02_51_04', german: 'heiß', arabic: 'حار جداً / ساخن', emoji: '🔥', exampleSentenceGerman: 'Vorsicht, der Tee ist noch sehr heiß!', exampleSentenceArabic: 'انتبه، الشاي لا يزال ساخناً جداً!', missingLetterWord: 'h_iß', sentence4Elements: ['Im', 'Sommer', 'wird', 'es manchmal brütend heiß.'] },
      { id: 'b02_51_05', german: 'kalt', arabic: 'بارد', emoji: '❄️', exampleSentenceGerman: 'Das Wasser aus der Leitung ist eiskalt.', exampleSentenceArabic: 'الماء المتدفق من الصنبور بارد جداً.', missingLetterWord: 'k_lt', sentence4Elements: ['Im', 'Dezember', 'ist', 'es draußen bitterkalt.'] },
      { id: 'b02_51_06', german: 'kühl', arabic: 'معتدل البرودة / منعش', emoji: '🍃', exampleSentenceGerman: 'Ein kühler Wind weht am Abend durch die Stadt.', exampleSentenceArabic: 'نسيم منعش يهب في المساء عبر أرجاء المدينة.', missingLetterWord: 'k_hl', sentence4Elements: ['Im', 'Herbst', 'sind', 'die Nächte schon kühl.'] },
      { id: 'b02_51_07', german: 'eiskalt', arabic: 'شديد البرودة كالثلج', emoji: '🥶', exampleSentenceGerman: 'Meine Zehen sind ganz eiskalt geworden.', exampleSentenceArabic: 'أصابع قدمي أصبحت باردة جداً كالثلج.', missingLetterWord: '_iskalt', sentence4Elements: ['Der', 'Wind', 'weht', 'heute wirklich eiskalt.'] },
      { id: 'b02_51_08', german: 'mild', arabic: 'لطيف / معتدل الحرارة', emoji: '🌾', exampleSentenceGerman: 'Der Winter war dieses Jahr überraschend mild.', exampleSentenceArabic: 'الشتاء هذا العام كان معتدلاً بشكل مفاجئ.', missingLetterWord: 'm_ld', sentence4Elements: ['Das', 'Klima', 'ist', 'hier wunderbar mild.'] },
      { id: 'b02_51_09', german: 'frieren', arabic: 'يتجمد (الماء أو السائل)', emoji: '🧊', exampleSentenceGerman: 'Bei null Grad friert das Wasser zu Eis.', exampleSentenceArabic: 'عند درجة الصفر يتجمد الماء متحولاً لجليد.', missingLetterWord: 'fr_eren', sentence4Elements: ['Wasser', 'friert', 'zu', 'festem klarem Eis.'] },
      { id: 'b02_51_10', german: 'schmelzen', arabic: 'يذوب / ينصهر الثلج', emoji: '💧', exampleSentenceGerman: 'In der Sonne schmilzt der Schneemann schnell.', exampleSentenceArabic: 'تحت أشعة الشمس يذوب رجل الثلج بسرعة.', missingLetterWord: 'schm_lzen', sentence4Elements: ['Der', 'Schnee', 'schmilzt', 'im warmen Frühling.'] }
    ]
  },

  // 52. Weather Clothing: What to Wear (جريد 1 / جريد 2)
  {
    id: 'curric_b02_52_weather_clothes',
    title: 'Kleidung für jedes Wetter',
    titleTranslations: { ar: 'ملابس تناسب كل أحوال الطقس', de: 'Kleidung für jedes Wetter', en: 'Clothes for Every Weather' },
    topic: 'الملابس والطقس',
    topicTranslations: { ar: 'الملابس والطقس', de: 'Wetterkleidung', en: 'Weather Clothing' },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'المعطف والوشاح والحذاء المطاطي وقبعة الشتاء.',
    descriptionTranslations: { ar: 'المعطف والوشاح والحذاء المطاطي وقبعة الشتاء.', de: 'Jacke, Schal, Mütze und Gummistiefel.', en: 'Jackets, scarves, beanies and boots.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_52_01', german: 'die Regenjacke', arabic: 'سترة المطر المقاومة للماء', article: 'die', plural: 'die Regenjacken', emoji: '🧥', exampleSentenceGerman: 'Bei Regen ziehe ich meine gelbe Regenjacke an.', exampleSentenceArabic: 'عند نزول المطر أرتدي سترتي المطرية الصفراء.', missingLetterWord: 'die R_genjacke', sentence4Elements: ['Die', 'Regenjacke', 'hält', 'mich trocken und warm.'] },
      { id: 'b02_52_02', german: 'die Gummistiefel', arabic: 'الحذاء المطاطي المضاد للمطر', article: 'die', plural: 'die Gummistiefel', emoji: '🥾', exampleSentenceGerman: 'Mit Gummistiefeln kann ich durch Pfützen laufen.', exampleSentenceArabic: 'بالحذاء المطاطي أستطيع المشي وسط برك المياه.', missingLetterWord: 'die G_mmistiefel', sentence4Elements: ['Ich', 'habe', 'blaue', 'Gummistiefel an den Füßen.'] },
      { id: 'b02_52_03', german: 'die Wintermütze', arabic: 'قبعة الصوف الشتوية', article: 'die', plural: 'die Wintermützen', emoji: '🧶', exampleSentenceGerman: 'Die warme Wintermütze schützt meine Ohren.', exampleSentenceArabic: 'قبعة الصوف الدافئة تحمي أذني.', missingLetterWord: 'die W_ntermütze', sentence4Elements: ['Zieh', 'deine', 'Mütze', 'auf den Kopf!'] },
      { id: 'b02_52_04', german: 'der Schal', arabic: 'الوشاح (الكوفية)', article: 'der', plural: 'die Schals', emoji: '🧣', exampleSentenceGerman: 'Mama wickelt mir einen roten Schal um den Hals.', exampleSentenceArabic: 'أمي تلف لي وشاحاً أحمر حول عنقي.', missingLetterWord: 'der Sch_l', sentence4Elements: ['Der', 'weiche', 'Schal', 'wärmt meinen Hals.'] },
      { id: 'b02_52_05', german: 'die Handschuhe', arabic: 'القفازات الشتوية', article: 'die', plural: 'die Handschuhe', emoji: '🧤', exampleSentenceGerman: 'Mit warmen Handschuhen forme ich Schneebälle.', exampleSentenceArabic: 'بقفازاتي الدافئة أصنع كرات الثلج.', missingLetterWord: 'die H_ndschuhe', sentence4Elements: ['Handschuhe', 'halten', 'meine', 'Finger schön warm.'] },
      { id: 'b02_52_06', german: 'der Wintermantel', arabic: 'معطف الشتاء الثقيل', article: 'der', plural: 'die Wintermäntel', emoji: '🧥', exampleSentenceGerman: 'Mein Wintermantel hat eine dicke Kapuze.', exampleSentenceArabic: 'معطف الشتاء الخاص بي له غطاء رأس مبطن وسميك.', missingLetterWord: 'der W_ntermantel', sentence4Elements: ['Der', 'Mantel', 'ist', 'warm mit Daunen gefüttert.'] },
      { id: 'b02_52_07', german: 'die Matschhose', arabic: 'سروال الحماية من الطين للأطفال', article: 'die', plural: 'die Matschhosen', emoji: '👖', exampleSentenceGerman: 'Im Kindergarten tragen alle Kinder eine Matschhose.', exampleSentenceArabic: 'في الروضة يرتدي جميع الأطفال سراويل الوقاية من الطين.', missingLetterWord: 'die M_tschhose', sentence4Elements: ['Mit', 'der', 'Matschhose', 'rutsche ich durch den Sand.'] },
      { id: 'b02_52_08', german: 'die Sandalen', arabic: 'الصنادل الصيفية', article: 'die', plural: 'die Sandalen', emoji: '🩴', exampleSentenceGerman: 'Im heißen Sommer trage ich luftige Sandalen.', exampleSentenceArabic: 'في حرارة الصيف أرتدي صنادل خفيفة ومريحة.', missingLetterWord: 'die S_ndalen', sentence4Elements: ['Sandalen', 'sind', 'ideal', 'für warme Sommertage.'] },
      { id: 'b02_52_09', german: 'die Badehose', arabic: 'سروال السباحة (المايوه)', article: 'die', plural: 'die Badehosen', emoji: '🩳', exampleSentenceGerman: 'Ich packe meine Badehose für den Strand ein.', exampleSentenceArabic: 'أحزم شورت السباحة الخاص بي للذهاب إلى الشاطئ.', missingLetterWord: 'die B_dehose', sentence4Elements: ['Meine', 'Badehose', 'trocknet', 'schnell in der Sonne.'] },
      { id: 'b02_52_10', german: 'der Badeanzug', arabic: 'بدلة السباحة للبنات', article: 'der', plural: 'die Badeanzüge', emoji: '🩱', exampleSentenceGerman: 'Lisa hat einen gepunkteten Badeanzug.', exampleSentenceArabic: 'ليزا ترتدي مايوه سباحة منقطاً جميلاً.', missingLetterWord: 'der B_deanzug', sentence4Elements: ['Der', 'Badeanzug', 'ist', 'bunt und fröhlich.'] }
    ]
  },

  // 53. Springtime Nature & Blossoms (جريد 2 / جريد 3)
  {
    id: 'curric_b02_53_spring_blossoms',
    title: 'Frühlingserwachen in der Natur',
    titleTranslations: { ar: 'صحوة الربيع وتفتح الأزهار', de: 'Frühlingserwachen in der Natur', en: 'Spring Awakening' },
    topic: 'فصل الربيع',
    topicTranslations: { ar: 'فصل الربيع', de: 'Frühling', en: 'Spring' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الزهور الأولى وعودة الطيور وتفتح البراعم في الربيع.',
    descriptionTranslations: { ar: 'الزهور الأولى وعودة الطيور وتفتح البراعم.', de: 'Schneeglöckchen, Knospe und Vogelgesang.', en: 'Snowdrops, buds and bird songs.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_53_01', german: 'das Schneeglöckchen', arabic: 'زهرة قطرة الثلج (أول زهرة في الربيع)', article: 'das', plural: 'die Schneeglöckchen', emoji: '🔔', exampleSentenceGerman: 'Das zarte Schneeglöckchen blüht mitten im Schnee.', exampleSentenceArabic: 'زهرة قطرة الثلج الرقيقة تتفتح وسط بقايا الجليد.', missingLetterWord: 'das Schn_eglöckchen', sentence4Elements: ['Das', 'Schneeglöckchen', 'läutet', 'den Frühling ein.'] },
      { id: 'b02_53_02', german: 'die Knospe', arabic: 'البرعم (برعم الشجرة أو الزهرة)', article: 'die', plural: 'die Knospen', emoji: '🌱', exampleSentenceGerman: 'An den Ästen öffnen sich grüne Knospen.', exampleSentenceArabic: 'على الأغصان تتفتح براعم خضراء نضرة.', missingLetterWord: 'die Kn_spe', sentence4Elements: ['Aus', 'der', 'Knospe', 'wird eine schöne Blüte.'] },
      { id: 'b02_53_03', german: 'die Wiese', arabic: 'المرج الأخضر', article: 'die', plural: 'die Wiesen', emoji: '🌿', exampleSentenceGerman: 'Auf der bunten Frühlingswiese summen Bienen.', exampleSentenceArabic: 'في مرج الربيع الملون يطن النحل بسعادة.', missingLetterWord: 'die Wi_se', sentence4Elements: ['Wir', 'laufen', 'barfuß', 'über die grüne Wiese.'] },
      { id: 'b02_53_04', german: 'das Krokus', arabic: 'زهرة الزعفران الربيعي', article: 'das', plural: 'die Krokusse', emoji: '💜', exampleSentenceGerman: 'Lila Krokusse bedecken den ganzen Park.', exampleSentenceArabic: 'أزهار الزعفران البنفسجية تغطي الحديقة بأكملها.', missingLetterWord: 'der Kr_kus', sentence4Elements: ['Bunte', 'Krokusse', 'leuchten', 'nach dem kalten Winter.'] },
      { id: 'b02_53_05', german: 'die Narzisse', arabic: 'زهرة النرجس الصفراء', article: 'die', plural: 'die Narzissen', emoji: '🌼', exampleSentenceGerman: 'Gelbe Narzissen blühen an Ostern.', exampleSentenceArabic: 'أزهار النرجس الصفراء تتفتح في عيد الفصح.', missingLetterWord: 'die N_rzisse', sentence4Elements: ['Gelbe', 'Narzissen', 'strahlen', 'im warmen Garten.'] },
      { id: 'b02_53_06', german: 'zwitschern', arabic: 'تزقزق / تغرد الطيور', emoji: '🎶', exampleSentenceGerman: 'Die Vögel zwitschern fröhlich am Morgen.', exampleSentenceArabic: 'الطيور تزقزق بمرح في الصباح الباكر.', missingLetterWord: 'zw_tschern', sentence4Elements: ['Vögel', 'zwitschern', 'fröhliche', 'Lieder im grünen Baum.'] },
      { id: 'b02_53_07', german: 'das Frühlingswetter', arabic: 'طقس الربيع العليل', article: 'das', plural: 'die Frühlingswetter', emoji: '🌤️', exampleSentenceGerman: 'Das Frühlingswetter lockt uns alle nach draußen.', exampleSentenceArabic: 'طقس الربيع العليل يجذبنا جميعاً إلى الهواء الطلق.', missingLetterWord: 'das Fr_hlingswetter', sentence4Elements: ['Wir', 'genießen', 'das', 'schöne milde Frühlingswetter.'] },
      { id: 'b02_53_08', german: 'der Marienkäfer', arabic: 'الدعسوقة الحمراء', article: 'der', plural: 'die Marienkäfer', emoji: '🐞', exampleSentenceGerman: 'Der Marienkäfer krabbelt auf meiner Hand.', exampleSentenceArabic: 'الدعسوقة تزحف برفق على راحة يدي.', missingLetterWord: 'der Mar_enkäfer', sentence4Elements: ['Der', 'Marienkäfer', 'breitet', 'seine roten Flügel aus.'] },
      { id: 'b02_53_09', german: 'aufwachen', arabic: 'يستيقظ من النوم الشتوي', emoji: '🥱', exampleSentenceGerman: 'Die Tiere wachen aus dem Winterschlaf auf.', exampleSentenceArabic: 'الحيوانات تستيقظ من سباتها الشتوي.', missingLetterWord: 'a_fwachen', sentence4Elements: ['Die', 'Natur', 'wacht', 'im Frühling wieder auf.'] },
      { id: 'b02_53_10', german: 'der Schmetterling', arabic: 'الفراشة الجميلة', article: 'der', plural: 'die Schmetterlinge', emoji: '🦋', exampleSentenceGerman: 'Der bunte Schmetterling nascht süßen Blütennektar.', exampleSentenceArabic: 'الفراشة الملونة ترتشف رحيق الأزهار العذب.', missingLetterWord: 'der Schm_tterling', sentence4Elements: ['Ein', 'Schmetterling', 'fliegt', 'lautlos durch die Luft.'] }
    ]
  },

  // 54. Autumn Winds & Fallen Leaves (جريد 2 / جريد 3)
  {
    id: 'curric_b02_54_autumn_winds',
    title: 'Herbstwind und Drachensteigen',
    titleTranslations: { ar: 'رياح الخريف وإطلاق الطائرات الورقية', de: 'Herbstwind und Drachensteigen', en: 'Autumn Winds & Kites' },
    topic: 'فصل الخريف',
    topicTranslations: { ar: 'فصل الخريف', de: 'Herbstzeit', en: 'Autumn Season' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'أوراق الشجر المتساقطة وثمار البلوط والكستناء والطائرات الورقية.',
    descriptionTranslations: { ar: 'أوراق الشجر المتساقطة وثمار البلوط والكستناء.', de: 'Drachen, Kastanie, Eichel und bunte Blätter.', en: 'Kites, chestnuts, acorns and fallen leaves.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_54_01', german: 'der Drachen', arabic: 'الطائرة الورقية', article: 'der', plural: 'die Drachen', emoji: '🪁', exampleSentenceGerman: 'Mein bunter Drachen fliegt hoch im Herbstwind.', exampleSentenceArabic: 'طائرتي الورقية الملونة تحلق عالياً في رياح الخريف.', missingLetterWord: 'der Dr_chen', sentence4Elements: ['Wir', 'lassen', 'den', 'Drachen am Hügel steigen.'] },
      { id: 'b02_54_02', german: 'die Kastanie', arabic: 'الكستناء (أبو فروة)', article: 'die', plural: 'die Kastanien', emoji: '🌰', exampleSentenceGerman: 'Wir basteln lustige Männchen aus Kastanien.', exampleSentenceArabic: 'نصنع مجسمات ورجالاً مرحين من حبات الكستناء.', missingLetterWord: 'die K_stanie', sentence4Elements: ['Ich', 'sammle', 'glatte', 'braune Kastanien im Park.'] },
      { id: 'b02_54_03', german: 'die Eichel', arabic: 'ثمرة البلوط', article: 'die', plural: 'die Eicheln', emoji: '🌰', exampleSentenceGerman: 'Das Eichhörnchen versteckt eine Eichel im Moos.', exampleSentenceArabic: 'السنجاب يخفي ثمرة بلوط تحت الطحالب.', missingLetterWord: 'die _ichel', sentence4Elements: ['Unter', 'der', 'Eiche', 'liegen unzählige Eicheln.'] },
      { id: 'b02_54_04', german: 'der Laubhaufen', arabic: 'كومة أوراق الشجر المتساقطة', article: 'der', plural: 'die Laubhaufen', emoji: '🍂', exampleSentenceGerman: 'Mit Anlauf springe ich in den Laubhaufen!', exampleSentenceArabic: 'أركض وأقفز ببهجة في كومة أوراق الشجر الجافة!', missingLetterWord: 'der L_ubhaufen', sentence4Elements: ['Ein', 'Igel', 'schläft', 'im dicken Laubhaufen.'] },
      { id: 'b02_54_05', german: 'rascheln', arabic: 'تحف / تحدث حفيفاً (أوراق الشجر)', emoji: '🍁', exampleSentenceGerman: 'Die trockenen Blätter rascheln unter den Füßen.', exampleSentenceArabic: 'أوراق الشجر الجافة تحدث حفيفاً تحت الأقدام.', missingLetterWord: 'r_scheln', sentence4Elements: ['Blätter', 'rascheln', 'leise', 'bei jedem unserer Schritte.'] },
      { id: 'b02_54_06', german: 'der Nebel', arabic: 'الضباب', article: 'der', plural: 'die Nebel', emoji: '🌫️', exampleSentenceGerman: 'Dichter Nebel verhüllt die Wiesen am Morgen.', exampleSentenceArabic: 'ضباب كثيف يغلف المروج في ساعات الصباح.', missingLetterWord: 'der N_bel', sentence4Elements: ['Der', 'Nebel', 'löst', 'sich mittags langsam auf.'] },
      { id: 'b02_54_07', german: 'die Ernte', arabic: 'الحصاد / جني الثمار', article: 'die', plural: 'die Ernten', emoji: '🌾', exampleSentenceGerman: 'Im Herbst feiern wir ein fröhliches Erntedankfest.', exampleSentenceArabic: 'في الخريف نحتفل بعيد شكر الحصاد المبهج.', missingLetterWord: 'die _rnte', sentence4Elements: ['Die', 'Bauern', 'bringen', 'die reiche Ernte ein.'] },
      { id: 'b02_54_08', german: 'der Kürbis', arabic: 'اليقطين (القرع)', article: 'der', plural: 'die Kürbisse', emoji: '🎃', exampleSentenceGerman: 'Wir schnitzen ein lustiges Gesicht in den Kürbis.', exampleSentenceArabic: 'ننحت وجهاً ضاحكاً ومضحكاً على ثمرة اليقطين.', missingLetterWord: 'der K_rbis', sentence4Elements: ['Aus', 'dem', 'Kürbis', 'kochen wir leckere Suppe.'] },
      { id: 'b02_54_09', german: 'fallen', arabic: 'يسقط / يتساقط', emoji: '🍃', exampleSentenceGerman: 'Gelbe und rote Blätter fallen lautlos ab.', exampleSentenceArabic: 'الأوراق الصفراء والحمراء تتساقط دون ضجيج.', missingLetterWord: 'f_llen', sentence4Elements: ['Die', 'bunten', 'Blätter', 'fallen von den Zweigen.'] },
      { id: 'b02_54_10', german: 'der Windstoß', arabic: 'هبة ريح قوية', article: 'der', plural: 'die Windstöße', emoji: '💨', exampleSentenceGerman: 'Ein kräftiger Windstoß weht mir die Mütze weg.', exampleSentenceArabic: 'هبة ريح مفاجئة طيرت قبعتي من فوق رأسي.', missingLetterWord: 'der W_ndstoß', sentence4Elements: ['Der', 'Windstoß', 'wirbelt', 'das bunte Laub hoch.'] }
    ]
  },

  // 55. Natural Materials: Wood, Stone, Water (جريد 2 / جريد 3)
  {
    id: 'curric_b02_55_natural_materials',
    title: 'Materialien aus der Natur',
    titleTranslations: { ar: 'المواد الخام من الطبيعة', de: 'Materialien aus der Natur', en: 'Natural Materials' },
    topic: 'المواد الطبيعية',
    topicTranslations: { ar: 'المواد الطبيعية', de: 'Naturmaterialien', en: 'Natural Materials' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الخشب والحجر والماء والرمل والطين والصوف.',
    descriptionTranslations: { ar: 'الخشب والحجر والماء والرمل والطين والصوف.', de: 'Holz, Stein, Sand, Ton und Wolle.', en: 'Wood, stone, sand, clay and wool.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_55_01', german: 'das Holz', arabic: 'الخشب', article: 'das', plural: 'die Hölzer', emoji: '🪵', exampleSentenceGerman: 'Unser Esstisch ist aus festem Holz gefertigt.', exampleSentenceArabic: 'طاولة طعامنا مصنوعة من خشب متين.', missingLetterWord: 'das H_lz', sentence4Elements: ['Aus', 'Holz', 'bauen', 'wir ein stabiles Vogelhaus.'] },
      { id: 'b02_55_02', german: 'der Stein', arabic: 'الحجر / الصخرة', article: 'der', plural: 'die Steine', emoji: '🪨', exampleSentenceGerman: 'Ich sammle glatte Kieselsteine am Fluss.', exampleSentenceArabic: 'أجمع حصى ملساء عند ضفة النهر.', missingLetterWord: 'der St_in', sentence4Elements: ['Der', 'schwere', 'Stein', 'liegt fest im Gras.'] },
      { id: 'b02_55_03', german: 'der Sand', arabic: 'الرمل', article: 'der', plural: 'die Sande', emoji: '🏖️', exampleSentenceGerman: 'Der feine Sand am Strand fühlt sich warm an.', exampleSentenceArabic: 'الرمل الناعم على الشاطئ دافئ الملمس.', missingLetterWord: 'der S_nd', sentence4Elements: ['Kinder', 'bauen', 'hohe', 'Türme aus feinem Sand.'] },
      { id: 'b02_55_04', german: 'die Erde', arabic: 'التراب / التربة الزراعية', article: 'die', plural: 'die Erden', emoji: '🪴', exampleSentenceGerman: 'Pflanzen brauchen gute Erde und frisches Wasser.', exampleSentenceArabic: 'النباتات تحتاج لتربة خصبة وماء عذب.', missingLetterWord: 'die _rde', sentence4Elements: ['In', 'der', 'Erde', 'wachsen kräftige Wurzeln heran.'] },
      { id: 'b02_55_05', german: 'das Wasser', arabic: 'الماء', article: 'das', plural: 'die Wässer', emoji: '💧', exampleSentenceGerman: 'Klares Wasser ist das gesündeste Getränk.', exampleSentenceArabic: 'الماء النقي هو أكثر المشروبات فائدة وصحة.', missingLetterWord: 'das W_sser', sentence4Elements: ['Wasser', 'ist', 'lebenswichtig', 'für alle Tiere hier.'] },
      { id: 'b02_55_06', german: 'die Wolle', arabic: 'الصوف', article: 'die', plural: 'die Wollen', emoji: '🧶', exampleSentenceGerman: 'Aus Schafwolle strickt Oma einen warmen Pullover.', exampleSentenceArabic: 'من صوف الغنم تحيك جدتي سترة دافئة.', missingLetterWord: 'die W_lle', sentence4Elements: ['Wolle', 'hält', 'uns', 'im kalten Winter warm.'] },
      { id: 'b02_55_07', german: 'das Leder', arabic: 'الجلد الطبيعي', article: 'das', plural: 'die Leder', emoji: '👞', exampleSentenceGerman: 'Meine festen Wanderschuhe sind aus echtem Leder.', exampleSentenceArabic: 'أحذية المشي المتينة الخاصة بي مصنوعة من جلد طبيعي.', missingLetterWord: 'das L_der', sentence4Elements: ['Leder', 'ist', 'besonders', 'haltbar und robust gemacht.'] },
      { id: 'b02_55_08', german: 'das Metall', arabic: 'المعدن / الحديد', article: 'das', plural: 'die Metalle', emoji: '🪙', exampleSentenceGerman: 'Die Schaukelkette ist aus glänzendem Metall.', exampleSentenceArabic: 'سلسلة الأرجوحة مصنوعة من معدن لامع.', missingLetterWord: 'das Met_ll', sentence4Elements: ['Metall', 'ist', 'sehr', 'stabil und extrem fest.'] },
      { id: 'b02_55_09', german: 'das Glas', arabic: 'الزجاج النقي', article: 'das', plural: 'die Gläser', emoji: '🪟', exampleSentenceGerman: 'Vorsicht, Glas kann leicht zerbrechen!', exampleSentenceArabic: 'احترس، الزجاج يمكن أن ينكسر بسهولة!', missingLetterWord: 'das Gl_s', sentence4Elements: ['Das', 'Fensterglas', 'lässt', 'helles Licht herein.'] },
      { id: 'b02_55_10', german: 'der Ton', arabic: 'الصلصال الفخاري / الطين', article: 'der', plural: 'die Tone', emoji: '🏺', exampleSentenceGerman: 'Aus feuchtem Ton formen wir schöne Schalen.', exampleSentenceArabic: 'من الطين الفخاري الرطب نشكل أواني وأطباقاً جميلة.', missingLetterWord: 'der T_n', sentence4Elements: ['Der', 'Töpfer', 'formt', 'Vasen aus weichem Ton.'] }
    ]
  },

  // 56. Jungle & Rain Forest Animals (جريد 3 / جريد 4)
  {
    id: 'curric_b02_56_jungle_rainforest',
    title: 'Im Dschungel und Regenwald',
    titleTranslations: { ar: 'في الأدغال والغابات الاستوائية', de: 'Im Dschungel und Regenwald', en: 'In the Jungle & Rainforest' },
    topic: 'الأدغال الاستوائية',
    topicTranslations: { ar: 'الأدغال الاستوائية', de: 'Dschungelwelt', en: 'Jungle' },
    grade: 'جريد 3',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'حيوانات الغابات المطيرة: اليغور والغوريلا والطوقان والكوالا.',
    descriptionTranslations: { ar: 'اليغور والغوريلا والطوقان والكسلان.', de: 'Jaguar, Gorilla, Tukan und Faultier.', en: 'Jaguars, gorillas, toucans and sloths.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_56_01', german: 'der Dschungel', arabic: 'الدغل / الغابة الاستوائية الكثيفة', article: 'der', plural: 'die Dschungel', emoji: '🌴', exampleSentenceGerman: 'Im Dschungel leben unzählige bunte Tierarten.', exampleSentenceArabic: 'في الأدغال تعيش كائنات ملونة لا حصر لها.', missingLetterWord: 'der Dsch_ngel', sentence4Elements: ['Der', 'Regenwald', 'ist', 'grün, feucht und warm.'] },
      { id: 'b02_56_02', german: 'der Gorilla', arabic: 'الغوريلا', article: 'der', plural: 'die Gorillas', emoji: '🦍', exampleSentenceGerman: 'Der starke Gorilla schützt seine Familie im Dickicht.', exampleSentenceArabic: 'الغوريلا القوي يحمي عائلته في الأحراش الكثيفة.', missingLetterWord: 'der Gor_lla', sentence4Elements: ['Der', 'Gorilla', 'ist', 'ein sehr kräftiges Tier.'] },
      { id: 'b02_56_03', german: 'der Jaguar', arabic: 'اليغور (الفهد الأمريكي)', article: 'der', plural: 'die Jaguare', emoji: '🐆', exampleSentenceGerman: 'Der Jaguar schleicht geräuschlos durch das Unterholz.', exampleSentenceArabic: 'اليغور يتسلل بلا أدنى صوت بين الشجيرات الاستوائية.', missingLetterWord: 'der J_guar', sentence4Elements: ['Der', 'Jaguar', 'kann', 'ausgezeichnet im Fluss schwimmen.'] },
      { id: 'b02_56_04', german: 'der Tukan', arabic: 'طائر الطوقان', article: 'der', plural: 'die Tukane', emoji: '🦜', exampleSentenceGerman: 'Der Tukan hat einen riesigen, farbenprächtigen Schnabel.', exampleSentenceArabic: 'طائر الطوقان لديه منقار ضخم وبديع الألوان.', missingLetterWord: 'der T_kan', sentence4Elements: ['Der', 'Tukan', 'sitzt', 'hoch im grünen Baumkronendach.'] },
      { id: 'b02_56_05', german: 'das Faultier', arabic: 'الكسلان (حيوان)', article: 'das', plural: 'die Faultiere', emoji: '🦥', exampleSentenceGerman: 'Das gemütliche Faultier hängt kopfüber am Ast.', exampleSentenceArabic: 'حيوان الكسلان الهادئ يتدلى رأساً على عقب من الغصن.', missingLetterWord: 'das F_ultier', sentence4Elements: ['Das', 'Faultier', 'bewegt', 'sich herrlich gemütlich langsam.'] },
      { id: 'b02_56_06', german: 'das Chamäleon', arabic: 'الحرباء المتلونة', article: 'das', plural: 'die Chamäleons', emoji: '🦎', exampleSentenceGerman: 'Mit ihrer langen Schleuderzunge fängt die Echse Insekten.', exampleSentenceArabic: 'بلسانها المقذوف الطويل تصطاد السحلية الحشرات.', missingLetterWord: 'das Cham_leon', sentence4Elements: ['Das', 'Chamäleon', 'sieht', 'mit seinen Augen überallhin.'] },
      { id: 'b02_56_07', german: 'die Baumschlange', arabic: 'ثعبان الأشجار الخضراء (البواء)', article: 'die', plural: 'die Baumschlangen', emoji: '🐍', exampleSentenceGerman: 'Die grüne Schlange ringelt sich um die Liane.', exampleSentenceArabic: 'الثعبان الأخضر يلتف حول حبال المتسلقات.', missingLetterWord: 'die B_umschlange', sentence4Elements: ['Die', 'Schlange', 'ist', 'perfekt im Laub getarnt.'] },
      { id: 'b02_56_08', german: 'die Liane', arabic: 'حبل نباتي متسلق (الليانا)', article: 'die', plural: 'die Lianen', emoji: '🌿', exampleSentenceGerman: 'Affen schwingen geschickt von Liane zu Liane.', exampleSentenceArabic: 'القرود تتأرجح بمهارة من حبل نباتي لآخر.', missingLetterWord: 'die Li_ne', sentence4Elements: ['Lange', 'Lianen', 'hängen', 'von den Urwaldriesen herab.'] },
      { id: 'b02_56_09', german: 'der Pfeilgiftfrosch', arabic: 'ضفدع السهم السام الملون', article: 'der', plural: 'die Pfeilgiftfrösche', emoji: '🐸', exampleSentenceGerman: 'Der winzige Frosch leuchtet blau und warnt Feinde.', exampleSentenceArabic: 'الضفدع الضئيل يتوهج بلون أزرق محذراً الأعداء.', missingLetterWord: 'der Pf_ilgiftfrosch', sentence4Elements: ['Der', 'Frosch', 'ist', 'klein, aber extrem giftig.'] },
      { id: 'b02_56_10', german: 'der Koala', arabic: 'الكوالا اللطيف', article: 'der', plural: 'die Koalas', emoji: '🐨', exampleSentenceGerman: 'Der verschlafene Koala frisst frische Eukalyptusblätter.', exampleSentenceArabic: 'الكوالا النعسان يأكل أوراق الكافور الطازجة.', missingLetterWord: 'der K_ala', sentence4Elements: ['Der', 'Koala', 'schläft', 'den ganzen Tag friedlich.'] }
    ]
  },

  // 57. Polar & Cold World Animals (جريد 2 / جريد 3)
  {
    id: 'curric_b02_57_polar_animals',
    title: 'Tiere im ewigen Eis',
    titleTranslations: { ar: 'حيوانات المناطق القطبية والجليد', de: 'Tiere im ewigen Eis', en: 'Polar Animals' },
    topic: 'الحيوانات القطبية',
    topicTranslations: { ar: 'الحيوانات القطبية', de: 'Polartiere', en: 'Polar Wildlife' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الدب القطبي والبطريق والفقمة والرنة في الثلوج.',
    descriptionTranslations: { ar: 'الدب القطبي والبطريق والفقمة والرنة في الثلوج.', de: 'Eisbär, Pinguin, Walross und Rentier.', en: 'Polar bears, penguins, walruses and reindeers.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_57_01', german: 'der Eisbär', arabic: 'الدب القطبي الأبيض', article: 'der', plural: 'die Eisbären', emoji: '🐻‍❄️', exampleSentenceGerman: 'Der weiße Eisbär schwimmt im eiskalten Nordmeer.', exampleSentenceArabic: 'الدب القطبي الأبيض يسبح في مياه بحر الشمال المتجمدة.', missingLetterWord: 'der _isbär', sentence4Elements: ['Der', 'Eisbär', 'hat', 'ein dichtes warmes Fell.'] },
      { id: 'b02_57_02', german: 'der Pinguin', arabic: 'البطريق الإمبراطوري', article: 'der', plural: 'die Pinguine', emoji: '🐧', exampleSentenceGerman: 'Kaiserpinguine trotzen tapfer der Kälte der Antarktis.', exampleSentenceArabic: 'بطاريق الإمبراطور تتحدى برد القطب الجنوبي بشجاعة.', missingLetterWord: 'der P_nguin', sentence4Elements: ['Pinguine', 'kuscheln', 'sich', 'eng aneinander zum Schutz.'] },
      { id: 'b02_57_03', german: 'das Walross', arabic: 'الفظ (حصان البحر ذو الأنياب)', article: 'das', plural: 'die Walrosse', emoji: '🦭', exampleSentenceGerman: 'Das Walross hat zwei lange weiße Stoßzähne.', exampleSentenceArabic: 'حيوان الفظ يمتلك نابين طويلين باللون الأبيض.', missingLetterWord: 'das W_lross', sentence4Elements: ['Das', 'Walross', 'liegt', 'gemütlich auf der Eisscholle.'] },
      { id: 'b02_57_04', german: 'die Robbe', arabic: 'فقمة الجليد', article: 'die', plural: 'die Robben', emoji: '🦭', exampleSentenceGerman: 'Die kleine Robbe hat große, dunkle Kulleraugen.', exampleSentenceArabic: 'صغير الفقمة لديه عينان واسعتان ودائريتان.', missingLetterWord: 'die R_bbe', sentence4Elements: ['Robben', 'gleiten', 'mühelos', 'durch das eisige Wasser.'] },
      { id: 'b02_57_05', german: 'das Rentier', arabic: 'حيوان الرنة (إلك)', article: 'das', plural: 'die Rentiere', emoji: '🦌', exampleSentenceGerman: 'Das Rentier zieht den Schlitten durch den Tiefschnee.', exampleSentenceArabic: 'حيوان الرنة يسحب الزلاجة عبر الثلوج العميقة.', missingLetterWord: 'das R_ntier', sentence4Elements: ['Rentiere', 'haben', 'ein', 'großes prächtiges Geweih.'] },
      { id: 'b02_57_06', german: 'der Polarfuchs', arabic: 'الثعلب القطبي', article: 'der', plural: 'die Polarfüchse', emoji: '🦊', exampleSentenceGerman: 'Im Winter wechselt der Polarfuchs sein Fell zu Weiß.', exampleSentenceArabic: 'في الشتاء يتحول لون فرو الثعلب القطبي إلى الأبيض.', missingLetterWord: 'der Pol_rfuchs', sentence4Elements: ['Der', 'Polarfuchs', 'ist', 'im Schnee kaum sichtbar.'] },
      { id: 'b02_57_07', german: 'die Schnee-Eule', arabic: 'بومة الثلج البيضاء', article: 'die', plural: 'die Schnee-Eulen', emoji: '🦉', exampleSentenceGerman: 'Die weiße Schnee-Eule jagt lautlos über der Tundra.', exampleSentenceArabic: 'بومة الثلج البيضاء تصطاد بهدوء فوق سهول التندرا.', missingLetterWord: 'die Schn_e-Eule', sentence4Elements: ['Ihre', 'gelben', 'Augen', 'leuchten hell im Schnee.'] },
      { id: 'b02_57_08', german: 'der Schneehase', arabic: 'أرنب الجليد (الأرنب القطبي)', article: 'der', plural: 'die Schneehasen', emoji: '🐇', exampleSentenceGerman: 'Der Schneehase hoppelt flink über die Eisflächen.', exampleSentenceArabic: 'أرنب الجليد يقفز بسرعة وخفة فوق المسطحات المتجمدة.', missingLetterWord: 'der Schn_ehase', sentence4Elements: ['Große', 'Pfoten', 'tragen', 'ihn sicher über Schnee.'] },
      { id: 'b02_57_09', german: 'der Orca', arabic: 'الحوت القاتل (الأوركا)', article: 'der', plural: 'die Orcas', emoji: '🐋', exampleSentenceGerman: 'Der schwarz-weiße Orca springt hoch aus dem Meer.', exampleSentenceArabic: 'حوت الأوركا بالأبيض والأسود يقفز عالياً من البحر.', missingLetterWord: 'der _rca', sentence4Elements: ['Orcas', 'jagen', 'gemeinsam', 'im kalten Ozean geschickt.'] },
      { id: 'b02_57_10', german: 'die Eisscholle', arabic: 'الكتلة الجليدية العائمة', article: 'die', plural: 'die Eisschollen', emoji: '🧊', exampleSentenceGerman: 'Tiere ruhen sich auf der treibenden Eisscholle aus.', exampleSentenceArabic: 'تستريح الحيوانات على طوف الجليد العائم.', missingLetterWord: 'die _isscholle', sentence4Elements: ['Die', 'Eisscholle', 'treibt', 'langsam über das Meer.'] }
    ]
  },

  // 58. Farm Life & Plants: Countryside (جريد 2 / جريد 3)
  {
    id: 'curric_b02_58_country_farm_life',
    title: 'Das Leben auf dem Bauernhof',
    titleTranslations: { ar: 'الحياة في المزرعة والريف', de: 'Das Leben auf dem Bauernhof', en: 'Life on the Farm' },
    topic: 'المزرعة والريف',
    topicTranslations: { ar: 'المزرعة والريف', de: 'Landleben', en: 'Country Life' },
    grade: 'جريد 2',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الجرار والمزرعة والحقل والحبوب والقش والحصان.',
    descriptionTranslations: { ar: 'الجرار والمزرعة والحقل والحبوب والقش.', de: 'Traktor, Feld, Stroh und Bauernhof.', en: 'Tractors, fields, straw and farms.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_58_01', german: 'der Bauernhof', arabic: 'المزرعة / الضيعة', article: 'der', plural: 'die Bauernhöfe', emoji: '🚜', exampleSentenceGerman: 'Wir verbringen unsere Sommerferien auf dem Bauernhof.', exampleSentenceArabic: 'نقضي عطلتنا الصيفية في المزرعة الريفية.', missingLetterWord: 'der B_uernhof', sentence4Elements: ['Auf', 'dem', 'Bauernhof', 'gibt es viele Tiere.'] },
      { id: 'b02_58_02', german: 'der Bauer', arabic: 'المزارع / الفلاح', article: 'der', plural: 'die Bauern', emoji: '👨‍🌾', exampleSentenceGerman: 'Der Bauer füttert morgens früh alle Kühe.', exampleSentenceArabic: 'المزارع يطعم جميع الأبقار في الصباح الباكر.', missingLetterWord: 'der B_uer', sentence4Elements: ['Der', 'fleißige', 'Bauer', 'arbeitet auf dem Feld.'] },
      { id: 'b02_58_03', german: 'die Bäuerin', arabic: 'المزارعة / الفلاحة', article: 'die', plural: 'die Bäuerinnen', emoji: '👩‍🌾', exampleSentenceGerman: 'Die Bäuerin backt frisches Brot und macht Käse.', exampleSentenceArabic: 'المزارعة تخبز خبزاً طازجاً وتصنع الجبن اللذيذ.', missingLetterWord: 'die B_uerin', sentence4Elements: ['Die', 'Bäuerin', 'erntet', 'rotes Gemüse im Garten.'] },
      { id: 'b02_58_04', german: 'der Traktor', arabic: 'الجرار الزراعي', article: 'der', plural: 'die Traktoren', emoji: '🚜', exampleSentenceGerman: 'Der grüne Traktor fährt laut über den Acker.', exampleSentenceArabic: 'الجرار الأخضر يسير بصوت هدير فوق الحقل الزراعي.', missingLetterWord: 'der Tr_ktor', sentence4Elements: ['Der', 'Traktor', 'zieht', 'den schweren Pflug mit.'] },
      { id: 'b02_58_05', german: 'das Feld', arabic: 'الحقل / الغيط', article: 'das', plural: 'die Felder', emoji: '🌾', exampleSentenceGerman: 'Auf dem weiten Feld wächst goldener Weizen.', exampleSentenceArabic: 'على امتداد الحقل الشاسع ينبت القمح الذهبي.', missingLetterWord: 'das F_ld', sentence4Elements: ['Das', 'Feld', 'leuchtet', 'golden in der Sonne.'] },
      { id: 'b02_58_06', german: 'das Stroh', arabic: 'القش المجفف', article: 'das', plural: 'die Strohe', emoji: '🌾', exampleSentenceGerman: 'Die Kälbchen liegen gemütlich auf frischem Stroh.', exampleSentenceArabic: 'العجول الصغيرة ترقد بارتياح فوق قش نظيف.', missingLetterWord: 'das Str_h', sentence4Elements: ['Gelbes', 'Stroh', 'riecht', 'angenehm nach Sommerzeit.'] },
      { id: 'b02_58_07', german: 'das Heu', arabic: 'التبن / العشب المجفف كعلف', article: 'das', plural: 'die Heue', emoji: '🌾', exampleSentenceGerman: 'Pferde fressen im Winter trockenes Heu.', exampleSentenceArabic: 'الخيول تأكل التبن المجفف في الشتاء.', missingLetterWord: 'das H_u', sentence4Elements: ['Auf', 'dem', 'Dachboden', 'lagert das duftende Heu.'] },
      { id: 'b02_58_08', german: 'die Scheune', arabic: 'الحظيرة الكبيرة / مخزن الغلال', article: 'die', plural: 'die Scheunen', emoji: '🛖', exampleSentenceGerman: 'In der großen Scheune steht der Mähdrescher.', exampleSentenceArabic: 'في الحظيرة الكبيرة تقف الحصادة الضخمة.', missingLetterWord: 'die Sch_une', sentence4Elements: ['Die', 'Scheune', 'ist', 'voll mit Heuballen gefüllt.'] },
      { id: 'b02_58_09', german: 'die Weide', arabic: 'المرعى / حقل الرعي', article: 'die', plural: 'die Weiden', emoji: '🐄', exampleSentenceGerman: 'Die Kühe grasen den ganzen Nachmittag auf der Weide.', exampleSentenceArabic: 'ترعى الأبقار طوال فترة الظهيرة في المرعى الأخضر.', missingLetterWord: 'die W_ide', sentence4Elements: ['Ein', 'weißer', 'Zaun', 'umgibt die grüne Weide.'] },
      { id: 'b02_58_10', german: 'das Getreide', arabic: 'الحبوب (القمح والشعير والذرة)', article: 'das', plural: 'die Getreide', emoji: '🌾', exampleSentenceGerman: 'Aus reifem Getreide mahlt die Mühle Mehl.', exampleSentenceArabic: 'من الحبوب الناضجة تطحن المطحنة الدقيق.', missingLetterWord: 'das Getr_ide', sentence4Elements: ['Das', 'Getreide', 'wird', 'im Spätsommer reif geerntet.'] }
    ]
  },

  // 59. Plants: Fruits on Trees & Berries in the Bush (جريد 1 / جريد 2)
  {
    id: 'curric_b02_59_berries_bushes',
    title: 'Beeren und Sträucher im Garten',
    titleTranslations: { ar: 'التوت والشجيرات في الحديقة', de: 'Beeren und Sträucher im Garten', en: 'Berries and Bushes' },
    topic: 'النباتات والثمار',
    topicTranslations: { ar: 'النباتات والثمار', de: 'Beeren & Früchte', en: 'Berries & Bushes' },
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الفراولة والتوت والكرز والعنب والشجيرات للأطفال.',
    descriptionTranslations: { ar: 'الفراولة والتوت والكرز والعنب والشجيرات.', de: 'Erdbeere, Himbeere und Brombeere.', en: 'Strawberries, raspberries and blackberries.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_59_01', german: 'die Erdbeere', arabic: 'الفراولة', article: 'die', plural: 'die Erdbeeren', emoji: '🍓', exampleSentenceGerman: 'Die rote Erdbeere ist zuckersüß und frisch.', exampleSentenceArabic: 'حبة الفراولة الحمراء حلوة كالسكر وطازجة.', missingLetterWord: 'die _rdbeere', sentence4Elements: ['Ich', 'pflücke', 'eine', 'reife rote Erdbeere gerne.'] },
      { id: 'b02_59_02', german: 'die Himbeere', arabic: 'توت العليق الأحمر (الرازبيري)', article: 'die', plural: 'die Himbeeren', emoji: '🫐', exampleSentenceGerman: 'Am dornigen Strauch wachsen weiche Himbeeren.', exampleSentenceArabic: 'على الشجيرة الشوكية ينمو توت العليق الطري.', missingLetterWord: 'die H_mbeere', sentence4Elements: ['Himbeeren', 'schmecken', 'im', 'Sommer besonders köstlich.'] },
      { id: 'b02_59_03', german: 'die Heidelbeere', arabic: 'التوت البري الأزرق (البلو بيري)', article: 'die', plural: 'die Heidelbeeren', emoji: '🫐', exampleSentenceGerman: 'Blaue Heidelbeeren färben die Zunge dunkel.', exampleSentenceArabic: 'التوت الأزرق يصبغ اللسان بلون داكن.', missingLetterWord: 'die H_idelbeere', sentence4Elements: ['Im', 'Wald', 'pflücken', 'wir frische Heidelbeeren zusammen.'] },
      { id: 'b02_59_04', german: 'die Brombeere', arabic: 'التوت الأسود (البلاك بيري)', article: 'die', plural: 'die Brombeeren', emoji: '🫐', exampleSentenceGerman: 'Die schwarze Brombeere ist saftig und süß.', exampleSentenceArabic: 'التوت الأسود ممتلئ بالعصير ولذيذ المذاق.', missingLetterWord: 'die Br_mbeere', sentence4Elements: ['Schwarze', 'Brombeeren', 'reifen', 'an der Gartenhecke heran.'] },
      { id: 'b02_59_05', german: 'die Kirsche', arabic: 'حبة الكرز', article: 'die', plural: 'die Kirschen', emoji: '🍒', exampleSentenceGerman: 'Zwei rote Kirschen hängen wie Ohrringe am Zweig.', exampleSentenceArabic: 'حبتا كرز حمراوان تتدليان كالأقراط من الغصن.', missingLetterWord: 'die K_rsche', sentence4Elements: ['Ich', 'pflücke', 'süße', 'rote Kirschen vom Baum.'] },
      { id: 'b02_59_06', german: 'die Weintraube', arabic: 'عنقود العنب', article: 'die', plural: 'die Weintrauben', emoji: '🍇', exampleSentenceGerman: 'Die grünen Weintrauben haben keine Kerne.', exampleSentenceArabic: 'عناقيد العنب الأخضر بدون بذور.', missingLetterWord: 'die W_intraube', sentence4Elements: ['Weintrauben', 'hängen', 'schwer', 'an den Weinstöcken.'] },
      { id: 'b02_59_07', german: 'der Busch', arabic: 'الشجيرة (الأجمة الصغيرة)', article: 'der', plural: 'die Büsche', emoji: '🌳', exampleSentenceGerman: 'Ein kleiner Igel versteckt sich unter dem Busch.', exampleSentenceArabic: 'قنفذ صغير يختبئ تحت الشجيرة الكثيفة.', missingLetterWord: 'der B_sch', sentence4Elements: ['Der', 'grüne', 'Busch', 'blüht im Frühsommer herrlich.'] },
      { id: 'b02_59_08', german: 'die Hecke', arabic: 'السياج النباتي (الشجيرات المشذبة)', article: 'die', plural: 'die Hecken', emoji: '🌲', exampleSentenceGerman: 'Vögel bauen ihre Nester gern in der dichten Hecke.', exampleSentenceArabic: 'تبني الطيور أعشاشها بأمان في السياج النباتي الكثيف.', missingLetterWord: 'die H_cke', sentence4Elements: ['Opa', 'schneidet', 'die', 'Hecke im Garten ordentlich.'] },
      { id: 'b02_59_09', german: 'pflücken', arabic: 'يقطف الثمار أو الزهور', emoji: '🧺', exampleSentenceGerman: 'Wir pflücken einen Korb voll reifer Früchte.', exampleSentenceArabic: 'نقطف سلة كاملة من الثمار اليانعة.', missingLetterWord: 'pfl_cken', sentence4Elements: ['Kinder', 'pflücken', 'gerne', 'süße Beeren im Wald.'] },
      { id: 'b02_59_10', german: 'süß', arabic: 'حلو المذاق / سكري', emoji: '🍬', exampleSentenceGerman: 'Die Beeren sind reif und wunderbar süß.', exampleSentenceArabic: 'التوت ناضج وحلو المذاق بشكل رائع.', missingLetterWord: 's_ß', sentence4Elements: ['Diese', 'Frucht', 'ist', 'unglaublich saftig und süß.'] }
    ]
  },

  // 60. Wonders of the Sky: Sun, Moon & Stars (روضة / جريد 1)
  {
    id: 'curric_b02_60_sky_stars_planets',
    title: 'Wunder am Himmel',
    titleTranslations: { ar: 'عجائب السماء والنجوم والقمر', de: 'Wunder am Himmel', en: 'Wonders of the Sky' },
    topic: 'السماء والفضاء',
    topicTranslations: { ar: 'السماء والفضاء', de: 'Himmel & Sterne', en: 'Sky & Stars' },
    grade: 'روضة وأطفال',
    level: 'A1',
    difficulty: 'easy',
    hasArticles: true,
    sentenceBuilderSupported: true,
    description: 'الشمس والقمر والنجوم والسحب وقوس قزح للطفل.',
    descriptionTranslations: { ar: 'الشمس والقمر والنجوم والسحب وقوس قزح للطفل.', de: 'Sonne, Mond, Sterne und Wolken.', en: 'Sun, moon, stars and clouds for children.' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'b02_60_01', german: 'die Sonne', arabic: 'الشمس المضيئة', article: 'die', plural: 'die Sonnen', emoji: '☀️', exampleSentenceGerman: 'Die Sonne weckt die Welt mit warmem Licht.', exampleSentenceArabic: 'الشمس توقظ العالم بضيائها الدافئ.', missingLetterWord: 'die S_nne', sentence4Elements: ['Die', 'helle', 'Sonne', 'steht hoch am Himmel.'] },
      { id: 'b02_60_02', german: 'der Mond', arabic: 'القمر المنير', article: 'der', plural: 'die Monde', emoji: '🌙', exampleSentenceGerman: 'Der runde Vollmond leuchtet silbern in der Nacht.', exampleSentenceArabic: 'البدر المستدير يضيء بفضة ناصعة في الليل.', missingLetterWord: 'der M_nd', sentence4Elements: ['Der', 'Mond', 'scheint', 'sanft in mein Zimmer.'] },
      { id: 'b02_60_03', german: 'der Stern', arabic: 'النجم الساطع', article: 'der', plural: 'die Sterne', emoji: '⭐', exampleSentenceGerman: 'Ich wünsche mir etwas bei einer Sternschnuppe.', exampleSentenceArabic: 'أتمنى أمنية عند رؤية شهاب متساقط.', missingLetterWord: 'der St_rn', sentence4Elements: ['Millionen', 'Sterne', 'funkeln', 'am dunklen Nachthimmel.'] },
      { id: 'b02_60_04', german: 'der Vollmond', arabic: 'البدر المكتمل', article: 'der', plural: 'die Vollmonde', emoji: '🌕', exampleSentenceGerman: 'Heute Nacht ist ein wunderschöner Vollmond zu sehen.', exampleSentenceArabic: 'الليلة يمكن رؤية بدر مكتمل في غاية الجمال.', missingLetterWord: 'der V_llmond', sentence4Elements: ['Der', 'Vollmond', 'ist', 'rund wie ein Teller.'] },
      { id: 'b02_60_05', german: 'die Mondsichel', arabic: 'الهلال (هلال القمر)', article: 'die', plural: 'die Mondsicheln', emoji: '🌙', exampleSentenceGerman: 'Die zarte Mondsichel sieht aus wie eine Wiege.', exampleSentenceArabic: 'الهلال الرقيق يشبه مهداً في السماء.', missingLetterWord: 'die M_ndsichel', sentence4Elements: ['Eine', 'feine', 'Mondsichel', 'steht am Abendhimmel.'] },
      { id: 'b02_60_06', german: 'der Sonnenaufgang', arabic: 'شروق الشمس', article: 'der', plural: 'die Sonnenaufgänge', emoji: '🌅', exampleSentenceGerman: 'Der Sonnenaufgang malt den Himmel rosa und rot.', exampleSentenceArabic: 'شروق الشمس يلون أفق السماء بالوردي والأحمر.', missingLetterWord: 'der S_nnenaufgang', sentence4Elements: ['Wir', 'beobachten', 'früh', 'den wunderschönen Sonnenaufgang.'] },
      { id: 'b02_60_07', german: 'der Sonnenuntergang', arabic: 'غروب الشمس', article: 'der', plural: 'die Sonnenuntergänge', emoji: '🌇', exampleSentenceGerman: 'Beim Sonnenuntergang sinkt die Sonne hinter die Berge.', exampleSentenceArabic: 'عند الغروب تهبط الشمس خلف قمم الجبال.', missingLetterWord: 'der S_nnenuntergang', sentence4Elements: ['Der', 'Himmel', 'glüht', 'beim abendlichen Sonnenuntergang.'] },
      { id: 'b02_60_08', german: 'der Planet', arabic: 'الكوكب', article: 'der', plural: 'die Planeten', emoji: '🪐', exampleSentenceGerman: 'Die Erde ist unser wunderschöner blauer Planet.', exampleSentenceArabic: 'كوكب الأرض هو كوكبنا الأزرق البديع.', missingLetterWord: 'der Plan_t', sentence4Elements: ['Acht', 'Planeten', 'kreisen', 'um die heiße Sonne.'] },
      { id: 'b02_60_09', german: 'die Sternschnuppe', arabic: 'الشهاب (النجم الساقط)', article: 'die', plural: 'die Sternschnuppen', emoji: '🌠', exampleSentenceGerman: 'Schau mal, eine blitzschnelle Sternschnuppe!', exampleSentenceArabic: 'انظر سريعاً، شهاب لامع يمر بسرعة البرق!', missingLetterWord: 'die St_rnschnuppe', sentence4Elements: ['Ich', 'habe', 'eine', 'leuchtende Sternschnuppe gesehen.'] },
      { id: 'b02_60_10', german: 'funkeln', arabic: 'يتلألأ / يلمع ببريق', emoji: '✨', exampleSentenceGerman: 'Kleine Sterne funkeln wie Diamanten am Firmament.', exampleSentenceArabic: 'النجوم الصغيرة تتلألأ كالماس في قبة السماء.', missingLetterWord: 'f_nkeln', sentence4Elements: ['Die', 'Sterne', 'funkeln', 'hell in finsterer Nacht.'] }
    ]
  }
];
