package com.mateen.game.models;

import java.util.Comparator;

/**
 * خوارزمية ترتيب قائمة المتصدرين (Leaderboard Sorting Logic):
 * 1. الشرط الأول (الأولوية الأولى): الترتيب التنازلي حسب عدد الكؤوس (trophiesCount).
 * 2. الشرط الثاني (كاسر التعادل - Tie Breaker): الترتيب التنازلي حسب عدد النقاط الإجمالية (totalPoints).
 */
public class LeaderboardComparator implements Comparator<User> {

    @Override
    public int compare(User u1, User u2) {
        if (u1 == null && u2 == null) return 0;
        if (u1 == null) return 1;
        if (u2 == null) return -1;

        // 1. الشرط الأول: الترتيب التنازلي حسب عدد الكؤوس (trophiesCount)
        int trophyComparison = Integer.compare(u2.getTrophiesCount(), u1.getTrophiesCount());
        if (trophyComparison != 0) {
            return trophyComparison;
        }

        // 2. الشرط الثاني (كاسر التعادل): الترتيب التنازلي حسب عدد النقاط الإجمالية (totalPoints)
        return Integer.compare(u2.getTotalPoints(), u1.getTotalPoints());
    }

    /**
     * دالة جاهزة باستخدام Java 8 Comparator Chaining
     */
    public static Comparator<User> getChainedComparator() {
        return Comparator
                .comparingInt(User::getTrophiesCount)
                .reversed()
                .thenComparing(Comparator.comparingInt(User::getTotalPoints).reversed());
    }
}
