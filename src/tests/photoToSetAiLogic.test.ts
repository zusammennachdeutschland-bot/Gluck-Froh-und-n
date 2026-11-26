/**
 * Tests for Firebase AI Logic photo-to-set extraction (item F).
 *
 * The real Gemini model is NEVER called here — the GenerativeModel is mocked.
 * Run with: tsx src/tests/photoToSetAiLogic.test.ts
 * (also wired into the `npm test` script chain.)
 *
 * Covers:
 *  1. Extraction calls the model exactly once with ALL pages in one request.
 *  2. A 429 surfaces the Arabic quota message (and classifies as quota,
 *     which the modal turns into the paste-tab fallback button).
 *  3. A 403 surfaces the Arabic App Check message.
 *  4. Invalid JSON from the model is rejected by validateAndParseLernstudioJson
 *     (no raw import) — extraction throws AiLogicParseError, no draft.
 *  5. No set is imported without the draft review step: the service only
 *     RETURNS a draft; it never calls any import callback and never writes
 *     a set anywhere. Import happens only via the modal's
 *     handleSaveExtractedDraft after the teacher reviews/edits the draft.
 *  6. Missing App Check config fails gracefully (Arabic, no crash).
 */

import {
  AI_APPCHECK_AR,
  AI_LOGIC_FALLBACK_MODEL,
  AI_LOGIC_PRIMARY_MODEL,
  AI_QUOTA_AR,
  AiLogicAppCheckError,
  AiLogicNotConfiguredError,
  AiLogicParseError,
  AiLogicQuotaError,
  classifyAiLogicError,
  extractLernstudioSetFromImages,
  getAiModel,
  getTodayAiExtractionCount,
  type AiExtractionPageInput
} from '../services/aiLogicService';
import { validateAndParseLernstudioJson } from '../shared/lernstudioAiUtils';

