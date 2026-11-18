package com.glueck.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;

/**
 * Native Capacitor 8 plugin for secure Grain Personal API integration on Android.
 *
 * Security Architecture:
 * 1. Hardware-backed AndroidKeyStore (AES/GCM/NoPadding, 256-bit) encrypts the Grain
 *    Personal Access Token before storing ciphertext in private SharedPreferences.
 * 2. The raw Grain token is NEVER returned to WebView JavaScript or logged.
 * 3. All Grain API v2 HTTPS requests execute natively in Java with strict host and path
 *    whitelisting (https://api.grain.com/_/public-api/v2/...).
 * 4. Excluded from Android Auto Backup and device-to-device transfer via backup_rules.xml
 *    and data_extraction_rules.xml.
 */
@CapacitorPlugin(name = "GrainSecureBridge")
public class GrainSecureBridgePlugin extends Plugin {
    private static final String TAG = "GrainSecureBridge";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "com.glueck.app.grain_pat_aes_key_v1";
    private static final String PREFS_NAME = "com.glueck.app.grain_secure_vault";
    private static final String PREF_CIPHERTEXT = "grain_pat_ciphertext";
    private static final String PREF_IV = "grain_pat_iv";
    private static final String PREF_MASKED = "grain_pat_masked";
    private static final String PREF_SAVED_AT = "grain_pat_saved_at";
    private static final String GRAIN_API_ORIGIN = "https://api.grain.com";
    private static final String GRAIN_API_VERSION = "2026-10-01";
    private static final Pattern SAFE_RECORDING_ID = Pattern.compile("^[a-zA-Z0-9_-]{4,128}$");

    private final ExecutorService ioExecutor = Executors.newCachedThreadPool();

