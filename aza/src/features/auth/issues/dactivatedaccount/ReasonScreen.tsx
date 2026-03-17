import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Colors, Typography, Spacing } from "../../../../theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Button from "../../../../components/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/AppNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Reason'>;
export default function Reason() {
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
            Why was my account deactivated?
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
        <Text style={styles.title}>Why was my account deactivated?</Text>

        <Text style={styles.paragraph}>
          Deactivation of an account can occur due to various reasons, such as
          security concerns, detection of multiple accounts used by the same
          person, transactions on your account that we cannot complete, among
          others.
        </Text>

        <Text style={styles.paragraph}>
          If we've deactivated your account, you can make an appeal.
        </Text>

        <Text style={[styles.paragraph,styles.bold]}>
          How to start the appeal process:
        </Text>

        <Text style={styles.paragraph}>
          Even if we deactivated your account, you will still need to use your login details to access the appeals flow.
        </Text>

        <Text style={styles.paragraph}>
          You click the button below. When you try to log in, you will see a message stating "Sorry, we deactivated your account."
        </Text>

        <Text style={styles.paragraph}>
          Click on "Appeal our decision" so this link can guide you through the appeal process.
        </Text>

        <Text style={styles.paragraph}>
          After you've appealed, we'll review your appeal thoroughly and contact you about your account.
        </Text>

        <Text style={styles.paragraph}>
          Once you've submitted your appeal, our team will be in touch. It could take up to 30 days for the team to reevaluate the decision. This is the
          only way to have your account reevaluated.
        </Text>

        <Text style={[styles.paragraph,styles.bold]}>
          Bear in mind Customer Support doesn't have the ability to provide updates or speed up this process for you.
        </Text>

        <View style={styles.buttonContainer}>
          <Button
          title="Submit an appeal"
          onPress={() => console.log("awaitng")}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          borderRadius={30}
          paddingVertical={16}
          fontSize={Number(Typography.button.fontSize)}
          fontWeight={Typography.button.fontWeight as any} 
          />
        </View>

        <TouchableOpacity style={styles.helpButton} onPressOut={() => navigation.navigate('TalkToUs')}>
          <Text style={styles.helpText}>I still need help</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
    borderRadius: 50,
    backgroundColor: "rgba(22,51,0,0.04)",
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
  buttonContainer: {
    marginBottom: Spacing.lg,
  },
  helpButton: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  helpText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
