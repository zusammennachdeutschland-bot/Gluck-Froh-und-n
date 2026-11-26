import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getProjectedLessonsForRange } from '../utils/scheduleUtils';
import { generateTermVisitPlan } from '../services/termVisitPlannerService';
import { extractWeeksFromVisits } from '../utils/termVisitPrintUtils';
import {
  storage,
  recordStoragePersistenceFailure,
  getStoragePersistenceDiagnostics,
  __resetStoragePersistenceDiagnosticsForTesting,
  __setStorageFailureHookForTests
} from '../services/storageService';
import type { Group, SchoolSettings } from '../types';

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'grp_dst_test',
    name: 'DST Test Group',
    grade: 'Grade 10',
    type: 'online',
    status: 'active',
    paymentCycle: 'monthly',
    monthlyPackagePrice: 1200,
    sessionCount: 4,
    scheduleDays: ['Monday'],
    scheduleTime: '17:00',
    lessonDurationMinutes: 60,
    ...overrides
  } as Group;
}

function makeTermSchoolSettings(): SchoolSettings {
  return {
    hodName: 'Abdelrahman Ghareeb',
    schoolName: 'Alsun School',
    academicYear: '2026/2027',
    currentTerm: 'Term 1',
    teachers: [
      { id: 't_dst1', name: 'Teacher One', isActive: true, isHod: false },
      { id: 't_dst2', name: 'Teacher Two', isActive: true, isHod: false },
      { id: 't_dst3', name: 'Teacher Three', isActive: true, isHod: false },
      { id: 't_dst4', name: 'Teacher Four', isActive: true, isHod: false }
    ],
    teacherSchedules: {
      t_dst1: { '0': [{ periodNumber: 2, className: '10A' }] },
      t_dst2: { '0': [{ periodNumber: 2, className: '10B' }] },
      t_dst3: { '0': [{ periodNumber: 2, className: '10C' }] },
      t_dst4: { '0': [{ periodNumber: 2, className: '10D' }] }
    },
    schedule: {},
    periodSettings: {
      periodsCount: 7,
      periodDurationMinutes: 45,
      firstPeriodStartTime: '08:00',
      breakAfterPeriod: 3,
      breakDurationMinutes: 20
    },
    visitRecords: [],
    customTimedSessions: []
  } as unknown as SchoolSettings;
}

