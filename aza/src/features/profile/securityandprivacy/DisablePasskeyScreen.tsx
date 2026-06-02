import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../providers/ToastProvider';
import { useProfile } from '../../../providers/ProfileProvider';
import { BackButton } from '../../../components/ui/BackButton';
import { extractErrorMessage } from '../../../utils/errorUtils';

export default function DisablePasskeyScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const { togglePasskeys } = useProfile();

  const [isLoading, setIsLoading] = useState(false);

  const handleDisable = async () => {
    setIsLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm your identity to turn off passkeys',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        showToast('Authentication cancelled', 'error');
        return;
      }

      await togglePasskeys(false);
      showToast('Passkeys disabled', 'success');
      navigation.navigate('TwoStepVerification');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to disable passkeys. Please try again.');
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Passkeys</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="fingerprint-off" size={48} color="#EF4444" />
        </View>

        <Text style={styles.title}>Turn off passkeys</Text>
        <Text style={styles.description}>
          You'll no longer be able to use Face ID, fingerprint, or device PIN to complete 2-step verification.
        </Text>

        <View style={styles.warningBox}>
          <Feather name="alert-triangle" size={20} color="#991B1B" />
          <Text style={styles.warningText}>
            Turning this off will remove biometric verification from your account. Make sure you have at least one other 2-step method enabled.
          </Text>
        </View>

        <View style={styles.confirmNote}>
          <MaterialCommunityIcons name="fingerprint" size={20} color={Colors.textSecondary} />
          <Text style={styles.confirmNoteText}>
            Your biometric will be requested once to confirm this action.
          </Text>
        </View>

        <View style={styles.footer}>
          <Button
            title="Verify & Turn Off"
            onPress={handleDisable}
            loading={isLoading}
            backgroundColor="#EF4444"
            textColor="#FFFFFF"
            borderRadius={Radius.full}
            paddingVertical={16}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      height: 56,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginLeft: Spacing.md,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: 40,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    description: {
      fontSize: 16,
      color: Colors.textSecondary,
      lineHeight: 24,
      marginBottom: Spacing.xl,
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
      padding: 16,
      borderRadius: 12,
      marginBottom: Spacing.lg,
    },
    warningText: {
      flex: 1,
      color: '#991B1B',
      fontSize: 14,
      lineHeight: 20,
    },
    confirmNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.xl,
    },
    confirmNoteText: {
      flex: 1,
      fontSize: 14,
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    footer: {
      marginTop: 'auto',
    },
  });
}
