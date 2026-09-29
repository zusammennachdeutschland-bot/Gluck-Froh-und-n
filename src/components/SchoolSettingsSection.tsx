import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SchoolSettings, SchoolDayPresence, SchoolPeriodSettings, StageManager, StageSecretary } from '../types';
import { 
  Clock, Calendar, BookOpen, Save, CheckCircle2, 
  Plus, Trash2, ArrowRight, ArrowLeft,
  Upload, User, Shield, Layers, RotateCcw, Sliders
} from 'lucide-react';
import { 
  getSchoolSettings, 
  calculatePeriodsTimings 
} from '../utils/schoolUtils';

interface Props {
  onBack?: () => void;
}

const GRADE_BANDS_CONFIG = [
  { value: 'Grades 1–3', label: 'Grades 1–3 (الصفوف 1، 2، 3)', grades: ['Grade 1', 'Grade 2', 'Grade 3'] },
  { value: 'Grades 4–6', label: 'Grades 4–6 (الصفوف 4، 5، 6)', grades: ['Grade 4', 'Grade 5', 'Grade 6'] },
  { value: 'Grades 7–9', label: 'Grades 7–9 (الصفوف 7، 8، 9)', grades: ['Grade 7', 'Grade 8', 'Grade 9'] },
  { value: 'Grades 10–12', label: 'Grades 10–12 (الصفوف 10، 11، 12)', grades: ['Grade 10', 'Grade 11', 'Grade 12'] }
];

