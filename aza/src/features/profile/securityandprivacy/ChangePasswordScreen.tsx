import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';
import { isValidPassword, getPasswordRules } from '../../../utils/validation';
import { usePreventScreenCapture } from '../../../hooks/usePreventScreenCapture';

export function ChangePasswordScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChangePassword'>>();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  usePreventScreenCapture();
  const rules = getPasswordRules(newPassword);
  const isFormValid = currentPassword.trim().length > 0 && isValidPassword(newPassword);

  const handleUpdatePassword = async () => {
    if (!isFormValid) return;
    setIsLoading(true);
    try {
      // TODO: call change-password API, then navigate on success
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar 
        barStyle={Colors.background === '#121212' ? 'light-content' : 'dark-content'} 
        backgroundColor={Colors.background} 
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.titleSection}>
            <Text style={[Typography.h1, styles.mainTitle]}>Change password</Text>
          </View>

          <View style={styles.contentSection}>
            <View style={styles.warningBox}>
              <View style={styles.warningTextContainer}>
                <Text style={[Typography.body, styles.warningText]}>
                  We will never send you a temporary password by phone, email or text message. When changing your password, always use something that's only known by you.
                </Text>
              </View>
              <View style={styles.warningIconContainer}>
                <MaterialCommunityIcons name="alert-circle" size={24} color="#FBBF24" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[Typography.body, styles.label]}>Current password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  placeholder=""
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                  <Feather name={showCurrentPassword ? "eye-off" : "eye"} size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[Typography.body, styles.label]}>New password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  onBlur={() => setNewPasswordTouched(true)}
                  secureTextEntry={!showNewPassword}
                  placeholder=""
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                  <Feather name={showNewPassword ? "eye-off" : "eye"} size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {newPasswordTouched && newPassword.length > 0 && (
                <View style={styles.rulesContainer}>
                  {rules.map((r) => (
                    <Text key={r.label} style={[styles.ruleText, r.met ? styles.ruleMet : styles.ruleUnmet]}>
                      {r.met ? '✓' : '✗'} {r.label}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Change password"
            onPress={handleUpdatePassword}
            backgroundColor={Colors.primary}
            textColor={Colors.secondary}
            borderRadius={Radius.full}
            disabled={!isFormValid || isLoading}
            loading={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === '#121212';
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors.background
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
      justifyContent: 'center',
      alignItems: 'center'
    },
    scrollContent: {
      paddingBottom: Spacing.xl
    },
    titleSection: {
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      marginBottom: Spacing.xl
    },
    mainTitle: {
      color: Colors.textPrimary,
      ...Typography.h1,
      fontSize: 32,
    },
    contentSection: {
      paddingHorizontal: Spacing.lg
    },
    warningBox: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1C1C1E' : '#F9FAF7',
      padding: Spacing.md,
      borderRadius: Radius.lg,
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: isDark ? '#2C2C2E' : Colors.border
    },
    warningIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? '#2D2D1E' : '#FEF3C7',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.sm
    },
    warningTextContainer: {
      flex: 1
    },
    warningText: {
      color: Colors.textPrimary,
      ...Typography.body,
      lineHeight: 20
    },
    inputGroup: {
      marginBottom: Spacing.xl
    },
    label: {
      ...Typography.body,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: Spacing.sm
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      height: 56,
      backgroundColor: isDark ? Colors.surface : Colors.white
    },
    input: {
      flex: 1,
      ...Typography.bodyLg,
      color: Colors.textPrimary
    },
    rulesContainer: {
      marginTop: 8,
      gap: 2,
    },
    ruleText: {
      fontSize: 12,
    },
    ruleMet: {
      color: '#22C55E',
    },
    ruleUnmet: {
      color: '#D1222E',
    },
    footer: {
      padding: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      backgroundColor: Colors.background
    }
  });
}


