/**
 * Resolves a chat media message to a *renderable* local URI.
 *
 * E2EE media is stored as an opaque encrypted blob on Cloudinary, so it can't be
 * fed straight to <Image>/<Video>/the audio player. This hook downloads the blob,
 * decrypts it with the per-file key carried in the message envelope, writes the
 * plaintext to a cache file, and returns that `file://` URI.
 *
 * Legacy media (no `mediaSecret`) and already-local URIs (the sender's optimistic
 * copy) pass through unchanged. Decrypted files are cached by message id so each
 * blob is fetched + decrypted at most once per device.
 */
import { useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

import { decryptMedia } from '../crypto/mediaCrypto';
import { base64ToBytes, bytesToBase64 } from '../crypto/codec';

const CACHE_DIR = `${FileSystem.cacheDirectory ?? ''}azamedia/`;

export type DecryptedMedia = { uri: string | null; loading: boolean; error: boolean };

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

/** Resolve (and cache) the decrypted local file for an encrypted media message. */
export async function resolveDecryptedMedia(
  messageId: string,
  remoteUrl: string,
  secretB64: string,
): Promise<string> {
  await ensureCacheDir();
  const target = `${CACHE_DIR}${messageId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const cached = await FileSystem.getInfoAsync(target);
  if (cached.exists) return target;

  // Download the encrypted blob to a temp file, then read → decrypt → write.
  const tmp = `${CACHE_DIR}tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.enc`;
  try {
    await FileSystem.downloadAsync(remoteUrl, tmp);
    const b64 = await FileSystem.readAsStringAsync(tmp, { encoding: FileSystem.EncodingType.Base64 });
    const plain = decryptMedia(base64ToBytes(b64), base64ToBytes(secretB64));
    await FileSystem.writeAsStringAsync(target, bytesToBase64(plain), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return target;
  } finally {
    FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
  }
}

/** Remove a decrypted media file from the local cache (e.g. after view-once). */
export function purgeDecryptedMedia(messageId: string): void {
  const target = `${CACHE_DIR}${messageId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
}

/**
 * @param uri        remote (encrypted) URL, or a local file URI for legacy/optimistic media
 * @param secret     base64 per-file key; when absent the uri is returned as-is
 * @param messageId  stable id used as the decrypted-cache key
 */
export function useDecryptedMediaUri(
  uri: string | undefined,
  secret: string | undefined,
  messageId: string,
): DecryptedMedia {
  // No secret → legacy/plaintext media or a local optimistic file: use directly.
  const needsDecrypt = !!uri && !!secret && !uri.startsWith('file://') && !uri.startsWith(CACHE_DIR);
  const [state, setState] = useState<DecryptedMedia>(
    needsDecrypt ? { uri: null, loading: true, error: false } : { uri: uri ?? null, loading: false, error: false },
  );
  const lastKey = useRef<string>('');

  useEffect(() => {
    if (!needsDecrypt) {
      setState({ uri: uri ?? null, loading: false, error: false });
      return;
    }
    const key = `${messageId}|${uri}`;
    if (lastKey.current === key && state.uri) return;
    lastKey.current = key;

    let cancelled = false;
    setState({ uri: null, loading: true, error: false });
    resolveDecryptedMedia(messageId, uri!, secret!)
      .then((local) => { if (!cancelled) setState({ uri: local, loading: false, error: false }); })
      .catch((e) => {
        console.warn('[chat] media decrypt failed', e);
        if (!cancelled) setState({ uri: null, loading: false, error: true });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, secret, messageId, needsDecrypt]);

  return state;
}
