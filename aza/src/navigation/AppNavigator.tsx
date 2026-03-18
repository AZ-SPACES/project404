import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { 
  OnboardingScreen, 
  EnableNotificationsScreen 
} from '../features/onboarding';
import { 
  LoginScreen, 
  OTPScreen, 
  EnableBiometricsScreen,
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
  ReasonScreen,
  RefundScreen,
  StatementScreen
} from '../features/auth';
import { 
  TalkToUsScreen, 
  EmailUsScreen, 
  ChatWithUsScreen 
} from '../features/customercare';

import { RootStackParamList } from './types';


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
