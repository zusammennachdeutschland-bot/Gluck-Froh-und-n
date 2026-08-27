package com.glueck.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class ScheduleDayWidgetFactory implements RemoteViewsService.RemoteViewsFactory {
    private Context context;
    private int widgetId;
    private List<LessonItem> lessonItems = new ArrayList<>();

    public ScheduleDayWidgetFactory(Context context, Intent intent) {
        this.context = context;
        this.widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
    }

    @Override
    public void onCreate() {
        loadData();
    }

    @Override
    public void onDataSetChanged() {
        loadData();
    }

    private void loadData() {
        lessonItems.clear();
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        int offset = prefs.getInt("widget_schedule_day_offset_" + widgetId, 0);
        String targetDate = ScheduleDayWidget.getTargetDateString(offset);

        String data = prefs.getString("widget_all_schedule_lessons", "[]");
        try {
            JSONArray array = new JSONArray(data);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                String lessonDate = obj.optString("date");
                if (targetDate.equals(lessonDate)) {
                    LessonItem item = new LessonItem();
                    item.id = obj.optString("id");
                    item.time = obj.optString("time");
                    item.title = obj.optString("title");
                    item.status = obj.optString("status");
                    item.rawTime = obj.optString("rawTime", item.time);
                    item.details = obj.optString("details", "");
                    lessonItems.add(item);
                }
            }

            // Sort by time
            Collections.sort(lessonItems, new Comparator<LessonItem>() {
                @Override
                public int compare(LessonItem a, LessonItem b) {
                    return a.rawTime.compareTo(b.rawTime);
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        lessonItems.clear();
    }

    @Override
    public int getCount() {
        return lessonItems.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position >= lessonItems.size()) return null;
        LessonItem item = lessonItems.get(position);

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_schedule_item);
        
        rv.setTextViewText(R.id.item_schedule_time, item.time);
        rv.setTextViewText(R.id.item_schedule_title, item.title);
        rv.setTextViewText(R.id.item_schedule_details, item.details != null && !item.details.isEmpty() ? item.details : "حصة مجدولة");

        if ("completed".equals(item.status)) {
            rv.setTextViewText(R.id.item_schedule_status_icon, "✅");
            rv.setTextColor(R.id.item_schedule_title, 0xFF888888);
            rv.setTextColor(R.id.item_schedule_time, 0xFF888888);
        } else if ("cancelled".equals(item.status)) {
            rv.setTextViewText(R.id.item_schedule_status_icon, "❌");
            rv.setTextColor(R.id.item_schedule_title, 0xFF888888);
            rv.setTextColor(R.id.item_schedule_time, 0xFF888888);
        } else if ("in_progress".equals(item.status)) {
            rv.setTextViewText(R.id.item_schedule_status_icon, "🔴 LIVE");
            rv.setTextColor(R.id.item_schedule_title, 0xFFFFFFFF);
            rv.setTextColor(R.id.item_schedule_time, 0xFFFF4444);
        } else {
            rv.setTextViewText(R.id.item_schedule_status_icon, "🕒");
            rv.setTextColor(R.id.item_schedule_title, 0xFFFFFFFF);
            rv.setTextColor(R.id.item_schedule_time, 0xFF38BDF8);
        }

        Intent fillInIntent = new Intent();
        fillInIntent.setData(android.net.Uri.parse("ags19://lesson/" + item.id));
        rv.setOnClickFillInIntent(R.id.item_schedule_container, fillInIntent);

        return rv;
    }

    @Override
    public RemoteViews getLoadingView() { return null; }

    @Override
    public int getViewTypeCount() { return 1; }

    @Override
    public long getItemId(int position) { return position; }

    @Override
    public boolean hasStableIds() { return true; }

    public static class LessonItem {
        public String id;
        public String time;
        public String rawTime;
        public String title;
        public String status;
        public String details;
    }
}
