import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../features/onboarding/OnboardingScreen';
import LoginScreen from '../features/auth/LoginScreen';
import TroubleLoginScreen from '../features/auth/issues/TroubleLoginScreen';
import OTPScreen from '../features/auth/OTPScreen';
import ForgotPasswordScreen from '../features/auth/issues/ForgotPasswordScreen';
import TwoStepVerificationIssueScreen from '../features/auth/issues/TwoStepVerificationIssueScreen';
import ChangePhoneNumberScreen from '../features/auth/issues/ChangePhoneNumberScreen';
import ChangeEmailScreen from '../features/auth/issues/ChangeEmailScreen';
import AccountDeactivatedScreen from '../features/auth/issues/AccountDeactivatedScreen';
import SomethingElseScreen from '../features/auth/issues/SomethingElseScreen';
import ResetPasswordScreen from '../features/auth/reset/ResetPasswordScreen';
import ResetOTPScreen from '../features/auth/reset/ResetOTPScreen';
import SignUpNumberScreen from '../features/auth/signup/SignUpNumberScreen';
import SignUpEmailScreen from '../features/auth/signup/SignUpEmailScreen';
import SignUpPasswordScreen from '../features/auth/signup/SignUpPasswordScreen';
import SignUpNameScreen from '../features/auth/signup/SignUpNameScreen';
import SignUpAddressScreen from '../features/auth/signup/SignUpAddressScreen';
import SignUpPronounsScreen from '../features/auth/signup/SignUpPronounsScreen';
import SignUpEmploymentScreen from '../features/auth/signup/SignUpEmploymentScreen';
import SignUpBirthdayScreen from '../features/auth/signup/SignUpBirthdayScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  TroubleLogin: undefined;
  OTP: undefined;
  ForgotPassword: undefined;
  TwoStepVerificationIssue: undefined;
  ChangePhoneNumber: undefined;
  ChangeEmail: undefined;
  AccountDeactivated: undefined;
  SomethingElse: undefined;
  ResetPassword: undefined;
  ResetOTP: undefined;
  SignUpNumber: undefined;
  SignUpEmail: undefined;
  SignUpPassword: undefined;
  SignUpName: undefined;
  SignUpAddress: undefined;
  SignUpPronouns: undefined;
  SignUpEmployment: undefined;
  SignUpBirthday: undefined;
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
      <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
      <Stack.Screen name="AccountDeactivated" component={AccountDeactivatedScreen} />
      <Stack.Screen name="SomethingElse" component={SomethingElseScreen} />
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
      </Stack.Navigator>
  );
}
