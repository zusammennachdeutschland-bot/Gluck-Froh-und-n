import assert from 'node:assert/strict';
import {
  ALL_VERBS,
  ALL_VERB_CLASSIFICATIONS,
  ALL_VERB_TOPIC_TAGS,
  BUILTIN_VERB_GROUPS,
  BUILTIN_VERB_GROUPS_BY_ID,
  CORE_SIX_SLOT_PROMPTS,
  PRONOUN_ONLY_SUBJECT_PROMPTS,
  SUBJECT_PROMPTS,
  buildLernstudioSetFromVerbs,
  buildSafeVerbConjugationOptions,
  buildTeacherStudySpeechText,
  buildVerbConjugationExercise,
  buildVerbSentenceGapExercise,
  calculateUnifiedHomeworkQuestionCount,
  filterVerbs,
  getVerbByInfinitive,
  isItemVerb,
  resolveVerbFromLernstudioItem,
  resolveVerbsFromSelection
} from '../shared/verbEngine';
import { filterLernstudioSetsByQuery } from '../shared/lernstudioTranslations';
import {
  createCustomVerbGroup,
  extractVerbGroupsFromLernstudioSets,
  forkBuiltinVerbGroup,
  hydrateVerbGroupSet,
  isVerbGroupSet,
  updateCustomVerbGroup,
  verbGroupToLernstudioSet
} from '../shared/verbGroupSync';
import {
  buildDynamicQuestionPool,
  isArticleGameSupported
} from '../shared/lernstudioQuestionAdapter';
import { calculateTotalHomeworkQuestions } from '../shared/homeworkStorageSync';
import { conjugateGermanVerb } from '../shared/lernstudioWorksheetBuilder';
import { validateAndParseLernstudioJson } from '../shared/lernstudioAiUtils';

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✅ PASS: ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`❌ FAIL: ${name}\n   -> ${err?.message || err}`);
  }
}

// 1. Embedded Verb Library completeness & deduplication
runTest('Embedded Verb Library meets 2,000+ target across A1/A2/B1 with zero duplicates', () => {
  assert.ok(ALL_VERBS.length >= 2000, `Expected >= 2000 verbs, got ${ALL_VERBS.length}`);

  const a1 = ALL_VERBS.filter((v) => v.level === 'A1');
  const a2 = ALL_VERBS.filter((v) => v.level === 'A2');
  const b1 = ALL_VERBS.filter((v) => v.level === 'B1');

  assert.ok(a1.length >= 500, `Expected >= 500 A1 verbs, got ${a1.length}`);
  assert.ok(a2.length >= 700, `Expected >= 700 A2 verbs, got ${a2.length}`);
  assert.ok(b1.length >= 800, `Expected >= 800 B1 verbs, got ${b1.length}`);

  const seenIds = new Set<string>();
  const seenInf = new Set<string>();
  for (const v of ALL_VERBS) {
    assert.ok(!seenIds.has(v.id), `Duplicate verb ID: ${v.id}`);
    seenIds.add(v.id);

    const key = v.infinitive.trim().toLowerCase();
    assert.ok(!seenInf.has(key), `Duplicate infinitive: ${v.infinitive}`);
    seenInf.add(key);

    assert.ok(v.arabic.trim().length > 0, `Missing Arabic meaning for ${v.infinitive}`);
    assert.ok(v.exampleGerman.trim().length > 0, `Missing German example for ${v.infinitive}`);
    assert.ok(v.exampleArabic.trim().length > 0, `Missing Arabic example for ${v.infinitive}`);
    assert.ok(v.topics.length >= 1, `Missing topics for ${v.infinitive}`);
    assert.ok(v.classifications.length >= 1, `Missing classifications for ${v.infinitive}`);

    const slots = ['ich', 'du', 'er_sie_es', 'wir', 'ihr', 'sie_Sie'] as const;
    for (const s of slots) {
      assert.ok(v.praesens[s] && v.praesens[s].trim().length > 0, `Missing ${s} for ${v.infinitive}`);
    }
  }
});

