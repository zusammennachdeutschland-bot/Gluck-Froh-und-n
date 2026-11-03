/**
 * Comprehensive Unit Tests for Lernstudio Worksheet Builder & Generator (ws-5)
 */

import { LernstudioSet, LernstudioItem } from '../types/lernstudio';
import {
  WORKSHEET_BUILD_ID,
  DEFAULT_PAGE_CONTENT_HEIGHT_PX,
  RUNNING_HEADER_HEIGHT_PX,
  stripCopySuffix,
  stripEmoji,
  normalizeDisplayEmoji,
  normalizeArabicHint,
  conjugateGermanVerb,
  detectSetDomains,
  buildWorksheetData,
  buildWorksheetBlocks,
  buildWorksheetHtml,
  getWorksheetCss,
  rebuildSentence4Elements,
  isSentence4ElementsValid,
  paginateBlocks,
  isValidOddOneOut,
  WorksheetBlock
} from '../utils/lernstudioWorksheetBuilder';
import { isGermanNumberWord } from '../utils/lernstudioDistractors';
import {
  generateLernstudioPrompt,
  validateLernstudioSetForWorksheet
} from '../utils/lernstudioAiUtils';

// ==========================================
// FIXTURES (6 Required Fixtures)
// ==========================================

const PHRASE_SET: LernstudioSet = {
  id: 'set_phrase_fixture',
  title: 'Höflichkeitsformeln (Copy)',
  topic: 'Höflichkeit',
  level: 'A1',
  difficulty: 'easy',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: 123456789,
  items: [
    { id: 'p1', german: 'Entschuldigung', emoji: '🙏', arabic: 'معذرة / عذراً', exampleSentenceGerman: 'Entschuldigung, wo ist der Bahnhof?', exampleSentenceArabic: 'عذراً، أين المحطة؟' },
    { id: 'p2', german: 'Es tut mir leid', emoji: '😔', arabic: 'أنا آسف', exampleSentenceGerman: 'Es tut mir wirklich sehr leid.', exampleSentenceArabic: 'أنا آسف جداً حقاً.' },
    { id: 'p3', german: 'Kein Problem', emoji: '👌', arabic: 'لا مشكلة', exampleSentenceGerman: 'Das ist wirklich kein Problem.', exampleSentenceArabic: 'هذه ليست مشكلة حقاً.' },
    { id: 'p4', german: 'Sehr gerne', emoji: '😊', arabic: 'بكل سرور', exampleSentenceGerman: 'Ich helfe dir sehr gerne.', exampleSentenceArabic: 'أساعدك بكل سرور.' },
    { id: 'p5', german: 'Vielen Dank', emoji: '💐', arabic: 'شكراً جزيلاً', exampleSentenceGerman: 'Vielen Dank für deine Hilfe!', exampleSentenceArabic: 'شكراً جزيلاً لمساعدتك!' },
    { id: 'p6', german: 'Guten Appetit', emoji: '🍽️', arabic: 'شهية طيبة', exampleSentenceGerman: 'Ich wünsche euch allen Guten Appetit!', exampleSentenceArabic: 'أتمنى لكم جميعاً شهية طيبة!' },
    { id: 'p7', german: 'Gesundheit', emoji: '🤧', arabic: '(يرحمك الله / بالصحة (عند العطس))', exampleSentenceGerman: 'Gesundheit und alles Gute wünsche ich.', exampleSentenceArabic: 'أتمنى لك الصحة وكل الخير.' },
    { id: 'p8', german: 'Herzlich willkommen', emoji: '🎉', arabic: 'أهلاً وسهلاً بك', exampleSentenceGerman: 'Herzlich willkommen in Deutschland!', exampleSentenceArabic: 'أهلاً وسهلاً بك في ألمانيا!' },
    { id: 'p9', german: 'Schönen Tag noch', emoji: '☀️', arabic: 'أتمنى لك يوماً جميلاً', exampleSentenceGerman: 'Ich wünsche dir einen schönen Tag noch.', exampleSentenceArabic: 'أتمنى لك يوماً جميلاً.' },
    { id: 'p10', german: 'Viel Glück', emoji: '🍀', arabic: 'حظاً سعيداً', exampleSentenceGerman: 'Viel Glück bei der Prüfung heute!', exampleSentenceArabic: 'حظاً سعيداً في الامتحان اليوم!' }
  ]
};

