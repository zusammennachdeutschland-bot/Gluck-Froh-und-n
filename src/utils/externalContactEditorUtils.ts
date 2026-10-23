/**
 * External AI Contact Editor & Matching Utility for Glück
 * Implements local phone-number matching, parsing of JSON/CSV external AI responses,
 * prompt generation, return template generation, and rollback snapshots.
 */

import { normalizeEgyptianPhone, getPhoneMatchKey } from './contactsStandardizer';
import { RawDeviceContact } from '../services/contactsSyncService';

export interface ExternalContactRecord {
  contactId: string;
  originalName: string;
  phoneNumbers: string[];
  company: string;
  jobTitle: string;
  notes: string;
  proposedName: string;
  proposedCompany: string;
  proposedJobTitle: string;
  proposedNotes: string;
}

export interface MatchedExternalContactItem {
  id: string; // unique row id
  contactId: string;
  originalName: string;
  phoneNumbers: string[];
  currentCompany: string;
  currentJobTitle: string;
  currentNote: string;
  proposedName: string;
  proposedCompany: string;
  proposedJobTitle: string;
  proposedNotes: string;
  matchedDeviceContact?: RawDeviceContact;
  matchStatus: 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED' | 'CONFLICT' | 'INVALID';
  matchReason: string;
  // Field-level approvals
  acceptName: boolean;
  acceptCompany: boolean;
  acceptJobTitle: boolean;
  acceptNotes: boolean;
  isRecordSelected: boolean;
}

export interface ExternalEditorAuditResult {
  totalItems: number;
  matchedCount: number;
  ambiguousCount: number;
  unmatchedCount: number;
  conflictCount: number;
  invalidCount: number;
  items: MatchedExternalContactItem[];
}

export interface RollbackSnapshot {
  timestamp: number;
  previousContacts: Array<{
    id: string;
    displayName: string;
    company?: string;
    jobTitle?: string;
    note?: string;
  }>;
}

/**
 * Generates the complete prompt for the external AI assistant.
 */
export function generateExternalEditorPrompt(): string {
  return `You are an expert contact data assistant for the Glück Teacher app.
Your task is to standardize and clean up teacher-parent contacts according to strict formatting rules.

Naming Rules:
1. Student Name Format: Each student English name must be formatted as a clean two-part name (First Name + Second Name), e.g. "Ahmed Ibrahim's Mom - Klasse 4" or "Farida Osama's Mom - Klasse 2".
2. Sibling consolidation: "{Name1} & {Name2}'s Mom - Klasse {Class1} & {Class2}" (e.g. "Ahmed Ibrahim & Mariam Ibrahim's Mom - Klasse 2 & 4").
3. English possessive apostrophe: use 's for regular names, or ' for names ending in s, x, or z (e.g. "Lukas' Mom - Klasse 5").
4. Strictly use "Klasse", never "Grade".
5. Company: Use organization context such as "Al Alsun" or "Private".
6. Job Title: Use specific classification such as "Schule", "Klasse 4", or "Eltern".
7. Preserve all phone numbers exactly as provided. Do not invent or modify phone numbers.
8. Notes: Include rich session details (day, time, student notes) when available.

Return your response strictly as a JSON array matching the return template structure.`;
}

/**
 * Generates the JSON return template structure.
 */
export function generateReturnTemplateSample(): string {
  const sample = [
    {
      contactId: "contact_12345",
      originalName: "ماما أحمد",
      phoneNumbers: ["+201012345678"],
      company: "Private",
      jobTitle: "Eltern",
      notes: "Previous notes...",
      proposedName: "Ahmed Ibrahim's Mom - Klasse 4",
      proposedCompany: "Al Alsun",
      proposedJobTitle: "Klasse 4",
      proposedNotes: "Glück Teacher App:\nAhmed Ibrahim - Klasse 4\nأيام: السبت، الإثنين\nالساعة: 04:00 م\nالهاتف: +201012345678"
    }
  ];
  return JSON.stringify(sample, null, 2);
}

/**
 * Parses pasted raw text (JSON or CSV) into ExternalContactRecord items.
 */
