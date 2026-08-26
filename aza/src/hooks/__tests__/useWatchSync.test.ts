// The hook itself pulls in react-native, react-query and four providers; we test
// the exported pure helpers, so mock out the native and remote dependencies.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('../../services/api', () => ({
  getBudgetStatus: jest.fn(),
  getSpendingSummary: jest.fn(),
  getTodaySent: jest.fn(),
  getTransactions: jest.fn(),
}));
jest.mock('../../providers/AuthProvider', () => ({ useAuth: () => ({ userToken: 'tok' }) }));
jest.mock('../../providers/ProfileProvider', () => ({ useProfile: () => ({}) }));
jest.mock('../../providers/DisplayProvider', () => ({ useDisplayContext: () => ({}) }));
jest.mock('../../providers/authEvents', () => ({ subscribeAuthEvents: jest.fn() }));
jest.mock('../useWallet', () => ({ useWallet: () => ({}) }));
jest.mock('../../../modules/aza-watch', () => ({
  addWatchRefreshListener: jest.fn(),
  addWatchStateListener: jest.fn(),
  clearWatchSnapshot: jest.fn(),
  isWatchAppAvailable: jest.fn(() => false),
  sendWatchSnapshot: jest.fn(),
}));

import {
  getBudgetStatus,
  getSpendingSummary,
  getTodaySent,
  getTransactions,
} from '../../services/api';
import { dayLabel, fetchWatchExtras, summariseBudget } from '../useWatchSync';

const mockGetSpendingSummary = getSpendingSummary as jest.Mock;
const mockGetTodaySent = getTodaySent as jest.Mock;
const mockGetTransactions = getTransactions as jest.Mock;
const mockGetBudgetStatus = getBudgetStatus as jest.Mock;

// ── dayLabel ──────────────────────────────────────────────────────────────────

describe('dayLabel', () => {
  const at = (iso: string) => new Date(iso).toISOString();

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-25T12:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('labels the current day "Today"', () => {
    expect(dayLabel(at('2026-08-25T09:14:00Z'))).toBe('Today');
  });

  it('compares calendar days, not elapsed hours', () => {
    // 23 hours earlier but a different date: "Yesterday", not "Today".
    expect(dayLabel(at('2026-08-24T13:00:00Z'))).toBe('Yesterday');
  });

  it('falls back to a short date further back', () => {
    expect(dayLabel(at('2026-08-12T10:00:00Z'))).not.toMatch(/Today|Yesterday/);
  });

  it('treats a future timestamp as today rather than negative days', () => {
    // Clock skew between phone and server should not render "-1 days".
    expect(dayLabel(at('2026-08-26T09:00:00Z'))).toBe('Today');
  });

  it('returns empty string for an unparseable date', () => {
    expect(dayLabel('not-a-date')).toBe('');
  });
});

// ── fetchWatchExtras ──────────────────────────────────────────────────────────

describe('fetchWatchExtras', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBudgetStatus.mockResolvedValue({ data: { data: [] } });
  });

  const pendingPage = (content: unknown[]) => ({ data: { data: { content } } });

  it('formats spending from the phone\'s own endpoints', async () => {
    mockGetSpendingSummary.mockResolvedValue({
      data: { data: { spentThisMonth: 1980, currency: 'GHS' } },
    });
    mockGetTodaySent.mockResolvedValue({ data: { data: { sentToday: 240, currency: 'GHS' } } });
    mockGetTransactions.mockResolvedValue(pendingPage([]));

    const extras = await fetchWatchExtras('GHS');

    expect(extras.spending.spentThisMonth).toContain('1,980.00');
    expect(extras.spending.sentToday).toContain('240.00');
  });

  it('filters one PENDING page instead of combining query filters', async () => {
    // getTransactionHistory applies exactly one filter — direction, then type,
    // then status — so a combined query silently degrades to direction alone.
    // Asking for status only is the one form that means what it says.
    mockGetSpendingSummary.mockResolvedValue({ data: {} });
    mockGetTodaySent.mockResolvedValue({ data: {} });
    mockGetTransactions.mockResolvedValue(pendingPage([]));

    await fetchWatchExtras('GHS');

    expect(mockGetTransactions).toHaveBeenCalledTimes(1);
    expect(mockGetTransactions).toHaveBeenCalledWith(0, 100, undefined, 'PENDING');
  });

  it('counts a request awaiting our payment as OUTGOING, not INCOMING', async () => {
    // The payer is the transaction's sender, and direction is reported from the
    // recipient's side — so a request we must pay reads OUTGOING. Getting this
    // backwards counts the requests we sent to other people instead.
    mockGetSpendingSummary.mockResolvedValue({ data: {} });
    mockGetTodaySent.mockResolvedValue({ data: {} });
    mockGetTransactions.mockResolvedValue(
      pendingPage([
        { type: 'REQUEST', direction: 'OUTGOING' },
        { type: 'REQUEST', direction: 'OUTGOING' },
        { type: 'REQUEST', direction: 'INCOMING' },
        { type: 'TRANSFER', direction: 'OUTGOING' },
      ]),
    );

    const extras = await fetchWatchExtras('GHS');

    expect(extras.requestCount).toBe(2);
    // The INCOMING request is one we sent; it is pending, but not ours to act on.
    expect(extras.pendingCount).toBe(2);
  });

  it('degrades to zeroes rather than throwing when the page is missing', async () => {
    mockGetSpendingSummary.mockResolvedValue({ data: {} });
    mockGetTodaySent.mockResolvedValue({ data: {} });
    mockGetTransactions.mockResolvedValue({ data: {} });

    const extras = await fetchWatchExtras('GHS');

    expect(extras.pendingCount).toBe(0);
    expect(extras.requestCount).toBe(0);
    expect(extras.spending.sentToday).toContain('0.00');
  });
});

// ── summariseBudget ───────────────────────────────────────────────────────────

describe('summariseBudget', () => {
  it('sums every budgeted category into one ring', () => {
    const budget = summariseBudget(
      [
        { spent: 400, budgetAmount: 600 },
        { spent: 220, budgetAmount: 400 },
      ],
      'GHS',
    );

    expect(budget?.spent).toContain('620.00');
    expect(budget?.limit).toContain('1,000.00');
    expect(budget?.fraction).toBeCloseTo(0.62);
  });

  it('ignores categories with spending but no budget set', () => {
    // Counting their spend against other categories’ limits would show a ring
    // filling up for money the user never budgeted against.
    const budget = summariseBudget(
      [
        { spent: 400, budgetAmount: 600 },
        { spent: 900 },
      ],
      'GHS',
    );

    expect(budget?.spent).toContain('400.00');
    expect(budget?.fraction).toBeCloseTo(400 / 600);
  });

  it('returns null when nothing is budgeted, rather than an empty ring', () => {
    // An empty gauge reads as "you have spent nothing", which is the opposite
    // of "you have set no budget".
    expect(summariseBudget([], 'GHS')).toBeNull();
    expect(summariseBudget([{ spent: 900 }], 'GHS')).toBeNull();
  });

  it('reports over-budget without clamping', () => {
    const budget = summariseBudget([{ spent: 1500, budgetAmount: 1000 }], 'GHS');
    expect(budget?.fraction).toBeCloseTo(1.5);
  });
});
