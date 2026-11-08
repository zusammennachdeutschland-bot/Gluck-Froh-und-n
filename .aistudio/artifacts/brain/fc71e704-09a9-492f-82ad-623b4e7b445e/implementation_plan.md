# Glück — Terminal Permanent Deletion & Bidirectional Multi-Device Sync Architecture

This architectural plan establishes a clock-independent, fail-closed permanent deletion and bidirectional synchronization engine across Google Cloud Firestore, WebRTC/HTTP P2P peers, and JSON Backup pipelines without altering existing UI workflows or wiping user workspaces.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural invariants have been confirmed and govern all synchronization, restoration, and backup boundaries:

- **Confirmed Decision 1 (Terminal Permanent Purge)**: Once an item is permanently purged from Recently Deleted, its `PurgedRecordTombstone` is strictly terminal for that entity ID. Only soft-deleted items in Recently Deleted can be restored. Any incoming active or soft-deleted record matching a purged ID is unconditionally suppressed regardless of device clock skew or local revision counters.
- **Confirmed Decision 2 (Partial Cloud Snapshot Handling)**: When a Cloud workspace download or delta contains entity categories without the `profile_settings` tombstone category, local authoritative tombstones are enforced immediately and unknown conflicting records are safely deferred until tombstone metadata is verified.
- **Confirmed Decision 3 (Cascade Tombstone Scope & Financial Preservation)**: Permanently deleting a Group cascades purge tombstones to its linked Students and Lessons; permanently deleting a Student cascades purge tombstones to its linked Lessons. All Payments and Finance Transactions are strictly preserved to maintain historical financial integrity.

---

## 1. Overview & Core Concept

- **What It Does**: Eliminates zombie record resurrection and stale-device overwrites by making permanent deletion tombstones (`PurgedRecordTombstone`) a terminal, clock-independent absorbing state in the synchronization lattice, while enforcing reverse cleanup of existing local active records whenever tombstones arrive via Cloud, P2P, or Backup import.
- **Target Audience / Persona**: Teachers and department heads running Glück across multiple devices (Android, desktop, web) with intermittent offline periods and unsynchronized device clocks.
- **Key Value**: Guarantees deterministic convergence across all devices—no permanently deleted student, group, or lesson can ever return from an offline peer, a skewed device clock, an out-of-order Cloud chunk, or an older backup file, while valid edits and financial records remain 100% intact.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Soft Delete & Legitimate Restore**: Moving a Student, Group, or Lesson to Recently Deleted marks it soft-deleted (`deleted: true`) and stores a `DeletedItem<T>` wrapper. Restoring from Recently Deleted while the item is not permanently purged cleanly re-activates the record (`deleted: false`) and increments its revision.
  2. **Permanent Deletion & Empty Recycle Bin**: Clicking "Delete Permanently" or "Empty Recycle Bin" generates immutable `PurgedRecordTombstone` entries for the target record and its dependent child records (Group $\rightarrow$ Students & Lessons; Student $\rightarrow$ Lessons), immediately sweeps active and historical collections to remove any lingering copies, and broadcasts the tombstones on the next Cloud or P2P sync.
  3. **Cross-Device Convergence**: When another device receives a delta or snapshot containing purge tombstones, any matching local active or soft-deleted records are immediately purged from memory and local storage, and UI views refresh seamlessly without manual intervention.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Preserves the existing utilitarian SaaS classroom workspace layout, sidebar navigation, and dual-theme (Light / Dark / AMOLED / Tinted) token system without visual disruption.
  - *Color Palette & Mood*: Retains existing semantic status tokens (`#16A34A` nominal, `#D97706` warning, `#DC2626` destructive purge actions) and neutral slate surfaces (`--background`, `--primary`, `--accent`).
  - *Typography & Hierarchy*: Maintains crisp sans-serif UI labels paired with `tabular-nums` alignment for financial ledgers, session counters, and sync history timestamps.
  - *Component Styling & Layout*: Zero modifications to existing component layouts, navigation order, or bundled `DEFAULT_LERNSTUDIO_SETS`.
- **Interactive Feedback & Motion**: Existing toast confirmations, modal transitions, and live sync status indicators operate within $\le 200\text{ms}$ response budgets.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Terminal Absorbing State for Permanent Purge (Clock-Independent Precedence)**
  - *Chosen Approach*: In `mergeEntities()`, `mergeRecentlyDeleted()`, and centralized workspace enforcement, the presence of a valid `PurgedRecordTombstone` for an ID unconditionally dominates and suppresses any local or incoming record with that ID—completely removing the `incomingTime <= purgedTime` timestamp gate.
  - *Why*: Device clocks are not globally synchronized. A stale offline device whose clock is set 10 minutes or 10 days ahead would otherwise defeat `incomingTime <= purgedTime` and resurrect purged records. Because permanent purge is terminal for an ID, any record bearing a purged ID is causally stale by definition.
  - *Alternatives Considered*: Vector clocks or signed restore tokens were evaluated, but since permanent deletion from the recycle bin is an intentional terminal action, terminal ID dominance is simpler, faster, and mathematically immune to clock drift.

