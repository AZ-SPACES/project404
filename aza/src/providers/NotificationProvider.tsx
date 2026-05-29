import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthProvider';
import { registerFcmToken, unregisterFcmToken, getDeviceId } from '../services/api';
import { navigate } from '../navigation/navigationRef';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';

type NotificationContextType = {
  checkPermissions: () => Promise<any>;
  requestPermissions: () => Promise<any>;
  registerForNotifications: () => Promise<boolean>;
  sendLocalNotification: (title: string, body: string, data?: any) => Promise<string | undefined>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken, completeKYC } = useAuth();
  const prevTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let subscription: Notifications.Subscription | undefined;
    let responseSubscription: Notifications.Subscription | undefined;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      subscription = Notifications.addNotificationReceivedListener((notification: any) => {
        if (userToken !== null) {
          queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount() });
        }

        const data = notification.request.content.data;
        const type = data?.type || data?.notification?.type;

        if (type === 'KYC_APPROVED') {
          completeKYC();
        }

        if (
          type === 'CONTACT_REQUEST_ACCEPTED' ||
          type === 'CONTACT_ACCEPTED' ||
          type === 'FRIEND_REQUEST_ACCEPTED' ||
          type === 'CONTACT_REQUEST_RECEIVED' ||
          type === 'FRIEND_REQUEST'
        ) {
          queryClient.invalidateQueries({ queryKey: queryKeys.contacts() });
          queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests() });
        }

        if (type === 'NEW_MESSAGE') {
          queryClient.invalidateQueries({ queryKey: queryKeys.contacts() });
        }

        if (type === 'MONEY_RECEIVED' || type === 'PAYMENT_REQUEST_RECEIVED' || type === 'PAYMENT_REQUEST_PAID') {
          queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }
      });

      responseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response.notification.request.content.data;

        if (data?.type === 'KYC_APPROVED') {
          completeKYC();
        } else if (data?.type === 'LOGIN_APPROVAL') {
          navigate('App', {
            screen: 'AppLoginApproval',
            params: {
              requestId: data.requestId,
              deviceName: data.deviceName ?? 'Unknown device',
              ipAddress: data.ipAddress ?? 'Unknown',
            },
          });
        } else if (data?.type === 'RECOVERY_CONTACT_INVITE') {
          navigate('App', { screen: 'AccountRecoveryContacts' });
        } else if (data?.type === 'RECOVERY_CONTACT_REQUEST') {
          navigate('App', {
            screen: 'GenerateRecoveryCode',
            params: {
              requestId: data.requestId,
              requesterName: data.requesterName ?? 'Someone',
              requesterHandle: data.requesterHandle,
            },
          });
        } else if (data?.type === 'KYB_APPROVED' || data?.type === 'KYB_REJECTED' || data?.type === 'KYB_MORE_INFO_REQUIRED') {
          navigate('App', { screen: 'Hub' });
        } else if (data?.type === 'KYC_REJECTED') {
          navigate('App', { screen: 'VerifyIdentity', params: {} });
        } else if (data?.type === 'INCOMING_CALL') {
          const screen = data.isVideo ? 'VideoCall' : 'AudioCall';
          navigate('App', {
            screen,
            params: { name: data.callerName ?? 'Unknown', avatar: '' },
          });
        } else if (data?.type === 'MISSED_CALL') {
          navigate('App', { screen: 'MainTabs', params: { screen: 'Inbox' } });
        } else if (data?.type === 'SECURITY_ALERT') {
          navigate('App', { screen: 'SecurityAndPrivacy' });
        } else if (data?.type === 'SUPPORT_MESSAGE') {
          navigate('App', { screen: 'ChatWithUs' });
        } else if (data?.type === 'NEW_MESSAGE') {
          if (data.senderId) {
            navigate('App', {
              screen: 'ChatScreen',
              params: {
                id: data.senderId,
                name: data.senderName ?? 'Unknown',
                avatar: data.senderAvatar ?? '',
                online: false,
              },
            });
          } else {
            navigate('App', { screen: 'MainTabs', params: { screen: 'Inbox' } });
          }
        } else if (data?.type === 'MONEY_RECEIVED') {
          navigate('App', { screen: 'MainTabs', params: { screen: 'Home' } });
        } else if (data?.type?.includes('PAYMENT_REQUEST')) {
          navigate('App', { screen: 'MainTabs', params: { screen: 'Inbox' } });
        } else {
          navigate('App', { screen: 'MainTabs', params: { screen: 'Inbox' } });
        }
      });
    } catch (e) {
      console.warn('NotificationProvider: Could not initialize notifications', e);
    }

    return () => {
      if (subscription) subscription.remove();
      if (responseSubscription) responseSubscription.remove();
    };
  }, [userToken, completeKYC]);

  useEffect(() => {
    if (userToken === null && prevTokenRef.current !== null) {
      try {
        void Notifications.cancelAllScheduledNotificationsAsync();
        void Notifications.dismissAllNotificationsAsync();
      } catch (e) {
        // Notifications not available on this platform
      }

      const unregister = async () => {
        try {
          const deviceId = await getDeviceId();
          await unregisterFcmToken(deviceId);
        } catch (e) {
          // ignore
        }
      };
      void unregister();
    } else if (userToken !== null) {
      // Trigger initial fetch of notification count via React Query
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount() });
    }
    prevTokenRef.current = userToken;
  }, [userToken]);

  const checkPermissions = async () => {
    try {
      return await Notifications.getPermissionsAsync();
    } catch {
      return { status: 'undetermined' };
    }
  };

  const requestPermissions = async () => {
    try {
      return await Notifications.requestPermissionsAsync();
    } catch {
      return { status: 'undetermined' };
    }
  };

  const registerForNotifications = async () => {
    try {
      const { status: existingStatus } = await checkPermissions();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await requestPermissions();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;
      const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const deviceId = await getDeviceId();
      const deviceName = Device.modelName ?? 'Unknown Device';
      const platform = Platform.OS;
      await registerFcmToken(pushToken, deviceId, deviceName, platform);

      return true;
    } catch (e) {
      console.warn('NotificationProvider: Could not register for notifications', e);
      return false;
    }
  };

  const sendLocalNotification = async (title: string, body: string, data?: any) => {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
        },
        trigger: null,
      });
      return id;
    } catch (error) {
      console.error('Error sending local notification:', error);
      return undefined;
    }
  };

  return (
    <NotificationContext.Provider value={{
      checkPermissions,
      requestPermissions,
      registerForNotifications,
      sendLocalNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
