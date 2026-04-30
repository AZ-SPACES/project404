import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from './AuthProvider';
import { registerFcmToken, unregisterFcmToken, getDeviceId } from '../services/api';

type NotificationContextType = {
  checkPermissions: () => Promise<any>;
  requestPermissions: () => Promise<any>;
  registerForNotifications: () => Promise<boolean>;
  sendLocalNotification: (title: string, body: string, data?: any) => Promise<string | undefined>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken } = useAuth();
  const prevTokenRef = useRef<string | null>(null);
  const notificationsAvailable = useRef(false);

  useEffect(() => {
    // Dynamically require to avoid boot-time side-effects in Expo Go
    try {
      const Notifications = require('expo-notifications');
      if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        notificationsAvailable.current = true;
      }
    } catch (e) {
      console.warn('NotificationProvider: Could not initialize notifications', e);
    }
  }, []);

  // Cancel local notifications and unregister FCM token on logout
  useEffect(() => {
    if (userToken === null && prevTokenRef.current !== null) {
      if (notificationsAvailable.current) {
        try {
          const Notifications = require('expo-notifications');
          Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
          Notifications.dismissAllNotificationsAsync().catch(() => {});
        } catch (e) {
          // Notifications not available on this platform
        }
      }
      getDeviceId().then((deviceId) => unregisterFcmToken(deviceId)).catch(() => {});
    }
    prevTokenRef.current = userToken;
  }, [userToken]);

  const checkPermissions = async () => {
    try {
      const Notifications = require('expo-notifications');
      return await Notifications.getPermissionsAsync();
    } catch {
      return { status: 'undetermined' };
    }
  };

  const requestPermissions = async () => {
    try {
      const Notifications = require('expo-notifications');
      return await Notifications.requestPermissionsAsync();
    } catch {
      return { status: 'undetermined' };
    }
  };

  const registerForNotifications = async () => {
    try {
      const Notifications = require('expo-notifications');
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
      const Notifications = require('expo-notifications');
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
      sendLocalNotification 
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
