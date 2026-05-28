import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../../theme";
import Button from "../../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/types";
import { registerMerchant } from "../../../../services/api";
import { BackButton } from '../../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MerchantBusinessContact">;
type RoutePropType = RouteProp<RootStackParamList, "MerchantBusinessContact">;

export default function MerchantBusinessContactScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const { businessName, businessHandle, category } = route.params;

  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleContinue = async () => {
    setLoading(true);
    try {
      const payload: any = {
        businessName,
        businessHandle,
        category,
      };
      if (businessEmail.trim()) payload.businessEmail = businessEmail.trim();
      if (businessPhone.trim()) payload.businessPhone = businessPhone.trim();
      if (description.trim()) payload.businessDescription = description.trim();

      const response = await registerMerchant(payload);
      const merchant = response.data.data ?? response.data;
      navigation.navigate("MerchantKYBIntro", { merchantId: merchant.id });
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? err?.message ?? "Something went wrong. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
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
            <BackButton onPress={() => navigation.goBack()} size={28} />
            <Animated.View style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Contact details
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
            <Text style={styles.title}>Contact details</Text>
            <Text style={styles.subtitle}>These are optional but help your customers reach you.</Text>

            <Text style={styles.label}>Business Email</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="mail-outline"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="business@example.com"
                placeholderTextColor={Colors.textSecondary}
                value={businessEmail}
                onChangeText={setBusinessEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            <Text style={styles.label}>Business Phone</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="phone"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="+233 XX XXX XXXX"
                placeholderTextColor={Colors.textSecondary}
                value={businessPhone}
                onChangeText={setBusinessPhone}
                keyboardType="phone-pad"
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            <Text style={styles.label}>Description</Text>
            <View style={styles.textAreaContainer}>
              <MaterialIcons
                name="notes"
                size={24}
                color={Colors.primary}
                style={styles.textAreaIcon}
              />
              <TextInput
                style={styles.textAreaInput}
                placeholder="Tell customers what you do..."
                placeholderTextColor={Colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
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
              loading={loading}
              disabled={loading}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
    label: {
      fontSize: Typography.bodyLg.fontSize,
      fontWeight: "600",
      color: Colors.textPrimary,
      marginBottom: Spacing.sm,
      marginTop: Spacing.xl,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      height: 52,
      backgroundColor: isDark ? Colors.surface : "white",
    },
    inputIcon: {
      marginRight: Spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: Typography.bodyLg.fontSize,
      color: Colors.textPrimary,
      height: "100%",
    },
    textAreaContainer: {
      flexDirection: "row",
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      minHeight: 100,
      backgroundColor: isDark ? Colors.surface : "white",
    },
    textAreaIcon: {
      marginRight: Spacing.sm,
      marginTop: 2,
    },
    textAreaInput: {
      flex: 1,
      fontSize: Typography.bodyLg.fontSize,
      color: Colors.textPrimary,
      minHeight: 80,
    },
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
  });
}
