import express from 'express';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import {
  evaluateNormalizedGrammarAnswer,
  normalizeGrammarContent,
  normalizeLernstudioSet,
  scrambleOrderingTokensDeterministic,
  stripHeavyGrammarMediaForSync
} from '../shared/grammarEngine';
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
  getAuthoritativePublishedSet,
  listAuthoritativePublishedSets,
  saveAuthoritativePublishedSet,
  isBuiltinCurriculumSetId,
  invalidateServerAssignmentCache,
  resetAdminFirestoreForTesting
} from '../server/firebaseAdmin';
import { registerGrainServerRoutes } from '../server/grainServerProxy';
import { registerZoomServerRoutes } from '../server/zoomServerProxy';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin.trim() : '';
  const isAllowedOrigin =
    !origin ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
    /^capacitor:\/\/localhost$/i.test(origin) ||
    /^ionic:\/\/localhost$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) {
      res.setHeader('Vary', 'Origin');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Owner-Uid, X-Grain-Session-Token, X-Grain-Local-Client, X-Zoom-Session-Token, X-Zoom-Local-Client');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

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

// Gold price cache
let serverGoldCache: { data: any; timestamp: number } | null = null;
const SERVER_GOLD_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// 1. Health check
app.all('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).json({ status: 'ok' });
});

// 2. Gold price live API endpoint
app.get('/api/gold-price', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const now = Date.now();
  if (serverGoldCache && now - serverGoldCache.timestamp < SERVER_GOLD_CACHE_TTL) {
    return res.json(serverGoldCache.data);
  }

  const TROY_OUNCE_TO_GRAMS = 31.1034768;

  try {
    const timeout = 6000;
    const fetchWithTimeout = (url: string) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
    };

    let ozUsd = 0;
    let usdToEgp = 51.5;

    // FX Rate
    try {
      const fxRes = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD');
      if (fxRes.ok) {
        const fxData = (await fxRes.json()) as any;
        if (fxData?.rates?.EGP) {
          usdToEgp = parseFloat(fxData.rates.EGP);
        }
      }
    } catch (e) {
      console.warn('FX fetch failed, using fallback exchange rate', e);
    }

    // Binance PAXG
    try {
      const paxgRes = await fetchWithTimeout(
        'https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT'
      );
      if (paxgRes.ok) {
        const pData = (await paxgRes.json()) as any;
        if (pData?.price) {
          ozUsd = parseFloat(pData.price);
        }
      }
    } catch (e) {
      console.warn('Binance PAXG fetch failed', e);
    }

    // Gold-API fallback
    if (!ozUsd) {
      try {
        const gRes = await fetchWithTimeout('https://api.gold-api.com/price/XAU');
        if (gRes.ok) {
          const gData = (await gRes.json()) as any;
          if (gData?.price) {
            ozUsd = parseFloat(gData.price);
          }
        }
      } catch (e) {
        console.warn('Gold-API fetch failed', e);
      }
    }

    if (ozUsd > 0 && usdToEgp > 0) {
      const pricePerGram24K = Math.round((ozUsd / TROY_OUNCE_TO_GRAMS) * usdToEgp);
      const result = {
        pricePerGram24K,
        currency: 'EGP',
        source: 'مؤشر الذهب العالمي والصاغة (EGP)',
        fetchedAt: new Date().toISOString(),
        success: true,
        status: 'live',
        ozUsd: Math.round(ozUsd * 100) / 100,
        usdToEgp: Math.round(usdToEgp * 100) / 100,
        lastSuccessfulUpdateMs: now
      };
      serverGoldCache = { data: result, timestamp: now };
      return res.json(result);
    }

    if (serverGoldCache) {
      const isFresh = now - serverGoldCache.timestamp < SERVER_GOLD_CACHE_TTL;
      return res.json({
        ...serverGoldCache.data,
        status: isFresh ? 'cached' : 'stale',
      });
    }

    const fallbackResult = {
      pricePerGram24K: 7090,
      currency: 'EGP',
      source: 'متوسط سوق الذهب المصري (تقديري)',
      fetchedAt: new Date().toISOString(),
      success: true,
      status: 'estimated',
    };
    return res.json(fallbackResult);
  } catch (err: any) {
    console.error('Gold price route error:', err);
    if (serverGoldCache) {
      return res.json({
        ...serverGoldCache.data,
        status: 'stale'
      });
    }
    return res.status(500).json({
      pricePerGram24K: 0,
      currency: 'EGP',
      source: 'Error',
      fetchedAt: new Date().toISOString(),
      success: false,
      status: 'unavailable',
      error: err.message || 'Failed to fetch gold price',
    });
  }
});

