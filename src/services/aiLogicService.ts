/**
 * Firebase AI Logic client for photo-to-set extraction (Lernstudio).
 *
 * Single-user design (Abdo only): the app signs in with Google via Firebase
 * Auth on project `glueck-c8621` and calls Gemini through Firebase AI Logic
 * with the Gemini Developer API provider — NO API key ships in the app or APK.
 *
 * This is the ONE place that knows about `firebase/ai` and App Check.
 * `firebaseCloudSync.ts` is intentionally untouched (do not break working code):
 * App Check is initialised lazily here, on first use, from the already
 * initialised default Firebase app (`getApp()`), before the first `getAI()`.
 *
 * Model IDs verified against the Firebase AI Logic model list (late Nov 2026):
 * primary `gemini-3.5-flash-lite`, fallback `gemini-3.8-flash`.
 * No other model ID is hardcoded anywhere in this file.
 *
 * Console setup the USER must still do (cannot be done in code):
 *  1. Firebase Console -> project glueck-c8621 -> AI Services -> AI Logic
 *     -> Get started -> provider "Gemini Developer API" (NOT Agent Platform).
 *  2. Enable App Check with a reCAPTCHA Enterprise site key restricted to
 *     the Vercel domain, and put it in VITE_RECAPTCHA_ENTERPRISE_SITE_KEY.
 *  3. Check the project's actual rate limits in AI Studio -> Rate limits.
 * Without step 2 every call fails with 403; without step 1 it fails outright.
 * In both cases the modal shows an honest Arabic message + manual fallback,
 * never a silent failure and never an endless spinner.
 */
import { getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema,
  type GenerativeModel
} from 'firebase/ai';
import type { LernstudioDifficulty, LernstudioLevel, LernstudioSet, LernstudioSetKind } from '../types/lernstudio';
import { validateAndParseLernstudioJson } from '../shared/lernstudioAiUtils';
import { normalizeLernstudioSet, stripHeavyGrammarMediaForSync } from '../shared/grammarEngine';

// ---------------------------------------------------------------------------
// Model IDs (verified for Firebase AI Logic, late Nov 2026)
// ---------------------------------------------------------------------------

/** Primary model: best free quota (~500 requests/day per Oct 2026 readings). */
export const AI_LOGIC_PRIMARY_MODEL = 'gemini-3.5-flash-lite';
/** Fallback model: used only when the primary model ID is not found (404). */
export const AI_LOGIC_FALLBACK_MODEL = 'gemini-3.8-flash';

/** Optional override, e.g. VITE_GEMINI_GRAMMAR_MODEL="gemini-3.5-flash-lite". */
function readViteEnv(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> } | undefined)
      ?.env;
    const value = env?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function resolveAiLogicModelId(): string {
  return readViteEnv('VITE_GEMINI_GRAMMAR_MODEL') || AI_LOGIC_PRIMARY_MODEL;
}

// ---------------------------------------------------------------------------
// Arabic user-facing messages (single source of truth, also used by tests)
// ---------------------------------------------------------------------------

export const AI_QUOTA_AR =
  'وصلت للحد اليومي المجاني — جرّب تاني بعد منتصف الليل بتوقيت المحيط الهادئ، أو استخدم لصق الكود اليدوي.';
export const AI_APPCHECK_AR =
  'فشل التحقق الأمني (App Check) — تأكد من إعداد App Check في Firebase Console ثم حاول مجدداً.';
export const AI_NOT_CONFIGURED_AR =
  'خدمة الاستخراج التلقائي غير مفعّلة بعد — يلزم إعداد App Check (مفتاح reCAPTCHA) في التطبيق وFirebase Console. يمكنك استخدام لصق الكود اليدوي الآن.';
export const AI_PARSE_AR =
  'تعذّر فهم نتيجة الذكاء الاصطناعي — حاول مرة أخرى أو استخدم لصق الكود اليدوي.';
export const AI_TIMEOUT_AR =
  'انتهت مهلة الاستخراج — تحقق من الاتصال وحاول مرة أخرى، أو استخدم لصق الكود اليدوي.';

// ---------------------------------------------------------------------------
// Typed errors — the modal maps these to Arabic messages, never raw text
// ---------------------------------------------------------------------------

