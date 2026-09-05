import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Group } from '../types';
import { X, Users, Trash2, Send, Save } from 'lucide-react';
import confetti from 'canvas-confetti';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CascadeDeleteGroupModal } from './CascadeDeleteGroupModal';
import { LessonReminderModal } from './LessonReminderModal';
import { GroupForm, GroupFormData } from './GroupForm';

interface GroupProfileModalProps {
  group: Group;
  onClose: () => void;
}

export const GroupProfileModal: React.FC<GroupProfileModalProps> = ({ group, onClose }) => {
  const { updateGroup, deleteGroup, archiveGroup, generateGroupScheduleLessons, students, lessons, payments, language, t } = useApp();

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isConfirmingCascade, setIsConfirmingCascade] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const groupStudents = students.filter(s => s.groupId === group.id);

  const handleSubmit = (data: GroupFormData) => {
    const calcMonthlyPrice = data.paymentCycle === 'per_lesson' 
      ? Number(data.pricePerSession) * (data.sessionCount || 8)
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
      monthlyPackagePrice: calcMonthlyPrice,
      pricePerSession: data.paymentCycle === 'per_lesson' ? Number(data.pricePerSession) : undefined,
      sessionCount: data.paymentCycle === 'monthly' ? Number(data.sessionCount) : 8,
      startingSessionNumber: Number(data.startingSessionNumber),
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
        className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-md shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh] overscroll-contain"
      >
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-hover p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-surface/20 rounded-xl">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">{group.name}</h2>
              <p className="text-xs text-primary-soft">{group.grade} • {groupStudents.length} Schüler</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface/20 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body via GroupForm */}
        <div className="overflow-y-auto">
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-3 rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-600/20 shrink-0"
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
