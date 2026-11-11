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

public class TodoWidgetFactory implements RemoteViewsService.RemoteViewsFactory {
    private Context context;
    private List<TodoItem> todoItems = new ArrayList<>();

    public TodoWidgetFactory(Context context, Intent intent) {
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
        todoItems.clear();
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String data = prefs.getString("widget_todos", "[]");
        try {
            JSONArray array = new JSONArray(data);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                TodoItem item = new TodoItem();
                item.id = obj.optString("id");
                item.text = obj.optString("text");
                todoItems.add(item);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        todoItems.clear();
    }

    @Override
    public int getCount() {
        return todoItems.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position >= todoItems.size()) return null;
        TodoItem item = todoItems.get(position);

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_todo_item);
        rv.setTextViewText(R.id.todo_item_text, item.text);

        Intent fillInIntent = new Intent();
        fillInIntent.setData(Uri.parse("ags19://action/todos/complete/" + item.id));
        rv.setOnClickFillInIntent(R.id.todo_item_container, fillInIntent);

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

    static class TodoItem {
        String id;
        String text;
    }
}
