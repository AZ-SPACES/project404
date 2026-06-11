import React, { useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  Modal, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';
import { Typography, Spacing, Radius } from '../../../../../theme';
import { NavProps } from '../types';
import { extractData, fmtDate } from '../helpers';
import {
  getMerchantTeam, inviteMerchantTeamMember,
  updateMerchantTeamMemberRole, removeMerchantTeamMember,
} from '../../../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../../lib/queryKeys';
import { queryClient } from '../../../../../lib/queryClient';
import { extractErrorMessage } from '../../../../../utils/errorUtils';
import InternalHeader from '../components/InternalHeader';
import StatusBadge from '../components/StatusBadge';

type TeamRole = 'ADMIN' | 'DEVELOPER' | 'VIEWER';
const ROLES: TeamRole[] = ['ADMIN', 'DEVELOPER', 'VIEWER'];
const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  ADMIN: 'Full access to all business settings',
  DEVELOPER: 'API keys, webhooks and integrations',
  VIEWER: 'Read-only access to reports',
};

function InviteModal({ visible, onClose, onInvited, Colors }: any) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('VIEWER');
  const [saving, setSaving] = useState(false);

  const canSubmit = /\S+@\S+\.\S+/.test(email.trim());

  const submit = async () => {
    setSaving(true);
    try {
      await inviteMerchantTeamMember(email.trim().toLowerCase(), role);
      onInvited();
      onClose();
      setEmail('');
      setRole('VIEWER');
    } catch (e: unknown) {
      Alert.alert('Error', extractErrorMessage(e, 'Failed to send invite.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg }} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md }}>Invite Team Member</Text>

            <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 6 }}>Email *</Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 11, color: Colors.textPrimary,
                fontSize: 14, backgroundColor: Colors.background,
              }}
              value={email}
              onChangeText={setEmail}
              placeholder="teammate@business.com"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.md }}>Role</Text>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                  padding: Spacing.sm, borderRadius: 10, borderWidth: 1, marginBottom: Spacing.xs,
                  borderColor: role === r ? Colors.primary : Colors.border,
                  backgroundColor: role === r ? Colors.primary + '18' : Colors.background,
                }}
                onPress={() => setRole(r)}
                accessibilityRole="radio"
                accessibilityState={{ checked: role === r }}
              >
                <Feather name={role === r ? 'check-circle' : 'circle'} size={16} color={role === r ? Colors.primary : Colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>{r.charAt(0) + r.slice(1).toLowerCase()}</Text>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{ROLE_DESCRIPTIONS[r]}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={{
                backgroundColor: canSubmit ? Colors.primary : Colors.border,
                borderRadius: 12, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
              }}
              onPress={submit}
              disabled={!canSubmit || saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Send Invite</Text>
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

export default function TeamPage({ goBack, Colors, styles }: NavProps) {
  const { data: members = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.merchantTeam(),
    queryFn: async () => {
      const data = extractData(await getMerchantTeam());
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantTeam() });

  const changeRole = (member: any) => {
    const options = ROLES.filter((r) => r !== member.role);
    Alert.alert(
      'Change Role',
      `${member.email} is currently ${member.role}.`,
      [
        ...options.map((r) => ({
          text: `Make ${r.charAt(0) + r.slice(1).toLowerCase()}`,
          onPress: async () => {
            setBusyId(member.id);
            try {
              await updateMerchantTeamMemberRole(member.id, r);
              refresh();
            } catch (e: unknown) {
              Alert.alert('Error', extractErrorMessage(e, 'Failed to change role.'));
            } finally {
              setBusyId(null);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const revoke = (member: any) => {
    Alert.alert('Remove Member', `Revoke access for ${member.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          setBusyId(member.id);
          try {
            await removeMerchantTeamMember(member.id);
            refresh();
          } catch (e: unknown) {
            Alert.alert('Error', extractErrorMessage(e, 'Failed to revoke access.'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <InternalHeader title="Team" onBack={goBack} Colors={Colors} styles={styles} />

      <TouchableOpacity
        style={{
          marginHorizontal: Spacing.md, marginTop: Spacing.sm,
          backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
        }}
        onPress={() => setInviting(true)}
      >
        <Feather name="user-plus" size={16} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Invite Member</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={[styles.center, { marginTop: Spacing.xl }]}><ActivityIndicator color={Colors.primary} /></View>
      ) : members.length === 0 ? (
        <View style={styles.center}>
          <Feather name="users" size={36} color={Colors.textSecondary} />
          <Text style={[Typography.body as any, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
            No team members yet
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {members.map((m: any) => (
            <View
              key={m.id}
              style={{
                borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
                borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }} numberOfLines={1}>
                    {m.email}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                    {m.role} · {m.joinedAt ? `Joined ${fmtDate(m.joinedAt)}` : `Invited ${fmtDate(m.invitedAt)}`}
                  </Text>
                </View>
                <StatusBadge status={m.status} Colors={Colors} />
              </View>
              {m.status !== 'REVOKED' && (
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                  {busyId === m.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}
                        onPress={() => changeRole(m)}
                      >
                        <Feather name="edit-2" size={13} color={Colors.primary} />
                        <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>Change Role</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}
                        onPress={() => revoke(m)}
                      >
                        <Feather name="user-x" size={13} color="#ef4444" />
                        <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Revoke</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <InviteModal
        visible={inviting}
        onClose={() => setInviting(false)}
        onInvited={refresh}
        Colors={Colors}
      />
    </View>
  );
}
