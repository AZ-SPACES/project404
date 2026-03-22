import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { HomeScreen } from '../features/home';
import { Colors, Typography, Spacing, Radius } from '../theme';

const Tab = createBottomTabNavigator();

// Dummy screen for inactive tabs
const DummyScreen = () => (
  <View style={styles.dummyContainer}>
    <Text style={[Typography.h3, styles.dummyText]}>Coming Soon</Text>
  </View>
);

export default function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen} 
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size || 24} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Recipients" 
        component={DummyScreen} 
        options={{
          tabBarLabel: 'Recipients',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size || 24} color={color} />
          ),
        }}
      />
      
      {/* Center Scan/Grid Button */}
      <Tab.Screen 
        name="ScanTab" 
        component={DummyScreen} 
        options={{
          tabBarLabel: '',
          tabBarButton: ({ onPress, accessibilityState, accessibilityLabel }) => (
            // A custom wrapper completely extracting the button from the flex flow
            <View style={styles.centerButtonWrapper} pointerEvents="box-none">
              <TouchableOpacity 
                onPress={onPress}
                accessibilityState={accessibilityState}
                accessibilityLabel={accessibilityLabel}
                style={styles.centerButton} 
                activeOpacity={0.9}
              >
                <Ionicons name="grid-outline" size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Chat" 
        component={DummyScreen} 
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size || 24} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Manage" 
        component={DummyScreen} 
        options={{
          tabBarLabel: 'Manage',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="apps-outline" size={size || 24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  dummyContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: Colors.white,
  },
  dummyText: {
    color: Colors.textSecondary,
  },
  tabBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarLabel: {
    ...Typography.caption,
    fontWeight: '500',
    paddingBottom: Platform.OS === 'android' ? Spacing.sm : 0,
  },
  centerButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    position: 'absolute',
    top: -24, 
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary, 
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
});
