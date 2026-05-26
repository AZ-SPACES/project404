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
    // Extended fields for transaction detail bottom sheet
    status: tx.status,
    note: tx.note || '',
    direction: tx.direction,
    senderId: tx.senderId || '',
    recipientId: tx.recipientId || '',
    completedAt: tx.completedAt || null,
  };
};

export const formatCurrency = (amount: number, currency: string = 'GHS') => {
  const symbol = currency === 'GHS' ? 'GH₵' : currency;
  return `${symbol} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const groupTransactionsByDate = (
  transactions: Transaction[],
): { title: string; data: Transaction[] }[] => {
  const groups: { [key: string]: Transaction[] } = {};

  transactions.forEach(tx => {
    const date = new Date(tx.fullDate);
    const dateString = date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (!groups[dateString]) {
      groups[dateString] = [];
    }
    groups[dateString].push(tx);
  });

  // Sort groups newest-first
  return Object.keys(groups)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map(date => ({
      title: date,
      data: groups[date]!,
    }));
};
