package com.aza.backend.service;

import com.aza.backend.dto.agent.AgentApplyRequest;
import com.aza.backend.dto.agent.AgentResponse;
import com.aza.backend.dto.agent.AgentTermsRequest;
import com.aza.backend.entity.Agent;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.UUID;

/**
 * Agent onboarding and lifecycle. A user applies (PENDING); a second staff member
 * activates the agent through the maker-checker {@code APPROVE_AGENT} flow, which
 * calls {@link #activate}. Rejection and suspension stay immediate, mirroring how
 * KYC rejection and wallet freezing work.
 */
@Service
@RequiredArgsConstructor
public class AgentService {

    private final AgentRepository agentRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

    @Transactional
    public AgentResponse apply(User user, AgentApplyRequest request) {
        // Agents handle physical cash, so identity must be verified before they can apply.
        if (user.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC_REQUIRED",
                    "Complete identity verification before applying to become an agent", HttpStatus.FORBIDDEN);
        }
        agentRepository.findByUserId(user.getId()).ifPresent(a -> {
            throw new AppException("AGENT_EXISTS",
                    "You already have an agent application or account", HttpStatus.CONFLICT);
        });
        Agent.AgentBuilder agent = Agent.builder()
                .userId(user.getId())
                .status(Agent.Status.PENDING)
                .tier(Agent.Tier.STANDARD);
        if (request != null) {
            agent.location(request.getLocation())
                    .businessName(request.getBusinessName())
                    .contactPhone(request.getContactPhone())
                    .idNumber(request.getIdNumber())
                    .expectedMonthlyVolumeGhs(request.getExpectedMonthlyVolumeGhs())
                    .applicationNotes(request.getApplicationNotes());
        }
        return toResponse(agentRepository.save(agent.build()));
    }

    /** Maker-checker target: a second COMPLIANCE/ADMIN approving APPROVE_AGENT activates the agent. */
    @Transactional
    public void activate(UUID agentId) {
        Agent agent = require(agentId);
        agent.setStatus(Agent.Status.ACTIVE);
        if (agent.getCode() == null || agent.getCode().isBlank()) {
            agent.setCode(generateCode());
        }
        agentRepository.save(agent);
        ensureFloatWallet(agent.getUserId());
        notify(agent.getUserId(), Notification.NotificationType.AGENT_APPROVED,
                "You're now an AZA agent",
                "Your agent application has been approved. You can start taking deposits and paying out withdrawals.");
    }

    /**
     * Every active agent needs a ring-fenced float wallet, separate from their
     * personal wallet. Created empty — finance mints float into it out of band.
     * Idempotent so re-activation never duplicates it.
     */
    private void ensureFloatWallet(UUID userId) {
        if (walletRepository.findByUserIdAndType(userId, Wallet.WalletType.AGENT_FLOAT).isEmpty()) {
            walletRepository.save(Wallet.builder()
                    .userId(userId)
                    .type(Wallet.WalletType.AGENT_FLOAT)
                    .balance(BigDecimal.ZERO)
                    .currency("GHS")
                    .frozen(false)
                    .build());
        }
    }

    /** A short, human-readable till code (e.g. AZA-7K4PQM) assigned when the agent goes live. */
    private String generateCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder("AZA-");
            for (int i = 0; i < 6; i++) {
                sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (agentRepository.findByCode(code).isEmpty()) {
                return code;
            }
        }
        throw new AppException("CODE_GENERATION_FAILED",
                "Could not allocate a unique agent code", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Transactional
    public AgentResponse reject(UUID agentId) {
        Agent agent = require(agentId);
        agent.setStatus(Agent.Status.REJECTED);
        AgentResponse response = toResponse(agentRepository.save(agent));
        notify(agent.getUserId(), Notification.NotificationType.AGENT_REJECTED,
                "Agent application not approved",
                "Your agent application was not approved. Contact support if you believe this is a mistake.");
        return response;
    }

    @Transactional
    public AgentResponse suspend(UUID agentId) {
        Agent agent = require(agentId);
        agent.setStatus(Agent.Status.SUSPENDED);
        AgentResponse response = toResponse(agentRepository.save(agent));
        notify(agent.getUserId(), Notification.NotificationType.AGENT_SUSPENDED,
                "Agent access suspended",
                "Your agent account has been suspended. Please contact support for help.");
        return response;
    }

    /** Status-change push; never let a notification failure roll back the status change. */
    private void notify(UUID userId, Notification.NotificationType type, String title, String body) {
        try {
            notificationService.sendNotification(userId, type, title, body,
                    java.util.Map.of("type", type.name()));
        } catch (Exception e) {
            // best-effort; the status change is the source of truth
        }
    }

    /** Maker-checker target: a second COMPLIANCE/ADMIN approving UPDATE_AGENT_TERMS applies new commercial/risk terms. */
    @Transactional
    public void updateTerms(UUID agentId, AgentTermsRequest req) {
        Agent agent = require(agentId);
        if (req.getTier() != null && !req.getTier().isBlank()) {
            try {
                agent.setTier(Agent.Tier.valueOf(req.getTier().trim().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_TIER", "Tier must be STANDARD or SUPER", HttpStatus.BAD_REQUEST);
            }
        }
        if (req.getFloatLimit() != null) {
            if (req.getFloatLimit().signum() < 0) {
                throw new AppException("INVALID_FLOAT_LIMIT", "Float limit cannot be negative", HttpStatus.BAD_REQUEST);
            }
            agent.setFloatLimit(req.getFloatLimit());
        }
        if (req.getCashInCommissionBps() != null) {
            agent.setCashInCommissionBps(requireBps(req.getCashInCommissionBps(), "cash-in commission"));
        }
        if (req.getCashOutCommissionShareBps() != null) {
            agent.setCashOutCommissionShareBps(requireBps(req.getCashOutCommissionShareBps(), "cash-out commission share"));
        }
        agentRepository.save(agent);
    }

    private int requireBps(int bps, String label) {
        if (bps < 0 || bps > 10_000) {
            throw new AppException("INVALID_BPS",
                    "The " + label + " must be between 0 and 10000 basis points", HttpStatus.BAD_REQUEST);
        }
        return bps;
    }

    public Page<AgentResponse> list(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, Math.min(size, 100));
        Page<Agent> result = (status == null || status.isBlank())
                ? agentRepository.findAllByOrderByCreatedAtDesc(pageable)
                : agentRepository.findByStatusOrderByCreatedAtDesc(
                        Agent.Status.valueOf(status.toUpperCase()), pageable);
        return result.map(this::toResponse);
    }

    private Agent require(UUID agentId) {
        return agentRepository.findById(agentId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Agent not found", HttpStatus.NOT_FOUND));
    }

    private AgentResponse toResponse(Agent a) {
        AgentResponse.AgentResponseBuilder builder = AgentResponse.builder()
                .id(a.getId().toString())
                .userId(a.getUserId().toString())
                .status(a.getStatus().name())
                .tier(a.getTier().name())
                .code(a.getCode())
                .location(a.getLocation())
                .businessName(a.getBusinessName())
                .contactPhone(a.getContactPhone())
                .idNumber(a.getIdNumber())
                .expectedMonthlyVolumeGhs(a.getExpectedMonthlyVolumeGhs())
                .applicationNotes(a.getApplicationNotes())
                .floatBalance(walletRepository.findByUserIdAndType(a.getUserId(), Wallet.WalletType.AGENT_FLOAT)
                        .map(Wallet::getBalance).orElse(BigDecimal.ZERO))
                .commissionAccruedGhs(a.getCommissionAccruedGhs())
                .floatLimit(a.getFloatLimit())
                .cashInCommissionBps(a.getCashInCommissionBps())
                .cashOutCommissionShareBps(a.getCashOutCommissionShareBps())
                .createdAt(a.getCreatedAt() != null ? a.getCreatedAt().toString() : null);
        userRepository.findById(a.getUserId()).ifPresent(u -> {
            String name = ((u.getFirstName() != null ? u.getFirstName() : "") + " "
                    + (u.getLastName() != null ? u.getLastName() : "")).trim();
            builder.userName(name.isBlank() ? null : name)
                    .userEmail(u.getEmail())
                    .userPhone(u.getPhoneNumber());
        });
        return builder.build();
    }
}