const NOUN_SET: LernstudioSet = {
  id: 'set_noun_fixture',
  title: 'Möbel und Tiere',
  topic: 'Nomen',
  level: 'A1',
  difficulty: 'easy',
  hasArticles: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: 123456789,
  items: [
    { id: 'n1', german: 'der Tisch', article: 'der', plural: 'die Tische', arabic: 'الطاولة', emoji: '🪑', exampleSentenceGerman: 'Der Tisch ist groß und schön.', exampleSentenceArabic: 'الطاولة كبيرة وجميلة.' },
    { id: 'n2', german: 'der Stuhl', article: 'der', plural: 'die Stühle', arabic: 'الكرسي', emoji: '🪑', exampleSentenceGerman: 'Der Stuhl steht am Tisch.', exampleSentenceArabic: 'الكرسي يقف عند الطاولة.' },
    { id: 'n3', german: 'der Hund', article: 'der', plural: 'die Hunde', arabic: 'الكلب', emoji: '🐕', exampleSentenceGerman: 'Der Hund spielt im Garten.', exampleSentenceArabic: 'الكلب يلعب في الحديقة.' },
    { id: 'n4', german: 'die Lampe', article: 'die', plural: 'die Lampen', arabic: 'المصباح', emoji: '💡', exampleSentenceGerman: 'Die Lampe brennt im Zimmer.', exampleSentenceArabic: 'المصباح يضيء في الغرفة.' },
    { id: 'n5', german: 'die Tür', article: 'die', plural: 'die Türen', arabic: 'الباب', emoji: '🚪', exampleSentenceGerman: 'Die Tür ist jetzt offen.', exampleSentenceArabic: 'الباب مفتوح الآن.' },
    { id: 'n6', german: 'die Katze', article: 'die', plural: 'die Katzen', arabic: 'القطة', emoji: '🐱', exampleSentenceGerman: 'Die Katze schläft auf dem Sofa.', exampleSentenceArabic: 'القطة تنام على الأريكة.' },
    { id: 'n7', german: 'das Buch', article: 'das', plural: 'die Bücher', arabic: 'الكتاب', emoji: '📖', exampleSentenceGerman: 'Das Buch liegt auf dem Tisch.', exampleSentenceArabic: 'الكتاب يقع على الطاولة.' },
    { id: 'n8', german: 'das Fenster', article: 'das', plural: 'die Fenster', arabic: 'النافذة', emoji: '🪟', exampleSentenceGerman: 'Das Fenster ist sehr sauber.', exampleSentenceArabic: 'النافذة نظيفة جداً.' },
    { id: 'n9', german: 'das Haus', article: 'das', plural: 'die Häuser', arabic: 'المنزل', emoji: '🏠', exampleSentenceGerman: 'Das Haus ist sehr alt.', exampleSentenceArabic: 'المنزل قديم جداً.' }
  ]
};

