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
import { Ionicons, Feather } from "@expo/vector-icons";
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

const Tab = createBottomTabNavigator();

export default function MainTabsNavigator() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const handleTabPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
      screenListeners={{
        tabPress: handleTabPress,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size || 24} color={color} />
          ),
          tabBarAccessibilityLabel: "Home Tab",
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarLabel: "Contacts",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size || 24} color={color} />
          ),
          tabBarAccessibilityLabel: "Contacts Tab",
        }}
      />

      <Tab.Screen
        name="ScanTab"
        component={ScanScreen}
        options={{
          tabBarLabel: "",
          tabBarButton: (props: any) => (
            <View
              style={styles.centerButtonWrapper}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                onPress={(e) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  props.onPress?.(e);
                }}
                accessibilityRole="button"
                accessibilityLabel="Scan QR Code"
                accessibilityState={props.accessibilityState}
                style={styles.centerButton}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={26}
                  color={Colors.white}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Chat"
        component={ChatContactsScreen}
        options={{
          tabBarLabel: "Chat",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="chatbubble-outline"
              size={size || 24}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: "Chat Tab",
        }}
      />
      <Tab.Screen
        name="Hub"
        component={HubScreen}
        options={{
          tabBarLabel: "Hub",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="apps-outline" size={size || 24} color={color} />
          ),
          tabBarAccessibilityLabel: "Hub Tab",
        }}
      />
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
