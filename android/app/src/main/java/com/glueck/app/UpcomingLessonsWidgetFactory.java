package com.glueck.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class UpcomingLessonsWidgetFactory implements RemoteViewsService.RemoteViewsFactory {
    private Context context;
    private List<UpcomingItem> items = new ArrayList<>();

    public UpcomingLessonsWidgetFactory(Context context, Intent intent) {
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
        items.clear();
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String data = prefs.getString("widget_upcoming_lessons", "[]");
        try {
            JSONArray array = new JSONArray(data);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                UpcomingItem item = new UpcomingItem();
                item.id = obj.optString("id");
                item.time = obj.optString("time");
                item.title = obj.optString("title");
                item.date = obj.optString("date");
                item.studentCount = obj.optInt("studentCount", 1);
                items.add(item);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        items.clear();
    }

    @Override
    public int getCount() {
        return items.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position >= items.size()) return null;
        UpcomingItem item = items.get(position);

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_upcoming_item);
        rv.setTextViewText(R.id.upcoming_item_time, item.time);
        rv.setTextViewText(R.id.upcoming_item_title, item.title);
        rv.setTextViewText(R.id.upcoming_item_date, item.date);
        rv.setTextViewText(R.id.upcoming_item_students, "👥 " + item.studentCount);

        Intent fillInIntent = new Intent();
        fillInIntent.setData(Uri.parse("ags19://lesson/" + item.id));
        rv.setOnClickFillInIntent(R.id.upcoming_item_container, fillInIntent);

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

    static class UpcomingItem {
        String id;
        String time;
        String title;
        String date;
        int studentCount;
    }
}
