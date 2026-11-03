import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  FolderOpen,
  FileText,
  Award,
  MessageSquare,
  Calendar,
  BookOpen,
  DollarSign,
  HardDrive,
  Search,
  Filter,
  Printer,
  Download,
  Send,
  Copy,
  Check,
  Trash2,
  Eye,
  X,
  Folder,
  Sparkles,
  RefreshCw,
  Clock,
  User,
  Users,
  Smartphone
} from 'lucide-react';
import {
  DownloadedFileRecord,
  DownloadedFileCategory,
  DownloadedFileActionType,
  APP_ROOT_FOLDER,
  SUBFOLDER_BY_CATEGORY,
  getDownloadedFilesRegistry,
  deleteDownloadedFileRecord,
  clearDownloadedFilesRegistry,
  reshareRegisteredFileToWhatsApp,
  redownloadRegisteredFile,
  reprintRegisteredFile
} from '../services/downloadedFilesService';
import { getLocalDateStr } from '../utils/timeUtils';

export const DownloadedFilesSection: React.FC = () => {
  const { _t, triggerToast } = useApp();

  const [records, setRecords] = useState<DownloadedFileRecord[]>(() => getDownloadedFilesRegistry());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | DownloadedFileCategory>('all');
  const [selectedAction, setSelectedAction] = useState<'all' | DownloadedFileActionType>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [previewRecord, setPreviewRecord] = useState<DownloadedFileRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  const refreshRegistry = () => {
    setRecords(getDownloadedFilesRegistry());
  };

  useEffect(() => {
    refreshRegistry();
    const handler = () => refreshRegistry();
    window.addEventListener('gluck_downloaded_files_updated', handler);
    return () => window.removeEventListener('gluck_downloaded_files_updated', handler);
  }, []);

  // Filter logic directly over real registered records saved when user performs actual actions
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const todayStr = getLocalDateStr();

    return records.filter(rec => {
      // 1. Category filter
      if (selectedCategory !== 'all' && rec.category !== selectedCategory) {
        return false;
      }

      // 2. Action filter
      if (selectedAction !== 'all' && rec.actionType !== selectedAction) {
        return false;
      }

      // 3. Date filter
      if (selectedDateFilter === 'today') {
        if (rec.dateStr !== todayStr) return false;
      } else if (selectedDateFilter === 'week') {
        const recDate = new Date(rec.createdAt);
        const diffDays = (now.getTime() - recDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (selectedDateFilter === 'month') {
        const recDate = new Date(rec.createdAt);
        const diffDays = (now.getTime() - recDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 31) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${rec.title} ${rec.fileName} ${rec.studentName || ''} ${rec.groupName || ''} ${rec.subFolder}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [records, selectedCategory, selectedAction, selectedDateFilter, searchQuery]);

  // Category Counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: records.length,
      worksheets: 0,
      certificates: 0,
      parent_reports: 0,
      schedules: 0,
      school_plans: 0,
      finance: 0,
      backups: 0
    };
    records.forEach(r => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [records]);

  const categoriesList: { id: 'all' | DownloadedFileCategory; label: string; icon: React.ElementType; subFolder?: string }[] = [
    { id: 'all', label: _t('كل الملفات', 'All Files', 'Alle Dateien'), icon: FolderOpen },
    { id: 'worksheets', label: _t('أوراق العمل والسيتات', 'Worksheets', 'Arbeitsblätter'), icon: BookOpen, subFolder: 'Worksheets' },
    { id: 'certificates', label: _t('الشهادات والتكريمات', 'Certificates', 'Zertifikate'), icon: Award, subFolder: 'Certificates' },
    { id: 'parent_reports', label: _t('تقارير الحصص', 'Session Reports', 'Berichte'), icon: MessageSquare, subFolder: 'Parent_Reports' },
    { id: 'schedules', label: _t('الجداول الدراسية', 'Schedules', 'Stundenpläne'), icon: Calendar, subFolder: 'Schedules' },
    { id: 'school_plans', label: _t('الخطط والزيارات', 'Plans & Visits', 'Wochenpläne'), icon: FileText, subFolder: 'School_Plans_And_Visits' },
    { id: 'finance', label: _t('المالية والإيصالات', 'Finance', 'Finanzen'), icon: DollarSign, subFolder: 'Finance_And_Receipts' },
    { id: 'backups', label: _t('النسخ وجهات الاتصال', 'Backups & Contacts', 'Backups'), icon: HardDrive, subFolder: 'Backups_And_Contacts' }
  ];

  const getActionBadge = (action: DownloadedFileActionType) => {
    switch (action) {
      case 'whatsapp':
        return {
          label: _t('واتساب 💬', 'WhatsApp 💬', 'WhatsApp 💬'),
          cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
        };
      case 'print':
        return {
          label: _t('مطبوع 🖨️', 'Printed 🖨️', 'Gedruckt 🖨️'),
          cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
        };
      case 'download_pdf':
        return {
          label: _t('ملف PDF 📄', 'PDF File 📄', 'PDF-Datei 📄'),
          cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
        };
      case 'download_image':
        return {
          label: _t('صورة 🖼️', 'Image 🖼️', 'Bild 🖼️'),
          cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
        };
      default:
        return {
          label: _t('تصدير ⬇️', 'Exported ⬇️', 'Exportiert ⬇️'),
          cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
        };
    }
  };

  const handleCopyContent = async (rec: DownloadedFileRecord) => {
    const text = rec.textContent || `${rec.title}\n📁 ${rec.fullStoragePath}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(rec.id);
      setTimeout(() => setCopiedId(null), 2000);
      triggerToast(_t('تم نسخ المحتوى للحافظة بنجاح ✓', 'Copied to clipboard ✓', 'Kopiert ✓'));
    } catch {}
  };

  const handleDeleteRecord = async (rec: DownloadedFileRecord) => {
    await deleteDownloadedFileRecord(rec.id);
    refreshRegistry();
    triggerToast(_t('تم حذف الملف من السجل', 'File removed from list', 'Datei entfernt'));
  };

  const handleClearAll = () => {
    clearDownloadedFilesRegistry(selectedCategory === 'all' ? undefined : selectedCategory);
    setConfirmClearAll(false);
    refreshRegistry();
    triggerToast(_t('تم مسح سجل الملفات المحملة', 'Cleared downloaded files history', 'Verlauf gelöscht'));
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 1. PHONE STORAGE ARCHITECTURE BANNER */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-text-main">
                {_t('الحفظ التلقائي في ذاكرة الهاتف الداخلية مفعل ✅', 'Auto-Save to Internal Phone Storage Active ✅', 'Automatische Speicherung aktiv ✅')}
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                Documents/{APP_ROOT_FOLDER}
              </span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              {_t(
                'أي ملف أو شهادة أو تقرير يتم إنشاؤه أو طباعته أو مشاركته عبر الواتساب يتم حفظ نسخة منه تلقائياً في فولدر البرنامج الرئيسي وبداخله فولدرات فرعية منظمة لكل نوع.',
                'Every generated, printed, or WhatsApp-shared file is automatically saved inside the app root folder with dedicated subfolders.',
                'Jede erstellte, gedruckte oder per WhatsApp geteilte Datei wird automatisch im App-Ordner mit Unterordnern gespeichert.'
              )}
            </p>
          </div>
        </div>

        {/* Subfolders quick pills */}
        <div className="flex items-center gap-1 flex-wrap shrink-0">
          {Object.entries(SUBFOLDER_BY_CATEGORY).map(([catKey, folderName]) => (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey as DownloadedFileCategory)}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                selectedCategory === catKey
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-surface text-text-muted border-surface-border hover:text-text-main'
              }`}
              title={`Documents/${APP_ROOT_FOLDER}/${folderName}`}
            >
              <Folder className="w-3 h-3 text-amber-500 shrink-0" />
              <span>/{folderName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. SEARCH & FILTERS BAR */}
      <div className="bg-surface border border-surface-border rounded-2xl p-3 sm:p-3.5 space-y-3 shadow-2xs">
        {/* Top Row: Search Input + Date Filter + Action Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          {/* Search Input */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={_t('ابحث باسم الملف، الطالب، المجموعة، أو الفولدر...', 'Search by filename, student, group...', 'Suche nach Datei, Schüler, Gruppe...')}
              className="w-full pr-9 pl-8 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Type Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as any)}
              className="w-full px-2.5 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main cursor-pointer"
            >
              <option value="all">{_t('كل الإجراءات (الكل)', 'All Actions', 'Alle Aktionen')}</option>
              <option value="whatsapp">{_t('💬 مرسلة واتساب', '💬 Sent via WhatsApp', '💬 Per WhatsApp')}</option>
              <option value="print">{_t('🖨️ مطبوعة', '🖨️ Printed', '🖨️ Gedruckt')}</option>
              <option value="download_pdf">{_t('📄 ملفات PDF محملة', '📄 PDF Downloads', '📄 PDF-Dateien')}</option>
              <option value="download_image">{_t('🖼️ صور وشهادات PNG', '🖼️ Images', '🖼️ Bilder')}</option>
              <option value="export_data">{_t('⬇️ ملفات بيانات وتقويم', '⬇️ Data Exports', '⬇️ Datenexporte')}</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value as any)}
              className="w-full px-2.5 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main cursor-pointer"
            >
              <option value="all">{_t('📅 كل الأوقات', '📅 All Time', '📅 Alle Zeiten')}</option>
              <option value="today">{_t('⭐ اليوم فقط', '⭐ Today Only', '⭐ Nur heute')}</option>
              <option value="week">{_t('🗓️ آخر 7 أيام', '🗓️ Last 7 Days', '🗓️ Letzte 7 Tage')}</option>
              <option value="month">{_t('📆 هذا الشهر', '📆 This Month', '📆 Diesen Monat')}</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {categoriesList.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-xs font-black'
                    : 'bg-surface-hover text-text-muted hover:text-text-main border-surface-border'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-surface text-text-muted'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. SUMMARY HEADER & CLEAR BUTTON */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-bold text-text-muted flex items-center gap-2">
          <span>
            {_t(
              `إجمالي الملفات المعروضة: ${filteredRecords.length}`,
              `Showing ${filteredRecords.length} files`,
              `${filteredRecords.length} Dateien angezeigt`
            )}
          </span>
          {selectedCategory !== 'all' && (
            <span className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
              📁 Documents/{APP_ROOT_FOLDER}/{SUBFOLDER_BY_CATEGORY[selectedCategory]}
            </span>
          )}
        </div>

        {records.length > 0 && (
          <div>
            {confirmClearAll ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 bg-rose-600 text-white text-[11px] font-black rounded-lg cursor-pointer"
                >
                  {_t('تأكيد المسح', 'Confirm Clear', 'Bestätigen')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2 py-1 bg-surface-hover text-text-muted text-[11px] font-bold rounded-lg border border-surface-border cursor-pointer"
                >
                  {_t('إلغاء', 'Cancel', 'Abbrechen')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{_t('مسح السجل', 'Clear Log', 'Verlauf leeren')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. FILES LIST */}
      {filteredRecords.length === 0 ? (
        <div className="bg-surface border border-surface-border rounded-2xl p-8 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-text-main">
            {_t('لا توجد ملفات مطابقة للبحث أو الفلتر المحدد', 'No matching files found', 'Keine passenden Dateien gefunden')}
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
            {_t(
              'أي ورقة عمل، شهادة، تقرير ولي أمر، أو جدول تقوم بطباعته أو إرساله عبر الواتساب سيظهر هنا تلقائياً مع مسار حفظه في الهاتف.',
              'Any worksheet, certificate, parent report, or schedule you print or share via WhatsApp will automatically appear here.',
              'Jedes Arbeitsblatt, Zertifikat oder jeder Bericht wird hier automatisch aufgelistet.'
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filteredRecords.map((rec) => {
            const badge = getActionBadge(rec.actionType);
            const dateFormatted = (() => {
              try {
                const d = new Date(rec.createdAt);
                return d.toLocaleString('ar-EG', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              } catch {
                return rec.dateStr;
              }
            })();

            return (
              <div
                key={rec.id}
                className="bg-surface hover:bg-surface-hover/50 border border-surface-border rounded-2xl p-3 sm:p-3.5 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Left / Main Info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Format / Preview Thumbnail */}
                  {rec.previewDataUrl ? (
                    <img
                      src={rec.previewDataUrl}
                      alt={rec.title}
                      onClick={() => setPreviewRecord(rec)}
                      className="w-12 h-12 rounded-xl object-cover border border-surface-border shrink-0 cursor-pointer hover:opacity-90"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex flex-col items-center justify-center shrink-0 font-mono text-[10px] font-black uppercase">
                      <span>{rec.format}</span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-black text-text-main truncate">
                        {rec.title}
                      </h4>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Metadata Chips: Student, Group, Time, Folder Path */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-text-muted">
                      {rec.studentName && (
                        <span className="inline-flex items-center gap-1 font-bold text-text-main">
                          <User className="w-3 h-3 text-primary" />
                          {rec.studentName}
                        </span>
                      )}
                      {rec.groupName && (
                        <span className="inline-flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded-md border border-surface-border text-[10px] font-bold">
                          <Users className="w-3 h-3 text-emerald-600" />
                          {rec.groupName}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dateFormatted}
                      </span>
                    </div>

                    {/* Phone Internal Storage Path Pill */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-mono truncate max-w-full border border-surface-border">
                        <Folder className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate" dir="ltr">{rec.fullStoragePath}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right / Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                  {/* Preview Button (if text or image preview exists) */}
                  {(rec.textContent || rec.previewDataUrl) && (
                    <button
                      type="button"
                      onClick={() => setPreviewRecord(rec)}
                      className="px-2.5 py-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main rounded-xl text-xs font-bold border border-surface-border transition-all cursor-pointer inline-flex items-center gap-1"
                      title={_t('معاينة الملف', 'Preview', 'Vorschau')}
                    >
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      <span>{_t('معاينة', 'Preview', 'Vorschau')}</span>
                    </button>
                  )}

                  {/* Re-Share to WhatsApp */}
                  <button
                    type="button"
                    onClick={() => reshareRegisteredFileToWhatsApp(rec)}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    title={_t('إرسال عبر واتساب', 'Send via WhatsApp', 'Per WhatsApp senden')}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{_t('واتساب', 'WhatsApp', 'WhatsApp')}</span>
                  </button>

                  {/* Re-Print */}
                  {(rec.textContent || rec.previewDataUrl) && (
                    <button
                      type="button"
                      onClick={() => reprintRegisteredFile(rec)}
                      className="p-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main rounded-xl border border-surface-border transition-all cursor-pointer"
                      title={_t('إعادة طباعة', 'Print', 'Drucken')}
                    >
                      <Printer className="w-3.5 h-3.5 text-sky-600" />
                    </button>
                  )}

                  {/* Re-Download */}
                  {(rec.textContent || rec.previewDataUrl || rec.nativeUri) && (
                    <button
                      type="button"
                      onClick={() => redownloadRegisteredFile(rec)}
                      className="p-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main rounded-xl border border-surface-border transition-all cursor-pointer"
                      title={_t('تحميل الملف', 'Download', 'Herunterladen')}
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  )}

                  {/* Copy Text */}
                  <button
                    type="button"
                    onClick={() => handleCopyContent(rec)}
                    className="p-1.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main rounded-xl border border-surface-border transition-all cursor-pointer"
                    title={_t('نسخ النص أو المسار', 'Copy', 'Kopieren')}
                  >
                    {copiedId === rec.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-text-muted" />
                    )}
                  </button>

                  {/* Delete (only for stored registry items) */}
                  {!rec.id.startsWith('syn_') && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRecord(rec)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl border border-rose-500/20 transition-all cursor-pointer"
                      title={_t('حذف من السجل', 'Delete', 'Löschen')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. PREVIEW MODAL */}
      {previewRecord && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewRecord(null);
          }}
        >
          <div className="bg-surface border border-surface-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-text-main truncate">
                  {previewRecord.title}
                </h3>
                <p className="text-[11px] font-mono text-text-muted truncate" dir="ltr">
                  📁 {previewRecord.fullStoragePath}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRecord(null)}
                className="p-1.5 rounded-lg bg-surface-hover text-text-muted hover:text-text-main cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {previewRecord.previewDataUrl && (
                <div className="flex justify-center bg-slate-100 dark:bg-slate-900 p-2 rounded-xl border border-surface-border">
                  <img
                    src={previewRecord.previewDataUrl}
                    alt={previewRecord.title}
                    className="max-h-[60vh] object-contain rounded-lg"
                  />
                </div>
              )}

              {previewRecord.textContent && (
                <div className="bg-surface-hover border border-surface-border rounded-xl p-3.5 text-xs leading-relaxed text-text-main whitespace-pre-wrap font-sans max-h-[55vh] overflow-y-auto select-text">
                  {previewRecord.textContent}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-surface-border bg-surface-hover/50 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => reshareRegisteredFileToWhatsApp(previewRecord)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{_t('إرسال عبر واتساب', 'Send WhatsApp', 'Per WhatsApp')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => reprintRegisteredFile(previewRecord)}
                  className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-text-main rounded-xl text-xs font-bold border border-surface-border inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-sky-600" />
                  <span>{_t('طباعة', 'Print', 'Drucken')}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRecord(null)}
                className="px-3 py-1.5 bg-surface border border-surface-border rounded-xl text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
              >
                {_t('إغلاق', 'Close', 'Schließen')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
