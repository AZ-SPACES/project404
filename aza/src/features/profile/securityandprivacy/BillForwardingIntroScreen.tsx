import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { Colors, Spacing, Radius } from '../../../theme';
import Button from '../../../components/ui/Button';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "BillForwardingIntro">;

export function BillForwardingIntroScreen() {
  const navigation = useNavigation<NavigationProp>();

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

      <View style={styles.content}>
        <View style={styles.illustrationContainer}>
          <Image 
            source={require('../../../assets/paper-plane.png')} 
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>
            FORWARD A BILL.{"\n"}WE'LL DO THE REST.
          </Text>
          <Text style={styles.description}>
            Got a bill or invoice in your inbox? Forward it to your unique Wise email address. We'll grab the details and prepare a draft payment for you to review and send.
          </Text>
        </View>

        <View style={styles.footer}>
          <Button
          title ='Get my email addresss'
          backgroundColor= {Colors.primary}
          textColor={Colors.secondary}
          borderRadius={24}
          onPress={() => navigation.navigate("BillForwardingDetails")}
          />
        </View>
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
    height: 60,
    justifyContent: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
  },
  illustrationContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  illustration: {
    width: width * 0.8,
    height: 300,
  },
  textContainer: {
    alignItems: 'center',
    flex: 1,
    marginTop: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: Spacing.lg,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: Spacing.sm,
  },
  footer: {
    width: '100%',
    paddingBottom: Spacing.md,
  },
  primaryButton: {
    backgroundColor: '#9AF064',
    paddingVertical: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#004D00',
    fontSize: 18,
    fontWeight: '700',
  },
});
