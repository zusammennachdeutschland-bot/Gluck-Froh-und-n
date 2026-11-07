# Glück – Full Codebase Bug Fix & Security Remediation Plan

This plan details the verification and remediation of security vulnerabilities, homework lifecycle bugs, synchronization tombstone gaps, financial cleanup safeguards, Electron process hardening, and build verification across the Glück application while preserving all working features and respecting explicit exclusions.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and security decisions were confirmed during Phase 1 and govern this implementation:

- **Confirmed Decision 1 (Android Release Keystore)**: Remove the tracked keystore file from the repository and load release signing credentials exclusively from environment variables / GitHub Actions Secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) with a safe local fallback to debug signing when secrets are absent. This preserves the existing signing identity so existing Android installations update seamlessly without uninstalling.
- **Confirmed Decision 2 (Standalone Teacher Portal Removal)**: Completely remove the unused standalone Teacher Portal page (`/teacher`), its password login gate, and obsolete login/logout endpoints, while preserving all homework creation, management, and live student tracking inside Learn Studio (`LernstudioHomeworkModal`) as well as all student-facing homework routes (`/homework/:id`).
- **Confirmed Decision 3 (Real Firebase Cloud Authentication)**: Remove the unauthenticated local `VirtualCloudUser` (`signInWithCloudEmailDirect`) fallback and auto-registration on invalid credentials. Require a real authenticated Firebase user (`auth.currentUser`) and enforce strict workspace ownership validation on every cloud read, write, and real-time subscription.
- **Confirmed Exclusions (Unchanged)**:
  1. Firestore security rules (`firestore.rules`) remain untouched with their current public read/write/delete permissions.
  2. Gold and currency exchange rate logic remains untouched.

---

## 1. Overview & Core Concept

- **What It Does**: Eliminates exposed credentials and unauthenticated workspace spoofing, enforces strict homework attempt and replay rules, prevents deleted or pruned lessons from resurrecting during multi-device synchronization, hardens financial settlement checks before lesson cleanup, removes dead Teacher Portal login code, secures the Electron desktop runtime, and enforces TypeScript verification in production builds and CI workflows.
- **Target Audience / Persona**: Teachers managing classes, schedules, finances, and Learn Studio interactive homework across Android, Desktop (Linux/Windows Electron), and Web, as well as students completing interactive German assignments.
- **Key Value**: Guarantees financial and operational data integrity across devices, protects release signing credentials, and ensures homework rules (`maxAttempts`, `allowReplay`, custom vocabulary sets) work deterministically.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Student Homework Flow**: Students opening a homework link see the clean Glück student landing page, select their student card, and start the assignment. While in progress, their status is tracked as `in_progress` without prematurely setting `completedAt`. If `allowReplay` is disabled or `maxAttempts` is reached, the student is shown their completed summary and prevented from starting additional attempts even if they reload or reopen the URL. If an assigned vocabulary set cannot be found, a clear error state is displayed rather than silently substituting an unrelated default set.
  - **Cloud Sync & Setup Flow**: Teachers sign in via Google OAuth (`signInTeacherWithGoogle`) or verified Firebase credentials. Setup and Settings views reflect real Firebase authentication state without unverified email-only spoofing.
  - **Smart Data Cleanup & Sync Flow**: When lessons are deleted or pruned via Smart Cleanup, their tombstone state (`deleted: true` and pruned lesson IDs) is preserved across local merges and cloud workspace snapshots so deleted lessons never reappear when syncing with another device. If archival storage fails or financial calculations throw an error, destructive cleanup is safely aborted.
