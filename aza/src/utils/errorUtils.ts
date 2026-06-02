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

  if (data) {
    const pick = (v: unknown): string | null =>
      typeof v === 'string' && v.trim() ? v : null;

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
  if (typeof msg === 'string' && msg.trim()) return msg;

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
