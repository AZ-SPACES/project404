import React, { ComponentProps } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';

type VerificationMethodProps = (
  | { iconType: 'Feather'; iconName: ComponentProps<typeof Feather>['name'] }
  | { iconType: 'MaterialCommunityIcons'; iconName: ComponentProps<typeof MaterialCommunityIcons>['name'] }
  | { iconType: 'Ionicons'; iconName: ComponentProps<typeof Ionicons>['name'] }
) & {
  title: string;
  description: string;
  securityLevel: string;
  isVerySecure?: boolean;
  onPress?: () => void;
};



export function TwoStepVerificationScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.background === '#121212';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'TwoStepVerification'>>();

  const VerificationMethod = (props: VerificationMethodProps) => {
    const { title, description, securityLevel, isVerySecure, onPress } = props;
    return (
      <TouchableOpacity style={styles.methodRow} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.iconContainer}>
          {props.iconType === 'Feather' && <Feather name={props.iconName} size={24} color={Colors.textPrimary} />}
          {props.iconType === 'MaterialCommunityIcons' && <MaterialCommunityIcons name={props.iconName} size={24} color={Colors.textPrimary} />}
          {props.iconType === 'Ionicons' && <Ionicons name={props.iconName} size={24} color={Colors.textPrimary} />}
        </View>
        <View style={styles.methodInfo}>
          <Text style={[Typography.bodyLg, styles.methodTitle]}>{title}</Text>
          <Text style={[Typography.body, styles.methodDescription]}>{description}</Text>
          <Text style={[Typography.body, styles.securityLevel, isVerySecure ? styles.verySecure : styles.fairlySecure]}>
            {securityLevel}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>2-step verification</Text>
          <Text style={[Typography.bodyLg, styles.mainDescription]}>
            Manage how you complete 2-step verification. It's an extra layer of security on your account, on top of your password.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[Typography.body, styles.sectionLabel]}>Your verification methods</Text>
          <TouchableOpacity>
            <Text style={[Typography.body, { color: Colors.primary, fontWeight: '600' }]}>Change default</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />

        <View style={styles.contentSection}>
          <VerificationMethod 
            iconType="MaterialCommunityIcons"
            iconName="account-group-outline"
            title="Passkeys (default)"
            description="Log in with the more secure face and fingerprint recognition."
            securityLevel="Very secure"
            isVerySecure
          />
          
          <VerificationMethod 
            iconType="Feather"
            iconName="smartphone"
            title="Aza app"
            description="Verify yourself with this app. No need to wait for a text, and you just need an internet connection."
            securityLevel="Very secure"
            isVerySecure
          />

          <VerificationMethod 
            iconType="Ionicons"
            iconName="chatbubble-outline"
            title="Text message"
            description="Receive a verification code by text. You'll need phone signal for this."
            securityLevel="Fairly secure"
          />
        </View>

        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Text style={[Typography.body, styles.sectionLabel]}>Other verification methods</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.contentSection}>
          <TouchableOpacity style={styles.methodRow} activeOpacity={0.7}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="shield-check-outline" size={24} color={Colors.textPrimary} />
            </View>
            <View style={styles.methodInfo}>
              <Text style={[Typography.bodyLg, styles.methodTitle]}>Authenticator app</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingBottom: Spacing.sm },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center' },
  scrollContent: {
    paddingBottom: Spacing.xl },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontSize: 32 },
  mainDescription: {
    color: Colors.textSecondary,
    lineHeight: 24 },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md },
  sectionLabel: {
    color: Colors.textSecondary },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.lg },
  contentSection: {
    paddingHorizontal: Spacing.lg },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md },
  methodInfo: {
    flex: 1 },
  methodTitle: {
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4 },
  methodDescription: {
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4 },
  securityLevel: {
    fontWeight: '600',
    fontSize: 14 },
  verySecure: {
    color: isDark ? Colors.primary : '#1E5128', // Dark green
  },
  fairlySecure: {
    color: Colors.textSecondary } });
}


