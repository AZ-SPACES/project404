import React from 'react';
import { RootStackParamList } from './types';
import { 
  OnboardingScreen, 
} from '../features/onboarding';
import { 
  LoginScreen, 
  OTPScreen, 
  TroubleLoginScreen,
  ForgotPasswordScreen,
  TwoStepVerificationIssueScreen,
  ChangePhoneNumberScreen,
  AccountDeactivatedScreen,
  NewDeviceLoginScreen,
  ResetPasswordScreen,
  ResetOTPScreen,
  SignUpNumberScreen,
  SignUpEmailScreen,
  SignUpPasswordScreen,
  SignUpNameScreen,
  SignUpAddressScreen,
  SignUpPronounsScreen,
  SignUpEmploymentScreen,
  SignUpBirthdayScreen,
  TaxResidencyScreen,
} from '../features/auth';

import { createNativeStackNavigator as createStack } from '@react-navigation/native-stack';
import { SignUpProvider } from '../providers/SignUpProvider';

const Stack = createStack<RootStackParamList>();

export default function AuthNavigator() {
  return (
    <SignUpProvider>
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="TroubleLogin" component={TroubleLoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="TwoStepVerificationIssue" component={TwoStepVerificationIssueScreen} />
      <Stack.Screen name="ChangePhoneNumber" component={ChangePhoneNumberScreen} />
      <Stack.Screen name="AccountDeactivated" component={AccountDeactivatedScreen} />
      <Stack.Screen name="NewDeviceLogin" component={NewDeviceLoginScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="ResetOTP" component={ResetOTPScreen} />
      <Stack.Screen name="SignUpNumber" component={SignUpNumberScreen} />
      <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
      <Stack.Screen name="SignUpPassword" component={SignUpPasswordScreen} />
      <Stack.Screen name="SignUpName" component={SignUpNameScreen} />
      <Stack.Screen name="SignUpAddress" component={SignUpAddressScreen} />
      <Stack.Screen name="SignUpPronouns" component={SignUpPronounsScreen} />
      <Stack.Screen name="SignUpEmployment" component={SignUpEmploymentScreen} />
      <Stack.Screen name="SignUpBirthday" component={SignUpBirthdayScreen} />
      <Stack.Screen name="TaxResidency" component={TaxResidencyScreen} />
    </Stack.Navigator>
    </SignUpProvider>
  );
}
