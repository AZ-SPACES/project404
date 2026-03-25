import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import MainTabsNavigator from './MainTabsNavigator';
import { 
  TalkToUsScreen, 
  EmailUsScreen, 
  ChatWithUsScreen,
  HelpAndSupportScreen
} from '../features/customercare';
import { 
  SendContactScreen,
  SendAmountScreen,
  RequestContactScreen,
  RequestAmountScreen 
} from '../features/transfer';
import { 
  ProfileScreen, 
  AppearanceScreen, 
  NotificationSettingsScreen, 
  SecurityAndPrivacyScreen,
  SecureAccountScreen,
  LogoutEverywhereScreen,
  DevicesScreen,
  TwoStepVerificationScreen,
  ChangePasswordScreen,
  FindMeByScreen,
  BillForwardingIntroScreen,
  BillForwardingDetailsScreen,
  PersonalDetailsScreen,
  PersonalInformationScreen,
  ChangeEmailScreen,
  ChangePhoneScreen
} from '../features/profile';
import { ReasonScreen, RefundScreen, StatementScreen } from '../features/auth';
import { InboxScreen } from '../features/notifications';

// Exclude overlapping params from types since they are now separated
// For AppNavigator, we only need the param list for the app stack.
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="MainTabs" component={MainTabsNavigator} />
      <Stack.Screen name="TalkToUs" component={TalkToUsScreen} />
      <Stack.Screen name="EmailUs" component={EmailUsScreen} />
      <Stack.Screen name="ChatWithUs" component={ChatWithUsScreen} />
      <Stack.Screen name="Send" component={SendContactScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="Receive" component={RequestContactScreen} />
      <Stack.Screen name="SendAmount" component={SendAmountScreen} />
      <Stack.Screen name="RequestAmount" component={RequestAmountScreen} />
      <Stack.Screen name="Inbox" component={InboxScreen} />
      <Stack.Screen name="HelpAndSupport" component={HelpAndSupportScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="SecurityAndPrivacy" component={SecurityAndPrivacyScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="SecureAccount" component={SecureAccountScreen} />
      <Stack.Screen name="LogoutEverywhere" component={LogoutEverywhereScreen} />
      <Stack.Screen name="Devices" component={DevicesScreen} />
      <Stack.Screen name="TwoStepVerification" component={TwoStepVerificationScreen} />
      <Stack.Screen name="FindMeBy" component={FindMeByScreen} />
      <Stack.Screen name="BillForwardingIntro" component={BillForwardingIntroScreen} />
      <Stack.Screen name="BillForwardingDetails" component={BillForwardingDetailsScreen} />
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
      <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
      <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
      <Stack.Screen name="ChangePhone" component={ChangePhoneScreen} />
      <Stack.Screen name="Reason" component={ReasonScreen} />
      <Stack.Screen name="Refund" component={RefundScreen} />
      <Stack.Screen name="Statement" component={StatementScreen}/>
    </Stack.Navigator>
  );
}
