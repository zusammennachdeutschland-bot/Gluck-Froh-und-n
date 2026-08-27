import { Preferences } from '@capacitor/preferences';
import { registerPlugin } from '@capacitor/core';
import { Lesson, Student, PaymentRecord, TodoItem, Group, TeacherProfile, FinanceInstallment, FinanceRecurring } from '../types';
import { formatLocalDate } from '../utils/timeUtils';
import { calculateDuePaymentCycles } from '../utils/paymentUtils';
import { calculateOverallAttendance } from '../utils/lessonUtils';
import { buildWhatsAppUrl, formatWhatsAppPhone } from '../utils/phoneUtils';

export interface WidgetManagerPlugin {
  updateWidget(): Promise<void>;
}

const WidgetManager = registerPlugin<WidgetManagerPlugin>('WidgetManager');

const formatTime12h = (timeStr: string) => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
};

/**
 * Helper to calculate today's revenue from genuinely paid payment records.
 */
const getTodayRevenue = (payments: PaymentRecord[]): number => {
  const todayStr = formatLocalDate();
  const paidOnly = payments.filter(p => p.status === 'paid');
  const dailyPayments = paidOnly.filter(p => {
    const d = p.paidDate || p.dueDate;
    return d && d.startsWith(todayStr);
  });
  return dailyPayments.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);
};

/**
 * Helper to calculate current week's revenue (Friday to Thursday) from genuinely paid payment records.
 */
const getWeeklyRevenue = (payments: PaymentRecord[]): number => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const daysSinceFriday = (day + 2) % 7;

  const friday = new Date(now);
  friday.setDate(now.getDate() - daysSinceFriday);
  friday.setHours(0, 0, 0, 0);

  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() + 6);
  thursday.setHours(23, 59, 59, 999);

  const friStr = formatLocalDate(friday);
  const thuStr = formatLocalDate(thursday);

  const paidOnly = payments.filter(p => p.status === 'paid');
  const weeklyPayments = paidOnly.filter(p => {
    const d = p.paidDate || p.dueDate;
    if (!d) return false;
    const dateOnly = d.substring(0, 10);
    return dateOnly >= friStr && dateOnly <= thuStr;
  });
  return weeklyPayments.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);
};

/**
 * Helper to calculate current month's revenue from genuinely paid payment records.
 */
const getMonthlyRevenue = (payments: PaymentRecord[]): number => {
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const paidOnly = payments.filter(p => p.status === 'paid');
  const monthlyPayments = paidOnly.filter(p => {
    const d = p.paidDate || p.dueDate;
    return d && d.startsWith(currentMonthPrefix);
  });
  return monthlyPayments.reduce((sum, p) => sum + (p.amountPaid || p.amountDue || 0), 0);
};

/**
 * Helper to calculate attendance percentage from completed lessons and attendance reports.
 */
const getAttendanceRate = (lessons: Lesson[], students: Student[]): number => {
  const { presentCount, lateCount, absentCount } = calculateOverallAttendance(lessons, students);
  const total = presentCount + lateCount + absentCount;
  if (total === 0) return 0;
  return Math.round(((presentCount + lateCount) / total) * 100);
};

/**
 * 1. Sync Today's Lessons to SharedPreferences ('widget_today_lessons')
 */
export const syncTodayLessonsToWidget = async (lessons: Lesson[]) => {
  try {
    const todayStr = formatLocalDate();
    const todaysLessons = lessons
      .filter(l => l.date === todayStr)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(l => ({
        id: l.id,
        time: formatTime12h(l.time),
        title: l.title || l.studentName || l.groupName || 'Lesson',
        status: l.status
      }));

    await Preferences.set({
      key: 'widget_today_lessons',
      value: JSON.stringify(todaysLessons)
    });
  } catch (e) {
    console.warn('Sync Today Lessons failed', e);
  }
};

/**
 * 3. Sync Active Live Lesson state ('widget_active_session')
 */
