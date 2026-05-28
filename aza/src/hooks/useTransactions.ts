import { useState, useCallback, useMemo, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { getTransactions } from '../services/api';
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

  const status = filterToStatus(filter);

  const { data, isLoading, isRefetching, isFetchingNextPage, error, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery({
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
      enabled: !!userToken,
      staleTime: 30_000,
    });

  const allTransactions: Transaction[] = useMemo(
    () => data?.pages.flatMap((p) => p.content) ?? [],
    [data],
  );

  const setFilter = useCallback((f: TransactionFilter) => {
    setFilterState(f);
  }, []);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions(status) });
  }, [status]);

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
  };
};
