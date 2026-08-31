import { StudentSessionPerformance } from '../types';

export const arabicBaseMale = {
  excellent: [
    'أظهر مستوى ممتازًا واستيعابًا سريعًا لمحتوى الحصة',
    'كان أداؤه متميزًا طوال السيشن',
    'أظهر قدرة ممتازة على تطبيق ما تم شرحه',
    'كان أداؤه رائعًا ومثمرًا للغاية'
  ],
  very_good: [
    'أظهر أداءً جيدًا جدًا خلال الحصة',
    'كان أداؤه ثابتًا ومميزًا خلال السيشن',
    'تعامل بشكل جيد جدًا مع تدريبات الحصة'
  ],
  good: [
    'كان أداؤه جيدًا وشارك بشكل مناسب',
    'تمكن من متابعة معظم أنشطة الحصة بشكل جيد',
    'تعامل بشكل جيد مع التدريبات المطلوبة'
  ],
  developing: [
    'أظهر تقدمًا ملحوظًا لكنه لا يزال بحاجة إلى بعض الممارسة',
    'بدأ في فهم المحتوى بشكل أفضل ويحتاج إلى مزيد من التدريب',
    'تحسن أداؤه خلال الحصة مع وجود بعض النقاط التي تحتاج إلى المراجعة'
  ],
  needs_support: [
    'يحتاج الطالب إلى مزيد من الدعم والممارسة لتعزيز فهمه للمحتوى',
    'يحتاج إلى مزيد من التدريب على المهارات التي تم تناولها خلال الحصة',
    'سيستفيد من مراجعة بعض النقاط والتدريب عليها بشكل إضافي'
  ]
};

export const arabicBaseFemale = {
  excellent: [
    'أظهرت مستوى ممتازًا واستيعابًا سريعًا لمحتوى الحصة',
    'كان أداؤها متميزًا طوال السيشن',
    'أظهرت قدرة ممتازة على تطبيق ما تم شرحه',
    'كان أداؤها رائعًا ومثمرًا للغاية'
  ],
  very_good: [
    'أظهرت أداءً جيدًا جدًا خلال الحصة',
    'كان أداؤها ثابتًا ومميزًا خلال السيشن',
    'تعاملت بشكل جيد جدًا مع تدريبات الحصة'
  ],
  good: [
    'كان أداؤها جيدًا وشاركت بشكل مناسب',
    'تمكنت من متابعة معظم أنشطة الحصة بشكل جيد',
    'تعاملت بشكل جيد مع التدريبات المطلوبة'
  ],
  developing: [
    'أظهرت تقدمًا ملحوظًا لكنها لا تزال بحاجة إلى بعض الممارسة',
    'بدأت في فهم المحتوى بشكل أفضل وتحتاج إلى مزيد من التدريب',
    'تحسن أداؤها خلال الحصة مع وجود بعض النقاط التي تحتاج إلى المراجعة'
  ],
  needs_support: [
    'تحتاج الطالبة إلى مزيد من الدعم والممارسة لتعزيز فهمها للمحتوى',
    'تحتاج إلى مزيد من التدريب على المهارات التي تم تناولها خلال الحصة',
    'ستستفيد من مراجعة بعض النقاط والتدريب عليها بشكل إضافي'
  ]
};

export const arabicParticipationMale = {
  active: ['وكان متفاعلًا بشكل واضح مع الأنشطة', 'وشارك بفعالية كبيرة', 'مع مشاركة نشطة وإيجابية'],
  good: ['وكان متفاعلًا بشكل جيد', 'وشارك بشكل مناسب', 'مع تفاعل جيد في الأنشطة'],
  quiet: ['لكنه كان هادئًا بعض الشيء', 'ومشاركته كانت محدودة', 'رغم قلة تفاعله في النقاشات'],
  needs_encouragement: ['ويحتاج لمزيد من التشجيع للمشاركة', 'وننصح بتشجيعه على التفاعل أكثر', 'ونأمل رؤية تفاعل أكبر منه مستقبلًا']
};

