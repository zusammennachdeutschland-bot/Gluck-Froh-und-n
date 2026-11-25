import type {
  ExerciseSourceOrigin,
  GrammarContent,
  GrammarExample,
  GrammarExercise,
  GrammarExerciseType,
  GrammarPageImageRef,
  GrammarRule,
  LernstudioContentOrigin,
  LernstudioExercise,
  LernstudioSet,
  LernstudioSetKind
} from '../types/lernstudio.js';

export const VALID_GRAMMAR_EXERCISE_TYPES: readonly GrammarExerciseType[] = [
  'multiple_choice',
  'fill_blank',
  'correct_mistake',
  'choose_correct_sentence',
  'sentence_ordering',
  'short_answer'
];

export function isValidGrammarExerciseType(val: any): val is GrammarExerciseType {
  return VALID_GRAMMAR_EXERCISE_TYPES.includes(String(val || '').trim() as GrammarExerciseType);
}

/**
 * Checks whether a set carries structured grammar content or grammar exercises.
 */
export function hasGrammarContent(set?: Partial<LernstudioSet> | null): boolean {
  if (!set) return false;
  if (set.grammarContent) {
    const gc = set.grammarContent;
    if (
      (gc.rules && gc.rules.length > 0) ||
      (gc.examples && gc.examples.length > 0) ||
      (gc.exercises && gc.exercises.length > 0) ||
      Boolean(gc.explanationAr?.trim() || gc.explanationDe?.trim() || gc.explanationEn?.trim())
    ) {
      return true;
    }
  }
  if (
    Array.isArray(set.customExercises) &&
    set.customExercises.some((ex) => ex && isValidGrammarExerciseType(ex.type))
  ) {
    const hasNoItems = !Array.isArray(set.items) || set.items.length === 0;
    return set.setKind === 'grammar' || set.setKind === 'mixed' || hasNoItems;
  }
  return false;
}

export function isGrammarSet(set?: Partial<LernstudioSet> | null): boolean {
  if (!set) return false;
  if (set.setKind === 'grammar') return true;
  if (set.setKind === 'mixed' && hasGrammarContent(set)) return true;
  if (!set.setKind && hasGrammarContent(set) && (!Array.isArray(set.items) || set.items.length === 0)) {
    return true;
  }
  return false;
}

export function isPureGrammarSet(set?: Partial<LernstudioSet> | null): boolean {
  if (!set) return false;
  return set.setKind === 'grammar' && (!Array.isArray(set.items) || set.items.length === 0);
}

export function inferSetKind(set?: Partial<LernstudioSet> | null): LernstudioSetKind {
  if (!set) return 'vocab';
  if (set.setKind === 'verb_group') return 'verb_group';
  if (set.setKind === 'grammar') {
    if (Array.isArray(set.items) && set.items.length > 0 && hasGrammarContent(set)) {
      // Allow pure grammar sets that carry a small list of anchor items, OR keep explicit 'grammar' if items < 4
      return set.items.length >= 6 ? 'mixed' : 'grammar';
    }
    return 'grammar';
  }
  if (set.setKind === 'mixed') return 'mixed';
  const itemsCount = Array.isArray(set.items) ? set.items.length : 0;
  if (hasGrammarContent(set)) {
    return itemsCount > 0 ? 'mixed' : 'grammar';
  }
  return 'vocab';
}

export function normalizeGrammarRule(raw: any, index = 0): GrammarRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || raw.titleAr || raw.titleDe || raw.titleEn || `قاعدة ${index + 1}`).trim();
  const summaryAr = String(raw.summaryAr || raw.summary || raw.explanationAr || raw.explanation || '').trim();
  const summaryDe = raw.summaryDe ? String(raw.summaryDe).trim() : undefined;
  const summaryEn = raw.summaryEn ? String(raw.summaryEn).trim() : undefined;
  if (!title && !summaryAr && !summaryDe && !summaryEn) return null;

  let table: GrammarRule['table'] | undefined;
  if (
    raw.table &&
    typeof raw.table === 'object' &&
    Array.isArray(raw.table.headers) &&
    Array.isArray(raw.table.rows)
  ) {
    const headers = raw.table.headers.map((h: any) => String(h || '').trim());
    const rows = raw.table.rows
      .filter((r: any) => Array.isArray(r))
      .map((r: any[]) => r.map((cell) => String(cell ?? '').trim()));
    if (headers.length > 0 && rows.length > 0) {
      table = { headers, rows };
    }
  }

  return {
    id: String(raw.id || `rule_${index + 1}`).trim(),
    title,
    ...(raw.titleAr ? { titleAr: String(raw.titleAr).trim() } : {}),
    ...(raw.titleDe ? { titleDe: String(raw.titleDe).trim() } : {}),
    ...(raw.titleEn ? { titleEn: String(raw.titleEn).trim() } : {}),
    summaryAr: summaryAr || summaryDe || summaryEn || title,
    ...(summaryDe ? { summaryDe } : {}),
    ...(summaryEn ? { summaryEn } : {}),
    ...(raw.pattern ? { pattern: String(raw.pattern).trim() } : {}),
    ...(table ? { table } : {}),
    ...(raw.tipAr ? { tipAr: String(raw.tipAr).trim() } : {}),
    ...(raw.tipDe ? { tipDe: String(raw.tipDe).trim() } : {}),
    ...(raw.tipEn ? { tipEn: String(raw.tipEn).trim() } : {})
  };
}

