import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, BarChart3, Users, Award, TrendingUp, CheckCircle2, 
  XCircle, DollarSign, Video, MapPin, PieChart, ShieldAlert, ChevronRight
} from 'lucide-react';
import { isLikelyFemaleStudent } from '../utils/genderUtils';

interface GroupAnalyticsModalProps {
  onClose: () => void;
}

export const GroupAnalyticsModal: React.FC<GroupAnalyticsModalProps> = ({ onClose }) => {
  const { students, groups, lessons, payments, _t } = useApp();

  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  // Active non-archived students
  const activeStudents = useMemo(() => {
    return students.filter(s => s.status !== 'archived');
  }, [students]);

  // Overall metrics
  const totalStudentsCount = activeStudents.length;
  const totalGroupsCount = groups.length;

  // Gender stats
  const maleCount = useMemo(() => {
    return activeStudents.filter(s => s.gender === 'male' || (s.gender !== 'female' && !isLikelyFemaleStudent(s.name))).length;
  }, [activeStudents]);

  const femaleCount = useMemo(() => {
    return activeStudents.filter(s => s.gender === 'female' || (s.gender !== 'male' && isLikelyFemaleStudent(s.name))).length;
  }, [activeStudents]);

  // Mode stats
  const onlineCount = useMemo(() => {
    return activeStudents.filter(s => {
      const g = groups.find(group => group.id === s.groupId);
      return g?.mode === 'online';
    }).length;
  }, [activeStudents, groups]);

  const offlineCount = useMemo(() => {
    return activeStudents.filter(s => {
      const g = groups.find(group => group.id === s.groupId);
      return g?.mode === 'offline';
    }).length;
  }, [activeStudents, groups]);

  // Detailed group stats list
  const groupStats = useMemo(() => {
    return groups.map(group => {
      const groupStudents = activeStudents.filter(s => s.groupId === group.id);
      const studentCount = groupStudents.length;

      // Lessons for this group
      const groupLessons = lessons.filter(l => l.groupId === group.id && l.status === 'completed');
      
      // Calculate attendance rate
      let totalPresent = 0;
      let totalExpected = 0;

      groupLessons.forEach(lesson => {
        if (lesson.attendance) {
          Object.values(lesson.attendance).forEach((record: any) => {
            totalExpected++;
            if (record?.status === 'present' || record?.status === 'late') {
              totalPresent++;
            }
          });
        }
      });

      const attendanceRate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 100;

      // Group revenue / expected payments
      const groupPayments = payments.filter(p => {
        const student = activeStudents.find(s => s.id === p.studentId);
        return student && student.groupId === group.id;
      });

      const totalPaidAmount = groupPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      return {
        group,
        studentCount,
        completedLessonsCount: groupLessons.length,
        attendanceRate,
        totalPaidAmount
      };
    }).sort((a, b) => b.studentCount - a.studentCount);
  }, [groups, activeStudents, lessons, payments]);

  // Filtered stats if a specific group is chosen
  const filteredGroupStats = useMemo(() => {
    if (selectedGroupId === 'all') return groupStats;
    return groupStats.filter(item => item.group.id === selectedGroupId);
  }, [groupStats, selectedGroupId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-hover/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-text-main">
                {_t('إحصائيات وتقارير المجموعات', 'Group Analytics & Reports', 'Gruppenstatistiken')}
              </h3>
              <p className="text-xs text-text-muted">
                {_t('ملخص شامِل لأداء المجموعات، نسب الحضور وتوزيع الطلاب', 'Comprehensive overview of group performance & attendance', 'Gesamtübersicht über die Gruppenleistung')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-main rounded-xl hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-3 border-b border-surface-border bg-surface flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-muted">{_t('تصفية حسب المجموعة:', 'Filter Group:', 'Gruppe filtern:')}</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3 py-1.5 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">{_t('جميع المجموعات', 'All Groups', 'Alle Gruppen')} ({groups.length})</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="text-text-muted font-bold text-[11px]">
            {_t(`إجمالي الطلاب: ${totalStudentsCount} طالب`, `Total Students: ${totalStudentsCount}`, `Gesamtschüler: ${totalStudentsCount}`)}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 no-scrollbar">
          {/* Top Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/15 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
                <span className="text-xs font-bold">{_t('إجمالي الطلاب', 'Total Students', 'Schüler')}</span>
                <Users className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-text-main">{totalStudentsCount}</div>
              <div className="text-[10px] text-text-muted mt-1">{totalGroupsCount} {_t('مجموعة نشطة', 'active groups', 'aktive Gruppen')}</div>
            </div>

            <div className="p-3 bg-pink-500/5 dark:bg-pink-500/10 border border-pink-500/15 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-pink-600 dark:text-pink-400 mb-1">
                <span className="text-xs font-bold">{_t('توزيع الجنس', 'Gender', 'Geschlecht')}</span>
                <PieChart className="w-4 h-4" />
              </div>
              <div className="text-sm font-black text-text-main flex items-center justify-between">
                <span>👦 {maleCount} {_t('بنين', 'Boys', 'Jungen')}</span>
                <span>👧 {femaleCount} {_t('بنات', 'Girls', 'Mädchen')}</span>
              </div>
              <div className="text-[10px] text-text-muted mt-1">{_t('نسبة الذكور والإناث', 'Male & Female ratio', 'Geschlechterverhältnis')}</div>
            </div>

            <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                <span className="text-xs font-bold">{_t('الأونلاين والأوفلاين', 'Online / Offline', 'Online / Präsenz')}</span>
                <Video className="w-4 h-4" />
              </div>
              <div className="text-sm font-black text-text-main flex items-center justify-between">
                <span>💻 {onlineCount}</span>
                <span>🏫 {offlineCount}</span>
              </div>
              <div className="text-[10px] text-text-muted mt-1">{_t('نمط الدراسة', 'Study Mode', 'Studienmodus')}</div>
            </div>

            <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                <span className="text-xs font-bold">{_t('متوسط الحضور', 'Avg Attendance', 'Ø Anwesenheit')}</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-text-main">
                {groupStats.length > 0 
                  ? `${Math.round(groupStats.reduce((acc, curr) => acc + curr.attendanceRate, 0) / groupStats.length)}%` 
                  : '100%'}
              </div>
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">{_t('معدل ممتاز', 'Excellent', 'Ausgezeichnet')}</div>
            </div>
          </div>

          {/* Group Breakdown Cards */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-text-main flex items-center justify-between">
              <span>{_t('تفاصيل المجموعات والمستويات', 'Group Details & Levels', 'Gruppendetails')}</span>
              <span className="text-[11px] text-text-muted font-normal">({filteredGroupStats.length} {_t('مجموعة', 'groups', 'Gruppen')})</span>
            </h4>

            {filteredGroupStats.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-xs border border-dashed border-surface-border rounded-xl">
                {_t('لا توجد بيانات مجموعات للعرض حالياً', 'No group analytics available', 'Keine Gruppenstatistiken vorhanden')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredGroupStats.map(({ group, studentCount, completedLessonsCount, attendanceRate, totalPaidAmount }) => (
                  <div 
                    key={group.id} 
                    className="p-3.5 bg-surface-hover/60 border border-surface-border rounded-xl hover:border-primary/30 transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-black text-text-main flex items-center gap-1.5">
                          <span>{group.name}</span>
                          <span className={`px-1.5 py-0.2 text-[9.5px] font-bold rounded-md ${
                            group.mode === 'online' 
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {group.mode === 'online' ? _t('أونلاين', 'Online', 'Online') : _t('سنتر', 'Center', 'Präsenz')}
                          </span>
                        </h5>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {group.grade || _t('بدون صف محدد', 'No grade set', 'Keine Klasse')} • {group.schedule || _t('بدون موعد', 'No schedule', 'Kein Zeitplan')}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-primary">{studentCount}</span>
                        <span className="text-[10px] text-text-muted block">{_t('طالب', 'students', 'Schüler')}</span>
                      </div>
                    </div>

                    {/* Attendance Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10.5px] font-bold">
                        <span className="text-text-muted">{_t('نسبة الالتزام والحضور', 'Attendance Rate', 'Anwesenheitsrate')}</span>
                        <span className={attendanceRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                          {attendanceRate}%
                        </span>
                      </div>
                      <div className="w-full bg-surface-border rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            attendanceRate >= 80 ? 'bg-emerald-500' : attendanceRate >= 60 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${attendanceRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer Stats */}
                    <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between text-[10.5px] text-text-muted font-bold">
                      <span>{_t(`الحصص المنفذة: ${completedLessonsCount}`, `Completed Lessons: ${completedLessonsCount}`, `Absolvierte Stunden: ${completedLessonsCount}`)}</span>
                      <span className="text-text-main">{_t(`المتحصلات: ${totalPaidAmount} ج.م`, `Collected: ${totalPaidAmount} EGP`, `Einnahmen: ${totalPaidAmount}`)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-hover/40 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            {_t('إغلاق', 'Close', 'Schließen')}
          </button>
        </div>
      </div>
    </div>
  );
};
