import { LernstudioSet, LernstudioItem, LernstudioLevel, LernstudioDifficulty, LernstudioExercise } from '../types/lernstudio';

export interface PromptGenConfig {
  topic: string;
  grade?: string;
  level: LernstudioLevel;
  difficulty: LernstudioDifficulty;
  itemCount: number | 'auto';
  includeSentences?: boolean;
  includeExercises?: boolean;
}

export function generateLernstudioPrompt(config: PromptGenConfig): string {
  const isAuto = config.itemCount === 'auto' || !config.itemCount;
  const countInstruction = isAuto
    ? 'Der KI-Assistent wählt automatisch die optimale Anzahl an Begriffen (z.B. 6, 8, 10, 12 oder 15 Wörter) basierend auf der hochgeladenen Lektion oder dem bereitgestellten Bild.'
    : `Erstelle genau ${config.itemCount} Wortschatz-Einträge.`;

  return `Du bist ein pädagogischer Deutschlehrer, Spieledesigner und Ersteller von interaktivem Lehrmaterial für Lernstudio (Glueck Teacher).
Erstelle ein extrem reichhaltiges, vollständiges Lern- und Spiel-Set im JSON-Format, das alle interaktiven Spielmodi (Satzbau/ترتيب الجمل, Glücksrad/Spin Wheel, Team-Rennen/Team Race, Memory-Karten/Memory Flip, Artikel-Sortierboxen/der-die-das Bins, und Jeopardy-Klassenzimmer) optimal antreibt.

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
3. Wenn der Benutzer ein Bild oder Foto einer Buchseite sendet, extrahiere streng nur die Vokabeln aus diesem Bild.

WICHTIGE PRÜFUNG ZUR SPIEL-KOMPATIBILITÄT:
1. "hasArticles" (Boolean):
   - Prüfe streng: Enthält dieses Set deutsche Nomen mit bestimmtem Artikel (der/die/das)?
   - Wenn JA (z.B. Tiere, Gegenstände, Kleidung, Essen): Setze "hasArticles": true.
   - Wenn NEIN (z.B. Verben wie 'laufen/spielen', Adjektive wie 'groß/schnell', Begrüßungen wie 'Hallo/Guten Tag', Zahlen oder Redewendungen): Setze ZWINGEND "hasArticles": false! (Das System schaltet das Spiel der/die/das dann automatisch für dieses Set ab, um grammatikalische Fehler zu vermeiden).
2. "sentenceBuilderSupported" (Boolean):
   - Setze immer "sentenceBuilderSupported": true, und stelle für JEDEN Begriff Beispielsätze zur Verfügung, damit das neue Spiel 'ترتيب الجمل (Satzbau Challenge)' funktioniert.

WICHTIGES LERN- UND SPIELZIEL:
Das Set soll sofort in allen Spielmodi des Systems spielbar sein:
- Spiel 1 (ترتيب الجمل / Satzbau): Wörter in die grammatikalisch korrekte deutsche Reihenfolge bringen (Verb auf Position 2).
- Spiel 2 (Glücksrad): Fragen zu Vokabeln, Grammatik, Übersetzung und schnellen Herausforderungen.
- Spiel 3 (Team-Rennen): Schnelle Quizfragen für Teams auf der Rennstrecke.
- Spiel 4 (Memory Match): Paare aus deutschem Wort und Bedeutung/Emoji.
- Spiel 5 (Artikel-Sortierboxen): der / die / das Sortierung (NUR falls hasArticles = true).
- Spiel 6 (Klassenzimmer Jeopardy): Team-Board für Whiteboard und Beamer.

ANFORDERUNGEN AN JEDEN EINZELNEN BEGRIFF (items):
1. ${countInstruction}
2. Jeder Begriff benötigt zwingend:
   - "german": Der deutsche Begriff inkl. bestimmtem Artikel falls Nomen (z.B. "die Katze", "das Buch", "der Tisch", "spielen", "schnell").
   - "article": Exakt "der", "die" oder "das" falls es ein Nomen ist (oder null/weglassen falls Verb/Adjektiv).
   - "arabic": Die genaue arabische Übersetzung (z.B. "القطة", "الكتاب", "يلعب").
   - "english": Optionale englische Übersetzung (z.B. "the cat").
   - "plural": Der Plural mit Artikel falls Nomen (z.B. "die Katzen", "die Bücher").
   - "exampleSentenceGerman": Ein klarer, grammatikalisch korrekter deutscher Beispielsatz (z.B. "Die Katze schläft auf dem Sofa.").
   - "exampleSentenceArabic": Die arabische Übersetzung des Beispielsatzes.
   - "emoji": Ein passendes Emoji (z.B. "🐱", "📖").
   - "missingLetterWord": Das Wort mit genau einer Lücke "_" für das Buchstabenspiel (z.B. "K_tze" oder "B_ch").
   - "sentence4Elements": Ein Array mit GENAU 4 Elementen/Wortblöcken, die zusammen einen korrekten Satz ergeben (z.B. ["Die Katze", "schläft", "auf dem", "Sofa."]).

3. ZUSÄTZLICHE ÜBUNGSFRAGEN (customExercises):
   Erstelle mindestens 4-6 abwechslungsreiche Übungsfragen passend zu den Begriffen und zur Grammatik des Themas:
   - multiple_choice: 4 Antwortoptionen, eine richtig.
   - sentence_builder: Satz zum Ordnen mit Zielübersetzung.
   - der_die_das: Frage nach dem richtigen Artikel (nur falls Nomen im Set).
   - missing_letter: Wort mit Buchstabe zum Ergänzen.
   - plural_match: Frage nach der Pluralform.

Gib AUSSCHLIESSLICH ein valides, reines JSON-Objekt zurück.

STRENGE REGELN ZUR JSON-SYNTAX (WICHTIG):
1. Gib AUSSCHLIESSLICH ein valides, reines JSON-Objekt zurück ohne Markdown-Formatierung (KEINE Code-Blöcke wie \`\`\`json oder \`\`\`).
2. Escape NIEMALS eckige Klammern [ oder ] mit Backslashes (schreibe IMMER [ und ], NIEMALS \\[ oder \\]).
3. Escape NIEMALS geschweifte Klammern { oder } mit Backslashes (schreibe IMMER { und }, NIEMALS \\{ oder \\}).
4. Verwende ausschließlich standardmäßige gerade doppelte Anführungszeichen (") für Keys und Strings, niemals geschwungene Anführungszeichen.
5. Keine Kommentare (kein // oder /* */) und keine abschließenden Kommas (keine Trailing Commas vor ] oder }).

JSON-STRUKTUR:
{
  "title": "${config.topic}",
  "topic": "${config.topic}",
  "grade": "${config.grade || ''}",
  "level": "${config.level}",
  "difficulty": "${config.difficulty}",
  "hasArticles": true,
  "sentenceBuilderSupported": true,
  "description": "Lern-Set zum Thema ${config.topic} (${config.level})",
  "items": [
    {
      "german": "die Katze",
      "article": "die",
      "arabic": "القطة",
      "english": "the cat",
      "plural": "die Katzen",
      "exampleSentenceGerman": "Die Katze schläft auf dem Sofa.",
      "exampleSentenceArabic": "القطة تنام على الأريكة.",
      "emoji": "🐱",
      "missingLetterWord": "K_tze",
      "sentence4Elements": ["Die Katze", "schläft", "auf dem", "Sofa."]
    }
  ],
  "customExercises": [
    {
      "type": "sentence_builder",
      "question": "رتب الكلمات التالية لتكوين جملة ألمانية صحيحة:",
      "correctAnswer": "Die Katze schläft auf dem Sofa.",
      "explanation": "في اللغة الألمانية يأتي الفعل (schläft) في المركز الثاني."
    },
    {
      "type": "der_die_das",
      "question": "Welcher Artikel passt zu 'Katze'?",
      "options": ["der", "die", "das"],
      "correctAnswer": "die",
      "explanation": "Katze ist feminin: die Katze."
    },
    {
      "type": "multiple_choice",
      "question": "Was bedeutet 'القطة' auf Deutsch?",
      "options": ["die Katze", "der Hund", "das Pferd", "der Vogel"],
      "correctAnswer": "die Katze"
    }
  ]
}`;
}

