import { HomeworkSubmission } from './homeworkTypes';
import { resolveHomeworkApiUrl } from './firebaseCloudSync';

export const HOMEWORK_CHECKPOINT_INTERVAL = 10;

export function shouldSendProgressCheckpoint(params: {
  answeredCount: number;
  totalQuestions: number;
  lastSyncedAnsweredCount: number;
  interval?: number;
}): boolean {
  const interval = Math.max(1, Number(params.interval || HOMEWORK_CHECKPOINT_INTERVAL));
  const answeredCount = Math.max(0, Number(params.answeredCount) || 0);
  const totalQuestions = Math.max(0, Number(params.totalQuestions) || 0);
  const lastSynced = Math.max(0, Number(params.lastSyncedAnsweredCount) || 0);

  // Never emit a progress checkpoint on the final question: final completion sends 1 authoritative request directly.
  if (answeredCount <= 0 || totalQuestions <= 0 || answeredCount >= totalQuestions) {
    return false;
  }

  return answeredCount - lastSynced >= interval;
}

export function buildInProgressCheckpointSubmission(
  submission: HomeworkSubmission
): HomeworkSubmission {
  const safeResponses = Array.isArray(submission.responses) ? submission.responses : [];
  const totalQuestions = Math.max(safeResponses.length, Number(submission.totalQuestions) || 0);
  const correctCount = safeResponses.filter((r) => r && r.isCorrect).length;
  const pct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    ...submission,
    status: 'in_progress',
    completedAt: '',
    updatedAt: new Date().toISOString(),
    totalQuestions,
    correctAnswersCount: correctCount,
    scorePercentage: pct,
    score: correctCount,
    accuracy: pct,
    accuracyPercent: pct,
    responses: safeResponses
  };
}

/**
 * Browser fetch({ keepalive: true }) enforces a strict 64 KiB body limit across all active requests.
 * We cap individual keepalive checkpoint payloads at 56 KB (UTF-8 bytes) and strip verbose optional
 * prompt/sentence strings if a checkpoint ever approaches the browser limit, preserving all student
 * answers, question IDs, correctness, and scores.
 */
export const MAX_KEEPALIVE_PAYLOAD_BYTES = 56 * 1024;

const lastExitCheckpointSignatureById = new Map<string, string>();
const inFlightExitCheckpointIds = new Set<string>();

export function resetExitCheckpointDedupeForTesting(): void {
  lastExitCheckpointSignatureById.clear();
  inFlightExitCheckpointIds.clear();
}

function computeCheckpointProgressSignature(submission: HomeworkSubmission): string {
  const responses = Array.isArray(submission.responses) ? submission.responses : [];
  const compactAnswers = responses
    .map(
      (r) =>
        `${r?.questionId || ''}:${r?.studentAnswer || ''}:${r?.isCorrect ? 1 : 0}`
    )
    .join('|');
  return `${submission.id}::${responses.length}::${submission.goldEarned ?? 0}::${submission.maxStreak ?? 0}::${compactAnswers}`;
}

function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).byteLength;
  }
  return unescape(encodeURIComponent(str)).length;
}

