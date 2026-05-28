import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../../theme";
import Button from "../../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MerchantBusinessCategory">;
type RoutePropType = RouteProp<RootStackParamList, "MerchantBusinessCategory">;

const CATEGORIES = [
  { value: "RETAIL", label: "Retail" },
  { value: "FOOD_AND_BEVERAGE", label: "Food & Beverage" },
  { value: "SERVICES", label: "Services" },
  { value: "TECHNOLOGY", label: "Technology" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "EDUCATION", label: "Education" },
  { value: "ENTERTAINMENT", label: "Entertainment" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "AGRICULTURE", label: "Agriculture" },
  { value: "FINANCE", label: "Finance" },
  { value: "OTHER", label: "Other" },
];

export default function MerchantBusinessCategoryScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { businessName, businessHandle } = route.params;
  const { width } = useWindowDimensions();

  const [category, setCategory] = useState("RETAIL");
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
    navigation.navigate("MerchantBusinessContact", {
      businessName,
      businessHandle,
      category,
    });
  };

  const cardWidth = (width - Spacing.lg * 2 - 8) / 2;

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
              What type of business?
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Content */}
        <Animated.ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          <Text style={styles.title}>What type of business?</Text>
          <Text style={styles.subtitle}>Pick the category that best describes what you do.</Text>

          <View style={styles.gridContainer}>
            {CATEGORIES.map((item) => {
              const isSelected = category === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.categoryCard,
                    { width: cardWidth },
                    isSelected && styles.categoryCardSelected,
                  ]}
                  onPress={() => setCategory(item.value)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.categoryCardText,
                      isSelected && styles.categoryCardTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.buttonContainer}>
          <Button
            title="Continue"
            onPress={handleContinue}
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
    },
    scrollContentContainer: {
      paddingHorizontal: Spacing.lg,
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
    gridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: Spacing.xl,
    },
    categoryCard: {
      paddingVertical: 14,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      backgroundColor: isDark ? Colors.surface : "white",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 52,
    },
    categoryCardSelected: {
      borderColor: Colors.primary,
      backgroundColor: isDark ? Colors.white10 : "#FAFCF8",
    },
    categoryCardText: {
      fontSize: 14,
      color: Colors.textPrimary,
      textAlign: "center",
    },
    categoryCardTextSelected: {
      fontWeight: "600",
      color: Colors.primary,
    },
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
  });
}
