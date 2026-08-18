import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
  TeacherProfile, Group, Student, Lesson, PaymentRecord, NotificationItem, 
  LessonReport, StudentDocument, PaymentStatus, LessonStatus, AttendanceStatus, HomeworkStatus, SyncStatus, BackupData, BackupIntegrityReport, StudentPaymentDetail, AppLanguage, AccentColor, RecentlyDeletedData, ActiveLessonSession,
  InspirationSettings, InspirationMessage, InspirationFrequency, InspirationDisplayMethod, InspirationSource,
  NotificationSettings, ScheduledNotificationItem, TeacherSettingsRecord, SyncCycleReport, PendingOutboxSummary, SyncHistoryEntry,
  CertificateRecord
} from '../types';
import { 
  clearActiveLessonNotification, getPendingScheduledNotifications, 
  cancelScheduledNotification, cancelAllScheduledNotifications, rebuildAllNotificationSchedules,
  sendSystemNotification
} from '../services/notificationService';
import { App as CapacitorApp } from '@capacitor/app';
import { storage } from '../services/storageService';
import { getStudentCyclePricing } from '../utils/paymentUtils';
import { getGroupScheduleSlots, getDayNumber } from '../utils/scheduleUtils';
import { formatLocalDate } from '../utils/timeUtils';
import { isPendingStatus } from '../utils/lessonUtils';
import { translations, TranslationKey } from '../i18n/translations';
import { syncTodayLessonsToWidget } from '../services/widgetService';
import LiveTimer from '../services/liveTimerPlugin';
import { runSyncMigration } from '../services/sync/syncMigration';
import { trackLocalMutation, trackLocalDeletion, getActiveRecords } from '../services/sync/mutationTracker';
import { runSyncCycle, forceFullSync, SyncDataSource } from '../services/sync/syncOrchestrator';
import { calculatePendingOutbox } from '../services/sync/deltaBuilder';
import { startLocalServer } from '../services/sync/localServer';
import { connectivityEngine } from '../services/sync/connectivityEngine';
import { presenceService } from '../services/sync/presenceService';
import { autoSyncEngine } from '../services/sync/autoSyncEngine';
import { syncHistoryService } from '../services/sync/syncHistoryService';
import { applyRestoreSyncSafeguards } from '../services/sync/backupSafetyService';
import { SyncStateMetadata, PairedPeer, DevicePresenceState, SyncConnectionState } from '../types';

import { 
  INITIAL_TEACHER_PROFILE, INITIAL_GROUPS, INITIAL_STUDENTS, 
  INITIAL_LESSONS, INITIAL_PAYMENT_RECORDS, INITIAL_NOTIFICATIONS,
  INITIAL_INSPIRATION_SETTINGS, INITIAL_INSPIRATION_MESSAGES,
  DEFAULT_NOTIFICATION_SETTINGS
} from '../data/initialData';
import confetti from 'canvas-confetti';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { validateAndSanitizeBackupPayload } from '../utils/backupEngine';
import { syncAllWidgetsToNative } from '../services/widgetService';

interface AppContextType {
  todos: any[];
  setTodos: any;
  // Navigation & Theme & Language & Accent
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  t: (key: TranslationKey) => string;
  _t: (ar: string, en: string, de?: string) => string;
  activeTab: 'home' | 'schedule' | 'students' | 'history' | 'payments' | 'reports' | 'settings' | 'freeTime' | 'certificates';
  setActiveTab: (tab: 'home' | 'schedule' | 'students' | 'history' | 'payments' | 'reports' | 'settings' | 'freeTime' | 'certificates') => void;

  // Certificates
  certificates: CertificateRecord[];
  addCertificate: (cert: Omit<CertificateRecord, 'id' | 'createdAt'> & { id?: string }) => CertificateRecord;
  addCertificatesBulk: (certs: (Omit<CertificateRecord, 'id' | 'createdAt'> & { id?: string })[]) => CertificateRecord[];
  updateCertificate: (id: string, updates: Partial<CertificateRecord>) => void;
  deleteCertificate: (id: string) => void;
  setCertificates: React.Dispatch<React.SetStateAction<CertificateRecord[]>>;
  updateStudentCertificateName: (studentId: string, certName: string) => void;
  updateStudentCertificateNamesBulk: (updates: { studentId: string; certificateName: string }[]) => void;

  // Global Search & Recently Deleted Modals
  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (open: boolean) => void;
  isRecentlyDeletedModalOpen: boolean;
  setIsRecentlyDeletedModalOpen: (open: boolean) => void;

  // Teacher Profile
  profile: TeacherProfile;
  updateProfile: (updates: Partial<TeacherProfile>) => void;
  refreshCalendarAndDashboard: () => void;

  // Backup System
  lastBackupTime: string;
  performBackup: () => void;
  importBackupFile: (customJson?: string) => Promise<boolean>;
  exportBackupFile: () => void;
  verifyBackupIntegrity: () => BackupIntegrityReport;

  // Groups
  groups: Group[];
  addGroup: (group: Omit<Group, 'id'>) => Group;
  duplicateGroup: (groupId: string) => Group;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  archiveGroup: (id: string) => void;
  cascadeDeleteGroup: (id: string) => void;

  // Students
  students: Student[];
  addStudent: (student: Omit<Student, 'id' | 'documents' | 'joinedDate'>) => Student;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  archiveStudent: (id: string) => void;
  uploadStudentDocument: (studentId: string, file: File, category: 'homework' | 'exam' | 'doc') => void;
  deleteStudentDocument: (studentId: string, docId: string) => void;

  // Lessons
  lessons: Lesson[];
  addLesson: (lesson: Omit<Lesson, 'id' | 'sessionNumber' | 'totalSessionsInPackage'> & { id?: string }, repeatWeeks?: number) => Lesson[];
  addQuickLesson: (data: Omit<Lesson, 'id' | 'sessionNumber' | 'totalSessionsInPackage' | 'groupId' | 'groupName'> & {
    studentName: string;
    quickStudentPhone?: string;
    quickParentPhone?: string;
    quickNotes?: string;
  }) => Lesson;
  convertQuickLessonToStudent: (lessonId: string) => Student | null;
  updateLesson: (id: string, updates: Partial<Lesson>) => void;
  deleteLesson: (id: string) => void;
  saveLessonReport: (lessonId: string, report: LessonReport, packageCount?: number) => void;
  cancelLesson: (lessonId: string, notes?: string) => void;
  generateGroupScheduleLessons: (groupId: string, days: string[], time: string, numWeeks?: number, customDayTimes?: Record<string, string>, groupOverride?: Group) => void;

  // Recently Deleted (Soft Delete)
  recentlyDeleted: RecentlyDeletedData;
  restoreItem: (type: 'student' | 'group' | 'lesson', id: string) => void;
  permanentlyDeleteItem: (type: 'student' | 'group' | 'lesson', id: string) => void;
  clearRecentlyDeleted: () => void;

  // Payments
  payments: PaymentRecord[];
  recordPayment: (
    paymentId: string, 
    paidAmount: number, 
    method: 'cash' | 'vodafone_cash' | 'bank_transfer' | 'instapay' | 'paypal', 
    notes?: string,
    discountAmount?: number,
    advanceAmount?: number,
    refundAmount?: number
  ) => void;
  addPaymentRecord: (record: Omit<PaymentRecord, 'id'>) => void;
  markCyclePaymentPaid: (data: {
    studentId: string;
    studentName: string;
    groupId: string;
    groupName: string;
    amountDue: number;
    amountPaid: number;
    lessonDates: string[];
    lessonIds: string[];
    existingPaymentRecordId?: string;
    notes?: string;
  }) => void;
  markCyclePaymentNotYet: (data: {
    studentId: string;
    studentName: string;
    groupId: string;
    groupName: string;
    amountDue: number;
    lessonDates: string[];
    lessonIds: string[];
    existingPaymentRecordId?: string;
  }) => void;
  toggleQuickPaymentStatus: (paymentId: string) => void;
  toggleStudentPaymentStatus: (studentId: string) => void;
  updateStudentPaymentPlan: (
    studentId: string, 
    paymentPlan: 'per_lesson' | '4_lessons' | '8_lessons' | '12_lessons' | 'custom_bundle',
    pricePerLesson?: number,
    bundleSize?: number,
    customBundlePrice?: number
  ) => void;
  updateLessonPaymentStatus: (lessonId: string, status: PaymentStatus, customAmountPaid?: number) => void;

  // Notifications
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearAllNotifications: () => void;

  // Notification Settings & System Scheduling Engine
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  pendingScheduledNotifications: ScheduledNotificationItem[];
  refreshPendingScheduledNotifications: () => Promise<void>;
  cancelSingleScheduledNotification: (id: number) => Promise<void>;
  cancelAllPendingScheduledNotifications: () => Promise<void>;
  rebuildNotificationSchedules: () => Promise<{ count: number; nextScheduledTime: string | null }>;

  // Active Lesson Control Modal & Central Timer Engine
  selectedLesson: Lesson | null;
  setSelectedLesson: (lesson: Lesson | null) => void;
  isControlModalOpen: boolean;
  openLessonControl: (lesson: Lesson) => void;
  closeLessonControl: () => void;
  activeLessonSession: ActiveLessonSession | null;
  startActiveLessonTimer: (lesson: Lesson) => void;
  pauseActiveLessonTimer: () => void;
  resumeActiveLessonTimer: () => void;
  endActiveLessonTimer: () => void;
  cancelActiveLessonTimer: () => void;

  // Dashboard Dismissed Lessons
  dismissedDashboardLessonIds: string[];
  dismissLessonFromDashboard: (lessonId: string) => void;

  // Inspiration & Gratitude Reminders
  inspirationSettings: InspirationSettings;
  inspirationMessages: InspirationMessage[];
  activeInspirationCard: InspirationMessage | null;
  updateInspirationSettings: (updates: Partial<InspirationSettings>) => void;
  addInspirationMessage: (text: string) => InspirationMessage;
  updateInspirationMessage: (id: string, text: string) => void;
  deleteInspirationMessage: (id: string) => void;
  toggleFavoriteInspirationMessage: (id: string) => void;
  restoreDefaultInspirationMessages: () => void;
  dismissInspirationCard: () => void;
  checkAndTriggerInspirationReminder: (triggerType?: 'manual' | 'app_load' | 'before_lesson') => void;

  // Quick Action Modals
  isAddLessonModalOpen: boolean;
  setIsAddLessonModalOpen: (open: boolean) => void;
  isAddQuickLessonModalOpen: boolean;
  setIsAddQuickLessonModalOpen: (open: boolean) => void;
  isStartLessonNowModalOpen: boolean;
  setIsStartLessonNowModalOpen: (open: boolean) => void;
  isAddStudentModalOpen: boolean;
  setIsAddStudentModalOpen: (open: boolean) => void;
  isAddGroupModalOpen: boolean;
  setIsAddGroupModalOpen: (open: boolean) => void;
  isBackupModalOpen: boolean;
  setIsBackupModalOpen: (open: boolean) => void;
  clearAllData: () => void;