function runDateRangeDstAssertions(): void {
  // 1. April DST Start in Cairo: 2026-04-20 to 2026-05-18 (Cairo DST begins last Friday of April: 2026-04-24)
  const mondayGroup = makeGroup({ id: 'grp_apr_mon', scheduleDays: ['Monday'] });
  const aprMondays = getProjectedLessonsForRange('2026-04-20', '2026-05-18', [mondayGroup], [])
    .map((l) => l.date)
    .sort();
  assert.deepEqual(
    aprMondays,
    ['2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18'],
    'April DST range must include final day 2026-05-18'
  );

  // Daily range across April DST start (29 days inclusive: Apr 20 .. May 18)
  const dailyAprGroup = makeGroup({
    id: 'grp_apr_daily',
    scheduleDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  });
  const aprDaily = getProjectedLessonsForRange('2026-04-20', '2026-05-18', [dailyAprGroup], [])
    .map((l) => l.date)
    .sort();
  assert.equal(aprDaily.length, 29, 'Daily April DST range must cover all 29 days');
  assert.equal(aprDaily[aprDaily.length - 1], '2026-05-18');

  // 2. October DST End in Cairo: 2026-10-25 to 2026-11-15 (Cairo DST ends last Thursday/Friday of October: 2026-10-29/30)
  const thursdayGroup = makeGroup({ id: 'grp_oct_thu', scheduleDays: ['Thursday'] });
  const octThursdays = getProjectedLessonsForRange('2026-10-25', '2026-11-15', [thursdayGroup], [])
    .map((l) => l.date)
    .sort();
  assert.deepEqual(
    octThursdays,
    ['2026-10-29', '2026-11-05', '2026-11-12'],
    'October DST range must project all Thursdays cleanly'
  );

  const sundayGroup = makeGroup({ id: 'grp_oct_sun', scheduleDays: ['Sunday'] });
  const octSundays = getProjectedLessonsForRange('2026-10-25', '2026-11-15', [sundayGroup], [])
    .map((l) => l.date)
    .sort();
  assert.deepEqual(
    octSundays,
    ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15'],
    'October DST range must include final boundary date 2026-11-15'
  );

  const dailyOctGroup = makeGroup({
    id: 'grp_oct_daily',
    scheduleDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  });
  const octDaily = getProjectedLessonsForRange('2026-10-25', '2026-11-15', [dailyOctGroup], [])
    .map((l) => l.date)
    .sort();
  assert.equal(octDaily.length, 22, 'Daily October DST range must cover all 22 days');
  assert.equal(octDaily[octDaily.length - 1], '2026-11-15');

  // 3. Term Visit Planner across October DST end (4 Sunday slots needed: Oct 25, Nov 01, Nov 08, Nov 15)
  const plan = generateTermVisitPlan(makeTermSchoolSettings(), [], {
    term: 'Term 1',
    startDate: '2026-10-25',
    endDate: '2026-11-15',
    workingDays: ['0', '1', '2', '3', '4'],
    visitsPerTeacherPerClass: 1
  });
  const plannedDates = plan.plannedVisits.map((v) => v.date).sort();
  assert.deepEqual(
    plannedDates,
    ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15'],
    'Term visit planner must distribute visits onto final date 2026-11-15 across Cairo October DST transition'
  );

  // 4. Print week extractor across April and October DST boundaries
  const aprWeeks = extractWeeksFromVisits([], false, '2026-04-20', '2026-05-18');
  assert.ok(aprWeeks.some((w) => w.dateRangeStr.includes('2026-05-17') || w.dateRangeStr.includes('2026-05-18')));
  const octWeeks = extractWeeksFromVisits([], false, '2026-10-25', '2026-11-15');
  assert.ok(octWeeks.some((w) => w.dateRangeStr.includes('2026-11-15')));
}

function runSubprocessInTimezone(tz: string, rootDir: string): void {
  const tsxCli = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const script = `
    import assert from 'node:assert/strict';
    import { getProjectedLessonsForRange } from './src/utils/scheduleUtils';
    import { generateTermVisitPlan } from './src/services/termVisitPlannerService';
    import { extractWeeksFromVisits } from './src/utils/termVisitPrintUtils';

    const aprMondays = getProjectedLessonsForRange('2026-04-20', '2026-05-18', [{
      id: 'g1', name: 'G1', grade: 'Grade 10', type: 'online', status: 'active',
      paymentCycle: 'monthly', monthlyPackagePrice: 1200, sessionCount: 4,
      scheduleDays: ['Monday'], scheduleTime: '17:00', lessonDurationMinutes: 60
    }], []).map(l => l.date).sort();
    assert.deepEqual(aprMondays, ['2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18']);

    const octSundays = getProjectedLessonsForRange('2026-10-25', '2026-11-15', [{
      id: 'g2', name: 'G2', grade: 'Grade 10', type: 'online', status: 'active',
      paymentCycle: 'monthly', monthlyPackagePrice: 1200, sessionCount: 4,
      scheduleDays: ['Sunday'], scheduleTime: '17:00', lessonDurationMinutes: 60
    }], []).map(l => l.date).sort();
    assert.deepEqual(octSundays, ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15']);

    const plan = generateTermVisitPlan({
      hodName: 'HOD', schoolName: 'Alsun', academicYear: '2026/2027', currentTerm: 'Term 1',
      teachers: [
        { id: 't1', name: 'T1', isActive: true, isHod: false },
        { id: 't2', name: 'T2', isActive: true, isHod: false },
        { id: 't3', name: 'T3', isActive: true, isHod: false },
        { id: 't4', name: 'T4', isActive: true, isHod: false }
      ],
      teacherSchedules: {
        t1: { '0': [{ periodNumber: 1, className: '10A' }] },
        t2: { '0': [{ periodNumber: 1, className: '10B' }] },
        t3: { '0': [{ periodNumber: 1, className: '10C' }] },
        t4: { '0': [{ periodNumber: 1, className: '10D' }] }
      },
      schedule: {},
      periodSettings: { periodsCount: 7, periodDurationMinutes: 45, firstPeriodStartTime: '08:00', breakAfterPeriod: 3, breakDurationMinutes: 20 },
      visitRecords: [], customTimedSessions: []
    }, [], { term: 'Term 1', startDate: '2026-10-25', endDate: '2026-11-15', workingDays: ['0', '1', '2', '3', '4'], visitsPerTeacherPerClass: 1 });
    assert.deepEqual(plan.plannedVisits.map(v => v.date).sort(), ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15']);

    const weeks = extractWeeksFromVisits([], false, '2026-10-25', '2026-11-15');
    assert.ok(weeks.some(w => w.dateRangeStr.includes('2026-11-15')));
    console.log('TZ_SUBPROCESS_OK:' + process.env.TZ);
  `;

  const out = execFileSync(process.execPath, [tsxCli, '-e', script], {
    cwd: rootDir,
    env: { ...process.env, TZ: tz },
    encoding: 'utf8'
  });
  assert.ok(out.includes(`TZ_SUBPROCESS_OK:${tz}`), `Subprocess check failed for TZ=${tz}: ${out}`);
}

