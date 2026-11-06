# Unified Vercel Deployment & Set Sharing Architecture Plan

Simplify and unify the application architecture by hosting the entire Glück Lernstudio platform under a single Vercel deployment, integrating Vercel domain auto-detection and cloud synchronization into the Teacher Profile, removing the redundant standalone `lernstudio-web` subfolder, and enabling direct Vercel link generation for sharing vocabulary sets and interactive homework assignments with parents and students.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1:
>
> - **Unified Set & Homework Sharing**: Generating direct shareable links (`https://<vercel-domain>/set/<id>` or `https://<vercel-domain>/homework/<id>`) using the single Vercel domain configured or auto-detected in the Teacher Profile.
> - **Cleanup & Codebase Consolidation**: Completely remove the redundant `lernstudio-web` subfolder and import references, consolidating all Lernstudio views, games, homework modals, and shared sync functions inside the primary application tree (`src/`).
> - **Smart Vercel Domain Management**: Auto-detect `window.location.origin` when running on Vercel (`.vercel.app`), allow editing and saving in **Teacher Profile & Account Settings**, and automatically sync the saved domain across devices via the teacher's Google Cloud Account (Firestore).

---

## 1. Overview & Core Concept

### What It Does
This update consolidates the dual-folder structure into a unified, production-grade application ready for single-click deployment on Vercel. Teachers can create vocabulary sets, start Blooket-style classroom games, assign homework, and share direct Vercel links with parents and students. All app data and settings—including the teacher's custom Vercel public domain—sync seamlessly across devices via Firebase Firestore and Google Sign-In.

### Key Value
- **Zero Architecture Friction**: Eliminates the maintenance overhead of managing two distinct sub-projects (`src/` vs `lernstudio-web/`).
- **Seamless Sharing**: Parents and students open interactive sets and homework directly on the teacher's Vercel domain with real-time live submission tracking.
- **Smart Auto-Detection**: The app automatically recognizes when it is running on a Vercel URL and saves that domain to the teacher's profile and cloud workspace.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Vercel Deployment & Domain Configuration**:
   - The teacher deploys the main repository directly to Vercel.
   - Upon opening the app on Vercel (or entering their domain in **Settings > Profile & Work Schedule**), the app automatically detects `https://<app-name>.vercel.app`.
   - The domain is saved to local storage and synced to the teacher's Google Cloud workspace.

2. **Sharing Vocabulary Sets & Homework Assignments**:
   - In **Glück Lernstudio**, clicking **Share Set (مشاركة السيت)** or **Create Homework (إنشاء واجب)** opens a clean modal with a generated direct Vercel URL.
   - Teachers can copy the link with 1-click or share via WhatsApp/QR code to parents.
   - Students open the link on Vercel to play or complete homework without registering. Submissions report back to the teacher's dashboard in real-time via Firestore.

3. **Clean Codebase Footprint**:
   - All shared components (`LernstudioHomeworkModal`, `firebaseCloudSync`, `homeworkTypes`, `data_curriculum`) reside natively in `src/`.
   - The obsolete standalone `lernstudio-web` folder is cleanly removed.

---

## 3. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Unified Glück App (Vercel)                         │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Main App Views (src/components)      │ Glück Lernstudio (src/components/...)│
│  - Teacher Profile & Account          │  - Set Builder & Library             │
│  - Smart Vercel Domain Input & Sync   │  - Interactive Games & Student View   │
│  - Class CRM, Attendance, Finance    │  - Blooket-Style Homework Creator    │
├──────────────────────────────────────┴──────────────────────────────────────┤
│ Unified Services & Utilities (src/services / src/shared)                    │
│  - firebaseWorkspaceSync.ts & firebaseCloudSync.ts                          │
│  - Auto Vercel Domain Detection & Firestore Synchronization                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
                   ┌──────────────────────────────────────┐
                   │    Google Cloud Firestore Database   │
                   │  - user_workspaces/{uid}/categories  │
                   │  - homework_assignments & submissions │
                   │  - lernstudio_sets                    │
                   └──────────────────────────────────────┘
```

### Data Model & State Strategy

- **Vercel Public Domain**: Stored in `localStorage` under `gluck_vercel_public_domain` and included in the teacher's `core_crm` / profile cloud sync object (`profile.vercelPublicDomain`).
- **Homework & Set Sharing URL Generator**: `buildHomeworkShareUrl(assignment, customDomain)` constructs URLs using `(customDomain || getVercelPublicDomain())`.

---

## 4. Implementation Steps

1. **Component & Module Migration**:
   - Move all required shared files from `lernstudio-web/shared/` into native locations in `src/shared/` or `src/services/`.
   - Update all import statements across `src/components/lernstudio/` and `src/services/` to target native `src/` paths.

2. **Clean Codebase Deletion**:
   - Safely remove the redundant `/lernstudio-web` directory.

3. **Vercel Domain Auto-Detection & Cloud Sync**:
   - Implement `getVercelPublicDomain()` and `setVercelPublicDomain()` in `src/services/firebaseCloudSync.ts`.
   - Integrate the Vercel Domain input and status badge inside `TeacherProfileSection.tsx` (الإعدادات > الملف التعريفي) with auto-detect from `window.location.origin` when running on Vercel.

4. **Set & Homework Sharing Modals**:
   - Ensure `LernstudioHomeworkModal` and `LernstudioView` offer clean 1-click sharing of sets and assignments using the configured Vercel domain.

5. **Verification**:
   - Run `compile_applet` and `lint_applet` to confirm zero broken imports and a clean build.
