package com.glueck.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class QuickTransactionWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_transactions);

        // 1. Record Student Payment
        Intent payStudentIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/quick_student_payment"), context, MainActivity.class);
        PendingIntent piPayStudent = PendingIntent.getActivity(
            context, 401, payStudentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.btn_quick_student_pay, piPayStudent);

        // 2. Quick Deposit / Income
        Intent incomeIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/quick_income"), context, MainActivity.class);
        PendingIntent piIncome = PendingIntent.getActivity(
            context, 402, incomeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.btn_quick_income, piIncome);

        // 3. Quick Expense
        Intent expenseIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/quick_expense"), context, MainActivity.class);
        PendingIntent piExpense = PendingIntent.getActivity(
            context, 403, expenseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.btn_quick_expense, piExpense);

        // 4. Quick Transfer
        Intent transferIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/quick_transfer"), context, MainActivity.class);
        PendingIntent piTransfer = PendingIntent.getActivity(
            context, 404, transferIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.btn_quick_transfer, piTransfer);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}
