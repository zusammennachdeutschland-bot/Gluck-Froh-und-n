import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Bell, CheckCheck, Trash2, ArrowRight } from 'lucide-react';

interface NotificationsModalProps {
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ onClose }) => {
  const { notifications, lessons, openLessonControl, markNotificationRead, markAllNotificationsRead, clearAllNotifications, language, t } = useApp();

  
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center pt-[max(24px,env(safe-area-inset-top,24px))] p-0 sm:p-4 pb-0">
      <div onClick={(e) => e.stopPropagation()} className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-2xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-md shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[85vh]">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between gap-2 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-text-main">{t('notifications_title')}</h2>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                {t('auto_automatic_system_alerts')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-full cursor-pointer text-text-muted hover:text-text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Bar */}
        {notifications.length > 0 && (
          <div className="bg-surface-hover/80 px-4 py-3 border-b border-surface-border flex items-center justify-between text-xs shrink-0">
            <button
              onClick={markAllNotificationsRead}
              className="text-primary font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{t('auto_mark_all_as_read')}</span>
            </button>
            <button
              onClick={clearAllNotifications}
              className="text-red-500 font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('auto_clear_all')}</span>
            </button>
          </div>
        )}

        {/* List */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3 opacity-50" />
              <p className="text-sm font-bold text-text-muted">{t('auto_no_new_notifications')}</p>
            </div>
          ) : (
            notifications.map((n) => {
              const linkedLesson = n.lessonId ? lessons.find(l => l.id === n.lessonId) : null;
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    markNotificationRead(n.id);
                    if (linkedLesson) {
                      openLessonControl(linkedLesson);
                      onClose();
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    !n.read 
                       ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' 
                       : 'bg-surface hover:bg-surface-hover border-surface-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-xs font-bold text-text-main flex items-start gap-2">
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1"></span>}
                      <span>{n.title}</span>
                    </h4>
                    <span className="text-[10px] text-text-muted font-mono shrink-0 pt-0.5">{n.time}</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1.5 pl-4">{n.message}</p>
                  
                  {linkedLesson && (
                    <div className="mt-3 ml-4 pt-2 border-t border-surface-border/50 flex items-center justify-between text-[10px] font-bold text-primary">
                      <span className="uppercase tracking-wider">{t('auto_open_lesson')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
