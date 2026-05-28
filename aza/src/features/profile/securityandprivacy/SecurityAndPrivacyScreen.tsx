import React, { ComponentProps, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Switch, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import { AntDesign } from '@react-native-vector-icons/ant-design';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../providers/AuthProvider';
import { useProfile } from '../../../providers/ProfileProvider';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { CloseButton } from '../../../components/ui/CloseButton';

const { height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SecurityAndPrivacy">;



type SettingRowProps = (
  | { iconType: 'Feather'; iconName: ComponentProps<typeof Feather>['name'] }
  | { iconType: 'Ionicons'; iconName: ComponentProps<typeof Ionicons>['name'] }
  | { iconType: 'MaterialCommunityIcons'; iconName: ComponentProps<typeof MaterialCommunityIcons>['name'] }
) & {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
};

function SettingRow(props: SettingRowProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { title, subtitle, onPress, showSwitch, switchValue, onSwitchChange } = props;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={showSwitch}
      activeOpacity={0.7}
      accessibilityLabel={title}
    >
      <View style={styles.iconContainer}>
        {props.iconType === 'Feather' && <Feather name={props.iconName} size={20} color={Colors.textPrimary} />}
        {props.iconType === 'Ionicons' && <Ionicons name={props.iconName} size={20} color={Colors.textPrimary} />}
        {props.iconType === 'MaterialCommunityIcons' && <MaterialCommunityIcons name={props.iconName} size={20} color={Colors.textPrimary} />}
      </View>
      <View style={styles.textContainer}>
        <Text style={[Typography.body, styles.rowTitle]}>{title}</Text>
        {subtitle && <Text style={[Typography.caption, styles.rowSubtitle]}>{subtitle}</Text>}
      </View>
      {showSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: isDark ? Colors.surface : '#E5E7EB', true: Colors.primary }}
          thumbColor={Colors.white}
          ios_backgroundColor={isDark ? Colors.surface : "#E5E7EB"}
          accessibilityRole="switch"
          accessibilityLabel={title}
        />
      ) : (
        <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
}

export function SecurityAndPrivacyScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { isBiometricsEnabled, toggleBiometrics } = useAuth();
  const profile = useProfile();
  const navigation = useNavigation<NavigationProp>();
  const scrollY = React.useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      profile.fetchProfile();
    }, [profile.fetchProfile])
  );

  // State for bottom sheet
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isBottomSheetVisible) {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true }),
      ]).start();
    }
  }, [isBottomSheetVisible]);

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp" });

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
        <BackButton onPress={() => navigation.goBack()} />
        <Animated.View style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}>
          <Text style={[Typography.h3, styles.headerTitle]}>Security and privacy</Text>
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
          <Text style={[Typography.h1, styles.mainTitle]}>Security and privacy</Text>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Security</Text>
          
          <SettingRow 
            iconType="Feather" 
            iconName="shield" 
            title="Password" 
            onPress={() => navigation.navigate("ChangePassword")}
          />
          
          <SettingRow 
            iconType="MaterialCommunityIcons" 
            iconName="fingerprint" 
            title="2-step verification" 
            subtitle={profile.twoFactorEnabled ? "Status: On" : "Status: Off"}
            onPress={() => navigation.navigate("TwoStepVerification")}
          />
          
          <SettingRow 
            iconType="Feather" 
            iconName="smartphone" 
            title="Devices" 
            subtitle="Manage your devices"
            onPress={() => navigation.navigate("Devices")}
          />
          
          <SettingRow 
            iconType="MaterialCommunityIcons" 
            iconName="face-recognition" 
            title="App security" 
            subtitle={isBiometricsEnabled ? "Require Face ID for login, transactions and after 5 minutes of inactivity" : "Require Passcode for login, transactions and after 5 minutes of inactivity"}
            onPress={() => setBottomSheetVisible(true)}
          />
          
          <SettingRow 
            iconType="Feather" 
            iconName="log-out" 
            title="Log out everywhere" 
            subtitle="Use if you've logged in on a public device or lost your phone"
            onPress={() => navigation.navigate("LogoutEverywhere")}
          />
          
          <SettingRow 
            iconType="Feather" 
            iconName="lock" 
            title="Secure your account" 
            subtitle="Use in the case of a stolen phone or suspicious transactions"
            onPress={() => navigation.navigate("SecureAccount")}
          />
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Privacy</Text>
          
          <SettingRow 
            iconType="Feather" 
            iconName="search" 
            title="Find me by" 
            subtitle="Choose how people on Aza can find your account"
            onPress={() => navigation.navigate("FindMeBy")}
          />

          
          <SettingRow 
            iconType="Feather" 
            iconName="mail" 
            title="Bill forwarding email" 
            subtitle="Set up an email to receive bills and invoices. Received files will be set up as draft payments to review"
            onPress={() => navigation.navigate("BillForwardingIntro")}
          />


          <SettingRow
            iconType="Ionicons" 
            iconName="id-card-outline" 
            title="Biometric data" 
            subtitle="Allow Aza to store and use your selfie and ID for automated verification"
            showSwitch
            switchValue={profile.biometricData}
            onSwitchChange={(v) => profile.updateProfile({ biometricData: v })}
          />
          
          <SettingRow 
            iconType="Feather" 
            iconName="info" 
            title="Privacy policy" 
            subtitle="Learn how we protect and use your personal information"
            onPress={() => navigation.navigate("PrivacyPolicy")}
          />

          <SettingRow 
            iconType="Feather" 
            iconName="trash-2" 
            title="Delete account" 
            subtitle="Permanently delete your Aza account and data"
            onPress={() => navigation.navigate("DeleteAccount")}
          />
        </View>
        
        <View style={styles.spacer} />
      </Animated.ScrollView>

      {/* App Security Bottom Sheet */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isBottomSheetVisible ? "auto" : "none"}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: backdropAnim, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)' }]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setBottomSheetVisible(false)}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.bottomSheetContainer,
            {
              zIndex: 1001,
              transform: [{ translateY: bottomSheetAnim }] },
          ]}
        >
          <View style={styles.bottomSheetHeader}>
            <Text style={[Typography.h2, styles.bottomSheetTitle]}>App security</Text>
            <CloseButton onPress={() => setBottomSheetVisible(false)} />
          </View>
          
          <TouchableOpacity style={styles.bottomSheetItem} activeOpacity={0.7} onPress={() => { toggleBiometrics(!isBiometricsEnabled); setBottomSheetVisible(false); }}>
            <View style={styles.bottomSheetIconContainer}>
              <Ionicons name="grid-outline" size={24} color={Colors.textPrimary} />
            </View>
            <View style={styles.bottomSheetTextContainer}>
              <Text style={[Typography.bodyLg, styles.bottomSheetItemTitle]}>{isBiometricsEnabled ? "Switch to passcode" : "Switch to biometrics"}</Text>
              <Text style={[Typography.body, styles.bottomSheetItemSubtitle]}>For unlocking this app when you haven't used it for 5 minutes</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
      </View>
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
    borderBottomWidth: 1,
    height: 60 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
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
    color: Colors.textPrimary },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: Spacing.sm },
  rowTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4 },
  rowSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20 },
  spacer: {
    height: Spacing.xl },
  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5 },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24 },
  bottomSheetTitle: {
    color: Colors.textPrimary },
  closeButton: {
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center" },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md },
  bottomSheetIconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md },
  bottomSheetTextContainer: {
    flex: 1 },
  bottomSheetItemTitle: {
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4 },
  bottomSheetItemSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20 } });
}


