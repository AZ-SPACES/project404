import React, { useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import { getMerchantDisputes, respondToMerchantDispute } from '../../../../../services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import InternalHeader from '../components/InternalHeader';
import StatusBadge from '../components/StatusBadge';

const STATUS_COLOR: Record<string, string> = {
  OPEN: '#F59E0B',
  UNDER_REVIEW: '#60A5FA',
  RESOLVED_APPROVED: '#B7EE7A',
  RESOLVED_DENIED: '#F87171',
  CLOSED: '#6B7280',
};

function DisputeModal({
  dispute, visible, onClose, Colors,
}: {
  dispute: any; visible: boolean; onClose: () => void; Colors: any;
}) {
  const [response, setResponse] = useState(dispute.merchantResponse ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(!!dispute.merchantResponse);
  const qc = useQueryClient();

  const canRespond = !done && !['RESOLVED_APPROVED', 'RESOLVED_DENIED', 'CLOSED'].includes(dispute.status);

  async function submit() {
    if (!response.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await respondToMerchantDispute(dispute.id, response.trim());
      setDone(true);
      qc.invalidateQueries({ queryKey: queryKeys.merchantDisputes() });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[sty.overlay]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
          <View style={[sty.sheet, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border }}>
              <View>
                <Text style={{ fontSize: 11, color: Colors.textSecondary, fontFamily: 'monospace', marginBottom: 2 }}>
                  {dispute.referenceId ?? dispute.id?.slice(0, 8).toUpperCase()}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>
                  {dispute.category?.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase()) ?? 'Dispute'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              {/* Amount + status */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[sty.infoBox, { backgroundColor: Colors.background, flex: 1 }]}>
                  <Text style={{ fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Amount</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary }}>{fmtAmount(dispute.amount, dispute.currency)}</Text>
                </View>
                <View style={[sty.infoBox, { backgroundColor: Colors.background, flex: 1, alignItems: 'center' }]}>
                  <Text style={{ fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Status</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: (STATUS_COLOR[dispute.status] ?? '#6B7280') + '22' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: STATUS_COLOR[dispute.status] ?? '#6B7280' }}>
                      {dispute.status?.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase())}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Description */}
              {dispute.description ? (
                <View>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary, marginBottom: 6 }}>Customer's claim</Text>
                  <View style={[sty.infoBox, { backgroundColor: Colors.background }]}>
                    <Text style={{ fontSize: 13, color: Colors.textPrimary, lineHeight: 20 }}>{dispute.description}</Text>
                  </View>
                </View>
              ) : null}

              {/* Existing response */}
              {dispute.merchantResponse ? (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Feather name="check-circle" size={12} color="#B7EE7A" />
                    <Text style={{ fontSize: 11, color: Colors.textSecondary }}>
                      Your response{dispute.merchantRespondedAt ? ` · ${fmtDate(dispute.merchantRespondedAt)}` : ''}
                    </Text>
                  </View>
                  <View style={[sty.infoBox, { backgroundColor: '#B7EE7A0D', borderColor: '#B7EE7A22' }]}>
                    <Text style={{ fontSize: 13, color: Colors.textPrimary, lineHeight: 20 }}>{dispute.merchantResponse}</Text>
                  </View>
                </View>
              ) : null}

              {/* Response form */}
              {canRespond ? (
                <View>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary, marginBottom: 8 }}>Submit your response</Text>
                  <TextInput
                    value={response}
                    onChangeText={setResponse}
                    multiline
                    numberOfLines={4}
                    placeholder="Explain your side — provide order details, delivery confirmation, etc."
                    placeholderTextColor={Colors.textSecondary + '80'}
                    style={[sty.textarea, { backgroundColor: Colors.background, borderColor: Colors.border, color: Colors.textPrimary }]}
                  />
                  {error ? <Text style={{ color: '#F87171', fontSize: 12, marginTop: 6 }}>{error}</Text> : null}
                  <TouchableOpacity
                    onPress={submit}
                    disabled={submitting || !response.trim()}
                    style={[sty.btn, { backgroundColor: '#174717', opacity: submitting || !response.trim() ? 0.4 : 1, marginTop: 10 }]}
                  >
                    {submitting
                      ? <ActivityIndicator size="small" color="#B7EE7A" />
                      : <Text style={{ fontSize: 14, fontWeight: '600', color: '#B7EE7A' }}>Submit Response</Text>
                    }
                  </TouchableOpacity>
                </View>
              ) : !dispute.merchantResponse ? (
                <Text style={{ fontSize: 12, color: Colors.textSecondary, textAlign: 'center' }}>
                  This dispute is resolved — no response needed.
                </Text>
              ) : null}

              <Text style={{ fontSize: 10, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
                Opened {fmtDate(dispute.createdAt)}
                {dispute.resolvedAt ? ` · Resolved ${fmtDate(dispute.resolvedAt)}` : ''}
              </Text>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function DisputesPage({ goBack, Colors, styles }: NavProps) {
  const [selected, setSelected] = useState<any | null>(null);

  const { data: disputes = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.merchantDisputes(),
    queryFn: async () => { const r = await getMerchantDisputes(0, 50); return extractData(r)?.content ?? []; },
    staleTime: 60_000,
  });

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Disputes" onBack={goBack} Colors={Colors} styles={styles} />

      {selected && (
        <DisputeModal
          dispute={selected}
          visible
          onClose={() => setSelected(null)}
          Colors={Colors}
        />
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : disputes.length === 0 ? (
        <View style={styles.center}>
          <Feather name="shield" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No disputes — great!
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {disputes.map((d: any) => (
            <TouchableOpacity
              key={d.id}
              onPress={() => setSelected(d)}
              activeOpacity={0.7}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.surface,
                borderRadius: 10,
                padding: Spacing.md,
                marginBottom: Spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary }}>
                  {fmtAmount(d.amount, d.currency)}
                </Text>
                <StatusBadge status={d.status} Colors={Colors} />
              </View>
              {d.description ? (
                <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.xs }} numberOfLines={1}>
                  {d.description}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Opened: {fmtDate(d.createdAt)}</Text>
                {d.merchantResponse
                  ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Feather name="check-circle" size={11} color="#B7EE7A" /><Text style={{ fontSize: 11, color: '#B7EE7A' }}>Responded</Text></View>
                  : ['RESOLVED_APPROVED', 'RESOLVED_DENIED', 'CLOSED'].includes(d.status)
                    ? <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Closed</Text>
                    : <Text style={{ fontSize: 11, color: '#F59E0B' }}>Awaiting response</Text>
                }
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const sty = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '88%' },
  infoBox: { borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'transparent' },
  textarea: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 100, textAlignVertical: 'top' },
  btn: { borderRadius: 12, padding: 14, alignItems: 'center' },
});