/**
 * Safely parses JSON string produced by AI models, repairing common formatting flaws
 * like incorrectly escaped brackets (\[ \]), braces (\{ \}), smart quotes, markdown code fences,
 * conversational preambles/postambles, comments, and trailing commas without corrupting valid data.
 */
export function safeParseLernstudioJsonString(rawText: string): any {
  if (!rawText || !rawText.trim()) {
    throw new Error('النص المدخل فارغ. يرجى لصق كود JSON الناتج من الذكاء الاصطناعي.');
  }

  let text = rawText.trim();

  // Strip Markdown code block wrappers if present (e.g. ```json ... ```)
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // 1. Direct parse attempt: Fast path with zero mutations for already valid JSON
  try {
    return JSON.parse(text);
  } catch {
    // Continue to repair pipeline
  }

  // 2. Extract outermost JSON object if conversational text surrounds it
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(text);
    } catch {
      // Continue to repair pipeline
    }
  }

  // 3. Normalize smart/curly quotes to standard straight quotes
  let repaired = text
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  // 4. Fix escaped brackets and braces (e.g. \[ \] \{ \})
  // If an odd number of backslashes immediately precedes a bracket/brace, the trailing slash was an illegal JSON escape.
  repaired = repaired.replace(/(\\+)([\[\]{}])/g, (match, slashes, bracket) => {
    if (slashes.length % 2 === 1) {
      return slashes.slice(0, -1) + bracket;
    }
    return match;
  });

  // 5. Fix invalid escaped single quotes (\' -> ')
  repaired = repaired.replace(/\\'/g, "'");

  // Try parsing after fixing brackets and quotes
  try {
    return JSON.parse(repaired);
  } catch {
    // Continue to strip comments & trailing commas
  }

  // 6. Remove JS/C-style comments (// and /* ... */)
  repaired = repaired.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

  // 7. Remove trailing commas before closing braces or brackets
  repaired = repaired.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(repaired);
  } catch {
    // Continue to clean invalid non-standard escapes
  }

  // 8. Handle any remaining non-standard escape characters inside strings (e.g. \( \) \-)
  repaired = repaired.replace(/(\\+)([^"\\\/bfnrtu])/g, (match, slashes, char) => {
    if (slashes.length % 2 === 1) {
      return slashes.slice(0, -1) + char;
    }
    return match;
  });

  return JSON.parse(repaired);
}

