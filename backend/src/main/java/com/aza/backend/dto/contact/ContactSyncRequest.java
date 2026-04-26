package com.aza.backend.dto.contact;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class ContactSyncRequest {
    @NotEmpty(message = "Contacts list cannot be empty")
    @Size(max = 1000, message = "Cannot sync more than 1000 contacts at a time")
    @Valid
    private List<DeviceContact> contacts;

    @Data
    public static class DeviceContact {
        private String phoneNumber;
        private String displayName;
        private String email;
    }
}
