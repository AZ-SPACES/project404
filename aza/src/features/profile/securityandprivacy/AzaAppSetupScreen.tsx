import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../providers/ToastProvider';
import { useProfile } from '../../../providers/ProfileProvider';
import { BackButton } from '../../../components/ui/BackButton';

export default function AzaAppSetupScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const { appTwoFactorEnabled, toggleApp2fa } = useProfile();

  const [isLoading, setIsLoading] = useState(false);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      await toggleApp2fa(true);
      showToast('Aza app verification enabled', 'success');
      navigation.navigate('TwoStepVerification');
    } catch {
      showToast('Failed to enable. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = () => {
    Alert.alert(
      'Turn off Aza app verification?',
      "You'll no longer be able to approve logins from other devices using this app.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await toggleApp2fa(false);
              showToast('Aza app verification disabled', 'success');
              navigation.navigate('TwoStepVerification');
            } catch {
              showToast('Failed to disable. Please try again.', 'error');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Aza app</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="cellphone-check" size={48} color={Colors.primary} />
        </View>

        <Text style={styles.title}>
          {appTwoFactorEnabled ? 'Aza app verification is on' : 'Verify using the Aza app'}
        </Text>
        <Text style={styles.description}>
          When you log in, you'll receive a push notification on your other logged-in devices. Tap Approve to complete sign-in — no code required.
        </Text>

        <View style={styles.featureList}>
          <FeatureRow
            icon="smartphone"
            title="Works offline"
            subtitle="Approvals work over push — no internet needed on the approving device"
            Colors={Colors}
            isDark={isDark}
          />
          <FeatureRow
            icon="bell"
            title="Instant notification"
            subtitle="You'll see who is trying to log in and from where"
            Colors={Colors}
            isDark={isDark}
          />
          <FeatureRow
            icon="layers"
            title="Multiple devices"
            subtitle="Any device where you're signed in can approve a login"
            Colors={Colors}
            isDark={isDark}
          />
        </View>

        {appTwoFactorEnabled && (
          <View style={styles.enabledBox}>
            <Feather name="check-circle" size={18} color="#166534" />
            <Text style={styles.enabledText}>This device can approve logins for your account</Text>
          </View>
        )}

        <View style={styles.footer}>
          {appTwoFactorEnabled ? (
            <Button
              title="Turn Off"
              onPress={handleDisable}
              loading={isLoading}
              backgroundColor="#EF4444"
              textColor="#FFFFFF"
              borderRadius={Radius.full}
              paddingVertical={16}
            />
          ) : (
            <Button
              title="Enable Aza App Verification"
              onPress={handleEnable}
              loading={isLoading}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={Radius.full}
              paddingVertical={16}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, title, subtitle, Colors, isDark }: {
  icon: string; title: string; subtitle: string;
  Colors: ThemeColors; isDark: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
      }}>
        <Feather name={icon as any} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 }}>{title}</Text>
        <Text style={{ fontSize: 13, color: Colors.textSecondary, lineHeight: 18 }}>{subtitle}</Text>
      </View>
    </View>
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
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
    featureList: {
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.lg,
    },
    enabledBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : '#DCFCE7',
      padding: 14,
      borderRadius: 12,
      marginBottom: Spacing.lg,
    },
    enabledText: {
      fontSize: 14,
      color: isDark ? '#4ADE80' : '#166534',
      fontWeight: '500',
      flex: 1,
    },
    footer: {
      marginTop: 'auto',
    },
  });
}
