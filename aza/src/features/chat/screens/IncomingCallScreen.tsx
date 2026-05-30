import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, Typography, Spacing } from '../../../theme';
import { useCallStore } from '../../../store/callStore';

export default function IncomingCallScreen() {
  const { colors: Colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const activeCall = useCallStore(state => state.activeCall);
  const acceptIncomingCall = useCallStore(state => state.acceptIncomingCall);
  const declineIncomingCall = useCallStore(state => state.declineIncomingCall);

  // If the call ends while we are on this screen, close the screen
  useEffect(() => {
    if (!activeCall) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTabs');
      }
    }
  }, [activeCall, navigation]);

  if (!activeCall) return null;

  const handleAccept = async () => {
    await acceptIncomingCall();
    // Use replace so we don't go back to IncomingCallScreen
    if (activeCall.type === 'VIDEO') {
      navigation.replace('VideoCall', {
        callId: activeCall.callId,
        name: activeCall.callerName,
        avatar: activeCall.callerAvatar || '',
      });
    } else {
      navigation.replace('AudioCall', {
        callId: activeCall.callId,
        name: activeCall.callerName,
        avatar: activeCall.callerAvatar || '',
      });
    }
  };

  const handleDecline = async () => {
    await declineIncomingCall();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs');
    }
  };

  // Derived initials for fallback avatar
  const initials = activeCall.callerName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.topContent}>
        {activeCall.callerAvatar ? (
          <Image source={{ uri: activeCall.callerAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
             <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <Text style={[styles.callerName, { color: Colors.textPrimary }]}>{activeCall.callerName}</Text>
        <Text style={[styles.callType, { color: Colors.textSecondary }]}>
          Incoming {activeCall.type === 'VIDEO' ? 'Video' : 'Audio'} Call
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
            onPress={handleDecline}
            activeOpacity={0.8}
          >
            <Feather name="phone-off" size={32} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.actionLabel, { color: Colors.textSecondary }]}>Decline</Text>
        </View>

        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#10B981' }]}
            onPress={handleAccept}
            activeOpacity={0.8}
          >
            <Feather name="phone" size={32} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.actionLabel, { color: Colors.textSecondary }]}>Accept</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.xl,
  },
  topContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  callerName: {
    ...Typography.h1,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  callType: {
    ...Typography.bodyLg,
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionLabel: {
    ...Typography.body,
    fontWeight: '600',
  },
});
