import assert from 'node:assert/strict';
import {
  parseManualHomeworkLinkInput,
  linkManualHomeworkUrl,
  markShortIdRevokedLocally,
  markAssignmentDeletedLocally,
  isShortIdRevokedLocally,
  isAssignmentDeletedLocally,
  getLocalAssignments,
  getLocalSubmissions,
  __setHomeworkSyncTransportForTests,
  __setHomeworkAuthUserForTests
} from '../shared/homeworkStorageSync';
import { DEFAULT_HOMEWORK_QUESTION_TYPES, type HomeworkAssignment, type HomeworkSubmission } from '../shared/homeworkTypes';

// Minimal localStorage + window shim for Node tsx execution
const memStorage = new Map<string, string>();
if (typeof (globalThis as any).window === 'undefined') {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  (globalThis as any).window = {
    location: { origin: 'https://glueck-teacher.vercel.app', pathname: '/', search: '', hash: '' },
    addEventListener: (ev: string, fn: (...args: any[]) => void) => {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev)!.add(fn);
    },
    removeEventListener: (ev: string, fn: (...args: any[]) => void) => {
      listeners.get(ev)?.delete(fn);
    },
    dispatchEvent: (event: any) => {
      const fns = listeners.get(event?.type);
      if (fns) fns.forEach((fn) => fn(event));
      return true;
    }
  };
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    get length() {
      return memStorage.size;
    },
    key: (idx: number) => Array.from(memStorage.keys())[idx] ?? null,
    getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
    setItem: (k: string, v: string) => {
      memStorage.set(k, String(v));
    },
    removeItem: (k: string) => {
      memStorage.delete(k);
    },
    clear: () => {
      memStorage.clear();
    }
  };
}

function makeAssignment(overrides: Partial<HomeworkAssignment>): HomeworkAssignment {
  return {
    id: 'hw_jungen_5c',
    ownerUid: 'teacher_uid_1',
    title: 'Jungen 5C — Berufe und ihre Arbeiten',
    groupId: 'grp_jungen_5c',
    groupName: 'Jungen 5C',
    audienceMode: 'group',
    assignedStudents: [{ id: 'stu_omar', name: 'Omar' }],
    shortId: 'Old7Xyz',
    originalShortId: 'Old7Xyz',
    isActive: true,
    status: 'active',
    allowedGameModes: [],
    questionTypes: [...DEFAULT_HOMEWORK_QUESTION_TYPES],
    questionCount: 5,
    maxAttempts: 3,
    allowReplay: true,
    createdAt: '2026-11-18T10:00:00.000Z',
    createdBy: 'teacher_uid_1',
    setSnapshot: {
      id: 'set_berufe',
      title: 'Berufe und ihre Arbeiten',
      items: [
        { id: 'w1', german: 'der Arzt', arabic: 'الطبيب' }
      ]
    } as any,
    ...overrides
  };
}

