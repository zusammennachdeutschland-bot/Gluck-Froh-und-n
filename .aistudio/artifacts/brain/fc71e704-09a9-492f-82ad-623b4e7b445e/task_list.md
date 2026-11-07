# Task List — Glück Smart Data Cleanup & Lesson Optimization

- [x] **1. Architecture & Safeguard Service**
  - [x] Created `src/services/lessonCleanupService.ts` with 30-day historical retention rules, 14-day future rolling window logic, and 100% financial invariance auditor (`preUnpaidBalancesTotal === postUnpaidBalancesTotal`).
  - [x] Implemented local JSON archive export (`exportPrunedLessonsBackupJson`) and tombstone tracker (`getPrunedLessonIds`, `addPrunedLessonIds`) to prevent cloud sync resurrection.

- [x] **2. Generator & Sync Deduplication Optimization**
  - [x] Capped future recurring lesson generation loop in `src/context/AppContext.tsx` to 14 days (`ROLLING_FUTURE_WINDOW_DAYS = 14`), eliminating ~2400 bloated recurring placeholders.
  - [x] Filtered out tombstoned pruned lessons in `initialLessonDeduplication` and `syncLessons` to guarantee pruned records never return from old storage chunks or Firebase caches.
  - [x] Configured automated daily and on-startup cleanup check in `AppContext.tsx`.

- [x] **3. UI & Control Surface**
  - [x] Built `src/components/SmartDataCleanupCard.tsx` following Glück's minimalist design: unboxed metadata metrics (`·`), financial invariant verification shield, one-click preview modal with sample lessons list, and JSON archive download.
  - [x] Integrated `SmartDataCleanupCard` into **Smart Backup Center** (`src/components/SmartBackupCenter.tsx`), **Teacher Profile** (`src/components/TeacherProfileSection.tsx`), and **Settings** (`src/components/SettingsView.tsx`).

- [x] **4. Verification & Testing**
  - [x] Verified build with `compile_applet` (Clean compilation).
  - [x] Verified types and linter with `lint_applet` (`tsc --noEmit` passed with 0 errors).
  - [x] Verified full production bundle with `npm run build` (Succeeded).
  - [x] Dev server restarted cleanly on port 3000.
- [ ] **5. Google Auth & Sync Repair**
  - [ ] Transition to Native Capacitor Google Sign-In for Android.
  - [ ] Hardening `executeSafeFirestoreWrite` and sync reports.
  - [ ] Implementing UID validation in `firestore.rules`.
  - [ ] Adding Sync Status indicators and Android Keystore tool to Settings.
  - [ ] Verification across 12 test scenarios.
