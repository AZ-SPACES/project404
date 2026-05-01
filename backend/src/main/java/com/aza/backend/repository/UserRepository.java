package com.aza.backend.repository;

import com.aza.backend.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByPhone(String phone);

    Optional<User> findByEmailOrPhone(String email, String phone);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    Optional<User> findByHandle(String handle);

    boolean existsByHandle(String handle);

    Optional<User> findByDisplayNameContainingIgnoreCase(String displayName);

    @Query("SELECT u FROM User u WHERE " +
            "(LOWER(u.handle) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.displayName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
            "u.status = 'ACTIVE'")
    Page<User> searchUsers(@Param("query") String query, Pageable pageable);

    // Admin queries — no status filter
    @Query("SELECT u FROM User u WHERE " +
            "LOWER(u.handle) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.displayName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "u.phone LIKE CONCAT('%', :query, '%')")
    Page<User> adminSearchUsers(@Param("query") String query, Pageable pageable);

    Page<User> findAllByStatus(User.AccountStatus status, Pageable pageable);

    Page<User> findAllByKycStatus(User.KycStatus kycStatus, Pageable pageable);

    long countByStatus(User.AccountStatus status);

    long countByKycStatus(User.KycStatus kycStatus);

    java.util.List<User> findAllByRole(User.UserRole role);

    java.util.List<User> findAllByKycStatus(User.KycStatus kycStatus);

    java.util.List<User> findAllByStatus(User.AccountStatus status);
}
