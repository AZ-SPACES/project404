/**
 * Local-only types used by the chat store + encrypted cache. Shared here so
 * encryptedMessageStore doesn't need to import the store (which would create
 * a cycle).
 */

export type LocalMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type LocalMessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'VOICE_NOTE';

/**
 * A decrypted, displayable message persisted in the local cache.
 *
 * `serverId` is the backend's UUID for the message. `clientId` is the
 * sender-side temporary id used for optimistic UI before the server ACKs.
 * Once we get a serverId, we keep the clientId so de-duplication still works
 * if the server later re-broadcasts the same message over WS.
 */
export type LocalMessage = {
  clientId: string;
  serverId?: string;
  chatId: string;
  senderId: string;
  isSelf: boolean;
  type: LocalMessageType;
  /** Decrypted plaintext for text messages, or caption for media. */
  text: string;
  /** Timestamp the server stamped; falls back to local time for pending sends. */
  timestamp: number;
  status: LocalMessageStatus;
  /** Set to non-null when a disappearing-message TTL is active. */
  expiresAt?: number | null;
  /** Set when the recipient consumed a view-once media item. */
  viewedAt?: number | null;
  /** Set when the sender edited the message. */
  editedAt?: number | null;
  /** True if the message has been tombstoned (sender deleted or expired). */
  isDeleted?: boolean;
  /** Cloudinary URL for media; encrypted at the file layer if media E2EE is enabled. */
  mediaKey?: string | null;
  /** Base64 per-file AES key for E2EE media, carried inside the message envelope.
   *  Present only for media sent in the encrypted format; null for legacy media. */
  mediaKeySecret?: string | null;
  /** UI-only: reply parent reference. */
  replyToId?: string | null;
  /** Was decryption successful? false means we hold ciphertext we can't read. */
  decryptOk: boolean;
};