- **Decision 2: Bidirectional Tombstone Enforcement (Filtering Incoming + Sweeping Existing Active Records)**
  - *Chosen Approach*: Introduce a centralized `enforcePurgedTombstonesOnWorkspace()` engine alongside `mergeEntities()`. Whenever `mergeEntities(localArray, incomingArray, options)` runs, it strips purged IDs from **both** `localArray` (initial `entityMap` population) and `incomingArray`,even when `incomingArray` is empty. Furthermore, whenever tombstones are merged in Cloud, P2P, Backup, or Startup hydration, the centralized sweeper removes matching active records and orphaned dependents across all collections before persisting.
  - *Why*: Previously, if `incomingArray` was empty for `students` (e.g., a tombstone-only delta arrived in `settings`), `mergeEntities` wasn't even called for `students`, leaving the existing active student in local storage. Sweeping both during `mergeEntities` and at the workspace level guarantees immediate removal in both directions.
  - *Alternatives Considered*: Relying solely on UI-level filtering (`getActiveRecords`) was rejected because uncleaned records in storage would still be re-uploaded or affect calculations.

- **Decision 3: P2P Dedicated Tombstone Envelope & Outbound Settings Inclusion**
  - *Chosen Approach*: Attach authoritative `purgedRecords` directly to `SyncDeltaPayload` (and always include the `singleton_teacher_settings` tombstone state in outbound P2P deltas whenever tombstones exist or changed), and in `runSyncCycle()` / `handleInboundExchange()` merge tombstones **first**, sweep existing local active collections (`groups`, `students`, `lessons`, `schoolNotes`, `homeworkAssignments`, `homeworkSubmissions`), and withhold watermark acknowledgement for any record deferred due to missing deletion metadata.
  - *Why*: Legacy v1 capability filters or partial deltas could omit `records.settings`, leaving a receiving peer blind to permanent deletions. Carrying tombstones at the protocol level and sweeping all affected local collections ensures P2P peers converge even when no entity records are in the delta.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        GLÜCK SYNCHRONIZATION ENGINE                        │
└────────────────────────────────────────────────────────────────────────────┘
          │                                 │                         │
          ▼                                 ▼                         ▼
┌───────────────────┐             ┌───────────────────┐     ┌───────────────────┐
│ Google Cloud Sync │             │  P2P WebRTC/HTTP  │     │  Backup Pipeline  │
│ (Firestore+Relay) │             │ (SyncOrchestrator)│     │ (Export / Import) │
└─────────┬─────────┘             └─────────┬─────────┘     └─────────┬─────────┘
          │                                 │                         │
          │ 1. Merge Tombstones First       │ 1. Extract & Merge      │ 1. Sanitize &
          │ 2. Guard Partial Snapshots      │    Purged Tombstones    │    Export/Import
          │                                 │                         │    recentlyDeleted
          └─────────────────┬───────────────┴─────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             CENTRALIZED TOMBSTONE & MERGE ENFORCEMENT LAYER                │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 1. mergePurgedTombstones(localPurged, incomingPurged)                │  │
│  │    • Union by ID + Cascade Expansion (Group -> Students & Lessons)   │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ 2. mergeEntities(localArray, incomingArray, { purgedRecords })       │  │
│  │    • Terminal ID Dominance: Rejects Purged IDs regardless of clock   │  │
│  │    • Reverse Sweep: Purges matching IDs already in localArray        │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ 3. enforcePurgedTombstonesOnWorkspace(workspace, purgedRecords)      │  │
│  │    • Sweeps active & historical collections (Groups, Students,       │  │
│  │      Lessons, Notes, Homework) even when collection delta is empty   │  │
│  │    • Preserves Payments, Finance Transactions & Built-in Lernstudio  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            PERSISTENT LOCAL STORAGE & REACT STATE (AppContext)             │
│    • Startup Hydration Sweep • Soft-Delete Restore Guard • Outbox Sync     │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`PurgedRecordTombstone`**: `{ id: string; type: 'student' | 'group' | 'lesson' | string; purgedAt: string; updatedAt: number; originRevision?: number; parentId?: string }`.
- **Terminal Precedence Rule**: For any entity $e$ with ID $id$, if $\exists t \in \text{purgedRecords}$ such that $t.\text{id} = id$, then $e$ is unconditionally excluded from active collections and soft-deleted recycle bin lists (`recentlyDeleted.students`, `groups`, `lessons`), regardless of $e.\text{updatedAt}$, $e.\text{version}$, or $e.\text{originRevision}$.
- **Cascade Referential Integrity Rule**:
  - If $g.\text{id} \in \text{PurgedGroups}$, any Student $s$ with $s.\text{groupId} = g.\text{id}$ and any Lesson $l$ with $l.\text{groupId} = g.\text{id}$ (or $l.\text{studentId} \in \text{PurgedStudents}$) are automatically synthesized into `purgedRecords` and removed from active collections, `fullLessonsRef`, and `recentlyDeleted`.
  - If $s.\text{id} \in \text{PurgedStudents}$, any Lesson $l$ with $l.\text{studentId} = s.\text{id}$ is automatically synthesized into `purgedRecords` and removed from active collections, `fullLessonsRef`, and `recentlyDeleted`.
  - Dependent `homeworkSubmissions` for purged students and `schoolNotes` linked exclusively to purged students/lessons/groups are marked deleted or filtered, while `payments` and `financeTransactions` are strictly preserved for accounting invariance.

