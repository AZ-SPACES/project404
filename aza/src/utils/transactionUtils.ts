import { Transaction } from '../features/home/screens/TransactionsScreen';

export const mapBackendTransaction = (tx: any): Transaction => {
  const date = new Date(tx.initiatedAt || tx.createdAt);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullDate = date.toISOString();

  return {
    id: tx.id,
    name:
      tx.direction === 'OUTGOING'
        ? tx.recipientName || 'Unknown'
        : tx.senderName || 'Unknown',
    type: tx.type === 'REQUEST' ? 'Money Request' : 'Transfer',
    time,
    amount: Number(tx.amount),
    isCredit: tx.direction === 'INCOMING',
    isPending: tx.status === 'PENDING',
    fullDate,
    status: tx.status,
    note: tx.note || '',
    direction: tx.direction,
    senderId: tx.senderId || '',
    recipientId: tx.recipientId || '',
    completedAt: tx.completedAt || null,
    currency: tx.currency,
  };
};

export const formatCurrency = (amount: number, currency: string = 'GHS') => {
  const symbol = currency === 'GHS' ? 'GH₵' : currency;
  return `${symbol} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

function getGroupKey(date: Date): string {
  if (isToday(date)) return '__today__';
  if (isYesterday(date)) return '__yesterday__';
  // ISO date string — sorts correctly lexicographically
  return date.toISOString().slice(0, 10);
}

function getGroupLabel(key: string): string {
  if (key === '__today__') return 'Today';
  if (key === '__yesterday__') return 'Yesterday';
  // Parse at noon to avoid DST shifts
  const date = new Date(key + 'T12:00:00');
  const isThisYear = date.getFullYear() === new Date().getFullYear();
  return isThisYear
    ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export const groupTransactionsByDate = (
  transactions: Transaction[],
): { title: string; data: Transaction[] }[] => {
  // Sort newest-first before grouping so within-day order is consistent
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.fullDate).getTime() - new Date(a.fullDate).getTime(),
  );

  const groups = new Map<string, Transaction[]>();
  for (const tx of sorted) {
    const key = getGroupKey(new Date(tx.fullDate));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  // Keep today → yesterday → remaining dates descending
  const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === '__today__') return -1;
    if (b === '__today__') return 1;
    if (a === '__yesterday__') return -1;
    if (b === '__yesterday__') return 1;
    return b.localeCompare(a);
  });

  return orderedKeys.map(key => ({
    title: getGroupLabel(key),
    data: groups.get(key)!,
  }));
};
