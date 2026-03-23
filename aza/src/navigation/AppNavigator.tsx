import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { 
  OnboardingScreen, 
  EnableNotificationsScreen,
  EnableBiometricsScreen,
  CreatingAccountScreen,
  AccountReadyScreen,
  FeesAndLimitsScreen
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
  CreatePasscodeScreen,
  ConfirmPasscodeScreen,
  TaxResidencyScreen,
  ConsentScreen,
  ReasonScreen,
  RefundScreen,
  StatementScreen
} from '../features/auth';
import { 
  VerifyIdentityScreen,
  SourceofFundsScreen,
  IdtypeScreen,
  VerifyFaceIdScreen,
  ScanIdScreen,
  ScanIdBackScreen,
  SelfieScanScreen,
  PEPStatusScreen,
  PEPDetailsScreen,
  PEPAccountPurposeScreen,
  PEPProofOfWealthScreen,
  PEPUnderReviewScreen,
  KYCSuccessScreen,
 } from '../features/kyc';
import { 
  TalkToUsScreen, 
  EmailUsScreen, 
  ChatWithUsScreen 
} from '../features/customercare';
import SendScreen from '../features/home/quickaccess/SendScreen';
import ReceiveScreen from '../features/home/quickaccess/ReceiveScreen';
import SendAmountScreen from '../features/home/quickaccess/SendAmountScreen';
import RequestAmountScreen from '../features/home/quickaccess/RequestAmountScreen';
import { ProfileScreen, DisplayScreen } from '../features/profile';

import { RootStackParamList } from './types';
import MainTabsNavigator from './MainTabsNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="MainTabs" component={MainTabsNavigator} />
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
      <Stack.Screen name="CreatePasscode" component={CreatePasscodeScreen} />
      <Stack.Screen name="ConfirmPasscode" component={ConfirmPasscodeScreen} />
      <Stack.Screen name="TaxResidency" component={TaxResidencyScreen} />
      <Stack.Screen name="Consent" component={ConsentScreen} />
      <Stack.Screen name="FeesAndLimits" component={FeesAndLimitsScreen} />
      <Stack.Screen name="VerifyIdentity" component={VerifyIdentityScreen} />
      <Stack.Screen name="SourceofFund" component={SourceofFundsScreen} />
      <Stack.Screen name='Idtype' component={IdtypeScreen} />
      <Stack.Screen name="VerifyFaceId" component={VerifyFaceIdScreen} />
      <Stack.Screen name="ScanId" component={ScanIdScreen} />
      <Stack.Screen name="ScanIdBack" component={ScanIdBackScreen} />
      <Stack.Screen name="SelfieScan" component={SelfieScanScreen} />
      <Stack.Screen name="PEPStatus" component={PEPStatusScreen} />
      <Stack.Screen name="PEPDetails" component={PEPDetailsScreen} />
      <Stack.Screen name="PEPAccountPurpose" component={PEPAccountPurposeScreen} />
      <Stack.Screen name="PEPProofOfWealth" component={PEPProofOfWealthScreen} />
      <Stack.Screen name="PEPUnderReview" component={PEPUnderReviewScreen} />
      <Stack.Screen name="KYCSuccess" component={KYCSuccessScreen} />
      <Stack.Screen name="CreatingAccount" component={CreatingAccountScreen} />
      <Stack.Screen name="AccountReady" component={AccountReadyScreen} />
      <Stack.Screen name="Reason" component={ReasonScreen} />
      <Stack.Screen name="Refund" component={RefundScreen} />
      <Stack.Screen name="Statement" component={StatementScreen}/>
      <Stack.Screen name="EnableNotification" component={EnableNotificationsScreen} />
      <Stack.Screen name="EnableBiometrics" component={EnableBiometricsScreen} />
      <Stack.Screen name="TalkToUs" component={TalkToUsScreen} />
      <Stack.Screen name="EmailUs" component={EmailUsScreen} />
      <Stack.Screen name="ChatWithUs" component={ChatWithUsScreen} />
      <Stack.Screen name="Send" component={SendScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Display" component={DisplayScreen} />
      <Stack.Screen name="Receive" component={ReceiveScreen} />
      <Stack.Screen name="SendAmount" component={SendAmountScreen} />
      <Stack.Screen name="RequestAmount" component={RequestAmountScreen} />
    </Stack.Navigator>
  );
}
