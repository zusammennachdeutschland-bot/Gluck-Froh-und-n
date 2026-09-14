import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  parseAiImportText, 
  SAMPLE_IMPORT_TEMPLATE, 
  SAMPLE_MULTI_GROUP_TEMPLATE,
  SAMPLE_MULTI_SCHEDULE_TEMPLATE, 
  AI_PROMPT_TEMPLATE_AR, 
  AI_PROMPT_TEMPLATE_EN, 
  AiImportResult 
} from '../utils/aiImportParser';
import { formatGroupScheduleDisplay } from '../utils/scheduleUtils';
import { 
  Bot, Sparkles, Copy, Check, CheckCircle2, AlertTriangle, X, 
  Users, Calendar, Clock, DollarSign, ArrowRight, ShieldCheck, FileText, ChevronRight, MessageSquareCode,
  AtSign, Phone, Layers, ExternalLink, MapPin, Video, MessageCircle
} from 'lucide-react';
import { isWhatsAppUsername, formatContactDisplay } from '../utils/phoneUtils';
import { Group } from '../types';

const GROUP_PALETTE = ['indigo', 'purple', 'emerald', 'sky', 'amber', 'rose', 'blue'];

interface AiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGroup?: (group: Group) => void;
}

export const AiImportModal: React.FC<AiImportModalProps> = ({
  isOpen,
  onClose,
  onSelectGroup
}) => {
  const { addGroup, addStudent, generateGroupScheduleLessons, t, language } = useApp();

  const [importText, setImportText] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);
  const [importedGroups, setImportedGroups] = useState<Group[]>([]);
  const [importedCount, setImportedCount] = useState<number>(0);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const parseResult: AiImportResult = parseAiImportText(importText);

  const handleCopySample = (template: string, type: string) => {
    navigator.clipboard.writeText(template);
    setImportText(template);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConfirmImport = () => {
    if (!parseResult.isValid || parseResult.groups.length === 0) return;

    const createdGroups: Group[] = [];
    let totalStudentsAdded = 0;

    parseResult.groups.forEach((groupItem, gIdx) => {
      const { group, students } = groupItem;

      // Determine session count and package prices based on payment_type and lesson_price
      let sessionCount = 4;
      let pricePerSession = group.lesson_price ?? group.payment_amount;
      let monthlyPackagePrice = group.payment_amount;

      if (group.payment_type === 'per_lesson') {
        sessionCount = 1;
        pricePerSession = group.lesson_price ?? group.payment_amount;
        monthlyPackagePrice = pricePerSession * 4;
      } else if (group.payment_type === '4_lessons') {
        sessionCount = 4;
        pricePerSession = group.lesson_price ?? Math.round(group.payment_amount / 4);
        monthlyPackagePrice = group.payment_amount;
      } else if (group.payment_type === '8_lessons') {
        sessionCount = 8;
        pricePerSession = group.lesson_price ?? Math.round(group.payment_amount / 8);
        monthlyPackagePrice = group.payment_amount;
      } else if (group.payment_type === '12_lessons') {
        sessionCount = 12;
        pricePerSession = group.lesson_price ?? Math.round(group.payment_amount / 12);
        monthlyPackagePrice = group.payment_amount;
      } else if (group.payment_type === 'monthly') {
        sessionCount = 8;
        pricePerSession = group.lesson_price ?? Math.round(group.payment_amount / 8);
        monthlyPackagePrice = group.payment_amount;
      }

      const selectedPaymentCycle = group.payment_type === 'per_lesson' ? 'per_lesson' : 'monthly';
      const color = GROUP_PALETTE[gIdx % GROUP_PALETTE.length];

      // 1. Create Group
      const newGroup = addGroup({
        name: group.name,
        grade: group.grade,
        type: group.type,
        scheduleDays: group.days,
        scheduleTime: group.time,
        schedules: group.schedules,
        scheduleDayTimes: group.dayTimes,
        paymentCycle: selectedPaymentCycle,
        sessionCount,
        monthlyPackagePrice,
        pricePerSession,
        zoomLink: group.type === 'online' ? (group.zoom_link || '') : undefined,
        address: group.type === 'offline' ? (group.address || '') : undefined,
        whatsAppGroupLink: group.whatsapp_link || '',
        color
      });

      createdGroups.push(newGroup);

      // 2. Create Students for this group
      students.forEach((st) => {
        const isParentUser = st.parentContactType === 'username' || isWhatsAppUsername(st.parentPhone);
        const cleanParentUser = st.parentUsername || (isParentUser ? (st.parentPhone || '').replace(/^@/, '') : undefined);

        const hasStudentVal = !!st.studentPhone;
        const isStudentUser = hasStudentVal && (st.studentContactType === 'username' || isWhatsAppUsername(st.studentPhone));
        const cleanStudentUser = st.studentUsername || (isStudentUser && st.studentPhone ? st.studentPhone.replace(/^@/, '') : undefined);

        addStudent({
          name: st.name,
          certificateName: st.certificateName || '',
          studentPhone: st.studentPhone || '',
          studentUsername: cleanStudentUser,
          studentContactType: isStudentUser ? 'username' : (hasStudentVal ? 'phone' : undefined),
          parentPhone: st.parentPhone,
          parentUsername: cleanParentUser,
          parentContactType: isParentUser ? 'username' : 'phone',
          parentName: '',
          groupId: newGroup.id,
          grade: group.grade
        });
        totalStudentsAdded++;
      });

      // 3. Auto-generate schedule lessons with independent day times
      setTimeout(() => {
        generateGroupScheduleLessons(newGroup.id, group.days, group.time, 4, group.dayTimes, newGroup);
      }, 250 + gIdx * 100);
    });

    setImportedGroups(createdGroups);
    setImportedCount(totalStudentsAdded);
    setIsSuccess(true);
  };

  const handleReset = () => {
    setImportText('');
    setIsSuccess(false);
    setImportedGroups([]);
    setImportedCount(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <div 
      onClick={handleClose} 
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center pt-[max(24px,env(safe-area-inset-top,24px))] overflow-y-auto font-sans p-0 sm:p-4 pb-0"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-2xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[92vh]"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-hover p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface/20 backdrop-blur-md flex items-center justify-center shadow-inner shrink-0">
              <Bot className="w-5 h-5 text-primary-soft" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">
                  {language === 'ar' ? 'استيراد المجموعات والطلاب بالذكاء الاصطناعي' : t('auto_import_group_students_ai_te')}
                </h3>
                <span className="bg-primary/30 text-primary-soft border border-primary-border text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Multi-Group AI
                </span>
              </div>
              <p className="text-xs text-primary-soft/90">
                {language === 'ar' 
                  ? 'إنشاء مجموعة واحدة أو عدة مجموعات مع طلابها ومواعيدها من برومبت واحد' 
                  : 'Create single or multiple groups with full student rosters & schedules in one prompt'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="text-white/80 hover:text-white hover:bg-surface/10 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">

          {isSuccess ? (
            /* SUCCESS RESULT VIEW */
            <div className="py-4 space-y-5 text-center animate-fade-in">
              <div className="w-16 h-16 bg-primary-soft text-primary rounded-full flex items-center justify-center mx-auto shadow-lg ring-8 ring-primary/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xl font-black text-text-main">
                  {language === 'ar' ? 'تم استيراد المجموعات والطلاب بنجاح!' : t('auto_group_students_imported_succ')}
                </h4>
                <p className="text-sm text-text-muted max-w-md mx-auto">
                  {language === 'ar' 
                    ? `تم بنجاح إنشاء ${importedGroups.length} مجموعة وإضافة ${importedCount} طالب مع جداول الحصص تلقائياً.` 
                    : `Successfully created ${importedGroups.length} group(s) and enrolled ${importedCount} student(s) with full schedules.`}
                </p>
              </div>

              {/* Summary List of Created Groups */}
              <div className="max-w-xl mx-auto space-y-2.5 text-left rtl:text-right">
                {importedGroups.map((grp, idx) => (
                  <div 
                    key={grp.id} 
                    className="bg-surface-hover/70 border border-surface-border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-black flex items-center justify-center text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-text-main flex items-center gap-2">
                          <span>{grp.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-text-muted font-bold">
                            {grp.grade}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            grp.type === 'online' 
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' 
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {grp.type === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                          <Clock className="w-3 h-3 text-text-muted" />
                          <span>{grp.scheduleDays?.join(', ')} @ {grp.scheduleTime}</span>
                        </div>
                      </div>
                    </div>

                    {onSelectGroup && (
                      <button
                        onClick={() => {
                          onSelectGroup(grp);
                          handleClose();
                        }}
                        className="bg-surface hover:bg-primary hover:text-white text-primary border border-primary/30 font-bold px-3 py-1.5 rounded-lg transition-all text-xs flex items-center gap-1.5 self-end sm:self-center cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <span>{language === 'ar' ? 'عرض المجموعة' : t('auto_view_group_profile')}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <button
                  onClick={handleClose}
                  className="w-full sm:w-auto bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm"
                >
                  {t('auto_close')}
                </button>
              </div>
            </div>
          ) : (
            /* PASTE & PREVIEW FORM VIEW */
            <>
              {/* Instructions Banner */}
              <div className="bg-primary-soft/80 border border-primary-border rounded-xl p-3.5 sm:p-4 text-xs space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 font-bold text-primary">
                    <Bot className="w-4 h-4 text-primary shrink-0" />
                    <span>{language === 'ar' ? 'أوامر ونماذج الذكاء الاصطناعي (AI Prompt Templates)' : t('auto_copy_prompt_orders_for_ai')}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Copy AI Rules Prompt */}
                    <button
                      onClick={() => handleCopySample(language === 'ar' ? AI_PROMPT_TEMPLATE_AR : AI_PROMPT_TEMPLATE_EN, 'prompt')}
                      className="bg-primary hover:bg-primary-hover text-white font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs shadow-xs shrink-0 active:scale-95"
                      title={language === 'ar' ? 'نسخ أوامر الذكاء الاصطناعي للشات' : 'Copy prompt rules for AI assistant'}
                    >
                      {copied === 'prompt' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>{t('auto_prompt_copied')}</span>
                        </>
                      ) : (
                        <>
                          <MessageSquareCode className="w-3.5 h-3.5 text-primary-soft" />
                          <span>{language === 'ar' ? 'نسخ أوامر البرومبت' : t('auto_copy_ai_prompt_orders')}</span>
                        </>
                      )}
                    </button>

                    {/* Multi-Group Sample */}
                    <button
                      onClick={() => handleCopySample(SAMPLE_MULTI_GROUP_TEMPLATE, 'multi_group')}
                      className="bg-surface hover:bg-primary-soft border border-primary-border text-primary font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[11px] shadow-2xs shrink-0 active:scale-95"
                    >
                      {copied === 'multi_group' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-primary" />
                          <span>{t('auto_copied')}</span>
                        </>
                      ) : (
                        <>
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          <span>{language === 'ar' ? 'مثال عدة مجموعات' : 'Multi-Group Sample'}</span>
                        </>
                      )}
                    </button>

                    {/* Single Group Sample */}
                    <button
                      onClick={() => handleCopySample(SAMPLE_IMPORT_TEMPLATE, 'single_group')}
                      className="bg-surface hover:bg-primary-soft border border-primary-border text-primary font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[11px] shadow-2xs shrink-0 active:scale-95"
                    >
                      {copied === 'single_group' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-primary" />
                          <span>{t('auto_copied')}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          <span>{language === 'ar' ? 'مثال مجموعة واحدة' : t('auto_sample_data')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  {language === 'ar' 
                    ? 'يمكنك لصق كود مجموعة واحدة أو عدة مجموعات متتالية ([GROUP] -> [SCHEDULE] -> [STUDENTS]). سيقوم النظام باستخراج جميع المجموعات والطلاب وتعيين كل طالب لمجموعته تلقائياً.' 
                    : 'Paste code for a single group or multiple consecutive groups ([GROUP] -> [SCHEDULE] -> [STUDENTS]). The system parses and registers all groups and rosters simultaneously.'}
                </p>
              </div>

              {/* Textarea Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-text-main flex items-center justify-between">
                  <span>{t('auto_ai_generated_text')}</span>
                  <span className="text-[11px] text-text-muted font-normal">
                    {language === 'ar' ? 'يدعم مجموعة واحدة أو عدة مجموعات متتالية' : 'Supports single or multiple groups'}
                  </span>
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`[GROUP]\nname=الصف الخامس سنتر الأوائل\ngrade=Grade 5\ntype=offline\nlesson_price=100\npayment_type=every_4_lessons\npayment_amount=400\naddress=مدينة نصر\nwhatsapp_link=https://chat.whatsapp.com/...\n\n[SCHEDULE]\nSunday|17:00\nWednesday|17:00\n\n[STUDENTS]\nعمر فاروق|Omar Farouk|01098765432|01011112222\nعلي محمود|Ali Mahmoud|01123456789|\n\n[GROUP]\nname=الصف السادس أونلاين\ngrade=Grade 6\ntype=online\nlesson_price=120\npayment_type=every_4_lessons\npayment_amount=480\nzoom_link=https://zoom.us/...\nwhatsapp_link=https://chat.whatsapp.com/...\n\n[SCHEDULE]\nMonday|19:30\n\n[STUDENTS]\nكندا أحمد|Kinda Ahmed|201200005170|@kinda_student`}
                  rows={8}
                  className="w-full bg-background border border-slate-300 dark:border-surface-border rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-y"
                />
              </div>

              {/* VALIDATION RESULTS & PREVIEW AREA */}
              {importText.trim() && (
                <div className="space-y-4 pt-2 border-t border-surface-border animate-fade-in">
                  
                  {/* Validation Error Box */}
                  {!parseResult.isValid && parseResult.errors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 rounded-xl p-4 text-xs space-y-2">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          {language === 'ar' 
                            ? `تم إيقاف الاستيراد - يوجد ${parseResult.errors.length} خطأ في البيانات:` 
                            : `Import Blocked - Found ${parseResult.errors.length} validation issue(s):`}
                        </span>
                      </div>
                      <ul className="list-disc list-inside text-red-600 dark:text-red-300 space-y-1 pl-1">
                        {parseResult.errors.map((err, idx) => (
                          <li key={idx} className="leading-tight">{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings Box */}
                  {parseResult.warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{language === 'ar' ? 'تنبيهات وملاحظات:' : 'Notes & Warnings:'}</span>
                      </div>
                      <ul className="list-disc list-inside text-amber-700 dark:text-amber-200 space-y-0.5 pl-1 text-[11px]">
                        {parseResult.warnings.map((warn, idx) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Valid Status Badge */}
                  {parseResult.isValid && (
                    <div className="bg-primary-soft border border-primary-border rounded-xl p-3 text-xs flex items-center justify-between gap-2 text-primary font-bold">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                        <span>
                          {language === 'ar' 
                            ? `تم التحقق بنجاح! جاهز لاستيراد ${parseResult.totalGroupsCount} مجموعة و ${parseResult.totalStudentsCount} طالب.` 
                            : `Validated successfully! Ready to import ${parseResult.totalGroupsCount} group(s) with ${parseResult.totalStudentsCount} student(s).`}
                        </span>
                      </div>
                      <span className="bg-primary text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                        {parseResult.totalGroupsCount} {language === 'ar' ? 'مجموعات' : 'Groups'}
                      </span>
                    </div>
                  )}

                  {/* PREVIEW OF ALL PARSED GROUPS */}
                  {parseResult.groups.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-text-main flex items-center justify-between">
                        <span>{language === 'ar' ? 'معاينة المجموعات والطلاب قبل الحفظ' : t('auto_data_preview_before_import')}</span>
                        <span className="text-text-muted text-[11px] font-normal">
                          {parseResult.totalGroupsCount} {language === 'ar' ? 'مجموعات' : 'Groups'} • {parseResult.totalStudentsCount} {t('auto_students_4')}
                        </span>
                      </h4>

                      <div className="space-y-4">
                        {parseResult.groups.map((groupItem, gIdx) => {
                          const { group, students } = groupItem;
                          const isOnline = group.type === 'online';

                          return (
                            <div 
                              key={gIdx} 
                              className="bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-xs space-y-3 p-3.5 sm:p-4"
                            >
                              {/* Group Card Header */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                                    {gIdx + 1}
                                  </span>
                                  <div>
                                    <div className="font-black text-sm text-text-main flex items-center gap-2">
                                      <span>{group.name}</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-text-muted font-bold">
                                        {group.grade}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${
                                    isOnline 
                                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40' 
                                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                                  }`}>
                                    {isOnline ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                                  </span>

                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary">
                                    <Users className="w-3 h-3" />
                                    <span>{students.length} {language === 'ar' ? 'طلاب' : 'Students'}</span>
                                  </span>
                                </div>
                              </div>

                              {/* Group Details Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-surface-hover/60 p-2.5 rounded-xl text-xs">
                                <div>
                                  <div className="text-[10px] text-text-muted font-medium">
                                    {t('auto_days_time')}
                                  </div>
                                  <div className="font-bold text-primary truncate" title={formatGroupScheduleDisplay(group, language)}>
                                    {formatGroupScheduleDisplay(group, language)}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[10px] text-text-muted font-medium">
                                    {language === 'ar' ? 'نظام الدفع' : 'Payment'}
                                  </div>
                                  <div className="font-bold text-text-main truncate">
                                    {group.payment_amount} {language === 'ar' ? 'ج.م' : 'EGP'} ({group.payment_type})
                                  </div>
                                </div>

                                <div className="sm:col-span-2">
                                  <div className="text-[10px] text-text-muted font-medium">
                                    {isOnline ? t('auto_zoom_link') : t('auto_address')}
                                  </div>
                                  <div className="font-bold text-primary truncate" title={isOnline ? group.zoom_link : group.address}>
                                    {isOnline ? (group.zoom_link || '—') : (group.address || '—')}
                                  </div>
                                </div>
                              </div>

                              {/* WhatsApp link notice */}
                              {group.whatsapp_link && (
                                <div className="text-[11px] flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span className="font-bold">{language === 'ar' ? 'رابط جروب الواتساب:' : 'WhatsApp Group:'}</span>
                                  <span className="font-mono truncate">{group.whatsapp_link}</span>
                                </div>
                              )}

                              {/* Student Table Preview */}
                              {students.length > 0 && (
                                <div className="border border-surface-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                  <table className="w-full text-left rtl:text-right text-xs">
                                    <thead className="bg-surface-hover/90 text-slate-600 dark:text-slate-300 font-bold sticky top-0 border-b border-surface-border">
                                      <tr>
                                        <th className="p-2 w-8 text-center">#</th>
                                        <th className="p-2">{t('auto_student_name_6')}</th>
                                        <th className="p-2">{language === 'ar' ? 'هاتف / يوزر ولي الأمر' : 'Parent Contact'}</th>
                                        <th className="p-2">{language === 'ar' ? 'هاتف / يوزر الطالب' : 'Student Contact'}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 bg-surface">
                                      {students.map((st, sIdx) => {
                                        const isParentUser = isWhatsAppUsername(st.parentPhone);
                                        const isStudentUser = st.studentPhone ? isWhatsAppUsername(st.studentPhone) : false;
                                        return (
                                          <tr key={sIdx} className="hover:bg-background transition-colors">
                                            <td className="p-2 text-center text-text-muted/70 text-[11px]">{sIdx + 1}</td>
                                            <td className="p-2 font-extrabold">
                                              <div>{st.name}</div>
                                              {st.certificateName && (
                                                <div className="text-[10px] text-text-muted font-normal">{st.certificateName}</div>
                                              )}
                                            </td>
                                            <td className="p-2">
                                              {isParentUser ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 text-[11px] font-mono font-bold">
                                                  <AtSign className="w-2.5 h-2.5 shrink-0" />
                                                  {formatContactDisplay(st.parentPhone)}
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 font-mono font-bold text-primary text-xs">
                                                  <Phone className="w-2.5 h-2.5 shrink-0 text-text-muted" />
                                                  {st.parentPhone}
                                                </span>
                                              )}
                                            </td>
                                            <td className="p-2">
                                              {st.studentPhone ? (
                                                isStudentUser ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 text-[11px] font-mono font-bold">
                                                    <AtSign className="w-2.5 h-2.5 shrink-0" />
                                                    {formatContactDisplay(st.studentPhone)}
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 font-mono text-text-muted text-xs">
                                                    <Phone className="w-2.5 h-2.5 shrink-0" />
                                                    {st.studentPhone}
                                                  </span>
                                                )
                                              ) : (
                                                <span className="text-text-muted text-xs">—</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        {!isSuccess && (
          <div className="p-4 bg-background border-t border-surface-border flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-surface-border-soft text-text-main font-bold text-xs hover:bg-surface-hover transition-colors cursor-pointer"
            >
              {t('auto_cancel')}
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={!parseResult.isValid || !importText.trim()}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-md cursor-pointer ${
                parseResult.isValid && importText.trim()
                  ? 'bg-gradient-to-r from-primary to-primary-hover hover:from-primary hover:to-primary-hover text-white active:scale-95'
                  : 'bg-slate-200 dark:bg-slate-800 text-text-muted/70 dark:text-slate-600 cursor-not-allowed shadow-none'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {parseResult.totalGroupsCount > 1 
                  ? (language === 'ar' ? `استيراد ${parseResult.totalGroupsCount} مجموعات (${parseResult.totalStudentsCount} طالب)` : `Confirm Import (${parseResult.totalGroupsCount} Groups)`) 
                  : t('auto_confirm_import')}
              </span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

