import { VERB_LIBRARY_VERSION } from './verbCatalogBuilder';
import { VERBS_A1 } from './verbsA1';
import { VERBS_A2 } from './verbsA2';
import { VERBS_B1 } from './verbsB1';
import {
  ALL_VERB_TOPIC_TAGS,
  VerbClassification,
  VerbEntry,
  VerbGroupDefinition,
  VerbTopicTag
} from './verbTypes';

function buildGlobalVerbRegistry(): {
  allVerbs: readonly VerbEntry[];
  byId: ReadonlyMap<string, VerbEntry>;
  byInfinitive: ReadonlyMap<string, VerbEntry>;
} {
  const combined: VerbEntry[] = [];
  const byId = new Map<string, VerbEntry>();
  const byInfinitive = new Map<string, VerbEntry>();

  for (const verb of [...VERBS_A1, ...VERBS_A2, ...VERBS_B1]) {
    const infKey = verb.infinitive.trim().toLowerCase();
    if (byId.has(verb.id)) {
      throw new Error(`Duplicate verb ID in Unified Verb Library: ${verb.id}`);
    }
    if (byInfinitive.has(infKey)) {
      throw new Error(
        `Duplicate verb infinitive across CEFR levels: "${verb.infinitive}" (existing ${byInfinitive.get(infKey)?.level}, new ${verb.level})`
      );
    }
    byId.set(verb.id, verb);
    byInfinitive.set(infKey, verb);
    combined.push(verb);
  }

  return {
    allVerbs: Object.freeze(combined),
    byId,
    byInfinitive
  };
}

const REGISTRY = buildGlobalVerbRegistry();

export const ALL_VERBS: readonly VerbEntry[] = REGISTRY.allVerbs;
export const VERBS_BY_ID: ReadonlyMap<string, VerbEntry> = REGISTRY.byId;
export const VERBS_BY_INFINITIVE: ReadonlyMap<string, VerbEntry> = REGISTRY.byInfinitive;

const TOPIC_ARABIC_TITLES: Record<VerbTopicTag, { titleAr: string; descriptionAr: string }> = {
  Alltag: {
    titleAr: 'الحياة اليومية والروتين',
    descriptionAr: 'أفعال الأنشطة اليومية والمنزل والروتين المتكرر (A1–B1).'
  },
  Familie: {
    titleAr: 'العائلة والمنزل',
    descriptionAr: 'أفعال العلاقات الأسرية والتربية والحياة العائلية.'
  },
  Schule: {
    titleAr: 'المدرسة والدراسة والتعلم',
    descriptionAr: 'أفعال الصف الدراسي والامتحانات والبحث والتعلم.'
  },
  Freizeit: {
    titleAr: 'وقت الفراغ والهوايات والرياضة',
    descriptionAr: 'أفعال الهوايات والفنون والرياضة والأنشطة الترفيهية.'
  },
  'Essen und Trinken': {
    titleAr: 'الطعام والشراب والطبخ',
    descriptionAr: 'أفعال المطبخ والمطعم وإعداد الطعام وتناوله.'
  },
  Einkaufen: {
    titleAr: 'التسوق والشراء والمال',
    descriptionAr: 'أفعال المتاجر والأسعار والدفع والطلبات.'
  },
  Reisen: {
    titleAr: 'السفر والمواصلات والرحلات',
    descriptionAr: 'أفعال المطار والقطارات والحجز والتنقل.'
  },
  Gesundheit: {
    titleAr: 'الصحة والطب والجسم',
    descriptionAr: 'أفعال العيادة والأعراض والعلاج واللياقة.'
  },
  'Beruf und Ausbildung': {
    titleAr: 'العمل والمهنة والتدريب المهني',
    descriptionAr: 'أفعال التقديم والوظيفة والاجتماعات والمشاريع.'
  },
  'Umwelt und Natur': {
    titleAr: 'البيئة والطبيعة والمناخ',
    descriptionAr: 'أفعال الطبيعة والطقس وحماية البيئة والطاقة.'
  },
  'Kommunikation und Medien': {
    titleAr: 'التواصل والإعلام والتقنية',
    descriptionAr: 'أفعال الحوار والمراسلة والإعلام والإنترنت.'
  },
  'Beziehungen und Gefühle': {
    titleAr: 'العلاقات والمشاعر والانفعالات',
    descriptionAr: 'أفعال الصداقة والمشاعر والآراء والتعامل الاجتماعي.'
  },
  Gesellschaft: {
    titleAr: 'المجتمع والقانون والثقافة',
    descriptionAr: 'أفعال الشأن العام والحقوق والمؤسسات والتطوع.'
  },
  'Probleme und Lösungen': {
    titleAr: 'المشكلات والحلول والأزمات',
    descriptionAr: 'أفعال التحديات والأعطال والبحث عن حلول ومعالجتها.'
  }
};

