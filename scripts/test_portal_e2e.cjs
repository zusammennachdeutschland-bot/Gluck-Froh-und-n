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

async function runTests() {
  console.log('🚀 Starting Glück Parent Portal Comprehensive Production Verification Suite...\n');

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
    // Reset rate limits for test suite
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/test/reset-limits',
      method: 'POST',
      headers: { 'Authorization': 'Bearer gluck_teacher_master_enroll_2026' }
    });

    // 1. Health check
    const health = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/health',
      method: 'GET'
    });
    assert(health.statusCode === 200 && health.json?.status === 'online', 'Health endpoint returns 200 online');

    // 2. Portal Route: /portal redirect
    const portalRedirect = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/portal',
      method: 'GET'
    });
    assert(portalRedirect.statusCode === 301, 'GET /portal returns 301 redirect');

    // 3. Portal Route: /portal/ entry point
    const portalIndex = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/portal/',
      method: 'GET'
    });
    assert(portalIndex.statusCode === 200 && portalIndex.data.includes('بوابة متابعة ولي الأمر'), 'GET /portal/ returns 200 with Arabic title');

    // 4. Registration: Invalid Phone
    const regBadPhone = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      studentCode: '1001',
      parentPhone: '01299999999', // Not matching 1001's phone
      password: 'parentPassword123'
    });
    assert(regBadPhone.statusCode === 400, 'Registration with non-matching phone returns 400 error');

    // 5. Registration: Valid Phone
    const regSuccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      studentCode: '1001',
      parentPhone: '01000000000',
      password: 'parentPassword123'
    });
    assert(regSuccess.statusCode === 201 || regSuccess.statusCode === 409, 'Registration with matching phone succeeds or indicates already registered');

    // 6. Login: Invalid Password
    const loginFail = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      studentCode: '1001',
      password: 'wrongPassword_test'
    });
    assert(loginFail.statusCode === 401, 'Login with wrong password returns 401 Unauthorized');

    // 7. Login: Valid Password
    const loginSuccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      studentCode: '1001',
      password: 'parentPassword123'
    });
    assert(loginSuccess.statusCode === 200 && loginSuccess.json?.token, 'Login with valid password returns 200 and session token');

    const token = loginSuccess.json?.token;

    // 8. Authorized Student Data Access
    const dataAccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/data/1001',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert(
      dataAccess.statusCode === 200 && dataAccess.json?.student?.studentName === 'يوسف أحمد عمر',
      'Authorized parent receives sanitized student record for student 1001'
    );

    // 9. Cross-Student Access Denial
    const crossAccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/data/9999',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert(crossAccess.statusCode === 403, 'Cross-student access attempt to unlinked student returns 403 Forbidden');

    // 10. Unauthorized Request without Bearer token
    const unauthAccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/data/1001',
      method: 'GET'
    });
    assert(unauthAccess.statusCode === 401, 'Data request without Bearer token returns 401 Unauthorized');

    // 11. Teacher Portal Status Endpoint
    const teacherStatus = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/teacher/portal-status',
      method: 'GET'
    });
    assert(teacherStatus.statusCode === 200 && Array.isArray(teacherStatus.json?.students), 'Teacher portal-status endpoint returns 200 with student list');

    // 12. Teacher Reset Parent Password (Instant Session Invalidation & Forced Password Change)
    const resetRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/teacher/reset-parent-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      studentCode: '1001'
    });
    assert(resetRes.statusCode === 200 && resetRes.json?.temporaryPassword, 'Teacher resets parent password and receives temporary password');

    const tempPassword = resetRes.json?.temporaryPassword;

    // 13. Instant Invalidation: Old Token is immediately blocked
    const oldTokenAccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/data/1001',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert(oldTokenAccess.statusCode === 401 && oldTokenAccess.json?.code === 'AUTH_VERSION_MISMATCH', 'Previously issued ID token immediately blocked after teacher password reset (authVersion mismatch)');

    // 14. Parent logs in with Temporary Password
    const tempLogin = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      studentCode: '1001',
      password: tempPassword
    });
    assert(tempLogin.statusCode === 200 && tempLogin.json?.mustChangePassword === true, 'Parent login with temporary password succeeds with mustChangePassword flag');

    const tempToken = tempLogin.json?.token;

    // 15. Direct Data Access Blocked while mustChangePassword is true
    const blockedAccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/data/1001',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tempToken}` }
    });
    assert(blockedAccess.statusCode === 403 && blockedAccess.json?.code === 'PASSWORD_CHANGE_REQUIRED', 'Direct data access blocked with 403 PASSWORD_CHANGE_REQUIRED while temporary password is active');

    // 16. Parent changes password to a new private password
    const changePass = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/change-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tempToken}`
      }
    }, {
      newPassword: 'newSecurePassword456'
    });
    assert(changePass.statusCode === 200 && changePass.json?.token, 'Forced password change succeeds and issues fresh session token');

    const freshToken = changePass.json?.token;

    // 17. Fresh Token successfully accesses student data
    const freshAccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/data/1001',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${freshToken}` }
    });
    assert(freshAccess.statusCode === 200 && freshAccess.json?.student?.studentCode === '1001', 'Fresh session token successfully retrieves student records');

    // 18. Teacher Device Enrollment: Pairing code lifecycle
    const pairingRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/teacher/request-pairing-code',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer gluck_teacher_master_enroll_2026'
      }
    });
    assert(pairingRes.statusCode === 200 && pairingRes.json?.pairingCode, 'Administrative pairing code successfully generated');

    const pairingCode = pairingRes.json?.pairingCode;

    // Enroll teacher device
    const enrollRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/teacher/enroll-device',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      pairingCode,
      deviceId: 'dev_test_audit_01',
      devicePublicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGLUCKTEST',
      deviceName: 'Teacher MacBook Pro'
    });
    assert(enrollRes.statusCode === 200, 'Teacher device successfully enrolled using single-use pairing code');

    // Reuse of pairing code must be rejected
    const reuseRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/teacher/enroll-device',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      pairingCode,
      deviceId: 'dev_test_audit_02',
      devicePublicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGLUCKTEST2'
    });
    assert(reuseRes.statusCode === 401, 'Re-using consumed pairing code rejected with 401');

    // 19. Teacher Sync: Sync new student record (2002 - سارة أحمد عمر)
    const syncTimestamp = Date.now().toString();
    const syncNonce = 'nonce_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    const syncRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/teacher/sync-students',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-teacher-device-id': 'dev_test_audit_01',
        'x-teacher-timestamp': syncTimestamp,
        'x-teacher-nonce': syncNonce,
        'x-teacher-signature': `sig_dev_test_audit_01_${syncTimestamp}`
      }
    }, {
      students: [
        {
          studentCode: '2002',
          studentName: 'سارة أحمد عمر (الأخت)',
          grade: 'Grade 7 (A1.1)',
          groupName: 'مجموعة المبتدئين A1',
          parentPhones: ['01000000000'],
          attendanceRate: 100,
          totalLessons: 8,
          completedLessons: 8,
          streak: 4,
          lessons: [],
          homework: [],
          grades: [],
          finance: { totalDue: 800, totalPaid: 800, remainingBalance: 0, currency: 'EGP', records: [] },
          certificates: []
        }
      ]
    });
    assert(syncRes.statusCode === 200 && syncRes.json?.syncedCount >= 1, 'Teacher device successfully synced new sibling student (2002)');

    // 20. Nonce Replay Protection: Replaying the same sync nonce must be rejected
    const replayRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/teacher/sync-students',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-teacher-device-id': 'dev_test_audit_01',
        'x-teacher-timestamp': syncTimestamp,
        'x-teacher-nonce': syncNonce,
        'x-teacher-signature': `sig_dev_test_audit_01_${syncTimestamp}`
      }
    }, {
      students: []
    });
    assert(replayRes.statusCode === 401, 'Cryptographic nonce replay attack detected and rejected with 401');

    // 21. Sibling Linking (Zero-OTP Workflow): Parent requests linking for 2002
    const linkReqRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/link-request',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freshToken}`
      }
    }, {
      targetStudentCode: '2002'
    });
    assert(linkReqRes.statusCode === 200 && linkReqRes.json?.pairingPin, 'Parent generates Zero-OTP sibling linking PIN for secondary student (2002)');

    const pairingPin = linkReqRes.json?.pairingPin;

    // Teacher approves sibling link via PIN
    const approveRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/teacher/approve-link',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      pairingPin,
      approve: true
    });
    assert(approveRes.statusCode === 200, 'Teacher successfully approves sibling link in teacher management console');

    // 22. Parent can now access both students
    const siblingAccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/data/2002',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${freshToken}` }
    });
    assert(siblingAccess.statusCode === 200 && siblingAccess.json?.student?.studentName.includes('سارة'), 'Parent now authorized to view linked sibling record (2002)');

    // 23. Rate Limiter Lockout Test: 5 consecutive invalid login attempts
    const dummyStudentCode = '9999_lockout_test';
    for (let i = 0; i < 5; i++) {
      await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/portal/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        studentCode: dummyStudentCode,
        password: 'wrongPasswordAttempt'
      });
    }
    const lockedRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      studentCode: dummyStudentCode,
      password: 'wrongPasswordAttempt'
    });
    assert(lockedRes.statusCode === 429, 'Rate limiter activates lockout: 6th attempt returns HTTP 429 Too Many Requests');

    // Clean up test lockout
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portal/test/reset-limits',
      method: 'POST',
      headers: { 'Authorization': 'Bearer gluck_teacher_master_enroll_2026' }
    });

    console.log(`\n======================================================`);
    console.log(`Comprehensive Verification Results: ${passed} Passed, ${failed} Failed`);
    console.log(`======================================================\n`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  }
}

runTests();
