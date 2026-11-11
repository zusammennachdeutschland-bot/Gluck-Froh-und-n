package com.glueck.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

public class TodayLessonsWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new TodayLessonsWidgetFactory(this.getApplicationContext(), intent);
    }
}
