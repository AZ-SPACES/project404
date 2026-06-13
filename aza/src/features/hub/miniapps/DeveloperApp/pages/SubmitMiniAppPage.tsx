import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Switch,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveMiniApp } from '../../../../../services/api';
import { ThemeColors, Spacing, Radius, Typography } from '../../../../../theme';
import { NavProps } from '../types';

const CATEGORIES = [
  'Finance', 'Shopping', 'Transport', 'Food & Drink',
  'Entertainment', 'Productivity', 'Business', 'Games',
];

const ALL_PERMISSIONS = [
  { key: 'USER_PROFILE',       label: 'User Profile',        desc: 'Name and avatar' },
  { key: 'USER_PHONE',         label: 'Phone Number',        desc: 'User\'s phone' },
  { key: 'USER_EMAIL',         label: 'Email Address',       desc: 'User\'s email' },
  { key: 'MAKE_PAYMENTS',      label: 'Make Payments',       desc: 'Initiate wallet payments' },
  { key: 'READ_BALANCE',       label: 'Read Balance',        desc: 'View wallet balance' },
  { key: 'READ_TRANSACTIONS',  label: 'Transactions',        desc: 'Read transaction history' },
];

export default function SubmitMiniAppPage({ navigate, goBack, Colors }: NavProps) {
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const qc = useQueryClient();

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [iconUrl, setIconUrl] = useState('');
  const [url, setUrl] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [supportUrl, setSupportUrl] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [submitForReview, setSubmitForReview] = useState(true);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => saveMiniApp({
      id: id.trim(), name: name.trim(), description: description.trim(),
      category, iconUrl: iconUrl.trim(), url: url.trim(),
      developerName: developerName.trim(),
      supportUrl: supportUrl.trim() || undefined,
      version: version.trim(),
      requestedPermissions: Array.from(permissions),
      submitForReview,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myMiniApps'] });
      goBack();
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? e.message ?? 'Failed to save'),
  });

  const togglePerm = (key: string) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const valid = id && name && description && url.startsWith('https://') && developerName;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Colors.border }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors.textPrimary }]}>Submit Mini App</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, { color: Colors.textSecondary }]}>IDENTITY</Text>

        <Field label="App ID" Colors={Colors} styles={styles}>
          <TextInput
            style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border }]}
            value={id}
            onChangeText={setId}
            placeholder="my_app_id (lowercase, underscores)"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>

        <Field label="Display Name" Colors={Colors} styles={styles}>
          <TextInput
            style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="My Awesome App"
            placeholderTextColor={Colors.textSecondary}
          />
        </Field>

        <Field label="Description" Colors={Colors} styles={styles}>
          <TextInput
            style={[styles.textarea, { color: Colors.textPrimary, borderColor: Colors.border }]}
            value={description}
            onChangeText={setDescription}
            placeholder="What does your app do?"
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Field>

        <Field label="Developer Name" Colors={Colors} styles={styles}>
          <TextInput
            style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border }]}
            value={developerName}
            onChangeText={setDeveloperName}
            placeholder="Your name or company"
            placeholderTextColor={Colors.textSecondary}
          />
        </Field>

        <Text style={[styles.section, { color: Colors.textSecondary }]}>APP DETAILS</Text>

        <Field label="App URL (HTTPS)" Colors={Colors} styles={styles}>
          <TextInput
            style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border }]}
            value={url}
            onChangeText={setUrl}
            placeholder="https://myapp.example.com"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <Field label="Icon URL (HTTPS)" Colors={Colors} styles={styles}>
          <TextInput
            style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border }]}
            value={iconUrl}
            onChangeText={setIconUrl}
            placeholder="https://myapp.example.com/icon.png"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <Field label="Version" Colors={Colors} styles={styles}>
          <TextInput
            style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border }]}
            value={version}
            onChangeText={setVersion}
            placeholder="1.0.0"
            placeholderTextColor={Colors.textSecondary}
          />
        </Field>

        <Field label="Support URL (optional)" Colors={Colors} styles={styles}>
          <TextInput
            style={[styles.input, { color: Colors.textPrimary, borderColor: Colors.border }]}
            value={supportUrl}
            onChangeText={setSupportUrl}
            placeholder="https://myapp.example.com/support"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>

        <Text style={[styles.section, { color: Colors.textSecondary }]}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
          <View style={styles.chips}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.chip,
                  { borderColor: category === cat ? Colors.primary : Colors.border },
                  category === cat && { backgroundColor: Colors.primary + '22' },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, { color: category === cat ? Colors.primary : Colors.textSecondary }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={[styles.section, { color: Colors.textSecondary }]}>PERMISSIONS REQUESTED</Text>
        <Text style={[styles.permNote, { color: Colors.textSecondary }]}>
          Users will be shown this list and must approve before your app can access their data.
        </Text>
        {ALL_PERMISSIONS.map(({ key, label, desc }) => (
          <TouchableOpacity
            key={key}
            style={[styles.permRow, { borderBottomColor: Colors.border }]}
            onPress={() => togglePerm(key)}
            activeOpacity={0.7}
          >
            <View style={styles.permText}>
              <Text style={[styles.permLabel, { color: Colors.textPrimary }]}>{label}</Text>
              <Text style={[styles.permDesc, { color: Colors.textSecondary }]}>{desc}</Text>
            </View>
            <View style={[
              styles.checkbox,
              { borderColor: permissions.has(key) ? Colors.primary : Colors.border },
              permissions.has(key) && { backgroundColor: Colors.primary },
            ]}>
              {permissions.has(key) && <Feather name="check" size={12} color="#fff" />}
            </View>
          </TouchableOpacity>
        ))}

        <View style={[styles.submitToggleRow, { borderColor: Colors.border }]}>
          <View style={styles.permText}>
            <Text style={[styles.permLabel, { color: Colors.textPrimary }]}>Submit for review</Text>
            <Text style={[styles.permDesc, { color: Colors.textSecondary }]}>
              Saves as draft if off; submits to admin queue if on
            </Text>
          </View>
          <Switch
            value={submitForReview}
            onValueChange={setSubmitForReview}
            trackColor={{ false: Colors.border, true: Colors.primary }}
          />
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: Colors.primary }, !valid && { opacity: 0.5 }]}
          onPress={() => save.mutate()}
          disabled={!valid || save.isPending}
        >
          {save.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {submitForReview ? 'Submit for Review' : 'Save as Draft'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({ label, children, Colors, styles }: { label: string; children: React.ReactNode; Colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: Colors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '600' },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 3 },
    section: {
      ...Typography.caption,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    field: { marginBottom: Spacing.md },
    fieldLabel: { ...Typography.caption, fontWeight: '600', marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 14,
    },
    textarea: {
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 14,
      minHeight: 80,
    },
    chips: { flexDirection: 'row', gap: 8, paddingBottom: Spacing.sm },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: Radius.full,
      borderWidth: 1,
    },
    chipText: { fontSize: 13, fontWeight: '600' },
    permNote: { ...Typography.caption, marginBottom: Spacing.md, lineHeight: 18 },
    permRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
    },
    permText: { flex: 1, marginRight: Spacing.md },
    permLabel: { fontSize: 14, fontWeight: '600' },
    permDesc: { ...Typography.caption, marginTop: 2 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      marginTop: Spacing.lg,
      marginBottom: Spacing.md,
    },
    errorText: {
      color: '#ef4444',
      ...Typography.caption,
      marginBottom: Spacing.md,
    },
    submitBtn: {
      height: 52,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}
