import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Group, Lesson } from '../types';
import { 
  X, Users, Trash2, Send, Save, Video, ExternalLink, Copy, Check, 
  Sparkles, Calendar, Plus, Edit2, Play, FileText 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CascadeDeleteGroupModal } from './CascadeDeleteGroupModal';
import { LessonReminderModal } from './LessonReminderModal';
import { GroupForm, GroupFormData } from './GroupForm';
import { getGroupCycleInfo } from '../utils/lessonUtils';
import { buildWhatsAppUrl } from '../utils/phoneUtils';

interface GroupProfileModalProps {
  group: Group;
  onClose: () => void;
  initialTab?: 'details' | 'recordings';
}

export const GroupProfileModal: React.FC<GroupProfileModalProps> = ({ group, onClose, initialTab = 'details' }) => {
  const { updateGroup, updateLesson, deleteGroup, archiveGroup, generateGroupScheduleLessons, students, lessons, payments, language, t, _t } = useApp();

  const [activeTab, setActiveTab] = useState<'details' | 'recordings'>(initialTab);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isConfirmingCascade, setIsConfirmingCascade] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [copiedLessonId, setCopiedLessonId] = useState<string | null>(null);
  const [editingLessonRecordingId, setEditingLessonRecordingId] = useState<string | null>(null);
  const [tempRec1, setTempRec1] = useState('');
  const [tempRec2, setTempRec2] = useState('');

  const groupStudents = students.filter(s => s.groupId === group.id);
  const cycleInfo = getGroupCycleInfo(group, lessons, language);

  const groupLessons = lessons
    .filter(l => l.groupId === group.id && l.status !== 'cancelled')
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

  const groupLessonsWithRecordings = groupLessons.filter(l => {
    const r1 = l.recordingLink?.trim() || l.report?.recordingLink?.trim();
    const r2 = l.recordingLink2?.trim() || l.report?.recordingLink2?.trim();
    return Boolean(r1 || r2);
  });

  const handleCopyLink = (lesson: Lesson, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLessonId(`${lesson.id}_${link}`);
    setTimeout(() => setCopiedLessonId(null), 2000);
  };

  const handleShareRecordingWhatsApp = (lesson: Lesson) => {
    const r1 = lesson.recordingLink?.trim() || lesson.report?.recordingLink?.trim();
    const r2 = lesson.recordingLink2?.trim() || lesson.report?.recordingLink2?.trim();
    
    let msg = `🎥 *تسجيل حصة ${group.name}*\n📅 التاريخ: ${lesson.date} (${lesson.time || ''})\n`;
    if (lesson.sessionNumber) {
      msg += `🔢 الحصة رقم: ${lesson.sessionNumber}\n`;
    }
    const topic = (lesson.report?.homeworkTitle || lesson.title || '').trim();
    if (topic) {
      msg += `📖 موضوع الحصة: ${topic}\n`;
    }
    msg += `\n`;

    if (r1 && r2) {
      msg += `🎥 *تسجيلات الحصة (جزئين):*\n• الجزء الأول: ${r1}\n• الجزء الثاني: ${r2}\n`;
    } else if (r1) {
      msg += `🎥 *رابط تسجيل الحصة:* ${r1}\n`;
    } else if (r2) {
      msg += `🎥 *رابط تسجيل الحصة:* ${r2}\n`;
    }

    if (group.whatsAppGroupLink) {
      window.open(group.whatsAppGroupLink, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const handleSaveLessonRecording = (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    const updatedReport = lesson.report ? {
      ...lesson.report,
      recordingLink: tempRec1.trim() || undefined,
      recordingLink2: tempRec2.trim() || undefined,
    } : undefined;

    updateLesson(lessonId, {
      recordingLink: tempRec1.trim() || undefined,
      recordingLink2: tempRec2.trim() || undefined,
      report: updatedReport
    });

    setEditingLessonRecordingId(null);
    confetti({ particleCount: 30, spread: 30 });
  };

  const handleSubmit = (data: GroupFormData) => {
    const isPerLesson = data.paymentCycle === 'per_lesson';
    const pricePerSession = Number(data.pricePerSession) || 0;
    const calcMonthlyPrice = isPerLesson 
      ? pricePerSession 
      : Number(data.monthlyPackagePrice);

    const schedules = data.scheduleDays.map(day => ({
      day,
      time: data.dayTimes[day] || data.scheduleTime || '17:00'
    }));

    const updatedGroupData = {
      ...group,
      name: data.name,
      grade: data.grade,
      type: data.type,
      paymentCycle: data.paymentCycle,
      paymentModel: isPerLesson ? 'per_session' : 'package',
      monthlyPackagePrice: calcMonthlyPrice,
      pricePerSession: isPerLesson ? pricePerSession : undefined,
      sessionCount: isPerLesson ? 1 : Number(data.sessionCount),
      startingSessionNumber: isPerLesson ? 1 : Number(data.startingSessionNumber),
      defaultFinanceAccountId: data.defaultFinanceAccountId,
      scheduleDays: data.scheduleDays,
      scheduleTime: data.scheduleTime,
      scheduleDayTimes: data.dayTimes,
      schedules,
      zoomLink: data.type === 'online' ? data.zoomLink : undefined,
      meetLink: data.type === 'online' ? data.meetLink : undefined,
      address: data.type === 'offline' ? data.address : undefined,
      color: data.color,
      lessonDurationMinutes: Number(data.lessonDurationMinutes),
      whatsAppGroupLink: data.whatsAppGroupLink.trim()
    };

    updateGroup(group.id, updatedGroupData);

    confetti({ particleCount: 50, spread: 40 });
    onClose();
  };

  return (
    <div
      role="dialog"
      data-modal="true"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      style={{ overscrollBehaviorY: 'contain' }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center pt-[max(24px,env(safe-area-inset-top,24px))] p-0 sm:p-4 pb-0 overscroll-contain"
    >
      <div
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-2xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh] overscroll-contain"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-hover p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-surface/20 rounded-xl shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold truncate">{group.name}</h2>
              <p className="text-xs text-primary-soft truncate mt-0.5 font-medium">
                {group.grade} • {groupStudents.length} {language === 'ar' ? 'طلاب' : language === 'de' ? 'Schüler' : 'Students'} • {!cycleInfo.isPerLesson ? cycleInfo.label : _t('محاسبة بالحصة', 'Per Session', 'Pro Sitzung')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface/20 rounded-full transition-colors cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Details vs Recordings) */}
        <div className="flex items-center border-b border-surface-border bg-surface px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 px-3 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'details'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{_t('بيانات وإعدادات المجموعة', 'Group Details & Edit', 'Gruppendaten')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recordings')}
            className={`pb-2.5 px-3 font-black text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'recordings'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>{_t('تسجيلات الحصص', 'Lesson Recordings', 'Aufnahmen')}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              groupLessonsWithRecordings.length > 0 
                ? 'bg-primary/10 text-primary font-bold' 
                : 'bg-slate-100 dark:bg-slate-800 text-text-muted'
            }`}>
              {groupLessonsWithRecordings.length}
            </span>
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {activeTab === 'details' ? (
            <GroupForm initialData={group} onSubmit={handleSubmit} isEdit={true}>
              {/* Students in group */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-surface-border mt-4">
                <p className="text-xs font-bold text-text-main">
                  Schüler in dieser Gruppe ({groupStudents.length}):
                </p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {groupStudents.map(s => (
                    <div key={s.id} className="p-2 bg-surface-hover rounded-xl text-xs flex justify-between font-semibold">
                      <span>{s.name}</span>
                      <span className="text-text-muted/70 font-mono">{s.parentPhone}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-surface-border dark:border-surface-border-soft mt-4">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(true)}
                  className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-4 py-3 rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-primary/20 shrink-0"
                >
                  <Send className="w-4 h-4 fill-white" />
                  <span>إرسال تذكير الحصة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-primary-soft text-red-600 dark:text-red-400 font-bold text-xs px-4 py-3 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-red-200 dark:border-red-800"
                  title="Gruppe löschen / archivieren"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Gruppe Löschen</span>
                </button>

                <button
                  type="submit"
                  form="group-form"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold text-xs py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer min-w-[140px]"
                >
                  <Save className="w-4 h-4" />
                  <span>Änderungen Speichern</span>
                </button>
              </div>
            </GroupForm>
          ) : (
            /* RECORDINGS TAB */
            <div className="space-y-4">
              {/* Quick Grain Launch Bar */}
              <div className="p-3 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-primary/10 border border-purple-200 dark:border-purple-900/40 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 bg-purple-600 text-white rounded-lg shadow-2xs shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-text-main truncate">
                      {_t('منصة التسجيلات الذكية Grain', 'Grain Video Recordings', 'Grain Video-Aufnahmen')}
                    </h4>
                    <p className="text-[10px] text-text-muted truncate">
                      {_t('الوصول المباشر لكافة تسجيلات حصص المجموعة', 'Direct access to all group session recordings', 'Direkter Zugriff auf alle Aufnahmen')}
                    </p>
                  </div>
                </div>

                <a
                  href="https://grain.com/app/meetings"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Grain</span>
                </a>
              </div>

              {/* List of Lessons */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-black text-text-muted">
                  <span>{_t(`حصص المجموعة (${groupLessons.length})`, `Group Sessions (${groupLessons.length})`, `Gruppensitzungen (${groupLessons.length})`)}</span>
                  <span className="text-[10px] text-primary font-bold">
                    {_t(`${groupLessonsWithRecordings.length} حصة بها تسجيل`, `${groupLessonsWithRecordings.length} recorded sessions`, `${groupLessonsWithRecordings.length} Aufnahmen`)}
                  </span>
                </div>

                {groupLessons.length === 0 ? (
                  <div className="p-6 text-center text-xs text-text-muted bg-surface-hover rounded-xl border border-surface-border">
                    <Video className="w-8 h-8 mx-auto mb-2 text-text-muted/40" />
                    <p className="font-bold">{_t('لا توجد حصص مسجلة لهذه المجموعة بعد', 'No sessions for this group yet', 'Noch keine Sitzungen vorhanden')}</p>
                  </div>
                ) : (
                  groupLessons.map((lesson) => {
                    const r1 = lesson.recordingLink?.trim() || lesson.report?.recordingLink?.trim();
                    const r2 = lesson.recordingLink2?.trim() || lesson.report?.recordingLink2?.trim();
                    const hasRecordings = Boolean(r1 || r2);
                    const isEditingThis = editingLessonRecordingId === lesson.id;

                    return (
                      <div
                        key={lesson.id}
                        className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                          hasRecordings 
                            ? 'bg-surface border-surface-border hover:border-primary/40 shadow-3xs' 
                            : 'bg-surface-hover/60 border-surface-border/60 opacity-90'
                        }`}
                      >
                        {/* Header: Date, Session Number, Title */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 bg-primary/10 text-primary font-black text-[10px] rounded-md shrink-0 font-mono">
                              {lesson.sessionNumber ? `حصة ${lesson.sessionNumber}` : `${lesson.date}`}
                            </span>
                            <span className="text-xs font-black text-text-main truncate">
                              {lesson.title || lesson.groupName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-text-muted font-bold font-mono">
                              {lesson.date} • {lesson.time}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditingThis) {
                                  setEditingLessonRecordingId(null);
                                } else {
                                  setEditingLessonRecordingId(lesson.id);
                                  setTempRec1(r1 || '');
                                  setTempRec2(r2 || '');
                                }
                              }}
                              className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-primary transition-colors cursor-pointer"
                              title={_t('تعديل روابط التسجيل', 'Edit Recording Links', 'Aufnahmelinks bearbeiten')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline editor if active */}
                        {isEditingThis && (
                          <div className="p-2.5 bg-primary-soft/30 dark:bg-primary-soft/10 rounded-lg border border-primary-border/40 space-y-2 animate-scale-up">
                            <div className="space-y-1.5">
                              <div>
                                <label className="text-[10px] font-black text-text-muted block mb-0.5">
                                  {_t('رابط التسجيل الأول (الجزء 1):', 'Recording Link (Part 1):', 'Aufnahmelink (Teil 1):')}
                                </label>
                                <input
                                  type="url"
                                  placeholder="https://grain.com/share/recording-1..."
                                  value={tempRec1}
                                  onChange={(e) => setTempRec1(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-text-muted block mb-0.5">
                                  {_t('رابط التسجيل الثاني (الجزء 2 - اختياري):', 'Recording Link (Part 2 - Optional):', 'Aufnahmelink (Teil 2 - Optional):')}
                                </label>
                                <input
                                  type="url"
                                  placeholder="https://grain.com/share/recording-2..."
                                  value={tempRec2}
                                  onChange={(e) => setTempRec2(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-surface border border-surface-border rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingLessonRecordingId(null)}
                                className="px-2.5 py-1 bg-surface hover:bg-surface-hover text-text-muted text-[11px] font-bold rounded-md border border-surface-border cursor-pointer"
                              >
                                {_t('إلغاء', 'Cancel', 'Abbrechen')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveLessonRecording(lesson.id)}
                                className="px-3 py-1 bg-primary hover:bg-primary-hover text-white text-[11px] font-black rounded-md shadow-2xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>{_t('حفظ الرابط', 'Save Link', 'Speichern')}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* What was taught summary */}
                        {(lesson.report?.homeworkTitle || lesson.whatWasTaught) && (
                          <p className="text-[11px] text-text-muted font-medium line-clamp-1">
                            <span className="font-bold text-text-main">{_t('ما تم شرحه: ', 'Topic: ', 'Thema: ')}</span>
                            {lesson.report?.homeworkTitle || lesson.whatWasTaught}
                          </p>
                        )}

                        {/* Recording Buttons */}
                        {hasRecordings ? (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-surface-border/60">
                            {r1 && (
                              <div className="inline-flex items-center gap-1 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50 rounded-lg p-1">
                                <a
                                  href={r1}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white font-black text-[11px] rounded-md transition-all flex items-center gap-1 shadow-2xs"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>{r2 ? _t('الجزء 1', 'Part 1', 'Teil 1') : _t('مشاهدة التسجيل', 'Watch Recording', 'Aufnahme ansehen')}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(lesson, r1)}
                                  className="p-1 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded cursor-pointer transition-colors"
                                  title={_t('نسخ رابط الجزء 1', 'Copy Part 1 Link', 'Link kopieren')}
                                >
                                  {copiedLessonId === `${lesson.id}_${r1}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {r2 && (
                              <div className="inline-flex items-center gap-1 bg-fuchsia-50 dark:bg-fuchsia-950/30 border border-fuchsia-200 dark:border-fuchsia-900/50 rounded-lg p-1">
                                <a
                                  href={r2}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-black text-[11px] rounded-md transition-all flex items-center gap-1 shadow-2xs"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>{_t('الجزء 2', 'Part 2', 'Teil 2')}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(lesson, r2)}
                                  className="p-1 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300 rounded cursor-pointer transition-colors"
                                  title={_t('نسخ رابط الجزء 2', 'Copy Part 2 Link', 'Link kopieren')}
                                >
                                  {copiedLessonId === `${lesson.id}_${r2}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* WhatsApp share */}
                            <button
                              type="button"
                              onClick={() => handleShareRecordingWhatsApp(lesson)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs ml-auto"
                              title={_t('مشاركة التسجيل على الواتساب', 'Share Recording on WhatsApp', 'Auf WhatsApp teilen')}
                            >
                              <Send className="w-3 h-3" />
                              <span>{_t('مشاركة', 'Share', 'Teilen')}</span>
                            </button>
                          </div>
                        ) : (
                          !isEditingThis && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLessonRecordingId(lesson.id);
                                setTempRec1('');
                                setTempRec2('');
                              }}
                              className="w-full py-1.5 text-center text-[11px] font-bold text-primary hover:bg-primary-soft rounded-lg border border-dashed border-primary-border/60 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{_t('إضافة رابط تسجيل لهذه الحصة', 'Add Recording Link', 'Aufnahmelink hinzufügen')}</span>
                            </button>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showReminderModal && (
        <LessonReminderModal
          group={group}
          onClose={() => setShowReminderModal(false)}
        />
      )}

      <DeleteConfirmModal
        isOpen={isConfirmingDelete}
        itemType="group"
        itemName={group.name}
        recordsSummary={{
          studentsCount: groupStudents.length,
          lessonsCount: lessons.filter(l => l.groupId === group.id).length,
          paymentsCount: payments.filter(p => p.groupId === group.id).length,
          attendanceCount: lessons.filter(l => l.groupId === group.id && l.report?.attendanceStatus).length,
        }}
        onConfirmDelete={() => {
          deleteGroup(group.id);
          setIsConfirmingDelete(false);
          onClose();
        }}
        onConfirmArchive={() => {
          archiveGroup(group.id);
          setIsConfirmingDelete(false);
          onClose();
        }}
        onConfirmCascadeDelete={() => {
          setIsConfirmingCascade(true);
          setIsConfirmingDelete(false);
        }}
        onClose={() => setIsConfirmingDelete(false)}
      />
      
      {isConfirmingCascade && (
        <CascadeDeleteGroupModal
          isOpen={true}
          groupId={group.id}
          groupName={group.name}
          onClose={() => setIsConfirmingCascade(false)}
          onSuccess={() => {
            setIsConfirmingCascade(false);
            onClose();
          }}
        />
      )}
    </div>
  );
};
