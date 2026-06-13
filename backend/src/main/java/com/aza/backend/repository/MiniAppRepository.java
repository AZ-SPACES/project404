package com.aza.backend.repository;

import com.aza.backend.entity.MiniApp;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MiniAppRepository extends JpaRepository<MiniApp, String> {

    List<MiniApp> findAllByStatus(MiniApp.Status status);

    Page<MiniApp> findAllByStatus(MiniApp.Status status, Pageable pageable);

    List<MiniApp> findAllBySubmittedBy(UUID userId);

    long countByStatus(MiniApp.Status status);
}
