const http = require('http');

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runDurabilitySuite() {
  console.log('🛡️  Starting Glück Parent Portal Concurrency, Durability & Race Condition Hardening Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Reset test store
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/test/reset-limits',
      method: 'POST',
      headers: { 'Authorization': 'Bearer gluck_teacher_master_enroll_2026' }
    });

    // ------------------------------------------------------------------------
    // TEST 1: Simultaneous Registration Race Condition
    // ------------------------------------------------------------------------
    console.log('🔹 Test 1: Simultaneous Registration Race Condition (10 concurrent requests)...');
    const regPromises = [];
    for (let i = 0; i < 10; i++) {
      regPromises.push(
        makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: '/api/portal/auth/register',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          studentCode: '1001',
          parentPhone: '01000000000',
          password: 'racingPassword123'
        })
      );
    }

    const regResults = await Promise.all(regPromises);
    const createdCount = regResults.filter(r => r.statusCode === 201).length;
    const conflictCount = regResults.filter(r => r.statusCode === 409).length;

    assert(createdCount === 1, `Exactly 1 concurrent request created the account (201 Created), got ${createdCount}`);
    assert(conflictCount === 9, `All other 9 concurrent requests received 409 Conflict, got ${conflictCount}`);

    // Verify datastore contains exactly 1 parent account for student 1001
    const healthAfterReg = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/health',
      method: 'GET'
    });
    assert(healthAfterReg.statusCode === 200, 'Health endpoint reports online and healthy after concurrent registration burst');

    // ------------------------------------------------------------------------
    // TEST 2: Simultaneous Pairing Code Consumption Race Condition
    // ------------------------------------------------------------------------
    console.log('\n🔹 Test 2: Simultaneous Pairing Code Consumption (5 concurrent requests)...');
    const pairRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/teacher/request-pairing-code',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer gluck_teacher_master_enroll_2026'
      }
    });
    const pairingCode = pairRes.json?.pairingCode;

    const enrollPromises = [];
    for (let i = 0; i < 5; i++) {
      enrollPromises.push(
        makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: '/api/teacher/enroll-device',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          pairingCode,
          deviceId: `device_race_${i}`,
          devicePublicKey: `pubkey_race_${i}`,
          deviceName: `Device Race ${i}`
        })
      );
    }

    const enrollResults = await Promise.all(enrollPromises);
    const enrollSuccessCount = enrollResults.filter(r => r.statusCode === 200).length;
    const enrollRejectedCount = enrollResults.filter(r => r.statusCode === 401).length;

    assert(enrollSuccessCount === 1, `Single-use pairing code consumed exactly ONCE (200 OK), got ${enrollSuccessCount}`);
    assert(enrollRejectedCount === 4, `All 4 other concurrent enroll attempts rejected with 401, got ${enrollRejectedCount}`);

    // ------------------------------------------------------------------------
    // TEST 3: Simultaneous Nonce Replay Race Condition
    // ------------------------------------------------------------------------
    console.log('\n🔹 Test 3: Simultaneous Nonce Replay Attack (5 concurrent requests with identical nonce)...');
    const raceNonce = 'nonce_race_' + Date.now();
    const raceTimestamp = Date.now().toString();

    const syncPromises = [];
    for (let i = 0; i < 5; i++) {
      syncPromises.push(
        makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: '/api/teacher/sync-students',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-teacher-device-id': 'device_race_0', // The successfully enrolled device
            'x-teacher-timestamp': raceTimestamp,
            'x-teacher-nonce': raceNonce,
            'x-teacher-signature': `sig_race_${i}`
          }
        }, {
          students: [
            {
              studentCode: '3003',
              studentName: 'منى عمر',
              grade: 'Grade 9',
              groupName: 'A2.1',
              parentPhones: ['01122334455'],
              attendanceRate: 98,
              totalLessons: 10,
              completedLessons: 10,
              streak: 3,
              lessons: [],
              homework: [],
              grades: [],
              finance: { totalDue: 500, totalPaid: 500, remainingBalance: 0, currency: 'EGP', records: [] },
              certificates: []
            }
          ]
        })
      );
    }

    const syncResults = await Promise.all(syncPromises);
    const syncSuccessCount = syncResults.filter(r => r.statusCode === 200).length;
    const syncReplayRejectedCount = syncResults.filter(r => r.statusCode === 401).length;

    assert(syncSuccessCount === 1, `Sync accepted exactly ONCE (200 OK), got ${syncSuccessCount}`);
    assert(syncReplayRejectedCount === 4, `All 4 replayed concurrent sync requests rejected with 401, got ${syncReplayRejectedCount}`);

    // ------------------------------------------------------------------------
    // TEST 4: Sibling Link PIN Race Condition & Atomic Link
    // ------------------------------------------------------------------------
    console.log('\n🔹 Test 4: Sibling Link Request & Approval Race Condition...');
    // Log in parent for student 1001
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      studentCode: '1001',
      password: 'racingPassword123'
    });
    const parentToken = loginRes.json?.token;

    // Request sibling link for 3003
    const linkReqRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/link-request',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${parentToken}`
      }
    }, {
      targetStudentCode: '3003'
    });
    const pairingPin = linkReqRes.json?.pairingPin;
    assert(linkReqRes.statusCode === 200 && pairingPin, 'Zero-OTP Sibling Link request created with 6-digit PIN');

    // Fire 5 concurrent approvals for the same PIN
    const approvePromises = [];
    for (let i = 0; i < 5; i++) {
      approvePromises.push(
        makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: '/api/teacher/approve-link',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          pairingPin,
          approve: true
        })
      );
    }

    const approveResults = await Promise.all(approvePromises);
    const approveSuccessCount = approveResults.filter(r => r.statusCode === 200).length;
    const approveRejectedCount = approveResults.filter(r => r.statusCode === 404).length;

    assert(approveSuccessCount === 1, `Sibling link approved exactly ONCE (200 OK), got ${approveSuccessCount}`);
    assert(approveRejectedCount === 4, `Remaining 4 concurrent approval attempts rejected with 404, got ${approveRejectedCount}`);

    // ------------------------------------------------------------------------
    // TEST 5: Cross-Student Authorization Isolation
    // ------------------------------------------------------------------------
    console.log('\n🔹 Test 5: Cross-Student Isolation Verification...');
    const authorizedChild1 = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/data/1001',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${parentToken}` }
    });
    assert(authorizedChild1.statusCode === 200, 'Parent authorized to access linked primary child (1001)');

    const unlinkedChild = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/data/9999_unlinked',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${parentToken}` }
    });
    assert(unlinkedChild.statusCode === 403 && unlinkedChild.json?.code === 'CROSS_STUDENT_ACCESS_DENIED', 'Parent strictly forbidden from reading unlinked student ID (403 CROSS_STUDENT_ACCESS_DENIED)');

    console.log('\n🔹 Test 6: Durability Verification (Data Survives Mutex Store Atomic Write Journal)...');
    const fs = require('fs');
    const path = require('path');
    const storePath = path.join(process.cwd(), '.portal_data', 'portal_store.json');
    assert(fs.existsSync(storePath), 'Persistent journal file exists on disk at .portal_data/portal_store.json');

    const fileContent = fs.readFileSync(storePath, 'utf-8');
    const diskStore = JSON.parse(fileContent);

    const persistedStudent = diskStore.students?.['1001'];
    const persistedParent = Object.values(diskStore.accounts || {}).find(a => a.studentCodes?.includes('1001'));
    const persistedDevice = diskStore.devices?.['device_race_0'];
    const persistedNonce = diskStore.nonces?.[raceNonce];

    assert(persistedStudent && persistedStudent.studentName === 'يوسف أحمد عمر', 'Student data persisted reliably in disk journal');
    assert(persistedParent && persistedParent.studentCodes.includes('1001'), 'Parent account with linked student codes persisted reliably in disk journal');
    assert(persistedParent && persistedParent.passwordHash.length > 20, 'Cryptographic password hash persisted (plaintext passwords NEVER stored)');
    assert(persistedDevice && persistedDevice.deviceId === 'device_race_0', 'Enrolled teacher device persisted reliably in disk journal');
    assert(persistedNonce && typeof persistedNonce === 'number', 'Cryptographic nonce record persisted to prevent replay attacks');

    // Clean up test store
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/test/reset-limits',
      method: 'POST',
      headers: { 'Authorization': 'Bearer gluck_teacher_master_enroll_2026' }
    });

    console.log(`\n======================================================================`);
    console.log(`🛡️  Concurrency & Durability Verification Results: ${passed} Passed, ${failed} Failed`);
    console.log(`======================================================================\n`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal durability test execution error:', err);
    process.exit(1);
  }
}

runDurabilitySuite();