### Interactive Component & State Mapping

1. **Central Merge & Sweeper Engine**:
   - Update `mergeEntities()` so `entityMap` filters out any `localItem` whose ID is in `purgedMap` before processing `incomingArray`, and if `incomingArray` is empty, still returns `localArray` filtered against `purgedMap`.
   - Remove the timestamp comparison `if (incomingTime <= purgedInfo.purgedTime)` inside `mergeEntities()` and `mergeRecentlyDeleted()`—any ID present in `purgedMap` is terminally rejected.
   - Export `enforcePurgedTombstonesOnWorkspace(workspaceState, purgedRecords)` to deterministically sweep `groups`, `students`, `lessons`, `recentlyDeleted`, and cascade-linked child records, returning both the cleaned collections and the expanded `purgedRecords` list (including cascade tombstones discovered from existing local dependent records).
2. **Local Deletion, Restoration & Startup Hydration**:
   - In `permanentlyDeleteItem()` and `clearRecentlyDeleted()`, inspect **both** `recentlyDeleted` AND active state (`students`, `groups`, `fullLessonsRef.current`) when generating cascade tombstones so that dependent records that were not in `recentlyDeleted` also receive explicit tombstones and are immediately removed from active state and storage.
   - In `restoreItem()`, block restoration if the target ID is already present in `recentlyDeleted.purgedRecords` (enforcing terminal permanent purge), and for valid soft-deleted items, restore with `wrapMutation({ ...target.item, deleted: false })` without mutating or deleting any `purgedRecords`.
   - On startup initialization in `AppContext` (and after `importBackupFile`), run `enforcePurgedTombstonesOnWorkspace` against hydrated `groups`, `students`, and `lessons` so persisted tombstones always clean local state after app restart.
3. **Google Cloud Sync Hardening**:
   - Ensure `downloadWorkspaceFromGoogleCloud()` loads local tombstones (`dl_recently_deleted`) as a baseline floor before reassembling categories. If `profile_settings` is missing or fails chunk reassembly in a partial snapshot, retain local `recentlyDeleted.purgedRecords` and defer unseen remote active records from entering the workspace until tombstone metadata is available, while immediately enforcing known local + remote tombstones across all downloaded categories and `delta_log` via `enforcePurgedTombstonesOnWorkspace()`.
   - In `applyDeltaOnWorkspace()`, merge `recentlyDeleted` first, run `enforcePurgedTombstonesOnWorkspace()` across all collections in `baseObj` (even collections not present in `deltaObj`, so a tombstone arriving in `deltaObj.recentlyDeleted` deletes existing active records in `baseObj.students`, `baseObj.groups`, and `baseObj.lessons`), and then merge incoming entity arrays with `purgedRecords`.
4. **P2P Sync Hardening**:
   - Extend `SyncDeltaPayload` with an optional top-level `purgedRecords?: PurgedRecordTombstone[]` field populated by `buildOutboundDelta()` from `localData.settings[0]?.recentlyDeleted?.purgedRecords` so tombstones travel with every P2P delta even if `settings_sync` capability is not negotiated or `settings` was not modified in the same tick.
   - In `runSyncCycle()` and `handleInboundExchange()`, combine local tombstones, `inboundDelta.purgedRecords`, and `inboundDelta.records.settings[0]?.recentlyDeleted?.purgedRecords`. Merge and persist `settings` / `recentlyDeleted` first, run reverse tombstone enforcement across **all** local collections (`groups`, `students`, `lessons`) whenever any tombstones exist, and only advance peer watermarks for records that were validly processed.
5. **Backup Export, Validation & Import**:
   - In `exportBackupFile()`, include `recentlyDeleted`, `dismissedDashboardLessons`, `prunedLessonIds`, `goldHoldings`, `homeworkAssignments`, `homeworkSubmissions`, and `pickerNames` (matching `performBackup()`), using `fullLessonsRef.current` and `fullPaymentsRef.current`.
   - In `validateAndSanitizeBackupPayload()`, validate and sanitize `recentlyDeleted` (preserving `students`, `groups`, `lessons`, and `purgedRecords` arrays).
   - In `importBackupFile()`, merge `recentlyDeleted` only once at the start, combine local and imported `purgedRecords`, preserve existing local active records when importing partial or older backups instead of wiping non-deleted local items, and run `enforcePurgedTombstonesOnWorkspace()` across all collections before saving to storage.
6. **Production-Boundary Regression Test Suite**:
   - Expand the test suite to verify all 23 mandatory scenarios across unit, production-boundary integration, and mocked transport integration levels, accurately labeling every test and verifying `npm test`, `npm run typecheck`, and production build.
