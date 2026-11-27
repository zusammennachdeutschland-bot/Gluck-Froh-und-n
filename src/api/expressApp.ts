import express from 'express';
import crypto from 'crypto';
import {
  evaluateNormalizedGrammarAnswer,
  normalizeGrammarContent,
  normalizeLernstudioSet,
  scrambleOrderingTokensDeterministic,
  stripHeavyGrammarMediaForSync
} from '../shared/grammarEngine.js';
import {
  SUBJECT_PROMPTS,
  buildVerbSentenceGapExercise,
  getVerbById,
  getVerbByInfinitive,
  resolveVerbPraesensForm
} from '../shared/verbEngine.js';
import {
  getAuthoritativeAssignment,
  getAuthoritativeShortLink,
  hasRevokedShortLinkForAssignment,
  listAuthoritativeAssignments,
  listAuthoritativeAssignmentsPage,
  saveAuthoritativeAssignment,
  restoreAuthoritativeHomeworkShortLink,
  regenerateAuthoritativeHomeworkShortLink,
  softDeleteAuthoritativeAssignment,
  getAuthoritativeSubmission,
  listAuthoritativeSubmissions,
  listAuthoritativeSubmissionsPage,
  saveAuthoritativeSubmission,
  deleteAuthoritativeSubmissionsForStudent,
  getAuthoritativePublishedSet,
  listAuthoritativePublishedSets,
  saveAuthoritativePublishedSet,
  isBuiltinCurriculumSetId,
  invalidateServerAssignmentCache,
  resetAdminFirestoreForTesting
} from '../server/firebaseAdmin.js';
import { registerGrainServerRoutes } from '../server/grainServerProxy.js';
import { registerZoomServerRoutes } from '../server/zoomServerProxy.js';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const allowedAppOrigins = new Set<string>(['https://localhost', 'capacitor://localhost', 'ionic://localhost']);

const addConfiguredOrigin = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    allowedAppOrigins.add(url.origin);
  } catch {
    // Ignore malformed deployment URL configuration.
  }
};

addConfiguredOrigin(process.env.APP_URL);
addConfiguredOrigin(process.env.VERCEL_URL);
addConfiguredOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);

app.use((req, res, next) => {
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin.trim() : '';
  const isLocalDevelopmentOrigin =
    process.env.NODE_ENV !== 'production' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const isAllowedOrigin = !origin || allowedAppOrigins.has(origin) || isLocalDevelopmentOrigin;

  if (origin && !isAllowedOrigin) {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Owner-Uid, X-Grain-Session-Token, X-Grain-Local-Client, X-Zoom-Session-Token, X-Zoom-Local-Client');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Per-IP sliding-window rate limiter for the public homework API, copied from
// the Grain proxy pattern (grainServerProxy.ts checkGrainProxyRateLimit).
// Homework routes are unauthenticated student traffic, so the limit is generous
// (600/min/IP: a whole class behind one school NAT can submit at once) — it
// exists to stop floods that would burn the Firestore free quota, not to police
// normal use. The check-answer oracle gets its own stricter per-link cap below.
const homeworkRateLimitBuckets = new Map<string, number[]>();
let homeworkRateLimitMaxRequests = 600;
let homeworkRateLimitWindowMs = 60 * 1000;

export function __setHomeworkRateLimitForTesting(maxRequests: number, windowMs = 60000): void {
  homeworkRateLimitMaxRequests = Math.max(1, maxRequests);
  homeworkRateLimitWindowMs = Math.max(100, windowMs);
  homeworkRateLimitBuckets.clear();
  checkAnswerAttemptBuckets.clear();
}

function checkHomeworkRateLimit(bucketKey: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const cutoff = now - homeworkRateLimitWindowMs;
  const existing = (homeworkRateLimitBuckets.get(bucketKey) || []).filter((ts) => ts > cutoff);
  if (existing.length >= homeworkRateLimitMaxRequests) {
    const oldest = existing[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + homeworkRateLimitWindowMs - now) / 1000));
    homeworkRateLimitBuckets.set(bucketKey, existing);
    return { allowed: false, retryAfterSeconds };
  }
  existing.push(now);
  homeworkRateLimitBuckets.set(bucketKey, existing);
  return { allowed: true };
}

function getHomeworkClientIp(req: any): string {
  // NOTE: never read req.ip here — Express's req.ip getter throws when the
  // request has no socket (e.g. the in-process mock fetch used by tests,
  // which calls app.handle with a plain object). Read the socket directly.
  try {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim();
    if (forwarded) return forwarded;
    const sockAddr = req?.socket?.remoteAddress || req?.connection?.remoteAddress;
    if (sockAddr) return String(sockAddr);
  } catch {}
  return 'unknown';
}

app.use('/api/homework', (req, res, next) => {
  // Fail open: a limiter bug must never take the homework API down.
  try {
    const check = checkHomeworkRateLimit(getHomeworkClientIp(req));
    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSeconds || 60));
      return res.status(429).json({
        success: false,
        error: 'طلبات كثيرة جداً — يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.'
      });
    }
  } catch (err) {
    console.warn('Homework rate limit check failed (failing open):', err);
  }
  next();
});

// /api/homework/check-answer is an answer-key oracle: anyone holding a shortId
// can probe it question by question. Cap probes per link + IP so enumerating a
// whole assignment key is slow, while a real student (one check per question,
// a ~100-question homework) never hits it.
const checkAnswerAttemptBuckets = new Map<string, number[]>();
let checkAnswerMaxAttemptsPerWindow = 300;
let checkAnswerWindowMs = 60 * 60 * 1000;

export function __setCheckAnswerAttemptCapForTesting(maxAttempts: number, windowMs = 60 * 60 * 1000): void {
  checkAnswerMaxAttemptsPerWindow = Math.max(1, maxAttempts);
  checkAnswerWindowMs = Math.max(100, windowMs);
  checkAnswerAttemptBuckets.clear();
}

function checkCheckAnswerAttemptCap(bucketKey: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const cutoff = now - checkAnswerWindowMs;
  const existing = (checkAnswerAttemptBuckets.get(bucketKey) || []).filter((ts) => ts > cutoff);
  if (existing.length >= checkAnswerMaxAttemptsPerWindow) {
    const oldest = existing[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + checkAnswerWindowMs - now) / 1000));
    checkAnswerAttemptBuckets.set(bucketKey, existing);
    return { allowed: false, retryAfterSeconds };
  }
  existing.push(now);
  checkAnswerAttemptBuckets.set(bucketKey, existing);
  return { allowed: true };
}

// Authoritative Firestore helpers (short-TTL process-local assignment lookup cache in firebaseAdmin)
export function resetServerMemoryCacheOnly(): void {
  invalidateServerAssignmentCache();
}

export function resetHomeworkStoresForTesting(): void {
  resetAdminFirestoreForTesting();
}

async function getServerAssignment(id: string): Promise<any | null> {
  return await getAuthoritativeAssignment(id);
}

async function listServerAssignments(ownerUid: string): Promise<any[]> {
  return await listAuthoritativeAssignments(ownerUid);
}

async function saveServerAssignment(normalized: any, verifiedUid: string): Promise<any> {
  return await saveAuthoritativeAssignment(normalized, verifiedUid);
}

async function listServerSubmissions(ownerUid: string, assignmentId?: string | null): Promise<any[]> {
  return await listAuthoritativeSubmissions(ownerUid, assignmentId);
}

async function saveServerSubmission(sub: any, targetHw: any): Promise<{ submission: any; isIdempotentRetry?: boolean }> {
  return await saveAuthoritativeSubmission(sub, targetHw);
}

// 1. Health check
app.all('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).json({ status: 'ok' });
});

