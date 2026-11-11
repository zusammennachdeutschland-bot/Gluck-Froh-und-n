package com.glueck.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

public class ScheduleDayWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new ScheduleDayWidgetFactory(this.getApplicationContext(), intent);
    }
}
