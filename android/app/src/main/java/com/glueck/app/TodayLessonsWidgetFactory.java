package com.glueck.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class TodayLessonsWidgetFactory implements RemoteViewsService.RemoteViewsFactory {
    private Context context;
    private List<LessonItem> lessonItems = new ArrayList<>();

    public TodayLessonsWidgetFactory(Context context, Intent intent) {
        this.context = context;
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
        String data = prefs.getString("widget_today_lessons", "[]");
        Log.d("Widget", "Loaded widget data: " + data);
        try {
            JSONArray array = new JSONArray(data);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                LessonItem item = new LessonItem();
                item.id = obj.optString("id");
                item.time = obj.optString("time");
                item.title = obj.optString("title");
                item.status = obj.optString("status");
                lessonItems.add(item);
            }
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

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_lesson_item);
        
        rv.setTextViewText(R.id.item_time, item.time);
        rv.setTextViewText(R.id.item_title, item.title);

        if ("completed".equals(item.status)) {
            rv.setTextViewText(R.id.item_status_icon, "✅");
            rv.setTextColor(R.id.item_title, 0xFF888888);
            rv.setTextColor(R.id.item_time, 0xFF888888);
        } else if ("cancelled".equals(item.status)) {
            rv.setTextViewText(R.id.item_status_icon, "❌");
            rv.setTextColor(R.id.item_title, 0xFF888888);
            rv.setTextColor(R.id.item_time, 0xFF888888);
        } else if ("in_progress".equals(item.status)) {
            rv.setTextViewText(R.id.item_status_icon, "🔴 LIVE");
            rv.setTextColor(R.id.item_title, 0xFFFFFFFF);
            rv.setTextColor(R.id.item_time, 0xFFFF4444);
        } else {
            rv.setTextViewText(R.id.item_status_icon, "🕒");
            rv.setTextColor(R.id.item_title, 0xFFFFFFFF);
            rv.setTextColor(R.id.item_time, 0xFFFFFFFF);
        }

        Intent fillInIntent = new Intent();
        fillInIntent.setData(android.net.Uri.parse("ags19://lesson/" + item.id));
        rv.setOnClickFillInIntent(R.id.item_container, fillInIntent);

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

    static class LessonItem {
        String id;
        String time;
        String title;
        String status;
    }
}
