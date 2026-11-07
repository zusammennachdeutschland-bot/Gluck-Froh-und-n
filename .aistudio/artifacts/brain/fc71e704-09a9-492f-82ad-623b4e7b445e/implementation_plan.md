# Glück – Google Auth & Firebase Cloud Sync Repair Plan

This plan details the audit and repair of the synchronization and authentication systems to ensure reliable two-way sync between Android and Web, hardened security, and seamless native mobile authentication.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following confirmed choices from Phase 1 govern this implementation:

- **Confirmed Decision 1 (Android Native Auth)**: Transition to the **Native Capacitor Google Sign-In plugin**. This replaces the `signInWithRedirect` fallback, providing a modern, seamless login experience on Android devices without leaving the app.
- **Confirmed Decision 2 (Sync Status UI)**: Place synchronization status and "Pending Changes" indicators exclusively inside the **Settings / Cloud Sync** view. This maintains the minimalist UI while providing necessary transparency for the sync lifecycle.
- **Confirmed Decision 3 (Keystore Management)**: Implement a mobile-friendly button in the app's internal management section to trigger the secure `/api/android/generate-keystore` endpoint. This allows generating a release keystore and obtaining its Base64 value directly from an Android phone without terminal access.

---

## 1. Overview & Core Concept

- **What It Does**: Hardens the Firestore synchronization engine to eliminate "False Success" reports, enforces strict ownership via security rules, transitions Android authentication to native SDKs, and provides mobile-first tools for Android release signing.
- **Target Audience**: Teachers using the "Glück" manager across Android and Web who require consistent data availability and secure workspace isolation.
- **Key Value**: Guarantees that data is never lost during network interruptions and ensures that workspaces are private and tamper-proof.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
    - **Native Login**: On Android, tapping "Sign in with Google" opens the native system account picker. Once selected, the app immediately authenticates and initializes the cloud workspace.
    - **Sync Monitoring**: Users can visit "Settings > Cloud Sync" to see the real-time status: "Synced", "Syncing...", "Pending Changes (Offline)", or "Quota Exceeded".
    - **Release Preparation**: In the developer/management section, a teacher can enter a password, tap "Generate Release Keystore", and receive the Base64 string and Fingerprint to be used for their GitHub Actions configuration.
- **Visual Identity & Theme**:
    - Leverages existing Tailwind tokens (`--primary`, `--surface`, `--text-muted`) for all new UI elements.
    - Uses status-colored accents (emerald for success, amber for pending, rose for errors).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native Capacitor Auth Transition**
    - *Approach*: Install `@codetrix-studio/capacitor-google-auth` and configure it for Android.
    - *Rationale*: `signInWithRedirect` is prone to context-loss on mobile browsers and provides a poor UX compared to native system prompts.
- **Decision 2: Atomic Watermark Updates**
    - *Approach*: Only update `lastSyncTimestamp` and local watermarks *after* the Firestore `setDoc` promise resolves successfully.
    - *Rationale*: Prevents the "False Success" bug where the app thinks it's synced but the data is actually stuck in the SDK's internal buffer or rejected by security rules.
- **Decision 3: UID-Based Security Enforcement**
    - *Approach*: Update `firestore.rules` to strictly check `request.auth.uid == userId` for the `user_workspaces` path.
    - *Rationale*: Closes the current security gap where workspace isolation relied on client-side logic rather than server-side enforcement.

---

## 4. Technical Architecture & Data Strategy

### Sync Lifecycle & Error Recovery

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Local Change   │──────▶│  Debounced Push │──────▶│ Firestore Write │
└─────────────────┘       └────────┬────────┘       └────────┬────────┘
                                   │                         │
                                   ▼                         ▼
                          ┌─────────────────┐       ┌─────────────────┐
                          │ Update Status:  │       │ Success: Update │
                          │   "Syncing..."  │       │   Watermarks    │
                          └─────────────────┘       └────────┬────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │ Status: "Synced"│
                                                    └─────────────────┘
```

### Implementation Steps

1. **Auth Hardening**:
    - Update `firebaseCloudSync.ts` to use `GoogleAuth` from Capacitor for native platforms.
    - Preserve `signInWithPopup` for Web.

2. **Sync Reliability (The "False Success" Fix)**:
    - Modify `executeSafeFirestoreWrite` to correctly propagate errors back to the sync hook.
    - Update `uploadWorkspaceToGoogleCloud` to wait for confirmed server writes before committing watermarks to `localStorage`.

3. **Security Remediation**:
    - Apply the "Eight Pillars" to `firestore.rules`.
    - Enforce `auth.uid` validation and `email_verified` checks.

4. **UI & Keystore Integration**:
    - Create `AndroidKeystoreSection` component using the server-side generation proxy.
    - Add real-time sync status badges to the Settings view.

---

## 5. Verification Plan

1. **Scenario: Device Cross-Sync**: Change a student name on Web, verify it appears on Android within 10 seconds.
2. **Scenario: Network Interruption**: Disable Wi-Fi during a sync, verify the status changes to "Pending", and verify it resumes automatically when Wi-Fi is restored.
3. **Scenario: Unauthorized Access**: Attempt to read `user_workspaces/target-uid` using a different authenticated UID; verify `PERMISSION_DENIED`.
4. **Scenario: Native Auth**: Verify the native Android account picker appears on an Android build.
