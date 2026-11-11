package com.glueck.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class QuickActionsWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_actions);

        // Intent 1: Start Lesson
        Intent startIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/start_lesson"), context, MainActivity.class);
        PendingIntent piStart = PendingIntent.getActivity(context, 101, startIntent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        views.setOnClickPendingIntent(R.id.btn_start_lesson, piStart);

        // Intent 2: Add Student
        Intent addStudentIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/add_student"), context, MainActivity.class);
        PendingIntent piAddStudent = PendingIntent.getActivity(context, 102, addStudentIntent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        views.setOnClickPendingIntent(R.id.btn_add_student, piAddStudent);

        // Intent 3: Pay
        Intent payIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/payments"), context, MainActivity.class);
        PendingIntent piPay = PendingIntent.getActivity(context, 103, payIntent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        views.setOnClickPendingIntent(R.id.btn_pay, piPay);

        // Intent 4: Message
        Intent msgIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/message"), context, MainActivity.class);
        PendingIntent piMsg = PendingIntent.getActivity(context, 104, msgIntent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        views.setOnClickPendingIntent(R.id.btn_msg, piMsg);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}
