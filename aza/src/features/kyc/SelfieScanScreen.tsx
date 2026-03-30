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
  StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAppTheme, ThemeColors, Typography, Spacing } from "../../theme";
import Button from "../../components/ui/Button";
import KYCProgressBar from "../../components/ui/KYCProgressBar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { CameraView, useCameraPermissions } from "expo-camera";
import { RouteProp, useRoute } from "@react-navigation/native";
import { usePreventScreenCapture } from "../../hooks/usePreventScreenCapture";
import { useToast } from '../../providers/ToastProvider';
import { useKYC } from '../../providers/KYCProvider';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "SelfieScan"
>;
type SelfieScanRouteProp = RouteProp<RootStackParamList, "SelfieScan">;

const { width, height } = Dimensions.get("window");
// Oval frame: portrait-oriented, roughly face-shaped
const OVAL_WIDTH = width * 0.7;
const OVAL_HEIGHT = OVAL_WIDTH * 1.3;

type FeedbackState =
  | "Center your face"
  | "Move closer"
  | "Hold still"
  | "Processing...";

export default function SelfieScanScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const { showToast } = useToast();
  const { update, submit, isSubmitting } = useKYC();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SelfieScanRouteProp>();
  const { isPEP } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>("Center your face");

  const cameraRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  // Pulse animation on the oval border while scanning
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Oval pulse while scanning
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true }),
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true }),
      ]),
    );
    if (!capturedImage && permission?.granted) {
      loop.start();
    }
    return () => loop.stop();
  }, [capturedImage, permission?.granted]);

  // Simulated liveness progression (Expo Go mock)
  useEffect(() => {
    if (capturedImage || !permission?.granted) return;

    setFeedback("Center your face");
    const t1 = setTimeout(() => setFeedback("Move closer"), 1500);
    const t2 = setTimeout(() => setFeedback("Hold still"), 3000);
    const tCapture = setTimeout(() => handleCapture(), 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tCapture);
    };
  }, [capturedImage, permission?.granted]);

  const handleCapture = async () => {
    try {
      if (cameraRef.current) {
        setFeedback("Processing...");
        const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
        if (photo) {
          setCapturedImage(photo.uri);
          setIsModalVisible(true);
        }
      }
    } catch (e) {
      showToast('Selfie capture failed. Please try again.', 'error');
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setIsModalVisible(false);
  };

  const handleLooksGood = async () => {
    setIsModalVisible(false);
    // Pass selfieImageUri directly to submit() so it doesn't rely on React
    // state having flushed — update() is async and the KYC closure would
    // otherwise still see selfieImageUri: null, triggering a false error.
    const selfieUri = capturedImage && capturedImage !== 'placeholder' ? capturedImage : undefined;
    if (selfieUri) {
      update({ selfieImageUri: selfieUri });
    }
    try {
      await submit(selfieUri ? { selfieImageUri: selfieUri } : undefined);
      if (isPEP) {
        navigation.navigate('PEPUnderReview');
      } else {
        navigation.navigate('KYCSuccess');
      }
    } catch {
      showToast('Submission failed. Please try again.', 'error');
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  const ovalBorderColor =
    feedback === "Hold still"
      ? Colors.secondary // green-ish when face is locked
      : "rgba(255,255,255,0.6)";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" />
      {/* Camera / Captured preview */}
      {capturedImage && capturedImage !== "placeholder" ? (
        <Image
          style={[styles.fullScreen, { transform: [{ scaleX: -1 }] }]}
          source={{ uri: capturedImage }}
          resizeMode="cover"
        />
      ) : permission.granted ? (
        <CameraView style={styles.fullScreen} facing="front" ref={cameraRef} />
      ) : (
        <View style={styles.fullScreenBlack}>
          <Text style={styles.permissionText}>
            No camera permission. Please grant access.
          </Text>
          <Button title="Grant Permission" onPress={requestPermission} />
        </View>
      )}

      {/* Dark vignette overlay — punches out the oval */}
      {!capturedImage && permission.granted && (
        <View style={styles.vignetteOverlay} pointerEvents="none">
          {/* Top block */}
          <View
            style={[
              styles.vignetteBlock,
              { height: (height - OVAL_HEIGHT) / 2 - 20 },
            ]}
          />
          {/* Middle row: left + oval gap + right */}
          <View style={styles.vignetteMiddle}>
            <View
              style={[styles.vignetteBlock, { width: width - OVAL_WIDTH }]}
            />
            {/* Oval border drawn around the transparent gap */}
            <Animated.View
              style={[
                styles.ovalBorder,
                {
                  borderColor: ovalBorderColor,
                  transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View
              style={[
                styles.vignetteBlock,
                { width: (width - OVAL_WIDTH) / 2 },
              ]}
            />
          </View>
          {/* Bottom block */}
          <View style={styles.vignetteBlock} />
        </View>
      )}

      {/* UI overlay */}
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        {/* Header — hidden while modal showing */}
        {!isModalVisible && (
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <MaterialIcons
                name="chevron-left"
                size={34}
                color={Colors.background}
              />
            </TouchableOpacity>
            <View style={styles.textContainer}>
              <KYCProgressBar
                currentStep={6}
                totalSteps={6}
                label="Liveness Check"
              />
              <Text style={styles.headerTitle}>A quick selfie</Text>
              <Text style={styles.subtitle}>
                Let's take a quick selfie for verification purposes. Your photo
                is secure.
              </Text>
            </View>
          </View>
        )}

        {/* Feedback pill (centred over the oval) */}
        <View style={styles.feedbackRow} pointerEvents="none">
          {!capturedImage && (
            <View style={styles.feedbackPill}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}
        </View>

        {/* Capture button */}
        {!isModalVisible && (
          <View
            style={[
              styles.footerContainer,
              { paddingBottom: insets.bottom || 24 },
            ]}
          >
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Confirmation modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {/* Preview thumbnail */}
          {capturedImage && capturedImage !== "placeholder" && (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: capturedImage }}
                style={[styles.previewImage, { transform: [{ scaleX: -1 }] }]}
                resizeMode="cover"
              />
            </View>
          )}

          <View
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom || Spacing.lg },
            ]}
          >
            <Text style={styles.modalTitle}>Does your selfie look clear?</Text>
            <Text style={styles.modalSubtitle}>
              Make sure your face is fully visible, well-lit, and in focus.
            </Text>

            <View style={styles.modalActions}>
              <Button
                title="Yes, looks good"
                onPress={handleLooksGood}
                backgroundColor={Colors.primary}
                textColor={Colors.secondary}
                borderRadius={10}
                paddingVertical={16}
                fontSize={Typography.button.fontSize}
              />
              <View style={{ height: Spacing.md }} />
              <Button
                title="Retake"
                onPress={handleRetake}
                backgroundColor={Colors.secondary} 
                textColor={Colors.primary}
                borderRadius={10}
                paddingVertical={16}
                fontSize={Typography.button.fontSize}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000" },
  fullScreen: {
    ...StyleSheet.absoluteFill },
  fullScreenBlack: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg },
  permissionText: {
    color: "#fff",
    marginBottom: Spacing.md,
    textAlign: "center" },

  // Vignette
  vignetteOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent" },
  vignetteBlock: {
    flex: 1 },
  vignetteMiddle: {
    flexDirection: "row",
    height: OVAL_HEIGHT,
    alignItems: "center" },
  ovalBorder: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.6)" },

  // Overlay / layout
  overlay: {
    flex: 1,
    justifyContent: "space-between" },
  headerContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    marginBottom: Spacing.md },
  textContainer: {
    marginBottom: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: Spacing.md,
    borderRadius: 12 },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: Spacing.sm },
  subtitle: {
    fontSize: 14,
    color: "#e5e7eb",
    lineHeight: 20 },
  feedbackRow: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: (height - OVAL_HEIGHT) / 2 + OVAL_HEIGHT - 60,
    position: "absolute",
    width: "100%",
    top: 0 },
  feedbackPill: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20 },
  feedbackText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" },
  footerContainer: {
    alignItems: "center",
    paddingBottom: Spacing.xl * 1.5 },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center" },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff" },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)" },
  previewContainer: {
    alignItems: "center",
    marginBottom: -40,
    zIndex: 10 },
  previewImage: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: (width * 0.55) / 2,
    borderWidth: 4,
    borderColor: "#fff" },
  modalContent: {
    backgroundColor: isDark ? Colors.surface : "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + 40 },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm },
  modalSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 24 },
  modalActions: {
    marginBottom: Spacing.md } });
}