// 3. TTS Proxy Endpoint
app.get('/api/tts', async (req, res) => {
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!bearerToken) {
    return res.status(401).json({ error: 'Unauthorized: Firebase Bearer token is required for TTS' });
  }

  const verification = await verifyFirebaseIdToken(bearerToken);
  if (!verification.isValid || !verification.payload) {
    return res.status(401).json({
      error: `Unauthorized: ${verification.error || 'Invalid Firebase ID token'}`
    });
  }

  try {
    const text = ((req.query.text as string) || '').trim();
    const lang = ((req.query.lang as string) || 'de').trim();
    if (!text) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: 'Text parameter exceeds maximum length of 500 characters' });
    }
    const allowedLangs = new Set(['de', 'ar', 'en', 'de-DE', 'ar-SA', 'en-US']);
    if (!allowedLangs.has(lang)) {
      return res.status(400).json({ error: 'Unsupported language code' });
    }
    const encoded = encodeURIComponent(text);
    const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&sl=${lang}&tl=${lang}&dt=t&q=${encoded}`;
    const response = await fetch(ttsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    });
    if (!response.ok) {
      return res.status(response.status).send('TTS fetch failed');
    }
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('TTS endpoint error:', err);
    res.status(500).json({ error: 'TTS failed' });
  }
});



function resolveServerAudienceMode(hw: any): 'open' | 'group' {
  if (!hw) return 'open';
  if (hw.audienceMode === 'open') return 'open';
  if (hw.audienceMode === 'group') return 'group';
  const gid = String(hw.groupId || '').trim();
  if (gid && gid !== 'all') return 'group';
  return 'open';
}

function normalizeServerAssignment(hw: any): any {
  if (!hw || typeof hw !== 'object') return hw;
  const mode = resolveServerAudienceMode(hw);
  if (mode === 'open') {
    const copy = { ...hw, audienceMode: 'open' };
    delete copy.groupId;
    delete copy.groupName;
    delete copy.assignedStudents;
    // Legacy field removed in the single-push cleanup: never expose it in the DTO.
    delete copy.hideTeacherBranding;
    return copy;
  }
  const targetGroupId = String(hw.groupId || '').trim();
  const byId = new Map<string, any>();
  if (Array.isArray(hw.assignedStudents)) {
    for (const raw of hw.assignedStudents) {
      if (!raw) continue;
      const cleanId = String(raw.id || '').trim();
      const cleanName = String(raw.name || '').trim();
      if (!cleanId || !cleanName) continue;
      if (raw.groupId && targetGroupId && String(raw.groupId).trim() !== targetGroupId) continue;
      if (!byId.has(cleanId)) {
        byId.set(cleanId, {
          id: cleanId,
          name: cleanName,
          ...(raw.code ? { code: raw.code } : {}),
          ...(raw.groupId || targetGroupId ? { groupId: String(raw.groupId || targetGroupId).trim() } : {})
        });
      }
    }
  }
  const grouped = {
    ...hw,
    audienceMode: 'group',
    groupId: targetGroupId && targetGroupId !== 'all' ? targetGroupId : undefined,
    groupName: hw.groupName ? String(hw.groupName).trim() : undefined,
    assignedStudents: Array.from(byId.values())
  };
  // Legacy field removed in the single-push cleanup: never expose it in the DTO.
  delete grouped.hideTeacherBranding;
  return grouped;
}

function isServerAssignmentOpen(hw: any): boolean {
  if (!hw || !hw.id) return false;
  if (hw.deleted === true || hw.revoked === true) return false;
  if (hw.isActive === false) return false;
  if (hw.status === 'closed' || hw.status === 'deleted') return false;
  const nowMs = Date.now();
  const reopenedAt = typeof hw.manualReopenedAt === 'number' ? hw.manualReopenedAt : 0;

  if (typeof hw.dueDate === 'string' && hw.dueDate.trim()) {
    const rawDue = hw.dueDate.trim();
    const ymdMatch = rawDue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let dueEndMs = NaN;
    if (ymdMatch) {
      const y = Number(ymdMatch[1]);
      const m = Number(ymdMatch[2]);
      const d = Number(ymdMatch[3]);
      const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
      if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
        dueEndMs = dt.getTime();
      }
    } else {
      dueEndMs = Date.parse(rawDue);
    }
    if (Number.isFinite(dueEndMs)) {
      const autoCloseAtMs = dueEndMs + 14 * 24 * 60 * 60 * 1000;
      if (nowMs >= autoCloseAtMs && reopenedAt < autoCloseAtMs) {
        return false;
      }
    }
  }

  if (typeof hw.deadline === 'string' && hw.deadline.trim()) {
    const deadlineMs = Date.parse(hw.deadline.trim());
    if (Number.isFinite(deadlineMs) && nowMs > deadlineMs && reopenedAt < deadlineMs) {
      return false;
    }
  }
  return true;
}

/**
 * Dedicated public set-snapshot sanitizer.
 * Strictly allowlists student-facing study fields and vocabulary cards.
 * Strips all answer keys (customExercises.correctAnswer, answer-revealing explanation),
 * teacher metadata (ownerUid, ownerEmail, assignedGroupId, isArchived), internal IDs, and PII.
 * Never mutates the original snapshot or stored assignment.
 */
export function sanitizePublicSetSnapshot(rawSnapshot: any): any {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') return null;

  // 1. Sanitize items array (allow only vocabulary study fields)
  const rawItems = Array.isArray(rawSnapshot.items) ? rawSnapshot.items : [];
  const sanitizedItems = rawItems.map((item: any) => {
    if (!item || typeof item !== 'object') return {};
    const cleanItem: any = {
      id: String(item.id || ''),
      german: String(item.german || ''),
      arabic: String(item.arabic || '')
    };
    if (item.article) cleanItem.article = item.article;
    if (item.english) cleanItem.english = String(item.english);
    if (item.plural) cleanItem.plural = String(item.plural);
    if (item.exampleSentenceGerman) cleanItem.exampleSentenceGerman = String(item.exampleSentenceGerman);
    if (item.exampleSentenceArabic) cleanItem.exampleSentenceArabic = String(item.exampleSentenceArabic);
    if (item.imageUrl) cleanItem.imageUrl = String(item.imageUrl);
    if (item.emoji) cleanItem.emoji = String(item.emoji);
    if (item.missingLetterWord) cleanItem.missingLetterWord = String(item.missingLetterWord);
    if (Array.isArray(item.sentence4Elements)) {
      cleanItem.sentence4Elements = item.sentence4Elements.slice(0, 4).map(String);
    }
    if (item.wordType) cleanItem.wordType = item.wordType;
    if (item.conjugation && typeof item.conjugation === 'object') {
      cleanItem.conjugation = item.conjugation;
    }
    if (item.category) cleanItem.category = String(item.category);
    if (item.verbId) cleanItem.verbId = String(item.verbId);
    if (Array.isArray(item.classifications)) {
      cleanItem.classifications = item.classifications.map(String);
    }
    if (item.separablePrefix) cleanItem.separablePrefix = String(item.separablePrefix);
    if (item.preposition) cleanItem.preposition = String(item.preposition);
    if (item.prepositionCase) cleanItem.prepositionCase = String(item.prepositionCase);
    if (Array.isArray(item.syllables)) {
      cleanItem.syllables = item.syllables.map(String);
    }
    return cleanItem;
  });

  // 2. Sanitize customExercises array (NEVER expose correctAnswer or answer-revealing explanation!)
  const sanitizePublicExercise = (ex: any, idx: number, includeItemRef = false) => {
    if (!ex || typeof ex !== 'object') return {};
    const type = String(ex.type || 'multiple_choice').trim();
    const cleanEx: any = {
      id: String(ex.id || ''),
      type,
      question: String(ex.question || ex.sentenceWithBlank || ex.faultySentence || ex.prompt || '')
    };
    if (ex.prompt) cleanEx.prompt = String(ex.prompt);
    if (ex.sentenceWithBlank) cleanEx.sentenceWithBlank = String(ex.sentenceWithBlank);
    if (ex.faultySentence) cleanEx.faultySentence = String(ex.faultySentence);
    if (type === 'sentence_ordering') {
      const expectedOrder = String(ex.correctAnswer || '').trim().split(/\s+/).filter(Boolean);
      const rawTokens =
        Array.isArray(ex.tokens) && ex.tokens.length >= 2
          ? ex.tokens.map((t: any) => String(t || '').trim()).filter(Boolean)
          : expectedOrder;
      if (rawTokens.length > 0) {
        cleanEx.tokens = scrambleOrderingTokensDeterministic(
          rawTokens,
          String(ex.id || `ex_${idx}`),
          expectedOrder.length >= 2 ? expectedOrder : undefined
        );
      }
    } else if (Array.isArray(ex.tokens)) {
      cleanEx.tokens = ex.tokens.map(String);
    }
    if (Array.isArray(ex.options)) {
      cleanEx.options = ex.options.map(String);
    }
    if (includeItemRef && ex.itemRefId) {
      cleanEx.itemRefId = String(ex.itemRefId);
    }
    if (ex.source) cleanEx.source = String(ex.source);
    if (ex.ruleRef) cleanEx.ruleRef = String(ex.ruleRef);
    if (ex.isUncertain) cleanEx.isUncertain = true;
    if (ex.uncertaintyReason) cleanEx.uncertaintyReason = String(ex.uncertaintyReason);
    // STRICTLY OMIT: correctAnswer, acceptedAnswers, explanation, explanationAr/De/En, teacherNotes, answerKey
    return cleanEx;
  };

  const rawExercises = Array.isArray(rawSnapshot.customExercises) ? rawSnapshot.customExercises : [];
  const sanitizedExercises = rawExercises.map((ex: any, idx: number) => sanitizePublicExercise(ex, idx, true));

  const sanitizedSnapshot: any = {
    id: String(rawSnapshot.id || ''),
    title: String(rawSnapshot.title || ''),
    level: rawSnapshot.level || 'A1',
    topic: String(rawSnapshot.topic || rawSnapshot.category || ''),
    difficulty: rawSnapshot.difficulty || 'medium',
    items: sanitizedItems
  };

  if (rawSnapshot.category) sanitizedSnapshot.category = String(rawSnapshot.category);
  if (rawSnapshot.setKind) sanitizedSnapshot.setKind = String(rawSnapshot.setKind);
  if (rawSnapshot.contentOrigin) sanitizedSnapshot.contentOrigin = String(rawSnapshot.contentOrigin);
  if (Array.isArray(rawSnapshot.verbIds)) {
    sanitizedSnapshot.verbIds = rawSnapshot.verbIds.map(String);
  }
  if (rawSnapshot.hasArticles !== undefined) sanitizedSnapshot.hasArticles = Boolean(rawSnapshot.hasArticles);
  if (rawSnapshot.sentenceBuilderSupported !== undefined) {
    sanitizedSnapshot.sentenceBuilderSupported = Boolean(rawSnapshot.sentenceBuilderSupported);
  }
  if (sanitizedExercises.length > 0) {
    sanitizedSnapshot.customExercises = sanitizedExercises;
  }

  // 3. Sanitize grammarContent (allow study rules/examples + student prompts; NEVER leak correctAnswer/acceptedAnswers/explanations)
  if (rawSnapshot.grammarContent && typeof rawSnapshot.grammarContent === 'object') {
    const gc = rawSnapshot.grammarContent;
    const cleanGrammarExercises = Array.isArray(gc.exercises)
      ? gc.exercises.map((ex: any, idx: number) => sanitizePublicExercise(ex, idx, false))
      : [];

    sanitizedSnapshot.grammarContent = {
      lessonTitle: String(gc.lessonTitle || rawSnapshot.title || ''),
      ...(gc.lessonTitleAr ? { lessonTitleAr: String(gc.lessonTitleAr) } : {}),
      ...(gc.lessonTitleDe ? { lessonTitleDe: String(gc.lessonTitleDe) } : {}),
      ...(gc.lessonTitleEn ? { lessonTitleEn: String(gc.lessonTitleEn) } : {}),
      grammarTopic: String(gc.grammarTopic || rawSnapshot.topic || ''),
      ...(gc.grammarTopicAr ? { grammarTopicAr: String(gc.grammarTopicAr) } : {}),
      ...(gc.grammarTopicDe ? { grammarTopicDe: String(gc.grammarTopicDe) } : {}),
      ...(gc.grammarTopicEn ? { grammarTopicEn: String(gc.grammarTopicEn) } : {}),
      explanationAr: String(gc.explanationAr || ''),
      ...(gc.explanationDe ? { explanationDe: String(gc.explanationDe) } : {}),
      ...(gc.explanationEn ? { explanationEn: String(gc.explanationEn) } : {}),
      rules: Array.isArray(gc.rules) ? gc.rules : [],
      examples: Array.isArray(gc.examples) ? gc.examples : [],
      exercises: cleanGrammarExercises,
      origin: gc.origin === 'builtin' ? 'builtin' : 'teacher_created',
      ...(Array.isArray(gc.pageImageRefs) ? { pageImageRefs: gc.pageImageRefs } : {}),
      ...(gc.sourceBookInfo ? { sourceBookInfo: String(gc.sourceBookInfo) } : {})
    };
  }

  // STRICTLY EXCLUDED: ownerUid, ownerEmail, assignedGroupId, isArchived, createdAt, updatedAt, credentials, PII
  return sanitizedSnapshot;
}

export function toPublicAssignmentDto(hw: any): any {
  if (!hw || typeof hw !== 'object') return hw;
  const normalized = normalizeServerAssignment(hw);
  const mode = resolveServerAudienceMode(normalized);

  const publicDto: any = {
    id: String(normalized.id || ''),
    ...(normalized.shortId ? { shortId: String(normalized.shortId).trim() } : {}),
    title: String(normalized.title || ''),
    createdAt: String(normalized.createdAt || ''),
    isActive: Boolean(normalized.isActive),
    audienceMode: mode,
    allowedGameModes: Array.isArray(normalized.allowedGameModes) ? normalized.allowedGameModes : ['classic_quiz'],
    questionCount: typeof normalized.questionCount === 'number' ? normalized.questionCount : undefined,
    ...(typeof normalized.targetQuestionCount === 'number'
      ? { targetQuestionCount: normalized.targetQuestionCount }
      : {}),
    ...(Array.isArray(normalized.questionTypes) ? { questionTypes: normalized.questionTypes } : {}),
    ...(normalized.questionTypeCounts && typeof normalized.questionTypeCounts === 'object'
      ? { questionTypeCounts: normalized.questionTypeCounts }
      : {}),
    ...(Array.isArray(normalized.selectedItemIds) ? { selectedItemIds: normalized.selectedItemIds } : {}),
    ...(normalized.contentSource ? { contentSource: String(normalized.contentSource) } : {}),
    ...(Array.isArray(normalized.selectedVerbGroupIds)
      ? { selectedVerbGroupIds: normalized.selectedVerbGroupIds }
      : {}),
    ...(Array.isArray(normalized.selectedVerbIds)
      ? { selectedVerbIds: normalized.selectedVerbIds }
      : {}),
    ...(Array.isArray(normalized.verbSnapshot)
      ? { verbSnapshot: JSON.parse(JSON.stringify(normalized.verbSnapshot)) }
      : {}),
    ...(normalized.verbSubjectPoolMode
      ? { verbSubjectPoolMode: String(normalized.verbSubjectPoolMode) }
      : {}),
    ...(normalized.flowMode ? { flowMode: String(normalized.flowMode) } : {}),
    ...(normalized.blooketMode ? { blooketMode: String(normalized.blooketMode) } : {}),
    maxAttempts: typeof normalized.maxAttempts === 'number' ? normalized.maxAttempts : undefined,
    ...(typeof normalized.deadline === 'string' && normalized.deadline.trim()
      ? { deadline: normalized.deadline.trim() }
      : {}),
    ...(typeof normalized.timeLimitMinutes === 'number' &&
    Number.isFinite(normalized.timeLimitMinutes) &&
    normalized.timeLimitMinutes > 0
      ? { timeLimitMinutes: normalized.timeLimitMinutes }
      : {}),
    allowReplay: typeof normalized.allowReplay === 'boolean' ? normalized.allowReplay : true,
    setSnapshot: sanitizePublicSetSnapshot(normalized.setSnapshot),
    ...(normalized.status ? { status: String(normalized.status) } : {})
  };

  if (mode === 'group') {
    publicDto.groupId = String(normalized.groupId || '');
    publicDto.groupName = String(normalized.groupName || '');
    // Explicitly sanitize assignedStudents: expose only student name and public group affiliation; never expose access codes, passwords, credentials, or PII.
    if (Array.isArray(normalized.assignedStudents)) {
      publicDto.assignedStudents = normalized.assignedStudents.map((st: any) => ({
        id: String(st.id || ''),
        name: String(st.name || ''),
        groupId: String(st.groupId || normalized.groupId || '')
      }));
    } else {
      publicDto.assignedStudents = [];
    }
  }

  return publicDto;
}

function sanitizePublicAssignmentInfo(hw: any): any {
  return toPublicAssignmentDto(hw);
}

function validateServerSubmission(hw: any, body: any): {
  valid: boolean;
  status?: number;
  error?: string;
  audienceMode: 'open' | 'group';
  normalizedStudentId?: string;
  normalizedParticipantId?: string;
  normalizedStudentName?: string;
  normalizedGroupId?: string;
} {
  const cleanSubmittedName = String(body?.studentName || '').trim();
  if (!hw || !hw.id) {
    return {
      valid: false,
      status: 404,
      error: 'Assignment not found',
      audienceMode: 'open'
    };
  }
  if (!isServerAssignmentOpen(hw)) {
    return {
      valid: false,
      status: 403,
      error: 'Assignment is closed or inactive and no longer accepts submissions',
      audienceMode: resolveServerAudienceMode(hw)
    };
  }

  const normalizedHw = normalizeServerAssignment(hw);
  const mode = resolveServerAudienceMode(normalizedHw);

  if (mode === 'group') {
    const targetGroupId = String(normalizedHw.groupId || '').trim();
    if (!targetGroupId || targetGroupId === 'all') {
      return {
        valid: false,
        status: 403,
        error: 'Group assignment is missing a valid groupId',
        audienceMode: 'group'
      };
    }
    const roster: any[] = Array.isArray(normalizedHw.assignedStudents) ? normalizedHw.assignedStudents : [];
    if (roster.length === 0) {
      return {
        valid: false,
        status: 403,
        error: 'Group student roster is unavailable for this assignment',
        audienceMode: 'group'
      };
    }
    const submittedStudentId = String(body?.studentId || '').trim();
    if (!submittedStudentId) {
      return {
        valid: false,
        status: 403,
        error: 'studentId is required for a group-restricted homework assignment',
        audienceMode: 'group'
      };
    }
    if (body?.groupId && String(body.groupId).trim() !== targetGroupId) {
      return {
        valid: false,
        status: 403,
        error: 'Submitted groupId does not match assignment groupId',
        audienceMode: 'group'
      };
    }
    const matchedStudent = roster.find((s) => s.id === submittedStudentId);
    if (!matchedStudent) {
      return {
        valid: false,
        status: 403,
        error: 'Student does not belong to the assigned group',
        audienceMode: 'group'
      };
    }
    if (!cleanSubmittedName || cleanSubmittedName.toLowerCase() !== String(matchedStudent.name).trim().toLowerCase()) {
      return {
        valid: false,
        status: 403,
        error: 'Submitted studentName does not match registered student record',
        audienceMode: 'group'
      };
    }
    return {
      valid: true,
      audienceMode: 'group',
      normalizedStudentId: matchedStudent.id,
      normalizedParticipantId: undefined,
      normalizedStudentName: String(matchedStudent.name).trim(),
      normalizedGroupId: targetGroupId
    };
  }

  // Open mode ('open')
  if (!cleanSubmittedName) {
    return {
      valid: false,
      status: 400,
      error: 'Participant name is required for open homework',
      audienceMode: 'open'
    };
  }
  const pid =
    String(body?.participantId || '').trim() ||
    `pid_${String(body?.id || `${body?.assignmentId || 'hw'}_${cleanSubmittedName}`).trim().slice(0, 48)}`;
  return {
    valid: true,
    audienceMode: 'open',
    normalizedStudentId: undefined,
    normalizedParticipantId: pid,
    normalizedStudentName: cleanSubmittedName,
    normalizedGroupId: undefined
  };
}

// Shared Published Custom Learning Sets (Synced once from Android, readable by Vercel & all authenticated teachers)
app.all('/api/homework/sets', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!bearerToken) {
    return res.status(401).json({
      error: 'Unauthorized: Firebase Bearer token is required to access shared learning sets',
      sets: []
    });
  }

  const verification = await verifyFirebaseIdToken(bearerToken);
  if (!verification.isValid || !verification.payload) {
    return res.status(401).json({
      error: `Unauthorized: ${verification.error || 'Invalid Firebase ID token'}`,
      sets: []
    });
  }
  const verifiedUid = verification.payload.sub;

  if (req.method === 'GET') {
    const querySetId = req.query.setId ? String(req.query.setId).trim() : '';
    if (querySetId) {
      try {
        const foundSet = await getAuthoritativePublishedSet(querySetId, { includeUnpublished: true });
        if (!foundSet) {
          return res.status(404).json({ error: 'Published learning set not found' });
        }
        if (foundSet.published === false && String(foundSet.createdByUid || '').trim() !== verifiedUid) {
          return res.status(403).json({ error: 'Forbidden: Learning set is private/unpublished' });
        }
        return res.json({ set: foundSet });
      } catch (err: any) {
        return res.status(err?.status || 500).json({ error: err?.message || 'Failed to fetch learning set' });
      }
    }
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = req.query.cursor ? String(req.query.cursor).trim() : undefined;
    try {
      const page = await listAuthoritativePublishedSets({
        limit,
        cursor,
        requesterUid: verifiedUid
      });
      return res.json(page);
    } catch (err: any) {
      return res.status(err?.status || 500).json({
        error: err?.message || 'Failed to list published learning sets',
        sets: []
      });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const setPayload = body.set && typeof body.set === 'object' ? body.set : body;
    if (!setPayload || !setPayload.id) {
      return res.status(400).json({
        success: false,
        error: 'Set payload with a valid id is required'
      });
    }
    if (isBuiltinCurriculumSetId(String(setPayload.id))) {
      return res.status(400).json({
        success: false,
        error: 'Built-in curriculum sets are bundled locally and do not need cloud publishing'
      });
    }
    // The set owner is always the verified Bearer token — a client-supplied
    // createdByUid is never trusted (an attacker would simply omit it or send
    // their own uid). saveAuthoritativePublishedSet also rejects overwriting a
    // set owned by a different teacher, published or not.
    setPayload.createdByUid = verifiedUid;
    try {
      const result = await saveAuthoritativePublishedSet(setPayload, verifiedUid);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(err?.status || 500).json({
        success: false,
        error: err?.message || 'Failed to publish custom learning set'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

app.get('/api/homework/sets/:setId', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!bearerToken) {
    return res.status(401).json({
      error: 'Unauthorized: Firebase Bearer token is required to read learning sets'
    });
  }

  const verification = await verifyFirebaseIdToken(bearerToken);
  if (!verification.isValid || !verification.payload) {
    return res.status(401).json({
      error: `Unauthorized: ${verification.error || 'Invalid Firebase ID token'}`
    });
  }
  const verifiedUid = verification.payload.sub;

  const setId = String(req.params.setId || '').trim();
  if (!setId) {
    return res.status(400).json({ error: 'Set id is required' });
  }

  try {
    const foundSet = await getAuthoritativePublishedSet(setId, { includeUnpublished: true });
    if (!foundSet) {
      return res.status(404).json({ error: 'Published learning set not found or unpublished' });
    }
    if (foundSet.published === false && String(foundSet.createdByUid || '').trim() !== verifiedUid) {
      return res.status(403).json({ error: 'Forbidden: Learning set is private/unpublished' });
    }
    return res.json({ set: foundSet });
  } catch (err: any) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Failed to fetch learning set' });
  }
});

app.all('/api/teacher/assignments', async (req, res) => {
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!bearerToken) {
    return res.status(401).json({
      error: 'Unauthorized: Firebase Bearer token is required to access teacher assignments',
      assignments: []
    });
  }

  const verification = await verifyFirebaseIdToken(bearerToken);
  if (!verification.isValid || !verification.payload) {
    return res.status(401).json({
      error: `Unauthorized: ${verification.error || 'Invalid Firebase ID token'}`,
      assignments: []
    });
  }
  const verifiedUid = verification.payload.sub;

  if (req.method === 'GET') {
    const requestedOwnerUid = String(req.query.ownerUid || req.headers['x-owner-uid'] || '').trim();
    if (requestedOwnerUid && requestedOwnerUid !== verifiedUid) {
      return res.status(403).json({
        error: 'Forbidden: ownerUid does not match authenticated Firebase token',
        assignments: []
      });
    }
    const ownerUid = verifiedUid;
    const hasPagination = req.query.limit !== undefined || req.query.cursor !== undefined;
    try {
      if (hasPagination) {
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const cursor = req.query.cursor ? String(req.query.cursor).trim() : undefined;
        const page = await listAuthoritativeAssignmentsPage(ownerUid, { limit, cursor });
        return res.json({
          assignments: page.assignments.map(normalizeServerAssignment),
          nextCursor: page.nextCursor,
          hasMore: page.hasMore
        });
      }
      const filtered = await listServerAssignments(ownerUid);
      return res.json({ assignments: filtered.map(normalizeServerAssignment) });
    } catch (err: any) {
      return res.status(err?.status || 500).json({
        error: err?.message || 'Failed to list teacher assignments',
        assignments: []
      });
    }
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || req.body?.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'Homework id is required' });
    try {
      const deleted = await softDeleteAuthoritativeAssignment(id, verifiedUid);
      return res.json({
        success: true,
        deleted: true,
        assignmentId: deleted.id,
        revokedShortIds: deleted.revokedShortIds || [],
        submissionsPreserved: true
      });
    } catch (err: any) {
      return res.status(err?.status || 500).json({ success: false, error: err?.message || 'Failed to delete homework' });
    }
  }
  if (req.method === 'POST') {
    const body = req.body || {};
    const bodyOwnerUid = String(body.ownerUid || req.headers['x-owner-uid'] || '').trim();
    if (bodyOwnerUid && bodyOwnerUid !== verifiedUid) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Assignment ownerUid does not match authenticated Firebase token'
      });
    }
    const effectiveOwnerUid = verifiedUid;
    const requestedAction = typeof body.action === 'string' ? body.action.trim() : '';

    if (requestedAction === 'restore_link') {
      const targetId = String(body.id || body.assignmentId || '').trim();
      if (!targetId) {
        return res.status(400).json({ success: false, error: 'Assignment id is required' });
      }
      try {
        const result = await restoreAuthoritativeHomeworkShortLink(
          targetId,
          effectiveOwnerUid,
          body.originalShortId ? String(body.originalShortId).trim() : undefined
        );
        return res.json({
          success: true,
          action: 'restore_link',
          assignment: normalizeServerAssignment(result.assignment),
          shortId: result.restoredShortId,
          previousShortId: result.previousShortId
        });
      } catch (err: any) {
        return res.status(err?.status || 500).json({
          success: false,
          code: err?.code,
          error: err?.message || 'Failed to restore original short link'
        });
      }
    }

    if (requestedAction === 'regenerate_link') {
      const targetId = String(body.id || body.assignmentId || '').trim();
      if (!targetId) {
        return res.status(400).json({ success: false, error: 'Assignment id is required' });
      }
      try {
        const result = await regenerateAuthoritativeHomeworkShortLink(
          targetId,
          effectiveOwnerUid,
          body.newShortId ? String(body.newShortId).trim() : undefined
        );
        return res.json({
          success: true,
          action: 'regenerate_link',
          assignment: normalizeServerAssignment(result.assignment),
          shortId: result.newShortId,
          previousShortId: result.previousShortId,
          originalShortId: result.originalShortId
        });
      } catch (err: any) {
        return res.status(err?.status || 500).json({
          success: false,
          code: err?.code,
          error: err?.message || 'Failed to generate new short link'
        });
      }
    }

    if (body.audienceMode === 'group') {
      const gid = String(body.groupId || '').trim();
      if (!gid || gid === 'all') {
        return res.status(400).json({
          success: false,
          error: 'يجب تحديد مجموعة صالحة عند اختيار جروب معين.'
        });
      }
    }
    const normalized = normalizeServerAssignment({
      ...body,
      ownerUid: effectiveOwnerUid
    });
    delete normalized.ownerEmail;

    // Resolve published set server-side when setId is supplied without inline items
    const explicitSetId = typeof body.setId === 'string' ? body.setId.trim() : '';
    const requestedSetId = String(explicitSetId || normalized.setSnapshot?.id || '').trim();
    const hasInlineItems = Array.isArray(normalized.setSnapshot?.items) && normalized.setSnapshot.items.length > 0;
    const hasInlineExercises = Array.isArray(normalized.setSnapshot?.customExercises) && normalized.setSnapshot.customExercises.length > 0;
    const hasInlineGrammar = Boolean(
      normalized.setSnapshot?.grammarContent &&
        ((Array.isArray(normalized.setSnapshot.grammarContent.exercises) &&
          normalized.setSnapshot.grammarContent.exercises.length > 0) ||
          (Array.isArray(normalized.setSnapshot.grammarContent.rules) &&
            normalized.setSnapshot.grammarContent.rules.length > 0) ||
          (Array.isArray(normalized.setSnapshot.grammarContent.examples) &&
            normalized.setSnapshot.grammarContent.examples.length > 0))
    );
    const hasCallerSnapshot = Boolean(body.setSnapshot && typeof body.setSnapshot === 'object');
    const isVerbOnlySource = normalized.contentSource === 'verbs';
    const isGrammarSource = normalized.contentSource === 'grammar';
    if (
      requestedSetId &&
      !hasInlineItems &&
      !hasInlineExercises &&
      !hasInlineGrammar &&
      !isVerbOnlySource &&
      !isGrammarSource
    ) {
      try {
        const resolvedSet = await getAuthoritativePublishedSet(requestedSetId, { includeUnpublished: true });
        if (!resolvedSet) {
          if (explicitSetId || !hasCallerSnapshot) {
            return res.status(404).json({
              success: false,
              error: 'Published learning set not found or unpublished'
            });
          }
        } else {
          if (resolvedSet.published === false && String(resolvedSet.createdByUid || '').trim() !== effectiveOwnerUid) {
            return res.status(403).json({
              success: false,
              error: 'Forbidden: Learning set is unpublished'
            });
          }
          normalized.setSnapshot = resolvedSet;
          if (!normalized.title && resolvedSet.title) {
            normalized.title = resolvedSet.title;
          }
          if (!normalized.questionCount && Array.isArray(resolvedSet.items)) {
            normalized.questionCount = resolvedSet.items.length;
          }
        }
      } catch (err: any) {
        if (explicitSetId || !hasCallerSnapshot) {
          return res.status(err?.status || 500).json({
            success: false,
            error: err?.message || 'Failed to resolve published learning set'
          });
        }
      }
    }

    if (normalized.id) {
      try {
        const saved = await saveServerAssignment(normalized, effectiveOwnerUid);
        return res.json({ success: true, assignment: saved });
      } catch (err: any) {
        return res.status(err?.status || 500).json({
          success: false,
          error: err?.message || 'Failed to persist assignment to database'
        });
      }
    }
    return res.json({ success: true, assignment: normalized });
  }
  return res.status(405).json({ success: false, error: 'Method not allowed' });
});

app.all('/api/homework/submissions', async (req, res) => {
  if (req.method === 'GET') {
    const authHeader = String(req.headers.authorization || '');
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!bearerToken) {
      return res.status(401).json({
        error: 'Unauthorized: Firebase Bearer token is required to list submissions',
        submissions: []
      });
    }

    const verification = await verifyFirebaseIdToken(bearerToken);
    if (!verification.isValid || !verification.payload) {
      return res.status(401).json({
        error: `Unauthorized: ${verification.error || 'Invalid Firebase ID token'}`,
        submissions: []
      });
    }
    const verifiedUid = verification.payload.sub;

    const assignmentId = req.query.assignmentId ? String(req.query.assignmentId).trim() : null;
    const requestedOwnerUid = String(req.query.ownerUid || req.headers['x-owner-uid'] || '').trim();

    if (requestedOwnerUid && requestedOwnerUid !== verifiedUid) {
      return res.status(403).json({
        error: 'Forbidden: ownerUid does not match authenticated Firebase token',
        submissions: []
      });
    }
    const ownerUid = verifiedUid;

    try {
      if (assignmentId) {
        const targetHw = await getServerAssignment(assignmentId);
        if (targetHw && targetHw.ownerUid && String(targetHw.ownerUid).trim() !== ownerUid) {
          return res.status(403).json({
            error: 'Forbidden: Assignment belongs to another teacher account',
            submissions: []
          });
        }
      }
      const hasPagination = req.query.limit !== undefined || req.query.cursor !== undefined;
      if (hasPagination) {
        const limit = req.query.limit ? Number(req.query.limit) : 100;
        const cursor = req.query.cursor ? String(req.query.cursor).trim() : undefined;
        const page = await listAuthoritativeSubmissionsPage(ownerUid, assignmentId, { limit, cursor });
        return res.json({
          submissions: page.submissions,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore
        });
      }
      const list = await listServerSubmissions(ownerUid, assignmentId);
      return res.json({ submissions: list });
    } catch (err: any) {
      return res.status(err?.status || 500).json({
        error: err?.message || 'Failed to list submissions',
        submissions: []
      });
    }
  }
  if (req.method === 'POST') {
    const body = req.body || {};
    const providedShortId = String(body.shortId || req.query.shortId || '').trim();
    // V-05: Never trust client-supplied body.assignmentFallback; require a server-known assignment
    let targetHw: any = null;
    try {
      targetHw = await getServerAssignment(body.assignmentId);
    } catch (err: any) {
      return res.status(err?.status || 500).json({
        success: false,
        error: err?.message || 'Failed to load assignment from database'
      });
    }
    if (!targetHw) {
      let wasRevoked = false;
      try {
        if (providedShortId) {
          const shortResolved = await getAuthoritativeShortLink(providedShortId);
          wasRevoked = shortResolved.status === 'revoked';
        }
        if (!wasRevoked && body.assignmentId) {
          wasRevoked = await hasRevokedShortLinkForAssignment(String(body.assignmentId));
        }
      } catch {
        wasRevoked = false;
      }
      return res.status(wasRevoked ? 403 : 404).json({
        success: false,
        error: wasRevoked
          ? 'Assignment has been deleted or its link has been revoked and no longer accepts submissions'
          : 'Assignment not found'
      });
    }
    if (!isServerAssignmentOpen(targetHw)) {
      return res.status(403).json({
        success: false,
        error: 'Assignment is closed or inactive and no longer accepts submissions'
      });
    }

    const configuredShareToken =
      targetHw.shareToken !== undefined && targetHw.shareToken !== null ? String(targetHw.shareToken).trim() : '';
    const configuredShortId =
      targetHw.shortId !== undefined && targetHw.shortId !== null ? String(targetHw.shortId).trim() : '';
    const shortIdAuthorized = Boolean(configuredShortId && providedShortId && providedShortId === configuredShortId);
    if (configuredShareToken && !shortIdAuthorized) {
      const providedToken = String(body.token || body.shareToken || req.query.token || '').trim();
      if (!providedToken || providedToken !== configuredShareToken) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Valid share token is required to submit to this assignment'
        });
      }
    }

    const hwOwnerUid = String(targetHw?.ownerUid || '').trim();
    const bodyOwnerUid = String(body?.ownerUid || '').trim();
    if (hwOwnerUid && bodyOwnerUid && hwOwnerUid !== bodyOwnerUid) {
      return res.status(403).json({
        success: false,
        error: 'Submission ownerUid does not match assignment ownerUid'
      });
    }
    const check = validateServerSubmission(targetHw, body);
    if (!check.valid) {
      return res.status(check.status || 403).json({
        success: false,
        error: check.error || 'Submission validation failed'
      });
    }
    const resolvedOwnerUid = hwOwnerUid || bodyOwnerUid || undefined;
    const rawResponses = Array.isArray(body.responses) ? body.responses : [];
    const graded = await gradeServerHomeworkResponses(targetHw, rawResponses, {
      requireKnownQuestion: true
    });
    if (!graded.valid) {
      return res.status(graded.status || 400).json({
        success: false,
        error: graded.error || 'Invalid question or exercise reference in submission'
      });
    }
    // Score and rewards are computed ONLY from the server-verified responses:
    // the client's score / goldEarned / xpEarned / maxStreak are never trusted.
    const serverRewards = computeServerRewards(graded.verifiedResponses);
    const serverPct =
      graded.verifiedResponses.length > 0
        ? Math.round((serverRewards.correctCount / graded.verifiedResponses.length) * 100)
        : 0;
    const cleanSub = {
      ...body,
      ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
      audienceMode: check.audienceMode,
      studentId: check.normalizedStudentId,
      participantId: check.normalizedParticipantId,
      groupId: check.normalizedGroupId,
      studentName: check.normalizedStudentName,
      responses: graded.verifiedResponses,
      totalQuestions: graded.verifiedResponses.length,
      correctAnswersCount: serverRewards.correctCount,
      scorePercentage: serverPct,
      accuracyPercent: serverPct,
      accuracy: serverPct,
      score: serverRewards.correctCount,
      goldEarned: serverRewards.goldEarned,
      xpEarned: serverRewards.xpEarned,
      maxStreak: serverRewards.maxStreak,
      attemptNumber:
        typeof body.attemptNumber === 'number' && Number.isFinite(body.attemptNumber) && body.attemptNumber >= 1
          ? Math.floor(body.attemptNumber)
          : 1
    };
    delete cleanSub.assignmentFallback;

    if (cleanSub.id) {
      try {
        const result = await saveServerSubmission(cleanSub, targetHw);
        return res.json({
          success: true,
          submission: result.submission,
          ...(result.isIdempotentRetry ? { isIdempotentRetry: true } : {})
        });
      } catch (err: any) {
        return res.status(err?.status || 500).json({
          success: false,
          error: err?.message || 'Failed to persist submission to database'
        });
      }
    }
    return res.json({ success: true, submission: cleanSub });
  }
  return res.status(405).json({ success: false, error: 'Method not allowed' });
});

// Teacher-requested erasure of one student's homework data: deletes every
// submission of that student for one assignment from the server store. The
// teacher's own device purges its local copies via deleteStudentHomeworkData()
// (homeworkStorageSync.ts); the student's device keeps only its local,
// unsynced copy until it next syncs.
app.delete('/api/homework/student-data', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!bearerToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Firebase Bearer token is required' });
  }
  const verification = await verifyFirebaseIdToken(bearerToken);
  if (!verification.isValid || !verification.payload) {
    return res.status(401).json({
      success: false,
      error: `Unauthorized: ${verification.error || 'Invalid Firebase ID token'}`
    });
  }
  const verifiedUid = verification.payload.sub;
  const body = req.body || {};
  const assignmentId = String(body.assignmentId || '').trim();
  const studentId = String(body.studentId || '').trim();
  const participantId = String(body.participantId || '').trim();
  if (!assignmentId || (!studentId && !participantId)) {
    return res.status(400).json({
      success: false,
      error: 'assignmentId and studentId or participantId are required'
    });
  }
  try {
    const result = await deleteAuthoritativeSubmissionsForStudent(verifiedUid, assignmentId, {
      ...(studentId ? { studentId } : {}),
      ...(participantId ? { participantId } : {})
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(err?.status || 500).json({
      success: false,
      error: err?.message || 'Failed to delete student homework data'
    });
  }
});

app.get('/api/homework/short/:shortId', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const shortId = String(req.params.shortId || '').trim();
  if (!shortId || !/^[A-Za-z0-9]{6,10}$/.test(shortId)) {
    return res.status(400).json({
      error: 'رمز رابط الواجب المختصر غير صالح.',
      status: 'invalid_id'
    });
  }
  try {
    const resolved = await getAuthoritativeShortLink(shortId);
    if (resolved.status === 'invalid_id') {
      return res.status(400).json({
        error: 'رمز رابط الواجب المختصر غير صالح.',
        status: 'invalid_id'
      });
    }
    if (resolved.status === 'revoked') {
      return res.status(410).json({
        error: 'هذا الواجب تم حذفه أو إيقاف رابطه من قِبل المعلم.',
        status: 'revoked'
      });
    }
    if (resolved.status === 'not_found' || !resolved.assignment) {
      return res.status(404).json({
        error: 'رابط الواجب غير موجود أو منتهي الصلاحية.',
        status: 'not_found'
      });
    }
    if (!isServerAssignmentOpen(resolved.assignment)) {
      return res.status(410).json({
        error: 'هذا الواجب مغلق أو غير متاح حالياً من قِبل المعلم.',
        status: 'revoked'
      });
    }
    return res.json({
      status: 'resolved',
      shortId,
      assignment: sanitizePublicAssignmentInfo({ ...resolved.assignment, shortId })
    });
  } catch (err: any) {
    return res.status(err?.status || 500).json({
      error: err?.message || 'Short link lookup unavailable',
      status: 'network_error'
    });
  }
});

app.get('/api/homework/info', async (req, res) => {
  // Never let a browser/CDN reuse an old public assignment response after teacher deletion.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const shortIdParam = req.query.shortId ? String(req.query.shortId).trim() : '';
  if (shortIdParam) {
    try {
      const resolved = await getAuthoritativeShortLink(shortIdParam);
      if (resolved.status === 'invalid_id') {
        return res.status(400).json({ error: 'رمز رابط الواجب المختصر غير صالح.', status: 'invalid_id' });
      }
      if (resolved.status === 'revoked') {
        return res.status(410).json({ error: 'هذا الواجب تم حذفه أو إيقاف رابطه من قِبل المعلم.', status: 'revoked' });
      }
      if (resolved.status === 'not_found' || !resolved.assignment) {
        return res.status(404).json({ error: 'Assignment not found', status: 'not_found' });
      }
      if (!isServerAssignmentOpen(resolved.assignment)) {
        return res.status(403).json({ error: 'Assignment is closed or inactive', status: 'revoked' });
      }
      return res.json(sanitizePublicAssignmentInfo({ ...resolved.assignment, shortId: shortIdParam }));
    } catch (err: any) {
      return res.status(err?.status || 500).json({ error: err?.message || 'Assignment lookup unavailable' });
    }
  }

  const id = String(req.query.id || '').trim();
  const token = req.query.token !== undefined && req.query.token !== null ? String(req.query.token).trim() : '';
  let found: any = null;
  try {
    found = await getServerAssignment(id);
  } catch (err: any) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Assignment lookup unavailable' });
  }
  if (!found) {
    let wasRevoked = false;
    try {
      wasRevoked = await hasRevokedShortLinkForAssignment(id);
    } catch {
      wasRevoked = false;
    }
    return res.status(wasRevoked ? 403 : 404).json({
      error: wasRevoked ? 'Assignment has been deleted or its link has been revoked' : 'Assignment not found'
    });
  }
  if (!isServerAssignmentOpen(found)) {
    return res.status(403).json({ error: 'Assignment is closed or inactive' });
  }

  // Strict Share Token Enforcement:
  // If assignment has a configured shareToken, require exact match. Missing, empty, or mismatched tokens are rejected with 403.
  const configuredShareToken =
    found.shareToken !== undefined && found.shareToken !== null ? String(found.shareToken).trim() : '';

  if (configuredShareToken) {
    if (!token || token !== configuredShareToken) {
      return res.status(403).json({ error: 'Forbidden: Valid share token is required to access this assignment' });
    }
  }

  return res.json(sanitizePublicAssignmentInfo(found));
});

async function resolveAuthoritativeAssignmentSnapshot(targetHw: any): Promise<any> {
  let setSnapshot = targetHw?.setSnapshot || {};
  const fallbackSetId = String(targetHw?.setId || setSnapshot?.id || '').trim();
  if (
    fallbackSetId &&
    (!Array.isArray(setSnapshot?.items) || setSnapshot.items.length === 0) &&
    (!Array.isArray(setSnapshot?.customExercises) || setSnapshot.customExercises.length === 0) &&
    (!Array.isArray(setSnapshot?.grammarContent?.exercises) || setSnapshot.grammarContent.exercises.length === 0)
  ) {
    try {
      const hydratedSet = await getAuthoritativePublishedSet(fallbackSetId);
      if (hydratedSet) setSnapshot = hydratedSet;
    } catch {
      // Keep existing empty snapshot fallback
    }
  }
  return setSnapshot;
}

// --- Server-side verb re-grading (P0-2) ---
// Verb questions used to pass the client's isCorrect straight through.
// The server now recomputes the expected conjugated form from the assignment's
// verb data (the verbSnapshot embedded in the assignment, or the built-in verb
// library) and the subject slot, and compares the student's answer to it.

type ServerVerbEntry = {
  id: string;
  infinitive: string;
  praesens: Record<string, string>;
  exampleGerman?: string;
  isSeparable?: boolean;
  separablePrefix?: string;
};

function normalizeGermanWordForMatch(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^(der|die|das)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function verbEntryToServerVerb(entry: any): ServerVerbEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const praesens =
    entry.praesens && typeof entry.praesens === 'object'
      ? entry.praesens
      : entry.conjugation && typeof entry.conjugation === 'object'
        ? entry.conjugation
        : null;
  if (!praesens || typeof praesens.ich !== 'string') return null;
  const infinitive = String(entry.infinitive || entry.german || '').trim();
  if (!infinitive) return null;
  return {
    id: String(entry.id || entry.verbId || infinitive).trim(),
    infinitive,
    praesens,
    ...(typeof entry.exampleGerman === 'string' ? { exampleGerman: entry.exampleGerman } : {}),
    ...(typeof entry.isSeparable === 'boolean' ? { isSeparable: entry.isSeparable } : {}),
    ...(typeof entry.separablePrefix === 'string' ? { separablePrefix: entry.separablePrefix } : {})
  };
}

function resolveServerVerb(r: any, targetHw: any, setSnapshot: any): ServerVerbEntry | null {
  const verbId = String(r.verbId || r.itemId || '').trim();
  const infinitive = String(r.infinitive || '').trim();
  if (!verbId && !infinitive) return null;
  // 1. Assignment-embedded verb snapshot (covers custom verbs the teacher picked)
  const snapshotVerbs = Array.isArray(targetHw?.verbSnapshot) ? targetHw.verbSnapshot : [];
  for (const entry of snapshotVerbs) {
    const v = verbEntryToServerVerb(entry);
    if (!v) continue;
    if ((verbId && v.id === verbId) || (infinitive && v.infinitive.toLowerCase() === infinitive.toLowerCase())) {
      return v;
    }
  }
  // 2. Built-in verb library (2,200+ verbs with validated praesens forms)
  try {
    const libVerb =
      (verbId ? getVerbById(verbId) : undefined) || (infinitive ? getVerbByInfinitive(infinitive) : undefined);
    if (libVerb) {
      const v = verbEntryToServerVerb(libVerb);
      if (v) return v;
    }
  } catch {
    // Library lookup is pure data; never fail grading on it.
  }
  // 3. Set-snapshot items carrying conjugation data (custom set verbs)
  const items = Array.isArray(setSnapshot?.items) ? setSnapshot.items : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const itemId = String(item.id || '').trim();
    const itemGerman = String(item.german || '').trim();
    if (
      (verbId && itemId === verbId) ||
      (infinitive && itemGerman.toLowerCase() === infinitive.toLowerCase())
    ) {
      const v = verbEntryToServerVerb(item);
      if (v) return v;
    }
  }
  return null;
}

const VERB_PRONOUN_SLOT_BY_BARE_LABEL: Record<string, string> = {
  ich: 'ich',
  du: 'du',
  er: 'er_sie_es',
  es: 'er_sie_es',
  wir: 'wir',
  ihr: 'ihr',
  Sie: 'sie_Sie'
};

function resolveVerbSubjectSlot(r: any): string | null {
  const subjectRaw = String(r.subject || '').trim();
  if (subjectRaw) {
    const byDisplay = SUBJECT_PROMPTS.find((p: any) => p.displayLabel === subjectRaw);
    if (byDisplay) return byDisplay.slot;
    // labelDe is ambiguous for 'sie' (she/they share it), so only use it when
    // exactly one prompt carries that label.
    const byLabel = SUBJECT_PROMPTS.filter((p: any) => p.labelDe === subjectRaw);
    if (byLabel.length === 1) return byLabel[0].slot;
    const bare = VERB_PRONOUN_SLOT_BY_BARE_LABEL[subjectRaw];
    if (bare) return bare;
  }
  // Fall back to the first word of germanWord ("ich spielt" -> labelDe "ich")
  const germanWord = String(r.germanWord || '').trim();
  if (germanWord) {
    const firstToken = germanWord.split(/\s+/)[0] || '';
    const byLabel = SUBJECT_PROMPTS.filter((p: any) => p.labelDe === firstToken);
    if (byLabel.length === 1) return byLabel[0].slot;
    const bare = VERB_PRONOUN_SLOT_BY_BARE_LABEL[firstToken];
    if (bare) return bare;
  }
  return null;
}

function gradeVerbResponse(
  r: any,
  verb: ServerVerbEntry,
  studentAns: string
): { ok: boolean; isCorrect?: boolean; error?: string } {
  const qType = String(r.questionType || r.type || '');
  const normalizedAns = studentAns.trim().toLowerCase();
  if (qType === 'verb_sentence') {
    if (!verb.exampleGerman || !verb.exampleGerman.trim()) {
      return { ok: false, error: 'Verb sentence question cannot be re-graded: no example sentence on the server' };
    }
    const exercise = buildVerbSentenceGapExercise(
      {
        ...verb,
        arabic: '',
        exampleArabic: '',
        level: 'A1',
        classifications: [],
        isReflexive: false,
        topics: [],
        meta: {}
      } as any
    );
    return {
      ok: true,
      isCorrect: normalizedAns === String(exercise.correctAnswer).trim().toLowerCase()
    };
  }
  // verb_conjugation (default for verb questions)
  const slot = resolveVerbSubjectSlot(r);
  if (!slot) {
    return { ok: false, error: 'Unknown verb subject: the conjugated form cannot be verified' };
  }
  const expected = resolveVerbPraesensForm(verb as any, slot as any);
  if (!expected) {
    return { ok: false, error: 'Unknown verb form for this subject' };
  }
  return { ok: true, isCorrect: normalizedAns === String(expected).trim().toLowerCase() };
}

// Derives the expected answer for a vocabulary question from the server's set
// item and the question type. Returns undefined when the type cannot be
// re-graded from set data (true_false needs the shown pairing's truth value;
// syllables need the tile assembly) — callers must then NOT guess.
function deriveExpectedVocabAnswer(itemMatch: any, type: string, expectedField: any): string | undefined {
  const t = String(type || '').toLowerCase();
  const field = String(expectedField || '');
  if (t.includes('article') || t.includes('der_die_das') || t === 'article_quiz' || field === 'article') {
    const explicitArticle = typeof itemMatch.article === 'string' ? itemMatch.article.trim() : '';
    const extractedMatch =
      !explicitArticle && typeof itemMatch.german === 'string'
        ? itemMatch.german.trim().match(/^(der|die|das)\s+/i)
        : null;
    return explicitArticle || (extractedMatch ? extractedMatch[1].toLowerCase() : undefined);
  }
  if (t.includes('missing') || field === 'missingLetterWord') {
    return itemMatch.missingLetterWord || itemMatch.german;
  }
  if (t.includes('sentence') || t.includes('order') || field === 'exampleSentenceGerman') {
    return (
      itemMatch.exampleSentenceGerman ||
      (Array.isArray(itemMatch.sentence4Elements) ? itemMatch.sentence4Elements.join(' ') : itemMatch.german)
    );
  }
  if (t === 'mc_de_ar' || t.includes('arabic') || field === 'arabic') {
    return itemMatch.arabic;
  }
  if (t === 'listen_choose') {
    return itemMatch.german && itemMatch.arabic ? `${itemMatch.german} — (${itemMatch.arabic})` : undefined;
  }
  if (
    t === 'choice_2' ||
    t === 'choice_all' ||
    t === 'mc_ar_de' ||
    t === 'full_word' ||
    t.includes('german') ||
    t.includes('vocab') ||
    t.includes('translation') ||
    field === 'german'
  ) {
    return itemMatch.german;
  }
  return undefined;
}

// Computes the server-side reward fields from verified responses only.
// The gold feature was removed from the UI, but the teacher report still shows
// "points" per submission; the server awards a flat 10 points per verified
// correct answer and the longest verified correct streak, so a forged client
// value can never inflate them.
function computeServerRewards(verifiedResponses: any[]): {
  goldEarned: number;
  xpEarned: number;
  maxStreak: number;
  correctCount: number;
} {
  let correctCount = 0;
  let maxStreak = 0;
  let run = 0;
  for (const r of verifiedResponses) {
    if (r && r.isCorrect) {
      correctCount += 1;
      run += 1;
      if (run > maxStreak) maxStreak = run;
    } else {
      run = 0;
    }
  }
  return { goldEarned: correctCount * 10, xpEarned: correctCount * 10, maxStreak, correctCount };
}

async function gradeServerHomeworkResponses(
  targetHw: any,
  responses: any[],
  options?: { requireKnownQuestion?: boolean }
): Promise<{ valid: boolean; status?: number; error?: string; verifiedResponses: any[] }> {
  const setSnapshot = await resolveAuthoritativeAssignmentSnapshot(targetHw);
  const serverCustomExercises = Array.isArray(setSnapshot?.customExercises) ? setSnapshot.customExercises : [];
  const serverGrammarExercises = Array.isArray(setSnapshot?.grammarContent?.exercises)
    ? setSnapshot.grammarContent.exercises
    : [];
  const allExercises = [...serverGrammarExercises, ...serverCustomExercises].filter(
    (ex: any) => ex && typeof ex === 'object' && ex.id !== undefined && ex.id !== null
  );
  const selectedGrammarIds = Array.isArray(targetHw?.selectedGrammarExerciseIds)
    ? targetHw.selectedGrammarExerciseIds.map((id: any) => String(id).trim()).filter(Boolean)
    : [];
  const allowedExerciseIds =
    selectedGrammarIds.length > 0 && allExercises.some((ex: any) => selectedGrammarIds.includes(String(ex.id)))
      ? new Set(selectedGrammarIds)
      : null;

  const serverItems = Array.isArray(setSnapshot?.items) ? setSnapshot.items : [];
  const selectedItemIds = Array.isArray(targetHw?.selectedItemIds)
    ? targetHw.selectedItemIds.map((id: any) => String(id).trim()).filter(Boolean)
    : [];
  const allowedItemIds =
    selectedItemIds.length > 0 && serverItems.some((it: any) => selectedItemIds.includes(String(it.id)))
      ? new Set(selectedItemIds)
      : null;

  const selectedVerbIds = Array.isArray(targetHw?.selectedVerbIds)
    ? targetHw.selectedVerbIds.map((id: any) => String(id).trim()).filter(Boolean)
    : [];
  const snapshotVerbIds = Array.isArray(targetHw?.verbSnapshot)
    ? targetHw.verbSnapshot.map((v: any) => String(v?.id || '').trim()).filter(Boolean)
    : [];
  const allowedVerbIds =
    selectedVerbIds.length > 0 || snapshotVerbIds.length > 0
      ? new Set([...selectedVerbIds, ...snapshotVerbIds])
      : null;

  const findExerciseMatch = (r: any): any | undefined => {
    const exId = r.exerciseId !== undefined && r.exerciseId !== null ? String(r.exerciseId).trim() : '';
    const itId = r.itemId !== undefined && r.itemId !== null ? String(r.itemId).trim() : '';
    const qId = r.questionId !== undefined && r.questionId !== null ? String(r.questionId).trim() : '';
    const fallbackId = r.id !== undefined && r.id !== null ? String(r.id).trim() : '';

    return allExercises.find((ex: any) => {
      const idStr = String(ex.id).trim();
      if (!idStr) return false;
      if (exId && exId === idStr) return true;
      if (itId && itId === idStr) return true;
      if (qId) {
        if (qId === idStr || qId === `gram_${idStr}` || qId.startsWith(`gram_${idStr}_`)) return true;
      }
      if (fallbackId && (fallbackId === idStr || fallbackId === `gram_${idStr}`)) return true;
      return false;
    });
  };

  const verifiedResponses: any[] = [];
  for (const r of responses) {
    if (!r || typeof r !== 'object') {
      verifiedResponses.push(r);
      continue;
    }
    const targetQId = r.exerciseId || r.questionId || r.itemId || r.id;
    const qType = String(r.questionType || r.type || '');
    const isVerbQ = Boolean(r.isVerbQuestion || qType === 'verb_conjugation' || qType === 'verb_sentence');

    const matchedExercise = findExerciseMatch(r);
    if (matchedExercise) {
      if (allowedExerciseIds && !allowedExerciseIds.has(String(matchedExercise.id).trim())) {
        return {
          valid: false,
          status: 400,
          error: 'Unassigned grammar exercise ID referenced in request',
          verifiedResponses: []
        };
      }
      if (matchedExercise.correctAnswer !== undefined && matchedExercise.correctAnswer !== null) {
        const studentAns = String(
          r.selectedAnswer ?? r.studentAnswer ?? r.answer ?? r.submittedAnswer ?? r.text ?? ''
        ).trim();
        const isActuallyCorrect = evaluateNormalizedGrammarAnswer(studentAns, {
          correctAnswer: String(matchedExercise.correctAnswer),
          acceptedAnswers: Array.isArray(matchedExercise.acceptedAnswers)
            ? matchedExercise.acceptedAnswers.map(String)
            : undefined
        });
        const cleanedR = { ...r, isCorrect: isActuallyCorrect, serverVerified: true };
        delete cleanedR.pendingServerGrading;
        verifiedResponses.push(cleanedR);
        continue;
      }
    } else if (
      !isVerbQ &&
      (r.exerciseId ||
        qType === 'grammar_exercise' ||
        r.grammarType ||
        (allExercises.length > 0 && serverItems.length === 0))
    ) {
      return {
        valid: false,
        status: 400,
        error: 'Unknown or unassigned grammar exercise ID',
        verifiedResponses: []
      };
    }

    // Verb questions are ALWAYS re-graded on the server now: the client's
    // isCorrect is never trusted for them. A verb the server cannot resolve
    // (not in the assignment snapshot, the verb library, or the set) rejects
    // the whole submission instead of silently trusting the client.
    if (isVerbQ) {
      const verb = resolveServerVerb(r, targetHw, setSnapshot);
      if (!verb) {
        return {
          valid: false,
          status: 400,
          error: 'Unknown or unassigned verb reference in request',
          verifiedResponses: []
        };
      }
      if (allowedVerbIds && !allowedVerbIds.has(verb.id)) {
        return {
          valid: false,
          status: 400,
          error: 'Unassigned verb ID referenced in request',
          verifiedResponses: []
        };
      }
      const studentAns = String(
        r.selectedAnswer ?? r.studentAnswer ?? r.answer ?? r.submittedAnswer ?? r.text ?? ''
      ).trim();
      const graded = gradeVerbResponse(r, verb, studentAns);
      if (!graded.ok) {
        return {
          valid: false,
          status: 400,
          error: graded.error || 'Verb question could not be re-graded on the server',
          verifiedResponses: []
        };
      }
      const cleanedR = {
        ...r,
        isCorrect: Boolean(graded.isCorrect),
        serverVerified: true,
        isVerbQuestion: true,
        ...(r.verbId ? { verbId: String(r.verbId) } : {}),
        ...(r.infinitive ? { infinitive: String(r.infinitive) } : {}),
        ...(r.subject ? { subject: String(r.subject) } : {}),
        ...(r.sentence ? { sentence: String(r.sentence) } : {})
      };
      delete cleanedR.pendingServerGrading;
      verifiedResponses.push(cleanedR);
      continue;
    }

    // Vocabulary re-grading: resolve the item by explicit itemId when present
    // (the client sends it since the fix-all batch), otherwise by the german
    // word the question asked about. A claimed itemId that does not exist is
    // rejected.
    const type = String(r.type || r.questionType || r.mode || '').toLowerCase();
    const studentAns = String(
      r.selectedAnswer ?? r.studentAnswer ?? r.answer ?? r.submittedAnswer ?? r.text ?? ''
    ).trim();
    let itemMatch: any = undefined;
    if (r.itemId && serverItems.length > 0) {
      itemMatch = serverItems.find((it: any) => String(it.id) === String(r.itemId));
      if (!itemMatch) {
        return {
          valid: false,
          status: 400,
          error: 'Unknown or unassigned vocabulary item ID',
          verifiedResponses: []
        };
      }
    } else if (!r.itemId && r.germanWord && serverItems.length > 0) {
      const wanted = normalizeGermanWordForMatch(r.germanWord);
      if (wanted) {
        itemMatch = serverItems.find((it: any) => normalizeGermanWordForMatch(it.german) === wanted);
      }
    }
    if (itemMatch) {
      if (allowedItemIds && !allowedItemIds.has(String(itemMatch.id).trim())) {
        return {
          valid: false,
          status: 400,
          error: 'Unassigned vocabulary item ID referenced in request',
          verifiedResponses: []
        };
      }
      const expected = deriveExpectedVocabAnswer(itemMatch, type, r.expectedField);
      if (expected !== undefined && expected !== null) {
        const isActuallyCorrect = studentAns.toLowerCase() === String(expected).trim().toLowerCase();
        const cleanedR = { ...r, isCorrect: isActuallyCorrect, serverVerified: true };
        delete cleanedR.pendingServerGrading;
        verifiedResponses.push(cleanedR);
        continue;
      }
      // Item resolved but the question type is not verifiable from set data
      // (true_false, syllables): fall through to the unverified path below.
    }

    if (options?.requireKnownQuestion) {
      // Inherently unverifiable question types have no server-side answer key
      // (true_false / syllables cannot be derived from set data), and neither
      // does a matched grammar exercise without a correctAnswer. Rejecting
      // those would break legitimate homework that contains them, so they keep
      // the client's value flagged serverVerified: false below. Everything
      // else must resolve against the assignment snapshot.
      const unverifiableType = type === 'true_false' || type === 'syllables';
      const matchedExerciseWithoutKey = Boolean(matchedExercise);
      if (!unverifiableType && !matchedExerciseWithoutKey) {
        return {
          valid: false,
          status: 400,
          error: 'Question could not be resolved against assignment snapshot',
          verifiedResponses: []
        };
      }
    }
    // RESIDUAL GAP (P0-2, documented): responses the server cannot resolve
    // against the assignment snapshot (no itemId and no matching german word,
    // or a true_false/syllables question, or a grammar exercise without an
    // answer key) still carry the client's isCorrect, marked
    // serverVerified: false so the teacher-facing data can tell them apart.
    // requireKnownQuestion (used by the submit routes) rejects every other
    // unresolvable response instead of trusting it.
    verifiedResponses.push({ ...r, serverVerified: false });
  }

  return { valid: true, verifiedResponses };
}

app.post('/api/homework/check-answer', async (req, res) => {
  const body = req.body || {};
  const providedShortId = String(body.shortId || req.query.shortId || '').trim();
  const assignmentId = String(body.assignmentId || body.homeworkId || '').trim();
  let targetHw: any = null;
  try {
    if (assignmentId) {
      targetHw = await getServerAssignment(assignmentId);
    } else if (providedShortId) {
      const resolved = await getAuthoritativeShortLink(providedShortId);
      if (resolved.status === 'resolved' && resolved.assignment) {
        targetHw = resolved.assignment;
      } else if (resolved.status === 'revoked') {
        return res.status(403).json({ success: false, error: 'Assignment link revoked' });
      }
    }
  } catch (err: any) {
    return res.status(err?.status || 500).json({
      success: false,
      error: err?.message || 'Failed to load assignment from database'
    });
  }

  if (!targetHw) {
    return res.status(404).json({ success: false, error: 'Assignment not found' });
  }
  if (!isServerAssignmentOpen(targetHw)) {
    return res.status(403).json({ success: false, error: 'Assignment is closed or inactive' });
  }

  const configuredShareToken =
    targetHw.shareToken !== undefined && targetHw.shareToken !== null ? String(targetHw.shareToken).trim() : '';
  const configuredShortId =
    targetHw.shortId !== undefined && targetHw.shortId !== null ? String(targetHw.shortId).trim() : '';
  const shortIdAuthorized = Boolean(configuredShortId && providedShortId && providedShortId === configuredShortId);
  if (configuredShareToken && !shortIdAuthorized) {
    const providedToken = String(body.token || body.shareToken || req.query.token || '').trim();
    if (!providedToken || providedToken !== configuredShareToken) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Valid share token is required'
      });
    }
  }

  // Answer-key oracle cap: one probe per question is legitimate, enumerating
  // the whole key is not. 300 probes per link + IP per hour is far above any
  // real homework (one check per question, ~100 questions max).
  const oracleCheck = checkCheckAnswerAttemptCap(
    `${providedShortId || assignmentId || targetHw.id}:${getHomeworkClientIp(req)}`
  );
  if (!oracleCheck.allowed) {
    res.setHeader('Retry-After', String(oracleCheck.retryAfterSeconds || 3600));
    return res.status(429).json({
      success: false,
      error: 'تم تجاوز عدد محاولات التحقق المسموح به لهذا الرابط — يرجى المحاولة لاحقاً.'
    });
  }

  const studentAnswer = String(
    body.selectedAnswer ?? body.studentAnswer ?? body.answer ?? body.submittedAnswer ?? ''
  ).trim();
  if (!studentAnswer) {
    return res.status(400).json({ success: false, error: 'Student answer is required' });
  }

  const graded = await gradeServerHomeworkResponses(
    targetHw,
    [
      {
        questionId: body.questionId,
        exerciseId: body.exerciseId,
        itemId: body.itemId,
        questionType: body.questionType || body.type || 'grammar_exercise',
        grammarType: body.grammarType,
        expectedField: body.expectedField,
        selectedAnswer: studentAnswer
      }
    ],
    { requireKnownQuestion: true }
  );

  if (!graded.valid) {
    return res.status(graded.status || 400).json({
      success: false,
      error: graded.error || 'Unknown or unassigned question'
    });
  }

  return res.json({
    success: true,
    isCorrect: Boolean(graded.verifiedResponses[0]?.isCorrect)
  });
});

app.post('/api/homework/submit', async (req, res) => {
  const rawBody = req.body || {};
  const body =
    rawBody.submission && typeof rawBody.submission === 'object'
      ? { ...rawBody, ...rawBody.submission, assignmentId: rawBody.submission.assignmentId || rawBody.submission.homeworkId || rawBody.assignmentId || rawBody.homeworkId }
      : { ...rawBody, assignmentId: rawBody.assignmentId || rawBody.homeworkId };
  const providedShortId = String(body.shortId || req.query.shortId || '').trim();
  // V-05: Never accept untrusted client-supplied body.assignmentFallback
  let targetHw: any = null;
  try {
    targetHw = await getServerAssignment(body.assignmentId);
  } catch (err: any) {
    return res.status(err?.status || 500).json({
      success: false,
      error: err?.message || 'Failed to load assignment from database'
    });
  }
  if (!targetHw) {
    let wasRevoked = false;
    try {
      if (providedShortId) {
        const shortResolved = await getAuthoritativeShortLink(providedShortId);
        wasRevoked = shortResolved.status === 'revoked';
      }
      if (!wasRevoked && body.assignmentId) {
        wasRevoked = await hasRevokedShortLinkForAssignment(String(body.assignmentId));
      }
    } catch {
      wasRevoked = false;
    }
    return res.status(wasRevoked ? 403 : 404).json({
      success: false,
      error: wasRevoked
        ? 'Assignment has been deleted or its link has been revoked and no longer accepts submissions'
        : 'Assignment not found'
    });
  }
  if (!isServerAssignmentOpen(targetHw)) {
    return res.status(403).json({
      success: false,
      error: 'Assignment is closed or inactive and no longer accepts submissions'
    });
  }

  // Strict Share Token / ShortId Capability Enforcement:
  const configuredShareToken =
    targetHw.shareToken !== undefined && targetHw.shareToken !== null ? String(targetHw.shareToken).trim() : '';
  const configuredShortId =
    targetHw.shortId !== undefined && targetHw.shortId !== null ? String(targetHw.shortId).trim() : '';
  const shortIdAuthorized = Boolean(configuredShortId && providedShortId && providedShortId === configuredShortId);
  if (configuredShareToken && !shortIdAuthorized) {
    const providedToken = String(body.token || body.shareToken || req.query.token || '').trim();
    if (!providedToken || providedToken !== configuredShareToken) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Valid share token is required to submit to this assignment'
      });
    }
  }

  const hwOwnerUid = String(targetHw?.ownerUid || '').trim();
  const bodyOwnerUid = String(body?.ownerUid || '').trim();
  if (hwOwnerUid && bodyOwnerUid && hwOwnerUid !== bodyOwnerUid) {
    return res.status(403).json({
      success: false,
      error: 'Submission ownerUid does not match assignment ownerUid'
    });
  }
  const check = validateServerSubmission(targetHw, body);
  if (!check.valid) {
    return res.status(check.status || 403).json({
      success: false,
      error: check.error || 'Submission rejected'
    });
  }

  const responses = Array.isArray(body.responses) ? body.responses : [];
  const graded = await gradeServerHomeworkResponses(targetHw, responses, {
    requireKnownQuestion: true
  });
  if (!graded.valid) {
    return res.status(graded.status || 400).json({
      success: false,
      error: graded.error || 'Invalid question or exercise reference in submission'
    });
  }
  const verifiedResponses = graded.verifiedResponses;

  const isInProgress = body.status === 'in_progress' && !body.completedAt;
  const correctCount = verifiedResponses.filter((r: any) => r && r.isCorrect).length;
  const totalQ = isInProgress
    ? Math.max(verifiedResponses.length, Number(body.totalQuestions) || 0)
    : verifiedResponses.length;
  const pct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  const nowIso = new Date().toISOString();
  const hasExplicitStartedAt = typeof body.startedAt === 'string' && body.startedAt.trim().length > 0;
  const hasExplicitCompletedAt = typeof body.completedAt === 'string' && body.completedAt.trim().length > 0;
  const hasExplicitTimeSpent =
    typeof body.timeSpentSeconds === 'number' &&
    Number.isFinite(body.timeSpentSeconds) &&
    body.timeSpentSeconds > 0;
  const effectiveCompletedAt = isInProgress ? '' : (hasExplicitCompletedAt ? String(body.completedAt).trim() : nowIso);
  const startMs = hasExplicitStartedAt ? new Date(body.startedAt).getTime() : Date.now() - totalQ * 4000;
  const endMs = !isInProgress && hasExplicitCompletedAt ? new Date(effectiveCompletedAt).getTime() : Date.now();
  const timeSpentSeconds = hasExplicitTimeSpent
    ? Math.max(isInProgress ? 1 : 5, Math.round(body.timeSpentSeconds))
    : Math.max(isInProgress ? 1 : 5, Math.round((endMs - startMs) / 1000));
  const resolvedOwnerUid = hwOwnerUid || bodyOwnerUid || undefined;

  // Rewards are computed ONLY from the server-verified responses: the client's
  // goldEarned / xpEarned / maxStreak are ignored (a forged value can never
  // inflate them). attemptNumber stays client-supplied but is informational
  // only — maxAttempts is enforced by counting stored submissions server-side.
  const serverRewards = computeServerRewards(verifiedResponses);

  const submission: any = {
    id: body.id || `sub_${body.assignmentId || 'hw'}_${Date.now()}`,
    assignmentId: body.assignmentId,
    ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
    ...(body.attemptSecret ? { attemptSecret: String(body.attemptSecret).trim() } : {}),
    audienceMode: check.audienceMode,
    studentId: check.normalizedStudentId,
    participantId: check.normalizedParticipantId,
    groupId: check.normalizedGroupId,
    studentName: check.normalizedStudentName,
    attemptNumber: body.attemptNumber || 1,
    status: isInProgress ? 'in_progress' : 'completed',
    startedAt: hasExplicitStartedAt ? String(body.startedAt).trim() : nowIso,
    completedAt: effectiveCompletedAt,
    updatedAt: nowIso,
    timeSpentSeconds,
    totalQuestions: totalQ,
    correctAnswersCount: correctCount,
    scorePercentage: pct,
    accuracyPercent: pct,
    score: correctCount,
    accuracy: pct,
    goldEarned: serverRewards.goldEarned,
    xpEarned: serverRewards.xpEarned,
    maxStreak: serverRewards.maxStreak,
    completedStudyPhase: Boolean(body.completedStudyPhase),
    ...(body.gamification && typeof body.gamification === 'object'
      ? { gamification: body.gamification }
      : {}),
    responses: verifiedResponses,
    _serverDefaultedStartedAt: !hasExplicitStartedAt,
    _serverDefaultedCompletedAt: !isInProgress && !hasExplicitCompletedAt,
    _serverComputedTimeSpent: !hasExplicitTimeSpent
  };

  try {
    const result = await saveServerSubmission(submission, targetHw);
    return res.json({
      success: true,
      submission: result.submission,
      ...(result.isIdempotentRetry ? { isIdempotentRetry: true } : {})
    });
  } catch (err: any) {
    return res.status(err?.status || 500).json({
      success: false,
      error: err?.message || 'Failed to persist submission to database'
    });
  }
});

// 6. P2P-Style Workspace Delta Relay Store (per workspaceId) with Mandatory Firebase ID Token Cryptographic Verification
const workspaceChunksRelayStore = new Map<string, Map<string, any>>();

export interface FirebaseTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  user_id?: string;
  email?: string;
  exp: number;
  iat?: number;
  auth_time: number;
  [key: string]: any;
}

let cachedGoogleCerts: Record<string, string> | null = null;
let cachedGoogleCertsExpiry = 0;

export function resetGooglePublicCertsCacheForTesting(): void {
  cachedGoogleCerts = null;
  cachedGoogleCertsExpiry = 0;
}

export function setGooglePublicCertsCacheForTesting(certs: Record<string, string> | null, expiryMs: number): void {
  cachedGoogleCerts = certs;
  cachedGoogleCertsExpiry = expiryMs;
}

export async function fetchGooglePublicCerts(): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (!res.ok) {
      console.warn(`Failed to fetch Google public certs: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as Record<string, string>;
    const cc = res.headers.get('cache-control') || '';
    const match = cc.match(/max-age=(\d+)/i);
    // Respect Cache-Control max-age directly without imposing an artificial minimum beyond declared header
    const maxAgeSeconds = match ? parseInt(match[1], 10) : 3600;
    cachedGoogleCerts = data;
    cachedGoogleCertsExpiry = Date.now() + (maxAgeSeconds * 1000);
    return data;
  } catch (err) {
    console.warn('Network error fetching Google public certs:', err);
    return null;
  }
}

