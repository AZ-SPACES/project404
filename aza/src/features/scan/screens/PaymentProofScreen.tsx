import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import QrCode from '../../../components/ui/QrCode';
import { getPaymentProof } from '../../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentProof'>;

const { width } = Dimensions.get('window');

interface ProofData {
  transactionId: string;
  reference: string;
  amount: number;
  currency: string;
  proofUrl: string;
  signature: string;
}

const PaymentProofScreen = ({ route, navigation }: Props) => {
  const { transactionId } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [proof, setProof] = useState<ProofData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getPaymentProof(transactionId);
      setProof(res?.data?.data ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleShare = async () => {
    if (!proof) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: `Verify this AZA payment: ${proof.proofUrl}`, url: proof.proofUrl });
    } catch {
      // user cancelled / unavailable
    }
  };

  const fmtAmount = (n: number, currency = 'GHS') =>
    `${currency} ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[Typography.h2, { color: Colors.textPrimary, marginLeft: Spacing.md }]}>
          Payment Proof
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.md }]}>
            Generating proof…
          </Text>
        </View>
      ) : error || !proof ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
          <Text style={[Typography.bodyLg, { color: Colors.textPrimary, marginTop: Spacing.md, fontWeight: '600' }]}>
            Couldn’t create a proof
          </Text>
          <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center', paddingHorizontal: Spacing.xl }]}>
            Only completed payments can be proven. Please try again.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={[Typography.body, { color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg }]}>
            Show this code so the recipient can confirm your payment went through.
          </Text>

          <View style={styles.qrCard}>
            <QrCode value={proof.proofUrl} size={Math.round(width * 0.6)} />
          </View>

          <Text style={styles.amount}>{fmtAmount(proof.amount, proof.currency)}</Text>
          <Text style={[Typography.caption, { color: Colors.textSecondary }]}>Ref: {proof.reference}</Text>

          <View style={{ height: Spacing.xl }} />
          <Button title="Share proof" onPress={handleShare} />
        </View>
      )}
    </SafeAreaView>
  );
};

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    content: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
    qrCard: {
      backgroundColor: Colors.white,
      padding: 20,
      borderRadius: 32,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 15 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 10,
      marginBottom: Spacing.lg,
    },
    amount: {
      fontSize: 30,
      fontWeight: '800',
      color: Colors.textPrimary,
      marginTop: Spacing.sm,
    },
  });
}

export default PaymentProofScreen;
