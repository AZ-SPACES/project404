import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';

const STORAGE_DATA = [
  { label: 'Photos', size: '45.2 MB', color: '#6366F1', percentage: 65 },
  { label: 'Videos', size: '20.1 MB', color: '#0EA5E9', percentage: 25 },
  { label: 'Documents', size: '4.5 MB', color: '#F59E0B', percentage: 8 },
  { label: 'Voice Notes', size: '1.9 MB', color: '#10B981', percentage: 2 },
];

export default function ManageStorageScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={Colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Storage</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.totalStorageCard}>
          <Text style={styles.totalLabel}>Total Space Used</Text>
          <Text style={styles.totalValue}>71.7 MB</Text>
          
          <View style={styles.progressBarContainer}>
            {STORAGE_DATA.map((item, index) => (
              <View 
                key={item.label} 
                style={[
                  styles.progressSegment, 
                  { 
                    backgroundColor: item.color, 
                    width: `${item.percentage}%`,
                    borderTopLeftRadius: index === 0 ? 8 : 0,
                    borderBottomLeftRadius: index === 0 ? 8 : 0,
                    borderTopRightRadius: index === STORAGE_DATA.length - 1 ? 8 : 0,
                    borderBottomRightRadius: index === STORAGE_DATA.length - 1 ? 8 : 0,
                  }
                ]} 
              />
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.listContainer}>
          {STORAGE_DATA.map((item, index) => (
            <React.Fragment key={item.label}>
              <View style={styles.listItem}>
                <View style={styles.listLeft}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <Text style={styles.listLabel}>{item.label}</Text>
                </View>
                <Text style={styles.listSize}>{item.size}</Text>
              </View>
              {index < STORAGE_DATA.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity style={styles.clearButton} activeOpacity={0.8}>
          <Text style={styles.clearButtonText}>Clear Chat History</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: Spacing.xs, marginLeft: -Spacing.xs },
  headerTitle: { ...Typography.bodyLg, fontWeight: '600', color: Colors.textPrimary },
  scrollContent: { padding: Spacing.lg },
  totalStorageCard: {
    backgroundColor: Colors.isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  totalLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.xs },
  totalValue: { ...Typography.h1, color: Colors.textPrimary, marginBottom: Spacing.xl },
  progressBarContainer: {
    flexDirection: 'row',
    height: 16,
    width: '100%',
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  progressSegment: {
    height: '100%',
  },
  sectionTitle: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  listContainer: {
    backgroundColor: Colors.isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl * 2,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  listLeft: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: Spacing.md },
  listLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  listSize: { ...Typography.body, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md + 12 + Spacing.md },
  clearButton: {
    backgroundColor: Colors.isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
    paddingVertical: 16,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  clearButtonText: { ...Typography.button, color: '#EF4444', fontWeight: '600' },
});
