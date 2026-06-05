import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { authorizeQrLogin } from '../../../services/api';

type RouteType = RouteProp<RootStackParamList, 'QrLoginApproval'>;

const SITE_ICONS: Record<string, string> = {
  ADMIN: 'shield-checkmark',
  MERCHANT: 'storefront',
  DEVELOPER: 'code-slash',
};

const QrLoginApprovalScreen = () => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteType>();
  const { challengeToken, siteType, siteName } = route.params;

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const iconName = (SITE_ICONS[siteType] ?? 'globe') as never;

  async function handleApprove() {
    setLoading(true);
    try {
      await authorizeQrLogin(challengeToken);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authorization failed';
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } finally {
      setLoading(false);
    }
  }

  function handleDeny() {
    navigation.goBack();
  }

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successCard}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '20' }]}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.successTitle}>Login approved</Text>
          <Text style={styles.successSub}>
            You can now continue in the {siteName}.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '20' }]}>
          <Ionicons name={iconName} size={40} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Authorize login?</Text>
        <Text style={styles.subtitle}>
          A sign-in was requested for the{'\n'}
          <Text style={styles.siteName}>{siteName}</Text>
        </Text>

        <View style={styles.warningBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.warningText}>
            Only approve if you initiated this login from a trusted device.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.approveButton, { backgroundColor: Colors.primary }]}
            onPress={handleApprove}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.black} />
              : <Text style={styles.approveText}>Approve Login</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.denyButton} onPress={handleDeny} disabled={loading}>
            <Text style={[styles.denyText, { color: Colors.textSecondary }]}>Deny</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    backButton: {
      padding: 16,
      alignSelf: 'flex-start',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: Colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    siteName: {
      color: Colors.text,
      fontWeight: '600',
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: Colors.cardBackground,
      borderRadius: 12,
      padding: 14,
      marginBottom: 32,
      width: '100%',
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    actions: {
      width: '100%',
      gap: 12,
    },
    approveButton: {
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    approveText: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.black,
    },
    denyButton: {
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    denyText: {
      fontSize: 16,
      fontWeight: '600',
    },
    successCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: Colors.text,
      marginTop: 20,
      marginBottom: 8,
    },
    successSub: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginBottom: 40,
    },
    doneButton: {
      height: 52,
      width: '100%',
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: Colors.primary,
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.black,
    },
  });
}

export default QrLoginApprovalScreen;