function runCiWorkflowAssertions(rootDir: string): void {
  const workflowSrc = fs.readFileSync(path.join(rootDir, '.github/workflows/build-apk.yml'), 'utf8');
  assert.match(workflowSrc, /unit-tests:[\s\S]*?TZ:\s*Africa\/Cairo/, 'B1: CI unit-tests must set TZ: Africa/Cairo');
  assert.match(workflowSrc, /needs:\s*\[verify-config,\s*lint-and-typecheck,\s*unit-tests,\s*build-apk\]/, 'D1: Stage-2 gate must remain intact');
  assert.match(workflowSrc, /tag_name:\s*apk-\$\{\{\s*github\.run_number\s*\}\}/, 'D1: Per-run apk-<run_number> tag must remain');
  assert.match(workflowSrc, /tag_name:\s*apk-latest/, 'D1: Stable apk-latest tag must be published');
  assert.match(workflowSrc, /make_latest:\s*true/, 'D1: apk-latest must be marked latest release');
  assert.match(workflowSrc, /grep -v '\^apk-latest\$'/, 'D1: Cleanup step must never delete apk-latest');

  const gradleSrc = fs.readFileSync(path.join(rootDir, 'android/app/build.gradle'), 'utf8');
  assert.ok(gradleSrc.includes('300 + System.getenv("GITHUB_RUN_NUMBER").toInteger()'), 'D1: versionCode = 300 + GITHUB_RUN_NUMBER must remain unchanged');
}

