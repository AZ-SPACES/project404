import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
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

const isIOS = Platform.OS === "ios";
const Tab = isIOS ? createNativeBottomTabNavigator() : createBottomTabNavigator();

export default function MainTabsNavigator() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        ...(isIOS
          ? {
              tabBarControllerMode: "tabBar",
              tabBarStyle: {
                backgroundColor: Colors.background,
              },
            }
          : {
              tabBarStyle: styles.tabBar,
              tabBarLabelStyle: styles.tabBarLabel,
            }),
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: (isIOS
            ? { type: "sfSymbol", name: "house" }
            : ({ color, size }: { color: string; size: number }) => (
                <Ionicons name="home-outline" size={size || 24} color={color} />
              )) as any,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarLabel: "Contacts",
          tabBarIcon: (isIOS
            ? { type: "sfSymbol", name: "person" }
            : ({ color, size }: { color: string; size: number }) => (
                <Feather name="user" size={size || 24} color={color} />
              )) as any,
        }}
      />

      <Tab.Screen
        name="ScanTab"
        component={ScanScreen}
        options={isIOS ? {
          tabBarLabel: "Scan",
          tabBarIcon: { type: "sfSymbol", name: "qrcode.viewfinder" },
        } : {
          tabBarLabel: "",
          tabBarButton: (props: any) => (
            <View
              style={styles.centerButtonWrapper}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                onPress={props.onPress ?? undefined}
                accessibilityState={props.accessibilityState}
                accessibilityLabel={props.accessibilityLabel}
                style={styles.centerButton}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={24}
                  color={Colors.white}
                />
              </TouchableOpacity>
            </View>
          ),
        } as any}
      />

      <Tab.Screen
        name="Chat"
        component={ChatContactsScreen}
        options={{
          tabBarLabel: "Chat",
          tabBarIcon: (isIOS
            ? { type: "sfSymbol", name: "bubble.left" }
            : ({ color, size }: { color: string; size: number }) => (
                <Ionicons
                  name="chatbubble-outline"
                  size={size || 24}
                  color={color}
                />
              )) as any,
        }}
      />
      <Tab.Screen
        name="Hub"
        component={HubScreen}
        options={{
          tabBarLabel: "Hub",
          tabBarIcon: (isIOS
            ? { type: "sfSymbol", name: "square.grid.2x2" }
            : ({ color, size }: { color: string; size: number }) => (
                <Ionicons name="apps-outline" size={size || 24} color={color} />
              )) as any,
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
