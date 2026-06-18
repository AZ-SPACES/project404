import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  TurboModuleRegistry,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Feather } from '@react-native-vector-icons/feather';
import { HomeScreen } from "../features/home";
import { HubScreen } from "../features/hub";
import { ContactsScreen } from "../features/contacts";
import { ScanScreen } from "../features/scan";
import { ChatContactsScreen } from "../features/chat";
import {
  useAppTheme,
  ThemeColors,
  Typography,
  Spacing,
  Radius,
} from "../theme";
import { useDisplayContext, TabId } from "../providers/DisplayProvider";

const Tab = createBottomTabNavigator();

// Is react-native-bottom-tabs' native code in THIS binary? Its view (RNCTabView)
// otherwise renders a "Unimplemented component" placeholder rather than throwing,
// so an error boundary can't catch it — we must check before rendering. The
// library's SvgDecoder TurboModule is registered alongside the native view, so
// its presence is a reliable, non-throwing proxy.
let nativeTabsAvailable: boolean | null = null;
function isNativeTabsAvailable(): boolean {
  if (nativeTabsAvailable === null) {
    try {
      nativeTabsAvailable = TurboModuleRegistry.get('SvgDecoder') != null;
    } catch {
      nativeTabsAvailable = false;
    }
  }
  return nativeTabsAvailable;
}

// If the native tab module isn't in the running binary (e.g. an OTA reached an
// older build), fall back to the JS default bar instead of crashing.
class NativeTabsBoundary extends React.Component<
  { fallback: React.ReactElement; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function MainTabsNavigator() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { tabBarStyle, tabIconStyle, tabOrder, mainTabNav } = useDisplayContext();
  const showLabels = tabBarStyle === 'labeled';
  const filled = tabIconStyle === 'filled';

  const handleTabPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const renderTab = (id: TabId) => {
    switch (id) {
      case 'home':
        return (
          <Tab.Screen key="home" name="HomeTab" component={HomeScreen}
            options={{ tabBarLabel: "Home", tabBarAccessibilityLabel: "Home Tab",
              tabBarIcon: ({ color, size }) => <Ionicons name={filled ? "home" : "home-outline"} size={size || 24} color={color} /> }} />
        );
      case 'contacts':
        return (
          <Tab.Screen key="contacts" name="Contacts" component={ContactsScreen}
            options={{ tabBarLabel: "Contacts", tabBarAccessibilityLabel: "Contacts Tab",
              tabBarIcon: ({ color, size }) => <Feather name="user" size={size || 24} color={color} /> }} />
        );
      case 'chat':
        return (
          <Tab.Screen key="chat" name="Chat" component={ChatContactsScreen}
            options={{ tabBarLabel: "Chat", tabBarAccessibilityLabel: "Chat Tab",
              tabBarIcon: ({ color, size }) => <Ionicons name={filled ? "chatbubble" : "chatbubble-outline"} size={size || 24} color={color} /> }} />
        );
      case 'hub':
        return (
          <Tab.Screen key="hub" name="Hub" component={HubScreen}
            options={{ tabBarLabel: "Hub", tabBarAccessibilityLabel: "Hub Tab",
              tabBarIcon: ({ color, size }) => <Ionicons name={filled ? "apps" : "apps-outline"} size={size || 24} color={color} /> }} />
        );
    }
  };

  // First 2 tabs go left of Scan, last 2 go right
  const leftTabs  = tabOrder.slice(0, 2);
  const rightTabs = tabOrder.slice(2);

  // Default style: React Navigation's JS bottom bar — Scan becomes a regular tab
  // (no floating button), styling left to RN defaults. Also the native fallback.
  const defaultTabs = (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
      }}
      screenListeners={{ tabPress: handleTabPress }}
    >
      {leftTabs.map(renderTab)}
      <Tab.Screen
        name="ScanTab"
        component={ScanScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarAccessibilityLabel: 'Scan Tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={filled ? 'qr-code' : 'qr-code-outline'} size={size || 24} color={color} />
          ),
        }}
      />
      {rightTabs.map(renderTab)}
    </Tab.Navigator>
  );

  if (mainTabNav === 'default') return defaultTabs;

  // True OS-native tab bar (UITabBar / BottomNavigationView). The module is
  // required lazily so the native dependency never evaluates on builds without
  // it; if that fails (or the native view can't mount) we fall back to default.
  if (mainTabNav === 'native' && isNativeTabsAvailable()) {
    let NativeMainTabs: React.ComponentType<{ colors: ThemeColors; order: string[] }> | null = null;
    try {
      NativeMainTabs = require('./NativeMainTabs').default;
    } catch {
      NativeMainTabs = null;
    }
    if (NativeMainTabs) {
      return (
        <NativeTabsBoundary fallback={defaultTabs}>
          <NativeMainTabs colors={Colors} order={[...leftTabs, 'scan', ...rightTabs]} />
        </NativeTabsBoundary>
      );
    }
  }
  // 'native' selected but the native module isn't in this build → default bar.
  if (mainTabNav === 'native') return defaultTabs;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarShowLabel: showLabels,
        tabBarIconStyle: showLabels ? undefined : { marginBottom: 0 },
      }}
      screenListeners={{ tabPress: handleTabPress }}
    >
      {leftTabs.map(renderTab)}

      <Tab.Screen
        name="ScanTab"
        component={ScanScreen}
        options={{
          tabBarLabel: "",
          tabBarButton: (props: any) => (
            <View style={styles.centerButtonWrapper} pointerEvents="box-none">
              <TouchableOpacity
                onPress={(e) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); props.onPress?.(e); }}
                accessibilityRole="button"
                accessibilityLabel="Scan QR Code"
                accessibilityState={props.accessibilityState}
                style={styles.centerButton}
                activeOpacity={0.8}
              >
                <Ionicons name="qr-code-outline" size={26} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {rightTabs.map(renderTab)}
    </Tab.Navigator>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === "#121212";
  return StyleSheet.create({
    dummyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.background,
    },
    dummyText: {
      color: Colors.textSecondary,
    },
    tabBar: {
      backgroundColor: Colors.background,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      paddingTop: Spacing.sm,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarLabel: {
      ...Typography.caption,
      fontWeight: "500",
      paddingBottom: Platform.OS === "android" ? Spacing.sm : 0,
    },
    centerButtonWrapper: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    centerButton: {
      position: "absolute",
      top: -24,
      width: 64,
      height: 64,
      borderRadius: Radius.full,
      backgroundColor: Colors.primary,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 4,
      borderColor: Colors.background,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
    },
  });
}
