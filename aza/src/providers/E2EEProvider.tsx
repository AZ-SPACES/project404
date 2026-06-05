/**
 * E2EEProvider — bootstraps the user's per-device identity keypair, publishes
 * the public key bundle to the server, and keeps the OPK supply topped up.
 * Must sit inside AuthProvider in the React tree.
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
  isSignedPreKeyStale,
  KEYSTORE_INITIAL_OTPK_COUNT,
  otpkPrivateCount,
  purgeAllOneTimePreKeys,
  rotateSignedPreKey,
  wipeIdentity,
} from '../crypto/keystore';
import { bytesToBase64 } from '../crypto/codec';
import {
  getDeviceId,
  getKeyBundleStatus,
  getMe,
  replenishOneTimePreKeys,
  uploadKeyBundle,
} from '../services/api';
import { useAuth } from './AuthProvider';
import { safetyNumber } from '../crypto/e2ee';
import { useChatStore } from '../store/chatStore';
import { subscribeAuthEvents } from './authEvents';
import { extractErrorMessage } from '../utils/errorUtils';

type Identity = {
  userId: string;
  deviceId: string;
  identityPublicKey: Uint8Array;
  identityPrivateKey: Uint8Array;
  signingPublicKey: Uint8Array;
};

type E2EEContextValue = {
  ready: boolean;
  error: string | null;
  identity: Identity | null;
  computeSafetyNumber: (peerPublicKey: Uint8Array) => string | null;
  reset: () => Promise<void>;
};

const E2EEContext = createContext<E2EEContextValue | undefined>(undefined);

const OTPK_REPLENISH_THRESHOLD = 10;
const OTPK_REPLENISH_BATCH = 25;

export const E2EEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken } = useAuth();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootstrappedFor = useRef<string | null>(null);
  const [bootstrapNonce, setBootstrapNonce] = useState(0);

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

        const meRes = await getMe();
        const userId: string | undefined = meRes.data?.data?.id ?? meRes.data?.id;
        if (!userId) throw new Error('Could not resolve current user id');
        if (cancelled) return;

        const deviceId = await getDeviceId();
        const bootstrapKey = `${userId}:${deviceId}`;
        if (bootstrappedFor.current === bootstrapKey) return;

        const idX = await getOrCreateIdentityX25519(userId, deviceId);
        const idE = await getOrCreateIdentityEd25519(userId, deviceId);

        let status: { hasKeyBundle: boolean; opkCount: number };
        try {
          const sRes = await getKeyBundleStatus();
          status = sRes.data?.data ?? { hasKeyBundle: false, opkCount: 0 };
        } catch {
          status = { hasKeyBundle: false, opkCount: 0 };
        }

        const localOpkCount = await otpkPrivateCount(userId, deviceId);
        const driftDetected = status.hasKeyBundle && localOpkCount < status.opkCount;

        if (!status.hasKeyBundle || driftDetected) {
          if (driftDetected) {
            console.warn('[E2EE] Local OPK supply drifted — rotating bundle.');
            await purgeAllOneTimePreKeys(userId, deviceId);
          }
          const spk = await ensureSignedPreKey(userId, deviceId);
          const otpks = await generateOneTimePreKeys(userId, deviceId, KEYSTORE_INITIAL_OTPK_COUNT);
          await uploadKeyBundle({
            deviceId,
            identityPublicKey: bytesToBase64(idX.publicKey),
            signedPreKeyPublic: bytesToBase64(spk.publicKey),
            signedPreKeySignature: bytesToBase64(spk.signature),
            oneTimePreKeys: otpks.map((k) => ({
              keyId: k.keyId,
              publicKey: bytesToBase64(k.publicKey),
            })),
          });
        } else if (await isSignedPreKeyStale(userId, deviceId)) {
          console.warn('[E2EE] SPK is stale — rotating.');
          await purgeAllOneTimePreKeys(userId, deviceId);
          const spk = await rotateSignedPreKey(userId, deviceId);
          const otpks = await generateOneTimePreKeys(userId, deviceId, KEYSTORE_INITIAL_OTPK_COUNT);
          await uploadKeyBundle({
            deviceId,
            identityPublicKey: bytesToBase64(idX.publicKey),
            signedPreKeyPublic: bytesToBase64(spk.publicKey),
            signedPreKeySignature: bytesToBase64(spk.signature),
            oneTimePreKeys: otpks.map((k) => ({
              keyId: k.keyId,
              publicKey: bytesToBase64(k.publicKey),
            })),
          });
        } else if (status.opkCount < OTPK_REPLENISH_THRESHOLD) {
          const need = Math.max(OTPK_REPLENISH_BATCH - status.opkCount, 0);
          if (need > 0) {
            const otpks = await generateOneTimePreKeys(userId, deviceId, need);
            await replenishOneTimePreKeys(
              deviceId,
              otpks.map((k) => ({ keyId: k.keyId, publicKey: bytesToBase64(k.publicKey) })),
            );
          }
        }

        if (cancelled) return;
        setIdentity({ userId, deviceId, identityPublicKey: idX.publicKey, identityPrivateKey: idX.privateKey, signingPublicKey: idE.publicKey });
        useChatStore.getState().setSelfIdentity(userId, deviceId, idX.publicKey, idX.privateKey);
        bootstrappedFor.current = bootstrapKey;
        setReady(true);
      } catch (e: unknown) {
        if (!cancelled) {
          console.error('[E2EE] bootstrap failed', e);
          setError(extractErrorMessage(e, 'E2EE setup failed'));
          setReady(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [userToken, bootstrapNonce]);

  const computeSafetyNumber = useCallback(
    (peerPublicKey: Uint8Array) => {
      if (!identity) return null;
      return safetyNumber(identity.identityPublicKey, peerPublicKey);
    },
    [identity],
  );

  const reset = useCallback(async () => {
    const uid = identity?.userId;
    const did = identity?.deviceId;
    try { await useChatStore.getState().resetForLogout(); } catch {}
    if (uid && did) await wipeIdentity(uid, did);
    setIdentity(null);
    setReady(false);
    bootstrappedFor.current = null;
    setBootstrapNonce((n) => n + 1);
  }, [identity]);

  useEffect(() => {
    const unsub = subscribeAuthEvents((e) => {
      if (e.type === 'logout') {
        const uid = identity?.userId;
        const did = identity?.deviceId;
        Promise.resolve()
          .then(() => useChatStore.getState().resetForLogout())
          .catch(() => {})
          .then(() => (uid && did ? wipeIdentity(uid, did) : null))
          .catch(() => {})
          .finally(() => {
            setIdentity(null);
            setReady(false);
            bootstrappedFor.current = null;
          });
      }
    });
    return unsub;
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