const VERB_SET: LernstudioSet = {
  id: 'set_verb_fixture',
  title: 'Aktivitäten und Verben',
  topic: 'Verben',
  level: 'A1',
  difficulty: 'medium',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: 123456789,
  items: [
    { id: 'v1', german: 'gehen', emoji: '🚶', arabic: 'يذهب', exampleSentenceGerman: 'Ich gehe heute in die Schule.', exampleSentenceArabic: 'أنا أذهب اليوم إلى المدرسة.' },
    { id: 'v2', german: 'lernen', emoji: '📚', arabic: 'يتعلم', exampleSentenceGerman: 'Wir lernen zusammen Deutsch.', exampleSentenceArabic: 'نحن نتعلم الألمانية معاً.' },
    { id: 'v3', german: 'essen', emoji: '🍎', arabic: 'يأكل', exampleSentenceGerman: 'Er isst einen leckeren Apfel.', exampleSentenceArabic: 'هو يأكل تفاحة لذيذة.' },
    { id: 'v4', german: 'trinken', emoji: '🥤', arabic: 'يشرب', exampleSentenceGerman: 'Sie trinken kaltes Wasser.', exampleSentenceArabic: 'هم يشربون ماء بارداً.' },
    { id: 'v5', german: 'spielen', emoji: '⚽', arabic: 'يلعب', exampleSentenceGerman: 'Die Kinder spielen draußen Fußball.', exampleSentenceArabic: 'الأطفال يلعبون الكرة بالخارج.' },
    { id: 'v6', german: 'schlafen', emoji: '😴', arabic: 'ينام', exampleSentenceGerman: 'Der Hund schläft sehr tief.', exampleSentenceArabic: 'الكلب ينام عميقاً جداً.' },
    { id: 'v7', german: 'fahren', emoji: '🚗', arabic: 'يركب/يسافر', exampleSentenceGerman: 'Ahmed fährt morgen nach Berlin.', exampleSentenceArabic: 'أحمد يسافر غداً إلى برلين.' },
    { id: 'v8', german: 'arbeiten', emoji: '💼', arabic: 'يعمل', exampleSentenceGerman: 'Mein Vater arbeitet im Büro.', exampleSentenceArabic: 'أبي يعمل في المكتب.' }
  ]
};

const NUMBER_SET: LernstudioSet = {
  id: 'curric_b01_10_numbers_tens',
  title: 'Zehnerzahlen bis 100',
  topic: 'الأرقام والحساب',
  topicTranslations: { ar: 'الأرقام والحساب', de: 'Zahlen & Rechnen', en: 'Numbers & Math' },
  level: 'A1',
  difficulty: 'easy',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: 123456789,
  items: [
    { id: 'num20', german: 'zwanzig', arabic: 'عشرون (20)', emoji: '2️⃣0️⃣', exampleSentenceGerman: 'Zwanzig Kinder sind im Bus.', exampleSentenceArabic: 'عشرون طفلاً في الحافلة.' },
    { id: 'num30', german: 'dreißig', arabic: 'ثلاثون (30)', emoji: '3️⃣0️⃣', exampleSentenceGerman: 'Der Monat hat dreißig Tage.', exampleSentenceArabic: 'الشهر فيه ثلاثون يوماً.' },
    { id: 'num40', german: 'vierzig', arabic: 'أربعون (40)', emoji: '4️⃣0️⃣', exampleSentenceGerman: 'Mein Vater ist vierzig Jahre alt.', exampleSentenceArabic: 'أبي عمره أربعون عاماً.' },
    { id: 'num50', german: 'fünfzig', arabic: 'خمسون (50)', emoji: '5️⃣0️⃣', exampleSentenceGerman: 'Das Buch hat fünfzig Seiten.', exampleSentenceArabic: 'الكتاب فيه خمسون صفحة.' },
    { id: 'num60', german: 'sechzig', arabic: 'ستون (60)', emoji: '6️⃣0️⃣', exampleSentenceGerman: 'Eine Stunde hat sechzig Minuten.', exampleSentenceArabic: 'الساعة فيها ستون دقيقة.' },
    { id: 'num70', german: 'siebzig', arabic: 'سبعون (70)', emoji: '7️⃣0️⃣', exampleSentenceGerman: 'Mein Opa ist siebzig Jahre alt.', exampleSentenceArabic: 'جدي عمره سبعون عاماً.' },
    { id: 'num80', german: 'achtzig', arabic: 'ثمانون (80)', emoji: '8️⃣0️⃣', exampleSentenceGerman: 'Die Jacke kostet achtzig Euro.', exampleSentenceArabic: 'الجاكيت يكلف ثمانين يورو.' },
    { id: 'num90', german: 'neunzig', arabic: 'تسعون (90)', emoji: '9️⃣0️⃣', exampleSentenceGerman: 'Er hat neunzig Punkte im Spiel.', exampleSentenceArabic: 'حصل على تسعين نقطة في اللعبة.' },
    { id: 'num100', german: 'hundert', arabic: 'مائة (100)', emoji: '💯', exampleSentenceGerman: 'Ich zähle schnell bis hundert.', exampleSentenceArabic: 'أنا أعد بسرعة حتى المائة.' },
    { id: 'num1000', german: 'tausend', arabic: 'ألف (1000)', emoji: '🔢', exampleSentenceGerman: 'Tausend Dank für deine Hilfe!', exampleSentenceArabic: 'ألف شكر على مساعدتك!' }
  ]
};

