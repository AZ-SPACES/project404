import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, StatusBar, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import Button from '../../components/ui/Button';

const { height } = Dimensions.get('window');

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
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isBottomSheetVisible) {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isBottomSheetVisible, bottomSheetAnim, backdropAnim]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addAccountButton} onPress={() => setBottomSheetVisible(true)}>
          <Text style={styles.addAccountText}>Open an Account</Text>
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
          <SectionItem iconFamily="Feather" iconName="help-circle" title="Help & Support" onPress={() => navigation.navigate("HelpAndSupport")} />
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
      {/* Bottom Sheet Overlay */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isBottomSheetVisible ? "auto" : "none"}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: backdropAnim, zIndex: 1000 }]}
        >
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={() => setBottomSheetVisible(false)}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.bottomSheetContainer,
            {
              zIndex: 1001,
              transform: [{ translateY: bottomSheetAnim }],
            },
          ]}
        >
          <View style={styles.bottomSheetHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setBottomSheetVisible(false)}
            >
              <AntDesign name="close" size={20} color="#0E0F0C" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.bottomSheetTitle}>Which account type would you like?</Text>
          
          <View style={styles.bottomSheetDivider} />

          <Button
            title="Personal account"
            onPress={() => {
              setBottomSheetVisible(false);
            }}
            backgroundColor="#1E5128"
            textColor="#B7ED7E"
            borderRadius={24}
            disabled
          />
          <Text style={styles.activeAccountMessage}>You already have a personal account</Text>
          
          <View style={{ height: 16 }} />
          
          <Button
            title="Business account"
            onPress={() => {
              setBottomSheetVisible(false);
              // Handle business account selection
            }}
            backgroundColor="#B7ED7E"
            textColor="#1E5128"
            borderRadius={24}
          />
        </Animated.View>
      </View>
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
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 16,
  },
  closeButton: {
    backgroundColor: "#F3F4F6",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomSheetTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0E0F0C",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  bottomSheetDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 24,
  },
  activeAccountMessage: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
