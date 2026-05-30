import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { CloseButton } from '../../../components/ui/CloseButton';
import { queryKeys } from '../../../lib/queryKeys';
import { getWalletStatus, freezeWallet, unfreezeWallet } from '../../../services/api';
import { useToast } from '../../../providers/ToastProvider';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'WalletFreeze'>;

export default function WalletFreezeScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { height } = Dimensions.get('window');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.walletStatus(),
    queryFn: async () => {
      const res = await getWalletStatus();
      return (res.data?.data || res.data) as { frozen: boolean };
    },
    staleTime: 30_000,
  });

  const isFrozen: boolean = data?.frozen ?? false;

  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isBottomSheetVisible) {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, { toValue: height, duration: 300, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [isBottomSheetVisible, bottomSheetAnim, backdropAnim, height]);

  const freezeMutation = useMutation({
    mutationFn: freezeWallet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.walletStatus() });
      qc.invalidateQueries({ queryKey: queryKeys.wallet() });
      showToast('Wallet frozen. All transfers are now blocked.', 'success');
    },
    onError: () => {
      showToast('Could not freeze wallet. Please try again.', 'error');
    },
  });

  const unfreezeMutation = useMutation({
    mutationFn: unfreezeWallet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.walletStatus() });
      qc.invalidateQueries({ queryKey: queryKeys.wallet() });
      showToast('Wallet unfrozen. Transfers are now enabled.', 'success');
    },
    onError: () => {
      showToast('Could not unfreeze wallet. Please try again.', 'error');
    },
  });

  const isPending = freezeMutation.isPending || unfreezeMutation.isPending;

  const handleToggle = () => {
    if (isFrozen) {
      unfreezeMutation.mutate();
    } else {
      setBottomSheetVisible(true);
    }
  };

  const iconBgColor = isFrozen
    ? isDark ? 'rgba(59,130,246,0.18)' : '#DBEAFE'
    : isDark ? 'rgba(22,163,74,0.18)' : '#DCFCE7';

  const iconColor = isFrozen ? '#3B82F6' : '#16a34a';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Freeze Wallet</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <View style={styles.body}>
          {/* Status indicator */}
          <View style={[styles.iconCircle, { backgroundColor: iconBgColor }]}>
            <Feather name={isFrozen ? 'lock' : 'unlock'} size={40} color={iconColor} />
          </View>

          <Text style={styles.statusTitle}>
            {isFrozen ? 'Your wallet is frozen' : 'Your wallet is active'}
          </Text>

          <Text style={styles.statusDesc}>
            {isFrozen
              ? 'All transfers are blocked. Unfreeze your wallet to resume normal activity.'
              : 'Temporarily freeze your wallet to block all incoming and outgoing transfers. Useful if your phone is lost or stolen.'}
          </Text>

          <View style={{ flex: 1 }} />

          <Button
            title={isFrozen ? 'Unfreeze Wallet' : 'Freeze Wallet'}
            onPress={handleToggle}
            loading={isPending}
            backgroundColor={isFrozen ? '#16a34a' : '#EF4444'}
            textColor="#ffffff"
            leftIcon={
              <Feather
                name={isFrozen ? 'unlock' : 'lock'}
                size={20}
                color="#ffffff"
              />
            }
            style={{ marginBottom: Spacing.xl }}
          />

          {isFrozen && (
            <View style={styles.warningBanner}>
              <Feather name="alert-triangle" size={16} color="#D97706" />
              <Text style={styles.warningText}>
                Your wallet is currently frozen. You cannot send or receive money.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Bottom Sheet Overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents={isBottomSheetVisible ? "auto" : "none"}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim, zIndex: 1000 }]}>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={() => setBottomSheetVisible(false)}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.bottomSheetContainer,
            {
              zIndex: 1001,
              transform: [{ translateY: bottomSheetAnim }],
            },
          ]}
        >
          <View style={styles.bottomSheetHeader}>
            <CloseButton onPress={() => setBottomSheetVisible(false)} />
          </View>
          
          <Text style={styles.bottomSheetTitle}>Freeze Wallet</Text>
          <View style={styles.bottomSheetDivider} />
          
          <Text style={styles.bottomSheetDescription}>
            Are you sure? This will block all incoming and outgoing transfers immediately.
          </Text>

          <Button
            title="Freeze Wallet"
            onPress={() => {
              setBottomSheetVisible(false);
              freezeMutation.mutate();
            }}
            backgroundColor="#EF4444"
            textColor="#ffffff"
            style={{ marginBottom: Spacing.md }}
          />
          <Button
            title="Cancel"
            onPress={() => setBottomSheetVisible(false)}
            backgroundColor={isDark ? Colors.surface : '#F3F4F6'}
            textColor={Colors.textPrimary}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    headerTitle: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: 60,
      paddingBottom: Spacing.xl,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    statusTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    statusDesc: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.xl * 2,
      paddingHorizontal: Spacing.md,
    },

    warningBanner: {
      flexDirection: 'row',
      gap: Spacing.sm,
      backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#FEF3C7',
      borderRadius: Radius.sm,
      padding: Spacing.md,
      alignItems: 'flex-start',
      width: '100%',
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: '#D97706',
      lineHeight: 18,
    },
    bottomSheetBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    bottomSheetContainer: {
      position: "absolute",
      bottom: 0,
      width: "100%",
      backgroundColor: isDark ? Colors.surface : '#FFFFFF',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 48,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    },
    bottomSheetHeader: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: 16,
    },
    bottomSheetTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    bottomSheetDivider: {
      height: 1,
      backgroundColor: Colors.border,
      marginBottom: Spacing.lg,
    },
    bottomSheetDescription: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginBottom: Spacing.xl,
      lineHeight: 22,
    },
  });
}
