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
import { createSplit, Split } from '../../../services/api';
import { extractErrorMessage } from '../../../utils/errorUtils';
import { useContacts } from '../../../hooks/useContacts';
import type { Contact } from '../../contacts/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateSplit'>;

type Mode = 'EQUAL' | 'EXACT';

function newIdempotencyKey() {
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function identifierFor(c: Contact) {
  return c.handle ? `@${c.handle}` : c.phoneNumber ?? c.email ?? '';
}

export default function CreateSplitScreen({ navigation }: Props) {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { contacts, refetch: fetchContacts } = useContacts();
  const [total, setTotal] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<Mode>('EQUAL');
  const [picked, setPicked] = useState<Contact[]>([]);
  const [exact, setExact] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => { fetchContacts().catch(() => {}); }, [fetchContacts]);

  const numericTotal = parseFloat(total) || 0;
  // The organiser is on the bill too, so an even split is across everyone plus them.
  const headCount = picked.length + 1;
  const perHead = headCount > 0 ? numericTotal / headCount : 0;

  const namedTotal = picked.reduce((sum, c) => sum + (parseFloat(exact[c.id] ?? '') || 0), 0);
  const organiserShare = numericTotal - namedTotal;

  const exactOverflows = mode === 'EXACT' && namedTotal > numericTotal;
  const exactIncomplete = mode === 'EXACT' && picked.some((c) => !(parseFloat(exact[c.id] ?? '') > 0));

  const canSubmit =
    numericTotal >= 1 &&
    description.trim().length > 0 &&
    picked.length > 0 &&
    !exactOverflows &&
    !exactIncomplete &&
    !busy;

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pickedIds = new Set(picked.map((p) => p.id));
    return contacts
      .filter((c) => c.isAzaUser && !pickedIds.has(c.id))
      .filter((c) => !q || c.displayName.toLowerCase().includes(q) || (c.handle ?? '').toLowerCase().includes(q));
  }, [contacts, picked, query]);

  const submit = async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusy(true);
    setError(null);
    try {
      const res = await createSplit({
        totalAmount: numericTotal,
        description: description.trim(),
        splitMode: mode,
        participants: picked.map((c) => ({
          identifier: identifierFor(c),
          ...(mode === 'EXACT' ? { amount: parseFloat(exact[c.id] ?? '0') } : {}),
        })),
        idempotencyKey: idempotencyKey.current,
      });
      const split: Split = res.data?.data ?? res.data;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      navigation.replace('SplitDetail', { id: split.id });
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not split this bill.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Split a bill</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            You already paid. Say what it was for and who owes you a share.
          </Text>

          {/* What it was for */}
          <Text style={styles.label}>What was it for</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Dinner at Santoku"
            placeholderTextColor={Colors.textSecondary}
            maxLength={140}
          />

          {/* Total */}
          <Text style={styles.label}>Total bill</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>GH₵</Text>
            <TextInput
              style={styles.amountInput}
              value={total}
              onChangeText={(t) => setTotal(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Mode */}
          <Text style={styles.label}>How to divide it</Text>
          <View style={styles.modeRow}>
            {([
              ['EQUAL', 'Evenly', 'Everyone pays the same'],
              ['EXACT', 'By amount', 'You set what each person owes'],
            ] as const).map(([m, title, hint]) => (
              <TouchableOpacity
                key={m}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setMode(m); }}
                style={[styles.modeCard, mode === m && styles.modeCardActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m }}
              >
                <Text style={[styles.modeTitle, mode === m && styles.modeTitleActive]}>{title}</Text>
                <Text style={styles.modeHint}>{hint}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Who owes */}
          <Text style={styles.label}>Who owes you</Text>
          {picked.map((c) => (
            <View key={c.id} style={styles.pickedRow}>
              <Avatar contact={c} styles={styles} />
              <View style={styles.flex}>
                <Text style={styles.name}>{c.displayName}</Text>
                {mode === 'EQUAL' && numericTotal > 0 && (
                  <Text style={styles.owes}>owes GH₵ {perHead.toFixed(2)}</Text>
                )}
              </View>
              {mode === 'EXACT' && (
                <TextInput
                  style={styles.exactInput}
                  value={exact[c.id] ?? ''}
                  onChangeText={(t) => setExact((prev) => ({ ...prev, [c.id]: t.replace(/[^0-9.]/g, '') }))}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                />
              )}
              <TouchableOpacity
                onPress={() => setPicked((prev) => prev.filter((p) => p.id !== c.id))}
                accessibilityLabel={`Remove ${c.displayName}`}
              >
                <Feather name="x" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Add someone"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
            />
          </View>

          {available.slice(0, 6).map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.addRow}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setPicked((p) => [...p, c]); setQuery(''); }}
            >
              <Avatar contact={c} styles={styles} />
              <Text style={[styles.name, styles.flex]}>{c.displayName}</Text>
              <Feather name="plus" size={18} color={Colors.primary} />
            </TouchableOpacity>
          ))}

          {/* What it comes to */}
          {numericTotal > 0 && picked.length > 0 && (
            <Text style={styles.summary}>
              {mode === 'EQUAL'
                ? `${headCount} people · GH₵ ${perHead.toFixed(2)} each · you're owed GH₵ ${(numericTotal - perHead).toFixed(2)}`
                : `You're standing GH₵ ${Math.max(organiserShare, 0).toFixed(2)} of GH₵ ${numericTotal.toFixed(2)}`}
            </Text>
          )}
          {exactOverflows && (
            <Text style={styles.error}>
              Those shares come to GH₵ {namedTotal.toFixed(2)} — more than the bill.
            </Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={busy ? 'Asking…' : 'Ask for the shares'}
            onPress={submit}
            disabled={!canSubmit}
            loading={busy}
            backgroundColor={canSubmit ? Colors.primary : Colors.border}
            textColor={canSubmit ? Colors.secondary : Colors.textSecondary}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Avatar({ contact, styles }: { contact: Contact; styles: ReturnType<typeof createStyles> }) {
  if (contact.profileImageUrl) {
    return <Image source={{ uri: contact.profileImageUrl }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitial}>{(contact.displayName || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    headerTitle: { ...Typography.h2, color: Colors.textPrimary },
    content: { padding: Spacing.md, paddingBottom: Spacing.xl },
    lead: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.sm },
    label: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '700',
      marginBottom: Spacing.xs,
      marginTop: Spacing.md,
    },
    textInput: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 4,
      ...Typography.bodyLg,
      color: Colors.textPrimary,
    },
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
    modeRow: { flexDirection: 'row', gap: Spacing.sm },
    modeCard: {
      flex: 1,
      padding: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    modeCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '14' },
    modeTitle: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
    modeTitleActive: { color: Colors.textPrimary },
    modeHint: { ...Typography.caption, color: Colors.textSecondary },
    pickedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xs,
    },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    avatarFallback: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { ...Typography.body, fontWeight: '700', color: Colors.secondary },
    name: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
    owes: { ...Typography.caption, color: Colors.textSecondary },
    exactInput: {
      width: 84,
      textAlign: 'right',
      backgroundColor: Colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
      ...Typography.body,
      color: Colors.textPrimary,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    searchInput: { flex: 1, ...Typography.body, color: Colors.textPrimary, paddingVertical: 10 },
    summary: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.md,
    },
    error: { ...Typography.body, color: Colors.error, textAlign: 'center', marginTop: Spacing.sm },
    footer: { padding: Spacing.md },
  });
