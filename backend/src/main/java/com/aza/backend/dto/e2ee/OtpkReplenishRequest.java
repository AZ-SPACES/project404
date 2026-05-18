package com.aza.backend.dto.e2ee;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class OtpkReplenishRequest {

    @NotEmpty(message = "At least one one-time pre-key is required")
    @Size(max = 100, message = "Cannot upload more than 100 OPKs at once")
    private List<KeyBundleUploadRequest.OneTimePreKey> oneTimePreKeys;
}
