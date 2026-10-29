package com.mateen.game;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private static final String VERSION_CONTROL_API_URL = "https://mateen-quran.vercel.app/api/version-control";
    private static final long UPDATE_POLL_INTERVAL_MS = 30000; // 30 seconds real-time poll

    private ValueEventListener updateListener;
    private DatabaseReference versionRef;

    private final Handler updatePollHandler = new Handler(Looper.getMainLooper());
    private final Runnable updatePollRunnable = new Runnable() {
        @Override
        public void run() {
            checkUpdatesFromApi();
            updatePollHandler.postDelayed(this, UPDATE_POLL_INTERVAL_MS);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // الاستماع الحصري لعميل الأندرويد (Java Client Only)
        listenForAndroidAppUpdates();
    }

    @Override
    public void onResume() {
        super.onResume();

        // فحص التحديثات فور عودة المستخدم للتطبيق
        listenForAndroidAppUpdates();

        // بدء الفحص الدوري اللحظي لمزامنة إلغاء التنبيه (isUpdateActive=false)
        updatePollHandler.removeCallbacks(updatePollRunnable);
        updatePollHandler.postDelayed(updatePollRunnable, UPDATE_POLL_INTERVAL_MS);
    }

    @Override
    public void onPause() {
        super.onPause();
        updatePollHandler.removeCallbacks(updatePollRunnable);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        updatePollHandler.removeCallbacks(updatePollRunnable);
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
     * فحص التحديثات عبر API الخادم المباشر (Vercel Backend /api/version-control)
     * يضمن عمل نظام التحديثات لعميل الأندرويد بشكل موثوق وسريع
     */
    private void checkUpdatesFromApi() {
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(VERSION_CONTROL_API_URL);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setRequestProperty("Accept", "application/json");

                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject json = new JSONObject(sb.toString());

                    // 1. الشرط الاستباقي: فحص حالة التفعيل isUpdateActive
                    boolean isUpdateActive = json.optBoolean("isUpdateActive", true);
                    if (!isUpdateActive) {
                        Log.i(TAG, "API Update check: isUpdateActive=false. Dismissing dialog if visible.");
                        runOnUiThread(() -> AppUpdateManager.dismissActiveDialog(false));
                        return;
                    }

                    // 2. قراءة latestAndroidVersionCode ومقارنتها مع BuildConfig.VERSION_CODE
                    long latestAndroidVersionCode = json.optLong("latestAndroidVersionCode", 
                            json.optLong("latestVersionCode", 0));
                    long installedVersionCode = BuildConfig.VERSION_CODE;

                    Log.d(TAG, "API Version Check: latest=" + latestAndroidVersionCode 
                            + ", installed=" + installedVersionCode);

                    if (latestAndroidVersionCode > installedVersionCode) {
                        AppVersionControl updateInfo = new AppVersionControl();
                        updateInfo.setLatestAndroidVersionCode((int) latestAndroidVersionCode);
                        updateInfo.setLatestVersionCode((int) latestAndroidVersionCode);
                        updateInfo.setUpdateNotes(json.optString("updateNotes", ""));
                        updateInfo.setForceUpdate(json.optBoolean("isForceUpdate", false));
                        updateInfo.setUpdateActive(isUpdateActive);
                        updateInfo.setPlayStoreLink(json.optString("playStoreLink", ""));
                        updateInfo.setApkLink(json.optString("apkLink", ""));

                        runOnUiThread(() -> {
                            if (!isFinishing() && !isDestroyed()) {
                                AppUpdateManager.showUpdateBottomSheetDialog(MainActivity.this, updateInfo);
                            }
                        });
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to check updates from API: " + e.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }).start();
    }

    /**
     * استماع حصري لتطبيق الأندرويد:
     * 1. يستدعي API الخادم المباشر عبر HTTP.
     * 2. يستمع لقناة Firebase Realtime Database كقناة فورية إضافية إن كانت مهيأة.
     */
    private void listenForAndroidAppUpdates() {
        // فحص فوري عبر الخادم
        checkUpdatesFromApi();

        try {
            if (!isFirebaseAvailable()) {
                Log.d(TAG, "Firebase Realtime Database is not active. Using API polling channel.");
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

                    // التفاعل اللحظي (Real-time Dismiss): إذا أصبحت false، يتم استدعاء dialog.dismiss() فوراً
                    if (!isUpdateActive) {
                        Log.i(TAG, "Update alert disabled in Firebase (isUpdateActive=false). Dismissing dialog.");
                        AppUpdateManager.dismissActiveDialog(false);
                        return;
                    }

                    AppVersionControl updateInfo = snapshot.getValue(AppVersionControl.class);
                    if (updateInfo == null) return;

                    long latestAndroidVersionCode = 0;
                    if (snapshot.hasChild("latestAndroidVersionCode")) {
                        Object val = snapshot.child("latestAndroidVersionCode").getValue();
                        if (val instanceof Number) {
                            latestAndroidVersionCode = ((Number) val).longValue();
                        }
                    } else {
                        latestAndroidVersionCode = updateInfo.getLatestAndroidVersionCode();
                    }

                    long installedVersionCode = BuildConfig.VERSION_CODE;

                    Log.d(TAG, "Firebase Version Check: latestAndroidVersionCode=" 
                            + latestAndroidVersionCode + ", BuildConfig.VERSION_CODE=" + installedVersionCode);

                    if (latestAndroidVersionCode > installedVersionCode) {
                        AppUpdateManager.showUpdateBottomSheetDialog(MainActivity.this, updateInfo);
                    }
                }

                @Override
                public void onCancelled(@NonNull DatabaseError error) {
                    Log.e(TAG, "Failed to read Firebase version control: " + error.getMessage());
                }
            };

            versionRef.addValueEventListener(updateListener);
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Firebase version listener: " + e.getMessage());
        }
    }
}
