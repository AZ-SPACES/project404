import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors, Typography, Spacing } from "../../theme";
import Button from "../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";

// NOTE: These native libraries require custom development builds (`npx expo run:ios`)
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { runOnJS } from "react-native-reanimated";
import { scanOCR } from 'vision-camera-ocr';
import Cropper from '@yesdevs/react-native-perspective-image-cropper';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width, height } = Dimensions.get("window");
const FRAME_WIDTH = width * 0.85;
const FRAME_HEIGHT = FRAME_WIDTH * 0.63;

export default function ScanIdScreen_devbuild() {
  const navigation = useNavigation<NavigationProp>();
  // react-native-vision-camera hook
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [feedback, setFeedback] = useState("Align ID in Frame");
  const [isLivenessMet, setIsLivenessMet] = useState(false);
  
  const cameraRef = useRef<Camera>(null);
  const insets = useSafeAreaInsets();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Liveness Tracker State
  const timeInFrameRef = useRef(0);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  useEffect(() => {
    if (!capturedImage && hasPermission && device) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanLineAnim.stopAnimation();
    }
  }, [capturedImage, hasPermission, device]);

  // Actual Frame Processor (executes on Worklet Thread) 
  // IMPORTANT: For true native edge detection, replace with the implementation of your chosen module.
  const frameProcessor = useFrameProcessor((frame: any) => {
    'worklet';
    
    // Perform OCR or edge detection
    const data = scanOCR(frame);
    
    if (data.result?.blocks?.length > 0) {
      runOnJS(handleEdgeDetected)();
    } else {
      runOnJS(handleEdgeLost)();
    }
  }, []);

  const handleEdgeDetected = () => {
    if (feedback !== "Hold Still") {
      setFeedback("Hold Still");
    }
    
    // Simulate 1.5s liveness
    timeInFrameRef.current += 100; // Assuming ~10 FPS for frame updates running OnJS 
    if (timeInFrameRef.current >= 1500 && !isLivenessMet && !capturedImage) {
      setIsLivenessMet(true);
      handleCapture();
    }
  };

  const handleEdgeLost = () => {
    setFeedback("Move Closer");
    timeInFrameRef.current = 0;
  };

  const handleCapture = async () => {
    try {
      if (cameraRef.current) {
        setFeedback("Processing...");
        const photo = await cameraRef.current.takePhoto();
        
        // Example Unwarp Logic:
        // const unwarped = await Cropper.crop(photo.path, detectedPoints);
        // setCapturedImage(`file://${unwarped}`);

        setCapturedImage(`file://${photo.path}`);
        setIsModalVisible(true);
      }
    } catch (e) {
      console.log("Camera capture failed", e);
      setCapturedImage("placeholder");
      setIsModalVisible(true);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setIsModalVisible(false);
    setIsLivenessMet(false);
    timeInFrameRef.current = 0;
    setFeedback("Align ID");
  };

  const handleLooksGood = () => {
    setIsModalVisible(false);
    navigation.goBack();
  };

  if (!hasPermission || device == null) {
    return (
      <View style={styles.fullScreenBlack}>
        <Text style={styles.permissionText}>
          {device == null ? "No Camera Device Found" : "No camera permission. Please grant access."}
        </Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_HEIGHT - 4]
  });

  return (
    <View style={styles.container}>
      {capturedImage && capturedImage !== "placeholder" ? (
        <Image style={styles.fullScreen} source={{ uri: capturedImage }} resizeMode="contain" />
      ) : (
        <Camera
          style={styles.fullScreen}
          device={device}
          isActive={!isModalVisible && !capturedImage}
          ref={cameraRef}
          photo={true}
          photoQualityBalance="quality"
          frameProcessor={frameProcessor}
        />
      )}

      {/* Overlay */}
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        {!isModalVisible && (
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons
                name="chevron-left"
                size={34}
                color={Colors.background}
              />
            </TouchableOpacity>
            <View style={styles.textContainer}>
              <Text style={styles.headerTitle}>Front of your ID</Text>
              <Text style={styles.subtitle}>
                Hold up your ID and take a picture. Your entire ID must be in the
                frame.
              </Text>
            </View>
          </View>
        )}

        {/* Frame Cutout */}
        <View style={styles.frameContainer}>
          {!capturedImage && (
            <View style={styles.frame}>
              <View style={[styles.corner, styles.topLeft, feedback === "Hold Still" && styles.cornerActive]} />
              <View style={[styles.corner, styles.topRight, feedback === "Hold Still" && styles.cornerActive]} />
              <View style={[styles.corner, styles.bottomLeft, feedback === "Hold Still" && styles.cornerActive]} />
              <View style={[styles.corner, styles.bottomRight, feedback === "Hold Still" && styles.cornerActive]} />
              
              <View style={styles.feedbackContainer}>
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>

              <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
            </View>
          )}
        </View>

        {!isModalVisible && (
          <View style={[styles.footerContainer, { paddingBottom: insets.bottom || 24 }]}>
            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Confirmation Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom || Spacing.lg }]}>
            <Text style={styles.modalTitle}>Is your ID easy to read?</Text>
            <Text style={styles.modalSubtitle}>
              Please make sure the text is clear and your entire card is visible.
            </Text>
            <View style={styles.modalActions}>
              <Button
                title="Yes, looks good"
                onPress={handleLooksGood}
                backgroundColor={Colors.primary}
                textColor={Colors.background}
                borderRadius={30}
                paddingVertical={16}
                fontSize={Number(Typography.button.fontSize)}
              />
              <View style={{ height: Spacing.md }} />
              <Button
                title="Retake"
                onPress={handleRetake}
                backgroundColor={Colors.secondary}
                textColor={Colors.primary}
                borderRadius={30}
                paddingVertical={16}
                fontSize={Number(Typography.button.fontSize)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  fullScreen: { ...StyleSheet.absoluteFillObject },
  fullScreenBlack: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  permissionText: { color: '#fff', marginBottom: Spacing.md, textAlign: 'center' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  headerContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  backButton: { width: 44, height: 44, justifyContent: "center", marginBottom: Spacing.md },
  textContainer: { marginBottom: Spacing.md, backgroundColor: 'rgba(0,0,0,0.6)', padding: Spacing.md, borderRadius: 12 },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: Spacing.sm },
  subtitle: { fontSize: 14, color: "#e5e7eb", lineHeight: 20 },
  frameContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME_WIDTH, height: FRAME_HEIGHT, position: 'relative', overflow: 'hidden' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#ffffff', borderWidth: 0, opacity: 0.8 },
  cornerActive: { borderColor: '#4ade80' },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  scanLine: { position: 'absolute', width: '100%', height: 4, backgroundColor: '#3b82f6', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
  feedbackContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  feedbackText: { backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, fontSize: 18, fontWeight: '600', overflow: 'hidden' },
  footerContainer: { alignItems: 'center', paddingBottom: Spacing.xl * 1.5 },
  captureButton: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  modalTitle: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  modalSubtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 24 },
  modalActions: { marginBottom: Spacing.md },
});
