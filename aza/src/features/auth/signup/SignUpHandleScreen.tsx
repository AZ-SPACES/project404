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
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useSignUp } from "../../../providers/SignUpProvider";
import { checkHandleAvailability, suggestHandles } from "../../../services/api";
import { debounce } from "lodash";
import { BackButton } from '../../../components/ui/BackButton';
import SignUpProgressBar from '../../../components/ui/SignUpProgressBar';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUpHandle">;

export default function SignUpHandleScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { data, update } = useSignUp();
  
  const [handle, setHandle] = useState(data.handle || "");
  const [isValidating, setIsValidating] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
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

  const dataRef = useRef(data);
  dataRef.current = data;

  const validateHandle = useCallback(
    debounce(async (text: string) => {
      if (text.length < 3) {
        setIsAvailable(null);
        setIsValidating(false);
        return;
      }

      try {
        const response = await checkHandleAvailability(text);
        setIsAvailable(response.data.data);
        if (!response.data.data) {
          setError("This username is already taken");
          try {
            const { firstName, lastName } = dataRef.current;
            const suggestRes = await suggestHandles(firstName, lastName);
            setSuggestions(suggestRes.data.data || []);
          } catch {
            // suggestions are best-effort
          }
        } else {
          setError(null);
        }
      } catch (err) {
        console.error("Error checking username:", err);
      } finally {
        setIsValidating(false);
      }
    }, 500),
    []
  );

  useEffect(() => () => validateHandle.cancel(), [validateHandle]);

  useEffect(() => {
    if (handle.length >= 3) {
      setIsValidating(true);
      validateHandle(handle);
    } else {
      setIsAvailable(null);
      setError(null);
      setSuggestions([]);
    }
  }, [handle]);

  const handleNext = () => {
    update({ handle });
    navigation.navigate("SignUpAddress");
  };

  const onHandleChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setHandle(cleaned);
  };

  const selectSuggestion = (s: string) => {
    setHandle(s);
    setSuggestions([]);
  };

  const isFormValid = handle.length >= 3 && isAvailable === true && !isValidating;

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
            <Animated.View
              style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>
                Pick a username
              </Text>
            </Animated.View>
          </Animated.View>

          <SignUpProgressBar step={5} total={10} />

          {/* Content */}
          <Animated.ScrollView keyboardShouldPersistTaps="handled"
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false },
            )}
            scrollEventThrottle={16}
          >
            <Text style={styles.title}>Pick a username</Text>
            <Text style={styles.subtitle}>
              Your username is your unique @username on AZA. You can change it later.
            </Text>

            <Text style={styles.label}>Username</Text>
            <View style={[
              styles.inputContainer,
              isAvailable === true && styles.inputSuccess,
              isAvailable === false && styles.inputError
            ]}>
              <Text style={styles.atSymbol}>@</Text>
              <TextInput
                underlineColorAndroid="transparent"
                style={styles.input}
                placeholder="username"
                placeholderTextColor={Colors.textSecondary}
                value={handle}
                onChangeText={onHandleChange}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
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
            
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {suggestions.length > 0 && isAvailable === false && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>Suggested usernames:</Text>
                <View style={styles.suggestionsList}>
                  {suggestions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.suggestionBadge}
                      onPress={() => selectSuggestion(s)}
                    >
                      <Text style={styles.suggestionText}>@{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </Animated.ScrollView>

          {/* Footer */}
          <View style={styles.buttonContainer}>
            <Button
              title="Continue"
              onPress={handleNext}
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
      lineHeight: 22,
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
      backgroundColor: isDark ? Colors.surface : 'white',
    },
    inputSuccess: {
      borderColor: Colors.success,
    },
    inputError: {
      borderColor: Colors.error,
    },
    atSymbol: {
      fontSize: 18,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginRight: 2,
    },
    input: {
      flex: 1,
      fontSize: 18,
      color: Colors.textPrimary,
      height: "100%",
      fontWeight: "500",
    },
    errorText: {
      fontSize: 14,
      color: Colors.error,
      marginTop: 8,
    },
    suggestionsContainer: {
      marginTop: Spacing.lg,
    },
    suggestionsLabel: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
    },
    suggestionsList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    suggestionBadge: {
      backgroundColor: isDark ? Colors.white10 : "rgba(0,0,0,0.05)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    suggestionText: {
      fontSize: 14,
      color: Colors.primary,
      fontWeight: "500",
    },
    buttonContainer: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
  });
}