export const arabicParticipationFemale = {
  active: ['وكانت متفاعلة بشكل واضح مع الأنشطة', 'وشاركت بفعالية كبيرة', 'مع مشاركة نشطة وإيجابية'],
  good: ['وكانت متفاعلة بشكل جيد', 'وشاركت بشكل مناسب', 'مع تفاعل جيد في الأنشطة'],
  quiet: ['لكنها كانت هادئة بعض الشيء', 'ومشاركتها كانت محدودة', 'رغم قلة تفاعلها في النقاشات'],
  needs_encouragement: ['وتحتاج لمزيد من التشجيع للمشاركة', 'وننصح بتشجيعها على التفاعل أكثر', 'ونأمل رؤية تفاعل أكبر منها مستقبلًا']
};

export const arabicUnderstandingMale = {
  excellent: ['كما أظهر فهمًا ممتازًا للمحتوى', 'واستيعابًا كاملًا للمفاهيم'],
  good: ['كما أظهر فهمًا جيدًا للمحتوى', 'واستيعابًا جيدًا للدرس'],
  developing: ['وأظهر استيعابًا مقبولًا مع الحاجة لمراجعة بعض المفاهيم', 'وبدأ في فهم المادة بشكل أفضل'],
  needs_review: ['ويحتاج إلى مراجعة بعض المفاهيم الأساسية', 'وننصح بالتركيز أكثر على استيعاب الدروس']
};

export const arabicUnderstandingFemale = {
  excellent: ['كما أظهرت فهمًا ممتازًا للمحتوى', 'واستيعابًا كاملًا للمفاهيم'],
  good: ['كما أظهرت فهمًا جيدًا للمحتوى', 'واستيعابًا جيدًا للدرس'],
  developing: ['وأظهرت استيعابًا مقبولًا مع الحاجة لمراجعة بعض المفاهيم', 'وبدأت في فهم المادة بشكل أفضل'],
  needs_review: ['وتحتاج إلى مراجعة بعض المفاهيم الأساسية', 'وننصح بالتركيز أكثر على استيعاب الدروس']
};

export const arabicSpeakingMale = {
  confident: ['وثقة عالية أثناء التحدث', 'ومهارة تحدث بثقة وطلاقة'],
  good: ['ومهارة تحدث جيدة', 'وثقة مناسبة أثناء التحدث'],
  improving: ['مع تحسن ملحوظ في التحدث', 'وبداية جيدة في مهارات المحادثة'],
  needs_practice: ['مع الحاجة لمزيد من الممارسة في التحدث', 'وننصح بزيادة التدريب على المحادثة']
};

export const arabicSpeakingFemale = {
  confident: ['وثقة عالية أثناء التحدث', 'ومهارة تحدث بثقة وطلاقة'],
  good: ['ومهارة تحدث جيدة', 'وثقة مناسبة أثناء التحدث'],
  improving: ['مع تحسن ملحوظ في التحدث', 'وبداية جيدة في مهارات المحادثة'],
  needs_practice: ['مع الحاجة لمزيد من الممارسة في التحدث', 'وننصح بزيادة التدريب على المحادثة']
};

export const arabicFocusMale = {
  excellent: ['بتركيز ممتاز طوال الوقت', 'وانتباه كامل خلال الحصة'],
  good: ['بتركيز وانتباه جيدين', 'مع تركيز جيد خلال الدرس'],
  sometimes_distracted: ['رغم بعض التشتت أحيانًا', 'مع ملاحظة قلة التركيز في بعض الأوقات'],
  needs_more_focus: ['ويحتاج إلى تركيز أكبر خلال الشرح', 'وننصح بزيادة التركيز لتجنب التشتت']
};

export const arabicFocusFemale = {
  excellent: ['بتركيز ممتاز طوال الوقت', 'وانتباه كامل خلال الحصة'],
  good: ['بتركيز وانتباه جيدين', 'مع تركيز جيد خلال الدرس'],
  sometimes_distracted: ['رغم بعض التشتت أحيانًا', 'مع ملاحظة قلة التركيز في بعض الأوقات'],
  needs_more_focus: ['وتحتاج إلى تركيز أكبر خلال الشرح', 'وننصح بزيادة التركيز لتجنب التشتت']
};

