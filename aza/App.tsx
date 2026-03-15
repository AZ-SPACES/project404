import OnboardingScreen from "./src/features/onboarding/OnboardingScreen";
import AnimatedSplashScreen from "./src/components/AnimatedSplashScreen";

export default function App() {
  return (
    <AnimatedSplashScreen>
      <OnboardingScreen />
    </AnimatedSplashScreen>
  );
}
