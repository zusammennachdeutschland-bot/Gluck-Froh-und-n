import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  BarChart2, Printer, TrendingUp, AlertCircle, CheckCircle2, 
  Clock, Calendar, DollarSign, ArrowUpRight, AlertTriangle, Filter, Check
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';
import { Lesson, PaymentRecord } from '../types';
import { calculateOverallAttendance } from '../utils/lessonUtils';
import { formatLocalDate } from '../utils/timeUtils';
import confetti from 'canvas-confetti';

export const ReportsView: React.FC = () => {
  const { lessons: activeLessons, payments: activePayments, getHistoricalLessons, getHistoricalPayments, updateLesson, profile, openLessonControl, t, groups, students } = useApp();

  const [lessons, setLessons] = useState<Lesson[]>(activeLessons);
  const [payments, setPayments] = useState<PaymentRecord[]>(activePayments);
  const [loadingHistory, setLoadingHistory] = useState(true);

  React.useEffect(() => {
    let isMounted = true;
    Promise.all([getHistoricalLessons(), getHistoricalPayments()]).then(([histLessons, histPayments]) => {
      if (isMounted) {
        if (histLessons && histLessons.length > 0) setLessons(histLessons);
        if (histPayments && histPayments.length > 0) setPayments(histPayments);
        setLoadingHistory(false);
      }
    });
    return () => { isMounted = false; };
  }, [getHistoricalLessons, getHistoricalPayments]);
  const [showDebugModal, setShowDebugModal] = useState(false);

  const [activeFilter, setActiveFilter] = useState<'all' | 'this_week' | 'paid' | 'unpaid'>('all');

  // Helper to format date display (DD.MM.YYYY)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  // Helper to compute start of week date (Monday)
  const getWeekStart = (d: Date): Date => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
  };

  const getWeekKey = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Sonstige';
    const monday = getWeekStart(d);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatShort = (date: Date) => 
      `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;

    return `Woche ${formatShort(monday)} – ${formatShort(sunday)} (${monday.getFullYear()})`;
  };

  // Group lessons by week
  const sortedLessons = [...lessons].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter lessons
  const today = new Date();
  const currentWeekStart = getWeekStart(today);
  const getLocalDateStr = (d: Date) => formatLocalDate(d);

  const currentWeekStartStr = getLocalDateStr(currentWeekStart);

  const filteredLessons = sortedLessons.filter(l => {
    if (activeFilter === 'paid') return l.paymentStatus === 'paid';
    if (activeFilter === 'unpaid') return l.paymentStatus !== 'paid';
    if (activeFilter === 'this_week') {
      const lDate = new Date(l.date);
      const lWeekStart = getWeekStart(lDate);
      return getLocalDateStr(lWeekStart) === currentWeekStartStr;
    }
    return true;
  });

  // Grouping by week key
  const weeksGrouped: Record<string, Lesson[]> = {};
  filteredLessons.forEach(l => {
    const key = getWeekKey(l.date);
    if (!weeksGrouped[key]) weeksGrouped[key] = [];
    weeksGrouped[key].push(l);
  });

  // Overall Financial & Session Metrics
  const totalCollectedRevenue = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);
  const totalUnpaidAmount = payments.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amountDue, 0);

  const completedSessionsCount = lessons.filter(l => l.status === 'completed').length;
  const cancelledSessionsCount = lessons.filter(l => l.status === 'cancelled').length;

  const unpaidLastSessionsCount = lessons.filter(
    l => l.paymentStatus !== 'paid' && l.sessionNumber === l.totalSessionsInPackage
  ).length;

  // Mark as paid quick handler
  const handleMarkAsPaid = (e: React.MouseEvent, lesson: Lesson) => {
    e.stopPropagation();
    updateLesson(lesson.id, {
      paymentStatus: 'paid',
      amountPaid: lesson.amountDue
    });
    confetti({ particleCount: 50, spread: 40 });
  };

  // Revenue chart data by week or month
  const chartData = Object.entries(weeksGrouped).map(([weekLabel, weekLessons]) => {
    const sampleLessonDate = new Date(weekLessons[0].date);
    const wStart = getWeekStart(sampleLessonDate);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    const wStartStr = getLocalDateStr(wStart);
    const wEndStr = getLocalDateStr(wEnd);

    const collected = payments.filter(p => p.status === 'paid').filter(p => {
      const d = (p.paidDate || p.dueDate || '').substring(0, 10);
      return d >= wStartStr && d <= wEndStr;
    }).reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);

    const unpaid = payments.filter(p => p.status !== 'paid').filter(p => {
      const d = (p.dueDate || '').substring(0, 10);
      return d >= wStartStr && d <= wEndStr;
    }).reduce((sum, p) => sum + p.amountDue, 0);

    return {
      name: weekLabel.split(' ')[1] || weekLabel,
      Einnahmen: collected,
      Offen: unpaid
    };
  }).reverse();

  // Attendance breakdown
  const { presentCount, lateCount, absentCount } = calculateOverallAttendance(lessons, students);
  const attendanceData = [
    { name: 'Anwesend', value: presentCount, color: '#10B981' },
    { name: 'Verspätet', value: lateCount, color: '#F59E0B' },
    { name: 'Abwesend', value: absentCount, color: '#EF4444' }
  ];

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-4 ">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary dark:text-primary" />
            <span>{t ? t('reports_and_analyses') || 'Berichte & Analysen' : 'Berichte & Analysen'}</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-bold mt-0.5">
            Sitzungen, wöchentliche Einnahmen & Bezahlungs-Kontrolle
          </p>
        </div>

        <button
          onClick={handlePrintReport}
          className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Drucken / PDF</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-surface border border-surface-border rounded-lg p-2.5 sm:p-3 shadow-2xs">
          <span className="block text-[9px] font-bold text-text-muted/70 uppercase tracking-wider">{t('reports_collected_revenue')}</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base sm:text-lg font-black font-mono text-primary dark:text-primary">
              +{totalCollectedRevenue.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-slate-500">{profile.currency}</span>
          </div>
          <span className="text-[9px] text-primary font-bold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> Aus Sitzungen bezahlt
          </span>
        </div>

        <div className="bg-surface border border-surface-border rounded-lg p-2.5 sm:p-3 shadow-2xs">
          <span className="block text-[9px] font-bold text-text-muted/70 uppercase tracking-wider">{t('reports_unpaid_amount')}</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base sm:text-lg font-black font-mono text-primary dark:text-primary">
              {totalUnpaidAmount.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-slate-500">{profile.currency}</span>
          </div>
          <span className="text-[9px] text-primary font-bold flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3" /> Ausstehende Zahlungen
          </span>
        </div>

        <div className="bg-surface border border-surface-border rounded-lg p-2.5 sm:p-3 shadow-2xs">
          <span className="block text-[9px] font-bold text-text-muted/70 uppercase tracking-wider">{t('reports_sessions_completed')}</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base sm:text-lg font-black font-mono text-primary dark:text-primary">
              {completedSessionsCount}
            </span>
            <span className="text-[10px] font-bold text-slate-500">Sitzungen</span>
          </div>
          <span className="text-[9px] text-slate-500 font-bold mt-1 block">{t('reports_total_conducted')}</span>
        </div>

        <div className={`border rounded-lg p-2.5 sm:p-3 shadow-2xs transition-all ${
          unpaidLastSessionsCount > 0 
            ? 'bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-900/60' 
            : 'bg-surface border border-surface-border'
        }`}>
          <span className="block text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Letzte Sitzung Unbezahlt
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base sm:text-lg font-black font-mono text-red-600 dark:text-red-400">
              {unpaidLastSessionsCount}
            </span>
            <span className="text-[10px] font-bold text-red-600/80">{t('reports_packages') || 'Pakete'}</span>
          </div>
          <span className="text-[9px] text-red-700 dark:text-red-300 font-bold flex items-center gap-1 mt-1">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            {unpaidLastSessionsCount > 0 ? 'Dringend kassieren!' : 'Alles im grünen Bereich'}
          </span>
        </div>
      </div>

      {/* WEEKLY SESSIONS & MONEY LOG LIST */}
      <div className="bg-surface border border-surface-border rounded-lg p-3 sm:p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-surface-border pb-2.5">
          <div>
            <h3 className="text-xs font-black text-text-main uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Wöchentliches Sitzungs- & Einnahmen-Protokoll</span>
            </h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">
              Jede Sitzung mit erhaltenem Honorar und Bezahlungs-Warnungen
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-hover/80 p-0.5 rounded-lg border border-surface-border text-[10px] font-bold">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-surface text-text-main border border-surface-border dark:border-surface-border-soft shadow-2xs'
                  : 'text-text-muted border border-transparent'
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setActiveFilter('this_week')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeFilter === 'this_week'
                  ? 'bg-surface text-primary dark:text-primary border border-surface-border dark:border-surface-border-soft shadow-2xs'
                  : 'text-text-muted border border-transparent'
              }`}
            >
              Diese Woche
            </button>
            <button
              onClick={() => setActiveFilter('paid')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeFilter === 'paid'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-text-muted'
              }`}
            >
              Bezahlt
            </button>
            <button
              onClick={() => setActiveFilter('unpaid')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeFilter === 'unpaid'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-text-muted'
              }`}
            >
              Unbezahlt
            </button>
          </div>
        </div>

        {/* List grouped by week */}
        {Object.keys(weeksGrouped).length === 0 ? (
          <div className="text-center py-4 text-text-muted/70 text-xs font-bold italic">
            Keine Sitzungen für die ausgewählte Filteroption gefunden.
          </div>
        ) : (
          Object.entries(weeksGrouped).map(([weekTitle, weekLessons]) => {
            const sampleLessonDate = new Date(weekLessons[0].date);
            const wStart = getWeekStart(sampleLessonDate);
            const wEnd = new Date(wStart);
            wEnd.setDate(wStart.getDate() + 6);
            const wStartStr = getLocalDateStr(wStart);
            const wEndStr = getLocalDateStr(wEnd);

            const weekRevenue = payments.filter(p => p.status === 'paid').filter(p => {
              const d = (p.paidDate || p.dueDate || '').substring(0, 10);
              return d >= wStartStr && d <= wEndStr;
            }).reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);

            const weekUnpaid = payments.filter(p => p.status !== 'paid').filter(p => {
              const d = (p.dueDate || '').substring(0, 10);
              return d >= wStartStr && d <= wEndStr;
            }).reduce((sum, p) => sum + p.amountDue, 0);

            return (
              <div key={weekTitle} className="space-y-1.5 border border-slate-100 dark:border-surface-border/60 rounded-lg overflow-hidden bg-background/25 dark:bg-surface/40">
                {/* Week Header */}
                <div className="bg-surface-hover/80 px-3 py-2 flex flex-wrap items-center justify-between gap-1.5 border-b border-surface-border/60 dark:border-surface-border">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 font-mono">
                      📅 {weekTitle}
                    </span>
                    <span className="text-[9px] bg-surface dark:bg-slate-700 px-1.5 py-0.2 rounded border border-surface-border/60 dark:border-slate-600 font-bold text-text-main">
                      {weekLessons.length} Sitzungen
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono font-bold">
                    <span className="text-primary dark:text-primary flex items-center gap-1 text-[11px]">
                      <DollarSign className="w-3 h-3" />
                      +{weekRevenue} {profile.currency}
                    </span>
                    {weekUnpaid > 0 && (
                      <span className="text-primary dark:text-primary flex items-center gap-1 bg-primary-soft dark:bg-primary-soft px-1.5 py-0.2 rounded border border-primary-border text-[10px]">
                        ⚠️ {weekUnpaid} {profile.currency} offen
                      </span>
                    )}
                  </div>
                </div>

                {/* Session Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-850 p-0.5">
                  {weekLessons.map(l => {
                    const isLastSession = l.sessionNumber === l.totalSessionsInPackage;
                    const isUnpaidLastSession = isLastSession && l.paymentStatus !== 'paid';

                    return (
                      <div 
                        key={l.id}
                        onClick={() => openLessonControl(l)}
                        className={`p-2 sm:p-2.5 rounded-lg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer ${
                          isUnpaidLastSession
                            ? 'bg-red-50/40 dark:bg-red-950/20 border border-red-300 dark:border-red-900/40 hover:bg-red-50/80'
                            : 'hover:bg-slate-100/40 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        {/* Left: Group name, date, session info */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-text-main truncate max-w-xs">
                              {l.groupName || l.title}
                            </span>

                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary border border-primary-border dark:border-primary-border font-mono">
                              Sitzung {l.sessionNumber}/{l.totalSessionsInPackage}
                            </span>

                            {l.status === 'completed' ? (
                              <span className="text-[9px] font-bold text-primary bg-primary-soft dark:bg-primary-soft dark:text-primary px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Absolviert
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-primary bg-primary-soft dark:bg-primary-soft/40 dark:text-primary/70 px-1.5 py-0.5 rounded flex items-center gap-0.5 active:scale-95 transition-all hover:bg-primary/20">
                                <Clock className="w-2.5 h-2.5" /> Geplant
                              </span>
                            )}

                            {/* UNPAID LAST SESSION WARNING BADGE */}
                            {isUnpaidLastSession && (
                              <span className="text-[9px] font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                <AlertCircle className="w-3 h-3" />
                                Letztes Honorar offen!
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                            <span className="font-mono">{formatDateDisplay(l.date)} um {l.time} Uhr</span>
                            <span>•</span>
                            <span>{l.grade}</span>
                            <span>•</span>
                            <span>{l.type === 'online' ? 'Online' : 'Vor Ort'}</span>
                          </div>
                        </div>

                        {/* Right: Payment collected status & action */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="text-right">
                            {l.paymentStatus === 'paid' ? (
                              <div>
                                <span className="font-bold font-mono text-xs text-primary dark:text-primary">
                                  +{l.amountPaid || l.amountDue} {profile.currency}
                                </span>
                                <span className="block text-[9px] font-bold text-primary uppercase">
                                  ✓ Bezahlt
                                </span>
                              </div>
                            ) : l.paymentStatus === 'partial' ? (
                              <div>
                                <span className="font-bold font-mono text-xs text-primary dark:text-primary">
                                  +{l.amountPaid} {profile.currency}
                                </span>
                                <span className="block text-[9px] font-bold text-primary uppercase">
                                  Teilweise ({l.amountDue - l.amountPaid} offen)
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold font-mono text-xs text-red-600 dark:text-red-400">
                                  0 {profile.currency}
                                </span>
                                <span className="block text-[9px] font-bold text-red-600 uppercase">
                                  ⚠️ Offen ({l.amountDue} {profile.currency})
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Action Button to mark paid quickly */}
                          {l.paymentStatus !== 'paid' && (
                            <button
                              onClick={(e) => handleMarkAsPaid(e, l)}
                              className="px-2 py-1 bg-primary hover:bg-primary-hover text-white rounded text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="Als bezahlt markieren"
                            >
                              <Check className="w-3 h-3" />
                              <span>{t('payments_paid_btn')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Revenue & Attendance Visual Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly Revenue Bar Chart */}
        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span>Wöchentlicher Umsatz ({profile.currency})</span>
          </h3>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={10} />
                <YAxis stroke="var(--color-text-muted)" fontSize={10} />
                <Tooltip />
                <Bar dataKey="Einnahmen" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Offen" fill="var(--color-text-muted)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Breakdown */}
        <div className="bg-surface border border-surface-border rounded-xl p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-primary" />
            <span>{t('reports_attendance_overview_title')}</span>
          </h3>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={attendanceData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4}>
                  {attendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