const TINY_SET: LernstudioSet = {
  id: 'set_tiny_3',
  title: 'Drei Wörter',
  topic: 'Schule',
  level: 'A1',
  difficulty: 'easy',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: 123456789,
  items: NOUN_SET.items.slice(0, 3)
};

const LARGE_SET: LernstudioSet = {
  id: 'set_large_30',
  title: 'Großer Wortschatz (30 Wörter)',
  topic: 'Allgemein',
  level: 'A1',
  difficulty: 'medium',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: 123456789,
  items: Array.from({ length: 30 }, (_, idx): LernstudioItem => {
    const base = NOUN_SET.items[idx % NOUN_SET.items.length];
    return {
      ...base,
      id: `lg_${idx + 1}`,
      german: `${base.article} ${stripEmoji(base.german).replace(/^(der|die|das)\s+/i, '')}${idx >= 9 ? `_${idx + 1}` : ''}`,
      arabic: `${base.arabic} ${idx + 1}`
    };
  })
};

// ==========================================
// TEST RUNNER
// ==========================================

export function runLernstudioWorksheetTests(): { passed: number; failed: number; errors: string[] } {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`Assertion failed: ${msg}`);
      console.error(`❌ Assertion failed: ${msg}`);
    }
  }

  // -------------------------------------------------------------
  // 1. Build Stamp & CSS Layout Regression Verification
  // -------------------------------------------------------------
  assert(WORKSHEET_BUILD_ID === 'ws-8', 'WORKSHEET_BUILD_ID is ws-8');
  const cssCheck = getWorksheetCss();
  assert(
    !cssCheck.includes('.ws-block {\n      display: block !important;'),
    '.ws-block does NOT force display: block !important (preserves grid/flex on matching & pictures)'
  );
  assert(
    !cssCheck.includes('.chip-box'),
    'Removed .chip-box borders around words in sentence order'
  );
  assert(
    cssCheck.includes('.matching-grid {\n      display: grid !important;\n      grid-template-columns: 1fr 1fr !important;'),
    '.matching-grid enforces 2-column grid with !important'
  );
  assert(
    cssCheck.includes('.pictures-row-grid {\n      display: grid !important;\n      grid-template-columns: repeat(4, 1fr) !important;'),
    '.pictures-row-grid enforces 4-column grid with !important'
  );

  // -------------------------------------------------------------
  // 2. Keycap-Digit Emoji Normalization (TASK 4b)
  // -------------------------------------------------------------
  const norm20 = normalizeDisplayEmoji('2️⃣0️⃣');
  const norm60 = normalizeDisplayEmoji('6️⃣0️⃣');
  const norm100 = normalizeDisplayEmoji('💯');
  const norm10 = normalizeDisplayEmoji('🔟');

  assert(norm20.text === '20' && norm20.isNumberBadge, '2️⃣0️⃣ normalizes to plain "20" without space');
  assert(norm60.text === '60' && norm60.isNumberBadge, '6️⃣0️⃣ normalizes to plain "60" without space');
  assert(norm100.text === '100' && norm100.isNumberBadge, '💯 normalizes to plain "100"');
  assert(norm10.text === '10' && norm10.isNumberBadge, '🔟 normalizes to plain "10"');

  const numberHtml = buildWorksheetHtml(NUMBER_SET, { questionsPerExercise: 8, variant: 1 });
  assert(!numberHtml.includes('2 0') && !numberHtml.includes('6 0'), 'Number HTML never prints "2 0" or "6 0"');
  assert(!numberHtml.includes('\u20E3'), 'Number HTML contains zero raw keycap combining characters');
  assert(numberHtml.includes('numeral-badge'), 'Number HTML renders numerals using clean .numeral-badge');

  // -------------------------------------------------------------
  // 3. Domain Detection & Odd-One-Out on Number Sets (TASK 4a)
  // -------------------------------------------------------------
  const numberDomains = detectSetDomains(NUMBER_SET);
  assert(numberDomains.has('numbers'), 'detectSetDomains identifies Zehnerzahlen bis 100 as numbers domain');

  const numberData = buildWorksheetData(NUMBER_SET, { includeOddOneOut: true, questionsPerExercise: 8, variant: 1 });
  assert(Boolean(numberData.oddOneOut && numberData.oddOneOut.length >= 3), 'Number set generates Odd-One-Out questions');

  if (numberData.oddOneOut) {
    numberData.oddOneOut.forEach((q) => {
      assert(
        !isGermanNumberWord(q.correctText) && !/\d/.test(q.correctText),
        `Number set Odd-One-Out outside word "${q.correctText}" is NEVER a number word`
      );
      assert(isValidOddOneOut(q, NUMBER_SET), `Number set question ${q.number} passes isValidOddOneOut`);
    });
  }

  // Explicitly verify that "fünf" as outside word is rejected by isValidOddOneOut on NUMBER_SET
  const fakeBadNumberQuestion = {
    number: 1,
    promptDe: 'Welches Wort passt nicht zum Thema?',
    promptAr: 'أي كلمة لا تنتمي للموضوع؟',
    options: [
      { letter: 'A', text: 'zwanzig', isCorrect: false },
      { letter: 'B', text: 'dreißig', isCorrect: false },
      { letter: 'C', text: 'vierzig', isCorrect: false },
      { letter: 'D', text: 'fünf', isCorrect: true }
    ],
    correctLetter: 'D',
    correctText: 'fünf'
  };
  assert(
    !isValidOddOneOut(fakeBadNumberQuestion, NUMBER_SET),
    'isValidOddOneOut strictly rejects "fünf" as outside word on NUMBER_SET'
  );

  // -------------------------------------------------------------
  // 4. Picture Exercise Rules for Number, Noun, and Phrase Sets (TASK 4c)
  // -------------------------------------------------------------
  assert(
    numberData.pictures?.instrDe === 'Schreibe die Zahl als Wort.',
    'Number set picture exercise uses "Schreibe die Zahl als Wort."'
  );
  assert(
    Boolean(numberData.pictures?.wordBank && numberData.pictures.wordBank.length >= 3),
    'Number set picture exercise includes shuffled Wörterbox'
  );
  assert(
    Boolean(numberData.pictures?.items.every((it) => !it.arabicHint && Boolean(it.numeralBadge))),
    'Number set picture items show numeralBadge and hide Arabic meaning'
  );

  const nounData = buildWorksheetData(NOUN_SET, { variant: 1 });
  assert(
    Boolean(nounData.pictures?.items.every((it) => !it.arabicHint)),
    'Noun set picture items hide Arabic meaning under the picture'
  );

  // -------------------------------------------------------------
  // 5. All 6 Fixtures × (3, 8, 12 questions) × (Student & Teacher) Pagination & Invariants
  // -------------------------------------------------------------
  const allFixtures = [PHRASE_SET, NOUN_SET, VERB_SET, NUMBER_SET, TINY_SET, LARGE_SET];
  const questionCounts = [3, 8, 12];

  for (const fixture of allFixtures) {
    for (const qCount of questionCounts) {
      for (const isTeacher of [false, true]) {
        const opts = { questionsPerExercise: qCount, includeAnswerKey: isTeacher, variant: 1 };
        const { data, blocks } = buildWorksheetBlocks(fixture, opts);
        const pages = paginateBlocks(blocks, DEFAULT_PAGE_CONTENT_HEIGHT_PX, RUNNING_HEADER_HEIGHT_PX);
        const html = buildWorksheetHtml(fixture, opts);

        assert(pages.length >= 2, `${fixture.id} (q=${qCount}, teacher=${isTeacher}) has >= 2 pages`);
        assert(
          pages[0].length > 1,
          `${fixture.id} Page 1 never contains only the header block (has ${pages[0].length} blocks)`
        );
        assert(
          !html.includes('Lehrer/in:</strong> ____________'),
          `${fixture.id} never prints a redundant blank Lehrer/in line`
        );

        // For 8 or 12 questions on full sets (NOUN, VERB, PHRASE, NUMBER, LARGE), must be >= 3 pages (never crammed onto 1 exercise page)
        if (fixture.items.length >= 8 && qCount >= 8) {
          assert(
            pages.length >= 3,
            `${fixture.id} (q=${qCount}) paginates across ${pages.length} pages (>= 3 pages, never crammed into 1 page)`
          );
        }

        // Check every page in deterministic model for overflow and orphaned titles
        pages.forEach((pageBlocks, pIdx) => {
          const isFirstPage = pIdx === 0;
          const availH = isFirstPage
            ? DEFAULT_PAGE_CONTENT_HEIGHT_PX
            : DEFAULT_PAGE_CONTENT_HEIGHT_PX - RUNNING_HEADER_HEIGHT_PX;
          const totalH = pageBlocks.reduce((acc, b) => acc + b.height, 0);

          if (pageBlocks.length > 1) {
            assert(
              totalH <= availH,
              `${fixture.id} page ${pIdx + 1} height (${totalH}px) <= available (${availH}px)`
            );
          }

          const lastBlock = pageBlocks[pageBlocks.length - 1];
          if (lastBlock && lastBlock.type === 'ex_title') {
            const origIdx = blocks.findIndex((b) => b.id === lastBlock.id);
            const nextBlock = blocks[origIdx + 1];
            const hasFollowup = nextBlock && (nextBlock.type === 'question' || nextBlock.type === 'pic_row');
            assert(
              !hasFollowup,
              `${fixture.id} page ${pIdx + 1} does not end with an orphaned exercise title`
            );
          }

          // Check footer stamp on every page
          const expectedFooter = `Seite ${pIdx + 1}/${pages.length} • ${WORKSHEET_BUILD_ID}`;
          assert(
            html.includes(expectedFooter),
            `${fixture.id} HTML includes footer "${expectedFooter}"`
          );
        });

        // Check no duplicate words inside Matching or Missing Letters
        if (data.matching) {
          const germans = data.matching.questions.map((q) => q.german.toLowerCase());
          assert(
            new Set(germans).size === germans.length,
            `${fixture.id} Matching has no duplicate German words`
          );
        }
        if (data.missingLetters) {
          const fullWords = data.missingLetters.map((q) => q.fullWord.toLowerCase());
          assert(
            new Set(fullWords).size === fullWords.length,
            `${fixture.id} Missing Letters has no duplicate words`
          );
        }
      }

      // Verify Student and Teacher versions have identical question order
      const studentData = buildWorksheetData(fixture, { questionsPerExercise: qCount, includeAnswerKey: false, variant: 1 });
      const teacherData = buildWorksheetData(fixture, { questionsPerExercise: qCount, includeAnswerKey: true, variant: 1 });
      assert(
        JSON.stringify(studentData.matching?.questions) === JSON.stringify(teacherData.matching?.questions),
        `${fixture.id} Student and Teacher versions have identical Matching question order`
      );
      assert(
        JSON.stringify(studentData.oddOneOut) === JSON.stringify(teacherData.oddOneOut),
        `${fixture.id} Student and Teacher versions have identical Odd-One-Out question order`
      );
    }
  }

  // -------------------------------------------------------------
  // 6. CSS Minimum Font Size & Fixed A4 Geometry Check (TASK 2)
  // -------------------------------------------------------------
  const css = getWorksheetCss();
  assert(css.includes('width: 794px !important'), 'CSS locks .page width to 794px');
  assert(css.includes('height: 1123px !important'), 'CSS locks .page height to 1123px');
  assert(css.includes('overflow: hidden !important'), 'CSS sets overflow: hidden on .page');

  const fontSizeMatches = Array.from(css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g));
  assert(fontSizeMatches.length > 0, 'CSS contains explicit px font sizes');
  fontSizeMatches.forEach((m) => {
    const px = parseFloat(m[1]);
    assert(px >= 12, `CSS font-size ${px}px is >= 12px minimum`);
  });

  // -------------------------------------------------------------
  // 7. Oversized Block Handling in paginateBlocks (No infinite loop)
  // -------------------------------------------------------------
  const oversizedBlocks: WorksheetBlock[] = [
    { id: 'h1', type: 'header', height: 160, html: '<div>Header</div>' },
    { id: 'huge', type: 'question', height: 1500, html: '<div>Oversized Block</div>' },
    { id: 'q2', type: 'question', height: 100, html: '<div>Normal Block</div>' }
  ];
  const oversizedPages = paginateBlocks(oversizedBlocks, 980, 44);
  assert(oversizedPages.length === 3, 'Oversized block is placed on its own page without infinite loop');

  // -------------------------------------------------------------
  // 8. Security: escapeHtml Verification
  // -------------------------------------------------------------
  const xssSet: LernstudioSet = {
    ...TINY_SET,
    title: '<script>alert("xss")</script>',
    items: TINY_SET.items.map((it) => ({
      ...it,
      german: `${it.german} <b>bold</b>`
    }))
  };
  const xssHtml = buildWorksheetHtml(xssSet);
  assert(!xssHtml.includes('<script>alert'), 'HTML escapes <script> tags in set title');
  assert(xssHtml.includes('&lt;script&gt;'), 'HTML encodes <script> as &lt;script&gt;');

  // -------------------------------------------------------------
  // 9. Rule-Based Conjugator & Sentence Rebuilder Verification
  // -------------------------------------------------------------
  assert(conjugateGermanVerb('gehen')?.du === 'gehst', 'Conjugates gehen');
  assert(conjugateGermanVerb('essen')?.du === 'isst', 'Conjugates essen');
  assert(conjugateGermanVerb('fahren')?.du === 'fährst', 'Conjugates fahren');
  assert(conjugateGermanVerb('arbeiten')?.du === 'arbeitest', 'Conjugates arbeiten');
  assert(conjugateGermanVerb('zwanzig') === null, 'Does not conjugate number word zwanzig as a verb');

  const rebuilt = rebuildSentence4Elements('Ahmed fährt morgen nach Berlin.');
  assert(rebuilt !== null && isSentence4ElementsValid('Ahmed fährt morgen nach Berlin.', rebuilt), 'Sentence 4 elements rebuilds validly');

  const promptOutput = generateLernstudioPrompt({
    topic: 'Schule',
    grade: 'الصف الثاني',
    level: 'A1',
    difficulty: 'easy',
    itemCount: 8,
    includeVerbConjugation: true
  });
  assert(promptOutput.includes('sentence4Elements'), 'AI Prompt includes sentence4Elements');

  const brokenSet: Partial<LernstudioSet> = {
    title: 'Broken Set',
    items: [
      { id: 'b1', german: 'Katze', arabic: 'قطة', exampleSentenceGerman: 'Die Katze schläft auf dem Sofa.', sentence4Elements: ['Wrong', 'Sentence', 'Block', 'Test'] }
    ]
  };
  const valRes = validateLernstudioSetForWorksheet(brokenSet);
  assert(valRes.repairedCount === 1, 'Auto-repaired mismatched sentence4Elements');

  console.log(`\nLernstudio Worksheet Test Suite (${WORKSHEET_BUILD_ID}): ${passed} passed, ${failed} failed.`);
  return { passed, failed, errors };
}

if (process.argv[1]?.endsWith('lernstudioWorksheet.test.ts')) {
  const result = runLernstudioWorksheetTests();
  if (result.failed > 0) {
    process.exit(1);
  }
}
