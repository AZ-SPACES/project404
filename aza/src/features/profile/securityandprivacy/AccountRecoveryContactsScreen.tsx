import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { BackButton } from '../../../components/ui/BackButton';
import { useToast } from '../../../providers/ToastProvider';
import * as SecureStore from 'expo-secure-store';
import {
  getMyRecoveryContacts,
  getPendingRecoveryInvitations,
  acceptRecoveryInvite,
  declineRecoveryInvite,
  removeRecoveryContact,
  removeAsRecoveryContact,
  searchUsersGlobal,
  inviteRecoveryContact,
} from '../../../services/api';

const ARC_TOTP_PREFIX = 'arc_totp_';
import { TextInput } from 'react-native';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AccountRecoveryContacts'>;

type Contact = {
  id: string;
  status: 'PENDING' | 'ACTIVE';
  contactUserId: string;
  contactName: string;
  contactHandle?: string;
  contactAvatarUrl?: string;
};

const MAX = 3;

export default function AccountRecoveryContactsScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavProp>();
  const { showToast } = useToast();

  const [myContacts, setMyContacts] = useState<Contact[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const load = useCallback(async () => {
    try {
      const [myRes, inviteRes] = await Promise.all([
        getMyRecoveryContacts(),
        getPendingRecoveryInvitations(),
      ]);
      setMyContacts(myRes.data?.data ?? []);
      setPendingInvites(inviteRes.data?.data ?? []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const res = await searchUsersGlobal(q, 0, 8);
      setSearchResults(res.data?.data?.content ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInvite = async (userId: string) => {
    setActionId(userId);
    try {
      await inviteRecoveryContact(userId);
      showToast('Invitation sent', 'success');
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
      load();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to send invitation', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleAccept = async (entryId: string) => {
    setActionId(entryId);
    try {
      const res = await acceptRecoveryInvite(entryId);
      const totpSecret: string | undefined = res.data?.data?.totpSecret;
      if (totpSecret) {
        // Store the rotating key — used to show codes in GenerateRecoveryCodeScreen
        await SecureStore.setItemAsync(ARC_TOTP_PREFIX + entryId, totpSecret);
      }
      showToast('You are now a recovery contact', 'success');
      load();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to accept', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (entryId: string) => {
    setActionId(entryId);
    try {
      await declineRecoveryInvite(entryId);
      showToast('Invitation declined', 'success');
      load();
    } catch {
      showToast('Failed to decline', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = (contact: Contact) => {
    Alert.alert(
      'Remove recovery contact?',
      `${contact.contactName} will no longer be able to help you recover your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setActionId(contact.id);
            try {
              await removeRecoveryContact(contact.id);
              load();
            } catch {
              showToast('Failed to remove contact', 'error');
            } finally {
              setActionId(null);
            }
          },
        },
      ]
    );
  };

  const handleRemoveAsSelf = (invite: Contact) => {
    Alert.alert(
      'Stop being a recovery contact?',
      `${invite.contactName} will no longer be able to use you to recover their account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setActionId(invite.id);
            try {
              await removeAsRecoveryContact(invite.id);
              await SecureStore.deleteItemAsync(ARC_TOTP_PREFIX + invite.id);
              load();
            } catch {
              showToast('Failed', 'error');
            } finally {
              setActionId(null);
            }
          },
        },
      ]
    );
  };

  const canAddMore = myContacts.length < MAX;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Recovery contacts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Text style={styles.desc}>
          Recovery contacts can generate a one-time code to help you back into your account if you're ever fully locked out. You can have up to {MAX}.
        </Text>

        {/* My recovery contacts */}
        <Text style={styles.sectionLabel}>YOUR RECOVERY CONTACTS</Text>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
        ) : myContacts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="users" size={28} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No recovery contacts yet</Text>
          </View>
        ) : (
          myContacts.map(c => (
            <ContactRow
              key={c.id}
              name={c.contactName}
              handle={c.contactHandle}
              avatar={c.contactAvatarUrl}
              badge={c.status === 'PENDING' ? 'Pending' : undefined}
              right={
                <TouchableOpacity onPress={() => handleRemove(c)} disabled={actionId === c.id}>
                  {actionId === c.id
                    ? <ActivityIndicator size="small" color={Colors.textSecondary} />
                    : <Feather name="x" size={18} color={Colors.textSecondary} />}
                </TouchableOpacity>
              }
              Colors={Colors} isDark={isDark}
            />
          ))
        )}

        {canAddMore && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowSearch(true)}>
            <Feather name="plus" size={18} color={Colors.primary} />
            <Text style={styles.addBtnText}>Add recovery contact</Text>
          </TouchableOpacity>
        )}

        {/* Search */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: Colors.textPrimary }]}
                placeholder="Search by name or @handle"
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <Feather name="x" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            {isSearching && <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />}
            {searchResults.map((u: any) => {
              const alreadyAdded = myContacts.some(c => c.contactUserId === u.id)
                || pendingInvites.some(c => c.contactUserId === u.id);
              return (
                <ContactRow
                  key={u.id}
                  name={`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()}
                  handle={u.handle}
                  avatar={u.profileImageUrl}
                  Colors={Colors} isDark={isDark}
                  right={
                    alreadyAdded
                      ? <Text style={[styles.addBtnText, { color: Colors.textSecondary, fontSize: 12 }]}>Added</Text>
                      : <TouchableOpacity
                          style={styles.inviteBtn}
                          onPress={() => handleInvite(u.id)}
                          disabled={actionId === u.id}
                        >
                          {actionId === u.id
                            ? <ActivityIndicator size="small" color={Colors.secondary} />
                            : <Text style={styles.inviteBtnText}>Invite</Text>}
                        </TouchableOpacity>
                  }
                />
              );
            })}
          </View>
        )}

        {/* Invitations I received */}
        {pendingInvites.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>PEOPLE WHO ADDED YOU</Text>
            {pendingInvites.map(inv => (
              <View key={inv.id}>
                <ContactRow
                  name={inv.contactName}
                  handle={inv.contactHandle}
                  avatar={inv.contactAvatarUrl}
                  Colors={Colors} isDark={isDark}
                />
                <View style={styles.inviteActions}>
                  <Button
                    title="Accept"
                    onPress={() => handleAccept(inv.id)}
                    loading={actionId === inv.id}
                    backgroundColor={Colors.primary}
                    textColor={Colors.secondary}
                    borderRadius={Radius.full}
                    paddingVertical={10}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="Decline"
                    onPress={() => handleDecline(inv.id)}
                    disabled={actionId === inv.id}
                    backgroundColor="transparent"
                    textColor={Colors.textPrimary}
                    borderRadius={Radius.full}
                    paddingVertical={10}
                    style={{ flex: 1, borderWidth: 1, borderColor: Colors.border }}
                  />
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({ name, handle, avatar, badge, right, Colors, isDark }: {
  name: string; handle?: string | undefined; avatar?: string | undefined; badge?: string | undefined;
  right?: React.ReactNode; Colors: ThemeColors; isDark: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, gap: 12,
    }}>
      {avatar
        ? <Image source={{ uri: avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
        : <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: isDark ? Colors.surface : '#E5E7EB',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Feather name="user" size={20} color={Colors.textSecondary} />
          </View>
      }
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textPrimary }}>{name}</Text>
          {badge && (
            <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textSecondary }}>{badge}</Text>
            </View>
          )}
        </View>
        {handle && <Text style={{ fontSize: 13, color: Colors.textSecondary }}>@{handle}</Text>}
      </View>
      {right}
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, height: 56 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginLeft: Spacing.md },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 40 },
    desc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.xl },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: Spacing.sm },
    emptyBox: {
      alignItems: 'center', gap: 10, paddingVertical: 28,
      backgroundColor: isDark ? Colors.surface : '#F9FAFB',
      borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
    },
    emptyText: { fontSize: 14, color: Colors.textSecondary },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 14, marginTop: 4,
    },
    addBtnText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
    searchContainer: { marginTop: Spacing.md, marginBottom: Spacing.lg },
    searchBox: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: isDark ? Colors.surface : '#F3F4F6',
      borderRadius: 12, paddingHorizontal: 14, height: 44,
      borderWidth: 1, borderColor: Colors.border,
    },
    searchInput: { flex: 1, fontSize: 15, height: '100%' },
    inviteBtn: {
      backgroundColor: Colors.primary,
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: Radius.full,
    },
    inviteBtnText: { fontSize: 13, fontWeight: '700', color: Colors.secondary },
    inviteActions: { flexDirection: 'row', marginBottom: Spacing.md },
  });
}
