package com.aza.backend.service;

import com.aza.backend.dto.transfer.BudgetRequest;
import com.aza.backend.dto.transfer.BudgetResponse;
import com.aza.backend.entity.Budget;
import com.aza.backend.entity.Transaction;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.BudgetRepository;
import com.aza.backend.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class BudgetService {

    private final BudgetRepository budgetRepository;
    private final TransactionRepository transactionRepository;

    private static final Map<Transaction.TransactionCategory, String[]> CATEGORY_META;
    static {
        CATEGORY_META = new EnumMap<>(Transaction.TransactionCategory.class);
        CATEGORY_META.put(Transaction.TransactionCategory.BILLS,         new String[]{"Bills & Utilities", "#60A5FA"});
        CATEGORY_META.put(Transaction.TransactionCategory.TRANSPORT,     new String[]{"Transport",          "#34D399"});
        CATEGORY_META.put(Transaction.TransactionCategory.FOOD,          new String[]{"Food & Drinks",      "#F59E0B"});
        CATEGORY_META.put(Transaction.TransactionCategory.EDUCATION,     new String[]{"Education",          "#A78BFA"});
        CATEGORY_META.put(Transaction.TransactionCategory.ENTERTAINMENT, new String[]{"Entertainment",      "#F472B6"});
        CATEGORY_META.put(Transaction.TransactionCategory.SHOPPING,      new String[]{"Shopping",           "#FB923C"});
        CATEGORY_META.put(Transaction.TransactionCategory.HEALTHCARE,    new String[]{"Healthcare",         "#EF4444"});
        CATEGORY_META.put(Transaction.TransactionCategory.SAVINGS,       new String[]{"Savings",            "#10B981"});
        CATEGORY_META.put(Transaction.TransactionCategory.OTHERS,        new String[]{"Others",             "#94A3B8"});
    }

    public List<BudgetResponse> getBudgets(UUID userId) {
        return budgetRepository.findByUserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public BudgetResponse createOrUpdateBudget(UUID userId, BudgetRequest request) {
        Transaction.TransactionCategory category;
        try {
            category = Transaction.TransactionCategory.valueOf(request.getCategory().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Invalid category: " + request.getCategory());
        }

        Budget.BudgetPeriod period = Budget.BudgetPeriod.MONTHLY;
        if (request.getPeriod() != null && !request.getPeriod().isBlank()) {
            try { period = Budget.BudgetPeriod.valueOf(request.getPeriod().toUpperCase()); }
            catch (IllegalArgumentException ignored) {}
        }

        Budget budget = budgetRepository.findByUserIdAndCategory(userId, category)
                .orElse(Budget.builder().userId(userId).category(category).build());
        budget.setBudgetAmount(request.getBudgetAmount());
        budget.setPeriod(period);
        budget = budgetRepository.save(budget);
        return toResponse(budget);
    }

    @Transactional
    public void deleteBudget(UUID userId, UUID budgetId) {
        Budget budget = budgetRepository.findById(budgetId)
                .orElseThrow(() -> new AppException("Budget not found"));
        if (!budget.getUserId().equals(userId)) {
            throw new AppException("Not authorized");
        }
        budgetRepository.delete(budget);
    }

    public List<BudgetResponse> getBudgetStatus(UUID userId, LocalDateTime start, LocalDateTime end) {
        List<Budget> budgets = budgetRepository.findByUserId(userId);
        Map<Transaction.TransactionCategory, Budget> budgetMap = new EnumMap<>(Transaction.TransactionCategory.class);
        for (Budget b : budgets) budgetMap.put(b.getCategory(), b);

        List<Transaction> debits = transactionRepository.findDebitsByUserIdAndDateRange(userId, start, end);
        Map<Transaction.TransactionCategory, BigDecimal> spentMap = new EnumMap<>(Transaction.TransactionCategory.class);
        for (Transaction t : debits) {
            Transaction.TransactionCategory cat = t.getCategory() != null ? t.getCategory() : Transaction.TransactionCategory.OTHERS;
            spentMap.merge(cat, t.getAmount(), BigDecimal::add);
        }

        List<BudgetResponse> result = new ArrayList<>();
        for (Transaction.TransactionCategory cat : Transaction.TransactionCategory.values()) {
            String[] meta = CATEGORY_META.get(cat);
            Budget budget = budgetMap.get(cat);
            BigDecimal spent = spentMap.getOrDefault(cat, BigDecimal.ZERO);

            BigDecimal remaining = null;
            BigDecimal percentUsed = null;
            if (budget != null) {
                remaining = budget.getBudgetAmount().subtract(spent).max(BigDecimal.ZERO);
                if (budget.getBudgetAmount().compareTo(BigDecimal.ZERO) > 0) {
                    percentUsed = spent.multiply(BigDecimal.valueOf(100))
                            .divide(budget.getBudgetAmount(), 1, RoundingMode.HALF_UP);
                }
            }

            result.add(BudgetResponse.builder()
                    .id(budget != null ? budget.getId().toString() : null)
                    .category(cat.name())
                    .categoryName(meta[0])
                    .color(meta[1])
                    .budgetAmount(budget != null ? budget.getBudgetAmount() : null)
                    .period(budget != null ? budget.getPeriod().name() : null)
                    .spent(spent)
                    .remaining(remaining)
                    .percentUsed(percentUsed)
                    .build());
        }
        return result;
    }

    private BudgetResponse toResponse(Budget b) {
        String[] meta = CATEGORY_META.get(b.getCategory());
        return BudgetResponse.builder()
                .id(b.getId().toString())
                .category(b.getCategory().name())
                .categoryName(meta[0])
                .color(meta[1])
                .budgetAmount(b.getBudgetAmount())
                .period(b.getPeriod().name())
                .createdAt(b.getCreatedAt() != null ? b.getCreatedAt().toString() : null)
                .updatedAt(b.getUpdatedAt() != null ? b.getUpdatedAt().toString() : null)
                .build();
    }
}
