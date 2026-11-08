# Glück — Homework Assignment, Student Identity & Results Tracking Repair

A production-grade architectural repair of the Glück Homework Assignment lifecycle—from teacher creation and audience selection to student identity verification, submission persistence, and the Teacher Follow-up Dashboard. This eliminates student-list exposure across groups, prevents unexpected fallback to manual name entry on group assignments, and guarantees accurate, non-colliding result tracking by stable student and participant IDs.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions incorporate your confirmed answers and establish strict privacy and identity guarantees across all homework flows.

- **Confirmed Decision 1 — Per-Device Participant Identity in Open Mode (`مفتوح لأي اسم`)**: When an assignment is created in Open mode, each browser/device generates a persistent per-assignment participant token (`participantId`). If two different people enter the exact same name on different devices, their submissions and attempts remain completely separate in the Teacher Follow-up Dashboard while allowing the same participant to replay and track multiple attempts from their own device.
- **Confirmed Decision 2 — Complete Removal of "All Groups" (`شيل حوار كل الجروبات أصلا من الاختيارات`)**: The old "All Groups" option is completely removed. Teachers choose explicitly between **Open Homework (`مفتوح لأي اسم`)** and **Specific Group (`جروب معين`)**. Any legacy assignment without a specific group ID is classified as Open mode (`'open'`) and never exposes the full student database.
- **Confirmed Decision 3 — Strict Group Roster Isolation & Fail-Closed Student Gate**: In Specific Group mode (`جروب معين`), the student-facing page displays only the students belonging to that single selected group and never reads `dl_students` from local storage. If the group roster cannot be loaded or is empty, the page fails closed with a clear message (`"تعذر تحميل قائمة طلاب هذه المجموعة حاليًا. يرجى التواصل مع المعلم أو إعادة فتح الرابط."`) instead of falling back to an open text input.

---

## 1. Overview & Core Concept

- **What It Does**: Repairs the end-to-end homework system so teachers can create either an open public assignment (manual name entry, zero student roster exposure) or a group-restricted assignment (selectable student cards strictly limited to the chosen group), validate student identity on submission, and inspect complete per-student or per-participant progress in the Follow-up Dashboard.
- **Target Audience / Persona**: German language teachers managing multiple student groups in Glück, and students or external participants opening shared homework links on mobile or desktop browsers.
- **Key Value**:
  - **Zero Privacy Leaks**: Never embeds or exposes the full student database (`dl_students`) or students from other groups in shared homework links or student-facing views.
  - **Collision-Free Identity**: Distinguishes two registered students who share the same name via `studentId`, and distinguishes two open participants who type the same name via `participantId`.
  - **Honest Cloud Sync**: Confirms Firestore and API writes before reporting success, and clearly warns the teacher or student when a save is stored locally pending connection recovery.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Teacher Homework Creation**:
     - Inside the Homework Creation panel, the ambiguous group dropdown is replaced with a compact two-option segmented audience selector:
       - **مفتوح لأي اسم (`open`)**: Hides the group dropdown, never attaches any student roster, and saves `audienceMode: 'open'`.
       - **جروب معين (`group`)**: Displays the teacher's active groups dropdown. Selecting a group is mandatory before creating the assignment and snapshots only that group's active (non-deleted, non-archived) students (`id`, `name`, `code`, `groupId`).
  2. **Student-Facing Entry Gate**:
     - **Open Mode (`open`)**: Immediately presents the clean manual name input (`"اكتب اسمك للبدء وتسجيل نتيجتك"`). Never displays any student cards, even if opened on the teacher's own browser.
     - **Specific Group Mode (`group`)**: Displays selectable student cards exclusively for the assigned group (`"اختر اسمك من قائمة المجموعة لبدء الواجب وتسجيل نتيجتك"`), along with the group badge. Manual name entry is completely disabled. If the group roster is unavailable or empty, displays an explicit error state with a retry button.
  3. **Teacher Follow-up Dashboard**:
     - **Group Mode View**: Displays the group name, audience badge (`جروب معين`), total group roster count, completed count, in-progress count, and not-started count (`لم يبدأ بعد`). Every student in the group is listed by their unique `studentId`.
     - **Open Mode View**: Displays the audience badge (`مفتوح لأي اسم`), total participant count, total attempts, and average score, listing each participant entry with their submitted name, attempt history, best score, latest score, and timestamps.
