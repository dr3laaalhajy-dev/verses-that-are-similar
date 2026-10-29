package com.mateen.game.controllers;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.button.MaterialButton;
import com.google.firebase.FirebaseApp;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.mateen.game.BuildConfig;
import com.mateen.game.R;
import com.mateen.game.models.AppVersionControl;

/**
 * مدير تحديثات التطبيق (App Update Manager):
 * 1. استكشاف التحديثات بمقارنة latestVersionCode القادم من Firebase مع رقم إصدار التطبيق المثبت.
 * 2. عرض نافذة منبثقة احترافية بتصميم BottomSheetDialog مخصص (dialog_update_bottom_sheet.xml).
 * 3. دعم التحديث من متجر Google Play أو تحميل APK مباشر، مع منع الإغلاق في التحديث الإجباري.
 */
public class AppUpdateManager {

    private static final String TAG = "AppUpdateManager";
    public static final String FIREBASE_PATH_VERSION_CONTROL = "app_settings/version_control";

    private static BottomSheetDialog activeDialog = null;
    private static boolean isActiveDialogForce = false;

    /**
     * إغلاق نافذة التحديث المعروضة لحظياً (Real-time Dismiss)
     */
    public static void dismissActiveDialog(boolean ignoreForce) {
        if (activeDialog != null && activeDialog.isShowing()) {
            if (ignoreForce || !isActiveDialogForce) {
                Log.i(TAG, "Dismissing active update BottomSheetDialog in real-time");
                try {
                    activeDialog.dismiss();
                } catch (Exception e) {
                    Log.e(TAG, "Error dismissing activeDialog", e);
                }
                activeDialog = null;
            }
        }
    }

    public interface OnPublishCallback {
        void onSuccess();
        void onFailure(Exception e);
    }

    public interface OnUpdateCheckListener {
        void onUpdateAvailable(AppVersionControl versionControl, boolean isForceUpdate);
        void onNoUpdate();
    }

    // =========================================================================
    // 1. نشر التحديث (Admin Publish Action)
    // =========================================================================

    public static void publishUpdate(
            @NonNull final AppVersionControl versionControl,
            final OnPublishCallback callback
    ) {
        try {
            DatabaseReference versionRef = FirebaseDatabase.getInstance()
                    .getReference("app_settings")
                    .child("version_control");

            versionControl.setUpdatedAt(System.currentTimeMillis());

            versionRef.setValue(versionControl)
                    .addOnSuccessListener(aVoid -> {
                        Log.i(TAG, "Android app update published successfully: v" + versionControl.getLatestAndroidVersionCode());
                        if (callback != null) callback.onSuccess();
                    })
                    .addOnFailureListener(e -> {
                        Log.e(TAG, "Failed to publish app update", e);
                        if (callback != null) callback.onFailure(e);
                    });
        } catch (Exception e) {
            Log.e(TAG, "Failed to publish update due to Firebase error: " + e.getMessage(), e);
            if (callback != null) callback.onFailure(e);
        }
    }

    // =========================================================================
    // 2. استكشاف التحديث (User Update Check)
    // =========================================================================

    public static ValueEventListener checkForUpdates(@NonNull final Activity activity) {
        return checkForUpdates(activity, null);
    }

