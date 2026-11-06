# Glück — Smart Data Cleanup & Lesson Optimization

An automated, safe data pruning and lesson lifecycle architecture for Glück. This reduces the database volume (from 2831+ lessons down to an optimal, lightweight footprint), speeds up multi-device synchronization, and enforces a strict rolling 14-day future window while guaranteeing 100% financial and student balance accuracy.

> [!IMPORTANT]
> **User Review & Confirmed Decisions**:
> 1. **Location of Controls & Preview**: Dedicated Card in **Settings** (`SettingsView.tsx`) and **Smart Backup Center** (`SmartBackupCenter.tsx`).
> 2. **Automatic Maintenance**: Runs automatically once per day in the background and on app startup.
> 3. **Safety Backup**: Saved internally in the Smart Backup Center and instantly downloadable as a timestamped JSON file (`glueck-lessons-backup-YYYY-MM-DD.json`) before any destructive action.
> 4. **Financial Invariance Guarantee**: No financial transaction (`financeTransactions`), student payment record (`payments`), or balance calculation is ever modified or deleted. Deleting an old fully settled lesson never decreases revenue or alters student ledger balances.

---

## 1. Overview & Core Concept

Currently, the auto-generator in `AppContext.tsx` projects recurring group schedules for **365 days into the future** (`dayOffset < 365`), generating over 2,400 unneeded future placeholder lessons. Simultaneously, historical completed lessons accumulate indefinitely.

### Core Objectives:
1. **14-Day Rolling Future Window**: Restrict automatic lesson generation from 365 days down to **14 days**. Each day, as time advances, automatically generate the next day's recurring lessons, maintaining exactly a 14-day horizon without duplicates.
2. **30-Day Historical Retention**: Clean historical lessons completed more than 30 days ago, **provided they are fully paid and have zero outstanding student balances**.
3. **Strict Financial & Debt Preservation**:
   - Any lesson with `paymentStatus !== 'paid'` (e.g. `pending`, `partial`, `overdue`), or with any student having an unpaid attendance report, is **strictly preserved**.
   - Individual 1-on-1 lessons (online or offline) are only pruned if 100% paid and older than 30 days.
   - All financial ledgers (`dl_finance_transactions`, `dl_payments`, `dl_finance_accounts`) remain permanently untouched.
4. **Pre-Cleanup Safety & Preview**:
   - Provide an interactive preview modal showing exact counts of lessons to be removed vs preserved.
   - Run an automated invariant audit verifying that `Total Revenue`, `Total Payments`, and `Student Unpaid Balances` are byte-for-byte identical before and after cleanup.
   - Generate an automated backup archive before performing any deletion.
5. **Sync Integrity Across Devices**:
   - Ensure pruned lesson IDs are tracked in tombstones (`dl_pruned_lesson_ids`) so old Firestore chunks or device caches cannot re-resurrect deleted lessons during synchronization.

---

## 2. Technical Architecture & Component Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Glück Storage & Sync Engine                           │
│                                                                             │
│  LocalStorage / Capacitor Storage            Google Cloud Firestore Sync    │
│  ┌──────────────────────────────┐            ┌───────────────────────────┐  │
│  │ dl_lessons (2831 -> ~350)    │◄──────────►│ /user_workspaces/{uid}/   │  │
│  │ dl_payments (320 intact)     │            │   categories/lessons      │  │
│  │ dl_finance_transactions (420)│            └───────────────────────────┘  │
│  │ dl_pruned_lessons_archive    │                          ▲                │
│  └──────────────────────────────┘                          │                │
└─────────────────────────────────▲──────────────────────────┼────────────────┘
                                  │                          │
                   ┌──────────────┴──────────────────────────┴────────┐
                   │                                                  │
