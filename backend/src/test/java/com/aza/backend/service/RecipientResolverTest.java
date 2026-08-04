package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Phone must resolve, because it is how Ghanaian recipients identify themselves — the
 * marketplace paths previously accepted only email/username, so a plumber given as
 * "0241234567" could never be paid.
 */
class RecipientResolverTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final RecipientResolver resolver = new RecipientResolver(userRepository, walletRepository);

    private final UUID userId = UUID.randomUUID();

    private User activeUser() {
        return User.builder().id(userId).status(User.AccountStatus.ACTIVE).build();
    }

    @Test
    void resolvesEveryGhanaianPhoneShapeToTheSameAccount() {
        User user = activeUser();
        when(userRepository.findByPhoneNumber("+233241234567")).thenReturn(Optional.of(user));

        for (String shape : new String[]{"0241234567", "+233241234567", "233241234567", "+2330241234567"}) {
            assertTrue(resolver.find(shape).isPresent(), shape + " should resolve");
        }
    }

    @Test
    void fallsBackToEmailThenUsername() {
        User user = activeUser();
        when(userRepository.findByPhoneNumber(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCaseOrUsername("ama@example.com", "ama@example.com"))
                .thenReturn(Optional.of(user));

        assertTrue(resolver.find("ama@example.com").isPresent());
    }

    @Test
    void stripsLeadingAtFromUsernames() {
        User user = activeUser();
        when(userRepository.findByEmailIgnoreCaseOrUsername("@ama", "ama")).thenReturn(Optional.of(user));

        assertTrue(resolver.find("@ama").isPresent());
    }

    @Test
    void reportsWhyARecipientCannotBePaid() {
        when(userRepository.findByPhoneNumber(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCaseOrUsername(anyString(), anyString()))
                .thenReturn(Optional.empty());
        assertEquals(RecipientResolver.Unpayable.NOT_FOUND, resolver.resolve("nobody@example.com").problem());

        User frozen = activeUser();
        when(userRepository.findByEmailIgnoreCaseOrUsername("ama@example.com", "ama@example.com"))
                .thenReturn(Optional.of(frozen));
        when(walletRepository.findByUserId(userId)).thenReturn(Optional.of(
                Wallet.builder().userId(userId).balance(BigDecimal.ZERO).frozen(true).build()));
        assertEquals(RecipientResolver.Unpayable.WALLET_FROZEN, resolver.resolve("ama@example.com").problem());

        when(walletRepository.findByUserId(userId)).thenReturn(Optional.of(
                Wallet.builder().userId(userId).balance(BigDecimal.ZERO).frozen(false).build()));
        assertTrue(resolver.resolve("ama@example.com").payable());
    }
}
