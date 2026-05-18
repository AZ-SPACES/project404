package com.aza.backend.repository;

import com.aza.backend.entity.ContactRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContactRequestRepository extends JpaRepository<ContactRequest, UUID> {
    Optional<ContactRequest> findBySenderUserIdAndReceiverUserId(UUID senderId, UUID receiverId);
    List<ContactRequest> findAllByReceiverUserIdAndStatus(UUID receiverId, ContactRequest.RequestStatus status);
}
