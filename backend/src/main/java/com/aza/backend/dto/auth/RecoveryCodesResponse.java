package com.aza.backend.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class RecoveryCodesResponse {
    private List<String> codes; // plain-text codes — shown only once
    private int remaining;      // unused codes left (for regenerate responses)
}
