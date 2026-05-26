package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TeamMemberResponse {
    private String id;
    private String email;
    private String userId;
    private String role;
    private String status;
    private LocalDateTime invitedAt;
    private LocalDateTime joinedAt;
}
