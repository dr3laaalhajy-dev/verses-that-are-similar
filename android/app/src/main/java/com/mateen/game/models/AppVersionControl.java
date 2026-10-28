package com.mateen.game.models;

import java.io.Serializable;

/**
 * نموذج التحكم في إصدارات وتحديثات تطبيق الأندرويد (Android App Version Control Model)
 * مسار Firebase: app_settings/version_control
 */
public class AppVersionControl implements Serializable {
    private int latestAndroidVersionCode;
    private String updateNotes;
    private boolean isForceUpdate;
    private boolean isUpdateActive = true;
    private String playStoreLink;
    private String apkLink;
    private long updatedAt;

    public AppVersionControl() {
        // مطلوب لـ Firebase DataSnapshot
    }

    public AppVersionControl(
            int latestAndroidVersionCode,
            String updateNotes,
            boolean isForceUpdate,
            String playStoreLink,
            String apkLink
    ) {
        this.latestAndroidVersionCode = latestAndroidVersionCode;
        this.updateNotes = updateNotes;
        this.isForceUpdate = isForceUpdate;
        this.isUpdateActive = true;
        this.playStoreLink = playStoreLink;
        this.apkLink = apkLink;
        this.updatedAt = System.currentTimeMillis();
    }

    public boolean isUpdateActive() {
        return isUpdateActive;
    }

    public void setUpdateActive(boolean updateActive) {
        isUpdateActive = updateActive;
    }

    public int getLatestAndroidVersionCode() {
        return latestAndroidVersionCode;
    }

    public void setLatestAndroidVersionCode(int latestAndroidVersionCode) {
        this.latestAndroidVersionCode = latestAndroidVersionCode;
    }

    // توافقية إضافية مع latestVersionCode القديم إن وُجد
    public int getLatestVersionCode() {
        return latestAndroidVersionCode;
    }

    public void setLatestVersionCode(int latestVersionCode) {
        if (this.latestAndroidVersionCode == 0) {
            this.latestAndroidVersionCode = latestVersionCode;
        }
    }

    public String getUpdateNotes() {
        return updateNotes != null ? updateNotes : "";
    }

    public void setUpdateNotes(String updateNotes) {
        this.updateNotes = updateNotes;
    }

    public boolean isForceUpdate() {
        return isForceUpdate;
    }

    public void setForceUpdate(boolean forceUpdate) {
        isForceUpdate = forceUpdate;
    }

    public String getPlayStoreLink() {
        return playStoreLink != null ? playStoreLink : "";
    }

    public void setPlayStoreLink(String playStoreLink) {
        this.playStoreLink = playStoreLink;
    }

    public String getApkLink() {
        return apkLink != null ? apkLink : "";
    }

    public void setApkLink(String apkLink) {
        this.apkLink = apkLink;
    }

    public long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(long updatedAt) {
        this.updatedAt = updatedAt;
    }
}

