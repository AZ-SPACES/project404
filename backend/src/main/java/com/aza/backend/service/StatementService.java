package com.aza.backend.service;

import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import com.aza.backend.exception.AppException;

@Service
@RequiredArgsConstructor
public class StatementService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;

    // ── Brand colours ────────────────────────────────────────────────────────
    private static final Color AZA_DARK    = new Color(14,  15,  12);   // #0E0F0C
    private static final Color AZA_GREEN   = new Color(183, 238, 122);  // #B7EE7A
    private static final Color AZA_SURFACE = new Color(245, 247, 243);  // off-white tint
    private static final Color AZA_RULE    = new Color(220, 222, 218);  // hairline
    private static final Color AZA_TEXT    = new Color(30,  30,  28);   // near-black
    private static final Color AZA_MUTED   = new Color(100, 103,  96);  // muted label
    private static final Color DEBIT_RED   = new Color(185,  28,  28);  // #B91C1C
    private static final Color CREDIT_GRN  = new Color(21,  128,  61);  // #15803D

    private static final DateTimeFormatter DATE_FMT   = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter STAMP_FMT  = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");

    // ── Page event — header band + footer on every page ──────────────────────
    private static class PageHeader extends PdfPageEventHelper {
        private final String accountName;
        private final String period;
        private final String stmtRef;
        private final byte[] logoBytes;

        PageHeader(String accountName, String period, String stmtRef, byte[] logoBytes) {
            this.accountName = accountName;
            this.period      = period;
            this.stmtRef     = stmtRef;
            this.logoBytes   = logoBytes;
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb = writer.getDirectContent();
            Rectangle page   = document.getPageSize();
            float margin     = document.leftMargin();

            // ── dark header band ─────────────────────────────────────────────
            cb.saveState();
            cb.setColorFill(AZA_DARK);
            cb.rectangle(0, page.getHeight() - 72, page.getWidth(), 72);
            cb.fill();

            // green accent strip (bottom of header band)
            cb.setColorFill(AZA_GREEN);
            cb.rectangle(0, page.getHeight() - 74, page.getWidth(), 3);
            cb.fill();
            cb.restoreState();

            // logo
            try {
                if (logoBytes != null) {
                    Image logo = Image.getInstance(logoBytes);
                    logo.scaleToFit(80, 30);
                    logo.setAbsolutePosition(margin, page.getHeight() - 60);
                    cb.addImage(logo);
                }
            } catch (Exception ignored) {}

            // "ACCOUNT STATEMENT" title in header band
            ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                    new Phrase("ACCOUNT STATEMENT",
                            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, AZA_GREEN)),
                    page.getWidth() - margin, page.getHeight() - 38, 0);

            ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                    new Phrase("Ref: " + stmtRef + "   |   " + period,
                            FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(160, 163, 156))),
                    page.getWidth() - margin, page.getHeight() - 54, 0);

            // ── footer ───────────────────────────────────────────────────────
            int pageNum = writer.getPageNumber();
            ColumnText.showTextAligned(cb, Element.ALIGN_CENTER,
                    new Phrase("Page " + pageNum,
                            FontFactory.getFont(FontFactory.HELVETICA, 8, AZA_MUTED)),
                    page.getWidth() / 2f, 24, 0);

            ColumnText.showTextAligned(cb, Element.ALIGN_LEFT,
                    new Phrase("AZA Financial Technology  •  This statement is computer-generated and does not require a signature.",
                            FontFactory.getFont(FontFactory.HELVETICA, 7, AZA_MUTED)),
                    margin, 24, 0);

            // footer rule
            cb.saveState();
            cb.setColorStroke(AZA_RULE);
            cb.setLineWidth(0.5f);
            cb.moveTo(margin, 36);
            cb.lineTo(page.getWidth() - margin, 36);
            cb.stroke();
            cb.restoreState();
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public byte[] generateStatementPdf(User user, LocalDateTime start, LocalDateTime end) {
        List<Transaction> txs = transactionRepository.findAllByUserIdAndDateRange(user.getId(), start, end);

        // Summary figures
        BigDecimal totalDebits  = txs.stream()
                .filter(t -> t.getSenderId().equals(user.getId()))
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCredits = txs.stream()
                .filter(t -> t.getRecipientId().equals(user.getId()))
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Opening balance: current wallet balance minus net of everything after period end
        BigDecimal currentBalance = walletRepository.findByUserId(user.getId())
                .map(w -> w.getBalance())
                .orElse(BigDecimal.ZERO);
        BigDecimal sentAfter     = transactionRepository.getTotalSentAfter(user.getId(), end);
        BigDecimal receivedAfter = transactionRepository.getTotalReceivedAfter(user.getId(), end);
        BigDecimal closingBal    = currentBalance.subtract(receivedAfter).add(sentAfter);
        BigDecimal openingBal    = closingBal.subtract(totalCredits).add(totalDebits);

        // Statement reference
        String stmtRef  = "STMT-" + Long.toHexString(System.currentTimeMillis()).toUpperCase().substring(0, 8);
        String period   = start.format(DATE_FMT) + " – " + end.format(DATE_FMT);
        String fullName = trim(user.getFirstName()) + " " + trim(user.getLastName());

        // Logo bytes
        byte[] logoBytes = loadLogoBytes();

        Document document = new Document(PageSize.A4, 40, 40, 90, 50);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter writer = PdfWriter.getInstance(document, out);
            writer.setPageEvent(new PageHeader(fullName, period, stmtRef, logoBytes));
            document.open();

            // ── Account info block ──────────────────────────────────────────
            PdfPTable infoTable = new PdfPTable(2);
            infoTable.setWidthPercentage(100);
            infoTable.setSpacingBefore(8);
            infoTable.setSpacingAfter(18);

            // Left — account holder
            PdfPCell leftCell = new PdfPCell();
            leftCell.setBorder(Rectangle.BOX);
            leftCell.setBorderColor(AZA_RULE);
            leftCell.setBackgroundColor(AZA_SURFACE);
            leftCell.setPadding(14);

            leftCell.addElement(label("ACCOUNT HOLDER"));
            leftCell.addElement(value(fullName));
            if (user.getUsername() != null)
                leftCell.addElement(sub("@" + user.getUsername()));
            leftCell.addElement(sub(user.getEmail()));
            if (user.getPhoneNumber() != null)
                leftCell.addElement(sub(user.getPhoneNumber()));
            infoTable.addCell(leftCell);

            // Right — statement details
            PdfPCell rightCell = new PdfPCell();
            rightCell.setBorder(Rectangle.BOX);
            rightCell.setBorderColor(AZA_RULE);
            rightCell.setBackgroundColor(AZA_SURFACE);
            rightCell.setPadding(14);

            rightCell.addElement(label("STATEMENT PERIOD"));
            rightCell.addElement(value(period));
            rightCell.addElement(spacer(6));
            rightCell.addElement(label("GENERATED ON"));
            rightCell.addElement(sub(LocalDateTime.now().format(STAMP_FMT)));
            rightCell.addElement(spacer(4));
            rightCell.addElement(label("CURRENCY"));
            rightCell.addElement(sub("Ghana Cedi (GHS)"));
            infoTable.addCell(rightCell);

            document.add(infoTable);

            // ── Summary tiles ───────────────────────────────────────────────
            PdfPTable summaryTable = new PdfPTable(4);
            summaryTable.setWidthPercentage(100);
            summaryTable.setSpacingAfter(20);

            addSummaryTile(summaryTable, "OPENING BALANCE", openingBal, AZA_TEXT, false);
            addSummaryTile(summaryTable, "TOTAL CREDITS",   totalCredits, CREDIT_GRN, false);
            addSummaryTile(summaryTable, "TOTAL DEBITS",    totalDebits, DEBIT_RED, false);
            addSummaryTile(summaryTable, "CLOSING BALANCE", closingBal, AZA_TEXT, true);

            document.add(summaryTable);

            // ── Transaction table ────────────────────────────────────────────
            if (txs.isEmpty()) {
                Paragraph none = new Paragraph("No transactions found in this period.",
                        FontFactory.getFont(FontFactory.HELVETICA, 10, AZA_MUTED));
                none.setAlignment(Element.ALIGN_CENTER);
                none.setSpacingBefore(20);
                document.add(none);
            } else {
                PdfPTable table = new PdfPTable(6);
                table.setWidthPercentage(100);
                table.setWidths(new float[]{2.2f, 2.6f, 4.2f, 2.0f, 2.0f, 2.2f});
                table.setHeaderRows(1);

                // Column headers
                String[] headers = {"DATE", "REFERENCE", "DESCRIPTION", "DEBIT (GHS)", "CREDIT (GHS)", "BALANCE (GHS)"};
                for (String h : headers) {
                    PdfPCell hc = new PdfPCell(new Phrase(h,
                            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, AZA_GREEN)));
                    hc.setBackgroundColor(AZA_DARK);
                    hc.setPadding(8);
                    hc.setBorder(Rectangle.NO_BORDER);
                    table.addCell(hc);
                }

                // Rows
                BigDecimal running = openingBal;
                boolean alt = false;
                for (Transaction tx : txs) {
                    boolean isDebit = tx.getSenderId().equals(user.getId());
                    if (isDebit) running = running.subtract(tx.getAmount());
                    else         running = running.add(tx.getAmount());

                    Color rowBg = alt ? AZA_SURFACE : Color.WHITE;
                    alt = !alt;

                    String ref  = "AZA-" + tx.getId().toString().substring(0, 8).toUpperCase();
                    String desc = buildDescription(tx, user);
                    if (tx.getNote() != null && !tx.getNote().isBlank())
                        desc += " – " + tx.getNote();

                    String dateStr = (tx.getInitiatedAt() != null ? tx.getInitiatedAt() : tx.getCompletedAt())
                            .format(DATE_FMT);

                    addTxCell(table, dateStr, rowBg, Element.ALIGN_LEFT, AZA_TEXT, false);
                    addTxCell(table, ref, rowBg, Element.ALIGN_LEFT, AZA_MUTED, false);
                    addTxCell(table, desc, rowBg, Element.ALIGN_LEFT, AZA_TEXT, false);

                    if (isDebit) {
                        addTxCell(table, fmtAmt(tx.getAmount()), rowBg, Element.ALIGN_RIGHT, DEBIT_RED, true);
                        addTxCell(table, "—", rowBg, Element.ALIGN_RIGHT, AZA_MUTED, false);
                    } else {
                        addTxCell(table, "—", rowBg, Element.ALIGN_RIGHT, AZA_MUTED, false);
                        addTxCell(table, fmtAmt(tx.getAmount()), rowBg, Element.ALIGN_RIGHT, CREDIT_GRN, true);
                    }
                    addTxCell(table, fmtAmt(running), rowBg, Element.ALIGN_RIGHT, AZA_TEXT, true);
                }

                // Closing balance row
                PdfPCell[] closingCells = new PdfPCell[6];
                for (int i = 0; i < 5; i++) {
                    closingCells[i] = borderlessCell("", AZA_DARK, Element.ALIGN_LEFT, AZA_GREEN, false);
                }
                closingCells[5] = borderlessCell("CLOSING  " + fmtAmt(closingBal), AZA_DARK, Element.ALIGN_RIGHT, AZA_GREEN, true);
                for (PdfPCell c : closingCells) table.addCell(c);

                document.add(table);
            }

            // ── Disclaimer ──────────────────────────────────────────────────
            Paragraph disc = new Paragraph(
                    "This statement has been generated by AZA Financial Technology and covers completed transactions only. " +
                    "Pending or reversed transactions may not be reflected. For queries, contact support@aza.systems.",
                    FontFactory.getFont(FontFactory.HELVETICA, 7.5f, AZA_MUTED));
            disc.setSpacingBefore(20);
            document.add(disc);

            document.close();

        } catch (DocumentException e) {
            throw new AppException("Error generating PDF", e);
        }

        return out.toByteArray();
    }

    // ── CSV (unchanged logic, header improved) ────────────────────────────────

    public byte[] generateStatementCsv(User user, LocalDateTime start, LocalDateTime end) {
        List<Transaction> txs = transactionRepository.findAllByUserIdAndDateRange(user.getId(), start, end);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (OutputStreamWriter writer = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
            writer.write("AZA Account Statement\n");
            writer.write("Account Holder: " + user.getFirstName() + " " + user.getLastName() + "\n");
            writer.write("Period: " + start.format(DATE_FMT) + " to " + end.format(DATE_FMT) + "\n\n");
            writer.write("Date,Reference,Description,Debit (GHS),Credit (GHS),Note,Status\n");
            for (Transaction tx : txs) {
                boolean debit = tx.getSenderId().equals(user.getId());
                String ref  = "AZA-" + tx.getId().toString().substring(0, 8).toUpperCase();
                String desc = buildDescription(tx, user);
                String date = (tx.getInitiatedAt() != null ? tx.getInitiatedAt() : tx.getCompletedAt()).format(fmt);
                writer.write(String.format("%s,%s,\"%s\",%s,%s,\"%s\",%s\n",
                        date, ref,
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

    private String buildDescription(Transaction tx, User user) {
        if (tx.getSenderId().equals(user.getId())) {
            User r = userRepository.findById(tx.getRecipientId()).orElse(null);
            String name = r != null ? trim(r.getFirstName()) + " " + trim(r.getLastName()) : "Unknown";
            return "Transfer to " + name;
        } else {
            User s = userRepository.findById(tx.getSenderId()).orElse(null);
            String name = s != null ? trim(s.getFirstName()) + " " + trim(s.getLastName()) : "Unknown";
            return "Transfer from " + name;
        }
    }

    private static String fmtAmt(BigDecimal v) {
        if (v == null) return "0.00";
        return v.setScale(2, RoundingMode.HALF_UP)
                .toPlainString()
                .replaceAll("(\\d)(?=(\\d{3})+\\.)", "$1,");
    }

    private static String trim(String s) { return s != null ? s.trim() : ""; }

    private byte[] loadLogoBytes() {
        try (InputStream is = getClass().getResourceAsStream("/static/images/aza.png")) {
            if (is == null) return null;
            return is.readAllBytes();
        } catch (IOException e) {
            return null;
        }
    }

    // ── Cell builders ─────────────────────────────────────────────────────────

    private static Paragraph label(String text) {
        Paragraph p = new Paragraph(text,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, AZA_MUTED));
        p.setSpacingBefore(4);
        return p;
    }

    private static Paragraph value(String text) {
        return new Paragraph(text,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, AZA_TEXT));
    }

    private static Paragraph sub(String text) {
        return new Paragraph(text,
                FontFactory.getFont(FontFactory.HELVETICA, 9, AZA_MUTED));
    }

    private static Paragraph spacer(int pts) {
        Paragraph p = new Paragraph(" ");
        p.setSpacingBefore(pts);
        return p;
    }

    private static void addSummaryTile(PdfPTable table, String heading, BigDecimal amount,
                                       Color amtColor, boolean highlight) {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.BOX);
        cell.setBorderColor(highlight ? AZA_GREEN : AZA_RULE);
        cell.setBackgroundColor(highlight ? AZA_DARK : Color.WHITE);
        cell.setPadding(12);
        cell.setPaddingBottom(14);

        Paragraph lbl = new Paragraph(heading,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7, highlight ? AZA_GREEN : AZA_MUTED));
        lbl.setSpacingAfter(4);
        cell.addElement(lbl);

        cell.addElement(new Paragraph(fmtAmt(amount),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, highlight ? AZA_GREEN : amtColor)));

        table.addCell(cell);
    }

    private static void addTxCell(PdfPTable table, String text, Color bg,
                                   int align, Color textColor, boolean bold) {
        Font f = bold
                ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, textColor)
                : FontFactory.getFont(FontFactory.HELVETICA, 8.5f, textColor);
        PdfPCell cell = new PdfPCell(new Phrase(text, f));
        cell.setBackgroundColor(bg);
        cell.setPadding(6);
        cell.setPaddingTop(7);
        cell.setPaddingBottom(7);
        cell.setHorizontalAlignment(align);
        cell.setBorderColor(AZA_RULE);
        cell.setBorderWidthTop(0);
        cell.setBorderWidthLeft(0);
        cell.setBorderWidthRight(0);
        cell.setBorderWidthBottom(0.3f);
        table.addCell(cell);
    }

    private static PdfPCell borderlessCell(String text, Color bg, int align, Color textColor, boolean bold) {
        Font f = bold
                ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, textColor)
                : FontFactory.getFont(FontFactory.HELVETICA, 8.5f, textColor);
        PdfPCell cell = new PdfPCell(new Phrase(text, f));
        cell.setBackgroundColor(bg);
        cell.setPadding(8);
        cell.setHorizontalAlignment(align);
        cell.setBorder(Rectangle.NO_BORDER);
        return cell;
    }
}
