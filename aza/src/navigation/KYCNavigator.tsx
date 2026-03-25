import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
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
  CreatingAccountScreen,
  AccountReadyScreen,
  FeesAndLimitsScreen,
} from '../features/onboarding';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function KYCNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PEPStatus"
      screenOptions={{ headerShown: false }}
    >
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
      <Stack.Screen name="FeesAndLimits" component={FeesAndLimitsScreen} />
      <Stack.Screen name="AccountReady" component={AccountReadyScreen} />
    </Stack.Navigator>
  );
}
