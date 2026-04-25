import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ImageBackground, Animated, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors } from "../../../theme";
import Button from "../../../components/ui/Button";
import { useAuth } from "../../../providers/AuthProvider";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "AccountReady">;

export default function AccountReadyScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { completeKYC } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Success Haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 2. Fade-in entrance (following 200ms ease rule where possible, extended slightly for polish)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleFinish = () => {
    completeKYC();
  };

  return (
    <ImageBackground
      source={require("../../../assets/family.png")} 
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" />
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <Text style={styles.title}>You’re{"\n"}all set to{"\n"}use aza</Text>
          </Animated.View>
          
          <View style={styles.footer}>
            <View style={styles.buttonWrapper}>
              <Button
                title="Go to Home"
                onPress={handleFinish}
                backgroundColor={Colors.primary}
                textColor={Colors.secondary}
                borderRadius={30}
                paddingVertical={16}
                fontSize={16}
                fontWeight="700"
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
  background: {
    flex: 1,
    width: "100%" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)" },
  safeArea: {
    flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24 },
  title: {
    color: Colors.white,
    fontSize: 60,
    fontWeight: "800",
    letterSpacing: -2,
    lineHeight: 64,
    marginBottom: 24 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24 },
  buttonWrapper: {
    width: '100%' } });
}
