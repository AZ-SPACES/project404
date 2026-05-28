import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, Typography, Spacing, Radius, ThemeColors } from "../../../theme";
import Button from "../../../components/ui/Button";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "HelpAndSupport"
>;

interface HelpTopicProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress?: () => void;
  colors: ThemeColors;
  styles: any;
}

const HelpTopic = ({ icon, title, description, onPress, colors, styles }: HelpTopicProps) => (
  <TouchableOpacity
    style={styles.topicItem}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.iconCircle}>{icon}</View>
    <View style={styles.topicTextContainer}>
      <Text style={[Typography.body, styles.topicTitle]}>{title}</Text>
      <Text style={[Typography.caption, styles.topicDescription]}>
        {description}
      </Text>
    </View>
    <Feather name="chevron-right" size={20} color={colors.textSecondary} />
  </TouchableOpacity>
);

export default function HelpAndSupportScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NavigationProp>();
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const helpTopics = [
    {
      id: "sending",
      title: "Sending money",
      description: "Setting up, paying for, editing, and cancelling transfers.",
      icon: <Feather name="arrow-up" size={20} color={Colors.textPrimary} /> },
    {
      id: "account",
      title: "Managing your account",
      description: "Setting up your account and getting verified.",
      icon: (
        <Ionicons name="person-outline" size={20} color={Colors.textPrimary} />
      ) },
    {
      id: "holding",
      title: "Holding money",
      description:
        "Holding balances, setting up Direct Debits, and using Interest & Stocks.",
      icon: (
        <Ionicons name="folder-outline" size={20} color={Colors.textPrimary} />
      ) },
    {
      id: "receiving",
      title: "Receiving money",
      description: "Using your account details to receive money.",
      icon: <Feather name="arrow-down" size={20} color={Colors.textPrimary} /> },
    {
      id: "business",
      title: "Aza Business",
      description: "Business accounts, team cards, bulk payments, and more.",
      icon: (
        <Ionicons
          name="briefcase-outline"
          size={20}
          color={Colors.textPrimary}
        />
      ) },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
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
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Animated.View
          style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
        >
          <Text style={[Typography.h3, styles.headerTitle]} numberOfLines={1}>
            Hi, how can we help?
          </Text>
        </Animated.View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        <Text style={styles.largeTitle}>Hi, how can we help?</Text>
        <View style={styles.sectionHeader}>
          <Text style={[Typography.body, styles.sectionTitle]}>
            Explore all topics
          </Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.topicsList}>
          {helpTopics.map((topic) => (
            <HelpTopic
              key={topic.id}
              icon={topic.icon}
              title={topic.title}
              description={topic.description}
              onPress={() =>
                navigation.navigate("HelpTopic", {
                  topicId: topic.id,
                  title: topic.title,
                })
              }
              colors={Colors}
              styles={styles}
            />
          ))}
        </View>
      </Animated.ScrollView>

      <View style={styles.footer}>
        <Button
            title="Contact us"
            onPress={() => {
              navigation.navigate("TalkToUs");
            }}
            backgroundColor="#1E5128"
            textColor="#B7ED7E"
            borderRadius={24}
          />
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  scrollView: {
    flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl },
  largeTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    letterSpacing: -0.5 },
  sectionHeader: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg },
  sectionTitle: {
    color: Colors.textPrimary,
    fontWeight: "500",
    marginBottom: Spacing.sm },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    width: "100%" },
  topicsList: {
    marginTop: Spacing.md },
  topicItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md },
  topicTextContainer: {
    flex: 1 },
  topicTitle: {
    color: Colors.textPrimary,
    fontWeight: "600",
    marginBottom: 4 },
  topicDescription: {
    color: Colors.textSecondary,
    lineHeight: 18 },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background },
  contactButton: {
    backgroundColor: Colors.secondary,
    height: 56,
    borderRadius: Radius.full,
    justifyContent: "center",
    alignItems: "center" },
  contactButtonText: {
    color: Colors.textPrimary,
    fontWeight: "600" } });
}