// 2. German morphology & irregular/modal/separable/reflexive Präsens accuracy
runTest('Core German verbs have exact Präsens conjugations across patterns', () => {
  const checks: Array<[string, Partial<Record<'ich' | 'du' | 'er_sie_es' | 'wir' | 'ihr' | 'sie_Sie', string>>]> = [
    ['sein', { ich: 'bin', du: 'bist', er_sie_es: 'ist', wir: 'sind', ihr: 'seid', sie_Sie: 'sind' }],
    ['haben', { ich: 'habe', du: 'hast', er_sie_es: 'hat', wir: 'haben', ihr: 'habt', sie_Sie: 'haben' }],
    ['werden', { ich: 'werde', du: 'wirst', er_sie_es: 'wird', wir: 'werden', ihr: 'werdet', sie_Sie: 'werden' }],
    ['wissen', { ich: 'weiß', du: 'weißt', er_sie_es: 'weiß', wir: 'wissen', ihr: 'wisst', sie_Sie: 'wissen' }],
    ['mögen', { ich: 'mag', du: 'magst', er_sie_es: 'mag', wir: 'mögen', ihr: 'mögt', sie_Sie: 'mögen' }],
    ['dürfen', { ich: 'darf', du: 'darfst', er_sie_es: 'darf', wir: 'dürfen', ihr: 'dürft', sie_Sie: 'dürfen' }],
    ['können', { ich: 'kann', du: 'kannst', er_sie_es: 'kann', wir: 'können', ihr: 'könnt', sie_Sie: 'können' }],
    ['müssen', { ich: 'muss', du: 'musst', er_sie_es: 'muss', wir: 'müssen', ihr: 'müsst', sie_Sie: 'müssen' }],
    ['sollen', { ich: 'soll', du: 'sollst', er_sie_es: 'soll', wir: 'sollen', ihr: 'sollt', sie_Sie: 'sollen' }],
    ['wollen', { ich: 'will', du: 'willst', er_sie_es: 'will', wir: 'wollen', ihr: 'wollt', sie_Sie: 'wollen' }],
    ['arbeiten', { ich: 'arbeite', du: 'arbeitest', er_sie_es: 'arbeitet', ihr: 'arbeitet' }],
    ['antworten', { ich: 'antworte', du: 'antworte'.replace(/e$/, 'est'), er_sie_es: 'antwortet', ihr: 'antwortet' }],
    ['reisen', { ich: 'reise', du: 'reist', er_sie_es: 'reist' }],
    ['heißen', { ich: 'heiße', du: 'heißt', er_sie_es: 'heißt' }],
    ['sammeln', { ich: 'sammle', wir: 'sammeln', sie_Sie: 'sammeln' }],
    ['wandern', { ich: 'wandere', wir: 'wandern', sie_Sie: 'wandern' }],
    ['fahren', { du: 'fährst', er_sie_es: 'fährt' }],
    ['lesen', { du: 'liest', er_sie_es: 'liest' }],
    ['geben', { du: 'gibst', er_sie_es: 'gibt' }],
    ['sprechen', { du: 'sprichst', er_sie_es: 'spricht' }],
    ['nehmen', { du: 'nimmst', er_sie_es: 'nimmt' }],
    ['aufstehen', { ich: 'stehe auf', du: 'stehst auf', er_sie_es: 'steht auf', wir: 'stehen auf' }],
    ['einkaufen', { ich: 'kaufe ein', du: 'kaufst ein', er_sie_es: 'kauft ein' }],
    ['fernsehen', { ich: 'sehe fern', du: 'siehst fern', er_sie_es: 'sieht fern' }],
    ['sich freuen', { ich: 'freue mich', du: 'freust dich', er_sie_es: 'freut sich', wir: 'freuen uns', ihr: 'freut euch', sie_Sie: 'freuen sich' }]
  ];

  for (const [inf, expected] of checks) {
    const verb = getVerbByInfinitive(inf);
    assert.ok(verb, `Expected verb in library: ${inf}`);
    for (const [slot, form] of Object.entries(expected)) {
      assert.equal(
        verb.praesens[slot as keyof typeof verb.praesens],
        form,
        `Conjugation mismatch for ${inf} [${slot}]`
      );
    }
  }

  const freuen = getVerbByInfinitive('sich freuen');
  assert.ok(freuen?.preposition && freuen?.prepositionCase, 'sich freuen should specify preposition + case');
  const erinnern = getVerbByInfinitive('sich erinnern');
  assert.ok(erinnern?.preposition && erinnern?.prepositionCase, 'sich erinnern should specify preposition + case');
});

