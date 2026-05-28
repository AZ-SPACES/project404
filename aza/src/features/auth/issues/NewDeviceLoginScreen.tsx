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
import {  useAppTheme, ThemeColors, Typography, Spacing  } from "../../../theme";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "NewDeviceLogin">

export default function NewDeviceLogin() {
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons
            name="chevron-left"
            size={28}
            color={Colors.textPrimary}
          />
        </TouchableOpacity>
        <Animated.View
          style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            Logging in with a new device
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
        <Text style={styles.title}>Logging in with a new device</Text>

        <Text style={styles.paragraph}>
          If you have a new device, but still have access to the same number,
          please follow these steps to change your registered device:
        </Text>

        <View style={styles.bulletContainer}>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletIndicator}>1.</Text>
            <Text style={styles.bulletText}>
              When you're logging in and see the message "We've sent an approval
              request to your registered device", select I'm not receiving the
              approval request. This will take about 5 seconds to appear
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletIndicator}>2</Text>
            <Text style={styles.bulletText}>
              Choose SMS or voice call and we'll send you a code to log in with
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletIndicator}>3</Text>
            <Text style={styles.bulletText}>
              Once you've logged in, you'll be able to change the device your
              push notifications are sent to
            </Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          You should then turn 2-step verification off and on again:
        </Text>

        <View style={styles.listContainer}>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>1.</Text>
            <Text style={styles.listItemText}>Select your name</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>2.</Text>
            <Text style={styles.listItemText}>
              Select <Text style={styles.bold}>Settings</Text>
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>3.</Text>
            <Text style={styles.listItemText}>
              Select <Text style={styles.bold}>2-step verification </Text> and{" "}
              <Text style={styles.bold}>Select Remove this method</Text>
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listNumber}>4.</Text>
            <Text style={styles.listItemText}>
              On the 2-step verification page,{" "}
              <Text style={styles.bold}>select Aza app again </Text>
            </Text>
          </View>
        </View>
        <Text style={styles.paragraph}>
          You will now be able to log in with your new device.
        </Text>
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


