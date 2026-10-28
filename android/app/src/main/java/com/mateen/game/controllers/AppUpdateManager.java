package com.mateen.game.controllers;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.mateen.game.models.AppVersionControl;

/**
 * مدير تحديثات التطبيق (App Update Manager):
 * 1. نشر التحديثات وحفظها في Firebase Realtime Database في مسار app_settings/version_control.
 * 2. التحقق من وجود إصدار أحدث بمقارنة latestVersionCode مع رقم إصدار التطبيق المثبت.
 * 3. عرض نافذة منبثقة بتصميم جذاب تدعم التحديث الإجباري أو الاختياري وروابط Google Play و APK.
 */
public class AppUpdateManager {

    private static final String TAG = "AppUpdateManager";
    public static final String FIREBASE_PATH_VERSION_CONTROL = "app_settings/version_control";

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

    /**
     * حفظ ونشر بيانات التحديث في Firebase Realtime Database
     *
     * @param versionControl بيانات التحديث الجديد
     * @param callback إشعار بنجاح أو فشل النشر
     */
    public static void publishUpdate(
            @NonNull final AppVersionControl versionControl,
            final OnPublishCallback callback
    ) {
        DatabaseReference versionRef = FirebaseDatabase.getInstance()
                .getReference("app_settings")
                .child("version_control");

        versionControl.setUpdatedAt(System.currentTimeMillis());

        versionRef.setValue(versionControl)
                .addOnSuccessListener(aVoid -> {
                    Log.i(TAG, "App update published successfully: v" + versionControl.getLatestVersionCode());
                    if (callback != null) callback.onSuccess();
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Failed to publish app update", e);
                    if (callback != null) callback.onFailure(e);
                });
    }

    // =========================================================================
    // 2. التحقق من التحديث في الشاشة الرئيسية (User Update Check)
    // =========================================================================

    /**
     * التحقق من وجود تحديث جديد للتطبيق وعرض نافذة التنبيه تلقائياً
     *
     * @param activity الشاشة الحالية (MainActivity أو SplashActivity)
     */
    public static ValueEventListener checkForUpdates(@NonNull final Activity activity) {
        return checkForUpdates(activity, null);
    }

