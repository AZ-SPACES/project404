import React, { ComponentProps, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Switch, Animated, AppState, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../../../providers/NotificationProvider';
import { useAuth } from '../../../providers/AuthProvider';
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { useToast } from '../../../providers/ToastProvider';
import { useProfile } from '../../../providers/ProfileProvider';
import { BackButton } from '../../../components/ui/BackButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "NotificationSettings">;

interface NotificationSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

type NotificationToggleProps = (
  | { iconType: 'Feather'; iconName: ComponentProps<typeof Feather>['name'] }
  | { iconType: 'Ionicons'; iconName: ComponentProps<typeof Ionicons>['name'] }
  | { iconType: 'MaterialCommunityIcons'; iconName: ComponentProps<typeof MaterialCommunityIcons>['name'] }
) & {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

const NotificationSection = ({ title, description, children }: NotificationSectionProps) => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return (
    <View style={styles.section}>
      <Text style={[Typography.h3, styles.sectionTitle]}>{title}</Text>
      <Text style={[Typography.body, styles.sectionDescription]}>{description}</Text>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  );
};

const NotificationToggle = (props: NotificationToggleProps) => {
  const { title, value, onValueChange } = props;
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return (
    <View style={styles.toggleRow}>
      <View style={styles.iconContainer}>
        {props.iconType === 'Feather' && <Feather name={props.iconName} size={20} color={Colors.textPrimary} />}
        {props.iconType === 'Ionicons' && <Ionicons name={props.iconName} size={20} color={Colors.textPrimary} />}
        {props.iconType === 'MaterialCommunityIcons' && <MaterialCommunityIcons name={props.iconName} size={20} color={Colors.textPrimary} />}
      </View>
      <Text style={[Typography.bodyLg, styles.toggleTitle]}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isDark ? Colors.surface : '#E5E7EB', true: Colors.primary }}
        thumbColor={Colors.white}
        ios_backgroundColor={isDark ? Colors.surface : "#E5E7EB"}
        accessibilityRole="switch"
        accessibilityLabel={title}
      />
    </View>
  );
};

type NotificationPreferences = {
  transfersEmail: boolean;
  transfersPush: boolean;
  securityEmail: boolean;
  securityPush: boolean;
  personalisedEmail: boolean;
  personalisedPush: boolean;
  feedbackEmail: boolean;
  feedbackPush: boolean;
  causesEmail: boolean;
  causesPush: boolean;
};

const defaultPreferences: NotificationPreferences = {
  transfersEmail: true,
  transfersPush: true,
  securityEmail: true,
  securityPush: true,
  personalisedEmail: false,
  personalisedPush: false,
  feedbackEmail: true,
  feedbackPush: false,
  causesEmail: false,
  causesPush: false,
};

