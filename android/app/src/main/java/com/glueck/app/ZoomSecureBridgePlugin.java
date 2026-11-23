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
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ProtocolException;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Native Capacitor 8 plugin for secure Zoom Server-to-Server OAuth integration on Android.
 *
 * Security Architecture:
 * 1. Hardware-backed AndroidKeyStore (AES/GCM/NoPadding, 256-bit) encrypts Zoom S2S OAuth
 *    credentials (accountId, clientId, clientSecret) before storing ciphertext in private
 *    SharedPreferences.
 * 2. Raw clientSecret and OAuth access_token values are NEVER returned to WebView JavaScript
 *    or logged.
 * 3. All Zoom HTTPS requests execute natively in Java with strict host whitelisting
 *    (https://zoom.us/oauth/token and https://api.zoom.us/v2/...), bypassing WebView CORS
 *    and eliminating any dependency on a local/remote Express backend on Android.
 * 4. Excluded from Android Auto Backup and device-to-device transfer via backup_rules.xml
 *    and data_extraction_rules.xml.
 */
@CapacitorPlugin(name = "ZoomSecureBridge")
public class ZoomSecureBridgePlugin extends Plugin {
    private static final String TAG = "ZoomSecureBridge";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "com.glueck.app.zoom_s2s_aes_key_v1";
    private static final String PREFS_NAME = "com.glueck.app.zoom_secure_vault";
    private static final String PREF_CIPHERTEXT = "zoom_s2s_ciphertext";
    private static final String PREF_IV = "zoom_s2s_iv";
    private static final String PREF_MASKED_ACCOUNT_ID = "zoom_masked_account_id";
    private static final String PREF_MASKED_CLIENT_ID = "zoom_masked_client_id";
    private static final String PREF_DEFAULT_TIMEZONE = "zoom_default_timezone";
    private static final String PREF_PLAN_TYPE = "zoom_plan_type";
    private static final String PREF_IS_BASIC_PLAN = "zoom_is_basic_plan";
    private static final String PREF_HOST_EMAIL = "zoom_host_email";
    private static final String PREF_UPDATED_AT = "zoom_updated_at";

    private static final String ZOOM_OAUTH_TOKEN_URL = "https://zoom.us/oauth/token";
    private static final String ZOOM_API_BASE_URL = "https://api.zoom.us/v2";
    private static final String DEFAULT_TIMEZONE = "Africa/Cairo";

    private final ExecutorService ioExecutor = Executors.newCachedThreadPool();

    // Ephemeral in-memory OAuth access token cache (never written to disk or sent to JS)
    private volatile String cachedAccessToken = null;
    private volatile long cachedAccessTokenExpiresAtMs = 0L;

    private static class HttpResult {
        final int status;
        final String bodyText;
        final String retryAfter;

        HttpResult(int status, String bodyText, @Nullable String retryAfter) {
            this.status = status;
            this.bodyText = bodyText != null ? bodyText : "";
            this.retryAfter = retryAfter;
        }
    }

    private static class TokenResult {
        final boolean ok;
        final int status;
        final String accessToken;
        final String error;

        TokenResult(boolean ok, int status, @Nullable String accessToken, @Nullable String error) {
            this.ok = ok;
            this.status = status;
            this.accessToken = accessToken;
            this.error = error;
        }
    }

    private static class ProfileResult {
        final boolean ok;
        final String email;
        final String userId;
        final String planType;
        final boolean isBasicPlan;
        final int status;
        final String error;

        ProfileResult(
            boolean ok,
            @Nullable String email,
            @Nullable String userId,
            @NonNull String planType,
            boolean isBasicPlan,
            int status,
            @Nullable String error
        ) {
            this.ok = ok;
            this.email = email;
            this.userId = userId;
            this.planType = planType;
            this.isBasicPlan = isBasicPlan;
            this.status = status;
            this.error = error;
        }
    }

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

    private String normalizeCredential(@Nullable String raw) {
        if (raw == null) return "";
        String s = raw.replaceAll("[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFEFF\\u00A0]", "").trim();
        s = s.replaceAll("^[\"'`]+|[\"'`]+$", "").trim();
        return s.replaceAll("\\s+", "");
    }

    private String maskCredential(@Nullable String val) {
        String clean = val != null ? val.trim() : "";
        if (clean.length() <= 6) {
            return "••••••";
        }
        return clean.substring(0, 3) + "••••••••" + clean.substring(clean.length() - 4);
    }

    private void storeEncryptedCredentials(@NonNull Context context, @NonNull JSONObject payload) throws Exception {
        SecretKey secretKey = getOrCreateSecretKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(payload.toString().getBytes(StandardCharsets.UTF_8));

        String maskedAccountId = maskCredential(payload.optString("accountId", ""));
        String maskedClientId = maskCredential(payload.optString("clientId", ""));
        String defaultTimezone = payload.optString("defaultTimezone", DEFAULT_TIMEZONE);
        if (defaultTimezone.trim().isEmpty()) defaultTimezone = DEFAULT_TIMEZONE;
        String planType = payload.optString("planType", "unknown");
        boolean isBasicPlan = payload.optBoolean("isBasicPlan", false);
        String hostEmail = payload.optString("hostEmail", "");
        String updatedAt = payload.optString("updatedAt", String.valueOf(System.currentTimeMillis()));

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit()
            .putString(PREF_CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
            .putString(PREF_MASKED_ACCOUNT_ID, maskedAccountId)
            .putString(PREF_MASKED_CLIENT_ID, maskedClientId)
            .putString(PREF_DEFAULT_TIMEZONE, defaultTimezone)
            .putString(PREF_PLAN_TYPE, planType)
            .putBoolean(PREF_IS_BASIC_PLAN, isBasicPlan)
            .putString(PREF_UPDATED_AT, updatedAt);
        if (!hostEmail.isEmpty()) {
            editor.putString(PREF_HOST_EMAIL, hostEmail);
        } else {
            editor.remove(PREF_HOST_EMAIL);
        }
        editor.apply();
    }

    @Nullable
    private JSONObject loadDecryptedCredentials(@NonNull Context context) {
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
            return new JSONObject(new String(decrypted, StandardCharsets.UTF_8));
        } catch (Exception e) {
            Log.w(TAG, "Unable to decrypt stored Zoom credentials from AndroidKeyStore");
            return null;
        }
    }

    private void clearStoredCredentials(@NonNull Context context) {
        cachedAccessToken = null;
        cachedAccessTokenExpiresAtMs = 0L;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS);
            }
        } catch (Exception e) {
            Log.w(TAG, "Notice while clearing Zoom key alias");
        }
    }

    private HttpResult performZoomHttps(
        @NonNull String urlString,
        @NonNull String method,
        @NonNull String authHeader,
        @Nullable String contentType,
        @Nullable String body,
        int retriesLeft
    ) {
        HttpsURLConnection conn = null;
        try {
            URL url = new URL(urlString);
            String host = url.getHost() != null ? url.getHost().toLowerCase() : "";
            boolean allowedHost = "zoom.us".equals(host) || "api.zoom.us".equals(host);
            if (!"https".equalsIgnoreCase(url.getProtocol()) || !allowedHost) {
                return new HttpResult(400, "{\"message\":\"Forbidden target host.\"}", null);
            }

            conn = (HttpsURLConnection) url.openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setInstanceFollowRedirects(false);

            try {
                conn.setRequestMethod(method);
            } catch (ProtocolException pe) {
                if ("PATCH".equalsIgnoreCase(method)) {
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
                } else {
                    throw pe;
                }
            }

            conn.setRequestProperty("Authorization", authHeader);
            conn.setRequestProperty("Accept", "application/json");

            if (("POST".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method))
                && body != null) {
                conn.setDoOutput(true);
                conn.setRequestProperty(
                    "Content-Type",
                    contentType != null ? contentType : "application/json; charset=utf-8"
                );
                byte[] outBytes = body.getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(outBytes.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(outBytes);
                }
            }

            int status = conn.getResponseCode();
            if (status >= 300 && status < 400) {
                return new HttpResult(502, "{\"message\":\"Upstream redirect refused for security.\"}", null);
            }

            String retryAfter = conn.getHeaderField("Retry-After");
            InputStream stream = (status >= 200 && status < 300) ? conn.getInputStream() : conn.getErrorStream();
            StringBuilder sb = new StringBuilder();
            if (stream != null) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append('\n');
                    }
                }
            }

            if ((status == 429 || status >= 500) && retriesLeft > 0) {
                long waitMs = Math.min(3500L, 450L * (4L - Math.min(3, retriesLeft)));
                if (retryAfter != null) {
                    try {
                        waitMs = Math.min(5000L, Math.max(400L, Long.parseLong(retryAfter.trim()) * 1000L));
                    } catch (NumberFormatException ignored) {}
                }
                try {
                    Thread.sleep(waitMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
                return performZoomHttps(urlString, method, authHeader, contentType, body, retriesLeft - 1);
            }

            return new HttpResult(status, sb.toString().trim(), retryAfter);
        } catch (Exception ex) {
            if (retriesLeft > 0) {
                try {
                    Thread.sleep(Math.min(3000L, 450L * (4L - Math.min(3, retriesLeft))));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
                return performZoomHttps(urlString, method, authHeader, contentType, body, retriesLeft - 1);
            }
            String errMsg = ex.getMessage() != null ? ex.getMessage().replace("\"", "'") : "Zoom network timeout";
            return new HttpResult(502, "{\"message\":\"" + errMsg + "\"}", null);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private TokenResult getZoomAccessToken(@NonNull JSONObject creds, boolean forceRefresh) {
        long now = System.currentTimeMillis();
        if (!forceRefresh && cachedAccessToken != null && cachedAccessTokenExpiresAtMs > now + 5L * 60L * 1000L) {
            return new TokenResult(true, 200, cachedAccessToken, null);
        }

        String accountId = creds.optString("accountId", "").trim();
        String clientId = creds.optString("clientId", "").trim();
        String clientSecret = creds.optString("clientSecret", "").trim();

        String rawBasic = clientId + ":" + clientSecret;
        String basicB64 = Base64.encodeToString(rawBasic.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);

        String formBody;
        try {
            formBody = "grant_type=account_credentials&account_id=" + URLEncoder.encode(accountId, "UTF-8");
        } catch (Exception e) {
            formBody = "grant_type=account_credentials&account_id=" + accountId;
        }

        HttpResult res = performZoomHttps(
            ZOOM_OAUTH_TOKEN_URL,
            "POST",
            "Basic " + basicB64,
            "application/x-www-form-urlencoded",
            formBody,
            1
        );

        if (res.status < 200 || res.status >= 300) {
            String zoomReason = "Zoom Server-to-Server OAuth authentication failed (HTTP " + res.status + ").";
            try {
                JSONObject errJson = new JSONObject(res.bodyText);
                String reason = errJson.optString("reason", "");
                String desc = errJson.optString("error_description", "");
                String msg = errJson.optString("message", "");
                if (!reason.isEmpty()) zoomReason = reason;
                else if (!desc.isEmpty()) zoomReason = desc;
                else if (!msg.isEmpty()) zoomReason = msg;
            } catch (Exception ignored) {}
            String detailed = zoomReason
                + " (Tip: Ensure your Zoom Server-to-Server app is Activated in the Zoom App Marketplace, Account ID / Client ID / Client Secret are in their respective fields, and scopes meeting:write:admin, meeting:read:admin, user:read:admin are enabled).";
            return new TokenResult(false, res.status, null, detailed);
        }

        try {
            JSONObject parsed = new JSONObject(res.bodyText);
            String accessToken = parsed.optString("access_token", "").trim();
            long expiresInSec = Math.max(120L, parsed.optLong("expires_in", 3600L));
            if (accessToken.isEmpty()) {
                return new TokenResult(false, 502, null, "Zoom OAuth response omitted access_token.");
            }
            cachedAccessToken = accessToken;
            cachedAccessTokenExpiresAtMs = System.currentTimeMillis() + expiresInSec * 1000L;
            return new TokenResult(true, 200, accessToken, null);
        } catch (Exception e) {
            return new TokenResult(false, 502, null, "Invalid JSON response from Zoom OAuth server.");
        }
    }

    private ProfileResult probeHostProfile(@NonNull String accessToken) {
        HttpResult res = performZoomHttps(
            ZOOM_API_BASE_URL + "/users/me",
            "GET",
            "Bearer " + accessToken,
            null,
            null,
            1
        );

        if (res.status < 200 || res.status >= 300) {
            String msg = "Zoom /users/me check returned HTTP " + res.status;
            try {
                JSONObject errJson = new JSONObject(res.bodyText);
                String m = errJson.optString("message", "");
                if (!m.isEmpty()) msg = m;
            } catch (Exception ignored) {}
            return new ProfileResult(false, null, null, "unknown", false, res.status, msg);
        }

        try {
            JSONObject u = new JSONObject(res.bodyText);
            int userType = u.optInt("type", 0);
            String planType = userType == 1 ? "basic" : (userType >= 2 ? "licensed" : "unknown");
            boolean isBasic = "basic".equals(planType);
            String email = u.optString("email", "");
            String userId = u.optString("id", "");
            return new ProfileResult(
                true,
                email.isEmpty() ? null : email,
                userId.isEmpty() ? null : userId,
                planType,
                isBasic,
                res.status,
                null
            );
        } catch (Exception e) {
            return new ProfileResult(true, null, null, "unknown", false, res.status, null);
        }
    }

    private HttpResult performZoomApiWithRefresh(
        @NonNull JSONObject creds,
        @NonNull String apiPath,
        @NonNull String method,
        @Nullable String jsonBody
    ) {
        TokenResult tokenRes = getZoomAccessToken(creds, false);
        if (!tokenRes.ok || tokenRes.accessToken == null) {
            String safeErr = (tokenRes.error != null ? tokenRes.error : "OAuth token unavailable.").replace("\"", "'");
            return new HttpResult(tokenRes.status == 400 || tokenRes.status == 401 ? 401 : 502, "{\"message\":\"" + safeErr + "\"}", null);
        }

        HttpResult res = performZoomHttps(
            ZOOM_API_BASE_URL + apiPath,
            method,
            "Bearer " + tokenRes.accessToken,
            jsonBody != null ? "application/json; charset=utf-8" : null,
            jsonBody,
            3
        );

        if (res.status == 401) {
            TokenResult refreshed = getZoomAccessToken(creds, true);
            if (refreshed.ok && refreshed.accessToken != null) {
                res = performZoomHttps(
                    ZOOM_API_BASE_URL + apiPath,
                    method,
                    "Bearer " + refreshed.accessToken,
                    jsonBody != null ? "application/json; charset=utf-8" : null,
                    jsonBody,
                    0
                );
            }
        }
        return res;
    }

    private String extractZoomApiErrorMessage(@NonNull HttpResult apiRes, @NonNull String fallbackPrefix) {
        String msg = fallbackPrefix + " (HTTP " + apiRes.status + ")";
        try {
            JSONObject errObj = new JSONObject(apiRes.bodyText);
            String m = errObj.optString("message", "");
            if (!m.isEmpty()) msg = m;
        } catch (Exception ignored) {}
        return msg;
    }

    @PluginMethod
    public void getStatus(final PluginCall call) {
        Context context = getContext();
        JSObject res = new JSObject();
        if (context == null) {
            res.put("ok", false);
            res.put("httpStatus", 500);
            res.put("secureStorageAvailable", false);
            res.put("hasCredentials", false);
            call.resolve(res);
            return;
        }

        JSONObject creds = loadDecryptedCredentials(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        res.put("ok", true);
        res.put("httpStatus", 200);
        res.put("secureStorageAvailable", true);
        res.put("hardwareBackedKeystore", isKeyHardwareBacked());
        res.put("runtime", "android");

        if (creds == null) {
            res.put("hasCredentials", false);
            res.put("defaultTimezone", prefs.getString(PREF_DEFAULT_TIMEZONE, DEFAULT_TIMEZONE));
            res.put("planType", "unknown");
            res.put("isBasicPlan", false);
            res.put("maxMeetingMinutes", JSONObject.NULL);
            call.resolve(res);
            return;
        }

        boolean isBasic = prefs.getBoolean(PREF_IS_BASIC_PLAN, creds.optBoolean("isBasicPlan", false));
        res.put("hasCredentials", true);
        res.put("maskedAccountId", prefs.getString(PREF_MASKED_ACCOUNT_ID, maskCredential(creds.optString("accountId", ""))));
        res.put("maskedClientId", prefs.getString(PREF_MASKED_CLIENT_ID, maskCredential(creds.optString("clientId", ""))));
        res.put("defaultTimezone", prefs.getString(PREF_DEFAULT_TIMEZONE, creds.optString("defaultTimezone", DEFAULT_TIMEZONE)));
        res.put("planType", prefs.getString(PREF_PLAN_TYPE, creds.optString("planType", "unknown")));
        res.put("isBasicPlan", isBasic);
        res.put("maxMeetingMinutes", isBasic ? 40 : JSONObject.NULL);
        String email = prefs.getString(PREF_HOST_EMAIL, creds.optString("hostEmail", ""));
        res.put("hostEmail", email != null && !email.isEmpty() ? email : JSONObject.NULL);
        res.put("updatedAt", prefs.getString(PREF_UPDATED_AT, creds.optString("updatedAt", "")));
        call.resolve(res);
    }

    @PluginMethod
    public void connect(final PluginCall call) {
        final Context context = getContext();
        if (context == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 500);
            out.put("saved", false);
            out.put("error", "Android context unavailable.");
            call.resolve(out);
            return;
        }

        final String accountId = normalizeCredential(call.getString("accountId", ""));
        final String clientId = normalizeCredential(call.getString("clientId", ""));
        final String clientSecret = normalizeCredential(call.getString("clientSecret", ""));
        String tzRaw = call.getString("defaultTimezone", DEFAULT_TIMEZONE);
        final String defaultTimezone = (tzRaw != null && !tzRaw.trim().isEmpty()) ? tzRaw.trim() : DEFAULT_TIMEZONE;

        if (accountId.length() < 6 || clientId.length() < 6 || clientSecret.length() < 8) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 400);
            out.put("saved", false);
            out.put("error", "Account ID, Client ID, and Client Secret are required and appear too short.");
            call.resolve(out);
            return;
        }

        ioExecutor.execute(() -> {
            try {
                cachedAccessToken = null;
                cachedAccessTokenExpiresAtMs = 0L;

                JSONObject tempCreds = new JSONObject();
                tempCreds.put("accountId", accountId);
                tempCreds.put("clientId", clientId);
                tempCreds.put("clientSecret", clientSecret);
                tempCreds.put("defaultTimezone", defaultTimezone);
                tempCreds.put("updatedAt", String.valueOf(System.currentTimeMillis()));

                TokenResult tokenRes = getZoomAccessToken(tempCreds, true);
                if (!tokenRes.ok || tokenRes.accessToken == null) {
                    JSObject errOut = new JSObject();
                    errOut.put("ok", false);
                    errOut.put("httpStatus", tokenRes.status == 400 || tokenRes.status == 401 ? 401 : 502);
                    errOut.put("saved", false);
                    errOut.put("connected", false);
                    errOut.put("error", tokenRes.error != null ? tokenRes.error : "Zoom Server-to-Server OAuth verification failed.");
                    call.resolve(errOut);
                    return;
                }

                ProfileResult profileRes = probeHostProfile(tokenRes.accessToken);
                tempCreds.put("planType", profileRes.ok ? profileRes.planType : "unknown");
                tempCreds.put("isBasicPlan", profileRes.ok && profileRes.isBasicPlan);
                if (profileRes.email != null) tempCreds.put("hostEmail", profileRes.email);
                if (profileRes.userId != null) tempCreds.put("hostUserId", profileRes.userId);

                storeEncryptedCredentials(context, tempCreds);

                JSObject okOut = new JSObject();
                okOut.put("ok", true);
                okOut.put("httpStatus", 200);
                okOut.put("saved", true);
                okOut.put("connected", true);
                okOut.put("maskedAccountId", maskCredential(accountId));
                okOut.put("maskedClientId", maskCredential(clientId));
                okOut.put("defaultTimezone", defaultTimezone);
                okOut.put("planType", profileRes.ok ? profileRes.planType : "unknown");
                okOut.put("isBasicPlan", profileRes.ok && profileRes.isBasicPlan);
                okOut.put("maxMeetingMinutes", (profileRes.ok && profileRes.isBasicPlan) ? 40 : JSONObject.NULL);
                okOut.put("hostEmail", profileRes.email != null ? profileRes.email : JSONObject.NULL);
                if (!profileRes.ok && profileRes.error != null) {
                    okOut.put("profileCheckWarning", profileRes.error);
                }
                call.resolve(okOut);
            } catch (Exception ex) {
                JSObject errOut = new JSObject();
                errOut.put("ok", false);
                errOut.put("httpStatus", 500);
                errOut.put("saved", false);
                errOut.put("connected", false);
                errOut.put("error", "Failed to encrypt and save Zoom credentials in AndroidKeyStore.");
                call.resolve(errOut);
            }
        });
    }

    @PluginMethod
    public void testConnection(final PluginCall call) {
        final Context context = getContext();
        if (context == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 500);
            out.put("connected", false);
            out.put("error", "Android context unavailable.");
            call.resolve(out);
            return;
        }

        final JSONObject creds = loadDecryptedCredentials(context);
        if (creds == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 404);
            out.put("connected", false);
            out.put("error", "Zoom credentials are not configured.");
            call.resolve(out);
            return;
        }

        ioExecutor.execute(() -> {
            try {
                TokenResult tokenRes = getZoomAccessToken(creds, true);
                if (!tokenRes.ok || tokenRes.accessToken == null) {
                    JSObject out = new JSObject();
                    out.put("ok", true);
                    out.put("httpStatus", 200);
                    out.put("connected", false);
                    out.put("error", tokenRes.error != null ? tokenRes.error : "OAuth token refresh failed.");
                    call.resolve(out);
                    return;
                }

                ProfileResult profileRes = probeHostProfile(tokenRes.accessToken);
                if (profileRes.ok) {
                    creds.put("planType", profileRes.planType);
                    creds.put("isBasicPlan", profileRes.isBasicPlan);
                    if (profileRes.email != null) creds.put("hostEmail", profileRes.email);
                    if (profileRes.userId != null) creds.put("hostUserId", profileRes.userId);
                    storeEncryptedCredentials(context, creds);
                }

                JSObject out = new JSObject();
                out.put("ok", true);
                out.put("httpStatus", 200);
                out.put("connected", true);
                out.put("planType", profileRes.planType);
                out.put("isBasicPlan", profileRes.isBasicPlan);
                out.put("maxMeetingMinutes", profileRes.isBasicPlan ? 40 : JSONObject.NULL);
                String email = profileRes.email != null ? profileRes.email : creds.optString("hostEmail", "");
                out.put("hostEmail", !email.isEmpty() ? email : JSONObject.NULL);
                out.put("defaultTimezone", creds.optString("defaultTimezone", DEFAULT_TIMEZONE));
                if (!profileRes.ok && profileRes.error != null) {
                    out.put("profileCheckWarning", profileRes.error);
                }
                call.resolve(out);
            } catch (Exception ex) {
                JSObject out = new JSObject();
                out.put("ok", false);
                out.put("httpStatus", 500);
                out.put("connected", false);
                out.put("error", "Zoom connection test failed on Android.");
                call.resolve(out);
            }
        });
    }

    @PluginMethod
    public void updateSettings(final PluginCall call) {
        Context context = getContext();
        String tzRaw = call.getString("defaultTimezone", DEFAULT_TIMEZONE);
        String defaultTimezone = (tzRaw != null && !tzRaw.trim().isEmpty()) ? tzRaw.trim() : DEFAULT_TIMEZONE;

        if (context == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 500);
            out.put("saved", false);
            out.put("error", "Android context unavailable.");
            call.resolve(out);
            return;
        }

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(PREF_DEFAULT_TIMEZONE, defaultTimezone).apply();
            JSONObject creds = loadDecryptedCredentials(context);
            if (creds != null) {
                creds.put("defaultTimezone", defaultTimezone);
                creds.put("updatedAt", String.valueOf(System.currentTimeMillis()));
                storeEncryptedCredentials(context, creds);
            }
            JSObject out = new JSObject();
            out.put("ok", true);
            out.put("httpStatus", 200);
            out.put("saved", true);
            out.put("defaultTimezone", defaultTimezone);
            call.resolve(out);
        } catch (Exception ex) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 500);
            out.put("saved", false);
            out.put("error", "Failed to update Zoom timezone settings.");
            call.resolve(out);
        }
    }

    @PluginMethod
    public void disconnect(final PluginCall call) {
        Context context = getContext();
        if (context != null) {
            clearStoredCredentials(context);
        }
        JSObject out = new JSObject();
        out.put("ok", true);
        out.put("httpStatus", 200);
        out.put("disconnected", true);
        out.put("hasCredentials", false);
        call.resolve(out);
    }

    @PluginMethod
    public void createMeeting(final PluginCall call) {
        final Context context = getContext();
        if (context == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 500);
            out.put("error", "Android context unavailable.");
            call.resolve(out);
            return;
        }

        final JSONObject creds = loadDecryptedCredentials(context);
        if (creds == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 401);
            out.put("code", "CREDENTIALS_MISSING");
            out.put("error", "Zoom credentials are not configured.");
            call.resolve(out);
            return;
        }

        final String topic = (call.getString("topic", "") != null ? call.getString("topic", "").trim() : "");
        final String startTime = (call.getString("startTime", "") != null ? call.getString("startTime", "").trim() : "");
        if (topic.isEmpty() || startTime.isEmpty()) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 400);
            out.put("error", "topic and startTime are required to create a Zoom meeting.");
            call.resolve(out);
            return;
        }

        Integer durationBoxed = call.getInt("duration", 60);
        final int duration = Math.max(15, Math.min(300, durationBoxed != null ? durationBoxed : 60));
        String tzArg = call.getString("timezone", "");
        final String timezone = (tzArg != null && !tzArg.trim().isEmpty())
            ? tzArg.trim()
            : creds.optString("defaultTimezone", DEFAULT_TIMEZONE);
        Integer weeklyDayBoxed = call.getInt("weeklyDay", 2);
        final int weeklyDay = Math.max(1, Math.min(7, weeklyDayBoxed != null ? weeklyDayBoxed : 2));
        Integer repeatBoxed = call.getInt("repeatInterval", 1);
        final int repeatInterval = (repeatBoxed != null && repeatBoxed == 2) ? 2 : 1;
        Boolean waitingRoomBoxed = call.getBoolean("waitingRoom", false);
        final boolean waitingRoom = Boolean.TRUE.equals(waitingRoomBoxed);
        final String autoRecording = "cloud".equals(call.getString("autoRecording", "none")) ? "cloud" : "none";

        ioExecutor.execute(() -> {
            try {
                JSONObject recurrence = new JSONObject();
                recurrence.put("type", 2);
                recurrence.put("repeat_interval", repeatInterval);
                recurrence.put("weekly_days", String.valueOf(weeklyDay));
                recurrence.put("end_times", 50);

                JSONObject settings = new JSONObject();
                settings.put("host_video", true);
                settings.put("participant_video", true);
                settings.put("join_before_host", false);
                settings.put("mute_upon_entry", true);
                settings.put("waiting_room", waitingRoom);
                settings.put("auto_recording", autoRecording);

                JSONObject meetingBody = new JSONObject();
                meetingBody.put("topic", topic.length() > 200 ? topic.substring(0, 200) : topic);
                meetingBody.put("type", 8);
                meetingBody.put("start_time", startTime);
                meetingBody.put("duration", duration);
                meetingBody.put("timezone", timezone);
                meetingBody.put("recurrence", recurrence);
                meetingBody.put("settings", settings);

                HttpResult apiRes = performZoomApiWithRefresh(
                    creds,
                    "/users/me/meetings",
                    "POST",
                    meetingBody.toString()
                );

                if (apiRes.status < 200 || apiRes.status >= 300) {
                    JSObject errOut = new JSObject();
                    errOut.put("ok", false);
                    errOut.put("httpStatus", apiRes.status == 429 ? 429 : 502);
                    if (apiRes.status == 429) errOut.put("code", "RATE_LIMITED");
                    errOut.put("error", extractZoomApiErrorMessage(apiRes, "Zoom API error"));
                    if (apiRes.retryAfter != null) errOut.put("retryAfter", apiRes.retryAfter);
                    call.resolve(errOut);
                    return;
                }

                JSONObject m = new JSONObject(apiRes.bodyText);
                boolean isBasicPlan = creds.optBoolean("isBasicPlan", false);
                JSObject okOut = new JSObject();
                okOut.put("ok", true);
                okOut.put("httpStatus", 200);
                okOut.put("zoomMeetingId", m.has("id") ? String.valueOf(m.get("id")) : "");
                okOut.put("joinUrl", m.optString("join_url", ""));
                if (m.has("start_url") && !m.isNull("start_url")) {
                    okOut.put("startUrl", m.optString("start_url", ""));
                }
                if (m.has("password") && !m.isNull("password")) {
                    okOut.put("meetingPasscode", m.optString("password", ""));
                }
                okOut.put("topic", m.optString("topic", topic));
                okOut.put("timezone", m.optString("timezone", timezone));
                String hostEmail = creds.optString("hostEmail", "");
                if (!hostEmail.isEmpty()) okOut.put("hostEmail", hostEmail);
                okOut.put("planWarning40Min", isBasicPlan && duration >= 41);
                call.resolve(okOut);
            } catch (Exception ex) {
                JSObject errOut = new JSObject();
                errOut.put("ok", false);
                errOut.put("httpStatus", 502);
                errOut.put("error", "Invalid response returned by Zoom API while creating meeting.");
                call.resolve(errOut);
            }
        });
    }

    @PluginMethod
    public void updateMeeting(final PluginCall call) {
        final Context context = getContext();
        if (context == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 500);
            out.put("error", "Android context unavailable.");
            call.resolve(out);
            return;
        }

        final String rawId = call.getString("meetingId", "");
        final String meetingId = rawId != null ? rawId.replaceAll("[^0-9]", "") : "";
        if (meetingId.length() < 8) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 400);
            out.put("error", "Valid numeric Zoom meetingId is required.");
            call.resolve(out);
            return;
        }

        final JSONObject creds = loadDecryptedCredentials(context);
        if (creds == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 401);
            out.put("error", "Zoom credentials are not configured.");
            call.resolve(out);
            return;
        }

        final String topic = (call.getString("topic", "") != null ? call.getString("topic", "").trim() : "");
        final String startTime = (call.getString("startTime", "") != null ? call.getString("startTime", "").trim() : "");
        Integer durationBoxed = call.getInt("duration", 60);
        final int duration = Math.max(15, Math.min(300, durationBoxed != null ? durationBoxed : 60));
        String tzArg = call.getString("timezone", "");
        final String timezone = (tzArg != null && !tzArg.trim().isEmpty())
            ? tzArg.trim()
            : creds.optString("defaultTimezone", DEFAULT_TIMEZONE);
        Integer weeklyDayBoxed = call.getInt("weeklyDay", 2);
        final int weeklyDay = Math.max(1, Math.min(7, weeklyDayBoxed != null ? weeklyDayBoxed : 2));
        Integer repeatBoxed = call.getInt("repeatInterval", 1);
        final int repeatInterval = (repeatBoxed != null && repeatBoxed == 2) ? 2 : 1;
        Boolean waitingRoomBoxed = call.getBoolean("waitingRoom", false);
        final boolean waitingRoom = Boolean.TRUE.equals(waitingRoomBoxed);

        ioExecutor.execute(() -> {
            try {
                JSONObject recurrence = new JSONObject();
                recurrence.put("type", 2);
                recurrence.put("repeat_interval", repeatInterval);
                recurrence.put("weekly_days", String.valueOf(weeklyDay));
                recurrence.put("end_times", 50);

                JSONObject settings = new JSONObject();
                settings.put("waiting_room", waitingRoom);

                JSONObject patchBody = new JSONObject();
                patchBody.put("type", 8);
                patchBody.put("duration", duration);
                patchBody.put("timezone", timezone);
                patchBody.put("recurrence", recurrence);
                patchBody.put("settings", settings);
                if (!topic.isEmpty()) {
                    patchBody.put("topic", topic.length() > 200 ? topic.substring(0, 200) : topic);
                }
                if (!startTime.isEmpty()) {
                    patchBody.put("start_time", startTime);
                }

                HttpResult apiRes = performZoomApiWithRefresh(
                    creds,
                    "/meetings/" + meetingId,
                    "PATCH",
                    patchBody.toString()
                );

                if (apiRes.status < 200 || apiRes.status >= 300) {
                    JSObject errOut = new JSObject();
                    errOut.put("ok", false);
                    errOut.put("httpStatus", apiRes.status == 404 ? 404 : (apiRes.status == 429 ? 429 : 502));
                    errOut.put("error", extractZoomApiErrorMessage(apiRes, "Zoom PATCH error"));
                    call.resolve(errOut);
                    return;
                }

                boolean isBasicPlan = creds.optBoolean("isBasicPlan", false);
                JSObject okOut = new JSObject();
                okOut.put("ok", true);
                okOut.put("httpStatus", 200);
                okOut.put("updated", true);
                okOut.put("zoomMeetingId", meetingId);
                if (!topic.isEmpty()) okOut.put("topic", topic);
                okOut.put("planWarning40Min", isBasicPlan && duration >= 41);
                call.resolve(okOut);
            } catch (Exception ex) {
                JSObject errOut = new JSObject();
                errOut.put("ok", false);
                errOut.put("httpStatus", 502);
                errOut.put("error", "Failed to update Zoom meeting on Android.");
                call.resolve(errOut);
            }
        });
    }

    @PluginMethod
    public void listMeetings(final PluginCall call) {
        final Context context = getContext();
        if (context == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 500);
            out.put("error", "Android context unavailable.");
            call.resolve(out);
            return;
        }

        final JSONObject creds = loadDecryptedCredentials(context);
        if (creds == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 401);
            out.put("code", "CREDENTIALS_MISSING");
            out.put("error", "Zoom credentials are not configured.");
            call.resolve(out);
            return;
        }

        String rawType = call.getString("type", "scheduled");
        final String listType = ("live".equals(rawType) || "upcoming".equals(rawType) || "scheduled".equals(rawType))
            ? rawType
            : "scheduled";
        Integer pageSizeBoxed = call.getInt("pageSize", 300);
        final int pageSize = Math.max(1, Math.min(300, pageSizeBoxed != null ? pageSizeBoxed : 300));
        final String nextPageToken = call.getString("nextPageToken", "");

        ioExecutor.execute(() -> {
            try {
                StringBuilder path = new StringBuilder("/users/me/meetings?type=")
                    .append(URLEncoder.encode(listType, "UTF-8"))
                    .append("&page_size=")
                    .append(pageSize);
                if (nextPageToken != null && !nextPageToken.trim().isEmpty()) {
                    path.append("&next_page_token=").append(URLEncoder.encode(nextPageToken.trim(), "UTF-8"));
                }

                HttpResult apiRes = performZoomApiWithRefresh(creds, path.toString(), "GET", null);
                if (apiRes.status < 200 || apiRes.status >= 300) {
                    int outStatus = (apiRes.status == 401 || apiRes.status == 403 || apiRes.status == 429 || apiRes.status >= 500)
                        ? apiRes.status
                        : 502;
                    JSObject errOut = new JSObject();
                    errOut.put("ok", false);
                    errOut.put("httpStatus", outStatus);
                    if (apiRes.status == 429) errOut.put("code", "RATE_LIMITED");
                    else if (apiRes.status == 401) errOut.put("code", "UNAUTHORIZED");
                    else if (apiRes.status == 403) errOut.put("code", "FORBIDDEN");
                    errOut.put("error", extractZoomApiErrorMessage(apiRes, "Zoom list meetings error"));
                    if (apiRes.retryAfter != null) errOut.put("retryAfter", apiRes.retryAfter);
                    call.resolve(errOut);
                    return;
                }

                JSONObject parsed = new JSONObject(apiRes.bodyText);
                JSONArray rawMeetings = parsed.optJSONArray("meetings");
                JSArray safeMeetings = new JSArray();
                if (rawMeetings != null) {
                    for (int i = 0; i < rawMeetings.length(); i++) {
                        JSONObject m = rawMeetings.optJSONObject(i);
                        if (m == null) continue;
                        JSObject item = new JSObject();
                        item.put("id", m.has("id") && !m.isNull("id") ? String.valueOf(m.get("id")) : "");
                        if (m.has("uuid") && !m.isNull("uuid")) item.put("uuid", m.optString("uuid", ""));
                        if (m.has("host_id") && !m.isNull("host_id")) item.put("hostId", m.optString("host_id", ""));
                        item.put("topic", m.optString("topic", ""));
                        item.put("type", m.optInt("type", 0));
                        if (m.has("start_time") && !m.isNull("start_time")) item.put("startTime", m.optString("start_time", ""));
                        if (m.has("duration") && !m.isNull("duration")) item.put("duration", m.optInt("duration", 0));
                        if (m.has("timezone") && !m.isNull("timezone")) item.put("timezone", m.optString("timezone", ""));
                        if (m.has("created_at") && !m.isNull("created_at")) item.put("createdAt", m.optString("created_at", ""));
                        item.put("joinUrl", m.optString("join_url", ""));
                        if (m.has("status") && !m.isNull("status")) item.put("status", m.optString("status", ""));
                        safeMeetings.put(item);
                    }
                }

                JSObject okOut = new JSObject();
                okOut.put("ok", true);
                okOut.put("httpStatus", 200);
                okOut.put("meetings", safeMeetings);
                String outNextToken = parsed.optString("next_page_token", "");
                okOut.put("nextPageToken", outNextToken != null ? outNextToken.trim() : "");
                okOut.put("pageCount", parsed.optInt("page_count", 1));
                okOut.put("pageSize", parsed.optInt("page_size", pageSize));
                okOut.put("totalRecords", parsed.optInt("total_records", safeMeetings.length()));
                String hostEmail = creds.optString("hostEmail", "");
                okOut.put("hostEmail", !hostEmail.isEmpty() ? hostEmail : JSONObject.NULL);
                okOut.put("hostScope", "single_connected_host");
                call.resolve(okOut);
            } catch (Exception ex) {
                JSObject errOut = new JSObject();
                errOut.put("ok", false);
                errOut.put("httpStatus", 502);
                errOut.put("error", "Invalid JSON returned by Zoom while listing meetings.");
                call.resolve(errOut);
            }
        });
    }

    @PluginMethod
    public void getMeeting(final PluginCall call) {
        final Context context = getContext();
        if (context == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 500);
            out.put("error", "Android context unavailable.");
            call.resolve(out);
            return;
        }

        final String rawId = call.getString("meetingId", "");
        final String meetingId = rawId != null ? rawId.replaceAll("[^0-9]", "") : "";
        if (meetingId.length() < 8) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 400);
            out.put("error", "Valid numeric Zoom meetingId is required.");
            call.resolve(out);
            return;
        }

        final JSONObject creds = loadDecryptedCredentials(context);
        if (creds == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 401);
            out.put("error", "Zoom credentials are not configured.");
            call.resolve(out);
            return;
        }

        ioExecutor.execute(() -> {
            try {
                HttpResult apiRes = performZoomApiWithRefresh(creds, "/meetings/" + meetingId, "GET", null);
                if (apiRes.status < 200 || apiRes.status >= 300) {
                    int outStatus = (apiRes.status == 401 || apiRes.status == 403 || apiRes.status == 404 || apiRes.status == 429 || apiRes.status >= 500)
                        ? apiRes.status
                        : 502;
                    JSObject errOut = new JSObject();
                    errOut.put("ok", false);
                    errOut.put("httpStatus", outStatus);
                    errOut.put("exists", apiRes.status != 404);
                    errOut.put("error", extractZoomApiErrorMessage(apiRes, "Zoom inspect error"));
                    if (apiRes.retryAfter != null) errOut.put("retryAfter", apiRes.retryAfter);
                    call.resolve(errOut);
                    return;
                }

                JSONObject m = new JSONObject(apiRes.bodyText);
                JSObject okOut = new JSObject();
                okOut.put("ok", true);
                okOut.put("httpStatus", 200);
                okOut.put("exists", true);
                okOut.put("zoomMeetingId", m.has("id") ? String.valueOf(m.get("id")) : meetingId);
                if (m.has("type") && !m.isNull("type")) {
                    okOut.put("type", m.optInt("type", 2));
                }
                okOut.put("topic", m.optString("topic", ""));
                okOut.put("joinUrl", m.optString("join_url", ""));
                if (m.has("start_url") && !m.isNull("start_url")) {
                    okOut.put("startUrl", m.optString("start_url", ""));
                }
                if (m.has("password") && !m.isNull("password")) {
                    okOut.put("meetingPasscode", m.optString("password", ""));
                }
                if (m.has("start_time") && !m.isNull("start_time")) {
                    okOut.put("startTime", m.optString("start_time", ""));
                }
                if (m.has("duration") && !m.isNull("duration")) {
                    okOut.put("duration", m.optInt("duration", 0));
                }
                if (m.has("timezone") && !m.isNull("timezone")) {
                    okOut.put("timezone", m.optString("timezone", ""));
                }
                if (m.has("recurrence") && !m.isNull("recurrence")) {
                    JSONObject rec = m.optJSONObject("recurrence");
                    if (rec != null) {
                        JSObject recOut = new JSObject();
                        if (rec.has("type")) recOut.put("type", rec.optInt("type", 2));
                        if (rec.has("repeat_interval")) recOut.put("repeatInterval", rec.optInt("repeat_interval", 1));
                        if (rec.has("weekly_days") && !rec.isNull("weekly_days")) {
                            recOut.put("weeklyDays", String.valueOf(rec.get("weekly_days")));
                        }
                        okOut.put("recurrence", recOut);
                    }
                }
                if (m.has("occurrences") && !m.isNull("occurrences")) {
                    org.json.JSONArray occArr = m.optJSONArray("occurrences");
                    if (occArr != null) {
                        com.getcapacitor.JSArray occOut = new com.getcapacitor.JSArray();
                        int maxOcc = Math.min(3, occArr.length());
                        for (int i = 0; i < maxOcc; i++) {
                            JSONObject occ = occArr.optJSONObject(i);
                            if (occ != null) {
                                JSObject o = new JSObject();
                                if (occ.has("occurrence_id")) o.put("occurrenceId", String.valueOf(occ.get("occurrence_id")));
                                if (occ.has("start_time")) o.put("startTime", occ.optString("start_time", ""));
                                if (occ.has("duration")) o.put("duration", occ.optInt("duration", 0));
                                if (occ.has("status")) o.put("status", occ.optString("status", ""));
                                occOut.put(o);
                            }
                        }
                        okOut.put("occurrences", occOut);
                    }
                }
                okOut.put("status", m.optString("status", "waiting"));
                call.resolve(okOut);
            } catch (Exception ex) {
                JSObject errOut = new JSObject();
                errOut.put("ok", false);
                errOut.put("httpStatus", 502);
                errOut.put("error", "Invalid JSON returned from Zoom.");
                call.resolve(errOut);
            }
        });
    }

    @PluginMethod
    public void deleteMeeting(final PluginCall call) {
        final Context context = getContext();
        if (context == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 500);
            out.put("error", "Android context unavailable.");
            call.resolve(out);
            return;
        }

        final String rawId = call.getString("meetingId", "");
        final String meetingId = rawId != null ? rawId.replaceAll("[^0-9]", "") : "";
        if (meetingId.length() < 8) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 400);
            out.put("error", "Valid numeric Zoom meetingId is required.");
            call.resolve(out);
            return;
        }

        final JSONObject creds = loadDecryptedCredentials(context);
        if (creds == null) {
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("httpStatus", 401);
            out.put("error", "Zoom credentials are not configured.");
            call.resolve(out);
            return;
        }

        ioExecutor.execute(() -> {
            // Never pass occurrence_id so recurring series are deleted completely
            HttpResult apiRes = performZoomApiWithRefresh(creds, "/meetings/" + meetingId, "DELETE", null);
            if (apiRes.status == 404) {
                JSObject notFoundOut = new JSObject();
                notFoundOut.put("ok", false);
                notFoundOut.put("httpStatus", 404);
                notFoundOut.put("deleted", false);
                notFoundOut.put("alreadyDeletedCandidate", true);
                notFoundOut.put("zoomMeetingId", meetingId);
                notFoundOut.put("error", extractZoomApiErrorMessage(apiRes, "Zoom meeting not found (404)"));
                call.resolve(notFoundOut);
                return;
            }
            if (apiRes.status != 204 && (apiRes.status < 200 || apiRes.status >= 300)) {
                int outStatus = (apiRes.status == 401 || apiRes.status == 403 || apiRes.status == 429 || apiRes.status >= 500)
                    ? apiRes.status
                    : 502;
                JSObject errOut = new JSObject();
                errOut.put("ok", false);
                errOut.put("httpStatus", outStatus);
                errOut.put("deleted", false);
                if (apiRes.status == 429) errOut.put("code", "RATE_LIMITED");
                else if (apiRes.status == 401) errOut.put("code", "UNAUTHORIZED");
                else if (apiRes.status == 403) errOut.put("code", "FORBIDDEN");
                errOut.put("error", extractZoomApiErrorMessage(apiRes, "Zoom DELETE error"));
                if (apiRes.retryAfter != null) errOut.put("retryAfter", apiRes.retryAfter);
                call.resolve(errOut);
                return;
            }
            JSObject okOut = new JSObject();
            okOut.put("ok", true);
            okOut.put("httpStatus", 200);
            okOut.put("deleted", true);
            okOut.put("zoomMeetingId", meetingId);
            call.resolve(okOut);
        });
    }
}
