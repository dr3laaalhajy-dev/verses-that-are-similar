package com.mateen.game;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.mateen.game.controllers.AppUpdateManager;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // التحقق التلقائي من وجود تحديث جديد للتطبيق عند الإقلاع
        AppUpdateManager.checkForUpdates(this);
    }

    @Override
    protected void onResume() {
        super.onResume();

        // إعادة التحقق عند استئناف التطبيق (مهم للتحديثات الإجبارية)
        AppUpdateManager.checkForUpdates(this);
    }
}
