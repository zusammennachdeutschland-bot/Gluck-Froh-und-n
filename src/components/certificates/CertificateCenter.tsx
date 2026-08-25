import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CertificateRecord, CertificateTypeKey, CertificateLanguage, AICertificateBackground } from '../../types';
import { CERTIFICATE_TYPES } from '../../data/certificateTypes';
import { CreateCertificateModal } from './CreateCertificateModal';
import { BulkCertificateModal } from './BulkCertificateModal';
import { CertificatePreviewModal } from './CertificatePreviewModal';
import { AINameTransliterationModal } from './AINameTransliterationModal';
import { AIBackgroundDesignerModal } from './AIBackgroundDesignerModal';
import { downloadCertificatePDF, shareCertificateWhatsApp } from '../../utils/certificateExportUtils';
import { 
  Award, Plus, Sparkles, Layers, Search, Filter, Eye, Download, Share2, 
  Users, CheckCircle2, Star, Calendar, ArrowRight, UserCheck, ShieldCheck,
  Palette, Image as ImageIcon, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CertificateCenter: React.FC = () => {
  const { students, groups, certificates, deleteCertificate, _t, language } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'to_honor' | 'honored' | 'archive'>('to_honor');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState('all');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAIDesignerOpen, setIsAIDesignerOpen] = useState(false);
  const [selectedCustomBgForHonor, setSelectedCustomBgForHonor] = useState<AICertificateBackground | undefined>(undefined);
  const [selectedStudentForHonor, setSelectedStudentForHonor] = useState<string | undefined>(undefined);
  const [selectedCertForPreview, setSelectedCertForPreview] = useState<CertificateRecord | null>(null);
  const [editingCertificate, setEditingCertificate] = useState<CertificateRecord | undefined>(undefined);
  const [certToDelete, setCertToDelete] = useState<CertificateRecord | null>(null);

  // Active certificates (excluding deleted ones if any)
  const safeCertificates = certificates || [];
  const safeStudents = students || [];
  const safeGroups = groups || [];

  const activeCertificates = safeCertificates.filter(c => !c.deleted);

  // Set of students with certificates
  const honoredStudentIds = new Set(activeCertificates.map(c => c.studentId));
  const totalHonoredStudents = safeStudents.filter(s => honoredStudentIds.has(s.id)).length;

  // Filtered Students to Honor (Only those who DO NOT have any certificates yet)
  const studentsToHonor = safeStudents.filter(s => {
    if (s.status === 'archived') return false;
    if (honoredStudentIds.has(s.id)) return false; // Hide students who already have a certificate
    if (selectedGroupFilter !== 'all' && s.groupId !== selectedGroupFilter) return false;
    if (searchQuery.trim()) {
      const q = (searchQuery || '').toLowerCase();
      const nameMatch = (s.name || '').toLowerCase().includes(q) || (s.certificateName && s.certificateName.toLowerCase().includes(q));
      if (!nameMatch) return false;
    }
    return true;
  });

  // Filtered Honored Students
  const honoredStudentsList = safeStudents.filter(s => {
    if (!honoredStudentIds.has(s.id)) return false;
    if (selectedGroupFilter !== 'all' && s.groupId !== selectedGroupFilter) return false;
    if (searchQuery.trim()) {
      const q = (searchQuery || '').toLowerCase();
      const nameMatch = (s.name || '').toLowerCase().includes(q) || (s.certificateName && s.certificateName.toLowerCase().includes(q));
      if (!nameMatch) return false;
    }
    return true;
  });

  // Filtered Certificate Archive
  const filteredArchive = activeCertificates.filter(c => {
    if (selectedGroupFilter !== 'all' && c.groupId !== selectedGroupFilter) return false;
    if (selectedTypeFilter !== 'all' && c.type !== selectedTypeFilter) return false;
    if (selectedLanguageFilter !== 'all' && c.language !== selectedLanguageFilter) return false;
    if (searchQuery.trim()) {
      const q = (searchQuery || '').toLowerCase();
      const match = (c.studentName || '').toLowerCase().includes(q) ||
                    (c.studentCertificateName && c.studentCertificateName.toLowerCase().includes(q)) ||
                    (c.courseOrLevelTitle || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleOpenCreateForStudent = (stId: string) => {
    setSelectedStudentForHonor(stId);
    setEditingCertificate(undefined);
    setIsCreateModalOpen(true);
  };

  const handleEditCertificate = (cert: CertificateRecord) => {
    setEditingCertificate(cert);
    setSelectedStudentForHonor(cert.studentId);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-4 pb-12">
      
      {/* Top Banner / Hero Card */}
      <div className="p-3 sm:p-4 bg-linear-to-br from-amber-500/10 via-primary/5 to-surface dark:from-amber-950/20 dark:via-primary-soft dark:to-surface rounded-xl border border-amber-500/20 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shadow-amber-500/20 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-text-main flex items-center gap-2">
                <span>{_t('مركز الشهادات والتكريم', 'Certificate & Honors Center', 'Zertifikate- & Ehrencenter')}</span>
                <span className="text-[11px] px-2 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                  {activeCertificates.length}
                </span>
              </h1>
              <p className="text-[11px] text-text-muted">
                {_t('إصدار وتوثيق شهادات التقدير واجتياز المستويات والتميز لطلابك', 'Issue and manage professional achievement certificates for your students', 'Zertifikate für Ihre Schüler ausstellen und verwalten')}
              </p>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full sm:w-auto sm:flex sm:items-center">
            <button
              onClick={() => setIsAIDesignerOpen(true)}
              className="px-2 sm:px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold text-[10.5px] sm:text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
              title="AI Certificate Background Designer"
            >
              <Palette className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">{_t('مصمم خلفيات AI', 'AI Backgrounds', 'KI-Hintergründe')}</span>
            </button>

            <button
              onClick={() => setIsAiModalOpen(true)}
              className="px-2 sm:px-2.5 py-1.5 bg-surface dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-text-main border border-surface-border dark:border-slate-700 rounded-xl font-bold text-[10.5px] sm:text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 whitespace-nowrap"
              title="AI Name Transliteration"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{_t('أسماء الطلاب AI', 'AI Names', 'KI-Namen')}</span>
            </button>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="px-2 sm:px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10.5px] sm:text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{_t('تكريم جماعي', 'Bulk Issue', 'Gruppe ehren')}</span>
            </button>

            <button
              onClick={() => {
                setSelectedStudentForHonor(undefined);
                setSelectedCustomBgForHonor(undefined);
                setEditingCertificate(undefined);
                setIsCreateModalOpen(true);
              }}
              className="px-2.5 sm:px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-[10.5px] sm:text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3] shrink-0" />
              <span className="truncate">{_t('إصدار شهادة', 'New Certificate', 'Neues Zertifikat')}</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
          <div className="p-2 bg-surface/80 dark:bg-slate-900/80 rounded-lg border border-surface-border dark:border-slate-800">
            <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">
              {_t('إجمالي الشهادات', 'Total Issued', 'Ausgestellt')}
            </span>
            <span className="block text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">
              {activeCertificates.length}
            </span>
          </div>

          <div className="p-2 bg-surface/80 dark:bg-slate-900/80 rounded-lg border border-surface-border dark:border-slate-800">
            <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">
              {_t('الطلاب المكرمون', 'Honored Students', 'Geehrte Schüler')}
            </span>
            <span className="block text-sm sm:text-base font-black text-primary">
              {totalHonoredStudents} / {students.filter(s => s.status !== 'archived').length}
            </span>
          </div>

          <div className="p-2 bg-surface/80 dark:bg-slate-900/80 rounded-lg border border-surface-border dark:border-slate-800">
            <span className="block text-[9px] font-bold text-text-muted uppercase tracking-wider">
              {_t('المجموعات المكرمة', 'Active Groups', 'Gruppen')}
            </span>
            <span className="block text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
              {groups.length}
            </span>
          </div>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center justify-between gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-surface-border dark:border-slate-800">
        <button
          onClick={() => setActiveSubTab('to_honor')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
            activeSubTab === 'to_honor'
              ? 'bg-surface dark:bg-slate-900 text-primary shadow-2xs'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          {_t(`جاهز للتكريم (${studentsToHonor.length})`, `Ready to Honor (${studentsToHonor.length})`, `Bereit zur Ehrung (${studentsToHonor.length})`)}
        </button>

        <button
          onClick={() => setActiveSubTab('honored')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
            activeSubTab === 'honored'
              ? 'bg-surface dark:bg-slate-900 text-primary shadow-2xs'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          {_t(`الطلاب المكرمين (${honoredStudentsList.length})`, `Honored Students (${honoredStudentsList.length})`, `Geehrte Schüler (${honoredStudentsList.length})`)}
        </button>

        <button
          onClick={() => setActiveSubTab('archive')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
            activeSubTab === 'archive'
              ? 'bg-surface dark:bg-slate-900 text-primary shadow-2xs'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          {_t(`أرشيف الشهادات (${activeCertificates.length})`, `Certificate Archive (${activeCertificates.length})`, `Zertifikate-Archiv (${activeCertificates.length})`)}
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={_t('بحث باسم الطالب أو الكورس...', 'Search by student or course...', 'Nach Schüler oder Kurs suchen...')}
            className="w-full pl-8 pr-2.5 py-1.5 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-lg text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Group Filter */}
        <select
          value={selectedGroupFilter}
          onChange={e => setSelectedGroupFilter(e.target.value)}
          className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">{_t('جميع المجموعات', 'All Groups', 'Alle Gruppen')}</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        {activeSubTab === 'archive' && (
          <>
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">{_t('جميع أنواع الشهادات', 'All Types', 'Alle Typen')}</option>
              {CERTIFICATE_TYPES.map(t => (
                <option key={t.key} value={t.key}>{t.badgeEmoji} {t.titles[language] || t.titles.de}</option>
              ))}
            </select>

            <select
              value={selectedLanguageFilter}
              onChange={e => setSelectedLanguageFilter(e.target.value)}
              className="bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">{_t('جميع اللغات', 'All Languages', 'Alle Sprachen')}</option>
              <option value="de">Deutsch 🇩🇪</option>
              <option value="en">English 🇬🇧</option>
              <option value="ar">العربية 🇸🇦</option>
            </select>
          </>
        )}
      </div>

      {/* SUB TAB 1: STUDENTS TO HONOR */}
      {activeSubTab === 'to_honor' && (
        <div>
          {studentsToHonor.length === 0 ? (
            <div className="p-6 text-center bg-surface dark:bg-slate-900 rounded-xl border border-surface-border dark:border-slate-800 space-y-1.5">
              <Award className="w-8 h-8 text-text-muted/40 mx-auto" />
              <h3 className="font-black text-xs sm:text-sm text-text-main">{_t('لا يوجد طلاب مطابقين للبحث', 'No students found', 'Keine Schüler gefunden')}</h3>
              <p className="text-[11px] text-text-muted">{_t('قم بتغيير خيارات التصفية أو البحث', 'Try adjusting your search filters', 'Passen Sie Ihre Suchfilter an')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {studentsToHonor.map(student => {
              const grp = groups.find(g => g.id === student.groupId);
              const studentCerts = activeCertificates.filter(c => c.studentId === student.id);
              const hasCertificates = studentCerts.length > 0;

              return (
                <div
                  key={student.id}
                  className="p-2.5 sm:p-3 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-lg flex items-center justify-between gap-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 text-xs">
                      {student.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-xs text-text-main truncate">
                          {student.name}
                        </h4>
                        {student.certificateName && (
                          <span className="text-[10px] font-bold text-text-muted truncate hidden sm:inline" dir="ltr">
                            ({student.certificateName})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-0.5 truncate">
                        <span>{grp?.name || 'Ohne Gruppe'}</span>
                        <span>•</span>
                        {hasCertificates ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            {studentCerts.length} {_t('شهادات ممنوحة', 'certificates awarded', 'Zertifikate')}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">
                            {_t('لم يتم تكريمه بعد', 'Not yet honored', 'Noch nicht geehrt')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenCreateForStudent(student.id)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-black text-xs flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                    >
                      <Award className="w-3 h-3" />
                      <span>{_t('تكريم الطالب', 'Honor Student', 'Schüler ehren')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* SUB TAB 2: HONORED STUDENTS */}
      {activeSubTab === 'honored' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {honoredStudentsList.length === 0 ? (
            <div className="p-6 text-center bg-surface dark:bg-slate-900 rounded-xl border border-surface-border dark:border-slate-800 space-y-1.5 col-span-full">
              <Award className="w-8 h-8 text-amber-500/40 mx-auto" />
              <h3 className="font-black text-xs sm:text-sm text-text-main">{_t('لم يتم إصدار شهادات بعد', 'No honored students yet', 'Noch keine geehrten Schüler')}</h3>
              <p className="text-[11px] text-text-muted">{_t('ابدأ بإصدار شهادات لطلابك المتميزين', 'Start issuing certificates to your outstanding students', 'Stellen Sie Zertifikate für Ihre Schüler aus')}</p>
            </div>
          ) : (
            honoredStudentsList.map(student => {
              const grp = groups.find(g => g.id === student.groupId);
              const studentCerts = activeCertificates.filter(c => c.studentId === student.id);

              return (
                <div
                  key={student.id}
                  className="p-3 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-lg space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-text-main truncate">
                          {student.name}
                        </h4>
                        <span className="text-[10px] text-text-muted">
                          {grp?.name || 'Gruppe'} • {studentCerts.length} {_t('شهادات موثقة', 'certificates', 'Zertifikate')}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenCreateForStudent(student.id)}
                      className="px-2 py-1 bg-surface dark:bg-slate-800 border border-surface-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-text-main rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-primary" />
                      <span>{_t('شهادة إضافية', 'Add Another', 'Weiteres')}</span>
                    </button>
                  </div>

                  {/* Issued Certificates List for this student */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-surface-border dark:border-slate-800">
                    {studentCerts.map(cert => (
                      <div
                        key={cert.id}
                        onClick={() => setSelectedCertForPreview(cert)}
                        className="p-2 bg-slate-50 dark:bg-slate-800/40 border border-surface-border dark:border-slate-800 rounded-lg flex items-center justify-between gap-1.5 hover:border-primary/40 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="block font-black text-xs text-text-main truncate">{cert.courseOrLevelTitle}</span>
                          <span className="block text-[9px] text-text-muted truncate">{cert.issueDate} • {cert.type}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              downloadCertificatePDF(cert);
                            }}
                            className="p-1 text-text-muted hover:text-primary transition-colors cursor-pointer"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              shareCertificateWhatsApp(cert, student.parentPhone || student.studentPhone);
                            }}
                            className="p-1 text-text-muted hover:text-emerald-500 transition-colors cursor-pointer"
                            title="Share"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setCertToDelete(cert);
                            }}
                            className="p-1 text-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUB TAB 3: CERTIFICATE ARCHIVE */}
      {activeSubTab === 'archive' && (
        <div className="space-y-2.5">
          {filteredArchive.length === 0 ? (
            <div className="p-6 text-center bg-surface dark:bg-slate-900 rounded-xl border border-surface-border dark:border-slate-800 space-y-1.5">
              <Award className="w-8 h-8 text-text-muted/40 mx-auto" />
              <h3 className="font-black text-xs sm:text-sm text-text-main">{_t('لا توجد شهادات في الأرشيف', 'No certificates found', 'Keine Zertifikate gefunden')}</h3>
              <p className="text-[11px] text-text-muted">{_t('قم بإصدار شهادات جديدة لتظهر هنا في الأرشيف', 'Issued certificates will be archived here', 'Ausgestellte Zertifikate werden hier archiviert')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredArchive.map(cert => {
                const st = students.find(s => s.id === cert.studentId);
                const typeConfig = CERTIFICATE_TYPES.find(t => t.key === cert.type);

                return (
                  <div
                    key={cert.id}
                    className="p-3 bg-surface dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-lg flex flex-col justify-between gap-2 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                          {typeConfig?.titles[language] || typeConfig?.titles.de || cert.type || cert.certificateType}
                        </span>
                        <span className="text-[10px] font-bold text-text-muted">
                          {cert.issueDate}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-black text-xs text-text-main truncate">
                          {cert.studentName}
                        </h4>
                        <span className="block text-[11px] font-bold text-primary truncate mt-0.5">
                          {cert.courseOrLevelTitle}
                        </span>
                        {cert.description && (
                          <p className="text-[10px] text-text-muted line-clamp-2 mt-0.5">
                            {cert.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-surface-border dark:border-slate-800 text-xs">
                      <span className="text-[10px] text-text-muted font-bold truncate">
                        {cert.centerOrSchoolName || cert.instructorName}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedCertForPreview(cert)}
                          className="p-1.5 bg-slate-50 dark:bg-slate-800 text-text-main hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => downloadCertificatePDF(cert)}
                          className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => shareCertificateWhatsApp(cert, st?.parentPhone || st?.studentPhone)}
                          className="p-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setCertToDelete(cert)}
                          className="p-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateCertificateModal
          initialStudentId={selectedStudentForHonor}
          initialCertificate={editingCertificate}
          initialCustomBackground={selectedCustomBgForHonor}
          onOpenAIDesigner={() => {
            setIsCreateModalOpen(false);
            setIsAIDesignerOpen(true);
          }}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingCertificate(undefined);
            setSelectedStudentForHonor(undefined);
            setSelectedCustomBgForHonor(undefined);
          }}
        />
      )}

      {isBulkModalOpen && (
        <BulkCertificateModal
          onClose={() => setIsBulkModalOpen(false)}
        />
      )}

      {isAiModalOpen && (
        <AINameTransliterationModal
          onClose={() => setIsAiModalOpen(false)}
        />
      )}

      {isAIDesignerOpen && (
        <AIBackgroundDesignerModal
          onClose={() => setIsAIDesignerOpen(false)}
          onSelectBackgroundForIssue={(bg) => {
            setSelectedCustomBgForHonor(bg);
            setIsAIDesignerOpen(false);
            setIsCreateModalOpen(true);
          }}
        />
      )}

      {selectedCertForPreview && (
        <CertificatePreviewModal
          certificate={selectedCertForPreview}
          onClose={() => setSelectedCertForPreview(null)}
          onEdit={handleEditCertificate}
        />
      )}

      {certToDelete && (
        <div onClick={() => setCertToDelete(null)} className="fixed inset-0 z-55 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="bg-surface dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full border border-surface-border dark:border-slate-800 shadow-2xl space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="font-black text-base text-text-main">
                {_t('حذف الشهادة؟', 'Delete Certificate?', 'Zertifikat löschen?')}
              </h4>
              <p className="text-xs text-text-muted">
                {_t(
                  `هل أنت متأكد من حذف شهادة الطالب "${certToDelete.studentName}"؟`,
                  `Are you sure you want to delete the certificate for "${certToDelete.studentName}"?`,
                  `Sind Sie sicher, dass Sie das Zertifikat für "${certToDelete.studentName}" löschen möchten?`
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setCertToDelete(null)}
                className="py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main rounded-xl font-bold text-xs transition-colors cursor-pointer text-center"
              >
                {_t('إلغاء', 'Cancel', 'Abbrechen')}
              </button>
              <button
                onClick={() => {
                  deleteCertificate(certToDelete.id);
                  setCertToDelete(null);
                }}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition-colors cursor-pointer text-center"
              >
                {_t('حذف', 'Delete', 'Löschen')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
