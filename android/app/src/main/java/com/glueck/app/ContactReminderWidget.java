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

public class ContactReminderWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_contact_remind);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String data = prefs.getString("widget_contact_reminders", "[]");
        int count = 0;
        try {
            JSONArray array = new JSONArray(data);
            count = array.length();
        } catch (Exception ignored) {}

        views.setTextViewText(R.id.tv_contacts_count, count + " طلاب");

        Intent intent = new Intent(context, ContactReminderWidgetService.class);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        intent.setData(Uri.parse(intent.toUri(Intent.URI_INTENT_SCHEME)));
        
        views.setRemoteAdapter(R.id.widget_contact_list, intent);
        views.setEmptyView(R.id.widget_contact_list, R.id.widget_empty_contact_view);

        // Header click opens app
        Intent headerIntent = new Intent(context, MainActivity.class);
        PendingIntent headerPendingIntent = PendingIntent.getActivity(
            context, 201, headerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.widget_header, headerPendingIntent);

        // Action click template
        Intent clickIntentTemplate = new Intent(Intent.ACTION_VIEW);
        PendingIntent clickPendingIntentTemplate = PendingIntent.getActivity(
            context, 202, clickIntentTemplate,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0)
        );
        views.setPendingIntentTemplate(R.id.widget_contact_list, clickPendingIntentTemplate);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_contact_list);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
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
                    updateAppWidget(context, appWidgetManager, id);
                }
            }
        }
    }
}
