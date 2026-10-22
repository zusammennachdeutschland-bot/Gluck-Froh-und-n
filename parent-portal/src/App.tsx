import React, { useState, useEffect } from 'react';
import { StudentPortalData } from './types';
import { 
  fetchStudentPortalData, 
  getStoredSession, 
  clearSession, 
  saveSession, 
  setActiveSibling,
  requestSiblingLink,
  AuthSession 
} from './lib/firebase';
import { Header } from './components/Header';
import { StudentHero } from './components/StudentHero';
import { NextLessonCard } from './components/NextLessonCard';
import { LessonsTab } from './components/LessonsTab';
import { HomeworkGradesTab } from './components/HomeworkGradesTab';
import { CertificatesTab } from './components/CertificatesTab';
import { FinanceTab } from './components/FinanceTab';
import { LoginView } from './components/LoginView';
import { 
  BookOpen, Award, CreditCard, Calendar, RefreshCw, 
  Users, UserPlus, X, CheckCircle2, ShieldCheck, AlertCircle 
} from 'lucide-react';

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('portal_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [session, setSession] = useState<AuthSession | null>(getStoredSession);
  const [student, setStudent] = useState<StudentPortalData | null>(null);
  const [activeTab, setActiveTab] = useState<'lessons' | 'grades' | 'certificates' | 'finance'>('lessons');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sibling Linking Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [targetStudentCode, setTargetStudentCode] = useState('');
  const [linkingPinResult, setLinkingPinResult] = useState<{
    targetStudentName: string;
    pairingPin: string;
    instruction: string;
  } | null>(null);
  const [isLinkingLoading, setIsLinkingLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Sync Dark Mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('portal_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('portal_theme', 'light');
    }
  }, [darkMode]);

  // Load active student data when session is established
  useEffect(() => {
    if (session?.activeStudentCode) {
      loadStudentData(session.activeStudentCode);
    } else {
      // Check query params for quick testing
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get('code') || params.get('studentCode');
      if (codeParam) {
        loadStudentData(codeParam);
      }
    }
  }, [session?.activeStudentCode]);

  const loadStudentData = async (studentCode: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchStudentPortalData(studentCode);
      if (data) {
        setStudent(data);
      } else {
        setErrorMessage('لم يتم العثور على بيانات لهذا الطالب. يرجى مراجعة المعلم.');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'فشل الاتصال بالخادم.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    loadStudentData(newSession.activeStudentCode);
  };

  const handleSwitchSibling = (code: string) => {
    if (!session) return;
    setActiveSibling(code);
    setSession({
      ...session,
      activeStudentCode: code
    });
    loadStudentData(code);
  };

  const handleRefresh = async () => {
    if (!student) return;
    setIsRefreshing(true);
    try {
      const updated = await fetchStudentPortalData(student.studentCode || student.id);
      if (updated) {
        setStudent(updated);
      }
    } catch (e) {}
    setIsRefreshing(false);
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setStudent(null);
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleRequestSiblingLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setIsLinkingLoading(true);

    try {
      const result = await requestSiblingLink(targetStudentCode.trim());
      setLinkingPinResult({
        targetStudentName: result.targetStudentName,
        pairingPin: result.pairingPin,
        instruction: result.instruction
      });
    } catch (err: any) {
      setLinkError(err.message || 'فشل تقديم طلب الربط');
    } finally {
      setIsLinkingLoading(false);
    }
  };

  if (!session || !student) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-main flex flex-col transition-colors">
      {/* Top Fixed Header */}
      <Header
        student={student}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
        onLogout={handleLogout}
      />

      {/* Sibling Switcher Bar (if parent has multiple linked students) */}
      <div className="bg-surface/80 border-b border-surface-border px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <span className="text-text-muted font-bold flex items-center gap-1 shrink-0">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span>الأبناء:</span>
            </span>

            {session.studentCodes.map((code) => (
              <button
                key={code}
                onClick={() => handleSwitchSibling(code)}
                className={`px-3 py-1 rounded-xl font-bold transition-all shrink-0 ${
                  session.activeStudentCode === code
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-surface border border-surface-border text-text-muted hover:text-text-main'
                }`}
              >
                {code === student.studentCode ? student.name : `طالب (${code})`}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setIsLinkModalOpen(true);
              setLinkingPinResult(null);
              setTargetStudentCode('');
              setLinkError(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-500/20 transition-colors shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>ربط أخ / أخت</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Student Profile Card */}
        <StudentHero student={student} />

        {/* Next Lesson Banner */}
        <NextLessonCard nextLesson={student.nextLesson} />

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-surface-border pb-1 overflow-x-auto hide-scrollbar">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('lessons')}
              className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'lessons'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>الحصص والتسجيلات</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'lessons' ? 'bg-white/20 text-white' : 'bg-surface-border text-text-muted'}`}>
                {student.lessons?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('grades')}
              className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'grades'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>الواجبات والدرجات</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'grades' ? 'bg-white/20 text-white' : 'bg-surface-border text-text-muted'}`}>
                {student.quizzes?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('certificates')}
              className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'certificates'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>الشهادات والتكريمات</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'certificates' ? 'bg-white/20 text-white' : 'bg-surface-border text-text-muted'}`}>
                {student.certificates?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('finance')}
              className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'finance'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>الباقة والاشتراك</span>
            </button>
          </div>

          {/* Quick Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-surface border border-surface-border text-text-muted hover:text-blue-500 transition-all cursor-pointer shrink-0"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>

        {/* Tab Body */}
        <div className="pt-2">
          {activeTab === 'lessons' && <LessonsTab lessons={student.lessons || []} />}
          {activeTab === 'grades' && (
            <HomeworkGradesTab
              quizzes={student.quizzes || []}
              homeworkRate={student.stats?.homeworkRate}
            />
          )}
          {activeTab === 'certificates' && (
            <CertificatesTab
              certificates={student.certificates || []}
              student={student}
            />
          )}
          {activeTab === 'finance' && <FinanceTab packageInfo={student.packageInfo} />}
        </div>
      </main>

      {/* SIBLING LINKING MODAL */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm text-text-main">
                  ربط أخ أو أخت بحسابك
                </h3>
              </div>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {linkingPinResult ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-base text-text-main">
                    رمز التأكيد والاعتماد (PIN)
                  </h4>
                  <p className="text-xs text-text-muted mt-1">
                    طالب الربط مع: <strong className="text-text-main">{linkingPinResult.targetStudentName}</strong>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-surface-hover border border-surface-border">
                  <span className="font-mono text-3xl font-black text-blue-600 dark:text-blue-400 tracking-widest">
                    {linkingPinResult.pairingPin}
                  </span>
                  <p className="text-[11px] text-text-muted mt-2">
                    صالح لمدة 15 دقيقة فقط
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-300 font-bold flex items-center gap-2 text-right">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{linkingPinResult.instruction}</span>
                </div>

                <button
                  onClick={() => setIsLinkModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-surface border border-surface-border text-xs font-bold text-text-main hover:bg-surface-hover"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestSiblingLink} className="space-y-4">
                <p className="text-xs text-text-muted">
                  أدخل كود الأخ أو الأخت للحصول على رمز تأكيد الربط (بدون الحاجة لرسائل SMS أو OTP):
                </p>

                {linkError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{linkError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted">كود الطالب المراد ربطه:</label>
                  <input
                    type="text"
                    value={targetStudentCode}
                    onChange={(e) => setTargetStudentCode(e.target.value)}
                    placeholder="مثال: STU-1002 أو 1002"
                    required
                    dir="ltr"
                    className="w-full bg-background border border-surface-border rounded-2xl px-4 py-2.5 text-sm font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLinkingLoading || !targetStudentCode.trim()}
                  className="w-full py-3 rounded-2xl bg-blue-600 text-white font-black text-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLinkingLoading ? 'جارِ إنشاء الرمز...' : 'طلب رمز الربط'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modern Footer */}
      <footer className="border-t border-surface-border bg-surface/50 py-4 px-4 text-center text-xs text-text-muted">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>بوابة أولياء الأمور - أكاديمية اللغة الألمانية 🇩🇪</span>
          <span>آخر تحديث للبيانات: {new Date(student.lastUpdated || Date.now()).toLocaleDateString('ar-EG')}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
