package com.aza.backend.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class ChatResponse {
    private String id;
    private String otherUserId;
    private String otherUserName;
    private String otherUserHandle;
    private String otherUserAvatar;
    private String otherUserStatus;
    /** ISO timestamp of the other user's last activity — null if never seen. */
    private String otherUserLastSeenAt;
    private String lastMessageAt;
    private long unreadCount;
    private boolean isMuted;
    private boolean isArchived;
}
