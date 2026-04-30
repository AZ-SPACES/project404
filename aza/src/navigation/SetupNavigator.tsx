import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { 
  CreatePasscodeScreen,
  ConfirmPasscodeScreen,
  ConsentScreen,
} from '../features/auth';
import { 
} from '../features/onboarding';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function SetupNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="CreatePasscode"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="CreatePasscode" component={CreatePasscodeScreen} />
      <Stack.Screen name="ConfirmPasscode" component={ConfirmPasscodeScreen} />
      <Stack.Screen name="Consent" component={ConsentScreen} />
    </Stack.Navigator>
  );
}
