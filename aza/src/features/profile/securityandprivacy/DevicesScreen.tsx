import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { Feather, AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';

const { height } = Dimensions.get('window');



export function DevicesScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const isDark = Colors.isDark;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const [deviceInfo, setDeviceInfo] = useState({
    model: Device.modelName || 'Unknown Device',
    os: Platform.OS === 'ios' ? 'iOS' : 'Android',
    osVersion: Device.osVersion || '',
    brand: Device.brand || '',
    location: 'Detecting location...',
    ipAddress: 'Detecting...',
    status: 'Active now',
    lastSeen: 'Just now'
  });

  useEffect(() => {
    async function getIP() {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setDeviceInfo(prev => ({ ...prev, ipAddress: data.ip }));
      } catch (e) {
        setDeviceInfo(prev => ({ ...prev, ipAddress: 'Unavailable' }));
      }
    }
    getIP();
  }, []);

  useEffect(() => {
    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setDeviceInfo(prev => ({ ...prev, location: 'Location restricted' }));
          return;
        }

        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        if (reverseGeocode.length > 0) {
          const item = reverseGeocode[0];
          const city = item?.city || item?.subregion || 'Unknown City';
          const country = item?.country || 'Unknown Country';
          setDeviceInfo(prev => ({ ...prev, location: `${city}, ${country}` }));
        }
      } catch (e) {
        setDeviceInfo(prev => ({ ...prev, location: 'Location unavailable' }));
      }
    }
    getLocation();
  }, []);
  
  const DeviceDetailRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.detailRow}>
      <Text style={[Typography.body, styles.detailLabel]}>{label}</Text>
      <Text style={[Typography.body, styles.detailValue]}>{value}</Text>
    </View>
  );
  
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
          useNativeDriver: true }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true }),
      ]).start();
    }
  }, [isBottomSheetVisible]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')}
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
              <View style={styles.deviceHeaderRow}>
                <Text style={[Typography.bodyLg, styles.deviceTitle]}>{deviceInfo.os}, {deviceInfo.model}</Text>
                <View style={styles.statusBadge}>
                   <View style={styles.statusDot} />
                   <Text style={styles.statusText}>{deviceInfo.status}</Text>
                </View>
              </View>
              <Text style={[Typography.body, styles.deviceSubtitle]}>This device — {deviceInfo.location}</Text>
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
              transform: [{ translateY: bottomSheetAnim }] },
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
              <Text style={[Typography.h2, styles.bottomSheetTitle]}>{deviceInfo.os}, {deviceInfo.model}</Text>
              <Text style={[Typography.body, styles.bottomSheetSubtitle]}>This device</Text>
            </View>
          </View>
          
          <View style={styles.detailsContainer}>
            <DeviceDetailRow label="Device model" value={deviceInfo.model} />
            <DeviceDetailRow label="Operating system" value={`${deviceInfo.os} ${deviceInfo.osVersion}`} />
            <DeviceDetailRow label="Public IP address" value={deviceInfo.ipAddress} />
            <DeviceDetailRow label="Current location" value={deviceInfo.location} />
            <DeviceDetailRow label="Status" value={deviceInfo.status} />
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

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    justifyContent: 'center',
    alignItems: 'center' },
  scrollContent: {
    paddingBottom: Spacing.xl },
  titleSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl },
  mainTitle: {
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontSize: 32,
    fontWeight: '700' },
  mainDescription: {
    color: Colors.textSecondary },
  contentSection: {
    paddingHorizontal: Spacing.lg },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md },
  deviceInfo: {
    flex: 1 },
  deviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm },
  deviceTitle: {
    fontWeight: '600',
    color: Colors.textPrimary },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12 },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginRight: 4 },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#22C55E' },
  deviceSubtitle: {
    color: Colors.textSecondary,
    marginTop: 2 },
  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10 },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 16 },
  bottomSheetTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4 },
  bottomSheetSubtitle: {
    color: Colors.textSecondary },
  closeButton: {
    backgroundColor: isDark ? Colors.white10 : "rgba(22, 51, 0, 0.04)",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center" },
  detailsContainer: {
    marginBottom: 32 },
  detailRow: {
    marginBottom: 24 },
  detailLabel: {
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4 },
  detailValue: {
    color: Colors.textSecondary },
  bottomSheetFooter: {
    marginTop: 8 } });
}


