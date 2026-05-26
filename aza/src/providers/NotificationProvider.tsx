import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthProvider';
import { registerFcmToken, unregisterFcmToken, getDeviceId, getUnreadNotificationCount } from '../services/api';
import { navigate } from '../navigation/navigationRef';

type NotificationContextType = {
  checkPermissions: () => Promise<any>;
  requestPermissions: () => Promise<any>;
  registerForNotifications: () => Promise<boolean>;
  sendLocalNotification: (title: string, body: string, data?: any) => Promise<string | undefined>;
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken, completeKYC } = useAuth();
  const prevTokenRef = useRef<string | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadNotificationCount();
      if (response.data?.data?.unreadCount !== undefined) {
        setUnreadCount(response.data.data.unreadCount);
      }
    } catch (e) {
      console.warn('NotificationProvider: Could not fetch unread count', e);
    }
  }, []);

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
          void fetchUnreadCount();
        }

        const data = notification.request.content.data;
        const type = data?.type || data?.notification?.type;

        if (type === 'KYC_APPROVED') {
          completeKYC();
        }

        // Refresh contacts when a friend request is accepted or a new request is received
        if (
          type === 'CONTACT_REQUEST_ACCEPTED' ||
          type === 'CONTACT_ACCEPTED' ||
          type === 'FRIEND_REQUEST_ACCEPTED' ||
          type === 'CONTACT_REQUEST_RECEIVED' ||
          type === 'FRIEND_REQUEST'
        ) {
          try {
            const { useContactStore } = require('../store/contactStore');
            const store = useContactStore.getState();
            void store.fetchContacts();
            void store.fetchContactRequests();
          } catch (_) {
            // contactStore may not be ready yet
          }
        }
      });

      responseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response.notification.request.content.data;

        if (data?.type === 'KYC_APPROVED') {
          completeKYC();
        } else if (data?.type === 'KYB_APPROVED' || data?.type === 'KYB_REJECTED' || data?.type === 'KYB_MORE_INFO_REQUIRED') {
          navigate('App', { screen: 'Hub' });
        } else if (data?.type === 'MONEY_RECEIVED' || data?.type === 'MONEY_REQUESTED') {
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
  }, [userToken, completeKYC, fetchUnreadCount]);

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
      setUnreadCount(0);
    } else if (userToken !== null) {
      void fetchUnreadCount();
    }
    prevTokenRef.current = userToken;
  }, [userToken, fetchUnreadCount]);

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
      unreadCount,
      fetchUnreadCount
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
