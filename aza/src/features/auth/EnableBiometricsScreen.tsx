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
import type { RootStackParamList } from '../../navigation/AppNavigator';
import Button from '../../components/Button';
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
    alert('Set up biometrics');
    // For now, let's just go back or to the next screen
    navigation.goBack();
  };

  const handleNotNow = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Make logging in faster with biometrics</Text>
        <Text style={styles.description}>
          Add an extra layer of security to your aza app
        </Text>

        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/faceid.png')}
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
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
    paddingBottom: Spacing.xl,
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
