package com.aza.backend.service;

import com.aza.backend.entity.ChatBackup;
import com.aza.backend.entity.ChatBackupChunk;
import com.aza.backend.entity.HistoryTransfer;
import com.aza.backend.entity.HistoryTransferChunk;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.ChatBackupChunkRepository;
import com.aza.backend.repository.ChatBackupRepository;
import com.aza.backend.repository.HistoryTransferChunkRepository;
import com.aza.backend.repository.HistoryTransferRepository;
import com.aza.backend.repository.UserKeyBundleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * E2EE-preserving chat history sync.
 *
 * Device-to-device transfers move history from an existing device to a newly
 * linked one; encrypted backups let a user restore history with a recovery
 * key when no old device is available. In both paths the payload chunks are
 * encrypted client-side — this service only stores and relays opaque blobs.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HistorySyncService {

    /** Transfers are short-lived: the user is actively linking a device. */
    private static final int TRANSFER_TTL_MINUTES = 30;
    /** ~1 MB of base64 per chunk keeps request sizes comfortable. */
    private static final int MAX_CHUNK_CHARS = 1_400_000;
    private static final int MAX_CHUNKS = 500;

    private final HistoryTransferRepository transferRepository;
    private final HistoryTransferChunkRepository transferChunkRepository;
    private final ChatBackupRepository backupRepository;
    private final ChatBackupChunkRepository backupChunkRepository;
    private final UserKeyBundleRepository keyBundleRepository;

    // ── Device-to-device transfers ───────────────────────────────────────────

    @Transactional
    public HistoryTransfer requestTransfer(UUID userId, String requestingDeviceId) {
        requireOwnDevice(userId, requestingDeviceId);

        // One live request per device — re-requesting supersedes the old one.
        List<HistoryTransfer> existing = transferRepository
                .findByUserIdAndRequestingDeviceIdAndStatusIn(userId, requestingDeviceId,
                        List.of(HistoryTransfer.Status.PENDING,
                                HistoryTransfer.Status.UPLOADING,
                                HistoryTransfer.Status.READY));
        transferRepository.deleteAll(existing);

        HistoryTransfer transfer = HistoryTransfer.builder()
                .userId(userId)
                .requestingDeviceId(requestingDeviceId)
                .status(HistoryTransfer.Status.PENDING)
                .expiresAt(LocalDateTime.now().plusMinutes(TRANSFER_TTL_MINUTES))
                .build();
        return transferRepository.save(transfer);
    }

    /** Pending requests another of the user's devices can serve (excludes the caller's own). */
    @Transactional(readOnly = true)
    public List<HistoryTransfer> pendingTransfers(UUID userId, String excludeDeviceId) {
        return transferRepository
                .findByUserIdAndStatusAndExpiresAtAfter(
                        userId, HistoryTransfer.Status.PENDING, LocalDateTime.now())
                .stream()
                .filter(t -> !t.getRequestingDeviceId().equals(excludeDeviceId))
                .toList();
    }

    @Transactional
    public HistoryTransfer acceptTransfer(UUID userId, UUID transferId, String sourceDeviceId) {
        requireOwnDevice(userId, sourceDeviceId);
        HistoryTransfer transfer = getOwned(userId, transferId);
        if (transfer.getStatus() != HistoryTransfer.Status.PENDING) {
            throw new AppException("TRANSFER_NOT_PENDING",
                    "This transfer was already claimed or has ended", HttpStatus.CONFLICT);
        }
        if (sourceDeviceId.equals(transfer.getRequestingDeviceId())) {
            throw new AppException("BAD_REQUEST",
                    "A device cannot serve its own history request", HttpStatus.BAD_REQUEST);
        }
        transfer.setSourceDeviceId(sourceDeviceId);
        transfer.setStatus(HistoryTransfer.Status.UPLOADING);
        return transferRepository.save(transfer);
    }

    @Transactional
    public HistoryTransfer declineTransfer(UUID userId, UUID transferId) {
        HistoryTransfer transfer = getOwned(userId, transferId);
        if (transfer.getStatus() == HistoryTransfer.Status.PENDING
                || transfer.getStatus() == HistoryTransfer.Status.UPLOADING) {
            transfer.setStatus(HistoryTransfer.Status.DECLINED);
            transferChunkRepository.deleteByTransferId(transferId);
            transferRepository.save(transfer);
        }
        return transfer;
    }

    @Transactional
    public void uploadTransferChunk(UUID userId, UUID transferId, String sourceDeviceId,
                                    int seq, String payload) {
        HistoryTransfer transfer = getOwned(userId, transferId);
        if (transfer.getStatus() != HistoryTransfer.Status.UPLOADING
                || !sourceDeviceId.equals(transfer.getSourceDeviceId())) {
            throw new AppException("TRANSFER_NOT_UPLOADING",
                    "This transfer is not accepting chunks from this device", HttpStatus.CONFLICT);
        }
        validateChunk(seq, payload);
        if (transferChunkRepository.countByTransferId(transferId) >= MAX_CHUNKS) {
            throw new AppException("TRANSFER_TOO_LARGE",
                    "Transfer exceeds the maximum size", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        transferChunkRepository.findByTransferIdAndSeq(transferId, seq)
                .ifPresent(transferChunkRepository::delete);
        transferChunkRepository.save(HistoryTransferChunk.builder()
                .transferId(transferId)
                .seq(seq)
                .payload(payload)
                .build());
    }

    @Transactional
    public HistoryTransfer completeTransferUpload(UUID userId, UUID transferId,
                                                  String sourceDeviceId, int chunkCount) {
        HistoryTransfer transfer = getOwned(userId, transferId);
        if (transfer.getStatus() != HistoryTransfer.Status.UPLOADING
                || !sourceDeviceId.equals(transfer.getSourceDeviceId())) {
            throw new AppException("TRANSFER_NOT_UPLOADING",
                    "This transfer is not being uploaded by this device", HttpStatus.CONFLICT);
        }
        long stored = transferChunkRepository.countByTransferId(transferId);
        if (stored != chunkCount) {
            throw new AppException("TRANSFER_INCOMPLETE",
                    "Stored chunk count does not match: expected " + chunkCount + ", have " + stored,
                    HttpStatus.CONFLICT);
        }
        transfer.setChunkCount(chunkCount);
        transfer.setStatus(HistoryTransfer.Status.READY);
        return transferRepository.save(transfer);
    }

    @Transactional(readOnly = true)
    public HistoryTransfer getTransfer(UUID userId, UUID transferId) {
        return getOwned(userId, transferId);
    }

    @Transactional(readOnly = true)
    public String downloadTransferChunk(UUID userId, UUID transferId,
                                        String requestingDeviceId, int seq) {
        HistoryTransfer transfer = getOwned(userId, transferId);
        if (transfer.getStatus() != HistoryTransfer.Status.READY
                || !requestingDeviceId.equals(transfer.getRequestingDeviceId())) {
            throw new AppException("TRANSFER_NOT_READY",
                    "This transfer is not ready for download by this device", HttpStatus.CONFLICT);
        }
        return transferChunkRepository.findByTransferIdAndSeq(transferId, seq)
                .map(HistoryTransferChunk::getPayload)
                .orElseThrow(() -> new AppException("CHUNK_NOT_FOUND",
                        "Chunk " + seq + " not found", HttpStatus.NOT_FOUND));
    }

    /** The requesting device confirms it has everything — blobs are deleted immediately. */
    @Transactional
    public void ackTransfer(UUID userId, UUID transferId, String requestingDeviceId) {
        HistoryTransfer transfer = getOwned(userId, transferId);
        if (!requestingDeviceId.equals(transfer.getRequestingDeviceId())) {
            throw new AppException("FORBIDDEN",
                    "Only the requesting device can acknowledge a transfer", HttpStatus.FORBIDDEN);
        }
        transferChunkRepository.deleteByTransferId(transferId);
        transfer.setStatus(HistoryTransfer.Status.COMPLETED);
        transferRepository.save(transfer);
    }

    // ── Encrypted backups ────────────────────────────────────────────────────

    @Transactional
    public ChatBackup beginBackup(UUID userId) {
        // Drop any abandoned staging uploads, keep the latest COMPLETED until finalize.
        backupRepository.findByUserId(userId).stream()
                .filter(b -> b.getStatus() == ChatBackup.Status.UPLOADING)
                .forEach(b -> {
                    backupChunkRepository.deleteByBackupId(b.getId());
                    backupRepository.delete(b);
                });
        return backupRepository.save(ChatBackup.builder()
                .userId(userId)
                .status(ChatBackup.Status.UPLOADING)
                .build());
    }

    @Transactional
    public void uploadBackupChunk(UUID userId, UUID backupId, int seq, String payload) {
        ChatBackup backup = backupRepository.findByIdAndUserId(backupId, userId)
                .orElseThrow(() -> new AppException("BACKUP_NOT_FOUND",
                        "Backup not found", HttpStatus.NOT_FOUND));
        if (backup.getStatus() != ChatBackup.Status.UPLOADING) {
            throw new AppException("BACKUP_NOT_UPLOADING",
                    "This backup is already finalized", HttpStatus.CONFLICT);
        }
        validateChunk(seq, payload);
        if (backupChunkRepository.countByBackupId(backupId) >= MAX_CHUNKS) {
            throw new AppException("BACKUP_TOO_LARGE",
                    "Backup exceeds the maximum size", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        backupChunkRepository.findByBackupIdAndSeq(backupId, seq)
                .ifPresent(backupChunkRepository::delete);
        backupChunkRepository.save(ChatBackupChunk.builder()
                .backupId(backupId)
                .seq(seq)
                .payload(payload)
                .build());
        backup.setSizeBytes(backup.getSizeBytes() + payload.length());
        backupRepository.save(backup);
    }

    /** Finalize: mark COMPLETED and delete every older backup so exactly one survives. */
    @Transactional
    public ChatBackup completeBackup(UUID userId, UUID backupId, int chunkCount) {
        ChatBackup backup = backupRepository.findByIdAndUserId(backupId, userId)
                .orElseThrow(() -> new AppException("BACKUP_NOT_FOUND",
                        "Backup not found", HttpStatus.NOT_FOUND));
        long stored = backupChunkRepository.countByBackupId(backupId);
        if (stored != chunkCount) {
            throw new AppException("BACKUP_INCOMPLETE",
                    "Stored chunk count does not match: expected " + chunkCount + ", have " + stored,
                    HttpStatus.CONFLICT);
        }
        backup.setChunkCount(chunkCount);
        backup.setStatus(ChatBackup.Status.COMPLETED);
        ChatBackup saved = backupRepository.save(backup);

        backupRepository.findByUserId(userId).stream()
                .filter(b -> !b.getId().equals(backupId))
                .forEach(b -> {
                    backupChunkRepository.deleteByBackupId(b.getId());
                    backupRepository.delete(b);
                });
        return saved;
    }

    @Transactional(readOnly = true)
    public ChatBackup latestBackup(UUID userId) {
        return backupRepository
                .findFirstByUserIdAndStatusOrderByUpdatedAtDesc(userId, ChatBackup.Status.COMPLETED)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public String downloadBackupChunk(UUID userId, UUID backupId, int seq) {
        ChatBackup backup = backupRepository.findByIdAndUserId(backupId, userId)
                .orElseThrow(() -> new AppException("BACKUP_NOT_FOUND",
                        "Backup not found", HttpStatus.NOT_FOUND));
        if (backup.getStatus() != ChatBackup.Status.COMPLETED) {
            throw new AppException("BACKUP_NOT_READY",
                    "This backup is not finalized", HttpStatus.CONFLICT);
        }
        return backupChunkRepository.findByBackupIdAndSeq(backupId, seq)
                .map(ChatBackupChunk::getPayload)
                .orElseThrow(() -> new AppException("CHUNK_NOT_FOUND",
                        "Chunk " + seq + " not found", HttpStatus.NOT_FOUND));
    }

    @Transactional
    public void deleteBackups(UUID userId) {
        backupRepository.findByUserId(userId).forEach(b -> {
            backupChunkRepository.deleteByBackupId(b.getId());
            backupRepository.delete(b);
        });
    }

    // ── Cleanup (called by scheduler) ────────────────────────────────────────

    @Transactional
    public int purgeExpiredTransfers() {
        return transferRepository.deleteExpired(LocalDateTime.now());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private HistoryTransfer getOwned(UUID userId, UUID transferId) {
        return transferRepository.findByIdAndUserId(transferId, userId)
                .orElseThrow(() -> new AppException("TRANSFER_NOT_FOUND",
                        "Transfer not found", HttpStatus.NOT_FOUND));
    }

    private void requireOwnDevice(UUID userId, String deviceId) {
        if (deviceId == null || deviceId.isBlank()
                || !keyBundleRepository.existsByUserIdAndDeviceId(userId, deviceId)) {
            throw new AppException("UNKNOWN_DEVICE",
                    "Device is not registered for this account", HttpStatus.FORBIDDEN);
        }
    }

    private void validateChunk(int seq, String payload) {
        if (seq < 0 || seq >= MAX_CHUNKS) {
            throw new AppException("BAD_REQUEST", "Invalid chunk sequence", HttpStatus.BAD_REQUEST);
        }
        if (payload == null || payload.isEmpty() || payload.length() > MAX_CHUNK_CHARS) {
            throw new AppException("BAD_REQUEST", "Invalid chunk payload", HttpStatus.BAD_REQUEST);
        }
    }
}
