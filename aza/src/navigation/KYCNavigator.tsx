import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { KYCProvider } from '../providers/KYCProvider';
import { useAuth } from '../providers/AuthProvider';
import { getKycStatus } from '../services/api';
import { navigate } from './navigationRef';
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

const POLL_INTERVAL_MS = 30_000;

function KYCStatusGate({ children }: { children: React.ReactNode }) {
  const { completeKYC } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const check = (isInitial: boolean) => {
      getKycStatus()
        .then((res) => {
          if (cancelled) return;
          const status = res.data?.status;
          if (status === 'VERIFIED') {
            completeKYC();
          } else if (status === 'UNDER_REVIEW' && isInitial) {
            navigate('PEPUnderReview');
          }
        })
        .catch(() => {});
    };

    check(true);
    const timer = setInterval(() => check(false), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [completeKYC]);

  return <>{children}</>;
}

export default function KYCNavigator() {
  return (
    <KYCProvider>
      <KYCStatusGate>
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
      </KYCStatusGate>
    </KYCProvider>
  );
}