- **Visual Identity & Theme**:
  - Preserves Glück's existing German-studio dark/light aesthetic (`Plus Jakarta Sans` / `Cairo` Arabic typography, emerald/indigo semantic accents, hairline borders, and tabular numerals `tabular-nums` for scores, percentages, and attempt counters).
- **Interactive Feedback & Motion**:
  - Immediate validation feedback if a teacher tries to create a Group homework without selecting a group or if the selected group has zero active students.
  - Explicit sync badge on created assignments (`تم الحفظ سحابياً` vs. `محفوظ محلياً فقط — بانتظار المزامنة`) so teachers know whether a link is ready for remote students.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Strict Audience Mode Resolution & Share Link Encoding**
  - *Chosen Approach*: Persist `audienceMode: 'open' | 'group'` on both `HomeworkAssignment` and `HomeworkSubmission`. Include `am` (`audienceMode`) and `gid` (`groupId`) in the share URL parameters. If a student opens a share link with `am=group` and the cloud/server assignment record cannot be fetched, the player refuses to construct a fake open assignment from URL parameters and instead shows the roster load error.
  - *Why*: Previously, when Firestore was unreachable or slow, the URL query fallback created a temporary assignment with an empty `assignedStudents` array, tricking the UI into rendering the `"اكتب اسمك"` manual input for a restricted group homework.
  - *Alternatives Considered*: Embedding the full group student list inside the URL query string was rejected because it bloats share URLs and exposes student names in plain URL text.

- **Decision 2 — Identity Keying in Roster & Submission Aggregation**
  - *Chosen Approach*: Refactor submission deduplication and dashboard aggregation to key registered group students strictly by `id:${studentId}` and open participants by `pid:${participantId}` (falling back to legacy submission IDs only for historical pre-repair records).
  - *Why*: Keying the follow-up roster map by `studentName.toLowerCase()` caused two students with the same name—or an external participant and a registered student—to overwrite each other's scores and attempts.
  - *Alternatives Considered*: Disallowing duplicate student names at registration was rejected because real classrooms frequently have students with identical first or full names.

- **Decision 3 — Multi-Layer Group Membership Validation**
  - *Chosen Approach*: Enforce group membership validation across three layers: (1) Student Player UI before starting/submitting, (2) Client Sync Engine (`validateHomeworkSubmissionIdentity`), and (3) Express API (`/api/homework/submit` and `/api/homework/submissions`) when the assignment exists on the server.
  - *Why*: Prevents forged requests, stale tab state, or manipulated payloads from recording a submission under an unauthorized name or foreign `studentId` in a group-restricted assignment.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   TEACHER HOMEWORK CREATION & FOLLOW-UP                    │
│  ┌──────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │Audience Selector                 │  │Follow-Up Dashboard             │  │
│  │• Mode A: مفتوح لأي اسم ('open')   │  │• Group Mode: Roster by         │  │
│  │  (No groupId, no student roster) │  │  studentId + Pending students  │  │
│  │• Mode B: جروب معين ('group')      │  │• Open Mode: Participants by    │  │
│  │  (1 groupId + group snapshot)    │  │  participantId + All attempts  │  │
│  └───────────────┬──────────────────┘  └───────────────▲────────────────┘  │
└──────────────────┼─────────────────────────────────────┼───────────────────┘
                   │ Confirmed Save                      │ ID-Keyed Sync
                   ▼                                     │
┌────────────────────────────────────────────────────────────────────────────┐
│                HOMEWORK SYNC & VALIDATION ENGINE                           │
│  • resolveAssignmentAudienceMode(hw): 'open' | 'group'                     │
│  • validateHomeworkSubmissionIdentity(hw, sub): Strict Mode/Group Check    │
│  • buildDeterministicSubmissionId(hwId, mode, studentId/participantId, n)  │
│  • Confirmed Firestore + Express API Persistence + Pending Retry Queue     │
└──────────────────┬─────────────────────────────────────▲───────────────────┘
                   │ Fetch Authoritative Assignment      │ Validated Submit
                   ▼                                     │
