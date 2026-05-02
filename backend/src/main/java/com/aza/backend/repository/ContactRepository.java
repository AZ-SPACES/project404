package com.aza.backend.repository;

import com.aza.backend.entity.Contact;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ContactRepository extends JpaRepository<Contact, UUID> {
    /* List contacts for a user, Aza contacts first */
    @Query("SELECT c FROM Contact c WHERE c.ownerUserId = :userId ORDER BY c.isAzaUser DESC, c.isFavorite DESC, c.displayName ASC")
    Page<Contact> findAllByOwnerUserId(@Param("userId") UUID userId, Pageable pageable);

    /*Find a contact by owner and phone number */
    Optional<Contact> findByOwnerUserIdAndPhoneNumber(UUID ownerUserId, String phoneNumber);

    /* Find a contact by ID and owner (ownership check) */
    Optional<Contact> findByIdAndOwnerUserId(UUID id, UUID ownerUserId);

    /* Find a contact by owner and contact user ID */
    Optional<Contact> findByOwnerUserIdAndContactUserId(UUID ownerUserId, UUID contactUserId);

    /*Search contacts by name, phone or email*/
    @Query("SELECT c FROM Contact c WHERE c.ownerUserId = :userId AND (" +
            "LOWER(c.displayName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "c.phoneNumber LIKE CONCAT('%', :query, '%') OR " +
            "LOWER(c.email) LIKE LOWER(CONCAT('%', :query, '%')))" +
            "ORDER BY c.isAzaUser DESC, c.displayName ASC")
    Page<Contact> searchByOwnerUserIdAndQuery(
            @Param("userId") UUID userId,
            @Param("query") String query,
            Pageable pageable);
    @Modifying
    @Query("DELETE FROM Contact c WHERE c.ownerUserId = :userId")
    void deleteAllByOwnerUserId(@Param("userId") UUID userId);
}
