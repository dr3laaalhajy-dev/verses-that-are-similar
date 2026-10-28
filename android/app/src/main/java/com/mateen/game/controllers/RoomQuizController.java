package com.mateen.game.controllers;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.View;

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
import java.util.List;
import java.util.Map;

/**
 * متحكم شاشة التحدي الجماعي (Room/Quiz Activity Controller):
 * 1. معالجة زر الانسحاب (Withdrawal) مع تنظيف مرجع الغرفة النشطة (activeRoomId) والتوجيه بعد اكتمال التحديث السحابي.
 * 2. التحقق من شرط التزامن (checkIfAllAnswered) بالاعتماد على اللاعبين النشطين فقط.
 * 3. مشغل إعادة الفحص الفوري (Immediate Trigger) عند تغير حالة أي لاعب إلى hasLeft = true.
 * 4. إدارة شريط "تحدي جاري الآن" في MainActivity وإخفاؤه تلقائياً إذا كان hasLeft == true.
 * 5. معالجة زر التخطي (Skip) وفق نمط الغرفة (Sync vs Async).
 */
public class RoomQuizController {

    private static final String TAG = "RoomQuizController";
    public static final String PREFS_NAME = "MateenGamePrefs";
    public static final String KEY_ACTIVE_ROOM_ID = "activeRoomId";
    public static final String KEY_CURRENT_ROOM_ID = "currentRoomId";

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
    // 1. برمجة زر الانسحاب (Withdraw Action) وتنظيف مرجع الغرفة النشطة
    // =========================================================================

    /**
     * تنفيذ الانسحاب من التحدي الجماعي:
     * 1. حفظ النقاط المكتسبة في رصيد المستخدم الكلي (Users Node).
     * 2. تنظيف مرجع الغرفة النشطة (activeRoomId / currentRoomId) من الـ User Node والـ SharedPreferences.
     * 3. تحديث مسار اللاعب في الغرفة (hasLeft = true, isOnline = false).
     * 4. تنفيذ مباشر (Immediate Execution): الانتظار حتى اكتمال التحديث عبر Tasks.whenAllComplete
     *    قبل إطلاق Intent العودة إلى MainActivity لتفادي قراءة بيانات قديمة.
     *
     * @param activity النشاط الحالي (Activity)
     * @param roomId معرف الغرفة الحالية
     * @param userId معرف اللاعب
     * @param earnedPoints النقاط التي جمعها في التحدي الحالي
     */
    public static void handleWithdrawal(
            @NonNull final Activity activity,
            final String roomId,
            final String userId,
            final int earnedPoints
    ) {
        // أ) تنظيف فوري ومحلي لمرجع الغرفة من SharedPreferences
        clearLocalActiveRoomId(activity);

        if (userId == null || userId.isEmpty()) {
            navigateDirectlyToMain(activity);
            return;
        }

        DatabaseReference db = FirebaseDatabase.getInstance().getReference();
        List<Task<Void>> pendingTasks = new ArrayList<>();

        // ب) تحديث مستند المستخدم (User Node): إضافة النقاط + حذف/تصفير activeRoomId و currentRoomId
        DatabaseReference userRef = db.child("users").child(userId);
        Map<String, Object> userUpdates = new HashMap<>();
        if (earnedPoints > 0) {
            userUpdates.put("totalPoints", ServerValue.increment(earnedPoints));
        }
        userUpdates.put(KEY_ACTIVE_ROOM_ID, null);
        userUpdates.put(KEY_CURRENT_ROOM_ID, null);

        Task<Void> userUpdateTask = userRef.updateChildren(userUpdates);
        pendingTasks.add(userUpdateTask);

        // ج) الذهاب إلى مسار اللاعب داخل الغرفة وتحديث حالته: hasLeft = true و isOnline = false
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

        // د) التنفيذ المباشر الموثوق (Immediate Execution):
        // الانتظار حتى اكتمال مهام التحديث لضمان وصول التعديل للسيرفر قبل تشغيل MainActivity
        Tasks.whenAllComplete(pendingTasks).addOnCompleteListener(activity, task -> {
            navigateDirectlyToMain(activity);
        });
    }

    /**
     * مسح معرف الغرفة النشطة من SharedPreferences المحلية
     */
    public static void clearLocalActiveRoomId(@NonNull Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .remove(KEY_ACTIVE_ROOM_ID)
                .remove(KEY_CURRENT_ROOM_ID)
                .apply();
    }

