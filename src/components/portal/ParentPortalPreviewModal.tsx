import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getStudentCode, buildParentPortalShareText } from '../../utils/studentCodeUtils';
import { buildWhatsAppUrl } from '../../utils/phoneUtils';
import { formatTimeDisplay } from '../../utils/timeUtils';
import { 
  X, ExternalLink, Share2, Copy, Check, Users, GraduationCap, 
  Calendar, BookOpen, Award, CreditCard, Clock, CheckCircle2, 
  AlertCircle, XCircle, Video, Sparkles, DollarSign, Star, Smartphone
} from 'lucide-react';

interface ParentPortalPreviewModalProps {
  onClose: () => void;
  initialStudentId?: string;
}

export const ParentPortalPreviewModal: React.FC<ParentPortalPreviewModalProps> = ({
  onClose,
  initialStudentId
}) => {
  const { students, groups, lessons, certificates, profile, _t, language } = useApp();

  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    if (initialStudentId && students.some(s => s.id === initialStudentId)) {
      return initialStudentId;
    }
    return students[0]?.id || '';
  });

  const [activeTab, setActiveTab] = useState<'lessons' | 'grades' | 'certificates' | 'finance'>('lessons');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const activeStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || students[0] || null;
  }, [students, selectedStudentId]);

  const activeGroup = useMemo(() => {
    if (!activeStudent?.groupId) return null;
    return groups.find(g => g.id === activeStudent.groupId) || null;
  }, [groups, activeStudent]);

  const studentCode = useMemo(() => {
    return activeStudent ? getStudentCode(activeStudent) : 'STU-1001';
  }, [activeStudent]);

  // Student Lessons History
  const studentLessons = useMemo(() => {
    if (!activeStudent) return [];
    return (lessons || [])
      .filter(l => {
        if (l.deleted) return false;
        if (l.studentId === activeStudent.id) return true;
        if (activeStudent.groupId && l.groupId === activeStudent.groupId) return true;
        return false;
      })
      .sort((a, b) => {
        const timeA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
        const timeB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
        return timeB - timeA;
      });
  }, [lessons, activeStudent]);

  // Next Upcoming Lesson
  const nextLesson = useMemo(() => {
    if (!activeStudent) return null;
    const now = new Date();
    const upcoming = (lessons || [])
      .filter(l => {
        if (l.deleted || l.status === 'cancelled' || l.status === 'completed') return false;
        const matchesStudent = l.studentId === activeStudent.id || (activeStudent.groupId && l.groupId === activeStudent.groupId);
        if (!matchesStudent) return false;
        const lessonDate = new Date(`${l.date}T${l.time || '00:00'}`);
        return lessonDate >= now || l.status === 'scheduled' || l.status === 'in_progress';
      })
      .sort((a, b) => {
        const timeA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
        const timeB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
        return timeA - timeB;
      });
    return upcoming[0] || null;
  }, [lessons, activeStudent]);

  // Analytics Stats
  const stats = useMemo(() => {
    const total = studentLessons.length;
    let attended = 0;
    let hwCompleted = 0;
    let quizSum = 0;
    let quizCount = 0;
    let dictationSum = 0;
    let dictationCount = 0;

    studentLessons.forEach(l => {
      const att = l.report?.studentAttendance?.[activeStudent?.id || ''] || l.report?.attendanceStatus || (l.status === 'completed' ? 'present' : undefined);
      if (att === 'present' || att === 'late') attended++;

      const hw = l.report?.studentHomeworkDone?.[activeStudent?.id || ''] || (l.report?.arabicHomeworkRequired ? 'yes' : undefined);
      if (hw === 'yes') hwCompleted++;

      const qGrade = l.report?.studentExamGrade?.[activeStudent?.id || ''];
      if (typeof qGrade === 'number' && qGrade >= 0) {
        quizSum += qGrade;
        quizCount++;
      }

      const dGrade = l.report?.studentDictationGrade?.[activeStudent?.id || ''];
      if (typeof dGrade === 'number' && dGrade >= 0) {
        dictationSum += dGrade;
        dictationCount++;
      }
    });

    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 100;
    const homeworkRate = total > 0 ? Math.round((hwCompleted / total) * 100) : 100;
    const averageQuizGrade = quizCount > 0 ? (quizSum / quizCount).toFixed(1) : '10.0';
    const averageDictationGrade = dictationCount > 0 ? (dictationSum / dictationCount).toFixed(1) : '10.0';

    const studentCerts = (certificates || []).filter(c => c.studentId === activeStudent?.id || c.studentName === activeStudent?.name);

    return {
      totalSessions: total,
      attendedSessions: attended,
      attendanceRate,
      homeworkRate,
      averageQuizGrade,
      averageDictationGrade,
      totalCertificates: studentCerts.length,
    };
  }, [studentLessons, certificates, activeStudent]);

  // Certificates for student
  const studentCertificates = useMemo(() => {
    if (!activeStudent) return [];
    return (certificates || []).filter(c => c.studentId === activeStudent.id || c.studentName === activeStudent.name);
  }, [certificates, activeStudent]);

  // Package & Financial info
  const packageInfo = useMemo(() => {
    const sessionCount = activeGroup?.sessionCount || 8;
    const currentSessionInCycle = studentLessons.length > 0 ? ((studentLessons.length - 1) % sessionCount) + 1 : 1;
    const isPaid = true; // baseline default
    return {
      packageName: activeGroup?.name ? `باقة ${activeGroup.name}` : `باقة ${sessionCount} حصص`,
      currentSessionInCycle,
      totalCycleSessions: sessionCount,
      isPaid,
      amount: activeGroup?.monthlyPackagePrice || 500,
      currency: profile.currency || 'EGP',
      renewalDate: nextLesson?.date || undefined
    };
  }, [activeGroup, studentLessons, nextLesson, profile.currency]);

  // Handlers
  const handleCopyCode = () => {
    navigator.clipboard.writeText(studentCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!activeStudent) return;
    const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal/` : 'https://parent-portal.vercel.app';
    const msg = buildParentPortalShareText(activeStudent.name, studentCode, profile.displayName, portalUrl);
    navigator.clipboard.writeText(msg);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);

    const parentPhone = activeStudent.parentPhone || '';
    const url = buildWhatsAppUrl(parentPhone, msg);
    window.open(url, '_blank');
  };

  const handleOpenExternal = () => {
    const url = `${window.location.origin}/portal/?code=${studentCode}`;
    window.open(url, '_blank');
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface border border-surface-border w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[90vh] overflow-hidden animate-scale-up ${isDarkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}
        dir="rtl"
      >
        {/* Top Control Bar for Teacher */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-white/10 rounded-xl shrink-0 backdrop-blur-xs">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black truncate">
                  معاينة واجهة ولي الأمر (Parent Portal Live Preview)
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  مباشر ومفعل ✓
                </span>
              </div>
              <p className="text-[11px] text-blue-100 truncate">
                هذه هي الشاشة والبيانات التي يراها ولي الأمر تماماً عند تسجيل الدخول
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Share to WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="إرسال رابط البوابة وكود الدخول لولي الأمر عبر واتساب"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copiedShare ? 'تم النسخ والفتح ✓' : 'مشاركة على واتساب'}</span>
            </button>

            {/* External Window */}
            {typeof window !== 'undefined' && (
              <button
                type="button"
                onClick={handleOpenExternal}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="فتح في نافذة متصفح خارجية"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden md:inline">نافذة خارجية</span>
              </button>
            )}

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all cursor-pointer text-white"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Student Selector Ribbon */}
        <div className="bg-surface px-4 py-2 border-b border-surface-border flex items-center justify-between gap-3 text-xs shrink-0 overflow-x-auto hide-scrollbar">
          <div className="flex items-center gap-2 shrink-0 text-text-muted">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-bold">معاينة الطالب:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
            {students.slice(0, 10).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStudentId(st.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  st.id === activeStudent?.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-surface-hover text-text-muted hover:text-text-main border border-surface-border'
                }`}
              >
                <span>{st.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="px-2 py-1 bg-surface-hover border border-surface-border rounded-lg text-[11px] font-bold text-text-muted hover:text-text-main cursor-pointer"
              title="تبديل وضع الألوان"
            >
              {isDarkMode ? '☀️ وضع فاتح' : '🌙 وضع داكن'}
            </button>
          </div>
        </div>

        {/* Main Portal Screen Preview Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {!activeStudent ? (
            <div className="text-center py-12 text-text-muted space-y-2">
              <Users className="w-12 h-12 mx-auto text-blue-500 opacity-40" />
              <h3 className="font-bold text-base text-text-main">لا يوجد طلاب مسجلون حالياً</h3>
              <p className="text-xs">يرجى إضافة طلاب أولاً لتتمكن من معاينة بوابات أولياء الأمور.</p>
            </div>
          ) : (
            <>
              {/* Student Hero Banner */}
              <div className="bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                  {/* Student Info */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-md border-2 border-white dark:border-slate-800">
                        {activeStudent.name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow-xs border-2 border-surface" title="طالب متميز">
                        <Star className="w-3.5 h-3.5 fill-white" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-black text-text-main tracking-tight">
                          {activeStudent.name}
                        </h1>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {activeStudent.gender === 'female' ? 'طالبة متميزة 🌸' : 'طالب متميز 🌟'}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-text-muted font-medium flex items-center gap-1.5 flex-wrap">
                        <GraduationCap className="w-4 h-4 text-blue-500" />
                        <span>{activeStudent.grade || 'اللغة الألمانية'}</span>
                        {activeGroup && (
                          <>
                            <span className="text-surface-border">•</span>
                            <span>{activeGroup.name}</span>
                          </>
                        )}
                      </p>

                      <div className="flex items-center gap-2 pt-0.5 text-[11px] text-text-muted">
                        <div className="flex items-center gap-1">
                          <span>كود الدخول:</span>
                          <strong className="font-mono text-text-main bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800 font-bold">
                            {studentCode}
                          </strong>
                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className="text-blue-600 hover:underline p-0.5"
                            title="نسخ كود الطالب"
                          >
                            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <span>•</span>
                        <span>المعلم: <strong className="text-text-main">{profile.displayName || 'أستاذ اللغة الألمانية'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* High-Level Rate Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
                    {/* Attendance Rate */}
                    <div className="bg-background border border-surface-border rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-[11px] text-text-muted font-bold mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>نسبة الحضور</span>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {stats.attendanceRate}%
                      </div>
                      <span className="text-[10px] text-text-muted">
                        {stats.attendedSessions} من {stats.totalSessions} حصة
                      </span>
                    </div>

                    {/* Homework Rate */}
                    <div className="bg-background border border-surface-border rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-[11px] text-text-muted font-bold mb-1">
                        <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                        <span>حل الواجبات</span>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400">
                        {stats.homeworkRate}%
                      </div>
                      <span className="text-[10px] text-text-muted">التزام كامل</span>
                    </div>

                    {/* Average Quiz Grade */}
                    <div className="bg-background border border-surface-border rounded-2xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-[11px] text-text-muted font-bold mb-1">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>متوسط الكويزات</span>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-amber-500">
                        {stats.averageQuizGrade} <span className="text-xs font-normal text-text-muted">/10</span>
                      </div>
                      <span className="text-[10px] text-text-muted">مستوى ممتاز</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Upcoming Lesson Banner */}
              {nextLesson && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 border border-white/20 inline-block">
                      ⏰ موعد الحصة القادمة
                    </span>
                    <h3 className="text-base sm:text-lg font-black pt-1">
                      {nextLesson.title || activeGroup?.name || 'حصة اللغة الألمانية'}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-blue-100 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{nextLesson.date}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTimeDisplay(nextLesson.time, 'ar')}</span>
                      </span>
                      <span>({nextLesson.type === 'online' ? 'أونلاين' : 'حضوري'})</span>
                    </div>
                  </div>

                  {nextLesson.type === 'online' && (nextLesson.meetingLink || activeGroup?.zoomLink) && (
                    <a
                      href={nextLesson.meetingLink || activeGroup?.zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-white text-blue-600 hover:bg-blue-50 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0"
                    >
                      <Video className="w-4 h-4" />
                      <span>رابط الحصة (Zoom)</span>
                    </a>
                  )}
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex items-center justify-between gap-2 border-b border-surface-border pb-1 overflow-x-auto hide-scrollbar">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
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
                      {studentLessons.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('grades')}
                    className={`flex items-center gap-2 py-2.5 px-3.5 sm:px-4 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                      activeTab === 'grades'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main hover:bg-surface'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>الواجبات والدرجات</span>
                  </button>

                  <button
                    type="button"
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
                      {studentCertificates.length}
                    </span>
                  </button>

                  <button
                    type="button"
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
              </div>

              {/* Tab Content Display */}
              <div className="pt-1">
                {activeTab === 'lessons' && (
                  <div className="space-y-3">
                    {studentLessons.length === 0 ? (
                      <div className="bg-surface border border-surface-border rounded-2xl p-8 text-center text-text-muted">
                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30 text-blue-500" />
                        <h4 className="font-bold text-sm text-text-main">لا توجد حصص سابقة مسجلة</h4>
                      </div>
                    ) : (
                      studentLessons.map((lesson) => {
                        const att = lesson.report?.studentAttendance?.[activeStudent.id] || lesson.report?.attendanceStatus || (lesson.status === 'completed' ? 'present' : 'absent');
                        const isPresent = att === 'present';
                        const isLate = att === 'late';
                        const hwDone = lesson.report?.studentHomeworkDone?.[activeStudent.id];
                        const r1 = lesson.report?.recordingLink || lesson.recordingLink;
                        const r2 = lesson.report?.recordingLink2 || lesson.recordingLink2;

                        return (
                          <div
                            key={lesson.id}
                            className="bg-surface border border-surface-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 text-xs font-bold text-text-main">
                                <span className="bg-background px-2.5 py-1 rounded-xl border border-surface-border flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                  <span>{lesson.date}</span>
                                </span>
                                <span className="text-text-muted flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{formatTimeDisplay(lesson.time, 'ar')}</span>
                                </span>
                                {lesson.sessionNumber && (
                                  <span className="text-text-muted bg-surface-hover px-2 py-0.5 rounded-lg text-[11px]">
                                    الحصة {lesson.sessionNumber}
                                  </span>
                                )}
                              </div>

                              <div>
                                {isPresent && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>حاضر في الموعد</span>
                                  </span>
                                )}
                                {isLate && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>حاضر (متأخر)</span>
                                  </span>
                                )}
                                {!isPresent && !isLate && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>غائب</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <h4 className="font-extrabold text-sm sm:text-base text-text-main">
                              {lesson.report?.arabicTopicsExplained || lesson.topic || lesson.title}
                            </h4>

                            {/* Evaluation Badges */}
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              {hwDone && (
                                <span className={`px-2.5 py-1 rounded-xl font-bold border ${
                                  hwDone === 'yes'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                }`}>
                                  {hwDone === 'yes' ? 'الواجب: تم الحل بالكامل 👍' : 'الواجب: لم يتم الحل 👎'}
                                </span>
                              )}

                              {lesson.report?.studentDictationGrade?.[activeStudent.id] !== undefined && (
                                <span className="px-2.5 py-1 rounded-xl font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  الإملاء: {lesson.report.studentDictationGrade[activeStudent.id]} / 10
                                </span>
                              )}

                              {lesson.report?.studentExamGrade?.[activeStudent.id] !== undefined && (
                                <span className="px-2.5 py-1 rounded-xl font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  الكويز: {lesson.report.studentExamGrade[activeStudent.id]} / 10
                                </span>
                              )}
                            </div>

                            {/* Recordings */}
                            {(r1 || r2) && (
                              <div className="pt-1 flex items-center gap-2 flex-wrap">
                                {r1 && (
                                  <a
                                    href={r1}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>مشاهدة تسجيل الحصة (الجزء 1)</span>
                                    <ExternalLink className="w-3 h-3 opacity-70" />
                                  </a>
                                )}
                                {r2 && (
                                  <a
                                    href={r2}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>مشاهدة تسجيل الحصة (الجزء 2)</span>
                                    <ExternalLink className="w-3 h-3 opacity-70" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {activeTab === 'grades' && (
                  <div className="bg-surface border border-surface-border rounded-2xl p-5 space-y-4">
                    <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span>ملخص الواجبات والاختبارات الدورية</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl bg-background border border-surface-border space-y-1">
                        <span className="text-xs text-text-muted font-medium">معدل تسليم الواجبات:</span>
                        <div className="text-xl font-black text-blue-600">{stats.homeworkRate}%</div>
                        <p className="text-[11px] text-text-muted">التزام الطالب بحل ومراجعة الواجبات المحددة.</p>
                      </div>
                      <div className="p-4 rounded-xl bg-background border border-surface-border space-y-1">
                        <span className="text-xs text-text-muted font-medium">متوسط كويزات الحصص:</span>
                        <div className="text-xl font-black text-amber-500">{stats.averageQuizGrade} / 10</div>
                        <p className="text-[11px] text-text-muted">تقييم استيعاب القواعد والمفردات أولاً بأول.</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'certificates' && (
                  <div className="space-y-3">
                    {studentCertificates.length === 0 ? (
                      <div className="bg-surface border border-surface-border rounded-2xl p-8 text-center text-text-muted">
                        <Award className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
                        <h4 className="font-bold text-sm text-text-main">لا توجد شهادات صادرة حتى الآن</h4>
                        <p className="text-xs pt-1">سيتم عرض شهادات التقدير الصادرة للطالب فور اعتمادها من المعلم.</p>
                      </div>
                    ) : (
                      studentCertificates.map(cert => (
                        <div key={cert.id} className="bg-surface border border-surface-border rounded-2xl p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                              <Award className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-text-main">{cert.title || 'شهادة تميز'}</h4>
                              <p className="text-xs text-text-muted">{cert.issueDate || 'معتمدة'}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'finance' && (
                  <div className="bg-surface border border-surface-border rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span>بيانات الاشتراك وحالة الباقة</span>
                      </h3>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        سارية ومفعلة ✓
                      </span>
                    </div>

                    <div className="bg-background border border-surface-border rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-text-muted">اسم الباقة:</span>
                        <span className="text-text-main">{packageInfo.packageName}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-text-muted">الحصص المنجزة:</span>
                        <span className="text-blue-600 font-mono">الحصة {packageInfo.currentSessionInCycle} من {packageInfo.totalCycleSessions}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
