import React, { ComponentProps, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Switch, Animated, AppState, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../../../providers/NotificationProvider';
import { useAuth } from '../../../providers/AuthProvider';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import { useToast } from '../../../providers/ToastProvider';
import { useProfile } from '../../../providers/ProfileProvider';

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
      {children}
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

  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const [allowNotifications, setAllowNotifications] = useState(false);
  const [transfersEmail, setTransfersEmail] = useState(true);
  const [transfersPush, setTransfersPush] = useState(true);
  const [securityEmail, setSecurityEmail] = useState(true);
  const [securityPush, setSecurityPush] = useState(true);
  const [personalisedEmail, setPersonalisedEmail] = useState(false);
  const [personalisedPush, setPersonalisedPush] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState(true); 
  const [feedbackPush, setFeedbackPush] = useState(false);
  const [causesEmail, setCausesEmail] = useState(false);
  const [causesPush, setCausesPush] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isSyncingRef = React.useRef(false);

  useEffect(() => {
    const checkStatus = async () => {
      const { status } = await checkPermissions() as any;
      setAllowNotifications(status === 'granted');
    };
    checkStatus();
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkStatus();
      }
    });
    
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = notificationPreferences;
        isSyncingRef.current = true;
        if (prefs) {
          setTransfersEmail(prefs.transfersEmail ?? true);
          setTransfersPush(prefs.transfersPush ?? true);
          setSecurityEmail(prefs.securityEmail ?? true);
          setSecurityPush(prefs.securityPush ?? true);
          setPersonalisedEmail(prefs.personalisedEmail ?? false);
          setPersonalisedPush(prefs.personalisedPush ?? false);
          setFeedbackEmail(prefs.feedbackEmail ?? true);
          setFeedbackPush(prefs.feedbackPush ?? false);
          setCausesEmail(prefs.causesEmail ?? false);
          setCausesPush(prefs.causesPush ?? false);
        } else {
          // Fallback to AsyncStorage if profile hasn't loaded yet
          const stored = await AsyncStorage.getItem(prefsKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            setTransfersEmail(parsed.transfersEmail ?? true);
            setTransfersPush(parsed.transfersPush ?? true);
            setSecurityEmail(parsed.securityEmail ?? true);
            setSecurityPush(parsed.securityPush ?? true);
            setPersonalisedEmail(parsed.personalisedEmail ?? false);
            setPersonalisedPush(parsed.personalisedPush ?? false);
            setFeedbackEmail(parsed.feedbackEmail ?? true);
            setFeedbackPush(parsed.feedbackPush ?? false);
            setCausesEmail(parsed.causesEmail ?? false);
            setCausesPush(parsed.causesPush ?? false);
          }
        }
        // Small delay to ensure state updates are processed before we allow saving
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
    loadPreferences();
  }, [notificationPreferences, prefsKey]);

  useEffect(() => {
    if (!isLoaded || isSyncingRef.current) return;
    
    const savePreferences = async () => {
      try {
        const prefs = { 
          transfersEmail, transfersPush, 
          securityEmail, securityPush,
          personalisedEmail, personalisedPush, 
          feedbackEmail, feedbackPush, 
          causesEmail, causesPush 
        };
        await AsyncStorage.setItem(prefsKey, JSON.stringify(prefs));
        
        try {
          await updateNotificationPreferences(prefs);
        } catch (apiError) {
          console.warn('Failed to sync notification preferences to backend', apiError);
          showToast('Failed to sync preferences to the server. Will retry later.', 'error');
        }
      } catch (e) {
        showToast('Failed to save preferences locally. Please try again.', 'error');
      }
    };

    // Debounce the save to prevent multiple rapid API calls
    const timeoutId = setTimeout(savePreferences, 1000);
    return () => clearTimeout(timeoutId);
  }, [
    transfersEmail, transfersPush, 
    securityEmail, securityPush,
    personalisedEmail, personalisedPush, 
    feedbackEmail, feedbackPush, 
    causesEmail, causesPush, 
    isLoaded,
    prefsKey
  ]);

  const togglePushPreference = async (setter: (val: boolean) => void, currentVal: boolean) => {
    if (!currentVal) {
      
      const { status } = await checkPermissions() as any;
      if (status !== 'granted') {
        const { status: reqStatus, canAskAgain } = await requestPermissions() as any;
        if (reqStatus === 'granted') {
          setter(true);
        } else if (!canAskAgain) {
          Alert.alert('Enable Notifications', 'To receive push notifications, please enable them in your device settings.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]);
        }
      } else {
        setter(true);
      }
    } else {
      setter(false);
    }
  };

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
              outputRange: ["transparent", Colors.border] }) }
        ]}
      >
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')}
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
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
          <NotificationToggle
            iconType="Feather"
            iconName="bell"
            title="Allow notifications"
            value={allowNotifications}
            onValueChange={handleAllowNotificationsToggle}
          />
        </View>

        <NotificationSection 
          title="Account security" 
          description="Alerts for login, password resets, and changes to your two-step verification."
        >
          <NotificationToggle
            iconType="Feather"
            iconName="mail"
            title="Email"
            value={securityEmail}
            onValueChange={setSecurityEmail}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={securityPush}
            onValueChange={(val) => togglePushPreference(setSecurityPush, securityPush)}
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
            value={transfersEmail}
            onValueChange={setTransfersEmail}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={transfersPush}
            onValueChange={(val) => togglePushPreference(setTransfersPush, transfersPush)}
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
            value={personalisedEmail}
            onValueChange={setPersonalisedEmail}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={personalisedPush}
            onValueChange={(val) => togglePushPreference(setPersonalisedPush, personalisedPush)}
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
            value={feedbackEmail}
            onValueChange={setFeedbackEmail}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={feedbackPush}
            onValueChange={(val) => togglePushPreference(setFeedbackPush, feedbackPush)}
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
            value={causesEmail}
            onValueChange={setCausesEmail}
          />
          <NotificationToggle
            iconType="Feather"
            iconName="smartphone"
            title="Push"
            value={causesPush}
            onValueChange={(val) => togglePushPreference(setCausesPush, causesPush)}
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
    backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1 },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center' },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary },
  scrollContent: {
    paddingBottom: Spacing.xl },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary,
    marginBottom: Spacing.sm },
  mainDescription: {
    color: Colors.textSecondary,
    lineHeight: 24 },
  allowSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    marginBottom: 4 },
  sectionDescription: {
    color: Colors.textSecondary,
    marginBottom: Spacing.lg },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md },
  toggleTitle: {
    flex: 1,
    color: Colors.textPrimary },
  footerInfo: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md },
  footerText: {
    color: Colors.textSecondary,
    lineHeight: 20 },
  spacer: {
    height: Spacing.xl } });
}


