import {
  LernstudioSet,
  LernstudioItem,
  LernstudioLevel,
  LernstudioDifficulty,
  LernstudioExercise,
  LernstudioWordType,
  VerbConjugationForms
} from '../types/lernstudio';
import {
  rebuildSentence4Elements,
  isSentence4ElementsValid,
  conjugateGermanVerb,
  detectWordType
} from './lernstudioWorksheetBuilder';

export interface PromptGenConfig {
  topic: string;
  grade?: string;
  level: LernstudioLevel;
  difficulty: LernstudioDifficulty;
  itemCount: number | 'auto';
  teacherName?: string;
  includeSentences?: boolean;
  includeExercises?: boolean;
  includeVerbConjugation?: boolean;
}

export function generateLernstudioPrompt(config: PromptGenConfig): string {
  const isAuto = config.itemCount === 'auto' || !config.itemCount;
  const countInstruction = isAuto
    ? 'Der KI-Assistent wählt automatisch die optimale Anzahl an Begriffen (z.B. 6, 8, 10, 12 oder 15 Wörter) basierend auf der hochgeladenen Lektion oder dem bereitgestellten Bild.'
    : `Erstelle genau ${config.itemCount} Wortschatz-Einträge.`;

  const verbInstructionBlock = config.includeVerbConjugation
    ? `
WICHTIGE ANWEISUNG ZUR VERB-KONJUGATION (PRÄSENS SCHWERPUNKT):
DIESES SET SIND VERB-KONJUGATIONS-ÜBUNGEN IM PRÄSENS!
1. STRENGE EXTRAKTION: Identifiziere und extrahiere AUSSCHLIESSLICH Verben, die im bereitgestellten Lehrbuchtext, Arbeitsblatt oder Bild vorkommen (z.B. fahren, lesen, spielen, sprechen, lernen, essen, trinken, sein, haben, kochen). Erfinde KEINE unpassenden Verben!
2. AUSSCHLIESSLICH PRÄSENS: Teste ausschließlich die Gegenwart (Präsens), einschließlich regelmäßiger Verben, unregelmäßiger Verben und Verben mit Vokalwechsel (z.B. fahren -> du fährst, lesen -> er liest, sprechen -> du sprichst, sehen -> er sieht, sein -> ich bin/du bist/er ist, haben -> du hast/er hat).
3. VARIATION DER SUBJEKTE (SEHR WICHTIG):
   Verwende NICHT nur einfache Pronomen (ich, du, er/sie/es, wir, ihr, sie/Sie). Mische abwechslungsreich:
   - Personalpronomen: "Ich", "du", "wir", "ihr", "er", "sie"
   - Einzelnamen: z.B. "Ahmed", "Mona", "Lukas"
   - Mehrere Namen: z.B. "Ahmed und Mona", "Sara und Lisa"
   - Kombinierte Subjekte: z.B. "du und ich" (= wir -> spielen), "Ahmed und ich" (= wir -> lernen)
   - Nomen aus der Lektion: z.B. "Die Kinder", "Der Lehrer", "Die Katze"
4. FORMAT DER VERBKONJUGATIONS-ÜBUNGEN (customExercises):
   Erstelle in "customExercises" Satz-Vervollständigungsaufgaben (type: "multiple_choice") mit Lücke "______ (Verb in Grundform)" und genau 4 grammatikalisch plausiblen Antwortoptionen (verschiedene Konjugationsformen) mit korrekter Subjekt-Verb-Kongruenz.
`
    : `
WICHTIGE ANWEISUNG ZUR VERB-KONJUGATION (PRÄSENS):
Falls die Lektion Verben enthält, erstelle auch Übungen zur Verbkonjugation im Präsens (mit variierten Subjekten wie Einzelnamen "Ahmed", mehreren Namen "Ahmed und Mona", kombinierten Subjekten "du und ich" und Pronomen).
`;

  return `Du bist ein pädagogischer Deutschlehrer, Spieledesigner und Ersteller von interaktivem Lehrmaterial für Lernstudio (Glueck Teacher).
Erstelle ein extrem reichhaltiges, vollständiges Lern- und Spiel-Set im JSON-Format, das alle 8 interaktiven Lernstufen (1. Lernen, 2. Richtig/Falsch, 3. Zwei Optionen, 4. Alle Wörter, 5. Fehlender Buchstabe, 6. Buchstabenfolge, 7. Wort vervollständigen, 8. Spiele) sowie alle Spielmodi (Satzbau/ترتيب الجمل, Glücksrad/Spin Wheel, Team-Rennen/Team Race, Memory-Karten, Artikel-Sortierboxen der-die-das, und Quiz-Spiele) optimal antreibt.

Thema: ${config.topic}
Ziel-Klasse/الصف الدراسي: ${config.grade || 'غير حدد (اسأل المستخدم: دا جريد كام؟ / Grade 1 - 12)'}
Niveau/المستوى: ${config.level}
Schwierigkeit: ${config.difficulty}
Anzahl der Begriffe: ${isAuto ? 'Automatisch durch KI gewählt (6-15 Begriffe je nach Text/Bild)' : config.itemCount}

WICHTIGE ANWEISUNG ZUR KLASSE (GRADE 1 - GRADE 12):
1. Falls der Benutzer die Zielklasse nicht angegeben hat, frage ihn zuerst höflich: "أي صف دراسي (دا جريد كام من جريد 1 إلى جريد 12) يستهدف هذا الدرس؟" bevor du antwortest.
2. Wenn die Klasse bekannt ist oder aus dem Bild/Text eindeutig hervorgeht, ordne das Set im Feld "grade" streng einer Klasse von "جريد 1" bis "جريد 12" zu (z.B. "جريد 1", "جريد 2", "جريد 5", etc.).

STRENGSTE REGEL - KEINE ZUFÄLLIGEN INHALTE:
1. Verwende AUSSCHLIESSLICH die Begriffe und Texte aus dem vom Benutzer bereitgestellten BILD (oder dem gesendeten Lektionstext)!
2. Füge KEINE zufälligen, erfundenen oder externen Wörter hinzu, die nicht im gesendeten Bild/Material vorkommen!
3. Wenn der Benutzer ein Bild oder Foto einer Buchseite sendet, extrahiere streng nur die Vokabeln und Verben aus diesem Bild.
${verbInstructionBlock}
WICHTIGE SATZBAU- UND TRANSLATION-REGEL (STRENG BINDEND):
1. "sentence4Elements" MUSS EXAKT der Satz aus "exampleSentenceGerman" sein, aufgeteilt in genau 4 Wortblöcke in der korrekten Reihenfolge.
2. Die 4 Blöcke von "sentence4Elements" zusammengefügt mit Leerzeichen MÜSSEN IDENTISCH mit "exampleSentenceGerman" sein (z.B. ["Die Katze", "schläft", "auf dem", "Sofa."]).
3. "exampleSentenceArabic" MUSS die Übersetzung genau dieses Satzes sein. Der Satz muss das Wort/die Vokabel der Karte enthalten.

WICHTIGE SILBEN-AUFTEILUNGS-REGEL (STRENG BINDEND FOR SYLLABLE PUZZLE):
1. Jeder Begriff in "items" MUSS zwingend das Feld "syllables" enthalten.
2. "syllables" ist ein Array aus 2 oder mehr deutschen Silben bzw. Lautblöcken des reinen Wortes (ohne Artikel), die zusammengesetzt exakt das Wort ergeben.
3. BEISPIELE FÜR SILBEN-AUFTEILUNG ("syllables"):
   - "Fleisch" -> ["Flei", "sch"]
   - "Schule" -> ["Schu", "le"]
   - "Banane" -> ["Ba", "na", "ne"]
   - "Brot" -> ["Bro", "t"]
   - "Krankenhaus" -> ["Kran", "ken", "haus"]

WICHTIGE REGEL FÜR ARTIKEL UND WORTARTEN:
1. Für alle Nomen MUSS der bestimmte Artikel im Feld "article" angegeben werden ("der", "die" oder "das") UND im Feld "german" vorangestellt werden (z.B. german: "das Fleisch", article: "das").
2. Für Verben und Adjektive lasse "article" null oder weglassen (z.B. german: "fahren", article: null).
3. Für Nomen MUSS auch der Plural mit Artikel angegeben werden (z.B. plural: "die Katzen").

ANFORDERUNGEN AN JEDEN EINZELNEN BEGRIFF (items):
1. ${countInstruction}
2. Jeder Begriff benötigt zwingend:
   - "german": Der deutsche Begriff inkl. bestimmtem Artikel falls Nomen (z.B. "die Katze", "das Buch", "der Tisch", "spielen", "schnell").
   - "article": Exakt "der", "die" oder "das" falls es ein Nomen ist (oder null/weglassen falls Verb/Adjektiv).
   - "arabic": Die genaue arabische Übersetzung (z.B. "القطة", "الكتاب", "يلعب").
   - "syllables": Array aus 2+ deutschen Silben/Lautblöcken des reinen Wortes (z.B. ["Flei", "sch"] oder ["Schu", "le"]).
   - "english": Optionale englische Übersetzung (z.B. "the cat").
   - "plural": Der Plural mit Artikel falls Nomen (z.B. "die Katzen", "die Bücher").
   - "wordType": "noun" | "verb" | "adjective" | "phrase" | "other"
   - "conjugation": für Verben {"ich","du","er_sie_es","wir","ihr","sie_Sie"} im Präsens (korrekt mit Vokalwechsel z.B. fahren: fahre, fährst, fährt, fahren, fahrt, fahren)
   - "exampleSentenceGerman": Ein klarer, grammatikalisch korrekter deutscher Beispielsatz (z.B. "Die Katze schläft auf dem Sofa.").
   - "exampleSentenceArabic": Die arabische Übersetzung des Beispielsatzes.
   - "emoji": Ein passendes Emoji (z.B. "🐱", "📖").
   - "missingLetterWord": Das Wort mit genau einer Lücke "_" für das Buchstabenspiel (z.B. "K_tze" oder "B_ch").
   - "sentence4Elements": EXAKT der Satz von "exampleSentenceGerman" aufgeteilt in 4 Wortblöcke (z.B. ["Die Katze", "schläft", "auf dem", "Sofa."]).

ANFORDERUNGEN AN ZUSÄTZLICHE ÜBUNGEN (customExercises):
Erstelle 3 bis 6 abwechslungsreiche Übungen (Interaktive Multiple-Choice Fragen) zur Grammatik, Wortschatz oder Satzbau der Lektion:
- "type": "multiple_choice"
- "question": Fragetext mit Lücke "______"
- "options": Genau 4 Antwortoptionen
- "correctAnswer": Die korrekte Antwort aus den Options
- "explanation": Kurze Erklärung auf Arabisch/Deutsch

Gib AUSSCHLIESSLICH ein valides, reines JSON-Objekt zurück.

STRENGE REGELN ZUR JSON-SYNTAX (WICHTIG):
1. Gib AUSSCHLIESSLICH ein valides, reines JSON-Objekt zurück ohne Markdown-Formatierung (KEINE Code-Blöcke wie \`\`\`json oder \`\`\`).
2. Escape NIEMALS eckige Klammern [ oder ] mit Backslashes (schreibe IMMER [ und ], NIEMALS \\[ oder \\]).
3. Escape NIEMALS geschweifte Klammern { oder } com Backslashes (schreibe IMMER { und }, NIEMALS \\{ oder \\}).
4. Verwende ausschließlich standardmäßige gerade doppelte Anführungszeichen (") für Keys und Strings, niemals geschwungene Anführungszeichen.
5. Keine Kommentare (kein // oder /* */) und keine abschließenden Kommas (keine Trailing Commas vor ] oder }).

JSON-STRUKTUR:
{
  "title": "${config.topic}",
  "topic": "${config.topic}",
  "grade": "${config.grade || ''}",
  "level": "${config.level}",
  "difficulty": "${config.difficulty}",
  "createdByTeacherName": "${(config.teacherName || '').replace(/"/g, '')}",
  "hasArticles": true,
  "sentenceBuilderSupported": true,
  "description": "Lern-Set zum Thema ${config.topic} (${config.level})",
  "items": [
    {
      "german": "das Fleisch",
      "article": "das",
      "arabic": "اللحم",
      "syllables": ["Flei", "sch"],
      "plural": "die Fleische",
      "wordType": "noun",
      "category": "food",
      "exampleSentenceGerman": "Mona isst gern Fleisch.",
      "exampleSentenceArabic": "منى تحب أكل اللحم.",
      "emoji": "🥩",
      "missingLetterWord": "Fl_isch",
      "sentence4Elements": ["Mona", "isst", "gern", "Fleisch."]
    },
    {
      "german": "fahren",
      "arabic": "يركب / يسافر",
      "syllables": ["fah", "ren"],
      "wordType": "verb",
      "category": "transport",
      "conjugation": {
        "ich": "fahre",
        "du": "fährst",
        "er_sie_es": "fährt",
        "wir": "fahren",
        "ihr": "fahrt",
        "sie_Sie": "fahren"
      },
      "exampleSentenceGerman": "Ahmed fährt morgen nach Berlin.",
      "exampleSentenceArabic": "أحمد يسافر غداً إلى برلين.",
      "emoji": "🚗",
      "missingLetterWord": "f_hren",
      "sentence4Elements": ["Ahmed", "fährt", "morgen", "nach Berlin."]
    }
  ],
  "customExercises": [
    {
      "type": "multiple_choice",
      "question": "Mona ______ (essen) gern Fleisch.",
      "options": ["isst", "esse", "esst", "essen"],
      "correctAnswer": "isst",
      "explanation": "Mona = sie -> isst (Vokalwechsel e -> i)."
    }
  ]
}`;
}

