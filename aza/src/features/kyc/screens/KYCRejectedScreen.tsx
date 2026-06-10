import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { RootStackParamList } from '../../../navigation/types';
import { useKYC } from '../../../providers/KYCProvider';
import { useToast } from '../../../providers/ToastProvider';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'KYCRejected'>;

export default function KYCRejectedScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data: kycData, resubmit, isSubmitting } = useKYC();
  const { showToast } = useToast();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleResubmit = async () => {
    try {
      await resubmit();
      navigation.navigate('VerifyIdentity', {});
    } catch {
      showToast('Could not start resubmission. Please try again.', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="cancel" size={64} color={Colors.error ?? '#D32F2F'} />
          </View>

          <Text style={styles.title}>Verification Unsuccessful</Text>
          <Text style={styles.subtitle}>
            Unfortunately, we could not verify your identity with the information provided.
          </Text>

          {kycData.rejectionReason ? (
            <View style={styles.reasonCard}>
              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reasonText}>{kycData.rejectionReason}</Text>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What to do next</Text>
            <View style={styles.infoRow}>
              <MaterialIcons name="photo-camera" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>Make sure your ID photos are clear and well-lit</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="face" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>Ensure your selfie shows your full face without obstructions</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="assignment" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>Confirm your ID number matches your document exactly</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footerLine} />
      <View style={styles.buttonContainer}>
        <Button
          title={isSubmitting ? 'Please wait…' : 'Fix & Resubmit'}
          onPress={handleResubmit}
          disabled={isSubmitting}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          borderRadius={Radius.sm}
          paddingVertical={16}
          fontSize={Typography.button.fontSize}
          fontWeight={Typography.button.fontWeight}
        />
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Spacing.lg,
    },
    container: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl * 2,
    },
    iconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: isDark ? Colors.white10 : 'rgba(211, 47, 47, 0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    title: {
      fontSize: 34,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
      letterSpacing: -0.5,
      lineHeight: 38,
    },
    subtitle: {
      fontSize: Typography.bodyLg.fontSize,
      color: Colors.textSecondary,
      lineHeight: 24,
      marginBottom: Spacing.xl,
    },
    reasonCard: {
      backgroundColor: isDark ? Colors.surface : '#FFF3F3',
      borderWidth: 1,
      borderColor: isDark ? Colors.border : '#FFCDD2',
      borderRadius: Radius.md,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    reasonLabel: {
      fontSize: Typography.caption.fontSize,
      fontWeight: '700',
      color: Colors.error ?? '#D32F2F',
      marginBottom: Spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    reasonText: {
      fontSize: Typography.body.fontSize,
      color: Colors.textPrimary,
      lineHeight: 22,
    },
    infoCard: {
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    infoTitle: {
      fontSize: Typography.body.fontSize,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.xs,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    infoText: {
      flex: 1,
      fontSize: Typography.body.fontSize,
      color: Colors.textSecondary,
      lineHeight: 22,
    },
    footerLine: {
      height: 1,
      backgroundColor: Colors.border,
      marginBottom: Spacing.md,
    },
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
  });
}
