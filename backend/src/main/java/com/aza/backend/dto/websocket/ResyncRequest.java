package com.aza.backend.dto.websocket;

/**
 * Sent by a client on /app/resync after (re)connecting, asking for everything
 * it missed on one queue while it was away.
 *
 * @param dest        queue to replay — "chat" or "notifications"
 * @param lastEventId id of the last event the client processed on that queue.
 *                    Null or blank on a first-ever connect, which replays
 *                    nothing: there is no gap to fill.
 */
public record ResyncRequest(String dest, String lastEventId) {
}
