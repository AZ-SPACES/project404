import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Switch, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "NotificationSettings">;

interface NotificationSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

interface NotificationToggleProps {
  iconName: string;
  iconType?: 'Feather' | 'Ionicons' | 'MaterialCommunityIcons';
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}



export function NotificationSettingsScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.background === '#121212';
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();

  const NotificationSection = ({ title, description, children }: NotificationSectionProps) => (
    <View style={styles.section}>
      <Text style={[Typography.h3, styles.sectionTitle]}>{title}</Text>
      <Text style={[Typography.body, styles.sectionDescription]}>{description}</Text>
      {children}
    </View>
  );

  const NotificationToggle = ({ iconName, iconType = 'Feather', title, value, onValueChange }: NotificationToggleProps) => (
    <View style={styles.toggleRow}>
      <View style={styles.iconContainer}>
        {iconType === 'Feather' ? (
          <Feather name={iconName as any} size={20} color={Colors.textPrimary} />
        ) : (
          <Ionicons name={iconName as any} size={20} color={Colors.textPrimary} />
        )}
      </View>
      <Text style={[Typography.bodyLg, styles.toggleTitle]}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isDark ? Colors.surface : '#E5E7EB', true: Colors.primary }}
        thumbColor={Colors.white}
        ios_backgroundColor={isDark ? Colors.surface : "#E5E7EB"}
      />
    </View>
  );

  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const [allowNotifications, setAllowNotifications] = useState(true);
  const [transfersEmail, setTransfersEmail] = useState(true);
  const [transfersPush, setTransfersPush] = useState(true);
  const [personalisedEmail, setPersonalisedEmail] = useState(false);
  const [personalisedPush, setPersonalisedPush] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState(true); 
  const [causesEmail, setCausesEmail] = useState(false);

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
          onPress={() => navigation.goBack()}
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
            iconName="bell"
            title="Allow notifications"
            value={allowNotifications}
            onValueChange={setAllowNotifications}
          />
        </View>

        <NotificationSection 
          title="Your transfers and balances" 
          description="Notifications about where your money is."
        >
          <NotificationToggle
            iconName="mail"
            title="Email"
            value={transfersEmail}
            onValueChange={setTransfersEmail}
          />
          <NotificationToggle
            iconName="smartphone"
            title="Push"
            value={transfersPush}
            onValueChange={setTransfersPush}
          />
        </NotificationSection>

        <NotificationSection 
          title="Personalised updates" 
          description="Receive updates about the latest Wise products and features."
        >
          <NotificationToggle
            iconName="mail"
            title="Email"
            value={personalisedEmail}
            onValueChange={setPersonalisedEmail}
          />
          <NotificationToggle
            iconName="smartphone"
            title="Push"
            value={personalisedPush}
            onValueChange={setPersonalisedPush}
          />
        </NotificationSection>

        <NotificationSection 
          title="Invitations to share feedback" 
          description="A chance to share your thoughts, test new products, and earn rewards."
        >
          <NotificationToggle
            iconName="mail"
            title="Email"
            value={feedbackEmail}
            onValueChange={setFeedbackEmail}
          />
        </NotificationSection>

        <NotificationSection 
          title="Update on causes we care about" 
          description="Chances to get involved with our charity and fundraising projects."
        >
          <NotificationToggle
            iconName="mail"
            title="Email"
            value={causesEmail}
            onValueChange={setCausesEmail}
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
  const isDark = Colors.background === '#121212';
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


