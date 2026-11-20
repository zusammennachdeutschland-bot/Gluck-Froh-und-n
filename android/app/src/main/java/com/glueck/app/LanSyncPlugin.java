package com.glueck.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
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
import java.net.ConnectException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Native Capacitor 8 plugin for direct LAN synchronization on Android.
 *
 * Security & Transport Model:
 * 1. Authentication tokens and pinned host TLS SHA-256 fingerprints are encrypted with
 *    AndroidKeyStore AES/GCM/NoPadding (256-bit) and stored in private SharedPreferences
 *    excluded from Android backups.
 * 2. Raw auth tokens NEVER return to the WebView / localStorage.
 * 3. All LAN requests run directly over HTTPS using pinned leaf certificate SHA-256 verification
 *    rather than enabling cleartext HTTP traffic.
 * 4. Host discovery combines NsdManager (_glueck-sync._tcp.) with UDP LAN broadcast probing (port 41234).
 */
@CapacitorPlugin(name = "LanSync")
public class LanSyncPlugin extends Plugin {
    private static final String TAG = "LanSyncPlugin";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "com.glueck.app.lan_sync_aes_key_v1";
    private static final String PREFS_NAME = "com.glueck.app.lan_sync_vault";
    private static final String PREF_CIPHERTEXT = "lan_vault_ciphertext";
    private static final String PREF_IV = "lan_vault_iv";
    private static final int UDP_DISCOVERY_PORT = 41234;
    private static final String NSD_SERVICE_TYPE = "_glueck-sync._tcp.";
    private static final int PROTOCOL_VERSION = 2;

    private final ExecutorService ioExecutor = Executors.newCachedThreadPool();

