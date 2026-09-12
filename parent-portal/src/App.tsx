import React, { useState, useEffect } from 'react';
import { StudentPortalData } from './types';
import { fetchStudentPortalData } from './lib/firebase';
import { Header } from './components/Header';
import { StudentHero } from './components/StudentHero';
import { NextLessonCard } from './components/NextLessonCard';
import { LessonsTab } from './components/LessonsTab';
import { HomeworkGradesTab } from './components/HomeworkGradesTab';
import { CertificatesTab } from './components/CertificatesTab';
import { FinanceTab } from './components/FinanceTab';
import { LoginView } from './components/LoginView';
import { BookOpen, Award, CreditCard, Sparkles, Calendar, Layers, RefreshCw } from 'lucide-react';

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('portal_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [student, setStudent] = useState<StudentPortalData | null>(null);
  const [activeTab, setActiveTab] = useState<'lessons' | 'grades' | 'certificates' | 'finance'>('lessons');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

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

  // Handle URL Query Params (Auto-login if code/id is provided in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code') || params.get('studentCode') || params.get('id') || params.get('phone');
    
    if (codeParam) {
      handleLogin(codeParam);
    } else {
      const savedCode = localStorage.getItem('portal_logged_code');
      if (savedCode) {
        handleLogin(savedCode);
      }
    }
  }, []);

  const handleLogin = async (identifier: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchStudentPortalData(identifier);
      if (data) {
        setStudent(data);
        localStorage.setItem('portal_logged_code', identifier);
        // Cache locally
        try {
          localStorage.setItem(`portal_cache_${identifier}`, JSON.stringify(data));
        } catch (e) {}
        setIsLoading(false);
        return true;
      } else {
        setError('لم يتم العثور على بيانات لهذا الطالب. يرجى التأكد من الكود أو رقم الهاتف.');
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.');
      setIsLoading(false);
      return false;
    }
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
    setStudent(null);
    localStorage.removeItem('portal_logged_code');
    // Clean URL params if present
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  if (!student) {
    return (
      <LoginView
        onLogin={handleLogin}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
        isLoading={isLoading}
        error={error}
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

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
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
