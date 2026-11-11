# Walkthrough: Critical Security Remediation

## Summary of Changes

### 1. Hardened Admin Override Isolation (`src/server/firebaseAdmin.ts`)
- **Vulnerability**: `getAuthoritativeFirestore()` previously evaluated `customAdminDbOverride` before evaluating production/staging/preview or Vercel environment variables, potentially allowing an in-memory test double to persist into a deployment runtime if improperly injected.
- **Remediation**:
  - Implemented `isNonTestDeploymentOrVercel()`:
    ```ts
    export function isNonTestDeploymentOrVercel(): boolean {
      if (process.env.VERCEL === '1') return true;
      if (process.env.VERCEL_ENV !== undefined && process.env.VERCEL_ENV !== '') return true;
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === 'production' || nodeEnv === 'staging' || nodeEnv === 'preview') return true;
      return false;
    }
    ```
  - Protected `setAdminFirestoreOverrideForTesting(db)` and `getInMemoryAdminFirestore()` to throw immediately if `isNonTestDeploymentOrVercel()` is true or if `!isExplicitTestEnvironment()`.
  - Re-ordered `getAuthoritativeFirestore()`: in any Vercel or deployment environment, `customAdminDbOverride` is forcefully set to `null` (preventing any test leaks from surviving into serverless execution), and the function strictly requires live Firebase Admin credentials, failing closed with a hard error if missing.
  - Removed unused import `setAdminFirestoreOverrideForTesting` in `src/api/expressApp.ts`.

### 2. Public `setSnapshot` Answer-Key Sanitization (`src/api/expressApp.ts`)
- **Vulnerability**: `toPublicAssignmentDto()` previously returned `setSnapshot: normalized.setSnapshot || null`, which exposed `customExercises[].correctAnswer` and explanations to unauthenticated students calling `GET /api/homework/info`.
- **Remediation**:
  - Built `sanitizePublicSetSnapshot(rawSnapshot)` using a strict allowlist:
    - Vocabulary items: allowlists only student study fields (`id`, `german`, `arabic`, `article`, `english`, `plural`, `exampleSentenceGerman`, `exampleSentenceArabic`, `imageUrl`, `emoji`, `wordType`, `conjugation`, `syllables`, `category`).
    - Custom exercises: allowlists only `id`, `type`, `question`, `options`, `itemRefId`.
    - **Strictly stripped**: `correctAnswer`, `explanation`, `teacherNotes`, `ownerUid`, `ownerEmail`, `assignedGroupId`, `isArchived`, credentials, and PII.
  - Implemented server-side authoritative grading in `POST /api/homework/submit`: grades custom exercises server-side against Firestore-stored answer keys from `targetHw.setSnapshot.customExercises`, ensuring students cannot tamper with `isCorrect`.

---

## Verification Results

### Dedicated Test Suite (`src/tests/criticalAdminAndSnapshotRemediation.test.ts`)
- `[AO-01]` Vercel production strictly rejects test override injection: **PASS**
- `[AO-02]` Vercel preview strictly rejects test override injection: **PASS**
- `[AO-03]` Vercel staging strictly rejects test override injection: **PASS**
- `[AO-04]` Non-test local runtime strictly rejects test override injection: **PASS**
- `[AO-05]` Explicit test environment allows override injection: **PASS**
- `[AO-06]` Vercel purges stale test overrides and strictly fails closed without credentials: **PASS**
- `[SS-01]` Public snapshot strips correctAnswer, explanation, and owner metadata without mutating source: **PASS**
- `[SS-02]` `GET /api/homework/info` strictly conceals answer keys and explanations from students: **PASS**
- `[SS-03]` Server authoritatively grades custom exercises against stored answer keys: **PASS**

### Codebase Regression Suites
- `src/tests/homeworkShareTokenSecurity.test.ts`: **8/8 PASSED**
- `src/tests/vercelServerlessPersistence.test.ts`: **18/18 PASSED** (`HW-P01` .. `HW-P18`)
- `src/tests/homeworkAccountIsolation.test.ts`: **28/28 PASSED** (`SR-01` .. `SR-10`, `CA-01` .. `CA-11`, `V-01` .. `V-06`)
- `src/tests/homeworkSystemRepair.test.ts`: **34/34 PASSED**
- `src/tests/cloudSyncReliability.test.ts`: **80/80 PASSED**
- `npm test`: **100% PASSED**
- `npm run typecheck` (`tsc --noEmit`): **0 ERRORS**
- `compile_applet` & `lint_applet`: **CLEAN BUILD**

### Absolute Restrictions Respected
- Zero commits, pushes, or deployments performed.
- Firebase production rules and credentials untouched.
- Lockfiles untouched.
