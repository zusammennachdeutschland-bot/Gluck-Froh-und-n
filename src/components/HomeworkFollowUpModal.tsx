import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PendingFollowUp } from '../utils/homeworkFollowUpUtils';
import { X, Check, Send, BookOpen, User, Sparkles, AtSign, Phone } from 'lucide-react';
import { buildWhatsAppUrl, resolveStudentWhatsAppContact, isWhatsAppUsername, cleanWhatsAppUsername } from '../utils/phoneUtils';
import { getStudentRoleLabel, isLikelyFemaleStudent } from '../utils/genderUtils';
import confetti from 'canvas-confetti';
import { ReportLanguageToggle } from './ReportLanguageToggle';

interface HomeworkFollowUpModalProps {
  pendingFollowUps: PendingFollowUp[];
  initialGroupId?: string;
  onClose: () => void;
}

export const HomeworkFollowUpModal: React.FC<HomeworkFollowUpModalProps> = ({ pendingFollowUps, initialGroupId, onClose }) => {
  const { students, updateLesson, profile, _t, reportLanguage } = useApp();
  const currentMsgLang = reportLanguage || 'ar';
  const [selectedGroup, setSelectedGroup] = useState<PendingFollowUp | null>(
    initialGroupId ? pendingFollowUps.find(p => p.groupId === initialGroupId) || null : null
  );
  const [followUpStyle, setFollowUpStyle] = useState<'egyptian' | 'standard'>('egyptian');

  const handleMarkDone = (lessonId: string) => {
    updateLesson(lessonId, { homeworkFollowUpSentAt: new Date().toISOString() });
    setSelectedGroup(null);
    if (pendingFollowUps.length === 1) {
      onClose();
    }
  };

  const handleSendWhatsApp = (contact: string, message: string, lessonId: string) => {
    const url = buildWhatsAppUrl(contact, message);
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
      _t('مراجعة وتطبيقات الدرس', 'Lesson Review & Practice', 'Lektionswiederholung')
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
    const homeworkText = resolvedHomework || _t('متابعة ما تم شرحه وحل التدريبات والأنشطة المقررة', 'Follow up on lesson and complete assigned exercises', 'Lektion nacharbeiten und Hausaufgaben erledigen');

    const teacherSign = profile.displayNameAr || (profile.displayName ? `أ/ ${profile.displayName}` : '');

    const groupStudents = students.filter(s => s.groupId === selectedGroup.groupId);
    
    // Group students by parent contact (phone or username)
    const byContact: Record<string, { names: string[]; isUsername: boolean; display: string }> = {};
    groupStudents.forEach(s => {
      const resolved = resolveStudentWhatsAppContact(s);
      if (resolved.hasContact) {
        const key = resolved.contact;
        if (!byContact[key]) {
          byContact[key] = {
            names: [],
            isUsername: resolved.isUsername,
            display: resolved.display
          };
        }
        byContact[key].names.push(s.name);
      }
    });

    const messages = Object.entries(byContact).map(([contact, { names, isUsername, display }]) => {
      const isMultiple = names.length > 1;
      let message = '';
      
      if (currentMsgLang === 'en') {
        message += `Hello,\n\n`;
        if (isMultiple) {
          message += `Reminder to follow up on homework for:\n`;
          names.forEach(name => {
            message += `• ${name}\n`;
          });
        } else {
          message += `Reminder to follow up on homework for: *${names[0]}*\n`;
        }
        message += `\n📖 *Lesson Topic:* ${lessonTitle}\n📝 *Required Homework:* ${homeworkText}\n\nPlease ensure the homework is completed before the next lesson.\nThank you! 🌸`;
        if (teacherSign) {
          message += `\n\nBest regards,\n*${profile.displayName || teacherSign}*`;
        }
      } else if (currentMsgLang === 'de') {
        message += `Guten Tag,\n\n`;
        if (isMultiple) {
          message += `Erinnerung an die Hausaufgaben für:\n`;
          names.forEach(name => {
            message += `• ${name}\n`;
          });
        } else {
          message += `Erinnerung an die Hausaufgabe von: *${names[0]}*\n`;
        }
        message += `\n📖 *Thema der Lektion:* ${lessonTitle}\n📝 *Hausaufgabe:* ${homeworkText}\n\nBitte stellen Sie sicher, dass die Hausaufgabe vor der nächsten Stunde erledigt wird.\nVielen Dank! 🌸`;
        if (teacherSign) {
          message += `\n\nMit freundlichen Grüßen,\n*${profile.displayName || teacherSign}*`;
        }
      } else {
        if (followUpStyle === 'egyptian') {
          message += `أهلاً بحضرتك يا فندم 👋\n\n`;
          if (isMultiple) {
            const targetStudents = groupStudents.filter(s => names.includes(s.name));
            const allFemale = targetStudents.length > 0 && targetStudents.every(s => (s.gender === 'female' || (!s.gender && isLikelyFemaleStudent(s.name))));
            message += allFemale ? `تذكير بمتابعة واجب الطالبات:\n` : `تذكير بمتابعة واجب الطلاب:\n`;
            names.forEach(name => {
              message += `• ${name}\n`;
            });
          } else {
            const singleStudent = groupStudents.find(s => s.name === names[0]);
            const role = singleStudent ? getStudentRoleLabel(singleStudent) : 'الطالب';
            message += `تذكير بمتابعة واجب ${role}: *${names[0]}* 🇩🇪\n`;
          }
          message += `\n📖 *اللي اتشرح في الحصة:* ${lessonTitle}\n📝 *الواجب المطلوب:* ${homeworkText}\n\nبرجاء التأكد من حل الواجب قبل موعد الحصة القادمة إن شاء الله.\nشكراً لمتابعة واهتمام حضرتك 🌸`;
        } else {
          message += `السلام عليكم ورحمة الله وبركاته،\n\n`;
          if (isMultiple) {
            const targetStudents = groupStudents.filter(s => names.includes(s.name));
            const allFemale = targetStudents.length > 0 && targetStudents.every(s => (s.gender === 'female' || (!s.gender && isLikelyFemaleStudent(s.name))));
            message += allFemale ? `تذكير بمتابعة واجب الطالبات:\n` : `تذكير بمتابعة واجب الطلاب:\n`;
            names.forEach(name => {
              message += `• ${name}\n`;
            });
          } else {
            const singleStudent = groupStudents.find(s => s.name === names[0]);
            const role = singleStudent ? getStudentRoleLabel(singleStudent) : 'الطالب';
            message += `تذكير بمتابعة واجب ${role}: *${names[0]}*\n`;
          }
          message += `\n📖 *عنوان الدرس:* ${lessonTitle}\n📝 *الواجب:* ${homeworkText}\n\nبرجاء التأكد من حل الواجب قبل موعد الحصة القادمة.\nشكراً لحضراتكم.`;
        }

        if (teacherSign) {
          message += `\n\nمع تحيات: *${teacherSign}*`;
        }
      }
      return { contact, isUsername, display, message, names };
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
          <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />
          
          <div className="px-3.5 py-2.5 sm:p-4 flex items-center justify-between border-b border-surface-border sticky top-0 bg-surface z-10 shrink-0">
            <div className="min-w-0">
              <button 
                onClick={() => setSelectedGroup(null)}
                className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-0.5 flex items-center hover:underline"
              >
                {_t('← عودة للقائمة', '← Back to list', '← Zurück zur Liste')}
              </button>
              <h2 className="text-xs sm:text-base font-black text-text-main flex items-center gap-1.5 truncate">
                <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">{selectedGroup.groupName}</span>
              </h2>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <ReportLanguageToggle showLabel={false} />
              <button onClick={onClose} className="p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-text-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4">
            {/* Homework division card identical to in-lesson structure */}
            <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  {_t('بيانات الواجب المطلوب (الدرس والواجب)', 'Homework & Lesson Info', 'Hausaufgabe & Lektionsinfo')}
                </h3>
              </div>
              
              <div className="space-y-2 text-xs bg-white/70 dark:bg-slate-900/60 p-3 rounded-lg border border-amber-100 dark:border-amber-900/40">
                <div className="flex items-start gap-2">
                  <span className="font-black text-amber-950 dark:text-amber-200 shrink-0">{_t('📖 عنوان الدرس:', '📖 Lesson Topic:', '📖 Lektionsthema:')}</span>
                  <span className="font-bold text-text-main">{lessonTitle}</span>
                </div>
                <div className="flex items-start gap-2 pt-1 border-t border-amber-100/60 dark:border-slate-800">
                  <span className="font-black text-amber-950 dark:text-amber-200 shrink-0">{_t('📝 الواجب:', '📝 Homework:', '📝 Hausaufgabe:')}</span>
                  <span className="font-medium text-text-main whitespace-pre-wrap">{homeworkText}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-black text-text-main">{_t('رسائل المتابعة لأولياء الأمور', 'Parent Follow-up Messages', 'Nachrichten an Eltern')}</h3>
                
                <div className="inline-flex items-center p-0.5 bg-surface border border-surface-border rounded-lg shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setFollowUpStyle('egyptian')}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all ${
                      followUpStyle === 'egyptian'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {_t('🇪🇬 مصري راقي', 'Casual', 'Umgangssprachlich')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpStyle('standard')}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all ${
                      followUpStyle === 'standard'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {_t('📜 فصحى', 'Formal', 'Formell')}
                  </button>
                </div>
              </div>
              
              {messages.length === 0 ? (
                <p className="text-sm text-text-muted">{_t('لا توجد أرقام هواتف أو يوزرات واتساب مسجلة للطلاب أو أولياء الأمور في هذه المجموعة.', 'No phone numbers or WhatsApp contacts found for students in this group.', 'Keine Telefonnummern oder WhatsApp-Kontakte gefunden.')}</p>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className="border border-surface-border rounded-xl p-4 space-y-3 bg-surface">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        <User className="w-4 h-4" />
                        <span>{m.names.join(_t(' و ', ', ', ', '))}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-mono text-text-muted bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md" dir="ltr">
                        {m.isUsername ? (
                          <>
                            <AtSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">{m.display}</span>
                          </>
                        ) : (
                          <>
                            <Phone className="w-3 h-3 text-primary" />
                            <span>{m.display}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg text-xs text-text-main whitespace-pre-wrap border border-slate-200 dark:border-slate-800 font-medium leading-relaxed">
                      {m.message}
                    </div>

                    <button
                      onClick={() => handleSendWhatsApp(m.contact, m.message, selectedGroup.latestCompletedLesson.id)}
                      className="w-full bg-primary hover:bg-primary-hover text-white font-black text-xs sm:text-sm py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                    >
                      <Send className="w-4 h-4" />
                      {_t(`إرسال عبر WhatsApp (${m.display})`, `Send via WhatsApp (${m.display})`, `Per WhatsApp senden (${m.display})`)}
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
              {_t('تحديد كمكتمل يدوياً (Mark Done)', 'Mark as Done Manually', 'Manuell als erledigt markieren')}
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
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />
        
        <div className="px-3.5 py-2.5 sm:p-4 flex items-center justify-between border-b border-surface-border sticky top-0 bg-surface z-10 shrink-0">
          <h2 className="text-xs sm:text-base font-black text-text-main flex items-center gap-2 truncate">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
            <span className="truncate">{_t('متابعة الواجبات', 'Homework Follow-up', 'Hausaufgaben-Nachverfolgung')}</span>
          </h2>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ReportLanguageToggle showLabel={false} />
            <button onClick={onClose} className="p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-text-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0">
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
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
                {p.isToday ? _t('اليوم', 'Today', 'Heute') : p.isTomorrow ? _t('غداً', 'Tomorrow', 'Morgen') : p.nextLessonDateStr}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

