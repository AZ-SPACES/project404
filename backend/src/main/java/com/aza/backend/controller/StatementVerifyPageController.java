package com.aza.backend.controller;

import com.aza.backend.entity.GeneratedStatement;
import com.aza.backend.repository.GeneratedStatementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.format.DateTimeFormatter;
import java.util.Optional;

@Controller
@RequestMapping("/verify/statement")
@RequiredArgsConstructor
public class StatementVerifyPageController {

    private final GeneratedStatementRepository statementRepository;

    private static final DateTimeFormatter DATE_FMT  = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter STAMP_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy 'at' HH:mm");

    @GetMapping
    public String verify(@RequestParam(required = false) String code, Model model) {
        if (code == null || code.isBlank()) {
            model.addAttribute("verified", false);
            model.addAttribute("errorMsg", "No verification code provided.");
            return "verify-statement";
        }

        String normalised = code.replace("-", "").toUpperCase();
        Optional<GeneratedStatement> record = statementRepository.findByVerifyCode(normalised);

        if (record.isEmpty()) {
            model.addAttribute("verified", false);
            model.addAttribute("errorMsg", "This code does not match any statement issued by AZA. "
                    + "The document may have been altered or the code may be incorrect.");
            return "verify-statement";
        }

        GeneratedStatement s = record.get();
        model.addAttribute("verified", true);
        model.addAttribute("accountHolderName",  s.getAccountHolderName());
        model.addAttribute("accountNumber",       s.getAccountNumber());
        model.addAttribute("periodStart",         s.getPeriodStart().format(DATE_FMT));
        model.addAttribute("periodEnd",           s.getPeriodEnd().format(DATE_FMT));
        model.addAttribute("transactionCount",    s.getTransactionCount());
        model.addAttribute("openingBalance",      s.getOpeningBalance());
        model.addAttribute("totalCredits",        s.getTotalCredits());
        model.addAttribute("totalDebits",         s.getTotalDebits());
        model.addAttribute("closingBalance",      s.getClosingBalance());
        model.addAttribute("generatedAt",         s.getGeneratedAt().format(STAMP_FMT));
        model.addAttribute("verifyCode",          formatCode(normalised));
        return "verify-statement";
    }

    private static String formatCode(String raw) {
        if (raw.length() < 16) return raw;
        return raw.substring(0, 4) + "-" + raw.substring(4, 8)
                + "-" + raw.substring(8, 12) + "-" + raw.substring(12, 16);
    }
}