export function parseExternalInput(rawText: string): ExternalContactRecord[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Try parsing as JSON first
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.map((item: any) => ({
        contactId: String(item.contactId || item.id || ''),
        originalName: String(item.originalName || item.currentName || item.name || ''),
        phoneNumbers: Array.isArray(item.phoneNumbers) 
          ? item.phoneNumbers.map(String) 
          : (item.phone ? [String(item.phone)] : []),
        company: String(item.company || item.currentCompany || ''),
        jobTitle: String(item.jobTitle || item.currentJobTitle || ''),
        notes: String(item.notes || item.currentNote || ''),
        proposedName: String(item.proposedName || item.newName || ''),
        proposedCompany: String(item.proposedCompany || item.company || ''),
        proposedJobTitle: String(item.proposedJobTitle || item.jobTitle || ''),
        proposedNotes: String(item.proposedNotes || item.note || '')
      })).filter(r => r.originalName || r.proposedName || r.phoneNumbers.length > 0);
    } catch (e) {
      console.warn('Failed to parse as JSON, attempting CSV parse:', e);
    }
  }

  // Fallback CSV parsing
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const header = lines[0].toLowerCase().split(',').map(h => h.replace(/["']/g, '').trim());
  const records: ExternalContactRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length === 0) continue;

    const getCol = (names: string[]) => {
      for (const n of names) {
        const idx = header.indexOf(n);
        if (idx >= 0 && cols[idx] !== undefined) return cols[idx];
      }
      return '';
    };

    const contactId = getCol(['contactid', 'id']);
    const originalName = getCol(['originalname', 'currentname', 'name']);
    const phoneStr = getCol(['phonenumbers', 'phone', 'tel']);
    const company = getCol(['company']);
    const jobTitle = getCol(['jobtitle', 'title']);
    const notes = getCol(['notes', 'note']);
    const proposedName = getCol(['proposedname', 'newname']);
    const proposedCompany = getCol(['proposedcompany']);
    const proposedJobTitle = getCol(['proposedjobtitle']);
    const proposedNotes = getCol(['proposednotes', 'newnote']);

    records.push({
      contactId,
      originalName,
      phoneNumbers: phoneStr ? phoneStr.split(';').map(p => p.trim()).filter(Boolean) : [],
      company,
      jobTitle,
      notes,
      proposedName: proposedName || originalName,
      proposedCompany: proposedCompany || company,
      proposedJobTitle: proposedJobTitle || jobTitle,
      proposedNotes: proposedNotes || notes
    });
  }

  return records;
}

/**
 * Matches external contact records against device/Glück contacts using stable ID and phone numbers.
 */
