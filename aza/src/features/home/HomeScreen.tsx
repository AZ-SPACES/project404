import React, { ComponentProps } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

type ActionTargetProps = {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
};

const ActionTarget = ({ icon, label }: ActionTargetProps) => (
  <TouchableOpacity style={styles.actionContainer} activeOpacity={0.7}>
    <View style={styles.actionIconCircle}>
      <Feather name={icon} size={24} color={Colors.primary} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Hero Image */}
      <View style={styles.topSection}>
        <Image 
          source={{ uri: 'https://images.pexels.com/photos/3609832/pexels-photo-3609832.jpeg' }} 
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={styles.overlay} />
        
        <SafeAreaView>
          {/* Header */}
          <View style={styles.header}>
            {/* The rule says no <small> as heading, or decorative copy. Just use standardized typography. */}
            <Text style={[Typography.h1, { color: Colors.white }]}>Good Morning</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.profilePicContainer}>
                <Image 
                  source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} 
                  style={styles.profilePic} 
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bellButton}>
                <Feather name="bell" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Balance */}
          <View style={styles.balanceSection}>
            <Text style={[Typography.bodyLg, styles.accountType]}>Main • GHS</Text>
            <View style={styles.balanceRow}>
              {/* Using the standard h1 typography instead of arbitrary 44px text to respect the Rules */}
              <Text style={[Typography.h1, styles.balanceText]}>GH₵ 0.00</Text>
              <TouchableOpacity style={styles.eyeIcon}>
                <Feather name="eye-off" size={Typography.h1.fontSize} color={Colors.white} />
              </TouchableOpacity>
            </View>
            <Text style={[Typography.caption, styles.updateTime]}>Updated last 20s ago</Text>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <ActionTarget icon="arrow-up" label="Send" />
            <ActionTarget icon="arrow-down" label="Request" />
            <ActionTarget icon="credit-card" label="Details" />
            <ActionTarget icon="more-horizontal" label="More" />
          </View>
        </SafeAreaView>
      </View>
      
      {/* Bottom Section / Transactions */}
      {/* 
        Rule overrides: 
        Cards: 8–12px max border-radius. 
        Shadows: max 0 2px 8px rgba(0,0,0,0.1)
      */}
      <View style={styles.bottomSection}>
        <View style={styles.transactionsHeader}>
          <Text style={[Typography.h3, styles.transactionsTitle]}>Transactions</Text>
          <TouchableOpacity>
            <Text style={[Typography.body, styles.seeAllText]}>See all</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.emptyStateCard}>
          <View style={styles.clockIconContainer}>
            <Feather name="clock" size={20} color={Colors.textSecondary} />
          </View>
          <Text style={[Typography.body, styles.emptyStateText]}>No transactions</Text>
        </View>
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  topSection: {
    height: height * 0.55, 
    backgroundColor: Colors.primary, 
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23, 71, 23, 0.45)', // Using primary green tone for overlay
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePicContainer: {
    marginRight: Spacing.md,
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.2)', // solid fill or subtle transparency. Avoiding glassmorphism (blurry white boxes).
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceSection: {
    alignItems: 'center',
    marginTop: Spacing.xl * 2,
  },
  accountType: {
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceText: {
    color: Colors.white,
  },
  eyeIcon: {
    marginLeft: Spacing.md,
  },
  updateTime: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: Spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl * 2,
  },
  actionContainer: {
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full, // Circle for icons
    backgroundColor: Colors.white, // Solid fill, not glassmorphism
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.white,
  },
  bottomSection: {
    flex: 1,
    backgroundColor: Colors.white,
    marginTop: -Spacing.lg, 
    borderTopLeftRadius: Radius.md, // 12px conforming to user rule max
    borderTopRightRadius: Radius.md, // 12px conforming to user rule max
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  transactionsTitle: {
    color: Colors.textPrimary,
  },
  seeAllText: {
    color: Colors.primary,
  },
  emptyStateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md, // 12px max
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clockIconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  emptyStateText: {
    color: Colors.textSecondary,
  },
});
