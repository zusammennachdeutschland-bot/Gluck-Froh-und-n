# Implementation Plan: Unified Lesson Cycle Numbering (Glück)

## 1. Root Cause Analysis

A code-level audit of `src/utils/lessonUtils.ts`, `src/context/AppContext.tsx`, and the lesson UI components identified the exact causes of cycle numbering discrepancies:

1. **Blind Trust in Stale Stored `lesson.sessionNumber` Values**:
   - `LessonReminderModal.tsx` (line 106), `ArabicParentReportModal.tsx` (line 184), `ParentSummaryModal.tsx` (line 49), `LessonControlModal.tsx` (line 509), and `TodaysProgressTimeline.tsx` (line 152) all check `if (typeof lesson.sessionNumber === 'number' && lesson.sessionNumber >= 1) return lesson.sessionNumber;` **before** invoking `calculateSequentialSessionNumber()`.
   - Inside `calculateSequentialSessionNumber()` (`src/utils/lessonUtils.ts`, lines 184–191), it also immediately returns `lesson.sessionNumber` whenever `1 <= lesson.sessionNumber <= cycleTotalSessions` unless `forceRecalculate: true` is passed.
   - Even when `forceRecalculate: true` is passed (`src/utils/lessonUtils.ts`, lines 253–262), `calculateSequentialSessionNumber()` walks backward (`for (let i = index - 1; i >= 0; i--)`) and anchors off the nearest preceding lesson's stored `prev.sessionNumber`, propagating stale or corrupted session numbers forward to all subsequent lessons.

2. **Cancelled Lessons Counted During Schedule Generation & Startup**:
   - `AppContext.tsx` auto-generation loop (lines 2496–2501 & 2549) counts `groupLessonCounts` over all `!l.deleted` lessons **without excluding `l.status === 'cancelled'`**.
   - `AppContext.tsx` `updateGroup` regeneration loop (line 3006) counts `pastGroupLessonsCount` over `!l.deleted` lessons **without excluding `l.status === 'cancelled'`**, and lines 3134–3148 / 3209–3223 reset `upcomingScheduled` starting from `mergedStartingNumber` (`idx = 0`) while ignoring already-completed lessons in the current cycle.
   - `AppContext.tsx` `addLesson` (line 4558) assigns `getGroupCycleInfo(targetGroup, activeLessons).currentSessionNumber` based on total active lessons count rather than the chronological position of the newly added lesson.
   - `AppContext.tsx` `saveLessonReport` (line 4740) falls back to `targetLesson.sessionNumber || 1` instead of resolving the authoritative sequential session number when `sessionNumber` is not explicitly passed.

3. **Modal State Desynchronization & Non-Chronological Target Selection in `LessonReminderModal.tsx`**:
   - Line 52 selects `upcomingLesson` via `.find(...)` without sorting chronologically, which can pick a later scheduled lesson instead of the nearest upcoming one when opened from a Group card.
   - Line 206 initializes `useState<number>(defaultSessionNumber)` once on mount without a `useEffect` to stay synchronized when `currentTargetLesson`, `lessons`, or `defaultSessionNumber` updates, and clicking `+` / `-` in `LessonReminderModal` only changes local preview state without persisting to the lesson or resequencing subsequent scheduled lessons.

4. **Missing Deterministic Tie-Breaking & Incomplete Resequencing**:
   - `calculateSequentialSessionNumber()` sorts only by `${date}T${time}` without a deterministic tie-breaker (`createdAt`, then `id`) when two lessons share the same date and time.
   - `resequenceScheduledLessonsAfterChange()` only resequences lessons with `lTime >= pivotTime`, leaving earlier misnumbered lessons intact and anchoring off them.

---

## 2. Authoritative Numbering Architecture (`src/utils/lessonUtils.ts`)

### 2.1 Single Authoritative Function: `resolveLessonCycleNumber` & `calculateSequentialSessionNumber`
We will implement `resolveLessonCycleNumber(targetLesson, allLessons, options)` in `src/utils/lessonUtils.ts` and route `calculateSequentialSessionNumber` through it as the single source of truth across the entire application:

- **Return Signature**:
  ```ts
  export interface LessonCycleResolution {
    sessionNumber: number;         // 1..totalCycleSessions (or 0 if targetLesson is cancelled/deleted)
    totalCycleSessions: number;    // 1 for per-lesson, otherwise package size (e.g. 4, 8)
    cycleIndex: number;            // 0-based cycle number (0, 1, 2, ...)
    sequenceIndex: number;         // 0-based index among valid chronological lessons
    isPerLesson: boolean;
  }
  ```