// 3. Ready-made 23 built-in groups + filtering
runTest('23 built-in Verb Groups cover CEFR, 6 Grammar categories, and 14 Topics', () => {
  assert.equal(BUILTIN_VERB_GROUPS.length, 23);
  assert.equal(ALL_VERB_CLASSIFICATIONS.length, 6);
  assert.equal(ALL_VERB_TOPIC_TAGS.length, 14);

  for (const grp of BUILTIN_VERB_GROUPS) {
    assert.equal(grp.isBuiltin, true);
    assert.ok(grp.verbIds.length > 0, `Built-in group ${grp.id} should not be empty`);
  }

  const combined = resolveVerbsFromSelection({
    groupIds: ['vgrp_builtin_cefr_a1', 'vgrp_builtin_gram_modal']
  });
  const uniqueCheck = new Set(combined.map((v) => v.id));
  assert.equal(combined.length, uniqueCheck.size);

  const a1Modal = filterVerbs({ levels: ['A1'], classifications: ['Modalverb'] });
  assert.ok(a1Modal.length >= 6);
});

// 4. Non-destructive fork / custom group + Firestore compact sync + teacher attribution
runTest('Custom & forked verb groups preserve built-in groups and sync compactly with teacher tag', () => {
  const originalA1Ids = [...BUILTIN_VERB_GROUPS_BY_ID.get('vgrp_builtin_cefr_a1')!.verbIds];

  const forked = forkBuiltinVerbGroup({
    builtinGroupId: 'vgrp_builtin_cefr_a1',
    removeVerbIds: originalA1Ids.slice(0, 2),
    teacherName: 'أحمد حسني',
    teacherUid: 'teacher_1'
  });

  assert.equal(forked.isBuiltin, false);
  assert.equal(forked.basedOnBuiltinGroupId, 'vgrp_builtin_cefr_a1');
  assert.equal(forked.createdByTeacherName, 'أحمد حسني');
  assert.equal(forked.verbIds.length, originalA1Ids.length - 2);
  // Original built-in unchanged
  assert.equal(BUILTIN_VERB_GROUPS_BY_ID.get('vgrp_builtin_cefr_a1')!.verbIds.length, originalA1Ids.length);

  assert.throws(
    () =>
      updateCustomVerbGroup(BUILTIN_VERB_GROUPS_BY_ID.get('vgrp_builtin_cefr_a1')!, {
        titleDe: 'Illegal overwrite'
      }),
    /Cannot mutate a built-in verb group directly/
  );

  const custom = createCustomVerbGroup({
    titleDe: 'Reiseverben Spezial',
    titleAr: 'أفعال السفر',
    verbIds: originalA1Ids.slice(0, 12),
    teacherName: 'منى عادل'
  });
  const updated = updateCustomVerbGroup(custom, {
    titleAr: 'أفعال السفر المعدلة',
    verbIds: originalA1Ids.slice(0, 15)
  });
  assert.equal(updated.verbIds.length, 15);
  assert.equal(updated.createdByTeacherName, 'منى عادل');

  const compactSet = verbGroupToLernstudioSet(forked, undefined, { compactForSync: true });
  assert.equal(isVerbGroupSet(compactSet), true);
  assert.equal(compactSet.createdByTeacherName, 'أحمد حسني');
  const payloadBytes = Buffer.byteLength(JSON.stringify(compactSet), 'utf8');
  assert.ok(payloadBytes < 440_000, `Compact verb group sync payload too large: ${payloadBytes} bytes`);

  const hydrated = hydrateVerbGroupSet(compactSet);
  assert.equal(hydrated.items.length, forked.verbIds.length);
  assert.ok(hydrated.items[0].conjugation?.ich, 'Hydrated verb item must restore full conjugation');

  const extracted = extractVerbGroupsFromLernstudioSets([compactSet]);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].createdByTeacherName, 'أحمد حسني');
});

