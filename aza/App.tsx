import { NavigationContainer } from '@react-navigation/native';
import AnimatedSplashScreen from './src/components/ui/AnimatedSplashScreen';
import ErrorBoundary from './src/components/ui/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { DisplayProvider } from './src/providers/DisplayProvider';

export default function App() {
  return (
    <ErrorBoundary>
      <AnimatedSplashScreen>
        <DisplayProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </DisplayProvider>
      </AnimatedSplashScreen>
    </ErrorBoundary>
  );
}
