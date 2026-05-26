import { StatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AnimatedSplashScreen from "./src/components/ui/AnimatedSplashScreen";
import ErrorBoundary from "./src/components/ui/ErrorBoundary";
import RootNavigator from "./src/navigation/RootNavigator";
import { DisplayProvider, useDisplayContext } from "./src/providers/DisplayProvider";
import { AuthProvider } from "./src/providers/AuthProvider";
import { ProfileProvider } from "./src/providers/ProfileProvider";
import { NotificationProvider } from "./src/providers/NotificationProvider";
import { NetworkProvider } from "./src/providers/NetworkProvider";
import { SecurityProvider, useSecurity } from "./src/providers/SecurityProvider";
import { ToastProvider } from "./src/providers/ToastProvider";
import { PresenceProvider } from "./src/providers/PresenceProvider";
import { OfflineBanner } from "./src/components/ui/OfflineBanner";
import PrivacyOverlay from "./src/components/ui/PrivacyOverlay";
import { navigationRef, processNavigationQueue } from "./src/navigation/navigationRef";
import { useAuth } from "./src/providers/AuthProvider";
import { useNotifications } from "./src/providers/NotificationProvider";
import EnableNotificationsScreen from "./src/features/notifications/screens/EnableNotificationsScreen";
import EnableBiometricsScreen from "./src/features/onboarding/screens/EnableBiometricsScreen";
import AppLockScreen from "./src/features/security/screens/AppLockScreen";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";

const linking = {
  prefixes: ["aza://", "https://aza.me"],
  config: {
    screens: {
      App: {
        screens: {
          // Payment link: aza://pay/naaddo → Send screen
          Send: "pay/:handle",
          // Profile QR code: aza://me/naaddo → MyCode screen (via scan tab)
          MainTabs: {
            screens: {
              Inbox: "inbox",
            },
          },
        },
      },
    },
  },
};

function AppContent() {
  const { activeColorScheme } = useDisplayContext();
  const { userToken, hasPasscode, isKYCVerified, isBiometricsEnabled } = useAuth();
  const { isLocked } = useSecurity();
  const { checkPermissions } = useNotifications();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [showBiometricsPrompt, setShowBiometricsPrompt] = useState(false);

  useEffect(() => {
    // Only check if user is fully onboarded and logged in
    if (userToken && hasPasscode && isKYCVerified) {
      const checkStatus = async () => {
        try {
          // 1. Check Biometrics first
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          if (!isBiometricsEnabled && hasHardware && isEnrolled) {
            // Only show if we don't already have a biometric token stored
            const storedToken = await SecureStore.getItemAsync("aza_biometric_token");
            if (!storedToken) {
              setShowBiometricsPrompt(true);
              return;
            }
          }

          // 2. Check Notifications
          const { status } = await checkPermissions();
          if (status !== "granted") {
            setShowNotificationPrompt(true);
          }
        } catch (error) {
          console.error("App: Failed to check service status", error);
        }
      };
      checkStatus();
    }
  }, [
    userToken,
    hasPasscode,
    isKYCVerified,
    isBiometricsEnabled,
    checkPermissions,
  ]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        barStyle={
          activeColorScheme === "dark" ? "light-content" : "dark-content"
        }
      />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          processNavigationQueue();
        }}
        theme={activeColorScheme === "dark" ? DarkTheme : DefaultTheme}
        linking={linking as any}
      >
        {isLocked ? (
          <AppLockScreen />
        ) : showBiometricsPrompt ? (
          <EnableBiometricsScreen
            onComplete={() => setShowBiometricsPrompt(false)}
          />
        ) : showNotificationPrompt ? (
          <EnableNotificationsScreen
            onComplete={() => setShowNotificationPrompt(false)}
          />
        ) : (
          <RootNavigator />
        )}
      </NavigationContainer>
      <OfflineBanner />
      <PrivacyOverlay />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NetworkProvider>
            <AuthProvider>
              <PresenceProvider>
                <SecurityProvider>
                  <ProfileProvider>
                    <NotificationProvider>
                      <DisplayProvider>
                        <ToastProvider>
                          <AnimatedSplashScreen>
                            <AppContent />
                          </AnimatedSplashScreen>
                        </ToastProvider>
                      </DisplayProvider>
                    </NotificationProvider>
                  </ProfileProvider>
                </SecurityProvider>
              </PresenceProvider>
            </AuthProvider>
          </NetworkProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
