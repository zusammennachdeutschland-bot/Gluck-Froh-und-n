import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PendingFollowUp } from '../utils/homeworkFollowUpUtils';
import { X, Check, Send, BookOpen, User, Sparkles, AtSign, Phone, Copy, Users, CheckCircle2, Link as LinkIcon, ExternalLink, MessageSquare } from 'lucide-react';
import { buildWhatsAppUrl, resolveStudentWhatsAppContact } from '../utils/phoneUtils';
import { getStudentRoleLabel, isLikelyFemaleStudent } from '../utils/genderUtils';
import confetti from 'canvas-confetti';
import { ReportLanguageToggle } from './ReportLanguageToggle';
import { getTimeBasedGreeting } from '../utils/greetingUtils';
import { isStudentMatchingLessonWeek } from '../utils/scheduleUtils';

interface HomeworkFollowUpModalProps {
  pendingFollowUps: PendingFollowUp[];
  initialGroupId?: string;
  onClose: () => void;
}

export const HomeworkFollowUpModal: React.FC<HomeworkFollowUpModalProps> = ({ pendingFollowUps, initialGroupId, onClose }) => {
  const { students, groups, updateGroup, updateLesson, profile, _t, reportLanguage } = useApp();
  const currentMsgLang = reportLanguage || 'ar';
  
  const [selectedGroup, setSelectedGroup] = useState<PendingFollowUp | null>(
    initialGroupId ? pendingFollowUps.find(p => p.groupId === initialGroupId) || null : null
  );
  
  // Tab mode: 'group' (WhatsApp Group Link) | 'individual' (Private Messages)
  const [viewMode, setViewMode] = useState<'group' | 'individual'>('group');
  const [followUpStyle, setFollowUpStyle] = useState<'egyptian' | 'standard'>('egyptian');
  const [sentContacts, setSentContacts] = useState<Set<string>>(new Set());
  const [copiedContact, setCopiedContact] = useState<string | null>(null);
  const [copiedGroupToast, setCopiedGroupToast] = useState<boolean>(false);

  // Group WhatsApp Link editing state
  const [newGroupLinkInput, setNewGroupLinkInput] = useState<string>('');
  const [isEditingGroupLink, setIsEditingGroupLink] = useState<boolean>(false);

  const handleMarkDone = (lessonId: string) => {
    updateLesson(lessonId, { homeworkFollowUpSentAt: new Date().toISOString() });
    setSelectedGroup(null);
    setSentContacts(new Set());
    if (pendingFollowUps.length <= 1) {
      onClose();
    }
  };

  const handleSendIndividualWhatsApp = (contact: string, message: string) => {
    const url = buildWhatsAppUrl(contact, message);
    window.open(url, '_blank');
    
    // Mark as opened/sent locally WITHOUT closing the modal!
    setSentContacts(prev => {
      const next = new Set(prev);
      next.add(contact);
      return next;
    });
    
    try {
      confetti({ particleCount: 30, spread: 50 });
    } catch (e) {}
  };

  const handleCopySingleText = (contactKey: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContact(contactKey);
    setTimeout(() => setCopiedContact(null), 2500);
  };

  const handleSaveGroupLink = (groupId: string) => {
    if (!newGroupLinkInput.trim()) return;
    let url = newGroupLinkInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    updateGroup(groupId, { whatsAppGroupLink: url });
    setIsEditingGroupLink(false);
    try {
      confetti({ particleCount: 30, spread: 40 });
    } catch (e) {}
  };

  const handleOpenGroupWhatsApp = (groupLink: string, groupMessageText: string) => {
    // 1. Copy message text to clipboard
    navigator.clipboard.writeText(groupMessageText);
    setCopiedGroupToast(true);
    setTimeout(() => setCopiedGroupToast(false), 4000);

    // 2. Open group WhatsApp link if available
    let url = groupLink ? groupLink.trim() : '';
    if (url) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      window.open(url, '_blank');
    }

    try {
      confetti({ particleCount: 50, spread: 70 });
    } catch (e) {}
  };

  if (selectedGroup) {
    const prevLesson = selectedGroup.latestCompletedLesson;
    
    // Find associated group object to retrieve whatsAppGroupLink
    const associatedGroup = groups.find(g => g.id === selectedGroup.groupId)
      || groups.find(g => g.name.trim().toLowerCase() === selectedGroup.groupName.trim().toLowerCase());
    const savedGroupLink = associatedGroup?.whatsAppGroupLink || '';

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

    const lessonDate = selectedGroup.latestCompletedLesson?.date;
    const groupStudents = students.filter(s => s.groupId === selectedGroup.groupId && (!lessonDate || isStudentMatchingLessonWeek(s.scheduleRecurrence, lessonDate)));
    const allStudentNames = groupStudents.map(s => {
      if (currentMsgLang === 'de' || currentMsgLang === 'en') {
        return s.certificateName || s.displayNameEn || s.nameEn || s.name;
      }
      return s.displayNameAr || s.nameAr || s.name;
    });

    // Group Broadcast Message
    let groupBroadcastMsg = '';
    if (currentMsgLang === 'en') {
      const enG = getTimeBasedGreeting('en', { isGroup: true });
      groupBroadcastMsg = `${enG}\n\n📌 *Homework & Follow-up for Group:* *${selectedGroup.groupName}*\n\n📖 *Lesson Topic:* ${lessonTitle}\n📝 *Required Homework:* ${homeworkText}\n\n👥 *Students:* \n` +
        allStudentNames.map(n => `• ${n}`).join('\n') +
        `\n\nPlease ensure homework is completed before the next class.\nThank you! 🌸`;
      if (teacherSign) groupBroadcastMsg += `\n\nBest regards,\n*${profile.displayName || teacherSign}*`;
    } else if (currentMsgLang === 'de') {
      const deG = getTimeBasedGreeting('de', { isGroup: true });
      groupBroadcastMsg = `${deG}\n\n📌 *Hausaufgaben-Erinnerung für Gruppe:* *${selectedGroup.groupName}*\n\n📖 *Thema der Lektion:* ${lessonTitle}\n📝 *Hausaufgabe:* ${homeworkText}\n\n👥 *Schüler:* \n` +
        allStudentNames.map(n => `• ${n}`).join('\n') +
        `\n\nBitte stellen Sie sicher, dass die Hausaufgabe vor der nächsten Stunde erledigt wird.\nVielen Dank! 🌸`;
      if (teacherSign) groupBroadcastMsg += `\n\nMit freundlichen Grüßen,\n*${profile.displayName || teacherSign}*`;
    } else {
      if (followUpStyle === 'egyptian') {
        const arG = getTimeBasedGreeting('ar', { style: 'egyptian', isGroup: true });
        groupBroadcastMsg = `${arG}\n\n📌 *تذكير بمتابعة واجب مجموعة:* *${selectedGroup.groupName}* 🇩🇪\n\n📖 *اللي اتشرح في الحصة:* ${lessonTitle}\n📝 *الواجب المطلوب:* ${homeworkText}\n\n👥 *أسماء الطلاب/الطالبات:* \n` +
          allStudentNames.map(n => `• ${n}`).join('\n') +
          `\n\nبرجاء التأكد من حل الواجب قبل موعد الحصة القادمة إن شاء الله.\nشكراً لمتابعة واهتمام حضراتكم 🌸`;
      } else {
        const arG = getTimeBasedGreeting('ar', { style: 'standard', isGroup: true });
        groupBroadcastMsg = `${arG}\n\n📌 *تذكير بمتابعة واجب مجموعة:* *${selectedGroup.groupName}*\n\n📖 *عنوان الدرس:* ${lessonTitle}\n📝 *الواجب:* ${homeworkText}\n\n👥 *أسماء الطلاب/الطالبات:* \n` +
          allStudentNames.map(n => `• ${n}`).join('\n') +
          `\n\nبرجاء التأكد من حل الواجب قبل موعد الحصة القادمة.\nشكراً لحضراتكم.`;
      }
      if (teacherSign) groupBroadcastMsg += `\n\nمع تحيات: *${teacherSign}*`;
    }
    
    // Group students by parent contact for individual tab
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
        const studentDisplayName = (currentMsgLang === 'de' || currentMsgLang === 'en')
          ? (s.certificateName || s.displayNameEn || s.nameEn || s.name)
          : (s.displayNameAr || s.nameAr || s.name);
        byContact[key].names.push(studentDisplayName);
      }
    });

    const individualMessages = Object.entries(byContact).map(([contact, { names, isUsername, display }]) => {
      const isMultiple = names.length > 1;
      let message = '';
      
      if (currentMsgLang === 'en') {
        const enG = getTimeBasedGreeting('en');
        message += `${enG}\n\n`;
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
        const deG = getTimeBasedGreeting('de');
        message += `${deG}\n\n`;
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
          const arG = getTimeBasedGreeting('ar', { style: 'egyptian' });
          message += `${arG}\n\n`;
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

    const isAllSent = individualMessages.length > 0 && individualMessages.every(m => sentContacts.has(m.contact));

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
          className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[92vh]"
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

            {/* SENDING MODE SELECTOR TABS: GROUP VS INDIVIDUAL */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('group')}
                className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  viewMode === 'group'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{_t('💬 جروب الواتساب المجمع', 'Group WhatsApp', 'WhatsApp-Gruppe')}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('individual')}
                className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  viewMode === 'individual'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{_t('👤 إرسال فردي لكل ولي أمر', 'Individual Parents', 'Einzelne Eltern')}</span>
              </button>
            </div>

            {/* Toast feedback when copied */}
            {copiedGroupToast && (
              <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-2 animate-fade-in shadow-md">
                <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>{_t('✓ تم نسخ تقرير الجروب وفتح الواتساب! يمكنك الآن لصق الرسالة مباشرة في الجروب.', 'Group report copied & WhatsApp opened! Paste directly into group.', 'Kopiert & WhatsApp geöffnet!')}</span>
              </div>
            )}

            {/* TAB 1: GROUP WHATSAPP MODE */}
            {viewMode === 'group' && (
              <div className="space-y-3.5 animate-fade-in">
                {/* Style Selector */}
                <div className="flex items-center justify-between bg-surface border border-surface-border p-2.5 rounded-xl">
                  <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                    {_t('أسلوب الرسالة المجمعة:', 'Message Style:', 'Stil der Nachricht:')}
                  </span>
                  <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFollowUpStyle('egyptian')}
                      className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer ${
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
                      className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer ${
                        followUpStyle === 'standard'
                          ? 'bg-primary text-white shadow-2xs'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      {_t('📜 فصحى', 'Formal', 'Formell')}
                    </button>
                  </div>
                </div>

                {/* Group WhatsApp Link Status & Editing Box */}
                <div className="bg-surface border border-surface-border p-3.5 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <LinkIcon className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-text-main">
                        {_t('رابط جروب الواتساب:', 'Group WhatsApp Link:', 'WhatsApp-Gruppenlink:')}
                      </span>
                    </div>
                    {savedGroupLink ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNewGroupLinkInput(savedGroupLink);
                          setIsEditingGroupLink(!isEditingGroupLink);
                        }}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        {isEditingGroupLink ? _t('إلغاء', 'Cancel', 'Abbrechen') : _t('تعديل الرابط', 'Edit Link', 'Link bearbeiten')}
                      </button>
                    ) : (
                      <span className="text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        {_t('غير مسجل', 'Not Set', 'Nicht festgelegt')}
                      </span>
                    )}
                  </div>

                  {savedGroupLink && !isEditingGroupLink && (
                    <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/60 truncate flex items-center justify-between gap-2" dir="ltr">
                      <span className="truncate">{savedGroupLink}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    </div>
                  )}

                  {(!savedGroupLink || isEditingGroupLink) && associatedGroup && (
                    <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <p className="text-[11px] text-text-muted font-medium">
                        {_t('أدخل رابط جروب الواتساب لفتح الجروب بضغطة واحدة دائماً:', 'Enter WhatsApp group link to open group directly:', 'WhatsApp-Gruppenlink eingeben:')}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newGroupLinkInput}
                          onChange={(e) => setNewGroupLinkInput(e.target.value)}
                          placeholder="https://chat.whatsapp.com/..."
                          className="flex-1 text-xs p-2 bg-surface border border-surface-border rounded-lg text-text-main font-mono focus:outline-none focus:border-primary"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveGroupLink(associatedGroup.id)}
                          disabled={!newGroupLinkInput.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs py-2 px-3 rounded-lg cursor-pointer transition-colors shrink-0"
                        >
                          {_t('حفظ الرابط', 'Save Link', 'Link speichern')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Main Action Buttons for Group */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleOpenGroupWhatsApp(savedGroupLink, groupBroadcastMsg)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {savedGroupLink
                        ? _t('📱 فتح جروب الواتساب ونسخ الرسالة', 'Open WhatsApp Group & Copy Text', 'WhatsApp-Gruppe öffnen & Text kopieren')
                        : _t('📋 نسخ الرسالة المجمعة لجروب الواتساب', 'Copy Broadcast Text for Group', 'Sammeltext für WhatsApp kopieren')
                      }
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopySingleText('group_msg', groupBroadcastMsg)}
                    className="w-full bg-surface hover:bg-surface-hover border border-surface-border text-text-main font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedContact === 'group_msg' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">{_t('تم نسخ النص المجمع بنجاح!', 'Group Text Copied!', 'Text kopiert!')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-text-muted" />
                        <span>{_t('📋 نسخ نص الرسالة المجمعة فقط', 'Copy Group Text Only', 'Nur Text kopieren')}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Group Message Preview */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-text-muted">
                    {_t('معاينة الرسالة المجمعة للجروب:', 'Group Broadcast Preview:', 'Vorschau der Sammelnachricht:')}
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl text-xs text-text-main whitespace-pre-wrap border border-slate-200 dark:border-slate-800 font-medium leading-relaxed max-h-48 overflow-y-auto">
                    {groupBroadcastMsg}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INDIVIDUAL PARENTS MODE */}
            {viewMode === 'individual' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <h3 className="text-xs sm:text-sm font-black text-text-main flex items-center gap-1.5">
                    <span>{_t('رسائل المتابعة الفردية لأولياء الأمور', 'Individual Parent Messages', 'Einzelne Nachrichten an Eltern')}</span>
                    {sentContacts.size > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                        {sentContacts.size} / {individualMessages.length} {_t('تم إرساله', 'Sent', 'Gesendet')}
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
                
                {individualMessages.length === 0 ? (
                  <p className="text-sm text-text-muted p-4 text-center border border-dashed border-surface-border rounded-xl">
                    {_t('لا توجد أرقام هواتف أو يوزرات واتساب مسجلة للطلاب في هذه المجموعة.', 'No phone numbers or WhatsApp contacts found for students in this group.', 'Keine Telefonnummern oder WhatsApp-Kontakte gefunden.')}
                  </p>
                ) : (
                  individualMessages.map((m, idx) => {
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
                            onClick={() => handleSendIndividualWhatsApp(m.contact, m.message)}
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
            )}
          </div>

          {/* Bottom Complete / Close Bar */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border-t border-surface-border space-y-2">
            {isAllSent && viewMode === 'individual' && (
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
