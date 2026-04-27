import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing } from '../../../theme';
import { getMiniApp } from '../miniapps/registry';

type PlayerRouteProp = RouteProp<RootStackParamList, 'MiniApp'>;
type PlayerNavProp = NativeStackNavigationProp<RootStackParamList, 'MiniApp'>;

const HEADER_HEIGHT = 52;

export default function MiniAppPlayerScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<PlayerNavProp>();
  const route = useRoute<PlayerRouteProp>();
  const { appId } = route.params;
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [menuVisible, setMenuVisible] = React.useState(false);

  const app = getMiniApp(appId);

  const handleClose = () => navigation.goBack();

  const toggleMenu = () => {
    const toValue = menuVisible ? 0 : 1;
    setMenuVisible(!menuVisible);
    Animated.spring(menuAnim, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      await Share.share({ message: `Check out ${app?.name} on Aza!` });
    } catch {}
  };

  const handleReport = () => {
    setMenuVisible(false);
    Alert.alert('Report', 'Thank you for your feedback. We will review this mini app.');
  };

  if (!app) {
    return (
      <SafeAreaView style={styles.notFoundSafeArea} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Mini app not found.</Text>
          <TouchableOpacity onPress={handleClose} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const MiniAppComponent = app.component;

  const menuTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });
  const menuOpacity = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} />

      {/* ── WeChat-style header ── */}
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          {/* Close */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleClose}
            accessibilityLabel="Close mini app"
            accessibilityRole="button"
          >
            <Feather name="x" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* App identity */}
          <View style={styles.headerCenter}>
            <View style={[styles.headerIcon, { backgroundColor: app.color }]}>
              <Text style={styles.headerIconEmoji}>{app.icon}</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>{app.name}</Text>
          </View>

          {/* Options */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={toggleMenu}
            accessibilityLabel="More options"
            accessibilityRole="button"
          >
            <Feather name="more-horizontal" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Divider */}
      <View style={styles.divider} />

      {/* ── Mini app content ── */}
      <View style={styles.content}>
        <MiniAppComponent onClose={handleClose} />
      </View>

      {/* ── Dropdown menu ── */}
      {menuVisible && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => { setMenuVisible(false); }}
            activeOpacity={1}
          />
          <Animated.View
            style={[
              styles.menu,
              { opacity: menuOpacity, transform: [{ translateY: menuTranslateY }] },
            ]}
          >
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Feather name="share-2" size={18} color={Colors.textPrimary} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
              <Feather name="flag" size={18} color={Colors.error} />
              <Text style={[styles.menuItemText, { color: Colors.error }]}>Report</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    notFoundSafeArea: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    headerSafeArea: {
      backgroundColor: Colors.background,
    },
    header: {
      height: HEADER_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      backgroundColor: Colors.background,
    },
    headerBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    headerIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIconEmoji: {
      fontSize: 16,
    },
    headerTitle: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
    },
    content: {
      flex: 1,
    },
    // Dropdown menu
    menu: {
      position: 'absolute',
      top: 96,
      right: Spacing.md,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      minWidth: 160,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 8,
      zIndex: 100,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
    },
    menuItemText: {
      ...Typography.body,
      color: Colors.textPrimary,
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
      marginHorizontal: Spacing.md,
    },
    // Error state
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
    },
    errorText: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
    errorButton: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    errorButtonText: {
      ...Typography.body,
      color: Colors.primary,
      fontWeight: '600',
    },
  });
}
