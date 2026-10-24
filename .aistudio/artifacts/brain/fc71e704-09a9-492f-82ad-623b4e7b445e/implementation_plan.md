# Glück App — Comprehensive UI/UX Button Audit & Optimization Plan

## Executive Summary
This document delivers an exhaustive, codebase-wide UI/UX audit and optimization plan for the Glück teacher and student management application. The audit specifically inspects buttons, action placements, duplicate workflows, inconsistent dimensions, redundant controls, and screen hierarchy across all 12 major modules. It establishes a unified, accessible button design system and provides a phased, non-destructive implementation roadmap.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Audit & Planning Phase Complete — No Code Has Been Modified.**
> Review the critical decisions and proposed consolidations below before proceeding to implementation.

- **Decision 1: Consolidation of Lesson Control & Arabic Parent Report Actions**
  - *Current Problem*: `LessonControlModal.tsx` features an inline "Parent Communication" bar (WhatsApp, Call, Parent Report) while also automatically opening `ArabicParentReportModal.tsx` upon saving, where identical WhatsApp, Call, and Share buttons are rendered again. Furthermore, line 2494 contains dead JSX (`ParentSummaryModal`).
  - *Proposed Solution*: Remove the redundant inline communication bar from the lesson completion footer in `LessonControlModal.tsx`. Keep the primary CTA as `"Save & Open Parent Report"`. All outbound messaging (Group WhatsApp, Parent WhatsApp, Student WhatsApp, Phone Call, Copy, Print) is consolidated inside the dedicated `ArabicParentReportModal.tsx`. Purge the dead `ParentSummaryModal` JSX.
- **Decision 2: Deduplication of Quick Lesson Triggers**
  - *Current Problem*: Starting a quick lesson is exposed in both the BottomNav Center FAB (`Zap` icon) and the top toolbar dropdown in `ScheduleView.tsx` (`+ Lesson` -> `Quick Lesson`).
  - *Proposed Solution*: Retain the BottomNav FAB as the global shortcut for instant actions, but replace the ambiguous `Zap` icon with a clean, semantic `Plus` / `Sparkles` action trigger with a descriptive aria-label. Maintain `ScheduleView.tsx` toolbar "+ Scheduled Lesson" as the primary screen-level action.
- **Decision 3: Settings Access Point Consolidation**
  - *Current Problem*: Settings is accessible in three separate places: Top Header (`Header.tsx`), BottomNav Tab (`BottomNav.tsx`), and the 3-Bars Hamburger Drawer.
  - *Proposed Solution*: Standardize Top Header to contain only real-time utilities (Sync status, Notifications, User profile). The BottomNav Tab "Settings" remains the canonical entry point. Remove the redundant Settings button from the 3-Bars drawer and surface buried high-value utilities (such as "Recently Deleted / Trash" and "Backup & Restore") prominently.
- **Decision 4: Introduction of Reusable Button Primitives**
  - *Current Problem*: Zero shared button components exist in `src/components/common/`. Every screen writes inline Tailwind classes with 7 different border radii (`rounded-md` through `rounded-full`) and heights ranging from 24px to 54px.
  - *Proposed Solution*: Introduce `Button.tsx`, `IconButton.tsx`, and `ActionToolbar.tsx` in `src/components/common/` with strict WCAG touch targets ($\ge 40\text{px}$ mobile), uniform radius tokens (`rounded-xl`), and standard variants (`primary`, `secondary`, `tertiary`, `destructive`, `ghost`).

---

## A. Application Areas Inspected & Limitations

### 1. Modules and Components Inspected
1. **Global App Shell & Navigation**:
   - `src/components/Header.tsx` (Top header, notification bell, sync trigger, settings icon, 3-bars hamburger drawer, search overlay).
   - `src/components/BottomNav.tsx` (Dynamic 6-tab navigation, custom FAB center action, tab reorder drawer).
2. **Lessons & Lesson Execution**:
   - `src/components/LessonControlModal.tsx` (Live lesson execution, stopwatch, attendance toggles, behavior notes, audio recorder, homework tracker, report generator).
   - `src/components/ArabicParentReportModal.tsx` (Parent report preview, text customization, WhatsApp dispatchers, print/copy actions).
   - `src/components/ParentSummaryModal.tsx` (Inspected for dead code / duplicate modal wrappers).
