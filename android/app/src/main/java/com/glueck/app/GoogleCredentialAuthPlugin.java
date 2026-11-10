package com.glueck.app;

import android.app.Activity;
import android.content.Context;
import android.os.CancellationSignal;
import android.util.Log;
import androidx.annotation.NonNull;
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
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException;
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

        String rawClientId = call.getString("serverClientId", DEFAULT_WEB_CLIENT_ID);
        if (rawClientId == null || rawClientId.trim().isEmpty() || rawClientId.contains("REPLACE_WITH_")) {
            rawClientId = DEFAULT_WEB_CLIENT_ID;
        }
        final String serverClientId = rawClientId.trim();

        activity.runOnUiThread(() -> {
            try {
                final CredentialManager credentialManager = CredentialManager.create(activity);

                // Primary flow: Explicit Sign in with Google bottom-sheet/dialog option
                GetSignInWithGoogleOption signInWithGoogleOption =
                    new GetSignInWithGoogleOption.Builder(serverClientId).build();

                GetCredentialRequest primaryRequest = new GetCredentialRequest.Builder()
                    .addCredentialOption(signInWithGoogleOption)
                    .build();

                credentialManager.getCredentialAsync(
                    activity,
                    primaryRequest,
                    new CancellationSignal(),
                    ContextCompat.getMainExecutor(activity),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(@NonNull GetCredentialResponse response) {
                            signInInProgress.set(false);
                            handleCredentialResponse(call, response);
                        }

                        @Override
                        public void onError(@NonNull GetCredentialException e) {
                            if (isCancellation(e)) {
                                signInInProgress.set(false);
                                resolveCancelled(call);
                                return;
                            }

                            // Fallback to GetGoogleIdOption (unfiltered bottom sheet) if primary option reports NoCredential
                            if (e instanceof NoCredentialException) {
                                launchFallbackGoogleIdOption(activity, credentialManager, serverClientId, call);
                                return;
                            }

                            signInInProgress.set(false);
                            rejectWithStructuredError(call, e);
                        }
                    }
                );
            } catch (Exception ex) {
                signInInProgress.set(false);
                Log.e(TAG, "Unexpected exception launching Credential Manager", ex);
                call.reject(
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

            credentialManager.getCredentialAsync(
                activity,
                fallbackRequest,
                new CancellationSignal(),
                ContextCompat.getMainExecutor(activity),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(@NonNull GetCredentialResponse response) {
                        signInInProgress.set(false);
                        handleCredentialResponse(call, response);
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        signInInProgress.set(false);
                        if (isCancellation(e)) {
                            resolveCancelled(call);
                            return;
                        }
                        rejectWithStructuredError(call, e);
                    }
                }
            );
        } catch (Exception ex) {
            signInInProgress.set(false);
            call.reject(
                "No Google account available on this device or Google Play Services is not ready.",
                "NO_GOOGLE_ACCOUNT"
            );
        }
    }

    private void handleCredentialResponse(@NonNull PluginCall call, @NonNull GetCredentialResponse response) {
        Credential credential = response.getCredential();
        if (credential instanceof CustomCredential) {
            try {
                GoogleIdTokenCredential googleIdTokenCredential =
                    GoogleIdTokenCredential.createFrom(credential.getData());
                String idToken = googleIdTokenCredential.getIdToken();
                if (idToken == null || idToken.trim().isEmpty()) {
                    call.reject("Google Sign-In returned an empty ID token.", "INVALID_ID_TOKEN");
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
                call.resolve(result);
                return;
            } catch (Exception parseEx) {
                Log.e(TAG, "Failed to parse GoogleIdTokenCredential", parseEx);
                call.reject("Received an invalid Google ID token credential.", "INVALID_ID_TOKEN");
                return;
            }
        }

        call.reject("Unsupported credential type returned by Credential Manager.", "UNSUPPORTED_CREDENTIAL");
    }

    private boolean isCancellation(@NonNull GetCredentialException e) {
        if (e instanceof GetCredentialCancellationException) {
            return true;
        }
        String type = e.getType();
        if (type != null && type.toLowerCase().contains("cancellation")) {
            return true;
        }
        String msg = e.getMessage();
        return msg != null && (msg.toLowerCase().contains("user cancelled") || msg.toLowerCase().contains("canceled"));
    }

    private void resolveCancelled(@NonNull PluginCall call) {
        JSObject cancelledResult = new JSObject();
        cancelledResult.put("cancelled", true);
        call.resolve(cancelledResult);
    }

    private void rejectWithStructuredError(@NonNull PluginCall call, @NonNull GetCredentialException e) {
        String code = "CREDENTIAL_ERROR";
        if (e instanceof NoCredentialException) {
            code = "NO_GOOGLE_ACCOUNT";
        } else if (e.getType() != null && e.getType().toLowerCase().contains("interrupted")) {
            code = "NETWORK_OR_INTERRUPTED";
        }
        Log.w(TAG, "Credential Manager error [" + code + "]: " + e.getType());
        call.reject(
            e.getMessage() != null ? e.getMessage() : "Google Credential Manager sign-in failed.",
            code
        );
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
