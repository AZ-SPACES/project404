import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, Animated, Easing } from 'react-native';
import Button from '../../../components/ui/Button';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors, Radius } from '../../../theme';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useContactStore } from '../../../store/contactStore';
import { getPublicMerchant } from '../../../services/api';

const { width } = Dimensions.get('window');
const FRAME_SIZE = width * 0.7;

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

  // Reset scanner state when screen comes back into focus (e.g. after returning from ContactsProfile)
  useFocusEffect(
    React.useCallback(() => {
      setScanned(false);
      isProcessing.current = false;
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

  // Resolve a handle as a merchant and go straight to paying them. A verified/active
  // business opens the Send flow with the "Verified business" badge; otherwise the
  // verification screen warns the user instead of silently paying an unknown handle.
  const goToMerchant = async (handle: string, amount?: number, note?: string) => {
    try {
      const res = await getPublicMerchant(handle);
      const m = res?.data?.data ?? {};
      navigation.navigate('SendAmount', {
        name: m.businessName ?? `@${handle}`,
        username: `@${handle}`,
        avatar: m.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.businessName ?? handle)}&background=random`,
        identifier: `@${handle}`,
        merchantVerified: true,
        ...(amount !== undefined ? { amount } : {}),
        ...(note ? { note } : {}),
      });
    } catch {
      navigation.navigate('MerchantVerifyResult', {
        handle,
        ...(amount !== undefined ? { amount } : {}),
        ...(note ? { note } : {}),
      });
    }
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned || isProcessing.current || !frameLayout) return;

    const { bounds, data } = result;
    if (!bounds) return;

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
      
      const raw = data.trim();

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

      try {
        const user = await findUserByHandle(handle);
        if (user) {
          const avatar = user.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random`;
          if (amount !== undefined) {
            // Payment-request QR: open Send pre-filled with the requested amount/note.
            navigation.navigate('SendAmount', {
              id: user.id,
              name: user.displayName,
              username: `@${user.handle}`,
              avatar,
              identifier: `@${user.handle}`,
              amount,
              ...(note ? { note } : {}),
            });
          } else {
            navigation.navigate('ContactsProfile', {
              id: user.id,
              name: user.displayName,
              username: `@${user.handle}`,
              avatar,
            });
          }
        } else {
          // Not a user — the legacy pay/{handle} format is also used for merchant store
          // codes, so resolve it as a business and go straight to paying them.
          await goToMerchant(handle, amount, note);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to resolve QR code. Please try again.', [
          { text: 'OK', onPress: () => { setScanned(false); isProcessing.current = false; } }
        ]);
      }
    }
  };

  const toggleFlash = () => setTorchEnabled(!torchEnabled);

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
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        enableTorch={torchEnabled}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        <View style={styles.overlay} />
        
        <View style={styles.frameContainer}>
          <View 
            style={styles.frame}
            onLayout={(event) => setFrameLayout(event.nativeEvent.layout)}
          >
            {/* The Animated Scanning Line */}
            <Animated.View 
              style={[
                styles.scanLine, 
                { transform: [{ translateY: scanAnim }] }
              ]} 
            />

            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          
          <View style={styles.scanLabelContainer}>
            <Text style={styles.scanLabel}>Scan code to pay</Text>
          </View>
        </View>

        <SafeAreaView style={styles.topControls}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
            <Ionicons name="chevron-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={toggleFlash} style={styles.iconCircle}>
            <MaterialCommunityIcons 
              name={torchEnabled ? 'flash' : 'flash-off'} 
              size={24} 
              color= {Colors.white} 
            />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.bottomNav}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity style={[styles.toggleButton, styles.activeToggle]}>
              <Text style={styles.toggleTextActive}>Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toggleButton} onPress={onToggle}>
              <Text style={styles.toggleTextInactive}>My code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
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