- **Visual Identity & Theme**:
  - Preserves Glück's existing unified design system (`--background`, `--surface`, `--surface-border`, `--primary`, `--text-main`, `--text-muted`) with zero visual regressions.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Environment-Driven Android Signing with Debug Fallback**
  - *Chosen Approach*: Untrack the repository keystore artifact, add `*.keystore` and `*.keystore.b64` to ignore rules, and configure Gradle to read signing credentials from environment variables (`ANDROID_KEYSTORE_PATH` / `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). When building locally without release secrets, Gradle falls back cleanly without exposing hardcoded passwords.
  - *Why*: Eliminates credential exposure in source control while keeping the exact same certificate for production updates when secrets are configured in GitHub Actions.
- **Decision 2: Strict Workspace Ownership & Real Auth Enforcement**
  - *Chosen Approach*: Derive the active workspace ID exclusively from `auth.currentUser` (verifying `auth.currentUser.uid` and `auth.currentUser.email`), validate `ownerEmail` / `uid` on downloaded workspace documents before applying them, and remove `VirtualCloudUser` (`signInWithCloudEmailDirect`) and automatic account creation on `auth/invalid-credential`.
  - *Why*: Prevents unauthorized workspace impersonation via client-supplied email strings.
- **Decision 3: Deterministic Chunk Reassembly & Tombstone-Aware Cloud Sync**
  - *Chosen Approach*:
    1. Replace the fragile 5-second timestamp window (`Math.abs(updatedAtMs - latestCatMs) < 5000`) during cloud category reassembly with deterministic batch/chunk validation using `totalChunks` from the newest chunk header (`chunkIndex === 0`) and matching `chunkIndex < totalChunks`, plus cleaning up stale higher-index chunks when a category shrinks.
    2. Include soft-deleted records (`fullLessonsRef.current`, `fullPaymentsRef.current`) and `prunedLessonIds` in workspace backups, and use `mergeEntities` + `getPrunedLessonIds()` during workspace import/sync so remote syncs respect local deletions and tombstones.
  - *Why*: Large multi-chunk uploads on slow connections can take longer than 5 seconds across chunks, and overwriting arrays on sync without tombstones causes deleted lessons to reappear.
- **Decision 4: Fail-Closed Financial Settlement & Archival Validation**
  - *Chosen Approach*:
    1. Update `isLessonFullySettled` so a lesson is only treated as settled when it has explicit proof of settlement (`paymentStatus === 'paid'`, `paymentStatus === 'exempted'`, `report.paymentStatus === 'paid'`, or verified paid student/payment records covering the due amount)—never merely because payment fields are `undefined`.
    2. Enforce individual-lesson per-lesson arrangement checks for historical pruning where applicable, and fail closed (`financialInvarianceVerified = false`) if pre- or post-cleanup balance calculations throw an error instead of defaulting to `0`.
    3. In `executeLessonCleanup`, if writing to the backup archive throws an error, abort immediately before pruning any lesson records.
  - *Why*: Protects against accidental deletion of unpaid lessons or unarchived historical records.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Remediation Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        GLÜCK SECURITY & SYNC ARCHITECTURE                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐        ┌─────────────────────────────────────┐  │
│  │   Firebase Auth Guard   │        │   Workspace Sync & Merge Engine     │  │
│  │  - Real auth.currentUser│───────▶│  - Deterministic totalChunks check  │  │
│  │  - No VirtualCloudUser  │        │  - Tombstone & Pruned IDs preserved │  │
│  │  - Ownership verified   │        │  - LWW + Tombstone mergeEntities()  │  │
│  └─────────────────────────┘        └──────────────────┬──────────────────┘  │
│                                                        │                     │
│                                                        ▼                     │
│  ┌─────────────────────────┐        ┌─────────────────────────────────────┐  │
│  │  Student Homework Flow  │        │  Financial & Cleanup Safety Gate    │  │
│  │  - in_progress != done  │        │  - Explicit paid/exempted proof     │  │
│  │  - Enforce maxAttempts  │        │  - Fail-closed balance calculation  │  │
│  │  - Enforce allowReplay  │        │  - Mandatory archive before delete  │  │
│  │  - Custom Set snapshot  │        └─────────────────────────────────────┘  │
│  └─────────────────────────┘                                                 │
│                                                                              │
│  ┌─────────────────────────┐        ┌─────────────────────────────────────┐  │
│  │   Electron Hardening    │        │     CI/CD & Build Verification      │  │
│  │  - nodeIntegration:false│        │  - tsc --noEmit before bundle       │  │
│  │  - contextIsolation:true│        │  - Env-based Android Keystore       │  │
│  │  - webSecurity:true     │        │  - Automated test & build checks    │  │
│  │  - Preload bridge       │        └─────────────────────────────────────┘  │
│  └─────────────────────────┘                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Issue Verification Classification (Confirmed Against Current Codebase)

1. **Android Keystore & Gradle Credentials (CONFIRMED)**:
   - Tracked base64 keystore exists in `android/app/` and hardcoded passwords (`glueck2026`) exist in `android/app/build.gradle` and `.github/workflows/build-apk.yml`.
2. **Cloud Auth & Workspace Ownership (CONFIRMED)**:
   - `VirtualCloudUser` (`signInWithCloudEmailDirect`) allows setting an arbitrary email in `localStorage` without authentication; `signInTeacherWithEmailPassword` auto-creates users on `auth/invalid-credential`; `downloadWorkspaceFromGoogleCloud` and `subscribeToRemoteWorkspaceChanges` do not verify document `ownerEmail` against `auth.currentUser`.
3. **Homework System Bugs (CONFIRMED)**:
   - `syncLiveProgressToFirestore` sets `completedAt: completedAtIso` while `status === 'in_progress'`, causing `fetchAssignmentDetailsWithSync` (`s.status === 'completed' || s.completedAt`) to treat in-progress attempts as completed.
   - `HomeworkPlayerPage` does not block students when `allowReplay === false` (after 1 completed attempt) or when `completedAttempts.length >= assignment.maxAttempts`.
   - When a set ID in URL fallback is not found, `HomeworkPlayerPage` silently falls back to `DEFAULT_LERNSTUDIO_SETS[0]` instead of looking up custom sets in Firestore (`lernstudio_sets`) or showing a clear error when unavailable.
4. **Synchronization, Chunk Reassembly & Cleanup Archival (CONFIRMED)**:
   - `downloadWorkspaceFromGoogleCloud` filters chunks using `Math.abs(updatedAtMs - latestCatMs) < 5000`, which drops valid chunks if uploading takes >5s.
   - `performBackup` / `importBackupFile` omit soft-deleted tombstones and `prunedLessonIds`, allowing deleted/pruned lessons from another device to resurrect on sync.
   - `executeLessonCleanup` catches archive storage errors with a warning and continues deleting lessons anyway.
5. **Financial Cleanup Validation (CONFIRMED)**:
   - `isLessonFullySettled` returns `true` at the end if `paymentStatus` and `amountDue` are missing/undefined.
   - `analyzeLessonCleanup` catches errors in `calculateDuePaymentCycles` and leaves `preUnpaidBalancesTotal = 0` and `postUnpaidBalancesTotal = 0`, which causes `0 === 0` (`financialInvarianceVerified = true`) even when calculation failed.
6. **Unused Teacher Portal Login (CONFIRMED)**:
   - `/teacher` route in `App.tsx` renders `TeacherDashboardPage.tsx` with unused `/api/teacher/login` and `/api/teacher/logout` calls.
7. **Electron Security & Static Loading (CONFIRMED)**:
   - `electron/main.cjs` uses `nodeIntegration: true`, `contextIsolation: false`, `webSecurity: false`, and `vite.config.ts` uses `base: '/'` which breaks relative asset paths when `mainWindow.loadFile('../dist/index.html')` is used in packaged Electron builds unless handled via relative base or local server/protocol.
8. **Build & CI Verification (CONFIRMED)**:
   - `npm run build` runs `vite build && esbuild...` without running `tsc --noEmit` first, and GitHub workflows do not run typechecks/tests prior to packaging.