- **Strict Filtering Rules**:
  - Exclude any lesson where `l.deleted === true`.
  - Exclude any lesson where `l.status === 'cancelled'`.
  - Match lessons belonging to the same scope:
    - **Group scope**: match by `groupId` (or normalized `groupName` fallback when `groupId` is legacy/name-based).
    - **Individual / Private Student scope**: match by `studentId` (or normalized `studentName` fallback) where lessons do not belong to a separate group.
- **Deterministic Chronological Ordering**:
  1. Primary sort: normalized `date` (`YYYY-MM-DD`) + normalized `time` (`HH:MM`, defaulting to `'00:00'`).
  2. Secondary tie-breaker: `createdAt` / `updatedAt` timestamp if available, followed by deterministic lexical comparison on `id` (`(a.id || '').localeCompare(b.id || '')`).
- **Pure Chronological Cycle Formula**:
  - For per-lesson groups/students (`isPerLesson === true`): `sessionNumber = 1`, `totalCycleSessions = 1`.
  - For package/cycle groups/students (`totalCycleSessions = group.sessionCount || student.bundleSize || targetLesson.totalSessionsInPackage || 4`):
    - Let `startingSessionNumber = clamp(group?.startingSessionNumber || 1, 1, totalCycleSessions)`.
    - For a non-cancelled, non-deleted lesson at chronological `sequenceIndex` ($0, 1, 2, \dots$):
      $$\text{sessionNumber} = ((\text{startingSessionNumber} - 1 + \text{sequenceIndex}) \bmod \text{totalCycleSessions}) + 1$$
    - Does **not** blindly trust stale stored `lesson.sessionNumber` values unless an explicit manual override anchor is being applied via resequencing.

### 2.2 Full-Scope Resequencing (`resequenceScheduledLessonsAfterChange`)
We will upgrade `resequenceScheduledLessonsAfterChange` in `src/utils/lessonUtils.ts` so that whenever any lesson in a group or private student scope is created, completed, cancelled, un-cancelled, deleted, restored, or rescheduled:
- All non-deleted, non-cancelled lessons in that group/student scope are sorted using the deterministic chronological comparator.
- Every lesson in the scope has its `sessionNumber` and `totalSessionsInPackage` synchronized to the authoritative chronological sequence (or anchored from `startingSessionNumber`), ensuring zero gaps, zero duplicates, and immediate consistency between stored `lesson.sessionNumber` and calculated `resolveLessonCycleNumber()`.
- When a teacher explicitly sets a manual session number $M$ on a specific lesson $L_k$ (in `LessonReminderModal`, `LessonControlModal`, or `GroupProfileModal`), the group's effective `startingSessionNumber` (or sequence offset so $L_k$ has session number $M$) is updated and all non-cancelled lessons in the scope are deterministically resequenced so the entire timeline remains continuous.

### 2.3 Consistent `getGroupCycleInfo`
We will update `getGroupCycleInfo(group, lessons, lang)` in `src/utils/lessonUtils.ts` so its `currentSessionNumber` and badge text use the exact same chronological non-cancelled sequence and `startingSessionNumber` offset as `resolveLessonCycleNumber`.

---

## 3. Lifecycle & Mutation Synchronization (`src/context/AppContext.tsx`)

Without touching any financial, payment, or billing logic, we will unify every lesson mutation path in `src/context/AppContext.tsx` to use the authoritative numbering engine:

1. **Startup Synchronization (`useEffect` lines 1054–1095)**:
   - Replace the inline loop that trusted `hasValidSessionNumber` with `resequenceScheduledLessonsAfterChange` / `resolveLessonCycleNumber` so any stale stored `sessionNumber` values from previously cancelled/deleted lessons are automatically healed on startup.
2. **Rolling 14-Day Auto-Generation (`useEffect` lines 2496–2575)**:
   - Exclude `l.status === 'cancelled'` when counting existing lessons and run `resequenceScheduledLessonsAfterChange` on the group's lessons when new auto-generated lessons are inserted.
3. **Group Update & Schedule Regeneration (`updateGroup`, lines 3005–3245)**:
   - Exclude `l.status === 'cancelled'` from `pastGroupLessonsCount` and resequence the group's non-cancelled lessons cleanly across the entire timeline so completed and upcoming scheduled lessons form a continuous cycle (`1..sessionCount`).
4. **Lesson Creation (`addLesson`, lines 4530–4587 & `generateGroupScheduleLessons`, lines 5242–5360)**:
   - Insert the new lesson(s) and resequence the group/student scope via `resequenceScheduledLessonsAfterChange` so lessons added on any date (including backdated or multi-week lessons) receive their exact chronological cycle number and shift subsequent lessons accordingly.
