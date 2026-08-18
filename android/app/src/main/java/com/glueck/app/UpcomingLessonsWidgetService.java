package com.glueck.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

public class UpcomingLessonsWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new UpcomingLessonsWidgetFactory(this.getApplicationContext(), intent);
    }
}
