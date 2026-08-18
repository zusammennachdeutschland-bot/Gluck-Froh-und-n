package com.glueck.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetManager")
public class WidgetManagerPlugin extends Plugin {

    @PluginMethod
    public void updateWidget(PluginCall call) {
        updateAllWidgets();
        call.resolve();
    }

    private void updateAllWidgets() {
        Class<?>[] widgetClasses = new Class<?>[] {
            TodayLessonsWidget.class,
            QuickActionsWidget.class,
            CurrentLessonWidget.class,
            PaymentsDueWidget.class,
            TodoWidget.class,
            RevenueWidget.class,
            MiniDashboardWidget.class,
            UpcomingLessonsWidget.class
        };

        for (Class<?> widgetClass : widgetClasses) {
            Intent intent = new Intent(getContext(), widgetClass);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            int[] ids = AppWidgetManager.getInstance(getContext())
                    .getAppWidgetIds(new ComponentName(getContext(), widgetClass));
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            getContext().sendBroadcast(intent);
        }
    }
}
