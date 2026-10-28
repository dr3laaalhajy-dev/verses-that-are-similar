package com.mateen.game.controllers;

import com.mateen.game.models.LeaderboardComparator;
import com.mateen.game.models.User;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * مدير نظام الكؤوس ولوحة المتصدرين (Trophies & Leaderboard Manager)
 */
public class TrophiesManager {

    public interface OnTrophiesDistributedCallback {
        void onSuccess(Map<String, Integer> awardedTrophies);
        void onFailure(Exception e);
    }

    /**
     * توزيع الكؤوس عند انتهاء الغرفة:
     * - المركز الأول: +3 كؤوس
     * - المركز الثاني: +2 كأس
     * - المركز الثالث: +1 كأس
     *
     * @param rankedUsers قائمة المتسابقين مرتبة تنازلياً حسب نتائجهم في التحدي
     * @param callback رد الاتصال بعد إتمام التوزيع
     */
    public static void distributeTrophies(List<User> rankedUsers, OnTrophiesDistributedCallback callback) {
        if (rankedUsers == null || rankedUsers.isEmpty()) {
            if (callback != null) callback.onSuccess(new HashMap<>());
            return;
        }

        // مصفوفة مكافآت المراكز الثلاثة الأولى
        final int[] TROPHY_REWARDS = {3, 2, 1};
        Map<String, Integer> awardedMap = new HashMap<>();

        try {
            int limit = Math.min(3, rankedUsers.size());
            for (int i = 0; i < limit; i++) {
                User user = rankedUsers.get(i);
                int trophiesToAdd = TROPHY_REWARDS[i];

                // تحديث الكائن محلياً
                user.setTrophiesCount(user.getTrophiesCount() + trophiesToAdd);
                awardedMap.put(user.getId() != null ? user.getId() : user.getName(), trophiesToAdd);

                /*
                 * تحديث قاعدة البيانات (Firebase Firestore / Realtime Database):
                 * -------------------------------------------------------------
                 * مثال Firestore مع التحديث الذري (Atomic Increment):
                 *
                 * FirebaseFirestore db = FirebaseFirestore.getInstance();
                 * db.collection("users").document(user.getId())
                 *   .update("trophiesCount", FieldValue.increment(trophiesToAdd));
                 *
                 * مثال Firebase Realtime Database:
                 * DatabaseReference userRef = FirebaseDatabase.getInstance().getReference("users").child(user.getId());
                 * userRef.child("trophiesCount").setValue(ServerValue.increment(trophiesToAdd));
                 */
            }

            if (callback != null) {
                callback.onSuccess(awardedMap);
            }
        } catch (Exception e) {
            if (callback != null) {
                callback.onFailure(e);
            }
        }
    }

    /**
     * فرز قائمة المتصدرين محلياً (Double Sorting):
     * الأول: حسب trophiesCount تنازلياً.
     * الثاني: حسب totalPoints تنازلياً.
     */
    public static void sortLeaderboard(List<User> users) {
        if (users != null && users.size() > 1) {
            Collections.sort(users, new LeaderboardComparator());
        }
    }
}
