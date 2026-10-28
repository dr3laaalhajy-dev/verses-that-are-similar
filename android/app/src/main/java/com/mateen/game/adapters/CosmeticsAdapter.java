package com.mateen.game.adapters;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.mateen.game.R;
import com.mateen.game.models.CosmeticItem;
import com.mateen.game.models.User;

import java.util.List;

public class CosmeticsAdapter extends RecyclerView.Adapter<CosmeticsAdapter.ViewHolder> {
    private final List<CosmeticItem> items;
    private final User currentUser;

    public CosmeticsAdapter(List<CosmeticItem> items, User currentUser) {
        this.items = items;
        this.currentUser = currentUser;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_cosmetic_card, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        CosmeticItem item = items.get(position);
        holder.tvTitle.setText(item.getTitle());
        holder.tvDesc.setText(item.getDescription());

        boolean isOwned = currentUser.getOwnedCosmetics().contains(item.getId());
        boolean isEquipped = isCurrentlyEquipped(item);

        if (item.getType() == CosmeticItem.Type.NAME_COLOR) {
            holder.ivPreview.setVisibility(View.GONE);
            holder.tvTextPreview.setVisibility(View.VISIBLE);
            holder.tvTextPreview.setText("اسم تجريبي");
            holder.tvTextPreview.setTextColor(Color.parseColor(item.getValue()));
        } else if (item.getType() == CosmeticItem.Type.TITLE) {
            holder.ivPreview.setVisibility(View.GONE);
            holder.tvTextPreview.setVisibility(View.VISIBLE);
            holder.tvTextPreview.setText(item.getValue());
            holder.tvTextPreview.setTextColor(Color.parseColor("#EAB308"));
        } else {
            holder.ivPreview.setVisibility(View.VISIBLE);
            holder.tvTextPreview.setVisibility(View.GONE);
        }

        if (isEquipped) {
            holder.btnAction.setText("مُجهّز حالياً ✓");
            holder.btnAction.setEnabled(false);
            holder.btnAction.setBackgroundColor(Color.parseColor("#10B981"));
        } else if (isOwned) {
            holder.btnAction.setText("تجهيز");
            holder.btnAction.setEnabled(true);
            holder.btnAction.setBackgroundColor(Color.parseColor("#3B82F6"));
            holder.btnAction.setOnClickListener(v -> equipItem(item));
        } else {
            String currencyIcon = item.getCurrency() == CosmeticItem.Currency.POINTS ? "⭐️ " : "🔥 ";
            holder.btnAction.setText("شراء بـ " + item.getPrice() + " " + currencyIcon);
            holder.btnAction.setEnabled(true);
            holder.btnAction.setBackgroundColor(Color.parseColor("#F97316"));
            holder.btnAction.setOnClickListener(v -> buyItem(item));
        }
    }

    private boolean isCurrentlyEquipped(CosmeticItem item) {
        if (item.getType() == CosmeticItem.Type.BORDER) return item.getId().equals(currentUser.getEquippedBorder());
        if (item.getType() == CosmeticItem.Type.NAME_COLOR) return item.getValue().equals(currentUser.getEquippedNameColor());
        if (item.getType() == CosmeticItem.Type.TITLE) return item.getValue().equals(currentUser.getEquippedTitle());
        return false;
    }

    private void equipItem(CosmeticItem item) {
        if (item.getType() == CosmeticItem.Type.BORDER) currentUser.setEquippedBorder(item.getId());
        if (item.getType() == CosmeticItem.Type.NAME_COLOR) currentUser.setEquippedNameColor(item.getValue());
        if (item.getType() == CosmeticItem.Type.TITLE) currentUser.setEquippedTitle(item.getValue());
        notifyDataSetChanged();
    }

    private void buyItem(CosmeticItem item) {
        if (item.getCurrency() == CosmeticItem.Currency.POINTS) {
            if (currentUser.getTotalPoints() < item.getPrice()) {
                return;
            }
            currentUser.setTotalPoints(currentUser.getTotalPoints() - item.getPrice());
        } else {
            if (currentUser.getStreakCount() < item.getPrice()) {
                return;
            }
            currentUser.setStreakCount(currentUser.getStreakCount() - item.getPrice());
        }

        currentUser.getOwnedCosmetics().add(item.getId());
        equipItem(item);
    }

    @Override
    public int getItemCount() { return items.size(); }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivPreview;
        TextView tvTextPreview, tvTitle, tvDesc;
        Button btnAction;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            ivPreview = itemView.findViewById(R.id.ivItemPreview);
            tvTextPreview = itemView.findViewById(R.id.tvTextPreview);
            tvTitle = itemView.findViewById(R.id.tvCosmeticTitle);
            tvDesc = itemView.findViewById(R.id.tvCosmeticDesc);
            btnAction = itemView.findViewById(R.id.btnCosmeticAction);
        }
    }
}

