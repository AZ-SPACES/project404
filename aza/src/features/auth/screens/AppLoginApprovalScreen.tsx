import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { BackButton } from '../../../components/ui/BackButton';
import { RootStackParamList } from '../../../navigation/types';
import { respondToApp2faApproval } from '../../../services/api';
import { useToast } from '../../../providers/ToastProvider';
import { extractErrorMessage } from '../../../utils/errorUtils';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AppLoginApproval'>;
type RoutePropType = RouteProp<RootStackParamList, 'AppLoginApproval'>;

export default function AppLoginApprovalScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { requestId, deviceName, ipAddress } = route.params;
  const { showToast } = useToast();

  const [isApproving, setIsApproving] = useState(false);
  const [isDenying, setIsDenying] = useState(false);
  const [done, setDone] = useState<'approved' | 'denied' | null>(null);

  const respond = async (approve: boolean) => {
    if (approve) setIsApproving(true);
    else setIsDenying(true);

    try {
      await respondToApp2faApproval(requestId, approve);
      setDone(approve ? 'approved' : 'denied');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'This request has expired or is no longer valid.');
      showToast(msg, 'error');
      navigation.goBack();
    } finally {
      setIsApproving(false);
      setIsDenying(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
        <View style={styles.doneContainer}>
          <View style={[styles.doneIcon, done === 'approved' ? styles.doneIconApproved : styles.doneIconDenied]}>
            <Feather
              name={done === 'approved' ? 'check' : 'x'}
              size={36}
              color={done === 'approved' ? '#166534' : '#991B1B'}
            />
          </View>
          <Text style={styles.doneTitle}>
            {done === 'approved' ? 'Login approved' : 'Login denied'}
          </Text>
          <Text style={styles.doneSubtitle}>
            {done === 'approved'
              ? 'The login request has been approved. The session should complete shortly.'
              : 'The login request has been blocked. If this was you, try logging in again.'}
          </Text>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.full}
            paddingVertical={16}
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="cellphone-key" size={48} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Someone is trying to log in</Text>
        <Text style={styles.subtitle}>
          A login request was made to your Aza account. If this was you, tap Approve. If not, tap Deny immediately and change your password.
        </Text>

        <View style={styles.detailCard}>
          <DetailRow icon="smartphone" label="Device" value={deviceName || 'Unknown device'} Colors={Colors} isDark={isDark} />
          <View style={styles.detailDivider} />
          <DetailRow icon="map-pin" label="IP address" value={ipAddress || 'Unknown'} Colors={Colors} isDark={isDark} />
          <View style={styles.detailDivider} />
          <DetailRow icon="clock" label="Expires" value="In 5 minutes" Colors={Colors} isDark={isDark} />
        </View>

        <View style={styles.warningBox}>
          <Feather name="alert-triangle" size={16} color="#B45309" />
          <Text style={styles.warningText}>
            Never approve a login request you didn't initiate. Aza will never ask you to approve one on your behalf.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            title="Approve"
            onPress={() => respond(true)}
            loading={isApproving}
            disabled={isApproving || isDenying}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.full}
            paddingVertical={16}
          />
          <Button
            title="Deny"
            onPress={() => respond(false)}
            loading={isDenying}
            disabled={isApproving || isDenying}
            backgroundColor="transparent"
            textColor="#EF4444"
            borderRadius={Radius.full}
            paddingVertical={16}
            style={{ borderWidth: 1.5, borderColor: '#EF4444', marginTop: Spacing.sm }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, Colors, isDark }: {
  icon: string; label: string; value: string;
  Colors: ThemeColors; isDark: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
      }}>
        <Feather name={icon as any} size={17} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textPrimary }}>{value}</Text>
      </View>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 40 },
    iconWrap: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
      justifyContent: 'center', alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: 28, fontWeight: '700',
      color: Colors.textPrimary, marginBottom: Spacing.sm,
    },
    subtitle: {
      fontSize: 15, color: Colors.textSecondary,
      lineHeight: 22, marginBottom: Spacing.xl,
    },
    detailCard: {
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderRadius: 16, paddingHorizontal: 16,
      borderWidth: 1, borderColor: Colors.border,
      marginBottom: Spacing.lg,
    },
    detailDivider: { height: 1, backgroundColor: Colors.border },
    warningBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: '#FFFBEB', padding: 14, borderRadius: 12,
      borderWidth: 1, borderColor: '#FEF3C7', marginBottom: Spacing.xl,
    },
    warningText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
    actions: { gap: Spacing.sm },
    // Done state
    doneContainer: {
      flex: 1, paddingHorizontal: Spacing.lg,
      justifyContent: 'center', alignItems: 'center',
    },
    doneIcon: {
      width: 80, height: 80, borderRadius: 40,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    doneIconApproved: { backgroundColor: '#DCFCE7' },
    doneIconDenied: { backgroundColor: '#FEF2F2' },
    doneTitle: {
      fontSize: 26, fontWeight: '700',
      color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center',
    },
    doneSubtitle: {
      fontSize: 15, color: Colors.textSecondary,
      lineHeight: 22, textAlign: 'center', maxWidth: 320,
    },
  });
}
