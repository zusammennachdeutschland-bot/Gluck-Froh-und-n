import React, { useState } from 'react';
import { PortalLessonItem } from '../types';
import { Calendar, Clock, Video, CheckCircle2, AlertCircle, XCircle, FileText, Sparkles, BookOpen, ExternalLink } from 'lucide-react';

interface LessonsTabProps {
  lessons: PortalLessonItem[];
}

export const LessonsTab: React.FC<LessonsTabProps> = ({ lessons }) => {
  const [filter, setFilter] = useState<'all' | 'recordings'>('all');

  const filteredLessons = filter === 'recordings'
    ? lessons.filter(l => l.recordingLink || l.recordingLink2)
    : lessons;

  if (!lessons || lessons.length === 0) {
    return (
      <div className="bg-surface border border-surface-border rounded-3xl p-8 text-center text-text-muted">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-500" />
        <h3 className="font-bold text-base text-text-main">لا توجد حصص مسجلة حتى الآن</h3>
        <p className="text-xs pt-1">سيتم إضافة تقارير الحصص تلقائياً بعد كل درس.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filter Bar */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black text-base text-text-main flex items-center gap-2">
          <span>سجل الحصص السابقة والمتابعة</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            {lessons.length} حصة
          </span>
        </h3>

        <div className="flex gap-1 bg-surface p-1 rounded-xl border border-surface-border">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setFilter('recordings')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              filter === 'recordings'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>المسجلة فقط</span>
          </button>
        </div>
      </div>

      {/* Lessons List */}
      <div className="space-y-3.5">
        {filteredLessons.map((lesson) => {
          const isPresent = lesson.attendanceStatus === 'present';
          const isLate = lesson.attendanceStatus === 'late';

          return (
            <div
              key={lesson.id}
              className="bg-surface border border-surface-border hover:border-blue-500/30 rounded-2xl p-4 sm:p-5 transition-all shadow-xs space-y-3"
            >
              {/* Header: Date, Time & Attendance */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold text-text-main">
                  <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-xl border border-surface-border">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    <span>{lesson.dayOfWeek} ({lesson.date})</span>
                  </div>

                  <div className="flex items-center gap-1 text-text-muted">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{lesson.time}</span>
                  </div>

                  {lesson.sessionNumber && (
                    <span className="text-[11px] font-semibold text-text-muted bg-surface-border/50 px-2 py-0.5 rounded-lg">
                      حصة {lesson.sessionNumber} {lesson.totalCycleSessions ? `من ${lesson.totalCycleSessions}` : ''}
                    </span>
                  )}
                </div>

                {/* Attendance Badge */}
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

              {/* Topic */}
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-text-main">
                  {lesson.topic}
                </h4>
              </div>

              {/* Evaluation Quick Badges */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {lesson.homeworkDone && (
                  <span className={`px-2.5 py-1 rounded-xl font-bold border ${
                    lesson.homeworkDone === 'yes'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  }`}>
                    {lesson.homeworkDone === 'yes' ? 'الواجب: تم الحل بالكامل 👍' : 'الواجب: لم يتم الحل 👎'}
                  </span>
                )}

                {lesson.dictationGrade !== undefined && (
                  <span className="px-2.5 py-1 rounded-xl font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    الإملاء: {lesson.dictationGrade} / 10
                  </span>
                )}

                {lesson.examGrade !== undefined && (
                  <span className="px-2.5 py-1 rounded-xl font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    الكويز: {lesson.examGrade} / 10
                  </span>
                )}
              </div>

              {/* Teacher Egyptian Feedback Box */}
              {lesson.teacherFeedback && (
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ملاحظات وتقييم المعلم للحصة:</span>
                  </div>
                  <p className="text-text-main leading-relaxed">
                    {lesson.teacherFeedback}
                  </p>
                </div>
              )}

              {/* Homework Required Box */}
              {lesson.homeworkRequired && (
                <div className="bg-background border border-surface-border rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-text-muted">
                    <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                    <span>الواجب المطلوب للحصة التالية:</span>
                  </div>
                  <p className="text-text-main font-medium">
                    {lesson.homeworkRequired}
                  </p>
                </div>
              )}

              {/* Lesson Recordings Buttons */}
              {(lesson.recordingLink || lesson.recordingLink2) && (
                <div className="pt-1 flex items-center gap-2 flex-wrap">
                  {lesson.recordingLink && (
                    <a
                      href={lesson.recordingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>مشاهدة تسجيل الحصة (الجزء الأول)</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                  )}

                  {lesson.recordingLink2 && (
                    <a
                      href={lesson.recordingLink2}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>مشاهدة تسجيل الحصة (الجزء الثاني)</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