export function normalizeGrammarExample(raw: any, index = 0): GrammarExample | null {
  if (!raw || typeof raw !== 'object') return null;
  const german = String(raw.german || raw.de || raw.sentence || '').trim();
  const arabic = String(raw.arabic || raw.ar || raw.translation || '').trim();
  if (!german) return null;

  return {
    id: String(raw.id || `gex_${index + 1}`).trim(),
    german,
    arabic: arabic || (raw.english ? String(raw.english).trim() : german),
    ...(raw.english ? { english: String(raw.english).trim() } : {}),
    ...(raw.highlight ? { highlight: String(raw.highlight).trim() } : {}),
    ...(raw.noteAr ? { noteAr: String(raw.noteAr).trim() } : {}),
    ...(raw.noteDe ? { noteDe: String(raw.noteDe).trim() } : {}),
    ...(raw.noteEn ? { noteEn: String(raw.noteEn).trim() } : {})
  };
}

export interface NormalizeGrammarOptions {
  allowAnswerless?: boolean;
}

/**
 * Deterministically scrambles sentence ordering tokens using an exercise seed,
 * guaranteeing that arrays of length >= 2 do not stay in the exact expected order.
 */
export function scrambleOrderingTokensDeterministic(
  tokens: string[],
  seedStr: string,
  forbiddenOrder?: string[]
): string[] {
  const clean = (Array.isArray(tokens) ? tokens : []).map((t) => String(t || '').trim()).filter(Boolean);
  if (clean.length <= 1) return clean;

  let hash = 2166136261;
  const s = `${seedStr}|${clean.join('|')}`;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const nextRand = () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return (hash >>> 0) / 4294967296;
  };

  const out = [...clean];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  const reference = forbiddenOrder && forbiddenOrder.length === out.length ? forbiddenOrder : clean;
  const matchesReference = out.every((tok, idx) => tok.toLowerCase() === reference[idx]?.toLowerCase());
  if (matchesReference) {
    const diffIdx = out.findIndex((tok, idx) => tok.toLowerCase() !== reference[0]?.toLowerCase() && idx > 0);
    const swapWith = diffIdx > 0 ? diffIdx : out.length - 1;
    [out[0], out[swapWith]] = [out[swapWith], out[0]];
  }
  return out;
}

