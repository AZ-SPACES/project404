package com.aza.backend.websocket;

import com.aza.backend.entity.User;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.Collections;

/**
 * STOMP session principal: carries the full {@link User} so @AuthenticationPrincipal
 * and the presence listeners can resolve it, while {@link #getName()} returns the
 * user's UUID — Spring routes convertAndSendToUser(userId, ...) by principal name,
 * so this must be the UUID and not an email or object hash.
 */
public class StompUserPrincipal extends UsernamePasswordAuthenticationToken {

    public StompUserPrincipal(User user) {
        super(user, null, Collections.emptyList());
    }

    @Override
    public String getName() {
        return ((User) getPrincipal()).getId().toString();
    }
}
