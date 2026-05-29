package com.aza.backend.repository;

import com.aza.backend.entity.AccountRecoveryContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountRecoveryContactRepository extends JpaRepository<AccountRecoveryContact, UUID> {

    List<AccountRecoveryContact> findAllByUserIdAndStatusNot(UUID userId, AccountRecoveryContact.Status status);

    List<AccountRecoveryContact> findAllByContactUserIdAndStatus(UUID contactUserId, AccountRecoveryContact.Status status);

    long countByUserIdAndStatusNot(UUID userId, AccountRecoveryContact.Status status);

    Optional<AccountRecoveryContact> findByUserIdAndContactUserId(UUID userId, UUID contactUserId);
}
