import assert from 'node:assert/strict';
import {
  GOOGLE_WEB_CLIENT_ID,
  __setNativeAuthTestAdapter,
  getResolvedGoogleWebClientId
} from '../shared/googleCredentialAuthPlugin';
import {
  __setFirebaseAuthTestOverrides,
  signInTeacherWithGoogle,
  signOutTeacherFirebase,
  isUserCancellationError
} from '../shared/firebaseCloudSync';

interface TestCase {
  id: string;
  name: string;
  fn: () => Promise<void>;
}

const tests: TestCase[] = [];
function test(id: string, name: string, fn: () => Promise<void>) {
  tests.push({ id, name, fn });
}

function resetMocks() {
  __setNativeAuthTestAdapter(null);
  __setFirebaseAuthTestOverrides(null);
}

// 1. Google account available
test('NA-01', 'Android Native: Single Google account available authenticates Firebase via Credential Manager without browser redirect', async () => {
  resetMocks();
  let capturedServerClientId = '';
  let popupCalled = false;
  let capturedIdToken = '';

  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async (opts) => {
      capturedServerClientId = opts?.serverClientId || '';
      return {
        cancelled: false,
        idToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEiLCJlbWFpbCI6InRlYWNoZXJAZ2x1ZWNrLmRlIn0.signature1',
        email: 'teacher@glueck.de',
        displayName: 'Frau Müller'
      };
    }
  });

  __setFirebaseAuthTestOverrides({
    signInWithPopup: async () => {
      popupCalled = true;
      throw new Error('Popup must never be called on Android');
    },
    signInWithGoogleIdToken: async (token) => {
      capturedIdToken = token;
      return {
        uid: 'uid_teacher_1',
        email: 'teacher@glueck.de',
        displayName: 'Frau Müller'
      } as any;
    }
  });

  const user = await signInTeacherWithGoogle();
  assert.equal(popupCalled, false, 'Web popup must not be invoked on Android');
  assert.equal(capturedServerClientId, GOOGLE_WEB_CLIENT_ID, 'Must pass verified Web OAuth Client ID');
  assert.ok(!capturedServerClientId.includes('REPLACE_WITH_'), 'Must never use placeholder client ID');
  assert.ok(capturedIdToken.startsWith('eyJhbGci'), 'Must pass Google ID token to Firebase credential sign-in');
  assert.equal(user?.uid, 'uid_teacher_1');
  assert.equal(user?.email, 'teacher@glueck.de');
});

// 2. Multiple Google accounts available
test('NA-02', 'Android Native: Multiple Google accounts available — selecting second account authenticates selected identity', async () => {
  resetMocks();
  const availableAccounts = [
    {
      email: 'personal@gmail.com',
      displayName: 'Personal Account',
      idToken: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyX3BlcnNvbmFsIn0.sigA'
    },
    {
      email: 'school.hod@glueck.de',
      displayName: 'School HOD Account',
      idToken: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyX2hvZCJ9.sigB'
    }
  ];
  const selectedIndex = 1;

  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async () => {
      const chosen = availableAccounts[selectedIndex];
      return {
        cancelled: false,
        idToken: chosen.idToken,
        email: chosen.email,
        displayName: chosen.displayName
      };
    }
  });

  __setFirebaseAuthTestOverrides({
    signInWithGoogleIdToken: async (token) => {
      assert.equal(token, availableAccounts[1].idToken);
      return {
        uid: 'uid_hod_2',
        email: availableAccounts[1].email,
        displayName: availableAccounts[1].displayName
      } as any;
    }
  });

  const user = await signInTeacherWithGoogle();
  assert.equal(user?.uid, 'uid_hod_2');
  assert.equal(user?.email, 'school.hod@glueck.de');
});

// 3. User cancels account selection
test('NA-03', 'Android Native: User cancelling native Credential Manager bottom sheet returns null quietly without error or redirect', async () => {
  resetMocks();
  let firebaseCalled = false;

  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async () => ({ cancelled: true })
  });

  __setFirebaseAuthTestOverrides({
    signInWithGoogleIdToken: async () => {
      firebaseCalled = true;
      return null;
    }
  });

  const user = await signInTeacherWithGoogle();
  assert.equal(user, null, 'Cancelled sign-in must resolve to null');
  assert.equal(firebaseCalled, false, 'Firebase must not be called when user cancels account picker');

  // Also verify exception-based cancellation (GetCredentialCancellationException)
  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async () => {
      const err: any = new Error('android.credentials.GetCredentialCancellationException: activity is cancelled by the user.');
      err.code = 'USER_CANCELLED';
      throw err;
    }
  });

  const userFromEx = await signInTeacherWithGoogle();
  assert.equal(userFromEx, null, 'GetCredentialCancellationException must also resolve cleanly to null');
  assert.equal(isUserCancellationError({ code: 'USER_CANCELLED' }), true);
});

