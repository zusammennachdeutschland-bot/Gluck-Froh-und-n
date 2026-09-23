package com.glueck.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
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
    }
}
