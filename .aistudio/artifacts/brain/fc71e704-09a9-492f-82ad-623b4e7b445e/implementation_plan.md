# GLÜCK — Native Google Sign-In Dialog (Android Credential Manager)

Replaces the external browser redirect and `localhost` callback flow on Android with an in-app native **AndroidX Credential Manager** Google account selection bottom sheet that overlays directly on top of Glück and authenticates Firebase seamlessly via `signInWithCredential`.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Root Cause Confirmed during Phase 1 Inspection**:
> 1. **Unconfigured Placeholder Client ID**: Both the Capacitor configuration and the runtime authentication layer defaulted `webClientId` to `"REPLACE_WITH_GOOGLE_CLIENT_ID_FOR_WEB"` instead of the project's actual Google Web OAuth Client ID (`874458026984-3ai954q2p8ga6h4b2b15is2gdjbi9768.apps.googleusercontent.com`).
> 2. **Browser Redirect Fallback on Native Failure**: Whenever the third-party social login call threw an error on Android, the `catch` handler immediately invoked `signInWithRedirect(auth, googleProvider)`. In Capacitor Android (`https://localhost` origin), `signInWithRedirect` launches the external Chrome browser to `glueck-c8621.firebaseapp.com/__/auth/handler` and then redirects back to `https://localhost/...`, leaving the user stranded on a broken `localhost` page outside the application.
> 3. **Capacitor 6 vs Capacitor 8 Dependency Conflict**: Legacy Google Auth plugins targeting Capacitor 6 introduce peer dependency conflicts on Vercel/CI (`ERESOLVE`) and rely on deprecated Google Sign-In intents or custom tabs rather than a dedicated Capacitor 8 native Credential Manager bridge.

- **Confirmed Decision 1 — Native AndroidX Credential Manager Bridge**: Implement a dedicated first-party Capacitor 8 native plugin (`GoogleCredentialAuthPlugin`) inside the Android application using `androidx.credentials:credentials`, `androidx.credentials:credentials-play-services-auth`, and `com.google.android.libraries.identity.googleid:googleid`.
- **Confirmed Decision 2 — Strict Prohibition of Browser Redirects on Android**: Completely eliminate `signInWithRedirect` from the Android execution path and remove the startup `getRedirectResult` browser callback dependency on native Android so the app never opens Chrome, Custom Tabs, or `localhost`.
- **Confirmed Decision 3 — Zero External Plugin Conflicts**: Remove unused third-party Google Auth Capacitor plugins and overrides so `npm install` succeeds cleanly on Capacitor 8 without `--legacy-peer-deps` workarounds.

---

## 1. Overview & Core Concept

- **What It Does**: When a teacher taps **"Continue with Google" / "تسجيل الدخول بحساب Google"** on Android, Android's native system **Credential Manager** bottom-sheet dialog appears directly on top of the active Glück screen. Once the teacher taps their Google account, the dialog dismisses, the returned Google ID token is exchanged with Firebase via `GoogleAuthProvider.credential(idToken)` and `signInWithCredential(auth, credential)`, and Glück transitions immediately into the authenticated workspace state.
- **Target Audience / Persona**: Teachers using the Glück Android application who need instant, reliable one-tap Google Cloud Workspace authentication and synchronization without leaving the app.
- **Key Value**: Eliminates external browser launches, `localhost` redirect dead-ends, and Capacitor peer-dependency build failures while preserving 100% of existing Web and Electron authentication flows and Firestore workspace synchronization.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Normal Native Sign-In**: Teacher taps the Google Sign-In button in the Setup Wizard or Cloud Sync card → button enters a locked loading state (`actionLoading === 'login'`) preventing duplicate taps → native Android Credential Manager bottom sheet slides up over the visible Glück interface → teacher selects their Google account → bottom sheet closes → Firebase authenticates and triggers workspace sync → teacher remains on the exact same screen, now signed in.
  2. **Account Switching / Re-Authentication**: When signing out, the native plugin clears the active credential state via `ClearCredentialStateRequest` so that subsequent sign-in taps present the native account chooser cleanly, allowing the teacher to pick a different Google account.
  3. **Graceful Cancellation**: If the teacher dismisses the native bottom sheet (`GetCredentialCancellationException`), the loading spinner stops immediately and returns to the unchanged login view without displaying any error banner.
  4. **Actionable Diagnostics (No Device Account / Network / SHA-1 Mismatch)**: If the device has no Google account signed in or lacks connectivity, a clean in-app notification explains the condition without ever opening a browser or exposing raw OAuth URLs.
- **Visual Identity & Theme**:
  - Preserves the existing Glück interface, RTL/LTR layout structure, dark/light surface pairings (`bg-surface`, `border-surface-border`, `text-text-main`, `text-text-muted`), tabular numeric counters (`tabular-nums`), and zero-pill metadata formatting.
  - No redesign or alteration of existing login screens.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: First-Party Capacitor 8 Native Plugin using AndroidX Credential Manager**
  - *Chosen Approach*: Build and register a first-party Capacitor 8 plugin (`GoogleCredentialAuth`) directly in the Android host application using `CredentialManager.create(context)` and `GetCredentialRequest` (`GetSignInWithGoogleOption` with automatic fallback to `GetGoogleIdOption` if needed).
  - *Why*: `GetSignInWithGoogleOption` is Google's official Android Credential Manager API specifically designed for explicit "Sign in with Google" button taps—it renders the compact native Google account chooser sheet directly over the host Activity without leaving the app, returns a verified `GoogleIdTokenCredential`, and has zero Capacitor version mismatch issues.
  - *Alternatives Considered*: Third-party Capacitor social login wrappers (rejected due to Capacitor 6/8 peer conflicts and opaque fallback behavior) or web-based OAuth popups/redirects (strictly forbidden on Android).
