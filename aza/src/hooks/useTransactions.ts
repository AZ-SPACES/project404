import { useState, useCallback, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { getTransactions, searchTransactions } from '../services/api';
import { Transaction } from '../features/home/screens/TransactionsScreen';
import { mapBackendTransaction, groupTransactionsByDate } from '../utils/transactionUtils';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';

export type TransactionFilter = 'All' | 'Money In' | 'Money Out' | 'Pending' | 'Failed';

function filterToStatus(filter: TransactionFilter): string | undefined {
  if (filter === 'Pending') return 'PENDING';
  if (filter === 'Failed') return 'FAILED';
  return undefined;
}

export const useTransactions = (initialFilter: TransactionFilter = 'All') => {
  const { userToken } = useAuth();
  const [filter, setFilterState] = useState<TransactionFilter>(initialFilter);
  const [searchQuery, setSearchQueryState] = useState('');

  const status = filterToStatus(filter);
  const isSearching = searchQuery.trim().length > 0;

  // Normal (paginated) query
  const normalQuery = useInfiniteQuery({
    queryKey: queryKeys.transactions(status),
    queryFn: async ({ pageParam = 0 }) => {
      const res = await getTransactions(pageParam as number, 20, undefined, status);
      const content: any[] = res.data?.data?.content || res.data?.content || [];
      const totalPages: number = res.data?.data?.totalPages ?? 1;
      return {
        content: content.map(mapBackendTransaction),
        totalPages,
        page: pageParam as number,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined,
    initialPageParam: 0,
    enabled: !!userToken && !isSearching,
    staleTime: 30_000,
  });

  // Search query
  const searchResult = useInfiniteQuery({
    queryKey: ['transactions-search', searchQuery, filter],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await searchTransactions({
        ...(searchQuery ? { q: searchQuery } : {}),
        ...(status ? { status } : {}),
        page: pageParam as number,
        size: 20,
      });
      const content: any[] = res.data?.data?.content || res.data?.content || [];
      const totalPages: number = res.data?.data?.totalPages ?? 1;
      return {
        content: content.map(mapBackendTransaction),
        totalPages,
        page: pageParam as number,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined,
    initialPageParam: 0,
    enabled: !!userToken && isSearching,
    staleTime: 30_000,
  });

  const activeQuery = isSearching ? searchResult : normalQuery;
  const { data, isLoading, isRefetching, isFetchingNextPage, error, fetchNextPage, hasNextPage } = activeQuery;

  const allTransactions: Transaction[] = useMemo(
    () => data?.pages.flatMap((p) => p.content) ?? [],
    [data],
  );

  const setFilter = useCallback((f: TransactionFilter) => {
    setFilterState(f);
  }, []);

  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryState(q);
  }, []);

  const refresh = useCallback(() => {
    if (isSearching) {
      queryClient.invalidateQueries({ queryKey: ['transactions-search', searchQuery, filter] });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions(status) });
    }
  }, [status, isSearching, searchQuery, filter]);

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  // Money In / Money Out are client-side direction filters over the full fetched set
  const filteredTransactions = useMemo(() => {
    if (filter === 'Money In') return allTransactions.filter((tx) => tx.isCredit);
    if (filter === 'Money Out') return allTransactions.filter((tx) => !tx.isCredit);
    return allTransactions;
  }, [allTransactions, filter]);

  const sections = useMemo(
    () => groupTransactionsByDate(filteredTransactions),
    [filteredTransactions],
  );

  return {
    sections,
    loading: isLoading,
    refreshing: isRefetching,
    refresh,
    loadMore,
    hasMore: !!hasNextPage,
    error: error ? 'Failed to load transactions. Pull down to retry.' : null,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
  };
};
