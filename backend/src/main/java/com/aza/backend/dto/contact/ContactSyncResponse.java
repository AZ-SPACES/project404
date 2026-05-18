package com.aza.backend.dto.contact;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class ContactSyncResponse {
    private int totalSynced;
    private int azaUsersFound;
    private List<ContactResponse> contacts;
}
