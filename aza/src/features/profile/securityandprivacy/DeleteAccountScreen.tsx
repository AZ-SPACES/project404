import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Pressable, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, Typography, Spacing,} from '../../../theme';
import { useAuth } from '../../../providers/AuthProvider';
import { deleteAccount } from '../../../services/api';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DeleteAccount'>;

const { width, height } = Dimensions.get('window');

export function DeleteAccountScreen() {
  const { colors: Colors } = useAppTheme();
   const isDark = Colors.isDark;
  const navigation = useNavigation<NavigationProp>();
  const { logout } = useAuth();
  
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Progress from 0 to 1 for holding the button
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Progress from 0 to 1 for the screen expanding circle
  const expandAnim = useRef(new Animated.Value(0)).current;
  
  const holdDuration = 2000; // 2 seconds to hold

  const handlePressIn = () => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: holdDuration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setIsDeleting(true);

        const animPromise = new Promise((resolve) => {
          // Start expand animation
          Animated.timing(expandAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }).start(resolve);
        });

        const deletePromise = deleteAccount().catch(e => {
          console.error("Failed to delete account:", e);
        });

        Promise.all([animPromise, deletePromise]).then(() => {
          logout();
        });
      }
    });
  };

  const handlePressOut = () => {
    if (!isDeleting) {
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  const buttonWidth = width - Spacing.lg * 2;
  const redFillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, buttonWidth],
  });
  
  // To cover the screen, scale up a circle
  // Max dimension needed is the diagonal of the screen
  const maxDimension = Math.max(width, height) * 1.5;
  const circleSize = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxDimension],
  });
  
  const circleRadius = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxDimension / 2],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <TouchableOpacity onPress={navigation.goBack} style={[styles.backButton, { backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)" }]}>
          <MaterialIcons name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.textContainer}>
          <Image 
            source={require('../../../assets/delete_emoji.png')} 
            style={{ width: 200, height: 150, marginBottom: Spacing.xl }} 
            resizeMode="contain"
          />
          <Text style={[Typography.h1, { color: Colors.textPrimary }]}>
            leaving, huh<Text style={{ color: '#EF4444' }}>?</Text>
          </Text>
          
          <Text style={[Typography.h3, styles.subtitle, { color: Colors.textSecondary }]}>
            okay. one thing first.
          </Text>
          
          <Text style={[Typography.bodyLg, styles.description, { color: Colors.textSecondary }]}>
            this deletes every account, every transaction, every category — and there's no bringing them back.
          </Text>
        </View>

        <Pressable 
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.buttonContainer}
        >
          {/* Background of the button */}
          <View style={[styles.buttonBase, { backgroundColor: '#FEE2E2', width: buttonWidth }]}>
            {/* Red filling background */}
            <Animated.View style={[styles.buttonFill, { backgroundColor: '#EF4444', width: redFillWidth }]} />
            
            {/* Button text */}
            <View style={styles.buttonTextContainer}>
              <Text style={[Typography.bodyLg, styles.buttonText, { color: isDeleting ? Colors.white : '#EF4444' }]}>
                {isDeleting ? "almost gone... 😭" : "hold to delete 🥺"}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
      
      {/* Expanding red circle */}
      <View style={styles.circleContainer} pointerEvents="none">
        <Animated.View 
          style={[
            styles.expandingCircle, 
            { 
              backgroundColor: '#EF4444',
              width: circleSize,
              height: circleSize,
              borderRadius: circleRadius,
            }
          ]} 
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl * 2,
  },
  textContainer: {
    marginTop: height * 0.2,
    alignItems: 'center',
  },
  subtitle: {
    marginTop: Spacing.xl,
    fontWeight: '400',
  },
  description: {
    marginTop: Spacing.xl,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  buttonContainer: {
    alignSelf: 'center',
  },
  buttonBase: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  buttonFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  buttonTextContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '600',
  },
  circleContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Spacing.xl * 2 + 28, // Center over the button
  },
  expandingCircle: {
    position: 'absolute',
    bottom: -height, // Roughly centered on button
  }
});
