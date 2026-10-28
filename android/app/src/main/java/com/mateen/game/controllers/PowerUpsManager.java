package com.mateen.game.controllers;

import android.graphics.Color;
import android.os.CountDownTimer;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.mateen.game.models.User;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class PowerUpsManager {

    public interface GameplayCallback {
        void pauseTimer();
        void resumeTimer();
        int getCorrectAnswerIndex();
        List<View> getAnswerViews();
        TextView getTimerTextView();
    }

    private final User currentUser;
    private final GameplayCallback callback;
    private boolean isPowerUpUsedInCurrentQuestion = false;

    public PowerUpsManager(User currentUser, GameplayCallback callback) {
        this.currentUser = currentUser;
        this.callback = callback;
    }

    public void onNewQuestion() {
        isPowerUpUsedInCurrentQuestion = false;
    }

    public void executeFreezeTime(FrameLayout btnFreeze, TextView tvBadge) {
        if (isPowerUpUsedInCurrentQuestion) {
            showToast("يمكنك استخدام وسيلة مساعدة واحدة فقط في السؤال!");
            return;
        }

        int count = currentUser.getPowerUps().getOrDefault("freezeTime", 0);
        if (count <= 0) {
            showToast("رصيدك من تجميد الوقت نفد!");
            return;
        }

        currentUser.getPowerUps().put("freezeTime", count - 1);
        if (tvBadge != null) tvBadge.setText(String.valueOf(count - 1));
        isPowerUpUsedInCurrentQuestion = true;
        if (btnFreeze != null) {
            btnFreeze.setEnabled(false);
            btnFreeze.setAlpha(0.5f);
        }

        callback.pauseTimer();
        TextView timerTv = callback.getTimerTextView();
        final int originalColor = timerTv != null ? timerTv.getCurrentTextColor() : Color.BLACK;
        if (timerTv != null) {
            timerTv.setTextColor(Color.parseColor("#38BDF8")); // Icy Blue
        }

        new CountDownTimer(10000, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                if (timerTv != null) {
                    timerTv.setText("🧊 " + (millisUntilFinished / 1000) + "s");
                }
            }

            @Override
            public void onFinish() {
                if (timerTv != null) {
                    timerTv.setTextColor(originalColor);
                }
                callback.resumeTimer();
            }
        }.start();
    }

    public void executeDeleteTwo(FrameLayout btnDelete, TextView tvBadge) {
        if (isPowerUpUsedInCurrentQuestion) {
            showToast("يمكنك استخدام وسيلة مساعدة واحدة فقط في السؤال!");
            return;
        }

        int count = currentUser.getPowerUps().getOrDefault("deleteTwo", 0);
        if (count <= 0) {
            showToast("رصيدك من حذف الإجابات نفد!");
            return;
        }

        currentUser.getPowerUps().put("deleteTwo", count - 1);
        if (tvBadge != null) tvBadge.setText(String.valueOf(count - 1));
        isPowerUpUsedInCurrentQuestion = true;
        if (btnDelete != null) {
            btnDelete.setEnabled(false);
            btnDelete.setAlpha(0.5f);
        }

        int correctIndex = callback.getCorrectAnswerIndex();
        List<View> answers = callback.getAnswerViews();

        List<Integer> wrongIndices = new ArrayList<>();
        for (int i = 0; i < answers.size(); i++) {
            if (i != correctIndex && answers.get(i).getVisibility() == View.VISIBLE) {
                wrongIndices.add(i);
            }
        }

        Collections.shuffle(wrongIndices);
        int eliminated = 0;
        for (int idx : wrongIndices) {
            if (eliminated >= 2) break;
            View viewToHide = answers.get(idx);
            viewToHide.animate()
                    .alpha(0f)
                    .scaleX(0.8f)
                    .scaleY(0.8f)
                    .setDuration(300)
                    .withEndAction(() -> {
                        viewToHide.setVisibility(View.INVISIBLE);
                        viewToHide.setEnabled(false);
                    })
                    .start();
            eliminated++;
        }
    }

    private void showToast(String msg) {
        if (callback.getTimerTextView() != null) {
            Toast.makeText(callback.getTimerTextView().getContext(), msg, Toast.LENGTH_SHORT).show();
        }
    }
}
