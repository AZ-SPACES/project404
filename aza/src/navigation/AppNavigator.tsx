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
import SignUpNumberScreen from '../features/auth/signup/SignUpNumberScreen';
import SignUpEmailScreen from '../features/auth/signup/SignUpEmailScreen';
import SignUpPasswordScreen from '../features/auth/signup/SignUpPasswordScreen';
import SignUpNameScreen from '../features/auth/signup/SignUpNameScreen';
import SignUpAddressScreen from '../features/auth/signup/SignUpAddressScreen';
import SignUpPronounsScreen from '../features/auth/signup/SignUpPronounsScreen';
import SignUpEmploymentScreen from '../features/auth/signup/SignUpEmploymentScreen';
import SignUpBirthdayScreen from '../features/auth/signup/SignUpBirthdayScreen';
import ResetOTPScreen from '../features/auth/reset/ResetOTPScreen';
import ReasonScreen from '../features/auth/issues/dactivatedaccount/ReasonScreen';
import RefundScreen from '../features/auth/issues/dactivatedaccount/RefundScreen';
import StatementScreen from '../features/auth/issues/dactivatedaccount/StatementScreen';
import TalkToUsScreen from '../features/customercare/TalkToUsScreen';
import EmailUsScreen from '../features/customercare/EmailUsScreen';
import ChatWithUsScreen from '../features/customercare/ChatWithUsScreen';
import EnableNotificationsScreen from '../features/onboarding/EnableNotificationsScreen';
import EnableBiometricsScreen from '../features/auth/EnableBiometricsScreen';

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
  SignUpNumber: undefined;
  SignUpEmail: undefined;
  SignUpPassword: undefined;
  SignUpName: undefined;
  SignUpAddress: undefined;
  SignUpPronouns: undefined;
  SignUpEmployment: undefined;
  SignUpBirthday: undefined;
  Reason: undefined;
  Refund: undefined;
  Statement: undefined;
  TalkToUs: undefined;
  EmailUs: undefined;
  ChatWithUs: undefined;
  EnableNotification: undefined;
  EnableBiometrics: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="EnableNotification"
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
      <Stack.Screen name="Reason" component={ReasonScreen} />
      <Stack.Screen name="Refund" component={RefundScreen} />
      <Stack.Screen name="Statement" component={StatementScreen}/>
      <Stack.Screen name="EnableNotification" component={EnableNotificationsScreen} />
      <Stack.Screen name="EnableBiometrics" component={EnableBiometricsScreen} />
      <Stack.Screen name="TalkToUs" component={TalkToUsScreen} />
      <Stack.Screen name="EmailUs" component={EmailUsScreen} />
      <Stack.Screen name="ChatWithUs" component={ChatWithUsScreen} />
    </Stack.Navigator>
  );
}
