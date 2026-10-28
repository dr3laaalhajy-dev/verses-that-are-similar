package com.mateen.game.controllers;

import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import java.util.HashMap;
import java.util.Map;

/**
 * متحكم شاشة التحدي الجماعي (Room/Quiz Activity Controller) في أندرويد:
 * يحل خلل التزامن عند الضغط على زر "تخطي" (Skip) وفق نمط الغرفة (Sync vs Async).
 */
public class RoomQuizController {

    public interface RoomQuizNavigationCallback {
        void moveToNextQuestion();
        void setOptionButtonsEnabled(boolean enabled);
        void showWaitingForPlayersLayout(boolean show);
    }

    public static class RoomModel {
        private String id;
        private String transitionMode; // "SYNC" أو "ASYNC"
        private int currentQuestionIndex;

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

    /**
     * دالة معالجة النقر على زر التخطي (Skip Button OnClickListener)
     *
     * @param room الغرفة الحالية
     * @param currentQuestionIndex رقم السؤال الحالي
     * @param userId معرف اللاعب الحالي
     * @param callback واجهة تحديث الواجهة والتنقل
     */
    public static void handleSkipClick(
            RoomModel room,
            int currentQuestionIndex,
            String userId,
            RoomQuizNavigationCallback callback
    ) {
        if (room == null || callback == null) return;

        // 1. التحقق من نمط الغرفة (Room Mode Check):
        if (room.isAsync()) {
            /*
             * 2. مسار الانتقال التلقائي (Asynchronous Mode):
             * - تسجيل إجابة خاطئة (0 نقاط) في Firebase
             * - الانتقال الفوري للسؤال التالي محلياً
             */
            submitAnswerToFirebase(room.getId(), userId, currentQuestionIndex, false, 0);
            callback.moveToNextQuestion();
        } else {
            /*
             * 3. مسار التزامن (Synchronous Mode - المطلوب إصلاحه):
             * أ. إرسال إجابة خاطئة (0 نقاط) لـ Firebase لإعلام النظام أن اللاعب أنهى دوره في السؤال الحالي.
             * ب. منع الانتقال المحلي: عدم استدعاء moveToNextQuestion() نهائياً.
             * ج. تحديث الواجهة: تعطيل أزرار الخيارات وزر التخطي، وإظهار واجهة "بانتظار باقي اللاعبين...".
             * د. الاعتماد على المزامنة: سيتم الانتقال تلقائياً مع بقية اللاعبين عند تغير currentQuestionIndex عبر Firebase Listener.
             */
            submitAnswerToFirebase(room.getId(), userId, currentQuestionIndex, false, 0);

            // تعطيل أزرار الإجابات لمنع التفاعل المتكرر
            callback.setOptionButtonsEnabled(false);

            // إظهار واجهة الانتظار
            callback.showWaitingForPlayersLayout(true);
        }
    }

    /**
     * إرسال الإجابة إلى Firebase (سواءً Realtime Database أو Firestore)
     */
    private static void submitAnswerToFirebase(
            String roomId,
            String userId,
            int questionIndex,
            boolean isCorrect,
            int pointsEarned
    ) {
        Map<String, Object> answerData = new HashMap<>();
        answerData.put("userId", userId);
        answerData.put("questionIndex", questionIndex);
        answerData.put("isCorrect", isCorrect);
        answerData.put("points", pointsEarned);
        answerData.put("timestamp", System.currentTimeMillis());

        /*
         * مثال Firebase Realtime Database:
         * DatabaseReference ref = FirebaseDatabase.getInstance().getReference("rooms")
         *      .child(roomId)
         *      .child("currentAnswers")
         *      .child(userId);
         * ref.setValue(answerData);
         *
         * مثال Firebase Firestore:
         * FirebaseFirestore.getInstance().collection("rooms").document(roomId)
         *      .update("currentAnswers." + userId, answerData);
         */
    }
}
