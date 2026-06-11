package com.aza.backend.dto.chat;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** One opaque client-side-encrypted chunk of a history transfer or backup. */
@Data
public class ChunkUploadRequest {

    /** Caller's device id — validated against transfer ownership where relevant. */
    private String deviceId;

    @Min(0)
    private int seq;

    @NotBlank
    private String payload;
}
