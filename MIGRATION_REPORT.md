# Data Storage & Reliability Upgrade Report

## 1. Current Storage Risks (Pre-Migration)
- **localStorage Size Limit:** \`localStorage\` is limited to approximately 5MB of data per origin. This is easily exceeded by base64-encoded student images (avatars/documents) and large datasets (1000+ lessons, years of payments).
- **Synchronous Blocking:** \`localStorage\` operations are completely synchronous and block the main UI thread. Reading or writing a large JSON payload (like thousands of lessons) can cause the app to freeze and stutter during initialization or saves.
- **Data Loss During Interruption:** The lesson timer relied on storing temporary start times in \`localStorage\` inside the Modal component rather than a unified global state. If the app was closed and restarted, there were race conditions where the timer state would drop because the component's state didn't safely restore from a robust database.

## 2. Migration Steps Executed
- **Installed \`localforage\`:** Added the localforage package to utilize IndexedDB as the primary storage engine.
- **Created \`storageService.ts\`:** Developed an asynchronous storage wrapper around localforage configured for the \`AGS19_DB\` store.
- **Created \`migrationService.ts\`:** Wrote an automated startup migration script that runs on the first launch. It reads all 17 critical state keys from \`localStorage\`, parses them, and persists them into IndexedDB securely. Once migrated, it sets a \`dl_migrated_v2\` flag to prevent future redundant migrations.
- **Refactored \`App.tsx\`:** Introduced a blocking loading screen that awaits the completion of the migration and asynchronously fetches the entire database payload from IndexedDB *before* booting the main React application tree.
- **Refactored \`AppContext.tsx\`:** Removed all synchronous \`localStorage.getItem\` calls in \`useState\` initializers and replaced them with the \`initialData\` preloaded by \`App.tsx\`. Upgraded all \`useEffect\` persistence mechanisms to use the asynchronous \`storage.setItem()\` (IndexedDB).
- **Upgraded Backup/Restore Flows:** Transformed \`importBackupFile\` and \`restoreBackup\` into asynchronous routines to gracefully await database restoration via localforage.
- **Upgraded Lesson Timer State:** Migrated the \`LessonControlModal\` to consume the robust global \`activeLessonSession\` state instead of local disjointed \`localStorage\` keys. The elapsed timer is now mathematically derived from the \`startedAt\` timestamp stored inside IndexedDB, surviving hard app restarts and browser crashes seamlessly.

## 3. Files Modified
- \`src/services/storageService.ts\` (Created)
- \`src/services/migrationService.ts\` (Created)
- \`src/App.tsx\`
- \`src/context/AppContext.tsx\`
- \`src/components/SettingsView.tsx\`
- \`src/components/BackupModal.tsx\`
- \`src/components/LessonControlModal.tsx\`
- \`src/hooks/useLessonReminders.ts\`
- \`package.json\`

## 4. Reliability Improvements
- **Infinite Offline Storage:** By migrating to IndexedDB, the app can now store hundreds of megabytes of data, effectively removing the 5MB ceiling.
- **Thread Non-Blocking Saves:** Asynchronous \`localforage\` writes ensure the app never stutters or drops frames when auto-saving large JSON objects on every edit.
- **Crash-Proof Timers:** If the browser tab crashes or the phone restarts during an active lesson, upon reopening the app, the \`activeLessonSession\` context loads from IndexedDB. The timer seamlessly recalculates the elapsed time using \`Date.now() - activeLessonSession.startedAt\`, meaning no seconds are ever lost.
- **Safe Images:** Base64-encoded avatars and homework documents no longer risk breaking the app due to \`QuotaExceededError\`.

## 5. Remaining Limitations
- **Memory Pressure on Load:** \`App.tsx\` currently pulls the entire database into memory (RAM) via \`initialData\` on startup. While IndexedDB handles the storage securely, if the user amasses tens of thousands of lessons, pulling all of them into a single \`useState\` React array could eventually impact runtime performance. 
- **Suggested Future Mitigation:** Implementing infinite scrolling or paginated lazy-loading for the \`SessionHistoryView\` to only query chunks of lessons out of IndexedDB at a time, instead of keeping the entire array in React Context state.