function runVercelVaultSubprocessAssertions(rootDir: string): void {
  const tsxCli = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const tmpMissing = fs.mkdtempSync(path.join(os.tmpdir(), 'glueck-vercel-missing-key-'));
  const tmpConfigured = fs.mkdtempSync(path.join(os.tmpdir(), 'glueck-vercel-valid-key-'));

  try {
    // 1. Missing env keys on Vercel must NOT create os.tmpdir key files and must return clear VAULT_KEY_NOT_CONFIGURED errors
    const missingKeyProbe = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import os from 'node:os';
      import path from 'node:path';
      import express from 'express';
      import { registerGrainServerRoutes } from './src/server/grainServerProxy.ts';
      import { registerZoomServerRoutes } from './src/server/zoomServerProxy.ts';

      (async () => {
        const app = express();
        app.use(express.json());
        const verifyOk = async () => ({ isValid: true, payload: { sub: 'teacher_vercel_1', email: 't@example.com' } });
        registerGrainServerRoutes(app, verifyOk);
        registerZoomServerRoutes(app, verifyOk);

        const server = app.listen(0);
        await new Promise((resolve) => server.once('listening', resolve));
        const { port } = server.address() as any;
        const base = 'http://127.0.0.1:' + port;
        const headers = { Authorization: 'Bearer mock_firebase_id_token', 'Content-Type': 'application/json' };
        const sampleGrainPat = 'grain_pat_SECRET_SAMPLE_DO_NOT_LEAK_9988';
        const sampleZoomSecret = 'ZoomClientSecretShouldNeverLeak98765';

        try {
          const gStatusRes = await fetch(base + '/api/grain/status', { headers });
          const gStatus = await gStatusRes.json();
          assert.equal(gStatusRes.status, 200);
          assert.equal(gStatus.supported, false);
          assert.equal(gStatus.secureStorageAvailable, false);
          assert.equal(gStatus.keyConfigured, false);
          assert.equal(gStatus.code, 'VAULT_KEY_NOT_CONFIGURED');
          assert.match(String(gStatus.error), /key not configured/i);

          const gConnRes = await fetch(base + '/api/grain/connect', {
            method: 'POST', headers, body: JSON.stringify({ token: sampleGrainPat })
          });
          const gConn = await gConnRes.json();
          assert.equal(gConnRes.status, 503);
          assert.equal(gConn.saved, false);
          assert.equal(gConn.code, 'VAULT_KEY_NOT_CONFIGURED');
          assert.match(String(gConn.error), /key not configured/i);
          assert.equal(JSON.stringify(gConn).includes(sampleGrainPat), false);

          const gExecRes = await fetch(base + '/api/grain/execute', {
            method: 'POST', headers, body: JSON.stringify({ operation: 'token_info' })
          });
          const gExec = await gExecRes.json();
          assert.equal(gExecRes.status, 503);
          assert.equal(gExec.code, 'VAULT_KEY_NOT_CONFIGURED');
          assert.match(String(gExec.error), /key not configured/i);

          const zStatusRes = await fetch(base + '/api/zoom/status', { headers });
          const zStatus = await zStatusRes.json();
          assert.equal(zStatusRes.status, 200);
          assert.equal(zStatus.secureStorageAvailable, false);
          assert.equal(zStatus.keyConfigured, false);
          assert.equal(zStatus.code, 'VAULT_KEY_NOT_CONFIGURED');
          assert.match(String(zStatus.error), /key not configured/i);

          const zConnRes = await fetch(base + '/api/zoom/connect', {
            method: 'POST', headers,
            body: JSON.stringify({ accountId: 'acc_test_123456', clientId: 'cid_test_123456', clientSecret: sampleZoomSecret })
          });
          const zConn = await zConnRes.json();
          assert.equal(zConnRes.status, 503);
          assert.equal(zConn.saved, false);
          assert.equal(zConn.code, 'VAULT_KEY_NOT_CONFIGURED');
          assert.match(String(zConn.error), /key not configured/i);
          assert.equal(JSON.stringify(zConn).includes(sampleZoomSecret), false);

          const zTestRes = await fetch(base + '/api/zoom/test-connection', { method: 'POST', headers });
          const zTest = await zTestRes.json();
          assert.equal(zTestRes.status, 503);
          assert.equal(zTest.code, 'VAULT_KEY_NOT_CONFIGURED');

          const zSetRes = await fetch(base + '/api/zoom/settings', {
            method: 'PATCH', headers, body: JSON.stringify({ defaultTimezone: 'Africa/Cairo' })
          });
          const zSet = await zSetRes.json();
          assert.equal(zSetRes.status, 503);
          assert.equal(zSet.code, 'VAULT_KEY_NOT_CONFIGURED');

          const zCreateRes = await fetch(base + '/api/zoom/meetings/create', {
            method: 'POST', headers, body: JSON.stringify({ topic: 'A1', startTime: '2026-05-01T17:00:00' })
          });
          const zCreate = await zCreateRes.json();
          assert.equal(zCreateRes.status, 503);
          assert.equal(zCreate.code, 'VAULT_KEY_NOT_CONFIGURED');

          const zListRes = await fetch(base + '/api/zoom/meetings', { headers });
          const zList = await zListRes.json();
          assert.equal(zListRes.status, 503);
          assert.equal(zList.code, 'VAULT_KEY_NOT_CONFIGURED');

          // Confirm zero temporary vault key files were created in TMPDIR
          const vaultSubdir = path.join(os.tmpdir(), 'glueck-aistudio');
          assert.equal(fs.existsSync(path.join(vaultSubdir, 'grain-vault-master.key')), false);
          assert.equal(fs.existsSync(path.join(vaultSubdir, 'zoom-vault-master.key')), false);
          console.log('VERCEL_MISSING_KEY_OK');
        } finally {
          server.close();
        }
      })().catch((err) => {
        console.error(err);
        process.exit(1);
      });
    `;

    const missingEnv: Record<string, string | undefined> = {
      ...process.env,
      VERCEL: '1',
      VERCEL_ENV: 'production',
      TMPDIR: tmpMissing
    };
    delete missingEnv.GRAIN_VAULT_MASTER_KEY;
    delete missingEnv.ZOOM_VAULT_MASTER_KEY;

    const outMissing = execFileSync(process.execPath, [tsxCli, '-e', missingKeyProbe], {
      cwd: rootDir,
      env: missingEnv,
      encoding: 'utf8'
    });
    assert.ok(outMissing.includes('VERCEL_MISSING_KEY_OK'), outMissing);

    // 2. Configured env keys on Vercel work normally without creating key files or leaking secrets
    const testGrainKeyHex = crypto.randomBytes(32).toString('hex');
    const testZoomKeyHex = crypto.randomBytes(32).toString('hex');
    const validKeyProbe = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import os from 'node:os';
      import path from 'node:path';
      import express from 'express';
      import { registerGrainServerRoutes } from './src/server/grainServerProxy.ts';
      import { registerZoomServerRoutes } from './src/server/zoomServerProxy.ts';

      (async () => {
        const app = express();
        app.use(express.json());
        const verifyOk = async () => ({ isValid: true, payload: { sub: 'teacher_vercel_2', email: 't2@example.com' } });
        registerGrainServerRoutes(app, verifyOk);
        registerZoomServerRoutes(app, verifyOk);

        const server = app.listen(0);
        await new Promise((resolve) => server.once('listening', resolve));
        const { port } = server.address() as any;
        const base = 'http://127.0.0.1:' + port;
        const headers = { Authorization: 'Bearer mock_firebase_id_token', 'Content-Type': 'application/json' };
        const pat = 'grain_pat_test_value_1234567890';

        try {
          const gStatusRes = await fetch(base + '/api/grain/status', { headers });
          const gStatus = await gStatusRes.json();
          assert.equal(gStatusRes.status, 200);
          assert.equal(gStatus.supported, true);
          assert.equal(gStatus.keyConfigured, true);

          const gConnRes = await fetch(base + '/api/grain/connect', {
            method: 'POST', headers, body: JSON.stringify({ token: pat })
          });
          const gConn = await gConnRes.json();
          assert.equal(gConnRes.status, 200);
          assert.equal(gConn.saved, true);
          assert.equal(gConn.hasToken, true);
          assert.equal(JSON.stringify(gConn).includes(pat), false);

          const zStatusRes = await fetch(base + '/api/zoom/status', { headers });
          const zStatus = await zStatusRes.json();
          assert.equal(zStatusRes.status, 200);
          assert.equal(zStatus.secureStorageAvailable, true);
          assert.equal(zStatus.keyConfigured, true);

          const vaultSubdir = path.join(os.tmpdir(), 'glueck-aistudio');
          assert.equal(fs.existsSync(path.join(vaultSubdir, 'grain-vault-master.key')), false);
          assert.equal(fs.existsSync(path.join(vaultSubdir, 'zoom-vault-master.key')), false);
          console.log('VERCEL_CONFIGURED_KEY_OK');
        } finally {
          server.close();
        }
      })().catch((err) => {
        console.error(err);
        process.exit(1);
      });
    `;

    const outValid = execFileSync(process.execPath, [tsxCli, '-e', validKeyProbe], {
      cwd: rootDir,
      env: {
        ...process.env,
        VERCEL: '1',
        VERCEL_ENV: 'production',
        TMPDIR: tmpConfigured,
        GRAIN_VAULT_MASTER_KEY: testGrainKeyHex,
        ZOOM_VAULT_MASTER_KEY: testZoomKeyHex
      },
      encoding: 'utf8'
    });
    assert.ok(outValid.includes('VERCEL_CONFIGURED_KEY_OK'), outValid);
  } finally {
    fs.rmSync(tmpMissing, { recursive: true, force: true });
    fs.rmSync(tmpConfigured, { recursive: true, force: true });
  }
}

