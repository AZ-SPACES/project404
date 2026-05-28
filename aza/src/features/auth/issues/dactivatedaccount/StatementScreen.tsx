import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../navigation/types';
import {  useAppTheme, ThemeColors, Typography, Spacing, Radius  } from '../../../../theme';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { BackButton } from '../../../../components/ui/BackButton';


type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Statement'>;
export default function Statement() {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} size={28} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>I want a statement for my account</Text>
        <Text style={styles.subtitle}>
          If your account has been deactivated and you would like a statement for your account, you can reach out to us. Click the link below to speak with one of our team.
        </Text>

        <TouchableOpacity style={styles.helpButton} onPress={() => navigation.navigate('TalkToUs')}>
            <Text style={styles.helpText}>I still need help</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: isDark ? Colors.white10 : "rgba(22,51,0,0.04)",
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
  helpButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  helpText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
}


