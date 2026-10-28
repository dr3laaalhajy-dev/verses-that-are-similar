package com.mateen.game.models;

public class LiveReaction {
    private String senderId;
    private String senderName;
    private String senderAvatar;
    private String emoji;
    private long timestamp;

    public LiveReaction() {}

    public LiveReaction(String senderId, String senderName, String senderAvatar, String emoji, long timestamp) {
        this.senderId = senderId;
        this.senderName = senderName;
        this.senderAvatar = senderAvatar;
        this.emoji = emoji;
        this.timestamp = timestamp;
    }

    public String getSenderId() { return senderId; }
    public String getSenderName() { return senderName; }
    public String getSenderAvatar() { return senderAvatar; }
    public String getEmoji() { return emoji; }
    public long getTimestamp() { return timestamp; }
}