// 5. Disambiguated Conjugation Prompts & Safe Unique Options
runTest('SUBJECT_PROMPTS disambiguates sie/sie/Sie and named/combined subjects with unique options', () => {
  const labels = SUBJECT_PROMPTS.map((s) => s.displayLabel);
  assert.ok(labels.includes('sie (هي)'));
  assert.ok(labels.includes('sie (هم / هنّ)'));
  assert.ok(labels.includes('Sie (حضرتك / حضراتكم)'));
  assert.ok(labels.includes('Ahmed und Ali (هم)'));
  assert.ok(labels.includes('du und ich (نحن)'));
  assert.equal(CORE_SIX_SLOT_PROMPTS.length, 6);
  assert.ok(PRONOUN_ONLY_SUBJECT_PROMPTS.every((p) => !p.isNamedOrCombined));

  const machen = getVerbByInfinitive('machen')!;
  const res = buildSafeVerbConjugationOptions(machen, 'er_sie_es', 4);
  assert.equal(res.correctAnswer, 'macht');
  assert.ok(res.options.includes('macht'));
  const lowerUnique = new Set(res.options.map((o) => o.toLowerCase()));
  assert.equal(lowerUnique.size, res.options.length, 'Conjugation options must never duplicate homographs');

  const aufstehen = getVerbByInfinitive('aufstehen')!;
  const ex = buildVerbConjugationExercise(aufstehen, SUBJECT_PROMPTS.find((p) => p.id === 'subj_sie_pl')!, 4);
  assert.equal(ex.correctAnswer, 'stehen auf');
  assert.ok(ex.promptAr.includes('sie (هم / هنّ)'));
});

// 6. 100% Verb-in-Sentence Blank Exercise Coverage across all 2,206 verbs
runTest('buildVerbSentenceGapExercise succeeds across ALL 2,206 verbs with bracketed infinitive hint', () => {
  for (const verb of ALL_VERBS) {
    const gap = buildVerbSentenceGapExercise(verb, ALL_VERBS);
    assert.ok(
      gap.sentenceWithBlank.includes(`(${verb.infinitive})`),
      `Missing infinitive hint in sentenceWithBlank for ${verb.infinitive}: ${gap.sentenceWithBlank}`
    );
    assert.ok(
      gap.sentenceWithBlank.includes('______'),
      `Missing blank marker for ${verb.infinitive}: ${gap.sentenceWithBlank}`
    );
    assert.ok(
      gap.options.includes(gap.correctAnswer),
      `correctAnswer (${gap.correctAnswer}) missing from options for ${verb.infinitive}`
    );
    const optKeys = new Set(gap.options.map((o) => o.toLowerCase()));
    assert.equal(optKeys.size, gap.options.length, `Duplicate options in sentence gap for ${verb.infinitive}`);
  }

  const aufstehen = getVerbByInfinitive('aufstehen')!;
  const sepGap = buildVerbSentenceGapExercise(aufstehen, ALL_VERBS);
  assert.equal(sepGap.isSeparable, true);
  assert.ok(
    sepGap.correctAnswer.includes('... auf'),
    `Separable verb gap should use core ... prefix answer, got ${sepGap.correctAnswer}`
  );
});

// 7. Homework Question Scaling & Question Adapter Integration
runTest('Unified Homework question counts & Shared Question Adapter respect verb, vocab, and mixed modes', () => {
  assert.equal(
    calculateUnifiedHomeworkQuestionCount({
      questionTypes: ['verb_conjugation'],
      vocabItemsCount: 0,
      verbCount: 20,
      contentSource: 'verb'
    }),
    120
  );

  assert.equal(
    calculateUnifiedHomeworkQuestionCount({
      questionTypes: ['verb_conjugation', 'verb_sentence', 'true_false'],
      vocabItemsCount: 10,
      verbCount: 5,
      contentSource: 'mixed'
    }),
    5 * 6 + 5 + 10
  );

  const selected20Verbs = ALL_VERBS.slice(0, 20);
  const verbSet = buildLernstudioSetFromVerbs({
    id: 'test_vset_20',
    title: 'Test 20 Verben',
    verbs: selected20Verbs
  });

  assert.equal(
    calculateTotalHomeworkQuestions(20, ['verb_conjugation'], undefined, 20),
    120
  );

  assert.equal(isArticleGameSupported(verbSet), false, 'Article game must be disabled for verb-only sets');

  const conjPool = buildDynamicQuestionPool(verbSet, 'ar', { questionModeFilter: 'verb_conjugation' });
  assert.ok(conjPool.length >= 20 && conjPool.every((q) => q.type === 'verb_conjugation'));

  const sentPool = buildDynamicQuestionPool(verbSet, 'ar', { questionModeFilter: 'verb_sentence' });
  assert.ok(sentPool.length === 20 && sentPool.every((q) => q.type === 'verb_sentence'));

  const nounSet = {
    id: 'test_nouns',
    title: 'Nomen',
    level: 'A1' as const,
    topic: 'Tiere',
    difficulty: 'easy' as const,
    hasArticles: true,
    items: [
      { id: 'n1', german: 'der Hund', arabic: 'الكلب', article: 'der' as const },
      { id: 'n2', german: 'die Katze', arabic: 'القطة', article: 'die' as const }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  };
  assert.equal(isArticleGameSupported(nounSet), true);

  // Mixed resolution check
  const mixedSet = buildLernstudioSetFromVerbs({
    id: 'test_mixed',
    title: 'Gemischt',
    verbs: selected20Verbs.slice(0, 3),
    extraVocabItems: nounSet.items,
    setKind: 'mixed'
  });
  assert.equal(isItemVerb(mixedSet.items[0]), false);
  assert.equal(isItemVerb(mixedSet.items[2]), true);
  assert.ok(resolveVerbFromLernstudioItem(mixedSet.items[2])?.infinitive);
});

// 8. AiUtils Verb Conjugation & JSON Import Preservation
runTest('conjugateGermanVerb delegates to Shared Verb Library and AI JSON parser preserves verb fields', () => {
  const f = conjugateGermanVerb('fahren');
  assert.equal(f?.du, 'fährst');
  assert.equal(f?.er_sie_es, 'fährt');

  const parsed = validateAndParseLernstudioJson(
    JSON.stringify({
      title: 'Gemischtes Set',
      level: 'A1',
      items: [
        {
          german: 'aufstehen',
          arabic: 'يستيقظ',
          wordType: 'verb'
        }
      ]
    })
  );
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.items?.[0].wordType, 'verb');
  assert.equal(parsed.data?.items?.[0].conjugation?.ich, 'stehe auf');
});

