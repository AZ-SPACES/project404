package com.aza.backend.dto.call;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * TURN server credentials returned to the client for WebRTC NAT traversal.
 * Uses HMAC-based time-limited credentials (Coturn REST API compatible).
 * The client includes these in its RTCPeerConnection iceServers config.
 */
@Data
@Builder
@AllArgsConstructor
public class TurnCredentials {
    private List<IceServer> iceServers;
    private int ttl; // seconds until credentials expire

    @Data
    @Builder
    @AllArgsConstructor
    public static class IceServer {
        private List<String> urls;
        private String username;
        private String credential;
    }
}
