/**
 * Safely extract a human-readable message from any thrown value.
 *
 * Priority order:
 *   1. Axios response body: data.message (backend's primary error field)
 *   2. Axios response body: data.error.message or data.error (string)
 *   3. Axios response body: data.errors[0].message or data.errors[0] (validation arrays)
 *   4. Axios response body: data.detail (Spring Boot default)
 *   5. error.message (plain Error or Axios network error)
 *   6. Fallback string
 *
 * Never throws. Safe to call with any value including undefined.
 */
export function extractErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (!err || typeof err !== 'object') return fallback;

  const axiosErr = err as Record<string, unknown>;
  const data = (axiosErr.response as Record<string, unknown> | undefined)?.data as
    | Record<string, unknown>
    | undefined;

  const containsErrorCode = (str: string): boolean => {
    if (/status code \d+/i.test(str)) return true;
    if (/error( code)?[: ]?\d{3}\b/i.test(str)) return true;
    if (/^\d{3}\b/.test(str)) return true;
    if (/http \d{3}\b/i.test(str)) return true;
    // Catch cases like "Request failed with status code 403" explicitly
    if (/\b(?:400|401|402|403|404|409|422|429|500|502|503|504)\b/.test(str) && /(unauthorized|forbidden|not found|bad gateway|server error)/i.test(str)) {
      return true;
    }
    return false;
  };

  const pick = (v: unknown): string | null => {
    if (typeof v === 'string' && v.trim()) {
      if (containsErrorCode(v)) return null;
      return v;
    }
    return null;
  };

  if (data) {
    const errorsFirst =
      Array.isArray(data.errors) && data.errors.length > 0
        ? pick((data.errors[0] as Record<string, unknown>)?.message) ??
          pick(data.errors[0])
        : null;

    const candidate =
      pick(data.message) ??
      pick((data.error as Record<string, unknown> | undefined)?.message) ??
      pick(data.error as unknown) ??
      errorsFirst ??
      pick(data.detail);

    if (candidate) return candidate;
  }

  const msg = (axiosErr as { message?: unknown }).message;
  if (typeof msg === 'string' && msg.trim()) {
    if (!containsErrorCode(msg)) return msg;
  }

  return fallback;
}

/** Narrow an unknown catch value to a typed Error for instanceof checks. */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(extractErrorMessage(err));
}

/** Extract the HTTP response status code from an Axios error, or undefined if not available. */
export function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const status = (err as Record<string, unknown>).response as Record<string, unknown> | undefined;
  const code = status?.status;
  return typeof code === 'number' ? code : undefined;
}

/**
 * Seconds to wait after a 429, from the metadata the API response interceptor
 * attaches. Falls back to 60s when the server sent no Retry-After.
 */
export function getRetryAfterSeconds(err: unknown, fallback = 60): number {
  if (!err || typeof err !== 'object') return fallback;
  const value = (err as Record<string, unknown>).retryAfterSeconds;
  return typeof value === 'number' && value > 0 ? value : fallback;
}

/** "45s" / "3m" — human-readable Retry-After for rate-limit messages. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

/**
 * Shared copy for a rate-limited availability check. The signup screens all hit
 * the same throttles, so they should say the same thing when they trip one.
 */
export function rateLimitMessage(err: unknown): string {
  return `Too many attempts. Please wait ${formatWait(getRetryAfterSeconds(err))} and try again.`;
}

/**
 * The backend's machine-readable error code (ApiResponse.error.code), e.g.
 * "EMAIL_ALREADY_EXISTS". Use this rather than matching on the message, which is
 * user-facing copy and changes.
 */
export function getErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const data = ((err as Record<string, unknown>).response as Record<string, unknown> | undefined)
    ?.data as Record<string, unknown> | undefined;
  const error = data?.error as Record<string, unknown> | undefined;
  return typeof error?.code === 'string' ? error.code : undefined;
}
