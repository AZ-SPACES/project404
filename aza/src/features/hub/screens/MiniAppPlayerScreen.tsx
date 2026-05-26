import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  StatusBar,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, AntDesign } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import { getMiniApp } from '../miniapps/registry';
import { reportMiniApp } from '../../../services/api';
import { useToast } from '../../../providers/ToastProvider';

type PlayerRouteProp = RouteProp<RootStackParamList, 'MiniApp'>;
type PlayerNavProp = NativeStackNavigationProp<RootStackParamList, 'MiniApp'>;

const HEADER_HEIGHT = 52;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'SPAM',          label: 'Spam or misleading' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate content' },
  { value: 'NOT_WORKING',   label: 'Not working / broken' },
  { value: 'MISLEADING',    label: 'False information' },
  { value: 'OTHER',         label: 'Other' },
];

export default function MiniAppPlayerScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<PlayerNavProp>();
  const route = useRoute<PlayerRouteProp>();
  const { appId } = route.params;
  const { showToast } = useToast();
  const menuAnim = useRef(new Animated.Value(0)).current;
  const reportSheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const reportBackdropAnim = useRef(new Animated.Value(0)).current;
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [reportVisible, setReportVisible] = React.useState(false);
  const [selectedReason, setSelectedReason] = React.useState<string | null>(null);
  const [reportDetails, setReportDetails] = React.useState('');
  const [reportLoading, setReportLoading] = React.useState(false);
  const insets = useSafeAreaInsets();

  const app = getMiniApp(appId);

  const handleClose = () => navigation.goBack();

  const toggleMenu = () => {
    const toValue = menuVisible ? 0 : 1;
    setMenuVisible(!menuVisible);
    Animated.spring(menuAnim, { toValue, useNativeDriver: true, bounciness: 0 }).start();
  };

  const handleShare = async () => {
    setMenuVisible(false);
    if (!app) return;
    const deepLink = `aza://miniapps/${appId}`;
    const body = Platform.OS === 'android'
      ? `${app.icon} ${app.name}\n${app.description}\n\nOpen in Aza: ${deepLink}`
      : `${app.icon} ${app.name}\n${app.description}`;
    try {
      await Share.share({ title: `${app.name} on Aza`, message: body, url: deepLink });
    } catch {}
  };

  const openReportSheet = () => {
    setMenuVisible(false);
    setSelectedReason(null);
    setReportDetails('');
    setReportVisible(true);
    Animated.parallel([
      Animated.timing(reportSheetAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(reportBackdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeReportSheet = () => {
    Animated.parallel([
      Animated.timing(reportSheetAnim, { toValue: SCREEN_HEIGHT, duration: 300, useNativeDriver: true }),
      Animated.timing(reportBackdropAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setReportVisible(false));
  };

  const submitReport = async () => {
    if (!selectedReason) return;
    setReportLoading(true);
    try {
      await reportMiniApp(appId, selectedReason, reportDetails.trim() || undefined);
      closeReportSheet();
      showToast('Report submitted. Thank you for your feedback.', 'success');
    } catch {
      showToast('Could not submit report. Please try again.', 'error');
    } finally {
      setReportLoading(false);
    }
  };

  if (!app) {
    return (
      <View style={[styles.notFoundSafeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Mini app not found.</Text>
          <TouchableOpacity onPress={handleClose} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const MiniAppComponent = app.component;

  const menuTranslateY = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });
  const menuOpacity = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} />

      {/* header */}
      <View style={[styles.headerSafeArea, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleClose}
            accessibilityLabel="Close mini app"
            accessibilityRole="button"
          >
            <Feather name="x" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={[styles.headerIcon, app.color ? { backgroundColor: app.color } : undefined]}>
              {typeof app.icon === 'string' ? (
                <Text style={styles.headerIconEmoji}>{app.icon}</Text>
              ) : (
                <Image
                  source={app.icon}
                  style={app.color ? { width: 20, height: 20 } : { width: '100%', height: '100%' }}
                  resizeMode={app.color ? 'contain' : 'cover'}
                />
              )}
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>{app.name}</Text>
          </View>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={toggleMenu}
            accessibilityLabel="More options"
            accessibilityRole="button"
          >
            <Feather name="more-horizontal" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        <MiniAppComponent onClose={handleClose} />
      </View>

      {/* ── Dropdown menu ── */}
      {menuVisible && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuVisible(false)}
            activeOpacity={1}
          />
          <Animated.View
            style={[
              styles.menu,
              { opacity: menuOpacity, transform: [{ translateY: menuTranslateY }], top: insets.top + HEADER_HEIGHT + 8 },
            ]}
          >
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Feather name="share-2" size={18} color={Colors.textPrimary} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={openReportSheet}>
              <Feather name="flag" size={18} color={Colors.error} />
              <Text style={[styles.menuItemText, { color: Colors.error }]}>Report</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      {/* ── Report bottom sheet ── */}
      {reportVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: reportBackdropAnim }]}
            pointerEvents="auto"
          >
            <TouchableOpacity
              style={styles.backdrop}
              activeOpacity={1}
              onPress={closeReportSheet}
            />
          </Animated.View>

          <Animated.View
            style={[styles.reportSheet, { transform: [{ translateY: reportSheetAnim }], paddingBottom: insets.bottom + 16 }]}
            pointerEvents="auto"
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {/* Sheet header */}
              <View style={styles.sheetHeader}>
                <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeReportSheet}>
                  <AntDesign name="close" size={18} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.sheetTitle}>Report {app.name}</Text>
              <Text style={styles.sheetSubtitle}>
                Tell us what's wrong with this mini app.
              </Text>
              <View style={styles.sheetDivider} />

              {/* Reason options */}
              <View style={styles.reasonList}>
                {REPORT_REASONS.map((r) => {
                  const active = selectedReason === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.reasonItem, active && styles.reasonItemActive]}
                      onPress={() => setSelectedReason(r.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                        {r.label}
                      </Text>
                      {active && (
                        <Feather name="check-circle" size={18} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional details */}
              <TextInput
                style={styles.detailsInput}
                placeholder="Additional details (optional)"
                placeholderTextColor={Colors.textSecondary}
                value={reportDetails}
                onChangeText={setReportDetails}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, (!selectedReason || reportLoading) && { opacity: 0.45 }]}
                onPress={submitReport}
                disabled={!selectedReason || reportLoading}
                activeOpacity={0.8}
              >
                {reportLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Submit Report</Text>
                }
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    notFoundSafeArea: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    headerSafeArea: {
      backgroundColor: Colors.background,
    },
    header: {
      height: HEADER_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      backgroundColor: Colors.background,
    },
    headerBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    headerIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    headerIconEmoji: { fontSize: 16 },
    headerTitle: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
    },
    content: { flex: 1 },
    // Dropdown menu
    menu: {
      position: 'absolute',
      right: Spacing.md,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      minWidth: 180,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 8,
      zIndex: 100,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
    },
    menuItemText: {
      ...Typography.body,
      color: Colors.textPrimary,
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
      marginHorizontal: Spacing.md,
    },
    // Report bottom sheet
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    reportSheet: {
      position: 'absolute',
      bottom: 0,
      width: '100%',
      backgroundColor: isDark ? Colors.surface : '#ffffff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 8,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginBottom: 16,
    },
    sheetCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors.textPrimary,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    sheetSubtitle: {
      ...Typography.body,
      color: Colors.textSecondary,
      marginBottom: 16,
    },
    sheetDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
      marginBottom: 16,
    },
    reasonList: { gap: 8, marginBottom: 16 },
    reasonItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 10,
      backgroundColor: isDark ? Colors.background : '#FAFAFA',
    },
    reasonItemActive: {
      borderColor: Colors.primary,
      backgroundColor: isDark ? 'rgba(183,237,126,0.06)' : '#F5FAF0',
    },
    reasonText: {
      ...Typography.body,
      color: Colors.textPrimary,
    },
    reasonTextActive: {
      fontWeight: '600',
      color: Colors.primary,
    },
    detailsInput: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 72,
      color: Colors.textPrimary,
      ...Typography.body,
      backgroundColor: isDark ? Colors.background : '#FAFAFA',
      marginBottom: 16,
    },
    submitBtn: {
      backgroundColor: Colors.error,
      borderRadius: 24,
      paddingVertical: 16,
      alignItems: 'center',
    },
    submitBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    // Error state
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
    },
    errorText: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    errorButton: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    errorButtonText: {
      ...Typography.body,
      color: Colors.primary,
      fontWeight: '600',
    },
  });
}
