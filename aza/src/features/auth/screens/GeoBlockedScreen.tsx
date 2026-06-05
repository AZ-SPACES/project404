import React from 'react';
import { View, Text, StyleSheet, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';

const SUPPORT_EMAIL = 'support@aza.systems';

export default function GeoBlockedScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Region%20Access%20Issue`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={Colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Feather name="map-pin" size={40} color="#EF4444" />
        </View>

        <Text style={styles.title}>Not Available in Your Region</Text>

        <Text style={styles.description}>
          AZA is not currently available in your country or region. This may be due to
          regulatory requirements.
        </Text>

        <Text style={styles.description}>
          If you believe this is a mistake — for example, if you're using a VPN — please
          disable it and try again.
        </Text>

        <View style={{ flex: 1 }} />

        <Button
          title="Contact Support"
          onPress={handleContactSupport}
          backgroundColor={Colors.primary}
          textColor="#ffffff"
          leftIcon={<Feather name="mail" size={18} color="#ffffff" />}
          style={{ marginBottom: Spacing.md }}
        />

        <View style={styles.infoRow}>
          <Feather name="info" size={14} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            Error code: GEO_RESTRICTED
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    body: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: 80,
      paddingBottom: Spacing.xl,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: Colors.isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    description: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.sm,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    infoText: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontFamily: 'monospace',
    },
  });
}