export const syncActiveSessionToWidget = async (activeSession: {
  id: string;
  groupName: string;
  startTime: number;
  attendanceCount: number;
} | null) => {
  try {
    await Preferences.set({
      key: 'widget_active_session',
      value: JSON.stringify(activeSession ? {
        isActive: true,
        ...activeSession
      } : { isActive: false })
    });
  } catch (e) {
    console.warn('Sync Active Session failed', e);
  }
};

/**
 * 4. Sync Overdue Payments ('widget_payments_due')
 */
export const syncPaymentsDueToWidget = async (
  students: Student[],
  groups: Group[] = [],
  lessons: Lesson[] = [],
  payments: PaymentRecord[] = []
) => {
  try {
    const dueCycles = calculateDuePaymentCycles(students, groups, lessons, payments);
    const overdueCount = new Set(dueCycles.map(c => c.studentId).filter(Boolean)).size || dueCycles.length;

    const totalOutstanding = dueCycles.reduce((sum, item) => {
      const existingRec = payments.find(p => p.id === item.existingPaymentRecordId);
      const paid = existingRec ? (existingRec.amountPaid || 0) : 0;
      const discount = existingRec ? (existingRec.discountAmount || 0) : 0;
      const remaining = Math.max(0, item.amountDue - paid - discount);
      return sum + remaining;
    }, 0);

    await Preferences.set({
      key: 'widget_payments_due',
      value: JSON.stringify({
        overdueCount,
        totalOutstanding
      })
    });
  } catch (e) {
    console.warn('Sync Payments Due failed', e);
  }
};

/**
 * 5. Sync To-Do Tasks ('widget_todos')
 */
export const syncTodosToWidget = async (todos: TodoItem[]) => {
  try {
    const items = todos.map(t => ({ id: t.id, text: t.text }));
    await Preferences.set({
      key: 'widget_todos',
      value: JSON.stringify(items)
    });
  } catch (e) {
    console.warn('Sync Todos failed', e);
  }
};

/**
 * 6. Sync Revenue & Monthly Goal ('widget_revenue')
 */
export const syncRevenueToWidget = async (payments: PaymentRecord[], profile?: TeacherProfile) => {
  try {
    const todayRevenue = getTodayRevenue(payments);
    const weeklyRevenue = getWeeklyRevenue(payments);
    const monthlyRevenue = getMonthlyRevenue(payments);

    await Preferences.set({
      key: 'widget_revenue',
      value: JSON.stringify({
        today: todayRevenue,
        week: weeklyRevenue,
        month: monthlyRevenue,
        goal: profile?.monthlyIncomeGoal || 0,
        weeklyGoal: profile?.weeklyIncomeGoal || 0
      })
    });
  } catch (e) {
    console.warn('Sync Revenue failed', e);
  }
};

/**
 * 7. Sync Mini Dashboard stats ('widget_mini_dashboard')
 */
export const syncMiniDashboardToWidget = async (
  lessonsCountToday: number,
  totalStudents: number,
  attendanceRate: number,
  monthlyRev: number,
  overdueCount: number
) => {
  try {
    await Preferences.set({
      key: 'widget_mini_dashboard',
      value: JSON.stringify({
        lessonsToday: lessonsCountToday,
        totalStudents,
        attendanceRate,
        monthlyRev,
        overdueCount
      })
    });
  } catch (e) {
    console.warn('Sync Mini Dashboard failed', e);
  }
};

/**
 * 8. Sync Upcoming Lessons ('widget_upcoming_lessons')
 */
