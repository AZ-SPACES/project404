package com.aza.backend.repository;

import com.aza.backend.entity.BlockedUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BlockedUserRepository extends JpaRepository<BlockedUser, UUID> {

    boolean existsByBlockerIdAndBlockedUserId(UUID blockerId, UUID blockedUserId);

    Optional<BlockedUser> findByBlockerIdAndBlockedUserId(UUID blockerId, UUID blockedUserId);

    List<BlockedUser> findAllByBlockerId(UUID blockerId);

    void deleteByBlockerIdAndBlockedUserId(UUID blockerId, UUID blockedUserId);

    /** True if either party has blocked the other. */
    @Query("SELECT COUNT(b) > 0 FROM BlockedUser b WHERE " +
           "(b.blockerId = :a AND b.blockedUserId = :b) OR " +
           "(b.blockerId = :b AND b.blockedUserId = :a)")
    boolean existsBlockBetween(@Param("a") UUID userA, @Param("b") UUID userB);
}
