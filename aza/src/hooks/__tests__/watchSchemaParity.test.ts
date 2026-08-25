import type {
  WatchBudget,
  WatchSnapshot,
  WatchSpending,
  WatchTransaction,
} from '../../../modules/aza-watch';

// @types/node is deliberately outside this project's `types` list (pulling it in
// retypes every setTimeout as NodeJS.Timeout across the React Native codebase).
// Declare the two things this one test needs instead of widening it for all.
declare const __dirname: string;
declare function require(id: string): unknown;

const { readFileSync } = require('fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

/**
 * The phone encodes a snapshot to JSON and the watch decodes it into a Swift
 * struct. Nothing at build time connects the two: a field renamed on one side
 * only produces a decode error logged to the Console on a device nobody is
 * watching, and a silently blank wrist.
 *
 * These fixtures are typed, so `tsc` guards the TypeScript half — a field added
 * to `WatchSnapshot` and not here fails to compile. The assertions below then
 * hold the Swift half against them by parsing the source.
 */
const SNAPSHOT: WatchSnapshot = {
  formattedBalance: 'GH₵ 1,240.00',
  currency: 'GHS',
  transactions: [],
  capturedAt: '2026-08-25T09:14:00.000Z',
  balanceHidden: false,
  handle: 'kwame',
  payLink: 'https://aza.systems/pay/kwame',
  displayName: 'Kwame Mensah',
  spending: null,
  budget: null,
  pendingCount: 0,
  requestCount: 0,
};

const TRANSACTION: WatchTransaction = {
  id: 'txn_1',
  name: 'Ama Serwaa',
  amount: 'GH₵ 50.00',
  isCredit: true,
  time: '14:32',
  day: 'Today',
  kind: 'Transfer',
  status: 'COMPLETED',
  isPending: false,
  note: '',
  canDecline: false,
};

const BUDGET: WatchBudget = {
  spent: 'GH₵ 620.00',
  limit: 'GH₵ 1,000.00',
  fraction: 0.62,
};

const SPENDING: WatchSpending = {
  sentToday: 'GH₵ 240.00',
  spentThisMonth: 'GH₵ 1,980.00',
};

const SWIFT_SOURCE = readFileSync(
  join(__dirname, '../../../targets/watch/WalletSnapshot.swift'),
  'utf8',
);

/** Stored properties of one Swift struct, in declaration order. */
function swiftFields(struct: string): string[] {
  const body = SWIFT_SOURCE.split(`struct ${struct}`)[1];
  if (body === undefined) throw new Error(`struct ${struct} not found`);

  // Bound to this struct: a closing brace in column 0 ends it, or the source
  // that follows leaks in as extra fields. Then stop at the first `static let`,
  // which is a constant like `.placeholder` rather than an encoded property.
  const stored = (body.split('\n}')[0] ?? '').split('static let')[0] ?? '';
  return [...stored.matchAll(/^\s{4}let (\w+):/gm)].flatMap((m) => (m[1] ? [m[1]] : []));
}

describe('watch snapshot schema parity', () => {
  it.each([
    ['WalletSnapshot', SNAPSHOT],
    ['SnapshotTransaction', TRANSACTION],
    ['SnapshotSpending', SPENDING],
    ['SnapshotBudget', BUDGET],
  ])('%s matches its TypeScript counterpart', (struct, fixture) => {
    expect(swiftFields(struct).sort()).toEqual(Object.keys(fixture).sort());
  });

  it('parses the Swift source rather than trivially passing', () => {
    // Guards the regex above: if it silently matched nothing, every comparison
    // would still fail — but an empty struct name must throw, not return [].
    expect(swiftFields('WalletSnapshot').length).toBeGreaterThan(5);
    expect(() => swiftFields('NoSuchStruct')).toThrow();
  });

  it('sends capturedAt with fractional seconds, which the watch must parse', () => {
    // toISOString() always emits milliseconds. Swift's `.iso8601` decoding
    // strategy rejects them outright, which is why SnapshotStore parses both
    // shapes — see the decoder there before changing this format.
    expect(new Date().toISOString()).toMatch(/\.\d{3}Z$/);
    expect(SNAPSHOT.capturedAt).toMatch(/\.\d{3}Z$/);
  });
});
