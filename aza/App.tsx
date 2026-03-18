import { NavigationContainer } from '@react-navigation/native';
import AnimatedSplashScreen from './src/components/ui/AnimatedSplashScreen';
import ErrorBoundary from './src/components/ui/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <ErrorBoundary>
      <AnimatedSplashScreen>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AnimatedSplashScreen>
    </ErrorBoundary>
  );
}
