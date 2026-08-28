import { BuddyMood, BuddyBriefMode, BuddyWorkloadResult } from '../../types/buddy';
import { formatLocalDate } from '../../utils/timeUtils';

export function analyzeBuddyWorkload(
  lessons: any[] = [],
  students: any[] = [],
  payments: any[] = [],
  todos: any[] = [],
  notifications: any[] = [],
  language: 'ar' | 'en' | 'de' = 'de'
): BuddyWorkloadResult {
  const todayStr = formatLocalDate(new Date());
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  // Filter lessons for today
  const todaysLessons = lessons.filter(l => l.date === todayStr && !l.deleted);

  let completedLessonsToday = 0;
  let remainingLessonsToday = 0;
  let activeLesson: any = null;
  let nextLesson: any = null;

  todaysLessons.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  for (const l of todaysLessons) {
    if (l.status === 'completed') {
      completedLessonsToday++;
    } else {
      // check time if not marked completed
      if (l.startTime && l.endTime) {
        const [startH, startM] = l.startTime.split(':').map(Number);
        const [endH, endM] = l.endTime.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;

        if (currentTimeMinutes >= startMin && currentTimeMinutes <= endMin) {
          activeLesson = l;
        } else if (currentTimeMinutes < startMin) {
          if (!nextLesson) nextLesson = l;
          remainingLessonsToday++;
        } else {
          // past end time but not completed
          remainingLessonsToday++;
          if (!nextLesson && currentTimeMinutes < startMin + 60) {
            nextLesson = l;
          }
        }
      } else {
        remainingLessonsToday++;
        if (!nextLesson) nextLesson = l;
      }
    }
  }

  // If there's an active lesson, active lesson status overrides nextLesson
  const totalLessonsToday = todaysLessons.length;

  // Students count today (unique students in today's lessons or groups)
  const todayGroupIds = new Set(todaysLessons.map(l => l.groupId).filter(Boolean));
  const todayStudentsSet = new Set<string>();
  students.forEach(s => {
    if (s.groupId && todayGroupIds.has(s.groupId) && !s.deleted) {
      todayStudentsSet.add(s.id);
    }
  });
  const studentsTodayCount = Math.max(todayStudentsSet.size, totalLessonsToday * 3); // realistic estimate if groups aren't strictly linked

  // Attendance & absent students
  let absentStudentsCount = 0;
  todaysLessons.forEach(l => {
    if (l.attendance && typeof l.attendance === 'object') {
      Object.values(l.attendance).forEach((status: any) => {
        if (status === 'absent') absentStudentsCount++;
      });
    }
  });

  // Pending homework
  let pendingHomeworkCount = 0;
  todaysLessons.forEach(l => {
    if (l.homework && typeof l.homework === 'object') {
      Object.values(l.homework).forEach((hwStatus: any) => {
        if (hwStatus === 'assigned' || hwStatus === 'not_completed') {
          pendingHomeworkCount++;
        }
      });
    }
  });

  // Payments / Income
  const todayPayments = payments.filter(p => p.date === todayStr && !p.deleted);
  const expectedIncomeToday = todayPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const completedIncomeToday = todayPayments.filter(p => p.status === 'paid').reduce((acc, p) => acc + (Number(p.paidAmount) || Number(p.amount) || 0), 0);
  const overduePaymentsCount = payments.filter(p => p.status === 'pending' && p.date && p.date < todayStr && !p.deleted).length;

  // Tasks / Todos
  const pendingTodos = todos.filter(t => !t.completed && !t.deleted);
  const pendingTasksCount = pendingTodos.length;
  const urgentTasksCount = pendingTodos.filter(t => t.priority === 'high' || t.urgent).length;

  // Notifications
  const unreadNotificationsCount = notifications.filter(n => !n.read && !n.dismissed).length;

  // Calculate Workload Score (0-100)
  let score = 15; // base
  score += totalLessonsToday * 12;
  score += (totalLessonsToday - completedLessonsToday) * 5;
  score += overduePaymentsCount * 8;
  score += urgentTasksCount * 6;
  score += Math.min(pendingTasksCount * 2, 20);
  if (activeLesson) score += 10;
  score = Math.min(Math.max(score, 5), 100);

  // Determine Brief Mode and Mood
  let briefMode: BuddyBriefMode = 'day';
  if (currentHour < 11) {
    briefMode = 'morning';
  } else if (currentHour >= 19 || (completedLessonsToday > 0 && completedLessonsToday === totalLessonsToday && totalLessonsToday > 0)) {
    briefMode = 'evening';
  }

  let mood: BuddyMood = 'normal';

  if (currentHour < 7 || currentHour >= 22) {
    mood = 'sleeping';
  } else if (briefMode === 'morning' && currentHour < 9) {
    mood = 'morning';
  } else if (completedLessonsToday > 0 && completedLessonsToday === totalLessonsToday) {
    mood = 'finished';
  } else if (score >= 80 || (remainingLessonsToday >= 5 && overduePaymentsCount > 2)) {
    mood = 'chaos';
  } else if (score >= 60) {
    mood = 'busy';
  } else if (activeLesson || score >= 40) {
    mood = 'working';
  } else if (totalLessonsToday === 0 || score <= 25) {
    mood = 'relaxed';
  } else {
    mood = 'normal';
  }

  // Greetings & Story Generation
  const greetings = {
    de: {
      morning: 'Guten Morgen! ☀️ Bereit für den Tag?',
      relaxed: 'Ruhiger Tag heute. Genieße die Pause ☕',
      normal: 'Alles im grünen Bereich. Los geht\'s!',
      working: activeLesson ? `Laufende Stunde: ${activeLesson.groupName || 'Aktiv'} 🎓` : 'Konzentriert bei der Arbeit.',
      busy: 'Ziemlich viel los heute! Schritt für Schritt.',
      chaos: 'Volles Programm! Wir behalten den Überblick ⚡',
      finished: 'Geschafft! Alles Wichtige erledigt 🌟',
      sleeping: 'Zeit zum Ausruhen. Bis morgen!'
    },
    en: {
      morning: 'Good morning! ☀️ Ready for the day?',
      relaxed: 'Nice and steady. Enjoy the breathing room ☕',
      normal: 'Everything is running smoothly. Let\'s go!',
      working: activeLesson ? `Active lesson: ${activeLesson.groupName || 'Active'} 🎓` : 'Focused on work.',
      busy: 'Quite a busy schedule today! One step at a time.',
      chaos: 'Heavy workload! We\'ve got this ⚡',
      finished: 'All done for today! Time to relax 🌟',
      sleeping: 'Rest time. See you tomorrow!'
    },
    ar: {
      morning: 'صباح الخير! ☀️ هل أنت مستعد ليومك؟',
      relaxed: 'يوم هادئ ومريح اليوم ☕',
      normal: 'الأمور تسير بشكل ممتاز. هيا بنا!',
      working: activeLesson ? `حصة جارية: ${activeLesson.groupName || 'نشطة'} 🎓` : 'تركيز على العمل الحالي.',
      busy: 'جدول مزدحم اليوم! خطوة بخطوة.',
      chaos: 'ضغط عمل كبير! نسيطر على الأمور ⚡',
      finished: 'تم إنجاز مهام اليوم بنجاح! وقت الاسترخاء 🌟',
      sleeping: 'وقت الراحة. نراكم غداً!'
    }
  };

  const currentLang = (['de', 'en', 'ar'].includes(language) ? language : 'de') as 'de' | 'en' | 'ar';
  const greetingText = greetings[currentLang][mood] || greetings.de[mood];

  const headlines = {
    de: {
      morning: `${totalLessonsToday} Stunden heute geplant`,
      relaxed: 'Entspannter Rhythmus',
      normal: `${completedLessonsToday}/${totalLessonsToday} Stunden absolviert`,
      working: nextLesson ? `Nächste: ${nextLesson.startTime} — ${nextLesson.groupName || 'Gruppe'}` : 'Unterricht läuft',
      busy: `${remainingLessonsToday} verbleibende Stunden`,
      chaos: 'Hohe Dichte & Aufgaben',
      finished: 'Tagesziel erreicht! 🏆',
      sleeping: 'Nachtruhe'
    },
    en: {
      morning: `${totalLessonsToday} lessons scheduled today`,
      relaxed: 'Relaxed schedule',
      normal: `${completedLessonsToday}/${totalLessonsToday} lessons completed`,
      working: nextLesson ? `Next: ${nextLesson.startTime} — ${nextLesson.groupName || 'Group'}` : 'Lesson in progress',
      busy: `${remainingLessonsToday} lessons remaining`,
      chaos: 'High workload & pending tasks',
      finished: 'Daily goal achieved! 🏆',
      sleeping: 'Night rest'
    },
    ar: {
      morning: `${totalLessonsToday} حصص مجدولة اليوم`,
      relaxed: 'جدول هادئ ومريح',
      normal: `أنجزت ${completedLessonsToday} من ${totalLessonsToday} حصة`,
      working: nextLesson ? `التالية: ${nextLesson.startTime} — ${nextLesson.groupName || 'مجموعة'}` : 'الحصة جارٍ تنفيذها',
      busy: `تبقي ${remainingLessonsToday} حصص`,
      chaos: 'ضغط عمل ومهام معلقة',
      finished: 'تم إنجاز أهداف اليوم! 🏆',
      sleeping: 'وقت النوم'
    }
  };

  const statusHeadline = headlines[currentLang][mood] || headlines.de[mood];

  // Story text generation
  let todayStoryText = '';
  if (currentLang === 'de') {
    if (totalLessonsToday === 0) {
      todayStoryText = 'Heute sind keine Unterrichtsstunden eingetragen. Perfekt für Vorbereitung, Korrekturen oder eine wohlverdiente Pause.';
    } else {
      todayStoryText = `Heute startest du mit ${totalLessonsToday} Unterrichtsstunden. Bisher wurden ${completedLessonsToday} abgeschlossen. ${pendingTasksCount > 0 ? `Es warten noch ${pendingTasksCount} Aufgaben.` : 'Alle Aufgaben sind im grünen Bereich.'}`;
    }
  } else if (currentLang === 'en') {
    if (totalLessonsToday === 0) {
      todayStoryText = 'No lessons scheduled for today. Perfect for lesson prep, grading, or a well-deserved break.';
    } else {
      todayStoryText = `You started with ${totalLessonsToday} lessons today. ${completedLessonsToday} completed so far. ${pendingTasksCount > 0 ? `${pendingTasksCount} tasks still pending.` : 'All tasks are cleared.'}`;
    }
  } else {
    if (totalLessonsToday === 0) {
      todayStoryText = 'لا توجد حصص مسجلة اليوم. وقت مثالي لتحضير الدروس، التصحيح، أو استراحة مستحقة.';
    } else {
      todayStoryText = `بدأت يومك بـ ${totalLessonsToday} حصة دراسية. تم إنجاز ${completedLessonsToday} حتى الآن. ${pendingTasksCount > 0 ? `توجد ${pendingTasksCount} مهام بانتظار الإنجاز.` : 'جميع المهام مكتملة.'}`;
    }
  }

  return {
    score,
    mood,
    briefMode,
    totalLessonsToday,
    completedLessonsToday,
    remainingLessonsToday,
    activeLesson,
    nextLesson,
    studentsTodayCount,
    absentStudentsCount,
    pendingHomeworkCount,
    overduePaymentsCount,
    expectedIncomeToday,
    completedIncomeToday,
    pendingTasksCount,
    urgentTasksCount,
    unreadNotificationsCount,
    todayStoryText,
    greetingText,
    statusHeadline
  };
}
