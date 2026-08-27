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

public class InstallmentsPaymentsWidget extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_installments_payments);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String data = prefs.getString("widget_finance_details", "{}");

        try {
            JSONObject obj = new JSONObject(data);
            
            // 1. Installments
            int instCount = obj.optInt("dueInstallmentsCount", 0);
            double instAmount = obj.optDouble("dueInstallmentsTotal", 0.0);
            views.setTextViewText(R.id.tv_installments_amount, String.format(java.util.Locale.US, "%.0f", instAmount) + " ج.م");
            views.setTextViewText(R.id.tv_installments_count, instCount + " قسط مستحق");

            // 2. Recurring
            int recCount = obj.optInt("dueRecurringCount", 0);
            double recAmount = obj.optDouble("dueRecurringTotal", 0.0);
            views.setTextViewText(R.id.tv_recurring_amount, String.format(java.util.Locale.US, "%.0f", recAmount) + " ج.م");
            views.setTextViewText(R.id.tv_recurring_count, recCount + " فاتورة شهرياً");

            // 3. Students Due
            int stuCount = obj.optInt("dueStudentsCount", 0);
            double stuAmount = obj.optDouble("dueStudentsTotal", 0.0);
            views.setTextViewText(R.id.tv_students_amount, String.format(java.util.Locale.US, "%.0f", stuAmount) + " ج.م");
            views.setTextViewText(R.id.tv_students_count, stuCount + " طالب متأخر");

            int totalAlerts = instCount + recCount + stuCount;
            views.setTextViewText(R.id.tv_total_finance_badge, totalAlerts > 0 ? ("⚠️ " + totalAlerts + " مستحق") : "✅ مالي سليم");

        } catch (Exception e) {
            e.printStackTrace();
        }

        // Header and cards deep links
        Intent mainFinanceIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("ags19://action/payments"), context, MainActivity.class);
        PendingIntent piFinance = PendingIntent.getActivity(
            context, 301, mainFinanceIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.widget_installments_container, piFinance);
        views.setOnClickPendingIntent(R.id.widget_installments_header, piFinance);
        views.setOnClickPendingIntent(R.id.card_due_installments, piFinance);
        views.setOnClickPendingIntent(R.id.card_due_recurring, piFinance);
        views.setOnClickPendingIntent(R.id.card_due_students, piFinance);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}
