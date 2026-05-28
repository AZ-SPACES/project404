import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useKYC } from "../../../providers/KYCProvider";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "KYCSuccess">;

interface ReviewCheckItemProps {
  label: string;
  status: 'completed' | 'reviewing';
  delay?: number;
}

function ReviewCheckItem({ label, status, delay = 0 }: ReviewCheckItemProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 400,
      delay,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad) }).start();

    if (status === 'reviewing') {
      // Pulsing for active/reviewing state
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad) }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad) }),
        ])
      ).start();
    }
  }, [status, delay]);

  const scaleValue = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1] });

  const finalScale = status === 'reviewing' 
    ? Animated.multiply(scaleValue, pulseValue)
    : scaleValue;

  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return (
    <View
      style={styles.checkItem}
      accessible={true}
      accessibilityLabel={`${label}: ${status === 'completed' ? 'Completed' : 'In review'}`}
    >
      <View style={styles.checkIconTextRow}>
        <Animated.View style={[
          styles.iconBox,
          {
            opacity: animatedValue,
            transform: [{ scale: finalScale }] }
        ]}>
          <MaterialIcons 
            name={status === 'completed' ? "check" : "remove"} 
            size={16} 
            color={Colors.primary} 
          />
        </Animated.View>
        <Text style={styles.checkText}>{label}</Text>
      </View>
      <Text style={status === 'completed' ? styles.statusCompleted : styles.statusReviewing}>
        {status === 'completed' ? "Completed" : "in review"}
      </Text>
    </View>
  );
}

export default function KYCSuccessScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data: kycData } = useKYC();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isVerified = kycData.status === 'VERIFIED';
  const isReviewing = kycData.status === 'UNDER_REVIEW';
  const isRejected = kycData.status === 'REJECTED';

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 200,
      useNativeDriver: true }).start();
  }, []);

  const handleFinish = () => {
    navigation.navigate("CreatingAccount");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <Animated.View style={[styles.iconContainer, { opacity: fadeAnim }]}>
          <MaterialIcons name="check-circle" size={64} color={Colors.primary} />
        </Animated.View>

        <Text style={styles.title}>
          {isVerified ? "Verification Successful" : isRejected ? "Verification Failed" : "Verification Complete"}
        </Text>
        <Text style={styles.subtitle}>
          {isVerified 
            ? "Your identity has been verified. You can now access all features."
            : isRejected 
            ? `Your verification was not successful: ${kycData.rejectionReason || "Please contact support."}`
            : "We’re reviewing it now. You’ll receive a\nnotification and an email as soon as it is verified"}
        </Text>

        <View style={styles.checksContainer}>
          <Text style={styles.checksTitle}>Review checks</Text>

          <ReviewCheckItem 
            label="Create your account" 
            status="completed" 
            delay={400}
          />
          
          <ReviewCheckItem 
            label="Secure your account" 
            status="completed" 
            delay={600}
          />
          
          <ReviewCheckItem 
            label="Verify your identity" 
            status={isVerified ? "completed" : "reviewing"} 
            delay={800}
          />
        </View>

      </View>

      <View style={styles.footerLine} />
      <View style={styles.buttonContainer}>
        <Button
          title="Continue"
          onPress={handleFinish}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          borderRadius={Radius.sm}
          paddingVertical={16}
          fontSize={Typography.button.fontSize}
          fontWeight={Typography.button.fontWeight}
        />
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
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl * 2 },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
    lineHeight: 38 },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22 },
  checksContainer: {
    marginTop: Spacing.xl * 1.5 },
  checksTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.lg + Spacing.sm },
  checkItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg + 4 },
  checkIconTextRow: {
    flexDirection: "row",
    alignItems: "center" },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md },
  checkText: {
    fontSize: 16,
    color: Colors.textSecondary },
  statusCompleted: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary },
  statusReviewing: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary },
  footerLine: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md },
  buttonContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg } });
}


