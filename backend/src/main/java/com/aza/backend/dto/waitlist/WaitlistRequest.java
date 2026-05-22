package com.aza.backend.dto.waitlist;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class WaitlistRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "A valid email address is required")
    @Size(max = 320, message = "Email is too long")
    private String email;
}
