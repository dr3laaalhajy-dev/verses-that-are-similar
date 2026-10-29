package com.mateen.game.controllers;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.firebase.database.ChildEventListener;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;
import com.mateen.game.R;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

/**
 * متحكم التفاعلات الحية (Live Reactions Controller):
 * 1. إرسال (Push) كائن التفاعل (reactionType, senderId, senderName, timestamp) إلى مسار الغرفة: rooms/{roomId}/reactions.
 * 2. استخدام ChildEventListener لقراءة التفاعلات الجديدة القادمة من السيرفر وعرضها فوراً للمستخدمين الآخرين.
 * 3. تشغيل أنيميشن طافي ناعم وجميل مع موجة جيبية عائمة واختفاء تدريجي.
 */
public class LiveReactionsController {

    private static final String TAG = "LiveReactionsController";

    private final Context context;
    private final FrameLayout overlayContainer;
    private final String roomId;
    private final String currentUserId;
    private final String currentUserName;
    private final Random random = new Random();

    private DatabaseReference reactionsRef;
    private ChildEventListener reactionsListener;

    public LiveReactionsController(
            @NonNull Context context,
            @NonNull FrameLayout overlayContainer,
            @NonNull String roomId,
            @NonNull String currentUserId,
            @NonNull String currentUserName
    ) {
        this.context = context;
        this.overlayContainer = overlayContainer;
        this.roomId = roomId;
        this.currentUserId = currentUserId;
        this.currentUserName = currentUserName;

        // بدء الاستماع للتفاعلات القادمة من باقي اللاعبين في الغرفة
        attachReactionsListener();
    }

    /**
     * إرسال (Push) كائن التفاعل إلى مسار Firebase: rooms/{roomId}/reactions
     * يتضمن: reactionType و senderId و senderName و timestamp
     */
    public void sendReaction(@NonNull String reactionType) {
        if (roomId.isEmpty() || currentUserId.isEmpty()) return;

        // 1. عرض التفاعل محلياً للمرسل للاستجابة اللحظية الفورية
        playFloatingAnimation(reactionType, currentUserName);

        try {
            if (reactionsRef == null) {
                reactionsRef = FirebaseDatabase.getInstance()
                        .getReference("rooms")
                        .child(roomId)
                        .child("reactions");
            }

            Map<String, Object> reactionData = new HashMap<>();
            reactionData.put("reactionType", reactionType);
            reactionData.put("emoji", reactionType); // التوافق مع التسميات البديلة
            reactionData.put("senderId", currentUserId);
            reactionData.put("senderName", currentUserName);
            reactionData.put("timestamp", ServerValue.TIMESTAMP);

            reactionsRef.push().setValue(reactionData)
                    .addOnFailureListener(e -> Log.e(TAG, "Failed to send live reaction: " + e.getMessage()));

        } catch (Exception e) {
            Log.e(TAG, "Error pushing live reaction to Firebase", e);
        }
    }

    /**
     * الاستماع للتفاعلات الجديدة في الغرفة عبر ChildEventListener وعرضها فوراً
     */
    private void attachReactionsListener() {
        if (roomId.isEmpty()) return;

        try {
            reactionsRef = FirebaseDatabase.getInstance()
                    .getReference("rooms")
                    .child(roomId)
                    .child("reactions");

            // جلب التفاعلات الحديثة فقط (آخر 30 تفاعل)
            reactionsListener = new ChildEventListener() {
                @Override
                public void onChildAdded(@NonNull DataSnapshot snapshot, @Nullable String previousChildName) {
                    if (!snapshot.exists()) return;

                    String senderId = snapshot.child("senderId").getValue(String.class);
                    // إذا كان التفاعل قادماً من لاعب آخر، نعرضه للمستخدم
                    if (senderId != null && !senderId.equals(currentUserId)) {
                        String reactionType = snapshot.child("reactionType").getValue(String.class);
                        if (reactionType == null) {
                            reactionType = snapshot.child("emoji").getValue(String.class);
                        }
                        String senderName = snapshot.child("senderName").getValue(String.class);
                        if (senderName == null || senderName.isEmpty()) {
                            senderName = "متسابق";
                        }

                        if (reactionType != null && !reactionType.isEmpty()) {
                            playFloatingAnimation(reactionType, senderName);
                        }
                    }
                }

                @Override
                public void onChildChanged(@NonNull DataSnapshot snapshot, @Nullable String previousChildName) {}

                @Override
                public void onChildRemoved(@NonNull DataSnapshot snapshot) {}

                @Override
                public void onChildMoved(@NonNull DataSnapshot snapshot, @Nullable String previousChildName) {}

                @Override
                public void onCancelled(@NonNull DatabaseError error) {
                    Log.w(TAG, "Reactions listener cancelled: " + error.getMessage());
                }
            };

            reactionsRef.limitToLast(30).addChildEventListener(reactionsListener);

        } catch (Exception e) {
            Log.e(TAG, "Error attaching reactions ChildEventListener", e);
        }
    }