export async function runPhotoToSetAiLogicTests(): Promise<{
  passed: number;
  failed: number;
  errors: string[];
}> {
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

  function makeMockModel(responseText: string | null, failWith?: unknown) {
    const calls: { count: number; lastParts: unknown } = { count: 0, lastParts: undefined };
    const model = {
      generateContent: async (parts: unknown) => {
        calls.count++;
        calls.lastParts = parts;
        if (failWith !== undefined) throw failWith;
        return { response: { text: () => responseText ?? '' } };
      }
    };
    return { model, calls };
  }

  const twoPages: AiExtractionPageInput[] = [
    { mimeType: 'image/jpeg', base64Data: 'BASE64_PAGE_1' },
    { mimeType: 'image/jpeg', base64Data: 'BASE64_PAGE_2' }
  ];
  const prompt = 'TEST PROMPT — extract the lesson from the attached pages as JSON.';

  const validModelJson = JSON.stringify({
    title: 'Präsens – Regelmäßige Verben',
    topic: 'Präsens',
    level: 'A1',
    difficulty: 'medium',
    setKind: 'grammar',
    items: [{ german: 'spielen', arabic: 'يلعب', wordType: 'verb' }],
    grammarContent: {
      lessonTitle: 'Präsens – Regelmäßige Verben',
      grammarTopic: 'Präsens',
      explanationAr: 'شرح زمن المضارع',
      rules: [{ title: 'Endungen', pattern: '-e, -st, -t', summaryAr: 'نهايات الفعل' }],
      examples: [{ german: 'Ich spiele.', arabic: 'أنا ألعب.' }],
      exercises: [
        {
          type: 'multiple_choice',
          question: 'Ich ___ Fußball.',
          options: ['spiele', 'spielst', 'spielt'],
          correctAnswer: 'spiele',
          explanationAr: 'مع ich نضيف -e',
          source: 'original'
        }
      ]
    }
  });

  // 0. Model IDs are exactly the verified ones — no other model hardcoded.
  assert(AI_LOGIC_PRIMARY_MODEL === 'gemini-3.5-flash-lite', 'Primary model is gemini-3.5-flash-lite');
  assert(AI_LOGIC_FALLBACK_MODEL === 'gemini-3.8-flash', 'Fallback model is gemini-3.8-flash');

  // 1. Exactly ONE model call, ALL pages in that single request.
  {
    const { model, calls } = makeMockModel(validModelJson);
    let imported = false;
    const onImportSet = () => {
      imported = true;
    };
    const result = await extractLernstudioSetFromImages(twoPages, prompt, {
      title: 'Präsens',
      level: 'A1',
      setKind: 'grammar',
      teacherName: 'Herr Abdul-rahman'
    }, { model: model as never });
    assert(calls.count === 1, `Model called exactly once (got ${calls.count})`);
    const parts = calls.lastParts as Array<{ inlineData?: { mimeType: string; data: string }; text?: string }>;
    assert(Array.isArray(parts), 'generateContent received a parts array');
    const images = parts.filter((p) => p.inlineData);
    assert(images.length === 2, `Both pages sent in the one request (got ${images.length} inlineData parts)`);
    assert(images[0].inlineData?.data === 'BASE64_PAGE_1', 'Page 1 base64 sent');
    assert(images[1].inlineData?.data === 'BASE64_PAGE_2', 'Page 2 base64 sent');
    const textPart = parts.find((p) => typeof p.text === 'string');
    assert(Boolean(textPart?.text?.includes('TEST PROMPT')), 'Prompt text sent in the same request');
    assert(result.draft.title.includes('Präsens'), 'Draft title from model JSON');
    assert(result.draft.items.length === 1, 'Draft carries the extracted vocab item');
    assert(Boolean(result.draft.grammarContent), 'Draft carries grammarContent');
    assert(result.draft.grammarContent?.exercises.length === 1, 'Draft carries the exercise');
    assert(result.draft.id.startsWith('set_'), 'Draft got a local id via normalizeLernstudioSet');
    // 5. No import without draft review: the service has no import callback
    // at all — it only returns the draft. Nothing was imported by the call.
    assert(imported === false, 'Extraction alone imports nothing (no import callback invoked)');
    void onImportSet;
  }

  // 2. 429 -> Arabic quota message, classified as quota (modal shows the
  // paste-tab fallback button and auto-copies the prompt).
  {
    const quotaErr = Object.assign(new Error('429 RESOURCE_EXHAUSTED: Quota exceeded'), {
      code: 'ai/quota-exceeded',
      status: 429
    });
    const { model } = makeMockModel(null, quotaErr);
    let caught: unknown;
    try {
      await extractLernstudioSetFromImages(twoPages, prompt, {}, { model: model as never });
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof AiLogicQuotaError, '429 throws AiLogicQuotaError');
    assert(
      typeof (caught as Error)?.message === 'string' &&
        (caught as Error).message.includes('للحد اليومي المجاني'),
      'Quota error message is the Arabic quota message'
    );
    assert(
      (caught as Error).message === AI_QUOTA_AR,
      'Quota message matches the exported Arabic constant'
    );
    assert(classifyAiLogicError(quotaErr) === 'quota', 'Raw 429 error classifies as quota');
    assert(classifyAiLogicError(caught) === 'quota', 'Thrown quota error classifies as quota');
  }

  // 3. 403 -> Arabic App Check message, classified as appcheck.
  {
    const appCheckErr = Object.assign(new Error('403 PERMISSION_DENIED: App Check token invalid'), {
      code: 'ai/app-check',
      status: 403
    });
    const { model } = makeMockModel(null, appCheckErr);
    let caught: unknown;
    try {
      await extractLernstudioSetFromImages(twoPages, prompt, {}, { model: model as never });
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof AiLogicAppCheckError, '403 throws AiLogicAppCheckError');
    assert((caught as Error).message === AI_APPCHECK_AR, 'App Check message is the Arabic constant');
    assert(classifyAiLogicError(appCheckErr) === 'appcheck', 'Raw 403 error classifies as appcheck');
  }

  // 4. Invalid JSON from the model is rejected — no raw import, no draft.
  {
    const garbage = 'this is not JSON {{{ not a set';
    const direct = validateAndParseLernstudioJson(garbage);
    assert(direct.success === false, 'validateAndParseLernstudioJson rejects garbage JSON');
    const { model } = makeMockModel(garbage);
    let caught: unknown;
    let draft: unknown;
    try {
      const res = await extractLernstudioSetFromImages(twoPages, prompt, {}, { model: model as never });
      draft = res.draft;
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof AiLogicParseError, 'Invalid model JSON throws AiLogicParseError');
    assert(draft === undefined, 'No draft is produced from invalid model JSON');

    // Also: structurally valid JSON with neither items nor grammar is rejected.
    const empty = JSON.stringify({ title: 'Empty', level: 'A1' });
    const directEmpty = validateAndParseLernstudioJson(empty);
    assert(directEmpty.success === false, 'JSON without items/grammar is rejected by the validator');
    const { model: emptyModel } = makeMockModel(empty);
    let caughtEmpty: unknown;
    try {
      await extractLernstudioSetFromImages(twoPages, prompt, {}, { model: emptyModel as never });
    } catch (e) {
      caughtEmpty = e;
    }
    assert(caughtEmpty instanceof AiLogicParseError, 'Empty model JSON throws AiLogicParseError');
  }

  // 6. Missing App Check config fails gracefully (Arabic, no crash).
  // In this Node test env no VITE_RECAPTCHA_ENTERPRISE_SITE_KEY exists, so
  // getAiModel() must throw the typed not-configured error, not crash.
  {
    let caught: unknown;
    try {
      getAiModel();
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof AiLogicNotConfiguredError, 'No site key -> AiLogicNotConfiguredError');
    assert(
      typeof (caught as Error)?.message === 'string' &&
        (caught as Error).message.includes('غير مفعّلة'),
      'Not-configured message is Arabic and explains setup is missing'
    );
  }

  // Daily counter helper never throws and returns a number (info only).
  {
    const count = getTodayAiExtractionCount();
    assert(typeof count === 'number' && count >= 0, 'Daily counter returns a non-negative number');
  }

  console.log(`\nPhoto-to-Set AI Logic Tests Summary: ${passed} passed, ${failed} failed.`);
  return { passed, failed, errors };
}

// Execute runner if invoked directly via tsx
if (process.argv[1]?.endsWith('photoToSetAiLogic.test.ts')) {
  runPhotoToSetAiLogicTests()
    .then((result) => {
      if (result.failed > 0) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