export function normalizeGrammarExercise(
  raw: any,
  index = 0,
  defaultSource: ExerciseSourceOrigin = 'original',
  normalizeOptions?: NormalizeGrammarOptions
): GrammarExercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const allowAnswerless = Boolean(normalizeOptions?.allowAnswerless);
  const question = String(raw.question || raw.sentenceWithBlank || raw.faultySentence || raw.prompt || '').trim();
  const correctAnswer = String(raw.correctAnswer || '').trim();
  if (!question || (!correctAnswer && !allowAnswerless)) return null;

  const rawType = String(raw.type || '').trim();
  const type: GrammarExerciseType = isValidGrammarExerciseType(rawType)
    ? rawType
    : rawType === 'der_die_das' || rawType === 'plural_match'
    ? 'multiple_choice'
    : rawType === 'sentence_builder'
    ? 'sentence_ordering'
    : 'multiple_choice';

  let options: string[] | undefined = Array.isArray(raw.options)
    ? Array.from(new Set(raw.options.map((o: any) => String(o || '').trim()).filter(Boolean)))
    : undefined;

  if (
    correctAnswer &&
    (type === 'multiple_choice' || type === 'choose_correct_sentence') &&
    options &&
    options.length > 0
  ) {
    if (!options.some((o) => o.toLowerCase() === correctAnswer.toLowerCase())) {
      options = [correctAnswer, ...options];
    }
  }
  if (type === 'short_answer' && options && options.length === 0) {
    options = undefined;
  }

  let tokens: string[] | undefined = Array.isArray(raw.tokens)
    ? raw.tokens.map((t: any) => String(t || '').trim()).filter(Boolean)
    : undefined;
  if (type === 'sentence_ordering' && (!tokens || tokens.length < 2) && correctAnswer) {
    const splitTokens = correctAnswer.split(/\s+/).filter(Boolean);
    if (splitTokens.length >= 2) {
      tokens = [...splitTokens];
    }
  }

  const acceptedAnswers =
    correctAnswer && Array.isArray(raw.acceptedAnswers)
      ? Array.from(
          new Set(
            [correctAnswer, ...raw.acceptedAnswers.map((a: any) => String(a || '').trim())].filter(Boolean)
          )
        )
      : undefined;

  const source: ExerciseSourceOrigin =
    raw.source === 'generated' ? 'generated' : raw.source === 'original' ? 'original' : defaultSource;

  return {
    id: String(raw.id || `gexq_${Date.now()}_${index}`).trim(),
    type,
    ...(raw.prompt ? { prompt: String(raw.prompt).trim() } : {}),
    question,
    ...(raw.sentenceWithBlank ? { sentenceWithBlank: String(raw.sentenceWithBlank).trim() } : {}),
    ...(raw.faultySentence ? { faultySentence: String(raw.faultySentence).trim() } : {}),
    ...(tokens && tokens.length > 0 ? { tokens } : {}),
    ...(options && options.length > 0 ? { options } : {}),
    correctAnswer,
    ...(acceptedAnswers && acceptedAnswers.length > 1 ? { acceptedAnswers } : {}),
    ...(raw.explanation ? { explanation: String(raw.explanation).trim() } : {}),
    ...(raw.explanationAr ? { explanationAr: String(raw.explanationAr).trim() } : {}),
    ...(raw.explanationDe ? { explanationDe: String(raw.explanationDe).trim() } : {}),
    ...(raw.explanationEn ? { explanationEn: String(raw.explanationEn).trim() } : {}),
    ...(raw.ruleRef ? { ruleRef: String(raw.ruleRef).trim() } : {}),
    source,
    ...(raw.isUncertain ? { isUncertain: true } : {}),
    ...(raw.uncertaintyReason ? { uncertaintyReason: String(raw.uncertaintyReason).trim() } : {})
  };
}

export function normalizeGrammarContent(
  raw: any,
  fallbackTitle = 'درس قواعد',
  fallbackTopic = 'Grammatik',
  defaultOrigin: LernstudioContentOrigin = 'teacher_created',
  normalizeOptions?: NormalizeGrammarOptions
): GrammarContent | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const rules = Array.isArray(raw.rules)
    ? raw.rules.map((r: any, idx: number) => normalizeGrammarRule(r, idx)).filter((r): r is GrammarRule => Boolean(r))
    : [];
  const examples = Array.isArray(raw.examples)
    ? raw.examples
        .map((e: any, idx: number) => normalizeGrammarExample(e, idx))
        .filter((e): e is GrammarExample => Boolean(e))
    : [];
  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises
        .map((ex: any, idx: number) => normalizeGrammarExercise(ex, idx, 'original', normalizeOptions))
        .filter((ex): ex is GrammarExercise => Boolean(ex))
    : [];

  const pageImageRefs: GrammarPageImageRef[] | undefined = Array.isArray(raw.pageImageRefs)
    ? raw.pageImageRefs
        .filter((p: any) => p && typeof p === 'object' && p.id)
        .map((p: any, idx: number) => ({
          id: String(p.id).trim(),
          fileName: String(p.fileName || `page_${idx + 1}.jpg`).trim(),
          mimeType: String(p.mimeType || 'image/jpeg').trim(),
          ...(typeof p.sizeBytes === 'number' ? { sizeBytes: p.sizeBytes } : {}),
          ...(typeof p.width === 'number' ? { width: p.width } : {}),
          ...(typeof p.height === 'number' ? { height: p.height } : {}),
          pageOrder: Number.isFinite(Number(p.pageOrder)) ? Number(p.pageOrder) : idx + 1,
          ...(p.localStorageKey ? { localStorageKey: String(p.localStorageKey).trim() } : {}),
          ...(p.checksum ? { checksum: String(p.checksum).trim() } : {})
        }))
    : undefined;

  const origin: LernstudioContentOrigin =
    raw.origin === 'builtin' ? 'builtin' : raw.origin === 'teacher_created' ? 'teacher_created' : defaultOrigin;

  return {
    lessonTitle: String(raw.lessonTitle || raw.lessonTitleAr || raw.lessonTitleDe || fallbackTitle).trim(),
    ...(raw.lessonTitleAr ? { lessonTitleAr: String(raw.lessonTitleAr).trim() } : {}),
    ...(raw.lessonTitleDe ? { lessonTitleDe: String(raw.lessonTitleDe).trim() } : {}),
    ...(raw.lessonTitleEn ? { lessonTitleEn: String(raw.lessonTitleEn).trim() } : {}),
    grammarTopic: String(raw.grammarTopic || raw.grammarTopicDe || raw.grammarTopicAr || fallbackTopic).trim(),
    ...(raw.grammarTopicAr ? { grammarTopicAr: String(raw.grammarTopicAr).trim() } : {}),
    ...(raw.grammarTopicDe ? { grammarTopicDe: String(raw.grammarTopicDe).trim() } : {}),
    ...(raw.grammarTopicEn ? { grammarTopicEn: String(raw.grammarTopicEn).trim() } : {}),
    explanationAr: String(raw.explanationAr || raw.explanation || raw.explanationDe || raw.explanationEn || '').trim(),
    ...(raw.explanationDe ? { explanationDe: String(raw.explanationDe).trim() } : {}),
    ...(raw.explanationEn ? { explanationEn: String(raw.explanationEn).trim() } : {}),
    rules,
    examples,
    exercises,
    origin,
    ...(pageImageRefs && pageImageRefs.length > 0 ? { pageImageRefs } : {}),
    ...(raw.sourceBookInfo ? { sourceBookInfo: String(raw.sourceBookInfo).trim() } : {}),
    ...(raw.extractionConfidenceNote
      ? { extractionConfidenceNote: String(raw.extractionConfidenceNote).trim() }
      : {})
  };
}