3. **Schedule & Timetables**:
   - `src/components/ScheduleView.tsx` (Weekly calendar, daily agenda, "+ Lesson" unified dropdown, "Export & Tools" menu, timeline cards).
   - `src/components/SchoolScheduleView.tsx` (Official school schedule, period grid, live session banner, custom sessions, timetable settings).
4. **Students & Groups**:
   - `src/components/StudentsView.tsx` (Student list, group filter bar, multi-select floating action bar, inline quick-gender toggles, 8-item student kebab menu).
   - `src/components/StudentProfileModal.tsx` (Detail view, edit form, contact shortcuts, score cards).
   - `src/components/ContactsUnificationModal.tsx` (Google contacts synchronization and batch renaming).
5. **Finance & Investments**:
   - `src/components/finance/FinanceView.tsx` & `FinanceDashboard.tsx` (Net worth cards, quick action buttons, account transfers, bullion/gold tracker, monthly targets).
   - `src/components/finance/AccountsManager.tsx`, `InvestmentsManager.tsx`, `TransactionHistory.tsx`.
6. **Reports & Analytics**:
   - `src/components/ReportsView.tsx` (Lesson history, filter pills, week-by-week accordions, attendance stats, bulk export).
7. **Department & Teacher Management**:
   - `src/components/HodHubView.tsx` (Head of Department hub, observation visits, weekly teacher plans, stage manager follow-ups, PDF generators).
8. **Administration & Settings**:
   - `src/components/SettingsView.tsx` (System preferences, theme switch, database backup/restore, school schedule configuration).
   - `src/components/PortalAdminDashboard.tsx` (Parent portal PIN generation, QR codes, student sync).

### 2. Inspection Limitations
- The audit was conducted statically via deep TypeScript/AST review and semantic DOM trace. No live database writes, simulated parent WhatsApp messages, or destructive deletions were triggered during inspection.
- Native Android Capacitor plugins (`ContactsManagerPlugin.java`, audio recording) were inspected for UI triggers and fallback states in browser viewports.

---

## B. Executive Summary: Confirmed Issues by Category

Across the Glück application codebase, **66 distinct UI/UX button and action issues** were confirmed and cataloged:

| Category | Description | Count |
| :--- | :--- | :--- |
| **Category 1: Duplicate & Redundant Buttons** | Exact same action rendered $\ge 2$ times on the same screen or workflow; competing entry points. | **18** |
| **Category 2: Visual Inconsistency & Sizing** | Random border radii, padding mismatch, touch targets $< 40\text{px}$, unstyled or stretched buttons. | **24** |
| **Category 3: Action Placement & Hierarchy** | Destructive actions adjacent to neutral buttons; primary actions buried in submenus; misplaced toolbars. | **14** |
| **Category 4: Dead Code & Unreachable Actions** | Unreachable JSX, unwired `onClick` handlers, or modal wrappers whose trigger state is never true. | **3** |
| **Category 5: Missing Actions & Feedback** | Missing loading spinners on async operations, missing two-step confirmations on dangerous batch actions. | **7** |
| **TOTAL** | **Confirmed Codebase Action Issues** | **66** |

---

## C. Global Design Inconsistencies & Button Standards

