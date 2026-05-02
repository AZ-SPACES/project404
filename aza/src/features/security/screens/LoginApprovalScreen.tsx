import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme, Typography, Spacing, Radius } from '../../../theme';
import { api } from '../../../services/api';
import { RootStackParamList } from '../../../navigation/types';

type LoginApprovalRouteProp = RouteProp<RootStackParamList, 'LoginApproval'>;

export default function LoginApprovalScreen() {
  const { colors: Colors } = useAppTheme();
  const navigation = useNavigation();
  const route = useRoute<LoginApprovalRouteProp>();
  const isDark = Colors.isDark;

  const { requestId, deviceName, ipAddress } = route.params;

  const handleResponse = async (approve: boolean) => {
    try {
      await api.post(`/api/v1/auth/2fa/app/respond?requestId=${requestId}&approve=${approve}`);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to respond to login approval', error);
      // Even if it fails, go back to prevent getting stuck
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.container}>
        <TouchableOpacity 
          style={[styles.closeButton, { backgroundColor: Colors.surface }]} 
          onPress={() => navigation.goBack()}
        >
          <Feather name="x" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={[styles.pulseCircle, { backgroundColor: Colors.primary + '20' }]} />
            <MaterialCommunityIcons name="shield-lock-outline" size={80} color={Colors.primary} />
          </View>

          <View style={styles.textSection}>
            <Text style={[Typography.h1, { color: Colors.textPrimary, textAlign: 'center', fontSize: 28 }]}>
              New Login Request
            </Text>
            <Text style={[Typography.bodyLg, { color: Colors.textSecondary, textAlign: 'center', marginTop: 12, paddingHorizontal: 20 }]}>
              A new device is trying to access your account. Please verify if this is you.
            </Text>
          </View>

          <View style={[styles.detailsCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <View style={styles.detailRow}>
              <Feather name="smartphone" size={20} color={Colors.primary} />
              <View style={styles.detailText}>
                <Text style={[Typography.caption, { color: Colors.textSecondary, letterSpacing: 1 }]}>DEVICE</Text>
                <Text style={[Typography.bodyLg, { color: Colors.textPrimary, fontWeight: '600' }]}>{deviceName || 'Unknown Device'}</Text>
              </View>
            </View>
            
            <View style={[styles.divider, { backgroundColor: Colors.border }]} />
            
            <View style={styles.detailRow}>
              <Feather name="globe" size={20} color={Colors.primary} />
              <View style={styles.detailText}>
                <Text style={[Typography.caption, { color: Colors.textSecondary, letterSpacing: 1 }]}>LOCATION (IP)</Text>
                <Text style={[Typography.bodyLg, { color: Colors.textPrimary, fontWeight: '600' }]}>{ipAddress || 'Unknown IP'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.button, styles.approveButton, { backgroundColor: Colors.primary }]}
            onPress={() => handleResponse(true)}
          >
            <Text style={[Typography.bodyLg, styles.buttonText, { color: Colors.background }]}>Yes, it's me</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.button, styles.denyButton, { borderColor: Colors.border }]}
            onPress={() => handleResponse(false)}
          >
            <Text style={[Typography.bodyLg, styles.buttonText, { color: Colors.error }]}>No, it's not me</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  pulseCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  textSection: {
    marginBottom: 40,
  },
  detailsCard: {
    width: '100%',
    borderRadius: Radius.lg,
    padding: 20,
    borderWidth: 1,
    marginBottom: 40,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailText: {
    marginLeft: 16,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  footer: {
    width: '100%',
    gap: 16,
  },
  button: {
    height: 56,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButton: {
    width: '100%',
  },
  denyButton: {
    width: '100%',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontWeight: '700',
  },
});
