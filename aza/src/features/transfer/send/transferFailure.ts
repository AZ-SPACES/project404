import { extractErrorMessage, getErrorCode, getErrorStatus } from '../../../utils/errorUtils';

/**
 * What kind of failure the user is looking at, which decides whether they stay on the
 * keypad or get taken out of it.
 *
 * Re-entering the PIN only fixes one of these. Everything else used to land as the same
 * line of red text under the squares — including a raw database error, which read as if
 * the PIN had been rejected and left the sender with nothing to do but type it again.
 */
export type Failure =
  | { kind: 'pin'; message: string }
  | { kind: 'declined'; message: string }
  | { kind: 'server'; message: string }
  | { kind: 'offline'; message: string };

export function classifyFailure(err: unknown): Failure {
  const message = extractErrorMessage(err, 'Transfer failed. Please try again.');
  const status = getErrorStatus(err);
  const code = getErrorCode(err);

  // No status at all means the request never got an answer — offline, timeout, server
  // unreachable. The transfer's real outcome is unknown from here.
  if (status === undefined) {
    return { kind: 'offline', message };
  }
  if (status >= 500 || code === 'DATABASE_ERROR' || code === 'INTERNAL_ERROR') {
    return { kind: 'server', message };
  }
  if (/passcode|\bpin\b|incorrect/i.test(message)) {
    return { kind: 'pin', message };
  }
  // A 4xx the server explained: insufficient balance, daily limit, expired, frozen.
  return { kind: 'declined', message };
}

/** Title, body and reassurance for each failure — worded to answer "where is my money?" */
export function failureCopy(failure: Failure): { title: string; body: string; note: string | null } {
  switch (failure.kind) {
    case 'server':
      return {
        title: "That didn't go through",
        body: failure.message,
        // The server answered, and it answered before anything moved.
        note: 'No money left your wallet.',
      };
    case 'offline':
      return {
        title: "We couldn't reach the server",
        body: 'Check your connection and try again.',
        // Confirming the same transfer twice is safe — the server returns the existing
        // outcome rather than sending again — so we can offer the retry without hedging.
        note: "Trying again won't send twice.",
      };
    default:
      return {
        title: 'Transfer declined',
        body: failure.message,
        note: 'No money left your wallet.',
      };
  }
}
