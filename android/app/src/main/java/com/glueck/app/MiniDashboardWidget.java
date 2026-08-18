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

public class MiniDashboardWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mini_dashboard);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String dashData = prefs.getString("widget_mini_dashboard", "{}");

        try {
            JSONObject obj = new JSONObject(dashData);
            int lessonsToday = obj.optInt("lessonsToday", 0);
            int totalStudents = obj.optInt("totalStudents", 0);
            int attendanceRate = obj.optInt("attendanceRate", 100);
            int monthlyRev = obj.optInt("monthlyRev", 0);
            int overdueCount = obj.optInt("overdueCount", 0);

            views.setTextViewText(R.id.dash_lessons_today, String.valueOf(lessonsToday));
            views.setTextViewText(R.id.dash_total_students, String.valueOf(totalStudents));
            views.setTextViewText(R.id.dash_attendance_rate, attendanceRate + "%");
            views.setTextViewText(R.id.dash_monthly_rev, "€" + monthlyRev);
            views.setTextViewText(R.id.dash_overdue_count, overdueCount + " Schüler");
        } catch (Exception e) {
            views.setTextViewText(R.id.dash_lessons_today, "0");
            views.setTextViewText(R.id.dash_total_students, "0");
            views.setTextViewText(R.id.dash_attendance_rate, "100%");
            views.setTextViewText(R.id.dash_monthly_rev, "€0");
            views.setTextViewText(R.id.dash_overdue_count, "0 Schüler");
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/home"), context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 601, intent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        views.setOnClickPendingIntent(R.id.widget_container, pi);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}
