import { useState, useCallback, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { getTransactions, searchTransactions } from '../services/api';
import { Transaction } from '../features/home/screens/TransactionsScreen';
import { mapBackendTransaction, groupTransactionsByDate } from '../utils/transactionUtils';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';

export type TransactionFilter = 'All' | 'Money In' | 'Money Out' | 'Pending' | 'Failed';

export type AdvancedFilters = {
  minAmount?: string;
  maxAmount?: string;
  startDate?: string;
  endDate?: string;
  txType?: string;   // 'Transfer' | 'Request' | 'All'
  txStatus?: string; // 'Completed' | 'Pending' | 'Failed' | 'All'
};

function filterToParams(filter: TransactionFilter): { status?: string; direction?: string } {
  switch (filter) {
    case 'Pending':   return { status: 'PENDING' };
    case 'Failed':    return { status: 'FAILED' };
    case 'Money In':  return { direction: 'INCOMING' };
    case 'Money Out': return { direction: 'OUTGOING' };
    default:          return {};
  }
}

function advancedStatusToApi(s: string | undefined): string | undefined {
  switch (s) {
    case 'Completed': return 'COMPLETED';
    case 'Pending':   return 'PENDING';
    case 'Failed':    return 'FAILED';
    default:          return undefined;
  }
}

function advancedTypeToApi(t: string | undefined): string | undefined {
  switch (t) {
    case 'Request':  return 'REQUEST';
    case 'Transfer': return 'TRANSFER';
    default:         return undefined;
  }
}

function isAdvancedActive(f: AdvancedFilters | undefined): boolean {
  if (!f) return false;
  return !!(
    f.minAmount ||
    f.maxAmount ||
    f.startDate ||
    f.endDate ||
    (f.txType && f.txType !== 'All') ||
    (f.txStatus && f.txStatus !== 'All')
  );
}

export const useTransactions = (
  initialFilter: TransactionFilter = 'All',
  advancedFilters?: AdvancedFilters,
) => {
  const { userToken } = useAuth();
  const [filter, setFilterState] = useState<TransactionFilter>(initialFilter);
  const [searchQuery, setSearchQueryState] = useState('');

  const { status, direction } = filterToParams(filter);
  const isSearching = searchQuery.trim().length > 0;
  const hasAdvanced = isAdvancedActive(advancedFilters);
  // Use the search/filter endpoint when there's a text query OR advanced params.
  const useSearchPath = isSearching || hasAdvanced;

  // Advanced filter values resolved to API types.
  const advStatus    = advancedStatusToApi(advancedFilters?.txStatus);
  const advType      = advancedTypeToApi(advancedFilters?.txType);
  const advMinAmount = advancedFilters?.minAmount ? parseFloat(advancedFilters.minAmount) : undefined;
  const advMaxAmount = advancedFilters?.maxAmount ? parseFloat(advancedFilters.maxAmount) : undefined;

  // Normal (paginated) query — direction and status resolved server-side.
  const normalQuery = useInfiniteQuery({
    queryKey: queryKeys.transactions(status, direction),
    queryFn: async ({ pageParam = 0 }) => {
      const res = await getTransactions(pageParam as number, 20, undefined, status, direction);
      const content: any[] = res.data?.data?.content || res.data?.content || [];
      const totalPages: number = res.data?.data?.totalPages ?? 1;
      return { content: content.map(mapBackendTransaction), totalPages, page: pageParam as number };
    },
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined,
    initialPageParam: 0,
    enabled: !!userToken && !useSearchPath,
    staleTime: 30_000,
  });

  // Search/filter query — handles text search AND advanced filter params.
  const searchResult = useInfiniteQuery({
    queryKey: [
      'transactions-search',
      searchQuery,
      status,
      direction,
      advancedFilters?.minAmount ?? '',
      advancedFilters?.maxAmount ?? '',
      advancedFilters?.startDate ?? '',
      advancedFilters?.endDate ?? '',
      advancedFilters?.txType ?? '',
      advancedFilters?.txStatus ?? '',
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await searchTransactions({
        ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
        // Advanced filter status overrides the tab status when explicitly set.
        ...((advStatus ?? status) ? { status: advStatus ?? status } : {}),
        ...(direction ? { direction } : {}),
        ...(advType ? { type: advType } : {}),
        ...(advMinAmount !== undefined ? { minAmount: advMinAmount } : {}),
        ...(advMaxAmount !== undefined ? { maxAmount: advMaxAmount } : {}),
        ...(advancedFilters?.startDate ? { startDate: advancedFilters.startDate } : {}),
        ...(advancedFilters?.endDate ? { endDate: advancedFilters.endDate } : {}),
        page: pageParam as number,
        size: 20,
      });
      const content: any[] = res.data?.data?.content || res.data?.content || [];
      const totalPages: number = res.data?.data?.totalPages ?? 1;
      return { content: content.map(mapBackendTransaction), totalPages, page: pageParam as number };
    },
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages - 1 ? lastPage.page + 1 : undefined,
    initialPageParam: 0,
    enabled: !!userToken && useSearchPath,
    staleTime: 30_000,
  });

  const activeQuery = useSearchPath ? searchResult : normalQuery;
  const {
    data,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    error,
    fetchNextPage,
    hasNextPage,
  } = activeQuery;

  const sections = useMemo(() => {
    const all: Transaction[] = data?.pages.flatMap((p) => p.content) ?? [];
    return groupTransactionsByDate(all);
  }, [data]);

  const setFilter = useCallback((f: TransactionFilter) => {
    setFilterState(f);
  }, []);

  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryState(q);
  }, []);

  const refresh = useCallback(() => {
    if (useSearchPath) {
      queryClient.invalidateQueries({ queryKey: ['transactions-search'] });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions(status, direction) });
    }
  }, [status, direction, useSearchPath]);

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) fetchNextPage();
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  return {
    sections,
    loading: isLoading,
    loadingMore: isFetchingNextPage,
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
