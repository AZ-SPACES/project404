package com.aza.backend.repository;

import com.aza.backend.entity.UserKeyBundle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserKeyBundleRepository extends JpaRepository<UserKeyBundle, UUID> {

    Optional<UserKeyBundle> findByUserIdAndDeviceId(UUID userId, String deviceId);

    List<UserKeyBundle> findByUserId(UUID userId);

    boolean existsByUserIdAndDeviceId(UUID userId, String deviceId);

    void deleteByUserIdAndDeviceId(UUID userId, String deviceId);
}
