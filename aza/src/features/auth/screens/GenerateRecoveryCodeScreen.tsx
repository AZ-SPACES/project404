import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { BackButton } from '../../../components/ui/BackButton';
import { RootStackParamList } from '../../../navigation/types';
import { generateRecoveryCode, secondsUntilRefresh } from '../../../utils/recoveryTotp';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'GenerateRecoveryCode'>;
type RouteType = RouteProp<RootStackParamList, 'GenerateRecoveryCode'>;

const SECRET_KEY_PREFIX = 'arc_totp_';

export default function GenerateRecoveryCodeScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { requestId, requesterName, requesterHandle } = route.params;

  const [code, setCode] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(secondsUntilRefresh());
  const [revealed, setRevealed] = useState(false);
  const [hasSecret, setHasSecret] = useState(true);

  const refreshCode = useCallback(async () => {
    // requestId is the entry UUID — used as the SecureStore key suffix
    const secret = await SecureStore.getItemAsync(SECRET_KEY_PREFIX + requestId);
    if (!secret) {
      setHasSecret(false);
      return;
    }
    setCode(generateRecoveryCode(secret));
    setTimeLeft(secondsUntilRefresh());
  }, [requestId]);

  useEffect(() => {
    refreshCode();
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      refreshCode();
      return;
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, refreshCode]);

  const display = requesterHandle ? `${requesterName} (@${requesterHandle})` : requesterName;
  const progress = timeLeft / 30;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          <Feather name="shield" size={40} color={Colors.primary} />
        </View>

        <Text style={styles.title}>{requesterName} needs your help</Text>
        <Text style={styles.subtitle}>
          {display} is locked out and needs you to read them the current recovery code.
          Only do this if you personally spoke to them first.
        </Text>

        {!hasSecret ? (
          <View style={styles.errorBox}>
            <Feather name="alert-triangle" size={20} color="#991B1B" />
            <Text style={styles.errorText}>
              Recovery key not found on this device. You may have reinstalled the app.
              Ask {requesterName} to remove and re-add you as a recovery contact.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.codeCard}>
              {revealed && code ? (
                <>
                  <Text style={styles.codeText}>{code.slice(0, 3)} {code.slice(3)}</Text>
                  <View style={styles.timerRow}>
                    <View style={[styles.timerBar, { width: `${progress * 100}%` as any,
                      backgroundColor: timeLeft <= 5 ? '#EF4444' : Colors.primary }]} />
                  </View>
                  <Text style={styles.timerText}>{timeLeft}s</Text>
                </>
              ) : (
                <TouchableOpacity style={styles.revealBtn} onPress={() => setRevealed(true)}>
                  <Feather name="eye" size={20} color={Colors.primary} />
                  <Text style={styles.revealText}>Tap to reveal code</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.warningBox}>
              <Feather name="alert-triangle" size={15} color="#B45309" />
              <Text style={styles.warningText}>
                Read this code aloud directly to {requesterName}. Never type or send it.
              </Text>
            </View>
          </>
        )}

        <View style={styles.footer}>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.full}
            paddingVertical={14}
          />
          <Button
            title="This wasn't me — ignore"
            onPress={() => navigation.goBack()}
            backgroundColor="transparent"
            textColor={Colors.textSecondary}
            borderRadius={Radius.full}
            paddingVertical={12}
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
    header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 40 },
    iconWrap: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,51,0,0.06)',
      justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
    },
    title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
    subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
    codeCard: {
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderRadius: 20, paddingVertical: 32, paddingHorizontal: 24,
      alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
      marginBottom: Spacing.lg, minHeight: 130,
      justifyContent: 'center',
    },
    codeText: {
      fontSize: 48, fontWeight: '800', color: Colors.textPrimary,
      letterSpacing: 8, fontFamily: 'monospace',
    },
    timerRow: {
      height: 3, backgroundColor: Colors.border, borderRadius: 2,
      width: '80%', marginTop: Spacing.lg, overflow: 'hidden',
    },
    timerBar: { height: '100%', borderRadius: 2 },
    timerText: { fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
    revealBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    revealText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
    warningBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: '#FFFBEB', padding: 14, borderRadius: 12,
      borderWidth: 1, borderColor: '#FEF3C7', marginBottom: Spacing.xl,
    },
    warningText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
    errorBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: '#FEF2F2', padding: 14, borderRadius: 12,
      borderWidth: 1, borderColor: '#FECACA', marginBottom: Spacing.xl,
    },
    errorText: { flex: 1, fontSize: 13, color: '#991B1B', lineHeight: 18 },
    footer: { gap: Spacing.sm },
  });
}
