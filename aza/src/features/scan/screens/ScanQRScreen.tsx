import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, Animated, Easing, Share, Modal, TextInput, Image, Keyboard, AccessibilityInfo } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import Button from '../../../components/ui/Button';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors, Radius } from '../../../theme';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useContactStore } from '../../../store/contactStore';
import { getPublicMerchant, reportHandle } from '../../../services/api';
import { useProfile } from '../../../providers/ProfileProvider';
import { useToast } from '../../../providers/ToastProvider';

const { width } = Dimensions.get('window');
const FRAME_SIZE = width * 0.7;

// A resolved payment recipient awaiting the user's confirmation before we open Send.
type PendingPayee = {
  name: string;
  handle: string;      // without leading @
  avatar: string;
  verified: boolean;   // true for known/active businesses
  amount?: number | undefined;
  note?: string | undefined;
  params: RootStackParamList['SendAmount']; // params handed to the SendAmount screen on confirm
};

const ScanQRScreen = ({ onToggle }: { onToggle: () => void }) => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [frameLayout, setFrameLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const scanAnim = useRef(new Animated.Value(0)).current;
  const isProcessing = useRef(false);
  const { findUserByHandle } = useContactStore();
  const { handle: myHandle, displayName: myName } = useProfile();
  const { showToast } = useToast();

  // Pinch-to-zoom: CameraView takes a 0..1 zoom. We track the live value in state
  // (to drive the camera) and mirror it in a ref so the gesture's onEnd can read
  // the latest value without a stale closure.
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const zoomBase = useRef(0);
  const applyZoom = (v: number) => {
    const next = Math.min(1, Math.max(0, v));
    zoomRef.current = next;
    setZoom(next);
  };
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      // Map the pinch scale onto the 0..1 range; 0.25 keeps it from feeling twitchy.
      applyZoom(zoomBase.current + (e.scale - 1) * 0.25);
    })
    .onEnd(() => {
      zoomBase.current = zoomRef.current;
    })
    .runOnJS(true);

  // Confirm-before-pay: instead of jumping straight into the Send flow, we resolve
  // the payee, show a recipient card, and only navigate once the user confirms.
  const [pendingPayee, setPendingPayee] = useState<PendingPayee | null>(null);
  // Manual entry fallback for codes that won't scan.
  const [manualVisible, setManualVisible] = useState(false);
  const [manualText, setManualText] = useState('');

  // "Locking on" feedback (#2): when a QR enters view we tint the frame corners
  // and give a light haptic, before the code is resolved. A short timer clears
  // the state once the code leaves the frame.
  const [detected, setDetected] = useState(false);
  const detectedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockHaptic = useRef(false);
  const cornerPulse = useRef(new Animated.Value(1)).current;

  // Low-light torch nudge (#1): no ambient-light sensor is available, so we
  // surface a hint if the user lingers on the scanner without a successful scan.
  const [showTorchHint, setShowTorchHint] = useState(false);
  const torchHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDetected = () => {
    if (!detected) {
      setDetected(true);
      Animated.sequence([
        Animated.timing(cornerPulse, { toValue: 1.06, duration: 150, useNativeDriver: true }),
        Animated.timing(cornerPulse, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
    if (!lockHaptic.current) {
      lockHaptic.current = true;
      Haptics.selectionAsync().catch(() => {});
    }
    if (detectedTimer.current) clearTimeout(detectedTimer.current);
    detectedTimer.current = setTimeout(() => {
      setDetected(false);
      lockHaptic.current = false;
    }, 500);
  };

  const resetScanner = () => { setScanned(false); isProcessing.current = false; };

  const confirmPayee = (p: PendingPayee) => setPendingPayee(p);

  const handleConfirmPay = () => {
    if (!pendingPayee) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('SendAmount', pendingPayee.params);
    setPendingPayee(null);
  };

  const handleCancelPay = () => {
    setPendingPayee(null);
    resetScanner();
  };

  // Report a scanned handle / store code as a scam etc. (#5).
  const submitReport = async (handle: string, reason: string) => {
    try {
      await reportHandle(handle, reason);
      showToast('Report submitted. Thanks for keeping Aza safe.', 'success');
    } catch {
      showToast('Could not submit report. Please try again.', 'error');
    }
  };

  const handleReportPayee = () => {
    if (!pendingPayee) return;
    const handle = pendingPayee.handle;
    // Android's Alert supports at most three buttons, so keep to the two most
    // common reasons plus Cancel.
    Alert.alert(
      'Report this code',
      `Why are you reporting @${handle}?`,
      [
        { text: 'Scam or fraud', style: 'destructive', onPress: () => submitReport(handle, 'SCAM') },
        { text: 'Impersonation', onPress: () => submitReport(handle, 'IMPERSONATION') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleManualSubmit = async () => {
    const value = manualText.trim();
    if (!value) return;
    Keyboard.dismiss();
    setManualVisible(false);
    setManualText('');
    isProcessing.current = true;
    setScanned(true);
    await processQrData(value);
  };

  // Reset scanner state when screen comes back into focus (e.g. after returning from ContactsProfile)
  useFocusEffect(
    React.useCallback(() => {
      setScanned(false);
      isProcessing.current = false;

      // Start the low-light torch nudge timer; it fires if the user lingers
      // ~6s without a successful scan and the torch is still off.
      setShowTorchHint(false);
      if (torchHintTimer.current) clearTimeout(torchHintTimer.current);
      torchHintTimer.current = setTimeout(() => setShowTorchHint(true), 6000);

      return () => {
        if (torchHintTimer.current) clearTimeout(torchHintTimer.current);
        if (detectedTimer.current) clearTimeout(detectedTimer.current);
      };
    }, [])
  );

  useEffect(() => {
    if (!permission) requestPermission();
    
    const startAnimation = () => {
      scanAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: FRAME_SIZE - 2,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true }),
        ])
      ).start();
    };

    startAnimation();
  }, [permission]);

  // Announce the resolved recipient to screen readers when the confirm card opens (#7).
  useEffect(() => {
    if (pendingPayee) {
      const amt = pendingPayee.amount !== undefined ? `, amount GHS ${pendingPayee.amount.toFixed(2)}` : '';
      AccessibilityInfo.announceForAccessibility(`Confirm payment to ${pendingPayee.name}${amt}`);
    }
  }, [pendingPayee]);

  // Resolve a handle as a merchant and go straight to paying them. A verified/active
  // business opens the Send flow with the "Verified business" badge; otherwise the
  // verification screen warns the user instead of silently paying an unknown handle.
  const goToMerchant = async (handle: string, amount?: number, note?: string) => {
    try {
      const res = await getPublicMerchant(handle);
      const m = res?.data?.data ?? {};
      const name = m.businessName ?? `@${handle}`;
      const avatar = m.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.businessName ?? handle)}&background=random`;
      confirmPayee({
        name,
        handle,
        avatar,
        verified: true,
        amount,
        note,
        params: {
          name,
          username: `@${handle}`,
          avatar,
          identifier: `@${handle}`,
          merchantVerified: true,
          ...(amount !== undefined ? { amount } : {}),
          ...(note ? { note } : {}),
        },
      });
    } catch {
      navigation.navigate('MerchantVerifyResult', {
        handle,
        ...(amount !== undefined ? { amount } : {}),
        ...(note ? { note } : {}),
      });
    }
  };

  // Route a decoded QR payload to the right destination. Shared by the live
  // camera handler and the "scan from gallery" picker so both behave identically.
  const processQrData = async (raw: string) => {
      // QR login for web portals: aza://qr-login?token=...&site=ADMIN
      // OAuth QR: aza://qr-login?token=...&site=THIRD_PARTY&client_id=...&scopes=...
      if (raw.startsWith('aza://qr-login')) {
        try {
          const url = new URL(raw);
          const token = url.searchParams.get('token');
          const site = url.searchParams.get('site') ?? 'ADMIN';
          if (!token) throw new Error('Missing token');
          const siteNames: Record<string, string> = {
            ADMIN: 'Admin Portal',
            MERCHANT: 'Merchant Portal',
            DEVELOPER: 'Developer Portal',
            SUPERAGENT: 'Superagent Portal',
            THIRD_PARTY: 'External App',
          };
          const params: Record<string, unknown> = {
            challengeToken: token,
            siteType: site,
            siteName: siteNames[site] ?? site,
          };
          if (site === 'THIRD_PARTY') {
            const clientId = url.searchParams.get('client_id');
            const scopes   = url.searchParams.get('scopes');
            if (!clientId) throw new Error('Missing client_id');
            (params as any).oauthClientId = clientId;
            (params as any).oauthScopes   = scopes ?? '';
          }
          navigation.navigate('QrLoginApproval', params as any);
        } catch {
          Alert.alert('Invalid QR', 'This QR code is not valid.', [
            { text: 'OK', onPress: () => { setScanned(false); isProcessing.current = false; } }
          ]);
        }
        return;
      }

      // Merchant checkout link: pay.aza.systems/c/{sessionId}
      const checkoutMatch = raw.match(/pay\.aza\.systems\/c\/([a-f0-9-]{36})/i);
      if (checkoutMatch) {
        navigation.navigate('MerchantCheckout', { sessionId: checkoutMatch[1]! });
        return;
      }

      // Statement verification QR: aza.systems/verify?code={code} (also www.)
      const statementMatch = raw.match(/aza\.systems\/verify\?code=([A-Za-z0-9-]+)/i);
      if (statementMatch) {
        navigation.navigate('StatementVerifyResult', { code: statementMatch[1]! });
        return;
      }

      // Payment-proof QR: aza.systems/p?ref={txnId}&sig={hmac} — the payer's
      // tamper-evident "I paid this" code. Verify it against the ledger.
      const proofMatch = raw.match(/aza\.systems\/p\?(.+)$/i);
      if (proofMatch?.[1]) {
        try {
          const params = new URLSearchParams(proofMatch[1]);
          const proofRef = params.get('ref');
          const proofSig = params.get('sig');
          if (proofRef && proofSig) {
            navigation.navigate('PaymentVerifyResult', { ref: proofRef, sig: proofSig });
            return;
          }
        } catch {
          // Malformed — fall through to the other matchers.
        }
      }

      // Agent cash-out withdrawal code (#4): a one-time all-caps alphanumeric code a
      // customer shows an agent to collect cash. It isn't a payable handle, so
      // recognise it explicitly and guide the user instead of failing the handle
      // lookup with a confusing "no account found".
      const withdrawalCode = raw.match(/^[A-Z0-9]{8,12}$/);
      if (withdrawalCode) {
        const wcReset = () => { setScanned(false); isProcessing.current = false; };
        Alert.alert(
          'Withdrawal code',
          `This is an AZA cash-out code (${raw}).\n\nIf you’re an agent, open the Agent app → Cash out to redeem it and hand over the cash. If you’re a customer, show this code to an agent.`,
          [
            {
              text: 'Copy code',
              onPress: async () => { await Clipboard.setStringAsync(raw).catch(() => {}); wcReset(); },
            },
            { text: 'OK', style: 'cancel', onPress: wcReset },
          ],
        );
        return;
      }

      // User profile / payment link → opens the contact profile (Send / Request / Add),
      // or jumps straight into the Send flow pre-filled when the link carries an amount
      // (a "money request" QR). Accepts the formats the app itself generates and shares:
      //   https://aza.systems/pay/<handle>[?amount=..&note=..]   (MyCodeScreen)
      //   https://aza.systems/<handle>, https://aza.me/<handle>, @<handle>, or bare <handle>
      let amount: number | undefined;
      let note: string | undefined;
      const qIndex = raw.indexOf('?');
      if (qIndex >= 0) {
        try {
          const params = new URLSearchParams(raw.slice(qIndex + 1));
          const amt = parseFloat(params.get('amount') ?? '');
          if (!isNaN(amt) && amt > 0) amount = amt;
          const n = params.get('note') ?? params.get('description');
          if (n) note = n;
        } catch {
          // Malformed query — fall back to opening the profile.
        }
      }

      // Merchant store code: aza.systems/m/<handle> → pay the business directly
      // (unambiguous, no user lookup). goToMerchant shows the verified badge or warns.
      const merchantMatch = raw.match(/aza\.systems\/m\/([A-Za-z0-9_.-]+)/i);
      if (merchantMatch?.[1]) {
        await goToMerchant(merchantMatch[1], amount, note);
        return;
      }

      let handle = raw;
      const hostMatch = raw.match(/(?:aza\.systems|aza\.me)\/(.+)$/i);
      if (hostMatch?.[1]) handle = hostMatch[1];
      handle = handle
        .replace(/^https?:\/\//i, '') // strip any leftover scheme
        .replace(/^pay\//i, '')        // strip the /pay/ segment
        .split(/[?#]/)[0]!             // drop query string / hash
        .split('/')[0]!                // first path segment only
        .replace(/^@/, '')             // drop a leading @
        .trim();

      if (!handle) {
        Alert.alert('Invalid QR', 'This QR code is not a recognised Aza code.', [
          { text: 'OK', onPress: () => { setScanned(false); isProcessing.current = false; } }
        ]);
        return;
      }

      // Scanning your own code — there's nothing to pay or add; let the user know
      // and offer to share it so others can pay or add them.
      if (myHandle && handle.toLowerCase() === myHandle.toLowerCase()) {
        const reset = () => { setScanned(false); isProcessing.current = false; };
        const link = `https://aza.systems/pay/${myHandle}`;
        Alert.alert(
          'This is your code',
          'You just scanned your own Aza QR code. Share it so others can pay you or add you.',
          [
            {
              text: 'Share',
              onPress: async () => {
                try {
                  await Share.share({ message: `Pay ${myName || `@${myHandle}`} on Aza: ${link}`, url: link });
                } catch {
                  // user cancelled / share unavailable
                }
                reset();
              },
            },
            { text: 'Close', style: 'cancel', onPress: reset },
          ],
        );
        return;
      }

      try {
        // Merchant-first: a handle can be a business (store code) or a person, and the
        // /users/by-handle lookup also resolves merchants — so check the business
        // directory explicitly first and pay verified businesses rather than treating
        // them as a contact to add.
        let merchant: any = null;
        try {
          const mRes = await getPublicMerchant(handle);
          merchant = mRes?.data?.data ?? null;
        } catch {
          // Not an active/known business — fall through to the person lookup.
        }

        if (merchant) {
          const mHandle = merchant.businessHandle ?? handle;
          const name = merchant.businessName ?? `@${handle}`;
          const avatar = merchant.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(merchant.businessName ?? handle)}&background=random`;
          confirmPayee({
            name,
            handle: mHandle,
            avatar,
            verified: true,
            amount,
            note,
            params: {
              name,
              username: `@${mHandle}`,
              avatar,
              identifier: `@${mHandle}`,
              merchantVerified: true,
              ...(amount !== undefined ? { amount } : {}),
              ...(note ? { note } : {}),
            },
          });
          return;
        }

        const user = await findUserByHandle(handle);
        if (user) {
          // The backend public-profile field is `username`; older typings call it `handle`.
          const userHandle = (user as any).username ?? (user as any).handle ?? handle;
          const avatar = user.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random`;
          if (amount !== undefined) {
            // Payment-request QR: confirm, then open Send pre-filled with the amount/note.
            confirmPayee({
              name: user.displayName,
              handle: userHandle,
              avatar,
              verified: false,
              amount,
              note,
              params: {
                id: user.id,
                name: user.displayName,
                username: `@${userHandle}`,
                avatar,
                identifier: `@${userHandle}`,
                amount,
                ...(note ? { note } : {}),
              },
            });
          } else {
            navigation.navigate('ContactsProfile', {
              id: user.id,
              name: user.displayName,
              username: `@${userHandle}`,
              avatar,
            });
          }
        } else {
          Alert.alert('Not found', `No Aza account or business found for @${handle}.`, [
            { text: 'OK', onPress: () => { setScanned(false); isProcessing.current = false; } }
          ]);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to resolve QR code. Please try again.', [
          { text: 'OK', onPress: () => { setScanned(false); isProcessing.current = false; } }
        ]);
      }
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned || isProcessing.current || !frameLayout) return;

    const { bounds, data } = result;
    if (!bounds) return;

    // A code is in view — give "locking on" feedback even before it resolves (#2).
    markDetected();

    const qrCenterX = bounds.origin.x + bounds.size.width / 2;
    const qrCenterY = bounds.origin.y + bounds.size.height / 2;

    const isInsideFrame =
      qrCenterX >= frameLayout.x &&
      qrCenterX <= frameLayout.x + frameLayout.width &&
      qrCenterY >= frameLayout.y &&
      qrCenterY <= frameLayout.y + frameLayout.height;

    if (isInsideFrame) {
      isProcessing.current = true;
      setScanned(true);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('QR code scanned');

      await processQrData(data.trim());
    }
  };

  // Decode a QR code out of a saved image / screenshot from the photo library,
  // then route it through the same handler the live camera uses.
  const handlePickFromGallery = async () => {
    if (isProcessing.current) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo access needed', 'Allow photo access to scan a saved QR code.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (res.canceled || !res.assets?.length) return;

      isProcessing.current = true;
      setScanned(true);

      const scans = await scanFromURLAsync(res.assets[0]!.uri, ['qr']);
      const found = scans?.[0]?.data?.trim();
      if (!found) {
        Alert.alert('No QR code found', 'We couldn’t find an Aza QR code in that image.', [
          { text: 'OK', onPress: () => { setScanned(false); isProcessing.current = false; } }
        ]);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('QR code found');
      await processQrData(found);
    } catch {
      Alert.alert('Error', 'Could not read that image. Please try another.', [
        { text: 'OK', onPress: () => { setScanned(false); isProcessing.current = false; } }
      ]);
    }
  };

  const toggleFlash = () => {
    setShowTorchHint(false);
    setTorchEnabled((prev) => !prev);
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Button
          title="Grant Camera Permission"
          onPress={requestPermission}
          width="auto"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pinchGesture}>
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        enableTorch={torchEnabled}
        zoom={zoom}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        <View style={styles.overlay} />
        
        <View style={styles.frameContainer}>
          <Animated.View
            style={[styles.frame, { transform: [{ scale: cornerPulse }] }]}
            onLayout={(event) => setFrameLayout(event.nativeEvent.layout)}
          >
            {/* The Animated Scanning Line */}
            <Animated.View
              style={[
                styles.scanLine,
                { transform: [{ translateY: scanAnim }] }
              ]}
            />

            {/* Corners tint to the brand colour while a code is "locking on" (#2). */}
            <View style={[styles.corner, styles.topLeft, detected && styles.cornerActive]} />
            <View style={[styles.corner, styles.topRight, detected && styles.cornerActive]} />
            <View style={[styles.corner, styles.bottomLeft, detected && styles.cornerActive]} />
            <View style={[styles.corner, styles.bottomRight, detected && styles.cornerActive]} />
          </Animated.View>

          <View style={styles.scanLabelContainer}>
            <Text style={styles.scanLabel}>{detected ? 'Hold steady…' : 'Scan code to pay'}</Text>
          </View>

          {/* Low-light torch nudge (#1). */}
          {showTorchHint && !torchEnabled && (
            <TouchableOpacity
              style={styles.torchHint}
              onPress={toggleFlash}
              accessibilityRole="button"
              accessibilityLabel="Trouble scanning? Turn on the flashlight"
            >
              <MaterialCommunityIcons name="flashlight" size={16} color={Colors.black} />
              <Text style={styles.torchHintText}>Trouble scanning? Tap for light</Text>
            </TouchableOpacity>
          )}
        </View>

        <SafeAreaView style={styles.topControls}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconCircle}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleFlash}
            style={styles.iconCircle}
            accessibilityRole="button"
            accessibilityLabel={torchEnabled ? 'Turn off flashlight' : 'Turn on flashlight'}
            accessibilityState={{ selected: torchEnabled }}
          >
            <MaterialCommunityIcons
              name={torchEnabled ? 'flash' : 'flash-off'}
              size={24}
              color= {Colors.white}
            />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.bottomNav}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={handlePickFromGallery}
              accessibilityRole="button"
              accessibilityLabel="Scan a QR code from a saved photo"
            >
              <Ionicons name="images-outline" size={18} color={Colors.white} />
              <Text style={styles.galleryButtonText}>Upload from gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={() => setManualVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Enter a handle or code manually"
            >
              <Ionicons name="create-outline" size={18} color={Colors.white} />
              <Text style={styles.galleryButtonText}>Enter code</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.toggleContainer} accessibilityRole="tablist">
            <TouchableOpacity
              style={[styles.toggleButton, styles.activeToggle]}
              accessibilityRole="tab"
              accessibilityState={{ selected: true }}
              accessibilityLabel="Scan tab, selected"
            >
              <Text style={styles.toggleTextActive}>Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={onToggle}
              accessibilityRole="tab"
              accessibilityLabel="Switch to My code tab"
            >
              <Text style={styles.toggleTextInactive}>My code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
      </GestureDetector>

      {/* Confirm-before-pay: recipient card shown after a pay code resolves. */}
      <Modal visible={!!pendingPayee} transparent animationType="fade" onRequestClose={handleCancelPay}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Confirm recipient</Text>
            {pendingPayee && (
              <>
                <Image source={{ uri: pendingPayee.avatar }} style={styles.sheetAvatar} />
                <Text style={styles.sheetName}>{pendingPayee.name}</Text>
                <View style={styles.sheetHandleRow}>
                  <Text style={styles.sheetHandle}>@{pendingPayee.handle}</Text>
                  {pendingPayee.verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                      <Text style={styles.verifiedText}>Verified business</Text>
                    </View>
                  )}
                </View>
                {pendingPayee.amount !== undefined && (
                  <Text style={styles.sheetAmount}>GHS {pendingPayee.amount.toFixed(2)}</Text>
                )}
                {pendingPayee.note ? (
                  <Text style={styles.sheetNote} numberOfLines={2}>“{pendingPayee.note}”</Text>
                ) : null}
                <Button title={pendingPayee.amount !== undefined ? 'Continue to pay' : 'Continue'} onPress={handleConfirmPay} />
                <View style={styles.sheetFooterRow}>
                  <TouchableOpacity onPress={handleCancelPay} style={styles.sheetCancel} accessibilityRole="button" accessibilityLabel="Cancel">
                    <Text style={styles.sheetCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleReportPayee} style={styles.sheetCancel} accessibilityRole="button" accessibilityLabel="Report this code">
                    <Text style={styles.sheetReportText}>Report this code</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Manual entry fallback for codes that won't scan. */}
      <Modal visible={manualVisible} transparent animationType="fade" onRequestClose={() => setManualVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Enter handle or link</Text>
            <Text style={styles.sheetSubtitle}>Type an @handle, a store code, or an aza.systems pay link.</Text>
            <TextInput
              style={styles.manualInput}
              value={manualText}
              onChangeText={setManualText}
              placeholder="@handle or aza.systems/pay/handle"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleManualSubmit}
            />
            <Button title="Continue" onPress={handleManualSubmit} />
            <TouchableOpacity onPress={() => { setManualVisible(false); setManualText(''); }} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.black, 
    justifyContent: 'center' 
  },
  buttonText: {
    color: Colors.white
    ,
    fontWeight: 'bold'
  },
  overlay: { 
    ...StyleSheet.absoluteFill, 
    backgroundColor: Colors.black60 
  },
  frameContainer: { 
    ...StyleSheet.absoluteFill, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderWidth: 1,
    borderColor: Colors.white30,
    borderRadius: Radius.lg,
    overflow: 'hidden' },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5 },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Colors.white
  },
  cornerActive: {
    borderColor: Colors.primary,
  },
  topLeft: { 
    top: -2, 
    left: -2, 
    borderTopWidth: 4, 
    borderLeftWidth: 4, 
    borderTopLeftRadius: Radius.lg 
  },
  topRight: { 
    top: -2, 
    right: -2, 
    borderTopWidth: 4, 
    borderRightWidth: 4, 
    borderTopRightRadius: Radius.lg 
  },
  bottomLeft: { 
    bottom: -2, 
    left: -2, 
    borderBottomWidth: 4, 
    borderLeftWidth: 4, 
    borderBottomLeftRadius: Radius.lg 
  },
  bottomRight: { 
    bottom: -2, 
    right: -2, 
    borderBottomWidth: 4, 
    borderRightWidth: 4, 
    borderBottomRightRadius: Radius.lg 
  },
  scanLabelContainer: {
    marginTop: 40,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20 },
  scanLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.black
  },
  torchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  torchHintText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.black,
  },
  topControls: { 
    position: 'absolute', 
    top: 50, 
    left: 20, 
    right: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  iconCircle: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: Colors.black60, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  bottomNav: {
    position: 'absolute',
    bottom: 100,
    width: '100%',
    alignItems: 'center'
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    backgroundColor: Colors.black60,
  },
  galleryButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: Colors.black60,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
    backgroundColor: Colors.surface,
  },
  sheetName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  sheetHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  sheetHandle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  verifiedText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
  },
  sheetAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginVertical: 4,
  },
  sheetNote: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 12,
  },
  sheetFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sheetCancel: {
    paddingVertical: 12,
    marginTop: 8,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  sheetReportText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.error,
  },
  manualInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  toggleContainer: { 
    flexDirection: 'row', 
    padding: 4, 
    borderRadius: 30, 
    width: 220, 
    backgroundColor: Colors.black60 
  },
  toggleButton: { 
    flex: 1, 
    paddingVertical: 12, 
    alignItems: 'center', 
    borderRadius: 30 
  },
  activeToggle: { 
    backgroundColor: Colors.white20 
  },
  toggleTextActive: { 
    color: Colors.white, 
    fontWeight: 'bold' 
  },
  toggleTextInactive: { 
    color: Colors.white60, 
    fontWeight: 'bold' 
  } });
}

export default ScanQRScreen;