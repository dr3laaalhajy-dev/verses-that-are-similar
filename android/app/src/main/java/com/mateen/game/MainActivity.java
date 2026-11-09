package com.mateen.game;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.google.firebase.messaging.FirebaseMessaging;
import com.mateen.game.controllers.AppUpdateManager;
import com.mateen.game.models.AppVersionControl;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1002;
    private static final String VERSION_CONTROL_API_URL = "https://mateen-quran.vercel.app/api/version-control";
    private static final long UPDATE_POLL_INTERVAL_MS = 30000; // 30 seconds real-time poll

    private static MainActivity activeInstance;

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

    public static void broadcastTokenToWeb(String token) {
        if (activeInstance != null && token != null && !token.trim().isEmpty()) {
            activeInstance.sendNativeFcmTokenToWeb(token);
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        activeInstance = this;

        // تهيئة الفايربيس مسبقاً لضمان عمل الـ FCM
        ensureFirebaseInitialized(this);

        // ربط الجسر البرمجي للـ WebView لتمكين صلاحيات النظام (مثل الإشعارات)
        setupAndroidBridge();

        // الاستماع الحصري لعميل الأندرويد (Java Client Only)
        listenForAndroidAppUpdates();
    }

    @Override
    public void onResume() {
        super.onResume();

        // التأكد من توفر الجسر البرمجي
        setupAndroidBridge();

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
        if (activeInstance == this) {
            activeInstance = null;
        }
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

    /**
     * إعداد وربط الجسر البرمجي بين WebView و كود الأندرويد
     */
    private void setupAndroidBridge() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");
                Log.i(TAG, "AndroidBridge successfully registered with WebView");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to setup AndroidBridge: " + e.getMessage(), e);
        }
    }

    /**
     * ضمان تهيئة الفايربيس برمجياً إن لم تكن مهيأة بعد
     */
    public static void ensureFirebaseInitialized(Context context) {
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApplicationId("1:454602577030:android:551f014003683a63e92d07")
                        .setApiKey("AIzaSyAux6Fg_GonGCh0OBoyGG7GAFNjXBc8NEk")
                        .setProjectId("mateen-229f8")
                        .setGcmSenderId("454602577030")
                        .setStorageBucket("mateen-229f8.firebasestorage.app")
                        .setDatabaseUrl("https://mateen-229f8-default-rtdb.firebaseio.com")
                        .build();
                FirebaseApp.initializeApp(context, options);
                Log.i(TAG, "Firebase initialized programmatically");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Firebase programmatically: " + e.getMessage(), e);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            Log.i(TAG, "onRequestPermissionsResult for POST_NOTIFICATIONS: " + granted);
            notifyWebPermissionResult(granted);
            if (granted) {
                fetchAndSendNativeFcmToken();
            }
        }
    }

    /**
     * إشعار صفحة الويب بنتيجة منح الصلاحية عبر Event مخصص في Javascript
     */
    private void notifyWebPermissionResult(boolean granted) {
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    String script = "window.dispatchEvent(new CustomEvent('androidNotificationPermissionResult', { detail: { granted: " + granted + " } }));";
                    getBridge().getWebView().evaluateJavascript(script, null);
                }
            } catch (Exception e) {
                Log.w(TAG, "Error notifying WebView of permission result: " + e.getMessage());
            }
        });
    }

    /**
     * جلب الـ Native FCM Token وإرساله للويب
     */
    public void fetchAndSendNativeFcmToken() {
        try {
            ensureFirebaseInitialized(this);

            // فحص التوكن المحفوظ محلياً أولاً
            String cachedToken = getSharedPreferences("mateen_fcm_prefs", Context.MODE_PRIVATE)
                    .getString("native_fcm_token", null);
            if (cachedToken != null && !cachedToken.trim().isEmpty()) {
                Log.i(TAG, "Dispatched cached native FCM token to web");
                sendNativeFcmTokenToWeb(cachedToken);
            }

            // طلب التوكن من FirebaseMessaging Native مباشرة
            FirebaseMessaging.getInstance().getToken()
                    .addOnCompleteListener(task -> {
                        if (!task.isSuccessful()) {
                            Log.w(TAG, "Fetching Native FCM registration token failed: ", task.getException());
                            return;
                        }
                        String token = task.getResult();
                        if (token != null && !token.trim().isEmpty()) {
                            Log.i(TAG, "Fetched new Native FCM Token: " + token);
                            getSharedPreferences("mateen_fcm_prefs", Context.MODE_PRIVATE)
                                    .edit()
                                    .putString("native_fcm_token", token)
                                    .apply();
                            sendNativeFcmTokenToWeb(token);
                        }
                    });
        } catch (Exception e) {
            Log.e(TAG, "Error in fetchAndSendNativeFcmToken: " + e.getMessage(), e);
        }
    }

    /**
     * إرسال التوكن الأصلي للـ WebView عبر Event مخصص
     */
    public void sendNativeFcmTokenToWeb(String token) {
        if (token == null || token.trim().isEmpty()) return;
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    String script = "window.dispatchEvent(new CustomEvent('androidFcmTokenReceived', { detail: { token: '" + token.trim() + "' } }));";
                    getBridge().getWebView().evaluateJavascript(script, null);
                    Log.i(TAG, "Native FCM token sent to WebView via androidFcmTokenReceived");
                }
            } catch (Exception e) {
                Log.w(TAG, "Error sending native token to WebView: " + e.getMessage());
            }
        });
    }

    /**
     * كائن الجسر البرمجي المتاح لـ Javascript عبر window.AndroidBridge
     */
    public class AndroidBridge {
        private final Activity activity;

        public AndroidBridge(Activity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            Log.i(TAG, "AndroidBridge.requestNotificationPermission invoked from JavaScript");
            activity.runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
                            != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(
                                activity,
                                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                                NOTIFICATION_PERMISSION_REQUEST_CODE
                        );
                    } else {
                        Log.i(TAG, "POST_NOTIFICATIONS permission already granted");
                        notifyWebPermissionResult(true);
                        fetchAndSendNativeFcmToken();
                    }
                } else {
                    boolean enabled = NotificationManagerCompat.from(activity).areNotificationsEnabled();
                    Log.i(TAG, "Android < 13 notifications enabled: " + enabled);
                    notifyWebPermissionResult(enabled);
                    if (enabled) {
                        fetchAndSendNativeFcmToken();
                    }
                }
            });
        }

        @JavascriptInterface
        public void getFcmToken() {
            Log.i(TAG, "AndroidBridge.getFcmToken invoked from JavaScript");
            activity.runOnUiThread(() -> fetchAndSendNativeFcmToken());
        }

        @JavascriptInterface
        public boolean isNotificationPermissionGranted() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
                        == PackageManager.PERMISSION_GRANTED;
            }
            return NotificationManagerCompat.from(activity).areNotificationsEnabled();
        }
    }
}
