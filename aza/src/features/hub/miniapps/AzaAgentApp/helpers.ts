export function extractData(response: any) {
  return response?.data?.data ?? response?.data;
}

export function fmtAmount(amount?: number | null, currency = 'GHS') {
  if (amount == null) return '—';
  return `${currency === 'GHS' ? 'GH₵' : currency} ${Number(amount).toFixed(2)}`;
}

/** Pulls a human message out of an axios error, falling back to a generic line. */
export function errorMessage(error: any, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error?.message ?? error?.message ?? fallback;
}

export function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