export const arabicProgressMale = {
  improved: ['مع تحسن ملحوظ مقارنة بالحصة السابقة.', 'محققًا تقدمًا رائعًا عن المرة الماضية.', 'ونلاحظ تطورًا إيجابيًا في مستواه.'],
  stable: ['مع الحفاظ على استقرار مستواه.', 'مستمرًا في تقديم أداء ثابت.'],
  needs_attention: ['ونأمل التركيز أكثر لتحقيق نتائج أفضل مستقبلًا.', 'ونحتاج إلى العمل معًا لتحسين الأداء القادم.']
};

export const arabicProgressFemale = {
  improved: ['مع تحسن ملحوظ مقارنة بالحصة السابقة.', 'محققة تقدمًا رائعًا عن المرة الماضية.', 'ونلاحظ تطورًا إيجابيًا في مستواها.'],
  stable: ['مع الحفاظ على استقرار مستواها.', 'مستمرة في تقديم أداء ثابت.'],
  needs_attention: ['ونأمل التركيز أكثر لتحقيق نتائج أفضل مستقبلًا.', 'ونحتاج إلى العمل معًا لتحسين الأداء القادم.']
};

const germanBase = {
  excellent: ['zeigte heute eine hervorragende Leistung', 'hat den Unterrichtsstoff sehr schnell verstanden', 'hat heute ausgezeichnet mitgearbeitet'],
  very_good: ['zeigte heute eine sehr gute Leistung', 'hat sehr gut gearbeitet', 'zeigte durchgehend sehr gute Ergebnisse'],
  good: ['zeigte heute eine gute Leistung', 'hat gut mitgemacht', 'konnte dem Unterricht gut folgen'],
  developing: ['macht gute Fortschritte, braucht aber noch etwas Übung', 'beginnt den Stoff besser zu verstehen'],
  needs_support: ['braucht noch etwas Unterstützung und Übung', 'sollte die heutigen Themen noch einmal wiederholen']
};

const germanParticipation = {
  active: ['und beteiligte sich aktiv am Unterricht', 'und war sehr engagiert'],
  good: ['und machte gut mit', 'und beteiligte sich angemessen'],
  quiet: ['war aber etwas ruhig', 'beteiligte sich jedoch eher zurückhaltend'],
  needs_encouragement: ['und braucht noch etwas Ermutigung, sich mehr zu beteiligen', 'und sollte ermutigt werden, mehr mitzumachen']
};

const germanUnderstanding = {
  excellent: ['Das Verständnis der Themen war exzellent', 'Die Konzepte wurden vollständig verstanden'],
  good: ['Das Verständnis war gut', 'Die Inhalte wurden gut verstanden'],
  developing: ['Das Verständnis entwickelt sich gut', 'Einige Themen sollten noch wiederholt werden'],
  needs_review: ['Einige grundlegende Konzepte müssen noch wiederholt werden', 'Es gibt noch Nachholbedarf beim Verständnis']
};

const germanSpeaking = {
  confident: ['Zudem wurde sehr selbstbewusst gesprochen', 'Das Sprechen fiel leicht und flüssig'],
  good: ['Das Sprechen war gut', 'Gute Ausdrucksweise beim Sprechen'],
  improving: ['Es gab merkliche Fortschritte beim Sprechen', 'Das Sprechen verbessert sich'],
  needs_practice: ['Beim Sprechen ist noch mehr Übung nötig', 'Das freie Sprechen sollte weiter geübt werden']
};

const germanFocus = {
  excellent: ['Die Konzentration war durchgehend hervorragend.', 'Sehr aufmerksam und fokussiert.'],
  good: ['Die Konzentration war gut.', 'Aufmerksam während des Unterrichts.'],
  sometimes_distracted: ['Manchmal gab es leichte Ablenkungen.', 'Die Konzentration ließ gelegentlich nach.'],
  needs_more_focus: ['Es wird mehr Fokus während des Unterrichts benötigt.', 'Mehr Aufmerksamkeit ist empfehlenswert.']
};