// 9. Teacher Study Speech & Vocab Set Search Filtering
runTest('buildTeacherStudySpeechText reads verb infinitive and all 6 conjugations, while leaving vocab single', () => {
  const gehen = getVerbByInfinitive('gehen');
  assert.ok(gehen);
  const verbSpeech = buildTeacherStudySpeechText({ id: 'v1', german: 'gehen', arabic: 'يذهب', verbId: gehen!.id }, gehen);
  assert.ok(verbSpeech.includes('gehen'));
  assert.ok(verbSpeech.includes(`ich ${gehen!.praesens.ich}`));
  assert.ok(verbSpeech.includes(`du ${gehen!.praesens.du}`));
  assert.ok(verbSpeech.includes(`er, sie, es ${gehen!.praesens.er_sie_es}`));
  assert.ok(verbSpeech.includes(`wir ${gehen!.praesens.wir}`));
  assert.ok(verbSpeech.includes(`ihr ${gehen!.praesens.ihr}`));
  assert.ok(verbSpeech.includes(`sie ${gehen!.praesens.sie_Sie}`));

  const vocabSpeech = buildTeacherStudySpeechText({ id: 'w1', german: 'das Haus', arabic: 'المنزل', wordType: 'noun' });
  assert.equal(vocabSpeech, 'das Haus');
});

runTest('filterLernstudioSetsByQuery matches title, teacher name, grade, and vocabulary items', () => {
  const sampleSets = [
    {
      id: 's1',
      title: 'Häuser und Zimmer',
      topic: 'Wohnen',
      grade: 'جريد 4',
      level: 'A1' as const,
      createdByTeacherName: 'سارة محمود',
      items: [{ id: 'i1', german: 'das Sofa', arabic: 'الأريكة' }]
    },
    {
      id: 's2',
      title: 'Tiere im Zoo',
      topic: 'Tiere',
      grade: 'جريد 1',
      level: 'A1' as const,
      createdByTeacherName: 'محمد علي',
      items: [{ id: 'i2', german: 'der Löwe', arabic: 'الأسد' }]
    }
  ];

  assert.equal(filterLernstudioSetsByQuery(sampleSets, '').length, 2);
  assert.deepEqual(filterLernstudioSetsByQuery(sampleSets, 'سارة').map((s) => s.id), ['s1']);
  assert.deepEqual(filterLernstudioSetsByQuery(sampleSets, 'zimmer').map((s) => s.id), ['s1']);
  assert.deepEqual(filterLernstudioSetsByQuery(sampleSets, 'الأسد').map((s) => s.id), ['s2']);
  assert.equal(filterLernstudioSetsByQuery(sampleSets, 'nonexistent_xyz').length, 0);
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
