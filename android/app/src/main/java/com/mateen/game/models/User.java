package com.mateen.game.models;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class User implements Serializable {
    private String id;
    private String name;
    private String username;
    private int totalPoints;
    private int trophiesCount;
    private int streakCount;

    // 1. نظام المساعدات التكتيكية (Power-ups Inventory)
    private Map<String, Integer> powerUps = new HashMap<>();

    // 2. نظام المشتريات والتجميل (Cosmetics Inventory)
    private List<String> ownedCosmetics = new ArrayList<>();
    private String equippedBorder;     // معرف الإطار المجهز (مثال: "border_gold")
    private String equippedNameColor;  // لون الاسم المجهز كـ Hex (مثال: "#FFD700")
    private String equippedTitle;      // اللقب الشرفي المجهز (مثال: "بطل العقيدة")

    public User() {
        powerUps.put("freezeTime", 3);
        powerUps.put("deleteTwo", 3);
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public int getTotalPoints() { return totalPoints; }
    public void setTotalPoints(int totalPoints) { this.totalPoints = totalPoints; }

    public int getTrophiesCount() { return trophiesCount; }
    public void setTrophiesCount(int trophiesCount) { this.trophiesCount = trophiesCount; }

    public int getStreakCount() { return streakCount; }
    public void setStreakCount(int streakCount) { this.streakCount = streakCount; }

    public Map<String, Integer> getPowerUps() { return powerUps; }
    public void setPowerUps(Map<String, Integer> powerUps) { this.powerUps = powerUps; }

    public List<String> getOwnedCosmetics() { return ownedCosmetics; }
    public void setOwnedCosmetics(List<String> ownedCosmetics) { this.ownedCosmetics = ownedCosmetics; }

    public String getEquippedBorder() { return equippedBorder; }
    public void setEquippedBorder(String equippedBorder) { this.equippedBorder = equippedBorder; }

    public String getEquippedNameColor() { return equippedNameColor; }
    public void setEquippedNameColor(String equippedNameColor) { this.equippedNameColor = equippedNameColor; }

    public String getEquippedTitle() { return equippedTitle; }
    public void setEquippedTitle(String equippedTitle) { this.equippedTitle = equippedTitle; }
}

