package com.aza.backend.dto.e2ee;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One encrypted envelope destined for a single device. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DeviceCiphertextDto {
    private String ciphertext;
    private String ephemeralKey;
    /** Null on follow-up messages. */
    private String preKeyId;
    /** Non-null on the first message of a new E2EE session. */
    private String senderIdentityPublicKey;
}
