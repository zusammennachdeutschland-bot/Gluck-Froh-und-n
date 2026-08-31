import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PendingFollowUp } from '../utils/homeworkFollowUpUtils';
import { X, Check, Send, BookOpen, User, Sparkles } from 'lucide-react';
import { buildWhatsAppUrl, formatWhatsAppPhone } from '../utils/phoneUtils';
import confetti from 'canvas-confetti';

interface HomeworkFollowUpModalProps {
  pendingFollowUps: PendingFollowUp[];
  initialGroupId?: string;
  onClose: () => void;
}

export const HomeworkFollowUpModal: React.FC<HomeworkFollowUpModalProps> = ({ pendingFollowUps, initialGroupId, onClose }) => {
  const { students, updateLesson, profile } = useApp();
  const [selectedGroup, setSelectedGroup] = useState<PendingFollowUp | null>(
    initialGroupId ? pendingFollowUps.find(p => p.groupId === initialGroupId) || null : null
  );

  const handleMarkDone = (lessonId: string) => {
    updateLesson(lessonId, { homeworkFollowUpSentAt: new Date().toISOString() });
    setSelectedGroup(null);
    if (pendingFollowUps.length === 1) {
      onClose();
    }
  };

  const handleSendWhatsApp = (parentPhone: string, message: string, lessonId: string) => {
    const formattedPhone = formatWhatsAppPhone(parentPhone);
    const url = buildWhatsAppUrl(formattedPhone, message);
    window.open(url, '_blank');
    
    // Mark as done after opening WhatsApp
    handleMarkDone(lessonId);
    
    try {
      confetti({ particleCount: 50, spread: 60 });
    } catch (e) {}
  };

  if (selectedGroup) {
    const prevLesson = selectedGroup.latestCompletedLesson;
    
    // 1. Resolve Lesson Title / What was taught in the lesson (ما تم شرحه)
    let taughtNotes = prevLesson?.report?.teacherNotes?.trim() || '';
    if (
      taughtNotes === 'Gute Interaktion, Wortschatz wurde erfolgreich wiederholt.' ||
      taughtNotes === 'Spontane Lektion erfolgreich gestartet und durchgeführt.' ||
      taughtNotes === 'Lektion abgesagt' ||
      taughtNotes === 'تم شرح درس اليوم ومراجعته'
    ) {
      taughtNotes = '';
    }

    let arabicTopics = prevLesson?.report?.arabicTopicsExplained?.trim() || '';
    let quickNotes = prevLesson?.quickNotes?.trim() || '';
    let topic = prevLesson?.topic?.trim() || '';
    if (topic === selectedGroup.groupName || topic === prevLesson?.title) {
      topic = '';
    }

    let rawTitle = prevLesson?.title?.trim() || '';
    if (rawTitle === selectedGroup.groupName || rawTitle === 'Kapitel 3: Grammatik Übungen') {
      rawTitle = '';
    }

    // Prioritize what was actually taught
    const lessonTitle = (
      taughtNotes || 
      arabicTopics || 
      quickNotes || 
      topic || 
      rawTitle || 
      'مراجعة وتطبيقات الدرس'
    ).trim();

    // 2. Resolve Homework Text (الواجب المطلوب)
    let hwDesc = prevLesson?.report?.homeworkDescription?.trim() || '';
    let hwTitle = prevLesson?.report?.homeworkTitle?.trim() || '';
    let legacyHw = (prevLesson?.report as any)?.homework;
    let legacyHwStr = typeof legacyHw === 'string' ? legacyHw.trim() : '';
    let arabicHw = prevLesson?.report?.arabicHomeworkRequired?.trim() || '';

    if (hwTitle === 'Kapitel 3: Grammatik Übungen' || hwTitle === selectedGroup.groupName || hwTitle === lessonTitle) {
      hwTitle = '';
    }
    if (hwDesc === 'Seiten 45-48 im Arbeitsbuch fertigstellen.' || hwDesc === lessonTitle) {
      hwDesc = '';
    }
    if (legacyHwStr === 'Kapitel 3: Grammatik Übungen' || legacyHwStr === 'Seiten 45-48 im Arbeitsbuch fertigstellen.' || legacyHwStr === selectedGroup.groupName) {
      legacyHwStr = '';
    }

    const resolvedHomework = (hwDesc || arabicHw || legacyHwStr || hwTitle || '').trim();
    const homeworkText = resolvedHomework || 'متابعة ما تم شرحه وحل التدريبات والأنشطة المقررة';

    const teacherSign = profile.displayNameAr || (profile.displayName ? `أ/ ${profile.displayName}` : '');

    const groupStudents = students.filter(s => s.groupId === selectedGroup.groupId);
    
    // Group students by parent phone
    const byPhone: Record<string, string[]> = {};
    groupStudents.forEach(s => {
      const phone = (s.parentPhone || s.studentPhone)?.trim();
      if (phone) {
        if (!byPhone[phone]) byPhone[phone] = [];
        byPhone[phone].push(s.name);
      }
    });

    const messages = Object.entries(byPhone).map(([phone, names]) => {
      const isMultiple = names.length > 1;
      let message = `السلام عليكم ورحمة الله وبركاته،\n\n`;
      if (isMultiple) {
        message += `تذكير بمتابعة واجب الطلاب:\n`;
        names.forEach(name => {
          message += `• ${name}\n`;
        });
      } else {
        message += `تذكير بمتابعة واجب الطالب/ـة: *${names[0]}*\n`;
      }
      
      message += `\n📖 *عنوان الدرس:* ${lessonTitle}\n📝 *الواجب:* ${homeworkText}\n\nبرجاء التأكد من حل الواجب قبل موعد الحصة القادمة.\nشكراً لحضراتكم.`;
      
      if (teacherSign) {
        message += `\n\nمع تحيات: *${teacherSign}*`;
      }
      return { phone, message, names };
    });

    return (
      <div 
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0 font-sans"
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]"
        >
          <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
          
          <div className="p-5 flex items-center justify-between border-b border-surface-border sticky top-0 bg-surface z-10">
            <div>
              <button 
                onClick={() => setSelectedGroup(null)}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center hover:underline"
              >
                ← عودة للقائمة
              </button>
              <h2 className="text-xl font-black text-text-main flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                {selectedGroup.groupName}
              </h2>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-text-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-6">
            {/* Homework division card identical to in-lesson structure */}
            <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  بيانات الواجب المطلوب (الدرس والواجب)
                </h3>
              </div>
              
              <div className="space-y-2 text-xs bg-white/70 dark:bg-slate-900/60 p-3 rounded-lg border border-amber-100 dark:border-amber-900/40">
                <div className="flex items-start gap-2">
                  <span className="font-black text-amber-950 dark:text-amber-200 shrink-0">📖 عنوان الدرس:</span>
                  <span className="font-bold text-text-main">{lessonTitle}</span>
                </div>
                <div className="flex items-start gap-2 pt-1 border-t border-amber-100/60 dark:border-slate-800">
                  <span className="font-black text-amber-950 dark:text-amber-200 shrink-0">📝 الواجب:</span>
                  <span className="font-medium text-text-main whitespace-pre-wrap">{homeworkText}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black text-text-main">رسائل المتابعة لأولياء الأمور</h3>
              
              {messages.length === 0 ? (
                <p className="text-sm text-text-muted">لا توجد أرقام هواتف مسجلة للطلاب أو أولياء الأمور في هذه المجموعة.</p>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className="border border-surface-border rounded-xl p-4 space-y-3 bg-surface">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      <User className="w-4 h-4" />
                      {m.names.join(' و ')}
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg text-xs text-text-main whitespace-pre-wrap border border-slate-200 dark:border-slate-800 font-medium leading-relaxed">
                      {m.message}
                    </div>

                    <button
                      onClick={() => handleSendWhatsApp(m.phone, m.message, selectedGroup.latestCompletedLesson.id)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                    >
                      <Send className="w-4 h-4" />
                      إرسال عبر WhatsApp
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-surface-border">
            <button
              onClick={() => handleMarkDone(selectedGroup.latestCompletedLesson.id)}
              className="w-full bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-sm py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-600" />
              تحديد كمكتمل يدوياً (Mark Done)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0 font-sans"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[80vh]"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        <div className="p-5 flex items-center justify-between border-b border-surface-border sticky top-0 bg-surface z-10">
          <h2 className="text-xl font-black text-text-main flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-500" />
            متابعة الواجبات (Homework Follow-Up)
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-text-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 overflow-y-auto">
          {pendingFollowUps.map(p => (
            <div 
              key={p.groupId}
              onClick={() => setSelectedGroup(p)}
              className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-surface-border last:border-0 transition-colors"
            >
              <span className="font-bold text-base text-text-main">{p.groupName}</span>
              <span className="text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-1 rounded-md">
                {p.isToday ? 'اليوم' : p.isTomorrow ? 'غداً' : p.nextLessonDateStr}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