┌──────────────────┴──────────────────────┐  ┌────────────────────────┴──────────────┐
│  Lesson Lifecycle & Maintenance Service │  │  UI Controls & Pre-Cleanup Preview    │
│  (src/services/lessonCleanupService.ts) │  │  (src/components/SmartDataCleanupCard)│
│                                         │  │                                       │
│  • Rolling 14-day future generator      │  │  • Settings & Smart Backup Center view│
│  • 30-day historical eligibility audit  │  │  • Breakdown: To Delete vs To Keep   │
│  • Invariant balance & revenue checker  │  │  • One-click Download Backup (.json)  │
│  • Automated daily startup maintenance  │  │  • Safe "Execute Cleanup" action      │
└─────────────────────────────────────────┘  └───────────────────────────────────────┘
```

---

## 3. Data Strategy & Invariant Rules

### A. The 14-Day Future Rolling Window
In `src/context/AppContext.tsx`, update the auto-generator from:
```ts
// Old: 365 days
for (let dayOffset = 0; dayOffset < 365; dayOffset++)
```
to:
```ts
// New: Exactly 14 rolling days
const FUTURE_HORIZON_DAYS = 14;
for (let dayOffset = 0; dayOffset <= FUTURE_HORIZON_DAYS; dayOffset++)
```
- Existing auto-generated lessons beyond `today + 14 days` that have not been started, completed, or manually edited are categorized as **Prunable Future Bloat**.
- Manually created or confirmed lessons (those with custom titles, non-auto IDs, reports, or explicit teacher notes) are **never pruned**, regardless of date.

### B. The 30-Day Historical Pruning Rules
A historical lesson ($Date < Today - 30\text{ days}$) is **eligible for cleanup ONLY IF ALL of the following criteria are met**:
1. **Status is Completed**: `lesson.status === 'completed'`.
2. **Fully Settled Financially**:
   - `lesson.paymentStatus === 'paid'`.
   - AND every student in `lesson.studentPayments` (or `lesson.report.studentPayments`) has `status === 'paid'` or `paymentStatus === 'paid'`.
   - AND no student attending this lesson has an unpaid charge tied to it.
3. **No Active Disputes or Packages**: Not part of an unfinished multi-lesson package that is awaiting final billing.
4. **Never Delete**:
   - Any lesson with `paymentStatus === 'pending'`, `'partial'`, or `'unpaid'`.
   - Any lesson where any student's payment is pending.
   - Any lesson with an open report or unresolved attendance.

### C. Financial & Balance Invariant Check
Before any batch deletion, the engine calculates:
$$\text{Audit Pre-Check} = (\text{Total Revenue}_{\text{pre}}, \text{Unpaid Balances}_{\text{pre}}, \text{Student Payments}_{\text{pre}})$$
$$\text{Audit Post-Check} = (\text{Total Revenue}_{\text{post}}, \text{Unpaid Balances}_{\text{post}}, \text{Student Payments}_{\text{post}})$$
If $\text{Audit Pre-Check} \neq \text{Audit Post-Check}$, the operation is **aborted immediately** with an error banner, guaranteeing zero data or financial loss.

---

## 4. User Experience & Interface Design

### A. Smart Data Cleanup Card (`SmartDataCleanupCard.tsx`)
- Displayed in:
  1. `SettingsView.tsx`: Integrated cleanly under the Cloud Sync and Backup sections.
  2. `SmartBackupCenter.tsx`: Highlighted at the top as the primary optimization tool.
- Visuals (Glück Design Constitution compliant):
  - Compact container: `bg-surface border border-surface-border rounded-xl p-4 shadow-xs`.
  - Unboxed metric row with `·` separators:
    `2831 Lektionen gesamt · ~2150 bereinigbar · ~680 aktiv & geschützt`.
  - Action buttons:
    - `Vorschau & Prüfung` (Preview & Audit).
    - `Sicherung herunterladen` (Download Backup .json).
    - `Automatische Wartung aktiv (14 Tage)` toggle/badge.

### B. Interactive Pre-Cleanup Audit Modal
- Opens before any deletion is executed.
- Displays:
  - **Prunable Historical** ($>30$ days, 100% paid): e.g. 180 lessons.
  - **Prunable Future Bloat** ($>14$ days, unconfirmed recurring): e.g. 1970 lessons.
  - **Protected Records** (unpaid, within 30 days, or manual): e.g. 681 lessons.
  - **Financial Safety Verification**: A green check showing:
    - *Gesamtumsatz unverändert* (Revenue unchanged).
    - *Schülersalden 100% identisch* (Student balances 100% identical).
    - *Zahlungshistorie vollständig gesichert* (320 payment records untouched).
  - Prominent download button for the JSON backup archive.
  - Red/Primary confirmation button: `Bereinigung jetzt sicher ausführen` (Execute Safe Cleanup).

---

## 5. Implementation Steps

1. **Build `lessonCleanupService.ts`**:
   - Create functions:
     - `analyzeLessonPruning(lessons, groups, students, payments, financeTransactions)`
     - `performLessonCleanup(...)`
     - `exportPrunedLessonsBackup(...)`
     - `runAutomatedDailyMaintenance(...)`
2. **Update `AppContext.tsx` Auto-Generator**:
   - Cap future generation window to `14 days`.
   - Hook automated maintenance into daily startup routine.
3. **Build `SmartDataCleanupCard.tsx` & Modal**:
   - Render preview stats, financial verification, backup download, and manual trigger.
4. **Integrate into `SettingsView.tsx` and `SmartBackupCenter.tsx`**:
   - Mount the card in both locations.
5. **Verify Synchronization (`firebaseWorkspaceSync.ts`)**:
   - Ensure pruned lesson removals properly sync to Firestore without re-importing old chunks.
6. **Compile & Lint Verification**:
   - Run `compile_applet` and `lint_applet` to ensure zero regressions.
