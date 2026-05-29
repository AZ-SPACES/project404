import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../providers/AuthProvider';
import { RootStackParamList } from './types';
import MainTabsNavigator from './MainTabsNavigator';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import {
  TalkToUsScreen,
  EmailUsScreen,
  ChatWithUsScreen,
  HelpAndSupportScreen,
  HelpTopicScreen,
} from '../features/customercare';
import { 
  ChatScreen, CameraScreen, MediaPreviewScreen, ChatInfoScreen, 
  AudioCallScreen, VideoCallScreen, StarredMessagesScreen, 
  SharedMediaScreen, ManageStorageScreen, MessageInfoScreen 
} from '../features/chat';
import { ContactsProfileScreen, AddFriendsScreen, RequestPendingScreen } from '../features/contacts';
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
  TransactionsScreen,
  ReversalRequestScreen
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
  AppSecurityScreen,
  SecureAccountScreen,
  LogoutEverywhereScreen,
  DevicesScreen,
  TwoStepVerificationScreen,
  TotpSetupScreen,
  DisableTotpScreen,
  RecoveryCodesScreen,
  ManageRecoveryCodesScreen,
  AccountRecoveryContactsScreen,
  SmsSetupScreen,
  DisableSmsScreen,
  PasskeySetupScreen,
  DisablePasskeyScreen,
  AzaAppSetupScreen,
  ChangePasswordScreen,
  FindMeByScreen,
  BillForwardingIntroScreen,
  BillForwardingDetailsScreen,
  PersonalDetailsScreen,
  PersonalInformationScreen,
  ChangeEmailScreen,
  ChangePhoneScreen,
  DeleteAccountScreen
} from '../features/profile';
import {
  ReasonScreen,
  RefundScreen,
  StatementScreen,
  TermsOfServiceScreen,
  PrivacyPolicyScreen,
  AppLoginApprovalScreen,
  GenerateRecoveryCodeScreen,
} from '../features/auth';
import { InboxScreen } from '../features/notifications';


