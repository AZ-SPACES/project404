import React, { useState, useRef, useEffect, useCallback } from "react";
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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../../theme";
import Button from "../../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../../navigation/types";
import { checkMerchantHandleAvailability } from "../../../../services/api";
import { debounce } from "lodash";
import { BackButton } from '../../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MerchantBusinessName">;

export default function MerchantBusinessNameScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();

  const [businessName, setBusinessName] = useState("");
  const [businessHandle, setBusinessHandle] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);

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

  const validateHandle = useCallback(
    debounce(async (handle: string) => {
      if (handle.length < 3) {
        setIsAvailable(null);
        setIsValidating(false);
        return;
      }
      try {
        const response = await checkMerchantHandleAvailability(handle);
        const available = response.data.data;
        setIsAvailable(available);
        setHandleError(available ? null : "This handle is already taken");
      } catch (err) {
        console.error("Error checking handle:", err);
      } finally {
        setIsValidating(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    if (businessHandle.length >= 3) {
      setIsValidating(true);
      validateHandle(businessHandle);
    } else {
      setIsAvailable(null);
      setHandleError(null);
    }
  }, [businessHandle]);

  const onHandleChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setBusinessHandle(cleaned);
  };

  const isFormValid =
    businessName.trim().length >= 2 &&
    businessHandle.length >= 3 &&
    isAvailable === true &&
    !isValidating;

  const handleContinue = () => {
    navigation.navigate("MerchantBusinessCategory", {
      businessName: businessName.trim(),
      businessHandle,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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
                Name your business
              </Text>
            </Animated.View>
          </Animated.View>

          {/* Content */}
          <Animated.ScrollView keyboardShouldPersistTaps="handled"
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          >
            <Text style={styles.title}>Name your business</Text>
            <Text style={styles.subtitle}>This is the name your customers will see.</Text>

            <Text style={styles.label}>Business Name</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="business"
                size={24}
                color={Colors.primary}
                style={styles.inputIcon}
              />
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                placeholder="e.g. Acme Stores"
                placeholderTextColor={Colors.textSecondary}
                value={businessName}
                onChangeText={setBusinessName}
                autoCapitalize="words"
                autoFocus
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
            </View>

            <Text style={styles.label}>Business Handle</Text>
            <View
              style={[
                styles.inputContainer,
                isAvailable === true && styles.inputSuccess,
                isAvailable === false && styles.inputError,
              ]}
            >
              <Text style={styles.atSymbol}>@</Text>
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                placeholder="yourhandle"
                placeholderTextColor={Colors.textSecondary}
                value={businessHandle}
                onChangeText={onHandleChange}
                autoCapitalize="none"
                autoCorrect={false}
                cursorColor={Colors.primary}
                selectionColor={Colors.primary}
              />
              {isValidating && <ActivityIndicator size="small" color={Colors.primary} />}
              {!isValidating && isAvailable === true && (
                <MaterialIcons name="check-circle" size={20} color={Colors.success} />
              )}
              {!isValidating && isAvailable === false && (
                <MaterialIcons name="error" size={20} color={Colors.error} />
              )}
            </View>
            {handleError ? <Text style={styles.errorText}>{handleError}</Text> : null}
            {businessHandle.length > 0 && businessHandle.length < 3 ? (
              <Text style={styles.errorText}>Handle must be at least 3 characters</Text>
            ) : null}
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
              disabled={!isFormValid}
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
    inputSuccess: {
      borderColor: Colors.success,
    },
    inputError: {
      borderColor: Colors.error,
    },
    inputIcon: {
      marginRight: Spacing.sm,
    },
    atSymbol: {
      fontSize: 18,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginRight: 2,
    },
    input: {
      flex: 1,
      fontSize: Typography.bodyLg.fontSize,
      color: Colors.textPrimary,
      height: "100%",
    },
    errorText: {
      fontSize: 12,
      color: "#D1222E",
      marginTop: 4,
    },
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
  });
}
