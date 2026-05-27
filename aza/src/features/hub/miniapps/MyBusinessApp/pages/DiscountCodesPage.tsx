import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  Modal, Alert, KeyboardAvoidingView, Platform, TextInput, Clipboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography, Spacing, Radius } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtDate } from '../helpers';
import { getMerchantDiscountCodes, createMerchantDiscountCode } from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';

function CreateModal({ visible, onClose, onCreated, Colors }: any) {
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = code.trim().length >= 3 && parseFloat(value) > 0;

  const submit = async () => {
    setSaving(true);
    try {
      const payload: Parameters<typeof createMerchantDiscountCode>[0] = {
        code: code.trim().toUpperCase(),
        type,
        value: parseFloat(value),
      };
      if (maxUses) payload.maxUses = parseInt(maxUses);
      await createMerchantDiscountCode(payload);
      onCreated();
      onClose();
      setCode(''); setValue(''); setMaxUses('');
    } catch {
      Alert.alert('Error', 'Failed to create discount code.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.textPrimary,
    fontSize: 14,
    backgroundColor: Colors.background,
  };
  const labelStyle = { fontSize: 12, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md }}>New Discount Code</Text>

            <Text style={labelStyle}>Code *</Text>
            <TextInput style={inputStyle} value={code} onChangeText={setCode} placeholder="SAVE20" autoCapitalize="characters" placeholderTextColor={Colors.textSecondary} />

            <Text style={labelStyle}>Type</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {(['PERCENTAGE', 'FIXED'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={{
                    flex: 1, padding: 10, borderRadius: 10, borderWidth: 1,
                    borderColor: type === t ? Colors.primary : Colors.border,
                    backgroundColor: type === t ? Colors.primary + '18' : Colors.background,
                    alignItems: 'center',
                  }}
                  onPress={() => setType(t)}
                >
                  <Text style={{ color: type === t ? Colors.primary : Colors.textSecondary, fontWeight: '600', fontSize: 13 }}>
                    {t === 'PERCENTAGE' ? '% Off' : 'Fixed Off'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={labelStyle}>{type === 'PERCENTAGE' ? 'Discount %' : 'Amount (GHS)'} *</Text>
            <TextInput style={inputStyle} value={value} onChangeText={setValue} placeholder={type === 'PERCENTAGE' ? '10' : '5.00'} keyboardType="decimal-pad" placeholderTextColor={Colors.textSecondary} />

            <Text style={labelStyle}>Max uses (optional)</Text>
            <TextInput style={inputStyle} value={maxUses} onChangeText={setMaxUses} placeholder="Unlimited" keyboardType="number-pad" placeholderTextColor={Colors.textSecondary} />

            <TouchableOpacity
              style={{
                backgroundColor: canSubmit ? Colors.primary : Colors.border,
                borderRadius: 12, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
              }}
              onPress={submit}
              disabled={!canSubmit || saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={{ marginTop: Spacing.md, alignItems: 'center' }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function DiscountCodesPage({ goBack, Colors, styles }: NavProps) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getMerchantDiscountCodes(0, 40)
      .then((r: any) => setCodes(extractData(r)?.content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCopy = (code: string) => {
    Clipboard.setString(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Discount Codes" onBack={goBack} Colors={Colors} styles={styles} />

      <TouchableOpacity
        style={{
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          backgroundColor: Colors.primary,
          borderRadius: Radius.md,
          padding: Spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.xs,
        }}
        onPress={() => setCreating(true)}
      >
        <Feather name="plus" size={16} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>New Code</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={[styles.center, { marginTop: Spacing.xl }]}><ActivityIndicator color={Colors.primary} /></View>
      ) : codes.length === 0 ? (
        <View style={styles.center}>
          <Feather name="tag" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No discount codes yet
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {codes.map((c) => (
            <View
              key={c.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.surface,
                borderRadius: 10,
                padding: Spacing.md,
                marginBottom: Spacing.xs,
                gap: Spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.primary, fontVariant: ['tabular-nums'] }}>
                    {c.code}
                  </Text>
                  {!c.isActive && (
                    <View style={{ backgroundColor: Colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, color: Colors.textSecondary, fontWeight: '600' }}>INACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                  {c.type === 'PERCENTAGE' ? `${c.value}% off` : `GH₵${Number(c.value).toFixed(2)} off`}
                  {c.maxUses ? `  ·  ${c.usedCount ?? 0}/${c.maxUses} uses` : ''}
                  {c.expiresAt ? `  ·  Exp: ${fmtDate(c.expiresAt)}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleCopy(c.code)} style={{ padding: 6 }}>
                <Feather name={copied === c.code ? 'check' : 'copy'} size={16} color={copied === c.code ? Colors.primary : Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <CreateModal visible={creating} onClose={() => setCreating(false)} onCreated={load} Colors={Colors} />
    </View>
  );
}
