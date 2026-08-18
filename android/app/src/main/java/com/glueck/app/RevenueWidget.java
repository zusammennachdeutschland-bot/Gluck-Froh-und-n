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

public class RevenueWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_revenue);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String revData = prefs.getString("widget_revenue", "{}");

        try {
            JSONObject obj = new JSONObject(revData);
            int today = obj.optInt("today", 0);
            int week = obj.optInt("week", 0);
            int month = obj.optInt("month", 0);
            int goal = obj.optInt("goal", 8000);
            int progress = Math.min(100, Math.max(0, (month * 100) / (goal > 0 ? goal : 1)));

            views.setTextViewText(R.id.rev_today, "€" + today);
            views.setTextViewText(R.id.rev_week, "€" + week);
            views.setTextViewText(R.id.rev_month, "€" + month);
            views.setTextViewText(R.id.rev_goal_label, "Monatsziel (€" + goal + ")");
            views.setTextViewText(R.id.rev_goal_percent, progress + "%");
            views.setProgressBar(R.id.rev_progress_bar, 100, progress, false);
        } catch (Exception e) {
            views.setTextViewText(R.id.rev_today, "€0");
            views.setTextViewText(R.id.rev_week, "€0");
            views.setTextViewText(R.id.rev_month, "€0");
            views.setProgressBar(R.id.rev_progress_bar, 100, 0, false);
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/reports"), context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 501, intent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
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
