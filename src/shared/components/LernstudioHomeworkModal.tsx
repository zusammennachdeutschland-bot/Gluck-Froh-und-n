import React, { useState, useEffect, useMemo } from 'react';
import { LernstudioSet } from '../../types/lernstudio';
import { useApp } from '../../context/AppContext';
import {
  HomeworkAssignment,
  HomeworkFlowMode,
  HomeworkQuestionType,
  HomeworkBlooketMode,
  HomeworkSubmission
} from '../homeworkTypes';
import {
  QUESTION_TYPE_META,
  buildHomeworkShareUrl,
  getLocalAssignments,
  saveLocalAssignment,
  deleteLocalAssignment,
  saveLocalSubmission,
  syncAndFetchTeacherAssignments,
  fetchAssignmentDetailsWithSync,
  getVercelPublicDomain,
  setVercelPublicDomain,
  saveAssignmentToFirestore,
  subscribeAssignmentsFromFirestore,
  subscribeSubmissionsFromFirestore,
  signInTeacherWithGoogle,
  signOutTeacherFirebase,
  subscribeTeacherAuth
} from '../homeworkStorageSync';
import {
  Sparkles,
  XCircle,
  X,
  Send,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Users,
  Trophy,
  GraduationCap,
  BarChart3,
  ArrowRight,
  Coins,
  Eye,
  Plus,
  ListChecks,
  Globe,
  Cloud,
  LogIn,
  LogOut,
  Share2,
  Trash2,
  Building2,
  Filter,
  Flame,
  Zap,
  Target
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sets: LernstudioSet[];
  defaultSet?: LernstudioSet | null;
  language?: string;
}