    private SecretKey getOrCreateSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
            if (entry instanceof KeyStore.SecretKeyEntry) {
                return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
            }
        }
        KeyGenerator keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        );
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    private boolean isKeyHardwareBacked() {
        try {
            SecretKey key = getOrCreateSecretKey();
            SecretKeyFactory factory = SecretKeyFactory.getInstance(key.getAlgorithm(), ANDROID_KEYSTORE);
            KeyInfo keyInfo = (KeyInfo) factory.getKeySpec(key, KeyInfo.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                int level = keyInfo.getSecurityLevel();
                return level == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT
                    || level == KeyProperties.SECURITY_LEVEL_STRONGBOX;
            }
            return keyInfo.isInsideSecureHardware();
        } catch (Exception e) {
            return false;
        }
    }

    private void storeEncryptedToken(@NonNull Context context, @NonNull String rawToken) throws Exception {
        SecretKey secretKey = getOrCreateSecretKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(rawToken.getBytes(StandardCharsets.UTF_8));

        String masked = maskToken(rawToken);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(PREF_CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
            .putString(PREF_MASKED, masked)
            .putString(PREF_SAVED_AT, String.valueOf(System.currentTimeMillis()))
            .apply();
    }

    @Nullable
    private String loadDecryptedToken(@NonNull Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String cipherB64 = prefs.getString(PREF_CIPHERTEXT, null);
            String ivB64 = prefs.getString(PREF_IV, null);
            if (cipherB64 == null || ivB64 == null) {
                return null;
            }
            SecretKey secretKey = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP));
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);
            byte[] decrypted = cipher.doFinal(Base64.decode(cipherB64, Base64.NO_WRAP));
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            Log.w(TAG, "Unable to decrypt stored Grain credential from AndroidKeyStore");
            return null;
        }
    }

    private void clearStoredToken(@NonNull Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS);
            }
        } catch (Exception e) {
            Log.w(TAG, "Notice while clearing Grain key alias");
        }
    }

    private String maskToken(@NonNull String token) {
        String trimmed = token.trim();
        if (trimmed.length() <= 12) {
            return "grain_pat_••••";
        }
        String suffix = trimmed.substring(trimmed.length() - 4);
        return "grain_pat_••••••••" + suffix;
    }

    @PluginMethod
    public void getStatus(final PluginCall call) {
        Context context = getContext();
        JSObject res = new JSObject();
        if (context == null) {
            res.put("supported", false);
            res.put("secureStorageAvailable", false);
            res.put("hasToken", false);
            call.resolve(res);
            return;
        }
        String token = loadDecryptedToken(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        res.put("supported", true);
        res.put("secureStorageAvailable", true);
        res.put("hardwareBackedKeystore", isKeyHardwareBacked());
        res.put("runtime", "android");
        res.put("hasToken", token != null && !token.isEmpty());
        res.put("maskedToken", token != null ? prefs.getString(PREF_MASKED, "grain_pat_••••") : null);
        call.resolve(res);
    }

    @PluginMethod
    public void saveToken(final PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Android context unavailable", "CONTEXT_UNAVAILABLE");
            return;
        }
        String token = call.getString("token", "");
        if (token == null || token.trim().length() < 10) {
            call.reject("Invalid Grain Personal Access Token format.", "INVALID_TOKEN_FORMAT");
            return;
        }
        try {
            String clean = token.trim();
            storeEncryptedToken(context, clean);
            JSObject res = new JSObject();
            res.put("saved", true);
            res.put("hasToken", true);
            res.put("maskedToken", maskToken(clean));
            res.put("secureStorageAvailable", true);
            res.put("hardwareBackedKeystore", isKeyHardwareBacked());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to encrypt token in AndroidKeyStore.", "SECURE_STORAGE_FAILED");
        }
    }

    @PluginMethod
    public void disconnect(final PluginCall call) {
        Context context = getContext();
        if (context != null) {
            clearStoredToken(context);
        }
        JSObject res = new JSObject();
        res.put("disconnected", true);
        res.put("hasToken", false);
        call.resolve(res);
    }

    private static final String[] FORBIDDEN_TOP_KEYS = new String[] {
        "after_datetime",
        "before_datetime",
        "title_search",
        "participant_scope",
        "attendance",
        "team",
        "meeting_type"
    };

    private static final Set<String> ALLOWED_LIST_TOP_KEYS = new HashSet<>(Arrays.asList(
        "cursor",
        "filter",
        "include"
    ));

    private static final Set<String> ALLOWED_DETAILS_TOP_KEYS = new HashSet<>(Arrays.asList(
        "include"
    ));

    private static final Set<String> ALLOWED_FILTER_KEYS = new HashSet<>(Arrays.asList(
        "before_datetime",
        "after_datetime",
        "participant_scope",
        "title_search",
        "team",
        "meeting_type",
        "attendance"
    ));

    private static final String[] BOOLEAN_INCLUDE_KEYS = new String[] {
        "highlights",
        "participants",
        "ai_action_items",
        "ai_summary",
        "private_notes",
        "calendar_event",
        "hubspot",
        "screenshares",
        "sensitivity_matches"
    };

    private static final Set<String> ALLOWED_INCLUDE_KEYS = new HashSet<>(Arrays.asList(
        "highlights",
        "participants",
        "ai_action_items",
        "ai_summary",
        "private_notes",
        "calendar_event",
        "hubspot",
        "screenshares",
        "sensitivity_matches",
        "ai_template_sections"
    ));

    @Nullable
    private org.json.JSONObject sanitizeAndroidInclude(@Nullable org.json.JSONObject rawInc) throws org.json.JSONException {
        if (rawInc == null) return null;
        Iterator<String> keys = rawInc.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            if (!ALLOWED_INCLUDE_KEYS.contains(k)) {
                throw new IllegalArgumentException("Unknown include field \"" + k + "\" is not allowed in Grain API v2.");
            }
        }
        org.json.JSONObject out = new org.json.JSONObject();
        for (String key : BOOLEAN_INCLUDE_KEYS) {
            if (rawInc.optBoolean(key, false)) {
                out.put(key, true);
            }
        }
        Object atsObj = rawInc.opt("ai_template_sections");
        if (atsObj instanceof org.json.JSONObject) {
            org.json.JSONObject ats = (org.json.JSONObject) atsObj;
            org.json.JSONObject cleanAts = new org.json.JSONObject();
            String fmt = ats.optString("format", "json");
            if (!"json".equals(fmt) && !"markdown".equals(fmt) && !"text".equals(fmt)) {
                fmt = "json";
            }
            cleanAts.put("format", fmt);
            org.json.JSONArray allowed = ats.optJSONArray("allowed_sections");
            if (allowed != null && allowed.length() > 0) {
                org.json.JSONArray cleanAllowed = new org.json.JSONArray();
                for (int i = 0; i < allowed.length(); i++) {
                    String s = allowed.optString(i, "").trim();
                    if (!s.isEmpty()) cleanAllowed.put(s);
                }
                if (cleanAllowed.length() > 0) {
                    cleanAts.put("allowed_sections", cleanAllowed);
                }
            }
            out.put("ai_template_sections", cleanAts);
        } else if (Boolean.TRUE.equals(atsObj)) {
            org.json.JSONObject cleanAts = new org.json.JSONObject();
            cleanAts.put("format", "json");
            out.put("ai_template_sections", cleanAts);
        }
        return out.length() > 0 ? out : null;
    }

    @NonNull
    private String sanitizeAndroidGrainPayload(@NonNull String operation, @Nullable String rawJson) throws Exception {
        org.json.JSONObject p = new org.json.JSONObject();
        if (rawJson != null && !rawJson.trim().isEmpty()) {
            p = new org.json.JSONObject(rawJson.trim());
        }
        org.json.JSONObject body = new org.json.JSONObject();
        if ("list_recordings".equals(operation)) {
            for (String fk : FORBIDDEN_TOP_KEYS) {
                if (p.has(fk)) {
                    throw new IllegalArgumentException("Field \"" + fk + "\" must be nested inside \"filter\", not sent as a top-level field.");
                }
            }
            Iterator<String> topKeys = p.keys();
            while (topKeys.hasNext()) {
                String k = topKeys.next();
                if (!ALLOWED_LIST_TOP_KEYS.contains(k)) {
                    throw new IllegalArgumentException("Unknown top-level field \"" + k + "\" is not allowed in list_recordings.");
                }
            }
            String cursor = p.optString("cursor", "").trim();
            if (!cursor.isEmpty()) {
                body.put("cursor", cursor);
            }
            org.json.JSONObject rawFilter = p.optJSONObject("filter");
            if (rawFilter != null) {
                Iterator<String> fKeys = rawFilter.keys();
                while (fKeys.hasNext()) {
                    String fk = fKeys.next();
                    if (!ALLOWED_FILTER_KEYS.contains(fk)) {
                        throw new IllegalArgumentException("Unknown filter field \"" + fk + "\" is not allowed in Grain API v2.");
                    }
                }
                org.json.JSONObject f = new org.json.JSONObject();
                String beforeDt = rawFilter.optString("before_datetime", "").trim();
                if (!beforeDt.isEmpty()) f.put("before_datetime", beforeDt.replaceAll("\\.\\d{3}Z$", "Z"));
                String afterDt = rawFilter.optString("after_datetime", "").trim();
                if (!afterDt.isEmpty()) f.put("after_datetime", afterDt.replaceAll("\\.\\d{3}Z$", "Z"));
                String att = rawFilter.optString("attendance", "").trim();
                if ("hosted".equals(att) || "attended".equals(att)) f.put("attendance", att);
                String scope = rawFilter.optString("participant_scope", "").trim();
                if ("internal".equals(scope) || "external".equals(scope)) f.put("participant_scope", scope);
                String titleSearch = rawFilter.optString("title_search", "").trim();
                if (!titleSearch.isEmpty()) f.put("title_search", titleSearch);
                String team = rawFilter.optString("team", "").trim();
                if (!team.isEmpty()) f.put("team", team);
                String meetingType = rawFilter.optString("meeting_type", "").trim();
                if (!meetingType.isEmpty()) f.put("meeting_type", meetingType);
                if (f.length() > 0) body.put("filter", f);
            }
            org.json.JSONObject cleanInc = sanitizeAndroidInclude(p.optJSONObject("include"));
            if (cleanInc != null) body.put("include", cleanInc);
            return body.toString();
        }
        if ("recording_details".equals(operation)) {
            Iterator<String> topKeys = p.keys();
            while (topKeys.hasNext()) {
                String k = topKeys.next();
                if (!ALLOWED_DETAILS_TOP_KEYS.contains(k)) {
                    throw new IllegalArgumentException("Unknown top-level field \"" + k + "\" is not allowed in recording_details.");
                }
            }
            org.json.JSONObject cleanInc = sanitizeAndroidInclude(p.optJSONObject("include"));
            if (cleanInc != null) body.put("include", cleanInc);
            return body.toString();
        }
        return "{}";
    }

    @PluginMethod
    public void executeGrainOperation(final PluginCall call) {
        final Context context = getContext();
        if (context == null) {
            call.reject("Android context unavailable", "CONTEXT_UNAVAILABLE");
            return;
        }
        final String token = loadDecryptedToken(context);
        if (token == null || token.isEmpty()) {
            call.reject("Grain Personal Access Token is not configured.", "TOKEN_MISSING");
            return;
        }

        final String operation = call.getString("operation", "");
        final String recordingId = call.getString("recordingId", "");
        final String payloadJson = call.getString("payloadJson", "{}");

        ioExecutor.execute(() -> {
            try {
                String path;
                String method;
                String bodyToSend = null;

                if ("token_info".equals(operation)) {
                    path = "/_/public-api/v2/token-info";
                    method = "GET";
                } else if ("list_recordings".equals(operation)) {
                    path = "/_/public-api/v2/recordings";
                    method = "POST";
                    try {
                        bodyToSend = sanitizeAndroidGrainPayload("list_recordings", payloadJson);
                    } catch (Exception e) {
                        JSObject errRes = new JSObject();
                        errRes.put("httpStatus", 400);
                        errRes.put("bodyText", "{\"error\":\"bad_request\",\"message\":\"" + e.getMessage().replace("\"", "'") + "\"}");
                        call.resolve(errRes);
                        return;
                    }
                } else if ("recording_details".equals(operation)) {
                    if (recordingId == null || !SAFE_RECORDING_ID.matcher(recordingId.trim()).matches()) {
                        call.reject("Invalid recordingId parameter.", "BAD_REQUEST");
                        return;
                    }
                    path = "/_/public-api/v2/recordings/" + recordingId.trim();
                    method = "POST";
                    try {
                        bodyToSend = sanitizeAndroidGrainPayload("recording_details", payloadJson);
                    } catch (Exception e) {
                        JSObject errRes = new JSObject();
                        errRes.put("httpStatus", 400);
                        errRes.put("bodyText", "{\"error\":\"bad_request\",\"message\":\"" + e.getMessage().replace("\"", "'") + "\"}");
                        call.resolve(errRes);
                        return;
                    }
                } else if ("recording_transcript".equals(operation)) {
                    if (recordingId == null || !SAFE_RECORDING_ID.matcher(recordingId.trim()).matches()) {
                        call.reject("Invalid recordingId parameter.", "BAD_REQUEST");
                        return;
                    }
                    path = "/_/public-api/v2/recordings/" + recordingId.trim() + "/transcript";
                    method = "GET";
                } else {
                    call.reject("Unsupported Grain operation.", "UNSUPPORTED_OPERATION");
                    return;
                }

                URL url = new URL(GRAIN_API_ORIGIN + path);
                if (!"https".equalsIgnoreCase(url.getProtocol()) || !"api.grain.com".equalsIgnoreCase(url.getHost())) {
                    call.reject("Forbidden target host.", "FORBIDDEN_HOST");
                    return;
                }

                HttpsURLConnection conn = (HttpsURLConnection) url.openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(12000);
                conn.setReadTimeout(12000);
                conn.setInstanceFollowRedirects(false);
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Public-Api-Version", GRAIN_API_VERSION);
                conn.setRequestProperty("Accept", "application/json");

                if ("POST".equals(method) && bodyToSend != null) {
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    byte[] outBytes = bodyToSend.getBytes(StandardCharsets.UTF_8);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(outBytes);
                    }
                }

                int status = conn.getResponseCode();
                if (status >= 300 && status < 400) {
                    conn.disconnect();
                    JSObject redirectErr = new JSObject();
                    redirectErr.put("httpStatus", 502);
                    redirectErr.put("bodyText", "{\"error\":\"redirect_forbidden\",\"message\":\"Upstream redirect refused for security.\"}");
                    call.resolve(redirectErr);
                    return;
                }
                String retryAfter = conn.getHeaderField("Retry-After");
                InputStream stream = (status >= 200 && status < 300) ? conn.getInputStream() : conn.getErrorStream();
                StringBuilder responseBody = new StringBuilder();
                if (stream != null) {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            responseBody.append(line).append('\n');
                        }
                    }
                }
                conn.disconnect();

                JSObject result = new JSObject();
                result.put("httpStatus", status);
                if (retryAfter != null) {
                    result.put("retryAfter", retryAfter);
                }
                result.put("bodyText", responseBody.toString().trim());
                call.resolve(result);
            } catch (Exception ex) {
                call.reject("Network error communicating with Grain API.", "NETWORK_ERROR");
            }
        });
    }
}

