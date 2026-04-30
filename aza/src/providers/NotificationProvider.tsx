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

  useEffect(() => {
    // Dynamically require to avoid boot-time side-effects in Expo Go Android
    try {
      const Notifications = require('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (e) {
      console.warn('NotificationProvider: Could not initialize notifications', e);
    }
  }, []);

  // Cancel local notifications and unregister FCM token on logout
  useEffect(() => {
    if (userToken === null && prevTokenRef.current !== null) {
      try {
        const Notifications = require('expo-notifications');
        Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
        Notifications.dismissAllNotificationsAsync().catch(() => {});
      } catch (e) {
        // Notifications not available on this platform
      }
      getDeviceId().then((deviceId) => unregisterFcmToken(deviceId)).catch(() => {});
    }
    prevTokenRef.current = userToken;
  }, [userToken]);

  const checkPermissions = async () => {
    const Notifications = require('expo-notifications');
    return await Notifications.getPermissionsAsync();
  };

  const requestPermissions = async () => {
    const Notifications = require('expo-notifications');
    return await Notifications.requestPermissionsAsync();
  };

  const registerForNotifications = async () => {
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

    try {
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
    } catch (e) {
      console.warn('NotificationProvider: Could not register push token', e);
    }

    return true;
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
