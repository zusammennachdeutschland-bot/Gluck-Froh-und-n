package com.glueck.app;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiveTimer")
public class LiveTimerPlugin extends Plugin {

    @PluginMethod
    public void startTimer(PluginCall call) {
        String title = call.getString("title", "Live Unterricht");
        Double startTimeDouble = call.getDouble("startTime");
        long startTime = startTimeDouble != null ? startTimeDouble.longValue() : System.currentTimeMillis();
        
        Integer durationMins = call.getInt("durationMins", 60);
        Integer elapsedMins = call.getInt("elapsedMins", 0);
        Integer remainingMins = call.getInt("remainingMins", durationMins);
        Integer percent = call.getInt("percent", 0);

        Intent intent = new Intent(getContext(), LiveTimerService.class);
        intent.setAction(LiveTimerService.ACTION_START);
        intent.putExtra(LiveTimerService.EXTRA_TITLE, title);
        intent.putExtra(LiveTimerService.EXTRA_START_TIME, startTime);
        intent.putExtra(LiveTimerService.EXTRA_DURATION_MINS, durationMins != null ? durationMins : 60);
        intent.putExtra(LiveTimerService.EXTRA_ELAPSED_MINS, elapsedMins != null ? elapsedMins : 0);
        intent.putExtra(LiveTimerService.EXTRA_REMAINING_MINS, remainingMins != null ? remainingMins : 60);
        intent.putExtra(LiveTimerService.EXTRA_PERCENT, percent != null ? percent : 0);

        try {
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start LiveTimer service: " + e.getLocalizedMessage());
        }
    }

    @PluginMethod
    public void stopTimer(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), LiveTimerService.class);
            intent.setAction(LiveTimerService.ACTION_STOP);
            getContext().stopService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop LiveTimer service: " + e.getLocalizedMessage());
        }
    }
}
