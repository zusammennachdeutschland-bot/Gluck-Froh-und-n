import { Lesson, Group } from '../types';
import { parseLocalDate } from './timeUtils';

export interface PendingFollowUp {
  groupId: string;
  groupName: string;
  latestCompletedLesson: Lesson;
  nextLessonDateStr: string;
  nextLessonTimeStr: string;
  isToday: boolean;
  isTomorrow: boolean;
}

export function getPendingHomeworkFollowUps(lessons: Lesson[], groups: Group[]): PendingFollowUp[] {
  const pending: PendingFollowUp[] = [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const group of groups) {
    const groupLessons = lessons.filter(l => l.groupId === group.id);
    
    // 1. Find the latest completed lesson
    const completedLessons = groupLessons
      .filter(l => l.status === 'completed')
      .sort((a, b) => {
        const strA = `${a.date}T${a.time || '00:00'}`;
        const strB = `${b.date}T${b.time || '00:00'}`;
        return strB.localeCompare(strA);
      });

    if (completedLessons.length === 0) continue;
    
    const latestCompleted = completedLessons[0];

    // If follow-up was already sent or marked done, skip
    if (latestCompleted.homeworkFollowUpSentAt) continue;

    // We can also ensure there is homework, but user said "Treat every completed lesson as eligible"
    // Though it makes sense to only follow up if there is *some* text? 
    // Wait, the user specifically said: "Since every lesson in this application already contains homework: DO NOT check: lesson.hasHomework. Treat every completed lesson as eligible for follow-up."
    // So we don't check for homework text.

    // 2. Find the next scheduled lesson
    const upcomingLessons = groupLessons
      .filter(l => l.status !== 'completed' && l.status !== 'cancelled')
      .filter(l => {
         const lDate = parseLocalDate(l.date);
         return lDate >= todayStart;
      })
      .sort((a, b) => {
        const strA = `${a.date}T${a.time || '00:00'}`;
        const strB = `${b.date}T${b.time || '00:00'}`;
        return strA.localeCompare(strB);
      });

    if (upcomingLessons.length === 0) continue;

    const nextLesson = upcomingLessons[0];
    const nextLessonDate = parseLocalDate(nextLesson.date);

    // The follow-up becomes visible: Wednesday 12:00 AM (if next lesson is Thursday).
    const visibilityStart = new Date(nextLessonDate);
    visibilityStart.setDate(visibilityStart.getDate() - 1);
    visibilityStart.setHours(0, 0, 0, 0);

    // Stop being visible when the next lesson starts
    const [h, m] = (nextLesson.time || '00:00').split(':').map(Number);
    const lessonStart = new Date(nextLessonDate);
    lessonStart.setHours(h, m, 0, 0);

    if (now >= visibilityStart && now < lessonStart) {
      const diffTime = nextLessonDate.getTime() - todayStart.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      pending.push({
        groupId: group.id,
        groupName: group.name,
        latestCompletedLesson: latestCompleted,
        nextLessonDateStr: nextLesson.date,
        nextLessonTimeStr: nextLesson.time,
        isToday: diffDays === 0,
        isTomorrow: diffDays === 1,
      });
    }
  }

  return pending;
}
