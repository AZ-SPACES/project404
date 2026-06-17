import React, { useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount } from '../helpers';
import {
  getMerchantProducts, createMerchantProduct, updateMerchantProduct, deleteMerchantProduct,
} from '../../../../../services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import InternalHeader from '../components/InternalHeader';

const QK = ['merchant-products'];

function ProductForm({
  visible, product, onClose, Colors,
}: {
  visible: boolean; product: any | null; onClose: () => void; Colors: any;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  async function save() {
    if (!name.trim() || !price.trim()) { setError('Name and price are required'); return; }
    const amt = parseFloat(price);
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid price'); return; }
    setSaving(true);
    setError(null);
    try {
      const data = {
        name: name.trim(),
        price: amt,
        description: description.trim() || undefined,
        sku: sku.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      };
      if (isEdit) {
        await updateMerchantProduct(product.id, data);
      } else {
        await createMerchantProduct(data);
      }
      qc.invalidateQueries({ queryKey: QK });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={sty.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
          <View style={[sty.sheet, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>
                {isEdit ? 'Edit Product' : 'New Product'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>
              {[
                { label: 'Name *', value: name, onChange: setName, placeholder: 'Product name', keyboardType: 'default' as const },
                { label: 'Price (GHS) *', value: price, onChange: setPrice, placeholder: '0.00', keyboardType: 'decimal-pad' as const },
                { label: 'Description', value: description, onChange: setDescription, placeholder: 'Optional description', keyboardType: 'default' as const },
                { label: 'SKU', value: sku, onChange: setSku, placeholder: 'Optional SKU', keyboardType: 'default' as const },
                { label: 'Image URL', value: imageUrl, onChange: setImageUrl, placeholder: 'https://...', keyboardType: 'url' as const },
              ].map(({ label, value, onChange, placeholder, keyboardType }) => (
                <View key={label}>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 6 }}>{label}</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textSecondary + '60'}
                    keyboardType={keyboardType}
                    style={[sty.input, { backgroundColor: Colors.background, borderColor: Colors.border, color: Colors.textPrimary }]}
                  />
                </View>
              ))}

              {error ? <Text style={{ color: '#F87171', fontSize: 12 }}>{error}</Text> : null}

              <TouchableOpacity
                onPress={save}
                disabled={saving}
                style={[sty.btn, { backgroundColor: '#174717', opacity: saving ? 0.4 : 1 }]}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#B7EE7A" />
                  : <Text style={{ fontSize: 14, fontWeight: '600', color: '#B7EE7A' }}>{isEdit ? 'Save Changes' : 'Create Product'}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ProductsPage({ goBack, Colors, styles }: NavProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const qc = useQueryClient();

  const { data: allProducts = [], isLoading: loading } = useQuery({
    queryKey: QK,
    queryFn: async () => { const r = await getMerchantProducts(0, 100); return extractData(r)?.content ?? []; },
    staleTime: 60_000,
  });

  const products = showArchived ? allProducts : allProducts.filter((p: any) => p.active);

  async function toggleActive(product: any) {
    try {
      await updateMerchantProduct(product.id, { active: !product.active });
      qc.invalidateQueries({ queryKey: QK });
    } catch {}
  }

  function confirmDelete(product: any) {
    Alert.alert(
      'Delete Product',
      `Delete "${product.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteMerchantProduct(product.id);
              qc.invalidateQueries({ queryKey: QK });
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message ?? 'Failed to delete');
            }
          },
        },
      ],
    );
  }

  const initials = (name: string) => (name || '?').charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Products" onBack={goBack} Colors={Colors} styles={styles} />

      {(showForm || editing) && (
        <ProductForm
          visible
          product={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          Colors={Colors}
        />
      )}

      {/* Toolbar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs }}>
        <TouchableOpacity onPress={() => setShowArchived(v => !v)}>
          <Text style={{ fontSize: 12, color: showArchived ? Colors.primary : Colors.textSecondary }}>
            {showArchived ? 'Showing all' : 'Active only'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setEditing(null); setShowForm(true); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#174717', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
        >
          <Feather name="plus" size={14} color="#B7EE7A" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#B7EE7A' }}>Add Product</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No products yet
          </Text>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: Spacing.md }}>
          {products.map((p: any) => (
            <View
              key={p.id}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.surface,
                borderRadius: 10,
                padding: Spacing.md,
                marginBottom: Spacing.xs,
                opacity: p.active ? 1 : 0.5,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {p.imageUrl ? (
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  <View style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.background }}>
                    <Text style={{ fontSize: 20, textAlign: 'center', lineHeight: 44 }}>🖼️</Text>
                  </View>
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.primary }}>{initials(p.name)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }} numberOfLines={1}>{p.name}</Text>
                  {p.description ? <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{p.description}</Text> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>{fmtAmount(p.price, p.currency)}</Text>
                    {p.sku ? <Text style={{ fontSize: 11, color: Colors.textSecondary }}>SKU: {p.sku}</Text> : null}
                    {!p.active ? <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: '#6B728022' }}><Text style={{ fontSize: 10, color: '#6B7280' }}>Archived</Text></View> : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => { setEditing(p); setShowForm(true); }} style={sty.iconBtn}>
                    <Feather name="edit-2" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleActive(p)} style={sty.iconBtn}>
                    <Feather name={p.active ? 'eye-off' : 'eye'} size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(p)} style={sty.iconBtn}>
                    <Feather name="trash-2" size={14} color="#F87171" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const sty = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '88%' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  btn: { borderRadius: 12, padding: 14, alignItems: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
});
