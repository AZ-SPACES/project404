package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class InviteTeamMemberRequest {
    @NotBlank
    private String email;
    private String role;
}
