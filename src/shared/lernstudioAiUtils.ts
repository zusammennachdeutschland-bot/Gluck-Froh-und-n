import {
  LernstudioSet,
  LernstudioItem,
  LernstudioLevel,
  LernstudioDifficulty,
  LernstudioExercise,
  LernstudioWordType,
  LernstudioSetKind,
  VerbConjugationForms
} from '../types/lernstudio';
import {
  rebuildSentence4Elements,
  isSentence4ElementsValid,
  conjugateGermanVerb,
  detectWordType
} from './lernstudioWorksheetBuilder';
import {
  getGrammarLessonExercises,
  hasGrammarContent,
  inferSetKind,
  isGrammarSet,
  isValidGrammarExerciseType,
  normalizeGrammarContent,
  normalizeGrammarExercise,
  stripHeavyGrammarMediaForSync
} from './grammarEngine';
import { sanitizeSeriesEdition } from './seriesMeta';

export interface PromptGenConfig {
  topic: string;
  grade?: string;
  level: LernstudioLevel;
  difficulty: LernstudioDifficulty;
  itemCount: number | 'auto';
  teacherName?: string;
  setMode?: 'auto' | 'vocab' | 'verb' | 'grammar' | 'mixed';
  includeSentences?: boolean;
  includeExercises?: boolean;
  includeVerbConjugation?: boolean;
}

