import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import Button from '../../components/ui/Button';
import { Colors, Typography, Spacing, Radius } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EnableBiometrics'>;

export default function EnableBiometricsScreen() {
  const navigation = useNavigation<NavigationProp>();

  const handleClose = () => {
    navigation.goBack();
  };

  const handleSetup = () => {
    // Logic to Set up biometrics
    console.log('Set up biometrics');
    // Proceed to identity verification check after biometric setup
    navigation.navigate('VerifyIdentity', { isPEP: false });
  };

  const handleNotNow = () => {
    navigation.navigate('VerifyIdentity', { isPEP: false });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <AntDesign name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Make logging in faster with biometrics</Text>
        <Text style={styles.description}>
          Add an extra layer of security to your aza app
        </Text>

        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/biometric.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Set up biometrics"
          onPress={handleSetup}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          style={styles.button}
        />
        
        <View style={styles.spacer} />
        
        <Button
          title="Not now"
          onPress={handleNotNow}
          backgroundColor={Colors.secondary}
          textColor={Colors.primary}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.bodyLg,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '80%',
    height: '60%',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  button: {
    borderRadius: Radius.full,
  },
  spacer: {
    height: Spacing.md,
  },
});