export function serializeKeepaliveCheckpointBody(bodyObj: Record<string, any>): string {
  const initialJson = JSON.stringify(bodyObj);
  if (getUtf8ByteLength(initialJson) <= MAX_KEEPALIVE_PAYLOAD_BYTES) {
    return initialJson;
  }

  // Stage 1: Strip verbose optional text fields (promptText, sentence) while preserving all answers & scores
  const compactResponses = Array.isArray(bodyObj.responses)
    ? bodyObj.responses.map((r: any) => {
        if (!r || typeof r !== 'object') return r;
        const { promptText: _p, sentence: _s, ...essential } = r;
        return essential;
      })
    : [];
  const compactObj: Record<string, any> = {
    ...bodyObj,
    responses: compactResponses
  };
  if (compactObj.gamification && typeof compactObj.gamification === 'object') {
    const { bonusHistory: _bh, ...restGam } = compactObj.gamification;
    compactObj.gamification = restGam;
  }
  const stage1Json = JSON.stringify(compactObj);
  if (getUtf8ByteLength(stage1Json) <= MAX_KEEPALIVE_PAYLOAD_BYTES) {
    return stage1Json;
  }

  // Stage 2: Truncate overly long string values inside responses if still above 56 KB
  const ultraCompactObj: Record<string, any> = {
    ...compactObj,
    responses: compactResponses.map((r: any) => ({
      questionId: String(r?.questionId || '').slice(0, 48),
      questionType: String(r?.questionType || '').slice(0, 24),
      germanWord: String(r?.germanWord || '').slice(0, 64),
      studentAnswer: String(r?.studentAnswer || '').slice(0, 64),
      correctAnswer: String(r?.correctAnswer || '').slice(0, 64),
      isCorrect: Boolean(r?.isCorrect),
      timeSpentSeconds: Number(r?.timeSpentSeconds || 0)
    }))
  };
  return JSON.stringify(ultraCompactObj);
}

/**
 * Best-effort keepalive checkpoint when the student exits, hides, or backgrounds
 * the tab/app mid-quiz. Preserves status 'in_progress', deduplicates across multiple
 * exit events (visibilitychange + pagehide + unmount), never re-uploads unchanged progress,
 * and caps the body below the browser 64 KB keepalive limit.
 */
export async function sendExitProgressCheckpointKeepalive(
  submission: HomeworkSubmission,
  options?: {
    shortId?: string;
    shareToken?: string;
  }
): Promise<boolean> {
  if (!submission || !submission.id || !submission.assignmentId) {
    return false;
  }
  if (submission.status === 'completed' || Boolean(submission.completedAt)) {
    return false;
  }

  const safeResponses = Array.isArray(submission.responses) ? submission.responses : [];
  const totalQuestions = Math.max(safeResponses.length, Number(submission.totalQuestions) || 0);
  // Never emit an exit checkpoint when 0 questions are answered or when all questions are answered
  // (final question always triggers automatic completion instead).
  if (safeResponses.length <= 0 || (totalQuestions > 0 && safeResponses.length >= totalQuestions)) {
    return false;
  }

  const signature = computeCheckpointProgressSignature(submission);
  if (
    lastExitCheckpointSignatureById.get(submission.id) === signature ||
    inFlightExitCheckpointIds.has(submission.id)
  ) {
    return false;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  if (typeof fetch !== 'function') {
    return false;
  }

  const payload = buildInProgressCheckpointSubmission(submission);
  const url = resolveHomeworkApiUrl('/api/homework/submit');
  const urlParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location?.search || '')
      : null;
  const resolvedToken = (options?.shareToken || urlParams?.get('token') || '').trim();
  const pathMatch =
    typeof window !== 'undefined'
      ? (window.location?.pathname || '').match(/^\/Herr-Abdul-rahman\/([A-Za-z0-9]+)/i)
      : null;
  const resolvedShortId = (options?.shortId || pathMatch?.[1] || '').trim();

  const bodyJson = serializeKeepaliveCheckpointBody({
    ...payload,
    ...(resolvedToken ? { token: resolvedToken } : {}),
    ...(resolvedShortId ? { shortId: resolvedShortId } : {}),
    ...(payload.ownerUid ? { ownerUid: payload.ownerUid } : {})
  });

  if (getUtf8ByteLength(bodyJson) > 63 * 1024) {
    return false;
  }

  inFlightExitCheckpointIds.add(submission.id);
  lastExitCheckpointSignatureById.set(submission.id, signature);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: bodyJson
    });
    if (res && typeof res.ok === 'boolean' && !res.ok && res.status >= 500) {
      lastExitCheckpointSignatureById.delete(submission.id);
      return false;
    }
    return true;
  } catch {
    lastExitCheckpointSignatureById.delete(submission.id);
    return false;
  } finally {
    inFlightExitCheckpointIds.delete(submission.id);
  }
}

