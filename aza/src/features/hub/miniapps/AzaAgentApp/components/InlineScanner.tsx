import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import type { ThemeColors } from '../../../../../theme';

const { width } = Dimensions.get('window');
const FRAME = width * 0.7;

/**
 * Full-screen QR scanner shown as a modal. Calls `onScan` once with the raw
 * decoded string, then the caller closes it. Used by the agent cash-in /
 * cash-out pages so staff can scan instead of typing.
 */
export default function InlineScanner({
  title,
  prompt,
  onScan,
  onClose,
  Colors,
}: {
  title: string;
  prompt: string;
  onScan: (value: string) => void;
  onClose: () => void;
  Colors: ThemeColors;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const onBarcode = (result: BarcodeScanningResult) => {
    if (handled.current) return;
    const data = result?.data?.trim();
    if (!data) return;
    handled.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onScan(data);
  };

  return (
      <View style={styles.container}>
        {!permission?.granted ? (
          <View style={styles.permission}>
            <Text style={styles.permissionText}>Camera access is needed to scan.</Text>
            <TouchableOpacity style={[styles.permissionBtn, { backgroundColor: Colors.primary }]} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Grant camera access</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            onBarcodeScanned={onBarcode}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          >
            <View style={styles.overlay} />
            <View style={styles.frameWrap}>
              <View style={[styles.frame, { borderColor: Colors.primary }]} />
              <View style={styles.promptPill}>
                <Text style={styles.promptText}>{prompt}</Text>
              </View>
            </View>
            <SafeAreaView style={styles.topBar}>
              <TouchableOpacity onPress={onClose} style={styles.iconCircle}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.title}>{title}</Text>
              <View style={{ width: 44 }} />
            </SafeAreaView>
          </CameraView>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 9999, elevation: 9999 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  frameWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  frame: { width: FRAME, height: FRAME, borderWidth: 3, borderRadius: 20, backgroundColor: 'transparent' },
  promptPill: { marginTop: 28, backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  promptText: { color: '#000', fontWeight: '700', fontSize: 13 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontWeight: '700', fontSize: 16 },
  permission: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permissionText: { color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  permissionBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  permissionBtnText: { color: '#fff', fontWeight: '700' },
  cancel: { color: '#aaa', fontSize: 15 },
});