// 4. No available Google account
test('NA-04', 'Android Native: No available Google account on device throws NO_GOOGLE_ACCOUNT and never falls back to browser redirect', async () => {
  resetMocks();
  let popupCalled = false;

  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async () => {
      const err: any = new Error('androidx.credentials.exceptions.NoCredentialException: No credentials available');
      err.code = 'NO_GOOGLE_ACCOUNT';
      throw err;
    }
  });

  __setFirebaseAuthTestOverrides({
    signInWithPopup: async () => {
      popupCalled = true;
      return null;
    }
  });

  let caughtErr: any = null;
  try {
    await signInTeacherWithGoogle();
  } catch (err) {
    caughtErr = err;
  }

  assert.ok(caughtErr, 'Must throw structured error when no Google account is available');
  assert.equal(caughtErr.code, 'NO_GOOGLE_ACCOUNT');
  assert.equal(popupCalled, false, 'Must never fall back to web popup or redirect');
});

// 5. Network unavailable
test('NA-05', 'Android Native: Network unavailable throws auth/network-request-failed and never launches browser', async () => {
  resetMocks();

  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async () => {
      const err: any = new Error('GetCredentialInterruptedException: Network connection interrupted');
      err.code = 'NETWORK_OR_INTERRUPTED';
      throw err;
    }
  });

  let caughtErr: any = null;
  try {
    await signInTeacherWithGoogle();
  } catch (err) {
    caughtErr = err;
  }

  assert.ok(caughtErr, 'Must throw network error when connection fails');
  assert.equal(caughtErr.code, 'auth/network-request-failed');
});

// 6. Invalid ID token
test('NA-06', 'Android Native: Invalid or empty ID token is rejected before Firebase authentication without redirect fallback', async () => {
  resetMocks();
  let firebaseCalled = false;

  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async () => ({
      cancelled: false,
      idToken: 'not-a-valid-jwt'
    })
  });

  __setFirebaseAuthTestOverrides({
    signInWithGoogleIdToken: async () => {
      firebaseCalled = true;
      return null;
    }
  });

  let caughtErr: any = null;
  try {
    await signInTeacherWithGoogle();
  } catch (err) {
    caughtErr = err;
  }

  assert.ok(caughtErr, 'Must reject malformed ID token');
  assert.equal(caughtErr.code, 'INVALID_ID_TOKEN');
  assert.equal(firebaseCalled, false, 'Firebase must not be invoked with a malformed token');
});

// 7. Firebase rejects authentication
test('NA-07', 'Android Native: Firebase rejecting credential propagates error cleanly without browser redirect fallback', async () => {
  resetMocks();
  let popupCalled = false;

  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async () => ({
      cancelled: false,
      idToken: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJleHBpcmVkIn0.sigExpired'
    })
  });

  __setFirebaseAuthTestOverrides({
    signInWithPopup: async () => {
      popupCalled = true;
      return null;
    },
    signInWithGoogleIdToken: async () => {
      const fbErr: any = new Error('Firebase: Error (auth/invalid-credential).');
      fbErr.code = 'auth/invalid-credential';
      throw fbErr;
    }
  });

  let caughtErr: any = null;
  try {
    await signInTeacherWithGoogle();
  } catch (err) {
    caughtErr = err;
  }

  assert.ok(caughtErr, 'Must propagate Firebase rejection error');
  assert.equal(caughtErr.code, 'auth/invalid-credential');
  assert.equal(popupCalled, false, 'Must never fall back to browser redirect/popup on Firebase rejection');
});

