import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
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

export default function MainTabsNavigator() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { tabBarStyle, tabIconStyle, tabOrder } = useDisplayContext();
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
