package com.mateen.game.models;

import java.io.Serializable;

/**
 * نموذج التحكم في إصدارات وتحديثات التطبيق (App Version Control Model)
 * مسار Firebase: app_settings/version_control
 */
public class AppVersionControl implements Serializable {
    private int latestVersionCode;
    private String updateNotes;
    private boolean isForceUpdate;
    private String playStoreLink;
    private String apkLink;
    private long updatedAt;

    public AppVersionControl() {
        // مطلوب لـ Firebase DataSnapshot
    }

    public AppVersionControl(
            int latestVersionCode,
            String updateNotes,
            boolean isForceUpdate,
            String playStoreLink,
            String apkLink
    ) {
        this.latestVersionCode = latestVersionCode;
        this.updateNotes = updateNotes;
        this.isForceUpdate = isForceUpdate;
        this.playStoreLink = playStoreLink;
        this.apkLink = apkLink;
        this.updatedAt = System.currentTimeMillis();
    }

    public int getLatestVersionCode() {
        return latestVersionCode;
    }

    public void setLatestVersionCode(int latestVersionCode) {
        this.latestVersionCode = latestVersionCode;
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

