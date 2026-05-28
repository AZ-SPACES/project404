import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Share, Linking, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme, ThemeColors, Spacing, Radius } from '../../../theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useProfile } from '../../../providers/ProfileProvider';
import { useToast } from '../../../providers/ToastProvider';
import { api } from '../../../services/api';
import { BackButton } from '../../../components/ui/BackButton';

const { width } = Dimensions.get('window');

const MyCodeScreen = ({ onToggle }: { onToggle: () => void }) => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { displayName, profileImageUri, handle } = useProfile();
  const { showToast } = useToast();
  const userHandle = handle || "username";
  // Universal link that opens SendAmount with this handle pre-filled.
  // Matches the linking config in App.tsx: `pay/:identifier`.
  const profileLink = `https://aza.systems/pay/${userHandle}`;

  // Ref on the QR card view so we can rasterize it into a PNG for sharing.
  const shareCardRef = useRef<View>(null);

  const shareMessage = `Pay ${displayName || `@${userHandle}`} on Aza: ${profileLink}`;

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Try to attach the QR image alongside the link.
    let imageUri: string | null = null;
    try {
      imageUri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
    } catch {
      imageUri = null;
    }

    if (imageUri) {
      // iOS: RN Share happily attaches the file via `url` AND keeps the message.
      // Android: RN's Share drops `url`, so route image+text via expo-sharing instead.
      if (Platform.OS === 'ios') {
        try {
          await Share.share({
            message: shareMessage,
            url: imageUri,
            title: `Pay me on Aza`,
          });
          return;
        } catch {
          // fall through to expo-sharing
        }
      }
      const available = await Sharing.isAvailableAsync().catch(() => false);
      if (available) {
        try {
          await Sharing.shareAsync(imageUri, {
            mimeType: 'image/png',
            UTI: 'public.png',
            dialogTitle: shareMessage,
          });
          return;
        } catch {
          // fall through to text-only share
        }
      }
    }

    // Fallback: link-only share (also the path on Android with no Sharing module).
    try {
      await Share.share({ message: shareMessage });
    } catch {
      showToast('Could not open share sheet. Please try again.', 'error');
    }
  };

  const handleAddToAppleWallet = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await api.get(`/api/v1/wallet/apple/${userHandle}`);
      const passUrl: string | undefined = res.data?.data?.url;
      if (passUrl) {
        await Linking.openURL(passUrl);
      } else {
        showToast('Unable to generate Apple Wallet pass.', 'error');
      }
    } catch {
      showToast('Unable to generate Apple Wallet pass.', 'error');
    }
  };

  const handleAddToGoogleWallet = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Replace with endpoint containing the JWT link for Google Wallet
    // const googlePassUrl = `https://api.aza.systems/wallet/google/${userHandle}`;
    // await Linking.openURL(googlePassUrl).catch(() => {
    //   showToast('Unable to open Google Wallet.', 'error');
    // });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header */}
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconCircle}>
              <Feather name="shield" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.iconCircle}>
              <Feather name="upload" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* User Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{displayName || 'Your Name'}</Text>
              <View style={styles.handleBadge}>
                <Text style={styles.userHandle}>@{userHandle}</Text>
              </View>
            </View>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatar} accessibilityLabel="Profile photo" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
          </View>

          {/* Main QR Content */}
          <View style={styles.mainContent}>
            {/* The ref groups the QR card + link line so the captured image
                already includes the printed link beneath the code. */}
            <View ref={shareCardRef} collapsable={false} style={styles.shareableArea}>
              <View style={styles.qrCard}>
                <View style={styles.qrWrapper}>
                  <Image
                    source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(profileLink)}` }}
                    style={styles.qrImage}
                  />
                  <View style={styles.qrLogoContainer}>
                    <Image source={require('../../../assets/aza-z.png')} style={styles.qrLogo} />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.copyLinkContainer}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  // Add Clipboard.setString here if needed
                }}
              >
                <Text style={styles.getPaidText}>
                  Get paid at <Text style={styles.linkText}>{profileLink}</Text>
                </Text>
                <Feather name="copy" size={14} color={Colors.textSecondary} style={{marginLeft: 6}} />
              </TouchableOpacity>
            </View>

            {/* Wallet Integration Section */}
            <View style={styles.walletContainer}>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity onPress={handleAddToAppleWallet}>
                  <Image source={require('../../../assets/wallet/applewallet.png')} style={styles.wallet} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.walletButton} onPress={handleAddToGoogleWallet}>
                  <Image source={require('../../../assets/wallet/google_wallet.png')} style={styles.walletIcon} />
                  <Text style={styles.walletButtonText}>Add to Google Wallet</Text>
                  <View style={styles.betaBadge}>
                    <Text style={styles.betaText}>BETA</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Toggle - Positioned within Safe Area for better padding */}
        <View style={styles.bottomNav}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={onToggle}
            >
              <Text style={styles.toggleTextInactive}>Scan</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.toggleButton, styles.activeToggleButton]}
              activeOpacity={1}
            >
              <Text style={styles.toggleTextActive}>My code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    height: 60 },
  backButton: {
    padding: Spacing.xs,
    marginLeft: -Spacing.sm },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center' },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? Colors.surface : Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    // Soft shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2 },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md },
  profileInfo: {
    flex: 1 },
  userName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5 },
  handleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4 },
  userHandle: {
    fontSize: 14,
    color: isDark ? Colors.primary : '#174717', 
    fontWeight: '700' },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.white },
  avatarPlaceholder: {
    backgroundColor: Colors.surface },
  mainContent: {
    alignItems: 'center',
    paddingTop: Spacing.xs },
  shareableArea: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md },
  qrCard: {
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: Spacing.lg },
  qrWrapper: {
    justifyContent: 'center',
    alignItems: 'center' },
  qrImage: {
    width: width * 0.65,
    height: width * 0.65 },
  qrLogoContainer: {
    position: 'absolute',
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 12 },
  qrLogo:{
    width: 44,
    height: 52 },
  copyLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? Colors.surface : Colors.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border },
  getPaidText: {
    fontSize: 14,
    color: Colors.textSecondary },
  linkText: {
    color: Colors.textPrimary,
    fontWeight: '700' },
  walletContainer: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: width * 0.65, // Match QR card aesthetic 
  },
  wallet: {
    width: 180,
    height: 50,
  },
  walletIcon: {
    width: 32,
    height: 32,
  },
  walletButtonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  betaBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  betaText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  bottomNav: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center' 
  },
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.full,
    width: 240,
    backgroundColor: isDark ? Colors.surface : '#E9E9E9',
   },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: Radius.full },
  activeToggleButton: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3 },
  toggleTextActive: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary },
  toggleTextInactive: {
    fontSize: 15,
    fontWeight: '600',
    color: isDark ? Colors.textSecondary : '#8E8E93' } });
}

export default MyCodeScreen;