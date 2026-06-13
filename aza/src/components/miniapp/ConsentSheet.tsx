import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated, Dimensions, Image, ScrollView, ActivityIndicator,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PERMISSION_META: Record<string, { icon: string; label: string; description: string }> = {
  USER_PROFILE: { icon: 'user', label: 'Your profile',       description: 'Name and profile picture' },
  USER_PHONE:   { icon: 'phone', label: 'Phone number',      description: 'Your registered phone number' },
  USER_EMAIL:   { icon: 'mail',  label: 'Email address',     description: 'Your registered email address' },
  MAKE_PAYMENTS:{ icon: 'credit-card', label: 'Make payments', description: 'Initiate payments from your Aza wallet' },
  READ_BALANCE: { icon: 'bar-chart-2', label: 'View balance', description: 'See your current wallet balance' },
  READ_TRANSACTIONS: { icon: 'list', label: 'Transaction history', description: 'Read your past transactions' },
};

interface ConsentSheetProps {
  visible: boolean;
  appName: string;
  appIcon: string | any;
  developerName?: string;
  requestedPermissions: string[];
  onGrant: (permissions: string[]) => Promise<void>;
  onDeny: () => void;
}

export default function ConsentSheet({
  visible,
  appName,
  appIcon,
  developerName,
  requestedPermissions,
  onGrant,
  onDeny,
}: ConsentSheetProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(sheetAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleGrant = async () => {
    setLoading(true);
    try {
      await onGrant(requestedPermissions);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDeny}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onDeny} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* App identity */}
        <View style={styles.appHeader}>
          <View style={styles.appIconWrapper}>
            {typeof appIcon === 'string' && appIcon.length <= 2 ? (
              <Text style={styles.appIconEmoji}>{appIcon}</Text>
            ) : typeof appIcon === 'string' ? (
              <Image source={{ uri: appIcon }} style={styles.appIconImage} />
            ) : (
              <Image source={appIcon} style={styles.appIconImage} />
            )}
          </View>
          <Text style={styles.appName}>{appName}</Text>
          {developerName ? (
            <Text style={styles.developerName}>by {developerName}</Text>
          ) : null}
        </View>

        <Text style={styles.title}>"{appName}" wants to access</Text>
        <Text style={styles.subtitle}>
          Review what this app is requesting. You can revoke access at any time in Settings.
        </Text>

        {/* Permissions list */}
        <ScrollView style={styles.permList} showsVerticalScrollIndicator={false}>
          {requestedPermissions.map((perm) => {
            const meta = PERMISSION_META[perm] ?? { icon: 'shield', label: perm, description: '' };
            return (
              <View key={perm} style={styles.permRow}>
                <View style={styles.permIcon}>
                  <Feather name={meta.icon as any} size={18} color={Colors.primary} />
                </View>
                <View style={styles.permText}>
                  <Text style={styles.permLabel}>{meta.label}</Text>
                  {meta.description ? (
                    <Text style={styles.permDesc}>{meta.description}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.denyBtn} onPress={onDeny} activeOpacity={0.75}>
            <Text style={styles.denyText}>Don't Allow</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.allowBtn, loading && { opacity: 0.6 }]}
            onPress={handleGrant}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.allowText}>Allow</Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      width: '100%',
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: Spacing.lg,
      paddingBottom: 40,
      paddingTop: 12,
      maxHeight: SCREEN_HEIGHT * 0.82,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    appHeader: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    appIconWrapper: {
      width: 72,
      height: 72,
      borderRadius: 18,
      backgroundColor: Colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
      overflow: 'hidden',
    },
    appIconEmoji: { fontSize: 36 },
    appIconImage: { width: 72, height: 72, borderRadius: 18 },
    appName: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    developerName: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.xs,
    },
    subtitle: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: Spacing.lg,
    },
    permList: { marginBottom: Spacing.lg },
    permRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    permIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: Colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    permText: { flex: 1 },
    permLabel: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    permDesc: {
      ...Typography.caption,
      color: Colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    denyBtn: {
      flex: 1,
      height: 48,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    denyText: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    allowBtn: {
      flex: 1,
      height: 48,
      borderRadius: Radius.md,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    allowText: {
      ...Typography.body,
      fontWeight: '600',
      color: '#fff',
    },
  });
}
