import { LernstudioSet, LernstudioItem, LernstudioLevel, LernstudioDifficulty } from '../types/lernstudio';

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
    ? 'Der KI-Assistent wählt automatisch die optimale Anzahl an Begriffen (z.B. 5, 10, 15 oder 20 Wörter) basierend auf der hochgeladenen Lektion oder dem bereitgestellten Bild.'
    : `Erstelle genau ${config.itemCount} Wortschatz-Einträge.`;

  return `Du bist ein erfahrener Deutschlehrer und Ersteller von Unterrichtsmaterialien.
Erstelle ein vollständiges Lern-Set im JSON-Format für Deutschschüler.

Thema: ${config.topic}
Ziel-Klasse/الصف الدراسي: ${config.grade || 'جميع الصفوف'}
Niveau/المستوى: ${config.level}
Schwierigkeit: ${config.difficulty}
Anzahl der Begriffe: ${isAuto ? 'Automatisch durch KI gewählt (5, 10, 15 oder 20 je nach Bild/Text)' : config.itemCount}

STRENGSTE REGEL - KEINE ZUFÄLLIGEN INHALTE:
1. Verwende AUSSCHLIESSLICH die Begriffe und Texte aus dem vom Benutzer bereitgestellten BILD (oder dem gesendeten Lektionstext)!
2. Füge KEINE zufälligen, erfundenen oder externen Wörter hinzu, die nicht im gesendeten Bild/Material vorkommen!
3. Wenn der Benutzer ein Bild oder Foto einer Buchseite sendet, extrahiere streng nur die Vokabeln aus diesem Bild (keine halluzinierten Wörter).

WICHTIGES LERNZIEL:
Das Hauptziel aller Übungen und Spiele ist, dass der Schüler das DEUTSCHE WORT oder den DEUTSCHEN SATZ aktiv lernt und bildet.

ANFORDERUNGEN:
1. ${countInstruction}
2. Jeder Begriff benötigt:
   - "german": Der deutsche Begriff inkl. Artikel (z.B. "die Katze", "das Buch", "spielen").
   - "arabic": Die genaue arabische Übersetzung (z.B. "القطة", "الكتاب", "يلعب").
   - "english": Eine optionale englische Übersetzung (z.B. "the cat").
   - "plural": Der Plural falls Nomen (z.B. "die Katzen").
   - "exampleSentenceGerman": Ein kurzer, klarer Beispielsatz auf Deutsch (z.B. "Die Katze schläft.").
   - "exampleSentenceArabic": Die arabische Übersetzung des Beispielsatzes.
   - "emoji": Ein passendes Emoji (z.B. "🐱").
   - "missingLetterWord": Das deutsche Wort mit genau 1-2 Unterstrichen als Lücke (z.B. "K_tze").
   - "sentence4Elements": Ein Array mit GENAU 4 Strings, die zusammen einen korrekten deutschen Satz ergeben (z.B. ["Die Katze", "schläft", "auf dem", "Sofa."]).

3. Gib AUSSCHLIESSLICH ein valides JSON-Objekt zurück ohne Markdown-Formatierung wie \`\`\`json.

JSON-STRUKTUR:
{
  "title": "${config.topic}",
  "topic": "${config.topic}",
  "grade": "${config.grade || ''}",
  "level": "${config.level}",
  "difficulty": "${config.difficulty}",
  "description": "Lern-Set zum Thema ${config.topic} (${config.level})",
  "items": [
    {
      "german": "die Katze",
      "arabic": "القطة",
      "english": "the cat",
      "plural": "die Katzen",
      "exampleSentenceGerman": "Die Katze schläft auf dem Sofa.",
      "exampleSentenceArabic": "القطة تنام على الأريكة.",
      "emoji": "🐱",
      "missingLetterWord": "K_tze",
      "sentence4Elements": ["Die Katze", "schläft", "auf dem", "Sofa."]
    }
  ]
}`;
}

export function validateAndParseLernstudioJson(jsonText: string): { success: boolean; data?: Partial<LernstudioSet>; error?: string } {
  if (!jsonText || !jsonText.trim()) {
    return { success: false, error: 'النص المدخل فارغ. يرجى لصق كود JSON الناتج من الذكاء الاصطناعي.' };
  }

  let cleaned = jsonText.trim();
  // Strip markdown code blocks if AI wrapped it in ```json ... ```
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);

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

      const german = String(it.german || it.word || it.term || '').trim();
      const arabic = String(it.arabic || it.meaning || it.translation || '').trim();

      if (!german || !arabic) continue;

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

      // Generate missing letter word if absent
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

    const title = String(parsed.title || parsed.topic || 'مجموعة جديدة').trim();
    const topic = String(parsed.topic || title).trim();
    const level: LernstudioLevel = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(parsed.level) ? parsed.level : 'A1';
    const difficulty: LernstudioDifficulty = ['easy', 'medium', 'hard'].includes(parsed.difficulty) ? parsed.difficulty : 'medium';

    const newSet: Partial<LernstudioSet> = {
      title,
      topic,
      grade: parsed.grade ? String(parsed.grade).trim() : undefined,
      level,
      difficulty,
      description: parsed.description ? String(parsed.description).trim() : `مجموعة ${topic} (${level})`,
      items: sanitizedItems
    };

    return { success: true, data: newSet };
  } catch (err: any) {
    return { success: false, error: `خطأ في تحليل كود JSON: ${err?.message || 'تنسيق غير صالح'}` };
  }
}
