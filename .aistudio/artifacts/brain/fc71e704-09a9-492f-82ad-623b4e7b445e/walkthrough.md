# Glück — Smart Data Cleanup & Lesson Optimization Walkthrough

## Summary of Completed Work

### 1. Rolling 14-Day Future Recurring Window
- **Issue:** Previously, recurring lesson schedules generated up to 365 days of future lesson placeholders in advance, creating ~2,400 unnecessary records that bloated database storage and slowed down cloud sync.
- **Solution:** Replaced the 365-day loop in `src/context/AppContext.tsx` with a rolling 14-day window (`ROLLING_FUTURE_WINDOW_DAYS = 14`).
- **Rolling Maintenance:** Every day and on application startup, the window automatically extends by one day (e.g. today Nov 6 → Nov 20; Nov 7 → Nov 21) without creating duplicate lessons or disturbing manually confirmed appointments.

### 2. 30-Day Historical Retention for Settled Lessons
- **Safeguard Rules:**
  - Keeps all historical lesson records within the most recent 30 days.
  - For lessons older than 30 days: only removes records that are **completed** AND **100% fully settled/paid**.
  - **Zero Loss of Financial Balances:** Never deletes unpaid, partially paid, or financially pending lessons.
  - All payment records (`PaymentRecord`), revenue entries (`financeTransactions`), and student debt ledgers remain completely untouched and intact.
  - Preserves recurring group schedules, student profiles, homework, and Lernstudio sets.

### 3. Cross-Device Cloud Sync & Resurrection Shield
- Pruned lesson IDs are stored in a persistent tombstone set (`getPrunedLessonIds()`).
- In `AppContext.tsx`, both startup deduplication (`initialLessonDeduplication`) and cloud storage synchronization (`syncLessons`) check against this tombstone set, guaranteeing that pruned lessons never reappear from old device caches or Firestore chunk uploads.

### 4. Interactive Card in Settings & Smart Backup Center
- Integrated `SmartDataCleanupCard` directly into:
  - **Settings > Allgemein / Desktop Landing**
  - **Teacher Profile Section**
  - **Smart Backup Center**
- Features:
  - **Unboxed Metrics Display:** Shows Total Lessons, Historical Prunable (>30d), and Future Bloat (>14d) with subtle `·` bullet separators.
  - **Financial Invariance Banner:** Verifies that active revenue, payment totals, and unpaid student debt balances remain 100% identical before and after cleanup.
  - **Preview Modal:** Allows reviewing sample lessons to be pruned with detailed reason tags (`Historisch (>30 Tage, bezahlt)` vs `Zukunft (>14 Tage, unbestätigt)`).
  - **Download Pre-Cleanup Backup:** One-click download of a timestamped JSON file (`glueck-lessons-pruned-backup-YYYY-MM-DD.json`) containing all pruned lesson objects.
  - **Automatic Daily Maintenance:** Can run in the background once per day or manually via the "Optimierung jetzt starten" button.

---

## Verification Results
- **Compile Check (`compile_applet`):** Passed with zero errors.
- **Lint Check (`lint_applet`):** `tsc --noEmit` passed with 0 errors.
- **Production Build (`npm run build`):** Built successfully in 41.05s (`dist/` generated with server bundle `dist/server.cjs`).
- **Dev Server:** Running cleanly on port 3000.
