package com.glueck.app;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;
import android.os.CancellationSignal;
import android.util.Log;
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
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.security.MessageDigest;
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

    private final AtomicBoolean signInInProgress = new AtomicBoolean(false);
    @Nullable
    private volatile CancellationSignal activeCancellationSignal = null;

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
