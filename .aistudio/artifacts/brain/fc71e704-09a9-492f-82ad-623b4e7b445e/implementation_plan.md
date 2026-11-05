# Glück Lernstudio Web + Homework System

A standalone, Vercel-deployable web application for Glück Lernstudio combined with a Blooket-style Homework assignment system and protected Teacher Dashboard, while maintaining a single shared source of truth with the existing Glück desktop/mobile application.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed choices in Phase 1:
> 1. **Code Sharing & Single Source of Truth**: `lernstudio-web/shared` will be the authoritative, platform-independent source containing all game engines, components, assets, curriculum batches, and utilities. A reliable automated build-sync script + npm script (`sync:shared`) ensures zero duplication and continuous synchronization on local builds and GitHub CI / Vercel deployments.
> 2. **Student Gameplay Experience**: When a student opens a homework link (`/homework/:id`), they enter a **Dedicated Student Homework Mode** (clean solo questions, gamified streak combos, timer settings, immediate feedback) without confusing classroom team-split rosters, tailored specifically for frictionless independent mobile/desktop completion.
> 3. **Teacher Management Workflow**: The Homework management suite will be accessible **both inside the existing Glück app** (via a dedicated Homework button in Lernstudio) and via the standalone web protected Teacher Dashboard at `/teacher`.

---

## 1. Overview & Core Concept

- **What It Does**:
  - Provides a standalone web version of Glück Lernstudio hosted on Vercel at `https://your-project.vercel.app/`.
  - Enables teachers to select any curriculum set (or custom set), configure game limits (attempts, deadline, question count, allowed modes), and generate a shareable homework link (e.g. `https://your-project.vercel.app/homework/abc123`).
  - Allows students on any mobile, tablet, or desktop device to complete homework assignments with zero accounts or logins, storing verified progress and answers in **Vercel Blob**.
  - Provides a protected `/teacher` dashboard to track student participation, analyze question-level accuracy, and export results to CSV.
- **Target Audience**:
  - German language learners (children and young students) completing fun, engaging vocabulary homework assignments.
  - Teachers creating assignments and monitoring performance from the desktop app or the web dashboard.
- **Key Value**:
  - Zero deployment friction for students; no apps to install, no passwords to remember.
  - Immutable assignment snapshots: future edits to vocabulary sets will never alter already-assigned homework.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TEACHER WORKFLOW                                │
└────────────────────────────────────────────────────────────────────────┘
  Glück Desktop/Web
  └─► Lernstudio Hub
       └─► "Homework & Assignments" (الواجبات المنزلية)
            ├─► Select Vocabulary Set (Curriculum Batch or Custom Set)
            ├─► Set Title, Question Count (e.g. 10/15/20), Deadline & Attempts
            └─► Click "Create Assignment"
                 └─► Generated Link: https://.../homework/hw_7x9k2
                      └─► Share with Students via WhatsApp / School Portal

┌────────────────────────────────────────────────────────────────────────┐
│                        STUDENT WORKFLOW                                │
└────────────────────────────────────────────────────────────────────────┘
  Student opens https://.../homework/hw_7x9k2 on any smartphone/laptop
  ├─► Screen 1: Welcome Banner + Assignment Details + Student Name Input
  ├─► Screen 2: Dedicated Interactive Game Arena
  │    ├─► German audio pronunciation (normal & slow speeds)
  │    ├─► 4-choice interactive runes / missing letters / articles
  │    └─► Real-time streak combo feedback
  └─► Screen 3: Victory Podium & Score Summary
       ├─► Score percentage, correct/incorrect summary
       └─► Answers submitted safely to server (server-side verified score)
```

### Visual Identity & Theme
- **Color Palette**:
  - Dominant Neutral: Deep obsidian slate (`#0B0F19`) and clean daylight off-white (`#F8FAFC`).
  - Brand Primary: Royal Indigo (`#4F46E5`) with Golden Amber accents (`#F59E0B`).
  - Semantic: Emerald Green (`#10B981`) for correct answers, Rose Red (`#F43F5E`) for incorrect attempts.
