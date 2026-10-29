package com.mateen.game.controllers;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.CountDownTimer;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;
import com.google.firebase.database.ValueEventListener;
import com.mateen.game.MainActivity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * متحكم شاشة التحدي الجماعي (Room/Quiz Activity Controller):
 * 1. ميزة "إشعار انسحاب اللاعب" (Withdrawal Notification) لباقي اللاعبين بتصميم برتقالي أنيق مع تتبع محلي لمنع التكرار.
 * 2. مزامنة التفاعلات الحية وإرسالها/قراءتها فورياً عبر Firebase.
 * 3. تزامن الانتقال للسؤال التالي: مقارنة عدد الإجابات المسلمة (Total Answers) مع عدد اللاعبين النشطين (Active Players Count).
 * 4. نظام الخمول والمؤقت الإجباري (60 Seconds Timeout): تسجيل إجابة خاطئة تلقائياً عند انتهاء الوقت لإجبار الانتقال.
 * 5. معالجة خروج/انسحاب اللاعب (Player Left/Disconnected): الربط مع onDisconnect وتحديث حالة الغرفة فوراً.
 */
public class RoomQuizController {

    private static final String TAG = "RoomQuizController";
    public static final String PREFS_NAME = "MateenGamePrefs";
    public static final String KEY_ACTIVE_ROOM_ID = "activeRoomId";
    public static final String KEY_CURRENT_ROOM_ID = "currentRoomId";

    // نقاط الإجابة الصحيحة في التحديات: 1 نقطة بدلاً من 10 نقاط
    public static final int POINTS_PER_CORRECT_ANSWER = 1;

    // مؤقت الخمول الإجباري لكل سؤال (60 ثانية)
    public static final long QUESTION_TIMEOUT_DURATION_MS = 60000;
    private static CountDownTimer questionTimeoutTimer = null;

    // قائمة تتبع محلية (Local Tracking) لمنع تكرار الإشعار
    private static final Set<String> defaultNotifiedPlayers = new HashSet<>();

    public interface RoomQuizNavigationCallback {
        void moveToNextQuestion();
        void setOptionButtonsEnabled(boolean enabled);
        void showWaitingForPlayersLayout(boolean show);
    }

    public interface OnRoomSyncCallback {
        void onAllAnswered(int nextQuestionIndex);
        void onRoomFinished();
        void onActivePlayersCountChanged(int activeCount);
    }

    public interface OnTimeoutListener {
        void onTimeoutElapsed();
    }

    public static class RoomModel {
        private String id;
        private String transitionMode; // "SYNC" أو "ASYNC"
        private int currentQuestionIndex;

        public RoomModel() {}

        public RoomModel(String id, String transitionMode, int currentQuestionIndex) {
            this.id = id;
            this.transitionMode = transitionMode;
            this.currentQuestionIndex = currentQuestionIndex;
        }

        public String getId() { return id; }
        public String getTransitionMode() { return transitionMode != null ? transitionMode : "SYNC"; }
        public boolean isAsync() { return "ASYNC".equalsIgnoreCase(transitionMode); }
        public boolean isSync() { return !isAsync(); }
        public int getCurrentQuestionIndex() { return currentQuestionIndex; }
    }

    public static class RoomPlayer {
        private String id;
        private String name;
        private int score;
        private boolean hasLeft;
        private boolean isOnline = true;
        private boolean isActive = true;

        public RoomPlayer() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public int getScore() { return score; }
        public void setScore(int score) { this.score = score; }

        public boolean isHasLeft() { return hasLeft; }
        public void setHasLeft(boolean hasLeft) { this.hasLeft = hasLeft; }

        public boolean isOnline() { return isOnline; }
        public void setOnline(boolean online) { isOnline = online; }

        public boolean isActive() {
            return !hasLeft && isOnline && isActive;
        }

        public void setActive(boolean active) { isActive = active; }
    }

    // =========================================================================
    // 1. ميزة إشعار انسحاب اللاعب (Withdrawal Notification & Listener)
    // =========================================================================

