import type { LernstudioLevel, LernstudioSet } from '../types/lernstudio';
import {
  buildLernstudioSetFromVerbs,
  BUILTIN_VERB_GROUPS_BY_ID,
  resolveVerbsFromSelection,
  verbEntryToLernstudioItem,
  VERBS_BY_ID
} from './verbEngine';
import type { VerbEntry, VerbGroupDefinition } from './verbLibrary/verbTypes';

export const VERB_GROUP_SET_ID_PREFIX = 'vgrp_';

export function isVerbGroupSet(set?: Partial<LernstudioSet> | null): boolean {
  if (!set) return false;
  if (set.setKind === 'verb_group') return true;
  if (typeof set.id === 'string' && set.id.startsWith(VERB_GROUP_SET_ID_PREFIX)) return true;
  return false;
}

export function hydrateVerbGroupSet(set: LernstudioSet): LernstudioSet {
  if (!isVerbGroupSet(set)) return set;
  const verbs = resolveVerbsFromSelection({
    verbIds: set.verbIds,
    fallbackVerbs: set.verbEntriesSnapshot
  });
  if (verbs.length === 0) return set;
  return {
    ...set,
    items: verbs.map((v) => verbEntryToLernstudioItem(v))
  };
}

export function verbGroupToLernstudioSet(
  group: VerbGroupDefinition,
  fallbackVerbs?: readonly VerbEntry[],
  options?: { compactForSync?: boolean }
): LernstudioSet {
  const verbs = resolveVerbsFromSelection({
    verbIds: group.verbIds,
    fallbackVerbs
  });

  const levelCounts = new Map<LernstudioLevel, number>();
  for (const v of verbs) {
    levelCounts.set(v.level, (levelCounts.get(v.level) || 0) + 1);
  }
  let dominantLevel: LernstudioLevel = 'A1';
  let maxCount = -1;
  for (const [lvl, count] of levelCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantLevel = lvl;
    }
  }

  const base = buildLernstudioSetFromVerbs({
    id: group.id,
    title: group.titleDe,
    titleAr: group.titleAr,
    verbs,
    level: dominantLevel,
    topic: group.category === 'topic' ? group.titleDe : 'Verbgruppe',
    createdByTeacherName: group.createdByTeacherName,
    createdByUid: group.createdByUid,
    basedOnBuiltinGroupId: group.basedOnBuiltinGroupId,
    setKind: 'verb_group',
    compactItems: options?.compactForSync ?? verbs.length > 150,
    includeEntriesSnapshot: false
  });

  return {
    ...base,
    description: group.descriptionAr || group.descriptionDe || '',
    category: group.category,
    deleted: Boolean(group.deleted),
    createdAt: group.createdAt || base.createdAt,
    updatedAt: group.updatedAt || Date.now()
  };
}

export function lernstudioSetToVerbGroup(set: LernstudioSet): VerbGroupDefinition | null {
  if (!isVerbGroupSet(set) || set.deleted) return null;

  const resolvedIds =
    Array.isArray(set.verbIds) && set.verbIds.length > 0
      ? set.verbIds.filter((id) => Boolean(VERBS_BY_ID.get(id)))
      : (set.items || [])
          .map((item) => item.verbId || item.id)
          .filter((id) => Boolean(VERBS_BY_ID.get(id)));

  return {
    id: set.id,
    titleDe: set.title,
    titleAr: set.titleTranslations?.ar || set.title,
    descriptionAr: set.description || set.descriptionTranslations?.ar,
    category: 'custom',
    verbIds: Array.from(new Set(resolvedIds)),
    isBuiltin: false,
    ...(set.basedOnBuiltinGroupId ? { basedOnBuiltinGroupId: set.basedOnBuiltinGroupId } : {}),
    ...(set.createdByTeacherName ? { createdByTeacherName: set.createdByTeacherName } : {}),
    ...(set.createdByUid ? { createdByUid: set.createdByUid } : {}),
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
    deleted: Boolean(set.deleted)
  };
}

