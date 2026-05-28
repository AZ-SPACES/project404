import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { AntDesign } from '@react-native-vector-icons/ant-design';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../providers/ToastProvider';
import { getDevices, removeDevice } from '../../../services/api';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../lib/queryClient';
import { BackButton } from '../../../components/ui/BackButton';
import { CloseButton } from '../../../components/ui/CloseButton';

const { height } = Dimensions.get('window');

type DeviceSession = {
  id: string;
  deviceName: string | null;
  deviceOs: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export function DevicesScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await getDevices();
      const data = res.data?.data ?? res.data ?? [];
      return Array.isArray(data) ? (data as DeviceSession[]) : [];
    },
    staleTime: 60_000,
  });
  const [selected, setSelected] = useState<DeviceSession | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Bottom sheet animation
  const [isSheetVisible, setSheetVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;


  useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetAnim, {
        toValue: isSheetVisible ? 0 : height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: isSheetVisible ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSheetVisible]);

  const openSession = (session: DeviceSession) => {
    setSelected(session);
    setSheetVisible(true);
  };

  const handleRemove = async () => {
    if (!selected) return;
    setIsRemoving(true);
    try {
      await removeDevice(selected.id);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setSheetVisible(false);
      showToast('Session removed', 'success');
    } catch (err: unknown) {
      const message = (err as any)?.response?.data?.message ?? 'Failed to remove session';
      showToast(message, 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const getDeviceIcon = (os: string | null): React.ComponentProps<typeof Feather>['name'] => {
    if (!os) return 'smartphone';
    const lower = os.toLowerCase();
    if (lower.includes('ios') || lower.includes('iphone')) return 'smartphone';
    if (lower.includes('android')) return 'smartphone';
    if (lower.includes('windows') || lower.includes('linux') || lower.includes('mac') || lower.includes('desktop')) return 'monitor';
    return 'smartphone';
  };

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.detailRow}>
      <Text style={[Typography.body, styles.detailLabel]}>{label}</Text>
      <Text style={[Typography.body, styles.detailValue]}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>Devices</Text>
          <Text style={[Typography.bodyLg, styles.mainDescription]}>
            All devices where you're currently logged in
          </Text>
        </View>

        <View style={styles.listSection}>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : sessions.length === 0 ? (
            <Text style={[Typography.body, styles.emptyText]}>No active sessions found.</Text>
          ) : (
            sessions.map(session => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionRow}
                activeOpacity={0.7}
                onPress={() => openSession(session)}
              >
                <View style={styles.iconWrap}>
                  <Feather
                    name={getDeviceIcon(session.deviceOs)}
                    size={22}
                    color={Colors.textPrimary}
                  />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={[Typography.bodyLg, styles.sessionTitle]} numberOfLines={1}>
                    {session.deviceName ?? session.deviceOs ?? 'Unknown Device'}
                  </Text>
                  <Text style={[Typography.body, styles.sessionSubtitle]} numberOfLines={1}>
                    {session.ipAddress ?? 'Unknown IP'} · Added {formatDate(session.createdAt)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Session detail bottom sheet */}
      <View style={StyleSheet.absoluteFill} pointerEvents={isSheetVisible ? 'auto' : 'none'}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: backdropAnim, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)' },
          ]}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheetVisible(false)} />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { zIndex: 1001, transform: [{ translateY: sheetAnim }] }]}
        >
          <View style={styles.sheetHeader}>
            <CloseButton onPress={() => setSheetVisible(false)} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={[Typography.h2, styles.sheetTitle]} numberOfLines={1}>
                {selected?.deviceName ?? selected?.deviceOs ?? 'Device'}
              </Text>
              <Text style={[Typography.body, styles.sheetSubtitle]}>Session details</Text>
            </View>
          </View>

          {selected && (
            <View style={styles.detailsBlock}>
              {selected.deviceName && (
                <DetailRow label="Device name" value={selected.deviceName} />
              )}
              {selected.deviceOs && (
                <DetailRow label="Operating system" value={selected.deviceOs} />
              )}
              {selected.ipAddress && (
                <DetailRow label="IP address" value={selected.ipAddress} />
              )}
              <DetailRow label="Added on" value={formatDate(selected.createdAt)} />
            </View>
          )}

          <Button
            title="Remove this device"
            onPress={handleRemove}
            backgroundColor="#D1222E"
            textColor={Colors.white}
            borderRadius={Radius.full}
            loading={isRemoving}
            disabled={isRemoving}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? Colors.white10 : 'rgba(22,51,0,0.04)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: { paddingBottom: Spacing.xl },
    titleSection: {
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    mainTitle: {
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
      fontSize: 32,
      fontWeight: '700',
    },
    mainDescription: { color: Colors.textSecondary },
    listSection: { paddingHorizontal: Spacing.lg },
    emptyText: {
      color: Colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.xl,
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: isDark ? Colors.white10 : 'rgba(22,51,0,0.04)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    sessionInfo: { flex: 1 },
    sessionTitle: { fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
    sessionSubtitle: { color: Colors.textSecondary },
    // Bottom sheet
    sheet: {
      position: 'absolute',
      bottom: 0,
      width: '100%',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 40,
      shadowColor: Colors.black,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    sheetTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
    sheetSubtitle: { color: Colors.textSecondary },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? Colors.white10 : 'rgba(22,51,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailsBlock: { marginBottom: 24 },
    detailRow: { marginBottom: 14 },
    detailLabel: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
    detailValue: { color: Colors.textSecondary },
  });
}
