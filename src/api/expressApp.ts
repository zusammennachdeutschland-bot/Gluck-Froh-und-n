import express from 'express';
import crypto from 'crypto';
import {
  getAuthoritativeAssignment,
  listAuthoritativeAssignments,
  saveAuthoritativeAssignment,
  getAuthoritativeSubmission,
  listAuthoritativeSubmissions,
  saveAuthoritativeSubmission,
  resetAdminFirestoreForTesting
} from '../server/firebaseAdmin';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Authoritative Firestore helpers (no unbounded in-memory cache)
export function resetServerMemoryCacheOnly(): void {
  // Maintained for backward compatibility with test runners
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

async function saveServerSubmission(sub: any, targetHw: any): Promise<any> {
  const { submission: saved } = await saveAuthoritativeSubmission(sub, targetHw);
  return saved;
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
  if (mode === 'open') {
    const copy = { ...hw, audienceMode: 'open' };
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
    audienceMode: 'group',
    groupId: targetGroupId && targetGroupId !== 'all' ? targetGroupId : undefined,
    groupName: hw.groupName ? String(hw.groupName).trim() : undefined,
    assignedStudents: Array.from(byId.values())
  };
}

function isServerAssignmentOpen(hw: any): boolean {
  if (!hw || !hw.id) return false;
  if (hw.deleted === true) return false;
  if (hw.isActive === false) return false;
  if (hw.status === 'closed') return false;
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
    if (Array.isArray(item.syllables)) {
      cleanItem.syllables = item.syllables.map(String);
    }
    return cleanItem;
  });

  // 2. Sanitize customExercises array (NEVER expose correctAnswer or answer-revealing explanation!)
  const rawExercises = Array.isArray(rawSnapshot.customExercises) ? rawSnapshot.customExercises : [];
  const sanitizedExercises = rawExercises.map((ex: any) => {
    if (!ex || typeof ex !== 'object') return {};
    const cleanEx: any = {
      id: String(ex.id || ''),
      type: ex.type || 'multiple_choice',
      question: String(ex.question || ex.prompt || '')
    };
    if (Array.isArray(ex.options)) {
      cleanEx.options = ex.options.map(String);
    }
    if (ex.itemRefId) {
      cleanEx.itemRefId = String(ex.itemRefId);
    }
    // STRICTLY OMIT: correctAnswer, explanation, teacherNotes, answerKey
    return cleanEx;
  });

  const sanitizedSnapshot: any = {
    id: String(rawSnapshot.id || ''),
    title: String(rawSnapshot.title || ''),
    level: rawSnapshot.level || 'A1',
    topic: String(rawSnapshot.topic || rawSnapshot.category || ''),
    difficulty: rawSnapshot.difficulty || 'medium',
    items: sanitizedItems
  };

  if (rawSnapshot.category) sanitizedSnapshot.category = String(rawSnapshot.category);
  if (rawSnapshot.hasArticles !== undefined) sanitizedSnapshot.hasArticles = Boolean(rawSnapshot.hasArticles);
  if (rawSnapshot.sentenceBuilderSupported !== undefined) {
    sanitizedSnapshot.sentenceBuilderSupported = Boolean(rawSnapshot.sentenceBuilderSupported);
  }
  if (sanitizedExercises.length > 0) {
    sanitizedSnapshot.customExercises = sanitizedExercises;
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
    title: String(normalized.title || ''),
    createdAt: String(normalized.createdAt || ''),
    isActive: Boolean(normalized.isActive),
    audienceMode: mode,
    allowedGameModes: Array.isArray(normalized.allowedGameModes) ? normalized.allowedGameModes : ['classic_quiz'],
    questionCount: typeof normalized.questionCount === 'number' ? normalized.questionCount : undefined,
    maxAttempts: typeof normalized.maxAttempts === 'number' ? normalized.maxAttempts : undefined,
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
    `pid_${String(body?.assignmentId || 'hw').slice(0, 16)}_${Date.now().toString(36)}`;
  return {
    valid: true,
    audienceMode: 'open',
    normalizedStudentId: undefined,
    normalizedParticipantId: pid,
    normalizedStudentName: cleanSubmittedName,
    normalizedGroupId: undefined
  };
}

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
    const filtered = await listServerAssignments(ownerUid);
    return res.json({ assignments: filtered.map(normalizeServerAssignment) });
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

    if (assignmentId) {
      const targetHw = await getServerAssignment(assignmentId);
      if (targetHw && targetHw.ownerUid && String(targetHw.ownerUid).trim() !== ownerUid) {
        return res.status(403).json({
          error: 'Forbidden: Assignment belongs to another teacher account',
          submissions: []
        });
      }
    }
    const list = await listServerSubmissions(ownerUid, assignmentId);
    return res.json({ submissions: list });
  }
  if (req.method === 'POST') {
    const body = req.body || {};
    // V-05: Never trust client-supplied body.assignmentFallback; require a server-known assignment
    const targetHw = await getServerAssignment(body.assignmentId);
    if (!targetHw) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }
    if (!isServerAssignmentOpen(targetHw)) {
      return res.status(403).json({
        success: false,
        error: 'Assignment is closed or inactive and no longer accepts submissions'
      });
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
    const cleanSub = {
      ...body,
      ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
      audienceMode: check.audienceMode,
      studentId: check.normalizedStudentId,
      participantId: check.normalizedParticipantId,
      groupId: check.normalizedGroupId,
      studentName: check.normalizedStudentName
    };
    delete cleanSub.assignmentFallback;

    if (cleanSub.id) {
      try {
        const saved = await saveServerSubmission(cleanSub, targetHw);
        return res.json({ success: true, submission: saved });
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

app.get('/api/homework/info', async (req, res) => {
  const id = String(req.query.id || '').trim();
  const token = req.query.token !== undefined && req.query.token !== null ? String(req.query.token).trim() : '';
  const found = await getServerAssignment(id);
  if (!found) {
    return res.status(404).json({ error: 'Assignment not found' });
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

app.post('/api/homework/submit', async (req, res) => {
  const body = req.body || {};
  // V-05: Never accept untrusted client-supplied body.assignmentFallback
  const targetHw = await getServerAssignment(body.assignmentId);
  if (!targetHw) {
    return res.status(404).json({
      success: false,
      error: 'Assignment not found'
    });
  }
  if (!isServerAssignmentOpen(targetHw)) {
    return res.status(403).json({
      success: false,
      error: 'Assignment is closed or inactive and no longer accepts submissions'
    });
  }

  // Strict Share Token Enforcement:
  const configuredShareToken =
    targetHw.shareToken !== undefined && targetHw.shareToken !== null ? String(targetHw.shareToken).trim() : '';
  if (configuredShareToken) {
    const providedToken = String(body.token || body.shareToken || req.query.token || '').trim();
    if (providedToken && providedToken !== configuredShareToken) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Invalid share token provided for assignment submission'
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
  const setSnapshot = targetHw?.setSnapshot || {};

  // Comprehensive Server-Side Authoritative Grading:
  const verifiedResponses = responses.map((r: any) => {
    if (!r || typeof r !== 'object') return r;
    const targetQId = r.exerciseId || r.questionId || r.itemId || r.id;
    
    // 1. Check customExercises
    const serverExercises = Array.isArray(setSnapshot?.customExercises) ? setSnapshot.customExercises : [];
    if (targetQId && serverExercises.length > 0) {
      const match = serverExercises.find((ex: any) => String(ex.id) === String(targetQId));
      if (match && match.correctAnswer !== undefined && match.correctAnswer !== null) {
        const studentAns = String(r.selectedAnswer ?? r.answer ?? r.submittedAnswer ?? r.text ?? '').trim();
        const expected = String(match.correctAnswer).trim();
        const isActuallyCorrect = studentAns.toLowerCase() === expected.toLowerCase();
        return {
          ...r,
          isCorrect: isActuallyCorrect
        };
      }
    }

    // 2. Check setSnapshot items
    const serverItems = Array.isArray(setSnapshot?.items) ? setSnapshot.items : [];
    if (targetQId && serverItems.length > 0) {
      const itemMatch = serverItems.find((it: any) => String(it.id) === String(targetQId));
      if (itemMatch) {
        const studentAns = String(r.selectedAnswer ?? r.answer ?? r.submittedAnswer ?? r.text ?? '').trim();
        const type = String(r.type || r.mode || '').toLowerCase();
        let expected: string | undefined;

        if (type.includes('article') || type.includes('der_die_das') || r.expectedField === 'article') {
          expected = itemMatch.article;
        } else if (type.includes('missing') || r.expectedField === 'missingLetterWord') {
          expected = itemMatch.missingLetterWord || itemMatch.german;
        } else if (type.includes('sentence') || type.includes('order') || r.expectedField === 'exampleSentenceGerman') {
          expected = itemMatch.exampleSentenceGerman || (Array.isArray(itemMatch.sentence4Elements) ? itemMatch.sentence4Elements.join(' ') : itemMatch.german);
        } else if (type.includes('arabic') || r.expectedField === 'arabic') {
          expected = itemMatch.arabic;
        } else if (type.includes('german') || type.includes('vocab') || type.includes('translation') || r.expectedField === 'german') {
          expected = itemMatch.german;
        } else {
          expected = itemMatch.german || itemMatch.arabic;
        }

        if (expected !== undefined && expected !== null) {
          const isActuallyCorrect = studentAns.toLowerCase() === String(expected).trim().toLowerCase();
          return {
            ...r,
            isCorrect: isActuallyCorrect
          };
        }
      }
    }

    return r;
  });

  const correctCount = verifiedResponses.filter((r: any) => r && r.isCorrect).length;
  const totalQ = verifiedResponses.length;
  const pct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  const nowIso = new Date().toISOString();
  const startMs = body.startedAt ? new Date(body.startedAt).getTime() : Date.now() - totalQ * 4000;
  const timeSpentSeconds = Math.max(5, Math.round((Date.now() - startMs) / 1000));
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
    status: 'completed',
    startedAt: body.startedAt || nowIso,
    completedAt: body.completedAt || nowIso,
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
    responses: verifiedResponses
  };

  try {
    const saved = await saveServerSubmission(submission, targetHw);
    return res.json({ success: true, submission: saved });
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

export default app;


