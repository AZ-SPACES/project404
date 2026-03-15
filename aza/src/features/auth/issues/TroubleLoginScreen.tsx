import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Trouble logging in</Text>
        <View style={styles.subHeaderContainer}>
          <Text style={styles.subHeader}>Select an issue</Text>
        </View>
        <FlatList
          data={ISSUES}
          keyExtractor={(item) => item.label}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.issueItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Text style={styles.issueText}>{item.label}</Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 50,
    backgroundColor: "rgba(22,51,0,0.04)",
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
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
