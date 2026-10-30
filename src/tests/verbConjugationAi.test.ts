/**
 * Tests for German Verb Conjugation AI Prompt Generator & Question Adapter
 */

import { generateLernstudioPrompt, validateAndParseLernstudioJson } from '../utils/lernstudioAiUtils';
import { buildDynamicQuestionPool } from '../utils/lernstudioQuestionAdapter';
import { LernstudioSet } from '../types/lernstudio';

export function runVerbConjugationAiTests(): { passed: number; failed: number; errors: string[] } {
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

  // 1. Test Prompt Generation with Verb Conjugation Toggle ON
  const promptConjugation = generateLernstudioPrompt({
    topic: 'Verben im Alltag',
    grade: 'جريد 3',
    level: 'A1',
    difficulty: 'medium',
    itemCount: 10,
    includeVerbConjugation: true
  });

  assert(promptConjugation.includes('VERB-KONJUGATION (PRÄSENS SCHWERPUNKT)'), 'Prompt contains Verb Conjugation section');
  assert(promptConjugation.includes('STRENGE EXTRAKTION'), 'Prompt contains strict extraction rule');
  assert(promptConjugation.includes('VARIATION DER SUBJEKTE'), 'Prompt contains varied subject rules');
  assert(promptConjugation.includes('Ahmed und Mona'), 'Prompt includes combined subject examples');
  assert(promptConjugation.includes('du und ich'), 'Prompt includes du und ich examples');

  // 2. Test Prompt Generation with Verb Conjugation Toggle OFF
  const promptStandard = generateLernstudioPrompt({
    topic: 'Tiere',
    grade: 'جريد 1',
    level: 'A1',
    difficulty: 'easy',
    itemCount: 8,
    includeVerbConjugation: false
  });

  assert(!promptStandard.includes('PRÄSENS SCHWERPUNKT'), 'Standard prompt does not force verb conjugation focus');

  // 3. Test JSON Parsing of AI-generated Verb Conjugation Payload
  const sampleAiJson = JSON.stringify({
    title: 'Verben im Alltag (Präsens)',
    topic: 'Verben',
    grade: 'جريد 3',
    level: 'A1',
    difficulty: 'medium',
    hasArticles: false,
    sentenceBuilderSupported: true,
    description: 'Übungen zur Verbkonjugation im Präsens',
    items: [
      {
        german: 'fahren',
        arabic: 'يركب / يسافر',
        english: 'to drive',
        exampleSentenceGerman: 'Ahmed fährt zur Schule.',
        exampleSentenceArabic: 'أحمد يسافر إلى المدرسة.',
        emoji: '🚗',
        missingLetterWord: 'f_hren',
        sentence4Elements: ['Ahmed', 'fährt', 'jeden Tag', 'zur Schule.']
      },
      {
        german: 'lesen',
        arabic: 'يقرأ',
        english: 'to read',
        exampleSentenceGerman: 'Mona liest ein Buch.',
        exampleSentenceArabic: 'منى تقرأ كتاباً.',
        emoji: '📖',
        missingLetterWord: 'l_sen',
        sentence4Elements: ['Mona', 'liest', 'ein langes', 'Buch.']
      }
    ],
    customExercises: [
      {
        type: 'multiple_choice',
        question: 'Ahmed ______ (fahren) jeden Morgen zur Schule.',
        options: ['fährt', 'fahre', 'fährst', 'fahren'],
        correctAnswer: 'fährt',
        explanation: 'Ahmed = er -> fährt (Vokalwechsel a -> ä).'
      },
      {
        type: 'multiple_choice',
        question: 'Mona und Sara ______ (lesen) ein spannendes Buch.',
        options: ['lesen', 'liest', 'lese', 'lest'],
        correctAnswer: 'lesen',
        explanation: 'Mona und Sara = sie (Plural) -> lesen.'
      },
      {
        type: 'multiple_choice',
        question: 'Du und ich ______ (spielen) heute zusammen Fußball.',
        options: ['spielen', 'spielst', 'spiele', 'spielt'],
        correctAnswer: 'spielen',
        explanation: 'Du und ich = wir -> spielen.'
      },
      {
        type: 'multiple_choice',
        question: 'Du ______ (sprechen) sehr gut Deutsch.',
        options: ['sprichst', 'spricht', 'spreche', 'sprechen'],
        correctAnswer: 'sprichst',
        explanation: 'Du -> sprichst (Vokalwechsel e -> i).'
      }
    ]
  });

  const parseResult = validateAndParseLernstudioJson(sampleAiJson);
  assert(parseResult.success === true, 'Sample AI verb conjugation JSON parses successfully');
  assert(parseResult.data !== undefined, 'Parse result has data');
  assert(parseResult.data?.customExercises?.length === 4, '4 custom exercises extracted');

  const parsedExercises = parseResult.data?.customExercises || [];
  assert(parsedExercises[0].question.includes('Ahmed ______ (fahren)'), 'Exercise 1 question formatted correctly');
  assert(parsedExercises[0].options?.includes('fährt'), 'Exercise 1 options contain correctAnswer');
  assert(parsedExercises[1].correctAnswer === 'lesen', 'Exercise 2 correctAnswer is lesen');
  assert(parsedExercises[2].question.includes('Du und ich'), 'Exercise 3 has combined subject');
  assert(parsedExercises[3].correctAnswer === 'sprichst', 'Exercise 4 has stem-changing verb sprichst');

  // 4. Test Question Adapter Compatibility with Game Engines
  const fullSet: LernstudioSet = {
    id: 'set_test_conjugation',
    title: parseResult.data?.title || 'Test',
    topic: parseResult.data?.topic || 'Verben',
    grade: parseResult.data?.grade,
    level: parseResult.data?.level || 'A1',
    difficulty: parseResult.data?.difficulty || 'medium',
    items: parseResult.data?.items || [],
    customExercises: parseResult.data?.customExercises || [],
    createdAt: new Date().toISOString(),
    updatedAt: Date.now()
  };

  const questionPool = buildDynamicQuestionPool(fullSet);
  assert(questionPool.length > 4, 'Question pool created for games');

  const customMcQuestions = questionPool.filter((q) => q.prompt.includes('______'));
  assert(customMcQuestions.length === 4, '4 conjugation sentence completion questions mapped into question pool');
  assert(customMcQuestions[0].options?.length === 4, 'Mapped question retains 4 options');

  console.log(`\nVerb Conjugation AI Tests Summary: ${passed} passed, ${failed} failed.`);
  return { passed, failed, errors };
}

// Execute runner if invoked directly via tsx
if (process.argv[1]?.endsWith('verbConjugationAi.test.ts')) {
  const result = runVerbConjugationAiTests();
  if (result.failed > 0) {
    process.exit(1);
  }
}
