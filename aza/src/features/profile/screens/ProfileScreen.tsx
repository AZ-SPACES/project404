import React, { ComponentProps, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
  Platform,
  Linking } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, AntDesign } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as StoreReview from "expo-store-review";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import Button from "../../../components/ui/Button";
import { useAuth } from "../../../providers/AuthProvider";
import { useProfile } from "../../../providers/ProfileProvider";
import { useToast } from "../../../providers/ToastProvider";

const { height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Profile">;

type SectionItemProps = (
  | { iconFamily: 'Feather'; iconName: ComponentProps<typeof Feather>['name'] }
  | { iconFamily: 'Ionicons'; iconName: ComponentProps<typeof Ionicons>['name'] }
) & {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  hideArrow?: boolean;
};



function SectionItem(props: SectionItemProps) {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { title, subtitle, onPress, hideArrow } = props;
  return (
    <TouchableOpacity style={styles.sectionItem} onPress={onPress} activeOpacity={0.7} accessibilityLabel={title}>
      <View style={styles.iconContainer}>
        {props.iconFamily === 'Feather' ? (
          <Feather name={props.iconName} size={20} color={Colors.textPrimary} />
        ) : (
          <Ionicons name={props.iconName} size={20} color={Colors.textPrimary} />
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
}

export default function ProfileScreen() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { logout } = useAuth();
  const { displayName, profileImageUri, setProfileImage } = useProfile();
  const { showToast } = useToast();

  // Account Type Bottom Sheet
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Profile Photo Bottom Sheet
  const [isPhotoSheetVisible, setPhotoSheetVisible] = useState(false);
  const photoSheetAnim = useRef(new Animated.Value(height)).current;
  const photoBackdropAnim = useRef(new Animated.Value(0)).current;

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
  }, [isBottomSheetVisible, bottomSheetAnim, backdropAnim]);

  useEffect(() => {
    if (isPhotoSheetVisible) {
      Animated.parallel([
        Animated.timing(photoSheetAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true }),
        Animated.timing(photoBackdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(photoSheetAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true }),
        Animated.timing(photoBackdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true }),
      ]).start();
    }
  }, [isPhotoSheetVisible, photoSheetAnim, photoBackdropAnim]);
  

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Camera permission is required to take a photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const { uri, width, height } = result.assets[0];
        const side = Math.min(width, height);
        const originX = (width - side) / 2;
        const originY = (height - side) / 2;
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ crop: { originX, originY, width: side, height: side } }, { resize: { width: 400, height: 400 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        await setProfileImage(manipulated.uri);
        setPhotoSheetVisible(false);
      }
    } catch {
      showToast('Something went wrong while taking the photo.', 'error');
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Media library permission is required to choose a photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets && result.assets[0]) {
        const { uri, width, height } = result.assets[0];
        const side = Math.min(width, height);
        const originX = (width - side) / 2;
        const originY = (height - side) / 2;
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ crop: { originX, originY, width: side, height: side } }, { resize: { width: 400, height: 400 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        await setProfileImage(manipulated.uri);
        setPhotoSheetVisible(false);
      }
    } catch {
      showToast('Something went wrong while selecting the photo.', 'error');
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert(
      "Remove Photo",
      "Are you sure you want to remove your profile photo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await setProfileImage(null);
              setPhotoSheetVisible(false);
            } catch {
              showToast('Could not remove photo. Please try again.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleRateUs = async () => {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      } else {
        const androidPackageName = 'com.semekor.k.aza';
        const itunesItemId = 'YOUR_APP_ID'; // Replace with actual App Store ID when known
        const storeUrl = Platform.OS === 'ios'
          ? `https://apps.apple.com/app/apple-store/id${itunesItemId}?mt=8`
          : `market://details?id=${androidPackageName}`;

        const canOpen = await Linking.canOpenURL(storeUrl);
        if (canOpen) {
          await Linking.openURL(storeUrl);
        } else if (Platform.OS === 'android') {
          await Linking.openURL(`https://play.google.com/store/apps/details?id=${androidPackageName}`);
        } else {
          showToast('Store could not be opened.', 'error');
        }
      }
    } catch {
      showToast('Could not open store. Please try again later.', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
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
          <TouchableOpacity
            onPress={() => setPhotoSheetVisible(true)}
            activeOpacity={0.8}
            style={styles.profileImageContainer}
          >
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.placeholderImage]}>
                <Ionicons name="person" size={50} color={Colors.textSecondary} />
              </View>
            )}
            <View style={styles.editIconContainer}>
              <Ionicons name="camera" size={16} color={Colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={[Typography.h2, styles.profileName]}>
            {displayName || "Your Name"}
          </Text>
          <Text style={[Typography.caption, styles.profileType]}>
            Personal account
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>My Account</Text>
          <SectionItem iconFamily="Feather" iconName="help-circle" title="Help & Support" onPress={() => navigation.navigate("HelpAndSupport")} />
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Settings</Text>
          <SectionItem iconFamily="Feather" iconName="shield" title="Security and Privacy" subtitle="Change your security and privacy settings" onPress={() => navigation.navigate("SecurityAndPrivacy")} />
          <SectionItem 
            iconFamily="Feather" 
            iconName="bell" 
            title="Notifications" 
            subtitle="Customise how you get updates" 
            onPress={() => navigation.navigate("NotificationSettings")}
          />
          <SectionItem 
            iconFamily="Ionicons" 
            iconName="contrast-outline" 
            title="Language and Appearance" 
            subtitle="Customise language and theme settings" 
            onPress={() => navigation.navigate("Appearance")}
          />
          <SectionItem 
            iconFamily="Feather" 
            iconName="user" 
            title="Personal details" 
            subtitle="Update your profile information" 
            onPress={() => navigation.navigate("PersonalDetails")}
          />
        </View>

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Actions and Agreements</Text>
          <SectionItem iconFamily="Feather" iconName="info" title="Terms of Service" onPress={() => navigation.navigate("TermsOfService")}/>
          <SectionItem iconFamily="Feather" iconName="lock" title="Privacy Policy" onPress={() => navigation.navigate("PrivacyPolicy")}/>
          <SectionItem 
            iconFamily="Feather" 
            iconName="star" 
            title="Rate us" 
            subtitle="Tell us what you think" 
            onPress={handleRateUs}
          />
          <SectionItem
            iconFamily="Feather"
            iconName="log-out"
            title="Sign Out"
            onPress={() => {
              Alert.alert(
                "Sign Out",
                "Are you sure you want to sign out?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await logout();
                      } catch {
                        showToast('Sign out failed. Please try again.', 'error');
                      }
                    },
                  },
                ]
              );
            }}
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
              transform: [{ translateY: bottomSheetAnim }] },
          ]}
        >
          <View style={styles.bottomSheetHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setBottomSheetVisible(false)}
            >
              <AntDesign name="close" size={20} color={Colors.textPrimary} />
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

      {/* Profile Photo Bottom Sheet Overlay */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isPhotoSheetVisible ? "auto" : "none"}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: photoBackdropAnim, zIndex: 1000 },
          ]}
        >
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={() => setPhotoSheetVisible(false)}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.bottomSheetContainer,
            {
              zIndex: 1001,
              transform: [{ translateY: photoSheetAnim }] },
          ]}
        >
          <View style={styles.bottomSheetHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setPhotoSheetVisible(false)}
            >
              <AntDesign name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.bottomSheetTitle}>Edit profile photo</Text>
          <View style={styles.bottomSheetDivider} />

          <TouchableOpacity
            style={styles.photoOption}
            onPress={handleTakePhoto}
          >
            <View
              style={[
                styles.photoIconContainer,
                { backgroundColor: Colors.surface },
              ]}
            >
              <Feather name="camera" size={20} color={Colors.textPrimary} />
            </View>
            <Text style={styles.photoOptionText}>Take a photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.photoOption}
            onPress={handleChooseFromLibrary}
          >
            <View
              style={[
                styles.photoIconContainer,
                { backgroundColor: Colors.surface },
              ]}
            >
              <Feather name="image" size={20} color={Colors.textPrimary} />
            </View>
            <Text style={styles.photoOptionText}>Choose from library</Text>
          </TouchableOpacity>

          {profileImageUri && (
            <TouchableOpacity
              style={styles.photoOption}
              onPress={handleRemovePhoto}
            >
              <View
                style={[
                  styles.photoIconContainer,
                  { backgroundColor: "#FEE2E2" },
                ]}
              >
                <Feather name="trash-2" size={20} color="#DC2626" />
              </View>
              <Text style={[styles.photoOptionText, { color: "#DC2626" }]}>
                Remove photo
              </Text>
            </TouchableOpacity>
          )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? Colors.surface : Colors.background,
    justifyContent: 'center',
    alignItems: 'center' },
  addAccountButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg },
  addAccountText: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.white },
  scrollContent: {
    paddingBottom: Spacing.xl },
  profileHeader: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50 },
  profileName: {
    textAlign: "center",
    color: Colors.textPrimary,
    marginBottom: 4,
    textTransform: "uppercase" },
  profileType: {
    color: Colors.textSecondary },
  section: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg },
  sectionTitle: {
    marginBottom: Spacing.md,
    color: Colors.textPrimary },
  sectionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
    backgroundColor: isDark ? Colors.surface : 'white' },
  itemTextContainer: {
    flex: 1,
    justifyContent: "center" },
  itemTitle: {
    color: Colors.textPrimary,
    fontWeight: "500" },
  itemSubtitle: {
    color: Colors.textSecondary,
    marginTop: 2 },
  footerSpace: {
    height: Spacing.xl },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)" },
  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: isDark ? Colors.surface : '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5 },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 16 },
  closeButton: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : "#F3F4F6",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center" },
  bottomSheetTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5 },
  bottomSheetDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 24 },
  activeAccountMessage: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8 },
  profileImageContainer: {
    position: "relative",
    marginBottom: Spacing.md },
  placeholderImage: {
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center" },
  editIconContainer: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.white },
  photoOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8 },
  photoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16 },
  photoOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.textPrimary } });
}


