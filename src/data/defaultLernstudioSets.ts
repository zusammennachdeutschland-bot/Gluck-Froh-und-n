import { LernstudioSet } from '../types/lernstudio';

export const DEFAULT_LERNSTUDIO_SETS: LernstudioSet[] = [
  // ==================== المستوى الأول: الكلمات الأساسية ====================
  {
    id: 'set_def_01_begruessung',
    title: 'Begrüßungen und Verabschiedungen',
    topic: 'التحيات والوداع',
    grade: 'المستوى الأول: الكلمات الأساسية',
    level: 'A1',
    difficulty: 'easy',
    description: 'تعلم أهم عبارات التحية والوداع باللغة الألمانية للأطفال.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'it_b1', german: 'Hallo', arabic: 'مرحباً', emoji: '👋', exampleSentenceGerman: 'Hallo! Wie geht es dir?', exampleSentenceArabic: 'مرحباً! كيف حالك؟', missingLetterWord: 'H_llo', sentence4Elements: ['Hallo,', 'wie', 'geht', 'es?'] },
      { id: 'it_b2', german: 'Guten Morgen', arabic: 'صباح الخير', emoji: '🌅', exampleSentenceGerman: 'Guten Morgen, Mama!', exampleSentenceArabic: 'صباح الخير يا أمي!', missingLetterWord: 'Guten M_rgen', sentence4Elements: ['Guten', 'Morgen,', 'liebe', 'Mama!'] },
      { id: 'it_b3', german: 'Guten Tag', arabic: 'نهار سعيد / مرحباً', emoji: '☀️', exampleSentenceGerman: 'Guten Tag, Herr Weber.', exampleSentenceArabic: 'نهار سعيد يا سيد فيبر.', missingLetterWord: 'Guten T_g', sentence4Elements: ['Guten', 'Tag,', 'liebe', 'Kinder!'] },
      { id: 'it_b4', german: 'Guten Abend', arabic: 'مساء الخير', emoji: '🌆', exampleSentenceGerman: 'Guten Abend zusammen!', exampleSentenceArabic: 'مساء الخير جميعاً!', missingLetterWord: 'Guten A_end', sentence4Elements: ['Guten', 'Abend', 'an', 'alle!'] },
      { id: 'it_b5', german: 'Gute Nacht', arabic: 'تصبح على خير', emoji: '🌙', exampleSentenceGerman: 'Gute Nacht, schlaf gut!', exampleSentenceArabic: 'تصبح على خير، نم جيداً!', missingLetterWord: 'Gute N_cht', sentence4Elements: ['Gute', 'Nacht,', 'schlaf', 'gut!'] },
      { id: 'it_b6', german: 'Tschüss', arabic: 'باي / مع السلامة', emoji: '🙋‍♂️', exampleSentenceGerman: 'Tschüss, bis morgen!', exampleSentenceArabic: 'مع السلامة، إلى الغد!', missingLetterWord: 'Tsch_ss', sentence4Elements: ['Tschüss,', 'bis', 'morgen', 'wieder!'] },
      { id: 'it_b7', german: 'Auf Wiedersehen', arabic: 'إلى اللقاء', emoji: '👋', exampleSentenceGerman: 'Auf Wiedersehen, Frau Müller!', exampleSentenceArabic: 'إلى اللقاء يا سيدة مولر!', missingLetterWord: 'Auf Wi_dersehen', sentence4Elements: ['Auf', 'Wiedersehen', 'bis', 'bald!'] },
      { id: 'it_b8', german: 'Bis später', arabic: 'أراك لاحقاً', emoji: '⏳', exampleSentenceGerman: 'Tschüss, bis später!', exampleSentenceArabic: 'مع السلامة، أراك لاحقاً!', missingLetterWord: 'Bis sp_ter', sentence4Elements: ['Bis', 'später', 'im', 'Park!'] },
      { id: 'it_b9', german: 'Danke', arabic: 'شكراً', emoji: '🙏', exampleSentenceGerman: 'Danke für das Geschenk!', exampleSentenceArabic: 'شكراً على الهدية!', missingLetterWord: 'D_nke', sentence4Elements: ['Vielen', 'Dank', 'für', 'alles!'] },
      { id: 'it_b10', german: 'Bitte', arabic: 'عفواً / تفضل', emoji: '😊', exampleSentenceGerman: 'Bitte schön!', exampleSentenceArabic: 'عفواً / على الرحب والسعة!', missingLetterWord: 'B_tte', sentence4Elements: ['Bitte', 'schön,', 'sehr', 'gerne!'] }
    ]
  },
  {
    id: 'set_def_02_vorstellen',
    title: 'Sich vorstellen',
    topic: 'التعريف بالنفس',
    grade: 'المستوى الأول: الكلمات الأساسية',
    level: 'A1',
    difficulty: 'easy',
    description: 'عبارات تقديم النفس والتعارف البسيطة للأطفال.',
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
      { id: 'it_v8', german: 'Ich komme aus...', arabic: 'أنا قادم من...', emoji: '✈️', exampleSentenceGerman: 'Ich komme aus Ägypten.', exampleSentenceArabic: 'أنا من مصر.', missingLetterWord: 'Ich k_mme aus', sentence4Elements: ['Ich', 'komme', 'aus', 'Deutschland.'] },
      { id: 'it_v9', german: 'Wer bist du?', arabic: 'من تكون؟', emoji: '🔍', exampleSentenceGerman: 'Hallo, wer bist du?', exampleSentenceArabic: 'مرحباً، من تكون أنت؟', missingLetterWord: 'W_r bist du?', sentence4Elements: ['Wer', 'bist', 'du', 'genau?'] },
      { id: 'it_v10', german: 'Schön dich kennenzulernen', arabic: 'سررت بلقائك', emoji: '🤝', exampleSentenceGerman: 'Hallo! Schön dich kennenzulernen.', exampleSentenceArabic: 'مرحباً! سررت بلقائك.', missingLetterWord: 'Sch_n dich kennenzulernen', sentence4Elements: ['Schön', 'dich', 'heute', 'kennenzulernen!'] }
    ]
  },
  {
    id: 'set_def_03_alphabet',
    title: 'Das Alphabet',
    topic: 'الأبجدية الألمانية',
    grade: 'المستوى الأول: الكلمات الأساسية',
    level: 'A1',
    difficulty: 'easy',
    description: 'حروف الأبجدية الألمانية نطقاً وكتابة للأطفال.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'it_alp_a', german: 'A - wie Apfel', arabic: 'حرف A - مثل تفاحة', emoji: '🍎', exampleSentenceGerman: 'A steht für Apfel.', exampleSentenceArabic: 'A يرمز للتفاحة.', missingLetterWord: 'A - wie A_fel', sentence4Elements: ['A', 'wie', 'der', 'Apfel.'] },
      { id: 'it_alp_b', german: 'B - wie Ball', arabic: 'حرف B - مثل كرة', emoji: '⚽', exampleSentenceGerman: 'B steht für Ball.', exampleSentenceArabic: 'B يرمز للكرة.', missingLetterWord: 'B - wie B_ll', sentence4Elements: ['B', 'wie', 'der', 'Ball.'] },
      { id: 'it_alp_c', german: 'C - wie Computer', arabic: 'حرف C - مثل حاسوب', emoji: '💻', exampleSentenceGerman: 'C steht für Computer.', exampleSentenceArabic: 'C يرمز للحاسوب.', missingLetterWord: 'C - wie C_mputer', sentence4Elements: ['C', 'wie', 'der', 'Computer.'] },
      { id: 'it_alp_d', german: 'D - wie Drachen', arabic: 'حرف D - مثل طائرة ورقية / تنين', emoji: '🪁', exampleSentenceGerman: 'D steht für Drachen.', exampleSentenceArabic: 'D يرمز للطائرة الورقية.', missingLetterWord: 'D - wie Dr_chen', sentence4Elements: ['D', 'wie', 'der', 'Drachen.'] },
      { id: 'it_alp_e', german: 'E - wie Elefant', arabic: 'حرف E - مثل فيل', emoji: '🐘', exampleSentenceGerman: 'E steht für Elefant.', exampleSentenceArabic: 'E يرمز للفيل.', missingLetterWord: 'E - wie El_fant', sentence4Elements: ['E', 'wie', 'der', 'Elefant.'] },
      { id: 'it_alp_f', german: 'F - wie Fisch', arabic: 'حرف F - مثل سمكة', emoji: '🐟', exampleSentenceGerman: 'F steht für Fisch.', exampleSentenceArabic: 'F يرمز للسمكة.', missingLetterWord: 'F - wie F_sch', sentence4Elements: ['F', 'wie', 'der', 'Fisch.'] },
      { id: 'it_alp_g', german: 'G - wie Giraffe', arabic: 'حرف G - مثل زرافة', emoji: '🦒', exampleSentenceGerman: 'G steht für Giraffe.', exampleSentenceArabic: 'G يرمز للزرافة.', missingLetterWord: 'G - wie Gir_ffe', sentence4Elements: ['G', 'wie', 'die', 'Giraffe.'] },
      { id: 'it_alp_h', german: 'H - wie Haus', arabic: 'حرف H - مثل منزل', emoji: '🏠', exampleSentenceGerman: 'H steht für Haus.', exampleSentenceArabic: 'H يرمز للمنزل.', missingLetterWord: 'H - wie H_us', sentence4Elements: ['H', 'wie', 'das', 'Haus.'] },
      { id: 'it_alp_i', german: 'I - wie Igel', arabic: 'حرف I - مثل قنفذ', emoji: '🦔', exampleSentenceGerman: 'I steht für Igel.', exampleSentenceArabic: 'I يرمز للقنفذ.', missingLetterWord: 'I - wie I_el', sentence4Elements: ['I', 'wie', 'der', 'Igel.'] },
      { id: 'it_alp_j', german: 'J - wie Jacke', arabic: 'حرف J - مثل جاكيت', emoji: '🧥', exampleSentenceGerman: 'J steht für Jacke.', exampleSentenceArabic: 'J يرمز للجاكيت.', missingLetterWord: 'J - wie J_cke', sentence4Elements: ['J', 'wie', 'die', 'Jacke.'] },
      { id: 'it_alp_k', german: 'K - wie Katze', arabic: 'حرف K - مثل قطة', emoji: '🐱', exampleSentenceGerman: 'K steht für Katze.', exampleSentenceArabic: 'K يرمز للقطة.', missingLetterWord: 'K - wie K_tze', sentence4Elements: ['K', 'wie', 'die', 'Katze.'] },
      { id: 'it_alp_l', german: 'L - wie Löwe', arabic: 'حرف L - مثل أسد', emoji: '🦁', exampleSentenceGerman: 'L steht für Löwe.', exampleSentenceArabic: 'L يرمز للأسد.', missingLetterWord: 'L - wie L_we', sentence4Elements: ['L', 'wie', 'der', 'Löwe.'] },
      { id: 'it_alp_m', german: 'M - wie Maus', arabic: 'حرف M - مثل فأر', emoji: '🐭', exampleSentenceGerman: 'M steht für Maus.', exampleSentenceArabic: 'M يرمز للفأر.', missingLetterWord: 'M - wie M_us', sentence4Elements: ['M', 'wie', 'die', 'Maus.'] },
      { id: 'it_alp_n', german: 'N - wie Nase', arabic: 'حرف N - مثل أنف', emoji: '👃', exampleSentenceGerman: 'N steht für Nase.', exampleSentenceArabic: 'N يرمز للأنف.', missingLetterWord: 'N - wie N_se', sentence4Elements: ['N', 'wie', 'die', 'Nase.'] },
      { id: 'it_alp_o', german: 'O - wie Orange', arabic: 'حرف O - مثل برتقالة', emoji: '🍊', exampleSentenceGerman: 'O steht für Orange.', exampleSentenceArabic: 'O يرمز للبرتقالة.', missingLetterWord: 'O - wie Or_nge', sentence4Elements: ['O', 'wie', 'die', 'Orange.'] },
      { id: 'it_alp_p', german: 'P - wie Pinguin', arabic: 'حرف P - مثل بطريق', emoji: '🐧', exampleSentenceGerman: 'P steht für Pinguin.', exampleSentenceArabic: 'P يرمز للبطريق.', missingLetterWord: 'P - wie Ping_in', sentence4Elements: ['P', 'wie', 'der', 'Pinguin.'] },
      { id: 'it_alp_q', german: 'Q - wie Qualle', arabic: 'حرف Q - مثل قنديل البحر', emoji: '🪼', exampleSentenceGerman: 'Q steht für Qualle.', exampleSentenceArabic: 'Q يرمز لقنديل البحر.', missingLetterWord: 'Q - wie Qu_lle', sentence4Elements: ['Q', 'wie', 'die', 'Qualle.'] },
      { id: 'it_alp_r', german: 'R - wie Regenschirm', arabic: 'حرف R - مثل مظلة', emoji: '☂️', exampleSentenceGerman: 'R steht für Regenschirm.', exampleSentenceArabic: 'R يرمز للمظلة.', missingLetterWord: 'R - wie Regensch_rm', sentence4Elements: ['R', 'wie', 'der', 'Regenschirm.'] },
      { id: 'it_alp_s', german: 'S - wie Sonne', arabic: 'حرف S - مثل شمس', emoji: '☀️', exampleSentenceGerman: 'S steht für Sonne.', exampleSentenceArabic: 'S يرمز للشمس.', missingLetterWord: 'S - wie S_nne', sentence4Elements: ['S', 'wie', 'die', 'Sonne.'] },
      { id: 'it_alp_t', german: 'T - wie Tiger', arabic: 'حرف T - مثل نمر', emoji: '🐅', exampleSentenceGerman: 'T steht für Tiger.', exampleSentenceArabic: 'T يرمز للنمر.', missingLetterWord: 'T - wie T_ger', sentence4Elements: ['T', 'wie', 'der', 'Tiger.'] },
      { id: 'it_alp_u', german: 'U - wie Uhr', arabic: 'حرف U - مثل ساعة', emoji: '⏰', exampleSentenceGerman: 'U steht für Uhr.', exampleSentenceArabic: 'U يرمز للساعة.', missingLetterWord: 'U - wie U_r', sentence4Elements: ['U', 'wie', 'die', 'Uhr.'] },
      { id: 'it_alp_v', german: 'V - wie Vogel', arabic: 'حرف V - مثل طائر', emoji: '🐦', exampleSentenceGerman: 'V steht für Vogel.', exampleSentenceArabic: 'V يرمز للطائر.', missingLetterWord: 'V - wie V_gel', sentence4Elements: ['V', 'wie', 'der', 'Vogel.'] },
      { id: 'it_alp_w', german: 'W - wie Wasser', arabic: 'حرف W - مثل ماء', emoji: '💧', exampleSentenceGerman: 'W steht für Wasser.', exampleSentenceArabic: 'W يرمز للماء.', missingLetterWord: 'W - wie W_sser', sentence4Elements: ['W', 'wie', 'das', 'Wasser.'] },
      { id: 'it_alp_x', german: 'X - wie Xylophon', arabic: 'حرف X - مثل زيلوفون', emoji: '🎼', exampleSentenceGerman: 'X steht für Xylophon.', exampleSentenceArabic: 'X يرمز للزيلوفون.', missingLetterWord: 'X - wie Xyl_phon', sentence4Elements: ['X', 'wie', 'das', 'Xylophon.'] },
      { id: 'it_alp_y', german: 'Y - wie Yachthafen', arabic: 'حرف Y - مثل مرسى اليخوت', emoji: '⛵', exampleSentenceGerman: 'Y steht für Yacht.', exampleSentenceArabic: 'Y يرمز لليخت.', missingLetterWord: 'Y - wie Y_cht', sentence4Elements: ['Y', 'wie', 'die', 'Yacht.'] },
      { id: 'it_alp_z', german: 'Z - wie Zebra', arabic: 'حرف Z - مثل حمار وحشي', emoji: '🦓', exampleSentenceGerman: 'Z steht für Zebra.', exampleSentenceArabic: 'Z يرمز للحمار الوحشي.', missingLetterWord: 'Z - wie Z_bra', sentence4Elements: ['Z', 'wie', 'das', 'Zebra.'] }
    ]
  },
  {
    id: 'set_def_04_zahlen_1_20',
    title: 'Zahlen von 1 bis 20',
    topic: 'الأرقام من 1 إلى 20',
    grade: 'المستوى الأول: الكلمات الأساسية',
    level: 'A1',
    difficulty: 'easy',
    description: 'الأرقام الألمانية من 1 إلى 20 للأطفال.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'num_1', german: 'eins', arabic: 'واحد (1)', emoji: '1️⃣', exampleSentenceGerman: 'Ich habe einen Ball.', exampleSentenceArabic: 'عندي كرة واحدة.', missingLetterWord: 'e_ns', sentence4Elements: ['Ich', 'zähle', 'bis', 'eins.'] },
      { id: 'num_2', german: 'zwei', arabic: 'اثنان (2)', emoji: '2️⃣', exampleSentenceGerman: 'Zwei kleine Katzen.', exampleSentenceArabic: 'قطتان صغيرتان.', missingLetterWord: 'zw_i', sentence4Elements: ['Das', 'sind', 'zwei', 'Äpfel.'] },
      { id: 'num_3', german: 'drei', arabic: 'ثلاثة (3)', emoji: '3️⃣', exampleSentenceGerman: 'Drei rote Blumen.', exampleSentenceArabic: 'ثلاث أزهار حمراء.', missingLetterWord: 'dr_i', sentence4Elements: ['Hier', 'sind', 'drei', 'Autos.'] },
      { id: 'num_4', german: 'vier', arabic: 'أربعة (4)', emoji: '4️⃣', exampleSentenceGerman: 'Vier Beine hat der Tisch.', exampleSentenceArabic: 'للطاولة أربعة أرجل.', missingLetterWord: 'v_er', sentence4Elements: ['Wir', 'haben', 'vier', 'Bücher.'] },
      { id: 'num_5', german: 'fünf', arabic: 'خمسة (5)', emoji: '5️⃣', exampleSentenceGerman: 'Fünf Finger an einer Hand.', exampleSentenceArabic: 'خمسة أصابع في يد واحدة.', missingLetterWord: 'f_nf', sentence4Elements: ['Fünf', 'Kinder', 'spielen', 'zusammen.'] },
      { id: 'num_6', german: 'sechs', arabic: 'ستة (6)', emoji: '6️⃣', exampleSentenceGerman: 'Sechs Stifte im Etui.', exampleSentenceArabic: 'ستة أقلام في المقلمة.', missingLetterWord: 's_chs', sentence4Elements: ['Ich', 'sehe', 'sechs', 'Vögel.'] },
      { id: 'num_7', german: 'sieben', arabic: 'سبعة (7)', emoji: '7️⃣', exampleSentenceGerman: 'Sieben Tage hat die Woche.', exampleSentenceArabic: 'في الأسبوع سبعة أيام.', missingLetterWord: 'si_ben', sentence4Elements: ['Sieben', 'Tage', 'hat', 'Woche.'] },
      { id: 'num_8', german: 'acht', arabic: 'ثمانية (8)', emoji: '8️⃣', exampleSentenceGerman: 'Acht Beine hat die Spinne.', exampleSentenceArabic: 'للعنكبوت ثمانية أرجل.', missingLetterWord: 'a_ht', sentence4Elements: ['Der', 'Oktopus', 'hat', 'acht.'] },
      { id: 'num_9', german: 'neun', arabic: 'تسعة (9)', emoji: '9️⃣', exampleSentenceGerman: 'Neun Bälle auf der Wiese.', exampleSentenceArabic: 'تسع كرات على العشب.', missingLetterWord: 'n_un', sentence4Elements: ['Neun', 'Sterne', 'am', 'Himmel.'] },
      { id: 'num_10', german: 'zehn', arabic: 'عشرة (10)', emoji: '🔟', exampleSentenceGerman: 'Zehn Finger haben wir.', exampleSentenceArabic: 'لدينا عشرة أصابع.', missingLetterWord: 'z_hn', sentence4Elements: ['Zehn', 'Kinder', 'im', 'Kreis.'] },
      { id: 'num_11', german: 'elf', arabic: 'أحد عشر (11)', emoji: '1️⃣1️⃣', exampleSentenceGerman: 'Elf Spieler auf dem Platz.', exampleSentenceArabic: 'أحد عشر لاعباً في الملعب.', missingLetterWord: 'e_f', sentence4Elements: ['Elf', 'Spieler', 'im', 'Team.'] },
      { id: 'num_12', german: 'zwölf', arabic: 'اثنا عشر (12)', emoji: '1️⃣2️⃣', exampleSentenceGerman: 'Zwölf Monate hat das Jahr.', exampleSentenceArabic: 'في السنة اثنا عشر شهراً.', missingLetterWord: 'zw_lf', sentence4Elements: ['Zwölf', 'Monate', 'ein', 'Jahr.'] },
      { id: 'num_13', german: 'dreizehn', arabic: 'ثلاثة عشر (13)', emoji: '1️⃣3️⃣', exampleSentenceGerman: 'Dreizehn rote Punkte.', exampleSentenceArabic: 'ثلاث عشرة نقطة حمراء.', missingLetterWord: 'dreiz_hn', sentence4Elements: ['Ich', 'zähle', 'dreizehn', 'Sterne.'] },
      { id: 'num_14', german: 'vierzehn', arabic: 'أربعة عشر (14)', emoji: '1️⃣4️⃣', exampleSentenceGerman: 'Vierzehn Bausteine.', exampleSentenceArabic: 'أربعة عشر مكعب بناء.', missingLetterWord: 'vierz_hn', sentence4Elements: ['Hier', 'sind', 'vierzehn', 'Karten.'] },
      { id: 'num_15', german: 'fünfzehn', arabic: 'خمسة عشر (15)', emoji: '1️⃣5️⃣', exampleSentenceGerman: 'Fünfzehn Minuten Pause.', exampleSentenceArabic: 'خمس عشرة دقيقة استراحة.', missingLetterWord: 'fünfz_hn', sentence4Elements: ['Fünfzehn', 'Minuten', 'für', 'Pause.'] },
      { id: 'num_16', german: 'sechzehn', arabic: 'ستة عشر (16)', emoji: '1️⃣6️⃣', exampleSentenceGerman: 'Sechzehn Kerzen auf dem Kuchen.', exampleSentenceArabic: 'ست عشرة شمعة على الكعكة.', missingLetterWord: 'sechz_hn', sentence4Elements: ['Sechzehn', 'Kerzen', 'brennen', 'hell.'] },
      { id: 'num_17', german: 'siebzehn', arabic: 'سبعة عشر (17)', emoji: '1️⃣7️⃣', exampleSentenceGerman: 'Siebzehn Buntstifte.', exampleSentenceArabic: 'سبعة عشر قلم تلوين.', missingLetterWord: 'siebz_hn', sentence4Elements: ['Siebzehn', 'Stifte', 'im', 'Malkasten.'] },
      { id: 'num_18', german: 'achtzehn', arabic: 'ثمانية عشر (18)', emoji: '1️⃣8️⃣', exampleSentenceGerman: 'Achtzehn Schmetterlinge.', exampleSentenceArabic: 'ثماني عشرة فراشة.', missingLetterWord: 'achtz_hn', sentence4Elements: ['Achtzehn', 'Vögel', 'fliegen', 'hoch.'] },
      { id: 'num_19', german: 'neunzehn', arabic: 'تسعة عشر (19)', emoji: '1️⃣9️⃣', exampleSentenceGerman: 'Neunzehn kleine Enten.', exampleSentenceArabic: 'تسع عشرة بطة صغيرة.', missingLetterWord: 'neunz_hn', sentence4Elements: ['Neunzehn', 'Enten', 'im', 'Teich.'] },
      { id: 'num_20', german: 'zwanzig', arabic: 'عشرون (20)', emoji: '2️⃣0️⃣', exampleSentenceGerman: 'Zwanzig Punkte geschafft!', exampleSentenceArabic: 'أنجزنا عشرين نقطة!', missingLetterWord: 'zwanz_g', sentence4Elements: ['Zwanzig', 'Punkte', 'super', 'gemacht!'] }
    ]
  },
  {
    id: 'set_def_05_farben',
    title: 'Farben',
    topic: 'الألوان',
    grade: 'المستوى الأول: الكلمات الأساسية',
    level: 'A1',
    difficulty: 'easy',
    description: 'تعلم الألوان الأساسية باللغة الألمانية.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'col_1', german: 'rot', arabic: 'أحمر', emoji: '🔴', exampleSentenceGerman: 'Der Apfel ist rot.', exampleSentenceArabic: 'التفاحة حمراء.', missingLetterWord: 'r_t', sentence4Elements: ['Der', 'Apfel', 'ist', 'rot.'] },
      { id: 'col_2', german: 'blau', arabic: 'أزرق', emoji: '🔵', exampleSentenceGerman: 'Der Himmel ist blau.', exampleSentenceArabic: 'السماء زرقاء.', missingLetterWord: 'bl_u', sentence4Elements: ['Der', 'Himmel', 'ist', 'blau.'] },
      { id: 'col_3', german: 'grün', arabic: 'أخضر', emoji: '🟢', exampleSentenceGerman: 'Das Gras ist grün.', exampleSentenceArabic: 'العشب أخضر.', missingLetterWord: 'gr_n', sentence4Elements: ['Das', 'Gras', 'ist', 'grün.'] },
      { id: 'col_4', german: 'gelb', arabic: 'أصفر', emoji: '🟡', exampleSentenceGerman: 'Die Sonne ist gelb.', exampleSentenceArabic: 'الشمس صفراء.', missingLetterWord: 'g_lb', sentence4Elements: ['Die', 'Sonne', 'ist', 'gelb.'] },
      { id: 'col_5', german: 'schwarz', arabic: 'أسود', emoji: '🖤', exampleSentenceGerman: 'Die Katze ist schwarz.', exampleSentenceArabic: 'القطة سوداء.', missingLetterWord: 'schw_rz', sentence4Elements: ['Die', 'Katze', 'ist', 'schwarz.'] },
      { id: 'col_6', german: 'weiß', arabic: 'أبيض', emoji: '⚪', exampleSentenceGerman: 'Der Schnee ist weiß.', exampleSentenceArabic: 'الثلج أبيض.', missingLetterWord: 'we_ß', sentence4Elements: ['Der', 'Schnee', 'ist', 'weiß.'] },
      { id: 'col_7', german: 'rosa', arabic: 'وردي', emoji: '🩷', exampleSentenceGerman: 'Die Blume ist rosa.', exampleSentenceArabic: 'الزهرة وردية.', missingLetterWord: 'r_sa', sentence4Elements: ['Die', 'Blume', 'ist', 'rosa.'] },
      { id: 'col_8', german: 'lila', arabic: 'بنفسجي', emoji: '💜', exampleSentenceGerman: 'Das Kleid ist lila.', exampleSentenceArabic: 'الفستان بنفسجي.', missingLetterWord: 'l_la', sentence4Elements: ['Das', 'Kleid', 'ist', 'lila.'] },
      { id: 'col_9', german: 'braun', arabic: 'بني', emoji: '🤎', exampleSentenceGerman: 'Der Bär ist braun.', exampleSentenceArabic: 'الدب بني.', missingLetterWord: 'br_un', sentence4Elements: ['Der', 'Bär', 'ist', 'braun.'] },
      { id: 'col_10', german: 'grau', arabic: 'رمادي', emoji: '🩶', exampleSentenceGerman: 'Der Elefant ist grau.', exampleSentenceArabic: 'الفيل رمادي.', missingLetterWord: 'gr_u', sentence4Elements: ['Der', 'Elefant', 'ist', 'grau.'] }
    ]
  },
  {
    id: 'set_def_06_formen',
    title: 'Formen',
    topic: 'الأشكال الهندسية',
    grade: 'المستوى الأول: الكلمات الأساسية',
    level: 'A1',
    difficulty: 'easy',
    description: 'الأشكال الهندسية الأساسية للأطفال بالألمانية.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'shp_1', german: 'der Kreis', arabic: 'الدائرة', plural: 'die Kreise', emoji: '⭕', exampleSentenceGerman: 'Der Ball ist ein Kreis.', exampleSentenceArabic: 'الكرة عبارة عن دائرة.', missingLetterWord: 'Kr_is', sentence4Elements: ['Der', 'Ball', 'ist', 'rund.'] },
      { id: 'shp_2', german: 'das Quadrat', arabic: 'المربع', plural: 'die Quadrate', emoji: '⬛', exampleSentenceGerman: 'Das Fenster ist ein Quadrat.', exampleSentenceArabic: 'النافذة مربع.', missingLetterWord: 'Quadr_t', sentence4Elements: ['Das', 'Fenster', 'ist', 'ein Quadrat.'] },
      { id: 'shp_3', german: 'das Dreieck', arabic: 'المثلث', plural: 'die Dreiecke', emoji: '🔺', exampleSentenceGerman: 'Das Pizza-Stück ist ein Dreieck.', exampleSentenceArabic: 'قطعة البيتزا مثلث.', missingLetterWord: 'Drei_ck', sentence4Elements: ['Das', 'Dreieck', 'hat', 'drei Ecken.'] },
      { id: 'shp_4', german: 'das Rechteck', arabic: 'المستطيل', plural: 'die Rechtecke', emoji: '▭', exampleSentenceGerman: 'Die Tür ist ein Rechteck.', exampleSentenceArabic: 'الباب مستطيل.', missingLetterWord: 'Recht_ck', sentence4Elements: ['Die', 'Tür', 'ist', 'ein Rechteck.'] },
      { id: 'shp_5', german: 'der Stern', arabic: 'النجمة', plural: 'die Sterne', emoji: '⭐', exampleSentenceGerman: 'Der Stern leuchtet gelb.', exampleSentenceArabic: 'النجمة تضيء بالأصفر.', missingLetterWord: 'St_rn', sentence4Elements: ['Der', 'Stern', 'leuchtet', 'am Himmel.'] },
      { id: 'shp_6', german: 'das Herz', arabic: 'القلب', plural: 'die Herzen', emoji: '❤️', exampleSentenceGerman: 'Das Herz ist rot.', exampleSentenceArabic: 'القلب أحمر.', missingLetterWord: 'H_rz', sentence4Elements: ['Das', 'Herz', 'ist', 'sehr rot.'] },
      { id: 'shp_7', german: 'das Oval', arabic: 'الشكل البيضاوي', plural: 'die Ovale', emoji: '🥚', exampleSentenceGerman: 'Das Ei ist oval.', exampleSentenceArabic: 'البيضة بيضاوية الشكل.', missingLetterWord: 'Ov_l', sentence4Elements: ['Das', 'Ei', 'ist', 'ein Oval.'] },
      { id: 'shp_8', german: 'die Kugel', arabic: 'الكرة الهندسية', plural: 'die Kugeln', emoji: '🔮', exampleSentenceGerman: 'Die Kugel rollt.', exampleSentenceArabic: 'الكرة تتدحرج.', missingLetterWord: 'Kug_l', sentence4Elements: ['Die', 'Kugel', 'rollt', 'schnell.'] },
      { id: 'shp_9', german: 'der Würfel', arabic: 'المكعب', plural: 'die Würfel', emoji: '🎲', exampleSentenceGerman: 'Der Würfel hat sechs Seiten.', exampleSentenceArabic: 'للمكعب ستة أوجه.', missingLetterWord: 'W_rfel', sentence4Elements: ['Der', 'Würfel', 'ist', 'ein Spielzeug.'] },
      { id: 'shp_10', german: 'die Pyramide', arabic: 'الهرم', plural: 'die Pyramiden', emoji: '🛕', exampleSentenceGerman: 'Die Pyramide steht in Ägypten.', exampleSentenceArabic: 'الهرم يقع في مصر.', missingLetterWord: 'Pyram_de', sentence4Elements: ['Die', 'Pyramide', 'ist', 'sehr alt.'] }
    ]
  },
  {
    id: 'set_def_07_gefuehle',
    title: 'Gefühle und Emotionen',
    topic: 'المشاعر والعواطف',
    grade: 'المستوى الأول: الكلمات الأساسية',
    level: 'A1',
    difficulty: 'easy',
    description: 'مفردات التعبير عن العواطف والمشاعر للأطفال.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'emo_1', german: 'glücklich', arabic: 'سعيد', emoji: '😊', exampleSentenceGerman: 'Ich bin heute glücklich.', exampleSentenceArabic: 'أنا سعيد اليوم.', missingLetterWord: 'gl_cklich', sentence4Elements: ['Ich', 'bin', 'heute', 'glücklich.'] },
      { id: 'emo_2', german: 'traurig', arabic: 'حزين', emoji: '😢', exampleSentenceGerman: 'Das Kind ist traurig.', exampleSentenceArabic: 'الطفل حزين.', missingLetterWord: 'tra_rig', sentence4Elements: ['Das', 'Kind', 'ist', 'traurig.'] },
      { id: 'emo_3', german: 'müde', arabic: 'متعب / نعسان', emoji: '😴', exampleSentenceGerman: 'Ich bin sehr müde.', exampleSentenceArabic: 'أنا متعب جداً.', missingLetterWord: 'm_de', sentence4Elements: ['Ich', 'bin', 'sehr', 'müde.'] },
      { id: 'emo_4', german: 'wütend', arabic: 'غاضب', emoji: '😡', exampleSentenceGerman: 'Der Mann ist wütend.', exampleSentenceArabic: 'الرجل غاضب.', missingLetterWord: 'w_tend', sentence4Elements: ['Der', 'Mann', 'ist', 'wütend.'] },
      { id: 'emo_5', german: 'ängstlich', arabic: 'خائف', emoji: '😨', exampleSentenceGerman: 'Hase ist ängstlich.', exampleSentenceArabic: 'الأرنب خائف.', missingLetterWord: '_ngstlich', sentence4Elements: ['Der', 'Hase', 'ist', 'ängstlich.'] },
      { id: 'emo_6', german: 'überrascht', arabic: 'متفاجئ', emoji: '😮', exampleSentenceGerman: 'Emma ist überrascht.', exampleSentenceArabic: 'إيما تفاجأت.', missingLetterWord: 'überr_scht', sentence4Elements: ['Emma', 'ist', 'sehr', 'überrascht.'] },
      { id: 'emo_7', german: 'stolz', arabic: 'فخور', emoji: '🦁', exampleSentenceGerman: 'Papa ist stolz.', exampleSentenceArabic: 'أبي فخور.', missingLetterWord: 'st_lz', sentence4Elements: ['Papa', 'ist', 'sehr', 'stolz.'] },
      { id: 'emo_8', german: 'krank', arabic: 'مريض', emoji: '🤒', exampleSentenceGerman: 'Ben ist krank.', exampleSentenceArabic: 'بين مريض.', missingLetterWord: 'kr_nk', sentence4Elements: ['Ben', 'ist', 'heute', 'krank.'] },
      { id: 'emo_9', german: 'ruhig', arabic: 'هادئ', emoji: '😌', exampleSentenceGerman: 'Das Baby ist ruhig.', exampleSentenceArabic: 'الطفل الرضيع هادئ.', missingLetterWord: 'r_hig', sentence4Elements: ['Das', 'Baby', 'ist', 'ruhig.'] },
      { id: 'emo_10', german: 'begeistert', arabic: 'متحمس', emoji: '🤩', exampleSentenceGerman: 'Wir sind begeistert!', exampleSentenceArabic: 'نحن متحمسون!', missingLetterWord: 'beg_istert', sentence4Elements: ['Wir', 'sind', 'alle', 'begeistert!'] }
    ]
  },

  // ==================== المستوى الثاني: الطفل والبيت ====================
  {
    id: 'set_def_08_familie',
    title: 'Meine Familie',
    topic: 'عائلتي وأقربائي',
    grade: 'المستوى الثاني: الطفل والبيت',
    level: 'A1',
    difficulty: 'easy',
    description: 'أفراد العائلة الألمانية وتسميات الأقارب للأطفال.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'fam_1', german: 'die Mutter', arabic: 'الأم', plural: 'die Mütter', emoji: '👩', exampleSentenceGerman: 'Das ist meine Mutter.', exampleSentenceArabic: 'هذه أمي.', missingLetterWord: 'die M_tter', sentence4Elements: ['Das', 'ist', 'meine', 'Mutter.'] },
      { id: 'fam_2', german: 'der Vater', arabic: 'الأب', plural: 'die Väter', emoji: '👨', exampleSentenceGerman: 'Mein Vater liest ein Buch.', exampleSentenceArabic: 'أبي يقرأ كتاباً.', missingLetterWord: 'der V_ter', sentence4Elements: ['Mein', 'Vater', 'liest', 'Buch.'] },
      { id: 'fam_3', german: 'die Eltern', arabic: 'الوالدان', emoji: '👨‍👩‍👧', exampleSentenceGerman: 'Meine Eltern sind lieb.', exampleSentenceArabic: 'والداي لطيفان.', missingLetterWord: 'die E_tern', sentence4Elements: ['Meine', 'Eltern', 'sind', 'lieb.'] },
      { id: 'fam_4', german: 'die Schwester', arabic: 'الأخت', plural: 'die Schwestern', emoji: '👧', exampleSentenceGerman: 'Meine Schwester spielt.', exampleSentenceArabic: 'أختي تلعب.', missingLetterWord: 'die Schw_ster', sentence4Elements: ['Meine', 'Schwester', 'spielt', 'gern.'] },
      { id: 'fam_5', german: 'der Bruder', arabic: 'الأخ', plural: 'die Brüder', emoji: '👦', exampleSentenceGerman: 'Mein Bruder lacht.', exampleSentenceArabic: 'أخي يضحك.', missingLetterWord: 'der Br_der', sentence4Elements: ['Mein', 'Bruder', 'lacht', 'laut.'] },
      { id: 'fam_6', german: 'die Oma', arabic: 'الجدة', plural: 'die Omas', emoji: '👵', exampleSentenceGerman: 'Oma kocht Suppe.', exampleSentenceArabic: 'جدتي تطبخ حساءً.', missingLetterWord: 'die O_a', sentence4Elements: ['Oma', 'kocht', 'leckere', 'Suppe.'] },
      { id: 'fam_7', german: 'der Opa', arabic: 'الجد', plural: 'die Opas', emoji: '👴', exampleSentenceGerman: 'Opa erzählt eine Geschichte.', exampleSentenceArabic: 'جدي يحكي قصة.', missingLetterWord: 'der O_a', sentence4Elements: ['Opa', 'erzählt', 'eine', 'Geschichte.'] },
      { id: 'fam_8', german: 'das Baby', arabic: 'الطفل الرضيع', plural: 'die Babys', emoji: '👶', exampleSentenceGerman: 'Das Baby schläft.', exampleSentenceArabic: 'الطفل الرضيع ينام.', missingLetterWord: 'das B_by', sentence4Elements: ['Das', 'Baby', 'schläft', 'sanft.'] },
      { id: 'fam_9', german: 'die Tante', arabic: 'العمة / الخالة', plural: 'die Tanten', emoji: '👩‍🦰', exampleSentenceGerman: 'Tante Anna besucht uns.', exampleSentenceArabic: 'العمة أنا تزورنا.', missingLetterWord: 'die T_nte', sentence4Elements: ['Tante', 'Anna', 'besucht', 'uns.'] },
      { id: 'fam_10', german: 'der Onkel', arabic: 'العم / الخال', plural: 'die Onkel', emoji: '👨‍🦰', exampleSentenceGerman: 'Mein Onkel bringt ein Geschenk.', exampleSentenceArabic: 'عمي يجلب هدية.', missingLetterWord: 'der O_kel', sentence4Elements: ['Mein', 'Onkel', 'bringt', 'Geschenk.'] }
    ]
  },
  {
    id: 'set_def_09_koerper',
    title: 'Mein Körper',
    topic: 'جسمي وأعضائي',
    grade: 'المستوى الثاني: الطفل والبيت',
    level: 'A1',
    difficulty: 'easy',
    description: 'أجزاء الجسم البشري بالألمانية للأطفال.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'korp_1', german: 'der Kopf', arabic: 'الرأس', plural: 'die Köpfe', emoji: '🗣️', exampleSentenceGerman: 'Mein Kopf tut nicht weh.', exampleSentenceArabic: 'رأسي لا يؤلمني.', missingLetterWord: 'der K_pf', sentence4Elements: ['Der', 'Kopf', 'ist', 'oben.'] },
      { id: 'korp_2', german: 'die Haare', arabic: 'الشعر', emoji: '💇', exampleSentenceGerman: 'Deine Haare sind braun.', exampleSentenceArabic: 'شعرك بني.', missingLetterWord: 'die H_are', sentence4Elements: ['Deine', 'Haare', 'sind', 'schön.'] },
      { id: 'korp_3', german: 'das Auge', arabic: 'العين', plural: 'die Augen', emoji: '👁️', exampleSentenceGerman: 'Ich habe zwei Augen.', exampleSentenceArabic: 'لدي عينان.', missingLetterWord: 'das A_ge', sentence4Elements: ['Ich', 'habe', 'zwei', 'Augen.'] },
      { id: 'korp_4', german: 'das Ohr', arabic: 'الأذن', plural: 'die Ohren', emoji: '👂', exampleSentenceGerman: 'Wir hören mit dem Ohr.', exampleSentenceArabic: 'نحن نسمع بالأذن.', missingLetterWord: 'das O_r', sentence4Elements: ['Wir', 'hören', 'mit', 'Ohren.'] },
      { id: 'korp_5', german: 'die Nase', arabic: 'الأنف', plural: 'die Nasen', emoji: '👃', exampleSentenceGerman: 'Rieche mit der Nase!', exampleSentenceArabic: 'شم بالأنف!', missingLetterWord: 'die N_se', sentence4Elements: ['Rieche', 'mit', 'deiner', 'Nase!'] },
      { id: 'korp_6', german: 'der Mund', arabic: 'الفم', plural: 'die Münder', emoji: '👄', exampleSentenceGerman: 'Öffne deinen Mund!', exampleSentenceArabic: 'افتح فمك!', missingLetterWord: 'der M_nd', sentence4Elements: ['Öffne', 'deinen', 'Mund', 'jetzt!'] },
      { id: 'korp_7', german: 'die Hand', arabic: 'اليد', plural: 'die Hände', emoji: '✋', exampleSentenceGerman: 'Wasche deine Hände!', exampleSentenceArabic: 'اغسل يديك!', missingLetterWord: 'die H_nd', sentence4Elements: ['Wasche', 'deine', 'Hände', 'sauber!'] },
      { id: 'korp_8', german: 'der Fuß', arabic: 'القدم', plural: 'die Füße', emoji: '🦶', exampleSentenceGerman: 'Mein Fuß ist klein.', exampleSentenceArabic: 'قدمي صغيرة.', missingLetterWord: 'der F_ß', sentence4Elements: ['Mein', 'Fuß', 'ist', 'klein.'] },
      { id: 'korp_9', german: 'der Bauch', arabic: 'البطن', plural: 'die Bäuche', emoji: '🫃', exampleSentenceGerman: 'Mein Bauch ist voll.', exampleSentenceArabic: 'بطني ممتلئ.', missingLetterWord: 'der B_uch', sentence4Elements: ['Mein', 'Bauch', 'ist', 'voll.'] },
      { id: 'korp_10', german: 'der Arm', arabic: 'الذراع', plural: 'die Arme', emoji: '🦾', exampleSentenceGerman: 'Ich hebe meinen Arm.', exampleSentenceArabic: 'أنا أرفع ذراعي.', missingLetterWord: 'der A_m', sentence4Elements: ['Ich', 'hebe', 'meinen', 'Arm.'] }
    ]
  },

  // ==================== المستوى الثالث: الطعام والحيوانات ====================
  {
    id: 'set_def_10_obst',
    title: 'Obst',
    topic: 'الفواكه',
    grade: 'المستوى الثالث: الطعام والحيوانات',
    level: 'A1',
    difficulty: 'easy',
    description: 'أسماء الفواكه الألمانية للأطفال.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'obst_1', german: 'der Apfel', arabic: 'التفاح', plural: 'die Äpfel', emoji: '🍎', exampleSentenceGerman: 'Der Apfel ist süß.', exampleSentenceArabic: 'التفاحة حلوة.', missingLetterWord: 'der A_fel', sentence4Elements: ['Der', 'Apfel', 'ist', 'süß.'] },
      { id: 'obst_2', german: 'die Banane', arabic: 'الموز', plural: 'die Bananen', emoji: '🍌', exampleSentenceGerman: 'Die Banane ist gelb.', exampleSentenceArabic: 'الموزة صفراء.', missingLetterWord: 'die Ban_ne', sentence4Elements: ['Die', 'Banane', 'ist', 'gelb.'] },
      { id: 'obst_3', german: 'die Orange', arabic: 'البرتقال', plural: 'die Orangen', emoji: '🍊', exampleSentenceGerman: 'Ich mag Orangen.', exampleSentenceArabic: 'أنا أحب البرتقال.', missingLetterWord: 'die Or_nge', sentence4Elements: ['Ich', 'mag', 'saftige', 'Orangen.'] },
      { id: 'obst_4', german: 'die Erdbeere', arabic: 'الفراولة', plural: 'die Erdbeeren', emoji: '🍓', exampleSentenceGerman: 'Die Erdbeere ist rot.', exampleSentenceArabic: 'الفراولة حمراء.', missingLetterWord: 'die Erdb_ere', sentence4Elements: ['Die', 'Erdbeere', 'schmeckt', 'gut.'] },
      { id: 'obst_5', german: 'die Traube', arabic: 'العنب', plural: 'die Trauben', emoji: '🍇', exampleSentenceGerman: 'Trauben sind lecker.', exampleSentenceArabic: 'العنب لديد.', missingLetterWord: 'die Tr_ube', sentence4Elements: ['Trauben', 'sind', 'sehr', 'lecker.'] },
      { id: 'obst_6', german: 'die Zitrone', arabic: 'الليمون', plural: 'die Zitronen', emoji: '🍋', exampleSentenceGerman: 'Die Zitrone ist sauer.', exampleSentenceArabic: 'الليمونة حامضة.', missingLetterWord: 'die Zitr_ne', sentence4Elements: ['Die', 'Zitrone', 'ist', 'sauer.'] },
      { id: 'obst_7', german: 'die Wassermelone', arabic: 'البطيخ الأحادي', plural: 'die Wassermelonen', emoji: '🍉', exampleSentenceGerman: 'Die Wassermelone ist groß.', exampleSentenceArabic: 'البطيخة كبيرة.', missingLetterWord: 'die Wassermel_ne', sentence4Elements: ['Die', 'Wassermelone', 'ist', 'groß.'] },
      { id: 'obst_8', german: 'die Birne', arabic: 'الكمثرى / الإجاص', plural: 'die Birnen', emoji: '🍐', exampleSentenceGerman: 'Die Birne ist grün.', exampleSentenceArabic: 'الكمثرى خضراء.', missingLetterWord: 'die B_rne', sentence4Elements: ['Die', 'Birne', 'ist', 'saftig.'] },
      { id: 'obst_9', german: 'die Ananas', arabic: 'الأناناس', plural: 'die Ananas', emoji: '🍍', exampleSentenceGerman: 'Ananas schmeckt süß.', exampleSentenceArabic: 'الأناناس طعمه حلو.', missingLetterWord: 'die An_nas', sentence4Elements: ['Ananas', 'schmeckt', 'sehr', 'süß.'] },
      { id: 'obst_10', german: 'die Mango', arabic: 'المانجو', plural: 'die Mangos', emoji: '🥭', exampleSentenceGerman: 'Ich esse eine Mango.', exampleSentenceArabic: 'أنا آكل مانجو.', missingLetterWord: 'die M_ngo', sentence4Elements: ['Ich', 'esse', 'eine', 'Mango.'] }
    ]
  },
  {
    id: 'set_def_11_bauernhof',
    title: 'Tiere auf dem Bauernhof',
    topic: 'حيوانات المزرعة',
    grade: 'المستوى الثالث: الطعام والحيوانات',
    level: 'A1',
    difficulty: 'easy',
    description: 'تعلم أسماء أصوات وحيوانات المزرعة بالألمانية.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'tier_1', german: 'die Kuh', arabic: 'البقرة', plural: 'die Kühe', emoji: '🐄', exampleSentenceGerman: 'Die Kuh gibt Milch.', exampleSentenceArabic: 'البقرة تعطي الحليب.', missingLetterWord: 'die K_h', sentence4Elements: ['Die', 'Kuh', 'gibt', 'Milch.'] },
      { id: 'tier_2', german: 'das Pferd', arabic: 'الحصان', plural: 'die Pferde', emoji: '🐎', exampleSentenceGerman: 'Das Pferd läuft schnell.', exampleSentenceArabic: 'الحصان يركض سريعا.', missingLetterWord: 'das Pf_rd', sentence4Elements: ['Das', 'Pferd', 'läuft', 'schnell.'] },
      { id: 'tier_3', german: 'das Schaf', arabic: 'الخروف', plural: 'die Schafe', emoji: '🐑', exampleSentenceGerman: 'Das Schaf ist weiß.', exampleSentenceArabic: 'الخروف أبيض.', missingLetterWord: 'das Sch_f', sentence4Elements: ['Das', 'Schaf', 'ist', 'weiß.'] },
      { id: 'tier_4', german: 'das Huhn', arabic: 'الدجاجة', plural: 'die Hühner', emoji: '🐔', exampleSentenceGerman: 'Das Huhn legt ein Ei.', exampleSentenceArabic: 'الدجاجة تضع بيضة.', missingLetterWord: 'das H_hn', sentence4Elements: ['Das', 'Huhn', 'legt', 'Ei.'] },
      { id: 'tier_5', german: 'der Hund', arabic: 'الكلب', plural: 'die Hunde', emoji: '🐕', exampleSentenceGerman: 'Der Hund bellt laut.', exampleSentenceArabic: 'الكلب ينبح بصوت عالٍ.', missingLetterWord: 'der H_nd', sentence4Elements: ['Der', 'Hund', 'bellt', 'laut.'] },
      { id: 'tier_6', german: 'die Katze', arabic: 'القطة', plural: 'die Katzen', emoji: '🐱', exampleSentenceGerman: 'Die Katze schläft gerne.', exampleSentenceArabic: 'القطة تحب النوم.', missingLetterWord: 'die K_tze', sentence4Elements: ['Die', 'Katze', 'schläft', 'gerne.'] },
      { id: 'tier_7', german: 'das Schwein', arabic: 'الخنزير', plural: 'die Schweine', emoji: '🐖', exampleSentenceGerman: 'Das Schwein ist rosa.', exampleSentenceArabic: 'الخنزير وردي اللون.', missingLetterWord: 'das Schw_in', sentence4Elements: ['Das', 'Schwein', 'ist', 'rosa.'] },
      { id: 'tier_8', german: 'die Ente', arabic: 'البطة', plural: 'die Enten', emoji: '🦆', exampleSentenceGerman: 'Die Ente schwimmt im Teich.', exampleSentenceArabic: 'البطة تسبح في البحيرة.', missingLetterWord: 'die E_te', sentence4Elements: ['Die', 'Ente', 'schwimmt', 'gerne.'] },
      { id: 'tier_9', german: 'der Esel', arabic: 'الحمار', plural: 'die Esel', emoji: '🫏', exampleSentenceGerman: 'Der Esel trägt Sachen.', exampleSentenceArabic: 'الحمار يحمل الأغراض.', missingLetterWord: 'der E_el', sentence4Elements: ['Der', 'Esel', 'ist', 'fleiβig.'] },
      { id: 'tier_10', german: 'die Ziege', arabic: 'الماعز', plural: 'die Ziegen', emoji: '🐐', exampleSentenceGerman: 'Die Ziege springt hoch.', exampleSentenceArabic: 'الماعز يقفز عالياً.', missingLetterWord: 'die Zi_ge', sentence4Elements: ['Die', 'Ziege', 'springt', 'hoch.'] }
    ]
  },

  // ==================== المستوى الرابع: الحياة اليومية ====================
  {
    id: 'set_def_12_wochentage',
    title: 'Die Wochentage',
    topic: 'أيام الأسبوع',
    grade: 'المستوى الرابع: الحياة اليومية',
    level: 'A1',
    difficulty: 'easy',
    description: 'أيام الأسبوع السبعة باللغة الألمانية بترتيبها الصحيح.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'tag_1', german: 'der Montag', arabic: 'الإثنين', emoji: '📅', exampleSentenceGerman: 'Am Montag gehe ich zur Schule.', exampleSentenceArabic: 'يوم الإثنين أذهب للمدرسة.', missingLetterWord: 'der M_ntag', sentence4Elements: ['Am', 'Montag', 'lernen', 'wir.'] },
      { id: 'tag_2', german: 'der Dienstag', arabic: 'الثلاثاء', emoji: '📅', exampleSentenceGerman: 'Dienstag ist Sporttag.', exampleSentenceArabic: 'الثلاثاء يوم الرياضة.', missingLetterWord: 'der Di_nstag', sentence4Elements: ['Am', 'Dienstag', 'machen', 'Sport.'] },
      { id: 'tag_3', german: 'der Mittwoch', arabic: 'الأربعاء', emoji: '📅', exampleSentenceGerman: 'Mittwoch ist die Mitte der Woche.', exampleSentenceArabic: 'الأربعاء منتصف الأسبوع.', missingLetterWord: 'der Mittw_ch', sentence4Elements: ['Heute', 'ist', 'schöner', 'Mittwoch.'] },
      { id: 'tag_4', german: 'der Donnerstag', arabic: 'الخميس', emoji: '📅', exampleSentenceGerman: 'Am Donnerstag malen wir.', exampleSentenceArabic: 'يوم الخميس نرسم.', missingLetterWord: 'der Donn_rstag', sentence4Elements: ['Am', 'Donnerstag', 'malen', 'wir.'] },
      { id: 'tag_5', german: 'der Freitag', arabic: 'الجمعة', emoji: '📅', exampleSentenceGerman: 'Am Freitag ist Wochenende!', exampleSentenceArabic: 'يوم الجمعة تبدأ العطلة!', missingLetterWord: 'der Fr_itag', sentence4Elements: ['Freitag', 'ist', 'ein', 'Supertag!'] },
      { id: 'tag_6', german: 'der Samstag', arabic: 'السبت', emoji: '🥳', exampleSentenceGerman: 'Am Samstag spielen wir.', exampleSentenceArabic: 'يوم السبت نلعب.', missingLetterWord: 'der S_mstag', sentence4Elements: ['Am', 'Samstag', 'spielen', 'draußen.'] },
      { id: 'tag_7', german: 'der Sonntag', arabic: 'الأحد', emoji: '☀️', exampleSentenceGerman: 'Der Sonntag ist ein Ruhetag.', exampleSentenceArabic: 'الأحد يوم راحة.', missingLetterWord: 'der S_nntag', sentence4Elements: ['Der', 'Sonntag', 'ist', 'Ruhetag.'] }
    ]
  },
  {
    id: 'set_def_13_jahreszeiten',
    title: 'Die Jahreszeiten und das Wetter',
    topic: 'فصول السنة والطقس',
    grade: 'المستوى الرابع: الحياة اليومية',
    level: 'A1',
    difficulty: 'easy',
    description: 'فصول السنة الأربعة وحالات الطقس المختلفة للأطفال.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'jah_1', german: 'der Frühling', arabic: 'الربيع', emoji: '🌸', exampleSentenceGerman: 'Im Frühling blühen Blumen.', exampleSentenceArabic: 'في الربيع تتفتح الأزهار.', missingLetterWord: 'der Fr_hling', sentence4Elements: ['Im', 'Frühling', 'blühen', 'Blumen.'] },
      { id: 'jah_2', german: 'der Sommer', arabic: 'الصيف', emoji: '☀️', exampleSentenceGerman: 'Der Sommer ist sehr warm.', exampleSentenceArabic: 'الصيف دافئ جداً.', missingLetterWord: 'der S_mmer', sentence4Elements: ['Der', 'Sommer', 'ist', 'warm.'] },
      { id: 'jah_3', german: 'der Herbst', arabic: 'الخريف', emoji: '🍂', exampleSentenceGerman: 'Im Herbst fallen Blätter.', exampleSentenceArabic: 'في الخريف تسقط الأوراق.', missingLetterWord: 'der H_rbst', sentence4Elements: ['Im', 'Herbst', 'fallen', 'Blätter.'] },
      { id: 'jah_4', german: 'der Winter', arabic: 'الشتاء', emoji: '❄️', exampleSentenceGerman: 'Im Winter schneit es.', exampleSentenceArabic: 'في الشتاء يتساقط الثلج.', missingLetterWord: 'der W_nter', sentence4Elements: ['Im', 'Winter', 'schneit', 'es.'] },
      { id: 'wet_1', german: 'die Sonne', arabic: 'الشمس', emoji: '☀️', exampleSentenceGerman: 'Die Sonne scheint hell.', exampleSentenceArabic: 'الشمس تشرق بسطوع.', missingLetterWord: 'die S_nne', sentence4Elements: ['Die', 'Sonne', 'scheint', 'hell.'] },
      { id: 'wet_2', german: 'der Regen', arabic: 'المطر', emoji: '🌧️', exampleSentenceGerman: 'Der Regen fällt leise.', exampleSentenceArabic: 'المطر هادئ.', missingLetterWord: 'der R_gen', sentence4Elements: ['Der', 'Regen', 'fällt', 'heute.'] },
      { id: 'wet_3', german: 'der Schnee', arabic: 'الثلج', emoji: '☃️', exampleSentenceGerman: 'Der Schnee ist kalt.', exampleSentenceArabic: 'الثلج بارد.', missingLetterWord: 'der Schn_e', sentence4Elements: ['Der', 'Schnee', 'ist', 'kalt.'] },
      { id: 'wet_4', german: 'der Wind', arabic: 'الرياح', emoji: '💨', exampleSentenceGerman: 'Der Wind weht stark.', exampleSentenceArabic: 'الرياح تهب بقوة.', missingLetterWord: 'der W_nd', sentence4Elements: ['Der', 'Wind', 'weht', 'stark.'] },
      { id: 'wet_5', german: 'der Regenbogen', arabic: 'قوس قزح', emoji: '🌈', exampleSentenceGerman: 'Der Regenbogen ist bunt.', exampleSentenceArabic: 'قوس قزح ملون.', missingLetterWord: 'der Reg_nbogen', sentence4Elements: ['Der', 'Regenbogen', 'ist', 'bunt.'] },
      { id: 'wet_6', german: 'die Wolke', arabic: 'السحابة', plural: 'die Wolken', emoji: '☁️', exampleSentenceGerman: 'Die Wolke ist weiß.', exampleSentenceArabic: 'السحابة بيضاء.', missingLetterWord: 'die W_lke', sentence4Elements: ['Die', 'Wolke', 'ist', 'weiß.'] }
    ]
  },

  // ==================== المستوى الخامس: العالم من حولنا ====================
  {
    id: 'set_def_14_verkehr',
    title: 'Verkehrsmittel',
    topic: 'وسائل المواصلات',
    grade: 'المستوى الخامس: العالم من حولنا',
    level: 'A2',
    difficulty: 'medium',
    description: 'وسائل النقل والمواصلات للأطفال بالألمانية.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'ver_1', german: 'das Auto', arabic: 'السيارة', plural: 'die Autos', emoji: '🚗', exampleSentenceGerman: 'Das Auto fährt schnell.', exampleSentenceArabic: 'السيارة تسير بسرعة.', missingLetterWord: 'das A_to', sentence4Elements: ['Das', 'Auto', 'fährt', 'schnell.'] },
      { id: 'ver_2', german: 'der Bus', arabic: 'الحافلة / الباص', plural: 'die Busse', emoji: '🚌', exampleSentenceGerman: 'Wir fahren mit dem Bus.', exampleSentenceArabic: 'نحن نركب الباص.', missingLetterWord: 'der B_s', sentence4Elements: ['Wir', 'fahren', 'mit', 'Bus.'] },
      { id: 'ver_3', german: 'der Zug', arabic: 'القطار', plural: 'die Züge', emoji: '🚆', exampleSentenceGerman: 'Der Zug kommt pünktlich.', exampleSentenceArabic: 'القطار يصل في الموعد.', missingLetterWord: 'der Z_g', sentence4Elements: ['Der', 'Zug', 'kommt', 'jetzt.'] },
      { id: 'ver_4', german: 'das Fahrrad', arabic: 'الدراجة', plural: 'die Fahrräder', emoji: '🚲', exampleSentenceGerman: 'Ich fahre Fahrrad.', exampleSentenceArabic: 'أنا أركب الدراجة.', missingLetterWord: 'das F_hrrad', sentence4Elements: ['Ich', 'fahre', 'gerne', 'Fahrrad.'] },
      { id: 'ver_5', german: 'das Flugzeug', arabic: 'الطائرة', plural: 'die Flugzeuge', emoji: '✈️', exampleSentenceGerman: 'Das Flugzeug fliegt hoch.', exampleSentenceArabic: 'الطائرة تطير عالياً.', missingLetterWord: 'das Fl_gzeug', sentence4Elements: ['Das', 'Flugzeug', 'fliegt', 'hoch.'] },
      { id: 'ver_6', german: 'das Schiff', arabic: 'السفينة', plural: 'die Schiffe', emoji: '🚢', exampleSentenceGerman: 'Das Schiff schwimmt im Meer.', exampleSentenceArabic: 'السفينة تبحر في البحر.', missingLetterWord: 'das Sch_ff', sentence4Elements: ['Das', 'Schiff', 'schwimmt', 'weit.'] },
      { id: 'ver_7', german: 'die U-Bahn', arabic: 'مترو الأنفاق', plural: 'die U-Bahnen', emoji: '🚇', exampleSentenceGerman: 'Die U-Bahn fährt unter der Erde.', exampleSentenceArabic: 'المترو يسير تحت الأرض.', missingLetterWord: 'die U-B_hn', sentence4Elements: ['Die', 'U-Bahn', 'fährt', 'schnell.'] },
      { id: 'ver_8', german: 'der Roller', arabic: 'السكوتر', plural: 'die Roller', emoji: '🛴', exampleSentenceGerman: 'Mein Roller ist neu.', exampleSentenceArabic: 'السكوتر الخاص بي جديد.', missingLetterWord: 'der R_ller', sentence4Elements: ['Mein', 'Roller', 'ist', 'neu.'] },
      { id: 'ver_9', german: 'die Rakete', arabic: 'الصواريخ / الصاروخ', plural: 'die Raketen', emoji: '🚀', exampleSentenceGerman: 'Die Rakete fliegt zum Mond.', exampleSentenceArabic: 'الصاروخ يطير إلى القمر.', missingLetterWord: 'die Rak_te', sentence4Elements: ['Die', 'Rakete', 'fliegt', 'hoch.'] },
      { id: 'ver_10', german: 'das Hubschrauber', arabic: 'الطائرة المروحية / الهليكوبتر', plural: 'die Hubschrauber', emoji: '🚁', exampleSentenceGerman: 'Der Hubschrauber ist laut.', exampleSentenceArabic: 'الهليكوبتر صوته عالٍ.', missingLetterWord: 'der H_bschrauber', sentence4Elements: ['Der', 'Hubschrauber', 'fliegt', 'oben.'] }
    ]
  },

  // ==================== المستوى السادس: الأفعال والصفات ====================
  {
    id: 'set_def_15_verben',
    title: 'Verben und Tätigkeiten',
    topic: 'الأفعال والأنشطة اليومية',
    grade: 'المستوى السادس: الأفعال والصفات والمفاهيم',
    level: 'A2',
    difficulty: 'medium',
    description: 'أهم الأفعال الحركية واليومية للأطفال بالألمانية.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'vrb_1', german: 'spielen', arabic: 'يلعب', emoji: '⚽', exampleSentenceGerman: 'Wir spielen zusammen.', exampleSentenceArabic: 'نحن نلعب معاً.', missingLetterWord: 'spi_len', sentence4Elements: ['Wir', 'spielen', 'heute', 'zusammen.'] },
      { id: 'vrb_2', german: 'lernen', arabic: 'يتعلم', emoji: '📚', exampleSentenceGerman: 'Ich lerne Deutsch.', exampleSentenceArabic: 'أنا أتعلم الألمانية.', missingLetterWord: 'l_rnen', sentence4Elements: ['Ich', 'lerne', 'gerne', 'Deutsch.'] },
      { id: 'vrb_3', german: 'essen', arabic: 'يأكل', emoji: '🍕', exampleSentenceGerman: 'Wir essen Pizza.', exampleSentenceArabic: 'نحن نأكل بيتزا.', missingLetterWord: '_ssen', sentence4Elements: ['Wir', 'essen', 'leckere', 'Pizza.'] },
      { id: 'vrb_4', german: 'trinken', arabic: 'يشرب', emoji: '🥛', exampleSentenceGerman: 'Ich trinke Milch.', exampleSentenceArabic: 'أنا أشرب حليباً.', missingLetterWord: 'tr_nken', sentence4Elements: ['Ich', 'trinke', 'frische', 'Milch.'] },
      { id: 'vrb_5', german: 'schlafen', arabic: 'ينام', emoji: '😴', exampleSentenceGerman: 'Das Baby schläft.', exampleSentenceArabic: 'الطفل الرضيع ينام.', missingLetterWord: 'schl_fen', sentence4Elements: ['Das', 'Baby', 'schläft', 'gut.'] },
      { id: 'vrb_6', german: 'laufen', arabic: 'يركض / يجري', emoji: '🏃', exampleSentenceGerman: 'Der Junge läuft schnell.', exampleSentenceArabic: 'الولد يركض سريعا.', missingLetterWord: 'l_ufen', sentence4Elements: ['Der', 'Junge', 'läuft', 'schnell.'] },
      { id: 'vrb_7', german: 'singen', arabic: 'يغني', emoji: '🎤', exampleSentenceGerman: 'Wir singen ein Lied.', exampleSentenceArabic: 'نحن نغني أغنية.', missingLetterWord: 's_ngen', sentence4Elements: ['Wir', 'singen', 'ein', 'Lied.'] },
      { id: 'vrb_8', german: 'malen', arabic: 'يرسم / يلون', emoji: '🎨', exampleSentenceGerman: 'Anna malt ein Bild.', exampleSentenceArabic: 'آنا ترسم لوحة.', missingLetterWord: 'm_len', sentence4Elements: ['Anna', 'malt', 'ein', 'Bild.'] },
      { id: 'vrb_9', german: 'schreiben', arabic: 'يكتب', emoji: '✏️', exampleSentenceGerman: 'Ich schreibe ein Wort.', exampleSentenceArabic: 'أنا أكتب كلمة.', missingLetterWord: 'schr_iben', sentence4Elements: ['Ich', 'schreibe', 'ein', 'Wort.'] },
      { id: 'vrb_10', german: 'lesen', arabic: 'يقرأ', emoji: '📖', exampleSentenceGerman: 'Opa liest ein Buch.', exampleSentenceArabic: 'جدي يقرأ كتاباً.', missingLetterWord: 'l_sen', sentence4Elements: ['Opa', 'liest', 'ein', 'Buch.'] }
    ]
  },

  // ==================== المستوى السابع: موضوعات إضافية ====================
  {
    id: 'set_def_16_geburtstag',
    title: 'Mein Geburtstag',
    topic: 'عيد ميلادي',
    grade: 'المستوى السابع: موضوعات إضافية للأنشطة',
    level: 'A2',
    difficulty: 'medium',
    description: 'مفردات وأجواء احتفال عيد الميلاد للأطفال.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: 1767225600000,
    items: [
      { id: 'geb_1', german: 'der Geburtstag', arabic: 'عيد الميلاد', plural: 'die Geburtstage', emoji: '🎂', exampleSentenceGerman: 'Heute ist mein Geburtstag!', exampleSentenceArabic: 'اليوم هو عيد ميلادي!', missingLetterWord: 'der Geburtst_g', sentence4Elements: ['Heute', 'ist', 'mein', 'Geburtstag!'] },
      { id: 'geb_2', german: 'der Kuchen', arabic: 'الكعكة / الكيك', plural: 'die Kuchen', emoji: '🍰', exampleSentenceGerman: 'Der Kuchen schmeckt lecker.', exampleSentenceArabic: 'الكعكة طعمها لديد.', missingLetterWord: 'der K_chen', sentence4Elements: ['Der', 'Kuchen', 'schmeckt', 'lecker.'] },
      { id: 'geb_3', german: 'die Kerze', arabic: 'الشمعة', plural: 'die Kerzen', emoji: '🕯️', exampleSentenceGerman: 'Puste die Kerzen aus!', exampleSentenceArabic: 'اطفئ الشموع!', missingLetterWord: 'die K_rze', sentence4Elements: ['Puste', 'die', 'Kerzen', 'aus!'] },
      { id: 'geb_4', german: 'das Geschenk', arabic: 'الهدية', plural: 'die Geschenke', emoji: '🎁', exampleSentenceGerman: 'Danke für das Geschenk!', exampleSentenceArabic: 'شكراً على الهدية!', missingLetterWord: 'das Gesch_nk', sentence4Elements: ['Danke', 'für', 'das', 'Geschenk!'] },
      { id: 'geb_5', german: 'die Party', arabic: 'الحفلة', plural: 'die Partys', emoji: '🎉', exampleSentenceGerman: 'Wir machen eine Party.', exampleSentenceArabic: 'نحن نقيم حفلة.', missingLetterWord: 'die P_rty', sentence4Elements: ['Wir', 'machen', 'eine', 'Party.'] },
      { id: 'geb_6', german: 'die Luftballons', arabic: 'البالونات', emoji: '🎈', exampleSentenceGerman: 'Die Luftballons sind bunt.', exampleSentenceArabic: 'البالونات ملونة.', missingLetterWord: 'die Luftball_ns', sentence4Elements: ['Die', 'Luftballons', 'sind', 'bunt.'] },
      { id: 'geb_7', german: 'die Einladung', arabic: 'الدعوة', plural: 'die Einladungen', emoji: '✉️', exampleSentenceGerman: 'Hier ist deine Einladung.', exampleSentenceArabic: 'هذه هي دعوتك.', missingLetterWord: 'die Einl_dung', sentence4Elements: ['Hier', 'ist', 'deine', 'Einladung.'] },
      { id: 'geb_8', german: 'die Freunde', arabic: 'الأصدقاء', emoji: '👫', exampleSentenceGerman: 'Alle meine Freunde kommen.', exampleSentenceArabic: 'جميع أصدقائي قادمون.', missingLetterWord: 'die Fre_nde', sentence4Elements: ['Alle', 'meine', 'Freunde', 'kommen.'] },
      { id: 'geb_9', german: 'die Spiele', arabic: 'الألعاب', emoji: '🎲', exampleSentenceGerman: 'Wir machen tolle Spiele.', exampleSentenceArabic: 'نحن نلعب ألعاباً رائعة.', missingLetterWord: 'die Spi_le', sentence4Elements: ['Wir', 'machen', 'tolle', 'Spiele.'] },
      { id: 'geb_10', german: 'die Wünsche', arabic: 'الأمنيات', emoji: '🌟', exampleSentenceGerman: 'Alles Gute zum Geburtstag!', exampleSentenceArabic: 'كل عام وأنت بخير!', missingLetterWord: 'die W_nsche', sentence4Elements: ['Alles', 'Gute', 'zum', 'Geburtstag!'] }
    ]
  }
];