// 3. HOD Dashboard Endpoints
app.get('/api/hod/dashboard/timetable', (req, res) => {
  res.json({
    dayKey: new Date().getDay().toString(),
    periodsCount: 8,
    teachers: [
      { id: 't-1', name: 'أ. أحمد علي', periods: { '1': '1A', '2': '2B', '3': '3C' } },
      { id: 't-2', name: 'أ. سارة محمود', periods: { '2': '4A', '4': '5B', '5': '6C' } },
      { id: 't-3', name: 'أ. عمر فاروق', periods: { '1': '7A', '3': '8B', '6': '9C' } },
    ],
    lastUpdated: new Date().toISOString(),
  });
});

app.post('/api/hod/dashboard/action', (req, res) => {
  const { actionType, payload } = req.body;
  res.json({ success: true, actionType, id: Date.now().toString(), payload, timestamp: Date.now() });
});

// 4. TTS Proxy Endpoint
app.get('/api/tts', async (req, res) => {
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
  const normalizedHideBranding =
    hw.hideTeacherBranding !== undefined ? { hideTeacherBranding: Boolean(hw.hideTeacherBranding) } : {};
  if (mode === 'open') {
    const copy = { ...hw, ...normalizedHideBranding, audienceMode: 'open' };
    delete copy.groupId;
    delete copy.groupName;
    delete copy.assignedStudents;
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
  return {
    ...hw,
    ...normalizedHideBranding,
    audienceMode: 'group',
    groupId: targetGroupId && targetGroupId !== 'all' ? targetGroupId : undefined,
    groupName: hw.groupName ? String(hw.groupName).trim() : undefined,
    assignedStudents: Array.from(byId.values())
  };
}

function isServerAssignmentOpen(hw: any): boolean {
  if (!hw || !hw.id) return false;
  if (hw.deleted === true || hw.revoked === true) return false;
  if (hw.isActive === false) return false;
  if (hw.status === 'closed' || hw.status === 'deleted') return false;
  if (typeof hw.deadline === 'string' && hw.deadline.trim()) {
    const deadlineMs = Date.parse(hw.deadline.trim());
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
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
    allowReplay: typeof normalized.allowReplay === 'boolean' ? normalized.allowReplay : true,
    hideTeacherBranding: Boolean(normalized.hideTeacherBranding),
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
    const creatorUid = String(setPayload.createdByUid || '').trim();
    if (creatorUid && creatorUid !== verifiedUid) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: createdByUid does not match authenticated Firebase token'
      });
    }
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
  return res.json({ success: true });
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
    const graded = await gradeServerHomeworkResponses(targetHw, rawResponses);
    if (!graded.valid) {
      return res.status(graded.status || 400).json({
        success: false,
        error: graded.error || 'Invalid question or exercise reference in submission'
      });
    }
    const cleanSub = {
      ...body,
      ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
      audienceMode: check.audienceMode,
      studentId: check.normalizedStudentId,
      participantId: check.normalizedParticipantId,
      groupId: check.normalizedGroupId,
      studentName: check.normalizedStudentName,
      responses: graded.verifiedResponses
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
  return res.json({ success: true });
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
        const cleanedR = { ...r, isCorrect: isActuallyCorrect };
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

    if (isVerbQ) {
      verifiedResponses.push({
        ...r,
        isVerbQuestion: true,
        ...(r.verbId ? { verbId: String(r.verbId) } : {}),
        ...(r.infinitive ? { infinitive: String(r.infinitive) } : {}),
        ...(r.subject ? { subject: String(r.subject) } : {}),
        ...(r.sentence ? { sentence: String(r.sentence) } : {})
      });
      continue;
    }

    const itemLookupId = r.itemId || r.exerciseId || (r.expectedField ? targetQId : undefined);
    if (itemLookupId && serverItems.length > 0 && (r.expectedField || typeof r.isCorrect !== 'boolean' || options?.requireKnownQuestion)) {
      const itemMatch = serverItems.find((it: any) => String(it.id) === String(itemLookupId));
      if (!itemMatch) {
        if (r.itemId || options?.requireKnownQuestion) {
          return {
            valid: false,
            status: 400,
            error: 'Unknown or unassigned vocabulary item ID',
            verifiedResponses: []
          };
        }
      } else {
        if (allowedItemIds && !allowedItemIds.has(String(itemMatch.id).trim())) {
          return {
            valid: false,
            status: 400,
            error: 'Unassigned vocabulary item ID referenced in request',
            verifiedResponses: []
          };
        }
        const studentAns = String(
          r.selectedAnswer ?? r.studentAnswer ?? r.answer ?? r.submittedAnswer ?? r.text ?? ''
        ).trim();
        const type = String(r.type || r.questionType || r.mode || '').toLowerCase();
        let expected: string | undefined;

        if (type.includes('article') || type.includes('der_die_das') || r.expectedField === 'article') {
          const explicitArticle = typeof itemMatch.article === 'string' ? itemMatch.article.trim() : '';
          const extractedMatch =
            !explicitArticle && typeof itemMatch.german === 'string'
              ? itemMatch.german.trim().match(/^(der|die|das)\s+/i)
              : null;
          expected = explicitArticle || (extractedMatch ? extractedMatch[1].toLowerCase() : undefined);
        } else if (type.includes('missing') || r.expectedField === 'missingLetterWord') {
          expected = itemMatch.missingLetterWord || itemMatch.german;
        } else if (type.includes('sentence') || type.includes('order') || r.expectedField === 'exampleSentenceGerman') {
          expected =
            itemMatch.exampleSentenceGerman ||
            (Array.isArray(itemMatch.sentence4Elements) ? itemMatch.sentence4Elements.join(' ') : itemMatch.german);
        } else if (type.includes('arabic') || r.expectedField === 'arabic') {
          expected = itemMatch.arabic;
        } else if (type.includes('german') || type.includes('vocab') || type.includes('translation') || r.expectedField === 'german') {
          expected = itemMatch.german;
        } else {
          expected = itemMatch.german || itemMatch.arabic;
        }

        if (expected !== undefined && expected !== null) {
          const isActuallyCorrect = studentAns.toLowerCase() === String(expected).trim().toLowerCase();
          const cleanedR = { ...r, isCorrect: isActuallyCorrect };
          delete cleanedR.pendingServerGrading;
          verifiedResponses.push(cleanedR);
          continue;
        }
      }
    }

    if (options?.requireKnownQuestion) {
      return {
        valid: false,
        status: 400,
        error: 'Question could not be resolved against assignment snapshot',
        verifiedResponses: []
      };
    }
    verifiedResponses.push(r);
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
  const graded = await gradeServerHomeworkResponses(targetHw, responses);
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
    goldEarned: body.goldEarned || 0,
    maxStreak: body.maxStreak || 0,
    completedStudyPhase: Boolean(body.completedStudyPhase),
    ...(body.xpEarned !== undefined ? { xpEarned: Number(body.xpEarned) || 0 } : {}),
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

    // Verify chunk ownership to prevent chunk injection
    for (const chunk of chunks) {
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

// 7. Ephemeral Mobile-Friendly Android Keystore Generator (writes only to /tmp and deletes immediately)
app.post('/api/android/generate-keystore', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { storePassword, keyAlias = 'glueckrelease' } = req.body || {};
  const cleanAlias = String(keyAlias || 'glueckrelease').trim() || 'glueckrelease';
  const pass = String(storePassword || '');

  if (pass.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters long.'
    });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(cleanAlias)) {
    return res.status(400).json({
      success: false,
      error: 'Key alias must contain only letters, numbers, underscores, or hyphens.'
    });
  }

  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  const { execFileSync } = await import('child_process');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glueck-ks-'));
  const keyPemPath = path.join(tmpDir, 'key.pem');
  const certPemPath = path.join(tmpDir, 'cert.pem');
  const keystorePath = path.join(tmpDir, 'release.keystore');

  try {
    const envWithSecret = {
      ...process.env,
      _GLUECK_EPHEMERAL_KS_PASS: pass
    };

    // 1. Generate 2048-bit RSA private key and self-signed certificate (10,000 days)
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPemPath,
        '-out',
        certPemPath,
        '-days',
        '10000',
        '-subj',
        '/CN=Glueck Teacher/OU=Mobile/O=Glueck/L=Cairo/ST=Cairo/C=EG'
      ],
      { stdio: 'ignore' }
    );

    // 2. Export standard PKCS#12 (.keystore) with alias "glueckrelease"
    execFileSync(
      'openssl',
      [
        'pkcs12',
        '-export',
        '-in',
        certPemPath,
        '-inkey',
        keyPemPath,
        '-out',
        keystorePath,
        '-name',
        cleanAlias,
        '-passout',
        'env:_GLUECK_EPHEMERAL_KS_PASS'
      ],
      { env: envWithSecret, stdio: 'ignore' }
    );

    // 3. Verify the generated PKCS#12 keystore can be unlocked with the password
    execFileSync(
      'openssl',
      [
        'pkcs12',
        '-in',
        keystorePath,
        '-noout',
        '-passin',
        'env:_GLUECK_EPHEMERAL_KS_PASS'
      ],
      { env: envWithSecret, stdio: 'ignore' }
    );

    // 4. Read SHA-256 certificate fingerprint (safe public metadata)
    const fpOut = execFileSync(
      'openssl',
      ['x509', '-in', certPemPath, '-noout', '-fingerprint', '-sha256'],
      { encoding: 'utf8' }
    ).trim();

    const keystoreBuffer = fs.readFileSync(keystorePath);
    const keystoreBase64 = keystoreBuffer.toString('base64').replace(/\s+/g, '');

    return res.status(200).json({
      success: true,
      alias: cleanAlias,
      keystoreBase64,
      byteLength: keystoreBuffer.length,
      sha256Fingerprint: fpOut.replace(/^.*Fingerprint=/i, '')
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to generate PKCS12 keystore.'
    });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});