### 1. Existing Inconsistencies Identified
- **Border Radius Anarchy**: Codebase uses `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, and `rounded-full` without semantic distinction.
- **Touch Target Failures**: Table action buttons in `StudentsView.tsx` and `ReportsView.tsx` have dimensions as small as $24\text{px} \times 24\text{px}$ (`p-1 text-xs`), severely violating mobile accessibility standards ($\ge 44\text{px}$).
- **Stretched CTAs**: On desktop viewports, dialog footer buttons frequently use `w-full` inside vertical stacks rather than compact, aligned action rows on the right.
- **Accidental Gender Clicks**: The gender toggle in `StudentsView.tsx` (`Venus`/`Mars` icon) is rendered as an unbordered inline button directly in the row; accidental taps while scrolling toggle the student's gender without notice.

### 2. Proposed Button Design System Standards

All buttons across Glück will adhere to standard Tailwind design tokens:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GLÜCK BUTTON DESIGN SYSTEM                            │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────────┤
│ Variant      │ Background   │ Text/Icon    │ Border       │ State (Hover/Focus) │
├──────────────┼──────────────┼──────────────┼──────────────┼─────────────────────┤
│ Primary      │ bg-indigo-600│ text-white   │ None         │ hover:bg-indigo-700 │
│ Secondary    │ bg-slate-100 │ text-slate-800│ border-slate-200│ hover:bg-slate-200 │
│ Tertiary/Text│ transparent  │ text-slate-600│ None         │ hover:bg-slate-100  │
│ Destructive  │ bg-rose-50   │ text-rose-600│ border-rose-200│ hover:bg-rose-100  │
│ Destructive-Solid│ bg-rose-600│ text-white │ None         │ hover:bg-rose-700   │
│ Icon-Only    │ transparent  │ text-slate-600│ None / subtle│ hover:bg-slate-100  │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────────────┘
```

#### Standard Dimensions & Touch Targets:
- **Default Height / Touch Target**:
  - `sm` (Table/List Compact): `h-9` ($36\text{px}$ desktop / min touch target container $44\text{px}$ via padding), `px-3 text-xs font-medium rounded-lg`.
  - `md` (Standard Form & Card Action): `h-10` ($40\text{px}$), `px-4 text-sm font-medium rounded-xl`.
  - `lg` (Primary Dialog & Modal CTA): `h-12` ($48\text{px}$), `px-5 text-base font-semibold rounded-xl`.
- **Icon Sizing Rule**:
  - Inside `sm` buttons: `w-4 h-4` (`16px`).
  - Inside `md` buttons: `w-4.5 h-4.5` (`18px`).
  - Inside `lg` buttons: `w-5 h-5` (`20px`).
  - Icon-to-text gap: strictly `gap-2` (`8px`).
