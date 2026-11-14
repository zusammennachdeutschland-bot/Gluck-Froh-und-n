import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LernstudioSet } from '../../types/lernstudio';
import { useApp } from '../../context/AppContext';
import {
  HomeworkAssignment,
  HomeworkAudienceMode,
  HomeworkContentSource,
  HomeworkFlowMode,
  HomeworkQuestionType,
  HomeworkBlooketMode,
  HomeworkSubmission,
  DEFAULT_HOMEWORK_QUESTION_TYPES,
  VERB_HOMEWORK_QUESTION_TYPES
} from '../homeworkTypes';
import {
  QUESTION_TYPE_META,
  VERB_QUESTION_TYPE_META,
  buildHomeworkShareUrl,
  getLocalAssignments,
  saveLocalAssignment,
  applyCloudAssignmentsSnapshot,
  saveAssignmentWithConfirmation,
  deleteLocalAssignment,
  saveLocalSubmission,
  syncAndFetchTeacherAssignments,
  fetchAssignmentDetailsWithSync,
  getLocalAssignmentDetails,
  isAssignmentDeletedLocally,
  sanitizeDocId,
  getVercelPublicDomain,
  createHomeworkShareToken,
  createHomeworkAssignmentId,
  createHomeworkShortId,
  flushPendingHomeworkCloudWrites,
  getPendingHomeworkSyncCount,
  saveLernstudioSetToFirestore,
  subscribeAssignmentsFromFirestore,
  subscribeSubmissionsFromFirestore,
  subscribeTeacherAuth,
  getCurrentHomeworkOwnerUid,
  getCurrentHomeworkOwnerEmail,
  migrateLegacyHomeworkForAccount,
  resolveAssignmentAudienceMode,
  resolveStageQuestionCount,
  calculateTotalHomeworkQuestions,
  setHomeworkAssignmentActiveStatus,
  updateHomeworkAssignmentMetadata
} from '../homeworkStorageSync';
import { auth, signInTeacherWithGoogle } from '../firebaseCloudSync';
import {
  ALL_VERBS,
  BUILTIN_VERB_GROUPS,
  resolveVerbsFromSelection,
  filterVerbs,
  verbEntryToLernstudioItem
} from '../verbEngine';
import {
  isVerbGroupSet,
  extractVerbGroupsFromLernstudioSets,
  createCustomVerbGroup,
  verbGroupToLernstudioSet
} from '../verbGroupSync';
import { filterLernstudioSetsByQuery } from '../lernstudioTranslations';
import type { VerbEntry, VerbGroupCategory, VerbGroupDefinition, VerbLevel } from '../verbLibrary/verbTypes';
import {
  Sparkles,
  X,
  Send,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Users,
  Trophy,
  BarChart3,
  ArrowRight,
  Eye,
  Plus,
  ListChecks,
  Cloud,
  CloudOff,
  Share2,
  Trash2,
  Building2,
  Filter,
  Clock,
  Target,
  Activity,
  HelpCircle,
  Globe,
  BookOpen,
  Search,
  Layers,
  Lock,
  Unlock,
  Edit3
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sets: LernstudioSet[];
  defaultSet?: LernstudioSet | null;
  initialTab?: 'create' | 'results';
  language?: string;
  initialAudienceMode?: HomeworkAudienceMode;
  initialGroupId?: string;
  initialTitle?: string;
  autoCloseOnCreate?: boolean;
  onAssignmentConfirmed?: (assignment: HomeworkAssignment) => void;
}

async function persistHomeworkAssignmentToServer(assignment: HomeworkAssignment): Promise<any> {
  const idToken = await auth?.currentUser?.getIdToken().catch(() => null);
  if (!idToken) {
    throw new Error('يجب تسجيل الدخول بحساب المدرس لحفظ الواجب ومشاركة رابطه.');
  }

  const response = await fetch('/api/teacher/assignments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    credentials: 'include',
    body: JSON.stringify(assignment)
  });

  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok || !data?.assignment) {
    throw new Error(data?.error || 'تعذر حفظ الواجب على الخادم؛ لم يتم إنشاء رابط مشاركة.');
  }
  return data.assignment;
}

