import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from '../../../providers/NotificationProvider';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import Button from '../../../components/ui/Button';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EnableNotification'>;

type EnableNotificationsProps = {
  onComplete?: () => void;
};

export default function EnableNotificationsScreen({ onComplete }: EnableNotificationsProps) {
  const { colors: Colors } = useAppTheme();
  const isDark = Colors.isDark;
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const { checkPermissions, registerForNotifications, sendLocalNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const handleFinish = useCallback(() => {
    if (onComplete) {
      onComplete();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onComplete]);

  useEffect(() => {
    let isMounted = true;
    const checkInitialStatus = async () => {
      try {
        const { status } = await checkPermissions() as any;
        if (status === 'granted' && isMounted) {
          handleFinish();
        }
      } catch (error) {
        console.error('Error checking notification status:', error);
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    void checkInitialStatus();
    return () => { isMounted = false; };
  }, [checkPermissions, handleFinish]);

  const handleClose = () => {
    handleFinish();
  };

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const granted = await registerForNotifications();

      if (granted) {
        await sendLocalNotification(
          "Welcome to Aza!",
          "You'll now receive updates about your spending and security."
        );
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setIsLoading(false);
      handleFinish();
    }
  };

  const handleNotNow = () => {
    handleFinish();
  };

  if (isChecking) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
        <View style={styles.loadingContainer}>
          {/* Subtle loading state or just empty while checking */}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <AntDesign name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Don't miss a beat.</Text>
        <Text style={styles.description}>
          Get notified about spending, security, wealth, market movements, discounts and deals, so you’re always in the know.
        </Text>

        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/bell.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerInfo}>
          You can turn off notifications anytime in settings.
        </Text>
        
        <Button
          title="Enable push notifications"
          onPress={() => void handleEnable()}
          backgroundColor={Colors.primary}
          textColor={Colors.secondary}
          style={styles.button}
          loading={isLoading}
          disabled={isLoading}
        />
        
        <View style={styles.spacer} />
        
        <Button
          title="Not now"
          onPress={handleNotNow}
          backgroundColor={Colors.surface}
          textColor={Colors.textPrimary}
          style={styles.buttonOutline}
        />
      </View>
    </SafeAreaView>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background 
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center' 
    },
    header: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm 
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center' 
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md 
    },
    title: {
      ...Typography.h1,
      color: Colors.textPrimary,
      marginBottom: Spacing.md 
    },
    description: {
      ...Typography.bodyLg,
      color: Colors.textSecondary,
      lineHeight: 24 
    },
    imageContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center' 
    },
    image: {
      width: '80%',
      height: '60%' 
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg 
    },
    footerInfo: {
      ...Typography.body,
      color: Colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.lg 
    },
    button: {
      borderRadius: Radius.md 
    },
    buttonOutline: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    spacer: {
      height: Spacing.md 
    } 
  });
}
