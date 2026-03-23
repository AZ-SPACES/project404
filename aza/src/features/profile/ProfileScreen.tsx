import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Colors, Typography, Spacing, Radius } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Profile">;
type IconFamily = 'Feather' | 'Ionicons';

interface SectionItemProps {
  iconFamily: IconFamily;
  iconName: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  hideArrow?: boolean;
}

const SectionItem = ({ iconFamily, iconName, title, subtitle, onPress, hideArrow }: SectionItemProps) => (
  <TouchableOpacity style={styles.sectionItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.iconContainer}>
      {iconFamily === 'Feather' ? (
        <Feather name={iconName as any} size={20} color={Colors.textPrimary} />
      ) : (
        <Ionicons name={iconName as any} size={20} color={Colors.textPrimary} />
      )}
    </View>
    <View style={styles.itemTextContainer}>
      <Text style={[Typography.body, styles.itemTitle]}>{title}</Text>
      {subtitle && <Text style={[Typography.caption, styles.itemSubtitle]}>{subtitle}</Text>}
    </View>
    {!hideArrow && (
      <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
    )}
  </TouchableOpacity>
);

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addAccountButton}>
          <Text style={styles.addAccountText}>Add Account</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <Image 
            source={{ uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSFfKhLo-lRTneqdi08aiU4__DwJKMiL272plVlzySUyn2bhPMYBf49JekzTzcSW3OfCKINbPogZksLGjvSVaPq57Toy6_QunNUSF8jQ&s=10' }} 
            style={styles.profileImage}
          />
          <Text style={[Typography.h2, styles.profileName]}>NAANA AKUFO-ADDO</Text>
          <Text style={[Typography.caption, styles.profileType]}>Personal account</Text>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>My Account</Text>
          <SectionItem iconFamily="Feather" iconName="help-circle" title="Help & Support" />
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Settings</Text>
          <SectionItem iconFamily="Feather" iconName="shield" title="Security and Privacy" subtitle="Change your security and privacy settings" />
          <SectionItem iconFamily="Feather" iconName="bell" title="Notifications" subtitle="Customise how you get updates" />
          <SectionItem 
            iconFamily="Ionicons" 
            iconName="contrast-outline" 
            title="Language and Appearance" 
            subtitle="Customise language and theme settings" 
            onPress={() => navigation.navigate("Appearance")}
          />
          <SectionItem iconFamily="Feather" iconName="user" title="Personal details" subtitle="Update your profile information" />
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Actions and Agreements</Text>
          <SectionItem iconFamily="Feather" iconName="info" title="Terms of Service" />
          <SectionItem iconFamily="Feather" iconName="star" title="Rate us" subtitle="Tell us what you think" />
          <SectionItem 
            iconFamily="Feather" 
            iconName="log-out" 
            title="Sign Out"  
            onPress={() => navigation.navigate("Onboarding")}
          />
        </View>

        {/* Footer spacing */}
        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAccountButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  addAccountText: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.white,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: Spacing.md,
  },
  profileName: {
    textAlign: 'center',
    color: Colors.textPrimary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  profileType: {
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    color: Colors.textPrimary,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    backgroundColor: Colors.white,
  },
  itemTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  itemSubtitle: {
    color: Colors.textSecondary,
    marginTop: 2,
  },
  footerSpace: {
    height: Spacing.xl,
  },
});
