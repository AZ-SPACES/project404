import { extractErrorMessage, toError, getErrorStatus, getErrorCode, getRetryAfterSeconds, formatWait } from '../errorUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function axiosError(overrides: {
  message?: string;
  status?: number;
  data?: Record<string, unknown>;
}) {
  return {
    message: overrides.message ?? 'Request failed with status code 400',
    response: {
      status: overrides.status ?? 400,
      data: overrides.data ?? {},
    },
  };
}

// ── extractErrorMessage ───────────────────────────────────────────────────────

describe('extractErrorMessage', () => {
  describe('Axios response body extraction', () => {
    it('prefers data.message above all else', () => {
      const err = axiosError({ data: { message: 'Insufficient funds' } });
      expect(extractErrorMessage(err)).toBe('Insufficient funds');
    });

    it('falls back to data.error.message when data.message is absent', () => {
      const err = axiosError({ data: { error: { message: 'Invalid OTP' } } });
      expect(extractErrorMessage(err)).toBe('Invalid OTP');
    });

    it('falls back to data.error (string) when data.error.message is absent', () => {
      const err = axiosError({ data: { error: 'Account suspended' } });
      expect(extractErrorMessage(err)).toBe('Account suspended');
    });

    it('falls back to data.errors[0].message for validation arrays', () => {
      const err = axiosError({
        data: { errors: [{ message: 'handle must be unique' }] },
      });
      expect(extractErrorMessage(err)).toBe('handle must be unique');
    });

    it('falls back to data.errors[0] when it is a plain string', () => {
      const err = axiosError({ data: { errors: ['email is required'] } });
      expect(extractErrorMessage(err)).toBe('email is required');
    });

    it('falls back to data.detail (Spring Boot default field)', () => {
      const err = axiosError({ data: { detail: 'Wallet is frozen' } });
      expect(extractErrorMessage(err)).toBe('Wallet is frozen');
    });

    it('ignores empty strings in candidate fields', () => {
      const err = axiosError({ data: { message: '', detail: 'fallback detail' } });
      expect(extractErrorMessage(err)).toBe('fallback detail');
    });

    it('ignores whitespace-only strings in candidate fields', () => {
      const err = axiosError({ data: { message: '   ', detail: 'real message' } });
      expect(extractErrorMessage(err)).toBe('real message');
    });
  });

  describe('network error (no response body)', () => {
    it('returns the error.message for plain network errors', () => {
      const err = { message: 'Network Error' };
      expect(extractErrorMessage(err)).toBe('Network Error');
    });

    it('returns the error.message for timeout errors', () => {
      const err = { message: 'timeout of 5000ms exceeded' };
      expect(extractErrorMessage(err)).toBe('timeout of 5000ms exceeded');
    });
  });

  describe('plain Error objects', () => {
    it('extracts .message from a native Error', () => {
      expect(extractErrorMessage(new Error('bad input'))).toBe('bad input');
    });

    it('returns the fallback for an Error with no message', () => {
      expect(extractErrorMessage(new Error(''))).toBe('Something went wrong');
    });
  });

  describe('non-object values', () => {
    it('returns the default fallback for null', () => {
      expect(extractErrorMessage(null)).toBe('Something went wrong');
    });

    it('returns the default fallback for undefined', () => {
      expect(extractErrorMessage(undefined)).toBe('Something went wrong');
    });

    it('returns the default fallback for a number', () => {
      expect(extractErrorMessage(42)).toBe('Something went wrong');
    });

    it('returns the default fallback for a plain string', () => {
      expect(extractErrorMessage('oops')).toBe('Something went wrong');
    });
  });

  describe('custom fallback', () => {
    it('uses the caller-provided fallback when nothing can be extracted', () => {
      expect(extractErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
    });

    it('does NOT use the custom fallback when a real message is found', () => {
      const err = axiosError({ data: { message: 'real message' } });
      expect(extractErrorMessage(err, 'should not appear')).toBe('real message');
    });
  });
});

// ── toError ───────────────────────────────────────────────────────────────────

describe('toError', () => {
  it('returns the same Error instance when passed a native Error', () => {
    const original = new Error('existing');
    expect(toError(original)).toBe(original);
  });

  it('wraps an Axios error in a new Error using extractErrorMessage', () => {
    const err = axiosError({ data: { message: 'wrapped message' } });
    const result = toError(err);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('wrapped message');
  });

  it('wraps null in a new Error with the default fallback', () => {
    const result = toError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Something went wrong');
  });
});

// ── getErrorStatus ────────────────────────────────────────────────────────────

describe('getErrorStatus', () => {
  it('returns the HTTP status code from an Axios error', () => {
    expect(getErrorStatus(axiosError({ status: 404 }))).toBe(404);
  });

  it('returns 409 for conflict responses', () => {
    expect(getErrorStatus(axiosError({ status: 409 }))).toBe(409);
  });

  it('returns 500 for server errors', () => {
    expect(getErrorStatus(axiosError({ status: 500 }))).toBe(500);
  });

  it('returns undefined for plain Error objects (no response)', () => {
    expect(getErrorStatus(new Error('no network'))).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(getErrorStatus(null)).toBeUndefined();
  });

  it('returns undefined for a string', () => {
    expect(getErrorStatus('error string')).toBeUndefined();
  });
});

// ── getErrorCode ──────────────────────────────────────────────────────────────
// Signup routes the user back to the screen that owns a failure using this code, so a
// regression here silently strands people on the consent screen instead.

describe('getErrorCode', () => {
  it('reads the backend error code from an ApiResponse body', () => {
    const err = axiosError({
      status: 409,
      data: { success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'in use' } },
    });
    expect(getErrorCode(err)).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('returns undefined when the body carries no code', () => {
    expect(getErrorCode(axiosError({ data: { message: 'boom' } }))).toBeUndefined();
    expect(getErrorCode(axiosError({ data: { error: 'a plain string' } }))).toBeUndefined();
    expect(getErrorCode(new Error('network'))).toBeUndefined();
    expect(getErrorCode(undefined)).toBeUndefined();
    expect(getErrorCode('nope')).toBeUndefined();
  });
});

// ── rate-limit helpers ────────────────────────────────────────────────────────

describe('getRetryAfterSeconds', () => {
  it('uses the value the response interceptor attached', () => {
    const err = Object.assign(axiosError({ status: 429 }), { retryAfterSeconds: 45 });
    expect(getRetryAfterSeconds(err)).toBe(45);
  });

  it('falls back to 60s when absent or nonsensical', () => {
    expect(getRetryAfterSeconds(axiosError({ status: 429 }))).toBe(60);
    expect(getRetryAfterSeconds(Object.assign(axiosError({}), { retryAfterSeconds: 0 }))).toBe(60);
    expect(getRetryAfterSeconds(undefined)).toBe(60);
  });
});

describe('formatWait', () => {
  it('renders seconds under a minute and whole minutes above', () => {
    expect(formatWait(45)).toBe('45s');
    expect(formatWait(0.4)).toBe('1s');
    expect(formatWait(60)).toBe('1m');
    expect(formatWait(150)).toBe('3m');
  });
});
