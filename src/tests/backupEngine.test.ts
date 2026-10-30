import assert from 'node:assert/strict';
import {
  validateAndSanitizeBackupPayload,
  calculateBackupStats,
  encryptBackupData,
  decryptBackupData,
  hasBackupSection,
  applyPartialBackupSections,
  ALL_BACKUP_CATEGORIES,
} from '../utils/backupEngine';
import { shouldRetainLessonInActiveWindow } from '../utils/lessonUtils';
import { isDateMatchingGroupRecurrence } from '../utils/scheduleUtils';
import { findAuthenticatedPeer } from '../services/sync/protocolNegotiator';

export async function runBackupEngineTests(): Promise<{ passed: boolean; log: string[] }> {
  const log: string[] = [];

  // 1. Reject invalid non-object or future major version payloads
  const invalidNull = validateAndSanitizeBackupPayload(null);
  assert.equal(invalidNull.isValid, false);

  const unsupportedVer = validateAndSanitizeBackupPayload({ version: '3.0.0', data: {} });
  assert.equal(unsupportedVer.isValid, false);
  log.push('[PASS] validateAndSanitizeBackupPayload rejects null and unsupported major versions');

  // 2. Reject non-array collection fields
  const malformedStudents = validateAndSanitizeBackupPayload({
    version: '2.0.0',
    data: { students: 'not-an-array' },
  });
  assert.equal(malformedStudents.isValid, false);
  log.push('[PASS] validateAndSanitizeBackupPayload rejects non-array collections');

  // 3. Sanitize valid payload, map legacy groupName to groupId, and clamp negative payment amounts
  const validRaw = {
    version: '2.0.0',
    data: {
      groups: [{ id: 'g1', name: 'German A1', pricePerSession: '150' }],
      students: [{ id: 's1', name: 'Omar', groupName: 'german a1' }],
      lessons: [{ id: 'l1', date: '2026-10-30', status: 'invalid_status', groupName: 'German A1', price: '150' }],
      payments: [{ id: 'p1', studentId: 's1', status: 'paid', amountDue: -100, amountPaid: '200' }],
      notifications: [],
    },
  };
  const sanitized = validateAndSanitizeBackupPayload(validRaw);
  assert.equal(sanitized.isValid, true);
  assert.equal(sanitized.data.groups[0].pricePerSession, 150);
  assert.equal(sanitized.data.students[0].groupId, 'g1');
  assert.equal(sanitized.data.lessons[0].groupId, 'g1');
  assert.equal(sanitized.data.lessons[0].status, 'scheduled');
  assert.equal(sanitized.data.payments[0].groupId, 'g1');
  assert.equal(sanitized.data.payments[0].amountDue, 0);
  assert.equal(sanitized.data.payments[0].amountPaid, 200);
  log.push('[PASS] validateAndSanitizeBackupPayload sanitizes numbers, statuses, and legacy group mappings');

  // 4. Encrypt & Decrypt roundtrip (AES-256-GCM via Web Crypto)
  const samplePayload = { students: [{ id: 's1', name: 'Test Student' }], count: 1 };
  const encrypted = await encryptBackupData(samplePayload, 'SecretPass123!');
  assert.notEqual(encrypted, JSON.stringify(samplePayload));
  const decrypted = await decryptBackupData(encrypted, 'SecretPass123!');
  assert.deepEqual(decrypted, samplePayload);
  log.push('[PASS] encryptBackupData and decryptBackupData AES-256-GCM roundtrip succeeds');

  // 5. calculateBackupStats computes counts and coverage percentage
  const stats = calculateBackupStats(
    ALL_BACKUP_CATEGORIES.map(c => c.id),
    {
      students: sanitized.data.students,
      groups: sanitized.data.groups,
      lessons: sanitized.data.lessons,
      payments: sanitized.data.payments,
      notifications: [],
      profile: { displayName: 'Herr Test', subject: 'German', phone: '' } as any,
    }
  );
  assert.equal(stats.isFull, true);
  assert.equal(stats.coveragePercentage, 100);
  assert.equal(stats.studentCount, 1);
  assert.equal(stats.groupCount, 1);
  assert.equal(stats.lessonCount, 1);
  assert.equal(stats.paymentCount, 1);
  log.push('[PASS] calculateBackupStats accurately computes record counts and full backup coverage');

  // 6. Fix #13: Partial backup (financial-only) does NOT wipe students, groups, or lessons
  const existingAppState = {
    students: [{ id: 'st_existing', name: 'Ali' }],
    groups: [{ id: 'grp_existing', name: 'B1 Group' }],
    lessons: [{ id: 'les_existing', date: '2026-10-10', status: 'scheduled' }],
    payments: [{ id: 'pay_old', amountPaid: 100 }],
    financeTransactions: [{ id: 'tx_old', amount: 50 }],
  };
  const partialFinancialBackup = {
    version: '2.0.0',
    categories: ['financial'],
    data: {
      payments: [{ id: 'pay_new', studentId: 'st_existing', status: 'paid', amountDue: 400, amountPaid: 400 }],
      financeTransactions: [{ id: 'tx_new', type: 'income', amount: 400, categoryId: 'c1', accountId: 'a1', date: '2026-10-30' }],
    },
  };
  const partialValidation = validateAndSanitizeBackupPayload(partialFinancialBackup);
  assert.equal(partialValidation.isValid, true);
  // Even though validateAndSanitizeBackupPayload returns [] for absent keys:
  assert.equal(Array.isArray(partialValidation.data.students), true);
  assert.equal(partialValidation.data.students.length, 0);
  // hasBackupSection accurately detects which keys were in the raw file:
  assert.equal(hasBackupSection(partialFinancialBackup, 'students'), false);
  assert.equal(hasBackupSection(partialFinancialBackup, 'groups'), false);
  assert.equal(hasBackupSection(partialFinancialBackup, 'lessons'), false);
  assert.equal(hasBackupSection(partialFinancialBackup, 'payments'), true);
  assert.equal(hasBackupSection(partialFinancialBackup, 'financeTransactions'), true);

  const restoredState = applyPartialBackupSections(
    existingAppState,
    partialFinancialBackup,
    partialValidation.data
  );
  assert.equal(restoredState.students.length, 1);
  assert.equal(restoredState.students[0].id, 'st_existing');
  assert.equal(restoredState.groups.length, 1);
  assert.equal(restoredState.groups[0].id, 'grp_existing');
  assert.equal(restoredState.lessons.length, 1);
  assert.equal(restoredState.lessons[0].id, 'les_existing');
  assert.equal(restoredState.payments.length, 1);
  assert.equal(restoredState.payments[0].id, 'pay_new');
  assert.equal(restoredState.financeTransactions.length, 1);
  assert.equal(restoredState.financeTransactions[0].id, 'tx_new');
  log.push('[PASS] Fix #13: Partial backup (financial-only) preserves existing students, groups, and lessons');

  // 7. Fix #23: Reject encryption without crypto.subtle, but decrypt legacy XOR backups with warning
  const origCryptoDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    let threwWithoutSubtle = false;
    try {
      await encryptBackupData({ test: 1 }, 'Pass123');
    } catch (err: any) {
      threwWithoutSubtle = err.message.includes('crypto.subtle');
    }
    assert.equal(threwWithoutSubtle, true);
  } finally {
    if (origCryptoDesc) {
      Object.defineProperty(globalThis, 'crypto', origCryptoDesc);
    }
  }
  // Construct a legacy XOR payload and verify decryptBackupData still decodes it
  const legacyJson = JSON.stringify({ legacy: true, count: 42 });
  const legacyPass = 'OldPass2026';
  const legacySalt = legacyPass + '_TA_SALT_2026';
  let xorRaw = '';
  for (let i = 0; i < legacyJson.length; i++) {
    xorRaw += String.fromCharCode(legacyJson.charCodeAt(i) ^ legacySalt.charCodeAt(i % legacySalt.length));
  }
  const legacyEncoded = 'XOR:' + btoa(encodeURIComponent(xorRaw));
  const decodedLegacy = await decryptBackupData(legacyEncoded, legacyPass);
  assert.deepEqual(decodedLegacy, { legacy: true, count: 42 });
  log.push('[PASS] Fix #23: Encryption rejects missing crypto.subtle while legacy XOR backups still decrypt');

  // 8. Fix #6: shouldRetainLessonInActiveWindow keeps completed unpaid lessons for paying students up to 365 days
  const cutoff60 = '2026-08-31';
  const cutoff365 = '2025-10-30';
  const mockGroups: any[] = [{ id: 'g_pay', name: 'Paid Group', monthlyPackagePrice: 800, sessionCount: 4 }];
  const mockStudents: any[] = [
    { id: 'st_paying', name: 'Paying Student', groupId: 'g_pay', paymentStatus: 'pending' },
    { id: 'st_exempt', name: 'Exempt Student', groupId: '', paymentStatus: 'exempted' },
    { id: 'st_free', name: 'Free Student', groupId: '', pricePerLesson: 0 },
  ];
  // Unpaid completed lesson 90 days ago for paying student -> KEEP
  assert.equal(
    shouldRetainLessonInActiveWindow(
      { id: 'l_unpaid_90d', groupId: 'g_pay', date: '2026-07-15', status: 'completed', paymentStatus: 'pending' } as any,
      cutoff60,
      cutoff365,
      mockStudents,
      mockGroups
    ),
    true
  );
  // Paid completed lesson 90 days ago -> DROP
  assert.equal(
    shouldRetainLessonInActiveWindow(
      { id: 'l_paid_90d', groupId: 'g_pay', date: '2026-07-15', status: 'completed', paymentStatus: 'paid' } as any,
      cutoff60,
      cutoff365,
      mockStudents,
      mockGroups
    ),
    false
  );
  // Exempted student completed lesson 90 days ago -> DROP
  assert.equal(
    shouldRetainLessonInActiveWindow(
      { id: 'l_exempt_90d', groupId: '', studentId: 'st_exempt', date: '2026-07-15', status: 'completed', paymentStatus: 'pending' } as any,
      cutoff60,
      cutoff365,
      mockStudents,
      mockGroups
    ),
    false
  );
  // Zero-fee student completed lesson 90 days ago -> DROP
  assert.equal(
    shouldRetainLessonInActiveWindow(
      { id: 'l_free_90d', groupId: '', studentId: 'st_free', date: '2026-07-15', status: 'completed', paymentStatus: 'pending' } as any,
      cutoff60,
      cutoff365,
      mockStudents,
      mockGroups
    ),
    false
  );
  // Unpaid completed lesson older than 365 days -> DROP
  assert.equal(
    shouldRetainLessonInActiveWindow(
      { id: 'l_unpaid_400d', groupId: 'g_pay', date: '2025-09-01', status: 'completed', paymentStatus: 'pending' } as any,
      cutoff60,
      cutoff365,
      mockStudents,
      mockGroups
    ),
    false
  );
  log.push('[PASS] Fix #6: shouldRetainLessonInActiveWindow keeps only unpaid completed lessons for paying students up to 365 days');

  // 9. Fix #7 & #16: Biweekly recurrence check & strict sync token authentication
  assert.equal(isDateMatchingGroupRecurrence('biweekly_a', '2026-01-05'), true);
  assert.equal(isDateMatchingGroupRecurrence('biweekly_a', '2026-01-12'), false);
  assert.equal(isDateMatchingGroupRecurrence('biweekly_b', '2026-01-12'), true);

  const peers: any[] = [{ deviceId: 'dev_1', deviceName: 'Phone', pairingToken: 'secret_tok_99' }];
  assert.equal(findAuthenticatedPeer(peers, 'secret_tok_99')?.deviceId, 'dev_1');
  assert.equal(findAuthenticatedPeer(peers, 'wrong_tok'), undefined);
  assert.equal(findAuthenticatedPeer(peers, ''), undefined);
  assert.equal(findAuthenticatedPeer(peers, undefined), undefined);
  log.push('[PASS] Fix #7 & #16: Biweekly recurrence filter and strict sync pairingToken authentication verified');

  return { passed: true, log };
}

runBackupEngineTests().then(result => {
  result.log.forEach(line => console.log(line));
});

