import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  contactsSyncService, 
  RawDeviceContact 
} from '../services/contactsSyncService';
import { 
  ExternalContactRecord, 
  MatchedExternalContactItem,
  ExternalEditorAuditResult,
  generateExternalEditorPrompt,
  generateReturnTemplateSample,
  parseExternalInput,
  matchExternalRecords,
  saveRollbackSnapshot,
  getLatestRollbackSnapshot,
  RollbackSnapshot
} from '../utils/externalContactEditorUtils';
import { 
  X, Copy, Check, Sparkles, Upload, FileText, Smartphone, 
  CheckSquare, Square, RefreshCw, AlertTriangle, ShieldCheck, Undo2, ArrowRight, ArrowLeft
} from 'lucide-react';

interface ExternalContactEditorModalProps {
  onClose: () => void;
}

type StepType = 'export_import' | 'review' | 'success';
type FilterTab = 'all' | 'matched' | 'ambiguous' | 'unmatched' | 'invalid';

export const ExternalContactEditorModal: React.FC<ExternalContactEditorModalProps> = ({ onClose }) => {
  const { language, _t, students } = useApp();
  const isRtl = language === 'ar';

  const [step, setStep] = useState<StepType>('export_import');
  const [rawInputText, setRawInputText] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<RawDeviceContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [auditResult, setAuditResult] = useState<ExternalEditorAuditResult | null>(null);
  
  const [activeTab, setActiveTab] = useState<FilterTab>('matched');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Execution & Undo states
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionReport, setExecutionReport] = useState<{ updatedCount: number; errors: string[] } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadContacts = async () => {
      setLoadingContacts(true);
      try {
        const contacts = await contactsSyncService.fetchRawContacts(students);
        setDeviceContacts(contacts);
      } catch (e) {
        console.error('Failed to load contacts for external editor:', e);
      } finally {
        setLoadingContacts(false);
      }

      const latest = getLatestRollbackSnapshot();
      if (latest) {
        setCanUndo(true);
      }
    };
    loadContacts();
  }, [students]);

  const handleCopyPrompt = () => {
    const promptText = generateExternalEditorPrompt();
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyTemplate = () => {
    const templateText = generateReturnTemplateSample();
    navigator.clipboard.writeText(templateText);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (content) {
          setRawInputText(content);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleProcessAndMatch = () => {
    if (!rawInputText.trim()) return;
    const records = parseExternalInput(rawInputText);
    if (records.length === 0) {
      alert(_t('لم يتم العثور على بيانات صالحة في النص المدخل.', 'No valid records found in input.', 'Keine gültigen Datensätze gefunden.'));
      return;
    }

    const result = matchExternalRecords(records, deviceContacts);
    setAuditResult(result);
    setStep('review');
  };

  const toggleSelectRecord = (id: string) => {
    if (!auditResult) return;
    const updated = auditResult.items.map(item => {
      if (item.id === id) {
        return { ...item, isRecordSelected: !item.isRecordSelected };
      }
      return item;
    });
    setAuditResult({ ...auditResult, items: updated });
  };

  const toggleFieldApproval = (id: string, field: 'acceptName' | 'acceptCompany' | 'acceptJobTitle' | 'acceptNotes') => {
    if (!auditResult) return;
    const updated = auditResult.items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: !item[field] };
      }
      return item;
    });
    setAuditResult({ ...auditResult, items: updated });
  };

  const handleSelectAll = (select: boolean) => {
    if (!auditResult) return;
    const updated = auditResult.items.map(item => ({
      ...item,
      isRecordSelected: select && item.matchStatus !== 'INVALID'
    }));
    setAuditResult({ ...auditResult, items: updated });
  };

  const filteredItems = useMemo(() => {
    if (!auditResult) return [];
    let items = auditResult.items;

    if (activeTab === 'matched') {
      items = items.filter(i => i.matchStatus === 'MATCHED');
    } else if (activeTab === 'ambiguous') {
      items = items.filter(i => i.matchStatus === 'AMBIGUOUS');
    } else if (activeTab === 'unmatched') {
      items = items.filter(i => i.matchStatus === 'UNMATCHED');
    } else if (activeTab === 'invalid') {
      items = items.filter(i => i.matchStatus === 'INVALID' || i.matchStatus === 'CONFLICT');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(i => 
        i.originalName.toLowerCase().includes(q) ||
        i.proposedName.toLowerCase().includes(q) ||
        i.phoneNumbers.some(p => p.includes(q))
      );
    }

    return items;
  }, [auditResult, activeTab, searchQuery]);

  const selectedCount = useMemo(() => {
    return auditResult?.items.filter(i => i.isRecordSelected && (i.matchStatus === 'MATCHED' || i.matchStatus === 'AMBIGUOUS')).length || 0;
  }, [auditResult]);

  const handleApplyApprovedChanges = async () => {
    if (!auditResult) return;
    const approvedItems = auditResult.items.filter(
      i => i.isRecordSelected && (i.matchStatus === 'MATCHED' || i.matchStatus === 'AMBIGUOUS') && i.matchedDeviceContact
    );

    if (approvedItems.length === 0) {
      alert(_t('الرجاء تحديد جهات اتصال مقبولة للتحديث.', 'Please select approved contacts to update.', 'Bitte Kontakte auswählen.'));
      return;
    }

    setIsExecuting(true);

    const previousContactsSnapshot = approvedItems.map(item => ({
      id: item.matchedDeviceContact!.id,
      displayName: item.matchedDeviceContact!.displayName,
      company: item.matchedDeviceContact!.accountType,
      jobTitle: item.matchedDeviceContact!.accountName,
      note: item.matchedDeviceContact!.note
    }));

    saveRollbackSnapshot({
      timestamp: Date.now(),
      previousContacts: previousContactsSnapshot
    });

    const updatesToExecute = approvedItems.map(item => {
      const contact = item.matchedDeviceContact!;
      return {
        id: contact.id,
        currentName: contact.displayName,
        proposedName: item.acceptName ? item.proposedName : contact.displayName,
        suggestedNote: item.acceptNotes ? item.proposedNotes : contact.note,
        company: item.acceptCompany ? item.proposedCompany : contact.accountType,
        jobTitle: item.acceptJobTitle ? item.proposedJobTitle : contact.accountName,
        phone: contact.phoneNumbers?.[0]?.number || ''
      };
    });

    try {
      const res = await contactsSyncService.executeUpdates(
        updatesToExecute.map(u => ({
          id: u.id,
          currentName: u.currentName,
          proposedName: u.proposedName,
          suggestedNote: u.suggestedNote,
          phone: u.phone,
          normalizedPhone: '',
          isGoogleAccount: false,
          isReadOnly: false,
          status: 'NEEDS_UPDATE' as const,
          statusLabelAr: '',
          statusLabelDe: '',
          statusDescriptionAr: '',
          students: [],
          selectedForUpdate: true
        }))
      );

      setExecutionReport({
        updatedCount: res.updatedCount,
        errors: res.errors
      });
      setCanUndo(true);
      setStep('success');
    } catch (e: any) {
      setExecutionReport({
        updatedCount: 0,
        errors: [e?.message || 'Execution error']
      });
      setStep('success');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUndoLastUpdate = async () => {
    const latest = getLatestRollbackSnapshot();
    if (!latest) {
      alert(_t('لا توجد نقطة تراجع متاحة.', 'No rollback point available.', 'Kein Wiederherstellungspunkt.'));
      return;
    }

    setIsExecuting(true);
    try {
      const revertItems = latest.previousContacts.map(c => ({
        id: c.id,
        currentName: c.displayName,
        proposedName: c.displayName,
        suggestedNote: c.note,
        phone: '',
        normalizedPhone: '',
        isGoogleAccount: false,
        isReadOnly: false,
        status: 'NEEDS_UPDATE' as const,
        statusLabelAr: '',
        statusLabelDe: '',
        statusDescriptionAr: '',
        students: [],
        selectedForUpdate: true
      }));

      await contactsSyncService.executeUpdates(revertItems);
      setUndoMessage(_t('تم التراجع عن التحديثات بنجاح واستعادة البيانات السابقة.', 'Successfully rolled back updates and restored previous contacts.', 'Erfolgreich zurückgesetzt.'));
      setCanUndo(false);
      localStorage.removeItem('glueck_contacts_rollback_history');
    } catch (e: any) {
      alert('Undo failed: ' + (e?.message || e));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-5xl max-h-[90dvh] bg-surface rounded-2xl shadow-2xl border border-surface-border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-surface-border bg-surface-hover/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-text-main leading-tight">
                {_t('محرر جهات الاتصال الخارجي للذكاء الاصطناعي', 'External AI Contact Editor', 'Externer KI-Kontakte-Editor')}
              </h3>
              <p className="text-[11px] text-text-muted">
                {_t('تصدير، معالجة خارجية آمنة، ومطابقة محلية لجهات الاتصال', 'Export, secure external AI processing, and local matching', 'Sichere externe KI-Verarbeitung')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canUndo && step === 'export_import' && (
              <button
                onClick={handleUndoLastUpdate}
                disabled={isExecuting}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 transition-all flex items-center gap-1 cursor-pointer"
                title={_t('التراجع عن آخر عملية تحديث', 'Undo last update', 'Letzte Änderung rückgängig machen')}
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>{_t('تراجع (Undo)', 'Undo', 'Rückgängig')}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover border border-surface-border transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body based on step */}
        {step === 'export_import' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {undoMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{undoMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-surface-border bg-surface-hover/20 flex flex-col justify-between gap-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-text-main flex items-center gap-1.5 mb-1">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>{_t('الخطوة 1: نسخ التعليمات (Prompt)', 'Step 1: Copy Prompt', 'Schritt 1: Prompt kopieren')}</span>
                  </h4>
                  <p className="text-[11px] text-text-muted">
                    {_t(
                      'انسخ التعليمات وقواعد التسمية لنقلها لأي نموذج ذكاء اصطناعي خارجي.',
                      'Copy prompt and naming rules for external AI processing.',
                      'Prompt und Namensregeln für externe KI kopieren.'
                    )}
                  </p>
                </div>
                <button
                  onClick={handleCopyPrompt}
                  className="w-full py-2 px-3 rounded-xl bg-surface border border-primary/30 hover:bg-primary/10 text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  {copiedPrompt ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPrompt ? _t('تم النسخ بنجاح!', 'Copied Successfully!', 'Kopiert!') : _t('نسخ موجه الذكاء الاصطناعي (Copy Prompt)', 'Copy AI Prompt', 'Prompt kopieren')}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-surface-border bg-surface-hover/20 flex flex-col justify-between gap-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-text-main flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>{_t('قالب الإرجاع الهيكلي (JSON Template)', 'Step 2: Copy Return Template', 'Schritt 2: JSON-Vorlage')}</span>
                  </h4>
                  <p className="text-[11px] text-text-muted">
                    {_t(
                      'انسخ قالب الاستجابة ليقوم الذكاء الاصطناعي بإعادة البيانات بنفس الهيكل المنظم.',
                      'Copy structure template for AI return response.',
                      'Antwort-Vorlage für die KI kopieren.'
                    )}
                  </p>
                </div>
                <button
                  onClick={handleCopyTemplate}
                  className="w-full py-2 px-3 rounded-xl bg-surface border border-surface-border hover:bg-surface-hover text-text-main font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  {copiedTemplate ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedTemplate ? _t('تم النسخ بنجاح!', 'Copied Successfully!', 'Kopiert!') : _t('نسخ قالب الاستجابة (Copy Template)', 'Copy Return Template', 'Vorlage kopieren')}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-text-main flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-primary" />
                  <span>{_t('الخطوة 3: لصق البيانات المعدلة أو استيراد ملف JSON / CSV', 'Step 3: Paste Edited Data or Import File', 'Schritt 3: Daten einfügen oder Datei importieren')}</span>
                </label>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json,.csv,.txt"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 rounded-lg bg-surface-hover border border-surface-border text-xs font-bold text-text-main hover:bg-surface-hover/80 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    <span>{_t('رفع ملف (Upload File)', 'Upload File', 'Datei hochladen')}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={rawInputText}
                onChange={e => setRawInputText(e.target.value)}
                placeholder={_t(
                  'الصق هنا مصفوفة JSON أو محتوى ملف CSV المستلم من الذكاء الاصطناعي...',
                  'Paste JSON array or CSV data returned from external AI here...',
                  'JSON-Array oder CSV hier einfügen...'
                )}
                className="w-full h-48 p-3 rounded-xl bg-surface-hover/50 border border-surface-border text-xs font-mono text-text-main placeholder:text-text-muted focus:outline-hidden focus:border-primary resize-none"
              />
            </div>
          </div>
        )}

        {step === 'review' && auditResult && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 flex flex-col min-h-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
              <div 
                onClick={() => setActiveTab('matched')}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'matched' ? 'bg-primary-soft border-primary-border shadow-xs' : 'bg-surface border-surface-border'
                }`}
              >
                <div className="text-base font-black text-primary">{auditResult.matchedCount}</div>
                <div className="text-[10px] font-bold text-text-muted">{_t('مطابق وجاهز', 'Matched & Ready', 'Übereinstimmend')}</div>
              </div>

              <div 
                onClick={() => setActiveTab('ambiguous')}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'ambiguous' ? 'bg-purple-500/15 border-purple-500/30 shadow-xs' : 'bg-surface border-surface-border'
                }`}
              >
                <div className="text-base font-black text-purple-600 dark:text-purple-400">{auditResult.ambiguousCount}</div>
                <div className="text-[10px] font-bold text-text-muted">{_t('مشترك / غامض', 'Ambiguous', 'Mehrdeutig')}</div>
              </div>

              <div 
                onClick={() => setActiveTab('unmatched')}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'unmatched' ? 'bg-amber-500/15 border-amber-500/30 shadow-xs' : 'bg-surface border-surface-border'
                }`}
              >
                <div className="text-base font-black text-amber-600 dark:text-amber-400">{auditResult.unmatchedCount}</div>
                <div className="text-[10px] font-bold text-text-muted">{_t('غير مطابق بالهاتف', 'Unmatched', 'Nicht gefunden')}</div>
              </div>

              <div 
                onClick={() => setActiveTab('invalid')}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'invalid' ? 'bg-red-500/15 border-red-500/30 shadow-xs' : 'bg-surface border-surface-border'
                }`}
              >
                <div className="text-base font-black text-red-600 dark:text-red-400">{auditResult.invalidCount}</div>
                <div className="text-[10px] font-bold text-text-muted">{_t('غير صالح', 'Invalid', 'Ungültig')}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-surface-hover/30 p-3 rounded-xl border border-surface-border shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectAll(true)}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  {_t('تحديد الكل', 'Select All', 'Alle auswählen')}
                </button>
                <span className="text-text-muted">|</span>
                <button
                  onClick={() => handleSelectAll(false)}
                  className="text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                >
                  {_t('إلغاء التحديد', 'Deselect All', 'Keine')}
                </button>
                <span className="text-text-muted font-mono text-xs ms-2">({selectedCount} محدد للتطبيق)</span>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={_t('بحث في النتائج...', 'Search results...', 'Ergebnisse durchsuchen...')}
                className="w-full sm:w-56 px-3 py-1 bg-surface border border-surface-border rounded-lg text-xs text-text-main placeholder:text-text-muted focus:outline-hidden focus:border-primary"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              {filteredItems.length === 0 ? (
                <div className="py-16 text-center text-text-muted text-xs font-bold">
                  {_t('لا توجد عناصر مطابقة لهذا التصنيف.', 'No items under this filter.', 'Keine Elemente.')}
                </div>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      item.isRecordSelected 
                        ? 'bg-primary-soft/30 border-primary/40 shadow-xs' 
                        : 'bg-surface border-surface-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        disabled={item.matchStatus === 'INVALID'}
                        onClick={() => toggleSelectRecord(item.id)}
                        className="mt-1 text-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      >
                        {item.isRecordSelected ? (
                          <CheckSquare className="w-5 h-5 fill-primary text-white" />
                        ) : (
                          <Square className="w-5 h-5 text-text-muted" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.matchStatus === 'MATCHED' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              {_t('مطابق للاتصال', 'Matched Contact', 'Verbunden')}
                            </span>
                          )}
                          {item.matchStatus === 'AMBIGUOUS' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                              {_t('رقم مشترك (غامض)', 'Ambiguous Phone', 'Mehrdeutige Nummer')}
                            </span>
                          )}
                          {item.matchStatus === 'UNMATCHED' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              {_t('غير مسجل بالهاتف', 'Unmatched Phone', 'Nicht im Telefon')}
                            </span>
                          )}
                          {item.matchStatus === 'INVALID' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                              {_t('بيانات غير صالحة', 'Invalid Data', 'Ungültige Daten')}
                            </span>
                          )}

                          <span className="text-[11px] font-mono text-text-muted flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            {item.phoneNumbers.join(', ')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-surface-hover/40 border border-surface-border space-y-1">
                            <span className="text-[10px] font-bold text-text-muted block">
                              {_t('القيم الحالية بالهاتف:', 'Current Values:', 'Aktuelle Werte:')}
                            </span>
                            <div className="font-semibold text-text-main line-through decoration-red-400">
                              {item.originalName}
                            </div>
                            {item.currentCompany && <div className="text-[11px] text-text-muted">الشركة: {item.currentCompany}</div>}
                            {item.currentJobTitle && <div className="text-[11px] text-text-muted">المسمى: {item.currentJobTitle}</div>}
                          </div>

                          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">
                              {_t('القيم المقترحة من الذكاء الاصطناعي:', 'Proposed AI Values:', 'Vorgeschlagene Werte:')}
                            </span>
                            
                            <div className="flex items-center justify-between">
                              <span className="font-black text-emerald-700 dark:text-emerald-300">
                                {item.proposedName}
                              </span>
                              <button
                                onClick={() => toggleFieldApproval(item.id, 'acceptName')}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                                  item.acceptName ? 'bg-emerald-600 text-white' : 'bg-surface-hover text-text-muted'
                                }`}
                              >
                                {item.acceptName ? 'قبول الاسم' : 'تخطي'}
                              </button>
                            </div>

                            {item.proposedNotes && (
                              <div className="text-[10px] text-text-muted italic truncate">
                                📝 {item.proposedNotes}
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-text-muted">
                          ℹ️ {item.matchReason}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flex-1 overflow-y-auto p-6 text-center space-y-4 flex flex-col items-center justify-center">
            <ShieldCheck className="w-12 h-12 text-emerald-500" />
            <h4 className="text-base font-black text-text-main">
              {_t('تم تطبيق التحديثات المقبولة بنجاح!', 'Successfully applied approved contact updates!', 'Erfolgreich aktualisiert!')}
            </h4>
            {executionReport && (
              <p className="text-xs text-text-muted">
                {_t(`تم تحديث ${executionReport.updatedCount} جهة اتصال محددة.`, `Updated ${executionReport.updatedCount} contacts.`, `${executionReport.updatedCount} Kontakte aktualisiert.`)}
              </p>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover cursor-pointer shadow-md"
            >
              {_t('إغلاق', 'Close', 'Schließen')}
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-4 py-2.5 sm:px-6 border-t border-surface-border bg-surface flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              if (step === 'review') setStep('export_import');
              else onClose();
            }}
            disabled={isExecuting}
            className="px-3.5 py-2 rounded-xl border border-surface-border text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-all cursor-pointer flex items-center gap-1.5"
          >
            {step === 'review' ? (
              <>
                {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                <span>{_t('العودة للتعليمات', 'Back to Instructions', 'Zurück')}</span>
              </>
            ) : (
              <span>{_t('إغلاق', 'Close', 'Schließen')}</span>
            )}
          </button>

          {step === 'export_import' && (
            <button
              onClick={handleProcessAndMatch}
              disabled={!rawInputText.trim() || loadingContacts}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loadingContacts ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{_t('معالجة ومطابقة البيانات (Process & Match)', 'Process & Match Data', 'Daten verarbeiten')}</span>
            </button>
          )}

          {step === 'review' && (
            <button
              onClick={handleApplyApprovedChanges}
              disabled={isExecuting || selectedCount === 0}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{_t(`تطبيق التغييرات المقبولة (${selectedCount})`, `Apply Approved (${selectedCount})`, `Änderungen anwenden (${selectedCount})`)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