async function runStoragePersistenceDiagnosticsAssertions(rootDir: string): Promise<void> {
  __resetStoragePersistenceDiagnosticsForTesting();

  const keys = [
    'glueck_group_weekly_sessions_v1',
    'glueck_zoom_meeting_records_v1',
    'glueck_zoom_meeting_history_v1',
    'glueck_grain_recording_matches_v1'
  ];

  // Confirm failing storage.setItem triggers non-blocking diagnostic recording without leaking tokens
  __setStorageFailureHookForTests((op, key) => {
    if (op === 'set') {
      throw new Error(`Simulated quota error for ${key} Bearer secret_abc grain_pat_xyz`);
    }
  });

  try {
    for (const key of keys) {
      await storage.setItem(key, [{ id: 'sample' }]).catch((err) => {
        recordStoragePersistenceFailure(key, err, 'AppContext:autoSave');
      });
    }
  } finally {
    __setStorageFailureHookForTests(null);
  }

  const entries = getStoragePersistenceDiagnostics();
  assert.equal(entries.length, 4, 'All 4 auto-save failures must be captured');
  assert.deepEqual(entries.map((e) => e.key).sort(), [...keys].sort());
  for (const e of entries) {
    assert.equal(e.message.includes('secret_abc'), false, 'Bearer secret must be redacted');
    assert.equal(e.message.includes('grain_pat_xyz'), false, 'Grain PAT must be redacted');
  }

  // Confirm AppContext.tsx and DiagnosticsCenter.tsx wiring has no silent .catch(() => {}) on the 4 keys
  const appCtxSrc = fs.readFileSync(path.join(rootDir, 'src/context/AppContext.tsx'), 'utf8');
  for (const key of keys) {
    assert.ok(
      appCtxSrc.includes(`recordStoragePersistenceFailure('${key}'`),
      `AppContext.tsx must record diagnostics on failure for ${key}`
    );
  }
  const diagSrc = fs.readFileSync(path.join(rootDir, 'src/components/sync/DiagnosticsCenter.tsx'), 'utf8');
  assert.ok(
    diagSrc.includes('storagePersistenceFailures: getStoragePersistenceDiagnostics()'),
    'DiagnosticsCenter.tsx must include storagePersistenceFailures in diagnostic JSON'
  );
}

async function main() {
  const rootDir = process.cwd();
  console.log(`Running auditFollowUpRegression tests (host TZ=${process.env.TZ || 'system'})...`);

  runDateRangeDstAssertions();
  console.log('✓ A1 in-process April & October DST date-range checks passed');

  runSubprocessInTimezone('Africa/Cairo', rootDir);
  console.log('✓ A1 TZ=Africa/Cairo subprocess checks passed');

  runSubprocessInTimezone('UTC', rootDir);
  console.log('✓ A1 TZ=UTC subprocess checks passed');

  runCiWorkflowAssertions(rootDir);
  console.log('✓ B1 & D1 workflow and release gating checks passed');

  runVercelVaultSubprocessAssertions(rootDir);
  console.log('✓ C1 Vercel vault explicit key-not-configured & secret-redaction checks passed');

  await runStoragePersistenceDiagnosticsAssertions(rootDir);
  console.log('✓ C2 non-blocking storage persistence diagnostics checks passed');

  console.log('✅ All Audit Follow-Up Regression Tests Passed!');
}

main().catch((err) => {
  console.error('Audit follow-up regression test failed:', err);
  process.exit(1);
});
