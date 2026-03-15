import { NavigationContainer } from '@react-navigation/native';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AnimatedSplashScreen>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AnimatedSplashScreen>
  );
}
