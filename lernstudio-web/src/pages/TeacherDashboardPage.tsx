import React, { useState, useEffect, useMemo } from 'react';
import { DEFAULT_LERNSTUDIO_SETS } from '../../shared/defaultLernstudioSets';
import type {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkFlowMode,
  HomeworkQuestionType,
  HomeworkBlooketMode
} from '../../shared/homeworkTypes';
import {
  QUESTION_TYPE_META,
  buildHomeworkShareUrl,
  saveLocalAssignment,
  saveLocalSubmission,
  syncAndFetchTeacherAssignments,
  fetchAssignmentDetailsWithSync,
  subscribeAssignmentsFromFirestore,
  subscribeSubmissionsFromFirestore,
  signInTeacherWithGoogle,
  signOutTeacherFirebase,
  subscribeTeacherAuth
} from '../../shared/homeworkStorageSync';
import { subscribeLernstudioSetsFromFirestore } from '../../shared/firebaseCloudSync';
import {
  ShieldCheck,
  Lock,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Users,
  Award,
  Download,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  XCircle,
  CheckCircle2,
  BookOpen,
  Sparkles,
  BarChart3,
  LogOut,
  RefreshCw,
  GraduationCap,
  ListChecks,
  Eye
} from 'lucide-react';

interface AssignmentWithStats extends HomeworkAssignment {
  submissionCount: number;
  avgScore: number;
  avgAccuracy: number;
}

interface DetailedViewData {
  assignment: HomeworkAssignment;
  submissions: HomeworkSubmission[];
  questionAccuracy: {
    questionId: string;
    prompt: string;
    correctAnswer: string;
    totalAttempts: number;
    correctCount: number;
    accuracyPercent: number;
  }[];
}