- **Typography**:
  - Primary Display: *Plus Jakarta Sans* / *Outfit* with clean geometric proportions.
  - Data & Metrics: *Tabular Numerals* (`tabular-nums`) for timers, question counts, and percentages.
- **Child-Friendly Anti-Slop Discipline**:
  - No generic AI pills or mechanical code comments.
  - Tactile 3D cards, responsive buttons with tactile press physics, and resilient local WebP imagery.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Directory Structure & Vercel Root Isolation
- **Approach**:
  - `lernstudio-web/` is a self-contained, standalone Vite + React + TypeScript application with its own `package.json`, `vite.config.ts`, `tsconfig.json`, and Vercel Functions (`lernstudio-web/api/`).
  - All shared Lernstudio components, utilities, types, curriculum sets, and public game assets live under `lernstudio-web/shared/`.
  - The main Glück desktop application imports directly from `./lernstudio-web/shared/` (or via path alias `@lernstudio-shared/*`), ensuring **one single source of truth**.
- **Why**:
  - Vercel deployments configured with Root Directory `lernstudio-web` cannot resolve files outside their root folder. Housing the authoritative shared codebase inside `lernstudio-web/shared` satisfies both Vercel's build boundary and desktop Glück's architecture.

### Decision 2: Storage Architecture & Concurrency Defense
- **Approach**:
  - Use **Vercel Blob** (`@vercel/blob`) with atomic separate JSON objects:
    - `assignments/{assignmentId}.json`: Immutable assignment metadata and vocabulary snapshot.
    - `submissions/{assignmentId}/{submissionId}.json`: Independent record for each student attempt.
- **Why**:
  - Prevents race conditions and overwritten student results when 20+ students submit answers simultaneously.
  - Server-side scoring verifies all submitted answers against the assignment's vocabulary snapshot.

### Decision 3: Server-Side Password Protection & Cookie Sessions
- **Approach**:
  - Teacher authentication for `/api/teacher/*` is handled via an HTTP-only secure cookie containing an HMAC-signed session token generated with `SESSION_SECRET` and validated against `TEACHER_PASSWORD`.
- **Why**:
  - Completely eliminates password exposure in client JavaScript while avoiding external auth dependencies (no Firebase, no Supabase, no external accounts).

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                      SYSTEM ARCHITECTURE DIAGRAM                       │
└────────────────────────────────────────────────────────────────────────┘

 [ Glück Desktop / Mobile App ]            [ Vercel Web Deployment ]
               │                                       │
               │ (Imports shared source)               │ (Root: lernstudio-web)
               ▼                                       ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │                lernstudio-web/shared (AUTHORITATIVE)                │
 │  ├─ components/ (LernstudioView, ClassroomBoard, SetupScreen, ...)  │
 │  ├─ games/      (All 35 games: UltimateXO, Race, Wheel, Memory, ...)│
 │  ├─ data/       (curriculum batches 1-10, default sets, manifest)   │
 │  ├─ utils/      (audio, vocabulary, translations, questionAdapter)  │
 │  └─ types/      (LernstudioSet, LernstudioItem, GameMode, ...)      │
 └─────────────────────────────────────────────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
 ┌──────────────────────────────┐        ┌─────────────────────────────┐
 │    lernstudio-web/src/       │        │     lernstudio-web/api/     │
 │  ├─ pages/Home.tsx           │        │  ├─ teacher/login.ts        │
 │  ├─ pages/HomeworkPlayer.tsx │        │  ├─ teacher/assignments.ts  │
 │  ├─ pages/TeacherDash.tsx    │        │  ├─ homework/[id].ts        │
 │  └─ platform/webAdapter.ts   │        │  └─ homework/[id]/submit.ts │
 └──────────────────────────────┘        └──────────────┬──────────────┘
                                                        │
                                                        ▼
                                           ┌───────────────────────────┐
                                           │   Vercel Blob Storage     │
                                           │  - assignments/*.json     │
                                           │  - submissions/*/*.json   │
                                           └───────────────────────────┘