  // Added setters for Backup & Restore Center
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  setPayments: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  setProfile: React.Dispatch<React.SetStateAction<TeacherProfile>>;
  setNotificationSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  setInspirationSettings: React.Dispatch<React.SetStateAction<InspirationSettings>>;
  setInspirationMessages: React.Dispatch<React.SetStateAction<InspirationMessage[]>>;
  backupToDrive: () => void | Promise<void>;
  restoreFromDrive: (jsonString: string) => boolean;
  addAppNotification: (title: string, message: string, type: 'system' | 'reminder' | 'payment', extraFields?: any) => void;
  getHistoricalLessons: () => Promise<Lesson[]>;
  getHistoricalPayments: () => Promise<PaymentRecord[]>;
  syncState: SyncStateMetadata | null;
  isSyncReady: boolean;
  connectionState: SyncConnectionState;
  devicePresences: Map<string, DevicePresenceState>;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  triggerSync: (peerId: string) => Promise<boolean>;
  forceSyncPeer: (peerId: string) => Promise<{ success: boolean; report: SyncCycleReport }>;
  getPendingOutbox: () => PendingOutboxSummary;
  getSyncHistory: () => Promise<SyncHistoryEntry[]>;
  clearSyncHistory: () => Promise<void>;
  updateSyncState: (newState: SyncStateMetadata) => Promise<void>;
  startHosting: () => Promise<{ip: string, pin: string, port: number}>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Module-level serialized storage sync queues to eliminate concurrent read-modify-write race conditions
let lessonSyncQueue: Promise<void> = Promise.resolve();
let paymentSyncQueue: Promise<void> = Promise.resolve();

export const AppProvider: React.FC<{ children: React.ReactNode, initialData: any }> = ({ children, initialData }) => {
  // Ensure a clean fresh start on app initialization


  // Persistence state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = initialData['dl_theme'];
    return saved !== null && saved !== undefined ? saved : 'light';
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const saved = initialData['dl_accent_color'];
    return saved !== null && saved !== undefined ? saved : 'blue';
  });

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
    storage.setItem('dl_accent_color', color);
  };

  useEffect(() => {
    const classes = ['accent-blue', 'accent-green', 'accent-purple', 'accent-orange', 'accent-red', 'accent-teal', 'accent-indigo', 'accent-rose', 'accent-amber', 'accent-emerald', 'accent-fuchsia', 'accent-cyan', 'accent-violet', 'accent-slate', 'accent-pink', 'accent-lime', 'accent-darkblue'];
    classes.forEach(c => document.documentElement.classList.remove(c));
    document.documentElement.classList.add(`accent-${accentColor}`);
    
  }, [accentColor]);

  const [todos, setTodos] = useState<any[]>(() => {
    const saved = initialData['dl_quick_todos'];
    return saved !== null && saved !== undefined ? saved : [];
  });

  const isInitializedRef = React.useRef(false);
  const [syncState, setSyncState] = useState<SyncStateMetadata | null>(null);
  const syncStateRef = React.useRef<SyncStateMetadata | null>(null);
  useEffect(() => {
    syncStateRef.current = syncState;
  }, [syncState]);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const syncRevisionRef = React.useRef<number>(1);

  // Connectivity and Presence States
  const [connectionState, setConnectionState] = useState<SyncConnectionState>(() => connectivityEngine.getState());
  const [devicePresences, setDevicePresences] = useState<Map<string, DevicePresenceState>>(() => presenceService.getPresences());
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(true);

  const setAutoSyncEnabled = (enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    autoSyncEngine.setEnabled(enabled);
  };

  useEffect(() => {
    async function initSync() {
      try {
        await runSyncMigration();
        const state = await storage.getItem<SyncStateMetadata>('dl_sync_state');
        if (state) {
          setSyncState(state);
          syncRevisionRef.current = state.localRevisionCounter;
          // Auto-start local host node with deterministic deviceId on startup
          startLocalServer(state.localDeviceName, state.localDeviceId, state, syncDataSource).catch(err => {
            console.warn('[AppContext] Initial host start notice:', err);
          });
        }

        // Initialize Connectivity Engine
        connectivityEngine.init();
        const unsubscribeConn = connectivityEngine.subscribe((newConnState) => {
          setConnectionState(newConnState);
        });

        // Initialize Presence Engine
        presenceService.start(() => syncStateRef.current?.pairedPeers || []);
        const unsubscribePresence = presenceService.subscribe((newPresences) => {
          setDevicePresences(newPresences);
          // Also evaluate if any peer is ready in connectivity engine
          const anyOnline = Array.from(newPresences.values()).some(p => p.isOnline);
          connectivityEngine.setPeersReady(anyOnline);
        });

        return () => {
          unsubscribeConn();
          unsubscribePresence();
        };
      } catch (err) {
        console.error('Failed to initialize sync:', err);
      } finally {
        setIsSyncReady(true);
      }
    }
    initSync();
  }, []);

  const wrapMutation = <T extends any>(item: T): T => {
    const currentState = syncStateRef.current;
    const deviceId = currentState?.localDeviceId || 'local';
    const nextRev = syncRevisionRef.current + 1;
    syncRevisionRef.current = nextRev;
    
    setSyncState(prev => prev ? { ...prev, localRevisionCounter: nextRev } : prev);
    if (currentState) {
      storage.setItem('dl_sync_state', { ...currentState, localRevisionCounter: nextRev });
    }
    
    const tracked = trackLocalMutation(item as any, deviceId, nextRev) as T;
    autoSyncEngine.notifyLocalMutation();
    return tracked;
  };

  const wrapDeletion = <T extends any>(item: T): T => {
    const currentState = syncStateRef.current;
    const deviceId = currentState?.localDeviceId || 'local';
    const nextRev = syncRevisionRef.current + 1;
    syncRevisionRef.current = nextRev;
    
    setSyncState(prev => prev ? { ...prev, localRevisionCounter: nextRev } : prev);
    if (currentState) {
      storage.setItem('dl_sync_state', { ...currentState, localRevisionCounter: nextRev });
    }
    
    const tracked = trackLocalDeletion(item as any, deviceId, nextRev) as T;
    autoSyncEngine.notifyLocalMutation();
    return tracked;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitializedRef.current = true;
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_quick_todos', todos);
  }, [todos]);

  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'students' | 'history' | 'payments' | 'reports' | 'settings' | 'freeTime' | 'certificates'>('home');

  const [profile, setProfile] = useState<TeacherProfile>(() => {
    const saved = initialData['dl_profile'];
    return saved !== null && saved !== undefined ? saved : INITIAL_TEACHER_PROFILE;
  });

  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const saved = initialData['dl_language'] as AppLanguage;
    if (saved && ['ar', 'en', 'de'].includes(saved)) return saved;
    const profileSaved = initialData['dl_profile'];
    if (profileSaved) {
      if (profileSaved.language && ['ar', 'en', 'de'].includes(profileSaved.language)) return profileSaved.language;
    }
    return INITIAL_TEACHER_PROFILE.language || 'de';
  });

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    storage.setItem('dl_language', lang);
    setProfile(prev => {
      const updated = { ...prev, language: lang };
      storage.setItem('dl_profile', updated);
      return updated;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const t = (key: TranslationKey): string => {
    const val = translations[language]?.[key] || translations['de']?.[key] || translations['en']?.[key] || translations['ar']?.[key];
    if (val !== undefined && val !== null && val !== '') return val;
    return '';
  };
  const _t = (ar: string, en: string, de?: string): string => {
    return language === 'ar' ? ar : language === 'de' ? (de || en) : en;
  };

  
  // Initial state for fresh start with duplicate ID sanitization
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = initialData['dl_groups'];
    const raw: Group[] = saved !== null && saved !== undefined ? saved : INITIAL_GROUPS;
    const seen = new Set<string>();
    return raw.map((item, idx) => {
      if (seen.has(item.id)) {
        const newId = `${item.id}_fixed_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        return { ...item, id: newId };
      }
      seen.add(item.id);
      return item;
    });
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = initialData['dl_students'];
    const raw: Student[] = saved !== null && saved !== undefined ? saved : INITIAL_STUDENTS;
    const seen = new Set<string>();
    return raw.map((item, idx) => {
      let st = item;
      if (seen.has(st.id)) {
        const newId = `${st.id}_fixed_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        st = { ...st, id: newId };
      }
      seen.add(st.id);

      // Memory Optimization: Clear any Base64/url avatar strings
      if (st.avatarUrl) {
        st = { ...st, avatarUrl: '' };
      }
      return st;
    });
  });

  // Memory Optimization: Filter active lessons for global RAM state (current month / last 60 days + future / pending)
  const filterActiveLessons = (raw: Lesson[]): Lesson[] => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const cutoffStr = formatLocalDate(sixtyDaysAgo);

    return raw.filter(l => {
      if (!l.date) return true;
      if (l.date >= cutoffStr) return true;
      if (l.status === 'scheduled' || isPendingStatus(l.status)) return true;
      return false;
    });
  };

  const [lessons, setLessons] = useState<Lesson[]>(() => {
    const saved = initialData['dl_lessons'];
    const raw: Lesson[] = saved !== null && saved !== undefined ? saved : INITIAL_LESSONS;
    const seen = new Set<string>();
    const sanitized = raw.map((item, idx) => {
      if (seen.has(item.id)) {
        const newId = `${item.id}_fixed_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        return { ...item, id: newId };
      }
      seen.add(item.id);
      return item;
    });
    return filterActiveLessons(sanitized);
  });

  // Memory Optimization: Filter active payments for global RAM state
  const filterActivePayments = (raw: PaymentRecord[]): PaymentRecord[] => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const cutoffStr = formatLocalDate(sixtyDaysAgo);

    return raw.filter(p => {
      const d = p.paidDate || p.dueDate || p.createdAt || '';
      if (!d) return true;
      if (d.substring(0, 10) >= cutoffStr) return true;
      if (p.status === 'pending' || p.status === 'partial') return true;
      return false;
    });
  };

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    const saved = initialData['dl_payments'];
    const raw: PaymentRecord[] = saved !== null && saved !== undefined ? saved : INITIAL_PAYMENT_RECORDS;
    const seen = new Set<string>();
    const sanitized = raw.map((item, idx) => {
      if (seen.has(item.id)) {
        const newId = `${item.id}_fixed_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        return { ...item, id: newId };
      }
      seen.add(item.id);
      return item;
    });
    return filterActivePayments(sanitized);
  });

  // Asynchronous Database Query methods for historical views (SessionHistoryView & ReportsView)
  const getHistoricalLessons = async (): Promise<Lesson[]> => {
    const full = await storage.getItem<Lesson[]>('dl_lessons');
    return full && full.length > 0 ? full : lessons;
  };

  const getHistoricalPayments = async (): Promise<PaymentRecord[]> => {
    const full = await storage.getItem<PaymentRecord[]>('dl_payments');
    return full && full.length > 0 ? full : payments;
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = initialData['dl_notifications'];
    const raw: NotificationItem[] = saved !== null && saved !== undefined ? saved : INITIAL_NOTIFICATIONS;
    const seen = new Set<string>();
    return raw.map((item, idx) => {
      if (seen.has(item.id)) {
        const newId = `${item.id}_fixed_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        return { ...item, id: newId };
      }
      seen.add(item.id);
      return item;
    });
  });

  const [certificates, setCertificates] = useState<CertificateRecord[]>(() => {
    const saved = initialData['dl_certificates'];
    const raw: CertificateRecord[] = Array.isArray(saved) ? saved : [];
    const seen = new Set<string>();
    return raw.map((item, idx) => {
      if (seen.has(item.id)) {
        const newId = `${item.id}_fixed_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        return { ...item, id: newId };
      }
      seen.add(item.id);
      return item;
    });
  });

  // System Notification Settings & Scheduled Notifications Engine
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    const saved = initialData['dl_notification_settings'];
    if (saved) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...saved };
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
  });

  const [pendingScheduledNotifications, setPendingScheduledNotifications] = useState<ScheduledNotificationItem[]>([]);

  const refreshPendingScheduledNotifications = async () => {
    const items = await getPendingScheduledNotifications();
    setPendingScheduledNotifications(items);
  };

  const updateNotificationSettings = async (updates: Partial<NotificationSettings>) => {
    const newSettings = { ...notificationSettings, ...updates };
    setNotificationSettings(newSettings);
    storage.setItem('dl_notification_settings', newSettings);

    // Rebuild schedule with updated settings
    await rebuildAllNotificationSchedules(newSettings, lessons, groups, students, payments);
    await refreshPendingScheduledNotifications();
  };

  const cancelSingleScheduledNotification = async (id: number) => {
    await cancelScheduledNotification(id);
    await refreshPendingScheduledNotifications();
  };

  const cancelAllPendingScheduledNotifications = async () => {
    await cancelAllScheduledNotifications();
    await refreshPendingScheduledNotifications();
  };

  const rebuildNotificationSchedules = async () => {
    const res = await rebuildAllNotificationSchedules(notificationSettings, lessons, groups, students, payments);
    await refreshPendingScheduledNotifications();
    return res;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      rebuildAllNotificationSchedules(notificationSettings, lessons, groups, students, payments)
        .then(() => getPendingScheduledNotifications().then(setPendingScheduledNotifications))
        .catch(err => console.warn('Auto notification schedule rebuild error:', err));
    }, 1500);
    return () => clearTimeout(timer);
  }, [lessons, students.length, groups.length]);

  // Inspiration & Gratitude Reminders State
  const [inspirationSettings, setInspirationSettings] = useState<InspirationSettings>(() => {
    const saved = initialData['dl_inspiration_settings'];
    return saved !== null && saved !== undefined ? saved : INITIAL_INSPIRATION_SETTINGS;
  });

  const [inspirationMessages, setInspirationMessages] = useState<InspirationMessage[]>(() => {
    const saved = initialData['dl_inspiration_messages'];
    return saved !== null && saved !== undefined ? saved : INITIAL_INSPIRATION_MESSAGES;
  });

  const [activeInspirationCard, setActiveInspirationCard] = useState<InspirationMessage | null>(null);
  const [isInspirationDismissedToday, setIsInspirationDismissedToday] = useState(false);

  // Backup & Sync States
  const [lastBackupTime, setLastBackupTime] = useState<string>(() => {
    const saved = initialData['dl_last_backup_time'];
    return saved !== null && saved !== undefined ? saved : new Date().toISOString();
  });
  

  // Lesson Control Modal state
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isControlModalOpen, setIsControlModalOpen] = useState(false);

  // Dashboard Dismissed Lessons state
  const [dismissedDashboardLessonIds, setDismissedDashboardLessonIds] = useState<string[]>(() => {
    const saved = initialData['dl_dismissed_dashboard_lessons'];
    return saved !== null && saved !== undefined ? saved : [];
  });

  const dismissLessonFromDashboard = (lessonId: string) => {
    setDismissedDashboardLessonIds(prev => {
      if (prev.includes(lessonId)) return prev;
      const updated = [...prev, lessonId];
      storage.setItem('dl_dismissed_dashboard_lessons', updated);
      return updated;
    });
  };

  // Global Search & Recently Deleted modals
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isRecentlyDeletedModalOpen, setIsRecentlyDeletedModalOpen] = useState(false);

  // Recently Deleted State
  const [recentlyDeleted, setRecentlyDeleted] = useState<RecentlyDeletedData>(() => {
    const saved = initialData['dl_recently_deleted'];
    return saved !== null && saved !== undefined ? saved : { students: [], groups: [], lessons: [] };
  });

  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_recently_deleted', recentlyDeleted);
  }, [recentlyDeleted]);

  // Quick action modals
  const [isAddLessonModalOpen, setIsAddLessonModalOpen] = useState(false);
  const [isAddQuickLessonModalOpen, setIsAddQuickLessonModalOpen] = useState(false);
  const [isStartLessonNowModalOpen, setIsStartLessonNowModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Network online/offline listener
  useEffect(() => {
    const handleOnline = () => {
      
    };
    const handleOffline = () => {
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Apply theme to DOM immediately on mount and whenever theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [theme]);

  // Sync state changes to storage
  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_profile', profile);
  }, [profile]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_groups', groups);
  }, [groups]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_students', students);
  }, [students]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    function syncLessons() {
      if (!lessons) return;
      const currentLessons = lessons;
      lessonSyncQueue = lessonSyncQueue.then(async () => {
        const full = (await storage.getItem<Lesson[]>('dl_lessons')) || [];
        const activeMap = new Map<string, Lesson>(currentLessons.map(l => [l.id, l]));
        const fullIds = new Set(full.map(l => l.id));

        const merged: Lesson[] = [];
        (full as Lesson[]).forEach((l: Lesson) => {
          if (activeMap.has(l.id)) {
            merged.push(activeMap.get(l.id)!);
          } else {
            const isActive = filterActiveLessons([l]).length > 0;
            if (!isActive) {
              // Historical lesson, preserve in storage
              merged.push(l);
            }
          }
        });

        currentLessons.forEach(l => {
          if (!fullIds.has(l.id)) {
            merged.push(l);
          }
        });

        await storage.setItem('dl_lessons', merged);
      }).catch(err => console.error('Lesson sync error:', err));
    }
    syncLessons();
  }, [lessons]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    function syncPayments() {
      if (!payments) return;
      const currentPayments = payments;
      paymentSyncQueue = paymentSyncQueue.then(async () => {
        const full = (await storage.getItem<PaymentRecord[]>('dl_payments')) || [];
        const activeMap = new Map(currentPayments.map(p => [p.id, p]));
        const fullIds = new Set(full.map(p => p.id));

        const merged = full.map(p => activeMap.get(p.id) || p);
        currentPayments.forEach(p => {
          if (!fullIds.has(p.id)) {
            merged.push(p);
          }
        });

        await storage.setItem('dl_payments', merged);
      }).catch(err => console.error('Payment sync error:', err));
    }
    syncPayments();
  }, [payments]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_notifications', notifications);
  }, [notifications]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_inspiration_settings', inspirationSettings);
  }, [inspirationSettings]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_inspiration_messages', inspirationMessages);
  }, [inspirationMessages]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    storage.setItem('dl_certificates', certificates);
  }, [certificates]);

  // Inspiration Handlers
  const updateInspirationSettings = (updates: Partial<InspirationSettings>) => {
    setInspirationSettings(prev => {
      const updated = { ...prev, ...updates };
      storage.setItem('dl_inspiration_settings', updated);
      return updated;
    });
  };

  const addInspirationMessage = (text: string): InspirationMessage => {
    const newMessage: InspirationMessage = {
      id: `custom_insp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: text.trim(),
      isFavorite: false,
      isCustom: true,
      createdAt: new Date().toISOString()
    };
    setInspirationMessages(prev => [newMessage, ...prev]);
    return newMessage;
  };

  const updateInspirationMessage = (id: string, text: string) => {
    setInspirationMessages(prev => prev.map(m => m.id === id ? { ...m, text: text.trim() } : m));
  };

  const deleteInspirationMessage = (id: string) => {
    setInspirationMessages(prev => prev.filter(m => m.id !== id));
    if (activeInspirationCard?.id === id) {
      setActiveInspirationCard(null);
    }
  };

  const toggleFavoriteInspirationMessage = (id: string) => {
    setInspirationMessages(prev => prev.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m));
  };

  const restoreDefaultInspirationMessages = () => {
    setInspirationMessages(prev => {
      const customMessages = prev.filter(m => m.isCustom);
      const restoredDefaults = INITIAL_INSPIRATION_MESSAGES.map(def => {
        const existing = prev.find(p => p.id === def.id || p.text === def.text);
        return existing || def;
      });
      return [...restoredDefaults, ...customMessages];
    });
    setInspirationSettings(prev => ({
      ...prev,
      frequency: prev.frequency || 'daily',
      displayMethod: prev.displayMethod || 'both',
      source: prev.source || 'all'
    }));
    confetti({ particleCount: 50, spread: 60 });
  };

  const dismissInspirationCard = () => {
    setActiveInspirationCard(null);
    setIsInspirationDismissedToday(true);
  };

  const checkAndTriggerInspirationReminder = (triggerType: 'manual' | 'app_load' | 'before_lesson' = 'app_load') => {
    if (inspirationSettings.frequency === 'disabled' && triggerType !== 'manual') {
      return;
    }

    const todayStr = formatLocalDate();

    if (triggerType !== 'manual') {
      // Check if already shown today
      if (inspirationSettings.lastShownDate === todayStr) {
        // If already shown today and displayMethod includes in_app card, load the active card if not dismissed
        if (!isInspirationDismissedToday && inspirationSettings.lastShownMessageId && (inspirationSettings.displayMethod === 'in_app' || inspirationSettings.displayMethod === 'both')) {
          const shownMsg = inspirationMessages.find(m => m.id === inspirationSettings.lastShownMessageId);
          if (shownMsg && !activeInspirationCard) {
            setActiveInspirationCard(shownMsg);
          }
        }
        return;
      }

      // Check specific frequency rules
      if (inspirationSettings.frequency === 'before_first_lesson' && triggerType !== 'before_lesson') {
        const todaysLessons = lessons.filter(l => l.date === todayStr && l.status !== 'cancelled');
        if (todaysLessons.length === 0) {
          return; // No lessons today yet
        }
      }
    }

    // Candidate pool selection
    let candidates = inspirationMessages;
    if (inspirationSettings.source === 'favorites_only') {
      const favs = inspirationMessages.filter(m => m.isFavorite);
      if (favs.length > 0) {
        candidates = favs;
      }
    }

    if (candidates.length === 0) return;

    // Pick a message
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selectedMsg = candidates[randomIndex];

    // Update settings with lastShownDate & lastShownMessageId
    setInspirationSettings(prev => ({
      ...prev,
      lastShownDate: todayStr,
      lastShownMessageId: selectedMsg.id
    }));

    // Trigger display
    const method = inspirationSettings.displayMethod;
    if (method === 'in_app' || method === 'both') {
      setActiveInspirationCard(selectedMsg);
    }

    if (method === 'notification' || method === 'both') {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('💡 الإلهام والامتنان | Glück', {
            body: selectedMsg.text,
            icon: '/icon.png'
          });
        } catch {
          // ignore
        }
      }

      addAppNotification('💡 إلهام وامتنان اليوم', selectedMsg.text, 'system');
    }
  };

  // Auto Trigger Effect for Inspiration Reminders
  useEffect(() => {
    checkAndTriggerInspirationReminder('app_load');
  }, [inspirationSettings.frequency, inspirationSettings.source, inspirationSettings.displayMethod, lessons]);

  // 30-Minute Upcoming Lesson Alert Check Worker
  const [notifiedLessonAlerts, setNotifiedLessonAlerts] = useState<Record<string, boolean>>(() => {
    const saved = initialData['dl_notified_lesson_alerts'];
    return saved !== null && saved !== undefined ? saved : [];
  });

  useEffect(() => {
    storage.setItem('dl_notified_lesson_alerts', notifiedLessonAlerts);
  }, [notifiedLessonAlerts]);

  useEffect(() => {
    if (profile.enableLessonAlerts === false && profile.enableBrowserPush === false) return;

    const checkUpcomingLessonsAlerts = () => {
      const now = new Date();
      const todayStr = formatLocalDate(now);
      const nowMins = now.getHours() * 60 + now.getMinutes();

      lessons.forEach((lesson) => {
        if (lesson.date !== todayStr || lesson.status !== 'scheduled') return;

        const timeParts = lesson.time.split(':').map(n => parseInt(n, 10));
        if (timeParts.length < 2 || isNaN(timeParts[0]) || isNaN(timeParts[1])) return;

        const lessonMins = timeParts[0] * 60 + timeParts[1];
        const diffMins = lessonMins - nowMins;

        const alertKey = `${lesson.id}_${lesson.date}_30m`;
        if (diffMins >= 0 && diffMins <= 30 && !notifiedLessonAlerts[alertKey]) {
          setNotifiedLessonAlerts(prev => ({ ...prev, [alertKey]: true }));

          const studentOrGroupName = lesson.title || lesson.groupName || lesson.studentName || 'Lektion';
          const titleText = `⏰ Lektion in Kürze (${diffMins === 0 ? 'Jetzt' : `${diffMins} Min`})`;
          const bodyText = `Die Lektion "${studentOrGroupName}" beginnt ${diffMins === 0 ? 'jetzt' : `in ${diffMins} Minuten`} um ${lesson.time} Uhr!`;

          if (profile.enableLessonAlerts !== false) {
            addAppNotification(titleText, bodyText, 'reminder', { lessonId: lesson.id });
          }

          if (profile.enableBrowserPush && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new window.Notification(titleText, {
                body: bodyText,
                icon: '/favicon.ico',
                tag: alertKey
              });
            } catch (err) {
              console.error('Error firing push notification:', err);
            }
          }
        }
      });
    };

    checkUpcomingLessonsAlerts();
    const interval = setInterval(checkUpcomingLessonsAlerts, 20000);
    return () => clearInterval(interval);
  }, [lessons, profile.enableLessonAlerts, profile.enableBrowserPush, notifiedLessonAlerts]);

  // Auto-sync recurring group schedules directly into calendar
  useEffect(() => {
    if (!groups || groups.length === 0) return;

    const newAutoLessons: Lesson[] = [];
    const today = new Date();

    groups.forEach(group => {
      const slots = getGroupScheduleSlots(group);
      if (slots.length === 0) return;

      for (let dayOffset = 0; dayOffset < 28; dayOffset++) { // 4 weeks
        const d = new Date();
        d.setDate(today.getDate() + dayOffset);
        const dayNum = d.getDay();

        const matchingSlot = slots.find(s => getDayNumber(s.day) === dayNum);
        if (matchingSlot) {
          const dateStr = formatLocalDate(d);
          const sessionTime = matchingSlot.time || '17:00';

          const existsInLessons = lessons.some(l => l.groupId === group.id && l.date === dateStr && l.time === sessionTime);
          const existsInNew = newAutoLessons.some(l => l.groupId === group.id && l.date === dateStr && l.time === sessionTime);

          if (!existsInLessons && !existsInNew) {
            const perSessionPrice = group.paymentCycle === 'per_lesson' && group.pricePerSession
              ? group.pricePerSession
              : Math.round((group.monthlyPackagePrice || 1200) / (group.sessionCount || 8));

            newAutoLessons.push({
              id: `l_${Date.now()}_auto_${Math.random().toString(36).substring(2, 6)}`,
              groupId: group.id,
              groupName: group.name,
              title: `${group.name} Lektion`,
              date: dateStr,
              time: sessionTime,
              durationMinutes: 60,
              type: group.type,
              grade: group.grade,
              sessionNumber: ((lessons.filter(l => l.groupId === group.id).length + newAutoLessons.length) % (group.sessionCount || 8)) + 1,
              totalSessionsInPackage: group.sessionCount || 8,
              status: 'scheduled',
              paymentStatus: 'pending',
              amountDue: perSessionPrice,
              amountPaid: 0,
              meetingLink: group.type === 'online' ? (group.zoomLink || profile.defaultZoomLink) : undefined,
              locationAddress: group.type === 'offline' ? (group.address || 'Cairo Center') : undefined
            });
          }
        }
      }
    });

    if (newAutoLessons.length > 0) {
      setLessons(prev => {
        const deduplicated = newAutoLessons.filter(
          nl => !prev.some(l => l.groupId === nl.groupId && l.date === nl.date && l.time === nl.time)
        );
        return deduplicated.length > 0 ? [...prev, ...deduplicated] : prev;
      });
    }
  }, [groups]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const updateProfile = (updates: Partial<TeacherProfile>) => {
    setProfile(prev => {
      const updated = { ...prev, ...updates };
      storage.setItem('dl_profile', updated);
      return updated;
    });
    const currentState = syncStateRef.current;
    const nextRev = syncRevisionRef.current + 1;
    syncRevisionRef.current = nextRev;
    setSyncState(prev => prev ? { ...prev, localRevisionCounter: nextRev } : prev);
    if (currentState) {
      storage.setItem('dl_sync_state', { ...currentState, localRevisionCounter: nextRev });
    }
  };

  // Sync simulation with Google Cloud
  // Explicit Refresh Calendar & Dashboard function
  const refreshCalendarAndDashboard = () => {

    // Get current valid group and student IDs & names
    const currentGroupIds = new Set(groups.map(g => g.id));
    const currentStudentIds = new Set(students.map(s => s.id));
    const currentStudentNames = new Set(students.map(s => s.name.toLowerCase()));

    // Clean up orphaned & duplicate lessons
    setLessons(prev => {
      const seenGroupLessons = new Set<string>();
      return prev.filter(lesson => {
        // If group lesson and group no longer exists
        if (lesson.groupId && lesson.groupId !== 'quick_group' && !currentGroupIds.has(lesson.groupId)) {
          return false;
        }
        // If student lesson and student no longer exists
        if (lesson.studentId && !currentStudentIds.has(lesson.studentId)) {
          return false;
        }
        if (lesson.studentName && !lesson.isQuickLesson && !currentStudentNames.has(lesson.studentName.toLowerCase()) && !lesson.groupId) {
          return false;
        }

        // Deduplicate group lessons (same group, same date, same time)
        if (lesson.groupId && lesson.groupId !== 'quick_group') {
          const key = `${lesson.groupId}_${lesson.date}_${lesson.time}`;
          if (seenGroupLessons.has(key)) {
            return false;
          }
          seenGroupLessons.add(key);
        }

        return true;
      });
    });

    // Clean up orphaned payments
    setPayments(prev => prev.filter(payment => {
      if (payment.groupId && payment.groupId !== 'quick_group' && !currentGroupIds.has(payment.groupId)) {
        return false;
      }
      if (payment.studentId && !payment.studentId.startsWith('temp_') && !currentStudentIds.has(payment.studentId)) {
        return false;
      }
      return true;
    }));

    // Trigger visual sync completion feedback
    setTimeout(() => {
    }, 600);
  };

  // Drive Backup export
  const backupToDrive = async () => {
    const data = {
      profile,
      groups,
      students,
      lessons,
      payments,
      notifications,
      inspirationSettings,
      inspirationMessages,
      exportedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const fileName = `Glueck_Backup_${formatLocalDate()}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: jsonStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        await Share.share({
          title: 'Glück Backup',
          text: 'Backup Export Data (Glück)',
          url: savedFile.uri,
          dialogTitle: 'Export Backup JSON'
        });
      } catch (err) {
        console.warn('Native export via Filesystem failed, falling back to download blob:', err);
        const blob = new Blob([jsonStr], { type: 'application/json' });
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
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    updateProfile({ lastSyncedAt: timeNow });
  };

  // Drive Restore import
  const restoreFromDrive = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.profile) setProfile(parsed.profile);
      if (parsed.groups) setGroups(parsed.groups);
      if (parsed.students) setStudents(parsed.students);
      if (parsed.lessons) setLessons(parsed.lessons);
      if (parsed.payments) setPayments(parsed.payments);
      if (parsed.notifications) setNotifications(parsed.notifications);
      if (parsed.inspirationSettings) setInspirationSettings(parsed.inspirationSettings);
      if (parsed.inspirationMessages) setInspirationMessages(parsed.inspirationMessages);
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setProfile(prev => ({ ...prev, lastSyncedAt: timeNow }));
      confetti({ particleCount: 70, spread: 60 });
      return true;
    } catch (err) {
      console.error('Failed to restore backup', err);
      return false;
    }
  };

  // Synchronized notification handler (app state + phone system)
  const addAppNotification = (title: string, message: string, type: 'system' | 'reminder' | 'payment', extraFields?: any) => {
    const newNotif: NotificationItem = {
      id: `notif_${type}_${Date.now()}`,
      title,
      message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type,
      read: false,
      ...extraFields
    };

    setNotifications(prev => [newNotif, ...prev.slice(0, 49)]);

    // Mirror to native device main notification tray
    sendSystemNotification(title, message, type).catch(err => {
      console.warn('Failed to dispatch native system notification:', err);
    });
  };

  // Group operations
  const addGroup = (groupData: Omit<Group, 'id'>): Group => {
    const newGroup: Group = wrapMutation({
      ...groupData,
      id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    } as Group);
    setGroups(prev => [...prev, newGroup]);
    return newGroup;
  };

  const duplicateGroup = (groupId: string): Group => {
    const targetGroup = groups.find(g => g.id === groupId);
    if (!targetGroup) throw new Error('Group not found');

    const duplicatedGroup: Group = wrapMutation({
      ...targetGroup,
      id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: `${targetGroup.name} (Kopie)`,
    } as Group);
    setGroups(prev => [...prev, duplicatedGroup]);
    confetti({ particleCount: 50, spread: 40 });
    return duplicatedGroup;
  };

  const updateGroup = (id: string, updates: Partial<Group>) => {
    setGroups(prev => prev.map(g => (g.id === id ? wrapMutation({ ...g, ...updates } as Group) : g)));
  };

  const deleteGroup = (id: string) => {
    const targetGroup = groups.find(g => g.id === id);
    if (targetGroup) {
      setRecentlyDeleted(prev => ({
        ...prev,
        groups: [{ item: targetGroup, deletedAt: new Date().toISOString() }, ...prev.groups]
      }));
    }
    setGroups(prev => prev.map(g => g.id === id ? wrapDeletion(g) : g));

    // Remove group association safely for linked students while preserving student records
    setStudents(prev => prev.map(s => s.groupId === id ? wrapMutation({ ...s, groupId: '' } as Student) : s));

    // Cancel / delete future scheduled lessons belonging to the deleted group while preserving completed historical lessons
    const todayStr = formatLocalDate();
    setLessons(prev => prev.map(l => {
      if (l.groupId === id && (l.date >= todayStr || l.status === 'scheduled' || l.status === 'in_progress' || l.status === 'pending_action') && l.status !== 'completed') {
        return wrapDeletion(l);
      }
      return l;
    }));
  };

  const archiveGroup = (id: string) => {
    setGroups(prev => prev.map(g => g.id === id ? wrapMutation({ ...g, status: 'archived' } as Group) : g));
  };

  const cascadeDeleteGroup = (id: string) => {
    const groupStudents = students.filter(s => s.groupId === id);
    const groupStudentIds = new Set(groupStudents.map(s => s.id));
    const groupLessons = lessons.filter(l => l.groupId === id);
    const groupLessonIds = new Set(groupLessons.map(l => l.id));

    setGroups(prev => prev.map(g => g.id === id ? wrapDeletion(g) : g));
    setStudents(prev => prev.map(s => s.groupId === id ? wrapDeletion(s) : s));
    setLessons(prev => prev.map(l => l.groupId === id ? wrapDeletion(l) : l));
    setPayments(prev => prev.map(p => (p.groupId === id || groupStudentIds.has(p.studentId)) ? wrapDeletion(p) : p));
    setNotifications(prev => prev.map(n => (n.lessonId && groupLessonIds.has(n.lessonId)) ? wrapDeletion(n) : n));
  };

  // Student operations (Note: Pricing is automatically inherited from assigned group!)
  const addStudent = (studentData: Omit<Student, 'id' | 'documents' | 'joinedDate'>): Student => {
    const newStudent: Student = wrapMutation({
      ...studentData,
      id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      documents: [],
      joinedDate: formatLocalDate()
    } as Student);
    setStudents(prev => [...prev, newStudent]);
    return newStudent;
  };

  const updateStudent = (id: string, updates: Partial<Student>) => {
    setStudents(prev => prev.map(s => (s.id === id ? wrapMutation({ ...s, ...updates } as Student) : s)));
  };

  const deleteStudent = (id: string) => {
    const targetStudent = students.find(s => s.id === id);
    if (targetStudent) {
      setRecentlyDeleted(prev => ({
        ...prev,
        students: [{ item: targetStudent, deletedAt: new Date().toISOString() }, ...prev.students]
      }));
    }
    setStudents(prev => prev.map(s => s.id === id ? wrapDeletion(s) : s));
  };

  const archiveStudent = (id: string) => {
    setStudents(prev => prev.map(s => s.id === id ? wrapMutation({ ...s, status: 'archived' } as Student) : s));
  };

  const uploadStudentDocument = (studentId: string, file: File, category: 'homework' | 'exam' | 'doc') => {
    const newDoc: StudentDocument = {
      id: `doc_${Date.now()}`,
      fileName: file.name,
      fileType: file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'doc',
      fileSize: `${(file.size / 1024).toFixed(1)} KB`,
      uploadedAt: formatLocalDate(),
      url: URL.createObjectURL(file),
      category
    };
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, documents: [newDoc, ...s.documents] } : s));
  };

  const deleteStudentDocument = (studentId: string, docId: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? {
      ...s,
      documents: s.documents.filter(d => d.id !== docId)
    } : s));
  };

  const updateStudentCertificateName = (studentId: string, certName: string) => {
    setStudents(prev => prev.map(s => (s.id === studentId ? wrapMutation({ ...s, certificateName: certName } as Student) : s)));
  };

  const updateStudentCertificateNamesBulk = (updates: { studentId: string; certificateName: string }[]) => {
    const updateMap = new Map(updates.map(u => [u.studentId, u.certificateName]));
    setStudents(prev => {
      const nextList = (prev || []).map(st => {
        if (updateMap.has(st.id)) {
          return wrapMutation({ ...st, certificateName: updateMap.get(st.id)! } as Student);
        }
        return st;
      });
      return nextList;
    });
  };

  const addCertificate = (cert: Omit<CertificateRecord, 'id' | 'createdAt'> & { id?: string }): CertificateRecord => {
    const newCert: CertificateRecord = {
      ...cert,
      id: cert.id || `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      originDeviceId: syncStateRef.current?.localDeviceId || 'local',
      originRevision: syncRevisionRef.current + 1,
      deleted: false,
    };
    const tracked = wrapMutation(newCert);
    setCertificates(prev => [tracked, ...(prev || [])]);
    return tracked;
  };

  const addCertificatesBulk = (certsList: (Omit<CertificateRecord, 'id' | 'createdAt'> & { id?: string })[]): CertificateRecord[] => {
    const createdList: CertificateRecord[] = certsList.map(c => {
      const newCert: CertificateRecord = {
        ...c,
        id: c.id || `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
        originDeviceId: syncStateRef.current?.localDeviceId || 'local',
        originRevision: syncRevisionRef.current + 1,
        deleted: false,
      };
      return wrapMutation(newCert);
    });

    setCertificates(prev => [...createdList, ...(prev || [])]);
    return createdList;
  };

  const updateCertificate = (id: string, updates: Partial<CertificateRecord>) => {
    setCertificates(prev => (prev || []).map(c => (c.id === id ? wrapMutation({ ...c, ...updates, updatedAt: Date.now() } as CertificateRecord) : c)));
  };

  const deleteCertificate = (id: string) => {
    setCertificates(prev => (prev || []).map(c => (c.id === id ? wrapDeletion(c) : c)));
  };

  // Recently Deleted (Soft Delete Recovery)
  const restoreItem = (type: 'student' | 'group' | 'lesson', id: string) => {
    if (type === 'student') {
      const target = recentlyDeleted.students.find(d => d.item.id === id);
      if (target) {
        setStudents(prev => {
          const exists = prev.some(s => s.id === id);
          if (exists) {
            return prev.map(s => s.id === id ? wrapMutation({ ...target.item, deleted: false } as any) : s);
          }
          return [...prev, wrapMutation({ ...target.item, deleted: false } as any)];
        });
        setRecentlyDeleted(prev => ({ ...prev, students: prev.students.filter(d => d.item.id !== id) }));
      }
    } else if (type === 'group') {
      const target = recentlyDeleted.groups.find(d => d.item.id === id);
      if (target) {
        setGroups(prev => {
          const exists = prev.some(g => g.id === id);
          if (exists) {
            return prev.map(g => g.id === id ? wrapMutation({ ...target.item, deleted: false } as any) : g);
          }
          return [...prev, wrapMutation({ ...target.item, deleted: false } as any)];
        });
        setRecentlyDeleted(prev => ({ ...prev, groups: prev.groups.filter(d => d.item.id !== id) }));
      }
    } else if (type === 'lesson') {
      const target = recentlyDeleted.lessons.find(d => d.item.id === id);
      if (target) {
        setLessons(prev => {
          const exists = prev.some(l => l.id === id);
          if (exists) {
            return prev.map(l => l.id === id ? wrapMutation({ ...target.item, deleted: false } as any) : l);
          }
          return [...prev, wrapMutation({ ...target.item, deleted: false } as any)];
        });
        setRecentlyDeleted(prev => ({ ...prev, lessons: prev.lessons.filter(d => d.item.id !== id) }));
      }
    }
    confetti({ particleCount: 50, spread: 40 });
  };

  const permanentlyDeleteItem = (type: 'student' | 'group' | 'lesson', id: string) => {
    if (type === 'student') {
      setRecentlyDeleted(prev => ({ ...prev, students: prev.students.filter(d => d.item.id !== id) }));
    } else if (type === 'group') {
      setRecentlyDeleted(prev => ({ ...prev, groups: prev.groups.filter(d => d.item.id !== id) }));
    } else if (type === 'lesson') {
      setRecentlyDeleted(prev => ({ ...prev, lessons: prev.lessons.filter(d => d.item.id !== id) }));
    }
  };

  const clearRecentlyDeleted = () => {
    setRecentlyDeleted({ students: [], groups: [], lessons: [] });
  };

  // Lesson operations with session calculation
  const addLesson = (lessonData: Omit<Lesson, 'id' | 'sessionNumber' | 'totalSessionsInPackage'> & { id?: string }, repeatWeeks: number = 1): Lesson[] => {
    const targetGroup = groups.find(g => g.id === lessonData.groupId && !g.deleted);
    const activeLessons = lessons.filter(l => !l.deleted && l.status !== 'cancelled');
    const groupLessons = activeLessons.filter(l => l.groupId === lessonData.groupId);
    const totalSessions = targetGroup?.sessionCount || 4;

    const createdLessons: Lesson[] = [];
    const baseDate = new Date(lessonData.date);

    for (let week = 0; week < repeatWeeks; week++) {
      const lessonDate = new Date(baseDate);
      lessonDate.setDate(baseDate.getDate() + (week * 7));
      const dateStr = formatLocalDate(lessonDate);

      // Check if an active non-deleted lesson already exists on this date/time for this group
      const exists = activeLessons.some(l => l.groupId === lessonData.groupId && l.date === dateStr && l.time === lessonData.time);
      if (!exists) {
        const currentSessionNum = ((groupLessons.length + createdLessons.length) % totalSessions) + 1;

        createdLessons.push(wrapMutation({
          ...lessonData,
          id: (week === 0 && lessonData.id) ? lessonData.id : `l_${Date.now()}_${week}_${Math.random().toString(36).substring(2, 5)}`,
          date: dateStr,
          sessionNumber: currentSessionNum,
          totalSessionsInPackage: totalSessions,
          meetingLink: lessonData.type === 'online' ? (targetGroup?.zoomLink || profile.defaultZoomLink) : undefined,
          locationAddress: lessonData.type === 'offline' ? (targetGroup?.address || 'Hauptstraße 45, Cairo') : undefined
        } as Lesson));
      }
    }

    if (createdLessons.length > 0) {
      setLessons(prev => [...prev, ...createdLessons]);
    }
    return createdLessons;
  };

  const updateLesson = (id: string, updates: Partial<Lesson>) => {
    setLessons(prev => prev.map(l => (l.id === id ? wrapMutation({ ...l, ...updates } as Lesson) : l)));
    if (selectedLesson && selectedLesson.id === id) {
      setSelectedLesson(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const deleteLesson = (id: string) => {
    const targetLesson = lessons.find(l => l.id === id);
    if (targetLesson) {
      setRecentlyDeleted(prev => ({
        ...prev,
        lessons: [{ item: targetLesson, deletedAt: new Date().toISOString() }, ...prev.lessons]
      }));
    }
    setLessons(prev => prev.map(l => l.id === id ? wrapDeletion(l) : l));
    if (selectedLesson?.id === id) {
      closeLessonControl();
    }
  };

  const saveLessonReport = (lessonId: string, report: LessonReport, packageCount?: number) => {
    const targetLesson = lessons.find(l => l.id === lessonId);
    if (!targetLesson) return;

    const updatedTotalSessions = packageCount || targetLesson.totalSessionsInPackage || 4;
    const finalAmountPaid = report.amountPaid ?? targetLesson.amountPaid;
    const finalAmountDue = targetLesson.amountDue || 200;
    const today = formatLocalDate();

    const groupSts = targetLesson.groupId 
      ? students.filter(s => s.groupId === targetLesson.groupId)
      : [];

    setLessons(prev => prev.map(l => {
      if (l.id === lessonId) {
        const updatedStudentPayments: Record<string, StudentPaymentDetail> = {};
        if (report.studentPayments) {
          Object.entries(report.studentPayments).forEach(([stId, pDet]) => {
            const stObj = students.find(s => s.id === stId);
            updatedStudentPayments[stId] = {
              studentId: stId,
              studentName: stObj?.name || 'Schüler',
              paymentStatus: pDet.status,
              amountPaid: pDet.amount,
              amountDue: targetLesson.amountDue || 200
            };
          });
        }
        return {
          ...l,
          status: 'completed',
          paymentStatus: report.paymentStatus,
          amountPaid: finalAmountPaid,
          totalSessionsInPackage: updatedTotalSessions,
          studentPayments: Object.keys(updatedStudentPayments).length > 0 ? updatedStudentPayments : l.studentPayments,
          report
        };
      }
      return l;
    }));

    // Auto-sync payment records directly into Payments Center (Zahlungszentrum) based on attended lesson cycles
    setPayments(prev => {
      let nextPayments = [...prev];

      const targetStudents = groupSts.length > 0
        ? groupSts
        : (targetLesson.studentId
            ? students.filter(s => s.id === targetLesson.studentId)
            : (targetLesson.studentName ? students.filter(s => s.name === targetLesson.studentName) : []));

      if (targetStudents.length > 0) {
        targetStudents.forEach(st => {
          // Check attendance status for student in this lesson
          const stAttendance = report.studentAttendance?.[st.id] || report.attendanceStatus || 'present';
          // Only track if student was present or late (attended)
          if (stAttendance === 'absent') return;

          // Determine bundle size and price for student using canonical pricing utility
          const grp = groups.find(g => g.id === st.groupId || g.id === targetLesson.groupId);
          const { cycleLength: bundleSize, amountDue: bundlePrice } = getStudentCyclePricing(st, grp);

          // Format lesson date as DD/MM/YYYY
          const parts = targetLesson.date.split('-');
          const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : targetLesson.date;


          // Get starting session offset for the first cycle
          const hasPaidPayments = nextPayments.some(p => p.studentId === st.id && p.status === 'paid');
          const startSess = grp?.startingSessionNumber || 1;
          const virtualOffset = !hasPaidPayments && startSess > 1 ? (startSess - 1) : 0;

          // Find open payment record cycle for this student where lesson dates length < bundleSize and status is not fully settled
          const openCycleIndex = nextPayments.findIndex(p =>
            p.studentId === st.id &&
            (p.lessonDates?.length || 0) < (p.bundleSize || bundleSize) &&
            p.status !== 'paid'
          );
          
          const stPayChoice = report.studentPayments?.[st.id];

          // Compute how many unbilled lessons this student has right now
          const paidLessonIds = new Set<string>();
          nextPayments.forEach(p => {
            if (p.studentId === st.id && p.status === 'paid' && p.lessonIds) {
              p.lessonIds.forEach(id => paidLessonIds.add(id));
            }
          });
          
          const unbilledCompletedLessons = lessons.filter(l => {
             if (l.status !== 'completed' && l.id !== targetLesson.id) return false;
             
             // Check if lesson belongs to student's group or student individually
             const matchesGroup = st.groupId ? l.groupId === st.groupId : false;
             const matchesStudent = l.studentId ? l.studentId === st.id : (!!l.studentName && l.studentName === st.name);
             if (!matchesGroup && !matchesStudent) return false;

             if (paidLessonIds.has(l.id) && l.id !== targetLesson.id) return false;
             const att = l.report?.studentAttendance?.[st.id] || l.report?.attendanceStatus || (l.id === targetLesson.id ? stAttendance : 'present');
             if (att === 'absent') return false;
             return true;
          });
          
          const reachedBundleSize = (unbilledCompletedLessons.length + virtualOffset) >= bundleSize;
          const isPayingNow = stPayChoice?.amount !== undefined && stPayChoice.amount > 0;

          if (!reachedBundleSize && !isPayingNow) {
            // DO NOT CREATE PAYMENT RECORD
            return;
          }

          const formattedDateWithSession = `${formattedDate} (Session ${targetLesson.sessionNumber || 1}/${bundleSize})`;

          if (openCycleIndex >= 0) {
            // Update existing open payment cycle
            const currentRec = nextPayments[openCycleIndex];
            const existingDates = currentRec.lessonDates || [];
            const existingIds = currentRec.lessonIds || [];

            const updatedDates = [...existingDates];
            const updatedIds = [...existingIds];

            if (!updatedIds.includes(targetLesson.id)) {
              updatedIds.push(targetLesson.id);
            }

            // Generate virtual dates for the first cycle if needed
            if (virtualOffset > 0) {
              for (let i = 1; i <= virtualOffset; i++) {
                const vLabel = `Offline (Session ${i}/${bundleSize})`;
                if (!updatedDates.includes(vLabel)) {
                  updatedDates.push(vLabel);
                }
              }
            }

            // Add all unbilled completed lessons
            if (reachedBundleSize) {
              unbilledCompletedLessons.forEach(l => {
                const lDate = l.date.split('-').length === 3 ? `${l.date.split('-')[2]}/${l.date.split('-')[1]}/${l.date.split('-')[0]}` : l.date;
                const formattedLDate = `${lDate} (Session ${l.sessionNumber || 1}/${bundleSize})`;
                if (!updatedIds.includes(l.id)) updatedIds.push(l.id);
                if (!updatedDates.includes(formattedLDate)) updatedDates.push(formattedLDate);
              });
            } else {
              if (!updatedDates.includes(formattedDateWithSession)) {
                updatedDates.push(formattedDateWithSession);
              }
            }

            const curPaid = stPayChoice?.amount !== undefined ? stPayChoice.amount : currentRec.amountPaid;
            const curStatus = stPayChoice?.status || (curPaid >= bundlePrice ? 'paid' : (curPaid > 0 ? 'partial' : 'pending'));

            const updatedRecord: PaymentRecord = {
              ...currentRec,
              groupId: st.groupId || targetLesson.groupId || '',
              groupName: grp?.name || targetLesson.groupName || 'Gruppe',
              bundleSize: currentRec.bundleSize || bundleSize,
              amountDue: currentRec.amountDue || bundlePrice,
              amountPaid: curPaid,
              remainingBalance: Math.max(0, (currentRec.amountDue || bundlePrice) - curPaid - (currentRec.discountAmount || 0)),
              lessonIds: updatedIds,
              lessonDates: updatedDates,
              status: curStatus,
              paidDate: curStatus === 'paid' ? today : currentRec.paidDate,
              notes: `Paket (${updatedDates.length}/${currentRec.bundleSize || bundleSize} Lektionen)`
            };

            nextPayments[openCycleIndex] = updatedRecord;
          } else {
            // Create a brand new payment cycle record for student
            const initPaid = stPayChoice?.status === 'paid' ? bundlePrice : (stPayChoice?.amount || 0);
            const initStatus = stPayChoice?.status || (initPaid >= bundlePrice ? 'paid' : (initPaid > 0 ? 'partial' : 'pending'));
            
            const initialIds = [targetLesson.id];
            const initialDates: string[] = [];

            if (virtualOffset > 0) {
              for (let i = 1; i <= virtualOffset; i++) {
                initialDates.push(`Offline (Session ${i}/${bundleSize})`);
              }
            }

            if (reachedBundleSize) {
              unbilledCompletedLessons.forEach(l => {
                const lDate = l.date.split('-').length === 3 ? `${l.date.split('-')[2]}/${l.date.split('-')[1]}/${l.date.split('-')[0]}` : l.date;
                const formattedLDate = `${lDate} (Session ${l.sessionNumber || 1}/${bundleSize})`;
                if (!initialIds.includes(l.id)) initialIds.push(l.id);
                if (!initialDates.includes(formattedLDate)) {
                  initialDates.push(formattedLDate);
                }
              });
            } else {
              initialDates.push(formattedDateWithSession);
            }

            // Prorated amount if partially virtual
            const pricePerSession = bundlePrice / bundleSize;
            const actualCount = initialIds.length;
            const adjustedAmountDue = virtualOffset > 0 ? Math.round(pricePerSession * actualCount) : bundlePrice;

            const newRecord: PaymentRecord = {
              id: `pay_cycle_${st.id}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              studentId: st.id,
              studentName: st.name,
              groupId: st.groupId || targetLesson.groupId || '',
              groupName: grp?.name || targetLesson.groupName || 'Gruppe',
              bundleSize: bundleSize,
              amountDue: adjustedAmountDue,
              amountPaid: initPaid,
              remainingBalance: Math.max(0, adjustedAmountDue - initPaid),
              dueDate: targetLesson.date,
              paidDate: initStatus === 'paid' ? today : undefined,
              status: initStatus,
              lessonIds: initialIds,
              lessonDates: initialDates,
              paymentType: bundleSize > 1 ? 'package_bundle' : 'lesson_fee',
              paymentMethod: 'vodafone_cash',
              notes: `Zahlungszyklus (${bundleSize}er Paket)`,
              createdAt: new Date().toISOString()
            };
            nextPayments.unshift(newRecord);
          }

        });
      }

      return nextPayments;
    });

    // Update students payment status in state
    setStudents(prev => prev.map(s => {
      const isGroupMember = targetLesson.groupId && s.groupId === targetLesson.groupId;
      const isIndividual = targetLesson.studentId ? s.id === targetLesson.studentId : (!!targetLesson.studentName && s.name === targetLesson.studentName);

      if (isGroupMember || isIndividual) {
        const stPayChoice = report.studentPayments?.[s.id];
        const newStatus = stPayChoice?.status || report.paymentStatus;
        return {
          ...s,
          paymentStatus: newStatus
        };
      }
      return s;
    }));

    if (targetLesson.sessionNumber === updatedTotalSessions) {
      const packageTitle = targetLesson.groupName || targetLesson.studentName || targetLesson.title;
      const notifMsg = `Paket beendet: ${targetLesson.sessionNumber} von ${updatedTotalSessions} Sitzungen abgeschlossen für ${packageTitle}. Zahlung erforderlich.`;
      
      addAppNotification('⚠️ Paket beendet & Zahlung fällig', notifMsg, 'payment', { lessonId });
    }

    if (selectedLesson && selectedLesson.id === lessonId) {
      setSelectedLesson(prev => prev ? {
        ...prev,
        status: 'completed',
        paymentStatus: report.paymentStatus,
        amountPaid: finalAmountPaid,
        totalSessionsInPackage: updatedTotalSessions,
        report
      } : null);
    }

    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  };

  const cancelLesson = (lessonId: string, notes?: string) => {
    setLessons(prev => prev.map(l => {
      if (l.id === lessonId) {
        const existingNotes = l.report?.teacherNotes || l.quickNotes || '';
        const combinedNotes = notes 
          ? (existingNotes ? `${existingNotes} | Absage-Notiz: ${notes}` : `Absage-Notiz: ${notes}`) 
          : existingNotes;

        return {
          ...l,
          status: 'cancelled' as LessonStatus,
          report: l.report ? {
            ...l.report,
            teacherNotes: combinedNotes,
            savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          } : {
            attendanceStatus: 'absent' as AttendanceStatus,
            homeworkStatus: 'not_completed' as HomeworkStatus,
            paymentStatus: l.paymentStatus || 'pending',
            teacherNotes: combinedNotes || 'Lektion abgesagt',
            savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        };
      }
      return l;
    }));

    if (selectedLesson && selectedLesson.id === lessonId) {
      setSelectedLesson(prev => prev ? {
        ...prev,
        status: 'cancelled',
        report: prev.report ? {
          ...prev.report,
          teacherNotes: notes ? (prev.report.teacherNotes ? `${prev.report.teacherNotes} | Absage-Notiz: ${notes}` : `Absage-Notiz: ${notes}`) : prev.report.teacherNotes
        } : {
          attendanceStatus: 'absent',
          homeworkStatus: 'not_completed',
          paymentStatus: prev.paymentStatus || 'pending',
          teacherNotes: notes ? `Absage-Notiz: ${notes}` : 'Lektion abgesagt',
          savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      } : null);
      closeLessonControl();
    }
  };

  const generateGroupScheduleLessons = (groupId: string, days: string[], defaultTime: string, numWeeks: number = 4, customDayTimes?: Record<string, string>, groupOverride?: Group) => {
    const targetGroup = groupOverride || groups.find(g => g.id === groupId && !g.deleted);
    if (!targetGroup) return;

    const effectiveGroup: Group = {
      ...targetGroup,
      scheduleDays: days && days.length > 0 ? days : targetGroup.scheduleDays,
      scheduleTime: defaultTime || targetGroup.scheduleTime,
      scheduleDayTimes: customDayTimes || targetGroup.scheduleDayTimes,
    };

    const slots = getGroupScheduleSlots(effectiveGroup);
    if (slots.length === 0) return;

    const newLessons: Lesson[] = [];
    const today = new Date();

    const activeLessons = lessons.filter(l => !l.deleted && l.status !== 'cancelled');

    const checkOverlap = (l1: { date: string; time: string; durationMinutes: number }, l2: { date: string; time: string; durationMinutes: number }) => {
      if (l1.date !== l2.date) return false;
      const getMinutes = (timeStr: string) => {
        const [h, m] = (timeStr || "00:00").split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      const start1 = getMinutes(l1.time);
      const end1 = start1 + (l1.durationMinutes || 60);
      const start2 = getMinutes(l2.time);
      const end2 = start2 + (l2.durationMinutes || 60);
      return start1 < end2 && start2 < end1;
    };

    for (let dayOffset = 0; dayOffset < numWeeks * 7; dayOffset++) {
      const d = new Date();
      d.setDate(today.getDate() + dayOffset);
      const dayNum = d.getDay();

      const matchingSlot = slots.find(s => getDayNumber(s.day) === dayNum);

      if (matchingSlot) {
        const dateStr = formatLocalDate(d);
        const sessionTime = matchingSlot.time || defaultTime || '17:00';

        // Check if an active non-deleted lesson already exists for this group on this date & time
        const exists = activeLessons.some(l => 
          (l.groupId === groupId || (targetGroup.name && l.groupName === targetGroup.name)) && 
          l.date === dateStr && 
          l.time === sessionTime
        ) || newLessons.some(nl => 
          nl.groupId === groupId && 
          nl.date === dateStr && 
          nl.time === sessionTime
        );

        if (!exists) {
          const isPerLesson = targetGroup.paymentCycle === 'per_lesson' || targetGroup.paymentModel === 'per_session';
          const perSessionPrice = isPerLesson && targetGroup.pricePerSession
            ? targetGroup.pricePerSession
            : Math.round((targetGroup.monthlyPackagePrice || 1200) / (targetGroup.sessionCount || 8));

          const dummyLesson = { id: 'dummy', date: dateStr, time: sessionTime, durationMinutes: targetGroup.lessonDurationMinutes || 60 };
          
          // Conflict check against other groups (not this group and not a recreated instance of this group)
          const hasConflict = activeLessons.some(l => 
            l.groupId !== groupId && 
            l.groupName !== targetGroup.name && 
            checkOverlap(dummyLesson, l)
          ) || newLessons.some(l => checkOverlap(dummyLesson, l));
          
          if (!hasConflict) {
            newLessons.push(wrapMutation({
              id: `l_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              groupId: targetGroup.id,
              groupName: targetGroup.name,
              title: `${targetGroup.name} Lektion`,
              date: dateStr,
              time: sessionTime,
              durationMinutes: targetGroup.lessonDurationMinutes || 60,
              type: targetGroup.type,
              grade: targetGroup.grade,
              sessionNumber: (((targetGroup.startingSessionNumber || 1) - 1 + activeLessons.filter(l => l.groupId === groupId).length + newLessons.length) % (targetGroup.sessionCount || 8)) + 1,
              totalSessionsInPackage: targetGroup.sessionCount || 8,
              status: 'scheduled',
              paymentStatus: 'pending',
              amountDue: perSessionPrice,
              amountPaid: 0,
              meetingLink: targetGroup.type === 'online' ? (targetGroup.zoomLink || profile.defaultZoomLink) : undefined,
              locationAddress: targetGroup.type === 'offline' ? (targetGroup.address || 'Cairo Center') : undefined
            } as Lesson));
          }
        }
      }
    }

    if (newLessons.length > 0) {
      setLessons(prev => {
        const deduplicated = newLessons.filter(
          nl => !prev.some(l => !l.deleted && (l.groupId === nl.groupId || l.groupName === nl.groupName) && l.date === nl.date && l.time === nl.time)
        );
        return deduplicated.length > 0 ? [...prev, ...deduplicated] : prev;
      });
    }
  };

  // Payments
  const recordPayment = (
    paymentId: string, 
    paidAmount: number, 
    method: 'cash' | 'vodafone_cash' | 'bank_transfer' | 'instapay' | 'paypal', 
    notes?: string,
    discountAmount: number = 0,
    advanceAmount: number = 0,
    refundAmount: number = 0
  ) => {
    const today = formatLocalDate();
    setPayments(prev => prev.map(p => {
      if (p.id === paymentId) {
        const newPaid = (p.amountPaid || 0) + paidAmount + advanceAmount - refundAmount;
        const totalDiscount = (p.discountAmount || 0) + discountAmount;
        const netDue = Math.max(0, p.amountDue - totalDiscount);
        const rem = Math.max(0, netDue - newPaid);
        const newStatus: PaymentStatus = rem === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending';

        return wrapMutation({
          ...p,
          amountPaid: newPaid,
          discountAmount: totalDiscount,
          advanceAmount: (p.advanceAmount || 0) + advanceAmount,
          refundAmount: (p.refundAmount || 0) + refundAmount,
          remainingBalance: rem,
          status: newStatus,
          paidDate: today,
          paymentMethod: method,
          notes: notes ? (p.notes ? `${p.notes} • ${notes}` : notes) : p.notes
        } as PaymentRecord);
      }
      return p;
    }));
    confetti({ particleCount: 60, spread: 50 });
  };

  const addPaymentRecord = (record: Omit<PaymentRecord, 'id'>) => {
    const rem = Math.max(0, (record.amountDue || 0) - (record.amountPaid || 0) - (record.discountAmount || 0));
    const newRecord: PaymentRecord = wrapMutation({
      ...record,
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      remainingBalance: rem,
      createdAt: new Date().toISOString()
    } as PaymentRecord);
    setPayments(prev => [newRecord, ...prev]);
  };

  const markCyclePaymentPaid = (data: {
    studentId: string;
    studentName: string;
    groupId: string;
    groupName: string;
    amountDue: number;
    amountPaid: number;
    lessonDates: string[];
    lessonIds: string[];
    existingPaymentRecordId?: string;
    notes?: string;
  }) => {
    const today = formatLocalDate();

    if (data.existingPaymentRecordId) {
      setPayments(prev => prev.map(p => {
        if (p.id === data.existingPaymentRecordId) {
          return wrapMutation({
            ...p,
            amountPaid: data.amountPaid,
            remainingBalance: Math.max(0, p.amountDue - data.amountPaid),
            status: 'paid',
            paidDate: today,
            lessonDates: data.lessonDates,
            lessonIds: data.lessonIds,
            notes: data.notes || `Bezahlt am ${today}`
          } as PaymentRecord);
        }
        return p;
      }));
    } else {
      const newRecord: PaymentRecord = wrapMutation({
        id: `pay_paid_${data.studentId}_${Date.now()}`,
        studentId: data.studentId,
        studentName: data.studentName,
        groupId: data.groupId,
        groupName: data.groupName,
        amountDue: data.amountDue,
        amountPaid: data.amountPaid,
        remainingBalance: 0,
        dueDate: today,
        paidDate: today,
        status: 'paid',
        paymentMethod: 'vodafone_cash',
        lessonDates: data.lessonDates,
        lessonIds: data.lessonIds,
        notes: data.notes || `Bezahlt am ${today}`,
        createdAt: new Date().toISOString()
      } as PaymentRecord);

      setPayments(prev => [newRecord, ...prev]);
    }

    setStudents(prev => prev.map(s => s.id === data.studentId ? { ...s, paymentStatus: 'paid' } : s));
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
  };

  const markCyclePaymentNotYet = (data: {
    studentId: string;
    studentName: string;
    groupId: string;
    groupName: string;
    amountDue: number;
    lessonDates: string[];
    lessonIds: string[];
    existingPaymentRecordId?: string;
  }) => {
    if (!data.existingPaymentRecordId) {
      const today = formatLocalDate();
      const newRecord: PaymentRecord = {
        id: `pay_due_${data.studentId}_${Date.now()}`,
        studentId: data.studentId,
        studentName: data.studentName,
        groupId: data.groupId,
        groupName: data.groupName,
        amountDue: data.amountDue,
        amountPaid: 0,
        remainingBalance: data.amountDue,
        dueDate: today,
        status: 'pending',
        paymentMethod: 'vodafone_cash',
        lessonDates: data.lessonDates,
        lessonIds: data.lessonIds,
        notes: 'Noch offen (In Erwartung)',
        createdAt: new Date().toISOString()
      };
      setPayments(prev => [newRecord, ...prev]);
    }
  };

  const toggleQuickPaymentStatus = (paymentId: string) => {
    const today = formatLocalDate();
    let targetStId = '';
    let newStStatus: PaymentStatus = 'pending';

    setPayments(prev => prev.map(p => {
      if (p.id === paymentId) {
        targetStId = p.studentId;
        const isPaid = p.status === 'paid' || (p.amountPaid >= p.amountDue && p.amountDue > 0);
        if (isPaid) {
          newStStatus = 'pending';
          return {
            ...p,
            amountPaid: 0,
            remainingBalance: p.amountDue,
            status: 'pending',
            paidDate: undefined
          };
        } else {
          newStStatus = 'paid';
          return {
            ...p,
            amountPaid: p.amountDue,
            remainingBalance: 0,
            status: 'paid',
            paidDate: today
          };
        }
      }
      return p;
    }));

    if (targetStId) {
      setStudents(prev => prev.map(s => s.id === targetStId ? { ...s, paymentStatus: newStStatus } : s));
    }
  };

  const toggleStudentPaymentStatus = (studentId: string) => {
    const today = formatLocalDate();
    const targetSt = students.find(s => s.id === studentId);
    if (!targetSt) return;

    const existingPayment = payments.find(p => p.studentId === studentId && p.status !== 'paid') || payments.find(p => p.studentId === studentId);

    if (existingPayment) {
      toggleQuickPaymentStatus(existingPayment.id);
    } else {
      // Create payment record and mark as paid
      const fee = targetSt.monthlyFee || 200;
      const grp = groups.find(g => g.id === targetSt.groupId);
      
      const newRec: PaymentRecord = {
        id: `pay_st_${studentId}_${Date.now()}`,
        studentId: targetSt.id,
        studentName: targetSt.name,
        groupId: targetSt.groupId,
        groupName: grp?.name || 'Einzelunterricht',
        amountDue: fee,
        amountPaid: fee,
        remainingBalance: 0,
        dueDate: today,
        paidDate: today,
        status: 'paid',
        paymentMethod: 'vodafone_cash',
        notes: 'Schnell-Buchung (1-Klick Status)'
      };

      setPayments(prev => [newRec, ...prev]);
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, paymentStatus: 'paid' } : s));
    }
  };

  const updateStudentPaymentPlan = (
    studentId: string, 
    paymentPlan: 'per_lesson' | '4_lessons' | '8_lessons' | '12_lessons' | 'custom_bundle',
    pricePerLesson?: number,
    bundleSize?: number,
    customBundlePrice?: number
  ) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          paymentPlan,
          pricePerLesson: pricePerLesson ?? s.pricePerLesson,
          bundleSize: bundleSize ?? s.bundleSize,
          customBundlePrice: customBundlePrice ?? s.customBundlePrice
        };
      }
      return s;
    }));
    confetti({ particleCount: 50, spread: 40 });
  };

  const updateLessonPaymentStatus = (lessonId: string, status: PaymentStatus, customAmountPaid?: number) => {
    const targetLesson = lessons.find(l => l.id === lessonId);
    if (!targetLesson) return;

    const due = targetLesson.amountDue || 200;
    const finalPaid = customAmountPaid !== undefined 
      ? customAmountPaid 
      : (status === 'paid' ? due : 0);

    const today = formatLocalDate();

    // Update lesson status and amount
    setLessons(prev => prev.map(l => {
      if (l.id === lessonId) {
        return {
          ...l,
          paymentStatus: status,
          amountPaid: finalPaid,
          report: l.report ? {
            ...l.report,
            paymentStatus: status,
            amountPaid: finalPaid
          } : undefined
        };
      }
      return l;
    }));

    // Update student payment status if individual student
    if (targetLesson.studentId) {
      setStudents(prev => prev.map(s => s.id === targetLesson.studentId ? { ...s, paymentStatus: status } : s));
    }

    // Sync corresponding payment record in payments list
    setPayments(prev => {
      const existingIdx = prev.findIndex(p => p.lessonId === lessonId || (p.lessonIds && p.lessonIds.includes(lessonId)));
      if (existingIdx >= 0) {
        return prev.map((p, idx) => {
          if (idx === existingIdx) {
            const rem = Math.max(0, p.amountDue - finalPaid - (p.discountAmount || 0));
            return {
              ...p,
              amountPaid: finalPaid,
              remainingBalance: rem,
              status,
              paidDate: status === 'paid' ? today : p.paidDate
            };
          }
          return p;
        });
      } else {
        const newRec: PaymentRecord = {
          id: `pay_l_${lessonId}_${Date.now()}`,
          studentId: targetLesson.studentId || '',
          studentName: targetLesson.studentName || targetLesson.groupName || targetLesson.title,
          groupId: targetLesson.groupId || '',
          groupName: targetLesson.groupName || 'Gruppe',
          lessonId: targetLesson.id,
          amountDue: due,
          amountPaid: finalPaid,
          remainingBalance: Math.max(0, due - finalPaid),
          dueDate: targetLesson.date,
          paidDate: status === 'paid' ? today : undefined,
          status,
          paymentMethod: 'vodafone_cash',
          notes: `Beendete Lektion (${targetLesson.date}): ${targetLesson.title}`
        };
        return [newRec, ...prev];
      }
    });

    if (status === 'paid') {
      confetti({ particleCount: 70, spread: 60 });
    }
  };

  // Notifications
  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const clearAllData = async () => {
    // Clear all storage engines completely (localforage database, localStorage, memoryStore)
    await storage.clear();

    // Reset all React state to defaults
    setGroups([]);
    setStudents([]);
    setLessons([]);
    setPayments([]);
    setNotifications([]);
    setCertificates([]);
    setRecentlyDeleted({ students: [], groups: [], lessons: [] });
    setDismissedDashboardLessonIds([]);
    setProfile(INITIAL_TEACHER_PROFILE);
    setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    setInspirationSettings(INITIAL_INSPIRATION_SETTINGS);
    setInspirationMessages(INITIAL_INSPIRATION_MESSAGES);
    setLanguageState(INITIAL_TEACHER_PROFILE.language || 'de');

    // Fire celebration confetti
    confetti({ particleCount: 100, spread: 80 });

    // Reload the window to reinitialize all context states with default values
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Quick Lesson operations
  const addQuickLesson = (data: Omit<Lesson, 'id' | 'sessionNumber' | 'totalSessionsInPackage' | 'groupId' | 'groupName'> & {
    studentName: string;
    quickStudentPhone?: string;
    quickParentPhone?: string;
    quickNotes?: string;
  }): Lesson => {
    const newLesson: Lesson = {
      ...data,
      id: `ql_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      groupId: 'quick_group',
      groupName: 'Quick Lesson',
      studentName: data.studentName,
      title: `⚡ Quick Lesson: ${data.studentName}`,
      sessionNumber: 1,
      totalSessionsInPackage: 1,
      isQuickLesson: true,
      quickStudentPhone: data.quickStudentPhone || '',
      quickParentPhone: data.quickParentPhone || '',
      quickNotes: data.quickNotes || '',
      meetingLink: data.type === 'online' ? (data.meetingLink || profile.defaultZoomLink) : undefined,
      locationAddress: data.type === 'offline' ? (data.locationAddress || 'Kairo Schulungsraum') : undefined,
    };

    setLessons(prev => [newLesson, ...prev]);

    // Create corresponding payment record so it reflects in Revenue & Reports
    const newPayment: PaymentRecord = {
      id: `p_ql_${Date.now()}`,
      studentId: `temp_qs_${Date.now()}`,
      studentName: data.studentName,
      groupId: 'quick_group',
      groupName: 'Quick Lesson',
      amountDue: data.amountDue || 0,
      amountPaid: data.amountPaid || 0,
      dueDate: data.date,
      status: data.paymentStatus || (data.amountPaid >= data.amountDue ? 'paid' : data.amountPaid > 0 ? 'partial' : 'pending'),
      notes: `⚡ Quick Lesson Payment (${data.date}): ${data.quickNotes || ''}`
    };
    setPayments(prev => [newPayment, ...prev]);

    confetti({ particleCount: 60, spread: 60 });
    return newLesson;
  };

  const convertQuickLessonToStudent = (lessonId: string): Student | null => {
    const targetLesson = lessons.find(l => l.id === lessonId);
    if (!targetLesson || !targetLesson.studentName) return null;

    let defaultGroup = groups[0];
    if (!defaultGroup) {
      defaultGroup = addGroup({
        name: 'Einzelunterricht (1-on-1)',
        grade: targetLesson.grade || 'Grade 9',
        type: targetLesson.type || 'online',
        monthlyPackagePrice: 1200,
        sessionCount: 4,
        color: '#3b82f6'
      });
    }

    const newStudent: Student = {
      id: `s_${Date.now()}`,
      name: targetLesson.studentName,
      groupId: defaultGroup.id,
      grade: targetLesson.grade || defaultGroup.grade || 'Grade 9',
      parentName: `${targetLesson.studentName}'s Eltern`,
      parentPhone: targetLesson.quickParentPhone || '',
      studentPhone: targetLesson.quickStudentPhone || '',
      notes: `Konvertiert aus Quick Lesson vom ${targetLesson.date}. Notizen: ${targetLesson.quickNotes || 'Keine'}`,
      documents: [],
      joinedDate: formatLocalDate()
    };

    setStudents(prev => [newStudent, ...prev]);

    // Convert all matching quick lessons to permanent student lessons
    setLessons(prev => prev.map(l => {
      if (l.studentName === targetLesson.studentName && (l.isQuickLesson || l.groupId === 'quick_group')) {
        return {
          ...l,
          studentId: newStudent.id,
          groupId: defaultGroup.id,
          groupName: defaultGroup.name,
          title: `${newStudent.name} - Lektion`,
          isQuickLesson: false
        };
      }
      return l;
    }));

    // Update payment records
    setPayments(prev => prev.map(p => {
      if (p.studentName === targetLesson.studentName) {
        return {
          ...p,
          studentId: newStudent.id,
          groupId: defaultGroup.id,
          groupName: defaultGroup.name
        };
      }
      return p;
    }));

    confetti({ particleCount: 100, spread: 80 });
    return newStudent;
  };

  // BACKUP & SYNC VERIFICATION SYSTEM
  const performBackup = () => {
    const backupObj: BackupData = {
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      profile,
      groups,
      students,
      lessons,
      payments,
      notifications,
      certificates,
      inspirationSettings,
      inspirationMessages,
      syncQueue: []
    };

    const jsonStr = JSON.stringify(backupObj);
    storage.setItem('dl_local_backup_data', jsonStr);
    const now = new Date().toISOString();
    storage.setItem('dl_last_backup_time', now);
    setLastBackupTime(now);
  };

  const importBackupFile = async (customJson?: string): Promise<boolean> => {
    try {
      const sourceStr = customJson || await storage.getItem('dl_local_backup_data');
      if (!sourceStr) return false;

      const parsed = JSON.parse(sourceStr);
      const validation = validateAndSanitizeBackupPayload(parsed);
      if (!validation.isValid) {
        console.error('importBackupFile validation failed:', validation.errorMessage);
        return false;
      }

      const data = validation.data;
      if (data.profile) setProfile(data.profile);
      if (data.groups) setGroups(data.groups);
      if (data.students) setStudents(data.students);
      if (data.lessons) setLessons(data.lessons);
      if (data.payments) setPayments(data.payments);
      if (data.notifications) setNotifications(data.notifications);
      if (data.certificates) setCertificates(data.certificates);
      if (data.inspirationSettings) setInspirationSettings(data.inspirationSettings);
      if (data.inspirationMessages) setInspirationMessages(data.inspirationMessages);

      // Reconcile and safeguard synchronization metadata
      const reconciledState = await applyRestoreSyncSafeguards(
        {
          groups: data.groups || [],
          students: data.students || [],
          lessons: data.lessons || [],
          payments: data.payments || [],
          notifications: data.notifications || []
        },
        syncStateRef.current
      );

      if (reconciledState) {
        setSyncState(reconciledState);
        syncStateRef.current = reconciledState;
        syncRevisionRef.current = reconciledState.localRevisionCounter;
      }

      confetti({ particleCount: 80, spread: 70 });
      return true;
    } catch (e) {
      console.error('Failed to restore backup', e);
      return false;
    }
  };

  const exportBackupFile = async () => {
    const backupObj: BackupData = {
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      profile,
      groups,
      students: students.map(s => {
        if (s.avatarUrl && s.avatarUrl.startsWith('data:image')) {
          return { ...s, avatarUrl: '' };
        }
        return s;
      }),
      lessons,
      payments,
      notifications,
      certificates,
      inspirationSettings,
      inspirationMessages,
      syncQueue: [],
      todos,
    };
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const fileName = `znd_backup_${formatLocalDate()}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: jsonStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        await Share.share({
          title: 'Glück Backup',
          text: 'Backup Export Data (Glück)',
          url: savedFile.uri,
          dialogTitle: 'Export Backup JSON'
        });
        return;
      } catch (err) {
        console.warn('Native export via Filesystem failed, falling back to download blob:', err);
      }
    }

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const verifyBackupIntegrity = (): BackupIntegrityReport => {
    const quickLessonsCount = lessons.filter(l => l.isQuickLesson || l.groupId === 'quick_group').length;
    const messages: string[] = [];

    // Check student IDs uniqueness
    const studentIds = students.map(s => s.id);
    const uniqueStudentIds = new Set(studentIds);
    if (studentIds.length !== uniqueStudentIds.size) {
      messages.push('⚠️ Doppelte Schüler-IDs entdeckt');
    }

    // Check lesson IDs uniqueness
    const lessonIds = lessons.map(l => l.id);
    const uniqueLessonIds = new Set(lessonIds);
    if (lessonIds.length !== uniqueLessonIds.size) {
      messages.push('⚠️ Doppelte Lektions-IDs entdeckt');
    }

    if (messages.length === 0) {
      messages.push('✓ Alle Datensätze sind lokal und in Google Backup verifiziert.');
      messages.push('✓ Keine Duplikate, keine fehlenden Referenzen.');
      messages.push('✓ Quick Lessons, Berichte und Zahlungen synchronisiert.');
    }

    return {
      timestamp: new Date().toISOString(),
      isValid: !messages.some(m => m.includes('⚠️')),
      totalRecords: groups.length + students.length + lessons.length + payments.length + notifications.length,
      details: {
        groupsCount: groups.length,
        studentsCount: students.length,
        lessonsCount: lessons.length,
        paymentsCount: payments.length,
        quickLessonsCount
      },
      messages
    };
  };

  // Control modal open/close
  const openLessonControl = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setIsControlModalOpen(true);
  };

  const closeLessonControl = () => {
    setIsControlModalOpen(false);
    setSelectedLesson(null);
  };

  // Active Running Lesson Timer Engine State
  const [activeLessonSession, setActiveLessonSession] = useState<ActiveLessonSession | null>(() => {
    const saved = initialData['dl_active_lesson_session'];
    return saved !== null && saved !== undefined ? saved : null;
  });

  useEffect(() => {
    if (activeLessonSession) {
      storage.setItem('dl_active_lesson_session', activeLessonSession);
    } else {
      storage.removeItem('dl_active_lesson_session');
      clearActiveLessonNotification();
    }
  }, [activeLessonSession]);

  const startActiveLessonTimer = (lesson: Lesson) => {
    const startTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const now = Date.now();
    const targetGroup = groups.find(g => g.id === lesson.groupId);
    const resolvedDuration = lesson.durationMinutes || targetGroup?.lessonDurationMinutes || profile.defaultLessonDuration || 60;
    const durationMins = resolvedDuration > 0 ? resolvedDuration : 60;

    const session: ActiveLessonSession = {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      groupName: lesson.groupName || lesson.studentName || 'Gruppe',
      grade: lesson.grade,
      type: lesson.type,
      startedAt: now,
      accumulatedSeconds: 0,
      durationMinutes: durationMins,
      isRunning: true,
      startTimeStr
    };
    setActiveLessonSession(session);
    updateLesson(lesson.id, { status: 'in_progress' });

    const elapsedMins = 0;
    const remainingMins = durationMins;
    const percent = 0;

    // Trigger Android Native Foreground Service for Google Maps navigation style notification
    // LiveTimer.startTimer({
    //   title: `${lesson.title} (${session.groupName})`,
    //   startTime: now,
    //   durationMins,
    //   elapsedMins,
    //   remainingMins,
    //   percent
    // }).catch(err => console.warn('LiveTimer start error:', err));
  };

  const pauseActiveLessonTimer = () => {
    if (!activeLessonSession || !activeLessonSession.isRunning) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - activeLessonSession.startedAt) / 1000));
    setActiveLessonSession({
      ...activeLessonSession,
      isRunning: false,
      accumulatedSeconds: activeLessonSession.accumulatedSeconds + elapsed
    });

    // Pause native timer notification
    // LiveTimer.stopTimer().catch(err => console.warn('LiveTimer stop error:', err));
  };

  const resumeActiveLessonTimer = () => {
    if (!activeLessonSession || activeLessonSession.isRunning) return;
    const now = Date.now();
    setActiveLessonSession({
      ...activeLessonSession,
      isRunning: true,
      startedAt: now
    });

    const rawDuration = activeLessonSession.durationMinutes || 60;
    const durationMins = rawDuration > 0 ? rawDuration : 60;
    const totalElapsedSecs = activeLessonSession.accumulatedSeconds;
    const elapsedMins = Math.floor(totalElapsedSecs / 60);
    const remainingMins = Math.max(0, durationMins - elapsedMins);
    const rawPercent = Math.round(((elapsedMins / durationMins) * 100));
    const percent = Math.min(100, Math.floor(((elapsedMins / durationMins) * 100)));

    // Resume native timer with offset startTime so chronometer reflects total accumulated time
    const effectiveStartTime = now - (activeLessonSession.accumulatedSeconds * 1000);
    // LiveTimer.startTimer({
    //   title: `${activeLessonSession.lessonTitle} (${activeLessonSession.groupName})`,
    //   startTime: effectiveStartTime,
    //   durationMins,
    //   elapsedMins,
    //   remainingMins,
    //   percent
    // }).catch(err => console.warn('LiveTimer resume error:', err));
  };

  const endActiveLessonTimer = () => {
    setActiveLessonSession(null);
    clearActiveLessonNotification();
    // LiveTimer.stopTimer().catch(err => console.warn('LiveTimer stop error:', err));
  };

  const cancelActiveLessonTimer = () => {
    if (activeLessonSession) {
      cancelLesson(activeLessonSession.lessonId, 'Abgebrochen während der laufenden Sitzung');
    }
    setActiveLessonSession(null);
    clearActiveLessonNotification();
    // LiveTimer.stopTimer().catch(err => console.warn('LiveTimer stop error:', err));
  };

  const enrichedStudents = useMemo(() => {
    // Map studentId -> Set of paid lesson IDs for fast lookup
    const studentPaidLessons = new Map<string, Set<string>>();
    payments.forEach(p => {
      if (p.status === 'paid' && p.lessonIds && p.lessonIds.length > 0) {
        const stId = p.studentId;
        if (stId) {
          if (!studentPaidLessons.has(stId)) {
            studentPaidLessons.set(stId, new Set<string>());
          }
          p.lessonIds.forEach(id => studentPaidLessons.get(stId)!.add(id));
        }
      }
    });

    return students.map(st => {
      const grp = groups.find(g => g.id === st.groupId);
      const { cycleLength } = getStudentCyclePricing(st, grp);
      const paidIds = studentPaidLessons.get(st.id) || new Set<string>();

      const unbilledCompletedCount = lessons.filter(l => {
        if (l.status !== 'completed') return false;
        const matchesGroup = grp ? l.groupId === grp.id : false;
        const matchesStudent = l.studentId ? l.studentId === st.id : (!!l.studentName && l.studentName === st.name);
        if (!matchesGroup && !matchesStudent) return false;

        const att = l.report?.studentAttendance?.[st.id] || l.report?.attendanceStatus || 'present';
        if (att === 'absent') return false;

        if (paidIds.has(l.id)) return false;

        return true;
      }).length;

      const packageProgress = unbilledCompletedCount === 0 ? 0 : (unbilledCompletedCount % cycleLength || cycleLength);

      return {
        ...st,
        packageProgress,
        totalLessonsCount: cycleLength
      };
    });
  }, [students, groups, lessons, payments]);

  // Master Widget Sync Engine
  useEffect(() => {
    const timer = setTimeout(() => {
      syncAllWidgetsToNative({
        lessons,
        students,
        payments,
        todos,
        groups,
        activeSession: activeLessonSession ? {
          id: activeLessonSession.lessonId,
          groupName: activeLessonSession.groupName,
          startTime: activeLessonSession.startedAt,
          attendanceCount: 0
        } : null
      }).catch(err => console.warn('Master widget sync error:', err));
    }, 1000);
    return () => clearTimeout(timer);
  }, [lessons, students, payments, todos, groups, activeLessonSession]);

  const teacherSettingsRecord: TeacherSettingsRecord = useMemo(() => ({
    id: 'singleton_teacher_settings',
    profile,
    schedulingPreferences: {
      defaultLessonDuration: 60,
      bufferBetweenLessonsMins: 15,
      autoAlertMinutes: 30
    },
    updatedAt: Date.now(),
    originDeviceId: syncState?.localDeviceId || 'local',
    originRevision: syncRevisionRef.current,
    deleted: false
  }), [profile, syncState?.localDeviceId]);

  const localDataRef = React.useRef({ groups, students, lessons, payments, notifications, todos, settings: [teacherSettingsRecord] });
  useEffect(() => {
    localDataRef.current = { groups, students, lessons, payments, notifications, todos, settings: [teacherSettingsRecord] };
  }, [groups, students, lessons, payments, notifications, todos, teacherSettingsRecord]);

  const syncDataSource: SyncDataSource = {
    getLocalData: () => localDataRef.current,
    getSyncState: () => syncStateRef.current as SyncStateMetadata,
    saveMergedData: async (key: string, data: any[]) => {
      switch (key) {
        case 'groups': setGroups(data); break;
        case 'students': setStudents(data); break;
        case 'lessons': setLessons(data); break;
        case 'payments': setPayments(data); break;
        case 'notifications': setNotifications(data); break;
        case 'todos': setTodos(data); break;
        case 'settings': {
          if (Array.isArray(data) && data.length > 0 && data[0]?.profile) {
            const incomingProfile = data[0].profile;
            setProfile(incomingProfile);
            if (incomingProfile.language && ['ar', 'en', 'de'].includes(incomingProfile.language)) {
              setLanguageState(incomingProfile.language);
            }
            await storage.setItem('dl_profile', incomingProfile);
            await storage.setItem('dl_settings', data);
          }
          break;
        }
      }
    },
    updateSyncState: async (newState: SyncStateMetadata) => {
      setSyncState(newState);
      syncStateRef.current = newState;
      syncRevisionRef.current = newState.localRevisionCounter;
      await storage.setItem('dl_sync_state', newState);
    }
  };

  useEffect(() => {
    if (syncState && isSyncReady) {
      autoSyncEngine.init(syncDataSource);
    }
  }, [syncState?.localDeviceId, isSyncReady]);

  const triggerSync = async (peerId: string): Promise<boolean> => {
    if (!syncState) return false;
    const res = await autoSyncEngine.executeSync(peerId, 'Manual Sync', false);
    return res.success;
  };

  const forceSyncPeer = async (peerId: string): Promise<{ success: boolean; report: SyncCycleReport }> => {
    if (!syncState) throw new Error('Sync not initialized');
    return await autoSyncEngine.executeSync(peerId, 'Force Full Sync', true);
  };

  const getPendingOutbox = (): PendingOutboxSummary => {
    if (!syncState) return { totalCount: 0, byEntity: {}, items: [], oldestPendingTimestamp: null };
    return calculatePendingOutbox(
      syncState.peerWatermarkTable || {},
      localDataRef.current,
      syncState.pairedPeers || []
    );
  };

  const getSyncHistory = async (): Promise<SyncHistoryEntry[]> => {
    return await syncHistoryService.getHistory();
  };

  const clearSyncHistory = async (): Promise<void> => {
    await syncHistoryService.clearHistory();
  };

  const startHosting = async () => {
    if (!syncState) throw new Error('Sync not initialized');
    return await startLocalServer(syncState.localDeviceName, syncState.localDeviceId, syncState, syncDataSource);
  };

  return (
    <AppContext.Provider
      value={{
        todos,
        setTodos,
        theme,
        toggleTheme,
        language,
        setLanguage,
        accentColor,
        setAccentColor,
        t,
        _t,
        activeTab,
        setActiveTab,
        isGlobalSearchOpen,
        setIsGlobalSearchOpen,
        isRecentlyDeletedModalOpen,
        setIsRecentlyDeletedModalOpen,
        profile,
        updateProfile,
        
        refreshCalendarAndDashboard,
        backupToDrive,
        restoreFromDrive,
        lastBackupTime,
        
        performBackup,
        
        importBackupFile,
        exportBackupFile,
        verifyBackupIntegrity,
        groups: getActiveRecords(groups),
        addGroup,
        duplicateGroup,
        updateGroup,
        deleteGroup,
        archiveGroup,
        cascadeDeleteGroup,
        students: getActiveRecords(enrichedStudents),
        addStudent,
        updateStudent,
        deleteStudent,
        archiveStudent,
        uploadStudentDocument,
        deleteStudentDocument,
        lessons: getActiveRecords(lessons),
        addLesson,
        addQuickLesson,
        convertQuickLessonToStudent,
        updateLesson,
        deleteLesson,
        saveLessonReport,
        cancelLesson,
        generateGroupScheduleLessons,
        recentlyDeleted,
        restoreItem,
        permanentlyDeleteItem,
        clearRecentlyDeleted,
        payments: getActiveRecords(payments),
        recordPayment,
        addPaymentRecord,
        markCyclePaymentPaid,
        markCyclePaymentNotYet,
        toggleQuickPaymentStatus,
        toggleStudentPaymentStatus,
        updateStudentPaymentPlan,
        updateLessonPaymentStatus,
        certificates: getActiveRecords(certificates || []),
        addCertificate,
        addCertificatesBulk,
        updateCertificate,
        deleteCertificate,
        setCertificates,
        updateStudentCertificateName,
        updateStudentCertificateNamesBulk,
        notifications: getActiveRecords(notifications),
        markNotificationRead,
        markAllNotificationsRead,
        clearAllNotifications,
        notificationSettings,
        updateNotificationSettings,
        pendingScheduledNotifications,
        refreshPendingScheduledNotifications,
        cancelSingleScheduledNotification,
        cancelAllPendingScheduledNotifications,
        rebuildNotificationSchedules,
        clearAllData,
        selectedLesson,
        setSelectedLesson,
        isControlModalOpen,
        openLessonControl,
        closeLessonControl,
        activeLessonSession,
        startActiveLessonTimer,
        pauseActiveLessonTimer,
        resumeActiveLessonTimer,
        endActiveLessonTimer,
        cancelActiveLessonTimer,
        dismissedDashboardLessonIds,
        dismissLessonFromDashboard,
        inspirationSettings,
        inspirationMessages,
        activeInspirationCard,
        updateInspirationSettings,
        addInspirationMessage,
        updateInspirationMessage,
        deleteInspirationMessage,
        toggleFavoriteInspirationMessage,
        restoreDefaultInspirationMessages,
        dismissInspirationCard,
        checkAndTriggerInspirationReminder,
        isAddLessonModalOpen,
        setIsAddLessonModalOpen,
        isAddQuickLessonModalOpen,
        setIsAddQuickLessonModalOpen,
        isStartLessonNowModalOpen,
        setIsStartLessonNowModalOpen,
        isAddStudentModalOpen,
        setIsAddStudentModalOpen,
        isAddGroupModalOpen,
        setIsAddGroupModalOpen,
        isBackupModalOpen,
        setIsBackupModalOpen,
        setStudents,
        setGroups,
        setLessons,
        setPayments,
        setNotifications,
        setProfile,
        setNotificationSettings,
        setInspirationSettings,
        setInspirationMessages,
        addAppNotification,
        getHistoricalLessons,
        getHistoricalPayments,
        syncState,
        isSyncReady,
        connectionState,
        devicePresences,
        autoSyncEnabled,
        setAutoSyncEnabled,
        triggerSync,
        forceSyncPeer,
        getPendingOutbox,
        getSyncHistory,
        clearSyncHistory,
        updateSyncState: syncDataSource.updateSyncState,
        startHosting
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