    public static ValueEventListener checkForUpdates(
            @NonNull final Activity activity,
            final OnUpdateCheckListener customListener
    ) {
        try {
            if (FirebaseApp.getApps(activity).isEmpty()) {
                try {
                    FirebaseApp.initializeApp(activity);
                } catch (Exception e) {
                    Log.w(TAG, "FirebaseApp.initializeApp failed: " + e.getMessage());
                }
            }
            if (FirebaseApp.getApps(activity).isEmpty()) {
                Log.w(TAG, "Firebase is not initialized. Skipping checkForUpdates.");
                if (customListener != null) customListener.onNoUpdate();
                return null;
            }
            DatabaseReference versionRef = FirebaseDatabase.getInstance()
                    .getReference("app_settings")
                    .child("version_control");

            ValueEventListener listener = new ValueEventListener() {
                @Override
                public void onDataChange(@NonNull DataSnapshot snapshot) {
                    if (activity.isFinishing() || activity.isDestroyed() || !snapshot.exists()) return;

                    // 1. الفحص الاستباقي: هل تنبيه التحديث نشط في السيرفر؟
                    boolean isUpdateActive = true;
                    if (snapshot.hasChild("isUpdateActive")) {
                        Boolean activeVal = snapshot.child("isUpdateActive").getValue(Boolean.class);
                        if (activeVal != null) {
                            isUpdateActive = activeVal;
                        }
                    }

                    // التفاعل اللحظي: إذا تم إيقاف التنبيه وكان معروضاً، نغلقه فوراً وننهي الدالة
                    if (!isUpdateActive) {
                        Log.i(TAG, "isUpdateActive is false. Dismissing any visible update alert in real-time.");
                        dismissActiveDialog(false);
                        if (customListener != null) customListener.onNoUpdate();
                        return;
                    }

                    AppVersionControl updateInfo = snapshot.getValue(AppVersionControl.class);
                    if (updateInfo == null) {
                        if (customListener != null) customListener.onNoUpdate();
                        return;
                    }

                    // 1. قراءة latestAndroidVersionCode المخصص لنظام أندرويد
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

                    // شرط التحديث: إذا كان رقم قاعدة البيانات أكبر من رقم التطبيق المثبت
                    if (latestAndroidVersionCode > installedVersionCode) {
                        Log.i(TAG, "Android update detected: server_v=" + latestAndroidVersionCode + " > local_v=" + installedVersionCode);
                        if (customListener != null) {
                            customListener.onUpdateAvailable(updateInfo, updateInfo.isForceUpdate());
                        } else {
                            showUpdateBottomSheetDialog(activity, updateInfo);
                        }
                    } else {
                        if (customListener != null) customListener.onNoUpdate();
                    }
                }

                @Override
                public void onCancelled(@NonNull DatabaseError error) {
                    Log.e(TAG, "Update listener cancelled: " + error.getMessage());
                }
            };

            versionRef.addValueEventListener(listener);
            return listener;
        } catch (Exception e) {
            Log.e(TAG, "Failed to check for updates: " + e.getMessage());
            if (customListener != null) customListener.onNoUpdate();
            return null;
        }
    }

