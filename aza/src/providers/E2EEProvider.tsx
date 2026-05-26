/**
 * E2EEProvider — bootstraps the user's identity keypair, publishes the public
 * key bundle to the server on first run, and keeps the one-time pre-key supply
 * topped up. Must sit inside AuthProvider in the React tree.
 *
 * Other modules read the identity X25519 keypair via useE2EE() (for
 * encrypt/decrypt) and the safety-number for verification UI.
 */

import '../crypto/random';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ensureSignedPreKey,
  generateOneTimePreKeys,
  getOrCreateIdentityEd25519,
  getOrCreateIdentityX25519,
  KEYSTORE_INITIAL_OTPK_COUNT,
  otpkPrivateCount,
  wipeIdentity,
} from '../crypto/keystore';
import {
  bytesToBase64,
} from '../crypto/codec';
import {
  getKeyBundleStatus,
  getMe,
  replenishOneTimePreKeys,
  uploadKeyBundle,
} from '../services/api';
import { useAuth } from './AuthProvider';
import { safetyNumber } from '../crypto/e2ee';

type Identity = {
  userId: string;
  /** X25519 — encryption key (recipient-side ECDH). */
  identityPublicKey: Uint8Array;
  identityPrivateKey: Uint8Array;
  /** Ed25519 — signing key (used to sign prekeys, future identity rotations). */
  signingPublicKey: Uint8Array;
};

type E2EEContextValue = {
  ready: boolean;
  error: string | null;
  identity: Identity | null;
  /** Compute the human-readable verification code against a peer's identity pub key. */
  computeSafetyNumber: (peerPublicKey: Uint8Array) => string | null;
  /** Wipe local key material — call after successful logout. */
  reset: () => Promise<void>;
};

const E2EEContext = createContext<E2EEContextValue | undefined>(undefined);

/** OTPK threshold under which we replenish. The backend's `needsReplenishment` uses 10. */
const OTPK_REPLENISH_THRESHOLD = 10;
const OTPK_REPLENISH_BATCH = 25;

export const E2EEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken } = useAuth();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootstrappedFor = useRef<string | null>(null);

  // Bootstrap on login; teardown on logout.
  useEffect(() => {
    if (!userToken) {
      setIdentity(null);
      setReady(false);
      setError(null);
      bootstrappedFor.current = null;
      return;
    }
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);

        // Resolve current user id from /me. The id is the namespace under which
        // all key material is stored so we never cross accounts on a shared device.
        const meRes = await getMe();
        const userId: string | undefined =
          meRes.data?.data?.id ?? meRes.data?.id;
        if (!userId) throw new Error('Could not resolve current user id');
        if (cancelled) return;
        if (bootstrappedFor.current === userId) return;

        const idX = await getOrCreateIdentityX25519(userId);
        const idE = await getOrCreateIdentityEd25519(userId);

        // Decide whether we need to (re-)publish the bundle. The server's status
        // endpoint reports both presence and OPK count; if we've never published
        // or the server lost our bundle, push a fresh one.
        let status: { hasKeyBundle: boolean; opkCount: number };
        try {
          const sRes = await getKeyBundleStatus();
          status = sRes.data?.data ?? { hasKeyBundle: false, opkCount: 0 };
        } catch {
          status = { hasKeyBundle: false, opkCount: 0 };
        }

        if (!status.hasKeyBundle) {
          const spk = await ensureSignedPreKey(userId);
          const otpks = await generateOneTimePreKeys(userId, KEYSTORE_INITIAL_OTPK_COUNT);
          await uploadKeyBundle({
            identityPublicKey: bytesToBase64(idX.publicKey),
            signedPreKeyPublic: bytesToBase64(spk.publicKey),
            signedPreKeySignature: bytesToBase64(spk.signature),
            oneTimePreKeys: otpks.map((k) => ({
              keyId: k.keyId,
              publicKey: bytesToBase64(k.publicKey),
            })),
          });
        } else if (status.opkCount < OTPK_REPLENISH_THRESHOLD) {
          // Top up only — bundle already exists.
          const localCount = await otpkPrivateCount(userId);
          // Only generate as many as needed to refill to a healthy supply.
          // If local supply is lower than server's reported supply (e.g. fresh
          // reinstall), we'll regenerate the full batch.
          const need = Math.max(OTPK_REPLENISH_BATCH - status.opkCount, 0);
          if (need > 0) {
            const otpks = await generateOneTimePreKeys(userId, need);
            await replenishOneTimePreKeys(
              otpks.map((k) => ({
                keyId: k.keyId,
                publicKey: bytesToBase64(k.publicKey),
              })),
            );
          }
          // Surface a soft warning if local private supply drifts below server's count.
          if (localCount < status.opkCount) {
            console.warn(
              '[E2EE] Local OTPK private supply lower than server-reported count — ' +
                'private halves may have been lost on a reinstall. New sessions to this ' +
                'device may fail to derive keys until the bundle is rotated.',
            );
          }
        }

        if (cancelled) return;
        setIdentity({
          userId,
          identityPublicKey: idX.publicKey,
          identityPrivateKey: idX.privateKey,
          signingPublicKey: idE.publicKey,
        });
        bootstrappedFor.current = userId;
        setReady(true);
      } catch (e: any) {
        if (!cancelled) {
          console.error('[E2EE] bootstrap failed', e);
          setError(e?.message ?? 'E2EE setup failed');
          setReady(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userToken]);

  const computeSafetyNumber = useCallback(
    (peerPublicKey: Uint8Array) => {
      if (!identity) return null;
      return safetyNumber(identity.identityPublicKey, peerPublicKey);
    },
    [identity],
  );

  const reset = useCallback(async () => {
    if (identity) await wipeIdentity(identity.userId);
    setIdentity(null);
    setReady(false);
    bootstrappedFor.current = null;
  }, [identity]);

  const value = useMemo<E2EEContextValue>(
    () => ({ ready, error, identity, computeSafetyNumber, reset }),
    [ready, error, identity, computeSafetyNumber, reset],
  );

  return <E2EEContext.Provider value={value}>{children}</E2EEContext.Provider>;
};

export function useE2EE(): E2EEContextValue {
  const ctx = useContext(E2EEContext);
  if (!ctx) throw new Error('useE2EE must be used within E2EEProvider');
  return ctx;
}
