package com.mateen.game.adapters;

import android.graphics.Color;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;

import com.mateen.game.R;
import com.mateen.game.models.User;

public class LeaderboardAdapter {

    public static void bindCosmeticsToViewHolder(User player, View itemView) {
        TextView tvName = itemView.findViewById(R.id.tvPlayerName);
        TextView tvTitle = itemView.findViewById(R.id.tvPlayerTitle);
        ImageView ivBorderOverlay = itemView.findViewById(R.id.ivBorderOverlay);

        if (tvName != null && player.getEquippedNameColor() != null && !player.getEquippedNameColor().isEmpty()) {
            try {
                tvName.setTextColor(Color.parseColor(player.getEquippedNameColor()));
            } catch (Exception ignored) {}
        }

        if (tvTitle != null) {
            if (player.getEquippedTitle() != null && !player.getEquippedTitle().isEmpty()) {
                tvTitle.setVisibility(View.VISIBLE);
                tvTitle.setText(player.getEquippedTitle());
            } else {
                tvTitle.setVisibility(View.GONE);
            }
        }

        if (ivBorderOverlay != null) {
            if (player.getEquippedBorder() != null && !player.getEquippedBorder().isEmpty()) {
                ivBorderOverlay.setVisibility(View.VISIBLE);
            } else {
                ivBorderOverlay.setVisibility(View.GONE);
            }
        }
    }
}
