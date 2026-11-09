# Task List — Glück IndexedDB Queue Removal Integrity & CI Repair

- [x] **1. IndexedDB Queue Removal Integrity (`src/services/storageService.ts`)**
  - [x] Updated `storage.removeItem()` to propagate errors from `localforage` / IndexedDB instead of swallowing them.
  - [x] Updated `delete memoryStore[key]` in `removeItem()` to run only after durable removal succeeds.
  - [x] Removed inner swallow `try...catch` in `storage.verifyDurableRemoved()`, ensuring any IndexedDB read error during removal verification returns `false`.
  - [x] Confirmed queue removal persistence failures in `saveDurablePendingRemoteQueue` return `false` and restore the original item in `drain()`.
  - [x] Verified idempotency of retrying applied but unremoved snapshots without data duplication.

- [x] **2. Android GitHub Actions CI Fix (`.github/workflows/build-apk.yml`)**
  - [x] Removed deprecated `android-actions/setup-android@v3` (which crashed on `sdkmanager "tools"`).
  - [x] Configured native runner SDK paths (`$ANDROID_SDK_ROOT`, `$ANDROID_HOME`, `cmdline-tools/latest/bin`).
  - [x] Installed and verified `platforms;android-36` and `build-tools;36.0.0`.
  - [x] Verified `compileSdkVersion = 36` in `android/variables.gradle` and `android/app/build.gradle`.

- [x] **3. Automated Test Scenarios (`src/tests/cloudSyncReliability.test.ts`)**
  - [x] `RA-23` (Unit Test): IndexedDB remove failure during queue clearing preserves payload, returns false, and retry is idempotent without duplicating lessons, payments, or finance transactions.
  - [x] `RA-24` (Unit Test): IndexedDB read failure during removal verification returns false, preserves queue, and retry is idempotent without data duplication.
  - [x] Total **80/80** Cloud Sync & Concurrency tests passed.

- [x] **4. Compilation, Linting & Build Verification**
  - [x] `compile_applet`: Clean build.
  - [x] `lint_applet` (`tsc --noEmit`): 0 errors.
  - [x] `npm run build`: Production web build succeeded.
  - [x] `npx cap sync android`: Succeeded in 0.23s.
