import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import {  useAppTheme, ThemeColors, Typography, Spacing  } from "../../../theme";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { BackButton } from '../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "TwoStepVerificationIssue">;

export default function TwoStepVerificationIssueScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
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
        <BackButton onPress={() => navigation.goBack()} size={28} />
        <Animated.View
          style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            2-step verification isn't working
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>2-step verification isn't working</Text>

        <Text style={styles.paragraph}>
          If you're not getting the Aza app notification or text message for
          2-step verification, check that:
        </Text>

        <View style={styles.bulletContainer}>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletIndicator}>•</Text>
            <Text style={styles.bulletText}>WiFi/mobile data is turned on</Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletIndicator}>•</Text>
            <Text style={styles.bulletText}>
              You're checking your registered phone number for the text message,
              or a trusted device for the Aza app notification
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletIndicator}>•</Text>
            <Text style={styles.bulletText}>
              You have notifications from Aza enabled
            </Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          If it's still not working, click{" "}
          <Text style={styles.bold}>I'm not receiving approval requests</Text>{" "}
          or <Text style={styles.bold}>Try another way</Text>, and choose one of
          the other available methods.
        </Text>

        <Text style={styles.paragraph}>
          If none of this works, you can recover your account through confirming
          your identity. To do that, click{" "}
          <Text style={styles.bold}>I don't have any of these</Text> in the
          2-step verification page, and:
        </Text>

        <View style={styles.listContainer}>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>1.</Text>
            <Text style={styles.listItemText}>
              Click <Text style={styles.bold}>Continue</Text> to confirm it's
              you with a selfie
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>2.</Text>
            <Text style={styles.listItemText}>
              Select to check automatically, and continue to the selfie step
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>3.</Text>
            <Text style={styles.listItemText}>
              Follow instructions on the screen until the selfie is approved
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>4.</Text>
            <Text style={styles.listItemText}>
              Choose if you want to keep the same number or change
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.helpButton} onPress={() => navigation.navigate('TalkToUs')}>
          <Text style={styles.helpText}>I still need help</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
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
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.h1.fontSize,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    letterSpacing: -0.5,
  },
  paragraph: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  bold: {
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  bulletContainer: {
    marginBottom: Spacing.lg,
    paddingLeft: Spacing.xs,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    alignItems: "flex-start",
  },
  bulletIndicator: {
    fontSize: 16,
    color: Colors.textSecondary,
    width: 20,
    textAlign: "left",
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  listContainer: {
    marginBottom: Spacing.xl,
    paddingLeft: Spacing.xs,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    alignItems: "flex-start",
  },
  listNumber: {
    fontSize: 16,
    color: Colors.textSecondary,
    width: 28,
    fontWeight: "500",
    marginTop: 2,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  helpButton: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },
  helpText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
}


