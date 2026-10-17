export interface RawBatchSet {
  id: string;
  title: string;
  titleTranslation?: string;
  gradeLevel?: string;
  category?: string;
  description?: string;
  emoji?: string;
  items: Array<{
    id: string;
    german: string;
    arabic: string;
    article?: 'der' | 'die' | 'das';
    plural?: string;
    emoji?: string;
    exampleSentenceGerman?: string;
    exampleSentenceArabic?: string;
  }>;
}

export const BATCH_09_SETS: RawBatchSet[] = [
  // 241. Basic Opposites 1 (روضة / جريد 1)
  {
    id: 'curric_b09_241_basic_opposites_1',
    title: 'Wichtige Gegenteile 1: Groß und Klein',
    titleTranslation: 'المتضادات الأساسية 1: كبير وصغير',
    gradeLevel: 'preschool',
    category: 'Adjektive & Beschreibungen',
    description: 'الأضداد الشائعة البسيطة في حياة الطفل اليومية (كبير/صغير، سريع/بطيء...)',
    emoji: '⚖️',
    items: [
      { id: 'b09_241_01', german: 'groß', arabic: 'كبير', emoji: '🐘', exampleSentenceGerman: 'Der Elefant ist sehr groß.', exampleSentenceArabic: 'الفيل كبير جداً.' },
      { id: 'b09_241_02', german: 'klein', arabic: 'صغير', emoji: '🐭', exampleSentenceGerman: 'Die Maus ist ganz klein.', exampleSentenceArabic: 'الفأر صغير تماماً.' },
      { id: 'b09_241_03', german: 'schnell', arabic: 'سريع', emoji: '🐆', exampleSentenceGerman: 'Der Gepard rennt sehr schnell.', exampleSentenceArabic: 'الفهد يركض بسرعة فائقة.' },
      { id: 'b09_241_04', german: 'langsam', arabic: 'بطيء', emoji: '🐢', exampleSentenceGerman: 'Die Schildkröte kriecht langsam.', exampleSentenceArabic: 'السلحفاة تزحف ببطء.' },
      { id: 'b09_241_05', german: 'laut', arabic: 'عالٍ / صاخب', emoji: '📢', exampleSentenceGerman: 'Die Trommel ist sehr laut.', exampleSentenceArabic: 'الطبل صوته عالٍ جداً.' },
      { id: 'b09_241_06', german: 'leise', arabic: 'هادئ / خافت', emoji: '🤫', exampleSentenceGerman: 'Bitte sei im Lesezimmer leise.', exampleSentenceArabic: 'من فضلك كن هادئاً في غرفة القراءة.' },
      { id: 'b09_241_07', german: 'stark', arabic: 'قوي', emoji: '💪', exampleSentenceGerman: 'Der Bär ist riesig und stark.', exampleSentenceArabic: 'الدب ضخم وقوي.' },
      { id: 'b09_241_08', german: 'schwach', arabic: 'ضعيف', emoji: '🪶', exampleSentenceGerman: 'Das kleine Küken ist noch schwach.', exampleSentenceArabic: 'الكتكوت الصغير ما زال ضعيفاً.' },
      { id: 'b09_241_09', german: 'hell', arabic: 'مضيء / فاتح', emoji: '☀️', exampleSentenceGerman: 'Am Tag ist der Himmel hell.', exampleSentenceArabic: 'في النهار تكون السماء مضيئة.' },
      { id: 'b09_241_10', german: 'dunkel', arabic: 'مظلم / داكن', emoji: '🌑', exampleSentenceGerman: 'In der Höhle ist es stockdunkel.', exampleSentenceArabic: 'في الكهف الظلام حالك.' }
    ]
  },

  // 242. Basic Opposites 2 (جريد 1)
  {
    id: 'curric_b09_242_basic_opposites_2',
    title: 'Wichtige Gegenteile 2: Heiß und Kalt',
    titleTranslation: 'المتضادات الأساسية 2: حار وبارد وحالات الأشياء',
    gradeLevel: 'grade1',
    category: 'Adjektive & Beschreibungen',
    description: 'صفات الملمس ودرجة الحرارة والحالة المادية اليومية للأشياء',
    emoji: '🌡️',
    items: [
      { id: 'b09_242_01', german: 'heiß', arabic: 'ساخن جداً', emoji: '🔥', exampleSentenceGerman: 'Vorsicht, der Tee ist heiß!', exampleSentenceArabic: 'احذر، الشاي ساخن جداً!' },
      { id: 'b09_242_02', german: 'kalt', arabic: 'بارد', emoji: '🧊', exampleSentenceGerman: 'Das Eis schmeckt herrlich kalt.', exampleSentenceArabic: 'الآيس كريم طعمه بارد ولذيذ.' },
      { id: 'b09_242_03', german: 'warm', arabic: 'دافئ', emoji: '🧣', exampleSentenceGerman: 'Meine Mütze hält mich schön warm.', exampleSentenceArabic: 'قبعتي تبقيني دافئاً بشكل مريح.' },
      { id: 'b09_242_04', german: 'kühl', arabic: 'منعش / بارد قليلاً', emoji: '🍃', exampleSentenceGerman: 'Am Abend weht ein kühler Wind.', exampleSentenceArabic: 'في المساء تهب رياح منعشة خفيفة.' },
      { id: 'b09_242_05', german: 'hart', arabic: 'صلب / قاسٍ', emoji: '🪨', exampleSentenceGerman: 'Der Stein auf dem Pfad ist hart.', exampleSentenceArabic: 'الحجر على المسار صلب.' },
      { id: 'b09_242_06', german: 'weich', arabic: 'ناعم / طري', emoji: '🧸', exampleSentenceGerman: 'Mein Teddybär ist kuschelig weich.', exampleSentenceArabic: 'دبي القماشي طري ولطيف للمعانقة.' },
      { id: 'b09_242_07', german: 'nass', arabic: 'مبلل / رطب', emoji: '💧', exampleSentenceGerman: 'Nach dem Platzregen bin ich nass.', exampleSentenceArabic: 'بعد المطر الغزير أصبحت مبتلاً.' },
      { id: 'b09_242_08', german: 'trocken', arabic: 'جاف', emoji: '🏜️', exampleSentenceGerman: 'Das Handtuch ist ganz trocken.', exampleSentenceArabic: 'المنشفة جافة تماماً.' },
      { id: 'b09_242_09', german: 'schwer', arabic: 'ثقيل', emoji: '🏋️', exampleSentenceGerman: 'Der Reisekoffer ist ziemlich schwer.', exampleSentenceArabic: 'حقيبة السفر ثقيلة إلى حد ما.' },
      { id: 'b09_242_10', german: 'leicht', arabic: 'خفيف', emoji: '🎈', exampleSentenceGerman: 'Der Luftballon ist federleicht.', exampleSentenceArabic: 'البالون خفيف مثل الريشة.' }
    ]
  },

  // 243. Describing Dimensions & Quantities (جريد 2)
  {
    id: 'curric_b09_243_dimensions_quantities',
    title: 'Maße und Mengen beschreiben',
    titleTranslation: 'وصف الأبعاد والأحجام والكميات',
    gradeLevel: 'grade2',
    category: 'Adjektive & Beschreibungen',
    description: 'صفات الطول والعرض والعمق والامتلاء والفراغ بدقة',
    emoji: '📐',
    items: [
      { id: 'b09_243_01', german: 'lang', arabic: 'طويل', emoji: '📏', exampleSentenceGerman: 'Die Giraffe hat einen langen Hals.', exampleSentenceArabic: 'للزرافة عنق طويل.' },
      { id: 'b09_243_02', german: 'kurz', arabic: 'قصير', emoji: '✂️', exampleSentenceGerman: 'Mein Bleistift ist nach dem Spitzen kurz.', exampleSentenceArabic: 'قلمي الرصاص أصبح قصيراً بعد بريه.' },
      { id: 'b09_243_03', german: 'breit', arabic: 'عريض / متسع', emoji: '↔️', exampleSentenceGerman: 'Die Brücke über den Fluss ist breit.', exampleSentenceArabic: 'الجسر فوق النهر عريض.' },
      { id: 'b09_243_04', german: 'schmal', arabic: 'ضيق / رفيع', emoji: '↕️', exampleSentenceGerman: 'Der Waldweg ist recht schmal.', exampleSentenceArabic: 'ممر الغابة ضيق نوعاً ما.' },
      { id: 'b09_243_05', german: 'hoch', arabic: 'مرتفع / شاهق', emoji: '🏔️', exampleSentenceGerman: 'Der Berggipfel ragt hoch hinauf.', exampleSentenceArabic: 'قمة الجبل ترتفع عالياً.' },
      { id: 'b09_243_06', german: 'tief', arabic: 'عميق / منخفض', emoji: '🌊', exampleSentenceGerman: 'Der Ozean ist an manchen Stellen tief.', exampleSentenceArabic: 'المحيط عميق في بعض الأماكن.' },
      { id: 'b09_243_07', german: 'voll', arabic: 'ممتلئ', emoji: '🥛', exampleSentenceGerman: 'Das Glas Milch ist randvoll.', exampleSentenceArabic: 'كوب الحليب ممتلئ حتى الحافة.' },
      { id: 'b09_243_08', german: 'leer', arabic: 'فارغ', emoji: '🫙', exampleSentenceGerman: 'Der Honigtopf ist schon leer.', exampleSentenceArabic: 'وعاء العسل فارغ بالفعل.' },
      { id: 'b09_243_09', german: 'dick', arabic: 'سميك / بدين', emoji: '📖', exampleSentenceGerman: 'Das Märchenbuch ist sehr dick.', exampleSentenceArabic: 'كتاب القصص سميك جداً.' },
      { id: 'b09_243_10', german: 'dünn', arabic: 'رقيق / نحيف', emoji: '📄', exampleSentenceGerman: 'Das Zeichenpapier ist fein und dünn.', exampleSentenceArabic: 'ورق الرسم ناعم ورقيق.' }
    ]
  },

  // 244. Sensory & Taste Adjectives (جريد 2)
  {
    id: 'curric_b09_244_sensory_taste',
    title: 'Geschmack und Sinneswahrnehmung',
    titleTranslation: 'المذاق والحواس: وصف الأطعمة والروائح',
    gradeLevel: 'grade2',
    category: 'Adjektive & Beschreibungen',
    description: 'صفات الطعم اللذيذ والحامض والمر والروائح والقوام الحسي',
    emoji: '👅',
    items: [
      { id: 'b09_244_01', german: 'süß', arabic: 'حلو المذاق', emoji: '🍭', exampleSentenceGerman: 'Die Erdbeere schmeckt wunderbar süß.', exampleSentenceArabic: 'الفراولة طعمها حلو ورائع.' },
      { id: 'b09_244_02', german: 'sauer', arabic: 'حامض', emoji: '🍋', exampleSentenceGerman: 'Die Zitrone ist sauer und zieht den Mund zusammen.', exampleSentenceArabic: 'الليمونة حامضة وتجعلك تعقد فمك.' },
      { id: 'b09_244_03', german: 'salzig', arabic: 'مالح', emoji: '🥨', exampleSentenceGerman: 'Die Salzbrezel schmeckt herrlich salzig.', exampleSentenceArabic: 'البريتزل المخبوز مالح ولذيذ.' },
      { id: 'b09_244_04', german: 'bitter', arabic: 'مر', emoji: '🍫', exampleSentenceGerman: 'Dunkle Schokolade schmeckt manchmal bitter.', exampleSentenceArabic: 'الشوكولاتة الداكنة طعمها مر أحياناً.' },
      { id: 'b09_244_05', german: 'scharf', arabic: 'حار (فلفل) / حاد', emoji: '🌶️', exampleSentenceGerman: 'Die Chilischote ist zu scharf für mich.', exampleSentenceArabic: 'قرن الفلفل الحار حار جداً بالنسبة لي.' },
      { id: 'b09_244_06', german: 'knusprig', arabic: 'مقرمش', emoji: '🥖', exampleSentenceGerman: 'Die Brotrinde ist ofenfrisch knusprig.', exampleSentenceArabic: 'قشرة الخبز مقرمشة وطازجة من الفرن.' },
      { id: 'b09_244_07', german: 'saftig', arabic: 'مليء بالعصير / ريان', emoji: '🍊', exampleSentenceGerman: 'Die Apfelsine ist herrlich saftig.', exampleSentenceArabic: 'البرتقالة مليئة بالعصير اللذيذ.' },
      { id: 'b09_244_08', german: 'lecker', arabic: 'شهي / لذيذ', emoji: '😋', exampleSentenceGerman: 'Der Schokokuchen schmeckt köstlich lecker.', exampleSentenceArabic: 'كعكة الشوكولاتة لذيذة للغاية.' },
      { id: 'b09_244_09', german: 'duftend', arabic: 'عطر / فواح الرائحة', emoji: '🌸', exampleSentenceGerman: 'Die Rose blüht im Garten duftend.', exampleSentenceArabic: 'الوردة تتفتح في الحديقة برائحة فواحة.' },
      { id: 'b09_244_10', german: 'frisch', arabic: 'طازج', emoji: '🥗', exampleSentenceGerman: 'Der Salat ist knackig und frisch.', exampleSentenceArabic: 'السلطة طازجة ومقرمشة.' }
    ]
  },

  // 245. Surface & Texture (جريد 3)
  {
    id: 'curric_b09_245_surface_texture',
    title: 'Oberflächen und Haptik',
    titleTranslation: 'الأسطح والملمس الفيزيائي للأشياء',
    gradeLevel: 'grade3',
    category: 'Adjektive & Beschreibungen',
    description: 'صفات الملمس الدقيقة كالأملس والخشن واللزج والمشوك واللامع',
    emoji: '🖐️',
    items: [
      { id: 'b09_245_01', german: 'glatt', arabic: 'أملس / ناعم السطح', emoji: '🧊', exampleSentenceGerman: 'Die Eisfläche auf dem See ist spiegelglatt.', exampleSentenceArabic: 'سطح الجليد على البحيرة أملس كالمرآة.' },
      { id: 'b09_245_02', german: 'rau', arabic: 'خشن الملمس', emoji: '🪵', exampleSentenceGerman: 'Die Baumrinde fühlt sich rau an.', exampleSentenceArabic: 'لحاء الشجرة ملمسه خشن.' },
      { id: 'b09_245_03', german: 'klebrig', arabic: 'لزج / لاصق', emoji: '🍯', exampleSentenceGerman: 'Meine Finger sind vom Honig ganz klebrig.', exampleSentenceArabic: 'أصابعي أصبحت لزجة من العسل.' },
      { id: 'b09_245_04', german: 'stachelig', arabic: 'شائك / ذو أشواك', emoji: '🦔', exampleSentenceGerman: 'Der Igel hat ein stacheliges Kleid.', exampleSentenceArabic: 'القنفذ له غطاء شائك يحميه.' },
      { id: 'b09_245_05', german: 'flauschig', arabic: 'زغبي / كثيف النعومة', emoji: '🐇', exampleSentenceGerman: 'Das Hasenfell ist flauschig und weich.', exampleSentenceArabic: 'فرو الأرنب زغبي وناعم جداً.' },
      { id: 'b09_245_06', german: 'rutschig', arabic: 'منزلق / زلق', emoji: '⚠️', exampleSentenceGerman: 'Vorsicht, der nasse Boden ist rutschig!', exampleSentenceArabic: 'انتبه، الأرضية المبللة زلقة!' },
      { id: 'b09_245_07', german: 'glänzend', arabic: 'لامع / براق', emoji: '✨', exampleSentenceGerman: 'Die Goldmünze ist sauber und glänzend.', exampleSentenceArabic: 'العملة الذهبية نظيفة وبراقة.' },
      { id: 'b09_245_08', german: 'matt', arabic: 'غير لامع / باهت اللمعان', emoji: '🪙', exampleSentenceGerman: 'Die alte Kiste hat eine matte Oberfläche.', exampleSentenceArabic: 'الصندوق القديم له سطح غير لامع.' },
      { id: 'b09_245_09', german: 'biegsam', arabic: 'مرن / قابل للثني', emoji: '🎋', exampleSentenceGerman: 'Der Weidenzweig ist elastisch und biegsam.', exampleSentenceArabic: 'غصن الصفصاف مرن وقابل للثني.' },
      { id: 'b09_245_10', german: 'zerbrechlich', arabic: 'قابل للكسر / هش', emoji: '🏺', exampleSentenceGerman: 'Die Glasvase ist sehr zerbrechlich.', exampleSentenceArabic: 'المزهرية الزجاجية هشة وسريعة الكسر.' }
    ]
  },

  // 246. Character & Personality Traits (جريد 3 / 4)
  {
    id: 'curric_b09_246_character_traits',
    title: 'Charaktereigenschaften von Kindern',
    titleTranslation: 'سمات الشخصية والطباع عند الأطفال',
    gradeLevel: 'grade3',
    category: 'Adjektive & Beschreibungen',
    description: 'صفات الطباع الأخلاقية والسلوكية كالصدق والشجاعة واللطف والصبر',
    emoji: '🌟',
    items: [
      { id: 'b09_246_01', german: 'freundlich', arabic: 'ودود / لطيف', emoji: '😊', exampleSentenceGerman: 'Der neue Schüler ist zu allen freundlich.', exampleSentenceArabic: 'التلميذ الجديد ودود مع الجميع.' },
      { id: 'b09_246_02', german: 'mutig', arabic: 'شجاع / جسور', emoji: '🦁', exampleSentenceGerman: 'Das mutige Mädchen springt vom Einmeterbrett.', exampleSentenceArabic: 'الفتاة الشجاعة تقفز من منصة المتر الواحد.' },
      { id: 'b09_246_03', german: 'ehrlich', arabic: 'صادق / مخلص', emoji: '🤝', exampleSentenceGerman: 'Ein guter Freund sagt immer ehrlich die Wahrheit.', exampleSentenceArabic: 'الصديق الصدوق يقول الحقيقة بصدق دائماً.' },
      { id: 'b09_246_04', german: 'hilfsbereit', arabic: 'متعاون / محب للمساعدة', emoji: '🤲', exampleSentenceGerman: 'Leo ist hilfsbereit und trägt meine Tasche.', exampleSentenceArabic: 'ليو خدوم ومستعد للمساعدة ويحمل حقيبتي.' },
      { id: 'b09_246_05', german: 'geduldig', arabic: 'صبور', emoji: '⏳', exampleSentenceGerman: 'Beim Puzzeln muss man geduldig sein.', exampleSentenceArabic: 'عند حل الأحجيات يجب أن يكون المرء صبوراً.' },
      { id: 'b09_246_06', german: 'höflich', arabic: 'مهذب / مؤدب', emoji: '🙇', exampleSentenceGerman: 'Sie bedankt sich immer sehr höflich.', exampleSentenceArabic: 'هي تشكر الناس بأدب جم دائماً.' },
      { id: 'b09_246_07', german: 'fleißig', arabic: 'مجتهد / مثابر', emoji: '🐝', exampleSentenceGerman: 'Die fleißigen Bienen sammeln Nektar.', exampleSentenceArabic: 'النحل المجتهد يجمع الرحيق بدأب.' },
      { id: 'b09_246_08', german: 'kreativ', arabic: 'مبدع / مبتكر', emoji: '🎨', exampleSentenceGerman: 'Beim Basteln hat sie viele kreative Ideen.', exampleSentenceArabic: 'في الأشغال اليدوية لديها أفكار مبدعة كثيرة.' },
      { id: 'b09_246_09', german: 'neugierig', arabic: 'فضولي / محب للاستكشاف', emoji: '🔍', exampleSentenceGerman: 'Kinder sind neugierig auf die ganze Welt.', exampleSentenceArabic: 'الأطفال فضوليون لاستكشاف العالم بأسره.' },
      { id: 'b09_246_10', german: 'zuverlässig', arabic: 'جدير بالثقة / يعتمد عليه', emoji: '🛡️', exampleSentenceGerman: 'Mein bester Freund ist absolut zuverlässig.', exampleSentenceArabic: 'صديقي المفضل شخص موثوق تماماً ويُعتمد عليه.' }
    ]
  },

  // 247. Order, Cleanliness & Condition (جريد 2 / 3)
  {
    id: 'curric_b09_247_condition_cleanliness',
    title: 'Zustand, Sauberkeit und Ordnung',
    titleTranslation: 'الحالة والنظافة والترتيب',
    gradeLevel: 'grade2',
    category: 'Adjektive & Beschreibungen',
    description: 'صفات النظافة والاتساخ والجدة والقدم والترتيب والفوضى',
    emoji: '🧼',
    items: [
      { id: 'b09_247_01', german: 'sauber', arabic: 'نظيف', emoji: '✨', exampleSentenceGerman: 'Mein Zimmer ist blitzblank und sauber.', exampleSentenceArabic: 'غرفتي لامعة ونظيفة تماماً.' },
      { id: 'b09_247_02', german: 'schmutzig', arabic: 'متسخ', emoji: '🐾', exampleSentenceGerman: 'Nach dem Spielplatz sind meine Schuhe schmutzig.', exampleSentenceArabic: 'بعد الملعب أصبحت أحذيتي متسخة.' },
      { id: 'b09_247_03', german: 'ordentlich', arabic: 'مرتب / منظم', emoji: '📚', exampleSentenceGerman: 'Die Bücher stehen ordentlich im Regal.', exampleSentenceArabic: 'الكتب موضوعة بنظام وترتيب على الرف.' },
      { id: 'b09_247_04', german: 'unordentlich', arabic: 'فوضوي / مبعثر', emoji: '🌪️', exampleSentenceGerman: 'Auf dem Schreibtisch sieht es unordentlich aus.', exampleSentenceArabic: 'يبدو المكتب غير مرتب وتملأه الفوضى.' },
      { id: 'b09_247_05', german: 'neu', arabic: 'جديد', emoji: '🎁', exampleSentenceGerman: 'Ich habe ein neues Fahrrad zum Geburtstag bekommen.', exampleSentenceArabic: 'حصلت على دراجة جديدة بمناسبة عيد ميلادي.' },
      { id: 'b09_247_06', german: 'alt', arabic: 'قديم', emoji: '🕰️', exampleSentenceGerman: 'Die alte Standuhr tickt gemütlich.', exampleSentenceArabic: 'ساعة الحائط القديمة تدق في هدوء.' },
      { id: 'b09_247_07', german: 'ganz', arabic: 'سليم / كامل وغير مكسور', emoji: '🏺', exampleSentenceGerman: 'Die Schüssel ist heil und ganz geblieben.', exampleSentenceArabic: 'الوعاء ظل سليماً وكاملاً دون كسر.' },
      { id: 'b09_247_08', german: 'kaputt', arabic: 'معطل / مكسور', emoji: '🔨', exampleSentenceGerman: 'Mein Spielzeugauto ist leider kaputt gegangen.', exampleSentenceArabic: 'للأسف انكسرت سيارتي اللعبة وتعطلت.' },
      { id: 'b09_247_09', german: 'bequem', arabic: 'مريح', emoji: '🛋️', exampleSentenceGerman: 'Der Sessel im Wohnzimmer ist super bequem.', exampleSentenceArabic: 'الكرسي ذو الذراعين في الصالون مريح للغاية.' },
      { id: 'b09_247_10', german: 'gemütlich', arabic: 'دافئ ومريح للأعصاب / حميم', emoji: '☕', exampleSentenceGerman: 'In der Leseecke ist es herrlich gemütlich.', exampleSentenceArabic: 'في ركن القراءة الجو دافئ ومريح للنفس.' }
    ]
  },

  // 248. Difficulty, Truth & Value (جريد 3 / 4)
  {
    id: 'curric_b09_248_difficulty_truth_value',
    title: 'Schwierigkeit, Wahrheit und Wert',
    titleTranslation: 'الصعوبة والسهولة والصواب والخطأ والقيمة',
    gradeLevel: 'grade3',
    category: 'Adjektive & Beschreibungen',
    description: 'صفات التقييم الدراسي والمنطقي (سهل/صعب، صحيح/خطأ، مهم/بسيط)',
    emoji: '🎯',
    items: [
      { id: 'b09_248_01', german: 'einfach', arabic: 'بسيط / سهل', emoji: '🧩', exampleSentenceGerman: 'Diese Rechenaufgabe ist ganz einfach.', exampleSentenceArabic: 'مسألة الحساب هذه بسيطة جداً.' },
      { id: 'b09_248_02', german: 'schwierig', arabic: 'صعب / معقد', emoji: '🤔', exampleSentenceGerman: 'Das Rätsel ist knifflig und schwierig.', exampleSentenceArabic: 'اللغز محير وصعب إلى حد ما.' },
      { id: 'b09_248_03', german: 'richtig', arabic: 'صحيح / صائب', emoji: '✅', exampleSentenceGerman: 'Deine Antwort ist vollkommen richtig!', exampleSentenceArabic: 'إجابتك صحيحة تماماً وبلا أخطاء!' },
      { id: 'b09_248_04', german: 'falsch', arabic: 'خاطئ / غير صحيح', emoji: '❌', exampleSentenceGerman: 'Keine Sorge, aus falschen Antworten lernen wir.', exampleSentenceArabic: 'لا تقلق، فمن الإجابات الخاطئة نتعلم.' },
      { id: 'b09_248_05', german: 'wichtig', arabic: 'مهم / ضروري', emoji: '⭐', exampleSentenceGerman: 'Zähneputzen vor dem Schlafen ist wichtig.', exampleSentenceArabic: 'تنظيف الأسنان قبل النوم أمر في غاية الأهمية.' },
      { id: 'b09_248_06', german: 'interessant', arabic: 'ممتع / مثير للاهتمام', emoji: '🔬', exampleSentenceGerman: 'Das Sachbuch über Planeten ist interessant.', exampleSentenceArabic: 'الكتاب العلمي عن الكواكب شيق ومثير للاهتمام.' },
      { id: 'b09_248_07', german: 'langweilig', arabic: 'ممل', emoji: '🥱', exampleSentenceGerman: 'Warten im Regen ist manchmal langweilig.', exampleSentenceArabic: 'الانتظار تحت المطر أمر ممل أحياناً.' },
      { id: 'b09_248_08', german: 'gefährlich', arabic: 'خطير', emoji: '⚠️', exampleSentenceGerman: 'Über die rote Ampel zu laufen ist gefährlich.', exampleSentenceArabic: 'عبور إشارة المرور الحمراء أمر خطير.' },
      { id: 'b09_248_09', german: 'sicher', arabic: 'آمن / مطمئن', emoji: '🦺', exampleSentenceGerman: 'Auf dem Bürgersteig bist du sicher.', exampleSentenceArabic: 'على رصيف المشاة أنت في أمان.' },
      { id: 'b09_248_10', german: 'wertvoll', arabic: 'قيم / ثمين', emoji: '💎', exampleSentenceGerman: 'Wahre Freundschaft ist unendlich wertvoll.', exampleSentenceArabic: 'الصداقة الحقيقية كنز ثمين لا يقدر بثمن.' }
    ]
  },

  // 249. Colors & Visual Nuances (جريد 2 / 3)
  {
    id: 'curric_b09_249_visual_nuances',
    title: 'Farbtöne und visuelle Beschreibungen',
    titleTranslation: 'درجات الألوان والتفاصيل البصرية المتقدمة',
    gradeLevel: 'grade2',
    category: 'Adjektive & Beschreibungen',
    description: 'درجات الألوان والظلال مثل الذهبي، الفضي، الشفاف، والقزحي',
    emoji: '🎨',
    items: [
      { id: 'b09_249_01', german: 'golden', arabic: 'ذهبي اللون', emoji: '👑', exampleSentenceGerman: 'Die Krone des Königs funkelt golden.', exampleSentenceArabic: 'تاج الملك يلمع بلون ذهبي أخاذ.' },
      { id: 'b09_249_02', german: 'silbern', arabic: 'فضي اللون', emoji: '🥈', exampleSentenceGerman: 'Der Mond hat einen silbernen Schein.', exampleSentenceArabic: 'للقمر بريق فضي ساحر.' },
      { id: 'b09_249_03', german: 'durchsichtig', arabic: 'شفاف', emoji: '🪟', exampleSentenceGerman: 'Das Fensterglas ist klar und durchsichtig.', exampleSentenceArabic: 'زجاج النافذة نقي وشفاف.' },
      { id: 'b09_249_04', german: 'bunt', arabic: 'ملون / متعدد الألوان', emoji: '🌈', exampleSentenceGerman: 'Der Regenbogen am Himmel ist herrlich bunt.', exampleSentenceArabic: 'قوس قزح في السماء ملون بألوان زاهية بديعة.' },
      { id: 'b09_249_05', german: 'dunkelblau', arabic: 'أزرق داكن / كحلي', emoji: '🌌', exampleSentenceGerman: 'Der Nachthimmel leuchtet in tiefem Dunkelblau.', exampleSentenceArabic: 'سماء الليل تضيء باللون الأزرق الداكن العميق.' },
      { id: 'b09_249_06', german: 'hellgrün', arabic: 'أخضر فاتح', emoji: '🌱', exampleSentenceGerman: 'Die ersten Frühlingsblätter sind zart hellgrün.', exampleSentenceArabic: 'أوراق الربيع الأولى لونها أخضر فاتح ناعم.' },
      { id: 'b09_249_07', german: 'rosa', arabic: 'وردي / بمبي', emoji: '🦩', exampleSentenceGerman: 'Der Flamingo hat schöne rosa Federn.', exampleSentenceArabic: 'طائر النحام له ريش وردي جميل.' },
      { id: 'b09_249_08', german: 'türkis', arabic: 'تركوازي / فيروزي', emoji: '🪸', exampleSentenceGerman: 'Das Meerwasser an der Bucht schimmert türkis.', exampleSentenceArabic: 'مياه البحر عند الخليج تلمع بلون تركوازي رائع.' },
      { id: 'b09_249_09', german: 'violett', arabic: 'بنفسجي', emoji: '🍇', exampleSentenceGerman: 'Die süßen Pflaumen sind tief violett.', exampleSentenceArabic: 'حبات البرقوق الحلوة ذات لون بنفسجي غامق.' },
      { id: 'b09_249_10', german: 'gestreift', arabic: 'مخطط', emoji: '🦓', exampleSentenceGerman: 'Das Zebra hat ein schwarz-weiß gestreiftes Fell.', exampleSentenceArabic: 'الحمار الوحشي جلده مخطط بالأبيض والأسود.' }
    ]
  },

  // 250. Patterns & Geometrical Qualities (جريد 3 / 4)
  {
    id: 'curric_b09_250_patterns_qualities',
    title: 'Muster und geometrische Eigenschaften',
    titleTranslation: 'الأنماط والخواص الهندسية للأشكال',
    gradeLevel: 'grade3',
    category: 'Adjektive & Beschreibungen',
    description: 'الأشكال والأنماط مثل منقط، مربع، مستدير، مستقيم، ومنحنٍ',
    emoji: '💠',
    items: [
      { id: 'b09_250_01', german: 'rund', arabic: 'دائري / مستدير', emoji: '⚽', exampleSentenceGerman: 'Der Fußball ist vollkommen rund.', exampleSentenceArabic: 'كرة القدم مستديرة تماماً.' },
      { id: 'b09_250_02', german: 'eckig', arabic: 'ذو زوايا / مربع الحواف', emoji: '📦', exampleSentenceGerman: 'Das Paket hat eine eckige Schachtelform.', exampleSentenceArabic: 'الطرد له شكل صندوق ذو زوايا مربعة.' },
      { id: 'b09_250_03', german: 'gerade', arabic: 'مستقيم', emoji: '📏', exampleSentenceGerman: 'Mit dem Lineal ziehe ich eine gerade Linie.', exampleSentenceArabic: 'بالمسطرة أرسم خطاً مستقيماً تماماً.' },
      { id: 'b09_250_04', german: 'krumm', arabic: 'منحنٍ / معوج', emoji: '🍌', exampleSentenceGerman: 'Die Banane wächst bekanntlich krumm.', exampleSentenceArabic: 'الموز ينمو بطبيعته منحنياً كما هو معروف.' },
      { id: 'b09_250_05', german: 'gepunktet', arabic: 'منقط', emoji: '🐞', exampleSentenceGerman: 'Der Marienkäfer ist rot und schwarz gepunktet.', exampleSentenceArabic: 'الدعسوقة حمراء ومنقطة بنقاط سوداء.' },
      { id: 'b09_250_06', german: 'kariert', arabic: 'مربعات (كاروهات)', emoji: '🏁', exampleSentenceGerman: 'Mein Hemd ist blau und weiß kariert.', exampleSentenceArabic: 'قميصي مزين بنقوش مربعات زرقاء وبيضاء.' },
      { id: 'b09_250_07', german: 'spitz', arabic: 'مدبب / حاد الطرف', emoji: '✏️', exampleSentenceGerman: 'Der angespitzte Buntstift hat eine spitze Miene.', exampleSentenceArabic: 'قلم التلوين المبري له سن حاد ومدبب.' },
      { id: 'b09_250_08', german: 'stumpf', arabic: 'غير حاد / مثلوم الرأس', emoji: '🪨', exampleSentenceGerman: 'Die alte Kinderschere hat eine stumpfe Spitze.', exampleSentenceArabic: 'مقص الأطفال القديم له طرف غير حاد للأمان.' },
      { id: 'b09_250_09', german: 'flach', arabic: 'مسطح / منبسط', emoji: '🥞', exampleSentenceGerman: 'Der Pfannkuchen in der Pfanne ist ganz flach.', exampleSentenceArabic: 'فطيرة البانكيك في المقلاة مسطحة تماماً.' },
      { id: 'b09_250_10', german: 'schräg', arabic: 'مائل / منحرف', emoji: '📐', exampleSentenceGerman: 'Das Dach des Hauses verläuft schräg.', exampleSentenceArabic: 'سطح المنزل يمتد بشكل مائل لتصريف المطر.' }
    ]
  },

  // 251. Personal Pronouns (جريد 1 / 2)
  {
    id: 'curric_b09_251_personal_pronouns',
    title: 'Personalpronomen: Wer ist wer?',
    titleTranslation: 'الضمائر الشخصية: أنا وأنت ونحن',
    gradeLevel: 'grade1',
    category: 'Grammatik & Satzbausteine',
    description: 'الضمائر الأساسية للتحدث والإشارة للأشخاص في جمل بسيطة',
    emoji: '👥',
    items: [
      { id: 'b09_251_01', german: 'ich', arabic: 'أنا', emoji: '🙋', exampleSentenceGerman: 'Ich lerne gerne neue deutsche Wörter.', exampleSentenceArabic: 'أنا أحب تعلم كلمات ألمانية جديدة.' },
      { id: 'b09_251_02', german: 'du', arabic: 'أنتَ / أنتِ', emoji: '👉', exampleSentenceGerman: 'Spielst du mit mir in der Pause?', exampleSentenceArabic: 'هل تلعب معي أثناء الاستراحة؟' },
      { id: 'b09_251_03', german: 'er', arabic: 'هو (للمفرد المذكر)', emoji: '👦', exampleSentenceGerman: 'Er baut einen hohen Turm aus Holzklötzen.', exampleSentenceArabic: 'هو يبني برجاً عالياً من المكعبات الخشبية.' },
      { id: 'b09_251_04', german: 'sie', arabic: 'هي (للمفرد المؤنث)', emoji: '👧', exampleSentenceGerman: 'Sie singt im Schulchor ein schönes Lied.', exampleSentenceArabic: 'هي تغني أغنية جميلة في كورال المدرسة.' },
      { id: 'b09_251_05', german: 'es', arabic: 'هو / هي (للمحايد)', emoji: '👶', exampleSentenceGerman: 'Das Kind lacht, es hat viel Spaß.', exampleSentenceArabic: 'الطفل يضحك، وهو يستمتع بوقته كثيراً.' },
      { id: 'b09_251_06', german: 'wir', arabic: 'نحن', emoji: '👨‍👩‍👧‍👦', exampleSentenceGerman: 'Wir halten im Team fest zusammen.', exampleSentenceArabic: 'نحن نتماسك بقوة ونتعاون في فريقنا.' },
      { id: 'b09_251_07', german: 'ihr', arabic: 'أنتم / أنتنّ', emoji: '🧒👧', exampleSentenceGerman: 'Habt ihr eure Hausaufgaben schon fertig?', exampleSentenceArabic: 'هل أنجزتم واجباتكم المدرسية بالفعل؟' },
      { id: 'b09_251_08', german: 'sie (Plural)', arabic: 'هم / هنّ (للجمع)', emoji: '👫', exampleSentenceGerman: 'Die Kinder rennen schnell, sie wollen zum Spielplatz.', exampleSentenceArabic: 'الأطفال يركضون بسرعة، فهم يريدون الذهاب للملعب.' },
      { id: 'b09_251_09', german: 'Sie (Höflichkeitsform)', arabic: 'حضرتك / سيادتك (للاحترام)', emoji: '👨‍💼', exampleSentenceGerman: 'Guten Tag Frau Müller, wie geht es Ihnen?', exampleSentenceArabic: 'صباح الخير يا سيدة مولر، كيف حال حضرتك؟' },
      { id: 'b09_251_10', german: 'mich / mir', arabic: 'إياي / لي (ضمائر المفعول)', emoji: '🙋‍♂️', exampleSentenceGerman: 'Das Geschenk gefällt mir wirklich sehr.', exampleSentenceArabic: 'الهدية تعجبني وتروق لي حقاً.' }
    ]
  },

  // 252. Possessive Pronouns (جريد 2 / 3)
  {
    id: 'curric_b09_252_possessive_pronouns',
    title: 'Possessivpronomen: Mein, dein, sein',
    titleTranslation: 'ضمائر الملكية: ملكي وملكي وملكه',
    gradeLevel: 'grade2',
    category: 'Grammatik & Satzbausteine',
    description: 'أدوات وضمائر الملكية لتحديد الأشياء التابعة للأشخاص',
    emoji: '🎒',
    items: [
      { id: 'b09_252_01', german: 'mein / meine', arabic: 'ملكي / خاصتي (ياء المتكلم)', emoji: '🎒', exampleSentenceGerman: 'Das ist meine neue Schultasche.', exampleSentenceArabic: 'هذه هي حقيبتي المدرسية الجديدة.' },
      { id: 'b09_252_02', german: 'dein / deine', arabic: 'ملكك / خاصتك (كاف المخاطب)', emoji: '🚲', exampleSentenceGerman: 'Ist das dein rotes Fahrrad?', exampleSentenceArabic: 'هل هذه دراجتك الحمراء؟' },
      { id: 'b09_252_03', german: 'sein / seine', arabic: 'ملكه / خاصته (للمذكر والمحايد)', emoji: '⚽', exampleSentenceGerman: 'Paul sucht seinen bunten Fußball.', exampleSentenceArabic: 'باول يبحث عن كرته الملونة.' },
      { id: 'b09_252_04', german: 'ihr / ihre', arabic: 'ملكها / خاصتها (للمؤنث)', emoji: '🐱', exampleSentenceGerman: 'Anna streichelt ihre kleine Katze.', exampleSentenceArabic: 'آنا تداعب قطتها الصغيرة.' },
      { id: 'b09_252_05', german: 'unser / unsere', arabic: 'ملكنا / خاصتنا (نا الفاعلين)', emoji: '🏡', exampleSentenceGerman: 'Unser Schulgarten ist wunderschön grün.', exampleSentenceArabic: 'حديقة مدرستنا خضراء ورائعة الجمال.' },
      { id: 'b09_252_06', german: 'euer / eure', arabic: 'ملككم / خاصتكم', emoji: '🎨', exampleSentenceGerman: 'Wo ist euer gemaltes Klassenbild?', exampleSentenceArabic: 'أين لوحتكم التي رسمتموها لفصلكم؟' },
      { id: 'b09_252_07', german: 'ihr / ihre (Plural)', arabic: 'ملكهم / خاصتهم', emoji: '🐕', exampleSentenceGerman: 'Die Nachbarn rufen ihren verspielten Hund.', exampleSentenceArabic: 'الجيران ينادون كلبهم المرح.' },
      { id: 'b09_252_08', german: 'Ihr / Ihre (Höflich)', arabic: 'ملك حضرتكم (للاحترام)', emoji: '🚗', exampleSentenceGerman: 'Herr Schmidt, ist das Ihr weißes Auto?', exampleSentenceArabic: 'سيد شميدت، هل هذه سيارة حضرتكم البيضاء؟' },
      { id: 'b09_252_09', german: 'meins', arabic: 'هذا ملكي (ضمير منفصل)', emoji: '🧸', exampleSentenceGerman: 'Das Plüschtier gehört mir, es ist meins.', exampleSentenceArabic: 'اللعبة المحشوة تخصني، إنها ملكي.' },
      { id: 'b09_252_10', german: 'deins', arabic: 'هذا ملكك (ضمير منفصل)', emoji: '✏️', exampleSentenceGerman: 'Nimm diesen Stift, er ist deins.', exampleSentenceArabic: 'خذ هذا القلم، إنه ملكك أنت.' }
    ]
  },

  // 253. Question Words (W-Fragen) (روضة / جريد 1)
  {
    id: 'curric_b09_253_question_words',
    title: 'W-Fragen: Die Detektiv-Wörter',
    titleTranslation: 'أدوات الاستفهام الألمانية: كلمات المحقق الصغير',
    gradeLevel: 'preschool',
    category: 'Grammatik & Satzbausteine',
    description: 'أدوات الاستفهام الأساسية للسؤال عن الأشخاص والأشياء والأماكن والأسباب',
    emoji: '❓',
    items: [
      { id: 'b09_253_01', german: 'wer?', arabic: 'مَن؟ (للسؤال عن العاقل)', emoji: '👤', exampleSentenceGerman: 'Wer klopft denn da an die Tür?', exampleSentenceArabic: 'من يطرق الباب هناك؟' },
      { id: 'b09_253_02', german: 'was?', arabic: 'ماذا؟ / ما؟ (لغير العاقل)', emoji: '📦', exampleSentenceGerman: 'Was hast du heute in deiner Brotbox?', exampleSentenceArabic: 'ماذا يوجد في صندوق طعامك اليوم؟' },
      { id: 'b09_253_03', german: 'wo?', arabic: 'أين؟ (للسؤال عن المكان الثابت)', emoji: '📍', exampleSentenceGerman: 'Wo liegt mein blaues Federmäppchen?', exampleSentenceArabic: 'أين مقلمتي الزرقاء؟' },
      { id: 'b09_253_04', german: 'wohin?', arabic: 'إلى أين؟ (للسؤال عن الاتجاه)', emoji: '🧭', exampleSentenceGerman: 'Wohin fahrt ihr am Wochenende?', exampleSentenceArabic: 'إلى أين تسافرون في عطلة نهاية الأسبوع؟' },
      { id: 'b09_253_05', german: 'woher?', arabic: 'من أين؟ (للسؤال عن المصدر)', emoji: '🌍', exampleSentenceGerman: 'Woher kommst du ursprünglich?', exampleSentenceArabic: 'من أين أتيت في الأصل؟' },
      { id: 'b09_253_06', german: 'wann?', arabic: 'متى؟ (للسؤال عن الزمان)', emoji: '⏰', exampleSentenceGerman: 'Wann fängt die große Pause an?', exampleSentenceArabic: 'متى تبدأ الفسحة المدرسية الكبرى؟' },
      { id: 'b09_253_07', german: 'warum?', arabic: 'لماذا؟ (للسؤال عن السبب)', emoji: '💭', exampleSentenceGerman: 'Warum lachen die Kinder so fröhlich?', exampleSentenceArabic: 'لماذا يضحك الأطفال بكل هذا المرح؟' },
      { id: 'b09_253_08', german: 'wie?', arabic: 'كيف؟ (للسؤال عن الحال والكيفية)', emoji: '🤷', exampleSentenceGerman: 'Wie heißt dein neues Lieblingsspiel?', exampleSentenceArabic: 'ما هو اسم لعبتك المفضلة الجديدة وكيف تُلعب؟' },
      { id: 'b09_253_09', german: 'wie viel?', arabic: 'كم الكمية؟ / كم الثمن؟', emoji: '💰', exampleSentenceGerman: 'Wie viel kostet dieses kleine Notizheft?', exampleSentenceArabic: 'كم يكلف هذا الدفتر الصغير؟' },
      { id: 'b09_253_10', german: 'wie viele?', arabic: 'كم العدد؟ (للمعدود)', emoji: '🔢', exampleSentenceGerman: 'Wie viele Äpfel liegen im Korb?', exampleSentenceArabic: 'كم تفاحة موجودة في السلة؟' }
    ]
  },

  // 254. Definite & Indefinite Articles (جريد 1 / 2)
  {
    id: 'curric_b09_254_articles_rules',
    title: 'Artikel: Der, die, das und ein, eine',
    titleTranslation: 'أدوات التعريف والتنكير في اللغة الألمانية',
    gradeLevel: 'grade1',
    category: 'Grammatik & Satzbausteine',
    description: 'أدوات التعريف والتنكير والنفي الأساسية لكل أسماء اللغة الألمانية',
    emoji: '🏷️',
    items: [
      { id: 'b09_254_01', german: 'der', arabic: 'الـ (أداة تعريف للمذكر)', emoji: '🦁', exampleSentenceGerman: 'Der Löwe schläft unter dem Baum.', exampleSentenceArabic: 'الأسد نائم تحت الشجرة.' },
      { id: 'b09_254_02', german: 'die', arabic: 'الـ (أداة تعريف للمؤنث)', emoji: '🌸', exampleSentenceGerman: 'Die Blume duftet herrlich im Park.', exampleSentenceArabic: 'الزهرة تفوح برائحة زكية في الحديقة.' },
      { id: 'b09_254_03', german: 'das', arabic: 'الـ (أداة تعريف للمحايد)', emoji: '📖', exampleSentenceGerman: 'Das Buch liegt aufgeschlagen auf dem Tisch.', exampleSentenceArabic: 'الكتاب ممدود ومفتوح على الطاولة.' },
      { id: 'b09_254_04', german: 'die (Plural)', arabic: 'الـ (أداة تعريف للجمع دائماً)', emoji: '📚', exampleSentenceGerman: 'Die Bücher stehen im Regal.', exampleSentenceArabic: 'الكتب موضوعة في الرف.' },
      { id: 'b09_254_05', german: 'ein (Maskulin)', arabic: 'واحد / نكرة للمذكر', emoji: '🐶', exampleSentenceGerman: 'Dort drüben bellt ein kleiner Hund.', exampleSentenceArabic: 'هناك ينبح كلب صغير (نكرة).' },
      { id: 'b09_254_06', german: 'eine (Feminin)', arabic: 'واحدة / نكرة للمؤنث', emoji: '🐱', exampleSentenceGerman: 'Im Garten klettert eine Katze.', exampleSentenceArabic: 'في الحديقة تتسلق قطة (نكرة).' },
      { id: 'b09_254_07', german: 'ein (Neutrum)', arabic: 'واحد / نكرة للمحايد', emoji: '🚗', exampleSentenceGerman: 'Auf der Straße fährt ein Auto.', exampleSentenceArabic: 'على الطريق تسير سيارة (نكرة).' },
      { id: 'b09_254_08', german: 'kein', arabic: 'ليس / لا يوجد (نفي للمذكر والمحايد)', emoji: '🚫', exampleSentenceGerman: 'Ich habe heute keinen Hunger.', exampleSentenceArabic: 'لست جائعاً اليوم ولا يوجد عندي جوع.' },
      { id: 'b09_254_09', german: 'keine', arabic: 'ليست / نفي للمؤنث والجمع', emoji: '⛔', exampleSentenceGerman: 'Wir haben keine Fehler im Test gemacht.', exampleSentenceArabic: 'لم نرتكب أي أخطاء في الامتحان.' },
      { id: 'b09_254_10', german: 'welcher / welche / welches?', arabic: 'أيّ؟ (للتحديد والاختيار)', emoji: '🔎', exampleSentenceGerman: 'Welches Buch möchtest du heute vorlesen?', exampleSentenceArabic: 'أي كتاب ترغب في قراءته اليوم؟' }
    ]
  },

  // 255. Demonstrative & Indefinite Pronouns (جريد 2 / 3)
  {
    id: 'curric_b09_255_demonstratives_indefinites',
    title: 'Hinweis- und Unbestimmte Wörter',
    titleTranslation: 'أسماء الإشارة والكلمات غير المحددة',
    gradeLevel: 'grade2',
    category: 'Grammatik & Satzbausteine',
    description: 'أسماء الإشارة (هذا، هذه) والكلمات العامة مثل (الكل، البعض، لا أحد)',
    emoji: '👆',
    items: [
      { id: 'b09_255_01', german: 'dieser / diese / dieses', arabic: 'هذا / هذه / هذا للمحايد', emoji: '👉', exampleSentenceGerman: 'Dieses Bild habe ich selbst gemalt.', exampleSentenceArabic: 'هذه الصورة رسمتها بنفسي.' },
      { id: 'b09_255_02', german: 'jeder / jede / jedes', arabic: 'كل / كل فرد على حدة', emoji: '👥', exampleSentenceGerman: 'Jedes Kind bekommt einen roten Buntstift.', exampleSentenceArabic: 'كل طفل يحصل على قلم تلوين أحمر.' },
      { id: 'b09_255_03', german: 'alle', arabic: 'الجميع / كل الناس أو الأشياء', emoji: '🌟', exampleSentenceGerman: 'Alle Schüler hören der Lehrerin aufmerksam zu.', exampleSentenceArabic: 'جميع التلاميذ يستمعون للمعلمة باهتمام.' },
      { id: 'b09_255_04', german: 'einige / manche', arabic: 'بعض / عدة أشخاص أو أشياء', emoji: '✨', exampleSentenceGerman: 'Einige Kinder spielen Verstecken im Garten.', exampleSentenceArabic: 'بعض الأطفال يلعبون الغميضة في الحديقة.' },
      { id: 'b09_255_05', german: 'etwas', arabic: 'شيء ما / قليلاً من', emoji: '🤏', exampleSentenceGerman: 'Möchtest du etwas Wasser trinken?', exampleSentenceArabic: 'هل ترغب في شرب القليل من الماء؟' },
      { id: 'b09_255_06', german: 'nichts', arabic: 'لا شيء إطلاقاً', emoji: '🕳️', exampleSentenceGerman: 'In der Kiste ist gar nichts mehr drin.', exampleSentenceArabic: 'لا يوجد أي شيء على الإطلاق في الصندوق.' },
      { id: 'b09_255_07', german: 'jemand', arabic: 'شخص ما / أحد الأشخاص', emoji: '👤', exampleSentenceGerman: 'Hat jemand meinen Radiergummi gesehen?', exampleSentenceArabic: 'هل رأى أحد ممحاتي؟' },
      { id: 'b09_255_08', german: 'niemand', arabic: 'لا أحد إطلاقاً', emoji: '🚪', exampleSentenceGerman: 'Im Klassenzimmer ist niemand mehr.', exampleSentenceArabic: 'لا يوجد أحد في الفصل المدرسي بعد الآن.' },
      { id: 'b09_255_09', german: 'man', arabic: 'المرء / الإنسان عموماً', emoji: '🚶', exampleSentenceGerman: 'Hier darf man nicht laut sprechen.', exampleSentenceArabic: 'هنا لا يُسمح للمرء بالتحدث بصوت عالٍ.' },
      { id: 'b09_255_10', german: 'beide', arabic: 'كلاهما / الاثنين معاً', emoji: '👫', exampleSentenceGerman: 'Beide Freunde laufen lachend um die Wette.', exampleSentenceArabic: 'كلا الصديقين يركضان في سباق وهما يضحكان.' }
    ]
  },

  // 256. Useful Conjunctions for Children (جريد 2 / 3)
  {
    id: 'curric_b09_256_conjunctions',
    title: 'Bindewörter: Sätze verbinden',
    titleTranslation: 'حروف العطف والربط: بناء جمل مركبة للأطفال',
    gradeLevel: 'grade2',
    category: 'Grammatik & Satzbausteine',
    description: 'حروف الربط الأكثر فائدة في التحدث وسرد القصص (و، لكن، أو، لأن، عندما)',
    emoji: '🔗',
    items: [
      { id: 'b09_256_01', german: 'und', arabic: 'وَ (حرف العطف)', emoji: '➕', exampleSentenceGerman: 'Ich mag Äpfel und Bananen zum Frühstück.', exampleSentenceArabic: 'أحب التفاح والموز على الإفطار.' },
      { id: 'b09_256_02', german: 'oder', arabic: 'أو (للتخيير)', emoji: '🔀', exampleSentenceGerman: 'Möchtest du Saft oder lieber Wasser?', exampleSentenceArabic: 'هل ترغب في عصير أو تفضل الماء؟' },
      { id: 'b09_256_03', german: 'aber', arabic: 'لكن (للاستدراك)', emoji: '✋', exampleSentenceGerman: 'Ich bin müde, aber ich lese noch ein Kapitel.', exampleSentenceArabic: 'أنا متعب، لكني سأقرأ فصلاً إضافياً.' },
      { id: 'b09_256_04', german: 'denn', arabic: 'لأنّ (ولا تغير ترتيب الفعل)', emoji: '💡', exampleSentenceGerman: 'Ich ziehe die Jacke an, denn es ist kalt.', exampleSentenceArabic: 'أرتدي السترة، لأن الجو بارد.' },
      { id: 'b09_256_05', german: 'weil', arabic: 'لأنّ / بسبب (تنقل الفعل للآخر)', emoji: '🎯', exampleSentenceGerman: 'Ich freue mich, weil heute schulfrei ist.', exampleSentenceArabic: 'أنا سعيد للغاية لأن اليوم عطلة مدرسية.' },
      { id: 'b09_256_06', german: 'dass', arabic: 'أنّ (حرف توكيد وموصول)', emoji: '📝', exampleSentenceGerman: 'Ich weiß, dass du fleißig gelernt hast.', exampleSentenceArabic: 'أنا أعلم أنك ذاكرت باجتهاد.' },
      { id: 'b09_256_07', german: 'wenn', arabic: 'عندما / إذا (شرطية أو زمنية)', emoji: '🌧️', exampleSentenceGerman: 'Wenn es regnet, spannen wir den Schirm auf.', exampleSentenceArabic: 'عندما تمطر السماء، نفتح المظلة.' },
      { id: 'b09_256_08', german: 'als', arabic: 'عندما (لحدث ماضٍ لمرة واحدة)', emoji: '🕰️', exampleSentenceGerman: 'Als ich klein war, hatte ich ein Schaukelpferd.', exampleSentenceArabic: 'عندما كنت صغيراً، كان لدي حصان هزاز.' },
      { id: 'b09_256_09', german: 'obwohl', arabic: 'على الرغم من / بالرغم أن', emoji: '🧗', exampleSentenceGerman: 'Obwohl es steil war, kletterte er ganz hinauf.', exampleSentenceArabic: 'على الرغم من وعورة الطريق، تسلق حتى القمة.' },
      { id: 'b09_256_10', german: 'deshalb', arabic: 'لذلك / ولهذا السبب', emoji: '➡️', exampleSentenceGerman: 'Die Sonne scheint, deshalb gehen wir in den Park.', exampleSentenceArabic: 'الشمس مشرقة، لذلك سنذهب إلى الحديقة.' }
    ]
  },

  // 257. Essential Modal Verbs in Child Context (جريد 2 / 3)
  {
    id: 'curric_b09_257_modal_verbs',
    title: 'Modalverben: Was ich kann und darf',
    titleTranslation: 'الأفعال المساعدة: ما أستطيعه وما يُسمح لي به وما أريده',
    gradeLevel: 'grade2',
    category: 'Grammatik & Satzbausteine',
    description: 'أفعال الكيفية الأساسية للتعبير عن الإمكانية والإذن والإرادة والإلزام',
    emoji: '🚦',
    items: [
      { id: 'b09_257_01', german: 'können', arabic: 'يستطيع / يقدر على', emoji: '🏊', exampleSentenceGerman: 'Ich kann schon ohne Schwimmflügel schwimmen.', exampleSentenceArabic: 'أستطيع السباحة بدون عوامات بالفعل.' },
      { id: 'b09_257_02', german: 'dürfen', arabic: 'يُسمح له / يجوز له', emoji: '🟢', exampleSentenceGerman: 'Darf ich bitte nach draußen zum Spielen gehen?', exampleSentenceArabic: 'هل يُسمح لي بالخروج للعب من فضلك؟' },
      { id: 'b09_257_03', german: 'müssen', arabic: 'يجب عليه / مضطر إلى', emoji: '⏰', exampleSentenceGerman: 'Wir müssen pünktlich zur Schule gehen.', exampleSentenceArabic: 'يجب علينا الذهاب إلى المدرسة في الموعد تماماً.' },
      { id: 'b09_257_04', german: 'wollen', arabic: 'يريد / يعتزم', emoji: '🎯', exampleSentenceGerman: 'Ich will heute mein Legoschloss fertigbauen.', exampleSentenceArabic: 'أريد إكمال بناء قلعة الليجو الخاصة بي اليوم.' },
      { id: 'b09_257_05', german: 'möchten', arabic: 'يرغب في / يودّ (بلباقة)', emoji: '🍨', exampleSentenceGerman: 'Ich möchte bitte zwei Kugeln Erdbeereis.', exampleSentenceArabic: 'أود من فضلك كرتين من آيس كريم الفراولة.' },
      { id: 'b09_257_06', german: 'sollen', arabic: 'ينبغي عليه / مطلوب منه', emoji: '📋', exampleSentenceGerman: 'Die Lehrerin sagt, wir sollen leise lesen.', exampleSentenceArabic: 'المعلمة تقول إنه ينبغي علينا القراءة بهدوء.' },
      { id: 'b09_257_07', german: 'nicht dürfen', arabic: 'ممنوع عليه / لا يجوز له إطلاقاً', emoji: '🔴', exampleSentenceGerman: 'Hier darf man den Rasen nicht betreten.', exampleSentenceArabic: 'هنا ممنوع تماماً السير على العشب.' },
      { id: 'b09_257_08', german: 'brauchen (+ nicht)', arabic: 'يحتاج / لا داعي لـ', emoji: '☂️', exampleSentenceGerman: 'Heute brauchen wir keinen Regenschirm.', exampleSentenceArabic: 'اليوم لا نحتاج إلى مظلة مطر.' },
      { id: 'b09_257_09', german: 'mögen', arabic: 'يحب / يروق له', emoji: '❤️', exampleSentenceGerman: 'Alle Kinder mögen bunte Seifenblasen.', exampleSentenceArabic: 'كل الأطفال يحبون فقاعات الصابون الملونة.' },
      { id: 'b09_257_10', german: 'helfen können', arabic: 'يستطيع تقديم المساعدة', emoji: '🤝', exampleSentenceGerman: 'Kann ich dir beim Aufräumen helfen?', exampleSentenceArabic: 'هل يمكنني مساعدتك في ترتيب المكان؟' }
    ]
  },

  // 258. Basic Spatial Prepositions 1 (روضة / جريد 1)
  {
    id: 'curric_b09_258_prepositions_spatial_1',
    title: 'Räumliche Präpositionen 1: Wo ist die Maus?',
    titleTranslation: 'حروف جر المكان 1: في، على، تحت، وفوق',
    gradeLevel: 'preschool',
    category: 'Präpositionen & Positionen',
    description: 'حروف المكان البسيطة الموضحة لمكان وجود الأشياء والألعاب',
    emoji: '📦',
    items: [
      { id: 'b09_258_01', german: 'in', arabic: 'في / داخل', emoji: '📥', exampleSentenceGerman: 'Der Apfel liegt im Korb.', exampleSentenceArabic: 'التفاحة موجودة في السلة.' },
      { id: 'b09_258_02', german: 'auf', arabic: 'على / فوق بملامسة', emoji: '📖', exampleSentenceGerman: 'Das Buch liegt auf dem Schreibtisch.', exampleSentenceArabic: 'الكتاب موضوع على المكتب.' },
      { id: 'b09_258_03', german: 'unter', arabic: 'تحت / أسفل', emoji: '🛋️', exampleSentenceGerman: 'Der Ball rollt unter das Sofa.', exampleSentenceArabic: 'الكرة تتدحرج تحت الأريكة.' },
      { id: 'b09_258_04', german: 'über', arabic: 'فوق / أعلى بدون ملامسة', emoji: '💡', exampleSentenceGerman: 'Die Lampe hängt über dem Esstisch.', exampleSentenceArabic: 'المصباح معلق فوق مائدة الطعام.' },
      { id: 'b09_258_05', german: 'neben', arabic: 'بجانب / بجوار', emoji: '👫', exampleSentenceGerman: 'Mia sitzt neben ihrer besten Freundin.', exampleSentenceArabic: 'ميا تجلس بجانب صديقتها المفضلة.' },
      { id: 'b09_258_06', german: 'vor', arabic: 'أمام', emoji: '🚪', exampleSentenceGerman: 'Der Postbote steht vor der Haustür.', exampleSentenceArabic: 'ساعي البريد يقف أمام باب المنزل.' },
      { id: 'b09_258_07', german: 'hinter', arabic: 'خلف / وراء', emoji: '🌳', exampleSentenceGerman: 'Leo versteckt sich hinter dem Baum.', exampleSentenceArabic: 'ليو يختبئ خلف الشجرة.' },
      { id: 'b09_258_08', german: 'zwischen', arabic: 'بين (شيئين أو شخصين)', emoji: '🥪', exampleSentenceGerman: 'Die Katze schläft zwischen zwei Kissen.', exampleSentenceArabic: 'القطة تنام بين وسادتين.' },
      { id: 'b09_258_09', german: 'an', arabic: 'عند / معلق على الجدار', emoji: '🖼️', exampleSentenceGerman: 'Das Bild hängt an der Wand.', exampleSentenceArabic: 'الصورة معلقة على الحائط.' },
      { id: 'b09_258_10', german: 'bei', arabic: 'عند / لدى (شخص أو مكان)', emoji: '👵', exampleSentenceGerman: 'Am Wochenende bin ich bei Oma.', exampleSentenceArabic: 'في عطلة نهاية الأسبوع أكون عند جدتي.' }
    ]
  },

  // 259. Directions & Spatial Movement (جريد 1 / 2)
  {
    id: 'curric_b09_259_directions_movement',
    title: 'Richtungen und Orientierung im Raum',
    titleTranslation: 'الاتجاهات وحركات التوجيه في المكان',
    gradeLevel: 'grade1',
    category: 'Präpositionen & Positionen',
    description: 'كلمات الاتجاهات الأساسية: يميناً، يساراً، للأمام، للخلف، وللأعلى',
    emoji: '🧭',
    items: [
      { id: 'b09_259_01', german: 'links', arabic: 'يساراً / إلى الشمال', emoji: '⬅️', exampleSentenceGerman: 'An der Ampel biegen wir links ab.', exampleSentenceArabic: 'عند إشارة المرور ننعطف يساراً.' },
      { id: 'b09_259_02', german: 'rechts', arabic: 'يميناً / إلى اليمين', emoji: '➡️', exampleSentenceGerman: 'Die Schule liegt auf der rechten Seite.', exampleSentenceArabic: 'المدرسة تقع على الجانب الأيمن.' },
      { id: 'b09_259_03', german: 'geradeaus', arabic: 'إلى الأمام مباشرة', emoji: '⬆️', exampleSentenceGerman: 'Gehe einfach immer geradeaus weiter.', exampleSentenceArabic: 'سر للأمام مباشرة دون انعطاف.' },
      { id: 'b09_259_04', german: 'oben', arabic: 'في الأعلى / فوق', emoji: '🪜', exampleSentenceGerman: 'Ganz oben auf dem Schrank liegt die Kiste.', exampleSentenceArabic: 'في أعلى الخزانة تماماً يرقد الصندوق.' },
      { id: 'b09_259_05', german: 'unten', arabic: 'في الأسفل / تحت', emoji: '👇', exampleSentenceGerman: 'Unten im Keller ist es kühl.', exampleSentenceArabic: 'في الأسفل بالقبو الجو بارد.' },
      { id: 'b09_259_06', german: 'vorne', arabic: 'في المقدمة / في الأمام', emoji: '🚌', exampleSentenceGerman: 'Im Bus sitze ich gerne ganz vorne.', exampleSentenceArabic: 'في الحافلة أحب الجلوس في المقدمة تماماً.' },
      { id: 'b09_259_07', german: 'hinten', arabic: 'في الخلف / في المؤخرة', emoji: '🔙', exampleSentenceGerman: 'Die Schultaschen stehen hinten im Raum.', exampleSentenceArabic: 'الحقائب المدرسية موضوعة في خلف الغرفة.' },
      { id: 'b09_259_08', german: 'draußen', arabic: 'في الخارج / في الهواء الطلق', emoji: '🌳', exampleSentenceGerman: 'Bei Sonnenschein spielen wir draußen.', exampleSentenceArabic: 'عندما تسطع الشمس نلعب في الخارج.' },
      { id: 'b09_259_09', german: 'drinnen', arabic: 'في الداخل / داخل المبنى', emoji: '🏠', exampleSentenceGerman: 'Wenn es stürmt, bleiben wir drinnen.', exampleSentenceArabic: 'عندما تعصف الرياح، نبقى في الداخل.' },
      { id: 'b09_259_10', german: 'überall', arabic: 'في كل مكان', emoji: '✨', exampleSentenceGerman: 'Im Frühling blühen überall bunte Blumen.', exampleSentenceArabic: 'في فصل الربيع تتفتح الزهور في كل مكان.' }
    ]
  },

  // 260. Advanced Prepositions & Motion Path (جريد 3 / 4)
  {
    id: 'curric_b09_260_prepositions_motion',
    title: 'Wege und Bewegungspräpositionen',
    titleTranslation: 'حروف الجر الحركية ومسارات التنقل',
    gradeLevel: 'grade3',
    category: 'Präpositionen & Positionen',
    description: 'حروف الحركة مثل عبر، من خلال، حول، على طول، وباتجاه',
    emoji: '🏃‍♂️',
    items: [
      { id: 'b09_260_01', german: 'durch', arabic: 'عبر / من خلال', emoji: '🌲', exampleSentenceGerman: 'Wir wandern fröhlich durch den Wald.', exampleSentenceArabic: 'نتجول بمرح من خلال الغابة.' },
      { id: 'b09_260_02', german: 'über (Weg)', arabic: 'عبر / فوق (الجسر أو الشارع)', emoji: '🌉', exampleSentenceGerman: 'Wir gehen vorsichtig über die Brücke.', exampleSentenceArabic: 'نعبر بحذر فوق الجسر.' },
      { id: 'b09_260_03', german: 'um ... herum', arabic: 'حول / يلتف حول', emoji: '🔄', exampleSentenceGerman: 'Die Kinder tanzen um den großen Baum herum.', exampleSentenceArabic: 'الأطفال يرقصون حول الشجرة الكبيرة.' },
      { id: 'b09_260_04', german: 'entlang', arabic: 'على طول (المسار أو النهر)', emoji: '🏞️', exampleSentenceGerman: 'Wir spazieren am Flussufer entlang.', exampleSentenceArabic: 'نتنزه على طول ضفة النهر.' },
      { id: 'b09_260_05', german: 'bis zu', arabic: 'حتى / إلى غاية', emoji: '🏁', exampleSentenceGerman: 'Lauf so schnell du kannst bis zur Ziellinie!', exampleSentenceArabic: 'اركض بأقصى ما يمكنك حتى خط النهاية!' },
      { id: 'b09_260_06', german: 'zu / zum / zur', arabic: 'إلى (شخص أو مبنى)', emoji: '🏫', exampleSentenceGerman: 'Am Morgen radeln wir zur Schule.', exampleSentenceArabic: 'في الصباح نقود الدراجة نحو المدرسة.' },
      { id: 'b09_260_07', german: 'nach', arabic: 'إلى (مدينة أو بلد أو للمنزل)', emoji: '🏡', exampleSentenceGerman: 'Nach dem Unterricht gehe ich nach Hause.', exampleSentenceArabic: 'بعد انتهاء الحصص أذهب إلى المنزل.' },
      { id: 'b09_260_08', german: 'aus', arabic: 'من (من داخل الشيء)', emoji: '🚪', exampleSentenceGerman: 'Der Zauberer zieht ein Kaninchen aus dem Hut.', exampleSentenceArabic: 'الساحر يخرج أرنباً من داخل القبعة.' },
      { id: 'b09_260_09', german: 'von', arabic: 'من (من عند شخص أو نقطة)', emoji: '📬', exampleSentenceGerman: 'Ein schöner Brief von meiner Lieblingstante.', exampleSentenceArabic: 'رسالة جميلة من عمتي الحبيبة.' },
      { id: 'b09_260_10', german: 'gegenüber von', arabic: 'مقابل / في الجهة المقابلة لـ', emoji: '🏪', exampleSentenceGerman: 'Die Bäckerei liegt direkt gegenüber von der Schule.', exampleSentenceArabic: 'المخبز يقع في الجهة المقابلة تماماً للمدرسة.' }
    ]
  },

  // 261. Money, Euro & Paying (جريد 2 / 3)
  {
    id: 'curric_b09_261_money_currency',
    title: 'Geld und Bezahlen: Münzen und Scheine',
    titleTranslation: 'النقود والدفع: العملات المعدنية والورقية',
    gradeLevel: 'grade2',
    category: 'Einkaufen & Geld',
    description: 'مفردات النقود باليورو والسنت والمحفظة وحصالة النقود والدفع',
    emoji: '💶',
    items: [
      { id: 'b09_261_01', german: 'das Geld', arabic: 'النقود / المال', article: 'das', plural: 'die Gelder', emoji: '💵', exampleSentenceGerman: 'Ich spare mein Geld für ein neues Buch.', exampleSentenceArabic: 'أنا أدخر نقودي لشراء كتاب جديد.' },
      { id: 'b09_261_02', german: 'der Euro', arabic: 'اليورو', article: 'der', plural: 'die Euros', emoji: '💶', exampleSentenceGerman: 'Das Brötchen kostet genau einen Euro.', exampleSentenceArabic: 'رغيف الخبز الصغير يكلف يورو واحداً بالضبط.' },
      { id: 'b09_261_03', german: 'der Cent', arabic: 'السنت (جزء اليورو)', article: 'der', plural: 'die Cents', emoji: '🪙', exampleSentenceGerman: 'Ich habe noch zwanzig Cent im Portemonnaie.', exampleSentenceArabic: 'لا يزال لدي عشرون سنتاً في حافظة نقودي.' },
      { id: 'b09_261_04', german: 'die Münze', arabic: 'العملة المعدنية', article: 'die', plural: 'die Münzen', emoji: '🪙', exampleSentenceGerman: 'Die goldene Münze klimpert in der Spardose.', exampleSentenceArabic: 'العملة المعدنية الذهبية ترن داخل الحصالة.' },
      { id: 'b09_261_05', german: 'der Geldschein', arabic: 'الورقة النقدية', article: 'der', plural: 'die Geldscheine', emoji: '💴', exampleSentenceGerman: 'Mama hat einen Fünf-Euro-Schein eingesteckt.', exampleSentenceArabic: 'أمي وضعت في جيبها ورقة نقدية فئة خمسة يورو.' },
      { id: 'b09_261_06', german: 'die Spardose', arabic: 'حصالة النقود', article: 'die', plural: 'die Spardosen', emoji: '🐷', exampleSentenceGerman: 'Mein Sparschwein ist schon fast voll.', exampleSentenceArabic: 'حصالة نقودي أوشكت على الامتلاء.' },
      { id: 'b09_261_07', german: 'der Geldbeutel', arabic: 'محفظة النقود', article: 'der', plural: 'die Geldbeutel', emoji: '👛', exampleSentenceGerman: 'Vergiss nicht deinen Geldbeutel einzupacken.', exampleSentenceArabic: 'لا تنسَ وضع محفظتك في حقيبتك.' },
      { id: 'b09_261_08', german: 'das Taschengeld', arabic: 'مصروف الجيب للأطفال', article: 'das', plural: '-', emoji: '🪙', exampleSentenceGerman: 'Jeden Sonntag bekomme ich mein Taschengeld.', exampleSentenceArabic: 'في كل يوم أحد أحصل على مصروف جيبي.' },
      { id: 'b09_261_09', german: 'sparen', arabic: 'يدخر / يوفر المال', emoji: '🏦', exampleSentenceGerman: 'Kinder sparen gerne für ein tolles Spielzeug.', exampleSentenceArabic: 'يحب الأطفال ادخار النقود لشراء لعبة مميزة.' },
      { id: 'b09_261_10', german: 'bezahlen', arabic: 'يدفع الحساب', emoji: '💳', exampleSentenceGerman: 'Papa bezahlt an der Kasse mit einer Karte.', exampleSentenceArabic: 'أبي يدفع الحساب عند الكاشير بالبطاقة.' }
    ]
  },

  // 262. Supermarket & Food Shopping (جريد 1 / 2)
  {
    id: 'curric_b09_262_supermarket_shopping',
    title: 'Im Supermarkt einkaufen',
    titleTranslation: 'التسوق في السوبرماركت',
    gradeLevel: 'grade1',
    category: 'Einkaufen & Geld',
    description: 'مفردات عربة التسوق وقائمة الشراء والكاشير والرفوف',
    emoji: '🛒',
    items: [
      { id: 'b09_262_01', german: 'der Einkaufswagen', arabic: 'عربة التسوق', article: 'der', plural: 'die Einkaufswagen', emoji: '🛒', exampleSentenceGerman: 'Ich schiebe den Einkaufswagen durch den Gang.', exampleSentenceArabic: 'أنا أدفع عربة التسوق عبر الممر.' },
      { id: 'b09_262_02', german: 'der Einkaufskorb', arabic: 'سلة التسوق اليدوية', article: 'der', plural: 'die Einkaufskörbe', emoji: '🧺', exampleSentenceGerman: 'Für wenige Sachen reicht ein kleiner Korb.', exampleSentenceArabic: 'لأجل أغراض قليلة تكفي سلة صغيرة.' },
      { id: 'b09_262_03', german: 'die Kasse', arabic: 'الكاشير / نقطة الدفع', article: 'die', plural: 'die Kassen', emoji: '📠', exampleSentenceGerman: 'An der Kasse stellen wir uns in die Reihe.', exampleSentenceArabic: 'عند الكاشير نقف في الطابور بنظام.' },
      { id: 'b09_262_04', german: 'der Einkaufszettel', arabic: 'قائمة المشتريات المكتوبة', article: 'der', plural: 'die Einkaufszettel', emoji: '📝', exampleSentenceGerman: 'Auf dem Zettel stehen Milch, Butter und Äpfel.', exampleSentenceArabic: 'على القائمة مكتوب حليب وزبدة وتفاح.' },
      { id: 'b09_262_05', german: 'das Regal', arabic: 'رف البضائع', article: 'das', plural: 'die Regale', emoji: '🗄️', exampleSentenceGerman: 'Im Regal stehen viele bunte Müslipackungen.', exampleSentenceArabic: 'على الرف توجد علب حبوب إفطار ملونة كثيرة.' },
      { id: 'b09_262_06', german: 'der Kassenbon', arabic: 'إيصال / فاتورة الشراء', article: 'der', plural: 'die Kassenbons', emoji: '🧾', exampleSentenceGerman: 'Die Kassiererin gibt uns den Kassenbon.', exampleSentenceArabic: 'موظفة الكاشير تسلمنا إيصال الشراء.' },
      { id: 'b09_262_07', german: 'die Einkaufstasche', arabic: 'حقيبة التسوق', article: 'die', plural: 'die Einkaufstaschen', emoji: '🛍️', exampleSentenceGerman: 'Wir packen die Einkäufe in eine feste Tasche.', exampleSentenceArabic: 'نضع المشتريات في حقيبة تسوق متينة.' },
      { id: 'b09_262_08', german: 'der Preis', arabic: 'السعر / الثمن', article: 'der', plural: 'die Preise', emoji: '🏷️', exampleSentenceGerman: 'Der Preis steht auf dem kleinen Schild.', exampleSentenceArabic: 'السعر مكتوب على اللافتة الصغيرة.' },
      { id: 'b09_262_09', german: 'billig', arabic: 'رخيص الثمن', emoji: '🪙', exampleSentenceGerman: 'Die Bananen sind heute besonders billig.', exampleSentenceArabic: 'الموز اليوم رخيص الثمن بصورة خاصة.' },
      { id: 'b09_262_10', german: 'teuer', arabic: 'غالي الثمن', emoji: '💎', exampleSentenceGerman: 'Dieses große ferngesteuerte Auto ist teuer.', exampleSentenceArabic: 'هذه السيارة الكبيرة التي تعمل بالتحكم عن بعد باهظة الثمن.' }
    ]
  },

  // 263. Market Stall & Fresh Foods (جريد 2 / 3)
  {
    id: 'curric_b09_263_market_stall',
    title: 'Auf dem Wochenmarkt',
    titleTranslation: 'في السوق الأسبوعي الشعبي',
    gradeLevel: 'grade2',
    category: 'Einkaufen & Geld',
    description: 'أكشاك السوق الشعبي ووزن الفواكه والخضار والتعامل المباشر مع البائع',
    emoji: '🎪',
    items: [
      { id: 'b09_263_01', german: 'der Marktstand', arabic: 'كشك / بسطة السوق', article: 'der', plural: 'die Marktstände', emoji: '🎪', exampleSentenceGerman: 'Am Marktstand gibt es frische Erdbeeren.', exampleSentenceArabic: 'في كشك السوق يوجد فراولة طازجة.' },
      { id: 'b09_263_02', german: 'der Marktplatz', arabic: 'ميدان السوق', article: 'der', plural: 'die Marktplätze', emoji: '🏛️', exampleSentenceGerman: 'Samstags ist auf dem Marktplatz viel los.', exampleSentenceArabic: 'أيام السبت يكون ميدان السوق مليئاً بالنشاط والحركة.' },
      { id: 'b09_263_03', german: 'die Waage', arabic: 'الميزان', article: 'die', plural: 'die Waagen', emoji: '⚖️', exampleSentenceGerman: 'Der Händler legt die Kartoffeln auf die Waage.', exampleSentenceArabic: 'التاجر يضع البطاطس على الميزان لوزنها.' },
      { id: 'b09_263_04', german: 'das Kilo / Kilogramm', arabic: 'كيلوجرام', article: 'das', plural: 'die Kilos', emoji: '⚖️', exampleSentenceGerman: 'Wir kaufen ein Kilo süße Kirschen.', exampleSentenceArabic: 'نشتري كيلوغراماً من الكرز الحلو.' },
      { id: 'b09_263_05', german: 'das Gramm', arabic: 'جرام', article: 'das', plural: 'die Gramme', emoji: '🧪', exampleSentenceGerman: 'Zweihundert Gramm Käse reichen für uns.', exampleSentenceArabic: 'مئتا غرام من الجبن تكفينا.' },
      { id: 'b09_263_06', german: 'das Pfund', arabic: 'رطل (نصف كيلو / 500 جرام)', article: 'das', plural: 'die Pfunde', emoji: '🧈', exampleSentenceGerman: 'Ein Pfund Erdbeeren schmeckt der ganzen Familie.', exampleSentenceArabic: 'رطل من الفراولة يكفي لجميع أفراد العائلة.' },
      { id: 'b09_263_07', german: 'das Stück', arabic: 'قطعة واحدة', article: 'das', plural: 'die Stücke', emoji: '🍰', exampleSentenceGerman: 'Ich nehme ein Stück köstlichen Apfelkuchen.', exampleSentenceArabic: 'سآخذ قطعة واحدة من كعكة التفاح الشهية.' },
      { id: 'b09_263_08', german: 'die Schale', arabic: 'طبق صغير / سلة توت', article: 'die', plural: 'die Schalen', emoji: '🫐', exampleSentenceGerman: 'Eine Schale Blaubeeren bitte für mich!', exampleSentenceArabic: 'طبق من التوت الأزرق من فضلك من أجلي!' },
      { id: 'b09_263_09', german: 'der Bund', arabic: 'حزمة (بقدونس أو جزر)', article: 'der', plural: 'die Bunde', emoji: '🥕', exampleSentenceGerman: 'Mama kauft einen Bund frische Möhren.', exampleSentenceArabic: 'ماما تشتري حزمة من الجزر الطازج.' },
      { id: 'b09_263_10', german: 'das Wechselgeld', arabic: 'الباقي من النقود (الفكة)', article: 'das', plural: '-', emoji: '🪙', exampleSentenceGerman: 'Hier ist Ihr Wechselgeld, vielen Dank!', exampleSentenceArabic: 'تفضل هذا هو باقي نقودك، شكراً جزيلاً لك!' }
    ]
  },

  // 264. Toy Store & Kid's Purchases (جريد 2 / 3)
  {
    id: 'curric_b09_264_toystore_purchases',
    title: 'Im Spielwarenladen',
    titleTranslation: 'في متجر الألعاب والهدايا',
    gradeLevel: 'grade2',
    category: 'Einkaufen & Geld',
    description: 'شراء الألعاب واختيار الهدايا وتغليفها وقسيمة الشراء',
    emoji: '🧸',
    items: [
      { id: 'b09_264_01', german: 'das Schaufenster', arabic: 'واجهة العرض الزجاجية للمتجر', article: 'das', plural: 'die Schaufenster', emoji: '🪟', exampleSentenceGerman: 'Im Schaufenster dreht sich eine kleine Eisenbahn.', exampleSentenceArabic: 'في واجهة العرض يدور قطار لعبة صغير.' },
      { id: 'b09_264_02', german: 'das Geschenk', arabic: 'الهدية', article: 'das', plural: 'die Geschenke', emoji: '🎁', exampleSentenceGerman: 'Ich suche ein Geburtstagsgeschenk für Tim.', exampleSentenceArabic: 'أبحث عن هدية عيد ميلاد من أجل تيم.' },
      { id: 'b09_264_03', german: 'das Geschenkpapier', arabic: 'ورق تغليف الهدايا', article: 'das', plural: 'die Geschenkpapiere', emoji: '🎀', exampleSentenceGerman: 'Die Verkäuferin wickelt das Spielzeug in Geschenkpapier.', exampleSentenceArabic: 'البائعة تلف اللعبة في ورق هدايا جميل.' },
      { id: 'b09_264_04', german: 'die Schleife', arabic: 'شريطة الزينة / فيونكة', article: 'die', plural: 'die Schleifen', emoji: '🎀', exampleSentenceGerman: 'Auf dem Päckchen sitzt eine rote Schleife.', exampleSentenceArabic: 'فوق الطرد توجد فيونكة حمراء زاهية.' },
      { id: 'b09_264_05', german: 'die Auswahl', arabic: 'التشكيلة / الخيارات المتاحة', article: 'die', plural: '-', emoji: '🌈', exampleSentenceGerman: 'Der Laden hat eine riesige Auswahl an Puppen.', exampleSentenceArabic: 'المتجر يضم تشكيلة هائلة من الدمى.' },
      { id: 'b09_264_06', german: 'aussuchen', arabic: 'يختار وينتقي', emoji: '👉', exampleSentenceGerman: 'Du darfst dir ein tolles Buch aussuchen.', exampleSentenceArabic: 'يُسمح لك باختيار كتاب مميز لنفسك.' },
      { id: 'b09_264_07', german: 'der Gutschein', arabic: 'قسيمة الشراء / بطاقة الهدية', article: 'der', plural: 'die Gutscheine', emoji: '🎟️', exampleSentenceGerman: 'Oma schenkt mir einen Zehn-Euro-Gutschein.', exampleSentenceArabic: 'جدتي تهديني قسيمة شراء بقيمة عشرة يورو.' },
      { id: 'b09_264_08', german: 'das Angebot', arabic: 'العرض الخاص / التخفيض', article: 'das', plural: 'die Angebote', emoji: '🏷️', exampleSentenceGerman: 'Das Spiel ist heute im Sonderangebot.', exampleSentenceArabic: 'اللعبة موجودة اليوم في عرض تخفيض خاص.' },
      { id: 'b09_264_09', german: 'kosten', arabic: 'يكلّف / يبلغ سعره', emoji: '💶', exampleSentenceGerman: 'Wie viel kostet dieses kleine Zauberset?', exampleSentenceArabic: 'كم تكلف مجموعة ألعاب الخدع السحرية هذه؟' },
      { id: 'b09_264_10', german: 'kaufen', arabic: 'يشتري', emoji: '🛍️', exampleSentenceGerman: 'Von meinem Taschengeld kaufe ich ein Kartenspiel.', exampleSentenceArabic: 'من مصروف جيبي أشتري لعبة أوراق ممتعة.' }
    ]
  },

  // 265. Shopping Dialogues & Polite Phrases (جريد 2 / 3)
  {
    id: 'curric_b09_265_shopping_dialogues',
    title: 'Gespräche beim Einkaufen',
    titleTranslation: 'حوارات وعبارات التسوق المهذبة للأطفال',
    gradeLevel: 'grade2',
    category: 'Einkaufen & Geld',
    description: 'العبارات الألمانية المهذبة للطلب والسؤال والمساعدة عند التسوق',
    emoji: '🗣️',
    items: [
      { id: 'b09_265_01', german: 'Ich möchte bitte...', arabic: 'أود من فضلك...', emoji: '🙋', exampleSentenceGerman: 'Ich möchte bitte zwei Brezeln.', exampleSentenceArabic: 'أود قطعتين من البريتزل من فضلك.' },
      { id: 'b09_265_02', german: 'Kann ich Ihnen helfen?', arabic: 'هل يمكنني مساعدة حضرتك؟', emoji: '💁', exampleSentenceGerman: 'Guten Tag, kann ich Ihnen helfen?', exampleSentenceArabic: 'نهارك سعيد، هل يمكنني مساعدة حضرتك؟' },
      { id: 'b09_265_03', german: 'Ich schaue mich nur um', arabic: 'أنا فقط ألقي نظرة للاستكشاف', emoji: '👀', exampleSentenceGerman: 'Danke, ich schaue mich erst einmal um.', exampleSentenceArabic: 'شكراً لك، أنا فقط ألقي نظرة أولاً.' },
      { id: 'b09_265_04', german: 'Haben Sie...?', arabic: 'هل لدى حضراتكم...؟', emoji: '❓', exampleSentenceGerman: 'Haben Sie noch bunte Malkästen da?', exampleSentenceArabic: 'هل يتوفر لديكم علب ألوان مائية بعد؟' },
      { id: 'b09_265_05', german: 'Wie viel macht das?', arabic: 'كم يبلغ المجموع الكلي للحساب؟', emoji: '🧮', exampleSentenceGerman: 'Wie viel macht das bitte zusammen?', exampleSentenceArabic: 'كم يبلغ الحساب الإجمالي معاً من فضلك؟' },
      { id: 'b09_265_06', german: 'Das macht... Euro', arabic: 'الحساب يبلغ... يورو', emoji: '💶', exampleSentenceGerman: 'Das macht zusammen drei Euro fünfzig.', exampleSentenceArabic: 'الحساب الإجمالي ثلاثة يورو وخمسون سنتاً.' },
      { id: 'b09_265_07', german: 'Stimmt so', arabic: 'احتفظ بالباقي / الحساب تمام', emoji: '👌', exampleSentenceGerman: 'Vielen Dank, das stimmt so!', exampleSentenceArabic: 'شكراً جزيلاً، احتفظ بالباقي من أجلك!' },
      { id: 'b09_265_08', german: 'Brauchen Sie eine Tüte?', arabic: 'هل تحتاج كيس تسوق؟', emoji: '🛍️', exampleSentenceGerman: 'Brauchen Sie eine Tüte für die Einkäufe?', exampleSentenceArabic: 'هل تحتاج كيس تسوق لحمل الأغراض؟' },
      { id: 'b09_265_09', german: 'Auf Wiedersehen!', arabic: 'إلى اللقاء مع السلامة!', emoji: '👋', exampleSentenceGerman: 'Schönen Tag noch und auf Wiedersehen!', exampleSentenceArabic: 'أتمنى لك يوماً سعيداً وإلى اللقاء!' },
      { id: 'b09_265_10', german: 'Gern geschehen!', arabic: 'على الرحب والسعة / عفواً!', emoji: '😊', exampleSentenceGerman: 'Vielen Dank für Ihre Hilfe! – Gern geschehen!', exampleSentenceArabic: 'شكراً لمساعدتك! – على الرحب والسعة دائماً!' }
    ]
  },

  // 266. Bakery & Pastry Purchases (جريد 1 / 2)
  {
    id: 'curric_b09_266_bakery_purchases',
    title: 'Beim Bäcker an der Theke',
    titleTranslation: 'عند المخبز أمام منصة العرض',
    gradeLevel: 'grade1',
    category: 'Einkaufen & Geld',
    description: 'طلب المخبوزات والخبز والحلويات الطازجة من المخبز الألماني',
    emoji: '🥨',
    items: [
      { id: 'b09_266_01', german: 'die Theke', arabic: 'طاولة العرض / الكاونتر', article: 'die', plural: 'die Theken', emoji: '🏪', exampleSentenceGerman: 'Hinter der Theke duftet es nach frischem Brot.', exampleSentenceArabic: 'خلف منصة العرض تفوح رائحة الخبز الطازج.' },
      { id: 'b09_266_02', german: 'das Vollkornbrot', arabic: 'خبز الحبوب الكاملة (القمح الكامل)', article: 'das', plural: 'die Vollkornbrote', emoji: '🍞', exampleSentenceGerman: 'Vollkornbrot ist gesund und schmeckt lecker.', exampleSentenceArabic: 'خبز الحبوب الكاملة صحي وطعمه لذيذ.' },
      { id: 'b09_266_03', german: 'das Schokocroissant', arabic: 'كرواسون الشوكولاتة', article: 'das', plural: 'die Schokocroissants', emoji: '🥐', exampleSentenceGerman: 'Am Sonntag esse ich gern ein Schokocroissant.', exampleSentenceArabic: 'يوم الأحد أحب تناول كرواسون الشوكولاتة.' },
      { id: 'b09_266_04', german: 'das Mohnbrötchen', arabic: 'لفافة خبز صغيرة ببذور الخشخاش', article: 'das', plural: 'die Mohnbrötchen', emoji: '🥯', exampleSentenceGerman: 'Papa bestellt zwei knusprige Mohnbrötchen.', exampleSentenceArabic: 'أبي يطلب لفافتي خبز مقرمشتين ببذور الخشخاش.' },
      { id: 'b09_266_05', german: 'die Laugenstange', arabic: 'أصابع خبز البريتزل المملح', article: 'die', plural: 'die Laugenstangen', emoji: '🥖', exampleSentenceGerman: 'Die Laugenstange schmeckt mir in der Schulpause.', exampleSentenceArabic: 'أصابع خبز البريتزل تعجبني في فسحة المدرسة.' },
      { id: 'b09_266_06', german: 'der Berliner / Krapfen', arabic: 'الدونات الألماني المحشو بالمربى', article: 'der', plural: 'die Berliner', emoji: '🍩', exampleSentenceGerman: 'Der Berliner ist mit Erdbeermarmelade gefüllt.', exampleSentenceArabic: 'الدونات الألماني محشو بمربى الفراولة.' },
      { id: 'b09_266_07', german: 'die Papiertüte', arabic: 'الكيس الورقي للمخبوزات', article: 'die', plural: 'die Papiertüten', emoji: '🛍️', exampleSentenceGerman: 'Der Bäcker legt die Brötchen in eine Papiertüte.', exampleSentenceArabic: 'الخباز يضع الأرغفة في كيس ورقي بني.' },
      { id: 'b09_266_08', german: 'geschnitten', arabic: 'مقطع إلى شرائح جاهزة', emoji: '🔪', exampleSentenceGerman: 'Möchten Sie das Brot ganz oder geschnitten?', exampleSentenceArabic: 'هل تود الخبز كاملاً أم مقطعاً إلى شرائح؟' },
      { id: 'b09_266_09', german: 'ofenfrisch', arabic: 'طازج وساخن من الفرن للتو', emoji: '🔥', exampleSentenceGerman: 'Die ofenfrischen Brezeln sind noch warm.', exampleSentenceArabic: 'قطع البريتزل الطازجة من الفرن لا تزال دافئة.' },
      { id: 'b09_266_10', german: 'die Bäckersfrau', arabic: 'سيدة المخبز / البائعة', article: 'die', plural: 'die Bäckersfrauen', emoji: '👩‍🍳', exampleSentenceGerman: 'Die freundliche Bäckersfrau schenkt mir einen Keks.', exampleSentenceArabic: 'سيدة المخبز الودودة تهدي لي قطعة بسكويت.' }
    ]
  },

  // 267. Clothing Store & Trying On (جريد 3 / 4)
  {
    id: 'curric_b09_267_clothing_store',
    title: 'Im Kleidergeschäft anprobieren',
    titleTranslation: 'قياس الملابس في متجر الأزياء',
    gradeLevel: 'grade3',
    category: 'Einkaufen & Geld',
    description: 'مقاسات الملابس وغرفة القياس واختيار ما يناسب الطفل',
    emoji: '👗',
    items: [
      { id: 'b09_267_01', german: 'die Umkleidekabine', arabic: 'غرفة قياس وتبديل الملابس', article: 'die', plural: 'die Umkleidekabinen', emoji: '🚪', exampleSentenceGerman: 'Ich gehe in die Umkleidekabine und probiere die Hose an.', exampleSentenceArabic: 'أدخل غرفة القياس لأجرب قياس البنطال.' },
      { id: 'b09_267_02', german: 'die Größe', arabic: 'المقاس / الحجم', article: 'die', plural: 'die Größen', emoji: '📏', exampleSentenceGerman: 'Welche Schuhgröße hast du denn zurzeit?', exampleSentenceArabic: 'ما هو مقاس حذائك حالياً؟' },
      { id: 'b09_267_03', german: 'anprobieren', arabic: 'يجرب القياس / يقيس قطعة ملابس', emoji: '👖', exampleSentenceGerman: 'Darf ich diese Winterjacke mal anprobieren?', exampleSentenceArabic: 'هل يمكنني تجربة قياس هذه السترة الشتوية؟' },
      { id: 'b09_267_04', german: 'passen', arabic: 'يناسب / يلائم في القياس', emoji: '👌', exampleSentenceGerman: 'Die neuen Turnschuhe passen mir wie angegossen.', exampleSentenceArabic: 'الحذاء الرياضي الجديد يناسب مقاسي تماماً.' },
      { id: 'b09_267_05', german: 'zu eng', arabic: 'ضيق أكثر من اللازم', emoji: '🤏', exampleSentenceGerman: 'Dieses T-Shirt ist mir leider etwas zu eng.', exampleSentenceArabic: 'هذا القميص ضيق عليّ قليلاً للأسف.' },
      { id: 'b09_267_06', german: 'zu weit', arabic: 'واسع / فضفاض أكثر من اللازم', emoji: '🎈', exampleSentenceGerman: 'Die Hose ist am Bund noch ein bisschen zu weit.', exampleSentenceArabic: 'البنطال واسع قليلاً عند الخصر.' },
      { id: 'b09_267_07', german: 'der Spiegel', arabic: 'المرآة', article: 'der', plural: 'die Spiegel', emoji: '🪞', exampleSentenceGerman: 'Im großen Spiegel betrachte ich die Jacke.', exampleSentenceArabic: 'في المرآة الكبيرة أتأمل مظهر السترة.' },
      { id: 'b09_267_08', german: 'der Kleiderbügel', arabic: 'شماعة الملابس', article: 'der', plural: 'die Kleiderbügel', emoji: '🪝', exampleSentenceGerman: 'Das Kleid hängt ordentlich auf dem Kleiderbügel.', exampleSentenceArabic: 'الفستان معلق بنظام على الشماعة.' },
      { id: 'b09_267_09', german: 'der Ständer', arabic: 'حامل تعليق الملابس بالمتجر', article: 'der', plural: 'die Ständer', emoji: '🏬', exampleSentenceGerman: 'Am Ständer hängen viele bunte T-Shirts.', exampleSentenceArabic: 'على الحامل توجد تيشرتات ملونة كثيرة.' },
      { id: 'b09_267_10', german: 'umtauschen', arabic: 'يستبدل القطعة بأخرى', emoji: '🔄', exampleSentenceGerman: 'Wir können die Mütze mit dem Kassenbon umtauschen.', exampleSentenceArabic: 'يمكننا استبدال القبعة بواسطة إيصال الشراء.' }
    ]
  },

  // 268. Stationery & Bookstore Shopping (جريد 2 / 3)
  {
    id: 'curric_b09_268_stationery_bookstore',
    title: 'Im Schreibwaren- und Buchladen',
    titleTranslation: 'في متجر الأدوات المدرسية والمكتبة',
    gradeLevel: 'grade2',
    category: 'Einkaufen & Geld',
    description: 'شراء الدفاتر والأقلام والقصص المصورة والملصقات',
    emoji: '📚',
    items: [
      { id: 'b09_268_01', german: 'die Buchhandlung', arabic: 'متجر بيع الكتب / المكتبة', article: 'die', plural: 'die Buchhandlungen', emoji: '📖', exampleSentenceGerman: 'In der Buchhandlung stöbere ich nach neuen Comics.', exampleSentenceArabic: 'في متجر الكتب أبحث عن قصص مصورة جديدة.' },
      { id: 'b09_268_02', german: 'das Comicbuch', arabic: 'القصة المصورة (كوميكس)', article: 'das', plural: 'die Comicbücher', emoji: '🦸', exampleSentenceGerman: 'Das Comicbuch hat viele lustige bunte Bilder.', exampleSentenceArabic: 'القصة المصورة مليئة بالرسوم الملونة المضحكة.' },
      { id: 'b09_268_03', german: 'das Lesezeichen', arabic: 'علامة القراءة / فاصل الكتب', article: 'das', plural: 'die Lesezeichen', emoji: '🔖', exampleSentenceGerman: 'Ich stecke mein Lesezeichen auf Seite zwanzig.', exampleSentenceArabic: 'أضع فاصل القراءة عند الصفحة العشرين.' },
      { id: 'b09_268_04', german: 'der Sticker / Aufkleber', arabic: 'الملصق الملون (ستيكر)', article: 'der', plural: 'die Sticker', emoji: '⭐', exampleSentenceGerman: 'Ich verziere mein Schulheft mit Glitzerstickern.', exampleSentenceArabic: 'أزين دفتري المدرسي بملصقات براقة.' },
      { id: 'b09_268_05', german: 'der Schreibblock', arabic: 'دفتر أوراق الملاحظات', article: 'der', plural: 'die Schreibblöcke', emoji: '🗒️', exampleSentenceGerman: 'Auf dem karierten Schreibblock rechne ich gern.', exampleSentenceArabic: 'على دفتر الملاحظات المربعات أحب حل الحساب.' },
      { id: 'b09_268_06', german: 'die Postkarte', arabic: 'البطاقة البريدية المصورة', article: 'die', plural: 'die Postkarten', emoji: '💌', exampleSentenceGerman: 'Ich schreibe Oma eine Postkarte aus den Ferien.', exampleSentenceArabic: 'أكتب لجدتي بطاقة بريدية من عطلتي.' },
      { id: 'b09_268_07', german: 'der Umschlag / Briefumschlag', arabic: 'مظروف الرسالة', article: 'der', plural: 'die Umschläge', emoji: '✉️', exampleSentenceGerman: 'Ich klebe den Briefumschlag sorgfältig zu.', exampleSentenceArabic: 'أغلق مظروف الرسالة بعناية وإحكام.' },
      { id: 'b09_268_08', german: 'die Briefmarke', arabic: 'طابع البريد', article: 'die', plural: 'die Briefmarken', emoji: '📫', exampleSentenceGerman: 'Oben rechts klebt die bunte Briefmarke.', exampleSentenceArabic: 'في أعلى اليمين يلصق طابع البريد الملون.' },
      { id: 'b09_268_09', german: 'der Kalender', arabic: 'التقويم السنوي / النتيجة', article: 'der', plural: 'die Kalender', emoji: '🗓️', exampleSentenceGerman: 'An der Wand hängt ein schöner Tierkalender.', exampleSentenceArabic: 'على الجدار يعلق تقويم سنوي جميل للحيوانات.' },
      { id: 'b09_268_10', german: 'die Glückwunschkarte', arabic: 'بطاقة التهنئة بالنجاح أو العيد', article: 'die', plural: 'die Glückwunschkarten', emoji: '🎉', exampleSentenceGerman: 'Wir schreiben eine bunte Glückwunschkarte zum Fest.', exampleSentenceArabic: 'نكتب بطاقة تهنئة ملونة بمناسبة العيد السعيد.' }
    ]
  },

  // 269. Quantities, Units & Packaging (جريد 3 / 4)
  {
    id: 'curric_b09_269_quantities_packaging',
    title: 'Verpackungen, Mengen und Portionen',
    titleTranslation: 'العبوات والتغليف والكميات والوحدات',
    gradeLevel: 'grade3',
    category: 'Einkaufen & Geld',
    description: 'أنواع العبوات الغذائية: زجاجة، علبة، كرتونة، برطمان، وكيس',
    emoji: '📦',
    items: [
      { id: 'b09_269_01', german: 'die Flasche', arabic: 'الزجاجة / القنينة', article: 'die', plural: 'die Flaschen', emoji: '🍾', exampleSentenceGerman: 'Eine Flasche Mineralwasser steht auf dem Tisch.', exampleSentenceArabic: 'زجاجة مياه معدنية موضوعة على الطاولة.' },
      { id: 'b09_269_02', german: 'die Dose', arabic: 'العلبة المعدنية (كان)', article: 'die', plural: 'die Dosen', emoji: '🥫', exampleSentenceGerman: 'In der Dose sind süße Erbsen und Möhren.', exampleSentenceArabic: 'في العلبة المعدنية توجد بسلة وجزر.' },
      { id: 'b09_269_03', german: 'das Glas (Gefäß)', arabic: 'برطمان زجاجي', article: 'das', plural: 'die Gläser', emoji: '🫙', exampleSentenceGerman: 'Ein Glas köstliche Erdbeermarmelade steht im Schrank.', exampleSentenceArabic: 'برطمان من مربى الفراولة اللذيذة في الخزانة.' },
      { id: 'b09_269_04', german: 'die Packung', arabic: 'العبوة / الباكتة', article: 'die', plural: 'die Packungen', emoji: '📦', exampleSentenceGerman: 'Wir kaufen eine neue Packung Haferflocken.', exampleSentenceArabic: 'نشتري عبوة جديدة من رقائق الشوفان.' },
      { id: 'b09_269_05', german: 'der Karton', arabic: 'كرتونة الحليب أو العصير', article: 'der', plural: 'die Kartons', emoji: '🧃', exampleSentenceGerman: 'Ein Karton Orangensaft reicht für das Frühstück.', exampleSentenceArabic: 'كرتونة من عصير البرتقال تكفي لإفطار العائلة.' },
      { id: 'b09_269_06', german: 'die Tube', arabic: 'الأنبوبة (معجون الأسنان أو الطماطم)', article: 'die', plural: 'die Tuben', emoji: '🧴', exampleSentenceGerman: 'Ich drücke Zahnpasta aus der Tube auf die Bürste.', exampleSentenceArabic: 'أضغط معجون الأسنان من الأنبوبة على الفرشاة.' },
      { id: 'b09_269_07', german: 'die Schachtel', arabic: 'علبة صغيرة (علبة كبريت أو ألوان)', article: 'die', plural: 'die Schachteln', emoji: '🗳️', exampleSentenceGerman: 'In der Schachtel liegen bunte Wachsmalkreiden.', exampleSentenceArabic: 'في العلبة توجد أقلام تلوين شمعية ملونة.' },
      { id: 'b09_269_08', german: 'der Becher', arabic: 'كوب زبادي / وعاء صغير', article: 'der', plural: 'die Becher', emoji: '🥣', exampleSentenceGerman: 'Ein kleiner Becher Joghurt schmeckt als Snack.', exampleSentenceArabic: 'كوب صغير من الزبادي شهي كوجبة خفيفة.' },
      { id: 'b09_269_09', german: 'das Netz', arabic: 'شبكة (برتقال أو ليمون)', article: 'das', plural: 'die Netze', emoji: '🍊', exampleSentenceGerman: 'Papa bringt ein ganzes Netz Orangen mit.', exampleSentenceArabic: 'أبي يحضر شبكة كاملة من البرتقال الطازج.' },
      { id: 'b09_269_10', german: 'die Tafel (Schokolade)', arabic: 'لوح الشوكولاتة', article: 'die', plural: 'die Tafeln', emoji: '🍫', exampleSentenceGerman: 'Wir teilen uns eine Tafel Vollmilchschokolade.', exampleSentenceArabic: 'نتشارك معاً لوح شوكولاتة بالحليب اللذيذة.' }
    ]
  },

  // 270. Comparisons & Degrees of Adjectives (جريد 3 / 4)
  {
    id: 'curric_b09_270_adjective_comparisons',
    title: 'Vergleiche: Gut, besser, am besten',
    titleTranslation: 'المقارنة والتفضيل بين الصفات للأطفال',
    gradeLevel: 'grade3',
    category: 'Adjektive & Beschreibungen',
    description: 'صيغ المقارنة والتفضيل الألمانية الشائعة (أكبر، أسرع، الأفضل، الأجمل)',
    emoji: '🏆',
    items: [
      { id: 'b09_270_01', german: 'gut', arabic: 'جيد', emoji: '👍', exampleSentenceGerman: 'Du kannst schon richtig gut lesen.', exampleSentenceArabic: 'أنت تستطيع القراءة بشكل جيد بالفعل.' },
      { id: 'b09_270_02', german: 'besser', arabic: 'أفضل / أحسن من', emoji: '🌟', exampleSentenceGerman: 'Mit Übung klappt das Rechnen immer besser.', exampleSentenceArabic: 'مع التدريب يصبح حل الحساب أفضل فأفضل.' },
      { id: 'b09_270_03', german: 'am besten', arabic: 'الأفضل على الإطلاق', emoji: '🥇', exampleSentenceGerman: 'Erdbeereis schmeckt mir am besten von allen.', exampleSentenceArabic: 'آيس كريم الفراولة يعجبني كأفضل نوع على الإطلاق.' },
      { id: 'b09_270_04', german: 'größer', arabic: 'أكبر حجماً من', emoji: '🐘', exampleSentenceGerman: 'Das Pferd ist größer als das Schaf.', exampleSentenceArabic: 'الحصان أكبر حجماً من الخروف.' },
      { id: 'b09_270_05', german: 'am größten', arabic: 'الأكبر حجماً على الإطلاق', emoji: '🐋', exampleSentenceGerman: 'Der Blauwal ist das größte Tier im Ozean.', exampleSentenceArabic: 'الحوت الأزرق هو الحيوان الأكبر في المحيط.' },
      { id: 'b09_270_06', german: 'schneller', arabic: 'أسرع من', emoji: '🏎️', exampleSentenceGerman: 'Der Zug ist viel schneller als das Fahrrad.', exampleSentenceArabic: 'القطار أسرع بكثير من الدراجة.' },
      { id: 'b09_270_07', german: 'am schnellsten', arabic: 'الأسرع على الإطلاق', emoji: '🚀', exampleSentenceGerman: 'Die Rakete fliegt am schnellsten ins Weltall.', exampleSentenceArabic: 'الصاروخ يطير بسرعة هي الأعلى إلى الفضاء.' },
      { id: 'b09_270_08', german: 'mehr', arabic: 'أكثر', emoji: '➕', exampleSentenceGerman: 'Ich habe mehr Murmeln als mein Bruder.', exampleSentenceArabic: 'لدي كرات زجاجية أكثر من أخي.' },
      { id: 'b09_270_09', german: 'am meisten', arabic: 'الأكثر على الإطلاق', emoji: '📊', exampleSentenceGerman: 'Wer hat am meisten Tore beim Fußball geschossen?', exampleSentenceArabic: 'من أحرز أكبر عدد من الأهداف في كرة القدم؟' },
      { id: 'b09_270_10', german: 'so ... wie', arabic: 'مثل / بنفس الدرجة (للتساوي)', emoji: '🪞', exampleSentenceGerman: 'Lukas rennt heute genauso schnell wie Tim.', exampleSentenceArabic: 'لوكاس يركض اليوم بنفس سرعة تيم تماماً.' }
    ]
  }
];
