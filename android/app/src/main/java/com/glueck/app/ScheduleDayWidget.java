package com.glueck.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class ScheduleDayWidget extends AppWidgetProvider {

    public static final String ACTION_SCHEDULE_PREV_DAY = "com.glueck.app.ACTION_SCHEDULE_PREV_DAY";
    public static final String ACTION_SCHEDULE_NEXT_DAY = "com.glueck.app.ACTION_SCHEDULE_NEXT_DAY";
    public static final String ACTION_SCHEDULE_TODAY = "com.glueck.app.ACTION_SCHEDULE_TODAY";

    static String getTargetDateString(int offset) {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, offset);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        return sdf.format(cal.getTime());
    }

    static String getFormattedDateHeader(Context context, int offset) {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, offset);

        SimpleDateFormat dayNameFormat = new SimpleDateFormat("EEEE", new Locale("ar"));
        SimpleDateFormat dayDateFormat = new SimpleDateFormat("d MMMM", new Locale("ar"));

        String dayName = dayNameFormat.format(cal.getTime());
        String dayDate = dayDateFormat.format(cal.getTime());

        if (offset == 0) {
            return "📅 اليوم (" + dayName + ") " + dayDate;
        } else if (offset == 1) {
            return "📅 غداً (" + dayName + ") " + dayDate;
        } else if (offset == -1) {
            return "📅 أمس (" + dayName + ") " + dayDate;
        } else {
            return "📅 " + dayName + " " + dayDate;
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_interactive_schedule);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        int offset = prefs.getInt("widget_schedule_day_offset_" + appWidgetId, 0);

        String headerText = getFormattedDateHeader(context, offset);
        views.setTextViewText(R.id.tv_schedule_date_title, headerText);

        // Service intent for ListView
        Intent intent = new Intent(context, ScheduleDayWidgetService.class);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        intent.putExtra("day_offset", offset);
        intent.setData(Uri.parse(intent.toUri(Intent.URI_INTENT_SCHEME) + "?offset=" + offset));
        
        views.setRemoteAdapter(R.id.widget_schedule_list, intent);
        views.setEmptyView(R.id.widget_schedule_list, R.id.widget_empty_schedule_view);

        // 1. Previous Day Button Intent
        Intent prevIntent = new Intent(context, ScheduleDayWidget.class);
        prevIntent.setAction(ACTION_SCHEDULE_PREV_DAY);
        prevIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        PendingIntent piPrev = PendingIntent.getBroadcast(
            context, appWidgetId * 10 + 1, prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.btn_prev_day, piPrev);

        // 2. Next Day Button Intent
        Intent nextIntent = new Intent(context, ScheduleDayWidget.class);
        nextIntent.setAction(ACTION_SCHEDULE_NEXT_DAY);
        nextIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        PendingIntent piNext = PendingIntent.getBroadcast(
            context, appWidgetId * 10 + 2, nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.btn_next_day, piNext);

        // 3. Reset to Today Button Intent
        Intent todayIntent = new Intent(context, ScheduleDayWidget.class);
        todayIntent.setAction(ACTION_SCHEDULE_TODAY);
        todayIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        PendingIntent piToday = PendingIntent.getBroadcast(
            context, appWidgetId * 10 + 3, todayIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.btn_today_reset, piToday);

        // 4. Click on date title opens main schedule in app
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setAction(Intent.ACTION_VIEW);
        openAppIntent.setData(Uri.parse("ags19://action/schedule"));
        PendingIntent piOpen = PendingIntent.getActivity(
            context, appWidgetId * 10 + 4, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.tv_schedule_date_title, piOpen);

        // 5. Item Click Template
        Intent clickIntentTemplate = new Intent(context, MainActivity.class);
        clickIntentTemplate.setAction(Intent.ACTION_VIEW);
        PendingIntent clickPendingIntentTemplate = PendingIntent.getActivity(
            context, appWidgetId * 10 + 5, clickIntentTemplate,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0)
        );
        views.setPendingIntentTemplate(R.id.widget_schedule_list, clickPendingIntentTemplate);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_schedule_list);
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
        String action = intent.getAction();
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);

        if (ACTION_SCHEDULE_PREV_DAY.equals(action)) {
            int widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                int currentOffset = prefs.getInt("widget_schedule_day_offset_" + widgetId, 0);
                prefs.edit().putInt("widget_schedule_day_offset_" + widgetId, currentOffset - 1).apply();
                updateAppWidget(context, appWidgetManager, widgetId);
            }
        } else if (ACTION_SCHEDULE_NEXT_DAY.equals(action)) {
            int widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                int currentOffset = prefs.getInt("widget_schedule_day_offset_" + widgetId, 0);
                prefs.edit().putInt("widget_schedule_day_offset_" + widgetId, currentOffset + 1).apply();
                updateAppWidget(context, appWidgetManager, widgetId);
            }
        } else if (ACTION_SCHEDULE_TODAY.equals(action)) {
            int widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                prefs.edit().putInt("widget_schedule_day_offset_" + widgetId, 0).apply();
                updateAppWidget(context, appWidgetManager, widgetId);
            }
        } else if (AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
            int[] appWidgetIds = intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS);
            if (appWidgetIds != null) {
                for (int id : appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, id);
                }
            }
        }
    }
}
