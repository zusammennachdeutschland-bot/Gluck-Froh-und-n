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

export const BATCH_10_SETS: RawBatchSet[] = [
  // 271. European Neighbors & Countries (جريد 2 / 3)
  {
    id: 'curric_b10_271_european_countries',
    title: 'Unsere Nachbarländer und Europa',
    titleTranslation: 'بلدان الجوار وقارة أوروبا',
    gradeLevel: 'grade2',
    category: 'Länder & Kulturen',
    description: 'أسماء الدول والبلدان المجاورة باللغة الألمانية وعواصمها',
    emoji: '🇪🇺',
    items: [
      { id: 'b10_271_01', german: 'Deutschland', arabic: 'ألمانيا', emoji: '🇩🇪', exampleSentenceGerman: 'Deutschland liegt in der Mitte von Europa.', exampleSentenceArabic: 'ألمانيا تقع في وسط قارة أوروبا.' },
      { id: 'b10_271_02', german: 'Österreich', arabic: 'النمسا', emoji: '🇦🇹', exampleSentenceGerman: 'In Österreich gibt es viele hohe Berge und Alpen.', exampleSentenceArabic: 'في النمسا توجد جبال عالية كثيرة وسلسلة الألب.' },
      { id: 'b10_271_03', german: 'die Schweiz', arabic: 'سويسرا', emoji: '🇨🇭', exampleSentenceGerman: 'Die Schweiz ist berühmt für Schokolade und Uhren.', exampleSentenceArabic: 'سويسرا مشهورة بالشوكولاتة وصناعة الساعات.' },
      { id: 'b10_271_04', german: 'Frankreich', arabic: 'فرنسا', emoji: '🇫🇷', exampleSentenceGerman: 'In Frankreich steht der berühmte Eiffelturm.', exampleSentenceArabic: 'في فرنسا ينتصب برج إيفل الشهير.' },
      { id: 'b10_271_05', german: 'Italien', arabic: 'إيطاليا', emoji: '🇮🇹', exampleSentenceGerman: 'Aus Italien kommen Pizza und feine Spaghetti.', exampleSentenceArabic: 'من إيطاليا تأتي البيتزا ومكرونة الاسباجيتي اللذيذة.' },
      { id: 'b10_271_06', german: 'Spanien', arabic: 'إسبانيا', emoji: '🇪🇸', exampleSentenceGerman: 'In Spanien scheint im Sommer herrlich warm die Sonne.', exampleSentenceArabic: 'في إسبانيا تسطع شمس الصيف الدافئة الرائعة.' },
      { id: 'b10_271_07', german: 'die Niederlande', arabic: 'هولندا (الأراضي المنخفضة)', emoji: '🇳🇱', exampleSentenceGerman: 'In den Niederlanden fahren fast alle Leute Fahrrad.', exampleSentenceArabic: 'في هولندا يقود جميع السكان تقريباً الدراجات الهوائية.' },
      { id: 'b10_271_08', german: 'Polen', arabic: 'بولندا', emoji: '🇵🇱', exampleSentenceGerman: 'Polen ist ein östliches Nachbarland von Deutschland.', exampleSentenceArabic: 'بولندا بلد جار شرقي لألمانيا.' },
      { id: 'b10_271_09', german: 'das Land', arabic: 'البلد / الدولة', article: 'das', plural: 'die Länder', emoji: '🗺️', exampleSentenceGerman: 'Auf der Weltkarte entdecke ich viele Länder.', exampleSentenceArabic: 'على خريطة العالم أكتشف دولاً كثيرة.' },
      { id: 'b10_271_10', german: 'die Flagge / Fahne', arabic: 'العلم / الراية الوطنية', article: 'die', plural: 'die Flaggen', emoji: '🚩', exampleSentenceGerman: 'Die deutsche Flagge hat Schwarz, Rot und Gold.', exampleSentenceArabic: 'العلم الألماني يتكون من الأسود والأحمر والذهبي.' }
    ]
  },

  // 272. World Continents & Oceans (جريد 3 / 4)
  {
    id: 'curric_b10_272_continents_oceans',
    title: 'Kontinente und Weltmeere',
    titleTranslation: 'قارات العالم والمحيطات الكبرى',
    gradeLevel: 'grade3',
    category: 'Länder & Kulturen',
    description: 'أسماء القارات السبع والمحيطات الشاسعة على كوكب الأرض',
    emoji: '🌍',
    items: [
      { id: 'b10_272_01', german: 'der Kontinent', arabic: 'القارة', article: 'der', plural: 'die Kontinente', emoji: '🗺️', exampleSentenceGerman: 'Es gibt sieben große Kontinente auf unserer Erde.', exampleSentenceArabic: 'توجد سبع قارات كبرى على كوكبنا الأرض.' },
      { id: 'b10_272_02', german: 'Afrika', arabic: 'قارة إفريقيا', emoji: '🌍', exampleSentenceGerman: 'In Afrika leben Löwen, Elefanten und Zebras.', exampleSentenceArabic: 'في إفريقيا تعيش الأسود والفيلة والحمير الوحشية.' },
      { id: 'b10_272_03', german: 'Asien', arabic: 'قارة آسيا', emoji: '🌏', exampleSentenceGerman: 'Asien ist der flächenmäßig größte Kontinent der Erde.', exampleSentenceArabic: 'آسيا هي أكبر قارات الأرض مساحةً.' },
      { id: 'b10_272_04', german: 'Europa', arabic: 'قارة أوروبا', emoji: '🇪🇺', exampleSentenceGerman: 'Wir leben und lernen auf dem Kontinent Europa.', exampleSentenceArabic: 'نحن نعيش ونتعلم في قارة أوروبا.' },
      { id: 'b10_272_05', german: 'Nordamerika', arabic: 'أمريكا الشمالية', emoji: '🌎', exampleSentenceGerman: 'Nordamerika hat weite Wälder und riesige Seen.', exampleSentenceArabic: 'أمريكا الشمالية بها غابات شاسعة وبحيرات هائلة.' },
      { id: 'b10_272_06', german: 'Südamerika', arabic: 'أمريكا الجنوبية', emoji: '🌎', exampleSentenceGerman: 'Der Amazonas fließt durch den Dschungel von Südamerika.', exampleSentenceArabic: 'نهر الأمازون يتدفق عبر أدغال أمريكا الجنوبية.' },
      { id: 'b10_272_07', german: 'Australien', arabic: 'أستراليا', emoji: '🦘', exampleSentenceGerman: 'In Australien hüpfen viele Kängurus und Koalas.', exampleSentenceArabic: 'في أستراليا تقفز حيوانات الكنغر وتعيش الكوالا.' },
      { id: 'b10_272_08', german: 'die Antarktis', arabic: 'القارة القطبية الجنوبية', emoji: '🐧', exampleSentenceGerman: 'In der eisigen Antarktis wohnen die Pinguine.', exampleSentenceArabic: 'في القارة القطبية الجنوبية الجليدية تعيش طيور البطريق.' },
      { id: 'b10_272_09', german: 'der Ozean / das Weltmeer', arabic: 'المحيط / البحر العالمي', article: 'der', plural: 'die Ozeane', emoji: '🌊', exampleSentenceGerman: 'Der Pazifische Ozean ist das größte Meer der Erde.', exampleSentenceArabic: 'المحيط الهادئ هو أكبر مسطح مائي على وجه الأرض.' },
      { id: 'b10_272_10', german: 'der Globus', arabic: 'الكرة الأرضية المجسمة', article: 'der', plural: 'die Globen', emoji: '🌐', exampleSentenceGerman: 'Ich drehe den Globus und suche mein Heimatland.', exampleSentenceArabic: 'أدير مجسم الكرة الأرضية وأبحث عن وطني الأم.' }
    ]
  },

  // 273. Languages & Mother Tongues (جريد 2 / 3)
  {
    id: 'curric_b10_273_languages_speaking',
    title: 'Sprachen der Welt sprechen',
    titleTranslation: 'لغات العالم والتحدث بلغات متعددة',
    gradeLevel: 'grade2',
    category: 'Länder & Kulturen',
    description: 'أسماء اللغات والحديث بعدة لغات واللغة الأم للأطفال',
    emoji: '💬',
    items: [
      { id: 'b10_273_01', german: 'die Sprache', arabic: 'اللغة', article: 'die', plural: 'die Sprachen', emoji: '🗣️', exampleSentenceGerman: 'Sprachen verbinden Menschen auf der ganzen Welt.', exampleSentenceArabic: 'اللغات تربط الناس في كل أنحاء العالم.' },
      { id: 'b10_273_02', german: 'Deutsch', arabic: 'اللغة الألمانية', emoji: '🇩🇪', exampleSentenceGerman: 'Deutsch lernen macht mit Glück Teacher großen Spaß!', exampleSentenceArabic: 'تعلم الألمانية ممتع جداً مع غلوك تيتشر!' },
      { id: 'b10_273_03', german: 'Arabisch', arabic: 'اللغة العربية', emoji: '🌙', exampleSentenceGerman: 'Arabisch ist eine wunderschöne und alte Sprache.', exampleSentenceArabic: 'اللغة العربية لغة جميلة وعريقة للغاية.' },
      { id: 'b10_273_04', german: 'Englisch', arabic: 'اللغة الإنجليزية', emoji: '🇬🇧', exampleSentenceGerman: 'In der Schule lernen wir auch Lieder auf Englisch.', exampleSentenceArabic: 'في المدرسة نتعلم أيضاً أغاني باللغة الإنجليزية.' },
      { id: 'b10_273_05', german: 'Französisch', arabic: 'اللغة الفرنسية', emoji: '🥖', exampleSentenceGerman: 'Bonjour heißt Hallo auf Französisch.', exampleSentenceArabic: 'بونجور تعني مرحباً باللغة الفرنسية.' },
      { id: 'b10_273_06', german: 'Spanisch', arabic: 'اللغة الإسبانية', emoji: '💃', exampleSentenceGerman: 'Hola ist die fröhliche Begrüßung auf Spanisch.', exampleSentenceArabic: 'أولا هي التحية المرحة باللغة الإسبانية.' },
      { id: 'b10_273_07', german: 'die Muttersprache', arabic: 'اللغة الأم', article: 'die', plural: 'die Muttersprachen', emoji: '👶', exampleSentenceGerman: 'Meine Muttersprache habe ich von meinen Eltern gelernt.', exampleSentenceArabic: 'لغتي الأم تعلمتها من والديّ.' },
      { id: 'b10_273_08', german: 'mehrsprachig', arabic: 'متعدد اللغات', emoji: '🧠', exampleSentenceGerman: 'Viele Kinder wachsen heute ganz natürlich mehrsprachig auf.', exampleSentenceArabic: 'كثير من الأطفال ينشؤون اليوم متعددي اللغات بشكل طبيعي.' },
      { id: 'b10_273_09', german: 'verstehen', arabic: 'يفهم / يستوعب', emoji: '💡', exampleSentenceGerman: 'Ich verstehe jetzt schon viele deutsche Sätze.', exampleSentenceArabic: 'أنا أفهم الآن بالفعل جملاً ألمانية كثيرة.' },
      { id: 'b10_273_10', german: 'übersetzen', arabic: 'يترجم بين لغتين', emoji: '🔄', exampleSentenceGerman: 'Kannst du dieses deutsche Wort ins Arabische übersetzen?', exampleSentenceArabic: 'هل يمكنك ترجمة هذه الكلمة الألمانية إلى العربية؟' }
    ]
  },

  // 274. Celebrations, Traditions & Festivals (جريد 1 / 2)
  {
    id: 'curric_b10_274_celebrations_festivals',
    title: 'Feste, Bräuche und Feiern',
    titleTranslation: 'الأعياد والاحتفالات والمناسبات للأطفال',
    gradeLevel: 'grade1',
    category: 'Länder & Kulturen',
    description: 'المناسبات والأعياد مثل أعياد الميلاد وعيد الفطر وفانوس مارتن وسانتا',
    emoji: '🎉',
    items: [
      { id: 'b10_274_01', german: 'das Fest', arabic: 'العيد / الاحتفال / المهرجان', article: 'das', plural: 'die Feste', emoji: '🎪', exampleSentenceGerman: 'Heute feiern wir ein großes Sommerfest an der Schule.', exampleSentenceArabic: 'اليوم نحتفل بمهرجان صيفي كبير في المدرسة.' },
      { id: 'b10_274_02', german: 'der Geburtstag', arabic: 'عيد الميلاد (يوم المولد)', article: 'der', plural: 'die Geburtstage', emoji: '🎂', exampleSentenceGerman: 'Herzlichen Glückwunsch zum siebten Geburtstag!', exampleSentenceArabic: 'تهانينا القلبية بمناسبة عيد ميلادك السابع!' },
      { id: 'b10_274_03', german: 'die Einladung', arabic: 'بطاقة الدعوة للحفل', article: 'die', plural: 'die Einladungen', emoji: '💌', exampleSentenceGerman: 'Ich habe alle meine Freunde per Einladung eingeladen.', exampleSentenceArabic: 'دعوت جميع أصدقائي بواسطة بطاقات دعوة لطيفة.' },
      { id: 'b10_274_04', german: 'die Laterne', arabic: 'الفانوس (في مسيرة مارتن)', article: 'die', plural: 'die Laternen', emoji: '🏮', exampleSentenceGerman: 'Im Herbst basteln wir bunte Laternen und ziehen durch die Straßen.', exampleSentenceArabic: 'في الخريف نصنع فوانيس ملونة ونسير بها في الشوارع.' },
      { id: 'b10_274_05', german: 'das Zuckerfest / Eid', arabic: 'عيد الفطر المبارك', article: 'das', plural: '-', emoji: '🌙', exampleSentenceGerman: 'Zum Zuckerfest besuchen wir unsere Verwandten und essen Süßes.', exampleSentenceArabic: 'في عيد الفطر نزور أقاربنا ونتناول الحلوى اللذيذة.' },
      { id: 'b10_274_06', german: 'die Schultüte', arabic: 'مخروط بداية المدرسة (تقليد ألماني)', article: 'die', plural: 'die Schultüten', emoji: '🎒', exampleSentenceGerman: 'Am ersten Schultag trage ich stolz meine bunte Schultüte.', exampleSentenceArabic: 'في أول يوم مدرسة أحمل بفخر مخروطي الملون المليء بالحلوى.' },
      { id: 'b10_274_07', german: 'das Kostüm', arabic: 'الزي التنكري / الزي الاحتفالي', article: 'das', plural: 'die Kostüme', emoji: '🦸', exampleSentenceGerman: 'Zu Karneval ziehe ich mein Superhelden-Kostüm an.', exampleSentenceArabic: 'في الكرنفال أرتدي زي البطل الخارق.' },
      { id: 'b10_274_08', german: 'das Feuerwerk', arabic: 'الألعاب النارية (في رأس السنة)', article: 'das', plural: 'die Feuerwerke', emoji: '🎆', exampleSentenceGerman: 'In der Silvesternacht leuchtet das bunte Feuerwerk am Himmel.', exampleSentenceArabic: 'في ليلة رأس السنة تضيء الألعاب النارية الملونة سماء المدينة.' },
      { id: 'b10_274_09', german: 'die Kerze', arabic: 'الشمعة', article: 'die', plural: 'die Kerzen', emoji: '🕯️', exampleSentenceGerman: 'Ich puste alle Kerzen auf der Torte auf einmal aus.', exampleSentenceArabic: 'أنفخ جميع الشموع على الكعكة دفعة واحدة.' },
      { id: 'b10_274_10', german: 'der Kuchen', arabic: 'الكعكة / التورتة', article: 'der', plural: 'die Kuchen', emoji: '🍰', exampleSentenceGerman: 'Mama hat einen saftigen Schokokuchen gebacken.', exampleSentenceArabic: 'ماما خبزت كعكة شوكولاتة لذيذة للغاية.' }
    ]
  },

  // 275. Musical Instruments & Kids Orchestra (جريد 2 / 3)
  {
    id: 'curric_b10_275_musical_instruments',
    title: 'Musikinstrumente im Kinderorchester',
    titleTranslation: 'الآلات الموسيقية في أوركسترا الأطفال',
    gradeLevel: 'grade2',
    category: 'Musik & Kunst',
    description: 'البيانو والجيتار والكمان والطبول والمثلث والفلوت والموسيقى',
    emoji: '🎵',
    items: [
      { id: 'b10_275_01', german: 'das Instrument', arabic: 'الآلة الموسيقية', article: 'das', plural: 'die Instrumente', emoji: '🎻', exampleSentenceGerman: 'Jedes Kind probiert ein anderes Instrument aus.', exampleSentenceArabic: 'كل طفل يجرب آلة موسيقية مختلفة.' },
      { id: 'b10_275_02', german: 'das Klavier', arabic: 'البيانو', article: 'das', plural: 'die Klaviere', emoji: '🎹', exampleSentenceGerman: 'Ich drücke die schwarzen und weißen Tasten am Klavier.', exampleSentenceArabic: 'أضغط على المفاتيح البيضاء والسوداء في البيانو.' },
      { id: 'b10_275_03', german: 'die Gitarre', arabic: 'الجيتار', article: 'die', plural: 'die Gitarren', emoji: '🎸', exampleSentenceGerman: 'Auf der Gitarre zupfe ich sechs klangvolle Saiten.', exampleSentenceArabic: 'على الجيتار أعزف على ستة أوتار رنانة.' },
      { id: 'b10_275_04', german: 'die Geige / Violine', arabic: 'الكمان', article: 'die', plural: 'die Geigen', emoji: '🎻', exampleSentenceGerman: 'Mit dem Bogen streicht man sanft über die Geige.', exampleSentenceArabic: 'بالقوس يمر المرء بلطف على أوتار الكمان.' },
      { id: 'b10_275_05', german: 'die Blockflöte', arabic: 'الناي / الفلوت الخشبي المدرسي', article: 'die', plural: 'die Blockflöten', emoji: '🪈', exampleSentenceGerman: 'In der Grundschule lernen wir die Blockflöte spielen.', exampleSentenceArabic: 'في المدرسة الابتدائية نتعلم العزف على الفلوت.' },
      { id: 'b10_275_06', german: 'das Schlagzeug', arabic: 'مجموعة الطبول والدرامز', article: 'das', plural: 'die Schlagzeuge', emoji: '🥁', exampleSentenceGerman: 'Auf dem Schlagzeug trommelt Felix den schnellen Takt.', exampleSentenceArabic: 'على الطبول يقرع فيليكس الإيقاع السريع.' },
      { id: 'b10_275_07', german: 'die Trompete', arabic: 'البوق / الترومبيت النحاسي', article: 'die', plural: 'die Trompeten', emoji: '🎺', exampleSentenceGerman: 'Die Trompete glänzt golden und klingt sehr laut.', exampleSentenceArabic: 'البوق يلمع بلون ذهبي وصوته قوي جداً.' },
      { id: 'b10_275_08', german: 'die Triangel', arabic: 'المثلث الإيقاعي الصغير', article: 'die', plural: 'die Triangeln', emoji: '🔺', exampleSentenceGerman: 'Kling-klang macht die kleine Triangel im Takt.', exampleSentenceArabic: 'ترن آلة المثلث الصغيرة بنغمات عذبة على الإيقاع.' },
      { id: 'b10_275_09', german: 'das Xylophon', arabic: 'الإكسيليفون الخشبي الملون', article: 'das', plural: 'die Xylophone', emoji: '🎼', exampleSentenceGerman: 'Mit Holzschlägeln spiele ich eine Tonleiter auf dem Xylophon.', exampleSentenceArabic: 'بمضارب الخشب أعزف سلماً موسيقياً على الإكسيليفون.' },
      { id: 'b10_275_10', german: 'der Dirigent', arabic: 'قائد الأوركسترا (المايسترو)', article: 'der', plural: 'die Dirigenten', emoji: '🪄', exampleSentenceGerman: 'Der Dirigent hebt den Taktstock und alle fangen an.', exampleSentenceArabic: 'قائد الأوركسترا يرفع عصا الإيقاع ويبدأ الجميع بالعزف.' }
    ]
  },

  // 276. Children's Theater & Puppet Show (جريد 2 / 3)
  {
    id: 'curric_b10_276_theater_puppet_show',
    title: 'Kindertheater und Puppenspiel',
    titleTranslation: 'مسرح الأطفال ومسرح العرائس',
    gradeLevel: 'grade2',
    category: 'Musik & Kunst',
    description: 'المسرح والعرائس المتحركة والستارة والجمهور والتصفيق والأداء',
    emoji: '🎭',
    items: [
      { id: 'b10_276_01', german: 'die Bühne', arabic: 'خشبة المسرح', article: 'die', plural: 'die Bühnen', emoji: '🎭', exampleSentenceGerman: 'Auf der Bühne führen die Kinder ihr Märchen auf.', exampleSentenceArabic: 'على خشبة المسرح يؤدي الأطفال مسرحيتهم الخيالية.' },
      { id: 'b10_276_02', german: 'der Vorhang', arabic: 'ستارة المسرح', article: 'der', plural: 'die Vorhänge', emoji: '🎪', exampleSentenceGerman: 'Der rote Vorhang öffnet sich langsam.', exampleSentenceArabic: 'الستارة الحمراء تفتح ببطء إيذاناً ببدء العرض.' },
      { id: 'b10_276_03', german: 'die Handpuppe', arabic: 'دمية القفاز / عروسة اليد', article: 'die', plural: 'die Handpuppen', emoji: '🪆', exampleSentenceGerman: 'Kasperl ist eine berühmte deutsche Handpuppe.', exampleSentenceArabic: 'كاسبرل شخصية عروسة يد شهيرة في ألمانيا.' },
      { id: 'b10_276_04', german: 'die Marionette', arabic: 'دمية الخيوط (الماريونيت)', article: 'die', plural: 'die Marionetten', emoji: '🧵', exampleSentenceGerman: 'An dünnen Fäden tanzt die Marionette im Takt.', exampleSentenceArabic: 'بخيوط رفيعة ترقص دمية الماريونيت على الإيقاع.' },
      { id: 'b10_276_05', german: 'das Theaterstück', arabic: 'المسرحية', article: 'das', plural: 'die Theaterstücke', emoji: '📜', exampleSentenceGerman: 'Wir proben das Theaterstück für das Schulfest.', exampleSentenceArabic: 'نتدرب على المسرحية من أجل حفل المدرسة.' },
      { id: 'b10_276_06', german: 'die Rolle', arabic: 'الدور التمثيلي', article: 'die', plural: 'die Rollen', emoji: '👑', exampleSentenceGerman: 'Mia spielt die Rolle der klugen Prinzessin.', exampleSentenceArabic: 'ميا تؤدي دور الأميرة الذكية.' },
      { id: 'b10_276_07', german: 'die Maske', arabic: 'القناع المسرحي', article: 'die', plural: 'die Masken', emoji: '👺', exampleSentenceGerman: 'Der Schauspieler trägt eine goldene Maske.', exampleSentenceArabic: 'الممثل يرتدي قناعاً ذهبياً مميزاً.' },
      { id: 'b10_276_08', german: 'das Publikum', arabic: 'الجمهور والمشاهدون', article: 'das', plural: '-', emoji: '👥', exampleSentenceGerman: 'Das Publikum schaut gebannt auf die Vorstellung.', exampleSentenceArabic: 'الجمهور يتابع العرض بشغف واهتمام.' },
      { id: 'b10_276_09', german: 'der Applaus / Beifall', arabic: 'التصفيق الحار والاستحسان', article: 'der', plural: '-', emoji: '👏', exampleSentenceGerman: 'Am Ende klatschen alle laut und spenden Applaus.', exampleSentenceArabic: 'في النهاية يصفق الجميع بحرارة تشجيعاً للممثلين.' },
      { id: 'b10_276_10', german: 'sich verbeugen', arabic: 'ينحني تحيةً للجمهور', emoji: '🙇‍♂️', exampleSentenceGerman: 'Die kleinen Schauspieler verbeugen sich stolz vor den Eltern.', exampleSentenceArabic: 'الممثلون الصغار ينحنون بفخر أمام أولياء الأمور.' }
    ]
  },

  // 277. Art Studio & Painting Techniques (جريد 3 / 4)
  {
    id: 'curric_b10_277_art_studio',
    title: 'Im Kunstatelier: Farben und Meisterwerke',
    titleTranslation: 'في مرسم الفن: الألوان والتحف الإبداعية',
    gradeLevel: 'grade3',
    category: 'Musik & Kunst',
    description: 'أدوات المرسم المتقدمة: حامل اللوحات وقماش الرسم ومزج الألوان المائية',
    emoji: '🎨',
    items: [
      { id: 'b10_277_01', german: 'die Staffelei', arabic: 'حامل لوحة الرسم (الستاند)', article: 'die', plural: 'die Staffeleien', emoji: '📐', exampleSentenceGerman: 'Auf der Staffelei steht die frisch bemalte Leinwand.', exampleSentenceArabic: 'على حامل اللوحات يرتكز قماش الرسم المطلي حديثاً.' },
      { id: 'b10_277_02', german: 'die Leinwand', arabic: 'قماش الرسم المشدود (الكانفاس)', article: 'die', plural: 'die Leinwände', emoji: '🖼️', exampleSentenceGerman: 'Ich male ein farbenfrohes Blumenfeld auf Leinwand.', exampleSentenceArabic: 'أرسم حقلاً مليئاً بالزهور الملونة على الكانفاس.' },
      { id: 'b10_277_03', german: 'die Farbpalette', arabic: 'باليتة مزج الألوان', article: 'die', plural: 'die Farbpaletten', emoji: '🎨', exampleSentenceGerman: 'Auf der Palette mische ich Blau und Gelb zu Grün.', exampleSentenceArabic: 'على الباليتة أخلط الأزرق مع الأصفر لأحصل على الأخضر.' },
      { id: 'b10_277_04', german: 'das Meisterwerk', arabic: 'التحفة الفنية / العمل الرائع', article: 'das', plural: 'die Meisterwerke', emoji: '⭐', exampleSentenceGerman: 'Deine Zeichnung ist ein echtes kleines Meisterwerk!', exampleSentenceArabic: 'رسمتك تحفة فنية صغيرة حقيقية!' },
      { id: 'b10_277_05', german: 'die Wasserfarbe / Aquarell', arabic: 'الألوان المائية', article: 'die', plural: 'die Wasserfarben', emoji: '🖌️', exampleSentenceGerman: 'Mit viel Wasser verlaufen die Aquarellfarben sanft.', exampleSentenceArabic: 'بالماء تندمج الألوان المائية برقة وسلاسة.' },
      { id: 'b10_277_06', german: 'die Skizze', arabic: 'الرسم الأولي (اسكتش بالقلم)', article: 'die', plural: 'die Skizzen', emoji: '✏️', exampleSentenceGerman: 'Zuerst mache ich eine leichte Bleistiftskizze.', exampleSentenceArabic: 'أولاً أقوم بعمل اسكتش ورسم أولي خفيف بالقلم الرصاص.' },
      { id: 'b10_277_07', german: 'der Wasserbecher', arabic: 'كوب تنظيف فرش الرسم بالماء', article: 'der', plural: 'die Wasserbecher', emoji: '🥛', exampleSentenceGerman: 'Im Wasserbecher wasche ich die Farbe vom Pinsel.', exampleSentenceArabic: 'في كوب الماء أغسل اللون عن ريشة الرسم.' },
      { id: 'b10_277_08', german: 'der Malkittel', arabic: 'مريلة / رداء الرسم لحماية الملابس', article: 'der', plural: 'die Malkittel', emoji: '🥼', exampleSentenceGerman: 'Der Malkittel schützt meine Kleidung vor Farbklecksen.', exampleSentenceArabic: 'مريلة الرسم تحمي ملابسي من بقع الألوان.' },
      { id: 'b10_277_09', german: 'die Kunstausstellung', arabic: 'معرض الفنون المدرسية', article: 'die', plural: 'die Kunstausstellungen', emoji: '🏛️', exampleSentenceGerman: 'Im Schulflur hängen unsere Bilder wie in einer Galerie.', exampleSentenceArabic: 'في ممر المدرسة تعرض لوحاتنا كأنها في معرض فني.' },
      { id: 'b10_277_10', german: 'mischen', arabic: 'يمزج / يخلط الألوان', emoji: '🥣', exampleSentenceGerman: 'Wenn wir Rot und Weiß mischen, entsteht schönes Rosa.', exampleSentenceArabic: 'عندما نخلط الأحمر والأبيض، نحصل على وردي جميل.' }
    ]
  },

  // 278. Computers & Digital Hardware (جريد 2 / 3)
  {
    id: 'curric_b10_278_computer_hardware',
    title: 'Computer und digitale Geräte',
    titleTranslation: 'الكمبيوتر والأجهزة الرقمية',
    gradeLevel: 'grade2',
    category: 'Digitale Welt & Technik',
    description: 'أجزاء الكمبيوتر والشاشة ولوحة المفاتيح والفأرة والتابلت',
    emoji: '💻',
    items: [
      { id: 'b10_278_01', german: 'der Computer / Rechner', arabic: 'الكمبيوتر / الحاسوب', article: 'der', plural: 'die Computer', emoji: '🖥️', exampleSentenceGerman: 'Im Computerraum der Schule üben wir Tippen.', exampleSentenceArabic: 'في غرفة حاسوب المدرسة نتدرب على الطباعة.' },
      { id: 'b10_278_02', german: 'das Tablet', arabic: 'التابلت / الحاسوب اللوحي', article: 'das', plural: 'die Tablets', emoji: '📱', exampleSentenceGerman: 'Auf dem Tablet löse ich spannende Mathe-Rätsel.', exampleSentenceArabic: 'على التابلت أحل ألغاز رياضيات مشوقة.' },
      { id: 'b10_278_03', german: 'die Tastatur', arabic: 'لوحة المفاتيح (الكيبورد)', article: 'die', plural: 'die Tastaturen', emoji: '⌨️', exampleSentenceGerman: 'Mit beiden Händen tippe ich Buchstaben auf der Tastatur.', exampleSentenceArabic: 'بكلتا يدي أكتب الحروف على لوحة المفاتيح.' },
      { id: 'b10_278_04', german: 'die Maus (Computer)', arabic: 'فأرة الكمبيوتر (الماوس)', article: 'die', plural: 'die Mäuse', emoji: '🖱️', exampleSentenceGerman: 'Klick mit der Maus auf das richtige Bild!', exampleSentenceArabic: 'انقر بالفأرة على الصورة الصحيحة!' },
      { id: 'b10_278_05', german: 'der Bildschirm / Monitor', arabic: 'شاشة العرض (المونيتور)', article: 'der', plural: 'die Bildschirme', emoji: '🖥️', exampleSentenceGerman: 'Auf dem Bildschirm leuchten bunte Grafiken.', exampleSentenceArabic: 'على الشاشة تضيء رسومات ملونة واضحة.' },
      { id: 'b10_278_06', german: 'der Kopfhörer', arabic: 'سماعات الرأس', article: 'der', plural: 'die Kopfhörer', emoji: '🎧', exampleSentenceGerman: 'Mit Kopfhörern höre ich die deutsche Aussprache klar.', exampleSentenceArabic: 'بسماعات الرأس أستمع إلى النطق الألماني بوضوح.' },
      { id: 'b10_278_07', german: 'das Smartphone / Handy', arabic: 'الهاتف الذكي / الموبايل', article: 'das', plural: 'die Smartphones', emoji: '📱', exampleSentenceGerman: 'Mama ruft mit dem Smartphone bei Oma an.', exampleSentenceArabic: 'ماما تتصل بجدتي باستخدام الهاتف الذكي.' },
      { id: 'b10_278_08', german: 'das Ladekabel', arabic: 'كابل الشحن', article: 'das', plural: 'die Ladekabel', emoji: '🔌', exampleSentenceGerman: 'Ich stecke das Ladekabel ein, damit der Akku lädt.', exampleSentenceArabic: 'أوصل كابل الشاحن حتى يتم شحن البطارية.' },
      { id: 'b10_278_09', german: 'der Drucker', arabic: 'طابعة الأوراق', article: 'der', plural: 'die Drucker', emoji: '🖨️', exampleSentenceGerman: 'Der Drucker druckt unsere Ausmalbilder aus.', exampleSentenceArabic: 'الطابعة تطبع أوراق التلوين الجميلة لنا.' },
      { id: 'b10_278_10', german: 'der Lautsprecher', arabic: 'مكبر الصوت (السماعة الخارجية)', article: 'der', plural: 'die Lautsprecher', emoji: '🔊', exampleSentenceGerman: 'Aus dem Lautsprecher ertönt fröhliche Kindermusik.', exampleSentenceArabic: 'من مكبر الصوت تصدح موسيقى أطفال مرحة.' }
    ]
  },

  // 279. Digital Learning & Safe Internet (جريد 3 / 4)
  {
    id: 'curric_b10_279_digital_learning',
    title: 'Digitales Lernen und sicheres Internet',
    titleTranslation: 'التعلم الرقمي واستخدام الإنترنت الآمن للأطفال',
    gradeLevel: 'grade3',
    category: 'Digitale Welt & Technik',
    description: 'مفردات تطبيقات التعلم وكلمة المرور والبحث وتصفح المحتوى المفيد',
    emoji: '🌐',
    items: [
      { id: 'b10_279_01', german: 'das Internet', arabic: 'شبكة الإنترنت', article: 'das', plural: '-', emoji: '🌐', exampleSentenceGerman: 'Im Internet recherchieren wir für das Tierprojekt.', exampleSentenceArabic: 'على الإنترنت نبحث عن معلومات لمشروع الحيوانات.' },
      { id: 'b10_279_02', german: 'die Lern-App', arabic: 'تطبيق التعلم التعليمي', article: 'die', plural: 'die Lern-Apps', emoji: '📲', exampleSentenceGerman: 'Glück Teacher ist eine tolle deutsche Lern-App.', exampleSentenceArabic: 'غلوك تيتشر تطبيق رائع لتعلم اللغة الألمانية.' },
      { id: 'b10_279_03', german: 'das Passwort', arabic: 'كلمة السر / المرور الآمنة', article: 'das', plural: 'die Passwörter', emoji: '🔑', exampleSentenceGerman: 'Ein gutes Passwort verrät man niemandem.', exampleSentenceArabic: 'كلمة المرور القوية لا نخبرها لأي شخص أبداً.' },
      { id: 'b10_279_04', german: 'die Webseite', arabic: 'الموقع الإلكتروني', article: 'die', plural: 'die Webseiten', emoji: '💻', exampleSentenceGerman: 'Auf der Schulseite stehen alle Termine.', exampleSentenceArabic: 'على موقع المدرسة توجد كل المواعيد الهامة.' },
      { id: 'b10_279_05', german: 'die E-Mail', arabic: 'البريد الإلكتروني', article: 'die', plural: 'die E-Mails', emoji: '📧', exampleSentenceGerman: 'Der Lehrer schickt den Eltern eine kurze E-Mail.', exampleSentenceArabic: 'المعلم يرسل رسالة بريد إلكتروني قصيرة للأهل.' },
      { id: 'b10_279_06', german: 'die Nachricht', arabic: 'الرسالة النصية / الخبر', article: 'die', plural: 'die Nachrichten', emoji: '💬', exampleSentenceGerman: 'Ich bekomme eine nette Nachricht von meiner Cousine.', exampleSentenceArabic: 'تصلني رسالة لطيفة من ابنة عمتي.' },
      { id: 'b10_279_07', german: 'speichern', arabic: 'يحفظ الملفات / يسجل البيانات', emoji: '💾', exampleSentenceGerman: 'Vergiss nicht dein fertiges Bild abzuspeichern!', exampleSentenceArabic: 'لا تنسَ حفظ رسمتك المكتملة على الجهاز!' },
      { id: 'b10_279_08', german: 'die Kamera (Webcam)', arabic: 'الكاميرا الرقمية', article: 'die', plural: 'die Kameras', emoji: '📷', exampleSentenceGerman: 'In der Videostunde winken wir in die Kamera.', exampleSentenceArabic: 'في حصة الفيديو نلوح بأيدينا أمام الكاميرا.' },
      { id: 'b10_279_09', german: 'das Mikrofon', arabic: 'الميكروفون الصوتي', article: 'das', plural: 'die Mikrofone', emoji: '🎙️', exampleSentenceGerman: 'Schalte bitte dein Mikrofon ein, wenn du sprichst.', exampleSentenceArabic: 'افتح الميكروفون من فضلك عندما يحين دورك للحديث.' },
      { id: 'b10_279_10', german: 'anklicken', arabic: 'ينقر بزر الفأرة على الشاشة', emoji: '🖱️', exampleSentenceGerman: 'Klicke auf den grünen Knopf, um zu starten.', exampleSentenceArabic: 'انقر على الزر الأخضر لبدء اللعبة التعليمية.' }
    ]
  },

  // 280. Media Rules, Safety & Screen Time (جريد 2 / 3)
  {
    id: 'curric_b10_280_media_rules_screentime',
    title: 'Medienregeln und Bildschirmzeit',
    titleTranslation: 'قواعد استخدام الشاشات ووقت الشاشة للأطفال',
    gradeLevel: 'grade2',
    category: 'Digitale Welt & Technik',
    description: 'قواعد التوازن بين اللعب في الخارج ووقت الشاشة والراحة وحماية العين',
    emoji: '⏳',
    items: [
      { id: 'b10_280_01', german: 'die Bildschirmzeit', arabic: 'وقت الجلوس أمام الشاشات', article: 'die', plural: '-', emoji: '⏱️', exampleSentenceGerman: 'Eine halbe Stunde Bildschirmzeit reicht völlig aus.', exampleSentenceArabic: 'نصف ساعة من وقت الشاشة كافية تماماً في اليوم.' },
      { id: 'b10_280_02', german: 'die Pause', arabic: 'الاستراحة / التوقف المؤقت', article: 'die', plural: 'die Pausen', emoji: '🧘', exampleSentenceGerman: 'Nach dem Spiel machen meine Augen eine Bildschirmpause.', exampleSentenceArabic: 'بعد اللعب تريح عينيّ بأخذ استراحة بعيداً عن الشاشة.' },
      { id: 'b10_280_03', german: 'ausschalten', arabic: 'يغلق / يطفئ الجهاز', emoji: '🔘', exampleSentenceGerman: 'Vor dem Zubettgehen schalte ich das Tablet aus.', exampleSentenceArabic: 'قبل الذهاب للنوم أقوم بإطفاء التابلت.' },
      { id: 'b10_280_04', german: 'einschalten', arabic: 'يشغّل الجهاز', emoji: '💡', exampleSentenceGerman: 'Ich schalte das Hörspiel mit einem Knopfdruck ein.', exampleSentenceArabic: 'أشغل القصة الصوتية بضغطة زر واحدة.' },
      { id: 'b10_280_05', german: 'die Kindersicherung', arabic: 'قفل الأمان المخصص للأطفال', article: 'die', plural: 'die Kindersicherungen', emoji: '🔒', exampleSentenceGerman: 'Die Kindersicherung schützt vor unpassenden Inhalten.', exampleSentenceArabic: 'قفل الأمان يحمي من المحتويات غير المناسبة للأطفال.' },
      { id: 'b10_280_06', german: 'das Geheimnis', arabic: 'السر / الشيء الخصوصي', article: 'das', plural: 'die Geheimnisse', emoji: '🤫', exampleSentenceGerman: 'Dein Passwort ist ein wichtiges persönliches Geheimnis.', exampleSentenceArabic: 'كلمة مرورك سر شخصي مهم يجب كتمانه.' },
      { id: 'b10_280_07', german: 'fragen', arabic: 'يسأل ويستأذن الكبار', emoji: '🙋', exampleSentenceGerman: 'Ich frage immer Mama oder Papa, bevor ich etwas lade.', exampleSentenceArabic: 'أستأذن دائماً أمي أو أبي قبل تنزيل أي شيء.' },
      { id: 'b10_280_08', german: 'das Hörspiel / Hörbuch', arabic: 'القصة المسموعة (التمثيلية الصوتية)', article: 'das', plural: 'die Hörspiele', emoji: '🎧', exampleSentenceGerman: 'Zum Einschlafen höre ich ein spannendes Tierhörspiel.', exampleSentenceArabic: 'عند النوم أستمع إلى قصة حيوانات صوتية ممتعة.' },
      { id: 'b10_280_09', german: 'die Lautstärke', arabic: 'مستوى علو الصوت', article: 'die', plural: '-', emoji: '🔉', exampleSentenceGerman: 'Stelle die Lautstärke leise, um deine Ohren zu schonen.', exampleSentenceArabic: 'اضبط الصوت على درجة هادئة لحماية أذنيك.' },
      { id: 'b10_280_10', german: 'der Akku', arabic: 'بطارية الجهاز القابلة للشحن', article: 'der', plural: 'die Akkus', emoji: '🔋', exampleSentenceGerman: 'Der grüne Balken zeigt, dass der Akku voll ist.', exampleSentenceArabic: 'المؤشر الأخضر يبين أن شحن البطارية ممتلئ.' }
    ]
  },

  // 281. Robots, Coding & Future Tech for Kids (جريد 3 / 4)
  {
    id: 'curric_b10_281_robots_future_tech',
    title: 'Roboter und Programmieren für Kinder',
    titleTranslation: 'الروبوتات والبرمجة وتقنيات المستقبل للأطفال',
    gradeLevel: 'grade3',
    category: 'Digitale Welt & Technik',
    description: 'الروبوت والمستشعرات والأوامر البرمجية البسيطة والابتكار',
    emoji: '🤖',
    items: [
      { id: 'b10_281_01', german: 'der Roboter', arabic: 'الروبوت / الإنسان الآلي', article: 'der', plural: 'die Roboter', emoji: '🤖', exampleSentenceGerman: 'Unser Schulroboter kann einer schwarzen Linie folgen.', exampleSentenceArabic: 'روبوت مدرستنا يستطيع تتبع خط أسود مرسوم.' },
      { id: 'b10_281_02', german: 'programmieren', arabic: 'يبرمج / يكتب أوامر برمجية', emoji: '💻', exampleSentenceGerman: 'Mit bunten Code-Blöcken programmiere ich eine Figur.', exampleSentenceArabic: 'بمكعبات الأكواد الملونة أبرمج حركة الشخصية.' },
      { id: 'b10_281_03', german: 'der Befehl / Schritt', arabic: 'الأمر البرمجي / الخطوة', article: 'der', plural: 'die Befehle', emoji: '📋', exampleSentenceGerman: 'Der Roboter führt den Befehl: Geh geradeaus aus.', exampleSentenceArabic: 'الروبوت ينفذ الأمر: تحرك للأمام خطوة.' },
      { id: 'b10_281_04', german: 'der Sensor', arabic: 'المستشعر / الحساس', article: 'der', plural: 'die Sensoren', emoji: '📡', exampleSentenceGerman: 'Der Abstandssensor erkennt ein Hindernis vor der Wand.', exampleSentenceArabic: 'مستشعر المسافة يرصد وجود عائق قبل الاصطدام.' },
      { id: 'b10_281_05', german: 'der Motor', arabic: 'المحرك الكهربائي الصغير', article: 'der', plural: 'die Motoren', emoji: '⚙️', exampleSentenceGerman: 'Der kleine Elektromotor dreht die Räder des Autos.', exampleSentenceArabic: 'المحرك الكهربائي الصغير يدير عجلات السيارة.' },
      { id: 'b10_281_06', german: 'die Schleife (Code)', arabic: 'التكرار البرمجي (اللوب)', article: 'die', plural: 'die Schleifen', emoji: '🔁', exampleSentenceGerman: 'Wiederhole den Schritt viermal in einer Schleife!', exampleSentenceArabic: 'كرر الخطوة أربع مرات متتالية داخل حلقة تكرار!' },
      { id: 'b10_281_07', german: 'das Signal', arabic: 'الإشارة الضوئية أو الصوتية', article: 'das', plural: 'die Signale', emoji: '📶', exampleSentenceGerman: 'Bei grünem Lichtsignal piept der kleine Roboter.', exampleSentenceArabic: 'عند إشارة الضوء الأخضر يطلق الروبوت نغمة رنانة.' },
      { id: 'b10_281_08', german: 'die Fernbedienung', arabic: 'جهاز التحكم عن بعد (الريموت)', article: 'die', plural: 'die Fernbedienungen', emoji: '🕹️', exampleSentenceGerman: 'Mit der Fernbedienung steuere ich das Rennauto.', exampleSentenceArabic: 'بجهاز التحكم عن بعد أقود سيارة السباق اللعبة.' },
      { id: 'b10_281_09', german: 'der Knopf / die Taste', arabic: 'الزر / كبسة التشغيل', article: 'der', plural: 'die Knöpfe', emoji: '🔘', exampleSentenceGerman: 'Drücke auf den gelben Startknopf!', exampleSentenceArabic: 'اضغط على زر البدء الأصفر!' },
      { id: 'b10_281_10', german: 'die Erfindung', arabic: 'الاختراع / الابتكار الجديد', article: 'die', plural: 'die Erfindungen', emoji: '💡', exampleSentenceGerman: 'Kinder haben fantastische Ideen für neue Erfindungen.', exampleSentenceArabic: 'لدى الأطفال أفكار مذهلة ومبدعة لاختراعات جديدة.' }
    ]
  },

  // 282. Emotional Nuances & Empathy (جريد 2 / 3)
  {
    id: 'curric_b10_282_emotional_nuances',
    title: 'Gefühle erkennen und benennen',
    titleTranslation: 'التعرف على المشاعر والتعبير عنها بدقة',
    gradeLevel: 'grade2',
    category: 'Gefühle & Sozialkompetenz',
    description: 'مشاعر الفرح والحزن والفخر والخوف والراحة والدهشة',
    emoji: '🥰',
    items: [
      { id: 'b10_282_01', german: 'glücklich', arabic: 'سعيد / في غاية الفرح', emoji: '😄', exampleSentenceGerman: 'Wenn wir zusammen spielen, bin ich glücklich.', exampleSentenceArabic: 'عندما نلعب معاً، أكون سعيداً ومبتهجاً.' },
      { id: 'b10_282_02', german: 'traurig', arabic: 'حزين', emoji: '😢', exampleSentenceGerman: 'Er ist traurig, weil sein Eis heruntergefallen ist.', exampleSentenceArabic: 'هو حزين لأن مثلجاته سقطت على الأرض.' },
      { id: 'b10_282_03', german: 'wütend', arabic: 'غاضب', emoji: '😡', exampleSentenceGerman: 'Ich atme tief ein, wenn ich mich wütend fühle.', exampleSentenceArabic: 'أتنفس بعمق وبهدوء عندما أشعر بالغضب.' },
      { id: 'b10_282_04', german: 'ängstlich', arabic: 'خائف / وجل', emoji: '😨', exampleSentenceGerman: 'Im Dunkeln ist der kleine Hase ängstlich.', exampleSentenceArabic: 'في الظلام يشعر الأرنب الصغير بالخوف.' },
      { id: 'b10_282_05', german: 'überrascht', arabic: 'متفاجئ / مندهش', emoji: '😲', exampleSentenceGerman: 'Von der Geburtstagsparty war ich völlig überrascht.', exampleSentenceArabic: 'فوجئت تماماً بحفلة عيد الميلاد غير المتوقعة.' },
      { id: 'b10_282_06', german: 'stolz', arabic: 'فخور بإنجازه', emoji: '🦚', exampleSentenceGerman: 'Ich bin stolz, dass ich das ganze Set gelernt habe!', exampleSentenceArabic: 'أنا فخور بأنني تعلمت المجموعة كاملة بلا أخطاء!' },
      { id: 'b10_282_07', german: 'erleichtert', arabic: 'مرتاح البال / مطمئن بعد قلق', emoji: '😌', exampleSentenceGerman: 'Ich bin erleichtert, dass mein Hund wieder da ist.', exampleSentenceArabic: 'أنا مرتاح البال ومطمئن لعودة كلبي سالماً.' },
      { id: 'b10_282_08', german: 'besorgt', arabic: 'قلق / مشفق على غيره', emoji: '😟', exampleSentenceGerman: 'Mama schaut besorgt, wenn ich hohes Fieber habe.', exampleSentenceArabic: 'ماما تبدو قلقة عندما ترتفع حرارتي.' },
      { id: 'b10_282_09', german: 'neidisch / eifersüchtig', arabic: 'غيور / يحس برغبة فيما مع غيره', emoji: '😒', exampleSentenceGerman: 'Sei nicht neidisch, bald bist du mit Schaukeln dran.', exampleSentenceArabic: 'لا تشعر بالغيرة، فقريباً سيأتي دورك في الأرجوحة.' },
      { id: 'b10_282_10', german: 'gelassen / ruhig', arabic: 'هادئ ومسترخٍ / رزين', emoji: '🧘‍♂️', exampleSentenceGerman: 'Mit einem Lächeln bleibt er ruhig und gelassen.', exampleSentenceArabic: 'بابتسامة لطيفة يظل هادئاً ومرتاح الأعصاب.' }
    ]
  },

  // 283. Friendship & Social Skills (جريد 1 / 2)
  {
    id: 'curric_b10_283_friendship_sharing',
    title: 'Freundschaft und Miteinander',
    titleTranslation: 'الصداقة والتعاون والمشاركة بين الأطفال',
    gradeLevel: 'grade1',
    category: 'Gefühle & Sozialkompetenz',
    description: 'أفعال الصداقة الجميلة: المشاركة، المواساة، العناق، والتبادل بالأدوار',
    emoji: '🤝',
    items: [
      { id: 'b10_283_01', german: 'teilen', arabic: 'يتقاسم / يشارك أصدقاءه', emoji: '🍰', exampleSentenceGerman: 'Gute Freunde teilen ihren Apfel gern zu zweit.', exampleSentenceArabic: 'الأصدقاء الحقيقيون يقتسمون تفاحتهم معاً برضا.' },
      { id: 'b10_283_02', german: 'trösten', arabic: 'يواسي / يهدئ من روع صديقه', emoji: '🤗', exampleSentenceGerman: 'Ich tröste mein weinendes Geschwisterchen lieb.', exampleSentenceArabic: 'أواسي أخي الصغير الباكي بحنان ولطف.' },
      { id: 'b10_283_03', german: 'sich abwechseln', arabic: 'يتناوبان الأدوار بالدور', emoji: '🔄', exampleSentenceGerman: 'Auf der Rutsche wechseln wir uns fair ab.', exampleSentenceArabic: 'على الزحليقة نتناوب الأدوار بإنصاف ونظام.' },
      { id: 'b10_283_04', german: 'verzeihen', arabic: 'يسامح / يصفح عن الخطأ', emoji: '🕊️', exampleSentenceGerman: 'Wenn jemand es nicht mit Absicht tat, verzeihen wir.', exampleSentenceArabic: 'إذا أخطأ أحد دون قصد، نسامحه بكل طيبة.' },
      { id: 'b10_283_05', german: 'zuhören', arabic: 'يصغي / يستمع باهتمام', emoji: '👂', exampleSentenceGerman: 'In der Gesprächsrunde hören alle leise zu.', exampleSentenceArabic: 'في حلقة النقاش يستمع الجميع باهتمام وهدوء.' },
      { id: 'b10_283_06', german: 'die Umarmung', arabic: 'العناق / الحضن الدافئ', article: 'die', plural: 'die Umarmungen', emoji: '🫂', exampleSentenceGerman: 'Eine herzliche Umarmung schenkt Trost und Wärme.', exampleSentenceArabic: 'العناق الصادق يمنح الراحة والدفء والمحبة.' },
      { id: 'b10_283_07', german: 'mitspielen lassen', arabic: 'يسمح للآخرين بالمشاركة في اللعب', emoji: '⚽', exampleSentenceGerman: 'Wir lassen den neuen Mitschüler sofort mitspielen.', exampleSentenceArabic: 'نسمح لزميلنا الجديد باللعب معنا في الحال.' },
      { id: 'b10_283_08', german: 'zusammenhalten', arabic: 'يتماسك ويتعاون كفريق واحد', emoji: '🤜🤛', exampleSentenceGerman: 'In unserer Klasse halten wir alle fest zusammen.', exampleSentenceArabic: 'في فصلنا المدرسي نتكاتف ونتعاون كفريق واحد.' },
      { id: 'b10_283_09', german: 'schenken', arabic: 'يهدي / يمنح هدية عن محبة', emoji: '🎁', exampleSentenceGerman: 'Ich schenke Oma eine selbst gebastelte Karte.', exampleSentenceArabic: 'أهدي لجدتي بطاقة صنعتها بيدي من قلبي.' },
      { id: 'b10_283_10', german: 'loben', arabic: 'يمدح ويثني على عمل طيب', emoji: '👏', exampleSentenceGerman: 'Die Lehrerin lobt die fleißige Partnerarbeit.', exampleSentenceArabic: 'المعلمة تثني على العمل الجماعي المثابر.' }
    ]
  },

  // 284. Conflict Resolution & Peaceful Words (جريد 2 / 3)
  {
    id: 'curric_b10_284_conflict_resolution',
    title: 'Streit schlichten und Frieden schließen',
    titleTranslation: 'فض الخلافات وإحلال الصلح والسلام',
    gradeLevel: 'grade2',
    category: 'Gefühle & Sozialkompetenz',
    description: 'الكلمات السحرية للصلح والاعتذار والتفاهم بالحديث الهادئ',
    emoji: '🕊️',
    items: [
      { id: 'b10_284_01', german: 'der Streit', arabic: 'الخلاف / النزاع', article: 'der', plural: 'die Streite', emoji: '⚡', exampleSentenceGerman: 'Streit kommt vor, aber wir finden eine gute Lösung.', exampleSentenceArabic: 'الخلاف قد يحدث أحياناً، لكننا نجد حلاً طيباً.' },
      { id: 'b10_284_02', german: 'die Versöhnung', arabic: 'المصالحة وإنهاء الشجار', article: 'die', plural: 'die Versöhnungen', emoji: '🕊️', exampleSentenceGerman: 'Nach dem Streit feiern wir eine fröhliche Versöhnung.', exampleSentenceArabic: 'بعد الخلاف نحتفل بمصالحة ودية وجميلة.' },
      { id: 'b10_284_03', german: 'der Friede / Frieden', arabic: 'السلام والوئام', article: 'der', plural: '-', emoji: '✌️', exampleSentenceGerman: 'Wir wünschen uns Frieden und Freundschaft auf der Erde.', exampleSentenceArabic: 'نتمنى السلام والصداقة الطيبة على كوكب الأرض.' },
      { id: 'b10_284_04', german: 'der Kompromiss', arabic: 'الحل الوسط التوفيقي', article: 'der', plural: 'die Kompromisse', emoji: '⚖️', exampleSentenceGerman: 'Ein guter Kompromiss macht beide Kinder froh.', exampleSentenceArabic: 'الحل الوسط المنصف يرضي الطرفين ويسعدهما.' },
      { id: 'b10_284_05', german: 'ausreden lassen', arabic: 'يتركه يكمل كلامه دون مقاطعة', emoji: '🗣️', exampleSentenceGerman: 'Bitte lass mich kurz ausreden, dann bist du dran.', exampleSentenceArabic: 'من فضلك دعني أكمل كلامي، ثم يحين دورك.' },
      { id: 'b10_284_06', german: 'fair', arabic: 'عادل / منصف', emoji: '⚖️', exampleSentenceGerman: 'Beim Spiel müssen alle Spielregeln fair sein.', exampleSentenceArabic: 'في اللعب يجب أن تكون قواعد اللعبة عادلة للجميع.' },
      { id: 'b10_284_07', german: 'die Entschuldigung', arabic: 'الاعتذار الصادق', article: 'die', plural: 'die Entschuldigungen', emoji: '🙇', exampleSentenceGerman: 'Eine ehrliche Entschuldigung kommt von Herzen.', exampleSentenceArabic: 'الاعتذار الصادق ينبع من صميم القلب.' },
      { id: 'b10_284_08', german: 'die Hand geben', arabic: 'يتصافحان باليد دليلاً على الصلح', emoji: '🤝', exampleSentenceGerman: 'Wir geben uns die Hand und sind wieder Freunde.', exampleSentenceArabic: 'نتصافح بالأيدي ونعود أصدقاء مقربين مجدداً.' },
      { id: 'b10_284_09', german: 'sich beruhigen', arabic: 'يهدأ ويسكن غضبه', emoji: '😌', exampleSentenceGerman: 'Trink einen Schluck Wasser und beruhige dich.', exampleSentenceArabic: 'اشرب جرعة ماء واهدأ قليلاً لتستريح.' },
      { id: 'b10_284_10', german: 'die Vereinbarung', arabic: 'الاتفاق / العهد المشترك', article: 'die', plural: 'die Vereinbarungen', emoji: '📜', exampleSentenceGerman: 'Wir treffen eine Vereinbarung für das nächste Spiel.', exampleSentenceArabic: 'نعقد اتفاقاً واضحاً للعبتنا القادمة.' }
    ]
  },

  // 285. Pedestrian Safety & Street Crossing (روضة / جريد 1)
  {
    id: 'curric_b10_285_street_crossing_safety',
    title: 'Sicher über die Straße gehen',
    titleTranslation: 'العبور الآمن للشارع وقواعد المشاة الصغار',
    gradeLevel: 'preschool',
    category: 'Sicherheit & Regeln',
    description: 'خطوط المشاة وإشارة المرور وخوذة الرأس والسترة العاكسة',
    emoji: '🚸',
    items: [
      { id: 'b10_285_01', german: 'der Zebrastreifen', arabic: 'خطوط عبور المشاة المخططة (الزيبرا)', article: 'der', plural: 'die Zebrastreifen', emoji: '🦓', exampleSentenceGerman: 'Am Zebrastreifen halten die Autos für uns an.', exampleSentenceArabic: 'عند خطوط المشاة تتوقف السيارات لمرورنا بأمان.' },
      { id: 'b10_285_02', german: 'die Fußgängerampel', arabic: 'إشارة مرور المشاة الضوئية', article: 'die', plural: 'die Fußgängerampeln', emoji: '🚦', exampleSentenceGerman: 'Bei Rot bleibe ich stehen, bei Grün darf ich gehen.', exampleSentenceArabic: 'عند اللون الأحمر أقف مكاني، وعند الأخضر أعبر.' },
      { id: 'b10_285_03', german: 'der Gehweg / Bürgersteig', arabic: 'رصيف المشاة المخصص للسير', article: 'der', plural: 'die Gehwege', emoji: '🚶', exampleSentenceGerman: 'Kinder gehen immer auf der Innenseite des Gehwegs.', exampleSentenceArabic: 'يسير الأطفال دائماً على الجانب الداخلي للرصيف.' },
      { id: 'b10_285_04', german: 'der Fahrradhelm', arabic: 'خوذة حماية الرأس للدراجة', article: 'der', plural: 'die Fahrradhelme', emoji: '⛑️', exampleSentenceGerman: 'Setze immer deinen Fahrradhelm fest auf den Kopf!', exampleSentenceArabic: 'ضع خوذة الدراجة بإحكام على رأسك دائماً!' },
      { id: 'b10_285_05', german: 'die Warnweste', arabic: 'السترة الصفراء الفوسفورية العاكسة', article: 'die', plural: 'die Warnwesten', emoji: '🦺', exampleSentenceGerman: 'Die gelbe Warnweste leuchtet im Dunkeln hell auf.', exampleSentenceArabic: 'السترة الصفراء تضيء بوضوح في الظلام ليراك السائقون.' },
      { id: 'b10_285_06', german: 'der Reflektor', arabic: 'العاكس الضوئي على الحقيبة أو الحذاء', article: 'der', plural: 'die Reflektoren', emoji: '✨', exampleSentenceGerman: 'Reflektoren an der Schultasche machen uns sichtbar.', exampleSentenceArabic: 'العواكس الضوئية على الحقيبة تجعلنا مرئيين للسائقين.' },
      { id: 'b10_285_07', german: 'stehen bleiben', arabic: 'يتوقف تماماً عن الحركة عند الحافة', emoji: '🛑', exampleSentenceGerman: 'An der Bordsteinkante bleibe ich zuerst stehen.', exampleSentenceArabic: 'عند حافة الرصيف أتوقف تماماً في البداية.' },
      { id: 'b10_285_08', german: 'nach links und rechts schauen', arabic: 'ينظر يساراً ويميناً للتأكد من خلو الشارع', emoji: '👀', exampleSentenceGerman: 'Erst links, dann rechts, dann noch mal links schauen!', exampleSentenceArabic: 'انظر يساراً أولاً، ثم يميناً، ثم يساراً مجدداً!' },
      { id: 'b10_285_09', german: 'der Schulweg', arabic: 'طريق الذهاب إلى المدرسة', article: 'der', plural: 'die Schulwege', emoji: '🎒', exampleSentenceGerman: 'Ich kenne meinen sicheren Schulweg ganz genau.', exampleSentenceArabic: 'أنا أعرف طريقي الآمن للمدرسة بدقة متناهية.' },
      { id: 'b10_285_10', german: 'die Hand halten', arabic: 'يمسك بيد الكبار عند عبور الشارع', emoji: '🤝', exampleSentenceGerman: 'Beim Überqueren der Kreuzung halte ich Mamas Hand.', exampleSentenceArabic: 'عند عبور التقاطع المزدحم أمسك بيد أمي جيداً.' }
    ]
  },

  // 286. Emergency & First Aid Basics (جريد 2 / 3)
  {
    id: 'curric_b10_286_emergency_first_aid',
    title: 'Notfall, Erste Hilfe und Notruf 112',
    titleTranslation: 'الطوارئ والإسعافات الأولية ورقم النجدة',
    gradeLevel: 'grade2',
    category: 'Sicherheit & Regeln',
    description: 'رقم الطوارئ 112 والضمادة ولصقة الجروح وطلب النجدة ومطفأة الحريق',
    emoji: '🚨',
    items: [
      { id: 'b10_286_01', german: 'der Notruf 112', arabic: 'رقم طوارئ الإسعاف والإطفاء في ألمانيا', article: 'der', plural: '-', emoji: '📞', exampleSentenceGerman: 'Bei Feuer oder Unfall wählen wir sofort die 112.', exampleSentenceArabic: 'عند الحريق أو الحوادث نتصل برقم 112 فوراً.' },
      { id: 'b10_286_02', german: 'die Hilfe', arabic: 'المساعدة والنجدة', article: 'die', plural: '-', emoji: '🆘', exampleSentenceGerman: 'Hilfe rufen, wenn jemand gestürzt ist!', exampleSentenceArabic: 'نطلب النجدة والمساعدة إذا سقط أحد وأصيب!' },
      { id: 'b10_286_03', german: 'das Heftpflaster', arabic: 'لاصقة الجروح الطبية', article: 'das', plural: 'die Heftpflaster', emoji: '🩹', exampleSentenceGerman: 'Ein buntes Tierpflaster tröstet bei einem Kratzer.', exampleSentenceArabic: 'لاصقة جروح برسومات حيوانات تواسي في الخدوش الصغيرة.' },
      { id: 'b10_286_04', german: 'die Binde / der Verband', arabic: 'شاش / ضمادة الجروح الطبية', article: 'die', plural: 'die Binden', emoji: '🩹', exampleSentenceGerman: 'Der Sanitäter legt vorsichtig einen Verband an.', exampleSentenceArabic: 'المسعف يضع ضمادة شاش طبية بعناية ورقة.' },
      { id: 'b10_286_05', german: 'der Feuerlöscher', arabic: 'مطفأة الحريق اليدوية', article: 'der', plural: 'die Feuerlöscher', emoji: '🧯', exampleSentenceGerman: 'Der rote Feuerlöscher hängt gut sichtbar im Flur.', exampleSentenceArabic: 'مطفأة الحريق الحمراء معلقة في الممر بوضوح.' },
      { id: 'b10_286_06', german: 'der Notausgang', arabic: 'مخرج الطوارئ للإخلاء', article: 'der', plural: 'die Notausgänge', emoji: '🚪', exampleSentenceGerman: 'Das grüne Männchen zeigt den sicheren Notausgang.', exampleSentenceArabic: 'علامة الرجل الأخضر ترشدنا لمخرج الطوارئ الآمن.' },
      { id: 'b10_286_07', german: 'der Probealarm', arabic: 'جرس إنذار الإخلاء التجريبي', article: 'der', plural: 'die Probealarme', emoji: '🔔', exampleSentenceGerman: 'Beim Schulalarm gehen alle geordnet auf den Hof.', exampleSentenceArabic: 'عند انطلاق جرس الإنذار يخرج الجميع بنظام للفناء.' },
      { id: 'b10_286_08', german: 'der Sammelplatz', arabic: 'نقطة التجمع الآمنة عند الطوارئ', article: 'der', plural: 'die Sammelplätze', emoji: '📍', exampleSentenceGerman: 'Auf dem Sportplatz ist unser sicherer Sammelplatz.', exampleSentenceArabic: 'في الملعب الرياضي تقع نقطة التجمع الآمنة لمدرستنا.' },
      { id: 'b10_286_09', german: 'die Rettungsweste', arabic: 'سترة النجاة في القارب', article: 'die', plural: 'die Rettungswesten', emoji: '🦺', exampleSentenceGerman: 'Auf dem Schiff zieht jedes Kind eine Rettungsweste an.', exampleSentenceArabic: 'على متن السفينة يرتدي كل طفل سترة نجاة عائمة.' },
      { id: 'b10_286_10', german: 'Ruhe bewahren', arabic: 'يحافظ على هدوئه ولا يفزع', emoji: '🧘', exampleSentenceGerman: 'Wichtig im Notfall: Tief durchatmen und Ruhe bewahren!', exampleSentenceArabic: 'أهم شيء في الطوارئ: التنفس بعمق والمحافظة على الهدوء!' }
    ]
  },

  // 287. Playground & Activity Safety Rules (جريد 1 / 2)
  {
    id: 'curric_b10_287_playground_rules',
    title: 'Sicher auf dem Spielplatz und im Pausenhof',
    titleTranslation: 'الأمان في ساحة الألعاب وفناء المدرسة',
    gradeLevel: 'grade1',
    category: 'Sicherheit & Regeln',
    description: 'قواعد عدم التدافع والتسلق الحذر ومراعاة الصغار والانتظام',
    emoji: '🛝',
    items: [
      { id: 'b10_287_01', german: 'die Pausenaufsicht', arabic: 'مشرفة الفسحة المدرسية', article: 'die', plural: 'die Pausenaufsichten', emoji: '👩‍🏫', exampleSentenceGerman: 'Die Lehrerin hat heute die Pausenaufsicht.', exampleSentenceArabic: 'المعلمة مسؤولة اليوم عن الإشراف في الفسحة.' },
      { id: 'b10_287_02', german: 'nicht schubsen', arabic: 'ممنوع الدفع أو التدافع', emoji: '✋', exampleSentenceGerman: 'Bitte nicht schubsen, wir haben alle genug Platz!', exampleSentenceArabic: 'رجاءً لا تدفع أحداً، فالمكان يتسع لنا جميعاً!' },
      { id: 'b10_287_03', german: 'vorsichtig klettern', arabic: 'يتسلق بحذر وانتباه', emoji: '🧗', exampleSentenceGerman: 'Auf dem Klettergerüst klettere ich vorsichtig.', exampleSentenceArabic: 'على هيكل التسلق أتسلق بحذر وحرص شديدين.' },
      { id: 'b10_287_04', german: 'Abstand halten', arabic: 'يحافظ على مسافة أمان', emoji: '↔️', exampleSentenceGerman: 'Vor der schwingenden Schaukel halten wir Abstand.', exampleSentenceArabic: 'أمام الأرجوحة المتحركة نحافظ على مسافة أمان كافية.' },
      { id: 'b10_287_05', german: 'der Handlauf / das Geländer', arabic: 'درابزين / درابزين الدرج للأمان', article: 'der', plural: 'die Handläufe', emoji: '🪜', exampleSentenceGerman: 'Auf der Treppe halte ich mich am Handlauf fest.', exampleSentenceArabic: 'على الدرج أتمسك بالدرابزين بيدي لمنع الانزلاق.' },
      { id: 'b10_287_06', german: 'die Schulordnung', arabic: 'لائحة قواعد ونظام المدرسة', article: 'die', plural: 'die Schulordnungen', emoji: '📜', exampleSentenceGerman: 'Unsere Schulordnung sorgt dafür, dass sich alle wohlfühlen.', exampleSentenceArabic: 'لائحة المدرسة تضمن شعور الجميع بالأمان والراحة.' },
      { id: 'b10_287_07', german: 'aufpassen', arabic: 'ينتبه ويحترس', emoji: '👀', exampleSentenceGerman: 'Pass gut auf deine Sachen und deine Freunde auf!', exampleSentenceArabic: 'انتبه جيداً لأغراضك ولأصدقائك في كل وقت!' },
      { id: 'b10_287_08', german: 'bescheid sagen', arabic: 'يخبر المعلم أو المسؤول', emoji: '🗣️', exampleSentenceGerman: 'Wenn etwas passiert, sagen wir der Aufsicht Bescheid.', exampleSentenceArabic: 'إذا حدث أي شيء، نخبر مشرفة الفسحة في الحال.' },
      { id: 'b10_287_09', german: 'sitzend rutschen', arabic: 'التزحلق بوضعية الجلوس السليمة', emoji: '🛝', exampleSentenceGerman: 'Auf der Rutsche rutscht man immer sitzend mit den Füßen voran.', exampleSentenceArabic: 'على الزحليقة نتزحلق دائماً في وضع الجلوس وقديمنا للأمام.' },
      { id: 'b10_287_10', german: 'Rücksicht nehmen', arabic: 'يراعي شعور وسلامة الآخرين', emoji: '🤲', exampleSentenceGerman: 'Größere Schulkinder nehmen Rücksicht auf die Erstklässler.', exampleSentenceArabic: 'التلاميذ الأكبر سناً يراعون سلامة تلاميذ الصف الأول الصغار.' }
    ]
  },

  // 288. Classic Fairy Tales & Characters (روضة / جريد 1)
  {
    id: 'curric_b10_288_classic_fairytales',
    title: 'Klassische Märchenfiguren',
    titleTranslation: 'شخصيات القصص الخيالية والحكايات التراثية',
    gradeLevel: 'preschool',
    category: 'Geschichten & Fantasiewelten',
    description: 'الأميرة والملك والساحر والقزم والقصر والحكاية الخيالية الألمانية',
    emoji: '🏰',
    items: [
      { id: 'b10_288_01', german: 'das Märchen', arabic: 'الحكاية الخيالية / قصة خرافية', article: 'das', plural: 'die Märchen', emoji: '📖', exampleSentenceGerman: 'Es war einmal... so fängt fast jedes schöne Märchen an.', exampleSentenceArabic: 'كان يا ما كان... هكذا تبدأ أغلب الحكايات الخيالية الجميلة.' },
      { id: 'b10_288_02', german: 'der König', arabic: 'الملك', article: 'der', plural: 'die Könige', emoji: '👑', exampleSentenceGerman: 'Der weise König regiert gerecht über sein Land.', exampleSentenceArabic: 'الملك الحكيم يحكم بلاده بالعدل والإنصاف.' },
      { id: 'b10_288_03', german: 'die Königin', arabic: 'الملكة', article: 'die', plural: 'die Königinnen', emoji: '👸', exampleSentenceGerman: 'Die Königin trägt ein wunderschönes Seidenkleid.', exampleSentenceArabic: 'الملكة ترتدي فستاناً حريرياً فائق الجمال.' },
      { id: 'b10_288_04', german: 'der Prinz', arabic: 'الأمير', article: 'der', plural: 'die Prinzen', emoji: '🤴', exampleSentenceGerman: 'Der junge Prinz reitet auf einem Schimmel.', exampleSentenceArabic: 'الأمير الشاب يمتطي حصاناً أبيض جميلاً.' },
      { id: 'b10_288_05', german: 'die Prinzessin', arabic: 'الأميرة', article: 'die', plural: 'die Prinzessinnen', emoji: '👸', exampleSentenceGerman: 'Die Prinzessin rettet mit ihrer Klugheit das ganze Schloss.', exampleSentenceArabic: 'الأميرة تنقذ القصر بأكمله بفضل ذكائها.' },
      { id: 'b10_288_06', german: 'der Zauberer', arabic: 'الساحر الحكيم الطيب', article: 'der', plural: 'die Zauberer', emoji: '🧙‍♂️', exampleSentenceGerman: 'Der Zauberer schwingt seinen glitzernden Zauberstab.', exampleSentenceArabic: 'الساحر يلوح بعصاه السحرية البراقة.' },
      { id: 'b10_288_07', german: 'die Hexe', arabic: 'الساحرة العجوز', article: 'die', plural: 'die Hexen', emoji: '🧙‍♀️', exampleSentenceGerman: 'Im Waldhäuschen rührt die Hexe in einem Kessel.', exampleSentenceArabic: 'في كوخ الغابة تحرك الساحرة في قدر كبير.' },
      { id: 'b10_288_08', german: 'der Zwerg', arabic: 'القزم (مثل أقزام سنووايت)', article: 'der', plural: 'die Zwerge', emoji: '🧔', exampleSentenceGerman: 'Die sieben Zwerge wandern pfeifend zur Arbeit in die Berge.', exampleSentenceArabic: 'الأقزام السبعة يسيرون نحو الجبل وهم يصفرون بمرح.' },
      { id: 'b10_288_09', german: 'der Riese', arabic: 'العملاق الضخم', article: 'der', plural: 'die Riesen', emoji: '🧌', exampleSentenceGerman: 'Der freundliche Riese macht riesige Schritte über das Tal.', exampleSentenceArabic: 'العملاق الطيب يخطو خطوات هائلة فوق الوادي.' },
      { id: 'b10_288_10', german: 'das Schloss', arabic: 'القصر المنيف / القلعة الملكية', article: 'das', plural: 'die Schlösser', emoji: '🏰', exampleSentenceGerman: 'Hoch auf dem Hügel thront ein prächtiges Schloss.', exampleSentenceArabic: 'فوق التل المرتفع يتربع قصر ملكي فخم.' }
    ]
  },

  // 289. Knights, Castles & Dragons (جريد 2 / 3)
  {
    id: 'curric_b10_289_knights_dragons',
    title: 'Ritter, Burgen und Drachen',
    titleTranslation: 'الفرسان والقلاع الحصينة والتنانين',
    gradeLevel: 'grade2',
    category: 'Geschichten & Fantasiewelten',
    description: 'الفارس والدرع والسيف والقلعة وجسر السحب والتنين الخيالي',
    emoji: '🛡️',
    items: [
      { id: 'b10_289_01', german: 'die Ritterburg', arabic: 'قلعة الفرسان الحصينة', article: 'die', plural: 'die Ritterburgen', emoji: '🏰', exampleSentenceGerman: 'Die Ritterburg hat dicke Steinmauern und Zinnen.', exampleSentenceArabic: 'قلعة الفرسان لها جدران حجرية سميكة وأبراج عالية.' },
      { id: 'b10_289_02', german: 'der Ritter', arabic: 'الفارس الشجاع', article: 'der', plural: 'die Ritter', emoji: '🤺', exampleSentenceGerman: 'Der mutige Ritter beschützt die Bewohner des Dorfes.', exampleSentenceArabic: 'الفارس الشجاع يحمي سكان القرية.' },
      { id: 'b10_289_03', german: 'die Rüstung', arabic: 'الدرع الحديدي الكامل للفارس', article: 'die', plural: 'die Rüstungen', emoji: '🛡️', exampleSentenceGerman: 'Die eiserne Rüstung glänzt im Sonnenlicht.', exampleSentenceArabic: 'الدرع الحديدي يلمع تحت أشعة الشمس.' },
      { id: 'b10_289_04', german: 'das Schwert', arabic: 'السيف', article: 'das', plural: 'die Schwerter', emoji: '🗡️', exampleSentenceGerman: 'Aus Holz schnitzt Opa mir ein Spielschwert.', exampleSentenceArabic: 'جدي ينحت لي سيفاً لعبة من الخشب.' },
      { id: 'b10_289_05', german: 'der Schild', arabic: 'الترس / درع الصد باليد', article: 'der', plural: 'die Schilde', emoji: '🛡️', exampleSentenceGerman: 'Auf dem Schild prangt ein mutiger goldener Löwe.', exampleSentenceArabic: 'على الترس تظهر صورة أسد ذهبي شجاع.' },
      { id: 'b10_289_06', german: 'der Drache', arabic: 'التنين الأسطوري', article: 'der', plural: 'die Drachen', emoji: '🐉', exampleSentenceGerman: 'Der grüne Drache fliegt hoch über die Wolken.', exampleSentenceArabic: 'التنين الأخضر يطير عالياً فوق السحب.' },
      { id: 'b10_289_07', german: 'die Zugbrücke', arabic: 'الجسر المتحرك القابل للرفع فوق الخندق', article: 'die', plural: 'die Zugbrücken', emoji: '🌉', exampleSentenceGerman: 'Am Abend wird die Zugbrücke der Burg hochgezogen.', exampleSentenceArabic: 'في المساء يتم رفع الجسر المتحرك للقلعة.' },
      { id: 'b10_289_08', german: 'der Burggraben', arabic: 'خندق الماء المحيط بالقلعة', article: 'der', plural: 'die Burggräben', emoji: '🌊', exampleSentenceGerman: 'Im Burggraben schwimmen Enten und Fische.', exampleSentenceArabic: 'في خندق القلعة تسبح البطات والأسماك.' },
      { id: 'b10_289_09', german: 'der Helm (Ritter)', arabic: 'خوذة الفارس الحديدية', article: 'der', plural: 'die Helme', emoji: '⛑️', exampleSentenceGerman: 'Der Ritter klappt das Visier an seinem Helm herunter.', exampleSentenceArabic: 'الفارس ينزل قناع خوذته الحديدية.' },
      { id: 'b10_289_10', german: 'das Turnier', arabic: 'بطولة ومنافسة الفرسان الاحتفالية', article: 'das', plural: 'die Turniere', emoji: '🏇', exampleSentenceGerman: 'Beim Ritterturnier zeigen alle ihre Reitkünste.', exampleSentenceArabic: 'في مهرجان الفرسان يستعرض الجميع مهاراتهم في ركوب الخيل.' }
    ]
  },

  // 290. Pirates & High Seas Adventure (جريد 2 / 3)
  {
    id: 'curric_b10_290_pirates_adventure',
    title: 'Piraten und das Abenteuer auf hoher See',
    titleTranslation: 'القراصنة ومغامرات أعالي البحار',
    gradeLevel: 'grade2',
    category: 'Geschichten & Fantasiewelten',
    description: 'سفينة القراصنة وصندوق الكنز وخريطة الكنز والمنظار والجزيرة',
    emoji: '🏴‍☠️',
    items: [
      { id: 'b10_290_01', german: 'das Piratenschiff', arabic: 'سفينة القراصنة الشراعية', article: 'das', plural: 'die Piratenschiffe', emoji: '⛵', exampleSentenceGerman: 'Das hölzerne Piratenschiff segelt über die sieben Meere.', exampleSentenceArabic: 'سفينة القراصنة الخشبية تبحر عبر البحار السبعة.' },
      { id: 'b10_290_02', german: 'der Pirat', arabic: 'القرصان البحري', article: 'der', plural: 'die Piraten', emoji: '🏴‍☠️', exampleSentenceGerman: 'Der Kapitän der Piraten trägt einen Dreispitzhut.', exampleSentenceArabic: 'قبطان القراصنة يرتدي قبعة بحرية ثلاثية الأطراف.' },
      { id: 'b10_290_03', german: 'die Schatzkarte', arabic: 'خريطة الكنز المخبأ', article: 'die', plural: 'die Schatzkarten', emoji: '🗺️', exampleSentenceGerman: 'Ein rotes Kreuz auf der Schatzkarte zeigt das Versteck.', exampleSentenceArabic: 'علامة الصليب الحمراء على الخريطة تحدد مكان الكنز.' },
      { id: 'b10_290_04', german: 'die Schatztruhe', arabic: 'صندوق الكنز الخشبي الثمين', article: 'die', plural: 'die Schatztruhen', emoji: '🪙', exampleSentenceGerman: 'In der Schatztruhe funkeln Goldmünzen und Edelsteine.', exampleSentenceArabic: 'في صندوق الكنز تلمع العملات الذهبية والجواهر النفيسة.' },
      { id: 'b10_290_05', german: 'das Fernrohr', arabic: 'المنظار المقرب (التلسكوب البحري)', article: 'das', plural: 'die Fernrohre', emoji: '🔭', exampleSentenceGerman: 'Mit dem Fernrohr erspäht der Ausguck eine einsame Insel.', exampleSentenceArabic: 'بالمنظار المقرب يرصد المراقب جزيرة نائية في الأفق.' },
      { id: 'b10_290_06', german: 'der Papagei', arabic: 'الببغاء الملون', article: 'der', plural: 'die Papageien', emoji: '🦜', exampleSentenceGerman: 'Auf der Schulter des Seemanns krächzt ein bunter Papagei.', exampleSentenceArabic: 'على كتف البحار يغرد ببغاء ملون ذكي.' },
      { id: 'b10_290_07', german: 'die Augenklappe', arabic: 'عصابة العين السوداء', article: 'die', plural: 'die Augenklappen', emoji: '👁️', exampleSentenceGerman: 'Für mein Kostüm bastle ich eine schwarze Augenklappe.', exampleSentenceArabic: 'لزِيّي التنكري أصنع عصابة عين سوداء.' },
      { id: 'b10_290_08', german: 'die Schatzinsel', arabic: 'جزيرة الكنز المهجورة', article: 'die', plural: 'die Schatzinseln', emoji: '🏝️', exampleSentenceGerman: 'Palmen wiegen sich im Wind auf der Schatzinsel.', exampleSentenceArabic: 'أشجار النخيل تتمايل مع النسيم على جزيرة الكنز.' },
      { id: 'b10_290_09', german: 'der Anker', arabic: 'مرساة السفينة الثقيلة', article: 'der', plural: 'die Anker', emoji: '⚓', exampleSentenceGerman: 'Die Matrosen werfen den schweren Anker ins Wasser.', exampleSentenceArabic: 'البحارة يلقون بالمرساة الثقيلة في مياه الخليج.' },
      { id: 'b10_290_10', german: 'die Flaschenpost', arabic: 'رسالة داخل زجاجة في البحر', article: 'die', plural: 'die Flaschenposten', emoji: '🍾', exampleSentenceGerman: 'Die Wellen spülen eine alte Flaschenpost an den Strand.', exampleSentenceArabic: 'الأمواج تقذف زجاجة تحتوي على رسالة قديمة إلى الشاطئ.' }
    ]
  },

  // 291. Space Exploration & Cosmic World (جريد 3 / 4)
  {
    id: 'curric_b10_291_space_exploration',
    title: 'Weltraum und Reise zu den Sternen',
    titleTranslation: 'الفضاء الخارجي ورحلة نحو النجوم',
    gradeLevel: 'grade3',
    category: 'Geschichten & Fantasiewelten',
    description: 'الصاروخ الفضائي ورواد الفضاء ومحطة الفضاء وانعدام الجاذبية',
    emoji: '🚀',
    items: [
      { id: 'b10_291_01', german: 'die Rakete', arabic: 'الصاروخ الفضائي', article: 'die', plural: 'die Raketen', emoji: '🚀', exampleSentenceGerman: 'Die Rakete startet mit lautem Donnern ins All.', exampleSentenceArabic: 'ينطلق الصاروخ نحو الفضاء بدوي هائل وصوت كالرعد.' },
      { id: 'b10_291_02', german: 'der Astronaut / die Astronautin', arabic: 'رائد / رائدة الفضاء', article: 'der', plural: 'die Astronauten', emoji: '👨‍🚀', exampleSentenceGerman: 'Der Astronaut schwebt friedlich in der Raumstation.', exampleSentenceArabic: 'رائد الفضاء يسبح بسلام داخل المحطة الفضائية.' },
      { id: 'b10_291_03', german: 'das Raumschiff', arabic: 'المركبة الفضائية', article: 'das', plural: 'die Raumschiffe', emoji: '🛸', exampleSentenceGerman: 'Das futuristische Raumschiff umkreist den roten Planeten.', exampleSentenceArabic: 'المركبة الفضائية تدور حول الكوكب الأحمر.' },
      { id: 'b10_291_04', german: 'die Raumstation (ISS)', arabic: 'محطة الفضاء الدولية', article: 'die', plural: 'die Raumstationen', emoji: '🛰️', exampleSentenceGerman: 'Auf der Raumstation forschen Astronauten aus vielen Ländern.', exampleSentenceArabic: 'في محطة الفضاء يبحث علماء ورواد من دول مختلفة.' },
      { id: 'b10_291_05', german: 'die Schwerelosigkeit', arabic: 'انعدام الجاذبية والطفو في الفضاء', article: 'die', plural: '-', emoji: '🌌', exampleSentenceGerman: 'In der Schwerelosigkeit fliegen Wassertropfen wie kleine Kugeln.', exampleSentenceArabic: 'في انعدام الجاذبية تطفو قطرات الماء ككرات صغيرة مذهلة.' },
      { id: 'b10_291_06', german: 'der Raumanzug', arabic: 'بدلة الفضاء الواقية', article: 'der', plural: 'die Raumanzüge', emoji: '🥼', exampleSentenceGerman: 'Der weiße Raumanzug versorgt die Forscher mit Sauerstoff.', exampleSentenceArabic: 'بدلة الفضاء البيضاء تمد الباحثين بالأكسجين اللازم.' },
      { id: 'b10_291_07', german: 'der Satellit', arabic: 'القمر الصناعي', article: 'der', plural: 'die Satelliten', emoji: '🛰️', exampleSentenceGerman: 'Satelliten senden Fernsehsignale und Wetterdaten zur Erde.', exampleSentenceArabic: 'الأقمار الصناعية ترسل إشارات البث وبيانات الطقس للأرض.' },
      { id: 'b10_291_08', german: 'die Sternschnuppe', arabic: 'الشهاب الساقط (النجم الهاوي)', article: 'die', plural: 'die Sternschnuppen', emoji: '🌠', exampleSentenceGerman: 'Wenn du eine Sternschnuppe siehst, darfst du dir etwas wünschen.', exampleSentenceArabic: 'عندما ترى شهاباً يلمع، يمكنك أن تتمنى أمنية جميلة.' },
      { id: 'b10_291_09', german: 'der Mondkrater', arabic: 'فوهة بركانية على سطح القمر', article: 'der', plural: 'die Mondkrater', emoji: '🌕', exampleSentenceGerman: 'Auf dem Mond sieht man durch das Teleskop viele Krater.', exampleSentenceArabic: 'على سطح القمر يرى المرء عبر التلسكوب فوهات عديدة.' },
      { id: 'b10_291_10', german: 'die Milchstraße', arabic: 'مجرة درب التبانة', article: 'die', plural: '-', emoji: '🌌', exampleSentenceGerman: 'In einer klaren Sommernacht leuchtet das Band der Milchstraße.', exampleSentenceArabic: 'في ليلة صيفية صافية يتلألأ شريط مجرة درب التبانة.' }
    ]
  },

  // 292. Dinosaurs & Prehistoric World (جريد 2 / 3)
  {
    id: 'curric_b10_292_dinosaurs_prehistoric',
    title: 'Dinosaurier und die Urzeit',
    titleTranslation: 'الديناصورات وعصور ما قبل التاريخ',
    gradeLevel: 'grade2',
    category: 'Geschichten & Fantasiewelten',
    description: 'أنواع الديناصورات والحفريات والبيض والهياكل العظمية القديمة',
    emoji: '🦖',
    items: [
      { id: 'b10_292_01', german: 'der Dinosaurier', arabic: 'الديناصور', article: 'der', plural: 'die Dinosaurier', emoji: '🦕', exampleSentenceGerman: 'Vor Millionen Jahren lebten riesige Dinosaurier auf der Erde.', exampleSentenceArabic: 'قبل ملايين السنين عاشت ديناصورات عملاقة على الأرض.' },
      { id: 'b10_292_02', german: 'der Tyrannosaurus Rex', arabic: 'تيرانوصور ريكس (المرعب)', article: 'der', plural: 'die Tyrannosaurier', emoji: '🦖', exampleSentenceGerman: 'Der T-Rex hatte scharfe Zähne und war ein starker Jäger.', exampleSentenceArabic: 'كان للتي-ريكس أسنان حادة جداً وكان صياداً قوياً.' },
      { id: 'b10_292_03', german: 'der Brachiosaurus', arabic: 'براكيوسورس (طويل العنق)', article: 'der', plural: 'die Brachiosaurier', emoji: '🦕', exampleSentenceGerman: 'Mit seinem langen Hals fraß der Brachiosaurus Blätter von hohen Baumkronen.', exampleSentenceArabic: 'بعنقه الطويل كان البراكيوسورس يأكل أوراق أعالي الشجر.' },
      { id: 'b10_292_04', german: 'das Fossil', arabic: 'الأحفورة الصخرية', article: 'das', plural: 'die Fossilien', emoji: '🐚', exampleSentenceGerman: 'Im Steinbruch entdecken Forscher eine uralte Versteinerung.', exampleSentenceArabic: 'في المقلع الحجري يكتشف الباحثون أحفورة قديمة متحجرة.' },
      { id: 'b10_292_05', german: 'das Dinosaurier-Ei', arabic: 'بيضة الديناصور المتحجرة', article: 'das', plural: 'die Dinosaurier-Eier', emoji: '🥚', exampleSentenceGerman: 'Das versteinerte Saurier-Ei ist im Museum ausgestellt.', exampleSentenceArabic: 'بيضة الديناصور المتحجرة معروضة في متحف التاريخ الطبيعي.' },
      { id: 'b10_292_06', german: 'die Ausgrabung', arabic: 'أعمال التنقيب والحفر الأثري', article: 'die', plural: 'die Ausgrabungen', emoji: '⛏️', exampleSentenceGerman: 'Bei der Ausgrabung arbeiten die Forscher vorsichtig mit feinen Pinseln.', exampleSentenceArabic: 'في أعمال التنقيب يعمل الباحثون بحذر وبفرش ناعمة.' },
      { id: 'b10_292_07', german: 'der Flugsaurier', arabic: 'الديناصور الطائر (بتروداكتيل)', article: 'der', plural: 'die Flugsaurier', emoji: '🦅', exampleSentenceGerman: 'Der Flugsaurier segelte mit breiten Schwingen durch die Urzeit-Luft.', exampleSentenceArabic: 'الديناصور الطائر كان يحلق بأجنحة عريضة في هواء العصور القديمة.' },
      { id: 'b10_292_08', german: 'der Pflanzenfresser', arabic: 'آكل الأعشاب والنباتات', article: 'der', plural: 'die Pflanzenfresser', emoji: '🌿', exampleSentenceGerman: 'Viele friedliche Dinosaurier waren reine Pflanzenfresser.', exampleSentenceArabic: 'كثير من الديناصورات الأليفة كانت من آكلات النباتات حصراً.' },
      { id: 'b10_292_09', german: 'der Fleischfresser', arabic: 'آكل اللحوم (المفترس)', article: 'der', plural: 'die Fleischfresser', emoji: '🥩', exampleSentenceGerman: 'Fleischfresser hatten kräftige Krallen zum Fangen.', exampleSentenceArabic: 'آكلات اللحوم كان لها مخالب قوية للإمساك بفرائسها.' },
      { id: 'b10_292_10', german: 'das Skelett', arabic: 'الهيكل العظمي الكامل', article: 'das', plural: 'die Skelette', emoji: '🦴', exampleSentenceGerman: 'Das riesige Dinosaurier-Skelett füllt die ganze Museumshalle.', exampleSentenceArabic: 'الهيكل العظمي الهائل للديناصور يملأ قاعة المتحف بالكامل.' }
    ]
  },

  // 293. Underwater Kingdom & Ocean Wonders (جريد 2 / 3)
  {
    id: 'curric_b10_293_underwater_kingdom',
    title: 'Das Geheimnis der Tiefsee und Unterwasserwelt',
    titleTranslation: 'أسرار أعماق البحار والعالم المائي العجيب',
    gradeLevel: 'grade2',
    category: 'Geschichten & Fantasiewelten',
    description: 'الغواصة وحورية البحر والشعاب المرجانية والكنز الغارق وكائنات الأعماق',
    emoji: '🧜‍♀️',
    items: [
      { id: 'b10_293_01', german: 'die Meerjungfrau', arabic: 'حورية البحر الخيالية', article: 'die', plural: 'die Meerjungfrauen', emoji: '🧜‍♀️', exampleSentenceGerman: 'Die schöne Meerjungfrau kämmt ihr langes glänzendes Haar.', exampleSentenceArabic: 'حورية البحر الحسناء تمشط شعرها الطويل اللامع.' },
      { id: 'b10_293_02', german: 'das Korallenriff', arabic: 'الحاجز / الحي المرجاني الملون', article: 'das', plural: 'die Korallenriffe', emoji: '🪸', exampleSentenceGerman: 'Am Korallenriff tummeln sich unzählige kleine Fische.', exampleSentenceArabic: 'عند الحاجز المرجاني تمرح أسراب لا حصر لها من الأسماك.' },
      { id: 'b10_293_03', german: 'das U-Boot', arabic: 'الغواصة الاستكشافية', article: 'das', plural: 'die U-Boote', emoji: '🤿', exampleSentenceGerman: 'Das gelbe U-Boot taucht tief hinab auf den Meeresgrund.', exampleSentenceArabic: 'الغواصة الصفراء تغوص عميقاً نحو قاع البحر.' },
      { id: 'b10_293_04', german: 'die Perle', arabic: 'اللؤلؤة الطبيعية البراقة', article: 'die', plural: 'die Perlen', emoji: '🦪', exampleSentenceGerman: 'In der geheimnisvollen Muschel schimmert eine weiße Perle.', exampleSentenceArabic: 'في المحارة الغامضة تلمع لؤلؤة بيضاء ساحرة.' },
      { id: 'b10_293_05', german: 'der versunkene Schatz', arabic: 'الكنز الغارق في قاع المحيط', article: 'der', plural: 'die versunkenen Schätze', emoji: '🪙', exampleSentenceGerman: 'Taucher suchen nach einem versunkenen Schatz im Wrack.', exampleSentenceArabic: 'الغواصون يبحثون عن كنز غارق داخل حطام السفينة.' },
      { id: 'b10_293_06', german: 'das Schiffswrack', arabic: 'حطام السفينة الغارقة', article: 'das', plural: 'die Schiffswracks', emoji: '🚢', exampleSentenceGerman: 'Das alte Schiffswrack ist jetzt die Heimat von bunten Korallen.', exampleSentenceArabic: 'حطام السفينة القديمة أصبح الآن موطناً للشعاب المرجانية.' },
      { id: 'b10_293_07', german: 'die Taucherbrille', arabic: 'نظارة الغوص تحت الماء', article: 'die', plural: 'die Taucherbrillen', emoji: '🥽', exampleSentenceGerman: 'Mit der Taucherbrille sehe ich unter Wasser gestochen scharf.', exampleSentenceArabic: 'بنظارة الغوص أرى تحت الماء بوضوح تام كالشمس.' },
      { id: 'b10_293_08', german: 'der Schnorchel', arabic: 'أنبوب التنفس للسباحة (السنوركل)', article: 'der', plural: 'die Schnorchel', emoji: '🤿', exampleSentenceGerman: 'Mit dem Schnorchel kann ich beim Schwimmen weiteratmen.', exampleSentenceArabic: 'بأنبوب التنفس يمكنني مواصلة التنفس أثناء السباحة على السطح.' },
      { id: 'b10_293_09', german: 'die Schwimmflosse', arabic: 'زعانف السباحة للقدمين', article: 'die', plural: 'die Schwimmflossen', emoji: '🩴', exampleSentenceGerman: 'Mit den Flossen gleite ich so schnell wie ein Delfin.', exampleSentenceArabic: 'بالزعانف أنساب بسرعة ورشاقة مثل الدلفين.' },
      { id: 'b10_293_10', german: 'die Tiefsee', arabic: 'أعماق البحار السحيقة', article: 'die', plural: '-', emoji: '🌊', exampleSentenceGerman: 'In der finsteren Tiefsee leuchten manche Fische selbst.', exampleSentenceArabic: 'في أعماق البحار المظلمة توجد أسماك تضيء بذاتها.' }
    ]
  },

  // 294. German Compound Nouns for Kids 1 (جريد 2 / 3)
  {
    id: 'curric_b10_294_compound_nouns_1',
    title: 'Zusammengesetzte Wörter 1: Wortbausteine',
    titleTranslation: 'الكلمات المركبة الألمانية 1: مكعبات بناء الكلمات',
    gradeLevel: 'grade2',
    category: 'Wortschatz-Erweiterung',
    description: 'كيف تركب الألمانية كلمتين لتصنع معنى جديداً: شمس+زهرة=دوار الشمس',
    emoji: '🧱',
    items: [
      { id: 'b10_294_01', german: 'der Regenschirm', arabic: 'مظلة المطر (مطر + مظلة)', article: 'der', plural: 'die Regenschirme', emoji: '☂️', exampleSentenceGerman: 'Regen + Schirm = der Regenschirm gegen Nässe.', exampleSentenceArabic: 'مطر + مظلة = شمسية المطر للحماية من البلل.' },
      { id: 'b10_294_02', german: 'der Schneemann', arabic: 'رجل الثلج (ثلج + رجل)', article: 'der', plural: 'die Schneemänner', emoji: '☃️', exampleSentenceGerman: 'Schnee + Mann = der Schneemann im Garten.', exampleSentenceArabic: 'ثلج + رجل = رجل الثلج في الحديقة.' },
      { id: 'b10_294_03', german: 'der Apfelbaum', arabic: 'شجرة التفاح (تفاح + شجرة)', article: 'der', plural: 'die Apfelbäume', emoji: '🍎', exampleSentenceGerman: 'Apfel + Baum = der Apfelbaum voller Früchte.', exampleSentenceArabic: 'تفاح + شجرة = شجرة التفاح المليئة بالثمار.' },
      { id: 'b10_294_04', german: 'die Sonnenblume', arabic: 'دوار الشمس / عباد الشمس (شمس + زهرة)', article: 'die', plural: 'die Sonnenblumen', emoji: '🌻', exampleSentenceGerman: 'Sonne + Blume = die leuchtend gelbe Sonnenblume.', exampleSentenceArabic: 'شمس + زهرة = زهرة دوار الشمس الصفراء الزاهية.' },
      { id: 'b10_294_05', german: 'das Haustier', arabic: 'الحيوان الأليف المنزلي (بيت + حيوان)', article: 'das', plural: 'die Haustiere', emoji: '🐶', exampleSentenceGerman: 'Haus + Tier = das Haustier, das bei uns wohnt.', exampleSentenceArabic: 'بيت + حيوان = الحيوان المنزلي الأليف.' },
      { id: 'b10_294_06', german: 'die Zahnbürste', arabic: 'فرشاة الأسنان (أسنان + فرشاة)', article: 'die', plural: 'die Zahnbürsten', emoji: '🪥', exampleSentenceGerman: 'Zahn + Bürste = die Zahnbürste für saubere Zähne.', exampleSentenceArabic: 'سن + فرشاة = فرشاة الأسنان لأسنان ناصعة.' },
      { id: 'b10_294_07', german: 'das Federmäppchen', arabic: 'المقلمة المدرسية (ريشة + حافظة)', article: 'das', plural: 'die Federmäppchen', emoji: '✏️', exampleSentenceGerman: 'Feder + Mappe = das Federmäppchen für alle Stifte.', exampleSentenceArabic: 'ريشة قلم + حافظة = مقلمة لحفظ الأقلام.' },
      { id: 'b10_294_08', german: 'der Fußballplatz', arabic: 'ملعب كرة القدم (قدم + كرة + ساحة)', article: 'der', plural: 'die Fußballplätze', emoji: '⚽', exampleSentenceGerman: 'Fuß + Ball + Platz = der Fußballplatz zum Kicken.', exampleSentenceArabic: 'قدم + كرة + ساحة = ملعب كرة القدم للمباريات.' },
      { id: 'b10_294_09', german: 'die Schultasche', arabic: 'الحقيبة المدرسية (مدرسة + حقيبة)', article: 'die', plural: 'die Schultaschen', emoji: '🎒', exampleSentenceGerman: 'Schule + Tasche = die Schultasche für Hefte und Bücher.', exampleSentenceArabic: 'مدرسة + حقيبة = الحقيبة المدرسية للكتب.' },
      { id: 'b10_294_10', german: 'das Spielzeug', arabic: 'اللعبة (لعب + أداة/شيء)', article: 'das', plural: 'die Spielzeuge', emoji: '🧸', exampleSentenceGerman: 'Spielen + Zeug = das Spielzeug zum Vergnügen.', exampleSentenceArabic: 'لعب + أداة = اللعبة للترفيه والتسلية.' }
    ]
  },

  // 295. German Compound Nouns for Kids 2 (جريد 3 / 4)
  {
    id: 'curric_b10_295_compound_nouns_2',
    title: 'Zusammengesetzte Wörter 2: Technik und Haushalt',
    titleTranslation: 'الكلمات المركبة الألمانية 2: الأجهزة والمنزل والآلات',
    gradeLevel: 'grade3',
    category: 'Wortschatz-Erweiterung',
    description: 'مركبات ألمانية مشهورة: تبريد+خزانة=ثلاجة، طيران+أداة=طائرة، يد+حذاء=قفاز',
    emoji: '🧩',
    items: [
      { id: 'b10_295_01', german: 'der Kühlschrank', arabic: 'الثلاجة (تبريد + خزانة)', article: 'der', plural: 'die Kühlschränke', emoji: '🧊', exampleSentenceGerman: 'Kühlen + Schrank = der Kühlschrank hält Essen frisch.', exampleSentenceArabic: 'تبريد + خزانة = الثلاجة تحفظ الأطعمة باردة وطازجة.' },
      { id: 'b10_295_02', german: 'der Handschuh', arabic: 'القفاز (يد + حذاء)', article: 'der', plural: 'die Handschuhe', emoji: '🧤', exampleSentenceGerman: 'Hand + Schuh = der Handschuh wärmt meine Finger im Winter.', exampleSentenceArabic: 'يد + حذاء = القفاز يدفئ أصابعي في الشتاء.' },
      { id: 'b10_295_03', german: 'das Flugzeug', arabic: 'الطائرة (طيران + أداة)', article: 'das', plural: 'die Flugzeuge', emoji: '✈️', exampleSentenceGerman: 'Fliegen + Zeug = das Flugzeug am hohen Himmel.', exampleSentenceArabic: 'طيران + أداة = الطائرة في أعالي السماء.' },
      { id: 'b10_295_04', german: 'der Staubsauger', arabic: 'المكنسة الكهربائية (غبار + شفاط)', article: 'der', plural: 'die Staubsauger', emoji: '🧹', exampleSentenceGerman: 'Staub + Sauger = der Staubsauger reinigt den Teppich.', exampleSentenceArabic: 'غبار + شفاط = المكنسة الكهربائية تنظف السجاد.' },
      { id: 'b10_295_05', german: 'die Waschmaschine', arabic: 'الغسالة الكهربائية (غسيل + ماكينة)', article: 'die', plural: 'die Waschmaschinen', emoji: '🧺', exampleSentenceGerman: 'Waschen + Maschine = die Waschmaschine wäscht Kleidung sauber.', exampleSentenceArabic: 'غسيل + ماكينة = الغسالة تغسل الثياب حتى تنظف.' },
      { id: 'b10_295_06', german: 'das Feuerwehrauto', arabic: 'سيارة الإطفاء (نار + دفاع + سيارة)', article: 'das', plural: 'die Feuerwehrautos', emoji: '🚒', exampleSentenceGerman: 'Feuer + Wehr + Auto = das Feuerwehrauto mit Blaulicht.', exampleSentenceArabic: 'نار + حماية + سيارة = سيارة الإطفاء مع الضوء الأزرق.' },
      { id: 'b10_295_07', german: 'das Krankenhaus', arabic: 'المستشفى (مرضى + دار)', article: 'das', plural: 'die Krankenhäuser', emoji: '🏥', exampleSentenceGerman: 'Kranke + Haus = das Krankenhaus, wo Ärzte gesund pflegen.', exampleSentenceArabic: 'مرضى + دار = المستشفى حيث يعالج الأطباء المرضى.' },
      { id: 'b10_295_08', german: 'die Armbanduhr', arabic: 'ساعة اليد (ذراع + سوار + ساعة)', article: 'die', plural: 'die Armbanduhren', emoji: '⌚', exampleSentenceGerman: 'Arm + Band + Uhr = die Armbanduhr am Handgelenk.', exampleSentenceArabic: 'ذراع + سوار + ساعة = ساعة اليد على المعصم.' },
      { id: 'b10_295_09', german: 'die Eisenbahn', arabic: 'القطار / السكة الحديدية (حديد + سكة)', article: 'die', plural: 'die Eisenbahnen', emoji: '🚆', exampleSentenceGerman: 'Eisen + Bahn = die Eisenbahn fährt auf festen Schienen.', exampleSentenceArabic: 'حديد + مسار = السكة الحديدية والقطار يسير على القضبان.' },
      { id: 'b10_295_10', german: 'das Wörterbuch', arabic: 'القاموس / المعجم (كلمات + كتاب)', article: 'das', plural: 'die Wörterbücher', emoji: '📖', exampleSentenceGerman: 'Wörter + Buch = das Wörterbuch mit vielen Übersetzungen.', exampleSentenceArabic: 'كلمات + كتاب = القاموس المليء بالترجمات والشروحات.' }
    ]
  },

  // 296. Common Phrasal Chunks & Routines (جريد 2 / 3)
  {
    id: 'curric_b10_296_everyday_chunks',
    title: 'Typische Redewendungen im Alltag',
    titleTranslation: 'تراكيب وعبارات يومية جاهزة للأطفال',
    gradeLevel: 'grade2',
    category: 'Wortschatz-Erweiterung',
    description: 'تراكيب ألمانية طبيعية مثل: تنظيف الأسنان، غسيل اليدين، وترتيب الغرفة',
    emoji: '🗣️',
    items: [
      { id: 'b10_296_01', german: 'Zähne putzen', arabic: 'ينظف أسنانه بالفرشاة', emoji: '🪥', exampleSentenceGerman: 'Morgens und abends putze ich gründlich meine Zähne.', exampleSentenceArabic: 'صباحاً ومساءً أنظف أسناني بالفرشاة بعناية.' },
      { id: 'b10_296_02', german: 'Hände waschen', arabic: 'يغسل يديه بالماء والصابون', emoji: '🧼', exampleSentenceGerman: 'Vor dem Essen waschen wir uns gründlich die Hände.', exampleSentenceArabic: 'قبل تناول الطعام نغسل أيدينا جيداً بالصابون.' },
      { id: 'b10_296_03', german: 'ins Bett gehen', arabic: 'يذهب إلى فراش النوم', emoji: '🛏️', exampleSentenceGerman: 'Um acht Uhr abends gehe ich ins kuschelige Bett.', exampleSentenceArabic: 'في تمام الثامنة مساءً أذهب إلى سريري المريح.' },
      { id: 'b10_296_04', german: 'Hausaufgaben machen', arabic: 'يؤدي واجباته المدرسية', emoji: '📝', exampleSentenceGerman: 'Nach dem Mittagessen mache ich gleich meine Hausaufgaben.', exampleSentenceArabic: 'بعد الغداء أقوم على الفور بأداء واجباتي المدرسية.' },
      { id: 'b10_296_05', german: 'den Tisch decken', arabic: 'يجهّز ويرتّب مائدة الطعام', emoji: '🍽️', exampleSentenceGerman: 'Ich helfe Papa und decke den Tisch mit Tellern und Gabeln.', exampleSentenceArabic: 'أساعد أبي وأرتب المائدة بالأطباق والشوك.' },
      { id: 'b10_296_06', german: 'Ordnung halten', arabic: 'يحافظ على النظافة والترتيب', emoji: '🧹', exampleSentenceGerman: 'Im Kinderzimmer halten wir gerne Ordnung.', exampleSentenceArabic: 'في غرفة الأطفال نحب الحفاظ على الترتيب والنظام.' },
      { id: 'b10_296_07', german: 'einen Spaziergang machen', arabic: 'يقوم بنزهة سيراً على الأقدام', emoji: '🚶‍♂️', exampleSentenceGerman: 'Am Sonntagnachmittag machen wir einen Spaziergang im Park.', exampleSentenceArabic: 'بعد ظهر الأحد نقوم بنزهة مشي في الحديقة العامة.' },
      { id: 'b10_296_08', german: 'Platz nehmen', arabic: 'يتفضل بالجلوس في مقعده', emoji: '🪑', exampleSentenceGerman: 'Die Lehrerin sagt freundlich: Bitte nehmt alle Platz!', exampleSentenceArabic: 'المعلمة تقول بلطف: تفضلوا جميعاً بالجلوس في أماكنكم!' },
      { id: 'b10_296_09', german: 'Bescheid sagen', arabic: 'يخطر / يخبر مسبقاً', emoji: '📢', exampleSentenceGerman: 'Sag mir bitte Bescheid, wenn du losgehst.', exampleSentenceArabic: 'أخبرني من فضلك عندما تكون مستعداً للانطلاق.' },
      { id: 'b10_296_10', german: 'Spaß haben', arabic: 'يقضي وقتاً ممتعاً ومرحاً', emoji: '🎉', exampleSentenceGerman: 'Beim Deutschlernen haben wir riesigen Spaß!', exampleSentenceArabic: 'أثناء تعلم الألمانية نقضي وقتاً مليئاً بالمرح والمتعة!' }
    ]
  },

  // 297. Fun German Idioms Explained for Kids (جريد 3 / 4)
  {
    id: 'curric_b10_297_german_idioms_kids',
    title: 'Lustige deutsche Redensarten für Kinder',
    titleTranslation: 'أمثال وتعبيرات مجازية مرحة ومشهورة في الألمانية',
    gradeLevel: 'grade3',
    category: 'Wortschatz-Erweiterung',
    description: 'تعبيرات مجازية شائعة مثل: يضغط الإبهام للتمني، وفراشات في البطن',
    emoji: '🥨',
    items: [
      { id: 'b10_297_01', german: 'die Daumen drücken', arabic: 'يتمنى التوفيق بقوة (يضم إبهاميه تشجيعاً)', emoji: '🤞', exampleSentenceGerman: 'Ich drücke dir für die Mathe-Arbeit fest die Daumen!', exampleSentenceArabic: 'أتمنى لك التوفيق من كل قلبي في اختبار الحساب!' },
      { id: 'b10_297_02', german: 'Schwein haben', arabic: 'يحالفه الحظ الجيد غير المتوقع', emoji: '🍀', exampleSentenceGerman: 'Da hast du aber Schwein gehabt, dass der Bus gewartet hat!', exampleSentenceArabic: 'لقد حالفك الحظ حقاً لأن الحافلة انتظرتك!' },
      { id: 'b10_297_03', german: 'Schmetterlinge im Bauch haben', arabic: 'يشعر بفراشات في بطنه (حماس وسعادة ورهبة خفيفة)', emoji: '🦋', exampleSentenceGerman: 'Vor dem Schulfest habe ich freudige Schmetterlinge im Bauch.', exampleSentenceArabic: 'قبل حفل المدرسة أشعر بحماس وسعادة ترتعش في داخلي.' },
      { id: 'b10_297_04', german: 'Tomaten auf den Augen haben', arabic: 'لا يرى شيئاً واضحاً أمامه (أعمى البصر لحظياً)', emoji: '🍅', exampleSentenceGerman: 'Mein Stift liegt direkt vor mir, ich hatte wohl Tomaten auf den Augen!', exampleSentenceArabic: 'قلمي ممدود أمامي مباشرة، يبدو أنني لم أره على وضوحه!' },
      { id: 'b10_297_05', german: 'die Ohren spitzen', arabic: 'يرهف السمع وينصت بكل انتباه', emoji: '🐰', exampleSentenceGerman: 'Spitzt die Ohren, jetzt kommt eine spannende Geschichte!', exampleSentenceArabic: 'أنصتوا بكل حواسكم، فالآن تبدأ قصة مشوقة للغاية!' },
      { id: 'b10_297_06', german: 'zwei linke Hände haben', arabic: 'غير ماهر في الأعمال اليدوية (مجازي)', emoji: '🧤', exampleSentenceGerman: 'Niemand hat wirklich zwei linke Hände, Übung macht den Meister!', exampleSentenceArabic: 'لا أحد يولد عاجزاً عن الأشغال اليدوية، فالتدريب يصنع البطل!' },
      { id: 'b10_297_07', german: 'einen Frosch im Hals haben', arabic: 'صوته مبحوح وبحاجة للتنحنح', emoji: '🐸', exampleSentenceGerman: 'Hust! Ich habe gerade einen kleinen Frosch im Hals.', exampleSentenceArabic: 'احم! صوتي مبحوح قليلاً وأحتاج إلى شربة ماء.' },
      { id: 'b10_297_08', german: 'alles in Butter', arabic: 'كل شيء على ما يرام وبأفضل حال', emoji: '🧈', exampleSentenceGerman: 'Keine Sorge, es ist alles in bester Butter!', exampleSentenceArabic: 'لا تقلق على الإطلاق، فكل شيء على ما يرام وسليم!' },
      { id: 'b10_297_09', german: 'aus einer Mücke einen Elefanten machen', arabic: 'يهوّل الأمر ويصنع من الحبة قبة', emoji: '🦟', exampleSentenceGerman: 'Das kleine Missgeschick ist nicht schlimm, mach keinen Elefanten daraus.', exampleSentenceArabic: 'الخطأ البسيط ليس كارثة، فلا تهوّل الأمر بلا داعٍ.' },
      { id: 'b10_297_10', german: 'Übung macht den Meister', arabic: 'التدريب والمثابرة يصنعان المعلم البارع (مثل شهير)', emoji: '🏆', exampleSentenceGerman: 'Nicht aufgeben! Übung macht den Meister!', exampleSentenceArabic: 'لا تستسلم أبداً! فالتدريب والممارسة يصنعان التفوق دائماً!' }
    ]
  },

  // 298. Essential Separable Prefix Verbs (جريد 3 / 4)
  {
    id: 'curric_b10_298_separable_prefixes',
    title: 'Trennbare Verben im Alltag',
    titleTranslation: 'الأفعال المنفصلة الأساسية في حياة الطفل',
    gradeLevel: 'grade3',
    category: 'Wortschatz-Erweiterung',
    description: 'أزواج الأفعال المنفصلة الشائعة: يفتح/يغلق، يشغل/يطفئ، ينهض/ينام',
    emoji: '✂️',
    items: [
      { id: 'b10_298_01', german: 'aufmachen', arabic: 'يفتح (الباب، الشباك، الكتاب)', emoji: '🚪', exampleSentenceGerman: 'Ich mache das Fenster auf, um frische Luft hereinzulassen.', exampleSentenceArabic: 'أفتح النافذة للسماح للهواء النقي بالدخول.' },
      { id: 'b10_298_02', german: 'zumachen', arabic: 'يغلق (الباب، الشباك، الصندوق)', emoji: '🚪', exampleSentenceGerman: 'Bitte mach die Tür leise zu!', exampleSentenceArabic: 'من فضلك أغلق الباب بهدوء!' },
      { id: 'b10_298_03', german: 'anmachen', arabic: 'يشغل (المصباح أو الراديو)', emoji: '💡', exampleSentenceGerman: 'Es wird dunkel, ich mache die Leselampe an.', exampleSentenceArabic: 'بدأ الظلام يحل، سأشعل مصباح القراءة.' },
      { id: 'b10_298_04', german: 'ausmachen', arabic: 'يطفئ (الضوء أو الجهاز)', emoji: '💡', exampleSentenceGerman: 'Vergiss nicht das Licht im Flur auszumachen!', exampleSentenceArabic: 'لا تنسَ إطفاء الضوء في الممر عند الخروج!' },
      { id: 'b10_298_05', german: 'aufstehen', arabic: 'ينهض من الفراش صباحاً', emoji: '⏰', exampleSentenceGerman: 'Um sieben Uhr stehe ich fröhlich auf.', exampleSentenceArabic: 'في السابعة صباحاً أنهض من سريري بنشاط.' },
      { id: 'b10_298_06', german: 'einschlafen', arabic: 'يستغرق في النوم', emoji: '😴', exampleSentenceGerman: 'Nach der Gutenachtgeschichte schlafe ich schnell ein.', exampleSentenceArabic: 'بعد قصة قبل النوم أستغرق في النوم سريعاً.' },
      { id: 'b10_298_07', german: 'einpacken', arabic: 'يوضب ويحزم في الحقيبة', emoji: '🎒', exampleSentenceGerman: 'Ich packe meine Buntstifte in das Mäppchen ein.', exampleSentenceArabic: 'أضع أقلام التلوين داخل مقلمتي وأوضبها.' },
      { id: 'b10_298_08', german: 'auspacken', arabic: 'يفرغ الحقيبة / يفتح الهدية', emoji: '🎁', exampleSentenceGerman: 'Neugierig packe ich das Geburtstagsgeschenk aus.', exampleSentenceArabic: 'بشغف وفضول أفتح هدية عيد ميلادي.' },
      { id: 'b10_298_09', german: 'mitkommen', arabic: 'يرافق / يأتي معه', emoji: '🚶‍♂️', exampleSentenceGerman: 'Kommst du mit zum Spielplatz?', exampleSentenceArabic: 'هل تأتي معي لمرافقتي إلى الملعب؟' },
      { id: 'b10_298_10', german: 'aufräumen', arabic: 'يرتب وينظم الغرفة', emoji: '🧹', exampleSentenceGerman: 'Am Samstag räumen wir gemeinsam das Spielzimmer auf.', exampleSentenceArabic: 'يوم السبت نرتب معاً غرفة اللعب وننظمها.' }
    ]
  },

  // 299. Diminutives & Suffixes (-chen / -lein) (جريد 2 / 3)
  {
    id: 'curric_b10_299_diminutives_suffixes',
    title: 'Verniedlichungen: Die Endungen -chen und -lein',
    titleTranslation: 'صيغ التصغير والتحبيب: اللاحقتان chen و lein',
    gradeLevel: 'grade2',
    category: 'Wortschatz-Erweiterung',
    description: 'قاعدة التصغير الألمانية التي تجعل كل الأسماء محايدة das وتعبر عن اللطف',
    emoji: '🐣',
    items: [
      { id: 'b10_299_01', german: 'das Häuschen', arabic: 'البيت الصغير اللطيف (تصغير Haus)', article: 'das', plural: 'die Häuschen', emoji: '🏡', exampleSentenceGerman: 'Im Garten steht ein kleines Vogelhäuschen.', exampleSentenceArabic: 'في الحديقة يوجد بيت صغير لطيف للطيور.' },
      { id: 'b10_299_02', german: 'das Kätzchen', arabic: 'القطيطة الصغيرة (تصغير Katze)', article: 'das', plural: 'die Kätzchen', emoji: '🐱', exampleSentenceGerman: 'Das Kätzchen trinkt schnurrend ein Schälchen Milch.', exampleSentenceArabic: 'القطيطة الصغيرة تشرب طبق حليب وهي تموء بلطف.' },
      { id: 'b10_299_03', german: 'das Hündchen', arabic: 'الجرو الصغير (تصغير Hund)', article: 'das', plural: 'die Hündchen', emoji: '🐶', exampleSentenceGerman: 'Das verspielte Hündchen rollt den kleinen Ball.', exampleSentenceArabic: 'الجرو الصغير المرح يدحرج الكرة الصغيرة.' },
      { id: 'b10_299_04', german: 'das Sternchen', arabic: 'النجمة الصغيرة اللامعة (تصغير Stern)', article: 'das', plural: 'die Sternchen', emoji: '⭐', exampleSentenceGerman: 'Auf deiner Belohnungskarte klebt ein goldenes Sternchen.', exampleSentenceArabic: 'على بطاقة مكافأتك تلصق نجمة ذهبية صغيرة لامعة.' },
      { id: 'b10_299_05', german: 'das Bäumchen', arabic: 'الشجيرة الصغيرة (تصغير Baum)', article: 'das', plural: 'die Bäumchen', emoji: '🌱', exampleSentenceGerman: 'Wir pflanzen ein junges Apfelbäumchen in den Garten.', exampleSentenceArabic: 'نغرس شجيرة تفاح صغيرة وفتية في الحديقة.' },
      { id: 'b10_299_06', german: 'das Büchlein', arabic: 'الكتيب الصغير (تصغير Buch)', article: 'das', plural: 'die Büchlein', emoji: '📕', exampleSentenceGerman: 'In meiner Tasche habe ich ein kleines Notizbüchlein.', exampleSentenceArabic: 'في حقيبتي أحتفظ بكتيب ملاحظات صغير.' },
      { id: 'b10_299_07', german: 'das Blümchen', arabic: 'الزهرة الصغيرة الرقيقة (تصغير Blume)', article: 'das', plural: 'die Blümchen', emoji: '🌼', exampleSentenceGerman: 'Auf der Wiese blüht ein gelbes Blümchen.', exampleSentenceArabic: 'على المروج الخضراء تتفتح زهرة صفراء صغيرة ورقيقة.' },
      { id: 'b10_299_08', german: 'das Vögelchen', arabic: 'العصفور الصغير الوديع (تصغير Vogel)', article: 'das', plural: 'die Vögelchen', emoji: '🐦', exampleSentenceGerman: 'Das kleine Vögelchen zwitschert eine heitere Melodie.', exampleSentenceArabic: 'العصفور الصغير يغرد بلحن عذب ومبهج.' },
      { id: 'b10_299_09', german: 'das Brötchen', arabic: 'رغيف الخبز الصغير (تصغير Brot)', article: 'das', plural: 'die Brötchen', emoji: '🥖', exampleSentenceGerman: 'Zum Frühstück esse ich ein frisches Brötchen mit Marmelade.', exampleSentenceArabic: 'على الإفطار آكل رغيف خبز صغير طازج مع المربى.' },
      { id: 'b10_299_10', german: 'das Tierchen', arabic: 'الكائن أو الحيوان الصغير اللطيف', article: 'das', plural: 'die Tierchen', emoji: '🐞', exampleSentenceGerman: 'Auf dem Blatt krabbelt ein winziges Tierchen.', exampleSentenceArabic: 'على ورقة الشجر يدب كائن صغير ولطيف.' }
    ]
  },

  // 300. Grand Graduation & Children's Success Milestone (جريد 4 / A2)
  {
    id: 'curric_b10_300_graduation_milestone',
    title: 'Der große Meilenstein: Glückliche Deutsch-Meister!',
    titleTranslation: 'الإنجاز الكبير وتتويج أبطال اللغة الألمانية الصغار',
    gradeLevel: 'grade4',
    category: 'Wortschatz-Erweiterung',
    description: 'المفردات الختامية للاحتفال بإتقان مكتبة الـ 3000 كلمة والنجاح الباهر',
    emoji: '🎓',
    items: [
      { id: 'b10_300_01', german: 'der Wortschatz', arabic: 'الحصيلة والمخزون اللغوي', article: 'der', plural: 'die Wortschätze', emoji: '💎', exampleSentenceGerman: 'Du hast jetzt einen riesigen deutschen Wortschatz gelernt!', exampleSentenceArabic: 'لقد تعلمت الآن حصيلة ومخزوناً لغوياً ألمانياً هائلاً!' },
      { id: 'b10_300_02', german: 'der Erfolg', arabic: 'النجاح والتفوق الباهر', article: 'der', plural: 'die Erfolge', emoji: '🌟', exampleSentenceGerman: 'Fleißiges Üben führt immer zum großen Erfolg.', exampleSentenceArabic: 'الممارسة والمذاكرة الدؤوبة تقود دوماً للنجاح الباهر.' },
      { id: 'b10_300_03', german: 'das Diplom / Zertifikat', arabic: 'شهادة التقدير والاجتياز', article: 'das', plural: 'die Diplome', emoji: '📜', exampleSentenceGerman: 'Hier ist dein wohlverdientes Sprachdiplom von Glück Teacher!', exampleSentenceArabic: 'تفضل شهادة تقديرك المستحقة بجدارة من غلوك تيتشر!' },
      { id: 'b10_300_04', german: 'der Meister / die Meisterin', arabic: 'البطل المتقن / الأستاذ الماهر', article: 'der', plural: 'die Meister', emoji: '🥇', exampleSentenceGerman: 'Du bist jetzt ein wahrer deutscher Wortschatzmeister!', exampleSentenceArabic: 'أنت الآن بطل ومتقن حقيقي للمفردات الألمانية!' },
      { id: 'b10_300_05', german: 'die Glückwünsche', arabic: 'التهاني والتبريكات القلبية', article: 'die', plural: 'die Glückwünsche', emoji: '💐', exampleSentenceGerman: 'Herzliche Glückwünsche zu dieser fantastischen Leistung!', exampleSentenceArabic: 'خالص التهاني والتبريكات القلبية على هذا الإنجاز الخيالي!' },
      { id: 'b10_300_06', german: 'das Abenteuer', arabic: 'المغامرة الاستكشافية الشيقة', article: 'das', plural: 'die Abenteuer', emoji: '🗺️', exampleSentenceGerman: 'Das Lernen war ein aufregendes und schönes Abenteuer.', exampleSentenceArabic: 'كانت رحلة التعلم مغامرة شيقة ومليئة بالبهجة.' },
      { id: 'b10_300_07', german: 'das Wissen', arabic: 'العلم والمعرفة الواسعة', article: 'das', plural: '-', emoji: '🧠', exampleSentenceGerman: 'Wissen ist wie ein wertvoller Schatz, der dir immer bleibt.', exampleSentenceArabic: 'العلم والمعرفة كنز ثمين يبقى معك طوال العمر.' },
      { id: 'b10_300_08', german: 'die Zukunft', arabic: 'المستقبل المشرق الواعد', article: 'die', plural: '-', emoji: '🚀', exampleSentenceGerman: 'Mit deinen Sprachen steht dir die Zukunft weit offen.', exampleSentenceArabic: 'مع لغاتك المتعددة، المستقبل المشرق يفتح لك أبوابه.' },
      { id: 'b10_300_09', german: 'weitergehen', arabic: 'يواصل المسير للأمام دوماً', emoji: '👣', exampleSentenceGerman: 'Jeder neue Tag ist eine Chance, neugierig weiterzugehen.', exampleSentenceArabic: 'كل يوم جديد هو فرصة لمواصلة التعلم بشغف للأمام.' },
      { id: 'b10_300_10', german: 'das Glück', arabic: 'السعادة والحظ الطيب والتوفيق (غلوك)', article: 'das', plural: '-', emoji: '🍀', exampleSentenceGerman: 'Viel Glück und Freude auf all deinen weiteren Wegen!', exampleSentenceArabic: 'كل السعادة والتوفيق والحظ السعيد في جميع دروبك القادمة!' }
    ]
  }
];
