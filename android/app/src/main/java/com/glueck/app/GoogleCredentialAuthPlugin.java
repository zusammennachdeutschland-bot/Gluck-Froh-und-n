package com.glueck.app;

import android.accounts.Account;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Native Capacitor 8 plugin for Google Sign-In using AndroidX Credential Manager
 * and Google Identity Services (googleid).
 *
 * Displays the compact native Android Google account chooser dialog/bottom sheet
 * directly on top of MainActivity without ever launching an external browser,
 * Custom Tab, or localhost redirect.
 */
@CapacitorPlugin(name = "GoogleCredentialAuth")
public class GoogleCredentialAuthPlugin extends Plugin {
    private static final String TAG = "GoogleCredentialAuth";
    private static final String DEFAULT_WEB_CLIENT_ID =
        "874458026984-3ai954q2p8ga6h4b2b15is2gdjbi9768.apps.googleusercontent.com";
    private static final String DEFAULT_CALENDAR_SCOPE =
        "https://www.googleapis.com/auth/calendar.events";

    private final AtomicBoolean signInInProgress = new AtomicBoolean(false);
    private final AtomicBoolean calendarAuthInProgress = new AtomicBoolean(false);
    private final Handler calendarAuthHandler = new Handler(Looper.getMainLooper());
    @Nullable
    private volatile Runnable pendingCalendarConsentTimeout = null;
    @Nullable
    private volatile CancellationSignal activeCancellationSignal = null;
    @Nullable
    private ActivityResultLauncher<IntentSenderRequest> calendarAuthLauncher = null;
    @Nullable
    private volatile PluginCall pendingCalendarAuthCall = null;
    private volatile long calendarAuthStartMs = 0L;
    @Nullable
    private volatile String pendingCalendarRequestedScope = DEFAULT_CALENDAR_SCOPE;
    @Nullable
    private volatile String pendingCalendarAccountHint = null;

