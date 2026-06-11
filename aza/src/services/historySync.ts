/**
 * E2EE chat history sync — client side.
 *
 * Two paths onto a new device, both keeping the server blind:
 *   - Device-to-device transfer: the old device re-encrypts its decrypted
 *     local cache to the new device's identity key and relays it through the
 *     server as opaque chunks (deleted the moment the new device acks).
 *   - Encrypted backup: the cache is sealed with a random recovery key only
 *     the user holds and stored server-side until restored or deleted.
 */
import {
  requestHistoryTransfer,
  getHistoryTransfer,
  acceptHistoryTransfer,
  declineHistoryTransfer,
  uploadHistoryTransferChunk,
  completeHistoryTransfer,
  downloadHistoryTransferChunk,
  ackHistoryTransfer,
  getPendingHistoryTransfers,
  beginChatBackup,
  uploadChatBackupChunk,
  completeChatBackup,
  getChatBackupMeta,
  downloadChatBackupChunk,
  fetchOwnKeyBundles,
} from './api';
import { encryptForRecipient, decryptFromSender } from '../crypto/e2ee';
import { encryptBackupChunk, decryptBackupChunk } from '../crypto/backupCrypto';
import { base64ToBytes } from '../crypto/codec';
import { exportAllThreads, importThreads, loadCachedThread } from '../store/encryptedMessageStore';
import { useChatStore } from '../store/chatStore';
import type { LocalMessage } from '../store/chatTypes';

/** Plaintext slice size per chunk — well under the server's ~1 MB base64 cap. */
const CHUNK_CHARS = 600_000;
/** Domain-separates transfer envelopes from real chat messages. */
const transferContext = (transferId: string) => `history-transfer:${transferId}`;

export type SyncProgress = {
  phase: 'exporting' | 'uploading' | 'waiting' | 'downloading' | 'importing';
  done: number;
  total: number;
};
type OnProgress = (p: SyncProgress) => void;

type ExportBundle = { version: 1; threads: Record<string, LocalMessage[]> };

function sliceChunks(json: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK_CHARS) {
    chunks.push(json.slice(i, i + CHUNK_CHARS));
  }
  return chunks.length > 0 ? chunks : [''];
}

/** Pull freshly imported threads into the live store so open screens update. */
async function refreshStoreFromCache(userId: string, chatIds: string[]): Promise<void> {
  const state = useChatStore.getState();
  const updates: Record<string, LocalMessage[]> = {};
  for (const chatId of chatIds) {
    if (!state.messagesByChat[chatId]) continue; // not loaded — will read cache on open
    updates[chatId] = await loadCachedThread(userId, chatId);
  }
  if (Object.keys(updates).length > 0) {
    useChatStore.setState((s) => ({
      messagesByChat: { ...s.messagesByChat, ...updates },
    }));
  }
}

// ── Old device: serve a transfer ─────────────────────────────────────────────

export { getPendingHistoryTransfers, declineHistoryTransfer };

/**
 * Accept a pending transfer and upload this device's entire decrypted cache,
 * re-encrypted to the requesting device's identity key.
 */
export async function serveHistoryTransfer(
  transferId: string,
  requestingDeviceId: string,
  onProgress?: OnProgress,
): Promise<void> {
  const { selfUserId, selfDeviceId } = useChatStore.getState();
  if (!selfUserId || !selfDeviceId) throw new Error('Chat session not ready');

  // The requesting device's identity public key comes from our own bundle list.
  const { data } = await fetchOwnKeyBundles();
  const bundles: any[] = data?.data ?? [];
  const target = bundles.find((b) => b.deviceId === requestingDeviceId);
  if (!target?.identityPublicKey) {
    throw new Error('Requesting device has no registered key bundle');
  }
  const recipientKey = base64ToBytes(target.identityPublicKey);

  await acceptHistoryTransfer(transferId, selfDeviceId);

  onProgress?.({ phase: 'exporting', done: 0, total: 1 });
  const bundle: ExportBundle = { version: 1, threads: await exportAllThreads(selfUserId) };
  const chunks = sliceChunks(JSON.stringify(bundle));

  for (let seq = 0; seq < chunks.length; seq++) {
    onProgress?.({ phase: 'uploading', done: seq, total: chunks.length });
    const envelope = encryptForRecipient({
      plaintext: chunks[seq]!,
      recipientIdentityPublic: recipientKey,
      senderId: selfUserId,
      chatId: transferContext(transferId),
    });
    await uploadHistoryTransferChunk(transferId, selfDeviceId, seq, JSON.stringify(envelope));
  }
  await completeHistoryTransfer(transferId, selfDeviceId, chunks.length);
  onProgress?.({ phase: 'uploading', done: chunks.length, total: chunks.length });
}

// ── New device: request + apply ──────────────────────────────────────────────

/**
 * Ask the user's other devices for history, wait for one to serve it, then
 * decrypt and merge it into the local cache. Resolves with the number of
 * messages imported. Rejects if no device responds within the timeout or the
 * request is declined.
 */
