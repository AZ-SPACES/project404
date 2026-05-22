package com.aza.backend.repository;

import com.aza.backend.entity.UploadedFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UploadedFileRepository extends JpaRepository<UploadedFile, String> {
    Optional<UploadedFile> findByUrl(String url);
}