    /**
     * حفظ معرف الغرفة النشطة محلياً عند الانضمام أو الإنشاء
     */
    public static void saveLocalActiveRoomId(@NonNull Context context, String roomId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_ACTIVE_ROOM_ID, roomId)
                .putString(KEY_CURRENT_ROOM_ID, roomId)
                .apply();
    }

    /**
     * الانتقال المباشر والآمن إلى MainActivity وتنظيف المكدس
     */
    private static void navigateDirectlyToMain(@NonNull Activity activity) {
        Intent intent = new Intent(activity, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
        activity.finish();
    }

    // =========================================================================
    // 2. تحديث منطق التحقق في الشاشة الرئيسية (MainActivity Logic) للشريط البرتقالي
    // =========================================================================

    /**
     * التحقق من الشريط البرتقالي (Active Challenge Banner) في MainActivity:
     * 1. يتحقق هل للمستخدم activeRoomId.
     * 2. يقرأ بيانات الغرفة، ويتحقق من مسار هذا اللاعب تحديداً داخل الغرفة.
     * 3. إذا كان hasLeft == true لهذا اللاعب في هذه الغرفة (أو انتهت الغرفة):
     *    يتم إخفاء الشريط تماماً (View.GONE) ومسح المرجع القديم.
     * 4. إذا كانت الغرفة ما زالت جارية واللاعب لم ينسحب: يظهر الشريط (View.VISIBLE).
     *
     * @param context سياق التطبيق
     * @param bannerView شريط التحدي البرتقالي في الواجهة
     * @param userId معرف اللاعب
     */
    public static void checkAndManageActiveChallengeBanner(
            @NonNull final Context context,
            @NonNull final View bannerView,
            final String userId
    ) {
        if (userId == null || userId.isEmpty()) {
            bannerView.setVisibility(View.GONE);
            return;
        }

        // قراءة activeRoomId من التفضيلات المحلية أولاً كفحص سريع
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

                // شرط 1: إذا لم يوجد activeRoomId -> إخفاء الشريط فوراً
                if (activeRoomId == null || activeRoomId.isEmpty()) {
                    bannerView.setVisibility(View.GONE);
                    return;
                }

                final String finalRoomId = activeRoomId;
                DatabaseReference roomRef = db.child("rooms").child(finalRoomId);

                // شرط 2: قراءة بيانات تلك الغرفة تحديداً والتحقق من مسار هذا اللاعب
                roomRef.addListenerForSingleValueEvent(new ValueEventListener() {
                    @Override
                    public void onDataChange(@NonNull DataSnapshot roomSnapshot) {
                        if (!roomSnapshot.exists()) {
                            // الغرفة حُذفت أو غير موجودة
                            hideBannerAndClean(context, bannerView, userId);
                            return;
                        }

                        String status = roomSnapshot.child("status").getValue(String.class);
                        if (!"PLAYING".equalsIgnoreCase(status) && !"WAITING".equalsIgnoreCase(status)) {
                            // التحدي انتهى أو ألغي
                            hideBannerAndClean(context, bannerView, userId);
                            return;
                        }

                        // التحقق الدقيق من مسار اللاعب داخل الغرفة
                        DataSnapshot playerSnap = roomSnapshot.child("players").child(userId);
                        if (!playerSnap.exists()) {
                            hideBannerAndClean(context, bannerView, userId);
                            return;
                        }

                        Boolean hasLeft = playerSnap.child("hasLeft").getValue(Boolean.class);
                        Boolean isOnline = playerSnap.child("isOnline").getValue(Boolean.class);

                        // شرط 3: إذا كان hasLeft == true لهذا اللاعب -> إخفاء الشريط فوراً ومسح المرجع
                        if (Boolean.TRUE.equals(hasLeft)) {
                            Log.d(TAG, "Player has already left room " + finalRoomId + ". Hiding active challenge banner.");
                            hideBannerAndClean(context, bannerView, userId);
                            return;
                        }

                        // اللاعب ما زال مشاركاً نشطاً في تحدي قيد التشغيل -> إظهار الشريط
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
    // 3. إصلاح شرط التزامن (Sync Logic & checkIfAllAnswered)
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

            // اللاعب النشط: لم ينسحب (hasLeft != true) ومتصل (isOnline != false)
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

        // في حال انسحب جميع اللاعبين: إنهاء الغرفة
        if (activePlayersCount == 0) {
            Log.d(TAG, "No active players remaining. Marking room as finished.");
            finishRoom(roomId);
            if (callback != null) callback.onRoomFinished();
            return false;
        }

        // الشرط الأساسي: هل الإجابات المقدمة من اللاعبين النشطين تغطي جميع النشطين؟
        if (activeAnswersCount >= activePlayersCount) {
            Log.d(TAG, "All active players answered (" + activeAnswersCount + "/" + activePlayersCount + "). Advancing question.");
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
        updates.put("currentAnswers", null); // تصفير إجابات السؤال الجديد

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
    // 4. مشغل إعادة الفحص الفوري (Immediate Check Trigger)
    // =========================================================================

    public static ValueEventListener attachRoomSyncListener(
            final String roomId,
            final OnRoomSyncCallback callback
    ) {
        DatabaseReference roomRef = FirebaseDatabase.getInstance()
                .getReference("rooms")
                .child(roomId);

        ValueEventListener listener = new ValueEventListener() {
            private final Map<String, Boolean> knownLeaveStates = new HashMap<>();

            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                if (!snapshot.exists()) return;

                Integer curQVal = snapshot.child("currentQuestionIndex").getValue(Integer.class);
                int currentQ = curQVal != null ? curQVal : 0;

                boolean someoneJustLeft = false;
                DataSnapshot playersSnap = snapshot.child("players");
                for (DataSnapshot pSnap : playersSnap.getChildren()) {
                    String pId = pSnap.getKey();
                    if (pId == null) continue;

                    Boolean hasLeft = pSnap.child("hasLeft").getValue(Boolean.class);
                    boolean isLeft = Boolean.TRUE.equals(hasLeft);

                    Boolean prevStatus = knownLeaveStates.get(pId);
                    if (isLeft && (prevStatus == null || !prevStatus)) {
                        someoneJustLeft = true;
                    }
                    knownLeaveStates.put(pId, isLeft);
                }

                if (someoneJustLeft) {
                    Log.i(TAG, "Immediate Check Trigger: Player withdrawal detected. Calling checkIfAllAnswered immediately!");
                    checkIfAllAnswered(snapshot, roomId, currentQ, callback);
                    return;
                }

                checkIfAllAnswered(snapshot, roomId, currentQ, callback);
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                Log.e(TAG, "Room sync listener cancelled: " + error.getMessage());
            }
        };

        roomRef.addValueEventListener(listener);
        return listener;
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
