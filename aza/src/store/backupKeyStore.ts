/**
 * Holds the chat-backup recovery key in the device keychain so backups can
 * run without retyping the code. The key never leaves SecureStore — losing
 * every device means the recovery code the user wrote down is the only way
 * back into the backup.
 */
import * as SecureStore from 'expo-secure-store';
import { base64ToBytes, bytesToBase64 } from '../crypto/codec';

const KEY = (uid: string) => `aza_backup_key_${uid}`;
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getBackupKey(userId: string): Promise<Uint8Array | null> {
  const b64 = await SecureStore.getItemAsync(KEY(userId), OPTS);
  return b64 ? base64ToBytes(b64) : null;
}

export async function setBackupKey(userId: string, key: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(KEY(userId), bytesToBase64(key), OPTS);
}

export async function clearBackupKey(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(KEY(userId), OPTS);
}