export function validateAndParseLernstudioJson(jsonText: string): { success: boolean; data?: Partial<LernstudioSet>; error?: string } {
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

      // Extract article if present or explicitly supplied
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

      // 4-element sentence structure for Satzbau (Sentence Builder) game
      let sentence4: [string, string, string, string] | undefined = undefined;
      if (Array.isArray(it.sentence4Elements) && it.sentence4Elements.length === 4) {
        sentence4 = [
          String(it.sentence4Elements[0]).trim(),
          String(it.sentence4Elements[1]).trim(),
          String(it.sentence4Elements[2]).trim(),
          String(it.sentence4Elements[3]).trim()
        ];
      } else if (it.exampleSentenceGerman) {
        // Auto-split sentence into 4 elements if not explicitly provided
        const words = String(it.exampleSentenceGerman).split(' ').filter(Boolean);
        if (words.length >= 4) {
          const chunk = Math.ceil(words.length / 4);
          sentence4 = [
            words.slice(0, chunk).join(' '),
            words.slice(chunk, chunk * 2).join(' '),
            words.slice(chunk * 2, chunk * 3).join(' '),
            words.slice(chunk * 3).join(' ')
          ];
        } else if (words.length > 0) {
          sentence4 = [
            words[0] || 'Das',
            words[1] || 'ist',
            words[2] || 'ein',
            words.slice(3).join(' ') || german
          ];
        }
      }

      // Guarantee 4 valid non-empty elements for sentence builder game
      if (!sentence4 || sentence4.some((chunk) => !chunk)) {
        sentence4 = ['Das', 'Wort', 'heißt', german];
      }

      // Generate missing letter word if absent for Glücksrad (Spin Wheel)
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

      sanitizedItems.push({
        id: `item_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        german,
        article,
        arabic,
        english: it.english ? String(it.english).trim() : undefined,
        plural: it.plural ? String(it.plural).trim() : undefined,
        exampleSentenceGerman: it.exampleSentenceGerman ? String(it.exampleSentenceGerman).trim() : undefined,
        exampleSentenceArabic: it.exampleSentenceArabic ? String(it.exampleSentenceArabic).trim() : undefined,
        emoji: it.emoji ? String(it.emoji).trim() : '📚',
        missingLetterWord,
        sentence4Elements: sentence4
      });
    }

    if (sanitizedItems.length === 0) {
      return { success: false, error: 'الكلمات المدخلة تفتقر إلى الألفاظ الألمانية أو الترجمات العربية الصحيحة.' };
    }

    // Process custom exercises for Jeopardy and Race games
    const sanitizedExercises: LernstudioExercise[] = [];
    if (Array.isArray(parsed.customExercises) && parsed.customExercises.length > 0) {
      parsed.customExercises.forEach((ex: any, idx: number) => {
        if (!ex || !ex.question || !ex.correctAnswer) return;
        sanitizedExercises.push({
          id: `ex_${Date.now()}_${idx}`,
          type: ex.type || 'multiple_choice',
          question: String(ex.question).trim(),
          options: Array.isArray(ex.options) ? ex.options.map((opt) => String(opt).trim()) : undefined,
          correctAnswer: String(ex.correctAnswer).trim(),
          explanation: ex.explanation ? String(ex.explanation).trim() : undefined
        });
      });
    }

    const title = String(parsed.title || parsed.topic || 'مجموعة جديدة').trim();
    const topic = String(parsed.topic || title).trim();
    const level: LernstudioLevel = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(parsed.level) ? parsed.level : 'A1';
    const difficulty: LernstudioDifficulty = ['easy', 'medium', 'hard'].includes(parsed.difficulty) ? parsed.difficulty : 'medium';

    // Detect if this set truly contains German nouns with articles
    const itemsWithRealArticles = sanitizedItems.filter(
      (it) => it.article && ['der', 'die', 'das'].includes(String(it.article).toLowerCase())
    );
    const hasArticles = parsed.hasArticles !== undefined
      ? Boolean(parsed.hasArticles) && itemsWithRealArticles.length >= 1
      : itemsWithRealArticles.length >= 2;

    const sentenceBuilderSupported = parsed.sentenceBuilderSupported !== undefined
      ? Boolean(parsed.sentenceBuilderSupported)
      : true;

    const newSet: Partial<LernstudioSet> = {
      title,
      topic,
      grade: parsed.grade ? String(parsed.grade).trim() : undefined,
      level,
      difficulty,
      hasArticles,
      sentenceBuilderSupported,
      description: parsed.description ? String(parsed.description).trim() : `مجموعة ${topic} (${level})`,
      items: sanitizedItems,
      customExercises: sanitizedExercises.length > 0 ? sanitizedExercises : undefined
    };

    return { success: true, data: newSet };
  } catch (err: any) {
    return { success: false, error: `خطأ في تحليل كود JSON: ${err?.message || 'تنسيق غير صالح'}` };
  }
}
