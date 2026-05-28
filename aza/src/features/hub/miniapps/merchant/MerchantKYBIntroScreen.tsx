import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../../theme";
import Button from "../../../../components/ui/Button";
import KYCProgressBar from "../../../../components/ui/KYCProgressBar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MerchantKYBIntro">;
type RoutePropType = RouteProp<RootStackParamList, "MerchantKYBIntro">;

const CHECKLIST_ITEMS = [
  "Business type and registration info",
  "Owner identity details",
  "Supporting documents",
];

export default function MerchantKYBIntroScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { merchantId } = route.params;

  const [consent, setConsent] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const handleContinue = () => {
    navigation.navigate("MerchantKYBBusiness", { merchantId });
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
                outputRange: ["transparent", Colors.border],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Animated.View style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Verify your business
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Content */}
        <Animated.ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContentContainer, { flexGrow: 1 }]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          <KYCProgressBar currentStep={1} totalSteps={4} label="Business Verification" />
          <Text style={styles.title}>Verify your business</Text>
          <Text style={styles.subtitle}>
            We need a few details to approve your merchant account.
          </Text>

          <View style={styles.checklistContainer}>
            {CHECKLIST_ITEMS.map((item, index) => (
              <View key={index} style={styles.checklistRow}>
                <MaterialIcons name="check-circle" size={20} color={Colors.primary} />
                <Text style={styles.checklistText}>{item}</Text>
              </View>
            ))}
          </View>
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setConsent(!consent)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
          >
            <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
              {consent && (
                <MaterialIcons name="check" size={14} color={Colors.secondary} />
              )}
            </View>
            <Text style={styles.consentText}>
              I consent to Aza verifying my business information and documents as required under
              applicable regulations.
            </Text>
          </TouchableOpacity>

          <View style={styles.securityNoteContainer}>
            <MaterialIcons name="lock-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.securityNoteText}>Your information is secured.</Text>
          </View>

          <Button
            title="Continue"
            onPress={handleContinue}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.sm}
            paddingVertical={16}
            fontSize={Typography.button.fontSize}
            fontWeight={Typography.button.fontWeight}
            disabled={!consent}
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
      backgroundColor: Colors.background,
    },
    container: {
      flex: 1,
    },
    header: {
      height: 56,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitleContainer: {
      flex: 1,
      alignItems: "center",
      marginRight: 44,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textPrimary,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 50,
      backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    scrollContentContainer: {
      paddingBottom: Spacing.xl,
    },
    title: {
      fontSize: 34,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    checklistContainer: {
      marginTop: Spacing.xl,
      gap: Spacing.md,
    },
    checklistRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    checklistText: {
      fontSize: Typography.bodyLg.fontSize,
      color: Colors.textPrimary,
      flex: 1,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: isDark ? Colors.border : "rgba(0,0,0,0.05)",
      paddingVertical: Spacing.lg,
    },
    consentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.md,
      marginBottom: Spacing.md,
      paddingHorizontal: 2,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? Colors.surface : Colors.white,
      marginTop: 1,
      flexShrink: 0,
    },
    checkboxChecked: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    consentText: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    securityNoteContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.lg,
      marginTop: Spacing.sm,
    },
    securityNoteText: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginLeft: Spacing.sm,
    },
  });
}
