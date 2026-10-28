package com.mateen.game.controllers;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.mateen.game.R;
import com.mateen.game.models.LiveReaction;

import java.util.Random;

public class LiveReactionsController {
    private final Context context;
    private final FrameLayout overlayContainer;
    private final String roomId;
    private final String currentUserId;
    private final String currentUserName;
    private final Random random = new Random();

    public LiveReactionsController(Context context, FrameLayout overlayContainer, String roomId,
                                   String currentUserId, String currentUserName) {
        this.context = context;
        this.overlayContainer = overlayContainer;
        this.roomId = roomId;
        this.currentUserId = currentUserId;
        this.currentUserName = currentUserName;
    }

    public void sendReaction(String emoji) {
        playFloatingAnimation(emoji, currentUserName);
    }

    public void playFloatingAnimation(String emoji, String senderName) {
        if (overlayContainer == null) return;
        overlayContainer.post(() -> {
            View reactionView = LayoutInflater.from(context).inflate(R.layout.view_floating_emoji, overlayContainer, false);
            TextView tvEmoji = reactionView.findViewById(R.id.tvFloatingEmoji);
            TextView tvSender = reactionView.findViewById(R.id.tvSenderName);

            tvEmoji.setText(emoji);
            tvSender.setText(senderName);

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
                    overlayContainer.removeView(reactionView);
                }
            });

            verticalAnimator.start();
        });
    }

    public void cleanup() {}
}