    public static ValueEventListener checkForUpdates(
            @NonNull final Activity activity,
            final OnUpdateCheckListener customListener
    ) {
        DatabaseReference versionRef = FirebaseDatabase.getInstance()
                .getReference("app_settings")
                .child("version_control");

        ValueEventListener listener = new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                if (activity.isFinishing() || activity.isDestroyed()) return;
                if (!snapshot.exists()) {
                    if (customListener != null) customListener.onNoUpdate();
                    return;
                }

                AppVersionControl updateInfo = snapshot.getValue(AppVersionControl.class);
                if (updateInfo == null) {
                    if (customListener != null) customListener.onNoUpdate();
                    return;
                }

                long currentVersionCode = getInstalledVersionCode(activity);
                long latestVersionCode = updateInfo.getLatestVersionCode();

                // شرط التحديث: إذا كان رقم قاعدة البيانات أكبر من رقم التطبيق المثبت
                if (latestVersionCode > currentVersionCode) {
                    Log.i(TAG, "New update available: latest=" + latestVersionCode + ", current=" + currentVersionCode);
                    if (customListener != null) {
                        customListener.onUpdateAvailable(updateInfo, updateInfo.isForceUpdate());
                    } else {
                        showUpdateDialog(activity, updateInfo);
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
    }

    /**
     * الحصول على رقم إصدار التطبيق المثبت على جهاز المستخدم (Version Code)
     */
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
    // 3. عرض نافذة تنبيه التحديث (User Update Dialog)
    // =========================================================================

    /**
     * عرض نافذة منبثقة بتصميم عصري جذاب تتضمن:
     * - العنوان: "تحديث جديد متاح 🚀"
     * - نص الملاحظات: updateNotes
     * - زر التحديث من Google Play
     * - زر تحميل APK خارجي
     * - تحكم الإغلاق بناءً على isForceUpdate
     */
    public static void showUpdateDialog(
            @NonNull final Activity activity,
            @NonNull final AppVersionControl updateInfo
    ) {
        activity.runOnUiThread(() -> {
            try {
                final Dialog dialog = new Dialog(activity);
                dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

                // منع الإغلاق إذا كان التحديث إجبارياً
                final boolean isForce = updateInfo.isForceUpdate();
                dialog.setCancelable(!isForce);
                dialog.setCanceledOnTouchOutside(!isForce);

                // بناء واجهة النافذة برمجياً لتجنب مشاكل XML
                LinearLayout rootLayout = new LinearLayout(activity);
                rootLayout.setOrientation(LinearLayout.VERTICAL);
                rootLayout.setGravity(Gravity.CENTER_HORIZONTAL);
                rootLayout.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

                int pad = dpToPx(activity, 24);
                rootLayout.setPadding(pad, pad, pad, pad);

                // بطاقة خلفية بيضاء فخمة بزوايا دائرية
                GradientDrawable cardBg = new GradientDrawable();
                cardBg.setColor(Color.WHITE);
                cardBg.setCornerRadius(dpToPx(activity, 32));
                rootLayout.setBackground(cardBg);

                // أيقونة صاروخ الانطلاق
                TextView iconBadge = new TextView(activity);
                iconBadge.setText("🚀");
                iconBadge.setTextSize(36);
                iconBadge.setGravity(Gravity.CENTER);
                rootLayout.addView(iconBadge);

                // شارة رقم الإصدار الجديد
                TextView badgeView = new TextView(activity);
                badgeView.setText("إصدار جديد متوفر v" + updateInfo.getLatestVersionCode());
                badgeView.setTextColor(Color.parseColor("#059669")); // Emerald-600
                badgeView.setTextSize(12);
                badgeView.setTypeface(Typeface.DEFAULT_BOLD);
                badgeView.setGravity(Gravity.CENTER);
                badgeView.setPadding(dpToPx(activity, 12), dpToPx(activity, 4), dpToPx(activity, 12), dpToPx(activity, 4));

                GradientDrawable badgeBg = new GradientDrawable();
                badgeBg.setColor(Color.parseColor("#ECFDF5")); // Emerald-50
                badgeBg.setCornerRadius(dpToPx(activity, 16));
                badgeBg.setStroke(dpToPx(activity, 1), Color.parseColor("#A7F3D0"));
                badgeView.setBackground(badgeBg);

                LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                );
                badgeParams.topMargin = dpToPx(activity, 10);
                badgeParams.bottomMargin = dpToPx(activity, 8);
                badgeView.setLayoutParams(badgeParams);
                rootLayout.addView(badgeView);

                // عنوان التحديث
                TextView titleView = new TextView(activity);
                titleView.setText("تحديث جديد متاح 🚀");
                titleView.setTextColor(Color.parseColor("#0F172A")); // Slate-900
                titleView.setTextSize(19);
                titleView.setTypeface(Typeface.DEFAULT_BOLD);
                titleView.setGravity(Gravity.CENTER);
                rootLayout.addView(titleView);

                // حاوية نص التحديثات (Scrollable Update Notes)
                ScrollView scrollView = new ScrollView(activity);
                LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                );
                scrollParams.topMargin = dpToPx(activity, 14);
                scrollParams.bottomMargin = dpToPx(activity, 18);
                scrollView.setLayoutParams(scrollParams);

                LinearLayout notesBox = new LinearLayout(activity);
                notesBox.setOrientation(LinearLayout.VERTICAL);
                notesBox.setPadding(dpToPx(activity, 16), dpToPx(activity, 12), dpToPx(activity, 16), dpToPx(activity, 12));

                GradientDrawable notesBg = new GradientDrawable();
                notesBg.setColor(Color.parseColor("#F8FAFC")); // Slate-50
                notesBg.setCornerRadius(dpToPx(activity, 16));
                notesBg.setStroke(dpToPx(activity, 1), Color.parseColor("#E2E8F0"));
                notesBox.setBackground(notesBg);

                TextView notesLabel = new TextView(activity);
                notesLabel.setText("ما الجديد في هذا التحديث:");
                notesLabel.setTextColor(Color.parseColor("#475569"));
                notesLabel.setTextSize(12);
                notesLabel.setTypeface(Typeface.DEFAULT_BOLD);
                notesBox.addView(notesLabel);

                TextView notesContent = new TextView(activity);
                notesContent.setText(updateInfo.getUpdateNotes());
                notesContent.setTextColor(Color.parseColor("#1E293B"));
                notesContent.setTextSize(13);
                notesContent.setLineSpacing(dpToPx(activity, 4), 1.1f);
                notesBox.addView(notesContent);

                scrollView.addView(notesBox);
                rootLayout.addView(scrollView);

                // زر 1: تحديث من Google Play
                String playLink = updateInfo.getPlayStoreLink();
                if (playLink != null && !playLink.trim().isEmpty()) {
                    Button btnPlayStore = new Button(activity);
                    btnPlayStore.setText("تحديث من Google Play 🛍️");
                    btnPlayStore.setTextColor(Color.WHITE);
                    btnPlayStore.setTextSize(14);
                    btnPlayStore.setTypeface(Typeface.DEFAULT_BOLD);

                    GradientDrawable btnPlayBg = new GradientDrawable();
                    btnPlayBg.setColor(Color.parseColor("#059669")); // Emerald
                    btnPlayBg.setCornerRadius(dpToPx(activity, 18));
                    btnPlayStore.setBackground(btnPlayBg);

                    LinearLayout.LayoutParams pBtn = new LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            dpToPx(activity, 48)
                    );
                    pBtn.bottomMargin = dpToPx(activity, 8);
                    btnPlayStore.setLayoutParams(pBtn);

                    btnPlayStore.setOnClickListener(v -> openLink(activity, playLink));
                    rootLayout.addView(btnPlayStore);
                }

                // زر 2: تحميل APK خارجي
                String apkLink = updateInfo.getApkLink();
                if (apkLink != null && !apkLink.trim().isEmpty()) {
                    Button btnApk = new Button(activity);
                    btnApk.setText("تحميل ملف APK خارجي 📥");
                    btnApk.setTextColor(Color.parseColor("#0F172A"));
                    btnApk.setTextSize(13);
                    btnApk.setTypeface(Typeface.DEFAULT_BOLD);

                    GradientDrawable btnApkBg = new GradientDrawable();
                    btnApkBg.setColor(Color.parseColor("#F1F5F9")); // Slate-100
                    btnApkBg.setCornerRadius(dpToPx(activity, 18));
                    btnApkBg.setStroke(dpToPx(activity, 1), Color.parseColor("#CBD5E1"));
                    btnApk.setBackground(btnApkBg);

                    LinearLayout.LayoutParams pApk = new LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            dpToPx(activity, 44)
                    );
                    pApk.bottomMargin = dpToPx(activity, 6);
                    btnApk.setLayoutParams(pApk);

                    btnApk.setOnClickListener(v -> openLink(activity, apkLink));
                    rootLayout.addView(btnApk);
                }

                // زر الإغلاق "لاحقاً" (يظهر فقط إذا لم يكن التحديث إجبارياً)
                if (!isForce) {
                    TextView btnLater = new TextView(activity);
                    btnLater.setText("لاحقاً، ذكرني لاحقاً");
                    btnLater.setTextColor(Color.parseColor("#94A3B8"));
                    btnLater.setTextSize(12);
                    btnLater.setTypeface(Typeface.DEFAULT_BOLD);
                    btnLater.setGravity(Gravity.CENTER);
                    btnLater.setPadding(dpToPx(activity, 8), dpToPx(activity, 8), dpToPx(activity, 8), dpToPx(activity, 8));

                    btnLater.setOnClickListener(v -> dialog.dismiss());
                    rootLayout.addView(btnLater);
                } else {
                    // رسالة تنبيه تفيد بأن التحديث إلزامي
                    TextView forceNotice = new TextView(activity);
                    forceNotice.setText("⚠️ هذا التحديث ضروري لمواصلة استخدام التطبيق.");
                    forceNotice.setTextColor(Color.parseColor("#EF4444"));
                    forceNotice.setTextSize(11);
                    forceNotice.setGravity(Gravity.CENTER);
                    forceNotice.setPadding(0, dpToPx(activity, 6), 0, 0);
                    rootLayout.addView(forceNotice);
                }

                dialog.setContentView(rootLayout);

                if (dialog.getWindow() != null) {
                    dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
                    int width = (int) (activity.getResources().getDisplayMetrics().widthPixels * 0.90);
                    dialog.getWindow().setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
                }

                dialog.show();

            } catch (Exception e) {
                Log.e(TAG, "Failed to display update dialog", e);
            }
        });
    }

    /**
     * فتح الروابط الخارجية عبر Intent.ACTION_VIEW
     */
    private static void openLink(@NonNull Activity activity, @NonNull String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            activity.startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(activity, "تعذر فتح الرابط: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private static int dpToPx(Context context, float dp) {
        return (int) (dp * context.getResources().getDisplayMetrics().density + 0.5f);
    }
}
