import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { getWalletBalance, getTransactions } from '../services/api';
import { Transaction } from '../features/home/screens/TransactionsScreen';
import { mapBackendTransaction, formatCurrency } from '../utils/transactionUtils';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';

export interface WalletData {
  balance: number;
  currency: string;
  formattedBalance: string;
}

interface WalletQueryResult {
  wallet: WalletData;
  recentTransactions: Transaction[];
}

async function fetchWalletData(): Promise<WalletQueryResult> {
  const [balanceRes, transactionsRes] = await Promise.all([
    getWalletBalance(),
    getTransactions(0, 5),
  ]);

  const balanceData = balanceRes.data?.data || balanceRes.data;
  const wallet: WalletData = {
    balance: balanceData.balance,
    currency: balanceData.currency,
    formattedBalance: formatCurrency(balanceData.balance, balanceData.currency),
  };

  const txContent = transactionsRes.data?.data?.content || transactionsRes.data?.content || [];
  const recentTransactions: Transaction[] = txContent.map(mapBackendTransaction);

  return { wallet, recentTransactions };
}

export const useWallet = () => {
  const { userToken } = useAuth();

  const { data, isLoading, isFetching, isRefetching, error } = useQuery({
    queryKey: queryKeys.wallet(),
    queryFn: fetchWalletData,
    enabled: !!userToken,
    staleTime: 30_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.spendingYearly() });
  };

  return {
    wallet: data?.wallet ?? null,
    recentTransactions: data?.recentTransactions ?? [],
    loading: isLoading,
    refreshing: isRefetching,
    refresh,
    error: error ? 'Failed to load wallet data' : null,
  };
};
