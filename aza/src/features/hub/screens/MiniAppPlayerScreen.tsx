import React, { useRef, useCallback, useState } from 'react';
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
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { AntDesign } from '@react-native-vector-icons/ant-design';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import { getMiniApp } from '../miniapps/registry';
import { useCommunityMiniApps } from '../../../hooks/useCommunityMiniApps';
import { useMiniAppConsent } from '../../../hooks/useMiniAppConsent';
import ConsentSheet from '../../../components/miniapp/ConsentSheet';
import { AZA_SDK_JS } from '../sdk/azaSDK';
import { getSdkUser, getSdkBalance, sdkPayment, reportMiniApp } from '../../../services/api';
import { useDisabledMiniApps } from '../../../hooks/useDisabledMiniApps';
import { useToast } from '../../../providers/ToastProvider';
import { CloseButton } from '../../../components/ui/CloseButton';
import Button from '../../../components/ui/Button';

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
  const { disabled, maintenance } = useDisabledMiniApps();
  const { communityApps } = useCommunityMiniApps();

  const app = getMiniApp(appId) ?? communityApps.find(a => a.id === appId);

  const handleClose = () => navigation.goBack();

  const toggleMenu = () => {
    if (menuVisible) {
      Animated.timing(menuAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setMenuVisible(false);
      });
    } else {
      setMenuVisible(true);
      Animated.timing(menuAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  };

  const closeMenu = () => {
    if (menuVisible) {
      Animated.timing(menuAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setMenuVisible(false);
      });
    }
  };

  const handleShare = async () => {
    closeMenu();
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
    closeMenu();
    setSelectedReason(null);
    setReportDetails('');
    setReportVisible(true);
    Animated.parallel([
      Animated.timing(reportSheetAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(reportBackdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeReportSheet = () => {
    Animated.parallel([
      Animated.timing(reportSheetAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
      Animated.timing(reportBackdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
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
          <Button
            title="Go Back"
            onPress={handleClose}
            width="auto"
          />
        </View>
      </View>
    );
  }

  if (disabled.has(appId)) {
    return (
      <View style={[styles.notFoundSafeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{app.name} is currently unavailable.</Text>
          <Button title="Go Back" onPress={handleClose} width="auto" />
        </View>
      </View>
    );
  }

  if (maintenance.has(appId)) {
    const msg = maintenance.get(appId);
    return (
      <View style={[styles.notFoundSafeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.maintenanceTitle}>{app.name} is under maintenance</Text>
          <Text style={styles.maintenanceBody}>
            {msg ?? "We're doing some maintenance — this app will be back shortly."}
          </Text>
          <Button title="Go Back" onPress={handleClose} width="auto" />
        </View>
      </View>
    );
  }

  const miniAppTheme = {
    background: Colors.background,
    surface: Colors.surface,
    primary: Colors.primary,
    textPrimary: Colors.textPrimary,
    textSecondary: Colors.textSecondary,
    border: Colors.border,
  };

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
            <Feather name="x" size={20} color={Colors.textPrimary} />
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
            <Feather name="more-horizontal" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.content}>
        {app.component ? (
          <app.component onClose={handleClose} theme={miniAppTheme} />
        ) : app.url ? (
          <CommunityWebApp app={app} onClose={handleClose} Colors={Colors} styles={styles} />
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>This app cannot be opened.</Text>
            <Button title="Go Back" onPress={handleClose} width="auto" />
          </View>
        )}
      </View>

      {/* ── Dropdown menu ── */}
      {menuVisible && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeMenu}
            activeOpacity={1}
          />
          <Animated.View
            style={[
              styles.menu,
              { opacity: menuOpacity, top: insets.top + HEADER_HEIGHT + 8 },
            ]}
          >
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Feather name="share-2" size={16} color={Colors.textPrimary} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={openReportSheet}>
              <Feather name="flag" size={16} color={Colors.textPrimary} />
              <Text style={styles.menuItemText}>Report</Text>
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
            style={[styles.reportSheet, { transform: [{ translateY: reportSheetAnim }], paddingBottom: insets.bottom + 24 }]}
            pointerEvents="auto"
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {/* Sheet header */}
              <View style={styles.sheetHeader}>
                <CloseButton onPress={closeReportSheet} color={Colors.textSecondary} />
              </View>

              <Text style={styles.sheetTitle}>Report {app.name}</Text>
              <Text style={styles.sheetSubtitle}>
                Tell us what's wrong with this mini app.
              </Text>

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
                        <Feather name="check" size={16} color={Colors.textPrimary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional details */}
              <TextInput
                underlineColorAndroid="transparent"
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
              <Button
                title="Submit"
                onPress={submitReport}
                disabled={!selectedReason}
                loading={reportLoading}
                backgroundColor={Colors.textPrimary}
                textColor={Colors.background}
                borderRadius={8}
                paddingVertical={14}
                fontSize={14}
                fontWeight="500"
                activeOpacity={0.8}
              />
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

interface CommunityWebAppProps {
  app: NonNullable<ReturnType<typeof getMiniApp>>;
  onClose: () => void;
  Colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

interface PendingPayment {
  id: string;
  amount: number;
  recipientIdentifier: string;
  note?: string;
  idempotencyKey: string;
}

function CommunityWebApp({ app, onClose, Colors, styles }: CommunityWebAppProps) {
  const perms = app.requestedPermissions ?? [];
  const { consentStatus, grant, deny } = useMiniAppConsent(app.id, perms);
  const [showConsent, setShowConsent] = React.useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const webViewRef = useRef<WebView>(null);

  React.useEffect(() => {
    if (consentStatus === 'needs_consent') setShowConsent(true);
  }, [consentStatus]);

  const handleDeny = () => {
    deny();
    setShowConsent(false);
    onClose();
  };

  const handleGrant = async (permissions: string[]) => {
    await grant(permissions);
    setShowConsent(false);
  };

  const replyToWebView = useCallback((id: string, result: any) => {
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify({ id, result }))}}));true;`
    );
  }, []);

  const replyErrorToWebView = useCallback((id: string, error: string) => {
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify({ id, error }))}}));true;`
    );
  }, []);

  // PostMessage bridge: native side handles SDK method calls
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    let msg: { id: string; method: string; params: Record<string, any> };
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    const { id, method, params } = msg;

    try {
      switch (method) {
        case 'getUser': {
          const res = await getSdkUser(app.id);
          replyToWebView(id, res.data?.data);
          break;
        }
        case 'getBalance': {
          const res = await getSdkBalance(app.id);
          replyToWebView(id, res.data?.data);
          break;
        }
        case 'requestPayment': {
          // Security gate: require explicit user confirmation before any payment
          if (!params.amount || !params.recipientIdentifier || !params.idempotencyKey) {
            replyErrorToWebView(id, 'Missing required payment fields');
            return;
          }
          // Store the pending payment with its bridge callback id — confirmed or cancelled below
          setPendingPayment({
            id,
            amount: params.amount,
            recipientIdentifier: params.recipientIdentifier,
            note: params.note,
            idempotencyKey: params.idempotencyKey,
          });
          break;
        }
        case 'close':
          onClose();
          replyToWebView(id, null);
          break;
        case 'share':
          Share.share({ title: params.title ?? app.name, message: params.message ?? '' });
          replyToWebView(id, null);
          break;
        default:
          replyErrorToWebView(id, 'Unknown SDK method: ' + method);
      }
    } catch (err: any) {
      replyErrorToWebView(id, err?.message ?? 'SDK error');
    }
  }, [app.id, onClose, replyToWebView, replyErrorToWebView]);

  const confirmPayment = async () => {
    if (!pendingPayment) return;
    setPaymentLoading(true);
    try {
      const res = await sdkPayment(app.id, {
        amount: pendingPayment.amount,
        recipientIdentifier: pendingPayment.recipientIdentifier,
        note: pendingPayment.note,
        idempotencyKey: pendingPayment.idempotencyKey,
      });
      replyToWebView(pendingPayment.id, res.data?.data);
    } catch (err: any) {
      replyErrorToWebView(pendingPayment.id, err?.message ?? 'Payment failed');
    } finally {
      setPaymentLoading(false);
      setPendingPayment(null);
    }
  };

  const cancelPayment = () => {
    if (pendingPayment) {
      replyErrorToWebView(pendingPayment.id, 'User cancelled payment');
    }
    setPendingPayment(null);
  };

  if (consentStatus === 'loading') {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const canOpen = consentStatus === 'granted' || consentStatus === 'not_applicable';

  return (
    <>
      {canOpen ? (
        <WebView
          ref={webViewRef}
          source={{ uri: app.url! }}
          injectedJavaScriptBeforeContentLoaded={AZA_SDK_JS}
          onMessage={handleMessage}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          // Block all non-HTTPS origins — prevents JS injection from data: / file: / http:
          originWhitelist={['https://*']}
          // Prevent file system access from the WebView
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          // Allow only same-origin file URLs (none)
          allowFileAccessFromFileURLs={false}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.errorContainer]}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}
          onError={() => {}}
        />
      ) : null}

      {/* Consent gate */}
      <ConsentSheet
        visible={showConsent}
        appName={app.name}
        appIcon={app.icon}
        developerName={app.developerName}
        requestedPermissions={perms}
        onGrant={handleGrant}
        onDeny={handleDeny}
      />

      {/* Native payment confirmation — must show before any money moves */}
      <Modal visible={!!pendingPayment} transparent animationType="slide" onRequestClose={cancelPayment}>
        <View style={payStyles.overlay}>
          <View style={[payStyles.sheet, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Text style={[payStyles.title, { color: Colors.textPrimary }]}>Payment Request</Text>
            <Text style={[payStyles.appName, { color: Colors.textSecondary }]}>{app.name} is requesting a payment</Text>

            <View style={[payStyles.amountBox, { backgroundColor: Colors.background, borderColor: Colors.border }]}>
              <Text style={[payStyles.amountLabel, { color: Colors.textSecondary }]}>Amount</Text>
              <Text style={[payStyles.amount, { color: Colors.textPrimary }]}>
                GHS {(pendingPayment?.amount ?? 0).toFixed(2)}
              </Text>
            </View>

            <View style={[payStyles.row, { borderBottomColor: Colors.border }]}>
              <Text style={[payStyles.rowLabel, { color: Colors.textSecondary }]}>To</Text>
              <Text style={[payStyles.rowValue, { color: Colors.textPrimary }]}>{pendingPayment?.recipientIdentifier}</Text>
            </View>
            {pendingPayment?.note ? (
              <View style={[payStyles.row, { borderBottomColor: Colors.border }]}>
                <Text style={[payStyles.rowLabel, { color: Colors.textSecondary }]}>Note</Text>
                <Text style={[payStyles.rowValue, { color: Colors.textPrimary }]}>{pendingPayment.note}</Text>
              </View>
            ) : null}

            <Text style={[payStyles.warning, { color: Colors.textSecondary }]}>
              This payment cannot be reversed once confirmed.
            </Text>

            <View style={payStyles.actions}>
              <TouchableOpacity
                style={[payStyles.cancelBtn, { borderColor: Colors.border }]}
                onPress={cancelPayment}
                disabled={paymentLoading}
              >
                <Text style={[payStyles.cancelText, { color: Colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[payStyles.confirmBtn, { backgroundColor: Colors.primary }]}
                onPress={confirmPayment}
                disabled={paymentLoading}
              >
                {paymentLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={payStyles.confirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const payStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  appName: { fontSize: 13, marginBottom: 20 },
  amountBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: { fontSize: 12, marginBottom: 4 },
  amount: { fontSize: 32, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  warning: { fontSize: 12, textAlign: 'center', marginVertical: 16, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

function createStyles(Colors: ThemeColors) {
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
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    headerIcon: {
      width: 24,
      height: 24,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    headerIconEmoji: { fontSize: 14 },
    headerTitle: {
      ...Typography.body,
      fontWeight: '500',
      color: Colors.textPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: Colors.border,
    },
    content: { flex: 1 },
    // Dropdown menu
    menu: {
      position: 'absolute',
      right: Spacing.md,
      backgroundColor: Colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.border,
      minWidth: 160,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
      zIndex: 100,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    menuItemText: {
      ...Typography.body,
      fontSize: 14,
      color: Colors.textPrimary,
    },
    menuDivider: {
      height: 1,
      backgroundColor: Colors.border,
    },
    // Report bottom sheet
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    reportSheet: {
      position: 'absolute',
      bottom: 0,
      width: '100%',
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 8,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 8,
    },
    sheetCloseBtn: {
      padding: 4,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    sheetSubtitle: {
      ...Typography.body,
      fontSize: 14,
      color: Colors.textSecondary,
      marginBottom: 20,
    },
    reasonList: { gap: 8, marginBottom: 16 },
    reasonItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 6,
      backgroundColor: Colors.surface,
    },
    reasonItemActive: {
      borderColor: Colors.textPrimary,
    },
    reasonText: {
      ...Typography.body,
      fontSize: 14,
      color: Colors.textPrimary,
    },
    reasonTextActive: {
      fontWeight: '500',
      color: Colors.textPrimary,
    },
    detailsInput: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 80,
      color: Colors.textPrimary,
      ...Typography.body,
      fontSize: 14,
      backgroundColor: Colors.surface,
      marginBottom: 20,
    },
    // Error state
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
    },
    errorText: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
    },
    maintenanceTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: Colors.textPrimary,
      textAlign: 'center',
    },
    maintenanceBody: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
}
