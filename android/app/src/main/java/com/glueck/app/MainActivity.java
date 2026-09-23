package com.glueck.app;

import android.os.Bundle;
import android.util.Log;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private long startupTime = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        startupTime = System.currentTimeMillis();

        // 1. Crash Shield: Prevent unhandled background thread/plugin exceptions from killing the app process
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "Caught unexpected background exception in thread " + thread.getName(), throwable);
            // If it's a fatal main thread exception, defer to default handler only if strictly needed
            if (thread.getId() != android.os.Looper.getMainLooper().getThread().getId()) {
                Log.w(TAG, "Suppressed background thread crash to keep UI alive.");
                return;
            }
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        try {
            SplashScreen.installSplashScreen(this);
        } catch (Throwable ignored) {}

        try {
            registerPlugin(WidgetManagerPlugin.class);
        } catch (Throwable ignored) {}

        try {
            registerPlugin(LiveTimerPlugin.class);
        } catch (Throwable ignored) {}

        super.onCreate(savedInstanceState);

        // 2. Prevent premature or synthetic back presses during first 5 seconds of launch
        try {
            getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    long now = System.currentTimeMillis();
                    if (now - startupTime < 5000) {
                        Log.d(TAG, "Ignored back press during app initialization grace period.");
                        return;
                    }
                    // Let Capacitor handle webview navigation or defer to home
                    if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
                        getBridge().getWebView().goBack();
                    } else {
                        // Minimize instead of terminating
                        moveTaskToBack(true);
                    }
                }
            });
        } catch (Throwable t) {
            Log.w(TAG, "Error registering back pressed callback", t);
        }
    }
}

