# Glück — Final Sync Durability Audit & Android CI Fix Walkthrough

## Summary of Accomplished Repairs

### Part A: Android GitHub Actions CI Failure Repair (`.github/workflows/build-apk.yml`)
- **Root Cause:** The previous workflow step invoked `android-actions/setup-android@v3`, which internally called `sdkmanager "tools"`. The legacy `tools` package was deprecated and removed by Google, causing the setup action to crash on modern GitHub Actions `ubuntu-latest` runners.
- **Repair:**
  - Replaced `android-actions/setup-android@v3` with direct configuration of the runner's pre-installed Android SDK (`$ANDROID_SDK_ROOT` / `/usr/local/lib/android/sdk`).
  - Added `$ANDROID_SDK_ROOT/cmdline-tools/latest/bin` and `$ANDROID_SDK_ROOT/platform-tools` to the runner's `$GITHUB_PATH` and configured `$ANDROID_HOME`.
  - Installed and verified `platforms;android-36` and `build-tools;36.0.0` directly using the runner's modern command-line tools without referencing the obsolete `tools` package.
  - Verified `compileSdkVersion = 36` in `android/variables.gradle` and `android/app/build.gradle`.

---

### Part B: Actual Durable Queue Persistence & Read-Back Verification
- **Root Cause in `useGoogleCloudWorkspaceSync.ts`:**
  - `writeDurableString()` was previously catching `localStorage.setItem` errors and silently falling back to in-memory maps.
  - Complete workspace backup JSON payloads (up to 25MB) far exceeded the 5MB total `localStorage` quota, causing writes to silently fail.
  - On process restart, in-memory fallbacks were lost, dropping pending remote work.
  - `persistAppliedDocTokensMap()` was returning success in environments without durable storage, poisoning revision acknowledgement.
- **Repair Implemented:**
  1. **IndexedDB / `localforage` Storage:**
     - Registered `gluck_cloud_pending_remote_queue_v2_` keys in `storageService.ts` as heavy, localforage-only keys (`isHeavyStorageKey`).
     - Backed pending remote queue payloads with `storageService.ts` (`localforage` / IndexedDB), protecting `localStorage` from quota exhaustion while supporting up to 25MB payloads.
  2. **Read-Back Equality Verification:**
     - Added `storage.verifyDurableReadBackValue<T>(key, expectedValue)` to `storageService.ts`, which flushes pending writes and verifies exact value equality before reporting success.
     - Added `storage.verifyDurableRemoved(key)` to verify that removed queue items are genuinely expunged from the persistent store.
  3. **Durability Failure Handling & Zero-Loss Rollback:**
     - If durable queue persistence fails, `enqueueRemoteSnapshot()` rolls back the item from the queue and returns `false`. It never acknowledges the revision or claims the item is safely queued.
     - In `drain()`, queue removal is persisted and verified before moving to the next item; if removal persistence fails, the item is restored to the head of the queue.
  4. **Strict `persistAppliedDocTokensMap`:**
     - `persistAppliedDocTokensMap(uid, map)` now strictly returns `false` if durable persistence or read-back fails, and does not mutate the in-memory map on failure.
  5. **Restart & Reconnection Resilience:**
     - Added `loadDurablePendingRemoteQueueAsync(uid)` with backward-compatible migration from legacy `localStorage` keys into IndexedDB.
     - On app reopening, `resumePendingWork()` loads persisted pending payloads from IndexedDB and resumes draining without requiring a new Firestore event.

---

## Comprehensive Test Results

### 1. New Part 10 Reliability Scenarios (`RA-16` to `RA-22`)
- `[PASS]` **RA-16:** A pending backup larger than 5MB (5.2MB student payload) persists durably in IndexedDB without quota failure, bypasses `localStorage`, and drains cleanly.
- `[PASS]` **RA-17:** Simulated `localStorage` `QuotaExceededError` does not break durable queue persistence in IndexedDB.
- `[PASS]` **RA-18:** IndexedDB write failure aborts queue persistence, rolls back item, and prevents false acknowledgement.
- `[PASS]` **RA-19:** Process restart after a failed import restores queue from durable storage and resumes cleanly upon reopening.
- `[PASS]` **RA-20:** Queue read-back mismatch rejects persistence, rolls back item, and does not acknowledge revision.
- `[PASS]` **RA-21:** Acknowledgement storage failure prevents revision acknowledgement and retains payload in durable queue.
- `[PASS]` **RA-22:** Retry after restart without a new cloud snapshot drains queue and synchronizes local workspace.

### 2. Full Test Suite Execution (`npm test`)
All test suites passed with **100% success**:
- **78/78** Cloud Sync Reliability, Cryptographic Verification & Concurrency tests (`src/tests/cloudSyncReliability.test.ts`)
- **16/16** Unified Lesson Cycle Numbering tests (`src/tests/lessonCycleNumbering.test.ts`)
- **7/7** Core tasks 1–7 tests (`src/tests/tasks1to7.test.ts`)
- **34/34** Homework System Repair scenarios (`src/tests/homeworkSystemRepair.test.ts`)

### 3. Compilation, Linting & Android Sync
- `compile_applet`: **Build succeeded** (0 errors).
- `lint_applet`: **$ tsc --noEmit passed** with 0 errors.
- `npx cap sync android`: **Succeeded** in 0.28s (all web assets and 11 Capacitor plugins synchronized).