function formatDurationAr(seconds?: number): string {
  const sec = Math.max(0, Math.round(seconds || 0));
  if (sec === 0) return '—';
  if (sec < 60) return `${sec} ث`;
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${mins} د ${rem} ث` : `${mins} د`;
}

export const LernstudioHomeworkModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sets,
  defaultSet,
  initialTab,
  initialAudienceMode,
  initialGroupId,
  initialTitle,
  autoCloseOnCreate,
  onAssignmentConfirmed
}) => {
  const { groups, students = [], profile, saveLernstudioSet } = useApp();
  const [activeTab, setActiveTab] = useState<'create' | 'results'>(initialTab || 'create');

  // Keep latest students roster ref for real-time Firestore subscription callbacks
  const studentsRef = useRef(students);
  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  const vocabSets = useMemo(() => sets.filter((s) => !isVerbGroupSet(s)), [sets]);
  const customVerbGroups = useMemo(() => extractVerbGroupsFromLernstudioSets(sets), [sets]);
  const allVerbGroups = useMemo<VerbGroupDefinition[]>(
    () => [...BUILTIN_VERB_GROUPS, ...customVerbGroups],
    [customVerbGroups]
  );

  // Create Homework State
  const [contentSource, setContentSource] = useState<HomeworkContentSource>(() =>
    isVerbGroupSet(defaultSet) ? 'verb' : 'vocab'
  );
  const [selectedSetId, setSelectedSetId] = useState(() => {
    if (defaultSet && !isVerbGroupSet(defaultSet)) return defaultSet.id;
    return vocabSets[0]?.id || sets[0]?.id || '';
  });
  const [selectedVerbGroupIds, setSelectedVerbGroupIds] = useState<string[]>(() => {
    if (isVerbGroupSet(defaultSet) && defaultSet?.id) return [defaultSet.id];
    return [];
  });
  const [selectedVerbIds, setSelectedVerbIds] = useState<string[]>(() => {
    if (isVerbGroupSet(defaultSet) && Array.isArray(defaultSet?.verbIds)) {
      return [...defaultSet.verbIds];
    }
    return [];
  });
  const [vocabSetSearchQuery, setVocabSetSearchQuery] = useState('');
  const filteredVocabSets = useMemo(
    () => filterLernstudioSetsByQuery(vocabSets, vocabSetSearchQuery),
    [vocabSets, vocabSetSearchQuery]
  );

  const [verbSubjectPoolMode, setVerbSubjectPoolMode] = useState<'pronouns_and_names' | 'pronouns_only'>(
    'pronouns_and_names'
  );
  const [verbGroupCategoryFilter, setVerbGroupCategoryFilter] = useState<VerbGroupCategory | 'all'>('cefr');
  const [verbSearchQuery, setVerbSearchQuery] = useState('');
  const [verbLevelFilter, setVerbLevelFilter] = useState<VerbLevel | 'all'>('all');
  const [newVerbGroupTitle, setNewVerbGroupTitle] = useState('');
  const [newVerbGroupTeacherName, setNewVerbGroupTeacherName] = useState('');
  const [verbGroupSaveSuccess, setVerbGroupSaveSuccess] = useState<string | null>(null);

  const [audienceMode, setAudienceMode] = useState<HomeworkAudienceMode>('open');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => groups[0]?.id || '');
  const [createError, setCreateError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const flowMode: HomeworkFlowMode = 'teacher_then_quiz';
  const [questionTypes, setQuestionTypes] = useState<HomeworkQuestionType[]>(() =>
    isVerbGroupSet(defaultSet)
      ? [...VERB_HOMEWORK_QUESTION_TYPES]
      : [...DEFAULT_HOMEWORK_QUESTION_TYPES]
  );
  const [questionTypeCounts, setQuestionTypeCounts] = useState<
    Partial<Record<HomeworkQuestionType, number>>
  >({});
  const [blooketMode] = useState<HomeworkBlooketMode>('classic_quiz');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [maxAttempts, setMaxAttempts] = useState(0);
  const [hideTeacherBranding, setHideTeacherBranding] = useState(false);
  const [hasDeadline] = useState(false);
  const [deadlineDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdAssignment, setCreatedAssignment] = useState<HomeworkAssignment | null>(null);
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);
  const [createdCloudSynced, setCreatedCloudSynced] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Results & Monitoring Tab State
  const [assignmentsList, setAssignmentsList] = useState<any[]>([]);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailSubTab, setDetailSubTab] = useState<'students' | 'questions' | 'attempts'>('students');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all');
  const [inspectingSubmission, setInspectingSubmission] = useState<HomeworkSubmission | null>(null);
  const [inspectingStudentAttempts, setInspectingStudentAttempts] = useState<HomeworkSubmission[]>([]);
  const [deleteConfirmHw, setDeleteConfirmHw] = useState<HomeworkAssignment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [flushingPending, setFlushingPending] = useState<boolean>(false);

  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const selectedDetailsIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedDetailsIdRef.current = selectedDetails?.assignment?.id || null;
  }, [selectedDetails?.assignment?.id]);

  // Ensure a valid default group ID is selected when groups load
  useEffect(() => {
    if ((!selectedGroupId || !groups.some((g) => g.id === selectedGroupId)) && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const activeSelectedGroupStudents = useMemo(() => {
    if (audienceMode !== 'group' || !selectedGroupId) return [];
    return students.filter(
      (s) => !s.deleted && s.status !== 'archived' && s.groupId === selectedGroupId
    );
  }, [audienceMode, selectedGroupId, students]);

  // Firebase Auth + Vercel Public Domain State
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [vercelDomain] = useState<string>(() => getVercelPublicDomain());
  const activeAuthUid = (firebaseUser?.uid || getCurrentHomeworkOwnerUid() || '').trim() || null;

  const currentSet = useMemo(
    () =>
      vocabSets.find((s) => s.id === selectedSetId) ||
      (!isVerbGroupSet(defaultSet) ? defaultSet : null) ||
      vocabSets[0] ||
      sets[0],
    [vocabSets, sets, selectedSetId, defaultSet]
  );

  // Sync activeTab & contextual defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      } else if (defaultSet) {
        setActiveTab('create');
      }
      if (initialAudienceMode) {
        setAudienceMode(initialAudienceMode);
      }
      if (initialGroupId && groups.some((g) => g.id === initialGroupId)) {
        setSelectedGroupId(initialGroupId);
      }
      if (initialTitle !== undefined) {
        setTitle(initialTitle);
      }
      if (autoCloseOnCreate) {
        setCreatedAssignment(null);
        setCreatedShareLink(null);
      }
      if (isVerbGroupSet(defaultSet) && defaultSet) {
        setContentSource('verb');
        const groupIdMatch = defaultSet.id;
        setSelectedVerbGroupIds(groupIdMatch ? [groupIdMatch] : []);
        const resolvedVerbs = resolveVerbsFromSelection({
          groupIds: groupIdMatch ? [groupIdMatch] : [],
          verbIds: defaultSet.verbIds,
          customGroups: customVerbGroups,
          fallbackVerbs: defaultSet.verbEntriesSnapshot
        });
        setSelectedVerbIds(resolvedVerbs.map((v) => v.id));
        setQuestionTypes([...VERB_HOMEWORK_QUESTION_TYPES]);
      } else {
        setContentSource((prev) => (prev === 'verb' && !defaultSet ? 'verb' : 'vocab'));
        if ((!selectedSetId || !vocabSets.some((s) => s.id === selectedSetId)) && (defaultSet || vocabSets[0])) {
          setSelectedSetId((!isVerbGroupSet(defaultSet) ? defaultSet?.id : undefined) || vocabSets[0]?.id || '');
        }
      }
      setHideTeacherBranding(false);
      setVocabSetSearchQuery('');
      setCreateError(null);
      setVerbGroupSaveSuccess(null);
      setPendingSyncCount(getPendingHomeworkSyncCount());
    }
  }, [isOpen, initialTab, defaultSet, initialAudienceMode, initialGroupId, initialTitle, autoCloseOnCreate, groups, sets]);

  // Initialize selectedItemIds when set changes
  useEffect(() => {
    if (currentSet?.items) {
      setSelectedItemIds(currentSet.items.map((it) => it.id));
      setQuestionTypeCounts({});
    }
  }, [currentSet?.id]);

  useEffect(() => {
    if (defaultSet?.id && !isVerbGroupSet(defaultSet)) {
      setSelectedSetId(defaultSet.id);
    }
  }, [defaultSet?.id]);

  useEffect(() => {
    const unsubAuth = subscribeTeacherAuth((u) => {
      setFirebaseUser(u);
      // Clear previous account UI state immediately on account switch or logout
      setAssignmentsList([]);
      setSelectedDetails(null);
      setInspectingSubmission(null);
      setInspectingStudentAttempts([]);
      setCreatedAssignment(null);
      setCreatedShareLink(null);
      if (u?.uid) {
        const migOpts = {
          uid: u.uid,
          email: u.email,
          ownedGroupIds: groups.map((g) => g.id),
          ownedSetIds: sets.map((s) => s.id),
          ownedStudentIds: (studentsRef.current || []).map((st) => st.id)
        };
        migrateLegacyHomeworkForAccount(migOpts);
      }
      setPendingSyncCount(getPendingHomeworkSyncCount(u?.uid || null));
    });
    return () => unsubAuth();
  }, [groups.length, sets.length]);

  const [editingHw, setEditingHw] = useState<HomeworkAssignment | null>(null);
  const [editHwTitle, setEditHwTitle] = useState('');
  const [editHwMaxAttempts, setEditHwMaxAttempts] = useState<number>(0);
  const [editHwHideBranding, setEditHwHideBranding] = useState<boolean>(false);
  const [isSavingHwEdit, setIsSavingHwEdit] = useState(false);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);

  const loadAllAssignments = async (forceCloud = true) => {
    setLoadingResults(true);
    try {
      const list = await syncAndFetchTeacherAssignments(studentsRef.current, { force: forceCloud });
      setAssignmentsList(list);
      setPendingSyncCount(getPendingHomeworkSyncCount());
    } finally {
      setLoadingResults(false);
    }
  };

  // On-demand Homework Cloud fetch when opening the modal + local/P2P event listener (no continuous 4s polling or background onSnapshot)
  useEffect(() => {
    if (!isOpen) return;
    loadAllAssignments(true);

    const refreshFromLocalOrP2P = () => {
      syncAndFetchTeacherAssignments(studentsRef.current, { force: false })
        .then((list) => {
          setAssignmentsList(list);
          setPendingSyncCount(getPendingHomeworkSyncCount(activeAuthUid));
        })
        .catch(() => {});

      const currentDetailId = selectedDetailsIdRef.current;
      if (currentDetailId) {
        const localDet = getLocalAssignmentDetails(currentDetailId, studentsRef.current);
        if (localDet) {
          setSelectedDetails(localDet);
        }
      }
    };

    window.addEventListener('storage', refreshFromLocalOrP2P);
    window.addEventListener('glueck-homework-sync-updated', refreshFromLocalOrP2P);

    return () => {
      window.removeEventListener('storage', refreshFromLocalOrP2P);
      window.removeEventListener('glueck-homework-sync-updated', refreshFromLocalOrP2P);
    };
  }, [isOpen, activeAuthUid]);

  const handleFlushPendingSync = async () => {
    setFlushingPending(true);
    try {
      const res = await flushPendingHomeworkCloudWrites();
      setPendingSyncCount(res.remainingPending);
      await loadAllAssignments();
      if (selectedDetails?.assignment?.id) {
        const d = await fetchAssignmentDetailsWithSync(selectedDetails.assignment.id, studentsRef.current);
        if (d) setSelectedDetails(d);
      }
    } finally {
      setFlushingPending(false);
    }
  };

  const switchContentSource = (nextSource: HomeworkContentSource) => {
    setContentSource(nextSource);
    setCreateError(null);
    setQuestionTypeCounts({});
    if (nextSource === 'verb' || nextSource === 'mixed') {
      setQuestionTypes([...VERB_HOMEWORK_QUESTION_TYPES]);
    } else {
      setQuestionTypes([...DEFAULT_HOMEWORK_QUESTION_TYPES]);
    }
  };

  const resolvedSelectedVerbs = useMemo<VerbEntry[]>(() => {
    if (selectedVerbIds.length > 0) {
      return resolveVerbsFromSelection({
        verbIds: selectedVerbIds,
        customGroups: customVerbGroups
      });
    }
    if (selectedVerbGroupIds.length > 0) {
      return resolveVerbsFromSelection({
        groupIds: selectedVerbGroupIds,
        customGroups: customVerbGroups
      });
    }
    return [];
  }, [selectedVerbIds, selectedVerbGroupIds, customVerbGroups]);

  const filteredBrowseVerbs = useMemo<VerbEntry[]>(() => {
    if (verbSearchQuery.trim()) {
      return filterVerbs({
        levels: verbLevelFilter === 'all' ? undefined : [verbLevelFilter],
        searchQuery: verbSearchQuery
      });
    }
    if (selectedVerbGroupIds.length > 0) {
      return filterVerbs({
        groupIds: selectedVerbGroupIds,
        customGroups: customVerbGroups,
        levels: verbLevelFilter === 'all' ? undefined : [verbLevelFilter]
      });
    }
    if (verbLevelFilter !== 'all') {
      return filterVerbs({ levels: [verbLevelFilter] });
    }
    return [...ALL_VERBS];
  }, [verbSearchQuery, verbLevelFilter, selectedVerbGroupIds, customVerbGroups]);

  const toggleVerbGroupSelection = (group: VerbGroupDefinition) => {
    setCreateError(null);
    setSelectedVerbGroupIds((prev) => {
      const exists = prev.includes(group.id);
      const nextGroups = exists ? prev.filter((id) => id !== group.id) : [...prev, group.id];
      if (!exists) {
        // Add group's verbs into selectedVerbIds
        setSelectedVerbIds((prevIds) => Array.from(new Set([...prevIds, ...group.verbIds])));
      } else {
        // Recompute remaining verbs from remaining selected groups
        const remainingIds = new Set<string>();
        for (const gid of nextGroups) {
          const gObj = allVerbGroups.find((x) => x.id === gid);
          gObj?.verbIds.forEach((vid) => remainingIds.add(vid));
        }
        const removedGroupSet = new Set(group.verbIds);
        setSelectedVerbIds((prevIds) =>
          prevIds.filter((vid) => remainingIds.has(vid) || !removedGroupSet.has(vid))
        );
      }
      return nextGroups;
    });
  };

  const toggleSingleVerbId = (verbId: string) => {
    setCreateError(null);
    setSelectedVerbIds((prev) =>
      prev.includes(verbId) ? prev.filter((id) => id !== verbId) : [...prev, verbId]
    );
  };

  const handleSaveInlineCustomVerbGroup = async () => {
    const cleanTitle = newVerbGroupTitle.trim();
    if (!cleanTitle || resolvedSelectedVerbs.length === 0) return;
    const defaultProfileName =
      profile?.displayNameAr?.trim() ||
      profile?.nameAr?.trim() ||
      profile?.displayName?.trim() ||
      profile?.nameEn?.trim() ||
      firebaseUser?.displayName?.trim() ||
      'المعلم';
    const myName = newVerbGroupTeacherName.trim() || defaultProfileName;
    const baseGroupId = selectedVerbGroupIds.length === 1 ? selectedVerbGroupIds[0] : undefined;
    const newGroup = createCustomVerbGroup({
      titleDe: cleanTitle,
      titleAr: cleanTitle,
      verbIds: resolvedSelectedVerbs.map((v) => v.id),
      teacherName: myName,
      teacherUid: activeAuthUid || undefined,
      basedOnBuiltinGroupId: baseGroupId?.startsWith('vgrp_builtin_') ? baseGroupId : undefined
    });
    const asSet = verbGroupToLernstudioSet(newGroup, resolvedSelectedVerbs);
    saveLernstudioSet(asSet);
    await saveLernstudioSetToFirestore(
      verbGroupToLernstudioSet(newGroup, resolvedSelectedVerbs, { compactForSync: true })
    ).catch(() => false);
    setSelectedVerbGroupIds([newGroup.id]);
    setNewVerbGroupTitle('');
    setVerbGroupSaveSuccess(`تم حفظ مجموعة "${cleanTitle}" (${resolvedSelectedVerbs.length} فعل) باسم ${myName}`);
    setTimeout(() => setVerbGroupSaveSuccess(null), 4000);
  };

  const activeQuestionMetaList = useMemo(() => {
    if (contentSource === 'verb' || contentSource === 'mixed') {
      return [...QUESTION_TYPE_META, ...VERB_QUESTION_TYPE_META];
    }
    return QUESTION_TYPE_META;
  }, [contentSource]);

  const activeQuestionTypesForSource = useMemo(() => {
    const allowedIds = new Set(activeQuestionMetaList.map((m) => m.id));
    const filtered = questionTypes.filter((qt) => allowedIds.has(qt));
    if (filtered.length > 0) return filtered;
    return [activeQuestionMetaList[0].id];
  }, [questionTypes, activeQuestionMetaList]);

  const toggleQuestionType = (type: HomeworkQuestionType) => {
    setQuestionTypes((prev) => {
      const allowedIds = new Set(activeQuestionMetaList.map((m) => m.id));
      const activePrev = prev.filter((t) => allowedIds.has(t));
      if (activePrev.includes(type)) {
        if (activePrev.length === 1) return activePrev;
        return activePrev.filter((t) => t !== type);
      }
      const next = [...activePrev, type];
      const canonicalOrder = activeQuestionMetaList.map((m) => m.id);
      return next.sort((a, b) => canonicalOrder.indexOf(a) - canonicalOrder.indexOf(b));
    });
  };

  const toggleWordItem = (id: string) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least 1 word
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const effectiveVocabCount =
    contentSource === 'verb' ? 0 : Math.max(0, selectedItemIds.length || currentSet?.items?.length || 0);
  const effectiveVerbCount = contentSource === 'vocab' ? 0 : resolvedSelectedVerbs.length;
  const effectiveWordStageCount =
    contentSource === 'verb' ? effectiveVerbCount : effectiveVocabCount;
  const maxStageWords = Math.max(1, effectiveWordStageCount || 1);

  const getStageMaxCount = (type: HomeworkQuestionType): number => {
    if (type === 'verb_conjugation') return Math.max(1, effectiveVerbCount * 6);
    if (type === 'verb_sentence') return Math.max(1, effectiveVerbCount);
    return maxStageWords;
  };

  const getStageQuestionCount = (type: HomeworkQuestionType): number =>
    resolveStageQuestionCount(type, effectiveVocabCount, questionTypeCounts, effectiveVerbCount);

  const setSingleStageQuestionCount = (type: HomeworkQuestionType, nextCount: number) => {
    const stageMax = getStageMaxCount(type);
    const clamped = Math.min(stageMax, Math.max(1, Math.round(nextCount)));
    setQuestionTypeCounts((prev) => {
      const next = { ...prev };
      if (clamped >= stageMax) {
        delete next[type];
      } else {
        next[type] = clamped;
      }
      return next;
    });
  };

  const setAllStagesQuestionCount = (nextCount: number | 'all') => {
    if (nextCount === 'all') {
      setQuestionTypeCounts({});
      return;
    }
    const next: Partial<Record<HomeworkQuestionType, number>> = {};
    for (const meta of activeQuestionMetaList) {
      const stageMax = getStageMaxCount(meta.id);
      const clamped = Math.min(stageMax, Math.max(1, Math.round(nextCount)));
      if (clamped < stageMax) {
        next[meta.id] = clamped;
      }
    }
    setQuestionTypeCounts(next);
  };

  const totalConfiguredQuestions = useMemo(
    () =>
      calculateTotalHomeworkQuestions(
        effectiveVocabCount,
        activeQuestionTypesForSource,
        questionTypeCounts,
        effectiveVerbCount
      ),
    [effectiveVocabCount, activeQuestionTypesForSource, questionTypeCounts, effectiveVerbCount]
  );

  const fullMaxQuestions = useMemo(
    () =>
      calculateTotalHomeworkQuestions(
        effectiveVocabCount,
        activeQuestionTypesForSource,
        {},
        effectiveVerbCount
      ),
    [effectiveVocabCount, activeQuestionTypesForSource, effectiveVerbCount]
  );
  const hasCustomStageCounts = totalConfiguredQuestions < fullMaxQuestions;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contentSource !== 'verb' && !currentSet) return;
    if (contentSource !== 'vocab' && resolvedSelectedVerbs.length === 0) {
      setCreateError('يرجى اختيار فعل واحد أو مجموعة أفعال واحدة على الأقل من مكتبة الأفعال.');
      return;
    }
    setCreateError(null);

    const isGroupMode = audienceMode === 'group';
    const targetGroup = isGroupMode ? groups.find((g) => g.id === selectedGroupId) : undefined;

    if (isGroupMode) {
      if (!selectedGroupId || !targetGroup) {
        setCreateError('يرجى اختيار المجموعة المستهدفة أولاً قبل إنشاء الواجب.');
        return;
      }
      if (activeSelectedGroupStudents.length === 0) {
        setCreateError(`المجموعة المختارة (${targetGroup.name}) لا تحتوي على طلاب نشطين حالياً.`);
        return;
      }
    }

    setIsCreating(true);
    const resolvedOwnerUid = activeAuthUid || getCurrentHomeworkOwnerUid() || undefined;
    const resolvedOwnerEmail = firebaseUser?.email || getCurrentHomeworkOwnerEmail() || undefined;
    try {
      const chosenVocabItems =
        contentSource === 'verb'
          ? []
          : (currentSet?.items || []).filter((it) => selectedItemIds.includes(it.id));
      const finalVocabItems =
        contentSource === 'verb'
          ? []
          : chosenVocabItems.length > 0
          ? chosenVocabItems
          : currentSet?.items || [];

      const finalVerbs = contentSource === 'vocab' ? [] : resolvedSelectedVerbs;
      const useCompactVerbItems = finalVerbs.length > 180;
      const finalVerbItems = finalVerbs.map((v) =>
        verbEntryToLernstudioItem(v, { compact: useCompactVerbItems })
      );

      const finalItems =
        contentSource === 'verb'
          ? finalVerbItems
          : contentSource === 'mixed'
          ? [...finalVocabItems, ...finalVerbItems]
          : finalVocabItems;

      const sanitizedCounts: Partial<Record<HomeworkQuestionType, number>> = {};
      const wordStageCap = contentSource === 'verb' ? finalVerbs.length : finalVocabItems.length;
      for (const qt of activeQuestionTypesForSource) {
        const cap =
          qt === 'verb_conjugation'
            ? finalVerbs.length * 6
            : qt === 'verb_sentence'
            ? finalVerbs.length
            : wordStageCap;
        const c = resolveStageQuestionCount(qt, finalVocabItems.length, questionTypeCounts, finalVerbs.length);
        if (c > 0 && c < cap) {
          sanitizedCounts[qt] = c;
        }
      }
      const totalQ = calculateTotalHomeworkQuestions(
        finalVocabItems.length,
        activeQuestionTypesForSource,
        sanitizedCounts,
        finalVerbs.length
      );
      const generatedId = createHomeworkAssignmentId();

      const assignedStudentsList = isGroupMode
        ? activeSelectedGroupStudents.map((s) => ({
            id: s.id,
            name: s.name,
            ...((s as any).code ? { code: (s as any).code } : {}),
            groupId: selectedGroupId
          }))
        : undefined;

      const selectedGroupTitles = selectedVerbGroupIds
        .map((gid) => allVerbGroups.find((g) => g.id === gid)?.titleAr || '')
        .filter(Boolean)
        .slice(0, 2)
        .join(' + ');

      const defaultTitle =
        contentSource === 'verb'
          ? `واجب أفعال: ${selectedGroupTitles || `${finalVerbs.length} فعل`}`
          : contentSource === 'mixed'
          ? `واجب مختلط: ${currentSet?.title || ''} + أفعال`
          : `واجب: ${currentSet?.title || ''}`;

      const immutableVerbSnapshot: VerbEntry[] | undefined =
        finalVerbs.length > 0 ? JSON.parse(JSON.stringify(finalVerbs)) : undefined;

      const payload: HomeworkAssignment = {
        id: generatedId,
        shortId: createHomeworkShortId(7),
        shareToken: createHomeworkShareToken(),
        ...(resolvedOwnerUid ? { ownerUid: resolvedOwnerUid } : {}),
        ...(resolvedOwnerEmail ? { ownerEmail: resolvedOwnerEmail } : {}),
        title: title.trim() || defaultTitle,
        contentSource,
        ...(selectedVerbGroupIds.length > 0 ? { selectedVerbGroupIds: [...selectedVerbGroupIds] } : {}),
        ...(finalVerbs.length > 0 ? { selectedVerbIds: finalVerbs.map((v) => v.id) } : {}),
        ...(immutableVerbSnapshot ? { verbSnapshot: immutableVerbSnapshot } : {}),
        ...(contentSource !== 'vocab' ? { verbSubjectPoolMode } : {}),
        setSnapshot: {
          id:
            contentSource === 'verb'
              ? selectedVerbGroupIds[0] || 'verb_library_custom'
              : currentSet?.id || 'vocab_set',
          title:
            contentSource === 'verb'
              ? selectedGroupTitles || `أفعال (${finalVerbs.length})`
              : currentSet?.title || 'تدريب',
          category: contentSource === 'verb' ? 'Verben' : (currentSet as any)?.category || currentSet?.topic || '',
          ...(contentSource === 'verb'
            ? { setKind: 'verb_group', verbIds: finalVerbs.map((v) => v.id) }
            : contentSource === 'mixed'
            ? { setKind: 'mixed', verbIds: finalVerbs.map((v) => v.id) }
            : {}),
          items: finalItems
        },
        selectedItemIds: finalItems.map((it) => it.id),
        flowMode,
        questionTypes: activeQuestionTypesForSource,
        ...(Object.keys(sanitizedCounts).length > 0 ? { questionTypeCounts: sanitizedCounts } : {}),
        blooketMode,
        allowedGameModes: [blooketMode],
        questionCount: totalQ,
        targetQuestionCount: totalQ,
        audienceMode,
        groupId: isGroupMode ? selectedGroupId : undefined,
        groupName: isGroupMode && targetGroup ? targetGroup.name : undefined,
        assignedStudents: isGroupMode ? assignedStudentsList : undefined,
        deadline: hasDeadline && deadlineDate ? new Date(deadlineDate).toISOString() : undefined,
        maxAttempts,
        allowReplay: maxAttempts !== 1,
        hideTeacherBranding,
        isActive: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: 'Teacher'
      };

      // Ensure both the vocabulary set (when used) and the homework assignment are synced to Firestore in parallel
      const [, confirmRes] = await Promise.all([
        contentSource !== 'verb' && currentSet
          ? saveLernstudioSetToFirestore(currentSet).catch(() => false)
          : Promise.resolve(true),
        saveAssignmentWithConfirmation(payload)
      ]);
      // Only fall back to HTTP server endpoint if direct Firestore confirmation did not complete
      const serverAssignment = confirmRes.cloudSynced
        ? null
        : await persistHomeworkAssignmentToServer(confirmRes.assignment).catch(() => null);
      const isCloudSynced = Boolean(confirmRes.cloudSynced || serverAssignment?.id);

      const finalAssignment: HomeworkAssignment = {
        ...confirmRes.assignment,
        ...(serverAssignment || {}),
        id: payload.id,
        shortId: confirmRes.assignment.shortId || serverAssignment?.shortId || payload.shortId,
        ...(serverAssignment?.ownerUid || resolvedOwnerUid
          ? { ownerUid: serverAssignment?.ownerUid || resolvedOwnerUid }
          : {}),
        audienceMode,
        hideTeacherBranding,
        cloudSynced: isCloudSynced,
        cloudCreatePending: !isCloudSynced
      };

      saveLocalAssignment(finalAssignment, false);
      window.dispatchEvent(new CustomEvent('glueck-homework-sync-updated'));
      setAssignmentsList((prev) => [
        {
          ...finalAssignment,
          status: 'active',
          submissionCount: 0,
          completedStudentsCount: 0,
          inProgressStudentsCount: 0,
          assignedStudentsCount: isGroupMode ? (assignedStudentsList?.length || 0) : 0,
          avgAccuracy: 0,
          avgScore: 0,
          recentSubmissions: []
        },
        ...prev.filter((a) => a.id !== finalAssignment.id)
      ]);
      setCreatedCloudSynced(isCloudSynced);
      setCreatedAssignment(finalAssignment);
      setCreatedShareLink(buildHomeworkShareUrl(finalAssignment, vercelDomain));
      setPendingSyncCount(getPendingHomeworkSyncCount());

      if (onAssignmentConfirmed) {
        onAssignmentConfirmed(finalAssignment);
      }

      if (autoCloseOnCreate) {
        loadAllAssignments().catch(() => {});
        onClose();
        return;
      }

      await loadAllAssignments().catch(() => {});
      const refreshedLocal = getLocalAssignments().find((a) => a.id === finalAssignment.id);
      if (refreshedLocal?.cloudSynced) {
        setCreatedCloudSynced(true);
      }
    } catch (err: any) {
      setCreateError(err?.message || 'حدث خطأ غير متوقع أثناء إنشاء الواجب.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (linkText: string, idKey: string) => {
    navigator.clipboard.writeText(linkText);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleOpenDetails = async (hwId: string, fallbackHw?: HomeworkAssignment | null) => {
    setActiveTab('results');
    setInspectingSubmission(null);
    setInspectingStudentAttempts([]);
    setStudentStatusFilter('all');

    const matchedHw =
      fallbackHw ||
      assignmentsList.find((a) => a.id === hwId) ||
      (selectedDetails?.assignment?.id === hwId ? selectedDetails.assignment : null);

    // 1. Open details view immediately using local data so the button responds in 0ms
    const instantDetails = getLocalAssignmentDetails(hwId, studentsRef.current, matchedHw);
    if (instantDetails) {
      setSelectedDetails(instantDetails);
    }
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 2. Refresh from cloud in the background with bounded timeout
    setLoadingDetails(true);
    try {
      const details = await fetchAssignmentDetailsWithSync(hwId, studentsRef.current, matchedHw);
      if (details) {
        setSelectedDetails(details);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleInspectStudent = (studentRow: any) => {
    const attempts: HomeworkSubmission[] = Array.isArray(studentRow.attempts) ? studentRow.attempts : [];
    if (attempts.length === 0) return;
    setInspectingStudentAttempts(attempts);
    setInspectingSubmission(attempts[0]);
  };

  const handleInspectSingleSubmission = (sub: HomeworkSubmission) => {
    if (selectedDetails?.studentStatusSummary) {
      const matchedStudent = selectedDetails.studentStatusSummary.find((st: any) => {
        if (sub.studentId && st.studentId === sub.studentId) return true;
        if (sub.participantId && st.participantId === sub.participantId) return true;
        if (!sub.studentId && !sub.participantId) {
          return (st.studentName || '').trim().toLowerCase() === (sub.studentName || '').trim().toLowerCase();
        }
        return false;
      });
      if (matchedStudent && Array.isArray(matchedStudent.attempts) && matchedStudent.attempts.length > 0) {
        setInspectingStudentAttempts(matchedStudent.attempts);
      } else {
        setInspectingStudentAttempts([sub]);
      }
    } else {
      setInspectingStudentAttempts([sub]);
    }
    setInspectingSubmission(sub);
  };

  const handleDeleteAssignment = async () => {
    if (!deleteConfirmHw) return;
    setIsDeleting(true);
    try {
      const targetId = deleteConfirmHw.id;
      const idToken = await auth?.currentUser?.getIdToken().catch(() => null);
      if (idToken) {
        await fetch(`/api/teacher/assignments?id=${encodeURIComponent(targetId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
          credentials: 'include'
        }).catch(() => null);
      }
      deleteLocalAssignment(targetId, true);
      setAssignmentsList((prev) => prev.filter((a) => a.id !== targetId));
      if (selectedDetails?.assignment?.id === targetId) {
        setSelectedDetails(null);
      }
      setPendingSyncCount(getPendingHomeworkSyncCount());
    } catch (error: any) {
      console.error('Failed to delete assignment:', error);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmHw(null);
    }
  };

  const handleToggleAssignmentActive = async (hw: HomeworkAssignment) => {
    if (!hw?.id || togglingActiveId) return;
    const isCurrentlyClosed = hw.isActive === false || hw.status === 'closed';
    const nextActive = isCurrentlyClosed;
    setTogglingActiveId(hw.id);
    try {
      const res = await setHomeworkAssignmentActiveStatus(hw.id, nextActive);
      if (res.assignment) {
        setAssignmentsList((prev) =>
          prev.map((item) =>
            item.id === hw.id
              ? {
                  ...item,
                  ...res.assignment,
                  isActive: nextActive,
                  status: nextActive ? 'active' : 'closed',
                  cloudSynced: res.cloudSynced
                }
              : item
          )
        );
        if (selectedDetails?.assignment?.id === hw.id) {
          setSelectedDetails((prev: any) =>
            prev
              ? {
                  ...prev,
                  assignment: {
                    ...prev.assignment,
                    ...res.assignment,
                    isActive: nextActive,
                    status: nextActive ? 'active' : 'closed',
                    cloudSynced: res.cloudSynced
                  }
                }
              : prev
          );
        }
      }
      setPendingSyncCount(getPendingHomeworkSyncCount());
    } finally {
      setTogglingActiveId(null);
    }
  };

  const handleOpenEditAssignment = (hw: HomeworkAssignment) => {
    if (!hw) return;
    setEditingHw(hw);
    setEditHwTitle(hw.title || '');
    setEditHwMaxAttempts(typeof hw.maxAttempts === 'number' ? hw.maxAttempts : 0);
    setEditHwHideBranding(Boolean(hw.hideTeacherBranding));
  };

  const handleSaveEditAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHw) return;
    setIsSavingHwEdit(true);
    try {
      const res = await updateHomeworkAssignmentMetadata(editingHw.id, {
        title: editHwTitle.trim() || editingHw.title,
        maxAttempts: editHwMaxAttempts,
        allowReplay: editHwMaxAttempts !== 1,
        hideTeacherBranding: editHwHideBranding
      });
      if (res.assignment) {
        setAssignmentsList((prev) =>
          prev.map((item) =>
            item.id === editingHw.id
              ? {
                  ...item,
                  ...res.assignment,
                  cloudSynced: res.cloudSynced
                }
              : item
          )
        );
        if (selectedDetails?.assignment?.id === editingHw.id) {
          setSelectedDetails((prev: any) =>
            prev
              ? {
                  ...prev,
                  assignment: {
                    ...prev.assignment,
                    ...res.assignment,
                    cloudSynced: res.cloudSynced
                  }
                }
              : prev
          );
        }
      }
      setPendingSyncCount(getPendingHomeworkSyncCount());
      setEditingHw(null);
    } finally {
      setIsSavingHwEdit(false);
    }
  };

  const filteredAssignments = useMemo(() => {
    const visibleAssignments = assignmentsList.filter((a) =>
      a?.deleted !== true && a?.status !== 'deleted'
    );
    if (filterGroup === 'all') return visibleAssignments;
    if (filterGroup === 'open_only') {
      return visibleAssignments.filter((a) => resolveAssignmentAudienceMode(a) === 'open');
    }
    return visibleAssignments.filter(
      (a) => resolveAssignmentAudienceMode(a) === 'group' && a.groupId === filterGroup
    );
  }, [assignmentsList, filterGroup]);

  const filteredStudentRows = useMemo(() => {
    const rows: any[] = selectedDetails?.studentStatusSummary || [];
    if (studentStatusFilter === 'all') return rows;
    return rows.filter((r) => r.status === studentStatusFilter);
  }, [selectedDetails?.studentStatusSummary, studentStatusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 font-sans" dir="rtl">
      <div className="bg-surface border border-surface-border rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-text-main">
        
        {/* Header (Glück Standard - Mobile Responsive) */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface">
          <div className="flex items-center justify-between gap-2.5 w-full sm:w-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-bold text-text-main truncate">
                  واجبات وتدريبات الطلاب التفاعلية
                </h2>
                <p className="text-[10px] sm:text-[11px] text-text-muted hidden sm:block">
                  إنشاء روابط التدريب، ومتابعة إجابات ومحاولات الطلاب لحظياً عبر السحابة
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="sm:hidden p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="grid grid-cols-2 gap-1 bg-surface-hover p-1 rounded-lg border border-surface-border w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('create');
                  setSelectedDetails(null);
                  setCreatedShareLink(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إنشاء واجب</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('results');
                  loadAllAssignments();
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'results'
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="truncate">متابعة الواجبات ({assignmentsList.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="hidden sm:flex p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unauthenticated Cloud Sync Warning Banner */}
        {!activeAuthUid && (
          <div className="px-4 py-2.5 bg-rose-500/10 border-b border-rose-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-bold">
              <CloudOff className="w-4 h-4 shrink-0" />
              <span>أنت غير مسجل الدخول حالياً بحساب Google؛ لن يتم رفع الواجبات للسحابة أو استقبال حلول الطلاب حتى تسجل الدخول.</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await signInTeacherWithGoogle();
                  await handleFlushPendingSync();
                } catch {
                  // Ignore sign-in popup cancellation
                }
              }}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>تسجيل الدخول بحساب Google وتفعيل المزامنة</span>
            </button>
          </div>
        )}

        {/* Pending Cloud Sync Banner (distinguishes local-only data from confirmed cloud data) */}
        {activeAuthUid && pendingSyncCount > 0 && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold">
              <CloudOff className="w-3.5 h-3.5 shrink-0" />
              <span>يوجد {pendingSyncCount} عنصر محفوظ محلياً بانتظار المزامنة السحابية مع Firestore</span>
            </div>
            <button
              type="button"
              disabled={flushingPending}
              onClick={handleFlushPendingSync}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${flushingPending ? 'animate-spin' : ''}`} />
              <span>{flushingPending ? 'جاري المزامنة...' : 'إعادة محاولة المزامنة'}</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div ref={modalBodyRef} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {activeTab === 'create' ? (
            !createdShareLink ? (
              /* ================= CREATE HOMEWORK FORM ================= */
              <form onSubmit={handleCreate} className="space-y-4">
                
                {createError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-2">
                    <span>⚠️ {createError}</span>
                    <button
                      type="button"
                      onClick={() => setCreateError(null)}
                      className="text-rose-500 hover:underline text-[11px] cursor-pointer shrink-0"
                    >
                      إغلاق
                    </button>
                  </div>
                )}

                {/* 0. Unified Content Source Switcher (Vocab | Verbs A1–B1 | Mixed) */}
                <div className="p-2.5 rounded-xl bg-surface-hover/70 border border-surface-border space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span>مصدر محتوى الواجب:</span>
                    </label>
                    <span className="text-[10px] font-bold text-text-muted">
                      مكتبة الأفعال الموحدة: {ALL_VERBS.length} فعل (A1–B1)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 bg-surface p-1 rounded-xl border border-surface-border">
                    {[
                      { id: 'vocab' as HomeworkContentSource, label: '📚 مجموعات الكلمات' },
                      { id: 'verb' as HomeworkContentSource, label: '🔤 مكتبة الأفعال A1–B1' },
                      { id: 'mixed' as HomeworkContentSource, label: '🔀 مختلط (كلمات + أفعال)' }
                    ].map((src) => (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => switchContentSource(src.id)}
                        className={`py-2 px-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                          contentSource === src.id
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                        }`}
                      >
                        {src.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1. Vocabulary Set (when vocab/mixed) & Audience Mode Selection Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {contentSource !== 'verb' ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                          <span>📚</span>
                          <span>مجموعة الكلمات المفتاحية:</span>
                        </label>
                        {vocabSetSearchQuery.trim() && (
                          <span className="text-[10.5px] font-bold text-primary tabular-nums">
                            {filteredVocabSets.length > 0
                              ? `${filteredVocabSets.length} نتيجة من ${vocabSets.length}`
                              : 'لا توجد نتائج مطابقة'}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={vocabSetSearchQuery}
                          onChange={(e) => {
                            const nextQuery = e.target.value;
                            setVocabSetSearchQuery(nextQuery);
                            const nextFiltered = filterLernstudioSetsByQuery(vocabSets, nextQuery);
                            if (
                              nextFiltered.length > 0 &&
                              !nextFiltered.some((s) => s.id === selectedSetId)
                            ) {
                              setSelectedSetId(nextFiltered[0].id);
                            }
                          }}
                          placeholder="ابحث عن مجموعة كلمات (بالاسم، الصف، المعلم، أو كلمة)..."
                          className="w-full pr-8 pl-7 py-1.5 bg-surface border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                        />
                        {vocabSetSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setVocabSetSearchQuery('')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0.5 cursor-pointer"
                            title="مسح البحث"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <select
                        value={selectedSetId}
                        onChange={(e) => setSelectedSetId(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                      >
                        {filteredVocabSets.length === 0 ? (
                          <option value="" disabled>
                            -- لا توجد مجموعات تطابق البحث --
                          </option>
                        ) : (
                          filteredVocabSets.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title} ({s.items?.length || 0} كلمة)
                              {s.createdByTeacherName ? ` — أ. ${s.createdByTeacherName}` : ''}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                        <span>ضمائر وأسماء التصريف:</span>
                      </label>
                      <select
                        value={verbSubjectPoolMode}
                        onChange={(e) => setVerbSubjectPoolMode(e.target.value as any)}
                        className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="pronouns_and_names">الضمائر بتوضيح عربي + أسماء ومركّبات (Ahmed / Mona / Ahmed und ich)</option>
                        <option value="pronouns_only">الضمائر الشخصية فقط بتوضيح عربي (ich / du / er / sie / Sie...)</option>
                      </select>
                    </div>
                  )}

                  {/* Select Homework Audience Mode */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span>من يمكنه فتح وحل الواجب؟</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-surface-hover rounded-xl border border-surface-border">
                      <button
                        type="button"
                        onClick={() => {
                          setAudienceMode('open');
                          setCreateError(null);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          audienceMode === 'open'
                            ? 'bg-surface text-primary shadow-xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        <span>مفتوح لأي اسم</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAudienceMode('group');
                          setCreateError(null);
                          if (!selectedGroupId && groups.length > 0) {
                            setSelectedGroupId(groups[0].id);
                          }
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          audienceMode === 'group'
                            ? 'bg-surface text-primary shadow-xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span>جروب معين</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subject pool selector for Mixed mode too */}
                {contentSource === 'mixed' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span>ضمائر وأسماء أسئلة تصريف الأفعال:</span>
                    </label>
                    <select
                      value={verbSubjectPoolMode}
                      onChange={(e) => setVerbSubjectPoolMode(e.target.value as any)}
                      className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="pronouns_and_names">الضمائر بتوضيح عربي + أسماء ومركّبات (Ahmed / Mona / Ahmed und ich)</option>
                      <option value="pronouns_only">الضمائر الشخصية فقط بتوضيح عربي (ich / du / er / sie / Sie...)</option>
                    </select>
                  </div>
                )}

                {/* Unified Verb Library Group & Verb Picker (shown for 'verb' & 'mixed') */}
                {contentSource !== 'vocab' && (
                  <div className="p-3 rounded-xl bg-surface-hover/70 border border-surface-border space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <span className="text-xs font-black text-text-main">
                          مجموعات الأفعال واختيار الأفعال ({resolvedSelectedVerbs.length} فعل محدد)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { id: 'cefr' as const, label: 'المستويات (3)' },
                          { id: 'grammar' as const, label: 'القواعد (6)' },
                          { id: 'topic' as const, label: 'الموضوعات (14)' },
                          { id: 'custom' as const, label: `مخصصة (${customVerbGroups.length})` },
                          { id: 'all' as const, label: 'الكل' }
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setVerbGroupCategoryFilter(tab.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              verbGroupCategoryFilter === tab.id
                                ? 'bg-primary text-white'
                                : 'bg-surface border border-surface-border text-text-muted hover:text-text-main'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Built-in & Custom Verb Group Chips */}
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-surface rounded-xl border border-surface-border">
                      {allVerbGroups
                        .filter((g) => verbGroupCategoryFilter === 'all' || g.category === verbGroupCategoryFilter)
                        .map((g) => {
                          const isSelected = selectedVerbGroupIds.includes(g.id);
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => toggleVerbGroupSelection(g)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-primary text-white border-primary shadow-2xs'
                                  : 'bg-surface-hover text-text-main border-surface-border hover:border-primary/40'
                              }`}
                            >
                              <span>{g.titleDe}</span>
                              <span className="text-[10px] opacity-80">({g.verbIds.length})</span>
                              {g.createdByTeacherName && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
                                  أ. {g.createdByTeacherName}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      {verbGroupCategoryFilter === 'custom' && customVerbGroups.length === 0 && (
                        <span className="text-[11px] text-text-muted p-1">
                          لا توجد مجموعات مخصصة بعد — اختر مجموعة أو أفعالاً أدناه واحفظها كمجموعة مشتركة للمعلمين.
                        </span>
                      )}
                    </div>

                    {/* Search & Quick Selection Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={verbSearchQuery}
                          onChange={(e) => setVerbSearchQuery(e.target.value)}
                          placeholder="ابحث عن فعل بالألماني أو العربي (مثال: aufstehen، يعمل، mit)..."
                          className="w-full pr-8 pl-3 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        {(['all', 'A1', 'A2', 'B1'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setVerbLevelFilter(lvl)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer border ${
                              verbLevelFilter === lvl
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface border-surface-border text-text-muted'
                            }`}
                          >
                            {lvl === 'all' ? 'كل المستويات' : lvl}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedVerbIds(filteredBrowseVerbs.slice(0, 20).map((v) => v.id))}
                          className="px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold cursor-pointer"
                        >
                          أول 20 فعل
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedVerbIds(filteredBrowseVerbs.slice(0, 10).map((v) => v.id))}
                          className="px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold cursor-pointer"
                        >
                          أول 10
                        </button>
                        {resolvedSelectedVerbs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVerbGroupIds([]);
                              setSelectedVerbIds([]);
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 text-[10px] font-bold cursor-pointer"
                          >
                            مسح ({resolvedSelectedVerbs.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Verb Selection Pills (capped display 80 for fast UI) */}
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-surface rounded-xl border border-surface-border">
                      {filteredBrowseVerbs.slice(0, 80).map((v) => {
                        const isChecked = resolvedSelectedVerbs.some((sv) => sv.id === v.id);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => toggleSingleVerbId(v.id)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              isChecked
                                ? 'bg-primary text-white'
                                : 'bg-surface-hover text-text-main border border-surface-border hover:border-primary/40'
                            }`}
                          >
                            <span dir="ltr">{v.infinitive}</span>
                            <span className="text-[10px] opacity-80">({v.arabic})</span>
                            <span className="text-[9px] opacity-70">{v.level}</span>
                          </button>
                        );
                      })}
                      {filteredBrowseVerbs.length > 80 && (
                        <span className="text-[10px] text-text-muted self-center px-2">
                          +{filteredBrowseVerbs.length - 80} فعل آخر (استخدم البحث أو الفلتر)
                        </span>
                      )}
                    </div>

                    {/* Save selection as shared Custom Teacher Verb Group */}
                    {resolvedSelectedVerbs.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-border">
                        <input
                          type="text"
                          value={newVerbGroupTitle}
                          onChange={(e) => setNewVerbGroupTitle(e.target.value)}
                          placeholder="اسم مجموعة مخصصة لحفظ هذه الأفعال لكل المعلمين..."
                          className="flex-1 min-w-[160px] px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-[11px] font-semibold outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          type="text"
                          value={newVerbGroupTeacherName}
                          onChange={(e) => setNewVerbGroupTeacherName(e.target.value)}
                          placeholder="اسم المعلم (اختياري)"
                          className="w-36 px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-[11px] font-semibold outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          disabled={!newVerbGroupTitle.trim()}
                          onClick={handleSaveInlineCustomVerbGroup}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer shrink-0"
                        >
                          + حفظ كمجموعة مشتركة
                        </button>
                        {verbGroupSaveSuccess && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ {verbGroupSaveSuccess}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Conditional Group Selection when audienceMode === 'group' */}
                {audienceMode === 'group' ? (
                  <div className="p-3 rounded-xl bg-surface-hover/70 border border-surface-border space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-primary" />
                        <span>اختر المجموعة المستهدفة:</span>
                      </label>
                      <span className="text-[11px] font-bold text-primary tabular-nums">
                        طلاب المجموعة النشطون: {activeSelectedGroupStudents.length} طالب
                      </span>
                    </div>
                    {groups.length === 0 ? (
                      <p className="text-xs text-rose-500 font-semibold">
                        لا توجد مجموعات مسجلة حالياً. أنشئ مجموعة أولاً أو اختر «مفتوح لأي اسم».
                      </p>
                    ) : (
                      <select
                        value={selectedGroupId}
                        onChange={(e) => {
                          setSelectedGroupId(e.target.value);
                          setCreateError(null);
                        }}
                        className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                      >
                        {groups.map((g) => {
                          const groupCount = students.filter(
                            (st) => !st.deleted && st.status !== 'archived' && st.groupId === g.id
                          ).length;
                          return (
                            <option key={g.id} value={g.id}>
                              🏫 {g.name} ({groupCount} طالب)
                            </option>
                          );
                        })}
                      </select>
                    )}
                    <p className="text-[11px] text-text-muted">
                      سيظهر لطلاب هذه المجموعة فقط أسماؤهم المسجلة لاختيار اسمهم، ولن يظهر أي طالب من المجموعات الأخرى.
                    </p>
                  </div>
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-surface-hover/50 border border-surface-border text-[11px] text-text-muted flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>
                      وضع <strong className="text-text-main">مفتوح لأي اسم</strong>: يكتب الطالب أو المشارك اسمه مباشرة عند فتح الرابط دون إظهار قائمة طلابك المسجلين.
                    </span>
                  </div>
                )}

                {/* 2. Custom Title & Max Attempts Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <span>✏️</span>
                      <span>عنوان الواجب (اختياري):</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        contentSource === 'verb'
                          ? 'مثال: واجب تصريف الأفعال A1'
                          : `مثال: واجب ${currentSet?.title || 'الألماني'}`
                      }
                      className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      <span>عدد المحاولات للطالب:</span>
                    </label>
                    <select
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value={0}>♾️ مفتوح (تحسين الدرجة)</option>
                      <option value={1}>1️⃣ محاولة واحدة فقط</option>
                      <option value={2}>2️⃣ محاولتان كحد أقصى</option>
                      <option value={3}>3️⃣ 3 محاولات كحد أقصى</option>
                    </select>
                  </div>
                </div>

                {/* Compact Per-Homework Hide Teacher Branding Toggle */}
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface-hover/70 border border-surface-border">
                  <label
                    htmlFor="hw-hide-teacher-branding-toggle"
                    className="text-xs font-bold text-text-main cursor-pointer select-none"
                  >
                    إخفاء اللوجو واسم المدرس
                  </label>
                  <button
                    id="hw-hide-teacher-branding-toggle"
                    type="button"
                    role="switch"
                    aria-checked={hideTeacherBranding}
                    onClick={() => setHideTeacherBranding((prev) => !prev)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      hideTeacherBranding ? 'bg-primary' : 'bg-surface-border'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                        hideTeacherBranding ? '-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 3. Progressive Stages Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-main">
                      مراحل التدريب المتدرجة في رابط الواجب ({activeQuestionTypesForSource.length} من {activeQuestionMetaList.length}):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeQuestionTypesForSource.length === activeQuestionMetaList.length) {
                          setQuestionTypes([activeQuestionMetaList[0].id]);
                        } else {
                          setQuestionTypes(activeQuestionMetaList.map((m) => m.id));
                        }
                      }}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      {activeQuestionTypesForSource.length === activeQuestionMetaList.length ? 'مرحلة واحدة فقط' : 'تحديد كل المراحل'}
                    </button>
                  </div>

                  {/* Quick Per-Stage Question Count Preset Bar */}
                  {(effectiveWordStageCount > 1 || effectiveVerbCount > 0) && (
                    <div className="p-2.5 rounded-xl bg-surface-hover border border-surface-border flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                        <span>🎯 عدد الأسئلة لكل نوع (اختياري للتقليل):</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {[3, 5, 10, 20, 30]
                          .filter((n) => n < Math.max(effectiveWordStageCount, effectiveVerbCount * 6))
                          .map((preset) => {
                            const allActiveMatchPreset =
                              activeQuestionTypesForSource.length > 0 &&
                              activeQuestionTypesForSource.every((qt) => getStageQuestionCount(qt) === Math.min(getStageMaxCount(qt), preset));
                            return (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setAllStagesQuestionCount(preset)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                                  allActiveMatchPreset
                                    ? 'bg-primary text-white shadow-2xs'
                                    : 'bg-surface border border-surface-border text-text-muted hover:text-text-main'
                                }`}
                              >
                                {preset} أسئلة
                              </button>
                            );
                          })}
                        <button
                          type="button"
                          onClick={() => setAllStagesQuestionCount('all')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                            !hasCustomStageCounts
                              ? 'bg-primary text-white shadow-2xs'
                              : 'bg-surface border border-surface-border text-text-muted hover:text-text-main'
                          }`}
                        >
                          الكل ({fullMaxQuestions})
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeQuestionMetaList.map((meta, idx) => {
                      const active = activeQuestionTypesForSource.includes(meta.id);
                      const stageMax = getStageMaxCount(meta.id);
                      const stageCount = getStageQuestionCount(meta.id);
                      const isReduced = active && stageCount < stageMax;
                      return (
                        <div
                          key={meta.id}
                          onClick={() => toggleQuestionType(meta.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleQuestionType(meta.id);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer select-none overflow-hidden min-w-0 ${
                            active
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold truncate">
                                {meta.badgeEmoji} {idx + 1}. {meta.labelAr}
                              </div>
                              <div className="text-[10px] text-text-muted truncate">
                                {meta.descAr}
                              </div>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                active ? 'bg-primary text-white' : 'border border-surface-border'
                              }`}
                            >
                              {active ? '✓' : ''}
                            </div>
                          </div>

                          {/* Per-Type Question Count Selector inside each active card */}
                          {active && stageMax > 1 && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="pt-1.5 mt-0.5 border-t border-primary/20 flex flex-wrap items-center justify-between gap-1 min-w-0 w-full overflow-hidden"
                            >
                              <span className="text-[10px] font-bold text-text-muted shrink-0">
                                الأسئلة (حد أقصى {stageMax}):
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={stageCount <= 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSingleStageQuestionCount(meta.id, stageCount - 1);
                                  }}
                                  className="w-5 h-5 rounded-md bg-surface border border-surface-border text-text-main flex items-center justify-center text-xs font-black hover:bg-primary hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer shrink-0 transition-colors"
                                  title="تقليل عدد أسئلة هذا النوع"
                                >
                                  −
                                </button>
                                {stageMax <= 40 ? (
                                  <select
                                    value={stageCount}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setSingleStageQuestionCount(meta.id, Number(e.target.value));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`px-1 py-0.5 rounded-md text-[10px] font-black outline-none cursor-pointer border max-w-[58px] shrink-0 text-center ${
                                      isReduced
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                                        : 'bg-surface border-surface-border text-primary'
                                    }`}
                                    title="اختر عدد الأسئلة لهذا النوع"
                                  >
                                    {Array.from({ length: stageMax }, (_, i) => i + 1).map((num) => (
                                      <option key={num} value={num}>
                                        {num === stageMax ? `${num} (الكل)` : `${num}`}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="number"
                                    min={1}
                                    max={stageMax}
                                    value={stageCount}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setSingleStageQuestionCount(meta.id, Number(e.target.value) || 1);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-14 px-1 py-0.5 rounded-md text-[10px] font-black outline-none border text-center ${
                                      isReduced
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                                        : 'bg-surface border-surface-border text-primary'
                                    }`}
                                  />
                                )}
                                <button
                                  type="button"
                                  disabled={stageCount >= stageMax}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSingleStageQuestionCount(meta.id, stageCount + 1);
                                  }}
                                  className="w-5 h-5 rounded-md bg-surface border border-surface-border text-text-main flex items-center justify-center text-xs font-black hover:bg-primary hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer shrink-0 transition-colors"
                                  title="زيادة عدد أسئلة هذا النوع"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Words Selector Pills (only when vocab or mixed is active) */}
                {contentSource !== 'verb' && currentSet?.items && currentSet.items.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-text-main">
                        الكلمات المتضمنة بالواجب ({selectedItemIds.length} من {currentSet.items.length}):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedItemIds.length === currentSet.items.length) {
                            setSelectedItemIds([currentSet.items[0].id]);
                          } else {
                            setSelectedItemIds(currentSet.items.map((i) => i.id));
                          }
                        }}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        {selectedItemIds.length === currentSet.items.length ? 'إلغاء التحديد' : 'تحديد الكل'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-surface-hover rounded-xl border border-surface-border">
                      {currentSet.items.map((it) => {
                        const active = selectedItemIds.includes(it.id);
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => toggleWordItem(it.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              active
                                ? 'bg-primary text-white'
                                : 'bg-surface text-text-muted border border-surface-border'
                            }`}
                          >
                            <span>{it.german}</span>
                            <span className="text-[10px] opacity-75">({it.arabic})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Submit Action Banner */}
                <div className="bg-surface-hover border border-surface-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-text-main">
                      الأسئلة الإجمالية:{' '}
                      <span className="text-primary font-black">
                        {totalConfiguredQuestions} سؤال
                      </span>{' '}
                      {hasCustomStageCounts ? (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                          (مُخفّضة من {fullMaxQuestions} سؤال عبر {activeQuestionTypesForSource.length} مراحل)
                        </span>
                      ) : contentSource === 'verb' ? (
                        <span>
                          ({effectiveVerbCount} فعل عبر {activeQuestionTypesForSource.length} مراحل)
                        </span>
                      ) : contentSource === 'mixed' ? (
                        <span>
                          ({selectedItemIds.length} كلمة + {effectiveVerbCount} فعل عبر {activeQuestionTypesForSource.length} مراحل)
                        </span>
                      ) : (
                        <span>
                          ({selectedItemIds.length} كلمة × {activeQuestionTypesForSource.length} مراحل)
                        </span>
                      )}
                    </div>
                    {hasCustomStageCounts && (
                      <div className="text-[10px] text-text-muted flex flex-wrap items-center gap-1.5">
                        <span>تم تخصيص عدد الأسئلة لبعض المراحل</span>
                        <button
                          type="button"
                          onClick={() => setAllStagesQuestionCount('all')}
                          className="text-primary font-bold hover:underline cursor-pointer"
                        >
                          (إعادة للكل: {fullMaxQuestions} سؤال)
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 text-xs cursor-pointer transition-all"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري تجهيز الواجب...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>إنشاء الواجب ورابط الطلاب</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            ) : (
              /* ================= CREATED SHARE SCREEN ================= */
              <div className="space-y-4 text-center py-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
                    createdCloudSynced
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}
                >
                  {createdCloudSynced ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <CloudOff className="w-6 h-6" />
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-text-main">
                    {createdCloudSynced
                      ? 'تم تجهيز الواجب والرابط القصير بنجاح'
                      : 'بانتظار تأكيد المزامنة السحابية لتفعيل الرابط'}
                  </h4>
                  <p className="text-xs text-text-muted">
                    {createdCloudSynced
                      ? 'انسخ الرابط القصير وأرسله للطلاب — ستظهر إجابات ومحاولات كل طالب لحظياً داخل التطبيق'
                      : 'لا يتم عرض الرابط كجاهز للمشاركة حتى يكتمل حفظه سحابياً في Firestore لضمان فتحه لدى جميع الطلاب'}
                  </p>
                  <div className="pt-1">
                    {createdCloudSynced ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                        <Cloud className="w-3 h-3" /> تمت مزامنة الرابط القصير سحابياً مع Firestore ✓
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                        <CloudOff className="w-3 h-3" /> محفوظ محلياً — اضغط تأكيد المزامنة بالأسفل لتفعيل الرابط القصير
                      </span>
                    )}
                  </div>
                </div>

                {createdCloudSynced ? (
                  <>
                    <div className="bg-surface-hover border border-surface-border rounded-xl p-2.5 flex items-center gap-2 max-w-xl mx-auto">
                      <input
                        type="text"
                        readOnly
                        dir="ltr"
                        value={createdShareLink}
                        className="bg-transparent text-text-main font-mono text-xs flex-1 outline-none truncate"
                      />
                      <button
                        onClick={() => handleCopy(createdShareLink, 'created')}
                        className="px-3 py-1.5 bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                      >
                        {copiedId === 'created' ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> تم النسخ!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> نسخ الرابط
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const groupLabel = createdAssignment?.groupName ? ` [${createdAssignment.groupName}]` : '';
                          const msg = `🇩🇪 *واجب الألماني التفاعلي (Glück Lernstudio)*${groupLabel}\n📚 *${createdAssignment?.title || 'واجب جديد'}*\n\nيرجى الضغط على الرابط التالي لبدء حل الواجب:\n${createdShareLink}`;
                          navigator.clipboard.writeText(msg);
                          setCopiedId('whatsapp_msg');
                          setTimeout(() => setCopiedId(null), 2500);
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>
                          {copiedId === 'whatsapp_msg'
                            ? 'تم نسخ رسالة واتساب! ✓'
                            : 'نسخ رسالة واتساب لولي الأمر'}
                        </span>
                      </button>

                      <a
                        href={
                          createdAssignment?.shortId
                            ? `/Herr-Abdul-rahman/${createdAssignment.shortId}`
                            : createdShareLink
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          if (createdAssignment?.shortId && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                            e.preventDefault();
                            window.history.pushState({}, '', `/Herr-Abdul-rahman/${createdAssignment.shortId}`);
                            window.dispatchEvent(new Event('glueck-route-change'));
                          }
                        }}
                        className="px-3.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-primary" /> فتح الواجب تجريبياً
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="max-w-md mx-auto bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-text-muted leading-relaxed">
                      تم حفظ الواجب على جهازك، ولكن لم يتم تأكيد رفعه إلى Firestore بعد. يرجى التأكد من اتصالك بالإنترنت والضغط على الزر أدناه لتفعيل الرابط القصير قبل إرساله للطلاب.
                    </p>
                    <button
                      type="button"
                      disabled={flushingPending}
                      onClick={async () => {
                        if (!createdAssignment) return;
                        setFlushingPending(true);
                        try {
                          const retryRes = await saveAssignmentWithConfirmation(createdAssignment);
                          const serverHw = await persistHomeworkAssignmentToServer(retryRes.assignment).catch(() => null);
                          const synced = Boolean(retryRes.cloudSynced || serverHw?.id);
                          const updatedHw: HomeworkAssignment = {
                            ...retryRes.assignment,
                            ...(serverHw || {}),
                            cloudSynced: synced,
                            cloudCreatePending: !synced
                          };
                          saveLocalAssignment(updatedHw, false);
                          setCreatedAssignment(updatedHw);
                          setCreatedCloudSynced(synced);
                          setCreatedShareLink(buildHomeworkShareUrl(updatedHw, vercelDomain));
                          setPendingSyncCount(getPendingHomeworkSyncCount());
                        } finally {
                          setFlushingPending(false);
                        }
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${flushingPending ? 'animate-spin' : ''}`} />
                      <span>{flushingPending ? 'جاري تأكيد الحفظ السحابي...' : 'تأكيد الحفظ السحابي وتفعيل الرابط القصير'}</span>
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('results');
                      if (createdAssignment) {
                        handleOpenDetails(createdAssignment.id, createdAssignment);
                      } else {
                        loadAllAssignments();
                      }
                    }}
                    className="px-3.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-primary" /> متابعة طلاب هذا الواجب
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreatedShareLink(null);
                      setCreatedAssignment(null);
                      setHideTeacherBranding(false);
                    }}
                    className="px-3 py-2 text-text-muted hover:text-text-main hover:bg-surface-hover text-xs font-medium rounded-xl cursor-pointer"
                  >
                    + إنشاء واجب آخر
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ================= TAB 2: HOMEWORK MONITORING & MANAGEMENT ================= */
            <div className="space-y-4">
              
              {selectedDetails ? (
                /* ================= ASSIGNMENT DETAILED MONITORING VIEW ================= */
                <div className="space-y-3.5">
                  {/* Top Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-surface-border">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDetails(null);
                        setInspectingSubmission(null);
                        setInspectingStudentAttempts([]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>العودة لكل الواجبات</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(selectedDetails.assignment.id, selectedDetails.assignment)}
                        className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingDetails ? 'animate-spin' : ''}`} />
                        <span>تحديث</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(buildHomeworkShareUrl(selectedDetails.assignment, vercelDomain), selectedDetails.assignment.id)
                        }
                        className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedId === selectedDetails.assignment.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" /> تم نسخ الرابط
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> نسخ الرابط
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditAssignment(selectedDetails.assignment)}
                        className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        title="تعديل عنوان وإعدادات الواجب"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-primary" />
                        <span>تعديل</span>
                      </button>

                      <button
                        type="button"
                        disabled={togglingActiveId === selectedDetails.assignment.id}
                        onClick={() => handleToggleAssignmentActive(selectedDetails.assignment)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer ${
                          selectedDetails.assignment.isActive === false || selectedDetails.assignment.status === 'closed'
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {selectedDetails.assignment.isActive === false || selectedDetails.assignment.status === 'closed' ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>إعادة فتح الواجب</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>إغلاق الواجب</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmHw(selectedDetails.assignment)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>

                  {/* Assignment Header & Overall Statistics */}
                  <div className="bg-surface-hover border border-surface-border rounded-xl p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-black text-text-main">{selectedDetails.assignment.title}</h3>
                          {resolveAssignmentAudienceMode(selectedDetails.assignment) === 'group' ? (
                            <span className="text-[11px] font-bold text-primary">
                              · 🏫 جروب معين: {selectedDetails.assignment.groupName || 'مجموعة محددة'}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                              · 🌍 مفتوح لأي اسم
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            · <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> متابعة لحظية
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          {selectedDetails.assignment.setSnapshot?.title} · 📖 التعلم والنطق + مراحل الأسئلة ·{' '}
                          {selectedDetails.assignment.allowReplay === false || selectedDetails.assignment.maxAttempts === 1
                            ? 'محاولة واحدة'
                            : selectedDetails.assignment.maxAttempts > 1
                            ? `${selectedDetails.assignment.maxAttempts} محاولات`
                            : 'محاولات مفتوحة'}
                        </p>
                      </div>
                    </div>

                    {/* 5 Compact Statistics Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 tabular-nums">
                      <div className="bg-surface border border-surface-border rounded-lg p-2.5 text-center">
                        <div className="text-sm sm:text-base font-black text-text-main">
                          {selectedDetails.metrics?.totalAssigned ?? selectedDetails.studentStatusSummary?.length ?? 0}
                        </div>
                        <div className="text-[10px] text-text-muted font-semibold">
                          {resolveAssignmentAudienceMode(selectedDetails.assignment) === 'group'
                            ? 'طلاب المجموعة'
                            : 'المشاركون'}
                        </div>
                      </div>

                      <div className="bg-surface border border-surface-border rounded-lg p-2.5 text-center">
                        <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                          {selectedDetails.metrics?.completedCount ?? 0}
                          <span className="text-[10px] font-bold mr-1 opacity-80">
                            ({selectedDetails.metrics?.completionPercentage ?? 0}%)
                          </span>
                        </div>
                        <div className="text-[10px] text-text-muted font-semibold">مكتمل ✓</div>
                      </div>

                      <div className="bg-surface border border-surface-border rounded-lg p-2.5 text-center">
                        <div className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">
                          {selectedDetails.metrics?.inProgressCount ?? 0}
                        </div>
                        <div className="text-[10px] text-text-muted font-semibold">قيد الحل الآن ⚡</div>
                      </div>

                      <div className="bg-surface border border-surface-border rounded-lg p-2.5 text-center">
                        <div className="text-sm sm:text-base font-black text-text-muted">
                          {selectedDetails.metrics?.notStartedCount ?? 0}
                        </div>
                        <div className="text-[10px] text-text-muted font-semibold">لم يبدأ بعد</div>
                      </div>

                      <div className="bg-surface border border-surface-border rounded-lg p-2.5 text-center col-span-2 sm:col-span-1">
                        <div className="text-sm sm:text-base font-black text-primary">
                          {selectedDetails.metrics?.completedCount > 0 || (selectedDetails.submissions?.length || 0) > 0
                            ? `${selectedDetails.metrics?.averageScorePercentage ?? 0}%`
                            : '—'}
                        </div>
                        <div className="text-[10px] text-text-muted font-semibold">متوسط الدقة العام</div>
                      </div>
                    </div>
                  </div>

                  {/* Individual Student Question Responses Inspector Panel */}
                  {inspectingSubmission ? (
                    <div className="bg-surface border-2 border-primary/30 rounded-xl p-4 space-y-3 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-surface-border">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-text-main">
                              إجابات الطالب: {inspectingSubmission.studentName}
                            </h4>
                            {inspectingSubmission.status === 'in_progress' && !inspectingSubmission.completedAt ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                {(inspectingSubmission.responses?.length || 0) === 0
                                  ? inspectingSubmission.completedStudyPhase
                                    ? `دخل الواجب · يحل الآن السؤال 1 من ${inspectingSubmission.totalQuestions}`
                                    : `دخل الواجب الآن · في مرحلة تعلم الكلمات (قبل السؤال 1 من ${inspectingSubmission.totalQuestions})`
                                  : `يحل الآن مباشرة · في السؤال ${Math.min(
                                      inspectingSubmission.totalQuestions || 1,
                                      (inspectingSubmission.responses?.length || 0) + 1
                                    )} من ${inspectingSubmission.totalQuestions} (أجاب على ${inspectingSubmission.responses?.length || 0})`}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                مكتمل ✓
                              </span>
                            )}
                            {inspectingSubmission.cloudSynced !== false ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                <Cloud className="w-3 h-3" /> سحابي
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                                <CloudOff className="w-3 h-3" /> محلي
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-0.5 tabular-nums">
                            المحاولة #{inspectingSubmission.attemptNumber || 1} · النتيجة:{' '}
                            <strong className="text-text-main">
                              {inspectingSubmission.correctAnswersCount ?? inspectingSubmission.score ?? 0} / {inspectingSubmission.totalQuestions}
                            </strong>{' '}
                            ({inspectingSubmission.scorePercentage ?? inspectingSubmission.accuracy ?? 0}%) · الوقت:{' '}
                            <strong className="text-text-main">{formatDurationAr(inspectingSubmission.timeSpentSeconds)}</strong> · 💰{' '}
                            {inspectingSubmission.goldEarned || 0} نقطة
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setInspectingSubmission(null);
                            setInspectingStudentAttempts([]);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-xs font-bold text-text-main cursor-pointer"
                        >
                          إغلاق التفاصيل ✕
                        </button>
                      </div>

                      {/* Multi-Attempt Switcher if student has multiple attempts */}
                      {inspectingStudentAttempts.length > 1 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-text-muted">تبديل المحاولة:</span>
                          {inspectingStudentAttempts.map((att, idx) => {
                            const isCurrent = att.id === inspectingSubmission.id;
                            const attScore = att.scorePercentage ?? att.accuracyPercent ?? att.accuracy ?? 0;
                            const isAttCompleted = att.status === 'completed' || Boolean(att.completedAt);
                            return (
                              <button
                                key={att.id || idx}
                                type="button"
                                onClick={() => setInspectingSubmission(att)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                  isCurrent
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-surface-hover text-text-main border-surface-border hover:border-primary/40'
                                }`}
                              >
                                المحاولة #{att.attemptNumber || idx + 1} ({attScore}%{isAttCompleted ? '' : ' · قيد الحل'})
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Individual Question Responses List */}
                      {(!inspectingSubmission.responses || inspectingSubmission.responses.length === 0) ? (
                        <div className="p-4 text-center text-xs text-text-muted bg-surface-hover rounded-lg">
                          بدأ الطالب الواجب ولم يرسل إجابة السؤال الأول بعد...
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                          {inspectingSubmission.responses.map((r, idx) => (
                            <div
                              key={idx}
                              className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border text-xs ${
                                r.isCorrect
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-text-main flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-surface-border text-text-muted tabular-nums">
                                    س{idx + 1}
                                  </span>
                                  <span dir="ltr">{r.infinitive || r.germanWord}</span>
                                  {r.subject && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                                      {r.subject}
                                    </span>
                                  )}
                                  {r.timeSpentSeconds ? (
                                    <span className="text-[10px] text-text-muted font-normal">
                                      ({r.timeSpentSeconds} ث)
                                    </span>
                                  ) : null}
                                </div>
                                {(r.sentence || r.promptText) && (
                                  <span className="text-[10px] text-text-muted block mt-0.5" dir="auto">
                                    {r.sentence || r.promptText}
                                  </span>
                                )}
                              </div>
                              <div className="text-left font-bold">
                                <div>
                                  {r.isCorrect ? '✓ ' : '✗ '}إجابة الطالب: <span dir="auto">{r.studentAnswer}</span>
                                </div>
                                {!r.isCorrect && (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400">
                                    الصواب: <span dir="auto">{r.correctAnswer}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Sub-Navigation Tabs inside Assignment Details */}
                  <div className="grid grid-cols-3 gap-1 bg-surface-hover p-1 rounded-xl border border-surface-border text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setDetailSubTab('students')}
                      className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        detailSubTab === 'students'
                          ? 'bg-surface text-primary shadow-xs'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        الطلاب ({selectedDetails.studentStatusSummary?.length || 0})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDetailSubTab('questions')}
                      className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        detailSubTab === 'questions'
                          ? 'bg-surface text-primary shadow-xs'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      <ListChecks className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        تحليل الأسئلة ({selectedDetails.questionAccuracy?.length || 0})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDetailSubTab('attempts')}
                      className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        detailSubTab === 'attempts'
                          ? 'bg-surface text-primary shadow-xs'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        المحاولات ({selectedDetails.submissions?.length || 0})
                      </span>
                    </button>
                  </div>

                  {/* SUB-TAB 1: ASSIGNED & PARTICIPATING STUDENTS STATUS */}
                  {detailSubTab === 'students' && (
                    <div className="space-y-2.5">
                      {/* Status Filter Pills */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {[
                            { id: 'all', label: `الكل (${selectedDetails.studentStatusSummary?.length || 0})` },
                            { id: 'completed', label: `مكتمل (${selectedDetails.metrics?.completedCount || 0})` },
                            { id: 'in_progress', label: `قيد الحل (${selectedDetails.metrics?.inProgressCount || 0})` },
                            { id: 'not_started', label: `لم يبدأ (${selectedDetails.metrics?.notStartedCount || 0})` }
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setStudentStatusFilter(f.id as any)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                                studentStatusFilter === f.id
                                  ? 'bg-primary text-white'
                                  : 'bg-surface-hover text-text-muted hover:text-text-main border border-surface-border'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {filteredStudentRows.length === 0 ? (
                        <div className="bg-surface-hover/50 border border-surface-border rounded-xl p-6 text-center space-y-2">
                          <Users className="w-8 h-8 text-text-muted mx-auto opacity-50" />
                          <p className="text-xs font-bold text-text-main">
                            {studentStatusFilter === 'all'
                              ? resolveAssignmentAudienceMode(selectedDetails.assignment) === 'open'
                                ? 'لم يقم أي طالب بفتح رابط الواجب وتسجيل اسمه بعد'
                                : 'لا يوجد طلاب مسجلين في هذه المجموعة حالياً'
                              : 'لا يوجد طلاب في هذا التصنيف حالياً'}
                          </p>
                          {studentStatusFilter === 'all' &&
                            resolveAssignmentAudienceMode(selectedDetails.assignment) === 'open' && (
                              <div className="space-y-2 pt-1">
                                <p className="text-[11px] text-text-muted max-w-md mx-auto">
                                  هذا الواجب مفتوح لأي اسم — بمجرد أن يفتح أي طالب الرابط ويكتب اسمه ستظهر إجاباته ودرجته هنا لحظياً.
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopy(
                                      buildHomeworkShareUrl(selectedDetails.assignment, vercelDomain),
                                      `empty_${selectedDetails.assignment.id}`
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold cursor-pointer shadow-xs"
                                >
                                  {copiedId === `empty_${selectedDetails.assignment.id}` ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" /> تم نسخ الرابط!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" /> نسخ رابط الواجب للطلاب
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredStudentRows.map((st: any) => {
                            const isCompleted = st.status === 'completed';
                            const isInProgress = st.status === 'in_progress';
                            return (
                              <div
                                key={st.studentId || st.studentName}
                                className="bg-surface border border-surface-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                              >
                                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 border ${
                                      isCompleted
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                        : isInProgress
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                        : 'bg-surface-hover border-surface-border text-text-muted'
                                    }`}
                                  >
                                    {isCompleted ? '✓' : isInProgress ? '⚡' : '⏳'}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs sm:text-sm font-bold text-text-main truncate">
                                        {st.studentName}
                                      </span>
                                      {isCompleted ? (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                          · مكتمل ✓
                                        </span>
                                      ) : isInProgress ? (
                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                          · <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />{' '}
                                          {(st.answeredCount || 0) === 0
                                            ? st.latestAttempt?.completedStudyPhase
                                              ? `دخل الواجب · يحل السؤال 1 من ${st.totalQuestions}`
                                              : `دخل الواجب الآن · يدرس الكلمات (0/${st.totalQuestions})`
                                            : `يحل الآن · في السؤال ${Math.min(
                                                st.totalQuestions || 1,
                                                (st.answeredCount || 0) + 1
                                              )} من ${st.totalQuestions} (أجاب على ${st.answeredCount})`}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold text-text-muted">
                                          · لم يبدأ بعد
                                        </span>
                                      )}
                                    </div>

                                    {st.attemptsCount > 0 ? (
                                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-text-muted mt-0.5 tabular-nums">
                                        <span>
                                          المحاولات: <strong className="text-text-main">{st.attemptsCount}</strong>
                                        </span>
                                        <span>·</span>
                                        <span>
                                          أفضل درجة: <strong className="text-emerald-600 dark:text-emerald-400">{st.bestScore}%</strong>
                                        </span>
                                        <span>·</span>
                                        <span>
                                          آخر درجة: <strong className="text-text-main">{st.latestScore}%</strong>
                                        </span>
                                        <span>·</span>
                                        <span className="flex items-center gap-0.5">
                                          <Clock className="w-3 h-3" /> {formatDurationAr(st.totalTimeSpent)}
                                        </span>
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-text-muted mt-0.5">
                                        لم يسجل أي محاولة حتى الآن
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {st.attemptsCount > 0 && (
                                  <div className="flex items-center justify-end gap-2 shrink-0">
                                    <span
                                      className={`px-2 py-0.5 rounded-lg text-xs font-black tabular-nums ${
                                        (st.bestScore || 0) >= 80
                                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                          : (st.bestScore || 0) >= 50
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      }`}
                                    >
                                      {st.bestScore}%
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => handleInspectStudent(st)}
                                      className="px-2.5 py-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-primary" />
                                      <span>إجابات الطالب</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 2: PER-QUESTION ACCURACY & RESPONSES BREAKDOWN */}
                  {detailSubTab === 'questions' && (
                    <div className="space-y-2">
                      {(!selectedDetails.questionAccuracy || selectedDetails.questionAccuracy.length === 0) ? (
                        <div className="bg-surface-hover/50 border border-surface-border rounded-xl p-6 text-center space-y-1.5">
                          <HelpCircle className="w-8 h-8 text-text-muted mx-auto opacity-50" />
                          <p className="text-xs font-bold text-text-main">لا توجد إجابات مسجلة لتحليل الأسئلة بعد</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedDetails.questionAccuracy.map((qa: any, i: number) => {
                            const accPct = qa.accuracyPercent ?? qa.accuracyPercentage ?? 0;
                            const wrongCnt = qa.incorrectCount ?? qa.wrongCount ?? 0;
                            const promptLabel = qa.prompt || qa.promptText || '';
                            return (
                            <div
                              key={qa.questionId || i}
                              className="bg-surface border border-surface-border rounded-xl p-3 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="text-xs sm:text-sm font-bold text-text-main" dir="ltr">
                                    {qa.germanWord}
                                  </span>
                                  <span className="text-[11px] text-text-muted block">
                                    {promptLabel} · الصواب: <strong className="text-text-main">{qa.correctAnswer}</strong>
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    ✓ {qa.correctCount} صحيح
                                  </span>
                                  <span>·</span>
                                  <span className="text-rose-600 dark:text-rose-400">
                                    ✗ {wrongCnt} خطأ
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-lg ${
                                      accPct >= 80
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        : accPct >= 50
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {accPct}%
                                  </span>
                                </div>
                              </div>

                              <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    accPct >= 80
                                      ? 'bg-emerald-500'
                                      : accPct >= 50
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${accPct}%` }}
                                />
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 3: ALL ATTEMPTS LOG */}
                  {detailSubTab === 'attempts' && (
                    <div className="space-y-2">
                      {!selectedDetails.submissions || selectedDetails.submissions.length === 0 ? (
                        <div className="bg-surface-hover/50 border border-surface-border rounded-xl p-6 text-center space-y-1.5">
                          <Trophy className="w-8 h-8 text-text-muted mx-auto opacity-50" />
                          <p className="text-xs font-bold text-text-main">لم يقم أي طالب ببدء الواجب حتى الآن</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedDetails.submissions.map((sub: HomeworkSubmission, idx: number) => {
                            const acc = sub.accuracy ?? sub.scorePercentage ?? 0;
                            const isSubInProgress = sub.status === 'in_progress' && !sub.completedAt;
                            return (
                              <div
                                key={sub.id || idx}
                                className="bg-surface border border-surface-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="w-7 h-7 rounded-lg bg-surface-hover border border-surface-border text-text-main font-bold text-xs flex items-center justify-center shrink-0">
                                    #{sub.attemptNumber || 1}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs sm:text-sm font-bold text-text-main">{sub.studentName}</span>
                                      {isSubInProgress ? (
                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                          ·{' '}
                                          {(sub.responses?.length || 0) === 0
                                            ? sub.completedStudyPhase
                                              ? `دخل الواجب · يحل السؤال 1 من ${sub.totalQuestions}`
                                              : `دخل الواجب الآن · يدرس الكلمات (0/${sub.totalQuestions})`
                                            : `في السؤال ${Math.min(
                                                sub.totalQuestions || 1,
                                                (sub.responses?.length || 0) + 1
                                              )} من ${sub.totalQuestions} (أجاب على ${sub.responses?.length || 0})`}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                          · مكتمل ✓
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-text-muted tabular-nums">
                                      الوقت: {formatDurationAr(sub.timeSpentSeconds)} ·{' '}
                                      {sub.completedAt
                                        ? new Date(sub.completedAt).toLocaleTimeString('ar-EG', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })
                                        : 'يحل الآن'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 tabular-nums">
                                  <span className="text-xs font-bold text-text-muted">
                                    {sub.correctAnswersCount ?? sub.score ?? 0} / {sub.totalQuestions}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                      acc >= 80
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        : acc >= 50
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {acc}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleInspectSingleSubmission(sub)}
                                    className="px-2.5 py-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-primary" />
                                    <span>تفاصيل الإجابات</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ================= HOMEWORK CARDS LIST ================= */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-main">
                        جميع الواجبات ({filteredAssignments.length}):
                      </span>

                      {/* Audience / Group Filter Dropdown */}
                      <div className="flex items-center gap-1.5 bg-surface-hover px-2.5 py-1 rounded-lg border border-surface-border">
                        <Filter className="w-3 h-3 text-text-muted" />
                        <select
                          value={filterGroup}
                          onChange={(e) => setFilterGroup(e.target.value)}
                          className="bg-transparent text-text-main font-bold text-xs outline-none cursor-pointer"
                        >
                          <option value="all">كل الواجبات</option>
                          <option value="open_only">🌍 مفتوح لأي اسم</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              🏫 {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => loadAllAssignments(true)}
                        className="px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-xs font-bold text-text-main flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingResults ? 'animate-spin' : ''}`} />
                        <span>تحديث</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إنشاء واجب</span>
                      </button>
                    </div>
                  </div>

                  {filteredAssignments.length === 0 ? (
                    <div className="bg-surface-hover/40 border border-surface-border rounded-xl p-8 text-center space-y-3">
                      <Trophy className="w-10 h-10 text-text-muted mx-auto opacity-50" />
                      <h4 className="text-sm font-bold text-text-main">لا يوجد واجبات منشأة في هذه القائمة</h4>
                      <p className="text-xs text-text-muted">
                        اضغط على «إنشاء واجب» للبدء وتوزيع التدريبات التفاعلية على طلابك
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إنشاء أول واجب تفاعلي</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredAssignments.map((hw) => {
                        const shareUrl = buildHomeworkShareUrl(hw, vercelDomain);
                        const isGroupHw = resolveAssignmentAudienceMode(hw) === 'group';
                        const completedCount = hw.completedStudentsCount ?? hw.submissionCount ?? 0;
                        const inProgressCount = hw.inProgressStudentsCount ?? hw.inProgressCount ?? 0;
                        const totalAssigned = hw.assignedStudentsCount ?? hw.totalAssignedCount ?? 0;
                        const notStartedCount = isGroupHw
                          ? Math.max(0, totalAssigned - completedCount - inProgressCount)
                          : 0;
                        const avgAcc = hw.avgAccuracy || 0;

                        return (
                          <div
                            key={hw.id}
                            className="bg-surface border border-surface-border hover:border-primary/40 rounded-xl p-4 transition-all space-y-3 shadow-xs relative overflow-hidden group"
                          >
                            {/* Card Header & Title */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors truncate">
                                    {hw.title}
                                  </h4>
                                  {hw.isActive === false || hw.status === 'closed' ? (
                                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">
                                      · 🔒 مغلق
                                    </span>
                                  ) : null}
                                  {hw.cloudSynced !== false ? (
                                    <span title="متزامن سحابياً مع Firestore" className="text-emerald-500 shrink-0">
                                      <Cloud className="w-3.5 h-3.5" />
                                    </span>
                                  ) : (
                                    <span title="محفوظ محلياً بانتظار المزامنة" className="text-amber-500 shrink-0">
                                      <CloudOff className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-text-muted truncate">
                                  {hw.setSnapshot?.title || 'مجموعة الكلمات'}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAssignment(hw)}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                  title="تعديل عنوان وإعدادات الواجب"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={togglingActiveId === hw.id}
                                  onClick={() => handleToggleAssignmentActive(hw)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    hw.isActive === false || hw.status === 'closed'
                                      ? 'text-amber-500 hover:bg-emerald-500/10 hover:text-emerald-500'
                                      : 'text-text-muted hover:text-amber-500 hover:bg-amber-500/10'
                                  }`}
                                  title={
                                    hw.isActive === false || hw.status === 'closed'
                                      ? 'إعادة فتح الواجب للطلاب'
                                      : 'إغلاق الواجب مؤقتاً'
                                  }
                                >
                                  {hw.isActive === false || hw.status === 'closed' ? (
                                    <Unlock className="w-3.5 h-3.5" />
                                  ) : (
                                    <Lock className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmHw(hw)}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="حذف الواجب نهائياً"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Unboxed Metadata (Zero-Pill Rule) */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted pt-0.5 tabular-nums">
                              {isGroupHw ? (
                                <span className="flex items-center gap-1 text-primary font-bold">
                                  <Building2 className="w-3 h-3" />
                                  <span>{hw.groupName || 'جروب معين'}</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                                  <Globe className="w-3 h-3" />
                                  <span>مفتوح لأي اسم</span>
                                </span>
                              )}
                              <span>·</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                ✓ {completedCount}{isGroupHw && totalAssigned > 0 ? `/${totalAssigned}` : ''} مكتمل
                              </span>
                              {inProgressCount > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                    {inProgressCount} يحل الآن
                                  </span>
                                </>
                              )}
                              {isGroupHw && totalAssigned > 0 && notStartedCount > 0 && (
                                <>
                                  <span>·</span>
                                  <span>{notStartedCount} لم يبدأ</span>
                                </>
                              )}
                              {(completedCount > 0 || inProgressCount > 0) && (
                                <>
                                  <span>·</span>
                                  <span className="font-bold text-text-main">
                                    🎯 {avgAcc}% دقة
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Action Buttons Bar */}
                            <div className="pt-2 border-t border-surface-border flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(shareUrl, hw.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-text-main font-bold text-xs flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedId === hw.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-500" /> تم النسخ
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" /> نسخ الرابط
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const groupText = hw.groupName ? ` [${hw.groupName}]` : '';
                                    const msg = `🇩🇪 *واجب الألماني التفاعلي (Glück Lernstudio)*${groupText}\n📚 *${hw.title}*\n\nيرجى فتح الرابط لبدء حل الواجب:\n${shareUrl}`;
                                    navigator.clipboard.writeText(msg);
                                    setCopiedId(`wa_${hw.id}`);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }}
                                  className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                  title="نسخ رسالة واتساب للطلاب"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleOpenDetails(hw.id, hw)}
                                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                              >
                                <BarChart3 className="w-3.5 h-3.5" />
                                <span>متابعة الطلاب ({completedCount + inProgressCount})</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* Edit Assignment Metadata Modal */}
      {editingHw && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditAssignment}
            className="bg-surface border border-surface-border rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
              <h3 className="text-sm font-black text-text-main flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-primary" />
                <span>تعديل إعدادات الواجب</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingHw(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-main mb-1">عنوان الواجب:</label>
                <input
                  type="text"
                  value={editHwTitle}
                  onChange={(e) => setEditHwTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main mb-1">عدد المحاولات للطالب:</label>
                <select
                  value={editHwMaxAttempts}
                  onChange={(e) => setEditHwMaxAttempts(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-hover border border-surface-border text-xs font-bold text-text-main outline-none focus:border-primary cursor-pointer"
                >
                  <option value={0}>♾️ مفتوح (تحسين الدرجة)</option>
                  <option value={1}>1️⃣ محاولة واحدة فقط (امتحان)</option>
                  <option value={2}>2️⃣ محاولتان كحد أقصى</option>
                  <option value={3}>3️⃣ 3 محاولات كحد أقصى</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface-hover/70 border border-surface-border">
                <label className="text-xs font-bold text-text-main select-none">
                  إخفاء اللوجو واسم المدرس
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editHwHideBranding}
                  onClick={() => setEditHwHideBranding((prev) => !prev)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    editHwHideBranding ? 'bg-primary' : 'bg-surface-border'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      editHwHideBranding ? '-translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={isSavingHwEdit}
                className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                {isSavingHwEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
              <button
                type="button"
                disabled={isSavingHwEdit}
                onClick={() => setEditingHw(null)}
                className="flex-1 py-2 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmHw && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto text-xl">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-text-main">حذف الواجب نهائياً؟</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                هل أنت متأكد من حذف الواجب <span className="text-rose-500 font-bold">"{deleteConfirmHw.title}"</span> نهائياً؟
                سيتم حذف الواجب وجميع تسليمات إجابات الطلاب المرتبطة به.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAssignment}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
              >
                {isDeleting ? 'جاري الحذف...' : 'نعم، احذف الواجب'}
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmHw(null)}
                className="flex-1 py-2 rounded-xl bg-surface-hover hover:bg-surface border border-surface-border text-text-main font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
