# Task List — Glück Cloud Sync Reliability & Android CI Fix

- [x] **1. Android GitHub Actions CI Fix (`.github/workflows/build-apk.yml`)**
  - [x] Removed dependency on obsolete `android-actions/setup-android@v3` (which was crashing on `sdkmanager "tools"`).
  - [x] Configured native runner Android SDK paths (`$ANDROID_SDK_ROOT`, `$ANDROID_HOME`, `cmdline-tools/latest/bin`).
  - [x] Verified installation of `platforms;android-36` and `build-tools;36.0.0`.
  - [x] Verified `compileSdkVersion = 36` in `android/variables.gradle` and `android/app/build.gradle`.

- [x] **2. Actual Durable Queue Persistence & Read-Back Verification**
  - [x] Configured `gluck_cloud_pending_remote_queue_v2_` as heavy keys stored exclusively in IndexedDB (`localforage`), bypassing 5MB `localStorage`.
  - [x] Added `storage.verifyDurableReadBackValue<T>()` and `storage.verifyDurableRemoved()` for verified persistence.
  - [x] Updated `saveDurablePendingRemoteQueue` to await writes, verify read-back equality, and return boolean persistence status.
  - [x] Enforced rollback in `enqueueRemoteSnapshot` if durable persistence fails (never falsely claims queued or acknowledges revision).
  - [x] Enforced verified removal in `drain()` with automatic restoration if removal persistence fails.
  - [x] Hardened `persistAppliedDocTokensMap()` to return false and reject in-memory poisoning when durable storage fails.
  - [x] Added `loadDurablePendingRemoteQueueAsync()` with backward compatibility for legacy queues.

- [x] **3. Automated Test Scenarios (`src/tests/cloudSyncReliability.test.ts`)**
  - [x] `RA-16`: Pending backup >5MB persists durably in IndexedDB without quota failure, bypasses localStorage, and drains cleanly.
  - [x] `RA-17`: Simulated localStorage `QuotaExceededError` does not break durable queue persistence in IndexedDB.
  - [x] `RA-18`: IndexedDB write failure aborts queue persistence, rolls back item, and prevents false acknowledgement.
  - [x] `RA-19`: Process restart after a failed import restores queue from durable storage and resumes cleanly upon reopening.
  - [x] `RA-20`: Queue read-back mismatch rejects persistence, rolls back item, and does not acknowledge revision.
  - [x] `RA-21`: Acknowledgement storage failure prevents revision acknowledgement and retains payload in durable queue.
  - [x] `RA-22`: Retry after restart without a new cloud snapshot drains queue and synchronizes local workspace.

- [x] **4. Compilation, Linting & Android Sync**
  - [x] `compile_applet`: Clean build.
  - [x] `lint_applet` (`tsc --noEmit`): 0 errors.
  - [x] `npx cap sync android`: Succeeded in 0.28s.
