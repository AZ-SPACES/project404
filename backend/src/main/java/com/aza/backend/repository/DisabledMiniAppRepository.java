package com.aza.backend.repository;

import com.aza.backend.entity.DisabledMiniApp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DisabledMiniAppRepository extends JpaRepository<DisabledMiniApp, String> {
}
