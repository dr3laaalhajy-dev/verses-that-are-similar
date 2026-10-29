package com.mateen.game;

import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.mateen.game.controllers.AppUpdateManager;
import com.mateen.game.models.AppVersionControl;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private ValueEventListener updateListener;
    private DatabaseReference versionRef;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // الاستماع الحصري لعميل الأندرويد (Java Client Only)
        listenForAndroidAppUpdates();
    }

    @Override
    public void onResume() {
        super.onResume();

        // إعادة التحقق عند استئناف التطبيق (مهم للتحديثات الإجبارية)
        listenForAndroidAppUpdates();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            if (versionRef != null && updateListener != null) {
                versionRef.removeEventListener(updateListener);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error removing updateListener: " + e.getMessage());
        }
    }

    /**
     * فحص توفر Firebase لتفادي أي انهيار في حال عدم وجود google-services.json
     */
    private boolean isFirebaseAvailable() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this);
            }
            return !FirebaseApp.getApps(this).isEmpty();
        } catch (Exception e) {
            Log.w(TAG, "FirebaseApp could not be initialized (google-services.json may be missing): " + e.getMessage());
            return false;
        }
    }

    /**
     * استماع حصري لتطبيق الأندرويد:
     * يقرأ قيمة latestAndroidVersionCode من Firebase Realtime Database
     * ويقارنها مع BuildConfig.VERSION_CODE الحصري بنظام أندرويد.
     * إذا كان رقم قاعدة البيانات أكبر، يتم عرض BottomSheetDialog.
     */
    private void listenForAndroidAppUpdates() {
        try {
            if (!isFirebaseAvailable()) {
                Log.w(TAG, "Firebase is not initialized. Skipping update check to prevent crash on startup.");
                return;
            }

            if (versionRef == null) {
                versionRef = FirebaseDatabase.getInstance()
                        .getReference("app_settings")
                        .child("version_control");
            }

            if (updateListener != null) {
                versionRef.removeEventListener(updateListener);
            }

            updateListener = new ValueEventListener() {
                @Override
                public void onDataChange(@NonNull DataSnapshot snapshot) {
                    if (isFinishing() || isDestroyed() || !snapshot.exists()) return;

                    // 1. الشرط الاستباقي في السطر الأول: فحص isUpdateActive
                    boolean isUpdateActive = true;
                    if (snapshot.hasChild("isUpdateActive")) {
                        Boolean activeVal = snapshot.child("isUpdateActive").getValue(Boolean.class);
                        if (activeVal != null) {
                            isUpdateActive = activeVal;
                        }
                    }

                    // التفاعل اللحظي (Real-time Dismiss): إذا أصبحت false، يتم استدعاء dialog.dismiss() فوراً وإنهاء الدالة
                    if (!isUpdateActive) {
                        Log.i(TAG, "Update alert is disabled by admin (isUpdateActive=false). Dismissing dialog if visible.");
                        AppUpdateManager.dismissActiveDialog(false);
                        return;
                    }

                    AppVersionControl updateInfo = snapshot.getValue(AppVersionControl.class);
                    if (updateInfo == null) return;

                    // 1. قراءة latestAndroidVersionCode من مسار Firebase
                    long latestAndroidVersionCode = 0;
                    if (snapshot.hasChild("latestAndroidVersionCode")) {
                        Object val = snapshot.child("latestAndroidVersionCode").getValue();
                        if (val instanceof Number) {
                            latestAndroidVersionCode = ((Number) val).longValue();
                        }
                    } else {
                        latestAndroidVersionCode = updateInfo.getLatestAndroidVersionCode();
                    }

                    // 2. المقارنة مع BuildConfig.VERSION_CODE الحصري ببيئة أندرويد
                    long installedVersionCode = BuildConfig.VERSION_CODE;

                    Log.d(TAG, "Android Version Check: latestAndroidVersionCode=" 
                            + latestAndroidVersionCode + ", BuildConfig.VERSION_CODE=" + installedVersionCode);

                    // 3. إظهار BottomSheetDialog فقط إذا كان رقم قاعدة البيانات أكبر من رقم التطبيق المثبت
                    if (latestAndroidVersionCode > installedVersionCode) {
                        AppUpdateManager.showUpdateBottomSheetDialog(MainActivity.this, updateInfo);
                    }
                }

                @Override
                public void onCancelled(@NonNull DatabaseError error) {
                    Log.e(TAG, "Failed to read version control: " + error.getMessage());
                }
            };

            versionRef.addValueEventListener(updateListener);
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Firebase or listen for app updates: " + e.getMessage());
        }
    }
}
