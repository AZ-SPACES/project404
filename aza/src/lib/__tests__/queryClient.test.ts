import { shouldRetry } from '../queryClient';

function axiosError(status: number) {
  return { response: { status } };
}

describe('shouldRetry', () => {
  describe('failure count guard', () => {
    it('returns false when failureCount reaches 2', () => {
      expect(shouldRetry(2, axiosError(500))).toBe(false);
    });

    it('returns false when failureCount exceeds 2', () => {
      expect(shouldRetry(3, axiosError(500))).toBe(false);
    });

    it('allows the first attempt (failureCount 0)', () => {
      expect(shouldRetry(0, axiosError(500))).toBe(true);
    });

    it('allows the second attempt (failureCount 1)', () => {
      expect(shouldRetry(1, axiosError(500))).toBe(true);
    });
  });

  describe('client error codes (4xx) — never retry', () => {
    it.each([400, 401, 403, 404, 409, 422, 429])(
      'returns false for HTTP %i',
      (status) => {
        expect(shouldRetry(0, axiosError(status))).toBe(false);
      },
    );
  });

  describe('server error codes (5xx) — retry', () => {
    it.each([500, 502, 503, 504])(
      'returns true for HTTP %i',
      (status) => {
        expect(shouldRetry(0, axiosError(status))).toBe(true);
        expect(shouldRetry(1, axiosError(status))).toBe(true);
      },
    );
  });

  describe('network errors (no response)', () => {
    it('retries when there is no response object', () => {
      const networkError = { message: 'Network Error' };
      expect(shouldRetry(0, networkError)).toBe(true);
      expect(shouldRetry(1, networkError)).toBe(true);
    });

    it('retries for plain Error objects', () => {
      expect(shouldRetry(0, new Error('timeout'))).toBe(true);
    });

    it('does not retry on the third attempt even for network errors', () => {
      expect(shouldRetry(2, new Error('timeout'))).toBe(false);
    });
  });

  describe('edge values', () => {
    it('returns true for null error (treated as network-level failure)', () => {
      expect(shouldRetry(0, null)).toBe(true);
    });

    it('returns false for null error on the third attempt', () => {
      expect(shouldRetry(2, null)).toBe(false);
    });
  });
});
