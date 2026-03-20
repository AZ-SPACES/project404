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

// NOTE: These native libraries require a custom development build (`npx expo run:ios`)
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from "react-native-vision-camera";
import { runOnJS } from "react-native-reanimated";

// NOTE: Replace with a proper face detection plugin (e.g. vision-camera-face-detector)
// when available for your RN version. This uses the OCR plugin as a presence proxy.
import { scanOCR } from "vision-camera-ocr";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width, height } = Dimensions.get("window");
const OVAL_WIDTH = width * 0.7;
const OVAL_HEIGHT = OVAL_WIDTH * 1.3;

type FeedbackState = "Center your face" | "Move closer" | "Hold still" | "Processing...";

// Milliseconds a face must be held steady before auto-capture
const LIVENESS_THRESHOLD_MS = 1500;

export default function SelfieScanScreen_devbuild() {
  const navigation = useNavigation<NavigationProp>();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>("Center your face");
  const [isLivenessMet, setIsLivenessMet] = useState(false);

  const cameraRef = useRef<Camera>(null);
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  // Tracks cumulative ms a face has been detected (~10 FPS from runOnJS)
  const timeInFrameRef = useRef(0);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  // Oval pulse animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 900, useNativeDriver: true }),
      ])
    );
    if (!capturedImage && hasPermission && device) {
      loop.start();
    }
    return () => loop.stop();
  }, [capturedImage, hasPermission, device]);

  // Frame processor — runs on native thread, calls JS via runOnJS
  // Replace scanOCR with a face detection plugin for production use
  const frameProcessor = useFrameProcessor((frame: any) => {
    "worklet";
    const data = scanOCR(frame);
    // Treat any detected text as a proxy for a face being present in frame
    if (data.result?.blocks?.length > 0) {
      runOnJS(handleFaceDetected)();
    } else {
      runOnJS(handleFaceLost)();
    }
  }, []);

  const handleFaceDetected = () => {
    if (feedback !== "Hold still") {
      setFeedback("Hold still");
    }
    timeInFrameRef.current += 100; // ~10 fps budget per runOnJS call
    if (timeInFrameRef.current >= LIVENESS_THRESHOLD_MS && !isLivenessMet && !capturedImage) {
      setIsLivenessMet(true);
      handleCapture();
    }
  };

  const handleFaceLost = () => {
    setFeedback("Center your face");
    timeInFrameRef.current = 0;
  };

  const handleCapture = async () => {
    try {
      if (cameraRef.current) {
        setFeedback("Processing...");
        const photo = await cameraRef.current.takePhoto({
          flash: "off",
        });
        setCapturedImage(`file://${photo.path}`);
        setIsModalVisible(true);
      }
    } catch (e) {
      console.log("Selfie capture failed", e);
      setCapturedImage("placeholder");
      setIsModalVisible(true);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setIsModalVisible(false);
    setIsLivenessMet(false);
    timeInFrameRef.current = 0;
    setFeedback("Center your face");
  };

  const handleLooksGood = () => {
    setIsModalVisible(false);
    // TODO: navigate to the next step in the KYC flow
    navigation.navigate("VerifyIdentity");
  };

  if (!hasPermission || device == null) {
    return (
      <View style={styles.fullScreenBlack}>
        <Text style={styles.permissionText}>
          {device == null
            ? "No front camera found on this device."
            : "No camera permission. Please grant access."}
        </Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  const ovalBorderColor =
    feedback === "Hold still"
      ? Colors.secondary
      : "rgba(255,255,255,0.6)";

  return (
    <View style={styles.container}>
      {/* Camera / captured preview */}
      {capturedImage && capturedImage !== "placeholder" ? (
        <Image
          style={[styles.fullScreen, { transform: [{ scaleX: -1 }] }]}
          source={{ uri: capturedImage }}
          resizeMode="cover"
        />
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

      {/* Vignette with oval cutout */}
      {!capturedImage && (
        <View style={styles.vignetteOverlay} pointerEvents="none">
          <View style={[styles.vignetteBlock, { height: (height - OVAL_HEIGHT) / 2 - 20 }]} />
          <View style={styles.vignetteMiddle}>
            <View style={[styles.vignetteBlock, { width: (width - OVAL_WIDTH) / 2 }]} />
            <Animated.View
              style={[
                styles.ovalBorder,
                { borderColor: ovalBorderColor, transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={[styles.vignetteBlock, { width: (width - OVAL_WIDTH) / 2 }]} />
          </View>
          <View style={styles.vignetteBlock} />
        </View>
      )}

      {/* UI overlay */}
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        {!isModalVisible && (
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <MaterialIcons name="chevron-left" size={34} color={Colors.background} />
            </TouchableOpacity>
            <View style={styles.textContainer}>
              <Text style={styles.headerTitle}>A quick selfie</Text>
              <Text style={styles.subtitle}>
                Let's take a quick selfie for verification purposes. Your photo
                is secure.
              </Text>
            </View>
          </View>
        )}

        {/* Feedback pill */}
        <View style={styles.feedbackRow} pointerEvents="none">
          {!capturedImage && (
            <View style={styles.feedbackPill}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}
        </View>

        {/* Manual capture button */}
        {!isModalVisible && (
          <View style={[styles.footerContainer, { paddingBottom: insets.bottom || 24 }]}>
            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Confirmation modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {capturedImage && capturedImage !== "placeholder" && (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: capturedImage }}
                style={[styles.previewImage, { transform: [{ scaleX: -1 }] }]}
                resizeMode="cover"
              />
            </View>
          )}
          <View style={[styles.modalContent, { paddingBottom: insets.bottom || Spacing.lg }]}>
            <Text style={styles.modalTitle}>Does your selfie look clear?</Text>
            <Text style={styles.modalSubtitle}>
              Make sure your face is fully visible, well-lit, and in focus.
            </Text>
            <View style={styles.modalActions}>
              <Button
                title="Yes, looks good"
                onPress={handleLooksGood}
                backgroundColor={Colors.primary}
                textColor={Colors.background}
                borderRadius={10}
                paddingVertical={16}
                fontSize={Number(Typography.button.fontSize)}
              />
              <View style={{ height: Spacing.md }} />
              <Button
                title="Retake"
                onPress={handleRetake}
                backgroundColor={Colors.secondary}
                textColor={Colors.primary}
                borderRadius={10}
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
  container: { flex: 1, backgroundColor: "#000" },
  fullScreen: { ...StyleSheet.absoluteFillObject },
  fullScreenBlack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  permissionText: { color: "#fff", marginBottom: Spacing.md, textAlign: "center" },

  // Vignette
  vignetteOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  vignetteBlock: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  vignetteMiddle: { flexDirection: "row", height: OVAL_HEIGHT, alignItems: "center" },
  ovalBorder: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.6)",
  },

  // Overlay
  overlay: { flex: 1, justifyContent: "space-between" },
  headerContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  backButton: { width: 44, height: 44, justifyContent: "center", marginBottom: Spacing.md },
  textContainer: {
    marginBottom: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: Spacing.md,
    borderRadius: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: Spacing.sm },
  subtitle: { fontSize: 14, color: "#e5e7eb", lineHeight: 20 },
  feedbackRow: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    width: "100%",
    top: (height - OVAL_HEIGHT) / 2 + OVAL_HEIGHT - 60,
  },
  feedbackPill: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  feedbackText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  footerContainer: { alignItems: "center", paddingBottom: Spacing.xl * 1.5 },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  previewContainer: { alignItems: "center", marginBottom: -40, zIndex: 10 },
  previewImage: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: (width * 0.55) / 2,
    borderWidth: 4,
    borderColor: "#fff",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + 40,
  },
  modalTitle: { fontSize: 24, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.sm },
  modalSubtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 24 },
  modalActions: { marginBottom: Spacing.md },
});
