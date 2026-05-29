package com.aza.backend.service;

import com.aza.backend.entity.GeneratedStatement;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.repository.GeneratedStatementRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.List;
import java.util.stream.Collectors;
import com.aza.backend.exception.AppException;

@Service
@RequiredArgsConstructor
public class StatementService {

    private final TransactionRepository        transactionRepository;
    private final UserRepository               userRepository;
    private final WalletRepository             walletRepository;
    private final MerchantRepository           merchantRepository;
    private final GeneratedStatementRepository statementRepository;

    @Value("${app.base-url:https://aza.systems}")
    private String appBaseUrl;

    // ── Brand colours ─────────────────────────────────────────────────────────
    private static final Color AZA_DARK    = new Color(14,  15,  12);
    private static final Color AZA_GREEN   = new Color(183, 238, 122);
    private static final Color AZA_SURFACE = new Color(245, 247, 243);
    private static final Color AZA_RULE    = new Color(220, 222, 218);
    private static final Color AZA_TEXT    = new Color(30,  30,  28);
    private static final Color AZA_MUTED   = new Color(100, 103,  96);
    private static final Color DEBIT_RED   = new Color(185,  28,  28);
    private static final Color CREDIT_GRN  = new Color(21,  128,  61);
    private static final Color MONTH_BG    = new Color(235, 240, 230);

    private static final DateTimeFormatter DATE_FMT  = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MMMM yyyy");
    private static final DateTimeFormatter STAMP_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");

    // ── Page event: header band, watermark, page-X-of-Y footer ──────────────
    private static class PageEvent extends PdfPageEventHelper {
        private final byte[]  logoBytes;
        private final String  period;
        private final String  stmtRef;
        PdfTemplate           totalPagesTemplate;
        BaseFont              bf;

        PageEvent(byte[] logoBytes, String period, String stmtRef) {
            this.logoBytes = logoBytes;
            this.period    = period;
            this.stmtRef   = stmtRef;
        }

