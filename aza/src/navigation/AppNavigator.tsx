import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../features/onboarding/OnboardingScreen';
import LoginScreen from '../features/auth/LoginScreen';
import TroubleLoginScreen from '../features/auth/issues/TroubleLoginScreen';
import OTPScreen from '../features/auth/OTPScreen';
import ForgotPasswordScreen from '../features/auth/issues/ForgotPasswordScreen';
import TwoStepVerificationIssueScreen from '../features/auth/issues/TwoStepVerificationIssueScreen';
import ChangePhoneNumberScreen from '../features/auth/issues/ChangePhoneNumberScreen';
import AccountDeactivatedScreen from '../features/auth/issues/AccountDeactivatedScreen';
import NewDeviceLoginScreen from '../features/auth/issues/NewDeviceLoginScreen';
import ResetPasswordScreen from '../features/auth/reset/ResetPasswordScreen';
import ResetOTPScreen from '../features/auth/reset/ResetOTPScreen';
import ReasonScreen from '../features/auth/issues/dactivatedaccount/ReasonScreen';
import RefundScreen from '../features/auth/issues/dactivatedaccount/RefundScreen';
import StatementScreen from '../features/auth/issues/dactivatedaccount/StatementScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  TroubleLogin: undefined;
  OTP: undefined;
  ForgotPassword: undefined;
  TwoStepVerificationIssue: undefined;
  ChangePhoneNumber: undefined;
  AccountDeactivated: undefined;
  NewDeviceLogin: undefined;
  ResetPassword: undefined;
  ResetOTP: undefined;
  Reason: undefined;
  Refund: undefined;
  Statement: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
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
      <Stack.Screen name="Reason" component={ReasonScreen} />
      <Stack.Screen name="Refund" component={RefundScreen} />
      <Stack.Screen name="Statement" component={StatementScreen}/>
    </Stack.Navigator>
  );
}
