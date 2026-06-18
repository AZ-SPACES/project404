import React from "react";
import { Platform, ImageSourcePropType } from "react-native";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";
import type { AppleIcon } from "react-native-bottom-tabs";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { HomeScreen } from "../features/home";
import { HubScreen } from "../features/hub";
import { ContactsScreen } from "../features/contacts";
import { ScanScreen } from "../features/scan";
import { ChatContactsScreen } from "../features/chat";
import { ThemeColors } from "../theme";

/**
 * True OS-native bottom tab bar (UITabBar on iOS, BottomNavigationView on
 * Android) via react-native-bottom-tabs. Isolated in its own module so it is
 * only evaluated when the user actually picks "native" — keeping the native
 * dependency out of the bundle's eager-eval path on builds without the module.
 */
const NativeTab = createNativeBottomTabNavigator();

// Per-tab metadata: SF Symbol (iOS) + an Ionicons raster (Android, via
// getImageSourceSync — the native bar can't take a vector node).
const NATIVE_META: Record<string, { name: string; component: React.ComponentType<any>; label: string; sf: string; ion: string }> = {
  home:     { name: "HomeTab",  component: HomeScreen,         label: "Home",     sf: "house",           ion: "home-outline" },
  contacts: { name: "Contacts", component: ContactsScreen,     label: "Contacts", sf: "person",          ion: "person-outline" },
  scan:     { name: "ScanTab",  component: ScanScreen,         label: "Scan",     sf: "qrcode",          ion: "qr-code-outline" },
  chat:     { name: "Chat",     component: ChatContactsScreen, label: "Chat",     sf: "bubble.left",     ion: "chatbubble-outline" },
  hub:      { name: "Hub",      component: HubScreen,          label: "Hub",      sf: "square.grid.2x2", ion: "apps-outline" },
};

function nativeIconFor(key: string) {
  const m = NATIVE_META[key]!;
  return () =>
    Platform.OS === "ios"
      ? ({ sfSymbol: m.sf } as AppleIcon)
      : (Ionicons.getImageSourceSync(m.ion as any, 24, "#000000") as ImageSourcePropType);
}

export default function NativeMainTabs({ colors, order }: { colors: ThemeColors; order: string[] }) {
  return (
    <NativeTab.Navigator 
      translucent={true}
      sidebarAdaptable={true}
      screenOptions={{ 
        tabBarActiveTintColor: colors.primary,
      }}
    >
      {order.map((key) => {
        const m = NATIVE_META[key]!;
        return (
          <NativeTab.Screen
            key={key}
            name={m.name}
            component={m.component}
            options={{ title: m.label, tabBarIcon: nativeIconFor(key) }}
          />
        );
      })}
    </NativeTab.Navigator>
  );
}
