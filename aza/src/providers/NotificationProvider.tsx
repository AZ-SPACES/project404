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
import { useCallStore } from '../store/callStore';

type NotificationContextType = {
  checkPermissions: () => Promise<Notifications.PermissionResponse | { status: string }>;
  requestPermissions: () => Promise<Notifications.PermissionResponse | { status: string }>;
  registerForNotifications: (requestIfNotGranted?: boolean) => Promise<boolean>;
  sendLocalNotification: (title: string, body: string, data?: Record<string, unknown>) => Promise<string | undefined>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

type CallPushData = {
  callId?: string;
  callerId?: string | null;
  callerName?: string | null;
  callerAvatar?: string | null;
  calleeId?: string | null;
  calleeName?: string | null;
  calleeAvatar?: string | null;
  isVideo?: boolean;
};

/**
 * Push notifications carry less detail than the WS event (no callerId,
 * no avatars, no calleeId). Synthesize a payload good enough for the
 * IncomingCall UI; subsequent SDP/ICE traffic keys off callId only.
 */
function handleIncomingCallPush(data: CallPushData) {
  if (!data?.callId) return;
  const existing = useCallStore.getState().activeCall;
  // Dedupe against WS — both channels can fire while in foreground.
  if (existing && existing.callId === data.callId) return;
  // If a different call is already active, ignore the push; the busy /
  // call-waiting logic lives server-side.
  if (existing) return;

  useCallStore.getState().setIncomingCall({
    callId: data.callId,
    callerId: data.callerId ?? null,
    callerName: data.callerName ?? 'Unknown',
    callerAvatar: data.callerAvatar ?? null,
    calleeId: data.calleeId ?? null,
    calleeName: data.calleeName ?? '',
    calleeAvatar: data.calleeAvatar ?? null,
    type: data.isVideo ? 'VIDEO' : 'VOICE',
    status: 'RINGING',
  });
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken, completeKYC } = useAuth();
  const prevTokenRef = useRef<string | null>(null);

  // Register the chat quick-reply notification category once on mount.
  // iOS: the server must set `category: 'CHAT_MESSAGE'` in the APNS payload.
  // Android: expo-notifications surfaces the action button automatically.
  useEffect(() => {
    Notifications.setNotificationCategoryAsync('CHAT_MESSAGE', [
      {
        identifier: 'QUICK_REPLY',
        buttonTitle: 'Reply',
        textInput: { submitButtonTitle: 'Send', placeholder: 'Reply…' },
        options: { opensAppToForeground: false },
      },
    ]).catch(() => {});
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

      subscription = Notifications.addNotificationReceivedListener((notification) => {
        if (userToken !== null) {
          queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount() });
        }

        const data = notification.request.content.data as Record<string, unknown> | undefined;
        const type = (data?.type as string | undefined) ?? (data?.notification as Record<string, unknown> | undefined)?.type as string | undefined;

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

        if (type === 'INCOMING_CALL') {
          // Foreground push for an incoming call — usually we already
          // received the WS event, in which case handleIncomingCallPush
          // is a no-op. When push beats WS (or WS is down), this is what
          // surfaces the incoming-call UI.
          handleIncomingCallPush(data as CallPushData);
        }

        if (type === 'MONEY_RECEIVED' || type === 'PAYMENT_REQUEST_RECEIVED' || type === 'PAYMENT_REQUEST_PAID') {
          queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }
      });

      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        const type = data?.type as string | undefined;

        // Handle quick-reply action without opening the app
        if ((response as any).actionIdentifier === 'QUICK_REPLY') {
          const replyText = (response as any).userText as string | undefined;
          if (replyText?.trim() && data?.senderId) {
            navigate('App', {
              screen: 'ChatScreen',
              params: {
                id: data.senderId as string,
                name: (data.senderName as string | undefined) ?? 'Unknown',
                avatar: (data.senderAvatar as string | undefined) ?? '',
                online: false,
                quickReply: replyText.trim(),
              },
            });
          }
          return;
        }

        if (type === 'KYC_APPROVED') {
          completeKYC();
        } else if (type === 'LOGIN_APPROVAL') {
          navigate('App', {
            screen: 'AppLoginApproval',
            params: {
              requestId: data?.requestId as string,
              deviceName: (data?.deviceName as string | undefined) ?? 'Unknown device',
              ipAddress: (data?.ipAddress as string | undefined) ?? 'Unknown',
            },
          });
        } else if (type === 'RECOVERY_CONTACT_INVITE') {
          navigate('App', { screen: 'AccountRecoveryContacts' });
        } else if (type === 'RECOVERY_CONTACT_REQUEST') {
          navigate('App', {
            screen: 'GenerateRecoveryCode',
            params: {
              requestId: data?.requestId as string,
              requesterName: (data?.requesterName as string | undefined) ?? 'Someone',
              requesterHandle: data?.requesterHandle as string | undefined,
            },
          });
        } else if (type === 'KYB_APPROVED' || type === 'KYB_REJECTED' || type === 'KYB_MORE_INFO_REQUIRED') {
          navigate('App', { screen: 'Hub' });
        } else if (type === 'KYC_REJECTED') {
          navigate('App', { screen: 'VerifyIdentity', params: {} });
        } else if (type === 'INCOMING_CALL') {
          // Route through the store so we land on IncomingCallScreen with
          // working accept/decline, not directly on the in-call screen
          // (which previously rendered blank because activeCall was null).
          handleIncomingCallPush(data as CallPushData);
        } else if (type === 'MISSED_CALL') {
          navigate('App', { screen: 'MainTabs', params: { screen: 'Inbox' } });
        } else if (type === 'SECURITY_ALERT') {
          navigate('App', { screen: 'SecurityAndPrivacy' });
        } else if (type === 'SUPPORT_MESSAGE') {
          navigate('App', { screen: 'ChatWithUs' });
        } else if (type === 'NEW_MESSAGE') {
          if (data?.senderId) {
            navigate('App', {
              screen: 'ChatScreen',
              params: {
                id: data.senderId as string,
                name: (data.senderName as string | undefined) ?? 'Unknown',
                avatar: (data.senderAvatar as string | undefined) ?? '',
                online: false,
              },
            });
          } else {
            navigate('App', { screen: 'MainTabs', params: { screen: 'Inbox' } });
          }
        } else if (type === 'MONEY_RECEIVED') {
          navigate('App', { screen: 'MainTabs', params: { screen: 'Home' } });
        } else if (typeof type === 'string' && type.includes('PAYMENT_REQUEST')) {
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
      void registerForNotifications(false);
    }
    prevTokenRef.current = userToken;
  }, [userToken]);

  const checkPermissions = async (): Promise<Notifications.PermissionResponse | { status: string }> => {
    try {
      return await Notifications.getPermissionsAsync();
    } catch {
      return { status: 'undetermined' };
    }
  };

  const requestPermissions = async (): Promise<Notifications.PermissionResponse | { status: string }> => {
    try {
      return await Notifications.requestPermissionsAsync();
    } catch {
      return { status: 'undetermined' };
    }
  };

  const registerForNotifications = async (requestIfNotGranted: boolean = true): Promise<boolean> => {
    try {
      const { status: existingStatus } = await checkPermissions();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        if (requestIfNotGranted) {
          const { status } = await requestPermissions();
          finalStatus = status;
        } else {
          return false;
        }
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
        Constants.easConfig?.projectId ??
        Constants.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        console.error(
          '[Push] Cannot register for push notifications: no EAS projectId found.\n' +
          'Add it to app.json under expo.extra.eas.projectId, or run `npx eas-cli init`.'
        );
        return false;
      }

      const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
      const deviceId = await getDeviceId();
      const deviceName = Device.modelName ?? 'Unknown Device';
      const platform = Platform.OS;
      await registerFcmToken(pushToken, deviceId, deviceName, platform);

      return true;
    } catch (e) {
      console.error('NotificationProvider: Could not register for push notifications', e);
      return false;
    }
  };

  const sendLocalNotification = async (
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<string | undefined> => {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, data: data ?? {} },
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
