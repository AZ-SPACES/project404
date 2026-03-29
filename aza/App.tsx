import { StatusBar, View } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AnimatedSplashScreen from "./src/components/ui/AnimatedSplashScreen";
import ErrorBoundary from "./src/components/ui/ErrorBoundary";
import RootNavigator from "./src/navigation/RootNavigator";
import { DisplayProvider, useDisplayContext } from "./src/providers/DisplayProvider";
import { AuthProvider } from "./src/providers/AuthProvider";
import { ProfileProvider } from "./src/providers/ProfileProvider";
import { NotificationProvider } from "./src/providers/NotificationProvider";
import { NetworkProvider } from "./src/providers/NetworkProvider";
import { OfflineBanner } from "./src/components/ui/OfflineBanner";
import PrivacyOverlay from "./src/components/ui/PrivacyOverlay";

const linking = {
  prefixes: ['aza://', 'https://aza.me'],
  config: {
    screens: {
      App: {
        screens: {
          // Payment link: aza://pay/naaddo → Send screen
          Send: 'pay/:handle',
          // Profile QR code: aza://me/naaddo → MyCode screen (via scan tab)
          MainTabs: {
            screens: {
              Inbox: 'inbox',
            },
          },
        },
      },
    },
  },
};

function AppContent() {
  const { activeColorScheme } = useDisplayContext();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={activeColorScheme === "dark" ? "light-content" : "dark-content"} />
      <NavigationContainer
        theme={activeColorScheme === "dark" ? DarkTheme : DefaultTheme}
        linking={linking as any}
      >
        <RootNavigator />
      </NavigationContainer>
      <OfflineBanner />
      <PrivacyOverlay />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <NetworkProvider>
          <AuthProvider>
            <ProfileProvider>
              <NotificationProvider>
                <DisplayProvider>
                  <AnimatedSplashScreen>
                    <AppContent />
                  </AnimatedSplashScreen>
                </DisplayProvider>
              </NotificationProvider>
            </ProfileProvider>
          </AuthProvider>
        </NetworkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