import { VerifyPasscodeScreen } from '../features/security/screens/VerifyPasscodeScreen';
import CreatePasscodeScreen from '../features/security/screens/CreatePasscodeScreen';
import ConfirmPasscodeScreen from '../features/auth/signup/ConfirmPasscodeScreen';
import MerchantBusinessNameScreen from '../features/hub/miniapps/merchant/MerchantBusinessNameScreen';
import MerchantBusinessCategoryScreen from '../features/hub/miniapps/merchant/MerchantBusinessCategoryScreen';
import MerchantBusinessContactScreen from '../features/hub/miniapps/merchant/MerchantBusinessContactScreen';
import MerchantKYBIntroScreen from '../features/hub/miniapps/merchant/MerchantKYBIntroScreen';
import MerchantKYBBusinessScreen from '../features/hub/miniapps/merchant/MerchantKYBBusinessScreen';
import MerchantKYBOwnerScreen from '../features/hub/miniapps/merchant/MerchantKYBOwnerScreen';
import MerchantKYBDocumentsScreen from '../features/hub/miniapps/merchant/MerchantKYBDocumentsScreen';
import MerchantKYBSubmittedScreen from '../features/hub/miniapps/merchant/MerchantKYBSubmittedScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { forcePasswordReset } = useAuth();

  if (forcePasswordReset) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      </Stack.Navigator>
    );
  }

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
      <Stack.Screen 
        name="Details" 
        component={DetailsScreen} 
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Spending" component={SpendingScreen} />
      <Stack.Screen 
        name="Withdraw" 
        component={WithdrawScreen} 
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen 
        name="StatementDownload" 
        component={StatementDownloadScreen} 
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="ReversalRequest" component={ReversalRequestScreen} />
      <Stack.Screen name="Inbox" component={InboxScreen} />
      <Stack.Screen name="HelpAndSupport" component={HelpAndSupportScreen} />
      <Stack.Screen name="HelpTopic" component={HelpTopicScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="SecurityAndPrivacy" component={SecurityAndPrivacyScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="SecureAccount" component={SecureAccountScreen} />
      <Stack.Screen name="LogoutEverywhere" component={LogoutEverywhereScreen} />
      <Stack.Screen name="Devices" component={DevicesScreen} />
      <Stack.Screen name="TwoStepVerification" component={TwoStepVerificationScreen} />
      <Stack.Screen name="TotpSetup" component={TotpSetupScreen} />
      <Stack.Screen name="DisableTotp" component={DisableTotpScreen} />
      <Stack.Screen name="RecoveryCodes" component={RecoveryCodesScreen} />
      <Stack.Screen name="ManageRecoveryCodes" component={ManageRecoveryCodesScreen} />
      <Stack.Screen name="SmsSetup" component={SmsSetupScreen} />
      <Stack.Screen name="DisableSms" component={DisableSmsScreen} />
      <Stack.Screen name="PasskeySetup" component={PasskeySetupScreen} />
      <Stack.Screen name="DisablePasskey" component={DisablePasskeyScreen} />
      <Stack.Screen name="AzaAppSetup" component={AzaAppSetupScreen} />
      <Stack.Screen name="FindMeBy" component={FindMeByScreen} />
      <Stack.Screen name="BillForwardingIntro" component={BillForwardingIntroScreen} />
      <Stack.Screen name="BillForwardingDetails" component={BillForwardingDetailsScreen} />
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
      <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
      <Stack.Screen name="AppSecurity" component={AppSecurityScreen} />
      <Stack.Screen name="VerifyPasscode" component={VerifyPasscodeScreen}/>
      <Stack.Screen name="CreatePasscode" component={CreatePasscodeScreen} />
      <Stack.Screen name="ConfirmPasscode" component={ConfirmPasscodeScreen} />
      <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
      <Stack.Screen name="ChangePhone" component={ChangePhoneScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="AppLoginApproval" component={AppLoginApprovalScreen} />
      <Stack.Screen name="GenerateRecoveryCode" component={GenerateRecoveryCodeScreen} />
      <Stack.Screen name="AccountRecoveryContacts" component={AccountRecoveryContactsScreen} />
      <Stack.Screen name="Reason" component={ReasonScreen} />
      <Stack.Screen name="Refund" component={RefundScreen} />
      <Stack.Screen name="Statement" component={StatementScreen}/>
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} />
      <Stack.Screen name="ChatCamera" component={CameraScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="MediaPreview" component={MediaPreviewScreen} options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="ContactsProfile" component={ContactsProfileScreen} />
      <Stack.Screen name="AddFriends" component={AddFriendsScreen} />
      <Stack.Screen name="RequestPending" component={RequestPendingScreen} />
      <Stack.Screen name="ChatInfoScreen" component={ChatInfoScreen} />
      <Stack.Screen name="StarredMessages" component={StarredMessagesScreen} />
      <Stack.Screen name="SharedMedia" component={SharedMediaScreen} />
      <Stack.Screen name="ManageStorage" component={ManageStorageScreen} />
      <Stack.Screen name="MessageInfo" component={MessageInfoScreen} />
      <Stack.Screen name="AudioCall" component={AudioCallScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="VideoCall" component={VideoCallScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen
        name="MiniApp"
        component={MiniAppPlayerScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="MerchantBusinessName" component={MerchantBusinessNameScreen} />
      <Stack.Screen name="MerchantBusinessCategory" component={MerchantBusinessCategoryScreen} />
      <Stack.Screen name="MerchantBusinessContact" component={MerchantBusinessContactScreen} />
      <Stack.Screen name="MerchantKYBIntro" component={MerchantKYBIntroScreen} />
      <Stack.Screen name="MerchantKYBBusiness" component={MerchantKYBBusinessScreen} />
      <Stack.Screen name="MerchantKYBOwner" component={MerchantKYBOwnerScreen} />
      <Stack.Screen name="MerchantKYBDocuments" component={MerchantKYBDocumentsScreen} />
      <Stack.Screen name="MerchantKYBSubmitted" component={MerchantKYBSubmittedScreen} />
    </Stack.Navigator>
  );
}
