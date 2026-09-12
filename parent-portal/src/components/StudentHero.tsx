import React from 'react';
import { StudentPortalData } from '../types';
import { Award, CheckCircle2, BookOpen, GraduationCap, Flame, Star, Sparkles } from 'lucide-react';

interface StudentHeroProps {
  student: StudentPortalData;
}

export const StudentHero: React.FC<StudentHeroProps> = ({ student }) => {
  const isFemale = student.gender === 'female';
  const stats = student.stats || {
    totalSessions: 0,
    attendedSessions: 0,
    attendanceRate: 100,
    homeworkRate: 100,
    averageQuizGrade: 10,
    averageDictationGrade: 10,
    totalCertificates: 0,
  };

  return (
    <div className="bg-surface border border-surface-border rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
        {/* Student Info Card */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-md border-2 border-white dark:border-slate-800">
              {student.name.charAt(0)}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow-xs border-2 border-surface" title="طالب متميز">
              <Star className="w-3.5 h-3.5 fill-white" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-text-main tracking-tight">
                {student.name}
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {isFemale ? 'طالبة متميزة 🌸' : 'طالب متميز 🌟'}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-text-muted font-medium flex items-center gap-1.5 flex-wrap">
              <GraduationCap className="w-4 h-4 text-blue-500" />
              <span>{student.gradeLevel || 'اللغة الألمانية'}</span>
              {student.groupName && (
                <>
                  <span className="text-surface-border">•</span>
                  <span>{student.groupName}</span>
                </>
              )}
            </p>

            <div className="flex items-center gap-2 pt-0.5 text-[11px] text-text-muted">
              <span>كود الطالب: <strong className="font-mono text-text-main">{student.studentCode}</strong></span>
              {student.teacherName && (
                <>
                  <span>•</span>
                  <span>المعلم: <strong className="text-text-main">{student.teacherName}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Rate Metrics Grid */}
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
  );
};