/**
 * Normalizes and validates extracted Grammar Set payload from Gemini Vision response.
 * Enforces original vs generated separation and strips heavy inline image blobs.
 */
export function parseAndNormalizeExtractedGrammarSet(
  rawTextOrObj: string | Record<string, any>,
  options: {
    title?: string;
    topic?: string;
    grade?: string;
    level?: string;
    difficulty?: string;
    teacherName?: string;
    exerciseMode?: 'original_only' | 'original_and_similar';
    targetSetKind?: 'grammar' | 'mixed';
  } = {}
): { success: boolean; extractedSet?: any; warnings: string[]; error?: string } {
  let parsed: any = rawTextOrObj;
  if (typeof rawTextOrObj === 'string') {
    let clean = rawTextOrObj.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    else if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    clean = clean.trim();
    try {
      parsed = JSON.parse(clean);
    } catch (err: any) {
      return {
        success: false,
        warnings: [],
        error: `Invalid JSON extracted from model output: ${err?.message || 'parse error'}`
      };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, warnings: [], error: 'Extracted payload is not an object.' };
  }

  const exerciseMode = options.exerciseMode || 'original_and_similar';
  const rawGrammar = parsed.grammarContent && typeof parsed.grammarContent === 'object' ? parsed.grammarContent : parsed;
  const rawExercises = Array.isArray(rawGrammar.exercises) ? rawGrammar.exercises : [];
  const filteredExercises =
    exerciseMode === 'original_only'
      ? rawExercises.filter((ex: any) => !ex || ex.source !== 'generated')
      : rawExercises;

  const warnings: string[] = [];
  if (Array.isArray(parsed.warnings)) {
    parsed.warnings.forEach((w: any) => {
      if (typeof w === 'string' && w.trim()) warnings.push(w.trim());
    });
  }

  const normalizedGrammar = normalizeGrammarContent(
    {
      ...rawGrammar,
      exercises: filteredExercises,
      origin: 'teacher_created'
    },
    parsed.title || options.title || 'درس قواعد من الكتاب',
    parsed.grammarTopic || rawGrammar.grammarTopic || parsed.topic || options.topic || 'Grammatik',
    'teacher_created'
  );

  if (!normalizedGrammar) {
    return { success: false, warnings, error: 'Model output lacked structured grammarContent.' };
  }

  const uncertainCount = normalizedGrammar.exercises.filter((e) => e.isUncertain).length;
  if (uncertainCount > 0) {
    warnings.push(
      `يوجد ${uncertainCount} تمرين/تمارين غير واضحة جزئياً في الصورة — يرجى مراجعتها وتأكيد إجاباتها قبل الحفظ.`
    );
  }
  if (normalizedGrammar.exercises.length === 0 && normalizedGrammar.rules.length === 0) {
    warnings.push('لم يتم العثور على تمارين أو قواعد واضحة كفاية في الصور المرفوعة.');
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const resolvedSetKind =
    options.targetSetKind === 'mixed' && rawItems.length > 0 ? 'mixed' : 'grammar';

  const normalizedSet = stripHeavyGrammarMediaForSync(
    normalizeLernstudioSet({
      id: `set_gram_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: String(parsed.title || normalizedGrammar.lessonTitle || options.title || 'درس قواعد مستخرج').trim(),
      topic: String(parsed.topic || normalizedGrammar.grammarTopic || options.topic || 'Grammatik').trim(),
      level: parsed.level || options.level || 'A1',
      difficulty: parsed.difficulty || options.difficulty || 'medium',
      ...(options.grade ? { grade: options.grade } : parsed.grade ? { grade: String(parsed.grade) } : {}),
      ...(options.teacherName ? { createdByTeacherName: options.teacherName } : {}),
      description: String(
        parsed.description || normalizedGrammar.explanationAr || normalizedGrammar.lessonTitle || ''
      ).trim(),
      setKind: resolvedSetKind,
      contentOrigin: 'teacher_created',
      items: rawItems,
      grammarContent: normalizedGrammar
    })
  );

  return {
    success: true,
    extractedSet: normalizedSet,
    warnings
  };
}

// POST /api/lernstudio/extract-grammar — Server-side Gemini Vision extraction for textbook/workbook grammar pages
app.post('/api/lernstudio/extract-grammar', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      code: 'AI_NOT_CONFIGURED',
      error: 'Gemini API key is not configured on the server (GEMINI_API_KEY missing).',
      errorAr:
        'مفتاح Gemini API غير مضبوط على الخادم (GEMINI_API_KEY). يمكنك استخدام مولّد البرومبت ولصق كود JSON يدوياً بدون تعطيل.'
    });
  }

  const body = req.body || {};
  const rawImages = Array.isArray(body.images) ? body.images : [];
  if (rawImages.length === 0 || rawImages.length > 6) {
    return res.status(400).json({
      success: false,
      code: 'BAD_REQUEST',
      error: 'Please supply between 1 and 6 textbook or workbook page images.',
      errorAr: 'يرجى إرفاق من صورة واحدة إلى 6 صور كحد أقصى.'
    });
  }

  const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  for (let i = 0; i < rawImages.length; i++) {
    const img = rawImages[i];
    if (!img || typeof img !== 'object') continue;
    let base64Data = typeof img.dataBase64 === 'string' ? img.dataBase64.trim() : '';
    let mimeType = typeof img.mimeType === 'string' && img.mimeType.trim() ? img.mimeType.trim() : 'image/jpeg';

    if (!base64Data && typeof img.dataUrl === 'string') {
      const match = /^data:([^;]+);base64,(.+)$/i.exec(img.dataUrl.trim());
      if (match) {
        mimeType = match[1] || mimeType;
        base64Data = match[2].trim();
      }
    }

    if (base64Data) {
      imageParts.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }
  }

  if (imageParts.length === 0) {
    return res.status(400).json({
      success: false,
      code: 'BAD_REQUEST',
      error: 'No valid base64 image data was found in the request.',
      errorAr: 'لم يتم العثور على بيانات صور صالحة في الطلب.'
    });
  }

  const exerciseMode: 'original_only' | 'original_and_similar' =
    body.exerciseMode === 'original_only' ? 'original_only' : 'original_and_similar';
  const targetSetKind: 'grammar' | 'mixed' = body.targetSetKind === 'mixed' ? 'mixed' : 'grammar';
  const requestedLevel = String(body.level || 'A1').trim();
  const requestedTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const requestedTopic = typeof body.topic === 'string' ? body.topic.trim() : '';

  const exerciseRuleSchema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      titleAr: { type: Type.STRING },
      titleDe: { type: Type.STRING },
      titleEn: { type: Type.STRING },
      summaryAr: { type: Type.STRING },
      summaryDe: { type: Type.STRING },
      summaryEn: { type: Type.STRING },
      pattern: { type: Type.STRING },
      tipAr: { type: Type.STRING },
      tipDe: { type: Type.STRING },
      table: {
        type: Type.OBJECT,
        properties: {
          headers: { type: Type.ARRAY, items: { type: Type.STRING } },
          rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
        }
      }
    },
    required: ['title', 'summaryAr']
  };

  const exampleSchema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      german: { type: Type.STRING },
      arabic: { type: Type.STRING },
      english: { type: Type.STRING },
      highlight: { type: Type.STRING },
      noteAr: { type: Type.STRING },
      noteDe: { type: Type.STRING }
    },
    required: ['german', 'arabic']
  };

  const exerciseSchema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      type: {
        type: Type.STRING,
        description:
          'One of: multiple_choice, fill_blank, correct_mistake, choose_correct_sentence, sentence_ordering, short_answer'
      },
      prompt: { type: Type.STRING },
      question: { type: Type.STRING },
      sentenceWithBlank: { type: Type.STRING },
      faultySentence: { type: Type.STRING },
      tokens: { type: Type.ARRAY, items: { type: Type.STRING } },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctAnswer: { type: Type.STRING },
      acceptedAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
      explanationAr: { type: Type.STRING },
      explanationDe: { type: Type.STRING },
      ruleRef: { type: Type.STRING },
      source: {
        type: Type.STRING,
        description: '"original" if extracted directly from the uploaded page(s), "generated" if newly created practice'
      },
      isUncertain: { type: Type.BOOLEAN },
      uncertaintyReason: { type: Type.STRING }
    },
    required: ['type', 'question', 'correctAnswer', 'source']
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      topic: { type: Type.STRING },
      level: { type: Type.STRING },
      difficulty: { type: Type.STRING },
      description: { type: Type.STRING },
      warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
      grammarContent: {
        type: Type.OBJECT,
        properties: {
          lessonTitle: { type: Type.STRING },
          lessonTitleAr: { type: Type.STRING },
          lessonTitleDe: { type: Type.STRING },
          grammarTopic: { type: Type.STRING },
          grammarTopicAr: { type: Type.STRING },
          grammarTopicDe: { type: Type.STRING },
          explanationAr: { type: Type.STRING },
          explanationDe: { type: Type.STRING },
          explanationEn: { type: Type.STRING },
          sourceBookInfo: { type: Type.STRING },
          rules: { type: Type.ARRAY, items: exerciseRuleSchema },
          examples: { type: Type.ARRAY, items: exampleSchema },
          exercises: { type: Type.ARRAY, items: exerciseSchema }
        },
        required: ['lessonTitle', 'grammarTopic', 'explanationAr', 'rules', 'examples', 'exercises']
      },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            german: { type: Type.STRING },
            arabic: { type: Type.STRING },
            english: { type: Type.STRING },
            emoji: { type: Type.STRING }
          },
          required: ['german', 'arabic']
        }
      }
    },
    required: ['title', 'topic', 'grammarContent']
  };

  const promptText = [
    'Analyze the uploaded German textbook / workbook page image(s) carefully.',
    requestedTitle ? `Preferred set title: ${requestedTitle}` : '',
    requestedTopic ? `Focus grammar topic: ${requestedTopic}` : '',
    `Target CEFR level: ${requestedLevel}.`,
    '1. Extract the German grammar lesson title, topic, clear explanation in Arabic (plus German/English), structured rules (including conjugation/grammar tables if visible), and authentic bilingual German-Arabic example sentences.',
    '2. Extract ALL grammar exercises visible on the page(s) in order and mark each one with source: "original".',
    '3. Do NOT guess or fabricate an unreadable line: if any exercise text, answer key, or handwritten blank is blurry or ambiguous, set isUncertain: true and explain briefly in uncertaintyReason (in Arabic).',
    exerciseMode === 'original_only'
      ? '4. ONLY return exercises visibly present on the uploaded page(s) with source: "original". Do NOT invent extra generated exercises.'
      : '4. After extracting all original page exercises (source: "original"), generate 3 to 5 additional similar practice exercises (covering fill_blank, multiple_choice, correct_mistake, choose_correct_sentence, sentence_ordering, or short_answer) clearly marked source: "generated".',
    targetSetKind === 'mixed'
      ? '5. Also extract key vocabulary items printed on the page into the items array if present.'
      : '5. Keep items array empty ([]) unless essential anchor vocabulary is explicitly part of the lesson.',
    '6. Ensure every exercise has a clear question, valid type (multiple_choice | fill_blank | correct_mistake | choose_correct_sentence | sentence_ordering | short_answer), accurate correctAnswer, options (for multiple_choice / choose_correct_sentence), tokens (for sentence_ordering), and a brief Arabic explanationAr.'
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const geminiGrammarModel = String(process.env.GEMINI_GRAMMAR_MODEL || 'gemini-4-hydrogen').trim() || 'gemini-4-hydrogen';

    const response = await ai.models.generateContent({
      model: geminiGrammarModel,
      contents: {
        parts: [...imageParts, { text: promptText }]
      },
      config: {
        systemInstruction:
          'You are an expert German (DaF/DaZ) curriculum designer for Arabic-speaking students. Extract structured textbook grammar lessons faithfully without inventing unclear text.',
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const rawText = (response.text || '').trim();
    if (!rawText) {
      return res.status(502).json({
        success: false,
        code: 'INVALID_RESPONSE',
        error: 'Gemini returned an empty response.',
        errorAr: 'أعاد نموذج الذكاء الاصطناعي استجابة فارغة. يرجى المحاولة مرة أخرى.'
      });
    }

    const normalizedResult = parseAndNormalizeExtractedGrammarSet(rawText, {
      title: requestedTitle || undefined,
      topic: requestedTopic || undefined,
      grade: typeof body.grade === 'string' ? body.grade : undefined,
      level: requestedLevel,
      difficulty: typeof body.difficulty === 'string' ? body.difficulty : 'medium',
      teacherName: typeof body.teacherName === 'string' ? body.teacherName : undefined,
      exerciseMode,
      targetSetKind
    });

    if (!normalizedResult.success || !normalizedResult.extractedSet) {
      return res.status(502).json({
        success: false,
        code: 'INVALID_RESPONSE',
        error: normalizedResult.error || 'Failed to parse extracted grammar schema.',
        errorAr: 'تعذر تحليل البيانات المستخرجة إلى بنية درس قواعد صالحة.'
      });
    }

    return res.status(200).json({
      success: true,
      modelUsed: geminiGrammarModel,
      extractedSet: normalizedResult.extractedSet,
      warnings: normalizedResult.warnings
    });
  } catch (err: any) {
    const status = Number(err?.status) || 502;
    return res.status(status >= 400 && status < 600 ? status : 502).json({
      success: false,
      code: 'UPSTREAM_ERROR',
      error: err?.message || 'Failed to extract grammar content from image(s).',
      errorAr: 'حدث خطأ أثناء تحليل الصور بالذكاء الاصطناعي. تحقق من الاتصال أو استخدم استيراد JSON اليدوي.'
    });
  }
});

// Register authenticated server-side Grain Personal API proxy routes
registerGrainServerRoutes(app, verifyFirebaseIdToken);

// Register authenticated server-side Zoom Server-to-Server OAuth & Meeting proxy routes
registerZoomServerRoutes(app, verifyFirebaseIdToken);

export default app;



