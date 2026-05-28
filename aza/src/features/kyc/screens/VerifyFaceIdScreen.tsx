import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  ScrollView,
  StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { RootStackParamList } from "../../../navigation/types";
import { RouteProp, useRoute } from "@react-navigation/native";
import { usePreventScreenCapture } from "../../../hooks/usePreventScreenCapture";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import KYCProgressBar from "../../../components/ui/KYCProgressBar";
import { BackButton } from '../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyFaceId'>;
type VerifyFaceIdRouteProp = RouteProp<RootStackParamList, "VerifyFaceId">;

export default function VerifyFaceIdScreen() {
  usePreventScreenCapture();
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerifyFaceIdRouteProp>();
  const { isPEP } = route.params || {};
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const handleNext = () => {
    navigation.navigate("ScanId", { isPEP: !!isPEP });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <View style={styles.container}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              borderBottomColor: headerBorderOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: ["transparent", Colors.border] }) },
          ]}
        >
          <BackButton onPress={() => navigation.goBack()} size={28} />
          <Animated.View
            style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
          >
            <Text style={styles.headerTitle} numberOfLines={1}>
              Instruction for Verification
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Content */}
        <Animated.ScrollView
          style={styles.content}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        >
          <KYCProgressBar currentStep={4} totalSteps={6} label="Prepare ID Scan" />
          <Text style={styles.title}>
            Verify your identity with your face and identity card.
          </Text>
          <Text style={styles.subtitle}>
            We'll take a quick photo of you and your ID card to require your identity.
          </Text>

          {/* Centered Image */}
          <View style={styles.imageContainer}>
            <Image
              source={require("../../../assets/id&cam.png")}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Take photo"
            onPress={handleNext}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.sm}
            paddingVertical={16}
            fontSize={Typography.button.fontSize}
            fontWeight={Typography.button.fontWeight}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  container: {
    flex: 1 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    marginRight: 44 },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center" },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5 },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24 },
  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center" },
  image: {
    width: "100%",
    height: "100%" },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg } });
}


