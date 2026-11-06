# Task List — Google Cloud Full Workspace Synchronization

- [x] **1. Schema & Security Rules Architecture**
  - [x] Update `firebase-blueprint.json` with `UserWorkspaceCategoryChunkDoc` entity and `/user_workspaces/{userId}/categories/{docId}` path.
  - [x] Update `firestore.rules` with strict ownership checks (`request.auth != null && request.auth.uid == userId`) and field validations (`isValidWorkspaceChunk`).
  - [x] Deploy security rules to Firebase using `DeployRules`.

- [x] **2. Engine & Sync Service Implementation**
  - [x] Build `src/services/firebaseWorkspaceSync.ts` supporting chunking, bidirectional upload/download, and real-time listeners (`onSnapshot`).
  - [x] Build `src/hooks/useGoogleCloudWorkspaceSync.ts` with debounced auto-push on mutation and background pull on remote changes.
  - [x] Build `GoogleCloudSyncCard.tsx` with Google sign-in/sign-out, auto-sync toggle, unboxed tabular stats, and 1-tap manual sync/upload/download actions.

- [x] **3. Application UI Integration**
  - [x] Mount `useGoogleCloudWorkspaceSync` hook inside `MainApp` (`src/App.tsx`).
  - [x] Add `GoogleCloudSyncCard` to **SettingsView** (mobile overview & desktop right panel).
  - [x] Add `GoogleCloudSyncCard` inside **TeacherProfileSection** (Teacher Identity & Account).
  - [x] Add `GoogleCloudSyncCard` to the top of **SmartBackupCenter** (Backup & Restore).

- [x] **4. Verification & Fixes**
  - [x] Verify standalone build (`lernstudio-web` via `tsc -b && vite build`).
  - [x] Verify root app compilation and linting (`compile_applet` & `lint_applet`).
  - [x] Fix Firestore Security Rules for `lernstudio_sets`, `homework_assignments`, and `homework_submissions` list permissions.
  - [x] Deploy updated security rules via `fax.DeployRules`.
  - [x] Verify dev server restarted and responsive.