```

### Data Models & Schemas

#### Assignment Record (`assignments/{assignmentId}.json`)
```typescript
export interface HomeworkAssignment {
  id: string; // e.g. "hw_9a2b8c"
  title: string;
  setSnapshot: LernstudioSet; // Immutable copy of the vocabulary set
  allowedGameModes: string[]; // e.g. ["solo_practice", "ultimate_tictactoe"]
  questionCount: number; // e.g. 10, 15, 20
  timeLimitMinutes?: number; // 0 = unlimited
  maxAttempts: number; // e.g. 1, 2, 3, or 0 (unlimited)
  allowReplay: boolean;
  deadline?: string; // ISO 8601 string
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}
```

#### Student Submission Record (`submissions/{assignmentId}/{submissionId}.json`)
```typescript
export interface HomeworkSubmission {
  id: string; // e.g. "sub_5f1e2d"
  assignmentId: string;
  studentName: string;
  attemptNumber: number;
  startedAt: string;
  completedAt: string;
  timeSpentSeconds: number;
  totalQuestions: number;
  correctAnswersCount: number;
  scorePercentage: number;
  responses: {
    questionId: string;
    germanWord: string;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    timeSpentSeconds: number;
  }[];
}
```

---

## 5. Step-by-Step Implementation Strategy

1. **Phase 1: Shared Core Extraction & Desktop Wiring**
   - Create `lernstudio-web/shared` and move the platform-agnostic Lernstudio source (components, games, effects, utils, types, data, and curriculum) into it.
   - Update imports in desktop Glück to consume `lernstudio-web/shared`.
   - Verify `npm run build` and desktop application functionality (zero regression).

2. **Phase 2: Standalone Web Application Scaffold (`lernstudio-web`)**
   - Configure `lernstudio-web/package.json`, `vite.config.ts`, `tailwind.config`, `index.html`, and router.
   - Copy or symlink game assets (`/public/assets/games/`) to `lernstudio-web/public/assets/games/`.
   - Implement web platform audio and state adapter (Web Audio API / Web Speech API without Capacitor/Electron native dependencies).
   - Verify `cd lernstudio-web && npm run build` compiles cleanly.

3. **Phase 3: Blooket-Style Homework Engine & Server APIs**
   - Implement Vercel serverless functions in `lernstudio-web/api/`:
     - Teacher auth: `/api/teacher/login`, `/api/teacher/logout`, `/api/teacher/session`.
     - Assignment management: `/api/teacher/assignments` (create, list, close, stats).
     - Student endpoints: `/api/homework/[id]` (fetch assignment snapshot), `/api/homework/[id]/submit` (server-verified scoring and persistence).
   - Integrate `@vercel/blob` with atomic key-space partitioning.

4. **Phase 4: Student Gameplay Arena & Teacher Dashboard**
   - Build `/homework/:id` Student Experience:
     - Name entry screen with attempt check.
     - Interactive solo question runner with normal and 0.6x slow German TTS.
     - Celebration summary podium with question breakdown.
   - Build `/teacher` Protected Dashboard:
     - Assignment creation modal with Set snapshot preview.
     - Live participation statistics (Started / Completed / Average Score).
     - Question-level accuracy breakdown (identifying hardest vocabulary words).
     - CSV export for student grades.

5. **Phase 5: Vercel Deployment & Build Verification**
   - Create `vercel.json` with route rewrites and function timeouts.
   - Create comprehensive `README.md` and `.env.example` documenting deployment steps and required environment variables (`BLOB_READ_WRITE_TOKEN`, `TEACHER_PASSWORD`, `SESSION_SECRET`).
   - Run end-to-end build tests for both the desktop app and the standalone web app.
