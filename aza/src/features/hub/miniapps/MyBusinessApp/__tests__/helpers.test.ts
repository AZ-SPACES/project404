import { extractData, fmtAmount, fmtDate, statusLabel } from '../helpers';

describe('extractData', () => {
  it('extracts data.data when present', () => {
    expect(extractData({ data: { data: [1, 2, 3] } })).toEqual([1, 2, 3]);
  });

  it('falls back to data when data.data is absent', () => {
    expect(extractData({ data: { items: [] } })).toEqual({ items: [] });
  });

  it('returns undefined for null/undefined input', () => {
    expect(extractData(null)).toBeUndefined();
    expect(extractData(undefined)).toBeUndefined();
  });
});

describe('fmtAmount', () => {
  it('formats GHS amounts with GH₵ symbol', () => {
    expect(fmtAmount(100, 'GHS')).toBe('GH₵ 100.00');
  });

  it('formats amounts to exactly 2 decimal places', () => {
    expect(fmtAmount(1.5)).toBe('GH₵ 1.50');
    expect(fmtAmount(1000)).toBe('GH₵ 1000.00');
  });

  it('uses the raw currency code for non-GHS currencies', () => {
    expect(fmtAmount(50, 'USD')).toBe('USD 50.00');
  });

  it('returns the em-dash placeholder when amount is null/undefined', () => {
    expect(fmtAmount(undefined)).toBe('—');
    expect(fmtAmount(null as any)).toBe('—');
  });
});

describe('fmtDate', () => {
  it('formats a valid ISO date string', () => {
    const result = fmtDate('2026-06-01T12:00:00Z');
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2026/);
  });

  it('returns the em-dash placeholder for empty/undefined input', () => {
    expect(fmtDate('')).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
  });
});

describe('statusLabel', () => {
  it('replaces underscores with spaces', () => {
    expect(statusLabel('UNDER_REVIEW')).toBe('UNDER REVIEW');
    expect(statusLabel('PENDING_KYB')).toBe('PENDING KYB');
  });

  it('leaves strings without underscores unchanged', () => {
    expect(statusLabel('ACTIVE')).toBe('ACTIVE');
  });

  it('handles multiple underscores', () => {
    expect(statusLabel('A_B_C')).toBe('A B C');
  });
});
