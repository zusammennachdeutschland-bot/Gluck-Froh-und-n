package com.glueck.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import org.json.JSONArray;

public class UpcomingLessonsWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_upcoming_lessons);

        Intent intent = new Intent(context, UpcomingLessonsWidgetService.class);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        intent.setData(Uri.parse(intent.toUri(Intent.URI_INTENT_SCHEME)));

        views.setRemoteAdapter(R.id.upcoming_list_view, intent);
        views.setEmptyView(R.id.upcoming_list_view, R.id.upcoming_empty_view);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String upcomingData = prefs.getString("widget_upcoming_lessons", "[]");
        int count = 0;
        try {
            JSONArray arr = new JSONArray(upcomingData);
            count = arr.length();
        } catch (Exception ignored) {}

        views.setTextViewText(R.id.upcoming_count_badge, count + " Lektionen");

        Intent headerIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/schedule"), context, MainActivity.class);
        PendingIntent piHeader = PendingIntent.getActivity(context, 701, headerIntent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        views.setOnClickPendingIntent(R.id.widget_header, piHeader);

        Intent templateIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/schedule"), context, MainActivity.class);
        PendingIntent piTemplate = PendingIntent.getActivity(context, 702, templateIntent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
        views.setPendingIntentTemplate(R.id.upcoming_list_view, piTemplate);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.upcoming_list_view);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS);
            if (appWidgetIds != null) {
                for (int id : appWidgetIds) {
                    appWidgetManager.notifyAppWidgetViewDataChanged(id, R.id.upcoming_list_view);
                }
            }
        }
    }
}