export const syncUpcomingLessonsToWidget = async (lessons: Lesson[], students: Student[]) => {
  try {
    const todayStr = formatLocalDate();
    const upcoming = lessons
      .filter(l => l.date >= todayStr && l.status === 'scheduled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .slice(0, 5)
      .map(l => ({
        id: l.id,
        time: l.time,
        date: l.date,
        title: l.title || l.groupName || l.studentName || 'Lektion',
        studentCount: l.groupId ? students.filter(s => s.groupId === l.groupId).length : 1
      }));

    await Preferences.set({
      key: 'widget_upcoming_lessons',
      value: JSON.stringify(upcoming)
    });
  } catch (e) {
    console.warn('Sync Upcoming Lessons failed', e);
  }
};

/**
 * 9. Sync Contact & Reminders ('widget_contact_reminders')
 */
export const syncContactRemindersToWidget = async (
  lessons: Lesson[],
  students: Student[],
  groups: Group[] = []
) => {
  try {
    const todayStr = formatLocalDate();
    const todayLessons = lessons
      .filter(l => l.date === todayStr)
      .sort((a, b) => a.time.localeCompare(b.time));

    const contactItems: Array<{
      id: string;
      studentId: string;
      studentName: string;
      groupName: string;
      time: string;
      phone: string;
      whatsappUrl: string;
    }> = [];

    todayLessons.forEach(l => {
      const formattedTime = formatTime12h(l.time);
      if (l.studentId) {
        const student = students.find(s => s.id === l.studentId);
        const rawPhone = student?.studentPhone || student?.phone || student?.parentPhone || '';
        const whatsappUrl = rawPhone ? buildWhatsAppUrl(rawPhone, `مرحباً، أذكرك بحصتك اليوم في الساعة ${formattedTime}`) : '';
        contactItems.push({
          id: l.id,
          studentId: l.studentId,
          studentName: student?.name || l.studentName || 'طالب',
          groupName: l.groupName || '',
          time: formattedTime,
          phone: rawPhone,
          whatsappUrl
        });
      } else if (l.groupId) {
        const group = groups.find(g => g.id === l.groupId);
        const groupStudents = students.filter(s => s.groupId === l.groupId);
        if (groupStudents.length > 0) {
          groupStudents.forEach(s => {
            const rawPhone = s.studentPhone || s.phone || s.parentPhone || '';
            const whatsappUrl = rawPhone ? buildWhatsAppUrl(rawPhone, `مرحباً ${s.name}، أذكرك بحصة ${group?.name || 'المجموعة'} اليوم في الساعة ${formattedTime}`) : '';
            contactItems.push({
              id: l.id,
              studentId: s.id,
              studentName: s.name,
              groupName: group?.name || l.groupName || 'مجموعة',
              time: formattedTime,
              phone: rawPhone,
              whatsappUrl
            });
          });
        } else {
          contactItems.push({
            id: l.id,
            studentId: '',
            studentName: group?.name || l.groupName || 'مجموعة',
            groupName: '',
            time: formattedTime,
            phone: '',
            whatsappUrl: ''
          });
        }
      }
    });

    await Preferences.set({
      key: 'widget_contact_reminders',
      value: JSON.stringify(contactItems)
    });
  } catch (e) {
    console.warn('Sync Contact Reminders failed', e);
  }
};

/**
 * 10. Sync Interactive Full Schedule ('widget_all_schedule_lessons')
 */
export const syncInteractiveScheduleToWidget = async (
  lessons: Lesson[],
  groups: Group[] = [],
  students: Student[] = []
) => {
  try {
    const scheduleItems = lessons.map(l => {
      let details = l.notes || l.grade || '';
      if (!details) {
        if (l.groupId) {
          const g = groups.find(grp => grp.id === l.groupId);
          details = g ? `${g.grade || ''} (${g.name})` : (l.groupName || '');
        } else if (l.studentId) {
          const s = students.find(stu => stu.id === l.studentId);
          details = s?.grade || 'حصة خاصة';
        }
      }
      return {
        id: l.id,
        date: l.date,
        time: formatTime12h(l.time),
        rawTime: l.time,
        title: l.title || l.studentName || l.groupName || 'حصة',
        status: l.status,
        details: details.trim()
      };
    });

    await Preferences.set({
      key: 'widget_all_schedule_lessons',
      value: JSON.stringify(scheduleItems)
    });
  } catch (e) {
    console.warn('Sync Interactive Schedule failed', e);
  }
};

/**
 * 11. Sync Installments & Recurring & Due Payments ('widget_finance_details')
 */
export const syncFinanceTrackerToWidget = async (
  students: Student[],
  groups: Group[] = [],
  lessons: Lesson[] = [],
  payments: PaymentRecord[] = [],
  financeInstallments: FinanceInstallment[] = [],
  financeRecurring: FinanceRecurring[] = []
) => {
  try {
    // 1. Due Installments
    const activeInstallments = financeInstallments.filter(i => !i.deleted && i.status !== 'completed');
    const dueInstallmentsCount = activeInstallments.length;
    const dueInstallmentsTotal = activeInstallments.reduce((sum, i) => {
      const remaining = typeof i.remainingAmount === 'number'
        ? i.remainingAmount
        : Math.max(0, (i.originalAmount || 0) - ((i.paidInstallments || 0) * (i.installmentAmount || 0) + (i.downPayment || 0)));
      return sum + remaining;
    }, 0);

    // 2. Due Recurring
    const activeRecurring = financeRecurring.filter(r => !r.deleted && r.isActive !== false);
    const dueRecurringCount = activeRecurring.length;
    const dueRecurringTotal = activeRecurring.reduce((sum, r) => sum + (r.amount || 0), 0);

    // 3. Due Students
    const dueCycles = calculateDuePaymentCycles(students, groups, lessons, payments);
    const dueStudentsCount = new Set(dueCycles.map(c => c.studentId).filter(Boolean)).size || dueCycles.length;
    const dueStudentsTotal = dueCycles.reduce((sum, item) => {
      const existingRec = payments.find(p => p.id === item.existingPaymentRecordId);
      const paid = existingRec ? (existingRec.amountPaid || 0) : 0;
      const discount = existingRec ? (existingRec.discountAmount || 0) : 0;
      const remaining = Math.max(0, item.amountDue - paid - discount);
      return sum + remaining;
    }, 0);

    await Preferences.set({
      key: 'widget_finance_details',
      value: JSON.stringify({
        dueInstallmentsCount,
        dueInstallmentsTotal,
        dueRecurringCount,
        dueRecurringTotal,
        dueStudentsCount,
        dueStudentsTotal
      })
    });
  } catch (e) {
    console.warn('Sync Finance Tracker failed', e);
  }
};

/**
 * Master Sync All Widgets & Trigger Native Android Refresh Broadcast
 */
export const syncAllWidgetsToNative = async (data: {
  lessons: Lesson[];
  students: Student[];
  payments: PaymentRecord[];
  todos: TodoItem[];
  groups?: Group[];
  profile?: TeacherProfile;
  activeSession?: { id: string; groupName: string; startTime: number; attendanceCount: number } | null;
  financeInstallments?: FinanceInstallment[];
  financeRecurring?: FinanceRecurring[];
}) => {
  try {
    const {
      lessons,
      students,
      payments,
      todos,
      groups = [],
      profile,
      activeSession,
      financeInstallments = [],
      financeRecurring = []
    } = data;
    const todayStr = formatLocalDate();
    const todayLessons = lessons.filter(l => l.date === todayStr);

    const monthlyRev = getMonthlyRevenue(payments);
    const attendanceRate = getAttendanceRate(lessons, students);
    const dueCycles = calculateDuePaymentCycles(students, groups, lessons, payments);
    const overdueCount = new Set(dueCycles.map(c => c.studentId).filter(Boolean)).size || dueCycles.length;

    await Promise.all([
      syncTodayLessonsToWidget(lessons),
      syncActiveSessionToWidget(activeSession || null),
      syncPaymentsDueToWidget(students, groups, lessons, payments),
      syncTodosToWidget(todos),
      syncRevenueToWidget(payments, profile),
      syncMiniDashboardToWidget(todayLessons.length, students.length, attendanceRate, monthlyRev, overdueCount),
      syncUpcomingLessonsToWidget(lessons, students),
      syncContactRemindersToWidget(lessons, students, groups),
      syncInteractiveScheduleToWidget(lessons, groups, students),
      syncFinanceTrackerToWidget(students, groups, lessons, payments, financeInstallments, financeRecurring)
    ]);

    // Trigger native Android widget broadcast update
    if (WidgetManager && WidgetManager.updateWidget) {
      await WidgetManager.updateWidget().catch(() => {});
    }
  } catch (error) {
    console.warn('Failed master widget sync:', error);
  }
};