    /**
     * تشغيل أنيميشن التفاعل العائم في الحاوية البصرية
     */
    public void playFloatingAnimation(String emoji, String senderName) {
        if (overlayContainer == null) return;
        overlayContainer.post(() -> {
            try {
                View reactionView = LayoutInflater.from(context).inflate(R.layout.view_floating_emoji, overlayContainer, false);
                TextView tvEmoji = reactionView.findViewById(R.id.tvFloatingEmoji);
                TextView tvSender = reactionView.findViewById(R.id.tvSenderName);

                if (tvEmoji != null) tvEmoji.setText(emoji);
                if (tvSender != null) tvSender.setText(senderName);

                overlayContainer.addView(reactionView);

                int parentWidth = overlayContainer.getWidth();
                int parentHeight = overlayContainer.getHeight();

                float startX = (parentWidth * 0.2f) + (random.nextFloat() * (parentWidth * 0.6f));
                float startY = parentHeight > 0 ? parentHeight - 120 : 500;
                reactionView.setX(startX);
                reactionView.setY(startY);
                reactionView.setAlpha(0f);
                reactionView.setScaleX(0.4f);
                reactionView.setScaleY(0.4f);

                reactionView.animate()
                        .alpha(1f)
                        .scaleX(1.1f)
                        .scaleY(1.1f)
                        .setDuration(250)
                        .start();

                ValueAnimator verticalAnimator = ValueAnimator.ofFloat(startY, startY - (parentHeight * 0.55f));
                verticalAnimator.setDuration(2200);
                verticalAnimator.setInterpolator(new DecelerateInterpolator());

                final float frequency = 2f + random.nextFloat();
                final float amplitude = 35f + (random.nextFloat() * 25f);

                verticalAnimator.addUpdateListener(animation -> {
                    float currentY = (float) animation.getAnimatedValue();
                    reactionView.setY(currentY);

                    float fraction = animation.getAnimatedFraction();
                    float waveX = startX + (float) (Math.sin(fraction * Math.PI * frequency) * amplitude);
                    reactionView.setX(waveX);

                    if (fraction > 0.6f) {
                        reactionView.setAlpha(1f - ((fraction - 0.6f) / 0.4f));
                    }
                });

                verticalAnimator.addListener(new AnimatorListenerAdapter() {
                    @Override
                    public void onAnimationEnd(Animator animation) {
                        try {
                            overlayContainer.removeView(reactionView);
                        } catch (Exception ignored) {}
                    }
                });

                verticalAnimator.start();
            } catch (Exception e) {
                Log.e(TAG, "Error playing floating animation", e);
            }
        });
    }

    /**
     * تنظيف المستمعات عند مغادرة أو إغلاق الشاشة
     */
    public void cleanup() {
        try {
            if (reactionsRef != null && reactionsListener != null) {
                reactionsRef.removeEventListener(reactionsListener);
                reactionsListener = null;
            }
        } catch (Exception e) {
            Log.w(TAG, "Error cleaning up reactions listener: " + e.getMessage());
        }
    }
}