export const LernstudioHomeworkModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sets,
  defaultSet
}) => {
  const { groups, students = [] } = useApp();
  const [activeTab, setActiveTab] = useState<'create' | 'results'>('create');

  // Create Homework State
  const [selectedSetId, setSelectedSetId] = useState(defaultSet?.id || sets[0]?.id || '');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [title, setTitle] = useState('');
  const [flowMode, setFlowMode] = useState<HomeworkFlowMode>('teacher_then_quiz');
  const [questionTypes, setQuestionTypes] = useState<HomeworkQuestionType[]>([
    'mc_de_ar',
    'true_false',
    'listen_choose'
  ]);
  const [blooketMode, setBlooketMode] = useState<HomeworkBlooketMode>('gold_quest');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [maxAttempts, setMaxAttempts] = useState(0);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdAssignment, setCreatedAssignment] = useState<HomeworkAssignment | null>(null);
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Results Tab State
  const [assignmentsList, setAssignmentsList] = useState<any[]>([]);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [inspectingSubmission, setInspectingSubmission] = useState<HomeworkSubmission | null>(null);
  const [deleteConfirmHw, setDeleteConfirmHw] = useState<HomeworkAssignment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Firebase Auth + Vercel Public Domain State
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [vercelDomain, setVercelDomainState] = useState<string>(() => getVercelPublicDomain());

  const currentSet = useMemo(
    () => sets.find((s) => s.id === selectedSetId) || defaultSet || sets[0],
    [sets, selectedSetId, defaultSet]
  );

  // Initialize selectedItemIds when set changes
  useEffect(() => {
    if (currentSet?.items) {
      setSelectedItemIds(currentSet.items.map((it) => it.id));
    }
  }, [currentSet?.id]);

  useEffect(() => {
    if (defaultSet?.id) {
      setSelectedSetId(defaultSet.id);
    }
  }, [defaultSet?.id]);

  useEffect(() => {
    const unsubAuth = subscribeTeacherAuth((u) => setFirebaseUser(u));
    return () => unsubAuth();
  }, []);

  const loadAllAssignments = async () => {
    setLoadingResults(true);
    try {
      const list = await syncAndFetchTeacherAssignments();
      setAssignmentsList(list);
    } finally {
      setLoadingResults(false);
    }
  };

  // Real-time Firestore listener while modal is open
  useEffect(() => {
    if (!isOpen) return;
    loadAllAssignments();

    const unsubAssignments = subscribeAssignmentsFromFirestore((cloudHwList) => {
      cloudHwList.forEach((hw) => saveLocalAssignment(hw, false));
      syncAndFetchTeacherAssignments().then((list) => setAssignmentsList(list));
    });

    const unsubSubmissions = subscribeSubmissionsFromFirestore(null, (cloudSubs) => {
      cloudSubs.forEach((sub) => saveLocalSubmission(sub, false));
      syncAndFetchTeacherAssignments().then((list) => setAssignmentsList(list));
      if (selectedDetails?.assignment?.id) {
        fetchAssignmentDetailsWithSync(selectedDetails.assignment.id).then((d) => {
          if (d) setSelectedDetails(d);
        });
      }
    });

    return () => {
      unsubAssignments();
      unsubSubmissions();
    };
  }, [isOpen, selectedDetails?.assignment?.id]);

  const toggleQuestionType = (type: HomeworkQuestionType) => {
    setQuestionTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // Keep at least 1 question type
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSet) return;

    setIsCreating(true);
    try {
      const chosenItems = currentSet.items.filter((it) => selectedItemIds.includes(it.id));
      const finalItems = chosenItems.length > 0 ? chosenItems : currentSet.items;
      const totalQ = finalItems.length * questionTypes.length;
      const generatedId = 'hw_' + Math.random().toString(36).substring(2, 8);
      const targetGroup = groups.find((g) => g.id === selectedGroupId);
      const assignedStudentsList = (
        selectedGroupId !== 'all'
          ? students.filter((s) => !s.deleted && s.status !== 'archived' && s.groupId === selectedGroupId)
          : students.filter((s) => !s.deleted && s.status !== 'archived')
      ).map((s) => ({ id: s.id, name: s.name }));

      const payload: HomeworkAssignment = {
        id: generatedId,
        title: title.trim() || `واجب: ${currentSet.title}`,
        setSnapshot: {
          id: currentSet.id,
          title: currentSet.title,
          category: (currentSet as any).category || currentSet.topic || '',
          items: finalItems
        },
        selectedItemIds: finalItems.map((it) => it.id),
        flowMode,
        questionTypes,
        blooketMode,
        allowedGameModes: [blooketMode],
        questionCount: totalQ,
        targetQuestionCount: totalQ,
        groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
        groupName: targetGroup ? targetGroup.name : undefined,
        assignedStudents: assignedStudentsList.length > 0 ? assignedStudentsList : undefined,
        deadline: hasDeadline && deadlineDate ? new Date(deadlineDate).toISOString() : undefined,
        maxAttempts,
        allowReplay: true,
        isActive: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: 'Teacher'
      };

      saveLocalAssignment(payload, true);
      await saveAssignmentToFirestore(payload).catch(() => {});

      const res = await fetch('/api/teacher/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      }).catch(() => null);

      let data: any = {};
      if (res) {
        const text = await res.text();
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }
      }

      const finalAssignment: HomeworkAssignment =
        res && res.ok && data?.assignment ? { ...payload, ...data.assignment } : payload;

      saveLocalAssignment(finalAssignment, true);
      await saveAssignmentToFirestore(finalAssignment).catch(() => {});
      setCreatedAssignment(finalAssignment);
      setCreatedShareLink(buildHomeworkShareUrl(finalAssignment, vercelDomain));
    } catch {
      if (currentSet) {
        const chosenItems = currentSet.items.filter((it) => selectedItemIds.includes(it.id));
        const finalItems = chosenItems.length > 0 ? chosenItems : currentSet.items;
        const targetGroup = groups.find((g) => g.id === selectedGroupId);
        const fallbackHw: HomeworkAssignment = {
          id: 'hw_' + Math.random().toString(36).substring(2, 8),
          title: title.trim() || `واجب: ${currentSet.title}`,
          setSnapshot: { ...currentSet, items: finalItems },
          selectedItemIds: finalItems.map((it) => it.id),
          flowMode,
          questionTypes,
          blooketMode,
          allowedGameModes: [blooketMode],
          questionCount: finalItems.length * questionTypes.length,
          targetQuestionCount: finalItems.length * questionTypes.length,
          groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
          groupName: targetGroup ? targetGroup.name : undefined,
          maxAttempts,
          allowReplay: true,
          isActive: true,
          status: 'active',
          createdAt: new Date().toISOString(),
          createdBy: 'Teacher'
        };
        saveLocalAssignment(fallbackHw, true);
        await saveAssignmentToFirestore(fallbackHw).catch(() => {});
        setCreatedAssignment(fallbackHw);
        setCreatedShareLink(buildHomeworkShareUrl(fallbackHw, vercelDomain));
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (linkText: string, idKey: string) => {
    navigator.clipboard.writeText(linkText);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleOpenDetails = async (hwId: string) => {
    setLoadingDetails(true);
    setInspectingSubmission(null);
    try {
      const details = await fetchAssignmentDetailsWithSync(hwId);
      setSelectedDetails(details);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!deleteConfirmHw) return;
    setIsDeleting(true);
    try {
      const targetId = deleteConfirmHw.id;
      deleteLocalAssignment(targetId, true);
      setAssignmentsList((prev) => prev.filter((a) => a.id !== targetId));
      if (selectedDetails?.assignment?.id === targetId) {
        setSelectedDetails(null);
      }
    } finally {
      setIsDeleting(false);
      setDeleteConfirmHw(null);
    }
  };

  const filteredAssignments = useMemo(() => {
    if (filterGroup === 'all') return assignmentsList;
    return assignmentsList.filter((a) => a.groupId === filterGroup);
  }, [assignmentsList, filterGroup]);

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
                  إنشاء روابط التدريب، تحديد المستهدفين، ومتابعة النتائج والتقييمات
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
                <span className="truncate">إدارة الواجبات ({assignmentsList.length})</span>
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {activeTab === 'create' ? (
            !createdShareLink ? (
              /* ================= CREATE HOMEWORK FORM ================= */
              <form onSubmit={handleCreate} className="space-y-4">
                
                {/* 1. Vocabulary Set & Group Selection Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Select Vocabulary Set */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <span>📚</span>
                      <span>مجموعة الكلمات المفتاحية:</span>
                    </label>
                    <select
                      value={selectedSetId}
                      onChange={(e) => setSelectedSetId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                    >
                      {sets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.items?.length || 0} كلمة)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Target Student Group */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                      <span>المجموعة المستهدفة (من طلابك):</span>
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="all">🌍 جميع المجموعات (عام لمجموعة مفتوحة)</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          🏫 {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Custom Title Input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <span>✏️</span>
                    <span>عنوان الواجب (اختياري):</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`مثال: واجب ${currentSet?.title || 'الألماني'}`}
                    className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* 3. Flow Mode & Reward Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-main">نمط العرض والشرح:</label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-surface-hover rounded-xl border border-surface-border">
                      <button
                        type="button"
                        onClick={() => setFlowMode('teacher_then_quiz')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                          flowMode === 'teacher_then_quiz'
                            ? 'bg-surface text-primary shadow-xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        👨‍🏫 شرح + اختبار
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlowMode('quiz_only')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                          flowMode === 'quiz_only'
                            ? 'bg-surface text-primary shadow-xs'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        🎯 اختبار مباشر
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-text-main">طابع المكافآت والألعاب:</label>
                    <select
                      value={blooketMode}
                      onChange={(e) => setBlooketMode(e.target.value as HomeworkBlooketMode)}
                      className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-text-main text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="gold_quest">🎁 صناديق الذهب (Gold Quest — 3 صناديق بعد الإجابة)</option>
                      <option value="classic_quiz">🎯 اختبار سريع مع نقاط وسلسلة انتصارات</option>
                    </select>
                  </div>
                </div>

                {/* 4. Question Types Grid */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main flex items-center justify-between">
                    <span>مراحل وأنواع الأسئلة المطلوب تضمينها:</span>
                    <span className="text-[10px] text-text-muted font-bold tabular-nums">
                      محدد: {questionTypes.length} من {QUESTION_TYPE_META.length}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {QUESTION_TYPE_META.map((meta) => {
                      const active = questionTypes.includes(meta.id);
                      return (
                        <button
                          key={meta.id}
                          type="button"
                          onClick={() => toggleQuestionType(meta.id)}
                          className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            active
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">
                              {meta.badgeEmoji} {meta.labelAr.split('(')[0]}
                            </div>
                            <div className="text-[10px] text-text-muted truncate">
                              {meta.descAr.slice(0, 30)}...
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                            active ? 'bg-primary text-white' : 'border border-surface-border'
                          }`}>
                            {active ? '✓' : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Words Selector Pills */}
                {currentSet?.items && currentSet.items.length > 0 && (
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
                  <div className="text-xs font-bold text-text-main">
                    الأسئلة الإجمالية:{' '}
                    <span className="text-primary font-black">
                      {selectedItemIds.length * questionTypes.length} سؤال
                    </span>{' '}
                    ({selectedItemIds.length} كلمة × {questionTypes.length} مراحل)
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
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <div>
                  <h4 className="text-base sm:text-lg font-black text-text-main">تم تجهيز الواجب بنجاح</h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    انسخ الرابط وأرسله للطلاب — ستظهر نتائج كل طالب فورياً في جدول الإدارة
                  </p>
                </div>

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
                    href={createdShareLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold rounded-xl flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-primary" /> فتح الواجب تجريبياً
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('results');
                      if (createdAssignment) {
                        handleOpenDetails(createdAssignment.id);
                      } else {
                        loadAllAssignments();
                      }
                    }}
                    className="px-3.5 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-primary" /> إدارة نتائج الطلاب
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreatedShareLink(null);
                      setCreatedAssignment(null);
                    }}
                    className="px-3 py-2 text-text-muted hover:text-text-main hover:bg-surface-hover text-xs font-medium rounded-xl cursor-pointer"
                  >
                    + إنشاء واجب آخر
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ================= TAB 2: HOMEWORK MANAGEMENT ================= */
            <div className="space-y-4">
              
              {selectedDetails ? (
                /* Detail Inspection View */
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-surface-border">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDetails(null);
                        setInspectingSubmission(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>العودة لكل الواجبات</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(selectedDetails.assignment.id)}
                        className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-text-main text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingDetails ? 'animate-spin' : ''}`} />
                        <span>تحديث</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(buildHomeworkShareUrl(selectedDetails.assignment), selectedDetails.assignment.id)
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
                        onClick={() => setDeleteConfirmHw(selectedDetails.assignment)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-surface-hover border border-surface-border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-text-main">{selectedDetails.assignment.title}</h3>
                        {selectedDetails.assignment.groupName && (
                          <span className="text-[11px] font-bold text-text-muted">
                            · 🏫 {selectedDetails.assignment.groupName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        {selectedDetails.assignment.setSnapshot?.title} ·{' '}
                        {selectedDetails.assignment.flowMode === 'quiz_only'
                          ? '🎯 أسئلة مباشرة'
                          : '👨‍🏫 شرح معلّم + أسئلة'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 tabular-nums">
                      <div className="text-center">
                        <div className="text-base sm:text-lg font-black text-text-main">
                          {selectedDetails.submissions?.length || 0}
                        </div>
                        <div className="text-[10px] text-text-muted">إجابات الطلاب</div>
                      </div>
                      <div className="text-center border-r border-surface-border pr-4">
                        <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {selectedDetails.submissions?.length > 0
                            ? `${Math.round(
                                selectedDetails.submissions.reduce(
                                  (acc: number, s: any) => acc + (s.accuracy ?? s.scorePercentage ?? 0),
                                  0
                                ) / selectedDetails.submissions.length
                              )}%`
                            : '—'}
                        </div>
                        <div className="text-[10px] text-text-muted">متوسط الدقة</div>
                      </div>
                    </div>
                  </div>

                  {/* Inspecting Student Answers Modal / Card */}
                  {inspectingSubmission ? (
                    <div className="bg-surface-hover border border-surface-border rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                            <span>إجابات الطالب: {inspectingSubmission.studentName}</span>
                          </h4>
                          <p className="text-xs text-text-muted">
                            النتيجة: {inspectingSubmission.correctAnswersCount} / {inspectingSubmission.totalQuestions} (
                            {inspectingSubmission.scorePercentage}%) · 💰 {inspectingSubmission.goldEarned || 0} ذهب
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectingSubmission(null)}
                          className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs font-bold text-text-main hover:bg-surface-hover cursor-pointer"
                        >
                          إغلاق التفاصيل
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {(inspectingSubmission.responses || []).map((r, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold ${
                              r.isCorrect
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            <div>
                              <span className="font-bold text-text-main">{r.germanWord}</span>
                              {r.promptText && (
                                <span className="text-[10px] text-text-muted block">{r.promptText}</span>
                              )}
                            </div>
                            <div className="text-left">
                              <div>إجابة الطالب: {r.studentAnswer}</div>
                              {!r.isCorrect && <div className="text-[10px] text-amber-600 dark:text-amber-400">الصواب: {r.correctAnswer}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Submissions List */}
                  {!selectedDetails.submissions || selectedDetails.submissions.length === 0 ? (
                    <div className="bg-surface-hover/50 border border-surface-border rounded-xl p-8 text-center space-y-2">
                      <Users className="w-10 h-10 text-text-muted mx-auto opacity-50" />
                      <p className="text-sm font-bold text-text-main">لم يقم أي طالب بتقديم الواجب حتى الآن</p>
                      <p className="text-xs text-text-muted">
                        شارك الرابط مع طلابك أو جرب حله بنفسك ثم اضغط «تحديث اللحظي»
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span>ترتيب الطلاب المستلمين ({selectedDetails.submissions.length}):</span>
                      </h4>
                      <div className="space-y-2">
                        {selectedDetails.submissions.map((sub: HomeworkSubmission, idx: number) => {
                          const acc = sub.accuracy ?? sub.scorePercentage ?? 0;
                          return (
                            <div
                              key={sub.id}
                              className="bg-surface border border-surface-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-lg bg-surface-hover border border-surface-border text-text-main font-bold text-xs flex items-center justify-center shrink-0">
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                </span>
                                <div>
                                  <div className="text-sm font-bold text-text-main">{sub.studentName}</div>
                                  <div className="text-[11px] text-text-muted">
                                    الوقت: {sub.timeSpentSeconds} ثانية ·{' '}
                                    {new Date(sub.completedAt).toLocaleTimeString('ar-EG', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                  💰 {sub.goldEarned ?? (sub.correctAnswersCount || 0) * 100}
                                </span>
                                <span className="text-xs font-bold text-text-muted">
                                  {sub.correctAnswersCount} / {sub.totalQuestions}
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
                                  onClick={() => setInspectingSubmission(sub)}
                                  className="px-2.5 py-1.5 rounded-lg bg-surface-hover hover:bg-surface border border-surface-border text-text-main text-xs font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>تفاصيل الإجابات</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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

                      {/* Group Filter Dropdown */}
                      {groups.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-surface-hover px-2.5 py-1 rounded-lg border border-surface-border">
                          <Filter className="w-3 h-3 text-text-muted" />
                          <select
                            value={filterGroup}
                            onChange={(e) => setFilterGroup(e.target.value)}
                            className="bg-transparent text-text-main font-bold text-xs outline-none cursor-pointer"
                          >
                            <option value="all">كل المجموعات</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={loadAllAssignments}
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
                        const shareUrl = buildHomeworkShareUrl(hw);
                        const subCount = hw.submissionCount || 0;
                        const avgAcc = hw.avgAccuracy || 0;

                        return (
                          <div
                            key={hw.id}
                            className="bg-surface border border-surface-border hover:border-primary/40 rounded-xl p-4 transition-all space-y-3 shadow-xs relative overflow-hidden group"
                          >
                            {/* Card Header & Title */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <h4 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">
                                  {hw.title}
                                </h4>
                                <p className="text-xs text-text-muted">
                                  {hw.setSnapshot?.title || 'مجموعة الكلمات'}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setDeleteConfirmHw(hw)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                                title="حذف الواجب نهائياً"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Unboxed Metadata (Zero-Pill Rule) */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted pt-1">
                              {hw.groupName ? (
                                <span className="flex items-center gap-1 text-primary font-bold">
                                  <Building2 className="w-3 h-3" />
                                  <span>{hw.groupName}</span>
                                </span>
                              ) : (
                                <span>عام لجميع المجموعات</span>
                              )}
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span>{subCount} طلاب سلموا</span>
                              </span>
                              {subCount > 0 && (
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
                                onClick={() => handleOpenDetails(hw.id)}
                                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                              >
                                <BarChart3 className="w-3.5 h-3.5" />
                                <span>نتائج الطلاب ({subCount})</span>
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
