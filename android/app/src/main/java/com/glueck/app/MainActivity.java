package com.glueck.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetManagerPlugin.class);
        registerPlugin(LiveTimerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
