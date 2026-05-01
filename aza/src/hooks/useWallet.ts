import { useState, useEffect, useCallback } from 'react';
import { getWalletBalance, getTransactions } from '../services/api';
import { Transaction } from '../features/home/screens/TransactionsScreen';
import { mapBackendTransaction, formatCurrency } from '../utils/transactionUtils';

export interface WalletData {
  balance: number;
  currency: string;
  formattedBalance: string;
}

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        getWalletBalance(),
        getTransactions(0, 5),
      ]);

      const balanceData = balanceRes.data?.data || balanceRes.data;
      setWallet({
        balance: balanceData.balance,
        currency: balanceData.currency,
        formattedBalance: formatCurrency(balanceData.balance, balanceData.currency),
      });

      const txContent = transactionsRes.data?.data?.content || transactionsRes.data?.content || [];
      setRecentTransactions(txContent.map(mapBackendTransaction));
      setError(null);
    } catch (err) {
      console.error('Failed to fetch wallet data', err);
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  return { wallet, recentTransactions, loading, refreshing, refresh, error };
};