export class AiLogicQuotaError extends Error {
  constructor() {
    super(AI_QUOTA_AR);
    this.name = 'AiLogicQuotaError';
  }
}
export class AiLogicAppCheckError extends Error {
  constructor() {
    super(AI_APPCHECK_AR);
    this.name = 'AiLogicAppCheckError';
  }
}
export class AiLogicNotConfiguredError extends Error {
  constructor() {
    super(AI_NOT_CONFIGURED_AR);
    this.name = 'AiLogicNotConfiguredError';
  }
}
export class AiLogicParseError extends Error {
  constructor() {
    super(AI_PARSE_AR);
    this.name = 'AiLogicParseError';
  }
}
export class AiLogicTimeoutError extends Error {
  constructor() {
    super(AI_TIMEOUT_AR);
    this.name = 'AiLogicTimeoutError';
  }
}

export type AiLogicErrorKind = 'quota' | 'appcheck' | 'not-found' | 'not-configured' | 'unknown';

/** Classify a raw Firebase AI / Gemini error without leaking technical detail. */
export function classifyAiLogicError(error: unknown): AiLogicErrorKind {
  if (error instanceof AiLogicQuotaError) return 'quota';
  if (error instanceof AiLogicAppCheckError) return 'appcheck';
  if (error instanceof AiLogicNotConfiguredError) return 'not-configured';
  const code = typeof (error as any)?.code === 'string' ? (error as any).code.toLowerCase() : '';
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  const message = String((error as any)?.message || '').toLowerCase();
  const haystack = `${code} ${message}`;
  if (
    status === 429 ||
    haystack.includes('429') ||
    haystack.includes('quota') ||
    haystack.includes('resource-exhausted') ||
    haystack.includes('resource_exhausted') ||
    haystack.includes('rate limit') ||
    haystack.includes('rate-limit')
  ) {
    return 'quota';
  }
  if (
    status === 403 ||
    haystack.includes('403') ||
    haystack.includes('app-check') ||
    haystack.includes('appcheck') ||
    haystack.includes('app_check') ||
    haystack.includes('permission-denied') ||
    haystack.includes('permission_denied')
  ) {
    return 'appcheck';
  }
  if (
    status === 404 ||
    haystack.includes('404') ||
    haystack.includes('not found') ||
    haystack.includes('not-found') ||
    haystack.includes('model_not_found') ||
    haystack.includes('model is not found')
  ) {
    return 'not-found';
  }
  return 'unknown';
}

export function isAiLogicQuotaError(error: unknown): boolean {
  return classifyAiLogicError(error) === 'quota';
}
export function isAiLogicAppCheckError(error: unknown): boolean {
  return classifyAiLogicError(error) === 'appcheck';
}
export function isAiLogicNotConfiguredError(error: unknown): boolean {
  return classifyAiLogicError(error) === 'not-configured';
}

// ---------------------------------------------------------------------------
// App Check + AI client
// ---------------------------------------------------------------------------

let appCheckState: 'idle' | 'done' = 'idle';

