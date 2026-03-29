import { StatusBar } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import AnimatedSplashScreen from "./src/components/ui/AnimatedSplashScreen";
import ErrorBoundary from "./src/components/ui/ErrorBoundary";
import RootNavigator from "./src/navigation/RootNavigator";
import { DisplayProvider, useDisplayContext } from "./src/providers/DisplayProvider";
import { AuthProvider } from "./src/providers/AuthProvider";
import { ProfileProvider } from "./src/providers/ProfileProvider";
import { NotificationProvider } from "./src/providers/NotificationProvider";
import PrivacyOverlay from "./src/components/ui/PrivacyOverlay";

function AppContent() {
  const { activeColorScheme } = useDisplayContext();
  return (
    <>
      <StatusBar barStyle={activeColorScheme === "dark" ? "light-content" : "dark-content"} />
      <NavigationContainer theme={activeColorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <RootNavigator />
      </NavigationContainer>
      <PrivacyOverlay />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
