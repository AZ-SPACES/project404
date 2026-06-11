package com.aza.backend.dto.user;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class PresenceBatchRequest {
    /** User ids to look up; the service caps how many are honoured per request. */
    private List<UUID> userIds;
}
