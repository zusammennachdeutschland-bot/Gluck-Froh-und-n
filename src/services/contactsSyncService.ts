/**
 * Smart Contacts Synchronization & Audit Service for Glück
 * Bridges between Native Android ContactsManagerPlugin and the UI.
 * Provides full support for native Android and an interactive web simulator for browser preview.
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import { Student } from '../types';
import {
  normalizeEgyptianPhone,
  getPhoneMatchKey,
  buildStandardizedContactProposal,
  isContactAlreadyStandardized,
  ContactAuditItem
} from '../utils/contactsStandardizer';

export interface RawDeviceContact {
  id: string;
  rawContactId?: string;
  displayName: string;
  phoneNumbers: Array<{ number: string; normalizedNumber?: string }>;
  accountType?: string;
  accountName?: string;
  isGoogleAccount?: boolean;
  isReadOnly?: boolean;
  note?: string;
}

export interface ContactsAuditResult {
  totalScanned: number;
  needsUpdateCount: number;
  alreadyStandardizedCount: number;
  duplicatesCount: number;
  missingInPhoneCount: number;
  ambiguousCount: number;
  googleAccountsCount: number;
  items: ContactAuditItem[];
  missingStudents: Array<{
    student: Student;
    proposedName: string;
    phone: string;
    reason: string;
  }>;
}

// Register Capacitor plugin
const ContactsManager = registerPlugin<any>('ContactsManager');

// In-memory web simulation storage to allow live updates during browser testing
let simulatedWebContacts: RawDeviceContact[] | null = null;

export const contactsSyncService = {
  /**
   * Returns whether the current environment is native Android.
   */
  isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  /**
   * Checks contacts read & write permissions.
   */
  async checkPermissions(): Promise<{ granted: boolean; read: boolean; write: boolean }> {
    if (!this.isNativeAndroid()) {
      return { granted: true, read: true, write: true };
    }
    try {
      const res = await ContactsManager.checkPermissions();
      return {
        granted: Boolean(res?.granted),
        read: Boolean(res?.read),
        write: Boolean(res?.write)
      };
    } catch (e) {
      console.warn('Error checking contacts permissions:', e);
      return { granted: false, read: false, write: false };
    }
  },

  /**
   * Requests runtime contacts permissions from the user.
   */
  async requestPermissions(): Promise<{ granted: boolean; read: boolean; write: boolean }> {
    if (!this.isNativeAndroid()) {
      return { granted: true, read: true, write: true };
    }
    try {
      const res = await ContactsManager.requestPermissions();
      return {
        granted: Boolean(res?.granted),
        read: Boolean(res?.read),
        write: Boolean(res?.write)
      };
    } catch (e) {
      console.warn('Error requesting contacts permissions:', e);
      return { granted: false, read: false, write: false };
    }
  },

  /**
   * Opens the Android system settings for this app so user can toggle contacts permissions.
   */
  async openSettings(): Promise<void> {
    if (this.isNativeAndroid()) {
      try {
        await ContactsManager.openSettings();
      } catch (e) {
        console.warn('Failed to open app settings:', e);
      }
    }
  },

  /**
   * Checks whether the current browser supports the Web Contact Picker API (Chrome for Android).
   */
  hasWebContactPicker(): boolean {
    return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
  },

  /**
   * Imports contacts using the Web Contact Picker API in Chrome on Android.
   */
  async pickWebContacts(): Promise<RawDeviceContact[]> {
    if (!this.hasWebContactPicker()) {
      throw new Error('Web Contact Picker API is not supported in this browser');
    }
    const props = ['name', 'tel'];
    const opts = { multiple: true };
    const picked = await (navigator as any).contacts.select(props, opts);
    if (!picked || !Array.isArray(picked)) return [];

    const imported: RawDeviceContact[] = picked.map((c: any, idx: number) => {
      const displayName = Array.isArray(c.name) ? c.name[0] : (c.name || 'بدون اسم');
      const tels = Array.isArray(c.tel) ? c.tel : (c.tel ? [c.tel] : []);
      return {
        id: `web_picked_${Date.now()}_${idx}`,
        displayName,
        phoneNumbers: tels.map((t: string) => ({
          number: t,
          normalizedNumber: normalizeEgyptianPhone(t)
        })),
        accountType: 'com.google',
        isGoogleAccount: true,
        isReadOnly: false
      };
    });

    simulatedWebContacts = imported;
    return imported;
  },

  /**
   * Reads all contacts from device or initialized web simulator.
   */
  async fetchRawContacts(studentsFallback: Student[]): Promise<RawDeviceContact[]> {
    if (this.isNativeAndroid()) {
      try {
        const res = await ContactsManager.getContacts();
        return (res?.contacts || []) as RawDeviceContact[];
      } catch (e) {
        console.error('Error fetching native contacts:', e);
        throw e;
      }
    }

    // Web simulation mode: generate realistic contacts based on students in Glück
    if (!simulatedWebContacts) {
      simulatedWebContacts = this.generateSimulatedContacts(studentsFallback);
    }
    return simulatedWebContacts;
  },

  /**
   * Generates realistic simulated contacts for web/desktop browser testing.
   */
  generateSimulatedContacts(students: Student[]): RawDeviceContact[] {
    const list: RawDeviceContact[] = [];
    const active = students.filter(s => !s.deleted && s.status !== 'archived');

    // Create realistic sample contacts
    active.forEach((s, idx) => {
      if (!s.parentPhone) return;
      const cleanPhone = s.parentPhone.trim();
      let displayName = `ماما ${s.name}`;

      // Mark some as already standardized for testing
      if (idx === 0 && s.certificateName) {
        displayName = `${s.certificateName}'s Mom - Klasse ${s.grade.replace(/Grade\s+/i, '')}`;
      } else if (idx === 1) {
        displayName = `أم ${s.name} درس ألماني`;
      } else if (idx === 2) {
        displayName = `${s.parentName || s.name} ولي أمر`;
      }

      list.push({
        id: `sim_contact_${s.id}_${idx}`,
        rawContactId: `raw_${idx}`,
        displayName,
        phoneNumbers: [{ number: cleanPhone, normalizedNumber: normalizeEgyptianPhone(cleanPhone) }],
        accountType: idx % 2 === 0 ? 'com.google' : 'vnd.sec.contact.phone',
        accountName: idx % 2 === 0 ? 'teacher.glueck@gmail.com' : 'Device Phone',
        isGoogleAccount: idx % 2 === 0,
        isReadOnly: false
      });
    });

    // Add a duplicate contact for the first phone number to test duplicate detection
    if (active.length > 0 && active[0].parentPhone) {
      list.push({
        id: 'sim_duplicate_1',
        rawContactId: 'raw_dup_1',
        displayName: `${active[0].name} (مكرر)`,
        phoneNumbers: [{ number: active[0].parentPhone, normalizedNumber: normalizeEgyptianPhone(active[0].parentPhone) }],
        accountType: 'com.google',
        accountName: 'teacher.glueck@gmail.com',
        isGoogleAccount: true,
        isReadOnly: false
      });
    }

    return list;
  },

  /**
   * Audits device contacts against all active students in Glück.
   * Categorizes into:
   * - NEEDS_UPDATE
   * - ALREADY_STANDARDIZED
   * - DUPLICATE_ON_PHONE
   * - AMBIGUOUS / MISSING_ENGLISH_NAME
   * - NOT_IN_CONTACTS
   */
  async runAudit(students: Student[]): Promise<ContactsAuditResult> {
    const activeStudents = students.filter(s => !s.deleted && s.status !== 'archived');
    const rawContacts = await this.fetchRawContacts(activeStudents);

    // 1. Group active students by parent phone match key
    const studentPhoneMap = new Map<string, Student[]>();
    activeStudents.forEach(s => {
      const phone = s.parentPhone?.trim();
      if (!phone) return;
      const key = getPhoneMatchKey(phone);
      if (!key) return;

      const arr = studentPhoneMap.get(key) || [];
      arr.push(s);
      studentPhoneMap.set(key, arr);
    });

    // 2. Count contact occurrences per phone key to detect phone-level duplicates
    const phoneContactCountMap = new Map<string, RawDeviceContact[]>();
    rawContacts.forEach(contact => {
      (contact.phoneNumbers || []).forEach(p => {
        const key = getPhoneMatchKey(p.number);
        if (!key) return;
        const list = phoneContactCountMap.get(key) || [];
        list.push(contact);
        phoneContactCountMap.set(key, list);
      });
    });

    // 3. Process matched contacts
    const auditItems: ContactAuditItem[] = [];
    const matchedPhoneKeys = new Set<string>();

    rawContacts.forEach(contact => {
      // Find matching students for this contact
      let matchedStudents: Student[] = [];
      let primaryPhone = '';
      let matchedKey = '';

      for (const p of contact.phoneNumbers || []) {
        const key = getPhoneMatchKey(p.number);
        if (key && studentPhoneMap.has(key)) {
          matchedStudents = studentPhoneMap.get(key)!;
          primaryPhone = p.number;
          matchedKey = key;
          matchedPhoneKeys.add(key);
          break;
        }
      }

      // If contact matches Glück students
      if (matchedStudents.length > 0 && primaryPhone) {
        const proposal = buildStandardizedContactProposal(matchedStudents, primaryPhone);
        const isDuplicate = (phoneContactCountMap.get(matchedKey) || []).length > 1;
        const isStandardized = isContactAlreadyStandardized(contact.displayName, proposal.standardizedName);
        const isReadOnly = Boolean(contact.isReadOnly);
        const isGoogle = Boolean(contact.isGoogleAccount);

        let status: ContactAuditItem['status'] = 'NEEDS_UPDATE';
        let statusLabelAr = 'يحتاج توحيد الاسم';
        let statusLabelDe = 'Namen vereinheitlichen';
        let statusDescriptionAr = 'الاسم الحالي غير مطابق للصيغة القياسية المعتمدة.';
        let selectedForUpdate = true;

        if (proposal.hasAmbiguity) {
          status = 'MISSING_ENGLISH_NAME';
          statusLabelAr = 'ينقصه الاسم الإنجليزي';
          statusLabelDe = 'Englischer Name fehlt';
          statusDescriptionAr = proposal.ambiguityReasons.join(' | ');
          selectedForUpdate = false;
        } else if (isDuplicate) {
          status = 'DUPLICATE_ON_PHONE';
          statusLabelAr = 'رقم مكرر بجهات الاتصال';
          statusLabelDe = 'Doppelter Kontakt';
          statusDescriptionAr = `يوجد ${phoneContactCountMap.get(matchedKey)!.length} جهات اتصال مسجلة لنفس الرقم. سيتم تطبيق الاسم الموحد.`;
          selectedForUpdate = true;
        } else if (isStandardized) {
          status = 'ALREADY_STANDARDIZED';
          statusLabelAr = 'موحد ومطابق';
          statusLabelDe = 'Bereits standardisiert';
          statusDescriptionAr = 'جهة الاتصال مطابقة تماماً للمعيار المطلوب.';
          selectedForUpdate = false;
        } else if (isReadOnly && !isGoogle) {
          status = 'NEEDS_UPDATE';
          statusLabelAr = 'حساب خارجي للقراءة فقط';
          statusLabelDe = 'Schreibgeschützt';
          statusDescriptionAr = 'جهة الاتصال تتبع تطبيقاً للقراءة فقط، يمكن محاولة التحديث أو التعديل يدوياً.';
          selectedForUpdate = true;
        }

        auditItems.push({
          id: contact.id,
          rawContactId: contact.rawContactId,
          currentName: contact.displayName || '(بدون اسم)',
          proposedName: proposal.standardizedName,
          suggestedNote: proposal.suggestedNote,
          phone: primaryPhone,
          normalizedPhone: normalizeEgyptianPhone(primaryPhone),
          accountType: contact.accountType,
          accountName: contact.accountName,
          isGoogleAccount: isGoogle,
          isReadOnly,
          status,
          statusLabelAr,
          statusLabelDe,
          statusDescriptionAr,
          students: matchedStudents,
          selectedForUpdate
        });
      }
    });

    // 4. Identify students in Glück with parent phone numbers who DO NOT exist in device contacts
    const missingStudents: ContactsAuditResult['missingStudents'] = [];
    studentPhoneMap.forEach((studentsWithPhone, key) => {
      if (!matchedPhoneKeys.has(key)) {
        const primaryPhone = studentsWithPhone[0].parentPhone;
        const proposal = buildStandardizedContactProposal(studentsWithPhone, primaryPhone);
        missingStudents.push({
          student: studentsWithPhone[0],
          proposedName: proposal.standardizedName || `Mom of ${studentsWithPhone[0].name}`,
          phone: primaryPhone,
          reason: 'الرقم مسجل للطالب في التطبيق ولكن لا يوجد له جهة اتصال محفوظة على الهاتف.'
        });
      }
    });

    // Calculate metrics
    const needsUpdateCount = auditItems.filter(i => i.status === 'NEEDS_UPDATE').length;
    const alreadyStandardizedCount = auditItems.filter(i => i.status === 'ALREADY_STANDARDIZED').length;
    const duplicatesCount = auditItems.filter(i => i.status === 'DUPLICATE_ON_PHONE').length;
    const ambiguousCount = auditItems.filter(i => i.status === 'AMBIGUOUS' || i.status === 'MISSING_ENGLISH_NAME').length;
    const googleAccountsCount = auditItems.filter(i => i.isGoogleAccount).length;

    return {
      totalScanned: rawContacts.length,
      needsUpdateCount,
      alreadyStandardizedCount,
      duplicatesCount,
      missingInPhoneCount: missingStudents.length,
      ambiguousCount,
      googleAccountsCount,
      items: auditItems,
      missingStudents
    };
  },

  /**
   * Executes name updates on selected contacts with progress callbacks.
   */
  async executeUpdates(
    itemsToUpdate: ContactAuditItem[],
    onProgress?: (current: number, total: number, contactName: string) => void
  ): Promise<{ updatedCount: number; failedCount: number; errors: string[] }> {
    const total = itemsToUpdate.length;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    if (this.isNativeAndroid()) {
      // Native Android update loop
      for (let i = 0; i < total; i++) {
        const item = itemsToUpdate[i];
        if (onProgress) {
          onProgress(i + 1, total, item.proposedName);
        }

        try {
          await ContactsManager.updateContactName({
            contactId: item.id,
            newDisplayName: item.proposedName,
            note: item.suggestedNote
          });
          updatedCount++;
        } catch (e: any) {
          failedCount++;
          errors.push(`خطأ في تعديل "${item.currentName}": ${e?.message || e}`);
        }
      }
    } else {
      // Web simulator update loop
      for (let i = 0; i < total; i++) {
        const item = itemsToUpdate[i];
        if (onProgress) {
          onProgress(i + 1, total, item.proposedName);
        }

        // Simulate tiny async step
        await new Promise(res => setTimeout(res, 80));

        // Update in simulated array
        if (simulatedWebContacts) {
          const match = simulatedWebContacts.find(c => c.id === item.id);
          if (match) {
            match.displayName = item.proposedName;
            if (item.suggestedNote) {
              match.note = item.suggestedNote;
            }
          }
        }
        updatedCount++;
      }
    }

    return { updatedCount, failedCount, errors };
  },

  /**
   * Resets the web simulation contacts cache.
   */
  resetWebSimulation(): void {
    simulatedWebContacts = null;
  }
};
