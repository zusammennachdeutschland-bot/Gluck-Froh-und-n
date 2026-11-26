import assert from 'node:assert/strict';
import expressApp, {
  resetHomeworkStoresForTesting,
  sanitizePublicSetSnapshot
} from '../api/expressApp';
import { getInMemoryAdminFirestore, saveAuthoritativeAssignment } from '../server/firebaseAdmin';
import { BUILTIN_GRAMMAR_SETS } from '../data/builtinGrammarSets';
import { COMPLETE_CURRICULUM_SETS } from '../data/curriculum';
import { DEFAULT_LERNSTUDIO_SETS } from '../data/defaultLernstudioSets';
import {
  evaluateNormalizedGrammarAnswer,
  getGrammarLessonExercises,
  hasGrammarContent,
  inferSetKind,
  isGrammarSet,
  normalizeGrammarContent,
  normalizeGermanGrammarAnswer,
  normalizeLernstudioSet,
  stripHeavyGrammarMediaForSync
} from '../shared/grammarEngine';
import {
  computePageImageChecksum,
  deletePageImageRecord,
  exportPageImagesBundle,
  getPageImageRecord,
  importPageImagesBundle,
  PageImageChunkAssembler,
  savePageImageRecord,
  splitPageImageIntoChunks
} from '../shared/lernstudioPageImageStore';
import {
  buildLocalPageImageManifest,
  getLocalPageImageChunk,
  syncMissingPageImagesWithPeer
} from '../services/sync/syncOrchestrator';
import { sanitizeShortLinkAssignmentSnapshot } from '../shared/firebaseCloudSync';
import {
  generateLernstudioPrompt,
  validateAndParseLernstudioJson
} from '../shared/lernstudioAiUtils';
import {
  buildDynamicQuestionPool,
  buildGrammarExerciseOptions,
  buildSentenceGameQuestions,
  evaluateGameQuestionAnswer,
  GAME_COMPATIBILITY_MAP,
  generateMemoryCardsForSet,
  getGameCompatibilityForSet,
  isArticleGameSupported
} from '../shared/lernstudioQuestionAdapter';
import { getSetPlayableItems } from '../shared/lernstudioVocabularyAdapter';
import {
  calculateTotalHomeworkQuestions,
  resolveStageQuestionCount
} from '../shared/homeworkStorageSync';
import {
  buildWorksheetBlocks,
  buildWorksheetHtml,
  WORKSHEET_BUILD_ID
} from '../shared/lernstudioWorksheetBuilder';
import {
  mergeBackupPayloadIntoWorkspace,
  validateAndSanitizeBackupPayload
} from '../utils/backupEngine';
import { sanitizeInitialData } from '../services/dataSanitizer';
import type { LernstudioGameMode, LernstudioSet } from '../types/lernstudio';

(globalThis as any).__TEST_ENV__ = true;

let passedCount = 0;
let failedCount = 0;

async function runCase(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passedCount++;
    console.log(`✅ [UGS] ${name}`);
  } catch (err: any) {
    failedCount++;
    console.error(`❌ [UGS] ${name}:`, err?.stack || err?.message || err);
    throw err;
  }
}

