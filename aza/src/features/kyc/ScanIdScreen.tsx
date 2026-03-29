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

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "ScanId">;
type ScanIdRouteProp = RouteProp<RootStackParamList, "ScanId">;

const { width, height } = Dimensions.get("window");
const FRAME_WIDTH = width * 0.85;
const FRAME_HEIGHT = FRAME_WIDTH * 0.63;

const ZOOM_SCALE = 1 / 0.85;

export default function ScanIdScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScanIdRouteProp>();
  const { isPEP } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [feedback, setFeedback] = useState("Move Closer");

  const cameraRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Camera permissions
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Scanning Animation
  useEffect(() => {
    if (!capturedImage && permission?.granted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true }),
        ]),
      ).start();
    } else {
      scanLineAnim.stopAnimation();
    }
  }, [capturedImage, permission?.granted]);

  // Simulated Liveness and Edge Detection logic for Expo Go
  useEffect(() => {
    let timeout1: NodeJS.Timeout;
    let timeout2: NodeJS.Timeout;
    let autoCaptureTimeout: NodeJS.Timeout;

    if (!capturedImage && permission?.granted) {
      // Mock progression of detecting an ID
      setFeedback("Move Closer");
      timeout1 = setTimeout(() => setFeedback("Align ID"), 1500);
      timeout2 = setTimeout(() => setFeedback("Hold Still"), 3000);

      // Auto-capture after 1.5s liveness timer (total 4.5s)
      autoCaptureTimeout = setTimeout(() => {
        handleCapture();
      }, 4500);
    }

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(autoCaptureTimeout);
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
      console.log("Camera capture failed", e);
      setCapturedImage("placeholder");
      setIsModalVisible(true);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setIsModalVisible(false);
  };

  const handleLooksGood = () => {
    setIsModalVisible(false);
    navigation.navigate("ScanIdBack", { isPEP: !!isPEP });
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  // Interpolate scanning line position
  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_HEIGHT - 4] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" />
      {capturedImage && capturedImage !== "placeholder" ? (
        <Image
          style={styles.fullScreen}
          source={{ uri: capturedImage }}
          resizeMode="cover"
        />
      ) : permission.granted ? (
        <CameraView style={styles.fullScreen} facing="back" ref={cameraRef} />
      ) : (
        <View style={styles.fullScreenBlack}>
          <Text style={styles.permissionText}>
            No camera permission. Please grant access.
          </Text>
          <Button title="Grant Permission" onPress={requestPermission} />
        </View>
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
              <KYCProgressBar
                currentStep={5}
                totalSteps={6}
                label="Front of ID"
              />
              <Text style={styles.headerTitle}>Front of your ID</Text>
              <Text style={styles.subtitle}>
                Hold up your ID and take a picture. Your entire ID must be in
                the frame.
              </Text>
            </View>
          </View>
        )}

        {/* Frame Cutout */}
        <View style={styles.frameContainer}>
          {!capturedImage && (
            <View style={styles.frame}>
              {/* Corner Indicators */}
              <View
                style={[
                  styles.corner,
                  styles.topLeft,
                  feedback === "Hold Still" && styles.cornerActive,
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.topRight,
                  feedback === "Hold Still" && styles.cornerActive,
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.bottomLeft,
                  feedback === "Hold Still" && styles.cornerActive,
                ]}
              />
              <View
                style={[
                  styles.corner,
                  styles.bottomRight,
                  feedback === "Hold Still" && styles.cornerActive,
                ]}
              />

              {/* Live Feedback Overlay */}
              <View style={styles.feedbackContainer}>
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>

              {/* Scanning Animation Line */}
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY }] }]}
              />
            </View>
          )}
        </View>

        {/* Manual Capture Fallback */}
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

      {/* Confirmation Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {/* Preview thumbnail */}
          {capturedImage && capturedImage !== "placeholder" && (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: capturedImage }}
                style={styles.previewImage}
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
            <Text style={styles.modalTitle}>Is your ID easy to read?</Text>
            <Text style={styles.modalSubtitle}>
              Please make sure the text is clear and your entire card is
              visible.
            </Text>

            <View style={styles.modalActions}>
              <Button
                title="Yes, looks good"
                onPress={handleLooksGood}
                backgroundColor={Colors.primary}
                textColor={Colors.secondary}
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

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
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
  frameContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    top: 10 },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    position: "relative",
    overflow: "hidden",
    marginBottom: 200 },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#ffffff",
    borderWidth: 0,
    opacity: 0.8 },
  cornerActive: {
    borderColor: Colors.secondary },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16 },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16 },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16 },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16 },
  scanLine: {
    position: "absolute",
    width: "100%",
    height: 4,
    backgroundColor: Colors.secondary,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5 },
  feedbackContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10 },
  feedbackText: {
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 18,
    fontWeight: "600",
    overflow: "hidden" },
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)" },
  previewContainer: {
    alignSelf: "center",
    width: width * 0.7,
    height: width * 0.7 * 0.63,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: "#fff",
    overflow: "hidden",
    marginBottom: -40,
    zIndex: 10,
    backgroundColor: "#000" },
  previewImage: {
    width: "100%",
    height: "100%",
    transform: [{ scale: ZOOM_SCALE }] },
  modalContent: {
    backgroundColor: isDark ? Colors.surface : "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
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


