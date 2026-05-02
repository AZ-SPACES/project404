import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useAppTheme, Typography, Radius } from '../../../theme';
import { checkApp2faStatus, requestApp2faApproval, TOKEN_KEY, REFRESH_TOKEN_KEY } from '../../../services/api';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { RootStackParamList } from '../../../navigation/types';

type LoginWaitApprovalRouteProp = RouteProp<RootStackParamList, 'LoginWaitApproval'>;

export default function LoginWaitApprovalScreen() {
  const { colors: Colors } = useAppTheme();
  const navigation = useNavigation();
  const route = useRoute<LoginWaitApprovalRouteProp>();
  const { preAuthToken } = route.params;
  const isDark = Colors.isDark;
  const { login } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [requestId, setRequestId] = useState<string | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startAppApproval();
    return () => stopPolling();
  }, []);

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const startAppApproval = async () => {
    setIsLoading(true);
    try {
      const { data } = await requestApp2faApproval(preAuthToken);
      const reqId = data?.data ?? data;
      setRequestId(reqId);
      
      // Start polling
      pollingInterval.current = setInterval(async () => {
        try {
          const statusRes = await checkApp2faStatus(preAuthToken, reqId);
          const payload = statusRes.data?.data ?? statusRes.data;
          
          if (payload && payload.accessToken) {
            stopPolling();
            await finalizeLogin(payload);
          }
        } catch (e: any) {
          if (e.response?.data?.message?.includes('denied')) {
            stopPolling();
            showToast('Login request was denied.', 'error');
            navigation.goBack();
          }
        }
      }, 3000);

    } catch (error: any) {
      showToast('Failed to send push request. Please try another method.', 'error');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeLogin = async (payload: any) => {
    await SecureStore.setItemAsync(TOKEN_KEY, payload.accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, payload.refreshToken);
    login(
      payload.accessToken,
      payload.user?.passcodeSet ?? false,
      payload.user?.kycStatus === 'VERIFIED',
      payload.user?.forcePasswordReset ?? false,
      payload.user?.requireSelfieVerification ?? false,
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={32} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <View style={[styles.pulseCircle, { backgroundColor: Colors.primary + '10' }]} />
          <MaterialCommunityIcons name="cellphone-check" size={80} color={Colors.primary} />
          <ActivityIndicator 
            size="large" 
            color={Colors.primary} 
            style={styles.spinner} 
          />
        </View>

        <Text style={[Typography.h1, { color: Colors.textPrimary, textAlign: 'center', marginBottom: 12, fontSize: 28 }]}>
          Waiting for Approval
        </Text>
        
        <Text style={[Typography.bodyLg, { color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 30, lineHeight: 26 }]}>
          Open the Aza app on your other device and tap 'Approve' to continue.
        </Text>

        <View style={[styles.infoBox, { backgroundColor: isDark ? Colors.surface : 'rgba(0,0,0,0.03)' }]}>
          <Feather name="info" size={18} color={Colors.textSecondary} />
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginLeft: 12, flex: 1, lineHeight: 18 }]}>
            If you don't see a notification, check your internet connection or try another verification method.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          activeOpacity={0.7}
          style={styles.anotherWayButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[Typography.body, { color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' }]}>
            Try another way
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
    position: 'relative',
  },
  pulseCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  spinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ scale: 2.2 }],
    opacity: 0.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 80,
    padding: 16,
    borderRadius: Radius.md,
    width: '100%',
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  anotherWayButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
