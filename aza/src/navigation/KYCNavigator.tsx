import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { KYCProvider, useKYC } from '../providers/KYCProvider';
import { useAuth } from '../providers/AuthProvider';
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
  KYCRejectedScreen,
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
  // refreshStatus, unlike the raw getKycStatus service, writes the status *and*
  // the rejection reason into KYC context — which is where KYCRejectedScreen
  // reads the reason it shows the user.
  const { refreshStatus } = useKYC();

  // Route on the transition into a status rather than on every poll that
  // observes it. Routing on each tick would drag someone back to KYCRejected
  // 30 seconds after they navigated away themselves; only routing on the very
  // first poll (the previous behaviour) meant a rejection arriving mid-session
  // was never surfaced until the next app launch.
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      refreshStatus()
        .then((status) => {
          if (cancelled) return;

          // refreshStatus reports NOT_STARTED both for "no record yet" and for a
          // failed request, so it is never a reliable observation — leaving the
          // previous status untouched stops a network blip from reading as a
          // transition once the next poll succeeds.
          if (status === 'NOT_STARTED') return;

          const previous = lastStatus.current;
          lastStatus.current = status;

          if (status === 'VERIFIED') {
            completeKYC();
          } else if (status === previous) {
            // Already routed for this status; leave the user where they are.
          } else if (status === 'UNDER_REVIEW') {
            navigate('PEPUnderReview');
          } else if (status === 'REJECTED') {
            navigate('KYCRejected');
          }
        })
        .catch(() => {});
    };

    check();
    const timer = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [completeKYC, refreshStatus]);

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
        <Stack.Screen name="KYCRejected" component={KYCRejectedScreen} />
        <Stack.Screen name="KYCSuccess" component={KYCSuccessScreen} />
        <Stack.Screen name="CreatingAccount" component={CreatingAccountScreen} />
        <Stack.Screen name="FeesAndLimits" component={FeesAndLimitsScreen} />
        <Stack.Screen name="AccountReady" component={AccountReadyScreen} />
      </Stack.Navigator>
      </KYCStatusGate>
    </KYCProvider>
  );
}
