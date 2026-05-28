package com.aza.backend.service;

import com.aza.backend.dto.merchant.SettlementDetailResponse;
import com.aza.backend.dto.merchant.SettlementItemResponse;
import com.aza.backend.dto.merchant.SettlementResponse;
import com.aza.backend.entity.CheckoutSession;
import com.aza.backend.entity.MerchantSettlement;
import com.aza.backend.entity.MerchantSettlementItem;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.CheckoutSessionRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.MerchantSettlementItemRepository;
import com.aza.backend.repository.MerchantSettlementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MerchantSettlementService {

    private final MerchantSettlementRepository settlementRepository;
    private final MerchantSettlementItemRepository settlementItemRepository;
    private final CheckoutSessionRepository checkoutSessionRepository;
    private final MerchantRepository merchantRepository;

    public Page<SettlementResponse> listSettlements(UUID merchantId, int page, int size) {
        return settlementRepository.findAllByMerchantIdOrderByCreatedAtDesc(
                        merchantId, PageRequest.of(page, Math.min(size, 50)))
                .map(this::toResponse);
    }

    public SettlementDetailResponse getSettlement(UUID merchantId, UUID settlementId) {
        MerchantSettlement settlement = settlementRepository.findByIdAndMerchantId(settlementId, merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Settlement not found", HttpStatus.NOT_FOUND));
        List<MerchantSettlementItem> items = settlementItemRepository.findAllBySettlementId(settlementId);
        return toDetailResponse(settlement, items);
    }

    @Transactional
    public MerchantSettlement createSettlementForPayout(UUID merchantId, UUID payoutId) {
        if (!merchantRepository.existsById(merchantId)) {
            throw new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND);
        }

        // Find the last settlement to determine the period start
        List<MerchantSettlement> existing = settlementRepository.findTopByMerchantIdOrderByPeriodEndDesc(
                merchantId, PageRequest.of(0, 1));

        LocalDateTime periodStart;
        List<CheckoutSession> sessions;

        if (existing.isEmpty()) {
            periodStart = LocalDateTime.of(2000, 1, 1, 0, 0);
            sessions = checkoutSessionRepository.findAllCompletedSessions(merchantId);
        } else {
            periodStart = existing.get(0).getPeriodEnd();
            sessions = checkoutSessionRepository.findCompletedSessionsAfter(merchantId, periodStart);
        }

        LocalDateTime periodEnd = LocalDateTime.now();

        if (sessions.isEmpty()) {
            // Create a zero-value settlement to mark this payout
            MerchantSettlement settlement = MerchantSettlement.builder()
                    .merchantId(merchantId)
                    .payoutId(payoutId)
                    .grossAmount(BigDecimal.ZERO)
                    .feeTotal(BigDecimal.ZERO)
                    .netAmount(BigDecimal.ZERO)
                    .transactionCount(0)
                    .periodStart(periodStart)
                    .periodEnd(periodEnd)
                    .status(MerchantSettlement.SettlementStatus.SETTLED)
                    .settledAt(periodEnd)
                    .build();
            settlementRepository.save(settlement);
            log.info("Empty settlement created for merchantId={}, payoutId={}", merchantId, payoutId);
            return settlement;
        }

        BigDecimal grossAmount = BigDecimal.ZERO;
        BigDecimal feeTotal = BigDecimal.ZERO;
        BigDecimal netAmount = BigDecimal.ZERO;

        for (CheckoutSession s : sessions) {
            BigDecimal gross = s.getAmount() != null ? s.getAmount() : BigDecimal.ZERO;
            BigDecimal fee = s.getPlatformFee() != null ? s.getPlatformFee() : BigDecimal.ZERO;
            BigDecimal net = s.getNetAmount() != null ? s.getNetAmount() : BigDecimal.ZERO;
            grossAmount = grossAmount.add(gross);
            feeTotal = feeTotal.add(fee);
            netAmount = netAmount.add(net);
        }

        MerchantSettlement settlement = MerchantSettlement.builder()
                .merchantId(merchantId)
                .payoutId(payoutId)
                .grossAmount(grossAmount.setScale(2, RoundingMode.HALF_UP))
                .feeTotal(feeTotal.setScale(2, RoundingMode.HALF_UP))
                .netAmount(netAmount.setScale(2, RoundingMode.HALF_UP))
                .transactionCount(sessions.size())
                .periodStart(periodStart)
                .periodEnd(periodEnd)
                .status(MerchantSettlement.SettlementStatus.SETTLED)
                .settledAt(periodEnd)
                .build();
        settlementRepository.save(settlement);

        // Create settlement items
        List<MerchantSettlementItem> items = sessions.stream().map(s -> MerchantSettlementItem.builder()
                .settlementId(settlement.getId())
                .checkoutSessionId(s.getId())
                .amount(s.getAmount() != null ? s.getAmount() : BigDecimal.ZERO)
                .fee(s.getPlatformFee() != null ? s.getPlatformFee() : BigDecimal.ZERO)
                .net(s.getNetAmount() != null ? s.getNetAmount() : BigDecimal.ZERO)
                .transactionDate(s.getCompletedAt())
                .build()
        ).collect(Collectors.toList());
        settlementItemRepository.saveAll(items);

        log.info("Settlement created: id={}, merchantId={}, payoutId={}, sessions={}, gross={}",
                settlement.getId(), merchantId, payoutId, sessions.size(), grossAmount);
        return settlement;
    }

    private SettlementResponse toResponse(MerchantSettlement s) {
        return SettlementResponse.builder()
                .id(s.getId())
                .merchantId(s.getMerchantId())
                .payoutId(s.getPayoutId())
                .grossAmount(s.getGrossAmount())
                .feeTotal(s.getFeeTotal())
                .netAmount(s.getNetAmount())
                .transactionCount(s.getTransactionCount())
                .periodStart(s.getPeriodStart())
                .periodEnd(s.getPeriodEnd())
                .status(s.getStatus().name())
                .createdAt(s.getCreatedAt())
                .settledAt(s.getSettledAt())
                .build();
    }

    private SettlementDetailResponse toDetailResponse(MerchantSettlement s, List<MerchantSettlementItem> items) {
        return SettlementDetailResponse.builder()
                .id(s.getId())
                .merchantId(s.getMerchantId())
                .payoutId(s.getPayoutId())
                .grossAmount(s.getGrossAmount())
                .feeTotal(s.getFeeTotal())
                .netAmount(s.getNetAmount())
                .transactionCount(s.getTransactionCount())
                .periodStart(s.getPeriodStart())
                .periodEnd(s.getPeriodEnd())
                .status(s.getStatus().name())
                .createdAt(s.getCreatedAt())
                .settledAt(s.getSettledAt())
                .items(items.stream().map(this::toItemResponse).collect(Collectors.toList()))
                .build();
    }

    private SettlementItemResponse toItemResponse(MerchantSettlementItem item) {
        return SettlementItemResponse.builder()
                .id(item.getId())
                .checkoutSessionId(item.getCheckoutSessionId())
                .amount(item.getAmount())
                .fee(item.getFee())
                .net(item.getNet())
                .transactionDate(item.getTransactionDate())
                .build();
    }
}