- **Decision 2: Strict Platform Routing (Android vs. Web / Electron)**
  - *Chosen Approach*: Detect Capacitor Android natively (`Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'`) and route exclusively through the native Credential Manager plugin. Keep Web and Electron using `signInWithPopup(auth, googleProvider)`.
  - *Why*: Guarantees Android never triggers browser popups or `localhost` redirects while Web and Desktop continue working without regression.
- **Decision 3: Single In-Flight Authentication Guard**
  - *Chosen Approach*: Enforce a module-level in-flight mutex (`activeGoogleSignInPromise`) alongside UI button disabling so rapid double-taps cannot launch overlapping native Credential Manager requests or duplicate auth state listeners.
  - *Why*: Android's `CredentialManager.getCredentialAsync` rejects concurrent requests on the same Activity if tapped twice rapidly.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        GLÜCK APPLICATION UI LAYER                          │
│  ┌──────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │      GoogleCloudSyncCard         │  │          SetupWizard           │  │
│  │  • Single-tap loading lock       │  │  • Single-tap loading lock     │  │
│  │  • Quiet cancel handling         │  │  • Quiet cancel handling       │  │
│  └────────────────┬─────────────────┘  └───────────────┬────────────────┘  │
└───────────────────┼────────────────────────────────────┼───────────────────┘
                    └──────────────────┬─────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   PLATFORM-AWARE AUTHENTICATION SERVICE                    │
│  • In-flight mutex prevents concurrent sign-in calls                       │
│  • Verified Web Client ID: 874458026984-3ai954q2p8ga6h4b...                │
└───────────────────┬────────────────────────────────────┬───────────────────┘
                    │                                    │
       [Android Native Platform]                [Web / Desktop Platform]
                    │                                    │
                    ▼                                    ▼
┌───────────────────────────────────────┐  ┌─────────────────────────────────┐
│   CAPACITOR 8 NATIVE PLUGIN BRIDGE    │  │     FIREBASE WEB AUTH SDK       │
│       (GoogleCredentialAuth)          │  │  • signInWithPopup(auth, prov)  │
│  • AndroidX CredentialManager         │  └─────────────────┬───────────────┘
│  • GetSignInWithGoogleOption          │                    │
│  • Native Bottom-Sheet Overlay        │                    │
│  • ClearCredentialStateRequest        │                    │
└───────────────────┬───────────────────┘                    │
                    │ Returns verified Google ID Token       │
                    ▼                                        │
┌────────────────────────────────────────────────────────────┴───────────────┐
│                    FIREBASE AUTH & WORKSPACE SYNC                          │
│  • GoogleAuthProvider.credential(idToken)                                  │
│  • signInWithCredential(auth, credential)                                  │
│  • Preserves uid, browserLocalPersistence, & Cloud Sync Watermarks         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

1. **Native Credential Request (`GoogleCredentialAuthPlugin`)**:
   - Invokes `CredentialManager.create(activity)` on the host `MainActivity`.
   - Builds `GetSignInWithGoogleOption.Builder(serverClientId)` using the verified Firebase Web OAuth Client ID (`874458026984-3ai954q2p8ga6h4b2b15is2gdjbi9768.apps.googleusercontent.com`).
   - Executes `credentialManager.getCredentialAsync(...)` with `Activity` context so the native account picker sheet renders directly over `MainActivity`.
   - Extracts `GoogleIdTokenCredential.createFrom(credential.getData())` and resolves `{ idToken, email, displayName, profilePictureUri }` back to TypeScript.
   - Maps `GetCredentialCancellationException` to a structured `{ cancelled: true }` response (or `USER_CANCELLED` code) so the UI quietly resets its loading state without showing an error alert.
   - Implements `signOut()` using `ClearCredentialStateRequest` so signing out and signing back in with a different Google account works reliably.
2. **Firebase Token Exchange & Session Persistence**:
   - TypeScript receives `idToken`, validates it is non-empty, creates `GoogleAuthProvider.credential(idToken)`, and calls `signInWithCredential(auth, credential)`.
   - `onAuthStateChanged` notifies all subscribed hooks (`useGoogleCloudWorkspaceSync`, `GoogleCloudSyncCard`, `SetupWizard`) without any page reload or URL change.
3. **Configuration Requirements (Google Cloud / Firebase Console)**:
   - Package Name: `com.glueck.teacher`
   - Server/Web Client ID: `874458026984-3ai954q2p8ga6h4b2b15is2gdjbi9768.apps.googleusercontent.com`
   - Android OAuth 2.0 Client in Google Cloud Console (`glueck-c8621`) must list package `com.glueck.teacher` and the signing certificate SHA-1 / SHA-256 fingerprints used to sign the APK.
