import React, { useState, useMemo } from 'react';
import { 
  X, Calendar, Clock, AlertTriangle, UserCheck, Shield, 
  Printer, Download, MessageCircle, Filter, Plus, Trash2, Edit3, 
  CheckCircle2, UserMinus, LogOut, Award, ChevronDown, Check
} from 'lucide-react';
import { 
  Teacher, 
  SchoolSettings, 
  StaffAttendanceRecord 
} from '../types';
import { 
  calculateStaffAttendanceMetrics,
  SYSTEM_STAGES 
} from '../utils/staffAttendanceUtils';

interface DetailedStaffAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceRecords?: StaffAttendanceRecord[];
  records?: StaffAttendanceRecord[];
  teachers?: Teacher[];
  schoolSettings?: SchoolSettings;
  onOpenNewRecordModal?: (teacherId?: string) => void;
  onAddRecord?: (teacher?: any) => void;
  onEditRecord?: (record: StaffAttendanceRecord) => void;
  onDeleteRecord: (id: string) => void;
  _t?: (ar: string, en: string, de?: string) => string;
  language?: string;
}

export const DetailedStaffAttendanceModal: React.FC<DetailedStaffAttendanceModalProps> = ({
  isOpen,
  onClose,
  attendanceRecords: propAttendanceRecords,
  records,
  teachers: propTeachers,
  schoolSettings: propSchoolSettings,
  onOpenNewRecordModal,
  onAddRecord,
  onEditRecord,
  onDeleteRecord,
  _t: propT,
  language = 'ar'
}) => {
  const attendanceRecords = useMemo(() => {
    if (propAttendanceRecords && Array.isArray(propAttendanceRecords)) {
      return propAttendanceRecords;
    }
    if (records && Array.isArray(records)) {
      return records;
    }
    return [];
  }, [propAttendanceRecords, records]);

  const teachers = useMemo(() => {
    return (propTeachers && Array.isArray(propTeachers)) ? propTeachers : [];
  }, [propTeachers]);

  const schoolSettings = useMemo(() => {
    return propSchoolSettings || ({} as SchoolSettings);
  }, [propSchoolSettings]);

  const _t = useMemo(() => {
    return propT || ((ar: string, en: string, de?: string) => ar);
  }, [propT]);

  const handleOpenAdd = (teacherId?: string) => {
    if (onOpenNewRecordModal) {
      onOpenNewRecordModal(teacherId);
    } else if (onAddRecord) {
      const t = teachers.find(item => item.id === teacherId);
      onAddRecord(t);
    }
  };

  const [activeRange, setActiveRange] = useState<'this_week' | 'this_month' | 'all'>('this_week');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'weekly_table' | 'monthly_summary' | 'detailed_logs'>('weekly_table');

  const metrics = useMemo(() => {
    return calculateStaffAttendanceMetrics(
      attendanceRecords,
      teachers,
      schoolSettings,
      activeRange,
      selectedStage
    );
  }, [attendanceRecords, teachers, schoolSettings, activeRange, selectedStage]);

  // Filtered raw records
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter(r => {
      if (r.deleted) return false;
      if (selectedStage !== 'all' && r.stageName && r.stageName !== selectedStage) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendanceRecords, selectedStage]);

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // WhatsApp summary share
  const handleShareWhatsApp = () => {
    const title = activeRange === 'this_week' 
      ? '📊 تقرير انضباط وحضور المعلمين الأسبوعي - HOD Report'
      : '📊 تقرير انضباط وحضور المعلمين الشهري - HOD Report';

    const lines = [
      `*${schoolSettings.schoolName || 'المدرسة'}*`,
      `*قسم اللغة الألمانية* - ${schoolSettings.departmentName || ''}`,
      `${title}`,
      `التاريخ: ${new Date().toLocaleDateString('ar-EG')}`,
      `---------------------------------`,
      `• إجمالي حالات الغياب: ${metrics.totalAbsences}`,
      `• إجمالي حالات التأخير: ${metrics.totalLateArrivals}`,
      `• إجمالي الانصراف المبكر: ${metrics.totalEarlyLeaves}`,
      `• إجمالي دقائق التأخير: ${metrics.totalDelayMinutes} دقيقة`,
      `• إجمالي الساعات المفقودة: ${metrics.totalLostHours} ساعة`,
      `• متوسط معدل الحضور: ${metrics.averageAttendanceRate}%`,
      `---------------------------------`,
      `*ترتيب المعلمين حسب المخالفات ودرجة الانضباط:*`
    ];

    metrics.teacherStats.slice(0, 10).forEach((t, i) => {
      lines.push(`${i + 1}. ${t.teacherName} (${t.stageName}): ${t.totalViolations} مخالفات | درجة الانضباط: ${t.disciplineScore}%`);
    });

    lines.push(`---------------------------------`);
    lines.push(`رئيس القسم: ${schoolSettings.hodName || 'رئيس القسم'}`);

    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[105] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-surface border border-surface-border rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surface-border flex items-center justify-between bg-surface-hover/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-main flex items-center gap-2">
                {_t('تقرير حضور وانضباط المعلمين التفصيلي', 'Staff Attendance & Discipline Detailed Report', 'Detaillierter Anwesenheitsbericht')}
              </h2>
              <p className="text-[11px] font-bold text-text-muted">
                {_t('متابعة شاملة للغياب، التأخير الصباحي، الانصراف المبكر، ومعدلات الانضباط', 'Comprehensive staff attendance and punctuality tracking', 'Umfassende Anwesenheits- und Pünktlichkeitserfassung')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 bg-surface-hover hover:bg-surface-border border border-surface-border rounded-xl text-text-main font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              title={_t('طباعة التقرير', 'Print Report', 'Drucken')}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{_t('طباعة', 'Print', 'Drucken')}</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              title={_t('مشاركة عبر واتساب', 'Share WhatsApp', 'WhatsApp')}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{_t('واتساب', 'WhatsApp', 'WhatsApp')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-xl text-text-muted cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-3 sm:px-5 bg-surface-hover/50 border-b border-surface-border flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          {/* Time Range Filter */}
          <div className="flex items-center gap-1 bg-surface border border-surface-border p-1 rounded-xl">
            <button
              onClick={() => setActiveRange('this_week')}
              className={`px-3 py-1.5 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                activeRange === 'this_week'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {_t('هذا الأسبوع (Weekly)', 'This Week', 'Diese Woche')}
            </button>
            <button
              onClick={() => setActiveRange('this_month')}
              className={`px-3 py-1.5 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                activeRange === 'this_month'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {_t('هذا الشهر (Monthly)', 'This Month', 'Diesen Monat')}
            </button>
            <button
              onClick={() => setActiveRange('all')}
              className={`px-3 py-1.5 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                activeRange === 'all'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {_t('كل السجلات', 'All Time', 'Gesamt')}
            </button>
          </div>

          {/* Stage Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-text-muted">{_t('المرحلة:', 'Stage:', 'Stufe:')}</span>
            <select
              value={selectedStage}
              onChange={e => setSelectedStage(e.target.value)}
              className="px-2.5 py-1.5 bg-surface border border-surface-border rounded-xl font-bold text-[11px] text-text-main"
            >
              <option value="all">{_t('جميع المراحل', 'All Stages', 'Alle Stufen')}</option>
              {SYSTEM_STAGES.map(s => (
                <option key={s.id} value={s.id}>{s.nameAr}</option>
              ))}
            </select>

            <button
              onClick={() => handleOpenAdd()}
              className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{_t('تسجيل جديد', 'Log Event', 'Erfassen')}</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="px-4 sm:px-5 pt-3 border-b border-surface-border flex items-center gap-4 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('weekly_table')}
            className={`pb-2.5 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'weekly_table'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>{_t('جدول انضباط المعلمين (HOD Report Table)', 'Teacher Discipline Table', 'Disziplintabelle')}</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly_summary')}
            className={`pb-2.5 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'monthly_summary'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{_t('الملخص الإحصائي والمخالفات الأكثر (Monthly Summary)', 'Attendance Summary & Rankings', 'Statistik & Rangliste')}</span>
          </button>

          <button
            onClick={() => setActiveTab('detailed_logs')}
            className={`pb-2.5 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'detailed_logs'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{_t('سجل الوقائع بالتفصيل', 'Detailed Event Logs', 'Ereignisprotokoll')} ({filteredRecords.length})</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Top Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 bg-surface-hover/80 border border-surface-border rounded-xl">
              <span className="text-[10px] font-bold text-text-muted uppercase block">{_t('حالات الغياب', 'Absences', 'Fehltage')}</span>
              <p className="text-xl font-black text-rose-600 mt-1">{metrics.totalAbsences}</p>
            </div>
            <div className="p-3 bg-surface-hover/80 border border-surface-border rounded-xl">
              <span className="text-[10px] font-bold text-text-muted uppercase block">{_t('حالات التأخير', 'Late Arrivals', 'Verspätungen')}</span>
              <p className="text-xl font-black text-amber-600 mt-1">{metrics.totalLateArrivals}</p>
            </div>
            <div className="p-3 bg-surface-hover/80 border border-surface-border rounded-xl">
              <span className="text-[10px] font-bold text-text-muted uppercase block">{_t('انصراف مبكر', 'Early Leaves', 'Früher Feierabend')}</span>
              <p className="text-xl font-black text-orange-600 mt-1">{metrics.totalEarlyLeaves}</p>
            </div>
            <div className="p-3 bg-surface-hover/80 border border-surface-border rounded-xl">
              <span className="text-[10px] font-bold text-text-muted uppercase block">{_t('دقائق التأخير', 'Delay Minutes', 'Verzögerungsmin.')}</span>
              <p className="text-xl font-black text-blue-600 mt-1">{metrics.totalDelayMinutes}m</p>
            </div>
            <div className="col-span-2 sm:col-span-1 p-3 bg-primary/10 border border-primary/20 rounded-xl">
              <span className="text-[10px] font-bold text-primary uppercase block">{_t('معدل الحضور', 'Attendance Rate', 'Anwesenheitsrate')}</span>
              <p className="text-xl font-black text-primary mt-1">{metrics.averageAttendanceRate}%</p>
            </div>
          </div>

          {/* ================= TAB 1: WEEKLY TABLE (Requirement 6) ================= */}
          {activeTab === 'weekly_table' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-text-main">
                    {_t('جدول حضور وانضباط المعلمين (مرتب حسب المخالفات)', 'Teacher Attendance & Discipline Table (Sorted by Violations)', 'Lehrer-Anwesenheitstabelle (nach Verstößen sortiert)')}
                  </h3>
                  <p className="text-[11px] text-text-muted font-semibold">
                    {_t('مرتب تنازلياً حسب إجمالي المخالفات المسجلة للتركيز على المعلمين المحتاجين لمتابعة', 'Ranked by total violations to prioritize follow-up', 'Sortiert nach Gesamtzahl der Vorfälle')}
                  </p>
                </div>
              </div>

              <div className="border border-surface-border rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-surface-hover text-text-muted font-black border-b border-surface-border">
                      <th className="p-2.5 text-center w-10">#</th>
                      <th className="p-2.5">{_t('اسم المعلم', 'Teacher Name', 'Lehrer')}</th>
                      <th className="p-2.5 text-center">{_t('المرحلة', 'Stage', 'Stufe')}</th>
                      <th className="p-2.5 text-center text-rose-600">{_t('الغياب', 'Absences', 'Fehltage')}</th>
                      <th className="p-2.5 text-center text-amber-600">{_t('التأخيرات', 'Late Arrivals', 'Verspätung')}</th>
                      <th className="p-2.5 text-center text-orange-600">{_t('الانصراف المبكر', 'Early Leaves', 'Vorzeitiger')}</th>
                      <th className="p-2.5 text-center text-blue-600">{_t('دقائق التأخير', 'Delay Minutes', 'Minuten')}</th>
                      <th className="p-2.5 text-center">{_t('درجة الانضباط', 'Discipline Score', 'Punktzahl')}</th>
                      <th className="p-2.5 text-center">{_t('إجراء', 'Action', 'Aktion')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {metrics.teacherStats.map((stat, idx) => {
                      const scoreColor = stat.disciplineScore >= 90 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' :
                                         stat.disciplineScore >= 75 ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' :
                                         'text-rose-600 bg-rose-50 dark:bg-rose-950/40';

                      return (
                        <tr key={stat.teacherId} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="p-2.5 text-center font-bold text-text-muted">{idx + 1}</td>
                          <td className="p-2.5 font-black text-text-main flex items-center gap-2">
                            <span>{stat.teacherName}</span>
                            {stat.totalViolations > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-500/10 text-rose-600">
                                {stat.totalViolations} {_t('مخالفة', 'infractions', 'Vorfälle')}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-bold text-text-muted">{stat.stageName}</td>
                          <td className="p-2.5 text-center font-black text-rose-600">{stat.absences}</td>
                          <td className="p-2.5 text-center font-black text-amber-600">{stat.lateArrivals}</td>
                          <td className="p-2.5 text-center font-black text-orange-600">{stat.earlyLeaves}</td>
                          <td className="p-2.5 text-center font-black text-blue-600">{stat.delayMinutes}m</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black inline-block ${scoreColor}`}>
                              {stat.disciplineScore}%
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => handleOpenAdd(stat.teacherId)}
                              className="px-2 py-1 bg-surface border border-surface-border hover:bg-surface-hover text-primary font-bold text-[10.5px] rounded-lg transition-colors cursor-pointer"
                            >
                              + {_t('تسجيل', 'Log', 'Erfassen')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 2: MONTHLY SUMMARY (Requirement 7) ================= */}
          {activeTab === 'monthly_summary' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-text-main">
                  {_t('ملخص الحضور والانضباط الشهري (Monthly Staff Attendance Summary)', 'Monthly Staff Attendance Summary', 'Monatliche Anwesenheitsübersicht')}
                </h3>
                <p className="text-[11px] text-text-muted font-semibold">
                  {_t('الإحصائيات التراكمية وساعات العمل المفقودة والمعلمين الأكثر غياباً وتأخيراً', 'Cumulative stats, lost hours, and top absent/late teachers', 'Gesamtübersicht und auffällige Lehrkräfte')}
                </p>
              </div>

              {/* Aggregated Totals Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-surface-hover border border-surface-border rounded-2xl space-y-1">
                  <span className="text-[10.5px] font-bold text-text-muted uppercase tracking-wider">{_t('إجمالي حالات الغياب', 'Total Absences', 'Fehltage')}</span>
                  <p className="text-2xl font-black text-rose-600">{metrics.totalAbsences}</p>
                  <p className="text-[10px] text-text-muted">{_t('حالة غياب مسجلة خلال الفترة', 'Absence events', 'Abwesenheiten')}</p>
                </div>

                <div className="p-4 bg-surface-hover border border-surface-border rounded-2xl space-y-1">
                  <span className="text-[10.5px] font-bold text-text-muted uppercase tracking-wider">{_t('إجمالي حالات التأخير', 'Total Late Arrivals', 'Verspätungen')}</span>
                  <p className="text-2xl font-black text-amber-600">{metrics.totalLateArrivals}</p>
                  <p className="text-[10px] text-text-muted">{_t('تأخير صباحي عن الطابور أو الحصة الأولى', 'Morning delays', 'Morgendliche Verspätungen')}</p>
                </div>

                <div className="p-4 bg-surface-hover border border-surface-border rounded-2xl space-y-1">
                  <span className="text-[10.5px] font-bold text-text-muted uppercase tracking-wider">{_t('إجمالي الانصراف المبكر', 'Total Early Leaves', 'Früher Feierabend')}</span>
                  <p className="text-2xl font-black text-orange-600">{metrics.totalEarlyLeaves}</p>
                  <p className="text-[10px] text-text-muted">{_t('انصراف قبل موعد انتهاء اليوم الدراسي', 'Left before end of day', 'Vor Schulschluss verlassen')}</p>
                </div>

                <div className="p-4 bg-surface-hover border border-surface-border rounded-2xl space-y-1">
                  <span className="text-[10.5px] font-bold text-text-muted uppercase tracking-wider">{_t('إجمالي دقائق التأخير', 'Total Delay Minutes', 'Gesamt-Verspätungsminuten')}</span>
                  <p className="text-2xl font-black text-blue-600">{metrics.totalDelayMinutes} {_t('دقيقة', 'mins', 'Minuten')}</p>
                  <p className="text-[10px] text-text-muted">{_t('مجموع دقائق التأخير الصباحي', 'Morning delay minutes', 'Morgendliche Verspätung')}</p>
                </div>

                <div className="p-4 bg-surface-hover border border-surface-border rounded-2xl space-y-1">
                  <span className="text-[10.5px] font-bold text-text-muted uppercase tracking-wider">{_t('إجمالي الساعات المفقودة', 'Total Lost Hours', 'Verlorene Stunden')}</span>
                  <p className="text-2xl font-black text-indigo-600">{metrics.totalLostHours} {_t('ساعة', 'hours', 'Std.')}</p>
                  <p className="text-[10px] text-text-muted">{_t('ناتج دقائق التأخير والانصراف المبكر', 'Lost hours from delays and early leaves', 'Verlorene Arbeitsstunden')}</p>
                </div>

                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1">
                  <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">{_t('متوسط معدل الحضور العام', 'Average Attendance Rate', 'Durchschnittliche Anwesenheit')}</span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.averageAttendanceRate}%</p>
                  <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">{_t('نسبة التزام كادر اللغة الألمانية', 'Department discipline rating', 'Abteilungsanwesenheit')}</p>
                </div>
              </div>

              {/* Monthly Rankings (المعلمون الأكثر غياباً وتأخيراً) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {/* Most Absent Teachers */}
                <div className="p-3.5 bg-surface border border-surface-border rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-rose-600 font-black text-xs">
                    <UserMinus className="w-4 h-4" />
                    <span>{_t('المعلمون الأكثر غياباً (Most Absent)', 'Most Absent Teachers', 'Häufigste Abwesenheiten')}</span>
                  </div>
                  {metrics.mostAbsentTeachers.length === 0 ? (
                    <p className="text-[11px] text-text-muted font-bold py-3 text-center">{_t('لا توجد حالات غياب مسجلة 🟢', 'No absences recorded 🟢', 'Keine Abwesenheiten 🟢')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {metrics.mostAbsentTeachers.map((t, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-hover text-xs">
                          <span className="font-bold text-text-main truncate">{t.name}</span>
                          <span className="font-black text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-md">
                            {t.count} {_t('أيام', 'days', 'Tage')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Most Late Teachers */}
                <div className="p-3.5 bg-surface border border-surface-border rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-600 font-black text-xs">
                    <Clock className="w-4 h-4" />
                    <span>{_t('المعلمون الأكثر تأخيراً (Most Late)', 'Most Late Teachers', 'Häufigste Verspätungen')}</span>
                  </div>
                  {metrics.mostLateTeachers.length === 0 ? (
                    <p className="text-[11px] text-text-muted font-bold py-3 text-center">{_t('لا توجد تأخيرات مسجلة 🟢', 'No late arrivals recorded 🟢', 'Keine Verspätungen 🟢')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {metrics.mostLateTeachers.map((t, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-hover text-xs">
                          <span className="font-bold text-text-main truncate">{t.name}</span>
                          <span className="font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md">
                            {t.minutes}m ({t.count}x)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Most Early Leave Teachers */}
                <div className="p-3.5 bg-surface border border-surface-border rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-orange-600 font-black text-xs">
                    <LogOut className="w-4 h-4" />
                    <span>{_t('الأكثر انصرافاً مبكراً (Early Leave)', 'Most Early Leave Teachers', 'Frühe Feierabende')}</span>
                  </div>
                  {metrics.mostEarlyLeaveTeachers.length === 0 ? (
                    <p className="text-[11px] text-text-muted font-bold py-3 text-center">{_t('لا توجد حالات انصراف مبكر 🟢', 'No early leaves recorded 🟢', 'Keine vorzeitigen Feierabende 🟢')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {metrics.mostEarlyLeaveTeachers.map((t, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-hover text-xs">
                          <span className="font-bold text-text-main truncate">{t.name}</span>
                          <span className="font-black text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-md">
                            {t.minutes}m ({t.count}x)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: DETAILED EVENT LOGS ================= */}
          {activeTab === 'detailed_logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-text-main">
                  {_t('قائمة السجلات والوقائع المسجلة', 'All Event Records', 'Alle erfassten Vorfälle')}
                </h3>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-text-muted">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2 opacity-60" />
                  <p className="font-bold text-sm">{_t('لا توجد مخالفات أو أحداث مسجلة في هذا النطاق', 'No events logged in this range', 'Keine Vorfälle protokolliert')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRecords.map(r => {
                    const badgeClass = r.type === 'absence' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' :
                                       r.type === 'late_arrival' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                                       'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300';

                    const typeLabel = r.type === 'absence' ? _t('غياب', 'Absence', 'Abwesenheit') :
                                      r.type === 'late_arrival' ? _t('تأخير صباحي', 'Late Arrival', 'Verspätung') :
                                      _t('انصراف مبكر', 'Early Leave', 'Früher Feierabend');

                    return (
                      <div key={r.id} className="p-3 bg-surface border border-surface-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/40 transition-colors">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${badgeClass}`}>
                              {typeLabel}
                            </span>
                            <span className="font-black text-text-main text-xs">{r.teacherName}</span>
                            <span className="text-[10px] font-bold text-text-muted">({r.stageName || 'عام'})</span>
                            <span className="text-[10px] text-text-muted font-mono">{r.date}</span>
                          </div>

                          <p className="text-[11px] font-semibold text-text-main">
                            <span className="text-text-muted">{_t('السبب:', 'Reason:', 'Grund:')}</span> {r.reason}
                          </p>

                          {/* Extra info */}
                          <div className="flex items-center gap-3 text-[10px] text-text-muted flex-wrap">
                            {r.type === 'absence' && (
                              <>
                                <span>{r.absenceScope === 'lesson_based' ? `حصة ${r.periodNumber} (${r.lessonClass || ''})` : 'يوم كامل'}</span>
                                <span className={r.absenceStatus === 'excused' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                  {r.absenceStatus === 'excused' ? 'بعذر' : 'بدون عذر'}
                                </span>
                                {r.replacementAssignments && r.replacementAssignments.length > 0 ? (
                                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                    {_t('الاحتياطي:', 'Substitutes:', 'Vertretung:')} {r.replacementAssignments.map(a => `${a.className || `حصة ${a.periodNumber}`}: ${a.replacementTeacherName || 'بدون تعويض'}`).join(' | ')}
                                  </span>
                                ) : r.replacementTeacherName ? (
                                  <span>{_t('المعلم البديل:', 'Replacement:', 'Vertretung:')} {r.replacementTeacherName}</span>
                                ) : null}
                              </>
                            )}
                            {r.type === 'late_arrival' && (
                              <span>{_t('المقرر:', 'Scheduled:', 'Soll:')} {r.scheduledArrivalTime} | {_t('الفعلي:', 'Actual:', 'Ist:')} {r.actualArrivalTime} (<b>{r.delayMinutes} {_t('دقيقة تأخير', 'min delay', 'Min.')}</b>)</span>
                            )}
                            {r.type === 'early_leave' && (
                              <span>{_t('المقرر:', 'Scheduled:', 'Soll:')} {r.scheduledLeaveTime} | {_t('الفعلي:', 'Actual:', 'Ist:')} {r.actualLeaveTime} (<b>{r.lostMinutes} {_t('دقيقة مفقودة', 'lost min', 'Min.')}</b>)</span>
                            )}
                            {r.stageSecretaryName && (
                              <span className="text-primary font-bold">
                                {_t('تم إخطار السكرتيرة:', 'Notified Sec:', 'Sekr. benachrichtigt:')} {r.stageSecretaryName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 self-end sm:self-center">
                          {onEditRecord && (
                            <button
                              onClick={() => onEditRecord(r)}
                              className="p-1.5 text-primary hover:bg-primary-soft rounded-lg transition-colors cursor-pointer"
                              title={_t('تعديل السجل', 'Edit Record', 'Bearbeiten')}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteRecord(r.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title={_t('حذف السجل', 'Delete', 'Löschen')}
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>
    </div>
  );
};
