import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Student, Group, Lesson, PaymentRecord } from '../types';
import { formatLocalDate } from '../utils/timeUtils';
import { storage } from '../services/storageService';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { 
  ALL_BACKUP_CATEGORIES, BackupCategory, calculateBackupStats, 
  generateBackupFilename, encryptBackupData, decryptBackupData, 
  analyzeBackupPayload, validateAndSanitizeBackupPayload, RestoreAnalysisResult, RestoreHistoryEntry 
} from '../utils/backupEngine';
import { 
  Download, Upload, ShieldCheck, Database, Lock, Unlock, 
  RefreshCw, RotateCcw, CheckSquare, Square, Users, User, 
  BookOpen, Award, DollarSign, Calendar, Clock, Settings, 
  MessageSquare, Video, FileText, Layout, Bell, AlertTriangle, 
  CheckCircle2, Share2, Save, HardDrive, Sparkles, History, 
  Eye, Sliders, ArrowRight, ShieldAlert, FileCode, Check
} from 'lucide-react';

interface SmartBackupCenterProps {
  onBack?: () => void;
}

export const SmartBackupCenter: React.FC<SmartBackupCenterProps> = ({ onBack }) => {
  const { 
    students, groups, lessons, payments, notifications, 
    profile, notificationSettings, inspirationSettings, 
    inspirationMessages, todos, setStudents, setGroups, 
    setLessons, setPayments, setNotifications, setProfile, 
    setNotificationSettings, setInspirationSettings, setInspirationMessages,
    setTodos,
    lastBackupTime, performBackup, exportBackupFile, importBackupFile,
    t, _t
  } = useApp();

  // Active Tab: 'simple' | 'backup' | 'restore' | 'auto_settings' | 'history'
  const [activeTab, setActiveTab] = useState<'simple' | 'backup' | 'restore' | 'auto_settings' | 'history'>('simple');

  // Simple Tab states
  const [isSimpleExporting, setIsSimpleExporting] = useState<boolean>(false);
  const [isSimpleRestoring, setIsSimpleRestoring] = useState<boolean>(false);
  const [simpleRestoreFileName, setSimpleRestoreFileName] = useState<string>('');
  const [simpleSuccessMsg, setSimpleSuccessMsg] = useState<string | null>(null);
  const [simpleErrorMsg, setSimpleErrorMsg] = useState<string | null>(null);
  const simpleFileInputRef = useRef<HTMLInputElement>(null);

  // Backup Category Selection
  const [selectedCategories, setSelectedCategories] = useState<BackupCategory[]>(
    ALL_BACKUP_CATEGORIES.map(c => c.id)
  );

  // Encryption Password
  const [enablePassword, setEnablePassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Export State & Progress
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusMsg, setExportStatusMsg] = useState<string | null>(null);

  // Restore State
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [decryptPasswordInput, setDecryptPasswordInput] = useState<string>('');
  const [analysis, setAnalysis] = useState<RestoreAnalysisResult | null>(null);
  const [selectedRestoreCategories, setSelectedRestoreCategories] = useState<BackupCategory[]>([]);
  const [restoreMode, setRestoreMode] = useState<'smart' | 'merge' | 'replace'>('smart');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreProgress, setRestoreProgress] = useState<number>(0);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [showReplaceWarning, setShowReplaceWarning] = useState<boolean>(false);

  // Restore Point / Rollback State
  const [hasRestorePoint, setHasRestorePoint] = useState<boolean>(false);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);

  // Auto Backups State
  const [autoDaily, setAutoDaily] = useState<boolean>(() => localStorage.getItem('dl_auto_backup_daily') === 'true');
  const [autoWeekly, setAutoWeekly] = useState<boolean>(() => localStorage.getItem('dl_auto_backup_weekly') !== 'false');
  const [autoMonthly, setAutoMonthly] = useState<boolean>(() => localStorage.getItem('dl_auto_backup_monthly') === 'true');
  const [retentionCount, setRetentionCount] = useState<number>(() => Number(localStorage.getItem('dl_backup_retention')) || 10);

  // History Log
  const [historyLogs, setHistoryLogs] = useState<RestoreHistoryEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for existing restore point & load history on mount
  useEffect(() => {
    const rp = localStorage.getItem('dl_restore_point_snapshot');
    setHasRestorePoint(!!rp);

    try {
      const histStr = localStorage.getItem('dl_restore_history');
      if (histStr) {
        setHistoryLogs(JSON.parse(histStr));
      }
    } catch (e) {
      console.error('Failed to parse restore history', e);
    }
  }, []);

  // Save Auto Backup Settings
  const saveAutoBackupConfig = (daily: boolean, weekly: boolean, monthly: boolean, retention: number) => {
    setAutoDaily(daily);
    setAutoWeekly(weekly);
    setAutoMonthly(monthly);
    setRetentionCount(retention);

    localStorage.setItem('dl_auto_backup_daily', String(daily));
    localStorage.setItem('dl_auto_backup_weekly', String(weekly));
    localStorage.setItem('dl_auto_backup_monthly', String(monthly));
    localStorage.setItem('dl_backup_retention', String(retention));
  };

  // Helper for Category Icons
  const renderCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'User': return <User className="w-4 h-4 text-primary" />;
      case 'Users': return <Users className="w-4 h-4 text-primary" />;
      case 'BookOpen': return <BookOpen className="w-4 h-4 text-primary" />;
      case 'Award': return <Award className="w-4 h-4 text-primary" />;
      case 'DollarSign': return <DollarSign className="w-4 h-4 text-primary" />;
      case 'Calendar': return <Calendar className="w-4 h-4 text-primary" />;
      case 'Clock': return <Clock className="w-4 h-4 text-primary" />;
      case 'Settings': return <Settings className="w-4 h-4 text-primary" />;
      case 'MessageSquare': return <MessageSquare className="w-4 h-4 text-primary" />;
      case 'Video': return <Video className="w-4 h-4 text-primary" />;
      case 'FileText': return <FileText className="w-4 h-4 text-primary" />;
      case 'Layout': return <Layout className="w-4 h-4 text-primary" />;
      case 'Bell': return <Bell className="w-4 h-4 text-primary" />;
      default: return <CheckSquare className="w-4 h-4 text-primary" />;
    }
  };

  // Selection Toggles
  const handleSelectAll = () => {
    setSelectedCategories(ALL_BACKUP_CATEGORIES.map(c => c.id));
  };

  const handleDeselectAll = () => {
    setSelectedCategories([]);
  };

  const toggleCategory = (id: BackupCategory) => {
    if (selectedCategories.includes(id)) {
      setSelectedCategories(selectedCategories.filter(c => c !== id));
    } else {
      setSelectedCategories([...selectedCategories, id]);
    }
  };

  const stats = calculateBackupStats(selectedCategories, {
    students, groups, lessons, payments, notifications, profile,
    notificationSettings, inspirationSettings, inspirationMessages, todos
  });

  const isFullBackup = selectedCategories.length === ALL_BACKUP_CATEGORIES.length;

  // Execute Backup Export
  const handleCreateAndDownloadBackup = async () => {
    if (selectedCategories.length === 0) {
      setExportStatusMsg(t('auto_please_select_at_least_one_cat'));
      return;
    }

    setIsExporting(true);
    setExportProgress(10);
    setExportStatusMsg(t('auto_gathering_and_preparing_backup'));

    setTimeout(async () => {
      try {
        setExportProgress(40);
        
        // Assemble payload
        const payloadData: any = {};
        if (selectedCategories.includes('students')) payloadData.students = students;
        if (selectedCategories.includes('groups')) payloadData.groups = groups;
        if (selectedCategories.includes('schedule')) payloadData.lessons = lessons;
        if (selectedCategories.includes('financial')) payloadData.payments = payments;
        if (selectedCategories.includes('notifications')) payloadData.notifications = notifications;
        if (selectedCategories.includes('settings')) payloadData.profile = profile;
        if (selectedCategories.includes('availability')) payloadData.workingHours = profile.workingHours;
        if (selectedCategories.includes('templates')) payloadData.parentMessageTemplates = profile.parentMessageTemplates;
        if (selectedCategories.includes('meeting_links')) payloadData.meetingLinks = { defaultZoomLink: profile.defaultZoomLink, defaultMeetLink: profile.defaultMeetLink };

        setExportProgress(70);

        let encryptedDataStr: string | undefined = undefined;
        let isEncrypted = false;

        if (enablePassword && password.trim().length > 0) {
          isEncrypted = true;
          setExportStatusMsg(t('auto_encrypting_payload_with_passwo'));
          encryptedDataStr = await encryptBackupData(payloadData, password);
        }

        const backupPayload = {
          app: 'TeacherAssistant' as const,
          version: '2.5.0',
          timestamp: new Date().toISOString(),
          backupType: isFullBackup ? ('Full' as const) : ('Partial' as const),
          encrypted: isEncrypted,
          categories: selectedCategories,
          counts: {
            students: payloadData.students?.length || 0,
            groups: payloadData.groups?.length || 0,
            lessons: payloadData.lessons?.length || 0,
            attendance: stats.attendanceCount,
            homework: stats.homeworkCount,
            exams: stats.examCount,
            payments: payloadData.payments?.length || 0,
            notifications: payloadData.notifications?.length || 0,
            todos: todos?.length || 0
          },
          metadata: {
            teacherName: profile.displayName || 'Teacher',
            totalRecords: stats.totalRecords,
            estimatedSizeKb: stats.estimatedSizeKb
          },
          encryptedData: encryptedDataStr,
          data: isEncrypted ? undefined : payloadData
        };

        const jsonString = JSON.stringify(backupPayload, null, 2);
        const fileName = generateBackupFilename(isFullBackup);

        setExportProgress(90);

        if (Capacitor.isNativePlatform()) {
          try {
            const savedFile = await Filesystem.writeFile({
              path: fileName,
              data: jsonString,
              directory: Directory.Cache,
              encoding: Encoding.UTF8
            });
            await Share.share({
              title: 'Glück Backup',
              text: 'Backup Export Data (Glück)',
              url: savedFile.uri,
              dialogTitle: 'Export Backup JSON'
            });
          } catch (nativeErr) {
            console.warn('Native export failed, falling back to blob:', nativeErr);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        } else {
          // Download JSON
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        // Update last backup time
        performBackup();

        setExportProgress(100);
        setExportStatusMsg(t('auto_backup_file_created_and_down'));
      } catch (e: any) {
        console.error('Backup creation error', e);
        setExportStatusMsg(`❌ Error: ${e.message || 'Failed to create backup'}`);
      } finally {
        setIsExporting(false);
      }
    }, 300);
  };

  // Simple 1-Click Backup All
  const handleSimpleBackup = async () => {
    setIsSimpleExporting(true);
    setSimpleSuccessMsg(null);
    setSimpleErrorMsg(null);
    
    setTimeout(async () => {
      try {
        const payloadData: any = {
          students,
          groups,
          lessons,
          payments,
          notifications,
          profile,
          workingHours: profile.workingHours,
          parentMessageTemplates: profile.parentMessageTemplates,
          meetingLinks: { defaultZoomLink: profile.defaultZoomLink, defaultMeetLink: profile.defaultMeetLink },
          todos
        };

        const backupPayload = {
          app: 'TeacherAssistant' as const,
          version: '2.5.0',
          timestamp: new Date().toISOString(),
          backupType: 'Full' as const,
          encrypted: false,
          categories: ALL_BACKUP_CATEGORIES.map(c => c.id),
          counts: {
            students: students?.length || 0,
            groups: groups?.length || 0,
            lessons: lessons?.length || 0,
            payments: payments?.length || 0,
            notifications: notifications?.length || 0,
            todos: todos?.length || 0
          },
          metadata: {
            teacherName: profile.displayName || 'Teacher',
            totalRecords: (students?.length || 0) + (groups?.length || 0) + (lessons?.length || 0) + (payments?.length || 0),
            estimatedSizeKb: Math.round(JSON.stringify(payloadData).length / 1024)
          },
          data: payloadData
        };

        const jsonString = JSON.stringify(backupPayload, null, 2);
        const fileName = `Glück_Quick_Backup_${formatLocalDate()}.json`;

        if (Capacitor.isNativePlatform()) {
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: jsonString,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          });
          await Share.share({
            title: 'Glück Simple Backup',
            text: 'Quick Backup Data (Glück)',
            url: savedFile.uri,
            dialogTitle: 'Save Backup File'
          });
        } else {
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        performBackup(); // update last backup time
        setSimpleSuccessMsg(t('auto_quick_backup_created_and_sav'));
      } catch (e: any) {
        console.error('Simple backup failed:', e);
        setSimpleErrorMsg(t('auto_backup_failed') + (e.message || 'Error'));
      } finally {
        setIsSimpleExporting(false);
      }
    }, 400);
  };

  // Simple 1-Click Restore All
  const handleSimpleRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSimpleRestoreFileName(file.name);
    setSimpleSuccessMsg(null);
    setSimpleErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;

      setIsSimpleRestoring(true);
      
      // Safety step: Create automatic restore point first!
      const currentSnapshot = {
        timestamp: new Date().toISOString(),
        students,
        groups,
        lessons,
        payments,
        notifications,
        profile,
        notificationSettings,
        inspirationSettings,
        inspirationMessages,
        todos
      };
      localStorage.setItem('dl_restore_point_snapshot', JSON.stringify(currentSnapshot));
      setHasRestorePoint(true);

      setTimeout(async () => {
        try {
          let parsed = JSON.parse(content);
          
          const validation = validateAndSanitizeBackupPayload(parsed);
          if (!validation.isValid) {
            throw new Error(validation.errorMessage || 'Validation failed');
          }
          const data = validation.data;

          // Prepare final state variables in-memory
          let finalStudents = students;
          let finalGroups = groups;
          let finalLessons = lessons;
          let finalPayments = payments;
          let finalProfile = profile;
          let finalTodos = todos;

          if (data.students) finalStudents = data.students;
          if (data.groups) finalGroups = data.groups;
          if (data.lessons) finalLessons = data.lessons;
          if (data.payments) finalPayments = data.payments;
          if (data.profile) finalProfile = { ...profile, ...data.profile };
          if (data.todos) finalTodos = data.todos;

          // ATOMIC STATE AND STORAGE COMMIT
          setStudents(finalStudents);
          await storage.setItem('dl_students', finalStudents);

          setGroups(finalGroups);
          await storage.setItem('dl_groups', finalGroups);

          setLessons(finalLessons);
          await storage.setItem('dl_lessons', finalLessons);

          setPayments(finalPayments);
          await storage.setItem('dl_payments', finalPayments);

          setProfile(finalProfile);
          await storage.setItem('dl_profile', finalProfile);

          if (data.todos) {
            setTodos(finalTodos);
            await storage.setItem('dl_todos', finalTodos);
          }

          setSimpleSuccessMsg(t('auto_all_data_restored_successful'));
          
          // Log to history
          const totalRecs = (data.students?.length || 0) + (data.groups?.length || 0) + (data.lessons?.length || 0) + (data.payments?.length || 0);
          const newLog: RestoreHistoryEntry = {
            id: 'hist_' + Date.now(),
            timestamp: new Date().toISOString(),
            backupName: file.name,
            mode: 'replace',
            categories: ['students', 'groups', 'schedule', 'financial', 'notifications', 'settings'],
            status: 'success',
            totalRecordsAdded: totalRecs,
            totalRecordsUpdated: 0,
            notes: 'Simple 1-Tap Complete Restore'
          };
          const updatedLogs = [newLog, ...historyLogs].slice(0, retentionCount);
          setHistoryLogs(updatedLogs);
          localStorage.setItem('dl_restore_history', JSON.stringify(updatedLogs));

        } catch (err: any) {
          console.error('Simple restore failed:', err);
          setSimpleErrorMsg(t('auto_failed_to_restore_data_plea'));
        } finally {
          setIsSimpleRestoring(false);
          // Reset file input
          if (simpleFileInputRef.current) {
            simpleFileInputRef.current.value = '';
          }
        }
      }, 600);
    };
    reader.readAsText(file);
  };

  // Analyze File for Restore
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setRestoreFileContent(content);
        tryParseAndAnalyze(content, '');
      }
    };
    reader.readAsText(file);
  };

  const tryParseAndAnalyze = async (contentStr: string, passStr: string) => {
    try {
      let parsed = JSON.parse(contentStr);
      if (parsed.encrypted && parsed.encryptedData) {
        if (!passStr) {
          // Encrypted file requires password
          const result = analyzeBackupPayload(parsed, { students, groups, lessons, payments, notifications, profile });
          setAnalysis(result);
          return;
        }
        // Attempt decryption
        const decryptedData = await decryptBackupData(parsed.encryptedData, passStr);
        parsed.data = decryptedData;
      }

      const result = analyzeBackupPayload(parsed, { students, groups, lessons, payments, notifications, profile });
      setAnalysis(result);
      if (result.isValid && result.categories.length > 0) {
        setSelectedRestoreCategories(result.categories);
      }
    } catch (err: any) {
      setAnalysis({
        isValid: false,
        isEncrypted: false,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        backupType: 'Partial',
        categories: [],
        counts: { students: 0, groups: 0, lessons: 0, attendance: 0, homework: 0, exams: 0, payments: 0, notifications: 0, settingsIncluded: false },
        impact: { addStudents: 0, updateStudents: 0, addGroups: 0, updateGroups: 0, addLessons: 0, updateLessons: 0, addPayments: 0, updatePayments: 0, duplicateEntries: 0, conflicts: 0 },
        errorMessage: t('auto_incorrect_password_or_corrupte')
      });
    }
  };

  // Execute Selective Restore
  const triggerExecuteRestore = async () => {
    if (!analysis || !analysis.isValid || !restoreFileContent) return;

    if (restoreMode === 'replace' && !showReplaceWarning) {
      setShowReplaceWarning(true);
      return;
    }

    setShowReplaceWarning(false);
    setIsRestoring(true);
    setRestoreProgress(10);

    // Step 1: Create Automatic Restore Point
    console.log('students before', students.length);
    console.log('groups before', groups.length);
    console.log('lessons before', lessons.length);
    console.log('payments before', payments.length);

    const currentSnapshot = {
      timestamp: new Date().toISOString(),
      students,
      groups,
      lessons,
      payments,
      notifications,
      profile,
      notificationSettings,
      inspirationSettings,
      inspirationMessages,
      todos
    };

    localStorage.setItem('dl_restore_point_snapshot', JSON.stringify(currentSnapshot));
    setHasRestorePoint(true);
    setRestoreProgress(30);

    setTimeout(async () => {
      try {
        let parsed = JSON.parse(restoreFileContent);
        if (parsed.encrypted && parsed.encryptedData) {
          parsed.data = await decryptBackupData(parsed.encryptedData, decryptPasswordInput);
        }

        const validation = validateAndSanitizeBackupPayload(parsed);
        if (!validation.isValid) {
          throw new Error(validation.errorMessage || 'Validation failed');
        }
        const data = validation.data;
        setRestoreProgress(60);

        console.log('parsed students', data.students?.length);
        console.log('parsed groups', data.groups?.length);
        console.log('parsed lessons', data.lessons?.length);
        console.log('parsed payments', data.payments?.length);
        console.log('selectedRestoreCategories', selectedRestoreCategories);

        // Prepare final state variables in-memory
        let finalStudents = [...students];
        let finalGroups = [...groups];
        let finalLessons = [...lessons];
        let finalPayments = [...payments];
        let finalProfile = profile ? { ...profile } : undefined;

        // Process Students
        if (selectedRestoreCategories.includes('students') && data.students) {
          if (restoreMode === 'smart') {
            const existingMap = new Map(students.map(s => [s.id, s]));
            const newStudentsList = [...students];
            data.students.forEach((impS: Student) => {
              if (existingMap.has(impS.id)) {
                const idx = newStudentsList.findIndex(s => s.id === impS.id);
                if (idx !== -1) newStudentsList[idx] = { ...newStudentsList[idx], ...impS };
              } else {
                newStudentsList.push(impS);
              }
            });
            finalStudents = newStudentsList;
          } else if (restoreMode === 'merge') {
            const mergedMap = new Map<string, Student>();
            students.forEach(s => mergedMap.set(s.id, s));
            data.students.forEach(s => {
              if (mergedMap.has(s.id)) {
                mergedMap.set(s.id, { ...mergedMap.get(s.id)!, ...s });
              } else {
                mergedMap.set(s.id, s);
              }
            });
            finalStudents = Array.from(mergedMap.values());
          } else if (restoreMode === 'replace') {
            finalStudents = data.students;
          }
        }

        // Process Groups
        if (selectedRestoreCategories.includes('groups') && data.groups) {
          if (restoreMode === 'smart') {
            const existingMap = new Map(groups.map(g => [g.id, g]));
            const newGroupsList = [...groups];
            data.groups.forEach((impG: Group) => {
              if (existingMap.has(impG.id)) {
                const idx = newGroupsList.findIndex(g => g.id === impG.id);
                if (idx !== -1) newGroupsList[idx] = { ...newGroupsList[idx], ...impG };
              } else {
                newGroupsList.push(impG);
              }
            });
            finalGroups = newGroupsList;
          } else if (restoreMode === 'merge') {
            const mergedMap = new Map<string, Group>();
            groups.forEach(g => mergedMap.set(g.id, g));
            data.groups.forEach(g => {
              if (mergedMap.has(g.id)) {
                mergedMap.set(g.id, { ...mergedMap.get(g.id)!, ...g });
              } else {
                mergedMap.set(g.id, g);
              }
            });
            finalGroups = Array.from(mergedMap.values());
          } else if (restoreMode === 'replace') {
            finalGroups = data.groups;
          }
        }

        // Process Schedule (Lessons)
        if (selectedRestoreCategories.includes('schedule') && data.lessons) {
          if (restoreMode === 'smart') {
            const existingMap = new Map(lessons.map(l => [l.id, l]));
            const newLessonsList = [...lessons];
            data.lessons.forEach((impL: Lesson) => {
              if (existingMap.has(impL.id)) {
                const idx = newLessonsList.findIndex(l => l.id === impL.id);
                if (idx !== -1) newLessonsList[idx] = { ...newLessonsList[idx], ...impL };
              } else {
                newLessonsList.push(impL);
              }
            });
            finalLessons = newLessonsList;
          } else if (restoreMode === 'merge') {
            const mergedMap = new Map<string, Lesson>();
            lessons.forEach(l => mergedMap.set(l.id, l));
            data.lessons.forEach(l => {
              if (mergedMap.has(l.id)) {
                mergedMap.set(l.id, { ...mergedMap.get(l.id)!, ...l });
              } else {
                mergedMap.set(l.id, l);
              }
            });
            finalLessons = Array.from(mergedMap.values());
          } else if (restoreMode === 'replace') {
            finalLessons = data.lessons;
          }
        }

        // Process Financial (Payments)
        if (selectedRestoreCategories.includes('financial') && data.payments) {
          if (restoreMode === 'smart') {
            const existingMap = new Map(payments.map(p => [p.id, p]));
            const newPaymentsList = [...payments];
            data.payments.forEach((impP: PaymentRecord) => {
              if (existingMap.has(impP.id)) {
                const idx = newPaymentsList.findIndex(p => p.id === impP.id);
                if (idx !== -1) newPaymentsList[idx] = { ...newPaymentsList[idx], ...impP };
              } else {
                newPaymentsList.push(impP);
              }
            });
            finalPayments = newPaymentsList;
          } else if (restoreMode === 'merge') {
            const mergedMap = new Map<string, PaymentRecord>();
            payments.forEach(p => mergedMap.set(p.id, p));
            data.payments.forEach(p => {
              if (mergedMap.has(p.id)) {
                mergedMap.set(p.id, { ...mergedMap.get(p.id)!, ...p });
              } else {
                mergedMap.set(p.id, p);
              }
            });
            finalPayments = Array.from(mergedMap.values());
          } else if (restoreMode === 'replace') {
            finalPayments = data.payments;
          }
        }

        // Process Settings (Profile)
        if (selectedRestoreCategories.includes('settings') && data.profile) {
          finalProfile = { ...profile, ...data.profile };
        }

        // ATOMIC STATE AND STORAGE COMMIT
        if (selectedRestoreCategories.includes('students') && data.students) {
          setStudents(finalStudents);
          await storage.setItem('dl_students', finalStudents);
        }
        if (selectedRestoreCategories.includes('groups') && data.groups) {
          setGroups(finalGroups);
          await storage.setItem('dl_groups', finalGroups);
        }
        if (selectedRestoreCategories.includes('schedule') && data.lessons) {
          setLessons(finalLessons);
          await storage.setItem('dl_lessons', finalLessons);
        }
        if (selectedRestoreCategories.includes('financial') && data.payments) {
          setPayments(finalPayments);
          await storage.setItem('dl_payments', finalPayments);
        }
        if (selectedRestoreCategories.includes('settings') && data.profile && finalProfile) {
          setProfile(finalProfile);
          await storage.setItem('dl_profile', finalProfile);
        }

        console.log('restore finished');

        setRestoreProgress(100);
        setRestoreSuccessMsg(t('auto_selected_categories_restored'));

        // Log into history
        const newLog: RestoreHistoryEntry = {
          id: 'hist_' + Date.now(),
          timestamp: new Date().toISOString(),
          backupName: restoreFileName || 'Imported_Backup.json',
          mode: restoreMode,
          categories: selectedRestoreCategories,
          status: 'success',
          totalRecordsAdded: analysis.impact.addStudents + analysis.impact.addGroups + analysis.impact.addLessons + analysis.impact.addPayments,
          totalRecordsUpdated: analysis.impact.updateStudents + analysis.impact.updateGroups + analysis.impact.updateLessons + analysis.impact.updatePayments
        };

        const updatedLogs = [newLog, ...historyLogs];
        setHistoryLogs(updatedLogs);
        localStorage.setItem('dl_restore_history', JSON.stringify(updatedLogs));

      } catch (err: any) {
        console.error('Restore error', err);
        setRestoreSuccessMsg(`❌ Restore failed: ${err.message}`);
      } finally {
        setIsRestoring(false);
      }
    }, 400);
  };

  // Rollback Action
  const handleUndoLastRestore = () => {
    const rpStr = localStorage.getItem('dl_restore_point_snapshot');
    if (!rpStr) return;

    setIsRollingBack(true);
    setTimeout(() => {
      try {
        const rp = JSON.parse(rpStr);
        if (rp.students) setStudents(rp.students);
        if (rp.groups) setGroups(rp.groups);
        if (rp.lessons) setLessons(rp.lessons);
        if (rp.payments) setPayments(rp.payments);
        if (rp.notifications) setNotifications(rp.notifications);
        if (rp.profile) setProfile(rp.profile);

        setRestoreSuccessMsg(t('auto_rollback_successful_restore'));

        // Log rollback
        const newLog: RestoreHistoryEntry = {
          id: 'roll_' + Date.now(),
          timestamp: new Date().toISOString(),
          backupName: 'Undo Last Restore (Rollback)',
          mode: 'smart',
          categories: ALL_BACKUP_CATEGORIES.map(c => c.id),
          status: 'rolled_back',
          totalRecordsAdded: 0,
          totalRecordsUpdated: 0,
          notes: 'User performed 1-click rollback to restore point'
        };

        const updatedLogs = [newLog, ...historyLogs];
        setHistoryLogs(updatedLogs);
        localStorage.setItem('dl_restore_history', JSON.stringify(updatedLogs));

      } catch (e) {
        console.error('Rollback error', e);
      } finally {
        setIsRollingBack(false);
      }
    }, 300);
  };

  return (
    <div className="space-y-3.5" id="smart-backup-center-root">
      {/* Action / Tab Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Tab Switcher */}
        <div className="flex overflow-x-auto p-1 gap-1 bg-surface-hover border border-surface-border/80 rounded-xl no-scrollbar flex-1">
          <button
            type="button"
            onClick={() => setActiveTab('simple')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'simple'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-text-muted hover:text-text-main hover:bg-surface'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'simple' ? 'text-amber-300' : 'text-amber-500'}`} />
            <span>{t('auto_1_tap_backup')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-text-muted hover:text-text-main hover:bg-surface'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('auto_custom_export')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-text-muted hover:text-text-main hover:bg-surface'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t('auto_custom_restore')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auto_settings')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'auto_settings'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-text-muted hover:text-text-main hover:bg-surface'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t('auto_auto_backups')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-text-muted hover:text-text-main hover:bg-surface'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t('auto_restore_history')}</span>
          </button>
        </div>

        {/* Rollback button if restore point exists */}
        {hasRestorePoint && (
          <button
            type="button"
            onClick={handleUndoLastRestore}
            disabled={isRollingBack}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0 active:scale-95"
            title={t('auto_undo_last_restore')}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRollingBack ? 'animate-spin' : ''}`} />
            <span>{t('auto_undo_last_restore_18')}</span>
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {exportStatusMsg && (
        <div className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-between gap-2 animate-scale-up ${
          exportStatusMsg.includes('✓') 
            ? 'bg-primary-soft text-primary border-primary-border dark:bg-primary-soft dark:text-primary'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
        }`}>
          <span>{exportStatusMsg}</span>
          <button type="button" onClick={() => setExportStatusMsg(null)} className="text-text-muted hover:text-text-main cursor-pointer">✕</button>
        </div>
      )}

      {restoreSuccessMsg && (
        <div className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-between gap-2 animate-scale-up ${
          restoreSuccessMsg.includes('✓') 
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
        }`}>
          <span>{restoreSuccessMsg}</span>
          <button type="button" onClick={() => setRestoreSuccessMsg(null)} className="text-text-muted hover:text-text-main cursor-pointer">✕</button>
        </div>
      )}

      {/* ==========================================
          TAB 0: SIMPLE 1-TAP BACKUP & RESTORE
      ========================================== */}
      {activeTab === 'simple' && (
        <div className="space-y-3 animate-fade-in">
          {/* Simple Tab Feedbacks */}
          {simpleSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center justify-between gap-2 animate-scale-up">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{simpleSuccessMsg}</span>
              </span>
              <button type="button" onClick={() => setSimpleSuccessMsg(null)} className="text-text-muted hover:text-text-main cursor-pointer">✕</button>
            </div>
          )}

          {simpleErrorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center justify-between gap-2 animate-scale-up">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{simpleErrorMsg}</span>
              </span>
              <button type="button" onClick={() => setSimpleErrorMsg(null)} className="text-text-muted hover:text-text-main cursor-pointer">✕</button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Quick Backup Section */}
            <div className="bg-surface border border-surface-border/90 dark:border-surface-border p-3.5 rounded-xl shadow-2xs flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="p-2 bg-primary-soft text-primary border border-primary-border/40 rounded-lg w-fit">
                  <Save className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-text-main">
                  {t('auto_instant_1_click_backup')}
                </h3>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {t('auto_export_and_save_a_complete_bac')}
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSimpleBackup}
                  disabled={isSimpleExporting}
                  className="w-full py-2 px-3 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:bg-slate-300 dark:disabled:bg-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                >
                  {isSimpleExporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('auto_saving_and_sharing')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{t('auto_tap_to_backup_save_everythin')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Restore Section */}
            <div className="bg-surface border border-surface-border/90 dark:border-surface-border p-3.5 rounded-xl shadow-2xs flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="p-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg w-fit">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-text-main">
                  {t('auto_instant_1_click_restore')}
                </h3>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {t('auto_select_a_backup_json_file_you')}
                </p>
              </div>

              <div className="pt-1">
                <input
                  type="file"
                  accept=".json"
                  ref={simpleFileInputRef}
                  onChange={handleSimpleRestoreUpload}
                  className="hidden"
                />
                
                <button
                  type="button"
                  onClick={() => simpleFileInputRef.current?.click()}
                  disabled={isSimpleRestoring}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white disabled:bg-slate-300 dark:disabled:bg-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                >
                  {isSimpleRestoring ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('auto_restoring_all_data')}</span>
                    </>
                  ) : (
                    <>
                      <FileCode className="w-3.5 h-3.5" />
                      <span>{t('auto_choose_file_restore_all')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Prompt/Info box on safety */}
          <div className="p-3 bg-surface-hover rounded-xl border border-surface-border text-[11px] leading-relaxed text-text-muted flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-text-main block">{t('auto_automatic_data_protection')}</span>
              <span>
                {t('auto_before_performing_any_restore')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 1: CREATE BACKUP
      ========================================== */}
      {activeTab === 'backup' && (
        <div className="space-y-3 animate-fade-in">
          {/* Quick Actions & State Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-surface border border-surface-border/90 dark:border-surface-border p-2.5 rounded-xl shadow-2xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 rounded-lg bg-primary-soft hover:bg-primary/20 text-primary dark:text-primary text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-primary-border/60"
              >
                <CheckSquare className="w-3 h-3" />
                <span>{t('auto_select_all')}</span>
              </button>

              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2.5 py-1 rounded-lg bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-700 text-text-muted text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-surface-border/60"
              >
                <Square className="w-3 h-3" />
                <span>{t('auto_deselect_all')}</span>
              </button>
            </div>

            {/* Selection Status Badge */}
            <div className="flex items-center gap-1.5">
              {isFullBackup ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{t('auto_full_backup_selected_100')}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1">
                  <Sliders className="w-3 h-3" />
                  <span>
                    {t('auto_partial_selection_selectedc')}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Backup Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ALL_BACKUP_CATEGORIES.map(category => {
              const isChecked = selectedCategories.includes(category.id);
              return (
                <div
                  key={category.id}
                  onClick={() => toggleCategory(category.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                    isChecked
                      ? 'bg-primary-soft/40 dark:bg-primary-soft/20 border-primary dark:border-primary shadow-2xs'
                      : 'bg-surface hover:bg-surface-hover border-surface-border opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-lg border shrink-0 transition-colors ${
                    isChecked
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-hover text-text-muted border-surface-border'
                  }`}>
                    {renderCategoryIcon(category.icon)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-text-main truncate">
                        {_t(category.labelAr, category.labelEn)}
                      </h4>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 rounded text-primary focus:ring-primary cursor-pointer shrink-0"
                      />
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5 leading-snug line-clamp-2">
                      {_t(category.descriptionAr, category.descriptionEn)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Backup Information Preview & Summary Card */}
          <div className="bg-surface border border-surface-border/90 dark:border-surface-border p-3.5 rounded-xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-surface-border/80 pb-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isFullBackup ? 'bg-emerald-500 text-white' : 'bg-primary text-white'}`}>
                  <Database className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text-main">
                    {isFullBackup ? t('auto_full_backup_preview') : t('auto_partial_backup_preview')}
                  </h3>
                  <p className="text-[10px] text-text-muted">
                    {t('auto_payload_details_and_estimated')}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-primary font-mono bg-primary-soft px-2.5 py-0.5 rounded-lg border border-primary-border/60">
                  {stats.totalRecords} {t('auto_total_records')}
                </span>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 text-center text-xs font-bold">
              <div className="p-2 bg-surface-hover rounded-lg border border-surface-border">
                <span className="text-[9px] text-text-muted block uppercase">{t('auto_students')}</span>
                <span className="font-mono text-xs text-text-main font-black">{stats.studentCount}</span>
              </div>
              <div className="p-2 bg-surface-hover rounded-lg border border-surface-border">
                <span className="text-[9px] text-text-muted block uppercase">{t('auto_groups')}</span>
                <span className="font-mono text-xs text-text-main font-black">{stats.groupCount}</span>
              </div>
              <div className="p-2 bg-surface-hover rounded-lg border border-surface-border">
                <span className="text-[9px] text-text-muted block uppercase">{t('auto_attendance')}</span>
                <span className="font-mono text-xs text-text-main font-black">{stats.attendanceCount}</span>
              </div>
              <div className="p-2 bg-surface-hover rounded-lg border border-surface-border">
                <span className="text-[9px] text-text-muted block uppercase">{t('auto_payments')}</span>
                <span className="font-mono text-xs text-text-main font-black">{stats.paymentCount}</span>
              </div>
              <div className="p-2 bg-surface-hover rounded-lg border border-surface-border">
                <span className="text-[9px] text-text-muted block uppercase">{t('auto_homework')}</span>
                <span className="font-mono text-xs text-text-main font-black">{stats.homeworkCount}</span>
              </div>
              <div className="p-2 bg-surface-hover rounded-lg border border-surface-border">
                <span className="text-[9px] text-text-muted block uppercase">{t('auto_estimated_size')}</span>
                <span className="font-mono text-xs text-primary font-black">{stats.estimatedSizeKb} KB</span>
              </div>
              <div className="p-2 bg-surface-hover rounded-lg border border-surface-border col-span-2 sm:col-span-1">
                <span className="text-[9px] text-text-muted block uppercase">{t('auto_estimated_time')}</span>
                <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-black">&lt; 1 sec</span>
              </div>
            </div>

            {/* Security Options Card */}
            <div className="bg-surface-hover border border-surface-border p-2.5 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-text-main">
                    {t('auto_password_protect_encrypt_bac')}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enablePassword}
                    onChange={(e) => setEnablePassword(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                </label>
              </div>

              {enablePassword && (
                <div className="pt-1.5 border-t border-surface-border flex flex-col sm:flex-row items-center gap-2 animate-fade-in">
                  <div className="relative w-full">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auto_enter_encryption_password')}
                      className="w-full bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs text-text-main placeholder-text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-2.5 top-1.5 text-text-muted hover:text-text-main text-xs cursor-pointer"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0 leading-tight">
                    {t('auto_this_password_will_be_required')}
                  </span>
                </div>
              )}
            </div>

            {/* Export Progress Bar if exporting */}
            {isExporting && (
              <div className="space-y-1 pt-1 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-text-main">
                  <span>{t('auto_creating_backup_file')}</span>
                  <span>{exportProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-300" 
                    style={{ width: `${exportProgress}%` }} 
                  />
                </div>
              </div>
            )}

            {/* Final Download Trigger Button */}
            <button
              type="button"
              onClick={handleCreateAndDownloadBackup}
              disabled={isExporting || selectedCategories.length === 0}
              className="w-full bg-primary hover:bg-primary-hover active:scale-[0.99] disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
            >
              <Download className="w-4 h-4" />
              <span>
                {isFullBackup 
                  ? t('auto_download_full_backup_json')
                  : t('auto_download_partial_backup_sel')}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: RESTORE CENTER
      ========================================== */}
      {activeTab === 'restore' && (
        <div className="space-y-3 animate-fade-in">
          {/* Upload Drop Zone */}
          <div className="bg-surface border-2 border-dashed border-primary/40 hover:border-primary p-4 rounded-xl text-center space-y-2 transition-all">
            <div className="p-2 bg-primary-soft rounded-xl w-10 h-10 mx-auto flex items-center justify-center text-primary">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text-main">
                {t('auto_select_or_drop_backup_file_js')}
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                {t('auto_supports_standard_and_password')}
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2 px-4 rounded-lg shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{t('auto_browse_json_file')}</span>
            </button>

            {restoreFileName && (
              <div className="pt-1 text-xs font-mono font-bold text-primary flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{restoreFileName}</span>
              </div>
            )}
          </div>

          {/* Analysis & Selective Restore Area */}
          {analysis && (
            <div className="bg-surface border border-surface-border/90 dark:border-surface-border p-3.5 rounded-xl shadow-2xs space-y-3 animate-scale-up">
              {/* Encrypted Password Prompt if needed */}
              {analysis.isEncrypted && !analysis.payload?.data && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t('auto_this_backup_file_is_password_p')}</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={decryptPasswordInput}
                      onChange={(e) => setDecryptPasswordInput(e.target.value)}
                      placeholder={t('auto_enter_password_to_unlock')}
                      className="w-full bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-text-main font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => tryParseAndAnalyze(restoreFileContent!, decryptPasswordInput)}
                      className="px-3 py-1.5 bg-primary text-white font-bold text-xs rounded-lg shrink-0 cursor-pointer"
                    >
                      {t('auto_unlock')}
                    </button>
                  </div>
                </div>
              )}

              {/* Backup Info Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-surface-border">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-primary-soft text-primary font-mono text-[10px] font-bold">
                      v{analysis.version}
                    </span>
                    <span className="text-xs font-bold text-text-main">
                      {new Date(analysis.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {t('auto_backup_type_analysis_backup')}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
                    {t('auto_verified_structure')}
                  </span>
                </div>
              </div>

              {/* Restore Modes Options */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase text-text-muted tracking-wider">
                  {t('auto_restore_mode')}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Smart Restore Mode */}
                  <div
                    onClick={() => setRestoreMode('smart')}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none space-y-0.5 ${
                      restoreMode === 'smart'
                        ? 'bg-primary-soft/60 border-primary text-text-main shadow-2xs'
                        : 'bg-surface hover:bg-surface-hover border-surface-border opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {t('auto_smart_restore_default')}
                      </span>
                      {restoreMode === 'smart' && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <p className="text-[10px] text-text-muted leading-tight">
                      {t('auto_detect_duplicates_update_exis')}
                    </p>
                  </div>

                  {/* Merge Mode */}
                  <div
                    onClick={() => setRestoreMode('merge')}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none space-y-0.5 ${
                      restoreMode === 'merge'
                        ? 'bg-primary-soft/60 border-primary text-text-main shadow-2xs'
                        : 'bg-surface hover:bg-surface-hover border-surface-border opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main flex items-center gap-1">
                        <Users className="w-3 h-3 text-primary" />
                        {t('auto_merge_mode')}
                      </span>
                      {restoreMode === 'merge' && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <p className="text-[10px] text-text-muted leading-tight">
                      {t('auto_keep_current_data_add_importe')}
                    </p>
                  </div>

                  {/* Replace Mode */}
                  <div
                    onClick={() => setRestoreMode('replace')}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none space-y-0.5 ${
                      restoreMode === 'replace'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 shadow-2xs'
                        : 'bg-surface hover:bg-surface-hover border-surface-border opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('auto_replace_mode')}
                      </span>
                      {restoreMode === 'replace' && <Check className="w-3.5 h-3.5 text-rose-500" />}
                    </div>
                    <p className="text-[10px] text-text-muted leading-tight">
                      {t('auto_replace_current_data_with_impo')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Selective Categories to Restore */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase text-text-muted tracking-wider">
                    {t('auto_categories_to_restore')}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedRestoreCategories(analysis.categories)}
                    className="text-[10px] text-primary font-bold hover:underline cursor-pointer"
                  >
                    {t('auto_select_all_available')}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {analysis.categories.map(catId => {
                    const isSel = selectedRestoreCategories.includes(catId);
                    const catObj = ALL_BACKUP_CATEGORIES.find(c => c.id === catId);
                    return (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => {
                          if (isSel) setSelectedRestoreCategories(selectedRestoreCategories.filter(c => c !== catId));
                          else setSelectedRestoreCategories([...selectedRestoreCategories, catId]);
                        }}
                        className={`p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          isSel 
                            ? 'bg-primary-soft text-primary border-primary-border' 
                            : 'bg-surface text-text-muted border-surface-border'
                        }`}
                      >
                        <span className="truncate">{catObj ? _t(catObj.labelAr, catObj.labelEn) : catId}</span>
                        {isSel ? <CheckSquare className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Restore Impact Report Preview */}
              <div className="bg-surface-hover border border-surface-border p-2.5 rounded-lg space-y-1.5">
                <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span>{t('auto_restore_impact_report')}</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-xs">
                  <div className="p-1.5 bg-surface rounded-lg border border-surface-border">
                    <span className="text-[9px] text-text-muted block">{t('auto_records_to_add')}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      +{analysis.impact.addStudents + analysis.impact.addGroups + analysis.impact.addLessons + analysis.impact.addPayments}
                    </span>
                  </div>

                  <div className="p-1.5 bg-surface rounded-lg border border-surface-border">
                    <span className="text-[9px] text-text-muted block">{t('auto_records_to_update')}</span>
                    <span className="font-mono text-primary font-bold">
                      {analysis.impact.updateStudents + analysis.impact.updateGroups + analysis.impact.updateLessons + analysis.impact.updatePayments}
                    </span>
                  </div>

                  <div className="p-1.5 bg-surface rounded-lg border border-surface-border">
                    <span className="text-[9px] text-text-muted block">{t('auto_duplicates_detected')}</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                      {analysis.impact.duplicateEntries}
                    </span>
                  </div>

                  <div className="p-1.5 bg-surface rounded-lg border border-surface-border">
                    <span className="text-[9px] text-text-muted block">{t('auto_potential_conflicts')}</span>
                    <span className="font-mono text-slate-500 font-bold">0</span>
                  </div>
                </div>
              </div>

              {/* Progress bar if restoring */}
              {isRestoring && (
                <div className="space-y-1 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-text-main">
                    <span>{t('auto_creating_restore_point_apply')}</span>
                    <span>{restoreProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${restoreProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Replace Warning Modal Alert */}
              {showReplaceWarning && (
                <div className="bg-rose-500/10 border-2 border-rose-500/40 p-3 rounded-lg space-y-2 animate-scale-up">
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{t('auto_warning_replace_mode_will_ove')}</span>
                  </div>
                  <p className="text-xs text-rose-600 dark:text-rose-300 leading-relaxed">
                    {t('auto_an_automatic_restore_point_sna')}
                  </p>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={triggerExecuteRestore}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      {t('auto_confirm_replace_restore')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReplaceWarning(false)}
                      className="px-3 py-1.5 bg-surface border border-surface-border text-text-main font-bold text-xs rounded-lg cursor-pointer"
                    >
                      {t('auto_cancel')}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Restore Button */}
              {!showReplaceWarning && (
                <button
                  type="button"
                  onClick={triggerExecuteRestore}
                  disabled={isRestoring || selectedRestoreCategories.length === 0}
                  className="w-full bg-primary hover:bg-primary-hover active:scale-[0.99] disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    {selectedRestoreCategories.length === ALL_BACKUP_CATEGORIES.length
                      ? t('auto_restore_everything')
                      : t('auto_restore_selected_categories')}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 3: AUTO BACKUPS SETTINGS
      ========================================== */}
      {activeTab === 'auto_settings' && (
        <div className="bg-surface border border-surface-border/90 dark:border-surface-border p-3.5 rounded-xl shadow-2xs space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 border-b border-surface-border pb-2.5">
            <div className="p-1.5 rounded-lg bg-primary-soft text-primary">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text-main">
                {t('auto_automatic_backup_retention_s')}
              </h3>
              <p className="text-[10px] text-text-muted mt-0.5">
                {t('auto_schedule_periodic_background_s')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {/* Daily */}
            <div className="flex items-center justify-between p-2.5 bg-surface-hover rounded-lg border border-surface-border">
              <div>
                <h4 className="text-xs font-bold text-text-main">{t('auto_daily_automatic_backup')}</h4>
                <p className="text-[10px] text-text-muted mt-0.5">{t('auto_capture_a_daily_data_snapshot')}</p>
              </div>
              <input
                type="checkbox"
                checked={autoDaily}
                onChange={(e) => saveAutoBackupConfig(e.target.checked, autoWeekly, autoMonthly, retentionCount)}
                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </div>

            {/* Weekly */}
            <div className="flex items-center justify-between p-2.5 bg-surface-hover rounded-lg border border-surface-border">
              <div>
                <h4 className="text-xs font-bold text-text-main">{t('auto_weekly_automatic_backup')}</h4>
                <p className="text-[10px] text-text-muted mt-0.5">{t('auto_capture_a_weekly_snapshot_auto')}</p>
              </div>
              <input
                type="checkbox"
                checked={autoWeekly}
                onChange={(e) => saveAutoBackupConfig(autoDaily, e.target.checked, autoMonthly, retentionCount)}
                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </div>

            {/* Monthly */}
            <div className="flex items-center justify-between p-2.5 bg-surface-hover rounded-lg border border-surface-border">
              <div>
                <h4 className="text-xs font-bold text-text-main">{t('auto_monthly_automatic_backup')}</h4>
                <p className="text-[10px] text-text-muted mt-0.5">{t('auto_capture_a_monthly_snapshot_for')}</p>
              </div>
              <input
                type="checkbox"
                checked={autoMonthly}
                onChange={(e) => saveAutoBackupConfig(autoDaily, autoWeekly, e.target.checked, retentionCount)}
                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Retention Policy Selection */}
          <div className="pt-1.5 space-y-1.5 border-t border-surface-border">
            <h4 className="text-xs font-bold text-text-main">
              {t('auto_backup_retention_policy')}
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => saveAutoBackupConfig(autoDaily, autoWeekly, autoMonthly, cnt)}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    retentionCount === cnt
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-surface hover:bg-surface-hover border-surface-border text-text-muted'
                  }`}
                >
                  {t('auto_keep_last_cnt')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 4: RESTORE HISTORY
      ========================================== */}
      {activeTab === 'history' && (
        <div className="bg-surface border border-surface-border/90 dark:border-surface-border p-3.5 rounded-xl shadow-2xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary-soft text-primary">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-text-main">
                  {t('auto_restore_operation_history')}
                </h3>
                <p className="text-[10px] text-text-muted">
                  {t('auto_chronological_audit_log_of_all')}
                </p>
              </div>
            </div>
          </div>

          {historyLogs.length === 0 ? (
            <div className="text-center py-6 text-xs text-text-muted space-y-1">
              <p>{t('auto_no_restore_history_logged_yet')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyLogs.map(log => (
                <div key={log.id} className="p-2.5 bg-surface-hover rounded-lg border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        log.status === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {log.status}
                      </span>
                      <span className="font-bold text-text-main">{log.backupName}</span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {new Date(log.timestamp).toLocaleString()} • Mode: <span className="font-mono font-bold">{log.mode}</span>
                    </p>
                  </div>

                  <div className="text-right sm:text-end text-[10px] font-mono text-text-muted">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{log.totalRecordsAdded} Added</span>
                    <span className="mx-1">•</span>
                    <span className="text-primary font-bold">{log.totalRecordsUpdated} Updated</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