    public static long getInstalledVersionCode(@NonNull Context context) {
        try {
            PackageInfo pInfo = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return pInfo.getLongVersionCode();
            } else {
                return pInfo.versionCode;
            }
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "Failed to get installed version code", e);
            return 1;
        }
    }

    // =========================================================================
    // 3. عرض نافذة تنبيه التحديث الاحترافية (BottomSheetDialog Logic)
    // =========================================================================

    /**
     * عرض نافذة التحديث الاحترافية باستخدام BottomSheetDialog وتصميم dialog_update_bottom_sheet.xml
     */
    public static void showUpdateBottomSheetDialog(
            @NonNull final Activity activity,
            @NonNull final AppVersionControl updateInfo
    ) {
        activity.runOnUiThread(() -> {
            try {
                if (activity.isFinishing() || activity.isDestroyed()) return;

                if (activeDialog != null && activeDialog.isShowing()) {
                    Log.d(TAG, "Update BottomSheetDialog is already displayed. Skipping duplicate.");
                    return;
                }

                final BottomSheetDialog bottomSheetDialog = new BottomSheetDialog(activity);
                View sheetView = LayoutInflater.from(activity).inflate(R.layout.dialog_update_bottom_sheet, null);
                bottomSheetDialog.setContentView(sheetView);

                // ضمان ظهور الزوايا الدائرية العلوية بتفريغ خلفية الحاوية الأم
                bottomSheetDialog.setOnShowListener(dialog -> {
                    try {
                        android.widget.FrameLayout bottomSheet = bottomSheetDialog.findViewById(com.google.android.material.R.id.design_bottom_sheet);
                        if (bottomSheet != null) {
                            bottomSheet.setBackgroundResource(android.R.color.transparent);
                        }
                    } catch (Exception ignored) {}
                });

                final boolean isForce = updateInfo.isForceUpdate();

                // أ) التحكم بالإغلاق في التحديث الإجباري
                bottomSheetDialog.setCancelable(!isForce);
                bottomSheetDialog.setCanceledOnTouchOutside(!isForce);

                BottomSheetBehavior<?> behavior = bottomSheetDialog.getBehavior();
                behavior.setState(BottomSheetBehavior.STATE_EXPANDED);

                if (isForce) {
                    behavior.setHideable(false);
                    behavior.addBottomSheetCallback(new BottomSheetBehavior.BottomSheetCallback() {
                        @Override
                        public void onStateChanged(@NonNull View bottomSheet, int newState) {
                            if (newState == BottomSheetBehavior.STATE_HIDDEN) {
                                behavior.setState(BottomSheetBehavior.STATE_EXPANDED);
                            }
                        }

                        @Override
                        public void onSlide(@NonNull View bottomSheet, float slideOffset) {}
                    });
                }

                // ب) ربط العناصر البرمجية بنفخ التصميم
                TextView tvVersionBadge = sheetView.findViewById(R.id.tvUpdateVersionBadge);
                TextView tvUpdateTitle = sheetView.findViewById(R.id.tvUpdateTitle);
                TextView tvUpdateNotes = sheetView.findViewById(R.id.tvUpdateNotes);
                MaterialButton btnGooglePlay = sheetView.findViewById(R.id.btnGooglePlay);
                MaterialButton btnApkDownload = sheetView.findViewById(R.id.btnApkDownload);
                TextView tvForceNotice = sheetView.findViewById(R.id.tvForceNotice);
                TextView btnLater = sheetView.findViewById(R.id.btnLater);

                // ج) تعيين النصوص القادمة من Firebase
                if (tvVersionBadge != null) {
                    tvVersionBadge.setText("إصدار جديد متوفر v" + updateInfo.getLatestAndroidVersionCode());
                }
                if (tvUpdateTitle != null) {
                    tvUpdateTitle.setText("تحديث جديد متاح 🚀");
                }
                if (tvUpdateNotes != null) {
                    tvUpdateNotes.setText(updateInfo.getUpdateNotes());
                }

                // د) حالة التحديث الإجباري مقابل الاختياري
                if (isForce) {
                    if (tvForceNotice != null) tvForceNotice.setVisibility(View.VISIBLE);
                    if (btnLater != null) btnLater.setVisibility(View.GONE);
                } else {
                    if (tvForceNotice != null) tvForceNotice.setVisibility(View.GONE);
                    if (btnLater != null) {
                        btnLater.setVisibility(View.VISIBLE);
                        btnLater.setOnClickListener(v -> bottomSheetDialog.dismiss());
                    }
                }

                // هـ) برمجة الزر الأول (Google Play)
                final String playLink = updateInfo.getPlayStoreLink();
                if (btnGooglePlay != null) {
                    if (playLink != null && !playLink.trim().isEmpty()) {
                        btnGooglePlay.setVisibility(View.VISIBLE);
                        btnGooglePlay.setOnClickListener(v -> openLink(activity, playLink));
                    } else {
                        btnGooglePlay.setVisibility(View.GONE);
                    }
                }

                // و) برمجة الزر الثاني (تحميل APK خارجي)
                final String apkLink = updateInfo.getApkLink();
                if (btnApkDownload != null) {
                    if (apkLink != null && !apkLink.trim().isEmpty()) {
                        btnApkDownload.setVisibility(View.VISIBLE);
                        btnApkDownload.setOnClickListener(v -> openLink(activity, apkLink));
                    } else {
                        btnApkDownload.setVisibility(View.GONE);
                    }
                }

                // تسجيل النافذة المعروضة لتتبع الإغلاق اللحظي (Real-time Dismiss)
                activeDialog = bottomSheetDialog;
                isActiveDialogForce = isForce;
                bottomSheetDialog.setOnDismissListener(dialog -> {
                    if (activeDialog == dialog) {
                        activeDialog = null;
                    }
                });

                bottomSheetDialog.show();

            } catch (Exception e) {
                Log.e(TAG, "Failed to display update BottomSheetDialog", e);
            }
        });
    }

    private static void openLink(@NonNull Activity activity, @NonNull String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            activity.startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(activity, "تعذر فتح الرابط: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }
}
