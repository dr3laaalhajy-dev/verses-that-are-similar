package com.mateen.game;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * خدمة استلام الإشعارات المباشرة (Native FCM Service)
 * تعمل في الواجهة والخلفية وأثناء إغلاق التطبيق تماماً (Killed State).
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "MyFirebaseMsgService";
    public static final String CHANNEL_ID = "mateen_general";
    public static final String CHANNEL_NAME = "تنبيهات المتشابهات القرآنية";
    public static final String CHANNEL_DESC = "إشعارات التحديات والمسابقات والورد اليومي";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "FCM Message received from: " + remoteMessage.getFrom());

        String title = null;
        String body = null;

        // 1. استخراج العنوان والنص من كائن Notification إن وُجد
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        // 2. استخراج العنوان والنص من كائن Data كـ Fallback
        Map<String, String> data = remoteMessage.getData();
        if (title == null || title.trim().isEmpty()) {
            title = data.get("title");
        }
        if (body == null || body.trim().isEmpty()) {
            body = data.get("body");
        }

        // العنوان الافتراضي في حال عدم وجود عنوان
        if (title == null || title.trim().isEmpty()) {
            title = getString(R.string.app_name);
        }

        // إذا لم يكن هناك نص ولا بيانات، لا نعرض إشعاراً فارغاً
        if ((body == null || body.trim().isEmpty()) && data.isEmpty()) {
            return;
        }

        // 3. بناء وعرض الإشعار في درج النظام
        sendNotification(title, body != null ? body : "", data);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "New Native FCM Token generated: " + token);

        // حفظ التوكن محلياً في SharedPreferences
        getSharedPreferences("mateen_fcm_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("native_fcm_token", token)
                .apply();

        // إشعار الـ MainActivity في حال كان التطبيق يعمل
        MainActivity.broadcastTokenToWeb(token);
    }

    /**
     * بناء الإشعار وعرضه فوراً في شاشة القفل ودرج الإشعارات
     */
    private void sendNotification(String title, String messageBody, Map<String, String> data) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        // تمرير كافة البيانات القادمة من الإشعار (مثل الرابط والمسار target_url)
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        int requestCode = (int) System.currentTimeMillis();
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                requestCode,
                intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle(title)
                        .setContentText(messageBody)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(messageBody))
                        .setAutoCancel(true)
                        .setSound(defaultSoundUri)
                        .setContentIntent(pendingIntent)
                        .setColor(Color.parseColor("#10B981")) // لون أخضر إسلامي مميز
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                        .setDefaults(NotificationCompat.DEFAULT_ALL);

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // إنشاء قناة الإشعارات لنظام أندرويد 8.0 فما فوق (API 26+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESC);
            channel.enableLights(true);
            channel.setLightColor(Color.GREEN);
            channel.enableVibration(true);
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }

        if (notificationManager != null) {
            int notificationId = (int) System.currentTimeMillis();
            notificationManager.notify(notificationId, notificationBuilder.build());
        }
    }
}