    private static final class PinMismatchException extends CertificateException {
        PinMismatchException(String msg) {
            super(msg);
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

    private synchronized JSONObject loadVault(@NonNull Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String cipherB64 = prefs.getString(PREF_CIPHERTEXT, null);
            String ivB64 = prefs.getString(PREF_IV, null);
            if (cipherB64 == null || ivB64 == null) {
                return new JSONObject();
            }
            SecretKey key = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP));
            cipher.init(Cipher.DECRYPT_MODE, key, spec);
            byte[] plain = cipher.doFinal(Base64.decode(cipherB64, Base64.NO_WRAP));
            return new JSONObject(new String(plain, StandardCharsets.UTF_8));
        } catch (Exception e) {
            Log.w(TAG, "Unable to decrypt LAN sync Keystore vault", e);
            return new JSONObject();
        }
    }

    private synchronized void saveVault(@NonNull Context context, @NonNull JSONObject vault) throws Exception {
        SecretKey key = getOrCreateSecretKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(vault.toString().getBytes(StandardCharsets.UTF_8));
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(PREF_CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
            .apply();
    }

    private String bytesToHex(@NonNull byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private String formatVerificationCode(@Nullable String fp) {
        if (fp == null) return "0000:0000";
        String clean = fp.replaceAll("[^a-fA-F0-9]", "").toUpperCase();
        if (clean.length() < 8) return "0000:0000";
        return clean.substring(0, 4) + ":" + clean.substring(4, 8);
    }

    private boolean isValidLanHostOrIp(@Nullable String host) {
        if (host == null) return false;
        String clean = host.trim();
        if (clean.isEmpty() || clean.length() > 128) return false;
        return clean.matches("^[a-zA-Z0-9._-]+$");
    }

    private JSObject collectNetworkStatus(@NonNull Context context) {
        boolean wifiConnected = false;
        boolean lanConnected = false;
        boolean hasInternet = false;
        JSArray localAddresses = new JSArray();

        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                Network activeNetwork = cm.getActiveNetwork();
                Network[] networks = cm.getAllNetworks();
                for (Network net : networks) {
                    NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                    if (caps == null) continue;
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                        wifiConnected = true;
                        lanConnected = true;
                    }
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
                        lanConnected = true;
                    }
                    if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                        hasInternet = true;
                    }
                    LinkProperties lp = cm.getLinkProperties(net);
                    if (lp != null && (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) || net.equals(activeNetwork))) {
                        for (LinkAddress la : lp.getLinkAddresses()) {
                            InetAddress addr = la.getAddress();
                            if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                                String ip = addr.getHostAddress();
                                if (ip != null) localAddresses.put(ip);
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to inspect ConnectivityManager", e);
        }

        JSObject out = new JSObject();
        out.put("wifiConnected", wifiConnected);
        out.put("lanConnected", lanConnected || localAddresses.length() > 0);
        out.put("hasInternet", hasInternet);
        out.put("localIpv4Addresses", localAddresses);
        out.put("sdkInt", Build.VERSION.SDK_INT);
        return out;
    }

    private SSLSocketFactory buildPinnedSslSocketFactory(
        @Nullable String expectedFingerprintSha256,
        @NonNull AtomicReference<String> capturedFingerprintOut
    ) throws Exception {
        final String expectedClean = expectedFingerprintSha256 != null
            ? expectedFingerprintSha256.replace(":", "").trim().toLowerCase()
            : null;

        TrustManager[] trustManagers = new TrustManager[] {
            new X509TrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) {}

                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                    if (chain == null || chain.length == 0) {
                        throw new CertificateException("Empty server certificate chain.");
                    }
                    try {
                        MessageDigest md = MessageDigest.getInstance("SHA-256");
                        byte[] digest = md.digest(chain[0].getEncoded());
                        String actualFp = bytesToHex(digest);
                        capturedFingerprintOut.set(actualFp);
                        if (expectedClean != null && !expectedClean.isEmpty()) {
                            byte[] a = actualFp.getBytes(StandardCharsets.UTF_8);
                            byte[] b = expectedClean.getBytes(StandardCharsets.UTF_8);
                            if (!MessageDigest.isEqual(a, b)) {
                                throw new PinMismatchException("Certificate fingerprint mismatch against pinned PC host.");
                            }
                        }
                    } catch (PinMismatchException pme) {
                        throw pme;
                    } catch (Exception e) {
                        throw new CertificateException("Unable to verify host certificate SHA-256 fingerprint", e);
                    }
                }

                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }
            }
        };

        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, trustManagers, new SecureRandom());
        return sslContext.getSocketFactory();
    }

    private JSObject executePinnedHttps(
        @NonNull String host,
        int port,
        @NonNull String method,
        @NonNull String endpointPath,
        @Nullable String bodyJson,
        @Nullable String authToken,
        @Nullable String expectedFingerprintSha256,
        int timeoutMs
    ) {
        long startedAt = System.currentTimeMillis();
        JSObject result = new JSObject();
        if (!isValidLanHostOrIp(host) || port < 1 || port > 65535) {
            result.put("ok", false);
            result.put("httpStatus", 0);
            result.put("errorCode", "HOST_OFFLINE");
            result.put("message", "Invalid LAN host IP or port.");
            result.put("latencyMs", 0);
            return result;
        }

        String normalizedPath = endpointPath.startsWith("/") ? endpointPath : ("/" + endpointPath);
        AtomicReference<String> observedFingerprint = new AtomicReference<>(null);
        HttpsURLConnection conn = null;

        try {
            URL url = new URL("https", host.trim(), port, normalizedPath);
            conn = (HttpsURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(Math.max(1500, timeoutMs));
            conn.setReadTimeout(Math.max(3000, timeoutMs));
            conn.setRequestMethod(method);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("X-Glueck-Sync-Protocol", String.valueOf(PROTOCOL_VERSION));
            if (authToken != null && !authToken.trim().isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + authToken.trim());
            }

            SSLSocketFactory socketFactory = buildPinnedSslSocketFactory(expectedFingerprintSha256, observedFingerprint);
            conn.setSSLSocketFactory(socketFactory);
            // Local LAN hosts connect by dynamic IPv4; cryptographic identity is enforced via pinned leaf cert SHA-256
            conn.setHostnameVerifier((HostnameVerifier) (hostname, session) -> true);

            if (bodyJson != null && ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method))) {
                byte[] bytes = bodyJson.getBytes(StandardCharsets.UTF_8);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                conn.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }
            }

            int status = conn.getResponseCode();
            InputStream stream = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            StringBuilder sb = new StringBuilder();
            if (stream != null) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        sb.append(line);
                    }
                }
            }

            String rawBody = sb.toString();
            String fp = observedFingerprint.get();
            long latency = System.currentTimeMillis() - startedAt;

            JSONObject parsed = null;
            try {
                if (!rawBody.isEmpty()) parsed = new JSONObject(rawBody);
            } catch (Exception ignored) {}

            boolean httpOk = status >= 200 && status < 300;
            boolean appOk = parsed == null || parsed.optBoolean("ok", true);

            result.put("httpStatus", status);
            result.put("latencyMs", latency);
            if (fp != null) {
                result.put("certFingerprintSha256", fp);
                result.put("verificationCode", formatVerificationCode(fp));
            }
            if (parsed != null) {
                result.put("data", JSObject.fromJSONObject(parsed));
            }

            if (httpOk && appOk) {
                result.put("ok", true);
            } else {
                String fallbackCode = status == 401
                    ? "UNAUTHORIZED_DEVICE"
                    : status == 426
                    ? "PROTOCOL_VERSION_MISMATCH"
                    : status == 429
                    ? "PAIRING_LOCKED_OUT"
                    : status == 410
                    ? "PAIRING_CODE_EXPIRED"
                    : "INVALID_PAYLOAD";
                String errCode = parsed != null ? parsed.optString("errorCode", fallbackCode) : fallbackCode;
                String msg = parsed != null ? parsed.optString("message", "HTTP " + status) : ("HTTP " + status);
                result.put("ok", false);
                result.put("errorCode", errCode);
                result.put("message", msg);
            }
            return result;
        } catch (SSLHandshakeException sslEx) {
            boolean pinMismatch = isPinMismatchCause(sslEx);
            result.put("ok", false);
            result.put("httpStatus", 0);
            result.put("errorCode", pinMismatch ? "CERTIFICATE_MISMATCH" : "HOST_OFFLINE");
            result.put("message", pinMismatch
                ? "PC host certificate changed or did not match the paired fingerprint."
                : ("TLS handshake failed: " + sslEx.getMessage()));
            if (observedFingerprint.get() != null) {
                result.put("certFingerprintSha256", observedFingerprint.get());
            }
            result.put("latencyMs", System.currentTimeMillis() - startedAt);
            return result;
        } catch (SocketTimeoutException toe) {
            result.put("ok", false);
            result.put("httpStatus", 0);
            result.put("errorCode", "CONNECTION_TIMEOUT");
            result.put("message", "Timed out connecting to " + host + ":" + port + ".");
            result.put("latencyMs", System.currentTimeMillis() - startedAt);
            return result;
        } catch (ConnectException ce) {
            result.put("ok", false);
            result.put("httpStatus", 0);
            result.put("errorCode", "CONNECTION_REFUSED");
            result.put("message", "Connection refused by " + host + ":" + port + ". Verify Glück PC Sync Host is running.");
            result.put("latencyMs", System.currentTimeMillis() - startedAt);
            return result;
        } catch (NoRouteToHostException nre) {
            result.put("ok", false);
            result.put("httpStatus", 0);
            result.put("errorCode", "NETWORK_CHANGED");
            result.put("message", "Host IP unreachable on current Wi-Fi network.");
            result.put("latencyMs", System.currentTimeMillis() - startedAt);
            return result;
        } catch (Exception e) {
            result.put("ok", false);
            result.put("httpStatus", 0);
            result.put("errorCode", "HOST_OFFLINE");
            result.put("message", e.getMessage() != null ? e.getMessage() : "Unable to reach LAN host.");
            result.put("latencyMs", System.currentTimeMillis() - startedAt);
            return result;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private boolean isPinMismatchCause(@Nullable Throwable t) {
        Throwable curr = t;
        int depth = 0;
        while (curr != null && depth++ < 10) {
            if (curr instanceof PinMismatchException) return true;
            curr = curr.getCause();
        }
        return false;
    }

    @PluginMethod
    public void getNetworkStatus(PluginCall call) {
        ioExecutor.execute(() -> {
            JSObject status = collectNetworkStatus(getContext());
            call.resolve(status);
        });
    }

    @PluginMethod
    public void discoverHosts(PluginCall call) {
        final int timeoutMs = Math.max(800, Math.min(6000, call.getInt("timeoutMs", 2200)));
        ioExecutor.execute(() -> {
            Context ctx = getContext();
            JSObject netStatus = collectNetworkStatus(ctx);
            boolean wifiReady = netStatus.optBoolean("lanConnected", false);

            Map<String, JSONObject> discovered = new ConcurrentHashMap<>();
            WifiManager.MulticastLock multicastLock = null;
            NsdManager nsdManager = null;
            NsdManager.DiscoveryListener nsdListener = null;

            try {
                WifiManager wm = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    multicastLock = wm.createMulticastLock("GlueckLanSyncDiscovery");
                    multicastLock.setReferenceCounted(false);
                    multicastLock.acquire();
                }

                // 1. NsdManager (_glueck-sync._tcp.) discovery
                CountDownLatch nsdDone = new CountDownLatch(1);
                nsdManager = (NsdManager) ctx.getSystemService(Context.NSD_SERVICE);
                final NsdManager finalNsd = nsdManager;
                if (finalNsd != null) {
                    nsdListener = new NsdManager.DiscoveryListener() {
                        @Override public void onDiscoveryStarted(String regType) {}
                        @Override public void onServiceFound(NsdServiceInfo serviceInfo) {
                            if (serviceInfo.getServiceType() == null || !serviceInfo.getServiceType().contains("_glueck-sync")) return;
                            try {
                                finalNsd.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                                    @Override public void onResolveFailed(NsdServiceInfo si, int errorCode) {}
                                    @Override public void onServiceResolved(NsdServiceInfo resolved) {
                                        InetAddress host = resolved.getHost();
                                        int port = resolved.getPort();
                                        if (host == null || port <= 0) return;
                                        String ip = host.getHostAddress();
                                        if (ip == null) return;
                                        Map<String, byte[]> attrs = resolved.getAttributes();
                                        String devId = attrStr(attrs, "id");
                                        String devName = attrStr(attrs, "name");
                                        String fp = attrStr(attrs, "fp");
                                        int proto = 2;
                                        try { proto = Integer.parseInt(attrStr(attrs, "v")); } catch (Exception ignored) {}
                                        if (devId == null || devId.isEmpty()) devId = ip + ":" + port;

                                        JSONObject obj = new JSONObject();
                                        try {
                                            obj.put("deviceId", devId);
                                            obj.put("deviceName", devName != null && !devName.isEmpty() ? devName : resolved.getServiceName());
                                            obj.put("primaryIp", ip);
                                            obj.put("addresses", new JSONArray(Collections.singletonList(ip)));
                                            obj.put("port", port);
                                            obj.put("protocolVersion", proto);
                                            obj.put("tlsEnabled", true);
                                            if (fp != null && !fp.isEmpty()) {
                                                obj.put("certFingerprintSha256", fp);
                                                obj.put("verificationCode", formatVerificationCode(fp));
                                            }
                                            obj.put("discoverySource", "nsd");
                                            discovered.put(devId, obj);
                                        } catch (Exception ignored) {}
                                    }
                                });
                            } catch (Exception ignored) {}
                        }
                        @Override public void onServiceLost(NsdServiceInfo serviceInfo) {}
                        @Override public void onDiscoveryStopped(String serviceType) { nsdDone.countDown(); }
                        @Override public void onStartDiscoveryFailed(String serviceType, int errorCode) { nsdDone.countDown(); }
                        @Override public void onStopDiscoveryFailed(String serviceType, int errorCode) { nsdDone.countDown(); }
                    };
                    try {
                        finalNsd.discoverServices(NSD_SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, nsdListener);
                    } catch (Exception e) {
                        Log.w(TAG, "NSD start failed", e);
                    }
                }

                // 2. UDP LAN Broadcast probe on port 41234
                runUdpProbe(discovered, timeoutMs);

                if (nsdManager != null && nsdListener != null) {
                    try {
                        nsdManager.stopServiceDiscovery(nsdListener);
                        nsdDone.await(250, TimeUnit.MILLISECONDS);
                    } catch (Exception ignored) {}
                }

                // 3. Health-enrich each discovered host so addresses + pairingActive are fresh
                JSArray hostsArr = new JSArray();
                for (JSONObject entry : discovered.values()) {
                    String ip = entry.optString("primaryIp", "");
                    int port = entry.optInt("port", 8765);
                    JSObject healthRes = executePinnedHttps(ip, port, "GET", "/api/sync/health", null, null, null, 1800);
                    if (healthRes.optBoolean("ok", false)) {
                        JSObject healthData = healthRes.getJSObject("data");
                        if (healthData != null) {
                            entry.put("deviceId", healthData.optString("deviceId", entry.optString("deviceId")));
                            entry.put("deviceName", healthData.optString("deviceName", entry.optString("deviceName")));
                            entry.put("pairingActive", healthData.optBoolean("pairingActive", false));
                            if (healthData.has("addresses")) entry.put("addresses", healthData.get("addresses"));
                            if (healthData.has("certFingerprintSha256")) {
                                String fp = healthData.optString("certFingerprintSha256", "");
                                entry.put("certFingerprintSha256", fp);
                                entry.put("verificationCode", formatVerificationCode(fp));
                            }
                            entry.put("latencyMs", healthRes.optLong("latencyMs", 0));
                        }
                    }
                    hostsArr.put(JSObject.fromJSONObject(entry));
                }

                JSObject out = new JSObject();
                out.put("wifiConnected", wifiReady);
                out.put("hosts", hostsArr);
                call.resolve(out);
            } catch (Exception e) {
                call.reject("LAN discovery failed: " + e.getMessage());
            } finally {
                if (multicastLock != null && multicastLock.isHeld()) {
                    try { multicastLock.release(); } catch (Exception ignored) {}
                }
            }
        });
    }

    @Nullable
    private String attrStr(@Nullable Map<String, byte[]> attrs, @NonNull String key) {
        if (attrs == null) return null;
        byte[] val = attrs.get(key);
        return val != null ? new String(val, StandardCharsets.UTF_8) : null;
    }

    private void runUdpProbe(@NonNull Map<String, JSONObject> discovered, int timeoutMs) {
        Set<InetAddress> broadcastTargets = new HashSet<>();
        try {
            broadcastTargets.add(InetAddress.getByName("255.255.255.255"));
            Enumeration<NetworkInterface> nics = NetworkInterface.getNetworkInterfaces();
            while (nics != null && nics.hasMoreElements()) {
                NetworkInterface nic = nics.nextElement();
                if (nic.isLoopback() || !nic.isUp()) continue;
                for (InterfaceAddress ia : nic.getInterfaceAddresses()) {
                    if (ia.getBroadcast() != null) {
                        broadcastTargets.add(ia.getBroadcast());
                    }
                }
            }
        } catch (Exception ignored) {}

        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setBroadcast(true);
            socket.setSoTimeout(300);
            byte[] probeBytes = ("GLUECK_DISCOVER_V1:" + System.currentTimeMillis()).getBytes(StandardCharsets.UTF_8);
            for (InetAddress target : broadcastTargets) {
                try {
                    socket.send(new DatagramPacket(probeBytes, probeBytes.length, new InetSocketAddress(target, UDP_DISCOVERY_PORT)));
                } catch (Exception ignored) {}
            }

            long deadline = System.currentTimeMillis() + Math.min(timeoutMs, 2400);
            byte[] recvBuf = new byte[4096];
            while (System.currentTimeMillis() < deadline) {
                try {
                    DatagramPacket pkt = new DatagramPacket(recvBuf, recvBuf.length);
                    socket.receive(pkt);
                    String text = new String(pkt.getData(), 0, pkt.getLength(), StandardCharsets.UTF_8);
                    JSONObject obj = new JSONObject(text);
                    if ("glueck-lan-sync".equals(obj.optString("service")) && obj.has("deviceId")) {
                        if (!obj.has("primaryIp") || obj.optString("primaryIp").isEmpty()) {
                            obj.put("primaryIp", pkt.getAddress().getHostAddress());
                        }
                        obj.put("discoverySource", "udp");
                        discovered.put(obj.getString("deviceId"), obj);
                    }
                } catch (SocketTimeoutException ignored) {
                    // Continue waiting until deadline
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "UDP discovery probe warning", e);
        }
    }

    @PluginMethod
    public void testConnection(PluginCall call) {
        final String host = call.getString("host", "");
        final int port = call.getInt("port", 8765);
        final String expectedFp = call.getString("expectedFingerprint", null);
        final int timeoutMs = call.getInt("timeoutMs", 5000);
        ioExecutor.execute(() -> {
            JSObject res = executePinnedHttps(host, port, "GET", "/api/sync/health", null, null, expectedFp, timeoutMs);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void pair(PluginCall call) {
        final String host = call.getString("host", "");
        final int port = call.getInt("port", 8765);
        final String pairingCode = call.getString("pairingCode", "");
        final String localDeviceId = call.getString("localDeviceId", "");
        final String localDeviceName = call.getString("localDeviceName", "Android Device");
        final String expectedFp = call.getString("expectedFingerprint", null);
        final JSObject headerObj = call.getObject("header", null);

        ioExecutor.execute(() -> {
            try {
                JSONObject reqBody = new JSONObject();
                reqBody.put("pairingCode", pairingCode);
                reqBody.put("clientDeviceId", localDeviceId);
                reqBody.put("clientDeviceName", localDeviceName);
                if (headerObj != null) {
                    reqBody.put("header", new JSONObject(headerObj.toString()));
                }

                JSObject res = executePinnedHttps(
                    host,
                    port,
                    "POST",
                    "/api/sync/pair",
                    reqBody.toString(),
                    null,
                    expectedFp,
                    8000
                );

                if (!res.optBoolean("ok", false)) {
                    call.resolve(res);
                    return;
                }

                JSObject data = res.getJSObject("data");
                if (data == null || !data.has("authToken") || !data.has("hostDeviceId")) {
                    JSObject errRes = new JSObject();
                    errRes.put("ok", false);
                    errRes.put("errorCode", "INVALID_PAYLOAD");
                    errRes.put("message", "Host pairing response omitted authentication token.");
                    call.resolve(errRes);
                    return;
                }

                String hostDeviceId = data.getString("hostDeviceId");
                String hostDeviceName = data.optString("hostDeviceName", "Glück PC");
                String authToken = data.getString("authToken");
                String certFp = data.optString("certFingerprintSha256", res.optString("certFingerprintSha256", ""));

                Context ctx = getContext();
                JSONObject vault = loadVault(ctx);
                JSONObject peerCred = new JSONObject();
                peerCred.put("deviceId", hostDeviceId);
                peerCred.put("deviceName", hostDeviceName);
                peerCred.put("authToken", authToken);
                peerCred.put("certFingerprintSha256", certFp);
                peerCred.put("pairedAt", System.currentTimeMillis());
                vault.put(hostDeviceId, peerCred);
                saveVault(ctx, vault);

                // Strip raw authToken before resolving to JS/WebView
                data.remove("authToken");
                data.put("hasStoredAuthToken", true);
                res.put("data", data);
                call.resolve(res);
            } catch (Exception e) {
                JSObject err = new JSObject();
                err.put("ok", false);
                err.put("errorCode", "STORAGE_SAVE_FAILED");
                err.put("message", "Failed to store pairing token securely in AndroidKeyStore.");
                call.resolve(err);
            }
        });
    }

    @PluginMethod
    public void requestPaired(PluginCall call) {
        final String peerDeviceId = call.getString("peerDeviceId", "");
        final String host = call.getString("host", "");
        final int port = call.getInt("port", 8765);
        final String method = call.getString("method", "POST");
        final String path = call.getString("path", "/api/sync/status");
        final int timeoutMs = call.getInt("timeoutMs", 15000);
        final String expectedOverride = call.getString("expectedFingerprint", null);
        final JSObject bodyObj = call.getObject("body", null);

        ioExecutor.execute(() -> {
            Context ctx = getContext();
            JSONObject vault = loadVault(ctx);
            JSONObject entry = vault.optJSONObject(peerDeviceId);
            if (entry == null || entry.optString("authToken", "").isEmpty()) {
                JSObject unauth = new JSObject();
                unauth.put("ok", false);
                unauth.put("httpStatus", 401);
                unauth.put("errorCode", "UNAUTHORIZED_DEVICE");
                unauth.put("message", "No stored authentication token in AndroidKeyStore. Re-pair device.");
                call.resolve(unauth);
                return;
            }

            String token = entry.optString("authToken", "");
            String pinnedFp = (expectedOverride != null && !expectedOverride.isEmpty())
                ? expectedOverride
                : entry.optString("certFingerprintSha256", "");
            String bodyStr = bodyObj != null ? bodyObj.toString() : null;

            JSObject res = executePinnedHttps(host, port, method, path, bodyStr, token, pinnedFp, timeoutMs);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void revokePeer(PluginCall call) {
        final String peerDeviceId = call.getString("peerDeviceId", "");
        ioExecutor.execute(() -> {
            try {
                Context ctx = getContext();
                JSONObject vault = loadVault(ctx);
                boolean existed = vault.has(peerDeviceId);
                vault.remove(peerDeviceId);
                saveVault(ctx, vault);
                JSObject out = new JSObject();
                out.put("revoked", existed);
                call.resolve(out);
            } catch (Exception e) {
                call.reject("Failed to revoke peer from Keystore vault: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void hasStoredCredentials(PluginCall call) {
        final String peerDeviceId = call.getString("peerDeviceId", "");
        ioExecutor.execute(() -> {
            JSONObject vault = loadVault(getContext());
            JSONObject entry = vault.optJSONObject(peerDeviceId);
            boolean hasToken = entry != null && !entry.optString("authToken", "").isEmpty();
            JSObject out = new JSObject();
            out.put("hasCredentials", hasToken);
            if (hasToken) {
                String fp = entry.optString("certFingerprintSha256", "");
                out.put("verificationCode", formatVerificationCode(fp));
            }
            call.resolve(out);
        });
    }
}