async function runAll() {
  console.log('================================================================================');
  console.log('UNIFIED LERNSTUDIO GRAMMAR SYSTEM & MULTIMODAL INTEGRATION TEST SUITE');
  console.log('================================================================================');

  const server = expressApp.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const inMemDb = getInMemoryAdminFirestore();
  resetHomeworkStoresForTesting();

  try {
    // 1. Legacy backward compatibility & inferSetKind
    await runCase('01. Backward compatibility with legacy vocab, verb_group, and customExercises sets', () => {
      const legacyVocab: LernstudioSet = {
        id: 'legacy_v1',
        title: 'Tiere',
        level: 'A1',
        topic: 'Tiere',
        difficulty: 'easy',
        items: [
          { id: 'v1', german: 'der Hund', arabic: 'الكلب', article: 'der' },
          { id: 'v2', german: 'die Katze', arabic: 'القطة', article: 'die' }
        ],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: 1700000000000
      };
      assert.equal(inferSetKind(legacyVocab), 'vocab');
      assert.equal(isGrammarSet(legacyVocab), false);
      assert.equal(inferSetKind(legacyVocab) === 'mixed', false);

      const legacyVerbGroup: LernstudioSet = {
        id: 'legacy_vg1',
        title: 'Verben',
        level: 'A1',
        topic: 'Verben',
        difficulty: 'medium',
        setKind: 'verb_group',
        items: [{ id: 'vb1', german: 'spielen', arabic: 'يلعب', wordType: 'verb' }],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: 1700000000000
      };
      assert.equal(inferSetKind(legacyVerbGroup), 'verb_group');

      const legacyGrammarCustomOnly: LernstudioSet = {
        id: 'legacy_gram_custom',
        title: 'Imperativ Alt',
        level: 'A2',
        topic: 'Imperativ',
        difficulty: 'medium',
        items: [],
        customExercises: [
          {
            id: 'cex1',
            type: 'fill_blank',
            question: '______ (lesen) das Buch!',
            correctAnswer: 'Lies',
            acceptedAnswers: ['Lies', 'Lesen Sie']
          }
        ],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: 1700000000000
      };
      const normalizedCustom = normalizeLernstudioSet(legacyGrammarCustomOnly);
      assert.equal(inferSetKind(normalizedCustom), 'grammar');
      assert.equal(hasGrammarContent(normalizedCustom), true);
      assert.equal(getGrammarLessonExercises(normalizedCustom).length, 1);
    });

    // 2. Built-in Grammar Sets merged cleanly into curriculum & defaults
    await runCase('02. Built-in grammar sets are included in COMPLETE_CURRICULUM_SETS & DEFAULT_LERNSTUDIO_SETS', () => {
      assert.ok(BUILTIN_GRAMMAR_SETS.length >= 6, 'Expected at least 6 built-in grammar sets');
      for (const gs of BUILTIN_GRAMMAR_SETS) {
        assert.equal(inferSetKind(gs), 'grammar');
        assert.equal(gs.contentOrigin, 'builtin');
        assert.ok(gs.grammarContent, `Missing grammarContent on ${gs.id}`);
        assert.ok(gs.grammarContent!.rules.length >= 1, `Expected rules on ${gs.id}`);
        assert.ok(gs.grammarContent!.examples.length >= 2, `Expected examples on ${gs.id}`);
        assert.ok(gs.grammarContent!.exercises.length >= 4, `Expected exercises on ${gs.id}`);
        assert.ok(
          COMPLETE_CURRICULUM_SETS.some((c) => c.id === gs.id),
          `Missing ${gs.id} in COMPLETE_CURRICULUM_SETS`
        );
        assert.ok(
          DEFAULT_LERNSTUDIO_SETS.some((d) => d.id === gs.id),
          `Missing ${gs.id} in DEFAULT_LERNSTUDIO_SETS`
        );
      }
    });

    // 3. Normalization & answer evaluation for written grammar responses
    await runCase('03. German grammar answer normalization & acceptedAnswers tolerance', () => {
      assert.equal(
        normalizeGermanGrammarAnswer('  Wir   spielen morgen Fußball. '),
        'wir spielen morgen fußball'
      );
      assert.equal(
        normalizeGermanGrammarAnswer('„Wir   spielen morgen Fußball“'),
        normalizeGermanGrammarAnswer('"wir spielen morgen fußball"')
      );
      assert.equal(
        evaluateNormalizedGrammarAnswer('  hat ', { correctAnswer: 'Hat.' }),
        true
      );
      assert.equal(
        evaluateNormalizedGrammarAnswer('Er geht zur Schule.', {
          correctAnswer: 'Er fährt zur Schule.',
          acceptedAnswers: ['Er geht zur Schule.', 'Er fährt in die Schule.']
        }),
        true
      );
      assert.equal(
        evaluateNormalizedGrammarAnswer('Du bist müde', { correctAnswer: 'Er ist müde.' }),
        false
      );
    });

    // 4. External AI prompt generation & JSON validation (vocab / verb / grammar / mixed / universal auto)
    await runCase('04. External AI prompt & JSON parser support universal smart prompt, grammar, mixed, short_answer & empty items', () => {
      const smartPrompt = generateLernstudioPrompt({
        topic: '',
        level: 'A1',
        difficulty: 'medium',
        itemCount: 'auto',
        setMode: 'auto'
      });
      assert.ok(smartPrompt.includes('نوع السيت المطلوب؟'));
      assert.ok(smartPrompt.includes('دا جريد كام؟'));
      assert.ok(smartPrompt.includes('vocab | verb_group | grammar | mixed'));

      const grammarPrompt = generateLernstudioPrompt({
        topic: 'Modalverben im Präsens',
        level: 'A1',
        difficulty: 'medium',
        itemCount: 'auto',
        setMode: 'grammar'
      });
      assert.ok(grammarPrompt.includes('"setKind": "grammar"'));
      assert.ok(grammarPrompt.includes('"grammarContent"'));
      assert.ok(grammarPrompt.includes('"short_answer"'));

      const mixedPrompt = generateLernstudioPrompt({
        topic: 'Essen & Akkusativ',
        level: 'A1',
        difficulty: 'easy',
        itemCount: 8,
        setMode: 'mixed'
      });
      assert.ok(mixedPrompt.includes('"setKind": "mixed"'));

      const validPureGrammarJson = JSON.stringify({
        title: 'Perfekt mit haben',
        topic: 'Perfekt',
        level: 'A2',
        difficulty: 'medium',
        setKind: 'grammar',
        items: [],
        grammarContent: {
          lessonTitle: 'Perfekt mit haben',
          grammarTopic: 'Perfekt',
          explanationAr: 'زمن الماضي التام يتكون من haben أو sein مع التصريف الثالث.',
          rules: [
            {
              id: 'r1',
              title: 'Bildung',
              titleAr: 'التكوين',
              summaryAr: 'الفاعل + haben + ... + Partizip II'
            }
          ],
          examples: [
            { id: 'e1', german: 'Ich habe Deutsch gelernt.', arabic: 'لقد تعلمت الألمانية.' }
          ],
          exercises: [
            {
              id: 'q1',
              type: 'short_answer',
              question: 'Schreibe das Partizip II von "machen":',
              correctAnswer: 'gemacht',
              acceptedAnswers: ['gemacht'],
              explanationAr: 'ge + mach + t',
              source: 'original'
            },
            {
              id: 'q2',
              type: 'sentence_ordering',
              question: 'رتب الجملة:',
              tokens: ['habe', 'Ich', 'gelesen.', 'ein Buch'],
              correctAnswer: 'Ich habe ein Buch gelesen.',
              source: 'generated'
            }
          ]
        }
      });

      const parsed = validateAndParseLernstudioJson(`\`\`\`json\n${validPureGrammarJson}\n\`\`\``);
      assert.equal(parsed.success, true);
      assert.ok(parsed.data);
      assert.equal(parsed.data!.setKind, 'grammar');
      assert.equal(parsed.data!.items!.length, 0);
      assert.equal(parsed.data!.grammarContent!.exercises.length, 2);
      assert.equal(parsed.data!.grammarContent!.exercises[0].type, 'short_answer');
      assert.equal(parsed.data!.grammarContent!.exercises[0].source, 'original');
      assert.equal(parsed.data!.grammarContent!.exercises[1].source, 'generated');
    });

    // 6. Media stripping & local page image IndexedDB/memory fallback store
    await runCase('06. stripHeavyGrammarMediaForSync strips inline data URLs and pageImageStore manages local records', async () => {
      await savePageImageRecord({
        id: 'pg_test_1',
        fileName: 'page1.jpg',
        mimeType: 'image/jpeg',
        base64Data: 'QUJDRA==',
        sizeBytes: 4,
        createdAt: Date.now()
      });
      const fetched = await getPageImageRecord('pg_test_1');
      assert.ok(fetched);
      assert.equal(fetched!.fileName, 'page1.jpg');
      await deletePageImageRecord('pg_test_1');
      assert.equal(await getPageImageRecord('pg_test_1'), null);

      const bloatedSet: any = {
        id: 'set_bloated',
        title: 'With Media',
        level: 'A1',
        topic: 'Akkusativ',
        difficulty: 'easy',
        setKind: 'grammar',
        items: [
          {
            id: 'i1',
            german: 'der Apfel',
            arabic: 'التفاحة',
            imageUrl: 'data:image/png;base64,HUGEDATA',
            audioDataUrl: 'data:audio/mp3;base64,HUGEAUDIO'
          }
        ],
        grammarContent: {
          lessonTitle: 'Akkusativ',
          grammarTopic: 'Akkusativ',
          explanationAr: 'شرح',
          origin: 'teacher_created',
          uploadedImagesBase64: ['data:image/jpeg;base64,HUGE'],
          pageImageRefs: [
            {
              id: 'pg_ref_1',
              fileName: 'seite12.jpg',
              mimeType: 'image/jpeg',
              pageOrder: 1,
              dataUrl: 'data:image/jpeg;base64,SHOULDBESTRIPPED'
            }
          ],
          rules: [],
          examples: [],
          exercises: []
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: 1700000000000
      };

      const stripped = stripHeavyGrammarMediaForSync(bloatedSet);
      assert.equal((stripped as any).items[0].imageUrl, undefined);
      assert.equal((stripped as any).items[0].audioDataUrl, undefined);
      assert.equal((stripped as any).grammarContent.uploadedImagesBase64, undefined);
      assert.equal(stripped.grammarContent!.pageImageRefs!.length, 1);
      assert.equal((stripped.grammarContent!.pageImageRefs![0] as any).dataUrl, undefined);
      assert.equal(stripped.grammarContent!.pageImageRefs![0].fileName, 'seite12.jpg');
    });

    // 7. Public Snapshot Sanitization for Grammar & Mixed sets
    await runCase('07. sanitizePublicSetSnapshot preserves grammar rules/examples while hiding answers/explanations', () => {
      const grammarSet = BUILTIN_GRAMMAR_SETS[0];
      const rawSnapshot = {
        ...grammarSet,
        ownerUid: 'secret_teacher_uid',
        ownerEmail: 'teacher@secret.de'
      };
      const clean = sanitizePublicSetSnapshot(rawSnapshot);
      assert.equal(clean.ownerUid, undefined);
      assert.equal(clean.ownerEmail, undefined);
      assert.ok(clean.grammarContent);
      assert.equal(clean.grammarContent.rules.length, grammarSet.grammarContent!.rules.length);
      assert.equal(clean.grammarContent.examples.length, grammarSet.grammarContent!.examples.length);
      assert.equal(clean.grammarContent.exercises.length, grammarSet.grammarContent!.exercises.length);
      for (const ex of clean.grammarContent.exercises) {
        assert.equal(ex.correctAnswer, undefined, 'Public grammar snapshot must NEVER leak correctAnswer');
        assert.equal(ex.acceptedAnswers, undefined, 'Public grammar snapshot must NEVER leak acceptedAnswers');
        assert.equal(ex.explanationAr, undefined, 'Public grammar snapshot must NEVER leak explanationAr');
      }
    });

    // 8. Server Homework Submission Authoritative Grading for Grammar, Custom, and Article Questions
    await runCase('08. POST /api/homework/submit authoritatively grades grammarContent, acceptedAnswers, short_answer, and article_quiz', async () => {
      const hwId = `hw_gram_grade_${Date.now()}`;
      const snapshot: LernstudioSet = {
        id: 'set_hw_gram_1',
        title: 'Mixed Grammar Test',
        level: 'A1',
        topic: 'Artikel & Akkusativ',
        difficulty: 'medium',
        setKind: 'mixed',
        items: [
          {
            id: 'noun_no_explicit_article',
            german: 'das Heft',
            arabic: 'الكراسة'
          }
        ],
        customExercises: [
          {
            id: 'cust_ex_1',
            type: 'fill_blank',
            question: 'Ich kaufe ______ Stift. (ein)',
            correctAnswer: 'einen',
            acceptedAnswers: ['einen', 'einen neuen']
          }
        ],
        grammarContent: {
          lessonTitle: 'Akkusativ',
          grammarTopic: 'Akkusativ',
          explanationAr: 'المفعول به',
          origin: 'teacher_created',
          rules: [],
          examples: [],
          exercises: [
            {
              id: 'gram_q_1',
              type: 'short_answer',
              question: 'Ergänze im Akkusativ: Ich sehe ______ (der Mann).',
              correctAnswer: 'den Mann',
              acceptedAnswers: ['den Mann', 'den'],
              source: 'original'
            }
          ]
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: 1700000000000
      };

      await inMemDb.collection('homework_assignments').doc(hwId).set({
        id: hwId,
        ownerUid: 'teacher_ugs_1',
        title: 'Grammar Grading Check',
        createdAt: new Date().toISOString(),
        isActive: true,
        audienceMode: 'open',
        setSnapshot: snapshot
      });

      const res = await fetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `sub_${Date.now()}`,
          assignmentId: hwId,
          studentName: 'Lina',
          status: 'completed',
          responses: [
            // Forged isCorrect: false, but normalized answer matches acceptedAnswers ("  DEN  ")
            {
              exerciseId: 'gram_q_1',
              questionType: 'grammar_exercise',
              selectedAnswer: '  DEN. ',
              isCorrect: false
            },
            // Correct custom exercise via acceptedAnswers
            {
              exerciseId: 'cust_ex_1',
              questionType: 'fill_blank',
              selectedAnswer: 'einen neuen',
              isCorrect: false
            },
            // Article fallback from item.german ("das Heft") — student picks wrong article ("der") with forged isCorrect: true
            {
              itemId: 'noun_no_explicit_article',
              questionType: 'article_quiz',
              expectedField: 'article',
              selectedAnswer: 'der',
              isCorrect: true
            }
          ]
        })
      });

      assert.equal(res.status, 200);
      const result = (await res.json()) as any;
      assert.equal(result.success, true);
      assert.equal(result.submission.responses[0].isCorrect, true);
      assert.equal(result.submission.responses[1].isCorrect, true);
      assert.equal(result.submission.responses[2].isCorrect, false);
      assert.equal(result.submission.correctAnswersCount, 2);
      assert.equal(result.submission.totalQuestions, 3);
    });

    // 9. Complete GAME_COMPATIBILITY_MAP & Set-Kind Game Filtering
    await runCase('09. GAME_COMPATIBILITY_MAP covers every LernstudioGameMode and enforces grammar/article/spelling constraints', () => {
      const allModes: LernstudioGameMode[] = [
        'hub', 'games_portal', 'game', 'classroom', 'wheel', 'race', 'memory', 'sorting',
        'sentence_builder', 'balloon_pop', 'tictactoe', 'ultimate_tictactoe', 'basket_catch',
        'space_defense', 'word_detective', 'whack_a_mole', 'tug_of_war', 'word_ninja',
        'bridge_builder', 'color_master', 'factory_machine', 'follow_clues', 'island_crossing',
        'pit_stop', 'puzzle_masters', 'robot_repair', 'rocket_countdown', 'space_fleet',
        'submarine_explore', 'target_attack', 'team_auction', 'tower_architects',
        'vending_machine', 'whats_in_box', 'word_rhythm', 'word_wash', 'solo_sentence'
      ];
      for (const mode of allModes) {
        const entry = GAME_COMPATIBILITY_MAP[mode];
        assert.ok(entry, `Missing GAME_COMPATIBILITY_MAP entry for ${mode}`);
        assert.ok(entry.vocab && entry.verb_group && entry.grammar && entry.mixed);
      }

      const pureGrammarSet = BUILTIN_GRAMMAR_SETS[0];
      assert.equal(isArticleGameSupported(pureGrammarSet), false);
      assert.equal(getGameCompatibilityForSet('sorting', pureGrammarSet, 'ar').isPlayable, false);
      assert.equal(getGameCompatibilityForSet('word_detective', pureGrammarSet, 'ar').isPlayable, false);

      const balloonCompat = getGameCompatibilityForSet('balloon_pop', pureGrammarSet, 'en');
      assert.equal(balloonCompat.status, 'unsupported');
      assert.equal(balloonCompat.isPlayable, false);

      const memoryCompat = getGameCompatibilityForSet('memory', pureGrammarSet, 'ar');
      assert.equal(memoryCompat.status, 'unsupported');
      assert.equal(memoryCompat.isPlayable, false);

      const vocabTemplateModes: LernstudioGameMode[] = [
        'memory', 'balloon_pop', 'tictactoe', 'ultimate_tictactoe', 'basket_catch', 'space_defense',
        'whack_a_mole', 'tug_of_war', 'word_ninja', 'bridge_builder', 'color_master',
        'factory_machine', 'follow_clues', 'island_crossing', 'pit_stop', 'puzzle_masters',
        'robot_repair', 'rocket_countdown', 'space_fleet', 'submarine_explore', 'target_attack',
        'team_auction', 'tower_architects', 'vending_machine', 'whats_in_box', 'word_rhythm', 'word_wash'
      ];
      for (const m of vocabTemplateModes) {
        assert.equal(
          getGameCompatibilityForSet(m, pureGrammarSet, 'ar').isPlayable,
          false,
          `Expected vocab template mode ${m} to be blocked for pure grammar set`
        );
      }

      const grammarPlayableModes: LernstudioGameMode[] = [
        'game', 'classroom', 'wheel', 'race', 'sentence_builder', 'solo_sentence'
      ];
      for (const m of grammarPlayableModes) {
        assert.equal(
          getGameCompatibilityForSet(m, pureGrammarSet, 'ar').isPlayable,
          true,
          `Expected grammar-capable mode ${m} to be playable for pure grammar set`
        );
      }
    });

    // 10. Question pools, zero fake items, exercise option safety, homework counts, and printable worksheets
    await runCase('10. Pure grammar returns zero synthetic items/memory, safe option generation, homework counts & worksheets', () => {
      const pureGrammarSet = BUILTIN_GRAMMAR_SETS[0];
      const pool = buildDynamicQuestionPool(pureGrammarSet, 'ar');
      assert.ok(pool.length >= pureGrammarSet.grammarContent!.exercises.length);
      assert.ok(pool.every((q) => q.type === 'grammar_exercise'));

      const firstQ = pool[0];
      assert.equal(evaluateGameQuestionAnswer(firstQ.correctAnswer.toUpperCase(), firstQ), true);

      const sentenceQs = buildSentenceGameQuestions(pureGrammarSet, 'ar');
      assert.ok(sentenceQs.length >= 1);

      // Strict Priority 2 guard: pure grammar must NOT fabricate fake vocab items or memory pairs
      const playable = getSetPlayableItems(pureGrammarSet);
      assert.equal(playable.length, 0);
      const memCards = generateMemoryCardsForSet(pureGrammarSet, 4, 'ar');
      assert.equal(memCards.length, 0);

      // Option generator must never force generic der/die/das distractors onto fill_blank/short_answer
      const shortEx = pureGrammarSet.grammarContent!.exercises.find((e) => e.type === 'short_answer');
      if (shortEx) {
        assert.equal(buildGrammarExerciseOptions(shortEx, pureGrammarSet.grammarContent!.exercises), undefined);
      }
      const orderEx = pureGrammarSet.grammarContent!.exercises.find((e) => e.type === 'sentence_ordering');
      if (orderEx) {
        assert.equal(buildGrammarExerciseOptions(orderEx, pureGrammarSet.grammarContent!.exercises), undefined);
      }

      // Homework count helpers for pure grammar set
      const gramExCount = getGrammarLessonExercises(pureGrammarSet).length;
      const gStageCount = resolveStageQuestionCount('grammar_exercise', 0, undefined, 0, gramExCount);
      assert.equal(gStageCount, gramExCount);
      const gTotal = calculateTotalHomeworkQuestions(0, ['grammar_exercise'], undefined, 0, gramExCount);
      assert.equal(gTotal, gramExCount);

      // Printable Worksheet builder for pure grammar and mixed sets
      const { data, blocks } = buildWorksheetBlocks(pureGrammarSet, { includeAnswerKey: true });
      assert.ok(data.grammarGuide && data.grammarGuide.rules.length > 0);
      assert.ok(data.grammarLessonExercises && data.grammarLessonExercises.length > 0);
      assert.ok(blocks.some((b) => b.html.includes('Grammatik-Regeln')));
      const html = buildWorksheetHtml(pureGrammarSet, { includeAnswerKey: true });
      assert.ok(html.includes(WORKSHEET_BUILD_ID));
      assert.ok(html.includes('Grammatik-Übungen'));

      const mixedSet: LernstudioSet = {
        ...pureGrammarSet,
        id: 'mixed_ws_test',
        setKind: 'mixed',
        items: [
          {
            id: 'm_it_1',
            german: 'das Buch',
            arabic: 'الكتاب',
            article: 'das',
            plural: 'die Bücher',
            exampleSentenceGerman: 'Ich lese das Buch.',
            exampleSentenceArabic: 'أنا أقرأ الكتاب.',
            sentence4Elements: ['Ich', 'lese', 'das', 'Buch.']
          }
        ]
      };
      const mixedHtml = buildWorksheetHtml(mixedSet, { includeAnswerKey: false });
      assert.ok(mixedHtml.includes('Grammatik-Regeln'));
      assert.ok(mixedHtml.includes('das Buch'));
    });

    // 11. Backup sanitization & merge + dataSanitizer preserve unified grammar metadata
    await runCase('11. Backup engine & dataSanitizer preserve grammarContent, setKind, contentOrigin and strip heavy media', () => {
      const gramSetWithHeavyMedia: any = {
        ...BUILTIN_GRAMMAR_SETS[0],
        id: 'custom_gram_backup_1',
        contentOrigin: 'teacher_created',
        grammarContent: {
          ...BUILTIN_GRAMMAR_SETS[0].grammarContent,
          uploadedImagesBase64: ['data:image/jpeg;base64,BLOAT']
        }
      };

      const backupPayload = {
        app: 'TeacherAssistant',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        backupType: 'Partial',
        categories: ['lernstudio'],
        data: {
          groups: [],
          students: [],
          lessons: [],
          payments: [],
          notifications: [],
          lernstudioSets: [gramSetWithHeavyMedia]
        }
      };

      const validated = validateAndSanitizeBackupPayload(backupPayload);
      assert.equal(validated.isValid, true);
      const sanitizedSet = validated.data.lernstudioSets![0];
      assert.equal(sanitizedSet.setKind, 'grammar');
      assert.equal(sanitizedSet.contentOrigin, 'teacher_created');
      assert.ok(sanitizedSet.grammarContent);
      assert.equal((sanitizedSet.grammarContent as any).uploadedImagesBase64, undefined);

      const merged = mergeBackupPayloadIntoWorkspace(
        {
          groups: [],
          students: [],
          lessons: [],
          payments: [],
          notifications: [],
          todos: [],
          certificates: [],
          schoolNotes: [],
          financeAccounts: [],
          financeCategories: [],
          financeTransactions: [],
          financeRecurring: [],
          financeInstallments: [],
          financeNotifications: [],
          lernstudioSets: []
        } as any,
        backupPayload
      );
      assert.equal(merged.isValid, true);
      const mergedGram = merged.mergedWorkspace.lernstudioSets!.find(
        (s: any) => s.id === 'custom_gram_backup_1'
      );
      assert.ok(mergedGram);
      assert.equal(mergedGram!.setKind, 'grammar');
      assert.ok(mergedGram!.grammarContent!.rules.length > 0);

      const initSanitized = sanitizeInitialData({
        dl_lernstudio_sets: [gramSetWithHeavyMedia]
      });
      assert.equal(initSanitized.dl_lernstudio_sets[0].setKind, 'grammar');
      assert.ok(initSanitized.dl_lernstudio_sets[0].grammarContent);
    });

    // 12. Priority 1 E2E: Answerless public grammar homework + Firestore sanitizer parity + server grading + check-answer + all 6 types
    await runCase('12. Answerless public grammar homework renders cleanly & server grades all 6 types without leaking keys', async () => {
      resetHomeworkStoresForTesting();
      const grammarSixSet: LernstudioSet = {
        id: 'set_gram_6types',
        title: 'All 6 Grammar Types',
        topic: 'Präsens & Wortstellung',
        level: 'A1',
        difficulty: 'medium',
        setKind: 'grammar',
        contentOrigin: 'teacher_created',
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: Date.now(),
        grammarContent: {
          lessonTitle: 'Präsens Komplett',
          grammarTopic: 'Präsens',
          explanationAr: 'تصريف المضارع وترتيب الجملة',
          origin: 'teacher_created',
          rules: [{ id: 'r1', title: 'Verb Position 2', summaryAr: 'الفعل في المركز الثاني' }],
          examples: [{ id: 'ex1', german: 'Ich lerne Deutsch.', arabic: 'أنا أتعلم الألمانية.' }],
          exercises: [
            {
              id: 'ex_mc',
              type: 'multiple_choice',
              question: 'Er ___ jeden Tag Deutsch.',
              options: ['lerne', 'lernt', 'lernen'],
              correctAnswer: 'lernt',
              explanationAr: 'مع er نضيف t',
              source: 'original'
            },
            {
              id: 'ex_fill',
              type: 'fill_blank',
              question: 'Ich ___ aus Ägypten. (kommen)',
              correctAnswer: 'komme',
              acceptedAnswers: ['komme'],
              explanationAr: 'الفعل مع ich ينتهي بـ e',
              source: 'original'
            },
            {
              id: 'ex_cm',
              type: 'correct_mistake',
              question: 'صحح الجملة: Du wohnen in Kairo.',
              faultySentence: 'Du wohnen in Kairo.',
              correctAnswer: 'Du wohnst in Kairo.',
              acceptedAnswers: ['wohnst'],
              explanationAr: 'مع du نضيف st',
              source: 'original'
            },
            {
              id: 'ex_ccs',
              type: 'choose_correct_sentence',
              question: 'اختر الجملة الصحيحة:',
              options: ['Heute gehe ich zur Schule.', 'Heute ich gehe zur Schule.'],
              correctAnswer: 'Heute gehe ich zur Schule.',
              source: 'generated'
            },
            {
              id: 'ex_ord',
              type: 'sentence_ordering',
              question: 'رتب الكلمات:',
              tokens: ['Wir', 'spielen', 'heute', 'Fußball.'],
              correctAnswer: 'Wir spielen heute Fußball.',
              source: 'original'
            },
            {
              id: 'ex_sa',
              type: 'short_answer',
              question: 'اكتب صيغة الجمع لكلمة das Buch:',
              correctAnswer: 'die Bücher',
              acceptedAnswers: ['Bücher'],
              source: 'generated'
            }
          ]
        }
      };

      const hwId = 'hw_gram_6types_1';
      const shortId = 'GR6TYP01';
      await saveAuthoritativeAssignment(
        {
          id: hwId,
          shortId,
          shareToken: 'tok_gram_6',
          groupId: 'grp_g1',
          groupName: 'G1',
          setId: grammarSixSet.id,
          setTitle: grammarSixSet.title,
          isActive: true,
          audienceMode: 'open',
          questionTypes: ['grammar_exercise'],
          selectedGrammarExerciseIds: ['ex_mc', 'ex_fill', 'ex_cm', 'ex_ccs', 'ex_ord', 'ex_sa'],
          assignedStudents: [{ id: 'st_1', name: 'Mona' }],
          setSnapshot: grammarSixSet,
          createdAt: new Date().toISOString()
        },
        'owner_test_uid'
      );

      // Fetch public short link
      const shortRes = await fetch(`${baseUrl}/api/homework/short/${shortId}`);
      assert.equal(shortRes.status, 200);
      const shortJson = await shortRes.json();
      assert.equal(shortJson.status, 'resolved');

      const pubExercises = shortJson.assignment.setSnapshot.grammarContent.exercises;
      assert.equal(pubExercises.length, 6);
      for (const pe of pubExercises) {
        assert.equal(pe.correctAnswer, undefined, 'correctAnswer must be stripped');
        assert.equal(pe.acceptedAnswers, undefined, 'acceptedAnswers must be stripped');
        assert.equal(pe.explanationAr, undefined, 'explanationAr must be stripped');
      }

      const pubOrd = pubExercises.find((e: any) => e.id === 'ex_ord');
      assert.ok(pubOrd && Array.isArray(pubOrd.tokens) && pubOrd.tokens.length === 4);
      assert.notDeepEqual(pubOrd.tokens, ['Wir', 'spielen', 'heute', 'Fußball.'], 'ordering tokens must be scrambled');

      // Normalize public assignment with allowAnswerless: true (simulating HomeworkPlayerPage.tsx)
      const normalizedPublic = normalizeGrammarContent(
        shortJson.assignment.setSnapshot.grammarContent,
        shortJson.assignment.setTitle,
        shortJson.assignment.setSnapshot.topic,
        'teacher_created',
        { allowAnswerless: true }
      );
      assert.equal(normalizedPublic.exercises.length, 6);
      const playablePublicEx = getGrammarLessonExercises(shortJson.assignment.setSnapshot, { allowAnswerless: true });
      assert.equal(playablePublicEx.length, 6);

      // Firestore short-link sanitizer parity check
      const firestoreSanitized = sanitizeShortLinkAssignmentSnapshot(
        {
          id: hwId,
          shortId,
          shareToken: 'tok_gram_6',
          groupId: 'grp_g1',
          groupName: 'G1',
          setId: grammarSixSet.id,
          setTitle: grammarSixSet.title,
          questionTypes: ['grammar_exercise'],
          assignedStudents: [{ id: 'st_1', name: 'Mona' }],
          setSnapshot: grammarSixSet,
          createdAt: new Date().toISOString()
        } as any,
        'owner_test_uid'
      );
      for (const fe of firestoreSanitized.setSnapshot!.grammarContent!.exercises) {
        assert.equal((fe as any).correctAnswer, undefined);
        assert.equal((fe as any).acceptedAnswers, undefined);
        assert.equal((fe as any).explanationAr, undefined);
      }

      // Remote check-answer endpoint must verify answers without leaking correctAnswer
      const checkGoodRes = await fetch(`${baseUrl}/api/homework/check-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeworkId: hwId,
          shareToken: 'tok_gram_6',
          exerciseId: 'ex_sa',
          studentAnswer: 'bücher'
        })
      });
      assert.equal(checkGoodRes.status, 200);
      const checkGoodJson = await checkGoodRes.json();
      assert.equal(checkGoodJson.success, true);
      assert.equal(checkGoodJson.isCorrect, true);
      assert.equal(checkGoodJson.correctAnswer, undefined);

      // Submit full responses: client maliciously claims isCorrect: true on a wrong answer and omits isCorrect on pending answers
      const submitRes = await fetch(`${baseUrl}/api/homework/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission: {
            id: 'sub_gram_6types_1',
            homeworkId: hwId,
            shareToken: 'tok_gram_6',
            studentId: 'st_1',
            studentName: 'Mona',
            groupName: 'G1',
            submittedAt: new Date().toISOString(),
            timeSpentSeconds: 95,
            responses: [
              { questionId: 'gq_1', exerciseId: 'ex_mc', questionType: 'grammar_exercise', prompt: 'p', correctAnswer: '', studentAnswer: 'lernt', isCorrect: false, pendingServerGrading: true },
              { questionId: 'gq_2', exerciseId: 'ex_fill', questionType: 'grammar_exercise', prompt: 'p', correctAnswer: '', studentAnswer: 'komme', isCorrect: false, pendingServerGrading: true },
              { questionId: 'gq_3', exerciseId: 'ex_cm', questionType: 'grammar_exercise', prompt: 'p', correctAnswer: '', studentAnswer: 'wohnst', isCorrect: false },
              { questionId: 'gq_4', exerciseId: 'ex_ccs', questionType: 'grammar_exercise', prompt: 'p', correctAnswer: '', studentAnswer: 'Heute gehe ich zur Schule', isCorrect: false },
              { questionId: 'gq_5', exerciseId: 'ex_ord', questionType: 'grammar_exercise', prompt: 'p', correctAnswer: '', studentAnswer: 'wir spielen heute fußball', isCorrect: false },
              { questionId: 'gq_6', exerciseId: 'ex_sa', questionType: 'grammar_exercise', prompt: 'p', correctAnswer: '', studentAnswer: 'falsche Antwort', isCorrect: true }
            ]
          }
        })
      });
      assert.equal(submitRes.status, 200);
      const submitJson = await submitRes.json();
      assert.equal(submitJson.submission.correctAnswersCount, 5);
      assert.equal(submitJson.submission.totalQuestions, 6);
      assert.equal(submitJson.submission.responses[5].isCorrect, false, 'server must reject spoofed client isCorrect');
      assert.equal(submitJson.submission.responses[0].pendingServerGrading, undefined, 'pendingServerGrading must be cleared');

      // Unknown / unassigned exerciseId must be rejected cleanly with HTTP 400
      const badCheckRes = await fetch(`${baseUrl}/api/homework/check-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeworkId: hwId,
          shareToken: 'tok_gram_6',
          exerciseId: 'unknown_fake_ex',
          studentAnswer: 'x'
        })
      });
      assert.equal(badCheckRes.status, 400);
    });

    // 13. Priority 3 E2E: Chunked P2P Page Image Transfer, Resume Retry, Checksum Integrity, and Manual Bundle Export/Import
    await runCase('13. Chunked P2P image transfer validates checksums, retries interrupted chunks, skips duplicates, and bundles export/import cleanly', async () => {
      const payload1 = 'A'.repeat(5000) + 'B'.repeat(4500);
      const checksum1 = computePageImageChecksum(payload1);
      const rec1 = {
        id: 'pg_p2p_sync_1',
        fileName: 'lektion3_p1.jpg',
        mimeType: 'image/jpeg',
        base64Data: payload1,
        width: 800,
        height: 1100,
        sizeBytes: 7125,
        createdAt: Date.now(),
        checksum: checksum1
      };

      // Chunk splitting & out-of-order reassembly + checksum verification
      const chunks = splitPageImageIntoChunks(rec1, 2048);
      assert.ok(chunks.length >= 4);
      const assembler = new PageImageChunkAssembler({
        imageId: rec1.id,
        fileName: rec1.fileName,
        mimeType: rec1.mimeType,
        sizeBytes: rec1.sizeBytes,
        checksum: checksum1,
        totalChunks: chunks.length
      });
      // Feed chunks out of order
      for (const c of [...chunks].reverse()) {
        assert.equal(assembler.addChunk(c).accepted, true);
      }
      const finalized = assembler.finalizeRecord();
      assert.equal(finalized.ok, true);
      if (finalized.ok) {
        assert.equal(finalized.record.base64Data, payload1);
        assert.equal(finalized.record.checksum, checksum1);
      }

      // Checksum corruption detection
      const badAssembler = new PageImageChunkAssembler({
        imageId: rec1.id,
        fileName: rec1.fileName,
        mimeType: rec1.mimeType,
        sizeBytes: rec1.sizeBytes,
        checksum: checksum1,
        totalChunks: chunks.length
      });
      for (let i = 0; i < chunks.length; i++) {
        badAssembler.addChunk(i === 1 ? { ...chunks[i], dataChunk: 'Z'.repeat(chunks[i].dataChunk.length) } : chunks[i]);
      }
      assert.deepEqual(badAssembler.finalizeRecord(), { ok: false, error: 'CHECKSUM_MISMATCH' });

      // Simulate Peer B (receiver) pulling missing image from Peer A (sender) with 1 dropped chunk retry
      const peerBTargetId = 'pg_p2p_pull_99';
      await deletePageImageRecord(peerBTargetId);
      const sourceRecord = { ...rec1, id: peerBTargetId };
      const sourceChunks = splitPageImageIntoChunks(sourceRecord, 2048);
      let droppedOnce = false;

      const receiverDataSource: any = {
        getLocalData: () => ({
          lernstudioSets: [
            {
              id: 'set_p2p_img',
              grammarContent: {
                pageImageRefs: [
                  { id: peerBTargetId, fileName: 'seite1.jpg', mimeType: 'image/jpeg', pageOrder: 1, checksum: checksum1 }
                ]
              }
            }
          ]
        }),
        getSyncState: () => ({}),
        saveMergedData: async () => {},
        updateSyncState: async () => {}
      };

      const transferResult = await syncMissingPageImagesWithPeer({
        peer: { deviceId: 'dev_android_1', pairingToken: 'pair_tok' },
        dataSource: receiverDataSource,
        chunkSizeChars: 2048,
        maxRetriesPerChunk: 3,
        transport: {
          fetchManifest: async () => ({
            availableImages: [
              {
                id: peerBTargetId,
                fileName: sourceRecord.fileName,
                mimeType: sourceRecord.mimeType,
                sizeBytes: sourceRecord.sizeBytes,
                createdAt: sourceRecord.createdAt,
                checksum: checksum1,
                totalChunks: sourceChunks.length
              }
            ]
          }),
          fetchChunk: async ({ chunkIndex }) => {
            if (chunkIndex === 1 && !droppedOnce) {
              droppedOnce = true;
              throw new Error('Simulated transient packet drop');
            }
            return sourceChunks[chunkIndex];
          }
        }
      });

      assert.deepEqual(transferResult.transferredIds, [peerBTargetId]);
      assert.equal(transferResult.failedIds.length, 0);
      const savedOnPeerB = await getPageImageRecord(peerBTargetId);
      assert.ok(savedOnPeerB);
      assert.equal(savedOnPeerB!.base64Data, payload1);

      // Re-running sync skips already-present image without fetching chunks again
      const secondRun = await syncMissingPageImagesWithPeer({
        peer: { deviceId: 'dev_android_1', pairingToken: 'pair_tok' },
        dataSource: receiverDataSource
      });
      assert.deepEqual(secondRun.transferredIds, []);
      assert.ok(secondRun.skippedExistingIds.includes(peerBTargetId));

      // Local helper route builders manifest/chunk
      const manifestCheck = await buildLocalPageImageManifest({ requestedImageIds: [peerBTargetId] });
      assert.equal(manifestCheck.availableImages.length, 1);
      const chunk0 = await getLocalPageImageChunk({ imageId: peerBTargetId, chunkIndex: 0, chunkSizeChars: 2048 });
      assert.equal(chunk0.imageId, peerBTargetId);

      // Manual bundle export -> delete -> import -> duplicate-skip round-trip
      const bundle = await exportPageImagesBundle([peerBTargetId]);
      assert.equal(bundle.app, 'GlueckPageImages');
      assert.equal(bundle.images.length, 1);
      await deletePageImageRecord(peerBTargetId);
      assert.equal(await getPageImageRecord(peerBTargetId), null);

      const imported1 = await importPageImagesBundle(JSON.stringify(bundle));
      assert.equal(imported1.importedCount, 1);
      assert.equal(imported1.skippedDuplicates, 0);

      const imported2 = await importPageImagesBundle(bundle);
      assert.equal(imported2.importedCount, 0);
      assert.equal(imported2.skippedDuplicates, 1);

      await deletePageImageRecord(peerBTargetId);
    });

    console.log(`\n🎉 UNIFIED GRAMMAR TEST SUMMARY: ${passedCount} passed, ${failedCount} failed, 0 skipped.`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    resetHomeworkStoresForTesting();
  }
}

runAll().catch((err) => {
  console.error('Unified Grammar System test suite failed:', err);
  process.exit(1);
});