export const SchoolSettingsSection: React.FC<Props> = ({ onBack }) => {
  const { profile, updateProfile, language, _t, t } = useApp();
  
  const currentSettings = getSchoolSettings(profile);
  
  // School & Department Info State
  const [schoolName, setSchoolName] = useState<string>(currentSettings.schoolName || '');
  const [departmentName, setDepartmentName] = useState<string>(currentSettings.departmentName || '');
  const [academicYear, setAcademicYear] = useState<string>(currentSettings.academicYear || '');
  const [currentTerm, setCurrentTerm] = useState<string>(currentSettings.currentTerm || 'Term 1');
  const [hodName, setHodName] = useState<string>(currentSettings.hodName || profile?.displayName || '');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string>(currentSettings.schoolLogoUrl || '');

  // Stage Managers State
  const [stageManagers, setStageManagers] = useState<StageManager[]>(currentSettings.stageManagers || []);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerPhone, setNewManagerPhone] = useState('');
  const [newManagerBand, setNewManagerBand] = useState('Grades 4–6');

  // Stage Secretaries State
  const [stageSecretaries, setStageSecretaries] = useState<StageSecretary[]>(currentSettings.stageSecretaries || []);
  const [newSecName, setNewSecName] = useState('');
  const [newSecPhone, setNewSecPhone] = useState('');
  const [newSecManagerId, setNewSecManagerId] = useState(stageManagers?.[0]?.id || '');

  // Presence State
  const [generalArrival, setGeneralArrival] = useState<string>(() => {
    const presenceObj = currentSettings?.presence || {};
    const firstActive = Object.values(presenceObj).find(p => p?.active);
    return firstActive?.arrivalTime || '07:30';
  });
  const [generalDeparture, setGeneralDeparture] = useState<string>(() => {
    const presenceObj = currentSettings?.presence || {};
    const firstActive = Object.values(presenceObj).find(p => p?.active);
    return firstActive?.departureTime || '14:30';
  });
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>(() => {
    const res: Record<string, boolean> = {};
    const presenceObj = currentSettings?.presence || {};
    Object.keys(presenceObj).forEach(k => {
      res[k] = !!presenceObj[k]?.active;
    });
    return res;
  });

  const [periodsCount, setPeriodsCount] = useState<number>(currentSettings.periodSettings.periodsCount);
  const [firstPeriodStart, setFirstPeriodStart] = useState<string>(currentSettings.periodSettings.firstPeriodStart);
  const [defaultDuration, setDefaultDuration] = useState<number>(currentSettings.periodSettings.defaultDuration);
  const [customDurations, setCustomDurations] = useState<Record<number, number>>(
    currentSettings.periodSettings.customDurations || {}
  );
  const [periodViewMode, setPeriodViewMode] = useState<'cards' | 'table'>('cards');

  const handlePeriodDurationChange = (periodNumber: number, durationMinutes: number) => {
    const safeDuration = Math.max(10, Math.min(240, Math.round(durationMinutes)));
    setCustomDurations(prev => {
      const next = { ...prev };
      if (safeDuration === defaultDuration) {
        delete next[periodNumber];
        delete (next as any)[String(periodNumber)];
      } else {
        next[periodNumber] = safeDuration;
      }
      return next;
    });
  };

  const handleResetPeriodDuration = (periodNumber: number) => {
    setCustomDurations(prev => {
      const next = { ...prev };
      delete next[periodNumber];
      delete (next as any)[String(periodNumber)];
      return next;
    });
  };

  const handleResetAllDurations = () => {
    setCustomDurations({});
  };
  
  const [showToast, setShowToast] = useState(false);
  const isRtl = language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const daysList = [
    { key: '0', label: _t('الأحد', 'Sunday', 'Sonntag') },
    { key: '1', label: _t('الإثنين', 'Monday', 'Montag') },
    { key: '2', label: _t('الثلاثاء', 'Tuesday', 'Dienstag') },
    { key: '3', label: _t('الأربعاء', 'Wednesday', 'Mittwoch') },
    { key: '4', label: _t('الخميس', 'Thursday', 'Donnerstag') },
    { key: '5', label: _t('الجمعة', 'Friday', 'Freitag') },
    { key: '6', label: _t('السبت', 'Saturday', 'Samstag') }
  ];

  const periodSettingsObj: SchoolPeriodSettings = {
    periodsCount,
    firstPeriodStart,
    defaultDuration,
    customDurations
  };
  const generatedPeriods = calculatePeriodsTimings(periodSettingsObj);

  // Logo file upload handler with robust base64 persistence
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64Data = event.target.result as string;
        setSchoolLogoUrl(base64Data);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add Manager with predefined Grade Band
  const handleAddManager = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManagerName) return;
    const bandConfig = GRADE_BANDS_CONFIG.find(b => b.value === newManagerBand) || GRADE_BANDS_CONFIG[1];
    const item: StageManager = {
      id: Date.now().toString(),
      name: newManagerName,
      phone: newManagerPhone,
      gradeBand: bandConfig.value,
      assignedGradeGroups: bandConfig.grades
    };
    setStageManagers([...stageManagers, item]);
    setNewManagerName('');
    setNewManagerPhone('');
  };

  const handleDeleteManager = (id: string) => {
    setStageManagers(stageManagers.filter(m => m.id !== id));
    // Also remove or unlink secretaries linked to this manager
    setStageSecretaries(stageSecretaries.filter(s => s.stageManagerId !== id));
  };

  // Add Secretary mapped to Stage Manager
  const handleAddSecretary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecName) return;
    const targetManagerId = newSecManagerId || stageManagers[0]?.id || 'm1';
    const item: StageSecretary = {
      id: Date.now().toString(),
      name: newSecName,
      phone: newSecPhone,
      stageManagerId: targetManagerId
    };
    setStageSecretaries([...stageSecretaries, item]);
    setNewSecName('');
    setNewSecPhone('');
  };

  const handleDeleteSecretary = (id: string) => {
    setStageSecretaries(stageSecretaries.filter(s => s.id !== id));
  };

  // Handle saving to profile & persistent storage
  const handleSaveSettings = () => {
    const updatedPresence: Record<string, SchoolDayPresence> = {};
    daysList.forEach(day => {
      updatedPresence[day.key] = {
        active: !!activeDays[day.key],
        arrivalTime: generalArrival,
        departureTime: generalDeparture
      };
    });

    const updatedSchoolSettings: SchoolSettings = {
      ...currentSettings,
      presence: updatedPresence,
      periodSettings: {
        periodsCount,
        firstPeriodStart,
        defaultDuration,
        customDurations
      },
      schoolName,
      departmentName,
      academicYear,
      currentTerm,
      hodName,
      schoolLogoUrl,
      stageManagers,
      stageSecretaries
    };

    updateProfile({
      schoolSettings: updatedSchoolSettings
    });

    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  return (
    <div className="space-y-4" id="school-settings-container">
      {/* Save Toast Banner */}
      {showToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg font-bold text-xs animate-bounce" id="school-toast-alert">
          <CheckCircle2 className="w-4 h-4" />
          <span>{_t('تم حفظ إعدادات المدرسة بنجاح!', 'School settings saved successfully!', 'Schuleinstellungen erfolgreich gespeichert!')}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="pb-2.5 mb-3.5 border-b border-surface-border/80 dark:border-surface-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="lg:hidden p-1.5 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main hover:text-primary transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs border border-surface-border/60 active:scale-95"
                title={t('auto_back_to_settings')}
              >
                <BackIcon className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="p-1.5 rounded-lg bg-primary-soft text-primary dark:text-primary border border-primary-border/50 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>

            <h2 className="text-sm sm:text-base font-black text-text-main leading-tight">
              {_t('إعدادات المدرسة والقسم (School & HOD Settings)', 'School & Department Settings', 'Schul- & Fachbereichseinstellungen')}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleSaveSettings}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{_t('حفظ التغييرات', 'Save Changes', 'Änderungen speichern')}</span>
          </button>
        </div>

        <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
          {_t('إدارة بيانات المدرسة، شعار الطباعة، مديري المراحل، السكرتيرات، ومواعيد الحصص اليومية.', 'Manage school details, printable logo, stage managers, secretaries, and daily school schedules.', 'Schuldetails und Verwaltung verwalten.')}
        </p>
      </div>

      {/* SECTION 1: School & Department Info & Logo */}
      <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-4 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <span>{_t('بيانات المدرسة والفلتر الرسمي للطباعة', 'School & Department Information', 'Schul- & Fachbereichsinformationen')}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">{_t('اسم المدرسة', 'School Name', 'Schulname')}</label>
            <input
              type="text"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">{_t('اسم القسم', 'Department Name', 'Fachbereich')}</label>
            <input
              type="text"
              value={departmentName}
              onChange={e => setDepartmentName(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">{_t('العام الدراسي', 'Academic Year', 'Schuljahr')}</label>
            <input
              type="text"
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main"
            />
          </div>

          {/* Strict Term Selector */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">{_t('الفصل الدراسي الحالي', 'Current Term', 'Aktuelles Halbjahr')}</label>
            <select
              value={currentTerm}
              onChange={e => setCurrentTerm(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="Term 1">{_t('الترم الأول (Term 1)', 'Term 1', 'Term 1')}</option>
              <option value="Term 2">{_t('الترم الثاني (Term 2)', 'Term 2', 'Term 2')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">{_t('رئيس القسم (HOD Name)', 'Head of Department (HOD)', 'Fachleiter')}</label>
            <input
              type="text"
              value={hodName}
              onChange={e => setHodName(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main"
            />
          </div>

          {/* School Logo Upload & Persistent Preview */}
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-bold text-text-main">{_t('شعار المدرسة (للتقارير والطباعة)', 'School Logo (PDF Printable)', 'Schullogo (Druck)')}</label>
            <div className="flex items-center gap-2">
              {schoolLogoUrl ? (
                <div className="flex items-center gap-3 bg-surface-hover p-2 rounded-xl border border-surface-border w-full">
                  <img src={schoolLogoUrl} alt="Logo" className="w-10 h-10 rounded object-contain bg-white shrink-0" />
                  <span className="text-[11px] font-bold text-text-main flex-1">{_t('تم حفظ الشعار في التخزين المحلي', 'Logo stored locally', 'Logo lokal gespeichert')}</span>
                  <button
                    type="button"
                    onClick={() => setSchoolLogoUrl('')}
                    className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                    title={_t('حذف الشعار', 'Delete Logo', 'Logo löschen')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-3 sm:py-2 bg-surface-hover hover:bg-surface-border/50 border border-dashed border-surface-border rounded-xl text-xs font-bold text-text-muted cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-primary" />
                  <span>{_t('اختر صورة الشعار...', 'Upload Logo...', 'Logo hochladen...')}</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Stage Managers Setup with Predefined Grade Bands */}
      <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-4 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span>{_t('مديرو المراحل الدراسية (Stage Managers)', 'Stage Managers Setup', 'Stufenleiter-Verwaltung')}</span>
        </h3>

        <form onSubmit={handleAddManager} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <input
            type="text"
            placeholder={_t('اسم مدير المرحلة', 'Manager Name', 'Name')}
            value={newManagerName}
            onChange={e => setNewManagerName(e.target.value)}
            required
            className="px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main"
          />
          <input
            type="text"
            placeholder={_t('رقم الهاتف (اختياري)', 'Phone Number (optional)', 'Telefon')}
            value={newManagerPhone}
            onChange={e => setNewManagerPhone(e.target.value)}
            className="px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={newManagerBand}
              onChange={e => setNewManagerBand(e.target.value)}
              className="flex-1 px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {GRADE_BANDS_CONFIG.map(band => (
                <option key={band.value} value={band.value}>{band.label}</option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{_t('إضافة', 'Add', 'Hinzufügen')}</span>
            </button>
          </div>
        </form>

        <div className="space-y-2 pt-2">
          {stageManagers.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">{_t('لا يوجد مديرو مراحل مسجلين حالياً', 'No stage managers registered yet', 'Noch keine Stufenleiter')}</p>
          ) : (
            stageManagers.map(m => (
              <div key={m.id} className="p-3 bg-surface-hover border border-surface-border rounded-xl flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-main">{m.name}</span>
                    <span className="text-[11px] text-text-muted">{m.phone}</span>
                    <span className="px-2 py-0.5 bg-primary-soft text-primary text-[10px] font-black rounded-lg border border-primary-border">
                      {m.gradeBand}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(m.assignedGradeGroups || []).map((g, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-text-muted text-[10px] font-bold rounded">{g}</span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteManager(m.id)}
                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                  title={_t('حذف', 'Delete', 'Löschen')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 3: Relational Stage Secretary Mapping */}
      <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-4 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-primary" />
          <span>{_t('سكرتيرات المراحل (Relational Stage Secretaries)', 'Stage Secretaries Mapping', 'Sekretariat-Zuordnung')}</span>
        </h3>

        <form onSubmit={handleAddSecretary} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <input
            type="text"
            placeholder={_t('اسم السكرتيرة', 'Secretary Name', 'Name')}
            value={newSecName}
            onChange={e => setNewSecName(e.target.value)}
            required
            className="px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main"
          />
          <input
            type="text"
            placeholder={_t('رقم الهاتف (اختياري)', 'Phone Number (optional)', 'Telefon')}
            value={newSecPhone}
            onChange={e => setNewSecPhone(e.target.value)}
            className="px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={newSecManagerId}
              onChange={e => setNewSecManagerId(e.target.value)}
              className="flex-1 px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {stageManagers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.gradeBand})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{_t('إضافة', 'Add', 'Hinzufügen')}</span>
            </button>
          </div>
        </form>

        <div className="space-y-2 pt-2">
          {stageSecretaries.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">{_t('لا توجد سكرتيرات مسجلات حالياً', 'No stage secretaries registered yet', 'Noch keine Sekretärinnen')}</p>
          ) : (
            stageSecretaries.map(s => {
              const linkedManager = stageManagers.find(m => m.id === s.stageManagerId);
              return (
                <div key={s.id} className="p-3 bg-surface-hover border border-surface-border rounded-xl flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-main">{s.name}</span>
                      <span className="text-[11px] text-text-muted">{s.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-text-muted">{_t('تتبع لمدير المرحلة:', 'Belongs to Stage Manager:', 'Zugeordnet zu Stufenleiter:')}</span>
                      <span className="font-bold text-primary">
                        {linkedManager ? `${linkedManager.name} (${linkedManager.gradeBand})` : _t('مدير محذوف', 'Unassigned / Deleted', 'Nicht zugeordnet')}
                      </span>
                    </div>
                    {linkedManager && (
                      <div className="flex flex-wrap gap-1">
                        {(linkedManager.assignedGradeGroups || []).map((g, i) => (
                          <span key={i} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold rounded">{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSecretary(s.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                    title={_t('حذف', 'Delete', 'Löschen')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 4: Presence Times */}
      <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-4 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>{_t('أوقات التواجد في المدرسة', 'School Presence Times', 'Schulpräsenzzeiten')}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('وقت الحضور العام', 'School Attendance Time (Arrival)', 'Ankunftszeit')}
            </label>
            <input
              type="time"
              value={generalArrival}
              onChange={(e) => setGeneralArrival(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('وقت الانصراف العام', 'School Departure Time (Departure)', 'Abfahrtszeit')}
            </label>
            <input
              type="time"
              value={generalDeparture}
              onChange={(e) => setGeneralDeparture(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main font-mono"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-surface-border/60 space-y-2">
          <label className="text-xs font-bold text-text-main block">
            {_t('أيام المدرسة المفعلة', 'Active School Days', 'Aktive Schultage')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
            {daysList.map((day) => {
              const isActive = activeDays[day.key];
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => {
                    setActiveDays(prev => ({
                      ...prev,
                      [day.key]: !prev[day.key]
                    }));
                  }}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                    isActive
                      ? 'bg-primary-soft border-primary-border text-primary'
                      : 'bg-surface-hover border-surface-border text-slate-500'
                  }`}
                >
                  <div className="truncate">{day.label}</div>
                  <div className={`text-[9px] mt-0.5 font-bold ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                    {isActive ? _t('مفعل', 'Active', 'Aktiv') : _t('مغلق', 'Off', 'Aus')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 5: Period Config */}
      <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-border/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{_t('إعداد وتوقيتات الحصص المدرسية', 'School Period Structure & Timings', 'Schulstunden & Zeiten')}</span>
          </h3>

          {Object.keys(customDurations).length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                {_t(
                  `تم تخصيص مدة ${Object.keys(customDurations).length} حصص يدوياً`,
                  `${Object.keys(customDurations).length} periods with custom durations`,
                  `${Object.keys(customDurations).length} Stunden manuell angepasst`
                )}
              </span>
              <button
                type="button"
                onClick={handleResetAllDurations}
                className="text-[10px] font-bold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                title={_t('إعادة ضبط جميع الحصص للمدة الافتراضية', 'Reset all periods to default duration', 'Alle Stunden auf Standarddauer zurücksetzen')}
              >
                <RotateCcw className="w-3 h-3" />
                <span>{_t('استعادة الافتراضي للكل', 'Reset All', 'Alle zurücksetzen')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Global Period Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main flex items-center justify-between">
              <span>{_t('عدد الحصص اليومية', 'Daily Periods Count', 'Tägliche Stundenanzahl')}</span>
              <span className="text-[10px] font-normal text-text-muted">1 - 12</span>
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={periodsCount}
              onChange={(e) => setPeriodsCount(Math.max(1, Math.min(12, parseInt(e.target.value) || 7)))}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('بداية الحصة الأولى', 'First Period Start', 'Beginn 1. Stunde')}
            </label>
            <input
              type="time"
              value={firstPeriodStart}
              onChange={(e) => setFirstPeriodStart(e.target.value || '08:00')}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main flex items-center justify-between">
              <span>{_t('مدة الحصة الافتراضية', 'Default Duration', 'Standard-Dauer')}</span>
              <span className="text-[10px] font-normal text-text-muted">{_t('دقيقة', 'mins', 'Min.')}</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="15"
                max="120"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Math.max(15, Math.min(120, parseInt(e.target.value) || 45)))}
                className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main font-mono"
              />
              <button
                type="button"
                onClick={handleResetAllDurations}
                className="px-2.5 py-2.5 sm:py-2 text-[11px] font-bold bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main rounded-xl border border-surface-border whitespace-nowrap cursor-pointer transition-all"
                title={_t('تطبيق هذه المدة على كافة الحصص وإلغاء التخصيص اليدوي', 'Apply to all periods & clear manual overrides', 'Auf alle anwenden')}
              >
                {_t('تطبيق للكل', 'Apply to All', 'Auf alle')}
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Manual Duration Editing & Live Preview */}
        <div className="pt-2 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-text-main flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" />
                <span>{_t('تعديل الوقت الإجمالي لكل حصة يدوياً:', 'Manual Period Duration Customization:', 'Manuelle Dauer jeder Stunde:')}</span>
              </h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                {_t(
                  'يمكنك كتابة أو تغيير مدة أي حصة بالدقائق مباشرة. يتم تلقائياً تحديث مواعيد البداية والنهاية لكافة الحصص اللاحقة وانعكاسها فورياً في الجداول والسيستم.',
                  'Directly adjust the duration (mins) for each period. Start & end times recalculate dynamically across all tables and system.',
                  'Passen Sie die Minutenzahl jeder Stunde an. Folgezeiten werden automatisch im System neu berechnet.'
                )}
              </p>
            </div>

            {/* View layout toggle: Cards or Table */}
            <div className="flex items-center gap-1 bg-surface-hover p-0.5 rounded-lg border border-surface-border self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setPeriodViewMode('cards')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  periodViewMode === 'cards' 
                    ? 'bg-surface text-primary shadow-2xs font-black' 
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {_t('بطاقات', 'Cards', 'Karten')}
              </button>
              <button
                type="button"
                onClick={() => setPeriodViewMode('table')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  periodViewMode === 'table' 
                    ? 'bg-surface text-primary shadow-2xs font-black' 
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {_t('جدول تفصيلي', 'Table', 'Tabelle')}
              </button>
            </div>
          </div>

          {/* Cards View */}
          {periodViewMode === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-1">
              {generatedPeriods.map((p) => {
                const isCustom = p.isCustom;
                return (
                  <div 
                    key={p.periodNumber} 
                    className={`p-3 rounded-xl border transition-all space-y-2 relative ${
                      isCustom 
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/40 dark:border-amber-500/50 shadow-xs' 
                        : 'bg-surface-hover border-surface-border'
                    }`}
                  >
                    {/* Top Row: Period Number & Custom Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black font-mono ${
                          isCustom ? 'bg-amber-500 text-white' : 'bg-primary text-white'
                        }`}>
                          {p.periodNumber}
                        </span>
                        <span className="text-xs font-black text-text-main">
                          {_t('الحصة', 'Period', 'Stunde')} {p.periodNumber}
                        </span>
                      </div>

                      {isCustom ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            {_t('معدلة', 'Custom', 'Manuell')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResetPeriodDuration(p.periodNumber)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            title={_t(`استعادة المدة الافتراضية (${defaultDuration} دقيقة)`, `Reset to default (${defaultDuration}m)`, `Zurücksetzen (${defaultDuration}m)`)}
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] text-text-muted font-medium">
                          {_t('افتراضية', 'Default', 'Standard')}
                        </span>
                      )}
                    </div>

                    {/* Middle Row: Calculated Timings */}
                    <div className="flex items-center justify-between bg-surface/80 dark:bg-surface/50 px-2.5 py-1.5 rounded-lg border border-surface-border/60">
                      <span className="text-[10px] text-text-muted font-medium">
                        {_t('التوقيت:', 'Timing:', 'Zeit:')}
                      </span>
                      <span className="text-xs font-mono font-black text-primary dir-ltr">
                        {p.startTime} - {p.endTime}
                      </span>
                    </div>

                    {/* Bottom Row: Duration Stepper / Number input */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-text-main">
                          {_t('الوقت الإجمالي:', 'Total Duration:', 'Gesamtdauer:')}
                        </span>
                        <span className="font-mono text-text-muted font-bold">
                          {p.duration} {_t('دقيقة', 'mins', 'Min.')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handlePeriodDurationChange(p.periodNumber, p.duration - 5)}
                          className="w-7 h-7 rounded-lg bg-surface hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main font-black text-xs border border-surface-border flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-2xs"
                          title="-5 mins"
                        >
                          -5
                        </button>
                        
                        <input
                          type="number"
                          min="10"
                          max="180"
                          step="1"
                          value={p.duration}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              handlePeriodDurationChange(p.periodNumber, val);
                            }
                          }}
                          className="flex-1 text-center font-mono font-black text-xs py-1 px-1 bg-surface border border-surface-border rounded-lg text-text-main shadow-2xs focus:ring-1 focus:ring-primary"
                        />

                        <button
                          type="button"
                          onClick={() => handlePeriodDurationChange(p.periodNumber, p.duration + 5)}
                          className="w-7 h-7 rounded-lg bg-surface hover:bg-slate-200 dark:hover:bg-slate-700 text-text-main font-black text-xs border border-surface-border flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-2xs"
                          title="+5 mins"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table View */}
          {periodViewMode === 'table' && (
            <div className="overflow-x-auto border border-surface-border rounded-xl">
              <table className="w-full text-xs text-start">
                <thead className="bg-surface-hover border-b border-surface-border text-text-muted font-bold">
                  <tr>
                    <th className="p-2.5 text-center w-14">#</th>
                    <th className="p-2.5 text-start">{_t('الحصة', 'Period', 'Stunde')}</th>
                    <th className="p-2.5 text-center">{_t('بداية الحصة', 'Start Time', 'Beginn')}</th>
                    <th className="p-2.5 text-center">{_t('نهاية الحصة', 'End Time', 'Ende')}</th>
                    <th className="p-2.5 text-center">{_t('الوقت الإجمالي (دقيقة)', 'Total Duration (mins)', 'Gesamtdauer (Min.)')}</th>
                    <th className="p-2.5 text-center">{_t('الحالة', 'Status', 'Status')}</th>
                    <th className="p-2.5 text-center">{_t('إجراء', 'Action', 'Aktion')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {generatedPeriods.map((p) => {
                    const isCustom = p.isCustom;
                    return (
                      <tr 
                        key={p.periodNumber}
                        className={`hover:bg-surface-hover/60 transition-colors ${
                          isCustom ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center font-mono font-bold text-primary">
                          {p.periodNumber}
                        </td>
                        <td className="p-2.5 font-bold text-text-main">
                          {_t('الحصة', 'Period', 'Stunde')} {p.periodNumber}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-text-main">
                          {p.startTime}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-text-main">
                          {p.endTime}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 max-w-[140px] mx-auto">
                            <button
                              type="button"
                              onClick={() => handlePeriodDurationChange(p.periodNumber, p.duration - 5)}
                              className="w-6 h-6 rounded bg-surface hover:bg-slate-200 dark:hover:bg-slate-700 border border-surface-border flex items-center justify-center text-[11px] font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="10"
                              max="180"
                              value={p.duration}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) handlePeriodDurationChange(p.periodNumber, val);
                              }}
                              className="w-14 text-center py-1 font-mono font-black text-xs bg-surface border border-surface-border rounded shadow-2xs"
                            />
                            <button
                              type="button"
                              onClick={() => handlePeriodDurationChange(p.periodNumber, p.duration + 5)}
                              className="w-6 h-6 rounded bg-surface hover:bg-slate-200 dark:hover:bg-slate-700 border border-surface-border flex items-center justify-center text-[11px] font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          {isCustom ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              {_t('معدلة يدوياً', 'Customized', 'Manuell')}
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-muted">
                              {_t('افتراضية', 'Default', 'Standard')}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {isCustom ? (
                            <button
                              type="button"
                              onClick={() => handleResetPeriodDuration(p.periodNumber)}
                              className="px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title={_t('استعادة المدة الافتراضية', 'Reset to default duration', 'Auf Standard zurücksetzen')}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{_t('استعادة', 'Reset', 'Reset')}</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
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
      </div>
    </div>
  );
};
