# Task List — Critical Security Remediation: Admin Override Isolation & Public Answer-Key Leakage

- [x] **1. Secure customAdminDbOverride (`src/server/firebaseAdmin.ts`)**
  - [x] Added `isNonTestDeploymentOrVercel()` checking `process.env.VERCEL === '1'`, `process.env.VERCEL_ENV`, and `NODE_ENV === 'production' | 'staging' | 'preview'`.
  - [x] Restricted `setAdminFirestoreOverrideForTesting(db)` to throw immediately in all Vercel/deployment runtimes and when outside genuine test environments.
  - [x] Restricted `getInMemoryAdminFirestore()` to throw immediately in all Vercel/deployment runtimes and when outside genuine test environments.
  - [x] Hardened `getAuthoritativeFirestore()`: prioritizes deployment checks first, purges any leaked override (`customAdminDbOverride = null`), verifies credentials, and strictly fails closed without credentials.
  - [x] Removed unused test-override import from `src/api/expressApp.ts`.

- [x] **2. Public setSnapshot Sanitization & Answer Key Protection (`src/api/expressApp.ts`)**
  - [x] Implemented `sanitizePublicSetSnapshot()` allowlist sanitizer.
  - [x] Strictly stripped `correctAnswer`, `explanation`, `teacherNotes`, `ownerUid`, `ownerEmail`, `assignedGroupId`, and PII from public responses.
  - [x] Preserved original raw snapshot immutability (zero in-memory mutation).
  - [x] Updated `toPublicAssignmentDto()` to apply `sanitizePublicSetSnapshot(normalized.setSnapshot)`.
  - [x] Hardened `POST /api/homework/submit` to perform server-side authoritative grading against Firestore-stored answer keys, preventing forged `isCorrect` submissions.

- [x] **3. Dedicated Regression Test Suite (`src/tests/criticalAdminAndSnapshotRemediation.test.ts`)**
  - [x] `[AO-01]` Vercel production strictly rejects test override injection.
  - [x] `[AO-02]` Vercel preview strictly rejects test override injection.
  - [x] `[AO-03]` Vercel staging strictly rejects test override injection.
  - [x] `[AO-04]` Non-test local runtime strictly rejects test override injection.
  - [x] `[AO-05]` Explicit test environment allows override injection.
  - [x] `[AO-06]` Vercel purges stale test overrides and strictly fails closed without credentials.
  - [x] `[SS-01]` Public snapshot strips correctAnswer, explanation, and owner metadata without mutating source.
  - [x] `[SS-02]` `GET /api/homework/info` strictly conceals answer keys and explanations from students.
  - [x] `[SS-03]` Server authoritatively grades custom exercises against stored answer keys.
  - [x] All 9/9 tests passed!

- [x] **4. Full Regression Verification & Build Health**
  - [x] `homeworkShareTokenSecurity.test.ts`: 8/8 passed.
  - [x] `vercelServerlessPersistence.test.ts`: 18/18 passed (`HW-P01` .. `HW-P18`).
  - [x] `homeworkAccountIsolation.test.ts`: 28/28 passed (`SR-01` .. `SR-10`, `CA-01` .. `CA-11`, `V-01` .. `V-06`).
  - [x] `homeworkSystemRepair.test.ts`: 34/34 passed.
  - [x] `cloudSyncReliability.test.ts`: 80/80 passed.
  - [x] `npm test`: 100% passed.
  - [x] `npm run typecheck` (`tsc --noEmit`): 0 errors.
  - [x] `compile_applet` & `lint_applet`: clean compilation.
  - [x] Strict adherence to non-deployment / non-push restriction: 0 commits, 0 pushes, 0 deploys.