export async function getGooglePublicCerts(kid?: string): Promise<Record<string, string>> {
  const now = Date.now();
  const isCacheExpired = !cachedGoogleCerts || now >= cachedGoogleCertsExpiry;

  if (isCacheExpired) {
    const freshCerts = await fetchGooglePublicCerts();
    if (!freshCerts) {
      // If certificates expired and remote fetch fails, reject token verification immediately - NEVER use expired certificates!
      cachedGoogleCerts = null;
      cachedGoogleCertsExpiry = 0;
      return {};
    }
  } else if (kid && !cachedGoogleCerts[kid]) {
    // Certificate rotation: if requested kid is missing, attempt to refresh
    const freshCerts = await fetchGooglePublicCerts();
    if (!freshCerts && now >= cachedGoogleCertsExpiry) {
      cachedGoogleCerts = null;
      cachedGoogleCertsExpiry = 0;
      return {};
    }
  }

  // Ensure we never return certificates if cache is expired
  if (now >= cachedGoogleCertsExpiry) {
    cachedGoogleCerts = null;
    return {};
  }

  return cachedGoogleCerts || {};
}

export function emailToLegacyWorkspaceId(email: string): string {
  const clean = (email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return clean ? `ws_${clean.slice(0, 90)}` : '';
}

export async function verifyFirebaseIdToken(
  token: string,
  expectedProjectId = 'glueck-c8621',
  certsOverride?: Record<string, string>
): Promise<{
  isValid: boolean;
  payload: FirebaseTokenPayload | null;
  error?: string;
}> {
  if (!token || typeof token !== 'string') {
    return { isValid: false, payload: null, error: 'Token is missing or empty' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { isValid: false, payload: null, error: 'Malformed JWT format: Expected 3 dot-separated segments' };
  }

  // 1. Parse and validate JWT Header
  let header: { alg?: string; kid?: string; typ?: string };
  try {
    const headerStr = Buffer.from(parts[0], 'base64url').toString('utf8');
    header = JSON.parse(headerStr);
  } catch {
    return { isValid: false, payload: null, error: 'Malformed JWT header' };
  }

  if (!header || typeof header !== 'object') {
    return { isValid: false, payload: null, error: 'JWT header is not an object' };
  }

  if (header.alg !== 'RS256') {
    return { isValid: false, payload: null, error: `Invalid signing algorithm: Expected RS256, got ${header.alg}` };
  }

  if (!header.kid || typeof header.kid !== 'string' || header.kid.trim() === '') {
    return { isValid: false, payload: null, error: 'Missing or empty kid in JWT header' };
  }

  // 2. Retrieve public certificate (mandatory, with key rotation handling)
  let cert: string | undefined;
  if (certsOverride) {
    cert = certsOverride[header.kid];
  } else {
    const certs = await getGooglePublicCerts(header.kid);
    cert = certs[header.kid];
  }

  if (!cert) {
    return {
      isValid: false,
      payload: null,
      error: `Matching Google public certificate unavailable for kid: ${header.kid}`
    };
  }

  // 3. Cryptographic Signature Verification (MANDATORY - NEVER ACCEPT UNVERIFIED TOKEN)
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    const isSignatureValid = verifier.verify(cert, parts[2], 'base64url');
    if (!isSignatureValid) {
      return {
        isValid: false,
        payload: null,
        error: 'Cryptographic signature verification failed: Signature does not match public key'
      };
    }
  } catch (verifyErr: any) {
    return {
      isValid: false,
      payload: null,
      error: `Cryptographic signature verification error: ${verifyErr?.message || 'Verification exception'}`
    };
  }

  // 4. Parse and validate JWT Payload Claims (Only evaluated after signature is cryptographically verified)
  let payload: FirebaseTokenPayload;
  try {
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    payload = JSON.parse(payloadStr);
  } catch {
    return { isValid: false, payload: null, error: 'Malformed JWT payload' };
  }

  if (!payload || typeof payload !== 'object') {
    return { isValid: false, payload: null, error: 'JWT payload is not an object' };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Audience must match Firebase project ID
  if (payload.aud !== expectedProjectId) {
    return {
      isValid: false,
      payload: null,
      error: `Invalid token audience: Expected ${expectedProjectId}, got ${payload.aud}`
    };
  }

  // Issuer must match https://securetoken.google.com/<projectId>
  if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    return {
      isValid: false,
      payload: null,
      error: `Invalid token issuer: Expected https://securetoken.google.com/${expectedProjectId}, got ${payload.iss}`
    };
  }

  // Subject (UID) must be non-empty string <= 128 chars
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    return { isValid: false, payload: null, error: 'Invalid or missing token subject (sub/uid)' };
  }

  // Expiration check (with 5 seconds grace for minor clock drift)
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec - 5) {
    return { isValid: false, payload: null, error: 'Token has expired' };
  }

  // Issued at (iat) check (tolerance up to 60s in future for clock skew)
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 60) {
    return { isValid: false, payload: null, error: 'Token issued in the future (iat)' };
  }

  // Mandatory auth_time check: must be a valid finite number and cannot be in the future (within 60s tolerance)
  if (typeof payload.auth_time !== 'number' || !Number.isFinite(payload.auth_time)) {
    return { isValid: false, payload: null, error: 'Missing or invalid mandatory token auth_time' };
  }
  if (payload.auth_time > nowSec + 60) {
    return { isValid: false, payload: null, error: 'Token auth_time is in the future' };
  }

  return { isValid: true, payload };
}

