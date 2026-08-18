package com.glueck.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class CurrentLessonWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_current_lesson);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String activeData = prefs.getString("widget_active_session", "{}");

        try {
            JSONObject obj = new JSONObject(activeData);
            boolean isActive = obj.optBoolean("isActive", false);

            if (isActive) {
                String groupName = obj.optString("groupName", "Live Lektion");
                int attendanceCount = obj.optInt("attendanceCount", 0);
                long startTime = obj.optLong("startTime", System.currentTimeMillis());
                long elapsedSeconds = (System.currentTimeMillis() - startTime) / 1000;
                long mins = elapsedSeconds / 60;
                long secs = elapsedSeconds % 60;

                views.setTextViewText(R.id.current_status_badge, "🔴 LIVE LESSON");
                views.setTextViewText(R.id.current_elapsed_time, String.format("%02dm %02ds", mins, secs));
                views.setTextViewText(R.id.current_group_name, groupName);
                views.setTextViewText(R.id.current_student_count, "Anwesend: " + attendanceCount + " Schüler");
                views.setTextViewText(R.id.btn_action, "Lektion Beenden");
            } else {
                views.setTextViewText(R.id.current_status_badge, "⚪ OFFEN");
                views.setTextViewText(R.id.current_elapsed_time, "00:00");
                views.setTextViewText(R.id.current_group_name, "Keine aktive Lektion");
                views.setTextViewText(R.id.current_student_count, "Bereit für Start");
                views.setTextViewText(R.id.btn_action, "Lektion Starten");
            }
        } catch (Exception e) {
            views.setTextViewText(R.id.current_group_name, "Keine aktive Lektion");
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/active_lesson"), context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 201, intent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        views.setOnClickPendingIntent(R.id.widget_container, pi);
        views.setOnClickPendingIntent(R.id.btn_action, pi);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}
