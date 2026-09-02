package com.aza.backend.dto.user;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/**
 * Result of the signup screen's email check: whether the address can receive mail,
 * whether it's already taken, and a correction if the domain looks mistyped.
 */
@Data
@Builder
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmailCheckResponse {
    /** Address parses, its domain accepts mail, and it isn't a throwaway provider. */
    private boolean valid;
    /** No account already uses this address. Only meaningful when valid. */
    private boolean available;
    /** INVALID_FORMAT | DISPOSABLE_DOMAIN | UNRESOLVABLE_DOMAIN | ALREADY_REGISTERED, else null. */
    private String reason;
    /** Full corrected address when the domain looks like a typo ("kofi@gmail.com"), else null. */
    private String suggestion;
}
