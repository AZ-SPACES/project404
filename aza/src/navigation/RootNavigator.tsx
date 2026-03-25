import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../providers/AuthProvider';
import AuthNavigator from './AuthNavigator';
import KYCNavigator from './KYCNavigator';
import SetupNavigator from './SetupNavigator';
import AppNavigator from './AppNavigator';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { userToken, isKYCVerified, hasPasscode, isLoading } = useAuth();

  if (isLoading) {
    // We can return a loading splash screen here if desired, 
    // but the app already uses AnimatedSplashScreen in App.tsx.
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userToken == null ? (
        // No token found, user isn't signed in
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : !hasPasscode ? (
        // User has signed in but hasn't set up passcode/biometrics yet
        <Stack.Screen name="Setup" component={SetupNavigator} />
      ) : !isKYCVerified ? (
        // User has set up passcode but hasn't completed KYC
        <Stack.Screen name="KYC" component={KYCNavigator} />
      ) : (
        // User is fully authenticated and set up
        <Stack.Screen name="App" component={AppNavigator} />
      )}
    </Stack.Navigator>
  );
}
