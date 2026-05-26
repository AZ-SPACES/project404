import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTransactions } from '../services/api';
import { Transaction } from '../features/home/screens/TransactionsScreen';
import { mapBackendTransaction, groupTransactionsByDate } from '../utils/transactionUtils';

export type TransactionFilter = 'All' | 'Money In' | 'Money Out' | 'Pending' | 'Failed';

export const useTransactions = (initialFilter: TransactionFilter = 'All') => {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<TransactionFilter>(initialFilter);

  const fetchTransactions = useCallback(async (
    pageNum: number,
    currentFilter: TransactionFilter,
    isRefresh = false,
  ) => {
    let status: string | undefined;
    if (currentFilter === 'Pending') status = 'PENDING';
    else if (currentFilter === 'Failed') status = 'FAILED';

    try {
      if (pageNum === 0) setLoading(true);

      const res = await getTransactions(pageNum, 20, undefined, status);
      const content: any[] = res.data?.data?.content || res.data?.content || [];
      const totalPages: number = res.data?.data?.totalPages ?? 1;
      const mapped = content.map(mapBackendTransaction);

      setAllTransactions(prev => (isRefresh || pageNum === 0) ? mapped : [...prev, ...mapped]);
      setHasMore(pageNum < totalPages - 1);
      setError(null);
    } catch {
      setError('Failed to load transactions. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reset list and re-fetch from page 0 whenever filter changes
  useEffect(() => {
    setAllTransactions([]);
    setPage(0);
    setHasMore(true);
    fetchTransactions(0, filter, true);
  }, [filter, fetchTransactions]);

  const setFilter = useCallback((f: TransactionFilter) => setFilterState(f), []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    fetchTransactions(0, filter, true);
  }, [filter, fetchTransactions]);

  const loadMore = useCallback(() => {
    if (loading || refreshing || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTransactions(nextPage, filter);
  }, [loading, refreshing, hasMore, page, filter, fetchTransactions]);

  // Money In / Money Out are client-side direction filters over the full fetched set
  const filteredTransactions = useMemo(() => {
    if (filter === 'Money In') return allTransactions.filter(tx => tx.isCredit);
    if (filter === 'Money Out') return allTransactions.filter(tx => !tx.isCredit);
    return allTransactions;
  }, [allTransactions, filter]);

  const sections = useMemo(() => groupTransactionsByDate(filteredTransactions), [filteredTransactions]);

  return { sections, loading, refreshing, refresh, loadMore, hasMore, error, filter, setFilter };
};
