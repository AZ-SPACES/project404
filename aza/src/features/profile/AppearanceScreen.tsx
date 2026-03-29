import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../theme";
import { useDisplayContext,BACKGROUND_IMAGES,ThemeOption,THEMES,LANGUAGES } from "../../providers/DisplayProvider";

type ThemeCardProps = {
  theme: ThemeOption;
  isSelected: boolean;
  onSelect: () => void;
};

const ThemeThumbnail = ({ theme }: { theme: ThemeOption }) => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  if (theme === "Light") {
    return (
      <View style={[styles.thumbnailBase, { backgroundColor: "#F3F4F6" }]}>
        <View style={styles.thumbnailLightContent}>
          <Text style={{ fontSize: 10, fontWeight: "bold", color: "#111827" }}>
            Aa
          </Text>
        </View>
      </View>
    );
  }
  if (theme === "Dark") {
    return (
      <View style={[styles.thumbnailBase, { backgroundColor: "#1F2937" }]}>
        <View style={styles.thumbnailDarkContent}>
          <Text style={{ fontSize: 10, fontWeight: "bold", color: "#FFFFFF" }}>
            Aa
          </Text>
        </View>
      </View>
    );
  }
  // System Default / Automatic
  return (
    <View
      style={[
        styles.thumbnailBase,
        { backgroundColor: "#F3F4F6", flexDirection: "row" },
      ]}
    >
      <View style={[styles.thumbnailSplitSide, { backgroundColor: "#FFFFFF" }]}>
        <Text
          style={{
            fontSize: 8,
            fontWeight: "bold",
            color: "#111827",
            marginLeft: 4,
            marginTop: 4 }}
        >
          Aa
        </Text>
      </View>
      <View style={[styles.thumbnailSplitSide, { backgroundColor: "#1F2937" }]}>
        <Text
          style={{
            fontSize: 8,
            fontWeight: "bold",
            color: "#FFFFFF",
            marginLeft: 4,
            marginTop: 4 }}
        >
          Aa
        </Text>
      </View>
    </View>
  );
};

const ThemeCard = ({ theme, isSelected, onSelect }: ThemeCardProps) => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const subtitles: Record<ThemeOption, string> = {
    Light: "Theme will always be in light mode",
    Dark: "Theme will always be in dark mode",
    "System Default": "Theme will follow the operating system theme" };

  const displayLabel = theme === "System Default" ? "Automatic" : theme;

  return (
    <TouchableOpacity
      style={[styles.themeCard, isSelected && styles.themeCardSelected]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <ThemeThumbnail theme={theme} />
      <View style={styles.themeCardTextContainer}>
        <Text style={[Typography.body, styles.themeCardTitle]}>
          {displayLabel}
        </Text>
        <Text style={[Typography.caption, styles.themeCardSubtitle]}>
          {subtitles[theme]}
        </Text>
      </View>
      <View
        style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}
      >
        {isSelected && (
          <Ionicons name="checkmark" size={12} color={Colors.white} />
        )}
      </View>
    </TouchableOpacity>
  );
};

export function AppearanceScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    theme: selectedTheme,
    setTheme,
    language: selectedLanguage,
    setLanguage,
    homeBackground,
    setHomeBackground } = useDisplayContext();

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      allowsEditing: false,
      quality: 1 });

    if (!result.canceled && result.assets && result.assets[0]) {
      setHomeBackground(result.assets[0].uri);
    }
  };

  const renderOptionRow = (
    label: string,
    isSelected: boolean,
    onSelect: () => void,
  ) => (
    <TouchableOpacity
      style={styles.optionRow}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <Text style={[Typography.body, styles.optionText]}>{label}</Text>
      {isSelected && <Feather name="check" size={20} color={Colors.primary} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={Colors.background === '#121212' ? 'light-content' : 'dark-content'} backgroundColor={Colors.white} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[Typography.h3, styles.headerTitle]}>Appearance</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Theme</Text>
          <View style={styles.appearanceContainer}>
            {THEMES.map((theme) => (
              <ThemeCard
                key={theme}
                theme={theme}
                isSelected={selectedTheme === theme}
                onSelect={() => setTheme(theme)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Language</Text>
          <View style={styles.sectionCard}>
            {LANGUAGES.map((lang, index) => (
              <View key={lang}>
                {renderOptionRow(lang, selectedLanguage === lang, () =>
                  setLanguage(lang),
                )}
                {index < LANGUAGES.length - 1 && (
                  <View style={styles.divider} />
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>
            Home Screen Background
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.backgroundsScrollContainer}
          >
            {/* Custom Image Picker Button */}
            <TouchableOpacity
              style={styles.bgUploadButton}
              onPress={handlePickImage}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={24} color={Colors.textSecondary} />
              <Text style={[Typography.caption, styles.uploadText]}>
                Upload
              </Text>
            </TouchableOpacity>

            {BACKGROUND_IMAGES.map((bg) => {
              const isSelected = homeBackground === bg.uri;
              return (
                <TouchableOpacity
                  key={bg.id}
                  style={[
                    styles.bgThumbnailContainer,
                    isSelected && styles.bgThumbnailSelected,
                  ]}
                  onPress={() => setHomeBackground(bg.uri)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: bg.uri }}
                    style={styles.bgThumbnailImage}
                  />
                  {isSelected && (
                    <View style={styles.bgCheckCircle}>
                      <Feather name="check" size={12} color={Colors.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
  const mainBg = isDark ? Colors.background : Colors.white;
  const contentBg = isDark ? Colors.surface : Colors.white;

  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: mainBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: mainBg },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? Colors.border : Colors.surface,
    justifyContent: "center",
    alignItems: "center" },
  headerTitle: {
    color: Colors.textPrimary },
  headerRightPlaceholder: {
    width: 40 },
  scrollContent: {
    paddingVertical: Spacing.lg },
  section: {
    marginBottom: Spacing.xl },
  sectionTitle: {
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5 },
  appearanceContainer: {
    backgroundColor: isDark ? Colors.surface : "#F9FAFB",
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border },
  themeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "transparent" },
  themeCardSelected: {
    backgroundColor: contentBg,
    borderColor: Colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1 },
  thumbnailBase: {
    width: 60,
    height: 50,
    borderRadius: Radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border },
  thumbnailLightContent: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 4,
    marginTop: 8,
    marginLeft: 8,
    padding: 4 },
  thumbnailDarkContent: {
    flex: 1,
    backgroundColor: "#111827",
    borderTopLeftRadius: 4,
    marginTop: 8,
    marginLeft: 8,
    padding: 4 },
  thumbnailSplitSide: {
    flex: 1 },
  themeCardTextContainer: {
    flex: 1,
    marginLeft: Spacing.md },
  themeCardTitle: {
    fontWeight: "600",
    color: Colors.textPrimary },
  themeCardSubtitle: {
    color: Colors.textSecondary,
    marginTop: 2 },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent" },
  checkCircleSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary },
  sectionCard: {
    backgroundColor: contentBg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: contentBg },
  optionText: {
    color: Colors.textPrimary },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg },
  backgroundsScrollContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs },
  bgThumbnailContainer: {
    width: 100,
    height: 160,
    borderRadius: Radius.sm,
    marginRight: Spacing.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative" },
  bgThumbnailSelected: {
    borderColor: Colors.primary },
  bgThumbnailImage: {
    flex: 1 },
  bgCheckCircle: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center" },
  bgUploadButton: {
    width: 100,
    height: 160,
    borderRadius: Radius.sm,
    marginRight: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center" },
  uploadText: {
    color: Colors.textSecondary,
    marginTop: Spacing.xs } });
}