        @Override
        public void onOpenDocument(PdfWriter writer, Document document) {
            totalPagesTemplate = writer.getDirectContent().createTemplate(28, 10);
            try {
                bf = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
            } catch (Exception ignored) {}
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb   = writer.getDirectContent();
            Rectangle      page = document.getPageSize();
            float          lm   = document.leftMargin();
            float          rm   = document.rightMargin();
            float          pw   = page.getWidth();
            float          ph   = page.getHeight();

            // ── watermark (behind content) ───────────────────────────────
            PdfContentByte under = writer.getDirectContentUnder();
            under.saveState();
            PdfGState gs = new PdfGState();
            gs.setFillOpacity(0.04f);
            under.setGState(gs);
            try {
                BaseFont wBf = BaseFont.createFont(BaseFont.HELVETICA_BOLD, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
                under.beginText();
                under.setFontAndSize(wBf, 68);
                under.setColorFill(AZA_TEXT);
                under.showTextAligned(Element.ALIGN_CENTER, "OFFICIAL DOCUMENT",
                        pw / 2f, ph / 2f - 20, 45);
                under.endText();
            } catch (Exception ignored) {}
            under.restoreState();

            // ── dark header band ─────────────────────────────────────────
            cb.saveState();
            cb.setColorFill(AZA_DARK);
            cb.rectangle(0, ph - 72, pw, 72);
            cb.fill();
            cb.setColorFill(AZA_GREEN);
            cb.rectangle(0, ph - 74, pw, 3);
            cb.fill();
            cb.restoreState();

            // logo
            try {
                if (logoBytes != null) {
                    Image logo = Image.getInstance(logoBytes);
                    logo.scaleToFit(88, 32);
                    logo.setAbsolutePosition(lm, ph - 62);
                    cb.addImage(logo);
                }
            } catch (Exception ignored) {}

            // header text
            ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                    new Phrase("ACCOUNT STATEMENT",
                            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, AZA_GREEN)),
                    pw - rm, ph - 38, 0);
            ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                    new Phrase("Ref: " + stmtRef + "   |   " + period,
                            FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(160, 163, 156))),
                    pw - rm, ph - 53, 0);

            // ── footer rule ──────────────────────────────────────────────
            cb.saveState();
            cb.setColorStroke(AZA_RULE);
            cb.setLineWidth(0.5f);
            cb.moveTo(lm, 40);
            cb.lineTo(pw - rm, 40);
            cb.stroke();
            cb.restoreState();

            // page X of Y  (using template for total)
            if (bf != null) {
                String pageText = "Page " + writer.getPageNumber() + " of ";
                float  tw       = bf.getWidthPoint(pageText, 8);
                float  fx       = pw / 2f - tw / 2f;
                float  fy       = 26f;
                cb.beginText();
                cb.setFontAndSize(bf, 8);
                cb.setColorFill(AZA_MUTED);
                cb.setTextMatrix(fx, fy);
                cb.showText(pageText);
                cb.endText();
                cb.addTemplate(totalPagesTemplate, fx + tw, fy);
            }

            // regulatory footer text
            ColumnText.showTextAligned(cb, Element.ALIGN_LEFT,
                    new Phrase("AZA Financial Technology Ltd  •  Licensed under the Payment Systems and Services Act, 2019 (Act 987)  •  support@aza.systems",
                            FontFactory.getFont(FontFactory.HELVETICA, 6.5f, AZA_MUTED)),
                    lm, 26, 0);
        }

        @Override
        public void onCloseDocument(PdfWriter writer, Document document) {
            // fill the total-pages placeholder
            if (bf != null && totalPagesTemplate != null) {
                totalPagesTemplate.beginText();
                totalPagesTemplate.setFontAndSize(bf, 8);
                totalPagesTemplate.setColorFill(AZA_MUTED);
                totalPagesTemplate.setTextMatrix(0, 0);
                totalPagesTemplate.showText(String.valueOf(writer.getPageNumber() - 1));
                totalPagesTemplate.endText();
            }
        }
    }

    // ── Public: PDF ───────────────────────────────────────────────────────────

    public byte[] generateStatementPdf(User user, LocalDateTime start, LocalDateTime end) {

        List<Transaction> txs = transactionRepository.findAllByUserIdAndDateRange(user.getId(), start, end);

        // Balance computation
        BigDecimal currentBal    = walletRepository.findByUserId(user.getId())
                .map(w -> w.getBalance()).orElse(BigDecimal.ZERO);
        BigDecimal sentAfter     = transactionRepository.getTotalSentAfter(user.getId(), end);
        BigDecimal receivedAfter = transactionRepository.getTotalReceivedAfter(user.getId(), end);
        BigDecimal closingBal    = currentBal.subtract(receivedAfter).add(sentAfter);

        BigDecimal totalDebits  = sum(txs.stream().filter(t -> t.getSenderId().equals(user.getId()))
                .map(Transaction::getAmount).toList());
        BigDecimal totalCredits = sum(txs.stream().filter(t -> t.getRecipientId().equals(user.getId()))
                .map(Transaction::getAmount).toList());
        BigDecimal openingBal   = closingBal.subtract(totalCredits).add(totalDebits);

        // Statement metadata
        String stmtRef   = "STMT-" + stmtHash(user, start, end, txs.size(), closingBal).substring(0, 8).toUpperCase();
        String period    = start.format(DATE_FMT) + " – " + end.format(DATE_FMT);
        String fullName  = trim(user.getFirstName()) + " " + trim(user.getLastName());
        String accountNo = formatAccountNo(user.getId());
        String verifyCode = stmtHash(user, start, end, txs.size(), closingBal).substring(0, 16).toUpperCase();
        String verifyUrl  = appBaseUrl + "/api/v1/public/statements/verify/page?code=" + verifyCode;

        byte[] logoBytes = loadLogoBytes();

        Document document = new Document(PageSize.A4, 40, 40, 92, 52);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter writer = PdfWriter.getInstance(document, out);
            writer.setPageEvent(new PageEvent(logoBytes, period, stmtRef));
            document.open();

            // ── Account info ─────────────────────────────────────────────
            PdfPTable infoTable = new PdfPTable(2);
            infoTable.setWidthPercentage(100);
            infoTable.setSpacingBefore(6);
            infoTable.setSpacingAfter(16);

            PdfPCell leftCell = surfaceCell();
            leftCell.addElement(label("ACCOUNT HOLDER"));
            leftCell.addElement(value(fullName));
            if (user.getUsername() != null) leftCell.addElement(sub("@" + user.getUsername()));
            leftCell.addElement(sub(user.getEmail()));
            if (user.getPhoneNumber() != null) leftCell.addElement(sub(user.getPhoneNumber()));
            leftCell.addElement(spacer(4));
            leftCell.addElement(label("ACCOUNT NUMBER"));
            leftCell.addElement(sub(accountNo));
            infoTable.addCell(leftCell);

            PdfPCell rightCell = surfaceCell();
            rightCell.addElement(label("STATEMENT PERIOD"));
            rightCell.addElement(value(period));
            rightCell.addElement(spacer(4));
            rightCell.addElement(label("GENERATED ON"));
            rightCell.addElement(sub(LocalDateTime.now().format(STAMP_FMT)));
            rightCell.addElement(spacer(4));
            rightCell.addElement(label("CURRENCY"));
            rightCell.addElement(sub("Ghana Cedi (GHS)"));
            rightCell.addElement(spacer(4));
            rightCell.addElement(label("KYC STATUS"));
            rightCell.addElement(sub(user.getKycStatus().name().replace("_", " ")));
            infoTable.addCell(rightCell);

            document.add(infoTable);

            // ── Summary tiles ─────────────────────────────────────────────
            PdfPTable summary = new PdfPTable(4);
            summary.setWidthPercentage(100);
            summary.setSpacingAfter(20);
            addSummaryTile(summary, "OPENING BALANCE", openingBal, AZA_TEXT, false);
            addSummaryTile(summary, "TOTAL CREDITS",   totalCredits, CREDIT_GRN, false);
            addSummaryTile(summary, "TOTAL DEBITS",    totalDebits, DEBIT_RED, false);
            addSummaryTile(summary, "CLOSING BALANCE", closingBal, AZA_TEXT, true);
            document.add(summary);

            // ── Transaction table (monthly grouped) ───────────────────────
            if (txs.isEmpty()) {
                Paragraph none = new Paragraph("No transactions found in this period.",
                        FontFactory.getFont(FontFactory.HELVETICA, 10, AZA_MUTED));
                none.setAlignment(Element.ALIGN_CENTER);
                none.setSpacingBefore(20);
                document.add(none);
            } else {
                PdfPTable table = buildTransactionTable(txs, user, openingBal, closingBal);
                document.add(table);
            }

            // ── Spending insights ─────────────────────────────────────────
            if (!txs.isEmpty()) {
                document.add(new Paragraph(" "));
                document.add(buildInsightsSection(txs, user, totalDebits, totalCredits));
            }

            // ── Verification block ────────────────────────────────────────
            document.add(spacer(12));
            document.add(buildVerificationBlock(verifyCode, verifyUrl, txs.size(),
                    totalDebits, totalCredits, closingBal));

            // ── Legal disclaimer ──────────────────────────────────────────
            Paragraph disc = new Paragraph(
                    "This statement has been generated by AZA Financial Technology Ltd and covers completed transactions only. " +
                    "Pending, failed, or reversed transactions are excluded. AZA Financial Technology Ltd is licensed by the " +
                    "Under the Payment Systems and Services Act, 2019 (Act 987). For queries contact support@aza.systems.",
                    FontFactory.getFont(FontFactory.HELVETICA, 7.5f, AZA_MUTED));
            disc.setSpacingBefore(16);
            document.add(disc);

            document.close();

        } catch (DocumentException e) {
            throw new AppException("Error generating PDF", e);
        }

        // Persist a record so the verification URL resolves
        statementRepository.findByVerifyCode(verifyCode).ifPresentOrElse(
                existing -> { /* already stored — same inputs produce the same hash */ },
                () -> statementRepository.save(GeneratedStatement.builder()
                        .verifyCode(verifyCode)
                        .userId(user.getId())
                        .accountHolderName(fullName)
                        .accountNumber(accountNo)
                        .periodStart(start)
                        .periodEnd(end)
                        .transactionCount(txs.size())
                        .openingBalance(openingBal)
                        .totalCredits(totalCredits)
                        .totalDebits(totalDebits)
                        .closingBalance(closingBal)
                        .build()));

        return out.toByteArray();
    }

    // ── Transaction table with monthly grouping ───────────────────────────────

    private PdfPTable buildTransactionTable(List<Transaction> txs, User user,
                                             BigDecimal openingBal, BigDecimal closingBal) throws DocumentException {
        PdfPTable table = new PdfPTable(6);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{2.1f, 2.4f, 4.6f, 2.0f, 2.0f, 2.1f});
        table.setHeaderRows(1);

        // Column headers (dark band)
        for (String h : new String[]{"DATE", "REFERENCE", "DESCRIPTION", "DEBIT (GHS)", "CREDIT (GHS)", "BALANCE (GHS)"}) {
            PdfPCell hc = new PdfPCell(new Phrase(h,
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, AZA_GREEN)));
            hc.setBackgroundColor(AZA_DARK);
            hc.setPadding(8);
            hc.setBorder(Rectangle.NO_BORDER);
            table.addCell(hc);
        }

        // Build lookup caches
        Map<UUID, String> nameCache   = new HashMap<>();
        Map<UUID, String> handleCache = new HashMap<>();

        BigDecimal running = openingBal;
        String     curMonth = null;
        BigDecimal monthDebits  = BigDecimal.ZERO;
        BigDecimal monthCredits = BigDecimal.ZERO;
        boolean alt = false;

        for (Transaction tx : txs) {
            LocalDateTime txDate = tx.getInitiatedAt() != null ? tx.getInitiatedAt() : tx.getCompletedAt();
            String txMonth = txDate.format(MONTH_FMT);

            // Month subheader when month changes
            if (!txMonth.equals(curMonth)) {
                if (curMonth != null) {
                    // Subtotal row for previous month
                    addMonthSubtotal(table, curMonth, monthDebits, monthCredits);
                    monthDebits  = BigDecimal.ZERO;
                    monthCredits = BigDecimal.ZERO;
                    alt = false;
                }
                curMonth = txMonth;
                // Month header row spanning all 6 columns
                PdfPCell mh = new PdfPCell(new Phrase(txMonth.toUpperCase(),
                        FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, AZA_MUTED)));
                mh.setColspan(6);
                mh.setBackgroundColor(MONTH_BG);
                mh.setPadding(6);
                mh.setBorderColor(AZA_RULE);
                mh.setBorderWidthTop(0.5f);
                mh.setBorderWidthBottom(0.5f);
                mh.setBorderWidthLeft(0);
                mh.setBorderWidthRight(0);
                table.addCell(mh);
            }

            boolean isDebit = tx.getSenderId().equals(user.getId());
            if (isDebit) { running = running.subtract(tx.getAmount()); monthDebits  = monthDebits.add(tx.getAmount()); }
            else         { running = running.add(tx.getAmount());      monthCredits = monthCredits.add(tx.getAmount()); }

            Color rowBg = alt ? AZA_SURFACE : Color.WHITE;
            alt = !alt;

            String ref  = "AZA-" + tx.getId().toString().substring(0, 8).toUpperCase();
            String desc = buildDescription(tx, user, nameCache, handleCache);
            String type = txTypeLabel(tx);
            String fullDesc = type + " • " + desc;
            if (tx.getNote() != null && !tx.getNote().isBlank())
                fullDesc += "\n" + tx.getNote();

            addTxCell(table, txDate.format(DATE_FMT), rowBg, Element.ALIGN_LEFT, AZA_TEXT, false);
            addTxCell(table, ref, rowBg, Element.ALIGN_LEFT, AZA_MUTED, false);
            addTxCell(table, fullDesc, rowBg, Element.ALIGN_LEFT, AZA_TEXT, false);

            if (isDebit) {
                addTxCell(table, fmtAmt(tx.getAmount()), rowBg, Element.ALIGN_RIGHT, DEBIT_RED, true);
                addTxCell(table, "—", rowBg, Element.ALIGN_RIGHT, AZA_MUTED, false);
            } else {
                addTxCell(table, "—", rowBg, Element.ALIGN_RIGHT, AZA_MUTED, false);
                addTxCell(table, fmtAmt(tx.getAmount()), rowBg, Element.ALIGN_RIGHT, CREDIT_GRN, true);
            }
            addTxCell(table, fmtAmt(running), rowBg, Element.ALIGN_RIGHT, AZA_TEXT, true);
        }

        // Final month subtotal
        if (curMonth != null) {
            addMonthSubtotal(table, curMonth, monthDebits, monthCredits);
        }

        // Closing balance row
        for (int i = 0; i < 5; i++)
            table.addCell(borderlessCell("", AZA_DARK, Element.ALIGN_LEFT, AZA_GREEN, false));
        table.addCell(borderlessCell("CLOSING  " + fmtAmt(closingBal), AZA_DARK, Element.ALIGN_RIGHT, AZA_GREEN, true));

        return table;
    }

    private void addMonthSubtotal(PdfPTable table, String month, BigDecimal debits, BigDecimal credits) {
        // label spanning date+ref+desc
        PdfPCell lbl = new PdfPCell(new Phrase(month + " subtotal",
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, AZA_MUTED)));
        lbl.setColspan(3);
        lbl.setBackgroundColor(MONTH_BG);
        lbl.setPadding(6);
        lbl.setBorder(Rectangle.NO_BORDER);
        table.addCell(lbl);

        PdfPCell dr = new PdfPCell(new Phrase(fmtAmt(debits),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, DEBIT_RED)));
        dr.setBackgroundColor(MONTH_BG);
        dr.setPadding(6);
        dr.setHorizontalAlignment(Element.ALIGN_RIGHT);
        dr.setBorder(Rectangle.NO_BORDER);
        table.addCell(dr);

        PdfPCell cr = new PdfPCell(new Phrase(fmtAmt(credits),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, CREDIT_GRN)));
        cr.setBackgroundColor(MONTH_BG);
        cr.setPadding(6);
        cr.setHorizontalAlignment(Element.ALIGN_RIGHT);
        cr.setBorder(Rectangle.NO_BORDER);
        table.addCell(cr);

        // net
        BigDecimal net = credits.subtract(debits);
        Color netColor = net.compareTo(BigDecimal.ZERO) >= 0 ? CREDIT_GRN : DEBIT_RED;
        PdfPCell nc = new PdfPCell(new Phrase((net.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "") + fmtAmt(net),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, netColor)));
        nc.setBackgroundColor(MONTH_BG);
        nc.setPadding(6);
        nc.setHorizontalAlignment(Element.ALIGN_RIGHT);
        nc.setBorder(Rectangle.NO_BORDER);
        table.addCell(nc);
    }

    // ── Spending insights ─────────────────────────────────────────────────────

    private PdfPTable buildInsightsSection(List<Transaction> txs, User user,
                                            BigDecimal totalDebits, BigDecimal totalCredits) {
        PdfPTable section = new PdfPTable(1);
        section.setWidthPercentage(100);

        // Section header
        PdfPCell header = new PdfPCell(new Phrase("SPENDING INSIGHTS",
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, AZA_GREEN)));
        header.setBackgroundColor(AZA_DARK);
        header.setPadding(10);
        header.setBorder(Rectangle.NO_BORDER);
        section.addCell(header);

        // Build inner 2-column layout
        PdfPTable inner = new PdfPTable(2);
        inner.setWidthPercentage(100);

        // Left column: summary stats
        PdfPCell leftCol = new PdfPCell();
        leftCol.setBorder(Rectangle.NO_BORDER);
        leftCol.setPadding(12);
        leftCol.setBackgroundColor(AZA_SURFACE);

        long debitCount  = txs.stream().filter(t -> t.getSenderId().equals(user.getId())).count();
        long creditCount = txs.stream().filter(t -> t.getRecipientId().equals(user.getId())).count();
        BigDecimal avgTx = txs.isEmpty() ? BigDecimal.ZERO :
                txs.stream().map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(txs.size()), 2, RoundingMode.HALF_UP);

        Transaction largestDebit  = txs.stream().filter(t -> t.getSenderId().equals(user.getId()))
                .max(Comparator.comparing(Transaction::getAmount)).orElse(null);
        Transaction largestCredit = txs.stream().filter(t -> t.getRecipientId().equals(user.getId()))
                .max(Comparator.comparing(Transaction::getAmount)).orElse(null);

        leftCol.addElement(label("TRANSACTION COUNT"));
        leftCol.addElement(insightValue(String.valueOf(txs.size())));
        leftCol.addElement(insightMuted(debitCount + " sent  •  " + creditCount + " received"));
        leftCol.addElement(spacer(8));

        leftCol.addElement(label("AVERAGE TRANSACTION"));
        leftCol.addElement(insightValue("GHS " + fmtAmt(avgTx)));
        leftCol.addElement(spacer(8));

        if (largestDebit != null) {
            leftCol.addElement(label("LARGEST DEBIT"));
            leftCol.addElement(insightValue("GHS " + fmtAmt(largestDebit.getAmount())));
            LocalDateTime d = largestDebit.getInitiatedAt() != null ? largestDebit.getInitiatedAt() : largestDebit.getCompletedAt();
            leftCol.addElement(insightMuted(d.format(DATE_FMT)));
        }
        leftCol.addElement(spacer(8));

        if (largestCredit != null) {
            leftCol.addElement(label("LARGEST CREDIT"));
            leftCol.addElement(insightValue("GHS " + fmtAmt(largestCredit.getAmount())));
            LocalDateTime d = largestCredit.getInitiatedAt() != null ? largestCredit.getInitiatedAt() : largestCredit.getCompletedAt();
            leftCol.addElement(insightMuted(d.format(DATE_FMT)));
        }

        // Most active day
        txs.stream()
                .map(t -> (t.getInitiatedAt() != null ? t.getInitiatedAt() : t.getCompletedAt()).toLocalDate())
                .collect(Collectors.groupingBy(d -> d, Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .ifPresent(e -> {
                    leftCol.addElement(spacer(8));
                    leftCol.addElement(label("MOST ACTIVE DAY"));
                    leftCol.addElement(insightValue(e.getKey().format(DateTimeFormatter.ofPattern("dd MMM yyyy"))));
                    leftCol.addElement(insightMuted(e.getValue() + " transactions"));
                });

        inner.addCell(leftCol);

        // Right column: top 5 recipients
        PdfPCell rightCol = new PdfPCell();
        rightCol.setBorder(Rectangle.NO_BORDER);
        rightCol.setPadding(12);
        rightCol.setBackgroundColor(Color.WHITE);

        rightCol.addElement(label("TOP RECIPIENTS BY VOLUME"));
        rightCol.addElement(spacer(4));

        Map<UUID, BigDecimal> recipientTotals = txs.stream()
                .filter(t -> t.getSenderId().equals(user.getId()))
                .collect(Collectors.groupingBy(Transaction::getRecipientId,
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)));

        recipientTotals.entrySet().stream()
                .sorted(Map.Entry.<UUID, BigDecimal>comparingByValue().reversed())
                .limit(5)
                .forEach(e -> {
                    String name = resolveCounterpartyName(e.getKey());
                    PdfPTable row = new PdfPTable(2);
                    try { row.setWidths(new float[]{3f, 2f}); } catch (DocumentException ignored) {}
                    row.setWidthPercentage(100);
                    row.setSpacingAfter(4);
                    PdfPCell nc = new PdfPCell(new Phrase(name,
                            FontFactory.getFont(FontFactory.HELVETICA, 8.5f, AZA_TEXT)));
                    nc.setBorder(Rectangle.NO_BORDER);
                    nc.setPaddingBottom(5);
                    row.addCell(nc);
                    PdfPCell ac = new PdfPCell(new Phrase("GHS " + fmtAmt(e.getValue()),
                            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, DEBIT_RED)));
                    ac.setBorder(Rectangle.NO_BORDER);
                    ac.setHorizontalAlignment(Element.ALIGN_RIGHT);
                    row.addCell(ac);
                    rightCol.addElement(row);
                });

        if (recipientTotals.isEmpty()) {
            rightCol.addElement(insightMuted("No outgoing transfers in this period."));
        }

        inner.addCell(rightCol);

        PdfPCell innerWrapper = new PdfPCell(inner);
        innerWrapper.setBorder(Rectangle.NO_BORDER);
        innerWrapper.setPadding(0);
        section.addCell(innerWrapper);

        return section;
    }

    // ── Verification block ────────────────────────────────────────────────────

    private PdfPTable buildVerificationBlock(String verifyCode, String verifyUrl,
                                              int txCount, BigDecimal debits,
                                              BigDecimal credits, BigDecimal closing) {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        try { table.setWidths(new float[]{3f, 1f}); } catch (DocumentException ignored) {}

        // Left: verification text
        PdfPCell textCell = new PdfPCell();
        textCell.setBorder(Rectangle.BOX);
        textCell.setBorderColor(AZA_RULE);
        textCell.setBackgroundColor(AZA_SURFACE);
        textCell.setPadding(14);

        textCell.addElement(label("STATEMENT VERIFICATION"));
        textCell.addElement(spacer(2));
        textCell.addElement(new Paragraph("Verification Code",
                FontFactory.getFont(FontFactory.HELVETICA, 8, AZA_MUTED)));

        // Formatted verify code: XXXX-XXXX-XXXX-XXXX
        String formatted = verifyCode.substring(0, 4) + "-" + verifyCode.substring(4, 8)
                + "-" + verifyCode.substring(8, 12) + "-" + verifyCode.substring(12, 16);
        textCell.addElement(new Paragraph(formatted,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, AZA_DARK)));
        textCell.addElement(spacer(6));
        textCell.addElement(new Paragraph(
                "Scan the QR code or visit aza.systems/verify to confirm this statement is authentic. " +
                "The code is derived from the account, period, " + txCount + " transaction(s), " +
                "total debits GHS " + fmtAmt(debits) + ", credits GHS " + fmtAmt(credits) +
                ", and closing balance GHS " + fmtAmt(closing) + ".",
                FontFactory.getFont(FontFactory.HELVETICA, 8, AZA_MUTED)));
        table.addCell(textCell);

        // Right: QR code
        PdfPCell qrCell = new PdfPCell();
        qrCell.setBorder(Rectangle.BOX);
        qrCell.setBorderColor(AZA_RULE);
        qrCell.setBackgroundColor(Color.WHITE);
        qrCell.setPadding(10);
        qrCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        qrCell.setHorizontalAlignment(Element.ALIGN_CENTER);

        try {
            byte[] qrBytes = generateQr(verifyUrl, 110);
            Image qr = Image.getInstance(qrBytes);
            qr.setAlignment(Image.ALIGN_CENTER);
            qrCell.addElement(qr);
        } catch (Exception ignored) {
            qrCell.addElement(new Paragraph("QR unavailable", FontFactory.getFont(FontFactory.HELVETICA, 7, AZA_MUTED)));
        }
        table.addCell(qrCell);

        return table;
    }

    // ── CSV ───────────────────────────────────────────────────────────────────

    public byte[] generateStatementCsv(User user, LocalDateTime start, LocalDateTime end) {
        List<Transaction> txs = transactionRepository.findAllByUserIdAndDateRange(user.getId(), start, end);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Map<UUID, String> nameCache   = new HashMap<>();
        Map<UUID, String> handleCache = new HashMap<>();
        try (OutputStreamWriter w = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
            w.write("AZA Account Statement\n");
            w.write("Account Holder: " + user.getFirstName() + " " + user.getLastName() + "\n");
            w.write("Account Number: " + formatAccountNo(user.getId()) + "\n");
            w.write("Period: " + start.format(DATE_FMT) + " to " + end.format(DATE_FMT) + "\n\n");
            w.write("Date,Reference,Type,Description,Debit (GHS),Credit (GHS),Note,Status\n");
            for (Transaction tx : txs) {
                boolean debit = tx.getSenderId().equals(user.getId());
                String ref   = "AZA-" + tx.getId().toString().substring(0, 8).toUpperCase();
                String desc  = buildDescription(tx, user, nameCache, handleCache);
                LocalDateTime dt = tx.getInitiatedAt() != null ? tx.getInitiatedAt() : tx.getCompletedAt();
                w.write(String.format("%s,%s,%s,\"%s\",%s,%s,\"%s\",%s\n",
                        dt.format(fmt), ref, txTypeLabel(tx),
                        desc.replace("\"", "\"\""),
                        debit  ? tx.getAmount().toPlainString() : "",
                        !debit ? tx.getAmount().toPlainString() : "",
                        tx.getNote() != null ? tx.getNote().replace("\"", "\"\"") : "",
                        tx.getStatus().name()));
            }
        } catch (Exception e) {
            throw new RuntimeException("Error generating CSV", e);
        }
        return out.toByteArray();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildDescription(Transaction tx, User user,
                                    Map<UUID, String> nameCache,
                                    Map<UUID, String> handleCache) {
        if (tx.getSenderId().equals(user.getId())) {
            String name   = resolveName(tx.getRecipientId(), nameCache);
            String handle = resolveHandle(tx.getRecipientId(), handleCache);
            return "To " + name + (handle != null ? " (" + handle + ")" : "");
        } else {
            String name   = resolveName(tx.getSenderId(), nameCache);
            String handle = resolveHandle(tx.getSenderId(), handleCache);
            return "From " + name + (handle != null ? " (" + handle + ")" : "");
        }
    }

    private String resolveName(UUID id, Map<UUID, String> cache) {
        return cache.computeIfAbsent(id, k -> {
            Optional<User> u = userRepository.findById(k);
            if (u.isPresent()) return trim(u.get().getFirstName()) + " " + trim(u.get().getLastName());
            return merchantRepository.findById(k)
                    .map(Merchant::getBusinessName)
                    .orElse("Unknown");
        });
    }

    private String resolveHandle(UUID id, Map<UUID, String> cache) {
        return cache.computeIfAbsent(id, k -> {
            Optional<User> u = userRepository.findById(k);
            if (u.isPresent()) return u.get().getUsername() != null ? "@" + u.get().getUsername() : null;
            return merchantRepository.findById(k)
                    .map(m -> "@" + m.getBusinessHandle())
                    .orElse(null);
        });
    }

    private String resolveCounterpartyName(UUID id) {
        return userRepository.findById(id)
                .map(u -> trim(u.getFirstName()) + " " + trim(u.getLastName()))
                .orElseGet(() -> merchantRepository.findById(id)
                        .map(Merchant::getBusinessName)
                        .orElse("Unknown"));
    }

    private static String txTypeLabel(Transaction tx) {
        return switch (tx.getType()) {
            case REQUEST  -> "Money Request";
            default       -> "P2P Transfer";
        };
    }

    private static String formatAccountNo(java.util.UUID id) {
        String hex = id.toString().replace("-", "").toUpperCase().substring(0, 10);
        return "AZA-" + hex.substring(0, 5) + "-" + hex.substring(5, 10);
    }

    private static String stmtHash(User user, LocalDateTime start, LocalDateTime end,
                                    int txCount, BigDecimal closing) {
        try {
            String raw = user.getId() + "|" + start + "|" + end + "|" + txCount + "|" + closing.toPlainString();
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return Long.toHexString(System.currentTimeMillis());
        }
    }

    private static byte[] generateQr(String content, int size) throws Exception {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
        hints.put(EncodeHintType.MARGIN, 1);
        QRCodeWriter writer = new QRCodeWriter();
        BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size, hints);
        ByteArrayOutputStream qrOut = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", qrOut);
        return qrOut.toByteArray();
    }

    private byte[] loadLogoBytes() {
        try (InputStream is = getClass().getResourceAsStream("/static/images/aza.png")) {
            return is != null ? is.readAllBytes() : null;
        } catch (IOException e) { return null; }
    }

    private static BigDecimal sum(List<BigDecimal> list) {
        return list.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String fmtAmt(BigDecimal v) {
        if (v == null) return "0.00";
        return v.setScale(2, RoundingMode.HALF_UP)
                .toPlainString()
                .replaceAll("(\\d)(?=(\\d{3})+\\.)", "$1,");
    }

    private static String trim(String s) { return s != null ? s.trim() : ""; }

    // ── Cell / element builders ───────────────────────────────────────────────

    private static PdfPCell surfaceCell() {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.BOX);
        c.setBorderColor(AZA_RULE);
        c.setBackgroundColor(AZA_SURFACE);
        c.setPadding(14);
        return c;
    }

    private static void addSummaryTile(PdfPTable t, String heading, BigDecimal amount,
                                        Color amtColor, boolean highlight) {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.BOX);
        c.setBorderColor(highlight ? AZA_GREEN : AZA_RULE);
        c.setBackgroundColor(highlight ? AZA_DARK : Color.WHITE);
        c.setPadding(12);
        c.setPaddingBottom(14);
        Paragraph lbl = new Paragraph(heading,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7, highlight ? AZA_GREEN : AZA_MUTED));
        lbl.setSpacingAfter(4);
        c.addElement(lbl);
        c.addElement(new Paragraph(fmtAmt(amount),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, highlight ? AZA_GREEN : amtColor)));
        t.addCell(c);
    }

    private static void addTxCell(PdfPTable t, String text, Color bg, int align, Color color, boolean bold) {
        Font f = bold ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, color)
                      : FontFactory.getFont(FontFactory.HELVETICA, 8.5f, color);
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setBackgroundColor(bg);
        c.setPadding(6);
        c.setPaddingTop(7);
        c.setPaddingBottom(7);
        c.setHorizontalAlignment(align);
        c.setBorderColor(AZA_RULE);
        c.setBorderWidthTop(0);
        c.setBorderWidthLeft(0);
        c.setBorderWidthRight(0);
        c.setBorderWidthBottom(0.3f);
        t.addCell(c);
    }

    private static PdfPCell borderlessCell(String text, Color bg, int align, Color color, boolean bold) {
        Font f = bold ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, color)
                      : FontFactory.getFont(FontFactory.HELVETICA, 8.5f, color);
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setBackgroundColor(bg);
        c.setPadding(8);
        c.setHorizontalAlignment(align);
        c.setBorder(Rectangle.NO_BORDER);
        return c;
    }

    private static Paragraph label(String t) {
        Paragraph p = new Paragraph(t, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, AZA_MUTED));
        p.setSpacingBefore(4);
        return p;
    }

    private static Paragraph value(String t) {
        return new Paragraph(t, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, AZA_TEXT));
    }

    private static Paragraph sub(String t) {
        return new Paragraph(t, FontFactory.getFont(FontFactory.HELVETICA, 9, AZA_MUTED));
    }

    private static Paragraph insightValue(String t) {
        return new Paragraph(t, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, AZA_TEXT));
    }

    private static Paragraph insightMuted(String t) {
        return new Paragraph(t, FontFactory.getFont(FontFactory.HELVETICA, 8, AZA_MUTED));
    }

    private static Paragraph spacer(int pts) {
        Paragraph p = new Paragraph(" ");
        p.setSpacingBefore(pts);
        return p;
    }
}