function topicSlug(topic: VerbTopicTag): string {
  return topic
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const GRAMMAR_GROUP_SPECS: ReadonlyArray<{
  id: string;
  classification: VerbClassification;
  titleDe: string;
  titleAr: string;
  descriptionAr: string;
}> = [
  {
    id: 'vgrp_builtin_gram_regelmaessig',
    classification: 'regelmäßig',
    titleDe: 'Regelmäßige Verben',
    titleAr: 'الأفعال القياسية (المنتظمة)',
    descriptionAr: 'الأفعال التي تتبع قواعد التصريف القياسية في زمن المضارع.'
  },
  {
    id: 'vgrp_builtin_gram_unregelmaessig',
    classification: 'unregelmäßig',
    titleDe: 'Unregelmäßige Verben',
    titleAr: 'الأفعال الشاذة (غير المنتظمة)',
    descriptionAr: 'الأفعال القوية والمختلطة ذات تغير الحرف الصوتي أو التصريف الخاص.'
  },
  {
    id: 'vgrp_builtin_gram_trennbar',
    classification: 'trennbar',
    titleDe: 'Trennbare Verben',
    titleAr: 'الأفعال المنفصلة',
    descriptionAr: 'أفعال تنفصل بادئتها في نهاية الجملة الخبرية.'
  },
  {
    id: 'vgrp_builtin_gram_reflexiv',
    classification: 'reflexiv',
    titleDe: 'Reflexive Verben',
    titleAr: 'الأفعال الانعكاسية',
    descriptionAr: 'الأفعال المستخدمة مع الضمير الانعكاسي (mich / dich / sich...).'
  },
  {
    id: 'vgrp_builtin_gram_modal',
    classification: 'Modalverb',
    titleDe: 'Modalverben',
    titleAr: 'الأفعال المساعدة (Modalverben)',
    descriptionAr: 'أفعال الكيفية والمساعدة الأساسية وما يرتبط بها من تصريف خاص.'
  },
  {
    id: 'vgrp_builtin_gram_praeposition',
    classification: 'Verb mit Präposition',
    titleDe: 'Verben mit Präpositionen',
    titleAr: 'الأفعال المقترنة بحروف جر',
    descriptionAr: 'الأفعال التي تأتي مع حرف جر ثابت وحالة إعرابية محددة (Akkusativ/Dativ).'
  }
];

function buildBuiltinVerbGroups(): readonly VerbGroupDefinition[] {
  const cefrGroups: VerbGroupDefinition[] = [
    {
      id: 'vgrp_builtin_cefr_a1',
      titleDe: 'A1 Grundverben',
      titleAr: 'أفعال المستوى A1 الأساسية',
      descriptionAr: 'جميع الأفعال الأساسية المعتمدة لمستوى A1.',
      category: 'cefr',
      verbIds: VERBS_A1.map((v) => v.id),
      isBuiltin: true,
      libraryVersion: VERB_LIBRARY_VERSION
    },
    {
      id: 'vgrp_builtin_cefr_a2',
      titleDe: 'A2 Grundverben',
      titleAr: 'أفعال المستوى A2 الأساسية',
      descriptionAr: 'جميع الأفعال المعتمدة لمستوى A2 لتوسيع التعبير والتواصل.',
      category: 'cefr',
      verbIds: VERBS_A2.map((v) => v.id),
      isBuiltin: true,
      libraryVersion: VERB_LIBRARY_VERSION
    },
    {
      id: 'vgrp_builtin_cefr_b1',
      titleDe: 'B1 Grundverben',
      titleAr: 'أفعال المستوى B1 المتوسطة',
      descriptionAr: 'جميع الأفعال المعتمدة لمستوى B1 في الدراسة والعمل والمجتمع.',
      category: 'cefr',
      verbIds: VERBS_B1.map((v) => v.id),
      isBuiltin: true,
      libraryVersion: VERB_LIBRARY_VERSION
    }
  ];

  const grammarGroups: VerbGroupDefinition[] = GRAMMAR_GROUP_SPECS.map((spec) => ({
    id: spec.id,
    titleDe: spec.titleDe,
    titleAr: spec.titleAr,
    descriptionAr: spec.descriptionAr,
    category: 'grammar',
    verbIds: ALL_VERBS.filter((v) => v.classifications.includes(spec.classification)).map((v) => v.id),
    isBuiltin: true,
    libraryVersion: VERB_LIBRARY_VERSION
  }));

  const topicGroups: VerbGroupDefinition[] = ALL_VERB_TOPIC_TAGS.map((topic) => ({
    id: `vgrp_builtin_topic_${topicSlug(topic)}`,
    titleDe: topic,
    titleAr: TOPIC_ARABIC_TITLES[topic].titleAr,
    descriptionAr: TOPIC_ARABIC_TITLES[topic].descriptionAr,
    category: 'topic',
    verbIds: ALL_VERBS.filter((v) => v.topics.includes(topic)).map((v) => v.id),
    isBuiltin: true,
    libraryVersion: VERB_LIBRARY_VERSION
  }));

  return Object.freeze([...cefrGroups, ...grammarGroups, ...topicGroups]);
}

export const BUILTIN_VERB_GROUPS: readonly VerbGroupDefinition[] = buildBuiltinVerbGroups();
export const BUILTIN_VERB_GROUPS_BY_ID: ReadonlyMap<string, VerbGroupDefinition> = new Map(
  BUILTIN_VERB_GROUPS.map((g) => [g.id, g])
);