export const TeacherDashboardPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [assignments, setAssignments] = useState<AssignmentWithStats[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New assignment modal state (Blooket style)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedSetId, setSelectedSetId] = useState(DEFAULT_LERNSTUDIO_SETS[0]?.id || '');
  const [flowMode, setFlowMode] = useState<HomeworkFlowMode>('teacher_then_quiz');
  const [questionTypes, setQuestionTypes] = useState<HomeworkQuestionType[]>([
    'mc_de_ar',
    'true_false',
    'listen_choose'
  ]);
  const [blooketMode, setBlooketMode] = useState<HomeworkBlooketMode>('gold_quest');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [maxAttempts, setMaxAttempts] = useState(0);
  const [allowReplay, setAllowReplay] = useState(true);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);

  // Detailed view state
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [detailedData, setDetailedData] = useState<DetailedViewData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [inspectingSubmission, setInspectingSubmission] = useState<HomeworkSubmission | null>(null);
  const [allSets, setAllSets] = useState<any[]>(DEFAULT_LERNSTUDIO_SETS);

  const currentSet = useMemo(
    () => allSets.find((s) => s.id === selectedSetId) || allSets[0] || DEFAULT_LERNSTUDIO_SETS[0],
    [allSets, selectedSetId]
  );

  useEffect(() => {
    if (currentSet?.items) {
      setSelectedItemIds(currentSet.items.map((it) => it.id));
    }
  }, [currentSet?.id]);

  // Subscribe to custom Lernstudio sets synced from Main Program via Firestore
  useEffect(() => {
    const unsubSets = subscribeLernstudioSetsFromFirestore((cloudSets) => {
      if (cloudSets.length > 0) {
        const map = new Map<string, any>();
        cloudSets.forEach((s) => map.set(s.id, s));
        DEFAULT_LERNSTUDIO_SETS.forEach((s) => {
          if (!map.has(s.id)) map.set(s.id, s);
        });
        setAllSets(Array.from(map.values()));
      }
    });
    return () => unsubSets();
  }, []);

  // Subscribe to Firebase Auth + Real-Time Firestore Assignments & Submissions
  useEffect(() => {
    const unsubAuth = subscribeTeacherAuth((user) => {
      if (user) {
        setIsAuthenticated(true);
        syncAndFetchTeacherAssignments().then((list) => setAssignments(list as AssignmentWithStats[]));
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubAssignments = subscribeAssignmentsFromFirestore((cloudList) => {
      cloudList.forEach((hw) => saveLocalAssignment(hw, false));
      syncAndFetchTeacherAssignments().then((list) => setAssignments(list as AssignmentWithStats[]));
    });
    const unsubSubmissions = subscribeSubmissionsFromFirestore(null, (cloudSubs) => {
      cloudSubs.forEach((sub) => saveLocalSubmission(sub, false));
      syncAndFetchTeacherAssignments().then((list) => setAssignments(list as AssignmentWithStats[]));
      if (selectedAssignmentId) {
        fetchAssignmentDetailsWithSync(selectedAssignmentId).then((details) => {
          if (details) setDetailedData(details);
        });
      }
    });
    return () => {
      unsubAssignments();
      unsubSubmissions();
    };
  }, [isAuthenticated, selectedAssignmentId]);

  const safeJson = async (res: Response): Promise<any> => {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { error: `Serverfehler (${res.status}): Bitte Seite neu laden.` };
    }
  };

  const loadAssignments = async () => {
    setIsLoadingAssignments(true);
    try {
      const authRes = await fetch('/api/teacher/login', { credentials: 'include' });
      const authData = await safeJson(authRes);
      if (!authRes.ok || !authData.authenticated) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);
      const syncedList = await syncAndFetchTeacherAssignments();
      setAssignments(syncedList as AssignmentWithStats[]);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: passwordInput })
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setLoginError(data.error || 'كلمة المرور غير صحيحة / Falsches Passwort');
      } else {
        setIsAuthenticated(true);
        setPasswordInput('');
        const syncedList = await syncAndFetchTeacherAssignments();
        setAssignments(syncedList as AssignmentWithStats[]);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Verbindungsfehler');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutTeacherFirebase();
      await fetch('/api/teacher/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    setIsAuthenticated(false);
    setAssignments([]);
    setSelectedAssignmentId(null);
    setDetailedData(null);
  };

  const toggleQuestionType = (type: HomeworkQuestionType) => {
    setQuestionTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const toggleWordItem = (id: string) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
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
        title: newTitle.trim() || `واجب تفاعلي: ${currentSet.title}`,
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
        allowReplay,
        isActive: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: 'Teacher'
      };

      saveLocalAssignment(payload);

      const res = await fetch('/api/teacher/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await safeJson(res);
      const finalHw: HomeworkAssignment =
        res.ok && data?.assignment ? { ...payload, ...data.assignment } : payload;

      saveLocalAssignment(finalHw);
      setCreatedShareLink(buildHomeworkShareUrl(finalHw));
      const syncedList = await syncAndFetchTeacherAssignments();
      setAssignments(syncedList as AssignmentWithStats[]);
    } finally {
      setIsCreating(false);
    }
  };

  const loadDetails = async (id: string) => {
    setSelectedAssignmentId(id);
    setIsLoadingDetails(true);
    setInspectingSubmission(null);
    try {
      const data = await fetchAssignmentDetailsWithSync(id);
      if (data) {
        setDetailedData(data);
      }
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const toggleAssignmentStatus = async (assignment: HomeworkAssignment) => {
    const updatedStatus = assignment.status === 'active' ? 'closed' : 'active';
    try {
      const res = await fetch('/api/teacher/assignment-details', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: assignment.id, status: updatedStatus })
      });
      if (res.ok) {
        loadAssignments();
        if (detailedData) {
          setDetailedData({
            ...detailedData,
            assignment: { ...detailedData.assignment, status: updatedStatus }
          });
        }
      }
    } catch {}
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const exportCSV = () => {
    if (!detailedData) return;
    const { assignment, submissions } = detailedData;
    const rows = [
      ['اسم الطالب', 'الدرجة', 'إجمالي الأسئلة', 'النسبة المئوية (%)', 'ذهب Blooket', 'الوقت (ثانية)', 'تاريخ التسليم'],
      ...submissions.map((sub) => [
        `"${sub.studentName.replace(/"/g, '""')}"`,
        sub.score ?? sub.correctAnswersCount,
        sub.totalQuestions,
        sub.accuracy ?? sub.scorePercentage,
        sub.goldEarned ?? 0,
        sub.timeSpentSeconds,
        `"${new Date(sub.completedAt).toLocaleString('de-DE')}"`
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Homework_${assignment.title.replace(/\s+/g, '_')}_Results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Render Login Screen if not authenticated ---
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white flex flex-col justify-center items-center px-4 font-sans" dir="rtl">
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4">
              <ShieldCheck className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">لوحة تحكم المعلّم — Blooket Homework</h1>
            <p className="text-slate-400 text-xs mt-1">إدارة الواجبات التفاعلية ومتابعة تقييمات الطلاب</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                كلمة مرور المعلم (Lehrer-Passwort):
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="أدخل كلمة المرور..."
                  required
                  autoFocus
                  dir="ltr"
                  className="w-full pr-11 pl-4 py-3 bg-slate-950/70 border border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-2xl text-white placeholder-slate-600 text-base outline-none transition-all"
                />
              </div>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <span>تسجيل الدخول بكلمة المرور</span>
              )}
            </button>

            <div className="relative py-2 flex items-center justify-center">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-slate-900 px-3 text-[11px] text-slate-400 font-bold">أو</span>
              <div className="border-t border-slate-800 w-full"></div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setLoginError(null);
                setIsLoggingIn(true);
                try {
                  const user = await signInTeacherWithGoogle();
                  if (user) {
                    setIsAuthenticated(true);
                    const syncedList = await syncAndFetchTeacherAssignments();
                    setAssignments(syncedList as AssignmentWithStats[]);
                  }
                } catch (err: any) {
                  setLoginError('تعذر تسجيل الدخول عبر Google، يمكنك استخدام كلمة المرور gluck2025');
                } finally {
                  setIsLoggingIn(false);
                }
              }}
              className="w-full py-3 bg-indigo-600/25 hover:bg-indigo-600/35 border border-indigo-500/40 text-indigo-200 font-black rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              <span>☁️ تسجيل الدخول بحساب Google (المتصل بالبرنامج الرئيسي)</span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <a href="/" className="hover:text-slate-300 transition-colors flex items-center gap-1 font-bold">
              <ArrowLeft className="w-3.5 h-3.5" /> العودة إلى استوديو التعلّم
            </a>
            <span>Glück Lernstudio Web</span>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <span className="text-sm text-slate-400 font-bold">جاري تحميل لوحة المعلم...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16" dir="rtl">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/85 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 transition-colors"
              title="العودة للاستوديو"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center font-black text-lg shadow-md">
              🏆
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                لوحة تحكم المعلم — نتائج وتحديات الواجبات (Blooket Style)
              </h1>
              <p className="text-xs text-slate-400">إنشاء الواجبات التفاعلية ومتابعة إجابات كل طالب بالتفصيل</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setShowCreateModal(true);
                setCreatedShareLink(null);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إنشاء واجب جديد</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-red-950/60 hover:text-red-300 text-slate-400 transition-colors cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6">
        {selectedAssignmentId && detailedData ? (
          /* --- DETAILED ASSIGNMENT VIEW --- */
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => {
                  setSelectedAssignmentId(null);
                  setDetailedData(null);
                  setInspectingSubmission(null);
                }}
                className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white font-black bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" /> العودة لجميع الواجبات
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => loadDetails(detailedData.assignment.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-black cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDetails ? 'animate-spin' : ''}`} />
                  <span>تحديث النتائج الآن</span>
                </button>

                <button
                  onClick={() => toggleAssignmentStatus(detailedData.assignment)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 cursor-pointer ${
                    detailedData.assignment.status === 'active'
                      ? 'bg-red-950/40 border-red-800/60 text-red-300 hover:bg-red-900/50'
                      : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50'
                  }`}
                >
                  {detailedData.assignment.status === 'active' ? (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> إغلاق الواجب
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> إعادة فتح الواجب
                    </>
                  )}
                </button>

                <button
                  onClick={() =>
                    copyToClipboard(
                      buildHomeworkShareUrl(detailedData.assignment),
                      detailedData.assignment.id
                    )
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-black text-slate-200 cursor-pointer"
                >
                  {copiedId === detailedData.assignment.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> تم النسخ!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> نسخ رابط الطالب
                    </>
                  )}
                </button>

                {detailedData.submissions.length > 0 && (
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-black cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> تصدير Excel / CSV
                  </button>
                )}
              </div>
            </div>

            {/* Assignment Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                        detailedData.assignment.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700/50 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {detailedData.assignment.status === 'active' ? 'مفتوح للطلاب' : 'مغلق'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {detailedData.assignment.flowMode === 'quiz_only'
                        ? '🎯 يبدأ بالأسئلة مباشرة'
                        : '👨‍🏫 يبدأ بالمعلّم الناطق ثم الأسئلة'}
                    </span>
                    <span className="text-slate-400 text-xs flex items-center gap-1 font-bold">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      المجموعة: {detailedData.assignment.setSnapshot.title}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white">{detailedData.assignment.title}</h2>
                </div>

                <div className="grid grid-cols-3 gap-3 md:gap-6 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <div className="text-center">
                    <div className="text-2xl font-black text-amber-400">{detailedData.submissions.length}</div>
                    <div className="text-[11px] font-bold text-slate-400">إجابات الطلاب</div>
                  </div>
                  <div className="text-center border-x border-slate-800 px-4">
                    <div className="text-2xl font-black text-emerald-400">
                      {detailedData.submissions.length > 0
                        ? `${Math.round(
                            detailedData.submissions.reduce(
                              (acc, s) => acc + (s.accuracy ?? s.scorePercentage ?? 0),
                              0
                            ) / detailedData.submissions.length
                          )}%`
                        : '—'}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400">متوسط التقييم</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-indigo-400">
                      {detailedData.submissions.length > 0
                        ? `${Math.round(
                            detailedData.submissions.reduce((acc, s) => acc + s.timeSpentSeconds, 0) /
                              detailedData.submissions.length
                          )}ث`
                        : '—'}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400">متوسط الوقت</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inspecting Single Student Modal / Drawer */}
            {inspectingSubmission && (
              <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white">
                      إجابات الطالب التفصيلية: {inspectingSubmission.studentName}
                    </h3>
                    <p className="text-xs font-bold text-slate-400">
                      النتيجة: {inspectingSubmission.correctAnswersCount} من {inspectingSubmission.totalQuestions} (
                      {inspectingSubmission.scorePercentage}%) • 💰 {inspectingSubmission.goldEarned || 0} ذهب
                    </p>
                  </div>
                  <button
                    onClick={() => setInspectingSubmission(null)}
                    className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-black text-white cursor-pointer"
                  >
                    إغلاق التفاصيل
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto">
                  {(inspectingSubmission.responses || []).map((r, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                        r.isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div>
                        <div className="font-black text-white text-sm">{r.germanWord}</div>
                        <div className="text-[11px] text-slate-400">{r.promptText}</div>
                      </div>
                      <div className="text-left">
                        <div>إجابة الطالب: {r.studentAnswer}</div>
                        {!r.isCorrect && <div className="text-amber-300">الصواب: {r.correctAnswer}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Hardest Questions */}
              <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-base font-black text-white flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  تحليل أصعب الكلمات للطلاب
                </h3>
                {detailedData.questionAccuracy.length === 0 ? (
                  <p className="text-slate-500 text-xs py-8 text-center font-bold">
                    لا توجد إجابات مسجلة بعد.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {detailedData.questionAccuracy.slice(0, 10).map((q) => (
                      <div
                        key={q.questionId}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-black text-white truncate max-w-[150px]">{q.prompt}</span>
                          <span
                            className={`font-black ${
                              q.accuracyPercent >= 80
                                ? 'text-emerald-400'
                                : q.accuracyPercent >= 50
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            {q.accuracyPercent}% إجابات صحيحة
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              q.accuracyPercent >= 80
                                ? 'bg-emerald-500'
                                : q.accuracyPercent >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${q.accuracyPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-bold">
                          <span>الإجابة: {q.correctAnswer}</span>
                          <span>
                            {q.correctCount} من {q.totalAttempts}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submissions Leaderboard Table */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-base font-black text-white flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-indigo-400" />
                  لوحة شرف ونتائج الطلاب ({detailedData.submissions.length})
                </h3>

                {detailedData.submissions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-300 text-sm font-bold">لم يرسل أي طالب إجابته بعد.</p>
                    <p className="text-slate-500 text-xs mt-1">
                      انسخ رابط الطالب وشاركه مع طلابك، ثم اضغط «تحديث النتائج الآن»!
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-black text-slate-400">
                          <th className="py-3 px-3">المركز & الطالب</th>
                          <th className="py-3 px-3">الدرجة</th>
                          <th className="py-3 px-3">التقييم</th>
                          <th className="py-3 px-3">الذهب 💰</th>
                          <th className="py-3 px-3">الوقت</th>
                          <th className="py-3 px-3">التفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {detailedData.submissions.map((sub, idx) => {
                          const acc = sub.accuracy ?? sub.scorePercentage ?? 0;
                          return (
                            <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-3 font-black text-white flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-black text-xs flex items-center justify-center border border-amber-500/30">
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                </span>
                                {sub.studentName}
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-200">
                                {sub.score ?? sub.correctAnswersCount} / {sub.totalQuestions}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                                    acc >= 80
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : acc >= 50
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : 'bg-red-500/20 text-red-400'
                                  }`}
                                >
                                  {acc}%
                                </span>
                              </td>
                              <td className="py-3 px-3 font-black text-amber-300 text-xs">
                                💰 {sub.goldEarned ?? (sub.correctAnswersCount || 0) * 100}
                              </td>
                              <td className="py-3 px-3 text-slate-400 text-xs font-bold">
                                {sub.timeSpentSeconds} ثانية
                              </td>
                              <td className="py-3 px-3">
                                <button
                                  onClick={() => setInspectingSubmission(sub)}
                                  className="px-3 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>عرض الإجابات</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* --- ASSIGNMENTS LIST VIEW --- */
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-white">جميع الواجبات والتحديات التفاعلية</h1>
                <p className="text-slate-400 text-sm mt-1">
                  اختر أي واجب لنسخ رابط الطلاب أو استعراض تقييمات وإجابات الطلاب التفصيلية
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadAssignments}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-black flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingAssignments ? 'animate-spin' : ''}`} />
                  <span>تحديث قائمة الواجبات والنتائج</span>
                </button>
              </div>
            </div>

            {assignments.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white mb-2">لا توجد واجبات منشأة بعد</h3>
                <p className="text-slate-400 text-sm mb-6">
                  أنشئ واجبك الأول الآن وحدد الكلمات، المعلّم الناطق، وأنواع الأسئلة التفاعلية بأسلوب Blooket!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> إنشاء أول واجب تفاعلي
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignments.map((item) => {
                  const shareUrl = buildHomeworkShareUrl(item);
                  const isExpired = item.deadline && new Date(item.deadline) < new Date();
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              item.status === 'active' && !isExpired
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {item.flowMode === 'quiz_only' ? '🎯 أسئلة مباشرة' : '👨‍🏫 معلم ناطق + أسئلة'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-bold">
                            {new Date(item.createdAt).toLocaleDateString('ar-EG')}
                          </span>
                        </div>

                        <h3 className="text-lg font-black text-white line-clamp-1 mb-1">{item.title}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-4 font-bold">
                          <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{item.setSnapshot?.title}</span>
                          <span className="text-slate-600">•</span>
                          <span>{item.questionCount} سؤال</span>
                        </p>

                        <div className="grid grid-cols-2 gap-2 bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80 mb-4">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                            <div>
                              <div className="text-sm font-black text-white">{item.submissionCount || 0}</div>
                              <div className="text-[10px] text-slate-500 font-bold">إجابات الطلاب</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <div className="text-sm font-black text-emerald-400">
                                {item.avgAccuracy > 0 ? `${item.avgAccuracy}%` : '—'}
                              </div>
                              <div className="text-[10px] text-slate-500 font-bold">متوسط التقييم</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/70">
                        <button
                          onClick={() => copyToClipboard(shareUrl, item.id)}
                          className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" /> تم النسخ!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> نسخ رابط الطالب
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => loadDetails(item.id)}
                          className="py-2.5 px-4 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>النتائج ({item.submissionCount || 0})</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- CREATE ASSIGNMENT MODAL (Blooket Style) --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">إنشاء واجب تفاعلي جديد — Blooket</h3>
                  <p className="text-slate-400 text-xs">حدد الكلمات، المعلّم الناطق، وأنواع الأسئلة المطلوبة</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {createdShareLink ? (
              <div className="space-y-5 text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-white">تم إنشاء الواجب بنجاح! 🎉</h4>
                  <p className="text-slate-400 text-xs mt-1">شارك هذا الرابط مع طلابك:</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
                  <input
                    type="text"
                    readOnly
                    dir="ltr"
                    value={createdShareLink}
                    className="bg-transparent text-xs text-amber-300 font-mono w-full outline-none select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(createdShareLink, 'modal')}
                    className="px-3 py-1.5 bg-amber-400 text-slate-950 font-black text-xs rounded-xl shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'modal' ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> تم النسخ
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> نسخ الرابط
                      </>
                    )}
                  </button>
                </div>

                <div className="flex gap-2">
                  <a
                    href={createdShareLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> تجربة الواجب كطالب
                  </a>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreatedShareLink(null);
                    }}
                    className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    إغلاق ومتابعة النتائج
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">
                      1. اختر الدرس / المجموعة:
                    </label>
                    <select
                      value={selectedSetId}
                      onChange={(e) => setSelectedSetId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-sm font-bold outline-none"
                    >
                      {DEFAULT_LERNSTUDIO_SETS.map((s) => (
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
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder={`واجب تفاعلي: ${currentSet?.title || ''}`}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white text-sm font-bold outline-none"
                    />
                  </div>
                </div>

                {/* Flow Mode */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />
                    <span>2. كيف يبدأ الطالب الواجب؟</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFlowMode('teacher_then_quiz')}
                      className={`p-3 rounded-2xl border-2 text-right cursor-pointer ${
                        flowMode === 'teacher_then_quiz'
                          ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-black text-xs text-emerald-300">
                        👨‍🏫 يبدأ بالمعلّم الناطق (نطق الكلمات) ثم الأسئلة والتقييم
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlowMode('quiz_only')}
                      className={`p-3 rounded-2xl border-2 text-right cursor-pointer ${
                        flowMode === 'quiz_only'
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-black text-xs text-amber-300">
                        🎯 يبدأ بالأسئلة على طول ثم التقييم النهائي
                      </div>
                    </button>
                  </div>
                </div>

                {/* Question Types */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4" />
                    <span>3. اختر أنواع الأسئلة وترتيبها ({questionTypes.length} مراحل):</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {QUESTION_TYPE_META.map((qMeta) => {
                      const orderIdx = questionTypes.indexOf(qMeta.id);
                      const isSelected = orderIdx !== -1;
                      return (
                        <button
                          key={qMeta.id}
                          type="button"
                          onClick={() => toggleQuestionType(qMeta.id)}
                          className={`p-2.5 rounded-xl border text-right flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-500/15 border-indigo-400 text-white font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded text-[11px] font-black flex items-center justify-center ${
                              isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isSelected ? orderIdx + 1 : '+'}
                          </span>
                          <span className="text-xs truncate">
                            {qMeta.badgeEmoji} {qMeta.labelAr}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Words Picker */}
                {currentSet && (
                  <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span>4. الكلمات المختارة ({selectedItemIds.length} من {currentSet.items.length}):</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedItemIds(currentSet.items.map((i) => i.id))}
                          className="text-amber-400 cursor-pointer"
                        >
                          تحديد الكل
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedItemIds([currentSet.items[0].id])}
                          className="text-slate-400 cursor-pointer"
                        >
                          إلغاء الكل
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                      {currentSet.items.map((it) => {
                        const checked = selectedItemIds.includes(it.id);
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => toggleWordItem(it.id)}
                            className={`px-2 py-1.5 rounded-lg border text-right text-xs truncate cursor-pointer ${
                              checked
                                ? 'bg-amber-400/15 border-amber-400/50 text-white font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-500'
                            }`}
                          >
                            {it.emoji} {it.german} ({it.arabic})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الإنشاء...</span>
                    </>
                  ) : (
                    <span>إنشاء الواجب وتوليد رابط الطلاب الآن</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
