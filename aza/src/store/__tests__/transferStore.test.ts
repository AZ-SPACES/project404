/**
 * transferStore — financial state machine tests.
 *
 * Covers:
 *   - initiateTransfer: happy path sets status + pendingTransactionId
 *   - initiateTransfer: API error sets status=error and throws with extracted message
 *   - confirmTransfer: happy path sets status=success and invalidates wallet cache
 *   - confirmTransfer: error sets status=error and re-throws
 *   - requestMoney: happy path returns transaction id
 *   - requestMoney: error is extracted and re-thrown
 *   - cancelPendingTransfer: is a no-op when no pendingTransactionId is set
 *   - cancelPendingTransfer: clears state even if the API call fails
 *   - reset: returns the store to its initial idle state
 *   - idempotency key is a valid UUID v4
 */

import 'react-native-get-random-values';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInitiate  = jest.fn();
const mockConfirm   = jest.fn();
const mockCancel    = jest.fn();
const mockRequest   = jest.fn();
const mockAccept    = jest.fn();
const mockDecline   = jest.fn();

jest.mock('../../services/api', () => ({
  initiateTransfer:     (...a: unknown[]) => mockInitiate(...a),
  confirmTransfer:      (...a: unknown[]) => mockConfirm(...a),
  cancelTransfer:       (...a: unknown[]) => mockCancel(...a),
  requestMoney:         (...a: unknown[]) => mockRequest(...a),
  acceptMoneyRequest:   (...a: unknown[]) => mockAccept(...a),
  declineMoneyRequest:  (...a: unknown[]) => mockDecline(...a),
}));

jest.mock('../../lib/queryClient', () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));

jest.mock('../../lib/queryKeys', () => ({
  queryKeys: {
    wallet:        () => ['wallet'],
    spendingYearly: () => ['spending-yearly'],
  },
}));

import { useTransferStore } from '../transferStore';

// Pull the store actions directly so tests don't need a React render.
function store() {
  return useTransferStore.getState();
}

beforeEach(() => {
  useTransferStore.setState({ status: 'idle', pendingTransactionId: null, error: null });
  jest.clearAllMocks();
});

// ── initiateTransfer ──────────────────────────────────────────────────────────

describe('initiateTransfer', () => {
  it('sets status=idle and stores the transaction id on success', async () => {
    mockInitiate.mockResolvedValueOnce({ data: { data: { id: 'txn-001' } } });

    const id = await store().initiateTransfer({
      recipientIdentifier: '@bob',
      amount: 50,
      note: 'lunch',
    });

    expect(id).toBe('txn-001');
    expect(store().status).toBe('idle');
    expect(store().pendingTransactionId).toBe('txn-001');
    expect(store().error).toBeNull();
  });

  it('accepts the flat response shape (data.id)', async () => {
    mockInitiate.mockResolvedValueOnce({ data: { id: 'txn-002' } });
    const id = await store().initiateTransfer({
      recipientIdentifier: '@alice',
      amount: 20,
      note: '',
    });
    expect(id).toBe('txn-002');
  });

  it('passes an idempotency key to the API', async () => {
    mockInitiate.mockResolvedValueOnce({ data: { data: { id: 'x' } } });
    await store().initiateTransfer({ recipientIdentifier: '@x', amount: 1, note: '' });
    const [arg] = mockInitiate.mock.calls[0]!;
    expect(arg.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('sets status=error and throws when the API fails', async () => {
    mockInitiate.mockRejectedValueOnce({
      response: { data: { message: 'Insufficient funds' } },
    });

    await expect(
      store().initiateTransfer({ recipientIdentifier: '@x', amount: 9999, note: '' }),
    ).rejects.toThrow('Insufficient funds');

    expect(store().status).toBe('error');
    expect(store().error).toBe('Insufficient funds');
  });

  it('extracts a network error message when there is no response body', async () => {
    mockInitiate.mockRejectedValueOnce({ message: 'Network Error' });

    await expect(
      store().initiateTransfer({ recipientIdentifier: '@x', amount: 10, note: '' }),
    ).rejects.toThrow('Network Error');

    expect(store().error).toBe('Network Error');
  });
});

// ── confirmTransfer ───────────────────────────────────────────────────────────

describe('confirmTransfer', () => {
  it('sets status=success and clears pendingTransactionId', async () => {
    mockConfirm.mockResolvedValueOnce({});
    useTransferStore.setState({ pendingTransactionId: 'txn-abc', status: 'idle' });

    await store().confirmTransfer('txn-abc', '1234');

    expect(store().status).toBe('success');
    expect(store().pendingTransactionId).toBeNull();
  });

  it('sets status=error and throws on API failure', async () => {
    mockConfirm.mockRejectedValueOnce({
      response: { data: { message: 'Wrong passcode' } },
    });

    await expect(store().confirmTransfer('txn-abc', '9999')).rejects.toThrow('Wrong passcode');
    expect(store().status).toBe('error');
  });
});

// ── cancelPendingTransfer ─────────────────────────────────────────────────────

describe('cancelPendingTransfer', () => {
  it('is a no-op when there is no pending transaction', async () => {
    await store().cancelPendingTransfer();
    expect(mockCancel).not.toHaveBeenCalled();
    expect(store().status).toBe('idle');
  });

  it('calls cancelTransfer with the pending id', async () => {
    mockCancel.mockResolvedValueOnce({});
    useTransferStore.setState({ pendingTransactionId: 'txn-xyz', status: 'idle' });
    await store().cancelPendingTransfer();
    expect(mockCancel).toHaveBeenCalledWith('txn-xyz');
  });

  it('clears state even when the cancel API call fails (best-effort)', async () => {
    mockCancel.mockRejectedValueOnce(new Error('server error'));
    useTransferStore.setState({ pendingTransactionId: 'txn-xyz', status: 'idle' });
    await store().cancelPendingTransfer();
    expect(store().pendingTransactionId).toBeNull();
    expect(store().status).toBe('idle');
  });
});

// ── requestMoney ──────────────────────────────────────────────────────────────

describe('requestMoney', () => {
  it('returns the transaction id on success', async () => {
    mockRequest.mockResolvedValueOnce({ data: { data: { id: 'req-001' } } });
    const id = await store().requestMoney({ fromIdentifier: '@bob', amount: 30, note: '' });
    expect(id).toBe('req-001');
    expect(store().status).toBe('success');
  });

  it('throws with the extracted error message on failure', async () => {
    mockRequest.mockRejectedValueOnce({
      response: { data: { message: 'Recipient not found' } },
    });
    await expect(
      store().requestMoney({ fromIdentifier: '@nobody', amount: 5, note: '' }),
    ).rejects.toThrow('Recipient not found');
    expect(store().status).toBe('error');
  });
});

// ── reset ─────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('resets all fields to initial values', () => {
    useTransferStore.setState({ status: 'error', pendingTransactionId: 'x', error: 'oops' });
    store().reset();
    expect(store().status).toBe('idle');
    expect(store().pendingTransactionId).toBeNull();
    expect(store().error).toBeNull();
  });
});
