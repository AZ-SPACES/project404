import { useEffect, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useWallet } from './useWallet';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';
import {
  addWatchCommandListener,
  resolveWatchCommand,
  type WatchCommand,
} from '../../modules/aza-watch';
import {
  declineMoneyRequest,
  freezeWallet,
  respondToApp2faApproval,
} from '../services/api';

export type WatchCommandResult = { ok: boolean; message: string };

/**
 * Everything the wrist is allowed to change.
 *
 * The list is short on purpose and the rule for being on it is narrow: an action
 * qualifies only if performing it against the user's wishes cannot move money to
 * anyone or grant anyone access. Freeze, decline and deny all fail closed —
 * an attacker with your unlocked watch can inconvenience you and nothing more.
 *
 * The backend agrees without being asked to: none of these endpoints takes a
 * passcode, while `acceptMoneyRequest`, `approveChatPaymentRequest` and every
 * other approving counterpart does. If a future action needs a passcode, that is
 * the signal it does not belong here — not a problem to work around.
 *
 * Authorisation is still the server's job. `declineMoneyRequest` re-checks that
 * the caller is the payer and that the request is still pending; the watch is
 * merely a keyboard.
 */
export async function runWatchCommand(command: WatchCommand): Promise<WatchCommandResult> {
  switch (command.action) {
    case 'freezeWallet':
      await freezeWallet();
      return { ok: true, message: 'Wallet frozen' };

    case 'declineRequest':
      if (!command.id) return { ok: false, message: 'Nothing to decline' };
      await declineMoneyRequest(command.id);
      return { ok: true, message: 'Request declined' };

    case 'denyLogin':
      if (!command.id) return { ok: false, message: 'Nothing to deny' };
      await respondToApp2faApproval(command.id, false);
      return { ok: true, message: 'Sign-in denied' };

    default:
      // An action this build does not know about. Refusing is the only safe
      // reading: a newer watch app paired with an older phone app must not have
      // its request quietly reinterpreted as something else.
      return { ok: false, message: 'Not supported' };
  }
}

/** Watch screens are narrow; a stack trace is not a message. */
function shortError(error: unknown): string {
  const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (typeof detail === 'string' && detail.length > 0 && detail.length <= 40) return detail;
  return 'Failed — try your phone';
}

/**
 * Executes commands the watch sends.
 *
 * Mount once, below AuthProvider, alongside `useWatchSync`. Kept separate from
 * that hook deliberately: reads and writes have different blast radii, and the
 * one file that lets an off-device surface change state should be the one file
 * a security review has to read.
 */
export function useWatchCommands(): void {
  const { userToken } = useAuth();
  const { refresh } = useWallet();

  // The listener is registered once; these must not go stale inside it.
  const tokenRef = useRef(userToken);
  tokenRef.current = userToken;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const subscription = addWatchCommandListener((command) => {
      void (async () => {
        let result: WatchCommandResult;
        try {
          // A signed-out phone must not act on a watch that still has a stale
          // screen up. The snapshot is cleared on logout, but the watch may
          // have been out of range when that went out.
          result = tokenRef.current
            ? await runWatchCommand(command)
            : { ok: false, message: 'Sign in on your phone' };
        } catch (error) {
          result = { ok: false, message: shortError(error) };
        }

        if (result.ok) {
          queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.walletStatus() });
          // Push the consequence back to the wrist rather than leaving it
          // showing the state the user just acted to change.
          refreshRef.current();
        }

        await resolveWatchCommand(command.commandId, result.ok, result.message).catch(() => {
          // The watch has its own timeout; nothing useful to do here.
        });
      })();
    });

    return () => subscription.remove();
  }, []);
}
