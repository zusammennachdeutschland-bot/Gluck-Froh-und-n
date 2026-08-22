import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Shield, Send, Printer, MessageCircle, Download, CheckCircle2, 
  AlertTriangle, Phone, FileText, Sparkles, Filter, ChevronDown, Check,
  UserCheck, AlertCircle, Calendar, RefreshCw, Loader2, BookOpen, Users
} from 'lucide-react';
import { StageManager, StageFollowUpRecord, Complaint, StudentActionPlan, TeacherStageEvaluationItem } from '../types';
import { 
  downloadStageFollowUpPdf, 
  shareStageFollowUpViaWhatsApp, 
  printStageFollowUpReport 
} from '../utils/printObservationUtils';

export const StageCommunicationView: React.FC = () => {
  const { profile, updateProfile, language, _t } = useApp();
  const schoolSettings = useMemo(() => profile?.schoolSettings || {} as any, [profile?.schoolSettings]);

  // Stage Managers list
  const stageManagers: StageManager[] = schoolSettings.stageManagers || [];

  const teachers = schoolSettings.teachers || [];
  const complaints: Complaint[] = schoolSettings.complaints || [];
  const actionPlans: StudentActionPlan[] = schoolSettings.actionPlans || [];
  const stageFollowUps: StageFollowUpRecord[] = schoolSettings.stageFollowUps || [];

  // Selected Stage Manager & Report Form State
  const [selectedManager, setSelectedManager] = useState<StageManager | null>(stageManagers[0] || null);

  React.useEffect(() => {
    if (stageManagers.length > 0) {
      if (!selectedManager || !stageManagers.some(m => m.id === selectedManager.id)) {
        setSelectedManager(stageManagers[0]);
      }
    } else {
      setSelectedManager(null);
    }
  }, [stageManagers]);
  const [reportPeriodType, setReportPeriodType] = useState<'weekly' | 'monthly' | 'termly'>('weekly');
  const [reportWeekNumber, setReportWeekNumber] = useState<number | string>(1);
  const [overallStageNotes, setOverallStageNotes] = useState<string>('');
  const [teachersEvalData, setTeachersEvalData] = useState<Record<string, TeacherStageEvaluationItem>>({});

  const [includeComplaints, setIncludeComplaints] = useState<boolean>(true);
  const [selectedComplaintIds, setSelectedComplaintIds] = useState<string[]>([]);

  const [includeActionPlans, setIncludeActionPlans] = useState<boolean>(true);
  const [selectedActionPlanIds, setSelectedActionPlanIds] = useState<string[]>([]);

  React.useEffect(() => {
    setSelectedComplaintIds(stageComplaints.map(c => c.id));
  }, [selectedManager?.id]);

  React.useEffect(() => {
    setSelectedActionPlanIds(stageActionPlans.map(p => p.id));
  }, [selectedManager?.id]);

  // Toast and Loading States
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [activeLoadingAction, setActiveLoadingAction] = useState<{ id: string; type: 'download' | 'share' | 'dispatch' } | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  // Helper to extract grade numbers (1 to 12) from strings or arrays
  const extractGradeNumbers = (input: string | string[]): Set<number> => {
    const grades = new Set<number>();
    const strings = Array.isArray(input) ? input : [input];

    for (const rawStr of strings) {
      if (!rawStr) continue;
      const str = rawStr.toLowerCase().trim();

      // Range matches like 1-3, 4-6, 7-9, 10-12
      const rangeMatches = Array.from(str.matchAll(/(\d{1,2})\s*[\-–—]\s*(\d{1,2})/g));
      let foundRange = false;
      for (const match of rangeMatches) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        if (start >= 1 && end <= 12 && start <= end) {
          for (let g = start; g <= end; g++) {
            grades.add(g);
          }
          foundRange = true;
        }
      }

      if (/أول|اول|1st|prim 1|p1\b|g1\b/i.test(str)) grades.add(1);
      if (/ثاني|ثاني|2nd|prim 2|p2\b|g2\b/i.test(str)) grades.add(2);
      if (/ثالث|ثالث|3rd|prim 3|p3\b|g3\b/i.test(str)) grades.add(3);
      if (/رابع|رابع|4th|prim 4|p4\b|g4\b/i.test(str)) grades.add(4);
      if (/خامس|خامس|5th|prim 5|p5\b|g5\b/i.test(str)) grades.add(5);
      if (/سادس|سادس|6th|prim 6|p6\b|g6\b/i.test(str)) grades.add(6);
      if (/سابع|سابع|7th|prep 1|m1\b|g7\b/i.test(str)) grades.add(7);
      if (/ثامن|ثامن|8th|prep 2|m2\b|g8\b/i.test(str)) grades.add(8);
      if (/تاسع|تاسع|9th|prep 3|m3\b|g9\b/i.test(str)) grades.add(9);
      if (/عاشر|عاشر|10th|sec 1|g10\b/i.test(str)) grades.add(10);
      if (/حادي\s*عشر|11th|sec 2|g11\b/i.test(str)) grades.add(11);
      if (/ثاني\s*عشر|12th|sec 3|g12\b/i.test(str)) grades.add(12);

      if (!foundRange) {
        const numMatches = str.match(/(?:^|\D)(1[0-2]|[1-9])(?:\D|$)/g);
        if (numMatches) {
          numMatches.forEach(m => {
            const digits = m.match(/1[0-2]|[1-9]/);
            if (digits) {
              const num = parseInt(digits[0], 10);
              if (num >= 1 && num <= 12) grades.add(num);
            }
          });
        }
      }
    }
    return grades;
  };

  // Extract target grade numbers for current selected manager
  const currentManagerGrades = useMemo(() => {
    if (!selectedManager) return new Set<number>();
    const inputs: string[] = [];
    if (selectedManager.assignedGradeGroups && Array.isArray(selectedManager.assignedGradeGroups)) {
      inputs.push(...selectedManager.assignedGradeGroups);
    }
    if ((selectedManager as any).gradeBand) {
      inputs.push((selectedManager as any).gradeBand);
    }
    return extractGradeNumbers(inputs);
  }, [selectedManager?.id]);

  // Check if a item's gradeClass/className matches current stage
  const matchesStage = (gradeClassStr: string): boolean => {
    if (!gradeClassStr) return true;
    if (currentManagerGrades.size === 0) return true; // fallback if no specific stage set
    const itemGrades = extractGradeNumbers(gradeClassStr);
    if (itemGrades.size === 0) return true;
    for (const g of itemGrades) {
      if (currentManagerGrades.has(g)) return true;
    }
    return false;
  };

  // =========================================================================
  // CRITICAL REPORT FILTERING & LIFECYCLE LOGIC
  // =========================================================================

  // 1. Complaints Lifecycle Filtering:
  // - Pending/Open Complaints: Include all new complaints for the selected stage where weeklyReportSent === false
  // - Resolved Complaints: Include resolved complaints ONLY IF they have not yet been reported (weeklyReportSent === false AND status === 'RESOLVED')
  const stageComplaints = useMemo(() => {
    return complaints.filter(c => {
      // Must match stage
      if (!matchesStage(c.gradeClass)) return false;

      // Must NOT have been sent in a previous report
      if (c.weeklyReportSent) return false;

      const normStatus = (c.actionTaken || '').toLowerCase();

      // Check if complaint is open or resolved
      // In both cases, weeklyReportSent === false allows it into current report
      return true;
    });
  }, [complaints, currentManagerGrades]);

  const pendingComplaintsCount = stageComplaints.filter(c => !c.actionTaken || !c.actionTaken.includes('RESOLVED')).length;
  const newlyResolvedComplaintsCount = stageComplaints.filter(c => c.actionTaken && c.actionTaken.includes('RESOLVED')).length;

  // 2. Academic Action Plans Lifecycle Filtering:
  // - Active Plans (ACTIVE): Include all active plans currently ongoing for students in this stage.
  // - Newly Resolved Plans (RESOLVED): Include resolved/completed action plans ONLY ONCE for current cycle (reportedAsResolved === false).
  const stageActionPlans = useMemo(() => {
    return actionPlans.filter(plan => {
      // Must match stage
      if (!matchesStage(plan.gradeClass)) return false;

      // If active plan: always include
      if (plan.status === 'ACTIVE') return true;

      // If resolved plan: include ONLY IF reportedAsResolved === false
      if (plan.status === 'RESOLVED') {
        return !plan.reportedAsResolved;
      }

      return false;
    });
  }, [actionPlans, currentManagerGrades]);

  const activePlans = stageActionPlans.filter(p => p.status === 'ACTIVE');
  const newlyResolvedPlans = stageActionPlans.filter(p => p.status === 'RESOLVED' && !p.reportedAsResolved);

  // Supervised teachers for selected stage manager (Automatic Grade-Based Auto-Association)
  const supervisedTeachers = useMemo(() => {
    if (!selectedManager) return [];
    return teachers.filter(t => {
      if (t.isHod) return false;

      // Combine direct assignedClasses and schedule classes
      const directClasses = t.assignedClasses || [];
      const teacherScheduleRecords: any[] = [];
      const ts = schoolSettings.teacherSchedules?.[t.id];
      if (ts) {
        Object.values(ts).forEach((dayArr: any) => {
          if (Array.isArray(dayArr)) teacherScheduleRecords.push(...dayArr);
        });
      }
      const scheduleClasses = teacherScheduleRecords.map(r => r.className).filter(Boolean);
      const allClasses = Array.from(new Set([...directClasses, ...scheduleClasses]));

      const tGrades = extractGradeNumbers(allClasses);

      if (currentManagerGrades.size > 0) {
        if (tGrades.size > 0) {
          for (const g of tGrades) {
            if (currentManagerGrades.has(g)) return true;
          }
        }
        // Fallback string check
        for (const cls of allClasses) {
          const clsLower = cls.toLowerCase();
          for (const gradeNum of currentManagerGrades) {
            if (clsLower.includes(gradeNum.toString()) || clsLower.includes(`g${gradeNum}`) || clsLower.includes(`grade ${gradeNum}`)) {
              return true;
            }
          }
        }
      } else {
        return true;
      }

      return false;
    });
  }, [teachers, currentManagerGrades, selectedManager, schoolSettings.teacherSchedules]);

  // Names formatting for signature blocks
  const rawHod = schoolSettings.hodName || 'عبد الرحمن غريب';
  const formattedHodName = rawHod.replace(/^أ[\.\/]\s*/, '');
  const rawManagerName = selectedManager?.name || 'مدير المرحلة';
  const formattedManagerName = rawManagerName.replace(/^أ[\.\/]\s*/, '');

  // =========================================================================
  // DISPATCH REPORT ACTION (After Dispatch Lifecycle Updates)
  // =========================================================================
  const handleDispatchReport = () => {
    if (!selectedManager) return;
    setActiveLoadingAction({ id: selectedManager.id, type: 'dispatch' });

    const nowIso = new Date().toISOString();

    const includedComplaintsList = includeComplaints
      ? stageComplaints.filter(c => selectedComplaintIds.includes(c.id))
      : [];
    const includedActionPlansList = includeActionPlans
      ? stageActionPlans.filter(p => selectedActionPlanIds.includes(p.id))
      : [];

    const includedComplaintIdsSet = new Set(includedComplaintsList.map(c => c.id));
    const updatedComplaints = complaints.map(c => {
      if (includedComplaintIdsSet.has(c.id)) {
        return {
          ...c,
          weeklyReportSent: true,
          weeklyReportDate: nowIso
        };
      }
      return c;
    });

    const includedResolvedPlanIdsSet = new Set(
      includedActionPlansList.filter(p => p.status === 'RESOLVED').map(p => p.id)
    );
    const updatedActionPlans = actionPlans.map(plan => {
      if (includedResolvedPlanIdsSet.has(plan.id)) {
        return {
          ...plan,
          reportedAsResolved: true
        };
      }
      return plan;
    });

    const resolvedTeachersData = supervisedTeachers.map(teacher => {
      const existing = teachersEvalData[teacher.id];
      if (existing) return existing;
      const directClasses = teacher.assignedClasses || [];
      const teacherScheduleRecords: any[] = [];
      const ts = schoolSettings.teacherSchedules?.[teacher.id];
      if (ts) {
        Object.values(ts).forEach((dayArr: any) => {
          if (Array.isArray(dayArr)) teacherScheduleRecords.push(...dayArr);
        });
      }
      const scheduleClasses = teacherScheduleRecords.map(r => r.className).filter(Boolean);
      const allClasses = Array.from(new Set([...directClasses, ...scheduleClasses]));
      const totalSessions = teacherScheduleRecords.length > 0 ? teacherScheduleRecords.length : (teacher.totalSessions || 3);

      return {
        teacherId: teacher.id,
        teacherName: teacher.name,
        assignedClasses: allClasses,
        totalSessions: totalSessions,
        visitsCount: 0,
        visitsAvgScore: 0,
        complaintsCount: 0,
        complaintsStatus: 'منتظم',
        curriculumAdherence: 'ممتاز',
        bookletChecking: 'منتظم',
        classroomManagement: 'ممتاز',
        punctuality: 'ملتزم',
        customNotes: ''
      };
    });

    const newReportRecord: StageFollowUpRecord = {
      id: Date.now().toString(),
      stageManagerId: selectedManager.id,
      stageManagerName: selectedManager.name,
      gradeBand: (selectedManager.assignedGradeGroups || []).join(', ') || 'عام',
      periodType: reportPeriodType,
      weekNumber: reportWeekNumber,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      teachersData: resolvedTeachersData.length > 0 ? resolvedTeachersData : Object.values(teachersEvalData),
      overallStageNotes: overallStageNotes.trim(),
      includeComplaints,
      selectedComplaintIds,
      includedComplaints: includedComplaintsList,
      includeActionPlans,
      selectedActionPlanIds,
      includedActionPlans: includedActionPlansList
    };

    const updatedFollowUps = [newReportRecord, ...stageFollowUps];

    const updatedSettings = {
      ...schoolSettings,
      complaints: updatedComplaints,
      actionPlans: updatedActionPlans,
      stageFollowUps: updatedFollowUps
    };

    updateProfile({ schoolSettings: updatedSettings });

    triggerToast(_t('تمت أرشفة واعتِماد التقرير وإرساله لمدير المرحلة بنجاح 📑', 'Report dispatched & archived successfully 📑', 'Erfolgreich gesendet'));
    setActiveLoadingAction(null);
    setIsPreviewModalOpen(false);
  };

  // PDF Download / Print / WhatsApp
  const handleDownloadPdf = async (record: StageFollowUpRecord) => {
    if (activeLoadingAction) return;
    setActiveLoadingAction({ id: record.id, type: 'download' });
    try {
      await downloadStageFollowUpPdf(record, schoolSettings, (language === 'ar'), language);
    } catch (err) {
      console.error('Download PDF error:', err);
    } finally {
      setActiveLoadingAction(null);
    }
  };

  const handleShareWhatsApp = async (record: StageFollowUpRecord) => {
    if (activeLoadingAction) return;
    setActiveLoadingAction({ id: record.id, type: 'share' });
    try {
      await shareStageFollowUpViaWhatsApp(record, schoolSettings, (language === 'ar'), language);
    } catch (err) {
      console.error('Share WhatsApp error:', err);
    } finally {
      setActiveLoadingAction(null);
    }
  };

  const handlePrintReport = (record: StageFollowUpRecord) => {
    printStageFollowUpReport(record, schoolSettings, (language === 'ar'), language);
  };

  return (
    <div className="space-y-3 max-w-7xl mx-auto pb-12 font-sans dir-rtl text-right">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl font-bold text-[11px] animate-bounce border border-emerald-500">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Stage Managers Selector Tabs */}
      {stageManagers.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-[11px] font-black text-text-muted uppercase tracking-wider px-1">
            {_t('اختر المرحلة الدراسية / مدير المرحلة:', 'Select Stage Manager:', 'Stufenleiter auswählen:')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
            {stageManagers.map((mgr) => {
              const isSelected = selectedManager?.id === mgr.id;
              const mgrFollowUps = stageFollowUps.filter(f => f.stageManagerId === mgr.id);
              const latest = mgrFollowUps[0];

              return (
                <button
                  key={mgr.id}
                  onClick={() => setSelectedManager(mgr)}
                  className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 relative overflow-hidden ${
                    isSelected 
                      ? 'bg-primary/10 border-primary shadow-sm ring-2 ring-primary/20' 
                      : 'bg-surface border-surface-border hover:border-primary/40 hover:bg-surface-hover'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  )}

                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-[11px] ${
                        isSelected ? 'bg-primary text-white' : 'bg-surface-hover text-text-main border border-surface-border'
                      }`}>
                        {mgr.name?.charAt(0) || 'م'}
                      </div>
                      <div>
                        <h3 className="text-[11px] font-black text-text-main">{mgr.name}</h3>
                        <p className="text-[10px] text-primary font-bold mt-0.5">
                          {(mgr.assignedGradeGroups || []).join(', ') || 'جميع المراحل'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between text-[10px] text-text-muted">
                    <span>{_t('آخر تقرير:', 'Last Report:', 'Letzter Bericht:')}</span>
                    <span className="font-bold text-text-main">
                      {latest ? latest.date : 'لم يُرسَل بعد'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-dashed border-surface-border rounded-2xl p-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-text-main">
            {_t('لم يتم إضافة مديري مراحل بعد', 'No Stage Managers Added Yet', 'Keine Stufenleiter hinzugefügt')}
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            {_t('يرجى الانتقال إلى إعدادات المدرسة وقسم اللغة لإضافة وتعيين مديري المراحل ومسؤولي السكرتارية لمتابعة التقارير.', 'Please configure stage managers in School Settings to manage reports and communication.', 'Bitte Stufenleiter in den Schuleinstellungen konfigurieren.')}
          </p>
        </div>
      )}

      {/* Selected Stage Dashboard & Report Builder */}
      {selectedManager && (
      <div className="bg-surface border border-surface-border rounded-3xl p-3 shadow-2xs space-y-3">
        
        {/* Stage Summary Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-2.5 bg-surface-hover/40 rounded-xl border border-surface-border">
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary border border-primary/20 flex items-center justify-center font-black text-base shadow-xs">
              {selectedManager.name?.charAt(0) || 'م'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-black text-text-main">{selectedManager.name}</h2>
                <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-lg border border-primary/20">
                  {(selectedManager.assignedGradeGroups || []).join(', ') || 'عام'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                {_t('المعلمون التابعون للمرحلة تلقائياً:', 'Supervised Teachers:', 'Zugewiesene Lehrer:')} <strong className="text-text-main">{supervisedTeachers.length} معلم</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedManager.phone && (
              <a
                href={`tel:${selectedManager.phone}`}
                className="px-2 py-1 bg-surface hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main rounded-xl border border-surface-border text-[11px] font-bold transition-all flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span>{selectedManager.phone}</span>
              </a>
            )}
            <a
              href={`https://wa.me/${(selectedManager.phone || '').replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-xl border border-emerald-500/20 transition-all"
              title="WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* REPORT GENERATION CONTROLS */}
        <div className="p-3 bg-gradient-to-br from-primary/5 via-surface to-surface-hover/30 border border-primary/20 rounded-xl space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-surface-border pb-3">
            <div>
              <h3 className="text-[11px] font-black text-text-main flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>{_t('تخصيص التقرير الجديد للمرحلة', 'Configure Stage Report', 'Bericht konfigurieren')}</span>
              </h3>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-surface-border">
              <button
                onClick={() => setReportPeriodType('weekly')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  reportPeriodType === 'weekly' ? 'bg-primary text-white shadow-2xs' : 'text-text-muted hover:text-text-main'
                }`}
              >
                تقرير أسبوعي
              </button>
              <button
                onClick={() => setReportPeriodType('monthly')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  reportPeriodType === 'monthly' ? 'bg-primary text-white shadow-2xs' : 'text-text-muted hover:text-text-main'
                }`}
              >
                تقرير شهري
              </button>
              <button
                onClick={() => setReportPeriodType('termly')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  reportPeriodType === 'termly' ? 'bg-primary text-white shadow-2xs' : 'text-text-muted hover:text-text-main'
                }`}
              >
                تقرير التيرم الشامل
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1">
                {_t('رقم الأسبوع / النطاق الزمني:', 'Week Number:', 'Wochennummer:')}
              </label>
              <input
                type="text"
                value={reportWeekNumber}
                onChange={(e) => setReportWeekNumber(e.target.value)}
                placeholder="مثال: الأسبوع 4"
                className="w-full h-9 px-3 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:border-primary focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-text-muted mb-1">
                {_t('توصيات وملاحظات رئيس القسم العامة للمرحلة:', 'Overall Stage Recommendations:', 'Empfehlungen:')}
              </label>
              <input
                type="text"
                value={overallStageNotes}
                onChange={(e) => setOverallStageNotes(e.target.value)}
                placeholder="اكتب التوصيات والملاحظات الرئيسية لمدير المرحلة هنا..."
                className="w-full h-9 px-3 bg-surface border border-surface-border rounded-xl text-[11px] font-bold text-text-main focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION A: COMPLAINTS OPTIONS (إدراج الشكاوى المتبادلة) */}
          <div className="pt-3 border-t border-surface-border space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeComplaints}
                  onChange={(e) => setIncludeComplaints(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-surface-border accent-primary"
                />
                <span className="text-[11px] font-black text-text-main">
                  {_t('إدراج الشكاوى وملاحظات أولياء الأمور (إدراج الشكاوى المتبادلة)', 'Include Complaints in Report', 'Beschwerden einbeziehen')}
                </span>
              </label>
              <span className="text-[10px] font-bold text-text-muted">
                {stageComplaints.length} شكوى متاحة
              </span>
            </div>

            {includeComplaints && (
              <div className="p-3 bg-surface border border-surface-border rounded-xl space-y-2 max-h-48 overflow-y-auto">
                {stageComplaints.length === 0 ? (
                  <div className="text-[11px] text-text-muted text-center py-2">لا توجد شكاوى جديدة أو معلقة لهذه المرحلة حالياً</div>
                ) : (
                  stageComplaints.map(c => {
                    const isChecked = selectedComplaintIds.includes(c.id);
                    const isResolved = c.actionTaken && c.actionTaken.includes('RESOLVED');
                    return (
                      <label key={c.id} className="flex items-center justify-between p-2 bg-surface-hover/30 hover:bg-surface-hover/60 rounded-lg cursor-pointer text-[11px]">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedComplaintIds(prev => [...prev, c.id]);
                              } else {
                                setSelectedComplaintIds(prev => prev.filter(id => id !== c.id));
                              }
                            }}
                            className="w-3.5 h-3.5 text-primary rounded border-surface-border accent-primary"
                          />
                          <span className="font-bold text-text-main">{c.studentNameAr || c.studentNameEn} ({c.gradeClass})</span>
                          <span className="text-text-muted line-clamp-1">— {c.reason}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isResolved ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {isResolved ? 'تم الحل حديثاً' : 'قيد المتابعة'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* SECTION B: ACTION PLANS OPTIONS (إدراج خطط الدعم الأكاديمي والعلاجية) */}
          <div className="pt-3 border-t border-surface-border space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeActionPlans}
                  onChange={(e) => setIncludeActionPlans(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-surface-border accent-primary"
                />
                <span className="text-[11px] font-black text-text-main">
                  {_t('إدراج خطط الدعم الأكاديمي والعلاجية في التقرير', 'Include Academic Action Plans in Report', 'Förderpläne einbeziehen')}
                </span>
              </label>
              <span className="text-[10px] font-bold text-text-muted">
                {stageActionPlans.length} خطة متاحة
              </span>
            </div>

            {includeActionPlans && (
              <div className="p-3 bg-surface border border-surface-border rounded-xl space-y-2 max-h-48 overflow-y-auto">
                {stageActionPlans.length === 0 ? (
                  <div className="text-[11px] text-text-muted text-center py-2">لا توجد خطط دعم أكاديمي نشطة لهذه المرحلة حالياً</div>
                ) : (
                  stageActionPlans.map(plan => {
                    const isChecked = selectedActionPlanIds.includes(plan.id);
                    const isResolved = plan.status === 'RESOLVED';
                    return (
                      <label key={plan.id} className="flex items-center justify-between p-2 bg-surface-hover/30 hover:bg-surface-hover/60 rounded-lg cursor-pointer text-[11px]">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedActionPlanIds(prev => [...prev, plan.id]);
                              } else {
                                setSelectedActionPlanIds(prev => prev.filter(id => id !== plan.id));
                              }
                            }}
                            className="w-3.5 h-3.5 text-primary rounded border-surface-border accent-primary"
                          />
                          <span className="font-bold text-text-main">{plan.studentNameAr || plan.studentNameEn} ({plan.gradeClass})</span>
                          <span className="text-text-muted">— المعلم: {plan.teacherName}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isResolved ? 'bg-emerald-500/10 text-emerald-600' : 'bg-indigo-500/10 text-indigo-600'
                        }`}>
                          {isResolved ? 'تم التمكن وإغلاق الخطة' : 'خطة نشطة'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-2 flex flex-wrap items-center justify-end gap-1.5">
            <button
              onClick={() => setIsPreviewModalOpen(true)}
              className="px-5 h-10 bg-primary hover:bg-primary-hover text-white text-[11px] font-black rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-2 active:scale-98"
            >
              <Sparkles className="w-4 h-4" />
              <span>{_t('تقرير تقييم المعلمين القديم / معاينة واعتماد التقرير', 'Classic Teacher Evaluation & Dispatch', 'Klassischer Bericht')}</span>
            </button>
          </div>
        </div>

        {/* DISPATCHED REPORTS HISTORY TABLE */}
        <div className="space-y-3 pt-4">
          <h3 className="text-[11px] font-black text-text-main flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{_t('سجل التقارير المرسلة سابقاً لهذه المرحلة:', 'Dispatched Reports History:', 'Berichts-Historie:')}</span>
          </h3>

          <div className="border border-surface-border rounded-xl overflow-hidden bg-surface">
            {stageFollowUps.filter(f => f.stageManagerId === selectedManager.id).length === 0 ? (
              <div className="p-8 text-center text-[11px] text-text-muted">
                {_t('لم يتم إرسال أي تقارير مؤرشفة لهذه المرحلة بعد', 'No dispatched reports yet for this stage', 'Noch keine Berichte')}
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {stageFollowUps
                  .filter(f => f.stageManagerId === selectedManager.id)
                  .map((rec) => (
                    <div key={rec.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-surface-hover/30 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[11px] text-text-main">
                            متابعة {rec.periodType === 'weekly' ? 'أسبوعية' : rec.periodType === 'monthly' ? 'شهرية' : 'فصلية'} - الأسبوع {rec.weekNumber || 1}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-extrabold rounded-md">
                            مُعتمد ومُرسل
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted">
                          التاريخ: {rec.date} | المدرسين: {rec.teachersData?.length || 0} معلم
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadPdf(rec)}
                          disabled={activeLoadingAction?.id === rec.id}
                          className="h-8 px-3 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 text-[11px] font-bold rounded-lg transition-all border border-sky-200 dark:border-sky-800 flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={() => handleShareWhatsApp(rec)}
                          disabled={activeLoadingAction?.id === rec.id}
                          className="h-8 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-bold rounded-lg transition-all border border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب</span>
                        </button>
                        <button
                          onClick={() => handlePrintReport(rec)}
                          className="h-8 px-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 text-[11px] font-bold rounded-lg transition-all border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

      </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE A4 PREVIEW & DISPATCH MODAL WITH BOTTOM CLIPPING FIX */}
      {/* ========================================================================= */}
      {isPreviewModalOpen && selectedManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden dir-rtl text-right">
            
            {/* Modal Header Actions */}
            <div className="p-2.5 bg-slate-900 text-white flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-[11px] font-black">
                  معاينة تقرير المرحلة A4 المعتمد ({selectedManager.name || ''})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة A4</span>
                </button>

                <button
                  onClick={handleDispatchReport}
                  disabled={activeLoadingAction?.type === 'dispatch'}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {activeLoadingAction?.type === 'dispatch' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>اعتماد وإرسال التقرير</span>
                </button>

                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-xl transition-all cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>

            {/* Printable A4 Body Container */}
            <div className="p-8 overflow-y-auto flex-1 bg-white" id="printable-stage-communication-report">
              
              {/* PRINT CSS STYLES FOR EXACT NO-CLIPPING LAYOUT */}
              <style>{`
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 12mm 15mm 15mm 15mm;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-stage-communication-report, #printable-stage-communication-report * {
                    visibility: visible !important;
                  }
                  #printable-stage-communication-report {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .page-break-avoid {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                  .signature-container {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    padding-bottom: 2.5rem !important;
                    margin-bottom: 1.5rem !important;
                    line-height: 1.6 !important;
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: flex-start !important;
                  }
                }
              `}</style>

              {/* Header Info */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-base font-black text-slate-900">
                    {schoolSettings.schoolName || ''}
                  </h1>
                  <p className="text-[11px] font-bold text-slate-600">
                    {schoolSettings.departmentName || 'قسم اللغة الألمانية'} | {schoolSettings.academicYear || '2024/2025'} - {schoolSettings.currentTerm || 'الفصل الدراسي الأول'}
                  </p>
                </div>
                <div className="text-left font-mono text-[11px] font-bold text-slate-500">
                  تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}
                </div>
              </div>

              {/* Title */}
              <div className="text-center bg-slate-100 border border-slate-300 py-2.5 px-2.5 rounded-xl mb-4">
                <h2 className="text-[11px] font-black text-slate-900">
                  تقرير متابعة وإشراف المرحلة ({reportPeriodType === 'weekly' ? 'الأسبوعي' : reportPeriodType === 'monthly' ? 'الشهري' : 'الشامل'}) - الأسبوع {reportWeekNumber}
                </h2>
              </div>

              {/* Metadata Bar */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-300 rounded-xl text-[11px] mb-5 font-semibold text-slate-800">
                <div>مدير المرحلة: <strong className="text-slate-950">{selectedManager.name}</strong></div>
                <div>النطاق والصفوف: <strong className="text-slate-950">{(selectedManager.assignedGradeGroups || []).join(', ') || 'عام'}</strong></div>
                <div>رئيس القسم المسؤول: <strong className="text-slate-950">أ/ {formattedHodName}</strong></div>
                <div>عدد المعلمين بالتقرير: <strong className="text-slate-950">{supervisedTeachers.length} معلم</strong></div>
              </div>

              {/* CLASSIC TEACHER EVALUATIONS TABLE */}
              <table className="w-full border-collapse border border-slate-400 text-[11px] mb-5">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-black">
                    <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
                    <th className="border border-slate-400 p-1.5 text-right w-36">اسم المعلم</th>
                    <th className="border border-slate-400 p-1.5 text-center w-28">الفصول والحصص</th>
                    <th className="border border-slate-400 p-1.5 text-center w-36">الزيارات والشكاوى</th>
                    <th className="border border-slate-400 p-1.5 text-right">التقييمات والملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisedTeachers.map((teacher, index) => {
                    const td = teachersEvalData[teacher.id] || {
                      teacherName: teacher.name,
                      assignedClasses: teacher.assignedClasses || [],
                      totalSessions: teacher.totalSessions || 0,
                      visitsCount: 0,
                      visitsAvgScore: 0,
                      complaintsCount: 0,
                      complaintsStatus: 'منتظم',
                      curriculumAdherence: 'ممتاز',
                      bookletChecking: 'منتظم',
                      classroomManagement: 'ممتاز',
                      punctuality: 'ملتزم',
                      customNotes: ''
                    };

                    const evals = [
                      td.curriculumAdherence ? `المنهج: ${td.curriculumAdherence}` : '',
                      td.bookletChecking ? `الكراسات: ${td.bookletChecking}` : '',
                      td.classroomManagement ? `إدارة الفصل: ${td.classroomManagement}` : '',
                      td.punctuality ? `المواعيد: ${td.punctuality}` : '',
                      td.complaintsStatus ? `الشكاوى: ${td.complaintsStatus}` : '',
                      td.customNotes ? `ملاحظات: ${td.customNotes}` : ''
                    ].filter(Boolean).join(' | ');

                    const visitsInfo = td.visitsCount > 0 ? `${td.visitsCount} زيارة (متوسط ${td.visitsAvgScore}/75)` : 'لا توجد زيارات جديدة';
                    const complaintsInfo = td.complaintsCount > 0 ? `${td.complaintsCount} شكوى` : 'لا توجد شكاوى';

                    return (
                      <tr key={teacher.id || index} className="border border-slate-300">
                        <td className="border border-slate-300 p-1.5 text-center font-bold">{index + 1}</td>
                        <td className="border border-slate-300 p-1.5 font-bold">{td.teacherName}</td>
                        <td className="border border-slate-300 p-1.5 text-center">
                          {(td.assignedClasses || []).join(', ') || '-'}<br/>
                          <span className="text-[10px] text-slate-500">({td.totalSessions || 0} حصة/أسبوع)</span>
                        </td>
                        <td className="border border-slate-300 p-1.5 text-center text-[11px]">
                          <div>{visitsInfo}</div>
                          <div className={td.complaintsCount > 0 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>{complaintsInfo}</div>
                        </td>
                        <td className="border border-slate-300 p-1.5 text-slate-700 text-[11px]">
                          {evals || 'لا توجد تقييمات مسجلة.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* SECTION 1: COMPLAINTS SUMMARY IN CYCLE */}
              {includeComplaints && (
                <div className="mb-5 space-y-2">
                  <h3 className="text-[11px] font-black text-slate-900 border-b border-slate-300 pb-1">
                    ملخص الشكاوى وملاحظات أولياء الأمور بهذا التقرير ({stageComplaints.filter(c => selectedComplaintIds.includes(c.id)).length}):
                  </h3>

                  {stageComplaints.filter(c => selectedComplaintIds.includes(c.id)).length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">لا توجد أي شكاوى محددة لهذا التقرير.</p>
                  ) : (
                    <table className="w-full border-collapse border border-slate-400 text-[11px]">
                      <thead>
                        <tr className="bg-slate-200 text-slate-900 font-black">
                          <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
                          <th className="border border-slate-400 p-1.5 text-right">اسم الطالب / الصف</th>
                          <th className="border border-slate-400 p-1.5 text-right">سبب الشكوى</th>
                          <th className="border border-slate-400 p-1.5 text-center w-28">الحالة الحالية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stageComplaints.filter(c => selectedComplaintIds.includes(c.id)).map((c, i) => (
                          <tr key={c.id || i} className="border border-slate-300">
                            <td className="border border-slate-300 p-1.5 text-center font-bold">{i + 1}</td>
                            <td className="border border-slate-300 p-1.5 font-bold">
                              {c.studentNameAr || c.studentNameEn} ({c.gradeClass})
                            </td>
                            <td className="border border-slate-300 p-1.5 text-slate-700">{c.reason}</td>
                            <td className="border border-slate-300 p-1.5 text-center font-bold">
                              {c.actionTaken?.includes('RESOLVED') ? 'تم الحل حديثاً' : 'قيد المتابعة'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* SECTION 2: ACADEMIC ACTION PLANS IN CYCLE */}
              {includeActionPlans && (
                <div className="mb-5 space-y-2">
                  <h3 className="text-[11px] font-black text-slate-900 border-b border-slate-300 pb-1">
                    خطط الدعم الأكاديمي والعلاجية المشمولة بالتقرير ({stageActionPlans.filter(p => selectedActionPlanIds.includes(p.id)).length}):
                  </h3>

                  {stageActionPlans.filter(p => selectedActionPlanIds.includes(p.id)).length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">لا توجد خطط دعم محددة لهذا التقرير.</p>
                  ) : (
                    <table className="w-full border-collapse border border-slate-400 text-[11px]">
                      <thead>
                        <tr className="bg-slate-200 text-slate-900 font-black">
                          <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
                          <th className="border border-slate-400 p-1.5 text-right">اسم الطالب والصف</th>
                          <th className="border border-slate-400 p-1.5 text-right">المعلم والضعف المرصود</th>
                          <th className="border border-slate-400 p-1.5 text-center w-28">حالة الخطة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stageActionPlans.filter(p => selectedActionPlanIds.includes(p.id)).map((plan, i) => (
                          <tr key={plan.id || i} className="border border-slate-300">
                            <td className="border border-slate-300 p-1.5 text-center font-bold">{i + 1}</td>
                            <td className="border border-slate-300 p-1.5 font-bold">
                              {plan.studentNameAr || plan.studentNameEn} ({plan.gradeClass})
                            </td>
                            <td className="border border-slate-300 p-1.5 text-slate-700">
                              أ/ {plan.teacherName} — {(plan.weaknessAreas || []).join('، ')}
                            </td>
                            <td className="border border-slate-300 p-1.5 text-center font-bold">
                              {plan.status === 'RESOLVED' ? 'تم التمكن وإغلاق الخطة' : 'نشطة وقيد المتابعة'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* OVERALL RECOMMENDATIONS */}
              {overallStageNotes && (
                <div className="mb-6 p-3 border border-slate-400 bg-slate-50 rounded-xl text-[11px] space-y-1">
                  <h4 className="font-black text-slate-900">توصيات رئيس القسم العامة للمرحلة:</h4>
                  <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{overallStageNotes}</p>
                </div>
              )}

              {/* ========================================================================= */}
              {/* PRINT LAYOUT & BOTTOM CLIPPING FIX: SIGNATURE FOOTER */}
              {/* ========================================================================= */}
              <div 
                className="signature-container mt-8 pt-4 flex items-start justify-between text-center border-t border-slate-300 page-break-avoid"
                style={{ 
                  pageBreakInside: 'avoid', 
                  breakInside: 'avoid',
                  paddingBottom: '2.5rem', 
                  marginBottom: '1.5rem',
                  lineHeight: 1.6 
                }}
              >
                {/* RIGHT SIDE: STAGE MANAGER */}
                <div className="flex-1 flex flex-col items-center page-break-avoid text-center">
                  <div className="font-black text-[11px] text-slate-950 mb-0.5">
                    مدير المرحلة
                  </div>
                  <div className="font-bold text-[11px] text-slate-800 mb-3">
                    أ/ {formattedManagerName}
                  </div>
                  <div className="text-slate-400 text-[11px] tracking-widest font-mono">
                    ..................................
                  </div>
                </div>

                {/* LEFT SIDE: HEAD OF DEPARTMENT */}
                <div className="flex-1 flex flex-col items-center page-break-avoid text-center">
                  <div className="font-black text-[11px] text-slate-950 mb-0.5">
                    رئيس قسم اللغة الألمانية
                  </div>
                  <div className="font-bold text-[11px] text-slate-800 mb-3">
                    أ/ {formattedHodName}
                  </div>
                  <div className="text-slate-400 text-[11px] tracking-widest font-mono">
                    ..................................
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default StageCommunicationView;
