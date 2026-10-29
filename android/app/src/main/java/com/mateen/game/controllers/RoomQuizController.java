package com.mateen.game.controllers;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
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
 * 2. معالجة زر الانسحاب (Withdrawal) وتنظيف مرجع الغرفة النشطة (activeRoomId).
 * 3. التحقق من شرط التزامن (checkIfAllAnswered) بالاعتماد على اللاعبين النشطين فقط.
 * 4. مشغل إعادة الفحص الفوري (Immediate Trigger) عند تغير حالة أي لاعب إلى hasLeft = true.
 * 5. إدارة شريط "تحدي جاري الآن" في MainActivity وإخفاؤه تلقائياً إذا كان hasLeft == true.
 * 6. معالجة زر التخطي (Skip) وفق نمط الغرفة (Sync vs Async).
 */
public class RoomQuizController {

    private static final String TAG = "RoomQuizController";
    public static final String PREFS_NAME = "MateenGamePrefs";
    public static final String KEY_ACTIVE_ROOM_ID = "activeRoomId";
    public static final String KEY_CURRENT_ROOM_ID = "currentRoomId";

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
            return !hasLeft && isOnline;
        }
    }

    // =========================================================================
    // 1. ميزة إشعار انسحاب اللاعب (Withdrawal Notification & Listener)
    // =========================================================================

    /**
     * ربط مستمع اللاعبين في الغرفة لرصد الانسحاب وإظهار إشعار فوري لباقي اللاعبين:
     * 1. تتبع الإشعارات السابقة عبر notifiedWithdrawnPlayers.
     * 2. التحقق من hasLeft == true أو isOnline == false.
     * 3. إظهار إشعار مخصص وأنيق بعبارة: "انسحب [الاسم] من التحدي 🚪".
     * 4. استدعاء checkIfAllAnswered فوراً لمزامنة انتقال باقي اللاعبين دون توقف.
     *
     * @param activity النشاط الحالي (RoomActivity)
     * @param roomId معرف الغرفة
     * @param currentUserId معرف اللاعب الحالي (حتى لا يظهر إشعار للاعب عن نفسه)
     * @param notifiedWithdrawnPlayers قائمة التتبع المحلية لمنع التكرار
     * @param callback معالج أحداث التزامن
     * @return كائن ValueEventListener لحفظه وإلغائه في onDestroy
     */
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
                if (!snapshot.exists()) return;

                Integer curQVal = snapshot.child("currentQuestionIndex").getValue(Integer.class);
                int currentQ = curQVal != null ? curQVal : 0;

                boolean someoneJustWithdrew = false;
                DataSnapshot playersSnap = snapshot.child("players");

                // المرور (Loop) على بيانات اللاعبين
                for (DataSnapshot pSnap : playersSnap.getChildren()) {
                    String pId = pSnap.getKey();
                    if (pId == null) continue;

                    Boolean hasLeft = pSnap.child("hasLeft").getValue(Boolean.class);
                    Boolean isOnline = pSnap.child("isOnline").getValue(Boolean.class);

                    // تحقق من حالة اللاعب: هل انسحب أو غادر؟
                    boolean isWithdrawn = Boolean.TRUE.equals(hasLeft) || Boolean.FALSE.equals(isOnline);

                    // شرط الإشعار:
                    // 1. اللاعب منسحب
                    // 2. معرّف هذا اللاعب غير موجود في قائمة notifiedWithdrawnPlayers
                    if (isWithdrawn && !notifiedWithdrawnPlayers.contains(pId)) {
                        // إضافة فورية لمنع التكرار مع أي تحديثات لاحقة
                        notifiedWithdrawnPlayers.add(pId);

                        // إظهار الإشعار فقط إذا لم يكن هذا اللاعب هو المستخدم نفسه
                        if (currentUserId == null || !currentUserId.equals(pId)) {
                            String pName = pSnap.child("name").getValue(String.class);
                            if (pName == null || pName.trim().isEmpty()) {
                                pName = "أحد المتسابقين";
                            }

                            // تصميم الإشعار (Custom UI Notification)
                            showWithdrawalNotification(activity, pName);
                        }

                        someoneJustWithdrew = true;
                    }
                }

                // استدعاء فوري لفحص التزامن والانتقال للسؤال التالي إذا لزم الأمر
                if (someoneJustWithdrew) {
                    Log.i(TAG, "Withdrawal detected. Running immediate sync check.");
                    checkIfAllAnswered(snapshot, roomId, currentQ, callback);
                    return;
                }

                checkIfAllAnswered(snapshot, roomId, currentQ, callback);
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                Log.e(TAG, "Players listener cancelled: " + error.getMessage());
            }
        };

        roomRef.addValueEventListener(listener);
        return listener;
    }

    /**
     * إظهار إشعار انسحاب مخصص (Custom In-App Banner) بتصميم كهرماني/برتقالي أنيق
     * مع لوجو الخروج (🚪) بدلاً من الـ Toast الافتراضي الرمادي.
     *
     * @param activity النشاط الحالي
     * @param playerName اسم اللاعب المنسحب
     */
    public static void showWithdrawalNotification(@NonNull final Activity activity, final String playerName) {
        if (activity.isFinishing() || activity.isDestroyed()) return;

        activity.runOnUiThread(() -> {
            try {
                View decorView = activity.getWindow().getDecorView();
                if (decorView instanceof ViewGroup) {
                    final ViewGroup rootView = (ViewGroup) decorView;

                    final LinearLayout banner = new LinearLayout(activity);
                    banner.setOrientation(LinearLayout.HORIZONTAL);
                    banner.setGravity(Gravity.CENTER_VERTICAL);
                    banner.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

                    int padH = dpToPx(activity, 16);
                    int padV = dpToPx(activity, 10);
                    banner.setPadding(padH, padV, padH, padV);

                    // خلفية برتقالية كهرمانية دافئة مع زوايا دائرية وحدود خفيفة وظل
                    GradientDrawable bg = new GradientDrawable();
                    bg.setColor(Color.parseColor("#9A3412")); // Amber-800 فخم
                    bg.setCornerRadius(dpToPx(activity, 24));
                    bg.setStroke(dpToPx(activity, 1.5f), Color.parseColor("#FDBA74")); // Amber-300
                    banner.setBackground(bg);
                    banner.setElevation(dpToPx(activity, 10));

                    // أيقونة الخروج
                    TextView iconView = new TextView(activity);
                    iconView.setText("🚪");
                    iconView.setTextSize(16);
                    iconView.setPadding(0, 0, dpToPx(activity, 8), 0);
                    banner.addView(iconView);

                    // نص الرسالة
                    TextView msgView = new TextView(activity);
                    msgView.setText("انسحب " + playerName + " من التحدي");
                    msgView.setTextColor(Color.parseColor("#FFFBEB"));
                    msgView.setTextSize(13.5f);
                    msgView.setTypeface(Typeface.DEFAULT_BOLD);
                    banner.addView(msgView);

                    // إعداد تموضع الإشعار في الجزء العلوي بتوسيط أفقي
                    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.WRAP_CONTENT,
                            FrameLayout.LayoutParams.WRAP_CONTENT
                    );
                    params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                    params.topMargin = dpToPx(activity, 52);
                    banner.setLayoutParams(params);

                    // حركة ظهور سلسة (Fade-in + Slide-down)
                    banner.setAlpha(0f);
                    banner.setTranslationY(-dpToPx(activity, 35));
                    rootView.addView(banner);

                    banner.animate()
                            .alpha(1f)
                            .translationY(0)
                            .setDuration(260)
                            .start();

                    // إخفاء تلقائي بعد 3.5 ثوانٍ بحركة انسيابية
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        if (banner.getParent() != null) {
                            banner.animate()
                                    .alpha(0f)
                                    .translationY(-dpToPx(activity, 35))
                                    .setDuration(260)
                                    .withEndAction(() -> rootView.removeView(banner))
                                    .start();
                        }
                    }, 3500);

                    return;
                }
            } catch (Exception e) {
                Log.w(TAG, "Floating banner fallback to styled Toast", e);
            }

            // خيار احتياطي (Custom Toast)
            Toast toast = Toast.makeText(activity, "🚪 انسحب " + playerName + " من التحدي", Toast.LENGTH_SHORT);
            toast.show();
        });
    }

    private static int dpToPx(Context context, float dp) {
        return (int) (dp * context.getResources().getDisplayMetrics().density + 0.5f);
    }

    // =========================================================================
    // 2. برمجة زر الانسحاب (Withdraw Action) وتنظيف مرجع الغرفة النشطة
    // =========================================================================

    public static void handleWithdrawal(
            @NonNull final Activity activity,
            final String roomId,
            final String userId,
            final int earnedPoints
    ) {
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
            leaveUpdates.put("leftTimestamp", ServerValue.TIMESTAMP);

            Task<Void> roomUpdateTask = playerRoomRef.updateChildren(leaveUpdates);
            pendingTasks.add(roomUpdateTask);
        }

        Tasks.whenAllComplete(pendingTasks).addOnCompleteListener(activity, task -> {
            navigateDirectlyToMain(activity);
        });
    }

    public static void clearLocalActiveRoomId(@NonNull Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .remove(KEY_ACTIVE_ROOM_ID)
                .remove(KEY_CURRENT_ROOM_ID)
                .apply();
    }

    public static void saveLocalActiveRoomId(@NonNull Context context, String roomId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_ACTIVE_ROOM_ID, roomId)
                .putString(KEY_CURRENT_ROOM_ID, roomId)
                .apply();
    }

    private static void navigateDirectlyToMain(@NonNull Activity activity) {
        Intent intent = new Intent(activity, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
        activity.finish();
    }

    // =========================================================================
    // 3. تحديث منطق التحقق في الشاشة الرئيسية (MainActivity Logic)
    // =========================================================================

    public static void checkAndManageActiveChallengeBanner(
            @NonNull final Context context,
            @NonNull final View bannerView,
            final String userId
    ) {
        if (userId == null || userId.isEmpty()) {
            bannerView.setVisibility(View.GONE);
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        final String localRoomId = prefs.getString(KEY_ACTIVE_ROOM_ID, null);

        final DatabaseReference db = FirebaseDatabase.getInstance().getReference();
        DatabaseReference userRef = db.child("users").child(userId);

        userRef.addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot userSnapshot) {
                String activeRoomId = userSnapshot.child(KEY_ACTIVE_ROOM_ID).getValue(String.class);
                if (activeRoomId == null || activeRoomId.isEmpty()) {
                    activeRoomId = localRoomId;
                }

                if (activeRoomId == null || activeRoomId.isEmpty()) {
                    bannerView.setVisibility(View.GONE);
                    return;
                }

                final String finalRoomId = activeRoomId;
                DatabaseReference roomRef = db.child("rooms").child(finalRoomId);

                roomRef.addListenerForSingleValueEvent(new ValueEventListener() {
                    @Override
                    public void onDataChange(@NonNull DataSnapshot roomSnapshot) {
                        if (!roomSnapshot.exists()) {
                            hideBannerAndClean(context, bannerView, userId);
                            return;
                        }

                        String status = roomSnapshot.child("status").getValue(String.class);
                        if (!"PLAYING".equalsIgnoreCase(status) && !"WAITING".equalsIgnoreCase(status)) {
                            hideBannerAndClean(context, bannerView, userId);
                            return;
                        }

                        DataSnapshot playerSnap = roomSnapshot.child("players").child(userId);
                        if (!playerSnap.exists()) {
                            hideBannerAndClean(context, bannerView, userId);
                            return;
                        }

                        Boolean hasLeft = playerSnap.child("hasLeft").getValue(Boolean.class);
                        if (Boolean.TRUE.equals(hasLeft)) {
                            hideBannerAndClean(context, bannerView, userId);
                            return;
                        }

                        bannerView.setVisibility(View.VISIBLE);
                    }

                    @Override
                    public void onCancelled(@NonNull DatabaseError error) {
                        bannerView.setVisibility(View.GONE);
                    }
                });
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                bannerView.setVisibility(View.GONE);
            }
        });
    }

    private static void hideBannerAndClean(Context context, View bannerView, String userId) {
        bannerView.setVisibility(View.GONE);
        clearLocalActiveRoomId(context);

        if (userId != null && !userId.isEmpty()) {
            DatabaseReference userRef = FirebaseDatabase.getInstance().getReference("users").child(userId);
            Map<String, Object> clearMap = new HashMap<>();
            clearMap.put(KEY_ACTIVE_ROOM_ID, null);
            clearMap.put(KEY_CURRENT_ROOM_ID, null);
            userRef.updateChildren(clearMap);
        }
    }

    // =========================================================================
    // 4. إصلاح شرط التزامن (Sync Logic & checkIfAllAnswered)
    // =========================================================================

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
        int activeAnswersCount = 0;
        List<String> activePlayerIds = new ArrayList<>();

        for (DataSnapshot pSnap : playersSnap.getChildren()) {
            Boolean hasLeft = pSnap.child("hasLeft").getValue(Boolean.class);
            Boolean isOnline = pSnap.child("isOnline").getValue(Boolean.class);

            boolean isActive = (hasLeft == null || !hasLeft) && (isOnline == null || isOnline);

            if (isActive) {
                activePlayersCount++;
                String pId = pSnap.getKey();
                activePlayerIds.add(pId);

                if (answersSnap.hasChild(pId)) {
                    activeAnswersCount++;
                }
            }
        }

        if (callback != null) {
            callback.onActivePlayersCountChanged(activePlayersCount);
        }

        if (activePlayersCount == 0) {
            finishRoom(roomId);
            if (callback != null) callback.onRoomFinished();
            return false;
        }

        if (activeAnswersCount >= activePlayersCount) {
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
        updates.put("currentAnswers", null);

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
    // 5. معالجة زر التخطي (Skip Button Handling)
    // =========================================================================

    public static void handleSkipClick(
            RoomModel room,
            int currentQuestionIndex,
            String userId,
            RoomQuizNavigationCallback callback
    ) {
        if (room == null || callback == null) return;

        if (room.isAsync()) {
            submitAnswerToFirebase(room.getId(), userId, currentQuestionIndex, false, 0);
            callback.moveToNextQuestion();
        } else {
            submitAnswerToFirebase(room.getId(), userId, currentQuestionIndex, false, 0);
            callback.setOptionButtonsEnabled(false);
            callback.showWaitingForPlayersLayout(true);
        }
    }

    // نقاط الإجابة الصحيحة في التحديات: 1 نقطة بدلاً من 10 نقاط
    public static final int POINTS_PER_CORRECT_ANSWER = 1;

    /**
     * تسجيل إجابة اللاعب ومزامنتها لحظياً في Firebase:
     * يمنح نقطة واحدة (1) فقط عند الإجابة الصحيحة بدلاً من 10 نقاط
     * ويحدث رصيد اللاعب في الغرفة وحسابه الشخصي لتظهر لكل الأطراف المتصلة.
     */
    public static void submitPlayerAnswer(
            @NonNull String roomId,
            @NonNull String userId,
            int questionIndex,
            boolean isCorrect
    ) {
        if (roomId.isEmpty() || userId.isEmpty()) return;

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
            // تحديث نقاط اللاعب اللحظية داخل الغرفة لتظهر لجميع الأطراف المتصلة
            roomRef.child("players").child(userId).child("score").setValue(ServerValue.increment(pointsEarned));

            // تحديث رصيد اللاعب الإجمالي في حسابه الشخصي
            db.child("users").child(userId).child("totalPoints").setValue(ServerValue.increment(pointsEarned));
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
}