export default function NotificationSettingsScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { checkPermissions, requestPermissions } = useNotifications();
  const { userToken } = useAuth();
  const { showToast } = useToast();
  const { notificationPreferences, updateNotificationPreferences } = useProfile();
  const prefsKey = userToken ? `@notification_prefs_${userToken}` : '@notification_prefs';

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" 
  });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" 
  });

  const [allowNotifications, setAllowNotifications] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoaded, setIsLoaded] = useState(false);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      const { status } = await checkPermissions() as any;
      if (isMounted) setAllowNotifications(status === 'granted');
    };
    void checkStatus();
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        void checkStatus();
      }
    });
    
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [checkPermissions]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        isSyncingRef.current = true;
        if (notificationPreferences) {
          setPreferences({
            transfersEmail: notificationPreferences.transfersEmail ?? true,
            transfersPush: notificationPreferences.transfersPush ?? true,
            securityEmail: notificationPreferences.securityEmail ?? true,
            securityPush: notificationPreferences.securityPush ?? true,
            personalisedEmail: notificationPreferences.personalisedEmail ?? false,
            personalisedPush: notificationPreferences.personalisedPush ?? false,
            feedbackEmail: notificationPreferences.feedbackEmail ?? true,
            feedbackPush: notificationPreferences.feedbackPush ?? false,
            causesEmail: notificationPreferences.causesEmail ?? false,
            causesPush: notificationPreferences.causesPush ?? false,
          });
        } else {
          const stored = await AsyncStorage.getItem(prefsKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            setPreferences((prev) => ({ ...prev, ...parsed }));
          }
        }
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      } catch (e) {
        showToast('Could not load your notification preferences', 'error');
        isSyncingRef.current = false;
      } finally {
        setIsLoaded(true);
      }
    };
    void loadPreferences();
  }, [notificationPreferences, prefsKey, showToast]);

  useEffect(() => {
    if (!isLoaded || isSyncingRef.current) return;
    
    const savePreferences = async () => {
      try {
        await AsyncStorage.setItem(prefsKey, JSON.stringify(preferences));
        
        try {
          await updateNotificationPreferences(preferences);
        } catch (apiError) {
          console.warn('Failed to sync notification preferences to backend', apiError);
          showToast('Failed to sync preferences to the server. Will retry later.', 'error');
        }
      } catch (e) {
        showToast('Failed to save preferences locally. Please try again.', 'error');
      }
    };

    const timeoutId = setTimeout(() => {
      void savePreferences();
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [preferences, isLoaded, prefsKey, showToast, updateNotificationPreferences]);

  const updatePreference = useCallback(async (key: keyof NotificationPreferences, val: boolean, requiresPushAuth = false) => {
    if (requiresPushAuth && val) {
      const { status } = await checkPermissions() as any;
      if (status !== 'granted') {
        const { status: reqStatus, canAskAgain } = await requestPermissions() as any;
        if (reqStatus === 'granted') {
          setPreferences(prev => ({ ...prev, [key]: true }));
        } else if (!canAskAgain) {
          Alert.alert('Enable Notifications', 'To receive push notifications, please enable them in your device settings.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]);
        }
        return;
      }
    }
    setPreferences(prev => ({ ...prev, [key]: val }));
  }, [checkPermissions, requestPermissions]);

  const handleAllowNotificationsToggle = async (value: boolean) => {
    if (value) {
      const { status } = await checkPermissions() as any;
      if (status !== 'granted') {
        const { status: reqStatus, canAskAgain } = await requestPermissions() as any;
        if (reqStatus === 'granted') {
          setAllowNotifications(true);
        } else if (!canAskAgain) {
          Alert.alert('Enable Notifications', 'Please enable notifications in your device settings.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]);
        }
      } else {
        setAllowNotifications(true);
      }
    } else {
      Alert.alert('Disable Notifications', 'To disable notifications, please switch them off in your device settings.', [
         { text: 'Cancel', style: 'cancel' },
         { text: 'Open Settings', onPress: () => Linking.openSettings() }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      
      <Animated.View 
        style={[
          styles.header,
          {
            borderBottomColor: headerBorderOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", Colors.border] 
            }) 
          }
        ]}
      >
        <BackButton onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')} />
        <Animated.View style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}>
          <Text style={[Typography.h3, styles.headerTitle]}>Notifications</Text>
        </Animated.View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <Animated.ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>Notifications</Text>
          <Text style={[Typography.bodyLg, styles.mainDescription]}>
            Get notified about important updates and spot any suspicious account activity.
          </Text>
        </View>

        <View style={styles.allowSection}>
          <View style={styles.sectionCard}>
            <NotificationToggle
              iconType="Feather"
              iconName="bell"
              title="Allow notifications"
              value={allowNotifications}
              onValueChange={handleAllowNotificationsToggle}
            />
          </View>
        </View>

        <NotificationSection 
          title="Account security" 
          description="Alerts for login, password resets, and changes to your two-step verification."
        >
          <NotificationToggle
            iconType="Feather"
            iconName="mail"
            title="Email"
            value={preferences.securityEmail}
            onValueChange={(val) => updatePreference('securityEmail', val)}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={preferences.securityPush}
            onValueChange={(val) => updatePreference('securityPush', val, true)}
          />
        </NotificationSection>

        <NotificationSection 
          title="Your transfers and balances" 
          description="Notifications about where your money is."
        >
          <NotificationToggle
            iconType="Feather"
            iconName="mail"
            title="Email"
            value={preferences.transfersEmail}
            onValueChange={(val) => updatePreference('transfersEmail', val)}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={preferences.transfersPush}
            onValueChange={(val) => updatePreference('transfersPush', val, true)}
          />
        </NotificationSection>

        <NotificationSection 
          title="Personalised updates" 
          description="Receive updates about the latest features and products."
        >
          <NotificationToggle
            iconType="Feather"
            iconName="mail"
            title="Email"
            value={preferences.personalisedEmail}
            onValueChange={(val) => updatePreference('personalisedEmail', val)}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={preferences.personalisedPush}
            onValueChange={(val) => updatePreference('personalisedPush', val, true)}
          />
        </NotificationSection>

        <NotificationSection 
          title="Invitations to share feedback" 
          description="A chance to share your thoughts, test new products, and earn rewards."
        >
          <NotificationToggle
            iconType="Feather"
            iconName="mail"
            title="Email"
            value={preferences.feedbackEmail}
            onValueChange={(val) => updatePreference('feedbackEmail', val)}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={preferences.feedbackPush}
            onValueChange={(val) => updatePreference('feedbackPush', val, true)}
          />
        </NotificationSection>

        <NotificationSection 
          title="Update on causes we care about" 
          description="Chances to get involved with our charity and fundraising projects."
        >
          <NotificationToggle
            iconType="Feather"
            iconName="mail"
            title="Email"
            value={preferences.causesEmail}
            onValueChange={(val) => updatePreference('causesEmail', val)}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={preferences.causesPush}
            onValueChange={(val) => updatePreference('causesPush', val, true)}
          />
        </NotificationSection>

        <View style={styles.footerInfo}>
          <Text style={[Typography.body, styles.footerText]}>
            Some things we'll always need to tell you about — like changes to our T&Cs.
          </Text>
        </View>
        
        <View style={styles.spacer} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors.background 
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1 
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: Colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
      borderWidth: 1,
      borderColor: Colors.border
    },
    headerTitleContainer: {
      flex: 1,
      alignItems: 'center' 
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary 
    },
    scrollContent: {
      paddingBottom: Spacing.xl 
    },
    titleSection: {
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      marginBottom: Spacing.xl 
    },
    mainTitle: {
      color: Colors.textPrimary,
      marginBottom: Spacing.sm 
    },
    mainDescription: {
      color: Colors.textSecondary,
      lineHeight: 24 
    },
    allowSection: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl 
    },
    section: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.xl 
    },
    sectionTitle: {
      color: Colors.textPrimary,
      fontSize: 18,
      marginBottom: 4 
    },
    sectionDescription: {
      color: Colors.textSecondary,
      marginBottom: Spacing.lg 
    },
    sectionCard: {
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      padding: Spacing.md,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: Radius.sm,
      backgroundColor: isDark ? Colors.background : '#F3F4F6',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md 
    },
    toggleTitle: {
      flex: 1,
      color: Colors.textPrimary 
    },
    footerInfo: {
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.md 
    },
    footerText: {
      color: Colors.textSecondary,
      lineHeight: 20 
    },
    spacer: {
      height: Spacing.xl 
    } 
  });
}
