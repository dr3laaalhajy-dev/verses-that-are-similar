package com.mateen.game;

import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.database.ValueEventListener;
import com.mateen.game.controllers.LiveReactionsController;
import com.mateen.game.controllers.RoomQuizController;

import java.util.HashSet;
import java.util.Set;

/**
 * شاشة التحدي الجماعي (Room Activity):
 * 1. الربط مع OnDisconnect الخاص بـ Firebase لرصد انقطاع الاتصال المفاجئ.
 * 2. تشغيل ومزامنة مؤقت الـ 60 ثانية الإجباري لكل سؤال.
 * 3. معالجة خروج/انسحاب اللاعب في onDestroy و onPause وإنقاص عدد المنتظرين.
 * 4. إدارة التفاعلات الحية عبر LiveReactionsController.
 */
public class RoomActivity extends AppCompatActivity {

    private static final String TAG = "RoomActivity";

    private String roomId = "";
    private String userId = "";
    private String userName = "";
    private int currentQuestionIndex = 0;

    private LiveReactionsController reactionsController;
    private ValueEventListener roomPlayersListener;
    private final Set<String> notifiedWithdrawnPlayers = new HashSet<>();

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // قراءة بيانات الجلسة والغرفة من الـ Intent
        if (getIntent() != null) {
            roomId = getIntent().getStringExtra("roomId") != null ? getIntent().getStringExtra("roomId") : "";
            userId = getIntent().getStringExtra("userId") != null ? getIntent().getStringExtra("userId") : "";
            userName = getIntent().getStringExtra("userName") != null ? getIntent().getStringExtra("userName") : "";
            currentQuestionIndex = getIntent().getIntExtra("currentQuestionIndex", 0);
        }

        // حفظ المعرف محلياً لتتبع التحدي الجاري
        if (!roomId.isEmpty()) {
            RoomQuizController.saveLocalActiveRoomId(this, roomId);
        }

        // إعداد OnDisconnect للتعامل مع الخروج المفاجئ أو انقطاع الشبكة
        RoomQuizController.setupOnDisconnect(roomId, userId, currentQuestionIndex);

        // ربط مستمع الغرفة لرصد اللاعبين والانسحابات والتزامن
        setupRoomListener();

        // بدء مؤقت الـ 60 ثانية الإجباري للسؤال الحالي
        startQuestionTimer();
    }

    private void setupRoomListener() {
        if (roomId.isEmpty()) return;

        roomPlayersListener = RoomQuizController.attachRoomPlayersListener(
                this,
                roomId,
                userId,
                notifiedWithdrawnPlayers,
                new RoomQuizController.OnRoomSyncCallback() {
                    @Override
                    public void onAllAnswered(int nextQuestionIndex) {
                        Log.i(TAG, "All active players answered. Advancing to question: " + nextQuestionIndex);
                        currentQuestionIndex = nextQuestionIndex;
                        // إعادة ضبط مؤقت السؤال الجديد
                        startQuestionTimer();
                        // تحديث OnDisconnect للسؤال الجديد
                        RoomQuizController.setupOnDisconnect(roomId, userId, currentQuestionIndex);
                    }

                    @Override
                    public void onRoomFinished() {
                        Log.i(TAG, "Room finished. Navigating to results.");
                        RoomQuizController.cancelQuestionTimeoutTimer();
                        finish();
                    }

                    @Override
                    public void onActivePlayersCountChanged(int activeCount) {
                        Log.d(TAG, "Active players count updated: " + activeCount);
                    }
                }
        );
    }

    public void setupLiveReactions(FrameLayout overlayContainer) {
        if (overlayContainer != null && !roomId.isEmpty() && !userId.isEmpty()) {
            reactionsController = new LiveReactionsController(
                    this,
                    overlayContainer,
                    roomId,
                    userId,
                    userName
            );
        }
    }

    public void sendReaction(String reactionType) {
        if (reactionsController != null) {
            reactionsController.sendReaction(reactionType);
        }
    }

    private void startQuestionTimer() {
        if (roomId.isEmpty() || userId.isEmpty()) return;

        // بدء مؤقت الـ 60 ثانية للسؤال الحالي
        RoomQuizController.startQuestionTimeoutTimer(roomId, userId, currentQuestionIndex, () -> {
            Log.w(TAG, "Timeout elapsed on question " + currentQuestionIndex + ". Automatically submitted wrong answer.");
        });
    }

    /**
     * تسجيل إجابة اللاعب العادية (1 نقطة عند الصحة، 0 عند الخطأ)
     */
    public void onAnswerSelected(boolean isCorrect) {
        RoomQuizController.submitPlayerAnswer(roomId, userId, currentQuestionIndex, isCorrect);
    }

    @Override
    public void onBackPressed() {
        // عند ضغط زر الرجوع: معالجة خروج اللاعب فوراً لإنقاص عدد المنتظرين
        RoomQuizController.handlePlayerExit(this, roomId, userId, currentQuestionIndex);
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        // إذا كان النشاط سينتهي (isFinishing)، نضمن إرسال الانسحاب والتخطي فوراً
        if (isFinishing()) {
            RoomQuizController.handlePlayerExit(this, roomId, userId, currentQuestionIndex);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // إلغاء المؤقتات والمستمعات
        RoomQuizController.cancelQuestionTimeoutTimer();
        if (reactionsController != null) {
            reactionsController.cleanup();
        }
        // تأكيد تسجيل الخروج وتخطي السؤال الحالي حتى لا يبقى اللاعبون الآخرون عالقين
        RoomQuizController.handlePlayerExit(this, roomId, userId, currentQuestionIndex);
    }
}
