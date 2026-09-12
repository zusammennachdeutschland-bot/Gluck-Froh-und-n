import React from 'react';
import { PortalGradeItem } from '../types';
import { Award, BookOpen, CheckCircle2, TrendingUp, Sparkles, FileCheck } from 'lucide-react';

interface HomeworkGradesTabProps {
  quizzes: PortalGradeItem[];
  homeworkRate?: number;
}

export const HomeworkGradesTab: React.FC<HomeworkGradesTabProps> = ({
  quizzes,
  homeworkRate = 100
}) => {
  const dictations = quizzes.filter(q => q.type === 'dictation');
  const regularQuizzes = quizzes.filter(q => q.type === 'quiz');
  const monthlyExams = quizzes.filter(q => q.type === 'monthly_exam');

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface border border-surface-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-muted font-bold">الالتزام بالواجبات</div>
            <div className="text-lg font-black text-text-main">{homeworkRate}%</div>
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-muted font-bold">عدد الاختبارات والكويزات</div>
            <div className="text-lg font-black text-text-main">{quizzes.length} اختبار</div>
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-text-muted font-bold">التقييم العام</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">ممتاز جداً 🌟</div>
          </div>
        </div>
      </div>

      {/* Quizzes & Exams List */}
      <div className="space-y-3">
        <h3 className="font-black text-base text-text-main flex items-center gap-2">
          <span>سجل درجات الكويزات والإملاء</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            {quizzes.length} تقييم
          </span>
        </h3>

        <div className="space-y-3">
          {quizzes.map((quiz) => {
            const isDictation = quiz.type === 'dictation';
            const isExam = quiz.type === 'monthly_exam';

            return (
              <div
                key={quiz.id}
                className="bg-surface border border-surface-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        isDictation
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : isExam
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      }`}>
                        {isDictation ? '✍️ إملاء كلمات' : isExam ? '🏆 امتحان شهري' : '🎯 كويز قصير'}
                      </span>
                      <span className="text-xs text-text-muted font-medium">{quiz.date}</span>
                    </div>

                    <h4 className="font-extrabold text-sm sm:text-base text-text-main pt-1">
                      {quiz.title}
                    </h4>
                  </div>

                  {/* Score Pill */}
                  <div className="flex items-baseline gap-1 bg-background px-3.5 py-1.5 rounded-xl border border-surface-border">
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                      {quiz.score}
                    </span>
                    <span className="text-xs text-text-muted font-bold">
                      / {quiz.maxScore}
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-black mr-1">
                      ({quiz.percentage}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-background rounded-full h-2.5 overflow-hidden border border-surface-border">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      quiz.percentage >= 90
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : quiz.percentage >= 75
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500'
                    }`}
                    style={{ width: `${Math.min(quiz.percentage, 100)}%` }}
                  />
                </div>

                {/* Feedback Note */}
                {quiz.feedback && (
                  <div className="text-xs text-text-muted flex items-center gap-1.5 pt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>ملاحظة: <strong className="text-text-main font-semibold">{quiz.feedback}</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
