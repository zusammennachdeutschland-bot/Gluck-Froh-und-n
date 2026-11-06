import { LernstudioLibraryArticle } from '../types/lernstudio';

export const LERNSTUDIO_LIBRARY_ARTICLES: LernstudioLibraryArticle[] = [
  {
    id: 'lib_alphabet_1',
    title: 'Das deutsche Alphabet & Aussprache',
    titleArabic: 'الأبجدية الألمانية وقواعد النطق الأساسية 🔤',
    category: 'alphabet',
    level: 'A1',
    summary: 'Lerne die 26 Buchstaben sowie die Sonderzeichen Ä, Ö, Ü und ß richtig auszusprechen.',
    summaryArabic: 'تعلم حروف اللغة الألمانية الـ 26 بالإضافة إلى الحروف الخاصة (Ä, Ö, Ü, ß) مع أمثلة صوتية وتطبيقات.',
    contentHtml: `
      <h3>1. Das Alphabet (الأبجدية)</h3>
      <p>تتكون الأبجدية الألمانية من 26 حرفاً أساسياً بالإضافة إلى 4 حروف خاصة:</p>
      <ul>
        <li><strong>Ä / ä</strong>: تنطق مثل الصوت "ae" (مثل: <em>die Äpfel</em> - التفاح).</li>
        <li><strong>Ö / ö</strong>: تنطق بضم الشفتين وإخراج صوت "oe" (مثل: <em>die Öl</em> - الزيت).</li>
        <li><strong>Ü / ü</strong>: تنطق بضم الشفتين الحاد (مثل: <em>über</em> - فوق).</li>
        <li><strong>ß (Eszett)</strong>: تنطق سين مشددة "ss" (مثل: <em>groß</em> - كبير).</li>
      </ul>
      <h3>2. Wichtige Lautkombinationen (تركيبات الأصوات المهمة)</h3>
      <ul>
        <li><strong>ei</strong>: ينطق "آي" (مثل: <em>mein</em> - ملكي).</li>
        <li><strong>ie</strong>: ينطق "إي" ممدودة (مثل: <em>SIe</em> - حضرتكم/هم).</li>
        <li><strong>eu / äu</strong>: ينطق "أوي" (مثل: <em>Deutschland</em> / <em>Häuser</em>).</li>
        <li><strong>sch</strong>: ينطق شين مشددة "ش" (مثل: <em>Schule</em> - مدرسة).</li>
        <li><strong>ch</strong>: ينطق خاء بعد (a, o, u) مثل <em>Nacht</em>، وينطق شين خفيفة بعد (e, i) مثل <em>ich</em>.</li>
      </ul>
    `,
    examples: [
      { german: 'Guten Tag!', arabic: 'يوم سعيد / نهارك سعيد' },
      { german: 'Wie heißen Sie?', arabic: 'ما اسم حضرتكم؟' },
      { german: 'Ich lerne Deutsch.', arabic: 'أنا أتعلم اللغة الألمانية.' }
    ]
  },
  {
    id: 'lib_grammar_articles',
    title: 'Bestimmte und Unbestimmte Artikel (der, die, das)',
    titleArabic: 'أدوات التعريف والتنكير في اللغة الألمانية 📌',
    category: 'grammar',
    level: 'A1',
    summary: 'Verstehe den Unterschied zwischen maskulin (der), feminin (die), neutral (das) und Plural (die).',
    summaryArabic: 'شرح مبسط لأدوات التعريف للمذكر والمؤنث والمحيط والجمع، وكيفية التمييز بينها بسهولة.',
    contentHtml: `
      <h3>1. Bestimmte Artikel (أدوات التعريف)</h3>
      <p>لكل اسم في اللغة الألمانية جنس محدد، ويجب حفظ الاسم مع أداته:</p>
      <ul>
        <li><strong>der</strong>: للمذكر (Maskulin) - مثل: <em>der Lehrer</em> (المعلم).</li>
        <li><strong>die</strong>: للمؤنث (Feminin) - مثل: <em>die Schule</em> (المدرسة).</li>
        <li><strong>das</strong>: للمحيط (Neutral) - مثل: <em>das Buch</em> (الكتاب).</li>
        <li><strong>die (Plural)</strong>: للجمع بنوعيه - مثل: <em>die Bücher</em> (الكتب).</li>
      </ul>
      <h3>2. Unbestimmte Artikel (أدوات التنكير)</h3>
      <ul>
        <li><strong>ein</strong>: للمذكر والمحيط (مثل: <em>ein Stift</em> - قلم ما / <em>ein Buch</em> - كتاب ما).</li>
        <li><strong>eine</strong>: للمؤنث (مثل: <em>eine Tasche</em> - حقيبة ما).</li>
      </ul>
    `,
    examples: [
      { german: 'Das ist ein Buch. Das Buch ist neu.', arabic: 'هذا كتاب. الكتاب جديد.' },
      { german: 'Das ist eine Tasche. Die Tasche ist schön.', arabic: 'هذه حقيبة. الحقيبة جميلة.' }
    ]
  },
  {
    id: 'lib_vocab_school',
    title: 'Wortschatz: In der Schule und im Klassenzimmer',
    titleArabic: 'مفردات المدرسة والحجرة الدراسية 🏫',
    category: 'vocabulary',
    level: 'A1',
    summary: 'Wichtige Wörter für Gegenstände in der Schule, Schulfächer und Aktivitäten.',
    summaryArabic: 'أهم الكلمات الخاصة بأدوات المدرسة، الفصول، المواد الدراسية، والأنشطة اليومية للطالب.',
    contentHtml: `
      <h3>1. Schulsachen (الأدوات المدرسية)</h3>
      <ul>
        <li><strong>der Bleistift</strong>: قلم الرصاص</li>
        <li><strong>der Kugelschreiber (Kuli)</strong>: قلم الجاف</li>
        <li><strong>das Heft</strong>: الكشكول / الدفتر</li>
        <li><strong>die Schultasche</strong>: الحقيبة المدرسية</li>
        <li><strong>das Lineal</strong>: المسطرة</li>
        <li><strong>der Radiergummi</strong>: الممحاة</li>
      </ul>
      <h3>2. Im Klassenzimmer (في الفصل)</h3>
      <ul>
        <li><strong>die Tafel</strong>: السبورة</li>
        <li><strong>der Tisch</strong>: الطاولة / المكتب</li>
        <li><strong>der Stuhl</strong>: الكرسي</li>
        <li><strong>der Lehrer / die Lehrerin</strong>: المعلم / المعلمة</li>
      </ul>
    `,
    examples: [
      { german: 'Ich brauche einen Bleistift.', arabic: 'أحتاج إلى قلم رصاص.' },
      { german: 'Der Lehrer schreibt an die Tafel.', arabic: 'المعلم يكتب على السبورة.' }
    ]
  },
  {
    id: 'lib_conversations_daily',
    title: 'Alltagsgespräche: Sich vorstellen & Begrüßung',
    titleArabic: 'محادثات يومية: التعارف والتحية باللغة الألمانية 🗣️',
    category: 'conversations',
    level: 'A1',
    summary: 'Typische Dialoge beim ersten Kennenlernen, Höflichkeitsformen und Nachfragen.',
    summaryArabic: 'حوارات نموذجية للتعريف بالنفس، السؤال عن الحال، والتحيات الرسمية والودية.',
    contentHtml: `
      <h3>1. Begrüßung & Verabschiedung (التحية ووداع)</h3>
      <ul>
        <li><strong>Hallo!</strong> / <strong>Guten Tag!</strong> - مرحباً / نهارك سعيد</li>
        <li><strong>Guten Morgen!</strong> - صباح الخير</li>
        <li><strong>Guten Abend!</strong> - مساء الخير</li>
        <li><strong>Auf Wiedersehen!</strong> / <strong>Tschüss!</strong> - إلى اللقاء / باي</li>
      </ul>
      <h3>2. Sich vorstellen (التعريف بالنفس)</h3>
      <p><strong>A:</strong> Hallo! Wie heißen Sie?<br>
      <strong>B:</strong> Ich heiße Ahmed. Und wie heißen Sie?<br>
      <strong>A:</strong> Ich bin Frau Müller. Woher kommen Sie?<br>
      <strong>B:</strong> Ich komme aus Ägypten. Ich wohne in Kairo.</p>
    `,
    examples: [
      { german: 'Wie geht es Ihnen?', arabic: 'كيف حال حضرتكم؟' },
      { german: 'Danke, mir geht es gut!', arabic: 'شكراً، أنا بخير!' }
    ]
  },
  {
    id: 'lib_grammar_verbs',
    title: 'Regelmäßige Verben im Präsens (Konjugation)',
    titleArabic: 'تصريف الأفعال المنتظمة في زمن المضارع ⏱️',
    category: 'grammar',
    level: 'A1',
    summary: 'Lerne die Konjugation von Verben wie lernen, kommen, wohnen, machen.',
    summaryArabic: 'قاعدة تصريف الأفعال المنتظمة مع الضمائر الشخصية (ich, du, er/sie/es, wir, ihr, sie/Sie).',
    contentHtml: `
      <h3>Verbstamm + Endung (جذر الفعل + النهاية)</h3>
      <p>لحساب تصريف الفعل المنتظم (مثل <em>lernen</em>)، نحذف <em>-en</em> ونضيف النهايات التالية:</p>
      <ul>
        <li><strong>ich</strong> + e (<em>ich lerne</em>)</li>
        <li><strong>du</strong> + st (<em>du lernst</em>)</li>
        <li><strong>er / sie / es</strong> + t (<em>er lernt</em>)</li>
        <li><strong>wir</strong> + en (<em>wir lernen</em>)</li>
        <li><strong>ihr</strong> + t (<em>ihr lernt</em>)</li>
        <li><strong>sie / Sie</strong> + en (<em>sie lernen</em>)</li>
      </ul>
    `,
    examples: [
      { german: 'Wir lernen Deutsch zusammen.', arabic: 'نحن نتعلم الألمانية معاً.' },
      { german: 'Wo wohnst du?', arabic: 'أين تسكن أنت؟' }
    ]
  }
];
