package com.aza.backend.repository;

import com.aza.backend.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByPhoneNumber(String phoneNumber);
 
    Optional<User> findByEmailOrPhoneNumber(String email, String phoneNumber);
 
    boolean existsByEmail(String email);
 
    boolean existsByPhoneNumber(String phoneNumber);

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    List<User> findByRole(User.UserRole role);


    @Query("SELECT u FROM User u WHERE " +
            "(LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
            "u.status = 'ACTIVE' AND u.findMeByHandle = true")
    Page<User> searchUsers(@Param("query") String query, Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.phoneNumber = :phoneNumber AND u.status = 'ACTIVE' AND u.findMeByPhone = true")
    Optional<User> findByPhoneNumberAndPrivacy(@Param("phoneNumber") String phoneNumber);

    @Query("SELECT u FROM User u WHERE u.email = :email AND u.status = 'ACTIVE' AND u.findMeByEmail = true")
    Optional<User> findByEmailAndPrivacy(@Param("email") String email);

    @Query("SELECT u FROM User u WHERE " +
            "LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "u.phoneNumber LIKE CONCAT('%', :query, '%')")
    Page<User> adminSearchUsers(@Param("query") String query, Pageable pageable);

    Page<User> findAllByStatus(User.AccountStatus status, Pageable pageable);

    Page<User> findAllByKycStatus(User.KycStatus kycStatus, Pageable pageable);

    Page<User> findAllByOnlineStatus(User.OnlineStatus onlineStatus, Pageable pageable);

    java.util.List<User> findAllByOnlineStatus(User.OnlineStatus onlineStatus);

    long countByStatus(User.AccountStatus status);

    long countByKycStatus(User.KycStatus kycStatus);

    java.util.List<User> findAllByRole(User.UserRole role);

    java.util.List<User> findAllByKycStatus(User.KycStatus kycStatus);

    java.util.List<User> findAllByStatus(User.AccountStatus status);

    @Query("SELECT u FROM User u WHERE EXTRACT(MONTH FROM u.dateOfBirth) = :month AND EXTRACT(DAY FROM u.dateOfBirth) = :day AND u.status = 'ACTIVE'")
    java.util.List<User> findActiveUsersByBirthdayMonthAndDay(@Param("month") int month, @Param("day") int day);

    @Query("SELECT u FROM User u WHERE LOWER(u.email) = LOWER(:email) OR u.username = :username")
    Optional<User> findByEmailIgnoreCaseOrUsername(@Param("email") String email, @Param("username") String username);

    /* Task 4: Find users who signed up in a date range (for cohort analytics) */
    @Query("SELECT u FROM User u WHERE u.createdAt >= :start AND u.createdAt < :end AND u.deletedAt IS NULL")
    List<User> findSignupsInPeriod(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT u FROM User u WHERE u.status = 'PENDING_DELETION' AND u.scheduledDeletionAt <= :now")
    List<User> findDueForErasure(@Param("now") LocalDateTime now);
}