5. **Lesson Update, Cancellation, Deletion, and Restoration (`updateLesson`, `cancelLesson`, `deleteLesson`, `restoreItem`, `saveLessonReport`)**:
   - Ensure `deleteLesson` resequences regardless of whether the deleted lesson was `scheduled` or `completed`.
   - Ensure `restoreItem` (when restoring a lesson or group from Recently Deleted) triggers `resequenceScheduledLessonsAfterChange` for the affected group/student.
   - Ensure `saveLessonReport` resolves the authoritative session number via `resolveLessonCycleNumber` (when no manual override is supplied) and resequences subsequent lessons.

---

## 4. UI Component Unification

All UI surfaces will read from `resolveLessonCycleNumber` / `calculateSequentialSessionNumber` without blindly short-circuiting on a stale `lesson.sessionNumber`:

1. **`src/components/LessonReminderModal.tsx`**:
   - Sort candidate scheduled/in-progress lessons chronologically when resolving `upcomingLesson` for a group.
   - Compute `defaultSessionNumber` and `totalCycleSessions` via `resolveLessonCycleNumber(currentTargetLesson, lessons, { group: targetGroup, student: targetStudent, students })`.
   - Add a `useEffect` to keep `sessionNumber` synchronized whenever `currentTargetLesson?.id`, `defaultSessionNumber`, or `totalCycleSessions` changes.
   - When the teacher clicks `-` or `+` to manually adjust `sessionNumber`, persist the adjusted number to the lesson and resequence subsequent scheduled lessons in the group/student scope (matching `LessonControlModal` behavior).
2. **`src/components/ArabicParentReportModal.tsx`**:
   - Remove the short-circuit `if (typeof lesson.sessionNumber === 'number' && lesson.sessionNumber >= 1) return lesson.sessionNumber;` in `effectiveSessionNumber` and always resolve through `resolveLessonCycleNumber()`.
3. **`src/components/ParentSummaryModal.tsx`**:
   - Remove the short-circuit on `lesson.sessionNumber` in `effectiveSessionNumber` and always resolve through `resolveLessonCycleNumber()`.
4. **`src/components/LessonControlModal.tsx`, `src/components/TodaysProgressTimeline.tsx`, and `src/components/GroupProfileModal.tsx`**:
   - Use `resolveLessonCycleNumber` as the default session number instead of preferring a potentially stale `selectedLesson.sessionNumber`, while preserving `customSessionNumber` manual adjustments.

---

## 5. Automated Verification Plan (`src/tests/lessonCycleNumbering.test.ts`)

We will create a dedicated test suite `src/tests/lessonCycleNumbering.test.ts` verifying all 16 mandatory scenarios (`TEST A` through `TEST P`) and run the entire test suite (`npm test`), TypeScript check (`npm run typecheck`), `compile_applet`, and `lint_applet`:

- **TEST A**: Basic 4-lesson cycle (`1, 2, 3, 4`).
- **TEST B**: Cancelled lesson in the middle (`completed #1`, `cancelled` excluded, `scheduled #2, #3, #4`).
- **TEST C**: Multiple cancelled lessons (`completed #1`, `cancelled`, `cancelled`, `scheduled #2`).
- **TEST D**: Cancelled first lesson (`cancelled` excluded, next lessons `#1, #2`).
- **TEST E**: Un-cancelling a cancelled lesson restores its number and shifts subsequent scheduled lessons (`#2, #3`).
- **TEST F**: Deleting a scheduled lesson shifts later scheduled lessons (`#2, #3`).
- **TEST G**: Restoring a soft-deleted lesson restores its position and shifts subsequent lessons.
- **TEST H**: Cycle rollover across 8 lessons in a 4-session package (`1, 2, 3, 4, 1, 2, 3, 4`).
- **TEST I**: Cycle rollover with a cancelled lesson (`5th` active lesson becomes `#1` of Cycle 2).
- **TEST J**: Custom `startingSessionNumber = 3` (`3, 4, 1, 2`).
- **TEST K**: Cross-modal consistency (`LessonReminderModal`, `ArabicParentReportModal`, and `ParentSummaryModal` all resolve the exact same session number and total cycle sessions for the same lesson).
- **TEST L**: Stale stored `sessionNumber = 3` on the 2nd active lesson (after a cancelled lesson) is repaired/resolved as `Session 2 of 4` everywhere.
- **TEST M**: Per-lesson group (`isGroupPerLesson`) always resolves `1 of 1`.
- **TEST N**: Individual student lessons without a group (`bundleSize = 4`) follow the same cycle and cancellation exclusion rules.
- **TEST O**: Rescheduling a lesson's date/time reorders and resequences the cycle numbers chronologically.
- **TEST P**: Two lessons on the same date (`10:00` and `18:00`, plus identical-time tie-breaking) are ordered deterministically.
