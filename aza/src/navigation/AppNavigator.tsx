import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import MainTabsNavigator from './MainTabsNavigator';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import {
  TalkToUsScreen,
  EmailUsScreen,
  ChatWithUsScreen,
  HelpAndSupportScreen
} from '../features/customercare';
import { ChatScreen, CameraScreen, MediaPreviewScreen } from '../features/chat';
import { ContactsProfileScreen } from '../features/contacts';
import { MiniAppPlayerScreen } from '../features/hub';
import {
  SendContactScreen,
  SendAmountScreen,
  SendConfirmScreen,
  SendPinScreen,
  SendSuccessScreen,
  RequestContactScreen,
  RequestAmountScreen,
  DetailsScreen,
  SpendingScreen
} from '../features/transfer';
import { 
  WithdrawScreen, 
  StatementDownloadScreen, 
  TransactionsScreen 
} from '../features/home';

// Wrap the entire transfer flow so a crash in any send/receive screen
// shows the error boundary instead of taking down the whole app.
function SendContactWithBoundary(props: React.ComponentProps<typeof SendContactScreen>) { return <ErrorBoundary><SendContactScreen {...props} /></ErrorBoundary>; }
function SendAmountWithBoundary(props: React.ComponentProps<typeof SendAmountScreen>) { return <ErrorBoundary><SendAmountScreen {...props} /></ErrorBoundary>; }
function SendConfirmWithBoundary(props: React.ComponentProps<typeof SendConfirmScreen>) { return <ErrorBoundary><SendConfirmScreen {...props} /></ErrorBoundary>; }
function SendPinWithBoundary(props: React.ComponentProps<typeof SendPinScreen>) { return <ErrorBoundary><SendPinScreen {...props} /></ErrorBoundary>; }
function SendSuccessWithBoundary(props: React.ComponentProps<typeof SendSuccessScreen>) { return <ErrorBoundary><SendSuccessScreen {...props} /></ErrorBoundary>; }
function RequestContactWithBoundary(props: React.ComponentProps<typeof RequestContactScreen>) { return <ErrorBoundary><RequestContactScreen {...props} /></ErrorBoundary>; }
function RequestAmountWithBoundary(props: React.ComponentProps<typeof RequestAmountScreen>) { return <ErrorBoundary><RequestAmountScreen {...props} /></ErrorBoundary>; }
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
      <Stack.Screen name="Send" component={SendContactWithBoundary} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="Receive" component={RequestContactWithBoundary} />
      <Stack.Screen name="SendAmount" component={SendAmountWithBoundary} />
      <Stack.Screen name="SendConfirm" component={SendConfirmWithBoundary} />
      <Stack.Screen name="SendPin" component={SendPinWithBoundary} />
      <Stack.Screen name="SendSuccess" component={SendSuccessWithBoundary} />
      <Stack.Screen name="RequestAmount" component={RequestAmountWithBoundary} />
      <Stack.Screen name="Details" component={DetailsScreen} />
      <Stack.Screen name="Spending" component={SpendingScreen} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="StatementDownload" component={StatementDownloadScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
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
      <Stack.Screen name="ChatScreen" component={ChatScreen} />
      <Stack.Screen name="ChatCamera" component={CameraScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="MediaPreview" component={MediaPreviewScreen} options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="ContactsProfile" component={ContactsProfileScreen} />
      <Stack.Screen
        name="MiniApp"
        component={MiniAppPlayerScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
