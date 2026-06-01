// TransactionsScreen re-exports the Transaction type; mock it so the file
// doesn't drag in React Native components during a Node-based test run.
jest.mock('../../features/home/screens/TransactionsScreen', () => ({}));

import {
  mapBackendTransaction,
  formatCurrency,
  groupTransactionsByDate,
} from '../transactionUtils';

// ── mapBackendTransaction ─────────────────────────────────────────────────────

describe('mapBackendTransaction', () => {
  const base = {
    id: 'tx-1',
    amount: '150.50',
    type: 'TRANSFER',
    status: 'COMPLETED',
    direction: 'OUTGOING',
    recipientName: 'Bob Smith',
    senderName: 'Alice Jones',
    note: 'Lunch',
    initiatedAt: '2026-06-01T10:00:00.000Z',
    completedAt: '2026-06-01T10:00:05.000Z',
    currency: 'GHS',
    senderId: 'sender-uuid',
    recipientId: 'recipient-uuid',
  };

  it('maps outgoing transfer: name comes from recipientName', () => {
    const tx = mapBackendTransaction(base);
    expect(tx.name).toBe('Bob Smith');
    expect(tx.isCredit).toBe(false);
    expect(tx.type).toBe('Transfer');
  });

  it('maps incoming transfer: name comes from senderName', () => {
    const tx = mapBackendTransaction({ ...base, direction: 'INCOMING' });
    expect(tx.name).toBe('Alice Jones');
    expect(tx.isCredit).toBe(true);
  });

  it('maps REQUEST type to "Money Request"', () => {
    const tx = mapBackendTransaction({ ...base, type: 'REQUEST' });
    expect(tx.type).toBe('Money Request');
  });

  it('marks PENDING transactions as isPending=true', () => {
    const tx = mapBackendTransaction({ ...base, status: 'PENDING' });
    expect(tx.isPending).toBe(true);
  });

  it('marks non-pending transactions as isPending=false', () => {
    const tx = mapBackendTransaction(base);
    expect(tx.isPending).toBe(false);
  });

  it('preserves id, amount, note, currency, direction', () => {
    const tx = mapBackendTransaction(base);
    expect(tx.id).toBe('tx-1');
    expect(tx.amount).toBe(150.5);
    expect(tx.note).toBe('Lunch');
    expect(tx.currency).toBe('GHS');
    expect(tx.direction).toBe('OUTGOING');
  });

  it('uses createdAt when initiatedAt is absent', () => {
    const { initiatedAt, ...rest } = base;
    const tx = mapBackendTransaction({ ...rest, createdAt: '2026-05-15T08:00:00.000Z' });
    expect(tx.fullDate).toContain('2026-05-15');
  });

  it('sets note to empty string when absent', () => {
    const { note, ...rest } = base;
    const tx = mapBackendTransaction(rest);
    expect(tx.note).toBe('');
  });
});

// ── formatCurrency ────────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('uses GH₵ symbol for GHS', () => {
    expect(formatCurrency(100, 'GHS')).toContain('GH₵');
  });

  it('formats to 2 decimal places', () => {
    expect(formatCurrency(1234.5, 'GHS')).toContain('1,234.50');
  });

  it('uses the raw currency string for non-GHS currencies', () => {
    expect(formatCurrency(50, 'USD')).toContain('USD');
  });

  it('defaults currency to GHS', () => {
    expect(formatCurrency(20)).toContain('GH₵');
  });
});

// ── groupTransactionsByDate ───────────────────────────────────────────────────

describe('groupTransactionsByDate', () => {
  // Pin "now" so today/yesterday labels are stable
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
  });
  afterAll(() => jest.useRealTimers());

  function makeTx(id: string, isoDate: string) {
    return {
      id,
      name: 'Test',
      type: 'Transfer',
      time: '10:00',
      amount: 10,
      isCredit: false,
      isPending: false,
      fullDate: isoDate,
      status: 'COMPLETED',
      note: '',
      direction: 'OUTGOING',
      senderId: '',
      recipientId: '',
      completedAt: null,
      currency: 'GHS',
    };
  }

  it('returns an empty array for no transactions', () => {
    expect(groupTransactionsByDate([])).toEqual([]);
  });

  it('labels today\'s transactions as "Today"', () => {
    const txs = [makeTx('1', '2026-06-01T09:00:00.000Z')];
    const groups = groupTransactionsByDate(txs);
    expect(groups[0]?.title).toBe('Today');
  });

  it('labels yesterday\'s transactions as "Yesterday"', () => {
    const txs = [makeTx('1', '2026-05-31T09:00:00.000Z')];
    const groups = groupTransactionsByDate(txs);
    expect(groups[0]?.title).toBe('Yesterday');
  });

  it('groups multiple transactions on the same date together', () => {
    const txs = [
      makeTx('1', '2026-06-01T09:00:00.000Z'),
      makeTx('2', '2026-06-01T11:00:00.000Z'),
    ];
    const groups = groupTransactionsByDate(txs);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.data).toHaveLength(2);
  });

  it('orders groups newest-first (today before yesterday)', () => {
    const txs = [
      makeTx('old', '2026-05-31T09:00:00.000Z'),
      makeTx('new', '2026-06-01T09:00:00.000Z'),
    ];
    const groups = groupTransactionsByDate(txs);
    expect(groups[0]?.title).toBe('Today');
    expect(groups[1]?.title).toBe('Yesterday');
  });

  it('sorts transactions within a group newest-first', () => {
    const txs = [
      makeTx('early', '2026-06-01T08:00:00.000Z'),
      makeTx('late',  '2026-06-01T14:00:00.000Z'),
    ];
    const groups = groupTransactionsByDate(txs);
    expect(groups[0]?.data[0]?.id).toBe('late');
    expect(groups[0]?.data[1]?.id).toBe('early');
  });
});