export function extractVerbGroupsFromLernstudioSets(
  sets: readonly LernstudioSet[] = []
): VerbGroupDefinition[] {
  const groups: VerbGroupDefinition[] = [];
  for (const s of sets) {
    const parsed = lernstudioSetToVerbGroup(s);
    if (parsed) groups.push(parsed);
  }
  return groups.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function createCustomVerbGroup(options: {
  titleDe: string;
  titleAr?: string;
  descriptionAr?: string;
  verbIds: readonly string[];
  teacherName: string;
  teacherUid?: string;
  basedOnBuiltinGroupId?: string;
}): VerbGroupDefinition {
  const uniqueIds = Array.from(new Set(options.verbIds.filter((id) => VERBS_BY_ID.has(id))));
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return {
    id: `${VERB_GROUP_SET_ID_PREFIX}${now}_${rand}`,
    titleDe: options.titleDe.trim(),
    titleAr: (options.titleAr || options.titleDe).trim(),
    ...(options.descriptionAr ? { descriptionAr: options.descriptionAr.trim() } : {}),
    category: 'custom',
    verbIds: uniqueIds,
    isBuiltin: false,
    ...(options.basedOnBuiltinGroupId
      ? { basedOnBuiltinGroupId: options.basedOnBuiltinGroupId }
      : {}),
    createdByTeacherName: options.teacherName.trim() || 'المعلم',
    ...(options.teacherUid ? { createdByUid: options.teacherUid } : {}),
    createdAt: new Date(now).toISOString(),
    updatedAt: now,
    deleted: false
  };
}

/**
 * Forks any built-in group non-destructively so teacher edits never overwrite the original
 * built-in library and remain synced across all teachers with `createdByTeacherName`.
 */
export function forkBuiltinVerbGroup(options: {
  builtinGroupId: string;
  titleDe?: string;
  titleAr?: string;
  verbIds?: readonly string[];
  addVerbIds?: readonly string[];
  removeVerbIds?: readonly string[];
  teacherName: string;
  teacherUid?: string;
}): VerbGroupDefinition {
  const builtin = BUILTIN_VERB_GROUPS_BY_ID.get(options.builtinGroupId);
  if (!builtin) {
    throw new Error(`Built-in verb group not found: ${options.builtinGroupId}`);
  }

  let nextIds = options.verbIds ? [...options.verbIds] : [...builtin.verbIds];
  if (options.removeVerbIds && options.removeVerbIds.length > 0) {
    const removeSet = new Set(options.removeVerbIds);
    nextIds = nextIds.filter((id) => !removeSet.has(id));
  }
  if (options.addVerbIds && options.addVerbIds.length > 0) {
    nextIds = [...nextIds, ...options.addVerbIds];
  }

  return createCustomVerbGroup({
    titleDe: options.titleDe || `${builtin.titleDe} (نسخة معدّلة)`,
    titleAr: options.titleAr || `${builtin.titleAr} (نسخة معدّلة)`,
    descriptionAr: builtin.descriptionAr,
    verbIds: nextIds,
    teacherName: options.teacherName,
    teacherUid: options.teacherUid,
    basedOnBuiltinGroupId: builtin.id
  });
}

export function updateCustomVerbGroup(
  group: VerbGroupDefinition,
  updates: {
    titleDe?: string;
    titleAr?: string;
    descriptionAr?: string;
    verbIds?: readonly string[];
    editedByTeacherName?: string;
  }
): VerbGroupDefinition {
  if (group.isBuiltin) {
    throw new Error('Cannot mutate a built-in verb group directly. Fork it with forkBuiltinVerbGroup instead.');
  }

  const nextVerbIds = updates.verbIds
    ? Array.from(new Set(updates.verbIds.filter((id) => VERBS_BY_ID.has(id))))
    : [...group.verbIds];

  return {
    ...group,
    ...(updates.titleDe !== undefined ? { titleDe: updates.titleDe.trim() } : {}),
    ...(updates.titleAr !== undefined ? { titleAr: updates.titleAr.trim() } : {}),
    ...(updates.descriptionAr !== undefined
      ? { descriptionAr: updates.descriptionAr.trim() }
      : {}),
    verbIds: nextVerbIds,
    ...(updates.editedByTeacherName
      ? { createdByTeacherName: updates.editedByTeacherName.trim() }
      : {}),
    updatedAt: Date.now()
  };
}
