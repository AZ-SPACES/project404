package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class InviteRecipientRequest {

    /** Phone number, email, or username. Phone is normalized before storage. */
    @NotBlank
    @Size(max = 255)
    private String recipient;

    /** Shown to nobody but you — used in your own invite list. */
    @Size(max = 255)
    private String displayName;

    /** Your id for this person, echoed back on the recipient.registered webhook. */
    @Size(max = 255)
    private String reference;
}