/** True when a reCAPTCHA Enterprise site key is configured (no throw). */
export function isAiLogicConfigured(): boolean {
  return Boolean(readViteEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'));
}

/**
 * Initialise App Check once, lazily, before the first AI call.
 * The site key comes ONLY from env (VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) —
 * never hardcoded. Without a key we throw AiLogicNotConfiguredError so the
 * UI can show a clear Arabic message instead of crashing.
 * In DEV, a VITE_APPCHECK_DEBUG_TOKEN (if set) is registered as the
 * Firebase App Check debug token — localhost only, never in production.
 */
export function ensureAppCheck(): void {
  if (appCheckState === 'done') return;
  const siteKey = readViteEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY');
  if (!siteKey) {
    throw new AiLogicNotConfiguredError();
  }
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) {
      const debugToken = readViteEnv('VITE_APPCHECK_DEBUG_TOKEN');
      if (debugToken && typeof self !== 'undefined') {
        (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
      }
    }
    initializeAppCheck(getApp(), {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
    appCheckState = 'done';
  } catch (err) {
    // initializeAppCheck throws if called twice in the same session; the
    // flag above normally prevents that, but treat it as initialised.
    if (String((err as any)?.message || '').toLowerCase().includes('already')) {
      appCheckState = 'done';
      return;
    }
    throw err;
  }
}

// Response schema matching LernstudioSet (fields the model should produce).
// Kept deliberately to what the model generates; ids/timestamps are added
// locally afterwards by normalizeLernstudioSet().
const LERNSTUDIO_SET_RESPONSE_SCHEMA = Schema.object({
  properties: {
    title: Schema.string({ description: 'Lesson/set title, preferably German' }),
    topic: Schema.string({ description: 'Lesson topic in German or Arabic' }),
    level: Schema.enumString({ enum: ['A1', 'A2', 'B1', 'B2', 'C1'] }),
    difficulty: Schema.enumString({ enum: ['easy', 'medium', 'hard'] }),
    setKind: Schema.enumString({ enum: ['vocab', 'verb_group', 'grammar', 'mixed'] }),
    items: Schema.array({
      items: Schema.object({
        properties: {
          german: Schema.string(),
          arabic: Schema.string(),
          article: Schema.enumString({ enum: ['der', 'die', 'das'] }),
          plural: Schema.string(),
          wordType: Schema.enumString({ enum: ['noun', 'verb', 'adjective', 'phrase', 'other'] }),
          exampleSentenceGerman: Schema.string(),
          exampleSentenceArabic: Schema.string()
        },
        optionalProperties: ['article', 'plural', 'wordType', 'exampleSentenceGerman', 'exampleSentenceArabic']
      })
    }),
    grammarContent: Schema.object({
      properties: {
        lessonTitle: Schema.string(),
        grammarTopic: Schema.string(),
        explanationAr: Schema.string(),
        explanationDe: Schema.string(),
        rules: Schema.array({
          items: Schema.object({
            properties: {
              title: Schema.string(),
              pattern: Schema.string(),
              summaryAr: Schema.string()
            },
            optionalProperties: ['pattern', 'summaryAr']
          })
        }),
        examples: Schema.array({
          items: Schema.object({
            properties: { german: Schema.string(), arabic: Schema.string() }
          })
        }),
        exercises: Schema.array({
          items: Schema.object({
            properties: {
              type: Schema.enumString({
                enum: [
                  'multiple_choice',
                  'fill_blank',
                  'correct_mistake',
                  'choose_correct_sentence',
                  'sentence_ordering',
                  'short_answer'
                ]
              }),
              question: Schema.string(),
              options: Schema.array({ items: Schema.string() }),
              correctAnswer: Schema.string(),
              explanationAr: Schema.string(),
              source: Schema.enumString({ enum: ['original', 'generated'] })
            },
            optionalProperties: ['options', 'explanationAr', 'source']
          })
        })
      },
      optionalProperties: ['explanationDe', 'rules', 'examples', 'exercises']
    })
  },
  optionalProperties: ['topic', 'level', 'difficulty', 'setKind', 'items', 'grammarContent']
});

/**
 * Returns a GenerativeModel backed by Firebase AI Logic (Gemini Developer
 * API backend, limited-use App Check tokens). No API key is involved.
 */
export function getAiModel(modelId: string = resolveAiLogicModelId()): GenerativeModel {
  ensureAppCheck();
  const ai = getAI(getApp(), {
    backend: new GoogleAIBackend(),
    useLimitedUseAppCheckTokens: true
  });
  return getGenerativeModel(ai, {
    model: modelId,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: LERNSTUDIO_SET_RESPONSE_SCHEMA
    }
  });
}

// ---------------------------------------------------------------------------
// Daily request counter (info only — never blocks; localStorage, per day)
// ---------------------------------------------------------------------------

function todayCounterKey(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `gluck_ai_extraction_count_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function getTodayAiExtractionCount(): number {
  try {
    if (typeof localStorage === 'undefined') return 0;
    return Number(localStorage.getItem(todayCounterKey()) || 0) || 0;
  } catch {
    return 0;
  }
}

export function recordAiExtractionRequest(): number {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const next = getTodayAiExtractionCount() + 1;
    localStorage.setItem(todayCounterKey(), String(next));
    return next;
  } catch {
    return getTodayAiExtractionCount();
  }
}

// ---------------------------------------------------------------------------
// Extraction — ONE generateContent call for all pages, then human review
// ---------------------------------------------------------------------------

export interface AiExtractionPageInput {
  /** e.g. 'image/jpeg' */
  mimeType: string;
  /** Raw base64 image data WITHOUT the `data:...;base64,` prefix. */
  base64Data: string;
}

export interface AiExtractionContext {
  title?: string;
  topic?: string;
  level?: LernstudioLevel;
  difficulty?: LernstudioDifficulty;
  /**
   * Requested set kind. `undefined` = auto-detect the best kind from the
   * photos (vocab / verb_group / grammar / mixed) — the default, matching
   * the universal smart prompt's auto-detection.
   */
  setKind?: LernstudioSetKind;
  teacherName?: string;
  exerciseMode?: 'original_only' | 'original_and_similar';
}

export interface AiExtractionResult {
  /** Draft ONLY — the caller must show it for human review; nothing here imports a set. */
  draft: LernstudioSet;
  warnings: string[];
}

const EXTRACTION_TIMEOUT_MS = 120_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Mark the original promise handled so a late rejection after the timeout
  // does not surface as an unhandled rejection; the race still observes it
  // if it settles first.
  promise.catch(() => {});
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new AiLogicTimeoutError()), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type GenerateContentResult = { response: { text: () => string } };

async function callModelOnce(
  model: GenerativeModel,
  parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }>
): Promise<string> {
  recordAiExtractionRequest();
  const result = (await withTimeout(
    (model as unknown as { generateContent: (parts: unknown) => Promise<GenerateContentResult> }).generateContent(parts),
    EXTRACTION_TIMEOUT_MS
  )) as GenerateContentResult;
  return result.response.text();
}

/**
 * Extract a LernstudioSet draft from up to 6 textbook page images.
 *
 * - Exactly ONE generateContent call carries ALL pages as inlineData
 *   (one request = one unit of free quota, however many pages).
 * - The model result MUST pass validateAndParseLernstudioJson(); invalid
 *   JSON is rejected here and never reaches the app (AiLogicParseError).
 * - The returned draft is normalised + stripped for sync, but it is a
 *   DRAFT ONLY: the modal shows it for human review/edit and only
 *   handleSaveExtractedDraft (user tap) imports it. This function never
 *   calls onImportSet and never writes a set anywhere.
 * - On a model-not-found (404) error with the primary model, retries ONCE
 *   with the fallback model. 429/403 errors are never retried — they are
 *   surfaced as AiLogicQuotaError / AiLogicAppCheckError.
 */
/**
 * Per-kind instruction sent to the model. `undefined` = auto-detect the
 * best set kind from the photos. Vocab / verb sets need items only —
 * no grammarContent, no grammar exercises.
 */
function kindInstruction(setKind?: LernstudioSetKind): string {
  switch (setKind) {
    case 'vocab':
      return 'نوع المجموعة المطلوبة: vocab — استخرج الكلمات والمفردات من الصور واملأ items فقط (الكلمة الألمانية، الأداة der/die/das إن وجدت، الجمع، المعنى العربي، نوع الكلمة، مثال). لا حاجة إلى grammarContent.';
    case 'verb_group':
      return 'نوع المجموعة المطلوبة: verb_group — استخرج الأفعال من الصور واملأ items مع التصريف (ich / du / er, sie, es / wir / ihr / sie, Sie) والمعنى العربي. لا حاجة إلى grammarContent.';
    case 'grammar':
      return 'نوع المجموعة المطلوبة: grammar — استخرج شرح القواعد والقواعد والأمثلة والتمارين من الصور واملأ grammarContent.';
    case 'mixed':
      return 'نوع المجموعة المطلوبة: mixed — استخرج الكلمات في items وشرح القواعد والتمارين في grammarContent معاً.';
    default:
      return 'حدّد نوع المجموعة الأنسب لمحتوى الصور تلقائياً: vocab إذا كانت الصفحة كلمات ومفردات (املأ items: الكلمة الألمانية مع الأداة والجمع والمعنى العربي ونوع الكلمة ومثال)، verb_group إذا كانت أفعالاً وتصريفها (املأ items مع التصريف)، grammar إذا كانت شرح قواعد (املأ grammarContent: الشرح والقواعد والأمثلة والتمارين)، mixed إذا كانت مختلطة (املأ items و grammarContent معاً).';
  }
}

export async function extractLernstudioSetFromImages(
  pages: AiExtractionPageInput[],
  promptText: string,
  context: AiExtractionContext = {},
  opts: { model?: GenerativeModel; timeoutMs?: number } = {}
): Promise<AiExtractionResult> {
  const cleanPages = (pages || []).slice(0, 6).filter((p) => p && p.base64Data && p.base64Data.trim());
  if (cleanPages.length === 0) {
    throw new AiLogicParseError();
  }
  if (!promptText || !promptText.trim()) {
    throw new AiLogicParseError();
  }

  const wantsGrammarExercises =
    context.setKind === undefined || context.setKind === 'grammar' || context.setKind === 'mixed';
  const contextLine = [
    context.title ? `عنوان المجموعة: ${context.title}` : '',
    context.topic ? `الموضوع: ${context.topic}` : '',
    context.level ? `المستوى: ${context.level}` : '',
    kindInstruction(context.setKind),
    !wantsGrammarExercises
      ? ''
      : context.exerciseMode === 'original_only'
        ? 'استخرج تمارين الصفحة الأصلية فقط، بدون تمارين مولّدة إضافية.'
        : 'استخرج تمارين الصفحة الأصلية، ويمكنك إضافة تمارين مشابهة مولّدة مع تمييزها بـ source="generated".',
    'أعد JSON فقط مطابقاً للمخطط المطلوب، من غير أي نص خارج JSON.'
  ]
    .filter(Boolean)
    .join('\n');
  const fullPrompt = contextLine ? `${promptText}\n\n---\n${contextLine}` : promptText;

  const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [
    ...cleanPages.map((p) => ({
      inlineData: { mimeType: p.mimeType || 'image/jpeg', data: p.base64Data }
    })),
    { text: fullPrompt }
  ];

  const primaryModel = opts.model ?? getAiModel(resolveAiLogicModelId());
  let rawText: string;
  try {
    rawText = await callModelOnce(primaryModel, parts);
  } catch (err) {
    const kind = classifyAiLogicError(err);
    if (kind === 'quota') throw new AiLogicQuotaError();
    if (kind === 'appcheck') throw new AiLogicAppCheckError();
    // Fallback retry ONLY for a missing/retired primary model id.
    if (kind === 'not-found' && !opts.model) {
      const fallbackModel = getAiModel(AI_LOGIC_FALLBACK_MODEL);
      try {
        rawText = await callModelOnce(fallbackModel, parts);
      } catch (fallbackErr) {
        const fallbackKind = classifyAiLogicError(fallbackErr);
        if (fallbackKind === 'quota') throw new AiLogicQuotaError();
        if (fallbackKind === 'appcheck') throw new AiLogicAppCheckError();
        throw fallbackErr;
      }
    } else if (err instanceof AiLogicTimeoutError) {
      throw err;
    } else {
      throw err;
    }
  }

  if (!rawText || !rawText.trim()) {
    throw new AiLogicParseError();
  }

  // Gate: invalid JSON / invalid set shape is rejected here — no raw import.
  const parsed = validateAndParseLernstudioJson(rawText);
  if (!parsed.success || !parsed.data) {
    throw new AiLogicParseError();
  }

  const warnings: string[] = [];
  if (!parsed.data.title && context.title) warnings.push('used-teacher-title');
  if (!parsed.data.grammarContent && !parsed.data.items?.length) {
    // validateAndParseLernstudioJson already guarantees one of these exists.
    throw new AiLogicParseError();
  }

  const draft = stripHeavyGrammarMediaForSync(
    normalizeLernstudioSet({
      id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: parsed.data.title || context.title || 'مجموعة مستخرجة من الصور',
      topic: parsed.data.topic || context.topic || parsed.data.title || context.title || 'ألماني',
      level: parsed.data.level || context.level || 'A1',
      difficulty: parsed.data.difficulty || context.difficulty || 'medium',
      // An explicit teacher choice wins; auto-detect falls back to what
      // the model/validator resolved from the photos.
      setKind: context.setKind || parsed.data.setKind || 'grammar',
      contentOrigin: 'teacher_created',
      hasArticles: parsed.data.hasArticles,
      sentenceBuilderSupported: parsed.data.sentenceBuilderSupported,
      ...(context.teacherName?.trim() ? { createdByTeacherName: context.teacherName.trim() } : {}),
      description: parsed.data.description || undefined,
      items: parsed.data.items || [],
      customExercises: parsed.data.customExercises,
      // Vocab / verb sets carry items only — never a grammarContent.
      grammarContent:
        context.setKind === 'vocab' || context.setKind === 'verb_group'
          ? undefined
          : parsed.data.grammarContent,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now()
    })
  );

  return { draft, warnings };
}
