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

public class PaymentsDueWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_payments_due);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String paymentsData = prefs.getString("widget_payments_due", "{}");

        try {
            JSONObject obj = new JSONObject(paymentsData);
            int overdueCount = obj.optInt("overdueCount", 0);
            int totalOutstanding = obj.optInt("totalOutstanding", 0);

            views.setTextViewText(R.id.payments_overdue_count, overdueCount + " Schüler überfällig");
            views.setTextViewText(R.id.payments_outstanding_amount, "€" + totalOutstanding);

            if (overdueCount == 0) {
                views.setTextViewText(R.id.payments_status_badge, "OPTIMAL");
            } else if (overdueCount <= 3) {
                views.setTextViewText(R.id.payments_status_badge, "WARNUNG");
            } else {
                views.setTextViewText(R.id.payments_status_badge, "KRITISCH");
            }
        } catch (Exception e) {
            views.setTextViewText(R.id.payments_overdue_count, "0 Schüler überfällig");
            views.setTextViewText(R.id.payments_outstanding_amount, "€0");
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/payments"), context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 301, intent, PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        views.setOnClickPendingIntent(R.id.widget_container, pi);
        views.setOnClickPendingIntent(R.id.btn_collect_payment, pi);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}
