export interface ChildrenTopicPreset {
  levelCategory: string;
  topicTitle: string;
  wordCount: number;
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
}

export const CHILDREN_LEVEL_CATEGORIES = [
  'المستوى الأول: الكلمات الأساسية',
  'المستوى الثاني: الطفل والبيت',
  'المستوى الثالث: الطعام والحيوانات',
  'المستوى الرابع: الحياة اليومية',
  'المستوى الخامس: العالم من حولنا',
  'المستوى السادس: الأفعال والصفات والمفاهيم',
  'المستوى السابع: موضوعات إضافية للأنشطة'
];

export const CHILDREN_TOPICS_PRESETS: ChildrenTopicPreset[] = [
  // المستوى الأول: الكلمات الأساسية
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Begrüßungen und Verabschiedungen', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Sich vorstellen', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Das Alphabet', wordCount: 26, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Zahlen von 1 bis 20', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Farben', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Formen', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Gefühle und Emotionen', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Personalpronomen', wordCount: 9, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Verben und Tätigkeiten', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الأول: الكلمات الأساسية', topicTitle: 'Fragewörter', wordCount: 10, cefrLevel: 'A1' },

  // المستوى الثاني: الطفل والبيت
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Meine Familie', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Mein Körper', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Mein Gesicht', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Kleidung', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Mein Zuhause', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Mein Zimmer und Möbel', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Meine Spielsachen', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Meine Haustiere', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Meine Schulsachen', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثاني: الطفل والبيت', topicTitle: 'Im Klassenzimmer', wordCount: 20, cefrLevel: 'A1' },

  // المستوى الثالث: الطعام والحيوانات
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Obst', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Gemüse', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Lebensmittel', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Getränke', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Mein Frühstück', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Tiere auf dem Bauernhof', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Wilde Tiere', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Tiere im Wasser', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Insekten', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الثالث: الطعام والحيوانات', topicTitle: 'Kochen und Backen', wordCount: 20, cefrLevel: 'A1' },

  // المستوى الرابع: الحياة اليومية
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Mein Tagesablauf', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Die Uhrzeit', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Die Wochentage', wordCount: 7, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Die Monate', wordCount: 12, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Die Jahreszeiten', wordCount: 4, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Das Wetter', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Hobbys und Freizeit', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Sport', wordCount: 20, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Musik und Instrumente', wordCount: 10, cefrLevel: 'A1' },
  { levelCategory: 'المستوى الرابع: الحياة اليومية', topicTitle: 'Berufe', wordCount: 20, cefrLevel: 'A2' },

  // المستوى الخامس: العالم من حولنا
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'Verkehrsmittel', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'In der Stadt', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'Mein Weg zur Schule', wordCount: 10, cefrLevel: 'A2' },
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'Im Park', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'Auf dem Spielplatz', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'In der Natur', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'Blumen und Pflanzen', wordCount: 10, cefrLevel: 'A2' },
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'Länder und Nationalitäten', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'Deutschland entdecken', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى الخامس: العالم من حولنا', topicTitle: 'Feste und Feiertage', wordCount: 20, cefrLevel: 'A2' },

  // المستوى السادس: الأفعال والصفات والمفاهيم
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Alltagsverben', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Bewegungsverben', wordCount: 10, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Was kann ich?', wordCount: 10, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Was mag ich?', wordCount: 10, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Adjektive: groß und klein', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Gegensätze', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Präpositionen und Positionen', wordCount: 10, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Links und rechts', wordCount: 10, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Singular und Plural', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السادس: الأفعال والصفات والمفاهيم', topicTitle: 'Artikel: der, die, das', wordCount: 20, cefrLevel: 'A2' },

  // المستوى السابع: موضوعات إضافية للأنشطة
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Mein Geburtstag', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Weihnachten', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Ostern', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Schwarz-Rot-Gold', wordCount: 10, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Im Supermarkt', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Im Restaurant', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Obstsalat machen', wordCount: 10, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Farben und Muster', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Spiel und Bewegung', wordCount: 20, cefrLevel: 'A2' },
  { levelCategory: 'المستوى السابع: موضوعات إضافية للأنشطة', topicTitle: 'Wiederholung: Meine ersten deutschen Wörter', wordCount: 20, cefrLevel: 'A2' }
];