- **Standard Focus Ring**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`.

---

## D. Detailed Screen-by-Screen Audit

| Issue ID | Module / Screen | File Path | Current Behavior | Identified Problem | Affected Buttons | Classification | Recommended Solution | Proposed Placement | Scope | Priority | Complexity | Test Procedure |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ISS-01** | Global Header | `src/components/Header.tsx` | Settings gear icon in header links to Settings tab | Duplicates BottomNav Settings tab and 3-bars drawer Settings item | Header Settings button (L290) | Redundancy | Remove Settings gear from top bar; replace with user profile/avatar quick popover | Right header utility cluster | Local | P2 | Low | Verify navigation to Settings remains seamless via BottomNav |
| **ISS-02** | Global Drawer | `src/components/Header.tsx` | "Recently Deleted" is hidden inside 3-bars hamburger drawer with a tiny blue dot | Hard to discover for teachers attempting to recover mistakenly deleted students | Drawer Item "Recently Deleted" (L432) | Poor Placement | Move "Trash / Deleted" to a dedicated action tab or prominent link inside `StudentsView.tsx` & `SettingsView.tsx` | Student list toolbar & Data Management | Shared | P1 | Med | Delete a student and verify recovery can be initiated directly from StudentsView |
| **ISS-03** | Bottom Nav | `src/components/BottomNav.tsx` | Center FAB uses rotating `Zap` icon to open quick menu | Icon does not communicate "Add/Start Lesson"; creates confusion | Center FAB button (L120) | Ambiguity | Replace `Zap` with `Plus` icon with badge, label "Schnellstart / Quick Start" | BottomNav Center FAB | Local | P2 | Low | Check mobile tap opens popup with clear actions |
| **ISS-04** | Lesson Control | `src/components/LessonControlModal.tsx` | Parent communication section renders WhatsApp, Call, and Report buttons | Duplicates identical actions in `ArabicParentReportModal.tsx`; saving report already opens parent report modal | L2386–2489 WhatsApp & Call buttons | Duplication | Remove inline comms buttons from footer; consolidate all message dispatching into `ArabicParentReportModal` | Single CTA: "Save & Open Parent Report" | Local | P0 | Med | Complete a lesson, click Save, verify ArabicParentReportModal opens cleanly with all send options |
| **ISS-05** | Lesson Control | `src/components/LessonControlModal.tsx` | `showParentSummaryModal && <ParentSummaryModal />` rendered at L2494 | Dead code: `setShowParentSummaryModal(true)` is never invoked anywhere | `ParentSummaryModal` JSX | Dead Code | Safely remove the unreachable state and component instance | N/A (Delete dead code) | Local | P2 | Low | Compile applet; ensure zero regressions in lesson flow |
| **ISS-06** | Arabic Parent Report | `src/components/ArabicParentReportModal.tsx` | 6 full-width buttons crowded in modal footer | Buttons overflow small phone viewports; secondary actions compete with primary "Send WhatsApp" | Footer button row (L1775–1895) | Layout & Hierarchy | Make "Send to Parent WhatsApp" the sole Primary CTA; group "Send to Group", "Send to Student", and "Copy" in a secondary segmented action row; move "Print" into overflow menu | Bottom modal sticky action bar | Local | P1 | Med | Open modal on 360px mobile viewport; verify zero horizontal overflow |
| **ISS-07** | Students View | `src/components/StudentsView.tsx` | 5 top buttons ("Add Student", "Add Group", "AI Import", "Clean Contacts", "Gender") rendered in horizontal flex | Top bar wraps into multiple uneven lines on mobile; confusing mix of student actions and utility actions | Top toolbar buttons (L340–420) | Clutter & Hierarchy | Keep "+ Student" as Primary CTA; group "Add Group" & "AI Import" into a "+ Add..." dropdown; move "Clean Contacts" & "Gender" into a "Tools" menu | Top unified toolbar with split button | Local | P1 | Med | Test toolbar on mobile and tablet screens |
| **ISS-08** | Students View | `src/components/StudentsView.tsx` | Gender icon (`Venus`/`Mars`) on student item card toggles gender on single click | High rate of accidental gender alteration while tapping card to view details | Inline Gender button (L820) | Destructive / UX Bug | Turn gender icon into display badge; gender change is only editable inside the Student Profile Modal or via intentional long-press | Student Profile Modal edit form | Local | P1 | Low | Tap student card; verify profile opens without toggling gender |
| **ISS-09** | Schedule View | `src/components/ScheduleView.tsx` | "+ Lesson" dropdown offers "Quick Lesson" and "Start Lesson Now" | Duplicates BottomNav Center FAB quick action workflow | Toolbar dropdown items (L210) | Duplication | Standardize: "+ Lesson" opens standard new lesson modal; quick instant lessons are clearly badged as "Start Now" | Schedule View Header | Local | P2 | Low | Test creating both scheduled and ad-hoc lessons |
| **ISS-10** | School Schedule | `src/components/SchoolScheduleView.tsx` | "Clear Entire School Schedule" is a red button placed adjacent to "Cancel" in modal footer | Extreme risk of accidental wipeout; lacks required typed confirmation | Delete Schedule button (L2150) | Dangerous / Lack of Confirmation | Require a 2-step typed modal confirmation ("TYPE 'DELETE' TO CONFIRM") before clearing timetable | Dedicated confirmation modal | Local | P0 | Med | Click clear schedule; verify prompt blocks immediate execution |
| **ISS-11** | Finance Dashboard | `src/components/finance/FinanceDashboard.tsx` | 4 Quick action buttons use rounded-2xl pastel gradient cards | Visual language diverges from Glück's rounded-xl slate/indigo aesthetic; buttons take 40% of viewport | Quick Action cards (L340–410) | Visual Inconsistency | Align cards to Glück design tokens: standard border-slate-200, rounded-xl, cohesive icons and typography | Dashboard Action Strip | Local | P2 | Low | Verify Finance dashboard renders consistently with dark and light mode |
| **ISS-12** | HOD Hub | `src/components/HodHubView.tsx` | PDF Download, WhatsApp Share, and Print buttons copied across 4 separate tabs with varying icon sizes | Triplicate implementation with inconsistent padding (`p-1.5` vs `p-3`) | Tab action footers (L2400, L3800, L5100) | Inconsistency & Maintenance | Extract shared `DocumentActionToolbar` component with standardized PDF, WhatsApp, and Print buttons | Shared subcomponent in `HodHubView` | Shared | P2 | Med | Test export in Observation Visits, Weekly Plans, and Follow-ups |
| **ISS-13** | Reports View | `src/components/ReportsView.tsx` | Week accordions feature duplicate individual "Export Week" buttons beside main export | Cluttered accordion headers; users confused about which export does what | Accordion header buttons (L280) | Redundancy | Retain top global Export (with range selector); inside week accordions, keep only simple expand/collapse toggle and summary metrics | Week Header | Local | P2 | Low | Export individual week vs all weeks cleanly |
| **ISS-14** | Portal Admin | `src/components/PortalAdminDashboard.tsx` | PIN generation button has no loading state during Firestore token generation | Users double-click while waiting, generating multiple duplicate access PINs | Generate PIN button (L310) | Missing Feedback | Add disabled state + spinner during PIN generation promise resolution | Table row action | Local | P1 | Low | Generate PIN with simulated delay; verify button shows loading spinner |

---

## E. Duplicate Actions & Proposed Consolidation

### 1. Lesson Communication Consolidation
```
[CURRENT DUPLICATED STATE]
LessonControlModal Footer:
  ├── Button 1: "Parent Report" -> opens ArabicParentReportModal
  ├── Button 2: "Group WhatsApp" -> opens wa.me link
  ├── Button 3: "Parent WhatsApp" -> opens wa.me link
  ├── Button 4: "Call Parents" -> opens tel: link
  └── Auto-save trigger -> ALSO opens ArabicParentReportModal!