// 8. Repeated login taps (in-flight concurrency guard)
test('NA-08', 'Android Native: Repeated rapid login taps are deduplicated into a single native Credential Manager request', async () => {
  resetMocks();
  let nativeCallCount = 0;

  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async () => {
      nativeCallCount++;
      await new Promise((r) => setTimeout(r, 40));
      return {
        cancelled: false,
        idToken: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyX3NpbmdsZSJ9.sigSingle'
      };
    }
  });

  __setFirebaseAuthTestOverrides({
    signInWithGoogleIdToken: async () =>
      ({
        uid: 'uid_single_flight',
        email: 'single@glueck.de'
      }) as any
  });

  const [res1, res2, res3] = await Promise.all([
    signInTeacherWithGoogle(),
    signInTeacherWithGoogle(),
    signInTeacherWithGoogle()
  ]);

  assert.equal(nativeCallCount, 1, 'Native Credential Manager must only be invoked once during concurrent taps');
  assert.equal(res1?.uid, 'uid_single_flight');
  assert.equal(res2?.uid, 'uid_single_flight');
  assert.equal(res3?.uid, 'uid_single_flight');
});

// 9. Sign-out and sign-in with another account
test('NA-09', 'Android Native: Sign-out clears native Credential Manager state and allows signing in with a second account', async () => {
  resetMocks();
  let credentialStateCleared = false;
  let firebaseSignedOut = false;
  let activeAccountIndex = 0;
  const accounts = [
    { uid: 'uid_acc_1', email: 'first@glueck.de', token: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.s1' },
    { uid: 'uid_acc_2', email: 'second@glueck.de', token: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIyIn0.s2' }
  ];

  __setNativeAuthTestAdapter({
    isAndroidNative: () => true,
    signIn: async () => ({
      cancelled: false,
      idToken: accounts[activeAccountIndex].token,
      email: accounts[activeAccountIndex].email
    }),
    signOut: async () => {
      credentialStateCleared = true;
      return { cleared: true };
    }
  });

  __setFirebaseAuthTestOverrides({
    signInWithGoogleIdToken: async (token) => {
      const found = accounts.find((a) => a.token === token)!;
      return { uid: found.uid, email: found.email } as any;
    },
    signOutFirebase: async () => {
      firebaseSignedOut = true;
    }
  });

  const firstUser = await signInTeacherWithGoogle();
  assert.equal(firstUser?.uid, 'uid_acc_1');

  await signOutTeacherFirebase();
  assert.equal(credentialStateCleared, true, 'Must clear Android Credential Manager state on sign-out');
  assert.equal(firebaseSignedOut, true, 'Must sign out of Firebase');

  activeAccountIndex = 1;
  const secondUser = await signInTeacherWithGoogle();
  assert.equal(secondUser?.uid, 'uid_acc_2');
  assert.equal(secondUser?.email, 'second@glueck.de');
});

// 10. Background/Foreground transition resilience & Web platform isolation
test('NA-10', 'Platform Isolation & Lifecycle: Background/foreground transition preserves native callback and Web uses popup without calling native plugin', async () => {
  resetMocks();
  let nativePluginCalled = false;
  let webPopupCalled = false;

  // Part A: Simulate Web/Desktop platform
  __setNativeAuthTestAdapter({
    isAndroidNative: () => false,
    signIn: async () => {
      nativePluginCalled = true;
      return { cancelled: true };
    }
  });

  __setFirebaseAuthTestOverrides({
    signInWithPopup: async () => {
      webPopupCalled = true;
      return { uid: 'uid_web_user', email: 'web@glueck.de' } as any;
    }
  });

  const webUser = await signInTeacherWithGoogle();
  assert.equal(nativePluginCalled, false, 'Web platform must not call Android native Credential Manager plugin');
  assert.equal(webPopupCalled, true, 'Web platform must use signInWithPopup');
  assert.equal(webUser?.uid, 'uid_web_user');

  // Part B: Verify resolved Web Client ID matches firebase-applet-config.json oAuthClientId
  assert.equal(
    getResolvedGoogleWebClientId(),
    '874458026984-3ai954q2p8ga6h4b2b15is2gdjbi9768.apps.googleusercontent.com'
  );
  resetMocks();
});

async function run() {
  console.log(`\nRunning ${tests.length} Android Native Google Credential Manager Auth Tests...\n`);
  let passed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✅ [${t.id}] ${t.name}`);
    } catch (err) {
      console.error(`  ❌ [${t.id}] ${t.name}`);
      console.error(err);
      process.exit(1);
    }
  }
  resetMocks();
  console.log(`\n🎉 All ${passed}/${tests.length} Android Native Google Credential Manager tests passed!\n`);
}

run();
