import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
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
import { createAkyede, Akyede, AkyedeOccasion } from '../../../services/api';
import { AKYEDE_OCCASION_ART as OCCASIONS, akyedeArt } from '../../../utils/akyedeOccasions';
import { extractErrorMessage } from '../../../utils/errorUtils';
import { useToast } from '../../../providers/ToastProvider';
import { useChatStore } from '../../../store/chatStore';
import { useContactStore } from '../../../store/contactStore';
import type { Contact } from '../../contacts/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAkyede'>;

const AMOUNT_PRESETS = [20, 50, 100, 200];

/** A cryptographically unremarkable but unique key — one per gift attempt. */
function newIdempotencyKey() {
  return `akyede-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CreateAkyedeScreen({ navigation, route }: Props) {
  const chatId = route.params?.chatId;
  const prefill = route.params?.recipient;
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { showToast } = useToast();

  const [recipient, setRecipient] = useState<Contact | null>(
    prefill
      ? {
          id: prefill.identifier,
          displayName: prefill.name,
          isAzaUser: true,
          isFavorite: false,
          ...(prefill.handle ? { handle: prefill.handle } : {}),
          ...(prefill.avatar ? { profileImageUrl: prefill.avatar } : {}),
        }
      : null,
  );
  // Set only for a recipient a thread handed over, whose identifier is already in the
  // form the resolver wants. Cleared the moment the sender picks someone else, so the
  // gift can never go to the thread's peer under another person's name.
  const [identifierOverride, setIdentifierOverride] = useState<string | null>(
    prefill?.identifier ?? null,
  );

  const pickAnother = () => { setRecipient(null); setIdentifierOverride(null); };
  const [amount, setAmount] = useState('');
  const [occasion, setOccasion] = useState<AkyedeOccasion>('JUST_BECAUSE');
  const [message, setMessage] = useState('');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Akyede | null>(null);

  // Held across retries so a failure the server actually applied cannot become a second
  // gift when the sender taps again.
  const idempotencyKey = useRef(newIdempotencyKey());

  const numericAmount = parseFloat(amount) || 0;
  const canSend = !!recipient && numericAmount >= 1 && passcode.length === 4 && !busy;

  // The greeting follows the occasion until the sender writes their own.
  const [messageTouched, setMessageTouched] = useState(false);
  useEffect(() => {
    if (messageTouched) return;
    setMessage(OCCASIONS.find((o) => o.key === occasion)?.greeting ?? '');
  }, [occasion, messageTouched]);

  const submit = async () => {
    if (!canSend || !recipient) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusy(true);
    setError(null);
    try {
      const identifier = identifierOverride
        ?? (recipient.handle ? `@${recipient.handle}` : recipient.phoneNumber ?? recipient.email ?? '');

      const res = await createAkyede({
        recipient: identifier,
        amount: numericAmount,
        occasion,
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(chatId ? { chatId } : {}),
        passcode,
        idempotencyKey: idempotencyKey.current,
      });
      const gift: Akyede = res.data?.data ?? res.data;

      // Threads are end-to-end encrypted, so the card has to be sealed and sent from
      // here — the server has no key and cannot put one in the conversation itself.
      if (chatId) {
        const card = JSON.stringify({
          __akyede: true,
          claimCode: gift.claimCode,
          occasion: gift.occasion,
          ...(gift.message ? { note: gift.message } : {}),
        });
        // The gift exists either way; a failed card just means it waits in their inbox.
        useChatStore.getState().sendText(chatId, card).catch(() => {});
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSent(gift);
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not send your Akyede.'));
      setPasscode('');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return <SentView gift={sent} navigation={navigation} Colors={Colors} styles={styles} />;
  }

  if (!recipient) {
    return (
      <RecipientPicker
        onPick={(c) => { Haptics.selectionAsync().catch(() => {}); setRecipient(c); }}
        onCancel={() => navigation.goBack()}
        onError={(m) => showToast(m, 'error')}
        Colors={Colors}
        styles={styles}
      />
    );
  }

  const chosen = akyedeArt(occasion);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        {/* Straight back to the thread when it sent us here; otherwise back to the
            question of who the gift is for. */}
        <BackButton onPress={() => (prefill ? navigation.goBack() : pickAnother())} />
        <Text style={styles.headerTitle}>Send Akyede</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Who it is for */}
          <TouchableOpacity style={styles.recipientCard} onPress={pickAnother}>
            <Avatar contact={recipient} Colors={Colors} styles={styles} />
            <View style={styles.flex}>
              <Text style={styles.recipientName}>{recipient.displayName}</Text>
              {!!recipient.handle && <Text style={styles.recipientHandle}>@{recipient.handle}</Text>}
            </View>
            <Feather name="edit-2" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Amount */}
          <Text style={styles.label}>How much</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>GH₵</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>
          <View style={styles.chipRow}>
            {AMOUNT_PRESETS.map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setAmount(String(n)); }}
                style={[styles.chip, numericAmount === n && styles.chipActive]}
              >
                <Text style={[styles.chipText, numericAmount === n && styles.chipTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Occasion */}
          <Text style={styles.label}>What&apos;s the occasion</Text>
          <View style={styles.occasionGrid}>
            {OCCASIONS.map((o) => (
              <TouchableOpacity
                key={o.key}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setOccasion(o.key); }}
                style={[styles.occasionChip, occasion === o.key && styles.occasionChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: occasion === o.key }}
              >
                <Text style={styles.occasionEmoji}>{o.emoji}</Text>
                <Text style={[styles.occasionLabel, occasion === o.key && styles.occasionLabelActive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Greeting */}
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={(t) => { setMessageTouched(true); setMessage(t); }}
            placeholder={chosen.greeting}
            placeholderTextColor={Colors.textSecondary}
            maxLength={140}
          />

          {/* Sending a gift takes money out of the wallet, so it is confirmed the same
              way every other debit is. */}
          <Text style={styles.label}>Your passcode</Text>
          <TextInput
            style={styles.passcodeInput}
            value={passcode}
            onChangeText={(t) => setPasscode(t.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            textContentType="password"
          />

          {numericAmount >= 1 && (
            <Text style={styles.summary}>
              {recipient.displayName.split(' ')[0]} gets GH₵ {numericAmount.toFixed(2)} when they
              open it · unopened, it comes back to you in 7 days
            </Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={busy ? 'Sending…' : 'Send gift'}
            onPress={submit}
            disabled={!canSend}
            loading={busy}
            backgroundColor={canSend ? Colors.primary : Colors.border}
            textColor={canSend ? Colors.secondary : Colors.textSecondary}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Choosing who the gift is for. A gift is addressed, so this comes before anything else. */
function RecipientPicker({
  onPick,
  onCancel,
  onError,
  Colors,
  styles,
}: {
  onPick: (c: Contact) => void;
  onCancel: () => void;
  onError: (m: string) => void;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const { contacts, fetchContacts, searchGlobal } = useContactStore();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchContacts().catch(() => {});
  }, [fetchContacts]);

  // Contacts already on the device filter locally; anything else is a global lookup, so
  // a gift can go to someone who is on Aza but not yet in your contacts.
  const local = useMemo(() => {
    const q = query.trim().toLowerCase();
    const azaOnly = contacts.filter((c) => c.isAzaUser);
    if (!q) return azaOnly;
    return azaOnly.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.handle ?? '').toLowerCase().includes(q) ||
        (c.phoneNumber ?? '').includes(q),
    );
  }, [contacts, query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || local.length > 0) { setFound([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const profiles = await searchGlobal(q);
        if (cancelled) return;
        setFound(
          profiles.map((p: any) => ({
            id: p.id,
            contactUserId: p.id,
            displayName: p.displayName ?? p.name ?? p.username ?? 'Someone',
            handle: p.username ?? p.handle,
            profileImageUrl: p.profileImageUrl,
            isAzaUser: true,
            isFavorite: false,
          })),
        );
      } catch (e) {
        if (!cancelled) onError(extractErrorMessage(e, 'Could not search right now.'));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, local.length, searchGlobal, onError]);

  const rows = local.length > 0 ? local : found;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={onCancel} />
        <Text style={styles.headerTitle}>Who is it for?</Text>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Name, @handle, or number"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView contentContainerStyle={styles.pickerList} keyboardShouldPersistTaps="handled">
        {rows.map((c) => (
          <TouchableOpacity key={c.id} style={styles.pickerRow} onPress={() => onPick(c)}>
            <Avatar contact={c} Colors={Colors} styles={styles} />
            <View style={styles.flex}>
              <Text style={styles.recipientName}>{c.displayName}</Text>
              {!!c.handle && <Text style={styles.recipientHandle}>@{c.handle}</Text>}
            </View>
            <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {rows.length === 0 && (
          <Text style={styles.emptyPicker}>
            {searching
              ? 'Searching…'
              : query.trim().length >= 3
                ? 'Nobody on Aza matches that.'
                : 'Search for anyone on Aza, or pick from your contacts.'}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Avatar({
  contact,
  Colors,
  styles,
}: {
  contact: Contact;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  if (contact.profileImageUrl) {
    return <Image source={{ uri: contact.profileImageUrl }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitial}>
        {(contact.displayName || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** The sender's view once the gift is on its way. */
function SentView({
  gift,
  navigation,
  Colors,
  styles,
}: {
  gift: Akyede;
  navigation: Props['navigation'];
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const occasion = akyedeArt(gift.occasion);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Akyede sent</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.envelopeArt, { backgroundColor: Colors.success + '22' }]}>
          <Text style={styles.sentEmoji}>{occasion.emoji}</Text>
        </View>

        <Text style={styles.createdTitle}>
          GH₵ {(gift.amount ?? 0).toFixed(2)} for {gift.recipientName ?? 'them'}
        </Text>
        <Text style={styles.lead}>
          {(gift.recipientName ?? 'They').split(' ')[0]} has been told it&apos;s waiting. The money
          reaches them when they open it — and comes back to you if they never do.
        </Text>

        <View style={styles.actions}>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
          />
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.replace('MyAkyede')}
          >
            <Feather name="gift" size={16} color={Colors.textPrimary} />
            <Text style={styles.secondaryActionText}>See my gifts</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.md,
    },
    headerTitle: { ...Typography.h2, color: Colors.textPrimary },
    content: { padding: Spacing.md, paddingBottom: Spacing.xl, alignItems: 'stretch' },
    envelopeArt: {
      alignSelf: 'center',
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    sentEmoji: { fontSize: 34 },
    lead: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.lg,
    },
    createdTitle: {
      ...Typography.h2,
      color: Colors.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.xs,
    },
    label: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '700',
      marginBottom: Spacing.xs,
      marginTop: Spacing.md,
    },
    recipientCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    recipientName: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    recipientHandle: { ...Typography.caption, color: Colors.textSecondary },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarFallback: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { ...Typography.h3, color: Colors.secondary },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
    },
    currency: { ...Typography.h3, color: Colors.textSecondary, marginRight: Spacing.sm },
    amountInput: { flex: 1, ...Typography.h1, color: Colors.textPrimary, paddingVertical: Spacing.sm },
    chipRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.sm },
    chip: {
      minWidth: 60,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      alignItems: 'center',
    },
    chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    chipText: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
    chipTextActive: { color: Colors.secondary },
    occasionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    occasionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    occasionChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
    occasionEmoji: { fontSize: 15 },
    occasionLabel: { ...Typography.body, color: Colors.textPrimary },
    occasionLabelActive: { fontWeight: '700' },
    passcodeInput: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 4,
      ...Typography.h3,
      letterSpacing: 10,
      textAlign: 'center',
      color: Colors.textPrimary,
    },
    messageInput: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 4,
      ...Typography.bodyLg,
      color: Colors.textPrimary,
    },
    summary: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.md,
    },
    error: { ...Typography.body, color: Colors.error, textAlign: 'center', marginTop: Spacing.md },
    footer: { padding: Spacing.md },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    searchInput: { flex: 1, ...Typography.body, color: Colors.textPrimary, paddingVertical: 12 },
    pickerList: { padding: Spacing.md, gap: Spacing.xs },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.sm,
      borderRadius: 12,
    },
    emptyPicker: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.xl,
    },
    actions: { gap: Spacing.sm, marginTop: Spacing.lg },
    secondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    secondaryActionText: { ...Typography.button, fontSize: 15, color: Colors.textPrimary },
  });