┌────────────────────────────────────────────────────────────────────────────┐
│                      STUDENT HOMEWORK PLAYER GATE                          │
│  ┌──────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │If audienceMode === 'open'        │  │If audienceMode === 'group'     │  │
│  │• Manual Name Input Only          │  │• Selectable Group Student Cards│  │
│  │• Per-Device participantId        │  │• Fail-Closed if Roster Missing │  │
│  │• Zero access to dl_students      │  │• Binds registered studentId    │  │
│  └──────────────────────────────────┘  └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`HomeworkAudienceMode`**: `'open' | 'group'`
- **`HomeworkAssignment`**:
  - `audienceMode?: HomeworkAudienceMode` — Explicitly stored on creation (`'open'` or `'group'`).
  - `groupId?: string` — Populated only when `audienceMode === 'group'`. Undefined in `'open'` mode.
  - `groupName?: string` — Populated only when `audienceMode === 'group'`. Undefined in `'open'` mode.
  - `assignedStudents?: AssignedStudentSnapshot[]` — Populated with the selected group's active students (`id`, `name`, `code`, `groupId`) only when `audienceMode === 'group'`. Undefined in `'open'` mode.
- **`HomeworkSubmission`**:
  - `audienceMode?: HomeworkAudienceMode` — Mirrors the assignment's mode.
  - `studentId?: string` — Required for `'group'` mode (must match a student in `assignedStudents`). Empty/undefined in `'open'` mode.
  - `participantId?: string` — Generated per browser/device for `'open'` mode so same-name participants on different devices never collide.
  - `studentName: string` — Registered student name in `'group'` mode; participant-entered name in `'open'` mode.
  - `groupId?: string` — Set to `assignment.groupId` in `'group'` mode.

### Interactive Component & State Mapping

1. **Audience Mode Resolution (`resolveAssignmentAudienceMode`)**:
   - Returns `'group'` if `hw.audienceMode === 'group'` or if `hw.groupId` is a non-empty string other than `'all'`.
   - Returns `'open'` if `hw.audienceMode === 'open'` or if no specific `groupId` is present (automatically migrating legacy general assignments to `'open'` and ignoring any legacy full-database `assignedStudents` snapshot).
2. **Student Gate Isolation**:
   - Removes all `localStorage.getItem('dl_students')` reads from the student homework player.
   - In `'group'` mode, filters `assignment.assignedStudents` by `assignment.groupId` (when `groupId` is present on snapshot entries) and requires a non-empty roster; if the URL fallback is triggered for a `'group'` link (`am=group`) because the cloud/server fetch failed, sets an explicit error state rather than rendering a group-less fallback assignment.
3. **Submission Identity Validation (`validateHomeworkSubmissionIdentity`)**:
   - For `'group'` assignments: Verifies `studentId` is non-empty, exists in `assignment.assignedStudents`, matches the registered student's name and `groupId`, and rejects manual or mismatched identities.
   - For `'open'` assignments: Verifies `studentName` is non-empty, ensures `participantId` is present, and clears any registered `studentId` or `groupId`.
4. **Follow-up Aggregation (`fetchAssignmentDetailsWithSync` & `syncAndFetchTeacherAssignments`)**:
   - **Group Mode**: Builds the student roster strictly from `assignment.assignedStudents` merged with active students in `dl_students` whose `groupId === assignment.groupId`, keyed by `id:${student.id}`. Matches submissions by `studentId` (with a guarded fallback for pre-repair historical submissions on that group that lacked `studentId`). Computes `completed`, `in_progress`, and `not_started` counts accurately.
   - **Open Mode**: Ignores `dl_students` and group rosters completely. Groups submissions by `pid:${submission.participantId}` (or `sub:${submission.id}` / normalized legacy key when `participantId` is absent on old records) so every participant and their multiple attempts appear in the dashboard without merging two different people who entered the same name.