export function matchExternalRecords(
  externalRecords: ExternalContactRecord[],
  deviceContacts: RawDeviceContact[]
): ExternalEditorAuditResult {
  const deviceById = new Map<string, RawDeviceContact>();
  deviceContacts.forEach(c => {
    if (c.id) deviceById.set(c.id, c);
    if (c.rawContactId) deviceById.set(c.rawContactId, c);
  });

  const deviceByPhoneKey = new Map<string, RawDeviceContact[]>();
  deviceContacts.forEach(c => {
    (c.phoneNumbers || []).forEach(p => {
      const key = getPhoneMatchKey(p.number);
      if (!key) return;
      const list = deviceByPhoneKey.get(key) || [];
      if (!list.some(existing => existing.id === c.id)) {
        list.push(c);
      }
      deviceByPhoneKey.set(key, list);
    });
  });

  const items: MatchedExternalContactItem[] = [];
  let matchedCount = 0;
  let ambiguousCount = 0;
  let unmatchedCount = 0;
  let conflictCount = 0;
  let invalidCount = 0;

  externalRecords.forEach((rec, index) => {
    const rowId = `ext_row_${index}_${Date.now()}`;
    let matchedContact: RawDeviceContact | undefined = undefined;
    let matchStatus: MatchedExternalContactItem['matchStatus'] = 'UNMATCHED';
    let matchReason = '';

    if (rec.contactId && deviceById.has(rec.contactId)) {
      matchedContact = deviceById.get(rec.contactId);
      matchStatus = 'MATCHED';
      matchReason = 'تم المطابقة بواسطة معرف الاتصال الثابت (Contact ID).';
      matchedCount++;
    } else {
      const matchingDeviceContacts: RawDeviceContact[] = [];
      const checkedContactIds = new Set<string>();

      for (const phone of rec.phoneNumbers) {
        const key = getPhoneMatchKey(phone);
        if (!key) continue;
        const matches = deviceByPhoneKey.get(key) || [];
        matches.forEach(m => {
          if (!checkedContactIds.has(m.id)) {
            checkedContactIds.add(m.id);
            matchingDeviceContacts.push(m);
          }
        });
      }

      if (matchingDeviceContacts.length === 1) {
        matchedContact = matchingDeviceContacts[0];
        matchStatus = 'MATCHED';
        matchReason = 'تم المطابقة بنجاح عبر رقم الهاتف العياري.';
        matchedCount++;
      } else if (matchingDeviceContacts.length > 1) {
        matchStatus = 'AMBIGUOUS';
        matchReason = `رقم الهاتف مشترك بين ${matchingDeviceContacts.length} جهات اتصال مختلفة. يرجى التحديد اليدوي.`;
        ambiguousCount++;
      } else {
        matchStatus = 'UNMATCHED';
        matchReason = 'لا يوجد رقم هاتف مطابق في جهات الاتصال المسجلة بالهاتف.';
        unmatchedCount++;
      }
    }

    if (!rec.proposedName) {
      const wasMatched = matchStatus === 'MATCHED';
      matchStatus = 'INVALID';
      matchReason = 'البيانات المستلمة غير صالحة (الاسم المقترح مفقود).';
      invalidCount++;
      if (wasMatched) matchedCount--;
    }

    items.push({
      id: rowId,
      contactId: rec.contactId || matchedContact?.id || '',
      originalName: rec.originalName || matchedContact?.displayName || 'بدون اسم',
      phoneNumbers: rec.phoneNumbers.length > 0 ? rec.phoneNumbers : (matchedContact?.phoneNumbers?.map(p => p.number) || []),
      currentCompany: matchedContact?.accountType || rec.company || '',
      currentJobTitle: matchedContact?.accountName || rec.jobTitle || '',
      currentNote: matchedContact?.note || rec.notes || '',
      proposedName: rec.proposedName,
      proposedCompany: rec.proposedCompany,
      proposedJobTitle: rec.proposedJobTitle,
      proposedNotes: rec.proposedNotes,
      matchedDeviceContact: matchedContact,
      matchStatus,
      matchReason,
      acceptName: true,
      acceptCompany: true,
      acceptJobTitle: true,
      acceptNotes: true,
      isRecordSelected: matchStatus === 'MATCHED'
    });
  });

  return {
    totalItems: externalRecords.length,
    matchedCount,
    ambiguousCount,
    unmatchedCount,
    conflictCount,
    invalidCount,
    items
  };
}

/**
 * Saves rollback snapshot to localStorage.
 */
export function saveRollbackSnapshot(snapshot: RollbackSnapshot): void {
  try {
    const existingStr = localStorage.getItem('glueck_contacts_rollback_history');
    const history: RollbackSnapshot[] = existingStr ? JSON.parse(existingStr) : [];
    history.unshift(snapshot);
    if (history.length > 5) history.pop();
    localStorage.setItem('glueck_contacts_rollback_history', JSON.stringify(history));
  } catch (e) {
    console.warn('Failed to save rollback snapshot:', e);
  }
}

/**
 * Loads latest rollback snapshot.
 */
export function getLatestRollbackSnapshot(): RollbackSnapshot | null {
  try {
    const existingStr = localStorage.getItem('glueck_contacts_rollback_history');
    if (!existingStr) return null;
    const history: RollbackSnapshot[] = JSON.parse(existingStr);
    return history.length > 0 ? history[0] : null;
  } catch (e) {
    console.warn('Failed to load rollback snapshot:', e);
    return null;
  }
}