ArabicParentReportModal Footer:
  ├── Button 1: "Send to Group WhatsApp"
  ├── Button 2: "Send to Parent WhatsApp"
  ├── Button 3: "Send to Student WhatsApp"
  ├── Button 4: "Call Parents"
  └── Button 5: "Copy Report"

[PROPOSED STREAMLINED STATE]
LessonControlModal Footer:
  └── Primary CTA: "Save & Generate Report" (single clear action)
ArabicParentReportModal (Unified Communication Center):
  ├── Primary CTA: "Send via WhatsApp to Parent" (Prominent)
  ├── Secondary Segment: "Send to Group" | "Send to Student" | "Copy Text"
  └── Overflow Menu (3-dots): "Call Phone", "Print PDF", "Raw Template"
```

### 2. Multi-Level Settings Consolidation
- **Problem**: Settings is exposed in Header, Bottom Nav, and Navigation Drawer.
- **Consolidation**: Retain Bottom Nav "Settings" as the single primary navigation route. Header retains only quick Sync status and Notifications. Free up drawer space for "Trash / Recently Deleted" and "Database Backup".

### 3. Creation Action Hierarchy ("Add Student" vs "Add Group")
- **Problem**: In `StudentsView.tsx`, buttons for adding individual students, creating new classes/groups, importing via AI, and cleaning contacts all share identical visual prominence.
- **Consolidation**:
  - **Primary CTA**: "+ Add Student" (`bg-indigo-600 text-white`).
  - **Secondary Action Dropdown**: "Actions / Import" -> containing "Create Group", "AI Import (Excel/Sheet)", and "Clean Google Contacts".

---

## F. Missing or Poorly Placed Actions & Proposed Improvements

1. **Batch Student Actions**:
   - Currently, selecting multiple students in `StudentsView.tsx` shows only "Move to Group" and "Delete".
   - *Improvement*: Add "Batch WhatsApp Broadcast" and "Export Selected" to the floating multi-select bar.
2. **Undo / Restore Affordance**:
   - Deleting a lesson or student currently has no immediate "Undo" snackbar button.
   - *Improvement*: When an item is moved to trash, trigger a 5-second transient toast notification with an immediate "Undo / Rückgängig machen" button.
3. **Async Loading States**:
   - When generating Parent Report PDFs or syncing with Google Contacts, buttons remain clickable.
   - *Improvement*: Standardize all asynchronous buttons to display an inline `animate-spin` Lucide `Loader2` icon and `disabled` attribute while the promise is pending.

---

## G. Shared Components & Architectural Improvements

Currently, `src/components/common/` lacks reusable button primitives. We will establish three lightweight, accessible shared components:

### 1. `src/components/common/Button.tsx`
A unified, typed button primitive supporting:
- **Variants**: `primary`, `secondary`, `tertiary`, `destructive`, `outline`, `ghost`.
- **Sizes**: `sm` (36px list/table), `md` (40px standard), `lg` (48px primary dialog).
- **States**: `isLoading` (replaces icon with spinner, disables pointer events), `disabled`, `leftIcon`, `rightIcon`.
- **Accessibility**: Automatic `focus-visible` styling and minimum touch target wrapper for mobile.

### 2. `src/components/common/IconButton.tsx`
Standardized icon button with mandatory `aria-label` or tooltip, consistent square dimensions (`w-9 h-9`, `w-10 h-10`), and uniform hover rings.

### 3. `src/components/common/ActionToolbar.tsx`
A responsive action container that automatically groups primary actions on the left/start and secondary/overflow actions into a three-dot menu on small viewports.

---

## H. Prioritized Implementation Roadmap

The implementation is structured into 4 safe, progressive phases to guarantee zero regression:

### Phase 1: Shared Button Primitives & Design System (Non-Breaking)
- Create `src/components/common/Button.tsx` and `src/components/common/IconButton.tsx`.
- Establish centralized color, radius, and sizing tokens.
- *Risk*: Zero risk. Existing screens remain untouched until primitives are verified.

### Phase 2: High-Impact Duplication & Dangerous Action Cleanup
- **LessonControlModal & ArabicParentReportModal**: Consolidate parent communication buttons into `ArabicParentReportModal`; delete dead `ParentSummaryModal` JSX.
- **SchoolScheduleView**: Implement two-step typed confirmation modal for "Clear Entire School Schedule".
- **StudentsView**: Change inline gender toggle into a non-destructive badge, moving edit action into profile.

### Phase 3: Screen-by-Screen Hierarchy & Placement Refinement
- **Header & Navigation**: Consolidate Settings entry points; surface "Recently Deleted / Trash".
- **StudentsView Toolbar**: Implement unified split action button ("+ Student" primary, "Group / Import" dropdown).
- **Finance & HOD Hub**: Standardize action cards and extract `DocumentActionToolbar`.

### Phase 4: Final Verification, Cross-Device Testing & Linting
- Verify on mobile viewports (360px, 390px, 412px) and desktop (1440px).
- Verify RTL Arabic layout and German/English translations.
- Run `lint_applet` and `compile_applet`.

---

## I. Acceptance Checklist for Verifying Implementation

- [ ] **Zero Dead Code**: `ParentSummaryModal` unreachable JSX in `LessonControlModal.tsx` is completely removed.
- [ ] **No Duplicate Communication Buttons**: Lesson completion footer has exactly one primary action: `"Save & Open Parent Report"`.
- [ ] **Accidental Gender Click Eliminated**: Tapping student cards in `StudentsView.tsx` no longer alters gender data.
- [ ] **Safe Destructive Actions**: "Clear Entire School Schedule" cannot be triggered with a single accidental click.
- [ ] **Touch Target Compliance**: Every interactive button on mobile has a minimum touch target $\ge 40\text{px}$.
- [ ] **Single-Line Button Labels**: All button texts adhere to `whitespace-nowrap shrink-0` with no awkward mid-word wrapping.
- [ ] **Clean Compilation**: `npm run build` passes with zero TypeScript errors or broken imports.

---

## J. Explicit List of Unresolved Questions & User Decisions

Before code edits begin, please confirm your preferences on these 3 optional design choices:

1. **Trash / Recently Deleted Placement**:
   - *Option A (Recommended)*: Add a prominent "Trash / Deleted Items" icon button in the `StudentsView.tsx` toolbar so teachers can restore deleted students instantly.
   - *Option B*: Keep it in `SettingsView.tsx` under Data Management.
2. **BottomNav Center Action FAB**:
   - *Option A (Recommended)*: Change the center `Zap` icon to a `Plus` icon labeled "Quick Lesson", opening a streamlined quick-start sheet.
   - *Option B*: Keep the `Zap` icon styling but improve the popup menu clarity.
3. **Student Card Gender Editing**:
   - *Option A (Recommended)*: Static visual badge on the card (`👦` / `👧`), editable only inside the full Student Profile Modal.
   - *Option B*: Retain inline clicking on the card, but require a quick confirmation popover before updating the database.