const germanProgress = {
  improved: ['Im Vergleich zur letzten Stunde gab es eine deutliche Verbesserung.', 'Tolle Fortschritte gemacht!'],
  stable: ['Das Leistungsniveau ist weiterhin stabil.', 'Macht kontinuierlich weiter so.'],
  needs_attention: ['Wir sollten in Zukunft noch mehr darauf achten, sich zu verbessern.', 'Hier ist noch etwas mehr Einsatz gefragt.']
};

const englishBase = {
  excellent: ['showed excellent performance today', 'grasped the lesson content very quickly', 'did an outstanding job throughout the session'],
  very_good: ['showed very good performance today', 'worked very well', 'showed consistently great results'],
  good: ['showed good performance today', 'did a good job', 'was able to follow the lesson well'],
  developing: ['is making noticeable progress but needs some practice', 'is starting to understand the content better'],
  needs_support: ['needs more support and practice to fully grasp the concepts', 'would benefit from reviewing today’s topics']
};

const englishParticipation = {
  active: ['and participated actively in the activities', 'and was highly engaged'],
  good: ['and participated well', 'and had good involvement'],
  quiet: ['but was a bit quiet', 'but participation was somewhat limited'],
  needs_encouragement: ['and needs some encouragement to participate more', 'and we hope to see more engagement next time']
};

const englishUnderstanding = {
  excellent: ['showing excellent understanding of the material', 'with complete comprehension of the concepts'],
  good: ['showing good understanding of the content', 'with a solid grasp of the lesson'],
  developing: ['with an acceptable understanding, though some review is needed', 'beginning to understand the concepts better'],
  needs_review: ['but needs to review some fundamental concepts', 'and we recommend focusing more on comprehension']
};

const englishSpeaking = {
  confident: ['and spoke with high confidence', 'showing fluent speaking skills'],
  good: ['and spoke well', 'showing good speaking skills'],
  improving: ['with noticeable improvement in speaking', 'showing progress in conversation'],
  needs_practice: ['but needs more practice with speaking', 'and we recommend practicing speaking more']
};

const englishFocus = {
  excellent: ['Maintaining excellent focus throughout.', 'With complete attention during the lesson.'],
  good: ['Maintaining good focus.', 'With good attention.'],
  sometimes_distracted: ['Despite being occasionally distracted.', 'Though focus was lost at times.'],
  needs_more_focus: ['Needs to focus more during explanations.', 'We recommend paying more attention to avoid distractions.']
};

const englishProgress = {
  improved: ['Showing noticeable improvement compared to the last session.', 'Making great progress!'],
  stable: ['Maintaining a stable performance level.', 'Keeping up the consistent work.'],
  needs_attention: ['We hope to see better focus for improved results next time.', 'Requires a bit more effort moving forward.']
};

function pick<T>(arr: T[], avoidIndex?: number): { item: T; index: number } {
  if (!arr || arr.length === 0) return { item: '' as any, index: -1 };
  let pool = arr;
  if (avoidIndex !== undefined && avoidIndex >= 0 && avoidIndex < arr.length && arr.length > 1) {
    pool = arr.filter((_, i) => i !== avoidIndex);
  }
  const randomIdx = Math.floor(Math.random() * pool.length);
  const chosen = pool[randomIdx];
  return { item: chosen, index: arr.indexOf(chosen) };
}

/**
 * Converts Arabic feedback sentences between masculine and feminine phrasing accurately.
 */