/**
 * Non-destructively normalizes any LernstudioSet (including legacy vocab/verb sets).
 */
export function normalizeLernstudioSet(raw: any, normalizeOptions?: NormalizeGrammarOptions): LernstudioSet {
  const safeRaw = raw && typeof raw === 'object' ? raw : {};
  const title = String(safeRaw.title || 'مجموعة بدون اسم').trim();
  const topic = String(safeRaw.topic || safeRaw.category || 'Wortschatz').trim();
  const items = Array.isArray(safeRaw.items) ? safeRaw.items : [];
  const originDefault: LernstudioContentOrigin =
    String(safeRaw.id || '').startsWith('curric_') || safeRaw.contentOrigin === 'builtin'
      ? 'builtin'
      : 'teacher_created';

  const grammarContent = safeRaw.grammarContent
    ? normalizeGrammarContent(safeRaw.grammarContent, title, topic, originDefault, normalizeOptions)
    : undefined;

  const allowAnswerless = Boolean(normalizeOptions?.allowAnswerless);
  const customExercises: LernstudioExercise[] | undefined = Array.isArray(safeRaw.customExercises)
    ? safeRaw.customExercises.filter(
        (ex: any) => ex && typeof ex === 'object' && ex.question && (ex.correctAnswer || allowAnswerless)
      )
    : undefined;

  const candidate: LernstudioSet = {
    ...safeRaw,
    id: String(safeRaw.id || `set_${Date.now()}`),
    title,
    level: safeRaw.level || 'A1',
    topic,
    difficulty: safeRaw.difficulty || 'medium',
    items,
    ...(customExercises ? { customExercises } : {}),
    ...(grammarContent ? { grammarContent } : {}),
    contentOrigin: safeRaw.contentOrigin || originDefault,
    createdAt: safeRaw.createdAt || new Date().toISOString(),
    updatedAt: Number(safeRaw.updatedAt) || Date.now()
  };

  if (!candidate.setKind) {
    candidate.setKind = inferSetKind(candidate);
  }

  return candidate;
}

/**
 * Returns unified grammar exercises from both `set.grammarContent.exercises`
 * and grammar-compatible `set.customExercises`, deduplicated by id.
 */