export async function requestAndApplyHistory(
  onProgress?: OnProgress,
  timeoutMs = 5 * 60 * 1000,
): Promise<number> {
  const { selfUserId, selfDeviceId, selfIdentityPrivate } = useChatStore.getState();
  if (!selfUserId || !selfDeviceId || !selfIdentityPrivate) {
    throw new Error('Chat session not ready');
  }

  const { data } = await requestHistoryTransfer(selfDeviceId);
  const transferId: string = data?.data?.id;
  if (!transferId) throw new Error('Failed to create transfer request');

  // Poll until another device finishes uploading.
  const deadline = Date.now() + timeoutMs;
  let chunkCount = 0;
  for (;;) {
    onProgress?.({ phase: 'waiting', done: 0, total: 1 });
    const res = await getHistoryTransfer(transferId);
    const t = res.data?.data;
    if (t?.status === 'READY') {
      chunkCount = t.chunkCount ?? 0;
      break;
    }
    if (t?.status === 'DECLINED') throw new Error('Your other device declined the request');
    if (t?.status === 'EXPIRED' || Date.now() > deadline) {
      throw new Error('No device responded — make sure your other device has AZA open');
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  let json = '';
  for (let seq = 0; seq < chunkCount; seq++) {
    onProgress?.({ phase: 'downloading', done: seq, total: chunkCount });
    const res = await downloadHistoryTransferChunk(transferId, selfDeviceId, seq);
    const envelope = JSON.parse(res.data?.data?.payload ?? '{}');
    const plaintext = decryptFromSender({
      envelope,
      identityPrivateKey: selfIdentityPrivate,
      senderId: selfUserId,
      chatId: transferContext(transferId),
    });
    if (plaintext == null) throw new Error('Could not decrypt transfer — keys may have rotated');
    json += plaintext;
  }

  onProgress?.({ phase: 'importing', done: 0, total: 1 });
  const bundle = JSON.parse(json) as ExportBundle;
  if (bundle.version !== 1 || typeof bundle.threads !== 'object') {
    throw new Error('Transfer payload is malformed');
  }
  const imported = await importThreads(selfUserId, bundle.threads);
  await ackHistoryTransfer(transferId, selfDeviceId).catch(() => {});
  await refreshStoreFromCache(selfUserId, Object.keys(bundle.threads));
  return imported;
}

// ── Encrypted backups ────────────────────────────────────────────────────────

/** Seal the entire local cache with the recovery key and upload it. */
export async function createChatBackup(
  recoveryKey: Uint8Array,
  onProgress?: OnProgress,
): Promise<{ chunkCount: number; sizeBytes: number }> {
  const { selfUserId } = useChatStore.getState();
  if (!selfUserId) throw new Error('Chat session not ready');

  onProgress?.({ phase: 'exporting', done: 0, total: 1 });
  const bundle: ExportBundle = { version: 1, threads: await exportAllThreads(selfUserId) };
  const chunks = sliceChunks(JSON.stringify(bundle));

  const { data } = await beginChatBackup();
  const backupId: string = data?.data?.backupId;
  if (!backupId) throw new Error('Failed to start backup');

  let sizeBytes = 0;
  for (let seq = 0; seq < chunks.length; seq++) {
    onProgress?.({ phase: 'uploading', done: seq, total: chunks.length });
    const sealed = encryptBackupChunk(recoveryKey, seq, chunks[seq]!);
    sizeBytes += sealed.length;
    await uploadChatBackupChunk(backupId, seq, sealed);
  }
  await completeChatBackup(backupId, chunks.length);
  onProgress?.({ phase: 'uploading', done: chunks.length, total: chunks.length });
  return { chunkCount: chunks.length, sizeBytes };
}

/**
 * Download the latest backup, open it with the recovery key, and merge it
 * into the local cache. Resolves with the number of messages imported.
 */
export async function restoreChatBackup(
  recoveryKey: Uint8Array,
  onProgress?: OnProgress,
): Promise<number> {
  const { selfUserId } = useChatStore.getState();
  if (!selfUserId) throw new Error('Chat session not ready');

  const meta = await getChatBackupMeta();
  const m = meta.data?.data;
  if (!m?.exists) throw new Error('No backup found for this account');

  const backupId: string = m.backupId;
  const chunkCount: number = m.chunkCount ?? 0;

  let json = '';
  for (let seq = 0; seq < chunkCount; seq++) {
    onProgress?.({ phase: 'downloading', done: seq, total: chunkCount });
    const res = await downloadChatBackupChunk(backupId, seq);
    const plaintext = decryptBackupChunk(recoveryKey, seq, res.data?.data?.payload ?? '');
    if (plaintext == null) throw new Error('Wrong recovery key');
    json += plaintext;
  }

  onProgress?.({ phase: 'importing', done: 0, total: 1 });
  const bundle = JSON.parse(json) as ExportBundle;
  if (bundle.version !== 1 || typeof bundle.threads !== 'object') {
    throw new Error('Backup payload is malformed');
  }
  const imported = await importThreads(selfUserId, bundle.threads);
  await refreshStoreFromCache(selfUserId, Object.keys(bundle.threads));
  return imported;
}
