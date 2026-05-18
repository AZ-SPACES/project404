package com.aza.backend.service;

import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StatementService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public byte[] generateStatementPdf(User user, LocalDateTime start, LocalDateTime end) {
        List<Transaction> transactions = transactionRepository.findAllByUserIdAndDateRange(user.getId(), start, end);

        Document document = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Font styles
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.BLACK);
            Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 12, Color.DARK_GRAY);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            // Header
            Paragraph title = new Paragraph("AZA ACCOUNT STATEMENT", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            Paragraph userInfo = new Paragraph(
                    "Name: " + user.getFirstName() + " " + user.getLastName() + "\n" +
                    "Email: " + user.getEmail() + "\n" +
                    "Period: " + start.format(DateTimeFormatter.ofPattern("MMM dd, yyyy")) + " - " +
                    end.format(DateTimeFormatter.ofPattern("MMM dd, yyyy")) + "\n\n",
                    subTitleFont
            );
            document.add(userInfo);

            // Table
            PdfPTable table = new PdfPTable(5);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2.5f, 3.5f, 2.5f, 2f, 2f});

            // Table Header
            String[] headers = {"Date", "Description", "Type", "Amount", "Status"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, headerFont));
                cell.setBackgroundColor(new Color(31, 41, 55)); // Dark gray
                cell.setPadding(8);
                table.addCell(cell);
            }

            // Table Body
            for (Transaction tx : transactions) {
                table.addCell(new PdfPCell(new Phrase(tx.getInitiatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")), bodyFont)));
                
                String description;
                if (tx.getSenderId().equals(user.getId())) {
                    User recipient = userRepository.findById(tx.getRecipientId()).orElse(null);
                    description = "To: " + (recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown");
                } else {
                    User sender = userRepository.findById(tx.getSenderId()).orElse(null);
                    description = "From: " + (sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown");
                }
                table.addCell(new PdfPCell(new Phrase(description, bodyFont)));
                
                table.addCell(new PdfPCell(new Phrase(tx.getType().name(), bodyFont)));
                
                String amountPrefix = tx.getSenderId().equals(user.getId()) ? "-" : "+";
                table.addCell(new PdfPCell(new Phrase(amountPrefix + "GHS " + tx.getAmount().toString(), bodyFont)));
                
                table.addCell(new PdfPCell(new Phrase(tx.getStatus().name(), bodyFont)));
            }

            document.add(table);
            document.close();

        } catch (DocumentException e) {
            throw new RuntimeException("Error generating PDF", e);
        }

        return out.toByteArray();
    }
}
