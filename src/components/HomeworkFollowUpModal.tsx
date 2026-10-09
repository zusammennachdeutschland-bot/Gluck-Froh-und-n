import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PendingFollowUp } from '../utils/homeworkFollowUpUtils';
import { X, Check, Send, BookOpen, User, Sparkles, AtSign, Phone, Copy, Users, CheckCircle2, Share2 } from 'lucide-react';
import { buildWhatsAppUrl, resolveStudentWhatsAppContact } from '../utils/phoneUtils';
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
  const [sentContacts, setSentContacts] = useState<Set<string>>(new Set());
  const [copiedContact, setCopiedContact] = useState<string | null>(null);
  const [copiedGroupToast, setCopiedGroupToast] = useState<boolean>(false);

  const handleMarkDone = (lessonId: string) => {
    updateLesson(lessonId, { homeworkFollowUpSentAt: new Date().toISOString() });
    setSelectedGroup(null);
    setSentContacts(new Set());
    if (pendingFollowUps.length <= 1) {
      onClose();
    }
  };

  const handleSendWhatsApp = (contact: string, message: string) => {
    const url = buildWhatsAppUrl(contact, message);
    window.open(url, '_blank');
    
    // Mark as opened/sent locally WITHOUT closing the modal or resetting selectedGroup!
    setSentContacts(prev => {
      const next = new Set(prev);
      next.add(contact);
      return next;
    });
    
    try {
      confetti({ particleCount: 35, spread: 60 });
    } catch (e) {}
  };

  const handleSendAll = (messagesList: { contact: string; message: string }[]) => {
    if (messagesList.length === 0) return;
    
    // Open WhatsApp tabs with a slight delay between each to avoid popup blockers
    messagesList.forEach((m, idx) => {
      setTimeout(() => {
        const url = buildWhatsAppUrl(m.contact, m.message);
        window.open(url, '_blank');
      }, idx * 600);
    });

    setSentContacts(new Set(messagesList.map(m => m.contact)));

    try {
      confetti({ particleCount: 80, spread: 90 });
    } catch (e) {}
  };

  const handleCopySingleText = (contactKey: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContact(contactKey);
    setTimeout(() => setCopiedContact(null), 2500);
  };

  const handleCopyGroupReport = (groupName: string, lessonTitle: string, homeworkText: string, allStudentNames: string[]) => {
    const teacherSign = profile.displayNameAr || (profile.displayName ? `أ/ ${profile.displayName}` : '');
    
    let text = '';
    if (currentMsgLang === 'en') {
      text = `Hello everyone 👋\n\n📌 *Homework & Follow-up for Group:* *${groupName}*\n\n📖 *Lesson Topic:* ${lessonTitle}\n📝 *Required Homework:* ${homeworkText}\n\n👥 *Students:* \n` +
        allStudentNames.map(n => `• ${n}`).join('\n') +
        `\n\nPlease ensure homework is completed before the next class.\nThank you! 🌸`;
      if (teacherSign) text += `\n\nBest regards,\n*${profile.displayName || teacherSign}*`;
    } else if (currentMsgLang === 'de') {
      text = `Guten Tag zusammen 👋\n\n📌 *Hausaufgaben-Erinnerung für Gruppe:* *${groupName}*\n\n📖 *Thema der Lektion:* ${lessonTitle}\n📝 *Hausaufgabe:* ${homeworkText}\n\n👥 *Schüler:* \n` +
        allStudentNames.map(n => `• ${n}`).join('\n') +
        `\n\nBitte stellen Sie sicher, dass die Hausaufgabe vor der nächsten Stunde erledigt wird.\nVielen Dank! 🌸`;
      if (teacherSign) text += `\n\nMit freundlichen Grüßen,\n*${profile.displayName || teacherSign}*`;
    } else {
      if (followUpStyle === 'egyptian') {
        text = `أهلاً بحضراتكم جميعاً يا فندم 👋\n\n📌 *تذكير بمتابعة واجب مجموعة:* *${groupName}* 🇩🇪\n\n📖 *اللي اتشرح في الحصة:* ${lessonTitle}\n📝 *الواجب المطلوب:* ${homeworkText}\n\n👥 *أسماء الطلاب/الطالبات:* \n` +
          allStudentNames.map(n => `• ${n}`).join('\n') +
          `\n\nبرجاء التأكد من حل الواجب قبل موعد الحصة القادمة إن شاء الله.\nشكراً لمتابعة واهتمام حضراتكم 🌸`;
      } else {
        text = `السلام عليكم ورحمة الله وبركاته،\n\n📌 *تذكير بمتابعة واجب مجموعة:* *${groupName}*\n\n📖 *عنوان الدرس:* ${lessonTitle}\n📝 *الواجب:* ${homeworkText}\n\n👥 *أسماء الطلاب/الطالبات:* \n` +
          allStudentNames.map(n => `• ${n}`).join('\n') +
          `\n\nبرجاء التأكد من حل الواجب قبل موعد الحصة القادمة.\nشكراً لحضراتكم.`;
      }
      if (teacherSign) text += `\n\nمع تحيات: *${teacherSign}*`;
    }

    navigator.clipboard.writeText(text);
    setCopiedGroupToast(true);
    setTimeout(() => setCopiedGroupToast(false), 3500);

    try {
      confetti({ particleCount: 45, spread: 65 });
    } catch (e) {}
  };

  if (selectedGroup) {
    const prevLesson = selectedGroup.latestCompletedLesson;
    
    // 1. Resolve Lesson Title / What was taught in the lesson
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

    const lessonTitle = (
      taughtNotes || 
      arabicTopics || 
      quickNotes || 
      topic || 
      rawTitle || 
      _t('مراجعة وتطبيقات الدرس', 'Lesson Review & Practice', 'Lektionswiederholung')
    ).trim();

    // 2. Resolve Homework Text
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
    const allStudentNames = groupStudents.map(s => s.name);
    
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
          message += `\n📖 *عنوان الدرس:* ${lessonTitle}\n📝 *الواجب:* ${homeworkText}\n\nبرجاء التأكد من حل الواجب قبل موعد الحصة القادمة.\nشكراً لحضرتك.`;
        }

        if (teacherSign) {
          message += `\n\nمع تحيات: *${teacherSign}*`;
        }
      }
      return { contact, isUsername, display, message, names };
    });

    const isAllSent = messages.length > 0 && messages.every(m => sentContacts.has(m.contact));

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
          
          {/* Header */}
          <div className="px-3.5 py-2.5 sm:p-4 flex items-center justify-between border-b border-surface-border sticky top-0 bg-surface z-10 shrink-0">
            <div className="min-w-0">
              <button 
                onClick={() => {
                  setSelectedGroup(null);
                  setSentContacts(new Set());
                }}
                className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-0.5 flex items-center hover:underline cursor-pointer"
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
              <button onClick={onClose} className="p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-text-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4">
            {/* Homework & Lesson Summary Card */}
            <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  {_t('بيانات الدرس والواجب المطلوبة', 'Lesson & Homework Info', 'Lektion & Hausaufgaben')}
                </h3>
              </div>
              
              <div className="space-y-1.5 text-xs bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/40">
                <div className="flex items-start gap-2">
                  <span className="font-black text-amber-950 dark:text-amber-200 shrink-0">{_t('📖 الدرس:', '📖 Topic:', '📖 Thema:')}</span>
                  <span className="font-bold text-text-main">{lessonTitle}</span>
                </div>
                <div className="flex items-start gap-2 pt-1 border-t border-amber-100/60 dark:border-slate-800">
                  <span className="font-black text-amber-950 dark:text-amber-200 shrink-0">{_t('📝 الواجب:', '📝 Homework:', '📝 Hausaufgabe:')}</span>
                  <span className="font-medium text-text-main whitespace-pre-wrap">{homeworkText}</span>
                </div>
              </div>
            </div>

            {/* PROMINENT GROUP BROADCAST & SEND-ALL ACTIONS */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-xl space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                    {_t('خيارات الإرسال المجمع للجروب كامل', 'Group Broadcast & Bulk Actions', 'Sammelaktionen für Gruppe')}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                  {messages.length} {_t('أولياء أمور', 'Parents', 'Eltern')}
                </span>
              </div>

              {copiedGroupToast && (
                <div className="p-2.5 bg-emerald-600 text-white rounded-lg text-xs font-black flex items-center gap-2 animate-fade-in shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                  <span>{_t('✓ تم نسخ رسالة الجروب المجمعة بنجاح! يمكنك الآن لصقها في جروب الواتساب مباشرة.', 'Group broadcast message copied! Paste it into your WhatsApp group.', 'Sammelnachricht kopiert!')}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyGroupReport(selectedGroup.groupName, lessonTitle, homeworkText, allStudentNames)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs border border-emerald-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{_t('📋 نسخ تقرير الجروب المجمع', 'Copy Group Broadcast', 'Sammelnachricht kopieren')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendAll(messages)}
                  className="bg-primary hover:bg-primary-hover text-white font-black text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{_t('🚀 فتح محادثات الجميع عبر واتساب', 'Send to All Parents', 'An alle Eltern senden')}</span>
                </button>
              </div>
            </div>

            {/* Individual Messages */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <h3 className="text-xs sm:text-sm font-black text-text-main flex items-center gap-1.5">
                  <span>{_t('رسائل المتابعة الفردية لأولياء الأمور', 'Individual Parent Messages', 'Einzeltnachrichten an Eltern')}</span>
                  {sentContacts.size > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                      {sentContacts.size} / {messages.length} {_t('تم إرساله', 'Sent', 'Gesendet')}
                    </span>
                  )}
                </h3>
                
                <div className="inline-flex items-center p-0.5 bg-surface border border-surface-border rounded-lg shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setFollowUpStyle('egyptian')}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
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
                    className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
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
                <p className="text-sm text-text-muted p-4 text-center border border-dashed border-surface-border rounded-xl">{_t('لا توجد أرقام هواتف أو يوزرات واتساب مسجلة للطلاب في هذه المجموعة.', 'No phone numbers or WhatsApp contacts found for students in this group.', 'Keine Telefonnummern oder WhatsApp-Kontakte gefunden.')}</p>
              ) : (
                messages.map((m, idx) => {
                  const isSent = sentContacts.has(m.contact);
                  const isCopied = copiedContact === m.contact;

                  return (
                    <div 
                      key={idx} 
                      className={`border rounded-xl p-3.5 space-y-2.5 transition-all ${
                        isSent 
                          ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20' 
                          : 'border-surface-border bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-text-main">
                          <User className="w-4 h-4 text-primary shrink-0" />
                          <span>{m.names.join(_t(' و ', ', ', ', '))}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isSent && (
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {_t('تم الفتح للإرسال', 'Opened', 'Geöffnet')}
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[11px] font-mono text-text-muted bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md" dir="ltr">
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
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg text-xs text-text-main whitespace-pre-wrap border border-slate-200 dark:border-slate-800 font-medium leading-relaxed">
                        {m.message}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(m.contact, m.message)}
                          className={`flex-1 font-black text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                            isSent
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-primary hover:bg-primary-hover text-white'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {isSent 
                              ? _t(`إعادة فتح WhatsApp (${m.display})`, `Re-open WhatsApp (${m.display})`, `Erneut öffnen (${m.display})`)
                              : _t(`إرسال عبر WhatsApp (${m.display})`, `Send via WhatsApp (${m.display})`, `Per WhatsApp senden (${m.display})`)
                            }
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopySingleText(m.contact, m.message)}
                          className="bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
                          title={_t('نسخ نص الرسالة', 'Copy Message Text', 'Text kopieren')}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600">{_t('تم النسخ', 'Copied', 'Kopiert')}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-text-muted" />
                              <span>{_t('نسخ', 'Copy', 'Kopieren')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Complete / Close Bar */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border-t border-surface-border space-y-2">
            {isAllSent && (
              <div className="p-2.5 bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-black flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {_t('رائع! تم فتح محادثات جميع أولياء الأمور بنجاح 🎉', 'Awesome! All parent chats opened successfully.', 'Alle Nachrichten verschickt!')}
                </span>
              </div>
            )}

            <button
              onClick={() => handleMarkDone(selectedGroup.latestCompletedLesson.id)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>{_t('تحديد كمكتمل وإغلاق المتابعة (Mark Done)', 'Mark as Done & Close', 'Als erledigt markieren & schließen')}</span>
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
            <span className="truncate">{_t('متابعة الواجبات وإرسال الرسائل', 'Homework Follow-up & Messaging', 'Hausaufgaben-Nachverfolgung')}</span>
          </h2>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ReportLanguageToggle showLabel={false} />
            <button onClick={onClose} className="p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-text-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer">
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="p-2 overflow-y-auto">
          {pendingFollowUps.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs sm:text-sm font-medium">
              {_t('لا توجد مجموعات بانتظار إرسال متابعة الواجب حالياً.', 'No pending homework follow-ups at the moment.', 'Keine ausstehenden Hausaufgaben-Nachverfolgungen.')}
            </div>
          ) : (
            pendingFollowUps.map(p => (
              <div 
                key={p.groupId}
                onClick={() => {
                  setSelectedGroup(p);
                  setSentContacts(new Set());
                }}
                className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-surface-border last:border-0 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-sm sm:text-base text-text-main">{p.groupName}</span>
                </div>
                <span className="text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-1 rounded-md">
                  {p.isToday ? _t('اليوم', 'Today', 'Heute') : p.isTomorrow ? _t('غداً', 'Tomorrow', 'Morgen') : p.nextLessonDateStr}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
