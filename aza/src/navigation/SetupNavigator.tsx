import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { 
  CreatePasscodeScreen,
  ConfirmPasscodeScreen,
  ConsentScreen,
  TermsOfServiceScreen,
  PrivacyPolicyScreen,
} from '../features/auth';

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
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
