import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Student } from '../types';
import { 
  contactsSyncService, 
  ContactsAuditResult 
} from '../services/contactsSyncService';
import { ContactAuditItem } from '../utils/contactsStandardizer';
import { 
  X, CheckCircle2, AlertTriangle, RefreshCw, Smartphone, 
  Search, ShieldCheck, CheckSquare, Square, 
  Users, Copy, Check, Info, Sparkles, Edit3, Settings,
  UserPlus, Download, ExternalLink
} from 'lucide-react';

interface ContactsUnificationModalProps {
  onClose: () => void;
}

type TabType = 'all' | 'needs_update' | 'standardized' | 'duplicates' | 'ambiguous' | 'missing_in_phone';

export const ContactsUnificationModal: React.FC<ContactsUnificationModalProps> = ({ onClose }) => {
  const { students, language, _t } = useApp();

  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(true);
  const [auditResult, setAuditResult] = useState<ContactsAuditResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('needs_update');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Custom edited names map: contactId -> customName
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [tempEditValue, setTempEditValue] = useState('');

  // Missing students state & custom names
  const [selectedMissingPhones, setSelectedMissingPhones] = useState<Set<string>>(new Set());
  const [customMissingNames, setCustomMissingNames] = useState<Record<string, string>>({});
  const [editingMissingPhone, setEditingMissingPhone] = useState<string | null>(null);
  const [tempMissingEditValue, setTempMissingEditValue] = useState('');
  const [savedMissingPhones, setSavedMissingPhones] = useState<Set<string>>(new Set());

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [currentUpdatingName, setCurrentUpdatingName] = useState('');
  const [executionReport, setExecutionReport] = useState<{
    updatedCount: number;
    failedCount: number;
    errors: string[];
  } | null>(null);

  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [isPickingWebContacts, setIsPickingWebContacts] = useState(false);

  // Initial audit scan
  const executeScan = async () => {
    setLoading(true);
    setExecutionReport(null);
    try {
      const perms = await contactsSyncService.checkPermissions();
      setPermissionGranted(perms.granted);

      const res = await contactsSyncService.runAudit(students);
      setAuditResult(res);

      // Pre-select items needing update and duplicates
      const preselected = new Set<string>();
      res.items.forEach(item => {
        if (item.selectedForUpdate) {
          preselected.add(item.id);
        }
      });
      setSelectedIds(preselected);

      // Pre-select missing students so user can 1-click save
      const missingPhones = new Set<string>();
      res.missingStudents.forEach(m => missingPhones.add(m.phone));
      setSelectedMissingPhones(missingPhones);
    } catch (e) {
      console.error('Scan error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeScan();
  }, [students]);

  const handleRequestPermissions = async () => {
    const res = await contactsSyncService.requestPermissions();
    if (res.granted) {
      setPermissionGranted(true);
      executeScan();
    } else {
      setPermissionGranted(false);
    }
  };

  const handleOpenAppSettings = async () => {
    await contactsSyncService.openSettings();
  };

  const handlePickWebContacts = async () => {
    try {
      setIsPickingWebContacts(true);
      await contactsSyncService.pickWebContacts();
      await executeScan();
    } catch (e: any) {
      console.warn('Web contact pick cancelled or error:', e);
    } finally {
      setIsPickingWebContacts(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (filteredItems: ContactAuditItem[]) => {
    const next = new Set(selectedIds);
    filteredItems.forEach(item => {
      if (item.status !== 'MISSING_ENGLISH_NAME') {
        next.add(item.id);
      }
    });
    setSelectedIds(next);
  };

  const handleDeselectAll = (filteredItems: ContactAuditItem[]) => {
    const next = new Set(selectedIds);
    filteredItems.forEach(item => next.delete(item.id));
    setSelectedIds(next);
  };

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const handleStartEdit = (item: ContactAuditItem) => {
    setEditingContactId(item.id);
    setTempEditValue(customNames[item.id] || item.proposedName);
  };

  const handleSaveEdit = (id: string) => {
    if (tempEditValue.trim()) {
      setCustomNames(prev => ({ ...prev, [id]: tempEditValue.trim() }));
    }
    setEditingContactId(null);
  };

  // Filtered Items
  const filteredAuditItems = useMemo(() => {
    if (!auditResult) return [];
    let items = auditResult.items;

    // Filter by tab
    if (activeTab === 'needs_update') {
      items = items.filter(i => i.status === 'NEEDS_UPDATE');
    } else if (activeTab === 'standardized') {
      items = items.filter(i => i.status === 'ALREADY_STANDARDIZED');
    } else if (activeTab === 'duplicates') {
      items = items.filter(i => i.status === 'DUPLICATE_ON_PHONE');
    } else if (activeTab === 'ambiguous') {
      items = items.filter(i => i.status === 'AMBIGUOUS' || i.status === 'MISSING_ENGLISH_NAME');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(i => 
        i.currentName.toLowerCase().includes(q) ||
        i.proposedName.toLowerCase().includes(q) ||
        i.phone.includes(q) ||
        i.students.some(s => s.name.toLowerCase().includes(q) || (s.certificateName && s.certificateName.toLowerCase().includes(q)))
      );
    }

    // Sort items: priority to unstandardized (NEEDS_UPDATE, DUPLICATE_ON_PHONE) first
    const statusPriority = (status: string) => {
      if (status === 'NEEDS_UPDATE' || status === 'DUPLICATE_ON_PHONE') return 1;
      if (status === 'MISSING_ENGLISH_NAME' || status === 'AMBIGUOUS') return 2;
      return 3; // ALREADY_STANDARDIZED last
    };

    items = [...items].sort((a, b) => statusPriority(a.status) - statusPriority(b.status));

    return items;
  }, [auditResult, activeTab, searchQuery]);

  const filteredMissingStudents = useMemo(() => {
    if (!auditResult || (activeTab !== 'missing_in_phone' && activeTab !== 'all')) return [];
    let list = auditResult.missingStudents;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(m => 
        m.student.name.toLowerCase().includes(q) ||
        (m.student.certificateName && m.student.certificateName.toLowerCase().includes(q)) ||
        m.phone.includes(q)
      );
    }
    return list;
  }, [auditResult, activeTab, searchQuery]);

  // Execute Batch Standardization
  const handleExecuteStandardization = async () => {
    if (!auditResult) return;
    const itemsToUpdate = auditResult.items
      .filter(item => selectedIds.has(item.id))
      .map(item => ({
        ...item,
        proposedName: customNames[item.id] || item.proposedName
      }));

    if (itemsToUpdate.length === 0) return;

    setIsExecuting(true);
    setProgressCurrent(0);
    setProgressTotal(itemsToUpdate.length);

    try {
      const report = await contactsSyncService.executeUpdates(
        itemsToUpdate,
        (current, total, name) => {
          setProgressCurrent(current);
          setProgressTotal(total);
          setCurrentUpdatingName(name);
        }
      );
      setExecutionReport(report);
      // Re-scan after execution to refresh status
      const refreshed = await contactsSyncService.runAudit(students);
      setAuditResult(refreshed);
      // Clear selection
      setSelectedIds(new Set());
    } catch (e: any) {
      setExecutionReport({
        updatedCount: 0,
        failedCount: itemsToUpdate.length,
        errors: [e?.message || 'Unexpected execution error']
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Missing students helpers & handlers
  const toggleSelectMissing = (phone: string) => {
    setSelectedMissingPhones(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const handleSelectAllMissing = (items: typeof filteredMissingStudents) => {
    const next = new Set(selectedMissingPhones);
    items.forEach(i => next.add(i.phone));
    setSelectedMissingPhones(next);
  };

  const handleDeselectAllMissing = (items: typeof filteredMissingStudents) => {
    const next = new Set(selectedMissingPhones);
    items.forEach(i => next.delete(i.phone));
    setSelectedMissingPhones(next);
  };

  const handleStartEditMissing = (phone: string, defaultName: string) => {
    setEditingMissingPhone(phone);
    setTempMissingEditValue(customMissingNames[phone] || defaultName);
  };

  const handleSaveEditMissing = (phone: string) => {
    if (tempMissingEditValue.trim()) {
      setCustomMissingNames(prev => ({ ...prev, [phone]: tempMissingEditValue.trim() }));
    }
    setEditingMissingPhone(null);
  };

  const handleCreateSingleMissingContact = async (item: { student: Student; proposedName: string; phone: string }) => {
    setIsExecuting(true);
    setProgressCurrent(1);
    setProgressTotal(1);
    const targetName = customMissingNames[item.phone] || item.proposedName;
    setCurrentUpdatingName(targetName);

    try {
      const res = await contactsSyncService.createContact({
        displayName: targetName,
        phoneNumber: item.phone,
        note: `طالب في ${item.student.grade} - تطبيق Glück`
      });

      if (res.success) {
        setSavedMissingPhones(prev => new Set(prev).add(item.phone));
        setExecutionReport({
          updatedCount: 1,
          failedCount: 0,
          errors: []
        });
        await executeScan();
      } else {
        setExecutionReport({
          updatedCount: 0,
          failedCount: 1,
          errors: [res.error || 'Failed to save contact']
        });
      }
    } catch (e: any) {
      setExecutionReport({
        updatedCount: 0,
        failedCount: 1,
        errors: [e?.message || 'Error saving contact']
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleOpenContactEditorForMissing = async (item: { student: Student; proposedName: string; phone: string }) => {
    const targetName = customMissingNames[item.phone] || item.proposedName;
    await contactsSyncService.openContactEditor(
      targetName,
      item.phone,
      `طالب في ${item.student.grade} - تطبيق Glück`
    );
  };

  const handleBatchCreateSelectedMissing = async () => {
    const itemsToCreate = filteredMissingStudents.filter(m => selectedMissingPhones.has(m.phone));
    if (itemsToCreate.length === 0) return;

    setIsExecuting(true);
    setProgressCurrent(0);
    setProgressTotal(itemsToCreate.length);

    try {
      const payload = itemsToCreate.map(m => ({
        displayName: customMissingNames[m.phone] || m.proposedName,
        phoneNumber: m.phone,
        note: `طالب في ${m.student.grade} - تطبيق Glück`
      }));

      const res = await contactsSyncService.batchCreateContacts(payload, (curr, tot, name) => {
        setProgressCurrent(curr);
        setCurrentUpdatingName(name);
      });

      const newSaved = new Set(savedMissingPhones);
      itemsToCreate.forEach(m => newSaved.add(m.phone));
      setSavedMissingPhones(newSaved);

      setExecutionReport({
        updatedCount: res.createdCount,
        failedCount: res.failedCount,
        errors: res.errors
      });

      await executeScan();
    } catch (e: any) {
      setExecutionReport({
        updatedCount: 0,
        failedCount: itemsToCreate.length,
        errors: [e?.message || 'Error in batch creation']
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExportMissingVcf = () => {
    const itemsToExport = (selectedMissingPhones.size > 0 
      ? filteredMissingStudents.filter(m => selectedMissingPhones.has(m.phone))
      : filteredMissingStudents
    ).map(m => ({
      displayName: customMissingNames[m.phone] || m.proposedName,
      phoneNumber: m.phone,
      note: `طالب في ${m.student.grade} - تطبيق Glück`
    }));

    contactsSyncService.downloadVcf('Glueck_Missing_Contacts', itemsToExport);
  };

  const isAndroid = contactsSyncService.isNativeAndroid();
  const canUseWebPicker = contactsSyncService.hasWebContactPicker();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-4xl max-h-[88dvh] sm:max-h-[85vh] bg-surface rounded-2xl shadow-2xl border border-surface-border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-surface-border bg-surface-hover/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-text-main leading-tight truncate">
                  Kontakte vereinheitlichen
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-md font-bold bg-primary-soft text-primary border border-primary-border shrink-0">
                  توحيد جهات الاتصال
                </span>
                {isAndroid ? (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md shrink-0">
                    <Smartphone className="w-3 h-3" />
                    Android & Google
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md shrink-0">
                    <Info className="w-3 h-3" />
                    Web / Chrome
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={executeScan}
              disabled={loading || isExecuting}
              title={_t('إعادة الفحص', 'Re-scan', 'Erneut scannen')}
              className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover border border-surface-border transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover border border-surface-border transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Permissions & Environment Bar */}
        <div className="px-4 py-2 sm:px-6 bg-surface border-b border-surface-border text-xs shrink-0">
          {isAndroid ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {permissionGranted ? (
                  <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    {_t('تم منح إذن قراءة وكتابة جهات الاتصال (Android Permission Active)', 'Android contacts permissions granted', 'Android-Berechtigungen aktiv')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    {_t('يتطلب منح إذن قراءة وكتابة جهات الاتصال في أندرويد', 'Android contacts permission required', 'Kontakte-Berechtigung erforderlich')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {!permissionGranted && (
                  <button
                    onClick={handleRequestPermissions}
                    className="px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded-md hover:bg-primary-hover active:scale-95 transition-all cursor-pointer shadow-2xs"
                  >
                    {_t('طلب الإذن', 'Request', 'Erlauben')}
                  </button>
                )}
                <button
                  onClick={handleOpenAppSettings}
                  className="px-1.5 py-0.5 bg-surface-hover text-text-muted hover:text-text-main text-[10px] font-bold rounded-md border border-surface-border transition-all cursor-pointer flex items-center gap-1"
                  title={_t('إعدادات التطبيق بالنظام', 'App Settings', 'App-Einstellungen')}
                >
                  <Settings className="w-3 h-3" />
                  <span>{_t('الإعدادات', 'Settings', 'Einstellungen')}</span>
                </button>
              </div>
            </div>
          ) : (
            // Web / Chrome mode
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-text-muted">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>
                  {_t(
                    'في بيئة الويب / كروم يتم فحص ومحاكاة جهات الاتصال وفق بيانات الطلاب الفعلية المسجلة بالتطبيق.',
                    'Web preview mode uses live student records to audit and demonstrate contacts standardization.',
                    'Web-Modus überprüft reale Schülerdaten und simuliert die Standardisierung.'
                  )}
                </span>
              </div>

              {canUseWebPicker && (
                <button
                  onClick={handlePickWebContacts}
                  disabled={isPickingWebContacts}
                  className="px-3 py-1 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    {isPickingWebContacts 
                      ? _t('جاري الاختيار...', 'Picking...', 'Wähle...') 
                      : _t('استيراد من الهاتف (Contact Picker)', 'Pick from Android Phone', 'Vom Telefon wählen')}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Metric Cards - Compact */}
        {auditResult && (
          <div className="px-4 py-2 sm:px-6 grid grid-cols-5 gap-1.5 border-b border-surface-border bg-surface-hover/10 shrink-0 text-center">
            <div 
              onClick={() => setActiveTab('needs_update')}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                activeTab === 'needs_update' 
                  ? 'bg-primary-soft border-primary-border shadow-2xs' 
                  : 'bg-surface border-surface-border hover:bg-surface-hover'
              }`}
            >
              <div className="text-sm font-black text-primary">
                {auditResult.needsUpdateCount}
              </div>
              <div className="text-[9px] font-bold text-text-muted truncate">
                {_t('يحتاج توحيد', 'Needs Update', 'Zu aktualisieren')}
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('standardized')}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                activeTab === 'standardized' 
                  ? 'bg-emerald-500/15 border-emerald-500/30 shadow-2xs' 
                  : 'bg-surface border-surface-border hover:bg-surface-hover'
              }`}
            >
              <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {auditResult.alreadyStandardizedCount}
              </div>
              <div className="text-[9px] font-bold text-text-muted truncate">
                {_t('موحد', 'Standardized', 'Korrekt')}
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('duplicates')}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                activeTab === 'duplicates' 
                  ? 'bg-purple-500/15 border-purple-500/30 shadow-2xs' 
                  : 'bg-surface border-surface-border hover:bg-surface-hover'
              }`}
            >
              <div className="text-sm font-black text-purple-600 dark:text-purple-400">
                {auditResult.duplicatesCount}
              </div>
              <div className="text-[9px] font-bold text-text-muted truncate">
                {_t('مكرر', 'Duplicates', 'Duplikate')}
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('ambiguous')}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                activeTab === 'ambiguous' 
                  ? 'bg-amber-500/15 border-amber-500/30 shadow-2xs' 
                  : 'bg-surface border-surface-border hover:bg-surface-hover'
              }`}
            >
              <div className="text-sm font-black text-amber-600 dark:text-amber-400">
                {auditResult.ambiguousCount}
              </div>
              <div className="text-[9px] font-bold text-text-muted truncate">
                {_t('مراجعة', 'Review', 'Prüfung')}
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('missing_in_phone')}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                activeTab === 'missing_in_phone' 
                  ? 'bg-slate-500/15 border-slate-500/30 shadow-2xs' 
                  : 'bg-surface border-surface-border hover:bg-surface-hover'
              }`}
            >
              <div className="text-sm font-black text-text-muted">
                {auditResult.missingInPhoneCount}
              </div>
              <div className="text-[9px] font-bold text-text-muted truncate">
                {_t('غير مسجل', 'Not in Phone', 'Nicht im Tel')}
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="px-4 py-2 sm:px-6 border-b border-surface-border bg-surface flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto scrollbar-none py-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {_t('الكل', 'All', 'Alle')} ({auditResult?.items.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('needs_update')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'needs_update'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {_t('يحتاج توحيد', 'Needs Update', 'Zu aktualisieren')} ({auditResult?.needsUpdateCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('standardized')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'standardized'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {_t('موحد', 'Standardized', 'Bereits korrekt')} ({auditResult?.alreadyStandardizedCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('duplicates')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'duplicates'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {_t('مكرر', 'Duplicates', 'Duplikate')} ({auditResult?.duplicatesCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('ambiguous')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'ambiguous'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {_t('مراجعة', 'Review', 'Prüfung')} ({auditResult?.ambiguousCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('missing_in_phone')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'missing_in_phone'
                  ? 'bg-slate-600 text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {_t('غير مسجل', 'Not in phone', 'Nicht im Telefon')} ({auditResult?.missingInPhoneCount || 0})
            </button>
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-text-muted absolute top-1/2 -translate-y-1/2 start-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={_t('بحث بالاسم أو الرقم...', 'Search by name or phone...', 'Suchen nach Name oder Telefon...')}
              className="w-full ps-8 pe-3 py-1.5 bg-surface-hover/80 border border-surface-border rounded-lg text-xs text-text-main placeholder:text-text-muted focus:outline-hidden focus:border-primary"
            />
          </div>
        </div>

        {/* Selection Toolbar with clean badge */}
        {activeTab !== 'missing_in_phone' && filteredAuditItems.length > 0 ? (
          <div className="px-4 py-2 sm:px-6 bg-surface-hover/30 border-b border-surface-border flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAll(filteredAuditItems)}
                className="font-bold text-primary hover:underline cursor-pointer"
              >
                {_t('تحديد الكل', 'Select all visible', 'Alle auswählen')}
              </button>
              <span className="text-text-muted">|</span>
              <button
                onClick={() => handleDeselectAll(filteredAuditItems)}
                className="font-bold text-text-muted hover:text-text-main cursor-pointer"
              >
                {_t('إلغاء التحديد', 'Deselect all', 'Auswahl aufheben')}
              </button>
            </div>

            <div className="flex items-center gap-1.5 ms-auto">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-primary text-white shadow-2xs">
                {selectedIds.size}
              </span>
              <span className="font-bold text-text-main text-[11px]">
                {_t('جهة اتصال محددة للتحديث', 'selected for update', 'ausgewählt')}
              </span>
            </div>
          </div>
        ) : activeTab === 'missing_in_phone' && filteredMissingStudents.length > 0 ? (
          <div className="px-4 py-2 sm:px-6 bg-emerald-500/10 border-b border-emerald-500/20 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAllMissing(filteredMissingStudents)}
                className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {_t('تحديد الكل', 'Select all', 'Alle auswählen')}
              </button>
              <span className="text-text-muted">|</span>
              <button
                onClick={() => handleDeselectAllMissing(filteredMissingStudents)}
                className="font-bold text-text-muted hover:text-text-main cursor-pointer"
              >
                {_t('إلغاء التحديد', 'Deselect all', 'Auswahl aufheben')}
              </button>
            </div>

            <div className="flex items-center gap-2 ms-auto">
              <button
                onClick={handleExportMissingVcf}
                className="px-2.5 py-1 rounded-lg border border-surface-border bg-surface text-text-main hover:bg-surface-hover font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                title={_t('تصدير كملف VCF', 'Export as VCF', 'Als VCF exportieren')}
              >
                <Download className="w-3 h-3 text-text-muted" />
                <span>{_t('تصدير VCF', 'Export VCF', 'VCF Export')}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-2xs">
                  {selectedMissingPhones.size}
                </span>
                <span className="font-bold text-text-main text-[11px]">
                  {_t('محدد للتسجيل بالهاتف', 'selected to save', 'zum Speichern')}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2.5">
          {loading ? (
            <div className="py-16 text-center text-text-muted flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs sm:text-sm font-bold">
                {_t('جاري فحص وتدقيق جهات الاتصال المسجلة...', 'Scanning and auditing device contacts...', 'Kontakte werden überprüft...')}
              </p>
            </div>
          ) : activeTab === 'missing_in_phone' ? (
            // Missing Students in Phone Contacts View
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {_t(
                      'هؤلاء الطلاب لديهم أرقام هواتف مسجلة في تطبيق Glück ولكن ليس لهم جهات اتصال محفوظة في هاتفك. يمكنك حفظهم بالهاتف فردياً أو بضغطة زر واحدة للجميع.',
                      'These students have phone numbers in Glück but no saved contacts on your phone. You can save them individually or batch-save all.',
                      'Diese Schüler haben Telefonnummern in Glück, aber keine Kontakte auf dem Telefon. Sie können sie einzeln oder alle auf einmal speichern.'
                    )}
                  </span>
                </div>

                {filteredMissingStudents.length > 0 && (
                  <button
                    onClick={handleBatchCreateSelectedMissing}
                    disabled={isExecuting || selectedMissingPhones.size === 0}
                    className="self-end sm:self-center px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{_t(`تسجيل المحدد بالهاتف (${selectedMissingPhones.size})`, `Save Selected (${selectedMissingPhones.size})`, `Ausgewählte speichern (${selectedMissingPhones.size})`)}</span>
                  </button>
                )}
              </div>

              {filteredMissingStudents.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs">
                  {_t('جميع أولياء الأمور المسجلين لديهم جهات اتصال محفوظة بالهاتف.', 'All registered parents have saved contacts.', 'Alle registrierten Eltern haben gespeicherte Kontakte.')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredMissingStudents.map((item, idx) => {
                    const isSelected = selectedMissingPhones.has(item.phone);
                    const isEditing = editingMissingPhone === item.phone;
                    const isSaved = savedMissingPhones.has(item.phone);
                    const displayNameToPropose = customMissingNames[item.phone] || item.proposedName;

                    return (
                      <div 
                        key={idx} 
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 shadow-2xs ${
                          isSelected 
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/40' 
                            : 'bg-surface border-surface-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Selection Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelectMissing(item.phone)}
                            className="mt-0.5 text-emerald-600 cursor-pointer shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Square className="w-5 h-5 text-surface-border-soft hover:text-text-muted" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-text-main text-xs sm:text-sm truncate">
                                {item.student.name}
                              </div>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                {item.student.grade}
                              </span>
                            </div>

                            {/* Proposed Name with inline edit */}
                            <div className="mt-1">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <input
                                    type="text"
                                    value={tempMissingEditValue}
                                    onChange={e => setTempMissingEditValue(e.target.value)}
                                    className="px-2 py-1 text-xs border border-emerald-500 rounded-lg bg-surface text-text-main flex-1 focus:outline-hidden"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditMissing(item.phone)}
                                    className="p-1 rounded-md bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingMissingPhone(null)}
                                    className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 text-text-main cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  <span className="truncate">{displayNameToPropose}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditMissing(item.phone, item.proposedName)}
                                    className="p-0.5 text-text-muted hover:text-text-main cursor-pointer"
                                    title={_t('تعديل الاسم المقترح', 'Edit proposed name', 'Vorgeschlagenen Namen bearbeiten')}
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Phone number & copy */}
                            <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5 font-mono">
                              <span>{item.phone}</span>
                              <button
                                onClick={() => handleCopyPhone(`missing_${idx}`, item.phone)}
                                className="p-0.5 hover:text-text-main cursor-pointer"
                              >
                                {copiedPhoneId === `missing_${idx}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-surface-border/60">
                          {isSaved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/40 px-2.5 py-1 rounded-lg">
                              <Check className="w-3.5 h-3.5" />
                              <span>{_t('تم التسجيل بالهاتف', 'Saved in phone', 'Gespeichert')}</span>
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenContactEditorForMissing(item)}
                                className="px-2.5 py-1 rounded-lg border border-surface-border text-text-muted hover:text-text-main hover:bg-surface-hover text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                title={_t('فتح في تطبيق جهات اتصال الهاتف للمعاينة', 'Open in device contacts app', 'In Kontakte-App öffnen')}
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span className="hidden sm:inline">{_t('محرر الهاتف', 'Editor', 'Editor')}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCreateSingleMissingContact(item)}
                                disabled={isExecuting}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>{_t('تسجيل بالهاتف', 'Save to phone', 'Auf Telefon speichern')}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : filteredAuditItems.length === 0 ? (
            <div className="py-16 text-center text-text-muted flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="text-sm font-bold text-text-main">
                {_t('لا توجد جهات اتصال ضمن هذا التصنيف.', 'No contacts found under this filter.', 'Keine Kontakte unter diesem Filter.')}
              </p>
            </div>
          ) : (
            // Contact Audit Items List
            <div className="space-y-2.5">
              {filteredAuditItems.map(item => {
                const isSelected = selectedIds.has(item.id);
                const isEditing = editingContactId === item.id;
                const displayNameToPropose = customNames[item.id] || item.proposedName;

                return (
                  <div
                    key={item.id}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                      isSelected 
                        ? 'bg-primary-soft/30 border-primary/40 shadow-xs' 
                        : 'bg-surface border-surface-border hover:border-surface-border/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        type="button"
                        disabled={item.status === 'MISSING_ENGLISH_NAME'}
                        onClick={() => toggleSelect(item.id)}
                        className="mt-0.5 text-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 fill-primary text-white" />
                        ) : (
                          <Square className="w-5 h-5 text-text-muted hover:text-text-main" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* Top Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {item.status === 'NEEDS_UPDATE' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              {language === 'ar' ? item.statusLabelAr : item.statusLabelDe}
                            </span>
                          )}
                          {item.status === 'ALREADY_STANDARDIZED' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {language === 'ar' ? item.statusLabelAr : item.statusLabelDe}
                            </span>
                          )}
                          {item.status === 'DUPLICATE_ON_PHONE' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                              {language === 'ar' ? item.statusLabelAr : item.statusLabelDe}
                            </span>
                          )}
                          {item.status === 'MISSING_ENGLISH_NAME' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                              {language === 'ar' ? item.statusLabelAr : item.statusLabelDe}
                            </span>
                          )}

                          {item.isGoogleAccount && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              Google Contacts
                            </span>
                          )}

                          {item.students.length > 1 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                              {_t('إخوة مشتركون', 'Siblings', 'Geschwister')} ({item.students.length})
                            </span>
                          )}
                        </div>

                        {/* Name Comparison Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2 text-xs">
                          <div className="p-2 rounded-lg bg-surface-hover/50 border border-surface-border">
                            <span className="text-[10px] font-bold text-text-muted block mb-0.5">
                              {_t('الاسم الحالي بالهاتف:', 'Current Phone Name:', 'Aktueller Name:')}
                            </span>
                            <span className="font-semibold text-text-main line-through decoration-red-400">
                              {item.currentName}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                {_t('الاسم الموحد المعتمد:', 'Proposed Standardized Name:', 'Vorgeschlagener Name:')}
                              </span>
                              {!isEditing && (
                                <button
                                  onClick={() => handleStartEdit(item)}
                                  className="text-[10px] text-text-muted hover:text-primary flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  {_t('تعديل', 'Edit', 'Bearbeiten')}
                                </button>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <input
                                  type="text"
                                  value={tempEditValue}
                                  onChange={e => setTempEditValue(e.target.value)}
                                  className="flex-1 px-2 py-1 bg-surface border border-primary rounded text-xs text-text-main focus:outline-hidden"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveEdit(item.id)}
                                  className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded cursor-pointer"
                                >
                                  {_t('حفظ', 'Save', 'OK')}
                                </button>
                                <button
                                  onClick={() => setEditingContactId(null)}
                                  className="px-2 py-1 bg-surface-hover text-text-muted text-[10px] font-bold rounded cursor-pointer"
                                >
                                  {_t('إلغاء', 'Cancel', 'X')}
                                </button>
                              </div>
                            ) : (
                              <span className="font-black text-emerald-700 dark:text-emerald-300">
                                {displayNameToPropose || '—'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Linked Students & Details */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted mt-2 pt-2 border-t border-surface-border">
                          <div className="flex items-center gap-1 font-mono">
                            <Smartphone className="w-3 h-3 text-text-muted shrink-0" />
                            <span>{item.phone}</span>
                            <button
                              onClick={() => handleCopyPhone(item.id, item.phone)}
                              className="p-0.5 hover:text-text-main cursor-pointer"
                            >
                              {copiedPhoneId === item.id ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Users className="w-3 h-3 text-text-muted shrink-0" />
                            <span className="font-bold text-text-main">
                              {item.students.map(s => s.name).join(' & ')}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-hover text-text-muted">
                              {item.students.map(s => s.grade).join(' / ')}
                            </span>
                          </div>

                          {item.suggestedNote && (
                            <div className="text-[10px] text-text-muted italic truncate max-w-xs">
                              📝 {item.suggestedNote}
                            </div>
                          )}
                        </div>

                        {/* Reason or Warning description if ambiguous */}
                        {item.statusDescriptionAr && item.status !== 'NEEDS_UPDATE' && item.status !== 'ALREADY_STANDARDIZED' && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                            ⚠️ {item.statusDescriptionAr}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Execution Report Notification */}
        {executionReport && (
          <div className="px-4 py-2.5 sm:px-6 bg-emerald-500/10 border-t border-emerald-500/30 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {_t(
                  `تم بنجاح تحديث ${executionReport.updatedCount} جهة اتصال وتوحيد أسمائها القياسية!`,
                  `Successfully standardized ${executionReport.updatedCount} contact names!`,
                  `${executionReport.updatedCount} Kontakte wurden erfolgreich standardisiert!`
                )}
              </span>
            </div>
            <button
              onClick={() => setExecutionReport(null)}
              className="font-bold text-text-muted hover:text-text-main cursor-pointer"
            >
              {_t('إغلاق', 'Dismiss', 'Schließen')}
            </button>
          </div>
        )}

        {/* Live Execution Progress Dialog Overlay */}
        {isExecuting && (
          <div className="absolute inset-0 bg-surface/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-20">
            <div className="w-full max-w-md bg-surface p-6 rounded-2xl border border-surface-border shadow-2xl text-center space-y-4">
              <RefreshCw className="w-10 h-10 animate-spin text-primary mx-auto" />
              <div>
                <h4 className="text-base font-black text-text-main">
                  {_t('جاري تحديث وتوحيد جهات الاتصال...', 'Standardizing contacts...', 'Kontakte werden aktualisiert...')}
                </h4>
                <p className="text-xs text-text-muted mt-1 truncate">
                  {currentUpdatingName}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-surface-border rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-200"
                  style={{ width: `${progressTotal > 0 ? (progressCurrent / progressTotal) * 100 : 0}%` }}
                />
              </div>

              <div className="text-xs font-bold text-text-muted font-mono">
                {progressCurrent} / {progressTotal} ({Math.round(progressTotal > 0 ? (progressCurrent / progressTotal) * 100 : 0)}%)
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-4 py-2.5 sm:px-6 border-t border-surface-border bg-surface flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] sm:text-xs text-text-muted flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              {_t(
                'تحديث آمن: يتم تعديل الاسم فقط دون حذف أي أرقام أو بيانات، مع توافق كامل لمزامنة Google.',
                'Safe non-destructive update: modifies only contact names without removing numbers or data.',
                'Sichere Aktualisierung: Ändert nur Kontaktnamen ohne Telefonnummern zu löschen.'
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isExecuting}
              className="flex-1 sm:flex-none px-3.5 py-1.5 sm:py-2 rounded-xl border border-surface-border text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-all cursor-pointer"
            >
              {_t('إغلاق', 'Close', 'Schließen')}
            </button>

            {activeTab === 'missing_in_phone' ? (
              <button
                onClick={handleBatchCreateSelectedMissing}
                disabled={isExecuting || selectedMissingPhones.size === 0}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  {_t(
                    `تسجيل جهات الاتصال المحددة بالهاتف (${selectedMissingPhones.size})`,
                    `Save Selected to Phone (${selectedMissingPhones.size})`,
                    `Ausgewählte auf Telefon speichern (${selectedMissingPhones.size})`
                  )}
                </span>
              </button>
            ) : (
              <button
                onClick={handleExecuteStandardization}
                disabled={isExecuting || selectedIds.size === 0}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {_t(
                    `توحيد الأسماء المحددة الآن (${selectedIds.size})`,
                    `Standardize Selected (${selectedIds.size})`,
                    `Ausgewählte vereinheitlichen (${selectedIds.size})`
                  )}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