export function generateUniversalSmartLernstudioPrompt(teacherName?: string): string {
  const cleanTeacher = (teacherName || '').replace(/"/g, '').trim();
  return `أنت خبير مناهج لغة ألمانية ومصمم محتوى تعليمي تفاعلي لتطبيق (Glück Teacher – Lernstudio).
سأرسل لك الآن صورة (أو عدة صور / نص) من درس في كتاب اللغة الألمانية أو كراسة التدريبات.

مهمتك الذكية (التصرف التلقائي خطوة بخطوة):
1. افحص صورة الدرس المرفقة جيداً واستنتج تلقائياً:
   - عنوان الدرس وموضوعه (title & topic)
   - المستوى الأوروبي المناسب (level: A1 أو A2) ومستوى الصعوبة (difficulty: easy أو medium أو hard)
   - نوع السيت الأنسب لمحتوى الصورة (setKind):
     * "vocab" -> إذا كانت الصفحة تركز على كلمات ومفردات جديدة.
     * "verb_group" -> إذا كانت الصفحة تركز على أفعال وتصريف الأفعال (Konjugation).
     * "grammar" -> إذا كانت الصفحة تشرح قاعدة نحوية أو تدريبات قواعد فقط.
     * "mixed" -> إذا كانت الصفحة تجمع بين كلمات جديدة + شرح وتدريبات قواعد معاً.
   - الصف الدراسي المستهدف (grade: من "جريد 1" إلى "جريد 12").
   - الكتاب والمرحلة إن كانا واضحين من الصورة (series: sonnenschein أو dabei أو beste_freunde أو deutsch_profis أو menschen أو schritte أو ping_pong، و edition: المرحلة داخل الكتاب مثل A1.1 أو A1.2 أو A2.1 أو A2.2 أو grade1 إلى grade6 أو grade10 أو vol1 إلى vol3) — وإن لم يكونا واضحين اتركهما وسيُحفظ السيت في "المنهج العام" (general).

2. قاعدة السؤال الذكي قبل التوليد (مهم جداً):
   - إذا لم أذكر لك (نوع السيت) أو (الصف الدراسي / الجريد) مع الصورة، ولم تكن واضحة بنسبة 100% من الصورة، توقف واسألني أولاً بالعربية في رسالة قصيرة جداً ومباشرة:
     "قبل استخراج الكود، فضلاً حدد لي:
      1️⃣ نوع السيت المطلوب؟ (كلمات Vocab / أفعال Verbs / قواعد Grammar / شامل Mixed)
      2️⃣ دا جريد كام؟ (من جريد 1 إلى جريد 12)"
   - أما إذا كتبتُ لك النوع والجريد مع الصورة (أو بمجرد أن أرد عليك)، ابدأ فوراً بإخراج كود JSON النهائي فقط بدون أي كلام إضافي.

3. قواعد استخراج المحتوى الصارمة (بدون تأليف عشوائي):
   - التزم تماماً بالكلمات والأفعال والقواعد والتمارين الموجودة في صورة الدرس المرفقة.
   - في حالة وجود كلمات أو أفعال ("vocab" أو "verb_group" أو "mixed")، املأ مصفوفة "items" بحيث يحتوي كل عنصر على:
     * "german": الكلمة بالألمانية مع الأرتيكل للأسماء (مثل "der Hund", "die Schule", "das Buch", "spielen").
     * "article": فقط للأسماء ("der" أو "die" أو "das") وبدون أرتيكل للأفعال والصفات.
     * "arabic": الترجمة العربية الدقيقة.
     * "syllables": تقسيم الكلمة (بدون الأرتيكل) إلى مقطعين صوتيين أو أكثر (مثل ["Schu", "le"] أو ["fah", "ren"]).
     * "plural": صيغة الجمع مع الأرتيكل للأسماء (مثل "die Bücher").
     * "wordType": نوع الكلمة ("noun" | "verb" | "adjective" | "phrase" | "other").
     * "conjugation": للأفعال فقط في المضارع Präsens بالحقول {"ich","du","er_sie_es","wir","ihr","sie_Sie"} مع مراعاة تغير الحروف المتحركة.
     * "exampleSentenceGerman": جملة مثال ألمانية صحيحة من 4 أجزاء.
     * "exampleSentenceArabic": ترجمة الجملة للعربية.
     * "sentence4Elements": نفس جملة "exampleSentenceGerman" مقسمة بالضبط إلى 4 عناصر في مصفوفة (مجموعها بمسافات يطابق الجملة تماماً).
     * "missingLetterWord": الكلمة بدون أرتيكل مع إخفاء حرف واحد بعلامة "_" (مثل "B_ch").
     * "emoji": إيموجي معبر.
   - في حالة وجود قواعد ("grammar" أو "mixed")، املأ كائن "grammarContent" كاملاً (ويمكن ترك "items": [] إذا كان السيت قواعد فقط "grammar"):
     * "lessonTitle", "lessonTitleAr", "grammarTopic", "explanationAr" (شرح عربي واضح ومبسط للقاعدة), "explanationDe"
     * "rules": مصفوفة قواعد منظمة (كل قاعدة بها "id", "title", "titleAr", "summaryAr", "pattern", واختيارياً جدول "table": {"headers":[...],"rows":[[...]]} و "tipAr").
     * "examples": من 4 إلى 6 أمثلة ("id", "german", "arabic", "highlight").
     * "exercises": جميع تمارين الصفحة الأصلية (مع وضع "source": "original") + تمارين إضافية مشابهة للتدريب (مع وضع "source": "generated") باستخدام الأنواع التالية:
       - "multiple_choice" (مع 4 خيارات في "options" و "correctAnswer")
       - "fill_blank" (أكمل الفراغ مع "options" و "correctAnswer")
       - "correct_mistake" (صحح الخطأ مع "faultySentence" و "options" و "correctAnswer")
       - "choose_correct_sentence" (اختر الجملة الصحيحة من "options")
       - "sentence_ordering" (ترتيب جملة مع مصفوفة الكلمات المبعثرة في "tokens" والجملة الكاملة في "correctAnswer")
       - "short_answer" (إجابة كتابية مع "correctAnswer" وبدائل مقبولة في "acceptedAnswers")
   - أضف أيضاً من 3 إلى 6 تمارين اختيار من متعدد في "customExercises" (مع تنويع الفاعل في جمل الأفعال مثل الأسماء المفردة "Ahmed"، والمركبة "Mona und Sara"، و"du und ich").

4. قواعد تنسيق JSON الصارمة:
   - عند توليد النتيجة، أخرج كود JSON خام وصالح 100% فقط (بدون علامات \`\`\`json وبدون أي نص قبل أو بعد الكود).
   - لا تستخدم أبداً فواصل زائدة (Trailing Commas) ولا تهرب الأقواس (لا تكتب \\[ أو \\{).

نموذج هيكل الـ JSON المطلوب إخراجه:
{
  "title": "عنوان الدرس المستخرج",
  "topic": "موضوع الدرس",
  "grade": "جريد 4",
  "level": "A1",
  "series": "dabei",
  "edition": "A1.2",
  "difficulty": "medium",
  "setKind": "vocab | verb_group | grammar | mixed",
  "contentOrigin": "teacher_created",
  "createdByTeacherName": "${cleanTeacher}",
  "hasArticles": true,
  "sentenceBuilderSupported": true,
  "description": "وصف مختصر للدرس",
  "items": [
    {
      "german": "das Buch",
      "article": "das",
      "arabic": "الكتاب",
      "syllables": ["Bu", "ch"],
      "plural": "die Bücher",
      "wordType": "noun",
      "exampleSentenceGerman": "Mona liest ein Buch.",
      "exampleSentenceArabic": "منى تقرأ كتاباً.",
      "emoji": "📖",
      "missingLetterWord": "B_ch",
      "sentence4Elements": ["Mona", "liest", "ein", "Buch."]
    },
    {
      "german": "lesen",
      "arabic": "يقرأ",
      "syllables": ["le", "sen"],
      "wordType": "verb",
      "conjugation": {
        "ich": "lese",
        "du": "liest",
        "er_sie_es": "liest",
        "wir": "lesen",
        "ihr": "lest",
        "sie_Sie": "lesen"
      },
      "exampleSentenceGerman": "Ahmed liest heute viel.",
      "exampleSentenceArabic": "أحمد يقرأ كثيراً اليوم.",
      "emoji": "📚",
      "missingLetterWord": "l_sen",
      "sentence4Elements": ["Ahmed", "liest", "heute", "viel."]
    }
  ],
  "grammarContent": {
    "lessonTitle": "عنوان القاعدة (إن وجد)",
    "lessonTitleAr": "عنوان القاعدة بالعربية",
    "grammarTopic": "اسم القاعدة",
    "origin": "teacher_created",
    "explanationAr": "شرح مبسط وواضح للقاعدة باللغة العربية.",
    "explanationDe": "Kurze deutsche Erklärung.",
    "rules": [
      {
        "id": "rule_1",
        "title": "Grundregel",
        "titleAr": "القاعدة الأساسية",
        "summaryAr": "ملخص القاعدة بالعربية.",
        "pattern": "Subjekt + Verb + ...",
        "table": {
          "headers": ["Pronomen", "Verb"],
          "rows": [["ich", "lese"], ["du", "liest"]]
        }
      }
    ],
    "examples": [
      {
        "id": "ex_1",
        "german": "Mona liest ein Buch.",
        "arabic": "منى تقرأ كتاباً.",
        "highlight": "liest"
      }
    ],
    "exercises": [
      {
        "id": "q_1",
        "type": "multiple_choice",
        "prompt": "اختر الإجابة الصحيحة:",
        "question": "Mona ______ heute ein Buch.",
        "options": ["liest", "lese", "lest", "lesen"],
        "correctAnswer": "liest",
        "explanationAr": "Mona = sie -> liest",
        "source": "original"
      },
      {
        "id": "q_2",
        "type": "sentence_ordering",
        "prompt": "رتب الكلمات لتكوين جملة صحيحة:",
        "question": "أحمد يقرأ كثيراً اليوم.",
        "tokens": ["heute", "Ahmed", "viel.", "liest"],
        "correctAnswer": "Ahmed liest heute viel.",
        "explanationAr": "الفعل في المركز الثاني.",
        "source": "generated"
      }
    ]
  },
  "customExercises": [
    {
      "type": "multiple_choice",
      "question": "Du und ich ______ (lesen) zusammen.",
      "options": ["lesen", "liest", "lese", "lest"],
      "correctAnswer": "lesen",
      "explanation": "Du und ich = wir -> lesen."
    }
  ]
}`;
}

export function generateLernstudioPrompt(config: PromptGenConfig): string {
  if (config.setMode === 'auto') {
    return generateUniversalSmartLernstudioPrompt(config.teacherName);
  }
  const effectiveMode: 'vocab' | 'verb' | 'grammar' | 'mixed' =
    config.setMode || (config.includeVerbConjugation ? 'verb' : 'vocab');

  const isAuto = config.itemCount === 'auto' || !config.itemCount;
  const countInstruction = isAuto
    ? 'Der KI-Assistent wählt automatisch die optimale Anzahl an Begriffen (z.B. 6, 8, 10, 12 oder 15 Wörter) basierend auf der hochgeladenen Lektion oder dem bereitgestellten Bild.'
    : `Erstelle genau ${config.itemCount} Wortschatz-Einträge.`;

  if (effectiveMode === 'grammar' || effectiveMode === 'mixed') {
    const isMixed = effectiveMode === 'mixed';
    return `Du bist ein pädagogischer Deutschlehrer und Lehrplanentwickler für Lernstudio (Glück Teacher).
Erstelle ein vollständiges, didaktisch strukturiertes ${
      isMixed ? 'Gemischtes Lern-Set (Wortschatz + Grammatik)' : 'Grammatik-Lern-Set (setKind: "grammar")'
    } im reinen JSON-Format.

Thema / Grammatikthema: ${config.topic}
Ziel-Klasse / الصف الدراسي: ${config.grade || 'جريد 3 - 6 / A1-A2'}
Niveau / المستوى: ${config.level}
Schwierigkeit: ${config.difficulty}

STRENGSTE REGELN:
1. Wenn der Benutzer Bilder oder Text einer Lehrbuchseite bereitstellt, extrahiere ALLE sichtbaren Erklärungen, Regeln, Beispiele und Original-Übungen exakt und markiere Original-Übungen mit "source": "original".
2. Zusätzliche selbst erstellte Übungen müssen klar mit "source": "generated" markiert werden.
3. Falls ein Ausschnitt im Bild unklar/unsicher ist, setze "isUncertain": true und erkläre den Grund in "uncertaintyReason".
4. Erstelle im Objekt "grammarContent":
   - "lessonTitle" (Deutsch), "lessonTitleAr" (Arabisch), "lessonTitleEn" (Englisch)
   - "grammarTopic", "explanationAr" (klare, schülergerechte arabische Erklärung), "explanationDe", "explanationEn"
   - "rules": 1-4 strukturierte Regel-Karten (mit "titleAr", "summaryAr", optional "pattern", optional "table": {"headers":[...],"rows":[[...]]}, optional "tipAr")
   - "examples": 4-6 zweisprachige Beispielsätze ("german", "arabic", "english", optional "highlight", "noteAr")
   - "exercises": 6-10 abwechslungsreiche Grammatikübungen mit den Typen:
     * "multiple_choice" (mit "options": [4 Optionen], "correctAnswer")
     * "fill_blank" (mit "sentenceWithBlank", optional "options", "correctAnswer")
     * "correct_mistake" (mit "faultySentence", optional "options", "correctAnswer")
     * "choose_correct_sentence" (mit "options": [3-4 Sätze], "correctAnswer")
     * "sentence_ordering" (mit "tokens": [einzelne Wörter/Blöcke], "correctAnswer": kompletter Satz)
     * "short_answer" (mit "correctAnswer", optional "acceptedAnswers": [...], OHNE Pflicht zu options)
   - "origin": "teacher_created"
${
  isMixed
    ? `5. Erstelle ZUSÄTZLICH mindestens 6-10 passende Wortschatz-Einträge in "items" (inkl. "german", "arabic", "article", "syllables", "exampleSentenceGerman", "exampleSentenceArabic", "sentence4Elements").`
    : `5. "items" darf ein leeres Array [] bleiben, da es ein reines Grammatik-Set ("setKind": "grammar") ist (oder optional 2-4 Schlüsselwörter enthalten).`
}

STRENGE JSON-REGELN:
- Gib AUSSCHLIESSLICH reines, valides JSON ohne \`\`\`json Code-Blöcke zurück.
- Keine Kommentare, keine Trailing Commas, keine maskierten Klammern (\\[ oder \\{).

JSON-VORLAGE:
{
  "title": "${config.topic}",
  "topic": "${config.topic}",
  "grade": "${config.grade || 'جريد 4 (Grade 4)'}",
  "level": "${config.level}",
  "difficulty": "${config.difficulty}",
  "setKind": "${isMixed ? 'mixed' : 'grammar'}",
  "contentOrigin": "teacher_created",
  "createdByTeacherName": "${(config.teacherName || '').replace(/"/g, '')}",
  "sentenceBuilderSupported": true,
  "description": "Grammatik-Set: ${config.topic} (${config.level})",
  "items": [],
  "grammarContent": {
    "lessonTitle": "${config.topic}",
    "lessonTitleAr": "${config.topic}",
    "grammarTopic": "${config.topic}",
    "origin": "teacher_created",
    "explanationAr": "شرح القاعدة باللغة العربية بأسلوب مبسط مع الأمثلة.",
    "explanationDe": "Kurze deutsche Zusammenfassung der Regel.",
    "explanationEn": "Clear English summary of the grammar rule.",
    "rules": [
      {
        "id": "rule_1",
        "title": "Grundregel",
        "titleAr": "القاعدة الأساسية",
        "summaryAr": "تفصيل القاعدة وكيفية التطبيق.",
        "pattern": "Subjekt + Verb (Pos. 2) + ...",
        "table": {
          "headers": ["Pronomen", "Endung", "Beispiel"],
          "rows": [["ich", "-e", "lerne"], ["du", "-st", "lernst"]]
        },
        "tipAr": "ملاحظة هامة للطلاب."
      }
    ],
    "examples": [
      {
        "id": "ex_1",
        "german": "Ich lerne heute Deutsch.",
        "arabic": "أنا أتعلم الألمانية اليوم.",
        "english": "I am learning German today.",
        "highlight": "lerne"
      }
    ],
    "exercises": [
      {
        "id": "q_1",
        "type": "multiple_choice",
        "prompt": "اختر الإجابة الصحيحة:",
        "question": "Mona ______ heute ein Buch.",
        "options": ["liest", "lese", "lest", "lesen"],
        "correctAnswer": "liest",
        "explanationAr": "Mona تعادل sie (هي)، والفعل lesen يتغير فيه e إلى ie.",
        "source": "original",
        "isUncertain": false
      },
      {
        "id": "q_2",
        "type": "sentence_ordering",
        "prompt": "رتب الكلمات لتكوين جملة صحيحة:",
        "question": "نحن نلعب كرة القدم غداً.",
        "tokens": ["spielen", "Wir", "morgen", "Fußball."],
        "correctAnswer": "Wir spielen morgen Fußball.",
        "explanationAr": "الفعل في المركز الثاني.",
        "source": "generated"
      }
    ]
  }
}`;
  }

  const verbInstructionBlock =
    effectiveMode === 'verb' || config.includeVerbConjugation
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
  "setKind": "${effectiveMode === 'verb' ? 'verb_group' : 'vocab'}",
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

    const itemsRaw = parsed.items || parsed.words || parsed.vocabulary || [];
    const hasGrammarBlock = Boolean(
      parsed.grammarContent &&
        typeof parsed.grammarContent === 'object' &&
        (
          (Array.isArray(parsed.grammarContent.rules) && parsed.grammarContent.rules.length > 0) ||
          (Array.isArray(parsed.grammarContent.examples) && parsed.grammarContent.examples.length > 0) ||
          (Array.isArray(parsed.grammarContent.exercises) && parsed.grammarContent.exercises.length > 0) ||
          Boolean(parsed.grammarContent.explanationAr || parsed.grammarContent.explanationDe)
        )
    );
    const hasCustomExBlock = Array.isArray(parsed.customExercises) && parsed.customExercises.length > 0;

    if ((!Array.isArray(itemsRaw) || itemsRaw.length === 0) && !hasGrammarBlock && !hasCustomExBlock) {
      return {
        success: false,
        error: 'لم يتم العثور على مفردات (items) أو محتوى قواعد (grammarContent) أو تمارين صالحة داخل كود JSON.'
      };
    }

    const sanitizedItems: LernstudioItem[] = [];
    if (Array.isArray(itemsRaw)) {
      for (let i = 0; i < itemsRaw.length; i++) {
        const it = itemsRaw[i];
        if (!it || typeof it !== 'object') continue;

        const german = String(it.german || it.word || it.term || '').trim();
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

        // Conjugation validation
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
          emoji: it.emoji ? String(it.emoji).trim() : wordType === 'verb' ? '🔤' : '📚',
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
    }

    const sanitizedExercises: LernstudioExercise[] = [];
    if (Array.isArray(parsed.customExercises) && parsed.customExercises.length > 0) {
      parsed.customExercises.forEach((ex: any, idx: number) => {
        if (!ex || (!ex.question && !ex.sentenceWithBlank && !ex.faultySentence) || !ex.correctAnswer) return;
        const correctAns = String(ex.correctAnswer).trim();
        const exType = ex.type || 'multiple_choice';
        const requiresMcOptions = exType === 'multiple_choice' || exType === 'choose_correct_sentence';
        let opts: string[] | undefined = Array.isArray(ex.options)
          ? ex.options.map((opt: any) => String(opt).trim()).filter(Boolean)
          : undefined;

        if (opts && opts.length > 0 && requiresMcOptions && !opts.includes(correctAns)) {
          opts.unshift(correctAns);
        }
        if (exType === 'short_answer' && opts && opts.length === 0) {
          opts = undefined;
        }

        const grammarNorm = isValidGrammarExerciseType(exType)
          ? normalizeGrammarExercise(ex, idx, ex.source === 'generated' ? 'generated' : 'original')
          : null;

        if (grammarNorm) {
          sanitizedExercises.push(grammarNorm);
        } else {
          sanitizedExercises.push({
            id: ex.id ? String(ex.id).trim() : `ex_${Date.now()}_${idx}`,
            type: exType,
            ...(ex.prompt ? { prompt: String(ex.prompt).trim() } : {}),
            question: String(ex.question || ex.sentenceWithBlank || '').trim(),
            ...(opts && opts.length > 0 ? { options: opts } : {}),
            correctAnswer: correctAns,
            ...(ex.explanation ? { explanation: String(ex.explanation).trim() } : {}),
            ...(ex.source === 'generated' || ex.source === 'original' ? { source: ex.source } : {}),
            ...(ex.isUncertain ? { isUncertain: true } : {}),
            ...(ex.uncertaintyReason ? { uncertaintyReason: String(ex.uncertaintyReason).trim() } : {})
          });
        }
      });
    }

    const title = String(parsed.title || parsed.grammarContent?.lessonTitle || parsed.topic || 'مجموعة جديدة').trim();
    const topic = String(parsed.topic || parsed.grammarContent?.grammarTopic || title).trim();
    const level: LernstudioLevel = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(parsed.level) ? parsed.level : 'A1';
    const difficulty: LernstudioDifficulty = ['easy', 'medium', 'hard'].includes(parsed.difficulty)
      ? parsed.difficulty
      : 'medium';
    const { series, edition } = sanitizeSeriesEdition(parsed.series, parsed.edition);

    const grammarContent = parsed.grammarContent
      ? normalizeGrammarContent(parsed.grammarContent, title, topic, 'teacher_created')
      : undefined;

    if (
      sanitizedItems.length === 0 &&
      (!grammarContent ||
        (grammarContent.rules.length === 0 &&
          grammarContent.examples.length === 0 &&
          grammarContent.exercises.length === 0 &&
          !grammarContent.explanationAr)) &&
      sanitizedExercises.length === 0
    ) {
      return {
        success: false,
        error: 'الكلمات أو تمارين القواعد المدخلة غير مكتملة أو تفتقر للإجابات الصحيحة.'
      };
    }

    const itemsWithRealArticles = sanitizedItems.filter(
      (it) => it.article && ['der', 'die', 'das'].includes(String(it.article).toLowerCase())
    );
    const hasArticles =
      parsed.hasArticles !== undefined
        ? Boolean(parsed.hasArticles) && itemsWithRealArticles.length >= 1
        : itemsWithRealArticles.length >= 2;

    const rawTeacherName =
      parsed.createdByTeacherName || parsed.teacherName || parsed.creatorName || parsed.author;
    const cleanedTeacherName =
      typeof rawTeacherName === 'string' && rawTeacherName.trim() ? rawTeacherName.trim() : undefined;

    const validSetKinds: LernstudioSetKind[] = ['vocab', 'verb_group', 'grammar', 'mixed'];
    const rawKind = validSetKinds.includes(parsed.setKind) ? (parsed.setKind as LernstudioSetKind) : undefined;
    const resolvedSetKind: LernstudioSetKind =
      rawKind ||
      inferSetKind({
        items: sanitizedItems,
        grammarContent,
        customExercises: sanitizedExercises
      });

    const newSet: Partial<LernstudioSet> = stripHeavyGrammarMediaForSync({
      title,
      topic,
      grade: parsed.grade ? String(parsed.grade).trim() : undefined,
      level,
      difficulty,
      series,
      ...(edition ? { edition } : {}),
      ...(parsed.titleTranslations ? { titleTranslations: parsed.titleTranslations } : {}),
      ...(parsed.topicTranslations ? { topicTranslations: parsed.topicTranslations } : {}),
      ...(cleanedTeacherName ? { createdByTeacherName: cleanedTeacherName } : {}),
      hasArticles,
      sentenceBuilderSupported: true,
      description: parsed.description
        ? String(parsed.description).trim()
        : `مجموعة ${topic} (${level})`,
      items: sanitizedItems,
      ...(sanitizedExercises.length > 0 ? { customExercises: sanitizedExercises } : {}),
      ...(grammarContent ? { grammarContent } : {}),
      contentOrigin: parsed.contentOrigin === 'builtin' ? 'builtin' : 'teacher_created',
      setKind: resolvedSetKind,
      ...(Array.isArray(parsed.verbIds) ? { verbIds: parsed.verbIds } : {}),
      ...(parsed.basedOnBuiltinGroupId
        ? { basedOnBuiltinGroupId: String(parsed.basedOnBuiltinGroupId).trim() }
        : {})
    });

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

export function validateLernstudioSetForWorksheet(set: Partial<LernstudioSet>): WorksheetValidationResult {
  const warnings: string[] = [];
  let repairedCount = 0;

  const isGrammar = isGrammarSet(set) || hasGrammarContent(set);
  const grammarExCount = getGrammarLessonExercises(set).length;

  if (!set || ((!Array.isArray(set.items) || set.items.length === 0) && (!isGrammar || grammarExCount === 0))) {
    return {
      warnings: ['المجموعة لا تحتوي على كلمات أو تمارين قواعد كافية.'],
      repairedCount: 0,
      repairedSet: set || {}
    };
  }

  const repairedItems = (set.items || []).map((item) => {
    const newItem = { ...item };

    if (newItem.exampleSentenceGerman && newItem.sentence4Elements) {
      if (!isSentence4ElementsValid(newItem.exampleSentenceGerman, newItem.sentence4Elements)) {
        const rebuilt = rebuildSentence4Elements(newItem.exampleSentenceGerman);
        if (rebuilt) {
          newItem.sentence4Elements = rebuilt;
          repairedCount++;
        }
      }
    }

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

  if (!isGrammar && repairedItems.length < 3) {
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
