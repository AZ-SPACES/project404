package com.aza.backend.repository;

import com.aza.backend.entity.DeviceBlock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceBlockRepository extends JpaRepository<DeviceBlock, UUID> {
    boolean existsByDeviceId(String deviceId);
    Optional<DeviceBlock> findByDeviceId(String deviceId);
    List<DeviceBlock> findAllByOrderByBlockedAtDesc();
    void deleteByDeviceId(String deviceId);
}
