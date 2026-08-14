import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../../theme';
import type { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';
import Button from '../../../components/ui/Button';
import { previewAkyede, openAkyede, Akyede, AkyedeOccasion } from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';
import { useDisplayContext } from '../../../providers/DisplayProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'AkyedeOpen'>;

const BLOCKED_COPY: Record<string, string> = {
  EXPIRED: 'This gift expired unopened. The money went back to whoever sent it.',
  ALREADY_OPENED: 'You already opened this one.',
  NOT_YOURS: 'This gift was meant for someone else.',
  OWN_GIFT: 'You sent this one. It is waiting for them to open it.',
};

const OCCASION_ART: Record<AkyedeOccasion, { emoji: string; line: string }> = {
  BIRTHDAY: { emoji: '🎂', line: 'for your birthday' },
  WEDDING: { emoji: '💍', line: 'for your wedding' },
  OUTDOORING: { emoji: '👶', line: 'for the outdooring' },
  GRADUATION: { emoji: '🎓', line: 'for your graduation' },
  CONGRATULATIONS: { emoji: '🎉', line: 'to say well done' },
  THANK_YOU: { emoji: '🙏', line: 'to say thank you' },
  CHRISTMAS: { emoji: '🎄', line: 'for Christmas' },
  EID: { emoji: '🌙', line: 'for Eid' },
  EASTER: { emoji: '🐣', line: 'for Easter' },
  JUST_BECAUSE: { emoji: '💛', line: 'just because' },
};

export default function AkyedeOpenScreen({ navigation, route }: Props) {
  const { claimCode } = route.params;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  // The reveal is the point of a gift, but it is decoration — honour the setting and
  // show the amount instantly rather than animating it into view.
  const { reducedMotion } = useDisplayContext();

  const [gift, setGift] = useState<Akyede | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const seal = useRef(new Animated.Value(0)).current;
  const amountScale = useRef(new Animated.Value(0.6)).current;

  const load = useCallback(async () => {
    try {
      const res = await previewAkyede(claimCode);
      const data: Akyede = res.data?.data ?? res.data;
      setGift(data);
      // Coming back to one you already opened shouldn't replay the reveal.
      if (data.status === 'OPENED') setRevealed(true);
    } catch (e) {
      setError(extractErrorMessage(e, 'This Akyede is not valid.'));
    } finally {
      setLoading(false);
    }
  }, [claimCode]);

  useEffect(() => { load(); }, [load]);

  const runReveal = () => {
    if (reducedMotion) {
      seal.setValue(1);
      amountScale.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.timing(seal, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(amountScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
  };

  const open = async () => {
    if (opening) return;
    setOpening(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    try {
      const res = await openAkyede(claimCode);
      const data: Akyede = res.data?.data ?? res.data;
      setGift(data);
      setRevealed(true);
      runReveal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      // Reload so the screen shows what actually happened rather than an error sitting
      // over a stale gift — an expiry that beat the tap, most likely.
      setError(extractErrorMessage(e, 'Could not open this Akyede.'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      load();
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.secondary} />
      </SafeAreaView>
    );
  }

  if (!gift) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={Colors.textSecondary} />
          <Text style={styles.blockedText}>{error ?? 'This Akyede is not valid.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const blocked = !gift.openable ? gift.blockedReason ?? null : null;
  const showOpenButton = gift.openable && !revealed;
  const art = OCCASION_ART[gift.occasion ?? 'JUST_BECAUSE'];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Who sent it */}
        <View style={styles.senderRow}>
          {gift.senderAvatarUrl ? (
            <Image source={{ uri: gift.senderAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Feather name="user" size={20} color={Colors.secondary} />
            </View>
          )}
          <Text style={styles.senderName}>{gift.senderName}</Text>
          <Text style={styles.senderCaption}>
            {gift.sentByMe
              ? `sent an Akyede to ${gift.recipientName ?? 'someone'}`
              : `sent you an Akyede ${art.line}`}
          </Text>
        </View>

        {gift.message ? <Text style={styles.message}>“{gift.message}”</Text> : null}

        {/* The gift itself */}
        <Animated.View
          style={[
            styles.envelope,
            !reducedMotion && {
              transform: [{
                rotate: seal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] }),
              }],
            },
          ]}
        >
          {gift.amount != null ? (
            <Animated.View style={{ transform: [{ scale: revealed ? amountScale : 1 }], alignItems: 'center' }}>
              <Text style={styles.youGot}>{gift.sentByMe ? 'You gave' : 'You got'}</Text>
              <Text style={styles.amount}>GH₵ {Number(gift.amount).toFixed(2)}</Text>
              {gift.status === 'OPENED' && !gift.sentByMe && (
                <Text style={styles.landedNote}>It&apos;s in your wallet.</Text>
              )}
            </Animated.View>
          ) : (
            <>
              <Text style={styles.wrappedEmoji}>{art.emoji}</Text>
              <Text style={styles.envelopeHint}>
                {blocked ? 'Still wrapped' : 'Tap open to see what’s inside'}
              </Text>
            </>
          )}
        </Animated.View>

        {showOpenButton && (
          <View style={styles.claimWrap}>
            <Button
              title={opening ? 'Opening…' : 'Open your gift'}
              onPress={open}
              loading={opening}
              backgroundColor={Colors.secondary}
              textColor={Colors.primary}
            />
          </View>
        )}

        {blocked && !revealed && (
          <Text style={styles.blockedText}>{BLOCKED_COPY[blocked] ?? 'This Akyede is finished.'}</Text>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* The sender's side: whether it has landed yet */}
        {gift.sentByMe && (
          <View style={styles.statusCard}>
            <Feather
              name={gift.status === 'OPENED' ? 'check-circle' : gift.status === 'EXPIRED_REFUNDED' ? 'rotate-ccw' : 'clock'}
              size={16}
              color={Colors.white70}
            />
            <Text style={styles.statusText}>
              {gift.status === 'OPENED'
                ? `${(gift.recipientName ?? 'They').split(' ')[0]} opened it.`
                : gift.status === 'EXPIRED_REFUNDED'
                  ? 'It went unopened, so the money came back to you.'
                  : `Waiting for ${(gift.recipientName ?? 'them').split(' ')[0]} to open it.`}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.primary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
    header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    content: { padding: Spacing.lg, alignItems: 'center', paddingBottom: Spacing.xl },
    senderRow: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.md },
    avatar: { width: 56, height: 56, borderRadius: 28 },
    avatarFallback: {
      backgroundColor: Colors.white20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    senderName: { ...Typography.h3, color: Colors.white },
    senderCaption: { ...Typography.body, color: Colors.white70, textAlign: 'center' },
    message: {
      ...Typography.bodyLg,
      color: Colors.white90,
      textAlign: 'center',
      fontStyle: 'italic',
      marginBottom: Spacing.lg,
    },
    envelope: {
      width: 260,
      height: 260,
      borderRadius: 24,
      backgroundColor: Colors.white10,
      borderWidth: 1,
      borderColor: Colors.white20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    wrappedEmoji: { fontSize: 64 },
    envelopeHint: { ...Typography.body, color: Colors.white70 },
    youGot: { ...Typography.body, color: Colors.white70, marginBottom: Spacing.xs },
    amount: { ...Typography.h1, fontSize: 40, color: Colors.secondary },
    landedNote: { ...Typography.caption, color: Colors.white70, marginTop: Spacing.sm },
    claimWrap: { width: '100%', marginBottom: Spacing.md },
    blockedText: {
      ...Typography.body,
      color: Colors.white70,
      textAlign: 'center',
      marginTop: Spacing.md,
    },
    errorText: { ...Typography.body, color: Colors.error, textAlign: 'center', marginTop: Spacing.sm },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      width: '100%',
      backgroundColor: Colors.white10,
      borderRadius: 14,
      padding: Spacing.md,
      marginTop: Spacing.lg,
    },
    statusText: { ...Typography.body, color: Colors.white70, flex: 1 },
  });
