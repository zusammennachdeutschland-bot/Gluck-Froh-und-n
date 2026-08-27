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

public class ContactReminderWidgetFactory implements RemoteViewsService.RemoteViewsFactory {
    private Context context;
    private List<ContactItem> items = new ArrayList<>();

    public ContactReminderWidgetFactory(Context context, Intent intent) {
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
        String data = prefs.getString("widget_contact_reminders", "[]");
        try {
            JSONArray array = new JSONArray(data);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                ContactItem item = new ContactItem();
                item.id = obj.optString("id");
                item.studentId = obj.optString("studentId");
                item.studentName = obj.optString("studentName", "طالب");
                item.groupName = obj.optString("groupName", "");
                item.time = obj.optString("time", "");
                item.phone = obj.optString("phone", "");
                item.whatsappUrl = obj.optString("whatsappUrl", "");
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
        ContactItem item = items.get(position);

        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_contact_item);
        rv.setTextViewText(R.id.tv_student_name, item.studentName);

        String subtitle = (item.time != null && !item.time.isEmpty() ? "🕒 " + item.time : "");
        if (item.groupName != null && !item.groupName.isEmpty()) {
            subtitle += (subtitle.isEmpty() ? "" : " • ") + item.groupName;
        }
        rv.setTextViewText(R.id.tv_lesson_time, subtitle.isEmpty() ? "طالب مسجل" : subtitle);

        // FillInIntent for WhatsApp
        Intent fillInWhatsApp = new Intent();
        if (item.whatsappUrl != null && !item.whatsappUrl.isEmpty()) {
            fillInWhatsApp.setData(Uri.parse(item.whatsappUrl));
        } else if (item.phone != null && !item.phone.isEmpty()) {
            String cleanPhone = item.phone.replaceAll("[^0-9+]", "");
            fillInWhatsApp.setData(Uri.parse("https://wa.me/" + cleanPhone));
        } else {
            fillInWhatsApp.setData(Uri.parse("ags19://lesson/" + item.id));
        }
        rv.setOnClickFillInIntent(R.id.btn_action_whatsapp, fillInWhatsApp);

        // FillInIntent for Call
        Intent fillInCall = new Intent();
        if (item.phone != null && !item.phone.isEmpty()) {
            String cleanPhone = item.phone.replaceAll("[^0-9+]", "");
            fillInCall.setData(Uri.parse("tel:" + cleanPhone));
        } else {
            fillInCall.setData(Uri.parse("ags19://lesson/" + item.id));
        }
        rv.setOnClickFillInIntent(R.id.btn_action_call, fillInCall);

        // FillInIntent for row container (opens lesson / student)
        Intent fillInContainer = new Intent();
        fillInContainer.setData(Uri.parse("ags19://lesson/" + item.id));
        rv.setOnClickFillInIntent(R.id.item_contact_container, fillInContainer);

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

    public static class ContactItem {
        public String id;
        public String studentId;
        public String studentName;
        public String groupName;
        public String time;
        public String phone;
        public String whatsappUrl;
    }
}
