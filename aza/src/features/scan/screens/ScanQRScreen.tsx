import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, Animated, Easing } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors, Radius } from '../../../theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      
      Alert.alert(
        'Success',
        `QR Code detected: ${data}`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              setScanned(false);
              isProcessing.current = false;
            } 
          }
        ]
      );
    }
  };

  const toggleFlash = () => setTorchEnabled(!torchEnabled);

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
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
  button: { 
    padding: 16, 
    backgroundColor: Colors.primary, 
    borderRadius: 8, 
    alignSelf: 'center' 
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