import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@react-native-vector-icons/feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { useDisplayContext, ACCENT_PALETTES, BANNER_GRADIENTS } from '../../../providers/DisplayProvider';
import { RootStackParamList } from '../../../navigation/types';
import { MINI_APP_REGISTRY } from '../miniapps/registry';
import { MiniAppCategory, MiniAppEntry } from '../miniapps/types';
import { useDisabledMiniApps } from '../../../hooks/useDisabledMiniApps';
import { useCommunityMiniApps } from '../../../hooks/useCommunityMiniApps';
import { queryClient } from '../../../lib/queryClient';
import { queryKeys } from '../../../lib/queryKeys';

type HubNavProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

const { width } = Dimensions.get('window');
const GRID_PADDING = Spacing.lg;
const GRID_GAP = Spacing.sm;
const TILE_SIZE = (width - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

const ALL_CATEGORIES: ('All' | MiniAppCategory)[] = [
  'All',
  'Business',
  'Finance',
  'Bills & Utilities',
  'Entertainment',
  'Productivity',
  'Games',
];

export default function HubScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { hubBackground, hubDim, hubBlur, hubBannerGradient, accentId } = useDisplayContext();
  const accentPalette = ACCENT_PALETTES.find(p => p.id === accentId) ?? ACCENT_PALETTES[0];
  const bannerGrad = hubBannerGradient === 'accent'
    ? [accentPalette.primary, accentPalette.gradientEnd]
    : (BANNER_GRADIENTS.find(g => g.id === hubBannerGradient)?.colors ?? [accentPalette.primary, accentPalette.gradientEnd]) as string[];
  const navigation = useNavigation<HubNavProp>();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | MiniAppCategory>('All');
  const { disabled, maintenance } = useDisabledMiniApps();
  const { communityApps } = useCommunityMiniApps();

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.disabledMiniApps() });
    }, []),
  );

  const openApp = useCallback((appId: string) => {
    navigation.navigate('MiniApp', { appId });
  }, [navigation]);

  const allApps = React.useMemo(
    () => [...MINI_APP_REGISTRY, ...communityApps],
    [communityApps],
  );

  const filteredApps = React.useMemo(() => {
    return allApps.filter((app) => {
      if (disabled.has(app.id)) return false;
      const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || app.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory, disabled, allApps]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Hero background */}
      <View style={[StyleSheet.absoluteFill, { height: '55%' }]}>
        {hubBackground ? (
          <Image source={{ uri: hubBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={bannerGrad as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        )}
        {hubBlur > 0 && <BlurView intensity={hubBlur} tint="default" style={StyleSheet.absoluteFill} />}
        {hubDim > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${hubDim})` }]} />}
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header title over the image */}
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Mini Apps</Text>
          <Text style={styles.heroSubtitle}>Services built into Aza</Text>
        </View>

        {/* Card sheet */}
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Search */}
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                underlineColorAndroid="transparent"
                placeholder="Search mini apps..."
                placeholderTextColor={Colors.textSecondary}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search mini apps"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
                  <Feather name="x-circle" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {ALL_CATEGORIES.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setActiveCategory(cat)}
                    accessibilityRole="radio"
                    accessibilityLabel={cat}
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* All apps grid */}
            <Text style={styles.sectionLabel}>
              {activeCategory === 'All' ? 'All Apps' : activeCategory}
            </Text>

            {filteredApps.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="search" size={32} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No apps found</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {filteredApps.map((app) => (
                  <AppTile
                    key={app.id}
                    app={app}
                    onPress={openApp}
                    inMaintenance={maintenance.has(app.id)}
                    styles={styles}
                    Colors={Colors}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ── Tile component ── */
interface TileProps {
  app: MiniAppEntry;
  onPress: (id: string) => void;
  inMaintenance: boolean;
  styles: ReturnType<typeof createStyles>;
  Colors: ThemeColors;
}

function AppTile({ app, onPress, inMaintenance, styles, Colors }: TileProps) {
  return (
    <TouchableOpacity
      style={[styles.tile, inMaintenance && styles.tileMaintenance]}
      activeOpacity={inMaintenance ? 0.5 : 0.75}
      onPress={() => onPress(app.id)}
      accessibilityRole="button"
      accessibilityLabel={inMaintenance ? `${app.name} — under maintenance` : `Open ${app.name}`}
      accessibilityState={{ disabled: inMaintenance }}
    >
      <View style={[styles.tileIcon, app.color ? { backgroundColor: app.color } : undefined]}>
        {typeof app.icon === 'string' ? (
          <Text style={[styles.tileEmoji, inMaintenance && { opacity: 0.45 }]}>{app.icon}</Text>
        ) : (
          <Image
            source={app.icon}
            style={[
              app.color ? { width: 32, height: 32 } : { width: '100%', height: '100%' },
              inMaintenance && { opacity: 0.45 },
            ]}
            resizeMode={app.color ? 'contain' : 'cover'}
          />
        )}
        {inMaintenance && (
          <View style={styles.maintenanceBadge}>
            <Feather name="tool" size={8} color="#fff" />
          </View>
        )}
      </View>
      <Text style={[styles.tileName, inMaintenance && { color: Colors.textSecondary }]} numberOfLines={2}>
        {app.name}
      </Text>
      {inMaintenance && (
        <Text style={styles.tileMaintenanceLabel} numberOfLines={1}>Maintenance</Text>
      )}
    </TouchableOpacity>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#174717',
    },
    safeArea: {
      flex: 1,
    },
    heroHeader: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    heroSubtitle: {
      ...Typography.body,
      color: 'rgba(255,255,255,0.75)',
    },
    sheet: {
      flex: 1,
      backgroundColor: isDark ? Colors.background : Colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl * 3,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      height: 48,
      marginBottom: Spacing.md,
    },
    searchIcon: { marginRight: Spacing.sm },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: Colors.textPrimary,
    },
    chipRow: {
      gap: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      ...Typography.caption,
      color: Colors.textSecondary,
      fontWeight: '600',
    },
    chipTextActive: {
      color: Colors.secondary,
    },
    sectionLabel: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginTop: Spacing.lg,
      marginBottom: Spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
    },
    tile: {
      width: TILE_SIZE,
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    tileIcon: {
      width: TILE_SIZE - Spacing.lg,
      height: TILE_SIZE - Spacing.lg,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xs,
      overflow: 'hidden',
    },
    tileEmoji: { fontSize: 32 },
    tileMaintenance: {
      opacity: 0.6,
    },
    maintenanceBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#d97706',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileName: {
      ...Typography.caption,
      color: Colors.textPrimary,
      textAlign: 'center',
      fontWeight: '600',
      lineHeight: 16,
    },
    tileMaintenanceLabel: {
      ...Typography.caption,
      fontSize: 9,
      color: '#d97706',
      textAlign: 'center',
      fontWeight: '600',
      marginTop: 1,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing.xl * 2,
      gap: Spacing.md,
    },
    emptyText: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
  });
}
