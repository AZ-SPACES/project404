/**
 * The PIN screen shows one of two things after a failed confirmation: the keypad with a
 * "wrong PIN" hint, or an error state with a way out. Getting that wrong is what left a
 * sender staring at a raw Postgres message under the PIN squares with nothing to do but
 * type their PIN again — so the classification is worth pinning down.
 */
import { classifyFailure, failureCopy } from '../transferFailure';

const axiosError = (status: number, body: Record<string, unknown>) => ({
  response: { status, data: body },
});

describe('classifyFailure', () => {
  it('keeps a wrong PIN on the keypad', () => {
    const failure = classifyFailure(axiosError(400, { message: 'Invalid passcode.' }));
    expect(failure.kind).toBe('pin');
  });

  it('takes a lockout off the keypad — typing the PIN again cannot lift it', () => {
    const failure = classifyFailure(
      axiosError(400, { message: 'Too many failed attempts. Try again in 5 minutes.' }),
    );
    expect(failure.kind).toBe('declined');
    expect(failureCopy(failure).body).toBe('Too many failed attempts. Try again in 5 minutes.');
  });

  it('takes a database error off the keypad', () => {
    const failure = classifyFailure(
      axiosError(500, {
        message: "We couldn't complete that just now.",
        error: { code: 'DATABASE_ERROR' },
      }),
    );
    expect(failure.kind).toBe('server');
    expect(failureCopy(failure).note).toBe('No money left your wallet.');
  });

  it('classifies any 5xx as a server failure even without a code', () => {
    expect(classifyFailure(axiosError(503, {})).kind).toBe('server');
  });

  it('classifies a request that never got an answer as offline', () => {
    // No `response` at all — the shape axios gives for a timeout or a dead connection.
    const failure = classifyFailure({ message: 'Network Error' });
    expect(failure.kind).toBe('offline');
    // The outcome is genuinely unknown here, so the copy must not claim the money is safe.
    expect(failureCopy(failure).note).toBe("Trying again won't send twice.");
  });

  it('passes a declined 4xx through with the server\'s own explanation', () => {
    const failure = classifyFailure(axiosError(400, { message: 'Insufficient balance' }));
    expect(failure.kind).toBe('declined');
    expect(failureCopy(failure).body).toBe('Insufficient balance');
  });

  it('reads the code off a re-thrown Error that flattened the axios shape', () => {
    // What transferStore hands the screen — see withErrorMeta.
    const rethrown = Object.assign(new Error('We could not complete that just now.'), {
      code: 'DATABASE_ERROR',
      status: 500,
    });
    expect(classifyFailure(rethrown).kind).toBe('server');
  });

  it('does not mistake a flattened error for an offline one', () => {
    // Regression: before withErrorMeta the status was lost in the re-throw, so every
    // server failure looked like a dead connection and got the wrong reassurance.
    const rethrown = Object.assign(new Error('Insufficient balance'), { status: 400 });
    expect(classifyFailure(rethrown).kind).toBe('declined');
  });
});
