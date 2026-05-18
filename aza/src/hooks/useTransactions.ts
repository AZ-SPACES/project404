import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTransactions } from '../services/api';
import { Transaction, Section } from '../features/home/screens/TransactionsScreen';
import { mapBackendTransaction, groupTransactionsByDate } from '../utils/transactionUtils';

export const useTransactions = (initialFilter: string = 'All') => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(initialFilter);

  const fetchTransactions = useCallback(async (pageNum: number, currentFilter: string, isRefresh: boolean = false) => {
    try {
      if (!isRefresh) setLoading(true);
      
      let type: string | undefined;
      let status: string | undefined;

      if (currentFilter === 'Money In') {
        // We'll filter by direction in the frontend or update the API to support it.
        // For now, let's fetch all and filter in frontend to keep it simple, 
        // OR better, update the API to support direction.
        // Given the current backend implementation of getTransactionHistory, 
        // it doesn't support 'direction' filter yet.
      } else if (currentFilter === 'Pending') {
        status = 'PENDING';
      }

      const res = await getTransactions(pageNum, 20, type, status);
      const content = res.data?.data?.content || res.data?.content || [];
      const totalPages = res.data?.data?.totalPages ?? 1;
      
      const mapped = content.map(mapBackendTransaction);

      setTransactions(prev => isRefresh ? mapped : [...prev, ...mapped]);
      setHasMore(pageNum < totalPages - 1);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions(0, filter, true);
  }, [filter, fetchTransactions]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    fetchTransactions(0, filter, true);
  }, [filter, fetchTransactions]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchTransactions(nextPage, filter);
    }
  }, [loading, hasMore, page, filter, fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filter === 'Money In') return tx.isCredit;
      if (filter === 'Money Out') return !tx.isCredit;
      return true;
    });
  }, [transactions, filter]);

  const sections = useMemo(() => groupTransactionsByDate(filteredTransactions), [filteredTransactions]);

  return { sections, loading, refreshing, refresh, loadMore, hasMore, error, filter, setFilter };
};
