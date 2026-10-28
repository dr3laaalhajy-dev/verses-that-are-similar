package com.mateen.game.controllers;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.annotation.NonNull;

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
 * 1. معالجة زر الانسحاب (Withdrawal) وحفظ النقاط والتوجيه لـ MainActivity.
 * 2. التحقق من شرط التزامن (checkIfAllAnswered) بالاعتماد على اللاعبين النشطين فقط.
 * 3. مشغل إعادة الفحص الفوري (Immediate Trigger) عند تغير حالة أي لاعب إلى hasLeft = true.
 * 4. معالجة زر التخطي (Skip) وفق نمط الغرفة (Sync vs Async).
 */
public class RoomQuizController {

    private static final String TAG = "RoomQuizController";

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
    // 1. برمجة زر الانسحاب (Withdraw Action)
    // =========================================================================

    /**
     * تنفيذ الانسحاب من التحدي الجماعي:
     * - حفظ النقاط المكتسبة في رصيد المستخدم الكلي (Users Node).
     * - تحديث حالة اللاعب في الغرفة (hasLeft = true, isOnline = false).
     * - توجيه المستخدم مباشرة إلى MainActivity مع مسح المكدس.
     *
     * @param activity النشاط الحالي (Activity)
     * @param roomId معرف الغرفة الحالية
     * @param userId معرف اللاعب
     * @param earnedPoints النقاط التي جمعها في التحدي الحالي
     */
    public static void handleWithdrawal(
            @NonNull Activity activity,
            String roomId,
            String userId,
            int earnedPoints
    ) {
        if (userId == null || userId.isEmpty()) {
            navigateDirectlyToMain(activity);
            return;
        }

        DatabaseReference db = FirebaseDatabase.getInstance().getReference();

        // 1. حفظ النقاط المكتسبة في التحدي الحالي وإضافتها إلى رصيده الكلي في مستنده الشخصي (Users Node)
        if (earnedPoints > 0) {
            DatabaseReference userRef = db.child("users").child(userId);
            userRef.child("totalPoints").setValue(ServerValue.increment(earnedPoints))
                    .addOnFailureListener(e -> Log.e(TAG, "Failed to increment user points", e));
        }

        // 2. الذهاب إلى مسار اللاعب داخل الغرفة وتحديث حالته: hasLeft = true و isOnline = false
        if (roomId != null && !roomId.isEmpty()) {
            DatabaseReference playerRoomRef = db.child("rooms")
                    .child(roomId)
                    .child("players")
                    .child(userId);

            Map<String, Object> leaveUpdates = new HashMap<>();
            leaveUpdates.put("hasLeft", true);
            leaveUpdates.put("isOnline", false);
            leaveUpdates.put("leftTimestamp", ServerValue.TIMESTAMP);

            playerRoomRef.updateChildren(leaveUpdates)
                    .addOnFailureListener(e -> Log.e(TAG, "Failed to update room player leave status", e));
        }

        // 3. توجيه سليم بدون Dialogs أو Fragments غريبة: Intent إلى MainActivity مع تنظيف الـ Stack
        navigateDirectlyToMain(activity);
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
    // 2. إصلاح شرط التزامن (Sync Logic & checkIfAllAnswered)
    // =========================================================================

    /**
     * فحص هل أجاب جميع اللاعبين النشطين (Active Players) فقط للانتقال للسؤال التالي.
     * لا يعتمد على إجمالي عدد اللاعبين الأصلي، بل يستبعد من لديه hasLeft == true أو isOnline == false.
     *
     * @param roomSnapshot لقطة بيانات الغرفة من Firebase
     * @param roomId معرف الغرفة
     * @param currentQuestionIndex رقم السؤال الحالي
     * @param callback رد الاتصال لتنفيذ الانتقال
     * @return true إذا اكتملت إجابات النشطين
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

                // هل قدّم هذا اللاعب إجابته لهذا السؤال؟
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

        Log.d(TAG, "Waiting for remaining active players: " + activeAnswersCount + "/" + activePlayersCount);
        return false;
    }

    /**
     * نقل الغرفة للسؤال التالي وتصفير إجابات السؤال السابق في Firebase
     */
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

    /**
     * إنهاء الغرفة
     */
    public static void finishRoom(String roomId) {
        if (roomId == null || roomId.isEmpty()) return;
        DatabaseReference roomRef = FirebaseDatabase.getInstance()
                .getReference("rooms")
                .child(roomId);
        roomRef.child("status").setValue("FINISHED");
    }

    // =========================================================================
    // 3. مشغل إعادة الفحص الفوري (Immediate Check Trigger)
    // =========================================================================

    /**
     * إعداد مستمع الغرفة (Room Listener) مع الفحص الفوري عند انسحاب أي لاعب:
     * إذا تغيرت حالة أي لاعب إلى hasLeft = true، يتم استدعاء checkIfAllAnswered فوراً
     * لضمان انتقال باقي اللاعبين دون أي تعليق أو انتظار للاعب المنسحب.
     *
     * @param roomId معرف الغرفة
     * @param callback معالج أحداث المزامنة
     * @return كائن ValueEventListener لحفظه وإلغائه عند destroy
     */
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

                // قراءة رقم السؤال الحالي
                Integer curQVal = snapshot.child("currentQuestionIndex").getValue(Integer.class);
                int currentQ = curQVal != null ? curQVal : 0;

                // 3. المشغل الفوري: فحص ما إذا كان هناك لاعب انسحب حديثاً (hasLeft == true)
                boolean someoneJustLeft = false;
                DataSnapshot playersSnap = snapshot.child("players");
                for (DataSnapshot pSnap : playersSnap.getChildren()) {
                    String pId = pSnap.getKey();
                    if (pId == null) continue;

                    Boolean hasLeft = pSnap.child("hasLeft").getValue(Boolean.class);
                    boolean isLeft = Boolean.TRUE.equals(hasLeft);

                    Boolean prevStatus = knownLeaveStates.get(pId);
                    if (isLeft && (prevStatus == null || !prevStatus)) {
                        // لاعب تغيرت حالته للانسحاب في هذه اللحظة!
                        someoneJustLeft = true;
                    }
                    knownLeaveStates.put(pId, isLeft);
                }

                if (someoneJustLeft) {
                    Log.i(TAG, "Immediate Check Trigger: Player withdrawal detected. Calling checkIfAllAnswered immediately!");
                    checkIfAllAnswered(snapshot, roomId, currentQ, callback);
                    return;
                }

                // الفحص الطبيعي عند وصول إجابات جديدة
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
    // 4. معالجة زر التخطي (Skip Button Handling)
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
