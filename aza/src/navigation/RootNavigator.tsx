import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../providers/AuthProvider';
import AuthNavigator from './AuthNavigator';
import KYCNavigator from './KYCNavigator';
import SetupNavigator from './SetupNavigator';
import AppNavigator from './AppNavigator';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { GeoBlockedScreen } from '../features/auth';

const Stack = createNativeStackNavigator();

function KYCWithBoundary() {
  return <ErrorBoundary><KYCNavigator /></ErrorBoundary>;
}

export default function RootNavigator() {
  const { userToken, isKYCVerified, hasPasscode, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userToken == null ? (
        <Stack.Group>
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ animation: 'fade' }}
          />
        </Stack.Group>
      ) : (
        <Stack.Group>
          {!hasPasscode ? (
            <Stack.Screen name="Setup" component={SetupNavigator} />
          ) : !isKYCVerified ? (
            <Stack.Screen name="KYC" component={KYCWithBoundary} />
          ) : (
            <Stack.Screen
              name="App"
              component={AppNavigator}
              options={{ gestureEnabled: false }}
            />
          )}
        </Stack.Group>
      )}
      {/* Always present — navigated to imperatively when geo-block is detected */}
      <Stack.Screen name="GeoBlocked" component={GeoBlockedScreen} />
    </Stack.Navigator>
  );
}
