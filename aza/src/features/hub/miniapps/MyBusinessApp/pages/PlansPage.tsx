import React, { useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  Modal, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing, Radius } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtAmount, fmtDate } from '../helpers';
import {
  getMerchantPlans, createMerchantPlan, updateMerchantPlan, deactivateMerchantPlan,
  getMerchantSubscriptions, createMerchantSubscription, cancelMerchantSubscription,
} from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import { queryClient } from '../../../../../lib/queryClient';
import { extractErrorMessage } from '../../../../../utils/errorUtils';
import InternalHeader from '../components/InternalHeader';
import StatusBadge from '../components/StatusBadge';
import Button from '../../../../../components/ui/Button';

const INTERVALS = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'];
const INTERVAL_LABELS: Record<string, string> = {
  DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly', ANNUALLY: 'Annually',
};

const inputStyle = (Colors: any) => ({
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 11,
  color: Colors.textPrimary,
  fontSize: 14,
  backgroundColor: Colors.background,
});

function PlanModal({ visible, plan, onClose, onSaved, Colors }: any) {
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [amount, setAmount] = useState(plan?.amount != null ? String(plan.amount) : '');
  const [interval, setInterval] = useState(plan?.interval ?? 'MONTHLY');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setName(plan?.name ?? '');
    setDescription(plan?.description ?? '');
    setAmount(plan?.amount != null ? String(plan.amount) : '');
    setInterval(plan?.interval ?? 'MONTHLY');
  }, [plan, visible]);

  const canSubmit = name.trim().length >= 2 && parseFloat(amount) > 0;

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        amount: parseFloat(amount),
        interval,
      };
      if (plan?.id) {
        await updateMerchantPlan(plan.id, payload);
      } else {
        await createMerchantPlan(payload);
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to save plan.'));
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { fontSize: 12, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md }}>
              {plan?.id ? 'Edit Plan' : 'New Plan'}
            </Text>

            <Text style={labelStyle}>Name *</Text>
            <TextInput style={inputStyle(Colors)} value={name} onChangeText={setName} placeholder="Premium Membership" placeholderTextColor={Colors.textSecondary} />

            <Text style={labelStyle}>Description</Text>
            <TextInput style={inputStyle(Colors)} value={description} onChangeText={setDescription} placeholder="What's included?" placeholderTextColor={Colors.textSecondary} />

            <Text style={labelStyle}>Amount (GHS) *</Text>
            <TextInput style={inputStyle(Colors)} value={amount} onChangeText={setAmount} placeholder="50.00" keyboardType="decimal-pad" placeholderTextColor={Colors.textSecondary} />

            <Text style={labelStyle}>Billing Interval</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingVertical: 4 }}>
              {INTERVALS.map((i) => (
                <TouchableOpacity
                  key={i}
                  style={{
                    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1,
                    borderColor: interval === i ? Colors.primary : Colors.border,
                    backgroundColor: interval === i ? Colors.primary + '18' : Colors.background,
                  }}
                  onPress={() => setInterval(i)}
                >
                  <Text style={{ color: interval === i ? Colors.primary : Colors.textSecondary, fontWeight: '600', fontSize: 13 }}>
                    {INTERVAL_LABELS[i]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Button
              title={plan?.id ? 'Save Changes' : 'Create Plan'}
              onPress={submit}
              disabled={!canSubmit}
              loading={saving}
              backgroundColor={Colors.primary}
              borderRadius={12}
              paddingVertical={Spacing.md}
              fontSize={15}
              style={{ marginTop: Spacing.lg }}
            />

            <Button
              title="Cancel"
              onPress={onClose}
              backgroundColor="transparent"
              textColor={Colors.textSecondary}
              fontSize={14}
              fontWeight="normal"
              paddingVertical={0}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function SubscribeModal({ visible, plans, onClose, onSaved, Colors }: any) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const activePlans = plans.filter((p: any) => p.active);
  const canSubmit = !!planId && customerName.trim().length >= 2;

  const submit = async () => {
    if (!planId) return;
    setSaving(true);
    try {
      await createMerchantSubscription({
        planId,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
      });
      onSaved();
      onClose();
      setPlanId(null); setCustomerName(''); setCustomerEmail('');
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to create subscription.'));
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { fontSize: 12, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md }}>New Subscriber</Text>

            <Text style={labelStyle}>Plan *</Text>
            {activePlans.length === 0 ? (
              <Text style={{ fontSize: 13, color: Colors.textSecondary }}>No active plans — create a plan first.</Text>
            ) : activePlans.map((p: any) => (
              <TouchableOpacity
                key={p.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                  padding: Spacing.sm, borderRadius: 10, borderWidth: 1, marginBottom: Spacing.xs,
                  borderColor: planId === p.id ? Colors.primary : Colors.border,
                  backgroundColor: planId === p.id ? Colors.primary + '18' : Colors.background,
                }}
                onPress={() => setPlanId(p.id)}
              >
                <Feather name={planId === p.id ? 'check-circle' : 'circle'} size={16} color={planId === p.id ? Colors.primary : Colors.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1 }} numberOfLines={1}>{p.name}</Text>
                <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                  {fmtAmount(p.amount, p.currency)} / {INTERVAL_LABELS[p.interval]?.toLowerCase() ?? p.interval}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={labelStyle}>Customer Name *</Text>
            <TextInput style={inputStyle(Colors)} value={customerName} onChangeText={setCustomerName} placeholder="Ama Mensah" placeholderTextColor={Colors.textSecondary} />

            <Text style={labelStyle}>Customer Email</Text>
            <TextInput style={inputStyle(Colors)} value={customerEmail} onChangeText={setCustomerEmail} placeholder="ama@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textSecondary} />

            <Button
              title="Add Subscriber"
              onPress={submit}
              disabled={!canSubmit}
              loading={saving}
              backgroundColor={Colors.primary}
              borderRadius={12}
              paddingVertical={Spacing.md}
              fontSize={15}
              style={{ marginTop: Spacing.lg }}
            />

            <Button
              title="Cancel"
              onPress={onClose}
              backgroundColor="transparent"
              textColor={Colors.textSecondary}
              fontSize={14}
              fontWeight="normal"
              paddingVertical={0}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function PlansPage({ goBack, Colors, styles }: NavProps) {
  const [tab, setTab] = useState<'plans' | 'subscribers'>('plans');
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [subscribeVisible, setSubscribeVisible] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: queryKeys.merchantPlans(),
    queryFn: async () => {
      const data = extractData(await getMerchantPlans());
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: queryKeys.merchantSubscriptions(),
    queryFn: async () => { const r = await getMerchantSubscriptions(0, 30); return extractData(r)?.content ?? []; },
    staleTime: 60_000,
  });

  const refreshPlans = () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantPlans() });
  const refreshSubs = () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantSubscriptions() });

  const planById = (id: string) => plans.find((p: any) => p.id === id);

  const deactivate = (plan: any) => {
    Alert.alert('Deactivate Plan', `Deactivate "${plan.name}"? New subscribers won't be able to join.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive', onPress: async () => {
          setBusyId(plan.id);
          try {
            await deactivateMerchantPlan(plan.id);
            refreshPlans();
          } catch (e: unknown) {
            Alert.alert('Error', extractErrorMessage(e, 'Failed to deactivate plan.'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const cancelSub = (sub: any) => {
    Alert.alert('Cancel Subscription', `Cancel ${sub.customerName}'s subscription?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Subscription', style: 'destructive', onPress: async () => {
          setBusyId(sub.id);
          try {
            await cancelMerchantSubscription(sub.id);
            refreshSubs();
          } catch (e: unknown) {
            Alert.alert('Error', extractErrorMessage(e, 'Failed to cancel subscription.'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const loading = tab === 'plans' ? plansLoading : subsLoading;

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Plans & Subscriptions" onBack={goBack} Colors={Colors} styles={styles} />

      {/* Tabs */}
      <View style={{ flexDirection: 'row', marginHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 4, borderWidth: 1, borderColor: Colors.border }}>
        {(['plans', 'subscribers'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: Radius.md - 2, alignItems: 'center',
              backgroundColor: tab === t ? Colors.primary : 'transparent',
            }}
            onPress={() => setTab(t)}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t ? Colors.secondary : Colors.textSecondary }}>
              {t === 'plans' ? 'Plans' : 'Subscribers'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        title={tab === 'plans' ? 'New Plan' : 'Add Subscriber'}
        onPress={() => {
          if (tab === 'plans') { setEditingPlan(null); setPlanModalVisible(true); }
          else setSubscribeVisible(true);
        }}
        leftIcon={<Feather name="plus" size={16} color="#fff" />}
        backgroundColor={Colors.primary}
        borderRadius={Radius.md}
        paddingVertical={Spacing.md}
        fontSize={14}
        width="auto"
        style={{ marginHorizontal: Spacing.md, marginTop: Spacing.sm }}
      />

      {loading ? (
        <View style={[styles.center, { marginTop: Spacing.xl }]}><ActivityIndicator color={Colors.primary} /></View>
      ) : tab === 'plans' ? (
        plans.length === 0 ? (
          <View style={styles.center}>
            <Feather name="repeat" size={36} color={Colors.textSecondary} />
            <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
              No subscription plans yet
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
            {plans.map((p: any) => (
              <View
                key={p.id}
                style={{
                  borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
                  borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.xs,
                  opacity: p.active ? 1 : 0.6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary }}>{p.name}</Text>
                    <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                      {fmtAmount(p.amount, p.currency)} / {INTERVAL_LABELS[p.interval]?.toLowerCase() ?? p.interval}
                      {p.description ? `  ·  ${p.description}` : ''}
                    </Text>
                  </View>
                  {!p.active && (
                    <View style={{ backgroundColor: Colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, color: Colors.textSecondary, fontWeight: '600' }}>INACTIVE</Text>
                    </View>
                  )}
                </View>
                {p.active && (
                  <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                    {busyId === p.id ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}
                          onPress={() => { setEditingPlan(p); setPlanModalVisible(true); }}
                        >
                          <Feather name="edit-2" size={13} color={Colors.primary} />
                          <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}
                          onPress={() => deactivate(p)}
                        >
                          <Feather name="pause-circle" size={13} color="#ef4444" />
                          <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Deactivate</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )
      ) : subscriptions.length === 0 ? (
        <View style={styles.center}>
          <Feather name="users" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No subscribers yet
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {subscriptions.map((s: any) => (
            <View
              key={s.id}
              style={{
                borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
                borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }}>{s.customerName}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                    {planById(s.planId)?.name ?? 'Plan'}
                    {s.nextBillingAt && s.status === 'ACTIVE' ? `  ·  Next: ${fmtDate(s.nextBillingAt)}` : ''}
                    {s.cancelledAt ? `  ·  Ended: ${fmtDate(s.cancelledAt)}` : ''}
                  </Text>
                </View>
                <StatusBadge status={s.status} Colors={Colors} />
              </View>
              {s.status === 'ACTIVE' && (
                <View style={{ flexDirection: 'row', marginTop: Spacing.sm }}>
                  {busyId === s.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}
                      onPress={() => cancelSub(s)}
                    >
                      <Feather name="x-circle" size={13} color="#ef4444" />
                      <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Cancel Subscription</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <PlanModal
        visible={planModalVisible}
        plan={editingPlan}
        onClose={() => setPlanModalVisible(false)}
        onSaved={refreshPlans}
        Colors={Colors}
      />
      <SubscribeModal
        visible={subscribeVisible}
        plans={plans}
        onClose={() => setSubscribeVisible(false)}
        onSaved={refreshSubs}
        Colors={Colors}
      />
    </View>
  );
}
