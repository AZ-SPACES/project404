import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { Colors, Typography, Spacing } from '../../../theme';
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'TroubleLogin'>;

type IssueItem = {
  label: string;
  screen: keyof RootStackParamList;
};

const ISSUES: IssueItem[] = [
  { label: "I've forgotten my password", screen: "ForgotPassword" },
  { label: "2-step verification isn't working", screen: "TwoStepVerificationIssue" },
  { label: "I need to change my phone number", screen: "ChangePhoneNumber" },
  { label: "Logging into a new device", screen: "NewDeviceLogin" },
  { label: "My account was deactivated", screen: "AccountDeactivated" },
];

export default function TroubleLoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const headerBorderOpacity = scrollY.interpolate({
    inputRange: [40, 70],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View
        style={[
          styles.header,
          {
            borderBottomColor: headerBorderOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", Colors.border],
            }),
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Animated.View
          style={[styles.headerTitleContainer, { opacity: headerTitleOpacity }]}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            Trouble logging in
          </Text>
        </Animated.View>
        <View style={{ width: 44 }} />
      </Animated.View>

      <Animated.FlatList
        data={ISSUES}
        contentContainerStyle={styles.scrollContent}
        keyExtractor={(item) => item.label}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Trouble logging in</Text>
            <View style={styles.subHeaderContainer}>
              <Text style={styles.subHeader}>Select an issue</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.issueItem}
            onPress={() => navigation.navigate(item.screen as any)}
          >
            <Text style={styles.issueText}>{item.label}</Text>
            <MaterialIcons name="chevron-right" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: "rgba(22,51,0,0.04)",
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.h1.fontSize,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    letterSpacing: -0.5,
  },
  subHeaderContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  subHeader: {
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
  },
  issueText: {
    fontSize: Typography.bodyLg.fontSize,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
