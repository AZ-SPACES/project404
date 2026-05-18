package com.aza.backend.exception;

public class SuspiciousActivityException extends RuntimeException {
    private final String challengeToken;
    private final long retryAfterSeconds;

    public SuspiciousActivityException(String message, String challengeToken, long retryAfterSeconds) {
        super(message);
        this.challengeToken = challengeToken;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public String getChallengeToken() {
        return challengeToken;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
