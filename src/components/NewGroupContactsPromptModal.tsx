import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Group, Student } from '../types';
import { contactsSyncService } from '../services/contactsSyncService';
import { ContactAuditItem } from '../utils/contactsStandardizer';
import { 
  X, CheckCircle2, AlertTriangle, Smartphone, UserPlus, 
  RefreshCw, Check, ArrowRight, Download, Edit3, ShieldCheck, Sparkles 
} from 'lucide-react';

interface NewGroupContactsPromptModalProps {
  group: Group;
  students: Student[];
  onClose: () => void;
  onOpenFullUnification?: () => void;
}

export const NewGroupContactsPromptModal: React.FC<NewGroupContactsPromptModalProps> = ({
  group,
  students,
  onClose,
  onOpenFullUnification
}) => {
  const { _t } = useApp();

  const [loading, setLoading] = useState(true);
  const [missingInPhone, setMissingInPhone] = useState<Array<{
    student: Student;
    proposedName: string;
    phone: string;
    note?: string;
  }>>([]);
  const [needsUpdate, setNeedsUpdate] = useState<Array<{
    contact: any;
    item: ContactAuditItem;
    student: Student;
  }>>([]);
  const [alreadyStandardized, setAlreadyStandardized] = useState<Array<{
    contact: any;
    item: ContactAuditItem;
    student: Student;
  }>>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [createdPhones, setCreatedPhones] = useState<Set<string>>(new Set());
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());

  // Run initial roster audit
  const performAudit = async () => {
    setLoading(true);
    try {
      const res = await contactsSyncService.auditRosterContacts(students);
      setMissingInPhone(res.missingInPhone);
      setNeedsUpdate(res.needsUpdate);
      setAlreadyStandardized(res.alreadyStandardized);
    } catch (e) {
      console.error('Failed to audit roster contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performAudit();
  }, [students]);

  // Create single contact
  const handleCreateContact = async (item: { proposedName: string; phone: string; note?: string }) => {
    setIsProcessing(true);
    setStatusMessage(_t('جاري الحفظ في الهاتف...', 'Saving to phone...', 'Wird gespeichert...'));
    try {
      const res = await contactsSyncService.createContact({
        displayName: item.proposedName,
        phoneNumber: item.phone,
        note: item.note
      });
      if (res.success) {
        setCreatedPhones(prev => new Set(prev).add(item.phone));
        setStatusMessage(_t('تم حفظ جهة الاتصال بنجاح!', 'Contact saved successfully!', 'Kontakt erfolgreich gespeichert!'));
      } else {
        setStatusMessage(_t('تعذر الحفظ: ' + res.error, 'Could not save: ' + res.error, 'Fehler: ' + res.error));
      }
    } catch {
      setStatusMessage(_t('حدث خطأ أثناء الحفظ', 'Error saving contact', 'Fehler beim Speichern'));
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Batch create all missing contacts
  const handleBatchCreateAll = async () => {
    const uncreated = missingInPhone.filter(m => !createdPhones.has(m.phone));
    if (uncreated.length === 0) return;

    setIsProcessing(true);
    setStatusMessage(_t('جاري تسجيل جهات الاتصال في الهاتف...', 'Saving contacts to phone...', 'Kontakte werden gespeichert...'));
    try {
      const contactsToSave = uncreated.map(m => ({
        displayName: m.proposedName,
        phoneNumber: m.phone,
        note: m.note
      }));

      const res = await contactsSyncService.batchCreateContacts(contactsToSave);
      const newCreated = new Set(createdPhones);
      uncreated.forEach(m => newCreated.add(m.phone));
      setCreatedPhones(newCreated);

      setStatusMessage(
        _t(
          `تم تسجيل ${res.createdCount} جهة اتصال في الهاتف بنجاح!`,
          `Successfully saved ${res.createdCount} contact(s) to phone!`,
          `${res.createdCount} Kontakte erfolgreich gespeichert!`
        )
      );
    } catch {
      setStatusMessage(_t('حدث خطأ أثناء التسجيل الجماعي', 'Batch creation error', 'Fehler bei Sammelspeicherung'));
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Update existing contacts with standardized names
  const handleUpdateContact = async (item: ContactAuditItem) => {
    setIsProcessing(true);
    setStatusMessage(_t('جاري تعديل الاسم بالهاتف...', 'Updating contact name...', 'Name wird aktualisiert...'));
    try {
      const res = await contactsSyncService.executeUpdates([item]);
      if (res.updatedCount > 0) {
        setUpdatedIds(prev => new Set(prev).add(item.id));
        setStatusMessage(_t('تم توحيد اسم جهة الاتصال بالهاتف!', 'Contact name updated!', 'Kontaktname aktualisiert!'));
      }
    } catch {
      setStatusMessage(_t('حدث خطأ أثناء تعديل الاسم', 'Error updating name', 'Fehler beim Aktualisieren'));
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Batch update all contacts that need standardization
  const handleBatchUpdateAll = async () => {
    const unupdated = needsUpdate.filter(n => !updatedIds.has(n.item.id)).map(n => n.item);
    if (unupdated.length === 0) return;

    setIsProcessing(true);
    setStatusMessage(_t('جاري توحيد وتعديل الأسماء بالهاتف...', 'Standardizing contact names...', 'Namen werden vereinheitlicht...'));
    try {
      const res = await contactsSyncService.executeUpdates(unupdated);
      const newUpdated = new Set(updatedIds);
      unupdated.forEach(u => newUpdated.add(u.id));
      setUpdatedIds(newUpdated);

      setStatusMessage(
        _t(
          `تم توحيد ${res.updatedCount} اسم جهة اتصال في الهاتف بنجاح!`,
          `Successfully standardized ${res.updatedCount} contact(s)!`,
          `${res.updatedCount} Kontaktnamen vereinheitlicht!`
        )
      );
    } catch {
      setStatusMessage(_t('حدث خطأ أثناء التحديث', 'Update error', 'Fehler beim Aktualisieren'));
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Export .vcf file
  const handleDownloadVcf = () => {
    const contactsToExport = missingInPhone.map(m => ({
      displayName: m.proposedName,
      phoneNumber: m.phone,
      note: m.note
    }));
    contactsSyncService.downloadVcf(`Contacts_${group.name}`, contactsToExport);
  };

  const totalActionable = (missingInPhone.length - createdPhones.size) + (needsUpdate.length - updatedIds.size);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        onClick={e => e.stopPropagation()} 
        className="bg-surface border border-surface-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">
                {_t('جهات اتصال المجموعة الجديدة', 'New Group Contacts', 'Kontakte der neuen Gruppe')}
              </h3>
              <p className="text-[11px] text-emerald-100/90 truncate max-w-xs sm:max-w-md">
                {group.name} • {students.length} {_t('طلاب', 'students', 'Schüler')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-bold flex items-center gap-2 shrink-0 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 text-center text-text-muted flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
              <p className="text-xs font-bold">
                {_t('جاري فحص جهات الاتصال في هاتفك...', 'Checking phone contacts...', 'Kontakte auf dem Telefon werden geprüft...')}
              </p>
            </div>
          ) : (
            <>
              {/* Informational Banner */}
              <div className="p-3.5 rounded-xl bg-surface-hover/70 border border-surface-border text-xs text-text-muted flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-text-main block">
                    {_t('تم حفظ المجموعة بنجاح!', 'Group created successfully!', 'Gruppe erfolgreich erstellt!')}
                  </span>
                  <span>
                    {_t(
                      'يقوم التطبيق بفحص أرقام هواتف الطلاب في هاتفك لتسجيل غير المحفوظ منها، أو تنبيهك إذا كانت موجودة بالهاتف ولكن باسم غير موحد.',
                      'The system checks student numbers on your phone to register missing contacts or notify you if an existing contact needs name standardization.',
                      'Das System prüft Kontakte auf Ihrem Telefon, um fehlende hinzuzufügen oder abweichende Namen zu vereinheitlichen.'
                    )}
                  </span>
                </div>
              </div>

              {/* SECTION 1: Missing from phone (Need to be registered) */}
              {missingInPhone.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <h4 className="font-bold text-xs sm:text-sm text-text-main">
                        {_t('طلاب غير مسجلين في جهات اتصال الهاتف', 'Students not registered in phone contacts', 'Nicht auf dem Telefon gespeichert')}
                      </h4>
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                        {missingInPhone.length - createdPhones.size}
                      </span>
                    </div>

                    {missingInPhone.length - createdPhones.size > 1 && (
                      <button
                        onClick={handleBatchCreateAll}
                        disabled={isProcessing}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>{_t('تسجيل الكل بالهاتف', 'Save all to phone', 'Alle speichern')}</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {missingInPhone.map((item, idx) => {
                      const isCreated = createdPhones.has(item.phone);
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            isCreated 
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40' 
                              : 'bg-surface border-surface-border shadow-2xs'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-text-main truncate">
                              {item.student.name}
                            </div>
                            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {_t('الاسم المقترح بالهاتف:', 'Proposed contact name:', 'Vorgeschlagener Name:')} {item.proposedName}
                            </div>
                            <div className="text-[11px] text-text-muted font-mono mt-0.5">
                              {item.phone}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {isCreated ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/40 px-2.5 py-1 rounded-lg">
                                <Check className="w-3.5 h-3.5" />
                                <span>{_t('تم التسجيل بالهاتف', 'Saved in phone', 'Gespeichert')}</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleCreateContact(item)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>{_t('تسجيل في الهاتف', 'Save to phone', 'Auf Telefon speichern')}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 2: Existing in phone but needs name standardization */}
              {needsUpdate.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-surface-border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <h4 className="font-bold text-xs sm:text-sm text-text-main">
                        {_t('جهات اتصال موجودة بالهاتف وتحتاج لتعديل الاسم', 'Existing contacts needing name update', 'Kontakte müssen aktualisiert werden')}
                      </h4>
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                        {needsUpdate.length - updatedIds.size}
                      </span>
                    </div>

                    {needsUpdate.length - updatedIds.size > 1 && (
                      <button
                        onClick={handleBatchUpdateAll}
                        disabled={isProcessing}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{_t('تعديل الكل بالهاتف', 'Update all names', 'Alle aktualisieren')}</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {needsUpdate.map((item, idx) => {
                      const isUpdated = updatedIds.has(item.item.id);
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            isUpdated 
                              ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40' 
                              : 'bg-surface border-surface-border shadow-2xs'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="line-through text-text-muted truncate max-w-[130px]">
                                {item.item.currentName}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0 rtl:rotate-180" />
                              <span className="font-bold text-blue-700 dark:text-blue-400 truncate">
                                {item.item.proposedName}
                              </span>
                            </div>
                            <div className="text-[11px] text-text-muted font-mono mt-1">
                              {item.item.phone} • {item.student.name}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {isUpdated ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/40 px-2.5 py-1 rounded-lg">
                                <Check className="w-3.5 h-3.5" />
                                <span>{_t('تم تعديل الاسم', 'Name updated', 'Aktualisiert')}</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleUpdateContact(item.item)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{_t('تعديل الاسم بالهاتف', 'Update name', 'Name aktualisieren')}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 3: Already Standardized */}
              {alreadyStandardized.length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {_t(
                      `يوجد ${alreadyStandardized.length} جهة اتصال مسجلة ومطابقة للصيغة الموحدة بالفعل في هاتفك.`,
                      `${alreadyStandardized.length} contact(s) are already registered and standardized on your phone.`,
                      `${alreadyStandardized.length} Kontakte sind bereits standardisiert auf dem Telefon.`
                    )}
                  </span>
                </div>
              )}

              {/* When all contacts are all set */}
              {missingInPhone.length === 0 && needsUpdate.length === 0 && (
                <div className="py-8 text-center text-text-muted flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  <p className="text-sm font-bold text-text-main">
                    {_t(
                      'جميع جهات اتصال هذه المجموعة مسجلة ومطابقة في هاتفك تماماً!',
                      'All group contacts are already registered and standardized!',
                      'Alle Kontakte dieser Gruppe sind bereits standardisiert!'
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-background border-t border-surface-border flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {missingInPhone.length > 0 && (
              <button
                onClick={handleDownloadVcf}
                className="px-3 py-2 rounded-xl border border-surface-border text-text-main font-bold text-xs hover:bg-surface-hover transition-colors flex items-center gap-1.5 cursor-pointer"
                title={_t('تصدير كملف جهات اتصال VCF', 'Export as VCF file', 'Als VCF exportieren')}
              >
                <Download className="w-3.5 h-3.5 text-text-muted" />
                <span className="hidden sm:inline">{_t('تصدير VCF', 'Export VCF', 'VCF Export')}</span>
              </button>
            )}

            {onOpenFullUnification && (
              <button
                onClick={() => {
                  onClose();
                  onOpenFullUnification();
                }}
                className="text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                {_t('فتح مركز التوحيد الشامل', 'Open Unification Center', 'Vollständiges Center öffnen')}
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-text-main font-bold text-xs transition-colors cursor-pointer"
          >
            {totalActionable === 0 
              ? _t('إغلاق', 'Done', 'Fertig') 
              : _t('تخطي والإنهاء', 'Skip and Finish', 'Überspringen')}
          </button>
        </div>

      </div>
    </div>
  );
};
