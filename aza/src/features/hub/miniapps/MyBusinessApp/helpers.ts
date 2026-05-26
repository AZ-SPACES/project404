export function extractData(response: any) {
  return response?.data?.data ?? response?.data;
}

export function fmtAmount(amount?: number, currency = 'GHS') {
  if (amount == null) return '—';
  return `${currency === 'GHS' ? 'GH₵' : currency} ${Number(amount).toFixed(2)}`;
}

export function fmtDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GH', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}
