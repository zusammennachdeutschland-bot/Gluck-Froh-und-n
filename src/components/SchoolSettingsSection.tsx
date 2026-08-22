import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SchoolSettings, SchoolDayPresence, SchoolPeriodSettings, StageManager, StageSecretary } from '../types';
import { 
  Clock, Calendar, BookOpen, Save, CheckCircle2, 
  Plus, Trash2, ArrowRight, ArrowLeft,
  Upload, User, Shield, Layers
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
  const [newSecManagerId, setNewSecManagerId] = useState(stageManagers[0]?.id || '');

  // Presence State
  const [generalArrival, setGeneralArrival] = useState<string>(() => {
    const firstActive = Object.values(currentSettings.presence).find(p => p.active);
    return firstActive?.arrivalTime || '07:30';
  });
  const [generalDeparture, setGeneralDeparture] = useState<string>(() => {
    const firstActive = Object.values(currentSettings.presence).find(p => p.active);
    return firstActive?.departureTime || '14:30';
  });
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>(() => {
    const res: Record<string, boolean> = {};
    Object.keys(currentSettings.presence).forEach(k => {
      res[k] = currentSettings.presence[k].active;
    });
    return res;
  });

  const [periodsCount, setPeriodsCount] = useState<number>(currentSettings.periodSettings.periodsCount);
  const [firstPeriodStart, setFirstPeriodStart] = useState<string>(currentSettings.periodSettings.firstPeriodStart);
  const [defaultDuration, setDefaultDuration] = useState<number>(currentSettings.periodSettings.defaultDuration);
  const [customDurations, setCustomDurations] = useState<Record<number, number>>(
    currentSettings.periodSettings.customDurations || {}
  );
  
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
      <div className="bg-surface border border-surface-border/90 dark:border-surface-border rounded-xl p-4 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span>{_t('إعداد الحصص المدرسية', 'School Period Structure', 'Schulstunden-Struktur')}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('عدد الحصص اليومية', 'Daily Periods Count', 'Tägliche Stundenanzahl')}
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={periodsCount}
              onChange={(e) => setPeriodsCount(parseInt(e.target.value) || 7)}
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
              onChange={(e) => setFirstPeriodStart(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-text-main">
              {_t('مدة الحصة الافتراضية (دقيقة)', 'Default Duration (mins)', 'Standard-Dauer (Min.)')}
            </label>
            <input
              type="number"
              min="15"
              max="120"
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(parseInt(e.target.value) || 45)}
              className="w-full px-3 py-2.5 sm:py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main font-mono"
            />
          </div>
        </div>

        {/* Generated Preview Table */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-text-main mb-2">
            {_t('معاينة جدول أوقات الحصص اليومية:', 'Calculated Periods Timings Preview:', 'Vorschau der Stundenzeiten:')}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {generatedPeriods.map((p) => (
              <div key={p.periodNumber} className="bg-surface-hover border border-surface-border p-2.5 rounded-xl text-center space-y-1">
                <div className="text-xs font-bold text-primary">
                  {_t('الحصة', 'Period', 'Stunde')} {p.periodNumber}
                </div>
                <div className="text-[11px] font-mono font-bold text-text-main">
                  {p.startTime} - {p.endTime}
                </div>
                <div className="text-[10px] text-text-muted">
                  {p.duration} {_t('دقيقة', 'mins', 'Min.')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
