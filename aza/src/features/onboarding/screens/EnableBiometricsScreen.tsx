import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../providers/AuthProvider';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { biometricEnroll, getDeviceId, BIOMETRIC_TOKEN_KEY } from '../../../services/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EnableBiometrics'>;

type EnableBiometricsProps = {
  onComplete?: () => void;
};

export default function EnableBiometricsScreen({ onComplete }: EnableBiometricsProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { toggleBiometrics, getPasscodeValue } = useAuth();
  const [isBiometricAvailable, setIsBiometricAvailable] = React.useState<boolean | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleFinish = React.useCallback(() => {
    if (onComplete) {
      onComplete();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onComplete]);

  React.useEffect(() => {
    async function checkAvailability() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricAvailable(hasHardware && isEnrolled);
      } catch (e) {
        setIsBiometricAvailable(false);
      }
    }
    checkAvailability();
  }, []);

  const handleClose = () => {
    handleFinish();
  };

  const handleSetup = async () => {
    if (isBiometricAvailable === false) {
      handleFinish();
      return;
    }
    setIsLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login for aza',
        disableDeviceFallback: true,
      });

      if (result.success) {
        const passcode = await getPasscodeValue();
        if (!passcode) {
          Alert.alert('Error', 'Passcode not found. Please set your passcode first.');
          return;
        }
        const deviceId = await getDeviceId();
        const deviceName = Device.modelName ?? 'Unknown Device';
        const deviceOs = Device.osName ?? 'Unknown OS';
        const response = await biometricEnroll(passcode, deviceId, deviceName, deviceOs);
        const payload = response.data?.data ?? response.data;
        await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, payload.biometricToken);
        toggleBiometrics(true);
        handleFinish();
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An error occurred while setting up biometrics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotNow = () => {
    handleFinish();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
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
            source={require('../../../assets/biometric.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={isBiometricAvailable === false ? "Continue" : "Set up biometrics"}
          onPress={handleSetup}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          style={styles.button}
          loading={isLoading}
          disabled={isLoading}
        />
        
        {isBiometricAvailable !== false && (
          <>
            <View style={styles.spacer} />
            <Button
              title="Not now"
              onPress={handleNotNow}
              backgroundColor={Colors.secondary}
              textColor={Colors.primary}
              style={styles.button}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? Colors.white10 : 'rgba(22, 51, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center' },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.md },
  description: {
    ...Typography.bodyLg,
    color: Colors.textSecondary,
    lineHeight: 24 },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center' },
  image: {
    width: '80%',
    height: '60%' },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg },
  button: {
    borderRadius: Radius.md },
  spacer: {
    height: Spacing.md } });
}
