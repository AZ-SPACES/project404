import { StatusBar } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import AnimatedSplashScreen from "./src/components/ui/AnimatedSplashScreen";
import ErrorBoundary from "./src/components/ui/ErrorBoundary";
import AppNavigator from "./src/navigation/AppNavigator";
import { DisplayProvider, useDisplayContext } from "./src/providers/DisplayProvider";

function AppContent() {
  const { activeColorScheme } = useDisplayContext();
  return (
    <>
      <StatusBar barStyle={activeColorScheme === "dark" ? "light-content" : "dark-content"} />
      <NavigationContainer theme={activeColorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AppNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DisplayProvider>
        <AnimatedSplashScreen>
          <AppContent />
        </AnimatedSplashScreen>
      </DisplayProvider>
    </ErrorBoundary>
  );
}
