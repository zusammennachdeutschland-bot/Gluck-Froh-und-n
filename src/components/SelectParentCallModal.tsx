import React from 'react';
import { Student } from '../types';
import { Phone, MessageCircle, X, User } from 'lucide-react';
import { buildWhatsAppUrl, cleanPhoneNumberForTel, formatContactDisplay } from '../utils/phoneUtils';

interface SelectParentCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  students: Student[];
  _t: (ar: string, en: string, de: string) => string;
}

export const SelectParentCallModal: React.FC<SelectParentCallModalProps> = ({
  isOpen,
  onClose,
  title,
  students,
  _t
}) => {
  if (!isOpen) return null;

  const handleCall = (phone?: string) => {
    if (!phone) return;
    const clean = cleanPhoneNumberForTel(phone);
    if (clean) {
      window.open(`tel:${clean}`, '_self');
    }
  };

  const handleWhatsApp = (phone?: string) => {
    const url = buildWhatsAppUrl(phone);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-surface border border-surface-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-primary-soft/30">
          <div className="flex items-center gap-2 min-w-0">
            <Phone className="w-4 h-4 text-primary shrink-0" />
            <h3 className="text-sm font-black text-text-main truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content - Student Contacts List */}
        <div className="p-3 overflow-y-auto space-y-2 divide-y divide-surface-border/50">
          {students.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">
              {_t('لا يوجد طلاب مسجلون في هذه المجموعة', 'No students registered in this group', 'Keine Schüler in dieser Gruppe')}
            </p>
          ) : (
            students.map((st) => {
              const primaryPhone = st.parentPhone || st.phone;
              const displayPhone = primaryPhone ? formatContactDisplay(primaryPhone) : '';

              return (
                <div key={st.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary shrink-0" />
                      <h4 className="text-xs font-bold text-text-main truncate">
                        {st.name}
                      </h4>
                    </div>
                    {st.parentName && (
                      <p className="text-[11px] text-text-muted truncate mt-0.5">
                        {_t(`ولي الأمر: ${st.parentName}`, `Parent: ${st.parentName}`, `Elternteil: ${st.parentName}`)}
                      </p>
                    )}
                    {displayPhone ? (
                      <p className="text-[11px] font-mono font-medium text-primary dir-ltr text-right truncate mt-0.5">
                        {displayPhone}
                      </p>
                    ) : (
                      <p className="text-[10.5px] text-rose-500 italic mt-0.5">
                        {_t('لا يوجد رقم هاتف', 'No phone number', 'Keine Telefonnummer')}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!primaryPhone}
                      onClick={() => handleCall(primaryPhone)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                      title={_t('اتصال بولي الأمر', 'Call Parent', 'Anrufen')}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{_t('اتصال', 'Call', 'Anrufen')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWhatsApp(primaryPhone)}
                      className="p-1.5 rounded-lg bg-surface hover:bg-primary-soft text-text-muted hover:text-primary border border-surface-border hover:border-primary-border transition-all cursor-pointer active:scale-95"
                      title={_t('واتساب', 'WhatsApp', 'WhatsApp')}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-hover/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold rounded-xl border border-surface-border text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            {_t('إغلاق', 'Close', 'Schließen')}
          </button>
        </div>
      </div>
    </div>
  );
};