export function convertArabicFeedbackGender(text: string, toGender: 'male' | 'female'): string {
  if (!text) return '';
  if (toGender === 'female') {
    return text
      .replace(/\bأظهر\b/g, 'أظهرت')
      .replace(/\bكان أداؤه\b/g, 'كان أداؤها')
      .replace(/\bأداؤه\b/g, 'أداؤها')
      .replace(/\bتعامل\b/g, 'تعاملت')
      .replace(/\bوشارك\b/g, 'وشاركت')
      .replace(/\bشارك\b/g, 'شاركت')
      .replace(/\bتمكن\b/g, 'تمكنت')
      .replace(/\bلكنه كان هادئًا\b/g, 'لكنها كانت هادئة')
      .replace(/\bلكنه كان هادئا\b/g, 'لكنها كانت هادئة')
      .replace(/\bوكان متفاعلًا\b/g, 'وكانت متفاعلة')
      .replace(/\bوكان متفاعلا\b/g, 'وكانت متفاعلة')
      .replace(/\bمتفاعلًا\b/g, 'متفاعلة')
      .replace(/\bمتفاعلا\b/g, 'متفاعلة')
      .replace(/\bهادئًا\b/g, 'هادئة')
      .replace(/\bهادئا\b/g, 'هادئة')
      .replace(/\bلكنه\b/g, 'لكنها')
      .replace(/\bبدأ\b/g, 'بدأت')
      .replace(/\bوبدأ\b/g, 'وبدأت')
      .replace(/\bيحتاج الطالب\b/g, 'تحتاج الطالبة')
      .replace(/\bيحتاج\b/g, 'تحتاج')
      .replace(/\bويحتاج\b/g, 'وتحتاج')
      .replace(/\bالطالب\b/g, 'الطالبة')
      .replace(/\bفهمه\b/g, 'فهمها')
      .replace(/\bسيستفيد\b/g, 'ستستفيد')
      .replace(/\bمشاركته\b/g, 'مشاركتها')
      .replace(/\bتفاعله\b/g, 'تفاعلها')
      .replace(/\bاستيعابه\b/g, 'استيعابها')
      .replace(/\bبتشجيعه\b/g, 'بتشجيعها')
      .replace(/\bمنه\b/g, 'منها')
      .replace(/\bمحققًا\b/g, 'محققة')
      .replace(/\bمحققا\b/g, 'محققة')
      .replace(/\bمستواه\b/g, 'مستواها')
      .replace(/\bمستمرًا\b/g, 'مستمرة')
      .replace(/\bمستمرا\b/g, 'مستمرة');
  } else {
    return text
      .replace(/\bأظهرت\b/g, 'أظهر')
      .replace(/\bكان أداؤها\b/g, 'كان أداؤه')
      .replace(/\bأداؤها\b/g, 'أداؤه')
      .replace(/\bتعاملت\b/g, 'تعامل')
      .replace(/\bوشاركت\b/g, 'وشارك')
      .replace(/\bشاركت\b/g, 'شارك')
      .replace(/\bتمكنت\b/g, 'تمكن')
      .replace(/\bلكنها كانت هادئة\b/g, 'لكنه كان هادئًا')
      .replace(/\bوكانت متفاعلة\b/g, 'وكان متفاعلًا')
      .replace(/\bمتفاعلة\b/g, 'متفاعلًا')
      .replace(/\bهادئة\b/g, 'هادئًا')
      .replace(/\bلكنها\b/g, 'لكنه')
      .replace(/\bبدأت\b/g, 'بدأ')
      .replace(/\bوبدأت\b/g, 'وبدأ')
      .replace(/\bتحتاج الطالبة\b/g, 'يحتاج الطالب')
      .replace(/\bتحتاج\b/g, 'يحتاج')
      .replace(/\bوتحتاج\b/g, 'ويحتاج')
      .replace(/\bالطالبة\b/g, 'الطالب')
      .replace(/\bفهمها\b/g, 'فهمه')
      .replace(/\bستستفيد\b/g, 'سيستفيد')
      .replace(/\bمشاركتها\b/g, 'مشاركته')
      .replace(/\bتفاعلها\b/g, 'تفاعله')
      .replace(/\bاستيعابها\b/g, 'استيعابه')
      .replace(/\bبتشجيعها\b/g, 'بتشجيعه')
      .replace(/\bمنها\b/g, 'منه')
      .replace(/\bمحققة\b/g, 'محققًا')
      .replace(/\bمستواها\b/g, 'مستواه')
      .replace(/\bمستمرة\b/g, 'مستمرًا');
  }
}

