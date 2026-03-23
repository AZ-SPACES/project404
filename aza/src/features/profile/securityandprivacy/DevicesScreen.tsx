import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';

const { height } = Dimensions.get('window');

const DeviceDetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={[Typography.body, styles.detailLabel]}>{label}</Text>
    <Text style={[Typography.body, styles.detailValue]}>{value}</Text>
  </View>
);

export function DevicesScreen() {
  const navigation = useNavigation();
  
  // State for bottom sheet
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isBottomSheetVisible) {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isBottomSheetVisible]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={[Typography.h1, styles.mainTitle]}>Devices</Text>
          <Text style={[Typography.bodyLg, styles.mainDescription]}>
            Manage your devices
          </Text>
        </View>

        <View style={styles.contentSection}>
          <TouchableOpacity 
            style={styles.deviceRow} 
            activeOpacity={0.7}
            onPress={() => setBottomSheetVisible(true)}
          >
            <View style={styles.iconContainer}>
              <Feather name="smartphone" size={24} color={Colors.textPrimary} />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={[Typography.bodyLg, styles.deviceTitle]}>iOS, iPhone 13</Text>
              <Text style={[Typography.body, styles.deviceSubtitle]}>This device - Kumasi, Ghana</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Device Details Bottom Sheet */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isBottomSheetVisible ? "auto" : "none"}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: backdropAnim, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)' }]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setBottomSheetVisible(false)}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.bottomSheetContainer,
            {
              zIndex: 1001,
              transform: [{ translateY: bottomSheetAnim }],
            },
          ]}
        >
          <View style={styles.bottomSheetHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setBottomSheetVisible(false)}
            >
              <AntDesign name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View>
              <Text style={[Typography.h2, styles.bottomSheetTitle]}>iOS, iPhone 13</Text>
              <Text style={[Typography.body, styles.bottomSheetSubtitle]}>This device</Text>
            </View>
          </View>
          
          <View style={styles.detailsContainer}>
            <DeviceDetailRow label="First logged in" value="29 January 2026 at 08:48" />
            <DeviceDetailRow label="Last logged in" value="22 March 2026 at 21:21" />
            <DeviceDetailRow label="Last logged in from" value="Kumasi, Ghana" />
          </View>

          <View style={styles.bottomSheetFooter}>
            <Button 
              title="Remove this device" 
              onPress={() => setBottomSheetVisible(false)}
              backgroundColor="#D1222E"
              textColor={Colors.white}
              borderRadius={Radius.full}
            />
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  mainTitle: {
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontSize: 32,
    fontWeight: '700',
  },
  mainDescription: {
    color: Colors.textSecondary,
  },
  contentSection: {
    paddingHorizontal: Spacing.lg,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceTitle: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  deviceSubtitle: {
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 16,
  },
  bottomSheetTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  bottomSheetSubtitle: {
    color: Colors.textSecondary,
  },
  closeButton: {
    backgroundColor: Colors.surface,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsContainer: {
    marginBottom: 32,
  },
  detailRow: {
    marginBottom: 24,
  },
  detailLabel: {
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  detailValue: {
    color: Colors.textSecondary,
  },
  bottomSheetFooter: {
    marginTop: 8,
  },
});
