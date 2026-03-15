import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Button from '../../../components/Button';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>I've forgotten my password</Text>
        <Text style={styles.subtitle}>
          If you're logged out and can't remember your password, <Text style={styles.boldText}>we can send you an email with a link to reset it.</Text>
        </Text>

        <View style={styles.buttonContainer}>
           <Button
              title="Reset password"
              onPress={() => {navigation.navigate("ResetPassword")}}
              backgroundColor={Colors.primary}
              textColor={Colors.secondary}
              borderRadius={30} // completely rounded
              paddingVertical={16}
              fontSize={Number(Typography.button.fontSize)}
              fontWeight={Typography.button.fontWeight as any}
            />
        </View>

        <TouchableOpacity style={styles.helpButton}>
            <Text style={styles.helpText}>I still need help</Text>
        </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  buttonContainer: {
    marginBottom: Spacing.lg,
  },
  helpButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  helpText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