export const generateFeedback = (
  performance: StudentSessionPerformance,
  language: 'ar' | 'en' | 'de' = 'ar',
  avoidVariantId?: string,
  gender: 'male' | 'female' = performance.gender || 'male'
): { feedback: { short: string; parent: string; detailed: string }; variantId: string } => {
  const prevIndices = avoidVariantId ? avoidVariantId.split('-').map(Number) : [];

  let bases: Record<string, string[]>;
  let parts: Record<string, string[]>;
  let unders: Record<string, string[]>;
  let speaks: Record<string, string[]>;
  let focus: Record<string, string[]>;
  let progs: Record<string, string[]>;

  if (language === 'de') {
    bases = germanBase;
    parts = germanParticipation;
    unders = germanUnderstanding;
    speaks = germanSpeaking;
    focus = germanFocus;
    progs = germanProgress;
  } else if (language === 'en') {
    bases = englishBase;
    parts = englishParticipation;
    unders = englishUnderstanding;
    speaks = englishSpeaking;
    focus = englishFocus;
    progs = englishProgress;
  } else {
    // Arabic: choose gender-specific dictionary
    if (gender === 'female') {
      bases = arabicBaseFemale;
      parts = arabicParticipationFemale;
      unders = arabicUnderstandingFemale;
      speaks = arabicSpeakingFemale;
      focus = arabicFocusFemale;
      progs = arabicProgressFemale;
    } else {
      bases = arabicBaseMale;
      parts = arabicParticipationMale;
      unders = arabicUnderstandingMale;
      speaks = arabicSpeakingMale;
      focus = arabicFocusMale;
      progs = arabicProgressMale;
    }
  }

  const baseOpts = bases[performance.level || 'good'] || [];
  const partOpts = performance.participation ? parts[performance.participation] || [] : [];
  const underOpts = performance.understanding ? unders[performance.understanding] || [] : [];
  const speakOpts = performance.speaking ? speaks[performance.speaking] || [] : [];
  const focusOpts = performance.focus ? focus[performance.focus] || [] : [];
  const progOpts = performance.progress ? progs[performance.progress] || [] : [];

  const b = pick(baseOpts, prevIndices[0]);
  const p = pick(partOpts, prevIndices[1]);
  const u = pick(underOpts, prevIndices[2]);
  const s = pick(speakOpts, prevIndices[3]);
  const f = pick(focusOpts, prevIndices[4]);
  const pr = pick(progOpts, prevIndices[5]);

  const newVariantId = `${b.index}-${p.index}-${u.index}-${s.index}-${f.index}-${pr.index}`;

  const parentParts: string[] = [];
  if (b.item) parentParts.push(b.item);
  if (p.item) parentParts.push(p.item);
  if (u.item) parentParts.push(u.item);
  if (s.item) parentParts.push(s.item);

  let parentText = parentParts.join(language === 'ar' ? '، ' : ' ');
  if (pr.item) {
    parentText += ' ' + pr.item;
  }

  let detailedText = parentText;
  if (f.item) {
    detailedText += ' ' + f.item;
  }

  let shortText = '';
  if (language === 'ar') {
    const levelLabel =
      performance.level === 'excellent'
        ? 'ممتاز'
        : performance.level === 'very_good'
        ? 'جيد جداً'
        : performance.level === 'good'
        ? 'جيد'
        : 'بحاجة لتدريب';
    shortText = `أداء ${levelLabel} اليوم. 👍`;
  } else if (language === 'de') {
    shortText = `Heute eine ${
      performance.level === 'excellent'
        ? 'hervorragende'
        : performance.level === 'very_good'
        ? 'sehr gute'
        : performance.level === 'good'
        ? 'gute'
        : 'entwicklungsfähige'
    } Leistung! 👍`;
  } else {
    shortText = `${
      performance.level === 'excellent'
        ? 'Excellent'
        : performance.level === 'very_good'
        ? 'Very good'
        : performance.level === 'good'
        ? 'Good'
        : 'Developing'
    } performance today! 👍`;
  }

  return {
    feedback: {
      short: shortText,
      parent: parentText.trim(),
      detailed: detailedText.trim()
    },
    variantId: newVariantId
  };
};
