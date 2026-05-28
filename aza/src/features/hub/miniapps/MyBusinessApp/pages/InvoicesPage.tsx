import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  Modal, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing, Radius } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import {
  getMerchantInvoices,
  createMerchantInvoice,
  sendMerchantInvoice,
  cancelMerchantInvoice,
} from '../../../../../services/api';
import InternalHeader from '../components/InternalHeader';
import StatusBadge from '../components/StatusBadge';

function CreateModal({ visible, onClose, onCreated, Colors }: any) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = customerName.trim() && customerEmail.includes('@') && parseFloat(amount) > 0;

  const submit = async () => {
    setSaving(true);
    try {
      const payload: Parameters<typeof createMerchantInvoice>[0] = {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        amount: parseFloat(amount),
      };
      if (description.trim()) payload.description = description.trim();
      await createMerchantInvoice(payload);
      onCreated();
      onClose();
      setCustomerName(''); setCustomerEmail(''); setAmount(''); setDescription('');
    } catch {
      Alert.alert('Error', 'Failed to create invoice. Please try again.');
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
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md }}>New Invoice</Text>

            <Text style={labelStyle}>Customer name *</Text>
            <TextInput style={inputStyle} value={customerName} onChangeText={setCustomerName} placeholder="John Doe" placeholderTextColor={Colors.textSecondary} />

            <Text style={labelStyle}>Customer email *</Text>
            <TextInput style={inputStyle} value={customerEmail} onChangeText={setCustomerEmail} placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textSecondary} />

            <Text style={labelStyle}>Amount (GHS) *</Text>
            <TextInput style={inputStyle} value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={Colors.textSecondary} />

            <Text style={labelStyle}>Description (optional)</Text>
            <TextInput style={inputStyle} value={description} onChangeText={setDescription} placeholder="Service description…" placeholderTextColor={Colors.textSecondary} />

            <TouchableOpacity
              style={{
                backgroundColor: canSubmit ? Colors.primary : Colors.border,
                borderRadius: 12,
                padding: Spacing.md,
                alignItems: 'center',
                marginTop: Spacing.lg,
              }}
              onPress={submit}
              disabled={!canSubmit || saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Invoice</Text>
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

export default function InvoicesPage({ goBack, Colors, styles }: NavProps) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getMerchantInvoices(0, 30)
      .then((r: any) => setInvoices(extractData(r)?.content ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSend = async (inv: any) => {
    setActionLoading(inv.id);
    try {
      await sendMerchantInvoice(inv.id);
      load();
    } catch {
      Alert.alert('Error', 'Failed to send invoice.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = (inv: any) => {
    Alert.alert('Cancel Invoice', 'Are you sure you want to cancel this invoice?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Invoice', style: 'destructive', onPress: async () => {
          setActionLoading(inv.id);
          try {
            await cancelMerchantInvoice(inv.id);
            load();
          } catch {
            Alert.alert('Error', 'Failed to cancel invoice.');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Invoices" onBack={goBack} Colors={Colors} styles={styles} />

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
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>New Invoice</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={[styles.center, { marginTop: Spacing.xl }]}><ActivityIndicator color={Colors.primary} /></View>
      ) : invoices.length === 0 ? (
        <View style={styles.center}>
          <Feather name="file-text" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No invoices yet
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {invoices.map((inv) => (
            <View
              key={inv.id}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.surface,
                borderRadius: 10,
                padding: Spacing.md,
                marginBottom: Spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>
                  {fmtAmount(inv.amount, inv.currency)}
                </Text>
                <StatusBadge status={inv.status} Colors={Colors} />
              </View>
              <Text style={{ fontSize: 13, color: Colors.textPrimary, fontWeight: '500' }}>
                {inv.customerName}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{inv.customerEmail}</Text>
              {inv.description ? (
                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{inv.description}</Text>
              ) : null}
              <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: Spacing.xs }}>
                Created: {fmtDate(inv.createdAt)}
                {inv.dueDate ? `  ·  Due: ${fmtDate(inv.dueDate)}` : ''}
              </Text>

              {(inv.status === 'DRAFT' || inv.status === 'SENT') && (
                <View style={{ flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm }}>
                  {inv.status === 'DRAFT' && (
                    <TouchableOpacity
                      style={{
                        flex: 1, backgroundColor: Colors.primary, borderRadius: 8,
                        padding: 10, alignItems: 'center',
                      }}
                      onPress={() => handleSend(inv)}
                      disabled={actionLoading === inv.id}
                    >
                      {actionLoading === inv.id ? <ActivityIndicator size="small" color="#fff" /> : (
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Send</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={{
                      flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
                      padding: 10, alignItems: 'center',
                    }}
                    onPress={() => handleCancel(inv)}
                    disabled={actionLoading === inv.id}
                  >
                    <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <CreateModal
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={load}
        Colors={Colors}
      />
    </View>
  );
}
