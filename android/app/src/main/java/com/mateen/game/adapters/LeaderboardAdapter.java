package com.mateen.game.adapters;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.mateen.game.R;
import com.mateen.game.controllers.TrophiesManager;
import com.mateen.game.models.User;

import java.util.ArrayList;
import java.util.List;

public class LeaderboardAdapter extends RecyclerView.Adapter<LeaderboardAdapter.ViewHolder> {

    private List<User> userList = new ArrayList<>();

    public LeaderboardAdapter() {}

    public LeaderboardAdapter(List<User> users) {
        updateData(users);
    }

    public void updateData(List<User> newUsers) {
        if (newUsers != null) {
            // فرز القائمة مزدوجاً: كؤوس أولاً، ثم نقاط كاسر تعادل
            TrophiesManager.sortLeaderboard(newUsers);
            this.userList = new ArrayList<>(newUsers);
            notifyDataSetChanged();
        }
    }

    public List<User> getUserList() {
        return userList;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_leaderboard_card, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        if (position < 0 || position >= userList.size()) return;
        User user = userList.get(position);
        if (user == null) return;

        // 1. عرض الترتيب (Rank)
        if (holder.tvRank != null) {
            holder.tvRank.setText(String.valueOf(position + 1));
        }

        // 2. عرض اسم المستخدم وتطبيق اللون المخصص إن وجد
        if (holder.tvPlayerName != null) {
            holder.tvPlayerName.setText(user.getName() != null ? user.getName() : "متسابق");
            if (user.getEquippedNameColor() != null && !user.getEquippedNameColor().trim().isEmpty()) {
                try {
                    holder.tvPlayerName.setTextColor(Color.parseColor(user.getEquippedNameColor()));
                } catch (Exception ignored) {
                    holder.tvPlayerName.setTextColor(Color.parseColor("#0F172A"));
                }
            } else {
                holder.tvPlayerName.setTextColor(Color.parseColor("#0F172A"));
            }
        }

        // 3. قراءة وتفعيل ظهور اللقب المختار (Selected Title)
        String title = user.getSelectedTitle();
        if (holder.tvPlayerTitle != null) {
            if (title != null && !title.trim().isEmpty()) {
                holder.tvPlayerTitle.setVisibility(View.VISIBLE);
                holder.tvPlayerTitle.setText(title.trim());
            } else {
                holder.tvPlayerTitle.setVisibility(View.GONE);
            }
        }

        // 4. عرض المعرف الاختياري
        if (holder.tvPlayerUsername != null) {
            if (user.getUsername() != null && !user.getUsername().trim().isEmpty()) {
                holder.tvPlayerUsername.setVisibility(View.VISIBLE);
                holder.tvPlayerUsername.setText("@" + user.getUsername().replace("@", ""));
            } else {
                holder.tvPlayerUsername.setVisibility(View.GONE);
            }
        }

        // 5. عرض إطار التميز (Border Overlay)
        if (holder.ivBorderOverlay != null) {
            if (user.getEquippedBorder() != null && !user.getEquippedBorder().trim().isEmpty()) {
                holder.ivBorderOverlay.setVisibility(View.VISIBLE);
            } else {
                holder.ivBorderOverlay.setVisibility(View.GONE);
            }
        }

        // 6. عرض الكؤوس والنقاط
        if (holder.tvTrophies != null) {
            holder.tvTrophies.setText(String.valueOf(user.getTrophiesCount()));
        }
        if (holder.tvPoints != null) {
            holder.tvPoints.setText(String.format("%,d", user.getTotalPoints()));
        }

        // ربط عناصر التجميل للتوافق الإضافي
        bindCosmeticsToViewHolder(user, holder.itemView);
    }

    @Override
    public int getItemCount() {
        return userList.size();
    }

    /**
     * ربط مقتنيات التجميل (اللقب، لون الاسم، الإطار) بأي عنصر View خارجي
     */
    public static void bindCosmeticsToViewHolder(User player, View itemView) {
        if (player == null || itemView == null) return;

        TextView tvName = itemView.findViewById(R.id.tvPlayerName);
        TextView tvTitle = itemView.findViewById(R.id.tvPlayerTitle);
        ImageView ivBorderOverlay = itemView.findViewById(R.id.ivBorderOverlay);

        if (tvName != null && player.getEquippedNameColor() != null && !player.getEquippedNameColor().trim().isEmpty()) {
            try {
                tvName.setTextColor(Color.parseColor(player.getEquippedNameColor()));
            } catch (Exception ignored) {}
        }

        // قراءة وتفعيل اللقب المختار
        String title = player.getSelectedTitle();
        if (tvTitle != null) {
            if (title != null && !title.trim().isEmpty()) {
                tvTitle.setVisibility(View.VISIBLE);
                tvTitle.setText(title.trim());
            } else {
                tvTitle.setVisibility(View.GONE);
            }
        }

        if (ivBorderOverlay != null) {
            if (player.getEquippedBorder() != null && !player.getEquippedBorder().trim().isEmpty()) {
                ivBorderOverlay.setVisibility(View.VISIBLE);
            } else {
                ivBorderOverlay.setVisibility(View.GONE);
            }
        }
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        public TextView tvRank;
        public TextView tvPlayerName;
        public TextView tvPlayerTitle;
        public TextView tvPlayerUsername;
        public ImageView ivBorderOverlay;
        public ImageView ivPlayerAvatar;
        public TextView tvTrophies;
        public TextView tvPoints;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvRank = itemView.findViewById(R.id.tvRank);
            tvPlayerName = itemView.findViewById(R.id.tvPlayerName);
            tvPlayerTitle = itemView.findViewById(R.id.tvPlayerTitle);
            tvPlayerUsername = itemView.findViewById(R.id.tvPlayerUsername);
            ivBorderOverlay = itemView.findViewById(R.id.ivBorderOverlay);
            ivPlayerAvatar = itemView.findViewById(R.id.ivPlayerAvatar);
            tvTrophies = itemView.findViewById(R.id.tvTrophies);
            tvPoints = itemView.findViewById(R.id.tvPoints);
        }
    }
}