app.all('/api/workspace/delta', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  // 1. Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Valid Firebase ID token is required to access workspace relay.'
    });
  }

  // 2. Verify token claims and signature
  const verification = await verifyFirebaseIdToken(token);
  if (!verification.isValid || !verification.payload) {
    return res.status(401).json({
      error: `Unauthorized: ${verification.error || 'Invalid Firebase ID token'}`
    });
  }

  const authenticatedUid = verification.payload.sub;
  const legacyId = verification.payload.email ? emailToLegacyWorkspaceId(verification.payload.email) : null;
  const allowedWorkspaceIds = new Set<string>([authenticatedUid]);
  if (legacyId) allowedWorkspaceIds.add(legacyId);

  // 3. Handle GET
  if (req.method === 'GET') {
    const workspaceId = String(req.query.workspaceId || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }
    if (!allowedWorkspaceIds.has(workspaceId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to read this workspace relay.' });
    }
    const docsMap = workspaceChunksRelayStore.get(workspaceId);
    const docs = docsMap ? Array.from(docsMap.values()) : [];
    return res.json({ success: true, docs });
  }

  // 4. Handle POST
  if (req.method === 'POST') {
    const { workspaceId, chunks } = req.body || {};
    if (!workspaceId || !Array.isArray(chunks)) {
      return res.status(400).json({ error: 'Invalid delta payload' });
    }
    if (!allowedWorkspaceIds.has(workspaceId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to write to this workspace relay.' });
    }

    // Validate every chunk against the same shape as the Firestore rules'
    // isValidWorkspaceChunk() and cap count/size: the relay stores chunks in
    // process memory, so an unbounded POST could exhaust it.
    const MAX_DELTA_CHUNKS = 200;
    const MAX_CHUNK_CHARS = 750000;
    const MAX_TOTAL_CHUNK_CHARS = 10000000;
    if (chunks.length > MAX_DELTA_CHUNKS) {
      return res.status(413).json({ error: `Too many chunks: at most ${MAX_DELTA_CHUNKS} per request` });
    }
    let totalChars = 0;
    for (const chunk of chunks) {
      const validChunk =
        chunk &&
        typeof chunk === 'object' &&
        typeof chunk.id === 'string' &&
        chunk.id.length >= 1 &&
        chunk.id.length <= 128 &&
        typeof chunk.categoryKey === 'string' &&
        chunk.categoryKey.length >= 1 &&
        chunk.categoryKey.length <= 100 &&
        typeof chunk.chunkIndex === 'number' &&
        chunk.chunkIndex >= 0 &&
        chunk.chunkIndex <= 200 &&
        typeof chunk.totalChunks === 'number' &&
        chunk.totalChunks >= 1 &&
        chunk.totalChunks <= 200 &&
        typeof chunk.updatedAtMs === 'number' &&
        chunk.updatedAtMs >= 0 &&
        typeof chunk.updatedAtIso === 'string' &&
        chunk.updatedAtIso.length >= 1 &&
        chunk.updatedAtIso.length <= 64 &&
        typeof chunk.deviceId === 'string' &&
        chunk.deviceId.length >= 1 &&
        chunk.deviceId.length <= 100 &&
        typeof chunk.payloadChunk === 'string' &&
        chunk.payloadChunk.length <= MAX_CHUNK_CHARS;
      if (!validChunk) {
        return res.status(400).json({ error: 'Invalid workspace chunk: chunk shape does not match isValidWorkspaceChunk' });
      }
      totalChars += chunk.payloadChunk.length;
      if (totalChars > MAX_TOTAL_CHUNK_CHARS) {
        return res.status(413).json({ error: 'Delta payload too large' });
      }
      // Verify chunk ownership to prevent chunk injection
      if (chunk?.ownerUid && chunk.ownerUid !== authenticatedUid) {
        return res.status(403).json({ error: 'Forbidden: Injected chunk ownerUid does not match authenticated user.' });
      }
    }

    let docsMap = workspaceChunksRelayStore.get(workspaceId);
    if (!docsMap) {
      docsMap = new Map<string, any>();
      workspaceChunksRelayStore.set(workspaceId, docsMap);
    }
    for (const chunk of chunks) {
      if (chunk && chunk.id) {
        docsMap.set(chunk.id, chunk);
      }
    }
    return res.json({ success: true, storedCount: chunks.length });
  }

  // 5. Handle DELETE
  if (req.method === 'DELETE') {
    const workspaceId = String(req.query.workspaceId || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }
    if (!allowedWorkspaceIds.has(workspaceId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this workspace relay.' });
    }
    const had = workspaceChunksRelayStore.has(workspaceId);
    workspaceChunksRelayStore.delete(workspaceId);
    return res.json({ success: true, cleared: had });
  }

  return res.json({ success: true });
});



// Register authenticated server-side Grain Personal API proxy routes
registerGrainServerRoutes(app, verifyFirebaseIdToken);

// Register authenticated server-side Zoom Server-to-Server OAuth & Meeting proxy routes
registerZoomServerRoutes(app, verifyFirebaseIdToken);

export default app;



