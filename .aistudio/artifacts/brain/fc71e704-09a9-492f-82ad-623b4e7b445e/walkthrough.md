# Glück — Google Cloud Sync Reliability & Cloud-Side Control Walkthrough

## Summary of Completed Work

### 1. Built-in Lernstudio Sets Protection
- **Permanent Bundled Preservation:** `DEFAULT_LERNSTUDIO_SETS` (297+ built-in sets) are always retained locally and never erased or overwritten during:
  - Full restore (`restoreCloudWorkspaceData`)
  - Delta restore (`applyCloudDeltasToLocalState`)
  - Backup file import (`importBackupFile` in `AppContext.tsx`)
- **Exclusion from Cloud Uploads:** Built-in sets are strictly filtered out of cloud chunks to prevent bloat and quota exhaustion.
- **Custom Sets & Tombstones:** Custom sets created by the user are synchronized bidirectionally. Legitimate deletions of custom sets are tracked via tombstones without touching built-in sets.

### 2. Cloud-Side Pause & Generation Marker Mechanism
- **Persistent Marker Doc:** Created `/user_workspaces/{uid}/categories/sync_control_chunk_0`, which complies with Firestore security rules (`isValidWorkspaceChunk`).
- **Fail-Safe Check (`getCloudSyncControlState`):** Every device queries this document before attempting auto-push. If the cloud reports `isPaused: true`, all auto-uploads and initial seeding are blocked. If the network or Firestore read fails, it defaults to `{ isPaused: true, isError: true }` (blocking uploads until verified).
- **Generation Invalidation:** When a workspace is cleared, a new `clearedGeneration` timestamp is issued (`gen_cleared_<timestamp>`). Any reconnecting device with an older generation marker is prevented from uploading or repopulating the cleared cloud database.
- **Deliberate Manual Reactivation (`reactivateCloudSync`):** Re-enabling synchronization explicitly issues a new generation ID (`gen_<timestamp>`) and unpauses the workspace.

### 3. Reliable Clear Cloud Data
- **Targeted Cloud-Only Deletion:** Deletes only cloud workspace chunks (primary UID categories and legacy categories) and Relay workspace records without touching local application data or local backups.
- **Confirmed Deletions Only:** Uses `deleteDoc` and verifies HTTP status `res.ok` on Relay endpoints before counting deletions.
- **Post-Deletion Verification:** Re-reads the Firestore collection and Relay to confirm the workspace is completely empty (except for the paused `sync_control_chunk_0` marker) before reporting success. Never returns false success.

### 4. Exponential Backoff Bootstrap & Network Resilience
- **Exponential Backoff:** If the initial cloud read encounters network timeouts or rate limits, it retries up to 5 times (1s, 2s, 4s, 8s, 16s, capped at 30s) instead of treating the error as an empty workspace.
- **Online Event Listener:** Automatically triggers an immediate retry when the browser/device reconnects to the internet.
- **Race Condition Prevention:** Auto-push is blocked until `hasCompletedInitialCheckRef.current` is confirmed true.

### 5. Firestore as Primary Source of Truth
- In `uploadWorkspaceToGoogleCloud`, Firestore chunk writes are executed and confirmed first via `setDoc`.
- Only after successful Firestore writes are chunks forwarded to the Relay server. Relay HTTP errors are logged without invalidating the confirmed Firestore sync state.

---

## Verification Results

### 1. Test Suite (`npm test` -> `src/tests/cloudSyncReliability.test.ts`)
All 12 required real-world production code scenarios passed with 0 failures:
1. `[PASS]` Device A uploads new data; Device B downloads and applies it.
2. `[PASS]` Device B modifies the same workspace; Device A receives and updates record.
3. `[PASS]` A deletion on one device propagates correctly to the other device via tombstone.
4. `[PASS]` A temporary cloud read failure does not trigger an empty-workspace seed.
5. `[PASS]` Bootstrap retries after a temporary failure using exponential backoff.
6. `[PASS]` A cleared cloud workspace remains paused across devices via sync_control.
7. `[PASS]` An offline device cannot repopulate a cleared workspace after reconnecting (Generation mismatch blocked).
8. `[PASS]` Manual reactivation starts a deliberate new synchronization generation.
9. `[PASS]` Built-in Lernstudio Sets survive full and delta restores.
10. `[PASS]` Custom Lernstudio Sets synchronize correctly without uploading built-in sets.
11. `[PASS]` Clear Cloud Data reports failure when any deletion or verification fails.
12. `[PASS]` Relay HTTP failures do not produce false synchronization success.

### 2. Compilation and Linting
- **`compile_applet`:** Build succeeded without errors.
- **`lint_applet` (`tsc --noEmit`):** Completed with 0 type errors.
- **Vercel/Node Server Compatibility:** Guarded all `localStorage` calls in `storageService.ts` and normalized `peerjs` imports to prevent server build and runtime errors.
