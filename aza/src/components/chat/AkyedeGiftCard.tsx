import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import * as Haptics from 'expo-haptics';
import { useAppTheme, Typography, Spacing, ThemeColors } from '../../theme';
import { previewAkyede, openAkyede, Akyede, AkyedeOccasion } from '../../services/api';
import { extractErrorMessage } from '../../utils/errorUtils';
import { akyedeArt, akyedeFirstName } from '../../utils/akyedeOccasions';
import { useDisplayContext } from '../../providers/DisplayProvider';

type Props = {
  claimCode: string;
  /** True when the viewer sent the gift. Stands in until the server answers. */
  isMe: boolean;
  /**
   * Wrapping from the sealed card, shown while the gift itself is loading. Widened to a
   * bare string because it comes out of a JSON card the sender sealed, not from the API.
   */
  fallbackOccasion?: AkyedeOccasion | string | null;
  fallbackNote?: string | null;
};

const BLOCKED_COPY: Record<string, string> = {
  NOT_YOURS: 'This one was meant for someone else.',
  ALREADY_OPENED: 'You already opened this one.',
};

/**
 * An Akyede in a thread — a gift card the recipient taps to reveal.
 *
 * The card in the conversation is a sealed pointer and nothing more: it carries the claim
 * code, never the amount. What the gift holds comes from the server, which withholds it
 * from the recipient until they open it, so the surprise survives even though the message
 * itself is readable on their device the moment it arrives.
 *
 * Opening is the money movement, and it happens here — one tap credits the wallet and the
 * card turns over to show what landed. The full gift screen is still reachable by tapping
 * the card around the seal, and is where a gift that arrived by deep link or QR is opened.
 */
export function AkyedeGiftCard({ claimCode, isMe, fallbackOccasion, fallbackNote }: Props) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  // The reveal is the point of a gift, but it is still decoration — honour the setting
  // and put the amount on screen at once rather than animating it in.
  const { reducedMotion } = useDisplayContext();

  const [gift, setGift] = useState<Akyede | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sits at 1 so a gift that was already open when the thread loaded is simply shown;
  // it is knocked back to 0 only for the reveal that follows an actual tap.
  const reveal = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    try {
      const res = await previewAkyede(claimCode);
      setGift(res.data?.data ?? res.data);
      setError(null);
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not load this gift.'));
    } finally {
      setLoading(false);
    }
  }, [claimCode]);

  useEffect(() => { load(); }, [load]);

  const open = async () => {
    if (opening) return;
    setOpening(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    try {
      const res = await openAkyede(claimCode);
      const opened: Akyede = res.data?.data ?? res.data;
      if (!reducedMotion) reveal.setValue(0);
      setGift(opened);
      if (!reducedMotion) {
        Animated.spring(reveal, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not open this gift.'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      // Reload so the card shows what actually happened rather than an error sitting over
      // a stale gift — an expiry that beat the tap, most likely.
      load();
    } finally {
      setOpening(false);
    }
  };

  const art = akyedeArt(gift?.occasion ?? fallbackOccasion);
  const note = gift?.message ?? fallbackNote ?? null;
  const sentByMe = gift?.sentByMe ?? isMe;
  const status = gift?.status ?? 'UNOPENED';
  const amount = gift?.amount;
  // Only the person it is addressed to, on a gift still standing, gets the reveal.
  const canOpen = !!gift?.openable && status === 'UNOPENED';

  const meta = sentByMe
    ? `to ${akyedeFirstName(gift?.recipientName)} · ${art.label}`
    : `from ${akyedeFirstName(gift?.senderName, 'someone')} · ${art.line}`;

  const footnote = sentByMe
    ? status === 'OPENED'
      ? `${akyedeFirstName(gift?.recipientName, 'They')} opened it.`
      : status === 'EXPIRED_REFUNDED'
        ? 'It went unopened, so the money came back to you.'
        : `Waiting for ${akyedeFirstName(gift?.recipientName)} to open it.`
    : status === 'OPENED'
      ? "It's in your wallet."
      : status === 'EXPIRED_REFUNDED'
        ? `It expired unopened. The money went back to ${akyedeFirstName(gift?.senderName, 'them')}.`
        : gift && !gift.openable
          ? BLOCKED_COPY[gift.blockedReason ?? ''] ?? null
          : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.emojiTile}>
          <Text style={styles.emoji}>{art.emoji}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>Akyede</Text>
          {loading ? (
            <Text style={styles.meta}>Loading…</Text>
          ) : (
            <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
          )}
        </View>
      </View>

      {!!note && <Text style={styles.note} numberOfLines={2}>“{note}”</Text>}

      {canOpen ? (
        <TouchableOpacity
          style={styles.seal}
          onPress={open}
          disabled={opening}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open your Akyede"
        >
          {opening ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Feather name="gift" size={15} color={Colors.primary} />
              <Text style={styles.sealText}>Tap to open</Text>
            </>
          )}
        </TouchableOpacity>
      ) : amount != null ? (
        <Animated.View
          style={[
            styles.amountWrap,
            {
              opacity: reveal,
              transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            },
          ]}
        >
          <Text style={styles.amountLabel}>{sentByMe ? 'You gave' : 'You got'}</Text>
          <Text style={styles.amount}>GH₵ {Number(amount).toFixed(2)}</Text>
        </Animated.View>
      ) : (
        <View style={styles.amountWrap}>
          <Text style={styles.wrappedHint}>{loading ? ' ' : 'Still wrapped'}</Text>
        </View>
      )}

      {!!footnote && <Text style={styles.footnote}>{footnote}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    // Its own surface rather than the bubble's, so a gift reads as a gift card in the
    // thread whatever colour the sender has set their bubbles to.
    card: {
      minWidth: 232,
      maxWidth: 268,
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      backgroundColor: Colors.primary,
      borderWidth: 1,
      borderColor: Colors.white20,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    emojiTile: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: Colors.white10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: { fontSize: 20 },
    title: { ...Typography.bodyLg, fontWeight: '700', color: Colors.white },
    meta: { ...Typography.caption, color: Colors.white70 },
    note: { ...Typography.body, color: Colors.white90, fontStyle: 'italic' },
    seal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      height: 44,
      borderRadius: 12,
      backgroundColor: Colors.secondary,
    },
    sealText: { ...Typography.button, fontSize: 14, color: Colors.primary },
    amountWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xs,
      borderRadius: 12,
      backgroundColor: Colors.white10,
      minHeight: 44,
    },
    amountLabel: { ...Typography.caption, color: Colors.white70 },
    amount: { ...Typography.h3, color: Colors.secondary },
    wrappedHint: { ...Typography.caption, color: Colors.white70 },
    footnote: { ...Typography.caption, color: Colors.white70 },
    error: { ...Typography.caption, color: Colors.error },
  });