export function getGrammarLessonExercises(
  set?: Partial<LernstudioSet> | null,
  normalizeOptions?: NormalizeGrammarOptions
): GrammarExercise[] {
  if (!set) return [];
  const results: GrammarExercise[] = [];
  const seenIds = new Set<string>();
  const allowAnswerless = Boolean(normalizeOptions?.allowAnswerless);

  if (set.grammarContent?.exercises && Array.isArray(set.grammarContent.exercises)) {
    set.grammarContent.exercises.forEach((ex, idx) => {
      const normalized = normalizeGrammarExercise(ex, idx, 'original', normalizeOptions);
      if (normalized && !seenIds.has(normalized.id)) {
        seenIds.add(normalized.id);
        results.push(normalized);
      }
    });
  }

  if (Array.isArray(set.customExercises)) {
    set.customExercises.forEach((ex, idx) => {
      if (!ex || !ex.question || (!ex.correctAnswer && !allowAnswerless)) return;
      if (seenIds.has(ex.id)) return;
      const isGrammarOrMc = isValidGrammarExerciseType(ex.type) || ex.type === 'sentence_builder';
      if (!isGrammarOrMc) return;
      const normalized = normalizeGrammarExercise(ex, idx, 'original', normalizeOptions);
      if (normalized && !seenIds.has(normalized.id)) {
        seenIds.add(normalized.id);
        results.push(normalized);
      }
    });
  }

  return results;
}

/**
 * Normalizes student & reference German answers for reliable comparison across exercises:
 * - trims outer whitespace
 * - collapses repeated internal whitespace
 * - unifies typographic quotes/apostrophes/dashes
 * - case-insensitive comparison
 * - optional trailing punctuation tolerance for typed/ordered answers
 */
export function normalizeGermanGrammarAnswer(
  value: string | undefined | null,
  options?: { ignoreTrailingPunctuation?: boolean }
): string {
  let s = String(value || '')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (options?.ignoreTrailingPunctuation !== false) {
    s = s.replace(/[.!?;:,]+$/g, '').trim();
  }
  return s.toLowerCase();
}

export function evaluateNormalizedGrammarAnswer(
  studentAnswer: string | undefined | null,
  expected: {
    correctAnswer: string;
    acceptedAnswers?: string[];
    ignoreTrailingPunctuation?: boolean;
  }
): boolean {
  const normStudent = normalizeGermanGrammarAnswer(studentAnswer, {
    ignoreTrailingPunctuation: expected.ignoreTrailingPunctuation
  });
  if (!normStudent) return false;

  const candidates = [expected.correctAnswer, ...(expected.acceptedAnswers || [])].filter(Boolean);
  for (const cand of candidates) {
    const normCand = normalizeGermanGrammarAnswer(cand, {
      ignoreTrailingPunctuation: expected.ignoreTrailingPunctuation
    });
    if (normCand && normStudent === normCand) {
      return true;
    }
  }
  return false;
}

export function getLocalizedGrammarField(
  obj: Record<string, any> | undefined | null,
  baseKey: string,
  language: string = 'ar'
): string {
  if (!obj) return '';
  const lang = (language || 'ar').toLowerCase();
  if (lang === 'de') {
    return String(obj[`${baseKey}De`] || obj[baseKey] || obj[`${baseKey}En`] || obj[`${baseKey}Ar`] || '').trim();
  }
  if (lang === 'en') {
    return String(obj[`${baseKey}En`] || obj[baseKey] || obj[`${baseKey}De`] || obj[`${baseKey}Ar`] || '').trim();
  }
  return String(obj[`${baseKey}Ar`] || obj[baseKey] || obj[`${baseKey}De`] || obj[`${baseKey}En`] || '').trim();
}

/**
 * Ensures any accidental base64 blobs on grammar set media/items are stripped before sync
 * while preserving lightweight `pageImageRefs` metadata and all rules/examples/exercises.
 */
export function stripHeavyGrammarMediaForSync<T extends Record<string, any>>(setObj: T): T {
  if (!setObj || typeof setObj !== 'object') return setObj;
  const copy: any = { ...setObj };
  if (Array.isArray(copy.items)) {
    copy.items = copy.items.map((item: any) => {
      if (!item || typeof item !== 'object') return item;
      const itemCopy = { ...item };
      for (const mediaKey of ['imageUrl', 'imageDataUrl', 'audioUrl', 'audioDataUrl', 'image']) {
        const val = itemCopy[mediaKey];
        if (typeof val === 'string' && (val.startsWith('data:') || val.length > 500)) {
          delete itemCopy[mediaKey];
        }
      }
      return itemCopy;
    });
  }
  if (copy.grammarContent && typeof copy.grammarContent === 'object') {
    const gcCopy = { ...copy.grammarContent };
    if (Array.isArray(gcCopy.pageImageRefs)) {
      gcCopy.pageImageRefs = gcCopy.pageImageRefs.map((ref: any) => {
        if (!ref || typeof ref !== 'object') return ref;
        const { base64Data: _b64, dataUrl: _du, ...rest } = ref;
        return rest;
      });
    }
    delete gcCopy.rawImages;
    delete gcCopy.uploadedImagesBase64;
    copy.grammarContent = gcCopy;
  }
  return copy;
}