async function runTests() {
  console.log('Running Manual Homework Link & Sync Tests...');
  const ownerUid = 'teacher_uid_1';

  // 1. Parser tests
  {
    const p1 = parseManualHomeworkLinkInput('https://glueck-teacher.vercel.app/Herr-Abdul-rahman/Ab3Xy9Z');
    assert.equal(p1.kind, 'short');
    assert.equal(p1.shortId, 'Ab3Xy9Z');

    const p2 = parseManualHomeworkLinkInput('🔗 رابط الواجب: https://glueck-teacher.vercel.app/Herr-Abdul-rahman/New7Abc.');
    assert.equal(p2.kind, 'short');
    assert.equal(p2.shortId, 'New7Abc');

    const p3 = parseManualHomeworkLinkInput('https://glueck-teacher.vercel.app/?shortId=Qry99Az');
    assert.equal(p3.kind, 'short');
    assert.equal(p3.shortId, 'Qry99Az');

    const p4 = parseManualHomeworkLinkInput('Raw77Xy');
    assert.equal(p4.kind, 'short');
    assert.equal(p4.shortId, 'Raw77Xy');

    const p5 = parseManualHomeworkLinkInput('https://glueck-teacher.vercel.app/homework/hw_legacy_99?am=group&gid=grp_1');
    assert.equal(p5.kind, 'legacy');
    assert.equal(p5.assignmentId, 'hw_legacy_99');

    const p6 = parseManualHomeworkLinkInput('not a valid link');
    assert.equal(p6.kind, 'invalid');
    console.log('✓ Test 1: Manual link parser handles short URLs, WhatsApp lines, raw codes & legacy URLs');
  }

  // Cloud fake store
  const cloudAssignments = new Map<string, HomeworkAssignment>();
  const cloudShortLinks = new Map<string, { shortId: string; assignmentId: string; ownerUid: string; isActive: boolean; assignment?: HomeworkAssignment }>();
  const cloudSubmissions = new Map<string, HomeworkSubmission[]>();

  __setHomeworkAuthUserForTests({ uid: ownerUid, email: 'teacher@glueck.test' } as any);
  __setHomeworkSyncTransportForTests({
    fetchAssignment: async (id) => cloudAssignments.get(id) || null,
    fetchAllAssignments: async (uid) =>
      Array.from(cloudAssignments.values()).filter((a) => !uid || a.ownerUid === uid),
    saveAssignment: async (hw) => {
      cloudAssignments.set(hw.id, hw);
      return true;
    },
    saveShortLink: async (hw, uid) => {
      const sid = (hw.shortId || '').trim();
      const existing = cloudShortLinks.get(sid);
      if (existing && (existing.assignmentId !== hw.id || existing.ownerUid !== (uid || hw.ownerUid))) {
        return { saved: false, collision: true };
      }
      cloudShortLinks.set(sid, {
        shortId: sid,
        assignmentId: hw.id,
        ownerUid: uid || hw.ownerUid || ownerUid,
        isActive: hw.isActive !== false,
        assignment: hw
      });
      return { saved: true };
    },
    fetchShortLink: async (shortId) => {
      const rec = cloudShortLinks.get(shortId);
      if (!rec) return { status: 'not_found', shortId };
      if (!rec.isActive) {
        return { status: 'revoked', shortId, assignmentId: rec.assignmentId };
      }
      return {
        status: 'resolved',
        shortId,
        assignmentId: rec.assignmentId,
        assignment: rec.assignment
      };
    },
    fetchSubmissionsForAssignment: async (id) => cloudSubmissions.get(id) || []
  });

  try {
    // 2. Relink broken/revoked lesson to a working short link in cloud & pull its submissions
    {
      memStorage.clear();
      const workingHw = makeAssignment({
        id: 'hw_jungen_5c_v2',
        shortId: 'New7Abc',
        originalShortId: 'New7Abc',
        isActive: true
      });
      cloudAssignments.set(workingHw.id, workingHw);
      cloudShortLinks.set('New7Abc', {
        shortId: 'New7Abc',
        assignmentId: workingHw.id,
        ownerUid,
        isActive: true,
        assignment: workingHw
      });
      cloudSubmissions.set(workingHw.id, [
        {
          id: 'sub_1',
          assignmentId: workingHw.id,
          ownerUid,
          groupId: 'grp_jungen_5c',
          studentId: 'stu_omar',
          studentName: 'Omar',
          score: 5,
          totalQuestions: 5,
          scorePercentage: 100,
          accuracyPercent: 100,
          status: 'completed',
          completedAt: '2026-11-19T08:30:00.000Z',
          responses: []
        } as any
      ]);

      const res = await linkManualHomeworkUrl({
        rawInput: 'https://glueck-teacher.vercel.app/Herr-Abdul-rahman/New7Abc',
        currentAssignmentId: 'hw_deleted_old_id',
        expectedGroupId: 'grp_jungen_5c',
        explicitOwnerUid: ownerUid
      });

      assert.equal(res.success, true);
      assert.equal(res.status, 'linked_manually');
      assert.equal(res.assignment?.id, 'hw_jungen_5c_v2');
      assert.equal(res.shortId, 'New7Abc');
      assert.equal(res.relinkedToDifferentAssignment, true);
      assert.equal(res.submissionsSyncedCount, 1);
      assert.ok(res.shareUrl?.endsWith('/Herr-Abdul-rahman/New7Abc'));
      assert.equal(getLocalAssignments(ownerUid).some((a) => a.id === 'hw_jungen_5c_v2' && a.shortId === 'New7Abc'), true);
      assert.equal(getLocalSubmissions(ownerUid).some((s) => s.id === 'sub_1'), true);
      console.log('✓ Test 2: Manual short link relinks broken lesson, publishes active link & syncs submissions');
    }

    // 3. Reactivate a revoked short link under the EXACT same link
    {
      memStorage.clear();
      const revokedHw = makeAssignment({
        id: 'hw_revoked_1',
        shortId: 'Rev7Klm',
        originalShortId: 'Rev7Klm',
        isActive: false,
        status: 'closed'
      });
      cloudAssignments.set(revokedHw.id, revokedHw);
      cloudShortLinks.set('Rev7Klm', {
        shortId: 'Rev7Klm',
        assignmentId: revokedHw.id,
        ownerUid,
        isActive: false
      });
      markShortIdRevokedLocally('Rev7Klm');
      markAssignmentDeletedLocally(revokedHw.id, ownerUid);
      assert.equal(isShortIdRevokedLocally('Rev7Klm'), true);
      assert.equal(isAssignmentDeletedLocally(revokedHw.id, ownerUid), true);

      const res = await linkManualHomeworkUrl({
        rawInput: 'https://glueck-teacher.vercel.app/Herr-Abdul-rahman/Rev7Klm',
        currentAssignmentId: revokedHw.id,
        expectedGroupId: 'grp_jungen_5c',
        explicitOwnerUid: ownerUid
      });

      assert.equal(res.success, true);
      assert.equal(res.shortId, 'Rev7Klm');
      assert.equal(cloudShortLinks.get('Rev7Klm')?.isActive, true);
      assert.equal(cloudAssignments.get(revokedHw.id)?.isActive, true);
      assert.equal(isShortIdRevokedLocally('Rev7Klm'), false);
      assert.equal(isAssignmentDeletedLocally(revokedHw.id, ownerUid), false);
      console.log('✓ Test 3: Revoked short link reactivated with exact link & local tombstones cleared');
    }

    // 4. Bind a pasted short link onto existing lesson assignment when short link doc doesn't exist yet
    {
      memStorage.clear();
      const existingHw = makeAssignment({
        id: 'hw_bind_custom',
        shortId: 'OldBind1',
        originalShortId: 'OldBind1',
        isActive: true
      });
      cloudAssignments.set(existingHw.id, existingHw);

      const res = await linkManualHomeworkUrl({
        rawInput: 'https://glueck-teacher.vercel.app/Herr-Abdul-rahman/Sent99A',
        currentAssignmentId: existingHw.id,
        expectedGroupId: 'grp_jungen_5c',
        explicitOwnerUid: ownerUid
      });

      assert.equal(res.success, true);
      assert.equal(res.shortId, 'Sent99A');
      assert.equal(cloudShortLinks.get('Sent99A')?.assignmentId, existingHw.id);
      assert.equal(cloudShortLinks.get('Sent99A')?.isActive, true);
      console.log('✓ Test 4: Pasted short link bound to current lesson assignment & published to cloud');
    }

    // 5. Security: reject other teacher's link & other group's link & collision
    {
      const foreignHw = makeAssignment({
        id: 'hw_other_teacher',
        ownerUid: 'other_teacher_999',
        shortId: 'For888A'
      });
      cloudAssignments.set(foreignHw.id, foreignHw);
      cloudShortLinks.set('For888A', {
        shortId: 'For888A',
        assignmentId: foreignHw.id,
        ownerUid: 'other_teacher_999',
        isActive: true,
        assignment: foreignHw
      });

      const resForeign = await linkManualHomeworkUrl({
        rawInput: 'https://glueck-teacher.vercel.app/Herr-Abdul-rahman/For888A',
        expectedGroupId: 'grp_jungen_5c',
        explicitOwnerUid: ownerUid
      });
      assert.equal(resForeign.success, false);
      assert.equal(resForeign.status, 'unauthorized');

      const otherGroupHw = makeAssignment({
        id: 'hw_other_group',
        ownerUid,
        groupId: 'grp_other_99',
        groupName: 'Other Group 99',
        shortId: 'Grp999Z'
      });
      cloudAssignments.set(otherGroupHw.id, otherGroupHw);
      cloudShortLinks.set('Grp999Z', {
        shortId: 'Grp999Z',
        assignmentId: otherGroupHw.id,
        ownerUid,
        isActive: true,
        assignment: otherGroupHw
      });

      const resOtherGroup = await linkManualHomeworkUrl({
        rawInput: 'https://glueck-teacher.vercel.app/Herr-Abdul-rahman/Grp999Z',
        expectedGroupId: 'grp_jungen_5c',
        explicitOwnerUid: ownerUid
      });
      assert.equal(resOtherGroup.success, false);
      assert.equal(resOtherGroup.status, 'unauthorized');
      console.log('✓ Test 5: Cross-teacher and cross-group link isolation strictly enforced');
    }

    console.log('ALL 5/5 MANUAL HOMEWORK LINK & SYNC TESTS PASSED!');
  } finally {
    __setHomeworkSyncTransportForTests(null);
    __setHomeworkAuthUserForTests(undefined);
  }
}

runTests().catch((err) => {
  console.error('❌ Manual Homework Link & Sync Tests Failed:', err);
  process.exit(1);
});