export function safeParseLernstudioJsonString(rawText: string): any {
  if (!rawText || !rawText.trim()) {
    throw new Error('النص المدخل فارغ. يرجى لصق كود JSON الناتج من الذكاء الاصطناعي.');
  }

  let text = rawText.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(text);
  } catch {
    // Continue
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(text);
    } catch {
      // Continue
    }
  }

  let repaired = text
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  repaired = repaired.replace(/(\\+)([\[\]{}])/g, (match, slashes, bracket) => {
    if (slashes.length % 2 === 1) {
      return slashes.slice(0, -1) + bracket;
    }
    return match;
  });

  repaired = repaired.replace(/\\'/g, "'");

  try {
    return JSON.parse(repaired);
  } catch {
    // Continue
  }

  repaired = repaired.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
  repaired = repaired.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(repaired);
  } catch {
    // Continue
  }

  repaired = repaired.replace(/(\\+)([^"\\\/bfnrtu])/g, (match, slashes, char) => {
    if (slashes.length % 2 === 1) {
      return slashes.slice(0, -1) + char;
    }
    return match;
  });

  return JSON.parse(repaired);
}

export function validateAndParseLernstudioJson(
  jsonText: string
): { success: boolean; data?: Partial<LernstudioSet>; error?: string } {
  try {
    const parsed = safeParseLernstudioJsonString(jsonText);

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'تنسيق البيانات غير صحيح (ليس كائن JSON).' };
    }

    const itemsRaw = parsed.items || parsed.words || parsed.vocabulary;
    if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
      return { success: false, error: 'لم يتم العثور على مصفوفة كلمات (items) داخل كود JSON.' };
    }

    const sanitizedItems: LernstudioItem[] = [];
    for (let i = 0; i < itemsRaw.length; i++) {
      const it = itemsRaw[i];
      if (!it || typeof it !== 'object') continue;

      let german = String(it.german || it.word || it.term || '').trim();
      const arabic = String(it.arabic || it.meaning || it.translation || '').trim();

      if (!german || !arabic) continue;

      let article: 'der' | 'die' | 'das' | undefined = undefined;
      const rawArticle = String(it.article || '').toLowerCase().trim();
      if (['der', 'die', 'das'].includes(rawArticle)) {
        article = rawArticle as 'der' | 'die' | 'das';
      } else {
        const match = german.match(/^(der|die|das)\b/i);
        if (match) {
          article = match[1].toLowerCase() as 'der' | 'die' | 'das';
        }
      }

      // WordType validation
      let wordType: LernstudioWordType | undefined = undefined;
      const validWordTypes = ['noun', 'verb', 'adjective', 'phrase', 'other'];
      if (it.wordType && validWordTypes.includes(String(it.wordType).toLowerCase())) {
        wordType = String(it.wordType).toLowerCase() as LernstudioWordType;
      }

      // Conjugation validation (auto-fill from shared verb library if omitted for a verb)
      let conjugation: VerbConjugationForms | undefined = undefined;
      if (it.conjugation && typeof it.conjugation === 'object') {
        const c = it.conjugation;
        if (c.ich && c.du && c.er_sie_es && c.wir && c.ihr && c.sie_Sie) {
          conjugation = {
            ich: String(c.ich).trim(),
            du: String(c.du).trim(),
            er_sie_es: String(c.er_sie_es).trim(),
            wir: String(c.wir).trim(),
            ihr: String(c.ihr).trim(),
            sie_Sie: String(c.sie_Sie).trim()
          };
        }
      }
      if (!conjugation && wordType === 'verb') {
        conjugation = conjugateGermanVerb(german) || undefined;
      }

      // 4-element sentence structure
      let sentence4: [string, string, string, string] | undefined = undefined;
      const exGerman = it.exampleSentenceGerman ? String(it.exampleSentenceGerman).trim() : undefined;

      if (Array.isArray(it.sentence4Elements) && it.sentence4Elements.length === 4) {
        const rawBlocks: [string, string, string, string] = [
          String(it.sentence4Elements[0]).trim(),
          String(it.sentence4Elements[1]).trim(),
          String(it.sentence4Elements[2]).trim(),
          String(it.sentence4Elements[3]).trim()
        ];
        if (exGerman && isSentence4ElementsValid(exGerman, rawBlocks)) {
          sentence4 = rawBlocks;
        } else if (exGerman) {
          sentence4 = rebuildSentence4Elements(exGerman) || rawBlocks;
        } else {
          sentence4 = rawBlocks;
        }
      } else if (exGerman) {
        sentence4 = rebuildSentence4Elements(exGerman) || undefined;
      }

      if (!sentence4 || sentence4.some((c) => !c)) {
        sentence4 = ['Das', 'Wort', 'heißt', german];
      }

      let missingLetterWord = String(it.missingLetterWord || '').trim();
      if (!missingLetterWord && german) {
        const cleanWord = german.replace(/^(der|die|das)\s+/i, '');
        if (cleanWord.length > 2) {
          const midIndex = Math.floor(cleanWord.length / 2);
          missingLetterWord = cleanWord.substring(0, midIndex) + '_' + cleanWord.substring(midIndex + 1);
        } else {
          missingLetterWord = cleanWord + '_';
        }
      }

      let syllables: string[] | undefined = undefined;
      const rawSyl = it.syllables || it.syllableParts || it.silben;
      if (Array.isArray(rawSyl) && rawSyl.length >= 2) {
        const cleanedSyl = rawSyl.map((s: any) => String(s).trim()).filter(Boolean);
        if (cleanedSyl.length >= 2) {
          syllables = cleanedSyl;
        }
      }

      sanitizedItems.push({
        id: it.id ? String(it.id).trim() : `item_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        german,
        article,
        arabic,
        english: it.english ? String(it.english).trim() : undefined,
        plural: it.plural ? String(it.plural).trim() : undefined,
        exampleSentenceGerman: exGerman,
        exampleSentenceArabic: it.exampleSentenceArabic ? String(it.exampleSentenceArabic).trim() : undefined,
        emoji: it.emoji ? String(it.emoji).trim() : (wordType === 'verb' ? '🔤' : '📚'),
        missingLetterWord,
        sentence4Elements: sentence4,
        wordType,
        conjugation,
        category: it.category ? String(it.category).trim() : undefined,
        syllables,
        ...(it.verbId ? { verbId: String(it.verbId).trim() } : {}),
        ...(Array.isArray(it.classifications) ? { classifications: it.classifications } : {}),
        ...(it.separablePrefix ? { separablePrefix: String(it.separablePrefix).trim() } : {}),
        ...(it.preposition ? { preposition: String(it.preposition).trim() } : {}),
        ...(it.prepositionCase ? { prepositionCase: String(it.prepositionCase).trim() } : {})
      });
    }

    if (sanitizedItems.length === 0) {
      return { success: false, error: 'الكلمات المدخلة تفتقر إلى الألفاظ الألمانية أو الترجمات العربية الصحيحة.' };
    }

    const sanitizedExercises: LernstudioExercise[] = [];
    if (Array.isArray(parsed.customExercises) && parsed.customExercises.length > 0) {
      parsed.customExercises.forEach((ex: any, idx: number) => {
        if (!ex || !ex.question || !ex.correctAnswer) return;
        const correctAns = String(ex.correctAnswer).trim();
        let opts: string[] | undefined = Array.isArray(ex.options)
          ? ex.options.map((opt: any) => String(opt).trim()).filter(Boolean)
          : undefined;

        if (opts && opts.length > 0 && !opts.includes(correctAns)) {
          opts.unshift(correctAns);
        }

        sanitizedExercises.push({
          id: `ex_${Date.now()}_${idx}`,
          type: ex.type || 'multiple_choice',
          question: String(ex.question).trim(),
          options: opts,
          correctAnswer: correctAns,
          explanation: ex.explanation ? String(ex.explanation).trim() : undefined
        });
      });
    }

    const title = String(parsed.title || parsed.topic || 'مجموعة جديدة').trim();
    const topic = String(parsed.topic || title).trim();
    const level: LernstudioLevel = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(parsed.level) ? parsed.level : 'A1';
    const difficulty: LernstudioDifficulty = ['easy', 'medium', 'hard'].includes(parsed.difficulty) ? parsed.difficulty : 'medium';

    const itemsWithRealArticles = sanitizedItems.filter(
      (it) => it.article && ['der', 'die', 'das'].includes(String(it.article).toLowerCase())
    );
    const hasArticles = parsed.hasArticles !== undefined
      ? Boolean(parsed.hasArticles) && itemsWithRealArticles.length >= 1
      : itemsWithRealArticles.length >= 2;

    const rawTeacherName =
      parsed.createdByTeacherName || parsed.teacherName || parsed.creatorName || parsed.author;
    const cleanedTeacherName =
      typeof rawTeacherName === 'string' && rawTeacherName.trim()
        ? rawTeacherName.trim()
        : undefined;

    const newSet: Partial<LernstudioSet> = {
      title,
      topic,
      grade: parsed.grade ? String(parsed.grade).trim() : undefined,
      level,
      difficulty,
      ...(cleanedTeacherName ? { createdByTeacherName: cleanedTeacherName } : {}),
      hasArticles,
      sentenceBuilderSupported: true,
      description: parsed.description ? String(parsed.description).trim() : `مجموعة ${topic} (${level})`,
      items: sanitizedItems,
      customExercises: sanitizedExercises.length > 0 ? sanitizedExercises : undefined,
      ...(parsed.setKind ? { setKind: parsed.setKind } : {}),
      ...(Array.isArray(parsed.verbIds) ? { verbIds: parsed.verbIds } : {}),
      ...(parsed.basedOnBuiltinGroupId
        ? { basedOnBuiltinGroupId: String(parsed.basedOnBuiltinGroupId).trim() }
        : {})
    };

    return { success: true, data: newSet };
  } catch (err: any) {
    return { success: false, error: `خطأ في تحليل كود JSON: ${err?.message || 'تنسيق غير صالح'}` };
  }
}

// ==========================================
// WORKSHEET SET VALIDATION & AUTO-REPAIR
// ==========================================

export interface WorksheetValidationResult {
  warnings: string[];
  repairedCount: number;
  repairedSet: Partial<LernstudioSet>;
}

export function validateLernstudioSetForWorksheet(
  set: Partial<LernstudioSet>
): WorksheetValidationResult {
  const warnings: string[] = [];
  let repairedCount = 0;

  if (!set || !Array.isArray(set.items) || set.items.length === 0) {
    return {
      warnings: ['المجموعة لا تحتوي على كلمات كافية.'],
      repairedCount: 0,
      repairedSet: set || {}
    };
  }

  const repairedItems = set.items.map((item) => {
    const newItem = { ...item };

    // Check sentence4Elements vs exampleSentenceGerman mismatch
    if (newItem.exampleSentenceGerman && newItem.sentence4Elements) {
      if (!isSentence4ElementsValid(newItem.exampleSentenceGerman, newItem.sentence4Elements)) {
        const rebuilt = rebuildSentence4Elements(newItem.exampleSentenceGerman);
        if (rebuilt) {
          newItem.sentence4Elements = rebuilt;
          repairedCount++;
        }
      }
    }

    // Warnings checks
    const wType = detectWordType(newItem);
    if (wType === 'noun') {
      if (!newItem.article) {
        warnings.push(`الكلمة الاسمية "${newItem.german}" تفتقر إلى الأرتيكل (der / die / das).`);
      }
      if (!newItem.plural) {
        warnings.push(`الكلمة الاسمية "${newItem.german}" تفتقر إلى صيغة الجمع.`);
      }
    } else if (wType === 'verb') {
      if (!newItem.conjugation && !conjugateGermanVerb(newItem.german)) {
        warnings.push(`الفعل "${newItem.german}" يفتقر إلى تصريف الأفعال.`);
      }
    }

    return newItem;
  });

  if (repairedItems.length < 3) {
    warnings.push('تحذير: عدد العناصر الصالحة أقل من 3، قد يتم تخطي بعض التمارين في ورقة العمل.');
  }

  return {
    warnings: Array.from(new Set(warnings)),
    repairedCount,
    repairedSet: {
      ...set,
      items: repairedItems
    }
  };
}
