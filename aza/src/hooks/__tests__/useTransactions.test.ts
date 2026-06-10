// The hook imports from react-query and react-native; we only test the exported
// pure helpers, so mock out the native and remote dependencies.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('../../services/api', () => ({
  getTransactions: jest.fn(),
  searchTransactions: jest.fn(),
}));
jest.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({ userToken: 'tok' }),
}));
jest.mock('../../lib/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
jest.mock('../../lib/queryKeys', () => ({ queryKeys: { transactions: jest.fn(() => []) } }));

import {
  filterToParams,
  advancedStatusToApi,
  advancedTypeToApi,
  isAdvancedActive,
  type TransactionFilter,
  type AdvancedFilters,
} from '../useTransactions';

// ── filterToParams ────────────────────────────────────────────────────────────

describe('filterToParams', () => {
  it('"All" returns no status and no direction', () => {
    expect(filterToParams('All')).toEqual({});
  });

  it('"Pending" returns status=PENDING and no direction', () => {
    expect(filterToParams('Pending')).toEqual({ status: 'PENDING' });
  });

  it('"Failed" returns status=FAILED and no direction', () => {
    expect(filterToParams('Failed')).toEqual({ status: 'FAILED' });
  });

  it('"Money In" returns direction=INCOMING and no status', () => {
    expect(filterToParams('Money In')).toEqual({ direction: 'INCOMING' });
  });

  it('"Money Out" returns direction=OUTGOING and no status', () => {
    expect(filterToParams('Money Out')).toEqual({ direction: 'OUTGOING' });
  });

  it('covers every member of TransactionFilter union', () => {
    const filters: TransactionFilter[] = ['All', 'Money In', 'Money Out', 'Pending', 'Failed'];
    for (const f of filters) {
      expect(() => filterToParams(f)).not.toThrow();
    }
  });
});

// ── advancedStatusToApi ───────────────────────────────────────────────────────

describe('advancedStatusToApi', () => {
  it('maps "Completed" → "COMPLETED"', () => {
    expect(advancedStatusToApi('Completed')).toBe('COMPLETED');
  });

  it('maps "Pending" → "PENDING"', () => {
    expect(advancedStatusToApi('Pending')).toBe('PENDING');
  });

  it('maps "Failed" → "FAILED"', () => {
    expect(advancedStatusToApi('Failed')).toBe('FAILED');
  });

  it('maps "All" → undefined', () => {
    expect(advancedStatusToApi('All')).toBeUndefined();
  });

  it('maps undefined → undefined', () => {
    expect(advancedStatusToApi(undefined)).toBeUndefined();
  });

  it('maps unknown string → undefined', () => {
    expect(advancedStatusToApi('Unknown')).toBeUndefined();
  });
});

// ── advancedTypeToApi ─────────────────────────────────────────────────────────

describe('advancedTypeToApi', () => {
  it('maps "Request" → "REQUEST"', () => {
    expect(advancedTypeToApi('Request')).toBe('REQUEST');
  });

  it('maps "Transfer" → "TRANSFER"', () => {
    expect(advancedTypeToApi('Transfer')).toBe('TRANSFER');
  });

  it('maps "All" → undefined', () => {
    expect(advancedTypeToApi('All')).toBeUndefined();
  });

  it('maps undefined → undefined', () => {
    expect(advancedTypeToApi(undefined)).toBeUndefined();
  });
});

// ── isAdvancedActive ──────────────────────────────────────────────────────────

describe('isAdvancedActive', () => {
  it('returns false for undefined', () => {
    expect(isAdvancedActive(undefined)).toBe(false);
  });

  it('returns false for an empty filter object', () => {
    expect(isAdvancedActive({})).toBe(false);
  });

  it('returns true when minAmount is set', () => {
    expect(isAdvancedActive({ minAmount: '10' })).toBe(true);
  });

  it('returns true when maxAmount is set', () => {
    expect(isAdvancedActive({ maxAmount: '500' })).toBe(true);
  });

  it('returns true when startDate is set', () => {
    expect(isAdvancedActive({ startDate: '2026-01-01' })).toBe(true);
  });

  it('returns true when endDate is set', () => {
    expect(isAdvancedActive({ endDate: '2026-06-01' })).toBe(true);
  });

  it('returns true when txType is set to a non-All value', () => {
    expect(isAdvancedActive({ txType: 'Transfer' })).toBe(true);
  });

  it('returns false when txType is "All"', () => {
    expect(isAdvancedActive({ txType: 'All' })).toBe(false);
  });

  it('returns true when txStatus is set to a non-All value', () => {
    expect(isAdvancedActive({ txStatus: 'Completed' })).toBe(true);
  });

  it('returns false when txStatus is "All"', () => {
    expect(isAdvancedActive({ txStatus: 'All' })).toBe(false);
  });

  it('returns true when multiple filters are set', () => {
    const f: AdvancedFilters = { minAmount: '50', startDate: '2026-01-01', txType: 'Request' };
    expect(isAdvancedActive(f)).toBe(true);
  });
});
