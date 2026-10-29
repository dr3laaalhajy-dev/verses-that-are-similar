package com.mateen.game.models;

import java.io.Serializable;

/**
 * نموذج المستخدم (UserModel) لبيانات المتسابق ولوحة الصدارة
 * متوافق مع هيكل قاعدة البيانات و Firebase Realtime Database
 */
public class UserModel extends User implements Serializable {

    public UserModel() {
        super();
    }

    public UserModel(String id, String name, String username, int totalPoints, int trophiesCount) {
        super();
        setId(id);
        setName(name);
        setUsername(username);
        setTotalPoints(totalPoints);
        setTrophiesCount(trophiesCount);
    }
}