    @Override
    public void load() {
        super.load();
        calendarAuthLauncher = bridge.registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            this::handleCalendarAuthorizationActivityResult
        );
    }

    @PluginMethod
    public void getSigningInfo(final PluginCall call) {
        Activity activity = getActivity();
        Context context = activity != null ? activity : getContext();
        JSObject result = new JSObject();
        if (context != null) {
            populateApkSigningMetadata(context, result);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void signIn(final PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            call.reject("Activity is not available for native Google Sign-In.", "ACTIVITY_UNAVAILABLE");
            return;
        }

        if (!signInInProgress.compareAndSet(false, true)) {
            call.reject("A Google Sign-In request is already in progress.", "SIGN_IN_IN_PROGRESS");
            return;
        }

        // Preserve PluginCall across MainActivity onPause/onStop/onResume while Play Services sheet is visible
        call.setKeepAlive(true);

        String rawClientId = call.getString("serverClientId", DEFAULT_WEB_CLIENT_ID);
        if (rawClientId == null || rawClientId.trim().isEmpty() || rawClientId.contains("REPLACE_WITH_")) {
            rawClientId = DEFAULT_WEB_CLIENT_ID;
        }
        final String serverClientId = rawClientId.trim();
        final long requestStartMs = System.currentTimeMillis();

        activity.runOnUiThread(() -> {
            try {
                final CredentialManager credentialManager = CredentialManager.create(activity);
                final CancellationSignal cancellationSignal = new CancellationSignal();
                activeCancellationSignal = cancellationSignal;

                // Primary flow: Explicit Sign in with Google bottom-sheet/dialog option
                GetSignInWithGoogleOption signInWithGoogleOption =
                    new GetSignInWithGoogleOption.Builder(serverClientId).build();

                GetCredentialRequest primaryRequest = new GetCredentialRequest.Builder()
                    .addCredentialOption(signInWithGoogleOption)
                    .build();

                credentialManager.getCredentialAsync(
                    activity,
                    primaryRequest,
                    cancellationSignal,
                    ContextCompat.getMainExecutor(activity),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(@NonNull GetCredentialResponse response) {
                            activeCancellationSignal = null;
                            signInInProgress.set(false);
                            handleCredentialResponse(activity, call, response);
                        }

                        @Override
                        public void onError(@NonNull GetCredentialException e) {
                            Log.w(
                                TAG,
                                "Primary GetSignInWithGoogleOption error [" + e.getType() + "]: " + e.getMessage()
                            );

                            if (isCancellation(e)) {
                                activeCancellationSignal = null;
                                signInInProgress.set(false);
                                resolveCancelled(activity, call, requestStartMs, e);
                                return;
                            }

                            // Fallback to GetGoogleIdOption (unfiltered bottom sheet) for any non-cancellation error
                            launchFallbackGoogleIdOption(
                                activity,
                                credentialManager,
                                serverClientId,
                                requestStartMs,
                                call
                            );
                        }
                    }
                );
            } catch (Exception ex) {
                activeCancellationSignal = null;
                signInInProgress.set(false);
                Log.e(TAG, "Unexpected exception launching Credential Manager", ex);
                rejectCallSafely(
                    call,
                    "Failed to launch native Google Sign-In dialog: " + ex.getClass().getSimpleName(),
                    "CREDENTIAL_MANAGER_ERROR"
                );
            }
        });
    }

    private void launchFallbackGoogleIdOption(
        @NonNull final Activity activity,
        @NonNull final CredentialManager credentialManager,
        @NonNull final String serverClientId,
        final long requestStartMs,
        @NonNull final PluginCall call
    ) {
        try {
            GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
                .setServerClientId(serverClientId)
                .setFilterByAuthorizedAccounts(false)
                .setAutoSelectEnabled(false)
                .build();

            GetCredentialRequest fallbackRequest = new GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build();

            final CancellationSignal fallbackSignal = new CancellationSignal();
            activeCancellationSignal = fallbackSignal;

            credentialManager.getCredentialAsync(
                activity,
                fallbackRequest,
                fallbackSignal,
                ContextCompat.getMainExecutor(activity),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(@NonNull GetCredentialResponse response) {
                        activeCancellationSignal = null;
                        signInInProgress.set(false);
                        handleCredentialResponse(activity, call, response);
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        activeCancellationSignal = null;
                        signInInProgress.set(false);
                        Log.w(
                            TAG,
                            "Fallback GetGoogleIdOption error [" + e.getType() + "]: " + e.getMessage()
                        );
                        if (isCancellation(e)) {
                            resolveCancelled(activity, call, requestStartMs, e);
                            return;
                        }
                        rejectWithStructuredError(activity, call, e);
                    }
                }
            );
        } catch (Exception ex) {
            activeCancellationSignal = null;
            signInInProgress.set(false);
            rejectCallSafely(
                call,
                "No Google account available on this device or Google Play Services is not ready.",
                "NO_GOOGLE_ACCOUNT"
            );
        }
    }

    private void handleCredentialResponse(
        @NonNull Activity activity,
        @NonNull PluginCall call,
        @NonNull GetCredentialResponse response
    ) {
        Credential credential = response.getCredential();
        if (credential instanceof CustomCredential || credential instanceof GoogleIdTokenCredential) {
            try {
                GoogleIdTokenCredential googleIdTokenCredential =
                    (credential instanceof GoogleIdTokenCredential)
                        ? (GoogleIdTokenCredential) credential
                        : GoogleIdTokenCredential.createFrom(credential.getData());

                String idToken = googleIdTokenCredential.getIdToken();
                if (idToken == null || idToken.trim().isEmpty()) {
                    rejectCallSafely(call, "Google Sign-In returned an empty ID token.", "INVALID_ID_TOKEN");
                    return;
                }

                // Never log the ID token itself
                JSObject result = new JSObject();
                result.put("cancelled", false);
                result.put("idToken", idToken);
                result.put("email", googleIdTokenCredential.getId());
                if (googleIdTokenCredential.getDisplayName() != null) {
                    result.put("displayName", googleIdTokenCredential.getDisplayName());
                }
                if (googleIdTokenCredential.getGivenName() != null) {
                    result.put("givenName", googleIdTokenCredential.getGivenName());
                }
                if (googleIdTokenCredential.getFamilyName() != null) {
                    result.put("familyName", googleIdTokenCredential.getFamilyName());
                }
                if (googleIdTokenCredential.getProfilePictureUri() != null) {
                    result.put("photoUrl", googleIdTokenCredential.getProfilePictureUri().toString());
                }
                populateApkSigningMetadata(activity, result);
                resolveCallSafely(call, result);
                return;
            } catch (Exception parseEx) {
                Log.e(TAG, "Failed to parse GoogleIdTokenCredential", parseEx);
                rejectCallSafely(call, "Received an invalid Google ID token credential.", "INVALID_ID_TOKEN");
                return;
            }
        }

        rejectCallSafely(
            call,
            "Unsupported credential type returned by Credential Manager: " + credential.getType(),
            "UNSUPPORTED_CREDENTIAL"
        );
    }

    private boolean isDeveloperOrConfigError(@NonNull GetCredentialException e) {
        String msg = e.getMessage() != null ? e.getMessage().toLowerCase(Locale.ROOT) : "";
        String type = e.getType() != null ? e.getType().toLowerCase(Locale.ROOT) : "";
        return (
            msg.contains("28444") ||
            msg.contains("developer_error") ||
            msg.contains("developer console") ||
            msg.contains("not set up correctly") ||
            msg.contains("caller not whitelisted") ||
            msg.contains("10:") ||
            type.contains("configuration")
        );
    }

    private boolean isCancellation(@NonNull GetCredentialException e) {
        if (isDeveloperOrConfigError(e)) {
            return false;
        }
        if (e instanceof GetCredentialCancellationException) {
            return true;
        }
        String type = e.getType();
        if (type != null && type.toLowerCase(Locale.ROOT).contains("cancellation")) {
            return true;
        }
        String msg = e.getMessage();
        if (msg == null) return false;
        String lower = msg.toLowerCase(Locale.ROOT);
        return lower.contains("user cancelled") || lower.contains("cancelled by the user");
    }

    private void resolveCancelled(
        @NonNull Context context,
        @NonNull PluginCall call,
        long requestStartMs,
        @Nullable GetCredentialException e
    ) {
        long elapsedMs = Math.max(0L, System.currentTimeMillis() - requestStartMs);
        JSObject cancelledResult = new JSObject();
        cancelledResult.put("cancelled", true);
        cancelledResult.put("elapsedMs", elapsedMs);
        if (e != null) {
            if (e.getType() != null) {
                cancelledResult.put("exceptionType", e.getType());
            }
            if (e.getMessage() != null) {
                cancelledResult.put("reason", e.getMessage());
            }
        }
        populateApkSigningMetadata(context, cancelledResult);
        resolveCallSafely(call, cancelledResult);
    }

    private void rejectWithStructuredError(
        @NonNull Context context,
        @NonNull PluginCall call,
        @NonNull GetCredentialException e
    ) {
        String code = "CREDENTIAL_ERROR";
        if (e instanceof NoCredentialException || isDeveloperOrConfigError(e)) {
            code = "NO_GOOGLE_ACCOUNT";
        } else if (e.getType() != null && e.getType().toLowerCase(Locale.ROOT).contains("interrupted")) {
            code = "NETWORK_OR_INTERRUPTED";
        }
        JSObject data = new JSObject();
        populateApkSigningMetadata(context, data);
        if (e.getType() != null) {
            data.put("exceptionType", e.getType());
        }
        Log.w(TAG, "Credential Manager error [" + code + "]: " + e.getType() + " / " + e.getMessage());
        try {
            call.setKeepAlive(false);
        } catch (Throwable ignored) {}
        call.reject(
            e.getMessage() != null ? e.getMessage() : "Google Credential Manager sign-in failed.",
            code,
            data
        );
    }

    private void resolveCallSafely(@NonNull PluginCall call, @NonNull JSObject result) {
        try {
            call.setKeepAlive(false);
        } catch (Throwable ignored) {}
        call.resolve(result);
    }

    private void rejectCallSafely(@NonNull PluginCall call, @NonNull String msg, @NonNull String code) {
        try {
            call.setKeepAlive(false);
        } catch (Throwable ignored) {}
        call.reject(msg, code);
    }

    @SuppressWarnings("deprecation")
    private void populateApkSigningMetadata(@NonNull Context context, @NonNull JSObject target) {
        try {
            String packageName = context.getPackageName();
            target.put("packageName", packageName);

            PackageManager pm = context.getPackageManager();
            Signature[] signatures = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo pkgInfo = pm.getPackageInfo(
                    packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                );
                SigningInfo signingInfo = pkgInfo.signingInfo;
                if (signingInfo != null) {
                    if (signingInfo.hasMultipleSigners()) {
                        signatures = signingInfo.getApkContentsSigners();
                    } else {
                        signatures = signingInfo.getSigningCertificateHistory();
                    }
                }
            } else {
                PackageInfo pkgInfo = pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
                signatures = pkgInfo.signatures;
            }

            if (signatures != null && signatures.length > 0 && signatures[0] != null) {
                byte[] certBytes = signatures[0].toByteArray();
                String sha1 = formatDigestHex(certBytes, "SHA-1");
                String sha256 = formatDigestHex(certBytes, "SHA-256");
                if (sha1 != null) {
                    target.put("apkSha1", sha1);
                }
                if (sha256 != null) {
                    target.put("apkSha256", sha256);
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "Unable to read APK signing certificate fingerprint", t);
        }
    }

    @Nullable
    private String formatDigestHex(@NonNull byte[] certBytes, @NonNull String algorithm) {
        try {
            MessageDigest md = MessageDigest.getInstance(algorithm);
            byte[] digest = md.digest(certBytes);
            StringBuilder sb = new StringBuilder(digest.length * 3);
            for (int i = 0; i < digest.length; i++) {
                if (i > 0) sb.append(':');
                sb.append(String.format(Locale.ROOT, "%02X", digest[i] & 0xFF));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void authorizeCalendar(final PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            call.reject(
                "Activity is not available for native Google Calendar authorization.",
                "ACTIVITY_UNAVAILABLE"
            );
            return;
        }

        if (!calendarAuthInProgress.compareAndSet(false, true)) {
            call.reject(
                "A Google Calendar authorization request is already in progress.",
                "CALENDAR_AUTH_IN_PROGRESS"
            );
            return;
        }

        call.setKeepAlive(true);

        final String rawScope = call.getString("scope", DEFAULT_CALENDAR_SCOPE);
        final String requestedScope =
            (rawScope == null || rawScope.trim().isEmpty()) ? DEFAULT_CALENDAR_SCOPE : rawScope.trim();
        final String rawAccountEmail = call.getString("accountEmail", null);
        final String accountEmail =
            (rawAccountEmail != null && !rawAccountEmail.trim().isEmpty()) ? rawAccountEmail.trim() : null;
        final boolean forceAccountSelection = Boolean.TRUE.equals(call.getBoolean("forceAccountSelection", false));
        final boolean silentOnly = Boolean.TRUE.equals(call.getBoolean("silentOnly", false));
        final String staleAccessToken = call.getString("staleAccessToken", null);

        calendarAuthStartMs = System.currentTimeMillis();
        pendingCalendarRequestedScope = requestedScope;
        pendingCalendarAccountHint = accountEmail;

        Log.i(
            TAG,
            "[CalendarOAuth] stage=native_authorize_start hasAccountHint=" +
            (accountEmail != null) +
            " forceAccountSelection=" +
            forceAccountSelection +
            " silentOnly=" +
            silentOnly
        );

        final Handler authorizationTimeoutHandler = new Handler(Looper.getMainLooper());
        final AtomicBoolean authorizationTaskCompleted = new AtomicBoolean(false);
        final Runnable authorizationTimeout = () -> {
            if (!authorizationTaskCompleted.compareAndSet(false, true)) return;
            pendingCalendarAuthCall = null;
            calendarAuthInProgress.set(false);
            Log.w(TAG, "[CalendarOAuth] stage=native_authorize_timeout elapsedMs=" +
                Math.max(0L, System.currentTimeMillis() - calendarAuthStartMs));
            rejectCalendarAuthError(
                activity,
                call,
                "Google Calendar authorization did not respond. Check Google Play Services and try again.",
                "CALENDAR_AUTH_TIMEOUT",
                null
            );
        };
        // AuthorizationClient.authorize() and clearToken() must always settle; otherwise
        // the JS caller remains in Connecting... and calendarAuthInProgress blocks retries.
        authorizationTimeoutHandler.postDelayed(authorizationTimeout, 30000L);

        final AuthorizationClient authorizationClient = Identity.getAuthorizationClient(activity);

        final Runnable launchAuthorization = () -> activity.runOnUiThread(() -> {
            if (authorizationTaskCompleted.get()) return;
            if (activity.isFinishing() || activity.isDestroyed()) {
                authorizationTimeoutHandler.removeCallbacks(authorizationTimeout);
                authorizationTaskCompleted.set(true);
                calendarAuthInProgress.set(false);
                rejectCallSafely(
                    call,
                    "Activity closed before native Google Calendar authorization could start.",
                    "ACTIVITY_UNAVAILABLE"
                );
                return;
            }
            try {
                AuthorizationRequest.Builder requestBuilder = AuthorizationRequest.builder()
                    .setRequestedScopes(Collections.singletonList(new Scope(requestedScope)));

                if (accountEmail != null && !forceAccountSelection) {
                    requestBuilder.setAccount(new Account(accountEmail, "com.google"));
                }

                AuthorizationRequest authorizationRequest = requestBuilder.build();

                authorizationClient
                    .authorize(authorizationRequest)
                    .addOnSuccessListener(activity, authorizationResult -> {
                        if (!authorizationTaskCompleted.compareAndSet(false, true)) return;
                        authorizationTimeoutHandler.removeCallbacks(authorizationTimeout);
                        if (authorizationResult.hasResolution()) {
                            if (silentOnly) {
                                calendarAuthInProgress.set(false);
                                Log.i(TAG, "[CalendarOAuth] stage=native_silent_resolution_required");
                                JSObject resolutionRequired = new JSObject();
                                resolutionRequired.put("cancelled", false);
                                resolutionRequired.put("resolutionRequired", true);
                                resolutionRequired.put("stage", "native_resolution_required");
                                resolutionRequired.put(
                                    "elapsedMs",
                                    Math.max(0L, System.currentTimeMillis() - calendarAuthStartMs)
                                );
                                resolutionRequired.put(
                                    "reason",
                                    "Interactive Google Calendar consent or account selection is required."
                                );
                                if (accountEmail != null) {
                                    resolutionRequired.put("email", accountEmail);
                                }
                                populateApkSigningMetadata(activity, resolutionRequired);
                                resolveCallSafely(call, resolutionRequired);
                                return;
                            }

                            PendingIntent pendingIntent = authorizationResult.getPendingIntent();
                            if (pendingIntent == null || calendarAuthLauncher == null) {
                                calendarAuthInProgress.set(false);
                                Log.w(TAG, "[CalendarOAuth] stage=native_resolution_unavailable");
                                rejectCalendarAuthError(
                                    activity,
                                    call,
                                    "Google Calendar consent screen could not be launched on this device.",
                                    "RESOLUTION_UNAVAILABLE",
                                    null
                                );
                                return;
                            }
                            pendingCalendarAuthCall = call;
                            Log.i(TAG, "[CalendarOAuth] stage=native_resolution_launched");
                            try {
                                IntentSenderRequest intentSenderRequest =
                                    new IntentSenderRequest.Builder(pendingIntent.getIntentSender()).build();
                                calendarAuthLauncher.launch(intentSenderRequest);

                                // authorize() has completed, but the consent Activity is a separate
                                // asynchronous phase. It needs its own watchdog or JS can remain stuck.
                                final Runnable consentTimeout = () -> {
                                    if (pendingCalendarAuthCall != call) return;
                                    pendingCalendarAuthCall = null;
                                    pendingCalendarConsentTimeout = null;
                                    calendarAuthInProgress.set(false);
                                    Log.e(TAG, "[CalendarOAuth] stage=native_consent_timeout elapsedMs=" +
                                        Math.max(0L, System.currentTimeMillis() - calendarAuthStartMs));
                                    rejectCalendarAuthError(
                                        activity,
                                        call,
                                        "Google Calendar consent screen did not return a result. Check Google Play Services and try again.",
                                        "CALENDAR_CONSENT_TIMEOUT",
                                        null
                                    );
                                };
                                pendingCalendarConsentTimeout = consentTimeout;
                                calendarAuthHandler.postDelayed(consentTimeout, 120000L);
                            } catch (Throwable launchErr) {
                                Runnable consentTimeout = pendingCalendarConsentTimeout;
                                if (consentTimeout != null) calendarAuthHandler.removeCallbacks(consentTimeout);
                                pendingCalendarConsentTimeout = null;
                                pendingCalendarAuthCall = null;
                                calendarAuthInProgress.set(false);
                                Log.e(
                                    TAG,
                                    "[CalendarOAuth] stage=native_resolution_launch_error type=" +
                                    launchErr.getClass().getSimpleName()
                                );
                                rejectCalendarAuthError(
                                    activity,
                                    call,
                                    "Failed to open Google Calendar consent screen: " +
                                    launchErr.getClass().getSimpleName(),
                                    "RESOLUTION_LAUNCH_FAILED",
                                    launchErr
                                );
                            }
                        } else {
                            calendarAuthInProgress.set(false);
                            Log.i(TAG, "[CalendarOAuth] stage=native_immediate_grant");
                            resolveCalendarAuthorizationResult(
                                activity,
                                call,
                                authorizationResult,
                                "native_immediate_grant"
                            );
                        }
                    })
                    .addOnFailureListener(activity, err -> {
                        if (!authorizationTaskCompleted.compareAndSet(false, true)) return;
                        authorizationTimeoutHandler.removeCallbacks(authorizationTimeout);
                        calendarAuthInProgress.set(false);
                        String code = classifyCalendarAuthErrorCode(err);
                        Log.w(
                            TAG,
                            "[CalendarOAuth] stage=native_authorize_failed code=" +
                            code +
                            " type=" +
                            err.getClass().getSimpleName()
                        );
                        rejectCalendarAuthError(
                            activity,
                            call,
                            buildSafeCalendarErrorMessage(err, code),
                            code,
                            err
                        );
                    });
            } catch (Throwable ex) {
                authorizationTimeoutHandler.removeCallbacks(authorizationTimeout);
                authorizationTaskCompleted.set(true);
                calendarAuthInProgress.set(false);
                Log.e(
                    TAG,
                    "[CalendarOAuth] stage=native_authorize_exception type=" + ex.getClass().getSimpleName()
                );
                rejectCalendarAuthError(
                    activity,
                    call,
                    "Unexpected error starting native Google Calendar authorization.",
                    "NATIVE_AUTH_EXCEPTION",
                    ex
                );
            }
        });

        // Strictly await AuthorizationClient.clearToken(ClearTokenRequest) completion BEFORE retrying authorize()
        if (staleAccessToken != null && !staleAccessToken.trim().isEmpty()) {
            try {
                ClearTokenRequest clearRequest = ClearTokenRequest.builder()
                    .setToken(staleAccessToken.trim())
                    .build();
                authorizationClient
                    .clearToken(clearRequest)
                    .addOnCompleteListener(activity, task -> {
                        if (task.isSuccessful()) {
                            Log.i(TAG, "[CalendarOAuth] stage=native_stale_token_cleared");
                        } else {
                            Exception clearErr = task.getException();
                            Log.w(
                                TAG,
                                "[CalendarOAuth] stage=native_stale_token_clear_notice type=" +
                                (clearErr != null ? clearErr.getClass().getSimpleName() : "unknown")
                            );
                        }
                        launchAuthorization.run();
                    });
            } catch (Throwable clearBuildErr) {
                Log.w(
                    TAG,
                    "[CalendarOAuth] stage=native_stale_token_clear_exception type=" +
                    clearBuildErr.getClass().getSimpleName()
                );
                launchAuthorization.run();
            }
        } else {
            launchAuthorization.run();
        }
    }

    private void handleCalendarAuthorizationActivityResult(@NonNull ActivityResult activityResult) {
        final Runnable consentTimeout = pendingCalendarConsentTimeout;
        if (consentTimeout != null) calendarAuthHandler.removeCallbacks(consentTimeout);
        pendingCalendarConsentTimeout = null;

        final PluginCall call = pendingCalendarAuthCall;
        pendingCalendarAuthCall = null;
        calendarAuthInProgress.set(false);

        final Activity activity = getActivity();
        final Context context = activity != null ? activity : getContext();
        final long elapsedMs = Math.max(0L, System.currentTimeMillis() - calendarAuthStartMs);

        // Process-death recovery: Android killed & recreated MainActivity while Google consent was foreground
        if (call == null) {
            JSObject restored = new JSObject();
            restored.put("restoredAfterProcessDeath", true);
            if (activityResult.getResultCode() == Activity.RESULT_CANCELED || activityResult.getData() == null) {
                Log.i(TAG, "[CalendarOAuth] stage=native_callback_restored_cancelled");
                restored.put("status", "cancelled");
                restored.put("reason", "Google Calendar consent was cancelled.");
            } else if (activity != null) {
                try {
                    AuthorizationResult authResult =
                        Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(activityResult.getData());
                    boolean scopeVerified = isWriteCalendarScopeGranted(authResult.getGrantedScopes(), DEFAULT_CALENDAR_SCOPE);
                    restored.put("status", scopeVerified ? "approved" : "error");
                    restored.put("scopeVerified", scopeVerified);
                    String restoredEmail = extractAccountEmailSafely(authResult, null);
                    if (restoredEmail != null) {
                        restored.put("email", restoredEmail);
                    }
                    // Never emit raw accessToken in retained Capacitor events; JS triggers silent authorizeCalendar()
                    Log.i(TAG, "[CalendarOAuth] stage=native_callback_restored_approved scopeVerified=" + scopeVerified);
                } catch (Throwable ex) {
                    Log.w(
                        TAG,
                        "[CalendarOAuth] stage=native_callback_restored_error type=" + ex.getClass().getSimpleName()
                    );
                    restored.put("status", "error");
                    restored.put("reason", "Could not restore Google Calendar consent result after app restart.");
                }
            } else {
                restored.put("status", "error");
            }
            notifyListeners("calendarAuthProcessRestored", restored, true);
            return;
        }

        if (activityResult.getResultCode() == Activity.RESULT_CANCELED || activityResult.getData() == null) {
            Log.i(
                TAG,
                "[CalendarOAuth] stage=native_consent_cancelled resultCode=" + activityResult.getResultCode()
            );
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            cancelled.put("stage", "native_consent_cancelled");
            cancelled.put("elapsedMs", elapsedMs);
            cancelled.put("reason", "Google Calendar consent was cancelled by the user.");
            if (context != null) {
                populateApkSigningMetadata(context, cancelled);
            }
            resolveCallSafely(call, cancelled);
            return;
        }

        if (activity == null) {
            rejectCallSafely(call, "Activity unavailable while finishing Calendar authorization.", "ACTIVITY_UNAVAILABLE");
            return;
        }

        try {
            Intent data = activityResult.getData();
            AuthorizationResult authResult =
                Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data);
            Log.i(TAG, "[CalendarOAuth] stage=native_consent_callback_received");
            resolveCalendarAuthorizationResult(activity, call, authResult, "native_consent_approved");
        } catch (ApiException apiEx) {
            String code = classifyCalendarAuthErrorCode(apiEx);
            if (apiEx.getStatusCode() == CommonStatusCodes.CANCELED) {
                Log.i(TAG, "[CalendarOAuth] stage=native_consent_cancelled_api");
                JSObject cancelled = new JSObject();
                cancelled.put("cancelled", true);
                cancelled.put("stage", "native_consent_cancelled");
                cancelled.put("elapsedMs", elapsedMs);
                cancelled.put("reason", "Google Calendar consent was cancelled.");
                populateApkSigningMetadata(activity, cancelled);
                resolveCallSafely(call, cancelled);
                return;
            }
            Log.w(TAG, "[CalendarOAuth] stage=native_callback_api_error code=" + code);
            rejectCalendarAuthError(activity, call, buildSafeCalendarErrorMessage(apiEx, code), code, apiEx);
        } catch (Throwable ex) {
            Log.e(
                TAG,
                "[CalendarOAuth] stage=native_callback_parse_error type=" + ex.getClass().getSimpleName()
            );
            rejectCalendarAuthError(
                activity,
                call,
                "Failed to process Google Calendar authorization result.",
                "CALLBACK_PARSE_ERROR",
                ex
            );
        }
    }

    private boolean isWriteCalendarScopeGranted(@Nullable List<String> grantedScopes, @NonNull String expectedScope) {
        if (grantedScopes == null) return false;
        for (String s : grantedScopes) {
            if (s == null) continue;
            String trimmed = s.trim();
            if (trimmed.equals(expectedScope) || trimmed.equals("https://www.googleapis.com/auth/calendar")) {
                return true;
            }
        }
        return false;
    }

    @Nullable
    private String extractAccountEmailSafely(@NonNull AuthorizationResult authResult, @Nullable String fallbackEmail) {
        try {
            GoogleSignInAccount account = authResult.toGoogleSignInAccount();
            if (account != null && account.getEmail() != null && !account.getEmail().trim().isEmpty()) {
                return account.getEmail().trim();
            }
        } catch (Throwable ignored) {
            // Optional metadata; Calendar API verification will also inspect calendar summary/email
        }
        return fallbackEmail;
    }

    private void resolveCalendarAuthorizationResult(
        @NonNull Activity activity,
        @NonNull PluginCall call,
        @NonNull AuthorizationResult authResult,
        @NonNull String stage
    ) {
        final long elapsedMs = Math.max(0L, System.currentTimeMillis() - calendarAuthStartMs);
        final String accessToken = authResult.getAccessToken();
        if (accessToken == null || accessToken.trim().isEmpty()) {
            Log.w(TAG, "[CalendarOAuth] stage=native_empty_access_token");
            rejectCalendarAuthError(
                activity,
                call,
                "Google authorization finished without returning a Calendar access token.",
                "EMPTY_ACCESS_TOKEN",
                null
            );
            return;
        }

        final String expectedScope =
            pendingCalendarRequestedScope != null ? pendingCalendarRequestedScope : DEFAULT_CALENDAR_SCOPE;
        List<String> grantedScopes = authResult.getGrantedScopes();
        JSArray scopesJson = new JSArray();
        if (grantedScopes != null) {
            for (String s : grantedScopes) {
                if (s != null) {
                    scopesJson.put(s);
                }
            }
        }
        boolean scopeVerified = isWriteCalendarScopeGranted(grantedScopes, expectedScope);
        String resolvedEmail = extractAccountEmailSafely(authResult, pendingCalendarAccountHint);

        // Never log accessToken or serverAuthCode
        Log.i(
            TAG,
            "[CalendarOAuth] stage=" +
            stage +
            " scopeVerified=" +
            scopeVerified +
            " grantedScopeCount=" +
            (grantedScopes != null ? grantedScopes.size() : 0)
        );

        JSObject result = new JSObject();
        result.put("cancelled", false);
        result.put("resolutionRequired", false);
        result.put("accessToken", accessToken);
        result.put("grantedScopes", scopesJson);
        result.put("scopeVerified", scopeVerified);
        result.put("stage", stage);
        result.put("elapsedMs", elapsedMs);
        if (resolvedEmail != null && !resolvedEmail.isEmpty()) {
            result.put("email", resolvedEmail);
        }
        populateApkSigningMetadata(activity, result);
        resolveCallSafely(call, result);
    }

    @PluginMethod
    public void clearCalendarToken(final PluginCall call) {
        final String token = call.getString("accessToken", null);
        final Activity activity = getActivity();
        final Context context = activity != null ? activity : getContext();
        if (context == null || token == null || token.trim().isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("cleared", false);
            call.resolve(ret);
            return;
        }
        try {
            AuthorizationClient client =
                activity != null ? Identity.getAuthorizationClient(activity) : Identity.getAuthorizationClient(context);
            ClearTokenRequest clearRequest = ClearTokenRequest.builder()
                .setToken(token.trim())
                .build();
            client
                .clearToken(clearRequest)
                .addOnCompleteListener(task -> {
                    boolean cleared = task.isSuccessful();
                    if (cleared) {
                        Log.i(TAG, "[CalendarOAuth] stage=native_token_cleared");
                    } else {
                        Exception err = task.getException();
                        Log.w(
                            TAG,
                            "[CalendarOAuth] stage=native_token_clear_notice type=" +
                            (err != null ? err.getClass().getSimpleName() : "unknown")
                        );
                    }
                    JSObject ret = new JSObject();
                    ret.put("cleared", cleared);
                    call.resolve(ret);
                });
        } catch (Throwable err) {
            Log.w(TAG, "[CalendarOAuth] stage=native_token_clear_exception type=" + err.getClass().getSimpleName());
            JSObject ret = new JSObject();
            ret.put("cleared", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void revokeCalendarAccess(final PluginCall call) {
        final String rawAccountEmail = call.getString("accountEmail", null);
        final String rawScope = call.getString("scope", DEFAULT_CALENDAR_SCOPE);
        final String scopeUri =
            (rawScope == null || rawScope.trim().isEmpty()) ? DEFAULT_CALENDAR_SCOPE : rawScope.trim();
        final Activity activity = getActivity();
        final Context context = activity != null ? activity : getContext();

        if (context == null || rawAccountEmail == null || rawAccountEmail.trim().isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("revoked", false);
            call.resolve(ret);
            return;
        }

        try {
            AuthorizationClient client =
                activity != null ? Identity.getAuthorizationClient(activity) : Identity.getAuthorizationClient(context);
            RevokeAccessRequest revokeRequest = RevokeAccessRequest.builder()
                .setAccount(new Account(rawAccountEmail.trim(), "com.google"))
                .setScopes(Collections.singletonList(new Scope(scopeUri)))
                .build();
            client
                .revokeAccess(revokeRequest)
                .addOnCompleteListener(task -> {
                    boolean revoked = task.isSuccessful();
                    Log.i(TAG, "[CalendarOAuth] stage=native_access_revoked revoked=" + revoked);
                    JSObject ret = new JSObject();
                    ret.put("revoked", revoked);
                    call.resolve(ret);
                });
        } catch (Throwable err) {
            Log.w(TAG, "[CalendarOAuth] stage=native_revoke_exception type=" + err.getClass().getSimpleName());
            JSObject ret = new JSObject();
            ret.put("revoked", false);
            call.resolve(ret);
        }
    }

    private String classifyCalendarAuthErrorCode(@Nullable Throwable err) {
        if (err instanceof ApiException) {
            int statusCode = ((ApiException) err).getStatusCode();
            if (statusCode == CommonStatusCodes.CANCELED) return "USER_CANCELLED";
            if (statusCode == CommonStatusCodes.NETWORK_ERROR) return "NETWORK_ERROR";
            if (statusCode == CommonStatusCodes.DEVELOPER_ERROR) return "DEVELOPER_ERROR";
            if (statusCode == CommonStatusCodes.SIGN_IN_REQUIRED) return "SIGN_IN_REQUIRED";
            if (statusCode == CommonStatusCodes.SERVICE_VERSION_UPDATE_REQUIRED ||
                statusCode == CommonStatusCodes.SERVICE_DISABLED) {
                return "PLAY_SERVICES_UNAVAILABLE";
            }
            return "API_ERROR_" + statusCode;
        }
        return "CALENDAR_AUTH_ERROR";
    }

    private String buildSafeCalendarErrorMessage(@Nullable Throwable err, @NonNull String code) {
        if ("DEVELOPER_ERROR".equals(code)) {
            return "Google Calendar OAuth client configuration mismatch (DEVELOPER_ERROR). Verify package com.glueck.teacher and release SHA-1 in Firebase / Google Cloud Console.";
        }
        if ("NETWORK_ERROR".equals(code)) {
            return "Network error while authorizing Google Calendar. Check your internet connection and try again.";
        }
        if ("PLAY_SERVICES_UNAVAILABLE".equals(code)) {
            return "Google Play Services is unavailable or needs an update to authorize Google Calendar.";
        }
        if ("SIGN_IN_REQUIRED".equals(code)) {
            return "Please sign in with your Google account on this Android device first, then retry Google Calendar sync.";
        }
        return "Google Calendar authorization failed (" + code + "). Please try again.";
    }

    private void rejectCalendarAuthError(
        @NonNull Context context,
        @NonNull PluginCall call,
        @NonNull String message,
        @NonNull String code,
        @Nullable Throwable err
    ) {
        JSObject data = new JSObject();
        populateApkSigningMetadata(context, data);
        if (err != null) {
            data.put("exceptionType", err.getClass().getSimpleName());
            if (err instanceof ApiException) {
                data.put("statusCode", ((ApiException) err).getStatusCode());
            }
        }
        try {
            call.setKeepAlive(false);
        } catch (Throwable ignored) {}
        call.reject(message, code, data);
    }

    @PluginMethod
    public void signOut(final PluginCall call) {
        Activity activity = getActivity();
        Context context = activity != null ? activity : getContext();
        if (context == null) {
            JSObject ret = new JSObject();
            ret.put("cleared", false);
            call.resolve(ret);
            return;
        }

        try {
            CredentialManager credentialManager = CredentialManager.create(context);
            ClearCredentialStateRequest clearRequest = new ClearCredentialStateRequest();
            credentialManager.clearCredentialStateAsync(
                clearRequest,
                new CancellationSignal(),
                ContextCompat.getMainExecutor(context),
                new CredentialManagerCallback<Void, ClearCredentialException>() {
                    @Override
                    public void onResult(Void result) {
                        JSObject ret = new JSObject();
                        ret.put("cleared", true);
                        call.resolve(ret);
                    }

                    @Override
                    public void onError(@NonNull ClearCredentialException e) {
                        Log.w(TAG, "ClearCredentialState notice: " + e.getClass().getSimpleName());
                        JSObject ret = new JSObject();
                        ret.put("cleared", false);
                        call.resolve(ret);
                    }
                }
            );
        } catch (Exception ex) {
            JSObject ret = new JSObject();
            ret.put("cleared", false);
            call.resolve(ret);
        }
    }
}
