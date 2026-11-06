import React, { useState, useEffect, useMemo } from 'react';
import { LernstudioSet } from '../../types/lernstudio';
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
  Share2
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
  const [activeTab, setActiveTab] = useState<'create' | 'results'>('create');

  // Create Homework State
  const [selectedSetId, setSelectedSetId] = useState(defaultSet?.id || sets[0]?.id || '');
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
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [inspectingSubmission, setInspectingSubmission] = useState<HomeworkSubmission | null>(null);

  // Firebase Auth + Vercel Public Domain State
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [vercelDomain, setVercelDomainState] = useState<string>(() => getVercelPublicDomain());
  const [editingDomain, setEditingDomain] = useState(false);

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

  // Real-time Firestore listener while modal is open so student submissions from Vercel appear live!
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

  if (!isOpen) return null;

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

      const payload: HomeworkAssignment = {
        id: generatedId,
        title: title.trim() || `واجب تفاعلي: ${currentSet.title}`,
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
        deadline: hasDeadline && deadlineDate ? new Date(deadlineDate).toISOString() : undefined,
        maxAttempts,
        allowReplay: true,
        isActive: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: 'Teacher'
      };

      // Save locally and directly to Firebase Firestore so Vercel has it immediately!
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
      // Fallback already saved locally & Firestore
      if (currentSet) {
        const chosenItems = currentSet.items.filter((it) => selectedItemIds.includes(it.id));
        const finalItems = chosenItems.length > 0 ? chosenItems : currentSet.items;
        const fallbackHw: HomeworkAssignment = {
          id: 'hw_' + Math.random().toString(36).substring(2, 8),
          title: title.trim() || `واجب تفاعلي: ${currentSet.title}`,
          setSnapshot: { ...currentSet, items: finalItems },
          selectedItemIds: finalItems.map((it) => it.id),
          flowMode,
          questionTypes,
          blooketMode,
          allowedGameModes: [blooketMode],
          questionCount: finalItems.length * questionTypes.length,
          targetQuestionCount: finalItems.length * questionTypes.length,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 font-sans" dir="rtl">
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header + Tabs */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-indigo-600/20 to-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                نظام الواجبات التفاعلي — Blooket Homework 🏆
              </h2>
              <p className="text-xs text-slate-400">
                اختر الكلمات، المعلّم الناطق، أنواع الأسئلة، وتابع نتائج طلابك لحظة بلحظة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('create');
                  setSelectedDetails(null);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'create'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'results'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>نتائج الطلاب ({assignmentsList.length || getLocalAssignments().length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cloud Sync + Vercel Domain Bar */}
        <div className="px-4 sm:px-6 py-2 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>مزامنة سحابية مفعّلة (Vercel & Firebase)</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-slate-400 font-bold">دومين فيرسيل:</span>
            {editingDomain ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  dir="ltr"
                  value={vercelDomain}
                  onChange={(e) => setVercelDomainState(e.target.value)}
                  className="px-2 py-0.5 bg-slate-900 border border-amber-500/50 rounded-lg text-[11px] font-mono text-amber-300 w-56 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cleaned = setVercelPublicDomain(vercelDomain);
                    setVercelDomainState(cleaned);
                    setEditingDomain(false);
                  }}
                  className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black rounded-lg text-[10px] cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingDomain(true)}
                dir="ltr"
                className="text-[11px] font-mono text-amber-400 hover:underline cursor-pointer truncate max-w-[220px]"
                title="اضغط لتعديل دومين فيرسيل"
              >
                {vercelDomain} ✎
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'create' ? (
            !createdShareLink ? (
              <form onSubmit={handleCreate} className="space-y-5">
                {/* 1. Set & Title */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>1. اختر المجموعة / الدرس:</span>
                    </label>
                    <select
                      value={selectedSetId}
                      onChange={(e) => setSelectedSetId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm font-bold outline-none focus:border-amber-500"
                    >
                      {sets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.items.length} كلمة)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">
                      عنوان الواجب (اختياري):
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={currentSet ? `واجب تفاعلي: ${currentSet.title}` : 'عنوان الواجب...'}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm font-bold outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* 2. Student Flow Mode: Start with Teacher Pronunciation vs Start with Questions Directly */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />
                    <span>2. كيف يبدأ الطالب الواجب؟</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFlowMode('teacher_then_quiz')}
                      className={`p-3.5 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                        flowMode === 'teacher_then_quiz'
                          ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-black text-sm text-emerald-300 flex items-center justify-between">
                        <span>👨‍🏫 يبدأ بالمعلّم الناطق ثم الأسئلة</span>
                        {flowMode === 'teacher_then_quiz' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        يستمع الطالب لنطق كل كلمة بالسرعة العادية والبطيئة ويتعلم معناها أولاً، ثم ينتقل للأسئلة المتدرجة فالتقييم النهائي.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFlowMode('quiz_only')}
                      className={`p-3.5 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                        flowMode === 'quiz_only'
                          ? 'bg-amber-500/15 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-black text-sm text-amber-300 flex items-center justify-between">
                        <span>🎯 يبدأ بالأسئلة على طول ثم التقييم</span>
                        {flowMode === 'quiz_only' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        يدخل الطالب على مراحل الأسئلة المختارة مباشرة بدون مرحلة الشرح الأولي، وفي النهاية يظهر التقييم الكامل.
                      </p>
                    </button>
                  </div>
                </div>

                {/* 3. Question Types Selection & Sequence */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4" />
                      <span>3. اختر أنواع الأسئلة وترتيبها في الواجب ({questionTypes.length} مراحل):</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setQuestionTypes(QUESTION_TYPE_META.map((m) => m.id))}
                      className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      تفعيل جميع الأنواع
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {QUESTION_TYPE_META.map((qMeta) => {
                      const orderIdx = questionTypes.indexOf(qMeta.id);
                      const isSelected = orderIdx !== -1;
                      return (
                        <button
                          key={qMeta.id}
                          type="button"
                          onClick={() => toggleQuestionType(qMeta.id)}
                          className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-500/15 border-indigo-400 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isSelected ? orderIdx + 1 : '+'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black flex items-center gap-1">
                              <span>{qMeta.badgeEmoji}</span>
                              <span className="truncate">{qMeta.labelAr}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{qMeta.descAr}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Select Specific Words/Questions from the Set */}
                {currentSet && currentSet.items.length > 0 && (
                  <div className="space-y-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-200">
                        4. تحديد الكلمات المشمولة في الواجب ({selectedItemIds.length} من {currentSet.items.length} كلمة):
                      </span>
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setSelectedItemIds(currentSet.items.map((it) => it.id))}
                          className="text-amber-400 hover:underline cursor-pointer"
                        >
                          تحديد الكل
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedItemIds([currentSet.items[0].id])}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pt-1 pr-1">
                      {currentSet.items.map((item) => {
                        const checked = selectedItemIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleWordItem(item.id)}
                            className={`px-2.5 py-2 rounded-xl border text-right text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                              checked
                                ? 'bg-amber-400/15 border-amber-400/60 text-white font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-500'
                            }`}
                          >
                            <div className="truncate">
                              <span className="ml-1">{item.emoji || '📘'}</span>
                              <span dir="ltr">{item.german}</span>
                              <span className="text-[10px] text-slate-400 block truncate">{item.arabic}</span>
                            </div>
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                                checked ? 'bg-amber-400 text-slate-950' : 'border border-slate-700'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. Blooket Mode & Attempts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">
                      5. طابع مكافآت Blooket للطالب:
                    </label>
                    <select
                      value={blooketMode}
                      onChange={(e) => setBlooketMode(e.target.value as HomeworkBlooketMode)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-white text-xs font-bold outline-none focus:border-amber-500"
                    >
                      <option value="gold_quest">🎁 صناديق الذهب (Blooket Gold Quest — 3 صناديق كنز بعد كل إجابة)</option>
                      <option value="classic_quiz">🎯 اختبار قياسي سريع مع نقاط وسلسلة انتصارات</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">
                      عدد المحاولات المسموحة للطالب:
                    </label>
                    <select
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-white text-xs font-bold outline-none focus:border-amber-500"
                    >
                      <option value={0}>غير محدود (مفتوح للتدريب)</option>
                      <option value={1}>محاولة واحدة فقط (اختبار رسمي)</option>
                      <option value={2}>محاولتان (2)</option>
                      <option value={3}>3 محاولات</option>
                    </select>
                  </div>
                </div>

                {/* Summary & Submit Button */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-bold text-slate-300">
                    إجمالي الأسئلة في هذا الواجب:{' '}
                    <span className="text-amber-400 font-black">
                      {selectedItemIds.length * questionTypes.length} سؤال
                    </span>{' '}
                    ({selectedItemIds.length} كلمات × {questionTypes.length} مراحل)
                  </div>

                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 flex items-center gap-2 text-sm cursor-pointer active:scale-95 transition-all"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري إنشاء الواجب...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>إنشاء رابط الواجب الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Created Link Screen */
              <div className="space-y-5 text-center py-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div>
                  <h4 className="text-xl font-black text-white">تم تجهيز الواجب التفاعلي بنجاح! 🎉</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    انسخ الرابط وأرسله لطلابك على واتساب أو التليجرام — كل طالب يحل الواجب ستظهر نتيجته فوراً في تبويب «نتائج الطلاب»
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    dir="ltr"
                    value={createdShareLink}
                    className="bg-transparent text-amber-400 font-mono text-xs flex-1 outline-none truncate"
                  />
                  <button
                    onClick={() => handleCopy(createdShareLink, 'created')}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer"
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

                <div className="flex flex-wrap gap-2.5 justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `🇩🇪 *واجب الألماني التفاعلي (Glück Lernstudio)*\n📚 *${createdAssignment?.title || 'واجب جديد'}*\n\nيرجى الضغط على الرابط التالي لبدء حل الواجب:\n${createdShareLink}`;
                      navigator.clipboard.writeText(msg);
                      setCopiedId('whatsapp_msg');
                      setTimeout(() => setCopiedId(null), 2500);
                    }}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>
                      {copiedId === 'whatsapp_msg'
                        ? 'تم نسخ رسالة واتساب لولي الأمر! ✅'
                        : 'نسخ رسالة واتساب جاهزة لولي الأمر 💬'}
                    </span>
                  </button>

                  <a
                    href={createdShareLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-black rounded-xl flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> تجربة فتح الواجب كطالب
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
                    className="px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> متابعة نتائج الطلاب لهذا الواجب
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreatedShareLink(null);
                      setCreatedAssignment(null);
                    }}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    إنشاء واجب آخر
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ============================================================================
             * TAB 2: LIVE STUDENT SUBMISSIONS & BLOOKET ANALYTICS FOR TEACHER
             * ============================================================================ */
            <div className="space-y-4">
              {selectedDetails ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDetails(null);
                        setInspectingSubmission(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>العودة لقائمة الواجبات</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(selectedDetails.assignment.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingDetails ? 'animate-spin' : ''}`} />
                        <span>تحديث نتائج الطلاب</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(buildHomeworkShareUrl(selectedDetails.assignment), selectedDetails.assignment.id)
                        }
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedId === selectedDetails.assignment.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> تم النسخ
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> نسخ رابط الطالب
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Assignment Summary Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black text-white">{selectedDetails.assignment.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedDetails.assignment.setSnapshot?.title} •{' '}
                        {selectedDetails.assignment.flowMode === 'quiz_only'
                          ? '🎯 يبدأ بالأسئلة مباشرة'
                          : '👨‍🏫 يبدأ بالمعلّم الناطق ثم الأسئلة'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xl font-black text-amber-400">
                          {selectedDetails.submissions?.length || 0}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400">إجابات الطلاب</div>
                      </div>
                      <div className="text-center border-r border-slate-800 pr-4">
                        <div className="text-xl font-black text-emerald-400">
                          {selectedDetails.submissions?.length > 0
                            ? `${Math.round(
                                selectedDetails.submissions.reduce(
                                  (acc: number, s: any) => acc + (s.accuracy ?? s.scorePercentage ?? 0),
                                  0
                                ) / selectedDetails.submissions.length
                              )}%`
                            : '—'}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400">متوسط التقييم</div>
                      </div>
                    </div>
                  </div>

                  {/* Inspecting single student's answers */}
                  {inspectingSubmission ? (
                    <div className="bg-slate-950 border-2 border-indigo-500/40 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-black text-white">
                            تفاصيل إجابات الطالب: {inspectingSubmission.studentName}
                          </h4>
                          <p className="text-xs text-slate-400">
                            الدرجة: {inspectingSubmission.correctAnswersCount} / {inspectingSubmission.totalQuestions} (
                            {inspectingSubmission.scorePercentage}%) • 💰 {inspectingSubmission.goldEarned || 0} ذهب
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectingSubmission(null)}
                          className="px-3 py-1 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 cursor-pointer"
                        >
                          إغلاق التفاصيل
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {(inspectingSubmission.responses || []).map((r, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold ${
                              r.isCorrect
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            }`}
                          >
                            <div>
                              <span className="text-white font-black">{r.germanWord}</span>
                              {r.promptText && (
                                <span className="text-[10px] text-slate-400 block">{r.promptText}</span>
                              )}
                            </div>
                            <div className="text-left">
                              <div>إجابة الطالب: {r.studentAnswer}</div>
                              {!r.isCorrect && <div className="text-[10px] text-amber-300">الصواب: {r.correctAnswer}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Submissions Leaderboard Table */}
                  {!selectedDetails.submissions || selectedDetails.submissions.length === 0 ? (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                      <Users className="w-10 h-10 text-slate-500 mx-auto" />
                      <p className="text-sm font-bold text-slate-300">لم يقم أي طالب بإرسال الواجب حتى الآن</p>
                      <p className="text-xs text-slate-500">
                        شارك الرابط مع طلابك أو جرب فتحه وحله كطالب ثم اضغط «تحديث نتائج الطلاب»
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                        <Trophy className="w-4 h-4" />
                        <span>ترتيب الطلاب والنتائج المستلمة ({selectedDetails.submissions.length}):</span>
                      </h4>
                      <div className="space-y-2">
                        {selectedDetails.submissions.map((sub: HomeworkSubmission, idx: number) => {
                          const acc = sub.accuracy ?? sub.scorePercentage ?? 0;
                          return (
                            <div
                              key={sub.id}
                              className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-xl bg-amber-400/20 text-amber-300 font-black text-xs flex items-center justify-center">
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                </span>
                                <div>
                                  <div className="text-sm font-black text-white">{sub.studentName}</div>
                                  <div className="text-[11px] text-slate-400">
                                    الوقت: {sub.timeSpentSeconds} ثانية •{' '}
                                    {new Date(sub.completedAt).toLocaleTimeString('ar-EG', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-amber-300">
                                  💰 {sub.goldEarned ?? (sub.correctAnswersCount || 0) * 100}
                                </span>
                                <span className="text-xs font-bold text-slate-300">
                                  {sub.correctAnswersCount} / {sub.totalQuestions}
                                </span>
                                <span
                                  className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                                    acc >= 80
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : acc >= 50
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {acc}%
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setInspectingSubmission(sub)}
                                  className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>إجابات الطالب</span>
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
                /* List of All Created Assignments */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-300">
                      جميع الواجبات المنشأة ({assignmentsList.length}):
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={loadAllAssignments}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingResults ? 'animate-spin' : ''}`} />
                        <span>تحديث</span>
                      </button>
                      <a
                        href="/teacher"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-black flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>لوحة المعلم الكاملة</span>
                      </a>
                    </div>
                  </div>

                  {assignmentsList.length === 0 ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                      <BookOpen className="w-10 h-10 text-amber-400 mx-auto" />
                      <p className="text-sm font-bold text-white">لم تقم بإنشاء أي واجب بعد</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                      >
                        + إنشاء أول واجب تفاعلي
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {assignmentsList.map((hw) => {
                        const shareUrl = buildHomeworkShareUrl(hw);
                        return (
                          <div
                            key={hw.id}
                            className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-white">{hw.title}</span>
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                                  {hw.flowMode === 'quiz_only' ? '🎯 أسئلة مباشرة' : '👨‍🏫 معلم ناطق + أسئلة'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                {hw.setSnapshot?.title} • {hw.submissionCount || 0} طلاب سلّموا الواجب • متوسط الدقة:{' '}
                                {hw.avgAccuracy > 0 ? `${hw.avgAccuracy}%` : '—'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopy(shareUrl, hw.id)}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                              >
                                {copiedId === hw.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" /> تم النسخ
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" /> نسخ الرابط
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenDetails(hw.id)}
                                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <BarChart3 className="w-3.5 h-3.5" />
                                <span>عرض النتائج ({hw.submissionCount || 0})</span>
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
    </div>
  );
};