    public static ValueEventListener attachRoomPlayersListener(
            @NonNull final Activity activity,
            @NonNull final String roomId,
            final String currentUserId,
            @NonNull final Set<String> notifiedWithdrawnPlayers,
            final OnRoomSyncCallback callback
    ) {
        DatabaseReference roomRef = FirebaseDatabase.getInstance()
                .getReference("rooms")
                .child(roomId);

        ValueEventListener listener = new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                if (activity.isFinishing() || activity.isDestroyed() || !snapshot.exists()) return;

                DataSnapshot playersSnap = snapshot.child("players");
                boolean anyPlayerStateChanged = false;

                for (DataSnapshot pSnap : playersSnap.getChildren()) {
                    String pId = pSnap.getKey();
                    if (pId == null) continue;

                    Boolean hasLeft = pSnap.child("hasLeft").getValue(Boolean.class);
                    Boolean isOnline = pSnap.child("isOnline").getValue(Boolean.class);
                    Boolean isActiveProp = pSnap.child("isActive").getValue(Boolean.class);

                    boolean isWithdrawn = (hasLeft != null && hasLeft) 
                            || (isOnline != null && !isOnline)
                            || (isActiveProp != null && !isActiveProp);

                    if (isWithdrawn) {
                        if (!notifiedWithdrawnPlayers.contains(pId)) {
                            notifiedWithdrawnPlayers.add(pId);
                            anyPlayerStateChanged = true;

                            if (currentUserId == null || !currentUserId.equals(pId)) {
                                String playerName = pSnap.child("name").getValue(String.class);
                                if (playerName == null || playerName.trim().isEmpty()) {
                                    playerName = "أحد المتسابقين";
                                }
                                showWithdrawalNotification(activity, playerName);
                            }
                        }
                    }
                }

                int currentQ = 0;
                if (snapshot.hasChild("currentQuestionIndex")) {
                    Integer q = snapshot.child("currentQuestionIndex").getValue(Integer.class);
                    if (q != null) currentQ = q;
                }

                // فحص شرط التزامن فوراً مع مقارنة عدد الإجابات بعدد اللاعبين النشطين
                checkIfAllAnswered(snapshot, roomId, currentQ, callback);
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                Log.e(TAG, "Room players listener cancelled: " + error.getMessage());
            }
        };

        roomRef.addValueEventListener(listener);
        return listener;
    }

    public static void showWithdrawalNotification(@NonNull final Activity activity, final String playerName) {
        activity.runOnUiThread(() -> {
            try {
                ViewGroup decorView = (ViewGroup) activity.getWindow().getDecorView();
                final FrameLayout banner = new FrameLayout(activity);

                int padH = dpToPx(activity, 16);
                int padV = dpToPx(activity, 10);
                banner.setPadding(padH, padV, padH, padV);

                GradientDrawable bg = new GradientDrawable();
                bg.setColor(Color.parseColor("#FFF7ED"));
                bg.setCornerRadius(dpToPx(activity, 20));
                bg.setStroke(dpToPx(activity, 1.5f), Color.parseColor("#FDBA74"));
                banner.setBackground(bg);
                banner.setElevation(dpToPx(activity, 10));

                LinearLayout contentLayout = new LinearLayout(activity);
                contentLayout.setOrientation(LinearLayout.HORIZONTAL);
                contentLayout.setGravity(Gravity.CENTER);
                contentLayout.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

                TextView tvText = new TextView(activity);
                tvText.setText("انسحب " + playerName + " من التحدي 🚪");
                tvText.setTextColor(Color.parseColor("#C2410C"));
                tvText.setTextSize(13);
                tvText.setTypeface(Typeface.DEFAULT_BOLD);
                contentLayout.addView(tvText);

                FrameLayout.LayoutParams bannerParams = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                );
                bannerParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                bannerParams.topMargin = dpToPx(activity, 54);
                banner.setLayoutParams(bannerParams);

                banner.addView(contentLayout);
                decorView.addView(banner);

                banner.setAlpha(0f);
                banner.setTranslationY(-dpToPx(activity, 20));
                banner.animate()
                        .alpha(1f)
                        .translationY(0)
                        .setDuration(350)
                        .start();

                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    banner.animate()
                            .alpha(0f)
                            .translationY(-dpToPx(activity, 20))
                            .setDuration(350)
                            .withEndAction(() -> {
                                try {
                                    decorView.removeView(banner);
                                } catch (Exception ignored) {}
                            })
                            .start();
                }, 3500);

            } catch (Exception e) {
                Log.e(TAG, "Error displaying withdrawal banner: " + e.getMessage());
            }
        });
    }

    // =========================================================================
    // 2. تزامن الانتقال للسؤال التالي (إجبار انتظار الجميع: Total Answers == Active Players)
    // =========================================================================

    /**
     * التحقق من شرط التزامن:
     * يستبدل الشرط الثابت بمقارنة دقيقة بين:
     * - عدد الإجابات المسلمة (Total Answers)
     * - عدد اللاعبين النشطين حالياً في الغرفة (Active Players Count)
     *
     * لن يتم الانتقال إلا إذا كان: totalAnswersFromActive == activePlayersCount && activePlayersCount > 0
     */
    public static boolean checkIfAllAnswered(
            DataSnapshot roomSnapshot,
            String roomId,
            int currentQuestionIndex,
            OnRoomSyncCallback callback
    ) {
        if (roomSnapshot == null || !roomSnapshot.exists()) return false;

        DataSnapshot playersSnap = roomSnapshot.child("players");
        DataSnapshot answersSnap = roomSnapshot.child("currentAnswers");

        int activePlayersCount = 0;
        int totalAnswersFromActive = 0;

        for (DataSnapshot pSnap : playersSnap.getChildren()) {
            String pId = pSnap.getKey();
            if (pId == null) continue;

            Boolean hasLeft = pSnap.child("hasLeft").getValue(Boolean.class);
            Boolean isOnline = pSnap.child("isOnline").getValue(Boolean.class);
            Boolean isActiveProp = pSnap.child("isActive").getValue(Boolean.class);

            boolean isActive = (hasLeft == null || !hasLeft) 
                    && (isOnline == null || isOnline)
                    && (isActiveProp == null || isActiveProp);

            if (isActive) {
                activePlayersCount++;
                if (answersSnap.hasChild(pId)) {
                    totalAnswersFromActive++;
                }
            }
        }

        if (callback != null) {
            callback.onActivePlayersCountChanged(activePlayersCount);
        }

        // إذا انسحب جميع اللاعبين
        if (activePlayersCount == 0) {
            finishRoom(roomId);
            if (callback != null) callback.onRoomFinished();
            return false;
        }

        Log.d(TAG, "Room Sync Check: totalAnswers=" + totalAnswersFromActive + " / activePlayers=" + activePlayersCount);

        // إجبار انتظار الجميع: لن يتم الانتقال إلا إذا سلم كل اللاعبين النشطين إجاباتهم
        if (totalAnswersFromActive == activePlayersCount && activePlayersCount > 0) {
            Log.i(TAG, "All active players answered (" + totalAnswersFromActive + "/" + activePlayersCount + "). Advancing to question " + (currentQuestionIndex + 1));
            advanceToNextQuestion(roomId, currentQuestionIndex + 1);
            if (callback != null) {
                callback.onAllAnswered(currentQuestionIndex + 1);
            }
            return true;
        }

        return false;
    }

    public static void advanceToNextQuestion(String roomId, int nextQuestionIndex) {
        if (roomId == null || roomId.isEmpty()) return;

        DatabaseReference roomRef = FirebaseDatabase.getInstance()
                .getReference("rooms")
                .child(roomId);

        Map<String, Object> updates = new HashMap<>();
        updates.put("currentQuestionIndex", nextQuestionIndex);
        updates.put("questionStartTime", ServerValue.TIMESTAMP);
        updates.put("currentAnswers", null); // تفريغ إجابات السؤال السابق لبدء جولة جديدة

        roomRef.updateChildren(updates);
    }

    public static void finishRoom(String roomId) {
        if (roomId == null || roomId.isEmpty()) return;
        DatabaseReference roomRef = FirebaseDatabase.getInstance()
                .getReference("rooms")
                .child(roomId);
        roomRef.child("status").setValue("FINISHED");
    }

    // =========================================================================
    // 3. نظام الخمول والمؤقت الإجباري (60 Seconds Timeout)
    // =========================================================================

    /**
     * بدء مؤقت 60 ثانية إجباري لكل سؤال جديد:
     * إذا انتهت الـ 60 ثانية دون اختيار، يسجل إجابة خاطئة (0 نقاط) ويكمل شرط الانتقال
     */
    public static void startQuestionTimeoutTimer(
            @NonNull final String roomId,
            @NonNull final String userId,
            final int questionIndex,
            final OnTimeoutListener timeoutListener
    ) {
        cancelQuestionTimeoutTimer();

        questionTimeoutTimer = new CountDownTimer(QUESTION_TIMEOUT_DURATION_MS, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {}

            @Override
            public void onFinish() {
                Log.w(TAG, "Question timeout reached (60s). Submitting automatic timeout answer for: " + userId);
                submitTimeoutAnswer(roomId, userId, questionIndex);
                if (timeoutListener != null) {
                    timeoutListener.onTimeoutElapsed();
                }
            }
        }.start();
    }

    public static void cancelQuestionTimeoutTimer() {
        if (questionTimeoutTimer != null) {
            try {
                questionTimeoutTimer.cancel();
            } catch (Exception ignored) {}
            questionTimeoutTimer = null;
        }
    }

    public static void submitTimeoutAnswer(String roomId, String userId, int questionIndex) {
        if (roomId == null || roomId.isEmpty() || userId == null || userId.isEmpty()) return;

        DatabaseReference roomRef = FirebaseDatabase.getInstance()
                .getReference("rooms")
                .child(roomId);

        Map<String, Object> timeoutData = new HashMap<>();
        timeoutData.put("userId", userId);
        timeoutData.put("questionIndex", questionIndex);
        timeoutData.put("isCorrect", false);
        timeoutData.put("points", 0);
        timeoutData.put("isTimeout", true);
        timeoutData.put("timestamp", ServerValue.TIMESTAMP);

        roomRef.child("currentAnswers").child(userId).setValue(timeoutData);
    }

    // =========================================================================
    // 4. معالجة خروج/انسحاب اللاعب (Player Left / OnDisconnect)
    // =========================================================================

    /**
     * ربط OnDisconnect الخاص بـ Firebase للتعامل مع انقطاع الاتصال أو إغلاق التطبيق فجأة
     */
    public static void setupOnDisconnect(
            @NonNull String roomId,
            @NonNull String userId,
            int currentQuestionIndex
    ) {
        if (roomId.isEmpty() || userId.isEmpty()) return;

        DatabaseReference playerRef = FirebaseDatabase.getInstance()
                .getReference("rooms")
                .child(roomId)
                .child("players")
                .child(userId);

        Map<String, Object> disconnectUpdates = new HashMap<>();
        disconnectUpdates.put("hasLeft", true);
        disconnectUpdates.put("isOnline", false);
        disconnectUpdates.put("isActive", false);
        disconnectUpdates.put("leftTimestamp", ServerValue.TIMESTAMP);

        playerRef.onDisconnect().updateChildren(disconnectUpdates);

        // تسجيل إجابة تخطي للسؤال الحالي عند انقطاع الاتصال حتى لا يبقى الآخرون عالقين
        DatabaseReference answerRef = FirebaseDatabase.getInstance()
                .getReference("rooms")
                .child(roomId)
                .child("currentAnswers")
                .child(userId);

        Map<String, Object> disconnectAnswer = new HashMap<>();
        disconnectAnswer.put("userId", userId);
        disconnectAnswer.put("questionIndex", currentQuestionIndex);
        disconnectAnswer.put("isCorrect", false);
        disconnectAnswer.put("points", 0);
        disconnectAnswer.put("isSkipped", true);
        disconnectAnswer.put("timestamp", ServerValue.TIMESTAMP);

        answerRef.onDisconnect().setValue(disconnectAnswer);
    }

    /**
     * معالجة خروج/انسحاب اللاعب فوراً عند الضغط على زر الرجوع أو استدعاء onPause/onDestroy
     */
    public static void handlePlayerExit(
            @NonNull Context context,
            @NonNull String roomId,
            @NonNull String userId,
            int currentQuestionIndex
    ) {
        if (roomId.isEmpty() || userId.isEmpty()) return;

        cancelQuestionTimeoutTimer();

        DatabaseReference db = FirebaseDatabase.getInstance().getReference();
        DatabaseReference roomRef = db.child("rooms").child(roomId);

        // 1. تغيير حالة اللاعب في الغرفة فوراً
        Map<String, Object> leaveUpdates = new HashMap<>();
        leaveUpdates.put("hasLeft", true);
        leaveUpdates.put("isOnline", false);
        leaveUpdates.put("isActive", false);
        leaveUpdates.put("leftTimestamp", ServerValue.TIMESTAMP);

        roomRef.child("players").child(userId).updateChildren(leaveUpdates);

        // 2. تسجيل إجابة تخطي فورية لهذا اللاعب في السؤال الحالي لإنقاص عدد المنتظرين
        Map<String, Object> skipData = new HashMap<>();
        skipData.put("userId", userId);
        skipData.put("questionIndex", currentQuestionIndex);
        skipData.put("isCorrect", false);
        skipData.put("points", 0);
        skipData.put("isSkipped", true);
        skipData.put("timestamp", ServerValue.TIMESTAMP);

        roomRef.child("currentAnswers").child(userId).setValue(skipData);

        // 3. تنظيف المعرف المحلي للغرفة
        clearLocalActiveRoomId(context);
    }

    // =========================================================================
    // 5. تسجيل الإجابة ونقاط التحدي (1 نقطة للإجابة الصحيحة)
    // =========================================================================

    public static void submitPlayerAnswer(
            @NonNull String roomId,
            @NonNull String userId,
            int questionIndex,
            boolean isCorrect
    ) {
        if (roomId.isEmpty() || userId.isEmpty()) return;

        // إيقاف مؤقت الـ 60 ثانية فور قيام اللاعب بالاختيار
        cancelQuestionTimeoutTimer();

        final int pointsEarned = isCorrect ? POINTS_PER_CORRECT_ANSWER : 0;

        DatabaseReference db = FirebaseDatabase.getInstance().getReference();
        DatabaseReference roomRef = db.child("rooms").child(roomId);

        Map<String, Object> answerData = new HashMap<>();
        answerData.put("userId", userId);
        answerData.put("questionIndex", questionIndex);
        answerData.put("isCorrect", isCorrect);
        answerData.put("points", pointsEarned); // نقطة واحدة (1) عند الإجابة الصحيحة
        answerData.put("isSkipped", false);
        answerData.put("timestamp", ServerValue.TIMESTAMP);

        roomRef.child("currentAnswers").child(userId).setValue(answerData);

        if (isCorrect) {
            roomRef.child("players").child(userId).child("score").setValue(ServerValue.increment(pointsEarned));
            db.child("users").child(userId).child("totalPoints").setValue(ServerValue.increment(pointsEarned));
        }
    }

    // =========================================================================
    // 6. دوال مساعدة لإدارة شريط التحدي ومعالجة التخطي
    // =========================================================================

    public static void handleSkipClick(
            RoomModel room,
            int currentQuestionIndex,
            String userId,
            RoomQuizNavigationCallback callback
    ) {
        if (room == null || callback == null) return;

        cancelQuestionTimeoutTimer();

        submitAnswerToFirebase(room.getId(), userId, currentQuestionIndex, false, 0);

        if (room.isAsync()) {
            callback.moveToNextQuestion();
        } else {
            callback.setOptionButtonsEnabled(false);
            callback.showWaitingForPlayersLayout(true);
        }
    }

    private static void submitAnswerToFirebase(
            String roomId,
            String userId,
            int questionIndex,
            boolean isCorrect,
            int pointsEarned
    ) {
        if (roomId == null || roomId.isEmpty() || userId == null || userId.isEmpty()) return;

        DatabaseReference roomRef = FirebaseDatabase.getInstance()
                .getReference("rooms")
                .child(roomId);

        Map<String, Object> answerData = new HashMap<>();
        answerData.put("userId", userId);
        answerData.put("questionIndex", questionIndex);
        answerData.put("isCorrect", isCorrect);
        answerData.put("points", pointsEarned);
        answerData.put("isSkipped", true);
        answerData.put("timestamp", ServerValue.TIMESTAMP);

        roomRef.child("currentAnswers").child(userId).setValue(answerData);
    }

    public static void clearLocalActiveRoomId(@NonNull Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .remove(KEY_ACTIVE_ROOM_ID)
                .remove(KEY_CURRENT_ROOM_ID)
                .apply();
    }

    public static void saveLocalActiveRoomId(@NonNull Context context, String roomId) {
        if (roomId == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_ACTIVE_ROOM_ID, roomId)
                .putString(KEY_CURRENT_ROOM_ID, roomId)
                .apply();
    }

    public static void handleWithdrawal(
            @NonNull final Activity activity,
            final String roomId,
            final String userId,
            final int earnedPoints
    ) {
        cancelQuestionTimeoutTimer();
        clearLocalActiveRoomId(activity);

        if (userId == null || userId.isEmpty()) {
            navigateDirectlyToMain(activity);
            return;
        }

        DatabaseReference db = FirebaseDatabase.getInstance().getReference();
        List<Task<Void>> pendingTasks = new ArrayList<>();

        DatabaseReference userRef = db.child("users").child(userId);
        Map<String, Object> userUpdates = new HashMap<>();
        if (earnedPoints > 0) {
            userUpdates.put("totalPoints", ServerValue.increment(earnedPoints));
        }
        userUpdates.put(KEY_ACTIVE_ROOM_ID, null);
        userUpdates.put(KEY_CURRENT_ROOM_ID, null);

        Task<Void> userUpdateTask = userRef.updateChildren(userUpdates);
        pendingTasks.add(userUpdateTask);

        if (roomId != null && !roomId.isEmpty()) {
            DatabaseReference playerRoomRef = db.child("rooms")
                    .child(roomId)
                    .child("players")
                    .child(userId);

            Map<String, Object> leaveUpdates = new HashMap<>();
            leaveUpdates.put("hasLeft", true);
            leaveUpdates.put("isOnline", false);
            leaveUpdates.put("isActive", false);
            leaveUpdates.put("leftTimestamp", ServerValue.TIMESTAMP);

            Task<Void> roomPlayerTask = playerRoomRef.updateChildren(leaveUpdates);
            pendingTasks.add(roomPlayerTask);

            // إرسال إجابة تخطي لتفريغ مقعد اللاعب
            DatabaseReference answerRef = db.child("rooms")
                    .child(roomId)
                    .child("currentAnswers")
                    .child(userId);

            Map<String, Object> answerUpdates = new HashMap<>();
            answerUpdates.put("userId", userId);
            answerUpdates.put("isCorrect", false);
            answerUpdates.put("points", 0);
            answerUpdates.put("isSkipped", true);
            answerUpdates.put("timestamp", ServerValue.TIMESTAMP);

            Task<Void> answerTask = answerRef.setValue(answerUpdates);
            pendingTasks.add(answerTask);
        }

        Tasks.whenAllComplete(pendingTasks).addOnCompleteListener(task -> {
            navigateDirectlyToMain(activity);
        });
    }

    private static void navigateDirectlyToMain(@NonNull Activity activity) {
        Intent intent = new Intent(activity, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        activity.startActivity(intent);
        activity.finish();
    }

    private static int dpToPx(Context context, float dp) {
        return Math.round(dp * context.getResources().getDisplayMetrics().density);
    }
}
