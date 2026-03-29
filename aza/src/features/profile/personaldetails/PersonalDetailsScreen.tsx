import React, { ComponentProps } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "PersonalDetails"
>;

interface DetailItemProps {
  iconName: ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}



export function PersonalDetailsScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();

  const DetailItem = ({
    iconName,
    title,
    subtitle,
    onPress }: DetailItemProps) => (
    <TouchableOpacity
      style={styles.detailItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Feather name={iconName} size={22} color={Colors.textPrimary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[Typography.body, styles.itemTitle]}>{title}</Text>
        <Text style={[Typography.caption, styles.itemSubtitle]}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <Animated.View
        style={[
          styles.header,
          {
            borderBottomColor: headerBorderOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", Colors.border] }) },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Animated.View
          style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
        >
          <Text style={[Typography.h3, styles.headerTitle]}>
            Personal details
          </Text>
        </Animated.View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>
            Personal details
          </Text>
        </View>

        <DetailItem
          iconName="user"
          title="Personal information"
          subtitle="Manage your personal information"
          onPress={() => navigation.navigate("PersonalInformation")}
        />
        <DetailItem
          iconName="mail"
          title="Email address"
          subtitle="user@email.com (Verified)" // TODO: load from user profile
          onPress={() => navigation.navigate("ChangeEmail")}
        />
        <DetailItem
          iconName="smartphone"
          title="Mobile number"
          subtitle="+000000000000" // TODO: load from user profile
          onPress={() => navigation.navigate("ChangePhone")}
        />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    height: 60 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1 },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center" },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: "700" },
  scrollContent: {
    paddingBottom: Spacing.xl },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md },
  textContainer: {
    flex: 1,
    justifyContent: "center" },
  itemTitle: {
    fontWeight: "600",
    color: Colors.textPrimary,
    fontSize: 18,
    marginBottom: 2 },
  itemSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14 } });
}


